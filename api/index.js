const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

// --- KONFIGURASI SUMBER ---
const PROXY = 'https://cors.caliph.my.id/';
const URL_SAMEHADAKU = 'https://v2.samehadaku.how';
const URL_OTAKUDESU = 'https://otakudesu.cloud';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

// ==========================================
// 1. ENGINE SCRAPER: SAMEHADAKU (CEPAT/UTAMA)
// ==========================================
async function scraperSamehadaku() {
  return {
    latest: async (page = 1) => {
      const res = await axios.get(`${PROXY}${URL_SAMEHADAKU}/anime-terbaru/page/${page}/`, { headers });
      const $ = cheerio.load(res.data);
      const data = [];
      $('.post-show ul li').each((_, e) => {
        const a = $(e).find('.dtla h2 a');
        if (a.length > 0) data.push({ title: a.text().trim(), url: a.attr('href'), image: $(e).find('.thumb img').attr('src'), episode: $(e).find('.dtla span:contains("Episode")').text().replace('Episode', '').trim() });
      });
      return data;
    },
    search: async (q) => {
      const res = await axios.get(`${PROXY}${URL_SAMEHADAKU}/?s=${encodeURIComponent(q)}`, { headers });
      const $ = cheerio.load(res.data);
      const data = [];
      $('.animpost').each((_, e) => {
        data.push({ title: $(e).find('.data .title h2').text().trim(), image: $(e).find('.content-thumb img').attr('src'), type: $(e).find('.type').text().trim(), score: $(e).find('.score').text().trim(), url: $(e).find('a').attr('href') });
      });
      return data;
    },
    detail: async (url) => {
      const targetUrl = url.startsWith('http') ? url : `${URL_SAMEHADAKU}${url}`;
      const res = await axios.get(`${PROXY}${targetUrl}`, { headers });
      const $ = cheerio.load(res.data);
      const episodes = [];
      $('.lstepsiode ul li').each((_, e) => { episodes.push({ title: $(e).find('.epsleft .lchx a').text().trim(), url: $(e).find('.epsleft .lchx a').attr('href'), date: $(e).find('.epsleft .date').text().trim() }); });
      return { title: $('title').text().replace(' - Samehadaku', '').trim(), image: $('meta[property="og:image"]').attr('content'), description: $('.entry-content').text().trim() || $('meta[name="description"]').attr('content'), episodes };
    },
    watch: async (url) => {
      const targetUrl = url.startsWith('http') ? url : `${URL_SAMEHADAKU}${url}`;
      const res = await axios.get(`${PROXY}${targetUrl}`, { headers });
      const cookies = res.headers['set-cookie']?.map(v => v.split(';')[0]).join('; ') || '';
      const $ = cheerio.load(res.data);
      const data = [];
      for (const li of $('div#server > ul > li').toArray()) {
        const div = $(li).find('div');
        const body = new URLSearchParams({ action: 'player_ajax', post: div.attr('data-post'), nume: div.attr('data-nume'), type: div.attr('data-type') }).toString();
        try {
          const r = await axios.post(`${PROXY}${URL_SAMEHADAKU}/wp-admin/admin-ajax.php`, body, { headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookies } });
          const $$ = cheerio.load(r.data);
          const iframe = $$('iframe').attr('src');
          if (iframe) data.push({ server: $(li).find('span').text().trim(), url: iframe });
        } catch (e) {}
      }
      return { title: $('h1[itemprop="name"]').text().trim(), streams: data };
    }
  };
}

// ==========================================
// 2. ENGINE SCRAPER: OTAKUDESU (CADANGAN LAMBAT)
// ==========================================
async function scraperOtakudesu() {
  return {
    search: async (q) => {
      const res = await axios.get(`${PROXY}${URL_OTAKUDESU}/?s=${encodeURIComponent(q)}&post_type=anime`, { headers });
      const $ = cheerio.load(res.data);
      const data = [];
      $('.chivsrc li').each((_, e) => {
        data.push({ title: $(e).find('h2 a').text().trim(), image: $(e).find('img').attr('src'), type: $(e).find('.set:contains("Status")').text().replace('Status : ', '').trim(), score: $(e).find('.set:contains("Rating")').text().replace('Rating : ', '').trim() || 'N/A', url: $(e).find('h2 a').attr('href') });
      });
      return data;
    },
    detail: async (url) => {
      const res = await axios.get(`${PROXY}${url}`, { headers });
      const $ = cheerio.load(res.data);
      const episodes = [];
      $('.episodelist ul li').each((_, e) => { episodes.push({ title: $(e).find('a').text().trim(), url: $(e).find('a').attr('href'), date: $(e).find('.zeebr').text().trim() }); });
      return { title: $('.infozingle p:contains("Judul") span').text().trim() || $('.jdlrx h1').text().trim(), image: $('.fotoanime img').attr('src'), description: $('.sinopc').text().trim(), episodes };
    },
    watch: async (url) => {
      const res = await axios.get(`${PROXY}${url}`, { headers });
      const $ = cheerio.load(res.data);
      const data = [];
      $('.mirrorstream ul li').each((_, e) => {
        const rawContent = $(e).find('a').attr('data-content');
        if (rawContent) {
            try {
                const decodedHtml = Buffer.from(rawContent, 'base64').toString('utf-8');
                const $$ = cheerio.load(decodedHtml);
                const iframeSrc = $$('iframe').attr('src');
                if (iframeSrc) data.push({ server: $(e).find('a').text().trim(), url: iframeSrc });
            } catch (err) {}
        }
      });
      return { title: $('.venutama h1').text().trim(), streams: data };
    }
  };
}

// ==========================================
// 3. API ROUTES (SMART & FAST AGGREGATOR)
// ==========================================

app.get('/api/latest', async (req, res) => {
  try {
    const s = await scraperSamehadaku();
    res.json(await s.latest(req.query.page || 1));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/search', async (req, res) => {
  try {
    const q = req.query.q;
    const s1 = await scraperSamehadaku();
    
    // 1. Coba Samehadaku Dulu (Ngebut)
    let hasil = await s1.search(q);
    
    // 2. Kalau Gagal/Kosong, Baru Panggil Otakudesu (Cadangan)
    if (!hasil || hasil.length === 0) {
        const s2 = await scraperOtakudesu();
        hasil = await s2.search(q);
    }
    
    res.json(hasil);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/detail', async (req, res) => {
  try {
    const url = req.query.url;
    const s = url.includes('otakudesu') ? await scraperOtakudesu() : await scraperSamehadaku();
    res.json(await s.detail(url));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/watch', async (req, res) => {
  try {
    const url = req.query.url;
    const s = url.includes('otakudesu') ? await scraperOtakudesu() : await scraperSamehadaku();
    res.json(await s.watch(url));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Animeku Fast API Server on port ${PORT}`));
module.exports = app;
