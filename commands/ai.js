/**
 * /ai [prompt] — Tanya jawab AI (DeepSeek via OpenRouter).
 */
const ai = require('../src/lib/openrouter');

module.exports = async function (ctx) {
    const prompt = ctx.args.join(' ').trim();
    if (!prompt) {
        return ctx.sock.sendMessage(ctx.remoteJid, {
            text: `Contoh:\n${ctx.prefiks}ai halo apa kabar?`,
            quoted: ctx.m,
        });
    }
    try { await ctx.sock.sendPresenceUpdate('composing'); } catch (_) {}
    const msg = await ctx.sock.sendMessage(ctx.remoteJid, { text: '🤖 AI sedang berpikir…', quoted: ctx.m });
    try {
        const jawaban = await ai.ai(prompt);
        await ctx.sock.sendMessage(ctx.remoteJid, { text: jawaban, quoted: ctx.m });
    } catch (e) {
        await ctx.sock.sendMessage(ctx.remoteJid, { text: '❌ ' + (e.message || 'AI error'), quoted: ctx.m });
    }
};
