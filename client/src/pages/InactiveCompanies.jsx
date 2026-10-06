import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import toast from "react-hot-toast";

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
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-orange-700 dark:text-orange-300">
              <AlertTriangle size={17} />
              Inactive Company Detection
            </div>

            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Inactive Companies
            </h1>

            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              Track companies with no recent platform activity.
            </p>
          </div>

          <div className="flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <CalendarDays
              size={16}
              className="text-orange-600 dark:text-orange-300"
            />
            Total: {total}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Company Activity List
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                Active, warning, inactive and never active companies.
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
                  className="input !pl-10"
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
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease, color 0.2s ease;
        }

        .input::placeholder {
          color: #94a3b8;
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

        button:focus,
        button:focus-visible {
          outline: none;
          box-shadow: none;
        }
      `}</style>
    </div>
  );
}

function InactiveCompaniesTable({ companies, loading, onView }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-sm">
        <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <tr>
            {[
              "Company",
              "Contact",
              "Last Activity",
              "Inactive Days",
              "Activity Status",
              "Company Status",
              "Action",
            ].map((head) => (
              <th
                key={head}
                className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {loading && (
            <tr>
              <td colSpan="7" className="p-10 text-center">
                <div className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <Loader2
                    size={18}
                    className="animate-spin text-blue-600 dark:text-blue-400"
                  />
                  Loading companies...
                </div>
              </td>
            </tr>
          )}

          {!loading &&
            companies.map((company) => (
              <tr
                key={company.id}
                className="border-t border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70"
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-blue-50 p-3 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                      <Building2 size={18} />
                    </div>

                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-slate-900 dark:text-white">
                        {company.name || "-"}
                      </h3>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        ID: {company.id}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="p-4 font-medium text-slate-600 dark:text-slate-300">
                  <p>{company.email || "-"}</p>
                  <p>{company.phone || "-"}</p>
                </td>

                <td className="p-4 font-medium text-slate-600 dark:text-slate-300">
                  {company.last_activity_at
                    ? new Date(company.last_activity_at).toLocaleString()
                    : "Never"}
                </td>

                <td className="p-4 font-semibold text-slate-700 dark:text-slate-200">
                  {company.inactive_days !== null
                    ? `${company.inactive_days} days`
                    : "-"}
                </td>

                <td className="p-4">
                  <ActivityBadge status={company.inactivity_status} />
                </td>

                <td className="p-4">
                  <CompanyStatusBadge status={company.status} />
                </td>

                <td className="p-4">
                  <button
                    type="button"
                    onClick={() => onView(company)}
                    className="inline-flex items-center justify-center rounded-xl border border-blue-100 bg-blue-50 p-2 text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
                  >
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            ))}

          {!loading && companies.length === 0 && (
            <tr>
              <td colSpan="7" className="p-10 text-center">
                <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800">
                  <Building2
                    className="mx-auto text-slate-400 dark:text-slate-500"
                    size={34}
                  />
                  <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                    No companies found
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
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

function StatsCard({ title, value, icon, color }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <h2 className="mt-1 truncate text-2xl font-semibold text-slate-900 dark:text-white">
            {value}
          </h2>
        </div>

        <div className={`shrink-0 rounded-xl p-3 ${color}`}>{icon}</div>
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
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold shadow-sm ${
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
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize shadow-sm ${
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
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-blue-950/50"
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
  return (
    <div className="fixed inset-0 z-[60000] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.45)] dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
              <AlertTriangle size={28} />
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold text-slate-900 dark:text-white">
                {company.name || "-"}
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                Company inactivity details
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
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
    </div>
  );
}

function ViewField({ label, value }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </p>
      <div className="min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {value || "-"}
      </div>
    </div>
  );
}

function CustomDropdown({ value, onChange, options, icon }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    const closeDropdown = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeDropdown);
    return () => document.removeEventListener("mousedown", closeDropdown);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:focus:ring-blue-950/50"
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon && (
            <span className="text-slate-400 dark:text-slate-500">{icon}</span>
          )}
          <span className="truncate">{selected?.label || "Select"}</span>
        </span>

        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-500 transition dark:text-slate-400 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-[9999] w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {options.map((option) => {
            const active = value === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800 dark:hover:text-blue-300 ${
                  active
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    : "text-slate-700 dark:text-slate-200"
                }`}
              >
                {option.label}
                {active && <CheckCircle2 size={16} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default InactiveCompanies;
