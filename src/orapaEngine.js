// ---------- Board geometry ----------
// Top = 1..10, Right = 11..18, Bottom = I..R, Left = A..H (clockwise)
export const COLS = 10, ROWS = 8, CELL = 40, X0 = 40, Y0 = 40;
export const BW = COLS * CELL, BH = ROWS * CELL;
export const VBW = BW + X0 + 46, VBH = BH + Y0 + 46;

export const TOP = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
export const RIGHT = ["11", "12", "13", "14", "15", "16", "17", "18"];
export const BOTTOM = ["I", "J", "K", "L", "M", "N", "O", "P", "Q", "R"];
export const LEFT = ["A", "B", "C", "D", "E", "F", "G", "H"];

export const PORTS = [
  ...TOP.map((l, i) => ({ id: "T" + i, side: "top", index: i, label: l })),
  ...RIGHT.map((l, i) => ({ id: "R" + i, side: "right", index: i, label: l })),
  ...BOTTOM.map((l, i) => ({ id: "B" + i, side: "bottom", index: i, label: l })),
  ...LEFT.map((l, i) => ({ id: "L" + i, side: "left", index: i, label: l })),
];

export function portXY(p) {
  switch (p.side) {
    case "top": return { x: X0 + (p.index + 0.5) * CELL, y: Y0 - 18 };
    case "right": return { x: X0 + BW + 18, y: Y0 + (p.index + 0.5) * CELL };
    case "bottom": return { x: X0 + (p.index + 0.5) * CELL, y: Y0 + BH + 18 };
    case "left": return { x: X0 - 18, y: Y0 + (p.index + 0.5) * CELL };
    default: return { x: 0, y: 0 };
  }
}

// ---------- Colors (light-combination palette) ----------
export const COLORS = [
  { id: "blanc", name: "Blanc", common: "incolore", hex: "#F4F1E8" },
  { id: "bleu", name: "Bleu", common: "bleu roi", hex: "#3452B4" },
  { id: "jaune", name: "Jaune", common: "jaune vif", hex: "#EDAE2E" },
  { id: "rouge", name: "Rouge", common: "rouge vif", hex: "#C93A42" },
  { id: "bleuciel", name: "Bleu ciel", common: "bleu pastel", hex: "#8FC5EA" },
  { id: "jauneclair", name: "Jaune clair", common: "jaune citron", hex: "#F2DE8C" },
  { id: "rose", name: "Rose", common: "rose pâle", hex: "#EE9C9C" },
  { id: "vert", name: "Vert", common: "vert prairie", hex: "#8CBE41" },
  { id: "violet", name: "Violet", common: "violet foncé", hex: "#9C3E8E" },
  { id: "orange", name: "Orange", common: "orange vif", hex: "#E06A2C" },
  { id: "noir", name: "Noir", common: "noir profond", hex: "#201F24" },
  { id: "gris", name: "Gris", common: "gris taupe", hex: "#8B7F82" },
  { id: "vertclair", name: "Vert clair", common: "vert pomme", hex: "#C6D96C" },
  { id: "violetclair", name: "Violet clair", common: "mauve / lilas", hex: "#CC6FC4" },
  { id: "orangeclair", name: "Orange clair", common: "pêche / abricot", hex: "#EF9257" },
  { id: "miss", name: "Aucun contact", common: "gris-bleu très pâle", hex: "#AEB9C7" },
];
export const colorById = (id) => COLORS.find((c) => c.id === id) || COLORS[0];

// ---------- Pieces ----------
export const PIECE_DEFS = {
  triJaune: {
    label: "Triangle jaune",
    color: "#EDAE2E", w: 2, h: 2,
    pts: [[0, 0], [2, 0], [0, 2]],
    canRotate: true, canFlip: false, ext: null,
    mixColorId: "jaune", kind: "normal",
  },
  triBleu: {
    label: "Grand triangle bleu",
    color: "#3452B4", w: 2, h: 4,
    pts: [[0, 0], [0, 4], [2, 2]],
    canRotate: true, canFlip: false, ext: null,
    mixColorId: "bleu", kind: "normal",
  },
  triBlanc: {
    label: "Grand triangle blanc",
    color: "#F4F1E8", w: 2, h: 4,
    pts: [[0, 0], [0, 4], [2, 2]],
    canRotate: true, canFlip: false, ext: null,
    mixColorId: "blanc", kind: "normal",
  },
  diamant: {
    label: "Losange blanc",
    color: "#F4F1E8", w: 2, h: 2,
    pts: [[1, 0], [2, 1], [1, 2], [0, 1]],
    canRotate: false, canFlip: false, ext: null,
    mixColorId: "blanc", kind: "normal",
  },
  rhombeRouge: {
    label: "Losange rouge",
    color: "#C93A42", w: 1, h: 3,
    pts: [[1, 0], [1, 2], [0, 3], [0, 1]],
    canRotate: true, canFlip: true, ext: null,
    mixColorId: "rouge", kind: "normal",
  },
  triNoir: {
    label: "Corps noir",
    color: "#17171A", w: 2, h: 1,
    pts: [[0, 0], [2, 0], [2, 1], [0, 1]],
    canRotate: true, canFlip: false, ext: "corpsNoir",
    mixColorId: null, kind: "absorb",
  },
  triDiamant: {
    label: "Diamant (verre)",
    color: "rgba(190,220,255,0.35)", stroke: "#BFE0FF", w: 1, h: 1,
    pts: [[0, 0], [1, 0], [0, 1]],
    canRotate: true, canFlip: false, ext: "diamant",
    mixColorId: null, kind: "transparent",
  },
};

export function effSize(def, rot) {
  return rot === 90 || rot === 270 ? { w: def.h, h: def.w } : { w: def.w, h: def.h };
}

export function transformedPolygon(type, col, row, rot, flipH, flipV) {
  const def = PIECE_DEFS[type];
  const { w: ew, h: eh } = effSize(def, rot);
  const cx = col + ew / 2, cy = row + eh / 2;
  return def.pts.map(([x, y]) => {
    let px = x - def.w / 2, py = y - def.h / 2;
    if (flipH) px = -px;
    if (flipV) py = -py;
    let rx, ry;
    switch (rot) {
      case 90: rx = -py; ry = px; break;
      case 180: rx = -px; ry = -py; break;
      case 270: rx = py; ry = -px; break;
      default: rx = px; ry = py;
    }
    return { x: rx + cx, y: ry + cy };
  });
}

function polyEdgeNormals(poly) {
  const normals = [];
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i], p2 = poly[(i + 1) % poly.length];
    normals.push({ x: -(p2.y - p1.y), y: p2.x - p1.x });
  }
  return normals;
}
function projectPoly(poly, axis) {
  let min = Infinity, max = -Infinity;
  poly.forEach((p) => {
    const v = p.x * axis.x + p.y * axis.y;
    if (v < min) min = v;
    if (v > max) max = v;
  });
  return { min, max };
}
export function convexPolysOverlap(polyA, polyB) {
  const EPS = 1e-6;
  const axes = [...polyEdgeNormals(polyA), ...polyEdgeNormals(polyB)];
  for (const axis of axes) {
    const len = Math.hypot(axis.x, axis.y);
    if (len < 1e-9) continue;
    const n = { x: axis.x / len, y: axis.y / len };
    const a = projectPoly(polyA, n), b = projectPoly(polyB, n);
    if (a.max <= b.min + EPS || b.max <= a.min + EPS) return false;
  }
  return true;
}

export function touchedCells(type, col, row, rot, flipH, flipV) {
  const def = PIECE_DEFS[type];
  const { w, h } = effSize(def, rot);
  const poly = transformedPolygon(type, col, row, rot, flipH, flipV);
  const cells = [];
  for (let dc = 0; dc < w; dc++) {
    for (let dr = 0; dr < h; dr++) {
      const cx = col + dc, cy = row + dr;
      const cellSquare = [{ x: cx, y: cy }, { x: cx + 1, y: cy }, { x: cx + 1, y: cy + 1 }, { x: cx, y: cy + 1 }];
      if (convexPolysOverlap(poly, cellSquare)) cells.push(cx + "," + cy);
    }
  }
  return cells;
}

// Pure : valide un placement (type,col,row,rot,flip) contre une liste de pièces déjà posées.
export function isValidPlacement(pieces, type, col, row, rot, excludeId, flipH = false, flipV = false) {
  const def = PIECE_DEFS[type];
  const { w, h } = effSize(def, rot);
  if (col < 0 || row < 0 || col + w > COLS || row + h > ROWS) return false;
  const cells = new Set(touchedCells(type, col, row, rot, flipH, flipV));
  for (const p of pieces) {
    if (p.id === excludeId) continue;
    const otherCells = touchedCells(p.type, p.col, p.row, p.rot, p.flipH, p.flipV);
    for (const c of otherCells) if (cells.has(c)) return false;
  }
  return true;
}

export function uid() { return Math.random().toString(36).slice(2, 10); }

// ---------- Simulateur de faisceau ----------
function edgeKind(p1, p2) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  if (dx === 0 || dy === 0) return "flat";
  if (dx === dy) return "backslash";
  if (dx === -dy) return "slash";
  return "other";
}
function pieceEdges(piece) {
  const def = PIECE_DEFS[piece.type];
  const poly = transformedPolygon(piece.type, piece.col, piece.row, piece.rot || 0, !!piece.flipH, !!piece.flipV);
  const edges = [];
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i], p2 = poly[(i + 1) % poly.length];
    edges.push({ p1, p2, kind: edgeKind(p1, p2), pieceId: piece.id, edgeIndex: i, piece, def });
  }
  return edges;
}
const RAY_EPS = 1e-7;
function raySegmentT(pos, dir, p1, p2) {
  if (dir.dy === 0) {
    const dyEdge = p2.y - p1.y;
    if (Math.abs(dyEdge) < RAY_EPS) return null;
    const s = (pos.y - p1.y) / dyEdge;
    if (s < -RAY_EPS || s > 1 + RAY_EPS) return null;
    const x = p1.x + s * (p2.x - p1.x);
    return { t: (x - pos.x) / dir.dx, point: { x, y: pos.y } };
  }
  const dxEdge = p2.x - p1.x;
  if (Math.abs(dxEdge) < RAY_EPS) return null;
  const s = (pos.x - p1.x) / dxEdge;
  if (s < -RAY_EPS || s > 1 + RAY_EPS) return null;
  const y = p1.y + s * (p2.y - p1.y);
  return { t: (y - pos.y) / dir.dy, point: { x: pos.x, y } };
}
function findNearestHit(pos, dir, pieces, excludeKey) {
  let best = null;
  for (const piece of pieces) {
    for (const edge of pieceEdges(piece)) {
      if (edge.kind === "other") continue;
      const res = raySegmentT(pos, dir, edge.p1, edge.p2);
      if (!res) continue;
      const key = edge.pieceId + ":" + edge.edgeIndex;
      const minT = key === excludeKey ? RAY_EPS : -RAY_EPS;
      if (res.t <= minT) continue;
      if (!best || res.t < best.t) best = { ...res, edge, key };
    }
  }
  return best;
}
function reflectDir(dir, kind) {
  if (kind === "flat") return { dx: -dir.dx, dy: -dir.dy };
  if (kind === "slash") return { dx: -dir.dy, dy: -dir.dx };
  if (kind === "backslash") return { dx: dir.dy, dy: dir.dx };
  return dir;
}
export function mixColorId(touchedSet) {
  const b = touchedSet.has("bleu"), j = touchedSet.has("jaune"), r = touchedSet.has("rouge"), w = touchedSet.has("blanc");
  if (!b && !j && !r && !w) return "miss";
  if (b && j && r && w) return "gris";
  if (b && j && r) return "noir";
  if (j && b && w) return "vertclair";
  if (r && b && w) return "violetclair";
  if (r && j && w) return "orangeclair";
  if (j && b) return "vert";
  if (r && b) return "violet";
  if (r && j) return "orange";
  if (b && w) return "bleuciel";
  if (j && w) return "jauneclair";
  if (r && w) return "rose";
  if (b) return "bleu";
  if (j) return "jaune";
  if (r) return "rouge";
  return "blanc";
}
function boardExitT(pos, dir) {
  if (dir.dx === 1) return COLS - pos.x;
  if (dir.dx === -1) return pos.x;
  if (dir.dy === 1) return ROWS - pos.y;
  return pos.y;
}
export function portForExit(pos, dir) {
  let side, coord;
  if (dir.dx === 1) { side = "right"; coord = pos.y; }
  else if (dir.dx === -1) { side = "left"; coord = pos.y; }
  else if (dir.dy === 1) { side = "bottom"; coord = pos.x; }
  else { side = "top"; coord = pos.x; }
  const index = Math.round(coord - 0.5);
  return PORTS.find((p) => p.side === side && p.index === index) || null;
}
function entryStart(port) {
  switch (port.side) {
    case "top": return { pos: { x: port.index + 0.5, y: 0 }, dir: { dx: 0, dy: 1 } };
    case "bottom": return { pos: { x: port.index + 0.5, y: ROWS }, dir: { dx: 0, dy: -1 } };
    case "left": return { pos: { x: 0, y: port.index + 0.5 }, dir: { dx: 1, dy: 0 } };
    default: return { pos: { x: COLS, y: port.index + 0.5 }, dir: { dx: -1, dy: 0 } };
  }
}
export function castBeam(port, pieces) {
  let { pos, dir } = entryStart(port);
  const touched = new Set();
  let excludeKey = null;
  const path = [{ ...pos }];
  for (let step = 0; step < 200; step++) {
    const bExit = boardExitT(pos, dir);
    const hit = findNearestHit(pos, dir, pieces, excludeKey);
    if (!hit || hit.t >= bExit - RAY_EPS) {
      const exitPos = { x: pos.x + dir.dx * bExit, y: pos.y + dir.dy * bExit };
      path.push(exitPos);
      const exitPort = portForExit(exitPos, dir);
      return { exitPort, colorId: mixColorId(touched), path };
    }
    pos = hit.point;
    path.push({ ...pos });
    const def = hit.edge.def;
    if (def.kind === "absorb") return { absorbed: true, path };
    if (def.kind === "normal" && def.mixColorId) touched.add(def.mixColorId);
    dir = reflectDir(dir, hit.edge.kind);
    excludeKey = hit.key;
  }
  return { error: true, path };
}

// Ce qu'il y a (le cas échéant) sur une case précise du plateau, pour la question
// "qu'y a-t-il en H4 ?" — ne révèle QUE la couleur (jamais la forme/orientation de la pièce),
// pour ne pas donner d'indice supplémentaire sur l'identité exacte de la pièce.
export function pieceAtCell(pieces, col, row) {
  for (const p of pieces) {
    const cells = touchedCells(p.type, p.col, p.row, p.rot, p.flipH, p.flipV);
    if (cells.includes(col + "," + row)) {
      const def = PIECE_DEFS[p.type];
      if (def.kind === "absorb") return { absorbed: true };
      if (def.kind === "transparent") return { transparent: true };
      return { colorId: def.mixColorId };
    }
  }
  return null;
}

export function clientToBoardPoint(svg, clientX, clientY) {
  const pt = svg.createSVGPoint();
  pt.x = clientX; pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const inv = ctm.inverse();
  const p = pt.matrixTransform(inv);
  return { x: p.x, y: p.y };
}

// Inverse de clientToBoardPoint : coordonnées plateau (unités cases) -> pixels écran réels.
// Utile pour positionner un élément HTML (ex. le bandeau de rotation) juste au-dessus d'une pièce.
export function boardToClientPoint(svg, boardX, boardY) {
  const pt = svg.createSVGPoint();
  pt.x = boardX; pt.y = boardY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = pt.matrixTransform(ctm);
  return { x: p.x, y: p.y };
}

// Si une pièce ne peut pas pivoter sur place (pas assez de place), cherche la position valide
// la plus proche (recherche en anneaux concentriques) pour qu'elle puisse quand même pivoter,
// plutôt que de simplement refuser la rotation sans rien proposer.
export function findRotateSlot(pieces, piece, newRot, maxRadius = 4) {
  const { flipH, flipV } = piece;
  if (isValidPlacement(pieces, piece.type, piece.col, piece.row, newRot, piece.id, flipH, flipV)) {
    return { col: piece.col, row: piece.row };
  }
  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let dc = -radius; dc <= radius; dc++) {
      for (let dr = -radius; dr <= radius; dr++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue;
        const col = piece.col + dc, row = piece.row + dr;
        if (isValidPlacement(pieces, piece.type, col, row, newRot, piece.id, flipH, flipV)) {
          return { col, row };
        }
      }
    }
  }
  return null;
}

// La liste des types de pièces requis pour une partie complète, selon les extensions activées.
export function requiredPieceTypes(settings) {
  const base = ["triJaune", "triBleu", "triBlanc", "diamant", "rhombeRouge"];
  if (settings?.extDiamant) base.push("triDiamant");
  if (settings?.extCorpsNoir) base.push("triNoir");
  return base;
}

// Compare une proposition (liste de pièces) au plateau réel : vraie si chaque pièce du
// plateau réel a une correspondance exacte (même type, position, rotation, symétrie) côté proposition.
// Clé canonique (indépendante de l'ordre des sommets) de la forme réellement occupée par une
// pièce. Deux placements (type/col/row/rot/flip différents en valeurs brutes) qui produisent la
// MÊME forme physique (ex. un losange à 0° et à 180°, indiscernables à l'œil) doivent être
// reconnus comme identiques — comparer les nombres bruts de rotation/symétrie ne suffit pas.
function pieceShapeKey(type, col, row, rot, flipH, flipV) {
  const poly = transformedPolygon(type, col, row, rot, flipH, flipV);
  return type + "|" + poly.map((p) => `${p.x},${p.y}`).sort().join(";");
}

export function boardsMatch(realPieces, guessPieces) {
  if (realPieces.length !== guessPieces.length) return false;
  const used = new Array(guessPieces.length).fill(false);
  for (const rp of realPieces) {
    const rKey = pieceShapeKey(rp.type, rp.col, rp.row, rp.rot, rp.flipH, rp.flipV);
    let found = -1;
    for (let i = 0; i < guessPieces.length; i++) {
      if (used[i]) continue;
      const gp = guessPieces[i];
      if (gp.type !== rp.type) continue;
      const gKey = pieceShapeKey(gp.type, gp.col, gp.row, gp.rot, gp.flipH, gp.flipV);
      if (gKey === rKey) { found = i; break; }
    }
    if (found === -1) return false;
    used[found] = true;
  }
  return true;
}
