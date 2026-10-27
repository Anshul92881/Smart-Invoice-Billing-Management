import cron from "node-cron";
import db from "../config/db.js";
import { emitNotificationUpdate } from "../utils/socketEvents.js";

const createNotification = async ({
  io,
  company_id,
  user_id,
  type = "system",
  severity = "medium",
  title,
  message,
}) => {
  if (!title || !message) return;

  await db.query(
    `
    INSERT INTO tbl_notifications
    (
      company_id,
      user_id,
      type,
      severity,
      title,
      message,
      is_read
    )
    VALUES (?, ?, ?, ?, ?, ?, 0)
    `,
    [company_id, user_id, type, severity, title, message],
  );

  emitNotificationUpdate({
    io,
    company_id,
    user_id,
  });
};

const processOverdueInvoices = async (io) => {
  const [overdueInvoices] = await db.query(`
    SELECT
      i.id,
      i.company_id,
      i.invoice_number,
      i.balance_due,
      i.due_date,
      c.customer_name
    FROM tbl_invoices i
    LEFT JOIN tbl_customers c
      ON i.customer_id = c.id
    WHERE i.status NOT IN ('paid', 'cancelled')
      AND i.balance_due > 0
      AND i.due_date IS NOT NULL
      AND i.due_date < CURDATE()
  `);

  for (const invoice of overdueInvoices) {
    const [existing] = await db.query(
      `
      SELECT id
      FROM tbl_notifications
      WHERE company_id = ?
        AND title = 'Invoice Overdue'
        AND message LIKE ?
      LIMIT 1
      `,
      [invoice.company_id, `%${invoice.invoice_number}%`],
    );

    if (existing.length > 0) continue;

    const [admins] = await db.query(
      `
      SELECT id
      FROM tbl_users
      WHERE company_id = ?
        AND role = 'company_admin'
        AND status = 'active'
      `,
      [invoice.company_id],
    );

    for (const admin of admins) {
      await createNotification({
        io,
        company_id: invoice.company_id,
        user_id: admin.id,
        type: "system",
        severity: "high",
        title: "Invoice Overdue",
        message: `Invoice ${invoice.invoice_number} is overdue. Pending amount ₹${Number(
          invoice.balance_due || 0,
        ).toFixed(2)}${
          invoice.customer_name ? ` from ${invoice.customer_name}` : ""
        }.`,
      });
    }
  }
};

const processExpiringSubscriptions = async (io) => {
  const [expiringSubscriptions] = await db.query(`
    SELECT
      cs.company_id,
      DATE_FORMAT(cs.renewal_date, '%Y-%m-%d') AS renewal_date,
      c.name AS company_name
    FROM tbl_company_subscriptions cs
    JOIN tbl_companies c
      ON cs.company_id = c.id
    WHERE cs.status = 'active'
      AND cs.renewal_date IS NOT NULL
      AND DATEDIFF(cs.renewal_date, CURDATE()) BETWEEN 0 AND 7
  `);

  for (const subscription of expiringSubscriptions) {
    const renewalDate = subscription.renewal_date;

    const [existing] = await db.query(
      `
      SELECT id
      FROM tbl_notifications
      WHERE company_id = ?
        AND title = 'Subscription Expiry'
        AND message LIKE ?
      LIMIT 1
      `,
      [subscription.company_id, `%${renewalDate}%`],
    );

    if (existing.length > 0) continue;

    const [admins] = await db.query(
      `
      SELECT id
      FROM tbl_users
      WHERE company_id = ?
        AND role = 'company_admin'
        AND status = 'active'
      `,
      [subscription.company_id],
    );

    for (const admin of admins) {
      await createNotification({
        io,
        company_id: subscription.company_id,
        user_id: admin.id,
        type: "subscription",
        severity: "high",
        title: "Subscription Expiry",
        message: `Your subscription will expire on ${renewalDate}. Please renew soon.`,
      });
    }
  }
};

const processDuePaidSubscriptions = async (io) => {
  /*
  |--------------------------------------------------------------------------
  | FIND DUE SUBSCRIPTIONS
  |--------------------------------------------------------------------------
  */

  const [dueSubscriptions] = await db.query(`
    SELECT cs.id
    FROM tbl_company_subscriptions cs
    WHERE cs.status = 'active'
      AND cs.renewal_date IS NOT NULL
      AND cs.renewal_date <= CURDATE()
  `);

  for (const dueSubscription of dueSubscriptions) {
    const connection = await db.getConnection();

    let result = null;

    try {
      await connection.beginTransaction();

      /*
      |--------------------------------------------------------------------------
      | LOCK SUBSCRIPTION
      |--------------------------------------------------------------------------
      */

      const [subscriptionRows] = await connection.query(
        `
        SELECT
          cs.id,
          cs.company_id,
          cs.auto_renewal,
          cs.renewal_date,
          sp.plan_name,
          sp.plan_type,
          sp.price,
          sp.duration_value,
          sp.duration_unit
        FROM tbl_company_subscriptions cs
        JOIN tbl_subscription_plans sp
          ON sp.id = cs.plan_id
        WHERE cs.id = ?
          AND cs.status = 'active'
          AND cs.renewal_date IS NOT NULL
          AND cs.renewal_date <= CURDATE()
        LIMIT 1
        FOR UPDATE
        `,
        [dueSubscription.id],
      );

      if (subscriptionRows.length === 0) {
        await connection.rollback();
        continue;
      }

      const subscription = subscriptionRows[0];

      const planType = String(subscription.plan_type || "").toLowerCase();

      const durationValue = Number(subscription.duration_value);

      const durationUnit = String(
        subscription.duration_unit || "",
      ).toLowerCase();

      /*
      |--------------------------------------------------------------------------
      | FREE PLAN OR AUTO RENEWAL OFF
      |--------------------------------------------------------------------------
      |
      | Free Plan kabhi automatically renew nahi hoga.
      |
      */

      if (planType === "free" || Number(subscription.auto_renewal) !== 1) {
        await connection.query(
          `
          UPDATE tbl_company_subscriptions
          SET
            status = 'expired',
            auto_renewal = CASE
              WHEN ? = 'free' THEN 0
              ELSE auto_renewal
            END
          WHERE id = ?
            AND status = 'active'
          `,
          [planType, subscription.id],
        );

        await connection.commit();

        result = {
          type: "expired",
          subscriptionId: subscription.id,
          companyId: subscription.company_id,
          planName: subscription.plan_name,
        };
      } else {
        /*
        |--------------------------------------------------------------------------
        | PAID PLAN DURATION VALIDATION
        |--------------------------------------------------------------------------
        */

        if (
          planType !== "paid" ||
          !Number.isInteger(durationValue) ||
          durationValue <= 0 ||
          !["day", "month", "year"].includes(durationUnit)
        ) {
          throw new Error(
            `Invalid duration configuration for subscription ${subscription.id}`,
          );
        }

        /*
        |--------------------------------------------------------------------------
        | DEMO AUTO PAYMENT
        |--------------------------------------------------------------------------
        |
        | Payment gateway abhi nahi hai:
        | Invoice aur payment direct paid create honge.
        |
        */

        const invoiceNumber = `SUB-INV-${Date.now()}-${subscription.id}`;

        const transactionId = `AUTO-${Date.now()}-${subscription.id}`;

        const [invoiceResult] = await connection.query(
          `
            INSERT INTO tbl_subscription_invoices
            (
              subscription_id,
              company_id,
              invoice_number,
              amount,
              invoice_status,
              invoice_date,
              due_date
            )
            VALUES
            (
              ?,
              ?,
              ?,
              ?,
              'paid',
              CURDATE(),
              CURDATE()
            )
            `,
          [
            subscription.id,
            subscription.company_id,
            invoiceNumber,
            subscription.price,
          ],
        );

        const [paymentResult] = await connection.query(
          `
            INSERT INTO tbl_subscription_payments
            (
              subscription_id,
              company_id,
              amount,
              payment_status,
              payment_method,
              transaction_id,
              payment_date
            )
            VALUES
            (
              ?,
              ?,
              ?,
              'paid',
              'auto_renewal',
              ?,
              CURDATE()
            )
            `,
          [
            subscription.id,
            subscription.company_id,
            subscription.price,
            transactionId,
          ],
        );

        /*
        |--------------------------------------------------------------------------
        | DYNAMIC NEXT RENEWAL DATE
        |--------------------------------------------------------------------------
        |
        | Supported:
        | 15 days, 4 months, 2 years, etc.
        |
        */

        await connection.query(
          `
          UPDATE tbl_company_subscriptions
          SET
            status = 'active',
            renewal_date = CASE
              WHEN ? = 'day'
                THEN DATE_ADD(
                  CURDATE(),
                  INTERVAL ? DAY
                )

              WHEN ? = 'month'
                THEN DATE_ADD(
                  CURDATE(),
                  INTERVAL ? MONTH
                )

              WHEN ? = 'year'
                THEN DATE_ADD(
                  CURDATE(),
                  INTERVAL ? YEAR
                )
            END
          WHERE id = ?
            AND status = 'active'
          `,
          [
            durationUnit,
            durationValue,

            durationUnit,
            durationValue,

            durationUnit,
            durationValue,

            subscription.id,
          ],
        );

        const [updatedRows] = await connection.query(
          `
            SELECT
              DATE_FORMAT(
                renewal_date,
                '%Y-%m-%d'
              ) AS renewal_date
            FROM tbl_company_subscriptions
            WHERE id = ?
            LIMIT 1
            `,
          [subscription.id],
        );

        const nextRenewalDate = updatedRows[0]?.renewal_date || null;

        await connection.commit();

        result = {
          type: "renewed",
          subscriptionId: subscription.id,
          companyId: subscription.company_id,
          planName: subscription.plan_name,
          invoiceId: invoiceResult.insertId,
          paymentId: paymentResult.insertId,
          invoiceNumber,
          nextRenewalDate,
        };
      }
    } catch (error) {
      try {
        await connection.rollback();
      } catch {
        // Ignore rollback error
      }

      console.error(
        `Subscription processing failed for ${dueSubscription.id}:`,
        error,
      );
    } finally {
      connection.release();
    }

    if (!result) {
      continue;
    }

    /*
    |--------------------------------------------------------------------------
    | NOTIFY COMPANY ADMINS
    |--------------------------------------------------------------------------
    */

    try {
      const [admins] = await db.query(
        `
        SELECT id
        FROM tbl_users
        WHERE company_id = ?
          AND role = 'company_admin'
          AND status = 'active'
        `,
        [result.companyId],
      );

      for (const admin of admins) {
        if (result.type === "expired") {
          await createNotification({
            io,
            company_id: result.companyId,
            user_id: admin.id,
            type: "subscription",
            severity: "high",
            title: "Subscription Expired",
            message:
              `${result.planName} subscription has expired. ` +
              "Please purchase a plan to continue using the product.",
          });
        }

        if (result.type === "renewed") {
          await createNotification({
            io,
            company_id: result.companyId,
            user_id: admin.id,
            type: "subscription",
            severity: "medium",
            title: "Subscription Automatically Renewed",
            message:
              `${result.planName} has been automatically renewed. ` +
              `Invoice ${result.invoiceNumber} is paid. ` +
              `Next renewal date is ${result.nextRenewalDate}.`,
          });
        }
      }
    } catch (notificationError) {
      console.error(
        `Subscription notification failed for ${result.subscriptionId}:`,
        notificationError,
      );
    }

    if (result.type === "expired") {
      console.log(`Subscription ${result.subscriptionId} expired.`);
    }

    if (result.type === "renewed") {
      console.log(
        `Subscription ${result.subscriptionId} renewed until ${result.nextRenewalDate}.`,
      );
    }
  }
};

const runNotificationCron = async (io) => {
  try {
    console.log("Running notification cron...");

    await processOverdueInvoices(io);
    await processExpiringSubscriptions(io);
    await processDuePaidSubscriptions(io);

    console.log("Notification cron completed");
  } catch (error) {
    console.error("Notification cron error:", error);
  }
};

export const startNotificationCron = (io) => {
  if (!io) {
    console.error(
      "Notification cron could not start because Socket.IO is missing.",
    );
    return;
  }

  cron.schedule(
    "0 9 * * *",
    async () => {
      await runNotificationCron(io);
    },
    {
      timezone: "Asia/Kolkata",
    },
  );

  console.log("Notification cron scheduled daily at 9:00 AM Asia/Kolkata.");
};
