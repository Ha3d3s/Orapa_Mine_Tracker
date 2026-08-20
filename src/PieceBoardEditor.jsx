import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import {
  COLS, ROWS, CELL, X0, Y0, VBW, VBH, BW, BH,
  PIECE_DEFS, effSize, isValidPlacement, uid, clientToBoardPoint, boardToClientPoint, findRotateSlot,
} from "./orapaEngine";
import PiecePalette, { PieceIcon } from "./PiecePalette";
import SelectedPieceToolbar from "./SelectedPieceToolbar";

// pieces / onChange : état contrôlé par le parent (liste de {id,type,col,row,rot,flipH,flipV})
// allowedTypes : types de pièces disponibles dans la palette (dépend des extensions de la partie)
export default function PieceBoardEditor({ pieces, onChange, allowedTypes }) {
  const [selectedId, setSelectedId] = useState(null);
  const [dragInfo, setDragInfo] = useState(null);
  const [dragPos, setDragPos] = useState(null);
  const [previewCell, setPreviewCell] = useState(null);
  const [toolbarAnchor, setToolbarAnchor] = useState(null);
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

  // repositionne le bandeau de sélection juste au-dessus de la pièce sélectionnée
  const selected = pieces.find((p) => p.id === selectedId);
  useLayoutEffect(() => {
    if (!selected || !svgRef.current) { setToolbarAnchor(null); return; }
    function reposition() {
      const def = PIECE_DEFS[selected.type];
      const { w: ew, h: eh } = effSize(def, selected.rot);
      const topCenterX = X0 + selected.col * CELL + (ew * CELL) / 2;
      const topCenterY = Y0 + selected.row * CELL;
      const pt = boardToClientPoint(svgRef.current, topCenterX, topCenterY);
      setToolbarAnchor({ x: pt.x, y: Math.max(8, pt.y - 10) });
    }
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [selected?.id, selected?.col, selected?.row, selected?.rot]);

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

  const placedTypes = new Set(pieces.map((p) => p.type));
  const availablePieces = allowedTypes.filter((t) => !placedTypes.has(t)).map((t) => [t, PIECE_DEFS[t]]);

  return (
    <div style={{ touchAction: dragInfo ? "none" : "auto" }}>
      <svg ref={svgRef} viewBox={`0 0 ${VBW} ${VBH}`} className="w-full max-w-md mx-auto block" style={{ background: "#1B1B29", borderRadius: 10, touchAction: "none" }}>
        <g>
          {Array.from({ length: COLS + 1 }).map((_, i) => (
            <line key={"v" + i} x1={X0 + i * CELL} y1={Y0} x2={X0 + i * CELL} y2={Y0 + BH} stroke="#3A3A52" strokeWidth={1} />
          ))}
          {Array.from({ length: ROWS + 1 }).map((_, i) => (
            <line key={"h" + i} x1={X0} y1={Y0 + i * CELL} x2={X0 + BW} y2={Y0 + i * CELL} stroke="#3A3A52" strokeWidth={1} />
          ))}
          <rect x={X0} y={Y0} width={BW} height={BH} fill="none" stroke="#57577A" strokeWidth={2} />
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
      </svg>

      <div className="mt-1">
        <PiecePalette items={availablePieces} onStartDrag={startNewDrag} />
      </div>

      {selected && toolbarAnchor && (
        <SelectedPieceToolbar
          anchor={toolbarAnchor}
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
