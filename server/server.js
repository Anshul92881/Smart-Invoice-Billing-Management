import express from "express";
import http from "http";
import { Server } from "socket.io";
import { setSocketIo } from "./src/utils/socketEvents.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  path: "/socket.io",
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
      : true,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

setSocketIo(io);

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join_rooms", ({ id, company_id, role }) => {
    if (id) {
      socket.join(`user_${id}`);
    }

    if (company_id) {
      socket.join(`company_${company_id}`);
    }

    if (role) {
      socket.join(`role_${role}`);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("Socket disconnected:", socket.id, reason);
  });
});

server.listen(process.env.PORT || 5000, "0.0.0.0", () => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
});