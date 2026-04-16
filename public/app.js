// ==========================================
// 1. FIREBASE CONFIGURATION & INIT
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDHtgikUcph-eQh7qZEJELFogpPjIgtB0M",
  authDomain: "animeku-c39ab.firebaseapp.com",
  databaseURL: "https://animeku-c39ab-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "animeku-c39ab",
  storageBucket: "animeku-c39ab.firebasestorage.app",
  messagingSenderId: "583107813249",
  appId: "1:583107813249:web:4a2ebe047393f4f744d280",
  measurementId: "G-3E8VRPRM0F"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
let currentUser = null;

// ==========================================
// 2. AUTHENTICATION & USER UI LOGIC
// ==========================================
auth.onAuthStateChanged(user => {
    currentUser = user;
    updateDevUI();
});

window.loginDenganGoogle = function() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    auth.signInWithPopup(provider).then(res => {
        const u = res.user;
        db.ref('users/' + u.uid).once('value').then(snap => {
            if(!snap.exists()){
                db.ref('users/' + u.uid).set({
                    nama: u.displayName, email: u.email, foto: u.photoURL,
                    role: 'Member', level: 1, exp: 0
                });
            }
        });
        alert("Login Berhasil! Selamat datang, " + u.displayName);
        updateDevUI(); 
    }).catch(err => {
        alert("Gagal login: " + err.message);
    });
};

window.logoutAkun = function() {
    auth.signOut().then(() => {
        alert("Berhasil keluar dari akun.");
        location.reload();
    });
};

function updateDevUI() {
    const container = document.getElementById('auth-check-container');
    if(!container) return;

    if(!currentUser) {
        container.innerHTML = `
            <div style="text-align:center; padding: 40px 20px;">
                <img src="https://placehold.co/100x100/1a1a1a/3b82f6?text=Akun" style="border-radius:50%; margin-bottom:15px; border:3px solid #333;">
                <h2 style="font-weight:900; color:#fff;">Akses Akun Animeku</h2>
                <p style="color:#888; margin-bottom:25px; font-size:14px; line-height:1.5;">Login untuk membuka fitur Level, ikut berdiskusi di kolom Komentar, dan menyimpan progress kamu.</p>
                <button class="login-btn-google" style="display: flex; align-items: center; gap: 10px; background: #fff; color: #000; padding: 12px 20px; border-radius: 12px; font-weight: 800; border: none; width: 100%; justify-content: center; cursor: pointer; margin-top: 15px;" onclick="loginDenganGoogle()">
                    Lanjutkan dengan Google
                </button>
            </div>`;
    } else {
        db.ref('users/' + currentUser.uid).on('value', async snap => {
            const data = snap.val();
            if(!data) return;
            const historyData = await getHistory();
            const totalMenit = historyData.length * 24;
            const shortUid = "#" + currentUser.uid.substring(0, 6).toUpperCase();
            const displayName = data.role === 'Member' ? 'Wibu Biasa' : data.role;

            let historyHtml = historyData.length > 0 ? historyData.map(item => {
                let timeDiff = Date.now() - item.timestamp;
                let daysAgo = Math.max(1, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
                return `
                <div class="profile-list-item" onclick="loadDetail('${item.url}')">
                    <img src="${item.image}" class="pli-img">
                    <div class="pli-info">
                        <div class="pli-title">${item.title}</div>
                        <div class="pli-ep">${item.episode} • ${daysAgo} hari lalu</div>
                        <div class="pli-progress-bg"><div class="pli-progress-fill" style="width: 70%;"></div></div>
                    </div>
                </div>`;
            }).join('') : '<p style="text-align:center; color:#555; margin-top:30px;">Belum ada riwayat.</p>';

            container.innerHTML = `
                <div class="profile-header">
                    <img src="${data.foto}" class="profile-avatar">
                    <div class="profile-name">${data.nama}</div>
                    <div class="profile-badges">
                        <span class="p-badge badge-role">${displayName}</span>
                        <span class="p-badge badge-lvl">Lvl. ${data.level}</span>
                        <span class="p-badge badge-uid">${shortUid}</span>
                    </div>
                </div>
                <div class="profile-stats">
                    <div class="stat-box"><div class="stat-val">${totalMenit}</div><div class="stat-lbl">menit</div></div>
                    <div class="stat-box"><div class="stat-val">${data.exp}</div><div class="stat-lbl">exp</div></div>
                </div>
                <div class="profile-tabs"><div class="ptab active">History</div></div>
                <div class="ptab-content">${historyHtml}</div>
                <button onclick="logoutAkun()" style="margin:20px; width:calc(100% - 40px); background:transparent; border:1px solid #333; color:#ef4444; padding:12px; border-radius:12px; font-weight:800; cursor:pointer;">Keluar Akun</button>`;
        });
    }
}

// ==========================================
// 3. CORE APP & HELPERS
// ==========================================
const API_BASE = '/api'; 
const DB_NAME = 'AnimekuDB';
const STORE_HISTORY = 'history';
const STORE_FAV = 'favorites';

function getHighRes(url) {
    if(!url) return '';
    return url.replace(/\/s\d+(-[a-zA-Z0-9]+)?\//g, '/s0/').replace(/=s\d+/g, '=s0');
}

function getEpBadge(anime) {
    let text = String(anime.episode || anime.episodes || anime.status || '');
    if (!text || text === 'undefined') return 'Anime';
    let epMatch = text.match(/(?:episode|eps|ep)\s*(\d+(\.\d+)?)/i);
    return epMatch ? `Eps ${epMatch[1]}` : text;
}

function formatTimelineDate(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Hari ini";
    if (date.toDateString() === yesterday.toDateString()) return "Kemarin";
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function timeAgo(ms) {
    const seconds = Math.floor((new Date() - ms) / 1000);
    if (seconds < 60) return "Baru saja";
    const i = Math.floor(seconds / 3600);
    if (i >= 1 && i < 24) return i + " jam lalu";
    if (i >= 24) return Math.floor(i/24) + " hari lalu";
    return Math.floor(seconds / 60) + " menit lalu";
}

function addXP(amount) {
    if(!currentUser) return; 
    const userRef = db.ref('users/' + currentUser.uid);
    userRef.once('value').then(snap => {
        let d = snap.val(); if(!d) return;
        let nExp = (d.exp || 0) + amount;
        userRef.update({ exp: nExp, level: Math.floor(nExp/200) + 1 });
        document.getElementById('xp-toast-text').innerText = `+${amount} XP`;
        document.getElementById('xp-toast').style.display = 'flex';
        setTimeout(() => document.getElementById('xp-toast').style.display = 'none', 3000);
    });
}

// ==========================================
// 4. DATABASE LOGIC (INDEXED DB)
// ==========================================
function initDB() {
    return new Promise((res, rej) => {
        const req = indexedDB.open(DB_NAME, 2); 
        req.onupgradeneeded = (e) => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains(STORE_HISTORY)) d.createObjectStore(STORE_HISTORY, { keyPath: 'url' });
            if (!d.objectStoreNames.contains(STORE_FAV)) d.createObjectStore(STORE_FAV, { keyPath: 'url' });
        };
        req.onsuccess = () => res(req.result);
    });
}

async function saveHistory(anime) {
    const d = await initDB(); 
    anime.timestamp = Date.now(); 
    d.transaction(STORE_HISTORY, 'readwrite').objectStore(STORE_HISTORY).put(anime);
}

async function getHistory() {
    const d = await initDB();
    return new Promise(res => {
        const req = d.transaction(STORE_HISTORY, 'readonly').objectStore(STORE_HISTORY).getAll();
        req.onsuccess = () => res(req.result.sort((a,b) => b.timestamp - a.timestamp));
    });
}

// ==========================================
// 5. UI NAVIGATION
// ==========================================
function switchTab(tab) {
    const views = ['home-view', 'recent-view', 'favorite-view', 'developer-view', 'detail-view', 'watch-view', 'search-view'];
    views.forEach(v => document.getElementById(v)?.classList.add('hidden'));
    document.getElementById('mainNavbar').style.display = (tab==='home'||tab==='search') ? 'flex' : 'none';
    document.getElementById('bottomNav').style.display = (tab==='detail'||tab==='watch') ? 'none' : 'flex';
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(tab + '-view')?.classList.remove('hidden');
    document.getElementById('tab-' + tab)?.classList.add('active');

    if (tab === 'home' && !document.getElementById('home-view').innerHTML) loadLatest();
    if (tab === 'recent') loadRecentHistory();
}

async function handleSearch(q) {
    if (!q) { switchTab('home'); return; }
    switchTab('search'); loader(true);
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    document.getElementById('search-view').innerHTML = `<div class="header-flex"><h2>Hasil: "${q}"</h2></div><div class="anime-grid">${data.map(a => generateCardHtml(a)).join('')}</div>`;
    loader(false);
}

// ==========================================
// 6. CORE FEATURES (HOME, HISTORY, DETAIL)
// ==========================================
async function loadLatest() {
    loader(true); const container = document.getElementById('home-view');
    const res = await fetch(`${API_BASE}/latest`); const data = await res.json();
    renderHeroSlider(data.slice(0, 10), container);
    
    const historyData = await getHistory();
    if (historyData.length > 0) {
        const hDiv = document.createElement('div');
        hDiv.innerHTML = `<div class="header-flex"><h2>Terakhir Ditonton</h2><a class="more-link" onclick="switchTab('recent')">Lihat Semua ></a></div><div class="horizontal-scroll">${historyData.slice(0, 10).map(a => generateRecentCardHtml(a)).join('')}</div>`;
        container.appendChild(hDiv);
    }
    loader(false);
}

function generateCardHtml(a) {
    return `<div class="scroll-card" onclick="loadDetail('${a.url}')">
        <div class="scroll-card-img"><img src="${a.image}"><div class="badge-ep">${getEpBadge(a)}</div></div>
        <div class="scroll-card-title">${a.title}</div>
    </div>`;
}

function generateRecentCardHtml(a) {
    return `<div class="recent-card" onclick="loadDetail('${a.url}')">
        <div class="recent-img-box"><img src="${a.image}"><div class="recent-ep-text">${getEpBadge(a)}</div></div>
        <div class="recent-title">${a.title}</div>
    </div>`;
}

async function loadRecentHistory() {
    const container = document.getElementById('recent-results-container');
    container.innerHTML = '<div class="spinner"></div>';
    
    const header = document.querySelector('#recent-view .view-header-title');
    if(header) header.innerHTML = `<div style="text-align:center; padding-top:10px;"><h2>Riwayat Menonton</h2><p style="font-size:12px; color:#666;">Tap tahan untuk hapus</p></div>`;

    const historyData = await getHistory();
    if (historyData.length === 0) { container.innerHTML = `<p style="text-align:center; padding:50px;">Belum ada riwayat.</p>`; return; }

    const grouped = {};
    historyData.forEach(a => { const l = formatTimelineDate(a.timestamp); if(!grouped[l]) grouped[l]=[]; grouped[l].push(a); });

    let html = '<div class="timeline-wrapper">';
    for (const [label, items] of Object.entries(grouped)) {
        html += `<div class="timeline-group"><div class="timeline-date-badge">${label}</div><div class="timeline-items">
            ${items.map(a => `
                <div class="timeline-card" onclick="loadDetail('${a.url}')">
                    <div class="timeline-img"><img src="${a.image}"><div class="timeline-play-icon">▶</div></div>
                    <div class="timeline-info">
                        <div class="timeline-header"><div class="timeline-title">${a.title}</div><div class="timeline-time">${new Date(a.timestamp).getHours()}:${new Date(a.timestamp).getMinutes()}</div></div>
                        <div class="timeline-ep">${getEpBadge(a)}</div>
                        <div class="timeline-progress-container"><div class="timeline-progress-bg"><div class="timeline-progress-fill" style="width:75%"></div></div><div class="timeline-progress-text">18:00 / 24:00</div></div>
                    </div>
                </div>`).join('')}
        </div></div>`;
    }
    container.innerHTML = html + '</div>';
}

async function loadDetail(url) {
    history.pushState({page:'detail'}, '', '#detail'); loader(true);
    const res = await fetch(`${API_BASE}/detail?url=${encodeURIComponent(url)}`); const data = await res.json();
    currentAnimeEpisodes = data.episodes || [];
    currentAnimeMeta = { title: data.title };
    switchTab('detail');
    saveHistory({ url, title: data.title, image: data.image, episode: 'Eps ' + data.episodes.length });
    
    document.getElementById('detail-view').innerHTML = `
        <div class="detail-hero" style="background-image: url('${getHighRes(data.image)}')">
            <div class="detail-hero-overlay"></div>
            <div class="nav-back"><button onclick="history.back()">Kembali</button></div>
            <div class="detail-hero-content"><h1>${data.title}</h1><button class="hero-btn" onclick="loadVideo('${data.episodes[0].url}')">Mulai Tonton</button></div>
        </div>
        <div style="padding:20px;"><h3>Sinopsis</h3><p class="synopsis-text">${data.description}</p></div>
        <div style="padding:20px;"><h3>Episode List</h3><div id="ep-list">${data.episodes.reverse().map((e,i) => `<div class="ep-row" onclick="loadVideo('${e.url}')">Episode ${data.episodes.length-i}</div>`).join('')}</div></div>`;
    loader(false);
}

// ==========================================
// 7. WATCH & PREMIUM COMMENT SYSTEM
// ==========================================
async function loadVideo(url) {
    history.pushState({page:'watch'}, '', '#watch'); loader(true);
    const res = await fetch(`${API_BASE}/watch?url=${encodeURIComponent(url)}`); const data = await res.json();
    switchTab('watch');
    addXP(20);
    const epID = btoa(url).substring(0,20);

    document.getElementById('watch-view').innerHTML = `
        <div class="video-container-fixed"><iframe src="${data.streams[0].url}" allowfullscreen></iframe></div>
        <div style="padding:20px;"><h2>${currentAnimeMeta.title}</h2></div>
        <div class="comment-section">
            <div style="font-weight:800; margin-bottom:15px;">5,6K Comments</div>
            <div id="custom-comment-area"></div>
            <div id="comment-list-container" style="margin-top:25px;"></div>
        </div>`;
    
    renderCommentInput(epID);
    listenToComments(epID);
    loader(false);
}

function renderCommentInput(epID) {
    const container = document.getElementById('custom-comment-area');
    if(!currentUser) {
        container.innerHTML = `<div class="comment-input-box" onclick="switchTab('developer')">Login untuk berkomentar...</div>`;
    } else {
        container.innerHTML = `<div style="display:flex; gap:12px; align-items:center;">
            <img src="${currentUser.photoURL}" style="width:36px; height:36px; border-radius:50%;">
            <div style="flex:1; position:relative;">
                <input type="text" id="main-comment-input" placeholder="Tulis komentar..." style="width:100%; background:#1c1c1e; border:1px solid #333; color:#fff; padding:10px 40px 10px 15px; border-radius:20px; outline:none;">
                <button onclick="postComment('${epID}')" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:#3b82f6;">Kirim</button>
            </div>
        </div>`;
    }
}

window.postComment = function(epID) {
    const t = document.getElementById('main-comment-input').value;
    if(!t.trim() || !currentUser) return;
    db.ref('users/'+currentUser.uid).once('value').then(s => {
        const u = s.val();
        db.ref('comments/'+epID).push({ uid:currentUser.uid, nama:u.nama, foto:u.foto, role:u.role, level:u.level, teks:t, waktu:Date.now() });
        document.getElementById('main-comment-input').value = ''; addXP(10);
    });
};

function listenToComments(epID) {
    const list = document.getElementById('comment-list-container');
    db.ref('comments/'+epID).on('value', snap => {
        if(!snap.exists()) return;
        let html = '';
        snap.forEach(c => {
            const v = c.val();
            const rClass = v.role === 'Developer' ? 'badge-dev-anim' : (v.level >= 50 ? 'badge-premium-anim' : 'badge-member');
            html = `<div class="comment-item" style="display:flex; gap:12px; margin-bottom:20px;">
                <img src="${v.foto}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">
                <div style="flex:1;">
                    <div style="font-size:13px; font-weight:700;">${v.nama} <span style="color:#888; font-weight:400;">• ${timeAgo(v.waktu)}</span></div>
                    <div style="display:flex; gap:6px; margin:4px 0;">
                        <span class="c-badge badge-lvl-gold">Lvl. ${v.level}</span>
                        <span class="c-badge ${rClass}">${v.role === 'Developer' ? 'DEV' : 'Wibu Premium'}</span>
                    </div>
                    <div style="font-size:13px; color:#ccc;">${v.teks}</div>
                </div>
            </div>` + html;
        });
        list.innerHTML = html;
    });
}

function loader(s) { document.getElementById('loading').classList.toggle('hidden', !s); }

document.addEventListener('DOMContentLoaded', () => { updateDevUI(); switchTab('home'); });
