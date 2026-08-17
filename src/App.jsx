import React, { useState } from "react";
import SoloTracker from "./SoloTracker";
import DuelGame from "./DuelGame";
import { Gem, Users, Swords } from "lucide-react";

export default function App() {
  const [mode, setMode] = useState(null); // null | 'solo' | 'duel'

  if (mode === "solo") return <SoloTracker />;
  if (mode === "duel") return <DuelGame onExit={() => setMode(null)} />;

  return (
    <div className="min-h-screen w-full bg-[#12121C] text-[#EDE9E0] font-sans flex flex-col items-center justify-center px-6 gap-8">
      <div className="text-center">
        <Gem size={40} className="mx-auto text-[#F2C744] mb-3" />
        <h1 className="text-2xl font-bold" style={{ fontFamily: "Georgia, serif" }}>Orapa Mine</h1>
        <p className="text-sm text-[#9A94A8] mt-1">Carnet de faisceaux &amp; duel en ligne</p>
      </div>

      <div className="w-full max-w-xs flex flex-col gap-3">
        <button
          onClick={() => setMode("solo")}
          className="flex items-center gap-3 w-full bg-[#1B1B29] hover:bg-[#232336] border border-[#2A2A3A] rounded-2xl px-4 py-4 text-left transition-colors"
        >
          <Users size={22} className="text-[#8FC5EA]" />
          <div>
            <div className="font-semibold">Mode solo</div>
            <div className="text-xs text-[#9A94A8]">Carnet de tirs, hypothèses et simulateur</div>
          </div>
        </button>

        <button
          onClick={() => setMode("duel")}
          className="flex items-center gap-3 w-full bg-[#1B1B29] hover:bg-[#232336] border border-[#2A2A3A] rounded-2xl px-4 py-4 text-left transition-colors"
        >
          <Swords size={22} className="text-[#EE9C9C]" />
          <div>
            <div className="font-semibold">Duel en ligne</div>
            <div className="text-xs text-[#9A94A8]">Affronte un adversaire à distance</div>
          </div>
        </button>
      </div>
    </div>
  );
}
