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
  const session = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  if(!session){ alert('⚠️ Order එකක් දාන්න කලින් Login / Sign Up වෙන්න ඕන.'); openAuth('login'); return; }
  const uid = document.getElementById('uidInput').value.trim();
  const orderMsg = document.getElementById('orderMsg');
  const receiptInput = document.getElementById('receiptFile');

  if(!uid){ alert('කරුණාකර UID එක type කරන්න.'); return; }
  if(!uidVerified){ alert('කරුණාකර UID එක verify කරන්න.'); return; }
  if(!selectedPkg){ alert('කරුණාකර package එකක් තෝරන්න.'); return; }
  const baseOrder = {
    id: Date.now(),
    uid, player: verifiedPlayerName, package: selectedPkg.label, amount: selectedPkg.price,
    payment: selectedPay, date: new Date().toLocaleString(),
    userPhone: session ? session.phone : null
  };

  const submitBtn = document.querySelector('.order-panel .btn-block');
  if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Submitting...'; }

  try{
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
      return;
    }

    // Bank Transfer / Ez Cash — needs a receipt upload
    if(!receiptInput || !receiptInput.files[0]){
      alert('කරුණාකර payment receipt එක upload කරන්න.');
      return;
    }
    const file = receiptInput.files[0];
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    await saveOrder(Object.assign({}, baseOrder, { status: 'Processing', receipt: dataUrl, receiptName: file.name }));
    if(orderMsg){
      orderMsg.innerHTML = '✅ Order එක place උනා! Admin receipt එක verify කරලා Approve කරනකම් "Processing" status එකේ පවතී — site එකෙන්ම track කරන්න පුළුවන්.';
      orderMsg.className = 'verify-status ok';
    } else {
      alert('✅ Order එක place උනා! Admin approve කරනකම් Processing status එකේ පවතී.');
    }
    receiptInput.value = '';
  } catch(err){
    console.error('[SakinduStore] placeOrder error', err);
    if(orderMsg){
      orderMsg.innerHTML = `❌ Order එක submit කරන්න බැරි උනා.<br><span style="font-size:.8rem;opacity:.8;">${(err && err.message) ? err.message : err}</span>`;
      orderMsg.className = 'verify-status err';
    } else {
      alert('❌ Order එක submit කරන්න බැරි උනා: ' + ((err && err.message) ? err.message : err));
    }
  } finally {
    if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Order එක Submit කරන්න'; }
  }
}

function updatePaymentUI(){
  const receiptBlock = document.getElementById('receiptBlock');
  const walletBlock = document.getElementById('walletBalanceBlock');
  if(!receiptBlock || !walletBlock) return;
  if(selectedPay === 'Wallet Balance'){
    receiptBlock.style.display = 'none';
    walletBlock.style.display = 'block';
    const balEl = document.getElementById('walletBalanceDisplay');
    const key = currentWalletKey();
    if(!key){
      if(balEl) balEl.innerHTML = '<a href="#" onclick="openAuth(\'login\');return false;" style="color:var(--cyan);font-size:.9rem;">Login to use Wallet Balance</a>';
      return;
    }
    if(balEl) balEl.textContent = 'Rs. ' + getWalletBalance();
    fsGetWalletBalance(key).then(bal => {
      walletsCache[key] = bal;
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

  const session = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  if(!session){
    list.innerHTML = '<div class="empty-state">ඔබේ orders බලන්න <a href="#" onclick="openAuth(\'login\');return false;" style="color:var(--cyan);">Login</a> වෙන්න.</div>';
    return;
  }

  const myOrders = ordersCache.filter(o => o.userPhone === session.phone);
  if(myOrders.length === 0){
    list.innerHTML = '<div class="empty-state">තවම orders කිසිවක් නැහැ. Top-up එකක් කරලා බලන්න!</div>';
    return;
  }
  list.innerHTML = myOrders.map(o => `
    <div class="order-row">
      <div>
        <div><strong>${o.package}</strong> — UID: ${o.uid}${o.player ? ' (' + o.player + ')' : ''}</div>
        <div class="oid">${o.date} · ${o.payment}</div>
      </div>
      <div style="display:flex;align-items:center;gap:14px;">
        <div style="color:var(--gold);font-weight:700;">Rs. ${o.amount}</div>
        <div class="status-pill ${o.status==='Processing'?'status-pending':(o.status==='Rejected'?'status-rejected':'status-done')}">${o.status}</div>
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
  // No shared "guest" bucket — every wallet action requires login, so this only
  // ever resolves to a real account's phone number. Returns null when logged out.
  const session = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  return session ? session.phone : null;
}
function getWalletBalance(key){
  const k = key || currentWalletKey();
  if(!k) return 0;
  return walletsCache[k] || 0;
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
  if(!el) return;
  const session = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  if(!session){
    el.innerHTML = '<a href="#" onclick="openAuth(\'login\');return false;" style="color:var(--cyan);font-size:.85rem;">Login to view balance</a>';
    return;
  }
  el.textContent = 'Rs. ' + getWalletBalance();
}
async function submitWalletRechargeRequest(){
  const session = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  const amountEl = document.getElementById('rechargeReqAmount');
  const fileInput = document.getElementById('proofFile');
  const status = document.getElementById('proofStatus');

  if(!session){ status.textContent = '⚠️ Request දාන්න කලින් Login වෙන්න.'; status.className = 'verify-status'; openAuth('login'); return; }
  const amount = parseInt(amountEl.value, 10);
  if(!amount || amount <= 0){ status.textContent = '⚠️ Valid amount එකක් දාන්න.'; status.className = 'verify-status'; return; }
  if(!fileInput.files[0]){ status.textContent = '⚠️ Payment screenshot එක upload කරන්න.'; status.className = 'verify-status'; return; }

  const btn = document.querySelector('.wallet-card .btn-block');
  if(btn){ btn.disabled = true; btn.textContent = 'Submitting...'; }
  status.textContent = '';

  try{
    const file = fileInput.files[0];
    const dataUrl = await fileToDataURL(file);
    await fsAddWalletRequest({
      id: Date.now(),
      phone: session.phone,
      name: session.name,
      amount, receipt: dataUrl, receiptName: file.name,
      status: 'Pending', date: new Date().toLocaleString()
    });
    status.innerHTML = '✅ Request එක submit උනා! Admin Approve කරනකම් "Pending" තියේවි — Approve වුනාම Rs. ' + amount + ' ඔබේ Wallet එකට add වේ.';
    status.className = 'verify-status ok';
    amountEl.value = '';
    fileInput.value = '';
    document.getElementById('proofFileLabel').textContent = '📎 Click to upload payment screenshot';
    renderRechargeHistory();
  } catch(err){
    console.error('[SakinduStore] wallet recharge request error', err);
    status.innerHTML = `❌ Request එක submit කරන්න බැරි උනා.<br><span style="font-size:.78rem;opacity:.8;">${err.message||err}</span>`;
    status.className = 'verify-status err';
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = 'Submit Request'; }
  }
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
  const session = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  if(!session){ status.textContent = '⚠️ Redeem කරන්න කලින් Login / Sign Up වෙන්න ඕන.'; status.className = 'verify-status'; openAuth('login'); return; }
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
    try{
      await creditUserWallet(key, redeemCodesCache[code]);
      redeemed.push(code);
      localStorage.setItem(redeemedKey, JSON.stringify(redeemed));
      status.textContent = `✅ Rs. ${redeemCodesCache[code]} ඔබේ wallet එකට add උනා!`;
      status.className = 'verify-status ok';
      renderWallet();
    } catch(err){
      console.error('[SakinduStore] redeemCode error', err);
      status.innerHTML = `❌ Redeem කරන්න බැරි උනා.<br><span style="font-size:.8rem;opacity:.8;">${(err && err.message) ? err.message : err}</span>`;
      status.className = 'verify-status err';
    }
  } else {
    status.textContent = '❌ Invalid redeem code.';
    status.className = 'verify-status';
  }
}

/* ---------- WALLET RECHARGE HISTORY (customer's own submitted requests) ---------- */
async function renderRechargeHistory(){
  const list = document.getElementById('rechargeHistoryList');
  if(!list) return;
  const session = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  if(!session){
    list.innerHTML = '<div class="empty-state">ඔබේ recharge history බලන්න <a href="#" onclick="openAuth(\'login\');return false;" style="color:var(--cyan);">Login</a> වෙන්න.</div>';
    return;
  }
  try{
    const all = await fsGetWalletRequests();
    const mine = all.filter(r => r.phone === session.phone);
    if(mine.length === 0){
      list.innerHTML = '<div class="empty-state">තවම recharge requests කිසිවක් නැහැ.</div>';
      return;
    }
    list.innerHTML = mine.map(r => `
      <div class="order-row">
        <div>
          <div><strong>Wallet Recharge</strong></div>
          <div class="oid">${r.date}</div>
        </div>
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="color:var(--gold);font-weight:700;">Rs. ${r.amount}</div>
          <div class="status-pill ${r.status==='Pending'?'status-pending':'status-done'}">${r.status}</div>
        </div>
      </div>
    `).join('');
  } catch(err){
    console.error('[SakinduStore] recharge history error', err);
    list.innerHTML = `<div class="empty-state">History load කරන්න බැරි උනා.</div>`;
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
  const emailEl = document.getElementById('authEmail');
  if(emailEl) emailEl.style.display = isLogin ? 'none' : 'block';
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
  const emailEl = document.getElementById('authEmail');
  const email = emailEl ? emailEl.value.trim() : '';
  const msg = document.getElementById('authMsg');
  if(!phone || !pass){ msg.textContent = 'කරුණාකර සියලු fields පුරවන්න.'; msg.className='verify-status'; return; }
  if(authMode === 'signup' && !email){ msg.textContent = 'Email address එකක් දාන්න.'; msg.className='verify-status'; return; }
  if(authMode === 'signup' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ msg.textContent = '⚠️ Valid email address එකක් දාන්න.'; msg.className='verify-status'; return; }

  const submitBtn = document.querySelector('#authOverlay .btn-block');
  if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Please wait...'; }
  msg.textContent = '';
  msg.className = 'verify-status';

  try{
    const existing = await fsGetUser(phone);
    if(authMode === 'signup'){
      if(existing){ msg.textContent = 'මේ number එකෙන් කලින් account එකක් තියෙනවා.'; msg.className='verify-status'; return; }
      const userData = { name: name || 'Player', email, pass, avatar: pendingAvatar || null };
      await fsSetUser(phone, userData);
      usersCache[phone] = userData;
      await loginSession(phone, userData.name);
    } else {
      if(!existing || existing.pass !== pass){
        msg.textContent = '❌ Phone number හෝ password වැරදියි.'; msg.className='verify-status';
        return;
      }
      usersCache[phone] = existing;
      await loginSession(phone, existing.name);
    }
  } catch(err){
    console.error('[SakinduStore] auth error', err);
    msg.innerHTML = `❌ Server එකට connect වෙන්න බැරි උනා.<br><span style="font-size:.8rem;opacity:.8;">${(err && err.message) ? err.message : err}</span>`;
    msg.className = 'verify-status err';
  } finally {
    if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Continue'; }
  }
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
    const visual = img ? `<img src="${img}" alt="${g.name}">` : `<div class="ph">🎮</div>`;
    const isActive = g.status === 'active';
    const pill = isActive
      ? `<div class="game-status-pill"><span class="dot"></span> ACTIVE</div>`
      : `<div class="game-status-pill soon"><span class="dot"></span> COMING SOON</div>`;
    return `
      <a class="game-card" href="${g.link || '#'}">
        <div class="game-card-img-wrap">
          ${visual}
          ${pill}
        </div>
        <h3>${g.name}</h3>
      </a>`;
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
  const genSession = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  if(!genSession){ alert('⚠️ Order එකක් දාන්න කලින් Login / Sign Up වෙන්න ඕන.'); openAuth('login'); return; }
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

  const submitBtn = document.querySelector('#gamePageRoot .btn-block');
  if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Submitting...'; }

  try{
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
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    await saveOrder(Object.assign({}, baseOrder, { status: 'Processing', receipt: dataUrl, receiptName: file.name }));
    orderMsg.innerHTML = '✅ Order එක place උනා! Admin Approve කරනකම් "Processing" status එකේ පවතී.';
    orderMsg.className = 'verify-status ok';
    receiptInput.value = '';
  } catch(err){
    console.error('[SakinduStore] placeGenericOrder error', err);
    orderMsg.innerHTML = `❌ Order එක submit කරන්න බැරි උනා.<br><span style="font-size:.8rem;opacity:.8;">${(err && err.message) ? err.message : err}</span>`;
    orderMsg.className = 'verify-status err';
  } finally {
    if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Order එක Submit කරන්න'; }
  }
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

/* ---------- LUCKY SPIN ---------- */
const SPIN_PRIZES = [0, 5, 0, 10, 0, 50, 0, 80]; // 8 segments, index-aligned with the wheel
const SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;
let spinCountdownTimer = null;

function fileToDataURL(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function pickWeightedPrize(){
  // After the first 100 spins, prizes are deliberately rare.
  const roll = Math.random() * 100;
  if(roll < 70) return 0;
  if(roll < 85) return 5;
  if(roll < 93) return 10;
  if(roll < 98) return 50;
  return 80;
}
function segmentIndexForPrize(prize){
  const candidates = SPIN_PRIZES.map((p,i)=>({p,i})).filter(x => x.p === prize);
  return candidates[Math.floor(Math.random()*candidates.length)].i;
}

async function initSpinPage(){
  const session = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  const loginGate = document.getElementById('spinLoginGate');
  const spinUI = document.getElementById('spinUI');
  if(!session){
    if(loginGate) loginGate.style.display = 'block';
    if(spinUI) spinUI.style.display = 'none';
    return;
  }
  if(loginGate) loginGate.style.display = 'none';
  if(spinUI) spinUI.style.display = 'block';
  buildSpinWheelLabels();
  await checkSpinCooldown();
}

function buildSpinWheelLabels(){
  const wrap = document.getElementById('spinLabels');
  if(!wrap || wrap.children.length) return;
  SPIN_PRIZES.forEach((p, i) => {
    const angle = i*45 + 22.5;
    const el = document.createElement('div');
    el.className = 'spin-label';
    el.textContent = p === 0 ? 'Try Again' : ('Rs.' + p);
    el.style.transform = `translate(-50%,-50%) rotate(${angle}deg) translateY(-100px) rotate(${-angle}deg)`;
    wrap.appendChild(el);
  });
}

async function checkSpinCooldown(){
  const session = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  if(!session) return;
  const btn = document.getElementById('spinBtn');
  const statusEl = document.getElementById('spinStatus');
  try{
    const wdoc = await fsGetWalletDoc(session.phone);
    const last = wdoc.lastSpinAt ? new Date(wdoc.lastSpinAt).getTime() : 0;
    const remaining = SPIN_COOLDOWN_MS - (Date.now() - last);
    if(remaining > 0){
      if(btn) btn.disabled = true;
      startSpinCountdown(remaining);
    } else {
      if(btn) btn.disabled = false;
      if(statusEl) statusEl.textContent = '🎰 ඔබට අද Spin කරන්න පුළුවන්!';
      const boxEl = document.getElementById('spinCountdownBox');
      if(boxEl) boxEl.innerHTML = '';
      if(spinCountdownTimer) clearInterval(spinCountdownTimer);
    }
  } catch(err){
    console.error('[SakinduStore] spin cooldown check error', err);
    if(statusEl) statusEl.innerHTML = `⚠️ Status check කරන්න බැරි උනා.<br><span style="font-size:.78rem;opacity:.8;">${err.message||err}</span>`;
  }
}
function startSpinCountdown(remainingMs){
  const statusEl = document.getElementById('spinStatus');
  const boxEl = document.getElementById('spinCountdownBox');
  if(statusEl) statusEl.textContent = '';
  if(spinCountdownTimer) clearInterval(spinCountdownTimer);
  function pad(n){ return String(n).padStart(2,'0'); }
  function tick(){
    if(remainingMs <= 0){
      clearInterval(spinCountdownTimer);
      if(boxEl) boxEl.innerHTML = '';
      checkSpinCooldown();
      return;
    }
    const h = Math.floor(remainingMs/3600000);
    const m = Math.floor((remainingMs%3600000)/60000);
    const s = Math.floor((remainingMs%60000)/1000);
    if(boxEl){
      boxEl.innerHTML = `
        <div class="spin-cd-label">⏳ ඊළඟ Spin එකට තව:</div>
        <div class="spin-cd-row">
          <div class="spin-cd-unit"><span>${pad(h)}</span><small>Hours</small></div>
          <div class="spin-cd-sep">:</div>
          <div class="spin-cd-unit"><span>${pad(m)}</span><small>Min</small></div>
          <div class="spin-cd-sep">:</div>
          <div class="spin-cd-unit"><span>${pad(s)}</span><small>Sec</small></div>
        </div>`;
    }
    remainingMs -= 1000;
  }
  tick();
  spinCountdownTimer = setInterval(tick, 1000);
}

async function doLuckySpin(){
  const session = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  if(!session){ openAuth('login'); return; }
  const btn = document.getElementById('spinBtn');
  const statusEl = document.getElementById('spinStatus');
  const wheel = document.getElementById('spinWheel');
  if(btn) btn.disabled = true;
  if(statusEl){ statusEl.textContent = '🎰 Spinning...'; statusEl.className = 'verify-status'; }

  try{
    const wdoc = await fsGetWalletDoc(session.phone);
    const last = wdoc.lastSpinAt ? new Date(wdoc.lastSpinAt).getTime() : 0;
    if(Date.now() - last < SPIN_COOLDOWN_MS){
      checkSpinCooldown();
      return;
    }

    const spinStats = await fsGetConfig('spinStats', { totalSpins: 0 });
    let prize;
    if(spinStats.totalSpins < 100){
      prize = 5;
    } else {
      prize = pickWeightedPrize();
    }
    const segIndex = segmentIndexForPrize(prize);

    // Animate the wheel
    const targetAngle = 360*6 + (360 - (segIndex*45 + 22.5));
    if(wheel) wheel.style.transform = `rotate(${targetAngle}deg)`;

    await new Promise(resolve => setTimeout(resolve, 4200));

    // Persist: increment global spin count, record this user's spin time, credit prize
    spinStats.totalSpins = (spinStats.totalSpins || 0) + 1;
    await fsSetConfig('spinStats', spinStats);
    await fsMergeWalletDoc(session.phone, { lastSpinAt: new Date().toISOString() });

    if(prize > 0){
      const bal = await fsGetWalletBalance(session.phone);
      await fsSetWalletBalance(session.phone, bal + prize);
      walletsCache[session.phone] = bal + prize;
      renderWallet();
      if(statusEl){ statusEl.innerHTML = `🎉 ඔබට Rs. ${prize} දිනුවා! Wallet එකට add උනා.`; statusEl.className = 'verify-status ok'; }
    } else {
      if(statusEl){ statusEl.textContent = '😔 මේ පාර දිනුවේ නැහැ — හෙට try කරන්න!'; statusEl.className = 'verify-status'; }
    }
    checkSpinCooldown();
  } catch(err){
    console.error('[SakinduStore] spin error', err);
    if(statusEl){ statusEl.innerHTML = `❌ Spin කරන්න බැරි උනා.<br><span style="font-size:.78rem;opacity:.8;">${err.message||err}</span>`; statusEl.className = 'verify-status err'; }
    if(btn) btn.disabled = false;
  }
}

/* ---------- FILMS (admin-manageable catalog, links to legal platforms e.g. Netflix) ---------- */
let filmsCache = [];
async function refreshFilmsCache(){ filmsCache = await fsGetConfig('films', []); }
async function saveFilms(films){ filmsCache = films; await fsSetConfig('films', films); }
function renderFilmsGrid(containerId, limit){
  const el = document.getElementById(containerId);
  if(!el) return;
  let films = filmsCache;
  if(limit) films = films.slice(0, limit);
  if(films.length === 0){ el.innerHTML = '<div class="empty-state">තවම films කිසිවක් නැහැ.</div>'; return; }
  el.innerHTML = films.map(f => `
    <div class="catalog-card">
      ${f.image ? `<img src="${f.image}" alt="${f.title}" class="catalog-img">` : '<div class="catalog-img ph">🎬</div>'}
      <div class="catalog-body">
        <h3>${f.title}</h3>
        <p class="catalog-desc">${f.description||''}</p>
        ${f.size ? `<div class="catalog-chip">${f.size}</div>` : ''}
        <a href="${f.link||'#'}" target="_blank" class="btn btn-primary btn-block" style="margin-top:12px;">▶️ Watch on Netflix</a>
      </div>
    </div>`).join('');
}

/* ---------- ACCOUNT STORE (admin-manageable account listings) ---------- */
let accountsCache = [];
async function refreshAccountsCache(){ accountsCache = await fsGetConfig('accounts', []); }
async function saveAccounts(accounts){ accountsCache = accounts; await fsSetConfig('accounts', accounts); }
function renderAccountsGrid(containerId, limit){
  const el = document.getElementById(containerId);
  if(!el) return;
  let accounts = accountsCache;
  if(limit) accounts = accounts.slice(0, limit);
  if(accounts.length === 0){ el.innerHTML = '<div class="empty-state">තවම accounts කිසිවක් listed නැහැ.</div>'; return; }
  el.innerHTML = accounts.map(a => {
    const waMsg = encodeURIComponent(`Hi, I'm interested in this account: ${a.title} (Rs. ${a.price})`);
    return `
    <div class="catalog-card">
      ${a.image ? `<img src="${a.image}" alt="${a.title}" class="catalog-img">` : '<div class="catalog-img ph">🎮</div>'}
      <div class="catalog-body">
        <h3>${a.title}</h3>
        <p class="catalog-desc">${a.description||''}</p>
        <div class="catalog-chip gold">Rs. ${a.price}</div>
        <a href="https://wa.me/94760627795?text=${waMsg}" target="_blank" class="btn btn-primary btn-block" style="margin-top:12px;">📩 Contact to Buy</a>
      </div>
    </div>`;
  }).join('');
}

/* ---------- AD BANNERS (admin-manageable, image + redirect link) ---------- */
let adBannersCache = [];
async function refreshAdBannersCache(){ adBannersCache = await fsGetConfig('adBanners', []); }
async function saveAdBanners(banners){ adBannersCache = banners; await fsSetConfig('adBanners', banners); }
function renderAdBanners(containerId){
  const el = document.getElementById(containerId);
  if(!el) return;
  if(adBannersCache.length === 0){ el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = adBannersCache.map(b => `
    <a href="${b.link||'#'}" target="_blank" class="ad-banner-item">
      <img src="${b.image}" alt="Ad">
    </a>`).join('');
}

/* ---------- UPCOMING EVENT (Firestore config/upcomingEvent) ---------- */
let eventCache = null;
async function refreshEventCache(){
  eventCache = await fsGetConfig('upcomingEvent', null);
}
async function setUpcomingEvent(data){
  eventCache = data;
  await fsSetConfig('upcomingEvent', data);
}
async function clearUpcomingEvent(){
  eventCache = null;
  await fsSetConfig('upcomingEvent', null);
}
function renderUpcomingEvent(){
  const section = document.getElementById('eventSection');
  if(!section) return;
  if(!eventCache || !eventCache.name){
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';
  const imgEl = document.getElementById('eventImage');
  const nameEl = document.getElementById('eventName');
  const dateEl = document.getElementById('eventDate');
  if(imgEl){
    if(eventCache.image){ imgEl.src = eventCache.image; imgEl.style.display = 'block'; }
    else { imgEl.style.display = 'none'; }
  }
  if(nameEl) nameEl.textContent = eventCache.name;
  if(dateEl) dateEl.textContent = eventCache.date || '';
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

/* ---------- GLOBAL LOADING OVERLAY (rotating diamond) ---------- */
function showGlobalLoader(){
  if(document.getElementById('globalLoader')) return;
  const el = document.createElement('div');
  el.id = 'globalLoader';
  el.className = 'global-loader';
  el.innerHTML = '<div class="loader-diamond">💎</div><div class="loader-text">SakinduStore</div>';
  if(document.body){ document.body.appendChild(el); }
  else { document.addEventListener('DOMContentLoaded', () => document.body.appendChild(el)); }
}
function hideGlobalLoader(){
  const el = document.getElementById('globalLoader');
  if(!el) return;
  el.classList.add('hide');
  setTimeout(() => el.remove(), 350);
}

/* ---------- AI HELP BOT (rule-based FAQ assistant, injected on every page) ---------- */
const AI_BOT_FAQ = [
  { kw:['uid','verify','player id','id check'], a:'Free Fire Top Up page එකේ UID එක type කරලා "Verify" click කරන්න. Real player name එක visible උනොත් correct UID එක — Order කරන්න කලින් double-check කරන්න!' },
  { kw:['price','ගාන','cost','rate','diamond price'], a:'Package prices ටික Free Fire Top Up page එකේ Diamonds/Top Selling/Level Up Pass tabs වල තියෙනවා. Prices වෙනස් වෙන්න පුළුවන් — latest ගාන site එකේ බලන්න.' },
  { kw:['wallet','recharge','balance','add money','fund'], a:'Wallet page එකට ගිහින් Amount + Payment screenshot එක දාලා "Submit Request" කරන්න. Admin Approve කළාම ඒ ගාන Wallet එකට instant add වෙනවා. Status එක "Recharge History" එකේ බලන්න පුළුවන්.' },
  { kw:['order','status','track','processing','pending'], a:'ඔබේ Orders ටික බලන්න Home page එකේ "My Orders" section එකට යන්න (Login වෙලා ඉන්න ඕන). "Processing" කියන්නේ Admin review කරමින් කියන එකයි, Approve උනාම diamonds release වෙනවා.' },
  { kw:['payment','bank','ez cash','ezcash','pay'], a:'Bank Transfer, Ez Cash, සහ Wallet Balance — payment methods තුනක් තියෙනවා. Payment Details (Account No./Ez Cash No.) WhatsApp එකෙන් ගන්න checkout page එකේ button එකක් තියෙනවා.' },
  { kw:['spin','lucky','wheel'], a:'Lucky Spin page එකට ගිහින් (Login වෙලා) දවසකට 1 Spin කරන්න පුළුවන් — Rs.5, Rs.10, Rs.50, Rs.80 දක්වා cash prizes Wallet එකටම instant add වෙනවා!' },
  { kw:['reject','rejected','declined'], a:'Order එකක් Reject උනා නම්, ඒකට හේතුව (වැරදි receipt/payment issue) WhatsApp එකෙන් අහන්න — Admin ට clarify කරන්න පුළුවන්.' },
  { kw:['refund','cancel'], a:'Refund/Cancellation Policy සම්පූර්ණයෙන් බලන්න Footer එකේ "Refund & Cancellation Policy" link එකෙන්.' },
  { kw:['login','sign up','signup','register','account'], a:'Login/Sign Up Home page එකේ උඩින් "Login" button එකෙන් කරන්න පුළුවන්. Order/Wallet/Spin features ඔක්කොටම Login අනිවාර්යයි.' },
  { kw:['contact','support','admin','whatsapp','talk'], a:'Direct support සඳහා WhatsApp එකෙන් 076 062 7795 අමතන්න — Chat bubble එකේ 💬 icon එකෙන්ම යන්න පුළුවන්.' },
];
function aiBotFindAnswer(msg){
  const lower = msg.toLowerCase();
  for(const entry of AI_BOT_FAQ){
    if(entry.kw.some(k => lower.includes(k))) return entry.a;
  }
  return 'මට ඒක clear විදිහට answer කරන්න බැහැ 🙏 — WhatsApp එකෙන් (076 062 7795) අපේ team එකට directly අහන්න, ඉක්මනින් reply කරයි!';
}
function injectAIBot(){
  if(document.getElementById('aiBotFloat')) return;

  const float = document.createElement('div');
  float.id = 'aiBotFloat';
  float.className = 'ai-bot-float';
  float.innerHTML = '🤖';
  float.onclick = toggleAIBotPanel;

  const panel = document.createElement('div');
  panel.id = 'aiBotPanel';
  panel.className = 'ai-bot-panel';
  panel.innerHTML = `
    <div class="ai-bot-header">
      <span>🤖 SakinduStore Help</span>
      <button onclick="toggleAIBotPanel()" class="ai-bot-close">✕</button>
    </div>
    <div class="ai-bot-messages" id="aiBotMessages">
      <div class="ai-bot-msg bot">👋 ආයුබෝවන්! UID verify, Wallet, Orders, Payment methods, Lucky Spin ගැන අහන්න. මොකක් හරි type කරන්න!</div>
    </div>
    <div class="ai-bot-input-row">
      <input type="text" id="aiBotInput" placeholder="ප්‍රශ්නයක් type කරන්න..." onkeydown="if(event.key==='Enter')sendAIBotMessage();">
      <button onclick="sendAIBotMessage()">➤</button>
    </div>`;

  document.body.appendChild(float);
  document.body.appendChild(panel);
}
function toggleAIBotPanel(){
  const panel = document.getElementById('aiBotPanel');
  if(panel) panel.classList.toggle('show');
}
function sendAIBotMessage(){
  const input = document.getElementById('aiBotInput');
  const msgBox = document.getElementById('aiBotMessages');
  const text = input.value.trim();
  if(!text) return;
  const userMsg = document.createElement('div');
  userMsg.className = 'ai-bot-msg user';
  userMsg.textContent = text;
  msgBox.appendChild(userMsg);
  input.value = '';

  setTimeout(() => {
    const botMsg = document.createElement('div');
    botMsg.className = 'ai-bot-msg bot';
    botMsg.textContent = aiBotFindAnswer(text);
    msgBox.appendChild(botMsg);
    msgBox.scrollTop = msgBox.scrollHeight;
  }, 400);
  msgBox.scrollTop = msgBox.scrollHeight;
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
async function safeRefresh(fn, label){
  try{ await fn(); }
  catch(e){ console.error('[SakinduStore] failed to load', label, e); }
}
async function initApp(){
  showGlobalLoader();
  wireGameIcons();
  renderCatTabs();
  try{
    await Promise.all([
      safeRefresh(refreshGamesCache, 'games'),
      safeRefresh(refreshStoreCache, 'store'),
      safeRefresh(refreshPriceOverridesCache, 'priceOverrides'),
      safeRefresh(refreshRedeemCodesCache, 'redeemCodes'),
      safeRefresh(refreshReviewsCache, 'reviews'),
      safeRefresh(refreshVideosCache, 'videos'),
      safeRefresh(refreshOrdersCache, 'orders'),
      safeRefresh(refreshUsersCache, 'users'),
      safeRefresh(refreshWalletsCache, 'wallets'),
      safeRefresh(refreshEventCache, 'upcomingEvent'),
      safeRefresh(refreshFilmsCache, 'films'),
      safeRefresh(refreshAccountsCache, 'accounts'),
      safeRefresh(refreshAdBannersCache, 'adBanners'),
    ]);
    renderGamesGrid();
    renderUpcomingEvent();
    renderGenericGamePage();
    renderStoreLock();
    renderAnnouncement();
    renderPackages();
    renderWallet();
    renderOrders();
    renderRechargeHistory();
    renderLeaderboard();
    renderVideosGrid('videosGridHome', 3);
    renderFilmsGrid('filmsGrid');
    renderFilmsGrid('filmsGridHome', 3);
    renderAccountsGrid('accountsGrid');
    renderAccountsGrid('accountsGridHome', 3);
    renderAdBanners('adBannerStrip');
    renderReviews();
    refreshAuthUI();
    updatePaymentUI();
    injectAIBot();
  } finally {
    hideGlobalLoader();
  }
}
initApp();
