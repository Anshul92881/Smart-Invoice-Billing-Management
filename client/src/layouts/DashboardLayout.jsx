import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import socket from "../services/socket";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { connectSocket } from "../services/socket";

import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Receipt,
  BarChart3,
  Wallet,
  LogOut,
  Percent,
  Bell,
  Building2,
  UserCircle,
  UserCog,
  Settings,
  Truck,
  ShieldCheck,
  Menu,
  X,
  Activity,
  ChevronDown,
  Moon,
  Sun,
  WalletCards,
} from "lucide-react";

import { Link, Outlet, useLocation } from "react-router-dom";

const BASE_URL = import.meta.env.VITE_API_BASE_URL 
  ? import.meta.env.VITE_API_BASE_URL.replace('/api', '') 
  : "http://localhost:5000";
  
function DashboardLayout() {
  const location = useLocation();
  const profileMenuRef = useRef(null);
  const notificationRef = useRef(null);

  const sidebarNavRef = useRef(null);
  const sidebarScrollRef = useRef(0);

  const [user] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  });

  const [rolePermissions, setRolePermissions] = useState({});

  const role = user?.role;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });

  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [showTrialExpiredModal, setShowTrialExpiredModal] = useState(false);

  const navigate = useNavigate();

  const trialExpired =
    subscriptionStatus?.status === "expired" ||
    subscriptionStatus?.trial_status === "expired";

  useEffect(() => {
    if (!trialExpired) return;

    const allowedPaths = [
      "/dashboard/billing",
      "/dashboard/profile",
      "/dashboard/notifications",
    ];

    if (!allowedPaths.includes(location.pathname)) {
      navigate("/dashboard/billing", {
        replace: true,
      });
    }
  }, [trialExpired, location.pathname, navigate]);

  useEffect(() => {
    if (role !== "company_admin") return;

    const fetchSubscriptionStatus = async () => {
      try {
        const res = await api.get("/subscriptions/my/current");

        const subscription = res.data?.subscription || res.data;

        setSubscriptionStatus(subscription);

        if (
          subscription?.status === "expired" ||
          subscription?.trial_status === "expired"
        ) {
          setShowTrialExpiredModal(true);
        }
      } catch (error) {
        console.log(error);
      }
    };

    fetchSubscriptionStatus();
  }, [role]);

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

  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

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

  // FETCH ROLE PERMISSIONS
  // Loads optional permissions saved by Company Admin for current role
  useEffect(() => {
    const fetchRolePermissions = async () => {
      try {
        if (!user?.company_id || role === "company_admin") {
          setRolePermissions({});
          return;
        }

        const res = await api.get("/companies/role-permissions");
        setRolePermissions(res.data?.permissions || {});
      } catch (error) {
        setRolePermissions({});
      }
    };

    fetchRolePermissions();
  }, [user?.company_id, role]);

  // BASE ROLE PERMISSIONS
  // Defines default module authority for each role
  const BASE_ROLE_PERMISSIONS = {
    company_admin: "all",

    accountant: {
      branches: true, // view-only default in page
      customers: true, // view-only default in page
      products: true, // view-only default in page

      invoices: true,
      payments: true,
      expenses: true,
      taxes: true,
      reports: true,
    },

    sales_user: {
      branches: true, // view-only default in page
      customers: true,
      products: true, // view-only default in page

      quotations: true,
      invoices: true,
    },
  };

  // CHECK MODULE PERMISSION
  // Allows module if role has default access or Company Admin has granted optional access
  const hasPermission = (key) => {
    if (!key) return true;

    if (role === "company_admin") return true;

    const base = BASE_ROLE_PERMISSIONS[role];

    if (base === "all" || base?.[key]) return true;

    return Boolean(rolePermissions?.[role]?.[key]);
  };

  const initials =
    user?.name
      ?.split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  const profileImageUrl = (() => {
    if (!user?.profile_image) return "";
    if (String(user.profile_image).startsWith("http"))
      return user.profile_image;
    if (
      String(user.profile_image).startsWith("/uploads") ||
      String(user.profile_image).startsWith("/upload")
    ) {
      return `${BASE_URL}${user.profile_image}`;
    }
    return `${BASE_URL}/uploads/profiles/${user.profile_image}`;
  })();

  const formatRole = {
    company_admin: "Company Admin",
    accountant: "Accountant",
    sales_user: "Sales User",
  };

  const settingsPath =
    role === "company_admin"
      ? "/dashboard/company-settings"
      : "/dashboard/profile";

  const formatBranchLabel = (item) => {
    if (!item?.branch_name) return "";

    return item.branch_code
      ? `${item.branch_name} (${item.branch_code})`
      : item.branch_name;
  };

  const allMenuItems = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: <LayoutDashboard size={19} />,
      roles: ["company_admin", "accountant", "sales_user"],
    },

    // Daily Work
    {
      name: "Customers",
      path: "/dashboard/customers",
      icon: <Users size={19} />,
      roles: ["company_admin", "accountant", "sales_user"],
    },
    {
      name: "Products",
      path: "/dashboard/products",
      icon: <Package size={19} />,
      roles: ["company_admin", "accountant", "sales_user"],
    },
    {
      name: "Quotations",
      path: "/dashboard/quotations",
      icon: <FileText size={19} />,
      roles: ["company_admin", "accountant", "sales_user"],
      permissionKey: "quotations",
    },
    {
      name: "Invoices",
      path: "/dashboard/invoices",
      icon: <FileText size={19} />,
      roles: ["company_admin", "accountant", "sales_user"],
    },
    {
      name: "Payments",
      path: "/dashboard/payments",
      icon: <Receipt size={19} />,
      roles: ["company_admin", "accountant", "sales_user"],
      permissionKey: "payments",
    },

    // Accounting
    {
      name: "Expenses",
      path: "/dashboard/expenses",
      icon: <Wallet size={19} />,
      roles: ["company_admin", "accountant", "sales_user"],
      permissionKey: "expenses",
    },
    {
      name: "Vendors",
      path: "/dashboard/vendors",
      icon: <Truck size={19} />,
      roles: ["company_admin", "accountant", "sales_user"],
      permissionKey: "vendors",
    },
    {
      name: "Taxes",
      path: "/dashboard/taxes",
      icon: <Percent size={19} />,
      roles: ["company_admin", "accountant", "sales_user"],
      permissionKey: "taxes",
    },
    {
      name: "Reports",
      path: "/dashboard/reports",
      icon: <BarChart3 size={19} />,
      roles: ["company_admin", "accountant", "sales_user"],
      permissionKey: "reports",
    },

    // Branch & Team
    {
      name: "Branches",
      path: "/dashboard/branches",
      icon: <Building2 size={19} />,
      roles: ["company_admin", "accountant", "sales_user"],
      permissionKey: "branches",
    },
    {
      name: "Accountants",
      path: "/dashboard/accountants",
      icon: <UserCog size={19} />,
      roles: ["company_admin"],
    },
    {
      name: "Sales Users",
      path: "/dashboard/sales-users",
      icon: <Users size={19} />,
      roles: ["company_admin"],
    },
    {
      name: "Role Permissions",
      path: "/dashboard/role-permissions",
      icon: <ShieldCheck size={19} />,
      roles: ["company_admin"],
    },

    // Company
    {
      name: "Company",
      path: "/dashboard/company",
      icon: <Building2 size={19} />,
      roles: ["company_admin"],
    },
    {
      name: "Billing Template",
      path: "/dashboard/billing-template",
      icon: <WalletCards size={19} />,
      roles: ["company_admin"],
    },
    {
      name: "Company Settings",
      path: "/dashboard/company-settings",
      icon: <Settings size={19} />,
      roles: ["company_admin"],
    },

    // Subscription
    {
      name: "Billing / Subscription",
      path: "/dashboard/billing",
      icon: <ShieldCheck size={19} />,
      roles: ["company_admin", "accountant", "sales_user"],
      permissionKey: "billing",
    },

    // Monitoring
    {
      name: "Audit Logs",
      path: "/dashboard/audit-logs",
      icon: <Activity size={19} />,
      roles: ["company_admin", "accountant", "sales_user"],
      permissionKey: "audit_logs",
    },
    {
      name: "Notifications",
      path: "/dashboard/notifications",
      icon: <Bell size={19} />,
      roles: ["company_admin", "accountant", "sales_user"],
    },
    {
      name: "Profile",
      path: "/dashboard/profile",
      icon: <UserCircle size={19} />,
      roles: ["company_admin", "accountant", "sales_user"],
    },
  ];

  const allowedExpiredRoutes = [
    "/dashboard/billing",
    "/dashboard/profile",
    "/dashboard/notifications",
  ];

  const menuItems = allMenuItems.filter((item) => {
    if (!item.roles.includes(role)) return false;

    if (!hasPermission(item.permissionKey)) return false;

    if (trialExpired) {
      return allowedExpiredRoutes.includes(item.path);
    }

    return true;
  });

  const fetchUnreadNotifications = async () => {
    try {
      const allRes = await api.get("/notifications", {
        params: {
          page: 1,
          limit: 20,
          type: "all",
          status: "all",
        },
      });

      const companyAdminNotifications = allRes.data.notifications || [];

      const sortedNotifications = [...companyAdminNotifications].sort(
        (a, b) => {
          const readA = Number(a.is_read || 0);
          const readB = Number(b.is_read || 0);

          if (readA !== readB) return readA - readB;

          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        },
      );

      setUnreadCount(
        companyAdminNotifications.filter((item) => Number(item.is_read) === 0)
          .length,
      );

      setNotifications(sortedNotifications);
    } catch (error) {
      console.log(error.response?.data || error);
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    connectSocket(user);

    if (["company_admin", "accountant", "sales_user"].includes(user.role)) {
      fetchUnreadNotifications();
    }

    const handleNotificationsUpdated = () => {
      fetchUnreadNotifications();

      window.dispatchEvent(new Event("notificationsUpdated"));
    };

    socket.on("notification_updated", handleNotificationsUpdated);

    return () => {
      socket.off("notification_updated", handleNotificationsUpdated);
    };
  }, [user?.id, user?.role, user?.company_id]);

  const handleRequestTrialExtension = async () => {
    try {
      await api.post("/subscriptions/my/trial-extension/request");

      toast.success("Trial extension request submitted successfully.");

      setShowTrialExpiredModal(false);

      const res = await api.get("/subscriptions/my/current");

      setSubscriptionStatus(res.data?.subscription || res.data);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to request trial extension",
      );
    }
  };

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Logout should still clear local session even if server logout fails.
    }

    localStorage.clear();

    navigate("/", {
      replace: true,
    });
  };

  const Avatar = () => {
    if (profileImageUrl) {
      return (
        <img
          src={profileImageUrl}
          alt={user?.name || "User"}
          className="h-11 w-11 shrink-0 rounded-full border border-slate-200 object-cover shadow-sm dark:border-slate-700"
        />
      );
    }

    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shadow-sm">
        {initials}
      </div>
    );
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-[73px] shrink-0 items-center border-b border-slate-800/80 px-6 dark:border-slate-800">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 shadow-xl shadow-blue-950/30">
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
            onClick={() => {
              if (sidebarNavRef.current) {
                sidebarScrollRef.current = sidebarNavRef.current.scrollTop;
              }

              setSidebarOpen(false);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-300 transition hover:bg-slate-700 hover:text-white lg:hidden"
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
            (item.path !== "/dashboard" &&
              location.pathname.startsWith(`${item.path}/`));

          return (
            <Link
              key={item.name}
              to={item.path}
              onClick={() => {
                if (sidebarNavRef.current) {
                  sidebarScrollRef.current = sidebarNavRef.current.scrollTop;
                }

                setSidebarOpen(false);
              }}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30"
                  : "text-slate-300 hover:bg-slate-800/90 hover:text-white"
              }`}
            >
              {item.icon}
              {item.name}
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
          onClick={() => {
            if (sidebarNavRef.current) {
              sidebarScrollRef.current = sidebarNavRef.current.scrollTop;
            }

            setSidebarOpen(false);
          }}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 transform border-r border-slate-800 bg-slate-900 text-white shadow-2xl shadow-slate-950/30 transition-transform duration-200 dark:border-slate-800 dark:bg-slate-950 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
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
                  Welcome back, {user?.name || "User"}
                </h2>

                <p className="mt-1 hidden truncate text-sm font-medium leading-5 text-slate-500 dark:text-slate-400 sm:block">
                  Manage invoices, GST, payments and reports
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setDarkMode((prev) => !prev)}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-yellow-300 dark:hover:bg-slate-700 dark:hover:text-yellow-200"
                title={
                  darkMode ? "Switch to light mode" : "Switch to dark mode"
                }
              >
                {darkMode ? <Sun size={19} /> : <Moon size={19} />}
              </button>

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
                          to="/dashboard/notifications"
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
                                ? "bg-blue-50/70 hover:bg-blue-100 dark:bg-blue-950/20"
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
                                <div className="flex items-start justify-between gap-2">
                                  <p
                                    className={`truncate text-sm text-slate-900 dark:text-white ${
                                      Number(item.is_read) === 0
                                        ? "font-bold"
                                        : "font-semibold"
                                    }`}
                                  >
                                    {item.title || "-"}
                                  </p>
                                </div>

                                <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                  {item.message || "-"}
                                </p>

                                <div className="mt-2 flex items-center justify-between">
                                  <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                                    {item.created_at
                                      ? new Date(
                                          item.created_at,
                                        ).toLocaleString()
                                      : "-"}
                                  </p>

                                  {Number(item.is_read) === 0 && (
                                    <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
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
                            No notifications found
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div ref={profileMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-1.5 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 md:px-3"
                >
                  <Avatar />

                  <div className="hidden min-w-0 text-left md:block">
                    <p className="max-w-40 truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {user?.name || "User"}
                    </p>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatRole[role] || "User"}
                    </p>

                    {formatBranchLabel(user) && (
                      <p className="mt-0.5 max-w-40 truncate text-xs font-semibold text-blue-700 dark:text-blue-300">
                        {formatBranchLabel(user)}
                      </p>
                    )}
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
                        {user?.name || "User"}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {user?.email || ""}
                      </p>
                    </div>

                    <Link
                      to="/dashboard/profile"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <UserCircle size={17} />
                      My Profile
                    </Link>

                    {role === "company_admin" && (
                      <Link
                        to={settingsPath}
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Settings size={17} />
                        Settings
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-950/30"
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

      {showTrialExpiredModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Trial Plan Expired
            </h2>

            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Your 10-day free trial has ended.
            </p>

            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              To continue using Smart Invoice & Billing Management System,
              please purchase a subscription plan.
            </p>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/40">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Need more time?
              </p>

              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                You may request a one-time 10-day trial extension.
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Support Email
              </p>

              <p className="font-semibold text-slate-900 dark:text-white">
                support@smartinvoice.com
              </p>

              <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                Contact Number
              </p>

              <p className="font-semibold text-slate-900 dark:text-white">
                +91 00000 00000
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowTrialExpiredModal(false);
                  navigate("/dashboard/billing");
                }}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                View Plans
              </button>

              <button
                onClick={handleRequestTrialExtension}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 font-semibold text-slate-700 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
              >
                Request Extension
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardLayout;
