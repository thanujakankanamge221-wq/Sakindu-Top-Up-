/* ===== SakinduStore app.js — Firestore-backed =====
   Pattern: each shared data type has an in-memory cache + an async refresh*Cache()
   function. Render functions read the cache (sync, fast). Writes go to Firestore
   first, then update the cache, then re-render. Requires firebase-init.js + db.js
   loaded before this file. */

/* ---------- FREE FIRE REGION AVAILABILITY ---------- */
// Only Singapore/Global has real packages & pricing set up right now — every other
// region is listed for visibility but is Coming Soon until region-specific pricing exists.
const FF_AVAILABLE_REGIONS = ['SG/MY/LK'];   // regions whose packages are built into the site
/* region picker list — `flags` are country codes (flagcdn.com), `icon` is used when there is no flag,
   `bonus` shows a flame badge on the card */
const FF_REGIONS = [
  { value:'SG/MY/LK', label:'SG/MY/LK', flags:['sg','my','lk'], recommended:true },
  { value:'50% BONUS', label:'50% Bonus', icon:'🔥', bonus:'50% BONUS', serverGroup:'SG/MY/LK' },
  { value:'Bangladesh', label:'Bangladesh', flags:['bd'] },
  { value:'Brazil', label:'Brazil', flags:['br'] },
  { value:'Europe', label:'Europe', flags:['eu'] },
  { value:'Global', label:'Global', icon:'🌐' },
  { value:'Indonesia', label:'Indonesia', flags:['id'] },
  { value:'Latin America', label:'Latin America', icon:'🌎' },
  { value:'Middle East & North Africa', label:'Middle East & North Africa', icon:'🎮' },
  { value:'Philippines', label:'Philippines', flags:['ph'] },
  { value:'Thailand', label:'Thailand', flags:['th'] },
  { value:'Taiwan', label:'Taiwan', flags:['tw'] },
  { value:'Vietnam', label:'Vietnam', flags:['vn'] }
];
/* Packages added in the admin panel (Admin -> 🔥 FF Region Packages): { regionValue: [ {id,cat,label,price,old,badge} ] } */
let ffRegionPackagesCache = {};
let ffLastRegion = null;
async function refreshFfRegionPackagesCache(){ ffRegionPackagesCache = await fsGetConfig('ffRegionPackages', {}); }
function isFFRegionAvailable(region){
  return FF_AVAILABLE_REGIONS.includes(region) || (ffRegionPackagesCache[region] || []).length > 0;
}
/* The catalog shown for the selected region: built-in packages for SG/MY/LK + anything added in admin */
function getFFPackageData(){
  const sel = document.getElementById('ffRegionSelect');
  const region = (sel && sel.value) || 'SG/MY/LK';
  const out = {};
  if(region === 'SG/MY/LK'){
    Object.keys(packageData).forEach(c => { out[c] = Object.assign({}, packageData[c], { items: packageData[c].items.slice() }); });
  }
  (ffRegionPackagesCache[region] || []).forEach(p => {
    const c = out[p.cat] || (out[p.cat] = { icon:'diamonds', iconLabel:'💎', items: [] });
    c.items.push({ label: p.label, price: Number(p.price), old: p.old ? Number(p.old) : null, badge: p.badge || '',
                   chip: String(p.label).split(' ')[0].slice(0, 6), custom: true });
  });
  return out;
}
/* called when the region changes or the admin-defined packages finish loading */
function refreshFFPackageView(resetSelection){
  if(resetSelection){ selectedPkg = null; activeCategory = 'All'; }
  const cats = Object.keys(getFFPackageData());
  if(activeCategory !== 'All' && !cats.includes(activeCategory)) activeCategory = 'All';
  renderCatTabs(); renderPackages(); updateTotalUI();
  const note = document.getElementById('ffRegionNote');
  const sel = document.getElementById('ffRegionSelect');
  if(note && sel){
    const r = FF_REGIONS.find(x => x.value === sel.value);
    note.style.display = (r && r.bonus && isFFRegionAvailable(r.value)) ? 'block' : 'none';
  }
}
function onFFRegionChange(){
  const sel = document.getElementById('ffRegionSelect');
  const msg = document.getElementById('ffRegionComingSoonMsg');
  if(!sel) return;
  const available = isFFRegionAvailable(sel.value);
  if(msg) msg.style.display = available ? 'none' : 'block';
  const uidInput = document.getElementById('uidInput');
  const verifyBtn = document.getElementById('verifyBtn');
  if(uidInput){ uidInput.disabled = !available; if(!available) uidInput.value = ''; }
  if(verifyBtn) verifyBtn.disabled = !available;
  if(!available){ uidVerified = false; const vs = document.getElementById('verifyStatus'); if(vs) vs.textContent = ''; }
  if(document.getElementById('pkgContainer')){
    const changed = sel.value !== ffLastRegion;          // keep the chosen package when the same region is just re-rendered
    ffLastRegion = sel.value;
    refreshFFPackageView(changed);
  }
}

/* ---------- WALLET TYPES & PROCESSING CHARGE ----------
   Two wallets per customer:
     'ez'   = EZ Cash / Redeem Wallet (no extra charge)
     'bank' = Bank Wallet             (0.75% processing charge when you PAY from it) */
const BANK_WALLET_FEE_RATE = 0.0075;
const PAY_BANK_WALLET = 'Bank Wallet';
const PAY_EZ_WALLET = 'EZ Cash / Redeem Wallet';
function walletTypeForPay(name){
  if(name === PAY_BANK_WALLET) return 'bank';
  if(name === PAY_EZ_WALLET || name === 'Wallet Balance') return 'ez';
  return null;
}
function fmtRs(n){ n = round2(n); return 'Rs. ' + (Number.isInteger(n) ? n : n.toFixed(2)); }
function calcCharge(price, payName){
  const fee = payName === PAY_BANK_WALLET ? round2(price * BANK_WALLET_FEE_RATE) : 0;
  return { base: price, fee, total: round2(price + fee) };
}
function walletLabel(type){ return type === 'bank' ? 'Bank Wallet' : 'EZ Cash / Redeem Wallet'; }

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
let verifiedLevel = null;
let verifiedPlayerRegion = "";
let uidAutoTimer = null;

function chipGradient(cat){
  return { "Top Selling":"linear-gradient(135deg,#ffb020,#ff6fa0)",
           "Diamonds":"linear-gradient(135deg,#29e0e8,#7c5cff)",
           "Level Up Pass":"linear-gradient(135deg,#3ddc84,#29e0e8)" }[cat] || "linear-gradient(135deg,#ff8a3d,#ff3d77)";
}

function renderCatTabs(){
  const el = document.getElementById('catTabs');
  if(!el) return;
  el.innerHTML = ['All', ...Object.keys(getFFPackageData())].map(cat =>
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
  const data = getFFPackageData();
  const cats = activeCategory === "All" ? Object.keys(data) : [activeCategory];
  if(!cats.length){ container.innerHTML = ''; return; }
  container.innerHTML = cats.map(cat => `
    <div class="cat-heading"><div class="cat-icon ${data[cat].icon}">${data[cat].iconLabel}</div> ${cat.toUpperCase()}</div>
    <div class="pkg-grid">
      ${data[cat].items.map((p,i) => {
        const effPrice = p.custom ? p.price : getEffectivePrice(cat, p.label, p.price);
        const bannerSrc = p.image || data[cat].image;
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
  const base = getFFPackageData()[cat].items[index];
  const effPrice = base.custom ? base.price : getEffectivePrice(cat, base.label, base.price);
  selectedPkg = Object.assign({}, base, { price: effPrice, cat });
  document.querySelectorAll('.pkg-card').forEach(c => c.classList.remove('selected'));
  document.getElementById(`pkg-${cat}-${index}`).classList.add('selected');
  updateTotalUI();
}
function updateTotalUI(){
  const totalEl = document.getElementById('totalAmount');
  const feeEl = document.getElementById('feeLine');
  if(!totalEl) return;
  const price = selectedPkg ? selectedPkg.price : 0;
  const c = calcCharge(price, selectedPay);
  totalEl.textContent = fmtRs(c.total);
  if(feeEl){
    if(c.fee > 0){
      feeEl.style.display = 'block';
      feeEl.innerHTML = `${fmtRs(c.base)} + ${fmtRs(c.fee)} Processing Charge (0.75%) — Bank Wallet එකෙන් pay කරද්දී පමණයි`;
    } else { feeEl.style.display = 'none'; }
  }
}

function selectPay(name, el){
  selectedPay = name;
  document.querySelectorAll('.pay-method').forEach(p => p.classList.remove('selected'));
  el.classList.add('selected');
  updatePaymentUI();
}

/* ---------- REAL UID VERIFICATION ---------- */
async function verifyUID(){
  const uid = document.getElementById('uidInput').value.replace(/\D/g, '');
  const status = document.getElementById('verifyStatus');
  const btn = document.getElementById('verifyBtn');

  uidVerified = false;
  verifiedPlayerName = "";
  verifiedLevel = null;
  verifiedPlayerRegion = "";

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
    // Live lookup (nickname + level + region) through the player-info relay, when it is configured
    if(typeof PLAYER_INFO_URL !== 'undefined' && PLAYER_INFO_URL){
      const info = await lookupPlayerInfo(uid);
      if(info.ok){
        uidVerified = true;
        verifiedPlayerName = info.nickname; verifiedLevel = info.level; verifiedPlayerRegion = info.region;
        saveUid(uid, info.nickname);
        // The account's real server decides where the top-up goes: switch the region automatically when it differs
        const regionEl = document.getElementById('ffRegionSelect');
        let warn = '';
        const target = info.fallback ? null : PLAYER_REGION_TO_STORE[info.region];
        if(target && regionEl){
          const cur = FF_REGIONS.find(r => r.value === regionEl.value);
          if(((cur && cur.serverGroup) || regionEl.value) !== target){
            if(isFFRegionAvailable(target)){
              autoSwitchFFRegion(target);
              warn = `🔁 ඔබේ account එක <strong>${info.region}</strong> server එකේ — Region එක <strong>${target}</strong> වලට auto මාරු කළා.`;
            } else {
              uidVerified = false;
              warn = `⚠️ මේ account එක <strong>${info.region}</strong> region එකේ (${target}). දැනට SG/MY/LK region එකේ accounts වලට පමණයි top-up කරන්නේ — ${target} ළඟදීම!`;
            }
          }
        }
        status.innerHTML = info.fallback
          ? `<span class="player-name-chip">✅ UID accepted</span><div style="margin-top:8px;color:var(--muted);font-size:.85rem;">Player details auto ගන්න බැරි උනා — ඔබ type කළ UID එකම භාවිත කරනවා. නිවැරදිද බලන්න.</div>`
          : `<span class="player-name-chip">${uidVerified ? '✅ UID Verified' : '⚠️ Account found'} · ${playerInfoChip(info)}</span>` + (warn ? `<div style="margin-top:8px;color:var(--gold);font-size:.9rem;">${warn}</div>` : '');
        status.className = 'verify-status';
      } else if(info.error === 'not_found'){
        status.innerHTML = '❌ මේ UID එක හොයාගන්න බැරි උනා. UID එක නිවැරදිද බලන්න.';
        status.className = 'verify-status err';
      } else {
        status.innerHTML = '⚠️ Verify කරන්න බැරි උනා (සේවාව දැනට වැඩ නැහැ). තත්පර කීපයකින් නැවත "Verify" එබුවම බලන්න.';
        status.className = 'verify-status err';
      }
      return;
    }
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
/* typing in the UID box: drop any old verification and (when the live lookup is on) verify automatically */
function onUidInput(){
  const box = document.getElementById('uidInput');
  if(box){ const clean = box.value.replace(/\D/g, ''); if(clean !== box.value) box.value = clean; }   // spaces / letters are removed as you type
  uidVerified = false; verifiedPlayerName = ""; verifiedLevel = null; verifiedPlayerRegion = "";
  const status = document.getElementById('verifyStatus'); if(status){ status.innerHTML = ''; status.className = 'verify-status'; }
  clearTimeout(uidAutoTimer);
  const uid = document.getElementById('uidInput').value.replace(/\D/g, '');
  if(typeof PLAYER_INFO_URL !== 'undefined' && PLAYER_INFO_URL && /^\d{8,12}$/.test(uid)){
    uidAutoTimer = setTimeout(verifyUID, 800);
  }
}
/* move the region picker to the account's real server (used after the UID lookup) */
function autoSwitchFFRegion(value){
  const sel = document.getElementById('ffRegionSelect'); if(!sel) return;
  sel.value = value;
  try{ sessionStorage.setItem('ff_region', value); }catch(e){}
  onFFRegionChange();
  if(typeof updateRegionButton === 'function') updateRegionButton();
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

/* Charge the chosen wallet (incl. 0.75% for Bank Wallet) and save the order. If saving the order fails
   the wallet charge is rolled back. */
async function chargeWalletAndSaveOrder(baseOrder, payName, price){
  const type = walletTypeForPay(payName);
  const key = currentWalletKey();
  const c = calcCharge(price, payName);
  const newBal = await fsAdjustWallet(key, type, -c.total);   // throws code 'insufficient'
  try{
    await saveOrder(Object.assign({}, baseOrder, { status: 'Processing', walletType: type, processingFee: c.fee, totalCharged: c.total }));
  } catch(e){
    await fsAdjustWallet(key, type, c.total);
    throw e;
  }
  setCachedBalance(key, type, newBal);
  return { type, fee: c.fee, base: c.base, total: c.total, balance: newBal };
}
async function showInsufficient(msgEl, type){
  let bal = 0;
  try{ const b = await fsGetWalletBalances(currentWalletKey()); bal = type === 'bank' ? b.bank : b.ez; }catch(e){}
  const html = `❌ ${walletLabel(type)} balance එක ප්‍රමාණවත් නැහැ. Current balance: ${fmtRs(bal)}. <a href="wallet.html" style="color:var(--cyan);">Wallet Recharge කරන්න</a>`;
  if(msgEl){ msgEl.innerHTML = html; msgEl.className = 'verify-status err'; }
  else alert('❌ Wallet balance එක ප්‍රමාණවත් නැහැ.');
}

async function placeOrder(){
  if(isStoreClosed()){ alert('🛑 SakinduStore දැනට තාවකාලිකව වසා ඇත. පසුව try කරන්න.'); return; }
  const session = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  if(!session){ alert('⚠️ Order එකක් දාන්න කලින් Login / Sign Up වෙන්න ඕන.'); openAuth('login'); return; }
  const regionEl0 = document.getElementById('ffRegionSelect');
  if(regionEl0 && !isFFRegionAvailable(regionEl0.value)){
    alert('⚠️ මේ Region එක Coming Soon — SG/MY/LK region එකෙන් order කරන්න.');
    return;
  }
  const uid = document.getElementById('uidInput').value.replace(/\D/g, '');
  const orderMsg = document.getElementById('orderMsg');
  const receiptInput = document.getElementById('receiptFile');

  if(!uid){ alert('කරුණාකර UID එක type කරන්න.'); return; }
  if(!uidVerified){ alert('කරුණාකර UID එක verify කරන්න.'); return; }
  if(!selectedPkg){ alert('කරුණාකර package එකක් තෝරන්න.'); return; }
  saveUid(uid, verifiedPlayerName);
  const regionEl = document.getElementById('ffRegionSelect');
  const baseOrder = {
    id: Date.now(),
    uid, player: verifiedPlayerName, level: verifiedLevel, playerRegion: verifiedPlayerRegion,
    package: selectedPkg.label, amount: selectedPkg.price,
    payment: selectedPay, date: new Date().toLocaleString(),
    userPhone: session ? session.phone : null,
    region: regionEl ? regionEl.value : null
  };

  const submitBtn = document.querySelector('.order-panel .btn-block');
  if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Submitting...'; }

  try{
    if(walletTypeForPay(selectedPay)){
      try{
        const r = await chargeWalletAndSaveOrder(baseOrder, selectedPay, selectedPkg.price);
        renderWallet();
        const feeTxt = r.fee > 0 ? ` (${fmtRs(r.base)} + ${fmtRs(r.fee)} processing charge)` : '';
        if(orderMsg){
          orderMsg.innerHTML = `✅ ${walletLabel(r.type)} එකෙන් ${fmtRs(r.total)} deduct කළා${feeTxt}. Order එක Admin Approve කරනකම් "Processing" status එකේ පවතී.`;
          orderMsg.className = 'verify-status ok';
        } else {
          alert('✅ Wallet එකෙන් deduct කළා. Admin Approve කරනකම් Processing status එකේ පවතී.');
        }
      } catch(err){
        if(err && err.code === 'insufficient'){
          await showInsufficient(orderMsg, walletTypeForPay(selectedPay));
        } else { throw err; }
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
  updateTotalUI();
  const type = walletTypeForPay(selectedPay);
  if(type){
    receiptBlock.style.display = 'none';
    walletBlock.style.display = 'block';
    const balEl = document.getElementById('walletBalanceDisplay');
    const titleEl = document.getElementById('walletBalanceTitle');
    if(titleEl) titleEl.textContent = `ඔබේ ${walletLabel(type)} Balance එක`;
    const key = currentWalletKey();
    if(!key){
      if(balEl) balEl.innerHTML = '<a href="#" onclick="openAuth(\'login\');return false;" style="color:var(--cyan);font-size:.9rem;">Login to use Wallet</a>';
      return;
    }
    if(balEl) balEl.textContent = fmtRs(getWalletBalance(key, type));
    fsGetWalletBalances(key).then(b => {
      setCachedBalance(key, 'ez', b.ez); setCachedBalance(key, 'bank', b.bank);
      if(balEl) balEl.textContent = fmtRs(type === 'bank' ? b.bank : b.ez);
    });
  } else {
    receiptBlock.style.display = 'block';
    walletBlock.style.display = 'none';
  }
}

/* ---------- PIN RECEIPT (shown after a Redeem Pin purchase and from Order History) ---------- */
function showPinReceipt(r){
  let ov = document.getElementById('pinReceiptOverlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'pinReceiptOverlay'; ov.className = 'modal-overlay';
    ov.addEventListener('click', e => { if(e.target === ov) ov.classList.remove('show'); });
    document.body.appendChild(ov);
  }
  const rows = [
    ['Order No', '#' + r.orderNo], ['Date', r.date], ['Item', r.item],
    ['Price', fmtRs(r.amount)],
    r.fee ? ['Processing Charge (0.75%)', fmtRs(r.fee)] : null,
    ['Total Paid', fmtRs(r.total)], ['Payment', r.payment]
  ].filter(Boolean);
  const text = ['SakinduStore — Payment Receipt', ...rows.map(x => x[0] + ': ' + x[1]), 'Redeem Pin: ' + r.pinCode].join('\n');
  ov.innerHTML = `
    <div class="modal receipt-modal">
      <button class="close-x" onclick="document.getElementById('pinReceiptOverlay').classList.remove('show')">✕</button>
      <div class="receipt-head">🧾 <span>Payment Receipt</span></div>
      <div class="receipt-rows">${rows.map(x => `<div><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('')}</div>
      <div class="receipt-code-label">YOUR REDEEM PIN <small>(valid for ONE use only)</small></div>
      <div class="receipt-code" id="receiptCode">${r.pinCode}</div>
      <button class="btn btn-primary btn-block" onclick="copyText('${r.pinCode}', this)">📋 Copy Code</button>
      <a class="btn btn-ghost btn-block" style="margin-top:10px;display:block;text-align:center;white-space:normal;line-height:1.4;" href="shelltopup.html">🐚 Shell Topup එකේ Redeem කරන්න →</a>
      <button class="btn btn-ghost btn-block" style="margin-top:10px;" onclick="copyText(${JSON.stringify(text).replace(/"/g, '&quot;')}, this)">Copy full receipt</button>
      <p class="receipt-note">⚠️ මේ Code එක කාටවත් share කරන්න එපා. එක වරක් Redeem කළාම නැවත භාවිත කළ නොහැක.</p>
    </div>`;
  ov.classList.add('show');
}
function showPinReceiptForOrder(orderId){
  const o = ordersCache.find(x => x.id === orderId);
  if(!o || !o.pinCode) return;
  showPinReceipt({
    orderNo: o.id, date: o.date, item: o.package, amount: o.amount, fee: o.processingFee || 0,
    total: o.totalCharged || o.amount, payment: o.payment, pinCode: o.pinCode
  });
}
function copyText(text, btn){
  const done = () => { if(btn){ const t = btn.textContent; btn.textContent = 'Copied ✓'; setTimeout(()=>{ btn.textContent = t; }, 1500); } };
  if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(done, ()=>{ prompt('Copy:', text); }); }
  else { prompt('Copy:', text); }
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
        <div><strong>${o.package}</strong> — UID: ${o.uid}${o.player ? ' (' + o.player + ')' : ''}${o.region ? ' · ' + o.region : ''}</div>
        <div class="oid">${o.date} · ${o.payment}${o.processingFee ? ' · incl. ' + fmtRs(o.processingFee) + ' processing charge' : ''}</div>
        ${o.pinCode ? `<div class="pin-reveal">🔑 Redeem Pin: <strong>${o.pinCode}</strong> <button class="btn btn-ghost btn-sm" onclick="copyText('${o.pinCode}', this)">Copy</button> <button class="btn btn-primary btn-sm" onclick="showPinReceiptForOrder(${o.id})">🧾 Receipt</button></div>` : (o.pinDocId ? `<div class="oid">🔑 Admin Approve කළාම Redeem Pin එක මෙතන පෙන්වයි.</div>` : '')}
      </div>
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;justify-content:flex-end;">
        <div style="color:var(--gold);font-weight:700;">Rs. ${o.amount}</div>
        <div class="status-pill ${o.status==='Processing'?'status-pending':(o.status==='Rejected'?'status-rejected':'status-done')}">${o.status}</div>
        <div class="order-actions">
          <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="${waLink(STORE_WHATSAPP, `Hi, Order #${o.id} (${o.package}${o.uid && o.uid !== '-' ? ', UID ' + o.uid : ''}) ගැන.`)}">💬 Admin</a>
          ${canBuyAgain(o) ? `<a class="btn btn-ghost btn-sm" href="free-fire.html?uid=${encodeURIComponent(o.uid)}&pkg=${encodeURIComponent(o.package)}">🔁 Buy again</a>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

/* ---------- WhatsApp helpers ---------- */
const STORE_WHATSAPP = '94760627795';
function waNumber(phone){
  const d = String(phone || '').replace(/\D/g, '');
  if(d.startsWith('94')) return d;
  if(d.startsWith('0')) return '94' + d.slice(1);
  return d;
}
function waLink(phone, text){ return 'https://wa.me/' + waNumber(phone) + '?text=' + encodeURIComponent(text); }
/* Free Fire orders can be repeated with one tap (same UID + same package) */
function canBuyAgain(o){
  if(!o.region || !o.uid || o.uid === '-' || o.pinDocId) return false;
  return Object.keys(packageData).some(c => packageData[c].items.some(p => p.label === o.package))
      || Object.values(ffRegionPackagesCache).some(list => (list || []).some(p => p.label === o.package));
}

/* ---------- Saved Player IDs (this device) ---------- */
function getSavedUids(){ try{ return JSON.parse(localStorage.getItem('ff_saved_uids') || '[]'); }catch(e){ return []; } }
function saveUid(uid, name){
  if(!/^\d{8,12}$/.test(uid)) return;
  const list = getSavedUids().filter(x => x.uid !== uid);
  list.unshift({ uid, name: name || '' });
  try{ localStorage.setItem('ff_saved_uids', JSON.stringify(list.slice(0, 5))); }catch(e){}
  renderSavedUids();
}
function removeSavedUid(uid){
  try{ localStorage.setItem('ff_saved_uids', JSON.stringify(getSavedUids().filter(x => x.uid !== uid))); }catch(e){}
  renderSavedUids();
}
function useSavedUid(uid){
  const input = document.getElementById('uidInput'); if(!input) return;
  input.value = uid; onUidInput();
  if(!(typeof PLAYER_INFO_URL !== 'undefined' && PLAYER_INFO_URL)) verifyUID();
}
function renderSavedUids(){
  const box = document.getElementById('savedUids'); if(!box) return;
  const list = getSavedUids();
  box.innerHTML = list.length
    ? '<span class="saved-label">Saved IDs:</span> ' + list.map(x => `<span class="saved-chip"><button type="button" onclick="useSavedUid('${x.uid}')">${x.name ? x.name.replace(/[<>&"']/g, '') + ' · ' : ''}${x.uid}</button><i onclick="removeSavedUid('${x.uid}')" title="Remove">✕</i></span>`).join('')
    : '';
}
/* /free-fire.html?uid=...&pkg=...  (from "Buy again") — fill the UID and pick the package */
let buyAgainDone = false;
function applyBuyAgainParams(){
  if(buyAgainDone || !document.getElementById('pkgContainer')) return;
  const regionSel = document.getElementById('ffRegionSelect');
  if(!regionSel || !regionSel.options.length) return;        // region picker not ready yet — it calls us again when it is
  const q = new URLSearchParams(location.search);
  const uid = q.get('uid'), pkg = q.get('pkg');
  if(!uid && !pkg) { buyAgainDone = true; return; }
  buyAgainDone = true;
  if(uid){ const input = document.getElementById('uidInput'); if(input){ input.value = uid; onUidInput(); if(!(typeof PLAYER_INFO_URL !== 'undefined' && PLAYER_INFO_URL)) verifyUID(); } }
  if(pkg){
    const data = getFFPackageData();
    for(const cat of Object.keys(data)){
      const idx = data[cat].items.findIndex(p => p.label === pkg);
      if(idx >= 0){ selectPkg(cat, idx); const el = document.getElementById(`pkg-${cat}-${idx}`); if(el) el.scrollIntoView({ block:'center' }); break; }
    }
  }
}

/* ---------- WALLET (Firestore 'wallets' collection, doc ID = phone or 'guest') ---------- */
let walletsCache = {};       // EZ Cash / Redeem Wallet balances  { phone: number }
let bankWalletsCache = {};   // Bank Wallet balances              { phone: number }
async function refreshWalletsCache(){
  const all = await fsGetAllWalletDocs();
  walletsCache = {}; bankWalletsCache = {};
  Object.keys(all).forEach(k => { walletsCache[k] = all[k].ez; bankWalletsCache[k] = all[k].bank; });
}
function setCachedBalance(key, type, value){
  if(type === 'bank') bankWalletsCache[key] = value; else walletsCache[key] = value;
}
function currentWalletKey(){
  // Every wallet action requires login, so this only ever resolves to a real account's phone number.
  const session = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  return session ? session.phone : null;
}
function getWalletBalance(key, type){
  const k = key || currentWalletKey();
  if(!k) return 0;
  return (type === 'bank' ? bankWalletsCache[k] : walletsCache[k]) || 0;
}
async function creditUserWallet(key, amount, type){
  const newBal = await fsAdjustWallet(key, type || 'ez', amount);
  setCachedBalance(key, type || 'ez', newBal);
  return newBal;
}
function renderWallet(){
  const ez = document.getElementById('walletBalanceEz');
  const bank = document.getElementById('walletBalanceBank');
  const legacy = document.getElementById('walletBalance');
  const targets = [ez, bank, legacy].filter(Boolean);
  if(!targets.length) return;
  const session = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  if(!session){
    targets.forEach(el => { el.innerHTML = '<a href="#" onclick="openAuth(\'login\');return false;" style="color:var(--cyan);font-size:.85rem;">Login to view balance</a>'; });
    return;
  }
  if(ez) ez.textContent = fmtRs(getWalletBalance(session.phone, 'ez'));
  if(bank) bank.textContent = fmtRs(getWalletBalance(session.phone, 'bank'));
  if(legacy) legacy.textContent = fmtRs(getWalletBalance(session.phone, 'ez'));
}
let rechargeMethod = 'Bank Transfer';
function selectRechargeMethod(name, el){
  rechargeMethod = name;
  document.querySelectorAll('#rechargeMethodBox .pay-method').forEach(p => p.classList.remove('selected'));
  el.classList.add('selected');
  const note = document.getElementById('rechargeMethodNote');
  if(note) note.innerHTML = name === 'Bank Transfer'
    ? '🏦 Bank Transfer → <strong>Bank Wallet</strong> එකට add වේ. (Bank Wallet එකෙන් pay කරද්දී 0.75% Processing Charge එකක් එකතු වේ.)'
    : '📱 Ez Cash → <strong>EZ Cash / Redeem Wallet</strong> එකට add වේ. (Extra charge නැහැ.)';
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

  const walletType = rechargeMethod === 'Bank Transfer' ? 'bank' : 'ez';
  const btn = document.getElementById('rechargeSubmitBtn');
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
      method: rechargeMethod, walletType,
      status: 'Pending', date: new Date().toLocaleString()
    });
    status.innerHTML = `✅ Request එක submit උනා! Admin Approve කරනකම් "Pending" තියේවි — Approve වුනාම Rs. ${amount} ඔබේ ${walletLabel(walletType)} එකට add වේ.`;
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
const defaultRedeemCodes = {
  "SAKINDU100": { amount: 100, category: "normal", maxUses: 0, usedCount: 0 },
  "FREEFIRE50": { amount: 50, category: "normal", maxUses: 0, usedCount: 0 },
  "WELCOME200": { amount: 200, category: "giveaway", maxUses: 30, usedCount: 0 },
};
const REDEEM_DAILY_LIMITS = { giveaway: 1, normal: 10 };
let redeemCodesCache = {};
async function refreshRedeemCodesCache(){
  redeemCodesCache = await fsGetConfig('redeemCodes', defaultRedeemCodes);
}
function todayStr(){
  return new Date().toISOString().slice(0,10); // YYYY-MM-DD
}
async function redeemCode(){
  const code = document.getElementById('redeemInput').value.trim().toUpperCase();
  const status = document.getElementById('redeemStatus');
  const session = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  if(!session){ status.textContent = '⚠️ Redeem කරන්න කලින් Login / Sign Up වෙන්න ඕන.'; status.className = 'verify-status'; openAuth('login'); return; }
  if(!code){ status.textContent = 'Code එකක් type කරන්න.'; status.className='verify-status'; return; }

  const entry = redeemCodesCache[code];
  if(!entry){ status.textContent = '❌ Invalid redeem code.'; status.className = 'verify-status'; return; }

  const key = currentWalletKey();
  try{
    const wdoc = await fsGetWalletDoc(key);
    const redeemedList = wdoc.redeemedCodes || [];
    if(redeemedList.includes(code)){
      status.textContent = '⚠️ මේ code එක කලින් redeem කරලා තියෙනවා.';
      status.className = 'verify-status';
      return;
    }
    if(entry.maxUses && entry.usedCount >= entry.maxUses){
      status.textContent = '⚠️ මේ code එකේ use limit එක ඉවරයි.';
      status.className = 'verify-status';
      return;
    }
    const category = entry.category || 'normal';
    const limit = REDEEM_DAILY_LIMITS[category] || REDEEM_DAILY_LIMITS.normal;
    const today = todayStr();
    const dateField = category === 'giveaway' ? 'redeemGiveawayDate' : 'redeemNormalDate';
    const countField = category === 'giveaway' ? 'redeemGiveawayCount' : 'redeemNormalCount';
    const usedToday = (wdoc[dateField] === today) ? (wdoc[countField] || 0) : 0;
    if(usedToday >= limit){
      status.textContent = category === 'giveaway'
        ? '⚠️ දවසකට Giveaway code 1ක් විතරයි redeem කරන්න පුළුවන් — හෙට try කරන්න.'
        : `⚠️ දවසකට Normal codes ${limit}ක් redeem කරලා ඉවරයි — හෙට try කරන්න.`;
      status.className = 'verify-status';
      return;
    }

    await creditUserWallet(key, entry.amount);
    await fsMergeWalletDoc(key, {
      redeemedCodes: [...redeemedList, code],
      [dateField]: today,
      [countField]: usedToday + 1
    });
    entry.usedCount = (entry.usedCount || 0) + 1;
    await fsSetConfig('redeemCodes', redeemCodesCache);

    status.textContent = `✅ Rs. ${entry.amount} ඔබේ EZ Cash / Redeem Wallet එකට add උනා!`;
    status.className = 'verify-status ok';
    renderWallet();
  } catch(err){
    console.error('[SakinduStore] redeemCode error', err);
    status.innerHTML = `❌ Redeem කරන්න බැරි උනා.<br><span style="font-size:.8rem;opacity:.8;">${(err && err.message) ? err.message : err}</span>`;
    status.className = 'verify-status err';
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
          <div><strong>Wallet Recharge</strong> <small style="color:var(--muted);">${r.method ? '· ' + r.method + ' → ' + walletLabel(r.walletType) : ''}</small></div>
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
    const avatarHtml = isImgToken(r.avatar)
      ? `<img class="lb-avatar" data-img-token="${r.avatar}" alt="${r.name}" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==">`
      : r.avatar
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
  // profile pictures live in the images database — fill them in for the (max 10) rows shown
  el.querySelectorAll('img[data-img-token]').forEach(async img => {
    try{ const u = await fsLoadImage(img.getAttribute('data-img-token')); if(u) img.src = u; }catch(e){}
  });
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
/* The login / sign-up modal used to exist only on index.html, so openAuth() crashed on every other page.
   It is now injected on demand so it works everywhere (wallet page, game pages, pin shop...). */
function ensureAuthModal(){
  if(document.getElementById('authOverlay')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
<div class="modal-overlay" id="authOverlay">
  <div class="modal">
    <button class="close-x" onclick="closeAuth()">✕</button>
    <h3 id="authTitle">Login</h3>
    <p class="modal-sub" id="authSub">ඔබේ account එකට login වෙන්න</p>
    <input type="text" id="authName" placeholder="Name" style="display:none;">
    <div id="authAvatarRow" style="display:none;text-align:center;margin-bottom:14px;">
      <div id="authAvatarPreview" style="width:70px;height:70px;border-radius:50%;background:var(--bg-panel-2);border:1px solid var(--line);margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-size:1.6rem;overflow:hidden;">👤</div>
      <input type="file" id="authAvatarFile" accept="image/*" style="display:none;" onchange="previewAuthAvatar()">
      <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('authAvatarFile').click()">📷 Profile Image (optional)</button>
    </div>
    <input type="email" id="authEmail" placeholder="Email Address" style="display:none;">
    <input type="text" id="authPhone" placeholder="Phone Number">
    <input type="password" id="authPass" placeholder="Password">
    <label id="authAgeRow" class="age-check" style="display:none;"><input type="checkbox" id="authAge"> <span>මම අවුරුදු 18ට වඩා වැඩියි (18+). Top-up කරන්න පුළුවන් අවුරුදු 18ට වැඩි අයට පමණයි.</span></label>
    <button class="btn btn-primary btn-block" onclick="submitAuth()">Continue</button>
    <div id="authMsg" class="verify-status"></div>
    <div class="modal-switch" id="authSwitch">Account එකක් නැද්ද? <a href="#" onclick="toggleAuthMode();return false;">Sign Up</a></div>
  </div>
</div>`;
  document.body.appendChild(wrap.firstElementChild);
}
function openAuth(mode){
  ensureAuthModal();
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
  const ageRow = document.getElementById('authAgeRow');
  if(ageRow) ageRow.style.display = isLogin ? 'none' : 'flex';
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
  const ageEl = document.getElementById('authAge');
  if(authMode === 'signup' && ageEl && !ageEl.checked){ msg.textContent = '⚠️ SakinduStore භාවිතා කළ හැක්කේ අවුරුදු 18ට වැඩි අයට පමණයි — 18+ බව confirm කරන්න.'; msg.className='verify-status'; return; }

  const submitBtn = document.querySelector('#authOverlay .btn-block');
  if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Please wait...'; }
  msg.textContent = '';
  msg.className = 'verify-status';

  try{
    const existing = await fsGetUser(phone);
    if(authMode === 'signup'){
      if(existing){ msg.textContent = 'මේ number එකෙන් කලින් account එකක් තියෙනවා.'; msg.className='verify-status'; return; }
      const userData = { name: name || 'Player', email, pass, avatar: pendingAvatar || null, ageConfirmed18: true };
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
  {slug:'free-fire', name:'FREE FIRE', desc:'Diamonds, Weekly/Monthly Membership, Level Up Pass — multiple regions', status:'active', imgVar:'IMG_FREEFIRE', link:'free-fire.html', region:'12 Regions'},
  {slug:'shelltopup-free-fire', name:'Shelltopup Free Fire', desc:'Pay with Shells — Diamonds, Memberships, Level Up Pass', status:'active', imgVar:'IMG_FREEFIRE', link:'shelltopup.html', region:'Shell Topup'},
  {slug:'codm', name:'CALL OF DUTY MOBILE', desc:'CP top-up coming soon', status:'coming-soon', imgVar:'IMG_CODM', link:'codm.html', region:'2 Regions'},
  {slug:'bloodstrike', name:'BLOOD STRIKE', desc:'Gold top-up coming soon', status:'coming-soon', imgVar:'IMG_BLOODSTRIKE', link:'bloodstrike.html', region:'Global'},
  {slug:'ff-likes', name:'FF Profile Likes', desc:'Free Fire profile likes boost', status:'coming-soon', imgVar:'IMG_FFLIKES', link:'ff-likes.html', ffVerify:true},
  {slug:'delta-force-pc', name:'Delta Force (PC)', desc:'', status:'coming-soon', imgVar:'IMG_DELTAFORCE', link:'delta-force-pc.html', region:'Global'},
  {slug:'minecraft', name:'Minecraft', desc:'', status:'coming-soon', imgVar:'IMG_MINECRAFT', link:'minecraft.html'},
  {slug:'mobile-legends', name:'Mobile Legend', desc:'', status:'coming-soon', imgVar:'IMG_MOBILELEGENDS', link:'mobile-legends.html', region:'9 Regions', fieldType:'dual', field1Label:'User ID', field2Label:'Zone ID'},
  {slug:'where-winds-meet', name:'Where Winds Meet', desc:'', status:'coming-soon', imgVar:'IMG_WHEREWINDSMEET', link:'where-winds-meet.html', region:'Global'},
  {slug:'pubgm', name:'PUBG Mobile', desc:'', status:'coming-soon', imgVar:'IMG_PUBGM', link:'pubgm.html', region:'Global'},
  {slug:'valorant-sg-pc', name:'Valorant SG (PC)', desc:'', status:'coming-soon', imgVar:'IMG_VALORANT', link:'valorant-sg-pc.html', region:'7 Regions'},
  {slug:'garena-undown', name:'Garena Undown', desc:'', status:'coming-soon', imgVar:'IMG_GARENAUNDYING', link:'garena-undown.html', region:'Global'},
  {slug:'honor-of-kings', name:'Honor Of King', desc:'', status:'coming-soon', imgVar:'IMG_HONOROFKINGS', link:'honor-of-kings.html', region:'Global'},
  {slug:'asphalt9', name:'Asphalt 9 (Android)', desc:'', status:'coming-soon', imgVar:'IMG_ASPHALT9', link:'asphalt9.html', region:'Global'},
  {slug:'farlight84', name:'Farlight84', desc:'', status:'coming-soon', imgVar:'IMG_FARLIGHT84', link:'farlight84.html', region:'Global'},
  {slug:'8-ball-pool', name:'8 Ball Pool', desc:'', status:'coming-soon', imgVar:'IMG_8BALLPOOL', link:'8-ball-pool.html', region:'Global'},
  {slug:'state-of-survival', name:'State Of Survival', desc:'', status:'coming-soon', imgVar:'IMG_STATEOFSURVIVAL', link:'state-of-survival.html', region:'Global'},
  {slug:'whiteout-survival', name:'Whiteout Survival', desc:'', status:'coming-soon', imgVar:'IMG_WHITEOUTSURVIVAL', link:'whiteout-survival.html', region:'Global'},
  {slug:'teen-patti-gold', name:'Teen Patti Gold', desc:'', status:'coming-soon', imgVar:'IMG_TEENPATTIGOLD', link:'teen-patti-gold.html', region:'Global'},
  {slug:'garena-my-shells', name:'Garena MY Shells', desc:'', status:'coming-soon', imgVar:'IMG_GARENASHELLS', link:'garena-my-shells.html', fieldType:'email'},
  {slug:'arena-breakout', name:'Arena Breakout', desc:'', status:'coming-soon', imgVar:'IMG_ARENABREAKOUT', link:'arena-breakout.html', region:'Global'},
  {slug:'rainbow-six-mobile', name:'Rainbow Six Mobile', desc:'', status:'coming-soon', link:'rainbow-six-mobile.html', region:'Global'},
  {slug:'clash-of-clans', name:'Clash Of Clans', desc:'', status:'coming-soon', imgVar:'IMG_CLASHOFCLANS', link:'clash-of-clans.html'},
  {slug:'genshin-impact', name:'Genshin Impact', desc:'', status:'coming-soon', link:'genshin-impact.html', region:'2 Regions'},
  {slug:'honkai-impact-3rd', name:'Honkai Impact 3rd', desc:'', status:'coming-soon', link:'honkai-impact-3rd.html', region:'Global'},
  {slug:'honkai-star-rail', name:'Honkai Star Rail', desc:'', status:'coming-soon', link:'honkai-star-rail.html', region:'Global'},
  {slug:'zenless-zone-zero', name:'Zenless Zone Zero', desc:'', status:'coming-soon', link:'zenless-zone-zero.html', region:'Global'},
  {slug:'mobile-legends-adventure', name:'Mobile Legends Adventure', desc:'', status:'coming-soon', link:'mobile-legends-adventure.html'},
  {slug:'league-of-legends-pc', name:'League of Legends PC', desc:'', status:'coming-soon', link:'league-of-legends-pc.html', region:'4 Regions'},
  {slug:'league-of-legends-wild-rift', name:'League of Legends Wild Rift', desc:'', status:'coming-soon', link:'league-of-legends-wild-rift.html', region:'4 Regions'},
  {slug:'teamfight-tactics', name:'Teamfight Tactics', desc:'', status:'coming-soon', link:'teamfight-tactics.html', region:'4 Regions'},
  {slug:'identity-v', name:'Identity V', desc:'', status:'coming-soon', link:'identity-v.html', region:'Global'},
  {slug:'tower-of-fantasy', name:'Tower of Fantasy', desc:'', status:'coming-soon', link:'tower-of-fantasy.html', region:'Global'},
  {slug:'wuthering-waves', name:'Wuthering Waves', desc:'', status:'coming-soon', link:'wuthering-waves.html', region:'Global'},
  {slug:'stumble-guys', name:'Stumble Guys', desc:'', status:'coming-soon', link:'stumble-guys.html', region:'Global'},
  {slug:'pokemon-unite', name:'Pokemon Unite', desc:'', status:'coming-soon', link:'pokemon-unite.html', region:'4 Regions'},
  {slug:'punishing-gray-raven', name:'Punishing: Gray Raven', desc:'', status:'coming-soon', link:'punishing-gray-raven.html', region:'Global'},
  {slug:'ragnarok-m-classic', name:'Ragnarok M Classic', desc:'', status:'coming-soon', link:'ragnarok-m-classic.html', region:'Global'},
  {slug:'ragnarok-origin', name:'Ragnarok Origin', desc:'', status:'coming-soon', link:'ragnarok-origin.html', region:'Global'},
  {slug:'maplestory-m', name:'MapleStory M', desc:'', status:'coming-soon', link:'maplestory-m.html', region:'Global'},
  {slug:'lineage-w', name:'Lineage W', desc:'', status:'coming-soon', link:'lineage-w.html', region:'Global'},
  {slug:'afk-journey', name:'AFK Journey', desc:'', status:'coming-soon', link:'afk-journey.html', region:'Global'},
  {slug:'ea-sports-fc-mobile', name:'EA Sports FC Mobile', desc:'', status:'coming-soon', link:'ea-sports-fc-mobile.html', region:'3 Regions'},
  {slug:'growtopia', name:'Growtopia', desc:'', status:'coming-soon', link:'growtopia.html', region:'Global'},
  {slug:'eggy-party', name:'Eggy Party', desc:'', status:'coming-soon', link:'eggy-party.html', region:'Global'},
  {slug:'marvel-rivals', name:'Marvel Rivals', desc:'', status:'coming-soon', link:'marvel-rivals.html', region:'Global'},
  {slug:'mecha-break', name:'Mecha Break', desc:'', status:'coming-soon', link:'mecha-break.html', region:'Global'},
  {slug:'once-human', name:'Once Human', desc:'', status:'coming-soon', link:'once-human.html', region:'Global'},
  {slug:'roblox', name:'Roblox', desc:'', status:'coming-soon', imgVar:'IMG_ROBLOX', link:'roblox.html', region:'Global'},
  {slug:'modern-strike-online', name:'Modern Strike Online', desc:'', status:'coming-soon', link:'modern-strike-online.html', region:'Global'},
  {slug:'modern-warships-naval-battle', name:'Modern Warships: Naval Battle', desc:'', status:'coming-soon', link:'modern-warships-naval-battle.html', region:'Global'},
  {slug:'mongil-star-dive', name:'Mongil Star Dive', desc:'', status:'coming-soon', link:'mongil-star-dive.html', region:'Global'},
  {slug:'monster-hunter-outlanders', name:'Monster Hunter Outlanders', desc:'', status:'coming-soon', imgVar:'IMG_MONSTERHUNTER', link:'monster-hunter-outlanders.html', region:'Malaysia'},
  {slug:'moonlight-blade-m', name:'Moonlight Blade M', desc:'', status:'coming-soon', link:'moonlight-blade-m.html', region:'Global'},
  {slug:'my-singing-monsters', name:'My Singing Monsters', desc:'', status:'coming-soon', link:'my-singing-monsters.html', region:'Global'},
  {slug:'neverness-to-everness', name:'Neverness to Everness', desc:'', status:'coming-soon', link:'neverness-to-everness.html', region:'Global'},
  {slug:'one-punch-man-the-strongest', name:'One Punch Man: The Strongest', desc:'', status:'coming-soon', link:'one-punch-man-the-strongest.html', region:'Southeast Asia'},
  {slug:'onmyoji-arena', name:'Onmyoji Arena', desc:'', status:'coming-soon', link:'onmyoji-arena.html', region:'Global'},
  {slug:'overmortal-idle', name:'Overmortal Idle', desc:'', status:'coming-soon', link:'overmortal-idle.html', region:'2 Regions'},
  {slug:'oxide-survival-island', name:'Oxide: Survival Island', desc:'', status:'coming-soon', link:'oxide-survival-island.html', region:'Global'},
  {slug:'pago-live', name:'Pago Live', desc:'', status:'coming-soon', link:'pago-live.html', region:'Global'},
  {slug:'path-to-nowhere', name:'Path to Nowhere', desc:'', status:'coming-soon', link:'path-to-nowhere.html', region:'Global'},
  {slug:'pixel-gun-3d', name:'Pixel Gun 3D', desc:'', status:'coming-soon', link:'pixel-gun-3d.html', region:'Global'},
  {slug:'poppo-live', name:'Poppo Live', desc:'', status:'coming-soon', link:'poppo-live.html', region:'Global'},
  {slug:'poppo-live-2', name:'Poppo Live 2', desc:'', status:'coming-soon', link:'poppo-live-2.html', region:'Global'},
  {slug:'project-entropy', name:'Project Entropy', desc:'', status:'coming-soon', link:'project-entropy.html', region:'Global'},
  {slug:'puzzles-and-survival', name:'Puzzles and Survival', desc:'', status:'coming-soon', link:'puzzles-and-survival.html', region:'Global'},
  {slug:'racing-master', name:'Racing Master', desc:'', status:'coming-soon', link:'racing-master.html', region:'Southeast Asia'},
  {slug:'racing-master-latam', name:'Racing Master LATAM', desc:'', status:'coming-soon', link:'racing-master-latam.html', region:'Latin America'},
  {slug:'ace-racer', name:'Ace Racer', desc:'', status:'coming-soon', link:'ace-racer.html', region:'2 Regions'},
  {slug:'acecraft', name:'Acecraft', desc:'', status:'coming-soon', link:'acecraft.html', region:'Global'},
  {slug:'age-of-empires-mobile', name:'Age of Empires Mobile', desc:'', status:'coming-soon', link:'age-of-empires-mobile.html', region:'Global'},
  {slug:'aniimo', name:'Aniimo', desc:'', status:'coming-soon', link:'aniimo.html', region:'Global'},
  {slug:'arena-of-valor-rov', name:'Arena of Valor / RoV', desc:'', status:'coming-soon', link:'arena-of-valor-rov.html', region:'Thailand'},
  {slug:'arknight-endfield', name:'Arknight: Endfield', desc:'', status:'coming-soon', link:'arknight-endfield.html', region:'Global'},
  {slug:'astra-knights-of-veda', name:'Astra: Knights of Veda', desc:'', status:'coming-soon', link:'astra-knights-of-veda.html', region:'Global'},
  {slug:'astral-guardians-cyber-fate', name:'Astral Guardians: Cyber Fate', desc:'', status:'coming-soon', link:'astral-guardians-cyber-fate.html', region:'Global'},
  {slug:'azur-lane', name:'Azur Lane', desc:'', status:'coming-soon', link:'azur-lane.html', region:'Global'},
  {slug:'bleach-soul-resonance', name:'Bleach Soul Resonance', desc:'', status:'coming-soon', link:'bleach-soul-resonance.html', region:'2 Regions'},
  {slug:'be-the-king', name:'Be The King', desc:'', status:'coming-soon', link:'be-the-king.html', region:'3 Regions'},
  {slug:'bigo-live', name:'Bigo Live', desc:'', status:'coming-soon', link:'bigo-live.html', region:'Global'},
  {slug:'black-clover-m-asia', name:'Black Clover M Asia', desc:'', status:'coming-soon', link:'black-clover-m-asia.html', region:'Global'},
  {slug:'blockman-go', name:'Blockman Go', desc:'', status:'coming-soon', link:'blockman-go.html', region:'Global'},
  {slug:'cats-crash-arena-turbo-stars', name:'Cats: Crash Arena Turbo Stars', desc:'', status:'coming-soon', link:'cats-crash-arena-turbo-stars.html', region:'Global'},
  {slug:'chamet', name:'Chamet', desc:'', status:'coming-soon', link:'chamet.html', region:'Global'},
  {slug:'civilization-eras-allies', name:'Civilization: Eras & Allies', desc:'', status:'coming-soon', link:'civilization-eras-allies.html', region:'Global'},
  {slug:'cooking-adventure', name:'Cooking Adventure', desc:'', status:'coming-soon', link:'cooking-adventure.html', region:'Global'},
  {slug:'crossfire-legend', name:'Crossfire: Legend', desc:'', status:'coming-soon', link:'crossfire-legend.html', region:'Global'},
  {slug:'crossout-mobile', name:'Crossout Mobile', desc:'', status:'coming-soon', link:'crossout-mobile.html', region:'Global'},
  {slug:'crystal-of-atlan', name:'Crystal of Atlan', desc:'', status:'coming-soon', link:'crystal-of-atlan.html', region:'Global'},
  {slug:'delta-force-garena', name:'Delta Force Garena', desc:'', status:'coming-soon', link:'delta-force-garena.html', region:'2 Regions'},
  {slug:'destiny-rising', name:'Destiny: Rising', desc:'', status:'coming-soon', link:'destiny-rising.html', region:'Global'},
  {slug:'dragon-nest-m-classic', name:'Dragon Nest M: Classic', desc:'', status:'coming-soon', link:'dragon-nest-m-classic.html', region:'Southeast Asia'},
  {slug:'dragon-raja', name:'Dragon Raja', desc:'', status:'coming-soon', link:'dragon-raja.html', region:'2 Regions'},
  {slug:'dragonheir-silent-gods', name:'Dragonheir: Silent Gods', desc:'', status:'coming-soon', link:'dragonheir-silent-gods.html', region:'Global'},
  {slug:'duet-night-abyss', name:'Duet Night Abyss', desc:'', status:'coming-soon', link:'duet-night-abyss.html', region:'Global'},
  {slug:'dunk-city-dynasty', name:'Dunk City Dynasty', desc:'', status:'coming-soon', link:'dunk-city-dynasty.html', region:'Philippines'},
  {slug:'dynasty-heroes-legend-samkok', name:'Dynasty Heroes: Legend Samkok', desc:'', status:'coming-soon', link:'dynasty-heroes-legend-samkok.html', region:'Global'},
  {slug:'echocalypse-scarlet-covenant', name:'Echocalypse: Scarlet Covenant', desc:'', status:'coming-soon', link:'echocalypse-scarlet-covenant.html', region:'Global'},
  {slug:'enhypen', name:'Enhypen', desc:'', status:'coming-soon', link:'enhypen.html', region:'Global'},
  {slug:'etheria-restart', name:'Etheria Restart', desc:'', status:'coming-soon', link:'etheria-restart.html', region:'Global'},
  {slug:'eve-echoes', name:'EVE Echoes', desc:'', status:'coming-soon', link:'eve-echoes.html', region:'Global'},
  {slug:'football-master-2', name:'Football Master 2', desc:'', status:'coming-soon', link:'football-master-2.html', region:'Global'},
  {slug:'last-hunter-k-seoul', name:'Last Hunter K: Seoul', desc:'', status:'coming-soon', link:'last-hunter-k-seoul.html', region:'Global'},
  {slug:'life-makeover', name:'Life Makeover', desc:'', status:'coming-soon', link:'life-makeover.html', region:'Global'},
  {slug:'lifeafter', name:'LifeAfter', desc:'', status:'coming-soon', link:'lifeafter.html', region:'Global'},
  {slug:'light-of-thel-new-era', name:'Light of Thel: New Era', desc:'', status:'coming-soon', link:'light-of-thel-new-era.html', region:'Global'},
  {slug:'likee', name:'Likee', desc:'', status:'coming-soon', link:'likee.html', region:'Global'},
  {slug:'lita', name:'Lita', desc:'', status:'coming-soon', link:'lita.html', region:'Global'},
  {slug:'livu', name:'LivU', desc:'', status:'coming-soon', link:'livu.html', region:'Global'},
  {slug:'love-nikki', name:'Love Nikki', desc:'', status:'coming-soon', link:'love-nikki.html', region:'Global'},
  {slug:'love-and-deepspace', name:'Love and Deepspace', desc:'', status:'coming-soon', link:'love-and-deepspace.html', region:'Global'},
  {slug:'mu-origin-2', name:'MU Origin 2', desc:'', status:'coming-soon', link:'mu-origin-2.html', region:'Global'},
  {slug:'mu-origin-3', name:'MU Origin 3', desc:'', status:'coming-soon', link:'mu-origin-3.html', region:'Southeast Asia'},
  {slug:'magic-chess', name:'Magic Chess', desc:'', status:'coming-soon', link:'magic-chess.html', region:'6 Regions'},
  {slug:'marvel-duel', name:'Marvel Duel', desc:'', status:'coming-soon', link:'marvel-duel.html', region:'Global'},
  {slug:'marvel-mystic-mayhem', name:'Marvel Mystic Mayhem', desc:'', status:'coming-soon', link:'marvel-mystic-mayhem.html', region:'Global'},
  {slug:'metal-slug-awakening', name:'Metal Slug: Awakening', desc:'', status:'coming-soon', link:'metal-slug-awakening.html', region:'Global'},
  {slug:'mico-live', name:'Mico Live', desc:'', status:'coming-soon', link:'mico-live.html', region:'Global'},
  {slug:'mobile-legend-2', name:'Mobile Legend 2', desc:'', status:'coming-soon', link:'mobile-legend-2.html', region:'Malaysia'},
  {slug:'mobile-legend-special', name:'Mobile Legend Special', desc:'', status:'coming-soon', link:'mobile-legend-special.html', region:'Malaysia'},
  {slug:'ragnarok-idle-adventure', name:'Ragnarok Idle Adventure', desc:'', status:'coming-soon', link:'ragnarok-idle-adventure.html', region:'Global'},
  {slug:'ragnarok-x-next-generation', name:'Ragnarok X: Next Generation', desc:'', status:'coming-soon', link:'ragnarok-x-next-generation.html', region:'Global'},
  {slug:'rememento-white-shadows', name:'Rememento: White Shadows', desc:'', status:'coming-soon', link:'rememento-white-shadows.html', region:'Global'},
  {slug:'revelation-infinite-journey', name:'Revelation: Infinite Journey', desc:'', status:'coming-soon', link:'revelation-infinite-journey.html', region:'Global'},
  {slug:'rotaeno', name:'Rotaeno', desc:'', status:'coming-soon', link:'rotaeno.html', region:'Global'},
  {slug:'saint-seiya-awakening', name:'Saint Seiya Awakening', desc:'', status:'coming-soon', link:'saint-seiya-awakening.html', region:'Southeast Asia'},
  {slug:'shining-nikki', name:'Shining Nikki', desc:'', status:'coming-soon', link:'shining-nikki.html', region:'Global'},
  {slug:'silver-and-blood', name:'Silver and Blood', desc:'', status:'coming-soon', link:'silver-and-blood.html', region:'Global'},
  {slug:'sky-children-of-the-light', name:'Sky Children of the Light', desc:'', status:'coming-soon', link:'sky-children-of-the-light.html', region:'Global'},
  {slug:'snowbreak-containment-zone', name:'Snowbreak: Containment Zone', desc:'', status:'coming-soon', link:'snowbreak-containment-zone.html', region:'Global'},
  {slug:'soul-land-new-world', name:'Soul Land: New World', desc:'', status:'coming-soon', link:'soul-land-new-world.html', region:'Global'},
  {slug:'soulchill', name:'Soulchill', desc:'', status:'coming-soon', link:'soulchill.html', region:'Global'},
  {slug:'spring-valley-farm-adventure', name:'Spring Valley: Farm Adventure', desc:'', status:'coming-soon', link:'spring-valley-farm-adventure.html', region:'Global'},
  {slug:'star-resonance', name:'Star Resonance', desc:'', status:'coming-soon', link:'star-resonance.html', region:'Global'},
  {slug:'starfall-fantasy-neverland', name:'Starfall Fantasy: Neverland', desc:'', status:'coming-soon', link:'starfall-fantasy-neverland.html', region:'Southeast Asia'},
  {slug:'starmaker', name:'Starmaker', desc:'', status:'coming-soon', link:'starmaker.html', region:'Global'},
  {slug:'stella-sora', name:'Stella Sora', desc:'', status:'coming-soon', link:'stella-sora.html', region:'Global'},
  {slug:'stormshot', name:'Stormshot', desc:'', status:'coming-soon', link:'stormshot.html', region:'Global'},
  {slug:'super-sus', name:'Super Sus', desc:'', status:'coming-soon', link:'super-sus.html', region:'Global'},
  {slug:'gangstar-mirage-city', name:'Gangstar Mirage City', desc:'', status:'coming-soon', link:'gangstar-mirage-city.html', region:'Global'},
  {slug:'garena-delta-force', name:'Garena Delta Force', desc:'', status:'coming-soon', link:'garena-delta-force.html', region:'Latin America'},
  {slug:'ghost-story-love-destiny', name:'Ghost Story: Love Destiny', desc:'', status:'coming-soon', link:'ghost-story-love-destiny.html', region:'Global'},
  {slug:'goddess-of-victory-nikke', name:'Goddess of Victory: Nikke', desc:'', status:'coming-soon', link:'goddess-of-victory-nikke.html', region:'Global'},
  {slug:'golden-spatula', name:'Golden Spatula', desc:'', status:'coming-soon', link:'golden-spatula.html', region:'Global'},
  {slug:'hago', name:'Hago', desc:'', status:'coming-soon', link:'hago.html', region:'Global'},
  {slug:'haikyu-fly-high', name:'Haikyu Fly High', desc:'', status:'coming-soon', imgVar:'IMG_HAIKYU', link:'haikyu-fly-high.html', region:'Garena MY UID'},
  {slug:'harry-potter-magic-awakened', name:'Harry Potter Magic Awakened', desc:'', status:'coming-soon', link:'harry-potter-magic-awakened.html', region:'2 Regions'},
  {slug:'hatsune-miku', name:'Hatsune Miku', desc:'', status:'coming-soon', link:'hatsune-miku.html', region:'Global'},
  {slug:'heartopia', name:'Heartopia', desc:'', status:'coming-soon', link:'heartopia.html', region:'Global'},
  {slug:'heaven-burns-red', name:'Heaven Burns Red', desc:'', status:'coming-soon', link:'heaven-burns-red.html', region:'Global'},
  {slug:'hero-clash', name:'Hero Clash', desc:'', status:'coming-soon', link:'hero-clash.html', region:'Global'},
  {slug:'higgs-games-island', name:'Higgs Games Island', desc:'', status:'coming-soon', link:'higgs-games-island.html', region:'Global'},
  {slug:'king-of-avalon', name:'King of Avalon', desc:'', status:'coming-soon', link:'king-of-avalon.html', region:'2 Regions'},
  {slug:'kings-choice', name:'Kings Choice', desc:'', status:'coming-soon', link:'kings-choice.html', region:'Southeast Asia'},
  {slug:'kingshot', name:'Kingshot', desc:'', status:'coming-soon', link:'kingshot.html', region:'Global'},
  {slug:'kurokos-basketball-sr', name:'Kurokos Basketball SR', desc:'', status:'coming-soon', link:'kurokos-basketball-sr.html', region:'Southeast Asia'},
  {slug:'sword-of-justice', name:'Sword of Justice', desc:'', status:'coming-soon', link:'sword-of-justice.html', region:'3 Regions'},
  {slug:'t3-arena', name:'T3 Arena', desc:'', status:'coming-soon', link:'t3-arena.html', region:'Global'},
  {slug:'tarisland', name:'Tarisland', desc:'', status:'coming-soon', link:'tarisland.html', region:'Asia'},
  {slug:'the-ants', name:'The Ants', desc:'', status:'coming-soon', link:'the-ants.html', region:'Global'},
  {slug:'the-division-resurgence', name:'The Division Resurgence', desc:'', status:'coming-soon', link:'the-division-resurgence.html', region:'Global'},
  {slug:'tiktok-douyin-diamonds', name:'TikTok Douyin Diamonds', desc:'', status:'coming-soon', link:'tiktok-douyin-diamonds.html', region:'China'},
  {slug:'tom-and-jerry-chase', name:'Tom and Jerry: Chase', desc:'', status:'coming-soon', link:'tom-and-jerry-chase.html', region:'2 Regions'},
  {slug:'tomb-busters', name:'Tomb Busters', desc:'', status:'coming-soon', link:'tomb-busters.html', region:'Global'},
  {slug:'warspear', name:'Warspear', desc:'', status:'coming-soon', link:'warspear.html', region:'Global'},
  {slug:'watcher-of-realms', name:'Watcher of Realms', desc:'', status:'coming-soon', link:'watcher-of-realms.html', region:'Global'},
  {slug:'zepeto', name:'Zepeto', desc:'', status:'coming-soon', link:'zepeto.html', region:'Global'},
  {slug:'zing-card', name:'Zing Card', desc:'', status:'coming-soon', link:'zing-card.html', region:'Global'},
  {slug:'rare-uid', name:'Rare UID', desc:'Premium rare Free Fire UID numbers', status:'coming-soon', hidden:true, link:'rare-uid.html'},
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
  let v = g.imgVar;
  if(!v){ const d = defaultGames.find(x => x.slug === g.slug); if(d) v = d.imgVar; }
  if(v && typeof window[v] !== 'undefined') return window[v];
  return null;
}
function renderGamesGrid(limit){
  const el = document.getElementById('gamesGrid');
  if(!el) return;
  let sorted = gamesCache.filter(g => !g.hidden).sort((a,b) => {
    const aActive = a.status === 'active' ? 0 : 1;
    const bActive = b.status === 'active' ? 0 : 1;
    return aActive - bActive;
  });
  if(limit) sorted = sorted.slice(0, limit);
  el.innerHTML = sorted.map(g => {
    const img = gameImageSrc(g);
    const visual = img ? `<img src="${img}" alt="${g.name}">` : `<div class="ph">🎮</div>`;
    const isActive = g.status === 'active';
    const pill = isActive
      ? `<div class="game-status-pill"><span class="dot"></span> ACTIVE</div>`
      : `<div class="game-status-pill soon"><span class="dot"></span> COMING SOON</div>`;
    return `
      <a class="game-card" href="${g.link || ('game.html?slug=' + encodeURIComponent(g.slug))}">
        <div class="game-card-img-wrap">
          ${visual}
          ${pill}
        </div>
        <h3>${g.name}</h3>
        ${g.region ? `<div class="game-region">📍 ${g.region}</div>` : ''}
      </a>`;
  }).join('');
}

/* ---------- GENERIC GAME ORDER PAGE (for admin-managed games beyond Free Fire) ---------- */
let currentGenericGame = null;
let selectedGenericPkg = null;
let genericSelectedPay = 'Bank Transfer';

function renderGenericGamePage(){
  // Resolve the game's slug either from a per-file PAGE_SLUG constant (dedicated
  // pages) or from ?slug= in the URL (the generic game.html fallback page —
  // this lets admin-added games work instantly without needing a new file).
  const slug = (typeof PAGE_SLUG !== 'undefined') ? PAGE_SLUG : new URLSearchParams(location.search).get('slug');
  if(!slug) return;
  const game = gamesCache.find(g => g.slug === slug);
  const root = document.getElementById('gamePageRoot');
  if(!root){ return; }
  if(!game){
    root.innerHTML = '<div class="stub-wrap"><p style="color:var(--muted);">Game එක හම්බුනේ නැහැ.</p><a href="games.html" class="btn btn-primary">← Games ටිකට return වෙන්න</a></div>';
    return;
  }
  currentGenericGame = game;

  const iconEl = document.getElementById('gamePageIcon');
  const titleEl = document.getElementById('gamePageTitle');
  const descEl = document.getElementById('gamePageDesc');
  const img = gameImageSrc(game);
  if(iconEl){ if(img){ iconEl.src = img; iconEl.style.display = 'block'; } else { iconEl.style.display = 'none'; } }
  if(titleEl) titleEl.textContent = game.name;
  if(descEl) descEl.innerHTML = (game.desc || '') + (game.region ? `<br><span style="color:var(--cyan);font-size:.85rem;">📍 ${game.region}</span>` : '');

  if(game.status === 'active' && game.packages && game.packages.length){
    const isEmail = game.fieldType === 'email';
    const isDual = game.fieldType === 'dual';
    const fieldLabel = isEmail ? 'EMAIL ADDRESS (DELIVERY)' : (isDual ? (game.field1Label||'USER ID') + ' / ' + (game.field2Label||'ZONE ID') : 'PLAYER ID / UID');
    const fieldPlaceholder = isEmail ? 'Email Address (delivery මේ email එකටයි) *' : 'Player ID / UID *';
    const fieldType = isEmail ? 'email' : 'text';
    const needVerify = gameNeedsFFVerify(game) && !isEmail && !isDual;
    const idFieldHtml = needVerify
      ? `<div class="field-row"><input type="text" id="genUidInput" inputmode="numeric" placeholder="Free Fire Player ID (UID) *" oninput="onGenUidInput()"><button class="btn btn-primary" type="button" id="genVerifyBtn" onclick="verifyGenericUid()">Verify</button></div>
         <div id="genVerifyStatus" class="verify-status"></div>`
      : isDual
      ? `<div class="field-row">
           <input type="text" id="genUidInput" placeholder="${game.field1Label || 'User ID'} *">
           <input type="text" id="genUidInput2" placeholder="${game.field2Label || 'Zone ID'} *">
         </div>`
      : `<div class="field-row"><input type="${fieldType}" id="genUidInput" placeholder="${fieldPlaceholder}"></div>`;
    root.innerHTML = `
      <div class="order-panel">
        <div class="step-label"><div class="step-num">1</div><h3>${fieldLabel}</h3></div>
        ${idFieldHtml}

        <div class="step-label" style="margin-top:20px;"><div class="step-num">2</div><h3>SELECT PACKAGE</h3></div>
        <div class="pkg-grid" id="genPkgContainer"></div>

        <div class="step-label" style="margin-top:26px;"><div class="step-num">3</div><h3>PAYMENT METHOD</h3></div>
        <div class="pay-methods">
          <div class="pay-method selected" onclick="selectGenericPay('Bank Transfer', this)">🏦 Bank Transfer</div>
          <div class="pay-method" onclick="selectGenericPay('Ez Cash', this)">📱 Ez Cash</div>
          <div class="pay-method" onclick="selectGenericPay('Bank Wallet', this)">🏦 Bank Wallet</div>
          <div class="pay-method" onclick="selectGenericPay('EZ Cash / Redeem Wallet', this)">📱 EZ Cash / Redeem Wallet</div>
        </div>
        <div class="order-total"><div>Total Amount</div><div class="amount" id="genTotalAmount">Rs. 0</div></div>
        <div class="fee-line" id="genFeeLine" style="display:none;"></div>

        <div id="genReceiptBlock">
          <div class="step-label" style="margin-top:26px;"><div class="step-num">4</div><h3>UPLOAD PAYMENT RECEIPT</h3></div>
          <input type="file" id="genReceiptFile" accept="image/*" style="display:none;" onchange="document.getElementById('genReceiptFileLabel').textContent = '📎 ' + (this.files[0] ? this.files[0].name : 'Click to upload receipt')">
          <div class="upload-box" onclick="document.getElementById('genReceiptFile').click()" id="genReceiptFileLabel">📎 Click to upload payment receipt *</div>
        </div>
        <div class="wallet-balance-block" id="genWalletBalanceBlock">
          <div style="color:var(--muted);font-size:.9rem;margin-bottom:6px;" id="genWalletBalanceTitle">ඔබේ Wallet Balance එක</div>
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
/* ---------- Free Fire account check on pages like "FF Profile Likes" (shows name + likes) ---------- */
let genVerified = false, genPlayer = null, genAutoTimer = null;
function gameNeedsFFVerify(g){ return !!(g && (g.ffVerify || g.slug === 'ff-likes')); }
function onGenUidInput(){
  const box = document.getElementById('genUidInput');
  if(box){ const clean = box.value.replace(/\D/g, ''); if(clean !== box.value) box.value = clean; }
  genVerified = false; genPlayer = null;
  const st = document.getElementById('genVerifyStatus'); if(st){ st.innerHTML = ''; st.className = 'verify-status'; }
  clearTimeout(genAutoTimer);
  if(box && typeof PLAYER_INFO_URL !== 'undefined' && PLAYER_INFO_URL && /^\d{8,12}$/.test(box.value)) genAutoTimer = setTimeout(verifyGenericUid, 800);
}
async function verifyGenericUid(){
  const box = document.getElementById('genUidInput'), st = document.getElementById('genVerifyStatus'), btn = document.getElementById('genVerifyBtn');
  if(!box || !st) return;
  const uid = box.value.replace(/\D/g, '');
  genVerified = false; genPlayer = null;
  if(!/^\d{8,12}$/.test(uid)){ st.innerHTML = '⚠️ UID එක වැරදියි. ඉලක්කම් 8-12ක් තිබිය යුතුයි.'; st.className = 'verify-status err'; return; }
  if(typeof lookupPlayerInfo === 'undefined' || !PLAYER_INFO_URL){
    genVerified = true; st.innerHTML = '✅ UID accepted'; st.className = 'verify-status ok'; return;
  }
  if(btn) btn.disabled = true;
  st.innerHTML = '⏳ Checking account...'; st.className = 'verify-status';
  const info = await lookupPlayerInfo(uid);
  if(btn) btn.disabled = false;
  if(box.value.replace(/\D/g, '') !== uid) return;            // UID edited while checking
  if(info.ok && !info.fallback){
    genVerified = true; genPlayer = info; saveUid(uid, info.nickname);
    st.className = 'verify-status';
    st.innerHTML = `<div class="verify-card">
        <div class="vc-name">✅ ${info.nickname}</div>
        <div class="vc-likes">❤️ ${info.likes != null ? Number(info.likes).toLocaleString() : '—'} <small>Likes</small></div>
        <div class="vc-meta">${[info.level ? 'Lv ' + info.level : '', info.region, 'UID ' + uid].filter(Boolean).join(' · ')}</div>
      </div>`;
  } else if(info.ok){
    genVerified = true; genPlayer = null;
    st.innerHTML = '✅ UID accepted — Player details auto ගන්න බැරි උනා. UID එක නිවැරදිද බලන්න.'; st.className = 'verify-status ok';
  } else {
    st.innerHTML = info.error === 'not_found' ? '❌ මේ UID එක හොයාගන්න බැරි උනා. UID එක නිවැරදිද බලන්න.' : '⚠️ Verify කරන්න බැරි උනා. ටිකකින් නැවත try කරන්න.';
    st.className = 'verify-status err';
  }
}
function renderGenericPackages(){
  const container = document.getElementById('genPkgContainer');
  if(!container || !currentGenericGame) return;
  container.innerHTML = currentGenericGame.packages.map((p,i) => `
    <div class="pkg-card" onclick="selectGenericPkg(${i})" id="genpkg-${i}">
      ${p.image ? `<img src="${p.image}" alt="${p.label}" style="width:100%;border-radius:10px;margin-bottom:8px;">` : ''}
      <div class="amt">${p.label}</div>
      <div class="lbl">${currentGenericGame.name}</div>
      <div class="price">Rs. ${p.price}</div>
    </div>`).join('');
}
function selectGenericPkg(i){
  selectedGenericPkg = currentGenericGame.packages[i];
  document.querySelectorAll('#gamePageRoot .pkg-card').forEach(c=>c.classList.remove('selected'));
  document.getElementById(`genpkg-${i}`).classList.add('selected');
  updateGenericTotalUI();
}
function updateGenericTotalUI(){
  const totalEl = document.getElementById('genTotalAmount');
  const feeEl = document.getElementById('genFeeLine');
  if(!totalEl) return;
  const c = calcCharge(selectedGenericPkg ? selectedGenericPkg.price : 0, genericSelectedPay);
  totalEl.textContent = fmtRs(c.total);
  if(feeEl){
    if(c.fee > 0){
      feeEl.style.display = 'block';
      feeEl.innerHTML = `${fmtRs(c.base)} + ${fmtRs(c.fee)} Processing Charge (0.75%) — Bank Wallet එකෙන් pay කරද්දී පමණයි`;
    } else { feeEl.style.display = 'none'; }
  }
}
function selectGenericPay(name, el){
  genericSelectedPay = name;
  document.querySelectorAll('#gamePageRoot .pay-method').forEach(p=>p.classList.remove('selected'));
  el.classList.add('selected');
  const receiptBlock = document.getElementById('genReceiptBlock');
  const walletBlock = document.getElementById('genWalletBalanceBlock');
  updateGenericTotalUI();
  const type = walletTypeForPay(name);
  if(type){
    receiptBlock.style.display = 'none';
    walletBlock.style.display = 'block';
    const titleEl = document.getElementById('genWalletBalanceTitle');
    if(titleEl) titleEl.textContent = `ඔබේ ${walletLabel(type)} Balance එක`;
    const balEl = document.getElementById('genWalletBalanceDisplay');
    const key = currentWalletKey();
    if(!key){ balEl.innerHTML = '<a href="#" onclick="openAuth(\'login\');return false;" style="color:var(--cyan);font-size:.9rem;">Login to use Wallet</a>'; return; }
    balEl.textContent = fmtRs(getWalletBalance(key, type));
    fsGetWalletBalances(key).then(b => {
      setCachedBalance(key, 'ez', b.ez); setCachedBalance(key, 'bank', b.bank);
      balEl.textContent = fmtRs(type === 'bank' ? b.bank : b.ez);
    });
  } else {
    receiptBlock.style.display = 'block';
    walletBlock.style.display = 'none';
  }
}
async function placeGenericOrder(){
  if(isStoreClosed()){ alert('🛑 SakinduStore දැනට තාවකාලිකව වසා ඇත. පසුව try කරන්න.'); return; }
  const genSession = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  if(!genSession){ alert('⚠️ Order එකක් දාන්න කලින් Login / Sign Up වෙන්න ඕන.'); openAuth('login'); return; }
  let uid = document.getElementById('genUidInput').value.trim();
  const orderMsg = document.getElementById('genOrderMsg');
  const receiptInput = document.getElementById('genReceiptFile');
  const isEmail = currentGenericGame.fieldType === 'email';
  const isDual = currentGenericGame.fieldType === 'dual';
  const uid2El = document.getElementById('genUidInput2');
  const uid2 = uid2El ? uid2El.value.trim() : '';

  if(!uid){ alert(isEmail ? 'Email Address එක දාන්න.' : (isDual ? (currentGenericGame.field1Label||'User ID') + ' එක දාන්න.' : 'Player ID / UID එක දාන්න.')); return; }
  if(isDual && !uid2){ alert((currentGenericGame.field2Label||'Zone ID') + ' එක දාන්න.'); return; }
  if(isEmail){
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(uid)){ alert('⚠️ Valid email address එකක් දාන්න.'); return; }
  } else {
    if(uid.length < 1 || uid.length > 30){ alert('⚠️ Player ID / UID එක characters 1-30 අතර තිබිය යුතුයි.'); return; }
  }
  if(isDual){ uid = `${uid} (${currentGenericGame.field2Label||'Zone'}: ${uid2})`; }
  if(!selectedGenericPkg){ alert('Package එකක් තෝරන්න.'); return; }
  const needVerify = gameNeedsFFVerify(currentGenericGame) && !isEmail && !isDual;
  if(needVerify && !genVerified){ alert('කරුණාකර Player ID (UID) එක verify කරන්න.'); return; }
  if(needVerify) uid = uid.replace(/\D/g, '');

  const session = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  const baseOrder = {
    id: Date.now(), uid, player: genPlayer ? genPlayer.nickname : '',
    level: genPlayer ? genPlayer.level : null, playerRegion: genPlayer ? genPlayer.region : '', likesBefore: genPlayer ? genPlayer.likes : null,
    package: `${currentGenericGame.name} — ${selectedGenericPkg.label}`,
    amount: selectedGenericPkg.price, payment: genericSelectedPay, date: new Date().toLocaleString(),
    userPhone: session ? session.phone : null
  };

  const submitBtn = document.querySelector('#gamePageRoot .btn-block');
  if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Submitting...'; }

  try{
    if(walletTypeForPay(genericSelectedPay)){
      try{
        const r = await chargeWalletAndSaveOrder(baseOrder, genericSelectedPay, selectedGenericPkg.price);
        renderWallet();
        const feeTxt = r.fee > 0 ? ` (${fmtRs(r.base)} + ${fmtRs(r.fee)} processing charge)` : '';
        orderMsg.innerHTML = `✅ ${walletLabel(r.type)} එකෙන් ${fmtRs(r.total)} deduct කළා${feeTxt}. Admin Approve කරනකම් Processing status එකේ පවතී.`;
        orderMsg.className = 'verify-status ok';
      } catch(err){
        if(err && err.code === 'insufficient'){ await showInsufficient(orderMsg, walletTypeForPay(genericSelectedPay)); }
        else { throw err; }
      }
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

/* ---------- ACCOUNT STORE (admin-manageable account listings) ---------- */
let accountsCache = [];
async function refreshAccountsCache(){ accountsCache = await fsGetConfig('accounts', []); }
async function saveAccounts(accounts){ accountsCache = accounts; await fsSetConfig('accounts', accounts); }
function accountSwapImage(cardIndex, imgIndex){
  const imgs = accountsCache[cardIndex].images || (accountsCache[cardIndex].image ? [accountsCache[cardIndex].image] : []);
  const mainEl = document.getElementById(`acctMainImg-${cardIndex}`);
  if(mainEl && imgs[imgIndex]) mainEl.src = imgs[imgIndex];
  document.querySelectorAll(`.acct-thumb-${cardIndex}`).forEach((t,i) => t.classList.toggle('active', i===imgIndex));
}
function renderAccountsGrid(containerId, limit){
  const el = document.getElementById(containerId);
  if(!el) return;
  let accounts = accountsCache;
  const indices = accounts.map((_,i)=>i);
  let list = accounts.map((a,i) => ({a, i}));
  if(limit) list = list.slice(0, limit);
  if(list.length === 0){ el.innerHTML = '<div class="empty-state">තවම accounts කිසිවක් listed නැහැ.</div>'; return; }
  el.innerHTML = list.map(({a,i}) => {
    const waMsg = encodeURIComponent(`Hi, I'm interested in this account: ${a.title} (Rs. ${a.price})`);
    const imgs = a.images && a.images.length ? a.images : (a.image ? [a.image] : []);
    const mainImg = imgs[0]
      ? `<img src="${imgs[0]}" alt="${a.title}" class="catalog-img" id="acctMainImg-${i}">`
      : '<div class="catalog-img ph">🎮</div>';
    const thumbs = imgs.length > 1 ? `
      <div class="acct-thumb-row">
        ${imgs.map((img,idx) => `<img src="${img}" class="acct-thumb acct-thumb-${i} ${idx===0?'active':''}" onclick="accountSwapImage(${i},${idx})">`).join('')}
      </div>` : '';
    return `
    <div class="catalog-card">
      ${mainImg}
      ${thumbs}
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

/* ---------- EVENT BANNERS (admin-manageable portfolio of past/example banner designs) ---------- */
let eventBannersCache = [];
async function refreshEventBannersCache(){ eventBannersCache = await fsGetConfig('eventBanners', []); }
async function saveEventBanners(banners){ eventBannersCache = banners; await fsSetConfig('eventBanners', banners); }
function renderEventBannersGrid(containerId){
  const el = document.getElementById(containerId);
  if(!el) return;
  if(eventBannersCache.length === 0){ el.innerHTML = '<div class="empty-state">තවම banners කිසිවක් නැහැ.</div>'; return; }
  el.innerHTML = eventBannersCache.map(b => `
    <div class="catalog-card">
      ${b.image ? `<img src="${b.image}" alt="${b.name}" class="catalog-img">` : '<div class="catalog-img ph">🖼️</div>'}
      <div class="catalog-body">
        <h3>${b.name}</h3>
        ${b.date ? `<div class="catalog-chip" style="margin-top:6px;">${b.date}</div>` : ''}
      </div>
    </div>`).join('');
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
/* 3D spinning diamond (pure CSS 3D — two pyramids of 4 faces each) */
function gem3dHtml(){
  const faces = '<i></i><i></i><i></i><i></i>';
  return `<div class="gem-wrap"><div class="gem3d"><div class="gem-spin"><div class="gem-half top">${faces}</div><div class="gem-half bottom">${faces}</div></div></div></div>`;
}
function showGlobalLoader(){
  if(document.getElementById('globalLoader')) return;
  const el = document.createElement('div');
  el.id = 'globalLoader';
  el.className = 'global-loader';
  el.innerHTML = gem3dHtml() + '<div class="loader-text">SakinduStore</div>';
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
  { kw:['reject','rejected','declined'], a:'Order එකක් Reject උනා නම්, ඒකට හේතුව (වැරදි receipt/payment issue) WhatsApp එකෙන් අහන්න — Admin ට clarify කරන්න පුළුවන්.' },
  { kw:['refund','cancel'], a:'Refund/Cancellation Policy සම්පූර්ණයෙන් බලන්න Footer එකේ "Refund & Cancellation Policy" link එකෙන්.' },
  { kw:['login','sign up','signup','register','account'], a:'Login/Sign Up Home page එකේ උඩින් "Login" button එකෙන් කරන්න පුළුවන්. Order/Wallet features ඔක්කොටම Login අනිවාර්යයි.' },
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
      <div class="ai-bot-msg bot">👋 ආයුබෝවන්! UID verify, Wallet, Orders, Payment methods ගැන අහන්න. මොකක් හරි type කරන්න!</div>
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
      safeRefresh(refreshFfRegionPackagesCache, 'ffRegionPackages'),
      safeRefresh(refreshRedeemCodesCache, 'redeemCodes'),
      safeRefresh(refreshReviewsCache, 'reviews'),
      safeRefresh(refreshOrdersCache, 'orders'),
      safeRefresh(refreshUsersCache, 'users'),
      safeRefresh(refreshWalletsCache, 'wallets'),
      safeRefresh(refreshEventCache, 'upcomingEvent'),
      safeRefresh(refreshAccountsCache, 'accounts'),
      safeRefresh(refreshAdBannersCache, 'adBanners'),
      safeRefresh(refreshEventBannersCache, 'eventBanners'),
    ]);
    renderGamesGrid(typeof GAMES_HOME_LIMIT !== 'undefined' ? GAMES_HOME_LIMIT : undefined);
    renderUpcomingEvent();
    renderGenericGamePage();
    renderStoreLock();
    renderAnnouncement();
    if(document.getElementById('ffRegionSelect')){
      onFFRegionChange();
      renderSavedUids(); applyBuyAgainParams();
      if(typeof renderRegionGrid === 'function' && document.getElementById('regionOverlay').classList.contains('show')) renderRegionGrid();
    } else { renderPackages(); }
    renderWallet();
    renderOrders();
    renderRechargeHistory();
    renderLeaderboard();
    renderAccountsGrid('accountsGrid');
    renderAccountsGrid('accountsGridHome', 3);
    renderAdBanners('adBannerStrip');
    renderEventBannersGrid('eventBannersGrid');
    renderReviews();
    refreshAuthUI();
    updatePaymentUI();
    injectAIBot();
  } finally {
    hideGlobalLoader();
  }
}
initApp();
