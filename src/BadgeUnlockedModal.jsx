import React from "react";

export default function BadgeUnlockedModal({ badges, onClose }) {
  if (!badges || badges.length === 0) return null;
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="flex flex-col items-center gap-5 max-w-xs w-full">
        {badges.map((b) => (
          <div key={b.id} className="flex flex-col items-center gap-2 bg-[#1B1B29] border-2 border-[#F2C744] rounded-2xl px-6 py-6 w-full text-center shadow-[0_0_40px_rgba(242,199,68,0.35)]">
            <span className="text-6xl">{b.emoji}</span>
            <p className="text-xs uppercase tracking-wide text-[#F2C744] font-semibold mt-1">Badge débloqué</p>
            <h3 className="text-lg font-bold">{b.name}</h3>
            <p className="text-xs text-[#9A94A8]">{b.desc}</p>
          </div>
        ))}
        <button onClick={onClose} className="px-5 py-2 rounded-xl bg-[#F2C744] hover:bg-[#E0B62F] text-[#12121C] font-semibold text-sm">
          Super !
        </button>
      </div>
    </div>
  );
}
