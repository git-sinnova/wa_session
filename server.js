import express from "express";
import { makeWASocket, useMultiFileAuthState } from "baileys";
import qrcode from "qrcode";
import { WebSocketServer } from "ws";
import path from "path";

const app = express();
const port = process.env.PORT || 3000;

// Serve index.html for testing
app.get("/", (req, res) => {
  res.sendFile(path.resolve("./index.html"));
});

// WebSocket for QR streaming
const wss = new WebSocketServer({ noServer: true });
const clients = new Set();

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
});

// Upgrade HTTP -> WS
app.server = app.listen(port, () => console.log(`Server running on port ${port}`));
app.server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

// Emit QR to all clients
function broadcastQR(qrImage) {
  clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ qr: qrImage }));
  });
}

// Fake QR for testing (every 5 seconds)
async function emitFakeQR() {
  const fakeQR = Math.random().toString(36).substring(2, 12);
  const qrImage = await qrcode.toDataURL(fakeQR);
  broadcastQR(qrImage);
}
setInterval(emitFakeQR, 5000);

// Start Baileys WhatsApp socket (optional)
async function startWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");
    const sock = makeWASocket({ auth: state, printQRInTerminal: false });

    sock.ev.on("connection.update", async (update) => {
      const { qr, connection } = update;

      if (qr) {
        const qrImage = await qrcode.toDataURL(qr);
        broadcastQR(qrImage);
      }

      if (connection === "open") {
        console.log("WhatsApp connected!");
      }
    });

    sock.ev.on("creds.update", saveCreds);
  } catch (err) {
    console.error("Baileys start error:", err);
  }
}

// Uncomment this to use real WhatsApp session
// startWhatsApp();
