const express  = require('express');
const axios    = require('axios');
const cheerio  = require('cheerio');
const cors     = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// =============================================
// MONGODB CONNECTION
// =============================================
let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 15000,
  });
  isConnected = true;
  console.log('[DB] MongoDB connected');
}

// =============================================
// SCHEMAS
// =============================================
const AnimeSchema = new mongoose.Schema({
  url:             { type: String, unique: true, index: true },
  title:           { type: String, index: true },
  titleEnglish:    String,
  titleJapanese:   String,
  titleNorm:       { type: String, index: true },
  image:           String,
  description:     String,
  score:           String,
  rank:            Number,
  popularity:      Number,
  scoredBy:        Number,
  rating:          String,
  trailerUrl:      String,
  anilistId:       { type: Number, index: true },
  anilistEnriched: { type: Boolean, default: false },
  info: {
    tipe:          String,
    status:        { type: String, index: true },
    season:        String,
    year:          String,
    aired:         String,
    studio:        String,
    producer:      String,
    source:        String,
    genre:         { type: String, index: true },
    theme:         String,
    demographic:   String,
    duration:      String,
    rating:        String,
    episode_count: String,
  },
  episodes:     { type: Array, default: [] },
  streamSource: String,
  updatedAt:    { type: Date, default: Date.now, index: true },
}, { collection: 'animedetails' });

AnimeSchema.index({ title: 'text', titleEnglish: 'text', titleJapanese: 'text' });

const WatchSchema = new mongoose.Schema({
  url:       { type: String, unique: true, index: true },
  title:     String,
  streams:   { type: Array, default: [] },
  updatedAt: { type: Date, default: Date.now, index: true },
}, { collection: 'watches' });

const LatestSchema = new mongoose.Schema({
  _id:       { type: String, default: 'latest' },
  data:      { type: Array, default: [] },
  updatedAt: { type: Date, default: Date.now },
}, { collection: 'latestcaches' });

const Anime  = mongoose.model('AnimeDetail', AnimeSchema);
const Watch  = mongoose.model('Watch', WatchSchema);
const Latest = mongoose.model('LatestCache', LatestSchema);

const WATCH_TTL  = 2 * 60 * 60 * 1000;
const LATEST_TTL = 5 * 60 * 1000; // 5 menit

// In-memory cache — biar ga bolak-balik query MongoDB tiap request
let _memLatest = null, _memLatestTs = 0;
let _memTop    = null, _memTopTs    = 0;
const MEM_TTL  = 3 * 60 * 1000; // 3 menit

// =============================================
// HTTP HELPERS
// =============================================
const SAMEHADAKU_DOMAINS = [
  'https://v2.samehadaku.how',
  'https://samehadaku.how',
  'https://samehadaku.care',
];
const PROXIES = [
  'https://cors.caliph.my.id/',
  'https://corsproxy.io/?url=',
  '',
];
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
  'Cache-Control': 'no-cache',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function normalizeTitle(title) {
  return (title || '').toLowerCase()
    .replace(/subtitle\s*indonesia/gi,'').replace(/sub\s*indo/gi,'')
    .replace(/\s*-\s*episode\s*\d+.*/gi,'').replace(/\s*episode\s*\d+.*/gi,'')
    .replace(/[^a-z0-9\s]/gi,'').replace(/\s+/g,' ').trim();
}

async function axiosGet(url, extra={}, timeout=20000) {
  for (let i=0; i<PROXIES.length; i++) {
    const fullUrl = PROXIES[i] ? PROXIES[i]+url : url;
    try {
      const res = await axios.get(fullUrl, { headers:{...HEADERS,...extra}, timeout, validateStatus: s=>s<500 });
      const body = typeof res.data==='string' ? res.data : JSON.stringify(res.data);
      if (res.status===403 || body.length<200) { if(i<PROXIES.length-1){await sleep(300);continue;} }
      return res;
    } catch(e) { if(i<PROXIES.length-1){await sleep(300);continue;} throw e; }
  }
}

async function axiosMulti(path, extra={}, timeout=20000) {
  for (const base of SAMEHADAKU_DOMAINS) {
    try {
      const res = await axiosGet(`${base}${path}`, extra, timeout);
      if ((typeof res.data==='string'?res.data:'').length>500) return res;
    } catch(e) { continue; }
  }
  throw new Error('All domains failed: '+path);
}

function formatAnime(d) {
  if (d.toObject) d = d.toObject();
  return {
    _id: d._id, url: d.url,
    title: d.title, titleEnglish: d.titleEnglish||d.title,
    titleJapanese: d.titleJapanese||'', titleNorm: d.titleNorm||'',
    image: d.image||'', description: d.description||'',
    score: d.score||'', rank: d.rank||null, popularity: d.popularity||null,
    rating: d.rating||'', trailerUrl: d.trailerUrl||'',
    anilistId: d.anilistId||null, anilistEnriched: d.anilistEnriched||false,
    info: d.info||{}, episodes: d.episodes||[], streamSource: d.streamSource||d.url,
    updatedAt: d.updatedAt, source: 'mongodb',
  };
}

// =============================================
// SCRAPERS (fallback)
// =============================================
const EP_SELS = [
  {list:'.lstepsiode ul li', link:'.epsleft .lchx a', date:'.epsleft .date'},
  {list:'.episodelist ul li', link:'a', date:'.date'},
  {list:'.eps-list ul li', link:'a', date:'.date'},
  {list:'.list-episode li', link:'a', date:''},
];

async function scrapeLatest(page=1) {
  const res = await axiosMulti(`/anime-terbaru/page/${page}/`, {Referer:SAMEHADAKU_DOMAINS[0]});
  const $ = cheerio.load(res.data); const data=[];
  $('.post-show ul li').each((_,e)=>{
    const a=$(e).find('.dtla h2 a'); if(!a.length) return;
    const title=a.text().trim(); const imgEl=$(e).find('.thumb img');
    data.push({title, titleNorm:normalizeTitle(title), url:a.attr('href'),
      image:imgEl.attr('data-src')||imgEl.attr('src')||'',
      episode:$(e).find('.dtla span:contains("Episode")').text().replace('Episode','').trim(), source:'samehadaku'});
  });
  return data;
}

async function scrapeSearch(query) {
  const res = await axiosMulti(`/?s=${encodeURIComponent(query)}`, {Referer:SAMEHADAKU_DOMAINS[0]});
  const $ = cheerio.load(res.data); const data=[];
  $('.animpost').each((_,e)=>{
    const title=$(e).find('.data .title h2').text().trim();
    const url=$(e).find('a').attr('href');
    if(!title||!url) return;
    data.push({title, titleNorm:normalizeTitle(title),
      image:$(e).find('.content-thumb img').attr('src')||$(e).find('.content-thumb img').attr('data-src')||'',
      type:$(e).find('.type').text().trim(), score:$(e).find('.score').text().trim(), url, source:'samehadaku'});
  });
  return data;
}

async function scrapeDetail(url) {
  const targetUrl = url.startsWith('http') ? url : `${SAMEHADAKU_DOMAINS[0]}${url}`;
  let urlPath; try { urlPath=new URL(targetUrl).pathname; } catch(e) { urlPath=targetUrl; }
  const res = await axiosMulti(urlPath, {Referer:SAMEHADAKU_DOMAINS[0]});
  const $ = cheerio.load(res.data); const episodes=[];
  for (const sel of EP_SELS) {
    $(sel.list).each((_,e)=>{
      const epUrl=$(e).find(sel.link).attr('href'); const epTitle=$(e).find(sel.link).text().trim();
      if(epUrl&&!episodes.find(ep=>ep.url===epUrl))
        episodes.push({title:epTitle, url:epUrl, date:sel.date?$(e).find(sel.date).text().trim():''});
    });
    if(episodes.length>0) break;
  }
  const info={};
  $('.anim-senct .right-senc .spe span').each((_,e)=>{
    const t=$(e).text(); if(t.includes(':')){
      const idx=t.indexOf(':');
      info[t.substring(0,idx).trim().toLowerCase().replace(/\s+/g,'_')]=t.substring(idx+1).trim();
    }
  });
  const title=$('.anim-senct h1, .entry-title').first().text().replace(/- ?Samehadaku/gi,'').trim()||$('title').text().replace(/- ?Samehadaku/gi,'').trim();
  return { url, title,
    image:$('.anim-senct .left-senc img').attr('src')||$('.thumb img').attr('src')||$('meta[property="og:image"]').attr('content')||'',
    description:$('.entry-content').text().trim()||$('meta[name="description"]').attr('content')||'',
    info, episodes, streamSource:targetUrl };
}

async function scrapeWatch(url) {
  const targetUrl = url.startsWith('http') ? url : `${SAMEHADAKU_DOMAINS[0]}${url}`;
  let urlPath; try { urlPath=new URL(targetUrl).pathname; } catch(e) { urlPath=targetUrl; }
  const res=await axiosMulti(urlPath,{Referer:SAMEHADAKU_DOMAINS[0]});
  const cookies=res.headers['set-cookie']?.map(v=>v.split(';')[0]).join('; ')||'';
  const $=cheerio.load(res.data); const title=$('h1[itemprop="name"]').text().trim(); const streams=[];
  const DIRTY=['dood','streamtape','goplay','dutamovie','streamhide','clicknupload','upstream'];
  for (const li of $('div#server > ul > li').toArray()) {
    const div=$(li).find('div'); const post=div.attr('data-post');
    const nume=div.attr('data-nume'); const type=div.attr('data-type');
    const name=$(li).find('span').text().trim(); if(!post) continue;
    const body=new URLSearchParams({action:'player_ajax',post,nume,type}).toString();
    for (const px of PROXIES) {
      try {
        const ajaxUrl=px?px+`${SAMEHADAKU_DOMAINS[0]}/wp-admin/admin-ajax.php`:`${SAMEHADAKU_DOMAINS[0]}/wp-admin/admin-ajax.php`;
        const r=await axios.post(ajaxUrl,body,{headers:{...HEADERS,'Content-Type':'application/x-www-form-urlencoded','Cookie':cookies,'Referer':targetUrl},timeout:10000});
        const iframe=cheerio.load(r.data)('iframe').attr('src');
        if(iframe){streams.push({server:name,url:iframe});break;}
      } catch(e2){continue;}
    }
  }
  const clean=streams.filter(s=>!DIRTY.some(d=>(s.url||'').toLowerCase().includes(d)));
  return {title, streams:clean.length>0?clean:streams};
}

// =============================================
// MAL / JIKAN API — lebih akurat dari AniList
// =============================================
async function fetchMAL(searchTitle) {
  function cleanTitle(t) {
    return (t||'')
      .replace(/sub\s*indo/gi,'').replace(/subtitle\s*indonesia/gi,'')
      .replace(/\bcour\s*\d+/gi,'').replace(/\bpart\s*\d+/gi,'')
      .replace(/\bseason\s*\d+/gi,'').replace(/\bs\d+\b/gi,'')
      .replace(/\b(batch|bd|bluray|blu-ray|uncensored|ova|ona|special|movie)\b/gi,'')
      .replace(/\s*\(.*?\)/g,'').replace(/\s*\[.*?\]/g,'')
      .replace(/[^a-zA-Z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
  }
  async function jikanSearch(q) {
    if (!q || q.length < 2) return null;
    try {
      const res = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=1&type=tv`, {
        timeout: 10000, headers: { 'Accept': 'application/json' }
      });
      return res.data?.data?.[0] || null;
    } catch(e) { return null; }
  }
  try {
    const t0 = (searchTitle||'').replace(/sub\s*indo/gi,'').replace(/subtitle\s*indonesia/gi,'').trim();
    const t1 = cleanTitle(searchTitle);
    const t2 = t1.split(' ').slice(0,5).join(' ');
    const t3 = t1.split(' ').slice(0,3).join(' ');
    const t4 = t1.split(' ').slice(0,2).join(' ');
    let m = await jikanSearch(t0) || await jikanSearch(t1) || await jikanSearch(t2) || await jikanSearch(t3) || await jikanSearch(t4);
    if (!m) return null;
    await sleep(400); // Jikan rate limit
    // Ambil detail lengkap pakai mal_id
    let detail = m;
    try {
      const detailRes = await axios.get(`https://api.jikan.moe/v4/anime/${m.mal_id}/full`, { timeout: 10000 });
      if (detailRes.data?.data) detail = detailRes.data.data;
      await sleep(400);
    } catch(e) {}
    const genres = [...(detail.genres||[]), ...(detail.themes||[]), ...(detail.demographics||[])]
      .map(g => g.name).join(', ');
    const studio = (detail.studios||[]).map(s=>s.name).join(', ');
    const score = detail.score ? String(detail.score) : '';
    return {
      malId: detail.mal_id,
      title: detail.title_english || detail.title || '',
      titleEnglish: detail.title_english || detail.title || '',
      titleJapanese: detail.title_japanese || '',
      image: detail.images?.jpg?.large_image_url || detail.images?.jpg?.image_url || '',
      description: (detail.synopsis||'').replace(/\[Written.*?\]/g,'').trim(),
      score,
      rank: detail.rank || null,
      popularity: detail.popularity || null,
      trailerUrl: detail.trailer?.url || '',
      info: {
        tipe: detail.type || '',
        status: detail.status || '',
        season: detail.season && detail.year ? `${detail.season} ${detail.year}` : '',
        year: String(detail.year || detail.aired?.prop?.from?.year || ''),
        aired: detail.aired?.string || '',
        studio,
        source: detail.source || '',
        genre: genres,
        theme: (detail.themes||[]).map(t=>t.name).join(', '),
        demographic: (detail.demographics||[]).map(d=>d.name).join(', '),
        duration: detail.duration || '',
        episode_count: String(detail.episodes || ''),
        rating: detail.rating || '',
      }
    };
  } catch(e) { return null; }
}
// Alias untuk backward compat
const fetchAnilist = fetchMAL;
const BLOCKED_KW=['spongebob','pokemon','doraemon','paw patrol','peppa pig','tom and jerry','mickey','minions','upin','ipin','boboiboy'];
function isBlocked(a){
  const title=(a.title||'').toLowerCase();
  const type=(a.info?.tipe||a.info?.type||'').toLowerCase();
  const genre=(a.info?.genre||'').toLowerCase();
  if(['music','cm','pv'].includes(type)) return true;
  if(genre.includes('kids')) return true;
  if(BLOCKED_KW.some(kw=>title.includes(kw))) return true;
  return false;
}

// =============================================
// ROUTES
// =============================================
app.get('/api/ping', async(req,res)=>{
  try { await connectDB(); const count=await Anime.countDocuments(); res.json({status:'OK',db:'connected',animeCount:count}); }
  catch(e){res.json({status:'OK',db:'error: '+e.message});}
});

app.get('/api/db-stats', async(req,res)=>{
  try {
    await connectDB();
    const [animes,watches,latests]=await Promise.all([Anime.countDocuments(),Watch.countDocuments(),Latest.countDocuments()]);
    res.json({animes,watches,latests,total:animes+watches+latests});
  } catch(e){res.status(500).json({error:e.message});}
});

// LATEST - in-memory cache -> MongoDB cache -> DB query -> fallback scrape
app.get('/api/latest', async(req,res)=>{
  try {
    await connectDB();
    const page=parseInt(req.query.page)||1; const limit=parseInt(req.query.limit)||20; const skip=(page-1)*limit;
    res.set('Cache-Control','public, max-age=60, stale-while-revalidate=300');

    // 1. In-memory cache (paling cepat, ~0ms)
    if(page===1 && _memLatest && (Date.now()-_memLatestTs)<MEM_TTL) {
      return res.json(_memLatest);
    }

    // 2. MongoDB latestcaches (~10-30ms)
    if(page===1){
      const cached=await Latest.findById('latest').lean();
      if(cached&&Date.now()-cached.updatedAt<LATEST_TTL&&cached.data?.length>0){
        _memLatest=cached.data; _memLatestTs=Date.now();
        return res.json(cached.data);
      }
    }

    // 3. Query MongoDB animedetails langsung (tanpa countDocuments dulu)
    const docs=await Anime.find({episodes:{$not:{$size:0}}}).sort({updatedAt:-1}).skip(skip).limit(limit).lean();
    if(docs.length>0){
      const result=docs.filter(d=>!isBlocked(d)).map(d=>formatAnime(d));
      if(page===1&&result.length>0){
        _memLatest=result; _memLatestTs=Date.now();
        // Update cache DB di background - tidak blocking response
        Latest.findByIdAndUpdate('latest',{data:result,updatedAt:new Date()},{upsert:true}).catch(()=>{});
      }
      return res.json(result);
    }

    // 4. Fallback scrape Samehadaku
    const raw=await scrapeLatest(page);
    res.json(raw.filter(a=>!isBlocked(a)));
  } catch(e){res.status(500).json({error:e.message});}
});

// SEARCH — cari di MongoDB, fallback Samehadaku
app.get('/api/search', async(req,res)=>{
  const q=(req.query.q||'').trim(); if(!q) return res.json([]);
  try {
    await connectDB();
    const dbCount=await Anime.countDocuments();
    if(dbCount>0){
      const regex=new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');
      const docs=await Anime.find({$or:[{title:regex},{titleEnglish:regex},{titleJapanese:regex},{titleNorm:regex}]}).limit(30).lean();
      if(docs.length>0) return res.json(docs.filter(d=>!isBlocked(d)).map(d=>formatAnime(d)));
    }
    const results=await scrapeSearch(q);
    res.json(results.filter(a=>!isBlocked(a)));
  } catch(e){res.status(500).json({error:e.message});}
});

// DETAIL — baca dari MongoDB, scrape+simpan kalau belum ada
app.get('/api/detail', async(req,res)=>{
  try {
    await connectDB();
    const url=req.query.url; if(!url) return res.status(400).json({error:'url required'});
    const existing=await Anime.findOne({url});
    if(existing&&existing.episodes?.length>0){
      res.set('Cache-Control','public, max-age=300, stale-while-revalidate=600');
      return res.json(formatAnime(existing));
    }
    const data=await scrapeDetail(url);
    let al=null; try{al=await fetchAnilist(data.title);}catch(e){}
    const doc={
      url, title:al?.title||data.title, titleEnglish:al?.titleEnglish||'',
      titleJapanese:al?.titleJapanese||'', titleNorm:normalizeTitle(data.title),
      image:al?.image||data.image||'', description:al?.description||data.description||'',
      score:al?.score||data.info?.skor||'', rank:al?.rank||null, popularity:al?.popularity||null,
      trailerUrl:al?.trailerUrl||'', anilistId:al?.malId||al?.anilistId||null, anilistEnriched:!!al,
      info:{
        type:al?.info?.type||data.info?.tipe||'', status:al?.info?.status||data.info?.status||'',
        season:al?.info?.season||data.info?.musim||'', year:al?.info?.year||data.info?.tahun||'',
        aired:al?.info?.aired||'', studio:al?.info?.studio||data.info?.studio||'',
        source:al?.info?.source||'', genre:al?.info?.genre||data.info?.genre||'',
        theme:al?.info?.theme||'', demographic:al?.info?.demographic||'',
        duration:al?.info?.duration||data.info?.durasi||'',
        episode_count:al?.info?.episode_count||String(data.episodes?.length||0),
      },
      episodes:data.episodes||[], streamSource:url, updatedAt:new Date(),
    };
    await Anime.findOneAndUpdate({url},doc,{upsert:true,new:true});
    res.set('Cache-Control','public, max-age=300');
    res.json({...doc,source:'scraped+saved'});
  } catch(e){res.status(500).json({error:e.message});}
});

// WATCH — cek DB, scrape Samehadaku, simpan
app.get('/api/watch', async(req,res)=>{
  try {
    await connectDB();
    const url=req.query.url; if(!url) return res.status(400).json({error:'url required'});
    const existing=await Watch.findOne({url});
    if(existing&&Date.now()-existing.updatedAt<WATCH_TTL&&existing.streams?.length>0)
      return res.json({title:existing.title,streams:existing.streams,fromCache:true});
    const data=await scrapeWatch(url);
    if((!data.streams||data.streams.length===0)&&req.query.title){
      try {
        const results=await scrapeSearch(req.query.title);
        if(results[0]?.url){
          const detail=await scrapeDetail(results[0].url);
          const epNum=(req.query.ep||'').toString();
          const ep=detail.episodes?.find(e=>(e.title||'').toLowerCase().includes(`episode ${epNum}`)||(e.title||'').toLowerCase().endsWith(` ${epNum}`))||detail.episodes?.[0];
          if(ep?.url){const r2=await scrapeWatch(ep.url); if(r2.streams?.length>0) data.streams=r2.streams;}
        }
      } catch(e2){}
    }
    if(data.streams?.length>0) await Watch.findOneAndUpdate({url},{url,title:data.title,streams:data.streams,updatedAt:new Date()},{upsert:true});
    res.json(data);
  } catch(e){res.status(500).json({error:e.message});}
});

// BROWSE — filter dari DB
app.get('/api/browse', async(req,res)=>{
  try {
    await connectDB();
    const page=parseInt(req.query.page)||1; const limit=parseInt(req.query.limit)||24; const skip=(page-1)*limit;
    const filter={};
    if(req.query.genre) filter['info.genre']=new RegExp(req.query.genre,'i');
    if(req.query.status) filter['info.status']=new RegExp(req.query.status,'i');
    if(req.query.year) filter['info.year']=req.query.year;
    if(req.query.type) filter['info.type']=new RegExp(req.query.type,'i');
    const sortMap={latest:{updatedAt:-1},score:{score:-1},popularity:{popularity:1},title:{title:1}};
    const [docs,total]=await Promise.all([
      Anime.find(filter).sort(sortMap[req.query.sort]||sortMap.latest).skip(skip).limit(limit).lean(),
      Anime.countDocuments(filter),
    ]);
    res.json({data:docs.filter(d=>!isBlocked(d)).map(d=>formatAnime(d)),total,page,totalPages:Math.ceil(total/limit)});
  } catch(e){res.status(500).json({error:e.message});}
});

// TOP ANIME - in-memory cache + DB query (no countDocuments)
app.get('/api/top-anime', async(req,res)=>{
  try {
    await connectDB();
    const limit=Math.min(parseInt(req.query.limit)||60,200);
    res.set('Cache-Control','public, max-age=300, stale-while-revalidate=600');

    // In-memory cache
    if(_memTop && _memTop.length>=limit && (Date.now()-_memTopTs)<MEM_TTL) {
      return res.json(_memTop.slice(0,limit));
    }

    // Query langsung tanpa countDocuments
    const docs=await Anime.find({score:{$exists:true,$ne:''},episodes:{$not:{$size:0}}}).sort({score:-1}).limit(limit).lean();
    if(docs.length>0){
      const result=docs.filter(d=>!isBlocked(d)).map(d=>formatAnime(d));
      _memTop=result; _memTopTs=Date.now();
      return res.json(result);
    }
    // Fallback AniList kalau DB kosong
    const alRes=await axios.post('https://graphql.anilist.co',{
      query:`query{Page(page:1,perPage:${limit}){media(type:ANIME,sort:SCORE_DESC,isAdult:false){id title{romaji english}coverImage{extraLarge}averageScore popularity format status genres}}}`
    },{headers:{'Content-Type':'application/json'},timeout:8000});
    const medias=alRes.data?.data?.Page?.media||[];
    res.json(medias.map(m=>({title:m.title?.romaji||'',titleEnglish:m.title?.english||'',image:m.coverImage?.extraLarge||'',score:m.averageScore?String(m.averageScore/10):'',popularity:m.popularity,info:{type:m.format,status:m.status,genre:m.genres?.join(', ')},source:'anilist'})));
  } catch(e){res.status(500).json({error:e.message});}
});

// GENRES list
app.get('/api/genres', async(req,res)=>{
  try {
    await connectDB();
    const docs=await Anime.find({'info.genre':{$exists:true,$ne:''}},{'info.genre':1}).lean();
    const set=new Set();
    docs.forEach(d=>(d.info?.genre||'').split(',').forEach(g=>{const t=g.trim();if(t)set.add(t);}));
    res.json([...set].sort());
  } catch(e){res.status(500).json({error:e.message});}
});

// GENRE filter
app.get('/api/genre', async(req,res)=>{
  const genre=req.query.name||''; const page=parseInt(req.query.page)||1; const limit=Math.min(parseInt(req.query.limit)||24,200); const skip=(page-1)*limit;
  try {
    await connectDB();
    // Pakai $regex dengan index hint supaya cepat
    const escaped = genre.replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&');
    const filter = genre ? {'info.genre':{$regex:escaped,$options:'i'}, episodes:{$not:{$size:0}}} : {episodes:{$not:{$size:0}}};
    const [docs,total] = await Promise.all([
      Anime.find(filter, {episodes:0}).sort({score:-1}).skip(skip).limit(limit).lean(),
      Anime.countDocuments(filter)
    ]);
    res.json({data:docs.filter(d=>!isBlocked(d)).map(d=>formatAnime(d)),total,page,totalPages:Math.ceil(total/limit)});
  } catch(e){res.status(500).json({error:e.message});}
});

// ANILIST by ID
app.get('/api/anilist/:id', async(req,res)=>{
  try {
    await connectDB();
    const id=parseInt(req.params.id); const doc=await Anime.findOne({anilistId:id});
    if(doc) return res.json(formatAnime(doc));
    const alRes=await axios.post('https://graphql.anilist.co',{
      query:`query($id:Int){Media(id:$id,type:ANIME){id title{romaji english native}description coverImage{extraLarge}averageScore popularity genres format status episodes season seasonYear studios(isMain:true){nodes{name}}}}`,
      variables:{id}
    },{headers:{'Content-Type':'application/json'},timeout:8000});
    const m=alRes.data?.data?.Media; if(!m) return res.status(404).json({error:'Not found'});
    res.json({anilistId:m.id,title:m.title?.romaji,titleEnglish:m.title?.english,image:m.coverImage?.extraLarge,description:(m.description||'').replace(/<[^>]*>/g,''),score:m.averageScore?String(m.averageScore/10):'',info:{type:m.format,status:m.status,genre:(()=>{
        const GM={'Slice of Life':'Slice Of Life','Super Powers':'Super Power','Mahou Shoujo':'Mahou Shoujo','Boys Love':'Boys Love','Girls Love':'Girls Love'};
        return (m.genres||[]).map(g=>GM[g]||g).join(', ');
      })(),episode_count:String(m.episodes||''),studio:m.studios?.nodes?.map(s=>s.name).join(', ')||''},source:'anilist'});
  } catch(e){res.status(500).json({error:e.message});}
});

// CLEAR CACHE
app.get('/api/force-fix', async(req,res)=>{
  try {
    await connectDB();
    const limit = Math.min(parseInt(req.query.limit)||20, 50);
    const skip = parseInt(req.query.skip)||0;
    // Ambil SEMUA anime termasuk yang sudah anilistEnriched
    const docs = await Anime.find({}).skip(skip).limit(limit).lean();
    let fixed=0; let failed=0;
    for (const doc of docs) {
      try {
        const searchQ = doc.titleEnglish||doc.title||doc.titleNorm||'';
        const al = await fetchAnilist(searchQ);
        if (!al) { failed++; continue; }
        const cleanTitle = (al.titleEnglish||al.title||doc.title||'')
          .replace(/sub\s*indo/gi,'').replace(/subtitle\s*indonesia/gi,'')
          .replace(/\bcour\s*\d+/gi,'').replace(/\bpart\s*\d+/gi,'')
          .replace(/\bseason\s*\d+/gi,'').replace(/\s+/g,' ').trim();
        await Anime.findByIdAndUpdate(doc._id, { $set: {
          title: cleanTitle,
          titleEnglish: al.titleEnglish||doc.titleEnglish||'',
          titleJapanese: al.titleJapanese||doc.titleJapanese||'',
          image: al.image||doc.image||'',
          description: al.description||doc.description||'',
          score: al.score||doc.score||'',
          rank: al.rank||doc.rank||null,
          popularity: al.popularity||doc.popularity||null,
          trailerUrl: al.trailerUrl||doc.trailerUrl||'',
          anilistId: al.malId||al.anilistId||doc.anilistId||null,
          anilistEnriched: true,
          'info.tipe': al.info?.tipe||al.info?.type||doc.info?.tipe||'',
          'info.status': al.info?.status||doc.info?.status||'',
          'info.season': al.info?.season||doc.info?.season||'',
          'info.year': al.info?.year||doc.info?.year||'',
          'info.studio': al.info?.studio||doc.info?.studio||'',
          'info.genre': al.info?.genre||doc.info?.genre||'',
          'info.theme': al.info?.theme||doc.info?.theme||'',
          'info.demographic': al.info?.demographic||doc.info?.demographic||'',
          'info.duration': al.info?.duration||doc.info?.duration||'',
          'info.episode_count': al.info?.episode_count||doc.info?.episode_count||'',
          'info.rating': al.info?.rating||doc.info?.rating||'',
        }});
        fixed++;
        await sleep(500); // Jikan rate limit
      } catch(e) { failed++; }
    }
    const total = await Anime.countDocuments();
    res.json({ status:'done', fixed, failed, processed: docs.length, skip, total, next_skip: skip+limit });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/dedup', async(req,res)=>{
  try {
    await connectDB();
    let removed = 0;

    // Helper: dari list _id, ambil semua dokumen lalu hapus yang episodenya paling sedikit
    async function dedupKeepMostEps(ids) {
      if (!ids || ids.length < 2) return;
      const docs = await Anime.find({ _id: { $in: ids } }, { _id:1, episodes:1 }).lean();
      // Urutkan: yang paling banyak episode di depan
      docs.sort((a, b) => (b.episodes?.length||0) - (a.episodes?.length||0));
      const toDelete = docs.slice(1).map(d => d._id); // buang yang episodenya lebih sedikit
      if (toDelete.length > 0) {
        await Anime.deleteMany({ _id: { $in: toDelete } });
        removed += toDelete.length;
      }
    }

    // 1. Duplikat berdasarkan URL — keep yang episodenya paling banyak
    const dupsByUrl = await Anime.aggregate([
      { $group: { _id: '$url', ids: { $push: '$_id' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    for (const dup of dupsByUrl) {
      await dedupKeepMostEps(dup.ids);
    }

    // 2. Duplikat berdasarkan anilistId — keep yang episodenya paling banyak
    const dupsByAnilist = await Anime.aggregate([
      { $match: { anilistId: { $ne: null } } },
      { $group: { _id: '$anilistId', ids: { $push: '$_id' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    for (const dup of dupsByAnilist) {
      await dedupKeepMostEps(dup.ids);
    }

    // 3. Duplikat berdasarkan titleNorm — keep yang episodenya paling banyak
    const dupsByTitle = await Anime.aggregate([
      { $match: { titleNorm: { $ne: '', $exists: true } } },
      { $group: { _id: '$titleNorm', ids: { $push: '$_id' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    for (const dup of dupsByTitle) {
      await dedupKeepMostEps(dup.ids);
    }

    // 4. Deduplicate streams dalam collection watches (hapus stream URL sama)
    let streamsCleaned = 0;
    const watches = await Watch.find({}).lean();
    for (const w of watches) {
      const seenUrls = new Set();
      const uniqueStreams = (w.streams||[]).filter(s => {
        if (!s.url || seenUrls.has(s.url)) return false;
        seenUrls.add(s.url);
        return true;
      });
      if (uniqueStreams.length !== (w.streams||[]).length) {
        await Watch.findByIdAndUpdate(w._id, { streams: uniqueStreams });
        streamsCleaned++;
      }
    }

    // 5. Deduplicate episodes dalam tiap anime (hapus episode URL sama)
    let episodesCleaned = 0;
    const animes = await Anime.find({ 'episodes.0': { $exists: true } }, { _id:1, episodes:1 }).lean();
    for (const a of animes) {
      const seenUrls = new Set();
      const uniqueEps = (a.episodes||[]).filter(ep => {
        if (!ep.url || seenUrls.has(ep.url)) return false;
        seenUrls.add(ep.url);
        return true;
      });
      if (uniqueEps.length !== (a.episodes||[]).length) {
        await Anime.findByIdAndUpdate(a._id, { episodes: uniqueEps });
        episodesCleaned++;
      }
    }

    // 6. Bersihkan judul dari "Sub Indo", "Season X" dll
    const all = await Anime.find({}, { _id:1, title:1 }).lean();
    let cleaned = 0;
    for (const doc of all) {
      const cleanedTitle = (doc.title||'')
        .replace(/sub\s*indo/gi,'').replace(/subtitle\s*indonesia/gi,'')
        .replace(/\bcour\s*\d+/gi,'').replace(/\bpart\s*\d+/gi,'')
        .replace(/\s+/g,' ').trim();
      if (cleanedTitle !== doc.title) {
        await Anime.findByIdAndUpdate(doc._id, { title: cleanedTitle });
        cleaned++;
      }
    }

    // Reset latest cache
    await Latest.deleteMany({});
    _memLatest = null; _memLatestTs = 0;
    _memTop = null; _memTopTs = 0;

    res.json({
      status: 'done',
      animeDuplicatesRemoved: removed,
      watchStreamsCleaned: streamsCleaned,
      animeEpisodesCleaned: episodesCleaned,
      titlesCleaned: cleaned,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/cache-clear', async(req,res)=>{
  try {
    await connectDB();
    const url=req.query.url; const type=req.query.type||'watch';
    if(url){await Watch.deleteOne({url}); if(type==='all') await Anime.deleteOne({url}); return res.json({message:'Cache dihapus untuk: '+url});}
    if(type==='all'){await Promise.all([Watch.deleteMany({}),Anime.deleteMany({}),Latest.deleteMany({})]);return res.json({message:'Semua data dihapus.'});}
    if(type==='watch'){await Watch.deleteMany({});return res.json({message:'Watch cache dihapus.'});}
    await Latest.deleteMany({}); res.json({message:'Latest cache dihapus.'});
  } catch(e){res.status(500).json({error:e.message});}
});

// =============================================
// SCRAPE-ALL — isi DB dari Samehadaku/Otakudesu
// =============================================
const OTAKUDESU_DOMAINS = [
  'https://otakudesu.cloud',
  'https://otakudesu.lol',
  'https://otakudesu.media',
];

async function axiosOtaku(path, extra={}, timeout=20000) {
  for (const base of OTAKUDESU_DOMAINS) {
    try {
      const res = await axiosGet(`${base}${path}`, extra, timeout);
      if ((typeof res.data==='string'?res.data:'').length>500) return res;
    } catch(e) { continue; }
  }
  throw new Error('All otakudesu domains failed: '+path);
}

async function scrapeOtakudesuList(page=1, type='ongoing') {
  const urlPath = type==='ongoing' ? `/ongoing-anime/page/${page}/` : `/complete-anime/page/${page}/`;
  const res = await axiosOtaku(urlPath);
  const $ = cheerio.load(res.data); const items=[];

  // Coba berbagai selector — Otakudesu sering ganti struktur HTML
  const selectors = [
    { wrap:'.venz ul li', link:'.thumb a', img:'.thumb img', title:'.thumbz h2', ep:'.epz' },
    { wrap:'.os-list ul li', link:'a', img:'img', title:'h2', ep:'.episode' },
    { wrap:'.detpost', link:'a', img:'img', title:'.jtitle', ep:'.epz' },
    { wrap:'article.animpost', link:'a', img:'img', title:'.tt h4', ep:'.epx' },
    { wrap:'.col-anime', link:'a', img:'img', title:'.col-anime-title', ep:'.col-anime-ep' },
  ];

  for (const sel of selectors) {
    $(sel.wrap).each((_,e)=>{
      const a=$(e).find(sel.link).first(); const img=$(e).find(sel.img).first();
      const url=a.attr('href')||''; const title=$(e).find(sel.title).text().trim()||a.attr('title')||'';
      if(!url||!title) return;
      items.push({ url, title, titleNorm:normalizeTitle(title),
        image:img.attr('src')||img.attr('data-src')||img.attr('data-lazy-src')||'',
        episode:$(e).find(sel.ep).text().trim(), source:'otakudesu' });
    });
    if(items.length>0) break;
  }

  // Fallback: cari semua link anime dari halaman
  if(items.length===0){
    $('a[href*="/anime/"]').each((_,e)=>{
      const url=$(e).attr('href')||''; const title=$(e).text().trim()||$(e).attr('title')||'';
      if(!url||!title||title.length<3) return;
      if(items.find(i=>i.url===url)) return;
      const img=$(e).find('img');
      items.push({ url, title, titleNorm:normalizeTitle(title),
        image:img.attr('src')||img.attr('data-src')||'',
        episode:'', source:'otakudesu' });
    });
  }

  return items;
}

async function scrapeOtakudesuDetail(url) {
  const targetUrl = url.startsWith('http') ? url : `${OTAKUDESU_DOMAINS[0]}${url}`;
  let urlPath; try { urlPath=new URL(targetUrl).pathname; } catch(e) { urlPath=targetUrl; }
  const res = await axiosOtaku(urlPath);
  const $ = cheerio.load(res.data); const episodes=[];
  // Otakudesu episode list
  $('.episodelist ul li').each((_,e)=>{
    const a=$(e).find('a'); const epUrl=a.attr('href'); const epTitle=a.text().trim();
    if(epUrl&&!episodes.find(ep=>ep.url===epUrl))
      episodes.push({title:epTitle, url:epUrl, date:$(e).find('.zeebr').text().trim()});
  });
  if(episodes.length===0){
    $('.venz ul li').each((_,e)=>{
      const a=$(e).find('a'); const epUrl=a.attr('href'); const epTitle=a.text().trim();
      if(epUrl&&!episodes.find(ep=>ep.url===epUrl))
        episodes.push({title:epTitle, url:epUrl, date:''});
    });
  }
  const info={};
  $('.infozingle p').each((_,e)=>{
    const t=$(e).text(); if(t.includes(':')){ const idx=t.indexOf(':');
      info[t.substring(0,idx).trim().toLowerCase().replace(/\s+/g,'_')]=t.substring(idx+1).trim(); }
  });
  const title=$('.jdlrx h1, .entry-title').first().text().replace(/subtitle indonesia/gi,'').trim()||$('title').text().replace(/- Otakudesu/gi,'').trim();
  return { url, title,
    image:$('.fotoanime img').attr('src')||$('meta[property="og:image"]').attr('content')||'',
    description:$('.sinopc').text().trim()||$('meta[name="description"]').attr('content')||'',
    info, episodes, streamSource:targetUrl };
}

app.get('/api/debug-sama', async(req,res)=>{
  try {
    const page = parseInt(req.query.page)||1;
    const r = await axiosMulti(`/anime-terbaru/page/${page}/`, {Referer:SAMEHADAKU_DOMAINS[0]});
    const html = typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
    res.json({ status:'ok', domain: SAMEHADAKU_DOMAINS[0], length: html.length, preview: html.substring(0,3000) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/debug-otaku', async(req,res)=>{
  try {
    const page = parseInt(req.query.page)||1;
    const type = req.query.type||'ongoing';
    const urlPath = type==='ongoing' ? `/ongoing-anime/page/${page}/` : `/complete-anime/page/${page}/`;
    const r = await axiosOtaku(urlPath);
    const html = typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
    // Kirim 3000 karakter pertama buat debug
    res.json({ status:'ok', url: urlPath, length: html.length, preview: html.substring(0,3000) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/scrape-all', async(req,res)=>{
  try {
    await connectDB();
    const source = req.query.source||'samehadaku'; // samehadaku | otakudesu_ongoing | otakudesu_complete
    const pages = Math.min(parseInt(req.query.pages)||1, 20);
    const startPage = parseInt(req.query.startPage)||1;
    const results=[]; let saved=0; let skipped=0;

    for (let page=startPage; page<startPage+pages; page++) {
      let items=[];
      try {
        if(source==='samehadaku') items = await scrapeLatest(page);
        else if(source==='otakudesu_ongoing') items = await scrapeOtakudesuList(page,'ongoing');
        else if(source==='otakudesu_complete') items = await scrapeOtakudesuList(page,'complete');
      } catch(e) { results.push({page,error:e.message}); continue; }

      for (const item of items) {
        if(isBlocked(item)){skipped++;continue;}
        try {
          const existing = await Anime.findOne({url:item.url});
          if(existing&&existing.episodes?.length>0){skipped++;continue;}
          // Scrape detail
          let detail={episodes:[],info:{},image:item.image,description:''};
          try {
            if(source==='samehadaku') detail=await scrapeDetail(item.url);
            else detail=await scrapeOtakudesuDetail(item.url);
          } catch(e2){}
          // Enrich with Anilist
          let al=null; try{al=await fetchAnilist(detail.title||item.title);}catch(e3){}
          const doc={
            url:item.url, title:(()=>{
              const raw = al?.title||detail.title||item.title||'';
              return raw.replace(/sub\s*indo/gi,'').replace(/subtitle\s*indonesia/gi,'')
                .replace(/\bcour\s*\d+/gi,'').replace(/\bpart\s*\d+/gi,'')
                .replace(/\bseason\s*\d+/gi,'')
                .replace(/\s+/g,' ').trim();
            })(),
            titleEnglish:al?.titleEnglish||'', titleJapanese:al?.titleJapanese||'',
            titleNorm:normalizeTitle(detail.title||item.title),
            image:al?.image||detail.image||item.image||'',
            description:al?.description||detail.description||'',
            score:al?.score||'', rank:al?.rank||null, popularity:al?.popularity||null,
            trailerUrl:al?.trailerUrl||'', anilistId:al?.malId||al?.anilistId||null, anilistEnriched:!!al,
            info:{
              tipe:al?.info?.type||detail.info?.tipe||detail.info?.type||'',
              status:al?.info?.status||detail.info?.status||'',
              season:al?.info?.season||'', year:al?.info?.year||detail.info?.tahun||'',
              aired:al?.info?.aired||'', studio:al?.info?.studio||detail.info?.studio||'',
              source:al?.info?.source||'', genre:al?.info?.genre||detail.info?.genre||'',
              theme:al?.info?.theme||'', demographic:al?.info?.demographic||'',
              duration:al?.info?.duration||detail.info?.durasi||'',
              episode_count:al?.info?.episode_count||String(detail.episodes?.length||0),
            },
            episodes:detail.episodes||[], streamSource:item.url, updatedAt:new Date(),
          };
          await Anime.findOneAndUpdate({url:item.url},doc,{upsert:true,new:true});
          saved++; await sleep(300); // gentle delay
        } catch(e4){ results.push({url:item.url,error:e4.message}); }
      }
      results.push({page,scraped:items.length});
      await sleep(500);
    }
    res.json({status:'done',saved,skipped,pages:results});
  } catch(e){res.status(500).json({error:e.message});}
});

// SCRAPE-FULL — scrape semua halaman Samehadaku otomatis sampai habis, metadata dari MAL
app.get('/api/scrape-full', async(req,res)=>{
  try {
    await connectDB();
    const startPage = parseInt(req.query.startPage)||1;
    const maxPages  = Math.min(parseInt(req.query.maxPages)||20, 20); // max 20 page per request
    const results=[]; let saved=0; let skipped=0;

    for (let page=startPage; page<startPage+maxPages; page++) {
      let items=[];
      try { items = await scrapeLatest(page); }
      catch(e) { results.push({page, error:e.message}); break; }

      // Kalau halaman kosong, berarti sudah habis
      if(!items||items.length===0){ results.push({page, done:true}); break; }

      for (const item of items) {
        if(isBlocked(item)){skipped++;continue;}
        try {
          // Skip kalau sudah ada dan punya episode
          const existing = await Anime.findOne({url:item.url});
          if(existing&&existing.episodes?.length>0){skipped++;continue;}

          // Scrape episode & stream dari Samehadaku
          let detail={episodes:[],info:{},image:item.image,description:''};
          try { detail = await scrapeDetail(item.url); } catch(e2){}

          // Metadata dari MAL/Jikan — title English, poster, rating, genre dll
          const searchQ = detail.title||item.title||'';
          let mal=null;
          try { mal = await fetchMAL(searchQ); } catch(e3){}

          const finalTitle = mal?.titleEnglish || mal?.title || detail.title || item.title || '';
          const doc = {
            url: item.url,
            title: finalTitle.replace(/sub\s*indo/gi,'').replace(/subtitle\s*indonesia/gi,'').replace(/\s+/g,' ').trim(),
            titleEnglish: mal?.titleEnglish || '',
            titleJapanese: mal?.titleJapanese || '',
            titleNorm: normalizeTitle(detail.title||item.title),
            image: mal?.image || detail.image || item.image || '',
            description: mal?.description || detail.description || '',
            score: mal?.score || '',
            rank: mal?.rank || null,
            popularity: mal?.popularity || null,
            trailerUrl: mal?.trailerUrl || '',
            anilistId: mal?.malId || null,
            anilistEnriched: !!mal,
            info: {
              tipe: mal?.info?.tipe || detail.info?.tipe || '',
              status: mal?.info?.status || detail.info?.status || '',
              season: mal?.info?.season || '',
              year: mal?.info?.year || detail.info?.tahun || '',
              aired: mal?.info?.aired || '',
              studio: mal?.info?.studio || detail.info?.studio || '',
              source: mal?.info?.source || '',
              genre: mal?.info?.genre || detail.info?.genre || '',
              theme: mal?.info?.theme || '',
              demographic: mal?.info?.demographic || '',
              duration: mal?.info?.duration || detail.info?.durasi || '',
              episode_count: mal?.info?.episode_count || String(detail.episodes?.length||0),
              rating: mal?.info?.rating || '',
            },
            episodes: detail.episodes || [],
            streamSource: item.url,
            updatedAt: new Date(),
          };
          await Anime.findOneAndUpdate({url:item.url}, doc, {upsert:true, new:true});
          saved++;
          await sleep(400); // Jikan rate limit
        } catch(e4){ results.push({url:item.url, error:e4.message}); }
      }
      results.push({page, scraped:items.length});
      await sleep(500);
    }
    res.json({
      status:'done', saved, skipped,
      next_startPage: startPage+maxPages,
      pages: results
    });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// FIX-METADATA — isi ulang gambar/score/genre dari Anilist untuk anime yang datanya kosong
app.get('/api/fix-metadata', async(req,res)=>{
  try {
    await connectDB();
    const limit=Math.min(parseInt(req.query.limit)||30,100);
    // Cari anime yang belum di-enrich Anilist atau tidak ada gambar
    const docs=await Anime.find({
      $or:[{anilistEnriched:{$ne:true}},{image:{$in:['',null]}},{score:{$in:['',null]}}]
    }).limit(limit).lean();
    let fixed=0; let failed=0;
    for(const doc of docs){
      try{
        const al=await fetchAnilist(doc.titleEnglish||doc.title||doc.titleNorm||'');
        if(!al){failed++;continue;}
        await Anime.findByIdAndUpdate(doc._id,{
          $set:{
            titleEnglish:al.titleEnglish||doc.titleEnglish||'',
            titleJapanese:al.titleJapanese||doc.titleJapanese||'',
            image:al.image||doc.image||'',
            description:al.description||doc.description||'',
            score:al.score||doc.score||'',
            rank:al.rank||doc.rank||null,
            popularity:al.popularity||doc.popularity||null,
            trailerUrl:al.trailerUrl||doc.trailerUrl||'',
            anilistId:al.malId||al.anilistId||doc.anilistId||null,
            anilistEnriched:true,
            'info.tipe':al.info?.type||doc.info?.tipe||'',
            'info.status':al.info?.status||doc.info?.status||'',
            'info.season':al.info?.season||doc.info?.season||'',
            'info.year':al.info?.year||doc.info?.year||'',
            'info.studio':al.info?.studio||doc.info?.studio||'',
            'info.genre':al.info?.genre||doc.info?.genre||'',
            'info.theme':al.info?.theme||doc.info?.theme||'',
            'info.demographic':al.info?.demographic||doc.info?.demographic||'',
            'info.duration':al.info?.duration||doc.info?.duration||'',
            'info.episode_count':al.info?.episode_count||doc.info?.episode_count||'',
          }
        });
        fixed++; await sleep(400);
      } catch(e){failed++;}
    }
    res.json({status:'done',fixed,failed,total:docs.length});
  } catch(e){res.status(500).json({error:e.message});}
});

// HEAL-EMPTY — re-scrape anime yang episode-nya kosong
app.get('/api/heal-empty', async(req,res)=>{
  try {
    await connectDB();
    const limit=Math.min(parseInt(req.query.limit)||20,50);
    const docs=await Anime.find({
      $or:[{episodes:{$size:0}},{episodes:{$exists:false}}]
    }).limit(limit).lean();
    let healed=0; let failed=0;
    for(const doc of docs){
      try{
        let detail=null;
        try{ detail=await scrapeDetail(doc.url); }catch(e1){}
        if(!detail||!detail.episodes?.length){
          try{ detail=await scrapeOtakudesuDetail(doc.url); }catch(e2){}
        }
        if(detail?.episodes?.length>0){
          await Anime.findByIdAndUpdate(doc._id,{
            $set:{episodes:detail.episodes,streamSource:doc.url,updatedAt:new Date()}
          });
          healed++;
        } else { failed++; }
        await sleep(500);
      }catch(e){failed++;}
    }
    res.json({status:'done',healed,failed,total:docs.length});
  } catch(e){res.status(500).json({error:e.message});}
});

// DEBUG
app.get('/api/debug-scrape', async(req,res)=>{
  const {url}=req.query; if(!url) return res.status(400).json({error:'url required'});
  try {
    const data=await scrapeDetail(url); let al=null; try{al=await fetchAnilist(data.title);}catch(e){}
    res.json({title:data.title,episodeCount:data.episodes?.length||0,firstEp:data.episodes?.[0],lastEp:data.episodes?.[data.episodes.length-1],image:data.image,anilistEnriched:!!al,anilistData:al,info:data.info});
  } catch(e){res.status(500).json({error:e.message});}
});

// NOTE: Static catch-all removed for Vercel compatibility
// Vercel serves public/ via vercel.json rewrites instead

// Jalanin server lokal kalau bukan di Vercel
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n🚀 Animeku API on port ${PORT}`);
    console.log(`📦 MongoDB: ${process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0,40)+'...' : 'NOT SET ❌'}`);
  });
}

// Export untuk Vercel serverless
module.exports = app;
