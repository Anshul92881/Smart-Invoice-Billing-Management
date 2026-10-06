import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import DocumentRenderer from "./DocumentRenderer";
import {
  BadgePercent,
  Banknote,
  Building2,
  CheckCircle2,
  Eye,
  FileText,
  Image,
  Landmark,
  RefreshCcw,
  RotateCcw,
  Save,
  ShieldCheck,
  StickyNote,
  User,
  WalletCards,
  X,
} from "lucide-react";

import api from "../services/api";

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
};

const DEFAULT_COMPANY_SETTINGS = {
  invoice_prefix: "INV",
  invoice_start_number: 1,
  quotation_prefix: "QT",
  currency: "INR",
  timezone: "Asia/Kolkata",
  fiscal_year_start: "April",
  bank_name: "",
  account_holder_name: "",
  account_number: "",
  ifsc_code: "",
  upi_id: "",
  invoice_terms: "",
  payment_instructions: "",
  authorized_signatory_name: "",
};

const TEMPLATE_OPTIONS = [
  {
    key: "show_logo",
    title: "Company Logo",
    description: "Show company logo in document header.",
    icon: Image,
  },
  {
    key: "show_company_gst_pan",
    title: "Company GST / PAN",
    description: "Show verified GST and PAN details.",
    icon: BadgePercent,
  },
  {
    key: "show_branch_details",
    title: "Branch / HQ Details",
    description: "Show main branch or head office information.",
    icon: Building2,
  },
  {
    key: "show_customer_gstin",
    title: "Customer GSTIN",
    description: "Show customer tax registration number.",
    icon: User,
  },
  {
    key: "show_hsn_sac",
    title: "HSN / SAC",
    description: "Show HSN/SAC column in item table.",
    icon: Landmark,
  },
  {
    key: "show_item_description",
    title: "Item Description",
    description: "Show description below item/service name.",
    icon: FileText,
  },
  {
    key: "show_tax_breakdown",
    title: "Tax Breakdown",
    description: "Show tax summary and GST calculation.",
    icon: BadgePercent,
  },
  {
    key: "show_terms",
    title: "Terms & Conditions",
    description: "Show invoice terms from company settings.",
    icon: ShieldCheck,
  },
  {
    key: "show_notes",
    title: "Payment Instructions",
    description: "Show payment instructions from settings.",
    icon: StickyNote,
  },
  {
    key: "show_bank_details",
    title: "Bank Details",
    description: "Show bank account and IFSC details.",
    icon: Banknote,
  },
  {
    key: "show_signature",
    title: "Authorized Signature",
    description: "Show declaration and authorized signatory block.",
    icon: CheckCircle2,
  },
];

const APP_ORIGIN =
  import.meta.env?.VITE_API_ORIGIN ||
  import.meta.env?.VITE_SERVER_URL ||
  "http://localhost:5000";

const firstValue = (...values) =>
  values.find(
    (value) => value !== undefined && value !== null && value !== "",
  ) || "";

const safeTemplate = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const cleanTemplate = (template = {}) => {
  return Object.keys(DEFAULT_TEMPLATE).reduce((acc, key) => {
    acc[key] =
      typeof template[key] === "boolean"
        ? template[key]
        : DEFAULT_TEMPLATE[key];

    return acc;
  }, {});
};

const getLogoUrl = (logo) => {
  if (!logo) return "";
  if (String(logo).startsWith("http")) return logo;
  if (String(logo).startsWith("/upload")) return `${APP_ORIGIN}${logo}`;
  if (String(logo).startsWith("/uploads")) return `${APP_ORIGIN}${logo}`;

  return `${APP_ORIGIN}/upload/company-logos/${logo}`;
};

const buildCompanyView = (company = {}) => ({
  name: firstValue(company.name, company.company_name, "Your Company Name"),
  address: firstValue(company.address, "Company address not configured"),
  phone: firstValue(company.phone, "Phone not configured"),
  email: firstValue(company.email, "Email not configured"),
  gst_number: firstValue(company.gst_number, company.gstin),
  pan_number: firstValue(company.pan_number, company.pan),
  logoUrl: getLogoUrl(company.logo || company.logo_url || company.company_logo),
  state: firstValue(company.state),
  country: firstValue(company.country, "India"),
  zip_code: firstValue(company.zip_code),
});

const buildSettingsView = (settings = {}) => ({
  ...DEFAULT_COMPANY_SETTINGS,
  ...settings,
  invoice_prefix: firstValue(settings.invoice_prefix, "INV"),
  invoice_start_number: Number(settings.invoice_start_number || 1),
  quotation_prefix: firstValue(settings.quotation_prefix, "QT"),
  currency: firstValue(settings.currency, "INR"),
  authorized_signatory_name: firstValue(
    settings.authorized_signatory_name,
    settings.account_holder_name,
    "Authorized Signatory",
  ),
});

const buildBranchView = (branches = [], company = {}) => {
  const activeBranches = branches.filter(
    (branch) =>
      branch?.status === "active" ||
      branch?.status === 1 ||
      branch?.status === true,
  );

  const mainBranch =
    activeBranches.find(
      (branch) =>
        branch?.is_main === 1 ||
        branch?.is_main === true ||
        String(branch?.is_main) === "1",
    ) ||
    activeBranches[0] ||
    null;

  if (!mainBranch) {
    return {
      branch_name: "Head Office",
      branch_code: "",
      gst_number: firstValue(company.gst_number, company.gstin),
      address: firstValue(company.address, "Company address not configured"),
      phone: firstValue(company.phone),
      email: firstValue(company.email),
      city: "",
      state: firstValue(company.state),
      country: firstValue(company.country, "India"),
      zip_code: firstValue(company.zip_code),
    };
  }

  const addressLine = [
    mainBranch.address,
    mainBranch.city,
    mainBranch.state,
    mainBranch.country,
    mainBranch.zip_code,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    branch_name: firstValue(mainBranch.branch_name, "Head Office"),
    branch_code: firstValue(mainBranch.branch_code),
    gst_number: firstValue(mainBranch.gst_number, company.gst_number),
    address: firstValue(addressLine, company.address),
    phone: firstValue(mainBranch.phone, company.phone),
    email: firstValue(mainBranch.email, company.email),
    city: firstValue(mainBranch.city),
    state: firstValue(mainBranch.state),
    country: firstValue(mainBranch.country, "India"),
    zip_code: firstValue(mainBranch.zip_code),
  };
};

function BillingTemplate() {
  const [settings, setSettings] = useState(DEFAULT_TEMPLATE);
  const [previewType, setPreviewType] = useState("invoice");
  const [company, setCompany] = useState({});
  const [companySettings, setCompanySettings] = useState(
    DEFAULT_COMPANY_SETTINGS,
  );
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const documentTitle = previewType === "invoice" ? "TAX INVOICE" : "QUOTATION";

  const enabledCount = useMemo(
    () =>
      Object.values(settings || {}).filter((value) => value === true).length,
    [settings],
  );

  const previewCompany = useMemo(() => buildCompanyView(company), [company]);

  const previewSettings = useMemo(
    () => buildSettingsView(companySettings),
    [companySettings],
  );

  const previewBranch = useMemo(
    () => buildBranchView(branches, company),
    [branches, company],
  );

  const previewCustomer = useMemo(
    () => ({
      customer_name: "Sample Customer",
      company_name: "Sample Customer Company",
      billing_address:
        "Sample billing address\nMumbai, Maharashtra - 400001, India",
      shipping_address:
        "Sample shipping address\nMumbai, Maharashtra - 400001, India",
      gstin: "27AAAAA0000A1Z5",
      email: "customer@example.com",
      phone: "+91 90000 00000",
    }),
    [],
  );

  const previewItems = useMemo(
    () => [
      {
        item_name: "Sample Product",
        description: "Sample item description",
        hsn_sac_code: "9983",
        quantity: 2,
        unit_type: "Nos",
        price: 1500,
        tax_rate: 18,
        tax_amount: 540,
        line_total: 3540,
      },
      {
        item_name: "Sample Service",
        description: "Sample service description",
        hsn_sac_code: "9984",
        quantity: 1,
        unit_type: "Job",
        price: 1000,
        tax_rate: 18,
        tax_amount: 180,
        line_total: 1180,
      },
    ],
    [],
  );

  const previewDocument = useMemo(() => {
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(today.getDate() + 14);

    const subtotal = previewItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0),
      0,
    );

    const taxAmount = previewItems.reduce(
      (sum, item) => sum + Number(item.tax_amount || 0),
      0,
    );

    const totalAmount = previewItems.reduce(
      (sum, item) => sum + Number(item.line_total || 0),
      0,
    );

    return {
      invoice_number: `${previewSettings.invoice_prefix || "INV"}-PREVIEW`,
      quotation_number: `${previewSettings.quotation_prefix || "QT"}-PREVIEW`,
      invoice_date: today.toISOString().slice(0, 10),
      quotation_date: today.toISOString().slice(0, 10),
      due_date: dueDate.toISOString().slice(0, 10),
      expiry_date: dueDate.toISOString().slice(0, 10),
      status: "draft",
      subtotal,
      tax_amount: taxAmount,
      total_tax: taxAmount,
      discount_amount: 0,
      total_amount: totalAmount,
      terms_conditions: previewSettings.invoice_terms,
      notes: previewSettings.payment_instructions,
      currency: previewSettings.currency || "INR",
    };
  }, [previewItems, previewSettings]);

  const fetchTemplateData = async () => {
    try {
      setLoading(true);

      const results = await Promise.allSettled([
        api.get("/companies/my-company"),
        api.get("/companies/my-company/settings"),
        api.get("/branches"),
        api.get("/companies/billing-template"),
      ]);

      const companyRes =
        results[0].status === "fulfilled" ? results[0].value : { data: {} };

      const settingsRes =
        results[1].status === "fulfilled" ? results[1].value : { data: {} };

      const branchesRes =
        results[2].status === "fulfilled" ? results[2].value : { data: [] };

      const templateRes =
        results[3].status === "fulfilled"
          ? results[3].value
          : { data: { billing_template: DEFAULT_TEMPLATE } };

      const billingTemplate = cleanTemplate(
        safeTemplate(templateRes.data?.billing_template),
      );

      setCompany(companyRes.data || {});
      setCompanySettings({
        ...DEFAULT_COMPANY_SETTINGS,
        ...(settingsRes.data || {}),
      });
      setBranches(Array.isArray(branchesRes.data) ? branchesRes.data : []);
      setSettings(billingTemplate);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to load company billing template",
      );
      setSettings({ ...DEFAULT_TEMPLATE });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplateData();
  }, []);

  const toggleSetting = (key) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const resetTemplate = () => {
    setSettings({ ...DEFAULT_TEMPLATE });
    toast.success("Template reset to default");
  };

  const saveTemplate = async () => {
    try {
      setSaving(true);

      await api.put("/companies/billing-template", {
        billing_template: cleanTemplate(settings),
      });

      toast.success("Billing template saved successfully");
      await fetchTemplateData();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to save billing template",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <RefreshCcw className="mx-auto mb-3 animate-spin text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Loading Billing Template
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            Syncing company profile, company settings, branches and template...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-5 font-sans text-slate-900 dark:text-slate-100">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-sm">
              <WalletCards size={22} />
            </div>

            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Billing Template
              </h1>

              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                Company profile, settings and main branch are synced in live
                preview.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetTemplate}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
            >
              <RotateCcw size={15} />
              Reset
            </button>

            <button
              type="button"
              onClick={saveTemplate}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-sm outline-none ring-0 transition hover:bg-blue-700 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={15} />
              {saving ? "Saving..." : "Save Template"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Visibility Controls
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {enabledCount} / {TEMPLATE_OPTIONS.length} sections enabled
            </p>
          </div>

          <div className="space-y-2">
            {TEMPLATE_OPTIONS.map((option) => (
              <ToggleCard
                key={option.key}
                option={option}
                checked={Boolean(settings[option.key])}
                onToggle={() => toggleSetting(option.key)}
              />
            ))}
          </div>
        </section>

        <section className="min-w-0 space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Document Preview
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Preview uses your real company, branch and bank data.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(true)}
                  className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm outline-none ring-0 transition hover:bg-slate-800 focus:outline-none focus:ring-0 dark:bg-slate-800 dark:hover:bg-slate-700"
                >
                  <Eye size={15} />
                  Full Preview
                </button>

                <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                  <PreviewTab
                    active={previewType === "invoice"}
                    onClick={() => setPreviewType("invoice")}
                  >
                    Invoice
                  </PreviewTab>

                  <PreviewTab
                    active={previewType === "quotation"}
                    onClick={() => setPreviewType("quotation")}
                  >
                    Quotation
                  </PreviewTab>
                </div>
              </div>
            </div>
          </div>

          <div className="max-h-[850px] overflow-auto rounded-3xl border border-slate-200 bg-[#eef2f7] p-6 shadow-inner dark:border-slate-800 dark:bg-slate-950">
            <DocumentRenderer
              type={previewType}
              template={settings}
              company={previewCompany}
              branch={previewBranch}
              bank={previewSettings}
              customer={previewCustomer}
              document={previewDocument}
              items={previewItems}
            />
          </div>
        </section>
      </div>

      {showPreviewModal && (
        <div className="fixed inset-0 z-[50000] bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-[#eef2f7] shadow-[0_20px_60px_rgba(0,0,0,0.45)] outline-none ring-0 dark:border-slate-700 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Full Document Preview
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {documentTitle} preview
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 focus:outline-none focus:ring-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 dark:bg-slate-950">
              <DocumentRenderer
                type={previewType}
                template={settings}
                company={previewCompany}
                branch={previewBranch}
                bank={previewSettings}
                customer={previewCustomer}
                document={previewDocument}
                items={previewItems}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewTab({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-1.5 text-sm font-semibold outline-none ring-0 transition focus:outline-none focus:ring-0 ${
        active
          ? "bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300"
          : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function ToggleCard({ option, checked, onToggle }) {
  const Icon = option.icon;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left outline-none ring-0 transition focus:outline-none focus:ring-0 ${
        checked
          ? "border-blue-200 bg-blue-50/70 dark:border-blue-900/50 dark:bg-blue-950/30"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800"
      }`}
      aria-pressed={checked}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
            checked
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
          }`}
        >
          <Icon size={16} />
        </span>

        <span className="min-w-0">
          <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">
            {option.title}
          </span>
          <span className="block text-xs leading-snug text-slate-500 dark:text-slate-400">
            {option.description}
          </span>
        </span>
      </span>

      <span
        className={`relative h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
          checked ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
        }`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

export default BillingTemplate;
