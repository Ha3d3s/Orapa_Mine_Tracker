import React, { useEffect, useMemo, useState, useRef } from "react";
import { Gem, ChevronLeft, Clock, Trophy, RotateCcw, HelpCircle, X, Lightbulb, CalendarDays, Wrench } from "lucide-react";
import { PUZZLE_COUNT, generatePuzzle, difficultyForIndex } from "./puzzles";
import { generateDailyPuzzle, todayDateStr } from "./dailyPuzzle";
import { PORTS, boardsMatch, colorById, pieceAtCell, touchedCells } from "./orapaEngine";
import DuelBoard from "./DuelBoard";
import { recordPuzzleSolved, recordDailySolved, getStats } from "./stats";
import { newlyUnlockedBadges } from "./badges";
import BadgeUnlockedModal from "./BadgeUnlockedModal";
import MuteButton from "./MuteButton";
import { playWin, playWrong } from "./sounds";
import { submitScore, fetchTopScores, submitDailyScore, fetchTopDailyScores, getSavedName, saveName } from "./leaderboard";
import CustomPuzzle from "./CustomPuzzle";

const STORAGE_KEY = "orapa_puzzle_best_v1";
const DAILY_BEST_KEY = "orapa_daily_best_v1";
const HINT_PENALTY = 15;

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
function loadDailyBest() {
  try { return JSON.parse(localStorage.getItem(DAILY_BEST_KEY) || "{}"); } catch { return {}; }
}
function saveDailyBest(dateStr, seconds) {
  const best = loadDailyBest();
  if (best[dateStr] == null || seconds < best[dateStr]) {
    best[dateStr] = seconds;
    localStorage.setItem(DAILY_BEST_KEY, JSON.stringify(best));
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
  const [screen, setScreen] = useState("list");
  const [showHelp, setShowHelp] = useState(false);
  const [newBadges, setNewBadges] = useState(null);

  const [puzzleSource, setPuzzleSource] = useState({ type: "regular", index: 0 });
  const [guessPieces, setGuessPieces] = useState([]);
  const [marks, setMarks] = useState(() => new Set());
  const [hints, setHints] = useState([]);
  const [solved, setSolved] = useState(false);
  const [finalTime, setFinalTime] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [bestTimes, setBestTimes] = useState(() => loadBestTimes());
  const [dailyBest, setDailyBest] = useState(() => loadDailyBest());
  const [playerName, setPlayerName] = useState(() => getSavedName());
  const [lbScores, setLbScores] = useState(null);
  const [lbLoading, setLbLoading] = useState(false);
  const [lbSubmitted, setLbSubmitted] = useState(false);
  const [lbError, setLbError] = useState(null);
  const startRef = useRef(null);

  const [peekIndex, setPeekIndex] = useState(null);

  const isDaily = puzzleSource.type === "daily";
  const today = todayDateStr();

  const puzzle = useMemo(
    () => (isDaily ? generateDailyPuzzle(puzzleSource.dateStr) : generatePuzzle(puzzleSource.index)),
    [puzzleSource]
  );

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
        try {
          if (isDaily) await submitDailyScore(puzzleSource.dateStr, finalTime, playerName.trim());
          else await submitScore(puzzleSource.index, finalTime, playerName.trim());
          setLbSubmitted(true);
        } catch (e) {}
      }
      await loadLeaderboard();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved]);

  async function loadLeaderboard() {
    setLbLoading(true);
    setLbError(null);
    try {
      setLbScores(isDaily ? await fetchTopDailyScores(puzzleSource.dateStr) : await fetchTopScores(puzzleSource.index));
    } catch (e) {
      setLbScores(null);
      setLbError("Classement indisponible pour l'instant (index Firestore probablement en cours de création — réessaie dans quelques minutes).");
    }
    setLbLoading(false);
  }

  async function handlePublishScore() {
    if (!playerName.trim()) return;
    saveName(playerName.trim());
    try {
      if (isDaily) await submitDailyScore(puzzleSource.dateStr, finalTime, playerName.trim());
      else await submitScore(puzzleSource.index, finalTime, playerName.trim());
      setLbSubmitted(true);
    } catch (e) {}
    await loadLeaderboard();
  }

  function resetPlayState() {
    setGuessPieces([]);
    setMarks(new Set());
    setHints([]);
    setSolved(false);
    setFinalTime(null);
    setFeedback(null);
    startRef.current = Date.now();
    setElapsed(0);
  }
  function openPuzzle(index) {
    setPuzzleSource({ type: "regular", index });
    resetPlayState();
    setScreen("play");
  }
  function openDaily() {
    setPuzzleSource({ type: "daily", dateStr: today });
    resetPlayState();
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

  function useHint() {
    const occupied = new Set();
    puzzle.pieces.forEach((p) => touchedCells(p.type, p.col, p.row, p.rot, p.flipH, p.flipV).forEach((k) => occupied.add(k)));
    const already = new Set(hints.map((h) => h.params.col + "," + h.params.row));
    const remaining = [...occupied].filter((k) => !already.has(k));
    if (remaining.length === 0) return;
    const key = remaining[Math.floor(Math.random() * remaining.length)];
    const [col, row] = key.split(",").map(Number);
    const found = pieceAtCell(puzzle.pieces, col, row);
    let answer;
    if (!found) answer = { occupied: false };
    else if (found.absorbed) answer = { occupied: true, absorbed: true };
    else if (found.transparent) answer = { occupied: true, transparent: true };
    else answer = { occupied: true, colorId: found.colorId };
    setHints((h) => [...h, { params: { col, row }, answer }]);
  }

  function checkSolution() {
    if (boardsMatch(puzzle.pieces, guessPieces)) {
      const secs = Math.floor((Date.now() - startRef.current) / 1000) + hints.length * HINT_PENALTY;
      setFinalTime(secs);
      setSolved(true);
      const before = getStats();
      if (isDaily) {
        setDailyBest(saveDailyBest(puzzleSource.dateStr, secs));
        recordDailySolved(puzzleSource.dateStr);
      } else {
        setBestTimes(saveBestTime(puzzleSource.index, secs));
      }
      const after = recordPuzzleSolved(secs, isDaily ? "moyen" : puzzle.difficulty);
      const earned = newlyUnlockedBadges(before, after);
      if (earned.length) setNewBadges(earned);
      playWin();
    } else {
      setFeedback("wrong");
      setTimeout(() => setFeedback(null), 1800);
      playWrong();
    }
  }

  const complete = guessPieces.length === puzzle.allowedTypes.length;
  const alreadySolvedToday = dailyBest[today] != null;

  if (screen === "custom") return <CustomPuzzle onBack={() => setScreen("list")} />;

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
      <BadgeUnlockedModal badges={newBadges} onClose={() => setNewBadges(null)} />
      {peekIndex != null && <LeaderboardPeekModal target={peekIndex} onClose={() => setPeekIndex(null)} />}

      <div className="p-4 max-w-md mx-auto">
        {screen === "list" && (
          <div className="flex flex-col gap-6">
            <p className="text-sm text-[#9A94A8]">
              Toutes les sorties de faisceaux sont déjà données autour du plateau. Retrouve la disposition exacte des pièces le plus vite possible — sans poser de question.
            </p>

            <div className="bg-gradient-to-br from-[#2E2650] to-[#1B1B29] border border-[#3A2F66] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <CalendarDays size={16} className="text-[#F2C744]" />
                <h3 className="text-sm font-semibold">Puzzle du jour</h3>
              </div>
              <p className="text-[11px] text-[#9A94A8] mb-3">Le même pour tout le monde aujourd'hui — un classement dédié t'attend.</p>
              <div className="flex gap-2">
                <button onClick={openDaily} className="flex-1 py-2.5 rounded-xl bg-[#F2C744] hover:bg-[#E0B62F] text-[#12121C] font-semibold text-sm">
                  {alreadySolvedToday ? `Rejouer (${formatTime(dailyBest[today])})` : "Jouer"}
                </button>
                <button onClick={() => setPeekIndex("daily")} className="px-3 py-2.5 rounded-xl bg-[#232336] hover:bg-[#2E2E46] text-xs">Classement</button>
              </div>
            </div>

            <button onClick={() => setScreen("custom")} className="flex items-center gap-2 justify-center text-xs text-[#6B6580] hover:text-[#EDE9E0] bg-[#1B1B29] border border-[#2A2A3A] rounded-xl py-2.5">
              <Wrench size={14} /> Créer ou jouer un puzzle personnalisé
            </button>

            {["tresfacile", "facile", "moyen", "difficile"].map((diff) => {
              const indices = Array.from({ length: PUZZLE_COUNT }, (_, i) => i).filter((i) => difficultyForIndex(i) === diff);
              return (
                <div key={diff}>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: DIFF_COLOR[diff] }}>{DIFF_LABEL[diff]}</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {indices.map((i) => (
                      <div key={i} className="flex flex-col gap-1">
                        <button
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
                        <button onClick={() => setPeekIndex(i)} className="text-[8px] text-[#6B6580] hover:text-[#F2C744]">classement</button>
                      </div>
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
                <h3 className="text-base font-semibold">{isDaily ? "Puzzle du jour" : `Puzzle ${puzzleSource.index + 1}`}</h3>
                {!isDaily && <span className="text-xs" style={{ color: DIFF_COLOR[puzzle.difficulty] }}>{DIFF_LABEL[puzzle.difficulty]}</span>}
                {isDaily && <span className="text-xs text-[#8FC5EA]">{today}</span>}
              </div>
              <div className="flex items-center gap-1.5 text-sm font-mono bg-[#1B1B29] border border-[#2A2A3A] rounded-full px-3 py-1.5">
                <Clock size={14} className={solved ? "text-[#5FBF6B]" : "text-[#F2C744]"} />
                {formatTime(solved ? finalTime : elapsed + hints.length * HINT_PENALTY)}
              </div>
            </div>

            {solved ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <Trophy size={48} className="text-[#F2C744]" />
                <h2 className="text-xl font-bold">Résolu en {formatTime(finalTime)} !</h2>
                {hints.length > 0 && <p className="text-xs text-[#9A94A8]">(dont {hints.length} indice{hints.length > 1 ? "s" : ""} · +{hints.length * HINT_PENALTY}s)</p>}
                {!isDaily && bestTimes[puzzleSource.index] === finalTime && <p className="text-sm text-[#5FBF6B]">Nouveau meilleur temps 🎉</p>}
                {isDaily && dailyBest[today] === finalTime && <p className="text-sm text-[#5FBF6B]">Nouveau meilleur temps du jour 🎉</p>}

                <div className="w-full bg-[#1B1B29] border border-[#2A2A3A] rounded-xl p-3">
                  <h4 className="text-xs font-semibold text-[#9A94A8] mb-2">Classement mondial {isDaily ? "du jour" : "de ce puzzle"}</h4>
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
                  {lbError && <p className="text-xs text-[#E88]">{lbError}</p>}
                  {!lbError && lbScores && lbScores.length === 0 && <p className="text-xs text-[#6B6580]">Sois le premier à publier un temps !</p>}
                  {!lbError && lbScores && lbScores.length > 0 && (
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
                  {!isDaily && puzzleSource.index < PUZZLE_COUNT - 1 && (
                    <button onClick={() => openPuzzle(puzzleSource.index + 1)} className="flex-1 py-2.5 rounded-xl bg-[#F2C744] hover:bg-[#E0B62F] text-[#12121C] font-semibold text-sm">
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
                  cellHistory={hints}
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
                  <div className="flex gap-4 mt-1">
                    <button onClick={useHint} className="text-xs text-[#F2C744] hover:text-[#E0B62F] flex items-center gap-1">
                      <Lightbulb size={12} /> Indice (+{HINT_PENALTY}s)
                    </button>
                    <button onClick={() => openPuzzle(puzzleSource.index)} className="text-xs text-[#6B6580] hover:text-[#EDE9E0] flex items-center gap-1">
                      <RotateCcw size={12} /> Recommencer
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LeaderboardPeekModal({ target, onClose }) {
  const [scores, setScores] = useState(null);
  const [error, setError] = useState(null);
  const isDaily = target === "daily";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = isDaily ? await fetchTopDailyScores(todayDateStr()) : await fetchTopScores(target);
        if (!cancelled) setScores(data);
      } catch (e) {
        if (!cancelled) setError("Classement indisponible pour l'instant (index Firestore en cours de création ?).");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#1B1B29] rounded-2xl w-full max-w-sm p-5 border border-[#2A2A3A]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold">Classement {isDaily ? "du jour" : `— Puzzle ${target + 1}`}</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        {error && <p className="text-xs text-[#E88]">{error}</p>}
        {!error && scores === null && <p className="text-xs text-[#6B6580]">Chargement…</p>}
        {!error && scores && scores.length === 0 && <p className="text-xs text-[#6B6580]">Personne n'a encore publié de temps.</p>}
        {!error && scores && scores.length > 0 && (
          <ol className="text-sm flex flex-col gap-1.5">
            {scores.map((s, i) => (
              <li key={s.uid} className="flex items-center justify-between">
                <span className="text-[#C9C4D8]">{i + 1}. {s.name}</span>
                <span className="font-mono text-[#F2C744]">{formatTime(s.seconds)}</span>
              </li>
            ))}
          </ol>
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
