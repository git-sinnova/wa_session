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
  res.setHeader("X-Frame-Options", "ALLOWALL");
  next();
});

app.get("/", (req, res) => {
  res.send("Baileys QR Server running");
});

function broadcastQR(qrDataURL) {
  wss.clients.forEach(c => {
    if (c.readyState === 1) c.send(JSON.stringify({ qr: qrDataURL }));
  });
}

async function startSocket() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth_info_multi");

  const sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
    browser: ["Render", "Chrome", "4.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  // Baileys emits qr every few seconds until linked
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

startSocket().catch(err => console.error("Socket error", err));

// keep-alive: if no QR arrives within 15 s, ping clients
setInterval(() => {
  broadcastQR(""); // this also prevents stale QR in UI
}, 15000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
