import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import toast from "react-hot-toast";

import {
  Building2,
  Pencil,
  Trash2,
  Plus,
  X,
  Save,
  MapPin,
  BadgePercent,
  Wallet,
  Mail,
  Phone,
  Globe,
  Landmark,
  Search,
  Image,
  Upload,
  Eye,
  CheckCircle2,
  XCircle,
  Filter,
  ChevronDown,
  KeyRound,
} from "lucide-react";

function Company() {
  const user = JSON.parse(localStorage.getItem("user"));
  const isSuperAdmin = user?.role === "superadmin";
  const isCompanyAdmin = user?.role === "company_admin";

  const initialForm = {
    name: "",
    gst_number: "",
    address: "",
    currency: "INR",
    status: "active",
    email: "",
    phone: "",
    pan_number: "",
    website: "",
    state: "",
    country: "India",
    zip_code: "",
    logo: "",
  };

  const [companies, setCompanies] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formData, setFormData] = useState(initialForm);

  const [crmApiKey, setCrmApiKey] = useState("");
  const [crmApiKeyConfigured, setCrmApiKeyConfigured] = useState(false);

  const [showFormModal, setShowFormModal] = useState(false);
  const [viewCompany, setViewCompany] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCompanies, setTotalCompanies] = useState(0);

  const getLogoUrl = (logo) => {
    if (!logo) return "";
    if (logo.startsWith("http")) return logo;
    if (logo.startsWith("/upload")) return `http://localhost:5000${logo}`;
    return `http://localhost:5000/upload/company-logos/${logo}`;
  };

  const fillForm = (company) => {
    setFormData({
      name: company?.name || "",
      gst_number: company?.gst_number || "",
      address: company?.address || "",
      currency: company?.currency || "INR",
      status: company?.status || "active",
      email: company?.email || "",
      phone: company?.phone || "",
      pan_number: company?.pan_number || "",
      website: company?.website || "",
      state: company?.state || "",
      country: company?.country || "India",
      zip_code: company?.zip_code || "",
      logo: company?.logo || "",
    });
  };

  const fetchCompanies = async () => {
    try {
      if (isSuperAdmin) {
        const res = await api.get("/companies", {
          params: {
            page: currentPage,
            limit,
            search,
            status: statusFilter,
          },
        });

        setCompanies(res.data.companies || []);
        setTotalPages(res.data.totalPages || 1);
        setTotalCompanies(res.data.total || 0);
      }

      if (isCompanyAdmin) {
        const res = await api.get("/companies/my-company");
        setCompanies([res.data]);
        setEditingId(res.data.id);
        fillForm(res.data);
        setIsEditMode(false);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch company");
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [currentPage, limit, search, statusFilter]);

  const stats = useMemo(() => {
    const active = companies.filter((c) => c.status === "active").length;
    const inactive = companies.filter((c) => c.status !== "active").length;
    const countries = new Set(companies.map((c) => c.country).filter(Boolean))
      .size;

    return {
      total: totalCompanies,
      active,
      inactive,
      countries,
    };
  }, [companies, totalCompanies]);

  const openCreateModal = () => {
    setEditingId(null);
    setFormData(initialForm);
    setShowFormModal(true);
  };

  const openEditModal = (company) => {
    setEditingId(company.id);
    fillForm(company);

    setCrmApiKey("");
    setCrmApiKeyConfigured(Boolean(company?.crm_api_key_configured));

    setShowFormModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingId(null);
    setFormData(initialForm);

    setCrmApiKey("");
    setCrmApiKeyConfigured(false);
  };

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleLogoUpload = async () => {
    if (!logoFile) {
      toast.warn("Please select logo first");
      return;
    }

    try {
      setLogoUploading(true);

      const data = new FormData();
      data.append("logo", logoFile);

      const res = await api.post("/companies/my-company/logo", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success(res.data?.message || "Logo uploaded successfully");
      setLogoFile(null);

      if (logoInputRef.current) logoInputRef.current.value = "";

      fetchCompanies();
    } catch (error) {
      toast.error(error.response?.data?.message || "Logo upload failed");
    } finally {
      setLogoUploading(false);
    }
  };

  const resetCompanyAdminForm = () => {
    fillForm(companies[0]);
    setLogoFile(null);
    setIsEditMode(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.warn("Company name is required");
      return;
    }

    try {
      if (isCompanyAdmin) {
        await api.put("/companies/my-company", formData);
        toast.success("Company profile updated");
        setIsEditMode(false);
      } else if (editingId) {
        const payload = {
          ...formData,
        };

        if (crmApiKey.trim()) {
          payload.crm_api_key = crmApiKey.trim();
        }

        await api.put(`/companies/${editingId}`, payload);

        toast.success("Company updated");
        closeFormModal();
      } else {
        await api.post("/companies", formData);
        toast.success("Company created");
        closeFormModal();
      }

      fetchCompanies();
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    }
  };

  const isKycApproved =
    isCompanyAdmin && companies?.[0]?.kyc_status === "approved";

  const handleDelete = async (id) => {
    toast(
      (t) => (
        <div className="flex min-w-[280px] flex-col gap-3">
          <div>
            <p className="font-semibold text-slate-800">Deactivate Company?</p>
            <p className="mt-1 text-sm text-slate-500">
              Are you sure you want to deactivate this company?
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold"
            >
              Cancel
            </button>

            <button
              onClick={async () => {
                toast.dismiss(t.id);

                try {
                  await api.delete(`/companies/${id}`);
                  toast.success("Company deactivated");
                  fetchCompanies();
                } catch (error) {
                  toast.error(
                    error.response?.data?.message || "Deactivate failed",
                  );
                }
              }}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
            >
              Deactivate
            </button>
          </div>
        </div>
      ),
      { duration: 10000 },
    );
  };

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
              <Building2 size={17} />
              {isSuperAdmin ? "Company Management" : "Company Profile"}
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
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
              className="flex w-fit items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:ring-0"
            >
              <Plus size={17} />
              Add Company
            </button>
          )}

          {isCompanyAdmin && !isEditMode && (
            <button
              type="button"
              onClick={() => setIsEditMode(true)}
              className="flex w-fit items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:ring-0"
            >
              <Pencil size={17} />
              Update Settings
            </button>
          )}
        </div>
      </div>

      {isSuperAdmin && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatsCard
              title="Total Companies"
              value={stats.total}
              icon={<Building2 size={20} />}
              color="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
            />
            <StatsCard
              title="Active Companies"
              value={stats.active}
              icon={<CheckCircle2 size={20} />}
              color="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
            />
            <StatsCard
              title="Inactive Companies"
              value={stats.inactive}
              icon={<XCircle size={20} />}
              color="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
            />
            <StatsCard
              title="Countries"
              value={stats.countries}
              icon={<Globe size={20} />}
              color="bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 p-4 dark:border-slate-800">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Company List
                  </h2>
                  <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                    View, update and deactivate SaaS client companies.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative w-full sm:w-80">
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                    />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Search company"
                      className="input !pl-10"
                    />
                  </div>

                  <div className="relative w-full sm:w-48">
                    <Filter
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                    />
                    <CustomSelect
                      value={statusFilter}
                      onChange={(value) => {
                        setStatusFilter(value);
                        setCurrentPage(1);
                      }}
                      options={[
                        { value: "all", label: "All Status" },
                        { value: "active", label: "Active" },
                        { value: "inactive", label: "Inactive" },
                      ]}
                      className="!pl-10"
                    />
                  </div>
                </div>
              </div>
            </div>

            <CompanyTable
              companies={companies}
              getLogoUrl={getLogoUrl}
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

      {isCompanyAdmin && !isEditMode && (
        <CompanyAdminView
          formData={formData}
          logoFile={logoFile}
          setLogoFile={setLogoFile}
          logoInputRef={logoInputRef}
          logoUploading={logoUploading}
          handleLogoUpload={handleLogoUpload}
          getLogoUrl={getLogoUrl}
          onEdit={() => setIsEditMode(true)}
        />
      )}

      {isCompanyAdmin && isEditMode && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Update Company Settings
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              Update your company profile details used on invoices and PDFs.
            </p>
          </div>

          <div className="bg-white p-5 dark:bg-slate-900">
            <CompanyForm
              formData={formData}
              handleChange={handleChange}
              handleSubmit={handleSubmit}
              isCompanyAdmin={isCompanyAdmin}
              isKycApproved={isKycApproved}
              editingId={editingId}
              onCancel={resetCompanyAdminForm}
            />
          </div>
        </div>
      )}

      {showFormModal && (
        <CompanyFormModal
          title={editingId ? "Update Company" : "Create Company"}
          onClose={closeFormModal}
        >
          <CompanyForm
            formData={formData}
            handleChange={handleChange}
            handleSubmit={handleSubmit}
            isCompanyAdmin={false}
            isKycApproved={false}
            editingId={editingId}
            onCancel={closeFormModal}
            crmApiKey={crmApiKey}
            setCrmApiKey={setCrmApiKey}
            crmApiKeyConfigured={crmApiKeyConfigured}
          />
        </CompanyFormModal>
      )}

      {viewCompany && (
        <CompanyViewModal
          company={viewCompany}
          getLogoUrl={getLogoUrl}
          onClose={() => setViewCompany(null)}
        />
      )}

      <style>{`
        .input {
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

        .input::placeholder {
          color: #94a3b8;
        }

        .input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px #dbeafe;
        }

        .input:disabled {
          cursor: not-allowed;
          background: #f8fafc;
          color: #94a3b8;
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

        .dark .input:disabled {
          background: #020617;
          color: #64748b;
        }

        button:focus,
        button:focus-visible {
          outline: none;
        }
      `}</style>
    </div>
  );
}

function StatsCard({ title, value, icon, color }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {value}
          </h2>
        </div>

        <div className={`rounded-xl p-3 ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

function CompanyTable({ companies, getLogoUrl, onView, onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-sm">
        <thead className="bg-slate-50 dark:bg-slate-950">
          <tr>
            {[
              "Company",
              "GST / PAN",
              "Contact",
              "Location",
              "Status",
              "Actions",
            ].map((head) => (
              <th
                key={head}
                className="p-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-300"
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {companies.map((company) => (
            <tr
              key={company.id}
              className="border-t border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <td className="p-4">
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
                    <h3 className="truncate font-bold text-slate-900 dark:text-white">
                      {company.name || "-"}
                    </h3>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Currency: {company.currency || "INR"}
                    </p>
                  </div>
                </div>
              </td>

              <td className="p-4 font-medium text-slate-600 dark:text-slate-300">
                <p>GST: {company.gst_number || "-"}</p>
                <p>PAN: {company.pan_number || "-"}</p>
              </td>

              <td className="p-4 font-medium text-slate-600 dark:text-slate-300">
                <p>{company.email || "-"}</p>
                <p>{company.phone || "-"}</p>
              </td>

              <td className="p-4 font-medium text-slate-600 dark:text-slate-300">
                <p>{company.state || "-"}</p>
                <p>{company.country || "-"}</p>
              </td>

              <td className="p-4">
                <StatusBadge status={company.status} />
              </td>

              <td className="p-4">
                <div className="flex gap-2">
                  <IconButton
                    icon={<Eye size={16} />}
                    className="bg-blue-50 text-blue-700 hover:bg-blue-100"
                    onClick={() => onView(company)}
                  />
                  <IconButton
                    icon={<Pencil size={16} />}
                    className="bg-amber-50 text-amber-700 hover:bg-amber-100"
                    onClick={() => onEdit(company)}
                  />
                  <IconButton
                    icon={<Trash2 size={16} />}
                    className="bg-red-50 text-red-700 hover:bg-red-100"
                    onClick={() => onDelete(company.id)}
                  />
                </div>
              </td>
            </tr>
          ))}

          {companies.length === 0 && (
            <tr>
              <td colSpan="6" className="p-10 text-center">
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

function CompanyFormModal({ title, children, onClose }) {
  const isCreate = title?.toLowerCase().includes("create");

  return (
    <div className="fixed inset-0 z-[50000] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.45)] outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              {isCreate ? <Building2 size={22} /> : <Building2 size={22} />}
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {title}
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                Fill company information for invoicing and GST records.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-auto bg-white p-4 dark:bg-slate-900">
          {children}
        </div>
      </div>
    </div>
  );
}

function CompanyForm({
  formData,
  handleChange,
  handleSubmit,
  isCompanyAdmin,
  isKycApproved,
  editingId,
  onCancel,
  crmApiKey = "",
  setCrmApiKey,
  crmApiKeyConfigured = false,
}) {
  const updateField = (name, value) => {
    handleChange({
      target: {
        name,
        value,
      },
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-white dark:bg-slate-900"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field icon={<Building2 size={16} />} label="Company Name">
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            disabled={isCompanyAdmin && isKycApproved}
            className="input"
          />
        </Field>

        <Field icon={<BadgePercent size={16} />} label="GST Number">
          <input
            type="text"
            name="gst_number"
            value={formData.gst_number}
            onChange={handleChange}
            disabled={isCompanyAdmin && isKycApproved}
            className="input"
          />
        </Field>

        <Field icon={<Landmark size={16} />} label="PAN Number">
          <input
            type="text"
            name="pan_number"
            value={formData.pan_number}
            onChange={handleChange}
            disabled={isCompanyAdmin && isKycApproved}
            className="input"
          />
        </Field>

        <Field icon={<Wallet size={16} />} label="Currency">
          <CustomSelect
            value={formData.currency}
            onChange={(value) => updateField("currency", value)}
            options={[
              { value: "INR", label: "INR" },
              { value: "USD", label: "USD" },
            ]}
          />
        </Field>

        <Field icon={<Mail size={16} />} label="Email">
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="input"
          />
        </Field>

        <Field icon={<Phone size={16} />} label="Phone">
          <input
            type="text"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="input"
          />
        </Field>

        <Field icon={<Globe size={16} />} label="Website">
          <input
            type="text"
            name="website"
            value={formData.website}
            onChange={handleChange}
            className="input"
          />
        </Field>

        <Field icon={<MapPin size={16} />} label="State">
          <input
            type="text"
            name="state"
            value={formData.state}
            onChange={handleChange}
            className="input"
          />
        </Field>

        <Field icon={<MapPin size={16} />} label="Country">
          <input
            type="text"
            name="country"
            value={formData.country}
            onChange={handleChange}
            className="input"
          />
        </Field>

        <Field icon={<MapPin size={16} />} label="Zip Code">
          <input
            type="text"
            name="zip_code"
            value={formData.zip_code}
            onChange={handleChange}
            className="input"
          />
        </Field>

        {!isCompanyAdmin && (
          <Field label="Status">
            <CustomSelect
              value={formData.status}
              onChange={(value) => updateField("status", value)}
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
          </Field>
        )}

        {!isCompanyAdmin && editingId && (
          <Field icon={<KeyRound size={16} />} label="CRM API Key">
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

        <div className="md:col-span-2 xl:col-span-4">
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
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:ring-0"
        >
          {editingId || isCompanyAdmin ? (
            <Save size={17} />
          ) : (
            <Plus size={17} />
          )}
          {editingId || isCompanyAdmin ? "Save Changes" : "Create Company"}
        </button>
      </div>
    </form>
  );
}

function CustomSelect({ value, onChange, options, className = "" }) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const selected = options.find(
    (option) => String(option.value) === String(value),
  );

  const updateDropdownPosition = () => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownHeight = Math.min(options.length * 44 + 16, 220);
    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldOpenUp =
      spaceBelow < dropdownHeight + 12 && rect.top > dropdownHeight;

    setDropdownStyle({
      position: "fixed",
      left: rect.left,
      top: shouldOpenUp ? rect.top - dropdownHeight - 8 : rect.bottom + 8,
      width: rect.width,
      zIndex: 9999,
    });
  };

  useEffect(() => {
    if (!open) return;

    updateDropdownPosition();

    const handleClickOutside = (e) => {
      if (
        buttonRef.current?.contains(e.target) ||
        dropdownRef.current?.contains(e.target)
      ) {
        return;
      }

      setOpen(false);
    };

    window.addEventListener("scroll", updateDropdownPosition, true);
    window.addEventListener("resize", updateDropdownPosition);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("scroll", updateDropdownPosition, true);
      window.removeEventListener("resize", updateDropdownPosition);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, options.length]);

  const handleSelect = (selectedValue) => {
    onChange(selectedValue);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 shadow-sm outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:focus:ring-blue-950/50 ${className}`}
      >
        <span className="truncate">{selected?.label || "Select"}</span>
        <ChevronDown
          size={17}
          className={`shrink-0 text-slate-400 transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        >
          {options.map((option) => {
            const active = String(option.value) === String(value);

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                  active
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {option.label}
                {active && <CheckCircle2 size={16} />}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

function CompanyViewModal({ company, getLogoUrl, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.45)] outline-none ring-0 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              {company.logo ? (
                <img
                  src={getLogoUrl(company.logo)}
                  alt="Logo"
                  className="h-full w-full object-contain"
                />
              ) : (
                <Building2 size={28} />
              )}
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {company.name || "-"}
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                Complete company details
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-auto bg-white p-5 dark:bg-slate-900">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            <ViewField label="State" value={company.state} />
            <ViewField label="Country" value={company.country} />
            <ViewField label="Zip Code" value={company.zip_code} />
            <ViewField label="Address" value={company.address} full />
          </div>
        </div>
      </div>
    </div>
  );
}

function CompanyAdminView({
  formData,
  logoFile,
  setLogoFile,
  logoInputRef,
  logoUploading,
  handleLogoUpload,
  getLogoUrl,
  onEdit,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Saved Company Details
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            Click Update Setting to edit company information.
          </p>
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
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
                <Image size={28} className="text-slate-400" />
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
              onClick={handleLogoUpload}
              disabled={logoUploading}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:ring-0 disabled:opacity-60"
            >
              <Upload size={16} />
              {logoUploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ViewField label="Company Name" value={formData.name} />
        <ViewField label="GST Number" value={formData.gst_number} />
        <ViewField label="PAN Number" value={formData.pan_number} />
        <ViewField label="Currency" value={formData.currency} />
        <ViewField label="Email" value={formData.email} />
        <ViewField label="Phone" value={formData.phone} />
        <ViewField label="Website" value={formData.website} />
        <ViewField label="State" value={formData.state} />
        <ViewField label="Country" value={formData.country} />
        <ViewField label="Zip Code" value={formData.zip_code} />
        <ViewField label="Address" value={formData.address} full />
      </div>
    </div>
  );
}

function ViewField({ label, value, full }) {
  return (
    <div className={full ? "md:col-span-2 xl:col-span-4" : ""}>
      <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </p>
      <div className="min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {value || "-"}
      </div>
    </div>
  );
}

function Field({ label, icon, children }) {
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

function IconButton({ icon, className, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl p-2 shadow-sm transition-all duration-200 ${className}`}
    >
      {icon}
    </button>
  );
}

function StatusBadge({ status }) {
  const value = String(status || "inactive").toLowerCase();

  const styles = {
    active:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    inactive:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold capitalize shadow-sm ${
        styles[value] || styles.inactive
      }`}
    >
      {value}
    </span>
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
          <option value={5}>5 / page</option>
          <option value={10}>10 / page</option>
          <option value={20}>20 / page</option>
          <option value={50}>50 / page</option>
        </select>

        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((prev) => prev - 1)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Prev
        </button>

        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          Page {currentPage} of {totalPages}
        </span>

        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage((prev) => prev + 1)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default Company;
