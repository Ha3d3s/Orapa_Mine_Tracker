import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDRlW2QyNnLKx5sZjcYN3fc0cYn4FS2Hkg",
  authDomain: "orapa-mine-duel.firebaseapp.com",
  projectId: "orapa-mine-duel",
  storageBucket: "orapa-mine-duel.firebasestorage.app",
  messagingSenderId: "464166411011",
  appId: "1:464166411011:web:6f2c8b3b936ed701e2e736",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Renvoie une Promise résolue avec l'utilisateur (anonyme) une fois connecté.
// Chaque appareil obtient un identifiant stable pour la session (persistant tant que
// le navigateur ne vide pas son stockage), sans email/mot de passe à gérer.
export function ensureSignedIn() {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          unsub();
          resolve(user);
        } else {
          signInAnonymously(auth).catch(reject);
        }
      },
      reject
    );
  });
}
