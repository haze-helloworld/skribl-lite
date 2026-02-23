const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const rooms = {};

const words = ["cat", "car", "tree", "house", "sun", "phone", "dog", "book"];

function pickWord() {
  return words[Math.floor(Math.random() * words.length)];
}

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // JOIN
  socket.on("joinRoom", ({ username, roomId }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        drawerIndex: 0,
        word: pickWord(),
        roundsCompleted: 0
      };
    }

    const room = rooms[roomId];

    const player = {
      id: socket.id,
      username,
      score: 0
    };

    room.players.push(player);

    io.to(roomId).emit("players", room.players);

    if (room.players.length === 1) {
      const drawer = room.players[0];
      io.to(drawer.id).emit("yourTurn", room.word);
      io.to(roomId).emit("chat", `✏️ ${drawer.username} is drawing!`);
    }
  });

  // DRAW START
  socket.on("drawStart", ({ roomId, x, y }) => {
    const room = rooms[roomId];
    if (!room) return;

    const drawer = room.players[room.drawerIndex];
    if (!drawer || socket.id !== drawer.id) return;

    socket.to(roomId).emit("drawStart", { x, y });
  });

  // DRAW END 
  socket.on("drawEnd", ({ roomId }) => {
  const room = rooms[roomId];
  if (!room) return;

  const drawer = room.players[room.drawerIndex];
  if (!drawer || socket.id !== drawer.id) return;

  socket.to(roomId).emit("drawEnd");
});

  // DRAW MOVE
  socket.on("draw", ({ roomId, x, y }) => {
    const room = rooms[roomId];
    if (!room) return;

    const drawer = room.players[room.drawerIndex];
    if (!drawer || socket.id !== drawer.id) return;

    socket.to(roomId).emit("draw", { x, y });
  });

  // CLEAR
  socket.on("clear", (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    const drawer = room.players[room.drawerIndex];
    if (!drawer || socket.id !== drawer.id) return;

    io.to(roomId).emit("clear");
  });

  // CHAT + GUESS
  socket.on("chat", ({ roomId, msg }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    const drawer = room.players[room.drawerIndex];

    if (!player || !drawer) return;
    if (socket.id === drawer.id) return;

    if (msg.toLowerCase() === room.word) {
      player.score += 10;

      io.to(roomId).emit("chat", `🎉 ${player.username} guessed it!`);
      io.to(roomId).emit("players", room.players);

      // NEXT TURN
   
room.drawerIndex++;

if (room.drawerIndex >= room.players.length) {
  room.drawerIndex = 0;
  room.roundsCompleted++;
}

// 🏁 GAME END CONDITION
if (room.roundsCompleted >= 1) {
  const winner = room.players.reduce((a, b) =>
    a.score > b.score ? a : b
  );

  io.to(roomId).emit("chat", `🏆 Game Over! Winner: ${winner.username}`);

  // reset game
  room.players.forEach(p => p.score = 0);
  room.roundsCompleted = 0;
  room.word = pickWord();

  // restart from first player
  const firstDrawer = room.players[0];
  io.to(roomId).emit("notYourTurn");
  io.to(roomId).emit("clear");

  io.to(firstDrawer.id).emit("yourTurn", room.word);
  io.to(roomId).emit("chat", `🔁 New game started! ${firstDrawer.username} is drawing`);

  return; // 🔥 IMPORTANT → stop further execution
}

room.word = pickWord();

const nextDrawer = room.players[room.drawerIndex];

io.to(roomId).emit("notYourTurn");
io.to(roomId).emit("clear");

io.to(nextDrawer.id).emit("yourTurn", room.word);
io.to(roomId).emit("chat", `✏️ ${nextDrawer.username} is now drawing!`);

    } else {
      io.to(roomId).emit("chat", `${player.username}: ${msg}`);
    }
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    for (let roomId in rooms) {
      const room = rooms[roomId];

      room.players = room.players.filter(p => p.id !== socket.id);

      if (room.players.length === 0) {
        delete rooms[roomId];
        continue;
      }

      room.drawerIndex = room.drawerIndex % room.players.length;

      io.to(roomId).emit("players", room.players);
    }
  });
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});