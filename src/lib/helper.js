/**
 * ZerxsBot - Message Helper: util kirim pesan/media Baileys.
 */
const axios = require('axios');

/** Unduh file dari URL menjadi Buffer */
async function fetchBuffer(url) {
    const res = await axios.get(url, { responseType: 'arraybuffer', maxContentLength: 100 * 1024 * 1024 });
    return Buffer.from(res.data);
}

module.exports = {
    fetchBuffer,

    /** Teks biasa */
    async text(sock, to, teks, opts = {}) {
        return sock.sendMessage(to, { text: teks, ...opts });
    },

    /** Teks + reply */
    async reply(sock, m, teks, opts = {}) {
        return sock.sendMessage(m.key.remoteJid, { text: teks, quoted: m, ...opts });
    },

    /** Gambar */
    async image(sock, to, buffer, caption = '', opts = {}) {
        return sock.sendMessage(to, { image: buffer, caption, ...opts });
    },

    /** Video */
    async video(sock, to, buffer, caption = '', opts = {}) {
        return sock.sendMessage(to, { video: buffer, caption, ...opts });
    },

    /** Audio / dokumen */
    async document(sock, to, buffer, fileName = 'file', mimetype = 'application/octet-stream', caption = '', opts = {}) {
        return sock.sendMessage(to, { document: buffer, fileName, mimetype, caption, ...opts });
    },

    /** Stiker dari buffer gambar */
    async sticker(sock, to, imageBuffer, opts = {}) {
        return sock.sendMessage(to, {
            sticker: imageBuffer,
            ...opts,
        });
    },

    /** Unduh media dari pesan (viewOnce boleh dipaksa) */
    async downloadMedia(sock, msg) {
        const content = msg.message?.imageMessage || msg.message?.videoMessage ||
            msg.message?.audioMessage || msg.message?.documentMessage || msg.message?.stickerMessage;
        if (!content) throw new Error('Tidak ada media pada pesan ini');
        const stream = await sock.downloadMediaMessage({ message: msg.message });
        return stream;
    },
};
