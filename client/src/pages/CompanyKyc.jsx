import { useEffect, useMemo, useRef, useState } from "react";

import api from "../services/api";

import toast from "react-hot-toast";

import {
  ShieldCheck,
  Search,
  Eye,
  RefreshCcw,
  Loader2,
  Building2,
  User,
  Clock,
  Ban,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";

const STATUS_OPTIONS = [
  "all",

  "pending",

  "submitted",

  "approved",

  "manual_verified",

  "rejected",

  "blocked",
];

const PAGE_SIZE = 10;

function CompanyKyc() {
  const [requests, setRequests] = useState([]);

  const [status, setStatus] = useState("all");

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);

  const [selectedCompanyId, setSelectedCompanyId] = useState(null);

  const [details, setDetails] = useState(null);

  const [detailLoading, setDetailLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);

  const [actionLoading, setActionLoading] = useState("");

  const [showKycDetailsModal, setShowKycDetailsModal] = useState(false);

  const [kycForm, setKycForm] = useState({
    pan_number: "",

    gst_number: "",

    tan_number: "",
  });

  const [kycFiles, setKycFiles] = useState({
    aadhaar_card: null,

    pan_card: null,

    gst_certificate: null,

    tan_document: null,
  });

  const statusOptions = STATUS_OPTIONS.map((item) => ({
    value: item,

    label: item === "all" ? "All Status" : formatLabel(item),
  }));

  const fetchRequests = async () => {
    try {
      setLoading(true);

      const res = await api.get("/kyc/requests", {
        params: { status },
      });

      setRequests(res.data || []);

      setPage(1);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to fetch KYC requests",
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchDetails = async (companyId) => {
    try {
      setSelectedCompanyId(companyId);

      setShowModal(true);

      setDetailLoading(true);

      const res = await api.get(`/kyc/requests/${companyId}`);

      setDetails(res.data);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to fetch KYC details",
      );
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [status]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const filteredRequests = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return requests.filter((item) => {
      if (!keyword) return true;

      return (
        item.company_name?.toLowerCase().includes(keyword) ||
        item.company_email?.toLowerCase().includes(keyword) ||
        item.admin_name?.toLowerCase().includes(keyword) ||
        item.admin_email?.toLowerCase().includes(keyword)
      );
    });
  }, [requests, search]);

  const totalPages = Math.max(
    1,

    Math.ceil(filteredRequests.length / PAGE_SIZE),
  );

  const paginatedRequests = filteredRequests.slice(
    (page - 1) * PAGE_SIZE,

    page * PAGE_SIZE,
  );

  const refreshSelected = async () => {
    await fetchRequests();

    if (selectedCompanyId) {
      await fetchDetails(selectedCompanyId);
    }
  };

  const closeModal = () => {
    setShowModal(false);

    setSelectedCompanyId(null);

    setDetails(null);

    setActionLoading("");
  };

  const resetKycFiles = () => {
    setKycFiles({
      aadhaar_card: null,

      pan_card: null,

      gst_certificate: null,

      tan_document: null,
    });
  };

  const openKycDetails = () => {
    if (!company || !selectedCompanyId) return;

    setKycForm({
      pan_number: company.pan_number || "",

      gst_number: company.gst_number || "",

      tan_number: company.tan_number || "",
    });

    resetKycFiles();

    setShowKycDetailsModal(true);
  };

  const closeKycDetails = () => {
    if (actionLoading === "kyc_details") return;

    setShowKycDetailsModal(false);

    resetKycFiles();
  };

  const handleKycInputChange = (event) => {
    const { name, value } = event.target;

    setKycForm((prev) => ({
      ...prev,

      [name]: value.toUpperCase(),
    }));
  };

  const handleKycFileChange = (event) => {
    const { name, files } = event.target;

    const file = files?.[0] || null;

    if (!file) {
      setKycFiles((prev) => ({
        ...prev,

        [name]: null,
      }));

      return;
    }

    const allowedTypes = [
      "application/pdf",

      "image/jpeg",

      "image/jpg",

      "image/png",

      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error("Only PDF, JPG, PNG and WEBP files are allowed");

      event.target.value = "";

      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size cannot exceed 5 MB");

      event.target.value = "";

      return;
    }

    setKycFiles((prev) => ({
      ...prev,

      [name]: file,
    }));
  };

  const submitKycDetails = async () => {
    if (!selectedCompanyId || !company) return;

    const panNumber = kycForm.pan_number.trim().toUpperCase();

    const gstNumber = kycForm.gst_number.trim().toUpperCase();

    const tanNumber = kycForm.tan_number.trim().toUpperCase();

    if (panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber)) {
      toast.error("Invalid PAN number format");

      return;
    }

    if (
      gstNumber &&
      !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstNumber)
    ) {
      toast.error("Invalid GST number format");

      return;
    }

    if (tanNumber && !/^[A-Z]{4}[0-9]{5}[A-Z]$/.test(tanNumber)) {
      toast.error("Invalid TAN number format");

      return;
    }

    const currentPan = String(company.pan_number || "")
      .trim()

      .toUpperCase();

    const currentGst = String(company.gst_number || "")
      .trim()

      .toUpperCase();

    const currentTan = String(company.tan_number || "")
      .trim()

      .toUpperCase();

    const panChanged = panNumber !== currentPan;

    const gstChanged = gstNumber !== currentGst;

    const tanChanged = tanNumber !== currentTan;

    const hasFile = Object.values(kycFiles).some(Boolean);

    if (!panChanged && !gstChanged && !tanChanged && !hasFile) {
      toast.error("Please change a KYC detail or upload a document");

      return;
    }

    try {
      setActionLoading("kyc_details");

      const formData = new FormData();

      if (panChanged && panNumber) {
        formData.append("pan_number", panNumber);
      }

      if (gstChanged && gstNumber) {
        formData.append("gst_number", gstNumber);
      }

      if (tanChanged && tanNumber) {
        formData.append("tan_number", tanNumber);
      }

      Object.entries(kycFiles).forEach(([key, file]) => {
        if (file) {
          formData.append(key, file);
        }
      });

      const res = await api.patch(
        `/kyc/superadmin/${selectedCompanyId}/kyc-details`,

        formData,
      );

      toast.success(res.data?.message || "KYC details saved successfully");

      setShowKycDetailsModal(false);

      resetKycFiles();

      await refreshSelected();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to save KYC details",
      );
    } finally {
      setActionLoading("");
    }
  };

  const unblockCompany = async () => {
    if (!selectedCompanyId) return;

    try {
      setActionLoading("unblock");

      await api.patch(`/kyc/superadmin/${selectedCompanyId}/unblock`);

      toast.success("Company unblocked");

      await refreshSelected();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to unblock company");
    } finally {
      setActionLoading("");
    }
  };

  const company = details?.company || null;

  const documents = details?.documents || [];

  const logs = details?.logs || [];

  const currentKycStatus = String(company?.kyc_status || "").toLowerCase();

  const canManageKyc = Boolean(company);

  const canUnblock = currentKycStatus === "blocked";

  return (
    <div className="w-full min-w-0 space-y-5 overflow-x-hidden text-slate-900 dark:text-slate-100">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700">
              <ShieldCheck size={17} />
              SuperAdmin
            </div>

            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Company KYC
            </h1>

            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              Review KYC requests, documents, failed attempts and company KYC
              details.
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                KYC Requests
              </h2>

              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                Review company KYC requests and verification status.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search company/admin"
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:ring-blue-950/50 sm:w-64"
                />
              </div>

              <div className="w-full sm:w-48">
                <CustomSelect
                  value={status}
                  onChange={setStatus}
                  options={statusOptions}
                  placeholder="All Status"
                  searchable
                />
              </div>

              <button
                type="button"
                onClick={fetchRequests}
                disabled={loading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <RefreshCcw size={15} />
                )}
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <TableHead title="Company" />

                <TableHead title="Admin" />

                <TableHead title="Status" />

                <TableHead title="Attempts" />

                <TableHead title="Docs" />

                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  View
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-10 text-center">
                    <Loader2 className="mx-auto animate-spin text-blue-600" />
                  </td>
                </tr>
              ) : paginatedRequests.length > 0 ? (
                paginatedRequests.map((item) => (
                  <tr
                    key={item.company_id}
                    className="border-t border-slate-100 align-top transition hover:bg-blue-50/40 dark:border-slate-800 dark:hover:bg-slate-800"
                  >
                    <td className="p-4">
                      <div className="flex items-start gap-2">
                        <div className="rounded-xl bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                          <Building2 size={15} />
                        </div>

                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {item.company_name || "-"}
                          </p>

                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {item.company_email || "-"}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="flex items-start gap-2">
                        <div className="rounded-xl bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          <User size={15} />
                        </div>

                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {item.admin_name || "-"}
                          </p>

                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {item.admin_email || "-"}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="whitespace-nowrap p-4">
                      <StatusBadge status={item.kyc_status} />
                    </td>

                    <td className="whitespace-nowrap p-4">
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {item.kyc_attempts || 0}
                      </span>
                    </td>

                    <td className="whitespace-nowrap p-4">
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {item.document_count || 0}
                      </span>
                    </td>

                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={() => fetchDetails(item.company_id)}
                        className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
                      >
                        <Eye size={14} />
                        View
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="p-10 text-center">
                    <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800">
                      <ShieldCheck
                        className="mx-auto text-slate-400 dark:text-slate-500"
                        size={34}
                      />

                      <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">
                        No KYC requests found
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

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Showing{" "}
            <span className="text-slate-900 dark:text-white">
              {filteredRequests.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
            </span>{" "}
            to{" "}
            <span className="text-slate-900 dark:text-white">
              {Math.min(page * PAGE_SIZE, filteredRequests.length)}
            </span>{" "}
            of{" "}
            <span className="text-slate-900 dark:text-white">
              {filteredRequests.length}
            </span>
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ChevronLeft size={16} className="inline" /> Previous
            </button>

            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Next <ChevronRight size={16} className="inline" />
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <KycDetailModal
          company={company}
          documents={documents}
          logs={logs}
          detailLoading={detailLoading}
          actionLoading={actionLoading}
          canManageKyc={canManageKyc}
          canUnblock={canUnblock}
          openKycDetails={openKycDetails}
          unblockCompany={unblockCompany}
          closeModal={closeModal}
        />
      )}

      {showKycDetailsModal && (
        <KycDetailsModal
          company={company}
          form={kycForm}
          files={kycFiles}
          loading={actionLoading === "kyc_details"}
          onInputChange={handleKycInputChange}
          onFileChange={handleKycFileChange}
          onClose={closeKycDetails}
          onSubmit={submitKycDetails}
        />
      )}
    </div>
  );
}

function KycDetailModal({
  company,

  documents,

  logs,

  detailLoading,

  actionLoading,

  canManageKyc,

  canUnblock,

  openKycDetails,

  unblockCompany,

  closeModal,
}) {
  return (
    <div className="fixed inset-0 z-[60000] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.45)] dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              <ShieldCheck size={26} />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                KYC Details
              </h2>

              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                Company documents, verification logs and available actions.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto overflow-x-hidden p-5">
          {detailLoading ? (
            <div className="flex min-h-[420px] items-center justify-center">
              <Loader2 className="animate-spin text-blue-600" size={34} />
            </div>
          ) : company ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                      {company.name || "-"}
                    </h3>

                    <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                      {company.email || "-"}
                    </p>
                  </div>

                  <StatusBadge status={company.kyc_status} />
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <InfoBox
                    icon={<Building2 size={16} />}
                    label="Company Status"
                    value={company.status}
                  />

                  <InfoBox
                    icon={<User size={16} />}
                    label="Admin"
                    value={company.admin_name || "-"}
                  />

                  <InfoBox
                    icon={<Clock size={16} />}
                    label="Attempts"
                    value={company.kyc_attempts || 0}
                  />

                  <InfoBox
                    icon={<ShieldCheck size={16} />}
                    label="Verified At"
                    value={formatDate(company.kyc_verified_at)}
                  />
                </div>

                {company.kyc_rejection_reason && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                    Reason: {company.kyc_rejection_reason}
                  </div>
                )}
              </div>

              <SectionCard title="KYC Profile Details">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <InfoBox
                    icon={<FileText size={16} />}
                    label="PAN Number"
                    value={company.pan_number || "-"}
                  />

                  <InfoBox
                    icon={<FileText size={16} />}
                    label="GST Number"
                    value={company.gst_number || "-"}
                  />

                  <InfoBox
                    icon={<FileText size={16} />}
                    label="TAN Number"
                    value={company.tan_number || "-"}
                  />

                  <InfoBox
                    icon={<ShieldCheck size={16} />}
                    label="Aadhaar"
                    value={
                      Number(company.aadhaar_verified || 0) === 1
                        ? "Verified"
                        : "Not verified"
                    }
                  />
                </div>
              </SectionCard>

              <SectionCard title="Documents">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {documents.length > 0 ? (
                    documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                            {formatLabel(doc.document_type)}
                          </p>

                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {formatLabel(doc.uploaded_by_role)} ·{" "}
                            {formatDate(doc.created_at)}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <StatusBadge status={doc.verification_status} />

                          {doc.document_path && (
                            <a
                              href={`http://localhost:5000${doc.document_path}`}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
                            >
                              View
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center dark:border-slate-700 dark:bg-slate-800 md:col-span-2">
                      <FileText
                        className="mx-auto text-slate-400 dark:text-slate-500"
                        size={30}
                      />

                      <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        No documents uploaded
                      </p>
                    </div>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Actions">
                <div className="flex flex-wrap gap-2">
                  {canManageKyc && (
                    <button
                      type="button"
                      onClick={openKycDetails}
                      disabled={Boolean(actionLoading)}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FileText size={16} />
                      Add / Update KYC Details
                    </button>
                  )}

                  {canUnblock && (
                    <button
                      type="button"
                      onClick={unblockCompany}
                      disabled={Boolean(actionLoading)}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:hover:bg-slate-700"
                    >
                      {actionLoading === "unblock" ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Ban size={16} />
                      )}
                      Unblock & Reset Attempt
                    </button>
                  )}

                  {!canManageKyc && !canUnblock && (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                      No actions available for this KYC status.
                    </p>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Verification Logs">
                <div className="space-y-3">
                  {logs.length > 0 ? (
                    logs.map((log, index) => (
                      <div
                        key={log.id}
                        className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-blue-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-600"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            <ShieldCheck size={18} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                {formatLabel(log.action)}
                              </h4>

                              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                #{index + 1}
                              </span>
                            </div>

                            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                              {log.remarks || "No remarks available"}
                            </p>

                            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 dark:bg-slate-900">
                                <User size={13} />

                                {formatLabel(log.performed_role)}
                              </span>

                              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 dark:bg-slate-900">
                                <Clock size={13} />

                                {formatDate(log.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-800">
                      <Clock
                        size={34}
                        className="mb-3 text-slate-400 dark:text-slate-500"
                      />

                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        No Verification Logs
                      </h4>

                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Verification activity will appear here once any KYC
                        action is performed.
                      </p>
                    </div>
                  )}
                </div>
              </SectionCard>
            </div>
          ) : (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              No company details found.
            </p>
          )}
        </div>
      </div>
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

  const [dropdownStyle, setDropdownStyle] = useState(null);

  const buttonRef = useRef(null);

  const dropdownRef = useRef(null);

  const selected = options.find(
    (option) => String(option.value) === String(value),
  );

  const filteredOptions = options.filter((option) =>
    `${option.label || ""}`.toLowerCase().includes(selectSearch.toLowerCase()),
  );

  const updateDropdownPosition = () => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();

    const viewportWidth = window.innerWidth;

    const viewportHeight = window.innerHeight;

    const dropdownHeight = searchable
      ? 300
      : Math.min(options.length * 46 + 20, 260);

    const dropdownWidth = Math.max(rect.width, 210);

    const left = Math.min(
      Math.max(12, rect.left),

      viewportWidth - dropdownWidth - 12,
    );

    const spaceBelow = viewportHeight - rect.bottom;

    const spaceAbove = rect.top;

    const openUp = spaceBelow < dropdownHeight + 12 && spaceAbove > spaceBelow;

    const top = openUp
      ? Math.max(12, rect.top - dropdownHeight - 8)
      : Math.min(rect.bottom + 8, viewportHeight - dropdownHeight - 12);

    setDropdownStyle({
      position: "fixed",

      left: `${left}px`,

      top: `${top}px`,

      width: `${dropdownWidth}px`,

      maxHeight: `${dropdownHeight}px`,

      zIndex: 99999,
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

      setSelectSearch("");
    };

    const handleWindowMove = (event) => {
      if (dropdownRef.current?.contains(event.target)) return;

      updateDropdownPosition();
    };

    document.addEventListener("mousedown", handleClickOutside);

    window.addEventListener("resize", updateDropdownPosition);

    window.addEventListener("scroll", handleWindowMove, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);

      window.removeEventListener("resize", updateDropdownPosition);

      window.removeEventListener("scroll", handleWindowMove, true);
    };
  }, [open, options.length, searchable]);

  const handleSelect = (selectedValue) => {
    onChange(selectedValue);

    setOpen(false);

    setSelectSearch("");
  };

  return (
    <div className="relative min-w-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);

          window.requestAnimationFrame(updateDropdownPosition);
        }}
        className="flex h-10 w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 text-left text-sm font-semibold text-slate-700 shadow-sm outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:focus:ring-blue-950/50"
      >
        <span className="min-w-0 truncate">
          {selected?.label || placeholder}
        </span>

        <ChevronDown
          size={17}
          className={`shrink-0 text-slate-400 transition dark:text-slate-500 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && dropdownStyle && (
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
                  onChange={(event) => setSelectSearch(event.target.value)}
                  placeholder="Search..."
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:bg-slate-900 dark:focus:ring-blue-950/50"
                />
              </div>
            </div>
          )}

          <div className="max-h-56 overflow-y-auto p-2">
            {filteredOptions.map((option) => {
              const active = String(option.value) === String(value);

              return (
                <button
                  key={option.value || "all"}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full rounded-xl px-3 py-2 text-left transition ${
                    active
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                      : "text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-blue-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="truncate text-sm font-semibold">
                      {option.label}
                    </p>

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
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
          {title}
        </h3>
      </div>

      <div className="min-w-0">{children}</div>
    </section>
  );
}

function InfoBox({ icon, label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {icon}

        {label}
      </div>

      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
        {value || "-"}
      </p>
    </div>
  );
}

function TableHead({ title }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {title}
    </th>
  );
}

function StatusBadge({ status }) {
  const value = String(status || "").toLowerCase();

  const map = {
    approved:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",

    manual_verified:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300",

    verified:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",

    pending:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",

    submitted:
      "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300",

    rejected:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",

    blocked:
      "border-red-200 bg-red-100 text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300",

    inactive:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold capitalize shadow-sm ${
        map[value] ||
        "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      }`}
    >
      {formatLabel(status)}
    </span>
  );
}

function formatLabel(value) {
  if (!value) return "-";

  return String(value)
    .toLowerCase()

    .replaceAll("_", " ")

    .split(" ")

    .filter(Boolean)

    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))

    .join(" ");
}

function formatDate(value) {
  if (!value) return "-";

  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",

    month: "short",

    year: "numeric",

    hour: "2-digit",

    minute: "2-digit",
  });
}

function KycDetailsModal({
  company,

  form,

  files,

  loading,

  onInputChange,

  onFileChange,

  onClose,

  onSubmit,
}) {
  return (
    <div className="fixed inset-0 z-[70000] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-800">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <FileText size={21} />
            </div>

            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Add / Update KYC Details
              </h2>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Add or update KYC numbers and upload supporting documents for
                this company.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close KYC details modal"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white">
                  {company?.name || "-"}
                </p>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {["approved", "manual_verified"].includes(
                    String(company?.kyc_status || "").toLowerCase(),
                  )
                    ? "Existing KYC status will remain unchanged after this update."
                    : "Saving these details will complete SuperAdmin KYC verification."}
                </p>
              </div>

              <StatusBadge status={company?.kyc_status} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KycTextInput
              label="PAN Number"
              name="pan_number"
              value={form.pan_number}
              placeholder="ABCDE1234F"
              maxLength={10}
              disabled={loading}
              onChange={onInputChange}
            />

            <KycTextInput
              label="GST Number"
              name="gst_number"
              value={form.gst_number}
              placeholder="09ABCDE1234F1Z5"
              maxLength={15}
              disabled={loading}
              onChange={onInputChange}
            />

            <KycTextInput
              label="TAN Number"
              name="tan_number"
              value={form.tan_number}
              placeholder="DELA12345B"
              maxLength={10}
              disabled={loading}
              onChange={onInputChange}
            />
          </div>

          <div className="my-5 border-t border-slate-200 dark:border-slate-800" />

          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Supporting Documents
            </h3>

            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Upload the supporting documents available for this company.
              Existing documents are kept in KYC history.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <KycDocumentInput
              label="Aadhaar Card"
              name="aadhaar_card"
              file={files.aadhaar_card}
              disabled={loading}
              onChange={onFileChange}
            />

            <KycDocumentInput
              label="PAN Card"
              name="pan_card"
              file={files.pan_card}
              disabled={loading}
              onChange={onFileChange}
            />

            <KycDocumentInput
              label="GST Certificate"
              name="gst_certificate"
              file={files.gst_certificate}
              disabled={loading}
              onChange={onFileChange}
            />

            <KycDocumentInput
              label="TAN Document"
              name="tan_document"
              file={files.tan_document}
              disabled={loading}
              onChange={onFileChange}
            />
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Supported formats: PDF, JPG, PNG and WEBP. Maximum file size: 5 MB
            per document.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                Save KYC Details
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function KycTextInput({
  label,

  name,

  value,

  placeholder,

  maxLength,

  disabled,

  onChange,
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </span>

      <input
        type="text"
        name={name}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        onChange={onChange}
        autoComplete="off"
        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold uppercase text-slate-800 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-blue-950/50"
      />
    </label>
  );
}

function KycDocumentInput({
  label,

  name,

  file,

  required = false,

  disabled = false,

  onChange,
}) {
  return (
    <label className="block min-w-0">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {label}
        </span>

        {required ? (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:bg-red-950/40 dark:text-red-300">
            Required
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            Optional
          </span>
        )}
      </div>

      <div
        className={`rounded-xl border border-dashed p-4 transition ${
          file
            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20"
            : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-700 dark:hover:bg-blue-950/20"
        }`}
      >
        <input
          type="file"
          name={name}
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          disabled={disabled}
          onChange={onChange}
          className="block w-full cursor-pointer text-xs font-medium text-slate-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700 disabled:cursor-not-allowed dark:text-slate-400 dark:file:bg-slate-900 dark:file:text-slate-200"
        />

        <div className="mt-3 flex min-w-0 items-center gap-2">
          {file ? (
            <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
          ) : (
            <FileText size={15} className="shrink-0 text-slate-400" />
          )}

          <p
            className={`truncate text-xs font-medium ${
              file ? "text-emerald-700 dark:text-emerald-300" : "text-slate-400"
            }`}
          >
            {file?.name || "Choose document"}
          </p>
        </div>
      </div>
    </label>
  );
}

export default CompanyKyc;
