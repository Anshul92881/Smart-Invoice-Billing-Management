import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
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
  WalletCards,
} from "lucide-react";

const BASE_URL = import.meta.env.VITE_API_BASE_URL 
  ? import.meta.env.VITE_API_BASE_URL.replace('/api', '') 
  : "http://localhost:5000";

function SuperAdminLayout() {
  const location = useLocation();
  const profileMenuRef = useRef(null);
  const notificationRef = useRef(null);
  const sidebarNavRef = useRef(null);
  const sidebarScrollRef = useRef(0);

  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  });

  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("theme") === "dark",
  );

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

  useEffect(() => {
    const handleUserUpdate = () => {
      try {
        setUser(JSON.parse(localStorage.getItem("user")));
      } catch {
        setUser(null);
      }
    };

    window.addEventListener("userUpdated", handleUserUpdate);

    return () => {
      window.removeEventListener("userUpdated", handleUserUpdate);
    };
  }, []);

  useEffect(() => {
    const nav = sidebarNavRef.current;
    if (!nav) return;

    requestAnimationFrame(() => {
      nav.scrollTop = sidebarScrollRef.current;
    });
  }, [location.pathname]);

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
      const countRes = await api.get("/notifications", {
        params: {
          page: 1,
          limit: 1,
          type: "all",
          status: "unread",
        },
      });

      const allRes = await api.get("/notifications", {
        params: {
          page: 1,
          limit: 20,
          type: "all",
          status: "all",
        },
      });

      const allNotifications = allRes.data.notifications || [];

      const sortedNotifications = [...allNotifications].sort((a, b) => {
        const readA = Number(a.is_read || 0);
        const readB = Number(b.is_read || 0);

        if (readA !== readB) return readA - readB;

        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });

      setUnreadCount(countRes.data.total || 0);
      setNotifications(sortedNotifications);
    } catch (error) {
      console.log(error.response?.data || error);
    }
  };

  useEffect(() => {
    fetchUnreadNotifications();

    const handleNotificationsUpdated = () => {
      fetchUnreadNotifications();
    };

    window.addEventListener("notificationsUpdated", handleNotificationsUpdated);

    const interval = setInterval(() => {
      fetchUnreadNotifications();
    }, 30000);

    return () => {
      window.removeEventListener(
        "notificationsUpdated",
        handleNotificationsUpdated,
      );
      clearInterval(interval);
    };
  }, []);

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

  const menuItems = [
    {
      name: "Dashboard",
      path: "/superadmin/dashboard",
      icon: <LayoutDashboard size={19} />,
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
      icon: <ShieldCheck size={19} />,
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

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.log(error);
    } finally {
      localStorage.clear();
      window.location.href = "/";
    }
  };

  const handleCloseSidebar = () => {
    if (sidebarNavRef.current) {
      sidebarScrollRef.current = sidebarNavRef.current.scrollTop;
    }

    setSidebarOpen(false);
  };

  const Avatar = () => {
    if (profileImageUrl) {
      return (
        <img
          src={profileImageUrl}
          alt={user?.name || "SuperAdmin"}
          className="h-11 w-11 shrink-0 rounded-full border border-slate-200 object-cover shadow-sm dark:border-slate-700"
        />
      );
    }

    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-700 text-sm font-bold text-white shadow-sm">
        {initials}
      </div>
    );
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex h-[73px] shrink-0 items-center border-b border-slate-800/80 px-6 dark:border-slate-800">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 shadow-xl shadow-blue-950/30">
              <WalletCards size={21} className="text-white" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold leading-tight tracking-tight text-white">
                Smart Invoice
              </h1>
              <p className="mt-1 truncate text-sm font-medium leading-5 text-slate-400">
                Multi-Branch Billing
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseSidebar}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-300 transition hover:bg-slate-700 hover:text-white lg:hidden"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <nav
        ref={sidebarNavRef}
        onScroll={(e) => {
          sidebarScrollRef.current = e.currentTarget.scrollTop;
        }}
        className="sidebar-scroll flex-1 space-y-1 overflow-y-auto p-4"
      >
        {menuItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            location.pathname.startsWith(`${item.path}/`);

          return (
            <Link
              key={item.name}
              to={item.path}
              onClick={handleCloseSidebar}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30"
                  : "text-slate-300 hover:bg-slate-800/90 hover:text-white"
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

  return (
    <div className="h-screen overflow-hidden bg-slate-100 text-slate-800 transition-colors dark:bg-slate-950 dark:text-slate-100">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={handleCloseSidebar}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 transform overflow-hidden border-r border-slate-800 bg-slate-900 text-white shadow-2xl shadow-slate-950/30 transition-transform duration-200 dark:border-slate-800 dark:bg-slate-950 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent />
      </aside>

      <section className="flex h-screen flex-col overflow-hidden lg:pl-72">
        <header className="flex h-[73px] shrink-0 items-center border-b border-slate-200 bg-white px-4 transition-colors dark:border-slate-800 dark:bg-slate-900 sm:px-6 lg:px-8">
          <div className="flex w-full items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 lg:hidden"
              >
                <Menu size={21} />
              </button>

              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">
                  Welcome back, {user?.name || "SuperAdmin"}
                </h2>
                <p className="mt-1 hidden truncate text-sm font-medium leading-5 text-slate-500 dark:text-slate-400 sm:block">
                  Manage companies, admins, subscriptions, audit logs and platform settings
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div ref={notificationRef} className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationOpen((prev) => !prev)}
                  className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                >
                  <Bell size={19} />

                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>

                {notificationOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-[calc(100vw-2rem)] max-w-96 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Notifications
                        </h3>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {unreadCount} unread alerts
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await api.patch("/notifications/read-all");

                                await fetchUnreadNotifications();

                                window.dispatchEvent(
                                  new Event("notificationsUpdated"),
                                );
                              } catch (error) {
                                console.log(error);
                              }
                            }}
                            className="text-xs font-semibold text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                          >
                            Mark all read
                          </button>
                        )}

                        <Link
                          to="/superadmin/notifications"
                          onClick={() => setNotificationOpen(false)}
                          className="text-xs font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          View all
                        </Link>
                      </div>
                    </div>

                    <div className="max-h-[420px] overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((item) => (
                          <div
                            key={item.id}
                            onClick={async () => {
                              if (Number(item.is_read) === 0) {
                                try {
                                  await api.patch(
                                    `/notifications/${item.id}/read`,
                                  );

                                  await fetchUnreadNotifications();

                                  window.dispatchEvent(
                                    new Event("notificationsUpdated"),
                                  );
                                } catch (error) {
                                  console.log(error);
                                }
                              }
                            }}
                            className={`cursor-pointer border-b border-slate-100 px-4 py-3 transition last:border-b-0 dark:border-slate-700 ${
                              Number(item.is_read) === 0
                                ? "bg-blue-50/70 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-950/50"
                                : "bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-1 flex w-3 justify-center">
                                {Number(item.is_read) === 0 && (
                                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p
                                  className={`truncate text-sm text-slate-900 dark:text-white ${
                                    Number(item.is_read) === 0
                                      ? "font-bold"
                                      : "font-semibold"
                                  }`}
                                >
                                  {item.title || "-"}
                                </p>

                                <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                  {item.message || "-"}
                                </p>

                                <div className="mt-2 flex items-center justify-between gap-2">
                                  <p className="truncate text-[11px] font-medium text-slate-400 dark:text-slate-500">
                                    {item.created_at
                                      ? new Date(
                                          item.created_at,
                                        ).toLocaleString()
                                      : "-"}
                                  </p>

                                  {Number(item.is_read) === 0 && (
                                    <span className="shrink-0 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                                      New
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-8 text-center">
                          <Bell
                            className="mx-auto text-slate-300 dark:text-slate-600"
                            size={30}
                          />
                          <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                            No unread notifications
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-yellow-300 dark:hover:bg-slate-700 dark:hover:text-yellow-200"
                title={
                  darkMode ? "Switch to light mode" : "Switch to dark mode"
                }
              >
                {darkMode ? <Sun size={19} /> : <Moon size={19} />}
              </button>

              <div ref={profileMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-1.5 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 md:px-3"
                >
                  <Avatar />

                  <div className="hidden min-w-0 text-left md:block">
                    <p className="max-w-40 truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {user?.name || "SuperAdmin"}
                    </p>

                    <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
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
                  <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                    <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
                      <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                        {user?.name || "SuperAdmin"}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
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

        <main className="min-w-0 flex-1 overflow-y-auto bg-slate-100 p-4 transition-colors dark:bg-slate-950 sm:p-6 lg:p-8">
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

        button:focus,
        button:focus-visible,
        a:focus,
        a:focus-visible {
          outline: none;
        }
      `}</style>
    </div>
  );
}

export default SuperAdminLayout;
