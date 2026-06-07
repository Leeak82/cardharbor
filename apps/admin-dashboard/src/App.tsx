import React from "react";
import { createRoot } from "react-dom/client";

const mockReviews = [
  { id: "tx_001", user: "customer@example.com", brand: "Visa Prepaid", amount: "$100.00", risk: 42, status: "Review Pending" },
  { id: "tx_002", user: "buyer@example.com", brand: "Target", amount: "$50.00", risk: 73, status: "Review Pending" }
];

function App() {
  return (
    <main style={{ fontFamily: "Inter, system-ui, sans-serif", padding: 24, background: "#f6f7fb", minHeight: "100vh" }}>
      <h1>Card Exchange Admin</h1>
      <p>Compliance-first transaction review dashboard starter.</p>

      <section style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div style={cardStyle}><strong>Pending Reviews</strong><br />12</div>
        <div style={cardStyle}><strong>Approval Rate</strong><br />84%</div>
        <div style={cardStyle}><strong>Avg Risk Score</strong><br />38</div>
        <div style={cardStyle}><strong>Open Disputes</strong><br />3</div>
      </section>

      <h2>Manual Review Queue</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "white", borderRadius: 12, overflow: "hidden" }}>
        <thead>
          <tr>
            {["Transaction", "User", "Brand", "Amount", "Risk", "Status", "Action"].map(h => <th key={h} style={thStyle}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {mockReviews.map(row => (
            <tr key={row.id}>
              <td style={tdStyle}>{row.id}</td>
              <td style={tdStyle}>{row.user}</td>
              <td style={tdStyle}>{row.brand}</td>
              <td style={tdStyle}>{row.amount}</td>
              <td style={tdStyle}>{row.risk}</td>
              <td style={tdStyle}>{row.status}</td>
              <td style={tdStyle}><button>Open Review</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

const cardStyle: React.CSSProperties = { background: "white", padding: 18, borderRadius: 12, boxShadow: "0 4px 18px rgba(0,0,0,.06)" };
const thStyle: React.CSSProperties = { textAlign: "left", padding: 12, borderBottom: "1px solid #eee" };
const tdStyle: React.CSSProperties = { padding: 12, borderBottom: "1px solid #f0f0f0" };

createRoot(document.getElementById("root")!).render(<App />);
