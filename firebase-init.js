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
