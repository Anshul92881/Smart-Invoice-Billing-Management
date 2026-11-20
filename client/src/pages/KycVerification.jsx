import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
function KycVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const { companyId } = useParams();
  const isManualKyc = location.state?.manualKyc === true;
  const apiPrefix = isManualKyc ? `/kyc/superadmin/${companyId}` : "/kyc";
  const [loadingAction, setLoadingAction] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [panName, setPanName] = useState("");
  const [panDob, setPanDob] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [tanNumber, setTanNumber] = useState("");
  const [aadhaarVerified, setAadhaarVerified] = useState(false);
  const [panVerified, setPanVerified] = useState(false);
  const [gstVerified, setGstVerified] = useState(false);
  const [tanVerified, setTanVerified] = useState(false);
  const [documents, setDocuments] = useState({
    aadhaar_card: null,
    pan_card: null,
    gst_certificate: null,
    tan_document: null,
  });
  const isLoading = Boolean(loadingAction);
  const canComplete =
    Boolean(documents.aadhaar_card) &&
    Boolean(documents.pan_card) &&
    aadhaarVerified &&
    panVerified;
  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setDocuments((prev) => ({
      ...prev,
      [e.target.name]: file,
    }));
  };
  const handleAuthError = (err) => {
    const status = err.response?.status;
    const message = err.response?.data?.message;
    if (status === 401) {
      toast.error("Session expired. Please login again.");
      localStorage.clear();
      navigate("/", { replace: true });
      return true;
    }
    if (status === 403) {
      toast.error(message || "KYC access blocked. Please contact support.");
      return true;
    }
    return false;
  };
  const redirectAfterKyc = () => {
    if (isManualKyc) {
      toast.success("Manual KYC completed successfully");
      navigate("/superadmin/company-kyc", {
        replace: true,
      });
      return;
    }
    const email =
      location.state?.email ||
      localStorage.getItem("pending_admin_email") ||
      "";
    toast.success("KYC completed successfully. Please login.");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("kyc_token");
    localStorage.removeItem("kyc_user");
    localStorage.removeItem("pending_company_id");
    localStorage.removeItem("pending_admin_email");
    navigate("/", {
      replace: true,
      state: {
        email,
        kycCompleted: true,
      },
    });
  };
  const sendOtp = async () => {
    if (!aadhaarNumber.trim()) {
      toast.error("Aadhaar number is required");
      return;
    }
    const finalAadhaar = aadhaarNumber.trim().replace(/\s/g, "");
    if (!/^\d{12}$/.test(finalAadhaar)) {
      toast.error("Aadhaar number must be 12 digits");
      return;
    }
    if (/^(\d)\1{11}$/.test(finalAadhaar)) {
      toast.error("Invalid Aadhaar number");
      return;
    }
    try {
      setLoadingAction("send_otp");
      const res = await api.post(`${apiPrefix}/aadhaar/send-otp`, {
        aadhaar_number: finalAadhaar,
      });
      const refId =
        res.data?.reference_id || res.data?.data?.reference_id || "";
      if (!refId) {
        toast.error("Reference ID not received");
        return;
      }
      setReferenceId(String(refId));
      toast.success("OTP sent successfully");
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err.response?.data?.message || "Failed to send OTP");
    } finally {
      setLoadingAction("");
    }
  };
  const verifyOtp = async () => {
    if (!referenceId) {
      toast.error("Please send OTP first");
      return;
    }
    if (!otp.trim()) {
      toast.error("OTP is required");
      return;
    }
    try {
      setLoadingAction("verify_otp");
      const res = await api.post(`${apiPrefix}/aadhaar/verify-otp`, {
        otp: otp.trim(),
        reference_id: String(referenceId),
      });
      setAadhaarVerified(true);
      toast.success("Aadhaar verified successfully");
      if (res.data?.approved) {
        toast.success("Aadhaar verified");
      }
    } catch (err) {
      console.error("AADHAAR VERIFY ERROR =>", {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
      if (handleAuthError(err)) return;
      toast.error(
        err?.response?.data?.attempts_not_counted
          ? "Verification service unavailable. Please try again later."
          : err?.response?.data?.message || "Aadhaar verification failed",
      );
    } finally {
      setLoadingAction("");
    }
  };
  const verifyPan = async () => {
    if (!panNumber.trim()) {
      toast.error("PAN number is required");
      return;
    }
    if (!panName.trim()) {
      toast.error("Name as per PAN is required");
      return;
    }
    if (!panDob) {
      toast.error("DOB / Incorporation date is required");
      return;
    }
    try {
      setLoadingAction("verify_pan");
      const res = await api.post(`${apiPrefix}/pan/verify`, {
        pan_number: panNumber.trim(),
        name_as_per_pan: panName.trim(),
        date_of_birth: panDob,
      });
      setPanVerified(true);
      toast.success("PAN verified successfully");
      if (res.data?.approved) {
        toast.success("PAN verified");
      }
    } catch (err) {
      console.error("PAN VERIFY ERROR =>", {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
      if (handleAuthError(err)) return;
      toast.error(
        err?.response?.data?.attempts_not_counted
          ? "Verification service unavailable. Please try again later."
          : err.response?.data?.message || "PAN verification failed",
      );
    } finally {
      setLoadingAction("");
    }
  };
  const verifyGst = async () => {
    if (!gstNumber.trim()) {
      toast.error("GST number is required");
      return;
    }
    try {
      setLoadingAction("verify_gst");
      await api.post(`${apiPrefix}/gst/verify`, {
        gst_number: gstNumber.trim(),
      });
      setGstVerified(true);
      toast.success("GST verified successfully");
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err.response?.data?.message || "GST verification failed");
    } finally {
      setLoadingAction("");
    }
  };
  const verifyTan = async () => {
    if (!tanNumber.trim()) {
      toast.error("TAN number is required");
      return;
    }
    try {
      setLoadingAction("verify_tan");
      await api.post(`${apiPrefix}/tan/verify`, {
        tan_number: tanNumber.trim(),
      });
      setTanVerified(true);
      toast.success("TAN verified successfully");
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(err.response?.data?.message || "TAN verification failed");
    } finally {
      setLoadingAction("");
    }
  };
  const skipKyc = async () => {
    try {
      setLoadingAction("skip_kyc");
      const res = await api.post("/kyc/skip");
      const token = res.data?.token;
      const user = res.data?.user;
      if (!token || !user) {
        toast.error("Invalid skip KYC response");
        return;
      }
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.removeItem("kyc_token");
      localStorage.removeItem("kyc_user");
      localStorage.removeItem("pending_company_id");
      localStorage.removeItem("pending_admin_email");
      toast.success(
        res.data?.message || "KYC skipped. You can complete it later.",
      );
      navigate("/dashboard", {
        replace: true,
      });
    } catch (err) {
      console.error("SKIP KYC ERROR =>", {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
      if (handleAuthError(err)) return;
      toast.error(err.response?.data?.message || "Failed to skip KYC");
    } finally {
      setLoadingAction("");
    }
  };
  const completeKyc = async () => {
    if (!documents.aadhaar_card || !documents.pan_card) {
      toast.error("Aadhaar document and PAN document are required");
      return;
    }
    if (!aadhaarVerified || !panVerified) {
      toast.error("Please verify Aadhaar and PAN first");
      return;
    }
    try {
      setLoadingAction("complete_kyc");
      const formData = new FormData();
      Object.keys(documents).forEach((key) => {
        if (documents[key]) {
          formData.append(key, documents[key]);
        }
      });
      const uploadUrl = isManualKyc
        ? `/kyc/superadmin/${companyId}/upload`
        : "/kyc/upload";
      const res = await api.post(uploadUrl, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      if (res.data?.approved) {
        redirectAfterKyc();
        return;
      }
      toast.success(
        res.data?.message ||
          "Documents uploaded. Please complete remaining verification.",
      );
    } catch (err) {
      console.error("COMPLETE KYC ERROR =>", {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
      if (handleAuthError(err)) return;
      toast.error(err.response?.data?.message || "Failed to complete KYC");
    } finally {
      setLoadingAction("");
    }
  };
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                <ShieldCheck size={14} />
                Company Verification
              </div>
              <h1 className="text-2xl font-semibold text-slate-900">
                {isManualKyc
                  ? "Manual Company KYC"
                  : "Complete KYC Verification"}
              </h1>
              <p className="mt-1 max-w-2xl text-sm font-normal leading-6 text-slate-500">
                {isManualKyc
                  ? "Upload company documents and manually complete verification."
                  : "Upload documents and verify Aadhaar + PAN to activate your Smart Invoice account."}
              </p>
            </div>
            <div
              className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                canComplete
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {canComplete ? "Ready to complete" : "Verification pending"}
            </div>
          </div>
        </div>
        <div className="space-y-5">
          <KycSection
            title="Aadhaar Verification"
            description="Upload Aadhaar document, send OTP and verify Aadhaar."
            required
            completed={documents.aadhaar_card && aadhaarVerified}
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
              <FileInput
                label="Aadhaar Document"
                name="aadhaar_card"
                file={documents.aadhaar_card}
                onChange={handleFileChange}
              />
              <div className="space-y-3">
                <TextInput
                  label="Aadhaar Number"
                  value={aadhaarNumber}
                  onChange={setAadhaarNumber}
                  placeholder="Enter Aadhaar number"
                  disabled={aadhaarVerified}
                />
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <TextInput
                    label="OTP"
                    value={otp}
                    onChange={setOtp}
                    placeholder="Enter OTP"
                    disabled={aadhaarVerified}
                  />
                  <div className="flex flex-wrap items-end gap-2">
                    <ActionButton
                      onClick={sendOtp}
                      loading={loadingAction === "send_otp"}
                      disabled={isLoading || aadhaarVerified}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Send OTP
                    </ActionButton>
                    <ActionButton
                      onClick={verifyOtp}
                      loading={loadingAction === "verify_otp"}
                      disabled={isLoading || aadhaarVerified}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {aadhaarVerified ? "Verified" : "Verify"}
                    </ActionButton>
                  </div>
                </div>
              </div>
            </div>
          </KycSection>
          <KycSection
            title="PAN Verification"
            description="Upload PAN document and verify PAN details."
            required
            completed={documents.pan_card && panVerified}
          >
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <FileInput
                label="PAN Document"
                name="pan_card"
                file={documents.pan_card}
                onChange={handleFileChange}
              />
              <TextInput
                label="PAN Number"
                value={panNumber}
                onChange={setPanNumber}
                placeholder="Enter PAN number"
                disabled={panVerified}
              />
              <TextInput
                label="Name as per PAN"
                value={panName}
                onChange={setPanName}
                placeholder="Enter name as per PAN"
                disabled={panVerified}
              />
              <TextInput
                label="DOB / Incorporation Date"
                type="date"
                value={panDob}
                onChange={setPanDob}
                disabled={panVerified}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <ActionButton
                onClick={verifyPan}
                loading={loadingAction === "verify_pan"}
                disabled={isLoading || panVerified}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {panVerified ? "Verified" : "Verify PAN"}
              </ActionButton>
            </div>
          </KycSection>
          <KycSection
            title="GST Verification"
            description="Optional GST certificate upload and GST number verification."
            completed={documents.gst_certificate && gstVerified}
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)_auto]">
              <FileInput
                label="GST Certificate"
                name="gst_certificate"
                file={documents.gst_certificate}
                onChange={handleFileChange}
              />
              <TextInput
                label="GST Number"
                value={gstNumber}
                onChange={setGstNumber}
                placeholder="Enter GST number"
                disabled={gstVerified}
              />
              <div className="flex items-end justify-end">
                <ActionButton
                  onClick={verifyGst}
                  loading={loadingAction === "verify_gst"}
                  disabled={isLoading || gstVerified}
                  className="bg-slate-900 hover:bg-slate-800"
                >
                  {gstVerified ? "Verified" : "Verify GST"}
                </ActionButton>
              </div>
            </div>
          </KycSection>
          <KycSection
            title="TAN Verification"
            description="Optional TAN document upload and TAN number verification."
            completed={documents.tan_document && tanVerified}
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)_auto]">
              <FileInput
                label="TAN Document"
                name="tan_document"
                file={documents.tan_document}
                onChange={handleFileChange}
              />
              <TextInput
                label="TAN Number"
                value={tanNumber}
                onChange={setTanNumber}
                placeholder="Enter TAN number"
                disabled={tanVerified}
              />
              <div className="flex items-end justify-end">
                <ActionButton
                  onClick={verifyTan}
                  loading={loadingAction === "verify_tan"}
                  disabled={isLoading || tanVerified}
                  className="bg-slate-900 hover:bg-slate-800"
                >
                  {tanVerified ? "Verified" : "Verify TAN"}
                </ActionButton>
              </div>
            </div>
          </KycSection>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Submit KYC
                </h3>
                <p className="mt-1 text-sm font-normal leading-6 text-slate-500">
                  Required: Aadhaar document, PAN document, Aadhaar verification
                  and PAN verification.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                {!isManualKyc && (
                  <ActionButton
                    onClick={skipKyc}
                    loading={loadingAction === "skip_kyc"}
                    disabled={isLoading}
                    className="bg-slate-600 hover:bg-slate-700"
                  >
                    Skip for Now
                  </ActionButton>
                )}
                <ActionButton
                  onClick={completeKyc}
                  loading={loadingAction === "complete_kyc"}
                  disabled={isLoading || !canComplete}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  Complete KYC
                  <ArrowRight size={16} />
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function KycSection({
  title,
  description,
  children,
  required = false,
  completed,
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {required && (
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-sm font-semibold text-red-600">
                Required
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-normal leading-6 text-slate-500">
            {description}
          </p>
        </div>
        <StatusBadge completed={completed} />
      </div>
      {children}
    </section>
  );
}
function StatusBadge({ completed }) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
        completed
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      {completed && <CheckCircle2 size={14} />}
      {completed ? "Completed" : "Pending"}
    </span>
  );
}
function FileInput({ label, name, file, onChange }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 transition hover:border-blue-300 hover:bg-blue-50">
        <input
          type="file"
          name={name}
          onChange={onChange}
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="block w-full min-w-0 text-sm font-normal text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700"
        />
        <p className="mt-2 break-all text-sm font-normal text-slate-400">
          {file?.name || "PDF, JPG, PNG or WEBP"}
        </p>
      </div>
    </label>
  );
}
function TextInput({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  type = "text",
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="h-[46px] w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      />
    </div>
  );
}
function ActionButton({
  children,
  onClick,
  loading,
  disabled = false,
  className = "",
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 whitespace-nowrap min-h-[46px] items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-300 ${className}`}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}
export default KycVerification;
