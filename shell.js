/* ===== Shell Topup front-end =====
   Separate accounts (collection `shellUsers`), shell balance, orders paid in shells (`shellOrders`).
   Needs: firebase-init.js, db.js, shell-data.js loaded first. */

const SH_UID_API_URL = "https://ff.api.rauniyarmultipurpose.com.np/api.php";
const SH_UID_API_KEY = "YOUR_KEY";   // same placeholder as app.js — set a real key to enable real UID lookup
const SH_MAX_QTY = 20;

let shSession = JSON.parse(localStorage.getItem('shell_session') || 'null');
let shBalance = 0;
let shVerified = false, shPlayerName = '', shVerifiedUid = '', shLevel = null, shPlayerRegion = '';
let shSoldOut = {};
let shQty = {};
let shAuthMode = 'login';

function shEsc(t){ return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function $(id){ return document.getElementById(id); }

/* ---------- password hashing (salted SHA-256; never store plain passwords) ---------- */
function shRandomSalt(){
  const a = new Uint8Array(16); crypto.getRandomValues(a);
  return Array.from(a).map(b => b.toString(16).padStart(2,'0')).join('');
}
async function shHash(pass, salt){
  if(!(window.crypto && crypto.subtle)) throw new Error('Secure (HTTPS) connection required to sign in.');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pass));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

/* ---------- drawer / header ---------- */
function shToggleMenu(open){
  $('shDrawer').classList.toggle('show', open);
  $('shOverlay').classList.toggle('show', open);
}
function shRenderHeader(){
  const signed = !!shSession;
  $('shSignBtn').style.display = signed ? 'none' : 'block';
  $('shChip').classList.toggle('show', signed);
  $('shBalance').textContent = shBalance;
  $('shLogoutItem').style.display = signed ? 'flex' : 'none';
  $('shDrawerUser').textContent = signed ? shSession.name : 'Menu';
}
async function shRefreshUser(){
  if(!shSession) return;
  try{
    const u = await fsGetShellUser(shSession.email);
    if(!u){ shLogout(); return; }
    shBalance = u.shells || 0;
    shRenderHeader();
  } catch(e){ console.error('[ShellTopup] refresh user', e); }
}

/* ---------- auth ---------- */
function shOpenAuth(mode){
  shAuthMode = mode;
  shRenderAuth();
  $('shAuthOv').classList.add('show');
}
function shCloseAuth(){ $('shAuthOv').classList.remove('show'); }
function shRenderAuth(){
  const login = shAuthMode === 'login';
  $('shAuthTitle').textContent = login ? 'Sign in' : 'Sign up';
  $('shAuthSub').textContent = login ? 'Shell Topup account එකට sign in වෙන්න. (SakinduStore account එකෙන් වෙනස්)' : 'අලුත් Shell Topup account එකක් හදන්න.';
  $('shAuthName').style.display = login ? 'none' : 'block';
  $('shAuthAgeRow').style.display = login ? 'none' : 'flex';
  $('shAuthPass').autocomplete = login ? 'current-password' : 'new-password';
  $('shAuthMsg').textContent = '';
  $('shAuthSwitch').innerHTML = login
    ? `Account එකක් නැද්ද? <a onclick="shOpenAuth('signup')">Sign up</a>`
    : `Account එකක් තියෙනවද? <a onclick="shOpenAuth('login')">Sign in</a>`;
}
function shMsg(el, text, cls){ el.textContent = text; el.className = 'sh-status' + (cls ? ' ' + cls : ''); }
async function shSubmitAuth(){
  const email = $('shAuthEmail').value.trim().toLowerCase();
  const pass = $('shAuthPass').value;
  const name = $('shAuthName').value.trim();
  const msg = $('shAuthMsg');
  if(!/^[^\s@\/]+@[^\s@\/]+\.[^\s@\/]+$/.test(email)){ shMsg(msg, '⚠️ Valid email address එකක් දාන්න.', 'err'); return; }
  if(pass.length < 6){ shMsg(msg, '⚠️ Password එක අකුරු 6කට වැඩි විය යුතුයි.', 'err'); return; }
  if(shAuthMode === 'signup'){
    if(!name){ shMsg(msg, '⚠️ නම දාන්න.', 'err'); return; }
    if(!$('shAuthAge').checked){ shMsg(msg, '⚠️ Shell Topup භාවිතා කළ හැක්කේ අවුරුදු 18ට වැඩි අයට පමණයි — 18+ බව confirm කරන්න.', 'err'); return; }
  }
  const btn = $('shAuthBtn'); btn.disabled = true; btn.textContent = 'Please wait...';
  shMsg(msg, '');
  try{
    if(shAuthMode === 'signup'){
      const salt = shRandomSalt();
      const passHash = await shHash(pass, salt);
      await fsCreateShellUser(email, { name, email, salt, passHash, shells: 0, ageConfirmed18: true, createdAt: new Date().toISOString() });
      shStartSession(email, name);
    } else {
      const u = await fsGetShellUser(email);
      const ok = u && u.passHash && (await shHash(pass, u.salt)) === u.passHash;
      if(!ok){ shMsg(msg, '❌ Email හෝ password වැරදියි.', 'err'); return; }
      shStartSession(email, u.name);
    }
  } catch(err){
    if(err && err.code === 'exists') shMsg(msg, 'මේ email එකෙන් Shell Topup account එකක් දැනටමත් තියෙනවා.', 'err');
    else { console.error('[ShellTopup] auth', err); shMsg(msg, '❌ ' + (err.message || err), 'err'); }
  } finally {
    btn.disabled = false; btn.textContent = 'Continue';
  }
}
function shStartSession(email, name){
  shSession = { email, name };
  localStorage.setItem('shell_session', JSON.stringify(shSession));
  shCloseAuth();
  $('shAuthPass').value = '';
  shRefreshUser();
  shRenderHeader();
  shRenderOrders();
}
function shLogout(){
  localStorage.removeItem('shell_session');
  shSession = null; shBalance = 0;
  shToggleMenu(false);
  shRenderHeader(); shRenderOrders();
}

/* ---------- player ID verification ---------- */
let shAutoTimer = null;
function shUidChanged(){
  const box = $('shUid'); const cleaned = box.value.replace(/\D/g, ''); if(cleaned !== box.value) box.value = cleaned;
  const uid = $('shUid').value.replace(/\D/g, '');
  if(shVerified && uid !== shVerifiedUid){
    shVerified = false; shPlayerName = ''; shLevel = null; shPlayerRegion = '';
    shMsg($('shVerifyStatus'), '');
    shRenderProducts();
  }
  clearTimeout(shAutoTimer);
  // live lookup configured -> verify by itself once a full UID has been typed
  if(typeof PLAYER_INFO_URL !== 'undefined' && PLAYER_INFO_URL && /^\d{8,12}$/.test(uid)) shAutoTimer = setTimeout(shVerify, 800);
}
async function shVerify(){
  const uid = $('shUid').value.replace(/\D/g, '');
  const status = $('shVerifyStatus');
  shVerified = false;
  if(!uid){ shMsg(status, 'Player ID එකක් type කරන්න.', ''); return; }
  if(!/^\d{8,12}$/.test(uid)){ shMsg(status, '⚠️ Player ID එක වැරදියි. digits 8-12ක් තිබිය යුතුයි.', 'err'); shRenderProducts(); return; }
  const btn = $('shVerifyBtn'); btn.disabled = true;
  shMsg(status, '⏳ Checking Player ID...', '');
  if(typeof PLAYER_INFO_URL !== 'undefined' && PLAYER_INFO_URL){
    const info = await lookupPlayerInfo(uid);
    btn.disabled = false;
    if($('shUid').value.replace(/\D/g, '') !== uid) return;                 // UID was edited while we were checking
    if(info.ok){
      shVerified = true; shVerifiedUid = uid; shPlayerName = info.nickname; shLevel = info.level; shPlayerRegion = info.region;
      status.className = 'sh-status';
      status.innerHTML = info.fallback
        ? `<span class="sh-player">✅ UID accepted</span><div style="margin-top:8px;color:var(--sh-muted);font-size:.85rem;">Player details auto ගන්න බැරි උනා — type කළ UID එකම භාවිත කරනවා.</div>`
        : `<span class="sh-player">✅ UID Verified · ${shEsc(playerInfoChip(info))}</span>`;
    } else {
      shMsg(status, info.error === 'not_found' ? '❌ මේ Player ID එක හොයාගන්න බැරි උනා.' : '⚠️ Verify කරන්න බැරි උනා (සේවාව දැනට වැඩ නැහැ). ටිකකින් නැවත Verify එබුවම බලන්න.', 'err');
    }
    shRenderProducts();
    return;
  }
  let name = '', region = '';
  try{
    const r = await fetch(`${SH_UID_API_URL}?uid=${encodeURIComponent(uid)}&key=${encodeURIComponent(SH_UID_API_KEY)}`);
    const d = await r.json();
    if(d && d.status && d.data){ name = d.data.username || ''; region = d.data.region || ''; }
  } catch(e){ /* API unavailable -> fall back to format-only verification (same as the main store) */ }
  shVerified = true; shVerifiedUid = uid; shPlayerName = name;
  status.className = 'sh-status';
  status.innerHTML = `<span class="sh-player">✅ ${name ? shEsc(name) + (region ? ' · ' + shEsc(region) : '') : 'Player ID Verified'}</span>`;
  btn.disabled = false;
  shRenderProducts();
}

/* ---------- products ---------- */
const SH_ICONS = { lite:'🎫', weekly:'🎫', monthly:'🎫', diamond:'💎', levelup:'⭐' };
function shRenderProducts(){
  const locked = !shVerified;
  $('shLockedNote').style.display = locked ? 'block' : 'none';
  $('shProducts').innerHTML = SHELL_PRODUCTS.map(p => {
    const sold = !!shSoldOut[p.id];
    const q = shQty[p.id] || 0;
    const off = locked || sold;
    return `
    <div class="sh-prod ${locked ? 'locked' : ''} ${sold ? 'soldout' : ''}">
      <div class="sh-prod-top">
        <div class="sh-ic ${p.kind}">${SH_ICONS[p.kind]}</div>
        <div>
          <h3>${p.name}${sold ? '<span class="sh-sold-badge">SOLD OUT</span>' : ''}</h3>
          <div class="sh-price">${p.shells}<small>shells</small></div>
        </div>
      </div>
      <div class="sh-qty">
        <button ${off || q <= 0 ? 'disabled' : ''} onclick="shChange('${p.id}',-1)">−</button>
        <div class="sh-q">${q}</div>
        <button ${off || q >= SH_MAX_QTY ? 'disabled' : ''} onclick="shChange('${p.id}',1)">+</button>
      </div>
    </div>`;
  }).join('');
  shUpdateCheckout();
}
function shChange(id, d){
  if(!shVerified || shSoldOut[id]) return;
  shQty[id] = Math.max(0, Math.min(SH_MAX_QTY, (shQty[id] || 0) + d));
  shRenderProducts();
}
function shCart(){
  return SHELL_PRODUCTS.filter(p => (shQty[p.id] || 0) > 0 && !shSoldOut[p.id])
    .map(p => ({ id:p.id, name:p.name, shells:p.shells, qty:shQty[p.id] }));
}
function shUpdateCheckout(){
  const cart = shCart();
  const total = cart.reduce((s,i) => s + i.shells * i.qty, 0);
  const count = cart.reduce((s,i) => s + i.qty, 0);
  $('shTotal').textContent = total;
  $('shItemsCount').textContent = count + (count === 1 ? ' item' : ' items');
  $('shCheckout').classList.toggle('show', shVerified && count > 0);
}

/* ---------- place order (paid with shells) ---------- */
async function shPlaceOrder(){
  const status = $('shOrderStatus');
  if(!shSession){ shOpenAuth('login'); return; }
  if(!shVerified){ shMsg(status, 'කරුණාකර Player ID එක verify කරන්න.', 'err'); return; }
  const btn = $('shPlaceBtn'); btn.disabled = true; btn.textContent = 'Placing...';
  shMsg(status, '');
  try{
    const store = await fsGetConfig('store', { closed:false });
    if(store.closed) throw Object.assign(new Error('SakinduStore දැනට තාවකාලිකව වසා ඇත. පසුව try කරන්න.'), { code:'closed' });
    shSoldOut = await fsGetShellSoldOut();          // re-check sold-out right before paying
    const cart = shCart();
    if(!cart.length){ shRenderProducts(); throw Object.assign(new Error('Sold out වූ products ඉවත් කරා. නැවත තෝරන්න.'), { code:'soldout' }); }
    const totalShells = cart.reduce((s,i) => s + i.shells * i.qty, 0);
    const order = {
      id: Date.now(), email: shSession.email, name: shSession.name,
      uid: shVerifiedUid, player: shPlayerName, level: shLevel, playerRegion: shPlayerRegion, game: 'Free Fire',
      items: cart, totalShells, status: 'Processing',
      date: new Date().toLocaleString(), createdAt: new Date().toISOString()
    };
    shBalance = await fsPlaceShellOrder(shSession.email, order);
    shQty = {};
    shRenderHeader(); shRenderProducts(); shRenderOrders();
    shMsg(status, `✅ Order එක place උනා! 🐚 ${totalShells} shells deduct කළා. Admin deliver කරනකම් "Processing" status එකේ පවතී.`, 'ok');
  } catch(err){
    if(err && err.code === 'insufficient'){
      await shRefreshUser();
      status.className = 'sh-status err';
      status.innerHTML = `❌ Shells ප්‍රමාණවත් නැහැ (ඔබ ළඟ 🐚 ${shBalance}). <a href="shell-pins.html" style="color:var(--sh-cyan);font-weight:700;">Redeem Pin මිලදී ගන්න</a> හෝ <a onclick="shOpenRedeem()" style="color:var(--sh-cyan);font-weight:700;cursor:pointer;">Pin එකක් Redeem කරන්න</a>.`;
    } else {
      console.error('[ShellTopup] order', err);
      shMsg(status, '❌ ' + (err.message || err), 'err');
    }
    shRenderProducts();
  } finally {
    btn.disabled = false; btn.textContent = 'Place Order';
  }
}

/* ---------- orders ---------- */
async function shRenderOrders(){
  const box = $('shOrders');
  if(!shSession){ box.innerHTML = `<p class="sub">ඔබේ orders බලන්න <a onclick="shOpenAuth('login')" style="color:var(--sh-cyan);cursor:pointer;font-weight:700;">Sign in</a> වෙන්න.</p>`; return; }
  try{
    const list = await fsGetMyShellOrders(shSession.email);
    if(!list.length){ box.innerHTML = '<p class="sub">තවම orders කිසිවක් නැහැ.</p>'; return; }
    box.innerHTML = list.map(o => {
      const cls = o.status === 'Completed' ? 'd' : (o.status === 'Rejected' ? 'r' : 'p');
      const items = (o.items || []).map(i => `${i.qty}× ${shEsc(i.name)}`).join(', ');
      return `<div class="sh-order">
        <div class="top"><span>🐚 ${o.totalShells}</span><span class="pill ${cls}">${shEsc(o.status).toUpperCase()}</span></div>
        <div class="meta">${items}<br>UID: ${shEsc(o.uid)}${o.player ? ' (' + shEsc(o.player) + ')' : ''}<br>${shEsc(o.date)}${o.status === 'Rejected' ? '<br>Shells ඔබේ wallet එකට refund කළා.' : ''}</div>
      </div>`;
    }).join('');
  } catch(e){ console.error('[ShellTopup] orders', e); box.innerHTML = '<p class="sub">Orders load කරන්න බැරි උනා.</p>'; }
}

/* ---------- redeem pin ---------- */
function shOpenRedeem(){
  if(!shSession){ shOpenAuth('login'); return; }
  $('shRedeemBal').textContent = shBalance;
  shMsg($('shRedeemMsg'), '');
  $('shRedeemOv').classList.add('show');
}
function shCloseRedeem(){ $('shRedeemOv').classList.remove('show'); }
async function shRedeem(){
  const code = $('shPinInput').value.trim();
  const msg = $('shRedeemMsg');
  if(!code){ shMsg(msg, 'Pin code එක type කරන්න.', 'err'); return; }
  if(code.includes('/')){ shMsg(msg, '❌ Invalid Pin.', 'err'); return; }
  const btn = $('shRedeemBtn'); btn.disabled = true; btn.textContent = 'Redeeming...';
  try{
    const r = await fsRedeemPin(code, shSession.email);
    shBalance = r.balance;
    $('shRedeemBal').textContent = shBalance;
    $('shPinInput').value = '';
    shRenderHeader();
    shMsg(msg, `✅ 🐚 ${r.added} shells ඔබේ wallet එකට add උනා!`, 'ok');
  } catch(err){
    const m = { invalid:'❌ Invalid Pin code.', used:'⚠️ මේ Pin එක කලින් redeem කරලා තියෙනවා.', nouser:'❌ Account එක හම්බුනේ නැහැ — නැවත sign in වෙන්න.' }[err && err.code];
    if(!m) console.error('[ShellTopup] redeem', err);
    shMsg(msg, m || ('❌ ' + (err.message || err)), 'err');
  } finally { btn.disabled = false; btn.textContent = 'Redeem'; }
}

/* ---------- init ---------- */
(async function init(){
  $('shLogo').innerHTML = shellLogoSvg(40);
  shRenderHeader();
  shRenderProducts();
  shRenderOrders();
  try{ shSoldOut = await fsGetShellSoldOut(); } catch(e){ console.error('[ShellTopup] sold-out config', e); }
  shRenderProducts();
  shRefreshUser();
  document.addEventListener('keydown', e => {
    if(e.key !== 'Enter') return;
    if($('shAuthOv').classList.contains('show')) shSubmitAuth();
    else if($('shRedeemOv').classList.contains('show')) shRedeem();
  });
})();
