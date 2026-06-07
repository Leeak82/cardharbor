const { calculateRiskScore, normalizeCardCode } = require("./riskEngine");

const oldTransactions = [
  {
    id: "1",
    user_id: "user-a",
    card_code: "ABC-123-XYZ",
    image_hash: "same-image",
    balance: 50,
    ocr_confidence: 0.9
  },
  {
    id: "2",
    user_id: "user-a",
    card_code: "OLD999",
    image_hash: "other-image",
    balance: 25,
    ocr_confidence: 0.8
  }
];

const newTransaction = {
  id: "3",
  user_id: "user-a",
  card_code: "abc 123 xyz",
  image_hash: "same-image",
  balance: 300,
  ocr_confidence: 0.4
};

console.log("Normalized:", normalizeCardCode(newTransaction.card_code));
console.log(calculateRiskScore(newTransaction, oldTransactions));
