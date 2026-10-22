/**
 * /imageai [prompt gambar] — Generate gambar via AI OpenRouter.
 */
const ai = require('../src/lib/openrouter');

module.exports = async function (ctx) {
    const prompt = ctx.args.join(' ').trim();
    if (!prompt) {
        return ctx.sock.sendMessage(ctx.remoteJid, { text: `Contoh:\n${ctx.prefiks}imageai kucing astronot di bulan`, quoted: ctx.m });
    }
    try { await ctx.sock.sendPresenceUpdate('composing'); } catch (_) {}
    await ctx.sock.sendMessage(ctx.remoteJid, { text: '🎨 Menggambar… (30-90 detik)', quoted: ctx.m });
    try {
        const buf = await ai.image(prompt);
        await ctx.sock.sendMessage(ctx.remoteJid, { image: buf, caption: `Hasil AI: ${prompt}` });
    } catch (e) {
        await ctx.sock.sendMessage(ctx.remoteJid, { text: '❌ ' + (e.message || 'Gagal membuat gambar'), quoted: ctx.m });
    }
};
