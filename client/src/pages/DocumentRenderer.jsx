const APP_ORIGIN =
  import.meta.env?.VITE_API_ORIGIN ||
  import.meta.env?.VITE_SERVER_URL ||
  "http://localhost:5000";

const DEFAULT_TEMPLATE = {
  show_logo: true,
  show_company_gst_pan: true,
  show_branch_details: true,
  show_customer_gstin: true,
  show_hsn_sac: true,
  show_item_description: true,
  show_tax_breakdown: true,
  show_terms: true,
  show_notes: true,
  show_bank_details: true,
  show_signature: true,
  show_qr_code: false,
};

const firstValue = (...values) =>
  values.find(
    (value) => value !== undefined && value !== null && value !== "",
  ) || "";

const formatMoney = (value, currency = "INR") => {
  const symbol = currency === "USD" ? "$" : "₹";

  return `${symbol} ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (date) => {
  if (!date) return "-";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getLogoUrl = (logo) => {
  if (!logo) return "";
  const value = String(logo);

  if (value.startsWith("http")) return value;
  if (value.startsWith("/upload")) return `${APP_ORIGIN}${value}`;
  if (value.startsWith("/uploads")) return `${APP_ORIGIN}${value}`;

  return `${APP_ORIGIN}/upload/company-logos/${value}`;
};

const normalizeTemplate = (template = {}) => ({
  ...DEFAULT_TEMPLATE,
  ...template,
});

const normalizeCompany = (company = {}) => ({
  name: firstValue(company.name, company.company_name, "Your Company"),
  address: firstValue(company.address, company.business_address, "-"),
  email: firstValue(company.email, company.business_email, ""),
  phone: firstValue(company.phone, company.business_phone, ""),
  gstNumber: firstValue(
    company.gstNumber,
    company.gst_number,
    company.gstin,
    company.business_gst_number,
  ),
  panNumber: firstValue(
    company.panNumber,
    company.pan_number,
    company.pan,
    company.business_pan_number,
  ),
  logoUrl: firstValue(
    company.logoUrl,
    getLogoUrl(company.logo || company.logo_url || company.business_logo),
  ),

  authorizedSignatoryName: firstValue(
    company.authorizedSignatoryName,
    company.authorized_signatory_name,
    "",
  ),
});

const normalizeBranch = (branch = {}) => ({
  branchName: firstValue(branch.branchName, branch.branch_name, "Head Office"),
  branchCode: firstValue(branch.branchCode, branch.branch_code, ""),
  address: firstValue(branch.address, branch.branch_address, ""),
  gstNumber: firstValue(branch.gstNumber, branch.gst_number, ""),
});

const normalizeBank = (bank = {}) => ({
  bankName: firstValue(bank.bankName, bank.bank_name, ""),
  accountHolderName: firstValue(
    bank.accountHolderName,
    bank.account_holder_name,
    "",
  ),
  accountNumber: firstValue(bank.accountNumber, bank.account_number, ""),
  ifscCode: firstValue(bank.ifscCode, bank.ifsc_code, ""),
  upiId: firstValue(bank.upiId, bank.upi_id, ""),
  invoiceTerms: firstValue(bank.invoiceTerms, bank.invoice_terms, ""),
  paymentInstructions: firstValue(
    bank.paymentInstructions,
    bank.payment_instructions,
    "",
  ),
  authorizedSignatoryName: firstValue(
    bank.authorizedSignatoryName,
    bank.authorized_signatory_name,
    "",
  ),
  currency: firstValue(bank.currency, "INR"),
});

const normalizeCustomer = (customer = {}) => ({
  name: firstValue(
    customer.name,
    customer.customer_name,
    customer.company_name,
    "-",
  ),
  companyName: firstValue(customer.companyName, customer.company_name, ""),
  address: firstValue(
    customer.address,
    customer.billing_address,
    customer.shipping_address,
    "-",
  ),
  shippingAddress: firstValue(
    customer.shippingAddress,
    customer.shipping_address,
    "",
  ),
  gstin: firstValue(customer.gstin, customer.customer_gstin, ""),
  email: firstValue(customer.email, customer.customer_email, ""),
  phone: firstValue(customer.phone, customer.customer_phone, ""),
});

const normalizeDocument = (document = {}, type = "invoice") => {
  const isInvoice = type === "invoice";

  return {
    number: firstValue(
      document.number,
      document.document_number,
      isInvoice ? document.invoice_number : document.quotation_number,
      "-",
    ),
    date: firstValue(
      document.date,
      isInvoice ? document.invoice_date : document.quotation_date,
      "",
    ),
    dueDate: firstValue(
      document.dueDate,
      document.due_date,
      document.expiry_date,
      "",
    ),
    quotationReference: firstValue(
      document.quotation_reference,
      document.quotationReference,
      "",
    ),
    status: firstValue(document.status, "draft"),
    notes: firstValue(document.notes, ""),
    terms: firstValue(document.terms, document.terms_conditions, ""),
    subtotal: Number(firstValue(document.subtotal, 0)),
    taxAmount: Number(
      firstValue(
        document.taxAmount,
        document.tax_amount,
        document.total_tax,
        0,
      ),
    ),
    discount: Number(
      firstValue(document.discount, document.discount_amount, 0),
    ),
    paidAmount: Number(
      firstValue(document.paidAmount, document.paid_amount, 0),
    ),
    balanceDue: Number(
      firstValue(document.balanceDue, document.balance_due, 0),
    ),
    totalAmount: Number(
      firstValue(document.totalAmount, document.total_amount, 0),
    ),
    roundOff: Number(firstValue(document.roundOff, document.round_off, 0)),
  };
};

const normalizeItems = (items = []) =>
  items.map((item, index) => {
    const quantity = Number(firstValue(item.quantity, item.qty, 0));
    const price = Number(firstValue(item.price, item.rate, 0));
    const taxRate = Number(firstValue(item.tax_rate, item.gstRate, 0));
    const baseAmount = Number(firstValue(item.amount, quantity * price));
    const taxAmount = Number(
      firstValue(item.tax_amount, item.tax, (baseAmount * taxRate) / 100),
    );
    const lineTotal = Number(
      firstValue(item.line_total, item.total, baseAmount + taxAmount),
    );

    return {
      id: firstValue(item.id, index),
      name: firstValue(item.name, item.item_name, item.product_name, "-"),
      description: firstValue(item.description, item.desc, ""),
      hsnSac: firstValue(item.hsnSac, item.hsn_sac_code, item.hsn, "-"),
      quantity,
      unit: firstValue(item.unit, item.unit_type, "Nos"),
      price,
      taxRate,
      taxAmount,
      amount: baseAmount,
      lineTotal,
    };
  });

function DocumentRenderer({
  type = "invoice",
  template = {},
  company = {},
  branch = {},
  bank = {},
  customer = {},
  document = {},
  items = [],
  className = "",
}) {
  const isInvoice = type === "invoice";
  const settings = normalizeTemplate(template);
  const companyView = normalizeCompany(company);
  const branchView = normalizeBranch(branch);
  const bankView = normalizeBank(bank);
  const customerView = normalizeCustomer(customer);
  const docView = normalizeDocument(document, type);
  const itemRows = normalizeItems(items);

  const currency = bankView.currency || document.currency || "INR";

  const subtotal =
    docView.subtotal ||
    itemRows.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const totalTax =
    docView.taxAmount ||
    itemRows.reduce((sum, item) => sum + Number(item.taxAmount || 0), 0);

  const discount = docView.discount || 0;

  const grandTotal =
    docView.totalAmount ||
    itemRows.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0) -
      discount +
      docView.roundOff;

  const cgst = totalTax / 2;
  const sgst = totalTax / 2;

  const hasBankDetails =
    bankView.bankName ||
    bankView.accountHolderName ||
    bankView.accountNumber ||
    bankView.ifscCode ||
    bankView.upiId;

  const title = isInvoice ? "TAX INVOICE" : "QUOTATION";
  const numberLabel = isInvoice ? "Invoice No." : "Quotation No.";
  const dueLabel = isInvoice ? "Due Date" : "Valid Until";

  return (
    <div
      className={`mx-auto w-full max-w-[920px] bg-slate-100 text-slate-900 print:max-w-none print:bg-white print:p-0 ${className}`}
    >
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white text-[12px] leading-normal shadow-sm print:rounded-none print:border-0 print:shadow-none">
        <div className="grid grid-cols-[1fr_270px] gap-5 border-b border-slate-200 px-6 py-5 print:px-4 print:py-3">
          <div className="min-w-0">
            <div className="flex items-start gap-3">
              {settings.show_logo !== false && (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5">
                  {companyView.logoUrl ? (
                    <img
                      src={companyView.logoUrl}
                      alt="Company Logo"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-xl font-black text-blue-600">
                      {(companyView.name || "C").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
              )}

              <div className="min-w-0">
                <h2 className="text-[22px] font-black uppercase leading-tight tracking-tight text-slate-950 print:text-[20px]">
                  {companyView.name}
                </h2>

                <p className="mt-1 max-w-[560px] whitespace-pre-line text-[12px] leading-5 text-slate-600">
                  {companyView.address}
                </p>

                {(companyView.phone || companyView.email) && (
                  <p className="mt-1.5 text-[12px] font-medium text-slate-600">
                    {companyView.phone || "-"} · {companyView.email || "-"}
                  </p>
                )}

                {settings.show_company_gst_pan !== false && (
                  <p className="mt-1.5 text-[12px] font-bold text-slate-800">
                    GSTIN: {companyView.gstNumber || "-"}
                    <span className="mx-2 text-slate-300">|</span>
                    PAN: {companyView.panNumber || "-"}
                  </p>
                )}

                {settings.show_branch_details !== false && (
                  <p className="mt-1.5 text-[12px] text-slate-600">
                    <span className="font-bold text-slate-800">Branch:</span>{" "}
                    {branchView.branchName || "Head Office"}
                    {branchView.branchCode ? ` (${branchView.branchCode})` : ""}
                    {branchView.address ? ` · ${branchView.address}` : ""}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50">
            <div className="border-b border-slate-200 px-4 py-3 text-right">
              <h1 className="mt-1 text-[24px] font-black uppercase leading-none text-slate-950 print:text-[22px]">
                {title}
              </h1>
            </div>

            <div className="px-4 py-2.5">
              <DocMeta label={numberLabel} value={docView.number} />

              {isInvoice && docView.quotationReference && (
                <DocMeta
                  label="Quotation Ref."
                  value={docView.quotationReference}
                />
              )}

              <DocMeta label="Date" value={formatDate(docView.date)} />

              <DocMeta label={dueLabel} value={formatDate(docView.dueDate)} />

              <DocMeta label="Status" value={docView.status} capitalize />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 items-start border-b border-slate-200">
          <PartyBox
            title={isInvoice ? "Bill To" : "Prepared For"}
            name={customerView.name}
            companyName={customerView.companyName}
            address={customerView.address}
            gstin={
              settings.show_customer_gstin !== false ? customerView.gstin : ""
            }
            email={customerView.email}
            phone={customerView.phone}
          />

          <PartyBox
            title={isInvoice ? "Ship To" : "Quotation Details"}
            name={isInvoice ? customerView.name : "Commercial Proposal"}
            address={
              isInvoice
                ? customerView.shippingAddress || customerView.address
                : "This quotation is valid until the expiry date mentioned above."
            }
            gstin={
              isInvoice && settings.show_customer_gstin !== false
                ? customerView.gstin
                : ""
            }
          />
        </div>

        <div className="px-6 py-5 print:px-4 print:py-3">
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <PreviewTh className="w-9 text-center">#</PreviewTh>
                  <PreviewTh className="text-left">Item / Service</PreviewTh>
                  {settings.show_hsn_sac !== false && (
                    <PreviewTh className="w-20 text-center">HSN/SAC</PreviewTh>
                  )}
                  <PreviewTh className="w-14 text-center">Qty</PreviewTh>
                  <PreviewTh className="w-14 text-center">Unit</PreviewTh>
                  <PreviewTh className="w-24 text-right">Rate</PreviewTh>
                  {settings.show_tax_breakdown !== false && (
                    <PreviewTh className="w-16 text-center">GST</PreviewTh>
                  )}
                  <PreviewTh className="w-28 text-right" last>
                    Amount
                  </PreviewTh>
                </tr>
              </thead>

              <tbody>
                {itemRows.length > 0 ? (
                  itemRows.map((item, index) => (
                    <tr
                      key={item.id || index}
                      className="border-t border-slate-200"
                    >
                      <PreviewTd className="text-center font-semibold text-slate-500">
                        {index + 1}
                      </PreviewTd>

                      <PreviewTd>
                        <p className="font-bold text-slate-950">{item.name}</p>
                        {settings.show_item_description !== false &&
                          item.description && (
                            <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                              {item.description}
                            </p>
                          )}
                      </PreviewTd>

                      {settings.show_hsn_sac !== false && (
                        <PreviewTd className="text-center text-slate-600">
                          {item.hsnSac}
                        </PreviewTd>
                      )}

                      <PreviewTd className="text-center">
                        {item.quantity}
                      </PreviewTd>
                      <PreviewTd className="text-center">{item.unit}</PreviewTd>

                      <PreviewTd className="text-right">
                        {Number(item.price || 0).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </PreviewTd>

                      {settings.show_tax_breakdown !== false && (
                        <PreviewTd className="text-center">
                          {Number(item.taxRate || 0)}%
                        </PreviewTd>
                      )}

                      <PreviewTd
                        className="text-right font-bold text-slate-950"
                        last
                      >
                        {Number(
                          item.amount || item.lineTotal || 0,
                        ).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </PreviewTd>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid grid-cols-[1fr_300px] gap-4 print:mt-3">
            <div className="space-y-3">
              {settings.show_tax_breakdown !== false && (
                <InfoCard title="GST Summary">
                  <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                    <SummaryMini
                      label="Taxable Value"
                      value={formatMoney(subtotal, currency)}
                    />
                    <SummaryMini
                      label="CGST"
                      value={formatMoney(cgst, currency)}
                    />
                    <SummaryMini
                      label="SGST"
                      value={formatMoney(sgst, currency)}
                    />
                    <SummaryMini
                      label="Total Tax"
                      value={formatMoney(totalTax, currency)}
                    />
                  </div>
                </InfoCard>
              )}

              {settings.show_bank_details !== false && (
                <InfoCard title="Payment / Bank Details">
                  {hasBankDetails ? (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      <BankRow label="Bank" value={bankView.bankName} />
                      <BankRow
                        label="Holder"
                        value={bankView.accountHolderName}
                      />
                      <BankRow label="A/C No." value={bankView.accountNumber} />
                      <BankRow label="IFSC" value={bankView.ifscCode} />
                      <BankRow label="UPI" value={bankView.upiId} />
                    </div>
                  ) : (
                    <p className="text-slate-500">
                      Bank details are not configured.
                    </p>
                  )}
                </InfoCard>
              )}
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <AmountLine
                label="Subtotal"
                value={formatMoney(subtotal, currency)}
              />

              {settings.show_tax_breakdown !== false && (
                <>
                  <AmountLine
                    label="CGST"
                    value={formatMoney(cgst, currency)}
                  />
                  <AmountLine
                    label="SGST"
                    value={formatMoney(sgst, currency)}
                  />
                </>
              )}

              {discount > 0 && (
                <AmountLine
                  label="Discount"
                  value={formatMoney(discount, currency)}
                />
              )}

              {isInvoice && docView.paidAmount > 0 && (
                <AmountLine
                  label="Paid"
                  value={formatMoney(docView.paidAmount, currency)}
                />
              )}

              <div className="flex items-center justify-between bg-blue-600 px-4 py-3 text-white">
                <span className="text-[12px] font-black uppercase tracking-wide">
                  Grand Total
                </span>
                <span className="text-[18px] font-black">
                  {formatMoney(grandTotal, currency)}
                </span>
              </div>
            </div>
          </div>

          {(settings.show_terms !== false || settings.show_notes !== false) && (
            <div className="mt-4 grid grid-cols-2 gap-4 print:mt-3">
              {settings.show_terms !== false && (
                <InfoCard title="Terms & Conditions">
                  <p className="whitespace-pre-line">
                    {docView.terms ||
                      bankView.invoiceTerms ||
                      "Terms and conditions are subject to final approval."}
                  </p>
                </InfoCard>
              )}

              {settings.show_notes !== false && (
                <InfoCard title="Payment Instructions / Notes">
                  <p className="whitespace-pre-line">
                    {docView.notes ||
                      bankView.paymentInstructions ||
                      "Please make payment within the due date."}
                  </p>
                </InfoCard>
              )}
            </div>
          )}

          {settings.show_signature !== false && (
            <div className="mt-6 grid grid-cols-[1fr_230px] items-end gap-8 print:mt-4">
              <div className="text-[11px] leading-5 text-slate-500">
                <p className="font-bold text-slate-700">Declaration:</p>
                <p>
                  We declare that this {isInvoice ? "invoice" : "quotation"}{" "}
                  shows the actual details of goods/services described above and
                  all particulars are true and correct.
                </p>
              </div>

              <div className="text-center">
                <p className="text-[12px] font-bold">For {companyView.name}</p>
                <p className="mt-3 text-[15px] font-semibold text-slate-600">
                  {companyView.authorizedSignatoryName ||
                    bankView.authorizedSignatoryName ||
                    "Authorized Signatory"}
                </p>
                <div className="mx-auto mt-3 h-px w-36 bg-slate-500 print:mt-8" />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-6 py-2.5 text-center text-[11px] font-medium text-slate-500 print:px-4 print:py-2">
          This is a computer generated {isInvoice ? "invoice" : "quotation"}.
          Thank you for your business.
        </div>
      </div>
    </div>
  );
}

function DocMeta({ label, value, capitalize = false }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 py-1.5 text-[12px] last:border-b-0">
      <span className="font-semibold text-slate-500">{label}</span>
      <span
        className={`text-right font-bold text-slate-950 ${capitalize ? "capitalize" : ""}`}
      >
        {value || "-"}
      </span>
    </div>
  );
}

function PartyBox({ title, name, companyName, address, gstin, email, phone }) {
  return (
    <div className="min-h-[125px] border-r border-slate-200 px-6 py-4 last:border-r-0 print:min-h-0 print:px-4 print:py-3">
      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">
        {title}
      </p>

      <div className="space-y-1">
        <h3 className="text-[14px] font-black uppercase tracking-wide text-slate-950">
          {name || "-"}
        </h3>

        {companyName && companyName !== name && (
          <p className="text-[12px] font-semibold text-slate-700">
            {companyName}
          </p>
        )}

        {gstin && (
          <p className="text-[12px] font-bold text-slate-700">GSTIN: {gstin}</p>
        )}

        {address && (
          <p className="whitespace-pre-line text-[12px] leading-5 text-slate-600">
            {address}
          </p>
        )}

        {(phone || email) && (
          <p className="break-all text-[12px] text-slate-600">
            {phone ? `Phone: ${phone}` : ""}
            {phone && email ? " · " : ""}
            {email ? `Email: ${email}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

function PreviewTh({ children, className = "", last = false }) {
  return (
    <th
      className={`border-r border-slate-700 px-2.5 py-2.5 text-[11px] font-black uppercase tracking-wide ${className} ${
        last ? "border-r-0" : ""
      }`}
    >
      {children}
    </th>
  );
}

function PreviewTd({ children, className = "", last = false }) {
  return (
    <td
      className={`border-r border-slate-200 px-2.5 py-2.5 align-top text-[12px] ${className} ${
        last ? "border-r-0" : ""
      }`}
    >
      {children}
    </td>
  );
}

function InfoCard({ title, children }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-700">
        {title}
      </div>
      <div className="px-3 py-2.5 text-[12px] leading-5 text-slate-600">
        {children}
      </div>
    </div>
  );
}

function SummaryMini({ label, value }) {
  return (
    <div className="flex justify-between gap-3 text-[12px]">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold text-slate-900">{value}</span>
    </div>
  );
}

function AmountLine({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 px-4 py-2.5 text-[12px]">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="font-bold text-slate-950">{value}</span>
    </div>
  );
}

function BankRow({ label, value }) {
  return (
    <div className="min-w-0 text-[12px]">
      <span className="font-semibold text-slate-500">{label}: </span>
      <span className="font-bold text-slate-900">{value || "-"}</span>
    </div>
  );
}

export default DocumentRenderer;
