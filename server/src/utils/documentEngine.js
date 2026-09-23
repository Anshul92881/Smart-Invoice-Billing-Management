import puppeteer from "puppeteer";

import fs from "fs/promises";
import path from "path";

const FRONTEND_URL = process.env.FRONTEND_URL || "https://sellspark.in";

export const parseJsonSafe = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

export const buildDocumentSnapshot = async (
  connection,
  companyId,
  branchId,
) => {
  const [companyRows] = await connection.query(
    `
    SELECT
      name, address, email, phone, gst_number, pan_number, logo,
      bank_name, account_holder_name, account_number, ifsc_code, upi_id,
      invoice_terms, payment_instructions,authorized_signatory_name, billing_template
    FROM tbl_companies
    WHERE id = ?
    LIMIT 1
    `,
    [companyId],
  );

  if (companyRows.length === 0) {
    throw new Error("Company not found");
  }

  const company = companyRows[0];

  const [branchRows] = await connection.query(
    `
    SELECT
      id, branch_name, branch_code, email, phone, gst_number,
      address, city, state, country, zip_code, is_main
    FROM tbl_company_branches
    WHERE id = ?
    AND company_id = ?
    LIMIT 1
    `,
    [branchId, companyId],
  );

  const branch = branchRows[0] || {};

  const branchAddress = [
    branch.address,
    branch.city,
    branch.state,
    branch.country,
    branch.zip_code,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    template: parseJsonSafe(company.billing_template),

    company: {
      name: company.name || "",
      address: company.address || "",
      email: company.email || "",
      phone: company.phone || "",
      gst_number: company.gst_number || "",
      pan_number: company.pan_number || "",
      logo: company.logo || "",
      authorized_signatory_name: company.authorized_signatory_name || "",
    },

    bank: {
      bank_name: company.bank_name || "",
      account_holder_name: company.account_holder_name || "",
      account_number: company.account_number || "",
      ifsc_code: company.ifsc_code || "",
      upi_id: company.upi_id || "",
      invoice_terms: company.invoice_terms || "",
      payment_instructions: company.payment_instructions || "",
    },

    branch: {
      id: branch.id || branchId || null,
      branch_name: branch.branch_name || "Head Office",
      branch_code: branch.branch_code || "",
      email: branch.email || "",
      phone: branch.phone || "",
      gst_number: branch.gst_number || "",
      address: branchAddress || company.address || "",
      is_main: branch.is_main || 0,
    },
  };
};

export const getDocumentSnapshot = (document = {}) => {
  const snapshot = parseJsonSafe(document.billing_template_snapshot);

  return {
    template: snapshot.template || parseJsonSafe(document.billing_template),
    company: snapshot.company || {},
    bank: snapshot.bank || {},
    branch: snapshot.branch || {},
  };
};

const getPrintUrl = ({ type, document }) => {
  const id = document?.id;

  if (!id) {
    throw new Error("Document id is required for PDF generation");
  }

  if (type === "quotation") {
    return `${FRONTEND_URL}/dashboard/quotations/${id}?print=true`;
  }

  return `${FRONTEND_URL}/dashboard/invoices/${id}?print=true`;
};

export const generateDocumentPDFBuffer = async ({
  type = "invoice",
  document = {},
  authToken = "",
}) => {
  if (!authToken) {
    throw new Error("Auth token is required for frontend PDF rendering");
  }

  const printUrl = getPrintUrl({ type, document });

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: "shell", // Modern, faster headless mode for modern Puppeteer
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined, // Tells it to use /usr/bin/chromium-browser from Docker
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage", // ◄ CRITICAL: Prevents Docker shared memory crash (ENOBUFS/SIGBUS error)
      ],
    });
    const page = await browser.newPage();

    await page.setViewport({
      width: 1240,
      height: 1754,
      deviceScaleFactor: 1,
    });

    await page.goto(FRONTEND_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.evaluate(
      (token) => {
        localStorage.setItem("token", token);
      },
      authToken.replace(/^Bearer\s+/i, ""),
    );

    await page.goto(printUrl, {
      waitUntil: ["domcontentloaded", "networkidle0"],
      timeout: 60000,
    });

    await page.waitForSelector(".print-area", {
      timeout: 60000,
    });

    await page.emulateMediaType("print");

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "8mm",
        right: "8mm",
        bottom: "8mm",
        left: "8mm",
      },
    });

    return Buffer.from(pdf);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

const sanitizePdfFileName = (value = "document") => {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const saveDocumentPDFToServer = async ({
  type = "invoice",
  document = {},
  companyId,
  authToken = "",
}) => {
  if (!companyId) {
    throw new Error("Company id is required for saving PDF");
  }

  if (!document?.id) {
    throw new Error("Document id is required for saving PDF");
  }

  const pdfBuffer = await generateDocumentPDFBuffer({
    type,
    document,
    authToken,
  });

  const folderName = type === "quotation" ? "quotations" : "invoices";

  const documentNumber =
    type === "quotation" ? document.quotation_number : document.invoice_number;

  const safeFileName = sanitizePdfFileName(
    documentNumber || `${type}-${document.id}`,
  );

  const companyFolder = path.join(
    process.cwd(),
    "uploads",
    folderName,
    String(companyId),
  );

  await fs.mkdir(companyFolder, {
    recursive: true,
  });

  const fileName = `${safeFileName}.pdf`;

  const absolutePath = path.join(companyFolder, fileName);

  await fs.writeFile(absolutePath, pdfBuffer);

  const publicPath = `/uploads/${folderName}/${companyId}/${fileName}`;

  return {
    fileName,
    absolutePath,
    publicPath,
  };
};

export const getSavedDocumentPDFBuffer = async ({
  type = "invoice",
  document = {},
  companyId,
  authToken = "",
}) => {
  if (!companyId) {
    throw new Error("Company id is required");
  }

  if (!document?.id) {
    throw new Error("Document id is required");
  }

  const folderName = type === "quotation" ? "quotations" : "invoices";

  const documentNumber =
    type === "quotation" ? document.quotation_number : document.invoice_number;

  const safeFileName = sanitizePdfFileName(
    documentNumber || `${type}-${document.id}`,
  );

  const fileName = `${safeFileName}.pdf`;

  const absolutePath = path.join(
    process.cwd(),
    "uploads",
    folderName,
    String(companyId),
    fileName,
  );

  const publicPath = `/uploads/${folderName}/${companyId}/${fileName}`;

  try {
    // Pehle check/read existing PDF
    const pdfBuffer = await fs.readFile(absolutePath);

    return {
      pdfBuffer,
      fileName,
      absolutePath,
      publicPath,
      generated: false,
    };
  } catch (error) {
    // Agar error file missing wala nahi hai,
    // to actual error forward karo.
    if (error.code !== "ENOENT") {
      throw error;
    }

    // Old document hai aur PDF server par nahi hai.
    // Ek baar generate + save kar do.
    const savedPdf = await saveDocumentPDFToServer({
      type,
      document,
      companyId,
      authToken,
    });

    const pdfBuffer = await fs.readFile(savedPdf.absolutePath);

    return {
      ...savedPdf,
      pdfBuffer,
      generated: true,
    };
  }
};

export const generateDocumentPDF = async ({
  type = "invoice",
  document = {},
  authToken = "",
  outputStream,
}) => {
  const buffer = await generateDocumentPDFBuffer({
    type,
    document,
    authToken,
  });

  outputStream.end(buffer);
};
