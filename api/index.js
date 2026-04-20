const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const BASE_URL = 'https://v2.samehadaku.how';
const PROXY = 'https://cors.caliph.my.id/';
const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)','Referer': BASE_URL };

app.get('/api/search', async (req, res) => {
    try {
        const q = req.query.q;
        const resWeb = await axios.get(`${PROXY}${BASE_URL}/?s=${encodeURIComponent(q)}`, { headers });
        const $ = cheerio.load(resWeb.data);
        const results = [];
        $('.animpost').each((_, e) => {
            results.push({
                title: $(e).find('.data .title h2').text().trim(),
                image: $(e).find('.content-thumb img').attr('src'),
                type: $(e).find('.type').text().trim(),
                score: $(e).find('.score').text().trim() || '8.00',
                url: $(e).find('a').attr('href')
            });
        });
        res.json(results);
    } catch (e) { res.status(500).json([]); }
});

app.get('/api/latest', async (req, res) => {
    try {
        const resWeb = await axios.get(`${PROXY}${BASE_URL}/anime-terbaru/`, { headers });
        const $ = cheerio.load(resWeb.data);
        const latest = [];
        $('.post-show ul li').each((_, e) => {
            const a = $(e).find('.dtla h2 a');
            latest.push({ 
                title: a.text().trim(), 
                url: a.attr('href'), 
                image: $(e).find('.thumb img').attr('src'), 
                episode: 'New' 
            });
        });
        res.json(latest);
    } catch (e) { res.json([]); }
});

app.get('/api/detail', async (req, res) => {
    try {
        const resWeb = await axios.get(`${PROXY}${req.query.url}`, { headers });
        const $ = cheerio.load(resWeb.data);
        const episodes = [];
        $('.lstepsiode ul li').each((_, e) => { 
            episodes.push({ 
                title: $(e).find('.epsleft .lchx a').text().trim(), 
                url: $(e).find('.epsleft .lchx a').attr('href') 
            }); 
        });
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
