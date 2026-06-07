require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { execSync } = require("child_process");
const { calculateRiskScore } = require("./riskEngine");
const { notify } = require("./notify");

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const ADMIN_EMAIL = "admin@cardharbor.app";
const ADMIN_PASSWORD = "admin123";
const DB_FILE = "./db.json";
const UPLOAD_DIR = "./uploads";

app.use(cors());

app.get("/api/test-email", async (req, res) => {
  try {
    const result = await notify("test_email", {
      message: "CardHarbor email test from Render"
    });
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "CardHarbor API",
    phase: "5D",
    time: new Date().toISOString()
  });
});

app.use(express.json({ limit: "5mb" }));
app.use("/uploads", express.static(UPLOAD_DIR));

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const BRANDS = [
  { name: "Amazon", rate: 0.78, keywords: ["amazon"] },
  { name: "Walmart", rate: 0.74, keywords: ["walmart"] },
  { name: "Target", rate: 0.74, keywords: ["target"] },
  { name: "Best Buy", rate: 0.7, keywords: ["best buy", "bestbuy"] },
  { name: "Starbucks", rate: 0.65, keywords: ["starbucks"] },
  { name: "Visa", rate: 0.82, keywords: ["visa"] },
  { name: "Mastercard", rate: 0.82, keywords: ["mastercard", "master card"] },
  { name: "Other", rate: 0.55, keywords: [] }
];

function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], transactions: [], payoutProfiles: [] }, null, 2));
  }

  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  if (!db.users) db.users = [];
  if (!db.transactions) db.transactions = [];
  if (!db.payoutProfiles) db.payoutProfiles = [];
  return db;
}

function saveDb(db) {
  try {
    require("child_process").execSync("node backupDb.js", {
      cwd: __dirname,
      stdio: "ignore"
    });
  } catch (e) {}

  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function makeToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "30d" });
}

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  });
}

function getBrandRate(brand) {
  const match = BRANDS.find(b => b.name.toLowerCase() === String(brand).toLowerCase());
  return match ? match.rate : 0.55;
}

function calculateOffer(brand, balance) {
  return Math.round(balance * getBrandRate(brand) * 100) / 100;
}

function runOcr(localImagePath) {
  if (!localImagePath) return { available: false, text: "", error: "No image" };

  try {
    const output = execSync(`tesseract "${localImagePath}" stdout`, {
      encoding: "utf8",
      timeout: 15000
    });
    return { available: true, text: output.trim(), error: null };
  } catch {
    return { available: false, text: "", error: "OCR unavailable or failed" };
  }
}

function detectBrand(ocrText, fallbackBrand) {
  const lower = String(ocrText || "").toLowerCase();
  for (const brand of BRANDS) {
    if (brand.keywords.some(k => lower.includes(k))) return brand.name;
  }
  return fallbackBrand || "Other";
}

function detectPossibleCodes(ocrText) {
  const text = String(ocrText || "").replace(/\s+/g, " ");
  const matches = text.match(/[A-Z0-9]{4,}[-\s]?[A-Z0-9]{4,}[-\s]?[A-Z0-9]{0,8}/gi) || [];
  return [...new Set(matches)].map(x => x.trim()).filter(x => x.length >= 8).slice(0, 8);
}

function detectPossibleBalance(ocrText) {
  const text = String(ocrText || "");
  const moneyMatches = text.match(/\$?\s?([0-9]{1,4})(\.[0-9]{2})?/g) || [];
  const amounts = moneyMatches.map(x => Number(String(x).replace("$", "").trim())).filter(n => n > 0 && n <= 1000);
  return amounts.length ? amounts[0] : null;
}

function publicUser(user) {
  return { id: user.id, email: user.email, created_at: user.created_at };
}

function getUserPayoutProfile(db, userId) {
  return db.payoutProfiles.find(p => p.user_id === userId) || null;
}

function attachUserData(db, transactions) {
  return transactions.map(t => {
    const owner = db.users.find(u => u.id === t.user_id);
    return {
      ...t,
      user_email: owner ? owner.email : "unknown",
      payout_profile: getUserPayoutProfile(db, t.user_id)
    };
  });
}

app.get("/", (req, res) => {
  res.json({
    app: "CardHarbor API",
    status: "online",
    phase: "Phase 4C - payout readiness"
  });
});

app.get("/api/brands", (req, res) => {
  res.json({ brands: BRANDS.map(({ name, rate }) => ({ name, rate })) });
});

app.post("/api/register", async (req, res) => {
  const db = loadDb();
  const { email, password } = req.body;

  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: "Email and password of 6+ characters required" });
  }

  const cleanEmail = email.trim().toLowerCase();

  if (cleanEmail === ADMIN_EMAIL) return res.status(403).json({ error: "Reserved admin email" });
  if (db.users.find(u => u.email === cleanEmail)) return res.status(409).json({ error: "Account already exists" });

  const user = {
    id: Date.now(),
    email: cleanEmail,
    password_hash: await bcrypt.hash(password, 10),
    role: "user",
    created_at: new Date().toISOString()
  };

  db.users.push(user);
  saveDb(db);

  const safeUser = { id: user.id, email: user.email, role: "user" };
  res.json({ message: "Account created", token: makeToken(safeUser), user: safeUser });
});

app.post("/api/login", async (req, res) => {
  const db = loadDb();
  const cleanEmail = String(req.body.email || "").trim().toLowerCase();
  const user = db.users.find(u => u.email === cleanEmail);

  if (!user) return res.status(401).json({ error: "Invalid login" });

  const valid = await bcrypt.compare(req.body.password || "", user.password_hash);
  if (!valid) return res.status(401).json({ error: "Invalid login" });

  const safeUser = { id: user.id, email: user.email, role: user.role || "user" };
  res.json({ message: "Login successful", token: makeToken(safeUser), user: safeUser });
});

app.post("/api/admin/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid admin login" });
  }

  const admin = { id: 1, email: ADMIN_EMAIL, role: "admin" };
  res.json({ message: "Admin login successful", token: makeToken(admin), user: admin });
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/payout-profile", requireAuth, (req, res) => {
  const db = loadDb();
  res.json({ payout_profile: getUserPayoutProfile(db, req.user.id) });
});

app.post("/api/payout-profile", requireAuth, (req, res) => {
  const db = loadDb();
  const { preferred_method, cashapp_tag, venmo_handle, bank_name, account_last4, routing_last4 } = req.body;
  const allowed = ["Cash App", "Venmo", "ACH"];

  if (!preferred_method || !allowed.includes(preferred_method)) {
    return res.status(400).json({ error: "Preferred method must be Cash App, Venmo, or ACH" });
  }

  let profile = getUserPayoutProfile(db, req.user.id);

  if (!profile) {
    profile = { id: Date.now(), user_id: req.user.id, created_at: new Date().toISOString() };
    db.payoutProfiles.push(profile);
  }

  profile.preferred_method = preferred_method;
  profile.cashapp_tag = cashapp_tag || "";
  profile.venmo_handle = venmo_handle || "";
  profile.bank_name = bank_name || "";
  profile.account_last4 = account_last4 || "";
  profile.routing_last4 = routing_last4 || "";
  profile.updated_at = new Date().toISOString();

  saveDb(db);
  res.json({ message: "Payout profile saved", payout_profile: profile });
});

app.post("/api/transactions", requireAuth, (req, res) => {
  const db = loadDb();
  const { brand, balance, payout_method } = req.body;
  const amount = Number(balance);

  if (!brand || !amount || amount <= 0) {
    return res.status(400).json({ error: "Brand and valid balance required" });
  }

  const payoutProfile = getUserPayoutProfile(db, req.user.id);

  const transaction = {
    id: Date.now(),
    user_id: req.user.id,
    brand,
    detected_brand: brand,
    balance: amount,
    detected_balance: null,
    rate: getBrandRate(brand),
    offer: calculateOffer(brand, amount),
    payout_method: payout_method || payoutProfile?.preferred_method || "Not selected",
    image_url: null,
    ocr_text: "",
    ocr_available: false,
    ocr_error: "No image uploaded",
    possible_codes: [],
    admin_note: "",
    payout_note: "",
    payout_reference: "",
    payout_amount: null,
    payout_method_used: "",
    paid_by: null,
    reviewed_by: null,
    reviewed_at: null,
    paid_at: null,
    status: "Submitted",
    created_at: new Date().toISOString()
  };

  db.transactions.push(transaction);
  saveDb(db);

  res.json({ message: "Transaction submitted", transaction });
});

app.post("/api/transactions/:id/image", requireAuth, express.raw({ type: "*/*", limit: "15mb" }), (req, res) => {
  const db = loadDb();

  const transaction = db.transactions.find(
    t => String(t.id) === String(req.params.id) && t.user_id === req.user.id
  );

  if (!transaction) return res.status(404).json({ error: "Transaction not found" });

  const filename = `card_${req.user.id}_${transaction.id}_${Date.now()}.jpg`;
  const filepath = path.join(UPLOAD_DIR, filename);

  fs.writeFileSync(filepath, req.body);

  const ocr = runOcr(filepath);

  transaction.image_url = `/uploads/${filename}`;
  transaction.ocr_text = ocr.text;
  transaction.ocr_available = ocr.available;
  transaction.ocr_error = ocr.error;
  transaction.detected_brand = detectBrand(ocr.text, transaction.brand);
  transaction.detected_balance = detectPossibleBalance(ocr.text);
  transaction.possible_codes = detectPossibleCodes(ocr.text);

    const risk = calculateRiskScore(transaction, db.transactions);
    transaction.risk_score = risk.risk_score;
    transaction.risk_badge = risk.risk_badge;
    transaction.risk_reasons = risk.risk_reasons;
    transaction.risk_flags = risk.risk_flags;
    transaction.card_hash = risk.card_hash;
  transaction.status = "Pending Review";

  saveDb(db);

  notify("image_uploaded_risk_scored", {
    transaction_id: transaction.id,
    user_id: transaction.user_id,
    risk_score: transaction.risk_score,
    risk_badge: transaction.risk_badge,
    risk_reasons: transaction.risk_reasons
  });

  res.json({ message: "Image uploaded", transaction });
});

app.get("/api/transactions", requireAuth, (req, res) => {
  const db = loadDb();
  const transactions = db.transactions
    .filter(t => t.user_id === req.user.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.json({ transactions });
});

app.get("/api/transactions/:id", requireAuth, (req, res) => {
  const db = loadDb();
  const transaction = db.transactions.find(
    t => String(t.id) === String(req.params.id) && t.user_id === req.user.id
  );

  if (!transaction) return res.status(404).json({ error: "Transaction not found" });
  res.json({ transaction });
});

app.get("/api/admin/stats", requireAdmin, (req, res) => {
  const db = loadDb();

  const totalUsers = db.users.length;
  const totalTransactions = db.transactions.length;
  const pending = db.transactions.filter(t => String(t.status).includes("Pending") || t.status === "Submitted").length;
  const approved = db.transactions.filter(t => t.status === "Approved").length;
  const rejected = db.transactions.filter(t => t.status === "Rejected").length;
  const paid = db.transactions.filter(t => t.status === "Paid").length;
  const payoutProfiles = db.payoutProfiles.length;
  const readyForPayout = db.transactions.filter(t => t.status === "Ready For Payout").length;
  const totalApprovedValue = db.transactions
    .filter(t => ["Approved", "Paid", "Ready For Payout"].includes(t.status))
    .reduce((sum, t) => sum + Number(t.offer || 0), 0);

  res.json({
    stats: {
      totalUsers,
      totalTransactions,
      pending,
      approved,
      rejected,
      paid,
      readyForPayout,
      payoutProfiles,
      totalApprovedValue: Math.round(totalApprovedValue * 100) / 100
    }
  });
});

app.get("/api/admin/users", requireAdmin, (req, res) => {
  const db = loadDb();
  res.json({
    users: db.users.map(u => ({
      ...publicUser(u),
      payout_profile: getUserPayoutProfile(db, u.id)
    }))
  });
});

app.get("/api/admin/transactions", requireAdmin, (req, res) => {
  const db = loadDb();
  const status = String(req.query.status || "").toLowerCase();

  let transactions = db.transactions;

  if (status) {
    transactions = transactions.filter(t => String(t.status || "").toLowerCase() === status);
  }

  transactions = transactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ transactions: attachUserData(db, transactions) });
});

app.get("/api/admin/transactions/:id", requireAdmin, (req, res) => {
  const db = loadDb();
  const transaction = db.transactions.find(t => String(t.id) === String(req.params.id));

  if (!transaction) return res.status(404).json({ error: "Transaction not found" });
  res.json({ transaction: attachUserData(db, [transaction])[0] });
});

app.patch("/api/admin/transactions/:id/status", requireAdmin, async (req, res) => {
  const db = loadDb();
  const { status, admin_note, payout_note, payout_reference, payout_amount, payout_method_used } = req.body;

  const allowed = ["Pending Review", "Approved", "Rejected", "Needs More Info", "Ready For Payout", "Paid"];

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const transaction = db.transactions.find(t => String(t.id) === String(req.params.id));
  if (!transaction) return res.status(404).json({ error: "Transaction not found" });

  transaction.status = status;
  transaction.admin_note = admin_note || transaction.admin_note || "";
  transaction.payout_note = payout_note || transaction.payout_note || "";
  transaction.payout_reference = payout_reference || transaction.payout_reference || "";
  if (payout_amount !== undefined && payout_amount !== null && payout_amount !== "") {
    transaction.payout_amount = Number(payout_amount);
  }
  transaction.payout_method_used = payout_method_used || transaction.payout_method_used || "";
  transaction.reviewed_by = req.user.email;
  transaction.reviewed_at = new Date().toISOString();

  if (status === "Paid") {
    transaction.paid_at = new Date().toISOString();
    transaction.paid_by = req.user.email;
    if (!transaction.payout_amount) transaction.payout_amount = transaction.offer;
    if (!transaction.payout_method_used) transaction.payout_method_used = transaction.payout_method || "Manual";
    if (!transaction.payout_note) transaction.payout_note = "Manual payout marked complete.";
  }

  saveDb(db);

  const user = db.users.find(u => u.id === transaction.user_id);

  await notify("transaction_status_updated", {
    notify_to: user?.email,
    transaction_id: transaction.id,
    user_email: user?.email,
    status: transaction.status,
    brand: transaction.brand,
    balance: transaction.balance,
    offer: transaction.offer,
    admin_note: transaction.admin_note,
    payout_note: transaction.payout_note,
    payout_reference: transaction.payout_reference,
    payout_amount: transaction.payout_amount,
    payout_method_used: transaction.payout_method_used,
    paid_by: transaction.paid_by,
    paid_at: transaction.paid_at
  });

  res.json({
    message: "Transaction updated",
    transaction: attachUserData(db, [transaction])[0]
  });
});



// ===== PHASE 6E ADMIN NOTES =====
app.patch("/api/admin/transactions/:id/notes", requireAdmin, (req, res) => {
  try {
    const db = loadDb();
    const { admin_note = "", payout_note = "", payout_reference = "" } = req.body || {};
    const tx = db.transactions.find(t => String(t.id) === String(req.params.id));

    if (!tx) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    tx.admin_note = String(admin_note || "");
    tx.payout_note = String(payout_note || "");
    tx.payout_reference = String(payout_reference || "");
    tx.notes_updated_at = new Date().toISOString();

    saveDb(db);

    res.json({ ok: true, transaction: attachUserData(db, [tx])[0] });
  } catch (err) {
    console.error("Save admin notes failed:", err);
    res.status(500).json({ error: "Failed to save admin notes" });
  }
});
// ===== END PHASE 6E =====


app.listen(PORT, "0.0.0.0", () => {
  console.log(`CardHarbor API running on port ${PORT}`);
});
