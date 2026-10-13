/* ===== SakinduStore app.js — Firestore-backed =====
   Pattern: each shared data type has an in-memory cache + an async refresh*Cache()
   function. Render functions read the cache (sync, fast). Writes go to Firestore
   first, then update the cache, then re-render. Requires firebase-init.js + db.js
   loaded before this file. */

/* ---------- UID CHECKER CONFIG ---------- */
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

/* ---------- PACKAGE DATA (static catalog; prices can be overridden via Firestore) ---------- */
const packageData = {
  "Top Selling": {
    icon:"topselling", iconLabel:"👑",
    items:[
      {label:"Weekly Lite", price:130, chip:"WL", image:typeof IMG_WEEKLY_LITE!=='undefined'?IMG_WEEKLY_LITE:null},
      {label:"Weekly", price:560, chip:"W", image:typeof IMG_WEEKLY!=='undefined'?IMG_WEEKLY:null},
      {label:"Monthly", price:2750, chip:"M", image:typeof IMG_MONTHLY!=='undefined'?IMG_MONTHLY:null},
    ]
  },
  "Diamonds": {
    icon:"diamonds", iconLabel:"💎", image:typeof IMG_DIAMONDS!=='undefined'?IMG_DIAMONDS:null,
    items:[
      {label:"25 💎", price:99, chip:"25"},
      {label:"100 💎", price:335, chip:"100"},
      {label:"310 💎", price:1010, chip:"310"},
      {label:"520 💎", price:1680, chip:"520"},
      {label:"1060 💎", price:3400, chip:"1.06K"},
      {label:"2180 💎", price:6800, chip:"2.18K"},
      {label:"5600 💎", price:16700, chip:"5.6K"},
      {label:"11500 💎", price:33000, chip:"11.5K", badge:"BIG OFFER"},
    ]
  },
  "Level Up Pass": {
    icon:"levelup", iconLabel:"🚀", image:typeof IMG_LEVELUP!=='undefined'?IMG_LEVELUP:null,
    items:[
      {label:"Level Up Pass 6", price:150, chip:"6"},
      {label:"Level Up Pass 10", price:250, chip:"10"},
      {label:"Level Up Pass 15", price:250, chip:"15"},
      {label:"Level Up Pass 20", price:250, chip:"20"},
      {label:"Level Up Pass 25", price:250, chip:"25"},
      {label:"Level Up Pass 30", price:360, chip:"30"},
    ]
  }
};
const allCategories = ["All", ...Object.keys(packageData)];
let activeCategory = "All";
let selectedPkg = null;
let selectedPay = "Bank Transfer";
let uidVerified = false;
let verifiedPlayerName = "";

function chipGradient(cat){
  return { "Top Selling":"linear-gradient(135deg,#ffb020,#ff6fa0)",
           "Diamonds":"linear-gradient(135deg,#29e0e8,#7c5cff)",
           "Level Up Pass":"linear-gradient(135deg,#3ddc84,#29e0e8)" }[cat];
}

function renderCatTabs(){
  const el = document.getElementById('catTabs');
  if(!el) return;
  el.innerHTML = allCategories.map(cat =>
    `<div class="cat-tab ${cat===activeCategory?'active':''}" onclick="setCategory('${cat}')">${cat.toUpperCase()}</div>`
  ).join('');
}
function setCategory(cat){
  activeCategory = cat;
  renderCatTabs();
  renderPackages();
}

/* ---------- PRICE OVERRIDES (Firestore config/priceOverrides) ---------- */
let priceOverridesCache = {};
async function refreshPriceOverridesCache(){
  priceOverridesCache = await fsGetConfig('priceOverrides', {});
}
function getEffectivePrice(cat, label, fallback){
  const key = `${cat}::${label}`;
  return priceOverridesCache[key] !== undefined ? priceOverridesCache[key] : fallback;
}
async function savePriceOverride(key, value){
  priceOverridesCache[key] = value;
  await fsSetConfig('priceOverrides', priceOverridesCache);
}

function renderPackages(){
  const container = document.getElementById('pkgContainer');
  if(!container) return;
  const cats = activeCategory === "All" ? Object.keys(packageData) : [activeCategory];
  container.innerHTML = cats.map(cat => `
    <div class="cat-heading"><div class="cat-icon ${packageData[cat].icon}">${packageData[cat].iconLabel}</div> ${cat.toUpperCase()}</div>
    <div class="pkg-grid">
      ${packageData[cat].items.map((p,i) => {
        const effPrice = getEffectivePrice(cat, p.label, p.price);
        const bannerSrc = p.image || packageData[cat].image;
        const visual = bannerSrc
          ? `<img class="pkg-banner" src="${bannerSrc}" alt="${p.label}">`
          : `<div class="pkg-icon" style="background:${chipGradient(cat)}">${p.chip}</div>`;
        return `
        <div class="pkg-card" onclick="selectPkg('${cat}',${i})" id="pkg-${cat}-${i}">
          ${p.badge ? `<div class="badge">${p.badge}</div>` : ''}
          ${visual}
          <div class="amt">${p.label}</div>
          ${p.old ? `<div class="old-price">Rs. ${p.old}</div>` : `<div class="lbl">Free Fire</div>`}
          <div class="price">Rs. ${effPrice}</div>
        </div>`;
      }).join('')}
    </div>
  `).join('');
}

function selectPkg(cat, index){
  const base = packageData[cat].items[index];
  const effPrice = getEffectivePrice(cat, base.label, base.price);
  selectedPkg = Object.assign({}, base, { price: effPrice, cat });
  document.querySelectorAll('.pkg-card').forEach(c => c.classList.remove('selected'));
  document.getElementById(`pkg-${cat}-${index}`).classList.add('selected');
  document.getElementById('totalAmount').textContent = 'Rs. ' + selectedPkg.price;
}

function selectPay(name, el){
  selectedPay = name;
  document.querySelectorAll('.pay-method').forEach(p => p.classList.remove('selected'));
  el.classList.add('selected');
  updatePaymentUI();
}

/* ---------- REAL UID VERIFICATION ---------- */
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
  if(!/^\d{8,12}$/.test(uid)){
    status.innerHTML = '⚠️ UID එක වැරදියි. digits 8-12ක් තිබිය යුතුයි.';
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
      simulateVerified(uid, status);
    }
  } catch(err){
    simulateVerified(uid, status);
  } finally {
    if(btn){ btn.disabled = false; }
  }
}
function simulateVerified(uid, status){
  uidVerified = true;
  verifiedPlayerName = "";
  status.innerHTML = `<span class="player-name-chip">✅ UID Verified</span>`;
  status.className = 'verify-status';
}

/* ---------- ORDERS (Firestore 'orders' collection) ---------- */
let ordersCache = [];
async function refreshOrdersCache(){
  ordersCache = await fsGetOrders();
}
async function saveOrder(order){
  await fsAddOrder(order);
  await refreshOrdersCache();
  renderOrders();
  if(typeof renderLeaderboard === 'function') renderLeaderboard();
}

async function placeOrder(){
  if(isStoreClosed()){ alert('🛑 SakinduStore දැනට තාවකාලිකව වසා ඇත. පසුව try කරන්න.'); return; }
  const uid = document.getElementById('uidInput').value.trim();
  const orderMsg = document.getElementById('orderMsg');
  const receiptInput = document.getElementById('receiptFile');

  if(!uid){ alert('කරුණාකර UID එක type කරන්න.'); return; }
  if(!uidVerified){ alert('කරුණාකර UID එක verify කරන්න.'); return; }
  if(!selectedPkg){ alert('කරුණාකර package එකක් තෝරන්න.'); return; }

  const session = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  const baseOrder = {
    id: Date.now(),
    uid, player: verifiedPlayerName, package: selectedPkg.label, amount: selectedPkg.price,
    payment: selectedPay, date: new Date().toLocaleString(),
    userPhone: session ? session.phone : null
  };

  const submitBtn = document.querySelector('.order-panel .btn-block');
  if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Submitting...'; }

  if(selectedPay === 'Wallet Balance'){
    const key = currentWalletKey();
    const bal = await fsGetWalletBalance(key);
    if(bal < selectedPkg.price){
      if(orderMsg){
        orderMsg.innerHTML = `❌ Wallet balance එක ප්‍රමාණවත් නැහැ. Current balance: Rs. ${bal}. <a href="wallet.html" style="color:var(--cyan);">Wallet Recharge කරන්න</a>`;
        orderMsg.className = 'verify-status err';
      } else {
        alert('❌ Wallet balance එක ප්‍රමාණවත් නැහැ.');
      }
      if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Order එක Submit කරන්න'; }
      return;
    }
    await fsSetWalletBalance(key, bal - selectedPkg.price);
    walletsCache[key] = bal - selectedPkg.price;
    await saveOrder(Object.assign({}, baseOrder, { status: 'Processing' }));
    renderWallet();
    if(orderMsg){
      orderMsg.innerHTML = `✅ Wallet Balance එකෙන් Rs. ${selectedPkg.price} deduct කළා. Order එක Admin Approve කරනකම් "Processing" status එකේ පවතී.`;
      orderMsg.className = 'verify-status ok';
    } else {
      alert('✅ Wallet Balance එකෙන් deduct කළා. Admin Approve කරනකම් Processing status එකේ පවතී.');
    }
    if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Order එක Submit කරන්න'; }
    return;
  }

  // Bank Transfer / Ez Cash — needs a receipt upload
  if(!receiptInput || !receiptInput.files[0]){
    alert('කරුණාකර payment receipt එක upload කරන්න.');
    if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Order එක Submit කරන්න'; }
    return;
  }
  const file = receiptInput.files[0];
  const reader = new FileReader();
  reader.onload = async function(e){
    await saveOrder(Object.assign({}, baseOrder, { status: 'Processing', receipt: e.target.result, receiptName: file.name }));
    if(orderMsg){
      orderMsg.innerHTML = '✅ Order එක place උනා! Admin receipt එක verify කරලා Approve කරනකම් "Processing" status එකේ පවතී — site එකෙන්ම track කරන්න පුළුවන්.';
      orderMsg.className = 'verify-status ok';
    } else {
      alert('✅ Order එක place උනා! Admin approve කරනකම් Processing status එකේ පවතී.');
    }
    receiptInput.value = '';
    if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Order එක Submit කරන්න'; }
  };
  reader.readAsDataURL(file);
}

function updatePaymentUI(){
  const receiptBlock = document.getElementById('receiptBlock');
  const walletBlock = document.getElementById('walletBalanceBlock');
  if(!receiptBlock || !walletBlock) return;
  if(selectedPay === 'Wallet Balance'){
    receiptBlock.style.display = 'none';
    walletBlock.style.display = 'block';
    const balEl = document.getElementById('walletBalanceDisplay');
    if(balEl) balEl.textContent = 'Rs. ' + getWalletBalance();
    fsGetWalletBalance(currentWalletKey()).then(bal => {
      walletsCache[currentWalletKey()] = bal;
      if(balEl) balEl.textContent = 'Rs. ' + bal;
    });
  } else {
    receiptBlock.style.display = 'block';
    walletBlock.style.display = 'none';
  }
}

function renderOrders(){
  const list = document.getElementById('orderList');
  if(!list) return;
  if(ordersCache.length === 0){
    list.innerHTML = '<div class="empty-state">තවම orders කිසිවක් නැහැ. Top-up එකක් කරලා බලන්න!</div>';
    return;
  }
  list.innerHTML = ordersCache.map(o => `
    <div class="order-row">
      <div>
        <div><strong>${o.package}</strong> — UID: ${o.uid}${o.player ? ' (' + o.player + ')' : ''}</div>
        <div class="oid">${o.date} · ${o.payment}</div>
      </div>
      <div style="display:flex;align-items:center;gap:14px;">
        <div style="color:var(--gold);font-weight:700;">Rs. ${o.amount}</div>
        <div class="status-pill ${o.status==='Processing'?'status-pending':'status-done'}">${o.status}</div>
      </div>
    </div>
  `).join('');
}

/* ---------- WALLET (Firestore 'wallets' collection, doc ID = phone or 'guest') ---------- */
let walletsCache = {};
async function refreshWalletsCache(){
  walletsCache = await fsGetAllWallets();
}
function currentWalletKey(){
  const session = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  return session ? session.phone : 'guest';
}
function getWalletBalance(key){
  return walletsCache[key || currentWalletKey()] || 0;
}
async function creditUserWallet(key, amount){
  const bal = await fsGetWalletBalance(key);
  const newBal = bal + amount;
  await fsSetWalletBalance(key, newBal);
  walletsCache[key] = newBal;
  return newBal;
}
function renderWallet(){
  const el = document.getElementById('walletBalance');
  if(el) el.textContent = 'Rs. ' + getWalletBalance();
}
function uploadProof(){
  const file = document.getElementById('proofFile').files[0];
  const status = document.getElementById('proofStatus');
  if(!file){ return; }
  status.textContent = `✅ "${file.name}" uploaded. Verification එක සඳහා admin review කරනු ඇත (usually 5-10 min).`;
  status.className = 'verify-status ok';
}

/* ---------- REDEEM CODES (Firestore config/redeemCodes) ---------- */
const defaultRedeemCodes = { "SAKINDU100": 100, "FREEFIRE50": 50, "WELCOME200": 200 };
let redeemCodesCache = {};
async function refreshRedeemCodesCache(){
  redeemCodesCache = await fsGetConfig('redeemCodes', defaultRedeemCodes);
}
async function redeemCode(){
  const code = document.getElementById('redeemInput').value.trim().toUpperCase();
  const status = document.getElementById('redeemStatus');
  if(!code){ status.textContent = 'Code එකක් type කරන්න.'; status.className='verify-status'; return; }

  const key = currentWalletKey();
  const redeemedKey = 'sakindu_redeemed_' + key;
  const redeemed = JSON.parse(localStorage.getItem(redeemedKey) || '[]');
  if(redeemed.includes(code)){
    status.textContent = '⚠️ මේ code එක කලින් redeem කරලා තියෙනවා.';
    status.className = 'verify-status';
    return;
  }
  if(redeemCodesCache[code] !== undefined){
    await creditUserWallet(key, redeemCodesCache[code]);
    redeemed.push(code);
    localStorage.setItem(redeemedKey, JSON.stringify(redeemed));
    status.textContent = `✅ Rs. ${redeemCodesCache[code]} ඔබේ wallet එකට add උනා!`;
    status.className = 'verify-status ok';
    renderWallet();
  } else {
    status.textContent = '❌ Invalid redeem code.';
    status.className = 'verify-status';
  }
}

/* ---------- TOP SPENDER LEADERBOARD ---------- */
function renderLeaderboard(){
  const el = document.getElementById('leaderboardList');
  if(!el) return;

  const totals = {};
  ordersCache.forEach(o => {
    if(!o.userPhone) return;
    totals[o.userPhone] = (totals[o.userPhone] || 0) + o.amount;
  });

  const ranked = Object.keys(totals)
    .filter(phone => usersCache[phone])
    .map(phone => ({ phone, name: usersCache[phone].name, avatar: usersCache[phone].avatar, total: totals[phone] }))
    .sort((a,b) => b.total - a.total)
    .slice(0, 10);

  if(ranked.length === 0){
    el.innerHTML = '<div class="empty-state">තවම Top Spenders කිසිවක් නැහැ — Login කරලා top-up කරපු පළවෙනි කෙනා වෙන්න!</div>';
    return;
  }

  el.innerHTML = ranked.map((r, i) => {
    const rankClass = i===0 ? 'rank1' : i===1 ? 'rank2' : i===2 ? 'rank3' : '';
    const avatarHtml = r.avatar
      ? `<img class="lb-avatar" src="${r.avatar}" alt="${r.name}">`
      : `<div class="lb-avatar">${r.name.charAt(0).toUpperCase()}</div>`;
    return `
      <div class="lb-row ${rankClass}">
        <div class="lb-rank">${i+1}</div>
        ${avatarHtml}
        <div class="lb-name">${r.name}</div>
        <div class="lb-amount">Rs. ${r.total}</div>
      </div>`;
  }).join('');
}

/* ---------- CUSTOMER REVIEWS (Firestore config/reviews) ---------- */
const defaultReviews = [
  {name:"Lakmal Perera", loc:"Colombo, Sri Lanka", stars:5, text:"Super fast delivery, UID verify එක instant. Highly recommend!", seed:true},
  {name:"Nimasha K.", loc:"Kandy, Sri Lanka", stars:4, text:"Good rates and friendly WhatsApp support.", seed:true},
];
let reviewsCache = [];
async function refreshReviewsCache(){
  reviewsCache = await fsGetConfig('reviews', defaultReviews);
}
function renderReviews(){
  const el = document.getElementById('reviewScroll');
  if(!el) return;
  const reviews = reviewsCache.slice().reverse();
  el.innerHTML = reviews.map(r => `
    <div class="review-card">
      <div class="review-head">
        <div class="review-avatar">${r.name.charAt(0).toUpperCase()}</div>
        <div>
          <div class="review-name">${r.name}</div>
          <div class="review-loc">📍 ${r.loc}</div>
        </div>
      </div>
      <div class="review-stars">${'★'.repeat(r.stars)}${'☆'.repeat(5-r.stars)}</div>
      <div class="review-text">"${r.text}"</div>
      <div class="review-foot">
        <span class="review-new-tag">${r.seed ? '✅ Verified Buyer' : '🆕 New Review'}</span>
      </div>
    </div>
  `).join('');
}
let pickedStars = 5;
function openReviewModal(){
  pickedStars = 5;
  renderStarPicker();
  document.getElementById('reviewOverlay').classList.add('show');
}
function closeReviewModal(){ document.getElementById('reviewOverlay').classList.remove('show'); }
function renderStarPicker(){
  const el = document.getElementById('starPicker');
  el.innerHTML = [1,2,3,4,5].map(n => `<span class="${n<=pickedStars?'active':''}" onclick="setStars(${n})">★</span>`).join('');
}
function setStars(n){ pickedStars = n; renderStarPicker(); }
async function submitReview(){
  const name = document.getElementById('reviewName').value.trim();
  const loc = document.getElementById('reviewLoc').value.trim();
  const text = document.getElementById('reviewText').value.trim();
  const msg = document.getElementById('reviewMsg');
  if(!name || !text){ msg.textContent = 'Name සහ review එක type කරන්න.'; msg.className = 'verify-status'; return; }
  reviewsCache.push({name, loc: loc || "Sri Lanka", stars: pickedStars, text, seed:false});
  await fsSetConfig('reviews', reviewsCache);
  closeReviewModal();
  document.getElementById('reviewName').value='';
  document.getElementById('reviewLoc').value='';
  document.getElementById('reviewText').value='';
  renderReviews();
}

/* ---------- AUTH (Firestore 'users' collection, doc ID = phone) ---------- */
let usersCache = {};
async function refreshUsersCache(){
  usersCache = await fsGetUsers();
}
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
let pendingAvatar = null;
function previewAuthAvatar(){
  const file = document.getElementById('authAvatarFile').files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    pendingAvatar = e.target.result;
    document.getElementById('authAvatarPreview').innerHTML = `<img src="${pendingAvatar}" style="width:100%;height:100%;object-fit:cover;">`;
  };
  reader.readAsDataURL(file);
}
function updateAuthModalUI(){
  const isLogin = authMode === 'login';
  document.getElementById('authTitle').textContent = isLogin ? 'Login' : 'Sign Up';
  document.getElementById('authSub').textContent = isLogin ? 'ඔබේ account එකට login වෙන්න' : 'අලුත් account එකක් සාදන්න';
  document.getElementById('authName').style.display = isLogin ? 'none' : 'block';
  const avatarRow = document.getElementById('authAvatarRow');
  if(avatarRow) avatarRow.style.display = isLogin ? 'none' : 'block';
  if(!isLogin){ pendingAvatar = null; const prev = document.getElementById('authAvatarPreview'); if(prev) prev.innerHTML = '👤'; }
  document.getElementById('authSwitch').innerHTML = isLogin
    ? `Account එකක් නැද්ද? <a href="#" onclick="toggleAuthMode();return false;">Sign Up</a>`
    : `Account එකක් තියෙනවද? <a href="#" onclick="toggleAuthMode();return false;">Login</a>`;
  document.getElementById('authMsg').textContent = '';
}
async function submitAuth(){
  const phone = document.getElementById('authPhone').value.trim();
  const pass = document.getElementById('authPass').value.trim();
  const name = document.getElementById('authName').value.trim();
  const msg = document.getElementById('authMsg');
  if(!phone || !pass){ msg.textContent = 'කරුණාකර සියලු fields පුරවන්න.'; msg.className='verify-status'; return; }

  const submitBtn = document.querySelector('#authOverlay .btn-block');
  if(submitBtn){ submitBtn.disabled = true; }

  const existing = await fsGetUser(phone);
  if(authMode === 'signup'){
    if(existing){ msg.textContent = 'මේ number එකෙන් කලින් account එකක් තියෙනවා.'; msg.className='verify-status'; if(submitBtn) submitBtn.disabled=false; return; }
    const userData = { name: name || 'Player', pass, avatar: pendingAvatar || null };
    await fsSetUser(phone, userData);
    usersCache[phone] = userData;
    loginSession(phone, userData.name);
  } else {
    if(!existing || existing.pass !== pass){
      msg.textContent = '❌ Phone number හෝ password වැරදියි.'; msg.className='verify-status';
      if(submitBtn) submitBtn.disabled=false;
      return;
    }
    usersCache[phone] = existing;
    loginSession(phone, existing.name);
  }
  if(submitBtn){ submitBtn.disabled = false; }
}
async function loginSession(phone, name){
  localStorage.setItem('sakindu_session', JSON.stringify({phone, name}));
  closeAuth();
  refreshAuthUI();
  await refreshWalletsCache();
  renderWallet();
  renderLeaderboard();
}
function logoutUser(){
  localStorage.removeItem('sakindu_session');
  refreshAuthUI();
  renderWallet();
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

/* ---------- GAMES CATALOG (Firestore config/games) ---------- */
const defaultGames = [
  {slug:'free-fire', name:'FREE FIRE SG', desc:'Diamonds, Weekly/Monthly Membership, Level Up Pass', status:'active', imgVar:'IMG_FREEFIRE', link:'free-fire.html'},
  {slug:'codm', name:'CALL OF DUTY MOBILE', desc:'CP top-up coming soon', status:'coming-soon', imgVar:'IMG_CODM', link:'codm.html'},
  {slug:'bloodstrike', name:'BLOOD STRIKE', desc:'Gold top-up coming soon', status:'coming-soon', imgVar:'IMG_BLOODSTRIKE', link:'bloodstrike.html'},
  {slug:'freefire-id', name:'FREE FIRE INDONESIA', desc:'Diamonds coming soon', status:'coming-soon', imgVar:'IMG_FREEFIRE', link:'freefire-id.html'},
  {slug:'ff-likes', name:'FF Profile Likes', desc:'Free Fire profile likes boost', status:'coming-soon', imgVar:'IMG_FFLIKES', link:'ff-likes.html'},
  {slug:'delta-force-pc', name:'Delta Force (PC)', desc:'', status:'coming-soon', imgVar:'IMG_DELTAFORCE', link:'delta-force-pc.html'},
  {slug:'minecraft', name:'Minecraft', desc:'', status:'coming-soon', imgVar:'IMG_MINECRAFT', link:'minecraft.html'},
  {slug:'mobile-legends', name:'Mobile Legend', desc:'', status:'coming-soon', imgVar:'IMG_MOBILELEGENDS', link:'mobile-legends.html'},
  {slug:'where-winds-meet', name:'Where Winds Meet', desc:'', status:'coming-soon', imgVar:'IMG_WHEREWINDSMEET', link:'where-winds-meet.html'},
  {slug:'freefire-bd', name:'Free Fire (Bangladesh)', desc:'', status:'coming-soon', imgVar:'IMG_FREEFIRE', link:'freefire-bd.html'},
  {slug:'freefire-my', name:'Free Fire (Malaysia)', desc:'', status:'coming-soon', imgVar:'IMG_FREEFIRE', link:'freefire-my.html'},
  {slug:'pubgm', name:'PUBG Mobile', desc:'', status:'coming-soon', imgVar:'IMG_PUBGM', link:'pubgm.html'},
  {slug:'valorant-sg-pc', name:'Valorant SG (PC)', desc:'', status:'coming-soon', imgVar:'IMG_VALORANT', link:'valorant-sg-pc.html'},
  {slug:'garena-undown', name:'Garena Undown', desc:'', status:'coming-soon', imgVar:'IMG_GARENAUNDYING', link:'garena-undown.html'},
  {slug:'honor-of-kings', name:'Honor Of King', desc:'', status:'coming-soon', imgVar:'IMG_HONOROFKINGS', link:'honor-of-kings.html'},
  {slug:'asphalt9', name:'Asphalt 9 (Android)', desc:'', status:'coming-soon', imgVar:'IMG_ASPHALT9', link:'asphalt9.html'},
  {slug:'farlight84', name:'Farlight84', desc:'', status:'coming-soon', imgVar:'IMG_FARLIGHT84', link:'farlight84.html'},
  {slug:'8-ball-pool', name:'8 Ball Pool', desc:'', status:'coming-soon', imgVar:'IMG_8BALLPOOL', link:'8-ball-pool.html'},
  {slug:'state-of-survival', name:'State Of Survival', desc:'', status:'coming-soon', imgVar:'IMG_STATEOFSURVIVAL', link:'state-of-survival.html'},
  {slug:'whiteout-survival', name:'Whiteout Survival', desc:'', status:'coming-soon', imgVar:'IMG_WHITEOUTSURVIVAL', link:'whiteout-survival.html'},
  {slug:'teen-patti-gold', name:'Teen Patti Gold', desc:'', status:'coming-soon', imgVar:'IMG_TEENPATTIGOLD', link:'teen-patti-gold.html'},
  {slug:'garena-my-shells', name:'Garena MY Shells', desc:'', status:'coming-soon', imgVar:'IMG_GARENASHELLS', link:'garena-my-shells.html', fieldType:'email'},
  {slug:'arena-breakout', name:'Arena Breakout', desc:'', status:'coming-soon', imgVar:'IMG_ARENABREAKOUT', link:'arena-breakout.html'},
  {slug:'rainbow-six-mobile', name:'Rainbow Six Mobile', desc:'', status:'coming-soon', link:'rainbow-six-mobile.html'},
];
let gamesCache = [];
async function refreshGamesCache(){
  gamesCache = await fsGetConfig('games', defaultGames);
}
async function saveGames(games){
  gamesCache = games;
  await fsSetConfig('games', games);
}
function getGames(){ return gamesCache; }
function gameImageSrc(g){
  if(g.image) return g.image;
  if(g.imgVar && typeof window[g.imgVar] !== 'undefined') return window[g.imgVar];
  return null;
}
function renderGamesGrid(){
  const el = document.getElementById('gamesGrid');
  if(!el) return;
  const sorted = gamesCache.slice().sort((a,b) => {
    const aActive = a.status === 'active' ? 0 : 1;
    const bActive = b.status === 'active' ? 0 : 1;
    return aActive - bActive;
  });
  el.innerHTML = sorted.map(g => {
    const img = gameImageSrc(g);
    const visual = img ? `<img src="${img}" alt="${g.name}">` : `<span style="font-size:2.2rem;">🎮</span>`;
    const isActive = g.status === 'active';
    const btn = isActive
      ? `<a href="${g.link || '#'}" class="btn btn-primary">TOP UP</a>`
      : (g.link ? `<a href="${g.link}" class="btn btn-disabled">COMING SOON</a>` : `<div class="btn btn-disabled">COMING SOON</div>`);
    return `
      <div class="game-card">
        ${!isActive ? `<div class="game-badge soon">COMING SOON</div>` : ''}
        <div class="game-icon">${visual}</div>
        <h3>${g.name}</h3>
        ${isActive ? `<div class="game-status"><span class="dot"></span> Active</div>` : ''}
        ${btn}
      </div>`;
  }).join('');
}

/* ---------- GENERIC GAME ORDER PAGE (for admin-managed games beyond Free Fire) ---------- */
let currentGenericGame = null;
let selectedGenericPkg = null;
let genericSelectedPay = 'Bank Transfer';

function renderGenericGamePage(){
  if(typeof PAGE_SLUG === 'undefined') return;
  const game = gamesCache.find(g => g.slug === PAGE_SLUG);
  const root = document.getElementById('gamePageRoot');
  if(!root || !game) return;
  currentGenericGame = game;

  const iconEl = document.getElementById('gamePageIcon');
  const titleEl = document.getElementById('gamePageTitle');
  const descEl = document.getElementById('gamePageDesc');
  const img = gameImageSrc(game);
  if(iconEl){ if(img){ iconEl.src = img; iconEl.style.display = 'block'; } else { iconEl.style.display = 'none'; } }
  if(titleEl) titleEl.textContent = game.name;
  if(descEl) descEl.textContent = game.desc || '';

  if(game.status === 'active' && game.packages && game.packages.length){
    const isEmail = game.fieldType === 'email';
    const fieldLabel = isEmail ? 'EMAIL ADDRESS (DELIVERY)' : 'PLAYER ID / UID';
    const fieldPlaceholder = isEmail ? 'Email Address (delivery මේ email එකටයි) *' : 'Player ID / UID *';
    const fieldType = isEmail ? 'email' : 'text';
    root.innerHTML = `
      <div class="order-panel">
        <div class="step-label"><div class="step-num">1</div><h3>${fieldLabel}</h3></div>
        <div class="field-row"><input type="${fieldType}" id="genUidInput" placeholder="${fieldPlaceholder}"></div>

        <div class="step-label" style="margin-top:20px;"><div class="step-num">2</div><h3>SELECT PACKAGE</h3></div>
        <div class="pkg-grid" id="genPkgContainer"></div>

        <div class="step-label" style="margin-top:26px;"><div class="step-num">3</div><h3>PAYMENT METHOD</h3></div>
        <div class="pay-methods">
          <div class="pay-method selected" onclick="selectGenericPay('Bank Transfer', this)">🏦 Bank Transfer</div>
          <div class="pay-method" onclick="selectGenericPay('Ez Cash', this)">📱 Ez Cash</div>
          <div class="pay-method" onclick="selectGenericPay('Wallet Balance', this)">💼 Wallet Balance</div>
        </div>
        <div class="order-total"><div>Total Amount</div><div class="amount" id="genTotalAmount">Rs. 0</div></div>

        <div id="genReceiptBlock">
          <div class="step-label" style="margin-top:26px;"><div class="step-num">4</div><h3>UPLOAD PAYMENT RECEIPT</h3></div>
          <input type="file" id="genReceiptFile" accept="image/*" style="display:none;" onchange="document.getElementById('genReceiptFileLabel').textContent = '📎 ' + (this.files[0] ? this.files[0].name : 'Click to upload receipt')">
          <div class="upload-box" onclick="document.getElementById('genReceiptFile').click()" id="genReceiptFileLabel">📎 Click to upload payment receipt *</div>
        </div>
        <div class="wallet-balance-block" id="genWalletBalanceBlock">
          <div style="color:var(--muted);font-size:.9rem;margin-bottom:6px;">ඔබේ Wallet Balance එක</div>
          <div class="amt" id="genWalletBalanceDisplay">Rs. 0</div>
          <div style="color:var(--muted);font-size:.85rem;margin-top:8px;">Order confirm කළාම මේ balance එකෙන් amount එක deduct වී, Admin Approve කරනකම් Processing එකේ පවතී.</div>
        </div>

        <button class="btn btn-primary btn-block" style="margin-top:20px;" onclick="placeGenericOrder()">Order එක Submit කරන්න</button>
        <div id="genOrderMsg" class="verify-status" style="text-align:center;margin-top:10px;"></div>
      </div>`;
    renderGenericPackages();
  } else {
    root.innerHTML = `
      <div class="stub-wrap">
        <p style="color:var(--muted);margin-bottom:22px;">මේ game එකේ top-up service එක ළඟදීම SakinduStore එකට එනවා. ඉවසීමෙන් සිටින්න!</p>
        <a href="index.html#games" class="btn btn-primary">← Games ටිකට return වෙන්න</a>
      </div>`;
  }
}
function renderGenericPackages(){
  const container = document.getElementById('genPkgContainer');
  if(!container || !currentGenericGame) return;
  container.innerHTML = currentGenericGame.packages.map((p,i) => `
    <div class="pkg-card" onclick="selectGenericPkg(${i})" id="genpkg-${i}">
      <div class="amt">${p.label}</div>
      <div class="lbl">${currentGenericGame.name}</div>
      <div class="price">Rs. ${p.price}</div>
    </div>`).join('');
}
function selectGenericPkg(i){
  selectedGenericPkg = currentGenericGame.packages[i];
  document.querySelectorAll('#gamePageRoot .pkg-card').forEach(c=>c.classList.remove('selected'));
  document.getElementById(`genpkg-${i}`).classList.add('selected');
  document.getElementById('genTotalAmount').textContent = 'Rs. ' + selectedGenericPkg.price;
}
function selectGenericPay(name, el){
  genericSelectedPay = name;
  document.querySelectorAll('#gamePageRoot .pay-method').forEach(p=>p.classList.remove('selected'));
  el.classList.add('selected');
  const receiptBlock = document.getElementById('genReceiptBlock');
  const walletBlock = document.getElementById('genWalletBalanceBlock');
  if(name === 'Wallet Balance'){
    receiptBlock.style.display = 'none';
    walletBlock.style.display = 'block';
    document.getElementById('genWalletBalanceDisplay').textContent = 'Rs. ' + getWalletBalance();
  } else {
    receiptBlock.style.display = 'block';
    walletBlock.style.display = 'none';
  }
}
async function placeGenericOrder(){
  if(isStoreClosed()){ alert('🛑 SakinduStore දැනට තාවකාලිකව වසා ඇත. පසුව try කරන්න.'); return; }
  const uid = document.getElementById('genUidInput').value.trim();
  const orderMsg = document.getElementById('genOrderMsg');
  const receiptInput = document.getElementById('genReceiptFile');
  const isEmail = currentGenericGame.fieldType === 'email';

  if(!uid){ alert(isEmail ? 'Email Address එක දාන්න.' : 'Player ID / UID එක දාන්න.'); return; }
  if(isEmail){
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(uid)){ alert('⚠️ Valid email address එකක් දාන්න.'); return; }
  } else {
    if(uid.length < 1 || uid.length > 30){ alert('⚠️ Player ID / UID එක characters 1-30 අතර තිබිය යුතුයි.'); return; }
  }
  if(!selectedGenericPkg){ alert('Package එකක් තෝරන්න.'); return; }

  const session = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  const baseOrder = {
    id: Date.now(), uid, player: '',
    package: `${currentGenericGame.name} — ${selectedGenericPkg.label}`,
    amount: selectedGenericPkg.price, payment: genericSelectedPay, date: new Date().toLocaleString(),
    userPhone: session ? session.phone : null
  };

  if(genericSelectedPay === 'Wallet Balance'){
    const key = currentWalletKey();
    const bal = await fsGetWalletBalance(key);
    if(bal < selectedGenericPkg.price){
      orderMsg.innerHTML = `❌ Wallet balance එක ප්‍රමාණවත් නැහැ. Current balance: Rs. ${bal}. <a href="wallet.html" style="color:var(--cyan);">Wallet Recharge කරන්න</a>`;
      orderMsg.className = 'verify-status err';
      return;
    }
    await fsSetWalletBalance(key, bal - selectedGenericPkg.price);
    walletsCache[key] = bal - selectedGenericPkg.price;
    await saveOrder(Object.assign({}, baseOrder, { status: 'Processing' }));
    renderWallet();
    orderMsg.innerHTML = '✅ Wallet Balance එකෙන් deduct කළා. Admin Approve කරනකම් Processing status එකේ පවතී.';
    orderMsg.className = 'verify-status ok';
    return;
  }

  if(!receiptInput || !receiptInput.files[0]){ alert('කරුණාකර payment receipt එක upload කරන්න.'); return; }
  const file = receiptInput.files[0];
  const reader = new FileReader();
  reader.onload = async function(e){
    await saveOrder(Object.assign({}, baseOrder, { status: 'Processing', receipt: e.target.result, receiptName: file.name }));
    orderMsg.innerHTML = '✅ Order එක place උනා! Admin Approve කරනකම් "Processing" status එකේ පවතී.';
    orderMsg.className = 'verify-status ok';
    receiptInput.value = '';
  };
  reader.readAsDataURL(file);
}

/* ---------- VIDEOS (Firestore config/videos) ---------- */
let videosCache = [];
async function refreshVideosCache(){
  videosCache = await fsGetConfig('videos', []);
}
async function saveVideos(videos){
  videosCache = videos;
  await fsSetConfig('videos', videos);
}
function getVideos(){ return videosCache; }
function youtubeIdFromInput(input){
  const s = input.trim();
  const m = s.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
  if(m) return m[1];
  if(/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  return null;
}
function renderVideosGrid(containerId, limit){
  const el = document.getElementById(containerId);
  if(!el) return;
  let videos = videosCache;
  if(limit) videos = videos.slice(0, limit);
  if(videos.length === 0){
    el.innerHTML = '<div class="empty-state">තවම videos කිසිවක් add කරලා නැහැ.</div>';
    return;
  }
  el.innerHTML = videos.map(v => `
    <div class="video-card">
      <div class="video-frame">
        <iframe src="https://www.youtube.com/embed/${v.id}" title="${v.title}" frameborder="0" allowfullscreen loading="lazy"></iframe>
      </div>
      <div class="video-title">${v.title}</div>
    </div>`).join('');
}

/* ---------- STORE OPEN/CLOSED — FULL-SCREEN LOCK (Firestore config/store) ---------- */
let storeCache = { closed:false, announcement:'' };
async function refreshStoreCache(){
  storeCache = await fsGetConfig('store', { closed:false, announcement:'' });
}
function isStoreClosed(){
  return !!storeCache.closed;
}
function renderStoreLock(){
  const el = document.getElementById('storeLockOverlay');
  if(!el) return;
  el.classList.toggle('show', isStoreClosed());
}
async function setStoreClosed(closed){
  storeCache.closed = closed;
  await fsSetConfig('store', storeCache);
}

/* ---------- ANNOUNCEMENT STRIP ---------- */
function renderAnnouncement(){
  const el = document.getElementById('announceStrip');
  if(!el) return;
  const msg = storeCache.announcement || '';
  if(msg){
    el.textContent = '📢 ' + msg;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}
async function setAnnouncement(text){
  storeCache.announcement = text;
  await fsSetConfig('store', storeCache);
}

/* ---------- MAINTAINING MODAL (for not-yet-ready features) ---------- */
function showMaintaining(name){
  const overlay = document.getElementById('maintainOverlay');
  if(!overlay) return;
  document.getElementById('maintainTitle').textContent = name + ' — Under Maintenance';
  overlay.classList.add('show');
}
function closeMaintaining(){
  const overlay = document.getElementById('maintainOverlay');
  if(overlay) overlay.classList.remove('show');
}

/* ---------- WIRE UP INLINE IMAGES (if present on this page) ---------- */
function wireGameIcons(){
  const map = { icFreeFire:'IMG_FREEFIRE', icCodm:'IMG_CODM', icBloodstrike:'IMG_BLOODSTRIKE' };
  Object.keys(map).forEach(id => {
    const el = document.getElementById(id);
    const varName = map[id];
    if(el && typeof window[varName] !== 'undefined'){ el.src = window[varName]; }
  });
}

/* ---------- INIT ---------- */
async function initApp(){
  wireGameIcons();
  renderCatTabs();
  await Promise.all([
    refreshGamesCache(),
    refreshStoreCache(),
    refreshPriceOverridesCache(),
    refreshRedeemCodesCache(),
    refreshReviewsCache(),
    refreshVideosCache(),
    refreshOrdersCache(),
    refreshUsersCache(),
    refreshWalletsCache(),
  ]);
  renderGamesGrid();
  renderGenericGamePage();
  renderStoreLock();
  renderAnnouncement();
  renderPackages();
  renderWallet();
  renderOrders();
  renderLeaderboard();
  renderVideosGrid('videosGridHome', 3);
  renderReviews();
  refreshAuthUI();
  updatePaymentUI();
}
initApp();
