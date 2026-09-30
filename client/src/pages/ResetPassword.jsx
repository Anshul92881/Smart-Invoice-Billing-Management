import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../services/api";

import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Lock,
  ShieldCheck,
} from "lucide-react";

const PASSWORD_MESSAGE =
  "Password must be 8-128 characters and include uppercase, lowercase, number and special character";

const isStrongPassword = (password) => {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    password.length <= 128 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
};

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    password: "",
    confirm_password: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // FORM VALIDATION
  const validateForm = () => {
    const nextErrors = {};

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

  // HANDLE INPUT CHANGE
  const handleChange = (e) => {
    const { name, value } = e.target;

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

  // RESET PASSWORD
  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setLoading(true);

      await api.post(`/auth/reset-password/${token}`, formData);

      toast.success("Password reset successfully");

      setSuccess(true);

      setTimeout(() => {
        navigate("/", { replace: true });
      }, 1800);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 p-3 sm:p-4">
      {/* MAIN CONTAINER */}
      <div
        className="
          mx-auto grid
          min-h-[calc(100vh-24px)]
          w-full max-w-6xl
          grid-cols-1
          overflow-hidden
          rounded-[24px]
          border border-slate-200
          bg-white shadow-2xl
          sm:min-h-[calc(100vh-32px)]
          lg:grid-cols-[1fr_1fr]
        "
      >
        {/* LEFT SECTION */}
        <div
          className="
            relative hidden
            overflow-hidden
            bg-slate-950
            px-8 py-10
            text-white
            lg:flex lg:items-center
            xl:px-10
          "
        >
          {/* BACKGROUND EFFECTS */}
          <div
            className="
              pointer-events-none
              absolute -right-24 -top-24
              h-72 w-72
              rounded-full
              bg-blue-600/25
              blur-3xl
            "
          />

          <div
            className="
              pointer-events-none
              absolute -bottom-28 left-10
              h-72 w-72
              rounded-full
              bg-cyan-500/20
              blur-3xl
            "
          />

          {/* LEFT CONTENT */}
          <div className="relative z-10 w-full max-w-lg">
            {/* BRAND */}
            <div className="mb-8 flex items-center gap-3">
              <div
                className="
                  flex h-12 w-12
                  shrink-0
                  items-center justify-center
                  rounded-2xl
                  bg-blue-600
                  shadow-lg shadow-blue-900/30
                "
              >
                <FileText size={26} />
              </div>

              <div className="min-w-0">
                <h1 className="text-xl font-bold leading-tight">
                  Smart Billing & Invoice
                </h1>

                <p className="mt-1 text-sm text-slate-400">
                  SaaS Billing Management
                </p>
              </div>
            </div>

            {/* LABEL */}
            <div
              className="
                mb-4 inline-flex
                items-center gap-2
                rounded-full
                border border-white/10
                bg-white/10
                px-3 py-1.5
                text-xs font-medium
                text-blue-100
              "
            >
              <ShieldCheck size={14} />
              Secure password reset
            </div>

            {/* HEADING */}
            <h2
              className="
                max-w-md
                text-2xl font-semibold
                leading-snug
                xl:text-3xl
              "
            >
              Create a new password for your Smart Invoice account.
            </h2>

            {/* DESCRIPTION */}
            <p
              className="
                mt-3 max-w-md
                text-sm
                leading-6
                text-slate-400
                xl:text-base
              "
            >
              This reset link is time-limited for your account security. After
              resetting, you can login using your new password.
            </p>

            {/* ACCOUNT PROTECTION CARD */}
            <div
              className="
                mt-7 max-w-md
                rounded-2xl
                border border-white/10
                bg-white/10
                p-4
                backdrop-blur
              "
            >
              <div className="flex items-start gap-3">
                <div
                  className="
                    flex h-10 w-10
                    shrink-0
                    items-center justify-center
                    rounded-xl
                    bg-blue-500/20
                    text-blue-300
                  "
                >
                  <KeyRound size={20} />
                </div>

                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white">
                    Account Protection
                  </h3>

                  <p
                    className="
                      mt-1
                      text-sm
                      leading-5
                      text-slate-400
                    "
                  >
                    Use a strong password with letters, numbers and symbols for
                    better security.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SECTION */}
        <div
          className="
            flex min-w-0
            items-center
            px-5 py-8
            sm:px-8 sm:py-10
            lg:px-10
            xl:px-12
          "
        >
          <div className="mx-auto w-full max-w-md">
            {/* BACK TO LOGIN */}
            <Link
              to="/"
              className="
                mb-7 inline-flex
                items-center gap-2
                text-sm font-medium
                text-slate-500
                transition
                hover:text-blue-600
              "
            >
              <ArrowLeft size={16} />
              Back to Login
            </Link>

            {success ? (
              /* SUCCESS MESSAGE */
              <div
                className="
                  rounded-2xl
                  border border-emerald-200
                  bg-emerald-50
                  p-6
                  text-center
                "
              >
                <div
                  className="
                    mx-auto mb-4
                    flex h-14 w-14
                    items-center justify-center
                    rounded-2xl
                    bg-emerald-600
                    text-white
                  "
                >
                  <CheckCircle2 size={28} />
                </div>

                <h2 className="text-2xl font-semibold text-slate-900">
                  Password Reset Done
                </h2>

                <p
                  className="
                    mt-2
                    text-sm
                    leading-6
                    text-slate-600
                  "
                >
                  Your password has been updated successfully. Redirecting you
                  to login...
                </p>
              </div>
            ) : (
              <>
                {/* FORM HEADER */}
                <div className="mb-7">
                  <div
                    className="
                      mb-3 inline-flex
                      items-center gap-2
                      rounded-full
                      bg-blue-50
                      px-3 py-1.5
                      text-xs font-medium
                      text-blue-700
                    "
                  >
                    <KeyRound size={14} />
                    Reset password
                  </div>

                  <h2
                    className="
                      text-2xl
                      font-semibold
                      text-slate-900
                      sm:text-3xl
                    "
                  >
                    Set New Password
                  </h2>

                  <p
                    className="
                      mt-2
                      text-sm
                      leading-6
                      text-slate-500
                    "
                  >
                    Enter your new password below. This will work for
                    SuperAdmin, Company Admin, Accountant, Sales User and
                    Customer accounts.
                  </p>
                </div>

                {/* RESET FORM */}
                <form
                  onSubmit={handleResetPassword}
                  className="space-y-5"
                  noValidate
                >
                  {/* NEW PASSWORD */}
                  <div>
                    <label
                      htmlFor="password"
                      className="
                        mb-2 block
                        text-sm font-medium
                        text-slate-700
                      "
                    >
                      New Password
                    </label>

                    <div className="relative">
                      <Lock
                        size={19}
                        className="
                          absolute left-4 top-1/2
                          -translate-y-1/2
                          text-slate-400
                        "
                      />

                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        name="password"
                        placeholder="Enter new password"
                        value={formData.password}
                        onChange={handleChange}
                        autoComplete="new-password"
                        aria-invalid={Boolean(errors.password)}
                        className={`
                          w-full
                          rounded-xl
                          border
                          bg-white
                          py-3.5
                          pl-12 pr-12
                          text-sm
                          outline-none
                          transition
                          focus:ring-4
                          ${
                            errors.password
                              ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                              : "border-slate-300 focus:border-blue-500 focus:ring-blue-100"
                          }
                        `}
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="
                          absolute right-4 top-1/2
                          -translate-y-1/2
                          text-slate-400
                          transition
                          hover:text-slate-700
                        "
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>

                    {errors.password ? (
                      <p className="mt-1.5 text-xs font-medium text-red-600">
                        {errors.password}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs text-slate-500">
                        Use 8+ characters with uppercase, lowercase, number and
                        special character.
                      </p>
                    )}
                  </div>

                  {/* CONFIRM PASSWORD */}
                  <div>
                    <label
                      htmlFor="confirm_password"
                      className="
                        mb-2 block
                        text-sm font-medium
                        text-slate-700
                      "
                    >
                      Confirm Password
                    </label>

                    <div className="relative">
                      <Lock
                        size={19}
                        className="
                          absolute left-4 top-1/2
                          -translate-y-1/2
                          text-slate-400
                        "
                      />

                      <input
                        id="confirm_password"
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirm_password"
                        placeholder="Confirm new password"
                        value={formData.confirm_password}
                        onChange={handleChange}
                        autoComplete="new-password"
                        aria-invalid={Boolean(errors.confirm_password)}
                        className={`
                          w-full
                          rounded-xl
                          border
                          bg-white
                          py-3.5
                          pl-12 pr-12
                          text-sm
                          outline-none
                          transition
                          focus:ring-4
                          ${
                            errors.confirm_password
                              ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                              : "border-slate-300 focus:border-blue-500 focus:ring-blue-100"
                          }
                        `}
                      />

                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="
                          absolute right-4 top-1/2
                          -translate-y-1/2
                          text-slate-400
                          transition
                          hover:text-slate-700
                        "
                        aria-label={
                          showConfirmPassword
                            ? "Hide confirm password"
                            : "Show confirm password"
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>

                    {errors.confirm_password && (
                      <p className="mt-1.5 text-xs font-medium text-red-600">
                        {errors.confirm_password}
                      </p>
                    )}
                  </div>

                  {/* SUBMIT BUTTON */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="
                      flex w-full
                      items-center justify-center
                      gap-2
                      rounded-xl
                      bg-blue-600
                      py-3.5
                      text-sm font-semibold
                      text-white
                      shadow-lg shadow-blue-600/20
                      transition
                      hover:bg-blue-700
                      disabled:cursor-not-allowed
                      disabled:bg-blue-400
                    "
                  >
                    {loading ? "Resetting Password..." : "Reset Password"}

                    {!loading && <KeyRound size={19} />}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
