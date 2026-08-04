let socketIo = null;

export const setSocketIo = (io) => {
  socketIo = io;
};

export const emitNotificationUpdate = ({ company_id, user_id }) => {
  if (!socketIo) {
    console.warn(
      "emitNotificationUpdate skipped: Socket.IO is not initialized",
    );
    return;
  }

  if (company_id) {
    socketIo.to(`company_${company_id}`).emit("notification_updated");
  }

  if (user_id) {
    socketIo.to(`user_${user_id}`).emit("notification_updated");
  }
};

export const emitCustomerNotification = ({ user_id, notification }) => {
  if (!socketIo) {
    console.warn(
      "emitCustomerNotification skipped: Socket.IO is not initialized",
    );
    return;
  }

  if (!user_id) return;

  socketIo.to(`user_${user_id}`).emit("customer_notification", notification);
};

export const emitDashboardUpdate = ({ company_id }) => {
  if (!socketIo) {
    console.warn("emitDashboardUpdate skipped: Socket.IO is not initialized");
    return;
  }

  if (!company_id) return;

  socketIo.to(`company_${company_id}`).emit("dashboard_updated");
};
