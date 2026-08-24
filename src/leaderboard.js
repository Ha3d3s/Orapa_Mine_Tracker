import { db, ensureSignedIn } from "./firebase";
import { doc, getDoc, setDoc, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";

const NAME_KEY = "orapa_player_name";

export function getSavedName() {
  try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; }
}
export function saveName(name) {
  try { localStorage.setItem(NAME_KEY, name); } catch {}
}

// N'écrase le score existant que s'il est meilleur (ou inexistant). Ne fait jamais régresser
// le classement d'un joueur avec un temps plus lent.
export async function submitScore(puzzleIndex, seconds, name) {
  const user = await ensureSignedIn();
  const ref = doc(db, "puzzleScores", `${puzzleIndex}_${user.uid}`);
  const existing = await getDoc(ref);
  if (existing.exists() && existing.data().seconds <= seconds) return false;
  await setDoc(ref, { puzzleIndex, uid: user.uid, name: (name || "Anonyme").slice(0, 24), seconds, ts: Date.now() });
  return true;
}

export async function fetchTopScores(puzzleIndex, limitN = 10) {
  const q = query(
    collection(db, "puzzleScores"),
    where("puzzleIndex", "==", puzzleIndex),
    orderBy("seconds", "asc"),
    limit(limitN)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}
