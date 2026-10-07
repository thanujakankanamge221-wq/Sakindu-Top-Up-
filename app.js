/* ---------- UID CHECKER CONFIG ---------- */
/* ⚠️ දාන්න: ඔබේ actual API key එක මෙතනට */
const UID_API_KEY = "YOUR_KEY";
const UID_API_URL = "https://ff.api.rauniyarmultipurpose.com.np/api.php";

/* ---------- SIDEBAR ---------- */
function openSidebar(){
  document.getElementById('sidebar').classList.add('show');
  document.getElementById('sidebarOverlay').classList.add('show');
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('show');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

/* ---------- PACKAGE DATA (categorised, with discount pricing) ---------- */
const packageData = {
  "Top Selling": [
    {label:"Weekly", old:560, price:540, badge:"BIG OFFER"},
    {label:"Monthly", old:2760, price:2720, badge:"BIG OFFER"},
    {label:"Weekly Lite", old:140, price:130},
  ],
  "Diamonds": [
    {label:"25 💎", price:70},
    {label:"50 💎", price:140},
    {label:"115 💎", old:300, price:280},
    {label:"240 💎", price:560},
    {label:"355 💎", price:840},
    {label:"610 💎", price:1400},
    {label:"1240 💎", price:2800},
    {label:"2530 💎", price:5600},
  ],
  "Topup Event Cover": [
    {label:"Event Cover 100 💎", old:250, price:230},
    {label:"Event Cover 310 💎", old:720, price:680},
  ],
  "Level Up Pass": [
    {label:"Level Up Pass", old:160, price:150},
  ]
};
const allCategories = ["All", ...Object.keys(packageData)];
let activeCategory = "All";
let selectedPkg = null;
let selectedPay = "Bank Transfer";
let uidVerified = false;
let verifiedPlayerName = "";

function renderCatTabs(){
  const el = document.getElementById('catTabs');
  el.innerHTML = allCategories.map(cat =>
    `<div class="cat-tab ${cat===activeCategory?'active':''}" onclick="setCategory('${cat}')">${cat.toUpperCase()}</div>`
  ).join('');
}

function setCategory(cat){
  activeCategory = cat;
  renderCatTabs();
  renderPackages();
}

function renderPackages(){
  const container = document.getElementById('pkgContainer');
  const cats = activeCategory === "All" ? Object.keys(packageData) : [activeCategory];
  container.innerHTML = cats.map(cat => `
    <div class="cat-heading">🏷️ ${cat.toUpperCase()}</div>
    <div class="pkg-grid">
      ${packageData[cat].map((p,i) => `
        <div class="pkg-card" onclick="selectPkg('${cat}',${i})" id="pkg-${cat}-${i}">
          ${p.badge ? `<div class="badge">${p.badge}</div>` : ''}
          <div class="amt">${p.label}</div>
          ${p.old ? `<div class="old-price">Rs. ${p.old}</div>` : `<div class="lbl">Free Fire</div>`}
          <div class="price">Rs. ${p.price}</div>
        </div>`).join('')}
    </div>
  `).join('');
}

function selectPkg(cat, index){
  selectedPkg = packageData[cat][index];
  document.querySelectorAll('.pkg-card').forEach(c => c.classList.remove('selected'));
  document.getElementById(`pkg-${cat}-${index}`).classList.add('selected');
  document.getElementById('totalAmount').textContent = 'Rs. ' + selectedPkg.price;
}

function selectPay(name, el){
  selectedPay = name;
  document.querySelectorAll('.pay-method').forEach(p => p.classList.remove('selected'));
  el.classList.add('selected');
}

/* ---------- REAL UID VERIFICATION (E56 Fetch API) ---------- */
async function verifyUID(){
  const uid = document.getElementById('uidInput').value.trim();
  const status = document.getElementById('verifyStatus');
  const btn = document.getElementById('verifyBtn');

  uidVerified = false;
  verifiedPlayerName = "";

  if(!uid){
    status.innerHTML = 'UID එකක් type කරන්න.';
    status.className = 'verify-status';
    return;
  }
  if(!/^\d{6,10}$/.test(uid)){
    status.innerHTML = '⚠️ UID එක වැරදියි. digits 6-10ක් තිබිය යුතුයි.';
    status.className = 'verify-status err';
    return;
  }

  status.innerHTML = '⏳ Checking UID...';
  status.className = 'verify-status';
  if(btn){ btn.disabled = true; }

  try{
    const url = `${UID_API_URL}?uid=${encodeURIComponent(uid)}&key=${encodeURIComponent(UID_API_KEY)}`;
    const response = await fetch(url);
    const data = await response.json();

    if(data.status){
      uidVerified = true;
      verifiedPlayerName = data.data.username;
      status.innerHTML = `<span class="player-name-chip">✅ ${data.data.username}${data.data.region ? ' · ' + data.data.region : ''}</span>`;
      status.className = 'verify-status';
    } else {
      uidVerified = false;
      status.innerHTML = `❌ ${data.message || 'Player සොයාගත නොහැක.'}`;
      status.className = 'verify-status err';
    }
  } catch(err){
    uidVerified = false;
    status.innerHTML = '⚠️ Verification service එකට connect වෙන්න බැරි උනා. Network එක check කරලා try කරන්න.';
    status.className = 'verify-status err';
  } finally {
    if(btn){ btn.disabled = false; }
  }
}

function placeOrder(){
  const uid = document.getElementById('uidInput').value.trim();
  if(!uid){ alert('කරුණාකර UID එක type කරන්න.'); return; }
  if(!uidVerified){ alert('කරුණාකර UID එක verify කරන්න.'); return; }
  if(!selectedPkg){ alert('කරුණාකර package එකක් තෝරන්න.'); return; }

  const orders = JSON.parse(localStorage.getItem('sakindu_orders') || '[]');
  const order = {
    id: Date.now(),
    uid, player: verifiedPlayerName, package: selectedPkg.label, amount: selectedPkg.price,
    payment: selectedPay, status: 'Pending', date: new Date().toLocaleString()
  };
  orders.push(order);
  localStorage.setItem('sakindu_orders', JSON.stringify(orders));
  renderOrders();

  const msg = `🛒 New Order - SakinduStore%0AUID: ${uid}${verifiedPlayerName ? ' (' + verifiedPlayerName + ')' : ''}%0APackage: ${selectedPkg.label}%0AAmount: Rs. ${selectedPkg.price}%0APayment: ${selectedPay}`;
  window.open(`https://wa.me/94760627795?text=${msg}`, '_blank');
}

/* ---------- WALLET ---------- */
function getWalletBalance(){
  return parseInt(localStorage.getItem('sakindu_wallet_balance') || '0', 10);
}
function renderWallet(){
  document.getElementById('walletBalance').textContent = 'Rs. ' + getWalletBalance();
}
function uploadProof(){
  const file = document.getElementById('proofFile').files[0];
  const status = document.getElementById('proofStatus');
  if(!file){ return; }
  status.textContent = `✅ "${file.name}" uploaded. Verification එක සඳහා admin review කරනු ඇත (usually 5-10 min).`;
  status.className = 'verify-status ok';
}
const validCodes = { "SAKINDU100": 100, "FREEFIRE50": 50, "WELCOME200": 200 };
function redeemCode(){
  const code = document.getElementById('redeemInput').value.trim().toUpperCase();
  const status = document.getElementById('redeemStatus');
  if(!code){ status.textContent = 'Code එකක් type කරන්න.'; status.className='verify-status'; return; }
  const redeemed = JSON.parse(localStorage.getItem('sakindu_redeemed') || '[]');
  if(redeemed.includes(code)){
    status.textContent = '⚠️ මේ code එක කලින් redeem කරලා තියෙනවා.';
    status.className = 'verify-status';
    return;
  }
  if(validCodes[code]){
    const bal = getWalletBalance() + validCodes[code];
    localStorage.setItem('sakindu_wallet_balance', bal);
    redeemed.push(code);
    localStorage.setItem('sakindu_redeemed', JSON.stringify(redeemed));
    status.textContent = `✅ Rs. ${validCodes[code]} ඔබේ wallet එකට add උනා!`;
    status.className = 'verify-status ok';
    renderWallet();
  } else {
    status.textContent = '❌ Invalid redeem code.';
    status.className = 'verify-status';
  }
}

/* ---------- ORDER HISTORY ---------- */
function renderOrders(){
  const list = document.getElementById('orderList');
  const orders = JSON.parse(localStorage.getItem('sakindu_orders') || '[]').reverse();
  if(orders.length === 0){
    list.innerHTML = '<div class="empty-state">තවම orders කිසිවක් නැහැ. Top-up එකක් කරලා බලන්න!</div>';
    return;
  }
  list.innerHTML = orders.map(o => `
    <div class="order-row">
      <div>
        <div><strong>${o.package}</strong> — UID: ${o.uid}${o.player ? ' (' + o.player + ')' : ''}</div>
        <div class="oid">${o.date} · ${o.payment}</div>
      </div>
      <div style="display:flex;align-items:center;gap:14px;">
        <div style="color:var(--gold);font-weight:700;">Rs. ${o.amount}</div>
        <div class="status-pill ${o.status==='Pending'?'status-pending':'status-done'}">${o.status}</div>
      </div>
    </div>
  `).join('');
}

/* ---------- AUTH (demo, client-side only) ---------- */
let authMode = 'login';
function openAuth(mode){
  authMode = mode;
  updateAuthModalUI();
  document.getElementById('authOverlay').classList.add('show');
}
function closeAuth(){ document.getElementById('authOverlay').classList.remove('show'); }
function toggleAuthMode(){
  authMode = authMode === 'login' ? 'signup' : 'login';
  updateAuthModalUI();
}
function updateAuthModalUI(){
  const isLogin = authMode === 'login';
  document.getElementById('authTitle').textContent = isLogin ? 'Login' : 'Sign Up';
  document.getElementById('authSub').textContent = isLogin ? 'ඔබේ account එකට login වෙන්න' : 'අලුත් account එකක් සාදන්න';
  document.getElementById('authName').style.display = isLogin ? 'none' : 'block';
  document.getElementById('authSwitch').innerHTML = isLogin
    ? `Account එකක් නැද්ද? <a href="#" onclick="toggleAuthMode();return false;">Sign Up</a>`
    : `Account එකක් තියෙනවද? <a href="#" onclick="toggleAuthMode();return false;">Login</a>`;
  document.getElementById('authMsg').textContent = '';
}
function submitAuth(){
  const phone = document.getElementById('authPhone').value.trim();
  const pass = document.getElementById('authPass').value.trim();
  const name = document.getElementById('authName').value.trim();
  const msg = document.getElementById('authMsg');
  if(!phone || !pass){ msg.textContent = 'කරුණාකර සියලු fields පුරවන්න.'; msg.className='verify-status'; return; }

  const users = JSON.parse(localStorage.getItem('sakindu_users') || '{}');
  if(authMode === 'signup'){
    if(users[phone]){ msg.textContent = 'මේ number එකෙන් කලින් account එකක් තියෙනවා.'; msg.className='verify-status'; return; }
    users[phone] = { name: name || 'Player', pass };
    localStorage.setItem('sakindu_users', JSON.stringify(users));
    loginSession(phone, users[phone].name);
  } else {
    if(!users[phone] || users[phone].pass !== pass){
      msg.textContent = '❌ Phone number හෝ password වැරදියි.'; msg.className='verify-status'; return;
    }
    loginSession(phone, users[phone].name);
  }
}
function loginSession(phone, name){
  localStorage.setItem('sakindu_session', JSON.stringify({phone, name}));
  closeAuth();
  refreshAuthUI();
}
function logoutUser(){
  localStorage.removeItem('sakindu_session');
  refreshAuthUI();
}
function refreshAuthUI(){
  const session = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  const navLink = document.getElementById('navAuthLink');
  const sideLink = document.getElementById('sidebarAuthLink');
  const sideLogout = document.getElementById('sidebarLogout');
  if(session){
    if(navLink){ navLink.textContent = session.name; navLink.onclick = (e)=>{e.preventDefault();}; }
    if(sideLink){ sideLink.innerHTML = `<span class="ic">👤</span> ${session.name}`; }
    if(sideLogout){ sideLogout.style.display = 'flex'; }
  } else {
    if(navLink){ navLink.textContent = 'Login'; navLink.onclick = (e)=>{e.preventDefault(); openAuth('login');}; }
    if(sideLink){ sideLink.innerHTML = '<span class="ic">👤</span> Login / Profile'; }
    if(sideLogout){ sideLogout.style.display = 'none'; }
  }
}

/* ---------- INIT ---------- */
renderCatTabs();
renderPackages();
renderWallet();
renderOrders();
refreshAuthUI();
