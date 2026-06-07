require("dotenv").config();

const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const db = new sqlite3.Database("./cardharbor.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      brand TEXT NOT NULL,
      balance REAL NOT NULL,
      offer REAL NOT NULL,
      payout_method TEXT DEFAULT 'Not selected',
      status TEXT DEFAULT 'Submitted',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);
});

function makeToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function calculateOffer(balance) {
  const rate = 0.72;
  return Math.round(balance * rate * 100) / 100;
}

app.get("/", (req, res) => {
  res.json({
    app: "CardHarbor API",
    status: "online",
    phase: "Phase 1 - Auth + SQLite transactions"
  });
});

app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password || password.length < 6) {
    return res.status(400).json({
      error: "Email and password required. Password must be at least 6 characters."
    });
  }

  const cleanEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 10);

  db.run(
    `INSERT INTO users (email, password_hash) VALUES (?, ?)`,
    [cleanEmail, passwordHash],
    function (err) {
      if (err) {
        return res.status(409).json({ error: "Account already exists" });
      }

      const user = { id: this.lastID, email: cleanEmail };
      const token = makeToken(user);

      res.json({
        message: "Account created",
        token,
        user
      });
    }
  );
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const cleanEmail = email.trim().toLowerCase();

  db.get(
    `SELECT * FROM users WHERE email = ?`,
    [cleanEmail],
    async (err, user) => {
      if (err || !user) {
        return res.status(401).json({ error: "Invalid login" });
      }

      const valid = await bcrypt.compare(password, user.password_hash);

      if (!valid) {
        return res.status(401).json({ error: "Invalid login" });
      }

      const safeUser = { id: user.id, email: user.email };
      const token = makeToken(safeUser);

      res.json({
        message: "Login successful",
        token,
        user: safeUser
      });
    }
  );
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({
    user: req.user
  });
});

app.post("/api/transactions", requireAuth, (req, res) => {
  const { brand, balance, payout_method } = req.body;

  const amount = Number(balance);

  if (!brand || !amount || amount <= 0) {
    return res.status(400).json({
      error: "Brand and valid balance required"
    });
  }

  const offer = calculateOffer(amount);

  db.run(
    `
    INSERT INTO transactions 
    (user_id, brand, balance, offer, payout_method, status)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      req.user.id,
      brand,
      amount,
      offer,
      payout_method || "Not selected",
      "Submitted"
    ],
    function (err) {
      if (err) {
        return res.status(500).json({ error: "Could not save transaction" });
      }

      res.json({
        message: "Transaction submitted",
        transaction: {
          id: this.lastID,
          brand,
          balance: amount,
          offer,
          payout_method: payout_method || "Not selected",
          status: "Submitted"
        }
      });
    }
  );
});

app.get("/api/transactions", requireAuth, (req, res) => {
  db.all(
    `
    SELECT id, brand, balance, offer, payout_method, status, created_at
    FROM transactions
    WHERE user_id = ?
    ORDER BY created_at DESC
    `,
    [req.user.id],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Could not load transactions" });
      }

      res.json({
        transactions: rows
      });
    }
  );
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`CardHarbor API running on port ${PORT}`);
});
