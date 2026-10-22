/**
 * ZerxsBot - Klien OpenRouter AI.
 * API key HANYA dibaca dari config.js, tidak pernah dikirim ke frontend.
 */
const axios = require('axios');
const config = require('../../config');

const or = () => config.openrouter;

async function chat(messages, { model, temperature = 0.7 } = {}) {
    const key = or().apiKey;
    if (!key || key.indexOf('MASUKKAN_') === 0) {
        throw new Error('API Key OpenRouter belum dikonfigurasi di config.js');
    }
    const res = await axios.post(
        `${or().baseUrl}/chat/completions`,
        {
            model: model || or().modelAi,
            messages,
            temperature,
        },
        {
            headers: {
                Authorization: `Bearer ${key}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://zerxsbot.local',
                'X-Title': 'ZerxsBot',
            },
            timeout: 60000,
        }
    );
    return res.data?.choices?.[0]?.message?.content || '(AI tidak memberikan respons)';
}

module.exports = {
    /** /ai - assistant umum (deepseek) */
    ai: (prompt, history = []) =>
        chat(
            [
                { role: 'system', content: 'Kamu adalah ZerxsBot, asisten WhatsApp yang cerdas, ramah, dan membantu. Jawab dalam bahasa yang sama dengan user.' },
                ...history,
                { role: 'user', content: prompt },
            ],
            { model: or().modelAi }
        ),

    /** /coder - programmer ahli */
    coder: (prompt) =>
        chat(
            [
                { role: 'system', content: 'Kamu adalah ZerxsBot Coder, programmer expert. Berikan kode lengkap, bersih, beri penjelasan singkat, gunakan code block markdown.' },
                { role: 'user', content: prompt },
            ],
            { model: or().modelAi, temperature: 0.3 }
        ),

    /** Bot CS business/developer - gpt-4o-mini */
    cs: (prompt, botContext = {}) => {
        const namaBisnis = botContext.namaBot || 'Toko Kami';
        const tentang = botContext.tentang || '';
        const produk = botContext.produk || '';
        const harga = botContext.harga || '';
        const customPrompt = botContext.promptCs || '';
        const system = `
Kamu adalah Customer Service resmi WhatsApp untuk bisnis "${namaBisnis}".
${tentang ? 'Tentang bisnis: ' + tentang : ''}
${produk ? 'Produk/Jasa yang dijual: ' + produk : ''}
${harga ? 'Daftar harga: ' + harga : ''}
${customPrompt ? 'Instruksi tambahan dari pemilik bisnis: ' + customPrompt : ''}

ATURAN KERAS:
1. Balas dengan bahasa Indonesia yang BAKU, SOPAN, RAMAH, dan mudah dimengerti.
2. Sapa sesuai waktu jika diperlukan, namun inti jawaban harus menjawab pertanyaan customer.
3. Jelaskan apa saja yang dijual beserta harganya bila ditanya.
4. Jika customer ingin membeli/menyewa, tampilkan harga secara sopan dan arahkan cara pemesanan.
5. Jika pertanyaan TIDAK berkaitan dengan bisnis ini, jawab: "Maaf saya tidak bisa membantu karena saya adalah CS khusus menjawab pertanyaan Anda seputar bisnis kami."
6. Pahami keluhan customer dengan empati lalu berikan solusi.
7. Jangan pernah mengaku sebagai AI, kamu adalah CS "${namaBisnis}".
`.trim();
        return chat(
            [
                { role: 'system', content: system },
                { role: 'user', content: prompt },
            ],
            { model: or().modelCs, temperature: 0.6 }
        );
    },

    /** /imageai - generate gambar via openrouter images (fallback ke model image) */
    image: async (prompt) => {
        const key = or().apiKey;
        if (!key || key.indexOf('MASUKKAN_') === 0) {
            throw new Error('API Key OpenRouter belum dikonfigurasi di config.js');
        }
        const res = await axios.post(
            `${or().baseUrl}/images/generations`,
            {
                model: or().modelImage,
                prompt,
                response_format: 'b64_json',
                n: 1,
            },
            {
                headers: {
                    Authorization: `Bearer ${key}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://zerxsbot.local',
                    'X-Title': 'ZerxsBot',
                },
                timeout: 90000,
            }
        );
        const item = res.data?.data?.[0];
        if (item?.b64_json) return Buffer.from(item.b64_json, 'base64');
        if (item?.url) {
            const img = await axios.get(item.url, { responseType: 'arraybuffer' });
            return Buffer.from(img.data);
        }
        throw new Error('Gambar tidak dapat dibuat oleh AI');
    },
};
