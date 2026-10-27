import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

/*
|--------------------------------------------------------------------------
| EXISTING DEFAULT EMAIL TRANSPORTER
|--------------------------------------------------------------------------
| Existing Invoice, Quotation aur other email functionality ke liye.
| Is configuration ko change nahi kiya gaya.
*/

const transporter = nodemailer.createTransport({
  service: "gmail",

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const createSmtpTransporter = (smtpSettings = {}) => {
  const smtpHost = String(smtpSettings.smtp_host || "").trim();
  const smtpUser = String(smtpSettings.smtp_user || "").trim();
  const smtpPass = String(smtpSettings.smtp_pass || "").trim();
  const smtpPort = Number(smtpSettings.smtp_port || 0);

  if (!smtpHost || !smtpUser || !smtpPass || !smtpPort) {
    return null;
  }

  const smtpSecure =
    smtpSettings.smtp_secure === true ||
    smtpSettings.smtp_secure === 1 ||
    smtpSettings.smtp_secure === "1" ||
    String(smtpSettings.smtp_secure).toLowerCase() === "true";

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,

    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
};

export default transporter;
