import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import toast from "react-hot-toast";
import socket, { connectSocket } from "../services/socket";

import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Building2,
  Users,
  Settings,
  ChevronDown,
  CreditCard,
  Filter,
  Loader2,
} from "lucide-react";

function Notifications() {
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  }, []);

  const [notifications, setNotifications] = useState([]);
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);

      const res = await api.get("/notifications", {
        params: { page: currentPage, limit, type, status },
      });

      setNotifications(res.data?.notifications || []);
      setTotal(res.data?.total || 0);
      setTotalPages(res.data?.totalPages || 1);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to fetch notifications",
      );
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit, status, type]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const handleNotificationsUpdated = () => fetchNotifications();

    window.addEventListener("notificationsUpdated", handleNotificationsUpdated);

    return () => {
      window.removeEventListener(
        "notificationsUpdated",
        handleNotificationsUpdated,
      );
    };
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user?.id) return;

    connectSocket(user);

    const refreshNotifications = () => fetchNotifications();

    socket.on("notification_updated", refreshNotifications);

    return () => {
      socket.off("notification_updated", refreshNotifications);
    };
  }, [user?.id, user?.role, user?.company_id, fetchNotifications]);

  const stats = useMemo(() => {
    return {
      total,
      unread: notifications.filter((n) => Number(n.is_read) === 0).length,
      security: notifications.filter((n) => n.type === "security").length,
      subscription: notifications.filter((n) => n.type === "subscription")
        .length,
    };
  }, [notifications, total]);

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);

      toast.success("Notification marked as read");
      window.dispatchEvent(new Event("notificationsUpdated"));
      fetchNotifications();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to update notification",
      );
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch("/notifications/read-all");

      toast.success("All notifications marked as read");
      window.dispatchEvent(new Event("notificationsUpdated"));
      fetchNotifications();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to update notifications",
      );
    }
  };

  return (
    <div className="w-full min-w-0 space-y-5 overflow-x-hidden text-slate-900 dark:text-slate-100">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
              <Bell size={17} />
              Notification Center
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Notifications
            </h1>

            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              Track security alerts, company activity, subscription requests and
              system notifications.
            </p>
          </div>

          <button
            type="button"
            onClick={markAllRead}
            disabled={stats.unread === 0}
            className="flex w-fit items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-indigo-700 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
          >
            <CheckCircle2 size={17} />
            Mark All Read
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Total Alerts"
          value={stats.total}
          icon={<Bell size={20} />}
          color="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
        />

        <StatsCard
          title="Unread"
          value={stats.unread}
          icon={<AlertTriangle size={20} />}
          color="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
        />

        <StatsCard
          title="Security Alerts"
          value={stats.security}
          icon={<ShieldCheck size={20} />}
          color="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        />

        <StatsCard
          title="Subscription"
          value={stats.subscription}
          icon={<CreditCard size={20} />}
          color="bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-5 dark:border-slate-800">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Alert List
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                Filter alerts by type and read status.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SmartDropdown
                value={type}
                onChange={(value) => {
                  setType(value);
                  setCurrentPage(1);
                }}
                icon={<Filter size={16} />}
                placeholder="Alert Type"
                options={[
                  { value: "all", label: "All Types" },
                  { value: "security", label: "Security" },
                  { value: "user", label: "User" },
                  { value: "company", label: "Company" },
                  { value: "subscription", label: "Subscription" },
                  { value: "system", label: "System" },
                ]}
              />

              <SmartDropdown
                value={status}
                onChange={(value) => {
                  setStatus(value);
                  setCurrentPage(1);
                }}
                icon={<CheckCircle2 size={16} />}
                placeholder="Read Status"
                options={[
                  { value: "all", label: "All Status" },
                  { value: "unread", label: "Unread" },
                  { value: "read", label: "Read" },
                ]}
              />
            </div>
          </div>
        </div>

        <NotificationsTable
          notifications={notifications}
          loading={loading}
          onMarkRead={markRead}
        />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          total={total}
          limit={limit}
          setLimit={setLimit}
          setCurrentPage={setCurrentPage}
        />
      </div>
    </div>
  );
}

function NotificationsTable({ notifications, loading, onMarkRead }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
          <tr>
            <th className="w-[30%] p-4 text-center text-xs font-bold uppercase tracking-wide">
              Alert
            </th>
            <th className="p-4 text-center text-xs font-bold uppercase tracking-wide">
              Type
            </th>
            <th className="p-4 text-center text-xs font-bold uppercase tracking-wide">
              Company
            </th>
            <th className="p-4 text-center text-xs font-bold uppercase tracking-wide">
              User
            </th>
            <th className="p-4 text-center text-xs font-bold uppercase tracking-wide">
              Status
            </th>
            <th className="p-4 text-center text-xs font-bold uppercase tracking-wide">
              Date
            </th>
            <th className="p-4 text-center text-xs font-bold uppercase tracking-wide">
              Action
            </th>
          </tr>
        </thead>

        <tbody>
          {loading && (
            <tr>
              <td colSpan="7" className="p-10 text-center">
                <div className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <Loader2
                    size={18}
                    className="animate-spin text-indigo-600 dark:text-indigo-400"
                  />
                  Loading notifications...
                </div>
              </td>
            </tr>
          )}

          {!loading &&
            notifications.map((item) => {
              const isUnread = Number(item.is_read) === 0;

              return (
                <tr
                  key={item.id}
                  className={`border-t border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 ${
                    isUnread
                      ? "bg-indigo-50/40 dark:bg-indigo-950/20"
                      : "bg-white dark:bg-slate-900"
                  }`}
                >
                  <td className="p-4 align-top">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={`mt-0.5 shrink-0 rounded-xl p-3 ${getTypeColor(
                          item.type,
                        )}`}
                      >
                        {getTypeIcon(item.type)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-bold text-slate-900 dark:text-white">
                          {item.title || "-"}
                        </h3>
                        <p className="mt-1 whitespace-normal break-words text-sm leading-5 text-slate-600 dark:text-slate-400">
                          {item.message || "-"}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="p-4 align-top">
                    <TypeBadge type={item.type} />
                  </td>

                  <td className="break-words p-4 align-top font-medium text-slate-600 dark:text-slate-300">
                    {item.company_name || "-"}
                  </td>

                  <td className="p-4 align-top">
                    <p className="truncate font-semibold text-slate-700 dark:text-slate-200">
                      {item.user_name || "-"}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                      {item.user_email || ""}
                    </p>
                  </td>

                  <td className="p-4 align-top">
                    <ReadBadge isRead={item.is_read} />
                  </td>

                  <td className="p-4 align-top font-medium text-slate-600 dark:text-slate-300">
                    {formatDate(item.created_at)}
                  </td>

                  <td className="p-4 align-top">
                    {isUnread ? (
                      <button
                        type="button"
                        onClick={() => onMarkRead(item.id)}
                        className="whitespace-nowrap rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950"
                      >
                        Mark Read
                      </button>
                    ) : (
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                        Completed
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}

          {!loading && notifications.length === 0 && (
            <tr>
              <td colSpan="7" className="p-10 text-center">
                <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-950">
                  <Bell
                    className="mx-auto text-slate-400 dark:text-slate-500"
                    size={34}
                  />
                  <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                    No notifications found
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                    Alerts will appear here when system events are generated.
                  </p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SmartDropdown({ value, onChange, options, icon, placeholder }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selected = options.find(
    (option) => String(option.value) === String(value),
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={dropdownRef} className="relative w-full sm:w-52">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-left text-sm font-semibold text-slate-700 shadow-sm outline-none transition hover:border-indigo-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-500 dark:focus:ring-indigo-950/50"
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon && (
            <span className="shrink-0 text-slate-400 dark:text-slate-500">
              {icon}
            </span>
          )}
          <span className="truncate">
            {selected?.label || placeholder || "Select"}
          </span>
        </span>

        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-500 transition dark:text-slate-400 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-[9999] max-h-72 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          {options.map((option) => {
            const active = String(value) === String(option.value);

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                  active
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                    : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-indigo-300"
                }`}
              >
                <span className="truncate">{option.label}</span>
                {active && <CheckCircle2 size={16} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatsCard({ title, value, icon, color }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <h2 className="mt-1 truncate text-2xl font-bold text-slate-900 dark:text-white">
            {value}
          </h2>
        </div>

        <div className={`shrink-0 rounded-xl p-3 ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

function TypeBadge({ type }) {
  const value = String(type || "alert").toLowerCase();

  const styles = {
    security:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
    user: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-300",
    company:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300",
    subscription:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300",
    system:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
    alert:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize shadow-sm ${
        styles[value] || styles.alert
      }`}
    >
      {value}
    </span>
  );
}

function ReadBadge({ isRead }) {
  const read = Number(isRead) === 1;

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold shadow-sm ${
        read
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
      }`}
    >
      {read ? "Read" : "Unread"}
    </span>
  );
}

function getTypeIcon(type) {
  if (type === "security") return <ShieldCheck size={18} />;
  if (type === "user") return <Users size={18} />;
  if (type === "company") return <Building2 size={18} />;
  if (type === "subscription") return <CreditCard size={18} />;
  if (type === "system") return <Settings size={18} />;

  return <Bell size={18} />;
}

function getTypeColor(type) {
  if (type === "security") {
    return "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300";
  }
  if (type === "user") {
    return "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300";
  }
  if (type === "company") {
    return "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";
  }
  if (type === "subscription") {
    return "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300";
  }
  if (type === "system") {
    return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  }

  return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
}

function formatDate(date) {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Pagination({
  currentPage,
  totalPages,
  total,
  limit,
  setLimit,
  setCurrentPage,
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
        Total Notifications: {total}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={limit}
          onChange={(e) => {
            setLimit(Number(e.target.value));
            setCurrentPage(1);
          }}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-indigo-950/50"
        >
          <option value={5}>5 / page</option>
          <option value={10}>10 / page</option>
          <option value={20}>20 / page</option>
          <option value={50}>50 / page</option>
        </select>

        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Prev
        </button>

        <span className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          Page {currentPage} of {totalPages || 1}
        </span>

        <button
          type="button"
          disabled={currentPage === totalPages || totalPages === 0}
          onClick={() =>
            setCurrentPage((prev) => Math.min(prev + 1, totalPages))
          }
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default Notifications;
