/**
 * ZerxsBot - Klien Google Spreadsheet via Apps Script Web App.
 * URL Apps Script & secret HANYA dibaca dari config.js (tidak pernah dikirim ke web).
 */
const axios = require('axios');
const config = require('../../config');

const BASE = () => config.spreadsheet.appsScriptUrl;

async function call(action, payload = {}) {
    const url = BASE();
    if (!url || url.indexOf('MASUKKAN_') === 0) {
        throw new Error('URL Apps Script belum dikonfigurasi di config.js');
    }
    const body = { secret: config.spreadsheet.secret, action, ...payload };
    try {
        // Gunakan POST dengan text/plain agar tidak memicu CORS preflight pada Apps Script.
        const res = await axios.post(url, JSON.stringify(body), {
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            timeout: 25000,
            maxRedirects: 5,
            responseType: 'json',
        });
        const data = res.data;
        if (data && typeof data === 'string') {
            try { return JSON.parse(data); } catch (_) { return { ok: false, error: 'Respons tidak valid' }; }
        }
        return data || { ok: false, error: 'Respons kosong' };
    } catch (err) {
        return { ok: false, error: 'Koneksi spreadsheet gagal: ' + (err.message || err) };
    }
}

module.exports = {
    ping: () => call('ping'),
    login: (username, password, nohp) => call('login', { username, password, nohp }),
    getUsers: () => call('getUsers'),
    getUser: (username) => call('getUser', { username }),
    addUser: (username, password, role, expired, nohp) => call('addUser', { username, password, role, expired, nohp }),
    deleteUser: (username) => call('deleteUser', { username }),
    changePassword: (username, lama, baru) => call('changePassword', { username, lama, baru }),
    checkExpired: () => call('checkExpired'),

    getBots: (pemilik) => call('getBots', { pemilik }),
    getAllBots: () => call('getAllBots'),
    addBot: (data) => call('addBot', data),
    deleteBot: (id) => call('deleteBot', { id }),
    updateBotStatus: (id, status) => call('updateBotStatus', { id, status }),

    incrQuota: (key) => call('incrQuota', { key }),
    getQuota: (key) => call('getQuota', { key }),

    getDevLimit: (email) => call('getDevLimit', { email }),
    incrDevLimit: (email) => call('incrDevLimit', { email }),

    getSetting: (key) => call('getSetting', { key }),
    setSetting: (key, value) => call('setSetting', { key, value }),
};
