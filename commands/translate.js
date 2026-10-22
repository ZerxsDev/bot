/**
 * /translate [kode negara 1] [teks...] [kode negara 2]
 * Contoh: /translate id halo apa kabar en
 */
const axios = require('axios');

module.exports = async function (ctx) {
    const args = ctx.args;
    if (args.length < 3) {
        return ctx.sock.sendMessage(ctx.remoteJid, {
            text: `Contoh:\n${ctx.prefiks}translate id halo apa kabar en\n(kode negara: id, en, ja, ko, ar, zh, ...)`, quoted: ctx.m,
        });
    }
    const src = args[0].toLowerCase();
    const dest = args[args.length - 1].toLowerCase();
    const teks = args.slice(1, -1).join(' ');
    try {
        const res = await axios.get('https://api.mymemory.translated.net/get', {
            params: { q: teks, langpair: `${src}|${dest}` }, timeout: 20000,
        });
        const d = res.data?.responseData;
        if (!d || !d.translatedText) throw new Error('Terjemahan tidak tersedia');
        await ctx.sock.sendMessage(ctx.remoteJid, {
            text: `🌐 *Translate* ${src.toUpperCase()} → ${dest.toUpperCase()}\n\nTeks: ${teks}\nHasil: ${d.translatedText}`,
            quoted: ctx.m,
        });
    } catch (e) {
        await ctx.sock.sendMessage(ctx.remoteJid, { text: '❌ Gagal translate: ' + (e.message || e), quoted: ctx.m });
    }
};
