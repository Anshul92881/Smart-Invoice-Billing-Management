import { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  Save,
  RotateCcw,
  Lock,
  CheckCircle2,
  Loader2,
  Info,
} from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";

const MODULES = [
  {
    key: "branches",
    label: "Branches",
    description:
      "View branch list by default. Create, edit and delete when permission is enabled",
  },
  {
    key: "customers",
    label: "Customers",
    description:
      "View customers by default. CRUD access when permission is enabled",
  },
  {
    key: "products",
    label: "Products",
    description:
      "View products by default. CRUD access when permission is enabled",
  },
  {
    key: "vendors",
    label: "Vendors",
    description: "Vendor management and CRUD access",
  },
  {
    key: "quotations",
    label: "Quotations",
    description: "Quotation creation, updates and status access",
  },
  {
    key: "invoices",
    label: "Invoices",
    description: "Invoice creation, updates, download and email access",
  },
  {
    key: "payments",
    label: "Payments",
    description: "Record and manage invoice payments",
  },
  {
    key: "expenses",
    label: "Expenses",
    description: "Company expense creation and management",
  },
  {
    key: "taxes",
    label: "Taxes",
    description: "GST, TDS, TCS and tax rule management",
  },
  {
    key: "reports",
    label: "Reports",
    description: "Sales, expense, profit and tax reports",
  },
  {
    key: "audit_logs",
    label: "Audit Logs",
    description: "View system activity and export logs",
  },
  {
    key: "billing",
    label: "Billing / Subscription",
    description: "Subscription invoices, payments and requests",
  },
];

const BASE_PERMISSIONS = {
  accountant: {
    invoices: true,
    payments: true,
    expenses: true,
    taxes: true,
    reports: true,
  },

  sales_user: {
    customers: true,
    products: true,
    quotations: true,
    invoices: true,
  },
};

const getEmptyPermissions = () => ({
  accountant: {},
  sales_user: {},
});

const normalizePermissions = (data) => ({
  accountant: data?.accountant || {},
  sales_user: data?.sales_user || {},
});

function RolePermissions() {
  const [permissions, setPermissions] = useState(getEmptyPermissions);
  const [initialPermissions, setInitialPermissions] =
    useState(getEmptyPermissions);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isDirty = useMemo(() => {
    return JSON.stringify(permissions) !== JSON.stringify(initialPermissions);
  }, [permissions, initialPermissions]);

  const stats = useMemo(() => {
    const accountantCount = MODULES.filter(
      (item) =>
        BASE_PERMISSIONS.accountant[item.key] ||
        permissions.accountant?.[item.key],
    ).length;

    const salesCount = MODULES.filter(
      (item) =>
        BASE_PERMISSIONS.sales_user[item.key] ||
        permissions.sales_user?.[item.key],
    ).length;

    const optionalAccountant = MODULES.filter(
      (item) =>
        !BASE_PERMISSIONS.accountant[item.key] &&
        permissions.accountant?.[item.key],
    ).length;

    const optionalSales = MODULES.filter(
      (item) =>
        !BASE_PERMISSIONS.sales_user[item.key] &&
        permissions.sales_user?.[item.key],
    ).length;

    return {
      accountantCount,
      salesCount,
      optionalAccountant,
      optionalSales,
    };
  }, [permissions]);

  const fetchPermissions = async () => {
    try {
      setLoading(true);

      const res = await api.get("/companies/role-permissions");
      const nextPermissions = normalizePermissions(res.data?.permissions);

      setPermissions(nextPermissions);
      setInitialPermissions(nextPermissions);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to load role permissions",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const isBasePermission = (role, key) => {
    return Boolean(BASE_PERMISSIONS[role]?.[key]);
  };

  const hasPermission = (role, key) => {
    return Boolean(BASE_PERMISSIONS[role]?.[key] || permissions[role]?.[key]);
  };

  const togglePermission = (role, key) => {
    if (isBasePermission(role, key) || saving) return;

    setPermissions((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [key]: !prev[role]?.[key],
      },
    }));
  };

  const handleSave = async () => {
    if (!isDirty) {
      toast("No permission changes to save");
      return;
    }

    try {
      setSaving(true);

      await api.put("/companies/role-permissions", {
        permissions,
      });

      const meRes = await api.get("/auth/me");

      if (meRes.data?.user) {
        localStorage.setItem("user", JSON.stringify(meRes.data.user));
      }

      toast.success("Role permissions updated successfully");
      await fetchPermissions();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to save role permissions",
      );
    } finally {
      setSaving(false);
    }
  };

  const resetOptional = () => {
    setPermissions(getEmptyPermissions());
  };

  if (loading) {
    return (
      <div className="w-full min-w-0 space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-300">
            <Loader2
              size={18}
              className="animate-spin text-blue-600 dark:text-blue-400"
            />
            Loading role permissions...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-5 overflow-x-hidden">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
              <ShieldCheck size={17} />
              Access Control
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Role Permissions
            </h1>

            <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              Manage optional module access for Accountants and Sales Users.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:self-center">
            <button
              type="button"
              onClick={resetOptional}
              disabled={saving}
              className="inline-flex h-11 min-w-[160px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-700 shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-slate-200 hover:text-slate-900 focus:outline-none focus:ring-0 active:ring-0 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
            >
              <RotateCcw size={16} />
              Reset Optional
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="inline-flex h-11 min-w-[180px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-0 active:ring-0 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-white dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {saving ? "Saving..." : isDirty ? "Save Permissions" : "Saved"}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-5 dark:border-slate-800">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Permission Matrix
              </h2>

              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                Default permissions are locked. Optional permissions can be
                enabled or disabled by Company Admin.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <LegendBadge
                icon={<Lock size={13} />}
                label="Locked"
                className="border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              />
              <LegendBadge
                icon={<CheckCircle2 size={13} />}
                label="Default"
                className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
              />
              <LegendBadge
                icon={<Info size={13} />}
                label="Optional"
                className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300"
              />
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed text-sm">
            <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
              <tr>
                <th className="w-[40%] px-5 py-4 text-left text-xs font-bold uppercase tracking-wide">
                  Module
                </th>
                <th className="w-[20%] px-5 py-4 text-center text-xs font-bold uppercase tracking-wide">
                  Company Admin
                </th>
                <th className="w-[20%] px-5 py-4 text-center text-xs font-bold uppercase tracking-wide">
                  Accountant
                </th>
                <th className="w-[20%] px-5 py-4 text-center text-xs font-bold uppercase tracking-wide">
                  Sales User
                </th>
              </tr>
            </thead>

            <tbody>
              {MODULES.map((module) => (
                <tr
                  key={module.key}
                  className="border-t border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                >
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-900 dark:text-white">
                      {module.label}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      {module.description}
                    </p>
                  </td>

                  <td className="px-5 py-4 text-center">
                    <StatusPill
                      icon={<Lock size={13} />}
                      label="Locked"
                      className="border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    />
                  </td>

                  <td className="px-5 py-4 text-center">
                    {isBasePermission("accountant", module.key) ? (
                      <StatusPill
                        icon={<CheckCircle2 size={13} />}
                        label="Default"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                      />
                    ) : (
                      <PermissionToggle
                        checked={hasPermission("accountant", module.key)}
                        disabled={saving}
                        onChange={() =>
                          togglePermission("accountant", module.key)
                        }
                      />
                    )}
                  </td>

                  <td className="px-5 py-4 text-center">
                    {isBasePermission("sales_user", module.key) ? (
                      <StatusPill
                        icon={<CheckCircle2 size={13} />}
                        label="Default"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                      />
                    ) : (
                      <PermissionToggle
                        checked={hasPermission("sales_user", module.key)}
                        disabled={saving}
                        onChange={() =>
                          togglePermission("sales_user", module.key)
                        }
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Changes apply to all Accountant and Sales User accounts under this
              company after saving.
            </p>

            {isDirty ? (
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
                <Info size={14} />
                Unsaved changes
              </p>
            ) : (
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 size={14} />
                Saved
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ icon, label, className }) {
  return (
    <span
      className={`inline-flex items-center justify-center gap-1 rounded-full border px-3 py-1 text-xs font-bold shadow-sm ${className}`}
    >
      {icon}
      {label}
    </span>
  );
}

function LegendBadge({ icon, label, className }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold shadow-sm ${className}`}
    >
      {icon}
      {label}
    </span>
  );
}

function PermissionToggle({ checked, disabled = false, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-7 w-12 items-center rounded-full p-1 shadow-sm outline-none ring-0 transition-all duration-200 focus:outline-none focus:ring-0 active:ring-0 disabled:cursor-not-allowed disabled:opacity-60 ${
        checked
          ? "bg-blue-600 dark:bg-blue-500"
          : "bg-slate-300 dark:bg-slate-700"
      }`}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default RolePermissions;
