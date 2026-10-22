/**
 * ============================================================
 *  ZerxsBot - Server Web + Bot (entry point)
 *  Jalankan: npm start  -> http://localhost:3000
 * ============================================================
 */
const path = require('path');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');

const config = require('./config');
const sheet = require('./src/lib/spreadsheet');
const botmanager = require('./src/lib/botmanager');
const core = require('./src/lib/core');

const app = express();

app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'zerxsbot-session-secret-ubah-di-produksi',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 }, // 8 jam
}));

app.use(express.static(path.join(__dirname, 'public')));

/* ---------- middleware autentikasi ---------- */
function auth(req, res, next) {
    if (!req.session.user) return res.status(401).json({ ok: false, error: 'Belum login' });
    next();
}
function devOnly(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'developer') {
        return res.status(403).json({ ok: false, error: 'Akses ditolak. Menu developer khusus role Developer.' });
    }
    next();
}

/* ================= AUTENTIKASI ================= */
app.post('/api/login', async (req, res) => {
    const { username, nohp, password } = req.body || {};
    if (!username || !nohp || !password) {
        return res.json({ ok: false, error: 'Username, nomor HP, dan password wajib diisi.' });
    }
    try {
        const hasil = await sheet.login(username, password, nohp);
        if (hasil.ok && hasil.user) {
            req.session.user = {
                username: hasil.user.username,
                nohp: hasil.user.nohp,
                role: String(hasil.user.role).toLowerCase(),
                expired: hasil.user.expired,
            };
            return res.json({ ok: true, user: req.session.user });
        }
        return res.json({ ok: false, error: hasil.error || 'Login gagal.' });
    } catch (e) {
        return res.json({ ok: false, error: 'Server database tidak dapat dihubungi. Periksa konfigurasi Apps Script di config.js.' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', auth, (req, res) => {
    res.json({ ok: true, user: req.session.user });
});

/* ================= DATA PUBLIK (tanpa rahasia) ================= */
app.get('/api/public-info', (req, res) => {
    res.json({
        ok: true,
        namaWeb: config.web.namaWeb,
        deskripsi: config.web.deskripsi,
        versi: config.web.versi,
        telegram: config.web.telegram,
        developer: config.web.developer,
        daftarHarga: config.daftarHarga.map(h => ({
            ...h,
            benefit: describeBenefit(h.role),
        })),
    });
});

function describeBenefit(role) {
    const rc = config.ROLE_CONFIG[role];
    if (!rc) return [];
    const list = [
        `Kuota chat harian: ${rc.kuotaHarian === Infinity ? 'Unlimited' : rc.kuotaHarian + 'x/hari'} (reset 00.00)`,
        `Maks bot di Bot Manager: ${rc.maxBot === Infinity ? 'Unlimited' : rc.maxBot}`,
        rc.perintah === '*' ? 'Akses seluruh perintah personal' : `Perintah: ${rc.perintah.map(p => '/' + p).join(', ')}`,
    ];
    if (rc.grup) list.push('Akses perintah grup WhatsApp');
    if (rc.cs) list.push('Bisa membuat Bot CS (Customer Service AI)');
    if (rc.devMenu) list.push('Akses menu Developer (buat akun gratis 50x/minggu)');
    if (rc.gantiPrefiks) list.push(`Bisa ganti prefiks (${rc.prefiks.join(' ')})`);
    return list;
}

/* ================= GLOBAL INFO (beranda) ================= */
app.get('/api/global-info', auth, async (req, res) => {
    try {
        const [usersRes, botsRes] = await Promise.all([sheet.getUsers(), sheet.getAllBots()]);
        const ping = await sheet.ping().catch(() => ({ ok: false }));
        const onlineCount = [...botmanager.sessions.values()].filter(s => s.status === 'online').length;
        res.json({
            ok: true,
            jumlahUser: usersRes.ok ? (usersRes.users || []).length : 0,
            jumlahAkunSpreadsheet: usersRes.ok ? (usersRes.users || []).length : 0,
            jumlahBot: botsRes.ok ? (botsRes.bots || []).length : 0,
            botOnline: onlineCount,
            statusSpreadsheet: ping.ok ? 'online' : 'offline',
        });
    } catch (e) {
        res.json({ ok: false, error: e.message });
    }
});

/* ================= BOT MANAGER ================= */
app.get('/api/bots', auth, async (req, res) => {
    const r = await sheet.getBots(req.session.user.username);
    const bots = (r.bots || []).map(b => {
        const sid = botmanager.sidOf(b.noBot, b.pemilik);
        const live = botmanager.sessions.get(sid);
        return {
            ...b,
            sesiAktif: !!live,
            statusLive: live ? live.status : 'stopped',
            qrReady: !!(live && live.qrDataUrl),
        };
    });
    res.json({ ok: r.ok !== false, bots, role: req.session.user.role });
});

app.post('/api/bots/add', auth, async (req, res) => {
    const u = req.session.user;
    const rc = config.ROLE_CONFIG[u.role];
    if (!rc) return res.json({ ok: false, error: 'Role tidak dikenali.' });

    const { noBot, namaBot, jenis, promptCs, tentang, produk, harga } = req.body || {};
    const clean = String(noBot || '').replace(/[^0-9]/g, '');
    if (!/^62\d{8,13}$/.test(clean)) {
        return res.json({ ok: false, error: 'Nomor bot tidak valid. Gunakan format 628xxxxxxxxx.' });
    }
    const t = (jenis || 'biasa').toLowerCase();
    if (!['biasa', 'cs'].includes(t)) return res.json({ ok: false, error: 'Jenis bot harus biasa atau cs.' });
    if (t === 'cs' && !(rc.cs)) {
        return res.json({ ok: false, error: 'Role kamu tidak bisa membuat Bot CS. Hanya Business/Developer.' });
    }

    const existing = await sheet.getBots(u.username);
    const count = (existing.bots || []).length;
    if (count >= rc.maxBot) {
        return res.json({ ok: false, error: `Limit bot role ${u.role.toUpperCase()} adalah ${rc.maxBot === Infinity ? 'unlimited' : rc.maxBot}. Hapus bot lain terlebih dahulu.` });
    }

    const namaFinal = (namaBot || '').trim() || `${config.bot.namaBot}-${clean.slice(-4)}`;
    const add = await sheet.addBot({
        pemilik: u.username, noBot: clean, namaBot: namaFinal, jenis: t,
    });
    if (!add.ok) return res.json(add);

    const meta = { id: add.id, pemilik: u.username, noBot: clean, namaBot: namaFinal, jenis: t, promptCs, tentang, produk, harga };
    botmanager.startBot(meta, core.handleMessage).catch(() => {});
    res.json({ ok: true, id: add.id, message: 'Bot berhasil ditambahkan. Silakan pairing.' });
});

app.post('/api/bots/delete', auth, async (req, res) => {
    const { id } = req.body || {};
    const bots = await sheet.getBots(req.session.user.username);
    const target = (bots.bots || []).find(b => b.id === id);
    if (!target) return res.json({ ok: false, error: 'Bot bukan milikmu / tidak ditemukan.' });
    const sid = botmanager.sidOf(target.noBot, target.pemilik);
    await botmanager.stopSession(sid);
    const del = await sheet.deleteBot(id);
    res.json(del);
});

/* ---------- PAIRING ---------- */
app.get('/api/pairing/:id/qr', auth, async (req, res) => {
    const bots = await sheet.getBots(req.session.user.username);
    const target = (bots.bots || []).find(b => b.id === req.params.id);
    if (!target) return res.json({ ok: false, error: 'Bot tidak ditemukan.' });
    const sid = botmanager.sidOf(target.noBot, target.pemilik);
    let entry = botmanager.sessions.get(sid);
    if (!entry) {
        entry = await botmanager.startBot({ ...target }, core.handleMessage).catch(() => null);
        if (!entry) return res.json({ ok: false, error: 'Gagal menjalankan sesi bot.' });
    }
    if (entry.status === 'online') return res.json({ ok: true, status: 'online', message: 'Bot sudah terhubung.' });
    const qr = await botmanager.getQr(sid);
    res.json({ ok: true, status: entry.status, qr });
});

app.post('/api/pairing/:id/code', auth, async (req, res) => {
    const { phone } = req.body || {};
    const bots = await sheet.getBots(req.session.user.username);
    const target = (bots.bots || []).find(b => b.id === req.params.id);
    if (!target) return res.json({ ok: false, error: 'Bot tidak ditemukan.' });
    const sid = botmanager.sidOf(target.noBot, target.pemilik);
    if (!botmanager.sessions.has(sid)) {
        await botmanager.startBot({ ...target }, core.handleMessage).catch(() => {});
        await new Promise(r => setTimeout(r, 2500));
    }
    try {
        const code = await botmanager.requestPairCode(sid, phone);
        res.json({ ok: true, code });
    } catch (e) {
        res.json({ ok: false, error: e.message || 'Gagal membuat pairing code.' });
    }
});

/* ================= PROFIL ================= */
app.post('/api/change-password', auth, async (req, res) => {
    const { lama, baru } = req.body || {};
    const r = await sheet.changePassword(req.session.user.username, lama, baru);
    res.json(r);
});

/* ================= FITUR ================= */
app.get('/api/features', auth, (req, res) => {
    const rc = config.ROLE_CONFIG[req.session.user.role] || config.ROLE_CONFIG.member;
    const daftar = [];
    for (const cmd of config.PERINTAH_PERSONAL) {
        const allowed = rc.perintah === '*' ? true : rc.perintah.includes(cmd);
        daftar.push({ cmd, allowed, desc: DESC[cmd] || '' });
    }
    for (const g of config.PERINTAH_GRUP) {
        daftar.push({ cmd: g, allowed: !!rc.grup, desc: DESC[g] || '', grup: true });
    }
    res.json({ ok: true, role: req.session.user.role, features: daftar });
});

const DESC = {
    ai: 'Tanya jawab dengan AI (DeepSeek)', imageai: 'Buat gambar dari AI',
    coder: 'Buat kode program dari AI', sticker: 'Buat stiker dari media yang di-reply',
    qrcode: 'Buat QR Code / Barcode', translate: 'Terjemahkan teks antar negara',
    iqc: 'Stiker balon chat ala iPhone', brat: 'Stiker teks gaya Brat',
    bratvid: 'Stiker video animasi Brat', info: 'Info rinci tentang bot',
    stickertext: 'Buat stiker teks', meme: 'Dapatkan meme acak',
    nosecret: 'Unduh & lihat pesan sekali lihat', quotes: 'Quotes acak',
    send: 'Kirim pesan ke nomor lain via bot', kurs: 'Nilai tukar mata uang',
    menu: 'Buka menu bot', hash: 'Ubah teks jadi MD5/SHA256',
    tutor: 'Cara memakai perintah bot', subdomain: 'Cari subdomain aktif sebuah domain',
    whois: 'Info registrasi domain', ipinfo: 'Info geolokasi alamat IP',
    biner: 'Ubah teks jadi biner', ytdown: 'Download video/audio YouTube',
    ttdown: 'Download video TikTok', pintdown: 'Download media Pinterest',
    tagall: 'Tag semua member grup', tag: 'Tag 1 user', add: 'Tambah member grup',
    antilink: 'Auto-hapus link + mute pengirim', antitoxic: 'Auto-hapus kata kasar + mute',
    infogroup: 'Info rinci grup', pin: 'Pin pesan', kick: 'Keluarkan member',
    welcome: 'Sambutan otomatis member baru', mute: 'Bungkam user', unmute: 'Pulihkan user',
    rules: 'Peraturan grup', filter: 'Simpan filter pesan', listfilter: 'Daftar filter',
    unfilter: 'Hapus filter', showfilter: 'Lihat isi filter',
};

/* ================= DEVELOPER ================= */
app.get('/api/dev/stats', auth, devOnly, async (req, res) => {
    const users = await sheet.getUsers();
    const list = users.users || [];
    const perRole = {};
    for (const key of Object.keys(config.ROLE_CONFIG)) perRole[key] = 0;
    for (const u of list) {
        const r = String(u.role).toLowerCase();
        perRole[r] = (perRole[r] || 0) + 1;
    }
    const lim = await sheet.getDevLimit(req.session.user.username);
    res.json({
        ok: true,
        totalUser: list.length,
        perRole,
        rolesMeta: Object.entries(config.ROLE_CONFIG).map(([k, v]) => ({
            role: k, label: v.label, harga: v.harga,
            kuota: v.kuotaHarian === Infinity ? 'Unlimited' : v.kuotaHarian,
            maxBot: v.maxBot === Infinity ? 'Unlimited' : v.maxBot,
        })),
        devLimit: { used: lim.jumlah || 0, max: config.devAkunLimit },
        users: list.map(u => ({ username: u.username, role: u.role, nohp: u.nohp, expired: u.expired })),
    });
});

app.post('/api/dev/create-account', auth, devOnly, async (req, res) => {
    const { username, password, role } = req.body || {};
    const boleh = ['member', 'memberpermanen', 'admin'];
    const rNorm = String(role || '').toLowerCase();
    if (!username || !password) return res.json({ ok: false, error: 'Username & password wajib diisi.' });
    if (!boleh.includes(rNorm)) return res.json({ ok: false, error: 'Role hanya: member trial, member permanen, admin.' });
    if (String(password).length < 4) return res.json({ ok: false, error: 'Password minimal 4 karakter.' });

    const lim = await sheet.getDevLimit(req.session.user.username);
    if ((lim.jumlah || 0) >= config.devAkunLimit) {
        return res.json({ ok: false, error: `Limit buat akun gratis minggu ini habis (${config.devAkunLimit}x). Tunggu minggu depan.` });
    }
    const expired = rNorm === 'member'
        ? new Date(Date.now() + 30 * 864e5).toISOString()
        : 'permanen';
    const add = await sheet.addUser(username, password, rNorm, expired, '-');
    if (!add.ok) return res.json(add);
    await sheet.incrDevLimit(req.session.user.username);
    res.json({ ok: true, message: `Akun ${username} (${rNorm}) berhasil dibuat.` });
});

app.post('/api/dev/delete-account', auth, devOnly, async (req, res) => {
    const { username } = req.body || {};
    if (!username) return res.json({ ok: false, error: 'username wajib diisi.' });
    if (String(username).toLowerCase() === String(req.session.user.username).toLowerCase()) {
        return res.json({ ok: false, error: 'Tidak bisa menghapus akun sendiri.' });
    }
    const r = await sheet.deleteUser(username);
    res.json(r);
});

/* ================= SPA ROUTES ================= */
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

/* ================= BOOT ================= */
(async () => {
    // bersihkan akun expired saat server mulai
    try { await sheet.checkExpired(); } catch (_) {}

    // nyalakan kembali bot yang tercatat di spreadsheet (persist antar restart)
    try {
        const bots = await sheet.getAllBots();
        for (const b of bots.bots || []) {
            if (!b.noBot) continue;
            botmanager.startBot({ ...b }, core.handleMessage).catch(() => {});
        }
    } catch (_) {}

    // cek expired tiap jam
    setInterval(async () => {
        try { await sheet.checkExpired(); } catch (_) {}
    }, 3600 * 1000);

    app.listen(config.web.port, () => {
        console.log(`ZerxsBot web berjalan di http://localhost:${config.web.port}`);
    });
})();
