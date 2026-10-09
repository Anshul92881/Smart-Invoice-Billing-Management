import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import CreateQuotation from "./CreateQuotation";
import {
  ChevronDown,
  CheckCircle2,
  ReceiptText,
  Building2,
  Plus,
  FileCheck,
  Eye,
  Ban,
  Filter,
  Search,
} from "lucide-react";

const ALLOWED_QUOTATION_STATUS = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "converted",
  "cancelled",
];

function Quotations() {
  const [quotations, setQuotations] = useState([]);
  const [branches, setBranches] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const user = JSON.parse(localStorage.getItem("user"));

  const canCreateQuotation =
    user?.role === "company_admin" ||
    user?.role === "sales_user" ||
    Boolean(user?.permissions?.quotations);

  const canManageQuotation = canCreateQuotation;

  const fetchQuotations = async () => {
    try {
      const [quotationRes, branchRes] = await Promise.all([
        api.get("/quotations", {
          params: {
            search: search.trim() || undefined,
            status: statusFilter,
            limit: 1000,
          },
        }),
        api.get("/branches", {
          params: {
            status: "active",
            limit: 1000,
          },
        }),
      ]);

      const quotationList = Array.isArray(quotationRes.data)
        ? quotationRes.data
        : quotationRes.data?.quotations || [];

      const branchList = Array.isArray(branchRes.data)
        ? branchRes.data
        : branchRes.data?.branches || [];

      setQuotations(quotationList);

      setBranches(
        branchList.filter(
          (branch) => branch.status === "active" || branch.status === 1,
        ),
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to fetch quotations",
      );
    }
  };

  useEffect(() => {
    fetchQuotations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filteredQuotations = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return quotations.filter((quotation) => {
      const quotationDate = getDateOnly(quotation.quotation_date);

      const matchesSearch =
        !keyword ||
        quotation.quotation_number?.toLowerCase().includes(keyword) ||
        quotation.customer_name?.toLowerCase().includes(keyword) ||
        quotation.company_name?.toLowerCase().includes(keyword) ||
        quotation.customer_email?.toLowerCase().includes(keyword) ||
        quotation.branch_name?.toLowerCase().includes(keyword) ||
        quotation.branch_code?.toLowerCase().includes(keyword) ||
        quotation.status?.toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === "all" || quotation.status === statusFilter;

      const matchesBranch =
        branchFilter === "all" ||
        String(quotation.branch_id || "") === String(branchFilter);

      const matchesFromDate = !fromDate || quotationDate >= fromDate;
      const matchesToDate = !toDate || quotationDate <= toDate;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesBranch &&
        matchesFromDate &&
        matchesToDate
      );
    });
  }, [quotations, search, statusFilter, branchFilter, fromDate, toDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, branchFilter, fromDate, toDate]);

  const sortedQuotations = useMemo(() => {
    return [...filteredQuotations].sort((a, b) => Number(b.id) - Number(a.id));
  }, [filteredQuotations]);

  const totalPages = Math.ceil(sortedQuotations.length / itemsPerPage);

  const paginatedQuotations = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedQuotations.slice(start, start + itemsPerPage);
  }, [sortedQuotations, currentPage, itemsPerPage]);

  const confirmToast = (message, onConfirm) => {
    toast(
      (t) => (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {message}
          </p>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              No
            </button>

            <button
              type="button"
              onClick={() => {
                toast.dismiss(t.id);
                onConfirm();
              }}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
            >
              Yes
            </button>
          </div>
        </div>
      ),
      { duration: 6000 },
    );
  };

  const handleCancel = async (quotation) => {
    if (!canManageQuotation) {
      toast.error("Quotation permission required");
      return;
    }

    if (quotation.status === "converted") {
      toast.error("Converted quotation cannot be cancelled");
      return;
    }

    if (quotation.status === "cancelled") {
      toast.error("Quotation already cancelled");
      return;
    }

    confirmToast("Cancel this quotation?", async () => {
      try {
        await api.patch(`/quotations/${quotation.id}/cancel`);
        toast.success("Quotation cancelled");
        fetchQuotations();
      } catch (error) {
        toast.error(
          error.response?.data?.message || "Failed to cancel quotation",
        );
      }
    });
  };

  return (
    <div className="w-full max-w-full min-w-0 space-y-5 overflow-x-hidden">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">

            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
                <ReceiptText size={16} />
                Quotation Management
              </div>

              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Quotations
              </h1>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Create, manage, print and convert quotations.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {sortedQuotations.length} Quotations
            </div>

            {canCreateQuotation && (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                <Plus size={16} />
                Create Quotation
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Quotation List
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                View, filter, print and cancel quotations.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Search quotation"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input !pl-10"
                />
              </div>

              <CustomDropdown
                value={statusFilter}
                onChange={setStatusFilter}
                icon={<Filter size={16} />}
                options={[
                  { value: "all", label: "All Status" },
                  ...ALLOWED_QUOTATION_STATUS.map((status) => ({
                    value: status,
                    label: toTitle(status),
                  })),
                ]}
              />

              <CustomDropdown
                value={branchFilter}
                onChange={setBranchFilter}
                icon={<Building2 size={16} />}
                options={[
                  { value: "all", label: "All Branches" },
                  ...branches.map((branch) => ({
                    value: String(branch.id),
                    label: `${branch.branch_name || "Branch"}${
                      branch.branch_code ? ` (${branch.branch_code})` : ""
                    }`,
                  })),
                ]}
              />

              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="input"
              />

              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="input"
              />
            </div>
          </div>
        </div>

        <QuotationTable
          quotations={paginatedQuotations}
          canManageQuotation={canManageQuotation}
          onCancel={handleCancel}
        />

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Rows per page
            </span>

            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-blue-950/50"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="text-sm text-slate-500 dark:text-slate-400">
            Showing{" "}
            {sortedQuotations.length === 0
              ? 0
              : (currentPage - 1) * itemsPerPage + 1}
            {" - "}
            {Math.min(currentPage * itemsPerPage, sortedQuotations.length)}
            {" of "}
            {sortedQuotations.length}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => prev - 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Prev
            </button>

            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {currentPage} / {totalPages || 1}
            </span>

            <button
              type="button"
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage((prev) => prev + 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showCreateModal && (
  <div className="fixed inset-0 z-[50000] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
    <div className="flex max-h-[92vh] w-full max-w-[92vw] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-2xl dark:border-slate-700 dark:bg-slate-950">
      <CreateQuotation
        modalMode
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          setShowCreateModal(false);
          fetchQuotations();
        }}
      />
    </div>
  </div>
)}

      <style>{`
        .input {
          width: 100%;
          border: 1px solid #cbd5e1;
          padding: 10px 12px;
          border-radius: 12px;
          font-size: 14px;
          outline: none;
          background: #ffffff;
          color: #334155;
        }

        .input::placeholder {
          color: #94a3b8;
        }

        .input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px #dbeafe;
        }

        .input:disabled {
          background: #f8fafc;
          cursor: not-allowed;
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

        .dark .input:disabled {
          background: #020617;
        }
      `}</style>
    </div>
  );
}

function QuotationTable({ quotations, canManageQuotation, onCancel }) {
  return (
    <div className="w-full max-w-full overflow-x-auto">
      <table className="w-full min-w-[1040px] text-sm">
        <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <tr>
            {[
              "Quotation No",
              "Branch",
              "Customer",
              "Date",
              "Expiry",
              "Total",
              "Status",
              "Actions",
            ].map((head) => (
              <th
                key={head}
                className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide"
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="bg-white dark:bg-slate-900">
          {quotations.map((q) => (
            <tr
              key={q.id}
              className="border-t border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900 dark:text-white">
                {q.quotation_number || "-"}
              </td>

              <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                {q.branch_code
                  ? `${q.branch_name || "-"} (${q.branch_code})`
                  : q.branch_name || "-"}
              </td>

              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  {q.customer_name || q.company_name || "-"}
                </p>
                {q.company_name && q.customer_name && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {q.company_name}
                  </p>
                )}
              </td>

              <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                {formatDate(q.quotation_date)}
              </td>

              <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                {formatDate(q.expiry_date)}
              </td>

              <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-900 dark:text-white">
                ₹ {Number(q.total_amount || 0).toFixed(2)}
              </td>

              <td className="whitespace-nowrap px-4 py-3">
                <StatusBadge status={q.status} />
              </td>

              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Link
                    to={`/dashboard/quotations/${q.id}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700 transition hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
                    title="View / Print Quotation"
                  >
                    <Eye size={16} />
                  </Link>

                  {canManageQuotation &&
                    q.status !== "cancelled" &&
                    q.status !== "converted" && (
                      <button
                        type="button"
                        onClick={() => onCancel(q)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-700 transition hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950"
                        title="Cancel Quotation"
                      >
                        <Ban size={16} />
                      </button>
                    )}
                </div>
              </td>
            </tr>
          ))}

          {quotations.length === 0 && (
            <tr>
              <td colSpan="8" className="p-10 text-center">
                <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800">
                  <FileCheck className="mx-auto text-slate-400" size={34} />
                  <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                    No quotations found
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Try changing search or filters.
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

function CustomDropdown({ value, onChange, options, icon }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selected = options.find(
    (option) => String(option.value) === String(value),
  );

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
    <div ref={dropdownRef} className="relative min-w-0">
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
        <div className="absolute left-0 top-[calc(100%+6px)] z-[9999] max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800 dark:hover:text-blue-300 ${
                String(value) === String(option.value)
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                  : "text-slate-700 dark:text-slate-200"
              }`}
            >
              <span className="truncate">{option.label}</span>

              {String(value) === String(option.value) && (
                <CheckCircle2 size={16} className="shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    sent: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    accepted:
      "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
    expired:
      "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
    converted:
      "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
    cancelled:
      "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
        styles[status] ||
        "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
      }`}
    >
      {status || "draft"}
    </span>
  );
}

function formatDate(date) {
  if (!date) return "-";

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "-";

  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getDateOnly(date) {
  if (!date) return "";

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "";

  return parsedDate.toISOString().slice(0, 10);
}

function toTitle(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default Quotations;
