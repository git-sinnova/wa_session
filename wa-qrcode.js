import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "baileys";
import qrcode from "qrcode-terminal";

async function startWhatsApp() {
    // Generate auth state (for demo purposes, useMultiFileAuthState stores credentials locally)
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true // For testing QR in terminal
    });

    // Listen for QR code
    sock.ev.on("connection.update", (update) => {
        const { connection, qr } = update;
        if (qr) {
            console.log("QR Code:", qr);
            qrcode.generate(qr, { small: true }); // show in terminal
        }

        if (connection === "open") {
            console.log("Connected to WhatsApp!");
        }
    });

    // Listen for auth credentials update
    sock.ev.on("creds.update", saveCreds);
}

startWhatsApp();
