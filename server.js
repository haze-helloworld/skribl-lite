const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static("public"));

const rooms = {};
const words = ["cat", "car", "tree", "house", "sun", "phone", "dog", "book"];

function pickWord() {
  return words[Math.floor(Math.random() * words.length)];
}

function startTurn(roomId) {
  const room = rooms[roomId];
  if (!room || room.players.length === 0) return;

  room.drawerIndex = room.drawerIndex % room.players.length;
  room.word = pickWord();

  const drawer = room.players[room.drawerIndex];

  io.to(roomId).emit("notYourTurn");
  io.to(roomId).emit("clear");

  io.to(drawer.id).emit("yourTurn", room.word);
  io.to(roomId).emit("chat", `✏️ ${drawer.username} is drawing!`);
  io.to(roomId).emit("players", room.players);
}

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // JOIN (fixed: accepts correct shape + prevents duplicate join)
  socket.on("joinRoom", ({ username, roomId }, ack) => {
    username = String(username || "").trim();
    roomId = String(roomId || "").trim();

    if (!username || !roomId) {
      ack?.({ ok: false, error: "username/roomId missing" });
      return;
    }

    socket.join(roomId);
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

    // ✅ prevent duplicate player add (refresh/double click)
    if (!room.players.some((p) => p.id === socket.id)) {
      room.players.push({ id: socket.id, username, score: 0 });
    }

    io.to(roomId).emit("players", room.players);

    ack?.({ ok: true });

    if (room.players.length === 1) {
      // start game for first player
      room.drawerIndex = 0;
      room.roundsCompleted = 0;
      startTurn(roomId);
    }
  });

  function isDrawer(roomId) {
    const room = rooms[roomId];
    if (!room) return false;
    const drawer = room.players[room.drawerIndex];
    return drawer && drawer.id === socket.id;
  }

  socket.on("drawStart", ({ roomId, x, y }) => {
    if (!rooms[roomId] || !isDrawer(roomId)) return;
    socket.to(roomId).emit("drawStart", { x, y });
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
    if (!player || !drawer) return;

    // drawer can't guess
    if (socket.id === drawer.id) return;

    const guess = String(msg ?? "")
      .trim()
      .toLowerCase();
    const answer = String(room.word ?? "")
      .trim()
      .toLowerCase();

    if (!guess) return;

    if (guess === answer) {
      player.score += 10;

      io.to(roomId).emit("chat", `🎉 ${player.username} guessed it!`);
      io.to(roomId).emit("players", room.players);

      // NEXT TURN (same as your repo logic)
      room.drawerIndex++;
      if (room.drawerIndex >= room.players.length) {
        room.drawerIndex = 0;
        room.roundsCompleted++;
      }

      // 🏁 GAME END CONDITION (same as your code: 1 round)
      if (room.roundsCompleted >= 1) {
        const winner = room.players.reduce((a, b) =>
          a.score > b.score ? a : b,
        );
        io.to(roomId).emit("chat", `🏆 Game Over! Winner: ${winner.username}`);

        // reset game
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

      // continue to next drawer
      startTurn(roomId);
    } else {
      io.to(roomId).emit("chat", `${player.username}: ${msg}`);
    }
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;

    // fallback scan if not set
    const checkRooms = roomId ? [roomId] : Object.keys(rooms);

    for (const rid of checkRooms) {
      const room = rooms[rid];
      if (!room) continue;

      const idx = room.players.findIndex((p) => p.id === socket.id);
      if (idx === -1) continue;

      const wasDrawer = idx === room.drawerIndex;
      room.players.splice(idx, 1);

      if (room.players.length === 0) {
        delete rooms[rid];
        continue;
      }

      if (room.drawerIndex >= room.players.length) room.drawerIndex = 0;

      io.to(rid).emit("players", room.players);

      // if drawer left, continue game
      if (wasDrawer) startTurn(rid);
    }
  });
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
