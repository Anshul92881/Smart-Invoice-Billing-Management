import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  UserCircle,
  LogOut,
  Menu,
  X,
  Bell,
  Crown,
  ShieldCheck,
  ChevronDown,
  Moon,
  Sun,
  AlertTriangle,
  FileText,
  Mail,
  Activity,
} from "lucide-react";
const BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, "")
  : "http://localhost:5000";
const MENU_ITEMS = [
  {
    name: "Dashboard",
    path: "/superadmin/dashboard",
    icon: <LayoutDashboard size={19} />,
  },
  {
    name: "Greetings",
    path: "/superadmin/greetings",
    icon: <Mail size={19} />,
  },
  {
    name: "Companies",
    path: "/superadmin/companies",
    icon: <Building2 size={19} />,
  },
  {
    name: "Company Admins",
    path: "/superadmin/admins",
    icon: <Users size={19} />,
  },
  {
    name: "Company KYC",
    path: "/superadmin/company-kyc",
    icon: <ShieldCheck size={19} />,
  },
  {
    name: "Inactive Companies",
    path: "/superadmin/inactive-companies",
    icon: <AlertTriangle size={19} />,
  },
  {
    name: "Subscriptions",
    path: "/superadmin/subscriptions",
    icon: <CreditCard size={19} />,
  },
  {
    name: "Audit Logs",
    path: "/superadmin/audit-logs",
    icon: <Activity size={19} />,
  },
  {
    name: "Notifications",
    path: "/superadmin/notifications",
    icon: <Bell size={19} />,
  },
  {
    name: "Profile",
    path: "/superadmin/profile",
    icon: <UserCircle size={19} />,
  },
];
const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
};
function SuperAdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const profileMenuRef = useRef(null);
  const notificationRef = useRef(null);
  const [user, setUser] = useState(readStoredUser);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("theme") === "dark",
  );
  // NO USER -> LOGIN
  useEffect(() => {
    if (!user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);
  // THEME
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);
  const toggleTheme = () => {
    setDarkMode((prev) => !prev);
  };
  // USER REFRESH
  // Profile page: localStorage update karke window.dispatchEvent(new Event("userUpdated"))
  useEffect(() => {
    const refreshUser = () => setUser(readStoredUser());
    window.addEventListener("userUpdated", refreshUser);
    window.addEventListener("storage", refreshUser);
    return () => {
      window.removeEventListener("userUpdated", refreshUser);
      window.removeEventListener("storage", refreshUser);
    };
  }, []);
  // CLICK OUTSIDE (profile + notifications)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setProfileMenuOpen(false);
      }
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setNotificationOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  const fetchUnreadNotifications = async () => {
    try {
      const [countRes, allRes] = await Promise.all([
        api.get("/notifications", {
          params: { page: 1, limit: 1, type: "all", status: "unread" },
        }),
        api.get("/notifications", {
          params: { page: 1, limit: 20, type: "all", status: "all" },
        }),
      ]);
      const list = allRes.data.notifications || [];
      const sorted = [...list].sort((a, b) => {
        const readA = Number(a.is_read || 0);
        const readB = Number(b.is_read || 0);
        if (readA !== readB) return readA - readB;
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });
      setUnreadCount(countRes.data.total || 0);
      setNotifications(sorted);
    } catch (error) {
      console.log(error.response?.data || error);
    }
  };
  // NOTIFICATIONS (initial + event + 30s polling)
  useEffect(() => {
    fetchUnreadNotifications();
    const handleNotificationsUpdated = () => {
      fetchUnreadNotifications();
    };
    window.addEventListener("notificationsUpdated", handleNotificationsUpdated);
    const interval = setInterval(fetchUnreadNotifications, 30000);
    return () => {
      window.removeEventListener(
        "notificationsUpdated",
        handleNotificationsUpdated,
      );
      clearInterval(interval);
    };
  }, []);
  const handleMarkAllRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      await fetchUnreadNotifications();
      window.dispatchEvent(new Event("notificationsUpdated"));
    } catch (error) {
      console.log(error);
    }
  };
  const handleNotificationClick = async (item) => {
    if (Number(item.is_read) !== 0) return;
    try {
      await api.patch(`/notifications/${item.id}/read`);
      await fetchUnreadNotifications();
      window.dispatchEvent(new Event("notificationsUpdated"));
    } catch (error) {
      console.log(error);
    }
  };
  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.log(error);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("pending_company_id");
      navigate("/", { replace: true });
    }
  };
  const closeSidebar = () => setSidebarOpen(false);
  const initials =
    user?.name
      ?.split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "SA";
  const profileImageUrl = (() => {
    if (!user?.profile_image) return "";
    const image = String(user.profile_image);
    if (image.startsWith("http")) return image;
    if (image.startsWith("/uploads") || image.startsWith("/upload")) {
      return `${BASE_URL}${image}`;
    }
    return `${BASE_URL}/uploads/profiles/${image}`;
  })();
  // AVATAR (JSX variable, component nahi: har render pe remount nahi hota)
  const avatar = profileImageUrl ? (
    <img
      src={profileImageUrl}
      alt={user?.name || "SuperAdmin"}
      className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 object-cover shadow-sm dark:border-slate-700"
    />
  ) : (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-sm">
      {initials}
    </div>
  );
  // SIDEBAR (JSX variable, component nahi: remount nahi hota, scroll自动 bana rehta hai)
  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-20 shrink-0 items-center border-b border-slate-800/80 px-4 dark:border-slate-800">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 shadow-sm">
              <FileText size={21} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold leading-tight tracking-tight text-white">
                Smart Invoice
              </h1>
              <p className="mt-0.5 truncate text-sm font-normal leading-5 text-slate-400">
                Multi-Branch Billing
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeSidebar}
            aria-label="Close sidebar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-300 transition hover:bg-slate-700 hover:text-white lg:hidden"
          >
            <X size={18} />
          </button>
        </div>
      </div>
      <nav
        aria-label="SuperAdmin navigation"
        className="sidebar-scroll min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4"
      >

        {MENU_ITEMS.map((item) => {
          const isActive =
            location.pathname === item.path ||
            location.pathname.startsWith(`${item.path}/`);
          return (
            <Link
              key={item.name}
              aria-current={isActive ? "page" : undefined}
              to={item.path}
              onClick={closeSidebar}
              className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
                isActive
                  ? "border-blue-500/40 bg-blue-600 text-white shadow-sm"
                  : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/80 hover:text-white"
              }`}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
  if (!user) return null;
  return (
    <div className="h-dvh overflow-hidden bg-slate-50 text-slate-800 transition-colors dark:bg-slate-950 dark:text-slate-100 [&_button:focus-visible]:outline [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-blue-500 [&_a:focus-visible]:outline [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-blue-500">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform overflow-hidden border-r border-slate-800 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white shadow-2xl shadow-slate-950/30 transition-transform duration-200 dark:border-slate-800 dark:bg-slate-950 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>
      <section className="flex h-dvh min-w-0 flex-col overflow-hidden lg:pl-64">
        <header className="relative z-30 flex h-20 shrink-0 items-center border-b border-slate-200 bg-white px-4 transition-colors dark:border-slate-800 dark:bg-slate-900 sm:px-6 lg:px-8">
          <div className="flex w-full items-center justify-between gap-4">
            {/* LEFT SIDE */}
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 lg:hidden"
              >
                <Menu size={21} />
              </button>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold leading-tight tracking-tight text-slate-900 sm:text-lg dark:text-white">
                  Welcome back<span role="img" aria-label="hello">👋</span>  {user?.name || "SuperAdmin"}
                  
                </h2>
                <p className="mt-1 hidden truncate text-sm font-medium leading-5 text-slate-500 dark:text-slate-400 sm:block">
                  Manage companies, admins, subscriptions, audit logs and
                  platform settings
                </p>
              </div>
            </div>
            {/* RIGHT SIDE */}
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
              {/* NOTIFICATIONS */}
              <div ref={notificationRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotificationOpen((prev) => !prev);
                    setProfileMenuOpen(false);
                  }}
                  aria-label="Open notifications"
                  aria-expanded={notificationOpen}
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                >
                  <Bell size={19} />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-xs dark:border-slate-900 font-semibold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
                {notificationOpen && (
                  <div className="fixed left-4 right-4 top-[88px] z-50 overflow-hidden rounded-2xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-3 sm:w-96 border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 dark:bg-slate-900 dark:border-slate-700">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                          Notifications
                        </h3>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                          {unreadCount} unread alerts
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllRead}
                            className="text-sm font-semibold text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                          >
                            Mark all read
                          </button>
                        )}
                        <Link
                          to="/superadmin/notifications"
                          onClick={() => setNotificationOpen(false)}
                          className="text-sm font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          View all
                        </Link>
                      </div>
                    </div>
                    <div className="max-h-[min(420px,60dvh)] overflow-y-auto overscroll-contain">
                      {notifications.length > 0 ? (
                        notifications.map((item) => {
                          const unread = Number(item.is_read) === 0;
                          return (
                            <div
                              key={item.id}
                              onClick={() => handleNotificationClick(item)}
                              className={`cursor-pointer border-b border-slate-100 px-4 py-3 transition last:border-b-0 dark:border-slate-700 ${
                                unread
                                  ? "bg-blue-50/70 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-950/50"
                                  : "bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="mt-1 flex w-3 justify-center">
                                  {unread && (
                                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p
                                    className={`truncate text-sm text-slate-900 dark:text-white ${
                                      unread ? "font-semibold" : "font-semibold"
                                    }`}
                                  >
                                    {item.title || "-"}
                                  </p>
                                  <p className="mt-1 line-clamp-2 text-sm font-normal text-slate-500 dark:text-slate-400">
                                    {item.message || "-"}
                                  </p>
                                  <div className="mt-2 flex items-center justify-between gap-2">
                                    <p className="truncate text-sm font-medium text-slate-400 dark:text-slate-500">
                                      {item.created_at
                                        ? new Date(
                                            item.created_at,
                                          ).toLocaleString()
                                        : "-"}
                                    </p>
                                    {unread && (
                                      <span className="shrink-0 text-sm font-semibold text-blue-600 dark:text-blue-400">
                                        New
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="px-4 py-8 text-center">
                          <Bell
                            className="mx-auto text-slate-300 dark:text-slate-600"
                            size={30}
                          />
                          <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                            No notifications found
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* THEME */}
              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-yellow-300 dark:hover:bg-slate-700 dark:hover:text-yellow-200"
                title={
                  darkMode ? "Switch to light mode" : "Switch to dark mode"
                }
                aria-label={
                  darkMode ? "Switch to light mode" : "Switch to dark mode"
                }
              >
                {darkMode ? <Sun size={19} /> : <Moon size={19} />}
              </button>
              {/* PROFILE */}
              <div ref={profileMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen((prev) => !prev);
                    setNotificationOpen(false);
                  }}
                  aria-label="Open profile menu"
                  aria-expanded={profileMenuOpen}
                  className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-1.5 py-1.5 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 md:px-3"
                >
                  {avatar}
                  <div className="hidden min-w-0 text-left md:block">
                    <p className="max-w-[10rem] truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {user?.name || "SuperAdmin"}
                    </p>
                    <p className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                      <Crown size={13} />
                      SuperAdmin
                    </p>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`hidden text-slate-500 transition dark:text-slate-400 md:block ${
                      profileMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {profileMenuOpen && (
                  <div className="absolute right-0 z-50 mt-3 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                    <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {user?.name || "SuperAdmin"}
                      </p>
                      <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                        {user?.email || ""}
                      </p>
                    </div>
                    <Link
                      to="/superadmin/profile"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <UserCircle size={17} />
                      My Profile
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      <LogOut size={17} />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50 p-4 transition-colors dark:bg-slate-950 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </section>
      <style>{`
        .sidebar-scroll::-webkit-scrollbar {
          display: none;
        }
        .sidebar-scroll {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

      `}</style>
    </div>
  );
}
export default SuperAdminLayout;
