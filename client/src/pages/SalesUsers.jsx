import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import toast from "react-hot-toast";
import { createPortal } from "react-dom";

import {
  Pencil,
  X,
  Users,
  UserPlus,
  Mail,
  Lock,
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
  Eye,
  EyeOff,
  Plus,
  Search,
  Filter,
  ChevronDown,
} from "lucide-react";

function SalesUsers() {
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

  const [salesUsers, setSalesUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [branchForm, setBranchForm] = useState(initialBranchForm);

  const [editId, setEditId] = useState(null);
  const [viewUser, setViewUser] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [branchLoading, setBranchLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");

  const [cardFilter, setCardFilter] = useState("all");

  const stats = {
    total: salesUsers.length,
    active: salesUsers.filter((u) => (u.status || "active") === "active")
      .length,
    inactive: salesUsers.filter((u) => (u.status || "active") !== "active")
      .length,
  };

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
    try {
      const [salesResult, branchResult] = await Promise.allSettled([
        api.get("/users/sales-users"),
        api.get("/branches"),
      ]);

      if (salesResult.status === "fulfilled") {
        const salesData = Array.isArray(salesResult.value.data)
          ? salesResult.value.data
          : salesResult.value.data?.salesUsers || [];

        setSalesUsers(salesData);
      } else {
        const salesError = salesResult.reason;

        console.error(
          "Sales users API failed:",
          salesError.response?.status,
          salesError.response?.data,
        );

        toast.error(
          salesError.response?.data?.message || "Failed to fetch sales users",
        );
      }

      if (branchResult.status === "fulfilled") {
        const branchData = Array.isArray(branchResult.value.data)
          ? branchResult.value.data
          : branchResult.value.data?.branches || [];

        setBranches(branchData.filter(isActiveBranch));
      } else {
        const branchError = branchResult.reason;

        console.error(
          "Branches API failed:",
          branchError.response?.status,
          branchError.response?.data,
        );

        toast.error(
          branchError.response?.data?.message || "Failed to fetch branches",
        );
      }
    } catch (error) {
      console.error("Sales users page fetch error:", error);

      toast.error(
        error.response?.data?.message || "Failed to load sales users page",
      );
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const matchesCard =
    cardFilter === "all" ||
    (cardFilter === "active" && status === "active") ||
    (cardFilter === "inactive" && status !== "active");

  const filteredSalesUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return salesUsers.filter((item) => {
      const status = item.status || "active";

      const matchesSearch =
        !keyword ||
        (item.name || "").toLowerCase().includes(keyword) ||
        (item.email || "").toLowerCase().includes(keyword) ||
        (item.branch_name || "").toLowerCase().includes(keyword) ||
        (item.branch_code || "").toLowerCase().includes(keyword) ||
        (item.role || "").toLowerCase().includes(keyword);

      const matchesStatus = statusFilter === "all" || status === statusFilter;

      const matchesBranch =
        branchFilter === "all" ||
        String(item.branch_id || "") === String(branchFilter);

      const matchesCard =
        cardFilter === "all" ||
        (cardFilter === "active" && status === "active") ||
        (cardFilter === "inactive" && status !== "active") ||
        (cardFilter === "assigned" && Boolean(item.branch_id));

      return matchesSearch && matchesStatus && matchesBranch && matchesCard;
    });
  }, [salesUsers, search, statusFilter, branchFilter, cardFilter]);

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
              className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
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
    setBranchForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
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

  const openEditModal = (salesUser) => {
    setEditId(salesUser.id);
    setFormData({
      name: salesUser.name || "",
      email: salesUser.email || "",
      password: "",
      branch_id: salesUser.branch_id ? String(salesUser.branch_id) : "",
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

    if (!formData.branch_id) {
      toast.error("Please select branch");
      return;
    }

    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error("Name and email are required");
      return;
    }

    if (!editId && !formData.password) {
      toast.error("Password is required");
      return;
    }

    try {
      if (editId) {
        await api.put(`/users/team/${editId}`, formData);
        toast.success("Sales user updated successfully");
      } else {
        await api.post("/users/sales-user", formData);
        toast.success("Sales user created successfully");
      }

      closeFormModal();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save sales user");
    }
  };

  const handleToggleStatus = (salesUser) => {
    const currentStatus = String(salesUser.status || "active").toLowerCase();
    const nextStatus = currentStatus === "inactive" ? "active" : "inactive";

    confirmToast(
      `${nextStatus === "active" ? "Activate" : "Deactivate"} this sales user?`,
      async () => {
        try {
          await api.patch(`/users/team/${salesUser.id}/status`, {
            status: nextStatus,
          });

          toast.success(`Sales user ${nextStatus} successfully`);
          fetchData();
        } catch (error) {
          toast.error(error.response?.data?.message || "Status update failed");
        }
      },
    );
  };

  return (
    <div className="w-full min-w-0 space-y-5 overflow-x-hidden">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
              <Users size={17} />
              Sales Team Management
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Sales Users
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Create, update and assign branch-wise sales users for quotations,
              customers and limited sales work.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex w-fit items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:ring-0"
          >
            <Plus size={17} />
            Create Sales User
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatsCard
          title="Total Users"
          value={stats.total}
          icon={<Users size={20} />}
          color="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
          onClick={() => {
            setCardFilter("all");
            setStatusFilter("all");
            setBranchFilter("all");
          }}
        />

        <StatsCard
          title="Active Users"
          value={stats.active}
          icon={<CheckCircle2 size={20} />}
          color="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          onClick={() => {
            setCardFilter("active");
            setStatusFilter("all");
            setBranchFilter("all");
          }}
        />

        <StatsCard
          title="Inactive Users"
          value={stats.inactive}
          icon={<XCircle size={20} />}
          color="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          onClick={() => {
            setCardFilter("inactive");
            setStatusFilter("all");
            setBranchFilter("all");
          }}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Sales User List
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Search, filter, view and manage sales users.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Search user"
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
                icon={<Building2 size={16} />}
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

        <SalesUserTable
          salesUsers={filteredSalesUsers}
          onView={setViewUser}
          onEdit={openEditModal}
          onToggleStatus={handleToggleStatus}
          formatBranchLabel={formatBranchLabel}
        />
      </div>

      {showFormModal && (
        <FormModal
          title={editId ? "Update Sales User" : "Create Sales User"}
          description={
            editId
              ? "Update branch/name/email. Fill password only if you want to reset it."
              : "Select existing branch or create a new branch from same page."
          }
          icon={<Users size={21} />}
          onClose={closeFormModal}
        >
          <SalesUserForm
            formData={formData}
            branches={branches}
            editId={editId}
            formatBranchLabel={formatBranchLabel}
            handleChange={handleChange}
            handleSubmit={handleSubmit}
            onCancel={closeFormModal}
          />
        </FormModal>
      )}

      {viewUser && (
        <SalesUserViewModal
          user={viewUser}
          formatBranchLabel={formatBranchLabel}
          onClose={() => setViewUser(null)}
        />
      )}

      {showBranchModal && (
        <FormModal
          title="Add New Branch"
          description="Create branch without leaving sales user page."
          icon={<GitBranch size={21} />}
          onClose={() => setShowBranchModal(false)}
        >
          <BranchForm
            branchForm={branchForm}
            branchLoading={branchLoading}
            handleBranchChange={handleBranchChange}
            handleCreateBranch={handleCreateBranch}
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

        button:focus,
        button:focus-visible {
          outline: none;
        }
      `}</style>
    </div>
  );
}

function SalesUserTable({
  salesUsers,
  onView,
  onEdit,
  onToggleStatus,
  formatBranchLabel,
}) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[920px] text-sm">
        <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
          <tr>
            {["User", "Branch", "Email", "Role", "Status", "Actions"].map(
              (head) => (
                <th
                  key={head}
                  className="p-4 text-center text-xs font-bold uppercase tracking-wide"
                >
                  {head}
                </th>
              ),
            )}
          </tr>
        </thead>

        <tbody>
          {salesUsers.map((item) => {
            const isInactive =
              String(item.status || "active").toLowerCase() === "inactive";

            return (
              <tr
                key={item.id}
                className="border-t border-slate-100 transition dark:border-slate-800 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <td className="p-4">
                  <div className="flex items-center justify-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                      <ShieldCheck size={19} />
                    </div>

                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {item.name || "-"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Sales team member
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

                <td className="p-4 text-center capitalize text-slate-600 dark:text-slate-300">
                  {item.role?.replace("_", " ") || "sales user"}
                </td>

                <td className="p-4 text-center">
                  <StatusBadge status={item.status} />
                </td>

                <td className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <IconButton
                      icon={<Eye size={16} />}
                      className="bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
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
                      className={`flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold ${
                        isInactive
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950"
                          : "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950"
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

          {salesUsers.length === 0 && (
            <tr>
              <td colSpan="6" className="p-10 text-center">
                <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950 p-6">
                  <Users className="mx-auto text-slate-400" size={34} />
                  <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                    No sales users found
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

function SalesUserForm({
  formData,
  branches,
  editId,
  formatBranchLabel,
  handleChange,
  handleSubmit,
  onCancel,
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field icon={<Building2 size={16} />} label="Branch">
          <BranchSelect
            branches={branches}
            value={formData.branch_id}
            formatBranchLabel={formatBranchLabel}
            canAddBranch
            placeholder="Select Branch"
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
          label="Name"
          type="text"
          name="name"
          placeholder="Sales user name"
          value={formData.name}
          onChange={handleChange}
        />

        <Input
          icon={<Mail size={16} />}
          label="Email"
          type="email"
          name="email"
          placeholder="Sales user email"
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

      <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 dark:border-slate-800 sm:flex-row sm:justify-end">
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
          <UserPlus size={16} />
          {editId ? "Update Sales User" : "Create Sales User"}
        </button>
      </div>
    </form>
  );
}

function BranchForm({
  branchForm,
  branchLoading,
  handleBranchChange,
  handleCreateBranch,
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
            icon={<CheckCircle2 size={16} />}
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

      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          <X size={16} />
          Cancel
        </button>

        <button
          type="button"
          onClick={handleCreateBranch}
          disabled={branchLoading}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:ring-0 disabled:bg-blue-400"
        >
          <Save size={16} />
          {branchLoading ? "Saving..." : "Save Branch"}
        </button>
      </div>
    </>
  );
}

function SalesUserViewModal({ user, formatBranchLabel, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[50000] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex shrink-0 items-start justify-between border-b border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              <ShieldCheck size={28} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {user.name || "-"}
              </h2>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Sales user profile details
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

        <div className="min-h-0 flex-1 overflow-y-auto bg-white dark:bg-slate-900">
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            <ViewField label="Name" value={user.name} />
            <ViewField label="Email" value={user.email} />

            <ViewField
              label="Role"
              value={user.role?.replace("_", " ") || "sales user"}
            />

            <ViewField
              label="Status"
              value={<StatusBadge status={user.status} />}
            />

            <ViewField label="Branch" value={formatBranchLabel(user)} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FormModal({ title, description, icon, onClose, children }) {
  return createPortal(
    <div className="fixed inset-0 z-[50000] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
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

        <div className="min-h-0 flex-1 overflow-y-auto bg-white p-5 dark:bg-slate-900">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function StatsCard({ title, value, icon, color, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-w-0 w-full cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-white hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-white"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>

          <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {value}
          </h2>
        </div>

        <div className={`shrink-0 rounded-xl p-3 ${color}`}>{icon}</div>
      </div>
    </button>
  );
}

function BranchSelect({
  branches,
  value,
  onChange,
  formatBranchLabel,
  canAddBranch = true,
  placeholder = "Select Branch",
}) {
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
      .includes(branchSearch.trim().toLowerCase()),
  );

  const updateDropdownPosition = () => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownHeight = 330;
    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldOpenUp =
      spaceBelow < dropdownHeight && rect.top > dropdownHeight;

    setDropdownStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      top: shouldOpenUp ? rect.top - dropdownHeight - 8 : rect.bottom + 8,
      maxHeight: dropdownHeight,
      zIndex: 30000,
    });
  };

  useEffect(() => {
    if (!open) return;

    updateDropdownPosition();

    const handleClickOutside = (event) => {
      if (
        buttonRef.current?.contains(event.target) ||
        dropdownRef.current?.contains(event.target)
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
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-700 shadow-sm outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:focus:ring-blue-950/50"
      >
        <span className="min-w-0 truncate">
          {selectedBranch ? formatBranchLabel(selectedBranch) : placeholder}
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
                onChange={(event) => setBranchSearch(event.target.value)}
                placeholder="Search branch..."
                autoFocus
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:bg-slate-900 dark:focus:ring-blue-950/50"
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

          {canAddBranch && (
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
          )}
        </div>
      )}
    </>
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
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:focus:ring-blue-950/50"
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
          className={`shrink-0 text-slate-500 dark:text-slate-400 transition ${
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
                className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 ${
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
        value={value || ""}
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
        value={value || ""}
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

function ViewField({ label, value }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </p>
      <div className="min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm capitalize text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
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

export default SalesUsers;
