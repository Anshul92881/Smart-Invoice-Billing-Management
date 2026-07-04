import dotenv from "dotenv";
dotenv.config();

import http from "http";
import { Server } from "socket.io";

import "./src/cron/notificationCorn.js";
import app from "./src/app.js";
import { startInactiveAdminCron } from "./src/cron/inactiveAdminChecker.js";

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(",") 
  : ["http://localhost:5173", "http://localhost:3000"];

export const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

io.on("connection", (socket) => {
  // console.log("Socket connected:", socket.id);

  socket.on("join_rooms", (user) => {
  // console.log("JOIN ROOMS EVENT:", user);

  if (user?.company_id) {
    socket.join(`company_${user.company_id}`);
    // console.log(`Joined company_${user.company_id}`);
  }

  if (user?.id) {
    socket.join(`user_${user.id}`);
    // console.log(`Joined user_${user.id}`);
  }

  if (user?.company_id && user?.role) {
    socket.join(`role_${user.company_id}_${user.role}`);
    // console.log(`Joined role_${user.company_id}_${user.role}`);
  }
});

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server Running On Port ${PORT}`);
  startInactiveAdminCron();
});