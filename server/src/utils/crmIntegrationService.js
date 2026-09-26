const getCrmBaseUrl = () => {
  const crmBaseUrl = String(process.env.CRM_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");

  if (!crmBaseUrl) {
    throw new Error("CRM_BASE_URL is not configured");
  }

  return crmBaseUrl;
};

/* =====================================================
   CUSTOMER SYNC
===================================================== */

export const syncCustomerToCrm = async ({ apiKey, customer }) => {
  if (!apiKey) {
    const error = new Error(
      "Please contact support team to enable CRM integration",
    );

    error.code = "CRM_NOT_CONFIGURED";
    error.statusCode = 400;

    throw error;
  }

  if (!customer?.id) {
    const error = new Error("Customer id is required for CRM sync");

    error.code = "CUSTOMER_ID_MISSING";
    error.statusCode = 400;

    throw error;
  }

  const customerName = String(customer.customer_name || "").trim();

  const companyName = String(customer.company_name || "").trim();

  const email = String(customer.email || "").trim();

  if (!customerName && !companyName) {
    const error = new Error(
      "Customer name or company name is required for CRM sync",
    );

    error.code = "CUSTOMER_NAME_OR_COMPANY_MISSING";
    error.statusCode = 400;

    throw error;
  }
  
  if (!email) {
    const error = new Error("Customer email is required for CRM sync");

    error.code = "CUSTOMER_EMAIL_MISSING";
    error.statusCode = 400;

    throw error;
  }

  const payload = {
    externalCustomerId: String(customer.id),
    customerName,
    companyName,
    email,
  };

  const url =
    `${getCrmBaseUrl()}` + "/api/v1/integrations/commercial/customers/sync";

  console.log("CRM CUSTOMER SYNC REQUEST:", {
    url,
    payload,
  });

  let response;

  try {
    response = await fetch(url, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },

      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("CRM CUSTOMER FETCH ERROR:", {
      url,
      message: error.message,
      cause: error.cause?.message,
      code: error.cause?.code,
      hostname: error.cause?.hostname,
    });

    const crmError = new Error("Unable to connect to CRM server");

    crmError.statusCode = 502;
    crmError.code = error.cause?.code || "CRM_CONNECTION_FAILED";

    throw crmError;
  }

  const rawResponse = await response.text();

  let data = null;

  if (rawResponse) {
    try {
      data = JSON.parse(rawResponse);
    } catch {
      data = null;
    }
  }

  console.log("CRM CUSTOMER SYNC HTTP RESPONSE:", {
    status: response.status,
    statusText: response.statusText,
    contentType: response.headers.get("content-type"),
    body: rawResponse,
  });

  if (!response.ok) {
    const error = new Error(
      data?.error?.message ||
        data?.message ||
        rawResponse ||
        "Customer CRM sync failed",
    );

    error.statusCode = response.status;

    error.code = data?.error?.code || data?.code || "CRM_CUSTOMER_SYNC_FAILED";

    error.crmResponse = data || rawResponse || null;

    throw error;
  }

  if (data?.success === false) {
    const error = new Error(
      data?.error?.message || data?.message || "Customer CRM sync failed",
    );

    error.statusCode = 400;

    error.code = data?.error?.code || data?.code || "CRM_CUSTOMER_SYNC_FAILED";

    error.crmResponse = data;

    throw error;
  }

  return data;
};

/* =====================================================
   DOCUMENT SYNC
===================================================== */

export const syncDocumentToCrm = async ({
  apiKey,
  externalType,
  externalId,
  externalCustomerId,
  pdfUrl,
}) => {
  if (!apiKey) {
    const error = new Error(
      "Please contact support team to enable CRM integration",
    );

    error.code = "CRM_NOT_CONFIGURED";
    error.statusCode = 400;

    throw error;
  }

  if (externalType !== "INVOICE" && externalType !== "QUOTATION") {
    const error = new Error("Valid CRM document type is required");

    error.code = "CRM_DOCUMENT_TYPE_INVALID";
    error.statusCode = 400;

    throw error;
  }

  if (!externalId) {
    const error = new Error("External document id is required for CRM sync");

    error.code = "CRM_DOCUMENT_ID_MISSING";
    error.statusCode = 400;

    throw error;
  }

  if (!externalCustomerId) {
    const error = new Error("External customer id is required for CRM sync");

    error.code = "CRM_EXTERNAL_CUSTOMER_ID_MISSING";
    error.statusCode = 400;

    throw error;
  }

  if (!pdfUrl) {
    const error = new Error("PDF URL is required for CRM sync");

    error.code = "CRM_PDF_URL_MISSING";
    error.statusCode = 400;

    throw error;
  }

  const payload = {
    externalType,
    externalId: String(externalId),

    customer: {
      externalCustomerId: String(externalCustomerId),
    },

    pdfUrl,
  };

  const url =
    `${getCrmBaseUrl()}` + "/api/v1/integrations/commercial/documents/sync";

  console.log("CRM DOCUMENT SYNC REQUEST:", {
    url,
    payload,
  });

  let response;

  try {
    response = await fetch(url, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },

      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("CRM DOCUMENT FETCH ERROR:", {
      url,
      message: error.message,
      cause: error.cause?.message,
      code: error.cause?.code,
      hostname: error.cause?.hostname,
    });

    const crmError = new Error("Unable to connect to CRM server");

    crmError.statusCode = 502;

    crmError.code = error.cause?.code || "CRM_CONNECTION_FAILED";

    throw crmError;
  }

  const rawResponse = await response.text();

  let data = null;

  if (rawResponse) {
    try {
      data = JSON.parse(rawResponse);
    } catch {
      data = null;
    }
  }

  console.log("CRM DOCUMENT SYNC HTTP RESPONSE:", {
    status: response.status,
    statusText: response.statusText,
    contentType: response.headers.get("content-type"),
    body: rawResponse,
  });

  if (!response.ok) {
    const error = new Error(
      data?.error?.message ||
        data?.message ||
        rawResponse ||
        "Document CRM sync failed",
    );

    error.statusCode = response.status;

    error.code = data?.error?.code || data?.code || "CRM_DOCUMENT_SYNC_FAILED";

    error.crmResponse = data || rawResponse || null;

    throw error;
  }

  if (data?.success === false) {
    const error = new Error(
      data?.error?.message || data?.message || "Document CRM sync failed",
    );

    error.statusCode = 400;

    error.code = data?.error?.code || data?.code || "CRM_DOCUMENT_SYNC_FAILED";

    error.crmResponse = data;

    throw error;
  }

  return data;
};
