import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import toast from "react-hot-toast";

import {
  Truck,
  Plus,
  Save,
  X,
  Pencil,
  Trash2,
  Mail,
  Phone,
  BadgePercent,
  Wallet,
  MapPin,
  Building2,
  Eye,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  ChevronDown,
} from "lucide-react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;
const GST_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const NAME_REGEX = /^[a-zA-Z0-9\s.&'(),-]+$/;

const cleanString = (value) =>
  String(value || "")
    .replace(/<[^>]*>?/gm, "")
    .trim();

const normalizeEmail = (email) => cleanString(email).toLowerCase();
const normalizeUpper = (value) => cleanString(value).toUpperCase();

const toNumber = (value, fallback = 0) => {
  if (value === "" || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
};

const getList = (data, key) => {
  if (Array.isArray(data)) return data;
  return data?.[key] || [];
};

function Vendors() {
  const user = JSON.parse(localStorage.getItem("user"));
  const canDelete = user?.role === "company_admin";

  const initialForm = {
    vendor_name: "",
    company_name: "",
    email: "",
    phone: "",
    gstin: "",
    billing_address: "",
    opening_balance: "",
    notes: "",
    status: "active",
  };

  const [vendors, setVendors] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [editingId, setEditingId] = useState(null);

  const [showFormModal, setShowFormModal] = useState(false);
  const [viewVendor, setViewVendor] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [saving, setSaving] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const canManageVendors =
    user?.role === "company_admin" || Boolean(user?.permissions?.vendors);

  const fetchVendors = async () => {
    try {
      const res = await api.get("/vendors", {
        params: {
          search: search.trim() || undefined,
          status: statusFilter,
          limit: 1000,
        },
      });

      setVendors(getList(res.data, "vendors"));
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch vendors");
      setVendors([]);
    }
  };

  useEffect(() => {
    fetchVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const stats = useMemo(() => {
    const list = Array.isArray(vendors) ? vendors : [];

    const active = list.filter(
      (vendor) => (vendor.status || "active") === "active",
    ).length;

    const gstRegistered = list.filter((vendor) => vendor.gstin).length;

    return {
      total: list.length,
      active,
      inactive: list.length - active,
      gstRegistered,
    };
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    const list = Array.isArray(vendors) ? vendors : [];

    return list.filter((vendor) => {
      const status = vendor.status || "active";

      const matchesSearch =
        !keyword ||
        vendor.vendor_name?.toLowerCase().includes(keyword) ||
        vendor.company_name?.toLowerCase().includes(keyword) ||
        vendor.email?.toLowerCase().includes(keyword) ||
        vendor.phone?.toLowerCase().includes(keyword) ||
        vendor.gstin?.toLowerCase().includes(keyword) ||
        vendor.billing_address?.toLowerCase().includes(keyword);

      const matchesStatus = statusFilter === "all" || status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [vendors, search, statusFilter]);

  const sortedVendors = useMemo(() => {
    return [...filteredVendors].sort((a, b) => Number(b.id) - Number(a.id));
  }, [filteredVendors]);

  const totalPages = Math.ceil(sortedVendors.length / itemsPerPage);

  const paginatedVendors = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedVendors.slice(start, start + itemsPerPage);
  }, [sortedVendors, currentPage, itemsPerPage]);

  const validateForm = () => {
    const nextErrors = {};

    const vendorName = cleanString(formData.vendor_name);
    const companyName = cleanString(formData.company_name);
    const email = normalizeEmail(formData.email);
    const phone = cleanString(formData.phone);
    const gstin = normalizeUpper(formData.gstin);
    const billingAddress = cleanString(formData.billing_address);
    const openingBalance = toNumber(formData.opening_balance);
    const notes = cleanString(formData.notes);
    const status = cleanString(formData.status).toLowerCase();

    if (!vendorName) {
      nextErrors.vendor_name = "Vendor name is required";
    } else if (vendorName.length < 2 || vendorName.length > 100) {
      nextErrors.vendor_name =
        "Vendor name must be between 2 and 100 characters";
    } else if (!NAME_REGEX.test(vendorName)) {
      nextErrors.vendor_name = "Vendor name contains invalid characters";
    }

    if (companyName && companyName.length > 100) {
      nextErrors.company_name = "Company name must be less than 100 characters";
    } else if (companyName && !NAME_REGEX.test(companyName)) {
      nextErrors.company_name = "Company name contains invalid characters";
    }

    if (email && !EMAIL_REGEX.test(email)) {
      nextErrors.email = "Invalid vendor email format";
    }

    if (phone && !PHONE_REGEX.test(phone)) {
      nextErrors.phone = "Phone must be a valid 10 digit Indian mobile number";
    }

    if (gstin && !GST_REGEX.test(gstin)) {
      nextErrors.gstin = "Invalid GST number format";
    }

    if (billingAddress && billingAddress.length > 500) {
      nextErrors.billing_address =
        "Billing address must be less than 500 characters";
    }

    if (Number.isNaN(openingBalance)) {
      nextErrors.opening_balance = "Opening balance must be a valid number";
    } else if (openingBalance < 0) {
      nextErrors.opening_balance = "Opening balance cannot be negative";
    }

    if (notes && notes.length > 500) {
      nextErrors.notes = "Notes must be less than 500 characters";
    }

    if (!["active", "inactive"].includes(status)) {
      nextErrors.status = "Status must be active or inactive";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

    const confirmToast = (message, onConfirm) => {
    toast(
      (t) => (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {message}
          </p>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              No
            </button>

            <button
              type="button"
              onClick={() => {
                toast.dismiss(t.id);
                onConfirm();
              }}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Yes
            </button>
          </div>
        </div>
      ),
      { duration: 6000 },
    );
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    let nextValue = value;

    if (name === "gstin") {
      nextValue = normalizeUpper(value);
    }

    if (name === "email") {
      nextValue = normalizeEmail(value);
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
    setEditingId(null);
    setFormData(initialForm);
    setErrors({});
  };

  const openCreateModal = () => {
    if (!canManageVendors) {
      toast.error("Vendor permission required");
      return;
    }

    resetForm();
    setShowFormModal(true);
  };

  const openEditModal = (vendor) => {
    if (!canManageVendors) {
      toast.error("Vendor permission required");
      return;
    }

    setEditingId(vendor.id);
    setErrors({});

    setFormData({
      vendor_name: vendor.vendor_name || "",
      company_name: vendor.company_name || "",
      email: vendor.email || "",
      phone: vendor.phone || "",
      gstin: vendor.gstin || "",
      billing_address: vendor.billing_address || "",
      opening_balance:
        vendor.opening_balance === null || vendor.opening_balance === undefined
          ? ""
          : String(vendor.opening_balance),
      notes: vendor.notes || "",
      status: vendor.status || "active",
    });

    setShowFormModal(true);
  };

  const closeFormModal = () => {
    resetForm();
    setShowFormModal(false);
  };

  const buildPayload = () => ({
    vendor_name: cleanString(formData.vendor_name),
    company_name: cleanString(formData.company_name),
    email: normalizeEmail(formData.email),
    phone: cleanString(formData.phone),
    gstin: normalizeUpper(formData.gstin),
    billing_address: cleanString(formData.billing_address),
    opening_balance:
      formData.opening_balance === "" ? 0 : Number(formData.opening_balance),
    notes: cleanString(formData.notes),
    status: cleanString(formData.status).toLowerCase() || "active",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canManageVendors) {
      toast.error("Vendor permission required");
      return;
    }

    if (!validateForm()) return;

    try {
      setSaving(true);

      const payload = buildPayload();

      if (editingId) {
        await api.put(`/vendors/${editingId}`, payload);
        toast.success("Vendor updated successfully");
      } else {
        await api.post("/vendors", payload);
        toast.success("Vendor created successfully");
      }

      closeFormModal();
      fetchVendors();
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (vendor) => {
    if (!canDelete) {
      toast.error("Only Company Admin can deactivate vendor");
      return;
    }

    if ((vendor.status || "active") === "inactive") {
      toast.error("Vendor already inactive");
      return;
    }

    confirmToast("Deactivate this vendor?", async () => {
      try {
        await api.delete(`/vendors/${vendor.id}`);
        toast.success("Vendor deactivated");
        fetchVendors();
      } catch (error) {
        toast.error(error.response?.data?.message || "Deactivate failed");
      }
    });
  };

  return (
    <div className="w-full min-w-0 space-y-5 overflow-x-hidden">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
              <Truck size={17} />
              Vendor Management
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Vendors
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Manage suppliers, service providers and vendor GST details.
            </p>
          </div>

          {canManageVendors && (
            <button
              type="button"
              onClick={openCreateModal}
              className="flex w-fit items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus size={17} />
              Add Vendor
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatsCard
          title="Total Vendors"
          value={stats.total}
          icon={<Truck size={20} />}
          color="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
        />

        <StatsCard
          title="Active Vendors"
          value={stats.active}
          icon={<CheckCircle2 size={20} />}
          color="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
        />

        <StatsCard
          title="Inactive Vendors"
          value={stats.inactive}
          icon={<XCircle size={20} />}
          color="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        />

        <StatsCard
          title="GST Registered"
          value={stats.gstRegistered}
          icon={<BadgePercent size={20} />}
          color="bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Vendor List
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Search, filter, view and manage vendors.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  placeholder="Search vendor"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input !pl-10"
                />
              </div>

              <CustomDropdown
                value={statusFilter}
                onChange={setStatusFilter}
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

        <VendorTable
          vendors={paginatedVendors}
          canManageVendors={canManageVendors}
          canDelete={canDelete}
          onView={setViewVendor}
          onEdit={openEditModal}
          onDelete={handleDelete}
        />

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Rows per page
            </span>

            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-blue-950/50"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="text-sm text-slate-500 dark:text-slate-400">
            Showing{" "}
            {sortedVendors.length === 0
              ? 0
              : (currentPage - 1) * itemsPerPage + 1}
            {" - "}
            {Math.min(currentPage * itemsPerPage, sortedVendors.length)}
            {" of "}
            {sortedVendors.length}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => prev - 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Prev
            </button>

            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {currentPage} / {totalPages || 1}
            </span>

            <button
              type="button"
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage((prev) => prev + 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showFormModal && (
        <FormModal
          title={editingId ? "Update Vendor" : "Create Vendor"}
          description="Add vendor details for expenses, purchases and reports."
          icon={<Truck size={21} />}
          onClose={closeFormModal}
        >
          <VendorForm
            formData={formData}
            errors={errors}
            editingId={editingId}
            saving={saving}
            handleChange={handleChange}
            handleSubmit={handleSubmit}
            onCancel={closeFormModal}
          />
        </FormModal>
      )}

      {viewVendor && (
        <VendorViewModal
          vendor={viewVendor}
          onClose={() => setViewVendor(null)}
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

        .input-error {
          border-color: #f87171 !important;
        }

        .input-error:focus {
          border-color: #ef4444 !important;
          box-shadow: 0 0 0 3px #fee2e2 !important;
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

        .dark .input-error {
          border-color: #f87171 !important;
        }
      `}</style>
    </div>
  );
}

function VendorTable({
  vendors,
  canManageVendors,
  canDelete,
  onView,
  onEdit,
  onDelete,
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[1000px] text-sm">
        <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
          <tr>
            {[
              "Vendor",
              "GST / Balance",
              "Contact",
              "Address",
              "Status",
              "Actions",
            ].map((head) => (
              <th
                key={head}
                className="p-4 text-center text-xs font-semibold uppercase tracking-wide"
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {vendors.map((vendor) => (
            <tr
              key={vendor.id}
              className="border-t border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <td className="p-4 text-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                    <Truck size={19} />
                  </div>

                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-slate-900 dark:text-white">
                      {vendor.vendor_name || "-"}
                    </h3>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {vendor.company_name || "No company name"}
                    </p>
                  </div>
                </div>
              </td>

              <td className="p-4 text-center text-slate-600 dark:text-slate-300">
                <p>GSTIN: {vendor.gstin || "-"}</p>
                <p className="font-semibold text-slate-900 dark:text-white">
                  Opening: ₹ {Number(vendor.opening_balance || 0).toFixed(2)}
                </p>
              </td>

              <td className="p-4 text-center text-slate-600 dark:text-slate-300">
                <p>{vendor.email || "-"}</p>
                <p>{vendor.phone || "-"}</p>
              </td>

              <td className="max-w-xs p-4 text-center text-slate-600 dark:text-slate-300">
                <p className="truncate">{vendor.billing_address || "-"}</p>
              </td>

              <td className="p-4 text-center">
                <StatusBadge status={vendor.status} />
              </td>

              <td className="p-4 text-center">
                <div className="flex gap-2">
                  <IconButton
                    icon={<Eye size={16} />}
                    className="bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
                    onClick={() => onView(vendor)}
                  />

                  {canManageVendors && (
                    <IconButton
                      icon={<Pencil size={16} />}
                      className="bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950"
                      onClick={() => onEdit(vendor)}
                    />
                  )}

                  {canDelete && vendor.status !== "inactive" && (
                    <IconButton
                      icon={<Trash2 size={16} />}
                      className="bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950"
                      onClick={() => onDelete(vendor)}
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}

          {vendors.length === 0 && (
            <tr>
              <td colSpan="6" className="p-10 text-center">
                <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-950">
                  <Truck className="mx-auto text-slate-400" size={34} />
                  <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                    No vendors found
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Try changing search or filters.
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

function VendorForm({
  formData,
  errors,
  editingId,
  saving,
  handleChange,
  handleSubmit,
  onCancel,
}) {
  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          icon={<Truck size={16} />}
          label="Vendor Name"
          name="vendor_name"
          value={formData.vendor_name}
          onChange={handleChange}
          error={errors.vendor_name}
          required
        />

        <Input
          icon={<Building2 size={16} />}
          label="Company Name"
          name="company_name"
          value={formData.company_name}
          onChange={handleChange}
          error={errors.company_name}
        />

        <Input
          icon={<Mail size={16} />}
          label="Email"
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          error={errors.email}
        />

        <Input
          icon={<Phone size={16} />}
          label="Phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          error={errors.phone}
        />

        <Input
          icon={<BadgePercent size={16} />}
          label="GSTIN / Tax ID"
          name="gstin"
          value={formData.gstin}
          onChange={handleChange}
          error={errors.gstin}
        />

        <Input
          icon={<Wallet size={16} />}
          label="Opening Balance"
          type="number"
          name="opening_balance"
          value={formData.opening_balance}
          onChange={handleChange}
          error={errors.opening_balance}
        />

        <Field
          icon={<CheckCircle2 size={16} />}
          label="Status"
          error={errors.status}
        >
          <CustomDropdown
            value={formData.status}
            onChange={(value) =>
              handleChange({
                target: {
                  name: "status",
                  value,
                },
              })
            }
            icon={<CheckCircle2 size={16} />}
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
        </Field>

        <div className="md:col-span-2">
          <Field
            icon={<MapPin size={16} />}
            label="Billing Address"
            error={errors.billing_address}
          >
            <textarea
              name="billing_address"
              value={formData.billing_address}
              onChange={handleChange}
              rows="3"
              className={`input ${errors.billing_address ? "input-error" : ""}`}
            />
          </Field>
        </div>

        <div className="md:col-span-2">
          <Field label="Notes" error={errors.notes}>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
              className={`input ${errors.notes ? "input-error" : ""}`}
            />
          </Field>
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
          disabled={saving}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          {editingId ? <Save size={16} /> : <Plus size={16} />}
          {saving
            ? "Saving..."
            : editingId
              ? "Update Vendor"
              : "Create Vendor"}
        </button>
      </div>
    </form>
  );
}

function VendorViewModal({ vendor, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex shrink-0 items-start justify-between border-b border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              <Truck size={28} />
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold text-slate-900 dark:text-white">
                {vendor.vendor_name || "-"}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Vendor profile details
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ViewField label="Vendor Name" value={vendor.vendor_name} />
            <ViewField label="Company Name" value={vendor.company_name} />
            <ViewField label="Email" value={vendor.email} />
            <ViewField label="Phone" value={vendor.phone} />
            <ViewField label="GSTIN / Tax ID" value={vendor.gstin} />
            <ViewField
              label="Opening Balance"
              value={`₹ ${Number(vendor.opening_balance || 0).toFixed(2)}`}
            />
            <ViewField
              label="Status"
              value={<StatusBadge status={vendor.status} />}
            />
            <ViewField
              label="Billing Address"
              value={vendor.billing_address}
              full
            />
            <ViewField label="Notes" value={vendor.notes} full />
          </div>
        </div>
      </div>
    </div>
  );
}

function FormModal({ title, description, icon, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              {icon}
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {title}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {description}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-auto bg-white p-5 dark:bg-slate-900">
          {children}
        </div>
      </div>
    </div>
  );
}

function StatsCard({ title, value, icon, color }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
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

function CustomDropdown({ value, onChange, options, icon }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selected = options.find(
    (option) => String(option.value) === String(value),
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={dropdownRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:focus:ring-blue-950/50"
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon && (
            <span className="shrink-0 text-slate-400 dark:text-slate-500">
              {icon}
            </span>
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

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-[9999] max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
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
                className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800 dark:hover:text-blue-300 ${
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

function Input({
  icon,
  label,
  name,
  value,
  onChange,
  type = "text",
  error,
  required = false,
}) {
  return (
    <Field icon={icon} label={label} error={error} required={required}>
      <input
        type={type}
        name={name}
        value={value || ""}
        onChange={onChange}
        className={`input ${error ? "input-error" : ""}`}
      />
    </Field>
  );
}

function Field({ label, icon, children, error, required = false }) {
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

function ViewField({ label, value, full }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </p>
      <div className="min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {value || "-"}
      </div>
    </div>
  );
}

function IconButton({ icon, className, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg p-2 transition ${className}`}
    >
      {icon}
    </button>
  );
}

function StatusBadge({ status }) {
  const value = status || "active";

  const styles = {
    active:
      "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50",
    inactive:
      "bg-red-50 text-red-700 border border-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        styles[value] || styles.active
      }`}
    >
      {value}
    </span>
  );
}

export default Vendors;