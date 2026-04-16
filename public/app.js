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
// 2. AUTHENTICATION LOGIC
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
        updateDevUI();
    }).catch(err => {
        alert("Gagal login: " + err.message);
    });
};

window.logoutAkun = function() {
    auth.signOut().then(() => { location.reload(); });
};

// ==========================================
// 3. CORE UTILITIES & INDEXED DB
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(e => {}); });
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
    let lowText = text.toLowerCase();
    if (lowText.includes('tamat') || lowText.includes('completed')) return 'Tamat';
    if (lowText.includes('movie')) return 'Movie';
    let epMatch = text.match(/(?:episode|eps|ep)\s*(\d+(\.\d+)?)/i);
    if (epMatch) return `Eps ${epMatch[1]}`;
    let numMatch = text.match(/\d+/g);
    if (numMatch) return `Eps ${numMatch[numMatch.length - 1]}`;
    return text.substring(0, 8);
}

function addXP(amount) {
    if(!currentUser) return; 
    const userRef = db.ref('users/' + currentUser.uid);
    userRef.once('value').then(snap => {
        let data = snap.val();
        if(!data) return;
        let newExp = (data.exp || 0) + amount;
        let newLvl = Math.floor(newExp / 200) + 1; 
        userRef.update({ exp: newExp, level: newLvl });
    });
}

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

const loader = (state) => { const el = document.getElementById('loading'); if(el) state ? el.classList.remove('hidden') : el.classList.add('hidden'); };

// ==========================================
// 4. NAVIGATION & VIEWS
// ==========================================
function switchTab(tabName) {
    const views = ['home-view', 'recent-view', 'favorite-view', 'developer-view', 'detail-view', 'watch-view', 'search-view'];
    views.forEach(v => { const el = document.getElementById(v); if(el) el.classList.add('hidden'); });
    
    document.getElementById('mainNavbar').style.display = (tabName === 'home' || tabName === 'search') ? 'flex' : 'none';
    document.getElementById('bottomNav').style.display = (tabName === 'detail' || tabName === 'watch') ? 'none' : 'flex';
    
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    const activeView = document.getElementById(tabName + '-view');
    if(activeView) activeView.classList.remove('hidden');

    if (tabName === 'home') { document.getElementById('tab-home').classList.add('active'); if (document.getElementById('home-view').innerHTML.trim() === '') loadLatest(); } 
    else if (tabName === 'recent') { document.getElementById('tab-recent').classList.add('active'); loadRecentHistory(); } 
    else if (tabName === 'developer') { document.getElementById('tab-developer').classList.add('active'); updateDevUI(); }
}

// ==========================================
// 5. HOME & RECENT LOGIC
// ==========================================
function generateCardHtml(anime) {
    let epsBadge = getEpBadge(anime);
    let score = (anime.score && anime.score !== '?') ? anime.score : (Math.random() * 1.5 + 7.0).toFixed(2);
    let views = Math.floor(Math.random() * 800 + 100) + 'K';
    
    return `
    <div class="scroll-card" onclick="loadDetail('${anime.url}')">
        <div class="scroll-card-img">
            <img src="${anime.image}" alt="${anime.title}" loading="lazy">
            <div class="card-overlay"></div>
            <div class="badge-top-left">${epsBadge}</div>
            <div class="badge-top-right"><svg width="10" height="10" viewBox="0 0 24 24" fill="#facc15"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> ${score}</div>
            <div class="card-views"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> ${views}</div>
        </div>
        <div class="scroll-card-title">${anime.title}</div>
    </div>`;
}

async function loadLatest() {
    loader(true);
    const homeContainer = document.getElementById('home-view');
    try {
        let sliderData = [];
        try { const res = await fetch(`${API_BASE}/latest`); sliderData = await res.json(); } catch (e) {}

        let html = `
            <div class="premium-banner">
                <div class="premium-badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg> Premium</div>
                <div class="premium-text">Harga Mulai Dari Rp. 12.000<br>No iklan nonton sepuasnya</div>
            </div>
        `;

        const historyData = await getHistory();
        if (historyData.length > 0) {
            html += `
                <div class="header-flex"><h2>Terakhir Ditonton</h2><div class="header-action" onclick="switchTab('recent')">Lihat Lainnya <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></div></div>
                <div class="horizontal-scroll">${historyData.slice(0, 10).map(anime => generateCardHtml(anime)).join('')}</div>
            `;
        }

        if (sliderData.length > 0) {
            html += `
                <div class="header-flex"><h2>New Update Anime</h2><div class="header-action">Lihat Jadwal <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></div></div>
                <div class="anime-grid">${sliderData.slice(0, 15).map(anime => generateCardHtml(anime)).join('')}</div>
            `;
        }

        homeContainer.innerHTML = html;
    } catch (err) {} finally { loader(false); }
}

async function loadRecentHistory() {
    const container = document.getElementById('recent-view');
    const historyData = await getHistory();
    let html = `<div class="header-flex" style="padding-top:20px;"><h2>Terakhir Ditonton</h2></div><div class="anime-grid">`;
    html += historyData.map(anime => generateCardHtml(anime)).join('') + `</div>`;
    container.innerHTML = html;
}

// ==========================================
// 6. DETAIL VIEW
// ==========================================
let currentAnimeEpisodes = []; 
let currentAnimeMeta = {}; 

async function loadDetail(url) {
    history.pushState({page: 'detail'}, '', '#detail'); loader(true);
    try {
        const res = await fetch(`${API_BASE}/detail?url=${encodeURIComponent(url)}`); 
        const data = await res.json();
        currentAnimeEpisodes = data.episodes || [];
        currentAnimeMeta = { title: data.title, description: data.description };
        switchTab('detail'); 

        let score = data.info?.skor || (Math.random() * 1.5 + 7.0).toFixed(2);
        let newestEpNum = data.episodes.length > 0 ? (data.episodes[0].title.match(/\d+/)?.pop() || '1') : '?';
        saveHistory({ url: url, title: data.title, image: data.image, score: score, episode: `Eps ${newestEpNum}` });

        document.getElementById('detail-view').innerHTML = `
            <div class="detail-hero" style="background-image: url('${getHighRes(data.image)}')">
                <div class="detail-hero-overlay"></div>
                <div class="detail-hero-content">
                    <div style="background:#3b82f6; color:#fff; display:inline-block; margin-bottom:8px; padding:4px 10px; border-radius:6px; font-weight:800; font-size:11px;">Episode ${newestEpNum}</div>
                    <h1 style="font-size:22px; font-weight:800; margin:0 0 8px 0; color:#fff; line-height:1.2;">${data.title}</h1>
                    <div style="font-size: 12px; color: #ccc; margin-bottom: 20px; display:flex; align-items:center; gap:8px;">
                        <span style="color:#facc15; font-weight:700;">⭐ ${score}</span> • <span>${data.info?.tipe || 'TV'}</span> • <span>${data.info?.dirilis || '2025'}</span>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button style="flex:1; background:#3b82f6; color:#fff; border:none; padding:12px; border-radius:24px; font-weight:800; font-size:14px; display:flex; align-items:center; justify-content:center; gap:6px; cursor:pointer;" onclick="loadVideo('${data.episodes[0]?.url}')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Mulai Tonton
                        </button>
                        <button style="flex:1; background:#222; color:#fff; border:none; padding:12px; border-radius:24px; font-weight:800; font-size:14px; display:flex; align-items:center; justify-content:center; gap:6px; cursor:pointer;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg> Subscribe
                        </button>
                    </div>
                </div>
                <div class="nav-back" onclick="history.back()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></div>
            </div>

            <div style="padding: 20px 15px;">
                <h2 style="font-size: 16px; margin: 0 0 8px 0; font-weight:800; border-left: 3px solid #3b82f6; padding-left: 10px;">Sinopsis</h2>
                <p style="font-size: 13px; color: #aaa; line-height: 1.6; margin: 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${data.description}</p>
                <div style="color: #3b82f6; font-weight: 700; font-size: 13px; cursor: pointer; margin-top: 5px;">Selengkapnya ▼</div>
            </div>

            <div class="premium-banner" style="margin: 0 15px 15px 15px;">
                <div class="premium-badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg> Premium</div>
                <div class="premium-text">Harga Mulai Dari Rp. 12.000<br>No iklan nonton sepuasnya</div>
            </div>
            
            <div class="filter-bar">
                <div style="font-size:15px; font-weight:800;">Episodes (${data.episodes.length})</div>
                <div style="display:flex; gap:8px;">
                    <div class="filter-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg> Grid</div>
                    <div class="filter-btn">Sort: 99 ▼ 1</div>
                </div>
            </div>

            <div id="episode-list-detail-container"></div>
            <div style="padding-bottom: 30px;"></div>
        `;

        let watchedEps = JSON.parse(localStorage.getItem('watchedEps')) || [];
        document.getElementById('episode-list-detail-container').innerHTML = [...data.episodes].reverse().map((ep, index) => {
            let epNum = ep.title.match(/\d+/)?.pop() || (data.episodes.length - index);
            let views = Math.floor(Math.random()*200 + 50) + ',' + Math.floor(Math.random()*9) + 'K';
            let isWatched = watchedEps.includes(ep.url);
            
            return `
               <div class="ep-list-item" onclick="loadVideo('${ep.url}')">
                   <div class="ep-list-info">
                       <div class="ep-list-title">Episode ${epNum}</div>
                       <div class="ep-list-meta"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> ${views} • 27 Dec 2025</div>
                   </div>
                   <div class="ep-list-btn ${isWatched ? '' : 'locked'}">${isWatched ? 'Ditonton' : 'Buka <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>'}</div>
               </div>`;
        }).join('');
        
    } catch (err) {} finally { loader(false); }
}

// ==========================================
// 7. WATCH VIEW & COMMENTS
// ==========================================
async function loadVideo(url) {
    history.pushState({page: 'watch'}, '', '#watch'); loader(true);
    try {
        const res = await fetch(`${API_BASE}/watch?url=${encodeURIComponent(url)}`); const data = await res.json();
        switchTab('watch'); 

        let displayTitle = currentAnimeMeta.title || data.title;
        let mockViews = Math.floor(Math.random() * 200 + 10) + '.' + Math.floor(Math.random() * 999) + ' Views';
        
        let currentEpNum = currentAnimeEpisodes.find(ep => ep.url === url)?.title.match(/\d+/)?.pop() || '1';
        let episodeID = btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);

        let watchedEps = JSON.parse(localStorage.getItem('watchedEps')) || [];
        if (!watchedEps.includes(url)) { watchedEps.push(url); localStorage.setItem('watchedEps', JSON.stringify(watchedEps)); addXP(50); }

        document.getElementById('watch-view').innerHTML = `
            <div class="video-wrapper">
                <iframe id="video-player" src="${data.streams[0]?.url}" allowfullscreen></iframe>
                <div class="custom-controls" style="pointer-events: none;">
                    <div class="cc-top">
                        <div class="nav-back" onclick="history.back()" style="pointer-events: auto;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></div>
                        <button class="cc-setting-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></button>
                    </div>
                    <div class="cc-center">
                        <button class="cc-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="16 1 21 5 16 9"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path><polyline points="8 23 3 19 8 15"></polyline></svg></button>
                        <button class="cc-btn" style="width:60px; height:60px;"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>
                        <button class="cc-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg></button>
                    </div>
                    <div class="cc-bottom">
                        <span class="cc-time">20:52</span>
                        <div class="cc-progress-bg"><div class="cc-progress-fill"></div></div>
                        <span class="cc-time">24:02</span>
                        <button class="cc-setting-btn" style="pointer-events: auto;" onclick="openServerModal()">480p</button>
                        <button class="cc-setting-btn">1x</button>
                    </div>
                </div>
            </div>
            
            <div style="padding: 15px;">
                <h2 style="font-size: 16px; font-weight: 800; margin: 0 0 4px 0; line-height: 1.3;">${displayTitle}</h2>
                <div style="font-size: 12px; color: #a1a1aa; font-weight: 500;">Episode ${currentEpNum} • ${mockViews} • 16 Apr 2026</div>
            </div>

            <div class="watch-actions hide-scrollbar">
                <button class="w-btn active"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg> 6,3K</button>
                <button class="w-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg> 28</button>
                <button class="w-btn" onclick="openServerModal()" style="border: 1px solid #3b82f6; background: rgba(59, 130, 246, 0.1); color: #3b82f6;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> <span id="current-quality-text">Mega 480p</span></button>
                <button class="w-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"></path></svg></button>
            </div>

            <div style="padding: 15px;">
                <h2 style="font-size:16px; font-weight:800; margin:0;">Episode List</h2>
            </div>
            <div id="watch-episode-squares" class="ep-squares-container hide-scrollbar"></div>

            <div class="comment-section">
                <div class="comment-tabs">
                    <div class="c-tab active">Top Comment</div>
                    <div class="c-tab">Terbaru</div>
                </div>
                <div id="custom-comment-area"></div>
                <div id="comment-list-container"></div>
            </div>
        `;

        if (data.streams.length > 0) {
            document.getElementById('modal-server-list').innerHTML = data.streams.map((stream, idx) => {
                return `<button class="server-list-btn ${idx===0?'active':''}" onclick="changeServer('${stream.url}', '${stream.server}', this)"><span>${stream.server}</span> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5l10 -10"></path></svg></button>`;
            }).join('');
        }

        const epContainer = document.getElementById('watch-episode-squares');
        if (epContainer && currentAnimeEpisodes.length > 0) {
            epContainer.innerHTML = [...currentAnimeEpisodes].reverse().map((ep, index) => {
                let epNum = ep.title.match(/\d+/)?.pop() || (index + 1);
                let classNames = (ep.url === url) ? "ep-sq active" : "ep-sq";
                return `<div class="${classNames}" onclick="loadVideo('${ep.url}')">${epNum}</div>`;
            }).join('');
        }

        renderCommentInput(episodeID);
        listenToComments(episodeID);

    } catch (err) {} finally { loader(false); }
}

function renderCommentInput(epID) {
    const container = document.getElementById('custom-comment-area');
    if(!currentUser) {
        container.innerHTML = `<div style="background:#222; padding:15px; border-radius:12px; text-align:center; font-size:13px; color:#888; cursor:pointer;" onclick="switchTab('developer')">Silakan Login untuk ikut berdiskusi.</div>`;
    } else {
        container.innerHTML = `
            <div class="comment-input-area">
                <img src="${currentUser.photoURL}" class="c-avatar">
                <input type="text" id="main-comment-input" class="c-input" placeholder="Tambahkan komentar..." onkeypress="if(event.key === 'Enter') postComment('${epID}')">
            </div>
        `;
    }
}

window.postComment = function(epID) {
    const input = document.getElementById('main-comment-input');
    const text = input.value;
    if(!text.trim() || !currentUser) return;

    db.ref('users/' + currentUser.uid).once('value').then(snap => {
        const u = snap.val();
        db.ref('comments/' + epID).push().set({
            uid: currentUser.uid, nama: u.nama, foto: u.foto,
            role: u.role || 'Member', level: u.level || 1,
            teks: text, waktu: Date.now()
        });
        input.value = '';
        addXP(10); 
    });
};

function listenToComments(epID) {
    const list = document.getElementById('comment-list-container');
    db.ref('comments/' + epID).on('value', snap => {
        if(!snap.exists()) { list.innerHTML = '<p style="color:#555; text-align:center; font-size:13px; padding:20px;">Belum ada komentar.</p>'; return; }
        
        let html = '';
        snap.forEach(child => {
            const c = child.val();
            let roleClass = 'badge-biasa'; let roleLabel = 'Wibu Biasa';
            if(c.role === 'Developer') { roleClass = 'badge-dev'; roleLabel = 'Developer'; } 
            else if(c.level > 10) { roleClass = 'badge-premium'; roleLabel = 'Wibu Premium'; }

            const shortUid = "#" + (c.uid ? c.uid.substring(0, 7).toUpperCase() : "8500932");
            
            html = `
                <div class="comment-item">
                    <img src="${c.foto}" class="c-avatar">
                    <div class="c-main">
                        <div class="c-header">
                            <span class="c-name">${c.nama}</span>
                            <span class="c-time">• Baru saja</span>
                            <div class="c-badge badge-lvl"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg> Lvl. ${c.level || 1}</div>
                            <div class="c-badge ${roleClass}">${roleLabel}</div>
                            <span style="font-size:10px; color:#555;">${shortUid}</span>
                        </div>
                        <div class="c-text">${c.teks}</div>
                        <div class="c-reply">Reply</div>
                    </div>
                </div>
            ` + html;
        });
        list.innerHTML = html;
    });
}

// ==========================================
// 8. PROFILE / DEVELOPER UI
// ==========================================
function updateDevUI() {
    const container = document.getElementById('auth-check-container');
    if(!container) return;

    if(!currentUser) {
        container.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:80vh; padding: 20px; text-align:center;">
                <div style="width:80px; height:80px; border-radius:50%; background:#222; display:flex; align-items:center; justify-content:center; margin-bottom:20px; border:2px solid #333;">
                    <span style="color:#888; font-weight:800;">Akun</span>
                </div>
                <h2 style="font-size:20px; font-weight:800; margin:0 0 10px 0;">Akses Akun Animeku</h2>
                <p style="color:#888; font-size:14px; line-height:1.5; margin-bottom:30px;">Login untuk membuka fitur Level, ikut berdiskusi di kolom Komentar, dan menyimpan progress kamu.</p>
                <button onclick="loginDenganGoogle()" style="background:#fff; color:#000; border:none; padding:12px 24px; border-radius:24px; font-weight:800; font-size:14px; display:flex; align-items:center; gap:8px; cursor:pointer;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M23.52 12.2727C23.52 11.4218 23.4436 10.6036 23.3018 9.81818H12V14.4545H18.4582C18.18 15.9491 17.3345 17.2145 16.0691 18.0655V21.0545H19.9473C22.2164 18.96 23.52 15.8945 23.52 12.2727Z" fill="#4285F4"/><path fill-rule="evenodd" clip-rule="evenodd" d="M12 24C15.24 24 17.9673 22.92 19.9473 21.0545L16.0691 18.0655C15.0055 18.7855 13.6255 19.2218 12 19.2218C8.85273 19.2218 6.18545 17.0945 5.21455 14.2364H1.22182V17.3345C3.20182 21.2727 7.27636 24 12 24Z" fill="#34A853"/><path fill-rule="evenodd" clip-rule="evenodd" d="M5.21455 14.2364C4.96364 13.4836 4.82182 12.6764 4.82182 11.8473C4.82182 11.0182 4.96364 10.2109 5.21455 9.45818V6.36H1.22182C0.447273 7.90909 0 9.81818 0 11.8473C0 13.8764 0.447273 15.7855 1.22182 17.3345L5.21455 14.2364Z" fill="#FBBC05"/><path fill-rule="evenodd" clip-rule="evenodd" d="M12 4.47273C13.7673 4.47273 15.3491 5.08364 16.5927 6.27273L20.0345 2.83091C17.9564 0.894545 15.2291 0 12 0C7.27636 0 3.20182 2.72727 1.22182 6.36L5.21455 9.45818C6.18545 6.6 8.85273 4.47273 12 4.47273Z" fill="#EA4335"/></svg>
                    Lanjutkan dengan Google
                </button>
            </div>
        `;
    } else {
        db.ref('users/' + currentUser.uid).on('value', async snap => {
            const data = snap.val(); if(!data) return;
            const historyData = await getHistory();
            
            const totalMenit = historyData.length * 24; 
            const joinMonths = Math.max(1, new Date().getMonth() + 1); 
            const shortUid = "#" + currentUser.uid.substring(0, 6).toUpperCase();
            
            let roleClass = 'badge-biasa'; let roleLabel = 'Wibu Biasa';
            if(data.role === 'Developer') { roleClass = 'badge-dev'; roleLabel = 'Developer'; } 
            else if(data.level > 10) { roleClass = 'badge-premium'; roleLabel = 'Wibu Premium'; }

            let historyHtml = historyData.length > 0 ? historyData.map(item => {
                let randProgress = Math.floor(Math.random() * 80 + 20); 
                return `
                <div class="history-item" onclick="loadDetail('${item.url}')">
                    <img src="${item.image}" class="hi-img">
                    <div class="hi-info">
                        <div style="font-size:14px; font-weight:700; margin-bottom:4px; display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden;">${item.title}</div>
                        <div style="font-size:12px; color:#888;">${item.episode} • 2 hari lalu</div>
                        <div class="hi-progress"><div class="hi-fill" style="width:${randProgress}%"></div></div>
                    </div>
                </div>`;
            }).join('') : '<p style="text-align:center; color:#555; font-size:13px; margin-top:30px;">Belum ada riwayat.</p>';

            container.innerHTML = `
                <div style="display:flex; justify-content:space-between; padding:15px;">
                    <div class="nav-back" onclick="switchTab('home')" style="position:static; background:transparent; padding:0;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></div>
                    <div style="font-weight:800; font-size:18px;">Setting</div>
                    <div style="width:24px;"></div>
                </div>

                <div class="profile-header">
                    <div style="position:relative; display:inline-block; margin-bottom:10px;">
                        <img src="${data.foto}" class="profile-avatar">
                        <div style="position:absolute; bottom:0; right:0; background:#3b82f6; padding:6px; border-radius:50%; border:2px solid #0f0f0f; display:flex;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg></div>
                    </div>
                    <h2 style="font-size:22px; font-weight:800; margin:0 0 10px 0;">${data.nama}</h2>
                    <div style="display:flex; justify-content:center; gap:8px; margin-bottom:25px;">
                        <div class="c-badge ${roleClass}" style="font-size:11px; padding:4px 10px;">${roleLabel}</div>
                        <div class="c-badge badge-lvl" style="font-size:11px; padding:4px 10px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg> Lvl. ${data.level}</div>
                        <div class="c-badge badge-biasa" style="font-size:11px; padding:4px 10px;">${shortUid}</div>
                    </div>
                </div>

                <div class="profile-stats">
                    <div class="stat-box"><div class="stat-val">${totalMenit}</div><div class="stat-lbl">menit<br>menonton</div></div>
                    <div class="stat-box"><div class="stat-val">${data.exp}</div><div class="stat-lbl">jumlah<br>komentar</div></div>
                    <div class="stat-box"><div class="stat-val">${joinMonths}</div><div class="stat-lbl">bulan<br>bergabung</div></div>
                    <div class="stat-box"><div class="stat-val">0</div><div class="stat-lbl">teman</div></div>
                </div>

                <div class="profile-tabs">
                    <div class="ptab active" onclick="switchProfileTab('all', this)">All</div>
                    <div class="ptab" onclick="switchProfileTab('comments', this)">Comments</div>
                    <div class="ptab" onclick="switchProfileTab('history', this)">History</div>
                </div>

                <div id="ptab-all" class="ptab-content">${historyHtml}</div>
                <div id="ptab-comments" class="ptab-content" style="display:none;"><p style="text-align:center; color:#555; font-size:13px; margin-top:30px;">Komentar kamu akan segera muncul di sini.</p></div>
                <div id="ptab-history" class="ptab-content" style="display:none;">${historyHtml}</div>
                
                <button onclick="logoutAkun()" style="margin:20px; width:calc(100% - 40px); background:transparent; border:1px solid #333; color:#ef4444; padding:12px; border-radius:12px; font-weight:800; font-size:14px; cursor:pointer;">Keluar Akun</button>
            `;
        });
    }
}

window.switchProfileTab = function(tabName, element) {
    document.querySelectorAll('.ptab').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    document.querySelectorAll('.ptab-content').forEach(el => el.style.display = 'none');
    document.getElementById('ptab-' + tabName).style.display = 'block';
};

window.openServerModal = () => { document.getElementById('serverModalOverlay').style.display='block'; document.getElementById('serverModal').style.display='block'; setTimeout(() => document.getElementById('serverModal').classList.add('show'), 10); };
window.closeServerModal = () => { document.getElementById('serverModal').classList.remove('show'); setTimeout(() => { document.getElementById('serverModalOverlay').style.display='none'; document.getElementById('serverModal').style.display='none'; }, 300); };
window.changeServer = (url, name, btn) => { document.getElementById('video-player').src = url; document.getElementById('current-quality-text').innerText = name; document.querySelectorAll('.server-list-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); closeServerModal(); };

window.addEventListener('popstate', (e) => { switchTab(e.state ? e.state.page : 'home'); let p = document.getElementById('video-player'); if(p && (e.state?.page === 'home' || e.state?.page === 'detail')) p.src = ''; });

document.addEventListener('DOMContentLoaded', () => { 
    history.replaceState({page: 'home'}, '', window.location.pathname); 
    switchTab('home'); 
});
