const { Resend } = require("resend");

function emailReady() {
  return !!process.env.RESEND_API_KEY && !!process.env.NOTIFY_TO;
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

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const result = await resend.emails.send({
      from: process.env.NOTIFY_FROM || "CardHarbor <onboarding@resend.dev>",
      to: process.env.NOTIFY_TO,
      subject: `CardHarbor Alert: ${event}`,
      text: JSON.stringify(payload, null, 2),
    });

    console.log("[CardHarbor Notify] Email sent", result);
    return { sent: true, mode: "resend", result, payload };
  } catch (err) {
    console.log("[CardHarbor Notify] Email failed:", err.message);
    return { sent: false, mode: "resend_failed", error: err.message, payload };
  }
}

module.exports = {
  notify,
  emailReady,
};
