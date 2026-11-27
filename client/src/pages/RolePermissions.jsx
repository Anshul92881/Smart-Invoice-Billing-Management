import { useEffect, useMemo, useRef, useState } from "react";
import {
  ShieldCheck,
  Save,
  RotateCcw,
  Lock,
  CheckCircle2,
  Loader2,
  Info,
  Search,
  Users,
  BriefcaseBusiness,
  SlidersHorizontal,
  X,
} from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";
// 1. Modules displayed in the permission table.
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
// 2. Default role access. These permissions must always remain enabled.
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
  // Page data and loading states.
  const [permissions, setPermissions] = useState(getEmptyPermissions);
  const [initialPermissions, setInitialPermissions] =
    useState(getEmptyPermissions);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const saveLock = useRef(false);
  // Filter the table only; searching does not change saved permissions.
  const visibleModules = MODULES.filter((module) =>
    (module.label + " " + module.description)
      .toLowerCase()
      .includes(search.toLowerCase().trim()),
  );
  // Compare edited values with the last values returned by the server.
  const isDirty = useMemo(() => {
    return JSON.stringify(permissions) !== JSON.stringify(initialPermissions);
  }, [permissions, initialPermissions]);
  // Count default + optional modules for each role.
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
  // Load existing company-level permissions.
  const fetchPermissions = async () => {
    try {
      setLoading(true);
      setLoadError("");
      const res = await api.get("/companies/role-permissions");
      const nextPermissions = normalizePermissions(res.data?.permissions);
      setPermissions(nextPermissions);
      setInitialPermissions(nextPermissions);
    } catch (error) {
      setLoadError(
        error.response?.data?.message || "Failed to load role permissions",
      );
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
  // Small checks used by the table and the toggle handler.
  const isBasePermission = (role, key) => {
    return Boolean(BASE_PERMISSIONS[role]?.[key]);
  };
  const hasPermission = (role, key) => {
    return Boolean(BASE_PERMISSIONS[role]?.[key] || permissions[role]?.[key]);
  };
  // Update the local draft. The server changes only after Save is clicked.
  const togglePermission = (role, key) => {
    if (isBasePermission(role, key) || saving || loading || loadError) return;
    setPermissions((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [key]: !prev[role]?.[key],
      },
    }));
  };
  // Save the same payload as before, then refresh the signed-in user.
  const handleSave = async () => {
    if (saveLock.current || loading || loadError) return;
    if (!isDirty) {
      toast("No permission changes to save");
      return;
    }
    try {
      saveLock.current = true;
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
      saveLock.current = false;
      setSaving(false);
    }
  };
  // Clear optional access in the draft. Locked defaults are not removed.
  const resetOptional = () => {
    if (saving || loading || loadError) return;
    setPermissions(getEmptyPermissions());
  };
  // Values used for role cards and table columns.
  const roles = [
    {
      key: "accountant",
      label: "Accountant",
      count: stats.accountantCount,
      optional: stats.optionalAccountant,
      icon: BriefcaseBusiness,
      tone: "blue",
    },
    {
      key: "sales_user",
      label: "Sales User",
      count: stats.salesCount,
      optional: stats.optionalSales,
      icon: Users,
      tone: "violet",
    },
  ];
  const shownRoles = roles.filter(
    (role) => roleFilter === "all" || role.key === roleFilter,
  );
  const unavailable = loading || saving || Boolean(loadError);
  const summaryUnavailable = loading || Boolean(loadError);

  // Plain if/else reads more easily than a deeply nested conditional in JSX.
  let saveStatus = "All changes saved";
  if (loading) saveStatus = "Loading…";
  else if (loadError) saveStatus = "Not loaded";
  else if (isDirty) saveStatus = "Unsaved changes";

  const saveStatusColor = isDirty
    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
    : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";

  // Page layout. Small presentational components are defined below the page.
  return (
    <div className="min-w-0 space-y-6 text-[15px] text-slate-700 dark:text-slate-200">
      <header className="flex flex-col justify-between gap-4 py-1 xl:flex-row xl:items-center">
        <div className="flex items-start gap-4">
          <div>
            <p className="mb-1 text-sm font-medium text-slate-600 dark:text-blue-300">
              Settings / Access control
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Role Permissions
            </h1>
            <p className="mt-2 text-[15px] text-slate-500 dark:text-slate-400">
              Manage module access for your company’s Accountants and Sales
              Users.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={unavailable}
            onClick={resetOptional}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 font-medium transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <RotateCcw size={18} />
            Reset Optional
          </button>
          <button
            type="button"
            disabled={unavailable || !isDirty}
            onClick={handleSave}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 font-medium text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}{" "}
            {saving ? "Saving…" : "Save Permissions"}
          </button>
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-5 border-b border-slate-200 p-5 sm:p-6 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Permission Matrix
              </h2>
              <p className="mt-1 text-[15px] text-slate-500 dark:text-slate-400">
                Choose the modules each role can access.
              </p>
            </div>
            <span
              role="status"
              className={
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium " +
                saveStatusColor
              }
            >
              {isDirty ? <Info size={16} /> : <CheckCircle2 size={16} />}
              {saveStatus}
            </span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search
                size={19}
                className="pointer-events-none absolute left-3.5 top-3 text-slate-400"
              />
              <input
                aria-label="Search modules"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search modules…"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-10 text-[15px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-blue-900"
              />
              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-2 rounded-lg p-1.5 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800"
                >
                  <X size={17} />
                </button>
              )}
            </div>
            <div className="relative">
              <SlidersHorizontal
                size={18}
                className="pointer-events-none absolute left-3 top-3.5 text-slate-400"
              />
              <select
                aria-label="Filter role"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="!font-normal h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-8 text-[15px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-52 dark:border-slate-700 dark:bg-slate-950"
              >
                <option className="!font-normal" value="all">
                  All roles
                </option>
                <option className="!font-normal" value="accountant">
                  Accountant
                </option>
                <option className="!font-normal" value="sales_user">
                  Sales User
                </option>
              </select>
            </div>
          </div>
        </div>
        {loading ? (
          <div
            role="status"
            className="flex items-center justify-center gap-3 p-16"
          >
            <Loader2 size={23} className="animate-spin text-blue-600" />
            Loading role permissions…
          </div>
        ) : loadError ? (
          <div role="alert" className="space-y-4 p-8 text-center">
            <p className="text-red-600 dark:text-red-300">{loadError}</p>
            <button
              type="button"
              onClick={fetchPermissions}
              className="rounded-xl bg-blue-600 px-5 py-2.5 font-medium text-white"
            >
              Try again
            </button>
          </div>
        ) : (
          <div
            tabIndex={0}
            aria-label="Permission table, scroll horizontally on small screens"
            className="overflow-x-auto focus-visible:outline-blue-500"
          >
            <table className="w-full min-w-[680px] text-[15px]">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950/70 dark:text-slate-300">
                <tr className="border-b border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
                  <th
                    scope="col"
                    className="w-[40%] whitespace-nowrap px-6 py-4 text-left text-sm font-semibold"
                  >
                    Module
                  </th>

                  <th
                    scope="col"
                    className="whitespace-nowrap px-4 py-4 text-center text-sm font-semibold"
                  >
                    Company Admin
                  </th>

                  {shownRoles.map((role) => (
                    <th
                      scope="col"
                      key={role.key}
                      className="whitespace-nowrap px-4 py-4 text-center text-sm font-semibold"
                    >
                      {role.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibleModules.map((module) => (
                  <tr
                    key={module.key}
                    className="transition-colors hover:bg-blue-50/40 dark:hover:bg-slate-800/60"
                  >
                    <th scope="row" className="px-5 py-4 text-left font-normal">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {module.label}
                      </p>
                      <p className="mt-1 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {module.description}
                      </p>
                    </th>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                        <Lock size={15} />
                        Full access
                      </span>
                    </td>
                    {shownRoles.map((role) => (
                      <td key={role.key} className="px-4 py-4 text-center">
                        {isBasePermission(role.key, module.key) ? (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                            title="Default access is locked"
                          >
                            <Lock size={15} />
                            Default
                          </span>
                        ) : (
                          <PermissionToggle
                            label={role.label + ": " + module.label}
                            checked={hasPermission(role.key, module.key)}
                            disabled={saving}
                            onChange={() =>
                              togglePermission(role.key, module.key)
                            }
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                {visibleModules.length === 0 && (
                  <tr>
                    <td
                      colSpan={2 + shownRoles.length}
                      className="p-12 text-center text-slate-500"
                    >
                      No modules match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
          <span>
            {visibleModules.length} of {MODULES.length} modules
          </span>
          <span className="inline-flex items-center gap-2">
            <Lock size={15} />
            Default access stays protected
          </span>
        </footer>
      </section>
    </div>
  );
}

// A reusable accessible switch. The parent decides whether it may be changed.
function PermissionToggle({ label, checked, disabled, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className="inline-flex min-h-11 items-center justify-center gap-2.5 rounded-lg px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        aria-hidden="true"
        className={
          "inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors " +
          (checked ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600")
        }
      >
        <span
          className={
            "h-5 w-5 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none " +
            (checked ? "translate-x-5" : "translate-x-0")
          }
        />
      </span>
      <span
        className={
          "text-sm font-medium " +
          (checked
            ? "text-blue-700 dark:text-blue-300"
            : "text-slate-500 dark:text-slate-400")
        }
      >
        {checked ? "Enabled" : "Disabled"}
      </span>
    </button>
  );
}
export default RolePermissions;
