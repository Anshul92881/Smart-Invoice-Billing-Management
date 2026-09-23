# 🚀 Smart Invoice & Billing Management SaaS

> A modern, multi-tenant Invoice & Billing Management SaaS built with React, Node.js, Express.js, and MySQL. The platform helps businesses manage quotations, invoices, customers, products, branches, payments, expenses, taxes, KYC, subscriptions, reports, notifications, audit logs, and CRM synchronization from one centralized system.

---

## 📌 Overview

**Smart Invoice & Billing Management** is a full-stack SaaS platform designed to simplify and automate day-to-day billing and financial operations for businesses.

The application follows a **multi-tenant architecture**, where every company operates inside its own isolated workspace with separate users, branches, customers, products, invoices, quotations, payments, settings, permissions, and business data.

The system supports both business users and platform administrators through configurable **Role-Based Access Control (RBAC)**.

### Core Capabilities

- Multi-Tenant SaaS Architecture
- Company Registration
- Mandatory Company KYC
- Multi-Branch Management
- Customer Management
- Product Management
- Vendor Management
- Quotation Management
- Invoice Management
- Payment Tracking
- Expense Management
- Tax Management
- Reports & Analytics
- Subscription Management
- Role-Based Access Control
- Dynamic Module Permissions
- PDF Generation
- Email Delivery
- CRM Integration
- Real-Time Notifications
- Audit Logs
- Responsive UI
- Dark / Light Theme

---

# 🏗️ System Architecture

```text
┌─────────────────────────────────────┐
│           React Frontend            │
│        Vite + Tailwind CSS          │
└──────────────────┬──────────────────┘
                   │
                   │ REST API / JWT
                   ▼
┌─────────────────────────────────────┐
│       Node.js + Express Backend     │
│                                     │
│  Authentication Middleware          │
│  Role Authorization                 │
│  Permission Authorization           │
│  KYC Enforcement                    │
│  Business Controllers               │
│  Document Engine                    │
│  CRM Integration Service            │
│  Notification Service               │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│               MySQL                 │
│              Database               │
└─────────────────────────────────────┘
```

The backend also communicates with:

```text
Node.js Backend
      │
      ├── SMTP Server
      │      └── Email Delivery
      │
      ├── Puppeteer
      │      └── Invoice / Quotation PDFs
      │
      ├── Socket.IO
      │      └── Real-Time Notifications
      │
      ├── KYC Provider
      │      ├── Aadhaar Verification
      │      ├── PAN Verification
      │      ├── GST Verification
      │      └── TAN Verification
      │
      └── External CRM
             ├── Customer Sync
             ├── Invoice Sync
             └── Quotation Sync
```

---

# ✨ Features

## 🏢 Company Management

The Company module manages business-level configuration and organization information.

### Features

- Company Registration
- Automatic Company Admin Creation
- Automatic HQ / Head Office Branch Creation
- Company Profile Management
- Company Logo
- GST & PAN Details
- Address & Contact Information
- Company Status Management
- Billing Configuration
- Invoice Number Configuration
- Quotation Number Configuration
- Company SMTP Configuration
- CRM API Key Configuration
- Company Settings

---

# 👥 User Management

The platform supports multiple user roles.

### Available Roles

- Super Admin
- Company Admin
- Accountant
- Sales User

### Features

- Create Users
- View Users
- Edit Users
- Activate / Deactivate Users
- Branch Assignment
- Role Assignment
- Dynamic Permission Assignment
- Role-Based Sidebar
- Permission-Based Routes
- Backend Permission Enforcement

---

# 🔐 Authentication

Authentication is secured using JWT.

### Supported Features

- Login
- Logout
- Current User Session
- Forgot Password
- Reset Password
- Change Password
- Profile Management
- Password Hashing using bcrypt
- Protected Routes
- Role Authorization
- Permission Authorization

### Authentication Flow

```text
User Login
    │
    ▼
Email + Password
    │
    ▼
Backend Validation
    │
    ▼
JWT Generated
    │
    ▼
Token Stored
    │
    ▼
Dashboard Access
```

Protected API requests use:

```http
Authorization: Bearer <JWT_TOKEN>
```

---

# 🔒 Company KYC Verification

KYC is mandatory before a company receives full access to business operations.

A newly registered Company Admin can access the application flow, but restricted business operations remain blocked until KYC is completed.

### Supported Verification

- Aadhaar Verification
- Aadhaar OTP Verification
- PAN Verification
- GST Verification
- TAN Verification
- KYC Document Upload
- Verification Attempts
- KYC Status Tracking
- Manual KYC Verification
- SuperAdmin Review
- KYC Blocking
- KYC Unblocking
- Verification Logs

### KYC Statuses

```text
Pending
Submitted
Approved
Manual Verified
Rejected
Blocked
```

### Standard KYC Flow

```text
Company Registration
        │
        ▼
KYC Pending
        │
        ▼
Upload Aadhaar
        │
        ▼
Verify Aadhaar OTP
        │
        ▼
Upload PAN
        │
        ▼
Verify PAN
        │
        ├── Verify GST (if applicable)
        │
        └── Verify TAN (if applicable)
        │
        ▼
Submit Documents
        │
        ▼
KYC Approved
        │
        ▼
Company Activated
```

---

# 🛡️ SuperAdmin Manual KYC

SuperAdmin can manually perform KYC for companies when required.

This is useful when:

- SuperAdmin creates a company manually
- Automatic verification cannot be completed
- Verification attempts are exhausted
- Verification API fails
- Documents need manual review
- KYC is rejected
- Company becomes blocked

### Manual KYC Flow

```text
SuperAdmin
    │
    ▼
Company KYC
    │
    ▼
Select Company
    │
    ▼
View KYC Details
    │
    ▼
Manual KYC
    │
    ▼
Upload Documents
    │
    ▼
Perform Required Verification
    │
    ▼
Complete Manual KYC
    │
    ▼
KYC Status = Manual Verified
    │
    ▼
Company Activated
```

Manual uploads are separately tracked so the system can identify whether documents were uploaded by the Company Admin or SuperAdmin.

---

# 🏢 Branch Management

The platform supports multi-branch businesses.

### Features

- Automatic HQ Branch Creation
- Create Branch
- Edit Branch
- Branch Status
- Branch Code
- Branch Assignment
- Branch-Level User Assignment
- Branch-Wise Business Operations

### Example

```text
Company
   │
   ├── Head Office
   │
   ├── Delhi Branch
   │
   ├── Mumbai Branch
   │
   └── Jaipur Branch
```

---

# 👨‍💼 Customer Management

Customer records can be reused while creating quotations and invoices.

### Features

- Create Customer
- Edit Customer
- View Customer
- Customer Search
- Customer Status
- Customer GSTIN
- Customer Email
- Customer Phone
- Company Name
- Billing Address
- Shipping Address
- Branch Assignment
- Payment Terms
- Credit Information
- Notes

---

# 📦 Product Management

Products and services are used as quotation and invoice line items.

### Features

- Create Product
- Edit Product
- Product Name
- SKU
- Unit Price
- Stock Quantity
- Unit Type
- HSN / SAC Code
- Tax Configuration
- Product Description
- Product Image
- Branch Assignment
- Product Status

### Supported Unit Types

```text
pcs
kg
g
ltr
ml
box
pack
meter
hour
day
service
```

Stock is validated during invoice-related business operations.

---

# 🏭 Vendor Management

Vendor Management stores supplier and vendor information.

### Features

- Create Vendor
- Edit Vendor
- View Vendor
- Vendor GST
- Vendor Contact Information
- Vendor Address
- Vendor Status
- Search & Filter
- Permission-Based Access

---

# 📝 Quotation Management

The Quotation module manages the complete pre-invoice sales workflow.

### Features

- Create Quotation
- Edit Eligible Quotations
- View Quotation
- Quotation Status Management
- Print Quotation
- Download PDF
- Email Quotation
- Resend Quotation
- Cancel Quotation
- Convert Quotation to Invoice
- Push Quotation to CRM

---

## Quotation Lifecycle

```text
Draft
  │
  ├── Edit
  ├── Email
  └── Send
       │
       ▼
      Sent
       │
       ├── Edit
       ├── Resend
       ├── Accept
       └── Cancel
             │
             ▼
          Accepted
             │
             ▼
      Convert to Invoice
             │
             ▼
         Converted
```

---

## Quotation Editing Rules

```text
Draft       → Editable
Sent        → Editable
Accepted    → Locked
Converted   → Locked
Cancelled   → Locked
```

When an existing quotation is edited:

- Same database record is updated
- Same quotation ID remains
- Same quotation number remains
- A new quotation is not created
- Updated PDF can be regenerated
- CRM external identity remains stable

---

# 🧾 Invoice Management

Invoices are finalized billing documents.

### Features

- Create Invoice
- View Invoice
- Invoice Preview
- Print Invoice
- Download Invoice PDF
- Email Invoice
- Track Paid Amount
- Track Outstanding Balance
- Due Date Management
- Invoice Status Tracking
- Cancel Eligible Invoice
- Push Invoice to CRM

---

## ⚠️ Invoice Editing Policy

Invoices are intentionally **not editable after creation**.

```text
Draft       → Not Editable
Sent        → Not Editable
Paid        → Not Editable
Cancelled   → Not Editable
```

This prevents accidental modification of financial records.

If incorrect information is entered, the recommended process is to cancel the invoice where allowed and create the correct financial document instead of silently changing the original invoice.

---

# 🔄 Quotation to Invoice Conversion

Eligible quotations can be converted into invoices.

```text
Quotation
     │
     ▼
Convert to Invoice
     │
     ▼
Invoice Created
     │
     ▼
Invoice Items Created
     │
     ▼
Stock Updated
     │
     ▼
Quotation Status = Converted
```

The billing template snapshot is carried forward so historical financial documents remain consistent.

---

# 💰 Payment Management

The Payments module tracks money received against invoices.

### Features

- Record Payment
- Partial Payment
- Full Payment
- Payment History
- Outstanding Amount
- Balance Due
- Payment Status
- Payment Reports

### Calculation

```text
Invoice Total
      -
Paid Amount
      =
Balance Due
```

---

# 💵 Expense Management

The Expense module records company expenditure.

### Features

- Create Expense
- Edit Expense
- Expense Categories
- Expense Date
- Vendor Association
- Amount Tracking
- Expense Reports
- Permission-Based Access

---

# 🧾 Tax Management

Designed for Indian billing and taxation workflows.

### Supported Taxes

- GST
- CGST
- SGST
- IGST
- TDS
- TCS

### Features

- Create Tax Rules
- Tax Percentage Configuration
- Product Tax Mapping
- HSN / SAC Support
- Dynamic Tax Calculation
- Tax Reports

---

# 📊 Reports & Analytics

The reporting module provides visibility into company financial activity.

### Reports Include

- Invoice Reports
- Payment Reports
- Expense Reports
- Tax Reports
- Revenue Reports
- Sales Reports
- Outstanding Invoice Reports
- Business Performance Data

Report access is controlled using role permissions.

---

# 💳 Subscription Management

The SaaS includes company subscription management.

### Features

- Subscription Plans
- Company Subscriptions
- Free Trial
- Subscription Status
- Billing Cycle
- Subscription Payments
- Subscription Invoices
- Trial Expiry Handling
- Trial Extension Request
- Renewal Management
- SuperAdmin Subscription Management

### Typical Subscription States

```text
Trial
Active
Pending Payment
Expired
```

---

# 🔄 CRM Integration

The application supports integration with an external CRM.

CRM communication is handled by the backend so sensitive CRM credentials are never exposed directly to the browser.

### Supported CRM Operations

- Customer Synchronization
- Invoice Synchronization
- Quotation Synchronization
- PDF URL Sharing
- Stable External Document IDs
- CRM Error Handling

### CRM Flow

```text
User
  │
  ▼
Push to CRM
  │
  ▼
Smart Invoice Backend
  │
  ▼
Validate Company CRM API Key
  │
  ▼
Sync Customer
  │
  ▼
Sync Invoice / Quotation
  │
  ▼
External CRM
```

### Document Identity

Invoice:

```text
externalType = INVOICE
externalId   = Invoice Database ID
```

Quotation:

```text
externalType = QUOTATION
externalId   = Quotation Database ID
```

Using stable IDs prevents duplicate CRM records when the same document is synchronized again.

---

## CRM Access

Push to CRM is available for:

```text
Company Admin
Accountant
Sales User
```

subject to authentication and document access.

---

## CRM Error Handling

Example cases:

```text
USER_NOT_FOUND
→ Customer not found in CRM

CRM_NOT_PURCHASED
→ CRM service/subscription is not available
```

These cases are handled separately.

---

# 📄 PDF Generation

The platform contains a server-side PDF Document Engine.

### Supports

- Invoice PDF
- Quotation PDF
- Print View
- PDF Download
- Email Attachments
- Server-Side PDF Storage
- CRM Document Sharing

### PDF Flow

```text
Invoice / Quotation Created
           │
           ▼
Document Snapshot Generated
           │
           ▼
Printable Document Rendered
           │
           ▼
Puppeteer
           │
           ▼
PDF Generated
           │
           ▼
PDF Saved on Server
           │
           ▼
PDF Path Saved in Database
```

---

# 🧩 Billing Template Snapshot

Important company configuration is saved with the document so historical invoices and quotations remain consistent even if company settings change later.

The snapshot may include:

- Company Name
- Company Address
- Company Logo
- GST Number
- PAN Number
- Branch Information
- Bank Details
- UPI Details
- Invoice Terms
- Payment Instructions
- Billing Template Preferences

---

# 📧 Email Integration

Business documents can be sent directly through email.

### Supports

- Company SMTP
- Gmail SMTP
- Custom SMTP
- SMTP Test
- Invoice Email
- Quotation Email
- Password Reset Email
- PDF Attachments

### Email Flow

```text
User Clicks Send Email
         │
         ▼
Backend Loads Document
         │
         ▼
PDF Loaded / Generated
         │
         ▼
Company SMTP Loaded
         │
         ▼
Nodemailer Sends Email
         │
         ▼
Audit Log + Notification
```

---

# 🔔 Notification System

The application uses **Socket.IO** for real-time notifications.

### Supports

- User Notifications
- Company Notifications
- Business Activity Notifications
- Unread Notification Count
- Mark as Read
- Mark All as Read
- Live Dashboard Updates

### Socket Rooms

```text
user_<userId>

company_<companyId>
```

This allows notifications to be sent either to an individual user or all relevant users in a company.

---

# ⏰ Scheduled Jobs

The backend uses scheduled jobs for automated system tasks.

Possible scheduled operations include:

- Notification Processing
- Daily Business Alerts
- Invoice Due Notifications
- Company Status Checks
- Inactive Company Monitoring

---

# 📑 Audit Logs

Important operations are recorded for traceability.

### Audit Information

```text
Company ID
User ID
Role
Action
Module
Record ID
Description
IP Address
User Agent
Timestamp
```

### Example Events

- Login
- Logout
- Company Update
- Customer CRUD
- Product CRUD
- Quotation Created
- Quotation Updated
- Invoice Created
- Payment Recorded
- Email Sent
- KYC Documents Uploaded
- Manual KYC
- Password Reset
- CRM Activity

---

# 🔐 Role-Based Access Control

The application uses both role-based and permission-based access.

---

## 👑 Super Admin

Platform-level administrator.

### Can Manage

- Companies
- Company Admins
- Company KYC
- Manual KYC
- Subscriptions
- Trial Requests
- Audit Logs
- Inactive Companies
- Platform Notifications
- Company Status

---

## 🏢 Company Admin

Has full access to the company's business workspace.

### Can Manage

- Company
- Branches
- Customers
- Products
- Vendors
- Quotations
- Invoices
- Payments
- Expenses
- Taxes
- Reports
- Accountants
- Sales Users
- Role Permissions
- Billing Template
- Company Settings
- Subscription
- Notifications
- Audit Logs
- CRM Configuration

---

## 🧮 Accountant

Default module access includes:

- Branches
- Customers
- Products
- Invoices
- Payments
- Expenses
- Taxes
- Reports

Additional permissions can be enabled by the Company Admin.

---

## 💼 Sales User

Default module access includes:

- Branches
- Customers
- Products
- Quotations
- Invoices

Additional permissions can be enabled by the Company Admin.

---

# ⚙️ Dynamic Permission System

Company Admin can enable or disable optional modules for Accountant and Sales User.

Example:

```text
Company Admin
      │
      ▼
Role Permissions
      │
      ▼
Enable Vendors for Accountant
      │
      ▼
Save Permissions
      │
      ▼
Accountant Refreshes
      │
      ▼
Vendor Module Appears
```

If access to a module is removed while a user is currently on that page, the application can redirect the user back to the Dashboard.

Frontend visibility is only for UX.

The backend independently validates permissions for protected operations.

---

# 🧭 Dashboard Navigation

Business users see grouped navigation.

```text
Dashboard

Users
├── Accountants
├── Sales Users
└── Role Permissions

Business
├── Customers
├── Products
├── Vendors
├── Branches
└── Company

Sales
├── Quotations
├── Invoices
└── Payments

Finance
├── Expenses
├── Taxes
├── Reports
└── Billing / Subscription

Settings
├── Profile
├── Notifications
├── Billing Template
├── Company Settings
└── Audit Logs
```

Visible options depend on the logged-in user's role and permissions.

---

# 🌙 Theme & Responsive UI

The application supports:

- Light Theme
- Dark Theme
- Responsive Dashboard
- Mobile Layout
- Tablet Layout
- Desktop Layout
- Mobile Sidebar Drawer
- Collapsible Desktop Sidebar
- Responsive Tables
- Responsive Modals

Theme preference is persisted locally.

---

# 📁 Project Structure

```text
Smart-Invoice-Billing-Management/
│
├── client/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   └── App.jsx
│   │
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middlewares/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── cron/
│   │   └── app.js
│   │
│   ├── uploads/
│   ├── server.js
│   ├── package.json
│   └── .env
│
├── README.md
└── .gitignore
```

> Adjust directory names if your local repository uses a slightly different frontend/backend folder structure.

---

# 🛠️ Tech Stack

## Frontend

- React
- Vite
- JavaScript
- Tailwind CSS
- React Router DOM
- Axios
- Lucide React
- React Hot Toast

---

## Backend

- Node.js
- Express.js
- MySQL2
- JSON Web Token (JWT)
- bcrypt
- Socket.IO
- Multer
- Nodemailer
- Puppeteer
- Node Cron

---

## Database

- MySQL

---

## Integrations

- External CRM REST API
- SMTP
- KYC Verification APIs
- Puppeteer PDF Engine

---

# 🔐 Security

The system applies security at multiple layers.

### Authentication

- JWT Authentication
- Protected API Routes
- Token Validation

### Authorization

- Role Authorization
- Module Permission Authorization
- Company-Level Data Isolation

### Password Security

- bcrypt Password Hashing
- Reset Token Expiry
- Hashed Password Reset Tokens

### Data Security

- Server-Side Validation
- Parameterized SQL Queries
- Company Scoped Queries
- Role Scoped Operations
- KYC Restrictions
- Audit Logs

### Secrets

Sensitive configuration must remain inside environment variables or secure server-side storage.

Never commit:

```text
Database Password
JWT Secret
SMTP Password
CRM API Keys
KYC API Keys
Production Credentials
```

---

# 🌐 Environment Variables

## Backend

Create:

```text
server/.env
```

Example:

```env
# =====================================
# SERVER
# =====================================

PORT=5000
NODE_ENV=development

FRONTEND_URL=http://localhost:5173
BACKEND_PUBLIC_URL=http://localhost:5000
CORS_ORIGIN=http://localhost:5173


# =====================================
# DATABASE
# =====================================

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_database_password
DB_NAME=smart_invoice_system


# =====================================
# AUTHENTICATION
# =====================================

JWT_SECRET=your_long_random_jwt_secret


# =====================================
# EMAIL
# =====================================

EMAIL_USER=your_email@example.com
EMAIL_PASS=your_app_password


# =====================================
# KYC / SANDBOX
# =====================================

SANDBOX_API_KEY=your_sandbox_api_key
SANDBOX_API_SECRET=your_sandbox_api_secret
SANDBOX_BASE_URL=your_sandbox_base_url


# =====================================
# CRM
# =====================================

CRM_BASE_URL=your_crm_base_url
```

> Environment variable names should match the actual configuration used in the deployment.

---

## Frontend

Create:

```text
client/.env
```

Example:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Never expose backend secrets inside frontend environment variables.

---

# 🚀 Installation

## Prerequisites

Install the following:

- Node.js
- npm
- MySQL
- Git
- Chrome / Chromium for Puppeteer PDF generation

Recommended development tools:

- Visual Studio Code
- MySQL Workbench
- Postman

---

## 1. Clone Repository

```bash
git clone https://github.com/Anshul92881/Smart-Invoice-Billing-Management.git

cd Smart-Invoice-Billing-Management
```

---

## 2. Install Frontend

```bash
cd client

npm install
```

Start frontend:

```bash
npm run dev
```

Frontend development URL:

```text
http://localhost:5173
```

---

## 3. Install Backend

Open another terminal:

```bash
cd server

npm install
```

Start backend:

```bash
npm run dev
```

Backend development URL:

```text
http://localhost:5000
```

---

# 🗄️ Database Setup

Create MySQL database:

```sql
CREATE DATABASE smart_invoice_system;
```

Select database:

```sql
USE smart_invoice_system;
```

Import the project SQL schema/database backup.

Update database credentials inside:

```text
server/.env
```

---

# 🔗 Main API Modules

The backend is organized into modular API routes.

```text
/api/auth
/api/companies
/api/branches
/api/customers
/api/products
/api/vendors
/api/quotations
/api/invoices
/api/payments
/api/expenses
/api/taxes
/api/reports
/api/notifications
/api/subscriptions
/api/kyc
```

---

# 🔑 Authentication APIs

```text
POST   /api/auth/login
POST   /api/auth/logout

GET    /api/auth/me

POST   /api/auth/company-register

POST   /api/auth/forgot-password
POST   /api/auth/reset-password/:token

PATCH  /api/auth/change-password
```

---

# 📝 Quotation APIs

```text
POST   /api/quotations
GET    /api/quotations
GET    /api/quotations/:id

PUT    /api/quotations/:id

PATCH  /api/quotations/:id/status
PATCH  /api/quotations/:id/cancel

GET    /api/quotations/:id/download

POST   /api/quotations/send-email/:id

POST   /api/quotations/:id/convert-to-invoice

POST   /api/quotations/:id/push-to-crm
```

---

# 🧾 Invoice APIs

```text
POST   /api/invoices

GET    /api/invoices
GET    /api/invoices/:id

GET    /api/invoices/:id/download

POST   /api/invoices/send-email/:id

PATCH  /api/invoices/:id/cancel

POST   /api/invoices/:id/push-to-crm
```

There is intentionally no normal invoice editing API.

```text
PUT /api/invoices/:id ❌
```

---

# 🔒 KYC APIs

The KYC module contains APIs for:

```text
Aadhaar OTP
Aadhaar Verification
PAN Verification
GST Verification
TAN Verification
Document Upload
KYC Status
SuperAdmin Manual KYC
KYC Unblock
KYC Request Review
```

SuperAdmin manual KYC operations use the target company ID.

Example:

```text
/api/kyc/superadmin/:companyId/...
```

---

# 🗃️ Database Overview

Major database tables include business entities similar to:

```text
tbl_companies
tbl_company_branches
tbl_users

tbl_customers
tbl_products
tbl_vendors

tbl_quotations
tbl_quotation_items

tbl_invoices
tbl_invoice_items

tbl_payments
tbl_expenses
tbl_taxes

tbl_notifications
tbl_audit_logs

tbl_company_kyc_documents
tbl_kyc_verification_logs

tbl_subscription_plans
tbl_company_subscriptions
```

Additional tables may be used for settings, billing configuration, payment history, and integration metadata.

---

# 🔄 Complete Business Workflow

```text
Company Registration
        │
        ▼
Company Created
        │
        ▼
HQ Branch Created
        │
        ▼
Company Admin Created
        │
        ▼
KYC Verification
        │
        ▼
Company Activated
        │
        ▼
Company Settings
        │
        ▼
Create Branches
        │
        ▼
Create Customers
        │
        ▼
Create Products
        │
        ▼
Create Quotation
        │
        ▼
Send Quotation
        │
        ▼
Quotation Accepted
        │
        ▼
Convert to Invoice
        │
        ▼
Send Invoice
        │
        ▼
Record Payment
        │
        ▼
Invoice Paid
        │
        ▼
Reports Updated
        │
        ▼
Notifications + Audit Logs
```

CRM synchronization can be performed from relevant quotation and invoice workflows.

---

# 📌 Important Business Rules

### Multi-Tenant Isolation

Every business record should be associated with its company.

```text
Company A
   │
   └── Can access only Company A data

Company B
   │
   └── Can access only Company B data
```

---

### KYC

```text
KYC Incomplete
     ↓
Dashboard exploration may be allowed
     ↓
Protected CRUD actions blocked

KYC Approved / Manual Verified
     ↓
Business operations enabled
```

---

### Quotations

```text
Draft       → Editable
Sent        → Editable
Accepted    → Locked
Converted   → Locked
Cancelled   → Locked
```

---

### Invoices

```text
Created Invoice
      ↓
Immutable Financial Document
      ↓
No Direct Editing
```

---

### Permissions

Frontend permission checks improve user experience.

Backend permission middleware provides actual authorization.

---

### CRM

The same Smart Invoice record must always use the same CRM external ID.

```text
Invoice ID 52
     ↓
externalId = "52"

Quotation ID 31
     ↓
externalId = "31"
```

---

# 📷 Main Modules

- Dashboard
- Company Management
- Company KYC
- User Management
- Role Permissions
- Branch Management
- Customer Management
- Product Management
- Vendor Management
- Quotation Management
- Invoice Management
- Payment Management
- Expense Management
- Tax Management
- Reports
- Subscription Management
- Billing Templates
- Company Settings
- Notifications
- Audit Logs
- CRM Integration

---

# 🎯 Current Status

## ✅ Implemented / Available

- Multi-Tenant Architecture
- Authentication
- JWT Authorization
- Role-Based Access
- Dynamic Permissions
- Company Registration
- HQ Branch Creation
- Company Management
- Branch Management
- Customer Management
- Product Management
- Vendor Management
- Quotations
- Quotation Editing Rules
- Quotation to Invoice Conversion
- Invoice Generation
- Invoice Immutable Workflow
- PDF Engine
- Email Engine
- Payments
- Expenses
- Taxes
- Reports
- Subscription Module
- Free Trial Workflow
- KYC Verification
- SuperAdmin Manual KYC Flow
- Notifications
- Socket.IO Integration
- Audit Logs
- CRM Customer Sync
- CRM Invoice Sync
- CRM Quotation Sync
- Responsive UI
- Dark / Light Theme
- Permission-Based Sidebar

---

# 🚀 Future Enhancements

Planned or possible future improvements:

- Protected / Signed Document URLs
- Advanced Inventory Management
- Purchase Orders
- Credit Notes
- Debit Notes
- Recurring Invoices
- Payment Gateway Integration
- Automated Payment Reminders
- Customer Portal
- Vendor Portal
- E-Invoice Integration
- E-Way Bill Integration
- Multi-Currency Improvements
- Multi-Language Support
- AI Financial Insights
- OCR Bill Scanner
- Cloud Document Storage
- Advanced API Documentation
- Mobile Application
- Two-Factor Authentication
- Automated Database Backups

---

# 🧪 Production Checklist

Before deploying:

```text
✓ Production database configured
✓ Strong JWT secret configured
✓ CORS restricted to production frontend
✓ HTTPS enabled
✓ SMTP tested
✓ KYC credentials configured
✓ CRM integration tested
✓ Puppeteer / Chromium installed
✓ PDF generation tested
✓ File uploads validated
✓ Sensitive documents protected
✓ Socket.IO tested
✓ Cron jobs tested
✓ Database backups configured
✓ Environment files excluded from Git
✓ SuperAdmin flow tested
✓ Company Admin flow tested
✓ Accountant permissions tested
✓ Sales User permissions tested
✓ KYC workflow tested
✓ Subscription expiry tested
✓ Email attachments tested
✓ CRM synchronization tested
```

---

# 🐞 Troubleshooting

## Backend Not Starting

Check:

```text
.env configuration
MySQL service
Database credentials
PORT availability
node_modules
```

Then run:

```bash
npm install
npm run dev
```

---

## Frontend Cannot Connect to Backend

Verify:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Also verify backend CORS configuration.

---

## 401 Unauthorized

Check:

```text
JWT token exists
Authorization header is attached
Token is valid
Token is not expired
```

---

## 403 Forbidden

Possible reasons:

```text
Role not allowed
Permission disabled
KYC restriction
Company restriction
Subscription restriction
```

---

## PDF Generation Error

Check:

```text
Puppeteer installation
Chrome / Chromium installation
FRONTEND_URL
Backend public URL
Document route
PDF save directory
Authentication
```

---

## Email Error

Check:

```text
SMTP Host
SMTP Port
SMTP User
SMTP Password
App Password
Sender Email
Firewall
```

---

## CRM Push Error

Check:

```text
Company CRM API key
CRM_BASE_URL
CRM availability
Customer data
Customer CRM sync
PDF availability
Document payload
```

---

# 🔐 Git Security

Never commit sensitive files.

Recommended `.gitignore` entries:

```gitignore
node_modules/
.env
.env.*
dist/
coverage/

*.log

server/node_modules/

.DS_Store
Thumbs.db
```

Production KYC documents, credentials, and private business files should be handled according to the deployment storage and security strategy.

---

# 👨‍💻 Developed By

**Anshul**

### Smart Invoice & Billing Management SaaS

Built using:

**React · Node.js · Express.js · MySQL · Tailwind CSS**

---

# ⭐ Support

If you find this project useful:

⭐ Star the repository  
🍴 Fork the repository  
💡 Contribute improvements  
🐞 Report issues

---

# 📜 License

This project is currently intended for educational, portfolio, internal business, and commercial customization purposes.

Before public or production distribution, add and review the appropriate software license for your use case.

---
