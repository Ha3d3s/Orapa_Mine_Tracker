import React, { useState } from "react";
import SoloTracker from "./SoloTracker";
import DuelGame from "./DuelGame";
import PuzzleMode from "./PuzzleMode";
import AIMode from "./AIMode";
import { Gem, Users, Swords, Puzzle, NotebookPen, Bot, ChevronLeft } from "lucide-react";

export default function App() {
  const [mode, setMode] = useState(null); // null | 'soloMenu' | 'soloFree' | 'aiMode' | 'duel' | 'puzzle'

  if (mode === "soloFree") return <SoloTracker />;
  if (mode === "aiMode") return <AIMode onExit={() => setMode("soloMenu")} />;
  if (mode === "duel") return <DuelGame onExit={() => setMode(null)} />;
  if (mode === "puzzle") return <PuzzleMode onExit={() => setMode(null)} />;

  if (mode === "soloMenu") {
    return (
      <div className="min-h-screen w-full bg-[#12121C] text-[#EDE9E0] font-sans flex flex-col items-center justify-center px-6 gap-8">
        <div className="text-center">
          <Gem size={36} className="mx-auto text-[#F2C744] mb-3" />
          <h1 className="text-xl font-bold" style={{ fontFamily: "Georgia, serif" }}>Mode solo</h1>
        </div>
        <div className="w-full max-w-xs flex flex-col gap-3">
          <button onClick={() => setMode("soloFree")} className="flex items-center gap-3 w-full bg-[#1B1B29] hover:bg-[#232336] border border-[#2A2A3A] rounded-2xl px-4 py-4 text-left transition-colors">
            <NotebookPen size={22} className="text-[#8FC5EA]" />
            <div>
              <div className="font-semibold">Carnet libre</div>
              <div className="text-xs text-[#9A94A8]">Suis ta partie physique, teste des hypothèses</div>
            </div>
          </button>
          <button onClick={() => setMode("aiMode")} className="flex items-center gap-3 w-full bg-[#1B1B29] hover:bg-[#232336] border border-[#2A2A3A] rounded-2xl px-4 py-4 text-left transition-colors">
            <Bot size={22} className="text-[#CC6FC4]" />
            <div>
              <div className="font-semibold">Contre l'IA</div>
              <div className="text-xs text-[#9A94A8]">Plateau caché aléatoire, interroge-le et propose ta réponse</div>
            </div>
          </button>
          <button onClick={() => setMode(null)} className="text-xs text-[#6B6580] hover:text-[#EDE9E0] flex items-center justify-center gap-1 mt-2">
            <ChevronLeft size={14} /> Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#12121C] text-[#EDE9E0] font-sans flex flex-col items-center justify-center px-6 gap-8">
      <div className="text-center">
        <Gem size={40} className="mx-auto text-[#F2C744] mb-3" />
        <h1 className="text-2xl font-bold" style={{ fontFamily: "Georgia, serif" }}>Orapa Mine</h1>
        <p className="text-sm text-[#9A94A8] mt-1">Carnet de faisceaux, puzzles &amp; duel en ligne</p>
      </div>

      <div className="w-full max-w-xs flex flex-col gap-3">
        <button onClick={() => setMode("soloMenu")} className="flex items-center gap-3 w-full bg-[#1B1B29] hover:bg-[#232336] border border-[#2A2A3A] rounded-2xl px-4 py-4 text-left transition-colors">
          <Users size={22} className="text-[#8FC5EA]" />
          <div>
            <div className="font-semibold">Mode solo</div>
            <div className="text-xs text-[#9A94A8]">Carnet libre ou partie contre l'IA</div>
          </div>
        </button>

        <button onClick={() => setMode("puzzle")} className="flex items-center gap-3 w-full bg-[#1B1B29] hover:bg-[#232336] border border-[#2A2A3A] rounded-2xl px-4 py-4 text-left transition-colors">
          <Puzzle size={22} className="text-[#EDAE2E]" />
          <div>
            <div className="font-semibold">Puzzles</div>
            <div className="text-xs text-[#9A94A8]">50 grilles chronométrées, du plus simple au plus dur</div>
          </div>
        </button>

        <button onClick={() => setMode("duel")} className="flex items-center gap-3 w-full bg-[#1B1B29] hover:bg-[#232336] border border-[#2A2A3A] rounded-2xl px-4 py-4 text-left transition-colors">
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
