import { io } from "socket.io-client";

const getSocketUrl = () => {
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

  try {
    const url = new URL(apiBaseUrl, window.location.origin);
    return url.origin;
  } catch {
    return window.location.origin;
  }
};

const socket = io(getSocketUrl(), {
  path: "/socket.io",
  transports: ["websocket"],
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

let joinedUserKey = null;

const joinRooms = (user) => {
  if (!user?.id) return;

  socket.emit("join_rooms", {
    id: user.id,
    company_id: user.company_id,
    role: user.role,
  });
};

export const connectSocket = (user) => {
  if (!user?.id) return;

  const userKey = `${user.id}_${user.company_id}_${user.role}`;

  if (socket.connected) {
    if (joinedUserKey !== userKey) {
      joinRooms(user);
      joinedUserKey = userKey;
    }

    return;
  }

  socket.connect();

  socket.once("connect", () => {
    joinRooms(user);
    joinedUserKey = userKey;
  });
};

export const disconnectSocket = () => {
  joinedUserKey = null;

  if (socket.connected) {
    socket.disconnect();
  }
};

socket.on("connect_error", (error) => {
  console.error("Socket.IO connection error:", error.message);
});

export default socket;