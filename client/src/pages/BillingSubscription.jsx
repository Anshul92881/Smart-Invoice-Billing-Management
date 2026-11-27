import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import {
  CalendarDays,
  CreditCard,
  FileText,
  RefreshCcw,
  ShieldCheck,
  WalletCards,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  ArrowUpRight,
  Crown,
  Bookmark,
  X,
  Send,
} from "lucide-react";
function isFreePlan(plan) {
  if (!plan) return false;
  return (
    String(plan.plan_type || "").toLowerCase() === "free" ||
    Number(plan.is_free) === 1 ||
    (plan.price !== null &&
      plan.price !== undefined &&
      Number(plan.price) === 0)
  );
}

function getPlanDuration(plan) {
  const durationValue = Number(plan?.duration_value);
  const durationUnit = String(plan?.duration_unit || "").toLowerCase();

  if (
    Number.isInteger(durationValue) &&
    durationValue >= 0 &&
    ["day", "month", "year"].includes(durationUnit)
  ) {
    return {
      value: durationValue,
      unit: durationUnit,
    };
  }

  const legacyCycles = {
    monthly: { value: 1, unit: "month" },
    quarterly: { value: 3, unit: "month" },
    half_yearly: { value: 6, unit: "month" },
    yearly: { value: 1, unit: "year" },
    "1_month": { value: 1, unit: "month" },
    "3_months": { value: 3, unit: "month" },
    "6_months": { value: 6, unit: "month" },
    "1_year": { value: 1, unit: "year" },
  };

  const customDuration = String(plan?.billing_cycle || "").match(
    /^(\d+)_(day|month|year)s?$/,
  );

  if (customDuration) {
    return {
      value: Number(customDuration[1]),
      unit: customDuration[2],
    };
  }

  if (legacyCycles[plan?.billing_cycle]) {
    return legacyCycles[plan.billing_cycle];
  }

  return {
    value: 0,
    unit: "month",
  };
}

function getPlanCategory(plan) {
  if (plan?.plan_category) {
    return plan.plan_category;
  }

  if (plan?.subscription_kind) {
    return plan.subscription_kind;
  }

  const durationValue = Number(plan?.duration_value || 0);
  const maxBranches = Number(plan?.max_branches || 0);

  if (durationValue === 0 && maxBranches > 0) {
    return "branch_addon";
  }

  if (durationValue > 0 && maxBranches === 0) {
    return "duration_only";
  }

  if (durationValue > 0 && maxBranches > 0) {
    return "complete";
  }

  return "invalid";
}

function formatPlanDuration(plan) {
  const { value, unit } = getPlanDuration(plan);

  if (value === 0) {
    return "No duration extension";
  }

  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

function hasRunningSubscription(subscription) {
  const status = String(subscription?.status || "").toLowerCase();

  return status === "active" || status === "trial";
}

function getSubscriptionUiStatus(subscription) {
  if (Number(subscription?.is_current) === 1) {
    return "current";
  }
  if (String(subscription?.status || "").toLowerCase() === "active") {
    return "previous";
  }
  return subscription?.status || "inactive";
}
function BillingSubscription() {
  const [subscription, setSubscription] = useState(null);
  const [allSubscriptions, setAllSubscriptions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState(null);
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [showInvoicesModal, setShowInvoicesModal] = useState(false);
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [invoicePage, setInvoicePage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [confirmModal, setConfirmModal] = useState(null);
  const [showSubscriptionHistoryModal, setShowSubscriptionHistoryModal] =
    useState(false);
  const [subscriptionPage, setSubscriptionPage] = useState(1);
  const [buyingPlanId, setBuyingPlanId] = useState(null);
  const modalLimit = 5;
  const fetchBillingData = async () => {
    try {
      setLoading(true);
      const [subRes, plansRes, allSubRes, invoiceRes, paymentRes] =
        await Promise.all([
          api.get("/subscriptions/my/current"),
          api.get("/subscriptions/my/plans"),
          api.get("/subscriptions/my/all"),
          api.get("/subscriptions/my/invoices"),
          api.get("/subscriptions/my/payments"),
        ]);
      setSubscription(subRes.data || null);
      setPlans(plansRes.data || []);
      setAllSubscriptions(allSubRes.data || []);
      setInvoices(invoiceRes.data || []);
      setPayments(paymentRes.data || []);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to load billing details",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchBillingData();
  }, []);
  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };
  const formatAmount = (amount) =>
    Number(amount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const activePlans = useMemo(() => {
    return plans.filter((plan) => plan.status !== "inactive");
  }, [plans]);
  const pendingInvoices = useMemo(() => {
    return invoices.filter((invoice) => invoice.invoice_status !== "paid");
  }, [invoices]);
  const totalPaid = useMemo(() => {
    return payments
      .filter((payment) => payment.payment_status === "paid")
      .reduce((total, payment) => total + Number(payment.amount || 0), 0);
  }, [payments]);
  const pendingAmount = useMemo(() => {
    return pendingInvoices.reduce(
      (total, invoice) => total + Number(invoice.amount || 0),
      0,
    );
  }, [pendingInvoices]);
  const sortedInvoices = useMemo(() => {
    return [...invoices].sort((firstInvoice, secondInvoice) => {
      const firstDate = new Date(
        firstInvoice.invoice_date || firstInvoice.created_at || 0,
      ).getTime();
      const secondDate = new Date(
        secondInvoice.invoice_date || secondInvoice.created_at || 0,
      ).getTime();
      if (secondDate !== firstDate) {
        return secondDate - firstDate;
      }
      return Number(secondInvoice.id || 0) - Number(firstInvoice.id || 0);
    });
  }, [invoices]);
  const sortedPayments = useMemo(() => {
    return [...payments].sort((firstPayment, secondPayment) => {
      const firstDate = new Date(
        firstPayment.payment_date || firstPayment.created_at || 0,
      ).getTime();
      const secondDate = new Date(
        secondPayment.payment_date || secondPayment.created_at || 0,
      ).getTime();
      if (secondDate !== firstDate) {
        return secondDate - firstDate;
      }
      return Number(secondPayment.id || 0) - Number(firstPayment.id || 0);
    });
  }, [payments]);
  const sortedSubscriptions = useMemo(() => {
    return [...allSubscriptions].sort(
      (firstSubscription, secondSubscription) => {
        const currentDifference =
          Number(secondSubscription.is_current || 0) -
          Number(firstSubscription.is_current || 0);
        if (currentDifference !== 0) {
          return currentDifference;
        }
        const firstDate = new Date(
          firstSubscription.start_date || firstSubscription.created_at || 0,
        ).getTime();
        const secondDate = new Date(
          secondSubscription.start_date || secondSubscription.created_at || 0,
        ).getTime();
        if (secondDate !== firstDate) {
          return secondDate - firstDate;
        }
        return (
          Number(secondSubscription.id || 0) - Number(firstSubscription.id || 0)
        );
      },
    );
  }, [allSubscriptions]);
  const visibleInvoices = sortedInvoices.slice(0, 5);
  const visiblePayments = sortedPayments.slice(0, 5);
  const paginate = (list, page) => {
    const safeList = Array.isArray(list) ? list : [];
    return safeList.slice((page - 1) * modalLimit, page * modalLimit);
  };
  const getTotalPages = (list) => {
    const safeList = Array.isArray(list) ? list : [];
    return Math.max(1, Math.ceil(safeList.length / modalLimit));
  };
  const statusClass = useMemo(() => {
    switch (subscription?.status?.toLowerCase()) {
      case "active":
        return "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300";
      case "trial":
        return "border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300";
      case "expired":
        return "border border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300";
      case "inactive":
      case "cancelled":
        return "border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";
      default:
        return "border border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300";
    }
  }, [subscription?.status]);
  const downloadFile = async (url, filename) => {
    const res = await api.get(url, { responseType: "blob" });
    const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  };
  const handleDownloadInvoice = async (id, invoiceNumber) => {
    try {
      await downloadFile(
        `/subscriptions/my/invoices/${id}/download`,
        `${invoiceNumber || "subscription-invoice"}.pdf`,
      );
    } catch (error) {
      toast.error(error.response?.data?.message || "Invoice download failed");
    }
  };
  const handleDownloadReceipt = async (id) => {
    try {
      await downloadFile(
        `/subscriptions/my/payments/${id}/receipt`,
        `subscription-receipt-${id}.pdf`,
      );
    } catch (error) {
      toast.error(error.response?.data?.message || "Receipt download failed");
    }
  };
  const handlePayInvoice = async (invoiceId) => {
    setConfirmModal({
      type: "warning",
      title: "Pay Subscription Invoice?",
      message:
        "Are you sure you want to mark this subscription invoice as paid?",
      confirmText: "Yes, Pay Now",
      cancelText: "Cancel",
      onConfirm: async () => {
        try {
          setPayingId(invoiceId);
          await api.post("/subscriptions/my/pay", {
            invoice_id: invoiceId,
            payment_method: "manual",
            transaction_id: `TXN-${Date.now()}`,
          });
          toast.success("Subscription payment completed successfully");
          fetchBillingData();
        } catch (error) {
          toast.error(error.response?.data?.message || "Payment failed");
        } finally {
          setPayingId(null);
          setConfirmModal(null);
        }
      },
    });
  };

  const handleBuyPlan = (plan) => {
    if (isFreePlan(plan)) {
      toast.error("Free plan is assigned automatically after KYC approval");
      return;
    }

    const planCategory = getPlanCategory(plan);
    const planBranches = Number(plan.max_branches ?? 0);
    const planDuration = formatPlanDuration(plan);

    let purchaseMessage = "";

    if (planCategory === "branch_addon") {
      purchaseMessage =
        `${planBranches} additional ${
          planBranches === 1 ? "branch" : "branches"
        } will be added. ` +
        "Your current subscription validity will remain unchanged.";
    } else if (planCategory === "duration_only") {
      purchaseMessage =
        `${planDuration} will be added to your subscription validity. ` +
        "Your current branch limit will remain unchanged.";
    } else {
      purchaseMessage =
        `${planDuration} will be added to your subscription validity. ` +
        `${planBranches} additional ${
          planBranches === 1 ? "branch" : "branches"
        } will be added.`;
    }

    setConfirmModal({
      type: "info",

      title:
        planCategory === "branch_addon"
          ? "Buy Branch Add-on?"
          : "Buy Subscription Plan?",

      message: `Purchase ${plan.plan_name} for ₹${formatAmount(
        plan.price,
      )}. ${purchaseMessage}`,

      confirmText:
        planCategory === "branch_addon" ? "Add Branches" : "Buy Plan",

      cancelText: "Cancel",

      onConfirm: async () => {
        try {
          setBuyingPlanId(plan.id);

          const response = await api.post("/subscriptions/my/buy-plan", {
            plan_id: plan.id,
          });

          toast.success(
            response.data?.message || "Subscription purchased successfully",
          );

          await fetchBillingData();
          setShowPlansModal(false);
        } catch (error) {
          toast.error(
            error.response?.data?.message ||
              "Failed to purchase subscription plan",
          );
        } finally {
          setBuyingPlanId(null);
          setConfirmModal(null);
        }
      },
    });
  };

  const handleToggleAutoRenewal = async () => {
    if (!subscription?.id) return;
    try {
      await api.put(`/subscriptions/${subscription.id}/auto-renewal`, {
        auto_renewal: subscription.auto_renewal ? 0 : 1,
      });
      toast.success(
        subscription.auto_renewal
          ? "Auto renewal disabled"
          : "Auto renewal enabled",
      );
      fetchBillingData();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to update auto renewal",
      );
    }
  };
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center shadow-sm">
        <RefreshCcw
          className="mx-auto mb-3 animate-spin text-blue-600 dark:text-blue-400"
          size={34}
        />
        <p className="font-semibold text-slate-700 dark:text-slate-200">
          Loading billing details...
        </p>
      </div>
    );
  }
  return (
    <div className="w-full min-w-0 space-y-6 text-sm text-slate-700 dark:text-slate-200">
      <div className="px-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
              <WalletCards size={25} />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                Workspace / Billing
              </p>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
                Billing Center
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Track your subscription plan, billing invoices and payment
                history.
              </p>
            </div>
          </div>
        </div>
      </div>
      {!subscription ? (
        <EmptySubscription onManage={() => setShowPlansModal(true)} />
      ) : (
        <>
          <SubscriptionHero
            subscription={subscription}
            pendingAmount={pendingAmount}
            statusClass={statusClass}
            formatDate={formatDate}
            formatAmount={formatAmount}
            onManage={() => setShowPlansModal(true)}
            onToggleAutoRenewal={handleToggleAutoRenewal}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryBox
              title="Total Paid"
              value={`₹ ${formatAmount(totalPaid)}`}
              icon={<CreditCard size={18} />}
            />
            <SummaryBox
              title="Total Invoices"
              value={invoices.length}
              icon={<FileText size={18} />}
            />
            <SummaryBox
              title="Payment Records"
              value={payments.length}
              icon={<WalletCards size={18} />}
            />
          </div>
          <SubscriptionList
            subscriptions={sortedSubscriptions.slice(0, 3)}
            totalSubscriptions={sortedSubscriptions.length}
            formatDate={formatDate}
            formatAmount={formatAmount}
            onViewAll={() => {
              setSubscriptionPage(1);
              setShowSubscriptionHistoryModal(true);
            }}
          />
          <InvoiceTable
            invoices={visibleInvoices}
            totalInvoices={sortedInvoices.length}
            formatDate={formatDate}
            formatAmount={formatAmount}
            payingId={payingId}
            onPay={handlePayInvoice}
            onDownload={handleDownloadInvoice}
            onViewAll={() => {
              setInvoicePage(1);
              setShowInvoicesModal(true);
            }}
          />
          <PaymentTable
            payments={visiblePayments}
            totalPayments={sortedPayments.length}
            formatDate={formatDate}
            formatAmount={formatAmount}
            onDownload={handleDownloadReceipt}
            onViewAll={() => {
              setPaymentPage(1);
              setShowPaymentsModal(true);
            }}
          />
        </>
      )}

      {showPlansModal && (
        <Modal
          title={
            hasRunningSubscription(subscription)
              ? "Branch Add-on Plans"
              : "Available Subscription Plans"
          }
          description={
            hasRunningSubscription(subscription)
              ? "Increase your branch limit without changing your current subscription validity."
              : "Choose a duration-only or complete subscription plan."
          }
          icon={<Crown size={20} />}
          onClose={() => setShowPlansModal(false)}
          maxWidth="max-w-6xl"
        >
          <PlansModalContent
            plans={activePlans}
            subscription={subscription}
            formatAmount={formatAmount}
            buyingPlanId={buyingPlanId}
            onBuy={handleBuyPlan}
          />
        </Modal>
      )}

      {showSubscriptionHistoryModal && (
        <Modal
          title="Subscription History"
          description="Complete subscription plan history for your company."
          icon={<Bookmark size={20} />}
          onClose={() => setShowSubscriptionHistoryModal(false)}
          maxWidth="max-w-6xl"
        >
          <SubscriptionHistoryTable
            subscriptions={paginate(sortedSubscriptions, subscriptionPage)}
            formatDate={formatDate}
            formatAmount={formatAmount}
          />
          <ModalPagination
            page={subscriptionPage}
            totalPages={getTotalPages(sortedSubscriptions)}
            totalRecords={sortedSubscriptions.length}
            setPage={setSubscriptionPage}
          />
        </Modal>
      )}
      {showInvoicesModal && (
        <Modal
          title="All Subscription Invoices"
          description="Complete subscription invoice history for your company."
          icon={<FileText size={20} />}
          onClose={() => setShowInvoicesModal(false)}
          maxWidth="max-w-6xl"
        >
          <InvoiceTable
            invoices={paginate(sortedInvoices, invoicePage)}
            totalInvoices={sortedInvoices.length}
            formatDate={formatDate}
            formatAmount={formatAmount}
            payingId={payingId}
            onPay={handlePayInvoice}
            onDownload={handleDownloadInvoice}
            compact
          />
          <ModalPagination
            page={invoicePage}
            totalPages={getTotalPages(sortedInvoices)}
            totalRecords={sortedInvoices.length}
            setPage={setInvoicePage}
          />
        </Modal>
      )}
      {showPaymentsModal && (
        <Modal
          title="All Payment History"
          description="Complete subscription payment history for your company."
          icon={<WalletCards size={20} />}
          onClose={() => setShowPaymentsModal(false)}
          maxWidth="max-w-6xl"
        >
          <PaymentTable
            payments={paginate(sortedPayments, paymentPage)}
            totalPayments={sortedPayments.length}
            formatDate={formatDate}
            formatAmount={formatAmount}
            onDownload={handleDownloadReceipt}
            compact
          />
          <ModalPagination
            page={paymentPage}
            totalPages={getTotalPages(sortedPayments)}
            totalRecords={sortedPayments.length}
            setPage={setPaymentPage}
          />
        </Modal>
      )}
      {confirmModal && (
        <ConfirmModal
          {...confirmModal}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}
function SubscriptionRecordsTable({ subscriptions, formatDate, formatAmount }) {
  const rows = Array.isArray(subscriptions) ? subscriptions : [];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-sm">
        <thead className="bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
          <tr>
            {[
              "Plan Name",
              "Duration",
              "Amount",
              "Status",
              "Start Date",
              "Valid Till",
              "Features",
            ].map((column) => (
              <th key={column} className="p-4 text-left text-sm font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={7} text="No subscriptions found." />
          ) : (
            rows.map((subscription, index) => {
              const uiStatus = getSubscriptionUiStatus(subscription);
              const freePlan = isFreePlan(subscription);
              const validTill =
                subscription.renewal_date || subscription.trial_end_date;

              return (
                <tr
                  key={subscription.id || index}
                  className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                >
                  <td className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {subscription.plan_name || "-"}
                      </span>
                      {uiStatus === "current" && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Current
                        </span>
                      )}
                      {uiStatus === "previous" && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          Previous
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">
                    {formatPlanDuration(subscription)}
                  </td>
                  <td className="p-4 font-semibold text-slate-900 dark:text-white">
                    {freePlan
                      ? "Free"
                      : `₹ ${formatAmount(subscription.price)}`}
                  </td>
                  <td className="p-4">
                    <StatusBadge status={uiStatus} />
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">
                    {formatDate(subscription.start_date)}
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">
                    {formatDate(validTill)}
                  </td>
                  <td className="max-w-[320px] whitespace-normal break-words p-4 leading-6 text-slate-600 dark:text-slate-300">
                    {String(subscription.features || "").trim() || "-"}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
function SubscriptionHistoryTable({ subscriptions, formatDate, formatAmount }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <SubscriptionRecordsTable
        subscriptions={subscriptions}
        formatDate={formatDate}
        formatAmount={formatAmount}
      />
    </div>
  );
}
function SubscriptionList({
  subscriptions,
  totalSubscriptions,
  formatDate,
  formatAmount,
  onViewAll,
}) {
  const rows = Array.isArray(subscriptions) ? subscriptions : [];
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <SectionHeader
        icon={<Bookmark size={18} />}
        title="Subscription History"
        subtitle="Recent subscription plans assigned to your company."
        buttonText="View All"
        onClick={onViewAll}
      />
      <SubscriptionRecordsTable
        subscriptions={rows}
        formatDate={formatDate}
        formatAmount={formatAmount}
      />
      {totalSubscriptions > rows.length && (
        <div className="border-t border-slate-100 p-3 text-center text-sm font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Showing {rows.length} of {totalSubscriptions} subscriptions
        </div>
      )}
    </div>
  );
}
function PlanDetail({ icon, title, value, subtitle }) {
  return (
    <div className="flex items-center gap-3 px-5 py-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
          {title}
        </p>
        <p className="mt-1 truncate font-semibold text-slate-900 dark:text-white">
          {value}
        </p>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      </div>
    </div>
  );
}
function SubscriptionHero({
  subscription,
  pendingAmount,
  statusClass,
  formatDate,
  formatAmount,
  onManage,
  onToggleAutoRenewal,
}) {
  const freePlan = isFreePlan(subscription);
  const planPrice = freePlan
    ? "₹ 0.00"
    : `₹ ${formatAmount(subscription.price)}`;
  const branchLimit =
    subscription.max_branches !== null &&
    subscription.max_branches !== undefined
      ? subscription.max_branches
      : "-";
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 via-white to-indigo-50 px-5 py-5 dark:border-slate-800 dark:from-blue-950/30 dark:via-slate-900 dark:to-indigo-950/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
              <Crown size={24} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                Current Active Plan
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className="break-words text-xl font-semibold text-slate-900 dark:text-white">
                  {subscription.plan_name || "-"}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-sm font-semibold capitalize ${statusClass}`}
                >
                  {subscription.status || "Unknown"}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-sm font-semibold ${
                    freePlan
                      ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                  }`}
                >
                  {freePlan ? "Free Plan" : "Paid Plan"}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onManage}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Crown size={16} />
            View Plans
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 divide-y divide-slate-200 dark:divide-slate-800 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-5">
        <PlanDetail
          icon={<CreditCard size={18} />}
          title="Plan Price"
          value={planPrice}
          subtitle={
            freePlan ? "Default free subscription" : "Paid subscription"
          }
        />
        <PlanDetail
          icon={<CalendarDays size={18} />}
          title="Start Date"
          value={formatDate(subscription.start_date)}
          subtitle="Plan activated on"
        />
        <PlanDetail
          icon={<RefreshCcw size={18} />}
          title={freePlan ? "Expiry Date" : "Renewal Date"}
          value={formatDate(subscription.renewal_date)}
          subtitle={freePlan ? "Free plan expiry" : "Next billing date"}
        />
        <PlanDetail
          icon={<ShieldCheck size={18} />}
          title="Branch Limit"
          value={`${branchLimit} ${Number(branchLimit) === 1 ? "Branch" : "Branches"}`}
          subtitle="Head Office is included"
        />
        <div className="flex flex-col justify-center gap-2 px-5 py-5">
          <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
            Auto Renewal
          </p>
          {freePlan ? (
            <>
              <div className="flex items-center gap-2">
                <XCircle size={18} className="text-slate-400" />
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  Not Applicable
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Free plans cannot be renewed automatically.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onToggleAutoRenewal}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    Number(subscription.auto_renewal) === 1
                      ? "bg-emerald-500"
                      : "bg-slate-300 dark:bg-slate-700"
                  }`}
                  aria-label="Toggle auto renewal"
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      Number(subscription.auto_renewal) === 1
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {Number(subscription.auto_renewal) === 1
                    ? "Enabled"
                    : "Disabled"}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {Number(subscription.auto_renewal) === 1
                  ? "Plan will renew automatically."
                  : "Manual renewal is required."}
              </p>
            </>
          )}
        </div>
      </div>
      {Number(pendingAmount) > 0 && (
        <div className="flex flex-col gap-3 border-t border-orange-200 bg-orange-50 px-5 py-4 dark:border-orange-900/50 dark:bg-orange-950/30 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
              Outstanding Subscription Amount
            </p>
            <p className="mt-1 text-xl font-semibold text-orange-700 dark:text-orange-300">
              ₹ {formatAmount(pendingAmount)}
            </p>
          </div>
          <p className="text-sm text-orange-700 dark:text-orange-300">
            Complete the pending invoice payment to continue your subscription.
          </p>
        </div>
      )}
    </section>
  );
}
function SummaryBox({ title, value, icon }) {
  const tone =
    title === "Total Paid"
      ? "border-emerald-200 from-emerald-50 dark:border-emerald-900 dark:from-emerald-950/40"
      : title === "Payment Records"
        ? "border-violet-200 from-violet-50 dark:border-violet-900 dark:from-violet-950/40"
        : "border-blue-200 from-blue-50 dark:border-blue-900 dark:from-blue-950/40";
  const iconColor =
    title === "Total Paid"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : title === "Payment Records"
        ? "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
        : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";
  return (
    <div
      className={`flex min-w-0 items-center gap-3 rounded-xl border bg-gradient-to-br to-white px-4 py-3 shadow-sm dark:to-slate-900 ${tone}`}
    >
      <span className={`shrink-0 rounded-lg p-2.5 ${iconColor}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
        <h3 className="mt-1 break-words text-2xl font-semibold leading-tight text-slate-900 dark:text-white">
          {value}
        </h3>
      </div>
    </div>
  );
}

function PlansModalContent({
  plans,
  subscription,
  formatAmount,
  buyingPlanId,
  onBuy,
}) {
  const runningSubscription = hasRunningSubscription(subscription);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {plans.length === 0 ? (
        <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-800">
          <Crown
            className="mx-auto text-slate-400 dark:text-slate-500"
            size={30}
          />

          <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            {runningSubscription
              ? "No branch add-on plans available"
              : "No subscription plans available"}
          </p>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {runningSubscription
              ? "Your current subscription will continue without any changes."
              : "Please contact support for subscription assistance."}
          </p>
        </div>
      ) : (
        plans.map((plan) => {
          const freePlan = isFreePlan(plan);
          const planCategory = getPlanCategory(plan);
          const branchAddon = planCategory === "branch_addon";

          const planBranches = Number(plan.max_branches ?? 0);

          return (
            <div
              key={plan.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 break-words text-base font-semibold text-slate-900 dark:text-white">
                  {plan.plan_name}
                </h3>

                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    branchAddon
                      ? "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"
                      : planCategory === "duration_only"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                  }`}
                >
                  {branchAddon
                    ? "Branch Add-on"
                    : planCategory === "duration_only"
                      ? "Duration Plan"
                      : "Complete Plan"}
                </span>
              </div>

              <div className="mt-3">
                {freePlan ? (
                  <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                    Free
                  </span>
                ) : (
                  <>
                    <span className="text-lg font-semibold text-slate-900 dark:text-white">
                      ₹ {formatAmount(plan.price)}
                    </span>

                    <span className="ml-1 text-sm text-slate-500 dark:text-slate-400">
                      {branchAddon
                        ? "/ one-time add-on"
                        : `/ ${formatPlanDuration(plan)}`}
                    </span>
                  </>
                )}
              </div>

              <div className="mt-3 flex items-center divide-x divide-slate-200 rounded-lg border border-slate-200 bg-slate-50 py-2 dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
                <div className="min-w-0 flex-1 px-2.5">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Validity
                  </p>

                  <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {branchAddon ? "No change" : formatPlanDuration(plan)}
                  </p>
                </div>

                <div className="min-w-0 flex-1 px-2.5">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Branches Added
                  </p>

                  <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {planBranches}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex-1 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                  Features
                </p>

                <p className="mt-0.5 line-clamp-2 text-sm leading-5 text-slate-600 dark:text-slate-300">
                  {plan.features || "No features added"}
                </p>
              </div>

              {freePlan ? (
                <button
                  type="button"
                  disabled
                  className="mt-3 inline-flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  <Crown size={14} />
                  Default Free Plan
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onBuy(plan)}
                  disabled={buyingPlanId === plan.id}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send size={14} />

                  {buyingPlanId === plan.id
                    ? "Processing..."
                    : branchAddon
                      ? "Add Branches"
                      : "Buy Plan"}
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function InvoiceTable({
  invoices,
  totalInvoices,
  formatDate,
  formatAmount,
  payingId,
  onPay,
  onDownload,
  onViewAll,
  compact = false,
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ${
        compact ? "" : "shadow-sm"
      }`}
    >
      {!compact && (
        <SectionHeader
          icon={<FileText size={18} />}
          title="Subscription Invoices"
          subtitle="Recent generated subscription invoices."
          buttonText="View All"
          onClick={onViewAll}
        />
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
            <tr>
              {[
                "Invoice No.",
                "Invoice Date",
                "Due Date",
                "Amount",
                "Status",
                "Action",
              ].map((column) => (
                <th key={column} className="p-4 text-left text-sm font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <EmptyRow colSpan={6} text="No subscription invoices found." />
            ) : (
              invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <td className="p-4 font-semibold text-slate-900 dark:text-white">
                    {invoice.invoice_number || "-"}
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">
                    {formatDate(invoice.invoice_date)}
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">
                    {formatDate(invoice.due_date)}
                  </td>
                  <td className="p-4 font-semibold text-slate-900 dark:text-white">
                    ₹ {formatAmount(invoice.amount)}
                  </td>
                  <td className="p-4">
                    <StatusBadge
                      status={invoice.invoice_status || "generated"}
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onDownload(invoice.id, invoice.invoice_number)
                        }
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                      >
                        <Download size={14} />
                        Download
                      </button>
                      {invoice.invoice_status !== "paid" && (
                        <button
                          type="button"
                          onClick={() => onPay(invoice.id)}
                          disabled={payingId === invoice.id}
                          className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:bg-orange-400"
                        >
                          <CreditCard size={14} />
                          {payingId === invoice.id ? "Paying..." : "Pay Now"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!compact && totalInvoices > invoices.length && (
        <div className="border-t border-slate-100 dark:border-slate-800 p-3 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
          Showing {invoices.length} of {totalInvoices} invoices
        </div>
      )}
    </div>
  );
}
function PaymentTable({
  payments,
  totalPayments,
  formatDate,
  formatAmount,
  onDownload,
  onViewAll,
  compact = false,
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ${
        compact ? "" : "shadow-sm"
      }`}
    >
      {!compact && (
        <SectionHeader
          icon={<WalletCards size={18} />}
          title="Payment History"
          subtitle="Recent subscription payments made by your company."
          buttonText="View All"
          onClick={onViewAll}
          green
        />
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
            <tr>
              {[
                "Payment Date",
                "Amount",
                "Payment Method",
                "Transaction ID",
                "Invoice No.",
                "Status",
                "Receipt",
              ].map((column) => (
                <th key={column} className="p-4 text-left text-sm font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <EmptyRow colSpan={7} text="No subscriptions found." />
            ) : (
              payments.map((payment) => (
                <tr
                  key={payment.id}
                  className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <td className="p-4 text-slate-600 dark:text-slate-300">
                    {formatDate(payment.payment_date)}
                  </td>
                  <td className="p-4 font-semibold text-slate-900 dark:text-white">
                    ₹ {formatAmount(payment.amount)}
                  </td>
                  <td className="p-4 capitalize text-slate-600 dark:text-slate-300">
                    <span className="inline-flex items-center gap-2">
                      <CreditCard
                        size={15}
                        className="text-purple-600 dark:text-purple-300"
                      />
                      {payment.payment_method || "-"}
                    </span>
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">
                    {payment.transaction_id || "-"}
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">
                    {payment.invoice_number || "-"}
                  </td>
                  <td className="p-4">
                    <StatusBadge status={payment.payment_status || "-"} />
                  </td>
                  <td className="p-4">
                    <button
                      type="button"
                      onClick={() => onDownload(payment.id)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                    >
                      <Download size={14} />
                      Download
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!compact && totalPayments > payments.length && (
        <div className="border-t border-slate-100 dark:border-slate-800 p-3 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
          Showing {payments.length} of {totalPayments} payments
        </div>
      )}
    </div>
  );
}
function SectionHeader({
  icon,
  title,
  subtitle,
  buttonText,
  onClick,
  green = false,
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div
          className={`rounded-xl p-2.5 ${
            green
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300"
              : "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
          }`}
        >
          {icon}
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        </div>
      </div>
      {buttonText && onClick && (
        <button
          type="button"
          onClick={onClick}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
        >
          {buttonText}
          <ArrowUpRight size={15} />
        </button>
      )}
    </div>
  );
}
function Modal({ title, description, icon, onClose, children, maxWidth }) {
  return createPortal(
    <div className="fixed inset-0 z-[50000] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl outline-none ring-0 dark:border-slate-700 dark:bg-slate-900 ${
          maxWidth || "max-w-4xl"
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-2.5 text-blue-600 dark:text-blue-400">
              {icon}
            </div>
            <div>
              <p className="mb-1 text-sm text-slate-500 dark:text-slate-400">
                Billing Workspace
              </p>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
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
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition-all duration-200 hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white p-4 sm:p-6 dark:bg-slate-900">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function EmptySubscription({ onManage }) {
  return (
    <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50 dark:bg-blue-950/40 p-10 text-center shadow-sm">
      <ShieldCheck size={46} className="mx-auto mb-3 text-blue-400" />
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
        No Active Subscription
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Choose a subscription plan to generate invoice and activate billing.
      </p>
      <button
        type="button"
        onClick={onManage}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        <Crown size={16} />
        View Plans
      </button>
    </div>
  );
}

function EmptyRow({ colSpan, text }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-10 text-center">
        <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-6">
          <Download
            className="mx-auto text-slate-400 dark:text-slate-500"
            size={34}
          />
          <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
            {text}
          </p>
        </div>
      </td>
    </tr>
  );
}

function ModalPagination({ page, totalPages, totalRecords, setPage }) {
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 dark:border-slate-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
        Total Records: {totalRecords}
      </p>
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Prev
        </button>
        <span className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          Page {page} of {totalPages || 1}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function ConfirmModal({
  type = "warning",
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}) {
  const config = {
    warning: {
      icon: <Clock size={24} />,
      box: "bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300",
      button: "bg-orange-600 hover:bg-orange-700",
    },
    success: {
      icon: <CheckCircle2 size={24} />,
      box: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
      button: "bg-emerald-600 hover:bg-emerald-700",
    },
    danger: {
      icon: <XCircle size={24} />,
      box: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
      button: "bg-red-600 hover:bg-red-700",
    },
    info: {
      icon: <ShieldCheck size={24} />,
      box: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
      button: "bg-blue-600 hover:bg-blue-700",
    },
  };
  const active = config[type] || config.warning;
  return createPortal(
    <div className="fixed inset-0 z-[60000] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90dvh] overflow-y-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-start gap-4">
          <div className={`rounded-2xl p-3 ${active.box}`}>{active.icon}</div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {message}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X size={16} />
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white ${active.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function StatusBadge({ status }) {
  const value = String(status || "").toLowerCase();
  const styles = {
    current:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    previous:
      "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
    active:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    trial:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300",
    paid: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    completed:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    approved:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    generated:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300",
    pending:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300",
    pending_payment:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300",
    expired:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
    failed:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
    rejected:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
    inactive:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
    cancelled:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  };
  const icons = {
    current: <CheckCircle2 size={12} />,
    active: <CheckCircle2 size={12} />,
    paid: <CheckCircle2 size={12} />,
    success: <CheckCircle2 size={12} />,
    completed: <CheckCircle2 size={12} />,
    approved: <CheckCircle2 size={12} />,
    failed: <XCircle size={12} />,
    rejected: <XCircle size={12} />,
    expired: <XCircle size={12} />,
    pending: <Clock size={12} />,
    pending_payment: <Clock size={12} />,
    generated: <Clock size={12} />,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm font-semibold capitalize shadow-sm ${
        styles[value] || styles.inactive
      }`}
    >
      {icons[value]}
      {value ? value.replaceAll("_", " ") : "-"}
    </span>
  );
}
export default BillingSubscription;
