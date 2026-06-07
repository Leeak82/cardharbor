const nodemailer = require("nodemailer");

function emailReady() {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.NOTIFY_FROM &&
    process.env.NOTIFY_TO
  );
}

function makeTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    connectionTimeout: 4000,
    greetingTimeout: 4000,
    socketTimeout: 5000,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function notify(event, data = {}) {
  const payload = {
    event,
    time: new Date().toISOString(),
    ...data,
  };

  console.log("[CardHarbor Notify]", JSON.stringify(payload, null, 2));

  if (!emailReady()) {
    console.log("[CardHarbor Notify] Email not configured. Console only.");
    return { sent: false, mode: "console", payload };
  }

  try {
    const transporter = makeTransporter();

    const result = await Promise.race([
      transporter.sendMail({
        from: process.env.NOTIFY_FROM,
        to: process.env.NOTIFY_TO,
        subject: `CardHarbor Alert: ${event}`,
        text: JSON.stringify(payload, null, 2),
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("SMTP timeout")), 6000)
      ),
    ]);

    console.log("[CardHarbor Notify] Email sent", result.messageId || "");
    return { sent: true, mode: "smtp", messageId: result.messageId || null, payload };
  } catch (err) {
    console.log("[CardHarbor Notify] Email failed:", err.message);
    return { sent: false, mode: "smtp_failed", error: err.message, payload };
  }
}

module.exports = {
  notify,
  emailReady,
};
