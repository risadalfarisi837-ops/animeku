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
            const joinMonths = Math.max(1, new Date().getMonth() + 1);
            const shortUid = "#" + currentUser.uid.substring(0, 6).toUpperCase();
            const displayName = data.role === 'Member' ? 'Wibu Biasa' : data.role;

            let historyHtml = historyData.length > 0 ? historyData.map(item => {
                let timeDiff = Date.now() - item.timestamp;
                let daysAgo = Math.max(1, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
                let randProgress = Math.floor(Math.random() * 80 + 20);
                return `
                <div class="profile-list-item" onclick="loadDetail('${item.url}')">
                    <div style="position:relative;">
                        <img src="${item.image}" class="pli-img">
                    </div>
                    <div class="pli-info">
                        <div class="pli-title">${item.title}</div>
                        <div class="pli-ep">${item.episode} • ${daysAgo} hari lalu</div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <div class="pli-progress-bg"><div class="pli-progress-fill" style="width: ${randProgress}%;"></div></div>
                        </div>
                    </div>
                </div>`;
            }).join('') : '<p style="text-align:center; color:#555; font-size:13px; margin-top:30px;">Belum ada riwayat tontonan.</p>';

            container.innerHTML = `
                <div class="profile-header">
                    <img src="${data.foto}" class="profile-avatar">
                    <div class="profile-name">${data.nama}</div>
                    <div class="profile-badges">
                        <span class="p-badge badge-role">${displayName}</span>
                        <span class="p-badge badge-lvl">Lvl. ${data.level}</span>
                    </div>
                </div>
                <div class="profile-stats">
                    <div class="stat-box"><div class="stat-val">${totalMenit}</div><div class="stat-lbl">menit</div></div>
                    <div class="stat-box"><div class="stat-val">${data.exp}</div><div class="stat-lbl">exp</div></div>
                </div>
                <div id="ptab-history" class="ptab-content">${historyHtml}</div>
                <button onclick="logoutAkun()" style="margin:20px; width:calc(100% - 40px); background:transparent; border:1px solid #333; color:#ef4444; padding:12px; border-radius:12px; font-weight:800; cursor:pointer;">Keluar Akun</button>`;
        });
    }
}

// ==========================================
// 3. CORE APP VARIABLES & INDEXED DB
// ==========================================
const API_BASE = '/api'; 
const DB_NAME = 'AnimekuDB';
const STORE_HISTORY = 'history';
const STORE_FAV = 'favorites';

function getEpBadge(anime) {
    let text = String(anime.episode || anime.episodes || anime.status || '');
    if (!text || text === 'undefined') return 'Anime';
    if (text.toLowerCase().includes('tamat')) return 'Tamat';
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

async function initDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 2); 
        req.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains(STORE_HISTORY)) database.createObjectStore(STORE_HISTORY, { keyPath: 'url' });
            if (!database.objectStoreNames.contains(STORE_FAV)) database.createObjectStore(STORE_FAV, { keyPath: 'url' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveHistory(animeObj) {
    try { const database = await initDB(); const tx = database.transaction(STORE_HISTORY, 'readwrite'); animeObj.timestamp = Date.now(); tx.objectStore(STORE_HISTORY).put(animeObj); } catch(e) {}
}

async function getHistory() {
    try {
        const database = await initDB();
        return new Promise((resolve) => {
            const req = database.transaction(STORE_HISTORY, 'readonly').objectStore(STORE_HISTORY).getAll();
            req.onsuccess = () => resolve(req.result.sort((a,b) => b.timestamp - a.timestamp));
        });
    } catch(e) { return []; }
}

// ==========================================
// 6. UI VIEWS & NAVIGATION
// ==========================================
const loader = (state) => { const el = document.getElementById('loading'); if(el) state ? el.classList.remove('hidden') : el.classList.add('hidden'); };

function switchTab(tabName) {
    const views = ['home-view', 'recent-view', 'favorite-view', 'developer-view', 'detail-view', 'watch-view', 'search-view'];
    views.forEach(v => { const el = document.getElementById(v); if(el) el.classList.add('hidden'); });
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    const activeView = document.getElementById(tabName + '-view');
    if(activeView) activeView.classList.remove('hidden');
    document.getElementById('tab-' + tabName)?.classList.add('active');

    if (tabName === 'recent') loadRecentHistory();
}

async function loadRecentHistory() {
    const container = document.getElementById('recent-results-container'); 
    container.innerHTML = '<div class="spinner"></div>';
    
    const headerTitle = document.querySelector('#recent-view .view-header-title');
    if(headerTitle) {
        headerTitle.innerHTML = `
            <div style="text-align:center; padding: 20px 0;">
                <div style="font-size: 20px; font-weight: 900;">Riwayat Menonton</div>
                <div style="font-size: 13px; color: #a1a1aa; font-weight: 500; margin-top: 4px;">Tap tahan untuk memilih & hapus</div>
            </div>`;
    }

    const historyData = await getHistory();
    if (!historyData || historyData.length === 0) { 
        container.innerHTML = `<div style="text-align:center; padding:50px 20px; color:#555;">Belum ada riwayat tontonan</div>`; 
        return; 
    }

    const groupedData = {};
    historyData.forEach(anime => {
        const dateLabel = formatTimelineDate(anime.timestamp);
        if (!groupedData[dateLabel]) groupedData[dateLabel] = [];
        groupedData[dateLabel].push(anime);
    });

    let timelineHtml = '<div class="timeline-wrapper">';
    for (const [dateLabel, animes] of Object.entries(groupedData)) {
        timelineHtml += `
            <div class="timeline-group">
                <div class="timeline-date-badge">${dateLabel}</div>
                <div class="timeline-items">
                    ${animes.map(anime => {
                        const dateObj = new Date(anime.timestamp);
                        const timeStr = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
                        const progress = Math.floor(Math.random() * 70 + 20);
                        return `
                        <div class="timeline-card" onclick="loadDetail('${anime.url}')">
                            <div class="timeline-img">
                                <img src="${anime.image}" alt="${anime.title}">
                                <div class="timeline-play-icon"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>
                            </div>
                            <div class="timeline-info">
                                <div class="timeline-header">
                                    <div class="timeline-title">${anime.title}</div>
                                    <div class="timeline-time">${timeStr}</div>
                                </div>
                                <div class="timeline-ep">${getEpBadge(anime)}</div>
                                <div class="timeline-progress-container">
                                    <div class="timeline-progress-bg"><div class="timeline-progress-fill" style="width: ${progress}%;"></div></div>
                                    <div class="timeline-progress-text">${Math.floor(progress*0.24)}:00 / 24:00</div>
                                </div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
    }
    container.innerHTML = timelineHtml + '</div>';
}

document.addEventListener('DOMContentLoaded', () => { 
    updateDevUI(); 
    switchTab('home'); 
});
