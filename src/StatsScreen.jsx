import React from "react";
import { Gem, ChevronLeft, Bot, Swords, Puzzle } from "lucide-react";
import { getStats, averagePuzzleTime } from "./stats";

function formatTime(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function StatCard({ icon, title, rows }) {
  return (
    <div className="bg-[#1B1B29] border border-[#2A2A3A] rounded-2xl p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">{icon} {title}</h3>
      <div className="flex flex-col gap-2 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between">
            <span className="text-[#9A94A8]">{r.label}</span>
            <span className="font-semibold">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StatsScreen({ onExit }) {
  const s = getStats();
  const avg = averagePuzzleTime(s);
  const aiTotal = s.aiWins + s.aiLosses;
  const duelTotal = s.duelWins + s.duelLosses;

  return (
    <div className="min-h-screen w-full bg-[#12121C] text-[#EDE9E0] font-sans">
      <header className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-[#2A2A3A]">
        <div className="flex items-center gap-2">
          <Gem size={20} className="text-[#F2C744]" />
          <h1 className="text-lg font-bold" style={{ fontFamily: "Georgia, serif" }}>Mes statistiques</h1>
        </div>
        <button onClick={onExit} className="text-xs text-[#9A94A8] hover:text-[#EDE9E0] flex items-center gap-1">
          <ChevronLeft size={14} /> Accueil
        </button>
      </header>

      <div className="p-4 max-w-md mx-auto flex flex-col gap-4">
        <StatCard
          icon={<Bot size={16} className="text-[#CC6FC4]" />}
          title="Contre l'IA"
          rows={[
            { label: "Victoires", value: s.aiWins },
            { label: "Défaites", value: s.aiLosses },
            { label: "Taux de victoire", value: aiTotal ? `${Math.round((s.aiWins / aiTotal) * 100)}%` : "—" },
          ]}
        />
        <StatCard
          icon={<Swords size={16} className="text-[#EE9C9C]" />}
          title="Duel en ligne"
          rows={[
            { label: "Victoires", value: s.duelWins },
            { label: "Défaites", value: s.duelLosses },
            { label: "Taux de victoire", value: duelTotal ? `${Math.round((s.duelWins / duelTotal) * 100)}%` : "—" },
          ]}
        />
        <StatCard
          icon={<Puzzle size={16} className="text-[#EDAE2E]" />}
          title="Puzzles"
          rows={[
            { label: "Résolus", value: s.puzzlesSolved },
            { label: "Temps moyen", value: avg != null ? formatTime(avg) : "—" },
          ]}
        />
        {aiTotal + duelTotal + s.puzzlesSolved === 0 && (
          <p className="text-center text-xs text-[#6B6580] mt-2">Joue quelques parties pour voir tes statistiques apparaître ici.</p>
        )}
      </div>
    </div>
  );
}
