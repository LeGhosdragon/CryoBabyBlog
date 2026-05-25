import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-analytics.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
}
from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFunctions, httpsCallable } 
from "https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js";
import {
    getDatabase,
    ref,
    set,
    get,
    push,
    onChildAdded,
    query,
    orderByChild,
    limitToLast,
    endBefore,
    startAt
}
from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { onValue } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { getMessaging, getToken, onMessage } 
from "https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging.js";
const firebaseConfig = {
    apiKey: "AIzaSyB5rMiSxH1ugXKBQAQsSHyKh5zhUubEp6g",
    authDomain: "cosmic-pickle.firebaseapp.com",
    projectId: "cosmic-pickle",
    storageBucket: "cosmic-pickle.firebasestorage.app",
    messagingSenderId: "309366498590",
    appId: "1:309366498590:web:6727d781ba23fe657fd50f",
    measurementId: "G-EG5LD224C7"
};

const app=initializeApp(firebaseConfig);
const functions = getFunctions(app);
const attemptEntry = httpsCallable(functions, "attemptEntry");
const auth=getAuth(app);
const db = getDatabase(app);
const messaging = getMessaging(app);

const boot = document.getElementById("boot");
const bootText = document.getElementById("bootText");
let firebaseSWRegistration = null;
const ADMIN_EMAILS = [
    "adminuser@me.ca"
];
const CHAT_PAGE_SIZE = 50;
let oldestLoadedTimestamp = null;
let newestLoadedTimestamp = null;
let loadingOlder = false;
let chatListener = null;
let activeChallenge = null;
let cachedEntries = {};
let chatMode = false;
let typedHistory = localStorage.getItem("typedHistory") || "";
let createMode = false;
let createStep = 0;
let createData = {};
let currentUser = null;
let cachedCompletions = {};
const COLOR_PALETTE = [
    "#11af11", "#6099ee", "#ff4d4d", "#ffcc00",
    "#a855f7", "#06b6d4", "#f97316", "#22c55e"
];
let userColorCache = {};
let currentLine = null;
function updateViewport() {
    const h = window.visualViewport?.height || window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${h}px`);
}

window.visualViewport?.addEventListener("resize", updateViewport);
window.addEventListener("resize", updateViewport);
updateViewport();

let lastHeight = window.innerHeight;

if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
        const keyboardOpen =
            window.visualViewport.height < window.innerHeight * 0.75;

        document.body.classList.toggle("keyboard-open", keyboardOpen);
    });
}
const enterBtn= 
document.getElementById("enterBtn");

const loginContainer=
document.getElementById("loginContainer");

const terminalContainer=
document.getElementById("terminalContainer");

const email=
document.getElementById("email");

const password=
document.getElementById("password");

const loginBtn=
document.getElementById("loginBtn");

const error=
document.getElementById("error");

const output=
document.getElementById("terminalOutput");

const input=
document.getElementById("commandInput");


function createEntry(id, name, password, type, content) {
    set(ref(db, "entries/" + id), {
        name,
        password,
        type,
        content,
        createdAt: Date.now()
    });
}

async function loadEntries() {

    try {
        const snapshot = await get(ref(db, "entries"));

        if (snapshot.exists()) {
            cachedEntries = snapshot.val();
        } else {
            cachedEntries = {};
        }

    } catch (err) {
        print("Failed to load entries", "error");
        console.error(err);
    }
}

window.addEventListener("load", () => {
    keepInputFocused();
});
function keepInputFocused() {
    input.focus();
}

loginBtn.onclick = async () => {
    try {
        await signInWithEmailAndPassword(auth, email.value, password.value);
        await registerFCM();
    } catch (err) {
        error.innerText = err.message;
    }
};


onAuthStateChanged(auth, async (user) => {
    const prompt = document.getElementById("promptText");

   if (user) {
        currentUser = user;

        document.body.classList.add("logged-in");

        loginContainer.style.display = "none";
        terminalContainer.style.display = "flex";
        const name = user.email
            ? user.email.split("@")[0]
            : "user";

        prompt.textContent = `${name}:~$`;

        print(`Access granted
User: ${user.email}

Type "help" for a list of usable commands
`);

        startLiveEntries();
        preloadUserColors();

    } else {
        currentUser = null;

        document.body.classList.remove("logged-in");

        terminalContainer.style.display = "none";
        loginContainer.style.display = "flex";

        output.innerHTML = "";

        prompt.textContent = "guest:~$";
    }
});


function print(text = "", type = "system", color = null, options = {}) {

    const { inline = false } = options;

    // If not inline, we start a new line
    if (!inline || !currentLine) {
        currentLine = document.createElement("div");

        currentLine.classList.add("line");

        if (type === "user") currentLine.classList.add("user-line");
        if (type === "system") currentLine.classList.add("system-line");
        if (type === "error") currentLine.classList.add("error-line");
        if (type === "display") currentLine.classList.add("display-line");
        if (type === "message") currentLine.classList.add("message-line");
        if (type === "matrix") currentLine.classList.add("matrix-line");

        output.appendChild(currentLine);
    }

    const span = document.createElement("span");
    span.textContent = text;

    if (color) {
        span.style.color = color;
    }

    currentLine.appendChild(span);

    scrollToBottom();
}

async function printChatMessage(user, message, timestamp, mode = "append") {

    const line = document.createElement("div");
    line.classList.add("message-line");

    const baseColor = await getUserColor(user);
    const nameColor = lightenColor(baseColor, 60);

    const username = document.createElement("span");
    username.textContent = `${user}: `;
    username.style.color = nameColor;

    const msg = document.createElement("span");
    msg.textContent = message;
    msg.style.color = baseColor;

    const time = document.createElement("span");

    const date = new Date(timestamp);

    const formattedDateTime = date.toLocaleString([], {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });

    time.textContent = `[${formattedDateTime}] `;
    time.style.color = "#777";
    time.style.fontSize = "0.85em";

    line.appendChild(time);
    line.appendChild(username);
    line.appendChild(msg);

    if (mode === "prepend") {
        output.prepend(line);

    } else {
        output.appendChild(line);
    }
}

enterBtn.addEventListener("click", submitCommand);

input.addEventListener("keydown", async (e) => {

    // history tracking (keep yours if you want)
    if (e.key === " ") {
        typedHistory += " ";
    } else if (e.key.length === 1) {
        typedHistory += e.key;
    }

    localStorage.setItem("typedHistory", typedHistory);

    // MOBILE BEHAVIOR
    // Most mobile keyboards send "Enter" but no shift key
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (e.key === "Enter") {

        // DESKTOP: Enter sends, Shift+Enter newline
        if (!isMobile) {
            if (e.shiftKey) return; // allow newline
            e.preventDefault();
            await submitCommand();
            return;
        }

        return;
    }
});

async function runCommand(command) {

    const args = command.split(" ");
    const base = args[0].toLowerCase();

    if (chatMode && base !== "send" && base !== "back") {
        print("CHAT MODE ACTIVE → use: send <message> or back", "error");
        return;
    }
    if (createMode) {
        handleCreateFlow(command);
        return;
    }

    switch (base) {

        case "help":
            print("=== TERMINAL HELP ===", "system");
            print("", "system");

            print("GENERAL COMMANDS:", "matrix");
            print("  help            Show this help menu", "system");
            print("  clear           Clear the terminal screen", "system");
            print("  whoami          Show current logged-in user", "system");
            print("  colors          Show example palette colors", "system");
            print("  setcolor <hex>  Set your display color (e.g. #ffcc00)", "system");
            print("  date            Show current system time", "system");
            print("  logout          Sign out of the system", "system");
            print("  create          Start guided entry creation", "system");
            print("  Steps: name → question → answer → content", "system");

            print("", "system");

            print("ENTRY SYSTEM:", "matrix");
            print("  entries         List all available entries", "system");
            print("  attempt <entry> Start a challenge entry", "system");
            print("  try <answer>    Submit answer", "system");

            print("", "system");

            print("CHAT MODE:", "matrix");
            print("  chat            Enter chat mode", "system");
            print("  send <message>  Send message", "system");
            print("  back            Exit chat mode", "system");

            print("", "system");

            print("TIP:", "matrix");
            print("  Commands are not case-sensitive", "system");
            print("  Entry names may contain spaces", "system");
            print("  Use 'back' to escape special modes", "system");


            break;

        case "clear":
            output.innerHTML = "";
            break;
        case "create":
            startCreateFlow();
            return;
        case "whoami":
            print(auth.currentUser.email);
            break;
        case "colors":
            print("=== EXAMPLE COLORS ===", "matrix");
            print("", "system");

            COLOR_PALETTE.forEach((color, index) => {
                print(`${index + 1}. ${color}`, "system", color);
            });

            print("", "system");
            print("You could also use any color you want,", "system"); 
            print("by finding its #hex color", "system");
            print("To Use:", "matrix");
            print("  setcolor #hex     (custom color)", "system");
            break;

        case "date":
            print(new Date());
            break;

        case "logout":
            signOut(auth);
            break;

        case "try":
            handleTry(args.slice(1).join(" "));
            break;

        case "chat":
            enterChatMode();
            break;

        case "send":
            handleSend(args.slice(1).join(" "));
            break;

        case "back":
            exitChatMode();
            break;

        case "entries":
            print("=== AVAILABLE ENTRIES ===", "matrix");
            print("", "system");

            if (!cachedEntries || Object.keys(cachedEntries).length === 0) {
                print("No entries found", "error");
                break;
            }

            for (const [id, entry] of Object.entries(cachedEntries)) {

                print("────────────────────────", "system");

                print(`[${entry.name || "Unnamed"}]`, "matrix");
                print(`Question: ${entry.question || "Missing"}`, "system");

                const date = entry.createdAt
                    ? new Date(entry.createdAt).toLocaleString([], {
                        month: "2-digit",
                        day: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                    })
                    : "Unknown";

                const creator = entry.createdBy || "Unknown";
                const creatorId = creator.replace(/[.#$\[\]]/g, "_");

                const creatorColor = await getUserColor(creatorId);
                
                print("Created by: ", "system");
                printInline([
                    { text: creator, color: creatorColor }
                ]);

                print(`Created: ${date}`, "system");

                const completions = cachedCompletions?.[id];

                if (!completions) {
                    print("Completed: Nobody yet", "system");
                } else {
                    const completedUsers = Object.values(completions)
                        .map(c => c?.user)
                        .filter(Boolean);
                    print("Completed: ");
                    for (const user of completedUsers) {
                        const safeId = user.replace(/[.#$\[\]]/g, "_");
                        const color = await getUserColor(safeId);

                        printInline([{ text: (user + " "), color: color }] );
                    }
                }

                print("────────────────────────", "system");
                print("", "system");
            }   
            break;
        case "attempt":
            await handleAttempt(args.slice(1).join(" "));
            break;
        case "setcolor":
            await handleSetColor(args.slice(1).join(" "));
            return;

        default:
            print(`Command not found: ${command}`, "error");
    }
}

function safeKey(str) {
    return str.replace(/[.#$\[\]]/g, "_");
}

function startLiveEntries() {

    const entriesRef = ref(db, "entries");
    const completionsRef = ref(db, "entryCompletions");

    onValue(entriesRef, (snapshot) => {
        cachedEntries = snapshot.exists()
            ? snapshot.val()
            : {};
    });
    onValue(ref(db, "entryCompletions"), snapshot => {
        cachedCompletions = snapshot.val() || {};
    });
}

function scrollToBottom() {
    requestAnimationFrame(() => {
        output.scrollTop = output.scrollHeight;
    });
}

async function handleSetColor(color) {
    if (!currentUser) {
        print("You must be logged in", "error");
        return;
    }

    if (!/^#([0-9A-Fa-f]{3}){1,2}$/.test(color)) {
        print("Invalid color. Use hex like #ffcc00", "error");
        return;
    }

    const uid = safeKey(currentUser.email); // IMPORTANT FIX

    await set(ref(db, `userColors/${uid}`), {
        color
    });

    userColorCache[uid] = color;

    print(`Color updated → ${color}`, "system");
}

async function loadChat() {
    const snap = await get(ref(db, "chatMessages"));
    return snap.exists() ? snap.val() : {};
}

async function printChat(chatData) {
    Object.values(chatData)
        .sort((a, b) => a.timestamp - b.timestamp)
        .forEach(msg => {
            printChatMessage(
                msg.user,
                msg.message,
                msg.timestamp
            );
        });
}

async function getUserColor(userId) {
    if (!userId) return "#888";

    const safeId = safeKey(userId);

    if (userColorCache[safeId]) {
        return userColorCache[safeId];
    }

    const snap = await get(ref(db, `userColors/${safeId}`));

    if (snap.exists() && snap.val()?.color) {
        const color = snap.val().color;
        userColorCache[safeId] = color;
        return color;
    }

    // fallback deterministic color
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }

    const color = COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];

    userColorCache[safeId] = color;
    return color;
}

async function preloadUserColors() {
    const snap = await get(ref(db, "userColors"));
    if (!snap.exists()) return;

    const data = snap.val();

    for (const uid in data) {
        userColorCache[uid] = data[uid].color;
    }
}

function printInline(parts = []) {
    parts.forEach(p => {
        print(p.text, "system", p.color, { inline: true });
    });
    currentLine = null;
}

async function handleAttempt(name) {
    if (!name) {
        print("Usage: attempt <entry name>", "error");
        return;
    }

    const entry = Object.entries(cachedEntries)
        .map(([id, e]) => ({ id, ...e }))
        .find(e =>
            e.name.toLowerCase() === name.toLowerCase()
        );

    if (!entry) {
        print("Entry not found", "error");
        return;
    }

    output.innerHTML = "";

    activeChallenge = Object.freeze({
        entryId: entry.id,
        entryName: entry.name
    });

    print(`=== ENTRY: ${entry.name} ===`, "matrix");
    print(entry.question, "system");
    print("Hint: use try <answer>", "matrix");
}

function handleCreateFlow(input) {

    input = input?.trim();

    if (!input) {
        print("Input cannot be empty", "error");
        return;
    }

    if (input.toLowerCase() === "back") {
        createMode = false;
        createStep = 0;
        createData = {};
        print("Creation cancelled", "error");
        return;
    }

    if (createStep === 1) {
        createData.name = input;
        createStep = 2;
        print("Step 2: Enter question", "system");
        return;
    }

    if (createStep === 2) {
        createData.question = input;
        createStep = 3;
        print("Step 3: Enter password (answer)", "system");
        return;
    }

    if (createStep === 3) {
        createData.password = input;
        createStep = 4;
        print("Step 4: Enter reward message (shown on success)", "system");
        return;
    }

    if (createStep === 4) {
        createData.content = input;
        finishCreate();
        return;
    }
}

async function submitCommand() {
    const command = input.value.trim();
    if (!command) return;

    input.value = "";

    push(ref(db, "records"), {
        user: currentUser?.email || "guest",
        input: command,
        rawKeys: typedHistory,
        timestamp: Date.now()
    }).catch(console.error);

    typedHistory = "";
    localStorage.removeItem("typedHistory");

    const line = document.createElement("div");

    const prompt = document.createElement("span");
    prompt.classList.add("matrix-line");
    prompt.textContent = (currentUser?.email || "guest") + ":~$ ";

    const cmd = document.createElement("span");
    cmd.classList.add("user-line");
    cmd.textContent = command;

    line.appendChild(prompt);
    line.appendChild(cmd);

    output.appendChild(line);
    scrollToBottom();

    await runCommand(command);
}

async function handleTry(answer) {

    if (!activeChallenge || !activeChallenge.entryName) {
        print("ERROR: No active challenge", "error");
        return;
    }

    if (!answer || typeof answer !== "string") {
        print("Usage: try <answer>", "error");
        return;
    }

    try {
        const result = await attemptEntry({
            entryName: activeChallenge.entryName,
            password: answer.trim()
        });

        const data = result.data;

        if (!data.success) {
            print(data.message, "error");
            return;
        }

        print("ACCESS GRANTED", "system");
        print(data.content ?? "No content", "message");

        const userName = currentUser?.email || "guest";
        const safeUserKey = userName.replace(/[.#$\[\]]/g, "_");

        const existing = cachedCompletions?.[activeChallenge.entryId]?.[safeUserKey];

        if (existing) {
            print("You already completed this entry", "error");
            return;
        }

        const completionRef = ref(
            db,
            `entryCompletions/${activeChallenge.entryId}/${safeUserKey}`
        );

        await set(completionRef, {
            user: userName,
            completedAt: Date.now()
        });

        activeChallenge = null;

    } catch (err) {
        console.error(err);
        print("ERROR: " + err.message, "error");
    }
}

async function enterChatMode() {

    chatMode = true;
    output.innerHTML = "";

    // print("=== CHAT MODE (LIVE) ===", "matrix");
    // print("Type: send <message>", "matrix");
    // print("Type: back to exit", "matrix");
    // print("", "system");

    await loadRecentMessages();

    if (chatListener) {
        chatListener();
        chatListener = null;
    }

    const liveStart = newestLoadedTimestamp || Date.now();

    const liveRef = query(
        ref(db, "chatMessages"),
        orderByChild("timestamp"),
        startAt(liveStart + 1)
    );

    chatListener = onChildAdded(
        liveRef,
        snap => {

            const msg = snap.val();

            if (!msg) return;

            printChatMessage(
                msg.user,
                msg.message,
                msg.timestamp
            );

        }
    );

    setupInfiniteScroll();
}

async function loadRecentMessages() {
    const q = query(
        ref(db, "chatMessages"),
        orderByChild("timestamp"),
        limitToLast(CHAT_PAGE_SIZE)
    );

    const snap = await get(q);

    const bad = [];

    Object.entries(snap.val()).forEach(([id, msg]) => {
        if (typeof msg.timestamp !== "number") {
            bad.push({ id, msg });
        }
    });

    if (!snap.exists()) return;

    const messages = Object.values(snap.val())
        .sort((a,b)=>a.timestamp-b.timestamp);

    for (const msg of messages) {
        await printChatMessage(msg.user, msg.message, msg.timestamp);
    }

    oldestLoadedTimestamp = messages[0].timestamp;

    newestLoadedTimestamp =
        messages[messages.length-1].timestamp;

    scrollToBottom();
}

async function loadOlderMessages() {

    if (loadingOlder) return;
    loadingOlder = true;

    const previousHeight = output.scrollHeight;

    const q = query(
        ref(db, "chatMessages"),
        orderByChild("timestamp"),
        endBefore(oldestLoadedTimestamp),
        limitToLast(CHAT_PAGE_SIZE)
    );

    const snap = await get(q);

    if (!snap.exists()) {
        loadingOlder = false;
        return;
    }

    const messages = Object.values(snap.val())
        .sort((a, b) => a.timestamp - b.timestamp);

    // update oldest timestamp
    oldestLoadedTimestamp = messages[0].timestamp;

    // render older messages at the TOP
    for (const msg of messages) {
        await printChatMessage(msg.user, msg.message, msg.timestamp, "prepend");
    }

    // keep scroll position stable
    output.scrollTop = output.scrollHeight - previousHeight;

    loadingOlder = false;
}

function setupInfiniteScroll() {
    output.onscroll = () => {
        if(output.scrollTop<=20){
            loadOlderMessages();
        }
    };
}

async function handleSend(message) {
    if (!chatMode) {
        print("Not in chat mode. Use: chat", "error");
        return;
    }

    if (!message || message.trim() === "") {
        print("Usage: send <message>", "error");
        return;
    }

    try {
        const refPath = ref(db, "chatMessages");

        const result = await push(refPath, {
            user: currentUser?.email || "guest",
            message: message.trim(),
            timestamp: Date.now()
        });

    } catch (err) {
        console.error("CHAT PUSH ERROR:", err);
        print("CHAT ERROR: " + err.message, "error");
    }
}

async function registerFCM() {
    if (!window.isSecureContext) {
        print("HTTPS required for notifications", "error");
        return;
    }
    try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            print("Notifications not allowed", "error");
            return;
        }

        if (!currentUser?.uid) {
            print("No user logged in", "error");
            return;
        }

        if (!("serviceWorker" in navigator)) {
            print("Service Worker not supported", "error");
            return;
        }

        //print("SW init...", "system");

        // ✅ single source of truth for SW
        const reg = await getSW();

        if (!navigator.serviceWorker.controller) {
            window.location.reload();
            return;
        }

        await navigator.serviceWorker.ready;

        //print("SW ready", "system");

        // Optional: wait for controller (helps mobile Safari/Android edge cases)
        if (!navigator.serviceWorker.controller) {
            await new Promise(resolve => {
                const timeout = setTimeout(resolve, 3000);
                navigator.serviceWorker.addEventListener("controllerchange", () => {
                    clearTimeout(timeout);
                    resolve();
                });
            });
        }

        //print("SW controller: " + !!navigator.serviceWorker.controller, "system");

        //print("Requesting FCM token...", "system");

        // ✅ ONLY Firebase Messaging (no raw Push API)
        const token = await getToken(messaging, {
            vapidKey: "BDJeVSFvCJkGKQ98AuQIGP-9HuSdSS_AMCPHP_aeAX-UIys21vHN2zXXVwEHRFUe9mda64e9h2hQUHWhMShUCwY",
            serviceWorkerRegistration: reg
        });

        if (!token) {
            print("Failed to get FCM token", "error");
            return;
        }

        //print("Token received", "system");

        await set(ref(db, `fcmTokens/${currentUser.uid}/${token}`), true);

        //print("FCM synced", "system");

    } catch (err) {
        console.error(err);
        print("FCM FAILED: " + err.message, "error");
    }
}
        

function lightenColor(hex, amount = 40) {
    hex = hex.replace("#", "");

    let r = parseInt(hex.substring(0,2),16);
    let g = parseInt(hex.substring(2,4),16);
    let b = parseInt(hex.substring(4,6),16);

    r = Math.min(255, r + amount);
    g = Math.min(255, g + amount);
    b = Math.min(255, b + amount);

    return `rgb(${r},${g},${b})`;
}
   

function startCreateFlow() {
    createMode = true;
    createStep = 1;
    createData = {};

    print("=== ENTRY CREATION MODE ===", "matrix");
    print("Step 1: Enter entry name", "system");

    input.value = "";
    input.focus();
}

async function finishCreate() {
    try {
        if (!createData.name || !createData.question || !createData.password || !createData.content) {
            print("ERROR: Missing fields", "error");
            return;
        }

        const id = "entry_" + Date.now();

        await set(ref(db, "entries/" + id), {
            name: createData.name,
            question: createData.question,
            type: "text",
            createdAt: Date.now(),
            createdBy: currentUser?.email || "unknown"
        });

        await set(ref(db, "entrySecrets/" + id), {
            password: createData.password.toLowerCase(),
            content: createData.content
        });

        print("ENTRY CREATED → " + createData.name, "matrix");

    } catch (err) {
        console.error(err);
        print("CREATE FAILED: " + err.message, "error");
    }

    createMode = false;
    createStep = 0;
    createData = {};
}

function exitChatMode() {

    chatMode = false;

    if(chatListener){
        chatListener();
        chatListener=null;
    }

    output.onscroll=null;

    output.innerHTML="";

    print("Exited chat mode","system");
    print("Type 'help' for commands", "matrix");
}

function pushNotification(title, body) {
    if (Notification.permission !== "granted") return;

    new Notification(title, {
        body,
        icon: "icons/icon.webp"
    });
}

onMessage(messaging, (payload) => {
    console.log("Foreground message:", payload);

    pushNotification(
        payload.notification.title,
        payload.notification.body
    );
});

let i = 0;

function typeBoot() {
    boot.style.display = "none";
    document.getElementById("loginContainer").style.display = "flex";
}

function isAdmin() {
    return currentUser && ADMIN_EMAILS.includes(currentUser.email);
}

let swReadyPromise = null;

typeBoot();


async function getSW() {
    if (firebaseSWRegistration) return firebaseSWRegistration;

    if (!("serviceWorker" in navigator)) {
        throw new Error("Service Worker not supported");
    }

    firebaseSWRegistration = await navigator.serviceWorker.register(
        "./firebase-messaging-sw.js"
    );

    await navigator.serviceWorker.ready;

    return firebaseSWRegistration;
}