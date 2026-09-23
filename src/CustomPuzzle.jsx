import React, { useState, useRef } from "react";
import { ChevronLeft, Wrench, Copy, Check, Clock, Trophy } from "lucide-react";
import { db, ensureSignedIn } from "./firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { PORTS, castBeam, boardsMatch } from "./orapaEngine";
import PieceBoardEditor from "./PieceBoardEditor";
import DuelBoard from "./DuelBoard";
import { playWin, playWrong } from "./sounds";

const CREATOR_TYPES = ["triJaune", "triBleu", "triBlanc", "diamant", "rhombeRouge", "triDiamant", "triNoir"];

function randomCode(len = 5) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function formatTime(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function CustomPuzzle({ onBack }) {
  const [screen, setScreen] = useState("menu");
  const [creatorPieces, setCreatorPieces] = useState([]);
  const [code, setCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const [solvingPuzzle, setSolvingPuzzle] = useState(null);
  const [guessPieces, setGuessPieces] = useState([]);
  const [marks, setMarks] = useState(() => new Set());
  const [elapsed, setElapsed] = useState(0);
  const [finalTime, setFinalTime] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const startRef = useRef(null);

  async function generateCode() {
    if (creatorPieces.length === 0) return;
    setBusy(true); setError("");
    try {
      const user = await ensureSignedIn();
      let c, ref, snap;
      do { c = randomCode(); ref = doc(db, "customPuzzles", c); snap = await getDoc(ref); } while (snap.exists());
      const allowedTypes = [...new Set(creatorPieces.map((p) => p.type))];
      await setDoc(ref, {
        pieces: creatorPieces.map(({ id, type, col, row, rot, flipH, flipV }) => ({ id, type, col, row, rot, flipH: !!flipH, flipV: !!flipV })),
        allowedTypes,
        creator: user.uid,
        createdAt: Date.now(),
      });
      setCode(c);
      setScreen("created");
    } catch (e) {
      setError("Impossible de générer le code : " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadCode() {
    const c = joinCode.trim().toUpperCase();
    if (!c) return;
    setBusy(true); setError("");
    try {
      await ensureSignedIn();
      const ref = doc(db, "customPuzzles", c);
      const snap = await getDoc(ref);
      if (!snap.exists()) { setError("Aucun puzzle avec ce code."); setBusy(false); return; }
      setSolvingPuzzle(snap.data());
      setGuessPieces([]);
      setMarks(new Set());
      setFinalTime(null);
      setFeedback(null);
      startRef.current = Date.now();
      setElapsed(0);
      setScreen("solve");
    } catch (e) {
      setError("Impossible de charger ce code : " + e.message);
    } finally {
      setBusy(false);
    }
  }

  React.useEffect(() => {
    if (screen !== "solve") return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [screen]);

  const beamHistory = solvingPuzzle
    ? PORTS.map((p) => {
        const result = castBeam(p, solvingPuzzle.pieces);
        const answer = result.absorbed
          ? { absorbed: true }
          : { exitSide: result.exitPort?.side, exitIndex: result.exitPort?.index, colorId: result.colorId };
        return { params: { side: p.side, index: p.index }, answer };
      })
    : [];

  function checkSolution() {
    if (boardsMatch(solvingPuzzle.pieces, guessPieces)) {
      setFinalTime(Math.floor((Date.now() - startRef.current) / 1000));
      setScreen("solved");
      playWin();
    } else {
      setFeedback("wrong");
      setTimeout(() => setFeedback(null), 1800);
      playWrong();
    }
  }

  const complete = solvingPuzzle && guessPieces.length === solvingPuzzle.allowedTypes.length;

  return (
    <div className="min-h-screen w-full bg-[#12121C] text-[#EDE9E0] font-sans">
      <header className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-[#2A2A3A]">
        <div className="flex items-center gap-2">
          <Wrench size={20} className="text-[#F2C744]" />
          <h1 className="text-lg font-bold" style={{ fontFamily: "Georgia, serif" }}>Puzzle personnalisé</h1>
        </div>
        <button onClick={screen === "menu" ? onBack : () => setScreen("menu")} className="text-xs text-[#9A94A8] hover:text-[#EDE9E0] flex items-center gap-1">
          <ChevronLeft size={14} /> {screen === "menu" ? "Puzzles" : "Menu"}
        </button>
      </header>

      <div className="p-4 max-w-md mx-auto">
        {error && <div className="bg-[#4A2333] border border-[#6B2E42] text-[#F5A0A0] text-sm rounded-xl px-3 py-2 mb-4">{error}</div>}

        {screen === "menu" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-[#9A94A8]">Construis ton propre plateau et partage un code, ou entre le code d'un ami pour résoudre le sien.</p>
            <button onClick={() => { setCreatorPieces([]); setScreen("create"); }} className="w-full py-3 rounded-xl bg-[#F2C744] hover:bg-[#E0B62F] text-[#12121C] font-semibold">
              Créer un puzzle
            </button>
            <div className="flex items-center gap-2 text-xs text-[#6B6580]">
              <div className="h-px bg-[#2A2A3A] flex-1" /> ou <div className="h-px bg-[#2A2A3A] flex-1" />
            </div>
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Code du puzzle (ex. K7XPQ)"
                maxLength={5}
                className="flex-1 bg-[#1B1B29] border border-[#2A2A3A] rounded-xl px-3 py-2.5 text-sm tracking-widest uppercase outline-none focus:border-[#F2C744]"
              />
              <button onClick={loadCode} disabled={busy || !joinCode.trim()} className="px-4 rounded-xl bg-[#232336] hover:bg-[#2E2E46] font-medium disabled:opacity-50">
                Jouer
              </button>
            </div>
          </div>
        )}

        {screen === "create" && (
          <div>
            <h3 className="text-sm font-semibold mb-2">Place les pièces que tu veux</h3>
            <PieceBoardEditor pieces={creatorPieces} onChange={setCreatorPieces} allowedTypes={CREATOR_TYPES} />
            <button
              onClick={generateCode}
              disabled={busy || creatorPieces.length === 0}
              className="w-full mt-4 py-3 rounded-xl bg-[#F2C744] hover:bg-[#E0B62F] text-[#12121C] font-semibold disabled:opacity-40"
            >
              Générer le code à partager
            </button>
          </div>
        )}

        {screen === "created" && (
          <div className="flex flex-col items-center gap-5 py-6">
            <p className="text-sm text-[#9A94A8] text-center">Partage ce code à un ami pour qu'il résolve ton puzzle :</p>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold tracking-[0.3em] text-[#F2C744]">{code}</span>
              <button onClick={() => { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="p-2 rounded-lg hover:bg-[#232336]">
                {copied ? <Check size={18} className="text-[#5FBF6B]" /> : <Copy size={18} />}
              </button>
            </div>
            <button onClick={() => setScreen("menu")} className="px-5 py-2.5 rounded-xl bg-[#232336] hover:bg-[#2E2E46] text-sm">Retour au menu</button>
          </div>
        )}

        {screen === "solve" && solvingPuzzle && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Puzzle de {code || joinCode.toUpperCase()}</h3>
              <div className="flex items-center gap-1.5 text-sm font-mono bg-[#1B1B29] border border-[#2A2A3A] rounded-full px-3 py-1.5">
                <Clock size={14} className="text-[#F2C744]" /> {formatTime(elapsed)}
              </div>
            </div>
            <DuelBoard
              pieces={guessPieces}
              onChange={setGuessPieces}
              allowedTypes={solvingPuzzle.allowedTypes}
              marks={marks}
              onToggleMark={(c, r) => setMarks((m) => { const n = new Set(m); const k = c + "," + r; n.has(k) ? n.delete(k) : n.add(k); return n; })}
              beamHistory={beamHistory}
              cellHistory={[]}
              actionMode={null}
              canInteractBoard={false}
              onPortTap={() => {}}
              onCellQueryTap={() => {}}
            />
            <div className="mt-4 flex flex-col items-center gap-2 pb-8">
              {feedback === "wrong" && <p className="text-sm text-[#E88]">Pas encore ça — continue !</p>}
              <button onClick={checkSolution} disabled={!complete} className="w-full py-3 rounded-xl bg-[#F2C744] hover:bg-[#E0B62F] text-[#12121C] font-semibold disabled:opacity-40">
                Vérifier ma solution {!complete && `(${guessPieces.length}/${solvingPuzzle.allowedTypes.length})`}
              </button>
            </div>
          </div>
        )}

        {screen === "solved" && (
          <div className="flex flex-col items-center gap-4 py-10">
            <Trophy size={48} className="text-[#F2C744]" />
            <h2 className="text-xl font-bold">Résolu en {formatTime(finalTime)} !</h2>
            <div className="w-full flex gap-2">
              <button onClick={() => setScreen("menu")} className="flex-1 py-2.5 rounded-xl bg-[#232336] hover:bg-[#2E2E46] text-sm">Menu</button>
              <button onClick={onBack} className="flex-1 py-2.5 rounded-xl bg-[#F2C744] hover:bg-[#E0B62F] text-[#12121C] font-semibold text-sm">Puzzles</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
