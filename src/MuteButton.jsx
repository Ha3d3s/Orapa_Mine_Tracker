import React, { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isMuted, setMuted } from "./sounds";

export default function MuteButton() {
  const [muted, setMutedState] = useState(isMuted());
  return (
    <button
      onClick={() => { const v = !muted; setMuted(v); setMutedState(v); }}
      className="p-1.5 rounded-full hover:bg-[#232336]"
      aria-label={muted ? "Activer le son" : "Couper le son"}
    >
      {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
    </button>
  );
}
