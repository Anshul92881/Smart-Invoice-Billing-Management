import express from "express";
import cors from "cors";
import path from "path";

import taxRoutes from "./routes/taxRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import customersRoutes from "./routes/customersRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import superAdminRoutes from "./routes/superAdminRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import quotationRoutes from "./routes/quotationRoutes.js";
import vendorRoutes from "./routes/vendorRoutes.js";
import auditLogRoutes from "./routes/auditLogRoutes.js";
import branchRoutes from "./routes/branchRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import kycRoutes from "./routes/kycRoutes.js";

import authMiddleware, {kycAccessMiddleware} from "./middlewares/authMiddleware.js";

const app = express();

const uploadPath = path.join(process.cwd(), "upload");
const uploadsPath = path.join(process.cwd(), "uploads");

console.log("Upload path:", uploadPath);
console.log("Uploads path:", uploadsPath);

app.use("/upload", express.static(uploadPath));
app.use("/uploads", express.static(uploadsPath));

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Smart Invoice SaaS API Running",
  });
});

/* ==========================================================
   PUBLIC ROUTES
   These routes should work even if KYC is pending
========================================================== */

app.use("/api/auth", authRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/superadmin", superAdminRoutes);

/* ==========================================================
   GLOBAL AUTH + KYC CHECK
   - GET requests => Allowed (View Only Mode)
   - POST/PUT/PATCH/DELETE => KYC Required
========================================================== */

app.use("/api", authMiddleware, kycAccessMiddleware);

/* ==========================================================
   PROTECTED ROUTES
========================================================== */

app.use("/api/companies", companyRoutes);
app.use("/api/users", userRoutes);
app.use("/api/customers", customersRoutes);
app.use("/api/products", productRoutes);
app.use("/api/taxes", taxRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/quotations", quotationRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/notifications", notificationRoutes);

export default app;