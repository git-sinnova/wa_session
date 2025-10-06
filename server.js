import express from "express";
import { WebSocketServer } from "ws";
import qrcode from "qrcode";
import http from "http";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static("public"));

// Serve main QR page
app.get("/", (req, res) => {
  res.sendFile(new URL("./index.html", import.meta.url).pathname);
});

// Broadcast QR to all connected clients
function broadcastQR(qrDataURL) {
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ qr: qrDataURL }));
    }
  });
}

// Simulate new QR every 10s
async function emitFakeQR() {
  const randomText = `Session-${Math.floor(Math.random() * 999999)}`;
  const qr = await qrcode.toDataURL(randomText);
  broadcastQR(qr);
}

// Re-emit fake QR every 10 seconds
setInterval(emitFakeQR, 10000);
emitFakeQR();

wss.on("connection", ws => {
  console.log("Client connected to QR WebSocket");
  emitFakeQR();
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
