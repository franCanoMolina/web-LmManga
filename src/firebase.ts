import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, type Analytics } from "firebase/analytics";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyD5zwUK7HLkKPZuEnIiNyNuWHhT-4v0ZWw",
    authDomain: "duck-games-8a02a.firebaseapp.com",
    projectId: "duck-games-8a02a",
    storageBucket: "duck-games-8a02a.firebasestorage.app",
    messagingSenderId: "904799692936",
    appId: "1:904799692936:web:6ce65bafac5e9ece96d73d",
    measurementId: "G-VV83SD9VJM"
};

// Initialize Firebase
let app: FirebaseApp;
let analytics: Analytics;
let db: Firestore;

try {
    app = initializeApp(firebaseConfig);
    analytics = getAnalytics(app);
    db = getFirestore(app);
} catch (error) {
    console.error("Firebase initialization failed:", error);
}

export { app, analytics, db };
