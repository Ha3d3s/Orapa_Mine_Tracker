import React, { useEffect, useMemo, useState, useRef } from "react";
import { Gem, ChevronLeft, Clock, Trophy, RotateCcw, HelpCircle, X } from "lucide-react";
import { PUZZLE_COUNT, generatePuzzle, difficultyForIndex } from "./puzzles";
import { PORTS, boardsMatch, colorById } from "./orapaEngine";
import DuelBoard from "./DuelBoard";
import { recordPuzzleSolved } from "./stats";
import MuteButton from "./MuteButton";
import { playWin, playWrong } from "./sounds";
import { submitScore, fetchTopScores, getSavedName, saveName } from "./leaderboard";

const STORAGE_KEY = "orapa_puzzle_best_v1";

function loadBestTimes() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function saveBestTime(index, seconds) {
  const best = loadBestTimes();
  if (best[index] == null || seconds < best[index]) {
    best[index] = seconds;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(best));
  }
  return best;
}
function formatTime(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
const DIFF_LABEL = { tresfacile: "Très facile", facile: "Facile", moyen: "Moyen", difficile: "Difficile" };
const DIFF_COLOR = { tresfacile: "#8FC5EA", facile: "#5FBF6B", moyen: "#F2C744", difficile: "#E05C5C" };

export default function PuzzleMode({ onExit }) {
  const [screen, setScreen] = useState("list"); // 'list' | 'play'
  const [showHelp, setShowHelp] = useState(false);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [guessPieces, setGuessPieces] = useState([]);
  const [marks, setMarks] = useState(() => new Set());
  const [solved, setSolved] = useState(false);
  const [finalTime, setFinalTime] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [bestTimes, setBestTimes] = useState(() => loadBestTimes());
  const [playerName, setPlayerName] = useState(() => getSavedName());
  const [lbScores, setLbScores] = useState(null);
  const [lbLoading, setLbLoading] = useState(false);
  const [lbSubmitted, setLbSubmitted] = useState(false);
  const startRef = useRef(null);

  const puzzle = useMemo(() => generatePuzzle(puzzleIndex), [puzzleIndex]);

  const beamHistory = useMemo(() => PORTS.map((p) => ({
    params: { side: p.side, index: p.index },
    answer: puzzle.clues[p.id],
  })), [puzzle]);

  useEffect(() => {
    if (screen !== "play" || solved) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [screen, solved]);

  useEffect(() => {
    if (!solved) { setLbScores(null); setLbSubmitted(false); return; }
    (async () => {
      if (playerName.trim()) {
        try { await submitScore(puzzleIndex, finalTime, playerName.trim()); setLbSubmitted(true); } catch (e) { /* pas grave, hors-ligne ou indisponible */ }
      }
      await loadLeaderboard();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved]);

  async function loadLeaderboard() {
    setLbLoading(true);
    try { setLbScores(await fetchTopScores(puzzleIndex)); } catch (e) { setLbScores([]); }
    setLbLoading(false);
  }

  async function handlePublishScore() {
    if (!playerName.trim()) return;
    saveName(playerName.trim());
    try { await submitScore(puzzleIndex, finalTime, playerName.trim()); setLbSubmitted(true); } catch (e) { /* réessaiera au prochain puzzle */ }
    await loadLeaderboard();
  }

  function openPuzzle(index) {
    setPuzzleIndex(index);
    setGuessPieces([]);
    setMarks(new Set());
    setSolved(false);
    setFinalTime(null);
    setFeedback(null);
    startRef.current = Date.now();
    setElapsed(0);
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

  function checkSolution() {
    if (boardsMatch(puzzle.pieces, guessPieces)) {
      const secs = Math.floor((Date.now() - startRef.current) / 1000);
      setFinalTime(secs);
      setSolved(true);
      setBestTimes(saveBestTime(puzzleIndex, secs));
      recordPuzzleSolved(secs);
      playWin();
    } else {
      setFeedback("wrong");
      setTimeout(() => setFeedback(null), 1800);
      playWrong();
    }
  }

  const complete = guessPieces.length === puzzle.allowedTypes.length;

  return (
    <div className="min-h-screen w-full bg-[#12121C] text-[#EDE9E0] font-sans">
      <header className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-[#2A2A3A]">
        <div className="flex items-center gap-2">
          <Gem size={20} className="text-[#F2C744]" />
          <h1 className="text-lg font-bold" style={{ fontFamily: "Georgia, serif" }}>Orapa Mine — Puzzles</h1>
        </div>
        <div className="flex items-center gap-3">
          <MuteButton />
          <button onClick={() => setShowHelp(true)} className="p-1.5 rounded-full hover:bg-[#232336]" aria-label="Aide couleurs">
            <HelpCircle size={18} />
          </button>
          <button onClick={screen === "play" ? () => setScreen("list") : onExit} className="text-xs text-[#9A94A8] hover:text-[#EDE9E0] flex items-center gap-1">
            <ChevronLeft size={14} /> {screen === "play" ? "Liste des puzzles" : "Accueil"}
          </button>
        </div>
      </header>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      <div className="p-4 max-w-md mx-auto">
        {screen === "list" && (
          <div className="flex flex-col gap-6">
            <p className="text-sm text-[#9A94A8]">
              Toutes les sorties de faisceaux sont déjà données autour du plateau. Retrouve la disposition exacte des pièces le plus vite possible — sans poser de question.
            </p>
            {["tresfacile", "facile", "moyen", "difficile"].map((diff) => {
              const indices = Array.from({ length: PUZZLE_COUNT }, (_, i) => i).filter((i) => difficultyForIndex(i) === diff);
              return (
                <div key={diff}>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: DIFF_COLOR[diff] }}>{DIFF_LABEL[diff]}</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {indices.map((i) => (
                      <button
                        key={i}
                        onClick={() => openPuzzle(i)}
                        className="flex flex-col items-center justify-center gap-0.5 bg-[#1B1B29] hover:bg-[#232336] border border-[#2A2A3A] rounded-xl py-2.5"
                      >
                        <span className="text-sm font-semibold">{i + 1}</span>
                        {bestTimes[i] != null ? (
                          <span className="text-[9px] text-[#5FBF6B]">{formatTime(bestTimes[i])}</span>
                        ) : (
                          <span className="text-[9px] text-[#4A4560]">—</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {screen === "play" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-semibold">Puzzle {puzzleIndex + 1}</h3>
                <span className="text-xs" style={{ color: DIFF_COLOR[puzzle.difficulty] }}>{DIFF_LABEL[puzzle.difficulty]}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm font-mono bg-[#1B1B29] border border-[#2A2A3A] rounded-full px-3 py-1.5">
                <Clock size={14} className={solved ? "text-[#5FBF6B]" : "text-[#F2C744]"} />
                {formatTime(solved ? finalTime : elapsed)}
              </div>
            </div>

            {solved ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <Trophy size={48} className="text-[#F2C744]" />
                <h2 className="text-xl font-bold">Résolu en {formatTime(finalTime)} !</h2>
                {bestTimes[puzzleIndex] === finalTime && <p className="text-sm text-[#5FBF6B]">Nouveau meilleur temps 🎉</p>}

                <div className="w-full bg-[#1B1B29] border border-[#2A2A3A] rounded-xl p-3">
                  <h4 className="text-xs font-semibold text-[#9A94A8] mb-2">Classement mondial de ce puzzle</h4>
                  {!lbSubmitted && (
                    <div className="flex gap-2 mb-3">
                      <input
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        placeholder="Ton pseudo"
                        maxLength={24}
                        className="flex-1 bg-[#12121C] border border-[#2A2A3A] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#F2C744]"
                      />
                      <button onClick={handlePublishScore} disabled={!playerName.trim()} className="px-3 py-1.5 rounded-lg bg-[#F2C744] text-[#12121C] text-xs font-semibold disabled:opacity-40">
                        Publier
                      </button>
                    </div>
                  )}
                  {lbSubmitted && <p className="text-[10px] text-[#5FBF6B] mb-2">Ton score est publié ✓</p>}
                  {lbLoading && <p className="text-xs text-[#6B6580]">Chargement…</p>}
                  {lbScores && lbScores.length === 0 && <p className="text-xs text-[#6B6580]">Sois le premier à publier un temps !</p>}
                  {lbScores && lbScores.length > 0 && (
                    <ol className="text-xs flex flex-col gap-1">
                      {lbScores.map((s, i) => (
                        <li key={s.uid} className="flex items-center justify-between">
                          <span className="text-[#C9C4D8]">{i + 1}. {s.name}</span>
                          <span className="font-mono text-[#F2C744]">{formatTime(s.seconds)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <div className="w-full flex gap-2">
                  <button onClick={() => setScreen("list")} className="flex-1 py-2.5 rounded-xl bg-[#232336] hover:bg-[#2E2E46] text-sm">Liste des puzzles</button>
                  {puzzleIndex < PUZZLE_COUNT - 1 && (
                    <button onClick={() => openPuzzle(puzzleIndex + 1)} className="flex-1 py-2.5 rounded-xl bg-[#F2C744] hover:bg-[#E0B62F] text-[#12121C] font-semibold text-sm">
                      Puzzle suivant
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <DuelBoard
                  pieces={guessPieces}
                  onChange={setGuessPieces}
                  allowedTypes={puzzle.allowedTypes}
                  marks={marks}
                  onToggleMark={toggleMark}
                  beamHistory={beamHistory}
                  cellHistory={[]}
                  actionMode={null}
                  canInteractBoard={false}
                  onPortTap={() => {}}
                  onCellQueryTap={() => {}}
                />
                <div className="mt-4 flex flex-col items-center gap-2 pb-8">
                  {feedback === "wrong" && <p className="text-sm text-[#E88]">Pas encore ça — continue !</p>}
                  <button
                    onClick={checkSolution}
                    disabled={!complete}
                    className="w-full py-3 rounded-xl bg-[#F2C744] hover:bg-[#E0B62F] text-[#12121C] font-semibold disabled:opacity-40"
                  >
                    Vérifier ma solution {!complete && `(${guessPieces.length}/${puzzle.allowedTypes.length})`}
                  </button>
                  <button onClick={() => openPuzzle(puzzleIndex)} className="text-xs text-[#6B6580] hover:text-[#EDE9E0] flex items-center gap-1 mt-1">
                    <RotateCcw size={12} /> Recommencer ce puzzle
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
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
          <span className="w-6 h-6 rounded-full border border-[#0C0C14] shrink-0 bg-[#17171A]" />
          <span><strong>Signal absorbé</strong> — un corps noir a intercepté le faisceau (aucune sortie).</span>
        </div>
      </div>
    </div>
  );
}
