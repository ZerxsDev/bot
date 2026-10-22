/**
 * ============================================================
 *  ZerxsBot - Google Apps Script Web App (DATABASE)
 *  Cara pakai:
 *   1. Buat Google Spreadsheet baru.
 *   2. Buka Extensions > Apps Script, tempel seluruh kode ini.
 *   3. Deploy > New deployment > Web app.
 *      - Execute as: Me
 *      - Who has access: Anyone
 *   4. Salin URL Web App ke config.js -> spreadsheet.appsScriptUrl
 *
 *  SHEET "USERS"    header: username|password|nohp|role|expired|dibuat
 *  SHEET "BOTS"     header: id|pemilik|noBot|namaBot|jenis|status|dibuat
 *  SHEET "QUOTA"    header: key|tanggal|jumlah        (kuota chat harian)
 *  SHEET "DEVLIMIT" header: email|periode|jumlah      (limit buat akun dev)
 *  SHEET "SETTINGS" header: key|value                 (prefiks user dll)
 * ============================================================
 */

var SECRET = 'ZXRXS-SECRET-GANTI-INI'; // samakan dengan config.js secret

var SHEETS = {
  USERS: 'USERS',
  BOTS: 'BOTS',
  QUOTA: 'QUOTA',
  DEVLIMIT: 'DEVLIMIT',
  SETTINGS: 'SETTINGS'
};

function getSS_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(name) {
  var ss = getSS_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }
  return sh;
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ====================== ROUTER ====================== */
function doPost(e) {
  return handle_(e);
}
function doGet(e) {
  return handle_(e);
}

function handle_(e) {
  var data = {};
  try {
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter && e.parameter.payload) {
      data = JSON.parse(decodeURIComponent(e.parameter.payload));
    } else if (e.parameter) {
      data = e.parameter;
    }
  } catch (err) {
    return jsonOut_({ ok: false, error: 'Payload tidak valid: ' + err });
  }

  if (data.secret !== SECRET) {
    return jsonOut_({ ok: false, error: 'Unauthorized' });
  }

  var action = data.action || '';
  try {
    switch (action) {
      case 'ping':            return jsonOut_({ ok: true, ts: Date.now() });
      case 'login':           return jsonOut_(login_(data));
      case 'getUsers':        return jsonOut_(getUsers_());
      case 'getUser':         return jsonOut_(getUser_(data));
      case 'addUser':         return jsonOut_(addUser_(data));
      case 'deleteUser':      return jsonOut_(deleteUser_(data));
      case 'changePassword':  return jsonOut_(changePassword_(data));
      case 'checkExpired':    return jsonOut_(checkExpired_());

      case 'getBots':         return jsonOut_(getBots_(data));
      case 'getAllBots':      return jsonOut_(getAllBots_());
      case 'addBot':          return jsonOut_(addBot_(data));
      case 'deleteBot':       return jsonOut_(deleteBot_(data));
      case 'updateBotStatus': return jsonOut_(updateBotStatus_(data));

      case 'incrQuota':       return jsonOut_(incrQuota_(data));
      case 'getQuota':        return jsonOut_(getQuota_(data));

      case 'getDevLimit':     return jsonOut_(getDevLimit_(data));
      case 'incrDevLimit':    return jsonOut_(incrDevLimit_(data));

      case 'getSetting':      return jsonOut_(getSetting_(data));
      case 'setSetting':      return jsonOut_(setSetting_(data));

      default: return jsonOut_({ ok: false, error: 'Action tidak dikenal: ' + action });
    }
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

/* ====================== UTIL SHEET ====================== */
function rows_(name) {
  var sh = sheet_(name);
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
}

function headers_(name) {
  var sh = sheet_(name);
  if (sh.getLastRow() === 0) {
    // belum ada header, inisialisasi
    var h = HEADER_MAP[name];
    if (h) sh.getRange(1, 1, 1, h.length).setValues([h]);
    return h || [];
  }
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
}

var HEADER_MAP = {};
HEADER_MAP[SHEETS.USERS] = ['username', 'password', 'nohp', 'role', 'expired', 'dibuat'];
HEADER_MAP[SHEETS.BOTS] = ['id', 'pemilik', 'noBot', 'namaBot', 'jenis', 'status', 'dibuat'];
HEADER_MAP[SHEETS.QUOTA] = ['key', 'tanggal', 'jumlah'];
HEADER_MAP[SHEETS.DEVLIMIT] = ['email', 'periode', 'jumlah'];
HEADER_MAP[SHEETS.SETTINGS] = ['key', 'value'];

function ensureHeader_(name) {
  var sh = sheet_(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, HEADER_MAP[name].length).setValues([HEADER_MAP[name]]);
  }
}

function toObj_(headers, row) {
  var o = {};
  for (var i = 0; i < headers.length; i++) o[headers[i]] = row[i];
  return o;
}

/* ====================== AUTH / USERS ====================== */
function login_(data) {
  ensureHeader_(SHEETS.USERS);
  var uname = String(data.username || '').trim().toLowerCase();
  var pass = String(data.password || '');
  var nohp = String(data.nohp || '').replace(/[^0-9]/g, '');

  var hs = headers_(SHEETS.USERS);
  var rows = rows_(SHEETS.USERS);
  for (var i = 0; i < rows.length; i++) {
    var u = toObj_(hs, rows[i]);
    if (String(u.username).trim().toLowerCase() === uname) {
      var uNo = String(u.nohp).replace(/[^0-9]/g, '');
      if (String(u.password) === pass && uNo === nohp) {
        // cek expired
        if (isExpired_(u.expired)) {
          deleteUserByRow_(i + 2); // auto hapus akun expired saat login
          return { ok: false, error: 'Akun sudah EXPIRED dan otomatis dihapus dari database.' };
        }
        return {
          ok: true,
          user: {
            username: u.username, password: u.password, nohp: u.nohp,
            role: String(u.role).toLowerCase(), expired: u.expired, dibuat: u.dibuat
          }
        };
      }
      return { ok: false, error: 'Username atau password/nohp salah.' };
    }
  }
  return { ok: false, error: 'Akun tidak ditemukan di database. Hubungi admin untuk mendaftar.' };
}

function isExpired_(expired) {
  if (!expired) return false;
  var s = String(expired).toLowerCase();
  if (s === '' || s === 'permanen' || s === 'permanent' || s === 'selamanya' || s === '-') return false;
  var d = new Date(expired);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

function getUsers_() {
  ensureHeader_(SHEETS.USERS);
  var hs = headers_(SHEETS.USERS);
  var rows = rows_(SHEETS.USERS);
  var out = [];
  for (var i = 0; i < rows.length; i++) out.push(toObj_(hs, rows[i]));
  return { ok: true, users: out };
}

function getUser_(data) {
  ensureHeader_(SHEETS.USERS);
  var uname = String(data.username || '').trim().toLowerCase();
  var hs = headers_(SHEETS.USERS);
  var rows = rows_(SHEETS.USERS);
  for (var i = 0; i < rows.length; i++) {
    var u = toObj_(hs, rows[i]);
    if (String(u.username).trim().toLowerCase() === uname) {
      return { ok: true, user: u };
    }
  }
  return { ok: false, error: 'User tidak ditemukan' };
}

function addUser_(data) {
  ensureHeader_(SHEETS.USERS);
  var uname = String(data.username || '').trim();
  var pass = String(data.password || '');
  var role = String(data.role || '').trim().toLowerCase();
  var expired = data.expired || 'permanen';
  var nohp = data.nohp || '-';
  if (!uname || !pass || !role) return { ok: false, error: 'username/password/role wajib diisi' };

  var hs = headers_(SHEETS.USERS);
  var rows = rows_(SHEETS.USERS);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === uname.toLowerCase()) {
      return { ok: false, error: 'Username sudah terdaftar' };
    }
  }
  var sh = sheet_(SHEETS.USERS);
  sh.appendRow([uname, pass, nohp, role, expired, new Date().toISOString()]);
  return { ok: true, message: 'Akun berhasil dibuat' };
}

function deleteUser_(data) {
  ensureHeader_(SHEETS.USERS);
  var uname = String(data.username || '').trim().toLowerCase();
  var rows = rows_(SHEETS.USERS);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === uname) {
      sheet_(SHEETS.USERS).deleteRow(i + 2);
      return { ok: true, message: 'Akun dihapus' };
    }
  }
  return { ok: false, error: 'User tidak ditemukan' };
}

function deleteUserByRow_(rowIndex) {
  sheet_(SHEETS.USERS).deleteRow(rowIndex);
}

function changePassword_(data) {
  ensureHeader_(SHEETS.USERS);
  var uname = String(data.username || '').trim().toLowerCase();
  var lama = String(data.lama || '');
  var baru = String(data.baru || '');
  if (!baru || baru.length < 4) return { ok: false, error: 'Password baru minimal 4 karakter' };
  var hs = headers_(SHEETS.USERS);
  var rows = rows_(SHEETS.USERS);
  for (var i = 0; i < rows.length; i++) {
    var u = toObj_(hs, rows[i]);
    if (String(u.username).trim().toLowerCase() === uname) {
      if (String(u.password) !== lama) return { ok: false, error: 'Password lama tidak sesuai' };
      sheet_(SHEETS.USERS).getRange(i + 2, 2).setValue(baru);
      return { ok: true, message: 'Password berhasil diubah' };
    }
  }
  return { ok: false, error: 'User tidak ditemukan' };
}

/** Panggil berkala: hapus semua akun yang expired. */
function checkExpired_() {
  ensureHeader_(SHEETS.USERS);
  var hs = headers_(SHEETS.USERS);
  var sh = sheet_(SHEETS.USERS);
  var rows = rows_(SHEETS.USERS);
  var deleted = [];
  // iterasi dari bawah agar index delete aman
  for (var i = rows.length - 1; i >= 0; i--) {
    var u = toObj_(hs, rows[i]);
    if (isExpired_(u.expired)) {
      sh.deleteRow(i + 2);
      deleted.push(u.username);
    }
  }
  return { ok: true, deleted: deleted };
}

/* ====================== BOTS ====================== */
function getBots_(data) {
  ensureHeader_(SHEETS.BOTS);
  var pemilik = String(data.pemilik || '').trim().toLowerCase();
  var hs = headers_(SHEETS.BOTS);
  var rows = rows_(SHEETS.BOTS);
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var b = toObj_(hs, rows[i]);
    if (String(b.pemilik).trim().toLowerCase() === pemilik) out.push(b);
  }
  return { ok: true, bots: out };
}

function getAllBots_() {
  ensureHeader_(SHEETS.BOTS);
  var hs = headers_(SHEETS.BOTS);
  var rows = rows_(SHEETS.BOTS);
  var out = [];
  for (var i = 0; i < rows.length; i++) out.push(toObj_(hs, rows[i]));
  return { ok: true, bots: out };
}

function addBot_(data) {
  ensureHeader_(SHEETS.BOTS);
  var id = 'BOT-' + UtilitiesUuid_();
  var sh = sheet_(SHEETS.BOTS);
  sh.appendRow([
    id,
    data.pemilik || '-',
    String(data.noBot || '').replace(/[^0-9]/g, ''),
    data.namaBot || ('Bot ' + id.slice(-4)),
    data.jenis || 'biasa',   // biasa | cs
    'offline',
    new Date().toISOString()
  ]);
  return { ok: true, id: id, bot: {
    id: id, pemilik: data.pemilik, noBot: data.noBot, namaBot: data.namaBot,
    jenis: data.jenis || 'biasa', status: 'offline', promptCs: data.promptCs || ''
  }};
}

function deleteBot_(data) {
  ensureHeader_(SHEETS.BOTS);
  var id = String(data.id || '');
  var rows = rows_(SHEETS.BOTS);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === id) {
      sheet_(SHEETS.BOTS).deleteRow(i + 2);
      return { ok: true, message: 'Bot dihapus' };
    }
  }
  return { ok: false, error: 'Bot tidak ditemukan' };
}

function updateBotStatus_(data) {
  ensureHeader_(SHEETS.BOTS);
  var id = String(data.id || '');
  var rows = rows_(SHEETS.BOTS);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === id) {
      sheet_(SHEETS.BOTS).getRange(i + 2, 6).setValue(data.status || 'online');
      return { ok: true };
    }
  }
  // jika belum ada barisnya, tambahkan
  return { ok: false, error: 'Bot tidak ditemukan' };
}

function UtilitiesUuid_() {
  return Utilities.getUuid ? Utilities.getUuid() : (Date.now() + '-' + Math.floor(Math.random() * 1e9));
}

/* ====================== KUOTA HARIAN ====================== */
function todayKey_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd');
}

function incrQuota_(data) {
  ensureHeader_(SHEETS.QUOTA);
  var key = String(data.key || '');
  var tgl = todayKey_();
  var hs = headers_(SHEETS.QUOTA);
  var sh = sheet_(SHEETS.QUOTA);
  var rows = rows_(SHEETS.QUOTA);
  for (var i = 0; i < rows.length; i++) {
    var q = toObj_(hs, rows[i]);
    if (String(q.key) === key) {
      var jumlah = Number(q.jumlah || 0);
      // reset jika tanggal berbeda (reset jam 00.00)
      if (String(q.tanggal) !== tgl) jumlah = 0;
      jumlah += 1;
      sh.getRange(i + 2, 2).setValue(tgl);
      sh.getRange(i + 2, 3).setValue(jumlah);
      return { ok: true, jumlah: jumlah };
    }
  }
  sh.appendRow([key, tgl, 1]);
  return { ok: true, jumlah: 1 };
}

function getQuota_(data) {
  ensureHeader_(SHEETS.QUOTA);
  var key = String(data.key || '');
  var tgl = todayKey_();
  var hs = headers_(SHEETS.QUOTA);
  var rows = rows_(SHEETS.QUOTA);
  for (var i = 0; i < rows.length; i++) {
    var q = toObj_(hs, rows[i]);
    if (String(q.key) === key && String(q.tanggal) === tgl) {
      return { ok: true, jumlah: Number(q.jumlah || 0) };
    }
  }
  return { ok: true, jumlah: 0 };
}

/* ====================== LIMIT DEV BUAT AKUN ====================== */
function weekKey_() {
  var d = new Date();
  var onejan = new Date(d.getFullYear(), 0, 1);
  var week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return d.getFullYear() + '-W' + week;
}

function getDevLimit_(data) {
  ensureHeader_(SHEETS.DEVLIMIT);
  var email = String(data.email || '');
  var periode = weekKey_();
  var hs = headers_(SHEETS.DEVLIMIT);
  var rows = rows_(SHEETS.DEVLIMIT);
  for (var i = 0; i < rows.length; i++) {
    var q = toObj_(hs, rows[i]);
    if (String(q.email) === email && String(q.periode) === periode) {
      return { ok: true, jumlah: Number(q.jumlah || 0), periode: periode };
    }
  }
  return { ok: true, jumlah: 0, periode: periode };
}

function incrDevLimit_(data) {
  ensureHeader_(SHEETS.DEVLIMIT);
  var email = String(data.email || '');
  var periode = weekKey_();
  var hs = headers_(SHEETS.DEVLIMIT);
  var sh = sheet_(SHEETS.DEVLIMIT);
  var rows = rows_(SHEETS.DEVLIMIT);
  for (var i = 0; i < rows.length; i++) {
    var q = toObj_(hs, rows[i]);
    if (String(q.email) === email && String(q.periode) === periode) {
      var jumlah = Number(q.jumlah || 0) + 1;
      sh.getRange(i + 2, 3).setValue(jumlah);
      return { ok: true, jumlah: jumlah };
    }
  }
  sh.appendRow([email, periode, 1]);
  return { ok: true, jumlah: 1 };
}

/* ====================== SETTINGS (prefiks dll) ====================== */
function getSetting_(data) {
  ensureHeader_(SHEETS.SETTINGS);
  var key = String(data.key || '');
  var hs = headers_(SHEETS.SETTINGS);
  var rows = rows_(SHEETS.SETTINGS);
  for (var i = 0; i < rows.length; i++) {
    var q = toObj_(hs, rows[i]);
    if (String(q.key) === key) return { ok: true, value: q.value };
  }
  return { ok: true, value: null };
}

function setSetting_(data) {
  ensureHeader_(SHEETS.SETTINGS);
  var key = String(data.key || '');
  var hs = headers_(SHEETS.DEVLIMIT); // placeholder
  var sh = sheet_(SHEETS.SETTINGS);
  var rows = rows_(SHEETS.SETTINGS);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === key) {
      sh.getRange(i + 2, 2).setValue(data.value);
      return { ok: true };
    }
  }
  sh.appendRow([key, data.value]);
  return { ok: true };
}

/* ====================== TRIGGER OTOMATIS (opsional) ======================
 * Jalankan sekali secara manual menu Extensions > Run > setupTrigger_
 * untuk membuat cron tiap jam mengecek akun expired & menghapusnya otomatis.
 */
function setupTrigger_() {
  ScriptApp.newTrigger('checkExpiredCron_')
    .timeBased()
    .everyHours(1)
    .create();
}

function checkExpiredCron_() {
  checkExpired_();
}
