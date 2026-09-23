const KEY = "orapa_stats_v1";

const DEFAULT_STATS = {
  aiWins: 0,
  aiLosses: 0,
  duelWins: 0,
  duelLosses: 0,
  puzzlesSolved: 0,
  puzzleTotalSeconds: 0,
  fastestHardPuzzle: null,
  currentDuelWinStreak: 0,
  bestDuelWinStreak: 0,
  currentDuelLossStreak: 0,
  worstDuelLossStreak: 0,
  dailyDatesSolved: [],
  dailyStreak: 0,
  secretNico: false,
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
  if (won) {
    s.duelWins += 1;
    s.currentDuelWinStreak += 1;
    s.currentDuelLossStreak = 0;
    s.bestDuelWinStreak = Math.max(s.bestDuelWinStreak, s.currentDuelWinStreak);
  } else {
    s.duelLosses += 1;
    s.currentDuelLossStreak += 1;
    s.currentDuelWinStreak = 0;
    s.worstDuelLossStreak = Math.max(s.worstDuelLossStreak, s.currentDuelLossStreak);
  }
  return save(s);
}

export function recordPuzzleSolved(seconds, difficulty) {
  const s = getStats();
  s.puzzlesSolved += 1;
  s.puzzleTotalSeconds += seconds;
  if (difficulty === "difficile" && (s.fastestHardPuzzle == null || seconds < s.fastestHardPuzzle)) {
    s.fastestHardPuzzle = seconds;
  }
  return save(s);
}

export function recordDailySolved(dateStr) {
  const s = getStats();
  if (s.dailyDatesSolved.includes(dateStr)) return s;
  s.dailyDatesSolved.push(dateStr);
  const yesterday = new Date(dateStr);
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);
  s.dailyStreak = s.dailyDatesSolved.includes(yStr) ? s.dailyStreak + 1 : 1;
  return save(s);
}

export function unlockSecretNico() {
  const s = getStats();
  if (s.secretNico) return s;
  s.secretNico = true;
  return save(s);
}

export function averagePuzzleTime(stats) {
  if (!stats.puzzlesSolved) return null;
  return Math.round(stats.puzzleTotalSeconds / stats.puzzlesSolved);
}
