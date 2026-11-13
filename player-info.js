/* ===== Player info lookup (UID -> nickname, level, region) =====
   Calls the player-info API straight from the browser. If that API does not allow browser calls (CORS) put the
   Cloudflare relay in front of it (cloudflare-worker/README.md) and paste the relay URL here instead.
   `{uid}` is replaced by the UID being checked. Leave empty to turn the live lookup off. */
const PLAYER_INFO_URL = "https://auraffxserverinfocheckerapi.onrender.com/api/player?uid={uid}";
const PLAYER_INFO_TIMEOUT_MS = 20000;   // free Render servers can take a while to wake up
/* false = if the lookup service is down / unreachable the UID is still accepted (format check only) so customers can
   still order; the UID is only rejected when the service clearly says "not found".  true = never accept without a lookup. */
const PLAYER_INFO_STRICT = false;

/* looked-up region code -> store region (used only for a friendly mismatch warning) */
const PLAYER_REGION_TO_STORE = {
  SG:'SG/MY/LK', MY:'SG/MY/LK', LK:'SG/MY/LK', BD:'Bangladesh', BR:'Brazil', ID:'Indonesia', TH:'Thailand',
  VN:'Vietnam', TW:'Taiwan', PH:'Philippines', EU:'Europe', ME:'Middle East & North Africa'
};
const PI_NICK_KEYS   = ['nickname', 'nick_name', 'playername', 'player_name', 'accountname', 'account_name', 'username', 'name'];
const PI_LEVEL_KEYS  = ['level', 'lvl', 'accountlevel', 'account_level'];
const PI_REGION_KEYS = ['region', 'server', 'countrycode', 'country_code', 'country'];
const PI_LIKES_KEYS  = ['likes', 'liked', 'like_count'];

function piClean(t){ return String(t == null ? '' : t).replace(/[<>&"'`]/g, '').trim().slice(0, 40); }
/* first value (shallowest first) stored under any of `keys`, searched in priority order */
function piDeepFind(root, keys){
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
/* keep digits only — no spaces / invisible characters from copy-paste */
function piDigits(v){ return String(v == null ? '' : v).replace(/\D/g, ''); }
function piBuildUrl(uid){
  const u = piDigits(uid);                     // -> ...?uid=8674177274   (nothing between "=" and the number)
  if(PLAYER_INFO_URL.indexOf('{uid}') >= 0) return PLAYER_INFO_URL.replace('{uid}', u);
  return PLAYER_INFO_URL + (PLAYER_INFO_URL.indexOf('?') >= 0 ? '&' : '?') + 'uid=' + u;
}
/* free hosting sleeps when idle — poke it as soon as the page opens so the first real lookup is fast */
function warmUpPlayerInfo(){
  if(!PLAYER_INFO_URL) return;
  try{ fetch(new URL(PLAYER_INFO_URL.replace('{uid}', '0')).origin + '/', { mode: 'no-cors' }).catch(() => {}); }catch(e){}
}

async function lookupPlayerInfo(uid){
  const unavailable = () => PLAYER_INFO_STRICT
    ? { ok: false, error: 'unavailable' }
    : { ok: true, fallback: true, uid, nickname: '', level: null, region: '' };
  // a sleeping free server often fails the very first request, so try once more after a short pause
  let res = await piAttempt(uid);
  if(res.retry){ await new Promise(r => setTimeout(r, 3000)); res = await piAttempt(uid); }
  if(res.info) return res.info;
  return res.notFound ? { ok: false, error: 'not_found' } : unavailable();
}
/* one request -> { info } | { notFound:true } | { retry:true } */
async function piAttempt(uid){
  uid = piDigits(uid);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), PLAYER_INFO_TIMEOUT_MS);
  try{
    const r = await fetch(piBuildUrl(uid), { signal: ctl.signal });
    const raw = await r.text();
    let d = null; try{ d = JSON.parse(raw); }catch(e){}
    if(!d) return { retry: true };                                  // HTML / "server is waking up" page, empty body ...
    const nick = (d.ok === true && d.nickname) ? d.nickname : piDeepFind(d, PI_NICK_KEYS);
    if(nick){
      const level = (d.ok === true && d.level != null) ? d.level : piDeepFind(d, PI_LEVEL_KEYS);
      const region = (d.ok === true && d.region) ? d.region : piDeepFind(d, PI_REGION_KEYS);
      const likesRaw = (d.ok === true && d.likes != null) ? d.likes : piDeepFind(d, PI_LIKES_KEYS);
      const likes = likesRaw != null && /\d/.test(String(likesRaw)) ? parseInt(String(likesRaw).replace(/\D/g, ''), 10) : null;
      return { info: { ok: true, uid, nickname: piClean(nick), level: level != null ? (Number(level) || null) : null, region: piClean(region).toUpperCase(), likes, raw: d } };
    }
    // a JSON answer without a player: only a clear "not found" from the API itself rejects the UID
    const text = JSON.stringify(d);
    if(d.success === false || d.ok === false || d.error || /not\s*found|invalid\s*uid|no\s*player/i.test(text)) return { notFound: true };
    return { retry: true };
  } catch(e){
    return { retry: true };
  } finally { clearTimeout(timer); }
}
function playerInfoChip(info){
  if(info.fallback) return 'UID accepted';
  const parts = [info.nickname];
  if(info.level) parts.push('Lv ' + info.level);
  if(info.region) parts.push(info.region);
  return parts.join(' · ');
}
/* '' when fine / unknown, otherwise a warning sentence */
function playerRegionWarning(infoRegion, selectedStoreRegion){
  const expected = PLAYER_REGION_TO_STORE[infoRegion];
  if(!expected || !selectedStoreRegion || expected === selectedStoreRegion) return '';
  return '⚠️ මේ account එකේ region එක ' + infoRegion + ' — ඔබ තෝරපු region එක (' + selectedStoreRegion + ') වෙනස්. නිවැරදි region එක තෝරන්න.';
}
if(typeof window !== 'undefined') window.addEventListener('load', warmUpPlayerInfo);
