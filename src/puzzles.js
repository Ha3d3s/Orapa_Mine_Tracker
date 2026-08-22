import { PIECE_DEFS, effSize, isValidPlacement, COLS, ROWS, PORTS, castBeam } from "./orapaEngine";

export const PUZZLE_COUNT = 100;

// petit générateur pseudo-aléatoire déterministe (mêmes graines = mêmes puzzles à chaque partie)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE_TYPES = ["triJaune", "triBleu", "triBlanc", "diamant", "rhombeRouge"];
const EXT_TYPES = ["triDiamant", "triNoir"];

// 5 très faciles (2 pièces) · 20 faciles (3 pièces) · 35 moyens (5 pièces) · 40 difficiles (5 + extensions)
export function difficultyForIndex(index) {
  if (index < 5) return "tresfacile";
  if (index < 25) return "facile";
  if (index < 60) return "moyen";
  return "difficile";
}

function typesForIndex(index, rnd) {
  const diff = difficultyForIndex(index);
  if (diff === "tresfacile") {
    const shuffled = [...BASE_TYPES].sort(() => rnd() - 0.5);
    return shuffled.slice(0, 2);
  }
  if (diff === "facile") {
    const shuffled = [...BASE_TYPES].sort(() => rnd() - 0.5);
    return shuffled.slice(0, 3);
  }
  if (diff === "moyen") return [...BASE_TYPES];
  return [...BASE_TYPES, ...EXT_TYPES];
}

const ROTS = [0, 90, 180, 270];

// Génère un puzzle complet : pièces placées + tous les indices de bord (36 ports), calculés
// avec le vrai simulateur de faisceau — donc toujours cohérents avec les règles du jeu.
export function generatePuzzle(index) {
  const rnd = mulberry32(10007 + index * 97);
  const types = typesForIndex(index, rnd);
  const pieces = [];

  for (const type of types) {
    const def = PIECE_DEFS[type];
    let placed = false;
    for (let attempt = 0; attempt < 600 && !placed; attempt++) {
      const rot = def.canRotate ? ROTS[Math.floor(rnd() * 4)] : 0;
      const flipH = def.canFlip ? rnd() < 0.5 : false;
      const flipV = def.canFlip ? rnd() < 0.5 : false;
      const { w, h } = effSize(def, rot);
      if (w > COLS || h > ROWS) continue;
      const col = Math.floor(rnd() * (COLS - w + 1));
      const row = Math.floor(rnd() * (ROWS - h + 1));
      if (isValidPlacement(pieces, type, col, row, rot, null, flipH, flipV)) {
        pieces.push({ id: type + "_" + pieces.length, type, col, row, rot, flipH, flipV });
        placed = true;
      }
    }
  }

  const clues = {};
  PORTS.forEach((p) => {
    const result = castBeam(p, pieces);
    clues[p.id] = result.absorbed
      ? { absorbed: true }
      : { colorId: result.colorId, exitSide: result.exitPort?.side, exitIndex: result.exitPort?.index };
  });

  return { index, difficulty: difficultyForIndex(index), allowedTypes: types, pieces, clues };
}
