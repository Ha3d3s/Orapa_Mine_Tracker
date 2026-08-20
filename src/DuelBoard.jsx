import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import {
  COLS, ROWS, CELL, X0, Y0, VBW, VBH, BW, BH,
  PIECE_DEFS, effSize, isValidPlacement, uid, clientToBoardPoint, boardToClientPoint, findRotateSlot,
  PORTS, portXY, colorById,
} from "./orapaEngine";
import PiecePalette, { PieceIcon } from "./PiecePalette";
import SelectedPieceToolbar from "./SelectedPieceToolbar";

// pieces/onChange : mon hypothèse (persistante). marks/onToggleMark : cases "vides" cochées.
// beamHistory/cellHistory : mes questions déjà répondues, affichées directement sur ce plateau.
// actionMode ('beam'|'cell'|null) + canInteractBoard : quand un tap sur port/case doit poser une question.
export default function DuelBoard({
  pieces, onChange, allowedTypes,
  marks, onToggleMark,
  beamHistory, cellHistory,
  actionMode, canInteractBoard,
  onPortTap, onCellQueryTap,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [inspected, setInspected] = useState(null); // id du point tapé pour voir son lien, sans poser de question
  const [dragInfo, setDragInfo] = useState(null);
  const [dragPos, setDragPos] = useState(null);
  const [previewCell, setPreviewCell] = useState(null);
  const [toolbarStyle, setToolbarStyle] = useState(null);
  const [rotateBlocked, setRotateBlocked] = useState(false);
  const dropHandledRef = useRef(false);
  const svgRef = useRef(null);

  const isValid = useCallback(
    (type, col, row, rot, excludeId, flipH = false, flipV = false) =>
      isValidPlacement(pieces, type, col, row, rot, excludeId, flipH, flipV),
    [pieces]
  );

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
    const valid = isValid(info.type, col, row, info.rot || 0, info.kind === "move" ? info.id : null, info.flipH, info.flipV);
    return { onBoard: true, col, row, valid };
  }, [isValid]);

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
          onChange([...pieces, { id: uid(), type: dragInfo.type, col: drop.col, row: drop.row, rot: 0, flipH: false, flipV: false }]);
        } else if (dragInfo.kind === "move") {
          onChange(pieces.map((p) => (p.id === dragInfo.id ? { ...p, col: drop.col, row: drop.row } : p)));
        }
      }
      setDragInfo(null); setDragPos(null); setPreviewCell(null);
    }
    function cancel() {
      if (dropHandledRef.current) return;
      dropHandledRef.current = true;
      setDragInfo(null); setDragPos(null); setPreviewCell(null);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [dragInfo, computeDrop, pieces, onChange]);

  function startNewDrag(type, e) {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (err) {}
    setSelectedId(null);
    setDragPos({ x: e.clientX, y: e.clientY });
    setDragInfo({ kind: "new", type, rot: 0, flipH: false, flipV: false });
  }
  function startMoveDrag(piece, e) {
    e.preventDefault(); e.stopPropagation();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (err) {}
    setSelectedId(piece.id);
    setDragPos({ x: e.clientX, y: e.clientY });
    setDragInfo({ kind: "move", id: piece.id, type: piece.type, rot: piece.rot, flipH: piece.flipH, flipV: piece.flipV });
  }
  function rotatePiece(id) {
    const p = pieces.find((x) => x.id === id);
    if (!p) return;
    const def = PIECE_DEFS[p.type];
    if (!def.canRotate) return;
    const newRot = (p.rot + 90) % 360;
    const slot = findRotateSlot(pieces, p, newRot);
    if (!slot) {
      setRotateBlocked(true);
      setTimeout(() => setRotateBlocked(false), 400);
      return;
    }
    onChange(pieces.map((x) => (x.id === id ? { ...x, rot: newRot, col: slot.col, row: slot.row } : x)));
  }
  function flipPiece(id, axis) {
    onChange(pieces.map((p) => {
      if (p.id !== id) return p;
      const newFlipH = axis === "flipH" ? !p.flipH : p.flipH;
      const newFlipV = axis === "flipV" ? !p.flipV : p.flipV;
      return isValid(p.type, p.col, p.row, p.rot, id, newFlipH, newFlipV) ? { ...p, flipH: newFlipH, flipV: newFlipV } : p;
    }));
  }
  function deletePiece(id) {
    onChange(pieces.filter((p) => p.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  // ---- survol/historique connu (ports + cases) ----
  const portInfo = {};
  beamHistory.forEach((q) => {
    const entryPort = PORTS.find((p) => p.side === q.params.side && p.index === q.params.index);
    if (!entryPort) return;
    if (q.answer.absorbed) { portInfo[entryPort.id] = { absorbed: true }; return; }
    const exitPort = PORTS.find((p) => p.side === q.answer.exitSide && p.index === q.answer.exitIndex);
    const hex = colorById(q.answer.colorId).hex;
    const isReturn = !!(exitPort && exitPort.id === entryPort.id);
    portInfo[entryPort.id] = { hex, isReturn, linkId: exitPort ? exitPort.id : null };
    if (exitPort && !isReturn) portInfo[exitPort.id] = { hex, isReturn: false, linkId: entryPort.id };
  });
  const cellHistoryInfo = {};
  cellHistory.forEach((q) => {
    const key = q.params.col + "," + q.params.row;
    if (!q.answer.occupied) cellHistoryInfo[key] = { empty: true };
    else if (q.answer.absorbed) cellHistoryInfo[key] = { special: "#17171A" };
    else if (q.answer.transparent) cellHistoryInfo[key] = { special: "rgba(190,220,255,0.5)" };
    else cellHistoryInfo[key] = { hex: colorById(q.answer.colorId).hex };
  });

  function handleCellClick(c, r) {
    if (actionMode === "cell" && canInteractBoard) { onCellQueryTap(c, r); return; }
    onToggleMark(c, r);
  }
  function handlePortClick(p) {
    if (actionMode === "beam" && canInteractBoard) { onPortTap(p); return; }
    setInspected((cur) => (cur === p.id ? null : p.id));
  }

  const inspectedInfo = inspected ? portInfo[inspected] : null;
  const linkedId = inspectedInfo && !inspectedInfo.absorbed ? inspectedInfo.linkId : null;
  const highlightIds = new Set([inspected, linkedId].filter(Boolean));
  const inspectedPort = inspected ? PORTS.find((p) => p.id === inspected) : null;
  const linkedPort = linkedId ? PORTS.find((p) => p.id === linkedId) : null;

  const selected = pieces.find((p) => p.id === selectedId);
  const placedTypes = new Set(pieces.map((p) => p.type));
  const availablePieces = allowedTypes.filter((t) => !placedTypes.has(t)).map((t) => [t, PIECE_DEFS[t]]);

  // repositionne le bandeau de sélection juste au-dessus de la pièce sélectionnée
  useLayoutEffect(() => {
    if (!selected || !svgRef.current) { setToolbarStyle(null); return; }
    function reposition() {
      const def = PIECE_DEFS[selected.type];
      const { w: ew } = effSize(def, selected.rot);
      const topCenterX = X0 + selected.col * CELL + (ew * CELL) / 2;
      const topCenterY = Y0 + selected.row * CELL;
      const pt = boardToClientPoint(svgRef.current, topCenterX, topCenterY);
      setToolbarStyle({ left: pt.x, top: Math.max(8, pt.y - 10), transform: "translate(-50%, -100%)" });
    }
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [selected?.id, selected?.col, selected?.row, selected?.rot]);

  return (
    <div style={{ touchAction: dragInfo ? "none" : "auto" }}>
      <svg ref={svgRef} viewBox={`0 0 ${VBW} ${VBH}`} className="w-full max-w-md mx-auto block" style={{ background: "#1B1B29", borderRadius: 10, touchAction: "none" }}>
        <g>
          {Array.from({ length: COLS + 1 }).map((_, i) => <line key={"v" + i} x1={X0 + i * CELL} y1={Y0} x2={X0 + i * CELL} y2={Y0 + BH} stroke="#3A3A52" strokeWidth={1} />)}
          {Array.from({ length: ROWS + 1 }).map((_, i) => <line key={"h" + i} x1={X0} y1={Y0 + i * CELL} x2={X0 + BW} y2={Y0 + i * CELL} stroke="#3A3A52" strokeWidth={1} />)}
          <rect x={X0} y={Y0} width={BW} height={BH} fill="none" stroke="#57577A" strokeWidth={2} />
        </g>

        {/* cases : couleur connue (historique) + croix "vide" + clic pour marquer ou interroger */}
        <g>
          {Array.from({ length: COLS }).flatMap((_, c) =>
            Array.from({ length: ROWS }).map((_, r) => {
              const cx = X0 + c * CELL, cy = Y0 + r * CELL;
              const key = c + "," + r;
              const info = cellHistoryInfo[key];
              const marked = marks.has(key);
              const fill = info ? (info.empty ? "#2A2A3F" : (info.special || info.hex)) : "transparent";
              return (
                <g key={key}>
                  <rect x={cx} y={cy} width={CELL} height={CELL} fill={fill} opacity={info ? (info.empty ? 0.4 : 0.85) : 1}
                    onClick={() => handleCellClick(c, r)} style={{ cursor: "pointer" }} />
                  {marked && !info && (
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
              <g transform={transform} opacity={0.75}><polygon points={ptsStr} fill={def.color} stroke={tint} strokeWidth={2.5} /></g>
            </g>
          );
        })()}

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
              <polygon points={ptsStr} fill={def.color} stroke={isSel ? "#F2C744" : (def.stroke || "#0C0C14")} strokeWidth={isSel ? 3 : 1.2} />
            </g>
          );
        })}

        {/* ports : couleur connue (historique) + clic pour interroger un point d'entrée */}
        {PORTS.map((p) => {
          const { x, y } = portXY(p);
          const info = portInfo[p.id];
          let fill = "#2A2A3F", textColor = "#C9C4D8";
          if (info?.absorbed) { fill = "#17171A"; textColor = "#E88"; }
          else if (info) { fill = info.hex; textColor = "#0C0C14"; }
          const clickable = actionMode === "beam" && canInteractBoard;
          const isHighlighted = highlightIds.has(p.id);
          return (
            <g key={p.id} onClick={() => handlePortClick(p)} style={{ cursor: "pointer" }}>
              {isHighlighted && <circle cx={x} cy={y} r={13.5} fill="none" stroke="#F2C744" strokeWidth={2.2} />}
              <circle cx={x} cy={y} r={9.5} fill={fill} stroke={clickable ? "#F2C744" : "#6B6B8C"} strokeWidth={clickable ? 1.6 : 1} />
              {info && !info.absorbed && info.isReturn && (
                <circle cx={x} cy={y} r={12.5} fill="none" stroke={info.hex} strokeWidth={1.2} strokeDasharray="2,2" />
              )}
              <text x={x} y={y + 3} fontSize={8} textAnchor="middle" fill={textColor} fontWeight="bold">{p.label}</text>
            </g>
          );
        })}
      </svg>

      {inspected && (
        <p className="text-center text-xs text-[#F2C744] mt-2">
          {inspectedInfo?.absorbed
            ? `${inspectedPort.label} → signal absorbé (corps noir)`
            : inspectedInfo?.isReturn
            ? `${inspectedPort.label} → revient au même point`
            : linkedPort
            ? `${inspectedPort.label} ↔ ${linkedPort.label}`
            : `${inspectedPort.label} — pas encore d'information`}
        </p>
      )}
      <p className="text-center text-[11px] text-[#6B6580] mt-2">
        Touche un point pour voir auquel il est relié. Touche une case vide pour la marquer d'une croix (mémo).
      </p>

      <div className="mt-1">
        <PiecePalette items={availablePieces} onStartDrag={startNewDrag} />
      </div>

      {selected && toolbarStyle && (
        <SelectedPieceToolbar
          style={toolbarStyle}
          def={PIECE_DEFS[selected.type]}
          onRotate={() => rotatePiece(selected.id)}
          onFlipH={() => flipPiece(selected.id, "flipH")}
          onFlipV={() => flipPiece(selected.id, "flipV")}
          onDelete={() => deletePiece(selected.id)}
          onClose={() => setSelectedId(null)}
          rotateBlocked={rotateBlocked}
        />
      )}

      {dragInfo && dragPos && !previewCell && (
        <div className="fixed pointer-events-none z-40 opacity-85" style={{ left: dragPos.x - 22, top: dragPos.y - 22, width: 44, height: 44 }}>
          <PieceIcon def={PIECE_DEFS[dragInfo.type]} />
        </div>
      )}
    </div>
  );
}
