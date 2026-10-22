/**
 * /bratvid [teks] — Versi animasi (bergerak) dari stiker Brat.
 */
const axios = require('axios');

module.exports = async function (ctx) {
    const teks = ctx.args.join(' ').trim();
    if (!teks) return ctx.sock.sendMessage(ctx.remoteJid, { text: `Contoh:\n${ctx.prefiks}bratvid zerxsbot keren`, quoted: ctx.m });
    try {
        const res = await axios.get('https://api.yanzsalez.my.id/api/maker/bratvideo', {
            params: { text: teks, apikey: 'yanzz' }, responseType: 'arraybuffer', timeout: 40000,
        }).catch(async () => axios.get('https://apisanksay.xyz/api/bratvid?text=' + encodeURIComponent(teks), { responseType: 'arraybuffer', timeout: 40000 }));
        // kirim sebagai sticker animasi (mp4/webm otomatis di-convert WhatsApp bila format didukung)
        await ctx.sock.sendMessage(ctx.remoteJid, { video: Buffer.from(res.data), gifPlayback: true });
    } catch (e) {
        await ctx.sock.sendMessage(ctx.remoteJid, {
            text: `🟣 BRATVID: *${teks.toUpperCase()}*\n_(Generator video sibuk, coba lagi.)_`, quoted: ctx.m,
        });
    }
};
