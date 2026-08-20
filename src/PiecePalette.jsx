import React, { useEffect, useRef, useState } from "react";

function PieceIcon({ def, boxSize = 44, pad = 5 }) {
  const avail = boxSize - pad * 2;
  const scale = Math.min(avail / def.w, avail / def.h);
  const pw = def.w * scale, ph = def.h * scale;
  const offX = (boxSize - pw) / 2, offY = (boxSize - ph) / 2;
  const pts = def.pts.map(([x, y]) => `${x * scale + offX},${y * scale + offY}`).join(" ");
  return (
    <svg width={boxSize} height={boxSize} viewBox={`0 0 ${boxSize} ${boxSize}`} style={{ touchAction: "none" }}>
      <rect x={0} y={0} width={boxSize} height={boxSize} rx={9} fill="#1B1B29" />
      <polygon points={pts} fill={def.color} stroke={def.stroke || "#0C0C14"} strokeWidth={1.2} />
    </svg>
  );
}

// items : [[type, def], ...]. onStartDrag(type, pointerEvent) déclenche le glisser-déposer existant.
// La pièce la plus proche du centre du carrousel est agrandie et mise en lumière.
export default function PiecePalette({ items, onStartDrag }) {
  const scrollerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  function updateActive() {
    const el = scrollerRef.current;
    if (!el) return;
    const children = Array.from(el.children);
    const containerCenter = el.scrollLeft + el.clientWidth / 2;
    let best = 0, bestDist = Infinity;
    children.forEach((child, i) => {
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const dist = Math.abs(childCenter - containerCenter);
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    setActiveIndex(best);
  }

  useEffect(() => {
    updateActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  if (items.length === 0) {
    return <p className="text-xs text-[#5FBF6B] py-3 text-center">Toutes les pièces sont posées ✓</p>;
  }

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        onScroll={updateActive}
        className="flex gap-3 overflow-x-auto py-3 px-[38%] snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: "none" }}
      >
        {items.map(([type, def], i) => {
          const active = i === activeIndex;
          return (
            <div
              key={type}
              onPointerDown={(e) => onStartDrag(type, e)}
              className="flex flex-col items-center gap-1 shrink-0 snap-center transition-all duration-200"
              style={{
                cursor: "grab",
                touchAction: "none",
                transform: active ? "scale(1.28) translateY(-4px)" : "scale(0.88)",
                opacity: active ? 1 : 0.55,
              }}
            >
              <div style={{ filter: active ? "drop-shadow(0 0 8px rgba(242,199,68,0.55))" : "none", borderRadius: 10, border: active ? "2px solid #F2C744" : "2px solid transparent" }}>
                <PieceIcon def={def} />
              </div>
              <span className={"text-[10px] text-center w-16 " + (active ? "text-[#F2C744] font-semibold" : "text-[#6B6580]")}>{def.label}</span>
            </div>
          );
        })}
      </div>
      {/* dégradés latéraux pour suggérer qu'on peut faire défiler */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#12121C] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#12121C] to-transparent" />
    </div>
  );
}

export { PieceIcon };
