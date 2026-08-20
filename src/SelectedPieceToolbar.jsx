import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RotateCw, FlipHorizontal2, FlipVertical2, Trash2, X } from "lucide-react";
import { PieceIcon } from "./PiecePalette";

// anchor : {x,y} en pixels écran = le point juste au-dessus de la pièce, sous lequel le bandeau
// doit "s'accrocher". Le bandeau se mesure lui-même après un premier rendu invisible, puis se
// recale pour rester entièrement visible même si la pièce est près d'un bord de l'écran.
// pieceId : id de la pièce sélectionnée, pour ne pas se fermer quand on retape juste dessus.
export default function SelectedPieceToolbar({ anchor, def, pieceId, onRotate, onFlipH, onFlipV, onDelete, onClose, rotateBlocked }) {
  const ref = useRef(null);
  const [style, setStyle] = useState({ left: anchor.x, top: anchor.y, transform: "translate(-50%,-100%)", visibility: "hidden" });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const margin = 8;
    const rect = el.getBoundingClientRect();
    let left = anchor.x - rect.width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - rect.width - margin));
    let top = anchor.y - rect.height;
    top = Math.max(margin, top);
    setStyle({ left, top, transform: "none", visibility: "visible" });
  }, [anchor.x, anchor.y, def]);

  // ferme le bandeau au clic/tap n'importe où ailleurs, sans avoir à cliquer sur la croix
  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && ref.current.contains(e.target)) return;
      if (pieceId != null && e.target.closest && e.target.closest(`[data-piece-id="${pieceId}"]`)) return;
      onClose();
    }
    document.addEventListener("pointerdown", handleOutside, true);
    return () => document.removeEventListener("pointerdown", handleOutside, true);
  }, [pieceId, onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-40 bg-[#1B1630] border-2 border-[#F2C744] rounded-2xl shadow-[0_6px_24px_rgba(0,0,0,0.55)] px-2 py-2 flex items-center gap-1.5"
      style={style}
    >
      <span className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ background: "#12121C" }}>
        <PieceIcon def={def} boxSize={28} pad={3} />
      </span>
      {def.canRotate && (
        <button
          onClick={onRotate}
          className={"flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl bg-[#2E2650] hover:bg-[#3A2F66] active:scale-95 transition " + (rotateBlocked ? "animate-shake" : "")}
        >
          <RotateCw size={17} /><span className="text-[8px]">Pivoter</span>
        </button>
      )}
      {def.canFlip && (
        <>
          <button onClick={onFlipH} className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl bg-[#2E2650] hover:bg-[#3A2F66] active:scale-95 transition">
            <FlipHorizontal2 size={17} /><span className="text-[8px]">Sym. H</span>
          </button>
          <button onClick={onFlipV} className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl bg-[#2E2650] hover:bg-[#3A2F66] active:scale-95 transition">
            <FlipVertical2 size={17} /><span className="text-[8px]">Sym. V</span>
          </button>
        </>
      )}
      <button onClick={onDelete} className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl bg-[#4A2333] hover:bg-[#5C2B3F] text-[#F5A0A0] active:scale-95 transition">
        <Trash2 size={17} /><span className="text-[8px]">Suppr.</span>
      </button>
      <button onClick={onClose} className="p-1.5 rounded-full hover:bg-[#2E2E46]"><X size={16} /></button>
    </div>
  );
}
