/* ===== Firestore data layer for SakinduStore =====
   All functions are async — call with await. Requires firebase-init.js loaded first.
   Errors are NOT swallowed here — they propagate to the caller so real problems
   (permissions, network, misconfigured rules) can be shown to the user instead
   of silently failing. */

/* ---- Generic single-document config store (games, videos, redeemCodes, priceOverrides, reviews, store) ---- */
async function fsGetConfig(key, defaultVal){
  const snap = await db.collection('config').doc(key).get();
  return snap.exists ? snap.data().value : defaultVal;
}
async function fsSetConfig(key, value){
  await db.collection('config').doc(key).set({ value });
}

/* ---- Orders ---- */
async function fsGetOrders(){
  const snap = await db.collection('orders').orderBy('id','desc').get();
  return snap.docs.map(d => Object.assign({}, d.data(), { _docId: d.id }));
}
async function fsAddOrder(order){
  await db.collection('orders').add(order);
}
async function fsUpdateOrder(docId, data){
  await db.collection('orders').doc(docId).update(data);
}
async function fsDeleteOrder(docId){
  await db.collection('orders').doc(docId).delete();
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
  await db.collection('users').doc(phone).set(data);
}

/* ---- Wallets (doc ID = phone number, or 'guest') ---- */
async function fsGetWalletBalance(key){
  const snap = await db.collection('wallets').doc(key).get();
  return snap.exists ? (snap.data().balance || 0) : 0;
}
async function fsSetWalletBalance(key, balance){
  await db.collection('wallets').doc(key).set({ balance });
}
async function fsGetAllWallets(){
  const snap = await db.collection('wallets').get();
  const obj = {};
  snap.docs.forEach(d => { obj[d.id] = d.data().balance || 0; });
  return obj;
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
  await db.collection('walletRequests').add(req);
}
async function fsUpdateWalletRequest(docId, data){
  await db.collection('walletRequests').doc(docId).update(data);
}
