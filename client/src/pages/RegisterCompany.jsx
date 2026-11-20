import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Hash,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;
const NAME_REGEX = /^[a-zA-Z0-9\s.&'(),-]+$/;
const BRANCH_CODE_REGEX = /^[a-zA-Z0-9_-]{2,20}$/;
const PASSWORD_MESSAGE =
  "Password must be 8-128 characters and include uppercase, lowercase, number and special character";
const cleanString = (value) =>
  String(value || "")
    .replace(/<[^>]*>?/gm, "")
    .trim();
const normalizeEmail = (email) => cleanString(email).toLowerCase();
const normalizeUpper = (value) => cleanString(value).toUpperCase();
const isStrongPassword = (password) =>
  typeof password === "string" &&
  password.length >= 8 &&
  password.length <= 128 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9]/.test(password);
function RegisterCompany() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    company_name: "",
    company_email: "",
    company_phone: "",
    hq_branch_code: "",
    admin_name: "",
    admin_email: "",
    password: "",
    confirm_password: "",
  });
  const progress = useMemo(() => (step === 1 ? 50 : 100), [step]);
  useEffect(() => {
    if (Object.keys(errors).length === 0) return;
    const timer = setTimeout(() => {
      setErrors({});
    }, 2500); // 2.5 seconds
    return () => clearTimeout(timer);
  }, [errors]);
  const updateField = (name, value) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };
  const validateStepOne = () => {
    const nextErrors = {};
    const companyName = cleanString(formData.company_name);
    const companyEmail = normalizeEmail(formData.company_email);
    const companyPhone = cleanString(formData.company_phone);
    const hqBranchCode = normalizeUpper(formData.hq_branch_code);
    if (!companyName) {
      nextErrors.company_name = "Company name is required";
    } else if (companyName.length < 3 || companyName.length > 100) {
      nextErrors.company_name =
        "Company name must be between 3 and 100 characters";
    } else if (!NAME_REGEX.test(companyName)) {
      nextErrors.company_name = "Company name contains invalid characters";
    }
    if (!companyEmail) {
      nextErrors.company_email = "Company email is required";
    } else if (!EMAIL_REGEX.test(companyEmail)) {
      nextErrors.company_email = "Invalid company email format";
    }
    if (companyPhone && !PHONE_REGEX.test(companyPhone)) {
      nextErrors.company_phone =
        "Company phone must be a valid 10 digit Indian mobile number";
    }
    if (!hqBranchCode) {
      nextErrors.hq_branch_code = "Head Office code is required";
    } else if (!BRANCH_CODE_REGEX.test(hqBranchCode)) {
      nextErrors.hq_branch_code =
        "Head Office code must be 2-20 characters and can contain letters, numbers, underscore or hyphen";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };
  const validateStepTwo = () => {
    const nextErrors = {};
    const adminName = cleanString(formData.admin_name);
    const adminEmail = normalizeEmail(formData.admin_email);
    if (!adminName) {
      nextErrors.admin_name = "Admin name is required";
    } else if (adminName.length < 3 || adminName.length > 50) {
      nextErrors.admin_name = "Admin name must be between 3 and 50 characters";
    } else if (!NAME_REGEX.test(adminName)) {
      nextErrors.admin_name = "Admin name contains invalid characters";
    }
    if (!adminEmail) {
      nextErrors.admin_email = "Admin email is required";
    } else if (!EMAIL_REGEX.test(adminEmail)) {
      nextErrors.admin_email = "Invalid admin email format";
    }
    if (!formData.password) {
      nextErrors.password = "Password is required";
    } else if (!isStrongPassword(formData.password)) {
      nextErrors.password = PASSWORD_MESSAGE;
    }
    if (!formData.confirm_password) {
      nextErrors.confirm_password = "Confirm password is required";
    } else if (formData.password !== formData.confirm_password) {
      nextErrors.confirm_password = "Passwords do not match";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };
  const goNext = () => {
    if (!validateStepOne()) return;
    setStep(2);
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStepTwo()) return;
    try {
      setLoading(true);
      const payload = {
        company_name: cleanString(formData.company_name),
        company_email: normalizeEmail(formData.company_email),
        company_phone: cleanString(formData.company_phone),
        hq_branch_name: cleanString(formData.company_name),
        hq_branch_code: normalizeUpper(formData.hq_branch_code),
        admin_name: cleanString(formData.admin_name),
        admin_email: normalizeEmail(formData.admin_email),
        password: formData.password,
        confirm_password: formData.confirm_password,
      };
      const { data } = await api.post("/auth/company-register", payload);
      toast.success(data.message || "Company registered successfully");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (data.token) localStorage.setItem("kyc_token", data.token);
      if (data.user)
        localStorage.setItem("kyc_user", JSON.stringify(data.user));
      localStorage.setItem("pending_company_id", data.company_id);
      localStorage.setItem("pending_admin_email", payload.admin_email);
      navigate(`/kyc-verification/${data.company_id}`, {
        replace: true,
        state: {
          email: payload.admin_email,
          companyId: data.company_id,
        },
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 p-3 sm:p-4 lg:h-dvh lg:overflow-hidden lg:p-5">
      <div className="mx-auto grid min-h-[calc(100vh-24px)] w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:min-h-[calc(100vh-32px)] lg:h-[calc(100vh-40px)] lg:min-h-0 lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative hidden overflow-hidden bg-slate-950 p-8 text-white lg:block xl:p-10">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-600/25 blur-3xl" />
          <div className="absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <div className="mb-10 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-900/30">
                  <FileText size={26} />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold">Smart Invoice</h1>
                  <p className="text-sm text-slate-400">
                    SaaS Billing Management
                  </p>
                </div>
              </div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-100">
                <Sparkles size={14} />
                Start your company workspace
              </div>
              <h2 className="max-w-lg text-2xl font-semibold leading-tight xl:text-3xl">
                Start Your Business Journey with Smart Invoice
              </h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
                Create the workspace, add your head office and prepare your
                administrator account in two simple steps.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <FeatureItem
                icon={<Building2 size={18} />}
                title="Company workspace"
                text="Keep customers, invoices and business records together."
              />
              <FeatureItem
                icon={<ShieldCheck size={18} />}
                title="Secure admin access"
                text="Your primary administrator account is created instantly."
              />
              <FeatureItem
                icon={<CheckCircle2 size={18} />}
                title="Head office ready"
                text="Your main branch is available across the platform."
              />
            </div>
          </div>
        </section>
        <section className="flex min-h-full items-center overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 lg:min-h-0 lg:overflow-hidden lg:px-9 lg:py-5">
          <div className="mx-auto w-full max-w-md">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-blue-700"
            >
              <ArrowLeft size={16} />
              Back to login
            </button>
            <div className="mb-3 text-center sm:text-left">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm lg:hidden">
                <FileText size={28} />
              </div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                <Building2 size={14} />
                Company Signup
              </div>
              <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                Create Company Account
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Step {step} of 2 —{" "}
                {step === 1 ? "Company details" : "Admin details"}
              </p>
            </div>
            <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
              {step === 1 ? (
                <>
                  <Input
                    label="Company Name"
                    name="company_name"
                    value={formData.company_name}
                    onChange={(e) =>
                      updateField("company_name", e.target.value)
                    }
                    icon={<Building2 size={18} />}
                    placeholder="Company Name"
                    error={errors.company_name}
                    required
                  />
                  <Input
                    label="Company Email"
                    type="email"
                    name="company_email"
                    value={formData.company_email}
                    onChange={(e) =>
                      updateField("company_email", e.target.value)
                    }
                    icon={<Mail size={18} />}
                    placeholder="company@email.com"
                    error={errors.company_email}
                    required
                  />
                  <Input
                    label="Phone Number"
                    name="company_phone"
                    value={formData.company_phone}
                    onChange={(e) =>
                      updateField("company_phone", e.target.value)
                    }
                    icon={<Phone size={18} />}
                    placeholder="##########"
                    error={errors.company_phone}
                  />
                  <div className="rounded-xl">
                    <Input
                      label="Head Office Code"
                      name="hq_branch_code"
                      value={formData.hq_branch_code}
                      onChange={(e) =>
                        updateField(
                          "hq_branch_code",
                          e.target.value.toUpperCase(),
                        )
                      }
                      icon={<Hash size={18} />}
                      placeholder="001"
                      error={errors.hq_branch_code}
                      required
                    />
                    <p className="mb-3 text-xs leading-5 text-blue-700">
                      The company name will automatically be used as the Head
                      Office name.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={goNext}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    Continue
                    <ArrowRight size={18} />
                  </button>
                </>
              ) : (
                <>
                  <Input
                    label="Admin Name"
                    name="admin_name"
                    value={formData.admin_name}
                    onChange={(e) => updateField("admin_name", e.target.value)}
                    icon={<User size={18} />}
                    placeholder="Admin Name"
                    error={errors.admin_name}
                    required
                  />
                  <Input
                    label="Admin Email"
                    type="email"
                    name="admin_email"
                    value={formData.admin_email}
                    onChange={(e) => updateField("admin_email", e.target.value)}
                    icon={<Mail size={18} />}
                    placeholder="owner@company.com"
                    error={errors.admin_email}
                    required
                  />
                  <Input
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    icon={<Lock size={18} />}
                    placeholder="Example: Test@1234"
                    error={errors.password}
                    helper="Use 8+ chars with uppercase, lowercase, number and special character."
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    }
                    required
                  />
                  <Input
                    label="Confirm Password"
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirm_password"
                    value={formData.confirm_password}
                    onChange={(e) =>
                      updateField("confirm_password", e.target.value)
                    }
                    icon={<Lock size={18} />}
                    placeholder="Confirm password"
                    error={errors.confirm_password}
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    }
                    required
                  />
                  <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                    >
                      {loading ? "Creating..." : "Create Account"}
                      {!loading && <ArrowRight size={18} />}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
function Input({
  label,
  name,
  value,
  onChange,
  icon,
  placeholder,
  type = "text",
  required = false,
  helper,
  error,
  rightIcon,
}) {
  return (
    <div className="relative">
      <label
        htmlFor={name}
        className="mb-1.5 block text-xs font-medium text-slate-700"
      >
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </span>
        <input
          id={name}
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          autoComplete="off"
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : undefined}
          className={`w-full rounded-xl border bg-white py-3 pl-11 text-sm font-normal text-slate-800 outline-none transition focus:ring-2 ${
            rightIcon ? "pr-12" : "pr-3"
          } ${
            error
              ? "border-red-400 focus:border-red-500 focus:ring-red-100"
              : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"
          }`}
        />
        {rightIcon && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            {rightIcon}
          </div>
        )}
        {error && (
          <div
            id={`${name}-error`}
            role="alert"
            className="absolute right-2 top-[calc(100%-2px)] z-40 max-w-[calc(100%-16px)] animate-[fadeIn_.16s_ease-out] rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold leading-4 text-red-600 shadow-[0_10px_30px_rgba(15,23,42,0.18)]"
          >
            <span className="absolute -top-1.5 right-5 h-3 w-3 rotate-45 border-l border-t border-red-200 bg-white" />
            <span className="relative">{error}</span>
          </div>
        )}
      </div>
      {!error && helper ? (
        <p className="mt-1 text-xs font-medium leading-5 text-slate-400">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
function FeatureItem({ icon, title, text }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-xl bg-blue-500/20 p-2 text-blue-300">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">{text}</p>
        </div>
      </div>
    </div>
  );
}
export default RegisterCompany;
