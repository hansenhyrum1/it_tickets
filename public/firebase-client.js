import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC-mSgvUIapRIKGK4LDHIdFo9Ywlnd4Xe8",
  authDomain: "employee-app-992de.firebaseapp.com",
  projectId: "employee-app-992de",
  storageBucket: "employee-app-992de.firebasestorage.app",
  messagingSenderId: "772817926933",
  appId: "1:772817926933:web:770c3f8bba41306a40c71c",
  measurementId: "G-7YF55E3YLT"
};

export const DATABASE_ID = "it-tickets";
export const PROJECT_ID = firebaseConfig.projectId;

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, DATABASE_ID);
