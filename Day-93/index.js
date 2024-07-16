const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

app.use(express.static(path.resolve("./public")));
const io = new Server(server);

//Socket io

io.on("connection", (socket) => {
  console.log("user connected", socket.id);
  socket.on("user-send-message", (message) => {
    console.log("New Message is :", message);
    io.emit("message", message);
  });
});

app.get("/", (req, res) => {
  return res.sendfile("/public/index.html");
});

server.listen(8100, () => console.log("Server Start"));
