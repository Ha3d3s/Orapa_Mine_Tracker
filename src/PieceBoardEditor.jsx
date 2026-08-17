import React, { useState, useRef, useEffect, useCallback } from "react";
import { RotateCw, FlipHorizontal2, FlipVertical2, Trash2, X } from "lucide-react";
import {
  COLS, ROWS, CELL, X0, Y0, VBW, VBH, BW, BH,
  PIECE_DEFS, effSize, isValidPlacement, uid, clientToBoardPoint,
} from "./orapaEngine";

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

// pieces / onChange : état contrôlé par le parent (liste de {id,type,col,row,rot,flipH,flipV})
// allowedTypes : types de pièces disponibles dans la palette (dépend des extensions de la partie)
export default function PieceBoardEditor({ pieces, onChange, allowedTypes }) {
  const [selectedId, setSelectedId] = useState(null);
  const [dragInfo, setDragInfo] = useState(null);
  const [dragPos, setDragPos] = useState(null);
  const [previewCell, setPreviewCell] = useState(null);
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
    onChange(pieces.map((p) => {
      if (p.id !== id) return p;
      const def = PIECE_DEFS[p.type];
      if (!def.canRotate) return p;
      const newRot = (p.rot + 90) % 360;
      return isValid(p.type, p.col, p.row, newRot, id, p.flipH, p.flipV) ? { ...p, rot: newRot } : p;
    }));
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

  const selected = pieces.find((p) => p.id === selectedId);
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

      <div className="mt-3">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {availablePieces.map(([type, def]) => (
            <div key={type} onPointerDown={(e) => startNewDrag(type, e)} className="flex flex-col items-center gap-1 shrink-0" style={{ cursor: "grab", touchAction: "none" }}>
              <PieceIcon def={def} />
              <span className="text-[10px] text-[#9A94A8] text-center w-16">{def.label}</span>
            </div>
          ))}
          {availablePieces.length === 0 && <p className="text-xs text-[#5FBF6B] py-3">Toutes les pièces sont posées ✓</p>}
        </div>
      </div>

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
                  <RotateCw size={20} /><span className="text-[9px]">Pivoter</span>
                </button>
              )}
              {PIECE_DEFS[selected.type].canFlip && (
                <>
                  <button onClick={() => flipPiece(selected.id, "flipH")} className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl bg-[#2E2650] hover:bg-[#3A2F66] active:scale-95 transition">
                    <FlipHorizontal2 size={20} /><span className="text-[9px]">Sym. H</span>
                  </button>
                  <button onClick={() => flipPiece(selected.id, "flipV")} className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl bg-[#2E2650] hover:bg-[#3A2F66] active:scale-95 transition">
                    <FlipVertical2 size={20} /><span className="text-[9px]">Sym. V</span>
                  </button>
                </>
              )}
              <button onClick={() => deletePiece(selected.id)} className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl bg-[#4A2333] hover:bg-[#5C2B3F] text-[#F5A0A0] active:scale-95 transition">
                <Trash2 size={20} /><span className="text-[9px]">Suppr.</span>
              </button>
              <button onClick={() => setSelectedId(null)} className="p-2 rounded-full hover:bg-[#2E2E46]"><X size={18} /></button>
            </div>
          </div>
        </div>
      )}

      {dragInfo && dragPos && !previewCell && (
        <div className="fixed pointer-events-none z-40 opacity-85" style={{ left: dragPos.x - 22, top: dragPos.y - 22, width: 44, height: 44 }}>
          <PieceIcon def={PIECE_DEFS[dragInfo.type]} />
        </div>
      )}
    </div>
  );
}
