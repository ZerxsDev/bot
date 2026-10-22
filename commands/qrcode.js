/**
 * /qrcode [teks/url] [qr|kodebatang] — Buat QR Code atau Barcode.
 */
const axios = require('axios');

module.exports = async function (ctx) {
    const args = ctx.args;
    if (!args.length) {
        return ctx.sock.sendMessage(ctx.remoteJid, {
            text: `Contoh:\n${ctx.prefiks}qrcode https://example.com qr\n${ctx.prefiks}qrcode 12345 kodebatang`, quoted: ctx.m,
        });
    }
    const mode = (args[args.length - 1] || '').toLowerCase();
    let teks = args.join(' ');
    let isBar = false;
    if (mode === 'kodebatang' || mode === 'barcode') { teks = args.slice(0, -1).join(' '); isBar = true; }
    else if (mode === 'qr') { teks = args.slice(0, -1).join(' '); }
    if (!teks) return ctx.sock.sendMessage(ctx.remoteJid, { text: 'Teks/URL tidak boleh kosong.', quoted: ctx.m });

    try {
        // Gunakan API publik yang andal: quickchart
        const qurl = isBar
            ? `https://quickchart.io/barcode?format=png&width=400&height=120&text=${encodeURIComponent(teks)}&codeline=CODE128`
            : `https://quickchart.io/qr?size=400&dark=1e3a8a&light=ffffff&text=${encodeURIComponent(teks)}`;
        const res = await axios.get(qurl, { responseType: 'arraybuffer' });
        await ctx.sock.sendMessage(ctx.remoteJid, {
            image: Buffer.from(res.data),
            caption: `${isBar ? '📊 Barcode' : '🔳 QRCode'} untuk: ${teks.slice(0, 60)}`,
        });
    } catch (e) {
        await ctx.sock.sendMessage(ctx.remoteJid, { text: '❌ Gagal membuat kode: ' + (e.message || e), quoted: ctx.m });
    }
};
