/* ===== Free Fire Player Info / Account Value =====
   One script for both pages (<body data-feature="info"> or "value").
   Each user gets 2 lookups per feature; when the 2nd is used the feature locks for 24 hours (live countdown). */
const FEATURE = document.body.getAttribute('data-feature') === 'value' ? 'value' : 'info';
const FETCHED_VIA = 'Fetched Via - WWW.SAKINDU.STORE';
let lkTimer = null, lkState = null, lkBusy = false, lkLast = null;

function esc(t){ return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function isEmptyVal(v){ return v == null || v === '' || v === 'None' || v === 'null'; }
function fmtVal(v){
  if(isEmptyVal(v)) return '—';
  if(typeof v === 'boolean') return v ? 'Yes' : 'No';
  if(typeof v === 'number') return v.toLocaleString();
  return String(v).replace(/^(Gender|Language|ModePrefer|TimeActive|RankShow)_/, '');
}
function stripColors(t){ return String(t == null ? '' : t).replace(/\[(?:[0-9a-fA-F]{6}|\/?[a-zA-Z])\]/g, '').trim(); }
function prettyLabel(k){ return String(k).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function session(){ try{ return JSON.parse(localStorage.getItem('sakindu_session') || 'null'); }catch(e){ return null; } }
function apiOrigin(){ try{ return new URL(PLAYER_INFO_URL.replace('{uid}', '0')).origin; }catch(e){ return ''; } }
function $(id){ return document.getElementById(id); }

/* ---------- limit + countdown ---------- */
function pad(n){ return String(n).padStart(2, '0'); }
function fmtCountdown(ms){
  const s = Math.max(0, Math.floor(ms / 1000));
  return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor((s % 3600) / 60)) + ':' + pad(s % 60);
}
async function refreshLimit(){
  const s = session();
  if(!s){ lkState = null; renderLimit(); return; }
  try{ lkState = await fsGetInfoLimit(s.phone, FEATURE); }catch(e){ console.error('[lookup] limit', e); lkState = null; }
  renderLimit();
}
function renderLimit(){
  clearInterval(lkTimer);
  const box = $('limitBox'), btn = $('lookupBtn'), input = $('lookupUid');
  const s = session();
  if(!s){
    box.innerHTML = `<div class="lk-login">මේ service එක භාවිත කරන්න <a href="#" onclick="openAuth('login');return false;">Login / Sign Up</a> වෙන්න.</div>`;
    btn.disabled = false; input.disabled = false; return;
  }
  if(!lkState){ box.innerHTML = '<div class="lk-meta">Loading...</div>'; return; }
  if(lkState.remaining > 0){
    box.innerHTML = `<div class="lk-meta">🎟️ ඉතිරි lookups: <strong>${lkState.remaining} / ${lkState.limit}</strong> <span>(එක user කෙනෙක්ට පැය 24ක් ඇතුළත ${lkState.limit} පාරයි)</span></div>`;
    btn.disabled = false; input.disabled = false; return;
  }
  // limit reached -> 24 h countdown
  btn.disabled = true; input.disabled = true;
  const tick = () => {
    const left = lkState.lockedUntil - Date.now();
    if(left <= 0){ clearInterval(lkTimer); refreshLimit(); return; }
    $('lkClock').textContent = fmtCountdown(left);
  };
  box.innerHTML = `<div class="lk-locked"><div class="lk-lock-title">⏳ Limit එක ඉවරයි — ඊළඟ lookup එකට</div><div class="lk-clock" id="lkClock">--:--:--</div><div class="lk-lock-sub">පැය : විනාඩි : තත්පර</div></div>`;
  tick(); lkTimer = setInterval(tick, 1000);
}

/* ---------- lookup ---------- */
async function doLookup(){
  if(lkBusy) return;
  const s = session();
  if(!s){ openAuth('login'); return; }
  const st = $('lookupStatus'), out = $('lookupResult');
  const uid = $('lookupUid').value.replace(/\D/g, '');
  $('lookupUid').value = uid;
  if(!/^\d{8,12}$/.test(uid)){ st.className = 'verify-status err'; st.textContent = '⚠️ UID එක වැරදියි. ඉලක්කම් 8-12ක් තිබිය යුතුයි.'; return; }
  if(typeof isStoreClosed === 'function' && isStoreClosed()){ st.className = 'verify-status err'; st.textContent = '🛑 SakinduStore දැනට තාවකාලිකව වසා ඇත.'; return; }
  lkBusy = true; $('lookupBtn').disabled = true; out.innerHTML = '';
  try{
    const cur = await fsGetInfoLimit(s.phone, FEATURE);
    if(cur.remaining <= 0){ lkState = cur; renderLimit(); st.textContent = ''; return; }
    st.className = 'verify-status'; st.innerHTML = '⏳ Account එක check කරනවා... (පළමු වතාවේ තත්පර කීපයක් යා හැක)';
    const info = await lookupPlayerInfo(uid);
    if(!info.ok){ st.className = 'verify-status err'; st.textContent = info.error === 'not_found' ? '❌ මේ UID එක හොයාගන්න බැරි උනා. UID එක නිවැරදිද බලන්න.' : '⚠️ දැනට විස්තර ගන්න බැහැ. ටිකකින් නැවත try කරන්න. (මේ උත්සාහය ගණන් ගත්තේ නැහැ)'; return; }
    if(info.fallback || !info.raw){ st.className = 'verify-status err'; st.textContent = '⚠️ Player info service එක දැනට වැඩ නැහැ. ටිකකින් නැවත try කරන්න. (මේ උත්සාහය ගණන් ගත්තේ නැහැ)'; return; }
    // only a successful lookup uses up one of the two
    const used = await fsConsumeInfoLookup(s.phone, FEATURE);
    if(!used.allowed){ lkState = used; renderLimit(); st.textContent = ''; return; }
    st.className = 'verify-status ok'; st.textContent = '✅ UID Verified';
    lkLast = info.raw;
    out.innerHTML = FEATURE === 'value' ? renderValue(info.raw, uid) : renderInfo(info.raw, uid);
    lkState = infoLimitState({ count: used.count, firstAt: used.firstAt, lockedUntil: used.lockedUntil }, Date.now());
    renderLimit();
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch(e){
    console.error('[lookup]', e); st.className = 'verify-status err'; st.textContent = '❌ ' + (e.message || e);
  } finally { lkBusy = false; if(!lkState || lkState.remaining > 0) $('lookupBtn').disabled = false; }
}

/* ---------- rendering ---------- */
/* IDs / UIDs / title codes are shown exactly as they are (no thousands separators) */
function row(label, v){
  const raw = typeof v === 'number' && /\b(id|uid|ids|title)\b/i.test(label);
  return `<div class="pi-row"><span>${esc(label)}</span><strong>${esc(raw ? String(v) : fmtVal(v))}</strong></div>`;
}
function section(title, rowsHtml){ return rowsHtml ? `<div class="pi-section"><h3>${title}</h3><div class="pi-grid">${rowsHtml}</div></div>` : ''; }
function listVal(arr){ return Array.isArray(arr) && arr.length ? arr.join(', ') : null; }
function header(d, uid){
  const flag = d.region_flag ? esc(d.region_flag) + ' ' : '';
  const banner = d.banner_image && !isEmptyVal(d.banner_image) ? (String(d.banner_image).startsWith('/') ? apiOrigin() + d.banner_image : d.banner_image) : '';
  return `${banner ? `<img class="pi-banner" src="${esc(banner)}" alt="" onerror="this.style.display='none'">` : ''}
    <div class="pi-head">
      <div class="pi-name">${esc(stripColors(d.name))}</div>
      <div class="pi-sub">UID ${esc(d.uid || uid)} · ${flag}${esc(d.region_name || d.region || '')}</div>
      <div class="pi-chips"><span>Lv ${esc(fmtVal(d.level))}</span>${d.likes != null ? `<span>❤️ ${esc(fmtVal(Number(d.likes)))}</span>` : ''}${d.exp != null ? `<span>EXP ${esc(fmtVal(d.exp))}</span>` : ''}</div>
    </div>`;
}
function footer(){ return `<div class="pi-fetched">${esc(FETCHED_VIA)}</div>`; }
/* everything the API knows about the account EXCEPT its value (that is a separate service) */
function renderInfo(d, uid){
  const br = d.battle_royale || {}, cs = d.clash_squad || {}, g = d.guild || {}, pet = d.pet || {}, eq = d.equipment || {};
  let html = header(d, uid);
  html += section('👤 Profile',
    row('Gender', d.gender) + row('Language', d.language) + row('Mode prefer', d.mode_prefer) + row('Time active', d.time_active) +
    row('Rank shown', d.rank_show) + row('Prime level', d.prime_level) + row('Credit score', d.credit_score) + row('Honor score', d.honor_score) +
    row('Title ID', d.title) + row('Signature', stripColors(d.signature)) + row('Created', d.created_at) + row('Last login', d.last_login) +
    row('Account age (days)', d.days_old) + row('Season', d.season_id) + row('Game version', d.release_version) + row('Account type', d.account_type));
  html += section('🏆 Ranks',
    row('BR tier', br.tier) + row('BR max rank', br.max_rank) + row('BR points', br.points) + row('BR current rank', br.current_rank) +
    row('CS tier', cs.tier) + row('CS max rank', cs.max_rank) + row('CS points', cs.points) + row('CS peak points', cs.peak_points));
  html += section('🛡️ Guild',
    row('Name', stripColors(g.name)) + row('Guild ID', g.id) + row('Level', g.level) +
    row('Members', g.member_count != null ? g.member_count + ' / ' + (g.capacity ?? '?') : null) +
    row('Leader', stripColors(g.leader_name)) + row('Leader UID', g.leader_uid) + row('Leader level', g.leader_level) + row('Leader likes', g.leader_likes) +
    row('Leader region', g.leader_region) + row('Leader BR max rank', g.leader_br_max_rank) + row('Leader CS max rank', g.leader_cs_max_rank) +
    row('Leader last login', g.leader_last_login) + row('Leader created', g.leader_created_at));
  html += section('🐾 Pet',
    row('Name', pet.name) + row('Level', pet.level) + row('EXP', pet.exp) + row('Pet ID', pet.id) + row('Skin ID', pet.skin_id) + row('Skill ID', pet.skill_id) + row('Selected', pet.is_selected));
  html += section('🎒 Equipment',
    row('Outfits equipped', eq.outfit_count) + row('Outfit IDs', listVal(eq.outfits)) + row('Weapons equipped', eq.weapon_count) + row('Weapon IDs', listVal(eq.weapons)) +
    row('Skill IDs', listVal(eq.skills)) + row('Avatar ID', eq.avatar_id) + row('Banner ID', eq.banner_id) + row('Booyah pass ID', eq.bp_id) + row('BP badges', eq.bp_badges));
  // every field exactly as the API lists it (value fields are left out)
  const all = (Array.isArray(d.all_fields) ? d.all_fields : Object.keys(d).filter(k => d[k] == null || typeof d[k] !== 'object').map(k => ({ key: k, label: prettyLabel(k), value: d[k] })))
    .filter(f => !/valuation|account[ _]?value|worth/i.test(f.key + ' ' + f.label));
  html += `<details class="pi-all" open><summary>📋 All fields (${all.length})</summary><div class="pi-grid">${all.map(f => row(f.label, f.key === 'signature' ? stripColors(f.value) : f.value)).join('')}</div></details>`;
  html += `<button class="btn btn-ghost btn-block" style="margin-top:14px;" onclick="copyLookup(this)">📋 Copy summary</button>` + footer();
  return `<div class="pi-card">${html}</div>`;
}
function renderValue(d, uid){
  const v = d.valuation;
  let html = header(d, uid);
  if(v && typeof v === 'object'){
    const tier = v.rarity_tier || v.tier || '';
    const known = ['usd', 'bdt', 'rarity_tier', 'tier'];
    html += `<div class="pi-value">
        ${tier ? `<div class="pi-tier tier-${esc(String(tier).toLowerCase().replace(/[^a-z]/g, ''))}">${esc(tier)}</div>` : ''}
        <div class="pi-value-label">ACCOUNT VALUE</div>
        <div class="pi-money">${esc(v.usd != null ? v.usd : '—')}</div>
        <div class="pi-money sub">${esc(v.bdt != null ? v.bdt : '—')}</div>
      </div>`;
    const extra = Object.keys(v).filter(k => !known.includes(k)).map(k => row(prettyLabel(k), v[k])).join('');
    if(extra) html += section('📊 More', extra);
  } else {
    html += `<div class="verify-status err" style="margin-top:14px;">මේ account එකේ Value data API එකෙන් ලැබුණේ නැහැ.</div>`;
  }
  html += `<button class="btn btn-ghost btn-block" style="margin-top:14px;" onclick="copyLookup(this)">📋 Copy summary</button>` + footer();
  return `<div class="pi-card">${html}</div>`;
}
function copyLookup(btn){
  const d = lkLast; if(!d) return;
  const v = d.valuation || {};
  const lines = FEATURE === 'value'
    ? ['Free Fire Account Value', 'Name: ' + stripColors(d.name), 'UID: ' + d.uid, 'Region: ' + (d.region_name || d.region), 'Level: ' + d.level, 'Rarity: ' + (v.rarity_tier || '-'), 'Value: ' + (v.usd || '-') + ' / ' + (v.bdt || '-')]
    : ['Free Fire Player Info', 'Name: ' + stripColors(d.name), 'UID: ' + d.uid, 'Region: ' + (d.region_name || d.region), 'Level: ' + d.level, 'Likes: ' + d.likes, 'EXP: ' + d.exp,
       'BR: ' + ((d.battle_royale || {}).tier || '-') + ' (' + ((d.battle_royale || {}).points ?? '-') + ')', 'CS: ' + ((d.clash_squad || {}).tier || '-') + ' (' + ((d.clash_squad || {}).points ?? '-') + ')',
       'Guild: ' + stripColors((d.guild || {}).name || '-'), 'Created: ' + d.created_at, 'Last login: ' + d.last_login];
  lines.push(FETCHED_VIA);
  copyText(lines.join('\n'), btn);
}

/* ---------- init ---------- */
$('lookupUid').addEventListener('input', e => { const c = e.target.value.replace(/\D/g, ''); if(c !== e.target.value) e.target.value = c; });
$('lookupUid').addEventListener('keydown', e => { if(e.key === 'Enter') doLookup(); });
let lastPhone = undefined;
setInterval(() => { const s = session(); const p = s ? s.phone : null; if(p !== lastPhone){ lastPhone = p; refreshLimit(); } }, 800);
refreshLimit();
