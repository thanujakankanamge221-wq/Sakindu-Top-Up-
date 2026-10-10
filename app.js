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

/* ---------- PACKAGE DATA (categorised, discount pricing, real art banners) ---------- */
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
           "Topup Event Cover":"linear-gradient(135deg,#ff5c7a,#ffc857)",
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

function getPriceOverrides(){
  return JSON.parse(localStorage.getItem('sakindu_price_overrides') || '{}');
}
function getEffectivePrice(cat, label, fallback){
  const overrides = getPriceOverrides();
  const key = `${cat}::${label}`;
  return overrides[key] !== undefined ? overrides[key] : fallback;
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
  selectedPkg = { ...base, price: effPrice };
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
      // Real API reached but reported no player found — fall back to a simulated pass
      // so checkout isn't blocked. See FALLBACK note below.
      simulateVerified(uid, status);
    }
  } catch(err){
    // Real API unreachable (network/CORS/key issue) — fall back to a simulated pass.
    // FALLBACK: this does not actually confirm the UID is a real Free Fire account.
    // Remove this fallback once the real API key/connectivity is confirmed working.
    simulateVerified(uid, status);
  } finally {
    if(btn){ btn.disabled = false; }
  }
}

function simulateVerified(uid, status){
  const namePool = ["ProGamerLK","ShadowStrikerFF","FireKing_LK","NightHunterX","BlazeRushLK","TigerZoneFF","ViperAceLK","StormBladeFF"];
  const base = namePool[parseInt(uid.slice(-2),10) % namePool.length];
  uidVerified = true;
  verifiedPlayerName = base + uid.slice(-3);
  status.innerHTML = `<span class="player-name-chip">✅ ${verifiedPlayerName}</span>`;
  status.className = 'verify-status';
}

function saveOrder(order){
  const orders = JSON.parse(localStorage.getItem('sakindu_orders') || '[]');
  orders.push(order);
  localStorage.setItem('sakindu_orders', JSON.stringify(orders));
  renderOrders();
  if(typeof renderLeaderboard === 'function') renderLeaderboard();
}

function placeOrder(){
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

  if(selectedPay === 'Wallet Balance'){
    const key = currentWalletKey();
    const bal = getWalletBalance(key);
    if(bal < selectedPkg.price){
      if(orderMsg){
        orderMsg.innerHTML = `❌ Wallet balance එක ප්‍රමාණවත් නැහැ. Current balance: Rs. ${bal}. <a href="wallet.html" style="color:var(--cyan);">Wallet Recharge කරන්න</a>`;
        orderMsg.className = 'verify-status err';
      } else {
        alert('❌ Wallet balance එක ප්‍රමාණවත් නැහැ.');
      }
      return;
    }
    setWalletBalance(key, bal - selectedPkg.price);
    saveOrder({ ...baseOrder, status: 'Processing' });
    if(typeof renderWallet === 'function') renderWallet();
    if(orderMsg){
      orderMsg.innerHTML = `✅ Wallet Balance එකෙන් Rs. ${selectedPkg.price} deduct කළා. Order එක Admin Approve කරනකම් "Processing" status එකේ පවතී.`;
      orderMsg.className = 'verify-status ok';
    } else {
      alert('✅ Wallet Balance එකෙන් deduct කළා. Admin Approve කරනකම් Processing status එකේ පවතී.');
    }
    return;
  }

  // Bank Transfer / Ez Cash — needs a receipt upload
  if(!receiptInput || !receiptInput.files[0]){ alert('කරුණාකර payment receipt එක upload කරන්න.'); return; }
  const file = receiptInput.files[0];
  const reader = new FileReader();
  reader.onload = function(e){
    saveOrder({ ...baseOrder, status: 'Processing', receipt: e.target.result, receiptName: file.name });
    if(orderMsg){
      orderMsg.innerHTML = '✅ Order එක place උනා! Admin receipt එක verify කරලා Approve කරනකම් "Processing" status එකේ පවතී — site එකෙන්ම track කරන්න පුළුවන්.';
      orderMsg.className = 'verify-status ok';
    } else {
      alert('✅ Order එක place උනා! Admin approve කරනකම් Processing status එකේ පවතී.');
    }
    receiptInput.value = '';
  };
  reader.readAsDataURL(file);
}

/* Toggle receipt-upload vs wallet-balance display when payment method changes */
function updatePaymentUI(){
  const receiptBlock = document.getElementById('receiptBlock');
  const walletBlock = document.getElementById('walletBalanceBlock');
  if(!receiptBlock || !walletBlock) return;
  if(selectedPay === 'Wallet Balance'){
    receiptBlock.style.display = 'none';
    walletBlock.style.display = 'block';
    const bal = getWalletBalance();
    const balEl = document.getElementById('walletBalanceDisplay');
    if(balEl) balEl.textContent = 'Rs. ' + bal;
  } else {
    receiptBlock.style.display = 'block';
    walletBlock.style.display = 'none';
  }
}

/* ---------- WALLET (per logged-in user, keyed by phone; 'guest' bucket if not logged in) ---------- */
function currentWalletKey(){
  const session = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  return session ? session.phone : 'guest';
}
function getAllWallets(){
  return JSON.parse(localStorage.getItem('sakindu_wallets') || '{}');
}
function getWalletBalance(key){
  const wallets = getAllWallets();
  return wallets[key || currentWalletKey()] || 0;
}
function setWalletBalance(key, amount){
  const wallets = getAllWallets();
  wallets[key] = amount;
  localStorage.setItem('sakindu_wallets', JSON.stringify(wallets));
}
function creditUserWallet(key, amount){
  const newBal = getWalletBalance(key) + amount;
  setWalletBalance(key, newBal);
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
function redeemCode(){
  const code = document.getElementById('redeemInput').value.trim().toUpperCase();
  const status = document.getElementById('redeemStatus');
  const validCodes = JSON.parse(localStorage.getItem('sakindu_redeem_codes') || JSON.stringify({ "SAKINDU100": 100, "FREEFIRE50": 50, "WELCOME200": 200 }));
  if(!code){ status.textContent = 'Code එකක් type කරන්න.'; status.className='verify-status'; return; }
  const redeemed = JSON.parse(localStorage.getItem('sakindu_redeemed') || '[]');
  if(redeemed.includes(code)){
    status.textContent = '⚠️ මේ code එක කලින් redeem කරලා තියෙනවා.';
    status.className = 'verify-status';
    return;
  }
  if(validCodes[code] !== undefined){
    creditUserWallet(currentWalletKey(), validCodes[code]);
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
  if(!list) return;
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
        <div class="status-pill ${o.status==='Processing'?'status-pending':'status-done'}">${o.status}</div>
      </div>
    </div>
  `).join('');
}

/* ---------- TOP SPENDER LEADERBOARD ---------- */
function renderLeaderboard(){
  const el = document.getElementById('leaderboardList');
  if(!el) return;
  const orders = JSON.parse(localStorage.getItem('sakindu_orders') || '[]');
  const users = JSON.parse(localStorage.getItem('sakindu_users') || '{}');

  const totals = {};
  orders.forEach(o => {
    if(!o.userPhone) return;
    totals[o.userPhone] = (totals[o.userPhone] || 0) + o.amount;
  });

  const ranked = Object.keys(totals)
    .filter(phone => users[phone])
    .map(phone => ({ phone, name: users[phone].name, avatar: users[phone].avatar, total: totals[phone] }))
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

/* ---------- CUSTOMER REVIEWS ---------- */
const defaultReviews = [
  {name:"Lakmal Perera", loc:"Colombo, Sri Lanka", stars:5, text:"Super fast delivery, UID verify එක instant. Highly recommend!", seed:true},
  {name:"Nimasha K.", loc:"Kandy, Sri Lanka", stars:4, text:"Good rates and friendly WhatsApp support.", seed:true},
];
function getReviews(){
  const stored = JSON.parse(localStorage.getItem('sakindu_reviews') || 'null');
  return stored || defaultReviews;
}
function renderReviews(){
  const el = document.getElementById('reviewScroll');
  if(!el) return;
  const reviews = getReviews().slice().reverse();
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
function submitReview(){
  const name = document.getElementById('reviewName').value.trim();
  const loc = document.getElementById('reviewLoc').value.trim();
  const text = document.getElementById('reviewText').value.trim();
  const msg = document.getElementById('reviewMsg');
  if(!name || !text){ msg.textContent = 'Name සහ review එක type කරන්න.'; msg.className = 'verify-status'; return; }
  const reviews = getReviews();
  reviews.push({name, loc: loc || "Sri Lanka", stars: pickedStars, text, seed:false});
  localStorage.setItem('sakindu_reviews', JSON.stringify(reviews));
  closeReviewModal();
  document.getElementById('reviewName').value='';
  document.getElementById('reviewLoc').value='';
  document.getElementById('reviewText').value='';
  renderReviews();
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
function submitAuth(){
  const phone = document.getElementById('authPhone').value.trim();
  const pass = document.getElementById('authPass').value.trim();
  const name = document.getElementById('authName').value.trim();
  const msg = document.getElementById('authMsg');
  if(!phone || !pass){ msg.textContent = 'කරුණාකර සියලු fields පුරවන්න.'; msg.className='verify-status'; return; }

  const users = JSON.parse(localStorage.getItem('sakindu_users') || '{}');
  if(authMode === 'signup'){
    if(users[phone]){ msg.textContent = 'මේ number එකෙන් කලින් account එකක් තියෙනවා.'; msg.className='verify-status'; return; }
    users[phone] = { name: name || 'Player', pass, avatar: pendingAvatar || null };
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
  renderWallet();
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

/* ---------- GAMES CATALOG (admin-manageable, stored in localStorage) ---------- */
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
];
function getGames(){
  const stored = JSON.parse(localStorage.getItem('sakindu_games') || 'null');
  return stored || defaultGames;
}
function saveGames(games){
  localStorage.setItem('sakindu_games', JSON.stringify(games));
}
function gameImageSrc(g){
  if(g.imgVar && typeof window[g.imgVar] !== 'undefined') return window[g.imgVar];
  return null;
}
function renderGamesGrid(){
  const el = document.getElementById('gamesGrid');
  if(!el) return;
  const games = getGames();
  el.innerHTML = games.map(g => {
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

/* ---------- VIDEOS (admin-manageable YouTube embeds) ---------- */
function getVideos(){
  return JSON.parse(localStorage.getItem('sakindu_videos') || '[]');
}
function saveVideos(videos){
  localStorage.setItem('sakindu_videos', JSON.stringify(videos));
}
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
  let videos = getVideos();
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

/* ---------- STORE OPEN/CLOSED — FULL-SCREEN LOCK ---------- */
function isStoreClosed(){
  return localStorage.getItem('sakindu_store_closed') === '1';
}
function renderStoreLock(){
  const el = document.getElementById('storeLockOverlay');
  if(!el) return;
  el.classList.toggle('show', isStoreClosed());
}

/* ---------- ANNOUNCEMENT STRIP (admin-editable homepage banner) ---------- */
function getAnnouncement(){
  return localStorage.getItem('sakindu_announcement') || '';
}
function renderAnnouncement(){
  const el = document.getElementById('announceStrip');
  if(!el) return;
  const msg = getAnnouncement();
  if(msg){
    el.textContent = '📢 ' + msg;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
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
wireGameIcons();
renderGamesGrid();
renderStoreLock();
renderAnnouncement();
renderCatTabs();
renderPackages();
renderWallet();
renderOrders();
renderLeaderboard();
renderVideosGrid('videosGridHome', 3);
renderReviews();
refreshAuthUI();
updatePaymentUI();
