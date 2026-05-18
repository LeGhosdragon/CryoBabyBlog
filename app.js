import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-analytics.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
}
from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFunctions, httpsCallable } 
from "https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js";
import { getDatabase, ref, set, get, push, onChildAdded }
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

const ADMIN_EMAILS = [
    "adminuser@me.ca"
];
let chatListener = null;
let activeChallenge = null;
let cachedEntries = {};
let chatMode = false;
let typedHistory = localStorage.getItem("typedHistory") || "";
let createMode = false;
let createStep = 0;
let createData = {};
let currentUser = null;


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

loginBtn.onclick=()=>{

    signInWithEmailAndPassword(
        auth,
        email.value,
        password.value
    )

    .catch(err=>{
        error.innerText=err.message;
    });

};





onAuthStateChanged(auth, async (user) => {
    const prompt = document.getElementById("promptText");

   if (user) {
        currentUser = user;

        setTimeout(() => {
            registerFCM();
        }, 500);

        document.body.classList.add("logged-in");

        loginContainer.style.display = "none";
        terminalContainer.style.display = "block";

        const name = user.email
            ? user.email.split("@")[0]
            : "user";

        prompt.textContent = `${name}:~$`;

        print(`Access granted
User: ${user.email}

Type "help" for a list of usable commands
`);

        startLiveEntries();

    } else {
        currentUser = null;

        document.body.classList.remove("logged-in");

        terminalContainer.style.display = "none";
        loginContainer.style.display = "flex";

        output.innerHTML = "";

        prompt.textContent = "guest:~$";
    }
});


function print(text, type = "system") {

    const line = document.createElement("div");

    if (type === "user") {
        line.classList.add("user-line");
    }

    if (type === "system") {
        line.classList.add("system-line");
    }

    if (type === "error") {
        line.classList.add("error-line");
    }

    if (type == "display")
    {
        line.classList.add("display-line")
    }

    if (type == "message")
    {
        line.classList.add("message-line")
    }

    if (type == "matrix")
    {
        line.classList.add("matrix-line")
    }

    line.textContent = text;

    output.appendChild(line);

    output.scrollTop = output.scrollHeight;
}

enterBtn.addEventListener("click", submitCommand);

input.addEventListener("keydown", async (e) => {

    if (e.key === " ") {
        typedHistory += " ";
    } else if (e.key.length === 1) {
        typedHistory += e.key;
    }

    localStorage.setItem("typedHistory", typedHistory);

    if (e.key !== "Enter") return;

    e.preventDefault();

    submitCommand();
});

function runCommand(command) {

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
            print("  date            Show current system time", "system");
            print("  logout          Sign out of the system", "system");

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
            if (!isAdmin()) {
                print("ACCESS DENIED — admin only command", "error");
                return;
            }

            startCreateFlow();
            return;
        case "whoami":
            print(auth.currentUser.email);
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

            Object.entries(cachedEntries).forEach(([id, entry], index) => {

                print("────────────────────────", "system");

                print(`[${index + 1}] ${entry.name || "Unnamed"}`, "matrix");
                print(`Question: ${entry.question || "Missing"}`, "system");

                const date = entry.createdAt
                    ? new Date(entry.createdAt).toLocaleString()
                    : "Unknown";

                print(`Created: ${date}`, "system");

                print("────────────────────────", "system");
                print("", "system");
            });

            break;

        case "attempt":
            handleAttempt(args.slice(1).join(" "));
            break;

        default:
            print(`Command not found: ${command}`, "error");
    }
}

function startLiveEntries() {

    const entriesRef = ref(db, "entries");

    onValue(entriesRef, (snapshot) => {

        cachedEntries = snapshot.exists() ? snapshot.val() : {};

    }, (error) => {
        console.error(error);
        print("Failed to sync entries", "error");
    });
}

async function loadChat() {
    const snap = await get(ref(db, "chatMessages"));
    return snap.exists() ? snap.val() : {};
}

function printChat(chatData) {
    Object.values(chatData)
        .sort((a, b) => a.timestamp - b.timestamp)
        .forEach(msg => {
            print(`${msg.user}: ${msg.message}`, "message");
        });
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

    if (input.toLowerCase() === "cancel") {
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
        print("Step 4: Enter content (shown on success)", "system");
        return;
    }

    if (createStep === 4) {
        createData.content = input;
        finishCreate();
        return;
    }
}

function submitCommand() {
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
    output.scrollTop = output.scrollHeight;

    runCommand(command);
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

        console.log("FUNCTION RESULT:", data);

        if (!data.success) {
            print(data.message, "error");
            return;
        }

        print("ACCESS GRANTED", "system");
        print(data.content ?? "No content", "message");

        activeChallenge = null;

    } catch (err) {
        console.error(err);
        print("ERROR: " + err.message, "error");
    }
}

async function enterChatMode() {
    chatMode = true;
    output.innerHTML = "";

    print("=== CHAT MODE (LIVE) ===", "matrix");
    print("Type: send <message>", "matrix");
    print("Type: back to exit", "matrix");
    print("", "system");

    const chatRef = ref(db, "chatMessages");

    chatListener = onChildAdded(chatRef, (snap) => {
        const msg = snap.val();
        print(`${msg.user}: ${msg.message}`, "message");
    });
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

    try {
        const permission = await Notification.requestPermission();

        if (permission !== "granted") {
            console.log("Notifications blocked");
            return;
        }

        const token = await getToken(messaging, {
            vapidKey: "BKrIMgSG5r0TDe6LV4GJAgd8O0Dw4ZK8e8d44yBhfYdRTgP73ws_HvoM3sSvgGy9nNQdRjqzj5k-Kp0uTjemNjg"
        });

        if (!token) {
            console.log("No token generated");
            return;
        }

        await set(ref(db, "fcmTokens/" + currentUser.uid), token);
    } catch (err) {
        console.error("FCM error:", err);
    }
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
            createdAt: Date.now()
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

    if (chatListener) {
        chatListener();
        chatListener = null;
    }

    output.innerHTML = "";

    print("Exited chat mode", "system");
    print("Type 'help' for commands", "matrix");
}

function notify(message) {
    const div = document.createElement("div");
    div.className = "system-line";
    div.textContent = `🔔 ${message}`;

    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
}

function pushNotification(title, body) {
    if (Notification.permission !== "granted") return;

    new Notification(title, {
        body,
        icon: "icons/icon-192.png"
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

typeBoot();

if ("serviceWorker" in navigator) {

    window.addEventListener("load", () => {

        navigator.serviceWorker
            .register("./service-worker.js")
            .then(() => {
                console.log("Service worker registered");
            })
            .catch(err => {
                console.log("SW failed:", err);
            });

    });
}

navigator.serviceWorker.register("/firebase-messaging-sw.js");