import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import cors from "cors";
import { makeWASocket, useMultiFileAuthState } from "@whiskeysockets/baileys";
import qrcode from "qrcode";
import fs from "fs";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Allow Framer iframe embedding
app.use(cors({ origin: "*" }));
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "ALLOWALL");
  next();
});

// Optional HTTP route
app.get("/", (req, res) => {
  res.send("WhatsApp QR Server running");
});

// Broadcast QR to all connected WebSocket clients
function broadcastQR(qrDataURL) {
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(JSON.stringify({ qr: qrDataURL }));
  });
}

// Force session reset to ensure fresh QR
if (fs.existsSync("./auth_info_multi")) {
  console.log("🗑 Removing old auth_info_multi for fresh QR");
  fs.rmSync("./auth_info_multi", { recursive: true, force: true });
}

// Start Baileys WhatsApp socket
async function startSocket() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth_info_multi");

  const sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
    browser: ["Render", "Chrome", "4.0"],
  });

  // Save credentials
  sock.ev.on("creds.update", saveCreds);

  // Listen for connection updates
  sock.ev.on("connection.update", async update => {
    const { qr, connection } = update;

    if (qr) {
      // Convert QR to image
      const qrDataURL = await qrcode.toDataURL(qr);
      broadcastQR(qrDataURL);
      console.log("📌 QR sent to clients");
    }

    if (connection === "open") {
      console.log("✅ WhatsApp connected");
      broadcastQR(""); // clear QR
    }

    if (connection === "close") {
      console.log("⚠️ WhatsApp disconnected");
    }
  });
}

// Launch WhatsApp socket
startSocket().catch(err => console.error("Socket error:", err));

// Handle WebSocket client connections
wss.on("connection", ws => {
  console.log("Client connected to QR WebSocket");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
