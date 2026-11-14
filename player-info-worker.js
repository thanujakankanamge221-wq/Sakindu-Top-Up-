/* Cloudflare Worker — relays a UID lookup to the player-info service and returns clean JSON.
   Deploy: see README.md in this folder. Free plan is enough (100,000 requests/day). */

/* 1) The endpoint the info page itself calls (see README step "Find the endpoint"). {uid} is replaced. */
const UPSTREAM_URL = 'https://auraffxserverinfocheckerapi.onrender.com/api/player?uid={uid}';

/* 2) Websites allowed to use this relay (use your real domain; '*' only while testing). */
const ALLOWED_ORIGINS = ['*'];

const TIMEOUT_MS = 7000;
const CACHE_SECONDS = 0;                   // 0 = never cache: every lookup goes to the live service

const NICK_KEYS   = ['nickname', 'nick_name', 'playername', 'player_name', 'accountname', 'account_name', 'username', 'name'];
const LEVEL_KEYS  = ['level', 'lvl', 'accountlevel', 'account_level'];
const REGION_KEYS = ['region', 'server', 'countrycode', 'country_code', 'country'];
const LIKES_KEYS  = ['likes', 'liked', 'like_count'];

function cors(origin){
  const ok = ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin);
  return { 'Access-Control-Allow-Origin': ok ? (origin || '*') : 'null', 'Access-Control-Allow-Methods': 'GET, OPTIONS',
           'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' };
}
function reply(obj, status, headers){
  return new Response(JSON.stringify(obj), { status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers) });
}
/* first value (shallowest first) stored under any of `keys`, searched in priority order */
function deepFind(root, keys){
  for(const key of keys){
    const queue = [root];
    while(queue.length){
      const cur = queue.shift();
      if(!cur || typeof cur !== 'object') continue;
      for(const k of Object.keys(cur)){
        if(k.toLowerCase() === key && cur[k] != null && typeof cur[k] !== 'object' && String(cur[k]).trim() !== '') return cur[k];
      }
      for(const k of Object.keys(cur)) if(cur[k] && typeof cur[k] === 'object') queue.push(cur[k]);
    }
  }
  return null;
}

export default {
  async fetch(request, env, ctx){
    const origin = request.headers.get('Origin') || '';
    const h = cors(origin);
    if(request.method === 'OPTIONS') return new Response(null, { headers: h });
    if(!ALLOWED_ORIGINS.includes('*') && origin && !ALLOWED_ORIGINS.includes(origin)) return reply({ ok:false, error:'forbidden' }, 403, h);

    const url = new URL(request.url);
    const uid = url.searchParams.get('uid') || '';
    if(!/^\d{8,12}$/.test(uid)) return reply({ ok:false, error:'invalid_uid' }, 400, h);

    const cacheKey = new Request('https://player-info.cache/' + uid);
    const hit = await caches.default.match(cacheKey);
    if(hit){ const body = await hit.text(); return new Response(body, { headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, h) }); }

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try{
      const headers = { 'Accept': 'application/json, text/plain, */*', 'User-Agent': 'Mozilla/5.0 (compatible; SakinduStore/1.0)' };
      if(env && env.UPSTREAM_KEY) headers['Authorization'] = 'Bearer ' + env.UPSTREAM_KEY;     // only if the service gives you a key
      const r = await fetch(UPSTREAM_URL.replace('{uid}', encodeURIComponent(uid)), { headers, signal: ctl.signal });
      const text = await r.text();
      let data; try{ data = JSON.parse(text); }catch(e){ data = null; }
      if(!data){
        return reply({ ok:false, error:'unavailable', detail: env && env.DEBUG === '1' ? text.slice(0, 300) : undefined }, 502, h);
      }
      const nickname = deepFind(data, NICK_KEYS);
      if(!nickname){
        return reply({ ok:false, error:'not_found', detail: env && env.DEBUG === '1' ? JSON.stringify(data).slice(0, 400) : undefined }, 404, h);
      }
      const level = deepFind(data, LEVEL_KEYS);
      const region = deepFind(data, REGION_KEYS);
      const likesRaw = deepFind(data, LIKES_KEYS);
      const likes = likesRaw != null && /\d/.test(String(likesRaw)) ? parseInt(String(likesRaw).replace(/\D/g, ''), 10) : null;
      const out = { ok:true, uid, nickname: String(nickname).replace(/[<>]/g, ''), level: level != null ? Number(level) || null : null, region: region != null ? String(region).toUpperCase() : '', likes };
      const res = reply(out, 200, h);
      const cached = new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=' + CACHE_SECONDS } });
      ctx.waitUntil(caches.default.put(cacheKey, cached));
      return res;
    } catch(e){
      return reply({ ok:false, error:'unavailable' }, 504, h);
    } finally { clearTimeout(timer); }
  }
};
