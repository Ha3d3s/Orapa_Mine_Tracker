import React from "react";
import { RotateCw, FlipHorizontal2, FlipVertical2, Trash2, X } from "lucide-react";
import { PieceIcon } from "./PiecePalette";

export default function SelectedPieceToolbar({ style, def, onRotate, onFlipH, onFlipV, onDelete, onClose, rotateBlocked }) {
  return (
    <div
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
