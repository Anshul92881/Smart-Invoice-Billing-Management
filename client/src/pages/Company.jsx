import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import {
  BadgePercent,
  Building2,
  CheckCircle2,
  ChevronDown,
  Eye,
  Globe,
  Image as ImageIcon,
  KeyRound,
  Landmark,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Save,
  Search,
  Upload,
  Wallet,
  X,
  XCircle,
} from "lucide-react";

import api from "../services/api";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "").replace(/\/$/, "");

// Validation patterns
const REGEX = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[6-9]\d{9}$/, // 10 digit Indian mobile number
  gst: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
  pan: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
  website: /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/.*)?$/,
  zip: /^\d{5,6}$/,
  companyName: /^[a-zA-Z0-9\s.&'()-]+$/,
  hqCode: /^[A-Z0-9_-]{2,20}$/,
};

// Blank form (also used as the default value for missing fields)
const EMPTY_FORM = {
  name: "",
  gst_number: "",
  pan_number: "",
  currency: "INR",
  status: "active",
  email: "",
  phone: "",
  website: "",
  address: "",
  city: "",
  state: "",
  country: "India",
  zip_code: "",
  logo: "",
  hq_branch_code: "",
};

// These fields are always saved in CAPITAL letters
const UPPERCASE_FIELDS = ["gst_number", "pan_number", "hq_branch_code"];

const CURRENCY_OPTIONS = [
  { value: "INR", label: "INR" },
  { value: "USD", label: "USD" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const STATUS_TABS = [
  { value: "all", label: "All Companies" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const TABLE_HEADINGS = [
  "Company",
  "GST / PAN",
  "Contact",
  "Location",
  "Status",
  "Actions",
];

/* ---- Tailwind class strings that are used in many places ---- */

const CARD =
  "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

const PRIMARY_BUTTON =
  "flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:ring-0 disabled:cursor-not-allowed disabled:opacity-60";

const PAGER_BUTTON =
  "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

const TABLE_CELL = "px-3 py-3 [overflow-wrap:anywhere]";
const TABLE_CELL_TEXT = `${TABLE_CELL} font-medium text-slate-600 dark:text-slate-300`;

// Colours for the 4 stats cards at the top
const STAT_TONES = {
  blue: {
    card: "border-blue-200 from-blue-50 dark:border-blue-900 dark:from-blue-950/40",
    icon: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  },
  green: {
    card: "border-emerald-200 from-emerald-50 dark:border-emerald-900 dark:from-emerald-950/40",
    icon: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  red: {
    card: "border-red-200 from-red-50 dark:border-red-900 dark:from-red-950/40",
    icon: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  },
  purple: {
    card: "border-purple-200 from-purple-50 dark:border-purple-900 dark:from-purple-950/40",
    icon: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
  },
};

const STATUS_BADGE_STYLES = {
  active:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  inactive:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
};

// Styles for the ".input" class used by every text box on this page
const WORKSPACE_STYLES = `
  .company-workspace .input {
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
  .company-workspace .input::placeholder { color: #94a3b8; }
  .company-workspace .input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px #dbeafe; }
  .company-workspace .input.input-error { border-color: #ef4444; }
  .company-workspace .input.input-error:focus { border-color: #ef4444; box-shadow: 0 0 0 3px #fee2e2; }
  .company-workspace .input:disabled { cursor: not-allowed; background: #f8fafc; color: #94a3b8; }

  .dark .company-workspace .input { border-color: #334155; background: #0f172a; color: #e2e8f0; }
  .dark .company-workspace .input::placeholder { color: #64748b; }
  .dark .company-workspace .input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.35); }
  .dark .company-workspace .input.input-error { border-color: #f87171; }
  .dark .company-workspace .input.input-error:focus { border-color: #f87171; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2); }
  .dark .company-workspace .input:disabled { background: #020617; color: #64748b; }
`;

/* -------------------------------------------------------------------------- */
/*  2. Helper functions (no React state here, just plain JavaScript)          */
/* -------------------------------------------------------------------------- */

// Read the logged-in user from localStorage. Broken JSON should not crash the page.
function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}

// Returns the value only after the user stops typing for a moment.
// We use it for search so we don't call the API on every key press.
function useDebouncedValue(value, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Logo can be a full URL or just a file name saved by our backend
function getLogoUrl(logo) {
  if (!logo) return "";
  if (logo.startsWith("http")) return logo;
  return `${API_ORIGIN}/upload/company-logos/${logo}`;
}

// Convert a company from the API into form values (missing values get defaults)
function companyToForm(company) {
  const form = {};

  for (const key of Object.keys(EMPTY_FORM)) {
    form[key] = company?.[key] || EMPTY_FORM[key];
  }

  return form;
}

// Clean the form before sending it to the API:
// remove extra spaces and make GST / PAN / HQ code capital
function cleanFormData(formData) {
  const cleaned = {};

  for (const [key, value] of Object.entries(formData)) {
    cleaned[key] = typeof value === "string" ? value.trim() : value;
  }

  for (const key of UPPERCASE_FIELDS) {
    cleaned[key] = cleaned[key].toUpperCase();
  }

  return cleaned;
}

// Checks the form and returns an object of errors.
// Example: { email: "Enter a valid email address" }   (empty object = no errors)
function validateCompany(formData) {
  const data = cleanFormData(formData);
  const errors = {};

  // Company name is required
  if (!data.name) {
    errors.name = "Company name is required";
  } else if (data.name.length < 3 || data.name.length > 100) {
    errors.name = "Company name must be between 3 and 100 characters";
  } else if (!REGEX.companyName.test(data.name)) {
    errors.name = "Company name contains invalid characters";
  }

  // Head office code is required
  if (!data.hq_branch_code) {
    errors.hq_branch_code = "Head Office Code is required";
  } else if (!REGEX.hqCode.test(data.hq_branch_code)) {
    errors.hq_branch_code = "Use 2-20 letters, numbers, underscore or hyphen";
  }

  // The fields below are optional, so we only check them if something is typed
  if (data.email && !REGEX.email.test(data.email)) {
    errors.email = "Enter a valid email address";
  }

  if (data.phone && !REGEX.phone.test(data.phone)) {
    errors.phone = "Enter a valid 10 digit Indian mobile number";
  }

  if (data.gst_number && !REGEX.gst.test(data.gst_number)) {
    errors.gst_number = "Enter a valid GST number";
  }

  if (data.pan_number && !REGEX.pan.test(data.pan_number)) {
    errors.pan_number = "Enter a valid PAN number";
  }

  if (data.website && !REGEX.website.test(data.website)) {
    errors.website = "Enter a valid website URL";
  }

  if (data.zip_code && !REGEX.zip.test(data.zip_code)) {
    errors.zip_code = "Zip code must contain 5 to 6 digits";
  }

  return errors;
}

/* -------------------------------------------------------------------------- */
/*  3. Main page                                                              */
/* -------------------------------------------------------------------------- */

function Company() {
  const user = useMemo(getStoredUser, []);
  const isSuperAdmin = user?.role === "superadmin";
  const isCompanyAdmin = user?.role === "company_admin";

  /* ---- State: company list (super admin) ---- */
  const [companies, setCompanies] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCompanies, setTotalCompanies] = useState(0);
  const debouncedSearch = useDebouncedValue(search);

  /* ---- State: create / edit form ---- */
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [crmApiKey, setCrmApiKey] = useState("");
  const [crmApiKeyConfigured, setCrmApiKeyConfigured] = useState(false);

  /* ---- State: which screen / popup is open ---- */
  const [isEditMode, setIsEditMode] = useState(false); // company admin: edit screen
  const [showFormModal, setShowFormModal] = useState(false); // super admin: create/edit popup
  const [viewCompany, setViewCompany] = useState(null); // super admin: view popup

  /* ---- State: logo upload (company admin) ---- */
  const [logoFile, setLogoFile] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef(null);

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    countries: 0,
  });

  /* ------------------------------ Load data ------------------------------- */

  const fetchCompanies = useCallback(async () => {
    try {
      if (isSuperAdmin) {
        // Table: current page, search and status filter.
        const res = await api.get("/companies", {
          params: {
            page: currentPage,
            limit,
            search: debouncedSearch,
            status: statusFilter,
          },
        });

        setCompanies(res.data.companies || []);
        setTotalPages(res.data.totalPages || 1);
        setTotalCompanies(res.data.total || 0);

        // Summary cards: all companies, without table filters.
        let summaryPage = 1;
        let summaryTotalPages = 1;
        let total = 0;
        let active = 0;
        let inactive = 0;

        const countries = new Set();

        do {
          const summaryRes = await api.get("/companies", {
            params: {
              page: summaryPage,
              limit: 100,
              search: "",
              status: "all",
            },
          });

          const companyRecords = summaryRes.data.companies || [];

          total = Number(summaryRes.data.total || 0);
          summaryTotalPages = Number(summaryRes.data.totalPages || 1);

          companyRecords.forEach((company) => {
            const companyStatus = String(company.status || "").toLowerCase();

            if (companyStatus === "active") active += 1;
            if (companyStatus === "inactive") inactive += 1;

            const country = String(company.country || "")
              .trim()
              .toLowerCase();

            if (country) countries.add(country);
          });

          summaryPage += 1;
        } while (summaryPage <= summaryTotalPages);

        setStats({
          total,
          active,
          inactive,
          countries: countries.size,
        });
      } else if (isCompanyAdmin) {
        // Company Admin: existing functionality unchanged.
        const res = await api.get("/companies/my-company");

        setCompanies([res.data]);
        setEditingId(res.data.id);
        setFormData(companyToForm(res.data));
        setIsEditMode(false);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch company");
    }
  }, [
    isSuperAdmin,
    isCompanyAdmin,
    currentPage,
    limit,
    debouncedSearch,
    statusFilter,
  ]);

  // Load again whenever page, limit, search or filter changes
  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  /* ---------------------------- Form open/close --------------------------- */

  const openCreateModal = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setSubmitting(false);
    setShowFormModal(true);
  };

  const openEditModal = (company) => {
    setEditingId(company.id);
    setFormData(companyToForm(company));
    setFormErrors({});
    setSubmitting(false);
    setCrmApiKey("");
    setCrmApiKeyConfigured(Boolean(company?.crm_api_key_configured));
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setSubmitting(false);
    setCrmApiKey("");
    setCrmApiKeyConfigured(false);
  };

  // Company admin: cancel editing and go back to the saved details
  const cancelCompanyAdminEdit = () => {
    setFormData(companyToForm(companies[0]));
    setFormErrors({});
    setLogoFile(null);
    setIsEditMode(false);
  };

  /* ---------------------------- Form typing ------------------------------- */

  // Called on every key press in any text box
  const handleChange = (e) => {
    const { name, value } = e.target;

    const newValue = UPPERCASE_FIELDS.includes(name)
      ? value.toUpperCase()
      : value;

    setFormData((prev) => ({ ...prev, [name]: newValue }));

    // Remove the red error as soon as the user starts fixing that field
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  // Returns true if the form is valid.
  // If not valid: shows the errors and moves the cursor to the first wrong field.
  const validateForm = () => {
    const errors = validateCompany(formData);
    setFormErrors(errors);

    const firstErrorField = Object.keys(errors)[0];
    if (!firstErrorField) return true;

    setTimeout(() => {
      document.querySelector(`[name="${firstErrorField}"]`)?.focus();
    }, 0);

    toast.error("Please correct the highlighted fields");
    return false;
  };

  /* ------------------------------- Actions -------------------------------- */

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (submitting) return;
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      const payload = cleanFormData(formData);

      if (isCompanyAdmin) {
        // Company admin updates their own company
        await api.put("/companies/my-company", payload);
        toast.success("Company profile updated successfully");
        setIsEditMode(false);
      } else if (editingId) {
        // Super admin updates an existing company
        // (CRM key is sent only if a new one was typed)
        if (crmApiKey.trim()) payload.crm_api_key = crmApiKey.trim();

        await api.put(`/companies/${editingId}`, payload);
        toast.success("Company updated successfully");
        closeFormModal();
      } else {
        // Super admin creates a new company
        await api.post("/companies", payload);
        toast.success("Company created successfully");
        closeFormModal();
      }

      await fetchCompanies();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Unable to save company. Please try again",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogoUpload = async () => {
    if (!logoFile) {
      toast.error("Please select logo first");
      return;
    }

    try {
      setLogoUploading(true);

      const body = new FormData();
      body.append("logo", logoFile);

      const res = await api.post("/companies/my-company/logo", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success(res.data?.message || "Logo uploaded successfully");

      // Clear the selected file and reload the company
      setLogoFile(null);
      if (logoInputRef.current) logoInputRef.current.value = "";
      fetchCompanies();
    } catch (error) {
      toast.error(error.response?.data?.message || "Logo upload failed");
    } finally {
      setLogoUploading(false);
    }
  };

  const updateCompanyStatus = async (company) => {
    const isInactive =
      String(company.status || "")
        .trim()
        .toLowerCase() === "inactive";

    const nextStatus = isInactive ? "active" : "inactive";

    try {
      if (nextStatus === "inactive") {
        await api.delete(`/companies/${company.id}`);
      } else {
        const payload = {
          ...cleanFormData(companyToForm(company)),
          status: "active",
        };

        await api.put(`/companies/${company.id}`, payload);
      }

      toast.success(
        `Company status changed to ${
          nextStatus === "active" ? "Active" : "Inactive"
        }`,
      );

      if (statusFilter !== "all" && companies.length === 1 && currentPage > 1) {
        setCurrentPage((page) => page - 1);
      } else {
        await fetchCompanies();
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Company status update failed",
      );
    }
  };

  const handleDelete = (company) => {
    const isInactive =
      String(company.status || "")
        .trim()
        .toLowerCase() === "inactive";

    const nextLabel = isInactive ? "Active" : "Inactive";

    toast(
      (t) => (
        <div className="flex min-w-[280px] flex-col gap-3">
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">
              Change Company Status?
            </p>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Set {company.name || "this company"} to {nextLabel}?
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium dark:border-slate-700"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => {
                toast.dismiss(t.id);
                updateCompanyStatus(company);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white ${
                isInactive
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {nextLabel}
            </button>
          </div>
        </div>
      ),
      { duration: 10000 },
    );
  };

  // Changing filter or search always starts again from page 1
  const changeStatusFilter = (value) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const changeSearch = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };

  // After KYC is approved, company admin can't change name / GST / PAN
  const isKycApproved =
    isCompanyAdmin &&
    ["approved", "manual_verified"].includes(companies[0]?.kyc_status);

  /* -------------------------------- Screen -------------------------------- */

  return (
    <div className="company-workspace w-full min-w-0 space-y-5 text-[15px] text-slate-700 dark:text-slate-200">
      {/* Page heading */}
      <header className="flex flex-col justify-between gap-4 py-1 sm:flex-row sm:items-center">
        <div>
          <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
            {isSuperAdmin
              ? "Administration / Companies"
              : "Business / Company Profile"}
          </p>

          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {isSuperAdmin ? "Manage Companies" : "Manage Company Profile"}
          </h1>

          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            Company details are used on invoices, PDFs and GST records.
          </p>
        </div>

        {isSuperAdmin && (
          <button
            type="button"
            onClick={openCreateModal}
            className={`${PRIMARY_BUTTON} w-fit`}
          >
            <Plus size={17} />
            Add Company
          </button>
        )}

        {isCompanyAdmin && !isEditMode && (
          <button
            type="button"
            onClick={() => setIsEditMode(true)}
            className={`${PRIMARY_BUTTON} w-fit`}
          >
            <Pencil size={17} />
            Update Settings
          </button>
        )}
      </header>

      {/* ---------- Super admin: stats + company table ---------- */}
      {isSuperAdmin && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatsCard
              title="Total Companies"
              value={stats.total}
              hint="All company records"
              tone="blue"
              icon={<Building2 size={20} />}
            />
            <StatsCard
              title="Active Companies"
              value={stats.active}
              hint="All active companies"
              tone="green"
              icon={<CheckCircle2 size={20} />}
            />
            <StatsCard
              title="Inactive Companies"
              value={stats.inactive}
              hint="All inactive companies"
              tone="red"
              icon={<XCircle size={20} />}
            />
            <StatsCard
              title="Countries"
              value={stats.countries}
              hint="Total countries"
              tone="purple"
              icon={<Globe size={20} />}
            />
          </div>

          <div className={`overflow-hidden ${CARD}`}>
            <StatusTabs value={statusFilter} onChange={changeStatusFilter} />

            <div className="border-b border-slate-100 p-4 dark:border-slate-800">
              <div className="relative">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  aria-label="Search companies"
                  placeholder="Search companies…"
                  value={search}
                  onChange={(e) => changeSearch(e.target.value)}
                  className="input !pl-10"
                />
              </div>
            </div>

            <CompanyTable
              companies={companies}
              onView={setViewCompany}
              onEdit={openEditModal}
              onDelete={handleDelete}
            />

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCompanies={totalCompanies}
              limit={limit}
              setLimit={setLimit}
              setCurrentPage={setCurrentPage}
            />
          </div>
        </>
      )}

      {/* ---------- Company admin: saved details (read only) ---------- */}
      {isCompanyAdmin && !isEditMode && (
        <CompanyAdminView
          formData={formData}
          logoFile={logoFile}
          setLogoFile={setLogoFile}
          logoInputRef={logoInputRef}
          logoUploading={logoUploading}
          onLogoUpload={handleLogoUpload}
        />
      )}

      {/* ---------- Company admin: edit form ---------- */}
      {isCompanyAdmin && isEditMode && (
        <div className={`overflow-hidden ${CARD}`}>
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Update Company Settings
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              Update your company profile details used on invoices and PDFs.
            </p>
          </div>

          <div className="bg-white p-5 dark:bg-slate-900">
            <CompanyForm
              formData={formData}
              errors={formErrors}
              onChange={handleChange}
              onSubmit={handleSubmit}
              onCancel={cancelCompanyAdminEdit}
              isCompanyAdmin
              isKycApproved={isKycApproved}
              isEditing
              submitting={submitting}
            />
          </div>
        </div>
      )}

      {/* ---------- Super admin: create / edit popup ---------- */}
      {showFormModal && (
        <CompanyFormModal
          title={editingId ? "Update Company" : "Create Company"}
          onClose={closeFormModal}
        >
          <CompanyForm
            formData={formData}
            errors={formErrors}
            onChange={handleChange}
            onSubmit={handleSubmit}
            onCancel={closeFormModal}
            isEditing={Boolean(editingId)}
            submitting={submitting}
            crmApiKey={crmApiKey}
            setCrmApiKey={setCrmApiKey}
            crmApiKeyConfigured={crmApiKeyConfigured}
          />
        </CompanyFormModal>
      )}

      {/* ---------- Super admin: view popup ---------- */}
      {viewCompany && (
        <CompanyViewModal
          company={viewCompany}
          onClose={() => setViewCompany(null)}
        />
      )}

      <style>{WORKSPACE_STYLES}</style>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  4. Super admin: list page pieces                                          */
/* -------------------------------------------------------------------------- */

function StatsCard({ title, value, hint, icon, tone = "blue" }) {
  const styles = STAT_TONES[tone] || STAT_TONES.blue;

  return (
    <div
      className={`flex min-w-0 items-center gap-3 rounded-xl border bg-gradient-to-br to-white px-4 py-3 shadow-sm dark:to-slate-900 ${styles.card}`}
    >
      <span className={`shrink-0 rounded-lg p-2.5 ${styles.icon}`}>{icon}</span>

      <div className="min-w-0">
        <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
        <p className="mt-1 text-2xl font-semibold leading-tight tabular-nums text-slate-900 dark:text-white">
          {value}
        </p>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      </div>
    </div>
  );
}

function StatusTabs({ value, onChange }) {
  return (
    <div
      className="flex flex-wrap gap-x-5 border-b border-slate-100 px-4 pt-3 dark:border-slate-800 sm:px-5"
      aria-label="Company status"
    >
      {STATUS_TABS.map((tab) => {
        const isActive = value === tab.value;

        return (
          <button
            key={tab.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(tab.value)}
            className={`whitespace-nowrap border-b-2 py-2 text-sm font-medium ${
              isActive
                ? "border-blue-600 text-blue-700 dark:text-blue-300"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function CompanyTable({ companies, onView, onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[740px] table-auto text-left text-sm">
        <thead className="bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
          <tr>
            {TABLE_HEADINGS.map((heading) => (
              <th
                key={heading}
                scope="col"
                className="px-3 py-3 text-left text-sm font-medium"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {companies.map((company) => (
            <CompanyRow
              key={company.id}
              company={company}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}

          {/* Empty state */}
          {companies.length === 0 && (
            <tr>
              <td colSpan={TABLE_HEADINGS.length} className="p-10 text-center">
                <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-950">
                  <Building2 className="mx-auto text-slate-400" size={34} />
                  <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                    No companies found
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                    Try changing search or status filter.
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

function CompanyRow({ company, onView, onEdit, onDelete }) {
  const isInactive =
    String(company.status || "")
      .trim()
      .toLowerCase() === "inactive";

  return (
    <tr className="border-t border-slate-100 transition hover:bg-blue-50/30 dark:border-slate-800 dark:hover:bg-slate-800/40">
      {/* Logo + name */}
      <td className={TABLE_CELL}>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
            {company.logo ? (
              <img
                src={getLogoUrl(company.logo)}
                alt="Logo"
                className="h-full w-full object-contain"
              />
            ) : (
              <Building2 size={19} />
            )}
          </div>

          <div className="min-w-0">
            <h3 className="break-words font-semibold text-slate-900 dark:text-white">
              {company.name || "-"}
            </h3>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Currency: {company.currency || "INR"}
            </p>
          </div>
        </div>
      </td>

      {/* GST / PAN */}
      <td className={TABLE_CELL_TEXT}>
        <p>GST: {company.gst_number || "-"}</p>
        <p>PAN: {company.pan_number || "-"}</p>
      </td>

      {/* Contact */}
      <td className={TABLE_CELL_TEXT}>
        <p>{company.email || "-"}</p>
        <p>{company.phone || "-"}</p>
      </td>

      {/* Location */}
      <td className={TABLE_CELL_TEXT}>
        <p>{company.state || "-"}</p>
        <p>{company.country || "-"}</p>
      </td>

      {/* Status */}
      <td className={TABLE_CELL}>
        <StatusBadge status={company.status} />
      </td>

      {/* Actions */}
      <td className={TABLE_CELL}>
        <div className="inline-flex flex-nowrap items-center gap-1">
          <IconButton
            label="View company"
            icon={<Eye size={16} />}
            className="bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300"
            onClick={() => onView(company)}
          />

          <IconButton
            label="Edit company"
            icon={<Pencil size={16} />}
            className="bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
            onClick={() => onEdit(company)}
          />

          <button
            type="button"
            onClick={() => onDelete(company)}
            aria-label={`Set company ${isInactive ? "Active" : "Inactive"}`}
            className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-semibold transition ${
              isInactive
                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300"
            }`}
          >
            {isInactive ? "Active" : "Inactive"}
          </button>
        </div>
      </td>
    </tr>
  );
}

function Pagination({
  currentPage,
  totalPages,
  totalCompanies,
  limit,
  setLimit,
  setCurrentPage,
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
        Total Companies: {totalCompanies}
      </p>

      <div className="flex items-center gap-2">
        <select
          value={limit}
          onChange={(e) => {
            setLimit(Number(e.target.value));
            setCurrentPage(1);
          }}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-blue-950/50"
        >
          {[5, 10, 20, 50].map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => setCurrentPage((page) => page - 1)}
          className={PAGER_BUTTON}
        >
          Prev
        </button>

        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          Page {currentPage} of {totalPages}
        </span>

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => setCurrentPage((page) => page + 1)}
          className={PAGER_BUTTON}
        >
          Next
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  5. Popups (modals)                                                        */
/* -------------------------------------------------------------------------- */

function CompanyFormModal({
  title,
  children,
  onClose,
  icon = <Building2 size={22} />,
  description = "Company information used for invoicing and GST records.",
}) {
  // Close the popup when the Escape key is pressed
  useEffect(() => {
    const closeOnEscape = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return createPortal(
    <div className="company-workspace fixed inset-0 z-[50000] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              {icon}
            </span>

            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Company Workspace
              </p>
              <h2 className="break-words text-xl font-semibold text-slate-900 dark:text-white">
                {title}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {description}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close company dialog"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {children}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function CompanyViewModal({ company, onClose }) {
  const icon = company.logo ? (
    <img
      src={getLogoUrl(company.logo)}
      alt=""
      className="h-full w-full object-contain"
    />
  ) : (
    <Building2 size={22} />
  );

  return (
    <CompanyFormModal
      title={company.name || "Company Details"}
      description="Contact, tax and registered office information."
      icon={icon}
      onClose={onClose}
    >
      <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
        <ViewField label="Company Name" value={company.name} />
        <ViewField
          label="Status"
          value={<StatusBadge status={company.status} />}
        />
        <ViewField label="GST Number" value={company.gst_number} />
        <ViewField label="PAN Number" value={company.pan_number} />
        <ViewField label="Email" value={company.email} />
        <ViewField label="Phone" value={company.phone} />
        <ViewField label="Website" value={company.website} />
        <ViewField label="Currency" value={company.currency || "INR"} />
        <ViewField label="Head Office Code" value={company.hq_branch_code} />
        <ViewField label="City" value={company.city} />
        <ViewField label="State" value={company.state} />
        <ViewField label="Country" value={company.country} />
        <ViewField label="Zip Code" value={company.zip_code} />

        <div className="sm:col-span-2 xl:col-span-4">
          <ViewField label="Address" value={company.address} />
        </div>
      </div>
    </CompanyFormModal>
  );
}

/* -------------------------------------------------------------------------- */
/*  6. Company admin: saved details screen                                    */
/* -------------------------------------------------------------------------- */

function CompanyAdminView({
  formData,
  logoFile,
  setLogoFile,
  logoInputRef,
  logoUploading,
  onLogoUpload,
}) {
  return (
    <div className={`${CARD} p-4`}>
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Saved Company Details
        </h2>
        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
          Review the company information shown on invoices and PDFs.
        </p>
      </div>

      {/* Logo preview + upload */}
      <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50/50 p-4 dark:border-slate-700 dark:bg-slate-950">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              {formData.logo ? (
                <img
                  src={getLogoUrl(formData.logo)}
                  alt="Company Logo"
                  className="h-full w-full object-contain"
                />
              ) : (
                <ImageIcon size={28} className="text-slate-400" />
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Company Logo
              </h3>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                This logo will be used on invoices and PDFs.
              </p>

              {logoFile && (
                <p className="mt-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                  Selected: {logoFile.name}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800 dark:file:bg-slate-700 dark:hover:file:bg-slate-600 sm:w-72"
            />

            <button
              type="button"
              onClick={onLogoUpload}
              disabled={logoUploading}
              className={PRIMARY_BUTTON}
            >
              <Upload size={16} />
              {logoUploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>
      </div>

      {/* Saved details */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ViewField label="Company Name" value={formData.name} />
        <ViewField label="GST Number" value={formData.gst_number} />
        <ViewField label="PAN Number" value={formData.pan_number} />
        <ViewField label="Currency" value={formData.currency} />
        <ViewField label="Email" value={formData.email} />
        <ViewField label="Phone" value={formData.phone} />
        <ViewField label="Website" value={formData.website} />
        <ViewField label="Head Office Code" value={formData.hq_branch_code} />
        <ViewField label="City" value={formData.city} />
        <ViewField label="State" value={formData.state} />
        <ViewField label="Country" value={formData.country} />
        <ViewField label="Zip Code" value={formData.zip_code} />
        <ViewField label="Address" value={formData.address} full />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  7. The company form (used by both super admin and company admin)         */
/* -------------------------------------------------------------------------- */

function CompanyForm({
  formData,
  errors = {},
  onChange,
  onSubmit,
  onCancel,
  isCompanyAdmin = false,
  isKycApproved = false,
  isEditing = false,
  submitting = false,
  crmApiKey = "",
  setCrmApiKey,
  crmApiKeyConfigured = false,
}) {
  // After KYC approval a company admin can't change name / GST / PAN
  const lockLegalFields = isCompanyAdmin && isKycApproved;

  // The CRM key box is only for super admin while editing a company
  const showCrmKey = !isCompanyAdmin && isEditing;

  // Gives a text box everything it needs: name, value, error and onChange.
  // Usage: <TextField label="Email" {...fieldProps("email")} />
  const fieldProps = (name) => ({
    name,
    value: formData[name],
    error: errors[name],
    onChange,
  });

  // Our dropdown gives a plain value, but onChange expects an event.
  // So we create a small fake event here.
  const changeSelect = (name, value) => onChange({ target: { name, value } });

  let submitText = isEditing ? "Save Changes" : "Create Company";
  if (submitting) submitText = isEditing ? "Saving..." : "Creating...";

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-2xl bg-white dark:bg-slate-900"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TextField
          label="Company Name"
          icon={<Building2 size={16} />}
          required
          disabled={lockLegalFields}
          {...fieldProps("name")}
        />

        <TextField
          label="GST Number"
          icon={<BadgePercent size={16} />}
          disabled={lockLegalFields}
          {...fieldProps("gst_number")}
        />

        <TextField
          label="PAN Number"
          icon={<Landmark size={16} />}
          disabled={lockLegalFields}
          {...fieldProps("pan_number")}
        />

        <Field label="Currency" icon={<Wallet size={16} />}>
          <CustomSelect
            value={formData.currency}
            onChange={(value) => changeSelect("currency", value)}
            options={CURRENCY_OPTIONS}
          />
        </Field>

        <TextField
          label="Email"
          icon={<Mail size={16} />}
          type="email"
          {...fieldProps("email")}
        />

        <TextField
          label="Phone"
          icon={<Phone size={16} />}
          {...fieldProps("phone")}
        />

        <TextField
          label="Website"
          icon={<Globe size={16} />}
          {...fieldProps("website")}
        />

        <TextField
          label="City"
          icon={<MapPin size={16} />}
          {...fieldProps("city")}
        />

        <TextField
          label="State"
          icon={<MapPin size={16} />}
          {...fieldProps("state")}
        />

        <TextField
          label="Country"
          icon={<MapPin size={16} />}
          {...fieldProps("country")}
        />

        <TextField
          label="Zip Code"
          icon={<MapPin size={16} />}
          {...fieldProps("zip_code")}
        />

        <TextField
          label="Head Office Code"
          icon={<Building2 size={16} />}
          required
          placeholder="HQ001"
          maxLength={20}
          className="uppercase"
          {...fieldProps("hq_branch_code")}
        />

        {/* Only super admin can change the status */}
        {!isCompanyAdmin && (
          <Field label="Status">
            <CustomSelect
              value={formData.status}
              onChange={(value) => changeSelect("status", value)}
              options={STATUS_OPTIONS}
            />
          </Field>
        )}

        {/* CRM API key (super admin, edit only) and address share one row */}
        <div
          className={`grid grid-cols-1 gap-4 md:col-span-2 xl:col-span-4 ${
            showCrmKey ? "md:grid-cols-2" : ""
          }`}
        >
          {showCrmKey && (
            <Field label="CRM API Key" icon={<KeyRound size={16} />}>
              <input
                type="password"
                value={crmApiKey}
                onChange={(e) => setCrmApiKey?.(e.target.value)}
                placeholder={
                  crmApiKeyConfigured
                    ? "Leave blank to keep existing key"
                    : "Enter CRM API key"
                }
                autoComplete="new-password"
                className="input"
              />
            </Field>
          )}

          <Field label="Address" icon={<MapPin size={16} />}>
            <textarea
              name="address"
              value={formData.address}
              onChange={onChange}
              rows={1}
              placeholder="Enter company address"
              className="input min-h-[42px] resize-none"
            />
          </Field>
        </div>
      </div>

      {/* Buttons */}
      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 dark:border-slate-800 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          <X size={16} />
          Cancel
        </button>

        <button
          type="submit"
          disabled={submitting}
          className={`${PRIMARY_BUTTON} px-5`}
        >
          {isEditing ? <Save size={17} /> : <Plus size={17} />}
          {submitText}
        </button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  8. Small reusable pieces                                                  */
/* -------------------------------------------------------------------------- */

// Label + icon + error message around any input
function Field({ label, icon, children, required = false, error = "" }) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {icon}
        <span>
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </span>
      </label>

      {children}

      {error && (
        <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

// A Field with a normal text box inside.
// Any extra props (disabled, placeholder, maxLength, type...) go to the <input>.
function TextField({
  name,
  label,
  icon,
  value,
  error,
  onChange,
  required,
  className = "",
  ...inputProps
}) {
  return (
    <Field label={label} icon={icon} required={required} error={error}>
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        aria-invalid={Boolean(error)}
        className={`input ${className} ${error ? "input-error" : ""}`}
        {...inputProps}
      />
    </Field>
  );
}

// Read-only box that shows one value ("-" if empty)
function ViewField({ label, value, full }) {
  return (
    <div className={full ? "md:col-span-2 xl:col-span-4" : ""}>
      <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </p>

      <div className="min-h-[42px] whitespace-pre-wrap [overflow-wrap:anywhere] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {value || "-"}
      </div>
    </div>
  );
}

function IconButton({ icon, label, className, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`rounded-xl p-2 shadow-sm transition-all duration-200 ${className}`}
    >
      {icon}
    </button>
  );
}

function StatusBadge({ status }) {
  const value = String(status || "inactive").toLowerCase();
  const style = STATUS_BADGE_STYLES[value] || STATUS_BADGE_STYLES.inactive;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold capitalize shadow-sm ${style}`}
    >
      {value}
    </span>
  );
}

// Custom dropdown. The list is rendered in a portal (document.body)
// so it doesn't get cut off inside the popup.
function CustomSelect({ value, onChange, options, className = "" }) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const selected = options.find(
    (option) => String(option.value) === String(value),
  );

  useEffect(() => {
    if (!open) return;

    // Show the list below the button, or above it if there is no space below
    const updatePosition = () => {
      if (!buttonRef.current) return;

      const rect = buttonRef.current.getBoundingClientRect();
      const listHeight = Math.min(options.length * 44 + 16, 220);
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpwards = spaceBelow < listHeight + 12 && rect.top > listHeight;

      setDropdownStyle({
        position: "fixed",
        left: rect.left,
        top: openUpwards ? rect.top - listHeight - 8 : rect.bottom + 8,
        width: rect.width,
        zIndex: 50010,
      });
    };

    // Close the list when the user clicks anywhere outside
    const closeOnOutsideClick = (e) => {
      const clickedInside =
        buttonRef.current?.contains(e.target) ||
        dropdownRef.current?.contains(e.target);

      if (!clickedInside) setOpen(false);
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    document.addEventListener("mousedown", closeOnOutsideClick);

    // Cleanup when the list closes
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      document.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, [open, options.length]);

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-normal text-slate-700 shadow-sm outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:focus:ring-blue-950/50 ${className}`}
      >
        <span className="truncate">{selected?.label || "Select"}</span>

        <ChevronDown
          size={17}
          className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            {options.map((option) => {
              const isActive = String(option.value) === String(value);

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-normal transition ${
                    isActive
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                      : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  {option.label}
                  {isActive && <CheckCircle2 size={16} />}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}

export default Company;
