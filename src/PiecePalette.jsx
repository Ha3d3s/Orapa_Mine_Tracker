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

const DRAG_THRESHOLD = 10; // px avant de trancher "je fais défiler" vs "je saisis la pièce"

// items : [[type, def], ...]. onStartDrag(type, pointerEvent) déclenche le glisser-déposer existant.
// La pièce la plus proche du centre du carrousel est agrandie et mise en lumière.
// Au doigt : un mouvement plutôt VERTICAL saisit la pièce (vers le plateau, au-dessus) ;
// un mouvement plutôt HORIZONTAL fait défiler le carrousel nativement. À la souris : saisie immédiate.
export default function PiecePalette({ items, onStartDrag }) {
  const scrollerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const pendingRef = useRef(null);

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

  function onItemPointerDown(type, targetEl, e) {
    if (e.pointerType === "mouse") {
      // souris : pas d'ambiguïté avec un geste de défilement tactile, on saisit tout de suite
      onStartDrag(type, e);
      return;
    }
    pendingRef.current = {
      type, targetEl, pointerId: e.pointerId,
      startX: e.clientX, startY: e.clientY, resolved: false,
    };
    window.addEventListener("pointermove", handlePendingMove);
    window.addEventListener("pointerup", clearPending);
    window.addEventListener("pointercancel", clearPending);
  }

  function handlePendingMove(e) {
    const pend = pendingRef.current;
    if (!pend || pend.pointerId !== e.pointerId || pend.resolved) return;
    const dx = e.clientX - pend.startX, dy = e.clientY - pend.startY;
    if (Math.abs(dy) > DRAG_THRESHOLD && Math.abs(dy) >= Math.abs(dx)) {
      // geste vertical -> on saisit la pièce, le plateau (au-dessus) prend le relais du glisser
      pend.resolved = true;
      cleanupListeners();
      const fakeEvent = {
        pointerId: pend.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        preventDefault() {},
        currentTarget: pend.targetEl,
      };
      onStartDrag(pend.type, fakeEvent);
    } else if (Math.abs(dx) > DRAG_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      // geste horizontal -> on laisse le défilement natif du carrousel faire son travail
      pend.resolved = true;
      cleanupListeners();
    }
  }

  function clearPending() { cleanupListeners(); }
  function cleanupListeners() {
    pendingRef.current = null;
    window.removeEventListener("pointermove", handlePendingMove);
    window.removeEventListener("pointerup", clearPending);
    window.removeEventListener("pointercancel", clearPending);
  }

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
              onPointerDown={(e) => onItemPointerDown(type, e.currentTarget, e)}
              className="flex flex-col items-center gap-1 shrink-0 snap-center transition-all duration-200"
              style={{
                cursor: "grab",
                touchAction: "pan-x",
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
