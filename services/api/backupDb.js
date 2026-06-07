const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DB_FILE = path.join(ROOT, "db.json");
const BACKUP_DIR = path.join(ROOT, "backups");

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function backupDb() {
  if (!fs.existsSync(DB_FILE)) {
    console.error("db.json not found");
    process.exit(1);
  }

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const backupName = `db-backup-${timestamp()}.json`;
  const backupPath = path.join(BACKUP_DIR, backupName);

  fs.copyFileSync(DB_FILE, backupPath);

  const backups = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("db-backup-") && f.endsWith(".json"))
    .sort()
    .reverse();

  const keep = backups.slice(0, 20);
  const remove = backups.slice(20);

  for (const file of remove) {
    fs.unlinkSync(path.join(BACKUP_DIR, file));
  }

  console.log("Backup created:");
  console.log(backupPath);
  console.log(`Backups kept: ${keep.length}`);
}

backupDb();
