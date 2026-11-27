import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import toast from "react-hot-toast";
import { createPortal } from "react-dom";
import {
  GitBranch,
  Building2,
  Mail,
  Phone,
  BadgePercent,
  MapPin,
  Search,
  Pencil,
  X,
  Save,
  Plus,
  Eye,
  CheckCircle2,
  XCircle,
  ChevronDown,
} from "lucide-react";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const ZIP_REGEX = /^\d{5,6}$/;
const BRANCH_NAME_REGEX = /^[a-zA-Z0-9\s.&'(),-]+$/;
const BRANCH_CODE_REGEX = /^[a-zA-Z0-9_-]{2,20}$/;
const cleanString = (value) =>
  String(value || "")
    .replace(/<[^>]*>?/gm, "")
    .trim();
const normalizeEmail = (email) => cleanString(email).toLowerCase();
const normalizeUpper = (value) => cleanString(value).toUpperCase();
function Branches() {
  const user = JSON.parse(localStorage.getItem("user"));
  const initialForm = {
    branch_name: "",
    branch_code: "",
    email: "",
    phone: "",
    gst_number: "",
    address: "",
    city: "",
    state: "",
    country: "India",
    zip_code: "",
    status: "active",
  };
  const [branches, setBranches] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [editId, setEditId] = useState(null);
  const [viewBranch, setViewBranch] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const canManageBranches =
    user?.role === "company_admin" || Boolean(user?.permissions?.branches);
  const canDeactivateBranch =
    user?.role === "company_admin" || Boolean(user?.permissions?.branches);
  const fetchBranches = async () => {
    try {
      const res = await api.get("/branches", {
        params: {
          search: search.trim() || undefined,
          status: statusFilter,
          limit: 1000,
        },
      });
      const list = Array.isArray(res.data)
        ? res.data
        : res.data?.branches || [];
      setBranches(list);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch branches");
    }
  };
  useEffect(() => {
    fetchBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);
  const stats = useMemo(() => {
    const active = branches.filter(
      (branch) => branch.status === "active",
    ).length;
    const inactive = branches.length - active;
    return {
      total: branches.length,
      active,
      inactive,
    };
  }, [branches]);
  const filteredBranches = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return branches.filter((branch) => {
      const matchesSearch =
        !keyword ||
        branch.branch_name?.toLowerCase().includes(keyword) ||
        branch.branch_code?.toLowerCase().includes(keyword) ||
        branch.email?.toLowerCase().includes(keyword) ||
        branch.phone?.toLowerCase().includes(keyword) ||
        branch.gst_number?.toLowerCase().includes(keyword) ||
        branch.city?.toLowerCase().includes(keyword) ||
        branch.state?.toLowerCase().includes(keyword) ||
        branch.country?.toLowerCase().includes(keyword);
      const matchesStatus =
        statusFilter === "all" || branch.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [branches, search, statusFilter]);
  const validateForm = () => {
    const nextErrors = {};
    const branchName = cleanString(formData.branch_name);
    const branchCode = normalizeUpper(formData.branch_code);
    const email = normalizeEmail(formData.email);
    const phone = cleanString(formData.phone);
    const gstNumber = normalizeUpper(formData.gst_number);
    const zipCode = cleanString(formData.zip_code);
    const country = cleanString(formData.country);
    const status = cleanString(formData.status).toLowerCase() || "active";
    if (!branchName) {
      nextErrors.branch_name = "Branch name is required";
    } else if (branchName.length < 2 || branchName.length > 100) {
      nextErrors.branch_name =
        "Branch name must be between 2 and 100 characters";
    } else if (!BRANCH_NAME_REGEX.test(branchName)) {
      nextErrors.branch_name = "Branch name contains invalid characters";
    }
    if (!branchCode) {
      nextErrors.branch_code = "Branch code is required";
    } else if (!BRANCH_CODE_REGEX.test(branchCode)) {
      nextErrors.branch_code =
        "Branch code must be 2-20 characters and can contain letters, numbers, underscore or hyphen";
    }
    if (email && !EMAIL_REGEX.test(email)) {
      nextErrors.email = "Invalid branch email format";
    }
    if (phone && !PHONE_REGEX.test(phone)) {
      nextErrors.phone = "Phone must be a valid 10 digit Indian mobile number";
    }
    if (gstNumber && !GST_REGEX.test(gstNumber)) {
      nextErrors.gst_number = "Invalid GST number format";
    }
    if (zipCode && !ZIP_REGEX.test(zipCode)) {
      nextErrors.zip_code = "ZIP code must be 5 to 6 digits";
    }
    if (country && country.length > 60) {
      nextErrors.country = "Country must be less than 60 characters";
    }
    if (!["active", "inactive"].includes(status)) {
      nextErrors.status = "Status must be active or inactive";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };
  const handleChange = (e) => {
    const { name, value } = e.target;
    let nextValue = value;
    if (name === "branch_code" || name === "gst_number") {
      nextValue = value.toUpperCase();
    }
    setFormData((prev) => ({
      ...prev,
      [name]: nextValue,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };
  const resetForm = () => {
    setFormData(initialForm);
    setErrors({});
    setEditId(null);
  };
  const openCreateModal = () => {
    resetForm();
    setShowFormModal(true);
  };
  const openEditModal = (branch) => {
    setEditId(branch.id);
    setErrors({});
    setFormData({
      branch_name: branch.branch_name || "",
      branch_code: branch.branch_code || "",
      email: branch.email || "",
      phone: branch.phone || "",
      gst_number: branch.gst_number || "",
      address: branch.address || "",
      city: branch.city || "",
      state: branch.state || "",
      country: branch.country || "India",
      zip_code: branch.zip_code || "",
      status: branch.status || "active",
      is_main: branch.is_main,
    });
    setShowFormModal(true);
  };
  const closeFormModal = () => {
    resetForm();
    setShowFormModal(false);
  };
  const buildPayload = () => ({
    branch_name: cleanString(formData.branch_name),
    branch_code: normalizeUpper(formData.branch_code),
    email: normalizeEmail(formData.email),
    phone: cleanString(formData.phone),
    gst_number: normalizeUpper(formData.gst_number),
    address: cleanString(formData.address),
    city: cleanString(formData.city),
    state: cleanString(formData.state),
    country: cleanString(formData.country) || "India",
    zip_code: cleanString(formData.zip_code),
    status: cleanString(formData.status).toLowerCase() || "active",
  });
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      setLoading(true);
      const payload = buildPayload();
      if (editId) {
        await api.put(`/branches/${editId}`, payload);
        toast.success("Branch updated successfully");
      } else {
        await api.post("/branches", payload);
        toast.success("Branch created successfully");
      }
      closeFormModal();
      fetchBranches();
    } catch (error) {
      toast.error(error.response?.data?.message || "Branch save failed");
    } finally {
      setLoading(false);
    }
  };
  const handleDeactivate = async (branch) => {
    if (branch.is_main === true || branch.is_main === 1) {
      toast.error("Main HQ branch cannot be deactivated");
      return;
    }
    toast(
      (t) => (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Deactivate this branch?
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {branch.branch_name || "Selected branch"} will become inactive.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                toast.dismiss(t.id);
                try {
                  await api.delete(`/branches/${branch.id}`);
                  toast.success("Branch deactivated successfully");
                  fetchBranches();
                } catch (error) {
                  toast.error(
                    error.response?.data?.message || "Deactivate failed",
                  );
                }
              }}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
            >
              Deactivate
            </button>
          </div>
        </div>
      ),
      { duration: 6000 },
    );
  };
  return (
    <div className="branch-workspace w-full min-w-0 space-y-5 text-[15px] text-slate-700 dark:text-slate-200">
      <header className="flex flex-col justify-between gap-4 py-1 sm:flex-row sm:items-center">
        <div>
          <p className="mb-2 text-sm text-slate-400">Business / Branches</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Branches
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Manage company branches, GST details and addresses.
          </p>
        </div>
        {canManageBranches && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <Plus size={17} /> Add Branch
          </button>
        )}
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Total Branches", stats.total, GitBranch, "blue"],
          ["Active Branches", stats.active, CheckCircle2, "emerald"],
          ["Inactive Branches", stats.inactive, XCircle, "amber"],
        ].map(([title, value, Icon, tone]) => (
          <SummaryCard
            key={title}
            title={title}
            value={value}
            icon={<Icon size={20} />}
            tone={tone}
          />
        ))}
      </div>
      <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div
          className="flex flex-wrap gap-x-5 border-b border-slate-100 px-4 pt-3 dark:border-slate-800 sm:px-5"
          aria-label="Branch status"
        >
          {[
            ["all", "All Branches"],
            ["active", "Active"],
            ["inactive", "Inactive"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={statusFilter === value}
              onClick={() => setStatusFilter(value)}
              className={`whitespace-nowrap border-b-2 py-2 text-sm font-medium transition ${statusFilter === value ? "border-blue-600 text-blue-600 dark:text-blue-300" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="border-b border-slate-100 p-4 dark:border-slate-800">
          <div className="relative">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              aria-label="Search branches"
              placeholder="Search by branch, code, GST or location…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input !pl-10"
            />
          </div>
        </div>
        <BranchTable
          branches={filteredBranches}
          onView={setViewBranch}
          onEdit={openEditModal}
          onDeactivate={handleDeactivate}
          canManageBranches={canManageBranches}
          canDeactivateBranch={canDeactivateBranch}
        />
      </div>
      {showFormModal && (
        <FormModal
          title={editId ? "Update Branch" : "Create Branch"}
          onClose={closeFormModal}
        >
          <BranchForm
            formData={formData}
            errors={errors}
            handleChange={handleChange}
            handleSubmit={handleSubmit}
            loading={loading}
            editId={editId}
            onCancel={closeFormModal}
          />
        </FormModal>
      )}
      {viewBranch && (
        <BranchViewModal
          key={viewBranch.id}
          branch={viewBranch}
          onClose={() => setViewBranch(null)}
        />
      )}
      <style>{`
        .branch-workspace .input {
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
        .branch-workspace .input::placeholder {
          color: #94a3b8;
        }
        .branch-workspace .input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px #dbeafe;
        }
        .branch-workspace .input-error {
          border-color: #f87171 !important;
        }
        .branch-workspace .input-error:focus {
          border-color: #ef4444 !important;
          box-shadow: 0 0 0 3px #fee2e2 !important;
        }
        .dark .branch-workspace .input {
          border-color: #334155;
          background: #0f172a;
          color: #e2e8f0;
        }
        .dark .branch-workspace .input::placeholder {
          color: #64748b;
        }
        .dark .branch-workspace .input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.35);
        }
        .dark .branch-workspace .input-error {
          border-color: #f87171 !important;
        }
        .dark .branch-workspace .input-error:focus {
          border-color: #ef4444 !important;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.25) !important;
        }
      `}</style>
    </div>
  );
}

function BranchTable({
  branches,
  onView,
  onEdit,
  onDeactivate,
  canManageBranches,
  canDeactivateBranch,
}) {
  return (
    <div className="w-[1200px] overflow-x-auto">
      <table className="w-full min-w-[800px] table-auto text-left text-sm">
        <colgroup>
          {[25, 17, 14, 12, 9, 23].map((width, index) => (
            <col key={index} style={{ width: `${width}%` }} />
          ))}
        </colgroup>
        <thead className="bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
          <tr>
            {["Branch", "Contact", "GST", "Location", "Status", "Actions"].map(
              (head) => (
                <th
                  key={head}
                  scope="col"
                  className="px-2.5 py-3 text-left text-sm font-semibold"
                >
                  {head}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {branches.map((branch) => (
            <tr
              key={branch.id}
              className="border-t border-slate-100 transition hover:bg-blue-50/30 dark:border-slate-800 dark:hover:bg-slate-800/40"
            >
              <td className="px-2.5 py-3 align-middle [overflow-wrap:anywhere]">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                    <GitBranch size={19} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {branch.branch_name || "-"}
                      </p>
                      {(branch.is_main === true || branch.is_main === 1) && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                          HQ
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-2.5 py-3 align-middle [overflow-wrap:anywhere] text-slate-600 dark:text-slate-300">
                <p>{branch.email || "-"}</p>
                <p>{branch.phone || "-"}</p>
              </td>
              <td className="px-2.5 py-3 align-middle [overflow-wrap:anywhere] text-slate-600 dark:text-slate-300">
                {branch.gst_number || "-"}
              </td>
              <td className="px-2.5 py-3 align-middle [overflow-wrap:anywhere] text-slate-600 dark:text-slate-300">
                {[branch.city, branch.state, branch.country]
                  .filter(Boolean)
                  .join(", ") || "-"}
              </td>
              <td className="px-2.5 py-3 align-middle [overflow-wrap:anywhere]">
                <StatusBadge status={branch.status} />
              </td>
              <td className="px-2.5 py-3 align-middle [overflow-wrap:anywhere]">
                <div className="inline-flex flex-nowrap items-center gap-1">
                  <IconButton
                    label="View branch"
                    icon={<Eye size={16} />}
                    className="bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
                    onClick={() => onView(branch)}
                  />
                  {canManageBranches && (
                    <IconButton
                      label="Edit branch"
                      icon={<Pencil size={16} />}
                      className="bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950"
                      onClick={() => onEdit(branch)}
                    />
                  )}
                  {canDeactivateBranch &&
                    branch.status !== "inactive" &&
                    branch.is_main !== true &&
                    branch.is_main !== 1 && (
                      <button
                        type="button"
                        aria-label="Deactivate branch"
                        className="shrink-0 whitespace-nowrap rounded-lg bg-red-50 px-2.5 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950"
                        onClick={() => onDeactivate(branch)}
                      >
                        Inactive
                      </button>
                    )}
                </div>
              </td>
            </tr>
          ))}
          {branches.length === 0 && (
            <tr>
              <td colSpan={6} className="p-10 text-center">
                <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-950">
                  <GitBranch className="mx-auto text-slate-400" size={34} />
                  <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                    No branches found
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
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

function BranchForm({
  formData,
  errors,
  handleChange,
  handleSubmit,
  loading,
  editId,
  onCancel,
}) {
  const isMainBranch = formData.is_main === true || formData.is_main === 1;
  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          icon={<GitBranch size={16} />}
          label="Branch Name"
          required
          error={errors.branch_name}
        >
          <input
            type="text"
            name="branch_name"
            value={formData.branch_name}
            onChange={handleChange}
            className={`input ${errors.branch_name ? "input-error" : ""}`}
            placeholder="Branch Office"
          />
        </Field>
        <Field
          icon={<Building2 size={16} />}
          label="Branch Code"
          required
          error={errors.branch_code}
        >
          <input
            type="text"
            name="branch_code"
            value={formData.branch_code}
            onChange={handleChange}
            className={`input ${errors.branch_code ? "input-error" : ""}`}
            placeholder="####"
          />
        </Field>
        <Field icon={<Mail size={16} />} label="Email" error={errors.email}>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className={`input ${errors.email ? "input-error" : ""}`}
            placeholder="branch\@company.com"
          />
        </Field>
        <Field icon={<Phone size={16} />} label="Phone" error={errors.phone}>
          <input
            type="text"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className={`input ${errors.phone ? "input-error" : ""}`}
            placeholder="0000000000"
          />
        </Field>
        <Field
          icon={<BadgePercent size={16} />}
          label="GST Number"
          error={errors.gst_number}
        >
          <input
            type="text"
            name="gst_number"
            value={formData.gst_number}
            onChange={handleChange}
            className={`input ${errors.gst_number ? "input-error" : ""}`}
            placeholder="Optional"
          />
        </Field>
        <Field icon={<MapPin size={16} />} label="City">
          <input
            type="text"
            name="city"
            value={formData.city}
            onChange={handleChange}
            className="input"
            placeholder="City"
          />
        </Field>
        <Field icon={<MapPin size={16} />} label="State">
          <input
            type="text"
            name="state"
            value={formData.state}
            onChange={handleChange}
            className="input"
            placeholder="State"
          />
        </Field>
        <Field
          icon={<MapPin size={16} />}
          label="ZIP Code"
          error={errors.zip_code}
        >
          <input
            type="text"
            name="zip_code"
            value={formData.zip_code}
            onChange={handleChange}
            className={`input ${errors.zip_code ? "input-error" : ""}`}
            placeholder="******"
          />
        </Field>
        <Field
          icon={<MapPin size={16} />}
          label="Country"
          error={errors.country}
        >
          <input
            type="text"
            name="country"
            value={formData.country}
            onChange={handleChange}
            className={`input ${errors.country ? "input-error" : ""}`}
            placeholder="India"
          />
        </Field>
        <Field
          icon={<CheckCircle2 size={16} />}
          label="Status"
          error={errors.status}
        >
          <CustomDropdown
            value={formData.status}
            onChange={(value) =>
              handleChange({
                target: { name: "status", value },
              })
            }
            icon={<CheckCircle2 size={16} />}
            disabled={isMainBranch}
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
          {isMainBranch && (
            <p className="mt-1 text-xs font-medium text-blue-600 dark:text-blue-300">
              HQ branch must remain active.
            </p>
          )}
        </Field>
        <div className="md:col-span-2">
          <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <MapPin size={16} />
            Address
          </label>
          <textarea
            name="address"
            value={formData.address}
            onChange={handleChange}
            rows="3"
            className="input"
            placeholder="Branch full address"
          />
        </div>
      </div>
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
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          {editId ? <Save size={17} /> : <Plus size={17} />}
          {loading ? "Saving..." : editId ? "Save Changes" : "Create Branch"}
        </button>
      </div>
    </form>
  );
}
const BRANCH_RECORDS = {
  Customers: {
    key: "customers",
    columns: [
      ["Customer", "customer_name"],
      ["Company", "company_name"],
      ["Email", "email"],
      ["Phone", "phone"],
      ["Status", "status"],
    ],
  },
  Quotations: {
    key: "quotations",
    columns: [
      ["Quotation", "quotation_number"],
      ["Customer", "customer_name"],
      ["Date", "quotation_date"],
      ["Total", "total_amount"],
      ["Status", "status"],
    ],
  },
  Invoices: {
    key: "invoices",
    columns: [
      ["Invoice", "invoice_number"],
      ["Customer", "customer_name"],
      ["Date", "invoice_date"],
      ["Total", "total_amount"],
      ["Balance due", "balance_due"],
      ["Status", "status"],
    ],
  },
  Payments: {
    key: "payments",
    columns: [
      ["Invoice", "invoice_number"],
      ["Customer", "customer_name"],
      ["Date", "payment_date"],
      ["Amount", "amount"],
      ["Method", "payment_method"],
    ],
  },
};

async function loadBranchRecords(key, branch, signal) {
  const records = new Map();
  const paginated = key === "customers" || key === "quotations";
  let totalPages = 1;
  for (let page = 1; page <= totalPages; page += 1) {
    const { data } = await api.get(`/${key}`, {
      signal,
      ...(paginated ? { params: { page, limit: 1000, status: "all" } } : {}),
    });
    const rows = Array.isArray(data) ? data : data?.[key];
    if (!Array.isArray(rows)) throw new Error("Unexpected list response.");
    if (paginated && !Array.isArray(data)) {
      if (
        !Number.isInteger(data.totalPages) ||
        data.totalPages < 0 ||
        Number(data.page) !== page
      ) {
        throw new Error("Unexpected pagination response.");
      }
      totalPages = Math.max(totalPages, data.totalPages);
    }
    for (const record of rows) {
      // The payments endpoint supplies its linked invoice's branch_id.
      if (String(record.branch_id) !== String(branch.id)) continue;
      if (
        branch.company_id != null &&
        record.company_id != null &&
        String(record.company_id) !== String(branch.company_id)
      )
        continue;
      records.set(String(record.id), record);
    }
  }
  return Array.from(records.values());
}

const branchMoney = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});
function formatBranchRecord(field, value) {
  if (value == null || value === "") return "—";
  if (["amount", "total_amount", "balance_due"].includes(field)) {
    return Number.isFinite(Number(value))
      ? branchMoney.format(Number(value))
      : "—";
  }
  if (field.endsWith("_date")) return String(value).slice(0, 10);
  return String(value);
}

function BranchRecordList({ branch, category }) {
  const { key, columns } = BRANCH_RECORDS[category];
  const { id, company_id } = branch;
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const controller = new AbortController();
    setRows(null);
    setError("");
    setPage(1);
    loadBranchRecords(key, { id, company_id }, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setRows(result);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setError(
            failure.response?.status === 403
              ? `Your role cannot view ${key}.`
              : `Could not load ${key}.`,
          );
        }
      });
    return () => controller.abort();
  }, [id, company_id, key, attempt]);

  if (error)
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700"
      >
        <p>{error}</p>
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          className="font-medium text-blue-700 dark:text-blue-300"
        >
          Retry
        </button>
      </div>
    );
  if (!rows)
    return (
      <p role="status" className="py-5 text-sm text-slate-500">
        Loading {key}…
      </p>
    );
  if (!rows.length)
    return (
      <p className="py-5 text-sm text-slate-500">
        No {key} found for this branch.
      </p>
    );

  const lastPage = Math.ceil(rows.length / pageSize);
  const start = (page - 1) * pageSize;
  const pageButton =
    "rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-slate-700";
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="px-3 py-2 text-sm text-slate-500">
        {category} ({rows.length})
      </div>
      <table
        className="w-full text-left text-xs sm:text-sm"
        aria-label={`Branch ${key}`}
      >
        <thead className="bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
          <tr>
            {columns.map(([label, field]) => (
              <th
                key={field}
                scope="col"
                className="whitespace-nowrap px-5 py-4 text-left font-medium"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(start, start + pageSize).map((row) => (
            <tr
              key={row.id}
              className="border-t border-slate-100 align-top dark:border-slate-800"
            >
              {columns.map(([, field]) => (
                <td
                  key={field}
                 className="whitespace-nowrap px-5 py-4 align-middle"
                >
                  {formatBranchRecord(field, row[field])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {lastPage > 1 && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 p-3 text-sm dark:border-slate-800">
          <button
            type="button"
            className={pageButton}
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </button>
          <span>
            {page} / {lastPage}
          </span>
          <button
            type="button"
            className={pageButton}
            disabled={page === lastPage}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}

function BranchViewModal({ branch, onClose }) {
  const isHeadOffice = branch.is_main === true || branch.is_main === 1;
  const [tab, setTab] = useState("Overview");
  return (
    <FormModal
      title={branch.branch_name || "Branch Details"}
      description="Branch profile and related customer and billing records."
      onClose={onClose}
      wide
    >
      <nav
        aria-label="Branch details sections"
        className="mb-4 flex flex-wrap gap-x-4 border-b border-slate-200 dark:border-slate-800"
      >
        {["Overview", ...Object.keys(BRANCH_RECORDS)].map((label) => (
          <button
            key={label}
            type="button"
            aria-pressed={tab === label}
            onClick={() => setTab(label)}
            className={`border-b-2 px-1 py-2 text-sm font-medium ${tab === label ? "border-blue-600 text-blue-700 dark:text-blue-300" : "border-transparent text-slate-600 hover:text-blue-700 dark:text-slate-400"}`}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "Overview" ? (
        <>
          {isHeadOffice && (
            <p className="mb-4 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-sm font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              HQ Branch
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ViewField label="Branch Name" value={branch.branch_name} />
            <ViewField label="Branch Code" value={branch.branch_code} />
            <ViewField
              label="Status"
              value={<StatusBadge status={branch.status} />}
            />
            <ViewField label="GST Number" value={branch.gst_number} />
            <ViewField label="Email" value={branch.email} />
            <ViewField label="Phone" value={branch.phone} />
            <ViewField label="City" value={branch.city} />
            <ViewField label="State" value={branch.state} />
            <ViewField label="Country" value={branch.country} />
            <ViewField label="ZIP Code" value={branch.zip_code} />
            <ViewField label="Address" value={branch.address} full />
          </div>
        </>
      ) : (
        <BranchRecordList key={tab} branch={branch} category={tab} />
      )}
    </FormModal>
  );
}

function FormModal({
  title,
  children,
  onClose,
  description = "Fill branch information for multi-branch setup.",
  wide = false,
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return createPortal(
    <div className="branch-workspace fixed inset-0 z-[50000] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 ${wide ? "max-w-5xl" : "max-w-3xl"}`}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 shadow-sm dark:bg-blue-950/40 dark:text-blue-300">
              <GitBranch size={24} />
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-sm font-medium uppercase tracking-wider text-slate-400">
                Branch Workspace
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
            aria-label={`Close ${title}`}
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
function SummaryCard({ title, value, icon, tone }) {
  const colors = {
    blue: [
      "border-blue-200 from-blue-50 dark:border-blue-900 dark:from-blue-950/40",
      "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    ],
    emerald: [
      "border-emerald-200 from-emerald-50 dark:border-emerald-900 dark:from-emerald-950/40",
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    ],
    violet: [
      "border-violet-200 from-violet-50 dark:border-violet-900 dark:from-violet-950/40",
      "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    ],
    amber: [
      "border-amber-200 from-amber-50 dark:border-amber-900 dark:from-amber-950/40",
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    ],
  };
  const [card, badge] = colors[tone];
  return (
    <div
      className={`flex min-w-0 items-center gap-3 rounded-xl border bg-gradient-to-br to-white px-4 py-3 shadow-sm dark:to-slate-900 ${card}`}
    >
      <span className={`shrink-0 rounded-lg p-2.5 ${badge}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-sm text-slate-500 dark:text-slate-300">{title}</p>
        <p className="mt-1 text-2xl font-semibold leading-tight tabular-nums text-slate-900 dark:text-white">
          {value}
        </p>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Current branch records
        </p>
      </div>
    </div>
  );
}

function ViewField({ label, value, full }) {
  return (
    <div className={full ? "min-w-0 sm:col-span-2" : "min-w-0"}>
      <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </p>
      <div className="min-h-[42px] whitespace-pre-wrap [overflow-wrap:anywhere] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {value || "-"}
      </div>
    </div>
  );
}

function Field({ label, icon, children, required, error }) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {icon}
        <span>
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </span>
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

function CustomDropdown({ value, onChange, options, icon, disabled = false }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const selected = options.find(
    (option) => String(option.value) === String(value),
  );
  useEffect(() => {
    const closeDropdown = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", closeDropdown);
    return () => document.removeEventListener("mousedown", closeDropdown);
  }, []);
  return (
    <div ref={dropdownRef} className="relative min-w-0">
      <button
        type="button"
        disabled={disabled}
        aria-label="Branch status"
        aria-expanded={open}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-normal text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-blue-950/50 ${
          disabled
            ? "cursor-not-allowed opacity-60"
            : "hover:border-blue-400 dark:hover:border-blue-500"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon && (
            <span className="text-slate-400 dark:text-slate-500">{icon}</span>
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
      {open && !disabled && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-[9999] w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
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
                className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-normal transition hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800 dark:hover:text-blue-300 ${
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

function IconButton({ icon, label, className, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`shrink-0 rounded-lg p-2 transition ${className}`}
    >
      {icon}
    </button>
  );
}

function StatusBadge({ status }) {
  const value = status || "active";
  const styles = {
    active:
      "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    inactive:
      "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold capitalize shadow-sm ${
        styles[value] || styles.active
      }`}
    >
      {value}
    </span>
  );
}
export default Branches;
