/* ===== SakinduStore — Profile page (VIP level, points, menu) =====
   Needs app.js (caches: ordersCache, usersCache, walletsCache). XP and points are COMPUTED from the customer's completed
   orders, so there is no separate ledger to keep in sync; only redeemed points are stored (users/<phone>.pointsRedeemed). */

/* VIP levels — XP = Rs. 1 spent on completed orders = 1 XP.  */
const VIP_TIERS = [
  { name: 'Bronze VIP',   min: 0,     medal: '🥉', perks: ['Order history & receipts'] },
  { name: 'Gold VIP',     min: 1000,  medal: '🥇', perks: ['Priority support on WhatsApp'] },
  { name: 'Platinum VIP', min: 5000,  medal: '💠', perks: ['Early access to offers'] },
  { name: 'Diamond VIP',  min: 20000, medal: '💎', perks: ['Top-spender recognition'] }
];
const REFERRAL_RATE = 0.01;        // Referral Points = 1% of a referred friend's completed orders (the ONLY way to earn points)
const MIN_REDEEM_POINTS = 100;     // need 100 points to press "Get Wallet"; 1 point = Rs. 1
const SUPPORT_WA = '94760627795';
const countsAsDone = o => o.status && o.status !== 'Processing' && o.status !== 'Rejected';

function pfTierFor(xp){ let t = VIP_TIERS[0]; VIP_TIERS.forEach(x => { if(xp >= x.min) t = x; }); return t; }
function pfStats(phone){
  const mine = ordersCache.filter(o => o.userPhone === phone && countsAsDone(o));
  const xp = Math.floor(mine.reduce((s, o) => s + (Number(o.amount) || 0), 0));
  const tier = pfTierFor(xp);
  const friends = Object.keys(usersCache).filter(p => usersCache[p] && usersCache[p].referredBy === phone);
  const friendSpend = ordersCache.filter(o => friends.indexOf(o.userPhone) >= 0 && countsAsDone(o)).reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const refPts = friendSpend * REFERRAL_RATE;
  const earned = round2(refPts);
  const used = (usersCache[phone] && usersCache[phone].pointsRedeemed) || 0;
  const next = VIP_TIERS.find(t => t.min > xp) || null;
  return { xp, tier, next, earned, used, balance: Math.max(0, round2(earned - used)), friends: friends.length, refPts: round2(refPts) };
}
function pfMask(s){ return escHtml(s || ''); }

async function renderProfile(){
  const root = document.getElementById('pfRoot'); if(!root) return;
  const s = getSession();
  if(!s){
    root.innerHTML = `<div class="pf-card" style="text-align:center;padding:40px 20px;">
      <div style="font-size:3rem;">👤</div><h2 style="margin:10px 0 6px;">Login වෙන්න</h2>
      <p class="pf-muted" style="margin-bottom:18px;">ඔබේ Profile, VIP level සහ Points බලන්න Login / Sign Up වෙන්න.</p>
      <button class="btn btn-primary" onclick="openAuth('login')">Login / Sign Up</button></div>`;
    return;
  }
  const u = usersCache[s.phone] || (await fsGetUser(s.phone).catch(() => null)) || {};
  usersCache[s.phone] = u;
  const st = pfStats(s.phone);
  const pct = st.next ? Math.min(100, Math.floor(((st.xp - st.tier.min) / (st.next.min - st.tier.min)) * 100)) : 100;
  const needXp = st.next ? st.next.min - st.xp : 0;
  const bal = getWalletBalance(s.phone);
  root.innerHTML = `
    <section class="pf-card pf-head">
      <div class="pf-avatar" id="pfAvatar"></div>
      <h2>${pfMask(u.name || s.name)}</h2>
      <div class="pf-mail">${pfMask(u.email || '')}</div>
      <span class="pf-pill">${pfMask(s.phone)}</span>
    </section>

    <section class="pf-card pf-vip">
      <div class="pf-vip-top">
        <div class="pf-medal">${st.tier.medal}</div>
        <div>
          <div class="pf-tier">${st.tier.name}</div>
          <div class="pf-xp">⭐ ${st.xp.toLocaleString('en-US')} XP</div>
        </div>
      </div>
      <div class="pf-points">
        <div class="pf-pt-l">🪙 Referral Points</div>
        <div class="pf-pt-v">${st.balance.toFixed(2)} Pts</div>
        <div class="pf-pt-s">≈ ${st.balance.toFixed(2)} LKR</div>
      </div>
      <div class="pf-next">
        <span>Next Milestone: ${st.next ? st.next.name.replace(' VIP', ' VIP') : 'Max level 🎉'}</span>
        <b>${st.next ? needXp.toLocaleString('en-US') + ' XP needed (' + pct + '%)' : 'Completed'}</b>
      </div>
      <div class="pf-bar"><i style="width:${pct}%"></i></div>
      <div class="pf-two">
        <button class="pf-ghost" onclick="openVipPerks()">🏆 VIP Perks</button>
        <button class="pf-ghost" onclick="openReferrals()">👥 Referrals</button>
      </div>
      <button class="pf-redeem" onclick="openGetWallet()">🪙 Get Wallet</button>
    </section>

    <section class="pf-card pf-wallet">
      <div><div class="pf-muted">Wallet Balance</div><div class="pf-wal" id="profileWalletBalance">${fmtRs2(bal)}</div></div>
      <a class="pf-ghost" href="wallet.html" style="text-decoration:none;">＋ Recharge</a>
    </section>

    <section class="pf-card pf-menu">
      <button onclick="openVipPerks()" class="hi"><span class="ic">🏅</span><span>VIP Levels, Points &amp; Referrals</span><em>VIP Club</em><i>›</i></button>
      <button onclick="openEditProfile()"><span class="ic">⚙️</span><span>Edit Profile</span><i>›</i></button>
      <button onclick="openDevices()"><span class="ic">🛡️</span><span>Login Devices</span><i>›</i></button>
      <button onclick="openAbout()"><span class="ic">ℹ️</span><span>About Us</span><i>›</i></button>
      <button onclick="openFaq()"><span class="ic">❓</span><span>FAQ</span><i>›</i></button>
      <button onclick="openContact()"><span class="ic">✉️</span><span>Contact Us</span><i>›</i></button>
      <a href="developer.html"><span class="ic">&lt;/&gt;</span><span>Developer</span><i>›</i></a>
      <a href="premium.html"><span class="ic">🛍️</span><span>Other Services</span><i>›</i></a>
      <a href="account-store.html"><span class="ic">🎮</span><span>Game Accounts</span><i>›</i></a>
      <button onclick="pfLogout()" class="out"><span class="ic">⏻</span><span>Logout</span><i>›</i></button>
    </section>`;
  pfLoadAvatar(u.avatar, u.name || s.name);
  fsGetTotalBalance(s.phone).then(b => { setCachedBalance(s.phone, 'ez', b); setCachedBalance(s.phone, 'bank', 0); const el = document.getElementById('profileWalletBalance'); if(el) el.textContent = fmtRs2(b); }).catch(() => {});
}
async function pfLoadAvatar(av, name){
  const box = document.getElementById('pfAvatar'); if(!box) return;
  const letter = `<span>${escHtml((name || '?').charAt(0).toUpperCase())}</span>`;
  box.innerHTML = letter;
  if(!av) return;
  try{ const url = isImgToken(av) ? await fsLoadImage(av) : av; if(url) box.innerHTML = `<img src="${url}" alt="">`; }catch(e){}
}
function onProfileLogin(){ renderProfile(); }

/* ---------- sheet modal ---------- */
function openPfSheet(html){ document.getElementById('pfSheetBody').innerHTML = html; document.getElementById('pfSheetOverlay').classList.add('show'); }
function closePfSheet(){ document.getElementById('pfSheetOverlay').classList.remove('show'); }
function pfLogout(){ logoutUser(); location.href = 'index.html'; }

function openVipPerks(){
  const s = getSession(); if(!s) return;
  const st = pfStats(s.phone);
  openPfSheet(`<h3>🏆 VIP Levels</h3>
    <p class="modal-sub">XP = ඔබ complete වුණු orders වල Rs. 1 = 1 XP. Referral Points = යාළුවන්ගේ orders වලින් ${REFERRAL_RATE * 100}% (1 point = Rs. 1).</p>
    ${VIP_TIERS.map(t => `<div class="pf-tier-row ${t.name === st.tier.name ? 'on' : ''}">
      <div class="m">${t.medal}</div>
      <div><b>${t.name}</b> <small>${t.min.toLocaleString('en-US')}+ XP</small><div class="pf-muted">${t.perks.join(' · ')}</div></div>
      ${t.name === st.tier.name ? '<em>You</em>' : ''}</div>`).join('')}`);
}
function openReferrals(){
  const s = getSession(); if(!s) return;
  const st = pfStats(s.phone);
  const link = location.origin + location.pathname.replace(/[^/]*$/, '') + 'index.html?ref=' + s.phone;
  openPfSheet(`<h3>👥 Referrals</h3>
    <p class="modal-sub">මේ link එකෙන් Sign Up වෙන යාළුවෝ ගාණට, ඔවුන්ගේ complete වුණු orders වලින් ${REFERRAL_RATE * 100}% ක් Referral Points විදිහට ලැබේ. Points ${MIN_REDEEM_POINTS} වුණාම \"Get Wallet\" එකෙන් Wallet Code එකක් ගන්න.</p>
    <input type="text" id="refLink" value="${escHtml(link)}" readonly onclick="this.select()">
    <div class="rc-actions"><button class="btn btn-primary" onclick="copyText(document.getElementById('refLink').value, this)">📋 Copy Link</button>
    <a class="btn btn-ghost" style="text-align:center;" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent('SakinduStore එකෙන් Game Top-up කරන්න: ' + link)}">📲 Share</a></div>
    <div class="pf-ref-stats"><div><b>${st.friends}</b><span>Friends joined</span></div><div><b>${st.refPts.toFixed(2)}</b><span>Referral points</span></div></div>`);
}
async function openGetWallet(){
  const s = getSession(); if(!s) return;
  const st = pfStats(s.phone);
  const can = Math.floor(st.balance) >= MIN_REDEEM_POINTS;
  openPfSheet(`<h3>🪙 Get Wallet</h3>
    <p class="modal-sub">Referral Points ${MIN_REDEEM_POINTS} ක් හෝ වැඩි නම් ඔබට විතරක් වලංගු Wallet Code එකක් generate වේ (1 point = Rs. 1). ඒක <b>Wallet → Redeem Code</b> එකේ ගැහුවම Wallet Balance එකට add වේ.</p>
    <div class="pf-redeem-box"><span>Available</span><b>${st.balance.toFixed(2)} Pts</b></div>
    <div class="pf-bar" style="margin-bottom:12px;"><i style="width:${Math.min(100, Math.floor(st.balance / MIN_REDEEM_POINTS * 100))}%"></i></div>
    <button class="btn btn-primary btn-block" id="getWalletBtn" onclick="doGetWallet()" ${can ? '' : 'disabled'}>${can ? 'Generate Wallet Code (Rs. ' + Math.floor(st.balance) + ')' : 'තව Points ' + Math.ceil(MIN_REDEEM_POINTS - st.balance) + ' ක් ඕන'}</button>
    <div id="redeemPtsMsg" class="verify-status" style="margin-top:10px;"></div>
    <div id="myCodes"></div>`);
  loadMyCodes();
}
async function loadMyCodes(){
  const s = getSession(); const box = document.getElementById('myCodes'); if(!s || !box) return;
  try{
    const list = await fsGetMyPointCodes(s.phone);
    if(!list.length){ box.innerHTML = ''; return; }
    box.innerHTML = `<div class="pf-muted" style="margin:14px 0 6px;">ඔබේ Wallet Codes</div>` + list.map(c => `
      <div class="pf-dev"><div class="m">${c.used ? '✅' : '🎟️'}</div>
        <div style="flex:1;"><b style="font-family:monospace;letter-spacing:1px;">${escHtml(c.code)}</b>
          <div class="pf-muted">Rs. ${Number(c.amount).toLocaleString('en-US')} · ${c.used ? 'Redeemed' : 'Not used yet'} · ${escHtml(new Date(c.createdAt).toLocaleDateString())}</div></div>
        ${c.used ? '' : `<button class="btn btn-ghost btn-sm" onclick="copyText('${escHtml(c.code)}', this)">Copy</button>`}</div>`).join('');
  }catch(e){ box.innerHTML = ''; }
}
async function doGetWallet(){
  const s = getSession(); if(!s) return;
  const msg = document.getElementById('redeemPtsMsg'), btn = document.getElementById('getWalletBtn');
  const st = pfStats(s.phone);
  btn.disabled = true; msg.textContent = 'Generating...'; msg.className = 'verify-status';
  try{
    const r = await fsCreatePointCode(s.phone, st.earned, MIN_REDEEM_POINTS);
    usersCache[s.phone] = Object.assign({}, usersCache[s.phone], { pointsRedeemed: r.redeemed });
    document.getElementById('pfSheetBody').innerHTML = `<h3>🎉 Wallet Code Ready!</h3>
      <p class="modal-sub">Rs. ${r.amount.toLocaleString('en-US')} වටිනා ඔබේ පෞද්ගලික code එක:</p>
      <div class="pf-code">${escHtml(r.code)}</div>
      <button class="btn btn-primary btn-block" onclick="copyText('${escHtml(r.code)}', this)">📋 Copy Code</button>
      <a class="btn btn-ghost btn-block" style="display:block;text-align:center;margin-top:10px;" href="wallet.html">Wallet → Redeem Code එකට යන්න →</a>
      <p class="pf-muted" style="margin-top:12px;line-height:1.6;">මේ code එක එක වරක් විතරක් භාවිත කළ හැකි අතර ඔබේ account එකට පමණක් වලංගුයි.</p>
      <div id="myCodes"></div>`;
    renderProfile(); loadMyCodes();
  }catch(e){ msg.textContent = '❌ ' + (e.code === 'nopoints' ? 'Points ප්‍රමාණවත් නැහැ.' : (e.message || e)); msg.className = 'verify-status err'; btn.disabled = false; }
}

function openEditProfile(){
  const s = getSession(); if(!s) return;
  const u = usersCache[s.phone] || {};
  window.__newAvatar = null;
  openPfSheet(`<h3>⚙️ Edit Profile</h3>
    <div style="text-align:center;margin-bottom:12px;"><div class="pf-avatar sm" id="epAvatar"></div>
      <input type="file" id="epFile" accept="image/*" style="display:none;" onchange="epPick()">
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('epFile').click()">📷 Change Photo</button></div>
    <input type="text" id="epName" placeholder="Name" value="${escHtml(u.name || s.name)}">
    <input type="email" id="epEmail" placeholder="Email" value="${escHtml(u.email || '')}">
    <input type="password" id="epPass" placeholder="New password (වෙනස් කරන්න ඕන නම් විතරක්)">
    <button class="btn btn-primary btn-block" id="epBtn" onclick="saveProfile()">Save</button>
    <div id="epMsg" class="verify-status" style="margin-top:10px;"></div>`);
  pfLoadAvatarInto('epAvatar', u.avatar, u.name || s.name);
}
async function pfLoadAvatarInto(id, av, name){
  const box = document.getElementById(id); if(!box) return;
  box.innerHTML = `<span>${escHtml((name || '?').charAt(0).toUpperCase())}</span>`;
  if(!av) return;
  try{ const url = isImgToken(av) ? await fsLoadImage(av) : av; if(url) box.innerHTML = `<img src="${url}" alt="">`; }catch(e){}
}
async function epPick(){
  const f = document.getElementById('epFile').files[0]; if(!f) return;
  window.__newAvatar = await fileToDataURL(f, 400, 0.85);
  document.getElementById('epAvatar').innerHTML = `<img src="${window.__newAvatar}" alt="">`;
}
async function saveProfile(){
  const s = getSession(); if(!s) return;
  const msg = document.getElementById('epMsg'), btn = document.getElementById('epBtn');
  const name = document.getElementById('epName').value.trim(), email = document.getElementById('epEmail').value.trim(), pass = document.getElementById('epPass').value.trim();
  if(!name){ msg.textContent = '⚠️ Name එක දාන්න.'; msg.className = 'verify-status err'; return; }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ msg.textContent = '⚠️ Valid email එකක් දාන්න.'; msg.className = 'verify-status err'; return; }
  const patch = { name, email };
  if(pass){ if(pass.length < 4){ msg.textContent = '⚠️ Password එක අකුරු 4ක් හෝ වැඩි විය යුතුයි.'; msg.className = 'verify-status err'; return; } patch.pass = pass; }
  if(window.__newAvatar) patch.avatar = window.__newAvatar;
  btn.disabled = true;
  try{
    await fsMergeUser(s.phone, patch);
    const fresh = await fsGetUser(s.phone); usersCache[s.phone] = fresh;
    localStorage.setItem('sakindu_session', JSON.stringify({ phone: s.phone, name }));
    refreshAuthUI(); renderProfile(); closePfSheet();
  }catch(e){ msg.textContent = '❌ ' + (e.message || e); msg.className = 'verify-status err'; }
  btn.disabled = false;
}

async function openDevices(){
  const s = getSession(); if(!s) return;
  openPfSheet(`<h3>🛡️ Login Devices</h3><p class="modal-sub">ඔබේ account එකට login වුණු devices.</p><div id="devList" class="pf-muted">Loading...</div>`);
  const u = await fsGetUser(s.phone).catch(() => null);
  const me = deviceInfo().id;
  const list = (u && u.devices) || [];
  document.getElementById('devList').innerHTML = list.length ? list.map(d => `
    <div class="pf-dev"><div class="m">${/Android|iOS/.test(d.name) ? '📱' : '💻'}</div>
      <div><b>${escHtml(d.name)}</b>${d.id === me ? ' <em>This device</em>' : ''}<div class="pf-muted">${escHtml(new Date(d.lastLogin).toLocaleString())}</div></div></div>`).join('')
    : '<div class="pf-muted">තවම devices කිසිවක් record වෙලා නැහැ. ඊළඟ login එකෙන් පස්සේ පෙන්වයි.</div>';
}
function openAbout(){
  openPfSheet(`<h3>ℹ️ About Us</h3>
    <p class="pf-muted" style="line-height:1.7;margin-bottom:14px;">SakinduStore යනු ශ්‍රී ලංකාවේ වේගවත් Game Top-up සේවාවයි. Free Fire, Mobile Legends ඇතුළු ගේම් ගණනාවකට Diamonds / Top-up Wallet එකෙන් ආරක්ෂිතව ලබාගන්න.</p>
    <div class="pf-links"><a href="terms.html">Terms &amp; Conditions</a><a href="privacy.html">Privacy Policy</a><a href="refund-policy.html">Refund Policy</a><a href="developer.html">Developer</a></div>`);
}
function openFaq(){
  const qa = [
    ['Wallet එක recharge කරන්නේ කොහොමද?', 'Recharge → eZ Cash හෝ Bank Transfer තෝරලා, මුදල දාලා Reference Number + වේලාව (හෝ Slip එක) submit කරන්න. Admin verify කළාම Balance එකට add වේ.'],
    ['Order එක දාන්න පුළුවන් ක්‍රම මොනවාද?', 'Order හැම එකක්ම Wallet Balance එකෙන් පමණයි.'],
    ['Shop / Agent එකකින් දැම්මොත්?', 'eZ Cash Shop / Agent / Reload machine එකකින් දැම්මොත් රු. 20ක ගාස්තුවක් අඩු කරලා Credit වේ.'],
    ['UID එක verify වෙන්නේ නැත්නම්?', 'UID එක නිවැරදිද බලලා තත්පර කීපයකින් නැවත Verify කරන්න. සේවාව නිදහස් වෙන්න ටික වෙලාවක් ගත විය හැක.'],
    ['Order එක කොච්චර වෙලාවකින් ලැබේද?', 'Admin Approve කළාම ලැබේ. Order History එකේ Receipt එකෙන් status බලන්න.']
  ];
  openPfSheet(`<h3>❓ FAQ</h3>${qa.map(x => `<details class="pf-faq"><summary>${escHtml(x[0])}</summary><p>${escHtml(x[1])}</p></details>`).join('')}`);
}
function openContact(){
  openPfSheet(`<h3>✉️ Contact Us</h3><p class="modal-sub">ඕනෑම ගැටළුවක් WhatsApp එකෙන් අපට දන්වන්න.</p>
    <a class="btn btn-primary btn-block" style="text-align:center;display:block;" target="_blank" rel="noopener" href="https://wa.me/${SUPPORT_WA}">💬 WhatsApp</a>`);
}