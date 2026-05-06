# Animeku v114

## ✅ Perubahan di v114

### Fix Vercel — API "Not Found"
**2 penyebab:**
1. `vercel.json` tidak punya `builds` → Vercel tidak compile `api/index.js` sebagai serverless function
2. `app.get('*')` catch-all intercept semua request termasuk `/api/*` di Vercel

**Fix:**
- Tambah `builds` di `vercel.json` dengan `@vercel/node` dan `@vercel/static`
- Hapus `app.get('*')` catch-all (static sudah dihandle vercel.json rewrites)
- `app.listen` hanya jalan di lokal, Vercel pakai `module.exports = app`

### Fix Double Section (v113)
- Guard `window._homeLoading` di `loadLatest()` cegah race condition
- Hapus `switchTab('home')` dari `onAuthStateChanged` pertama

---

## 🚀 Cara Deploy ke Vercel

1. Upload zip ini ke Vercel (drag & drop atau GitHub)
2. Set Environment Variable di Vercel Settings:
   - `MONGODB_URI` = `mongodb+srv://risadalfarisi837_db_user:animeku123@animeku.npxoq9p.mongodb.net/database?retryWrites=true&w=majority&appName=Animeku`
3. Deploy & tunggu selesai
4. Test: `https://animeku-indo.my.id/api/ping`

---

## 🕷️ Cara Scrape Anime ke MongoDB

### Langkah 1 — Scrape data (ulangi untuk halaman berikutnya)
```
https://animeku-indo.my.id/api/scrape-all?source=samehadaku&pages=5&startPage=1
```
- `pages` = berapa halaman per request (max 20)
- `startPage` = mulai dari halaman berapa
- Ulangi dengan `startPage=6`, `startPage=11`, dst sampai data cukup

### Langkah 2 — Fix metadata (gambar, score, genre dari AniList)
```
https://animeku-indo.my.id/api/fix-metadata?limit=50
```
- Ulangi beberapa kali sampai semua anime ter-enrich

### Langkah 3 — Heal anime yang episode-nya kosong
```
https://animeku-indo.my.id/api/heal-empty?limit=20
```
- Ulangi sampai hasilnya `"healed":0`

### Langkah 4 — Cek statistik DB
```
https://animeku-indo.my.id/api/db-stats
```

### Langkah 5 — Clear cache biar tampil di web
```
https://animeku-indo.my.id/api/cache-clear
```

---

## 🧹 Urutan Lengkap (Copy-paste satu per satu di browser)

```
1. /api/ping                                          ← cek koneksi DB
2. /api/scrape-all?source=samehadaku&pages=10         ← scrape 10 halaman
3. /api/scrape-all?source=samehadaku&pages=10&startPage=11
4. /api/fix-metadata?limit=50                         ← ulangi 3-5x
5. /api/heal-empty?limit=30                           ← ulangi sampai healed=0
6. /api/cache-clear                                   ← bersihkan cache
7. /api/db-stats                                      ← cek total anime
```
