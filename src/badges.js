export const BADGES = [
  { id: "puzzle_1", emoji: "🩸", name: "Premier sang", desc: "Résous ton tout premier puzzle.", check: (s) => s.puzzlesSolved >= 1 },
  { id: "puzzle_10", emoji: "💎", name: "Accro aux gemmes", desc: "10 puzzles résolus. Ta famille s'inquiète.", check: (s) => s.puzzlesSolved >= 10 },
  { id: "puzzle_50", emoji: "⛏️", name: "Mineur professionnel", desc: "50 puzzles résolus. Tu mérites un casque.", check: (s) => s.puzzlesSolved >= 50 },
  { id: "puzzle_100", emoji: "👑", name: "Roi d'Orapa", desc: "Les 100 puzzles résolus. Il est temps de sortir un peu.", check: (s) => s.puzzlesSolved >= 100 },
  { id: "speedrun", emoji: "⚡", name: "Flash McFaisceau", desc: "Un puzzle difficile résolu en moins de 20 secondes.", check: (s) => s.fastestHardPuzzle != null && s.fastestHardPuzzle < 20 },
  { id: "ai_win_1", emoji: "🤖", name: "David contre Goliath", desc: "Bats l'IA pour la première fois.", check: (s) => s.aiWins >= 1 },
  { id: "ai_win_10", emoji: "🦾", name: "Terminator", desc: "10 victoires contre l'IA. Elle se souviendra de toi.", check: (s) => s.aiWins >= 10 },
  { id: "ai_loss_5", emoji: "🫠", name: "L'IA n'a pas pitié", desc: "5 défaites contre l'IA. Elle non plus n'a pas de sentiments.", check: (s) => s.aiLosses >= 5 },
  { id: "duel_streak_3", emoji: "🔥", name: "Ça chauffe", desc: "3 victoires en duel d'affilée.", check: (s) => s.bestDuelWinStreak >= 3 },
  { id: "duel_streak_5", emoji: "🏆", name: "Intouchable", desc: "5 victoires en duel d'affilée. Tes adversaires te fuient.", check: (s) => s.bestDuelWinStreak >= 5 },
  { id: "duel_loss_3", emoji: "🙃", name: "Ça arrive aux meilleurs", desc: "3 défaites en duel d'affilée. Courage, ça repart.", check: (s) => s.worstDuelLossStreak >= 3 },
  { id: "daily_3", emoji: "📅", name: "Habitué des lieux", desc: "3 jours de suite avec le puzzle du jour.", check: (s) => (s.dailyStreak || 0) >= 3 },
  { id: "daily_7", emoji: "🗓️", name: "Semaine parfaite", desc: "7 jours de suite avec le puzzle du jour.", check: (s) => (s.dailyStreak || 0) >= 7 },
  { id: "nico", emoji: "👑✨", name: "NicoLeCréateurSuprême", desc: "Trouvé en tapant 5 fois sur le logo 💎 de l'accueil. Tout ceci n'existe que grâce à lui.", check: (s) => !!s.secretNico, secret: true },
];

export function newlyUnlockedBadges(statsBefore, statsAfter) {
  return BADGES.filter((b) => !b.check(statsBefore) && b.check(statsAfter));
}

export function unlockedBadgeIds(stats) {
  return new Set(BADGES.filter((b) => b.check(stats)).map((b) => b.id));
}
