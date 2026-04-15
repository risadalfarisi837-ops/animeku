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
        console.error("Login gagal: ", err);
        alert("Gagal login: " + err.message);
    });
};

window.logoutAkun = function() {
    auth.signOut().then(() => {
        alert("Berhasil keluar dari akun.");
        location.reload();
    });
};

// ==========================================
// MENGGAMBAR TAMPILAN PROFIL YANG BARU
// ==========================================
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
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M23.52 12.2727C23.52 11.4218 23.4436 10.6036 23.3018 9.81818H12V14.4545H18.4582C18.18 15.9491 17.3345 17.2145 16.0691 18.0655V21.0545H19.9473C22.2164 18.96 23.52 15.8945 23.52 12.2727Z" fill="#4285F4"/><path fill-rule="evenodd" clip-rule="evenodd" d="M12 24C15.24 24 17.9673 22.92 19.9473 21.0545L16.0691 18.0655C15.0055 18.7855 13.6255 19.2218 12 19.2218C8.85273 19.2218 6.18545 17.0945 5.21455 14.2364H1.22182V17.3345C3.20182 21.2727 7.27636 24 12 24Z" fill="#34A853"/><path fill-rule="evenodd" clip-rule="evenodd" d="M5.21455 14.2364C4.96364 13.4836 4.82182 12.6764 4.82182 11.8473C4.82182 11.0182 4.96364 10.2109 5.21455 9.45818V6.36H1.22182C0.447273 7.90909 0 9.81818 0 11.8473C0 13.8764 0.447273 15.7855 1.22182 17.3345L5.21455 14.2364Z" fill="#FBBC05"/><path fill-rule="evenodd" clip-rule="evenodd" d="M12 4.47273C13.7673 4.47273 15.3491 5.08364 16.5927 6.27273L20.0345 2.83091C17.9564 0.894545 15.2291 0 12 0C7.27636 0 3.20182 2.72727 1.22182 6.36L5.21455 9.45818C6.18545 6.6 8.85273 4.47273 12 4.47273Z" fill="#EA4335"/></svg> Lanjutkan dengan Google
                </button>
            </div>
        `;
    } else {
        db.ref('users/' + currentUser.uid).on('value', async snap => {
            const data = snap.val();
            if(!data) return;
            
            const historyData = await getHistory();
            
            // Kalkulasi Stats buatan
            const totalMenit = historyData.length * 24; // Anggap 1 eps = 24 menit
            const joinMonths = Math.max(1, new Date().getMonth() + 1); // Mock data bergabung
            const shortUid = "#" + currentUser.uid.substring(0, 6).toUpperCase();
            const displayName = data.role === 'Member' ? 'Wibu Biasa' : data.role;

            // Generate History List HTML (Dipakai untuk Tab 'All' dan 'History')
            let historyHtml = historyData.length > 0 ? historyData.map(item => {
                // Waktu relatif (contoh: '2 hari lalu')
                let timeDiff = Date.now() - item.timestamp;
                let daysAgo = Math.max(1, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
                let randProgress = Math.floor(Math.random() * 80 + 20); // Progress bar acak 20-100%
                
                return `
                <div class="profile-list-item" onclick="loadDetail('${item.url}')">
                    <div style="position:relative;">
                        <img src="${item.image}" class="pli-img">
                        <div style="position:absolute; bottom:-5px; right:-5px; background:#111; border-radius:50%; padding:2px;"><img src="${data.foto}" style="width:22px; height:22px; border-radius:50%; object-fit:cover;"></div>
                    </div>
                    <div class="pli-info">
                        <div class="pli-title">${item.title}</div>
                        <div class="pli-ep">${item.episode} • ${daysAgo} hari lalu</div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
                            <div class="pli-progress-bg"><div class="pli-progress-fill" style="width: ${randProgress}%;"></div></div>
                            <span style="font-size:11px; color:#a1a1aa; font-weight:800;">23:40</span>
                        </div>
                    </div>
                </div>`;
            }).join('') : '<p style="text-align:center; color:#555; font-size:13px; margin-top:30px;">Belum ada riwayat tontonan.</p>';

            container.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; padding-bottom:0;">
                    <button onclick="switchTab('home')" style="background:none; border:none; color:#fff; padding:0; cursor:pointer;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>
                    <span style="font-weight:900; font-size:18px;">Setting</span>
                </div>

                <div class="profile-header">
                    <div class="profile-avatar-container">
                        <img src="${data.foto}" class="profile-avatar">
                        <div class="profile-camera-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg></div>
                    </div>
                    <div class="profile-name">${data.nama}</div>
                    
                    <div class="profile-badges">
                        <span class="p-badge badge-role">${displayName}</span>
                        <span class="p-badge badge-lvl"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg> Lvl. ${data.level}</span>
                        <span class="p-badge badge-uid">${shortUid}</span>
                    </div>
                </div>

                <div class="profile-stats">
                    <div class="stat-box"><div class="stat-val">${totalMenit}</div><div class="stat-lbl">menit<br>menonton</div></div>
                    <div class="stat-box"><div class="stat-val">${data.exp}</div><div class="stat-lbl">total<br>exp point</div></div>
                    <div class="stat-box"><div class="stat-val">${joinMonths}</div><div class="stat-lbl">bulan<br>bergabung</div></div>
                    <div class="stat-box"><div class="stat-val">0</div><div class="stat-lbl">teman</div></div>
                </div>

                <div class="profile-tabs">
                    <div class="ptab active" onclick="switchProfileTab('all', this)">All</div>
                    <div class="ptab" onclick="switchProfileTab('comments', this)">Comments</div>
                    <div class="ptab" onclick="switchProfileTab('history', this)">History</div>
                </div>

                <div id="ptab-all" class="ptab-content">${historyHtml}</div>
                <div id="ptab-comments" class="ptab-content" style="display:none;"><p style="text-align:center; color:#555; font-size:13px; margin-top:30px;">Komentar kamu akan segera muncul di sini (Tahap Pengembangan).</p></div>
                <div id="ptab-history" class="ptab-content" style="display:none;">${historyHtml}</div>
                
                <button onclick="logoutAkun()" style="margin:20px; width:calc(100% - 40px); background:transparent; border:1px solid #333; color:#ef4444; padding:12px; border-radius:12px; font-weight:800; font-size:14px; cursor:pointer;">Keluar Akun</button>
            `;
        });
    }
}

// Fungsi untuk mengganti Tab di dalam Profil
window.switchProfileTab = function(tabName, element) {
    document.querySelectorAll('.ptab').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    document.querySelectorAll('.ptab-content').forEach(el => el.style.display = 'none');
    document.getElementById('ptab-' + tabName).style.display = 'block';
};

// ==========================================
// 3. CORE APP VARIABLES & INDEXED DB
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW failed:', err)); });
}

const API_BASE = '/api'; 
const DB_NAME = 'AnimekuDB';
const STORE_HISTORY = 'history';
const STORE_FAV = 'favorites';

function getHighRes(url) {
    if(!url) return '';
    try { return url.replace(/\/s\d+(-[a-zA-Z0-9]+)?\//g, '/s0/').replace(/=s\d+/g, '=s0').replace(/\?resize=\d+,\d+/g, ''); } 
    catch(e) { return url; }
}

function getEpBadge(anime) {
    let text = String(anime.episode || anime.episodes || anime.status || anime.type || '');
    if (!text || text === 'undefined' || text.trim() === '') return 'Anime';
    let lowText = text.toLowerCase();
    
    if (lowText.includes('tamat') || lowText.includes('completed')) return 'Tamat';
    if (lowText.includes('movie')) return 'Movie';
    if (lowText.includes('ongoin')) return 'Ongoing';
    
    let epMatch = text.match(/(?:episode|eps|ep)\s*(\d+(\.\d+)?)/i);
    if (epMatch) return `Eps ${epMatch[1]}`;
    
    let numMatch = text.match(/\d+/g);
    if (numMatch) return `Eps ${numMatch[numMatch.length - 1]}`;

    return text.length > 8 ? text.substring(0, 8) : text;
}

function addXP(amount) {
    if(!currentUser) return; 
    const userRef = db.ref('users/' + currentUser.uid);
    userRef.once('value').then(snap => {
        let data = snap.val();
        if(!data) return;
        
        let oldExp = data.exp || 0;
        let oldLvl = data.level || 1;
        let newExp = oldExp + amount;
        let newLvl = Math.floor(newExp / 200) + 1; 
        
        userRef.update({ exp: newExp, level: newLvl });
        
        const toast = document.getElementById('xp-toast');
        const toastText = document.getElementById('xp-toast-text');
        
        if (newLvl > oldLvl) {
            toastText.innerText = `Level Up! Level ${newLvl} 🎉`;
            toast.style.background = '#f59e0b';
        } else {
            toastText.innerText = `+${amount} XP`;
            toast.style.background = '#3b82f6';
        }
        
        toast.style.display = 'flex';
        setTimeout(() => { toast.style.display = 'none'; }, 3000);
    });
}

window.toggleLikeAction = function(btn, type) {
    let likeBtn = document.getElementById('btn-like-action');
    let dislikeBtn = document.getElementById('btn-dislike-action');
    if (type === 'like') {
        if (btn.style.color === 'rgb(59, 130, 246)' || btn.style.color === '#3b82f6') { btn.style.color = '#fff'; } 
        else { btn.style.color = '#3b82f6'; if(dislikeBtn) dislikeBtn.style.color = '#fff'; }
    } else {
        if (btn.style.color === 'rgb(239, 68, 68)' || btn.style.color === '#ef4444') { btn.style.color = '#fff'; } 
        else { btn.style.color = '#ef4444'; if(likeBtn) likeBtn.style.color = '#fff'; }
    }
};

window.toggleSynopsis = function() {
    const text = document.getElementById('detail-synopsis-text');
    const btn = document.getElementById('read-more-btn');
    if(text.classList.contains('expanded')) {
        text.classList.remove('expanded');
        btn.innerHTML = 'Selengkapnya ▼';
    } else {
        text.classList.add('expanded');
        btn.innerHTML = 'Sembunyikan ▲';
    }
};

function initDB() {
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

async function toggleFavorite(url, title, image, score, episode) {
    try {
        const database = await initDB(); const isFav = await checkFavorite(url);
        const tx = database.transaction(STORE_FAV, 'readwrite'); const store = tx.objectStore(STORE_FAV);
        const btn = document.getElementById('favBtn');
        
        if (isFav) { 
            store.delete(url); 
            if(btn) {
                btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg> Subscribe`;
                btn.style.color = '#fff';
            }
        } else { 
            store.put({url, title, image, score, episode, timestamp: Date.now()}); 
            if(btn) {
                btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg> Disubscribe`;
                btn.style.color = '#ef4444';
            }
        }
    } catch(e) {}
}

async function checkFavorite(url) {
    try {
        const database = await initDB();
        return new Promise((resolve) => { const req = database.transaction(STORE_FAV, 'readonly').objectStore(STORE_FAV).get(url); req.onsuccess = () => resolve(!!req.result); });
    } catch(e) { return false; }
}

async function getFavorites() {
    try {
        const database = await initDB();
        return new Promise((resolve) => { const req = database.transaction(STORE_FAV, 'readonly').objectStore(STORE_FAV).getAll(); req.onsuccess = () => resolve(req.result.sort((a,b) => b.timestamp - a.timestamp)); });
    } catch(e) { return []; }
}

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

const show = (id) => { const el = document.getElementById(id); if(el) el.style.display = 'block'; };
const hide = (id) => { const el = document.getElementById(id); if(el) el.style.display = 'none'; };
const loader = (state) => { const el = document.getElementById('loading'); if(el) state ? el.classList.remove('hidden') : el.classList.add('hidden'); };

function switchTab(tabName) {
    const views = ['home-view', 'recent-view', 'favorite-view', 'developer-view', 'detail-view', 'watch-view', 'search-view'];
    views.forEach(v => { const el = document.getElementById(v); if(el) el.classList.add('hidden'); });
    
    if(tabName === 'home' || tabName === 'search') { document.getElementById('mainNavbar').style.display = 'flex'; } 
    else { document.getElementById('mainNavbar').style.display = 'none'; }

    if(tabName === 'detail' || tabName === 'watch') { document.getElementById('bottomNav').style.display = 'none'; } 
    else { document.getElementById('bottomNav').style.display = 'flex'; }
    
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    const activeView = document.getElementById(tabName + '-view');
    if(activeView) activeView.classList.remove('hidden');

    if (tabName === 'home') { document.getElementById('tab-home').classList.add('active'); if (document.getElementById('home-view').innerHTML === '') loadLatest(); } 
    else if (tabName === 'recent') { document.getElementById('tab-recent').classList.add('active'); loadRecentHistory(); } 
    else if (tabName === 'favorite') { document.getElementById('tab-favorite').classList.add('active'); loadFavorites(); } 
    else if (tabName === 'developer') { document.getElementById('tab-developer').classList.add('active'); updateDevUI(); }
}

function generateCardHtml(anime) {
    let epsBadge = getEpBadge(anime);
    let scoreStr = anime.score || anime.skor || anime.rating;
    let finalScore = (scoreStr && scoreStr !== '?' && scoreStr !== '0' && scoreStr !== '') ? scoreStr : (Math.random() * 1.5 + 7.0).toFixed(2);
    const fallbackImg = "this.src='https://placehold.co/150x200/1a1a1a/3b82f6?text=Anime'";

    return `
    <div class="scroll-card" onclick="loadDetail('${anime.url}')">
        <div class="scroll-card-img">
            <img src="${anime.image}" alt="${anime.title}" loading="lazy" onerror="${fallbackImg}">
            <div class="badge-ep">${epsBadge}</div>
            <div class="badge-score"><svg width="10" height="10" viewBox="0 0 24 24" fill="#fbbf24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> ${finalScore}</div>
        </div>
        <div class="scroll-card-title">${anime.title}</div>
    </div>`;
}

function generateRecentCardHtml(anime) {
    let epsBadge = getEpBadge(anime);
    const fallbackImg = "this.src='https://placehold.co/160x90/1a1a1a/3b82f6?text=Anime'";

    return `
    <div class="recent-card" onclick="loadDetail('${anime.url}')">
        <div class="recent-img-box">
            <img src="${anime.image}" alt="${anime.title}" loading="lazy" onerror="${fallbackImg}">
            <div class="recent-overlay"></div>
            <div class="recent-ep-text">${epsBadge}</div>
        </div>
        <div class="recent-title">${anime.title}</div>
    </div>`;
}

async function loadRecentHistory() {
    const container = document.getElementById('recent-results-container'); container.innerHTML = '<div class="spinner"></div>';
    const historyData = await getHistory();
    if (!historyData || historyData.length === 0) { container.innerHTML = `<div class="empty-state"><h2>Belum ada riwayat</h2></div>`; return; }
    container.innerHTML = `<div class="anime-grid" style="margin-top:15px;">${historyData.map(anime => generateCardHtml(anime)).join('')}</div>`;
}

async function loadFavorites() {
    const container = document.getElementById('favorite-results-container'); container.innerHTML = '<div class="spinner"></div>';
    const favData = await getFavorites();
    if (!favData || favData.length === 0) { container.innerHTML = `<div class="empty-state"><h2>Belum ada Subscribe Anime</h2></div>`; return; }
    container.innerHTML = `<div class="anime-grid" style="margin-top:15px;">${favData.map(anime => generateCardHtml(anime)).join('')}</div>`;
}

async function loadLatest() {
    loader(true);
    const homeContainer = document.getElementById('home-view');
    homeContainer.innerHTML = ''; 

    try {
        let sliderData = [];
        try { const res = await fetch(`${API_BASE}/latest`); sliderData = await res.json(); } catch (e) {}

        if (sliderData && sliderData.length > 0) { renderHeroSlider(sliderData.slice(0, 10), homeContainer); } 

        const historyData = await getHistory();
        if (historyData && historyData.length > 0) {
            const histDiv = document.createElement('div');
            histDiv.innerHTML = `<div class="header-flex"><h2>Terakhir Ditonton</h2><a href="#" class="more-link" onclick="switchTab('recent')">Lihat Lainnya ></a></div><div class="horizontal-scroll" style="gap: 12px;">${historyData.slice(0, 15).map(anime => generateRecentCardHtml(anime)).join('')}</div>`;
            homeContainer.appendChild(histDiv);
        }

        const sectionPromises = HOME_SECTIONS.map(async (section) => {
            let combinedData = [];
            if (section.queries) {
                const promises = section.queries.map(q => fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`).then(res => res.json()).catch(() => []));
                const results = await Promise.all(promises);
                results.forEach(list => { if(Array.isArray(list)) combinedData = [...combinedData, ...list]; });
            }
            combinedData = removeDuplicates(combinedData, 'url');
            return { section, data: combinedData };
        });

        const loadedSections = await Promise.all(sectionPromises);

        loadedSections.forEach(({section, data}) => {
            if (data.length > 0) {
                const sectionDiv = document.createElement('div');
                const keyword = section.title.split(' ')[0];
                sectionDiv.innerHTML = `<div class="header-flex"><h2>${section.title}</h2><a href="#" class="more-link" onclick="handleSearch('${keyword}')">Lihat Lainnya ></a></div><div class="horizontal-scroll">${data.slice(0, 15).map(anime => generateCardHtml(anime)).join('')}</div>`;
                homeContainer.appendChild(sectionDiv);
            }
        });
    } catch (err) { console.error("Home loading failed", err); } finally { loader(false); }
}

function removeDuplicates(array, key) { return [ ...new Map(array.map(item => [item[key], item])).values() ]; }

function renderHeroSlider(data, container) {
    const sectionContainer = document.createElement('div'); sectionContainer.className = 'hero-section-container';
    const sliderDiv = document.createElement('div'); sliderDiv.className = 'hero-slider';
    const loopData = [...data, data[0]];
    const fallbackBanner = "this.src='https://placehold.co/800x400/1a1a1a/3b82f6?text=Anime'";

    const slidesHtml = loopData.map((anime, index) => {
        let epsBadge = getEpBadge(anime);
        return `
            <div class="hero-slide" onclick="loadDetail('${anime.url}')" style="cursor:pointer;">
                <img src="${getHighRes(anime.image)}" class="hero-bg" onerror="${fallbackBanner}" alt="${anime.title}" loading="${index === 0 ? 'eager' : 'lazy'}">
                <div class="hero-overlay"></div>
                <div class="hero-content">
                    <div class="hero-badge">${epsBadge}</div>
                    <h2 class="hero-title">${anime.title}</h2>
                    <button class="hero-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Putar</button>
                </div>
            </div>`;
    }).join('');

    sliderDiv.innerHTML = `<div class="hero-wrapper" id="heroWrapper">${slidesHtml}</div>`;
    sectionContainer.appendChild(sliderDiv);
    container.appendChild(sectionContainer);

    const wrapper = document.getElementById('heroWrapper');
    let currentSlide = 0; const totalSlides = loopData.length; let touchStartX = 0; let touchEndX = 0;

    function nextSlide() {
        if (!wrapper || document.getElementById('home-view').classList.contains('hidden')) return;
        currentSlide++; wrapper.style.transition = 'transform 0.5s ease-in-out'; wrapper.style.transform = `translateX(-${currentSlide * 100}%)`;
        if (currentSlide >= totalSlides - 1) { setTimeout(() => { if(!wrapper) return; wrapper.style.transition = 'none'; currentSlide = 0; wrapper.style.transform = `translateX(0)`; }, 500); }
    }
    function prevSlide() {
        if (!wrapper || document.getElementById('home-view').classList.contains('hidden')) return;
        if (currentSlide === 0) { wrapper.style.transition = 'none'; currentSlide = totalSlides - 1; wrapper.style.transform = `translateX(-${currentSlide * 100}%)`; wrapper.offsetHeight; }
        currentSlide--; wrapper.style.transition = 'transform 0.5s ease-in-out'; wrapper.style.transform = `translateX(-${currentSlide * 100}%)`;
    }
    function startAutoSlide() { if (sliderInterval) clearInterval(sliderInterval); sliderInterval = setInterval(nextSlide, 5000); }

    wrapper.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; if (sliderInterval) clearInterval(sliderInterval); }, {passive: true});
    wrapper.addEventListener('touchend', e => { touchEndX = e.changedTouches[0].screenX; const swipeThreshold = 50; if (touchStartX - touchEndX > swipeThreshold) nextSlide(); if (touchEndX - touchStartX > swipeThreshold) prevSlide(); startAutoSlide(); }, {passive: true});
    startAutoSlide();
}

async function handleSearch(query) {
    if (!query) { switchTab('home'); return; }
    switchTab('search'); loader(true);
    document.getElementById('tab-home').classList.add('active'); 
    
    const searchContainer = document.getElementById('search-view'); 
    try {
        const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`); const data = await res.json();
        searchContainer.innerHTML = `<div class="header-flex" style="padding-top:20px;"><h2>Pencarian: "${query}"</h2></div><div class="anime-grid">${data.map(anime => generateCardHtml(anime)).join('')}</div>`;
    } catch (err) { console.error("Search error", err); } finally { loader(false); }
}

window.openServerModal = function() {
    show('serverModalOverlay');
    show('serverModal');
    setTimeout(() => { document.getElementById('serverModal').classList.add('show'); }, 10);
};

window.closeServerModal = function() {
    const modal = document.getElementById('serverModal');
    modal.classList.remove('show');
    setTimeout(() => { hide('serverModalOverlay'); hide('serverModal'); }, 300);
};

// ==========================================
// 7. DETAIL VIEW
// ==========================================
async function loadDetail(url) {
    history.pushState({page: 'detail'}, '', '#detail'); loader(true);
    try {
        const res = await fetch(`${API_BASE}/detail?url=${encodeURIComponent(url)}`); const data = await res.json();
        currentAnimeEpisodes = data.episodes || [];
        currentAnimeMeta = { title: data.title, description: data.description };
        switchTab('detail'); 

        let scoreStr = data.info?.skor || data.info?.score || '8.25';
        const score = (scoreStr && scoreStr !== '?' && scoreStr !== '0') ? scoreStr : (Math.random() * 1.5 + 7.0).toFixed(2);
        const type = data.info?.tipe || data.info?.type || 'TV';
        const musim = data.info?.musim || data.info?.season || '';
        const rilis = data.info?.dirilis || data.info?.released || '';
        const seasonInfo = `${musim} ${rilis}`.trim() || 'Unknown';

        let newestEpUrl = data.episodes.length > 0 ? data.episodes[0].url : '';
        let newestEpNum = data.episodes.length > 0 ? `${data.episodes.length}` : '?';
        
        if (data.episodes.length > 0 && data.episodes[0].title) {
            let epMatch = data.episodes[0].title.match(/(?:Episode|Eps|Ep)\s*(\d+(\.\d+)?)/i);
            if(epMatch) { newestEpNum = epMatch[1]; }
            else {
                let nums = data.episodes[0].title.match(/\d+/g);
                if (nums) newestEpNum = nums[nums.length - 1];
            }
        }

        saveHistory({ url: url, title: data.title, image: data.image, score: score, episode: `Eps ${newestEpNum}` });

        const isFav = await checkFavorite(url); 
        const subIconHTML = isFav 
            ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`
            : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;

        document.getElementById('detail-view').innerHTML = `
            <div class="detail-hero" style="background-image: url('${getHighRes(data.image)}')">
                <div class="detail-hero-overlay"></div>
                <div class="detail-hero-content">
                    <div style="background:#3b82f6; color:#fff; display:inline-block; margin-bottom:8px; padding:6px 12px; border-radius:6px; font-weight:bold; font-size:12px;">Episode ${newestEpNum}</div>
                    <h1 style="font-size:24px; line-height:1.2; font-weight:800; margin:0 0 8px 0; color:#fff;">${data.title}</h1>
                    <div style="font-size: 13px; color: #d1d5db; margin-bottom: 20px; display:flex; align-items:center; gap:8px; font-weight:500;">
                        <span style="color:#fbbf24;">⭐ ${score}</span> • <span>${type}</span> • <span>${seasonInfo}</span>
                    </div>
                    
                    <div style="display:flex; gap:10px; width:100%;">
                        <button style="flex:1; background:#3b82f6; color:#fff; border:none; padding:12px; border-radius:24px; font-weight:800; font-size:14px; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer;" onclick="${newestEpUrl ? `loadVideo('${newestEpUrl}')` : `alert('Belum ada episode')`}">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Mulai Tonton
                        </button>
                        <button id="favBtn" onclick="toggleFavorite('${url}', '${data.title.replace(/'/g, "\\'")}', '${data.image}', '${score}', 'Eps ${newestEpNum}')" style="flex:1; background:#1c1c1e; color:${isFav ? '#ef4444' : '#fff'}; border:none; padding:12px; border-radius:24px; font-weight:800; font-size:14px; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer; transition:0.2s;">
                            ${subIconHTML} ${isFav ? 'Disubscribe' : 'Subscribe'}
                        </button>
                    </div>
                </div>
                <div class="nav-back"><button onclick="goHome()"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button></div>
            </div>

            <div style="padding: 20px;">
                <h2 style="font-size: 18px; margin: 0 0 12px 0; font-weight:bold; border-left: 4px solid #3b82f6; padding-left: 10px;">Sinopsis</h2>
                <p id="detail-synopsis-text" class="synopsis-text">${data.description || 'Tidak ada deskripsi tersedia.'}</p>
                <div id="read-more-btn" class="read-more-btn" onclick="toggleSynopsis()">Selengkapnya ▼</div>
            </div>
            
            <div style="padding: 0 20px; margin-top:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h2 style="font-size:18px; font-weight:800; margin:0;">Episode List</h2>
                </div>
                <div id="episode-list-detail-container"></div>
            </div>
            <div style="padding-bottom: 40px;"></div>
        `;

        let watchedEps = JSON.parse(localStorage.getItem('watchedEps')) || [];
        const epListContainer = document.getElementById('episode-list-detail-container');
        
        epListContainer.innerHTML = [...data.episodes].reverse().map((ep, index) => {
            let epsRaw = String(ep.title || '1'); 
            let epMatch = epsRaw.match(/(?:Episode|Eps|Ep)\s*(\d+(\.\d+)?)/i); 
            let epNum = epMatch ? epMatch[1] : (epsRaw.match(/\d+/g) ? epsRaw.match(/\d+/g).pop() : (data.episodes.length - index));
            
            let mockEpViews = `${Math.floor(Math.random()*200 + 10)},${Math.floor(Math.random()*9)}K`;
            let isActive = watchedEps.includes(ep.url);
            let btnBg = isActive ? '#3b82f6' : 'rgba(255,255,255,0.1)';
            let btnText = isActive ? 'Ditonton' : 'Buka';

            return `
               <div onclick="loadVideo('${ep.url}')" style="display:flex; justify-content:space-between; align-items:center; padding:15px 0; border-bottom:1px solid #1a1a1a; cursor:pointer;">
                   <div>
                       <div style="font-size:16px; font-weight:800; color:#fff; margin-bottom:5px;">Episode ${epNum}</div>
                       <div style="font-size:12px; color:#888; display:flex; align-items:center; gap:5px; font-weight:500;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> ${mockEpViews}</div>
                   </div>
                   <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
                       <button style="background:${btnBg}; border:none; color:#fff; font-size:13px; font-weight:800; padding:8px 20px; border-radius:20px; cursor:pointer; transition:0.2s;">${btnText}</button>
                   </div>
               </div>`;
        }).join('');
        
    } catch (err) { console.error(err); } finally { loader(false); }
}

// ==========================================
// 8. WATCH VIEW & COMMENTS SYSTEM
// ==========================================
async function loadVideo(url) {
    history.pushState({page: 'watch'}, '', '#watch'); loader(true);
    try {
        const res = await fetch(`${API_BASE}/watch?url=${encodeURIComponent(url)}`); const data = await res.json();
        switchTab('watch'); 

        let displayTitle = currentAnimeMeta.title || data.title;
        let mockViews = `${Math.floor(Math.random() * 200 + 10)}.${Math.floor(Math.random() * 999)} Views`;
        let mockDate = new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'});
        
        let currentEpNum = '1';
        let foundEp = currentAnimeEpisodes.find(ep => ep.url === url);
        if(foundEp) {
            let epMatch = foundEp.title.match(/(?:Episode|Eps|Ep)\s*(\d+(\.\d+)?)/i);
            currentEpNum = epMatch ? epMatch[1] : (foundEp.title.match(/\d+/g) ? foundEp.title.match(/\d+/g).pop() : "1");
        }

        let watchedEps = JSON.parse(localStorage.getItem('watchedEps')) || [];
        if (!watchedEps.includes(url)) { 
            watchedEps.push(url); 
            localStorage.setItem('watchedEps', JSON.stringify(watchedEps)); 
            addXP(20); 
        }

        let episodeID = btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);

        document.getElementById('watch-view').innerHTML = `
            <div class="video-container-fixed">
                <button class="watch-back-btn" onclick="backToDetail()"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>
                <iframe id="video-player" src="${data.streams.length > 0 ? data.streams[0].url : ''}" allowfullscreen></iframe>
            </div>
            
            <div style="padding: 15px 20px; display: flex; gap: 12px; align-items: center; border-bottom: 1px solid #111;">
                <div style="flex: 1;">
                    <h2 style="font-size: 16px; font-weight: 800; margin: 0 0 4px 0; line-height: 1.3;">${displayTitle}</h2>
                    <div style="font-size: 12px; color: #a1a1aa; font-weight: 500;">
                        Episode ${currentEpNum} • ${mockViews} • ${mockDate}
                    </div>
                </div>
            </div>

            <div class="hide-scrollbar" style="display: flex; gap: 8px; overflow-x: auto; padding: 15px 20px; border-bottom: 1px solid #111; align-items: center;">
                <button class="action-btn" id="btn-like-action" onclick="toggleLikeAction(this, 'like')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg> 6,3K</button>
                <button class="action-btn" id="btn-dislike-action" onclick="toggleLikeAction(this, 'dislike')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg> 28</button>
                
                <button class="action-btn" onclick="openServerModal()" style="border: 1px solid #3b82f6; background: rgba(59, 130, 246, 0.1); color: #3b82f6;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> <span id="current-quality-text">${data.streams.length > 0 ? data.streams[0].server : 'Quality'}</span></button>

                <button class="action-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"></path></svg> Download</button>
                <button class="action-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg> Share</button>
                <button class="action-btn" onclick="window.open('https://wa.me/6281315059849?text=Halo%20Admin,%20saya%20mau%20report%20video%20error%20di%20link%20berikut:%20' + encodeURIComponent(window.location.href))"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg> Report</button>
            </div>

            <div style="padding: 20px 20px 10px 20px;">
                <h2 style="font-size:18px; font-weight:800; margin:0 0 15px 0;">Episode List</h2>
                <div id="watch-episode-squares" class="hide-scrollbar" style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 10px;"></div>
            </div>

            <div class="comment-section">
                <h2 style="font-size:18px; font-weight:800; margin-bottom:15px;">Komentar Realtime</h2>
                <div id="custom-comment-area"></div>
                <div id="comment-list-container"></div>
            </div>
            <div style="padding-bottom: 40px;"></div>
        `;

        if (data.streams.length > 0) {
            const modalServerContainer = document.getElementById('modal-server-list');
            modalServerContainer.innerHTML = data.streams.map((stream, idx) => {
                let isActive = idx === 0 ? "server-list-btn active" : "server-list-btn";
                return `<button class="${isActive}" onclick="changeServer('${stream.url}', '${stream.server}', this)"><span>${stream.server}</span> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5l10 -10"></path></svg></button>`;
            }).join('');
        }

        const watchEpListContainer = document.getElementById('watch-episode-squares');
        if (watchEpListContainer && currentAnimeEpisodes.length > 0) {
            watchEpListContainer.innerHTML = [...currentAnimeEpisodes].reverse().map((ep, index) => {
                let epsRaw = String(ep.title || '1'); 
                let epMatch = epsRaw.match(/(?:Episode|Eps|Ep)\s*(\d+(\.\d+)?)/i); 
                let epNum = epMatch ? epMatch[1] : (epsRaw.match(/\d+/g) ? epsRaw.match(/\d+/g).pop() : (index + 1));
                
                let isCurrent = ep.url === url;
                let isWatched = watchedEps.includes(ep.url);
                let classNames = isCurrent ? "ep-square active" : (isWatched ? "ep-square watched" : "ep-square");
                
                return `<div class="${classNames}" onclick="loadVideo('${ep.url}')">${epNum}</div>`;
            }).join('');
        }

        renderCommentInput(episodeID);
        listenToComments(episodeID);

    } catch (err) { console.error(err); } finally { loader(false); }
}

function renderCommentInput(epID) {
    const container = document.getElementById('custom-comment-area');
    if(!currentUser) {
        container.innerHTML = `<div style="background:#111; padding:20px; border-radius:12px; text-align:center; font-size:14px; color:#888; border:1px dashed #333;">Silakan <span style="color:#3b82f6; font-weight:bold; cursor:pointer;" onclick="switchTab('developer')">Login</span> di menu Akun untuk ikut berdiskusi.</div>`;
    } else {
        container.innerHTML = `
            <div class="comment-input-box">
                <textarea id="main-comment-input" placeholder="Tulis komentar seru kamu..."></textarea>
                <div class="comment-footer">
                    <span style="font-size:11px; color:#555;">Hormati opini user lain ya!</span>
                    <button class="btn-comment" onclick="postComment('${epID}')">Kirim</button>
                </div>
            </div>
        `;
    }
}

window.postComment = function(epID) {
    const text = document.getElementById('main-comment-input').value;
    if(!text.trim() || !currentUser) return;

    db.ref('users/' + currentUser.uid).once('value').then(snap => {
        const u = snap.val();
        const newCommentRef = db.ref('comments/' + epID).push();
        newCommentRef.set({
            uid: currentUser.uid,
            nama: u.nama,
            foto: u.foto,
            role: u.role || 'Member',
            level: u.level || 1,
            teks: text,
            waktu: Date.now()
        });
        document.getElementById('main-comment-input').value = '';
        addXP(10); 
    });
};

function listenToComments(epID) {
    const list = document.getElementById('comment-list-container');
    db.ref('comments/' + epID).on('value', snap => {
        if(!snap.exists()) { list.innerHTML = '<p style="color:#555; text-align:center; padding: 20px 0; font-size:13px;">Belum ada komentar. Jadilah yang pertama!</p>'; return; }
        
        let html = '';
        snap.forEach(child => {
            const c = child.val();
            const badgeClass = c.role === 'Developer' ? 'badge-dev' : 'badge-lvl';
            const roleText = c.role === 'Developer' ? 'DEVELOPER' : `Lvl ${c.level}`;
            
            html = `
                <div class="comment-item">
                    <img src="${c.foto}" class="comment-avatar">
                    <div class="comment-content">
                        <div class="comment-header">
                            <span class="comment-name">${c.nama}</span>
                            <span class="comment-badge ${badgeClass}">${roleText}</span>
                        </div>
                        <div class="comment-text">${c.teks}</div>
                    </div>
                </div>
            ` + html; 
        });
        list.innerHTML = html;
    });
}

// ==========================================
// 9. ROUTING & CONTROLS
// ==========================================
window.changeServer = function(url, serverName, btnElement) { 
    document.getElementById('video-player').src = url; 
    document.getElementById('current-quality-text').innerText = serverName;
    document.querySelectorAll('.server-list-btn').forEach(b => { b.classList.remove('active'); }); 
    btnElement.classList.add('active'); 
    closeServerModal();
};

window.addEventListener('popstate', (e) => {
    const page = e.state ? e.state.page : 'home';
    switchTab(page); 
    if (page === 'home' || page === 'detail') {
        let player = document.getElementById('video-player');
        if(player) player.src = '';
    }
});

function goHome() { history.back(); }
function backToDetail() { history.back(); }

document.addEventListener('DOMContentLoaded', () => { 
    updateDevUI(); 
    history.replaceState({page: 'home'}, '', window.location.pathname); 
    switchTab('home'); 
});
