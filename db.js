/* ===== Firestore data layer for SakinduStore =====
   All functions are async — call with await. Requires firebase-init.js loaded first.
   Errors are NOT swallowed here — they propagate to the caller so real problems
   (permissions, network, misconfigured rules) can be shown to the user instead
   of silently failing. */

/* ---- IMAGE STORAGE ----
   Pictures (base64 data URLs) are stored once in the images database (collection `images`, document id =
   hash of the picture, so the same picture is never stored twice). Whatever holds the picture keeps a short
   reference "img:<id>". Reading resolves references back to data URLs, so the rest of the site is unchanged.
   Plain data URLs that are still embedded in old records keep working untouched. */
const IMG_TOKEN = 'img:';
const IMAGE_CONFIG_KEYS = ['games', 'adBanners', 'eventBanners', 'upcomingEvent', 'accounts'];
const imgMem = {};          // token -> data URL (this page)
const imgKnown = {};        // ids already confirmed stored (this page)
function isDataImage(v){ return typeof v === 'string' && v.indexOf('data:image/') === 0 && v.length > 1500; }
function isImgToken(v){ return typeof v === 'string' && v.indexOf(IMG_TOKEN) === 0 && v.length < 80; }
function hashImage(str){                                   // cyrb53 — fast, 53-bit
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for(let i = 0, ch; i < str.length; i++){
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 'h' + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + '-' + str.length.toString(36);
}
async function fsSaveImage(dataUrl){
  const id = hashImage(dataUrl), token = IMG_TOKEN + id;
  imgMem[token] = dataUrl;
  if(!imgKnown[id]){
    const ref = colFor('images').doc(id);
    const snap = await ref.get();
    if(!snap.exists) await ref.set({ dataUrl, createdAt: new Date().toISOString() });
    imgKnown[id] = true;
  }
  return token;
}
async function fsLoadImage(token){
  if(imgMem[token]) return imgMem[token];
  const id = token.slice(IMG_TOKEN.length);
  try{ const c = sessionStorage.getItem('img_' + id); if(c){ imgMem[token] = c; return c; } }catch(e){}
  const snap = await colFor('images').doc(id).get();
  if(!snap.exists) return null;
  const url = snap.data().dataUrl;
  imgMem[token] = url;
  try{ if(url.length < 700000) sessionStorage.setItem('img_' + id, url); }catch(e){}
  return url;
}
/* deep-copy `val`, replacing every embedded picture by a reference (returns the new value) */
async function externalizeImages(val, stats){
  if(isDataImage(val)){ if(stats) stats.images++; return fsSaveImage(val); }
  if(Array.isArray(val)){ const out = []; for(const x of val) out.push(await externalizeImages(x, stats)); return out; }
  if(val && typeof val === 'object'){ const out = {}; for(const k of Object.keys(val)) out[k] = await externalizeImages(val[k], stats); return out; }
  return val;
}
function collectTokens(val, set){
  if(isImgToken(val)) set.add(val);
  else if(Array.isArray(val)) val.forEach(x => collectTokens(x, set));
  else if(val && typeof val === 'object') Object.keys(val).forEach(k => collectTokens(val[k], set));
  return set;
}
function applyTokens(val, map){
  if(isImgToken(val)) return map[val] || null;
  if(Array.isArray(val)) return val.map(x => applyTokens(x, map));
  if(val && typeof val === 'object'){ const out = {}; Object.keys(val).forEach(k => { out[k] = applyTokens(val[k], map); }); return out; }
  return val;
}
/* deep-copy `val`, replacing every reference by the picture it points to */
async function resolveImages(val){
  const tokens = Array.from(collectTokens(val, new Set()));
  if(!tokens.length) return val;
  const map = {};
  await Promise.all(tokens.map(async t => { try{ map[t] = await fsLoadImage(t); }catch(e){ console.error('[db] image load failed', t, e); map[t] = null; } }));
  return applyTokens(val, map);
}

/* ---- Generic single-document config store (games, videos, redeemCodes, priceOverrides, reviews, store) ---- */
async function fsGetConfig(key, defaultVal){
  const snap = await cfgDb(key).collection('config').doc(key).get();
  if(!snap.exists) return defaultVal;
  const v = snap.data().value;
  return IMAGE_CONFIG_KEYS.indexOf(key) >= 0 ? resolveImages(v) : v;
}
async function fsSetConfig(key, value){
  if(IMAGE_CONFIG_KEYS.indexOf(key) >= 0) value = await externalizeImages(value);
  await cfgDb(key).collection('config').doc(key).set({ value });
}

/* ---- Orders ---- */
async function fsGetOrders(){
  const snap = await colFor('orders').orderBy('id','desc').get();
  return snap.docs.map(d => Object.assign({}, d.data(), { _docId: d.id }));
}
/* ---- Payment proofs (receipt screenshots) live in their own collection / database so order documents stay small.
   Orders and wallet requests keep only `proofId`. Old records that still contain `receipt` keep working. ---- */
async function fsSaveProof(dataUrl, meta){
  const ref = await colFor('proofs').add(Object.assign({ dataUrl, createdAt: new Date().toISOString() }, meta || {}));
  return ref.id;
}
async function fsGetProof(id){
  const snap = await colFor('proofs').doc(id).get();
  return snap.exists ? snap.data() : null;
}
async function fsDeleteProof(id){ try{ await colFor('proofs').doc(id).delete(); }catch(e){} }
/* Moves `receipt` (base64) out of an order/request object into the proofs DB. Returns the proofId or null. */
async function moveReceiptToProofs(obj, kind){
  if(!obj.receipt) return null;
  const id = await fsSaveProof(obj.receipt, { kind, name: obj.receiptName || '', ref: obj.id || null, phone: obj.userPhone || obj.phone || '' });
  delete obj.receipt; obj.proofId = id;
  return id;
}
async function fsAddOrder(order){
  const o = Object.assign({}, order);
  const proofId = await moveReceiptToProofs(o, 'order');
  try{ await colFor('orders').add(o); }
  catch(e){ if(proofId) await fsDeleteProof(proofId); throw e; }
}
async function fsUpdateOrder(docId, data){
  await colFor('orders').doc(docId).update(data);
}
async function fsDeleteOrder(docId){
  const ref = colFor('orders').doc(docId);
  try{ const snap = await ref.get(); if(snap.exists && snap.data().proofId) await fsDeleteProof(snap.data().proofId); }catch(e){}
  await ref.delete();
}

/* ---- Users (doc ID = phone number) ---- */
async function fsGetUsers(){
  const snap = await db.collection('users').get();
  const obj = {};
  snap.docs.forEach(d => { obj[d.id] = d.data(); });
  return obj;
}
async function fsGetUser(phone){
  const snap = await db.collection('users').doc(phone).get();
  return snap.exists ? snap.data() : null;
}
async function fsSetUser(phone, data){
  if(isDataImage(data.avatar)) data = Object.assign({}, data, { avatar: await fsSaveImage(data.avatar) });
  await db.collection('users').doc(phone).set(data);
}

/* patch a user document (keeps every other field). Pictures go to the images database. */
async function fsMergeUser(phone, patch){
  if(isDataImage(patch.avatar)) patch = Object.assign({}, patch, { avatar: await fsSaveImage(patch.avatar) });
  await db.collection('users').doc(phone).set(patch, { merge: true });
}
/* ---------- Referral-point wallet codes ----------
   "Get Wallet": turns the customer's referral points (1 point = Rs. 1) into ONE personal, auto-generated, single-use code.
   The code lives in collection `pointCodes` (doc id = the code, so two codes can never be the same). Typing it into
   Wallet -> Redeem Code credits the money. Only the customer it was generated for can redeem it. */
function genPointCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';           // no 0/O/1/I confusion
  const rnd = n => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return 'REF-' + rnd(4) + '-' + rnd(4);
}
async function fsCreatePointCode(phone, earned, minPts){
  for(let attempt = 0; attempt < 5; attempt++){
    const code = genPointCode();
    const uRef = db.collection('users').doc(phone), cRef = db.collection('pointCodes').doc(code);
    try{
      return await db.runTransaction(async tx => {
        const u = await tx.get(uRef), c = await tx.get(cRef);
        if(c.exists) throw dbErr('dup', 'dup');
        if(!u.exists) throw dbErr('nouser', 'User not found');
        const used = u.data().pointsRedeemed || 0;
        const avail = Math.floor(round2(earned - used));
        if(avail < minPts) throw dbErr('nopoints', 'Not enough points');
        tx.set(uRef, { pointsRedeemed: round2(used + avail) }, { merge: true });
        tx.set(cRef, { code, phone, amount: avail, used: false, createdAt: new Date().toISOString() });
        return { code, amount: avail, redeemed: round2(used + avail) };
      });
    }catch(e){ if(e.code !== 'dup') throw e; }
  }
  throw dbErr('dup', 'Could not generate a unique code, try again');
}
async function fsGetMyPointCodes(phone){
  const snap = await db.collection('pointCodes').where('phone', '==', phone).get();
  return snap.docs.map(x => x.data()).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
/* returns null if no such code exists; otherwise credits the wallet atomically and returns { amount, balance } */
async function fsRedeemPointCode(code, phone){
  const cRef = db.collection('pointCodes').doc(code), wRef = db.collection('wallets').doc(phone);
  return db.runTransaction(async tx => {
    const c = await tx.get(cRef);
    if(!c.exists) return null;
    const x = c.data();
    if(x.phone !== phone) throw dbErr('notowner', 'This code belongs to another account');
    if(x.used) throw dbErr('used', 'Code already used');
    const w = await tx.get(wRef);
    const bal = round2(((w.exists ? w.data().balance : 0) || 0) + x.amount);
    tx.set(wRef, { balance: bal }, { merge: true });
    tx.update(cRef, { used: true, usedAt: new Date().toISOString() });
    return { amount: x.amount, balance: bal };
  });
}
/* find an existing account by Google uid / e-mail (Google sign-in) -> { phone, ...user } or null */
async function fsFindUserByGoogle(uid, email){
  let snap = await db.collection('users').where('googleUid', '==', uid).limit(1).get();
  if(snap.empty && email){
    for(const e of [...new Set([email, email.toLowerCase()])]){
      snap = await db.collection('users').where('email', '==', e).limit(1).get();
      if(!snap.empty) break;
    }
  }
  if(snap.empty) return null;
  return Object.assign({}, snap.docs[0].data(), { phone: snap.docs[0].id });
}

/* ---- Wallets (doc ID = phone number, or 'guest') ---- */
async function fsGetWalletBalance(key){
  const snap = await db.collection('wallets').doc(key).get();
  return snap.exists ? (snap.data().balance || 0) : 0;
}
async function fsSetWalletBalance(key, balance){
  await db.collection('wallets').doc(key).set({ balance }, { merge: true });
}
async function fsGetAllWallets(){
  const snap = await db.collection('wallets').get();
  const obj = {};
  snap.docs.forEach(d => { obj[d.id] = d.data().balance || 0; });
  return obj;
}

/* ---- Two wallet types per customer ----
   'ez'   = EZ Cash / Redeem Wallet  -> stored in the original `balance` field (so old balances keep working)
   'bank' = Bank Wallet              -> stored in `bankBalance` (paying from it adds a 0.75% processing charge) */
function walletField(type){ return type === 'bank' ? 'bankBalance' : 'balance'; }
function dbErr(code, message){ const e = new Error(message || code); e.code = code; return e; }
function round2(n){ return Math.round(Number((n * 100).toPrecision(12))) / 100; }   // half-up, immune to 7.575*100 = 757.4999999

async function fsGetAllWalletDocs(){
  const snap = await db.collection('wallets').get();
  const obj = {};
  snap.docs.forEach(d => { const x = d.data(); obj[d.id] = { ez: x.balance || 0, bank: x.bankBalance || 0 }; });
  return obj;
}
async function fsGetWalletBalances(key){
  const snap = await db.collection('wallets').doc(key).get();
  const x = snap.exists ? snap.data() : {};
  return { ez: x.balance || 0, bank: x.bankBalance || 0 };
}
/* ONE spendable balance = main `balance` + old `bankBalance` (the old Bank Wallet is merged into the main field the first time money is spent). */
async function fsGetTotalBalance(key){
  const b = await fsGetWalletBalances(key);
  return round2(b.ez + b.bank);
}
/* Atomic add/subtract on the wallet. Throws code 'insufficient' if it would go below 0. Returns the new balance.
   Spending ('ez' + negative delta) takes from main + old bank balance together and returns the NEW TOTAL. */
async function fsAdjustWallet(key, type, delta){
  const ref = db.collection('wallets').doc(key);
  const field = walletField(type);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const x = snap.exists ? snap.data() : {};
    if(type !== 'bank' && delta < 0){
      const total = round2((x.balance || 0) + (x.bankBalance || 0));
      const next = round2(total + delta);
      if(next < 0) throw dbErr('insufficient', 'Insufficient wallet balance');
      tx.set(ref, { balance: next, bankBalance: 0 }, { merge: true });
      return next;
    }
    const cur = x[field] || 0;
    const next = round2(cur + delta);
    if(next < 0) throw dbErr('insufficient', 'Insufficient wallet balance');
    tx.set(ref, { [field]: next }, { merge: true });
    return next;
  });
}
async function fsGetWalletDoc(key){
  const snap = await db.collection('wallets').doc(key).get();
  return snap.exists ? snap.data() : { balance: 0 };
}
async function fsMergeWalletDoc(key, data){
  await db.collection('wallets').doc(key).set(data, { merge: true });
}

/* ---- Wallet Recharge Requests (customer submits amount+receipt, admin approves) ---- */
async function fsGetWalletRequests(){
  const snap = await db.collection('walletRequests').orderBy('id','desc').get();
  return snap.docs.map(d => Object.assign({}, d.data(), { _docId: d.id }));
}
async function fsAddWalletRequest(req){
  const r = Object.assign({}, req);
  const proofId = await moveReceiptToProofs(r, 'walletRequest');
  try{ await db.collection('walletRequests').add(r); }
  catch(e){ if(proofId) await fsDeleteProof(proofId); throw e; }
}
/* deposit reference numbers must be unique — the same payment can't be submitted twice */
async function fsWalletReferenceExists(ref){
  const snap = await db.collection('walletRequests').where('reference','==',String(ref)).limit(1).get();
  return !snap.empty;
}
async function fsGetMyWalletRequests(phone){
  const snap = await db.collection('walletRequests').where('phone','==',phone).get();
  return snap.docs.map(d => Object.assign({}, d.data(), { _docId: d.id })).sort((a,b) => b.id - a.id);
}
async function fsUpdateWalletRequest(docId, data){
  await db.collection('walletRequests').doc(docId).update(data);
}


/* =====================================================================
   SHELL TOPUP  (separate accounts, shell balance, redeem pins)
   ===================================================================== */

/* ---- Shell users (doc ID = lower-cased email) — separate from SakinduStore users ---- */
async function fsGetShellUser(email){
  const snap = await db.collection('shellUsers').doc(email).get();
  return snap.exists ? snap.data() : null;
}
async function fsCreateShellUser(email, data){
  const ref = db.collection('shellUsers').doc(email);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if(snap.exists) throw dbErr('exists', 'Account already exists');
    tx.set(ref, data);
  });
}
async function fsGetShellUsers(){
  const snap = await db.collection('shellUsers').get();
  return snap.docs.map(d => Object.assign({}, d.data(), { _email: d.id }));
}
async function fsAdjustShells(email, delta){
  const ref = db.collection('shellUsers').doc(email);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if(!snap.exists) throw dbErr('nouser', 'User not found');
    const next = (snap.data().shells || 0) + delta;
    if(next < 0) throw dbErr('insufficient', 'Not enough shells');
    tx.update(ref, { shells: next });
    return next;
  });
}

/* ---- Shell orders (paid with shells, not money) ---- */
async function fsGetShellOrders(){
  const snap = await colFor('shellOrders').orderBy('id','desc').get();
  return snap.docs.map(d => Object.assign({}, d.data(), { _docId: d.id }));
}
async function fsPlaceShellOrder(email, order){
  // 1) take the shells (atomic, main DB)   2) save the order (orders DB)   — if 2 fails, give the shells back
  const userRef = db.collection('shellUsers').doc(email);
  const newBal = await db.runTransaction(async tx => {
    const snap = await tx.get(userRef);
    if(!snap.exists) throw dbErr('nouser', 'User not found');
    const bal = snap.data().shells || 0;
    if(bal < order.totalShells) throw dbErr('insufficient', 'Not enough shells');
    tx.update(userRef, { shells: bal - order.totalShells });
    return bal - order.totalShells;
  });
  try{ await colFor('shellOrders').add(order); }
  catch(e){ try{ await fsAdjustShells(email, order.totalShells); }catch(e2){ console.error('[db] shell refund after failed order also failed', e2); } throw e; }
  return newBal;
}
async function fsGetMyShellOrders(email){
  const snap = await colFor('shellOrders').where('email','==',email).get();
  return snap.docs.map(d => Object.assign({}, d.data(), { _docId: d.id })).sort((a,b) => b.id - a.id);
}
async function fsUpdateShellOrder(docId, data){
  await colFor('shellOrders').doc(docId).update(data);
}
async function fsRejectShellOrder(docId){
  // 1) mark Rejected (orders DB, atomic)  2) refund the shells (main DB)  3) clear the pending flag
  const orderRef = colFor('shellOrders').doc(docId);
  const o = await orderRef.firestore.runTransaction(async tx => {
    const snap = await tx.get(orderRef);
    if(!snap.exists) throw dbErr('noorder', 'Order not found');
    const d = snap.data();
    if(d.status === 'Rejected' && !d.refundPending) return null;
    if(d.status !== 'Rejected') tx.update(orderRef, { status: 'Rejected', refunded: true, refundPending: true });
    return d;
  });
  if(!o) return;
  try{ await fsAdjustShells(o.email, o.totalShells); }
  catch(e){ if(e.code !== 'nouser') throw e; }
  await orderRef.update({ refundPending: false });
}

/* ---- Redeem pins (doc ID = the pin code itself, so a code can never be duplicated)
   status: available -> (reserved) -> sold -> redeemed ---- */
function pinId(code){ return String(code || '').trim().toUpperCase(); }
async function fsGetPins(){
  const snap = await db.collection('shellPins').get();
  return snap.docs.map(d => Object.assign({}, d.data(), { _id: d.id }));
}
async function fsGetAvailablePins(){
  const snap = await db.collection('shellPins').where('status','==','available').get();
  return snap.docs.map(d => Object.assign({}, d.data(), { _id: d.id }));
}
async function fsAddPin(code, shells, price){
  const id = pinId(code);
  const ref = db.collection('shellPins').doc(id);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if(snap.exists) throw dbErr('exists', 'Duplicate code');
    tx.set(ref, { code: id, shells, price, status: 'available', createdAt: new Date().toISOString() });
  });
}
async function fsDeletePin(id){
  await db.collection('shellPins').doc(id).delete();
}
/* Customer redeems a pin they bought -> shells go to their Shell Topup account. */
async function fsRedeemPin(code, email){
  const pinRef = db.collection('shellPins').doc(pinId(code));
  const userRef = db.collection('shellUsers').doc(email);
  return db.runTransaction(async tx => {
    const pSnap = await tx.get(pinRef);
    const uSnap = await tx.get(userRef);
    if(!pSnap.exists) throw dbErr('invalid', 'Invalid pin');
    if(!uSnap.exists) throw dbErr('nouser', 'User not found');
    const pin = pSnap.data();
    if(pin.status === 'redeemed') throw dbErr('used', 'Pin already redeemed');
    if(pin.status !== 'sold') throw dbErr('invalid', 'Pin not active');
    const bal = (uSnap.data().shells || 0) + pin.shells;
    tx.update(pinRef, { status: 'redeemed', redeemedBy: email, redeemedAt: new Date().toISOString() });
    tx.update(userRef, { shells: bal });
    return { added: pin.shells, balance: bal };
  });
}
async function fsBuyPin(opts){
  const q = await db.collection('shellPins').where('status','==','available')
    .where('shells','==',opts.shells).where('price','==',opts.price).limit(5).get();
  if(q.empty) throw dbErr('soldout', 'Sold out');
  const orderRef = colFor('orders').doc();            // id is generated locally, nothing is written yet
  let claimed = null;
  // STEP 1 (main DB, atomic): claim one pin and, for wallet payments, take the money
  for(const cand of q.docs){
    try{
      claimed = await db.runTransaction(async tx => {
        const pinSnap = await tx.get(cand.ref);
        if(!pinSnap.exists || pinSnap.data().status !== 'available') throw dbErr('taken');
        const pin = pinSnap.data();
        const now = new Date().toISOString();
        if(opts.walletType){
          const wRef = db.collection('wallets').doc(opts.walletKey);
          const wSnap = await tx.get(wRef);
          const wd = wSnap.exists ? wSnap.data() : {};
          const cur = round2((wd.balance || 0) + (wd.bankBalance || 0));      // one Wallet Balance (main + old bank money)
          if(cur < opts.totalCharge) throw dbErr('insufficient', 'Insufficient wallet balance');
          opts.balanceAfter = round2(cur - opts.totalCharge); opts.balanceBefore = cur;
          tx.set(wRef, { balance: opts.balanceAfter, bankBalance: 0 }, { merge: true });
          tx.update(cand.ref, { status: 'sold', soldTo: opts.order.userPhone, soldAt: now, orderId: orderRef.id });
          return { id: cand.id, ref: cand.ref, code: pin.code, delivered: true };
        }
        tx.update(cand.ref, { status: 'reserved', reservedFor: opts.order.userPhone, reservedAt: now, orderId: orderRef.id });
        return { id: cand.id, ref: cand.ref, code: pin.code, delivered: false };
      });
      break;
    } catch(e){ if(e.code === 'taken') continue; throw e; }
  }
  if(!claimed) throw dbErr('soldout', 'Sold out');
  // STEP 2 (orders + proofs DBs): record the order. If this fails, undo step 1 so no money / pin is lost.
  const order = Object.assign({}, opts.order);
  if(opts.balanceAfter != null){ order.balanceBefore = opts.balanceBefore; order.balanceAfter = opts.balanceAfter; }
  let proofId = null;
  try{
    proofId = await moveReceiptToProofs(order, 'order');
    const doc = Object.assign(order, claimed.delivered
      ? { status: 'Approved', pinCode: claimed.code, pinDocId: claimed.id }
      : { status: 'Processing', pinDocId: claimed.id });
    let lastErr = null;
    for(let i = 0; i < 3; i++){
      try{ await orderRef.set(doc); lastErr = null; break; }catch(e){ lastErr = e; }
    }
    if(lastErr) throw lastErr;
  } catch(e){
    if(proofId) await fsDeleteProof(proofId);
    try{
      await db.runTransaction(async tx => {
        const reads = [await tx.get(claimed.ref)];
        let wRef = null, wSnap = null;
        if(opts.walletType){ wRef = db.collection('wallets').doc(opts.walletKey); wSnap = await tx.get(wRef); }
        tx.update(claimed.ref, { status: 'available', soldTo: firebase.firestore.FieldValue.delete(), soldAt: firebase.firestore.FieldValue.delete(),
          reservedFor: firebase.firestore.FieldValue.delete(), reservedAt: firebase.firestore.FieldValue.delete(), orderId: firebase.firestore.FieldValue.delete() });
        if(wRef){
          const field = walletField(opts.walletType);
          tx.set(wRef, { [field]: round2((wSnap.exists ? (wSnap.data()[field] || 0) : 0) + opts.totalCharge) }, { merge: true });
        }
      });
    } catch(e2){ console.error('[db] could not undo pin purchase after order failure', e2); }
    throw e;
  }
  return { pinCode: claimed.delivered ? claimed.code : null, delivered: claimed.delivered };
}
async function fsApprovePinOrder(orderDocId){
  const oRef = colFor('orders').doc(orderDocId);
  const oSnap = await oRef.get();
  if(!oSnap.exists) throw dbErr('noorder');
  const o = oSnap.data();
  // main DB: reserved -> sold (safe to repeat)
  const pRef = db.collection('shellPins').doc(o.pinDocId);
  const code = await db.runTransaction(async tx => {
    const pSnap = await tx.get(pRef);
    if(!pSnap.exists) throw dbErr('nopin', 'Pin missing');
    const p = pSnap.data();
    if(p.status === 'reserved') tx.update(pRef, { status: 'sold', soldTo: o.userPhone, soldAt: new Date().toISOString() });
    else if(!(p.status === 'sold' && p.soldTo === o.userPhone)) throw dbErr('badpin', 'Pin is not reserved for this order');
    return p.code;
  });
  // orders DB
  await oRef.update({ status: 'Approved', pinCode: code });
}
async function fsRejectOrderSafe(orderDocId){
  // 1) mark Rejected (orders DB, atomic)  2) refund wallet / free the reserved pin (main DB, atomic)  3) clear pending flag
  const oRef = colFor('orders').doc(orderDocId);
  const o = await oRef.firestore.runTransaction(async tx => {
    const snap = await tx.get(oRef);
    if(!snap.exists) throw dbErr('noorder');
    const d = snap.data();
    if(d.status === 'Rejected'){ return d.refundPending ? Object.assign({}, d, { _retry: true }) : null; }
    const refund = (d.walletType && d.userPhone && !d.refunded && d.status === 'Processing') ? (d.totalCharged || d.amount) : 0;
    tx.update(oRef, { status: 'Rejected', refunded: !!refund, refundPending: !!(refund || (d.pinDocId && d.status === 'Processing')) });
    return Object.assign({}, d, { _refund: refund });
  });
  if(!o) return { refunded: 0, walletType: null };
  const refund = o._retry ? ((o.walletType && o.userPhone && o.refunded) ? (o.totalCharged || o.amount) : 0) : (o._refund || 0);
  const releasePin = !!(o.pinDocId && (o._retry || o.status === 'Processing'));
  if(refund || releasePin){
    const pRef = releasePin ? db.collection('shellPins').doc(o.pinDocId) : null;
    const wRef = refund ? db.collection('wallets').doc(o.userPhone) : null;
    await db.runTransaction(async tx => {
      const pSnap = pRef ? await tx.get(pRef) : null;
      const wSnap = wRef ? await tx.get(wRef) : null;
      if(pRef && pSnap.exists && pSnap.data().status === 'reserved'){
        tx.update(pRef, { status: 'available', reservedFor: firebase.firestore.FieldValue.delete(), reservedAt: firebase.firestore.FieldValue.delete(), orderId: firebase.firestore.FieldValue.delete() });
      }
      if(wRef){
        const field = walletField(o.walletType);
        tx.set(wRef, { [field]: round2((wSnap.exists ? (wSnap.data()[field] || 0) : 0) + refund) }, { merge: true });
      }
    });
    await oRef.update({ refundPending: false });
  }
  return { refunded: refund, walletType: o.walletType || null };
}


/* =====================================================================
   One-time migration: move pictures that are still embedded in the main database into the images database.
   Safe to run more than once. Returns counts.
   ===================================================================== */
async function fsMigrateImagesToImagesDb(onProgress){
  const log = onProgress || function(){};
  const out = { configs: 0, configImages: 0, orders: 0, walletRequests: 0, avatars: 0, errors: [] };
  // 1) config documents that contain pictures (games, banners, event, accounts)
  for(const key of IMAGE_CONFIG_KEYS){
    try{
      const snap = await cfgDb(key).collection('config').doc(key).get();
      if(!snap.exists) continue;
      const stats = { images: 0 };
      const v = await externalizeImages(snap.data().value, stats);
      if(stats.images){ await cfgDb(key).collection('config').doc(key).set({ value: v }); out.configs++; out.configImages += stats.images; }
      log('config ' + key + ': ' + stats.images + ' image(s)');
    } catch(e){ out.errors.push(key + ': ' + (e.message || e)); }
  }
  // 2) receipts on orders
  try{
    const snap = await colFor('orders').get();
    for(const d of snap.docs){
      const o = d.data();
      if(!o.receipt) continue;
      const proofId = await fsSaveProof(o.receipt, { kind: 'order', name: o.receiptName || '', ref: o.id || null, phone: o.userPhone || '' });
      await d.ref.update({ proofId, receipt: firebase.firestore.FieldValue.delete() });
      out.orders++;
    }
    log('orders: ' + out.orders + ' receipt(s)');
  } catch(e){ out.errors.push('orders: ' + (e.message || e)); }
  // 3) receipts on wallet recharge requests
  try{
    const snap = await db.collection('walletRequests').get();
    for(const d of snap.docs){
      const r = d.data();
      if(!r.receipt) continue;
      const proofId = await fsSaveProof(r.receipt, { kind: 'walletRequest', name: r.receiptName || '', ref: r.id || null, phone: r.phone || '' });
      await d.ref.update({ proofId, receipt: firebase.firestore.FieldValue.delete() });
      out.walletRequests++;
    }
    log('wallet requests: ' + out.walletRequests + ' receipt(s)');
  } catch(e){ out.errors.push('walletRequests: ' + (e.message || e)); }
  // 4) profile pictures
  try{
    const snap = await db.collection('users').get();
    for(const d of snap.docs){
      const u = d.data();
      if(!isDataImage(u.avatar)) continue;
      await d.ref.update({ avatar: await fsSaveImage(u.avatar) });
      out.avatars++;
    }
    log('profile pictures: ' + out.avatars);
  } catch(e){ out.errors.push('users: ' + (e.message || e)); }
  return out;
}


/* =====================================================================
   FREE FIRE PLAYER INFO — usage limit
   Every user gets 2 lookups. The moment the 2nd one is used the account is locked for 24 hours
   (the page shows an hours:minutes:seconds countdown). A lone first lookup expires after 24 hours.
   Stored in `infoLimits/<feature>_<phone>` : { count, firstAt, lockedUntil }  (ms timestamps)
   ===================================================================== */
const INFO_LIMIT = 2;
const INFO_WINDOW_MS = 24 * 60 * 60 * 1000;
function infoLimitState(d, now){
  let count = (d && d.count) || 0, firstAt = (d && d.firstAt) || 0, lockedUntil = (d && d.lockedUntil) || 0;
  if(lockedUntil && now >= lockedUntil){ count = 0; firstAt = 0; lockedUntil = 0; }                 // lock finished -> fresh start
  else if(!lockedUntil && firstAt && now - firstAt >= INFO_WINDOW_MS){ count = 0; firstAt = 0; }    // old single use expired
  return { count, firstAt, lockedUntil, remaining: lockedUntil ? 0 : Math.max(0, INFO_LIMIT - count), limit: INFO_LIMIT };
}
/* `feature` keeps separate counters: 'info' (Player Info) and 'value' (Account Value) */
function infoLimitRef(phone, feature){ return db.collection('infoLimits').doc((feature || 'info') + '_' + phone); }
async function fsGetInfoLimit(phone, feature){
  const snap = await infoLimitRef(phone, feature).get();
  return infoLimitState(snap.exists ? snap.data() : null, Date.now());
}
/* uses one lookup (atomic). { allowed:false, ... } when the limit is already reached. */
async function fsConsumeInfoLookup(phone, feature){
  const ref = infoLimitRef(phone, feature);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const st = infoLimitState(snap.exists ? snap.data() : null, now);
    if(st.remaining <= 0) return Object.assign({ allowed: false }, st);
    const count = st.count + 1;
    const firstAt = st.firstAt || now;
    const lockedUntil = count >= INFO_LIMIT ? now + INFO_WINDOW_MS : 0;
    tx.set(ref, { count, firstAt, lockedUntil, updatedAt: new Date(now).toISOString() });
    return { allowed: true, count, firstAt, lockedUntil, remaining: Math.max(0, INFO_LIMIT - count), limit: INFO_LIMIT };
  });
}
