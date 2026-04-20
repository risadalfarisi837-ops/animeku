const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

// --- KABEL KE GUDANG MONGODB ---
const MONGO_URI = "mongodb+srv://Risyadh:risadalfaris1837@animeku.stmxguy.mongodb.net/?appName=Animeku";

mongoose.connect(MONGO_URI)
    .then(() => console.log("Gudang Animeku Terhubung! 🚀"))
    .catch(err => console.log("Gagal connect gudang:", err.message));

// --- SKEMA DATA ---
const AnimeSchema = new mongoose.Schema({
    title: { type: String, unique: true },
    image: String,
    url: String,
    type: String,
    score: String,
    lastUpdate: { type: Date, default: Date.now }
});
const Anime = mongoose.model('Anime', AnimeSchema);

const BASE_URL = 'https://v2.samehadaku.how';
const PROXY = 'https://cors.caliph.my.id/';
const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)','Referer': BASE_URL };

// --- ENGINE CERDAS: AMBIL & SIMPAN ---
async function fetchAndSave(query) {
    try {
        const res = await axios.get(`${PROXY}${BASE_URL}/?s=${encodeURIComponent(query)}`, { headers });
        const $ = cheerio.load(res.data);
        const results = [];
        $('.animpost').each((_, e) => {
            const item = {
                title: $(e).find('.data .title h2').text().trim(),
                image: $(e).find('.content-thumb img').attr('src'),
                type: $(e).find('.type').text().trim(),
                score: $(e).find('.score').text().trim() || '8.00',
                url: $(e).find('a').attr('href')
            };
            results.push(item);
            Anime.findOneAndUpdate({ title: item.title }, item, { upsert: true }).catch(() => {});
        });
        return results;
    } catch (e) { 
        console.log("Error Scraping:", e.message);
        return []; 
    }
}

// --- ROUTES API ---
app.get('/api/search', async (req, res) => {
    const q = req.query.q;
    console.log("Menerima pencarian:", q);
    try {
        const localData = await Anime.find({ title: new RegExp(q, 'i') }).limit(20);
        if (localData.length > 0) {
            console.log("Data ketemu di database! ⚡");
            res.json(localData);
            fetchAndSave(q); // Update diam-diam
        } else {
            console.log("Database kosong, menyedot dari web luar...");
            const freshData = await fetchAndSave(q);
            res.json(freshData);
        }
    } catch (e) { 
        console.error("Error API Search:", e.message);
        res.status(500).json([]); 
    }
});

app.get('/api/latest', async (req, res) => {
    try {
        const data = await Anime.find().sort({ lastUpdate: -1 }).limit(20);
        if (data.length > 0) return res.json(data);
        
        const resWeb = await axios.get(`${PROXY}${BASE_URL}/anime-terbaru/`, { headers });
        const $ = cheerio.load(resWeb.data);
        const latest = [];
        $('.post-show ul li').each((_, e) => {
            const a = $(e).find('.dtla h2 a');
            latest.push({ title: a.text().trim(), url: a.attr('href'), image: $(e).find('.thumb img').attr('src'), episode: 'New' });
        });
        res.json(latest);
    } catch (e) { res.json([]); }
});

app.get('/api/detail', async (req, res) => {
    try {
        const resWeb = await axios.get(`${PROXY}${req.query.url}`, { headers });
        const $ = cheerio.load(resWeb.data);
        const episodes = [];
        $('.lstepsiode ul li').each((_, e) => { episodes.push({ title: $(e).find('.epsleft .lchx a').text().trim(), url: $(e).find('.epsleft .lchx a').attr('href') }); });
        res.json({ title: $('title').text().trim(), image: $('meta[property="og:image"]').attr('content'), episodes });
    } catch (e) { res.status(500).send(); }
});

app.get('/api/watch', async (req, res) => {
    try {
        const resWeb = await axios.get(`${PROXY}${req.query.url}`, { headers });
        const $ = cheerio.load(resWeb.data);
        const data = [];
        for (const li of $('div#server > ul > li').toArray()) {
            const div = $(li).find('div');
            const body = new URLSearchParams({ action: 'player_ajax', post: div.attr('data-post'), nume: div.attr('data-nume'), type: div.attr('data-type') });
            const r = await axios.post(`${PROXY}${BASE_URL}/wp-admin/admin-ajax.php`, body.toString(), { headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded'} });
            const iframe = cheerio.load(r.data)('iframe').attr('src');
            if (iframe) data.push({ server: $(li).find('span').text().trim(), url: iframe });
        }
        res.json({ streams: data });
    } catch (e) { res.status(500).send(); }
});

module.exports = app;
