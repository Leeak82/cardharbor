function emailEnabled() {
  return !!process.env.NOTIFY_FROM && !!process.env.NOTIFY_TO;
}

function notify(event, data = {}) {
  const payload = {
    event,
    time: new Date().toISOString(),
    ...data
  };

  console.log("[CardHarbor Notify]", JSON.stringify(payload, null, 2));

  return {
    sent: false,
    mode: "console",
    payload
  };
}

module.exports = {
  notify,
  emailEnabled
};
