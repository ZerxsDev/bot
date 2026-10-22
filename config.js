/**
 * ============================================================
 *  ZerxsBot - Konfigurasi Utama
 *  Semua data sensitif (URL Apps Script, API Key) WAJIB di sini.
 *  Tidak boleh ditampilkan / dikirim ke frontend web.
 * ============================================================
 */

module.exports = {
    /* ---------------- IDENTITAS WEB & BOT ---------------- */
    web: {
        namaWeb: "ZerxsBot",
        deskripsi: "Bot WhatsApp multi-fungsi berbasis AI dengan panel kontrol web paling lengkap.",
        versi: "1.0.0",
        port: process.env.PORT || 3000,
        telegram: "https://t.me/zerxsdev",
        developer: "ZerxsDev",
    },

    /* ---------------- GOOGLE SPREADSHEET (via Apps Script Web App) ----------------
     * Deploy Apps Script (lihat file apps-script.gs) sebagai Web App:
     *   - Execute as: Me
     *   - Who has access: Anyone
     * Lalu tempel URL hasil deploy di bawah ini.
     */
    spreadsheet: {
        appsScriptUrl: "MASUKKAN_URL_APPS_SCRIPT_WEB_APP_DISINI",
        // Kunci sederhana untuk memvalidasi request ke Apps Script (opsional tapi disarankan)
        secret: "ZXRXS-SECRET-GANTI-INI",
    },

    /* ---------------- OPENROUTER (AI SYSTEM) ---------------- */
    openrouter: {
        apiKey: "MASUKKAN_API_KEY_OPENROUTER_DISINI",
        baseUrl: "https://openrouter.ai/api/v1",
        // Bot biasa: deepseek
        modelAi: "deepseek/deepseek-chat",
        // Bot CS (business/developer): gpt-4o-mini
        modelCs: "openai/gpt-4o-mini",
        // Model untuk pembuatan gambar
        modelImage: "openai/dall-e-3",
    },

    /* ---------------- BOT WHATSAPP ---------------- */
    bot: {
        namaBot: "ZerxsBot",
        prefiksDefault: "/",
        // Prefiks yang boleh dipakai sesuai role (lihat ROLE_CONFIG)
        ownerPrefiks: ["/", ".", "!"],
        devPrefiks: ["/", ".", "!", "#", "?", ">"],
        footer: "© ZerxsBot — Powered by ZerxsDev",
        // Folder penyimpanan session pairing
        sessionFolder: "./sessions",
    },

    /* ---------------- ROLE & BENEFIT ---------------- */
    ROLE_CONFIG: {
        "member": {
            label: "Member Trial",
            harga: 15000,
            masaAktifHari: 30,          // trial 1 bulan
            kuotaHarian: 8,
            maxBot: 1,
            perintah: [
                "ai", "stickertext", "brat", "bratvid", "iqc",
                "info", "menu", "tutor"
            ],
            prefiks: ["/"],
            grup: false, cs: false, devMenu: false, gantiPrefiks: false,
        },
        "admin": {
            label: "Admin Permanen",
            harga: 30000,
            masaAktifHari: null,        // permanen
            kuotaHarian: 16,
            maxBot: 3,
            perintah: [
                "ai", "stickertext", "brat", "bratvid", "iqc",
                "info", "menu", "tutor", "sticker", "quotes",
                "kurs", "meme", "translate"
            ],
            prefiks: ["/"],
            grup: false, cs: false, devMenu: false, gantiPrefiks: false,
        },
        "partner": {
            label: "Partner Permanen",
            harga: 50000,
            masaAktifHari: null,
            kuotaHarian: 35,
            maxBot: 5,
            perintah: [
                "ai", "stickertext", "brat", "bratvid", "iqc",
                "info", "menu", "tutor", "sticker", "quotes",
                "kurs", "meme", "translate", "coder", "imageai",
                "qrcode", "send", "hash", "biner"
            ],
            prefiks: ["/"],
            grup: false, cs: false, devMenu: false, gantiPrefiks: false,
        },
        "owner": {
            label: "Owner Permanen",
            harga: 80000,
            masaAktifHari: null,
            kuotaHarian: 100,
            maxBot: 10,
            perintah: "*",              // seluruh perintah personal
            prefiks: ["/", ".", "!"],
            grup: true, cs: false, devMenu: false, gantiPrefiks: true,
        },
        "developer": {
            label: "Developer Permanen",
            harga: 200000,
            masaAktifHari: null,
            kuotaHarian: Infinity,      // unlimited
            maxBot: Infinity,           // unlimited
            perintah: "*",
            prefiks: ["/", ".", "!", "#", "?", ">"],
            grup: true, cs: true, devMenu: true, gantiPrefiks: true,
            limitBuatAkunSeminggu: 50,
        },
        "business": {
            label: "Business Permanen",
            harga: 100000,
            masaAktifHari: null,
            kuotaHarian: 100,
            maxBot: 20,
            perintah: "*",              // seluruh perintah personal KECUALI grup
            prefiks: ["/"],
            grup: false, cs: true, devMenu: false, gantiPrefiks: false,
        },
        "memberpermanen": {
            label: "Member Permanen",
            harga: 25000,
            masaAktifHari: null,
            kuotaHarian: 8,
            maxBot: 1,
            perintah: [
                "ai", "stickertext", "brat", "bratvid", "iqc",
                "info", "menu", "tutor"
            ],
            prefiks: ["/"],
            grup: false, cs: false, devMenu: false, gantiPrefiks: false,
        },
    },

    /* ---------------- PERINTAH GRUP (khusus developer) ---------------- */
    PERINTAH_GRUP: [
        "tagall", "tag", "add", "antilink", "antitoxic", "infogroup",
        "pin", "kick", "welcome", "mute", "unmute", "rules",
        "filter", "listfilter", "unfilter", "showfilter"
    ],

    /* ---------------- DAFTAR SELURUH PERINTAH PERSONAL ---------------- */
    PERINTAH_PERSONAL: [
        "ai", "imageai", "coder", "sticker", "qrcode", "translate",
        "iqc", "brat", "bratvid", "info", "stickertext", "meme",
        "nosecret", "quotes", "send", "kurs", "menu", "hash", "tutor",
        "subdomain", "whois", "ipinfo", "biner", "ytdown", "ttdown", "pintdown"
    ],

    /* ---------------- HARGA UNTUK HALAMAN WEB ---------------- */
    daftarHarga: [
        { role: "member",         nama: "Member Trial",     harga: 15000,  expired: "1 Bulan" },
        { role: "memberpermanen", nama: "Member Permanen",  harga: 25000,  expired: "Selamanya" },
        { role: "admin",          nama: "Admin Permanen",   harga: 30000,  expired: "Selamanya" },
        { role: "partner",        nama: "Partner Permanen", harga: 50000,  expired: "Selamanya" },
        { role: "owner",          nama: "Owner Permanen",   harga: 80000,  expired: "Selamanya" },
        { role: "business",       nama: "Business Permanen",harga: 100000, expired: "Selamanya" },
        { role: "developer",      nama: "Developer Permanen", harga: 200000, expired: "Selamanya" },
    ],

    /* ---------------- KUOTA BUAT AKUN (DEVELOPER) ---------------- */
    devAkunLimit: 50,        // 50 akun / minggu
    devAkunPeriodeHari: 7,

    /* ---------------- LAIN-LAIN ---------------- */
    kataKasar: [
        "anjing", "babi", "monyet", "bodoh", "tolol", "goblok",
        "bangsat", "tai", "kontol", "memek", "ngentot", "setan"
    ],
}
