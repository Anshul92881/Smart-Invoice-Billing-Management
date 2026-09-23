import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import DocumentRenderer from "./DocumentRenderer";

import {
  ArrowLeft,
  FileText,
  RefreshCcw,
  XCircle,
  Repeat,
  ChevronDown,
  CheckCircle2,
  Mail,
  Download,
  Send,
  Pencil,
} from "lucide-react";

const DEFAULT_TEMPLATE = {
  show_logo: true,
  show_company_gst_pan: true,
  show_branch_details: true,
  show_customer_gstin: true,
  show_hsn_sac: true,
  show_item_description: true,
  show_tax_breakdown: true,
  show_terms: true,
  show_notes: true,
  show_bank_details: true,
  show_signature: true,
  show_qr_code: false,
};

const ALLOWED_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];

const BLOCKED_CONVERT_STATUSES = [
  "converted",
  "cancelled",
  "rejected",
  "expired",
];

const BLOCKED_EMAIL_STATUSES = ["cancelled", "converted"];

function safeJson(value) {
  if (!value) return {};

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }

  return value || {};
}

function safeTemplate(snapshot) {
  const parsed = safeJson(snapshot);

  return {
    ...DEFAULT_TEMPLATE,
    ...(parsed.template || parsed),
  };
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatCurrency(value) {
  return `₹ ${Number(value || 0).toFixed(2)}`;
}

function ViewQuotation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const printRef = useRef(null);

  const user = JSON.parse(localStorage.getItem("user"));

  const canPushToCrm = ["company_admin", "accountant", "sales_user"].includes(
    user?.role,
  );

  const isPrint = searchParams.get("print") === "true";

  const [quotation, setQuotation] = useState(null);
  const [items, setItems] = useState([]);

  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [converting, setConverting] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchQuotation = async () => {
    try {
      setLoading(true);

      const res = await api.get(`/quotations/${id}`);

      setQuotation(res.data?.quotation || null);
      setItems(safeArray(res.data?.items));
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch quotation");
      setQuotation(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const updateStatus = async (status) => {
    if (!quotation || quotation.status === status) return;

    if (quotation.status === "converted") {
      toast.error("Converted quotation status cannot be changed");
      return;
    }

    if (quotation.status === "cancelled") {
      toast.error("Cancelled quotation status cannot be changed");
      return;
    }

    if (status === "converted") {
      toast.error("Use convert quotation action to convert quotation");
      return;
    }

    try {
      setStatusUpdating(true);

      await api.patch(`/quotations/${id}/status`, { status });

      toast.success("Quotation status updated");
      fetchQuotation();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update status");
    } finally {
      setStatusUpdating(false);
    }
  };

  const confirmAction = ({ title, description, confirmText, onConfirm }) => {
    toast(
      (t) => (
        <div className="flex min-w-[300px] flex-col gap-3">
          <div>
            <p className="font-semibold text-slate-900">{title}</p>
            {description && (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={async () => {
                toast.dismiss(t.id);
                await onConfirm();
              }}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {confirmText}
            </button>
          </div>
        </div>
      ),
      { duration: 10000 },
    );
  };

  const convertToInvoice = async () => {
    if (!quotation) return;

    if (BLOCKED_CONVERT_STATUSES.includes(quotation.status)) {
      toast.error("This quotation cannot be converted");
      return;
    }

    confirmAction({
      title: "Convert to Invoice?",
      description:
        "This quotation will be converted into an invoice using the same saved template.",
      confirmText: "Convert",
      onConfirm: async () => {
        try {
          setConverting(true);

          const res = await api.post(`/quotations/${id}/convert-to-invoice`);

          toast.success(res.data?.message || "Converted to invoice");

          if (res.data?.invoice_id) {
            navigate("/dashboard/invoices");
          } else {
            fetchQuotation();
          }
        } catch (error) {
          toast.error(
            error.response?.data?.message || "Failed to convert quotation",
          );
        } finally {
          setConverting(false);
        }
      },
    });
  };

  const sendQuotationEmail = async () => {
    if (!quotation) return;

    if (BLOCKED_EMAIL_STATUSES.includes(quotation.status)) {
      toast.error("This quotation cannot be emailed");
      return;
    }

    try {
      setSendingEmail(true);

      const res = await api.post(`/quotations/send-email/${id}`);

      toast.success(res.data?.message || "Quotation email sent successfully");
      fetchQuotation();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to send quotation email",
      );
    } finally {
      setSendingEmail(false);
    }
  };

  const downloadQuotationPdf = async () => {
    if (!quotation) return;

    try {
      setDownloading(true);

      const res = await api.get(`/quotations/${id}/download`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const fileUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = fileUrl;
      link.download = `${quotation.quotation_number || `quotation-${id}`}.pdf`;
      document.body.appendChild(link);
      link.click();

      link.remove();
      window.URL.revokeObjectURL(fileUrl);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to download quotation PDF",
      );
    } finally {
      setDownloading(false);
    }
  };

  const handlePushToCrm = async () => {
    try {
      const response = await api.post(`/quotations/${id}/push-to-crm`);

      toast.success(
        response.data?.message || "Quotation pushed to CRM successfully",
      );
    } catch (error) {
      console.error("PUSH QUOTATION TO CRM ERROR:", error);

      toast.error(
        error.response?.data?.message || "Failed to push quotation to CRM",
      );
    }
  };

  const snapshot = useMemo(
    () => safeJson(quotation?.billing_template_snapshot),
    [quotation],
  );

  const template = useMemo(
    () => safeTemplate(quotation?.billing_template_snapshot),
    [quotation],
  );

  const rendererCompany = useMemo(() => {
    const company = snapshot.company || {};

    return {
      ...company,
      name: company.name || quotation?.business_name || "Your Company",
      address: company.address || quotation?.business_address || "",
      email: company.email || quotation?.business_email || "",
      phone: company.phone || quotation?.business_phone || "",
      gst_number: company.gst_number || quotation?.business_gst_number || "",
      pan_number: company.pan_number || quotation?.business_pan_number || "",
      logo: company.logo || quotation?.business_logo || "",
    };
  }, [snapshot, quotation]);

  const rendererBranch = useMemo(() => {
    const branch = snapshot.branch || {};

    return {
      ...branch,
      branch_name: branch.branch_name || quotation?.branch_name || "",
      branch_code: branch.branch_code || quotation?.branch_code || "",
    };
  }, [snapshot, quotation]);

  const rendererBank = useMemo(() => snapshot.bank || {}, [snapshot]);

  const rendererCustomer = useMemo(
    () => ({
      customer_name: quotation?.customer_name || "",
      company_name: quotation?.company_name || "",
      billing_address: quotation?.billing_address || "",
      shipping_address: quotation?.shipping_address || "",
      gstin: quotation?.gstin || "",
      email: quotation?.email || "",
      phone: quotation?.phone || "",
    }),
    [quotation],
  );

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <RefreshCcw className="mx-auto mb-3 animate-spin text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Loading quotation
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Fetching quotation details...
          </p>
        </div>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <XCircle className="mx-auto mb-3 text-red-600 dark:text-red-400" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Quotation not found
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          This quotation may have been deleted or is no longer available.
        </p>

        <button
          type="button"
          onClick={() => navigate("/dashboard/quotations")}
          className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700"
        >
          Back to Quotations
        </button>
      </div>
    );
  }

  const canEdit = ["draft", "sent"].includes(quotation.status);
  const canConvert = !BLOCKED_CONVERT_STATUSES.includes(quotation.status);
  const canEmail = !BLOCKED_EMAIL_STATUSES.includes(quotation.status);
  const canChangeStatus = !["converted", "cancelled"].includes(
    quotation.status,
  );

  return (
    <div
      className={`w-full max-w-full min-w-0 overflow-hidden ${
        isPrint ? "bg-white p-0" : "space-y-5"
      }`}
    >
      {!isPrint && (
        <div className="no-print rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
                <FileText size={17} />
                Quotation Details
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <h1 className="truncate text-2xl font-bold text-slate-900 dark:text-white">
                  {quotation.quotation_number || `Quotation #${id}`}
                </h1>

                <StatusBadge status={quotation.status} />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end xl:justify-end">
              <button
                type="button"
                onClick={() => navigate("/dashboard/quotations")}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <ArrowLeft size={16} />
                Back
              </button>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => navigate(`/dashboard/quotations/${id}/edit`)}
                  title="Edit Quotation"
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  <Pencil size={17} />
                  Edit
                </button>
              )}

              <button
                type="button"
                onClick={downloadQuotationPdf}
                disabled={downloading}
                title="Download PDF"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                <Download
                  size={18}
                  className={downloading ? "animate-bounce" : ""}
                />
              </button>

              {canEmail && (
                <button
                  type="button"
                  onClick={sendQuotationEmail}
                  disabled={sendingEmail}
                  title="Send Email"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Mail
                    size={18}
                    className={sendingEmail ? "animate-pulse" : ""}
                  />
                </button>
              )}

              {canPushToCrm && (
                <button
                  type="button"
                  onClick={handlePushToCrm}
                  title="Push to CRM"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600 text-white transition hover:bg-violet-700"
                >
                  <Send size={18} />
                </button>
              )}

              <div className="min-w-[180px]">
                <label className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Change Status
                </label>

                <StatusDropdown
                  value={quotation.status}
                  disabled={statusUpdating || !canChangeStatus}
                  onChange={updateStatus}
                />
              </div>

              {canConvert && (
                <button
                  type="button"
                  onClick={convertToInvoice}
                  disabled={converting}
                  className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Repeat size={16} />
                  {converting ? "Converting..." : "Convert to Invoice"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        ref={printRef}
        className={`print-area ${
          isPrint
            ? "overflow-visible border-0 bg-white p-0 shadow-none"
            : "overflow-auto rounded-3xl border border-slate-200 bg-slate-100 p-4 shadow-inner dark:border-slate-800 dark:bg-slate-950 sm:p-6"
        }`}
      >
        <DocumentRenderer
          type="quotation"
          template={template}
          company={rendererCompany}
          branch={rendererBranch}
          bank={rendererBank}
          customer={rendererCustomer}
          document={quotation}
          items={items}
          className={isPrint ? "print-document" : ""}
        />
      </div>

      <style>{`
        ${
          isPrint
            ? `
              html,
              body,
              #root {
                margin: 0 !important;
                padding: 0 !important;
                width: 210mm;
                min-height: 297mm;
                background: white !important;
              }

              .print-area {
                width: 100% !important;
                background: white !important;
                overflow: visible !important;
              }

              .print-area > div {
                max-width: 100% !important;
                padding: 0 !important;
                background: white !important;
                box-shadow: none !important;
              }

              .print-document {
                max-width: 100% !important;
                padding: 0 !important;
                background: white !important;
              }
            `
            : ""
        }

        @media print {
          @page {
            size: A4;
            margin: 8mm;
          }

          html,
          body {
            width: 210mm;
            min-height: 297mm;
            background: white !important;
          }

          body * {
            visibility: hidden;
          }

          .print-area,
          .print-area * {
            visibility: visible;
          }

          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            overflow: visible !important;
            border: 0 !important;
            background: white !important;
            padding: 0 !important;
            box-shadow: none !important;
          }

          .print-area > div {
            max-width: 100% !important;
            padding: 0 !important;
            background: white !important;
            box-shadow: none !important;
          }

          .print-area table {
            page-break-inside: auto;
          }

          .print-area tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function StatusDropdown({ value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const options = [
    ...ALLOWED_STATUS_OPTIONS,
    ...(value === "converted"
      ? [{ value: "converted", label: "Converted" }]
      : []),
  ];

  const selected = options.find((option) => option.value === value) || {
    value,
    label: value || "Draft",
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={dropdownRef} className="relative min-w-[180px]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:focus:ring-blue-950/50 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
      >
        <span className="capitalize">{selected.label}</span>

        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-500 transition dark:text-slate-400 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {ALLOWED_STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800 dark:hover:text-blue-300 ${
                option.value === value
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                  : "text-slate-700 dark:text-slate-200"
              }`}
            >
              <span>{option.label}</span>
              {option.value === value && <CheckCircle2 size={16} />}
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
        styles[status] || styles.draft
      }`}
    >
      {status || "draft"}
    </span>
  );
}

export default ViewQuotation;
