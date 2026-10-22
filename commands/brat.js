/**
 * /brat [teks] — Stiker teks gaya "Brat" (Charli XCX) versi gambar.
 */
const axios = require('axios');

module.exports = async function (ctx) {
    const teks = ctx.args.join(' ').trim();
    if (!teks) return ctx.sock.sendMessage(ctx.remoteJid, { text: `Contoh:\n${ctx.prefiks}brat zerxsbot keren`, quoted: ctx.m });
    try {
        // API publik pembuat brat image
        const res = await axios.get('https://api.yanzsalez.my.id/api/maker/brat', {
            params: { text: teks, apikey: 'yanzz' }, responseType: 'arraybuffer', timeout: 25000,
        }).catch(async () => axios.get('https://apisanksay.xyz/api/brat?text=' + encodeURIComponent(teks), { responseType: 'arraybuffer', timeout: 25000 }));
        await ctx.sock.sendMessage(ctx.remoteJid, { sticker: Buffer.from(res.data) });
    } catch (e) {
        await ctx.sock.sendMessage(ctx.remoteJid, {
            text: `🟣 BRAT: *${teks.toUpperCase()}*\n_(Server generator sedang sibuk, coba lagi.)_`, quoted: ctx.m,
        });
    }
};
