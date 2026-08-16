import React, { useState, useRef, useEffect, useCallback } from "react";
import { RotateCw, FlipHorizontal2, FlipVertical2, Trash2, HelpCircle, RefreshCcw, X, Gem, Repeat } from "lucide-react";

// ---------- Board geometry ----------
// Top = 1..10, Right = 11..18, Bottom = I..R, Left = A..H (clockwise)
const COLS = 10, ROWS = 8, CELL = 40, X0 = 40, Y0 = 40;
const BW = COLS * CELL, BH = ROWS * CELL;
const VBW = BW + X0 + 46, VBH = BH + Y0 + 46;

const TOP = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const RIGHT = ["11", "12", "13", "14", "15", "16", "17", "18"];
const BOTTOM = ["I", "J", "K", "L", "M", "N", "O", "P", "Q", "R"];
const LEFT = ["A", "B", "C", "D", "E", "F", "G", "H"];

const PORTS = [
  ...TOP.map((l, i) => ({ id: "T" + i, side: "top", index: i, label: l })),
  ...RIGHT.map((l, i) => ({ id: "R" + i, side: "right", index: i, label: l })),
  ...BOTTOM.map((l, i) => ({ id: "B" + i, side: "bottom", index: i, label: l })),
  ...LEFT.map((l, i) => ({ id: "L" + i, side: "left", index: i, label: l })),
];

function portXY(p) {
  switch (p.side) {
    case "top": return { x: X0 + (p.index + 0.5) * CELL, y: Y0 - 18 };
    case "right": return { x: X0 + BW + 18, y: Y0 + (p.index + 0.5) * CELL };
    case "bottom": return { x: X0 + (p.index + 0.5) * CELL, y: Y0 + BH + 18 }; // I à gauche → R à droite
    case "left": return { x: X0 - 18, y: Y0 + (p.index + 0.5) * CELL }; // A en haut → H en bas
    default: return { x: 0, y: 0 };
  }
}

// ---------- Colors (light-combination palette) ----------
// "common" = nom courant / familier pour reconnaître la teinte facilement
const COLORS = [
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
const colorById = (id) => COLORS.find((c) => c.id === id) || COLORS[0];

// ---------- Pieces ----------
// w,h = bounding box in grid cells at rotation 0. pts = polygon in that box (cell units).
const PIECE_DEFS = {
  triJaune: {
    label: "Triangle jaune",
    color: "#EDAE2E", w: 2, h: 2,
    pts: [[0, 0], [2, 0], [0, 2]], // legs=2 on grid lines, hypotenuse diagonal
    canRotate: true, canFlip: false, ext: null,
  },
  triBleu: {
    label: "Grand triangle bleu",
    color: "#3452B4", w: 2, h: 4,
    pts: [[0, 0], [0, 4], [2, 2]], // hypotenuse (length 4) on the grid line at x=0
    canRotate: true, canFlip: false, ext: null,
  },
  triBlanc: {
    label: "Grand triangle blanc",
    color: "#F4F1E8", w: 2, h: 4,
    pts: [[0, 0], [0, 4], [2, 2]],
    canRotate: true, canFlip: false, ext: null,
  },
  diamant: {
    label: "Losange blanc",
    color: "#F4F1E8", w: 2, h: 2,
    pts: [[1, 0], [2, 1], [1, 2], [0, 1]], // sits on its points, spans 4 half-cases
    canRotate: false, canFlip: false, ext: null,
  },
  rhombeRouge: {
    label: "Losange rouge",
    color: "#C93A42", w: 1, h: 3,
    // carré central plein (case du milieu) + demi-carré en haut (coupé dans un sens)
    // + demi-carré en bas (coupé dans l'autre sens) → parallélogramme continu
    pts: [[1, 0], [1, 2], [0, 3], [0, 1]],
    canRotate: true, canFlip: true, ext: null,
  },
  triNoir: {
    label: "Corps noir",
    color: "#17171A", w: 1, h: 1,
    pts: [[0, 0], [1, 0], [0, 1]], // demi-carré, hypoténuse en diagonale
    canRotate: true, canFlip: false, ext: "corpsNoir",
  },
  triDiamant: {
    label: "Diamant (verre)",
    color: "rgba(190,220,255,0.35)", stroke: "#BFE0FF", w: 1, h: 1,
    pts: [[0, 0], [1, 0], [0, 1]],
    canRotate: true, canFlip: false, ext: "diamant",
  },
};

function effSize(def, rot) {
  return rot === 90 || rot === 270 ? { w: def.h, h: def.w } : { w: def.w, h: def.h };
}

function uid() { return Math.random().toString(36).slice(2, 10); }

function clientToBoardPoint(svg, clientX, clientY) {
  const pt = svg.createSVGPoint();
  pt.x = clientX; pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const inv = ctm.inverse();
  const p = pt.matrixTransform(inv);
  return { x: p.x, y: p.y };
}

// Renders a piece's polygon scaled uniformly (keeps proportions) inside a boxSize x boxSize icon
function PieceIcon({ def, boxSize = 44, pad = 5 }) {
  const avail = boxSize - pad * 2;
  const scale = Math.min(avail / def.w, avail / def.h);
  const pw = def.w * scale, ph = def.h * scale;
  const offX = (boxSize - pw) / 2, offY = (boxSize - ph) / 2;
  const pts = def.pts.map(([x, y]) => `${x * scale + offX},${y * scale + offY}`).join(" ");
  return (
    <svg width={boxSize} height={boxSize} viewBox={`0 0 ${boxSize} ${boxSize}`} style={{ touchAction: "none" }}>
      <rect x={0} y={0} width={boxSize} height={boxSize} rx={8} fill="#1B1B29" />
      <polygon points={pts} fill={def.color} stroke={def.stroke || "#0C0C14"} strokeWidth={1.2} />
    </svg>
  );
}

export default function OrapaTracker() {
  const [pieces, setPieces] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [shots, setShots] = useState([]);
  const [pendingEntry, setPendingEntry] = useState(null);
  const [pendingExit, setPendingExit] = useState(null);
  const [picking, setPicking] = useState(false);
  const [portAction, setPortAction] = useState(null); // {port, shots:[...]} — gérer les tirs déjà posés sur ce point
  const [showHelp, setShowHelp] = useState(false);
  const [ext, setExt] = useState({ diamant: false, corpsNoir: false });
  const [marks, setMarks] = useState(() => new Set()); // cells marked "vide" ("c,r" keys)
  // dragInfo stays the SAME object reference for the whole gesture (only set once at drag start/end)
  // so the pointer-listener effect below does not re-run on every pointermove.
  const [dragInfo, setDragInfo] = useState(null); // {kind:'new'|'move', type, id?, rot, flipH, flipV}
  const [dragPos, setDragPos] = useState(null); // {x,y} raw client coords, for the fallback floating icon
  const [previewCell, setPreviewCell] = useState(null); // {col,row,valid} snapped ghost on the board
  const dropHandledRef = useRef(false);
  const svgRef = useRef(null);

  function toggleMark(c, r) {
    setMarks((m) => {
      const next = new Set(m);
      const key = c + "," + r;
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const occupied = useCallback((excludeId) => {
    const set = new Set();
    pieces.forEach((p) => {
      if (p.id === excludeId) return;
      const def = PIECE_DEFS[p.type];
      const { w, h } = effSize(def, p.rot);
      for (let dc = 0; dc < w; dc++) for (let dr = 0; dr < h; dr++) set.add((p.col + dc) + "," + (p.row + dr));
    });
    return set;
  }, [pieces]);

  const isValid = useCallback((type, col, row, rot, excludeId) => {
    const def = PIECE_DEFS[type];
    const { w, h } = effSize(def, rot);
    if (col < 0 || row < 0 || col + w > COLS || row + h > ROWS) return false;
    const occ = occupied(excludeId);
    for (let dc = 0; dc < w; dc++) for (let dr = 0; dr < h; dr++) if (occ.has((col + dc) + "," + (row + dr))) return false;
    return true;
  }, [occupied]);

  // Given a client-space point, compute the snapped footprint (col,row,valid) for the piece being dragged.
  const computeDrop = useCallback((info, clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const def = PIECE_DEFS[info.type];
    const { w, h } = effSize(def, info.rot || 0);
    const pt = clientToBoardPoint(svg, clientX, clientY);
    const nearBoard = pt.x > X0 - CELL * 1.2 && pt.x < X0 + BW + CELL * 1.2 && pt.y > Y0 - CELL * 1.2 && pt.y < Y0 + BH + CELL * 1.2;
    if (!nearBoard) return { onBoard: false };
    const col = Math.round((pt.x - X0) / CELL - w / 2);
    const row = Math.round((pt.y - Y0) / CELL - h / 2);
    const valid = isValid(info.type, col, row, info.rot || 0, info.kind === "move" ? info.id : null);
    return { onBoard: true, col, row, valid };
  }, [isValid]);

  // ---- drag handling (pointer-based, works for mouse + touch) ----
  // Effect depends only on `dragInfo` (stable for the whole gesture), never on the
  // fast-changing pointer position — so listeners are attached exactly once per drag.
  useEffect(() => {
    if (!dragInfo) return;
    dropHandledRef.current = false;

    function move(e) {
      setDragPos({ x: e.clientX, y: e.clientY });
      const drop = computeDrop(dragInfo, e.clientX, e.clientY);
      setPreviewCell(drop && drop.onBoard ? drop : null);
    }
    function up(e) {
      if (dropHandledRef.current) return;
      dropHandledRef.current = true;
      const drop = computeDrop(dragInfo, e.clientX, e.clientY);
      if (drop && drop.onBoard && drop.valid) {
        if (dragInfo.kind === "new") {
          setPieces((ps) => [...ps, { id: uid(), type: dragInfo.type, col: drop.col, row: drop.row, rot: 0, flipH: false, flipV: false }]);
        } else if (dragInfo.kind === "move") {
          setPieces((ps) => ps.map((p) => (p.id === dragInfo.id ? { ...p, col: drop.col, row: drop.row } : p)));
        }
      }
      setDragInfo(null);
      setDragPos(null);
      setPreviewCell(null);
    }
    function cancel() {
      if (dropHandledRef.current) return;
      dropHandledRef.current = true;
      setDragInfo(null);
      setDragPos(null);
      setPreviewCell(null);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [dragInfo, computeDrop]);

  function startNewDrag(type, e) {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (err) {}
    setSelectedId(null);
    setDragPos({ x: e.clientX, y: e.clientY });
    setDragInfo({ kind: "new", type, rot: 0, flipH: false, flipV: false });
  }
  function startMoveDrag(piece, e) {
    e.preventDefault();
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (err) {}
    setSelectedId(piece.id);
    setDragPos({ x: e.clientX, y: e.clientY });
    setDragInfo({ kind: "move", id: piece.id, type: piece.type, rot: piece.rot, flipH: piece.flipH, flipV: piece.flipV });
  }

  function rotatePiece(id) {
    setPieces((ps) => ps.map((p) => {
      if (p.id !== id) return p;
      const def = PIECE_DEFS[p.type];
      if (!def.canRotate) return p;
      const newRot = (p.rot + 90) % 360;
      return isValid(p.type, p.col, p.row, newRot, id) ? { ...p, rot: newRot } : p;
    }));
  }
  function flipPiece(id, axis) {
    setPieces((ps) => ps.map((p) => (p.id === id ? { ...p, [axis]: !p[axis] } : p)));
  }
  function deletePiece(id) {
    setPieces((ps) => ps.filter((p) => p.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function onPortClick(port) {
    if (picking) return;
    if (!pendingEntry) {
      const touching = shots.filter((s) => s.entry.id === port.id || s.exit.id === port.id);
      if (touching.length > 0) { setPortAction({ port, shots: touching }); return; }
      setPendingEntry(port);
      return;
    }
    if (pendingEntry.id === port.id) { setPendingEntry(null); return; } // re-tap same port = annuler
    setPendingExit(port);
    setPicking(true);
  }
  function pickReturnSamePoint() {
    if (!pendingEntry) return;
    setPendingExit(pendingEntry);
    setPicking(true);
  }
  function confirmShot(colorId) {
    setShots((s) => [...s, { id: uid(), entry: pendingEntry, exit: pendingExit, color: colorId }]);
    setPendingEntry(null); setPendingExit(null); setPicking(false);
  }
  function cancelPick() { setPendingEntry(null); setPendingExit(null); setPicking(false); }
  function deleteShot(id) { setShots((s) => s.filter((x) => x.id !== id)); }
  function resetAll() {
    if (!window.confirm("Effacer toutes les pièces et tous les tirs enregistrés ?")) return;
    setPieces([]); setShots([]); setPendingEntry(null); setPendingExit(null); setPicking(false); setSelectedId(null); setMarks(new Set());
  }

  const selected = pieces.find((p) => p.id === selectedId);
  const availablePieces = Object.entries(PIECE_DEFS).filter(([, d]) => !d.ext || ext[d.ext]);

  // last shot color touching a given port + whether it's a "return" shot
  const portInfo = {};
  shots.forEach((s) => {
    const isReturn = s.entry.id === s.exit.id;
    portInfo[s.entry.id] = { color: s.color, isReturn };
    portInfo[s.exit.id] = { color: s.color, isReturn };
  });

  return (
    <div className="min-h-screen w-full bg-[#12121C] text-[#EDE9E0] font-sans select-none" style={{ touchAction: dragInfo ? "none" : "auto" }}>
      <header className="px-4 pt-4 pb-2 flex items-center justify-between border-b border-[#2A2A3A]">
        <div>
          <h1 className="text-lg font-bold tracking-wide" style={{ fontFamily: "Georgia, serif" }}>Orapa Mine — Carnet de faisceaux</h1>
          <p className="text-xs text-[#9A94A8]">Trace tes tirs lumineux et tes hypothèses de gemmes</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowHelp(true)} className="p-2 rounded-full bg-[#232336] hover:bg-[#2E2E46] transition-colors" aria-label="Aide couleurs">
            <HelpCircle size={20} />
          </button>
          <button onClick={resetAll} className="p-2 rounded-full bg-[#232336] hover:bg-[#2E2E46] transition-colors" aria-label="Réinitialiser">
            <RefreshCcw size={18} />
          </button>
        </div>
      </header>

      {/* Board */}
      <div className="px-2 pt-3">
        <p className="text-center text-[11px] text-[#6B6580] mb-1">Touche une case du plateau pour la marquer d'une croix (case vide), touche à nouveau pour l'enlever.</p>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VBW} ${VBH}`}
          className="w-full max-w-md mx-auto block"
          style={{ background: "#1B1B29", borderRadius: 10, touchAction: "none" }}
        >
          {/* grid */}
          <g>
            {Array.from({ length: COLS + 1 }).map((_, i) => (
              <line key={"v" + i} x1={X0 + i * CELL} y1={Y0} x2={X0 + i * CELL} y2={Y0 + BH} stroke="#3A3A52" strokeWidth={1} />
            ))}
            {Array.from({ length: ROWS + 1 }).map((_, i) => (
              <line key={"h" + i} x1={X0} y1={Y0 + i * CELL} x2={X0 + BW} y2={Y0 + i * CELL} stroke="#3A3A52" strokeWidth={1} />
            ))}
            <rect x={X0} y={Y0} width={BW} height={BH} fill="none" stroke="#57577A" strokeWidth={2} />
          </g>

          {/* cases vides — tap pour marquer/démarquer d'une croix */}
          <g>
            {Array.from({ length: COLS }).flatMap((_, c) =>
              Array.from({ length: ROWS }).map((_, r) => {
                const cx = X0 + c * CELL, cy = Y0 + r * CELL;
                const marked = marks.has(c + "," + r);
                return (
                  <g key={c + "-" + r}>
                    <rect
                      x={cx} y={cy} width={CELL} height={CELL}
                      fill="transparent"
                      onClick={() => toggleMark(c, r)}
                      style={{ cursor: "pointer" }}
                    />
                    {marked && (
                      <g pointerEvents="none">
                        <line x1={cx + 7} y1={cy + 7} x2={cx + CELL - 7} y2={cy + CELL - 7} stroke="#6B6580" strokeWidth={2.5} strokeLinecap="round" />
                        <line x1={cx + CELL - 7} y1={cy + 7} x2={cx + 7} y2={cy + CELL - 7} stroke="#6B6580" strokeWidth={2.5} strokeLinecap="round" />
                      </g>
                    )}
                  </g>
                );
              })
            )}
          </g>

          {/* fantôme en taille réelle, aimanté à la case — vert = pose possible, rouge = impossible */}
          {dragInfo && previewCell && (() => {
            const def = PIECE_DEFS[dragInfo.type];
            const { w: ew, h: eh } = effSize(def, dragInfo.rot || 0);
            const anchorX = X0 + previewCell.col * CELL, anchorY = Y0 + previewCell.row * CELL;
            const cx = anchorX + (ew * CELL) / 2, cy = anchorY + (eh * CELL) / 2;
            const transform = `translate(${cx},${cy}) rotate(${dragInfo.rot || 0}) scale(${dragInfo.flipH ? -1 : 1},${dragInfo.flipV ? -1 : 1}) translate(${-(def.w * CELL) / 2},${-(def.h * CELL) / 2})`;
            const ptsStr = def.pts.map(([x, y]) => `${x * CELL},${y * CELL}`).join(" ");
            const tint = previewCell.valid ? "#5FBF6B" : "#E05C5C";
            return (
              <g pointerEvents="none">
                <rect x={anchorX} y={anchorY} width={ew * CELL} height={eh * CELL} fill={tint} opacity={0.16} />
                <g transform={transform} opacity={0.75}>
                  <polygon points={ptsStr} fill={def.color} stroke={tint} strokeWidth={2.5} />
                </g>
              </g>
            );
          })()}

          {/* pieces */}
          {pieces.map((p) => {
            const def = PIECE_DEFS[p.type];
            const { w: ew, h: eh } = effSize(def, p.rot);
            const anchorX = X0 + p.col * CELL, anchorY = Y0 + p.row * CELL;
            const cx = anchorX + (ew * CELL) / 2, cy = anchorY + (eh * CELL) / 2;
            const transform = `translate(${cx},${cy}) rotate(${p.rot}) scale(${p.flipH ? -1 : 1},${p.flipV ? -1 : 1}) translate(${-(def.w * CELL) / 2},${-(def.h * CELL) / 2})`;
            const ptsStr = def.pts.map(([x, y]) => `${x * CELL},${y * CELL}`).join(" ");
            const isSel = p.id === selectedId;
            return (
              <g key={p.id} transform={transform} onPointerDown={(e) => startMoveDrag(p, e)} style={{ cursor: "grab", touchAction: "none" }}>
                <polygon
                  points={ptsStr}
                  fill={def.color}
                  stroke={isSel ? "#F2C744" : (def.stroke || "#0C0C14")}
                  strokeWidth={isSel ? 3 : 1.2}
                />
              </g>
            );
          })}

          {/* ports — la couleur du tir s'affiche directement sur le point d'entrée/sortie */}
          {PORTS.map((p) => {
            const { x, y } = portXY(p);
            const isEntry = pendingEntry && pendingEntry.id === p.id;
            const isExit = pendingExit && pendingExit.id === p.id;
            const info = portInfo[p.id];
            let fill = "#2A2A3F";
            let textColor = "#C9C4D8";
            if (info) { fill = colorById(info.color).hex; textColor = "#0C0C14"; }
            if (isEntry || isExit) { fill = "#F2C744"; textColor = "#12121C"; }
            return (
              <g key={p.id} onClick={() => onPortClick(p)} style={{ cursor: "pointer" }}>
                <circle cx={x} cy={y} r={9.5} fill={fill} stroke={isEntry || isExit ? "#FFFFFF" : "#6B6B8C"} strokeWidth={isEntry || isExit ? 1.6 : 1} />
                {info && info.isReturn && !isEntry && !isExit && (
                  <circle cx={x} cy={y} r={12.5} fill="none" stroke={colorById(info.color).hex} strokeWidth={1.2} strokeDasharray="2,2" />
                )}
                <text x={x} y={y + 3} fontSize={8} textAnchor="middle" fill={textColor} fontWeight="bold">{p.label}</text>
              </g>
            );
          })}
        </svg>
        {pendingEntry && !picking && (
          <div className="text-center mt-2">
            <p className="text-xs text-[#F2C744]">Entrée {pendingEntry.label} sélectionnée — touche le point de sortie</p>
            <button onClick={pickReturnSamePoint} className="mt-1.5 inline-flex items-center gap-1 text-xs bg-[#232336] hover:bg-[#2E2E46] px-3 py-1.5 rounded-full">
              <Repeat size={13} /> Retour au même point ({pendingEntry.label})
            </button>
          </div>
        )}
      </div>

      {/* Piece palette */}
      <div className="px-4 mt-4">
        <h2 className="text-sm font-semibold text-[#C9C4D8] mb-1">Pièces — glisse une forme sur le plateau</h2>
        <div className="flex gap-4 mb-2 text-xs text-[#C9C4D8]">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={ext.diamant} onChange={(e) => setExt((x) => ({ ...x, diamant: e.target.checked }))} />
            Extension Diamant
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={ext.corpsNoir} onChange={(e) => setExt((x) => ({ ...x, corpsNoir: e.target.checked }))} />
            Extension Corps noir
          </label>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {availablePieces.map(([type, def]) => (
            <div
              key={type}
              onPointerDown={(e) => startNewDrag(type, e)}
              className="flex flex-col items-center gap-1 shrink-0"
              style={{ cursor: "grab", touchAction: "none" }}
            >
              <PieceIcon def={def} />
              <span className="text-[10px] text-[#9A94A8] text-center w-16">{def.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selected piece toolbar — grande barre bien visible */}
      {selected && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#1B1630] border-t-4 border-[#F2C744] shadow-[0_-6px_24px_rgba(0,0,0,0.5)] px-4 py-3">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: "#12121C" }}>
                <PieceIcon def={PIECE_DEFS[selected.type]} boxSize={30} pad={3} />
              </span>
              <span className="text-xs font-semibold text-[#F2C744]">Pièce sélectionnée</span>
            </div>
            <div className="flex items-center gap-2">
              {PIECE_DEFS[selected.type].canRotate && (
                <button onClick={() => rotatePiece(selected.id)} className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl bg-[#2E2650] hover:bg-[#3A2F66] active:scale-95 transition">
                  <RotateCw size={20} />
                  <span className="text-[9px]">Pivoter</span>
                </button>
              )}
              {PIECE_DEFS[selected.type].canFlip && (
                <>
                  <button onClick={() => flipPiece(selected.id, "flipH")} className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl bg-[#2E2650] hover:bg-[#3A2F66] active:scale-95 transition">
                    <FlipHorizontal2 size={20} />
                    <span className="text-[9px]">Sym. H</span>
                  </button>
                  <button onClick={() => flipPiece(selected.id, "flipV")} className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl bg-[#2E2650] hover:bg-[#3A2F66] active:scale-95 transition">
                    <FlipVertical2 size={20} />
                    <span className="text-[9px]">Sym. V</span>
                  </button>
                </>
              )}
              <button onClick={() => deletePiece(selected.id)} className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl bg-[#4A2333] hover:bg-[#5C2B3F] text-[#F5A0A0] active:scale-95 transition">
                <Trash2 size={20} />
                <span className="text-[9px]">Suppr.</span>
              </button>
              <button onClick={() => setSelectedId(null)} className="p-2 rounded-full hover:bg-[#2E2E46]" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shot list */}
      <div className="px-4 mt-4 pb-28">
        <h2 className="text-sm font-semibold text-[#C9C4D8] mb-1">Faisceaux enregistrés ({shots.length})</h2>
        {shots.length === 0 && <p className="text-xs text-[#6B6580]">Touche un point d'entrée puis un point de sortie sur le plateau pour ajouter un tir.</p>}
        <ul className="flex flex-col gap-1.5">
          {shots.map((s) => (
            <li key={s.id} className="flex items-center gap-2 bg-[#1B1B29] rounded-lg px-3 py-2 border border-[#2A2A3A]">
              <span className="w-4 h-4 rounded-full border border-[#0C0C14] shrink-0" style={{ background: colorById(s.color).hex }} />
              <span className="text-sm flex-1">
                {s.entry.id === s.exit.id ? `${s.entry.label} ↩ retour` : `${s.entry.label} → ${s.exit.label}`}
                <span className="text-[#9A94A8]"> · {colorById(s.color).name}</span>
              </span>
              <button onClick={() => deleteShot(s.id)} className="p-1 text-[#9A94A8] hover:text-[#E88]"><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      </div>

      {/* Petite icône flottante — visible seulement quand le doigt n'est pas encore au-dessus du plateau (le fantôme en vraie taille prend le relais une fois dessus) */}
      {dragInfo && dragPos && !previewCell && (
        <div
          className="fixed pointer-events-none z-40 opacity-85"
          style={{ left: dragPos.x - 22, top: dragPos.y - 22, width: 44, height: 44 }}
        >
          <PieceIcon def={PIECE_DEFS[dragInfo.type]} />
        </div>
      )}

      {/* Popup "que faire de ce point ?" — tirs déjà posés ici, supprimables un par un */}
      {portAction && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50" onClick={() => setPortAction(null)}>
          <div className="bg-[#1B1B29] rounded-t-2xl sm:rounded-2xl w-full sm:w-96 p-4 border border-[#2A2A3A]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Point {portAction.port.label}</h3>
              <button onClick={() => setPortAction(null)}><X size={18} /></button>
            </div>
            <ul className="flex flex-col gap-1.5 mb-3">
              {portAction.shots.map((s) => (
                <li key={s.id} className="flex items-center gap-2 bg-[#12121C] rounded-lg px-3 py-2 border border-[#2A2A3A]">
                  <span className="w-4 h-4 rounded-full border border-[#0C0C14] shrink-0" style={{ background: colorById(s.color).hex }} />
                  <span className="text-sm flex-1">
                    {s.entry.id === s.exit.id ? `${s.entry.label} ↩ retour` : `${s.entry.label} → ${s.exit.label}`}
                    <span className="text-[#9A94A8]"> · {colorById(s.color).name}</span>
                  </span>
                  <button
                    onClick={() => {
                      deleteShot(s.id);
                      setPortAction((pa) => {
                        if (!pa) return null;
                        const remaining = pa.shots.filter((x) => x.id !== s.id);
                        return remaining.length ? { ...pa, shots: remaining } : null;
                      });
                    }}
                    className="p-1.5 rounded-lg bg-[#4A2333] hover:bg-[#5C2B3F] text-[#F5A0A0]"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={() => { setPendingEntry(portAction.port); setPortAction(null); }}
              className="w-full text-xs bg-[#232336] hover:bg-[#2E2E46] px-3 py-2 rounded-full"
            >
              Nouveau tir depuis {portAction.port.label}
            </button>
          </div>
        </div>
      )}

      {/* Color picker modal */}
      {picking && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50" onClick={cancelPick}>
          <div className="bg-[#1B1B29] rounded-t-2xl sm:rounded-2xl w-full sm:w-96 p-4 border border-[#2A2A3A]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">
                {pendingEntry?.id === pendingExit?.id ? `Retour en ${pendingEntry?.label}` : `${pendingEntry?.label} → ${pendingExit?.label}`} : quelle couleur ?
              </h3>
              <button onClick={cancelPick}><X size={18} /></button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {COLORS.map((c) => (
                <button key={c.id} onClick={() => confirmShot(c.id)} className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-[#232336]">
                  <span className="w-8 h-8 rounded-full border border-[#0C0C14]" style={{ background: c.hex }} />
                  <span className="text-[9px] text-[#C9C4D8] text-center leading-tight">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Help modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => setShowHelp(false)}>
          <div className="bg-[#1B1B29] rounded-2xl w-full max-w-md p-5 border border-[#2A2A3A] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold flex items-center gap-2"><Gem size={18} /> Combinaisons de couleurs</h3>
              <button onClick={() => setShowHelp(false)}><X size={20} /></button>
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
              <span className="w-6 h-6 rounded-full border-2 border-dashed border-[#9A94A8] shrink-0" />
              <span>Un anneau en pointillé autour d'un point = le faisceau y ressort par le <strong>même point</strong> d'entrée (réflexion).</span>
            </div>
          </div>
        </div>
      )}
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
