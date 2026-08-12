import http from "http";
import { Server } from "socket.io";

import app from "./src/app.js";
import { setSocketIo } from "./src/utils/socketEvents.js";

const PORT = Number(process.env.PORT) || 5000;

const server = http.createServer(app);

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : true;

const io = new Server(server, {
  path: "/socket.io",
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

setSocketIo(io);

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join_rooms", ({ id, company_id, role } = {}) => {
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

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});