const MUTE_KEY = "orapa_muted_v1";

export function isMuted() {
  try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
}
export function setMuted(v) {
  try { localStorage.setItem(MUTE_KEY, v ? "1" : "0"); } catch {}
}

let sharedCtx = null;
function ctx() {
  if (!sharedCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    sharedCtx = new AC();
  }
  if (sharedCtx.state === "suspended") sharedCtx.resume();
  return sharedCtx;
}

function tone(freq, duration, type = "sine", delay = 0, peak = 0.15) {
  if (isMuted()) return;
  try {
    const c = ctx();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(c.destination);
    const t0 = c.currentTime + delay;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  } catch (e) { /* audio non disponible, on ignore silencieusement */ }
}

export function playShot() { tone(520, 0.12, "triangle"); }
export function playAbsorbed() { tone(140, 0.25, "sawtooth"); }
export function playTick() { tone(880, 0.05, "square", 0, 0.06); }
export function playWrong() { tone(180, 0.18, "sawtooth", 0, 0.12); }
export function playWin() {
  tone(523.25, 0.15, "sine", 0);
  tone(659.25, 0.15, "sine", 0.12);
  tone(783.99, 0.3, "sine", 0.24);
}
export function playLose() {
  tone(320, 0.2, "sawtooth", 0);
  tone(220, 0.35, "sawtooth", 0.15);
}
