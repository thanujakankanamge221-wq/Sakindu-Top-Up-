/* ===== Firestore data layer for SakinduStore =====
   All functions are async — call with await. Requires firebase-init.js loaded first. */

/* ---- Generic single-document config store (games, videos, redeemCodes, priceOverrides, reviews, store) ---- */
async function fsGetConfig(key, defaultVal){
  try{
    const snap = await db.collection('config').doc(key).get();
    return snap.exists ? snap.data().value : defaultVal;
  } catch(e){ console.error('fsGetConfig', key, e); return defaultVal; }
}
async function fsSetConfig(key, value){
  try{
    await db.collection('config').doc(key).set({ value });
  } catch(e){ console.error('fsSetConfig', key, e); }
}

/* ---- Orders ---- */
async function fsGetOrders(){
  try{
    const snap = await db.collection('orders').orderBy('id','desc').get();
    return snap.docs.map(d => Object.assign({}, d.data(), { _docId: d.id }));
  } catch(e){ console.error('fsGetOrders', e); return []; }
}
async function fsAddOrder(order){
  try{
    await db.collection('orders').add(order);
  } catch(e){ console.error('fsAddOrder', e); }
}
async function fsUpdateOrder(docId, data){
  try{
    await db.collection('orders').doc(docId).update(data);
  } catch(e){ console.error('fsUpdateOrder', e); }
}
async function fsDeleteOrder(docId){
  try{
    await db.collection('orders').doc(docId).delete();
  } catch(e){ console.error('fsDeleteOrder', e); }
}

/* ---- Users (doc ID = phone number) ---- */
async function fsGetUsers(){
  try{
    const snap = await db.collection('users').get();
    const obj = {};
    snap.docs.forEach(d => { obj[d.id] = d.data(); });
    return obj;
  } catch(e){ console.error('fsGetUsers', e); return {}; }
}
async function fsGetUser(phone){
  try{
    const snap = await db.collection('users').doc(phone).get();
    return snap.exists ? snap.data() : null;
  } catch(e){ console.error('fsGetUser', e); return null; }
}
async function fsSetUser(phone, data){
  try{
    await db.collection('users').doc(phone).set(data);
  } catch(e){ console.error('fsSetUser', e); }
}

/* ---- Wallets (doc ID = phone number, or 'guest') ---- */
async function fsGetWalletBalance(key){
  try{
    const snap = await db.collection('wallets').doc(key).get();
    return snap.exists ? (snap.data().balance || 0) : 0;
  } catch(e){ console.error('fsGetWalletBalance', e); return 0; }
}
async function fsSetWalletBalance(key, balance){
  try{
    await db.collection('wallets').doc(key).set({ balance });
  } catch(e){ console.error('fsSetWalletBalance', e); }
}
async function fsGetAllWallets(){
  try{
    const snap = await db.collection('wallets').get();
    const obj = {};
    snap.docs.forEach(d => { obj[d.id] = d.data().balance || 0; });
    return obj;
  } catch(e){ console.error('fsGetAllWallets', e); return {}; }
}
