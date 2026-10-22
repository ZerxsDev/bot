/**
 * ============================================================
 *  ZerxsBot - Mesin Inti Bot WhatsApp (dispatcher)
 *  - Prefiks sesuai role (bisa diganti owner/developer via /prefiks)
 *  - Salah perintah dengan prefiks -> peringatan + suruh pakai /menu
 *  - Bot CS (business/developer) -> tanpa prefiks, balas AI gpt-4o-mini
 *  - Kuota harian per role, reset otomatis 00.00
 *  - Perintah grup khusus developer
 *  - Jika nomor bot sama dengan data USERS di spreadsheet, user tetap
 *    bisa memakai bot (dianggap akun terdaftar).
 * ============================================================
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');
const sheet = require('./spreadsheet');

const CMD_DIR = path.join(__dirname, '..', '..', 'commands');
const GRP_DIR = path.join(__dirname, '..', '..', 'groups');

const commands = {};
const groups = {};

function loadHandlers() {
    for (const f of fs.readdirSync(CMD_DIR)) {
        if (f.endsWith('.js')) {
            const name = f.replace(/\.js$/, '');
            commands[name] = require(path.join(CMD_DIR, f));
        }
    }
    for (const f of fs.readdirSync(GRP_DIR)) {
        if (f.endsWith('.js')) {
            const name = f.replace(/\.js$/, '');
            groups[name] = require(path.join(GRP_DIR, f));
        }
    }
}
loadHandlers();

/* ---------- cache profil user dari spreadsheet (60 detik) ---------- */
const userCache = new Map();
async function getUserByPhone(phone) {
    const key = String(phone).replace(/[^0-9]/g, '');
    const hit = userCache.get(key);
    if (hit && Date.now() - hit.t < 60000) return hit.user;
    let user = null;
    try {
        const res = await sheet.getUsers();
        if (res.ok) {
            const found = (res.users || []).find(u =>
                String(u.nohp).replace(/[^0-9]/g, '') === key
            );
            if (found) user = { ...found, role: String(found.role).toLowerCase() };
        }
    } catch (_) {}
    userCache.set(key, { t: Date.now(), user });
    return user;
}

/* ---------- prefiks yang aktif untuk satu sesi bot ---------- */
async function getPrefiksFor(user) {
    // override tersimpan di SETTINGS sheet dengan key PREFIKS:<username>
    if (user) {
        try {
            const s = await sheet.getSetting(`PREFIKS:${user.username}`);
            if (s.ok && s.value && allowedPrefiks(user.role).includes(s.value)) {
                return s.value;
            }
        } catch (_) {}
    }
    return config.bot.prefiksDefault;
}

function allowedPrefiks(role) {
    const rc = config.ROLE_CONFIG[role];
    if (rc && rc.prefiks) return rc.prefiks;
    return [config.bot.prefiksDefault];
}

function isExpired(expired) {
    if (!expired) return false;
    const s = String(expired).toLowerCase();
    if (['', 'permanen', 'permanent', 'selamanya', '-'].includes(s)) return false;
    const d = new Date(expired);
    return !isNaN(d.getTime()) && d.getTime() < Date.now();
}

/* ---------- cek & konsumsi kuota harian ---------- */
async function consumeQuota(user) {
    const rc = config.ROLE_CONFIG[user.role] || { kuotaHarian: 8 };
    const kuota = rc.kuotaHarian;
    if (kuota === Infinity) return { ok: true, used: 0, limit: Infinity };
    const res = await sheet.incrQuota(`USER:${user.username}`);
    if (res.ok) {
        if (res.jumlah > kuota) return { ok: false, used: res.jumlah, limit: kuota };
        return { ok: true, used: res.jumlah, limit: kuota };
    }
    // jika spreadsheet error, jangan blokir total — izinkan tapi log singkat
    return { ok: true, used: 0, limit: kuota };
}

/* ---------- hak akses perintah ---------- */
function canUseCommand(user, cmd) {
    const rc = config.ROLE_CONFIG[user ? user.role : 'member'];
    if (!rc) return false;
    // perintah grup hanya developer
    if (config.PERINTAH_GRUP.includes(cmd)) {
        return !!rc.grup;
    }
    if (rc.perintah === '*') {
        // business: seluruh perintah personal, KECUALI grup (sudah dicek di atas)
        return config.PERINTAH_PERSONAL.includes(cmd);
    }
    return rc.perintah.includes(cmd);
}

/* ---------- daftar nama perintah yang dikenal (untuk deteksi salah perintah) ---------- */
const KNOWN_WORDS = new Set([
    ...config.PERINTAH_PERSONAL,
    ...config.PERINTAH_GRUP,
    'prefiks', 'help',
]);

/** Hak ganti prefiks: owner [/ . !], developer [/ . ! # ? >] */
async function tryGantiPrefiks(ctx) {
    const rc = config.ROLE_CONFIG[ctx.user.role] || {};
    if (!rc.gantiPrefiks) return false;
    const p = ctx.prefiks;
    const body = ctx.text || '';
    const upper = body.toUpperCase();
    if (upper.startsWith('PREFIKS')) {
        const arg = body.slice(7).trim();
        if (!arg) {
            await ctx.sock.sendMessage(ctx.remoteJid, {
                text: `Prefiks aktif: *${p}*\nOpsi yang tersedia untuk role ${ctx.user.role}: ${allowedPrefiks(ctx.user.role).join(' ')}`,
            });
            return true;
        }
        const opsi = allowedPrefiks(ctx.user.role);
        if (!opsi.includes(arg)) {
            await ctx.sock.sendMessage(ctx.remoteJid, {
                text: `⛔ Prefiks *${arg}* tidak diizinkan untuk role ${ctx.user.role}.\nPilihan: ${opsi.join(' ')}`,
            });
            return true;
        }
        await ctx.sheet.setSetting(`PREFIKS:${ctx.user.username}`, arg);
        await ctx.sock.sendMessage(ctx.remoteJid, {
            text: `✅ Prefiks berhasil diubah menjadi *${arg}*\nContoh: ${arg}menu`,
        });
        return true;
    }
    // juga dukung kata kunci dengan prefiks lain, misal ".prefiks !" saat prefiks "/"
    for (const alt of opsi) {
        if (alt !== p && teksIsPrefiksChange(teks0(ctx), alt)) {
            const fakeCtx = { ...ctx, text: ctx.rawBodyAlt };
            // sederhana: proses ulang argumen
            const arg = (ctx.rawBodyAlt || '').slice(7).trim();
            if (arg && opsi.includes(arg)) {
                await ctx.sheet.setSetting(`PREFIKS:${ctx.user.username}`, arg);
                await ctx.sock.sendMessage(ctx.remoteJid, { text: `✅ Prefiks diubah menjadi *${arg}*` });
                return true;
            }
        }
    }
    return false;
}

function teks0(ctx) { return ctx.teksAwal || ''; }

function teksIsPrefiksChange(t, p) {
    if (!t.startsWith(p)) return false;
    const b = t.slice(p.length).toUpperCase().trim();
    return b.startsWith('PREFIKS');
}

/* ---------- deteksi percobaan perintah pada prefiks ALTERNATIF role ---------- */
/** Jika user mengetik ".menu" padahal prefiks aktif "/", dan "." diizinkan untuk
 *  role-nya, maka pesan tetap diproses dengan prefiks alternatif tersebut. */
function matchAltPrefiks(teks, role) {
    const opsi = allowedPrefiks(role).filter(p => p !== config.bot.prefiksDefault);
    for (const alt of opsi) {
        if (teks.startsWith(alt)) return alt;
    }
    return null;
}

/** Deteksi apakah pesan adalah percobaan perintah (kata setelah prefiks mirip perintah) */
function looksLikeCommand(word) {
    const w = (word || '').toLowerCase();
    if (!w) return false;
    if (KNOWN_WORDS.has(w)) return true;
    // heuristik salah ketik: panjang 3-12 huruf saja
    return /^[a-z]{3,12}$/.test(w);
}

/* ================== HANDLER UTAMA PESAN ================== */
async function handleMessage(m, entry) {
    if (!m || !m.key || m.key.fromMe) return;
    const remoteJid = m.key.remoteJid;
    if (!remoteJid || remoteJid === 'status@broadcast' || remoteJid.includes('@newsletter')) return;
    const isGroup = remoteJid.endsWith('@g.us');
    const sender = (m.key.participant || remoteJid || '').split('@')[0];

    const meta = entry.meta || {};
    const jenisBot = meta.jenis || 'biasa';

    // teks pesan
    let teks = '';
    if (typeof m.message?.conversation === 'string') teks = m.message.conversation;
    else if (m.message?.extendedTextMessage?.text) teks = m.message.extendedTextMessage.text;
    else if (m.message?.imageMessage?.caption) teks = m.message.imageMessage.caption;
    else if (m.message?.videoMessage?.caption) teks = m.message.videoMessage.caption;
    teks = (teks || '').trim();

    const user = await getUserByPhone(sender); // boleh null

    /* ================= BOT CS: TANPA PREFIKS ================= */
    if (jenisBot === 'cs') {
        if (isGroup) return; // CS fokus personal chat
        if (!teks) {
            await entry.sock.sendMessage(remoteJid, {
                text: `Selamat ${sapaWaktu()}, kak. Ada yang bisa kami bantu? 😊`,
            });
            return;
        }
        try {
            const ai = require('./openrouter');
            const jawaban = await ai.cs(teks, {
                namaBot: meta.namaBot,
                tentang: meta.tentang,
                produk: meta.produk,
                harga: meta.harga,
                promptCs: meta.promptCs,
            });
            await entry.sock.sendMessage(remoteJid, { text: jawaban });
        } catch (err) {
            await entry.sock.sendMessage(remoteJid, {
                text: `Selamat ${sapaWaktu()}, kak. Ada yang bisa kami bantu?`,
            });
        }
        return;
    }

    /* ================= BOT BIASA ================= */
    const prefiks = await getPrefiksFor(user);

    // Bot biasa hanya merespons pesan yang diawali prefiks.
    if (!teks) return;

    // Tentukan prefiks yang benar-benar dipakai user (aktif atau alternatif role)
    let usedPrefiks = null;
    if (teks.startsWith(prefiks)) {
        usedPrefiks = prefiks;
    } else {
        const alt = matchAltPrefiks(teks, user.role);
        if (alt && looksLikeCommand((teks.slice(alt.length).split(/\s+/)[0] || ''))) {
            usedPrefiks = alt;
        }
    }
    if (!usedPrefiks) return;

    const body = teks.slice(usedPrefiks.length).trim();
    const [cmdRaw, ...args] = body.split(/\s+/);
    const cmd = (cmdRaw || '').toLowerCase();

    const ctx = {
        sock: entry.sock, m, remoteJid, isGroup, sender, args, text: body,
        user, entry, meta, prefiks: usedPrefiks, config, sheet,
        quoted: getQuoted(m),
    };

    // perintah tanpa user terdaftar -> tolak (data harus ada di spreadsheet)
    if (!user) {
        await entry.sock.sendMessage(remoteJid, {
            text: `⛔ Nomor kamu tidak terdaftar sebagai pengguna ZerxsBot.\n` +
                  `Silakan daftar / beli akses terlebih dahulu melalui website ZerxsBot atau hubungi ${config.web.telegram}`,
        });
        return;
    }

    // expired -> hapus otomatis dari database
    if (isExpired(user.expired)) {
        await entry.sock.sendMessage(remoteJid, {
            text: `⛔ Akun *${user.username}* sudah EXPIRED dan otomatis dihapus dari database.\nPerpanjang akses: ${config.web.telegram}`,
        });
        try { await sheet.deleteUser(user.username); } catch (_) {}
        return;
    }

    // perintah khusus ganti prefiks (owner/developer)
    if (await tryGantiPrefiks(ctx)) return;

    // menu & info selalu boleh walau salah ketik
    if (!cmd) {
        await kirimSalahPerintah(ctx);
        return;
    }

    // perintah grup selain developer
    if (isGroup && config.PERINTAH_GRUP.includes(cmd) && !canUseCommand(user, cmd)) {
        await entry.sock.sendMessage(remoteJid, {
            text: '⛔ Perintah grup hanya dapat digunakan oleh akun role *Developer*.',
        });
        return;
    }

    // hak akses role terhadap perintah
    // kata dikenal tapi bukan bagian benefit -> kunci; kata tak dikenal -> salah perintah
    const known = KNOWN_WORDS.has(cmd) || groups[cmd] || commands[cmd];
    if (known && !canUseCommand(user, cmd)) {
        await entry.sock.sendMessage(remoteJid, {
            text: `🔒 Perintah *${usedPrefiks}${cmd}* tidak termasuk benefit role *${user.role.toUpperCase()}*.\n` +
                  `Upgrade akses: ${config.web.telegram}`,
        });
        return;
    }

    // kuota harian (untuk perintah yang memakai AI/beratnya dihitung semua perintah ber-argumen)
    const PERINTAH_KUOTA = ['ai', 'imageai', 'coder', 'sticker', 'stickertext', 'brat', 'bratvid', 'iqc',
        'qrcode', 'translate', 'quotes', 'send', 'kurs', 'hash', 'biner', 'ytdown', 'ttdown', 'pintdown',
        'subdomain', 'whois', 'ipinfo', 'meme', 'nosecret'];
    if (PERINTAH_KUOTA.includes(cmd)) {
        const q = await consumeQuota(user);
        if (!q.ok) {
            await entry.sock.sendMessage(remoteJid, {
                text: `📭 *LIMIT HABIS*\nKuota harian role ${user.role.toUpperCase()} (${q.limit}x/hari) sudah terpakai semua.\nLimit akan direset besok jam 00.00 WIB.`,
            });
            return;
        }
    }

    // jalankan perintah (grup dulu bila di grup & tersedia modul grup)
    try {
        if (isGroup && groups[cmd]) {
            await groups[cmd](ctx);
        } else if (commands[cmd]) {
            await commands[cmd](ctx);
        } else {
            await kirimSalahPerintah(ctx);
        }
    } catch (err) {
        await entry.sock.sendMessage(remoteJid, {
            text: `❌ Terjadi kesalahan saat menjalankan *${usedPrefiks}${cmd}*:\n${(err.message || err).toString().slice(0, 300)}`,
        });
    }
}

async function kirimSalahPerintah(ctx) {
    const p = ctx.prefiks;
    const kata = ctx.text ? ctx.text.split(/\s+/)[0] : '';
    await ctx.sock.sendMessage(ctx.remoteJid, {
        text:
`❌ *Salah perintah!*
Perintah \`${p}${kata}\` tidak dikenali / tidak tersedia.

✅ Gunakan *${p}menu* untuk melihat seluruh daftar perintah ZerxsBot yang benar.`
    });
}

function getQuoted(m) {
    const ext = m.message?.extendedTextMessage;
    if (ext && ext.contextInfo && ext.contextInfo.quotedMessage) {
        return { key: ext.contextInfo.quotedMessageId ? { id: ext.contextInfo.quotedMessageId } : undefined, message: ext.contextInfo.quotedMessage };
    }
    return null;
}

function sapaWaktu() {
    const h = new Date().getHours();
    if (h >= 4 && h < 11) return 'Pagi';
    if (h >= 11 && h < 15) return 'Siang';
    if (h >= 15 && h < 18) return 'Sore';
    return 'Malam';
}

module.exports = { handleMessage, getUserByPhone, isExpired, sapaWaktu };
