import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import toast from "react-hot-toast";
import {
  Activity,
  Search,
  ShieldCheck,
  User,
  Building2,
  Clock,
  Download,
  RotateCcw,
  Globe,
  Monitor,
  Filter,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  Plus,
  LogOut,
  AlertTriangle,
  Eye,
  X,
  ChevronDown,
} from "lucide-react";
function AuditLogs() {
  const defaultFilters = {
    search: "",
    action: "",
    module_name: "",
    from_date: "",
    to_date: "",
    limit: 20,
  };
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [loading, setLoading] = useState(false);
  const [viewLog, setViewLog] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const actionOptions = [
    { value: "", label: "All Actions" },
    { value: "LOGIN_SUCCESS", label: "Login Success" },
    { value: "LOGIN_FAILED", label: "Login Failed" },
    { value: "LOGOUT", label: "Logout" },
    { value: "CREATE", label: "Create" },
    { value: "UPDATE", label: "Update" },
    { value: "DELETE", label: "Delete" },
    { value: "DEACTIVATE", label: "Deactivate" },
    { value: "CANCEL", label: "Cancel" },
    { value: "CONVERT", label: "Convert" },
    { value: "SECURITY_EVENT", label: "Security Event" },
  ];
  const moduleOptions = [
    { value: "", label: "All Modules" },
    { value: "Auth", label: "Authentication" },
    { value: "Company", label: "Company" },
    { value: "User", label: "Users / Admins" },
    { value: "Branch", label: "Branch" },
    { value: "Customer", label: "Customer" },
    { value: "Product", label: "Product" },
    { value: "Invoice", label: "Invoice" },
    { value: "Payment", label: "Payment" },
    { value: "Quotation", label: "Quotation" },
    { value: "Expense", label: "Expense" },
    { value: "Vendor", label: "Vendor" },
    { value: "Tax", label: "Tax / GST" },
    { value: "Subscription", label: "Subscription" },
  ];
  const fetchLogs = async (customFilters = filters, customPage = page) => {
    try {
      setLoading(true);
      const res = await api.get("/audit-logs", {
        params: {
          ...customFilters,
          page: customPage,
          limit: customFilters.limit || 20,
        },
      });
      if (Array.isArray(res.data)) {
        setLogs(res.data);
        setPagination({
          page: 1,
          limit: res.data.length,
          total: res.data.length,
          totalPages: 1,
        });
      } else {
        setLogs(res.data.logs || []);
        setPagination(
          res.data.pagination || {
            page: customPage,
            limit: customFilters.limit || 20,
            total: 0,
            totalPages: 1,
          },
        );
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to fetch audit logs",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchLogs(defaultFilters);
  }, []);
  const updateFilter = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  };
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    updateFilter(name, value);
  };
  const resetFilters = () => {
    setFilters(defaultFilters);
    setPage(1);
    fetchLogs(defaultFilters, 1);
  };
  const handleExportCSV = async () => {
    try {
      const res = await api.get("/audit-logs/export/csv", {
        params: filters,
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "audit-logs.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Audit logs exported successfully");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to export audit logs",
      );
    }
  };
  const formatLabel = (value) => {
    if (!value) return "-";
    return String(value)
      .toLowerCase()
      .replaceAll("_", " ")
      .split(" ")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };
  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  const getActionClass = (logAction) => {
    switch (logAction?.toUpperCase()) {
      case "CREATE":
        return "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300";
      case "UPDATE":
        return "border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300";
      case "DELETE":
      case "DEACTIVATE":
        return "border border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300";
      case "CONVERT":
        return "border border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-300";
      case "CANCEL":
        return "border border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300";
      case "LOGIN_SUCCESS":
        return "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300";
      case "LOGIN_FAILED":
        return "border border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300";
      case "LOGOUT":
        return "border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";
      case "SECURITY_EVENT":
        return "border border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300";
      default:
        return "border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";
    }
  };
  const getActionIcon = (action) => {
    switch (action?.toUpperCase()) {
      case "CREATE":
        return <Plus size={14} />;
      case "UPDATE":
        return <Pencil size={14} />;
      case "DELETE":
      case "DEACTIVATE":
        return <Trash2 size={14} />;
      case "LOGIN_SUCCESS":
        return <CheckCircle2 size={14} />;
      case "LOGIN_FAILED":
        return <XCircle size={14} />;
      case "LOGOUT":
        return <LogOut size={14} />;
      case "SECURITY_EVENT":
        return <AlertTriangle size={14} />;
      default:
        return <Activity size={14} />;
    }
  };
  return (
    <div className="w-full min-w-0 space-y-5 overflow-x-hidden text-slate-900 dark:text-slate-100">
      <div className="px-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              <ShieldCheck size={17} />
              Workspace / Audit Logs
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Activity History
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Track login, logout, user actions, module updates and security
              activities.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <Activity size={16} />
              {pagination.total || 0} Audit Logs
            </div>
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Recent Activities
                </h2>
              </div>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                Latest user and system activity records.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(190px,1.5fr)_minmax(130px,1fr)_minmax(130px,1fr)_minmax(145px,1fr)_minmax(145px,1fr)_auto_auto]">
              <div className="relative min-w-0 sm:col-span-2 xl:col-span-1">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                />
                <input
                  type="text"
                  name="search"
                  placeholder="Search user, company, IP..."
                  value={filters.search}
                  onChange={handleFilterChange}
                  className="input !pl-10"
                />
              </div>
              <CustomSelect
                value={filters.action}
                onChange={(value) => updateFilter("action", value)}
                options={actionOptions}
                placeholder="All Actions"
                searchable
              />
              <CustomSelect
                value={filters.module_name}
                onChange={(value) => updateFilter("module_name", value)}
                options={moduleOptions}
                placeholder="All Modules"
                searchable
              />
              <input
                type="date"
                name="from_date"
                value={filters.from_date}
                onChange={handleFilterChange}
                className="input"
              />
              <input
                type="date"
                name="to_date"
                value={filters.to_date}
                onChange={handleFilterChange}
                className="input"
              />
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  fetchLogs(filters, 1);
                }}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Filter size={15} />
                {loading ? "Loading..." : "Apply"}
              </button>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
              >
                <RotateCcw size={15} />
                Reset
              </button>
            </div>
          </div>
        </div>
        <AuditTable
          logs={logs}
          formatDate={formatDate}
          formatLabel={formatLabel}
          getActionClass={getActionClass}
          getActionIcon={getActionIcon}
          setViewLog={setViewLog}
        />
        <PaginationControls
          page={page}
          setPage={setPage}
          pagination={pagination}
          filters={filters}
          fetchLogs={fetchLogs}
        />
      </div>
      {viewLog && (
        <LogViewModal
          log={viewLog}
          formatDate={formatDate}
          formatLabel={formatLabel}
          getActionClass={getActionClass}
          getActionIcon={getActionIcon}
          onClose={() => setViewLog(null)}
        />
      )}
      <style>{`
        .input {
          width: 100%;
          border: 1px solid #cbd5e1;
          padding: 10px 12px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          outline: none;
          background: #ffffff;
          color: #334155;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
        }
        .input::placeholder {
          color: #94a3b8;
          font-weight: 400;
        }
        .input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px #dbeafe;
        }
        .dark .input {
          border-color: #334155;
          background: #0f172a;
          color: #e2e8f0;
        }
        .dark .input::placeholder {
          color: #64748b;
        }
        .dark .input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.35);
        }
        .input[type="date"]::-webkit-calendar-picker-indicator {
          opacity: 0.65;
        }
        .dark .input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(1);
          opacity: 0.75;
        }
      `}</style>
    </div>
  );
}
function AuditTable({
  logs,
  formatDate,
  formatLabel,
  getActionClass,
  getActionIcon,
  setViewLog,
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[1180px] text-left text-sm [&_th]:whitespace-nowrap [&_td:not(:nth-child(7))]:whitespace-nowrap">
        <thead className="border-b border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/40">
          <tr>
            {[
              "Date",
              "User",
              "Role",
              "Company",
              "Module",
              "Action",
              "Description",
              "IP / Device",
              "View",
            ].map((head) => (
              <th
                key={head}
                scope="col"
                className="whitespace-nowrap px-4 py-4 text-left text-sm font-semibold text-blue-800 first:pl-5 last:pr-5 dark:text-blue-200"
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr
              key={log.id}
              className="border-t border-slate-100 align-top transition hover:bg-blue-50/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <td className="whitespace-nowrap p-4 font-medium text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <Clock size={15} />
                  {formatDate(log.created_at)}
                </div>
              </td>
              <td className="whitespace-nowrap p-4">
                <div className="flex items-start gap-2">
                  <div className="rounded-lg bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                    <User size={15} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {log.user_name || "-"}
                    </p>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {log.user_email || ""}
                    </p>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap p-4">
                <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {formatLabel(log.role)}
                </span>
              </td>
              <td className="whitespace-nowrap p-4 font-medium text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <Building2
                    size={15}
                    className="text-slate-400 dark:text-slate-500"
                  />
                  {log.company_name || "-"}
                </div>
              </td>
              <td className="whitespace-nowrap p-4 font-semibold text-slate-900 dark:text-white">
                {formatLabel(log.module_name)}
              </td>
              <td className="whitespace-nowrap p-4">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${getActionClass(
                    log.action,
                  )}`}
                >
                  {getActionIcon(log.action)}
                  {formatLabel(log.action)}
                </span>
              </td>
              <td className="w-[320px] min-w-[320px] p-4 font-medium text-slate-600 dark:text-slate-300">
                <p className="w-[288px] whitespace-normal break-words leading-6 [overflow-wrap:anywhere]">
                  {log.description || "-"}
                </p>
              </td>
              <td className="p-4 text-sm font-normal text-slate-600 dark:text-slate-300">
                <div className="space-y-1">
                  <p className="flex items-center gap-2">
                    <Globe size={14} />
                    {String(log.ip_address || "").trim() || "Not recorded"}
                  </p>
                  <p className="flex items-start gap-2">
                    <Monitor size={14} className="mt-0.5 shrink-0" />
                    <span
                      className="block max-w-[320px] truncate"
                      title={
                        String(log.user_agent || "").trim() ||
                        "Device not recorded"
                      }
                    >
                      {String(log.user_agent || "").trim() ||
                        "Device not recorded"}
                    </span>
                  </p>
                </div>
              </td>
              <td className="whitespace-nowrap p-4">
                <button
                  type="button"
                  onClick={() => setViewLog(log)}
                  className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
                >
                  <Eye size={14} />
                  View
                </button>
              </td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td colSpan="9" className="p-10 text-center">
                <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-950">
                  <Activity
                    className="mx-auto text-slate-400 dark:text-slate-500"
                    size={34}
                  />
                  <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                    No audit logs found
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                    Try changing filters or date range.
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
function PaginationControls({ page, setPage, pagination, filters, fetchLogs }) {
  const totalPages = pagination.totalPages || 1;
  const goToPage = (nextPage) => {
    if (nextPage < 1 || nextPage > totalPages) return;
    setPage(nextPage);
    fetchLogs(filters, nextPage);
  };
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
        Page {pagination.page || page} of {totalPages} · {pagination.total || 0}{" "}
        total logs
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => goToPage(page - 1)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => goToPage(page + 1)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Next
        </button>
      </div>
    </div>
  );
}
function LogViewModal({
  log,
  formatDate,
  formatLabel,
  getActionClass,
  getActionIcon,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-[50000] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.45)] dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              <Activity size={26} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Audit Log Details
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                Complete activity details and device information.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto overflow-x-hidden bg-white p-5 dark:bg-slate-900">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ViewField label="Date" value={formatDate(log.created_at)} />
            <ViewField
              label="Action"
              value={
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${getActionClass(
                    log.action,
                  )}`}
                >
                  {getActionIcon(log.action)}
                  {formatLabel(log.action)}
                </span>
              }
            />
            <ViewField label="Module" value={formatLabel(log.module_name)} />
            <ViewField label="Record ID" value={log.record_id || "-"} />
            <ViewField label="User Name" value={log.user_name || "-"} />
            <ViewField label="User Email" value={log.user_email || "-"} />
            <ViewField label="Role" value={formatLabel(log.role)} />
            <ViewField label="Company" value={log.company_name || "-"} />
            <ViewField
              label="IP Address"
              value={String(log.ip_address || "").trim() || "Not recorded"}
            />
            <ViewField
              label="Description"
              value={log.description || "-"}
              full
            />
            <ViewField
              label="User Agent / Device"
              value={
                String(log.user_agent || "").trim() || "Device not recorded"
              }
              full
            />
          </div>
        </div>
      </div>
    </div>
  );
}
function ViewField({ label, value, full = false }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </p>
      <div className="min-h-[44px] break-words rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {value || "-"}
      </div>
    </div>
  );
}
function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select",
  searchable = false,
}) {
  const [open, setOpen] = useState(false);
  const [selectSearch, setSelectSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const selected = options.find(
    (option) => String(option.value) === String(value),
  );
  const filteredOptions = options.filter((option) =>
    `${option.label || ""}`.toLowerCase().includes(selectSearch.toLowerCase()),
  );
  const updateDropdownPosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const dropdownHeight = searchable
      ? 330
      : Math.min(options.length * 46 + 20, 260);
    const dropdownWidth = Math.max(rect.width, 220);
    const left = Math.min(
      Math.max(12, rect.left),
      viewportWidth - dropdownWidth - 12,
    );
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < dropdownHeight + 12 && spaceAbove > spaceBelow;
    const top = openUp
      ? Math.max(12, rect.top - dropdownHeight - 8)
      : Math.min(rect.bottom + 8, viewportHeight - dropdownHeight - 12);
    setDropdownStyle({
      position: "fixed",
      left: `${left}px`,
      top: `${top}px`,
      width: `${dropdownWidth}px`,
      maxHeight: `${dropdownHeight}px`,
      zIndex: 99999,
    });
  };
  useEffect(() => {
    if (!open) return;
    updateDropdownPosition();
    const handleClickOutside = (event) => {
      if (
        buttonRef.current?.contains(event.target) ||
        dropdownRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
      setSelectSearch("");
    };
    const handleWindowMove = (event) => {
      if (dropdownRef.current?.contains(event.target)) {
        return;
      }
      updateDropdownPosition();
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", handleWindowMove, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", handleWindowMove, true);
    };
  }, [open, options.length, searchable]);
  const handleSelect = (selectedValue) => {
    onChange(selectedValue);
    setOpen(false);
    setSelectSearch("");
  };
  return (
    <div className="relative min-w-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          window.requestAnimationFrame(updateDropdownPosition);
        }}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-normal text-slate-700 shadow-sm outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:focus:ring-blue-950/50"
      >
        <span className="min-w-0 truncate">
          {selected?.label || placeholder}
        </span>
        <ChevronDown
          size={17}
          className={`shrink-0 text-slate-400 transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && dropdownStyle && (
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        >
          {searchable && (
            <div className="border-b border-slate-100 p-2 dark:border-slate-800">
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                />
                <input
                  type="text"
                  value={selectSearch}
                  onChange={(event) => setSelectSearch(event.target.value)}
                  placeholder="Search..."
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:bg-slate-900 dark:focus:ring-blue-950/50"
                />
              </div>
            </div>
          )}
          <div className="max-h-56 overflow-y-auto p-2">
            {filteredOptions.map((option) => {
              const active = String(option.value) === String(value);
              return (
                <button
                  key={option.value || "all"}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full rounded-xl px-3 py-2 text-left transition ${
                    active
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                      : "text-slate-700 hover:bg-blue-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="truncate text-sm font-normal">
                      {option.label}
                    </p>
                    {active && (
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
            {filteredOptions.length === 0 && (
              <div className="px-3 py-5 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                No option found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export default AuditLogs;
