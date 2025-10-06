import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import cors from "cors";
import { makeWASocket, useMultiFileAuthState } from "@whiskeysockets/baileys";
import qrcode from "qrcode";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// CORS & iframe embed for Framer
app.use(cors({ origin: "*" }));
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "ALLOWALL");
  next();
});

// Simple route (optional)
app.get("/", (req, res) => {
  res.send("WhatsApp QR Server running");
});

// Broadcast QR to all connected WebSocket clients
function broadcastQR(qrDataURL) {
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(JSON.stringify({ qr: qrDataURL }));
  });
}

// Start Baileys socket
async function startSocket() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth_info_multi");

  const sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
    browser: ["Render", "Chrome", "4.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async update => {
    const { qr, connection } = update;

    if (qr) {
      const qrDataURL = await qrcode.toDataURL(qr);
      broadcastQR(qrDataURL);
      console.log("📌 QR sent to clients");
    }

    if (connection === "open") {
      console.log("✅ WhatsApp connected");
      broadcastQR(""); // clear QR on clients
    }

    if (connection === "close") {
      console.log("⚠️ WhatsApp disconnected");
    }
  });
}

// Start the socket
startSocket().catch(err => console.error("Socket error:", err));

// Log WebSocket connections
wss.on("connection", ws => {
  console.log("Client connected to QR WebSocket");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
