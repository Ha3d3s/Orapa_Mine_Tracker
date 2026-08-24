import React, { useState, useEffect, useRef } from "react";
import { Gem, ChevronLeft, Trophy, Skull, HelpCircle, X } from "lucide-react";
import {
  PIECE_DEFS, effSize, isValidPlacement, COLS, ROWS, PORTS,
  castBeam, pieceAtCell, boardsMatch, colorById,
} from "./orapaEngine";
import DuelBoard from "./DuelBoard";
import { recordAIResult } from "./stats";
import MuteButton from "./MuteButton";
import { playShot, playAbsorbed, playWin, playLose, playWrong } from "./sounds";

const BASE_TYPES = ["triJaune", "triBleu", "triBlanc", "diamant", "rhombeRouge"];
const ROTS = [0, 90, 180, 270];

function generateRandomBoard(types) {
  const pieces = [];
  for (const type of types) {
    const def = PIECE_DEFS[type];
    let placed = false;
    for (let attempt = 0; attempt < 600 && !placed; attempt++) {
      const rot = def.canRotate ? ROTS[Math.floor(Math.random() * 4)] : 0;
      const flipH = def.canFlip ? Math.random() < 0.5 : false;
      const flipV = def.canFlip ? Math.random() < 0.5 : false;
      const { w, h } = effSize(def, rot);
      if (w > COLS || h > ROWS) continue;
      const col = Math.floor(Math.random() * (COLS - w + 1));
      const row = Math.floor(Math.random() * (ROWS - h + 1));
      if (isValidPlacement(pieces, type, col, row, rot, null, flipH, flipV)) {
        pieces.push({ id: type + "_" + pieces.length, type, col, row, rot, flipH, flipV });
        placed = true;
      }
    }
  }
  return pieces;
}

function QueryResult({ q }) {
  if (q.type === "beam") {
    const entryPort = PORTS.find((p) => p.side === q.params.side && p.index === q.params.index);
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
  const label = `col ${q.params.col + 1}, ligne ${q.params.row + 1}`;
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

const AI_STORAGE_KEY = "orapa_ai_state_v1";
function loadAISave() {
  try { return JSON.parse(localStorage.getItem(AI_STORAGE_KEY) || "null"); } catch { return null; }
}

export default function AIMode({ onExit }) {
  const savedRef = useRef(loadAISave());
  const initial = savedRef.current;
  const [screen, setScreen] = useState(initial?.screen === "play" ? "play" : "settings");
  const [guessAttempts, setGuessAttempts] = useState(() => initial?.guessAttempts || 3);
  const [extDiamant, setExtDiamant] = useState(false);
  const [extCorpsNoir, setExtCorpsNoir] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const [hiddenBoard, setHiddenBoard] = useState(() => initial?.hiddenBoard || []);
  const [allowedTypes, setAllowedTypes] = useState(() => initial?.allowedTypes || BASE_TYPES);
  const [guessesLeft, setGuessesLeft] = useState(() => initial?.guessesLeft ?? 3);
  const [guessPieces, setGuessPieces] = useState(() => initial?.guessPieces || []);
  const [marks, setMarks] = useState(() => new Set(initial?.marks || []));
  const [history, setHistory] = useState(() => initial?.history || []); // {type:'beam'|'cell', params, answer}
  const [actionMode, setActionMode] = useState(null);
  const [confirmBeamPort, setConfirmBeamPort] = useState(null);
  const [confirmCell, setConfirmCell] = useState(null);
  const [won, setWon] = useState(false);

  // sauvegarde locale automatique — uniquement pendant une partie en cours (reprend après rechargement)
  useEffect(() => {
    if (screen === "play") {
      localStorage.setItem(AI_STORAGE_KEY, JSON.stringify({
        screen, guessAttempts, hiddenBoard, allowedTypes, guessesLeft, guessPieces, marks: [...marks], history,
      }));
    } else {
      localStorage.removeItem(AI_STORAGE_KEY);
    }
  }, [screen, guessAttempts, hiddenBoard, allowedTypes, guessesLeft, guessPieces, marks, history]);

  function startGame() {
    const types = [...BASE_TYPES, ...(extDiamant ? ["triDiamant"] : []), ...(extCorpsNoir ? ["triNoir"] : [])];
    setAllowedTypes(types);
    setHiddenBoard(generateRandomBoard(types));
    setGuessesLeft(guessAttempts);
    setGuessPieces([]);
    setMarks(new Set());
    setHistory([]);
    setActionMode(null);
    setWon(false);
    setScreen("play");
  }

  function toggleMark(c, r) {
    setMarks((m) => {
      const next = new Set(m);
      const key = c + "," + r;
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function askBeam(port) {
    setConfirmBeamPort(null);
    const result = castBeam(port, hiddenBoard);
    const answer = result.absorbed
      ? { absorbed: true }
      : { exitSide: result.exitPort?.side, exitIndex: result.exitPort?.index, exitLabel: result.exitPort?.label, colorId: result.colorId };
    setHistory((h) => [...h, { id: Date.now() + Math.random(), type: "beam", params: { side: port.side, index: port.index }, answer }]);
    setActionMode(null);
    result.absorbed ? playAbsorbed() : playShot();
  }
  function askCell(col, row) {
    setConfirmCell(null);
    const found = pieceAtCell(hiddenBoard, col, row);
    let answer;
    if (!found) answer = { occupied: false };
    else if (found.absorbed) answer = { occupied: true, absorbed: true };
    else if (found.transparent) answer = { occupied: true, transparent: true };
    else answer = { occupied: true, colorId: found.colorId };
    setHistory((h) => [...h, { id: Date.now() + Math.random(), type: "cell", params: { col, row }, answer }]);
    setActionMode(null);
    playShot();
  }

  function submitGuess() {
    const correct = boardsMatch(hiddenBoard, guessPieces);
    if (correct) { setWon(true); setScreen("ended"); recordAIResult(true); playWin(); return; }
    const left = guessesLeft - 1;
    setGuessesLeft(left);
    if (left <= 0) { setWon(false); setScreen("ended"); recordAIResult(false); playLose(); }
    else playWrong();
  }

  const beamHistory = history.filter((q) => q.type === "beam");
  const cellHistory = history.filter((q) => q.type === "cell");
  const guessComplete = guessPieces.length === allowedTypes.length;

  return (
    <div className="min-h-screen w-full bg-[#12121C] text-[#EDE9E0] font-sans">
      <header className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-[#2A2A3A]">
        <div className="flex items-center gap-2">
          <Gem size={20} className="text-[#F2C744]" />
          <h1 className="text-lg font-bold" style={{ fontFamily: "Georgia, serif" }}>Orapa Mine — Contre l'IA</h1>
        </div>
        <div className="flex items-center gap-3">
          <MuteButton />
          {screen === "play" && (
            <button onClick={() => setShowHelp(true)} className="p-1.5 rounded-full hover:bg-[#232336]" aria-label="Aide couleurs"><HelpCircle size={18} /></button>
          )}
          <button onClick={onExit} className="text-xs text-[#9A94A8] hover:text-[#EDE9E0] flex items-center gap-1"><ChevronLeft size={14} /> Accueil</button>
        </div>
      </header>

      <div className="p-4 max-w-md mx-auto">
        {screen === "settings" && (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-[#9A94A8]">
              L'IA place un plateau caché aléatoire. Interroge-le autant de fois que tu veux, puis propose ta réponse dans la limite du nombre de tentatives choisi.
            </p>
            <div className="bg-[#1B1B29] border border-[#2A2A3A] rounded-2xl p-4">
              <h3 className="text-sm font-semibold mb-3">Réglages de la partie</h3>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Nombre de tentatives pour la proposition finale</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setGuessAttempts((v) => Math.max(1, v - 1))} className="w-7 h-7 rounded-lg bg-[#232336]">−</button>
                    <span className="w-5 text-center font-semibold">{guessAttempts}</span>
                    <button onClick={() => setGuessAttempts((v) => Math.min(9, v + 1))} className="w-7 h-7 rounded-lg bg-[#232336]">+</button>
                  </div>
                </div>
                <label className="flex items-center justify-between text-sm"><span>Extension Diamant</span><input type="checkbox" checked={extDiamant} onChange={(e) => setExtDiamant(e.target.checked)} /></label>
                <label className="flex items-center justify-between text-sm"><span>Extension Corps noir</span><input type="checkbox" checked={extCorpsNoir} onChange={(e) => setExtCorpsNoir(e.target.checked)} /></label>
              </div>
            </div>
            <button onClick={startGame} className="w-full py-3 rounded-xl bg-[#F2C744] hover:bg-[#E0B62F] text-[#12121C] font-semibold">Commencer la partie</button>
          </div>
        )}

        {screen === "play" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">À toi de jouer</h3>
              <span className="text-xs bg-[#1B1B29] border border-[#2A2A3A] rounded-full px-3 py-1.5">{guessesLeft} tentative{guessesLeft > 1 ? "s" : ""} restante{guessesLeft > 1 ? "s" : ""}</span>
            </div>
            <p className="text-xs text-[#9A94A8] mb-2">Place ton hypothèse directement sur le plateau — tes réponses obtenues y sont affichées.</p>

            <DuelBoard
              pieces={guessPieces}
              onChange={setGuessPieces}
              allowedTypes={allowedTypes}
              marks={marks}
              onToggleMark={toggleMark}
              beamHistory={beamHistory}
              cellHistory={cellHistory}
              actionMode={actionMode}
              canInteractBoard={actionMode === "beam" || actionMode === "cell"}
              onPortTap={(port) => setConfirmBeamPort(port)}
              onCellQueryTap={(col, row) => setConfirmCell({ col, row })}
            />

            <div className="mt-4 flex flex-col items-center gap-2 pb-8">
              {actionMode === null && (
                <div className="w-full flex flex-col gap-2">
                  <button onClick={() => setActionMode("beam")} className="w-full py-3 rounded-xl bg-[#232336] hover:bg-[#2E2E46] text-sm font-medium">Interroger un point d'entrée</button>
                  <button onClick={() => setActionMode("cell")} className="w-full py-3 rounded-xl bg-[#232336] hover:bg-[#2E2E46] text-sm font-medium">Interroger une case</button>
                  <button
                    onClick={submitGuess}
                    disabled={!guessComplete}
                    className="w-full py-3 rounded-xl bg-[#2E2650] hover:bg-[#3A2F66] text-sm font-medium disabled:opacity-40"
                  >
                    Proposer cette réponse
                    {!guessComplete && <span className="block text-[10px] text-[#9A94A8] mt-0.5">Place toutes tes pièces d'hypothèse d'abord ({guessPieces.length}/{allowedTypes.length})</span>}
                  </button>
                </div>
              )}
              {(actionMode === "beam" || actionMode === "cell") && (
                <button onClick={() => setActionMode(null)} className="text-xs text-[#6B6580] hover:text-[#EDE9E0]">← Retour aux actions</button>
              )}
            </div>

            {history.length > 0 && (
              <div className="mb-6">
                <h4 className="text-xs font-semibold text-[#6B6580] mb-2">Historique de mes questions</h4>
                <ul className="flex flex-col gap-1.5">
                  {history.map((q) => (
                    <li key={q.id} className="text-xs bg-[#1B1B29] border border-[#2A2A3A] rounded-lg px-3 py-2"><QueryResult q={q} /></li>
                  ))}
                </ul>
              </div>
            )}

            {confirmBeamPort && (
              <ConfirmModal text={`Interroger l'entrée ${confirmBeamPort.label} ?`} onCancel={() => setConfirmBeamPort(null)} onConfirm={() => askBeam(confirmBeamPort)} />
            )}
            {confirmCell && (
              <ConfirmModal text={`Interroger la case (col ${confirmCell.col + 1}, ligne ${confirmCell.row + 1}) ?`} onCancel={() => setConfirmCell(null)} onConfirm={() => askCell(confirmCell.col, confirmCell.row)} />
            )}
          </div>
        )}

        {screen === "ended" && (
          <div className="flex flex-col items-center gap-6 py-6">
            {won ? (
              <div className="flex flex-col items-center gap-2 text-[#F2C744]"><Trophy size={48} /><h2 className="text-xl font-bold">Tu as gagné ! 🎉</h2></div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-[#9A94A8]"><Skull size={48} /><h2 className="text-xl font-bold">Plus de tentatives — tu as perdu</h2></div>
            )}
            <div className="w-full">
              <h3 className="text-sm font-semibold mb-2 text-center">Plateau de l'IA (révélé)</h3>
              <RevealBoard pieces={hiddenBoard} />
            </div>
            <div className="w-full flex gap-2">
              <button onClick={onExit} className="flex-1 py-2.5 rounded-xl bg-[#232336] hover:bg-[#2E2E46] text-sm">Accueil</button>
              <button onClick={() => setScreen("settings")} className="flex-1 py-2.5 rounded-xl bg-[#F2C744] hover:bg-[#E0B62F] text-[#12121C] font-semibold text-sm">Nouvelle partie</button>
            </div>
          </div>
        )}
      </div>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
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

function RevealBoard({ pieces }) {
  const CELLPX = 40, X0 = 40, Y0 = 40, COLSN = 10, ROWSN = 8;
  const BWpx = COLSN * CELLPX, BHpx = ROWSN * CELLPX;
  return (
    <svg viewBox={`0 0 ${BWpx + 80} ${BHpx + 80}`} className="w-full max-w-md mx-auto block" style={{ background: "#1B1B29", borderRadius: 10 }}>
      <g>
        {Array.from({ length: COLSN + 1 }).map((_, i) => <line key={"v" + i} x1={X0 + i * CELLPX} y1={Y0} x2={X0 + i * CELLPX} y2={Y0 + BHpx} stroke="#3A3A52" strokeWidth={1} />)}
        {Array.from({ length: ROWSN + 1 }).map((_, i) => <line key={"h" + i} x1={X0} y1={Y0 + i * CELLPX} x2={X0 + BWpx} y2={Y0 + i * CELLPX} stroke="#3A3A52" strokeWidth={1} />)}
        <rect x={X0} y={Y0} width={BWpx} height={BHpx} fill="none" stroke="#57577A" strokeWidth={2} />
      </g>
      {pieces.map((p) => {
        const def = PIECE_DEFS[p.type];
        const { w: ew, h: eh } = effSize(def, p.rot);
        const anchorX = X0 + p.col * CELLPX, anchorY = Y0 + p.row * CELLPX;
        const cx = anchorX + (ew * CELLPX) / 2, cy = anchorY + (eh * CELLPX) / 2;
        const transform = `translate(${cx},${cy}) rotate(${p.rot}) scale(${p.flipH ? -1 : 1},${p.flipV ? -1 : 1}) translate(${-(def.w * CELLPX) / 2},${-(def.h * CELLPX) / 2})`;
        const ptsStr = def.pts.map(([x, y]) => `${x * CELLPX},${y * CELLPX}`).join(" ");
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
      </div>
    </div>
  );
}
