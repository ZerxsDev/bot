/**
 * /coder [perintah kode] — AI programmer (DeepSeek).
 */
const ai = require('../src/lib/openrouter');

module.exports = async function (ctx) {
    const prompt = ctx.args.join(' ').trim();
    if (!prompt) {
        return ctx.sock.sendMessage(ctx.remoteJid, { text: `Contoh:\n${ctx.prefiks}coder buat program python tebak angka`, quoted: ctx.m });
    }
    try { await ctx.sock.sendPresenceUpdate('composing'); } catch (_) {}
    await ctx.sock.sendMessage(ctx.remoteJid, { text: '💻 Coder sedang menulis kode…', quoted: ctx.m });
    try {
        const out = await ai.coder(prompt);
        // WhatsApp tidak render markdown code block, ubah ke monospace sederhana
        await ctx.sock.sendMessage(ctx.remoteJid, { text: out.replace(/```(\w*)/g, '─').slice(0, 6500), quoted: ctx.m });
    } catch (e) {
        await ctx.sock.sendMessage(ctx.remoteJid, { text: '❌ ' + (e.message || 'AI error'), quoted: ctx.m });
    }
};
