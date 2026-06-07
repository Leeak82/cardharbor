const fs = require("fs");
const { Pool } = require("pg");

const DB_FILE = "./db.json";
const USE_POSTGRES = process.env.USE_POSTGRES === "true";
const DATABASE_URL = process.env.DATABASE_URL;

let pool = null;

if (USE_POSTGRES && DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
  });
}

function loadJsonDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({
      users: [],
      transactions: [],
      payoutProfiles: [],
      payoutLedger: []
    }, null, 2));
  }

  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  if (!db.users) db.users = [];
  if (!db.transactions) db.transactions = [];
  if (!db.payoutProfiles) db.payoutProfiles = [];
  if (!db.payoutLedger) db.payoutLedger = [];
  return db;
}

function saveJsonDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

async function postgresHealth() {
  if (!pool) return { ok: false, mode: "json" };
  const result = await pool.query("SELECT NOW() as now");
  return { ok: true, mode: "postgres", now: result.rows[0].now };
}

module.exports = {
  USE_POSTGRES,
  pool,
  loadJsonDb,
  saveJsonDb,
  postgresHealth
};
