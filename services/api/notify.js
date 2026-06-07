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
    return { sent: false, mode: "console", payload };
  }

  const transporter = makeTransporter();

  await transporter.sendMail({
    from: process.env.NOTIFY_FROM,
    to: process.env.NOTIFY_TO,
    subject: `CardHarbor Alert: ${event}`,
    text: JSON.stringify(payload, null, 2),
  });

  return { sent: true, mode: "smtp", payload };
}

module.exports = {
  notify,
  emailReady,
};
