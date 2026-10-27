const escapeHtml = (value = "") => {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

const greetingEmailTemplate = ({
  recipientName,
  occasionName,
  message,
  senderName,
  hasBanner = false,
}) => {
  const safeRecipientName = escapeHtml(recipientName || "Customer");
  const safeOccasionName = escapeHtml(occasionName);
  const safeSenderName = escapeHtml(senderName || "Smart Invoice");
  const year = new Date().getFullYear();

  const safeMessage = escapeHtml(message)
    .replace(/\{\{\s*recipient_name\s*\}\}/gi, safeRecipientName)
    .replace(/\r?\n/g, "<br />");

  const preheader = escapeHtml(
    String(message || "")
      .replace(/\{\{\s*recipient_name\s*\}\}/gi, recipientName || "Customer")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 110),
  );

  return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0"
    />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />

    <title>${safeOccasionName}</title>

    <style>
      body,
      table,
      td,
      a {
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
      }

      table,
      td {
        mso-table-lspace: 0pt;
        mso-table-rspace: 0pt;
      }

      img {
        -ms-interpolation-mode: bicubic;
        border: 0;
        outline: none;
        text-decoration: none;
      }

      body {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
      }

      @media only screen and (max-width: 620px) {
        .wrapper {
          padding: 12px !important;
        }

        .card {
          border-radius: 12px !important;
        }

        .header {
          padding: 30px 20px !important;
        }

        .title {
          font-size: 28px !important;
          letter-spacing: 0.2px !important;
        }

        .content {
          padding-left: 22px !important;
          padding-right: 22px !important;
        }

        .greeting-message {
          font-size: 17px !important;
          line-height: 1.75 !important;
        }

        .footer {
          padding: 20px !important;
        }
      }
    </style>
  </head>

  <body
    style="
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: Arial, Helvetica, sans-serif;
      color: #0f172a;
    "
  >
    <!-- Hidden inbox preview -->
    <div
      style="
        display: none;
        max-height: 0;
        overflow: hidden;
        opacity: 0;
        mso-hide: all;
        font-size: 1px;
        line-height: 1px;
        color: #f1f5f9;
      "
    >
      ${preheader}
      &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
    </div>

    <table
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      role="presentation"
      bgcolor="#f1f5f9"
      style="background-color: #f1f5f9"
    >
      <tr>
        <td
          align="center"
          class="wrapper"
          style="padding: 32px 16px"
        >
          <table
            width="100%"
            cellpadding="0"
            cellspacing="0"
            border="0"
            role="presentation"
            class="card"
            style="
              max-width: 620px;
              background-color: #ffffff;
              border-radius: 16px;
              overflow: hidden;
              border: 1px solid #e2e8f0;
              box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
            "
          >
            <!-- Accent line -->
            <tr>
              <td
                height="5"
                bgcolor="#4f46e5"
                style="
                  height: 5px;
                  line-height: 5px;
                  font-size: 0;
                  background-color: #4f46e5;
                "
              >
                &nbsp;
              </td>
            </tr>

            <!-- Header -->
            <tr>
              <td
                align="center"
                class="header"
                bgcolor="#1e1b4b"
                style="
                  padding: 40px 32px;
                  background-color: #1e1b4b;
                  background-image: linear-gradient(
                    135deg,
                    #1e1b4b 0%,
                    #312e81 100%
                  );
                "
              >
                <p
                  style="
                    margin: 0 0 10px;
                    font-family: Arial, Helvetica, sans-serif;
                    font-size: 12px;
                    line-height: 1.4;
                    font-weight: 700;
                    letter-spacing: 2px;
                    text-transform: uppercase;
                    color: #c7d2fe;
                  "
                >
                  Warm wishes
                </p>

                <h1
                  class="title"
                  style="
                    margin: 0;
                    font-family: Georgia, 'Times New Roman', serif;
                    font-size: 36px;
                    line-height: 1.25;
                    font-weight: 700;
                    letter-spacing: 0.4px;
                    color: #ffffff;
                  "
                >
                  ${safeOccasionName}
                </h1>
              </td>
            </tr>

            ${
              hasBanner
                ? `
            <!-- Greeting banner -->
            <tr>
              <td style="padding: 0; line-height: 0; font-size: 0">
                <img
                  src="cid:greeting-banner"
                  alt="${safeOccasionName}"
                  width="620"
                  style="
                    display: block;
                    width: 100%;
                    max-width: 620px;
                    height: auto;
                  "
                />
              </td>
            </tr>
            `
                : ""
            }

            <!-- Greeting content -->
            <tr>
              <td
                class="content"
                style="padding: 40px 40px 14px"
              >
                <p
                  style="
                    margin: 0 0 22px;
                    font-family: Georgia, 'Times New Roman', serif;
                    font-size: 20px;
                    line-height: 1.5;
                    font-weight: 700;
                    color: #0f172a;
                  "
                >
                  Dear ${safeRecipientName},
                </p>

                <div
                  class="greeting-message"
                  style="
                    font-family: Georgia, 'Times New Roman', serif;
                    font-size: 18px;
                    line-height: 1.85;
                    font-weight: 400;
                    letter-spacing: 0.1px;
                    color: #334155;
                  "
                >
                  ${safeMessage}
                </div>
              </td>
            </tr>

            <!-- Signature -->
            <tr>
              <td
                class="content"
                style="padding: 16px 40px 40px"
              >
                <table
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  role="presentation"
                >
                  <tr>
                    <td
                      style="
                        border-left: 3px solid #4f46e5;
                        padding-left: 16px;
                      "
                    >
                      <p
                        style="
                          margin: 0 0 5px;
                          font-family: Georgia, 'Times New Roman', serif;
                          font-size: 15px;
                          line-height: 1.5;
                          font-style: italic;
                          color: #64748b;
                        "
                      >
                        With warm regards,
                      </p>

                      <p
                        style="
                          margin: 0;
                          font-family: Georgia, 'Times New Roman', serif;
                          font-size: 18px;
                          line-height: 1.5;
                          font-weight: 700;
                          color: #0f172a;
                        "
                      >
                        ${safeSenderName}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td
                align="center"
                class="footer"
                bgcolor="#f8fafc"
                style="
                  padding: 22px 32px;
                  background-color: #f8fafc;
                  border-top: 1px solid #e2e8f0;
                "
              >
                <p
                  style="
                    margin: 0 0 6px;
                    font-family: Arial, Helvetica, sans-serif;
                    font-size: 12px;
                    line-height: 1.6;
                    color: #64748b;
                  "
                >
                  This is an automated greeting sent on behalf of
                  <strong style="color: #334155">
                    ${safeSenderName}
                  </strong>.
                </p>

                <p
                  style="
                    margin: 0;
                    font-family: Arial, Helvetica, sans-serif;
                    font-size: 12px;
                    line-height: 1.6;
                    color: #94a3b8;
                  "
                >
                  &copy; ${year} ${safeSenderName}. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;
};

export default greetingEmailTemplate;
