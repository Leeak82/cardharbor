const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "CardHarbor API running" });
});

app.post("/quote", (req, res) => {
  const { brand, balance } = req.body;
  const amount = Number(String(balance).replace(/[^0-9.]/g, ""));
  const rate = 0.72;

  if (!brand || !amount) {
    return res.status(400).json({ error: "Brand and balance required" });
  }

  res.json({
    brand,
    balance: amount,
    rate,
    payout: +(amount * rate).toFixed(2),
    status: "quote_ready"
  });
});

app.post("/submit-card", (req, res) => {
  res.json({
    success: true,
    status: "pending_review",
    message: "Demo card submitted"
  });
});

app.listen(8080, () => {
  console.log("CardHarbor API running on http://localhost:8080");
});
