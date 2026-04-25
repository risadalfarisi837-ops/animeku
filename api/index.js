const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

const BASE_URL = 'https://otakudesu.cloud'; 
const PROXY = 'https://cors.caliph.my.id/';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
};

// Fungsi kebal blokir
async function fetchHtml(url) {
  try {
    const { data } = await axios.get(url, { headers, timeout: 8000 });
    return data;
  } catch (e) {
    const { data } = await axios.get(`${PROXY}${url}`, { headers, timeout: 10000 });
    return data;
  }
}

app.get('/api/latest', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const html = await fetchHtml(`${BASE_URL}/ongoing-anime/page/${page}/`);
    const $ = cheerio.load(html);
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
    res.status(500).json({ error: "Gagal memuat anime terbaru." });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    const html = await fetchHtml(`${BASE_URL}/?s=${encodeURIComponent(query)}&post_type=anime`);
    const $ = cheerio.load(html);
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

app.get('/api/detail', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    // Blokir link Samehadaku jadul yang nyangkut di HP lu
    if(targetUrl.includes('samehadaku')) {
        return res.status(400).json({ error: "Link usang. Clear data browser lu." });
    }

    const html = await fetchHtml(targetUrl);
    const $ = cheerio.load(html);
    const episodes = [];
    
    $('.episodelist:not(.bookmark) ul li').each((i, el) => {
      episodes.push({
        title: $(el).find('a').text().trim(),
        url: $(el).find('a').attr('href'),
        date: $(el).find('.zee').text().trim()
      });
    });

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

app.get('/api/watch', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    const html = await fetchHtml(targetUrl);
    const $ = cheerio.load(html);
    const streams = [];
    
    const iframeSrc = $('#lightsVideo iframe').attr('src');
    if (iframeSrc) streams.push({ server: "Server Utama (HD)", url: iframeSrc });

    res.json({
      title: $('.venutama h1').text().trim(),
      streams: streams
    });
  } catch (error) {
    res.status(500).json({ error: "Gagal memuat video." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
module.exports = app;
