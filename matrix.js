const canvas = document.getElementById("matrix");
const ctx = canvas.getContext("2d");

const letters = "01ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%^&*";
const fontSize = 14;

let columns;
let drops = [];

// 🎯 initial setup
function init() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    columns = Math.floor(canvas.width / fontSize);

    // only initialize ONCE
    if (drops.length === 0) {
        drops = Array(columns).fill(1);
    } else {
        // resize without resetting animation state
        const newDrops = Array(columns).fill(1);

        for (let i = 0; i < Math.min(columns, drops.length); i++) {
            newDrops[i] = drops[i];
        }

        drops = newDrops;
    }
}

init();

function draw() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#00ff9d";
    ctx.font = fontSize + "px monospace";

    for (let i = 0; i < drops.length; i++) {
        const text = letters[Math.floor(Math.random() * letters.length)];

        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
            drops[i] = 0;
        }

        drops[i]++;
    }
}

setInterval(draw, 33);

// 🧠 resize without reset
window.addEventListener("resize", () => {
    init();
});