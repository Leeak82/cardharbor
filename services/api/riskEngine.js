const crypto = require("crypto");

function normalizeCardCode(value = "") {
  return String(value).replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function hashValue(value = "") {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function calculateRiskScore(newTx = {}, allTransactions = []) {
  let score = 0;
  const reasons = [];

  const cardCode = normalizeCardCode(newTx.card_code || newTx.possible_code || newTx.ocr_code || "");
  const imageHash = newTx.image_hash || "";
  const balance = Number(newTx.balance || newTx.amount || 0);
  const submitter = newTx.user_id || newTx.email || "unknown";

  const previous = allTransactions.filter((tx) => tx.id !== newTx.id);

  const duplicateCard = cardCode
    ? previous.some((tx) => normalizeCardCode(tx.card_code || tx.possible_code || tx.ocr_code || "") === cardCode)
    : false;

  const duplicateImage = imageHash
    ? previous.some((tx) => tx.image_hash === imageHash)
    : false;

  const submitterCount = previous.filter((tx) => (tx.user_id || tx.email || "unknown") === submitter).length;

  const ocrConfidence =
    typeof newTx.ocr_confidence === "number" ? newTx.ocr_confidence : null;

  if (duplicateCard) {
    score += 40;
    reasons.push("Duplicate card detected");
  }

  if (duplicateImage) {
    score += 35;
    reasons.push("Duplicate image detected");
  }

  if (balance >= 250) {
    score += 20;
    reasons.push("High balance card");
  } else if (balance >= 100) {
    score += 10;
    reasons.push("Elevated balance card");
  }

  if (submitterCount >= 5) {
    score += 20;
    reasons.push("Repeat submitter");
  } else if (submitterCount >= 2) {
    score += 10;
    reasons.push("Multiple recent submissions");
  }

  if (ocrConfidence === null) {
    score += 5;
    reasons.push("OCR confidence unavailable");
  } else if (ocrConfidence < 0.45) {
    score += 20;
    reasons.push("Low OCR confidence");
  } else if (ocrConfidence < 0.7) {
    score += 10;
    reasons.push("Medium OCR confidence");
  }

  score = Math.min(100, Math.max(0, score));

  let badge = "Low Risk";
  if (score >= 75) badge = "Manual Review Required";
  else if (score >= 50) badge = "High Risk";
  else if (score >= 25) badge = "Medium Risk";

  return {
    risk_score: score,
    risk_badge: badge,
    risk_reasons: reasons,
    risk_flags: {
      duplicate_card: duplicateCard,
      duplicate_image: duplicateImage,
      high_balance: balance >= 250,
      repeat_submitter: submitterCount >= 2,
      low_ocr_confidence: ocrConfidence === null || ocrConfidence < 0.7
    },
    card_hash: cardCode ? hashValue(cardCode) : null
  };
}

module.exports = { calculateRiskScore, normalizeCardCode, hashValue };
