import db from "../config/db.js";

const ALLOWED_ROLES = ["superadmin", "company_admin"];

const ALLOWED_REPEAT_TYPES = ["one_time", "yearly"];

const ALLOWED_FORM_STATUSES = ["draft", "scheduled"];

const EDITABLE_STATUSES = [
  "draft",
  "scheduled",
  "failed",
  "cancelled",
  "sent",
  "partially_sent",
];

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

const getDaysInMonth = (year, month) => {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
};

const normalizeDateTime = (value) => {
  if (!value) return null;

  const normalizedValue = String(value)
    .trim()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, "")
    .replace(/Z$/, "");

  const match = normalizedValue.match(
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/,
  );

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] || 0);

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > getDaysInMonth(year, month)) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;
  if (second < 0 || second > 59) return null;

  return [
    `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`,
  ].join(" ");
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

const moveYearlyDateToFuture = (dateTime) => {
  const currentIndiaDateTime = getIndiaDateTime();

  let nextDateTime = dateTime;

  while (nextDateTime <= currentIndiaDateTime) {
    nextDateTime = addOneYear(nextDateTime);
  }

  return nextDateTime;
};

const getGreetingScope = (req, alias = "g") => {
  if (req.user.role === "superadmin") {
    return {
      clause: `${alias}.creator_role = 'superadmin'`,
      params: [],
    };
  }

  return {
    clause: `
      ${alias}.creator_role = 'company_admin'
      AND ${alias}.company_id = ?
    `,
    params: [req.user.company_id],
  };
};

const prepareGreetingPayload = (payload) => {
  const occasionName = String(payload.occasion_name || "").trim();
  const emailSubject = String(payload.email_subject || "").trim();
  const emailMessage = String(payload.email_message || "").trim();

  const repeatType = payload.repeat_type || "one_time";
  const status = payload.status || "draft";

  if (!occasionName) {
    return {
      error: "Occasion name is required",
    };
  }

  if (!emailSubject) {
    return {
      error: "Email subject is required",
    };
  }

  if (!emailMessage) {
    return {
      error: "Email message is required",
    };
  }

  if (!ALLOWED_REPEAT_TYPES.includes(repeatType)) {
    return {
      error: "Invalid repeat type",
    };
  }

  if (!ALLOWED_FORM_STATUSES.includes(status)) {
    return {
      error: "Status must be draft or scheduled",
    };
  }

  let sendAt = null;

  if (payload.send_at) {
    sendAt = normalizeDateTime(payload.send_at);

    if (!sendAt) {
      return {
        error: "Invalid sending date or time",
      };
    }
  }

  if (status === "scheduled" && !sendAt) {
    return {
      error: "Sending date and time are required",
    };
  }

  if (status === "scheduled" && sendAt) {
    const currentIndiaDateTime = getIndiaDateTime();

    if (repeatType === "yearly") {
      sendAt = moveYearlyDateToFuture(sendAt);
    } else if (sendAt <= currentIndiaDateTime) {
      return {
        error: "One-time greeting date must be in the future",
      };
    }
  }

  return {
    data: {
      occasion_name: occasionName,
      email_subject: emailSubject,
      email_message: emailMessage,
      banner_path: payload.banner_path || null,
      send_at: sendAt,
      repeat_type: repeatType,
      status,
    },
  };
};

const getGreetingForScope = async (req, greetingId) => {
  const scope = getGreetingScope(req, "g");

  const [rows] = await db.query(
    `
    SELECT
      g.id,
      g.company_id,
      g.created_by,
      g.creator_role,
      g.occasion_name,
      g.email_subject,
      g.email_message,
      g.banner_path,
      DATE_FORMAT(
        g.send_at,
        '%Y-%m-%d %H:%i:%s'
      ) AS send_at,
      g.repeat_type,
      g.status,
      g.sent_count,
      g.failed_count,
      g.last_error,
      g.last_sent_at,
      g.created_at,
      g.updated_at
    FROM tbl_greetings g
    WHERE g.id = ?
      AND ${scope.clause}
    LIMIT 1
    `,
    [greetingId, ...scope.params],
  );

  return rows[0] || null;
};

export const uploadGreetingBanner = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Greeting banner is required",
      });
    }

    return res.status(201).json({
      message: "Greeting banner uploaded successfully",
      banner_path: `/upload/greeting-banners/${req.file.filename}`,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Greeting banner upload error",
      error: error.message,
    });
  }
};

export const getGreetingRecipientCount = async (req, res) => {
  try {
    if (req.user.role === "superadmin") {
      const [rows] = await db.query(`
        SELECT COUNT(DISTINCT LOWER(TRIM(email))) AS total
        FROM tbl_users
        WHERE role = 'company_admin'
          AND email IS NOT NULL
          AND TRIM(email) != ''
      `);

      return res.json({
        recipient_type: "company_admin",
        total: rows[0]?.total || 0,
      });
    }

    const [rows] = await db.query(
      `
      SELECT COUNT(DISTINCT LOWER(TRIM(email))) AS total
      FROM tbl_customers
      WHERE company_id = ?
        AND email IS NOT NULL
        AND TRIM(email) != ''
      `,
      [req.user.company_id],
    );

    return res.json({
      recipient_type: "customer",
      total: rows[0]?.total || 0,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Unable to get greeting recipient count",
      error: error.message,
    });
  }
};

export const createGreeting = async (req, res) => {
  try {
    if (!ALLOWED_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    const prepared = prepareGreetingPayload(req.body);

    if (prepared.error) {
      return res.status(400).json({
        message: prepared.error,
      });
    }

    const greeting = prepared.data;

    const companyId =
      req.user.role === "company_admin" ? req.user.company_id : null;

    if (req.user.role === "company_admin" && !companyId) {
      return res.status(400).json({
        message: "Company information is missing",
      });
    }

    const [result] = await db.query(
      `
      INSERT INTO tbl_greetings
      (
        company_id,
        created_by,
        creator_role,
        occasion_name,
        email_subject,
        email_message,
        banner_path,
        send_at,
        repeat_type,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        companyId,
        req.user.id,
        req.user.role,
        greeting.occasion_name,
        greeting.email_subject,
        greeting.email_message,
        greeting.banner_path,
        greeting.send_at,
        greeting.repeat_type,
        greeting.status,
      ],
    );

    const createdGreeting = await getGreetingForScope(req, result.insertId);

    return res.status(201).json({
      message:
        greeting.status === "scheduled"
          ? "Greeting scheduled successfully"
          : "Greeting saved as draft",
      greeting: createdGreeting,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Create greeting error",
      error: error.message,
    });
  }
};

export const createBulkGreetings = async (req, res) => {
  let connection;

  try {
    const greetings = req.body.greetings;
    const defaultStatus = req.body.status || "scheduled";

    if (!Array.isArray(greetings) || greetings.length === 0) {
      return res.status(400).json({
        message: "At least one greeting is required",
      });
    }

    if (greetings.length > 100) {
      return res.status(400).json({
        message: "Maximum 100 greetings can be created at once",
      });
    }

    if (!ALLOWED_FORM_STATUSES.includes(defaultStatus)) {
      return res.status(400).json({
        message: "Status must be draft or scheduled",
      });
    }

    const preparedGreetings = [];

    for (let index = 0; index < greetings.length; index += 1) {
      const currentGreeting = greetings[index];

      const prepared = prepareGreetingPayload({
        ...currentGreeting,
        repeat_type: currentGreeting.repeat_type || "yearly",
        status: currentGreeting.status || defaultStatus,
      });

      if (prepared.error) {
        return res.status(400).json({
          message: `Greeting ${index + 1}: ${prepared.error}`,
        });
      }

      preparedGreetings.push(prepared.data);
    }

    const companyId =
      req.user.role === "company_admin" ? req.user.company_id : null;

    if (req.user.role === "company_admin" && !companyId) {
      return res.status(400).json({
        message: "Company information is missing",
      });
    }

    connection = await db.getConnection();

    await connection.beginTransaction();

    const createdIds = [];

    for (const greeting of preparedGreetings) {
      const [result] = await connection.query(
        `
        INSERT INTO tbl_greetings
        (
          company_id,
          created_by,
          creator_role,
          occasion_name,
          email_subject,
          email_message,
          banner_path,
          send_at,
          repeat_type,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          companyId,
          req.user.id,
          req.user.role,
          greeting.occasion_name,
          greeting.email_subject,
          greeting.email_message,
          greeting.banner_path,
          greeting.send_at,
          greeting.repeat_type,
          greeting.status,
        ],
      );

      createdIds.push(result.insertId);
    }

    await connection.commit();

    return res.status(201).json({
      message: `${createdIds.length} greetings created successfully`,
      created_ids: createdIds,
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    return res.status(500).json({
      message: "Bulk greeting creation error",
      error: error.message,
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

export const getGreetings = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);

    const offset = (page - 1) * limit;

    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "all").trim();

    const scope = getGreetingScope(req, "g");

    let whereClause = `WHERE ${scope.clause}`;
    const params = [...scope.params];

    if (search) {
      whereClause += `
        AND (
          g.occasion_name LIKE ?
          OR g.email_subject LIKE ?
        )
      `;

      const searchValue = `%${search}%`;

      params.push(searchValue, searchValue);
    }

    if (status !== "all") {
      whereClause += " AND g.status = ?";
      params.push(status);
    }

    const [countRows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_greetings g
      ${whereClause}
      `,
      params,
    );

    const total = Number(countRows[0]?.total || 0);

    const [greetings] = await db.query(
      `
      SELECT
        g.id,
        g.company_id,
        g.created_by,
        g.creator_role,
        g.occasion_name,
        g.email_subject,
        g.email_message,
        g.banner_path,
        DATE_FORMAT(
          g.send_at,
          '%Y-%m-%d %H:%i:%s'
        ) AS send_at,
        g.repeat_type,
        g.status,
        g.sent_count,
        g.failed_count,
        g.last_error,
        g.last_sent_at,
        g.created_at,
        g.updated_at
      FROM tbl_greetings g
      ${whereClause}
      ORDER BY
        CASE WHEN g.send_at IS NULL THEN 1 ELSE 0 END,
        g.send_at ASC,
        g.id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset],
    );

    return res.json({
      greetings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Get greetings error",
      error: error.message,
    });
  }
};

export const getSingleGreeting = async (req, res) => {
  try {
    const greeting = await getGreetingForScope(req, req.params.id);

    if (!greeting) {
      return res.status(404).json({
        message: "Greeting not found",
      });
    }

    return res.json({
      greeting,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Get greeting error",
      error: error.message,
    });
  }
};

export const updateGreeting = async (req, res) => {
  try {
    const existingGreeting = await getGreetingForScope(req, req.params.id);

    if (!existingGreeting) {
      return res.status(404).json({
        message: "Greeting not found",
      });
    }

    if (!EDITABLE_STATUSES.includes(existingGreeting.status)) {
      return res.status(400).json({
        message: "This greeting can no longer be edited",
      });
    }

    let defaultStatus = existingGreeting.status;

    if (
      ["failed", "cancelled", "sent", "partially_sent"].includes(defaultStatus)
    ) {
      defaultStatus = "draft";
    }

    const hasBannerPath = Object.prototype.hasOwnProperty.call(
      req.body,
      "banner_path",
    );

    const prepared = prepareGreetingPayload({
      occasion_name: req.body.occasion_name ?? existingGreeting.occasion_name,

      email_subject: req.body.email_subject ?? existingGreeting.email_subject,

      email_message: req.body.email_message ?? existingGreeting.email_message,

      banner_path: hasBannerPath
        ? req.body.banner_path
        : existingGreeting.banner_path,

      send_at: req.body.send_at ?? existingGreeting.send_at,

      repeat_type: req.body.repeat_type ?? existingGreeting.repeat_type,

      status: req.body.status ?? defaultStatus,
    });

    if (prepared.error) {
      return res.status(400).json({
        message: prepared.error,
      });
    }

    const greeting = prepared.data;

    await db.query(
      `
      UPDATE tbl_greetings
      SET
        occasion_name = ?,
        email_subject = ?,
        email_message = ?,
        banner_path = ?,
        send_at = ?,
        repeat_type = ?,
        status = ?,
        sent_count = 0,
        failed_count = 0,
        last_error = NULL
      WHERE id = ?
      `,
      [
        greeting.occasion_name,
        greeting.email_subject,
        greeting.email_message,
        greeting.banner_path,
        greeting.send_at,
        greeting.repeat_type,
        greeting.status,
        existingGreeting.id,
      ],
    );

    const updatedGreeting = await getGreetingForScope(req, existingGreeting.id);

    return res.json({
      message:
        greeting.status === "scheduled"
          ? "Greeting updated and scheduled successfully"
          : "Greeting updated successfully",
      greeting: updatedGreeting,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Update greeting error",
      error: error.message,
    });
  }
};

export const cancelGreeting = async (req, res) => {
  try {
    const greeting = await getGreetingForScope(req, req.params.id);

    if (!greeting) {
      return res.status(404).json({
        message: "Greeting not found",
      });
    }

    if (!["draft", "scheduled"].includes(greeting.status)) {
      return res.status(400).json({
        message: "Only draft or scheduled greetings can be cancelled",
      });
    }

    await db.query(
      `
      UPDATE tbl_greetings
      SET status = 'cancelled'
      WHERE id = ?
      `,
      [greeting.id],
    );

    return res.json({
      message: "Greeting cancelled successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Cancel greeting error",
      error: error.message,
    });
  }
};

export const deleteGreeting = async (req, res) => {
  try {
    const greeting = await getGreetingForScope(req, req.params.id);

    if (!greeting) {
      return res.status(404).json({
        message: "Greeting not found",
      });
    }

    if (!["draft", "cancelled", "failed"].includes(greeting.status)) {
      return res.status(400).json({
        message: "Only draft, cancelled or failed greetings can be deleted",
      });
    }

    await db.query(
      `
      DELETE FROM tbl_greetings
      WHERE id = ?
      `,
      [greeting.id],
    );

    return res.json({
      message: "Greeting deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Delete greeting error",
      error: error.message,
    });
  }
};
