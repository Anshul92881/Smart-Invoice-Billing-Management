import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import toast from "react-hot-toast";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Building2,
  Search,
  Filter,
  Eye,
  X,
  Clock,
  ChevronDown,
  CheckCircle2,
  XCircle,
  CalendarDays,
  Loader2,
} from "lucide-react";
function InactiveCompanies() {
  const [companies, setCompanies] = useState([]);
  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState("all");
  const [viewCompany, setViewCompany] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statsData, setStatsData] = useState({
    total: 0,
    warning: 0,
    inactive: 0,
    never: 0,
  });
  const fetchInactiveCompanies = async () => {
    try {
      setLoading(true);
      const baseParams = {
        search,
      };
      const [listRes, allRes, warningRes, inactiveRes, neverRes] =
        await Promise.all([
          api.get("/companies/inactive-companies", {
            params: {
              ...baseParams,
              page: currentPage,
              limit,
              bucket,
            },
          }),
          api.get("/companies/inactive-companies", {
            params: {
              ...baseParams,
              page: 1,
              limit: 1,
              bucket: "all",
            },
          }),
          api.get("/companies/inactive-companies", {
            params: {
              ...baseParams,
              page: 1,
              limit: 1,
              bucket: "warning",
            },
          }),
          api.get("/companies/inactive-companies", {
            params: {
              ...baseParams,
              page: 1,
              limit: 1,
              bucket: "inactive",
            },
          }),
          api.get("/companies/inactive-companies", {
            params: {
              ...baseParams,
              page: 1,
              limit: 1,
              bucket: "never",
            },
          }),
        ]);
      setCompanies(listRes.data.companies || []);
      setTotal(listRes.data.total || 0);
      setTotalPages(listRes.data.totalPages || 1);
      setStatsData({
        total: allRes.data.total || 0,
        warning: warningRes.data.total || 0,
        inactive: inactiveRes.data.total || 0,
        never: neverRes.data.total || 0,
      });
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to fetch inactive companies",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchInactiveCompanies();
  }, [currentPage, limit, search, bucket]);
  const stats = statsData;
  return (
    <div className="w-full min-w-0 space-y-5 overflow-x-hidden">
      <div className="px-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <AlertTriangle size={17} />
              Workspace / Inactive Companies
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Inactive Companies
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Track companies with no recent platform activity.
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Companies"
          value={stats.total}
          icon={<Building2 size={20} />}
          color="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
        />
        <StatsCard
          title="Warning"
          value={stats.warning}
          icon={<Clock size={20} />}
          color="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
        />
        <StatsCard
          title="Inactive"
          value={stats.inactive}
          icon={<XCircle size={20} />}
          color="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        />
        <StatsCard
          title="Never Active"
          value={stats.never}
          icon={<AlertTriangle size={20} />}
          color="bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
        />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Company Activity List
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Current company records and platform activity status.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative w-full sm:w-80">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search company/email/phone"
                  className="inactive-company-input !pl-10"
                />
              </div>
              <div className="w-full sm:w-52">
                <CustomDropdown
                  value={bucket}
                  onChange={(value) => {
                    setBucket(value);
                    setCurrentPage(1);
                  }}
                  icon={<Filter size={16} />}
                  options={[
                    { value: "all", label: "All Companies" },
                    { value: "warning", label: "Warning" },
                    { value: "inactive", label: "Inactive" },
                    { value: "never", label: "Never Active" },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
        <InactiveCompaniesTable
          companies={companies}
          loading={loading}
          onView={setViewCompany}
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
      {viewCompany && (
        <CompanyViewModal
          company={viewCompany}
          onClose={() => setViewCompany(null)}
        />
      )}
      <style>{`
        .inactive-company-input {
          width: 100%;
          border: 1px solid #cbd5e1;
          padding: 10px 12px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 400;
          outline: none;
          background: #ffffff;
          color: #334155;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease, color 0.2s ease;
        }
        .inactive-company-input::placeholder {
          color: #94a3b8;
        }
        .inactive-company-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px #dbeafe;
        }
        .dark .inactive-company-input {
          border-color: #334155;
          background: #0f172a;
          color: #e2e8f0;
        }
        .dark .inactive-company-input::placeholder {
          color: #64748b;
        }
        .dark .inactive-company-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.35);
        }
      `}</style>
    </div>
  );
}

function InactiveCompaniesTable({ companies, loading, onView }) {
  return (
    <div className="w-full min-w-0">
      <table className="w-full table-fixed text-left text-sm">
        <colgroup>
          {[21, 21, 20, 15, 18, 17, 8].map((width, index) => (
            <col key={index} style={{ width: `${width}%` }} />
          ))}
        </colgroup>

        <thead className="bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
          <tr>
            {[
              "Company",
              "Contact",
              "Last Activity",
              "Inactive Days",
              "Activity Status",
              "Company Status",
              "Action",
            ].map((head, index) => (
              <th
                key={head}
                scope="col"
                className={`px-3 py-3 font-semibold leading-5 ${
                  index >= 3 ? "text-center" : "text-left"
                } ${index === 0 ? "pl-5" : ""}`}
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan={7} className="p-10 text-center">
                <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
                  <Loader2 size={18} className="animate-spin text-blue-600" />
                  Loading companies...
                </div>
              </td>
            </tr>
          ) : companies.length > 0 ? (
            companies.map((company) => (
              <tr
                key={company.id}
                className="border-t border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70"
              >
                <td className="py-3 pl-5 pr-3 align-middle">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 xl:flex">
                      <Building2 size={18} />
                    </span>

                    <p className="min-w-0 font-semibold leading-5 text-slate-900 [overflow-wrap:anywhere] dark:text-white">
                      {company.name || "-"}
                    </p>
                  </div>
                </td>

                <td className="px-3 py-3 align-middle text-slate-600 dark:text-slate-300">
                  <div className="space-y-1 leading-5">
                    <p className="[overflow-wrap:anywhere]">
                      {company.email || "-"}
                    </p>
                    <p className="[overflow-wrap:anywhere]">
                      {company.phone || "-"}
                    </p>
                  </div>
                </td>

                <td className="px-3 py-3 align-middle leading-5 text-slate-600 dark:text-slate-300">
                  {company.last_activity_at
                    ? new Date(company.last_activity_at).toLocaleString()
                    : "Never"}
                </td>

                <td className="px-3 py-3 text-center align-middle font-medium text-slate-700 dark:text-slate-200">
                  {company.inactive_days != null
                    ? `${company.inactive_days} days`
                    : "-"}
                </td>

                <td className="px-3 py-3 text-center align-middle">
                  <div className="flex justify-center [&>span]:max-w-full [&>span]:items-center [&>span]:justify-center [&>span]:text-center [&>span]:leading-5">
                    <ActivityBadge status={company.inactivity_status} />
                  </div>
                </td>

                <td className="px-3 py-3 text-center align-middle">
                  <div className="flex justify-center [&>span]:max-w-full [&>span]:items-center [&>span]:justify-center [&>span]:text-center [&>span]:leading-5">
                    <CompanyStatusBadge status={company.status} />
                  </div>
                </td>

                <td className="px-2 py-3 text-center align-middle">
                  <button
                    type="button"
                    aria-label="View company"
                    title="View company"
                    onClick={() => onView(company)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
                  >
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="p-10 text-center">
                <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800">
                  <Building2 size={34} className="mx-auto text-slate-400" />

                  <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                    No companies found
                  </p>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Try changing search or filter.
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

// Compact summary cards follow the same layout as the Admins module.
function StatsCard({ title, value, icon, color }) {
  const tones = {
    "Total Companies":
      "border-blue-200 from-blue-50 dark:border-blue-900/50 dark:from-blue-950/30",
    Warning:
      "border-amber-200 from-amber-50 dark:border-amber-900/50 dark:from-amber-950/30",
    Inactive:
      "border-red-200 from-red-50 dark:border-red-900/50 dark:from-red-950/30",
    "Never Active":
      "border-purple-200 from-purple-50 dark:border-purple-900/50 dark:from-purple-950/30",
  };

  return (
    <div
      className={`flex min-w-0 items-center gap-3 rounded-2xl border bg-gradient-to-br to-white p-4 shadow-sm dark:to-slate-900 ${tones[title] || "border-slate-200 from-slate-50 dark:border-slate-800"}`}
    >
      <span className={`shrink-0 rounded-xl p-3 ${color}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
        <h2 className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
          {value}
        </h2>
      </div>
    </div>
  );
}
function ActivityBadge({ status }) {
  const value = String(status || "").toLowerCase();
  const styles = {
    active:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    warning:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
    inactive:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
    never_active:
      "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-300",
  };
  const labels = {
    active: "Active",
    warning: "Warning",
    inactive: "Inactive",
    never_active: "Never Active",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-sm font-semibold shadow-sm ${
        styles[value] ||
        "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      }`}
    >
      {labels[value] || status || "-"}
    </span>
  );
}

function CompanyStatusBadge({ status }) {
  const isActive = status === "active";
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-sm font-semibold capitalize shadow-sm ${
        isActive
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
      }`}
    >
      {status || "inactive"}
    </span>
  );
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
    <div className="flex flex-col gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
        Total Companies:{" "}
        <span className="text-slate-900 dark:text-white">{total}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={limit}
          onChange={(e) => {
            setLimit(Number(e.target.value));
            setCurrentPage(1);
          }}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-blue-950/50"
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
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Prev
        </button>
        <span className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          Page {currentPage} of {totalPages || 1}
        </span>
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() =>
            setCurrentPage((prev) => Math.min(prev + 1, totalPages))
          }
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Next
        </button>
      </div>
    </div>
  );
}
function CompanyViewModal({ company, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[60000] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between shrink-0 border-b border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <AlertTriangle size={28} />
            </div>
            <div className="min-w-0">
              <h2 className="break-words text-xl font-semibold text-slate-900 dark:text-white">
                {company.name || "-"}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Company inactivity details
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close company details"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <div className="grid min-h-0 grid-cols-1 gap-4 overflow-y-auto p-5 md:grid-cols-2">
          <ViewField label="Company Name" value={company.name} />
          <ViewField label="Email" value={company.email} />
          <ViewField label="Phone" value={company.phone} />
          <ViewField
            label="Branch Limit"
            value={
              company.branch_limit !== null &&
              company.branch_limit !== undefined
                ? company.branch_limit
                : "Default (2)"
            }
          />
          <ViewField
            label="Last Activity"
            value={
              company.last_activity_at
                ? new Date(company.last_activity_at).toLocaleString()
                : "Never"
            }
          />
          <ViewField
            label="Inactive Days"
            value={
              company.inactive_days !== null
                ? `${company.inactive_days} days`
                : "-"
            }
          />
          <ViewField
            label="Activity Status"
            value={<ActivityBadge status={company.inactivity_status} />}
          />
          <ViewField
            label="Company Status"
            value={<CompanyStatusBadge status={company.status} />}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
function ViewField({ label, value }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </p>
      <div className="min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 break-words text-sm font-normal text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {value ?? "-"}
      </div>
    </div>
  );
}
function CustomDropdown({ value, onChange, options, icon }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const selected = options.find(
    (option) => String(option.value) === String(value),
  );

  useEffect(() => {
    if (!open) return;
    const positionMenu = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(rect.width, window.innerWidth - 24);
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const openAbove = below < 240 && above > below;
      setMenuStyle({
        position: "fixed",
        width,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        ...(openAbove
          ? { bottom: window.innerHeight - rect.top + 6 }
          : { top: rect.bottom + 6 }),
        maxHeight: Math.max(40, Math.min(256, (openAbove ? above : below) - 6)),
        zIndex: 70000,
      });
    };
    const handleOutsideClick = (event) => {
      if (
        !buttonRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus({ preventScroll: true });
      }
    };
    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-normal text-slate-700 outline-none transition hover:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
          <span className="truncate">{selected?.label || "Select"}</span>
        </span>
        <ChevronDown
          size={17}
          className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className="overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
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
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-normal transition ${active ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white" : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"}`}
                >
                  <span>{option.label}</span>
                  {active && <CheckCircle2 size={16} className="shrink-0" />}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
export default InactiveCompanies;
