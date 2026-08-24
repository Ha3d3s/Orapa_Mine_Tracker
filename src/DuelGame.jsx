import React, { useEffect, useState, useRef } from "react";
import { db, ensureSignedIn } from "./firebase";
import {
  doc, setDoc, getDoc, onSnapshot, updateDoc, serverTimestamp,
  collection, addDoc, query, where,
} from "firebase/firestore";
import { Users, Copy, Check, LogOut, Gem, CheckCircle2, Trophy, Skull, HelpCircle, X, RefreshCw } from "lucide-react";
import PieceBoardEditor from "./PieceBoardEditor";
import DuelBoard from "./DuelBoard";
import { recordDuelResult } from "./stats";
import MuteButton from "./MuteButton";
import { playShot, playAbsorbed, playWin, playLose } from "./sounds";
import {
  requiredPieceTypes, COLS, ROWS, CELL, X0, Y0, VBW, VBH, BW, BH,
  PIECE_DEFS, effSize, PORTS, portXY, colorById, castBeam, pieceAtCell, boardsMatch,
} from "./orapaEngine";

function randomCode(len = 5) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

const DEFAULT_SETTINGS = { guessAttempts: 3, extDiamant: false, extCorpsNoir: false };
const EMOJIS = ["💎", "⛏️", "🔦", "🕳️", "🧨", "😂", "😭", "😱", "😏", "🔥", "🏆", "💀"];

export default function DuelGame({ onExit }) {
  const [uid, setUid] = useState(null);
  const [screen, setScreen] = useState("menu");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [room, setRoom] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [myPieces, setMyPieces] = useState([]); // reste TOUJOURS en local, jamais envoyé à Firestore
  const [showHelp, setShowHelp] = useState(false);

  // ---- phase de jeu ----
  const [viewMode, setViewMode] = useState("game"); // 'game' | 'myBoard'
  const [actionMode, setActionMode] = useState(null); // null | 'beam' | 'cell'
  const [marks, setMarks] = useState(() => new Set()); // mémo "case vide" sur mon plateau d'hypothèse
  const [confirmBeamPort, setConfirmBeamPort] = useState(null);
  const [confirmCell, setConfirmCell] = useState(null);
  const [guessPieces, setGuessPieces] = useState([]); // persiste tout au long de la partie
  const [myQueries, setMyQueries] = useState([]);
  const [activeQueryId, setActiveQueryId] = useState(null);
  const [askedThisTurn, setAskedThisTurn] = useState(false);
  const [guessedThisTurn, setGuessedThisTurn] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [incomingReaction, setIncomingReaction] = useState(null); // {emoji, name}
  const lastReactionTsRef = useRef(0);
  const answeringRef = useRef(new Set());
  const guessProcessedRef = useRef(new Set());
  const statsRecordedRef = useRef(false);
  const soundPlayedRef = useRef(new Set());
  const matchNumberRef = useRef(null);
  const prevTurnRef = useRef(null);

  useEffect(() => {
    ensureSignedIn().then((u) => setUid(u.uid)).catch((e) => setError("Connexion impossible : " + e.message));
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const ref = doc(db, "rooms", roomId);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) { setError("Cette salle n'existe plus."); setRoomId(null); setScreen("menu"); return; }
      setRoom(snap.data());
    }, (e) => setError("Erreur de synchronisation : " + e.message));
    return () => unsub();
  }, [roomId]);

  async function createRoom() {
    if (!uid) return;
    setBusy(true); setError("");
    try {
      let code, ref, snap;
      do { code = randomCode(); ref = doc(db, "rooms", code); snap = await getDoc(ref); } while (snap.exists());
      await setDoc(ref, {
        playerA: uid, playerB: null, playerAName: "Joueur 1", playerBName: null,
        phase: "lobby", settings: DEFAULT_SETTINGS, createdAt: serverTimestamp(), matchNumber: 1,
      });
      setRoomId(code); setScreen("lobby");
    } catch (e) { setError("Impossible de créer la salle : " + e.message); } finally { setBusy(false); }
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
      if (data.playerA !== uid && data.playerB && data.playerB !== uid) { setError("Cette salle est déjà complète."); setBusy(false); return; }
      if (data.playerB == null && data.playerA !== uid) await updateDoc(ref, { playerB: uid, playerBName: "Joueur 2" });
      setRoomId(code); setScreen("lobby");
    } catch (e) { setError("Impossible de rejoindre : " + e.message); } finally { setBusy(false); }
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
  async function requestRematch() {
    if (!roomId || !room || room.phase !== "ended") return;
    await updateDoc(doc(db, "rooms", roomId), {
      phase: "placing",
      matchNumber: (room.matchNumber || 1) + 1,
      ready: { [room.playerA]: false },
      winner: null,
      guessesLeft: null,
      finalBoards: null,
      turn: null,
    });
  }

  useEffect(() => {
    if (!room || !roomId || !uid || uid !== room.playerA) return;
    if (room.phase === "placing" && room.ready && room.playerA && room.playerB && room.ready[room.playerA] && room.ready[room.playerB]) {
      const attempts = room.settings.guessAttempts;
      updateDoc(doc(db, "rooms", roomId), {
        phase: "playing", turn: room.playerA,
        guessesLeft: { [room.playerA]: attempts, [room.playerB]: attempts },
      });
    }
  }, [room, roomId, uid]);

  // reset de l'état local à chaque nouvelle manche (revanche), pour repartir sur une feuille blanche
  useEffect(() => {
    if (!room?.matchNumber) return;
    if (matchNumberRef.current === null) { matchNumberRef.current = room.matchNumber; return; }
    if (room.matchNumber === matchNumberRef.current) return;
    matchNumberRef.current = room.matchNumber;
    setMyPieces([]); setGuessPieces([]); setMarks(new Set());
    setAskedThisTurn(false); setGuessedThisTurn(false);
    setActiveQueryId(null); setActionMode(null); setViewMode("game");
    statsRecordedRef.current = false;
    answeringRef.current = new Set(); guessProcessedRef.current = new Set(); soundPlayedRef.current = new Set();
  }, [room?.matchNumber]);

  const oppUid = room && uid ? (uid === room.playerA ? room.playerB : room.playerA) : null;

  // reset des compteurs de tour quand c'est (re)devenu mon tour
  useEffect(() => {
    if (!room) return;
    if (room.turn !== prevTurnRef.current) {
      prevTurnRef.current = room.turn;
      if (room.turn === uid) { setAskedThisTurn(false); setGuessedThisTurn(false); }
    }
  }, [room, uid]);

  // écoute des questions ENTRANTES (ciblées sur moi) et réponse automatique, locale
  useEffect(() => {
    if (!roomId || !uid) return;
    const qRef = query(collection(db, "rooms", roomId, "queries"), where("target", "==", uid), where("status", "==", "pending"));
    const unsub = onSnapshot(qRef, (snap) => {
      snap.docs.forEach((d) => {
        if (answeringRef.current.has(d.id)) return;
        answeringRef.current.add(d.id);
        const data = d.data();
        let answer;
        if (data.type === "beam") {
          const port = PORTS.find((p) => p.side === data.params.side && p.index === data.params.index);
          const result = castBeam(port, myPieces);
          answer = result.absorbed
            ? { absorbed: true }
            : { exitSide: result.exitPort?.side, exitIndex: result.exitPort?.index, exitLabel: result.exitPort?.label, colorId: result.colorId };
        } else if (data.type === "cell") {
          const found = pieceAtCell(myPieces, data.params.col, data.params.row);
          if (!found) answer = { occupied: false };
          else if (found.absorbed) answer = { occupied: true, absorbed: true };
          else if (found.transparent) answer = { occupied: true, transparent: true };
          else answer = { occupied: true, colorId: found.colorId };
        } else if (data.type === "guess") {
          answer = { correct: boardsMatch(myPieces, data.params.pieces) };
        }
        updateDoc(doc(db, "rooms", roomId, "queries", d.id), { status: "answered", answer });
      });
    });
    return () => unsub();
  }, [roomId, uid, myPieces]);

  // écoute de MES questions (filtrées sur la manche en cours, pour ne pas mélanger avec une revanche précédente)
  useEffect(() => {
    if (!roomId || !uid || !room?.matchNumber) return;
    const qRef = query(collection(db, "rooms", roomId, "queries"), where("by", "==", uid), where("match", "==", room.matchNumber));
    const unsub = onSnapshot(qRef, (snap) => setMyQueries(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [roomId, uid, room?.matchNumber]);

  const activeQuery = myQueries.find((q) => q.id === activeQueryId) || null;

  // son à chaque réponse reçue (une seule fois par question)
  useEffect(() => {
    myQueries.forEach((q) => {
      if (q.status !== "answered" || soundPlayedRef.current.has(q.id)) return;
      soundPlayedRef.current.add(q.id);
      if (q.type === "beam" || q.type === "cell") {
        q.answer.absorbed ? playAbsorbed() : playShot();
      }
    });
  }, [myQueries]);

  // traitement automatique du résultat d'une proposition (victoire / défaite)
  useEffect(() => {
    if (!roomId || !uid || !room) return;
    const g = myQueries.find((q) => q.type === "guess" && q.status === "answered" && !guessProcessedRef.current.has(q.id));
    if (!g) return;
    guessProcessedRef.current.add(g.id);
    if (g.answer.correct) {
      updateDoc(doc(db, "rooms", roomId), { phase: "ended", winner: uid });
    } else {
      const left = Math.max(0, (room.guessesLeft?.[uid] ?? 1) - 1);
      const patch = { [`guessesLeft.${uid}`]: left };
      if (left <= 0) { patch.phase = "ended"; patch.winner = oppUid; }
      updateDoc(doc(db, "rooms", roomId), patch);
    }
  }, [myQueries, roomId, uid, room, oppUid]);

  // statistiques locales + son de victoire/défaite — une seule fois par partie, pour les deux joueurs
  useEffect(() => {
    if (!room || room.phase !== "ended" || !uid || statsRecordedRef.current) return;
    statsRecordedRef.current = true;
    const won = room.winner === uid;
    recordDuelResult(won);
    won ? playWin() : playLose();
  }, [room, uid]);

  // révélation des plateaux à la fin de la partie
  useEffect(() => {
    if (!roomId || !uid || !room) return;
    if (room.phase === "ended" && !(room.finalBoards && room.finalBoards[uid])) {
      updateDoc(doc(db, "rooms", roomId), { [`finalBoards.${uid}`]: myPieces });
    }
  }, [room, roomId, uid, myPieces]);

  async function submitBeamQuery(port) {
    setConfirmBeamPort(null);
    const ref = await addDoc(collection(db, "rooms", roomId, "queries"), {
      by: uid, target: oppUid, type: "beam", params: { side: port.side, index: port.index },
      status: "pending", createdAt: serverTimestamp(), match: room.matchNumber || 1,
    });
    setActiveQueryId(ref.id); setActionMode(null); setAskedThisTurn(true);
  }
  async function submitCellQuery(col, row) {
    setConfirmCell(null);
    const ref = await addDoc(collection(db, "rooms", roomId, "queries"), {
      by: uid, target: oppUid, type: "cell", params: { col, row },
      status: "pending", createdAt: serverTimestamp(), match: room.matchNumber || 1,
    });
    setActiveQueryId(ref.id); setActionMode(null); setAskedThisTurn(true);
  }
  async function submitGuess() {
    const ref = await addDoc(collection(db, "rooms", roomId, "queries"), {
      by: uid, target: oppUid, type: "guess",
      params: { pieces: guessPieces.map(({ id, type, col, row, rot, flipH, flipV }) => ({ id, type, col, row, rot, flipH: !!flipH, flipV: !!flipV })) },
      status: "pending", createdAt: serverTimestamp(), match: room.matchNumber || 1,
    });
    setActiveQueryId(ref.id); setGuessedThisTurn(true); setViewMode("game");
  }
  async function passTurn() {
    await updateDoc(doc(db, "rooms", roomId), { turn: oppUid });
  }
  async function endMyTurn() {
    setActiveQueryId(null); setActionMode(null); setViewMode("game");
    if (room.phase === "playing") await updateDoc(doc(db, "rooms", roomId), { turn: oppUid });
  }

  async function sendReaction(emoji) {
    setShowEmojiPicker(false);
    if (!roomId) return;
    const name = uid === room.playerA ? (room.playerAName || "Joueur 1") : (room.playerBName || "Joueur 2");
    await updateDoc(doc(db, "rooms", roomId), { lastReaction: { by: uid, name, emoji, ts: Date.now() } });
  }

  // affiche la réaction (la mienne ou celle de l'adversaire) quelques secondes
  useEffect(() => {
    if (!room?.lastReaction) return;
    if (room.lastReaction.ts === lastReactionTsRef.current) return;
    lastReactionTsRef.current = room.lastReaction.ts;
    setIncomingReaction(room.lastReaction);
    const t = setTimeout(() => setIncomingReaction(null), 2200);
    return () => clearTimeout(t);
  }, [room]);

  function toggleMark(c, r) {
    setMarks((m) => {
      const next = new Set(m);
      const key = c + "," + r;
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function leaveRoom() {
    setRoomId(null); setRoom(null); setScreen("menu");
    setActionMode(null); setActiveQueryId(null); setMyQueries([]); setGuessPieces([]);
    setViewMode("game"); setAskedThisTurn(false); setGuessedThisTurn(false); setMarks(new Set());
    answeringRef.current = new Set(); guessProcessedRef.current = new Set(); statsRecordedRef.current = false; soundPlayedRef.current = new Set(); matchNumberRef.current = null;
  }

  const isHost = room && uid === room.playerA;
  const bothJoined = room && room.playerA && room.playerB;
  const beamHistory = myQueries.filter((q) => q.type === "beam" && q.status === "answered");
  const cellHistory = myQueries.filter((q) => q.type === "cell" && q.status === "answered");

  return (
    <div className="min-h-screen w-full bg-[#12121C] text-[#EDE9E0] font-sans">
      <header className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-[#2A2A3A]">
        <div className="flex items-center gap-2">
          <Gem size={20} className="text-[#F2C744]" />
          <h1 className="text-lg font-bold" style={{ fontFamily: "Georgia, serif" }}>Orapa Mine — Duel en ligne</h1>
        </div>
        <div className="flex items-center gap-3">
          <MuteButton />
          <button onClick={() => setShowHelp(true)} className="p-1.5 rounded-full hover:bg-[#232336]" aria-label="Aide couleurs">
            <HelpCircle size={18} />
          </button>
          <button onClick={onExit} className="text-xs text-[#9A94A8] hover:text-[#EDE9E0] flex items-center gap-1">
            <LogOut size={14} /> Accueil
          </button>
        </div>
      </header>

      <div className="p-4 max-w-md mx-auto">
        {error && <div className="bg-[#4A2333] border border-[#6B2E42] text-[#F5A0A0] text-sm rounded-xl px-3 py-2 mb-4">{error}</div>}
        {!uid && <p className="text-sm text-[#9A94A8]">Connexion en cours…</p>}

        {uid && screen === "menu" && (
          <div className="flex flex-col gap-4">
            <button onClick={createRoom} disabled={busy} className="w-full py-3 rounded-xl bg-[#F2C744] hover:bg-[#E0B62F] text-[#12121C] font-semibold disabled:opacity-50">
              Créer une salle
            </button>
            <div className="flex items-center gap-2 text-xs text-[#6B6580]">
              <div className="h-px bg-[#2A2A3A] flex-1" /> ou <div className="h-px bg-[#2A2A3A] flex-1" />
            </div>
            <div className="flex gap-2">
              <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="Code de la salle (ex. K7XPQ)" maxLength={5}
                className="flex-1 bg-[#1B1B29] border border-[#2A2A3A] rounded-xl px-3 py-2.5 text-sm tracking-widest uppercase outline-none focus:border-[#F2C744]" />
              <button onClick={joinRoom} disabled={busy || !joinCode.trim()} className="px-4 rounded-xl bg-[#232336] hover:bg-[#2E2E46] font-medium disabled:opacity-50">Rejoindre</button>
            </div>
          </div>
        )}

        {uid && screen === "lobby" && room && room.phase === "lobby" && (
          <div className="flex flex-col gap-5">
            <div className="bg-[#1B1B29] border border-[#2A2A3A] rounded-2xl p-4 text-center">
              <p className="text-xs text-[#9A94A8] mb-1">Code de la salle — partage-le à ton adversaire</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-bold tracking-[0.3em] text-[#F2C744]">{roomId}</span>
                <button onClick={() => { navigator.clipboard?.writeText(roomId); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="p-1.5 rounded-lg hover:bg-[#232336]">
                  {copied ? <Check size={16} className="text-[#5FBF6B]" /> : <Copy size={16} />}
                </button>
              </div>
            </div>
            <div className="bg-[#1B1B29] border border-[#2A2A3A] rounded-2xl p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users size={16} /> Joueurs</h3>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between"><span>{room.playerAName || "Joueur 1"}</span><span className="text-[10px] bg-[#2E2650] text-[#C9B8F5] px-2 py-0.5 rounded-full">Hôte</span></div>
                <div className="flex items-center justify-between"><span>{room.playerBName || "En attente…"}</span>{!room.playerB && <span className="text-[10px] text-[#6B6580]">non connecté</span>}</div>
              </div>
            </div>
            <div className="bg-[#1B1B29] border border-[#2A2A3A] rounded-2xl p-4">
              <h3 className="text-sm font-semibold mb-3">Réglages de la partie</h3>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Nombre de tentatives pour la proposition finale</span>
                  <div className="flex items-center gap-2">
                    <button disabled={!isHost} onClick={() => updateSettings({ guessAttempts: Math.max(1, room.settings.guessAttempts - 1) })} className="w-7 h-7 rounded-lg bg-[#232336] disabled:opacity-40">−</button>
                    <span className="w-5 text-center font-semibold">{room.settings.guessAttempts}</span>
                    <button disabled={!isHost} onClick={() => updateSettings({ guessAttempts: Math.min(9, room.settings.guessAttempts + 1) })} className="w-7 h-7 rounded-lg bg-[#232336] disabled:opacity-40">+</button>
                  </div>
                </div>
                <label className="flex items-center justify-between text-sm"><span>Extension Diamant</span><input type="checkbox" disabled={!isHost} checked={room.settings.extDiamant} onChange={(e) => updateSettings({ extDiamant: e.target.checked })} /></label>
                <label className="flex items-center justify-between text-sm"><span>Extension Corps noir</span><input type="checkbox" disabled={!isHost} checked={room.settings.extCorpsNoir} onChange={(e) => updateSettings({ extCorpsNoir: e.target.checked })} /></label>
              </div>
              {!isHost && <p className="text-[11px] text-[#6B6580] mt-3">Seul l'hôte peut modifier les réglages.</p>}
            </div>
            {isHost ? (
              <button onClick={startGame} disabled={!bothJoined} className="w-full py-3 rounded-xl bg-[#F2C744] hover:bg-[#E0B62F] text-[#12121C] font-semibold disabled:opacity-40">
                {bothJoined ? "Lancer la partie" : "En attente du 2ᵉ joueur…"}
              </button>
            ) : <p className="text-center text-sm text-[#9A94A8]">En attente que l'hôte lance la partie…</p>}
            <button onClick={leaveRoom} className="text-xs text-[#6B6580] hover:text-[#E88] mx-auto">Quitter la salle</button>
          </div>
        )}

        {uid && screen === "lobby" && room && room.phase === "placing" && (() => {
          const allowedTypes = requiredPieceTypes(room.settings);
          const iAmReady = !!(room.ready && room.ready[uid]);
          const oReady = !!(room.ready && oppUid && room.ready[oppUid]);
          const allPlaced = myPieces.length === allowedTypes.length;
          return (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold">Place tes pièces</h3>
                <span className="text-xs text-[#6B6580]">{myPieces.length}/{allowedTypes.length} posées</span>
              </div>
              <PieceBoardEditor pieces={myPieces} onChange={setMyPieces} allowedTypes={allowedTypes} />
              <div className="mt-4 flex flex-col items-center gap-2 pb-8">
                {!iAmReady ? (
                  <button onClick={markReady} disabled={!allPlaced} className="w-full py-3 rounded-xl bg-[#F2C744] hover:bg-[#E0B62F] text-[#12121C] font-semibold disabled:opacity-40">
                    {allPlaced ? "Je suis prêt !" : `Place toutes tes pièces (${myPieces.length}/${allowedTypes.length})`}
                  </button>
                ) : <div className="flex items-center gap-2 text-sm text-[#5FBF6B]"><CheckCircle2 size={16} /> Tu es prêt — en attente de l'adversaire…</div>}
                <p className="text-xs text-[#6B6580]">Adversaire : {oReady ? <span className="text-[#5FBF6B]">prêt ✓</span> : "en train de placer ses pièces…"}</p>
                <button onClick={leaveRoom} className="text-xs text-[#6B6580] hover:text-[#E88] mt-2">Quitter la partie</button>
              </div>
            </div>
          );
        })()}

        {uid && screen === "lobby" && room && room.phase === "playing" && (() => {
          const myTurn = room.turn === uid;
          const allowedTypes = requiredPieceTypes(room.settings);
          const myGuessesLeft = room.guessesLeft?.[uid] ?? room.settings.guessAttempts;
          const waiting = activeQuery && activeQuery.status === "pending";
          const showResult = activeQuery && activeQuery.status === "answered";
          const canAsk = myTurn && !askedThisTurn && !waiting;
          const canGuess = myTurn && !guessedThisTurn && myGuessesLeft > 0 && !waiting;
          const canPass = myTurn && !askedThisTurn && !guessedThisTurn && !waiting;
          const canEndTurn = myTurn && (askedThisTurn || guessedThisTurn) && !waiting;
          const guessComplete = guessPieces.length === allowedTypes.length;

          return (
            <div>
              <div className="flex items-center justify-between mb-3 gap-2">
                <h3 className="text-base font-semibold">{myTurn ? "À toi de jouer" : "Tour de l'adversaire"}</h3>
                <div className="flex gap-2">
                  <button onClick={() => setShowEmojiPicker((v) => !v)} className="text-xs bg-[#232336] hover:bg-[#2E2E46] px-3 py-1.5 rounded-full">😀</button>
                  <button onClick={() => setViewMode(viewMode === "myBoard" ? "game" : "myBoard")} className="text-xs bg-[#232336] hover:bg-[#2E2E46] px-3 py-1.5 rounded-full whitespace-nowrap">
                    {viewMode === "myBoard" ? "Revenir au jeu" : "Revoir ma pose"}
                  </button>
                </div>
              </div>

              {showEmojiPicker && (
                <div className="bg-[#1B1B29] border border-[#2A2A3A] rounded-xl p-3 mb-3 grid grid-cols-6 gap-1">
                  {EMOJIS.map((e) => (
                    <button key={e} onClick={() => sendReaction(e)} className="text-2xl py-1.5 rounded-lg hover:bg-[#232336] active:scale-90 transition">{e}</button>
                  ))}
                </div>
              )}

              {viewMode === "myBoard" ? (
                <ReadOnlyBoard pieces={myPieces} />
              ) : (
                <>
                  <p className="text-xs text-[#9A94A8] mb-2">
                    Place ton hypothèse directement sur le plateau — les réponses déjà obtenues y sont affichées.
                  </p>
                  <DuelBoard
                    pieces={guessPieces}
                    onChange={setGuessPieces}
                    allowedTypes={allowedTypes}
                    marks={marks}
                    onToggleMark={toggleMark}
                    beamHistory={beamHistory}
                    cellHistory={cellHistory}
                    actionMode={actionMode}
                    canInteractBoard={canAsk && (actionMode === "beam" || actionMode === "cell")}
                    onPortTap={(port) => setConfirmBeamPort(port)}
                    onCellQueryTap={(col, row) => setConfirmCell({ col, row })}
                  />

                  <div className="mt-4 flex flex-col items-center gap-3 pb-8">
                    {waiting && <p className="text-sm text-[#F2C744] animate-pulse">En attente de la réponse de l'adversaire…</p>}

                    {showResult && (
                      <div className="w-full bg-[#1B1B29] border border-[#2A2A3A] rounded-xl p-3 text-sm">
                        <QueryResult q={activeQuery} />
                      </div>
                    )}

                    {!waiting && myTurn && actionMode === null && (
                      <div className="w-full flex flex-col gap-2">
                        {canAsk && (
                          <>
                            <button onClick={() => setActionMode("beam")} className="w-full py-3 rounded-xl bg-[#232336] hover:bg-[#2E2E46] text-sm font-medium">Interroger un point d'entrée</button>
                            <button onClick={() => setActionMode("cell")} className="w-full py-3 rounded-xl bg-[#232336] hover:bg-[#2E2E46] text-sm font-medium">Interroger une case</button>
                          </>
                        )}
                        {canGuess && (
                          <button onClick={submitGuess} disabled={!guessComplete} className="w-full py-3 rounded-xl bg-[#2E2650] hover:bg-[#3A2F66] text-sm font-medium disabled:opacity-40">
                            Proposer cette réponse ({myGuessesLeft} tentative{myGuessesLeft > 1 ? "s" : ""} restante{myGuessesLeft > 1 ? "s" : ""})
                            {!guessComplete && <span className="block text-[10px] text-[#9A94A8] mt-0.5">Place toutes tes pièces d'hypothèse d'abord ({guessPieces.length}/{allowedTypes.length})</span>}
                          </button>
                        )}
                        {canPass && <button onClick={passTurn} className="w-full py-2.5 rounded-xl bg-[#1B1B29] border border-[#2A2A3A] hover:bg-[#232336] text-xs text-[#9A94A8]">Passer mon tour</button>}
                        {canEndTurn && <button onClick={endMyTurn} className="w-full py-3 rounded-xl bg-[#F2C744] hover:bg-[#E0B62F] text-[#12121C] font-semibold">Terminer mon tour</button>}
                      </div>
                    )}

                    {!waiting && (actionMode === "beam" || actionMode === "cell") && (
                      <button onClick={() => setActionMode(null)} className="text-xs text-[#6B6580] hover:text-[#EDE9E0]">← Retour aux actions</button>
                    )}
                  </div>

                  {(beamHistory.length > 0 || cellHistory.length > 0) && (
                    <div className="mb-6">
                      <h4 className="text-xs font-semibold text-[#6B6580] mb-2">Historique de mes questions</h4>
                      <ul className="flex flex-col gap-1.5">
                        {[...beamHistory, ...cellHistory].map((q) => (
                          <li key={q.id} className="text-xs bg-[#1B1B29] border border-[#2A2A3A] rounded-lg px-3 py-2"><QueryResult q={q} /></li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              <button onClick={leaveRoom} className="text-xs text-[#6B6580] hover:text-[#E88] mx-auto block mt-2">Quitter la partie</button>

              {confirmBeamPort && <ConfirmModal text={`Interroger l'entrée ${confirmBeamPort.label} ?`} onCancel={() => setConfirmBeamPort(null)} onConfirm={() => submitBeamQuery(confirmBeamPort)} />}
              {confirmCell && <ConfirmModal text={`Interroger la case (col ${confirmCell.col + 1}, ligne ${confirmCell.row + 1}) ?`} onCancel={() => setConfirmCell(null)} onConfirm={() => submitCellQuery(confirmCell.col, confirmCell.row)} />}
            </div>
          );
        })()}

        {uid && screen === "lobby" && room && room.phase === "ended" && (
          <div className="flex flex-col items-center gap-6 py-6">
            {room.winner === uid ? (
              <div className="flex flex-col items-center gap-2 text-[#F2C744]"><Trophy size={48} /><h2 className="text-xl font-bold">Tu as gagné ! 🎉</h2></div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-[#9A94A8]"><Skull size={48} /><h2 className="text-xl font-bold">Tu as perdu</h2></div>
            )}
            <div className="w-full"><h3 className="text-sm font-semibold mb-2 text-center">Ton plateau</h3><ReadOnlyBoard pieces={myPieces} /></div>
            <div className="w-full">
              <h3 className="text-sm font-semibold mb-2 text-center">Plateau adverse</h3>
              {room.finalBoards && room.finalBoards[oppUid] ? <ReadOnlyBoard pieces={room.finalBoards[oppUid]} /> : <p className="text-center text-xs text-[#6B6580]">En attente de la révélation…</p>}
            </div>
            <div className="w-full flex gap-2">
              <button onClick={leaveRoom} className="flex-1 py-3 rounded-xl bg-[#232336] hover:bg-[#2E2E46] text-sm">Retour à l'accueil</button>
              <button onClick={requestRematch} className="flex-1 py-3 rounded-xl bg-[#F2C744] hover:bg-[#E0B62F] text-[#12121C] font-semibold text-sm flex items-center justify-center gap-1.5">
                <RefreshCw size={16} /> Revanche
              </button>
            </div>
          </div>
        )}
      </div>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {incomingReaction && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center animate-bounce">
          <span className="text-6xl drop-shadow-lg">{incomingReaction.emoji}</span>
          <span className="text-xs bg-[#1B1B29] border border-[#2A2A3A] rounded-full px-3 py-1 mt-1 text-[#C9C4D8]">{incomingReaction.name}</span>
        </div>
      )}
    </div>
  );
}

function ConfirmModal({ text, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-[#1B1B29] rounded-t-2xl sm:rounded-2xl w-full sm:w-96 p-4 border border-[#2A2A3A]" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold mb-4 text-center">{text}</h3>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-[#232336] hover:bg-[#2E2E46] text-sm font-medium">Non</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-[#F2C744] hover:bg-[#E0B62F] text-[#12121C] text-sm font-semibold">Oui</button>
        </div>
      </div>
    </div>
  );
}

function QueryResult({ q }) {
  if (q.type === "beam") {
    const entryPort = PORTS.find((p) => p.side === q.params.side && p.index === q.params.index);
    if (q.status === "pending") return <span>Entrée {entryPort?.label} — en attente…</span>;
    if (q.answer.absorbed) return <span>Entrée {entryPort?.label} → <strong>signal absorbé</strong> (corps noir)</span>;
    const c = colorById(q.answer.colorId);
    const isReturn = q.answer.exitSide === q.params.side && q.answer.exitIndex === q.params.index;
    return (
      <span className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full border border-[#0C0C14] shrink-0" style={{ background: c.hex }} />
        Entrée {entryPort?.label} → {isReturn ? "revient au même point" : `sort en ${q.answer.exitLabel}`} · {c.name}
      </span>
    );
  }
  if (q.type === "cell") {
    const label = `col ${q.params.col + 1}, ligne ${q.params.row + 1}`;
    if (q.status === "pending") return <span>Case ({label}) — en attente…</span>;
    if (!q.answer.occupied) return <span>Case ({label}) → vide</span>;
    if (q.answer.absorbed) return <span>Case ({label}) → <strong>signal absorbé</strong> (corps noir)</span>;
    if (q.answer.transparent) return <span>Case ({label}) → diamant (transparent)</span>;
    const c = colorById(q.answer.colorId);
    return (
      <span className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full border border-[#0C0C14] shrink-0" style={{ background: c.hex }} />
        Case ({label}) → {c.name}
      </span>
    );
  }
  if (q.type === "guess") {
    if (q.status === "pending") return <span>Proposition envoyée — en attente…</span>;
    return <span>{q.answer.correct ? "Proposition correcte !" : "Proposition incorrecte."}</span>;
  }
  return null;
}


function ReadOnlyBoard({ pieces }) {
  return (
    <svg viewBox={`0 0 ${VBW} ${VBH}`} className="w-full max-w-md mx-auto block" style={{ background: "#1B1B29", borderRadius: 10 }}>
      <g>
        {Array.from({ length: COLS + 1 }).map((_, i) => <line key={"v" + i} x1={X0 + i * CELL} y1={Y0} x2={X0 + i * CELL} y2={Y0 + BH} stroke="#3A3A52" strokeWidth={1} />)}
        {Array.from({ length: ROWS + 1 }).map((_, i) => <line key={"h" + i} x1={X0} y1={Y0 + i * CELL} x2={X0 + BW} y2={Y0 + i * CELL} stroke="#3A3A52" strokeWidth={1} />)}
        <rect x={X0} y={Y0} width={BW} height={BH} fill="none" stroke="#57577A" strokeWidth={2} />
      </g>
      {(pieces || []).map((p) => {
        const def = PIECE_DEFS[p.type];
        const { w: ew, h: eh } = effSize(def, p.rot);
        const anchorX = X0 + p.col * CELL, anchorY = Y0 + p.row * CELL;
        const cx = anchorX + (ew * CELL) / 2, cy = anchorY + (eh * CELL) / 2;
        const transform = `translate(${cx},${cy}) rotate(${p.rot}) scale(${p.flipH ? -1 : 1},${p.flipV ? -1 : 1}) translate(${-(def.w * CELL) / 2},${-(def.h * CELL) / 2})`;
        const ptsStr = def.pts.map(([x, y]) => `${x * CELL},${y * CELL}`).join(" ");
        return <g key={p.id} transform={transform}><polygon points={ptsStr} fill={def.color} stroke={def.stroke || "#0C0C14"} strokeWidth={1.2} /></g>;
      })}
    </svg>
  );
}

function HelpRow({ items, result }) {
  const r = colorById(result);
  return (
    <div className="flex items-center gap-1.5 mb-2.5 flex-wrap text-xs">
      {items.map((id, i) => {
        const c = colorById(id);
        return (
          <React.Fragment key={id}>
            {i > 0 && <span className="text-[#F2C744] font-bold text-sm">+</span>}
            <span className="w-5 h-5 rounded-full border border-[#0C0C14]" style={{ background: c.hex }} title={c.name} />
          </React.Fragment>
        );
      })}
      <span className="text-[#F2C744] font-bold text-sm mx-1">=</span>
      <span className="w-6 h-6 rounded-full border border-[#0C0C14] shrink-0" style={{ background: r.hex }} />
      <span className="text-[#EDE9E0] font-medium">{r.name}</span>
      <span className="text-[#8A84A0]">({r.common})</span>
    </div>
  );
}

function HelpModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-[#1B1B29] rounded-2xl w-full max-w-md p-5 border border-[#2A2A3A] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold flex items-center gap-2"><Gem size={18} /> Combinaisons de couleurs</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <p className="text-xs text-[#9A94A8] mb-3">Le faisceau se colore selon les gemmes qu'il traverse. Additionne les gemmes touchées pour obtenir la couleur de sortie.</p>
        <HelpRow items={["bleu", "blanc"]} result="bleuciel" />
        <HelpRow items={["jaune", "blanc"]} result="jauneclair" />
        <HelpRow items={["rouge", "blanc"]} result="rose" />
        <HelpRow items={["jaune", "bleu"]} result="vert" />
        <HelpRow items={["rouge", "bleu"]} result="violet" />
        <HelpRow items={["rouge", "jaune"]} result="orange" />
        <div className="h-px bg-[#2A2A3A] my-3" />
        <HelpRow items={["rouge", "jaune", "bleu"]} result="noir" />
        <HelpRow items={["rouge", "jaune", "bleu", "blanc"]} result="gris" />
        <HelpRow items={["jaune", "bleu", "blanc"]} result="vertclair" />
        <HelpRow items={["rouge", "bleu", "blanc"]} result="violetclair" />
        <HelpRow items={["rouge", "jaune", "blanc"]} result="orangeclair" />
        <div className="h-px bg-[#2A2A3A] my-3" />
        <div className="flex items-center gap-2 text-xs text-[#C9C4D8]">
          <span className="w-6 h-6 rounded-full border border-[#0C0C14] shrink-0" style={{ background: colorById("miss").hex }} />
          <span><strong>Aucun contact</strong> — le faisceau ressort sans avoir touché de gemme.</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#C9C4D8] mt-2">
          <span className="w-6 h-6 rounded-full border-2 border-dashed border-[#9A94A8] shrink-0" />
          <span>Anneau en pointillé = le faisceau ressort par le <strong>même point</strong> d'entrée.</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#C9C4D8] mt-2">
          <span className="w-6 h-6 rounded-full border border-[#0C0C14] shrink-0 bg-[#17171A]" />
          <span><strong>Signal absorbé</strong> — un corps noir a intercepté le faisceau (aucune sortie).</span>
        </div>
      </div>
    </div>
  );
}
