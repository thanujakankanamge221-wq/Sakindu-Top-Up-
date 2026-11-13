/* Lightweight store-closed overlay check for pages that don't load the full app.js.
   Requires firebase-init.js + db.js loaded first. */
(async function(){
  const overlay = document.getElementById('storeLockOverlay');
  if(!overlay) return;
  try{
    const store = await fsGetConfig('store', { closed:false, announcement:'' });
    if(store.closed){ overlay.classList.add('show'); }
  } catch(e){ console.error('store-check', e); }
})();
