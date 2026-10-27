import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import toast from "react-hot-toast";
import CreateInvoice from "./Invoices";
import { createPortal } from "react-dom";

import {
  Receipt,
  IndianRupee,
  CreditCard,
  CalendarDays,
  FileText,
  Search,
  Wallet,
  CheckCircle,
  AlertCircle,
  Building2,
  Plus,
  X,
  Save,
  Filter,
  ChevronDown,
} from "lucide-react";

const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card", label: "Card" },
  { value: "cheque", label: "Cheque" },
  { value: "wallet", label: "Wallet" },
  { value: "other", label: "Other" },
];

const ALLOWED_PAYMENT_METHODS = PAYMENT_METHOD_OPTIONS.map(
  (option) => option.value,
);

const cleanString = (value) =>
  String(value || "")
    .replace(/<[^>]*>?/gm, "")
    .trim();

const toNumber = (value, fallback = 0) => {
  if (value === "" || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
};

const getList = (data, key) => {
  if (Array.isArray(data)) return data;
  return data?.[key] || [];
};

const isValidDate = (value) => {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
};

function Payments() {
  const user = JSON.parse(localStorage.getItem("user"));

  const [rolePermissions, setRolePermissions] = useState({});

  useEffect(() => {
    const fetchRolePermissions = async () => {
      try {
        if (user?.role === "company_admin") return;

        const res = await api.get("/companies/role-permissions");
        setRolePermissions(res.data?.permissions || {});
      } catch {
        setRolePermissions({});
      }
    };

    fetchRolePermissions();
  }, []);

  const canRecord =
    user?.role === "company_admin" ||
    user?.role === "accountant" ||
    Boolean(rolePermissions?.[user?.role]?.payments);

  const initialForm = {
    invoice_id: "",
    amount: "",
    payment_method: "cash",
    payment_date: new Date().toISOString().split("T")[0],
    notes: "",
  };

  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [formData, setFormData] = useState(initialForm);

  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);

  const fetchData = async () => {
    try {
      const [invoiceRes, paymentRes] = await Promise.all([
        api.get("/invoices"),
        api.get("/payments"),
      ]);

      setInvoices(getList(invoiceRes.data, "invoices"));
      setPayments(getList(paymentRes.data, "payments"));
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch payments");
      setInvoices([]);
      setPayments([]);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const branches = useMemo(() => {
    const branchMap = new Map();

    [
      ...(Array.isArray(invoices) ? invoices : []),
      ...(Array.isArray(payments) ? payments : []),
    ].forEach((item) => {
      if (item.branch_id && item.branch_name) {
        branchMap.set(Number(item.branch_id), {
          id: item.branch_id,
          branch_name: item.branch_name,
          branch_code: item.branch_code,
        });
      }
    });

    return Array.from(branchMap.values());
  }, [invoices, payments]);

  const getInvoicePaidAmount = (invoiceId) => {
    return (Array.isArray(payments) ? payments : [])
      .filter((payment) => Number(payment.invoice_id) === Number(invoiceId))
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  };

  const selectedInvoice = (Array.isArray(invoices) ? invoices : []).find(
    (invoice) => Number(invoice.id) === Number(formData.invoice_id),
  );

  const selectedPaidAmount = selectedInvoice
    ? Math.max(
        Number(selectedInvoice.paid_amount || 0),
        getInvoicePaidAmount(selectedInvoice.id),
      )
    : 0;

  const selectedTotalAmount = Number(selectedInvoice?.total_amount || 0);

  const selectedRemainingAmount = selectedInvoice
    ? Math.max(
        Number(
          selectedInvoice.balance_due ??
            selectedInvoice.remaining_amount ??
            selectedTotalAmount - selectedPaidAmount,
        ),
        0,
      )
    : 0;

  const pendingInvoices = (Array.isArray(invoices) ? invoices : []).filter(
    (invoice) =>
      invoice.status !== "paid" &&
      invoice.status !== "cancelled" &&
      Number(invoice.balance_due ?? invoice.total_amount ?? 0) > 0,
  );

  const totalCollected = (Array.isArray(payments) ? payments : [])
    .filter((payment) =>
      branchFilter ? Number(payment.branch_id) === Number(branchFilter) : true,
    )
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const partialInvoices = (Array.isArray(invoices) ? invoices : []).filter(
    (invoice) =>
      invoice.status === "partial" &&
      (branchFilter
        ? Number(invoice.branch_id) === Number(branchFilter)
        : true),
  ).length;

  const filteredPendingInvoices = pendingInvoices.filter((invoice) =>
    branchFilter ? Number(invoice.branch_id) === Number(branchFilter) : true,
  );

  const filteredPayments = useMemo(() => {
    return (Array.isArray(payments) ? payments : []).filter((payment) => {
      const keyword = search.toLowerCase().trim();

      const matchesSearch =
        !keyword ||
        payment.invoice_number?.toLowerCase().includes(keyword) ||
        payment.customer_name?.toLowerCase().includes(keyword) ||
        payment.payment_method?.toLowerCase().includes(keyword) ||
        payment.branch_name?.toLowerCase().includes(keyword) ||
        payment.branch_code?.toLowerCase().includes(keyword);

      const matchesMethod = methodFilter
        ? payment.payment_method === methodFilter
        : true;

      const matchesBranch = branchFilter
        ? Number(payment.branch_id) === Number(branchFilter)
        : true;

      return matchesSearch && matchesMethod && matchesBranch;
    });
  }, [payments, search, methodFilter, branchFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, methodFilter, branchFilter]);

  const sortedPayments = useMemo(() => {
    return [...filteredPayments].sort((a, b) => Number(b.id) - Number(a.id));
  }, [filteredPayments]);

  const totalPages = Math.ceil(sortedPayments.length / itemsPerPage);

  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;

    return sortedPayments.slice(start, start + itemsPerPage);
  }, [sortedPayments, currentPage, itemsPerPage]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "invoice_id") {
      const invoice = (Array.isArray(invoices) ? invoices : []).find(
        (inv) => Number(inv.id) === Number(value),
      );
      const paid = invoice ? getInvoicePaidAmount(invoice.id) : 0;
      const remaining = invoice
        ? Math.max(
            Number(
              invoice.balance_due ??
                invoice.remaining_amount ??
                Number(invoice.total_amount || 0) - paid,
            ),
            0,
          )
        : "";

      setFormData((prev) => ({
        ...prev,
        invoice_id: value,
        amount: remaining,
      }));

      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setFormData(initialForm);
  };

  const openPaymentModal = () => {
    resetForm();
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    resetForm();
    setShowPaymentModal(false);
  };

  const handleInvoiceCreated = async () => {
    setShowCreateInvoiceModal(false);
    await fetchData();
  };

  const validatePaymentForm = () => {
    if (!canRecord) {
      toast.error("Payment permission required");
      return false;
    }

    if (!formData.invoice_id) {
      toast.error("Please select invoice");
      return false;
    }

    if (!selectedInvoice) {
      toast.error("Selected invoice is not available");
      return false;
    }

    if (selectedInvoice.status === "cancelled") {
      toast.error("Payment cannot be recorded for cancelled invoice");
      return false;
    }

    if (selectedInvoice.status === "paid" || selectedRemainingAmount <= 0) {
      toast.error("Invoice is already fully paid");
      return false;
    }

    const paymentAmount = toNumber(formData.amount, NaN);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      toast.error("Please enter valid payment amount");
      return false;
    }

    if (paymentAmount > selectedRemainingAmount) {
      toast.error("Payment amount cannot be greater than remaining amount");
      return false;
    }

    if (!ALLOWED_PAYMENT_METHODS.includes(formData.payment_method)) {
      toast.error("Please select valid payment method");
      return false;
    }

    if (!isValidDate(formData.payment_date)) {
      toast.error("Please select valid payment date");
      return false;
    }

    if (cleanString(formData.notes).length > 500) {
      toast.error("Notes must be less than 500 characters");
      return false;
    }

    return true;
  };

  const buildPaymentPayload = () => ({
    invoice_id: formData.invoice_id,
    amount: Number(formData.amount || 0),
    payment_method: formData.payment_method || "cash",
    payment_date: formData.payment_date,
    notes: cleanString(formData.notes),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validatePaymentForm()) return;

    try {
      setLoading(true);
      await api.post("/payments", buildPaymentPayload());

      toast.success("Payment recorded successfully");
      closePaymentModal();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  const formatPaymentMethod = (method) => {
    const matchedMethod = PAYMENT_METHOD_OPTIONS.find(
      (option) => option.value === method,
    );

    return matchedMethod?.label || method || "-";
  };

  const formatDate = (date) => {
    if (!date) return "-";

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return "-";

    return parsedDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="w-full max-w-full min-w-0 space-y-5 overflow-hidden">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              <Receipt size={17} />
              Payment Management
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Payments
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Record branch-wise payments, track partial payments and manage
              customer payment history.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {sortedPayments.length} Payments
            </div>

            {canRecord && (
              <button
                type="button"
                onClick={openPaymentModal}
                className="flex w-fit items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <Plus size={16} />
                Record Payment
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard
          title="Total Collected"
          value={`₹ ${totalCollected.toFixed(2)}`}
          icon={<IndianRupee size={20} />}
          color="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
        />

        <SummaryCard
          title="Pending Invoices"
          value={filteredPendingInvoices.length}
          icon={<AlertCircle size={20} />}
          color="bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
        />

        <SummaryCard
          title="Partial Payments"
          value={partialInvoices}
          icon={<CheckCircle size={20} />}
          color="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
        />
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Payment History
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Branch-wise customer invoice payment records.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  placeholder="Search payments"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input !pl-10"
                />
              </div>

              <CustomDropdown
                value={branchFilter}
                onChange={setBranchFilter}
                icon={<Building2 size={16} />}
                options={[
                  { value: "", label: "All Branches" },
                  ...branches.map((branch) => ({
                    value: String(branch.id),
                    label: `${branch.branch_name}${
                      branch.branch_code ? ` (${branch.branch_code})` : ""
                    }`,
                  })),
                ]}
              />

              <CustomDropdown
                value={methodFilter}
                onChange={setMethodFilter}
                icon={<Filter size={16} />}
                options={[
                  { value: "", label: "All Methods" },
                  ...PAYMENT_METHOD_OPTIONS,
                ]}
              />
            </div>
          </div>
        </div>

        <PaymentTable
          payments={paginatedPayments}
          formatDate={formatDate}
          formatPaymentMethod={formatPaymentMethod}
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
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-emerald-950/50"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="text-sm text-slate-500 dark:text-slate-400">
            Showing{" "}
            {sortedPayments.length === 0
              ? 0
              : (currentPage - 1) * itemsPerPage + 1}
            {" - "}
            {Math.min(currentPage * itemsPerPage, sortedPayments.length)}
            {" of "}
            {sortedPayments.length}
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

            <span className="text-sm font-semibold">
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

      {showPaymentModal && (
        <PaymentModal
          formData={formData}
          pendingInvoices={pendingInvoices}
          selectedInvoice={selectedInvoice}
          selectedTotalAmount={selectedTotalAmount}
          selectedPaidAmount={selectedPaidAmount}
          selectedRemainingAmount={selectedRemainingAmount}
          loading={loading}
          handleChange={handleChange}
          handleSubmit={handleSubmit}
          onClose={closePaymentModal}
          onReset={resetForm}
          onCreateInvoice={() => setShowCreateInvoiceModal(true)}
        />
      )}

      {showCreateInvoiceModal && (
        <div className="fixed inset-0 z-[30000] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="max-h-[96vh] w-full max-w-7xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="sticky top-0 z-[10000] flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Create Invoice
              </h2>

              <button
                type="button"
                onClick={() => setShowCreateInvoiceModal(false)}
                className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <CreateInvoice
              modalMode
              onClose={() => setShowCreateInvoiceModal(false)}
              onCreated={handleInvoiceCreated}
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
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
        }

        .input::placeholder {
          color: #94a3b8;
        }

        .input:focus {
          border-color: #059669;
          box-shadow: 0 0 0 3px #d1fae5;
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
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgba(6, 78, 59, 0.35);
        }
      `}</style>
    </div>
  );
}

function PaymentModal({
  formData,
  pendingInvoices,
  selectedInvoice,
  selectedTotalAmount,
  selectedPaidAmount,
  selectedRemainingAmount,
  loading,
  handleChange,
  handleSubmit,
  onClose,
  onReset,
  onCreateInvoice,
}) {
  return createPortal(
    <div className="fixed inset-0 z-[50000] isolate flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-md sm:p-5">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-slate-50 shadow-[0_30px_100px_rgba(0,0,0,0.45)] dark:border-slate-700 dark:bg-slate-950">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              <Receipt size={17} />
              Payment Entry
            </div>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Record Payment
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Select invoice and record received amount.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Payment Details
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Select pending invoice and enter payment information.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <InputWrapper label="Invoice" icon={<FileText size={16} />}>
                  <InvoiceSelect
                    invoices={pendingInvoices}
                    value={formData.invoice_id}
                    onChange={(value) => {
                      if (value === "__create_invoice__") {
                        onCreateInvoice();
                        return;
                      }

                      handleChange({
                        target: {
                          name: "invoice_id",
                          value,
                        },
                      });
                    }}
                  />
                </InputWrapper>

                <InputWrapper label="Amount" icon={<IndianRupee size={16} />}>
                  <input
                    type="number"
                    name="amount"
                    min="0"
                    step="0.01"
                    placeholder="Payment Amount"
                    value={formData.amount}
                    onChange={handleChange}
                    className="input"
                  />
                </InputWrapper>

                <InputWrapper
                  label="Payment Method"
                  icon={<CreditCard size={16} />}
                >
                  <CustomDropdown
                    value={formData.payment_method}
                    onChange={(value) =>
                      handleChange({
                        target: {
                          name: "payment_method",
                          value,
                        },
                      })
                    }
                    icon={<CreditCard size={16} />}
                    options={[...PAYMENT_METHOD_OPTIONS]}
                  />
                </InputWrapper>

                <InputWrapper
                  label="Payment Date"
                  icon={<CalendarDays size={16} />}
                >
                  <input
                    type="date"
                    name="payment_date"
                    value={formData.payment_date}
                    onChange={handleChange}
                    className="input"
                  />
                </InputWrapper>

                <div className="min-w-0 md:col-span-2">
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Notes
                  </label>

                  <input
                    type="text"
                    name="notes"
                    maxLength={500}
                    placeholder="Transaction ID / notes / reference number"
                    value={formData.notes}
                    onChange={handleChange}
                    className="input"
                  />
                </div>
              </div>
            </div>

            {selectedInvoice && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <AmountBox
                  title="Invoice Total"
                  value={selectedTotalAmount}
                  className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                />

                <AmountBox
                  title="Already Paid"
                  value={selectedPaidAmount}
                  className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                />

                <AmountBox
                  title="Remaining"
                  value={selectedRemainingAmount}
                  className="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                />

                <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                  <p className="flex items-center gap-2 text-sm">
                    <Building2 size={15} />
                    Branch
                  </p>
                  <h3 className="mt-1 text-medium font-medium">
                    {selectedInvoice.branch_name || "Main Company"}
                  </h3>
                </div>
              </div>
            )}

            <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {selectedInvoice
                    ? `Remaining: ₹ ${selectedRemainingAmount.toFixed(2)}`
                    : "Select invoice to see balance"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Payment amount cannot be greater than remaining balance.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={onReset}
                  className="rounded-xl border border-slate-200 bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
                >
                  Reset
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-400"
                >
                  <Save size={16} />
                  {loading ? "Recording..." : "Record Payment"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PaymentTable({ payments, formatDate, formatPaymentMethod }) {
  return (
    <div className="w-full max-w-full overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
          <tr>
            {[
              "Invoice",
              "Branch",
              "Customer",
              "Amount",
              "Method",
              "Date",
              "Status",
            ].map((head) => (
              <th
                key={head}
                className="p-4 text-left text-xs font-bold uppercase tracking-wide"
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {payments.map((payment) => (
            <tr
              key={payment.id}
              className="border-t border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <td className="p-4 font-semibold text-slate-900 dark:text-white">
                {payment.invoice_number || "-"}
              </td>

              <td className="p-4 text-slate-600 dark:text-slate-300">
                {payment.branch_name || "Main Company"}
              </td>

              <td className="p-4 text-slate-600 dark:text-slate-300">
                {payment.customer_name || "-"}
              </td>

              <td className="p-4 font-bold text-emerald-600">
                ₹ {Number(payment.amount || 0).toFixed(2)}
              </td>

              <td className="p-4 text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <Wallet size={15} />
                  {formatPaymentMethod(payment.payment_method)}
                </span>
              </td>

              <td className="p-4 text-slate-600 dark:text-slate-300">
                {formatDate(payment.payment_date)}
              </td>

              <td className="p-4">
                <StatusBadge status={payment.invoice_status} />
              </td>
            </tr>
          ))}

          {payments.length === 0 && (
            <tr>
              <td colSpan="7" className="p-10 text-center">
                <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-950">
                  <Receipt className="mx-auto text-slate-400" size={34} />
                  <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                    No payments found
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

function SummaryCard({ title, value, icon, color }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <h2 className="mt-1 truncate text-2xl font-bold text-slate-900 dark:text-white">
            {value}
          </h2>
        </div>

        <div className={`shrink-0 rounded-xl p-3 ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

function InvoiceSelect({ invoices, value, onChange }) {
  const invoiceOptions = invoices.map((invoice) => ({
    value: String(invoice.id),
    title: invoice.invoice_number || `Invoice #${invoice.id}`,
    subtitle: `${invoice.customer_name || "No customer"} • ${
      invoice.branch_name || "Main Company"
    } • ₹ ${Number(invoice.balance_due || invoice.total_amount || 0).toFixed(2)}`,
  }));

  return (
    <SearchableDropdown
      value={value}
      placeholder="Select Invoice"
      searchPlaceholder="Search invoice..."
      emptyText="No pending invoice found"
      options={invoiceOptions}
      accent="emerald"
      addAction={{
        label: "Create Invoice",
        value: "__create_invoice__",
      }}
      onChange={onChange}
    />
  );
}

function SearchableDropdown({
  value,
  onChange,
  options,
  placeholder = "Select",
  searchPlaceholder = "Search...",
  emptyText = "No option found",
  addAction = null,
  accent = "emerald",
}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState({});

  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const selected = options.find(
    (option) => String(option.value) === String(value),
  );

  const filteredOptions = options.filter((option) =>
    `${option.title || ""} ${option.subtitle || ""}`
      .toLowerCase()
      .includes(keyword.trim().toLowerCase()),
  );

  const accentClasses =
    accent === "emerald"
      ? {
          hoverBorder:
            "hover:border-emerald-400 focus:border-emerald-500 focus:ring-emerald-100 dark:hover:border-emerald-500 dark:focus:ring-emerald-950/50",
          hoverRow: "hover:bg-emerald-50 dark:hover:bg-slate-800",
          activeRow: "bg-emerald-50 dark:bg-emerald-950/40",
          addButton:
            "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950",
        }
      : {
          hoverBorder:
            "hover:border-blue-400 focus:border-blue-500 focus:ring-blue-100 dark:hover:border-blue-500 dark:focus:ring-blue-950/50",
          hoverRow: "hover:bg-blue-50 dark:hover:bg-slate-800",
          activeRow: "bg-blue-50 dark:bg-blue-950/40",
          addButton:
            "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950",
        };

  const updateDropdownPosition = () => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = 330;
    const shouldOpenUp =
      spaceBelow < dropdownHeight && rect.top > dropdownHeight;

    setDropdownStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      top: shouldOpenUp ? rect.top - dropdownHeight - 8 : rect.bottom + 8,
      maxHeight: dropdownHeight,
      zIndex: 30000,
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
      setKeyword("");
    };

    window.addEventListener("scroll", updateDropdownPosition, true);
    window.addEventListener("resize", updateDropdownPosition);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("scroll", updateDropdownPosition, true);
      window.removeEventListener("resize", updateDropdownPosition);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const handleSelect = (nextValue) => {
    onChange(nextValue);
    setOpen(false);
    setKeyword("");
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-700 shadow-sm outline-none transition focus:ring-4 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 ${accentClasses.hoverBorder}`}
      >
        <span className="min-w-0 truncate">
          {selected?.title || placeholder}
        </span>

        <ChevronDown
          size={17}
          className={`shrink-0 text-slate-400 transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="border-b border-slate-100 p-2 dark:border-slate-800">
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder={searchPlaceholder}
                autoFocus
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:bg-slate-900 dark:focus:ring-emerald-950/50"
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto p-2">
            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`w-full rounded-xl px-3 py-2 text-left transition ${
                  accentClasses.hoverRow
                } ${
                  String(value || "") === String(option.value)
                    ? accentClasses.activeRow
                    : ""
                }`}
              >
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {option.title}
                </p>

                {option.subtitle && (
                  <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                    {option.subtitle}
                  </p>
                )}
              </button>
            ))}

            {filteredOptions.length === 0 && (
              <div className="px-3 py-4 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                {emptyText}
              </div>
            )}
          </div>

          {addAction && (
            <div className="border-t border-slate-100 p-2 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleSelect(addAction.value)}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${accentClasses.addButton}`}
              >
                <Plus size={16} />
                {addAction.label}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function CustomDropdown({ value, onChange, options, icon }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const addTaxOption = options.find((option) => option.value === "__add_tax__");

  const regularOptions = options.filter(
    (option) => option.value !== "__add_tax__",
  );

  const selected = regularOptions.find(
    (option) => String(option.value) === String(value),
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (nextValue) => {
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:focus:ring-blue-950/50"
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon && (
            <span className="shrink-0 text-slate-400 dark:text-slate-500">
              {icon}
            </span>
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
          <div className="max-h-60 overflow-y-auto">
            {regularOptions.map((option) => {
              const active = String(value) === String(option.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800 dark:hover:text-blue-300 ${
                    active
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                      : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <span className="truncate">{option.label}</span>

                  {active && <CheckCircle2 size={16} className="shrink-0" />}
                </button>
              );
            })}
          </div>

          {addTaxOption && (
            <div className="border-t border-slate-100 p-2 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleSelect(addTaxOption.value)}
                className="flex w-full items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
              >
                <Plus size={16} />

                {addTaxOption.label.replace(/^\+\s*/, "")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InputWrapper({ label, icon, children }) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}

function AmountBox({ title, value, className }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 p-4 dark:border-slate-800 ${className}`}
    >
      <p className="text-sm">{title}</p>
      <h3 className="mt-1 text-lg font-bold">
        ₹ {Number(value || 0).toFixed(2)}
      </h3>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    draft:
      "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    sent: "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
    viewed:
      "bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700",
    partial:
      "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
    paid: "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700",
    overdue:
      "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
    cancelled:
      "bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold capitalize ${
        styles[status] || styles.draft
      }`}
    >
      {status || "draft"}
    </span>
  );
}

export default Payments;
