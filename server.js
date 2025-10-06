import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import cors from "cors";
import { makeWASocket, useMultiFileAuthState } from "@whiskeysockets/baileys";
import qrcode from "qrcode";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors({ origin: "*" }));
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "ALLOWALL"); // allow Framer iframe
  next();
});

app.get("/", (req, res) => {
  res.sendFile(new URL("./index.html", import.meta.url).pathname);
});

// Send QR to all connected clients
function broadcastQR(qrDataURL) {
  wss.clients.forEach(c => {
    if (c.readyState === 1) c.send(JSON.stringify({ qr: qrDataURL }));
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

  sock.ev.on("connection.update", async (update) => {
    const { qr, connection } = update;

    if (qr) {
      const qrDataURL = await qrcode.toDataURL(qr);
      broadcastQR(qrDataURL);
    }

    if (connection === "open") {
      console.log("✅ WhatsApp connected");
      broadcastQR(""); // clear QR once connected
    }
  });
}

startSocket().catch(err => console.error(err));

// Fallback dummy QR every 15s (ensures Framer always sees something)
setInterval(async () => {
  const randomQR = `TEST-${Date.now()}`;
  const qrDataURL = await qrcode.toDataURL(randomQR);
  broadcastQR(qrDataURL);
}, 15000);

wss.on("connection", ws => {
  console.log("Client connected to QR WebSocket");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
