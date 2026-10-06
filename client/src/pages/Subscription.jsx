import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import toast from "react-hot-toast";

import {
  Crown,
  IndianRupee,
  CalendarClock,
  CreditCard,
  RefreshCcw,
  FileText,
  Building2,
  CheckCircle2,
  XCircle,
  Plus,
  PackageCheck,
  Search,
  X,
  ChevronDown,
  Save,
  Activity,
} from "lucide-react";

function formatBillingCycle(cycle) {
  const cycles = {
    "1_month": "1 Month",
    "3_months": "3 Months",
    "6_months": "6 Months",
    "1_year": "1 Year",
  };

  return cycles[cycle] || cycle || "-";
}

function formatDate(date) {
  if (!date) return "-";
  return String(date).slice(0, 10);
}

function getValidTillDate(subscription) {
  if (!subscription) return "-";

  if (["trial", "expired"].includes(subscription.status)) {
    return formatDate(subscription.trial_end_date);
  }

  return formatDate(subscription.renewal_date);
}

function Subscriptions() {
  const [plans, setPlans] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [extensionRequests, setExtensionRequests] = useState([]);

  const [subscriptionSearch, setSubscriptionSearch] = useState("");
  const [modalType, setModalType] = useState(null);
  const [modalSearch, setModalSearch] = useState("");
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [subscriptionPage, setSubscriptionPage] = useState(1);
  const [planStatusFilter, setPlanStatusFilter] = useState("active");

  const tableLimit = 5;

  const initialPlanForm = {
    plan_name: "",
    price: "",
    billing_cycle: "1_month",
    trial_days: "",
    max_branches: "2",
    features: "",
  };

  const [planForm, setPlanForm] = useState(initialPlanForm);

  const [subscriptionForm, setSubscriptionForm] = useState({
    company_id: "",
    plan_id: "",
    auto_renewal: 1,
  });

  const filteredSubscriptions = useMemo(() => {
    const keyword = subscriptionSearch.trim().toLowerCase();

    if (!keyword) return subscriptions;

    return subscriptions.filter((subscription) =>
      `${subscription.company_name || ""} ${subscription.plan_name || ""} ${
        subscription.status || ""
      } ${formatBillingCycle(subscription.billing_cycle)}`
        .toLowerCase()
        .includes(keyword),
    );
  }, [subscriptions, subscriptionSearch]);

  const paginatedSubscriptions = useMemo(() => {
    const start = (subscriptionPage - 1) * tableLimit;
    return filteredSubscriptions.slice(start, start + tableLimit);
  }, [filteredSubscriptions, subscriptionPage]);

  const subscriptionTotalPages = Math.max(
    1,
    Math.ceil(filteredSubscriptions.length / tableLimit),
  );

  const fetchData = async () => {
    try {
      const [
        plansRes,
        companiesRes,
        subsRes,
        paymentsRes,
        invoicesRes,
        extensionsRes,
      ] = await Promise.all([
        api.get("/subscriptions/plans"),
        api.get("/companies"),
        api.get("/subscriptions"),
        api.get("/subscriptions/payments/all"),
        api.get("/subscriptions/invoices/all"),
        api.get("/subscriptions/trial-extension/requests"),
      ]);

      setPlans(
        Array.isArray(plansRes.data)
          ? plansRes.data
          : plansRes.data.plans || [],
      );

      setCompanies(
        Array.isArray(companiesRes.data)
          ? companiesRes.data
          : companiesRes.data.companies || [],
      );

      setSubscriptions(
        Array.isArray(subsRes.data)
          ? subsRes.data
          : subsRes.data.subscriptions || [],
      );

      setPayments(
        Array.isArray(paymentsRes.data)
          ? paymentsRes.data
          : paymentsRes.data.payments || [],
      );

      setInvoices(
        Array.isArray(invoicesRes.data)
          ? invoicesRes.data
          : invoicesRes.data.invoices || [],
      );

      setExtensionRequests(
        Array.isArray(extensionsRes.data)
          ? extensionsRes.data
          : extensionsRes.data.requests || [],
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to fetch subscriptions",
      );
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const updatePlanField = (name, value) => {
    setPlanForm((prev) => ({ ...prev, [name]: value }));
  };

  const updateSubscriptionField = (name, value) => {
    setSubscriptionForm((prev) => ({ ...prev, [name]: value }));
  };

  const closePlanModal = () => {
    setShowPlanModal(false);
    setEditingPlanId(null);
    setPlanForm(initialPlanForm);
  };

  const openEditPlan = (plan) => {
    setEditingPlanId(plan.id);
    setPlanForm({
      plan_name: plan.plan_name || "",
      price: plan.price || "",
      billing_cycle: plan.billing_cycle || "3_months",
      trial_days: plan.trial_days || "",
      max_branches: plan.max_branches || "1",
      features: plan.features || "",
    });
    setShowPlanModal(true);
  };

  const savePlan = async (e) => {
    e.preventDefault();

    if (!planForm.plan_name.trim()) {
      toast.error("Plan name is required");
      return;
    }

    if (!planForm.price || Number(planForm.price) <= 0) {
      toast.error("Valid plan price is required");
      return;
    }

    if (!planForm.max_branches || Number(planForm.max_branches) <= 0) {
      toast.error("Max branches must be greater than 0");
      return;
    }

    try {
      const payload = {
        ...planForm,
        max_branches: Number(planForm.max_branches),
      };

      if (editingPlanId) {
        await api.put(`/subscriptions/plans/${editingPlanId}`, payload);
        toast.success("Plan updated successfully");
      } else {
        await api.post("/subscriptions/plans", payload);
        toast.success("Plan created successfully");
      }

      closePlanModal();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save plan");
    }
  };

  const assignSubscription = async (e) => {
    e.preventDefault();

    if (!subscriptionForm.company_id || !subscriptionForm.plan_id) {
      toast.error("Company and plan are required");
      return;
    }

    try {
      await api.post("/subscriptions", subscriptionForm);
      toast.success("Subscription assigned. Now generate invoice.");

      setSubscriptionForm({
        company_id: "",
        plan_id: "",
        auto_renewal: 1,
      });

      fetchData();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to assign subscription",
      );
    }
  };

  const toggleAutoRenewal = async (subscription) => {
    try {
      await api.put(`/subscriptions/${subscription.id}/auto-renewal`, {
        auto_renewal: subscription.auto_renewal ? 0 : 1,
      });

      fetchData();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to update auto renewal",
      );
    }
  };

  const generateInvoice = async (subscriptionId) => {
    try {
      await api.post("/subscriptions/invoices", {
        subscription_id: subscriptionId,
      });

      toast.success("Invoice generated");
      fetchData();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to generate invoice",
      );
    }
  };

  const downloadInvoice = async (invoice) => {
    try {
      const res = await api.get(
        `/subscriptions/invoices/${invoice.id}/download`,
        {
          responseType: "blob",
        },
      );

      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");

      link.href = blobUrl;
      link.setAttribute(
        "download",
        `${invoice.invoice_number || "subscription-invoice"}.pdf`,
      );

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      toast.error(error.response?.data?.message || "Invoice download failed");
    }
  };

  const deletePlan = async (id) => {
    if (!window.confirm("Are you sure you want to deactivate this plan?")) {
      return;
    }

    try {
      await api.delete(`/subscriptions/plans/${id}`);
      toast.success("Plan deactivated successfully");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to deactivate plan");
    }
  };

  const approveExtension = async (id) => {
    try {
      await api.patch(`/subscriptions/trial-extension/${id}/approve`);
      toast.success("Trial extension approved");
      fetchData();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to approve extension",
      );
    }
  };

  const rejectExtension = async (id) => {
    try {
      await api.patch(`/subscriptions/trial-extension/${id}/reject`);
      toast.success("Trial extension rejected");
      fetchData();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to reject extension",
      );
    }
  };

  const paidPayments = payments.filter(
    (item) => item.payment_status === "paid",
  );

  const totalRevenue = paidPayments.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );

  const activeSubscriptions = subscriptions.filter(
    (item) => item.status === "active",
  ).length;

  const trialSubscriptions = subscriptions.filter(
    (item) => item.status === "trial",
  ).length;

  const pendingExtensionRequests = extensionRequests.filter(
    (item) => item.trial_extension_status === "pending",
  ).length;

  const safeCompanies = Array.isArray(companies) ? companies : [];

  const visiblePlans = plans.filter((plan) => {
    if (planStatusFilter === "all") return true;
    return (plan.status || "active") === planStatusFilter;
  });

  const activePlanCount = plans.filter(
    (plan) => (plan.status || "active") !== "inactive",
  ).length;

  const inactivePlanCount = plans.filter(
    (plan) => (plan.status || "active") === "inactive",
  ).length;

  return (
    <div className="w-full min-w-0 space-y-6 overflow-x-hidden text-slate-900 dark:text-slate-100">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
              <Crown size={17} />
              SaaS Subscription & Billing
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Subscription Management
            </h1>

            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
              Create plans, assign subscriptions, manage renewals and branch
              license limits.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowPlanModal(true)}
            className="flex w-fit items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-0 active:ring-0"
          >
            <Plus size={17} />
            Create Plan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Building2 size={20} />}
          title="Total Subscriptions"
          value={subscriptions.length}
          color="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
          onClick={() => setModalType("total")}
        />

        <StatCard
          icon={<CheckCircle2 size={20} />}
          title="Active Plans"
          value={activeSubscriptions}
          color="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700"
          onClick={() => setModalType("active")}
        />

        <StatCard
          icon={<CalendarClock size={20} />}
          title="Trial Accounts"
          value={trialSubscriptions}
          badge={pendingExtensionRequests}
          badgeLabel="Extension Requests"
          color="bg-amber-50 dark:bg-amber-950/40 text-amber-700"
          onClick={() => setModalType("trial")}
        />

        <StatCard
          icon={<IndianRupee size={20} />}
          title="Paid Revenue"
          value={`₹ ${Number(totalRevenue || 0).toFixed(2)}`}
          color="bg-purple-50 dark:bg-purple-950/40 text-purple-700"
          onClick={() => setModalType("revenue")}
        />
      </div>

      <form
        onSubmit={assignSubscription}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <FormHeader
          icon={<CreditCard size={20} className="text-blue-600" />}
          title="Assign Subscription"
          subtitle="Select company, plan and auto-renewal preference."
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Field label="Company">
            <CustomSelect
              value={subscriptionForm.company_id}
              onChange={(value) => updateSubscriptionField("company_id", value)}
              searchable
              placeholder="Select Company"
              options={safeCompanies.map((company) => ({
                value: company.id,
                label:
                  company.name || company.company_name || "Unnamed Company",
                subLabel: company.email || "No email",
              }))}
            />
          </Field>

          <Field label="Plan">
            <CustomSelect
              value={subscriptionForm.plan_id}
              onChange={(value) => updateSubscriptionField("plan_id", value)}
              searchable
              placeholder="Select Plan"
              options={plans
                .filter((plan) => (plan.status || "active") !== "inactive")
                .map((plan) => ({
                  value: plan.id,
                  label: plan.plan_name,
                  subLabel: `₹${Number(plan.price || 0).toFixed(
                    2,
                  )} / ${formatBillingCycle(plan.billing_cycle)} / ${
                    plan.max_branches || 1
                  } Branch(es)`,
                }))}
            />
          </Field>

          <Field label="Auto Renewal">
            <CustomSelect
              value={subscriptionForm.auto_renewal}
              onChange={(value) =>
                updateSubscriptionField("auto_renewal", Number(value))
              }
              options={[
                { value: 1, label: "Enabled" },
                { value: 0, label: "Disabled" },
              ]}
            />
          </Field>
        </div>

        <button className="mt-5 flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm outline-none ring-0 transition-all duration-200 hover:bg-slate-800 focus:outline-none focus:ring-0 active:ring-0 dark:hover:bg-slate-700">
          <CheckCircle2 size={16} />
          Assign Subscription
        </button>
      </form>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Available Plans
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
              All SaaS plans created by SuperAdmin.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPlanStatusFilter("active")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                planStatusFilter === "active"
                  ? "bg-blue-600 text-white"
                  : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/70"
              }`}
            >
              Active Plans ({activePlanCount})
            </button>

            <button
              type="button"
              onClick={() => setPlanStatusFilter("inactive")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                planStatusFilter === "inactive"
                  ? "bg-slate-700 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              Inactive Plans ({inactivePlanCount})
            </button>

            <button
              type="button"
              onClick={() => setShowPlanModal(true)}
              className="flex w-fit items-center gap-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 px-4 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/70"
            >
              <Plus size={16} />
              New Plan
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {visiblePlans.map((plan) => (
            <div
              key={plan.id}
              className="h-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {plan.plan_name}
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {formatBillingCycle(plan.billing_cycle)}
                  </p>
                </div>

                <div
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    (plan.status || "active") === "inactive"
                      ? "bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-300"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {(plan.status || "active") === "inactive"
                    ? "Inactive"
                    : "Active"}
                </div>
              </div>

              <div className="mt-4">
                <span className="text-2xl font-semibold text-slate-900 dark:text-white">
                  ₹{Number(plan.price || 0).toFixed(2)}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                <p>
                  <CalendarClock size={14} className="mr-2 inline" />
                  Trial: {plan.trial_days || 0} days
                </p>
                <p>
                  <FileText size={14} className="mr-2 inline" />
                  Billing: {formatBillingCycle(plan.billing_cycle)}
                </p>
                <p>
                  <Building2 size={14} className="mr-2 inline" />
                  Branch Limit: {plan.max_branches || 1}
                </p>
              </div>

              <div className="mt-4 border-t border-slate-200 dark:border-slate-800 pt-3">
                <div className="mt-4 flex gap-2">
                  {(plan.status || "active") !== "inactive" && (
                    <button
                      type="button"
                      onClick={() => openEditPlan(plan)}
                      className="flex-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/70"
                    >
                      Edit
                    </button>
                  )}
                  {(plan.status || "active") !== "inactive" && (
                    <button
                      type="button"
                      onClick={() => deletePlan(plan.id)}
                      className="flex-1 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:bg-rose-950/40"
                    >
                      Deactivate
                    </button>
                  )}
                </div>
                {(plan.features || "")
                  .split(",")
                  .filter(Boolean)
                  .map((feature) => (
                    <p
                      key={feature}
                      className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300"
                    >
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      {feature.trim()}
                    </p>
                  ))}

                {!plan.features && (
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    No features added.
                  </p>
                )}
              </div>
            </div>
          ))}

          {visiblePlans.length === 0 && (
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              {planStatusFilter === "inactive"
                ? "No inactive plans found."
                : "No active plans found."}
            </p>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="border-b border-slate-200 dark:border-slate-800 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Company Subscriptions
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                Manage assigned plans, renewals and billing actions.
              </p>
            </div>

            <div className="relative w-full lg:w-80">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                value={subscriptionSearch}
                onChange={(e) => {
                  setSubscriptionSearch(e.target.value);
                  setSubscriptionPage(1);
                }}
                placeholder="Search company/plan"
                className="input !pl-10"
              />
            </div>
          </div>
        </div>

        <SubscriptionsTable
          subscriptions={paginatedSubscriptions}
          toggleAutoRenewal={toggleAutoRenewal}
          invoices={invoices}
          generateInvoice={generateInvoice}
          downloadInvoice={downloadInvoice}
          subscriptionSearch={subscriptionSearch}
        />

        <Pagination
          page={subscriptionPage}
          totalPages={subscriptionTotalPages}
          totalRecords={filteredSubscriptions.length}
          setPage={setSubscriptionPage}
        />
      </div>

      {showPlanModal && (
        <CreatePlanModal
          editingPlanId={editingPlanId}
          planForm={planForm}
          updatePlanField={updatePlanField}
          onSubmit={savePlan}
          onClose={closePlanModal}
        />
      )}

      {modalType && (
        <SubscriptionStatsModal
          type={modalType}
          subscriptions={subscriptions}
          payments={payments}
          extensionRequests={extensionRequests}
          approveExtension={approveExtension}
          rejectExtension={rejectExtension}
          search={modalSearch}
          setSearch={setModalSearch}
          onClose={() => {
            setModalType(null);
            setModalSearch("");
          }}
        />
      )}

      <style>{`
        .input {
          width: 100%;
          border: 1px solid #cbd5e1;
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 14px;
          outline: none;
          background: #ffffff;
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
          box-shadow: none;
        }
      `}</style>
    </div>
  );
}

function CreatePlanModal({
  editingPlanId,
  planForm,
  updatePlanField,
  onSubmit,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-5">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-xl bg-blue-50 dark:bg-blue-950/40 p-3 text-blue-700 dark:text-blue-300">
              <PackageCheck size={22} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingPlanId ? "Edit Plan" : "Create New Plan"}
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                Add billing cycle, price, trial days and branch limit.
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

        <form onSubmit={onSubmit} className="overflow-auto p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Plan Name"
              name="plan_name"
              value={planForm.plan_name}
              onChange={(e) => updatePlanField("plan_name", e.target.value)}
              placeholder="Basic Plan"
            />

            <Input
              label="Price"
              type="number"
              name="price"
              value={planForm.price}
              onChange={(e) => updatePlanField("price", e.target.value)}
              placeholder="999"
            />

            <Field label="Billing Cycle">
              <CustomSelect
                value={planForm.billing_cycle}
                onChange={(value) => updatePlanField("billing_cycle", value)}
                options={[
                  { value: "1_month", label: "1 Month" },
                  { value: "3_months", label: "3 Months" },
                  { value: "6_months", label: "6 Months" },
                  { value: "1_year", label: "1 Year" },
                ]}
              />
            </Field>

            <Input
              label="Trial Days"
              type="number"
              name="trial_days"
              value={planForm.trial_days}
              onChange={(e) => updatePlanField("trial_days", e.target.value)}
              placeholder="10"
            />

            <Input
              label="Max Branches"
              type="number"
              name="max_branches"
              value={planForm.max_branches}
              onChange={(e) => updatePlanField("max_branches", e.target.value)}
              placeholder="1"
            />

            <div className="md:col-span-2">
              <Input
                label="Features"
                name="features"
                value={planForm.features}
                onChange={(e) => updatePlanField("features", e.target.value)}
                placeholder="Invoices, Reports, GST, Payments"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-200 dark:border-slate-800 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
            >
              <X size={16} />
              Cancel
            </button>

            <button
              type="submit"
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Save size={17} />
              {editingPlanId ? "Update Plan" : "Save Plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SubscriptionsTable({
  subscriptions,
  toggleAutoRenewal,
  generateInvoice,
  invoices,
  downloadInvoice,
  subscriptionSearch,
}) {
  return (
    <div className="overflow-x-hidden">
      <table className="w-full table-fixed text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          <tr>
            <TableHead title="Company" />
            <TableHead title="Plan" />
            <TableHead title="Amount" />
            <TableHead title="Status" />
            <TableHead title="Valid Till" />
            <TableHead title="Auto Renewal" />
            <TableHead title="Billing Action" />
          </tr>
        </thead>

        <tbody>
          {subscriptions.map((subscription) => {
            const invoice = invoices.find(
              (item) =>
                Number(item.subscription_id) === Number(subscription.id),
            );

            return (
              <tr
                key={subscription.id}
                className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:bg-slate-700 dark:bg-slate-800"
              >
                <td className="break-words p-4 font-semibold text-slate-900 dark:text-white">
                  {subscription.company_name || "-"}
                </td>

                <td className="break-words p-4">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    {subscription.plan_name || "-"}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {formatBillingCycle(subscription.billing_cycle)}
                  </p>
                </td>

                <td className="p-4 font-semibold text-slate-900 dark:text-white">
                  ₹ {Number(subscription.price || 0).toFixed(2)}
                </td>

                <td className="p-4">
                  <StatusBadge status={subscription.status} />
                </td>

                <td className="p-4 font-semibold text-slate-600 dark:text-slate-300">
                  {getValidTillDate(subscription)}
                </td>

                <td className="p-4">
                  <button
                    type="button"
                    onClick={() => toggleAutoRenewal(subscription)}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                      subscription.auto_renewal
                        ? "bg-green-50 dark:bg-emerald-950/40 text-green-700"
                        : "bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-300"
                    }`}
                  >
                    {subscription.auto_renewal ? (
                      <RefreshCcw size={12} />
                    ) : (
                      <XCircle size={12} />
                    )}
                    {subscription.auto_renewal ? "Enabled" : "Disabled"}
                  </button>
                </td>

                <td className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {!invoice && subscription.status === "pending_payment" && (
                      <button
                        type="button"
                        onClick={() => generateInvoice(subscription.id)}
                        className="rounded-lg bg-blue-50 dark:bg-blue-950/40 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/70"
                      >
                        Generate Invoice
                      </button>
                    )}

                    {invoice && (
                      <button
                        type="button"
                        onClick={() => downloadInvoice(invoice)}
                        className="rounded-lg bg-blue-50 dark:bg-blue-950/40 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/70"
                      >
                        Download Invoice
                      </button>
                    )}

                    {!invoice && subscription.status !== "pending_payment" && (
                      <span className="text-xs font-semibold text-slate-400">
                        -
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}

          {subscriptions.length === 0 && (
            <tr>
              <td
                colSpan="7"
                className="p-8 text-center text-slate-500 dark:text-slate-400"
              >
                {subscriptionSearch
                  ? "No matching subscriptions found."
                  : "No subscriptions found."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select",
  searchable = false,
}) {
  const [open, setOpen] = useState(false);
  const [selectSearch, setSelectSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState({});

  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const selected = options.find(
    (option) => String(option.value) === String(value),
  );

  const filteredOptions = options.filter((option) =>
    `${option.label || ""} ${option.subLabel || ""}`
      .toLowerCase()
      .includes(selectSearch.toLowerCase()),
  );

  const updateDropdownPosition = () => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownHeight = searchable
      ? 330
      : Math.min(options.length * 46 + 16, 240);

    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldOpenUp =
      spaceBelow < dropdownHeight + 12 && rect.top > dropdownHeight;

    setDropdownStyle({
      position: "fixed",
      left: rect.left,
      top: shouldOpenUp ? rect.top - dropdownHeight - 8 : rect.bottom + 8,
      width: rect.width,
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
      setSelectSearch("");
    };

    window.addEventListener("scroll", updateDropdownPosition, true);
    window.addEventListener("resize", updateDropdownPosition);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("scroll", updateDropdownPosition, true);
      window.removeEventListener("resize", updateDropdownPosition);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, options.length, searchable]);

  const handleSelect = (selectedValue) => {
    onChange(selectedValue);
    setOpen(false);
    setSelectSearch("");
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-left text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-sm outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      >
        <span className="min-w-0 truncate">
          {selected?.label || placeholder}
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
          {searchable && (
            <div className="border-b border-slate-100 p-2 dark:border-slate-800">
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                />

                <input
                  type="text"
                  value={selectSearch}
                  onChange={(e) => setSelectSearch(e.target.value)}
                  placeholder="Search..."
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:bg-slate-900 dark:focus:ring-blue-950/50"
                />
              </div>
            </div>
          )}

          <div className="max-h-56 overflow-y-auto p-2">
            {filteredOptions.map((option) => {
              const active = String(option.value) === String(value);

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full rounded-xl px-3 py-2 text-left transition ${
                    active
                      ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:bg-slate-700 dark:bg-slate-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {option.label}
                      </p>

                      {option.subLabel && (
                        <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {option.subLabel}
                        </p>
                      )}
                    </div>

                    {active && (
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}

            {filteredOptions.length === 0 && (
              <div className="px-3 py-5 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                No option found
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Pagination({ page, totalPages, totalRecords, setPage }) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 dark:border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
        Total Records: {totalRecords}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:bg-slate-700 dark:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Prev
        </button>

        <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Page {page} of {totalPages}
        </span>

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:bg-slate-700 dark:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function SubscriptionStatsModal({
  type,
  subscriptions,
  payments,
  extensionRequests = [],
  approveExtension,
  rejectExtension,
  search,
  setSearch,
  onClose,
}) {
  const pendingExtensionRows = useMemo(
    () =>
      extensionRequests
        .filter((item) => item.trial_extension_status === "pending")
        .map((item) => ({
          ...item,
          id: `extension-${item.id}`,
          subscription_id: item.id,
          status: item.status || "expired",
          billing_cycle: item.billing_cycle || "trial",
          is_extension_request: true,
        })),
    [extensionRequests],
  );

  const filteredSubscriptions = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    const baseRows = subscriptions.filter((item) => {
      if (type === "active") return item.status === "active";
      if (type === "trial") return item.status === "trial";
      return true;
    });

    const rows =
      type === "trial" ? [...baseRows, ...pendingExtensionRows] : baseRows;

    if (!keyword) return rows;

    return rows.filter((item) =>
      `${item.company_name || ""} ${item.company_email || ""} ${
        item.plan_name || ""
      } ${item.status || ""} ${item.request_type || ""} ${
        item.trial_extension_status || ""
      } ${formatBillingCycle(item.billing_cycle)}`
        .toLowerCase()
        .includes(keyword),
    );
  }, [subscriptions, pendingExtensionRows, search, type]);

  const filteredPayments = payments
    .filter((item) => item.payment_status === "paid")
    .filter((item) => {
      const keyword = search.trim().toLowerCase();
      if (!keyword) return true;

      return `${item.company_name || ""} ${item.plan_name || ""} ${
        item.payment_status || ""
      }`
        .toLowerCase()
        .includes(keyword);
    });

  const totalSubscriptions = subscriptions.length;
  const activeSubscriptions = subscriptions.filter(
    (item) => item.status === "active",
  ).length;
  const trialSubscriptions = subscriptions.filter(
    (item) => item.status === "trial",
  ).length;

  const inactiveSubscriptions = subscriptions.filter(
    (item) =>
      item.status === "cancelled" ||
      item.status === "expired" ||
      item.status === "inactive",
  ).length;

  const revenueTotal = filteredPayments.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );

  const paidCompanies = new Set(
    filteredPayments.map((item) => item.company_id || item.company_name),
  ).size;

  const isRevenue = type === "revenue";

  const configMap = {
    total: {
      title: "Total Subscriptions",
      subtitle: "All assigned company subscriptions.",
      icon: <Building2 size={22} />,
      color: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
    },
    active: {
      title: "Active Plans",
      subtitle: "Currently active company subscriptions.",
      icon: <CheckCircle2 size={22} />,
      color: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700",
    },
    trial: {
      title: "Trial Accounts",
      subtitle: "Trial accounts and pending extension requests.",
      icon: <CalendarClock size={22} />,
      color: "bg-amber-50 dark:bg-amber-950/40 text-amber-700",
    },
    revenue: {
      title: "Paid Revenue",
      subtitle: "Subscription payment revenue records.",
      icon: <IndianRupee size={22} />,
      color: "bg-purple-50 dark:bg-purple-950/40 text-purple-700",
    },
  };

  const config = configMap[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${config.color}`}
            >
              {config.icon}
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {config.title}
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                {config.subtitle}
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

        <div className="overflow-auto p-5">
          {isRevenue ? (
            <div className="space-y-5">
              <ModalStatsGrid>
                <ModalStatCard
                  title="Paid Revenue"
                  value={`₹ ${Number(revenueTotal || 0).toFixed(2)}`}
                  icon={<IndianRupee size={18} />}
                  className="bg-purple-50 dark:bg-purple-950/40 text-purple-700"
                />
                <ModalStatCard
                  title="Paid Payments"
                  value={filteredPayments.length}
                  icon={<CreditCard size={18} />}
                  className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                />
                <ModalStatCard
                  title="Companies"
                  value={paidCompanies}
                  icon={<Building2 size={18} />}
                  className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700"
                />
                <ModalStatCard
                  title="Showing Records"
                  value={filteredPayments.length}
                  icon={<Activity size={18} />}
                  className="bg-amber-50 dark:bg-amber-950/40 text-amber-700"
                />
              </ModalStatsGrid>

              <SearchBox value={search} setValue={setSearch} />

              <RevenueModalTable
                filteredPayments={filteredPayments}
                revenueTotal={revenueTotal}
              />
            </div>
          ) : (
            <div className="space-y-5">
              <ModalStatsGrid>
                <ModalStatCard
                  title="Total Subscriptions"
                  value={totalSubscriptions}
                  icon={<Building2 size={18} />}
                  className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                />
                <ModalStatCard
                  title="Active"
                  value={activeSubscriptions}
                  icon={<CheckCircle2 size={18} />}
                  className="bg-green-50 dark:bg-emerald-950/40 text-green-700"
                />
                <ModalStatCard
                  title="Trial"
                  value={trialSubscriptions}
                  icon={<CalendarClock size={18} />}
                  className="bg-amber-50 dark:bg-amber-950/40 text-amber-700"
                />
                <ModalStatCard
                  title="Inactive Subscriptions"
                  value={inactiveSubscriptions}
                  icon={<XCircle size={18} />}
                  className="bg-red-50 dark:bg-red-950/40 text-red-700"
                />
              </ModalStatsGrid>

              <SearchBox value={search} setValue={setSearch} />

              <SubscriptionModalTable
                subscriptions={filteredSubscriptions}
                showTrialActions={type === "trial"}
                approveExtension={approveExtension}
                rejectExtension={rejectExtension}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchBox({ value, setValue }) {
  return (
    <div className="relative">
      <Search
        size={17}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search details..."
        className="input !pl-10"
      />
    </div>
  );
}

function ModalStatsGrid({ children }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {children}
    </div>
  );
}

function ModalStatCard({ title, value, icon, className }) {
  return (
    <div
      className={`h-[96px] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 ${className}`}
    >
      <div className="flex h-full items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          <h3 className="mt-2 truncate text-lg font-bold">{value}</h3>
        </div>
        <div className="shrink-0 rounded-xl bg-white dark:bg-slate-900/70 p-2.5">
          {icon}
        </div>
      </div>
    </div>
  );
}

function RevenueModalTable({ filteredPayments }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <tr>
              <TableHead title="Company" />
              <TableHead title="Plan" />
              <TableHead title="Amount" />
              <TableHead title="Status" />
              <TableHead title="Date" />
            </tr>
          </thead>

          <tbody>
            {filteredPayments.map((payment) => (
              <tr
                key={payment.id}
                className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:bg-slate-700 dark:bg-slate-800"
              >
                <td className="p-4 font-semibold text-slate-900 dark:text-white">
                  {payment.company_name || "-"}
                </td>
                <td className="p-4 font-semibold text-slate-600 dark:text-slate-300">
                  {payment.plan_name || "-"}
                </td>
                <td className="p-4 font-semibold text-slate-900 dark:text-white">
                  ₹ {Number(payment.amount || 0).toFixed(2)}
                </td>
                <td className="p-4">
                  <StatusBadge status={payment.payment_status} />
                </td>
                <td className="p-4 font-semibold text-slate-600 dark:text-slate-300">
                  {formatDate(payment.payment_date)}
                </td>
              </tr>
            ))}

            {filteredPayments.length === 0 && (
              <tr>
                <td
                  colSpan="5"
                  className="p-8 text-center text-slate-500 dark:text-slate-400"
                >
                  No paid revenue records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubscriptionModalTable({
  subscriptions,
  showTrialActions = false,
  approveExtension,
  rejectExtension,
}) {
  const tableMinWidth = showTrialActions ? "min-w-[760px]" : "min-w-[950px]";
  const emptyColSpan = showTrialActions ? 6 : 7;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="overflow-x-auto">
        <table className={`w-full ${tableMinWidth} text-sm`}>
          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <tr>
              <TableHead title="Company" />
              <TableHead title="Plan" />
              {!showTrialActions && <TableHead title="Amount" />}
              {!showTrialActions && <TableHead title="Branch Limit" />}
              <TableHead title="Status" />
              <TableHead title="Valid Till" />
              <TableHead title="Auto Renewal" />
              {showTrialActions && <TableHead title="Action" />}
            </tr>
          </thead>

          <tbody>
            {subscriptions.map((subscription) => {
              const isExtensionRequest = subscription.is_extension_request;
              const rowKey = isExtensionRequest
                ? `extension-${subscription.subscription_id}`
                : subscription.id;

              return (
                <tr
                  key={rowKey}
                  className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:bg-slate-700 dark:bg-slate-800"
                >
                  <td className="p-4 font-semibold text-slate-900 dark:text-white">
                    {subscription.company_name || "-"}
                    {subscription.company_email && (
                      <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {subscription.company_email}
                      </p>
                    )}
                  </td>

                  <td className="p-4">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">
                      {subscription.plan_name || "-"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {formatBillingCycle(subscription.billing_cycle)}
                    </p>
                  </td>

                  {!showTrialActions && (
                    <td className="p-4 font-semibold text-slate-900 dark:text-white">
                      ₹ {Number(subscription.price || 0).toFixed(2)}
                    </td>
                  )}

                  {!showTrialActions && (
                    <td className="p-4 font-semibold text-slate-700 dark:text-slate-200">
                      {subscription.max_branches || 1}
                    </td>
                  )}

                  <td className="p-4">
                    <StatusBadge
                      status={
                        isExtensionRequest
                          ? subscription.trial_extension_status
                          : subscription.status
                      }
                    />
                  </td>

                  <td className="p-4 font-semibold text-slate-600 dark:text-slate-300">
                    {getValidTillDate(subscription)}
                  </td>

                  <td className="p-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        subscription.auto_renewal
                          ? "bg-green-50 dark:bg-emerald-950/40 text-green-700"
                          : "bg-red-50 dark:bg-red-950/40 text-red-700"
                      }`}
                    >
                      {subscription.auto_renewal ? "Enabled" : "Disabled"}
                    </span>
                  </td>

                  {showTrialActions && (
                    <td className="p-4">
                      {isExtensionRequest ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              approveExtension(subscription.subscription_id)
                            }
                            className="rounded-lg bg-green-50 dark:bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 dark:hover:bg-emerald-950/70"
                          >
                            Approve
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              rejectExtension(subscription.subscription_id)
                            }
                            className="rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 dark:hover:bg-red-950/70"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">
                          -
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}

            {subscriptions.length === 0 && (
              <tr>
                <td
                  colSpan={emptyColSpan}
                  className="p-8 text-center text-slate-500 dark:text-slate-400"
                >
                  No matching subscription records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FormHeader({ icon, title, subtitle }) {
  return (
    <div className="mb-5">
      <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
        {icon}
        {title}
      </h2>
      <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
        {subtitle}
      </p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({ label, name, value, onChange, type = "text", placeholder }) {
  return (
    <Field label={label}>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="input"
      />
    </Field>
  );
}

function StatCard({
  icon,
  title,
  value,
  color,
  onClick,
  badge = 0,
  badgeLabel,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-h-[96px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
    >
      <div className="flex h-full items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <h2 className="mt-1 truncate text-xl font-semibold text-slate-900 dark:text-white">
            {value}
          </h2>
          <p className="mt-2 text-xs font-semibold text-blue-600 opacity-0 transition group-hover:opacity-100">
            {Number(badge) > 0 && badgeLabel
              ? badgeLabel
              : "Click to view details"}
          </p>
        </div>

        <div className="relative shrink-0">
          <div className={`rounded-xl p-3 ${color}`}>{icon}</div>

          {Number(badge) > 0 && (
            <span className="absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function TableHead({ title }) {
  return (
    <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide">
      {title}
    </th>
  );
}

function StatusBadge({ status }) {
  const value = String(status || "-").toLowerCase();

  const styles = {
    active:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    trial:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300",
    expired:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
    cancelled:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
    inactive:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
    paid: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    pending:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300",
    pending_payment:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300",
    generated:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300",
    approved:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    rejected:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold capitalize shadow-sm ${
        styles[value] ||
        "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      }`}
    >
      {value.replace("_", " ")}
    </span>
  );
}

export default Subscriptions;
