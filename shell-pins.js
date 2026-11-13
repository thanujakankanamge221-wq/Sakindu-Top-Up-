/* ===== SakinduStore — Shell Topup Redeem Pin shop =====
   Uses app.js for login, wallets and the 0.75% Bank Wallet charge. */

let pinGroups = [];        // [{ shells, price, count }]
let buying = null;         // group being purchased
let pinPay = 'Bank Transfer';

async function loadPinStock(){
  const grid = document.getElementById('pinGrid');
  try{
    const pins = await fsGetAvailablePins();
    const map = {};
    pins.forEach(p => {
      const k = p.shells + '|' + p.price;
      (map[k] = map[k] || { shells: p.shells, price: p.price, count: 0 }).count++;
    });
    pinGroups = Object.values(map).sort((a,b) => a.shells - b.shells);
    renderPinGrid();
  } catch(err){
    console.error('[SakinduStore] pin stock', err);
    grid.innerHTML = `<p style="color:var(--red);text-align:center;grid-column:1/-1;">Stock load කරන්න බැරි උනා.<br><small>${err.message || err}</small></p>`;
  }
}
function renderPinGrid(){
  const grid = document.getElementById('pinGrid');
  if(!pinGroups.length){
    grid.innerHTML = '<p style="color:var(--muted);text-align:center;grid-column:1/-1;">දැනට Redeem Pins stock නැහැ. WhatsApp හරහා අපෙන් අහන්න.</p>';
    return;
  }
  grid.innerHTML = pinGroups.map((g,i) => `
    <div class="pin-card">
      <div class="shell-ic">${shellLogoSvg(96)}</div>
      <h3>ShellTopUp Redeem Pin ${g.shells}</h3>
      <div class="pin-price">${Number(g.price).toFixed(2)} <small>LKR</small></div>
      <div class="stock-badge ${g.count <= 2 ? 'low' : ''}">${g.count} STOCK LEFT</div>
      <button class="btn btn-primary btn-block" onclick="openBuy(${i})">🛒 Buy Now</button>
    </div>`).join('');
}

/* ---- buy modal ---- */
function openBuy(i){
  const session = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  if(!session){ alert('⚠️ Pin එකක් මිලදී ගන්න කලින් Login / Sign Up වෙන්න ඕන.'); openAuth('login'); return; }
  buying = pinGroups[i];
  pinPay = 'Bank Transfer';
  document.querySelectorAll('#buyOverlay .pay-method').forEach((p,idx) => p.classList.toggle('selected', idx === 0));
  document.getElementById('buyTitle').textContent = `ShellTopUp Redeem Pin ${buying.shells}`;
  document.getElementById('buySub').textContent = `🐚 ${buying.shells} shells · ${fmtRs(buying.price)}`;
  document.getElementById('buyForm').style.display = 'block';
  document.getElementById('buyMsg').innerHTML = '';
  document.getElementById('buyMsg').className = 'verify-status';
  document.getElementById('buyBtn').disabled = false;
  pickPinPay('Bank Transfer', document.querySelector('#buyOverlay .pay-method'));
  document.getElementById('buyOverlay').classList.add('show');
}
function closeBuy(){ document.getElementById('buyOverlay').classList.remove('show'); }

function pickPinPay(name, el){
  pinPay = name;
  document.querySelectorAll('#buyOverlay .pay-method').forEach(p => p.classList.remove('selected'));
  el.classList.add('selected');
  const c = calcCharge(buying.price, name);
  document.getElementById('buyTotal').textContent = fmtRs(c.total);
  const feeEl = document.getElementById('buyFee');
  if(c.fee > 0){
    feeEl.style.display = 'block';
    feeEl.innerHTML = `${fmtRs(c.base)} + ${fmtRs(c.fee)} Processing Charge (0.75%) — Bank Wallet එකෙන් pay කරද්දී පමණයි`;
  } else { feeEl.style.display = 'none'; }
  const type = walletTypeForPay(name);
  document.getElementById('buyReceiptBlock').style.display = type ? 'none' : 'block';
  const wb = document.getElementById('buyWalletBlock');
  wb.style.display = type ? 'block' : 'none';
  if(type){
    document.getElementById('buyWalletTitle').textContent = `ඔබේ ${walletLabel(type)} Balance එක`;
    const balEl = document.getElementById('buyWalletBal');
    balEl.textContent = '...';
    fsGetWalletBalances(currentWalletKey()).then(b => { balEl.textContent = fmtRs(type === 'bank' ? b.bank : b.ez); });
  }
}

async function confirmBuy(){
  const msg = document.getElementById('buyMsg');
  const btn = document.getElementById('buyBtn');
  const session = JSON.parse(localStorage.getItem('sakindu_session') || 'null');
  if(!session){ openAuth('login'); return; }
  if(isStoreClosed()){ alert('🛑 SakinduStore දැනට තාවකාලිකව වසා ඇත. පසුව try කරන්න.'); return; }
  const type = walletTypeForPay(pinPay);
  const c = calcCharge(buying.price, pinPay);
  const order = {
    id: Date.now(), uid: '-', player: '', package: `ShellTopUp Redeem Pin ${buying.shells}`,
    amount: buying.price, payment: pinPay, date: new Date().toLocaleString(), userPhone: session.phone,
    region: null
  };
  const opts = { shells: buying.shells, price: buying.price, order };

  btn.disabled = true; msg.className = 'verify-status'; msg.textContent = 'Processing...';
  try{
    if(type){
      Object.assign(opts, { walletKey: session.phone, walletType: type, totalCharge: c.total });
      Object.assign(order, { walletType: type, processingFee: c.fee, totalCharged: c.total });
    } else {
      const f = document.getElementById('buyReceiptFile').files[0];
      if(!f){ msg.textContent = 'කරුණාකර payment receipt එක upload කරන්න.'; btn.disabled = false; return; }
      order.receipt = await fileToDataURL(f); order.receiptName = f.name;
    }
    const r = await fsBuyPin(opts);
    document.getElementById('buyForm').style.display = 'none';
    if(r.delivered){
      closeBuy();
      showPinReceipt({ orderNo: order.id, date: order.date, item: order.package, amount: order.amount, fee: c.fee, total: c.total, payment: pinPay, pinCode: r.pinCode });
    } else {
      msg.className = 'verify-status ok';
      msg.innerHTML = '✅ Order එක place උනා! Admin receipt එක verify කරලා Approve කළාම Redeem Pin එක ඔබේ <a href="index.html#orders" style="color:var(--cyan);">Order History</a> එකේ පෙන්වයි.';
    }
    loadPinStock();
  } catch(err){
    btn.disabled = false;
    msg.className = 'verify-status err';
    if(err.code === 'insufficient'){
      msg.innerHTML = `❌ ${walletLabel(type)} balance එක ප්‍රමාණවත් නැහැ. <a href="wallet.html" style="color:var(--cyan);">Wallet Recharge කරන්න</a>`;
    } else if(err.code === 'soldout'){
      msg.textContent = '❌ කණගාටුයි, මේ Pin එක Sold Out වුණා.';
      loadPinStock();
    } else {
      console.error('[SakinduStore] buy pin', err);
      msg.innerHTML = `❌ Purchase එක කරන්න බැරි උනා.<br><span style="font-size:.8rem;opacity:.8;">${err.message || err}</span>`;
    }
  }
}

loadPinStock();
