const socket = io();

let roomId = "";
let username = "";
let isDrawer = false;

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

canvas.width = 500;
canvas.height = 400;

let drawing = false;

// JOIN
document.getElementById("joinBtn").onclick = () => {
  username = document.getElementById("username").value;
  roomId = document.getElementById("room").value;

  if (!username || !roomId) {
    alert("Enter username and room ID");
    return;
  }

  socket.emit("joinRoom", { username, roomId });
  document.getElementById("join").style.display = "none";
};

// DRAW START
canvas.addEventListener("mousedown", (e) => {
  if (!isDrawer) return;

  drawing = true;
  const x = e.offsetX;
  const y = e.offsetY;

  ctx.beginPath();
  ctx.moveTo(x, y);

  socket.emit("drawStart", { roomId, x, y });
});

// DRAW END
canvas.addEventListener("mouseup", () => {
  if (!isDrawer) return;

  drawing = false;
  socket.emit("drawEnd", { roomId });
});


// DRAW MOVE
canvas.addEventListener("mousemove", (e) => {
  if (!drawing || !isDrawer) return;

  const x = e.offsetX;
  const y = e.offsetY;

  ctx.lineTo(x, y);
  ctx.stroke();

  socket.emit("draw", { roomId, x, y });
});

// RECEIVE DRAW START
socket.on("drawStart", ({ x, y }) => {
  ctx.beginPath();
  ctx.moveTo(x, y);
});

// RECEIVE DRAW
socket.on("draw", ({ x, y }) => {
  ctx.lineTo(x, y);
  ctx.stroke();
});

//RECIEVE DRAW END
socket.on("drawEnd", () => {
  ctx.beginPath();
});

// CLEAR
document.getElementById("clearBtn").onclick = () => {
  socket.emit("clear", roomId);
};

socket.on("clear", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// CHAT
document.getElementById("sendBtn").onclick = () => {
  const msg = document.getElementById("msgInput").value;
  if (!msg) return;

  socket.emit("chat", { roomId, msg });
  document.getElementById("msgInput").value = "";
};

socket.on("chat", (msg) => {
  const div = document.createElement("div");

  if (msg.includes("🎉") || msg.includes("✏️")) {
    div.style.fontWeight = "bold";
  }

  div.textContent = msg;
  document.getElementById("messages").appendChild(div);
});

// LEADERBOARD
socket.on("players", (players) => {
  let text = "<h3>Leaderboard</h3>";
  players.forEach(p => {
    text += `${p.username}: ${p.score}<br>`;
  });
  document.getElementById("leaderboard").innerHTML = text;
});

// YOUR TURN
socket.on("yourTurn", (word) => {
  isDrawer = true;
  document.getElementById("word").textContent = "Draw: " + word;
  document.getElementById("status").textContent = "You are drawing!";
});

// NOT YOUR TURN
socket.on("notYourTurn", () => {
  isDrawer = false;
  document.getElementById("word").textContent = "";
  document.getElementById("status").textContent = "Guess the word!";
});

document.getElementById("msgInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    document.getElementById("sendBtn").click();
  }
});