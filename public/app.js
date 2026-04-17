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

// ==== INJEKSI CSS PREMIUM VIA JS (TANPA BINTANG-BINTANG) ====
function injectPremiumStyles() {
    if(document.getElementById('premium-rank-styles')) document.getElementById('premium-rank-styles').remove();
    const style = document.createElement('style');
    style.id = 'premium-rank-styles';
    style.innerHTML = `
        @keyframes shimmerPremium { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }

        .c-badge, .rank-icon { position: relative; overflow: visible !important; } 

        /* ================= EMERALD ================= */
        .badge-lvl-emerald, .rank-icon-emerald { 
            box-shadow: 0 0 10px rgba(16, 185, 129, 0.5) !important; 
            background: linear-gradient(90deg, #9333ea, #10b981, #9333ea) !important; 
            background-size: 200% 100% !important; color: #fff !important; border: none !important; 
            animation: shimmerPremium 3s infinite linear !important; 
        }

        /* ================= DIAMOND ================= */
        .badge-lvl-diamond, .rank-icon-diamond { 
            box-shadow: 0 0 12px rgba(6, 182, 212, 0.6) !important; 
            background: linear-gradient(90deg, #2563eb, #06b6d4, #2563eb) !important; 
            background-size: 200% 100% !important; color: #fff !important; border: none !important; 
            animation: shimmerPremium 3s infinite linear !important; 
        }

        /* ================= MASTER ================= */
        .badge-lvl-master, .rank-icon-master { 
            box-shadow: 0 0 14px rgba(250, 204, 21, 0.6) !important; 
            background: linear-gradient(90deg, #e11d48, #f59e0b, #e11d48) !important; 
            background-size: 200% 100% !important; color: #fff !important; border: none !important; 
            animation: shimmerPremium 3s infinite linear !important; 
        }

        /* ================= MYTHIC ================= */
        .badge-lvl-mythic, .rank-icon-mythic { 
            box-shadow: 0 0 16px rgba(239, 68, 68, 0.7) !important; 
            background: linear-gradient(90deg, #ef4444, #eab308, #ef4444) !important; 
            background-size: 200% 100% !important; color: #fff !important; border: none !important; 
            animation: shimmerPremium 3s infinite linear !important; 
        }

        /* ================= GLOWING PADA FOTO PROFIL (AVATAR) ================= */
        .avatar-rank-emerald { border-color: #10b981 !important; box-shadow: 0 0 15px rgba(16,185,129,0.5) !important; }
        .avatar-rank-diamond { border-color: #06b6d4 !important; box-shadow: 0 0 15px rgba(6,182,212,0.5) !important; }
        .avatar-rank-master { border-color: #facc15 !important; box-shadow: 0 0 15px rgba(250,204,21,0.5) !important; }
        .avatar-rank-mythic { border-color: #ef4444 !important; box-shadow: 0 0 20px rgba(239,68,68,0.6) !important; }
    `;
    document.head.appendChild(style);
}
injectPremiumStyles();

auth.onAuthStateChanged(user => {
    currentUser = user;
    updateDevUI();
    if(document.getElementById('custom-comment-area')) {
        try { renderCommentInput(window.currentEpID); } catch(e) {}
    }
});

// ==== SISTEM LOGIN ANTI SPAM KLIK (Mencegah auth/cancelled-popup-request) ====
let isLoggingIn = false;
window.loginDenganGoogle = function() {
    if (isLoggingIn) return; // Cegah dobel klik
    isLoggingIn = true;
    
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
        isLoggingIn = false;
    }).catch(err => {
        // Jangan tampilkan alert jika user sendiri yang menutup tab atau kalau error tabrakan popup
        if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
            alert("Gagal login: " + err.message);
        }
        isLoggingIn = false;
    });
};

window.logoutAkun = function() {
    auth.signOut().then(() => { alert("Berhasil keluar dari akun."); location.reload(); });
};

// ==== SISTEM RANKING LEVEL ====
const RANK_TIERS = [
    { name: "Stone", minLvl: 0, maxLvl: 49, color: "rgba(168, 162, 158, 0.15)", icon: "🌑" },
    { name: "Bronze", minLvl: 50, maxLvl: 149, color: "rgba(180, 83, 9, 0.15)", icon: "🥉" },
    { name: "Silver", minLvl: 150, maxLvl: 499, color: "rgba(226, 232, 240, 0.15)", icon: "🥈" },
    { name: "Gold", minLvl: 500, maxLvl: 2499, color: "rgba(251, 191, 36, 0.15)", icon: "🥇" },
    { name: "Emerald", minLvl: 2500, maxLvl: 4999, color: "rgba(16, 185, 129, 0.15)", icon: "🔮" },
    { name: "Diamond", minLvl: 5000, maxLvl: 9999, color: "rgba(6, 182, 212, 0.25)", icon: "💎" },
    { name: "Master", minLvl: 10000, maxLvl: 19999, color: "rgba(236, 72, 153, 0.25)", icon: "👑" },
    { name: "Mythic", minLvl: 20000, maxLvl: Infinity, color: "linear-gradient(90deg, #ef4444, #eab308)", icon: "🌟" }
];

function getRankInfo(level) {
    return RANK_TIERS.find(r => level >= r.minLvl && level <= r.maxLvl) || RANK_TIERS[0];
}

// ==== MEMUAT PROFIL USER ====
function updateDevUI() {
    const container = document.getElementById('auth-check-container');
    if(!container) return;

    if(!currentUser) {
        container.innerHTML = `
            <div style="text-align:center; padding: 40px 20px;">
                <div style="width: 100px; height: 100px; border-radius: 50%; background: #1a1a1a; border: 3px solid #333; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px auto;">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
                <h2 style="font-weight:900; color:#fff;">Akses Akun Animeku</h2>
                <p style="color:#888; margin-bottom:25px; font-size:14px; line-height:1.5;">Login untuk membuka fitur Level, ikut berdiskusi di kolom Komentar, dan menyimpan progress kamu.</p>
                <button class="login-btn-google" style="display: flex; align-items: center; gap: 10px; background: #fff; color: #000; padding: 12px 20px; border-radius: 12px; font-weight: 800; border: none; width: 100%; justify-content: center; cursor: pointer; margin-top: 15px;" onclick="loginDenganGoogle()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M23.52 12.2727C23.52 11.4218 23.4436 10.6036 23.3018 9.81818H12V14.4545H18.4582C18.18 15.9491 17.3345 17.2145 16.0691 18.0655V21.0545H19.9473C22.2164 18.96 23.52 15.8945 23.52 12.2727Z" fill="#4285F4"/><path fill-rule="evenodd" clip-rule="evenodd" d="M12 24C15.24 24 17.9673 22.92 19.9473 21.0545L16.0691 18.0655C15.0055 18.7855 13.6255 19.2218 12 19.2218C8.85273 19.2218 6.18545 17.0945 5.21455 14.2364H1.22182V17.3345C3.20182 21.2727 7.27636 24 12 24Z" fill="#34A853"/><path fill-rule="evenodd" clip-rule="evenodd" d="M5.21455 14.2364C4.96364 13.4836 4.82182 12.6764 4.82182 11.8473C4.82182 11.0182 4.96364 10.2109 5.21455 9.45818V6.36H1.22182C0.447273 7.90909 0 9.81818 0 11.8473C0 13.8764 0.447273 15.7855 1.22182 17.3345L5.21455 14.2364Z" fill="#FBBC05"/><path fill-rule="evenodd" clip-rule="evenodd" d="M12 4.47273C13.7673 4.47273 15.3491 5.08364 16.5927 6.27273L20.0345 2.83091C17.9564 0.894545 15.2291 0 12 0C7.27636 0 3.20182 2.72727 1.22182 6.36L5.21455 9.45818C6.18545 6.6 8.85273 4.47273 12 4.47273Z" fill="#EA4335"/></svg> Lanjutkan dengan Google
                </button>
            </div>`;
    } else {
        container.innerHTML = '<div class="spinner" style="margin: 50px auto;"></div><p style="text-align:center; color:#888;">Menyiapkan Profil...</p>';
        
        db.ref('users/' + currentUser.uid).on('value', async snap => {
            try {
                let data = snap.val(); 
                if(!data) {
                    data = { nama: currentUser.displayName || 'Wibu', email: currentUser.email || '', foto: currentUser.photoURL || 'https://placehold.co/100', role: 'Member', level: 1, exp: 0 };
                    await db.ref('users/' + currentUser.uid).set(data);
                }
                
                let historyData = [];
                try { historyData = await getHistory(); } catch(e) {}
                
                const totalMenit = (historyData.length || 0) * 24; 
                const jamNonton = Math.floor(totalMenit / 60);
                const joinMonths = Math.max(1, new Date().getMonth() + 1);
                
                const role = data.role || 'Member';
                const level = data.level || 1;
                const exp = data.exp || 0;
                const userName = data.nama || 'User Animeku';
                const userFoto = data.foto || 'https://placehold.co/100';
                const shortUid = "#" + currentUser.uid.substring(0, 6).toUpperCase();

                let roleBadgeClass = 'badge-member'; let roleName = role;
                if(role === 'Developer') { roleBadgeClass = 'badge-dev-anim'; roleName = 'DEV'; }
                else if(role === 'Wibu Premium' || level >= 50) { roleBadgeClass = 'badge-premium-anim'; roleName = role !== 'Member' ? role : 'Wibu Premium'; }
                else if(role === 'Member') { roleName = 'Wibu Biasa'; }

                const rankInfo = getRankInfo(level);
                let lvlClass = `badge-lvl-${rankInfo.name.toLowerCase()}`;
                
                let avatarClass = `avatar-rank-${rankInfo.name.toLowerCase()}`;

                let historyHtml = (historyData && historyData.length > 0) ? historyData.map(item => {
                    let timeDiff = Date.now() - item.timestamp;
                    let daysAgo = Math.max(1, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
                    let randProgress = Math.floor(Math.random() * 80 + 20);
                    return `
                    <div class="profile-list-item" onclick="loadDetail('${item.url}')">
                        <div style="position:relative;">
                            <img src="${item.image}" class="pli-img">
                            <div style="position:absolute; bottom:-5px; right:-5px; background:#111; border-radius:50%; padding:2px;"><img src="${userFoto}" style="width:22px; height:22px; border-radius:50%; object-fit:cover;"></div>
                        </div>
                        <div class="pli-info">
                            <div class="pli-title">${item.title}</div>
                            <div class="pli-ep">${item.episode || 'Episode ?'} • ${daysAgo} hari lalu</div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
                                <div class="pli-progress-bg"><div class="pli-progress-fill" style="width: ${randProgress}%;"></div></div>
                                <span style="font-size:11px; color:#a1a1aa; font-weight:800;">23:40</span>
                            </div>
                        </div>
                    </div>`;
                }).join('') : '<p style="text-align:center; color:#555; font-size:13px; margin-top:30px;">Belum ada riwayat tontonan.</p>';

                let userCommentsHtml = '<div class="spinner" style="margin: 30px auto;"></div>';
                let totalKomentar = 0;
                
                db.ref('comments').once('value').then(commentsSnap => {
                    let allUserComments = [];
                    commentsSnap.forEach(epSnap => {
                        epSnap.forEach(commentSnap => {
                            let cData = commentSnap.val();
                            if(cData.uid === currentUser.uid) {
                                allUserComments.push({ id: commentSnap.key, epID: epSnap.key, ...cData });
                            }
                        });
                    });
                    
                    totalKomentar = allUserComments.length;
                    document.getElementById('stat-komentar-val').innerText = totalKomentar;
                    
                    if(allUserComments.length === 0) {
                        document.getElementById('ptab-comments').innerHTML = '<p style="text-align:center; color:#555; font-size:13px; margin-top:30px;">Kamu belum pernah berkomentar.</p>';
                    } else {
                        allUserComments.sort((a, b) => b.waktu - a.waktu);
                        let commentsHtml = allUserComments.map(c => {
                            let d = new Date(c.waktu || Date.now());
                            let months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
                            let exactDateStr = `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
                            
                            let aTitle = c.animeTitle || 'Anime Tidak Diketahui';
                            let aImage = c.animeImage || 'https://placehold.co/100';
                            let aEp = c.animeEp || 'Episode ?';
                            let actionUrl = c.url ? `loadDetail('${c.url}')` : `alert('Komentar ini ada di Episode ID: ${c.epID}')`;

                            return `
                                <div style="margin-bottom: 25px; padding: 0 5px;">
                                    <div style="display: flex; gap: 12px; margin-bottom: 10px; align-items: center; cursor: pointer;" onclick="${actionUrl}">
                                        <div style="position:relative; flex-shrink:0;">
                                            <img src="${aImage}" style="width:48px; height:48px; border-radius:10px; object-fit:cover; border: 1px solid #222;">
                                            <div style="position:absolute; bottom:-4px; right:-4px; background:#050505; border-radius:50%; padding:2px;">
                                                <img src="${userFoto}" style="width:16px; height:16px; border-radius:50%; object-fit:cover;">
                                            </div>
                                        </div>
                                        <div style="flex: 1; min-width: 0;">
                                            <div style="font-weight: 800; font-size: 14px; color: #fff; margin-bottom: 3px; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;">${aTitle}</div>
                                            <div style="font-size: 12px; color: #a1a1aa; font-weight: 500;">${aEp} • ${exactDateStr}</div>
                                        </div>
                                    </div>
                                    <div style="font-size: 14px; color: #fff; line-height: 1.5; margin-bottom: 8px; word-wrap: break-word; padding-right: 10px;">
                                        ${c.teks}
                                    </div>
                                    <div style="font-size: 13px; color: #3b82f6; font-weight: 700; cursor: pointer; display: inline-block;" onclick="${actionUrl}">Reply</div>
                                </div>
                            `;
                        }).join('');
                        document.getElementById('ptab-comments').innerHTML = commentsHtml;
                    }
                }).catch(() => {
                    document.getElementById('ptab-comments').innerHTML = '<p style="text-align:center; color:#ef4444; font-size:13px; margin-top:30px;">Gagal memuat riwayat komentar.</p>';
                });

                container.innerHTML = `
                    <div class="profile-header">
                        <div class="profile-avatar-container">
                            <img src="${userFoto}" class="profile-avatar ${avatarClass}">
                            <div class="profile-camera-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg></div>
                        </div>
                        <div class="profile-name">${userName}</div>
                        <div class="profile-badges" style="display:flex; gap:8px; justify-content:center; align-items:center; cursor:pointer;" onclick="openLevelModal(${level}, ${exp}, ${jamNonton})">
                            <span class="c-badge ${roleBadgeClass}" style="font-size:11px; padding:4px 10px;">${roleName}</span>
                            <span class="c-badge ${lvlClass}" style="font-size:11px; padding:4px 10px;">${rankInfo.icon} Lvl. ${level}</span>
                            <span class="c-badge" style="font-size:11px; padding:4px 10px; background: rgba(255,255,255,0.05); color: #a1a1aa; border: 1px solid rgba(255,255,255,0.1);">${shortUid}</span>
                        </div>
                    </div>
                    <div class="profile-stats">
                        <div class="stat-box"><div class="stat-val">${totalMenit}</div><div class="stat-lbl">menit<br>menonton</div></div>
                        <div class="stat-box"><div class="stat-val" id="stat-komentar-val">...</div><div class="stat-lbl">jumlah<br>komentar</div></div>
                        <div class="stat-box"><div class="stat-val">${joinMonths}</div><div class="stat-lbl">bulan<br>bergabung</div></div>
                    </div>
                    <div class="profile-tabs">
                        <div class="ptab active" onclick="switchProfileTab('all', this)">All</div>
                        <div class="ptab" onclick="switchProfileTab('comments', this)">Comments</div>
                        <div class="ptab" onclick="switchProfileTab('history', this)">History</div>
                    </div>
                    <div id="ptab-all" class="ptab-content">${historyHtml}</div>
                    <div id="ptab-comments" class="ptab-content" style="display:none; padding-top: 10px;">${userCommentsHtml}</div>
                    <div id="ptab-history" class="ptab-content" style="display:none;">${historyHtml}</div>
                    <button onclick="logoutAkun()" style="margin:20px; width:calc(100% - 40px); background:transparent; border:1px solid #333; color:#ef4444; padding:12px; border-radius:12px; font-weight:800; font-size:14px; cursor:pointer;">Keluar Akun</button>
                `;
            } catch(errorProfile) {
                console.error(errorProfile);
                container.innerHTML = `<div style="text-align:center; padding: 40px; color:#ef4444;">Gagal memuat profil. Silakan refresh halaman.</div>`;
            }
        });
    }
}

window.openLevelModal = function(currentLvl, currentExp, jamNonton) {
    const modalOverlay = document.getElementById('levelModalOverlay');
    const modal = document.getElementById('levelModal');
    const listContainer = document.getElementById('level-modal-list');
    
    const currRank = getRankInfo(currentLvl);
    document.getElementById('level-modal-subtitle').innerText = `Level ${currentLvl} • ${currRank.name}`;
    document.getElementById('level-modal-total-exp').innerText = currentExp.toLocaleString('id-ID');
    document.getElementById('level-modal-total-time').innerText = `${jamNonton}j 0m`;

    let html = '';
    RANK_TIERS.forEach(rank => {
        let isCurrent = (currentLvl >= rank.minLvl && currentLvl <= rank.maxLvl);
        let isPassed = currentLvl > rank.maxLvl;
        
        let statusIcon = '';
        if (isCurrent) statusIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#facc15" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        else if (isPassed) statusIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        else statusIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';
        
        let bgStyle = isCurrent ? 'background: rgba(255,255,255,0.05); border-radius: 12px; padding: 15px;' : 'padding: 15px 0;';
        
        let reqText = rank.maxLvl === Infinity ? `Level ${rank.minLvl}+` : `Level ${rank.minLvl} - ${rank.maxLvl}`;
        let iconClass = `rank-icon rank-icon-${rank.name.toLowerCase()}`;

        html += `
            <div class="level-rank-item" style="${bgStyle}">
                <div class="rank-info">
                    <div class="${iconClass}" style="background: ${rank.color}; border: 1px solid ${rank.color.replace('0.15', '0.3').replace('0.25', '0.6')};">${rank.icon}</div>
                    <div>
                        <div class="rank-title" style="color: ${isCurrent ? '#facc15' : (isPassed ? '#fff' : '#888')}">${rank.name}</div>
                        <div class="rank-req">${reqText}</div>
                    </div>
                </div>
                <div class="rank-status">${statusIcon}</div>
            </div>
        `;
    });

    listContainer.innerHTML = html;

    modalOverlay.style.display = 'block';
    modal.style.display = 'flex';
    setTimeout(() => { modal.classList.add('show'); }, 10);
};

window.closeLevelModal = function() {
    const modal = document.getElementById('levelModal');
    modal.classList.remove('show');
    setTimeout(() => { document.getElementById('levelModalOverlay').style.display = 'none'; modal.style.display = 'none'; }, 300);
};

window.switchProfileTab = function(tabName, element) {
    document.querySelectorAll('.ptab').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    document.querySelectorAll('.ptab-content').forEach(el => el.style.display = 'none');
    document.getElementById('ptab-' + tabName).style.display = 'block';
};

const API_BASE = '/api'; 
const DB_NAME = 'AnimekuDB';
const STORE_HISTORY = 'history';
const STORE_FAV = 'favorites';
window.currentFavData = []; 
window.currentPlayingAnime = null; 

function getHighRes(url) { if(!url) return ''; try { return url.replace(/\/s\d+(-[a-zA-Z0-9]+)?\//g, '/s0/').replace(/=s\d+/g, '=s0'); } catch(e) { return url; } }

function removeDuplicates(array, key) {
    const seen = new Set();
    return array.filter(item => {
        if (!item || !item[key]) return false;
        if (seen.has(item[key])) return false;
        seen.add(item[key]);
        return true;
    });
}

function getEpBadge(anime) { 
    if (!anime) return 'Anime'; 
    let text = String(anime.episode || anime.episodes || anime.status || anime.type || ''); 
    if (!text || text === 'undefined' || text.trim() === '') return 'Anime'; 
    let lowText = text.toLowerCase().trim();
    if (lowText.includes('tamat') || lowText.includes('completed')) return 'Tamat';
    if (lowText.includes('movie')) return 'Movie';
    if (lowText.includes('ongoin')) return 'Ongoing';
    if (/^\d+(\.\d+)?$/.test(lowText)) return `Episode ${lowText}`;
    let epMatch = text.match(/(?:episode|eps|ep)\s*(\d+(\.\d+)?)/i); 
    if (epMatch) return `Episode ${epMatch[1]}`; 
    let numMatch = text.match(/\d+/g);
    if (numMatch) return `Episode ${numMatch[numMatch.length - 1]}`;
    return text.length > 10 ? text.substring(0, 10) : text; 
}

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
        
        let prevExp = d.exp || 0;
        let prevLvl = Math.floor(prevExp / 200) + 1;
        
        let nExp = prevExp + amount; 
        let nLvl = Math.floor(nExp / 200) + 1; 
        let isLevelUp = nLvl > prevLvl;
        
        db.ref('users/' + currentUser.uid).update({ exp: nExp, level: nLvl });
        
        let currentLevelXp = nExp % 200;
        let progressPercent = Math.floor((currentLevelXp / 200) * 100);

        showXPModal(amount, nLvl, progressPercent, isLevelUp);
    });
}

function showXPModal(addedAmount, level, progress, isLevelUp) {
    const overlay = document.getElementById('xp-modal-overlay');
    const card = document.getElementById('xp-modal-card');
    const titleText = document.getElementById('xp-title-text');
    const amountText = document.getElementById('xp-amount-text');
    const levelText = document.getElementById('xp-level-text');
    const progressText = document.getElementById('xp-progress-text');
    const progressFill = document.getElementById('xp-progress-fill');

    amountText.innerText = `+${addedAmount}`;
    levelText.innerText = `Level ${level}`;
    progressText.innerText = `${progress}%`;
    progressFill.style.width = `${progress}%`;
    
    if (isLevelUp) {
        titleText.innerText = "LEVEL UP!";
        titleText.style.color = "#3b82f6";
    } else {
        titleText.innerText = "EXP Gained";
        titleText.style.color = "#fff";
    }
    
    overlay.style.display = 'flex'; 
    setTimeout(() => { 
        overlay.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    }, 10);
    
    setTimeout(() => { 
        overlay.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        setTimeout(() => { overlay.style.display = 'none'; }, 300); 
    }, 2500);
}

function initDB() { return new Promise((res, rej) => { const req = indexedDB.open(DB_NAME, 2); req.onupgradeneeded = (e) => { const d = e.target.result; if (!d.objectStoreNames.contains(STORE_HISTORY)) d.createObjectStore(STORE_HISTORY, { keyPath: 'url' }); if (!d.objectStoreNames.contains(STORE_FAV)) d.createObjectStore(STORE_FAV, { keyPath: 'url' }); }; req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
async function saveHistory(a) { try { const d = await initDB(); a.timestamp = Date.now(); d.transaction(STORE_HISTORY, 'readwrite').objectStore(STORE_HISTORY).put(a); } catch(e) { console.error(e); } }
async function getHistory() { try { const d = await initDB(); return new Promise((res) => { const req = d.transaction(STORE_HISTORY, 'readonly').objectStore(STORE_HISTORY).getAll(); req.onsuccess = () => res(req.result.sort((a,b) => b.timestamp - a.timestamp)); req.onerror = () => res([]); }); } catch(e) { return []; } }
async function getFavorites() { try { const d = await initDB(); return new Promise((res) => { const req = d.transaction(STORE_FAV, 'readonly').objectStore(STORE_FAV).getAll(); req.onsuccess = () => res(req.result.sort((a,b) => b.timestamp - a.timestamp)); req.onerror = () => res([]); }); } catch(e) { return []; } }

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
    } catch(e) { console.error(e); }
}
async function checkFavorite(url) { try { const database = await initDB(); return new Promise((res) => { const req = database.transaction(STORE_FAV, 'readonly').objectStore(STORE_FAV).get(url); req.onsuccess = () => res(!!req.result); req.onerror = () => res(false); }); } catch(e) { return false; } }

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
    if(text.classList.contains('expanded')) { text.classList.remove('expanded'); btn.innerHTML = 'Selengkapnya ▼'; } 
    else { text.classList.add('expanded'); btn.innerHTML = 'Sembunyikan ▲'; }
};

const HOME_SECTIONS = [
    { title: "Action Anime", queries: ["action", "kimetsu", "jujutsu", "piece"] },
    { title: "Romance & Drama", queries: ["romance", "kanojo", "gotoubun"] },
    { title: "Sci-Fi Anime", queries: ["sci-fi", "science", "dr. stone"] },
    { title: "Comedy Anime", queries: ["comedy", "spy", "bocchi", "kaguya"] },
    { title: "Fantasy Anime", queries: ["fantasy", "magic", "maou", "elf"] },
    { title: "Isekai Anime", queries: ["isekai", "slime", "mushoku"] },
    { title: "School Anime", queries: ["school", "classroom", "academy"] },
    { title: "Movie Anime", queries: ["movie", "film"] }
];

let sliderInterval;
const show = (id) => { const el = document.getElementById(id); if(el) el.style.display = 'block'; };
const hide = (id) => { const el = document.getElementById(id); if(el) el.style.display = 'none'; };
const loader = (state) => { const el = document.getElementById('loading'); if(el) state ? el.classList.remove('hidden') : el.classList.add('hidden'); };

function switchTab(tabName) {
    ['home-view', 'recent-view', 'favorite-view', 'developer-view', 'detail-view', 'watch-view', 'search-view'].forEach(v => {
        let el = document.getElementById(v);
        if(el) el.classList.add('hidden');
    });
    
    document.getElementById('mainNavbar').style.display = (tabName === 'home' || tabName === 'search') ? 'flex' : 'none';
    document.getElementById('bottomNav').style.display = (tabName === 'detail' || tabName === 'watch') ? 'none' : 'flex';
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    
    let targetView = document.getElementById(tabName + '-view');
    if(targetView) targetView.classList.remove('hidden');
    
    let targetNav = document.getElementById('tab-' + tabName);
    if(targetNav) targetNav.classList.add('active');
    
    if (tabName === 'home' && document.getElementById('home-view').innerHTML === '') loadLatest();
    if (tabName === 'recent') loadRecentHistory();
    if (tabName === 'favorite') loadFavorites();
}

function generateCardHtml(anime) {
    let epsBadge = getEpBadge(anime); let scoreStr = anime.score || anime.skor || anime.rating;
    let finalScore = (scoreStr && scoreStr !== '?' && scoreStr !== '0' && scoreStr !== '') ? scoreStr : (Math.random() * 1.5 + 7.0).toFixed(2);
    const fallbackImg = "this.src='https://placehold.co/150x200/1a1a1a/3b82f6?text=Anime'";
    return `<div class="scroll-card" onclick="loadDetail('${anime.url}')"><div class="scroll-card-img"><img src="${anime.image}" alt="${anime.title}" loading="lazy" onerror="${fallbackImg}"><div class="badge-ep">${epsBadge}</div><div class="badge-score"><svg width="10" height="10" viewBox="0 0 24 24" fill="#fbbf24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> ${finalScore}</div></div><div class="scroll-card-title">${anime.title}</div></div>`;
}

function generateRecentCardHtml(anime) {
    let epsBadge = getEpBadge(anime); const fallbackImg = "this.src='https://placehold.co/160x90/1a1a1a/3b82f6?text=Anime'";
    return `<div class="recent-card" onclick="loadDetail('${anime.url}')"><div class="recent-img-box"><img src="${anime.image}" alt="${anime.title}" loading="lazy" onerror="${fallbackImg}"><div class="recent-overlay"></div><div class="recent-ep-text">${epsBadge}</div></div><div class="recent-title">${anime.title}</div></div>`;
}

function generateFavCardHtml(anime) {
    if (!anime) return '';
    let epsBadge = getEpBadge(anime);
    let scoreStr = anime.score || anime.skor || anime.rating || '?';
    let finalScore = (scoreStr && scoreStr !== '?' && scoreStr !== '0' && scoreStr !== '') ? scoreStr : (Math.random() * 1.5 + 7.0).toFixed(2);
    const fallbackImg = "this.src='https://placehold.co/150x200/1a1a1a/3b82f6?text=Anime'";
    return `<div class="fav-card" onclick="loadDetail('${anime.url}')"><div class="fav-card-img"><img src="${anime.image}" alt="${anime.title}" loading="lazy" onerror="${fallbackImg}"><div class="fav-overlay"></div><div class="fav-ep">${epsBadge}</div><div class="fav-score"><svg width="10" height="10" viewBox="0 0 24 24" fill="#fbbf24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> ${finalScore}</div></div><div class="fav-title">${anime.title}</div></div>`;
}

async function fetchTimeout(url, timeoutMs = 15000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return res;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

// ==== FUNGSI LOADING BATCH (SEMI PARALEL) BIAR NGEBUT TAPI AMAN ====
async function loadLatest() {
    loader(true); 
    const homeContainer = document.getElementById('home-view'); 
    homeContainer.innerHTML = ''; 
    let hasAnyData = false;
    
    try {
        try {
            let sliderData = []; 
            const res = await fetchTimeout(`${API_BASE}/latest`, 15000); 
            if (res && res.ok) {
                sliderData = await res.json();
                if (sliderData && sliderData.length > 0) { 
                    renderHeroSlider(sliderData.slice(0, 20), homeContainer); 
                    hasAnyData = true;
                } 
            }
        } catch (e) {}
        
        try {
            const historyData = await getHistory();
            if (historyData && historyData.length > 0) {
                const histDiv = document.createElement('div');
                histDiv.innerHTML = `<div class="header-flex"><h2>Terakhir Ditonton</h2><span class="more-link" onclick="switchTab('recent')">Lihat Lainnya ></span></div><div class="horizontal-scroll" style="gap: 12px;">${historyData.slice(0, 15).map(anime => generateRecentCardHtml(anime)).join('')}</div>`;
                homeContainer.appendChild(histDiv);
                hasAnyData = true;
            }
        } catch (e) {}
        
        loader(false); 

        // Bikin kerangka container dulu biar rapi di layar
        const sectionContainers = [];
        for (const section of HOME_SECTIONS) {
            const div = document.createElement('div');
            div.innerHTML = `<div class="header-flex"><h2>${section.title}</h2></div><div class="horizontal-scroll" style="padding: 0 15px;"><div style="width:100%; height:160px; border-radius:8px; background:#111; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#666; font-size:12px; border:1px dashed #333;"><div style="width:24px; height:24px; border:3px solid rgba(255,255,255,0.1); border-left-color:#3b82f6; border-radius:50%; animation:spin 1s linear infinite; margin-bottom:8px;"></div>Memuat Anime...</div></div>`;
            homeContainer.appendChild(div);
            sectionContainers.push({ section, div });
        }

        // Pecah antrean per 3 kategori sekaligus biar cepat (semi-paralel)
        const chunkArray = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
        const batches = chunkArray(sectionContainers, 3);

        for (const batch of batches) {
            await Promise.all(batch.map(async ({ section, div }) => {
                try {
                    let combinedData = [];
                    const fetchPromises = section.queries.slice(0, 4).map(async (q) => {
                        try {
                            const res = await fetchTimeout(`${API_BASE}/search?q=${encodeURIComponent(q)}`, 10000);
                            if (res && res.ok) {
                                const data = await res.json();
                                if (Array.isArray(data)) combinedData.push(...data);
                            }
                        } catch(e) {}
                    });

                    await Promise.all(fetchPromises);

                    combinedData = removeDuplicates(combinedData, 'url');
                    if (combinedData.length > 0) {
                        div.innerHTML = `<div class="header-flex"><h2>${section.title}</h2><span class="more-link" onclick="handleSearch('${section.queries[0]}')">Lihat Lainnya ></span></div><div class="horizontal-scroll">${combinedData.slice(0, 15).map(anime => generateCardHtml(anime)).join('')}</div>`;
                        hasAnyData = true;
                    } else {
                        div.remove(); 
                    }
                } catch(e) { div.remove(); }
            }));
        }

        // Jika semua API beneran gagal
        if (!hasAnyData) {
            homeContainer.innerHTML = `
                <div style="text-align:center; padding: 60px 20px; display:flex; flex-direction:column; align-items:center;">
                    <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" style="margin-bottom:15px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    <h2 style="font-size:18px; margin:0 0 8px 0; color:#fff;">Gagal Memuat Data</h2>
                    <p style="font-size:13px; color:#888; margin-bottom:20px; line-height:1.5;">Server API kamu sedang sibuk atau menolak koneksi. Silakan coba lagi nanti.</p>
                    <button onclick="loadLatest()" style="background:#3b82f6; color:#fff; border:none; padding:12px 24px; border-radius:24px; font-weight:800; cursor:pointer;">Coba Lagi</button>
                </div>
            `;
        }

    } catch (err) { 
        console.error("Home loading failed total", err);
        loader(false); 
    } 
}

function renderHeroSlider(data, container) {
    const sectionContainer = document.createElement('div'); sectionContainer.className = 'hero-section-container';
    const sliderDiv = document.createElement('div'); sliderDiv.className = 'hero-slider';
    const loopData = [...data, data[0]]; const fallbackBanner = "this.src='https://placehold.co/800x400/1a1a1a/3b82f6?text=Anime'";
    const slidesHtml = loopData.map((anime, index) => {
        return `<div class="hero-slide" onclick="loadDetail('${anime.url}')" style="cursor:pointer;"><img src="${getHighRes(anime.image)}" class="hero-bg" onerror="${fallbackBanner}" alt="${anime.title}" loading="${index === 0 ? 'eager' : 'lazy'}"><div class="hero-overlay"></div><div class="hero-content"><div class="hero-badge">${getEpBadge(anime)}</div><h2 class="hero-title">${anime.title}</h2><button class="hero-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Putar</button></div></div>`;
    }).join('');
    sliderDiv.innerHTML = `<div class="hero-wrapper" id="heroWrapper">${slidesHtml}</div>`;
    sectionContainer.appendChild(sliderDiv); container.appendChild(sectionContainer);
    const wrapper = document.getElementById('heroWrapper');
    let currentSlide = 0; const totalSlides = loopData.length; let touchStartX = 0; let touchEndX = 0;
    function nextSlide() { if (!wrapper || document.getElementById('home-view').classList.contains('hidden')) return; currentSlide++; wrapper.style.transition = 'transform 0.5s ease-in-out'; wrapper.style.transform = `translateX(-${currentSlide * 100}%)`; if (currentSlide >= totalSlides - 1) { setTimeout(() => { if(!wrapper) return; wrapper.style.transition = 'none'; currentSlide = 0; wrapper.style.transform = `translateX(0)`; }, 500); } }
    function prevSlide() { if (!wrapper || document.getElementById('home-view').classList.contains('hidden')) return; if (currentSlide === 0) { wrapper.style.transition = 'none'; currentSlide = totalSlides - 1; wrapper.style.transform = `translateX(-${currentSlide * 100}%)`; wrapper.offsetHeight; } currentSlide--; wrapper.style.transition = 'transform 0.5s ease-in-out'; wrapper.style.transform = `translateX(-${currentSlide * 100}%)`; }
    function startAutoSlide() { if (sliderInterval) clearInterval(sliderInterval); sliderInterval = setInterval(nextSlide, 5000); }
    wrapper.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; if (sliderInterval) clearInterval(sliderInterval); }, {passive: true});
    wrapper.addEventListener('touchend', e => { touchEndX = e.changedTouches[0].screenX; const swipeThreshold = 50; if (touchStartX - touchEndX > swipeThreshold) nextSlide(); if (touchEndX - touchStartX > swipeThreshold) prevSlide(); startAutoSlide(); }, {passive: true});
    startAutoSlide();
}

async function handleSearch(query) {
    if (!query) { switchTab('home'); return; }
    switchTab('search'); loader(true); document.getElementById('tab-home').classList.add('active'); 
    try { const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`); const data = await res.json(); document.getElementById('search-view').innerHTML = `<div class="header-flex" style="padding-top:20px;"><h2>Pencarian: "${query}"</h2></div><div class="anime-grid">${data.map(anime => generateCardHtml(anime)).join('')}</div>`; } catch (err) {} finally { loader(false); }
}

window.openServerModal = function() { show('serverModalOverlay'); show('serverModal'); setTimeout(() => { document.getElementById('serverModal').classList.add('show'); }, 10); };
window.closeServerModal = function() { const modal = document.getElementById('serverModal'); modal.classList.remove('show'); setTimeout(() => { hide('serverModalOverlay'); hide('serverModal'); }, 300); };
window.changeServer = function(url, serverName, btnElement) { document.getElementById('video-player').src = url; document.getElementById('current-quality-text').innerText = serverName; document.querySelectorAll('.server-list-btn').forEach(b => { b.classList.remove('active'); }); btnElement.classList.add('active'); window.closeServerModal(); };
window.handleDownload = function() { alert('Fitur Download sedang dalam tahap pengembangan! Nantikan update selanjutnya.'); };
window.handleShare = function() { if (navigator.share) { navigator.share({ title: document.title, url: window.location.href }); } else { alert('Tautan disalin: ' + window.location.href); } };

async function loadRecentHistory() {
    const container = document.getElementById('recent-results-container'); container.innerHTML = '<div class="spinner" style="margin: 50px auto;"></div>';
    try {
        const historyData = await getHistory();
        if (!historyData || historyData.length === 0) { container.innerHTML = `<div class="empty-state" style="text-align:center; padding: 50px; color:#555;"><h2>Belum ada riwayat tontonan</h2></div>`; return; }
        const groupedData = {};
        historyData.forEach(anime => { const dateLabel = formatTimelineDate(anime.timestamp); if (!groupedData[dateLabel]) groupedData[dateLabel] = []; groupedData[dateLabel].push(anime); });
        let timelineHtml = '<div class="timeline-wrapper">';
        for (const [dateLabel, animes] of Object.entries(groupedData)) {
            timelineHtml += `<div class="timeline-group"><div class="timeline-date-badge">${dateLabel}</div><div class="timeline-items">`;
            animes.forEach(anime => {
                const dateObj = new Date(anime.timestamp); const timeStr = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
                const progress = Math.floor(Math.random() * 70 + 20); const durasiMenit = 24; const currentMenit = Math.floor((progress/100) * durasiMenit);
                const currentStr = `${String(currentMenit).padStart(2, '0')}:${String(Math.floor(Math.random()*60)).padStart(2,'0')} / ${durasiMenit}:00`;
                const fallbackImg = "this.src='https://placehold.co/160x90/1a1a1a/3b82f6?text=Anime'";
                timelineHtml += `<div class="timeline-card" onclick="loadDetail('${anime.url}')"><div class="timeline-img"><img src="${anime.image}" alt="${anime.title}" onerror="${fallbackImg}"><div class="timeline-play-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div></div><div class="timeline-info"><div class="timeline-header"><div class="timeline-title">${anime.title}</div><div class="timeline-time">${timeStr}</div></div><div class="timeline-ep">${getEpBadge(anime)}</div><div class="timeline-progress-container"><div class="timeline-progress-bg"><div class="timeline-progress-fill" style="width: ${progress}%;"></div></div><div class="timeline-progress-text">${currentStr}</div></div></div></div>`;
            });
            timelineHtml += `</div></div>`;
        }
        container.innerHTML = timelineHtml + '</div>';
    } catch(e) {
        container.innerHTML = `<div style="text-align:center; padding: 50px; color:#ef4444;"><h2>Gagal memuat riwayat.</h2></div>`;
    }
}

window.toggleSortMenu = function() { const menu = document.getElementById('sort-dropdown-menu'); menu.style.display = menu.style.display === 'none' ? 'block' : 'none'; };
window.applyFavSort = function(type, label) { document.getElementById('current-sort-btn').innerHTML = `${label} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"></path></svg>`; document.getElementById('sort-dropdown-menu').style.display = 'none'; if(type === 'new') { window.currentFavData.sort((a, b) => b.timestamp - a.timestamp); } else if(type === 'az') { window.currentFavData.sort((a, b) => a.title.localeCompare(b.title)); } else if(type === 'za') { window.currentFavData.sort((a, b) => b.title.localeCompare(a.title)); } else if(type === 'rating' || type === 'popular') { window.currentFavData.sort((a, b) => parseFloat(b.score) - parseFloat(a.score)); } renderFavoritesList(); };

function renderFavoritesList() { 
    const container = document.getElementById('favorite-results-container'); 
    try {
        container.innerHTML = `<div class="anime-grid" style="grid-template-columns: repeat(3, 1fr); padding: 0 10px; gap: 12px 8px;">${window.currentFavData.map(anime => generateFavCardHtml(anime)).join('')}</div>`; 
    } catch(e) { console.error("Error render:", e); }
}

async function loadFavorites() {
    const container = document.getElementById('favorite-results-container'); 
    container.innerHTML = '<div class="spinner" style="margin: 40px auto;"></div>';
    try {
        window.currentFavData = await getFavorites(); 
        const count = window.currentFavData ? window.currentFavData.length : 0;
        const countTotal = document.getElementById('fav-total-count'); const countCompleted = document.getElementById('fav-completed-count');
        if(countTotal) countTotal.innerText = count; if(countCompleted) countCompleted.innerText = count;
        if (count === 0) { container.innerHTML = `<div style="text-align:center; padding: 50px; color:#555;"><h2>Belum ada Subscribe Anime</h2></div>`; return; }
        renderFavoritesList();
    } catch(e) {
        container.innerHTML = `<div style="text-align:center; padding: 50px; color:#ef4444;"><h2>Gagal memuat Subscribe.</h2></div>`;
    }
}

document.addEventListener('click', function(event) { 
    const btn = document.getElementById('current-sort-btn'); 
    const menu = document.getElementById('sort-dropdown-menu'); 
    if (btn && menu && !btn.contains(event.target) && !menu.contains(event.target)) { menu.style.display = 'none'; } 
});

async function loadDetail(url) {
    history.pushState({page: 'detail'}, '', '#detail'); loader(true);
    try {
        const res = await fetch(`${API_BASE}/detail?url=${encodeURIComponent(url)}`); const data = await res.json();
        
        window.currentAnimeMeta = { title: data.title, description: data.description, image: data.image, url: url };
        window.currentAnimeEpisodes = data.episodes || []; 
        switchTab('detail'); 
        let scoreStr = data.info?.skor || data.info?.score || '8.25';
        const score = (scoreStr && scoreStr !== '?' && scoreStr !== '0') ? scoreStr : (Math.random() * 1.5 + 7.0).toFixed(2);
        const type = data.info?.tipe || data.info?.type || 'TV';
        const musim = data.info?.musim || data.info?.season || ''; const rilis = data.info?.dirilis || data.info?.released || ''; const seasonInfo = `${musim} ${rilis}`.trim() || 'Unknown';
        let newestEpUrl = data.episodes.length > 0 ? data.episodes[0].url : '';
        let newestEpNum = data.episodes.length > 0 ? `${data.episodes.length}` : '?';
        if (data.episodes.length > 0 && data.episodes[0].title) { let epMatch = data.episodes[0].title.match(/(?:Episode|Eps|Ep)\s*(\d+(\.\d+)?)/i); if(epMatch) newestEpNum = epMatch[1]; else { let nums = data.episodes[0].title.match(/\d+/g); if (nums) newestEpNum = nums[nums.length - 1]; } }
        saveHistory({ url: url, title: data.title, image: data.image, score: score, episode: `Eps ${newestEpNum}` });
        const isFav = await checkFavorite(url); 
        
        document.getElementById('detail-view').innerHTML = `
            <div class="detail-hero" style="background-image: url('${getHighRes(data.image)}')">
                <div class="detail-hero-overlay"></div>
                <div class="detail-hero-content">
                    <div style="background:#3b82f6; color:#fff; display:inline-block; margin-bottom:8px; padding:6px 12px; border-radius:6px; font-weight:bold; font-size:12px;">Episode ${newestEpNum}</div>
                    <h1 style="font-size:24px; line-height:1.2; font-weight:800; margin:0 0 8px 0; color:#fff;">${data.title}</h1>
                    <div style="font-size: 13px; color: #d1d5db; margin-bottom: 20px; display:flex; align-items:center; gap:8px; font-weight:500;"><span style="color:#fbbf24;">⭐ ${score}</span> • <span>${type}</span> • <span>${seasonInfo}</span></div>
                    <div style="display:flex; gap:10px; width:100%;"><button style="flex:1; background:#3b82f6; color:#fff; border:none; padding:12px; border-radius:24px; font-weight:800; font-size:14px; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer;" onclick="${newestEpUrl ? `loadVideo('${newestEpUrl}')` : `alert('Belum ada episode')`}"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Mulai Tonton</button><button id="favBtn" onclick="toggleFavorite('${url}', '${data.title.replace(/'/g, "\\'")}', '${data.image}', '${score}', 'Eps ${newestEpNum}')" style="flex:1; background:#1c1c1e; color:${isFav ? '#ef4444' : '#fff'}; border:none; padding:12px; border-radius:24px; font-weight:800; font-size:14px; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer; transition:0.2s;"><svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? '#ef4444' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg> ${isFav ? 'Disubscribe' : 'Subscribe'}</button></div>
                </div>
                <div class="nav-back"><button onclick="goHome()"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button></div>
            </div>
            <div style="padding: 15px 12px;"><h2 style="font-size: 18px; margin: 0 0 12px 0; font-weight:bold; border-left: 4px solid #3b82f6; padding-left: 10px;">Sinopsis</h2><p id="detail-synopsis-text" class="synopsis-text">${data.description || 'Tidak ada deskripsi tersedia.'}</p><div id="read-more-btn" class="read-more-btn" onclick="toggleSynopsis()">Selengkapnya ▼</div></div>
            <div style="padding: 0 12px; margin-top:10px;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;"><h2 style="font-size:18px; font-weight:800; margin:0;">Episode List</h2></div><div id="episode-list-detail-container"></div></div>
            <div style="padding-bottom: 40px;"></div>
        `;
        let watchedEps = JSON.parse(localStorage.getItem('watchedEps')) || [];
        const epListContainer = document.getElementById('episode-list-detail-container');
        epListContainer.innerHTML = [...data.episodes].reverse().map((ep, index) => {
            let epsRaw = String(ep.title || '1'); let epMatch = epsRaw.match(/(?:Episode|Eps|Ep)\s*(\d+(\.\d+)?)/i); let epNum = epMatch ? epMatch[1] : (epsRaw.match(/\d+/g) ? epsRaw.match(/\d+/g).pop() : (data.episodes.length - index));
            let mockEpViews = `${Math.floor(Math.random()*200 + 10)},${Math.floor(Math.random()*9)}K Views • 16 Apr 2026`;
            let isActive = watchedEps.includes(ep.url); let btnBg = isActive ? '#3b82f6' : 'rgba(255,255,255,0.1)'; let btnText = isActive ? 'Ditonton' : 'Buka';
            return `<div onclick="loadVideo('${ep.url}')" style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #1a1a1a; cursor:pointer;"><div><div style="font-size:16px; font-weight:800; color:#fff; margin-bottom:5px;">Episode ${epNum}</div><div style="font-size:12px; color:#888; display:flex; align-items:center; gap:5px; font-weight:500;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> ${mockEpViews}</div></div><div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;"><button style="background:${btnBg}; border:none; color:#fff; font-size:13px; font-weight:800; padding:8px 20px; border-radius:20px; cursor:pointer; transition:0.2s;">${btnText}</button></div></div>`;
        }).join('');
    } catch (err) { console.error(err); } finally { loader(false); }
}

window.currentCommentSort = 'top';

async function loadVideo(url) {
    history.pushState({page: 'watch'}, '', '#watch'); loader(true);
    try {
        const res = await fetch(`${API_BASE}/watch?url=${encodeURIComponent(url)}`); const data = await res.json();
        switchTab('watch'); addXP(20); 
        let displayTitle = window.currentAnimeMeta?.title || data.title;
        let mockViews = `${Math.floor(Math.random() * 200 + 10)}.${Math.floor(Math.random() * 999)} Views`;
        let mockDate = new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'});
        let currentEpNum = '1';
        if(window.currentAnimeEpisodes && window.currentAnimeEpisodes.length > 0) {
            let foundEp = window.currentAnimeEpisodes.find(ep => ep.url === url);
            if(foundEp) { let epMatch = foundEp.title.match(/(?:Episode|Eps|Ep)\s*(\d+(\.\d+)?)/i); currentEpNum = epMatch ? epMatch[1] : (foundEp.title.match(/\d+/g) ? foundEp.title.match(/\d+/g).pop() : "1"); }
        }
        
        window.currentPlayingAnime = {
            title: window.currentAnimeMeta?.title || displayTitle,
            image: window.currentAnimeMeta?.image || 'https://placehold.co/100',
            ep: 'Episode ' + currentEpNum,
            url: window.currentAnimeMeta?.url || url
        };

        let watchedEps = JSON.parse(localStorage.getItem('watchedEps')) || [];
        if (!watchedEps.includes(url)) { watchedEps.push(url); localStorage.setItem('watchedEps', JSON.stringify(watchedEps)); }
        
        let episodeID = url.replace(/[^a-zA-Z0-9]/g, '_'); 
        
        document.getElementById('watch-view').innerHTML = `
            <div class="video-container-fixed"><button class="watch-back-btn" onclick="backToDetail()"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button><iframe id="video-player" src="${data.streams.length > 0 ? data.streams[0].url : ''}" allowfullscreen></iframe></div>
            <div style="padding: 15px 12px; display: flex; gap: 12px; align-items: center; border-bottom: 1px solid #111;"><div style="flex: 1;"><h2 style="font-size: 16px; font-weight: 800; margin: 0 0 4px 0; line-height: 1.3;">${displayTitle}</h2><div style="font-size: 12px; color: #a1a1aa; font-weight: 500;">Episode ${currentEpNum} • ${mockViews} • ${mockDate}</div></div></div>
            <div class="hide-scrollbar" style="display: flex; gap: 8px; overflow-x: auto; padding: 15px 12px; border-bottom: 1px solid #111; align-items: center;"><button class="action-btn" id="btn-like-action" onclick="toggleLikeAction(this, 'like')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg> 6,3K</button><button class="action-btn" id="btn-dislike-action" onclick="toggleLikeAction(this, 'dislike')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg> 28</button><button class="action-btn" onclick="openServerModal()" style="border: 1px solid #3b82f6; background: rgba(59, 130, 246, 0.1); color: #3b82f6;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> <span id="current-quality-text">${data.streams.length > 0 ? data.streams[0].server : 'Quality'}</span></button><button class="action-btn" onclick="handleDownload()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"></path></svg> Download</button><button class="action-btn" onclick="handleShare()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg> Share</button><button class="action-btn" onclick="window.open('https://wa.me/6281315059849?text=Halo%20Admin,%20saya%20mau%20report%20video%20error%20di%20link%20berikut:%20' + encodeURIComponent(window.location.href))"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg> Report</button></div>
            <div style="padding: 20px 12px 10px 12px;"><h2 style="font-size:18px; font-weight:800; margin:0 0 15px 0;">Episode List</h2><div id="watch-episode-squares" class="hide-scrollbar" style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 10px;"></div></div>
            <div class="comment-section" style="padding: 20px 12px;"><div id="comment-count-text" style="font-size:16px; font-weight:800; margin:0 0 15px 0;">0 Comments</div><div style="display: flex; gap: 10px; margin-bottom: 20px;"><button class="comment-filter-btn active" onclick="setCommentFilter('top', this)">Top Comment</button><button class="comment-filter-btn" onclick="setCommentFilter('new', this)">Terbaru</button></div><div id="custom-comment-area" style="margin-bottom: 30px;"></div><div id="comment-list-container"></div></div>
            <div style="padding-bottom: 60px;"></div>
        `;
        if (data.streams.length > 0) { const modalServerContainer = document.getElementById('modal-server-list'); modalServerContainer.innerHTML = data.streams.map((stream, idx) => { let isActive = idx === 0 ? "server-list-btn active" : "server-list-btn"; return `<button class="${isActive}" onclick="changeServer('${stream.url}', '${stream.server}', this)"><span>${stream.server}</span> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5l10 -10"></path></svg></button>`; }).join(''); }
        const watchEpListContainer = document.getElementById('watch-episode-squares');
        if (watchEpListContainer) { if (window.currentAnimeEpisodes && window.currentAnimeEpisodes.length > 0) { watchEpListContainer.innerHTML = [...window.currentAnimeEpisodes].reverse().map((ep, index) => { let m = String(ep.title || '1').match(/(?:Episode|Eps|Ep)\s*(\d+(\.\d+)?)/i); let eNum = m ? m[1] : (index + 1); let c = (ep.url === url) ? "ep-square active" : (watchedEps.includes(ep.url) ? "ep-square watched" : "ep-square"); return `<div class="${c}" onclick="loadVideo('${ep.url}')">${eNum}</div>`; }).join(''); } else { watchEpListContainer.innerHTML = `<div class="ep-square active">${currentEpNum}</div>`; } }
        window.currentEpID = episodeID; renderCommentInput(episodeID); listenToComments(episodeID);
    } catch (err) { console.error(err); } finally { loader(false); }
}

window.setCommentFilter = function(sortType, btnElement) { document.querySelectorAll('.comment-filter-btn').forEach(b => b.classList.remove('active')); btnElement.classList.add('active'); window.currentCommentSort = sortType; if (window.currentEpID) listenToComments(window.currentEpID); };

function renderCommentInput(epID) {
    const container = document.getElementById('custom-comment-area'); if(!container) return; 
    if(!currentUser) { container.innerHTML = `<div style="display: flex; gap: 12px; align-items: center;"><div style="width: 36px; height: 36px; border-radius: 50%; background: #222; display: flex; justify-content: center; align-items: center;"><svg width="16" height="16" viewBox="0 0 24 24" fill="#555"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div><div style="flex: 1; background: #1c1c1e; border: 1px solid #2c2c2e; padding: 10px 16px; border-radius: 24px; color: #888; font-size: 13px; cursor: pointer;" onclick="switchTab('developer')">Login untuk menambahkan komentar...</div></div>`; } 
    else { const userFoto = currentUser.photoURL || 'https://placehold.co/40'; container.innerHTML = `<div style="display: flex; gap: 12px; align-items: center;"><img src="${userFoto}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;"><div style="flex: 1; position: relative;"><input type="text" id="main-comment-input" placeholder="Tambahkan komentar..." style="width: 100%; background: #1c1c1e; border: 1px solid #2c2c2e; color: #fff; padding: 12px 45px 12px 16px; border-radius: 24px; font-size: 13px; outline: none; box-sizing: border-box;"><button onclick="postComment('${epID}')" style="position: absolute; right: 6px; top: 50%; transform: translateY(-50%); background: transparent; border: none; padding: 8px; cursor: pointer; display: flex;"><svg width="20" height="20" viewBox="0 0 24 24" fill="#3b82f6"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button></div></div>`; }
}

window.postComment = function(epID) { 
    const input = document.getElementById('main-comment-input'); 
    const text = input.value; 
    if(!text.trim() || !currentUser) return; 
    
    db.ref('users/' + currentUser.uid).once('value').then(snap => { 
        const u = snap.val(); 
        db.ref('comments/' + epID).push().set({ 
            uid: currentUser.uid, 
            nama: u.nama, 
            foto: u.foto, 
            role: u.role || 'Member', 
            level: u.level || 1, 
            teks: text, 
            waktu: Date.now(),
            animeTitle: window.currentPlayingAnime ? window.currentPlayingAnime.title : 'Anime Tidak Diketahui',
            animeImage: window.currentPlayingAnime ? window.currentPlayingAnime.image : 'https://placehold.co/100',
            animeEp: window.currentPlayingAnime ? window.currentPlayingAnime.ep : 'Episode ?',
            url: window.currentPlayingAnime ? window.currentPlayingAnime.url : ''
        }); 
        input.value = ''; addXP(10); 
    }); 
};

function generateCommentHtml(c, isReply = false, epID = null, parentID = null) {
    const role = c.role || 'Member'; const level = c.level || 1; const uidStr = c.uid ? "#" + c.uid.substring(0, 7).toUpperCase() : "#0000000"; const timeStr = timeAgo(c.waktu || Date.now());
    let roleBadgeClass = 'badge-member'; let roleName = role; if(role === 'Developer') { roleBadgeClass = 'badge-dev-anim'; roleName = 'DEV'; } else if(role === 'Wibu Premium' || level >= 50) { roleBadgeClass = 'badge-premium-anim'; roleName = role !== 'Member' ? role : 'Wibu Premium'; } else if(role === 'Member') { roleName = 'Wibu Biasa'; }
    const rankInfo = getRankInfo(level); let lvlClass = `badge-lvl-${rankInfo.name.toLowerCase()}`;
    let replyBtnHtml = ''; if(!isReply && epID && parentID) { replyBtnHtml = `<div style="font-size: 12px; color: #3b82f6; font-weight: 700; cursor: pointer; margin-top: 6px; display: inline-block;" onclick="openReplyModal('${epID}', '${parentID}')">Reply</div>`; }
    return `<div class="comment-item" style="display: flex; gap: 12px; margin-bottom: ${isReply ? '15px' : '25px'};"><img src="${c.foto}" style="width: ${isReply ? '28px' : '36px'}; height: ${isReply ? '28px' : '36px'}; border-radius: 50%; object-fit: cover; flex-shrink: 0; margin-top: 4px;"><div style="flex: 1; min-width: 0;"><div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;"><span style="font-weight: 700; font-size: ${isReply ? '12px' : '13px'}; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.nama}</span><span style="font-size: 10px; color: #888; flex-shrink: 0;">• ${timeStr}</span></div><div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;"><span class="c-badge ${lvlClass}">${rankInfo.icon} Lvl. ${level}</span><span class="c-badge ${roleBadgeClass}">${roleName}</span><span style="font-size: 10px; color: #666; font-family: monospace; letter-spacing: 0.5px;">${uidStr}</span></div><div style="font-size: ${isReply ? '12px' : '13px'}; color: #d1d5db; line-height: 1.5; word-wrap: break-word;">${c.teks}</div>${replyBtnHtml}</div></div>`;
}

function listenToComments(epID) { db.ref('comments/' + epID).on('value', snap => { const list = document.getElementById('comment-list-container'); const countEl = document.getElementById('comment-count-text'); if(!snap.exists()) { if(countEl) countEl.innerText = "0 Comments"; if(list) list.innerHTML = '<div style="text-align:center; padding:30px 0;"><p style="color:#555; font-size:13px;">Belum ada komentar.</p></div>'; return; } let commentsArr = []; snap.forEach(child => { commentsArr.push({ id: child.key, ...child.val() }); }); if(countEl) { let total = commentsArr.length; countEl.innerText = total > 1000 ? (total/1000).toFixed(1) + 'K Comments' : total + ' Comments'; } if(window.currentCommentSort === 'new') { commentsArr.sort((a, b) => b.waktu - a.waktu); } else { commentsArr.sort((a, b) => a.waktu - b.waktu); } if(list) list.innerHTML = commentsArr.map(c => generateCommentHtml(c, false, epID, c.id)).join(''); }); }

window.openReplyModal = function(epID, parentID) {
    document.getElementById('replyModalOverlay').style.display = 'block'; document.getElementById('replyModal').style.display = 'block'; setTimeout(() => { document.getElementById('replyModal').classList.add('show'); }, 10);
    db.ref(`comments/${epID}/${parentID}`).once('value').then(snap => { if(snap.exists()) document.getElementById('reply-parent-content').innerHTML = generateCommentHtml(snap.val(), false); });
    db.ref(`replies/${parentID}`).on('value', snap => { const list = document.getElementById('reply-list-container'); if(!snap.exists()) { list.innerHTML = '<div style="font-size:12px; color:#666; padding:10px 0;">Jadilah yang pertama membalas...</div>'; return; } let repliesArr = []; snap.forEach(child => repliesArr.push(child.val())); repliesArr.sort((a, b) => a.waktu - b.waktu); list.innerHTML = repliesArr.map(r => generateCommentHtml(r, true)).join(''); });
    const inputArea = document.getElementById('reply-input-area'); if(!currentUser) { inputArea.innerHTML = `<div style="text-align:center; padding:10px; color:#888; font-size:12px; cursor:pointer;" onclick="closeReplyModal(); switchTab('developer')">Login untuk membalas...</div>`; } else { const userFoto = currentUser.photoURL || 'https://placehold.co/40'; inputArea.innerHTML = `<div style="display: flex; gap: 10px; align-items: center; margin-top: 15px;"><img src="${userFoto}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;"><div style="flex: 1; position: relative;"><input type="text" id="reply-input-text" placeholder="Balas komentar..." style="width: 100%; background: #1c1c1e; border: 1px solid #2c2c2e; color: #fff; padding: 10px 40px 10px 15px; border-radius: 20px; font-size: 13px; outline: none; box-sizing: border-box;"><button onclick="postReply('${parentID}')" style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%); background: transparent; border: none; padding: 6px; cursor: pointer; display: flex;"><svg width="20" height="20" viewBox="0 0 24 24" fill="#3b82f6"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button></div></div>`; }
};

window.closeReplyModal = function() { const modal = document.getElementById('replyModal'); modal.classList.remove('show'); setTimeout(() => { document.getElementById('replyModalOverlay').style.display = 'none'; modal.style.display = 'none'; }, 300); };
window.postReply = function(parentID) { const input = document.getElementById('reply-input-text'); const text = input.value; if(!text.trim() || !currentUser) return; db.ref('users/' + currentUser.uid).once('value').then(snap => { const u = snap.val(); db.ref('replies/' + parentID).push().set({ uid: currentUser.uid, nama: u.nama, foto: u.foto, role: u.role || 'Member', level: u.level || 1, teks: text, waktu: Date.now() }); input.value = ''; addXP(5); }); };

window.addEventListener('popstate', (e) => { const page = e.state ? e.state.page : 'home'; switchTab(page); if (page === 'home' || page === 'detail') { let p = document.getElementById('video-player'); if(p) p.src = ''; } });
function goHome() { history.back(); }
function backToDetail() { history.back(); }

function initApp() { updateDevUI(); history.replaceState({page: 'home'}, '', window.location.pathname); switchTab('home'); }
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initApp); } else { initApp(); }
