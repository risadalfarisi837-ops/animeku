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

// ==== INJEKSI CSS PREMIUM VIA JS ====
function injectPremiumStyles() {
    if(document.getElementById('premium-rank-styles')) document.getElementById('premium-rank-styles').remove();
    const style = document.createElement('style');
    style.id = 'premium-rank-styles';
    style.innerHTML = `
        @keyframes shimmerPremium { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }

        .c-badge, .rank-icon { position: relative; overflow: visible !important; } 

        /* MATIKAN SEMUA ANIMASI BINTANG DAN GLOWING UNTUK EMERALD & MASTER */
        .rank-icon-emerald, .badge-lvl-emerald { animation: none !important; }
        .rank-icon-emerald::after, .rank-icon-emerald::before { display: none !important; content: none !important; animation: none !important; }
        
        .rank-icon-master, .badge-lvl-master { animation: none !important; }
        .rank-icon-master::before, .rank-icon-master::after { display: none !important; content: none !important; animation: none !important; }

        /* DIAMOND & MYTHIC TETAP BERANIMASI (JIKA ADA) */
        .badge-lvl-diamond, .rank-icon-diamond { box-shadow: 0 0 12px rgba(6, 182, 212, 0.6) !important; background: linear-gradient(90deg, #2563eb, #06b6d4, #2563eb) !important; background-size: 200% 100% !important; color: #fff !important; border: none !important; animation: shimmerPremium 3s infinite linear !important; }
        .badge-lvl-mythic, .rank-icon-mythic { box-shadow: 0 0 16px rgba(239, 68, 68, 0.7) !important; background: linear-gradient(90deg, #ef4444, #eab308, #ef4444) !important; background-size: 200% 100% !important; color: #fff !important; border: none !important; animation: shimmerPremium 3s infinite linear !important; }

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

let isLoggingIn = false;
window.loginDenganGoogle = function() {
    if (isLoggingIn) return; 
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
        if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
            alert("Gagal login: " + err.message);
        }
        isLoggingIn = false;
    });
};

window.logoutAkun = function() {
    auth.signOut().then(() => { alert("Berhasil keluar dari akun."); location.reload(); });
};

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

// ==== FUNGSI UNTUK MEMBUKA PROFIL USER LAIN DARI KOMENTAR ====
function injectUserProfileModal() {
    if(document.getElementById('user-profile-modal-injected')) return;
    const div = document.createElement('div');
    div.id = 'user-profile-modal-injected';
    div.innerHTML = `
        <div id="userProfileOverlay" class="modal-overlay" onclick="closeUserProfileModal()" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:999998; backdrop-filter:blur(2px);"></div>
        <div id="userProfileModal" class="bottom-sheet" style="display:none; position:fixed; bottom:0; left:0; width:100%; background:#050505; z-index:999999; border-radius:24px 24px 0 0; padding:0; flex-direction:column; max-height:85vh; transform:translateY(100%); transition:transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 -5px 20px rgba(0,0,0,0.5); border-top: 1px solid #1a1a1a;">
            <div style="padding: 15px 20px; display:flex; justify-content:flex-end; border-bottom: 1px solid #111;">
                <button onclick="closeUserProfileModal()" style="background:rgba(255,255,255,0.1); border:none; color:#fff; border-radius:50%; width:30px; height:30px; display:flex; align-items:center; justify-content:center; cursor:pointer;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
            </div>
            <div id="user-profile-content" class="hide-scrollbar" style="overflow-y:auto; flex:1; padding-bottom:20px;"></div>
        </div>
    `;
    document.body.appendChild(div);
}

window.openUserProfile = function(uid) {
    if(!uid || uid === 'undefined') return;
    injectUserProfileModal();
    const overlay = document.getElementById('userProfileOverlay');
    const modal = document.getElementById('userProfileModal');
    const content = document.getElementById('user-profile-content');
    
    overlay.style.display = 'block';
    modal.style.display = 'flex';
    setTimeout(() => { modal.classList.add('show'); }, 10);
    
    content.innerHTML = '<div class="spinner" style="margin: 50px auto;"></div>';
    
    db.ref('users/' + uid).once('value').then(async snap => {
        if(!snap.exists()) {
            content.innerHTML = '<div style="text-align:center; padding:30px; color:#888;">User tidak ditemukan.</div>';
            return;
        }
        const data = snap.val();
        const userName = data.nama || 'Wibu';
        const userFoto = data.foto || 'https://placehold.co/100';
        const role = data.role || 'Member';
        const level = data.level || 1;
        const shortUid = "#" + uid.substring(0, 6).toUpperCase();
        
        let roleBadgeClass = 'badge-member'; let roleName = role;
        if(role === 'Developer') { roleBadgeClass = 'badge-dev-anim'; roleName = 'DEV'; }
        else if(role === 'Wibu Premium' || level >= 50) { roleBadgeClass = 'badge-premium-anim'; roleName = role !== 'Member' ? role : 'Wibu Premium'; }
        else if(role === 'Member') { roleName = 'Wibu Biasa'; }

        const rankInfo = getRankInfo(level);
        let lvlClass = `badge-lvl-${rankInfo.name.toLowerCase()}`;
        let avatarClass = `avatar-rank-${rankInfo.name.toLowerCase()}`;
        
        let userComments = [];
        try {
            const commentsSnap = await db.ref('comments').once('value');
            commentsSnap.forEach(epSnap => {
                epSnap.forEach(cSnap => {
                    let c = cSnap.val();
                    if(c.uid === uid) {
                        userComments.push({ epID: epSnap.key, ...c });
                    }
                });
            });
        } catch(e) {}
        
        userComments.sort((a,b) => b.waktu - a.waktu);
        let totalKomentar = userComments.length;
        
        let commentsHtml = userComments.length > 0 ? userComments.map(c => {
            let d = new Date(c.waktu || Date.now());
            let months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
            let exactDateStr = `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
            let aTitle = c.animeTitle || 'Anime Tidak Diketahui';
            let aImage = c.animeImage || 'https://placehold.co/100';
            let actionUrl = c.url ? `loadDetail('${c.url}')` : ``;
            
            return `
                <div style="margin-bottom: 20px; padding: 0 20px; cursor: pointer;" onclick="${actionUrl}; closeUserProfileModal();">
                    <div style="display: flex; gap: 12px; margin-bottom: 8px; align-items: center;">
                        <img src="${aImage}" style="width:40px; height:40px; border-radius:8px; object-fit:cover; border: 1px solid #222;">
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 800; font-size: 13px; color: #3b82f6; margin-bottom: 2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${aTitle}</div>
                            <div style="font-size: 11px; color: #a1a1aa; font-weight: 500;">${exactDateStr}</div>
                        </div>
                    </div>
                    <div style="font-size: 13px; color: #d1d5db; line-height: 1.5; background: #111; padding: 12px; border-radius: 8px; border: 1px solid #1a1a1a;">
                        ${c.teks}
                    </div>
                </div>
            `;
        }).join('') : '<p style="text-align:center; color:#555; font-size:13px; margin-top:30px;">Belum ada aktivitas komentar.</p>';

        let totalMenit = level * 120 + Math.floor(Math.random() * 500);

        content.innerHTML = `
            <div class="profile-header" style="margin-top:-10px;">
                <div class="profile-avatar-container">
                    <img src="${userFoto}" class="profile-avatar ${avatarClass}" style="width:90px; height:90px;">
                </div>
                <div class="profile-name" style="font-size:20px;">${userName}</div>
                <div class="profile-badges" style="display:flex; gap:8px; justify-content:center; align-items:center; margin-bottom:20px;">
                    <span class="c-badge ${roleBadgeClass}">${roleName}</span>
                    <span class="c-badge ${lvlClass}">${rankInfo.icon} Lvl. ${level}</span>
                    <span class="c-badge" style="background: rgba(255,255,255,0.05); color: #a1a1aa; border: 1px solid rgba(255,255,255,0.1);">${shortUid}</span>
                </div>
            </div>
            <div class="profile-stats" style="border-bottom:none; margin-bottom:15px; padding: 0 20px;">
                <div class="stat-box"><div class="stat-val">${totalMenit}</div><div class="stat-lbl">menit<br>menonton</div></div>
                <div class="stat-box"><div class="stat-val">${totalKomentar}</div><div class="stat-lbl">jumlah<br>komentar</div></div>
                <div class="stat-box"><div class="stat-val">12</div><div class="stat-lbl">bulan<br>bergabung</div></div>
            </div>
            
            <div style="border-top: 1px solid #111; padding-top: 20px;">
                <h3 style="font-size:16px; font-weight:800; margin: 0 20px 15px 20px;">Riwayat Komentar</h3>
                ${commentsHtml}
            </div>
        `;
    });
};

window.closeUserProfileModal = function() {
    const overlay = document.getElementById('userProfileOverlay');
    const modal = document.getElementById('userProfileModal');
    if(modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            overlay.style.display = 'none';
            modal.style.display = 'none';
        }, 300);
    }
};

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

// ==== FITUR FILTER & SORT EPISODE KHUSUS HALAMAN DETAIL ====
window.epSortOrder = 'desc'; 
window.epLayoutMode = 'list'; 

window.toggleEpLayout = function() {
    window.epLayoutMode = window.epLayoutMode === 'grid' ? 'list' : 'grid';
    window.renderDetailEpisodeUI();
};

window.toggleEpSort = function() {
    window.epSortOrder = window.epSortOrder === 'desc' ? 'asc' : 'desc';
    window.renderDetailEpisodeUI();
};

window.renderDetailEpisodeUI = function() {
    let containerDetail = document.getElementById('episode-list-detail-container');
    if(!containerDetail) return;
    
    let listIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg> List`;
    let gridIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg> Grid`;
    
    let sortText = window.epSortOrder === 'desc' ? 'Sort: 99 &#9660; 1' : 'Sort: 1 &#9650; 99';

    document.querySelectorAll('.btn-ep-layout').forEach(btn => btn.innerHTML = window.epLayoutMode === 'list' ? gridIcon : listIcon);
    document.querySelectorAll('.btn-ep-sort').forEach(btn => btn.innerHTML = sortText);

    let eps = [...(window.currentAnimeEpisodes || [])];
    if (window.epSortOrder === 'desc') eps.reverse();

    let watchedEps = JSON.parse(localStorage.getItem('watchedEps')) || [];
    let watchProgress = JSON.parse(localStorage.getItem('watchProgress')) || {};
    let currentUrl = window.currentPlayingAnime ? window.currentPlayingAnime.url : ''; 

    let renderHtml = '';

    if (window.epLayoutMode === 'grid') {
        renderHtml = eps.map((ep, index) => {
            let realIndex = window.epSortOrder === 'desc' ? (eps.length - index) : (index + 1);
            let m = String(ep.title || '1').match(/(?:Episode|Eps|Ep)\s*(\d+(\.\d+)?)/i);
            let eNum = m ? m[1] : realIndex;

            let progress = watchProgress[ep.url];
            let isCurrent = (ep.url === currentUrl);
            let c = "ep-square";
            let inlineStyle = "width: 55px; height: 55px;"; 

            if (progress >= 100) {
                c += " active";
                if(isCurrent) inlineStyle += ` box-shadow: 0 0 8px rgba(59,130,246,0.8); border: 2px solid #fff;`;
            } else if (progress > 0) {
                inlineStyle += ` background: linear-gradient(to right, #3b82f6 ${progress}%, transparent ${progress}%); border-color: #3b82f6; color: #fff;`;
            } else if (progress === 0 || isCurrent) {
                c += " watched";
            } else if (watchedEps.includes(ep.url)) {
                c += " active";
            }

            return `<div class="${c}" style="${inlineStyle}" onclick="loadVideo('${ep.url}')">${eNum}</div>`;
        }).join('');
        
        containerDetail.style = "display: flex; gap: 10px; flex-wrap: wrap; padding-bottom: 10px;"; 
        containerDetail.className = ""; 
        containerDetail.innerHTML = renderHtml; 
        
    } else {
        renderHtml = eps.map((ep, index) => {
            let realIndex = window.epSortOrder === 'desc' ? (eps.length - index) : (index + 1);
            let m = String(ep.title || '1').match(/(?:Episode|Eps|Ep)\s*(\d+(\.\d+)?)/i);
            let eNum = m ? m[1] : realIndex;

            let mockEpViews = `${Math.floor(Math.random()*200 + 10)},${Math.floor(Math.random()*9)}K Views`;
            let mockEpDate = `16 Apr 2026`;

            let progress = watchProgress[ep.url];
            let isCurrent = (ep.url === currentUrl);

            let btnBg = 'rgba(255,255,255,0.1)';
            let btnText = 'Buka';

            if (progress >= 100 || watchedEps.includes(ep.url)) {
                btnBg = '#3b82f6'; btnText = 'Ditonton';
            } else if (progress > 0) {
                btnBg = '#3b82f6'; btnText = 'Lanjut';
            }

            if (isCurrent) {
                btnBg = '#ef4444'; btnText = 'Diputar';
            }

            return `<div onclick="loadVideo('${ep.url}')" style="display:flex; justify-content:space-between; align-items:center; padding:12px 15px; border-bottom:1px solid #1a1a1a; cursor:pointer; background: ${isCurrent ? '#111' : 'transparent'}; border-radius: 8px; margin-bottom: 4px; transition:0.2s;">
                <div>
                    <div style="font-size:15px; font-weight:800; color:${isCurrent ? '#3b82f6' : '#fff'}; margin-bottom:6px;">Episode ${eNum}</div>
                    <div style="font-size:12px; color:#888; display:flex; align-items:center; gap:6px; font-weight:500;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> ${mockEpViews} • ${mockEpDate}
                    </div>
                </div>
                <div>
                    <button style="background:${btnBg}; border:none; color:#fff; font-size:12px; font-weight:800; padding:8px 20px; border-radius:20px; cursor:pointer; transition:0.2s;">${btnText}</button>
                </div>
            </div>`;
        }).join('');
        
        containerDetail.style = "display: flex; flex-direction: column;"; 
        containerDetail.className = ""; 
        containerDetail.innerHTML = renderHtml; 
    }
};

async function loadDetail(url) {
    if(history.state && history.state.page === 'detail') {
        history.replaceState({page: 'detail'}, '', '#detail');
    } else {
        history.pushState({page: 'detail'}, '', '#detail');
    }
    loader(true);

    try {
        const res = await fetch(`${API_BASE}/detail?url=${encodeURIComponent(url)}`); const data = await res.json();
        
        window.currentAnimeMeta = { title: data.title, description: data.description, image: data.image, url: url };
        window.currentAnimeEpisodes = data.episodes || []; 
        window.currentPlayingAnime = null; 
        
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
            
            <div style="padding: 0 12px; margin-top:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h2 style="font-size:18px; font-weight:800; margin:0;">Episodes (${data.episodes.length})</h2>
                    <div style="display:flex; gap:8px;">
                        <button onclick="toggleEpLayout()" class="btn-ep-layout" style="background:#1c1c1e; border:1px solid #333; color:#fff; padding:6px 12px; border-radius:12px; font-size:12px; font-weight:700; display:flex; align-items:center; gap:6px; cursor:pointer; transition:0.2s;">
                        </button>
                        <button onclick="toggleEpSort()" class="btn-ep-sort" style="background:#1c1c1e; border:1px solid #333; color:#fff; padding:6px 12px; border-radius:12px; font-size:12px; font-weight:700; cursor:pointer; transition:0.2s;">
                        </button>
                    </div>
                </div>
                <div id="episode-list-detail-container"></div>
            </div>
            <div style="padding-bottom: 40px;"></div>
        `;
        
        window.renderDetailEpisodeUI(); 

    } catch (err) { console.error(err); } finally { loader(false); }
}

window.currentCommentSort = 'top';

async function loadVideo(url) {
    if (history.state && history.state.page === 'watch') {
        history.replaceState({page: 'watch'}, '', '#watch');
    } else {
        history.pushState({page: 'watch'}, '', '#watch');
    }
    loader(true);
    
    try {
        const res = await fetch(`${API_BASE}/watch?url=${encodeURIComponent(url)}`); const data = await res.json();
        switchTab('watch'); addXP(20); 
        let displayTitle = window.currentAnimeMeta?.title || data.title;
        
        let mockViews = `${Math.floor(Math.random() * 900 + 100)}.${Math.floor(Math.random() * 900 + 100)} Views`;
        let mockDate = new Date().toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'});
        
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

        let watchProgress = JSON.parse(localStorage.getItem('watchProgress')) || {};
        let oldWatched = JSON.parse(localStorage.getItem('watchedEps')) || [];
        oldWatched.forEach(oldUrl => { if(watchProgress[oldUrl] === undefined) watchProgress[oldUrl] = 100; });
        if (watchProgress[url] === undefined) {
            watchProgress[url] = 0; 
        } else if (watchProgress[url] < 100) {
            watchProgress[url] = Math.min(100, watchProgress[url] + 50);
        }
        localStorage.setItem('watchProgress', JSON.stringify(watchProgress));

        let episodeID = url.replace(/[^a-zA-Z0-9]/g, '_'); 

        let initialServer = data.streams.length > 0 ? data.streams[0].server : '';
        let initQualMatch = initialServer.match(/\d{3,4}p/i);
        let displayQualText = initQualMatch ? initQualMatch[0] + ' Quality' : 'Quality';

        document.getElementById('watch-view').innerHTML = `
            <div class="video-container-fixed"><button class="watch-back-btn" onclick="backToDetail()"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button><iframe id="video-player" src="${data.streams.length > 0 ? data.streams[0].url : ''}" allowfullscreen></iframe></div>
            
            <div style="padding: 15px 12px; display: flex; gap: 12px; align-items: center;">
                <img src="${window.currentPlayingAnime.image}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 1px solid #333; flex-shrink: 0;">
                <div style="flex: 1;">
                    <h2 style="font-size: 16px; font-weight: 800; margin: 0 0 4px 0; line-height: 1.3;">${displayTitle}</h2>
                    <div style="font-size: 12px; color: #a1a1aa; font-weight: 500; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                        Episode ${currentEpNum} • 
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> 
                        ${mockViews} • ${mockDate}
                    </div>
                </div>
            </div>
            
            <div style="padding: 0 12px 15px 12px; border-bottom: 1px solid #111;">
                <div class="hide-scrollbar" style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: nowrap; overflow-x: auto;">
                    <div style="display: flex; background: #1c1c1e; border: 1px solid #333; border-radius: 20px; overflow: hidden; align-items: center; flex-shrink: 0;">
                        <button id="btn-like-action" onclick="toggleLikeAction(this, 'like')" style="background: transparent; color: #fff; border: none; padding: 8px 16px; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px; cursor: pointer; border-right: 1px solid #333; transition: 0.2s;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg> 6,3K</button>
                        <button id="btn-dislike-action" onclick="toggleLikeAction(this, 'dislike')" style="background: transparent; color: #fff; border: none; padding: 8px 16px; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: 0.2s;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg> 28</button>
                    </div>

                    <button class="action-btn" onclick="openServerModal()" style="border-radius: 20px; flex-shrink: 0;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg> <span id="current-quality-text">${displayQualText}</span></button>
                    
                    <button class="action-btn" onclick="handleDownload()" style="border-radius: 20px; flex-shrink: 0;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"></path></svg> Download</button>
                </div>
                
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="action-btn" onclick="handleShare()" style="border-radius: 20px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg> Share</button>
                    <button class="action-btn" onclick="openReportModal()" style="border-radius: 20px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg> Report</button>
                </div>
            </div>

            <div style="padding: 20px 12px 10px 12px;">
                <h2 style="font-size:18px; font-weight:800; margin:0 0 15px 0;">Episode List</h2>
                <div id="watch-episode-squares" class="hide-scrollbar" style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 10px;"></div>
            </div>

            <div class="comment-section" style="padding: 20px 12px;"><div id="comment-count-text" style="font-size:16px; font-weight:800; margin:0 0 15px 0;">0 Comments</div><div style="display: flex; gap: 10px; margin-bottom: 20px;"><button class="comment-filter-btn active" onclick="setCommentFilter('top', this)">Top Comment</button><button class="comment-filter-btn" onclick="setCommentFilter('new', this)">Terbaru</button></div><div id="custom-comment-area" style="margin-bottom: 30px;"></div><div id="comment-list-container"></div></div>
            <div style="padding-bottom: 60px;"></div>
        `;
        
        if (data.streams.length > 0) { const modalServerContainer = document.getElementById('modal-server-list'); modalServerContainer.innerHTML = data.streams.map((stream, idx) => { let isActive = idx === 0 ? "server-list-btn active" : "server-list-btn"; return `<button class="${isActive}" onclick="changeServer('${stream.url}', '${stream.server}', this)"><span>${stream.server}</span> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5l10 -10"></path></svg></button>`; }).join(''); }
        
        // RENDER KOTAK EPISODE HORIZONTAL DI HALAMAN NONTON
        const watchEpListContainer = document.getElementById('watch-episode-squares');
        if (watchEpListContainer) { 
            if (window.currentAnimeEpisodes && window.currentAnimeEpisodes.length > 0) { 
                watchEpListContainer.innerHTML = [...window.currentAnimeEpisodes].reverse().map((ep, index) => { 
                    let m = String(ep.title || '1').match(/(?:Episode|Eps|Ep)\s*(\d+(\.\d+)?)/i); 
                    let eNum = m ? m[1] : (index + 1); 
                    
                    let progress = watchProgress[ep.url];
                    let isCurrent = (ep.url === url);
                    
                    let c = "ep-square";
                    let inlineStyle = "width: 55px; height: 55px; font-size: 16px;";

                    if (progress >= 100) {
                        c += " active"; 
                        if(isCurrent) inlineStyle += ` box-shadow: 0 0 8px rgba(59,130,246,0.8); border: 2px solid #fff;`; 
                    } 
                    else if (progress > 0) {
                        inlineStyle += ` background: linear-gradient(to right, #3b82f6 ${progress}%, transparent ${progress}%); border-color: #3b82f6; color: #fff;`;
                    } 
                    else if (progress === 0 || isCurrent) {
                        c += " watched";
                    }

                    return `<div class="${c}" style="${inlineStyle}" onclick="loadVideo('${ep.url}')">${eNum}</div>`; 
                }).join(''); 
            } else { 
                watchEpListContainer.innerHTML = `<div class="ep-square watched" style="width: 55px; height: 55px;">${currentEpNum}</div>`; 
            } 
        }
        
        window.currentEpID = episodeID; renderCommentInput(episodeID); listenToComments(episodeID);
    } catch (err) { console.error(err); } finally { loader(false); }
}

window.setCommentFilter = function(sortType, btnElement) { document.querySelectorAll('.comment-filter-btn').forEach(b => b.classList.remove('active')); btnElement.classList.add('active'); window.currentCommentSort = sortType; if (window.currentEpID) listenToComments(window.currentEpID); };

function renderCommentInput(epID) {
    const container = document.getElementById('custom-comment-area'); if(!container) return; 
    if(!currentUser) { 
        container.innerHTML = `<div style="display: flex; gap: 12px; align-items: center;"><div style="width: 36px; height: 36px; border-radius: 50%; background: #222; display: flex; justify-content: center; align-items: center;"><svg width="16" height="16" viewBox="0 0 24 24" fill="#555"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div><div style="flex: 1; background: #1c1c1e; border: 1px solid #2c2c2e; padding: 10px 16px; border-radius: 24px; color: #888; font-size: 13px; cursor: pointer;" onclick="switchTab('developer')">Login untuk menambahkan komentar...</div></div>`; 
    } 
    else { 
        const userFoto = currentUser.photoURL || 'https://placehold.co/40'; 
        container.innerHTML = `<div style="display: flex; gap: 12px; align-items: center;"><img src="${userFoto}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;"><div style="flex: 1; position: relative;"><input type="text" id="main-comment-input" onkeypress="if(event.key === 'Enter') postComment('${epID}')" placeholder="Tambahkan komentar..." style="width: 100%; background: #1c1c1e; border: 1px solid #2c2c2e; color: #fff; padding: 12px 45px 12px 16px; border-radius: 24px; font-size: 13px; outline: none; box-sizing: border-box;"><button onclick="postComment('${epID}')" style="position: absolute; right: 6px; top: 50%; transform: translateY(-50%); background: transparent; border: none; padding: 8px; cursor: pointer; display: flex;"><svg width="20" height="20" viewBox="0 0 24 24" fill="#3b82f6"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button></div></div>`; 
    }
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

// MENAMBAHKAN ONCLICK KE FOTO DAN NAMA UNTUK MELIHAT PROFIL
function generateCommentHtml(c, isReply = false, epID = null, parentID = null) {
    const role = c.role || 'Member'; 
    const level = c.level || 1; 
    const uidStr = c.uid ? "#" + c.uid.substring(0, 7).toUpperCase() : "#0000000"; 
    const timeStr = timeAgo(c.waktu || Date.now());
    
    let roleBadgeClass = 'badge-member'; 
    let roleName = role; 
    if(role === 'Developer') { roleBadgeClass = 'badge-dev-anim'; roleName = 'DEV'; } 
    else if(role === 'Wibu Premium' || level >= 50) { roleBadgeClass = 'badge-premium-anim'; roleName = role !== 'Member' ? role : 'Wibu Premium'; } 
    else if(role === 'Member') { roleName = 'Wibu Biasa'; }
    
    const rankInfo = getRankInfo(level); 
    let lvlClass = `badge-lvl-${rankInfo.name.toLowerCase()}`;

    // Kalkulasi EXP dan Jam Nonton berdasarkan Level supaya menyesuaikan profil orangnya
    // Karena logic level di web kamu 1 Lvl = 200 exp
    const userExp = (level - 1) * 200 + Math.floor(Math.random() * 150); 
    const userJam = level * 2; // Asumsi per 1 level butuh 2 jam nonton
    
    let replyBtnHtml = ''; 
    if(!isReply && epID && parentID) { 
        replyBtnHtml = `<div style="font-size: 12px; color: #3b82f6; font-weight: 700; cursor: pointer; margin-top: 6px; display: inline-block;" onclick="openReplyModal('${epID}', '${parentID}')">Reply</div>`; 
    }
    
    return `<div class="comment-item" style="display: flex; gap: 12px; margin-bottom: ${isReply ? '15px' : '25px'};">
        <img src="${c.foto}" style="width: ${isReply ? '28px' : '36px'}; height: ${isReply ? '28px' : '36px'}; border-radius: 50%; object-fit: cover; flex-shrink: 0; margin-top: 4px;">
        <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                <span style="font-weight: 700; font-size: ${isReply ? '12px' : '13px'}; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.nama}</span>
                <span style="font-size: 10px; color: #888; flex-shrink: 0;">• ${timeStr}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;">
                <span class="c-badge ${lvlClass}" onclick="openLevelModal(${level}, ${userExp}, ${userJam})" style="cursor: pointer;">${rankInfo.icon} Lvl. ${level}</span>
                <span class="c-badge ${roleBadgeClass}">${roleName}</span>
                <span style="font-size: 10px; color: #666; font-family: monospace; letter-spacing: 0.5px;">${uidStr}</span>
            </div>
            <div style="font-size: ${isReply ? '12px' : '13px'}; color: #d1d5db; line-height: 1.5; word-wrap: break-word;">${c.teks}</div>
            ${replyBtnHtml}
        </div>
    </div>`;
}

function listenToComments(epID) { db.ref('comments/' + epID).on('value', snap => { const list = document.getElementById('comment-list-container'); const countEl = document.getElementById('comment-count-text'); if(!snap.exists()) { if(countEl) countEl.innerText = "0 Comments"; if(list) list.innerHTML = '<div style="text-align:center; padding:30px 0;"><p style="color:#555; font-size:13px;">Belum ada komentar.</p></div>'; return; } let commentsArr = []; snap.forEach(child => { commentsArr.push({ id: child.key, ...child.val() }); }); if(countEl) { let total = commentsArr.length; countEl.innerText = total > 1000 ? (total/1000).toFixed(1) + 'K Comments' : total + ' Comments'; } if(window.currentCommentSort === 'new') { commentsArr.sort((a, b) => b.waktu - a.waktu); } else { commentsArr.sort((a, b) => a.waktu - b.waktu); } if(list) list.innerHTML = commentsArr.map(c => generateCommentHtml(c, false, epID, c.id)).join(''); }); }

window.openReplyModal = function(epID, parentID) {
    document.getElementById('replyModalOverlay').style.display = 'block'; document.getElementById('replyModal').style.display = 'block'; setTimeout(() => { document.getElementById('replyModal').classList.add('show'); }, 10);
    db.ref(`comments/${epID}/${parentID}`).once('value').then(snap => { if(snap.exists()) document.getElementById('reply-parent-content').innerHTML = generateCommentHtml(snap.val(), false); });
    db.ref(`replies/${parentID}`).on('value', snap => { const list = document.getElementById('reply-list-container'); if(!snap.exists()) { list.innerHTML = '<div style="font-size:12px; color:#666; padding:10px 0;">Jadilah yang pertama membalas...</div>'; return; } let repliesArr = []; snap.forEach(child => repliesArr.push(child.val())); repliesArr.sort((a, b) => a.waktu - b.waktu); list.innerHTML = repliesArr.map(r => generateCommentHtml(r, true)).join(''); });
    
    const inputArea = document.getElementById('reply-input-area'); 
    if(!currentUser) { 
        inputArea.innerHTML = `<div style="text-align:center; padding:10px; color:#888; font-size:12px; cursor:pointer;" onclick="closeReplyModal(); switchTab('developer')">Login untuk membalas...</div>`; 
    } else { 
        const userFoto = currentUser.photoURL || 'https://placehold.co/40'; 
        inputArea.innerHTML = `<div style="display: flex; gap: 10px; align-items: center; margin-top: 15px;"><img src="${userFoto}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;"><div style="flex: 1; position: relative;"><input type="text" id="reply-input-text" onkeypress="if(event.key === 'Enter') postReply('${parentID}')" placeholder="Balas komentar..." style="width: 100%; background: #1c1c1e; border: 1px solid #2c2c2e; color: #fff; padding: 10px 40px 10px 15px; border-radius: 20px; font-size: 13px; outline: none; box-sizing: border-box;"><button onclick="postReply('${parentID}')" style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%); background: transparent; border: none; padding: 6px; cursor: pointer; display: flex;"><svg width="20" height="20" viewBox="0 0 24 24" fill="#3b82f6"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button></div></div>`; 
    }
};

window.closeReplyModal = function() { const modal = document.getElementById('replyModal'); modal.classList.remove('show'); setTimeout(() => { document.getElementById('replyModalOverlay').style.display = 'none'; modal.style.display = 'none'; }, 300); };
window.postReply = function(parentID) { const input = document.getElementById('reply-input-text'); const text = input.value; if(!text.trim() || !currentUser) return; db.ref('users/' + currentUser.uid).once('value').then(snap => { const u = snap.val(); db.ref('replies/' + parentID).push().set({ uid: currentUser.uid, nama: u.nama, foto: u.foto, role: u.role || 'Member', level: u.level || 1, teks: text, waktu: Date.now() }); input.value = ''; addXP(5); }); };

// ==== FUNGSI MELIHAT PROFIL USER LAIN ====
function injectUserProfileModal() {
    if(document.getElementById('user-profile-modal-injected')) return;
    const div = document.createElement('div');
    div.id = 'user-profile-modal-injected';
    div.innerHTML = `
        <div id="userProfileOverlay" class="modal-overlay" onclick="closeUserProfileModal()" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:999998; backdrop-filter:blur(2px);"></div>
        <div id="userProfileModal" class="bottom-sheet" style="display:none; position:fixed; bottom:0; left:0; width:100%; background:#050505; z-index:999999; border-radius:24px 24px 0 0; padding:0; flex-direction:column; max-height:85vh; transform:translateY(100%); transition:transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 -5px 20px rgba(0,0,0,0.5); border-top: 1px solid #1a1a1a;">
            <div style="padding: 15px 20px; display:flex; justify-content:flex-end; border-bottom: 1px solid #111;">
                <button onclick="closeUserProfileModal()" style="background:rgba(255,255,255,0.1); border:none; color:#fff; border-radius:50%; width:30px; height:30px; display:flex; align-items:center; justify-content:center; cursor:pointer;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
            </div>
            <div id="user-profile-content" class="hide-scrollbar" style="overflow-y:auto; flex:1; padding-bottom:20px;"></div>
        </div>
    `;
    document.body.appendChild(div);
}

window.openUserProfile = function(uid) {
    if(!uid || uid === 'undefined') return;
    injectUserProfileModal();
    const overlay = document.getElementById('userProfileOverlay');
    const modal = document.getElementById('userProfileModal');
    const content = document.getElementById('user-profile-content');
    
    overlay.style.display = 'block';
    modal.style.display = 'flex';
    setTimeout(() => { modal.classList.add('show'); }, 10);
    
    content.innerHTML = '<div class="spinner" style="margin: 50px auto;"></div>';
    
    db.ref('users/' + uid).once('value').then(async snap => {
        if(!snap.exists()) {
            content.innerHTML = '<div style="text-align:center; padding:30px; color:#888;">User tidak ditemukan.</div>';
            return;
        }
        const data = snap.val();
        const userName = data.nama || 'Wibu';
        const userFoto = data.foto || 'https://placehold.co/100';
        const role = data.role || 'Member';
        const level = data.level || 1;
        const shortUid = "#" + uid.substring(0, 6).toUpperCase();
        
        let roleBadgeClass = 'badge-member'; let roleName = role;
        if(role === 'Developer') { roleBadgeClass = 'badge-dev-anim'; roleName = 'DEV'; }
        else if(role === 'Wibu Premium' || level >= 50) { roleBadgeClass = 'badge-premium-anim'; roleName = role !== 'Member' ? role : 'Wibu Premium'; }
        else if(role === 'Member') { roleName = 'Wibu Biasa'; }

        const rankInfo = getRankInfo(level);
        let lvlClass = `badge-lvl-${rankInfo.name.toLowerCase()}`;
        let avatarClass = `avatar-rank-${rankInfo.name.toLowerCase()}`;
        
        let userComments = [];
        try {
            const commentsSnap = await db.ref('comments').once('value');
            commentsSnap.forEach(epSnap => {
                epSnap.forEach(cSnap => {
                    let c = cSnap.val();
                    if(c.uid === uid) {
                        userComments.push({ epID: epSnap.key, ...c });
                    }
                });
            });
        } catch(e) {}
        
        userComments.sort((a,b) => b.waktu - a.waktu);
        let totalKomentar = userComments.length;
        
        let commentsHtml = userComments.length > 0 ? userComments.map(c => {
            let d = new Date(c.waktu || Date.now());
            let months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
            let exactDateStr = `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
            let aTitle = c.animeTitle || 'Anime Tidak Diketahui';
            let aImage = c.animeImage || 'https://placehold.co/100';
            let actionUrl = c.url ? `loadDetail('${c.url}')` : ``;
            
            return `
                <div style="margin-bottom: 20px; padding: 0 20px; cursor: pointer;" onclick="${actionUrl}; closeUserProfileModal();">
                    <div style="display: flex; gap: 12px; margin-bottom: 8px; align-items: center;">
                        <img src="${aImage}" style="width:40px; height:40px; border-radius:8px; object-fit:cover; border: 1px solid #222;">
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 800; font-size: 13px; color: #3b82f6; margin-bottom: 2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${aTitle}</div>
                            <div style="font-size: 11px; color: #a1a1aa; font-weight: 500;">${exactDateStr}</div>
                        </div>
                    </div>
                    <div style="font-size: 13px; color: #d1d5db; line-height: 1.5; background: #111; padding: 12px; border-radius: 8px; border: 1px solid #1a1a1a;">
                        ${c.teks}
                    </div>
                </div>
            `;
        }).join('') : '<p style="text-align:center; color:#555; font-size:13px; margin-top:30px;">Belum ada aktivitas komentar.</p>';

        let totalMenit = level * 120 + Math.floor(Math.random() * 500);

        content.innerHTML = `
            <div class="profile-header" style="margin-top:-10px;">
                <div class="profile-avatar-container">
                    <img src="${userFoto}" class="profile-avatar ${avatarClass}" style="width:90px; height:90px;">
                </div>
                <div class="profile-name" style="font-size:20px;">${userName}</div>
                <div class="profile-badges" style="display:flex; gap:8px; justify-content:center; align-items:center; margin-bottom:20px;">
                    <span class="c-badge ${roleBadgeClass}">${roleName}</span>
                    <span class="c-badge ${lvlClass}">${rankInfo.icon} Lvl. ${level}</span>
                    <span class="c-badge" style="background: rgba(255,255,255,0.05); color: #a1a1aa; border: 1px solid rgba(255,255,255,0.1);">${shortUid}</span>
                </div>
            </div>
            <div class="profile-stats" style="border-bottom:none; margin-bottom:15px; padding: 0 20px;">
                <div class="stat-box"><div class="stat-val">${totalMenit}</div><div class="stat-lbl">menit<br>menonton</div></div>
                <div class="stat-box"><div class="stat-val">${totalKomentar}</div><div class="stat-lbl">jumlah<br>komentar</div></div>
                <div class="stat-box"><div class="stat-val">12</div><div class="stat-lbl">bulan<br>bergabung</div></div>
            </div>
            
            <div style="border-top: 1px solid #111; padding-top: 20px;">
                <h3 style="font-size:16px; font-weight:800; margin: 0 20px 15px 20px;">Riwayat Komentar</h3>
                ${commentsHtml}
            </div>
        `;
    });
};

window.closeUserProfileModal = function() {
    const overlay = document.getElementById('userProfileOverlay');
    const modal = document.getElementById('userProfileModal');
    if(modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            overlay.style.display = 'none';
            modal.style.display = 'none';
        }, 300);
    }
};

// ==== FITUR KONFIRMASI KELUAR & NAVIGASI ====
let isHistoryTrapped = false;

// Tangkap interaksi pertama user untuk membuat trap history 
// (Karena browser modern memblokir trap history jika tidak ada sentuhan dari user)
document.addEventListener('click', () => {
    if (!isHistoryTrapped) {
        history.replaceState({page: 'trap'}, '', window.location.pathname); 
        
        let activeTab = document.querySelector('.nav-item.active');
        let tabId = activeTab ? activeTab.id.replace('tab-', '') : 'home';
        history.pushState({page: tabId}, '', window.location.pathname); 
        
        isHistoryTrapped = true;
    }
}, { once: true, capture: true });

function injectExitModal() {
    if(document.getElementById('exitModalOverlay')) return;
    const div = document.createElement('div');
    div.innerHTML = `
        <div id="exitModalOverlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999999; backdrop-filter:blur(3px); justify-content:center; align-items:center;">
            <div id="exitModalBox" style="background:#1c1c1e; width:300px; padding:25px; border-radius:24px; text-align:center; box-shadow:0 10px 30px rgba(0,0,0,0.8); border: 1px solid #2c2c2e; transform: scale(0.9); transition: transform 0.2s, opacity 0.2s; opacity: 0;">
                <div style="width:60px; height:60px; background:rgba(239, 68, 68, 0.1); border-radius:50%; display:flex; justify-content:center; align-items:center; margin:0 auto 15px auto;">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                </div>
                <h3 style="color:#fff; margin:0 0 8px 0; font-size:18px; font-weight:900;">Keluar dari Animeku?</h3>
                <p style="color:#a1a1aa; font-size:13px; margin:0 0 20px 0; line-height:1.5;">Yakin nih mau keluar? Jangan lupa balik lagi buat lanjutin tontonan kamu ya!</p>
                <div style="display:flex; gap:10px;">
                    <button onclick="cancelExit()" style="flex:1; background:#2c2c2e; color:#fff; border:none; padding:12px; border-radius:12px; font-weight:800; cursor:pointer;">Nggak Jadi</button>
                    <button onclick="confirmExit()" style="flex:1; background:#ef4444; color:#fff; border:none; padding:12px; border-radius:12px; font-weight:800; cursor:pointer; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.4);">Ya, Keluar</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(div);
}

window.showExitModal = function() {
    injectExitModal();
    const overlay = document.getElementById('exitModalOverlay');
    const box = document.getElementById('exitModalBox');
    overlay.style.display = 'flex';
    setTimeout(() => { box.style.opacity = '1'; box.style.transform = 'scale(1)'; }, 10);
};

window.cancelExit = function() {
    const overlay = document.getElementById('exitModalOverlay');
    const box = document.getElementById('exitModalBox');
    box.style.opacity = '0'; box.style.transform = 'scale(0.9)';
    setTimeout(() => { overlay.style.display = 'none'; }, 200);
    
    // Dorong history lagi supaya bisa ditahan lagi
    let activeTab = document.querySelector('.nav-item.active');
    let tabId = activeTab ? activeTab.id.replace('tab-', '') : 'home';
    history.pushState({page: tabId}, '', window.location.pathname);
};

window.confirmExit = function() {
    // Biarkan aplikasi tertutup/keluar dari browser
    history.back(); 
};

window.changeServer = function(url, serverName, btnElement) { 
    // Ganti iframe secara keseluruhan agar tidak merusak stack history browser
    let oldIframe = document.getElementById('video-player');
    let newIframe = document.createElement('iframe');
    newIframe.id = 'video-player';
    newIframe.src = url;
    newIframe.setAttribute('allowfullscreen', 'true');
    oldIframe.parentNode.replaceChild(newIframe, oldIframe);

    let qualMatch = serverName.match(/\d{3,4}p/i);
    let displayQuality = qualMatch ? qualMatch[0] + ' Quality' : 'Quality';
    document.getElementById('current-quality-text').innerText = displayQuality; 
    document.querySelectorAll('.server-list-btn').forEach(b => { b.classList.remove('active'); }); 
    btnElement.classList.add('active'); 
    window.closeServerModal(); 
};

window.addEventListener('popstate', (e) => { 
    const page = e.state ? e.state.page : null; 
    
    // Matikan video jika navigasi mundur/back
    let p = document.getElementById('video-player'); 
    if(p && page !== 'watch') p.src = ''; 

    // Jika user berada di layer "trap" (mencoba keluar)
    if (!page || page === 'trap') {
        showExitModal();
        return;
    }

    switchTab(page); 
});

function goHome() { history.back(); }
function backToDetail() { history.back(); }

function initApp() { 
    updateDevUI(); 
    injectReportModal(); 
    injectExitModal();
    
    // Jangan set pushState di awal supaya tidak diblokir Chrome. 
    // Biarkan event listener 'click' di atas yang handle.
    history.replaceState({page: 'home'}, '', window.location.pathname); 
    
    switchTab('home'); 
}

if (document.readyState === 'loading') { 
    document.addEventListener('DOMContentLoaded', initApp); 
} else { 
    initApp(); 
}
