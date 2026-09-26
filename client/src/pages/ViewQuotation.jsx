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

function ViewQuotation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const printRef = useRef(null);

  const storedUser = localStorage.getItem("user");

  let user = null;

  try {
    user = storedUser ? JSON.parse(storedUser) : null;
  } catch {
    user = null;
  }

  const canPushToCrm = ["company_admin", "accountant"].includes(user?.role);

  const isPrint = searchParams.get("print") === "true";

  const [quotation, setQuotation] = useState(null);
  const [items, setItems] = useState([]);

  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [converting, setConverting] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pushingToCrm, setPushingToCrm] = useState(false);

  const fetchQuotation = async () => {
    try {
      setLoading(true);

      const res = await api.get(`/quotations/${id}`);

      setQuotation(res.data?.quotation || null);
      setItems(safeArray(res.data?.items));
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to fetch quotation",
      );

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

      await api.patch(`/quotations/${id}/status`, {
        status,
      });

      toast.success("Quotation status updated");

      await fetchQuotation();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to update status",
      );
    } finally {
      setStatusUpdating(false);
    }
  };

  const confirmAction = ({
    title,
    description,
    confirmText,
    onConfirm,
  }) => {
    toast(
      (t) => (
        <div className="flex w-full min-w-0 max-w-[340px] flex-col gap-3 sm:min-w-[320px]">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 sm:text-base">
              {title}
            </p>

            {description && (
              <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
                {description}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 sm:text-sm"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={async () => {
                toast.dismiss(t.id);
                await onConfirm();
              }}
              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-700 sm:text-sm"
            >
              {confirmText}
            </button>
          </div>
        </div>
      ),
      {
        duration: 10000,
      },
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

          const res = await api.post(
            `/quotations/${id}/convert-to-invoice`,
          );

          toast.success(
            res.data?.message || "Converted to invoice",
          );

          if (res.data?.invoice_id) {
            navigate("/dashboard/invoices");
          } else {
            await fetchQuotation();
          }
        } catch (error) {
          toast.error(
            error.response?.data?.message ||
              "Failed to convert quotation",
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

      const res = await api.post(
        `/quotations/send-email/${id}`,
      );

      toast.success(
        res.data?.message ||
          "Quotation email sent successfully",
      );

      await fetchQuotation();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to send quotation email",
      );
    } finally {
      setSendingEmail(false);
    }
  };

  const downloadQuotationPdf = async () => {
    if (!quotation) return;

    try {
      setDownloading(true);

      const res = await api.get(
        `/quotations/${id}/download`,
        {
          responseType: "blob",
        },
      );

      const blob = new Blob([res.data], {
        type: "application/pdf",
      });

      const fileUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = fileUrl;

      link.download = `${
        quotation.quotation_number ||
        `quotation-${id}`
      }.pdf`;

      document.body.appendChild(link);

      link.click();
      link.remove();

      window.URL.revokeObjectURL(fileUrl);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to download quotation PDF",
      );
    } finally {
      setDownloading(false);
    }
  };

  const handlePushToCrm = async () => {
    if (!quotation || pushingToCrm) return;

    try {
      setPushingToCrm(true);

      const response = await api.post(
        `/quotations/${id}/push-to-crm`,
      );

      toast.success(
        response.data?.message ||
          "Quotation pushed to CRM successfully",
      );
    } catch (error) {
      console.error(
        "PUSH QUOTATION TO CRM ERROR:",
        error,
      );

      toast.error(
        error.response?.data?.message ||
          "Failed to push quotation to CRM",
      );
    } finally {
      setPushingToCrm(false);
    }
  };

  const snapshot = useMemo(
    () =>
      safeJson(
        quotation?.billing_template_snapshot,
      ),
    [quotation],
  );

  const template = useMemo(
    () =>
      safeTemplate(
        quotation?.billing_template_snapshot,
      ),
    [quotation],
  );

  const rendererCompany = useMemo(() => {
    const company = snapshot.company || {};

    return {
      ...company,
      name:
        company.name ||
        quotation?.business_name ||
        "Your Company",

      address:
        company.address ||
        quotation?.business_address ||
        "",

      email:
        company.email ||
        quotation?.business_email ||
        "",

      phone:
        company.phone ||
        quotation?.business_phone ||
        "",

      gst_number:
        company.gst_number ||
        quotation?.business_gst_number ||
        "",

      pan_number:
        company.pan_number ||
        quotation?.business_pan_number ||
        "",

      logo:
        company.logo ||
        quotation?.business_logo ||
        "",
    };
  }, [snapshot, quotation]);

  const rendererBranch = useMemo(() => {
    const branch = snapshot.branch || {};

    return {
      ...branch,

      branch_name:
        branch.branch_name ||
        quotation?.branch_name ||
        "",

      branch_code:
        branch.branch_code ||
        quotation?.branch_code ||
        "",
    };
  }, [snapshot, quotation]);

  const rendererBank = useMemo(
    () => snapshot.bank || {},
    [snapshot],
  );

  const rendererCustomer = useMemo(
    () => ({
      customer_name:
        quotation?.customer_name || "",

      company_name:
        quotation?.company_name || "",

      billing_address:
        quotation?.billing_address || "",

      shipping_address:
        quotation?.shipping_address || "",

      gstin:
        quotation?.gstin || "",

      email:
        quotation?.email || "",

      phone:
        quotation?.phone || "",
    }),
    [quotation],
  );

  if (loading) {
    return (
      <div className="flex min-h-[320px] w-full items-center justify-center px-3 sm:px-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white px-5 py-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <RefreshCcw
            size={22}
            className="mx-auto mb-3 animate-spin text-blue-600"
          />

          <h2 className="text-base font-semibold text-slate-900 dark:text-white sm:text-lg">
            Loading quotation
          </h2>

          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            Fetching quotation details...
          </p>
        </div>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <XCircle
          size={26}
          className="mx-auto mb-3 text-red-600 dark:text-red-400"
        />

        <h2 className="text-base font-semibold text-slate-900 dark:text-white sm:text-lg">
          Quotation not found
        </h2>

        <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500 dark:text-slate-400 sm:text-sm">
          This quotation may have been deleted or is no longer
          available.
        </p>

        <button
          type="button"
          onClick={() =>
            navigate("/dashboard/quotations")
          }
          className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 sm:w-auto"
        >
          Back to Quotations
        </button>
      </div>
    );
  }

  const canEdit = ["draft", "sent"].includes(
    quotation.status,
  );

  const canConvert =
    !BLOCKED_CONVERT_STATUSES.includes(
      quotation.status,
    );

  const canEmail =
    !BLOCKED_EMAIL_STATUSES.includes(
      quotation.status,
    );

  const canChangeStatus = ![
    "converted",
    "cancelled",
  ].includes(quotation.status);

  return (
    <div
      className={`w-full min-w-0 max-w-full ${
        isPrint
          ? "bg-white p-0"
          : "space-y-3 sm:space-y-4 lg:space-y-5"
      }`}
    >
      {!isPrint && (
        <div className="no-print w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4 lg:p-5">
          <div className="flex min-w-0 flex-col gap-4">
            {/* Header */}
            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-300 sm:text-sm">
                  <FileText
                    size={16}
                    className="shrink-0"
                  />

                  <span>
                    Quotation Details
                  </span>
                </div>

                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h1 className="min-w-0 max-w-full truncate text-xl font-semibold text-slate-900 dark:text-white sm:text-2xl">
                    {quotation.quotation_number ||
                      `Quotation #${id}`}
                  </h1>

                  <StatusBadge
                    status={quotation.status}
                  />
                </div>
              </div>

              {/* Desktop primary navigation */}
              <div className="hidden shrink-0 lg:flex lg:items-center lg:gap-2">
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/dashboard/quotations",
                    )
                  }
                  className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>

                {canEdit && (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/dashboard/quotations/${id}/edit`,
                      )
                    }
                    className="flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-700"
                  >
                    <Pencil size={16} />
                    Edit
                  </button>
                )}
              </div>
            </div>

            {/* Mobile / tablet Back + Edit */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:hidden">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/dashboard/quotations",
                  )
                }
                className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <ArrowLeft size={16} />
                Back
              </button>

              {canEdit && (
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/dashboard/quotations/${id}/edit`,
                    )
                  }
                  className="flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  <Pencil size={16} />
                  Edit Quotation
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                {/* Icon Actions */}
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <ActionButton
                    label={
                      downloading
                        ? "Downloading"
                        : "Download PDF"
                    }
                    icon={
                      <Download
                        size={17}
                        className={
                          downloading
                            ? "animate-bounce"
                            : ""
                        }
                      />
                    }
                    onClick={
                      downloadQuotationPdf
                    }
                    disabled={downloading}
                    className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
                  />

                  {canEmail && (
                    <ActionButton
                      label={
                        sendingEmail
                          ? "Sending..."
                          : "Send Email"
                      }
                      icon={
                        <Mail
                          size={17}
                          className={
                            sendingEmail
                              ? "animate-pulse"
                              : ""
                          }
                        />
                      }
                      onClick={
                        sendQuotationEmail
                      }
                      disabled={sendingEmail}
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                    />
                  )}

                  {canPushToCrm && (
                    <ActionButton
                      label={
                        pushingToCrm
                          ? "Pushing..."
                          : "Push to CRM"
                      }
                      icon={
                        <Send
                          size={17}
                          className={
                            pushingToCrm
                              ? "animate-pulse"
                              : ""
                          }
                        />
                      }
                      onClick={
                        handlePushToCrm
                      }
                      disabled={pushingToCrm}
                      className="bg-violet-600 text-white hover:bg-violet-700"
                    />
                  )}
                </div>

                {/* Status + Convert */}
                <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:flex xl:items-end">
                  <div className="min-w-0 md:min-w-[190px]">
                    <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Change Status
                    </label>

                    <StatusDropdown
                      value={
                        quotation.status
                      }
                      disabled={
                        statusUpdating ||
                        !canChangeStatus
                      }
                      onChange={
                        updateStatus
                      }
                    />
                  </div>

                  {canConvert && (
                    <button
                      type="button"
                      onClick={
                        convertToInvoice
                      }
                      disabled={converting}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 md:self-end xl:w-auto xl:min-w-[180px]"
                    >
                      <Repeat
                        size={16}
                        className={
                          converting
                            ? "animate-spin"
                            : ""
                        }
                      />

                      <span className="truncate">
                        {converting
                          ? "Converting..."
                          : "Convert to Invoice"}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview */}
      <div
        ref={printRef}
        className={`print-area w-full min-w-0 ${
          isPrint
            ? "overflow-visible border-0 bg-white p-0 shadow-none"
            : "rounded-2xl border border-slate-200 bg-slate-100 p-2 shadow-inner dark:border-slate-800 dark:bg-slate-950 sm:p-3 md:p-4 lg:rounded-3xl lg:p-5"
        }`}
      >
        <div
          className={
            isPrint
              ? "w-full"
              : "mx-auto w-full min-w-0 overflow-x-auto rounded-xl"
          }
        >
          <div
            className={
              isPrint
                ? "w-full"
                : "mx-auto w-full min-w-0"
            }
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
              className={
                isPrint
                  ? "print-document"
                  : "quotation-document-preview"
              }
            />
          </div>
        </div>
      </div>

      <style>{`
        ${
          !isPrint
            ? `
              .quotation-document-preview {
                width: 100%;
                max-width: 100%;
                margin-left: auto;
                margin-right: auto;
              }

              .quotation-document-preview img {
                max-width: 100%;
                height: auto;
              }

              .quotation-document-preview table {
                width: 100%;
                max-width: 100%;
              }

              @media (max-width: 639px) {
                .quotation-document-preview {
                  font-size: 11px;
                }

                .quotation-document-preview table {
                  font-size: 10px;
                }

                .quotation-document-preview th,
                .quotation-document-preview td {
                  padding-left: 4px !important;
                  padding-right: 4px !important;
                }
              }

              @media (min-width: 640px) and (max-width: 1023px) {
                .quotation-document-preview {
                  font-size: 12px;
                }
              }
            `
            : ""
        }

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

              .print-area > div,
              .print-area > div > div {
                width: 100% !important;
                max-width: 100% !important;
                padding: 0 !important;
                margin: 0 !important;
                background: white !important;
                box-shadow: none !important;
              }

              .print-document {
                width: 100% !important;
                max-width: 100% !important;
                padding: 0 !important;
                margin: 0 !important;
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
            margin: 0 !important;
            padding: 0 !important;
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
            margin: 0 !important;
            box-shadow: none !important;
          }

          .print-area > div,
          .print-area > div > div {
            width: 100% !important;
            max-width: 100% !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            box-shadow: none !important;
          }

          .print-area table {
            width: 100% !important;
            page-break-inside: auto;
          }

          .print-area tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }

          .print-area img {
            max-width: 100% !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  disabled = false,
  className = "",
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex h-10 min-w-0 items-center justify-center gap-2 rounded-xl px-3 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 sm:h-10 sm:text-sm ${className}`}
    >
      <span className="shrink-0">
        {icon}
      </span>

      <span className="truncate">
        {label}
      </span>
    </button>
  );
}

function StatusDropdown({
  value,
  onChange,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const options = [
    ...ALLOWED_STATUS_OPTIONS,

    ...(value === "converted"
      ? [
          {
            value: "converted",
            label: "Converted",
          },
        ]
      : []),
  ];

  const selected =
    options.find(
      (option) => option.value === value,
    ) || {
      value,
      label: value || "Draft",
    };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(
          event.target,
        )
      ) {
        setOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );
    };
  }, []);

  return (
    <div
      ref={dropdownRef}
      className="relative w-full min-w-0"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          setOpen((prev) => !prev)
        }
        className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:focus:ring-blue-950/50 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
      >
        <span className="min-w-0 truncate capitalize">
          {selected.label}
        </span>

        <ChevronDown
          size={17}
          className={`shrink-0 text-slate-500 transition-transform duration-200 dark:text-slate-400 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[100] max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {ALLOWED_STATUS_OPTIONS.map(
            (option) => {
              const active =
                option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(
                      option.value,
                    );

                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                    active
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                      : "text-slate-700 hover:bg-slate-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-blue-300"
                  }`}
                >
                  <span>
                    {option.label}
                  </span>

                  {active && (
                    <CheckCircle2
                      size={16}
                      className="shrink-0"
                    />
                  )}
                </button>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    draft:
      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",

    sent:
      "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",

    accepted:
      "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300",

    rejected:
      "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",

    expired:
      "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",

    converted:
      "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",

    cancelled:
      "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };

  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize sm:text-xs ${
        styles[status] || styles.draft
      }`}
    >
      {status || "draft"}
    </span>
  );
}

export default ViewQuotation;