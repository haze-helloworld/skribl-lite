const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// serves frontend files from public folder

const rooms = {};
const words = ["cat", "car", "tree", "house", "sun", "phone", "dog", "book"];

function pickWord() {
  // select and return random word from words array
}

function startTurn(roomId) {
  const room = rooms[roomId];
  if (!room || room.players.length === 0) return;

  room.drawerIndex = room.drawerIndex % room.players.length;
  room.word = pickWord();

  const drawer = room.players[room.drawerIndex];

  io.to(roomId).emit("notYourTurn");
  io.to(roomId).emit("clear");

  // send secret word only to drawer
  io.to(roomId).emit("chat", `✏️ ${drawer.username} is drawing!`);
  io.to(roomId).emit("players", room.players);
}

// runs when user connects
io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("joinRoom", ({ username, roomId }, ack) => {

    // add user into socket room
    socket.data.roomId = roomId;

    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        drawerIndex: 0,
        word: pickWord(),
        roundsCompleted: 0,
      };
    }

    const room = rooms[roomId];

    if (!room.players.some((p) => p.id === socket.id)) {
      // add player object into room.players array
    }

    io.to(roomId).emit("players", room.players);

    ack?.({ ok: true });

    if (room.players.length === 1) {
      room.drawerIndex = 0;
      room.roundsCompleted = 0;
      startTurn(roomId);
    }
  });

  function isDrawer(roomId) {
    const room = rooms[roomId];
    if (!room) return false;
    const drawer = room.players[room.drawerIndex];
    // return true if current socket is drawer
  }

  socket.on("drawStart", ({ roomId, x, y }) => {
    if (!rooms[roomId] || !isDrawer(roomId)) return;
    // send drawStart event to other players
  });

  socket.on("draw", ({ roomId, x, y }) => {
    if (!rooms[roomId] || !isDrawer(roomId)) return;
    socket.to(roomId).emit("draw", { x, y });
  });

  socket.on("drawEnd", ({ roomId }) => {
    if (!rooms[roomId] || !isDrawer(roomId)) return;
    socket.to(roomId).emit("drawEnd");
  });

  socket.on("clear", (roomId) => {
    if (!rooms[roomId] || !isDrawer(roomId)) return;
    io.to(roomId).emit("clear");
  });

  socket.on("chat", ({ roomId, msg }) => {

    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    const drawer = room.players[room.drawerIndex];

    if (socket.id === drawer.id) return;

    const guess = String(msg ?? "").trim().toLowerCase();
    const answer = String(room.word ?? "").trim().toLowerCase();

    if (guess === answer) {

      // increase player score by 10

      io.to(roomId).emit("chat", `🎉 ${player.username} guessed it!`);
      io.to(roomId).emit("players", room.players);

      room.drawerIndex++;

      if (room.drawerIndex >= room.players.length) {
        room.drawerIndex = 0;
        room.roundsCompleted++;
      }

      if (room.roundsCompleted >= 1) {

        const winner = room.players.reduce((a, b) =>
          a.score > b.score ? a : b,
        );

        io.to(roomId).emit("chat", `🏆 Game Over! Winner: ${winner.username}`);

        room.players.forEach((p) => (p.score = 0));
        room.roundsCompleted = 0;
        room.drawerIndex = 0;

        io.to(roomId).emit("notYourTurn");
        io.to(roomId).emit("clear");

        const firstDrawer = room.players[0];
        const newWord = pickWord();
        room.word = newWord;

        io.to(firstDrawer.id).emit("yourTurn", newWord);
        io.to(roomId).emit(
          "chat",
          `🔁 New game started! ${firstDrawer.username} is drawing`,
        );

        return;
      }

      startTurn(roomId);
    } else {
      io.to(roomId).emit("chat", `${player.username}: ${msg}`);
    }
  });

  // runs when user disconnects
  socket.on("disconnect", () => {

    const roomId = socket.data.roomId;

    const checkRooms = roomId ? [roomId] : Object.keys(rooms);

    for (const rid of checkRooms) {

      const room = rooms[rid];
      if (!room) continue;

      const idx = room.players.findIndex((p) => p.id === socket.id);
      if (idx === -1) continue;

      const wasDrawer = idx === room.drawerIndex;

      // remove player from room.players

      if (room.players.length === 0) {
        delete rooms[rid];
        continue;
      }

      if (room.drawerIndex >= room.players.length) room.drawerIndex = 0;

      io.to(rid).emit("players", room.players);

      if (wasDrawer) startTurn(rid);
    }
  });
});

// start server on port 3000
server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});