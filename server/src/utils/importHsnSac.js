/**
 * Smart Invoice - HSN/SAC GST Import
 *
 * DRY RUN:
 * node src/utils/importHsnSac.js --file ./HSN_SAC_with_GST_Rate_1.xlsx
 *
 * ACTUAL IMPORT (only after reviewing rates):
 * node src/utils/importHsnSac.js --file ./HSN_SAC_with_GST_Rate_1.xlsx --apply
 *
 * For an Excel containing unverified/flagged rates:
 * --allow-unverified is required with --apply.
 *
 * Rules:
 * - Original Excel is never modified.
 * - Supports HSN_MSTR and SAC_MSTR sheets.
 * - Supports old and new column headers.
 * - New records are inserted with gst_rate.
 * - Existing code/description/type are preserved.
 * - Existing NULL gst_rate can be filled.
 * - Existing non-NULL GST rates are never overwritten.
 * - Blank GST is NOT treated as 0%.
 * - Dry run makes no database changes.
 * - Apply is restricted to local MySQL.
 * - Uses a transaction with rollback.
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import XLSX from "xlsx";

import db from "../config/db.js";

const args = process.argv.slice(2);

const fileFlag = args.indexOf("--file");
const filePath = fileFlag >= 0 ? args[fileFlag + 1] : null;

const apply = args.includes("--apply");
const allowUnverified = args.includes("--allow-unverified");

const SHEETS = [
  { name: "HSN_MSTR", type: "HSN" },
  { name: "SAC_MSTR", type: "SAC" },
];

const BATCH_SIZE = 250;

function fail(message) {
  throw new Error(message);
}

function normalizeHeader(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getColumnIndex(headers, options) {
  const normalized = headers.map(normalizeHeader);

  for (const option of options) {
    const index = normalized.indexOf(normalizeHeader(option));

    if (index !== -1) return index;
  }

  return -1;
}

function displayText(value) {
  return String(value ?? "").trim();
}

function parseGstRate(value) {
  const text = displayText(value);

  if (!text) {
    return { valid: true, rate: null };
  }

  const cleaned = text.replace(/%/g, "").trim();

  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return { valid: false, rate: null };
  }

  const rate = Number(cleaned);

  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    return { valid: false, rate: null };
  }

  return { valid: true, rate };
}

function readWorkbook() {
  if (!filePath) {
    fail("Provide Excel using --file ./filename.xlsx");
  }

  const fullPath = path.resolve(filePath);

  if (!fs.existsSync(fullPath)) {
    fail(`Excel file not found: ${fullPath}`);
  }

  const workbook = XLSX.readFile(fullPath, {
    cellText: true,
    cellNF: true,
  });

  const records = [];
  const errors = [];
  const seen = new Set();
  const counts = {};

  for (const spec of SHEETS) {
    const sheet = workbook.Sheets[spec.name];

    if (!sheet) {
      fail(`Required sheet missing: ${spec.name}`);
    }

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });

    if (!rows.length) {
      fail(`${spec.name} is empty`);
    }

    const headers = rows[0];

    const codeIndex = getColumnIndex(headers, ["Code", "HSN_CD", "SAC_CD"]);

    const descriptionIndex = getColumnIndex(headers, [
      "Description",
      "HSN_Description",
      "SAC_Description",
    ]);

    const typeIndex = getColumnIndex(headers, ["Type"]);

    const rateIndex = getColumnIndex(headers, [
      "GST Rate (%)",
      "GST Rate",
      "gst_rate",
      "GST_RATE",
    ]);

    if (codeIndex === -1 || descriptionIndex === -1) {
      fail(`Code/Description column missing in ${spec.name}`);
    }

    if (rateIndex === -1) {
      fail(`GST Rate column missing in ${spec.name}`);
    }

    let valid = 0;
    let withRate = 0;
    let withoutRate = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      const code = displayText(row[codeIndex]);
      const description = displayText(row[descriptionIndex]);

      if (!code && !description) continue;

      const problems = [];

      if (!/^\d{2,8}$/.test(code)) {
        problems.push("Code must contain 2 to 8 digits");
      }

      if (!description) {
        problems.push("Description missing");
      }

      if (
        /^#(?:NAME\?|REF!|VALUE!|DIV\/0!|N\/A|NUM!|NULL!)/i.test(description)
      ) {
        problems.push("Excel error in description");
      }

      if (typeIndex !== -1) {
        const rowType = displayText(row[typeIndex]).toUpperCase();

        if (rowType && rowType !== spec.type) {
          problems.push(`Type mismatch: expected ${spec.type}, got ${rowType}`);
        }
      }

      const parsed = parseGstRate(row[rateIndex]);

      if (!parsed.valid) {
        problems.push("Invalid GST rate");
      }

      const key = `${spec.type}:${code}`;

      if (seen.has(key)) {
        problems.push("Duplicate code + type in Excel");
      }

      if (problems.length > 0) {
        errors.push({
          sheet: spec.name,
          excelRow: i + 1,
          code,
          reason: problems.join("; "),
        });
        continue;
      }

      seen.add(key);

      records.push({
        code,
        description,
        type: spec.type,
        gst_rate: parsed.rate,
      });

      valid++;

      if (parsed.rate === null) {
        withoutRate++;
      } else {
        withRate++;
      }
    }

    counts[spec.type] = {
      valid,
      withRate,
      withoutRate,
    };
  }

  // Presence of the Review sheet means the workbook needs
  // explicit approval before an actual import.
  const reviewSheetPresent = Boolean(workbook.Sheets.Review);

  return {
    records,
    errors,
    counts,
    reviewSheetPresent,
  };
}

async function verifyDatabase(connection) {
  const [tables] = await connection.query(
    "SHOW TABLES LIKE 'tbl_hsn_sac_master'",
  );

  if (!tables.length) {
    fail("tbl_hsn_sac_master table not found");
  }

  const [columns] = await connection.query(
    "SHOW COLUMNS FROM tbl_hsn_sac_master",
  );

  const names = new Set(columns.map((column) => column.Field));

  for (const name of ["id", "code", "description", "type", "gst_rate"]) {
    if (!names.has(name)) {
      fail(`Missing database column: ${name}`);
    }
  }

  const [indexes] = await connection.query(
    "SHOW INDEX FROM tbl_hsn_sac_master",
  );

  const uniqueIndexes = new Map();

  for (const index of indexes) {
    if (Number(index.Non_unique) !== 0) continue;

    if (!uniqueIndexes.has(index.Key_name)) {
      uniqueIndexes.set(index.Key_name, []);
    }

    uniqueIndexes.get(index.Key_name).push({
      order: Number(index.Seq_in_index),
      column: index.Column_name,
    });
  }

  const hasUniqueIndex = [...uniqueIndexes.values()].some((parts) => {
    const columns = parts
      .sort((a, b) => a.order - b.order)
      .map((item) => item.column);

    return (
      columns.length === 2 &&
      columns.includes("type") &&
      columns.includes("code")
    );
  });

  if (!hasUniqueIndex) {
    fail("UNIQUE index on (type, code) not found. Import cancelled.");
  }
}

async function getImportPlan(connection, records) {
  const inserts = [];
  const updates = [];

  let existingWithRate = 0;
  let existingWithoutExcelRate = 0;
  let newWithoutRate = 0;

  for (let offset = 0; offset < records.length; offset += BATCH_SIZE) {
    const batch = records.slice(offset, offset + BATCH_SIZE);

    const placeholders = batch.map(() => "(?, ?)").join(", ");

    const params = batch.flatMap((item) => [item.type, item.code]);

    const [existing] = await connection.query(
      `
      SELECT id, type, code, gst_rate
      FROM tbl_hsn_sac_master
      WHERE (type, code) IN (${placeholders})
      `,
      params,
    );

    const existingMap = new Map(
      existing.map((row) => [`${row.type}:${row.code}`, row]),
    );

    for (const item of batch) {
      const key = `${item.type}:${item.code}`;
      const current = existingMap.get(key);

      if (!current) {
        inserts.push(item);

        if (item.gst_rate === null) {
          newWithoutRate++;
        }

        continue;
      }

      if (current.gst_rate !== null) {
        existingWithRate++;
        continue;
      }

      if (item.gst_rate === null) {
        existingWithoutExcelRate++;
        continue;
      }

      updates.push({
        id: current.id,
        gst_rate: item.gst_rate,
      });
    }
  }

  return {
    inserts,
    updates,
    existingWithRate,
    existingWithoutExcelRate,
    newWithoutRate,
  };
}

async function applyImport(connection, plan) {
  let inserted = 0;
  let updated = 0;

  for (let offset = 0; offset < plan.inserts.length; offset += BATCH_SIZE) {
    const batch = plan.inserts.slice(offset, offset + BATCH_SIZE);

    if (!batch.length) continue;

    const placeholders = batch.map(() => "(?, ?, ?, ?)").join(", ");

    const values = batch.flatMap((item) => [
      item.code,
      item.description,
      item.type,
      item.gst_rate,
    ]);

    const [result] = await connection.query(
      `
      INSERT INTO tbl_hsn_sac_master
      (code, description, type, gst_rate)
      VALUES ${placeholders}
      `,
      values,
    );

    inserted += result.affectedRows;
  }

  for (const item of plan.updates) {
    const [result] = await connection.query(
      `
      UPDATE tbl_hsn_sac_master
      SET gst_rate = ?
      WHERE id = ?
        AND gst_rate IS NULL
      `,
      [item.gst_rate, item.id],
    );

    updated += result.affectedRows;
  }

  return { inserted, updated };
}

async function run() {
  const { records, errors, counts, reviewSheetPresent } = readWorkbook();

  for (const error of errors.slice(0, 20)) {
    console.log("SKIPPED:", error);
  }

  if (errors.length > 20) {
    console.log(`...and ${errors.length - 20} more errors`);
  }

  if (!records.length) {
    fail("No valid records found");
  }

  if (apply && errors.length > 0) {
    fail("Invalid Excel rows detected. Correct them before apply.");
  }

  if (apply && reviewSheetPresent && !allowUnverified) {
    fail(
      "Review sheet detected. Verify rates first, or explicitly pass --allow-unverified.",
    );
  }

  if (apply) {
    const host = String(process.env.DB_HOST ?? "")
      .trim()
      .toLowerCase();

    if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
      fail("Apply is allowed only for a local MySQL database");
    }

    if (!process.env.DB_NAME) {
      fail("DB_NAME is not configured");
    }

    console.log("Target DB:", process.env.DB_NAME);
  }

  const connection = await db.getConnection();

  let transactionStarted = false;

  try {
    await verifyDatabase(connection);

    if (apply) {
      await connection.beginTransaction();
      transactionStarted = true;
    }

    const plan = await getImportPlan(connection, records);

    console.log("\n====================================");
    console.log(" DATABASE IMPORT PLAN");
    console.log("====================================");

    console.log("New records:", plan.inserts.length);
    console.log("Existing NULL rates to fill:", plan.updates.length);
    console.log("Existing rates preserved:", plan.existingWithRate);
    console.log(
      "Existing rows with no Excel GST:",
      plan.existingWithoutExcelRate,
    );
    console.log("New records without GST:", plan.newWithoutRate);

    if (!apply) {
      console.log("\nDRY RUN COMPLETED");
      console.log("No database changes made.");
      return;
    }

    const result = await applyImport(connection, plan);

    await connection.commit();
    transactionStarted = false;

    console.log("\n====================================");
    console.log(" IMPORT COMPLETED");
    console.log("====================================");

    console.log("Inserted:", result.inserted);
    console.log("GST rates updated:", result.updated);
    console.log("Existing rates preserved:", plan.existingWithRate);
    console.log("Original Excel unchanged.");
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback();
      console.log("Transaction rolled back.");
    }

    throw error;
  } finally {
    connection.release();
  }
}

run()
  .catch((error) => {
    console.error("\nIMPORT FAILED:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
