const KEY = "orapa_stats_v1";

const DEFAULT_STATS = {
  aiWins: 0,
  aiLosses: 0,
  duelWins: 0,
  duelLosses: 0,
  puzzlesSolved: 0,
  puzzleTotalSeconds: 0,
};

export function getStats() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { ...DEFAULT_STATS, ...raw };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

function save(stats) {
  localStorage.setItem(KEY, JSON.stringify(stats));
  return stats;
}

export function recordAIResult(won) {
  const s = getStats();
  if (won) s.aiWins += 1; else s.aiLosses += 1;
  return save(s);
}

export function recordDuelResult(won) {
  const s = getStats();
  if (won) s.duelWins += 1; else s.duelLosses += 1;
  return save(s);
}

export function recordPuzzleSolved(seconds) {
  const s = getStats();
  s.puzzlesSolved += 1;
  s.puzzleTotalSeconds += seconds;
  return save(s);
}

export function averagePuzzleTime(stats) {
  if (!stats.puzzlesSolved) return null;
  return Math.round(stats.puzzleTotalSeconds / stats.puzzlesSolved);
}
