// Fallback server for CardHarbor API
//
// This script provides a minimal HTTP server that exposes a health endpoint.
// It is intended for development environments where npm dependencies like
// Express are unavailable. Run this file with `node fallback-server.js` to
// verify basic connectivity without installing external packages. The server
// listens on the port defined by the PORT environment variable (default 8080).

// Load environment variables if dotenv is installed
try {
  require("dotenv").config();
} catch (err) {
  // dotenv is optional; ignore if not installed
}

const http = require("http");
const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.url.startsWith("/api/health")) {
    res.end(
      JSON.stringify({
        ok: true,
        service: "CardHarbor API (fallback)",
        time: new Date().toISOString(),
        note:
          "Express dependencies unavailable. Only health endpoint is exposed in fallback mode."
      })
    );
  } else {
    res.statusCode = 503;
    res.end(
      JSON.stringify({
        ok: false,
        error:
          "CardHarbor API is running in fallback mode. Install dependencies to access full API."
      })
    );
  }
});

server.listen(PORT, () => {
  console.log(
    `CardHarbor fallback server running on http://localhost:${PORT}\nOnly /api/health is available.`
  );
});
