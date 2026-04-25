const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

// Domain Otakudesu (Bisa lu ganti kalau suatu saat domain mereka ganti)
const BASE_URL = 'https://otakudesu.cloud'; 

// Header rahasia biar server Otakudesu ngira yang akses itu manusia, bukan bot/Vercel
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
};

// --- 1. LATEST ANIME (Update Terbaru) ---
app.get('/api/latest', async (req, res) => {
  try {
    const page = req.query.page || 1;
    // Nembak langsung ke halaman ongoing
    const { data } = await axios.get(`${BASE_URL}/ongoing-anime/page/${page}/`, { headers });
    const $ = cheerio.load(data);
    const result = [];
    
    $('.venz ul li').each((i, el) => {
      result.push({
        title: $(el).find('.jdlflm').text().trim(),
        url: $(el).find('.thumb a').attr('href'),
        image: $(el).find('.thumbz img').attr('src'),
        episode: $(el).find('.epz').text().trim(),
      });
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Gagal memuat anime terbaru. Coba lagi nanti." });
  }
});

// --- 2. CARI ANIME ---
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    const { data } = await axios.get(`${BASE_URL}/?s=${encodeURIComponent(query)}&post_type=anime`, { headers });
    const $ = cheerio.load(data);
    const result = [];
    
    $('.chivsrc li').each((i, el) => {
      let scoreRaw = $(el).find('.set').first().text();
      result.push({
        title: $(el).find('h2 a').text().trim(),
        url: $(el).find('h2 a').attr('href'),
        image: $(el).find('img').attr('src'),
        type: "TV", 
        score: scoreRaw ? scoreRaw.replace('Rating : ', '').trim() : "?",
      });
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Pencarian gagal." });
  }
});

// --- 3. DETAIL & LIST EPISODE ---
app.get('/api/detail', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    const { data } = await axios.get(targetUrl, { headers });
    const $ = cheerio.load(data);
    
    const episodes = [];
    // Ambil list episode (kecuali tombol bookmark)
    $('.episodelist:not(.bookmark) ul li').each((i, el) => {
      episodes.push({
        title: $(el).find('a').text().trim(),
        url: $(el).find('a').attr('href'),
        date: $(el).find('.zee').text().trim()
      });
    });

    // Otakudesu itu episode terbarunya di atas, jadi kita balik (reverse) 
    // biar pas dirender di UI lu, Episode 1 ada di bawah/atas sesuai sorting lu
    episodes.reverse();

    res.json({
      title: $('.fotoanime .infozin .infozingle p:contains("Judul")').text().replace('Judul: ', '').trim(),
      image: $('.fotoanime img').attr('src'),
      description: $('.sinopc').text().trim(),
      episodes: episodes,
      info: {
        skor: $('.fotoanime .infozin .infozingle p:contains("Skor")').text().replace('Skor: ', '').trim(),
        tipe: "TV",
        musim: "",
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Gagal memuat detail anime." });
  }
});

// --- 4. STREAMING VIDEO (Anti Error) ---
app.get('/api/watch', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    const { data } = await axios.get(targetUrl, { headers });
    const $ = cheerio.load(data);
    
    const streams = [];
    
    // Otakudesu biasanya naruh video di dalam div #lightsVideo
    const iframeSrc = $('#lightsVideo iframe').attr('src');
    
    if (iframeSrc) {
       streams.push({ server: "Server Utama (HD)", url: iframeSrc });
    }

    // Ambil opsi mirror jika ada (DesuDrive, dll)
    // Di otakudesu kadang mirror butuh di-decode, tapi server utama biasanya udah cukup dan stabil
    $('.mirrorstream ul li').each((i, el) => {
        const serverName = $(el).find('a').text().trim();
        // Kalau lu mau kembangin mirror, logikanya dimasukin ke sini
    });

    res.json({
      title: $('.venutama h1').text().trim(),
      streams: streams.length > 0 ? streams : [{ server: "Server Mati", url: "" }]
    });
  } catch (error) {
    res.status(500).json({ error: "Gagal memuat video." });
  }
});

// Jalankan Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server Animeku jalan di port ${PORT}`));

module.exports = app;
