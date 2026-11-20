import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import { toast } from "react-hot-toast";
import { createPortal } from "react-dom";
import {
  Users,
  UserPlus,
  Mail,
  Lock,
  Building2,
  ShieldCheck,
  Crown,
  Search,
  Pencil,
  X,
  CheckCircle2,
  XCircle,
  Eye,
  Filter,
  Save,
  Plus,
  Phone,
  BadgePercent,
  Wallet,
  MapPin,
  ChevronDown,
} from "lucide-react";
function Admins() {
  const [admins, setAdmins] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editId, setEditId] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [viewAdmin, setViewAdmin] = useState(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAdmins, setTotalAdmins] = useState(0);
  const initialForm = {
    name: "",
    email: "",
    password: "",
    company_id: "",
  };
  const initialCompanyForm = {
    name: "",
    email: "",
    phone: "",
    gst_number: "",
    pan_number: "",
    currency: "INR",
    address: "",
    state: "",
    country: "India",
    zip_code: "",
    status: "active",
  };
  const [formData, setFormData] = useState(initialForm);
  const [companyForm, setCompanyForm] = useState(initialCompanyForm);
  const stats = useMemo(() => {
    const active = admins.filter((a) => a.status !== "inactive").length;
    const inactive = admins.filter((a) => a.status === "inactive").length;
    const assignedCompanies = new Set(
      admins.map((a) => a.company_id).filter(Boolean),
    ).size;
    return {
      total: totalAdmins,
      active,
      inactive,
      assignedCompanies,
    };
  }, [admins]);
  const fetchAdmins = async () => {
    try {
      const res = await api.get("/users/admins", {
        params: {
          page: currentPage,
          limit,
          search,
          status: statusFilter,
        },
      });
      setAdmins(res.data.admins || []);
      setTotalAdmins(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch admins");
    }
  };
  const fetchCompanies = async () => {
    try {
      const res = await api.get("/companies", {
        params: {
          page: 1,
          limit: 1000,
          status: "all",
        },
      });
      setCompanies(res.data.companies || []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch companies");
    }
  };
  useEffect(() => {
    fetchAdmins();
  }, [currentPage, limit, search, statusFilter]);
  useEffect(() => {
    fetchCompanies();
  }, []);
  const openCreateModal = () => {
    setEditId(null);
    setFormData(initialForm);
    setShowFormModal(true);
  };
  const openEditModal = (admin) => {
    setEditId(admin.id);
    setFormData({
      name: admin.name || "",
      email: admin.email || "",
      password: "",
      company_id: admin.company_id || "",
    });
    setShowFormModal(true);
  };
  const closeFormModal = () => {
    setShowFormModal(false);
    setEditId(null);
    setFormData(initialForm);
  };
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "company_id" && value === "__add_company__") {
      setShowCompanyModal(true);
      return;
    }
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };
  const handleCompanyChange = (e) => {
    setCompanyForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };
  const resetCompanyForm = () => {
    setCompanyForm(initialCompanyForm);
  };
  const handleCreateCompany = async () => {
    if (!companyForm.name.trim()) {
      toast.error("Company name is required");
      return;
    }
    try {
      setCompanyLoading(true);
      const payload = {
        ...companyForm,
        name: companyForm.name.trim(),
        email: companyForm.email.trim().toLowerCase(),
      };
      const res = await api.post("/companies", payload);
      const newCompany = res.data?.company || res.data;
      const companyRes = await api.get("/companies", {
        params: {
          page: 1,
          limit: 1000,
          status: "all",
        },
      });
      const updatedCompanies = companyRes.data.companies || [];
      setCompanies(updatedCompanies);
      const selectedCompany =
        newCompany?.id ||
        newCompany?.company_id ||
        updatedCompanies.find(
          (company) =>
            String(company.name || company.company_name || "").toLowerCase() ===
            payload.name.toLowerCase(),
        )?.id;
      if (selectedCompany) {
        setFormData((prev) => ({
          ...prev,
          company_id: selectedCompany,
        }));
      }
      resetCompanyForm();
      setShowCompanyModal(false);
      toast.success("Company added successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Company create failed");
    } finally {
      setCompanyLoading(false);
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.company_id
    ) {
      toast.error("Name, email and company are required");
      return;
    }
    if (!editId && !formData.password) {
      toast.error("Password is required");
      return;
    }
    try {
      const payload = {
        ...formData,
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
      };
      if (editId) {
        await api.put(`/users/admin/${editId}`, payload);
        toast.success("Admin updated successfully");
      } else {
        await api.post("/users/admin", payload);
        toast.success("Admin created successfully");
      }
      closeFormModal();
      fetchAdmins();
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    }
  };
  const handleToggleStatus = async (admin) => {
    const currentStatus = admin.status || "active";
    const nextStatus = currentStatus === "inactive" ? "active" : "inactive";
    toast(
      (t) => (
        <div className="flex min-w-[280px] flex-col gap-3">
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              {nextStatus === "active"
                ? "Activate Admin?"
                : "Deactivate Admin?"}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Are you sure you want to{" "}
              {nextStatus === "active" ? "activate" : "deactivate"} this admin?
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                toast.dismiss(t.id);
                try {
                  await api.patch(`/users/admin/${admin.id}/status`, {
                    status: nextStatus,
                  });
                  toast.success(
                    `Admin ${
                      nextStatus === "active" ? "activated" : "deactivated"
                    } successfully`,
                  );
                  fetchAdmins();
                } catch (error) {
                  toast.error(
                    error.response?.data?.message || "Status update failed",
                  );
                }
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold text-white ${
                nextStatus === "active"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {nextStatus === "active" ? "Activate" : "Deactivate"}
            </button>
          </div>
        </div>
      ),
      {
        duration: 10000,
      },
    );
  };
  return (
    <div className="w-full max-w-full min-w-0 space-y-5 overflow-x-hidden">
      <div className="px-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Crown size={17} />
              Workspace / Admins
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Manage Company Admins
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Create, update and activate/deactivate company admin accounts.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="flex w-fit items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-0 active:ring-0"
          >
            <UserPlus size={17} />
            Add Admin
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Admins"
          value={stats.total}
          icon={<Users size={20} />}
          color="bg-blue-50 text-blue-700"
        />
        <StatsCard
          title="Active Admins"
          value={stats.active}
          icon={<CheckCircle2 size={20} />}
          color="bg-emerald-50 text-emerald-700"
        />
        <StatsCard
          title="Inactive Admins"
          value={stats.inactive}
          icon={<XCircle size={20} />}
          color="bg-red-50 text-red-700"
        />
        <StatsCard
          title="Assigned Companies"
          value={stats.assignedCompanies}
          icon={<Building2 size={20} />}
          color="bg-purple-50 text-purple-700"
        />
      </div>
      <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="border-b border-slate-200 dark:border-slate-800 p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                All Admins
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Current admin records and company assignments.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative w-full sm:w-80">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search admin/company"
                  className="admin-input !pl-10"
                />
              </div>
              <div className="w-full sm:w-44">
                <CustomDropdown
                  value={statusFilter}
                  onChange={(value) => {
                    setStatusFilter(value);
                    setCurrentPage(1);
                  }}
                  icon={<Filter size={16} />}
                  options={[
                    { value: "all", label: "All Status" },
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
        <AdminsTable
          admins={admins}
          onView={setViewAdmin}
          onEdit={openEditModal}
          onToggleStatus={handleToggleStatus}
        />
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          total={totalAdmins}
          limit={limit}
          setLimit={setLimit}
          setCurrentPage={setCurrentPage}
        />
      </div>
      {showFormModal && (
        <AdminFormModal
          title={editId ? "Update Admin" : "Create Admin"}
          onClose={closeFormModal}
        >
          <AdminForm
            formData={formData}
            companies={companies}
            editId={editId}
            handleChange={handleChange}
            handleSubmit={handleSubmit}
            onCancel={closeFormModal}
          />
        </AdminFormModal>
      )}
      {showCompanyModal && (
        <CompanyQuickModal
          companyForm={companyForm}
          loading={companyLoading}
          onChange={handleCompanyChange}
          onClose={() => setShowCompanyModal(false)}
          onSave={handleCreateCompany}
        />
      )}
      {viewAdmin && (
        <AdminViewModal admin={viewAdmin} onClose={() => setViewAdmin(null)} />
      )}
      <style>{`
        .admin-input {
          width: 100%;
          border: 1px solid #cbd5e1;
          padding: 10px 12px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 400;
          outline: none;
          background: #ffffff;
          color: #334155;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease, color 0.2s ease;
        }
        .admin-input::placeholder {
          color: #94a3b8;
        }
        .admin-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px #dbeafe;
        }
        .dark .admin-input {
          border-color: #334155;
          background: #0f172a;
          color: #e2e8f0;
        }
        .dark .admin-input::placeholder {
          color: #64748b;
        }
        .dark .admin-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.35);
        }
      `}</style>
    </div>
  );
}
// Keep summary cards compact and use the same colour palette as other modules.
function StatsCard({ title, value, icon, color }) {
  const tones = {
    "bg-blue-50 text-blue-700":
      "border-blue-200 from-blue-50 dark:border-blue-900/50 dark:from-blue-950/30",
    "bg-emerald-50 text-emerald-700":
      "border-emerald-200 from-emerald-50 dark:border-emerald-900/50 dark:from-emerald-950/30",
    "bg-red-50 text-red-700":
      "border-red-200 from-red-50 dark:border-red-900/50 dark:from-red-950/30",
    "bg-purple-50 text-purple-700":
      "border-purple-200 from-purple-50 dark:border-purple-900/50 dark:from-purple-950/30",
  };
  return (
    <div
      className={`flex min-w-0 items-center gap-3 rounded-2xl border bg-gradient-to-br to-white p-4 shadow-sm dark:to-slate-900 ${tones[color] || "border-slate-200 from-slate-50 dark:border-slate-800"}`}
    >
      <span className={`shrink-0 rounded-xl p-3 ${color}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
        <h2 className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
          {value}
        </h2>
      </div>
    </div>
  );
}

function AdminsTable({ admins, onView, onEdit, onToggleStatus }) {
  return (
    <div className="w-[1200px] min-w-0">
      <table className="w-[1150px]  table-fixed text-left text-sm [&_td]:align-middle">
        <colgroup>
          {[22, 24, 20, 10, 24].map((width, index) => (
            <col key={index} style={{ width: `${width}%` }} />
          ))}
        </colgroup>

        <thead className="bg-blue-50 dark:bg-blue-950/40">
          <tr>
            {["Admin", "Email", "Company", "Status", "Actions"].map((head) => (
              <th
                key={head}
                className="px-3 py-4 text-left text-sm font-medium text-blue-800 dark:text-blue-200 first:pl-5 last:pr-5"
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {admins.map((admin) => {
            const isInactive = admin.status === "inactive";

            return (
              <tr
                key={admin.id}
                className="border-t border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
              >
                <td className="py-3 pl-5 pr-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="hidden shrink-0 rounded-xl bg-purple-50 p-2.5 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 xl:block">
                      <ShieldCheck size={18} />
                    </div>

                    <div className="min-w-0">
                      <h3 className="break-words font-semibold text-slate-900 dark:text-white">
                        {admin.name || "-"}
                      </h3>
                    </div>
                  </div>
                </td>

                <td className="px-3 py-3 font-medium text-slate-600 [overflow-wrap:anywhere] dark:text-slate-300">
                  {admin.email || "-"}
                </td>

                <td className="px-3 py-3 font-medium text-slate-700 [overflow-wrap:anywhere] dark:text-slate-200">
                  {admin.company_name || admin.name_company || "-"}
                </td>

                <td className="px-3 py-3 [&_span]:max-w-full [&_span]:break-words [&_span]:px-2.5">
                  <StatusBadge status={admin.status} />
                </td>

                <td className="py-3 pl-3 pr-5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <IconButton
                      label="View admin"
                      icon={<Eye size={16} />}
                      className="bg-blue-50 text-blue-700 hover:bg-blue-100"
                      onClick={() => onView(admin)}
                    />

                    <IconButton
                      label="Edit admin"
                      icon={<Pencil size={16} />}
                      className="bg-amber-50 text-amber-700 hover:bg-amber-100"
                      onClick={() => onEdit(admin)}
                    />

                    <button
                      type="button"
                      onClick={() => onToggleStatus(admin)}
                      className={`inline-flex max-w-full items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-sm font-semibold ${
                        isInactive
                          ? "bg-green-50 text-green-700 hover:bg-green-100"
                          : "bg-red-50 text-red-700 hover:bg-red-100"
                      }`}
                    >
                      {isInactive ? "Active" : "Inactive"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}

          {admins.length === 0 && (
            <tr>
              <td colSpan={5} className="p-10 text-center">
                <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800">
                  <Users className="mx-auto text-slate-400" size={34} />

                  <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                    No admins found
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

function AdminFormModal({ title, children, onClose }) {
  const isEdit = title?.toLowerCase().includes("update");
  return createPortal(
    <div className="fixed inset-0 z-[50000] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {isEdit ? (
                <Pencil size={24} strokeWidth={2.2} />
              ) : (
                <UserPlus size={24} strokeWidth={2.2} />
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                {title}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Assign company administrator and configure account details.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:text-slate-200"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-auto p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
function AdminForm({
  formData,
  companies,
  editId,
  handleChange,
  handleSubmit,
  onCancel,
}) {
  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-white dark:bg-slate-900"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InputWrapper label="Admin Name" icon={<Users size={16} />}>
          <input
            type="text"
            name="name"
            placeholder="Enter admin name"
            value={formData.name}
            onChange={handleChange}
            className="admin-input"
          />
        </InputWrapper>
        <InputWrapper label="Email Address" icon={<Mail size={16} />}>
          <input
            type="email"
            name="email"
            placeholder="Enter email"
            value={formData.email}
            onChange={handleChange}
            className="admin-input"
          />
        </InputWrapper>
        <InputWrapper
          label={editId ? "New Password Optional" : "Password"}
          icon={<Lock size={16} />}
        >
          <input
            type="password"
            name="password"
            placeholder={
              editId ? "Leave blank to keep old password" : "Create password"
            }
            value={formData.password}
            onChange={handleChange}
            className="admin-input"
          />
        </InputWrapper>
        <InputWrapper label="Assign Company" icon={<Building2 size={16} />}>
          <CompanySelect
            companies={companies}
            value={formData.company_id}
            onChange={handleChange}
          />
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Select an existing company or create a new company from here.
          </p>
        </InputWrapper>
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:justify-end">
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
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-0 active:ring-0"
        >
          {editId ? <Save size={17} /> : <UserPlus size={17} />}
          {editId ? "Save Changes" : "Create Admin"}
        </button>
      </div>
    </form>
  );
}
function CompanyQuickModal({
  companyForm,
  loading,
  onChange,
  onClose,
  onSave,
}) {
  return createPortal(
    <div className="fixed inset-0 z-[60000] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <Building2 size={22} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Add New Company
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Create a new company. It will automatically become available for
                admin assignment.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition-all duration-200 hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-auto p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InputWrapper label="Company Name" icon={<Building2 size={16} />}>
              <input
                name="name"
                value={companyForm.name}
                onChange={onChange}
                className="admin-input"
              />
            </InputWrapper>
            <InputWrapper label="Email" icon={<Mail size={16} />}>
              <input
                type="email"
                name="email"
                value={companyForm.email}
                onChange={onChange}
                className="admin-input"
              />
            </InputWrapper>
            <InputWrapper label="Phone" icon={<Phone size={16} />}>
              <input
                name="phone"
                value={companyForm.phone}
                onChange={onChange}
                className="admin-input"
              />
            </InputWrapper>
            <InputWrapper label="GST Number" icon={<BadgePercent size={16} />}>
              <input
                name="gst_number"
                value={companyForm.gst_number}
                onChange={onChange}
                className="admin-input"
              />
            </InputWrapper>
            <InputWrapper label="PAN Number" icon={<BadgePercent size={16} />}>
              <input
                name="pan_number"
                value={companyForm.pan_number}
                onChange={onChange}
                className="admin-input"
              />
            </InputWrapper>
            <InputWrapper label="Currency" icon={<Wallet size={16} />}>
              <CustomDropdown
                value={companyForm.currency}
                onChange={(value) =>
                  onChange({ target: { name: "currency", value } })
                }
                options={[
                  { value: "INR", label: "INR" },
                  { value: "USD", label: "USD" },
                ]}
              />
            </InputWrapper>
            <InputWrapper label="State" icon={<MapPin size={16} />}>
              <input
                name="state"
                value={companyForm.state}
                onChange={onChange}
                className="admin-input"
              />
            </InputWrapper>
            <InputWrapper label="Country" icon={<MapPin size={16} />}>
              <input
                name="country"
                value={companyForm.country}
                onChange={onChange}
                className="admin-input"
              />
            </InputWrapper>
            <InputWrapper label="Zip Code" icon={<MapPin size={16} />}>
              <input
                name="zip_code"
                value={companyForm.zip_code}
                onChange={onChange}
                className="admin-input"
              />
            </InputWrapper>
            <InputWrapper label="Status" icon={<CheckCircle2 size={16} />}>
              <CustomDropdown
                value={companyForm.status}
                onChange={(value) =>
                  onChange({ target: { name: "status", value } })
                }
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
            </InputWrapper>
            <div className="md:col-span-2">
              <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <MapPin size={16} />
                Address
              </label>
              <textarea
                name="address"
                value={companyForm.address}
                onChange={onChange}
                rows="3"
                className="admin-input"
              />
            </div>
          </div>
          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-200 dark:border-slate-700 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
            >
              <X size={16} />
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <Plus size={17} />
              {loading ? "Saving..." : "Save Company"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
function AdminViewModal({ admin, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[60000] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                {admin.name || "-"}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Complete admin account details
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-white dark:bg-slate-900"
          >
            <X size={20} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ViewField label="Admin Name" value={admin.name} />
            <ViewField
              label="Status"
              value={<StatusBadge status={admin.status} />}
            />
            <ViewField label="Email" value={admin.email} />
            <ViewField
              label="Role"
              value={(admin.role || "company_admin").replace("_", " ")}
            />
            <ViewField
              label="Company"
              value={admin.company_name || admin.name_company}
            />
            <ViewField label="Company ID" value={admin.company_id} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
function ViewField({ label, value }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </p>
      <div className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 break-words text-sm font-normal text-slate-700 dark:text-slate-200">
        {value || "-"}
      </div>
    </div>
  );
}
function InputWrapper({ label, icon, children }) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}
// Render menus outside scroll containers so modal edges do not clip them.
function CustomDropdown({ value, onChange, options, icon }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const selected = options.find(
    (option) => String(option.value) === String(value),
  );

  useEffect(() => {
    if (!open) return;
    const positionMenu = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(rect.width, window.innerWidth - 24);
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const openAbove = below < 240 && above > below;
      setMenuStyle({
        position: "fixed",
        width,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        ...(openAbove
          ? { bottom: window.innerHeight - rect.top + 6 }
          : { top: rect.bottom + 6 }),
        maxHeight: Math.max(40, Math.min(256, (openAbove ? above : below) - 6)),
        zIndex: 70000,
      });
    };
    const handleOutsideClick = (event) => {
      if (
        !buttonRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus({ preventScroll: true });
      }
    };
    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-normal text-slate-700 outline-none transition hover:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
          <span className="truncate">{selected?.label || "Select"}</span>
        </span>
        <ChevronDown
          size={17}
          className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className="overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
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
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-normal transition ${active ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white" : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"}`}
                >
                  <span>{option.label}</span>
                  {active && <CheckCircle2 size={16} className="shrink-0" />}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
function IconButton({ label, icon, className, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`shrink-0 rounded-lg p-2.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className}`}
    >
      {icon}
    </button>
  );
}
function CompanySelect({ companies, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState({});
  const buttonRef = useRef(null);
  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const selectedCompany = companies.find(
    (company) => String(company.id) === String(value),
  );
  const filteredCompanies = companies.filter((company) => {
    const searchableText =
      `${company.name || ""} ${company.company_name || ""} ${
        company.email || ""
      }`.toLowerCase();
    return searchableText.includes(companySearch.trim().toLowerCase());
  });
  const updateDropdownPosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const dropdownHeight = Math.min(330, Math.max(120, viewportHeight - 32));
    const dropdownWidth = Math.min(
      Math.max(rect.width, 280),
      viewportWidth - 24,
    );
    const left = Math.min(
      Math.max(12, rect.left),
      viewportWidth - dropdownWidth - 12,
    );
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const shouldOpenUp =
      spaceBelow < dropdownHeight + 12 && spaceAbove > spaceBelow;
    const top = shouldOpenUp
      ? Math.max(12, rect.top - dropdownHeight - 8)
      : Math.min(rect.bottom + 8, viewportHeight - dropdownHeight - 12);
    setDropdownStyle({
      position: "fixed",
      left,
      top,
      width: dropdownWidth,
      maxHeight: dropdownHeight,
      zIndex: 99999,
    });
  };
  useEffect(() => {
    if (!open) return;
    updateDropdownPosition();
    searchInputRef.current?.focus({ preventScroll: true });
    const handleClickOutside = (event) => {
      if (
        buttonRef.current?.contains(event.target) ||
        dropdownRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
      setCompanySearch("");
    };
    window.addEventListener("scroll", updateDropdownPosition, true);
    window.addEventListener("resize", updateDropdownPosition);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("scroll", updateDropdownPosition, true);
      window.removeEventListener("resize", updateDropdownPosition);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);
  const handleSelect = (selectedValue) => {
    onChange({
      target: {
        name: "company_id",
        value: selectedValue,
      },
    });
    setOpen(false);
    setCompanySearch("");
  };
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-normal text-slate-700 shadow-sm outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:focus:ring-blue-950/50"
      >
        <span className="min-w-0 truncate">
          {selectedCompany
            ? selectedCompany.name || selectedCompany.company_name
            : "Select Company"}
        </span>
        <ChevronDown
          size={17}
          className={`shrink-0 text-slate-400 transition dark:text-slate-500 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="border-b border-slate-100 p-2 dark:border-slate-800">
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                />
                <input
                  type="text"
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  placeholder="Search company..."
                  ref={searchInputRef}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm font-normal text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:bg-slate-900 dark:focus:ring-blue-950/50"
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto p-2">
              {filteredCompanies.map((company) => {
                const active = String(value) === String(company.id);
                return (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => handleSelect(company.id)}
                    className={`w-full rounded-xl px-3 py-2 text-left transition ${
                      active
                        ? "bg-blue-50 dark:bg-blue-950/40"
                        : "hover:bg-blue-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-normal text-slate-800 dark:text-slate-100">
                          {company.name || company.company_name}
                        </p>
                        <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                          {company.email || "No email"}
                        </p>
                      </div>
                      {active && (
                        <CheckCircle2
                          size={16}
                          className="mt-0.5 shrink-0 text-blue-700 dark:text-blue-300"
                        />
                      )}
                    </div>
                  </button>
                );
              })}
              {filteredCompanies.length === 0 && (
                <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  No company found
                </div>
              )}
            </div>
            <div className="border-t border-slate-100 p-2 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleSelect("__add_company__")}
                className="flex w-full items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-normal text-slate-900 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
              >
                <Plus size={16} />
                Add New Company
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
function StatusBadge({ status }) {
  const value = String(status || "active").toLowerCase();
  const styles = {
    active:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    inactive:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
    suspended:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold capitalize shadow-sm ${
        styles[value] || styles.active
      }`}
    >
      {value}
    </span>
  );
}
function Pagination({
  currentPage,
  totalPages,
  total,
  limit,
  setLimit,
  setCurrentPage,
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
        Total Admins: {total}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={limit}
          onChange={(e) => {
            setLimit(Number(e.target.value));
            setCurrentPage(1);
          }}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-blue-950/50"
        >
          <option value={5}>5 / page</option>
          <option value={10}>10 / page</option>
          <option value={20}>20 / page</option>
          <option value={50}>50 / page</option>
        </select>
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Prev
        </button>
        <span className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          Page {currentPage} of {totalPages || 1}
        </span>
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() =>
            setCurrentPage((prev) => Math.min(prev + 1, totalPages))
          }
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Next
        </button>
      </div>
    </div>
  );
}
export default Admins;
