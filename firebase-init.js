/* Firebase project config for SakinduStore — safe to be public in client-side code */
const firebaseConfig = {
  apiKey: "AIzaSyAy7M1NZpsMUlEutWZRX4SvtmsH0rJbF6M",
  authDomain: "sakindutopup.firebaseapp.com",
  projectId: "sakindutopup",
  storageBucket: "sakindutopup.firebasestorage.app",
  messagingSenderId: "841276161439",
  appId: "1:841276161439:web:5b5349b0d5a5ac345451aa"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

/* =====================================================================
   TWO DATABASES
     main    (the config above, project "sakindutopup")  -> all TEXT data exactly as before:
             users, wallets, orders, wallet requests, games, store settings, reviews, redeem codes,
             banners/accounts text + links, Shell users, Shell pins ...
     images  (project "sakindustore-f9526")               -> every IMAGE:
             payment proofs (receipts), game / package images, ad banners, event banners,
             upcoming-event image, account-store photos, profile pictures.
   In the main database an image is replaced by a tiny reference ("img:...") and the picture itself is
   stored once in the images database. Old records that still contain an embedded picture keep working.

   Extra slots exist if you ever want more databases: `orders` (orders + Shell Topup orders).
   A slot that is `null` simply uses the main database.
   ===================================================================== */
const EXTRA_FIREBASE_CONFIGS = {
  images: {
    apiKey: "AIzaSyDTB5W7cc7uxp02Yj_bDbdfFiV9pXruIzY",
    authDomain: "sakindustore-f9526.firebaseapp.com",
    projectId: "sakindustore-f9526",
    storageBucket: "sakindustore-f9526.firebasestorage.app",
    messagingSenderId: "427495983630",
    appId: "1:427495983630:web:fa0eca721b3f2bdce08a5f"
  },
  orders: null
};

const dbs = { main: db };
const dbStatus = { main: { connected: true, projectId: firebaseConfig.projectId } };
Object.keys(EXTRA_FIREBASE_CONFIGS).forEach(function(cat){
  const cfg = EXTRA_FIREBASE_CONFIGS[cat];
  if(cfg && cfg.projectId){
    try{
      dbs[cat] = firebase.initializeApp(cfg, 'db-' + cat).firestore();
      dbStatus[cat] = { connected: true, projectId: cfg.projectId };
    } catch(e){
      console.error('[SakinduStore] could not connect database "' + cat + '" — using main instead', e);
      dbs[cat] = db; dbStatus[cat] = { connected: false, projectId: null };
    }
  } else { dbs[cat] = db; dbStatus[cat] = { connected: false, projectId: null }; }
});
function dbFor(cat){ return dbs[cat] || db; }

/* Which collection lives in which database (everything not listed stays in main) */
const DB_BY_COLLECTION = { orders:'orders', shellOrders:'orders', proofs:'images', images:'images' };
const DB_BY_CONFIG_KEY = {};
function colFor(name){ return dbFor(DB_BY_COLLECTION[name] || 'main').collection(name); }
function cfgDb(key){ return dbFor(DB_BY_CONFIG_KEY[key] || 'main'); }
