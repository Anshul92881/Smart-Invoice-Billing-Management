import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import toast from "react-hot-toast";

import {
  Pencil,
  X,
  UserPlus,
  Mail,
  Lock,
  Users,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Building2,
  GitBranch,
  Save,
  Hash,
  Phone,
  BadgePercent,
  MapPin,
  Globe,
  Search,
  Filter,
  Eye,
  Plus,
  ChevronDown,
  EyeOff,
} from "lucide-react";

function Accountants() {
  const initialForm = {
    name: "",
    email: "",
    password: "",
    branch_id: "",
  };

  const initialBranchForm = {
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

  const [accountants, setAccountants] = useState([]);
  const [branches, setBranches] = useState([]);

  const [formData, setFormData] = useState(initialForm);
  const [branchForm, setBranchForm] = useState(initialBranchForm);

  const [editId, setEditId] = useState(null);
  const [viewAccountant, setViewAccountant] = useState(null);

  const [showFormModal, setShowFormModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");

  const [loading, setLoading] = useState(false);
  const [branchLoading, setBranchLoading] = useState(false);

  const isActiveBranch = (branch) =>
    branch.status === "active" || branch.status === 1 || branch.status === true;

  const formatBranchLabel = (item) => {
    if (!item?.branch_name) return "-";

    return item.branch_code
      ? `${item.branch_name} (${item.branch_code})`
      : item.branch_name;
  };

  const getDefaultBranchId = () => {
    const hqBranch = branches.find(
      (branch) => branch.is_main === 1 || branch.is_main === true,
    );

    return hqBranch?.id ? String(hqBranch.id) : "";
  };

  const fetchData = async () => {
    const [accountantResult, branchResult] = await Promise.allSettled([
      api.get("/users/accountants"),
      api.get("/branches"),
    ]);

    if (accountantResult.status === "fulfilled") {
      const accountantData = Array.isArray(accountantResult.value.data)
        ? accountantResult.value.data
        : accountantResult.value.data?.accountants || [];

      setAccountants(accountantData);
    } else {
      const error = accountantResult.reason;

      console.error(
        "Accountants API failed:",
        error.response?.status,
        error.response?.data,
      );

      toast.error(
        error.response?.data?.message || "Failed to fetch accountants",
      );
    }

    if (branchResult.status === "fulfilled") {
      const branchData = Array.isArray(branchResult.value.data)
        ? branchResult.value.data
        : branchResult.value.data?.branches || [];

      setBranches(branchData.filter(isActiveBranch));
    } else {
      const error = branchResult.reason;

      console.error(
        "Branches API failed:",
        error.response?.status,
        error.response?.data,
      );

      toast.error(error.response?.data?.message || "Failed to fetch branches");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const stats = useMemo(() => {
    const active = accountants.filter(
      (item) => (item.status || "active") === "active",
    ).length;

    return {
      total: accountants.length,
      active,
      inactive: accountants.length - active,
    };
  }, [accountants]);

  const filteredAccountants = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return accountants.filter((item) => {
      const status = item.status || "active";

      const matchesSearch =
        !keyword ||
        (item.name || "").toLowerCase().includes(keyword) ||
        (item.email || "").toLowerCase().includes(keyword) ||
        (item.role || "").toLowerCase().includes(keyword) ||
        (item.branch_name || "").toLowerCase().includes(keyword) ||
        (item.branch_code || "").toLowerCase().includes(keyword);

      const matchesStatus = statusFilter === "all" || status === statusFilter;

      const matchesBranch =
        branchFilter === "all" ||
        String(item.branch_id) === String(branchFilter);

      return matchesSearch && matchesStatus && matchesBranch;
    });
  }, [accountants, search, statusFilter, branchFilter]);

  const confirmToast = (message, onConfirm) => {
    toast(
      (t) => (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-900">{message}</p>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-700 hover:bg-slate-700"
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

    if (name === "branch_id" && value === "__add_branch__") {
      setShowBranchModal(true);
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleBranchChange = (e) => {
    setBranchForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const resetForm = () => {
    setFormData({
      ...initialForm,
      branch_id: getDefaultBranchId(),
    });
    setEditId(null);
  };

  const resetBranchForm = () => {
    setBranchForm(initialBranchForm);
  };

  const openCreateModal = () => {
    resetForm();
    setShowFormModal(true);
  };

  const openEditModal = (accountant) => {
    setEditId(accountant.id);
    setFormData({
      name: accountant.name || "",
      email: accountant.email || "",
      password: "",
      branch_id: accountant.branch_id ? String(accountant.branch_id) : "",
    });
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    resetForm();
    setShowFormModal(false);
  };

  const handleCreateBranch = async () => {
    if (!branchForm.branch_name.trim()) {
      toast.error("Branch name is required");
      return;
    }

    try {
      setBranchLoading(true);

      const payload = {
        ...branchForm,
        branch_name: branchForm.branch_name.trim(),
      };

      const res = await api.post("/branches", payload);
      const newBranch = res.data?.branch || res.data;

      const branchRes = await api.get("/branches");
      const updatedBranches = (branchRes.data || []).filter(isActiveBranch);

      setBranches(updatedBranches);

      const selectedBranch =
        newBranch?.id ||
        newBranch?.branch_id ||
        updatedBranches.find(
          (branch) =>
            branch.branch_name?.toLowerCase() ===
            payload.branch_name.toLowerCase(),
        )?.id;

      if (selectedBranch) {
        setFormData((prev) => ({
          ...prev,
          branch_id: String(selectedBranch),
        }));
      }

      resetBranchForm();
      setShowBranchModal(false);
      toast.success("Branch added successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Branch create failed");
    } finally {
      setBranchLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error("Name and email are required");
      return;
    }

    if (!formData.branch_id) {
      toast.error("Please select branch");
      return;
    }

    if (!editId && !formData.password) {
      toast.error("Password is required");
      return;
    }

    try {
      setLoading(true);

      if (editId) {
        await api.put(`/users/team/${editId}`, formData);
        toast.success("Accountant updated successfully");
      } else {
        await api.post("/users/accountant", formData);
        toast.success("Accountant created successfully");
      }

      closeFormModal();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save accountant");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = (accountant) => {
    const currentStatus = accountant.status || "active";
    const nextStatus = currentStatus === "inactive" ? "active" : "inactive";

    confirmToast(
      `${nextStatus === "active" ? "Activate" : "Deactivate"} this accountant?`,
      async () => {
        try {
          await api.patch(`/users/team/${accountant.id}/status`, {
            status: nextStatus,
          });

          toast.success(`Accountant ${nextStatus} successfully`);
          fetchData();
        } catch (error) {
          toast.error(error.response?.data?.message || "Status update failed");
        }
      },
    );
  };

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
              <Users size={17} />
              Finance Team Management
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Accountants
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Create, update and assign branch-wise finance users for your
              company.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex w-fit items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-0 active:ring-0"
          >
            <Plus size={17} />
            Add Accountant
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard
          title="Total Accountants"
          value={stats.total}
          icon={<Users size={20} />}
          color="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
          onClick={() => setStatusFilter("all")}
        />

        <SummaryCard
          title="Active Accountants"
          value={stats.active}
          icon={<CheckCircle2 size={20} />}
          color="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          onClick={() => setStatusFilter("active")}
        />

        <SummaryCard
          title="Inactive Accountants"
          value={stats.inactive}
          icon={<XCircle size={20} />}
          color="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          onClick={() => setStatusFilter("inactive")}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Accountant List
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Search, view and manage finance team status.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                />

                <input
                  type="text"
                  placeholder="Search accountant"
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

              <CustomDropdown
                value={branchFilter}
                onChange={setBranchFilter}
                icon={<GitBranch size={16} />}
                options={[
                  { value: "all", label: "All Branches" },
                  ...branches.map((branch) => ({
                    value: String(branch.id),
                    label: formatBranchLabel(branch),
                  })),
                ]}
              />
            </div>
          </div>
        </div>

        <AccountantTable
          accountants={filteredAccountants}
          onView={setViewAccountant}
          onEdit={openEditModal}
          onToggleStatus={handleToggleStatus}
          formatBranchLabel={formatBranchLabel}
        />
      </div>

      {showFormModal && (
        <FormModal
          title={editId ? "Update Accountant" : "Create Accountant"}
          description={
            editId
              ? "Update accountant details. Fill password only if you want to reset it."
              : "Select existing branch or create a new branch from same page."
          }
          icon={<ShieldCheck size={22} />}
          onClose={closeFormModal}
        >
          <AccountantForm
            formData={formData}
            branches={branches}
            editId={editId}
            formatBranchLabel={formatBranchLabel}
            loading={loading}
            handleChange={handleChange}
            handleSubmit={handleSubmit}
            onCancel={closeFormModal}
          />
        </FormModal>
      )}

      {viewAccountant && (
        <AccountantViewModal
          accountant={viewAccountant}
          formatBranchLabel={formatBranchLabel}
          onClose={() => setViewAccountant(null)}
        />
      )}

      {showBranchModal && (
        <FormModal
          title="Add New Branch"
          description="Create branch without leaving accountant page."
          icon={<GitBranch size={22} />}
          onClose={() => setShowBranchModal(false)}
        >
          <BranchMiniForm
            branchForm={branchForm}
            handleBranchChange={handleBranchChange}
            handleCreateBranch={handleCreateBranch}
            branchLoading={branchLoading}
            onCancel={() => setShowBranchModal(false)}
          />
        </FormModal>
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
      `}</style>
    </div>
  );
}

function AccountantTable({
  accountants,
  onView,
  onEdit,
  onToggleStatus,
  formatBranchLabel,
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[950px] text-sm">
        <thead className="bg-slate-50 text-slate-600 dark:text-slate-300 dark:bg-slate-950 dark:text-slate-300">
          <tr>
            {["User", "Branch", "Email", "Role", "Status", "Actions"].map(
              (head) => (
                <th
                  key={head}
                  className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                >
                  {head}
                </th>
              ),
            )}
          </tr>
        </thead>

        <tbody>
          {accountants.map((item) => {
            const isInactive = item.status === "inactive";

            return (
              <tr
                key={item.id}
                className="border-t border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                      <ShieldCheck size={19} />
                    </div>

                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {item.name || "-"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Finance team leader
                      </p>
                    </div>
                  </div>
                </td>

                <td className="p-4 text-center text-slate-600 dark:text-slate-300">
                  {formatBranchLabel(item)}
                </td>

                <td className="p-4 text-center text-slate-600 dark:text-slate-300">
                  {item.email || "-"}
                </td>

                <td className="p-4 text-center text-slate-600 dark:text-slate-300">
                  <span className="capitalize">
                    {(item.role || "accountant").replaceAll("_", " ")}
                  </span>
                </td>

                <td className="p-4 text-center">
                  <StatusBadge status={item.status} />
                </td>

                <td className="p-4 text-center">
                  <div className="flex items-center gap-2">
                    <IconButton
                      icon={<Eye size={16} />}
                      className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 hover:bg-blue-100"
                      onClick={() => onView(item)}
                    />

                    <IconButton
                      icon={<Pencil size={16} />}
                      className="bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950"
                      onClick={() => onEdit(item)}
                    />

                    <button
                      type="button"
                      onClick={() => onToggleStatus(item)}
                      className={`flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm transition ${
                        isInactive
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950"
                          : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950"
                      }`}
                    >
                      {isInactive ? (
                        <CheckCircle2 size={15} />
                      ) : (
                        <XCircle size={15} />
                      )}
                      {isInactive ? "Activate" : "Deactivate"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}

          {accountants.length === 0 && (
            <tr>
              <td colSpan="6" className="p-10 text-center">
                <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-950">
                  <Users className="mx-auto text-slate-400" size={34} />
                  <p className="mt-3 font-semibold text-slate-700">
                    No accountants found
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Try changing search, status or branch filter.
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

function AccountantForm({
  formData,
  branches,
  editId,
  formatBranchLabel,
  loading,
  handleChange,
  handleSubmit,
  onCancel,
}) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field icon={<Building2 size={16} />} label="Branch">
          <BranchSelect
            branches={branches}
            value={formData.branch_id}
            formatBranchLabel={formatBranchLabel}
            onChange={(value) =>
              handleChange({
                target: {
                  name: "branch_id",
                  value,
                },
              })
            }
          />
        </Field>

        <Input
          icon={<Users size={16} />}
          label="Accountant Name"
          type="text"
          name="name"
          placeholder="Enter accountant name"
          value={formData.name}
          onChange={handleChange}
        />

        <Input
          icon={<Mail size={16} />}
          label="Accountant Email"
          type="email"
          name="email"
          placeholder="Enter accountant email"
          value={formData.email}
          onChange={handleChange}
        />

        <Field
          icon={<Lock size={16} />}
          label={editId ? "New Password Optional" : "Password"}
        >
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder={
                editId ? "Leave blank to keep old password" : "Create password"
              }
              value={formData.password || ""}
              onChange={handleChange}
              autoComplete="new-password"
              className="input !pr-12"
            />

            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition hover:text-blue-600 dark:text-slate-500 dark:hover:text-blue-400"
              title={showPassword ? "Hide Password" : "Show Password"}
              aria-label={showPassword ? "Hide Password" : "Show Password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </Field>
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
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-0 active:ring-0 disabled:bg-blue-400"
        >
          <UserPlus size={16} />
          {loading
            ? "Saving..."
            : editId
              ? "Save Changes"
              : "Create Accountant"}
        </button>
      </div>
    </form>
  );
}

function BranchMiniForm({
  branchForm,
  handleBranchChange,
  handleCreateBranch,
  branchLoading,
  onCancel,
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ModalInput
          icon={<Building2 size={16} />}
          label="Branch Name"
          name="branch_name"
          value={branchForm.branch_name}
          onChange={handleBranchChange}
          required
        />

        <ModalInput
          icon={<Hash size={16} />}
          label="Branch Code"
          name="branch_code"
          value={branchForm.branch_code}
          onChange={handleBranchChange}
        />

        <ModalInput
          icon={<Mail size={16} />}
          label="Email"
          name="email"
          type="email"
          value={branchForm.email}
          onChange={handleBranchChange}
        />

        <ModalInput
          icon={<Phone size={16} />}
          label="Phone"
          name="phone"
          value={branchForm.phone}
          onChange={handleBranchChange}
        />

        <ModalInput
          icon={<BadgePercent size={16} />}
          label="GST Number"
          name="gst_number"
          value={branchForm.gst_number}
          onChange={handleBranchChange}
        />

        <ModalInput
          icon={<MapPin size={16} />}
          label="City"
          name="city"
          value={branchForm.city}
          onChange={handleBranchChange}
        />

        <ModalInput
          icon={<MapPin size={16} />}
          label="State"
          name="state"
          value={branchForm.state}
          onChange={handleBranchChange}
        />

        <ModalInput
          icon={<Globe size={16} />}
          label="Country"
          name="country"
          value={branchForm.country}
          onChange={handleBranchChange}
        />

        <ModalInput
          icon={<Hash size={16} />}
          label="ZIP Code"
          name="zip_code"
          value={branchForm.zip_code}
          onChange={handleBranchChange}
        />

        <Field icon={<CheckCircle2 size={16} />} label="Status">
          <CustomDropdown
            value={branchForm.status}
            onChange={(value) =>
              handleBranchChange({
                target: {
                  name: "status",
                  value,
                },
              })
            }
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
        </Field>

        <div className="md:col-span-2 xl:col-span-3">
          <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <MapPin size={16} />
            Address
          </label>

          <textarea
            name="address"
            value={branchForm.address}
            onChange={handleBranchChange}
            rows="3"
            className="input"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          <X size={16} />
          Cancel
        </button>

        <button
          type="button"
          onClick={handleCreateBranch}
          disabled={branchLoading}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-0 active:ring-0 disabled:bg-blue-400"
        >
          <Save size={16} />
          {branchLoading ? "Saving..." : "Save Branch"}
        </button>
      </div>
    </>
  );
}

function AccountantViewModal({ accountant, formatBranchLabel, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              <ShieldCheck size={28} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white dark:text-white">
                {accountant.name || "-"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Accountant profile details
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
            <ViewField label="Name" value={accountant.name} />
            <ViewField label="Email" value={accountant.email} />
            <ViewField
              label="Role"
              value={(accountant.role || "accountant")
                .replaceAll("_", " ")
                .replace(/\b\w/g, (char) => char.toUpperCase())}
            />
            <ViewField
              label="Status"
              value={<StatusBadge status={accountant.status} />}
            />
            <ViewField label="Branch" value={formatBranchLabel(accountant)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function FormModal({ title, description, icon, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl outline-none ring-0 focus:outline-none focus:ring-0 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              {icon}
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white dark:text-white">
                {title}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{description}</p>
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

function SummaryCard({ title, value, icon, color, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm dark:border-slate-800 dark:bg-slate-900 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
    >
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
    </button>
  );
}

function ViewField({ label, value, full }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </p>
      <div className="min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
        {value || "-"}
      </div>
    </div>
  );
}

function ModalInput({
  icon,
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
}) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {icon}
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className="input"
      />
    </div>
  );
}

function Input({ icon, label, type, name, placeholder, value, onChange }) {
  return (
    <Field icon={icon} label={label}>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="input"
      />
    </Field>
  );
}

function Field({ icon, label, children }) {
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

function CustomDropdown({ value, onChange, options, icon }) {
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
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 transition hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon && <span className="text-slate-400">{icon}</span>}
          <span className="truncate">{selected?.label || "Select"}</span>
        </span>

        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-500 dark:text-slate-400 transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-[9999] w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800 dark:hover:text-blue-300 ${
                String(value) === String(option.value)
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                  : "text-slate-700 dark:text-slate-200"
              }`}
            >
              {option.label}
              {String(value) === String(option.value) && (
                <CheckCircle2 size={16} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BranchSelect({ branches, value, onChange, formatBranchLabel }) {
  const [open, setOpen] = useState(false);
  const [branchSearch, setBranchSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState({});

  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const selectedBranch = branches.find(
    (branch) => String(branch.id) === String(value),
  );

  const filteredBranches = branches.filter((branch) =>
    `${branch.branch_name || ""} ${branch.branch_code || ""} ${branch.email || ""}`
      .toLowerCase()
      .includes(branchSearch.toLowerCase()),
  );

  const updateDropdownPosition = () => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = 330;
    const shouldOpenUp =
      spaceBelow < dropdownHeight && rect.top > dropdownHeight;

    setDropdownStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      top: shouldOpenUp ? rect.top - dropdownHeight - 8 : rect.bottom + 8,
      maxHeight: dropdownHeight,
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
      setBranchSearch("");
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
    onChange(selectedValue);
    setOpen(false);
    setBranchSearch("");
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 shadow-sm outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      >
        <span className="min-w-0 truncate">
          {selectedBranch ? formatBranchLabel(selectedBranch) : "Select Branch"}
        </span>

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
                value={branchSearch}
                onChange={(e) => setBranchSearch(e.target.value)}
                placeholder="Search branch..."
                autoFocus
                className="w-full rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 py-2 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:bg-slate-900 dark:focus:ring-blue-950/50"
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto p-2">
            {filteredBranches.map((branch) => (
              <button
                key={branch.id}
                type="button"
                onClick={() => handleSelect(String(branch.id))}
                className={`w-full rounded-xl px-3 py-2 text-left transition hover:bg-blue-50 dark:hover:bg-slate-800 ${
                  String(value) === String(branch.id)
                    ? "bg-blue-50 dark:bg-blue-950/40"
                    : ""
                }`}
              >
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {formatBranchLabel(branch)}
                </p>

                <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                  {branch.is_main === 1 || branch.is_main === true
                    ? "HQ Branch"
                    : "Company branch"}
                </p>
              </button>
            ))}

            {filteredBranches.length === 0 && (
              <div className="px-3 py-4 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                No branch found
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 p-2 dark:border-slate-800">
            <button
              type="button"
              onClick={() => handleSelect("__add_branch__")}
              className="flex w-full items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
            >
              <Plus size={16} />
              Add New Branch
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function IconButton({ icon, className, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg p-2 ${className}`}
    >
      {icon}
    </button>
  );
}

function StatusBadge({ status }) {
  const value = String(status || "active").toLowerCase();

  const styles = {
    active:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    inactive:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
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

export default Accountants;
