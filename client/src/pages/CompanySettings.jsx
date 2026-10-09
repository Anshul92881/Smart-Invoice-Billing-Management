import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import api from "../services/api";
import {
  Settings,
  Building2,
  Landmark,
  FileText,
  Save,
  Wallet,
  CalendarDays,
  BadgeIndianRupee,
  ReceiptText,
  Pencil,
  X,
  Mail,
  Send,
  Eye,
  EyeOff,
  ShieldCheck,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";

const INITIAL_FORM = {
  invoice_prefix: "INV",
  quotation_prefix: "QUO",
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

const INITIAL_EMAIL_FORM = {
  smtp_host: "",
  smtp_port: 465,
  smtp_user: "",
  smtp_pass: "",
  smtp_secure: true,
  from_email: "",
  from_name: "",
  reply_to: "",
};

const normalizeSettings = (data = {}) => ({
  invoice_prefix: String(data.invoice_prefix || "INV")
    .trim()
    .toUpperCase(),
  quotation_prefix: String(data.quotation_prefix || "QUO")
    .trim()
    .toUpperCase(),
  currency: "INR",
  timezone: "Asia/Kolkata",
  fiscal_year_start: "April",
  bank_name: data.bank_name || "",
  account_holder_name: data.account_holder_name || "",
  account_number: data.account_number || "",
  ifsc_code: String(data.ifsc_code || "")
    .trim()
    .toUpperCase(),
  upi_id: String(data.upi_id || "").trim(),
  invoice_terms: data.invoice_terms || "",
  payment_instructions: data.payment_instructions || "",
  authorized_signatory_name: String(
    data.authorized_signatory_name || "",
  ).trim(),
});

const normalizeEmailSettings = (data = {}) => ({
  smtp_host: String(data.smtp_host || "").trim(),
  smtp_port: Number(data.smtp_port || 465),
  smtp_user: String(data.smtp_user || "").trim(),
  smtp_pass: "",
  smtp_secure:
    data.smtp_secure === true ||
    data.smtp_secure === 1 ||
    data.smtp_secure === "1",
  from_email: String(data.from_email || "").trim(),
  from_name: String(data.from_name || "").trim(),
  reply_to: String(data.reply_to || "").trim(),
});

const isValidEmail = (email) => {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
};

function CompanySettings() {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [savedData, setSavedData] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [editMode, setEditMode] = useState(false);

  const [emailForm, setEmailForm] = useState(INITIAL_EMAIL_FORM);
  const [savedEmail, setSavedEmail] = useState(INITIAL_EMAIL_FORM);
  const [emailEditMode, setEmailEditMode] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testLoading, setTestLoading] = useState(false);

  const hasChanges = useMemo(
    () =>
      JSON.stringify(normalizeSettings(formData)) !== JSON.stringify(savedData),
    [formData, savedData],
  );

  const hasEmailChanges = useMemo(() => {
    const current = normalizeEmailSettings(emailForm);
    const saved = normalizeEmailSettings(savedEmail);

    return (
      JSON.stringify({
        ...current,
        smtp_pass: emailForm.smtp_pass ? "__changed__" : "",
      }) !==
      JSON.stringify({
        ...saved,
        smtp_pass: "",
      })
    );
  }, [emailForm, savedEmail]);

  const fetchSettings = async () => {
    try {
      setFetching(true);

      const [settingsRes, emailRes] = await Promise.all([
        api.get("/companies/my-company/settings"),
        api.get("/companies/email-settings"),
      ]);

      const data = normalizeSettings(settingsRes.data || {});
      const emailData = normalizeEmailSettings(emailRes.data || {});

      setFormData(data);
      setSavedData(data);
      setEmailForm(emailData);
      setSavedEmail(emailData);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch settings");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let nextValue = value;

    if (["invoice_prefix", "quotation_prefix", "ifsc_code"].includes(name)) {
      nextValue = value.toUpperCase();
    }

    setFormData((prev) => ({ ...prev, [name]: nextValue }));
  };

  const updateField = (name, value) => {
    handleChange({ target: { name, value } });
  };

  const handleEmailChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEmailForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleCancel = () => {
    setFormData(savedData);
    setEditMode(false);
  };

  const handleEmailCancel = () => {
    setEmailForm(savedEmail);
    setEmailEditMode(false);
    setShowPassword(false);
  };

  const validateSettings = () => {
    const payload = normalizeSettings(formData);

    if (!payload.invoice_prefix) {
      toast.error("Invoice prefix is required");
      return false;
    }

    if (!payload.quotation_prefix) {
      toast.error("Quotation prefix is required");
      return false;
    }

    if (
      payload.ifsc_code &&
      !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(payload.ifsc_code)
    ) {
      toast.error("Please enter a valid IFSC code");
      return false;
    }

    if (payload.upi_id && !/^[\w.-]+@[\w.-]+$/.test(payload.upi_id)) {
      toast.error("Please enter a valid UPI ID");
      return false;
    }

    return true;
  };

  const validateEmailSettings = () => {
    const payload = normalizeEmailSettings(emailForm);

    if (!payload.smtp_host) {
      toast.error("SMTP host is required");
      return false;
    }

    if (!payload.smtp_port || Number(payload.smtp_port) <= 0) {
      toast.error("SMTP port is required");
      return false;
    }

    if (!payload.smtp_user) {
      toast.error("SMTP user is required");
      return false;
    }

    if (!savedEmail.smtp_user && !emailForm.smtp_pass) {
      toast.error("SMTP password is required");
      return false;
    }

    if (payload.from_email && !isValidEmail(payload.from_email)) {
      toast.error("Please enter a valid from email");
      return false;
    }

    if (payload.reply_to && !isValidEmail(payload.reply_to)) {
      toast.error("Please enter a valid reply-to email");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateSettings()) return;

    try {
      setLoading(true);
      const payload = normalizeSettings(formData);
      const res = await api.put("/companies/my-company/settings", payload);

      toast.success(
        res.data.message || "Company settings updated successfully",
      );
      await fetchSettings();
      setEditMode(false);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update settings");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!validateEmailSettings()) return;

    try {
      setEmailLoading(true);
      const payload = {
        ...normalizeEmailSettings(emailForm),
        smtp_pass: emailForm.smtp_pass,
      };

      const res = await api.put("/companies/email-settings", payload);

      toast.success(res.data.message || "Email settings saved successfully");
      await fetchSettings();
      setEmailEditMode(false);
      setShowPassword(false);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to update email settings",
      );
    } finally {
      setEmailLoading(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail.trim()) {
      toast.error("Test email is required");
      return;
    }

    if (!isValidEmail(testEmail)) {
      toast.error("Please enter a valid test email");
      return;
    }

    try {
      setTestLoading(true);

      const res = await api.post("/companies/test-email", {
        test_email: testEmail.trim(),
      });

      toast.success(res.data.message || "Test email sent successfully");
      setTestEmail("");
    } catch (error) {
      toast.error(error.response?.data?.message || "Test email failed");
    } finally {
      setTestLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex min-h-[260px] items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Settings className="mx-auto mb-3 animate-spin text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Loading Company Settings
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            Fetching invoice, bank, payment and email defaults...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
              <Settings size={17} />
              Company Settings
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Manage Company Settings
            </h1>

            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              Configure invoice numbering, bank details, payment instructions
              and business email.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {!editMode && (
              <PrimaryButton type="button" onClick={() => setEditMode(true)}>
                <Pencil size={17} />
                Update Settings
              </PrimaryButton>
            )}

            {!emailEditMode && (
              <button
                type="button"
                onClick={() => setEmailEditMode(true)}
                className="flex w-fit items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-slate-800 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:ring-0 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                <Mail size={17} />
                Email Config
              </button>
            )}
          </div>
        </div>
      </div>

      {!editMode ? (
        <Card>
          <SectionHeader
            icon={<FileText size={18} />}
            title="Saved Company Settings"
            description="Current saved invoice, quotation, bank and payment settings."
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Info label="Invoice Prefix" value={savedData.invoice_prefix} />
            <Info label="Quotation Prefix" value={savedData.quotation_prefix} />
            <Info label="Currency" value={savedData.currency} />
            <Info label="Timezone" value={savedData.timezone} />
            <Info label="Financial Year" value="April – March" />
            <Info label="Bank Name" value={savedData.bank_name} />
            <Info
              label="Account Holder"
              value={savedData.account_holder_name}
            />
            <Info label="Account Number" value={savedData.account_number} />
            <Info label="IFSC Code" value={savedData.ifsc_code} />
            <Info label="UPI ID" value={savedData.upi_id} />
            <Info
              label="Authorized Signatory"
              value={savedData.authorized_signatory_name}
            />
          </div>

          <Divider />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <InfoBlock label="Invoice Terms" value={savedData.invoice_terms} />
            <InfoBlock
              label="Payment Instructions"
              value={savedData.payment_instructions}
            />
          </div>
        </Card>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <SectionHeader
            icon={<FileText size={18} />}
            title="Invoice & Quotation Settings"
            description="Manage default invoice and quotation numbering format."
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field icon={<ReceiptText size={16} />} label="Invoice Prefix">
              <input
                name="invoice_prefix"
                value={formData.invoice_prefix}
                onChange={handleChange}
                className="input uppercase"
                maxLength={10}
                placeholder="INV"
              />
            </Field>

            <Field icon={<ReceiptText size={16} />} label="Quotation Prefix">
              <input
                name="quotation_prefix"
                value={formData.quotation_prefix}
                onChange={handleChange}
                className="input uppercase"
                maxLength={10}
                placeholder="QT"
              />
            </Field>

            <Field icon={<BadgeIndianRupee size={16} />} label="Currency">
              <div className="flex min-h-[43px] items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                INR – Indian Rupee (₹)
              </div>
            </Field>
          </div>

          <Divider />

          <SectionHeader
            icon={<Building2 size={18} />}
            title="Business Defaults"
            description="Manage default timezone and fiscal year preferences."
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field icon={<CalendarDays size={16} />} label="Timezone">
              <div className="flex min-h-[43px] items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                Asia/Kolkata (IST)
              </div>
            </Field>

            <Field icon={<CalendarDays size={16} />} label="Financial Year">
              <div className="flex min-h-[43px] items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                April – March
              </div>
            </Field>
          </div>

          <Divider />

          <SectionHeader
            icon={<Landmark size={18} />}
            title="Bank Details"
            description="These details can be shown on invoices and payment emails."
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field icon={<Landmark size={16} />} label="Bank Name">
              <input
                name="bank_name"
                value={formData.bank_name}
                onChange={handleChange}
                className="input"
                placeholder="Example: HDFC Bank"
              />
            </Field>

            <Field icon={<Wallet size={16} />} label="Account Holder Name">
              <input
                name="account_holder_name"
                value={formData.account_holder_name}
                onChange={handleChange}
                className="input"
                placeholder="Account holder name"
              />
            </Field>

            <Field icon={<Wallet size={16} />} label="Account Number">
              <input
                name="account_number"
                inputMode="numeric"
                value={formData.account_number}
                onChange={handleChange}
                className="input"
                placeholder="Account number"
              />
            </Field>

            <Field icon={<Wallet size={16} />} label="IFSC Code">
              <input
                name="ifsc_code"
                value={formData.ifsc_code}
                onChange={handleChange}
                className="input uppercase"
                placeholder="HDFC0001234"
                maxLength={11}
              />
            </Field>

            <Field icon={<BadgeIndianRupee size={16} />} label="UPI ID">
              <input
                name="upi_id"
                value={formData.upi_id}
                onChange={handleChange}
                className="input"
                placeholder="yourname@bank"
              />
            </Field>

            <Field
              icon={<ShieldCheck size={16} />}
              label="Authorized Signatory"
            >
              <input
                name="authorized_signatory_name"
                value={formData.authorized_signatory_name}
                onChange={handleChange}
                className="input"
                placeholder="Authorized Name"
              />
            </Field>
          </div>

          <Divider />

          <SectionHeader
            icon={<FileText size={18} />}
            title="Invoice Notes"
            description="Default terms and payment instructions shown on invoices."
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Field icon={<FileText size={16} />} label="Invoice Terms">
              <textarea
                rows="4"
                name="invoice_terms"
                value={formData.invoice_terms}
                onChange={handleChange}
                className="input"
                placeholder="Example: Payment due within 15 days."
              />
            </Field>

            <Field icon={<Wallet size={16} />} label="Payment Instructions">
              <textarea
                rows="4"
                name="payment_instructions"
                value={formData.payment_instructions}
                onChange={handleChange}
                className="input"
                placeholder="Example: Please mention invoice number while making payment."
              />
            </Field>
          </div>

          <FormActions
            loading={loading}
            hasChanges={hasChanges}
            onCancel={handleCancel}
            saveText={loading ? "Saving..." : "Save Changes"}
          />
        </form>
      )}

      {!emailEditMode ? (
        <Card>
          <SectionHeader
            icon={<Mail size={18} />}
            title="Email Configuration"
            description="Company-level SMTP settings used for invoice, quotation and payment emails."
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Info label="SMTP Host" value={savedEmail.smtp_host} />
            <Info label="SMTP Port" value={savedEmail.smtp_port} />
            <Info label="SMTP User" value={savedEmail.smtp_user} />
            <Info
              label="Secure SSL/TLS"
              value={savedEmail.smtp_secure ? "Enabled" : "Disabled"}
            />
            <Info
              label="From Email"
              value={savedEmail.from_email || savedEmail.smtp_user}
            />
            <Info label="From Name" value={savedEmail.from_name} />
            <Info label="Reply To" value={savedEmail.reply_to} />
            <Info
              label="SMTP Password"
              value={savedEmail.smtp_user ? "Saved securely" : "-"}
            />
          </div>

          <Divider />

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
            <input
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="input"
              placeholder="Enter email to send test email"
            />

            <button
              type="button"
              onClick={handleTestEmail}
              disabled={testLoading || !savedEmail.smtp_host}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-emerald-700 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-emerald-400"
            >
              <Send size={16} />
              {testLoading ? "Sending..." : "Send Test Email"}
            </button>
          </div>
        </Card>
      ) : (
        <form
          onSubmit={handleEmailSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <SectionHeader
            icon={<Mail size={18} />}
            title="Email Configuration"
            description="Configure company SMTP. These details will be used to send invoices and quotations from this company email."
          />

          <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/30">
            <div className="flex gap-3">
              <ShieldCheck
                className="mt-0.5 shrink-0 text-blue-700 dark:text-blue-300"
                size={18}
              />
              <div>
                <p className="text-sm font-bold text-blue-900 dark:text-blue-200">
                  Multi-tenant company email
                </p>
                <p className="mt-1 text-sm font-medium leading-6 text-blue-700 dark:text-blue-300">
                  This SMTP belongs only to this company. Other companies will
                  use their own SMTP configuration.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field icon={<Mail size={16} />} label="SMTP Host">
              <input
                name="smtp_host"
                value={emailForm.smtp_host}
                onChange={handleEmailChange}
                className="input"
                placeholder="smtp.gmail.com"
              />
            </Field>

            <Field icon={<Mail size={16} />} label="SMTP Port">
              <input
                type="number"
                name="smtp_port"
                value={emailForm.smtp_port}
                onChange={handleEmailChange}
                className="input"
                placeholder="465"
              />
            </Field>

            <Field icon={<Mail size={16} />} label="SMTP User">
              <input
                name="smtp_user"
                value={emailForm.smtp_user}
                onChange={handleEmailChange}
                className="input"
                placeholder="billing@company.com"
              />
            </Field>

            <Field icon={<ShieldCheck size={16} />} label="SMTP Password">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="smtp_pass"
                  value={emailForm.smtp_pass}
                  onChange={handleEmailChange}
                  className="input pr-10"
                  placeholder={
                    savedEmail.smtp_user
                      ? "Leave blank to keep existing"
                      : "SMTP app password"
                  }
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 outline-none transition hover:text-slate-800 focus:outline-none focus:ring-0 dark:text-slate-400 dark:hover:text-white"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </Field>

            <Field icon={<Mail size={16} />} label="From Email">
              <input
                name="from_email"
                value={emailForm.from_email}
                onChange={handleEmailChange}
                className="input"
                placeholder="billing@company.com"
              />
            </Field>

            <Field icon={<Building2 size={16} />} label="From Name">
              <input
                name="from_name"
                value={emailForm.from_name}
                onChange={handleEmailChange}
                className="input"
                placeholder="Company Name"
              />
            </Field>

            <Field icon={<Mail size={16} />} label="Reply To">
              <input
                name="reply_to"
                value={emailForm.reply_to}
                onChange={handleEmailChange}
                className="input"
                placeholder="support@company.com"
              />
            </Field>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  name="smtp_secure"
                  checked={emailForm.smtp_secure}
                  onChange={handleEmailChange}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900"
                />

                <span>
                  <span className="block text-sm font-bold text-slate-900 dark:text-white">
                    Secure SSL/TLS
                  </span>
                  <span className="mt-1 block text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                    Enable for port 465. Disable usually for port 587.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <Divider />

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              Common SMTP examples
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 text-sm font-medium text-slate-600 dark:text-slate-300 md:grid-cols-3">
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-100">
                  Gmail
                </p>
                <p>Host: smtp.gmail.com</p>
                <p>Port: 465</p>
                <p>Secure: true</p>
              </div>
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-100">
                  Zoho India
                </p>
                <p>Host: smtp.zoho.in</p>
                <p>Port: 465</p>
                <p>Secure: true</p>
              </div>
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-100">
                  Outlook
                </p>
                <p>Host: smtp.office365.com</p>
                <p>Port: 587</p>
                <p>Secure: false</p>
              </div>
            </div>
          </div>

          <FormActions
            loading={emailLoading}
            hasChanges={hasEmailChanges}
            onCancel={handleEmailCancel}
            saveText={emailLoading ? "Verifying..." : "Save & Verify SMTP"}
          />
        </form>
      )}

      <style>{`
        .input {
          width: 100%;
          border: 1px solid #cbd5e1;
          padding: 10px 12px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          color: #334155;
          outline: none;
          background: #ffffff;
          transition: all 0.2s ease;
        }

        .input::placeholder {
          color: #94a3b8;
        }

        textarea.input {
          min-height: 110px;
          resize: vertical;
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
        }
      `}</style>
    </div>
  );
}

function PrimaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className="flex w-fit items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:ring-0 disabled:cursor-not-allowed disabled:bg-blue-400"
    >
      {children}
    </button>
  );
}

function Card({ children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {children}
    </div>
  );
}

function SectionHeader({ icon, title, description }) {
  return (
    <div className="mb-5">
      <div className="mb-1 flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
        <span className="text-blue-700 dark:text-blue-300">{icon}</span>
        {title}
      </div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}

function Field({ label, icon, children }) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <span className="text-slate-500 dark:text-slate-400">{icon}</span>
        {label}
      </label>
      {children}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-normal text-slate-900 dark:text-white">
        {value || "-"}
      </p>
    </div>
  );
}

function InfoBlock({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-700 dark:text-slate-200">
        {value || "-"}
      </p>
    </div>
  );
}

function Divider() {
  return (
    <div className="my-6 border-t border-slate-200 dark:border-slate-800" />
  );
}

function CustomSelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const selected = options.find(
    (option) => String(option.value) === String(value),
  );

  useEffect(() => {
    const closeDropdown = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
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
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 shadow-sm outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:focus:ring-blue-950/50"
      >
        <span className="truncate">{selected?.label || "Select"}</span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-500 transition dark:text-slate-400 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-[9999] max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
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
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800 dark:hover:text-blue-300 ${
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
      )}
    </div>
  );
}

function FormActions({ loading, hasChanges, onCancel, saveText }) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-end">
      {hasChanges && (
        <p className="mr-auto text-sm font-semibold text-amber-600 dark:text-amber-400">
          You have unsaved changes.
        </p>
      )}

      <button
        type="button"
        onClick={onCancel}
        disabled={loading}
        className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-200 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
      >
        <X size={16} />
        Cancel
      </button>

      <button
        type="submit"
        disabled={loading || !hasChanges}
        className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-blue-400"
      >
        <Save size={17} />
        {saveText}
      </button>
    </div>
  );
}

export default CompanySettings;
