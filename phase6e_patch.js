const fs = require("fs");

const apiFile = "services/api/server.js";
const mobileFile = "apps/mobile/App.tsx";

if (!fs.existsSync(apiFile)) {
  console.error("Missing:", apiFile);
  process.exit(1);
}

if (!fs.existsSync(mobileFile)) {
  console.error("Missing:", mobileFile);
  process.exit(1);
}

let api = fs.readFileSync(apiFile, "utf8");

if (!api.includes("PHASE 6E ADMIN NOTES")) {
  const route = `

// ===== PHASE 6E ADMIN NOTES =====
app.patch("/api/admin/transactions/:id/notes", requireAdmin, (req, res) => {
  try {
    const { admin_note = "", payout_note = "", payout_reference = "" } = req.body || {};
    const tx = db.transactions.find(t => String(t.id) === String(req.params.id));

    if (!tx) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    tx.admin_note = String(admin_note || "");
    tx.payout_note = String(payout_note || "");
    tx.payout_reference = String(payout_reference || "");
    tx.notes_updated_at = new Date().toISOString();

    saveDb();

    res.json({ ok: true, transaction: tx });
  } catch (err) {
    console.error("Save admin notes failed:", err);
    res.status(500).json({ error: "Failed to save admin notes" });
  }
});
// ===== END PHASE 6E =====

`;

  api = api.replace(/app\.listen\s*\(/, route + "\napp.listen(");
  fs.writeFileSync(apiFile, api);
  console.log("Backend patched.");
} else {
  console.log("Backend already patched.");
}

console.log("Now patch mobile manually if needed.");
