import React, { useState } from "react";
import { X, ArrowRight, ArrowLeft, Gem, RotateCw, Trash2, HelpCircle } from "lucide-react";
import { PIECE_DEFS, colorById } from "./orapaEngine";
import { PieceIcon } from "./PiecePalette";

const TUTORIAL_SEEN_KEY = "orapa_tutorial_seen_v1";
export function hasSeenTutorial() {
  try { return localStorage.getItem(TUTORIAL_SEEN_KEY) === "1"; } catch { return false; }
}
export function markTutorialSeen() {
  try { localStorage.setItem(TUTORIAL_SEEN_KEY, "1"); } catch {}
}

function MiniBoard() {
  return (
    <svg viewBox="0 0 200 140" className="w-full max-w-[260px] mx-auto">
      <rect x={20} y={10} width={160} height={120} rx={6} fill="#1B1B29" stroke="#3A3A52" />
      {Array.from({ length: 5 }).map((_, i) => <line key={"v" + i} x1={20 + i * 32} y1={10} x2={20 + i * 32} y2={130} stroke="#2A2A3A" />)}
      {Array.from({ length: 4 }).map((_, i) => <line key={"h" + i} x1={20} y1={10 + i * 30} x2={180} y2={10 + i * 30} stroke="#2A2A3A" />)}
      <polygon points="52,10 52,70 92,40" fill="#3452B4" stroke="#0C0C14" strokeWidth={1} />
      <line x1={52} y1={0} x2={52} y2={40} stroke="#F2C744" strokeWidth={2} strokeDasharray="4,3" />
      <line x1={52} y1={40} x2={180} y2={40} stroke="#F2C744" strokeWidth={2} strokeDasharray="4,3" />
      <circle cx={52} cy={0} r={5} fill="#2A2A3F" stroke="#6B6B8C" />
      <circle cx={188} cy={40} r={5} fill="#8FC5EA" stroke="#6B6B8C" />
      <text x={52} y={-6} fontSize={9} textAnchor="middle" fill="#C9C4D8">entrée</text>
      <text x={188} y={30} fontSize={9} textAnchor="middle" fill="#8FC5EA">sortie bleue</text>
    </svg>
  );
}

const STEPS = [
  {
    title: "Le principe",
    body: "Des pièces (des gemmes) sont cachées sur un plateau. Tu envoies des faisceaux lumineux depuis les bords : ils rebondissent sur les pièces et ressortent quelque part, avec une couleur. À toi de déduire où sont les pièces.",
    visual: <MiniBoard />,
  },
  {
    title: "Comment un faisceau réagit",
    body: (
      <ul className="text-sm text-[#C9C4D8] space-y-2 list-disc list-inside">
        <li><strong>Arête plate</strong> (alignée sur la grille) → le faisceau fait demi-tour.</li>
        <li><strong>Arête en diagonale</strong> → le faisceau tourne à 90°, comme un miroir.</li>
        <li><strong>Corps noir</strong> (extension) → absorbe le faisceau, rien ne ressort.</li>
        <li><strong>Diamant</strong> (extension) → dévie le faisceau sans le colorer.</li>
      </ul>
    ),
    visual: (
      <div className="flex justify-center gap-4">
        {["triBleu", "triJaune", "rhombeRouge", "triNoir"].map((t) => (
          <div key={t} className="flex flex-col items-center gap-1">
            <PieceIcon def={PIECE_DEFS[t]} boxSize={48} />
            <span className="text-[9px] text-[#6B6580] text-center w-14">{PIECE_DEFS[t].label}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Les couleurs se mélangent",
    body: "Chaque gemme colorée touchée ajoute sa couleur au mélange (bleu, jaune, rouge, blanc). Par exemple bleu + jaune = vert. Une couleur touchée plusieurs fois ne compte qu'une fois. Le récapitulatif complet est toujours accessible via l'icône d'aide (ⓘ).",
    visual: (
      <div className="flex items-center justify-center gap-2 text-sm">
        <span className="w-6 h-6 rounded-full border border-[#0C0C14]" style={{ background: colorById("bleu").hex }} />
        <span className="text-[#F2C744] font-bold">+</span>
        <span className="w-6 h-6 rounded-full border border-[#0C0C14]" style={{ background: colorById("jaune").hex }} />
        <span className="text-[#F2C744] font-bold">=</span>
        <span className="w-6 h-6 rounded-full border border-[#0C0C14]" style={{ background: colorById("vert").hex }} />
        <span className="text-[#C9C4D8] ml-1">Vert</span>
      </div>
    ),
  },
  {
    title: "Les commandes de l'appli",
    body: (
      <ul className="text-sm text-[#C9C4D8] space-y-2">
        <li className="flex items-center gap-2"><span className="p-1.5 rounded-full bg-[#232336]"><RotateCw size={14} /></span> Glisse une pièce sur le plateau, puis touche-la pour la pivoter, la retourner ou la supprimer.</li>
        <li className="flex items-center gap-2"><span className="p-1.5 rounded-full bg-[#232336]"><Trash2 size={14} /></span> Touche une case vide pour la marquer d'une croix (mémo personnel).</li>
        <li className="flex items-center gap-2"><span className="p-1.5 rounded-full bg-[#232336]"><HelpCircle size={14} /></span> L'icône d'aide rappelle les combinaisons de couleurs à tout moment.</li>
      </ul>
    ),
    visual: null,
  },
];

export default function Tutorial({ onClose }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const s = STEPS[step];

  function finish() {
    markTutorialSeen();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1B1B29] rounded-2xl w-full max-w-md border border-[#2A2A3A] flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 pt-5">
          <div className="flex items-center gap-2 text-[#F2C744]"><Gem size={18} /><span className="text-xs font-semibold">Comment jouer</span></div>
          <button onClick={finish} className="p-1 rounded-full hover:bg-[#232336]"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 overflow-y-auto">
          <h2 className="text-lg font-bold mb-3">{s.title}</h2>
          {s.visual && <div className="mb-4">{s.visual}</div>}
          <div className="text-sm text-[#C9C4D8]">{s.body}</div>
        </div>

        <div className="px-5 pb-5 pt-2 flex items-center justify-between border-t border-[#2A2A3A]">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i === step ? "#F2C744" : "#3A3A52" }} />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep((s) => s - 1)} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#232336] hover:bg-[#2E2E46] text-sm">
                <ArrowLeft size={14} /> Précédent
              </button>
            )}
            <button
              onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-[#F2C744] hover:bg-[#E0B62F] text-[#12121C] font-semibold text-sm"
            >
              {isLast ? "C'est parti !" : <>Suivant <ArrowRight size={14} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
