import { Socket } from "socket.io";
import http from "http";
import dotenv from "dotenv"
import express from 'express';
import { Server } from 'socket.io';
import { UserManager } from "./managers/UserManger";
dotenv.config();
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*"
  }
});

const userManager = new UserManager();

io.on('connection', (socket: Socket) => {
  console.log('a user connected');
  userManager.addUser("randomName", socket);
  socket.on("disconnect", () => {
    console.log("user disconnected");
    userManager.removeUser(socket.id);
  })
  
});
const PORT = process.env.PORT || 3000;
server.listen(3000, () => {
    console.log(`listening on *:${PORT}`);
});