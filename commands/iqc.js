/**
 * /iqc [teks] — Stiker balon chat tiruan iPhone (iQuote iPhone style).
 */
const axios = require('axios');

module.exports = async function (ctx) {
    const teks = ctx.args.join(' ').trim();
    if (!teks) return ctx.sock.sendMessage(ctx.remoteJid, { text: `Contoh:\n${ctx.prefiks}iqc halo kak 👋`, quoted: ctx.m });
    try {
        // API publik pembuat stiker quote ala iPhone
        const res = await axios.get('https://api.popcat.xyz/quotely', {
            params: { text: teks, name: ctx.user.username }, timeout: 25000,
        }).catch(async () => {
            // fallback ke api alternative
            return axios.get(`https://some-random-api.com/canvas/misc/quote-card?title=&comment=${encodeURIComponent(teks)}&avatar=&background=282a2d&border=7618b8`, { responseType: 'arraybuffer', timeout: 25000 });
        });
        if (res.data?.image) {
            const img = await axios.get(res.data.image, { responseType: 'arraybuffer' });
            await ctx.sock.sendMessage(ctx.remoteJid, { sticker: Buffer.from(img.data) });
        } else {
            await ctx.sock.sendMessage(ctx.remoteJid, { sticker: Buffer.from(res.data), caption: undefined });
        }
    } catch (e) {
        await ctx.sock.sendMessage(ctx.remoteJid, {
            text: `📱 iQC untuk *${ctx.user.username}*:\n\n「 ${teks} 」\n\n_(Generator gambar sedang sibuk, coba lagi.)_`,
            quoted: ctx.m,
        });
    }
};
