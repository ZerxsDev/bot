/**
 * ZerxsBot - Bot Manager: menyimpan seluruh instance Baileys per user.
 * Setiap user dapat memiliki beberapa nomor bot sesuai limit role.
 */
const fs = require('fs');
const path = require('path');
const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion,
    DisconnectReason, getAggregateVotesInPollMessage } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const P = require('./helper.js'); // tidak dipakai langsung, jaga konsistensi

const config = require('../config');
const sheet = require('./spreadsheet');

// Map sessionId -> state
const sessions = new Map();

/** Buat session id unik dari noBot + username agar tidak bentrok */
function sidOf(noBot, owner) {
    const clean = String(noBot).replace(/[^0-9]/g, '');
    return `${clean}_${String(owner).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

/** Ambil QR data URL untuk sesi tertentu */
async function getQr(sessionId) {
    const s = sessions.get(sessionId);
    if (!s) return null;
    if (s.qrDataUrl) return s.qrDataUrl;
    return null;
}

/** Mint pairing code dengan nomor telepon (format 62xxxxxxxxxx) */
async function requestPairCode(sessionId, phone) {
    const s = sessions.get(sessionId);
    if (!s || !s.sock) throw new Error('Sesi bot belum siap, coba lagi sebentar.');
    const clean = String(phone).replace(/[^0-9]/g, '');
    if (!/^62\d{8,12}$/.test(clean)) {
        throw new Error('Nomor tidak valid. Gunakan format 628xxxxxxxxx (tanpa + atau spasi).');
    }
    // Bailejs: sock.requestPairingCode(number) mengembalikan kode 8 karakter
    const res = await s.sock.requestPairingCode(clean.toUpperCase());
    return res;
}

/** Hentikan & hapus sesi */
async function stopSession(sessionId) {
    const s = sessions.get(sessionId);
    if (!s) return;
    try { s.sock?.end?.(); } catch (_) {}
    sessions.delete(sessionId);
    // hapus folder auth
    const dir = path.join(config.bot.sessionFolder, sessionId);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
    // tandai offline di spreadsheet
    try { await sheet.updateBotStatus(s.meta.id, 'offline'); } catch (_) {}
}

/**
 * Jalankan bot baru untuk meta {id,pemilik,noBot,namaBot,jenis,promptCs,...}
 * options.alreadyRunning dicek oleh pemanggil.
 */
async function startBot(meta, handler) {
    const sessionId = sidOf(meta.noBot, meta.pemilik);
    if (sessions.has(sessionId)) {
        // sudah jalan — update meta saja
        const ex = sessions.get(sessionId);
        ex.meta = meta;
        return ex;
    }

    const authDir = path.join(config.bot.sessionFolder, sessionId);
    fs.mkdirSync(authDir, { recursive: true });
    const { state, credsUpdatedWithEvent } = await useMultiFileAuthState(authDir);

    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,   // JANGAN spam terminal — QR dikirim ke web
        browser: ['ZerxsBot', 'Chrome', '1.0.0'],
    });

    const entry = {
        sessionId, sock, meta,
        qrDataUrl: null,
        status: 'connecting',
        lastError: null,
        history: [],      // riwayat AI personal per sesi
    };
    sessions.set(sessionId, entry);

    sock.ev.on('connection.update', async (u) => {
        const { connection, lastPullResult, qr, code } = u;
        if (qr) {
            try {
                entry.qrDataUrl = await qrcode.toDataURL(qr);
            } catch (e) { entry.qrDataUrl = null; }
            entry.status = 'qr';
            try { await sheet.updateBotStatus(meta.id, 'pairing'); } catch (_) {}
        }
        if (code) {
            entry.pairCode = code;
        }
        if (connection === 'open') {
            entry.status = 'online';
            entry.qrDataUrl = null;
            try { await sheet.updateBotStatus(meta.id, 'online'); } catch (_) {}
        }
        if (connection === 'close') {
            const reason = u.lastDisconnect?.error?.output?.statusCode;
            const loggedOut = reason === DisconnectReason.loggedOut;
            // hapus dari map dulu agar tidak dianggap "sudah jalan" saat reconnect
            sessions.delete(sessionId);
            if (loggedOut) {
                try { fs.rmSync(path.join(config.bot.sessionFolder, sessionId), { recursive: true, force: true }); } catch (_) {}
                try { await sheet.updateBotStatus(meta.id, 'offline'); } catch (_) {}
            } else {
                // reconnect otomatis tanpa spam log terminal
                setTimeout(() => {
                    startBot(meta, handler).catch(() => {});
                }, 3000);
            }
        }
    });

    // pasang message handler milik aplikasi
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'append' && type !== 'notify') return;
        for (const m of messages) {
            try {
                await handler(m, entry);
            } catch (err) {
                // jangan spam console penuh stacktrace tiap pesan error
            }
        }
    });

    return entry;
}

module.exports = {
    sidOf,
    getQr,
    requestPairCode,
    stopSession,
    startBot,
    sessions,
};
