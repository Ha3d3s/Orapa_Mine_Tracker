import React, { useEffect, useState } from "react";
import { db, ensureSignedIn } from "./firebase";
import {
  doc, setDoc, getDoc, onSnapshot, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { Users, Copy, Check, LogOut, Gem, CheckCircle2 } from "lucide-react";
import PieceBoardEditor from "./PieceBoardEditor";
import { requiredPieceTypes } from "./orapaEngine";

function randomCode(len = 5) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans caractères ambigus (0/O, 1/I...)
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

const DEFAULT_SETTINGS = {
  guessAttempts: 3,
  extDiamant: false,
  extCorpsNoir: false,
};

export default function DuelGame({ onExit }) {
  const [uid, setUid] = useState(null);
  const [screen, setScreen] = useState("menu"); // 'menu' | 'lobby'
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [room, setRoom] = useState(null); // document temps réel de la salle
  const [roomId, setRoomId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [myPieces, setMyPieces] = useState([]); // reste TOUJOURS en local, jamais envoyé à Firestore

  useEffect(() => {
    ensureSignedIn()
      .then((u) => setUid(u.uid))
      .catch((e) => setError("Connexion impossible : " + e.message));
  }, []);

  // Écoute en temps réel la salle une fois qu'on y est
  useEffect(() => {
    if (!roomId) return;
    const ref = doc(db, "rooms", roomId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) { setError("Cette salle n'existe plus."); setRoomId(null); setScreen("menu"); return; }
        setRoom(snap.data());
      },
      (e) => setError("Erreur de synchronisation : " + e.message)
    );
    return () => unsub();
  }, [roomId]);

  async function createRoom() {
    if (!uid) return;
    setBusy(true); setError("");
    try {
      let code, ref, snap;
      // évite (rarissime) collision de code
      do {
        code = randomCode();
        ref = doc(db, "rooms", code);
        snap = await getDoc(ref);
      } while (snap.exists());
      await setDoc(ref, {
        playerA: uid,
        playerB: null,
        playerAName: "Joueur 1",
        playerBName: null,
        phase: "lobby",
        settings: DEFAULT_SETTINGS,
        createdAt: serverTimestamp(),
      });
      setRoomId(code);
      setScreen("lobby");
    } catch (e) {
      setError("Impossible de créer la salle : " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom() {
    if (!uid) return;
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setBusy(true); setError("");
    try {
      const ref = doc(db, "rooms", code);
      const snap = await getDoc(ref);
      if (!snap.exists()) { setError("Aucune salle avec ce code."); setBusy(false); return; }
      const data = snap.data();
      if (data.playerA !== uid && data.playerB && data.playerB !== uid) {
        setError("Cette salle est déjà complète.");
        setBusy(false);
        return;
      }
      if (data.playerB == null && data.playerA !== uid) {
        await updateDoc(ref, { playerB: uid, playerBName: "Joueur 2" });
      }
      setRoomId(code);
      setScreen("lobby");
    } catch (e) {
      setError("Impossible de rejoindre : " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateSettings(patch) {
    if (!roomId || !room) return;
    await updateDoc(doc(db, "rooms", roomId), { settings: { ...room.settings, ...patch } });
  }

  async function startGame() {
    if (!roomId) return;
    await updateDoc(doc(db, "rooms", roomId), { phase: "placing", ready: { [room.playerA]: false } });
  }

  async function markReady() {
    if (!roomId || !uid) return;
    await updateDoc(doc(db, "rooms", roomId), { [`ready.${uid}`]: true });
  }

  // L'hôte fait démarrer la partie (côté serveur) dès que les deux joueurs sont prêts.
  useEffect(() => {
    if (!room || !roomId || !uid || uid !== room.playerA) return;
    if (room.phase === "placing" && room.ready && room.playerA && room.playerB && room.ready[room.playerA] && room.ready[room.playerB]) {
      const attempts = room.settings.guessAttempts;
      updateDoc(doc(db, "rooms", roomId), {
        phase: "playing",
        turn: room.playerA,
        guessesLeft: { [room.playerA]: attempts, [room.playerB]: attempts },
      });
    }
  }, [room, roomId, uid]);

  function leaveRoom() {
    setRoomId(null);
    setRoom(null);
    setScreen("menu");
  }

  const isHost = room && uid === room.playerA;
  const bothJoined = room && room.playerA && room.playerB;

  return (
    <div className="min-h-screen w-full bg-[#12121C] text-[#EDE9E0] font-sans">
      <header className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-[#2A2A3A]">
        <div className="flex items-center gap-2">
          <Gem size={20} className="text-[#F2C744]" />
          <h1 className="text-lg font-bold" style={{ fontFamily: "Georgia, serif" }}>Orapa Mine — Duel en ligne</h1>
        </div>
        <button onClick={onExit} className="text-xs text-[#9A94A8] hover:text-[#EDE9E0] flex items-center gap-1">
          <LogOut size={14} /> Mode solo
        </button>
      </header>

      <div className="p-4 max-w-md mx-auto">
        {error && (
          <div className="bg-[#4A2333] border border-[#6B2E42] text-[#F5A0A0] text-sm rounded-xl px-3 py-2 mb-4">{error}</div>
        )}

        {!uid && <p className="text-sm text-[#9A94A8]">Connexion en cours…</p>}

        {uid && screen === "menu" && (
          <div className="flex flex-col gap-4">
            <button
              onClick={createRoom}
              disabled={busy}
              className="w-full py-3 rounded-xl bg-[#F2C744] hover:bg-[#E0B62F] text-[#12121C] font-semibold disabled:opacity-50"
            >
              Créer une salle
            </button>

            <div className="flex items-center gap-2 text-xs text-[#6B6580]">
              <div className="h-px bg-[#2A2A3A] flex-1" /> ou <div className="h-px bg-[#2A2A3A] flex-1" />
            </div>

            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Code de la salle (ex. K7XPQ)"
                maxLength={5}
                className="flex-1 bg-[#1B1B29] border border-[#2A2A3A] rounded-xl px-3 py-2.5 text-sm tracking-widest uppercase outline-none focus:border-[#F2C744]"
              />
              <button
                onClick={joinRoom}
                disabled={busy || !joinCode.trim()}
                className="px-4 rounded-xl bg-[#232336] hover:bg-[#2E2E46] font-medium disabled:opacity-50"
              >
                Rejoindre
              </button>
            </div>
          </div>
        )}

        {uid && screen === "lobby" && room && (
          <div className="flex flex-col gap-5">
            <div className="bg-[#1B1B29] border border-[#2A2A3A] rounded-2xl p-4 text-center">
              <p className="text-xs text-[#9A94A8] mb-1">Code de la salle — partage-le à ton adversaire</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-bold tracking-[0.3em] text-[#F2C744]">{roomId}</span>
                <button
                  onClick={() => { navigator.clipboard?.writeText(roomId); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                  className="p-1.5 rounded-lg hover:bg-[#232336]"
                >
                  {copied ? <Check size={16} className="text-[#5FBF6B]" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div className="bg-[#1B1B29] border border-[#2A2A3A] rounded-2xl p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users size={16} /> Joueurs</h3>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>{room.playerAName || "Joueur 1"}</span>
                  <span className="text-[10px] bg-[#2E2650] text-[#C9B8F5] px-2 py-0.5 rounded-full">Hôte</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{room.playerBName || "En attente…"}</span>
                  {!room.playerB && <span className="text-[10px] text-[#6B6580]">non connecté</span>}
                </div>
              </div>
            </div>

            <div className="bg-[#1B1B29] border border-[#2A2A3A] rounded-2xl p-4">
              <h3 className="text-sm font-semibold mb-3">Réglages de la partie</h3>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Nombre de tentatives pour la proposition finale</span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={!isHost}
                      onClick={() => updateSettings({ guessAttempts: Math.max(1, room.settings.guessAttempts - 1) })}
                      className="w-7 h-7 rounded-lg bg-[#232336] disabled:opacity-40"
                    >−</button>
                    <span className="w-5 text-center font-semibold">{room.settings.guessAttempts}</span>
                    <button
                      disabled={!isHost}
                      onClick={() => updateSettings({ guessAttempts: Math.min(9, room.settings.guessAttempts + 1) })}
                      className="w-7 h-7 rounded-lg bg-[#232336] disabled:opacity-40"
                    >+</button>
                  </div>
                </div>
                <label className="flex items-center justify-between text-sm">
                  <span>Extension Diamant</span>
                  <input type="checkbox" disabled={!isHost} checked={room.settings.extDiamant}
                    onChange={(e) => updateSettings({ extDiamant: e.target.checked })} />
                </label>
                <label className="flex items-center justify-between text-sm">
                  <span>Extension Corps noir</span>
                  <input type="checkbox" disabled={!isHost} checked={room.settings.extCorpsNoir}
                    onChange={(e) => updateSettings({ extCorpsNoir: e.target.checked })} />
                </label>
              </div>
              {!isHost && <p className="text-[11px] text-[#6B6580] mt-3">Seul l'hôte peut modifier les réglages.</p>}
            </div>

            {isHost ? (
              <button
                onClick={startGame}
                disabled={!bothJoined}
                className="w-full py-3 rounded-xl bg-[#F2C744] hover:bg-[#E0B62F] text-[#12121C] font-semibold disabled:opacity-40"
              >
                {bothJoined ? "Lancer la partie" : "En attente du 2ᵉ joueur…"}
              </button>
            ) : (
              <p className="text-center text-sm text-[#9A94A8]">En attente que l'hôte lance la partie…</p>
            )}

            <button onClick={leaveRoom} className="text-xs text-[#6B6580] hover:text-[#E88] mx-auto">
              Quitter la salle
            </button>
          </div>
        )}

        {uid && screen === "lobby" && room && room.phase === "placing" && (() => {
          const allowedTypes = requiredPieceTypes(room.settings);
          const iAmReady = !!(room.ready && room.ready[uid]);
          const oppUid = uid === room.playerA ? room.playerB : room.playerA;
          const oppReady = !!(room.ready && oppUid && room.ready[oppUid]);
          const allPlaced = myPieces.length === allowedTypes.length;
          return (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Place tes pièces</h3>
                <span className="text-xs text-[#6B6580]">{myPieces.length}/{allowedTypes.length} posées</span>
              </div>
              <PieceBoardEditor pieces={myPieces} onChange={setMyPieces} allowedTypes={allowedTypes} />
              <div className="mt-4 flex flex-col items-center gap-2 pb-8">
                {!iAmReady ? (
                  <button
                    onClick={markReady}
                    disabled={!allPlaced}
                    className="w-full py-3 rounded-xl bg-[#F2C744] hover:bg-[#E0B62F] text-[#12121C] font-semibold disabled:opacity-40"
                  >
                    {allPlaced ? "Je suis prêt !" : `Place toutes tes pièces (${myPieces.length}/${allowedTypes.length})`}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-[#5FBF6B]">
                    <CheckCircle2 size={16} /> Tu es prêt — en attente de l'adversaire…
                  </div>
                )}
                <p className="text-xs text-[#6B6580]">
                  Adversaire : {oppReady ? <span className="text-[#5FBF6B]">prêt ✓</span> : "en train de placer ses pièces…"}
                </p>
              </div>
            </div>
          );
        })()}

        {uid && screen === "lobby" && room && room.phase === "playing" && (
          <div className="mt-6 text-center text-sm text-[#9A94A8]">
            Les deux joueurs sont prêts — le tour de jeu (questions + proposition) arrive dans la prochaine étape 🙂
          </div>
        )}
      </div>
    </div>
  );
}
