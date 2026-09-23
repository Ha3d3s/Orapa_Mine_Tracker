import { PIECE_DEFS, effSize, isValidPlacement, COLS, ROWS, PORTS, castBeam } from "./orapaEngine";

const BASE_TYPES = ["triJaune", "triBleu", "triBlanc", "diamant", "rhombeRouge"];
const ROTS = [0, 90, 180, 270];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

export function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

export function generateDailyPuzzle(dateStr = todayDateStr()) {
  const rnd = mulberry32(hashString("orapa-daily-" + dateStr));
  const types = [...BASE_TYPES];
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
  return { dateStr, allowedTypes: types, pieces, clues };
}
