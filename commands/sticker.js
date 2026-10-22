/**
 * /sticker [reply media] — Konversi media yang di-reply menjadi stiker.
 */
module.exports = async function (ctx) {
    const q = ctx.quoted;
    if (!q) {
        return ctx.sock.sendMessage(ctx.remoteJid, {
            text: `Balas (reply) foto/video dengan perintah ${ctx.prefiks}sticker`, quoted: ctx.m,
        });
    }
    try {
        const buf = await ctx.sock.downloadMediaMessage(q);
        // video -> ambil frame? Baileys bisa kirim sticker dari webp; untuk jpg/png cukup dikirim sebagai sticker
        await ctx.sock.sendMessage(ctx.remoteJid, { sticker: buf });
    } catch (e) {
        await ctx.sock.sendMessage(ctx.remoteJid, { text: '❌ Gagal membuat stiker: ' + (e.message || e), quoted: ctx.m });
    }
};
