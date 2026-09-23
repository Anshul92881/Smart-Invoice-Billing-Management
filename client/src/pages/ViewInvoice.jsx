import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import DocumentRenderer from "./DocumentRenderer";

import {
  ArrowLeft,
  Ban,
  Download,
  FileText,
  Mail,
  RefreshCcw,
  Send,
  XCircle,
} from "lucide-react";

const DEFAULT_TEMPLATE = {
  show_logo: true,
  show_company_gst_pan: true,
  show_branch_details: true,
  show_customer_gstin: true,
  show_hsn_sac: true,
  show_item_description: true,
  show_tax_breakdown: true,
  show_bank_details: true,
  show_terms: true,
  show_notes: true,
  show_signature: true,
};

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

function safeTemplate(snapshot, fallback) {
  const parsedSnapshot = safeJson(snapshot);

  return {
    ...DEFAULT_TEMPLATE,
    ...safeJson(fallback),
    ...(parsedSnapshot.template || parsedSnapshot),
  };
}

function ViewInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const printRef = useRef(null);

  const user = JSON.parse(localStorage.getItem("user"));

  const canPushToCrm = ["company_admin", "accountant", "sales_user"].includes(
    user?.role,
  );

  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [emailing, setEmailing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/invoices/${id}`);
      setInvoice(res.data?.invoice || null);
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch invoice");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const [searchParams] = useSearchParams();

  const isPrint = searchParams.get("print") === "true";

  const handleDownload = async () => {
    if (!invoice) return;

    try {
      setDownloading(true);

      const res = await api.get(`/invoices/${id}/download`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const fileUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = fileUrl;
      link.download = `${invoice.invoice_number || `invoice-${id}`}.pdf`;
      document.body.appendChild(link);
      link.click();

      link.remove();
      window.URL.revokeObjectURL(fileUrl);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to download invoice PDF",
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleSendEmail = async () => {
    try {
      setEmailing(true);
      await api.post(`/invoices/send-email/${id}`);
      toast.success("Invoice email sent successfully");
      fetchInvoice();
    } catch (error) {
      toast.error(error.response?.data?.message || "Email send failed");
    } finally {
      setEmailing(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this invoice?")) return;

    try {
      setCancelling(true);
      await api.patch(`/invoices/${id}/cancel`);
      toast.success("Invoice cancelled");
      fetchInvoice();
    } catch (error) {
      toast.error(error.response?.data?.message || "Cancel failed");
    } finally {
      setCancelling(false);
    }
  };

  const handlePushToCrm = async () => {
    try {
      const res = await api.post(`/invoices/${id}/push-to-crm`);

      toast.success(res.data?.message || "Customer synced to CRM successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "CRM sync failed");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const snapshot = useMemo(
    () => safeJson(invoice?.billing_template_snapshot),
    [invoice],
  );

  const template = useMemo(
    () =>
      safeTemplate(
        invoice?.billing_template_snapshot,
        invoice?.billing_template,
      ),
    [invoice],
  );

  const rendererCompany = useMemo(() => {
    const company = snapshot.company || {};

    return {
      ...company,
      name: company.name || invoice?.business_name || "Your Company",
      address: company.address || invoice?.business_address || "",
      email: company.email || invoice?.business_email || "",
      phone: company.phone || invoice?.business_phone || "",
      gst_number: company.gst_number || invoice?.gst_number || "",
      pan_number: company.pan_number || invoice?.pan_number || "",
      logo: company.logo || invoice?.logo || "",
    };
  }, [snapshot, invoice]);

  const rendererBranch = useMemo(() => {
    const branch = snapshot.branch || {};

    return {
      ...branch,
      branch_name: branch.branch_name || invoice?.branch_name || "",
      branch_code: branch.branch_code || invoice?.branch_code || "",
    };
  }, [snapshot, invoice]);

  const rendererBank = useMemo(() => {
    const bank = snapshot.bank || {};

    return {
      ...bank,
      bank_name: bank.bank_name || invoice?.bank_name || "",
      account_holder_name:
        bank.account_holder_name || invoice?.account_holder_name || "",
      account_number: bank.account_number || invoice?.account_number || "",
      ifsc_code: bank.ifsc_code || invoice?.ifsc_code || "",
      upi_id: bank.upi_id || invoice?.upi_id || "",
      invoice_terms: bank.invoice_terms || invoice?.invoice_terms || "",
      payment_instructions:
        bank.payment_instructions || invoice?.payment_instructions || "",
      currency: invoice?.currency || bank.currency || "INR",
    };
  }, [snapshot, invoice]);

  const rendererCustomer = useMemo(
    () => ({
      customer_name: invoice?.customer_name || "",
      company_name: invoice?.company_name || "",
      billing_address: invoice?.billing_address || "",
      shipping_address:
        invoice?.shipping_address || invoice?.billing_address || "",
      gstin: invoice?.gstin || invoice?.customer_gstin || "",
      email: invoice?.email || "",
      phone: invoice?.phone || "",
    }),
    [invoice],
  );

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <RefreshCcw className="mx-auto mb-3 animate-spin text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Loading invoice
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Fetching invoice details...
          </p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <XCircle className="mx-auto mb-3 text-red-600" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Invoice not found
        </h2>

        <button
          type="button"
          onClick={() => navigate("/dashboard/invoices")}
          className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700"
        >
          Back to Invoices
        </button>
      </div>
    );
  }

  const canCancel =
    invoice.status !== "cancelled" &&
    invoice.status !== "paid" &&
    Number(invoice.paid_amount || 0) <= 0;

  return (
    <div
      className={`w-full max-w-full min-w-0 overflow-hidden ${
        isPrint ? "bg-white p-0" : "space-y-5"
      }`}
    >
      {!isPrint && (
        <div className="no-print rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
                <FileText size={17} />
                Invoice Preview
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <h1 className="truncate text-2xl font-bold text-slate-900 dark:text-white">
                  {invoice.invoice_number || `Invoice #${id}`}
                </h1>

                <StatusBadge status={invoice.status} />
              </div>

              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Review invoice, download PDF, send email or cancel if unpaid.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/dashboard/invoices")}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <ArrowLeft size={16} />
                Back
              </button>

              <button
                type="button"
                onClick={handlePrint}
                title="Print"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                <FileText size={18} />
              </button>

              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                title="Download PDF"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download
                  size={18}
                  className={downloading ? "animate-bounce" : ""}
                />
              </button>

              <button
                type="button"
                onClick={handleSendEmail}
                disabled={emailing || invoice.status === "cancelled"}
                title={emailing ? "Sending..." : "Send Email"}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Mail size={18} className={emailing ? "animate-pulse" : ""} />
              </button>

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

              {canCancel && (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={cancelling}
                  title={cancelling ? "Cancelling..." : "Cancel Invoice"}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950"
                >
                  <Ban
                    size={18}
                    className={cancelling ? "animate-pulse" : ""}
                  />
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
          type="invoice"
          template={template}
          company={rendererCompany}
          branch={rendererBranch}
          bank={rendererBank}
          customer={rendererCustomer}
          document={invoice}
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

function StatusBadge({ status }) {
  const styles = {
    draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    generated:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
    sent: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    viewed:
      "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
    partial:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-300",
    paid: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300",
    overdue: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
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

export default ViewInvoice;
