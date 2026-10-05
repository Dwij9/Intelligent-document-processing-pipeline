require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const http = require("http");
const { WebSocketServer } = require("ws");
const path = require("path");
const fs = require("fs");

const connectDB = require("./config/db");
const documentRoutes = require("./routes/documents");
const analyticsRoutes = require("./routes/analytics");
const knowledgeRoutes = require("./routes/knowledge");

const PORT = process.env.PORT || 4000;

// ── Express setup ───────────────────────────────────────────
const app = express();
app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ── HTTP + WebSocket server ─────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

const clients = new Set();
wss.on("connection", (ws) => {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
});

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

// Give document routes access to broadcast
documentRoutes.setBroadcast(broadcast);

// ── Routes ──────────────────────────────────────────────────
app.use("/api/documents", documentRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/knowledge", knowledgeRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// ── Start ───────────────────────────────────────────────────
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Backend API running on http://0.0.0.0:${PORT}`);
    console.log(`WebSocket available at ws://0.0.0.0:${PORT}/ws`);
  });
});
