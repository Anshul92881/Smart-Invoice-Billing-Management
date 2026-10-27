import fs from "fs";
import path from "path";
import cron from "node-cron";

import db from "../config/db.js";
import { createSmtpTransporter } from "../utils/emailService.js";
import greetingEmailTemplate from "../utils/greetingEmailTemplate.js";

let schedulerRunning = false;

const getIndiaDateTime = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
};

const isLeapYear = (year) => {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
};

const addOneYear = (dateTime) => {
  const [datePart, timePart] = dateTime.split(" ");

  let [year, month, day] = datePart.split("-").map(Number);

  year += 1;

  if (month === 2 && day === 29 && !isLeapYear(year)) {
    day = 28;
  }

  return [
    `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    timePart,
  ].join(" ");
};

const getNextYearlyDate = (dateTime) => {
  const currentDateTime = getIndiaDateTime();

  let nextDateTime = addOneYear(dateTime);

  while (nextDateTime <= currentDateTime) {
    nextDateTime = addOneYear(nextDateTime);
  }

  return nextDateTime;
};

const replacePlaceholders = (value, details) => {
  return String(value || "")
    .replaceAll("{{name}}", details.recipientName || "")
    .replaceAll("{{recipient_name}}", details.recipientName || "")
    .replaceAll("{{company_name}}", details.senderName || "")
    .replaceAll("{{occasion_name}}", details.occasionName || "");
};

const getGreetingRecipients = async (greeting) => {
  let rows = [];

  if (greeting.creator_role === "superadmin") {
    [rows] = await db.query(`
      SELECT
        id,
        name,
        email
      FROM tbl_users
      WHERE role = 'company_admin'
        AND email IS NOT NULL
        AND TRIM(email) != ''
    `);
  } else {
    [rows] = await db.query(
      `
      SELECT
        id,
        customer_name AS name,
        email
      FROM tbl_customers
      WHERE company_id = ?
        AND email IS NOT NULL
        AND TRIM(email) != ''
      `,
      [greeting.company_id],
    );
  }

  const uniqueRecipients = new Map();

  for (const row of rows) {
    const normalizedEmail = String(row.email || "")
      .trim()
      .toLowerCase();

    if (!normalizedEmail) continue;

    if (!uniqueRecipients.has(normalizedEmail)) {
      uniqueRecipients.set(normalizedEmail, {
        id: row.id,
        name: row.name || "Customer",
        email: normalizedEmail,
      });
    }
  }

  return [...uniqueRecipients.values()];
};

const getSenderDetails = async (greeting) => {
  /*
  |--------------------------------------------------------------------------
  | SUPERADMIN GREETING SMTP
  |--------------------------------------------------------------------------
  */

  if (greeting.creator_role === "superadmin") {
    const [smtpRows] = await db.query(
      `
      SELECT
        smtp_host,
        smtp_port,
        smtp_user,
        smtp_pass,
        smtp_secure,
        from_email,
        from_name,
        reply_to
      FROM tbl_superadmin_smtp_settings
      WHERE id = 1
      LIMIT 1
      `,
    );

    if (!smtpRows.length) {
      throw new Error(
        "SuperAdmin SMTP is not configured. Greeting email was not sent.",
      );
    }

    const smtpSettings = smtpRows[0];

    const smtpTransporter = createSmtpTransporter(smtpSettings);

    if (!smtpTransporter || !String(smtpSettings.from_email || "").trim()) {
      throw new Error(
        "SuperAdmin SMTP configuration is incomplete. Greeting email was not sent.",
      );
    }

    return {
      mailTransporter: smtpTransporter,

      senderName: smtpSettings.from_name || "Smart Invoice & Billing",

      fromAddress: smtpSettings.from_email,

      replyTo: smtpSettings.reply_to || null,

      smtpSource: "superadmin",
    };
  }

  /*
  |--------------------------------------------------------------------------
  | COMPANY ADMIN GREETING SMTP
  |--------------------------------------------------------------------------
  | Existing tbl_companies SMTP fields sirf read ki ja rahi hain.
  | Koi update/change nahi ho raha.
  */

  if (greeting.creator_role === "company_admin") {
    if (!greeting.company_id) {
      throw new Error("Company ID is missing for Company Admin greeting.");
    }

    const [companies] = await db.query(
      `
      SELECT
        id,
        name,
        smtp_host,
        smtp_port,
        smtp_user,
        smtp_pass,
        smtp_secure,
        from_email,
        from_name,
        reply_to
      FROM tbl_companies
      WHERE id = ?
      LIMIT 1
      `,
      [greeting.company_id],
    );

    if (!companies.length) {
      throw new Error("Greeting company was not found.");
    }

    const company = companies[0];

    const smtpTransporter = createSmtpTransporter(company);

    if (!smtpTransporter || !String(company.from_email || "").trim()) {
      throw new Error(
        "Company SMTP is not configured. Greeting email was not sent.",
      );
    }

    return {
      mailTransporter: smtpTransporter,

      senderName:
        company.from_name || company.name || "Smart Invoice & Billing",

      fromAddress: company.from_email,

      replyTo: company.reply_to || null,

      smtpSource: "company",
    };
  }

  throw new Error("Invalid greeting creator role.");
};

const getBannerAttachment = (bannerPath) => {
  if (!bannerPath) return null;

  const filename = path.basename(bannerPath);

  const absolutePath = path.join(
    process.cwd(),
    "upload",
    "greeting-banners",
    filename,
  );

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return {
    filename,
    path: absolutePath,
    cid: "greeting-banner",
  };
};

const updateFailedGreeting = async (greeting, errorMessage) => {
  if (greeting.repeat_type === "yearly") {
    const nextSendAt = getNextYearlyDate(greeting.send_at);

    await db.query(
      `
      UPDATE tbl_greetings
      SET
        status = 'scheduled',
        send_at = ?,
        sent_count = 0,
        failed_count = 0,
        last_error = ?
      WHERE id = ?
      `,
      [nextSendAt, errorMessage, greeting.id],
    );

    return;
  }

  await db.query(
    `
    UPDATE tbl_greetings
    SET
      status = 'failed',
      last_error = ?
    WHERE id = ?
    `,
    [errorMessage, greeting.id],
  );
};

const processGreeting = async (greeting) => {
  const [claimResult] = await db.query(
    `
    UPDATE tbl_greetings
    SET
      status = 'processing',
      last_error = NULL
    WHERE id = ?
      AND status = 'scheduled'
    `,
    [greeting.id],
  );

  if (claimResult.affectedRows === 0) {
    return;
  }

  try {
    const recipients = await getGreetingRecipients(greeting);

    if (recipients.length === 0) {
      await updateFailedGreeting(
        greeting,
        "No recipients with valid email addresses were found",
      );

      return;
    }

    const senderDetails = await getSenderDetails(greeting);

    const bannerAttachment = getBannerAttachment(greeting.banner_path);

    let sentCount = 0;
    let failedCount = 0;
    let lastError = null;

    for (const recipient of recipients) {
      try {
        const placeholderDetails = {
          recipientName: recipient.name,
          senderName: senderDetails.senderName,
          occasionName: greeting.occasion_name,
        };

        const personalizedSubject = replacePlaceholders(
          greeting.email_subject,
          placeholderDetails,
        );

        const personalizedMessage = replacePlaceholders(
          greeting.email_message,
          placeholderDetails,
        );

        const html = greetingEmailTemplate({
          recipientName: recipient.name,
          occasionName: greeting.occasion_name,
          message: personalizedMessage,
          senderName: senderDetails.senderName,
          hasBanner: Boolean(bannerAttachment),
        });

        await senderDetails.mailTransporter.sendMail({
          from: {
            name: senderDetails.senderName,
            address: senderDetails.fromAddress,
          },

          to: recipient.email,

          subject: personalizedSubject,

          text: [
            `Hello ${recipient.name},`,
            "",
            personalizedMessage,
            "",
            `Best wishes,`,
            senderDetails.senderName,
          ].join("\n"),

          html,

          ...(senderDetails.replyTo
            ? {
                replyTo: senderDetails.replyTo,
              }
            : {}),

          ...(bannerAttachment
            ? {
                attachments: [bannerAttachment],
              }
            : {}),
        });

        sentCount += 1;
      } catch (error) {
        failedCount += 1;
        lastError = error.message;

        console.error(
          `Greeting ${greeting.id} email failed for ${recipient.email}:`,
          error.message,
        );
      }
    }

    const sentAt = getIndiaDateTime();

    if (greeting.repeat_type === "yearly") {
      const nextSendAt = getNextYearlyDate(greeting.send_at);

      await db.query(
        `
        UPDATE tbl_greetings
        SET
          status = 'scheduled',
          send_at = ?,
          sent_count = ?,
          failed_count = ?,
          last_error = ?,
          last_sent_at = ?
        WHERE id = ?
        `,
        [nextSendAt, sentCount, failedCount, lastError, sentAt, greeting.id],
      );

      return;
    }

    let finalStatus = "sent";

    if (sentCount === 0) {
      finalStatus = "failed";
    } else if (failedCount > 0) {
      finalStatus = "partially_sent";
    }

    await db.query(
      `
      UPDATE tbl_greetings
      SET
        status = ?,
        sent_count = ?,
        failed_count = ?,
        last_error = ?,
        last_sent_at = ?
      WHERE id = ?
      `,
      [finalStatus, sentCount, failedCount, lastError, sentAt, greeting.id],
    );
  } catch (error) {
    console.error(`Greeting ${greeting.id} processing error:`, error);

    await updateFailedGreeting(greeting, error.message);
  }
};

export const runGreetingScheduler = async () => {
  if (schedulerRunning) {
    return;
  }

  schedulerRunning = true;

  try {
    const currentDateTime = getIndiaDateTime();

    /*
     * Server restart/crash ke baad 30 minutes se purani
     * processing greeting ko dobara scheduled banata hai.
     */
    await db.query(
      `
      UPDATE tbl_greetings
      SET
        status = 'scheduled',
        last_error = 'Recovered after interrupted processing'
      WHERE status = 'processing'
        AND updated_at < DATE_SUB(?, INTERVAL 30 MINUTE)
      `,
      [currentDateTime],
    );

    const [dueGreetings] = await db.query(
      `
      SELECT
        id,
        company_id,
        created_by,
        creator_role,
        occasion_name,
        email_subject,
        email_message,
        banner_path,
        DATE_FORMAT(
          send_at,
          '%Y-%m-%d %H:%i:%s'
        ) AS send_at,
        repeat_type,
        status
      FROM tbl_greetings
      WHERE status = 'scheduled'
        AND send_at IS NOT NULL
        AND send_at <= ?
      ORDER BY send_at ASC
      LIMIT 25
      `,
      [currentDateTime],
    );

    for (const greeting of dueGreetings) {
      await processGreeting(greeting);
    }
  } catch (error) {
    console.error("Greeting scheduler error:", error);
  } finally {
    schedulerRunning = false;
  }
};

export const startGreetingScheduler = () => {
  cron.schedule(
    "* * * * *",
    async () => {
      await runGreetingScheduler();
    },
    {
      timezone: "Asia/Kolkata",
    },
  );

  runGreetingScheduler().catch((error) => {
    console.error("Initial greeting scheduler error:", error);
  });

  console.log(
    "Greeting scheduler started",
  );
};
