const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 8124;
const ROOT = __dirname;
const IS_VERCEL = Boolean(process.env.VERCEL);
const CONFIG_FILE = IS_VERCEL
  ? path.join(os.tmpdir(), 'pelisstart-api-keys.json')
  : path.join(ROOT, 'api-keys.json');
const ENV_FILE = path.join(ROOT, '.env');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
};

const BLOCKED_STATIC = new Set(['/api-keys.json', '/.env', '/lista']);

// Maps PelisStart Spanish category names -> Cinemeta English genre & TMDB genre IDs
const CATEGORY_MAP = {
  'Tendencias': { cinemeta: null, tmdbMovie: null, tmdbTv: null },
  'Navidad': { cinemeta: 'Family', tmdbKeyword: 207317 },
  'Acción': { cinemeta: 'Action', tmdbMovie: 28, tmdbTv: 10759 },
  'Ciencia Ficción': { cinemeta: 'Sci-Fi', tmdbMovie: 878, tmdbTv: 10765 },
  'Aventura': { cinemeta: 'Adventure', tmdbMovie: 12, tmdbTv: 10759 },
  'Animación': { cinemeta: 'Animation', tmdbMovie: 16, tmdbTv: 16 },
  'Comedia': { cinemeta: 'Comedy', tmdbMovie: 35, tmdbTv: 35 },
  'Drama': { cinemeta: 'Drama', tmdbMovie: 18, tmdbTv: 18 },
  'Terror': { cinemeta: 'Horror', tmdbMovie: 27, tmdbTv: 9648 },
  'Crimen y Suspenso': { cinemeta: 'Crime', tmdbMovie: 80, tmdbTv: 80 },
};

const EN_TO_ES_GENRE = {
  Action: 'Acción',
  'Action & Adventure': 'Acción',
  Adventure: 'Aventura',
  Animation: 'Animación',
  Comedy: 'Comedia',
  Crime: 'Crimen y Suspenso',
  Thriller: 'Crimen y Suspenso',
  Mystery: 'Crimen y Suspenso',
  Drama: 'Drama',
  Horror: 'Terror',
  'Sci-Fi': 'Ciencia Ficción',
  'Sci-Fi & Fantasy': 'Ciencia Ficción',
  'Science Fiction': 'Ciencia Ficción',
  Fantasy: 'Aventura',
  Family: 'Animación',
};

const TMDB_GENRE_ES = {
  28: 'Acción',
  12: 'Aventura',
  16: 'Animación',
  35: 'Comedia',
  80: 'Crimen y Suspenso',
  18: 'Drama',
  14: 'Aventura',
  27: 'Terror',
  9648: 'Crimen y Suspenso',
  878: 'Ciencia Ficción',
  53: 'Crimen y Suspenso',
  10759: 'Acción',
  10765: 'Ciencia Ficción',
};

/* ==================== TTL Cache ==================== */
const cache = new Map();

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.exp) {
    cache.delete(key);
    return null;
  }
  return entry.val;
}

function setCache(key, val, ttlMs) {
  if (cache.size > 400) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { val, exp: Date.now() + ttlMs });
}

/* ==================== Config & Env ==================== */
function loadDotEnv() {
  if (!fs.existsSync(ENV_FILE)) return;
  try {
    const lines = fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // Ignore malformed .env
  }
}

loadDotEnv();

function readApiConfig() {
  let fileCfg = {};
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fileCfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) || {};
    }
  } catch {
    fileCfg = {};
  }

  return {
    tmdbKey: (fileCfg.tmdbKey || process.env.TMDB_BEARER_TOKEN || process.env.TMDB_API_KEY || '').trim(),
    omdbKey: (fileCfg.omdbKey || process.env.OMDB_API_KEY || '').trim(),
    rapidApiKey: (fileCfg.rapidApiKey || process.env.RAPIDAPI_KEY || '').trim(),
    rapidApiHost: (fileCfg.rapidApiHost || process.env.RAPIDAPI_HOST || 'moviesdatabase.p.rapidapi.com').trim(),
  };
}

function writeApiConfig(updates) {
  let current = {};
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      current = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) || {};
    }
  } catch {
    current = {};
  }

  const next = { ...current };
  for (const field of ['tmdbKey', 'omdbKey', 'rapidApiKey', 'rapidApiHost']) {
    if (typeof updates[field] === 'string') {
      const val = updates[field].trim();
      if (val) next[field] = val;
      else delete next[field];
    }
  }

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf8');
  cache.clear();
  return readApiConfig();
}

function maskSecret(val) {
  if (!val) return '';
  if (val.length <= 6) return '***';
  return `${val.slice(0, 3)}•••${val.slice(-3)}`;
}

/* ==================== HTTP Helpers ==================== */
function sendCorsHeaders(res, extra = {}) {
  res.writeHead(res.statusCode || 200, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    ...extra,
  });
}

function sendJson(res, status, data) {
  res.statusCode = status;
  sendCorsHeaders(res, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readRequestBody(req, maxBytes = 65536) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'PelisStart/2.0',
        ...(options.headers || {}),
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonSafe(url, options = {}, timeoutMs = 8000) {
  const res = await fetchWithTimeout(url, options, timeoutMs);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function getLanIps() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === 'IPv4' && !iface.internal)
    .map((iface) => iface.address);
}

/* ==================== TMDB Client ==================== */
function tmdbRequestInit(tmdbKey, endpointPath) {
  const isBearer = tmdbKey.length > 40 && tmdbKey.includes('.');
  const sep = endpointPath.includes('?') ? '&' : '?';
  const url = isBearer
    ? `https://api.themoviedb.org/3${endpointPath}`
    : `https://api.themoviedb.org/3${endpointPath}${sep}api_key=${encodeURIComponent(tmdbKey)}`;
  const headers = { accept: 'application/json' };
  if (isBearer) headers.Authorization = `Bearer ${tmdbKey}`;
  return { url, headers };
}

async function tmdbFetch(tmdbKey, endpointPath) {
  if (!tmdbKey) return null;
  const { url, headers } = tmdbRequestInit(tmdbKey, endpointPath);
  return fetchJsonSafe(url, { headers }, 8000);
}

function mapTmdbItem(raw, forcedType = null) {
  const mediaType = forcedType || (raw.media_type === 'tv' || raw.first_air_date ? 'serial' : 'movie');
  const title = raw.title || raw.name || raw.original_title || raw.original_name || '';
  const dateStr = raw.release_date || raw.first_air_date || '';
  const year = dateStr ? Number(dateStr.slice(0, 4)) : '';
  const genreIds = Array.isArray(raw.genre_ids)
    ? raw.genre_ids
    : Array.isArray(raw.genres)
      ? raw.genres.map((g) => g.id)
      : [];
  const categories = [...new Set(genreIds.map((id) => TMDB_GENRE_ES[id]).filter(Boolean))];
  if (!categories.length) categories.push(mediaType === 'serial' ? 'Series' : 'Películas');

  return {
    id: raw.imdb_id || String(raw.id),
    tmdbId: String(raw.id),
    imdbId: raw.imdb_id || '',
    title,
    type: mediaType,
    year,
    rating: raw.vote_average ? Number(raw.vote_average).toFixed(1) : '',
    duration: mediaType === 'serial' ? 'Serie' : 'Película',
    categories,
    poster: raw.poster_path ? `https://image.tmdb.org/t/p/w500${raw.poster_path}` : '',
    backdrop: raw.backdrop_path ? `https://image.tmdb.org/t/p/w1280${raw.backdrop_path}` : '',
    synopsis: raw.overview || '',
    source: 'TMDB',
  };
}

async function resolveTmdbImdbId(tmdbKey, tmdbId, type) {
  const cacheKey = `tmdb_ext:${type}:${tmdbId}`;
  const cached = getCache(cacheKey);
  if (cached !== null) return cached;
  try {
    const endpoint = type === 'serial' ? `/tv/${tmdbId}/external_ids` : `/movie/${tmdbId}/external_ids`;
    const data = await tmdbFetch(tmdbKey, endpoint);
    const imdb = data && data.imdb_id ? data.imdb_id : '';
    setCache(cacheKey, imdb, 86400000);
    return imdb;
  } catch {
    return '';
  }
}

/* ==================== Cinemeta & TVmaze Helpers ==================== */
function mapCinemetaGenres(genres) {
  const mapped = [];
  for (const g of genres || []) {
    const es = EN_TO_ES_GENRE[g];
    if (es && !mapped.includes(es)) mapped.push(es);
  }
  return mapped.length ? mapped : ['Tendencias'];
}

function mapCinemetaItem(meta, forcedType = null) {
  const isSeries = forcedType ? forcedType === 'serial' : meta.type === 'series';
  const id = meta.imdb_id || meta.id;
  const trailer = Array.isArray(meta.trailers) && meta.trailers[0] ? meta.trailers[0].source : '';
  const yearMatch = String(meta.year || meta.releaseInfo || '').match(/\d{4}/);
  return {
    id,
    imdbId: id,
    tmdbId: meta.moviedb_id ? String(meta.moviedb_id) : '',
    title: meta.name || id,
    type: isSeries ? 'serial' : 'movie',
    year: yearMatch ? Number(yearMatch[0]) : '',
    rating: meta.imdbRating ? String(meta.imdbRating) : '',
    duration: meta.runtime || (isSeries ? 'Serie' : 'Película'),
    categories: mapCinemetaGenres(meta.genres || meta.genre),
    poster: meta.poster || `https://images.metahub.space/poster/small/${id}/img`,
    backdrop: meta.background || `https://images.metahub.space/background/medium/${id}/img`,
    synopsis: meta.description || '',
    cast: Array.isArray(meta.cast) ? meta.cast : [],
    director: Array.isArray(meta.director) ? meta.director : [],
    trailerYt: trailer,
    source: 'Cinemeta',
  };
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/* ==================== Merge Search Results ==================== */
function mergeMediaItem(existing, incoming) {
  if (!existing) return incoming;
  return {
    ...existing,
    tmdbId: existing.tmdbId || incoming.tmdbId || '',
    imdbId: existing.imdbId || incoming.imdbId || '',
    title: incoming.source === 'TMDB' && incoming.title ? incoming.title : existing.title || incoming.title,
    year: existing.year || incoming.year || '',
    rating: existing.rating || incoming.rating || '',
    duration: existing.duration && existing.duration !== 'Película' && existing.duration !== 'Serie'
      ? existing.duration
      : incoming.duration || existing.duration,
    poster: existing.poster || incoming.poster || '',
    backdrop: existing.backdrop || incoming.backdrop || '',
    synopsis:
      incoming.source === 'TMDB' && incoming.synopsis
        ? incoming.synopsis
        : existing.synopsis && !existing.synopsis.startsWith('Reparto principal:')
          ? existing.synopsis
          : incoming.synopsis || existing.synopsis,
    categories: existing.categories && existing.categories.length ? existing.categories : incoming.categories,
    trailerYt: existing.trailerYt || incoming.trailerYt || '',
    sources: Array.from(new Set([...(existing.sources || [existing.source]), incoming.source].filter(Boolean))),
  };
}

/* ==================== Route Handlers ==================== */
async function handleProviders(res) {
  const cached = getCache('providers');
  if (cached) {
    sendJson(res, 200, cached);
    return;
  }

  try {
    const data = await fetchJsonSafe('https://playlatinsrc.co/api/providers', {}, 8000);
    setCache('providers', data, 3600000);
    sendJson(res, 200, data);
  } catch {
    sendJson(res, 200, {
      ok: true,
      fallback: true,
      providers: [
        { id: 'dropload', name: 'Dropload', rank: 1, type: 'movie' },
        { id: 'supervideo-tv-5', name: 'supervideo.tv', rank: 2, type: 'movie' },
        { id: 'doodstream-com-6', name: 'doodstream.com', rank: 3, type: 'movie' },
        { id: 'mixdrop-ag-1', name: 'mixdrop.ag', rank: 4, type: 'movie' },
      ],
    });
  }
}

async function handleCheck(reqUrl, res) {
  const id = (reqUrl.searchParams.get('id') || '').trim();
  const type = reqUrl.searchParams.get('type') === 'serial' ? 'serial' : 'movie';
  if (!/^(tt\d{5,10}|\d{1,10})$/.test(id)) {
    sendJson(res, 400, { ok: false, error: 'ID IMDb o TMDB inválido' });
    return;
  }

  const cacheKey = `check:${type}:${id}`;
  const cached = getCache(cacheKey);
  if (cached) {
    sendJson(res, 200, cached);
    return;
  }

  try {
    const upstream = await fetchWithTimeout(`https://playlatinsrc.co/${type}/${id}`, {}, 8000);
    const html = await upstream.text();
    const versions = [];
    if (/latino/i.test(html)) versions.push('latino');
    if (/castellano/i.test(html)) versions.push('castellano');
    if (/subtitulado/i.test(html)) versions.push('subtitulado');

    const coverMatch = html.match(/<img\s+src="([^"]+)"\s+class="_player-cover"/i);
    const notAvailable = /no disponible|not found|sin fuentes/i.test(html) && html.length < 15000;
    const available = type === 'serial' ? html.length > 15000 && !notAvailable : Boolean(coverMatch) || (!notAvailable && html.length > 16000);

    const payload = {
      ok: true,
      available,
      cover: coverMatch ? coverMatch[1] : '',
      versions,
      type,
      id,
    };
    setCache(cacheKey, payload, 600000);
    sendJson(res, 200, payload);
  } catch (err) {
    sendJson(res, 200, { ok: false, available: null, error: err.message });
  }
}

async function handleDiscover(reqUrl, res) {
  const kind = reqUrl.searchParams.get('kind') || 'trending'; // trending | top | new
  const type = reqUrl.searchParams.get('type') || 'all'; // all | movie | serial
  const genre = reqUrl.searchParams.get('genre') || 'Todas';
  const sourceFilter = (reqUrl.searchParams.get('source') || 'all').trim();
  const page = Math.max(1, Math.min(500, Number(reqUrl.searchParams.get('page')) || 1));
  const cfg = readApiConfig();

  const cacheKey = `discover:${sourceFilter}:${kind}:${type}:${genre}:p${page}:${Boolean(cfg.tmdbKey)}`;
  const cached = getCache(cacheKey);
  if (cached) {
    sendJson(res, 200, cached);
    return;
  }

  if (sourceFilter === 'IMDb' || sourceFilter === 'OMDb' || sourceFilter === 'RapidAPI') {
    sendJson(res, 200, { ok: true, page: 1, totalPages: 1, sources: [sourceFilter], results: [], searchOnly: true });
    return;
  }

  const buckets = { TMDB: [], Cinemeta: [], TVmaze: [] };
  const activeSources = [];
  const tasks = [];
  let tmdbMaxPages = 1;
  let cinemetaMaxPages = 1;
  let tvmazeMaxPages = 1;

  // 1. TMDB Discover / Trending (in es-MX Spanish when key is configured)
  if (cfg.tmdbKey && (sourceFilter === 'all' || sourceFilter === 'TMDB')) {
    tasks.push(
      (async () => {
        const catInfo = CATEGORY_MAP[genre] || {};
        const requests = [];

        if (type === 'all' || type === 'movie') {
          let ep = `/trending/movie/week?language=es-MX&page=${page}`;
          if (kind === 'top') ep = `/movie/top_rated?language=es-MX&page=${page}`;
          else if (kind === 'new') ep = `/movie/now_playing?language=es-MX&page=${page}`;
          if (catInfo.tmdbKeyword) {
            const sortBy = kind === 'top' ? 'vote_average.desc&vote_count.gte=200' : 'popularity.desc';
            ep = `/discover/movie?language=es-MX&with_keywords=${catInfo.tmdbKeyword}&sort_by=${sortBy}&page=${page}`;
          } else if (catInfo.tmdbMovie) {
            const sortBy = kind === 'top' ? 'vote_average.desc&vote_count.gte=400' : 'popularity.desc';
            ep = `/discover/movie?language=es-MX&with_genres=${catInfo.tmdbMovie}&sort_by=${sortBy}&page=${page}`;
          }
          requests.push(
            tmdbFetch(cfg.tmdbKey, ep).then((d) => ({
              kind: 'movie',
              list: d?.results || [],
              totalPages: Number(d?.total_pages) || 1,
            }))
          );
        }

        if (type === 'all' || type === 'serial') {
          let ep = `/trending/tv/week?language=es-MX&page=${page}`;
          if (kind === 'top') ep = `/tv/top_rated?language=es-MX&page=${page}`;
          else if (kind === 'new') ep = `/tv/on_the_air?language=es-MX&page=${page}`;
          if (catInfo.tmdbKeyword) {
            const sortBy = kind === 'top' ? 'vote_average.desc&vote_count.gte=80' : 'popularity.desc';
            ep = `/discover/tv?language=es-MX&with_keywords=${catInfo.tmdbKeyword}&sort_by=${sortBy}&page=${page}`;
          } else if (catInfo.tmdbTv) {
            const sortBy = kind === 'top' ? 'vote_average.desc&vote_count.gte=250' : 'popularity.desc';
            ep = `/discover/tv?language=es-MX&with_genres=${catInfo.tmdbTv}&sort_by=${sortBy}&page=${page}`;
          }
          requests.push(
            tmdbFetch(cfg.tmdbKey, ep).then((d) => ({
              kind: 'serial',
              list: d?.results || [],
              totalPages: Number(d?.total_pages) || 1,
            }))
          );
        }

        const tmdbGroups = await Promise.allSettled(requests);
        const tmdbMapped = [];
        for (const g of tmdbGroups) {
          if (g.status !== 'fulfilled') continue;
          tmdbMaxPages = Math.max(tmdbMaxPages, Math.min(500, g.value.totalPages));
          for (const raw of g.value.list.slice(0, 16)) {
            const mapped = mapTmdbItem(raw, g.value.kind);
            if (genre !== 'Todas' && genre !== 'Tendencias' && !mapped.categories.includes(genre)) {
              mapped.categories.push(genre);
            }
            tmdbMapped.push(mapped);
          }
        }

        await Promise.allSettled(
          tmdbMapped.slice(0, 20).map(async (item) => {
            const imdb = await resolveTmdbImdbId(cfg.tmdbKey, item.tmdbId, item.type);
            if (imdb) {
              item.imdbId = imdb;
              item.id = imdb;
            }
          })
        );

        buckets.TMDB.push(...tmdbMapped);
      })()
    );
  }

  // 2. Cinemeta (Public zero-auth API)
  if (sourceFilter === 'all' || sourceFilter === 'Cinemeta') {
    tasks.push(
      (async () => {
        const catInfo = CATEGORY_MAP[genre] || {};
        if (genre === 'Navidad' && page > 1) return;
        const catalogId = kind === 'top' ? 'imdbRating' : 'top';
        const skip = (page - 1) * 48;
        let extra = '';
        if (genre === 'Navidad') {
          extra = '/search=Christmas';
        } else if (catInfo.cinemeta && skip > 0) {
          extra = `/genre=${encodeURIComponent(catInfo.cinemeta)}&skip=${skip}`;
        } else if (catInfo.cinemeta) {
          extra = `/genre=${encodeURIComponent(catInfo.cinemeta)}`;
        } else if (skip > 0) {
          extra = `/skip=${skip}`;
        }
        const urls = [];

        if (type === 'all' || type === 'movie') {
          urls.push({
            type: 'movie',
            url: `https://v3-cinemeta.strem.io/catalog/movie/${catalogId}${extra}.json`,
          });
        }
        if (type === 'all' || type === 'serial') {
          urls.push({
            type: 'serial',
            url: `https://v3-cinemeta.strem.io/catalog/series/${catalogId}${extra}.json`,
          });
        }

        const cineRes = await Promise.allSettled(
          urls.map((u) => fetchJsonSafe(u.url, {}, 8000).then((d) => ({ type: u.type, metas: d?.metas || [] })))
        );

        let maxBatch = 0;
        for (const r of cineRes) {
          if (r.status !== 'fulfilled') continue;
          maxBatch = Math.max(maxBatch, r.value.metas.length);
          for (const m of r.value.metas.slice(0, 24)) {
            const mapped = mapCinemetaItem(m, r.value.type);
            if (genre !== 'Todas' && genre !== 'Tendencias' && !mapped.categories.includes(genre)) {
              mapped.categories.push(genre);
            }
            buckets.Cinemeta.push(mapped);
          }
        }
        cinemetaMaxPages = maxBatch >= 40 ? Math.max(page + 1, 15) : page;
      })()
    );
  }

  // 3. TVmaze catalog (for TVmaze filter and included in 'all' for series)
  if ((sourceFilter === 'TVmaze' || sourceFilter === 'all') && (type === 'all' || type === 'serial')) {
    tasks.push(
      (async () => {
        const perPage = sourceFilter === 'TVmaze' ? 36 : 14;
        const tvApiPage = Math.floor(((page - 1) * perPage) / 180);
        const shows = await fetchJsonSafe(`https://api.tvmaze.com/shows?page=${tvApiPage}`, {}, 8000);
        const allValid = (Array.isArray(shows) ? shows : [])
          .filter((s) => s && s.externals?.imdb)
          .filter((s) => genre === 'Todas' || mapCinemetaGenres(s.genres).includes(genre));
        const offset = ((page - 1) * perPage) % 180;
        const sliced = allValid.slice(offset, offset + perPage);
        const filtered = sliced.map((s) => ({
          id: s.externals.imdb,
          imdbId: s.externals.imdb,
          title: s.name,
          type: 'serial',
          year: s.premiered ? Number(s.premiered.slice(0, 4)) : '',
          rating: s.rating?.average ? String(s.rating.average) : '',
          duration: s.averageRuntime ? `${s.averageRuntime} min/ep` : 'Serie',
          categories: mapCinemetaGenres(s.genres),
          poster: s.image?.medium || s.image?.original || '',
          backdrop: s.image?.original || '',
          synopsis: stripHtml(s.summary),
          tvmazeId: s.id,
          source: 'TVmaze',
        }));
        buckets.TVmaze.push(...filtered);
        tvmazeMaxPages = filtered.length >= perPage ? Math.max(page + 1, 50) : page;
      })()
    );
  }

  await Promise.allSettled(tasks);

  for (const name of ['TMDB', 'Cinemeta', 'TVmaze']) {
    if (buckets[name].length) activeSources.push(name);
  }

  // Interleave items round-robin across APIs so 'all' shows a balanced mix of every source
  const items = [];
  const maxLen = Math.max(buckets.TMDB.length, buckets.Cinemeta.length, buckets.TVmaze.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < buckets.TMDB.length) items.push(buckets.TMDB[i]);
    if (i < buckets.Cinemeta.length) items.push(buckets.Cinemeta[i]);
    if (i < buckets.TVmaze.length) items.push(buckets.TVmaze[i]);
  }

  // Deduplicate by IMDb ID or TMDB ID
  const byKey = new Map();
  for (const item of items) {
    const key = item.imdbId || item.id;
    const prev = byKey.get(key);
    byKey.set(key, mergeMediaItem(prev, item));
  }

  const deduped = Array.from(byKey.values()).slice(0, 60);

  // Enrich non-TMDB items (Cinemeta / TVmaze) with Spanish (es-MX) titles & synopses via TMDB when configured
  if (cfg.tmdbKey) {
    const toTranslate = deduped.filter(
      (it) => it.imdbId && !(it.sources || [it.source]).includes('TMDB')
    );
    await Promise.allSettled(
      toTranslate.map(async (it) => {
        const cKey = `tmdb_es:${it.type}:${it.imdbId}`;
        let esData = getCache(cKey);
        if (!esData) {
          try {
            const found = await tmdbFetch(
              cfg.tmdbKey,
              `/find/${encodeURIComponent(it.imdbId)}?external_source=imdb_id&language=es-MX`
            );
            const hit = it.type === 'serial' ? found?.tv_results?.[0] : found?.movie_results?.[0];
            if (hit) {
              esData = {
                tmdbId: String(hit.id),
                title: hit.title || hit.name || '',
                synopsis: hit.overview || '',
              };
              setCache(cKey, esData, 86400000);
            }
          } catch {
            // Optional translation
          }
        }
        if (esData) {
          if (esData.tmdbId && !it.tmdbId) it.tmdbId = esData.tmdbId;
          if (esData.title) it.title = esData.title;
          if (esData.synopsis) it.synopsis = esData.synopsis;
        }
      })
    );
  }

  let totalPages = 1;
  if (buckets.TMDB.length) totalPages = Math.max(page, tmdbMaxPages);
  else if (buckets.Cinemeta.length) totalPages = Math.max(page, cinemetaMaxPages);
  else if (buckets.TVmaze.length) totalPages = Math.max(page, tvmazeMaxPages);

  const payload = {
    ok: true,
    page,
    totalPages,
    sources: activeSources,
    results: deduped,
  };
  setCache(cacheKey, payload, 1800000);
  sendJson(res, 200, payload);
}

async function handleMultiSearch(reqUrl, res) {
  const q = (reqUrl.searchParams.get('q') || '').trim();
  const sourceFilter = (reqUrl.searchParams.get('source') || 'all').trim();
  if (!q || q.length < 2 || sourceFilter === 'local') {
    sendJson(res, 200, { ok: true, results: [], sources: [] });
    return;
  }

  const cfg = readApiConfig();
  const cacheKey = `search:${sourceFilter}:${q.toLowerCase()}:${Boolean(cfg.tmdbKey)}:${Boolean(cfg.omdbKey)}:${Boolean(cfg.rapidApiKey)}`;
  const cached = getCache(cacheKey);
  if (cached) {
    sendJson(res, 200, cached);
    return;
  }

  const normalized = q.toLowerCase().replace(/[^a-z0-9]/g, '');
  const firstChar = normalized[0] || 'x';
  const allow = (name) => sourceFilter === 'all' || sourceFilter === name;

  const tasks = [];

  // Source 1: IMDb Suggestion API (Public)
  if (allow('IMDb')) tasks.push(
    fetchJsonSafe(`https://v3.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(q.toLowerCase())}.json`)
      .then((json) => {
        const rawList = Array.isArray(json.d) ? json.d : [];
        return {
          source: 'IMDb',
          items: rawList
            .filter((item) => {
              if (!item || !item.id || !String(item.id).startsWith('tt')) return false;
              const qid = String(item.qid || '').toLowerCase();
              return qid === 'movie' || qid === 'tvseries' || qid === 'tvminiseries';
            })
            .slice(0, 14)
            .map((item) => {
              const qid = String(item.qid || '').toLowerCase();
              const isSeries = qid === 'tvseries' || qid === 'tvminiseries';
              let poster = item.i && item.i.imageUrl ? item.i.imageUrl : '';
              if (poster && poster.includes('._V1_.')) {
                poster = poster.replace('._V1_.', '._V1_UX500_.');
              }
              return {
                id: item.id,
                imdbId: item.id,
                title: item.l || item.id,
                type: isSeries ? 'serial' : 'movie',
                year: item.y || '',
                rating: '',
                duration: isSeries ? 'Serie' : 'Película',
                categories: [isSeries ? 'Series' : 'Películas'],
                poster,
                backdrop: '',
                synopsis: item.s ? `Reparto principal: ${item.s}.` : '',
                fromImdbSearch: true,
                source: 'IMDb',
              };
            }),
        };
      })
  );

  // Source 2: Cinemeta Search (Public)
  if (allow('Cinemeta')) tasks.push(
    Promise.all([
      fetchJsonSafe(`https://v3-cinemeta.strem.io/catalog/movie/top/search=${encodeURIComponent(q)}.json`),
      fetchJsonSafe(`https://v3-cinemeta.strem.io/catalog/series/top/search=${encodeURIComponent(q)}.json`),
    ]).then(([movies, series]) => ({
      source: 'Cinemeta',
      items: [
        ...(movies?.metas || []).slice(0, 10).map((m) => mapCinemetaItem(m, 'movie')),
        ...(series?.metas || []).slice(0, 10).map((s) => mapCinemetaItem(s, 'serial')),
      ],
    }))
  );

  // Source 3: TVmaze Search (Public, series with IMDb ID)
  if (allow('TVmaze')) tasks.push(
    fetchJsonSafe(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`).then((list) => ({
      source: 'TVmaze',
      items: (Array.isArray(list) ? list : [])
        .map((entry) => entry.show)
        .filter((s) => s && s.externals && s.externals.imdb)
        .slice(0, 8)
        .map((s) => ({
          id: s.externals.imdb,
          imdbId: s.externals.imdb,
          title: s.name,
          type: 'serial',
          year: s.premiered ? Number(s.premiered.slice(0, 4)) : '',
          rating: s.rating && s.rating.average ? String(s.rating.average) : '',
          duration: s.averageRuntime ? `${s.averageRuntime} min/ep` : 'Serie',
          categories: mapCinemetaGenres(s.genres),
          poster: (s.image && (s.image.medium || s.image.original)) || '',
          backdrop: (s.image && s.image.original) || '',
          synopsis: stripHtml(s.summary),
          tvmazeId: s.id,
          source: 'TVmaze',
        })),
    }))
  );

  // Source 4: TMDB Multi-Search (if configured)
  if (cfg.tmdbKey && allow('TMDB')) {
    tasks.push(
      tmdbFetch(cfg.tmdbKey, `/search/multi?language=es-MX&query=${encodeURIComponent(q)}&include_adult=false`).then(
        async (data) => {
          const filtered = (data?.results || [])
            .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
            .slice(0, 10)
            .map((r) => mapTmdbItem(r));
          await Promise.allSettled(
            filtered.map(async (item) => {
              const imdb = await resolveTmdbImdbId(cfg.tmdbKey, item.tmdbId, item.type);
              if (imdb) {
                item.imdbId = imdb;
                item.id = imdb;
              }
            })
          );
          return { source: 'TMDB', items: filtered };
        }
      )
    );
  }

  // Source 5: OMDb Search (if configured)
  if (cfg.omdbKey && allow('OMDb')) {
    tasks.push(
      fetchJsonSafe(`https://www.omdbapi.com/?s=${encodeURIComponent(q)}&apikey=${encodeURIComponent(cfg.omdbKey)}`).then(
        (data) => ({
          source: 'OMDb',
          items: (Array.isArray(data?.Search) ? data.Search : [])
            .filter((m) => m.imdbID && (m.Type === 'movie' || m.Type === 'series'))
            .slice(0, 10)
            .map((m) => ({
              id: m.imdbID,
              imdbId: m.imdbID,
              title: m.Title,
              type: m.Type === 'series' ? 'serial' : 'movie',
              year: Number(String(m.Year || '').slice(0, 4)) || '',
              rating: '',
              duration: m.Type === 'series' ? 'Serie' : 'Película',
              categories: [m.Type === 'series' ? 'Series' : 'Películas'],
              poster: m.Poster && m.Poster !== 'N/A' ? m.Poster : '',
              backdrop: '',
              synopsis: '',
              source: 'OMDb',
            })),
        })
      )
    );
  }

  // Source 6: RapidAPI MoviesDatabase (if configured)
  if (cfg.rapidApiKey && allow('RapidAPI') && cfg.rapidApiHost === 'moviesdatabase.p.rapidapi.com') {
    tasks.push(
      fetchJsonSafe(
        `https://moviesdatabase.p.rapidapi.com/titles/search/title/${encodeURIComponent(q)}?exact=false&info=base_info&limit=8`,
        {
          headers: {
            'X-RapidAPI-Key': cfg.rapidApiKey,
            'X-RapidAPI-Host': cfg.rapidApiHost,
          },
        }
      ).then((data) => ({
        source: 'RapidAPI',
        items: (Array.isArray(data?.results) ? data.results : [])
          .filter((r) => r && r.id && r.id.startsWith('tt'))
          .map((r) => {
            const isSeries = r.titleType?.isSeries || r.titleType?.id === 'tvSeries';
            return {
              id: r.id,
              imdbId: r.id,
              title: r.titleText?.text || r.originalTitleText?.text || r.id,
              type: isSeries ? 'serial' : 'movie',
              year: r.releaseYear?.year || '',
              rating: r.ratingsSummary?.aggregateRating ? String(r.ratingsSummary.aggregateRating) : '',
              duration: isSeries ? 'Serie' : 'Película',
              categories: mapCinemetaGenres((r.genres?.genres || []).map((g) => g.text)),
              poster: r.primaryImage?.url || '',
              backdrop: '',
              synopsis: r.plot?.plotText?.plainText || '',
              source: 'RapidAPI',
            };
          }),
      }))
    );
  }

  const settled = await Promise.allSettled(tasks);
  const byId = new Map();
  const usedSources = [];

  for (const resItem of settled) {
    if (resItem.status !== 'fulfilled') continue;
    const { source, items } = resItem.value;
    if (items.length) usedSources.push(source);
    for (const item of items) {
      const key = item.imdbId || item.id;
      byId.set(key, mergeMediaItem(byId.get(key), { ...item, fromImdbSearch: true }));
    }
  }

  const payload = {
    ok: true,
    sources: usedSources,
    results: Array.from(byId.values()).slice(0, 28),
  };
  setCache(cacheKey, payload, 600000);
  sendJson(res, 200, payload);
}

async function handleMeta(reqUrl, res) {
  const id = (reqUrl.searchParams.get('id') || '').trim();
  const type = reqUrl.searchParams.get('type') === 'serial' ? 'serial' : 'movie';
  if (!/^(tt\d{5,10}|\d{1,10})$/.test(id)) {
    sendJson(res, 400, { ok: false, error: 'ID inválido' });
    return;
  }

  const cfg = readApiConfig();
  const cacheKey = `meta:${type}:${id}:${Boolean(cfg.tmdbKey)}:${Boolean(cfg.omdbKey)}:${Boolean(cfg.rapidApiKey)}`;
  const cached = getCache(cacheKey);
  if (cached) {
    sendJson(res, 200, cached);
    return;
  }

  const isImdb = id.startsWith('tt');
  const meta = {
    id,
    type,
    title: '',
    synopsis: '',
    year: '',
    runtime: '',
    rated: '',
    imdbRating: '',
    rottenTomatoes: '',
    metacritic: '',
    awards: '',
    country: '',
    director: [],
    cast: [],
    genres: [],
    poster: '',
    backdrop: '',
    trailerYt: '',
    tmdbId: isImdb ? '' : id,
    imdbId: isImdb ? id : '',
    seasonsCount: 0,
    sources: [],
  };

  const tasks = [];

  // 1. Cinemeta (for IMDb IDs)
  if (isImdb) {
    tasks.push(
      fetchJsonSafe(`https://v3-cinemeta.strem.io/meta/${type === 'serial' ? 'series' : 'movie'}/${id}.json`)
        .then((d) => {
          const m = d?.meta;
          if (!m) return;
          meta.sources.push('Cinemeta');
          meta.title = meta.title || m.name || '';
          meta.synopsis = meta.synopsis || m.description || '';
          meta.year = meta.year || m.year || '';
          meta.runtime = meta.runtime || m.runtime || '';
          meta.imdbRating = meta.imdbRating || m.imdbRating || '';
          meta.awards = meta.awards || m.awards || '';
          meta.country = meta.country || m.country || '';
          meta.director = m.director || [];
          meta.cast = m.cast || [];
          meta.genres = mapCinemetaGenres(m.genres || m.genre);
          meta.poster = meta.poster || m.poster || '';
          meta.backdrop = meta.backdrop || m.background || '';
          meta.tmdbId = meta.tmdbId || (m.moviedb_id ? String(m.moviedb_id) : '');
          if (Array.isArray(m.trailers) && m.trailers[0]?.source) {
            meta.trailerYt = m.trailers[0].source;
          }
        })
    );
  }

  // 2. OMDb (if configured and IMDb ID)
  if (cfg.omdbKey && isImdb) {
    tasks.push(
      fetchJsonSafe(`https://www.omdbapi.com/?i=${encodeURIComponent(id)}&plot=full&apikey=${encodeURIComponent(cfg.omdbKey)}`)
        .then((o) => {
          if (!o || o.Response === 'False') return;
          meta.sources.push('OMDb');
          if (o.Title && !meta.title) meta.title = o.Title;
          if (o.Plot && o.Plot !== 'N/A' && !meta.synopsis) meta.synopsis = o.Plot;
          if (o.Rated && o.Rated !== 'N/A') meta.rated = o.Rated;
          if (o.imdbRating && o.imdbRating !== 'N/A') meta.imdbRating = o.imdbRating;
          if (o.Awards && o.Awards !== 'N/A') meta.awards = o.Awards;
          if (o.Country && o.Country !== 'N/A') meta.country = o.Country;
          if (o.Runtime && o.Runtime !== 'N/A') meta.runtime = o.Runtime;
          if (o.totalSeasons && o.totalSeasons !== 'N/A') meta.seasonsCount = Number(o.totalSeasons) || 0;
          if (o.Actors && o.Actors !== 'N/A' && !meta.cast.length) {
            meta.cast = o.Actors.split(',').map((s) => s.trim());
          }
          if (o.Director && o.Director !== 'N/A' && !meta.director.length) {
            meta.director = o.Director.split(',').map((s) => s.trim());
          }
          for (const r of o.Ratings || []) {
            if (r.Source === 'Rotten Tomatoes') meta.rottenTomatoes = r.Value;
            if (r.Source === 'Metacritic') meta.metacritic = r.Value;
          }
        })
    );
  }

  // 3. TMDB (if configured — gives Spanish es-MX title, synopsis, trailers, cast)
  if (cfg.tmdbKey) {
    tasks.push(
      (async () => {
        let tmdbId = meta.tmdbId;
        if (!tmdbId && isImdb) {
          const found = await tmdbFetch(cfg.tmdbKey, `/find/${id}?external_source=imdb_id&language=es-MX`);
          const hit = type === 'serial' ? found?.tv_results?.[0] : found?.movie_results?.[0];
          if (hit) tmdbId = String(hit.id);
        }
        if (!tmdbId) return;

        const ep =
          type === 'serial'
            ? `/tv/${tmdbId}?language=es-MX&append_to_response=credits,videos,external_ids`
            : `/movie/${tmdbId}?language=es-MX&append_to_response=credits,videos,external_ids`;
        const details = await tmdbFetch(cfg.tmdbKey, ep);
        if (!details) return;

        meta.sources.push('TMDB');
        meta.tmdbId = String(details.id);
        if (details.external_ids?.imdb_id) meta.imdbId = details.external_ids.imdb_id;
        if (details.title || details.name) meta.title = details.title || details.name;
        if (details.overview) meta.synopsis = details.overview;
        if (details.backdrop_path) meta.backdrop = `https://image.tmdb.org/t/p/w1280${details.backdrop_path}`;
        if (details.poster_path) meta.poster = `https://image.tmdb.org/t/p/w500${details.poster_path}`;
        if (details.vote_average) meta.imdbRating = meta.imdbRating || Number(details.vote_average).toFixed(1);
        if (details.runtime) meta.runtime = `${details.runtime} min`;
        if (details.number_of_seasons) meta.seasonsCount = details.number_of_seasons;
        if (Array.isArray(details.genres) && details.genres.length) {
          meta.genres = [...new Set(details.genres.map((g) => TMDB_GENRE_ES[g.id] || g.name))];
        }
        if (details.credits?.cast?.length) {
          meta.cast = details.credits.cast.slice(0, 8).map((c) => c.name);
        }
        const yt = (details.videos?.results || []).find(
          (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
        );
        if (yt) meta.trailerYt = yt.key;
      })()
    );
  }

  // 4. TVmaze (for series)
  if (type === 'serial' && isImdb) {
    tasks.push(
      fetchJsonSafe(`https://api.tvmaze.com/lookup/shows?imdb=${encodeURIComponent(id)}`).then((s) => {
        if (!s || !s.id) return;
        meta.sources.push('TVmaze');
        meta.tvmazeId = s.id;
        if (!meta.title && s.name) meta.title = s.name;
        if (!meta.synopsis && s.summary) meta.synopsis = stripHtml(s.summary);
        if (s.network?.name) meta.network = s.network.name;
      })
    );
  }

  // 5. RapidAPI (if configured)
  if (cfg.rapidApiKey && isImdb && cfg.rapidApiHost === 'moviesdatabase.p.rapidapi.com') {
    tasks.push(
      fetchJsonSafe(`https://moviesdatabase.p.rapidapi.com/titles/${encodeURIComponent(id)}?info=base_info`, {
        headers: {
          'X-RapidAPI-Key': cfg.rapidApiKey,
          'X-RapidAPI-Host': cfg.rapidApiHost,
        },
      }).then((d) => {
        const r = d?.results;
        if (!r) return;
        meta.sources.push('RapidAPI');
        if (!meta.imdbRating && r.ratingsSummary?.aggregateRating) {
          meta.imdbRating = String(r.ratingsSummary.aggregateRating);
        }
      })
    );
  }

  await Promise.allSettled(tasks);
  meta.sources = Array.from(new Set(meta.sources));

  const payload = { ok: true, meta };
  setCache(cacheKey, payload, 1800000);
  sendJson(res, 200, payload);
}

async function handleEpisodes(reqUrl, res) {
  const id = (reqUrl.searchParams.get('id') || '').trim();
  const seasonFilter = Number(reqUrl.searchParams.get('season')) || 0;
  if (!/^(tt\d{5,10}|\d{1,10})$/.test(id)) {
    sendJson(res, 400, { ok: false, error: 'ID inválido' });
    return;
  }

  const cfg = readApiConfig();
  const cacheKey = `episodes:${id}:${seasonFilter}:${Boolean(cfg.tmdbKey)}`;
  const cached = getCache(cacheKey);
  if (cached) {
    sendJson(res, 200, cached);
    return;
  }

  const episodesBySeason = {};
  const usedSources = [];

  // 1. Try Cinemeta full episode list for tt... IDs
  if (id.startsWith('tt')) {
    try {
      const cine = await fetchJsonSafe(`https://v3-cinemeta.strem.io/meta/series/${id}.json`, {}, 8000);
      const videos = Array.isArray(cine?.meta?.videos) ? cine.meta.videos : [];
      if (videos.length) {
        usedSources.push('Cinemeta');
        for (const v of videos) {
          const s = Number(v.season);
          const e = Number(v.episode || v.number);
          if (!s || s < 1 || !e || e < 1) continue;
          if (!episodesBySeason[s]) episodesBySeason[s] = [];
          episodesBySeason[s].push({
            season: s,
            episode: e,
            title: v.name || `Episodio ${e}`,
            overview: v.overview || v.description || '',
            still: v.thumbnail || '',
            airdate: v.firstAired ? v.firstAired.slice(0, 10) : '',
            rating: v.rating || '',
          });
        }
      }
    } catch {
      // Fallback to TVmaze
    }
  }

  // 2. Fallback / enrich via TVmaze if Cinemeta had no episodes
  if (!Object.keys(episodesBySeason).length && id.startsWith('tt')) {
    try {
      const show = await fetchJsonSafe(`https://api.tvmaze.com/lookup/shows?imdb=${encodeURIComponent(id)}`, {}, 8000);
      if (show?.id) {
        const eps = await fetchJsonSafe(`https://api.tvmaze.com/shows/${show.id}/episodes`, {}, 8000);
        if (Array.isArray(eps) && eps.length) {
          usedSources.push('TVmaze');
          for (const ep of eps) {
            const s = Number(ep.season);
            const e = Number(ep.number);
            if (!s || s < 1 || !e || e < 1) continue;
            if (!episodesBySeason[s]) episodesBySeason[s] = [];
            episodesBySeason[s].push({
              season: s,
              episode: e,
              title: ep.name || `Episodio ${e}`,
              overview: stripHtml(ep.summary),
              still: (ep.image && (ep.image.medium || ep.image.original)) || '',
              airdate: ep.airdate || '',
              rating: ep.rating?.average ? String(ep.rating.average) : '',
            });
          }
        }
      }
    } catch {
      // No TVmaze episodes
    }
  }

  // 3. If TMDB is configured, enrich requested season (or season 1) in Spanish es-MX
  if (cfg.tmdbKey) {
    try {
      let tmdbId = id.startsWith('tt') ? '' : id;
      if (!tmdbId) {
        const found = await tmdbFetch(cfg.tmdbKey, `/find/${id}?external_source=imdb_id&language=es-MX`);
        if (found?.tv_results?.[0]?.id) tmdbId = String(found.tv_results[0].id);
      }
      if (tmdbId) {
        const targetSeason = seasonFilter || Number(Object.keys(episodesBySeason)[0]) || 1;
        const seasonData = await tmdbFetch(cfg.tmdbKey, `/tv/${tmdbId}/season/${targetSeason}?language=es-MX`);
        if (Array.isArray(seasonData?.episodes) && seasonData.episodes.length) {
          usedSources.push('TMDB');
          episodesBySeason[targetSeason] = seasonData.episodes.map((ep) => ({
            season: targetSeason,
            episode: ep.episode_number,
            title: ep.name || `Episodio ${ep.episode_number}`,
            overview: ep.overview || '',
            still: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : '',
            airdate: ep.air_date || '',
            rating: ep.vote_average ? Number(ep.vote_average).toFixed(1) : '',
          }));
        }
      }
    } catch {
      // Ignore TMDB season error
    }
  }

  const seasons = Object.keys(episodesBySeason)
    .map(Number)
    .sort((a, b) => a - b);

  for (const s of seasons) {
    episodesBySeason[s].sort((a, b) => a.episode - b.episode);
  }

  const payload = { ok: true, id, seasons, episodesBySeason, sources: Array.from(new Set(usedSources)) };
  setCache(cacheKey, payload, 1800000);
  sendJson(res, 200, payload);
}

function formatConfigStatus(cfg) {
  return {
    playlatinsrc: { active: true, label: 'PlayLatinSRC (Embeds y Proveedores)' },
    publicApis: {
      active: true,
      label: 'APIs Públicas (Cinemeta, TVmaze, IMDb)',
    },
    tmdb: {
      configured: Boolean(cfg.tmdbKey),
      masked: maskSecret(cfg.tmdbKey),
      label: 'TMDB API (Tendencias y metadata en español)',
    },
    omdb: {
      configured: Boolean(cfg.omdbKey),
      masked: maskSecret(cfg.omdbKey),
      label: 'OMDb API (Rotten Tomatoes, Metacritic, Premios)',
    },
    rapidapi: {
      configured: Boolean(cfg.rapidApiKey),
      masked: maskSecret(cfg.rapidApiKey),
      host: cfg.rapidApiHost,
      label: 'RapidAPI (MoviesDatabase / Free APIs)',
    },
  };
}

async function handleConfigTest(body, res) {
  const cfg = readApiConfig();
  const testTmdb = (body.tmdbKey ?? cfg.tmdbKey).trim();
  const testOmdb = (body.omdbKey ?? cfg.omdbKey).trim();
  const testRapid = (body.rapidApiKey ?? cfg.rapidApiKey).trim();
  const testRapidHost = (body.rapidApiHost ?? cfg.rapidApiHost).trim() || 'moviesdatabase.p.rapidapi.com';

  const report = {};

  if (testTmdb) {
    try {
      const d = await tmdbFetch(testTmdb, '/configuration');
      report.tmdb = { ok: Boolean(d?.images), message: 'TMDB conectado correctamente' };
    } catch (e) {
      report.tmdb = { ok: false, message: `TMDB error: ${e.message}` };
    }
  } else {
    report.tmdb = { ok: null, message: 'Sin clave configurada' };
  }

  if (testOmdb) {
    try {
      const d = await fetchJsonSafe(`https://www.omdbapi.com/?i=tt15239678&apikey=${encodeURIComponent(testOmdb)}`);
      report.omdb = {
        ok: d?.Response === 'True',
        message: d?.Response === 'True' ? 'OMDb conectado correctamente' : d?.Error || 'Clave inválida',
      };
    } catch (e) {
      report.omdb = { ok: false, message: `OMDb error: ${e.message}` };
    }
  } else {
    report.omdb = { ok: null, message: 'Sin clave configurada' };
  }

  if (testRapid) {
    try {
      const d = await fetchJsonSafe(`https://${testRapidHost}/titles/tt15239678?info=mini_info`, {
        headers: { 'X-RapidAPI-Key': testRapid, 'X-RapidAPI-Host': testRapidHost },
      });
      report.rapidapi = { ok: Boolean(d), message: 'RapidAPI conectado correctamente' };
    } catch (e) {
      report.rapidapi = { ok: false, message: `RapidAPI error: ${e.message}` };
    }
  } else {
    report.rapidapi = { ok: null, message: 'Sin clave configurada' };
  }

  sendJson(res, 200, { ok: true, report });
}

/* ==================== Static File Server ==================== */
function serveStatic(reqUrl, res) {
  let reqPath = decodeURIComponent(reqUrl.pathname);
  if (reqPath === '/') reqPath = '/index.html';

  if (BLOCKED_STATIC.has(reqPath)) {
    res.statusCode = 403;
    res.end('Acceso denegado');
    return;
  }

  const filePath = path.resolve(ROOT, `.${reqPath}`);
  const rel = path.relative(ROOT, filePath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    res.statusCode = 403;
    res.end('Acceso denegado');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Archivo no encontrado');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.statusCode = 200;
    sendCorsHeaders(res, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

/* ==================== Server Bootstrap ==================== */
async function parseJsonRequestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
  const raw = await readRequestBody(req);
  return raw ? JSON.parse(raw) : {};
}

async function requestHandler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    sendCorsHeaders(res);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (reqUrl.pathname === '/api/health') {
    const cfg = readApiConfig();
    sendJson(res, 200, {
      ok: true,
      service: 'PelisStart',
      integrations: formatConfigStatus(cfg),
    });
    return;
  }

  if (reqUrl.pathname === '/api/config' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, integrations: formatConfigStatus(readApiConfig()) });
    return;
  }

  if (reqUrl.pathname === '/api/config' && req.method === 'POST') {
    try {
      const body = await parseJsonRequestBody(req);
      const updated = writeApiConfig(body);
      sendJson(res, 200, { ok: true, integrations: formatConfigStatus(updated) });
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err.message });
    }
    return;
  }

  if (reqUrl.pathname === '/api/config/test' && req.method === 'POST') {
    try {
      const body = await parseJsonRequestBody(req);
      await handleConfigTest(body, res);
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err.message });
    }
    return;
  }

  if (reqUrl.pathname === '/api/providers') {
    await handleProviders(res);
    return;
  }

  if (reqUrl.pathname === '/api/discover') {
    await handleDiscover(reqUrl, res);
    return;
  }

  if (reqUrl.pathname === '/api/search') {
    await handleMultiSearch(reqUrl, res);
    return;
  }

  if (reqUrl.pathname === '/api/meta') {
    await handleMeta(reqUrl, res);
    return;
  }

  if (reqUrl.pathname === '/api/episodes') {
    await handleEpisodes(reqUrl, res);
    return;
  }

  if (reqUrl.pathname === '/api/check') {
    await handleCheck(reqUrl, res);
    return;
  }

  serveStatic(reqUrl, res);
}

if (require.main === module) {
  const server = http.createServer(requestHandler);
  server.listen(PORT, () => {
    const ips = getLanIps();
    const cfg = readApiConfig();
    console.log(`PelisStart servidor activo en http://localhost:${PORT}`);
    if (ips.length) {
      console.log(`Red local (LAN): http://${ips[0]}:${PORT}`);
    }
    console.log(
      `APIs activas: PlayLatinSRC, Public APIs (Cinemeta/TVmaze/IMDb)` +
        `${cfg.tmdbKey ? ', TMDB' : ''}${cfg.omdbKey ? ', OMDb' : ''}${cfg.rapidApiKey ? ', RapidAPI' : ''}`
    );
  });
}

module.exports = requestHandler;
