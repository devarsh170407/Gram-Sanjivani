import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAcPJLC3cCRb9q5s7DqvtPhbfaX_j08Z2U",
  authDomain: "gram-sanjivani.firebaseapp.com",
  projectId: "gram-sanjivani",
  storageBucket: "gram-sanjivani.firebasestorage.app",
  messagingSenderId: "410428443194",
  appId: "1:410428443194:web:29aaac0e1e75e1d4134303",
  measurementId: "G-7PMFM5E4DV"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
