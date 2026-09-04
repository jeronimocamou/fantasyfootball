// Tiny synthesized sound effects via the Web Audio API — no audio files to
// ship or license, just oscillators with a short gain envelope. Safe to
// import from a client component only (window/AudioContext gated below).

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext })
    .webkitAudioContext;
  if (!AudioCtor) return null;
  if (!ctx) ctx = new AudioCtor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  duration: number,
  { type = "square", gain = 0.15, delay = 0 }: { type?: OscillatorType; gain?: number; delay?: number } = {}
) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const start = c.currentTime + delay;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

// Unlocks the AudioContext — call this from the same click handler that
// starts a spin, since browsers block audio until a user gesture.
export function primeAudio() {
  getCtx();
}

export function playLever() {
  tone(140, 0.16, { type: "triangle", gain: 0.22 });
}

export function playTick() {
  tone(1000, 0.03, { type: "square", gain: 0.05 });
}

export function playReelStop() {
  tone(200, 0.09, { type: "square", gain: 0.16 });
}

export function playHalfBack() {
  tone(660, 0.1, { type: "sine", gain: 0.14 });
  tone(880, 0.14, { type: "sine", gain: 0.12, delay: 0.07 });
}

export function playLose() {
  tone(200, 0.22, { type: "sawtooth", gain: 0.1 });
  tone(130, 0.28, { type: "sawtooth", gain: 0.09, delay: 0.09 });
}

export function playWin(jackpot: boolean) {
  const notes = jackpot
    ? [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98] // C5 E5 G5 C6 E6 G6
    : [523.25, 659.25, 783.99]; // C5 E5 G5
  notes.forEach((freq, i) => tone(freq, 0.2, { type: "square", gain: 0.17, delay: i * 0.09 }));
}
