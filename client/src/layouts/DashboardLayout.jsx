import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  ? import.meta.env.VITE_API_BASE_URL.replace("/api", "")
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
  const [openMenuGroups, setOpenMenuGroups] = useState({});
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });

  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [showTrialExpiredModal, setShowTrialExpiredModal] = useState(false);

  const [showKycPendingModal, setShowKycPendingModal] = useState(false);
  const [kycPendingMessage, setKycPendingMessage] = useState(
    "Your KYC is pending. Complete KYC to use this feature.",
  );

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

  useEffect(() => {
    const handleKycRequired = (event) => {
      setKycPendingMessage(
        event?.detail?.message ||
          "Your KYC is pending. Complete KYC to use this feature.",
      );
      setShowKycPendingModal(true);
    };

    window.addEventListener("kycRequired", handleKycRequired);

    return () => {
      window.removeEventListener("kycRequired", handleKycRequired);
    };
  }, []);

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

  const menuGroups = [
    {
      key: "dashboard",
      label: null,
      items: [
        {
          name: "Dashboard",
          path: "/dashboard",
          icon: <LayoutDashboard size={19} />,
          roles: ["company_admin", "accountant", "sales_user"],
        },
      ],
    },
    {
      key: "business",
      label: "Business",
      icon: <Building2 size={19} />,
      items: [
        {
          name: "Customers",
          path: "/dashboard/customers",
          icon: <Users size={18} />,
          roles: ["company_admin", "accountant", "sales_user"],
        },
        {
          name: "Products",
          path: "/dashboard/products",
          icon: <Package size={18} />,
          roles: ["company_admin", "accountant", "sales_user"],
        },
        {
          name: "Vendors",
          path: "/dashboard/vendors",
          icon: <Truck size={18} />,
          roles: ["company_admin", "accountant", "sales_user"],
          permissionKey: "vendors",
        },
        {
          name: "Branches",
          path: "/dashboard/branches",
          icon: <Building2 size={18} />,
          roles: ["company_admin", "accountant", "sales_user"],
          permissionKey: "branches",
        },
        {
          name: "Company",
          path: "/dashboard/company",
          icon: <Building2 size={18} />,
          roles: ["company_admin"],
        },
      ],
    },
    {
      key: "sales",
      label: "Sales",
      icon: <Receipt size={19} />,
      items: [
        {
          name: "Quotations",
          path: "/dashboard/quotations",
          icon: <FileText size={18} />,
          roles: ["company_admin", "accountant", "sales_user"],
          permissionKey: "quotations",
        },
        {
          name: "Invoices",
          path: "/dashboard/invoices",
          icon: <FileText size={18} />,
          roles: ["company_admin", "accountant", "sales_user"],
        },
        {
          name: "Payments",
          path: "/dashboard/payments",
          icon: <Receipt size={18} />,
          roles: ["company_admin", "accountant", "sales_user"],
          permissionKey: "payments",
        },
      ],
    },
    {
      key: "finance",
      label: "Finance",
      icon: <BarChart3 size={19} />,
      items: [
        {
          name: "Expenses",
          path: "/dashboard/expenses",
          icon: <Wallet size={18} />,
          roles: ["company_admin", "accountant", "sales_user"],
          permissionKey: "expenses",
        },
        {
          name: "Taxes",
          path: "/dashboard/taxes",
          icon: <Percent size={18} />,
          roles: ["company_admin", "accountant", "sales_user"],
          permissionKey: "taxes",
        },
        {
          name: "Reports",
          path: "/dashboard/reports",
          icon: <BarChart3 size={18} />,
          roles: ["company_admin", "accountant", "sales_user"],
          permissionKey: "reports",
        },
        {
          name: "Billing / Subscription",
          path: "/dashboard/billing",
          icon: <ShieldCheck size={18} />,
          roles: ["company_admin", "accountant", "sales_user"],
          permissionKey: "billing",
        },
      ],
    },
    {
      key: "users",
      label: "Users",
      icon: <Users size={19} />,
      items: [
        {
          name: "Accountants",
          path: "/dashboard/accountants",
          icon: <UserCog size={18} />,
          roles: ["company_admin"],
        },
        {
          name: "Sales Users",
          path: "/dashboard/sales-users",
          icon: <Users size={18} />,
          roles: ["company_admin"],
        },
        {
          name: "Role Permissions",
          path: "/dashboard/role-permissions",
          icon: <ShieldCheck size={18} />,
          roles: ["company_admin"],
        },
      ],
    },
    {
      key: "settings",
      label: "Settings",
      icon: <Settings size={19} />,
      items: [
        {
          name: "Profile",
          path: "/dashboard/profile",
          icon: <UserCircle size={18} />,
          roles: ["company_admin", "accountant", "sales_user"],
        },
        {
          name: "Notifications",
          path: "/dashboard/notifications",
          icon: <Bell size={18} />,
          roles: ["company_admin", "accountant", "sales_user"],
        },
        {
          name: "Billing Template",
          path: "/dashboard/billing-template",
          icon: <WalletCards size={18} />,
          roles: ["company_admin"],
        },
        {
          name: "Company Settings",
          path: "/dashboard/company-settings",
          icon: <Settings size={18} />,
          roles: ["company_admin"],
        },
        {
          name: "Audit Logs",
          path: "/dashboard/audit-logs",
          icon: <Activity size={18} />,
          roles: ["company_admin", "accountant", "sales_user"],
          permissionKey: "audit_logs",
        },
      ],
    },
  ];

  const allowedExpiredRoutes = [
    "/dashboard/billing",
    "/dashboard/profile",
    "/dashboard/notifications",
  ];

  const isMenuItemActive = (item) =>
    location.pathname === item.path ||
    (item.path !== "/dashboard" &&
      location.pathname.startsWith(`${item.path}/`));

  const visibleMenuGroups = menuGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.roles.includes(role)) return false;
        if (!hasPermission(item.permissionKey)) return false;
        if (trialExpired) return allowedExpiredRoutes.includes(item.path);
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);

  useEffect(() => {
    const activeGroup = visibleMenuGroups.find(
      (group) =>
        group.label && group.items.some((item) => isMenuItemActive(item)),
    );

    if (!activeGroup) return;

    setOpenMenuGroups((prev) => ({
      ...prev,
      [activeGroup.key]: true,
    }));
  }, [location.pathname, role, rolePermissions, trialExpired]);

  const toggleMenuGroup = (groupKey) => {
    setOpenMenuGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

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

  const handleCompleteKyc = () => {
    setShowKycPendingModal(false);

    const companyId =
      user?.company_id || localStorage.getItem("pending_company_id");

    if (!companyId) {
      toast.error("Company information not found. Please login again.");
      return;
    }

    navigate(`/kyc-verification/${companyId}`, {
      state: {
        manualKyc: false,
        email: user?.email || "",
      },
    });
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
        {visibleMenuGroups.map((group) => {
          if (!group.label) {
            return group.items.map((item) => {
              const isActive = isMenuItemActive(item);

              return (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => {
                    if (sidebarNavRef.current) {
                      sidebarScrollRef.current =
                        sidebarNavRef.current.scrollTop;
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
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            });
          }

          const hasActiveItem = group.items.some((item) =>
            isMenuItemActive(item),
          );
          const isGroupOpen =
            Boolean(openMenuGroups[group.key]) || hasActiveItem;

          return (
            <div key={group.key} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleMenuGroup(group.key)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                  hasActiveItem
                    ? "bg-slate-800 text-white"
                    : "text-slate-300 hover:bg-slate-800/90 hover:text-white"
                }`}
                aria-expanded={isGroupOpen}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="shrink-0">{group.icon}</span>
                  <span className="truncate">{group.label}</span>
                </span>

                <ChevronDown
                  size={17}
                  className={`shrink-0 transition-transform duration-200 ${
                    isGroupOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              <div
                className={`grid overflow-hidden transition-all duration-200 ${
                  isGroupOpen
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="min-h-0">
                  <div className="ml-4 space-y-1 border-l border-slate-700/80 py-1 pl-3">
                    {group.items.map((item) => {
                      const isActive = isMenuItemActive(item);

                      return (
                        <Link
                          key={item.name}
                          to={item.path}
                          onClick={() => {
                            if (sidebarNavRef.current) {
                              sidebarScrollRef.current =
                                sidebarNavRef.current.scrollTop;
                            }

                            setSidebarOpen(false);
                          }}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
                            isActive
                              ? "bg-blue-600 text-white shadow-md shadow-blue-950/20"
                              : "text-slate-400 hover:bg-slate-800/80 hover:text-white"
                          }`}
                        >
                          <span className="shrink-0">{item.icon}</span>
                          <span className="truncate">{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
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
        <header className="flex h-[73px] shrink-0 items-center border-b border-slate-200 bg-white px-3 transition-colors dark:border-slate-800 dark:bg-slate-900 sm:px-5 lg:px-6 xl:px-8">
          <div className="flex w-full min-w-0 items-center justify-between gap-3">
            {/* LEFT SIDE */}
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 lg:hidden"
                aria-label="Open sidebar"
              >
                <Menu size={20} />
              </button>

              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-bold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-lg xl:text-xl">
                  Welcome back, {user?.name || "User"}
                </h2>

                <p className="mt-0.5 hidden truncate text-xs font-medium leading-5 text-slate-500 dark:text-slate-400 md:block xl:text-sm">
                  Manage invoices, GST, payments and reports
                </p>
              </div>
            </div>

            {/* RIGHT SIDE */}
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {/* THEME */}
              <button
                type="button"
                onClick={() => setDarkMode((prev) => !prev)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-yellow-300 dark:hover:bg-slate-700 dark:hover:text-yellow-200 sm:h-11 sm:w-11"
                title={
                  darkMode ? "Switch to light mode" : "Switch to dark mode"
                }
                aria-label={
                  darkMode ? "Switch to light mode" : "Switch to dark mode"
                }
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              {/* NOTIFICATIONS */}
              <div ref={notificationRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotificationOpen((prev) => !prev);
                    setProfileMenuOpen(false);
                  }}
                  className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white sm:h-11 sm:w-11"
                  aria-label="Open notifications"
                >
                  <Bell size={18} />

                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>

                {notificationOpen && (
                  <div className="fixed left-3 right-3 top-[78px] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                          Notifications
                        </h3>

                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {unreadCount} unread alerts
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
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
                            className="whitespace-nowrap text-xs font-semibold text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                          >
                            Mark all read
                          </button>
                        )}

                        <Link
                          to="/dashboard/notifications"
                          onClick={() => setNotificationOpen(false)}
                          className="whitespace-nowrap text-xs font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          View all
                        </Link>
                      </div>
                    </div>

                    <div className="max-h-[min(420px,calc(100vh-160px))] overflow-y-auto">
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
                              <div className="mt-1 flex w-3 shrink-0 justify-center">
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

                                <div className="mt-2 flex items-center justify-between gap-3">
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
                            No notifications found
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* PROFILE */}
              <div ref={profileMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen((prev) => !prev);
                    setNotificationOpen(false);
                  }}
                  className="flex h-10 min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 sm:h-11 sm:px-1.5 xl:max-w-[230px] xl:gap-2.5 xl:px-2"
                  aria-label="Open profile menu"
                >
                  {profileImageUrl ? (
                    <img
                      src={profileImageUrl}
                      alt={user?.name || "User"}
                      className="h-8 w-8 shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700 sm:h-9 sm:w-9"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white sm:h-9 sm:w-9">
                      {initials}
                    </div>
                  )}

                  <div className="hidden min-w-0 flex-1 text-left xl:block">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {user?.name || "User"}
                    </p>

                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                        {formatRole[role] || "User"}
                      </p>

                      {formatBranchLabel(user) && (
                        <>
                          <span className="text-[10px] text-slate-300 dark:text-slate-600">
                            •
                          </span>

                          <p className="truncate text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                            {formatBranchLabel(user)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <ChevronDown
                    size={15}
                    className={`hidden shrink-0 text-slate-500 transition dark:text-slate-400 xl:block ${
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

                      <div className="mt-2 flex min-w-0 items-center gap-1.5">
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {formatRole[role] || "User"}
                        </span>

                        {formatBranchLabel(user) && (
                          <span className="truncate rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                            {formatBranchLabel(user)}
                          </span>
                        )}
                      </div>
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

      {showKycPendingModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kyc-pending-title"
          >
            <div className="relative z-[100000] w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] dark:border-slate-700 dark:bg-slate-900">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                <ShieldCheck size={27} />
              </div>

              <h2
                id="kyc-pending-title"
                className="mt-5 text-xl font-bold text-slate-900 dark:text-white"
              >
                KYC Pending
              </h2>

              <p className="mt-3 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
                {kycPendingMessage}
              </p>

              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  This action was blocked.
                </p>

                <p className="mt-1 text-sm leading-6 text-amber-700 dark:text-amber-300">
                  You can explore the dashboard, but complete your KYC to unlock
                  full access.
                </p>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowKycPendingModal(false)}
                  className="min-h-[46px] rounded-xl border border-slate-200 bg-slate-100 px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  No
                </button>

                <button
                  type="button"
                  onClick={handleCompleteKyc}
                  className="min-h-[46px] rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  Yes, Complete KYC
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

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