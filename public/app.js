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
                db.ref('users/' + u.uid).set({ nama: u.displayName, email: u.email, foto: u.photoURL, role: 'Member', level: 1, exp: 0 });
            }
        });
        alert("Login Berhasil! Selamat datang, " + u.displayName);
        updateDevUI(); 
    }).catch(err => {
        alert("Gagal login: " + err.message);
    });
};

window.logoutAkun = function() {
    auth.signOut().then(() => { alert("Berhasil keluar dari akun."); location.reload(); });
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
            const data = snap.val(); if(!data) return;
            const historyData = await getHistory();
            const totalMenit = historyData.length * 24; 
            const joinMonths = Math.max(1, new Date().getMonth() + 1);
            
            const role = data.role || 'Member';
            const level = data.level || 1;
            const shortUid = "#" + currentUser.uid.substring(0, 6).toUpperCase();

            let roleBadgeClass = 'badge-member'; let roleName = role;
            if(role === 'Developer') { roleBadgeClass = 'badge-dev-anim'; roleName = 'DEV'; }
            else if(role === 'Wibu Premium' || level >= 50) { roleBadgeClass = 'badge-premium-anim'; roleName = role !== 'Member' ? role : 'Wibu Premium'; }
            else if(role === 'Member') { roleName = 'Wibu Biasa'; }

            let lvlClass = 'badge-lvl-normal';
            if (level >= 100) lvlClass = 'badge-lvl-gold';
            else if (level >= 50) lvlClass = 'badge-lvl-silver';

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
            }).join('') : '<p style="text-align:center; color:#555; margin-top:30px;">Belum ada riwayat tontonan.</p>';

            container.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; padding-bottom:0;">
                    <button onclick="switchTab('home')" style="background:none; border:none; color:#fff; padding:0; cursor:pointer;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>
                    <span style="font-weight:900; font-size:18px;">Setting</span>
                </div>
                <div class="profile-header">
                    <img src="${data.foto}" class="profile-avatar">
                    <div class="profile-name">${data.nama}</div>
                    <div class="profile-badges" style="display:flex; gap:8px; justify-content:center; align-items:center;">
                        <span class="c-badge ${roleBadgeClass}" style="font-size:11px; padding:4px 10px;">${roleName}</span>
                        <span class="c-badge ${lvlClass}" style="font-size:11px; padding:4px 10px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="margin-right:4px;"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg> Lvl. ${level}</span>
                        <span class="c-badge" style="font-size:11px; padding:4px 10px; background: rgba(255,255,255,0.05); color: #a1a1aa; border: 1px solid rgba(255,255,255,0.1);">${shortUid}</span>
                    </div>
                </div>
                <div class="profile-stats">
                    <div class="stat-box"><div class="stat-val">${totalMenit}</div><div class="stat-lbl">menit<br>menonton</div></div>
                    <div class="stat-box"><div class="stat-val">${data.exp}</div><div class="stat-lbl">total<br>exp</div></div>
                    <div class="stat-box"><div class="stat-val">${joinMonths}</div><div class="stat-lbl">bulan<br>bergabung</div></div>
                </div>
                <div class="profile-tabs"><div class="ptab active">History</div></div>
                <div class="ptab-content">${historyHtml}</div>
                <button onclick="logoutAkun()" style="margin:20px; width:calc(100% - 40px); background:transparent; border:1px solid #333; color:#ef4444; padding:12px; border-radius:12px; font-weight:800; cursor:pointer;">Keluar Akun</button>
            `;
        });
    }
}

// ==========================================
// 3. CORE APP VARIABLES & HELPERS
// ==========================================
const API_BASE = '/api'; 
const DB_NAME = 'AnimekuDB';
const STORE_HISTORY = 'history';
const STORE_FAV = 'favorites';

function getHighRes(url) { if(!url) return ''; try { return url.replace(/\/s\d+(-[a-zA-Z0-9]+)?\//g, '/s0/').replace(/=s\d+/g, '=s0'); } catch(e) { return url; } }
function getEpBadge(anime) { let text = String(anime.episode || anime.episodes || anime.status || ''); if (!text || text === 'undefined') return 'Anime'; let epMatch = text.match(/(?:episode|eps|ep)\s*(\d+(\.\d+)?)/i); return epMatch ? `Eps ${epMatch[1]}` : text.substring(0, 8); }

function formatTimelineDate(timestamp) {
    const date = new Date(timestamp); const today = new Date(); const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Hari ini";
    if (date.toDateString() === yesterday.toDateString()) return "Kemarin";
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function timeAgo(ms) {
    const seconds = Math.floor((new Date() - ms) / 1000);
    let interval = seconds / 31536000; if (interval > 1) return Math.floor(interval) + " thn lalu";
    interval = seconds / 2592000; if (interval > 1) return Math.floor(interval) + " bln lalu";
    interval = seconds / 86400; if (interval > 1) return Math.floor(interval) + " hr lalu";
    interval = seconds / 3600; if (interval > 1) return Math.floor(interval) + " jam lalu";
    interval = seconds / 60; if (interval > 1) return Math.floor(interval) + " mnt lalu";
    return "Baru saja";
}

function addXP(amount) {
    if(!currentUser) return; 
    db.ref('users/' + currentUser.uid).once('value').then(snap => {
        let d = snap.val(); if(!d) return;
        let nExp = (d.exp || 0) + amount; let nLvl = Math.floor(nExp / 200) + 1; 
        db.ref('users/' + currentUser.uid).update({ exp: nExp, level: nLvl });
        const toast = document.getElementById('xp-toast');
        document.getElementById('xp-toast-text').innerText = (nLvl > (d.level||1)) ? `Level Up! Lvl ${nLvl} 🎉` : `+${amount} XP`;
        toast.style.background = (nLvl > (d.level||1)) ? '#f59e0b' : '#3b82f6';
        toast.style.display = 'flex'; setTimeout(() => { toast.style.display = 'none'; }, 3000);
    });
}

function initDB() { return new Promise((res, rej) => { const req = indexedDB.open(DB_NAME, 2); req.onupgradeneeded = (e) => { const d = e.target.result; if (!d.objectStoreNames.contains(STORE_HISTORY)) d.createObjectStore(STORE_HISTORY, { keyPath: 'url' }); if (!d.objectStoreNames.contains(STORE_FAV)) d.createObjectStore(STORE_FAV, { keyPath: 'url' }); }; req.onsuccess = () => res(req.result); }); }
async function saveHistory(a) { try { const d = await initDB(); a.timestamp = Date.now(); d.transaction(STORE_HISTORY, 'readwrite').objectStore(STORE_HISTORY).put(a); } catch(e) {} }
async function getHistory() { try { const d = await initDB(); return new Promise(res => { const req = d.transaction(STORE_HISTORY, 'readonly').objectStore(STORE_HISTORY).getAll(); req.onsuccess = () => res(req.result.sort((a,b) => b.timestamp - a.timestamp)); }); } catch(e) { return []; } }
async function getFavorites() { try { const d = await initDB(); return new Promise(res => { const req = d.transaction(STORE_FAV, 'readonly').objectStore(STORE_FAV).getAll(); req.onsuccess = () => res(req.result.sort((a,b) => b.timestamp - a.timestamp)); }); } catch(e) { return []; } }

async function toggleFavorite(url, title, image, score, episode) {
    try {
        const database = await initDB(); const isFav = await checkFavorite(url);
        const tx = database.transaction(STORE_FAV, 'readwrite'); const store = tx.objectStore(STORE_FAV);
        const btn = document.getElementById('favBtn');
        if (isFav) { 
            store.delete(url); 
            if(btn) { btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg> Subscribe`; btn.style.color = '#fff'; }
        } else { 
            store.put({url, title, image, score, episode, timestamp: Date.now()}); 
            if(btn) { btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg> Disubscribe`; btn.style.color = '#ef4444'; }
        }
    } catch(e) {}
}
async function checkFavorite(url) { try { const database = await initDB(); return new Promise((resolve) => { const req = database.transaction(STORE_FAV, 'readonly').objectStore(STORE_FAV).get(url); req.onsuccess = () => resolve(!!req.result); }); } catch(e) { return false; } }

// ==========================================
// 6. UI VIEWS & NAVIGATION
// ==========================================
const HOME_SECTIONS = [
    { title: "Action Hits", queries: ["action", "kimetsu", "jujutsu", "piece", "bleach", "hunter", "shingeki"] },
    { title: "Romance & Drama", queries: ["love", "kanojo", "romance", "heroine", "uso"] },
    { title: "Isekai & Fantasy", queries: ["isekai", "reincarnation", "world", "maou"] },
    { title: "Comedy & Chill", queries: ["comedy", "slice of life", "bocchi", "spy"] }
];

let sliderInterval;
let currentAnimeEpisodes = []; 
let currentAnimeMeta = {}; 

const loader = (state) => { const el = document.getElementById('loading'); if(el) state ? el.classList.remove('hidden') : el.classList.add('hidden'); };

function switchTab(tabName) {
    ['home-view', 'recent-view', 'favorite-view', 'developer-view', 'detail-view', 'watch-view', 'search-view'].forEach(v => document.getElementById(v)?.classList.add('hidden'));
    document.getElementById('mainNavbar').style.display = (tabName === 'home' || tabName === 'search') ? 'flex' : 'none';
    document.getElementById('bottomNav').style.display = (tabName === 'detail' || tabName === 'watch') ? 'none' : 'flex';
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById(tabName + '-view')?.classList.remove('hidden');
    document.getElementById('tab-' + tabName)?.classList.add('active');

    if (tabName === 'home' && document.getElementById('home-view').innerHTML === '') loadLatest();
    if (tabName === 'recent') loadRecentHistory();
    if (tabName === 'favorite') loadFavorites();
}

function generateCardHtml(anime) {
    let finalScore = (Math.random() * 1.5 + 7.0).toFixed(2);
    return `<div class="scroll-card" onclick="loadDetail('${anime.url}')"><div class="scroll-card-img"><img src="${anime.image}" loading="lazy"><div class="badge-ep">${getEpBadge(anime)}</div><div class="badge-score"><svg width="10" height="10" viewBox="0 0 24 24" fill="#fbbf24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> ${finalScore}</div></div><div class="scroll-card-title">${anime.title}</div></div>`;
}

function generateRecentCardHtml(anime) {
    return `<div class="recent-card" onclick="loadDetail('${anime.url}')"><div class="recent-img-box"><img src="${anime.image}" loading="lazy"><div class="recent-overlay"></div><div class="recent-ep-text">${getEpBadge(anime)}</div></div><div class="recent-title">${anime.title}</div></div>`;
}

async function loadLatest() {
    loader(true); const hc = document.getElementById('home-view'); hc.innerHTML = ''; 
    try {
        let sliderData = []; try { const res = await fetch(`${API_BASE}/latest`); sliderData = await res.json(); } catch (e) {}
        if (sliderData.length > 0) { renderHeroSlider(sliderData.slice(0, 10), hc); } 

        const historyData = await getHistory();
        if (historyData.length > 0) {
            const hd = document.createElement('div');
            hd.innerHTML = `<div class="header-flex"><h2>Terakhir Ditonton</h2><a class="more-link" onclick="switchTab('recent')">Lihat Lainnya ></a></div><div class="horizontal-scroll">${historyData.slice(0, 15).map(a => generateRecentCardHtml(a)).join('')}</div>`;
            hc.appendChild(hd);
        }

        const sectionPromises = HOME_SECTIONS.map(async (section) => {
            let combinedData = [];
            if (section.queries) {
                const promises = section.queries.map(q => fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`).then(res => res.json()).catch(() => []));
                const results = await Promise.all(promises);
                results.forEach(list => { if(Array.isArray(list)) combinedData = [...combinedData, ...list]; });
            }
            combinedData = [ ...new Map(combinedData.map(item => [item['url'], item])).values() ];
            return { section, data: combinedData };
        });

        const loadedSections = await Promise.all(sectionPromises);
        loadedSections.forEach(({section, data}) => {
            if (data.length > 0) {
                const sd = document.createElement('div');
                sd.innerHTML = `<div class="header-flex"><h2>${section.title}</h2><a class="more-link" onclick="handleSearch('${section.title.split(' ')[0]}')">Lihat Lainnya ></a></div><div class="horizontal-scroll">${data.slice(0, 15).map(a => generateCardHtml(a)).join('')}</div>`;
                hc.appendChild(sd);
            }
        });
    } catch (err) {} finally { loader(false); }
}

function renderHeroSlider(data, container) {
    const sc = document.createElement('div'); sc.className = 'hero-section-container';
    sc.innerHTML = `<div class="hero-slider"><div class="hero-wrapper" id="heroWrapper">${[...data, data[0]].map((a, i) => `
        <div class="hero-slide" onclick="loadDetail('${a.url}')">
            <img src="${getHighRes(a.image)}" class="hero-bg" loading="${i===0?'eager':'lazy'}">
            <div class="hero-overlay"></div><div class="hero-content"><div class="hero-badge">${getEpBadge(a)}</div><h2 class="hero-title">${a.title}</h2><button class="hero-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Putar</button></div>
        </div>`).join('')}</div></div>`;
    container.appendChild(sc);

    const wrapper = document.getElementById('heroWrapper');
    let currentSlide = 0; const totalSlides = data.length + 1; 

    function nextSlide() {
        if (!wrapper || document.getElementById('home-view').classList.contains('hidden')) return;
        currentSlide++; wrapper.style.transition = 'transform 0.5s ease-in-out'; wrapper.style.transform = `translateX(-${currentSlide * 100}%)`;
        if (currentSlide >= totalSlides - 1) { setTimeout(() => { if(!wrapper) return; wrapper.style.transition = 'none'; currentSlide = 0; wrapper.style.transform = `translateX(0)`; }, 500); }
    }
    function startAutoSlide() { if (sliderInterval) clearInterval(sliderInterval); sliderInterval = setInterval(nextSlide, 5000); }
    startAutoSlide();
}

async function handleSearch(q) {
    if (!q) { switchTab('home'); return; }
    switchTab('search'); loader(true);
    try {
        const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`); const data = await res.json();
        document.getElementById('search-view').innerHTML = `<div class="header-flex" style="padding-top:20px;"><h2>Pencarian: "${q}"</h2></div><div class="anime-grid">${data.map(a => generateCardHtml(a)).join('')}</div>`;
    } catch (err) {} finally { loader(false); }
}

async function loadRecentHistory() {
    const c = document.getElementById('recent-results-container'); c.innerHTML = '<div class="spinner" style="margin:40px auto;"></div>';
    
    const h = document.querySelector('#recent-view > div:first-child');
    if(h) h.innerHTML = `<div style="text-align:center; padding-top:10px;"><div style="font-size:20px; font-weight:900;">Riwayat Menonton</div><div style="font-size:13px; color:#a1a1aa; margin-top:4px;">Tap tahan untuk memilih & hapus</div></div>`;

    const data = await getHistory();
    if (data.length === 0) { c.innerHTML = `<div style="text-align:center; padding:50px; color:#555;">Belum ada riwayat tontonan</div>`; return; }

    const grouped = {};
    data.forEach(a => { const l = formatTimelineDate(a.timestamp); if (!grouped[l]) grouped[l] = []; grouped[l].push(a); });

    let html = '<div class="timeline-wrapper">';
    for (const [label, animes] of Object.entries(grouped)) {
        html += `<div class="timeline-group"><div class="timeline-date-badge">${label}</div><div class="timeline-items">`;
        animes.forEach(a => {
            const d = new Date(a.timestamp); const t = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
            const p = Math.floor(Math.random() * 70 + 20); 
            html += `
                <div class="timeline-card" onclick="loadDetail('${a.url}')">
                    <div class="timeline-img"><img src="${a.image}"><div class="timeline-play-icon"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div></div>
                    <div class="timeline-info">
                        <div class="timeline-header"><div class="timeline-title">${a.title}</div><div class="timeline-time">${t}</div></div>
                        <div class="timeline-ep">${getEpBadge(a)}</div>
                        <div class="timeline-progress-container"><div class="timeline-progress-bg"><div class="timeline-progress-fill" style="width: ${p}%;"></div></div><div class="timeline-progress-text">${Math.floor(p*0.24)}:00 / 24:00</div></div>
                    </div>
                </div>`;
        });
        html += `</div></div>`;
    }
    c.innerHTML = html + '</div>';
}

async function loadFavorites() {
    const c = document.getElementById('favorite-results-container'); c.innerHTML = '<div class="spinner"></div>';
    const data = await getFavorites();
    if (data.length === 0) { c.innerHTML = `<div class="empty-state"><h2>Belum ada Subscribe Anime</h2></div>`; return; }
    c.innerHTML = `<div class="anime-grid" style="margin-top:15px;">${data.map(a => generateCardHtml(a)).join('')}</div>`;
}

// ==========================================
// 7. DETAIL VIEW
// ==========================================
async function loadDetail(url) {
    history.pushState({page: 'detail'}, '', '#detail'); loader(true);
    try {
        const res = await fetch(`${API_BASE}/detail?url=${encodeURIComponent(url)}`); const data = await res.json();
        window.currentAnimeEpisodes = data.episodes || []; window.currentAnimeMeta = { title: data.title };
        switchTab('detail'); 

        let score = (Math.random() * 1.5 + 7.0).toFixed(2);
        let epNum = data.episodes.length > 0 ? data.episodes.length : '?';
        saveHistory({ url, title: data.title, image: data.image, score, episode: `Eps ${epNum}` });
        const isFav = await checkFavorite(url);

        document.getElementById('detail-view').innerHTML = `
            <div class="detail-hero" style="background-image: url('${getHighRes(data.image)}')">
                <div class="detail-hero-overlay"></div>
                <div class="detail-hero-content">
                    <div style="background:#3b82f6; color:#fff; display:inline-block; margin-bottom:8px; padding:6px 12px; border-radius:6px; font-weight:bold; font-size:12px;">Episode ${epNum}</div>
                    <h1 style="font-size:24px; line-height:1.2; font-weight:800; margin:0 0 8px 0; color:#fff;">${data.title}</h1>
                    <div style="display:flex; gap:10px; width:100%; margin-top: 15px;">
                        <button style="flex:1; background:#3b82f6; color:#fff; border:none; padding:12px; border-radius:24px; font-weight:800; font-size:14px; cursor:pointer;" onclick="loadVideo('${data.episodes[0].url}')">▶ Mulai Tonton</button>
                        <button id="favBtn" onclick="toggleFavorite('${url}', '${data.title.replace(/'/g, "\\'")}', '${data.image}', '${score}', 'Eps ${epNum}')" style="flex:1; background:#1c1c1e; color:${isFav ? '#ef4444' : '#fff'}; border:none; padding:12px; border-radius:24px; font-weight:800; font-size:14px; cursor:pointer; transition:0.2s;">
                            ${isFav ? 'Disubscribe' : 'Subscribe'}
                        </button>
                    </div>
                </div>
                <div class="nav-back"><button onclick="history.back()">Back</button></div>
            </div>
            <div style="padding: 20px;"><h3>Sinopsis</h3><p class="synopsis-text">${data.description}</p></div>
            <div style="padding: 0 20px;"><h3>Episode List</h3>
                ${data.episodes.reverse().map((ep, i) => `
                <div onclick="loadVideo('${ep.url}')" style="display:flex; justify-content:space-between; align-items:center; padding:15px 0; border-bottom:1px solid #1a1a1a; cursor:pointer;">
                    <div><div style="font-weight:800;">Episode ${data.episodes.length - i}</div></div>
                    <button style="background:rgba(255,255,255,0.1); border:none; color:#fff; padding:6px 16px; border-radius:20px;">Buka</button>
                </div>`).join('')}
            </div>
            <div style="padding-bottom: 40px;"></div>
        `;
    } catch (err) {} finally { loader(false); }
}

// ==========================================
// 8. WATCH VIEW & COMMENTS SYSTEM
// ==========================================
window.currentCommentSort = 'top';

window.handleDownload = function() { alert('Fitur Download sedang dalam tahap pengembangan! Nantikan update selanjutnya.'); };
window.handleShare = function() { 
    if (navigator.share) { navigator.share({ title: document.title, url: window.location.href }); } 
    else { alert('Tautan berhasil disalin: ' + window.location.href); }
};

window.openServerModal = function() { document.getElementById('serverModalOverlay').style.display = 'block'; document.getElementById('serverModal').style.display = 'block'; setTimeout(() => { document.getElementById('serverModal').classList.add('show'); }, 10); };
window.closeServerModal = function() { const m = document.getElementById('serverModal'); m.classList.remove('show'); setTimeout(() => { document.getElementById('serverModalOverlay').style.display = 'none'; m.style.display = 'none'; }, 300); };
window.changeServer = function(url, serverName, btnElement) { document.getElementById('video-player').src = url; document.getElementById('current-quality-text').innerText = serverName; document.querySelectorAll('.server-list-btn').forEach(b => b.classList.remove('active')); btnElement.classList.add('active'); closeServerModal(); };

async function loadVideo(url) {
    history.pushState({page: 'watch'}, '', '#watch'); loader(true);
    try {
        const res = await fetch(`${API_BASE}/watch?url=${encodeURIComponent(url)}`); const data = await res.json();
        switchTab('watch'); addXP(20); 
        
        let epNum = '1'; let f = currentAnimeEpisodes.find(e => e.url === url);
        if(f) { let m = f.title.match(/(?:Episode|Eps|Ep)\s*(\d+(\.\d+)?)/i); epNum = m ? m[1] : '1'; }
        let epID = btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);

        document.getElementById('watch-view').innerHTML = `
            <div class="video-container-fixed">
                <button class="watch-back-btn" onclick="history.back()"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>
                <iframe id="video-player" src="${data.streams[0]?.url || ''}" allowfullscreen></iframe>
            </div>
            
            <div style="padding: 15px 20px;">
                <h2 style="font-size: 16px; font-weight: 800; margin: 0 0 4px 0;">${window.currentAnimeMeta.title || data.title}</h2>
                <div style="font-size: 12px; color: #a1a1aa;">Episode ${epNum} • 203.705 Views</div>
            </div>

            <div class="hide-scrollbar" style="display: flex; gap: 8px; overflow-x: auto; padding: 15px 20px; border-bottom: 1px solid #111; align-items: center;">
                <button class="action-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg> 6,3K</button>
                <button class="action-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg> 28</button>
                
                <button class="action-btn" onclick="openServerModal()" style="border: 1px solid #3b82f6; background: rgba(59, 130, 246, 0.1); color: #3b82f6;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> <span id="current-quality-text">${data.streams[0]?.server || 'Quality'}</span></button>

                <button class="action-btn" onclick="handleDownload()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"></path></svg> Download</button>
                <button class="action-btn" onclick="handleShare()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg> Share</button>
                <button class="action-btn" onclick="window.open('https://wa.me/6281315059849?text=Report Error!')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg> Report</button>
            </div>

            <div style="padding: 20px 20px 10px 20px;">
                <h2 style="font-size:18px; font-weight:800; margin:0 0 15px 0;">Episode List</h2>
                <div id="watch-episode-squares" class="hide-scrollbar" style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 10px;"></div>
            </div>

            <div class="comment-section" style="padding: 20px;">
                <div id="comment-count-text" style="font-size:16px; font-weight:800; margin:0 0 15px 0;">0 Comments</div>
                <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                    <button class="comment-filter-btn active" onclick="setCommentFilter('top', this)">Top Comment</button>
                    <button class="comment-filter-btn" onclick="setCommentFilter('new', this)">Terbaru</button>
                </div>
                <div id="custom-comment-area" style="margin-bottom: 30px;"></div>
                <div id="comment-list-container"></div>
            </div>
            <div style="padding-bottom: 60px;"></div>
        `;

        if (data.streams.length > 0) {
            document.getElementById('modal-server-list').innerHTML = data.streams.map((stream, idx) => {
                let isActive = idx === 0 ? "server-list-btn active" : "server-list-btn";
                return `<button class="${isActive}" onclick="changeServer('${stream.url}', '${stream.server}', this)"><span>${stream.server}</span> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5l10 -10"></path></svg></button>`;
            }).join('');
        }

        const watchEpListContainer = document.getElementById('watch-episode-squares');
        if (watchEpListContainer && currentAnimeEpisodes.length > 0) {
            watchEpListContainer.innerHTML = [...currentAnimeEpisodes].reverse().map((ep, index) => {
                let m = String(ep.title || '1').match(/(?:Episode|Eps|Ep)\s*(\d+(\.\d+)?)/i); 
                let eNum = m ? m[1] : (index + 1);
                let c = (ep.url === url) ? "ep-square active" : "ep-square";
                return `<div class="${c}" onclick="loadVideo('${ep.url}')">${eNum}</div>`;
            }).join('');
        }

        renderCommentInput(episodeID); listenToComments(episodeID);

    } catch (err) { console.error(err); } finally { loader(false); }
}

window.setCommentFilter = function(sortType, btnElement) {
    document.querySelectorAll('.comment-filter-btn').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active'); window.currentCommentSort = sortType;
    if (window.currentEpID) listenToComments(window.currentEpID); 
}

function renderCommentInput(epID) {
    const container = document.getElementById('custom-comment-area');
    if(!currentUser) {
        container.innerHTML = `<div style="display: flex; gap: 12px; align-items: center;"><div style="width: 36px; height: 36px; border-radius: 50%; background: #222;"></div><div style="flex: 1; background: #1c1c1e; border: 1px solid #2c2c2e; padding: 10px 16px; border-radius: 24px; color: #888; font-size: 13px; cursor: pointer;" onclick="switchTab('developer')">Login untuk menambahkan komentar...</div></div>`;
    } else {
        container.innerHTML = `
            <div style="display: flex; gap: 12px; align-items: center;">
                <img src="${currentUser.photoURL}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;">
                <div style="flex: 1; position: relative;">
                    <input type="text" id="main-comment-input" placeholder="Tambahkan komentar..." style="width: 100%; background: #1c1c1e; border: 1px solid #2c2c2e; color: #fff; padding: 12px 45px 12px 16px; border-radius: 24px; font-size: 13px; outline: none; box-sizing: border-box;">
                    <button onclick="postComment('${epID}')" style="position: absolute; right: 6px; top: 50%; transform: translateY(-50%); background: transparent; border: none; padding: 8px; cursor: pointer; display: flex;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#3b82f6"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </button>
                </div>
            </div>`;
    }
}

window.postComment = function(epID) {
    const input = document.getElementById('main-comment-input'); const text = input.value;
    if(!text.trim() || !currentUser) return;
    db.ref('users/' + currentUser.uid).once('value').then(snap => {
        const u = snap.val();
        db.ref('comments/' + epID).push().set({ uid: currentUser.uid, nama: u.nama, foto: u.foto, role: u.role || 'Member', level: u.level || 1, teks: text, waktu: Date.now() });
        input.value = ''; addXP(10); 
    });
};

function generateCommentHtml(c, isReply = false, epID = null, parentID = null) {
    const role = c.role || 'Member'; const level = c.level || 1;
    const uidStr = c.uid ? "#" + c.uid.substring(0, 7).toUpperCase() : "#0000000";
    const timeStr = timeAgo(c.waktu || Date.now());

    let roleBadgeClass = 'badge-member'; let roleName = role;
    if(role === 'Developer') { roleBadgeClass = 'badge-dev-anim'; roleName = 'DEV'; }
    else if(role === 'Wibu Premium' || level >= 50) { roleBadgeClass = 'badge-premium-anim'; roleName = role !== 'Member' ? role : 'Wibu Premium'; }
    else if(role === 'Member') { roleName = 'Wibu Biasa'; }

    let lvlClass = 'badge-lvl-normal';
    if (level >= 100) lvlClass = 'badge-lvl-gold'; else if (level >= 50) lvlClass = 'badge-lvl-silver';

    let replyBtnHtml = '';
    if(!isReply && epID && parentID) { 
        replyBtnHtml = `<div style="font-size: 12px; color: #3b82f6; font-weight: 700; cursor: pointer; margin-top: 6px; display: inline-block;" onclick="openReplyModal('${epID}', '${parentID}')">Reply</div>`;
    }

    return `
        <div class="comment-item" style="display: flex; gap: 12px; margin-bottom: ${isReply ? '15px' : '25px'};">
            <img src="${c.foto}" style="width: ${isReply ? '28px' : '36px'}; height: ${isReply ? '28px' : '36px'}; border-radius: 50%; object-fit: cover; flex-shrink: 0; margin-top: 4px;">
            <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                    <span style="font-weight: 700; font-size: ${isReply ? '12px' : '13px'}; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.nama}</span>
                    <span style="font-size: 10px; color: #888; flex-shrink: 0;">• ${timeStr}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;">
                    <span class="c-badge ${lvlClass}"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="margin-right:3px;"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg> Lvl. ${level}</span>
                    <span class="c-badge ${roleBadgeClass}">${roleName}</span>
                    <span style="font-size: 10px; color: #666; font-family: monospace; letter-spacing: 0.5px;">${uidStr}</span>
                </div>
                <div style="font-size: ${isReply ? '12px' : '13px'}; color: #d1d5db; line-height: 1.5; word-wrap: break-word;">${c.teks}</div>
                ${replyBtnHtml}
            </div>
        </div>
    `;
}

function listenToComments(epID) {
    window.currentEpID = epID;
    db.ref('comments/' + epID).on('value', snap => {
        const list = document.getElementById('comment-list-container');
        const countEl = document.getElementById('comment-count-text');
        
        if(!snap.exists()) { 
            if(countEl) countEl.innerText = "0 Comments";
            list.innerHTML = '<div style="text-align:center; padding:30px 0;"><p style="color:#555; font-size:13px;">Belum ada komentar.</p></div>'; 
            return; 
        }

        let commentsArr = [];
        snap.forEach(child => { commentsArr.push({ id: child.key, ...child.val() }); });
        
        if(countEl) { let total = commentsArr.length; countEl.innerText = total > 1000 ? (total/1000).toFixed(1) + 'K Comments' : total + ' Comments'; }

        if(window.currentCommentSort === 'new') { commentsArr.sort((a, b) => b.waktu - a.waktu); } 
        else { commentsArr.sort((a, b) => a.waktu - b.waktu); }
        
        list.innerHTML = commentsArr.map(c => generateCommentHtml(c, false, epID, c.id)).join('');
    });
}

// ==== FUNGSI REPLY BOTTOM SHEET ====
window.openReplyModal = function(epID, parentID) {
    document.getElementById('replyModalOverlay').style.display = 'block';
    document.getElementById('replyModal').style.display = 'block';
    setTimeout(() => { document.getElementById('replyModal').classList.add('show'); }, 10);

    db.ref(`comments/${epID}/${parentID}`).once('value').then(snap => {
        if(snap.exists()) document.getElementById('reply-parent-content').innerHTML = generateCommentHtml(snap.val(), false);
    });

    db.ref(`replies/${parentID}`).on('value', snap => {
        const list = document.getElementById('reply-list-container');
        if(!snap.exists()) { list.innerHTML = '<div style="font-size:12px; color:#666; padding:10px 0;">Jadilah yang pertama membalas...</div>'; return; }
        let repliesArr = []; snap.forEach(child => repliesArr.push(child.val()));
        repliesArr.sort((a, b) => a.waktu - b.waktu); 
        list.innerHTML = repliesArr.map(r => generateCommentHtml(r, true)).join('');
    });

    const inputArea = document.getElementById('reply-input-area');
    if(!currentUser) {
        inputArea.innerHTML = `<div style="text-align:center; padding:10px; color:#888; font-size:12px; cursor:pointer;" onclick="closeReplyModal(); switchTab('developer')">Login untuk membalas...</div>`;
    } else {
        inputArea.innerHTML = `
            <div style="display: flex; gap: 10px; align-items: center; margin-top: 15px;">
                <img src="${currentUser.photoURL}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                <div style="flex: 1; position: relative;">
                    <input type="text" id="reply-input-text" placeholder="Balas komentar..." style="width: 100%; background: #111; border: 1px solid #333; color: #fff; padding: 10px 40px 10px 15px; border-radius: 20px; font-size: 13px; outline: none; box-sizing: border-box;">
                    <button onclick="postReply('${parentID}')" style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%); background: transparent; border: none; padding: 6px; cursor: pointer; display: flex;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#3b82f6"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </button>
                </div>
            </div>
        `;
    }
};

window.closeReplyModal = function() {
    const modal = document.getElementById('replyModal'); modal.classList.remove('show');
    setTimeout(() => { document.getElementById('replyModalOverlay').style.display = 'none'; modal.style.display = 'none'; }, 300);
};

window.postReply = function(parentID) {
    const input = document.getElementById('reply-input-text'); const text = input.value;
    if(!text.trim() || !currentUser) return;
    db.ref('users/' + currentUser.uid).once('value').then(snap => {
        const u = snap.val();
        db.ref('replies/' + parentID).push().set({ uid: currentUser.uid, nama: u.nama, foto: u.foto, role: u.role || 'Member', level: u.level || 1, teks: text, waktu: Date.now() });
        input.value = ''; addXP(5);
    });
};

window.addEventListener('popstate', (e) => {
    const page = e.state ? e.state.page : 'home'; switchTab(page); 
    if (page === 'home' || page === 'detail') { let p = document.getElementById('video-player'); if(p) p.src = ''; }
});

document.addEventListener('DOMContentLoaded', () => { 
    updateDevUI(); history.replaceState({page: 'home'}, '', window.location.pathname); switchTab('home'); 
});
