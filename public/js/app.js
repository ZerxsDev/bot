/* ============================================================
   ZerxsBot - Frontend SPA (vanilla JS)
   ============================================================ */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

let ME = null;          // data user session
let PUBLIC = null;      // data publik (harga, telegram, dll)
let itiLogin = null, itiAdd = null, itiPair = null;
let pairTimer = null, currentPairId = null;
let delMode = false;
let passShown = false;

const rupiah = (n) => 'Rp' + Number(n || 0).toLocaleString('id-ID');

async function api(path, opts = {}) {
    const res = await fetch(path, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 401) { location.reload(); }
    return res.json();
}

function toast(msg, ms = 2600) {
    const t = $('#toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.add('hidden'), ms);
}

function fmtDate(d) {
    try {
        return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (_) { return d; }
}
function expiredLabel(e) {
    if (!e || /permanen|selamanya|permanent/i.test(String(e))) return 'Permanen ♾️';
    return fmtDate(e);
}

/* ================= BOOT ================= */
window.addEventListener('DOMContentLoaded', async () => {
    PUBLIC = await api('/api/public-info').catch(() => null);
    if (PUBLIC) {
        $('#loginDesc').textContent = PUBLIC.deskripsi;
        buildPriceCards(PUBLIC.daftarHarga || [], PUBLIC.telegram);
        $('#infoDev').textContent = PUBLIC.developer;
        $('#infoTg').textContent = PUBLIC.telegram.replace('https://', '');
        $('#infoTg').href = PUBLIC.telegram;
        $('#infoVersi').textContent = 'v' + PUBLIC.versi;
    }

    // inisialisasi intl-tel-input default +62
    const phoneOpts = { initialCountry: 'id', separateDialCode: true, nationalMode: false, onlyCountries: ['id'] };
    if (window.intlTelInput) {
        itiLogin = intlTelInput($('#inpPhone'), phoneOpts);
        itiAdd = intlTelInput($('#abPhone'), phoneOpts);
        itiPair = intlTelInput($('#pcPhone'), phoneOpts);
    }

    startClock();
    bindEvents();

    // cek sesi login
    const me = await api('/api/me').catch(() => ({ ok: false }));
    setTimeout(() => {
        $('#bootLoader').classList.add('hidden');
        if (me.ok && me.user) { ME = me.user; enterApp(false); }
        else { $('#loginView').classList.remove('hidden'); }
    }, 1800);
});

/* ================= EVENTS ================= */
function bindEvents() {
    $('#loginForm').addEventListener('submit', doLogin);
    $('#btnBeli').addEventListener('click', () => $('#priceModal').classList.remove('hidden'));
    $('#closePrice').addEventListener('click', () => $('#priceModal').classList.add('hidden'));
    $$('[data-close]').forEach(b => b.addEventListener('click', () => $('#' + b.dataset.close).classList.add('hidden')));
    $$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.add('hidden'); }));

    $('#skipBtn').addEventListener('click', finishVideo);
    const v = $('#introVideo');
    v.addEventListener('ended', finishVideo);
    v.addEventListener('error', finishVideo);

    $$('.side-link').forEach(a => a.addEventListener('click', () => showPage(a.dataset.page)));
    $('#burger').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
    $('#btnLogout').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }); location.reload(); });

    $('#btnAddBot').addEventListener('click', () => $('#addBotModal').classList.remove('hidden'));
    $('#addBotForm').addEventListener('submit', addBot);
    $$('input[name="abJenis"]').forEach(r => r.addEventListener('change', () => {
        $('#csFields').classList.toggle('hidden', $('input[name="abJenis"]:checked').value !== 'cs');
    }));
    $('#btnDelMode').addEventListener('click', () => {
        delMode = !delMode;
        $('#botList').classList.toggle('delete-mode', delMode);
        $('#btnDelMode').innerHTML = delMode
            ? '<i class="fa-solid fa-xmark"></i> Batalkan Hapus'
            : '<i class="fa-solid fa-trash"></i> Hapus Bot';
        toast(delMode ? 'Mode hapus aktif — klik bot yang ingin dihapus.' : 'Mode hapus dinonaktifkan.');
    });

    $('#btnChangePass').addEventListener('click', () => $('#passModal').classList.remove('hidden'));
    $('#passForm').addEventListener('submit', changePassword);
    $('#togglePass').addEventListener('click', () => {
        passShown = !passShown;
        $('#profPass').textContent = passShown ? (ME.password || '(tersimpan di database)') : '••••••••';
        $('#togglePass').innerHTML = passShown ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
    });

    $$('.tab').forEach(t => t.addEventListener('click', () => {
        $$('.tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        $('#pairQr').classList.toggle('hidden', t.dataset.tab !== 'qr');
        $('#pairCode').classList.toggle('hidden', t.dataset.tab !== 'code');
    }));
    $('#btnGetCode').addEventListener('click', getPairCode);

    $('#devCreateForm').addEventListener('submit', devCreate);
}

/* ================= LOGIN ================= */
async function doLogin(e) {
    e.preventDefault();
    const errBox = $('#loginError');
    errBox.classList.add('hidden');
    let nohp = $('#inpPhone').value.replace(/[^0-9]/g, '');
    if (itiLogin) nohp = (itiLogin.getNumber() || '').replace(/[^0-9]/g, '') || nohp;
    if (!nohp) return showErr(errBox, 'Nomor HP wajib diisi dengan benar.');
    $('#btnLogin').disabled = true;
    const r = await api('/api/login', {
        method: 'POST',
        body: { username: $('#inpUser').value.trim(), nohp, password: $('#inpPass').value },
    }).catch(() => ({ ok: false, error: 'Koneksi server gagal.' }));
    $('#btnLogin').disabled = false;
    if (r.ok) {
        ME = r.user;
        enterApp(true);
    } else {
        showErr(errBox, r.error || 'Login gagal.');
    }
}
function showErr(box, msg) { box.textContent = msg; box.classList.remove('hidden'); }

/* ================= VIDEO LOADING ================= */
function enterApp(withVideo) {
    $('#loginView').classList.add('hidden');
    if (withVideo) {
        $('#videoLoader').classList.remove('hidden');
        const v = $('#introVideo');
        v.currentTime = 0;
        v.play().catch(() => finishVideo());
        // fallback jika video tidak ada sama sekali
        setTimeout(() => { if (!$('#videoLoader').classList.contains('hidden')) finishVideo(); }, 12000);
    } else {
        showApp();
    }
}
function finishVideo() {
    $('#videoLoader').classList.add('hidden');
    showApp();
}

function showApp() {
    $('#appView').classList.remove('hidden');
    applyUserData();
    refreshGlobal();
    showPage('beranda');
    setInterval(refreshGlobal, 30000);
}

function applyUserData() {
    const first = (ME.username || 'U').charAt(0).toUpperCase();
    $('#homeAvatar').textContent = first;
    $('#profAvatar').textContent = first;
    $('#homeName').textContent = ME.username;
    $('#profName').textContent = ME.username;
    $('#homePhone').textContent = '+' + String(ME.nohp || '').replace(/\D/g, '');
    $('#profExpire').textContent = expiredLabel(ME.expired);
    $('#homeExpire').textContent = expiredLabel(ME.expired);
    const roleLabel = (ME.role || 'member').toUpperCase();
    $('#homeRole').textContent = roleLabel;
    $('#profRole').textContent = roleLabel;
    $('#sideRole').innerHTML = `<i class="fa-solid fa-shield-halved"></i> Role: <b>${roleLabel}</b>`;
    $('#bmRole').textContent = roleLabel;
    $('#fiturRole').textContent = roleLabel;
    // menu developer khusus developer
    $$('.dev-only').forEach(el => el.classList.toggle('hidden', ME.role !== 'developer'));
}

/* ================= CLOCK & BANNER ================= */
function startClock() {
    const upd = () => {
        const now = new Date();
        const jam = now.toLocaleTimeString('id-ID');
        $('#topClock').textContent = jam;
        const tgl = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        $('#bannerDate').textContent = `${tgl} • ${jam} WIB`;
    };
    upd(); setInterval(upd, 1000);
}

/* ================= GLOBAL INFO ================= */
async function refreshGlobal() {
    const g = await api('/api/global-info').catch(() => null);
    if (!g || !g.ok) return;
    $('#gcUsers').textContent = g.jumlahUser;
    $('#gcSheet').textContent = g.jumlahAkunSpreadsheet;
    $('#gcBots').textContent = g.jumlahBot;
    $('#gcStatus').textContent = g.botOnline > 0 ? 'ONLINE' : (g.statusSpreadsheet === 'online' ? 'ONLINE' : 'OFFLINE');
    const dot = $('#globalStatusDot');
    dot.classList.toggle('on', g.statusSpreadsheet === 'online');
    dot.classList.toggle('off', g.statusSpreadsheet !== 'online');
    $('#badgeBeranda').textContent = g.jumlahUser;
    $('#badgeBot').textContent = g.jumlahBot;
    $('#bmSheet').textContent = g.statusSpreadsheet === 'online' ? 'ONLINE' : 'OFFLINE';
    $('#bmActive').textContent = g.botOnline;
}

/* ================= NAVIGASI ================= */
function showPage(p) {
    $$('.page').forEach(s => s.classList.add('hidden'));
    $('#page-' + p).classList.remove('hidden');
    $$('.side-link').forEach(a => a.classList.toggle('active', a.dataset.page === p));
    $('#sidebar').classList.remove('open');
    if (p === 'botmanager') loadBots();
    if (p === 'fitur') loadFitur();
    if (p === 'developer') loadDev();
}

/* ================= BOT MANAGER ================= */
async function loadBots() {
    const r = await api('/api/bots');
    const list = $('#botList');
    list.innerHTML = '';
    if (!r.ok && r.error) { list.innerHTML = `<div class="msg err">${r.error}</div>`; return; }
    const bots = r.bots || [];
    if (!bots.length) {
        list.innerHTML = '<div class="center-note"><i class="fa-solid fa-inbox" style="font-size:30px"></i>Belum ada bot. Klik "Tambahkan Nomor Bot".</div>';
    }
    for (const b of bots) {
        const st = b.statusLive || b.status || 'offline';
        const card = document.createElement('div');
        card.className = 'bot-card';
        card.innerHTML = `
            <h4><i class="fa-solid fa-robot"></i> ${b.namaBot || 'Bot'}</h4>
            <div class="bot-line"><span class="dot ${st === 'online' ? 'online' : (st === 'pairing' || st === 'qr' ? 'pairing' : 'offline')}"></span> Status: <b>${st.toUpperCase()}</b></div>
            <div class="bot-line">📱 No Bot: <b>+${String(b.noBot).replace(/\D/g,'')}</b></div>
            <div class="bot-line">🏷️ Jenis: <b>${(b.jenis || 'biasa').toUpperCase()}</b></div>
            <div class="bot-line">🆔 ID: <b>${b.id}</b></div>
            <div class="bot-actions">
                <button class="mini-btn pair"><i class="fa-solid fa-mobile-screen"></i> Pairing</button>
                <button class="mini-btn del"><i class="fa-solid fa-trash"></i> Hapus</button>
            </div>`;
        card.querySelector('.pair').addEventListener('click', () => openPair(b.id));
        card.querySelector('.del').addEventListener('click', () => deleteBot(b.id, b.namaBot));
        if (delMode) card.addEventListener('click', () => deleteBot(b.id, b.namaBot));
        list.appendChild(card);
    }
}

async function addBot(e) {
    e.preventDefault();
    let noBot = '';
    if (itiAdd) noBot = itiAdd.getNumber();
    noBot = (noBot || $('#abPhone').value).replace(/[^0-9]/g, '');
    const jenis = $('input[name="abJenis"]:checked').value;
    const body = {
        noBot,
        namaBot: $('#abNama').value.trim(),
        jenis,
        tentang: $('#abTentang')?.value.trim(),
        produk: $('#abProduk')?.value.trim(),
        harga: $('#abHargaJs')?.value.trim(),
        promptCs: $('#abPromptCs')?.value.trim(),
    };
    const msg = $('#addBotMsg');
    const r = await api('/api/bots/add', { method: 'POST', body });
    msg.classList.remove('hidden');
    if (r.ok) {
        msg.className = 'msg ok'; msg.textContent = r.message || 'Bot ditambahkan!';
        setTimeout(() => {
            $('#addBotModal').classList.add('hidden');
            msg.classList.add('hidden');
            loadBots();
            openPair(r.id);
        }, 900);
    } else {
        msg.className = 'msg err'; msg.textContent = r.error || 'Gagal menambah bot.';
    }
}

async function deleteBot(id, nama) {
    if (!confirm(`Hapus bot "${nama || id}"? Session pairing ikut terhapus.`)) return;
    const r = await api('/api/bots/delete', { method: 'POST', body: { id } });
    toast(r.ok ? 'Bot dihapus.' : (r.error || 'Gagal menghapus.'));
    loadBots();
}

/* ================= PAIRING ================= */
function openPair(id) {
    currentPairId = id;
    $('#pairModal').classList.remove('hidden');
    $('#qrImg').classList.add('hidden');
    $('#qrWait').classList.remove('hidden');
    $('#codeResult').classList.add('hidden');
    $('#pairStatus').textContent = 'Menyiapkan sesi pairing…';
    clearInterval(pairTimer);
    pollQr();
    pairTimer = setInterval(pollQr, 3000);
}
$('#pairModal') && $('#pairModal').addEventListener('transitionend', () => {});
// berhenti polling saat modal pairing ditutup
new MutationObserver(() => {
    if ($('#pairModal').classList.contains('hidden')) clearInterval(pairTimer);
}).observe($('#pairModal'), { attributes: true, attributeFilter: ['class'] });

async function pollQr() {
    if (!currentPairId) return;
    const r = await api(`/api/pairing/${currentPairId}/qr`);
    if (!r.ok) { $('#pairStatus').textContent = r.error || 'Gagal memuat QR.'; return; }
    if (r.status === 'online') {
        $('#pairStatus').innerHTML = '<span style="color:#22c55e"><i class="fa-solid fa-circle-check"></i> Bot ONLINE — pairing berhasil!</span>';
        $('#qrWait').classList.add('hidden');
        clearInterval(pairTimer);
        loadBots(); refreshGlobal();
        return;
    }
    if (r.qr) {
        $('#qrImg').src = r.qr;
        $('#qrImg').classList.remove('hidden');
        $('#qrWait').classList.add('hidden');
        $('#pairStatus').textContent = 'Pindai QR sebelum kedaluwarsa (auto-refresh).';
    } else {
        $('#pairStatus').textContent = 'Sesi menghubungkan… tunggu sebentar.';
    }
}

async function getPairCode() {
    let phone = itiPair ? itiPair.getNumber() : $('#pcPhone').value;
    phone = (phone || '').replace(/[^0-9]/g, '');
    if (!/^62\d{8,13}$/.test(phone)) {
        toast('Nomor harus format Indonesia: 628xxxxxxxxx');
        return;
    }
    $('#btnGetCode').disabled = true;
    $('#pairStatus').textContent = 'Meminta pairing code…';
    const r = await api(`/api/pairing/${currentPairId}/code`, { method: 'POST', body: { phone } });
    $('#btnGetCode').disabled = false;
    if (r.ok && r.code) {
        const box = $('#codeResult');
        box.textContent = r.code;
        box.classList.remove('hidden');
        $('#pairStatus').innerHTML = `Gunakan kode di atas untuk nomor <b>+${phone}</b>. Kode berlaku ±1 menit.`;
    } else {
        $('#pairStatus').innerHTML = `<span style="color:#ef4444">${r.error || 'Gagal mendapat pairing code.'}</span>`;
    }
}

/* ================= FITUR ================= */
async function loadFitur() {
    const r = await api('/api/features');
    const wrap = $('#fiturList');
    wrap.innerHTML = '';
    for (const f of r.features) {
        const d = document.createElement('div');
        d.className = 'fitur-item' + (f.allowed ? '' : ' locked');
        d.innerHTML = `
            ${f.allowed ? '' : '<i class="fa-solid fa-lock lock"></i>'}
            <code>/${f.cmd}</code> ${f.grup ? '<small>Grup</small>' : ''}
            <small>${f.desc}</small>`;
        wrap.appendChild(d);
    }
}

/* ================= PROFIL ================= */
async function changePassword(e) {
    e.preventDefault();
    const msg = $('#passMsg');
    msg.classList.remove('hidden'); msg.className = 'msg';
    const r = await api('/api/change-password', {
        method: 'POST',
        body: { lama: $('#pwOld').value, baru: $('#pwNew').value },
    });
    if (r.ok) {
        msg.className = 'msg ok'; msg.textContent = 'Password berhasil diubah di spreadsheet.';
        $('#passForm').reset();
        setTimeout(() => $('#passModal').classList.add('hidden'), 1200);
    } else {
        msg.className = 'msg err'; msg.textContent = r.error || 'Gagal mengubah password.';
    }
}

/* ================= DEVELOPER ================= */
async function loadDev() {
    if (ME.role !== 'developer') return;
    const r = await api('/api/dev/stats');
    if (!r.ok) return;
    $('#dvUsers').textContent = r.totalUser;
    $('#dvLimit').textContent = `${r.devLimit.used}/${r.devLimit.max}`;
    const chips = $('#dvRoles'); chips.innerHTML = '';
    for (const meta of r.rolesMeta) {
        const c = document.createElement('div');
        c.className = 'chip';
        c.innerHTML = `${meta.label}: <b>${r.perRole[meta.role] || 0}</b> akun<br><small style="color:var(--muted)">Kuota ${meta.kuota} • Bot ${meta.maxBot}</small>`;
        chips.appendChild(c);
    }
    const ul = $('#dvUserList'); ul.innerHTML = '';
    for (const u of r.users) {
        const row = document.createElement('div');
        row.className = 'urow';
        row.innerHTML = `<i class="fa-solid fa-user"></i> <b>${u.username}</b>
            <span class="pill">${String(u.role).toUpperCase()}</span>
            <small style="color:var(--muted)">${u.nohp || '-'}</small>`;
        const btn = document.createElement('button');
        btn.className = 'mini-btn del'; btn.style.width = 'auto'; btn.style.marginLeft = 'auto';
        btn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        btn.addEventListener('click', async () => {
            if (!confirm(`Hapus akun ${u.username}?`)) return;
            const rr = await api('/api/dev/delete-account', { method: 'POST', body: { username: u.username } });
            toast(rr.ok ? 'Akun dihapus.' : (rr.error || 'Gagal.'));
            loadDev();
        });
        row.appendChild(btn);
        ul.appendChild(row);
    }
}

async function devCreate(e) {
    e.preventDefault();
    const msg = $('#devMsg'); msg.classList.remove('hidden'); msg.className = 'msg';
    const r = await api('/api/dev/create-account', {
        method: 'POST',
        body: { username: $('#dcUser').value.trim(), password: $('#dcPass').value, role: $('#dcRole').value },
    });
    if (r.ok) {
        msg.className = 'msg ok'; msg.textContent = r.message;
        $('#devCreateForm').reset();
    } else {
        msg.className = 'msg err'; msg.textContent = r.error || 'Gagal membuat akun.';
    }
    loadDev();
}

/* ================= MODAL HARGA ================= */
function buildPriceCards(list, telegram) {
    const wrap = $('#priceList');
    wrap.innerHTML = '';
    for (const h of list) {
        const c = document.createElement('div');
        c.className = 'price-card';
        c.innerHTML = `
            <h4>${h.nama}</h4>
            <div class="harga">${rupiah(h.harga)}</div>
            <small style="color:var(--muted)">Masa aktif: ${h.expired}</small>
            <ul>${(h.benefit || []).map(b => `<li>${b}</li>`).join('')}</ul>
            <button class="btn-primary beli" style="margin-top:6px"><i class="fa-brands fa-telegram"></i> Beli Akses</button>`;
        c.querySelector('.beli').addEventListener('click', () => window.open(telegram || 'https://t.me/zerxsdev', '_blank'));
        wrap.appendChild(c);
    }
}
