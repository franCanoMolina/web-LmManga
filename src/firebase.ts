import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

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
const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const db = getFirestore(app);
