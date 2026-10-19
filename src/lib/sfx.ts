/**
 * Goalmaster sound effects, synthesized live with the Web Audio API (no audio files to download or license).
 * Browser-only: every entry point is a no-op during SSR, before the first user gesture, or when muted.
 */
import type { RareFx } from "@/lib/rare-reveal";

const MUTE_KEY = "gm-sfx-muted";

interface Engine {
  ctx: AudioContext;
  master: GainNode;
  verb: ConvolverNode;
  noise: AudioBuffer;
}

let engine: Engine | null = null;
let mutedCache: boolean | null = null;
const muteListeners = new Set<() => void>();
let lastSpecial = 0;

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  if (mutedCache === null) {
    try { mutedCache = window.localStorage.getItem(MUTE_KEY) === "1"; } catch { mutedCache = false; }
  }
  return mutedCache;
}

export function setMuted(m: boolean) {
  mutedCache = m;
  try { window.localStorage.setItem(MUTE_KEY, m ? "1" : "0"); } catch { /* private mode */ }
  if (engine) engine.master.gain.setTargetAtTime(m ? 0 : 0.6, engine.ctx.currentTime, 0.03);
  muteListeners.forEach((l) => l());
}

export function subscribeMuted(l: () => void) {
  muteListeners.add(l);
  return () => { muteListeners.delete(l); };
}

function impulse(ctx: AudioContext, seconds: number, decay: number) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
  }
  return buf;
}

function ensure(): Engine | null {
  if (typeof window === "undefined" || isMuted()) return null;
  if (!engine) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 5;
    const master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(comp).connect(ctx.destination);
    const verb = ctx.createConvolver();
    verb.buffer = impulse(ctx, 2.4, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    verb.connect(wet).connect(master);
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    engine = { ctx, master, verb, noise };
  }
  if (engine.ctx.state === "suspended") void engine.ctx.resume();
  return engine;
}

/** Resume audio on the first gesture (browsers keep it locked until then). */
export function unlockAudio() { ensure(); }

function route(e: Engine, node: AudioNode, reverb: number, pan = 0) {
  let out: AudioNode = node;
  if (pan && e.ctx.createStereoPanner) {
    const p = e.ctx.createStereoPanner();
    p.pan.value = pan;
    node.connect(p);
    out = p;
  }
  out.connect(e.master);
  if (reverb > 0) {
    const s = e.ctx.createGain();
    s.gain.value = reverb;
    out.connect(s).connect(e.verb);
  }
}

interface ToneOpts {
  freq: number; to?: number; glide?: number; type?: OscillatorType; start?: number; dur: number;
  attack?: number; gain?: number; reverb?: number; pan?: number; detune?: number; lowpass?: number;
}

function tone(e: Engine, o: ToneOpts) {
  const t = e.ctx.currentTime + (o.start ?? 0);
  const osc = e.ctx.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide ?? o.dur));
  if (o.detune) osc.detune.value = o.detune;
  const g = e.ctx.createGain();
  const attack = Math.max(0.003, o.attack ?? 0.005);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.15, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + 0.01, o.dur));
  let src: AudioNode = osc;
  if (o.lowpass) {
    const f = e.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = o.lowpass;
    osc.connect(f);
    src = f;
  }
  src.connect(g);
  route(e, g, o.reverb ?? 0.15, o.pan);
  osc.start(t);
  osc.stop(t + o.dur + 0.05);
}

interface NoiseOpts {
  start?: number; dur: number; filter?: BiquadFilterType; freq?: number; to?: number; q?: number;
  attack?: number; gain?: number; reverb?: number; pan?: number;
}

function noise(e: Engine, o: NoiseOpts) {
  const t = e.ctx.currentTime + (o.start ?? 0);
  const src = e.ctx.createBufferSource();
  src.buffer = e.noise;
  src.loop = true;
  const f = e.ctx.createBiquadFilter();
  f.type = o.filter ?? "bandpass";
  f.frequency.setValueAtTime(o.freq ?? 1000, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  f.Q.value = o.q ?? 1;
  const g = e.ctx.createGain();
  const attack = Math.max(0.003, o.attack ?? 0.005);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.1, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + 0.01, o.dur));
  src.connect(f).connect(g);
  route(e, g, o.reverb ?? 0.1, o.pan);
  src.start(t, Math.random() * 1.5);
  src.stop(t + o.dur + 0.05);
}

/** Inharmonic partials of a struck bell. */
function bell(e: Engine, freq: number, start = 0, dur = 1.2, gain = 0.08, pan = 0) {
  const partials: [number, number][] = [[1, 1], [2.756, 0.45], [5.404, 0.25], [8.933, 0.12]];
  for (const [ratio, amp] of partials) {
    tone(e, { freq: freq * ratio, start, dur: dur / Math.sqrt(ratio), gain: gain * amp, reverb: 0.35, pan });
  }
}

function coin(e: Engine, start: number) {
  const base = 2400 + Math.random() * 500;
  tone(e, { freq: base, start, dur: 0.09, gain: 0.07, type: "square", lowpass: 6000, reverb: 0.1 });
  tone(e, { freq: base * 1.5, start: start + 0.04, dur: 0.45, gain: 0.06, reverb: 0.3 });
  tone(e, { freq: base * 2.1, start: start + 0.04, dur: 0.3, gain: 0.03, reverb: 0.3 });
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const special = () => { lastSpecial = Date.now(); };

/** Toasts skip their generic chime when a dedicated sound just played for the same action. */
export const recentlyPlayedSpecial = (ms = 600) => Date.now() - lastSpecial < ms;

const C_MAJOR = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77];

function play(fn: (e: Engine) => void) {
  const e = ensure();
  if (!e) return;
  try { fn(e); } catch { /* never let audio break the game */ }
}

export const sfx = {
  click: () => play((e) => {
    tone(e, { freq: 1500, to: 900, dur: 0.06, gain: 0.08, reverb: 0.05 });
    noise(e, { dur: 0.025, filter: "highpass", freq: 4500, gain: 0.04 });
  }),
  tab: () => play((e) => {
    tone(e, { freq: 587, dur: 0.1, type: "triangle", gain: 0.09, reverb: 0.15 });
    tone(e, { freq: 880, start: 0.05, dur: 0.14, type: "triangle", gain: 0.08, reverb: 0.2 });
  }),
  select: () => play((e) => tone(e, { freq: 880, to: 1320, dur: 0.09, gain: 0.08, reverb: 0.15 })),
  back: () => play((e) => tone(e, { freq: 760, to: 420, dur: 0.12, gain: 0.08, reverb: 0.1 })),
  open: () => play((e) => {
    noise(e, { dur: 0.22, freq: 500, to: 2600, q: 1.4, gain: 0.06, attack: 0.08 });
    tone(e, { freq: 520, to: 1040, dur: 0.2, gain: 0.05, reverb: 0.3 });
  }),
  success: () => play((e) => { bell(e, 1046.5, 0, 0.9, 0.07); bell(e, 1568, 0.09, 1.1, 0.06); }),
  error: () => play((e) => {
    tone(e, { freq: 190, dur: 0.11, type: "square", gain: 0.05, lowpass: 1400 });
    tone(e, { freq: 150, start: 0.13, dur: 0.16, type: "square", gain: 0.05, lowpass: 1400 });
  }),
  coins: (count = 5) => play((e) => {
    special();
    for (let i = 0; i < count; i++) coin(e, i * 0.07 + rand(0, 0.03));
  }),
  gavel: () => play((e) => {
    special();
    for (const s of [0, 0.16]) {
      noise(e, { start: s, dur: 0.06, freq: 1700, q: 7, gain: 0.35 });
      tone(e, { start: s, freq: 620, to: 260, dur: 0.08, gain: 0.18 });
    }
  }),
  sparkle: () => play((e) => {
    [2093, 2637, 3136].forEach((f, i) => bell(e, f, i * 0.06, 0.7, 0.025, rand(-0.4, 0.4)));
  }),

  // ---------- Cards ----------
  whoosh: (intensity = 0.6) => play((e) => {
    const k = Math.max(0.15, Math.min(1, intensity));
    noise(e, { dur: 0.18 + k * 0.15, freq: 350, to: 900 + k * 2200, q: 1.2, gain: 0.04 + k * 0.1, attack: 0.06, pan: rand(-0.3, 0.3) });
  }),
  cardFlip: () => play((e) => {
    noise(e, { dur: 0.15, freq: 1100, to: 3800, q: 1.6, gain: 0.11, attack: 0.03 });
    tone(e, { start: 0.11, freq: 320, to: 170, dur: 0.08, gain: 0.08 });
  }),
  cardSlide: () => play((e) => noise(e, { dur: 0.22, filter: "lowpass", freq: 1400, to: 300, gain: 0.07, attack: 0.04 })),
  stackAppear: () => play((e) => {
    for (let i = 0; i < 5; i++) noise(e, { start: i * 0.07, dur: 0.12, filter: "lowpass", freq: 1800, to: 500, gain: 0.05, pan: (i - 2) * 0.12 });
  }),
  /** Suspense riser while a Super Rare card back charges before flipping. */
  charge: (ms: number, tier: number) => play((e) => {
    const d = ms / 1000;
    tone(e, { freq: 110 * tier / 3, to: 330 * tier / 3, dur: d, attack: d * 0.9, type: "triangle", gain: 0.06, reverb: 0.3 });
    noise(e, { dur: d, freq: 300, to: 2400, q: 2, attack: d * 0.9, gain: 0.05 });
  }),
  /** The face appears: the sound grows with the rarity. */
  reveal: (tier: number, isNew = false) => play((e) => {
    tone(e, { freq: 440 + tier * 40, to: 300, dur: 0.12, gain: 0.08 });
    if (tier >= 2) bell(e, 987.77, 0.02, 0.8, 0.05);
    if (tier >= 3) bell(e, 1318.5, 0.07, 1, 0.06);
    if (tier >= 4) {
      [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => bell(e, f, 0.03 * i, 1.6, 0.06));
      noise(e, { dur: 0.6, filter: "highpass", freq: 6000, gain: 0.03, attack: 0.05, reverb: 0.6 });
    }
    if (isNew) tone(e, { start: 0.18, freq: 1760, to: 2637, dur: 0.18, gain: 0.04, reverb: 0.4 });
  }),

  // ---------- Pack ----------
  /** Paper tearing that follows the finger along the tear line. */
  startTear: () => {
    const e = ensure();
    if (!e) return { update: (_p: number) => {}, end: () => {} };
    const src = e.ctx.createBufferSource();
    src.buffer = e.noise;
    src.loop = true;
    const bp = e.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    bp.Q.value = 0.9;
    const g = e.ctx.createGain();
    g.gain.value = 0.0001;
    src.connect(bp).connect(g);
    route(e, g, 0.05);
    src.start();
    let last = 0;
    return {
      update(p: number) {
        const now = e.ctx.currentTime;
        const delta = p - last;
        bp.frequency.setTargetAtTime(900 + p * 2600, now, 0.03);
        if (delta > 0.002) {
          g.gain.setTargetAtTime(Math.min(0.32, 0.06 + delta * 9), now, 0.015);
          g.gain.setTargetAtTime(0.0001, now + 0.06, 0.05);
          if (Math.random() < Math.min(0.9, delta * 30)) {
            noise(e, { dur: 0.018, filter: "highpass", freq: rand(2500, 5000), gain: rand(0.06, 0.14) });
          }
        }
        last = Math.max(last, p);
      },
      end() {
        const now = e.ctx.currentTime;
        g.gain.cancelScheduledValues(now);
        g.gain.setTargetAtTime(0.0001, now, 0.04);
        src.stop(now + 0.3);
      },
    };
  },
  /** The strip comes off: rip, thump, then the light pours out. */
  tearComplete: () => play((e) => {
    noise(e, { dur: 0.32, freq: 3000, to: 700, q: 0.8, gain: 0.28, attack: 0.01 });
    noise(e, { dur: 0.4, filter: "lowpass", freq: 400, to: 120, gain: 0.2 });
    tone(e, { freq: 95, to: 40, dur: 0.4, gain: 0.22 });
  }),
  packGlow: () => play((e) => {
    tone(e, { freq: 300, to: 1500, dur: 0.75, attack: 0.6, gain: 0.07, reverb: 0.6 });
    noise(e, { dur: 0.8, filter: "highpass", freq: 5000, to: 9000, attack: 0.55, gain: 0.05, reverb: 0.6 });
    const scale = [1046.5, 1174.66, 1318.5, 1567.98, 1760, 2093, 2349.3, 2637];
    for (let i = 0; i < 12; i++) bell(e, scale[Math.floor(Math.random() * scale.length)]!, i * 0.055, 0.8, 0.025, rand(-0.6, 0.6));
  }),
  whiteout: () => play((e) => {
    noise(e, { dur: 1.1, filter: "lowpass", freq: 2400, to: 180, gain: 0.16, attack: 0.02, reverb: 0.7 });
    tone(e, { freq: 1760, dur: 1.3, gain: 0.035, attack: 0.05, reverb: 0.8 });
    tone(e, { freq: 2637, dur: 1.1, gain: 0.025, attack: 0.05, reverb: 0.8 });
  }),
  packSummary: (coinsGained: number) => play((e) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(e, f, i * 0.07, 1.2, 0.05));
    if (coinsGained > 0) for (let i = 0; i < 4; i++) coin(e, 0.35 + i * 0.07);
  }),

  // ---------- Légendaire+ reveal ----------
  rareBuild: (fx: RareFx, ms: number) => play((e) => {
    const d = ms / 1000;
    noise(e, { dur: d, filter: "lowpass", freq: 120, to: 600, attack: d * 0.85, gain: 0.22, reverb: 0.3 });
    tone(e, { freq: 55, to: 110, dur: d, attack: d * 0.9, gain: 0.2, reverb: 0.2 });
    if (fx === "legendary") tone(e, { freq: 220, to: 880, dur: d, attack: d * 0.9, type: "triangle", gain: 0.07, reverb: 0.5 });
    if (fx === "alt") C_MAJOR.concat(C_MAJOR.map((f) => f * 2)).forEach((f, i, a) => tone(e, { freq: f / 2, start: (i / a.length) ** 0.7 * d * 0.9, dur: 0.25, type: "triangle", gain: 0.04, reverb: 0.5 }));
    if (fx === "secret_legendary") for (let i = 0; i < 16; i++) bell(e, rand(2000, 4200), (i / 16) * d * 0.95, 0.5, 0.012 + (i / 16) * 0.03, rand(-0.7, 0.7));
    if (fx === "shiny") tone(e, { freq: 110, to: 440, dur: d, attack: d * 0.9, type: "sawtooth", gain: 0.05, lowpass: 2200, reverb: 0.4 });
    if (fx === "secret_ultimate") {
      tone(e, { freq: 48, to: 80, dur: d, attack: d * 0.8, type: "sawtooth", gain: 0.09, lowpass: 500, reverb: 0.3 });
      for (let i = 0; i < 26; i++) {
        const at = (i / 26) ** 0.6 * d;
        noise(e, { start: at, dur: 0.03, filter: "highpass", freq: rand(1500, 4000), gain: 0.03 + (i / 26) * 0.12, pan: rand(-0.8, 0.8) });
      }
    }
  }),
  rareBoom: (fx: RareFx) => play((e) => {
    special();
    const big = fx === "secret_ultimate" ? 1.4 : 1;
    tone(e, { freq: 150, to: 32, dur: 1 * big, gain: 0.5, reverb: 0.4 });
    noise(e, { dur: 1.3 * big, filter: "lowpass", freq: 1400, to: 90, gain: 0.42, reverb: 0.6 });
    noise(e, { dur: 0.28, filter: "highpass", freq: 3000, gain: 0.16, reverb: 0.4 });
    if (fx === "legendary") {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => bell(e, f, 0.05 + i * 0.03, 2.6, 0.08, (i - 2) * 0.2));
      [261.63, 329.63, 392].forEach((f) => tone(e, { freq: f, dur: 2, attack: 0.08, type: "triangle", gain: 0.05, reverb: 0.6 }));
    }
    if (fx === "alt") {
      const notes = C_MAJOR.concat(C_MAJOR.map((f) => f * 2));
      notes.forEach((f, i) => bell(e, f, 0.05 + i * 0.045, 1.4, 0.05, Math.sin(i) * 0.6));
      [523.25, 659.25, 783.99, 987.77].forEach((f) => tone(e, { freq: f, start: 0.7, dur: 1.8, attack: 0.1, type: "triangle", gain: 0.035, reverb: 0.7 }));
    }
    if (fx === "secret_legendary") {
      for (let i = 0; i < 26; i++) bell(e, rand(1800, 5200), rand(0, 1.1), rand(0.4, 1), 0.03, rand(-0.9, 0.9));
      [1567.98, 1975.53, 2349.32].forEach((f) => bell(e, f, 0.05, 2.4, 0.07));
    }
    if (fx === "shiny") {
      tone(e, { freq: 1900, to: 160, dur: 0.25, type: "square", gain: 0.06, lowpass: 5000 });
      [220, 277.18, 329.63, 440].forEach((f) => {
        tone(e, { freq: f, dur: 1.8, attack: 0.04, type: "sawtooth", gain: 0.05, lowpass: 3000, reverb: 0.5, detune: rand(-8, 8) });
        tone(e, { freq: f * 2, dur: 1.6, attack: 0.04, type: "square", gain: 0.02, lowpass: 2400, reverb: 0.5 });
      });
    }
    if (fx === "secret_ultimate") {
      noise(e, { dur: 2.8, freq: 420, q: 0.6, attack: 0.05, gain: 0.32, reverb: 0.5 });
      tone(e, { freq: 120, to: 62, glide: 1.4, dur: 1.6, attack: 0.12, type: "sawtooth", gain: 0.16, lowpass: 900, reverb: 0.4 });
      tone(e, { freq: 180, to: 90, glide: 1.4, dur: 1.4, attack: 0.15, type: "sawtooth", gain: 0.08, lowpass: 1200, reverb: 0.4, detune: 25 });
      for (let i = 0; i < 40; i++) noise(e, { start: rand(0, 2.6), dur: rand(0.015, 0.05), filter: "highpass", freq: rand(1200, 5000), gain: rand(0.04, 0.14), pan: rand(-0.9, 0.9) });
    }
  }),

  // ---------- Duels ----------
  playCard: () => play((e) => {
    special();
    tone(e, { freq: 210, to: 110, dur: 0.14, gain: 0.2 });
    noise(e, { dur: 0.1, filter: "lowpass", freq: 900, gain: 0.14 });
  }),
  roundWin: () => play((e) => { special(); [783.99, 1046.5, 1318.5].forEach((f, i) => bell(e, f, i * 0.08, 1.2, 0.07)); }),
  roundLose: () => play((e) => {
    special();
    tone(e, { freq: 392, to: 262, dur: 0.5, type: "triangle", gain: 0.08, reverb: 0.3 });
    tone(e, { freq: 311, to: 208, start: 0.08, dur: 0.5, type: "triangle", gain: 0.06, reverb: 0.3 });
  }),
  roundDraw: () => play((e) => { special(); bell(e, 659.25, 0, 0.8, 0.06); bell(e, 659.25, 0.12, 0.8, 0.05); }),
  duelWin: () => play((e) => {
    special();
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(e, { freq: f, start: i * 0.12, dur: 0.3, type: "triangle", gain: 0.09, reverb: 0.4 }));
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f) => bell(e, f, 0.5, 2.4, 0.06));
    for (let i = 0; i < 6; i++) coin(e, 0.7 + i * 0.07);
  }),
  duelLose: () => play((e) => {
    special();
    [392, 329.63, 261.63].forEach((f, i) => tone(e, { freq: f, start: i * 0.2, dur: 0.45, type: "triangle", gain: 0.08, reverb: 0.4 }));
  }),
};

export type SfxName = keyof typeof sfx;

const SIMPLE: Partial<Record<string, () => void>> = {
  click: sfx.click, tab: sfx.tab, select: sfx.select, back: sfx.back, open: sfx.open, flip: sfx.cardFlip, whoosh: () => sfx.whoosh(0.5),
};

/**
 * One document-level listener gives every button, link, tab and toggle a sound.
 * Elements opt out with data-sfx="none" (they play their own dedicated sound) or pick one with data-sfx="tab" etc.
 * Toasts get a success/error chime unless a dedicated sound just played.
 */
export function installGlobalSounds(): () => void {
  if (typeof document === "undefined") return () => {};
  const onPointer = () => unlockAudio();
  const onClick = (ev: MouseEvent) => {
    const el = (ev.target as Element | null)?.closest?.(
      "[data-sfx], button, a[href], [role=button], [role=tab], [role=radio], [role=checkbox], [role=switch], [role=option], [role=menuitem], summary, label, select",
    ) as HTMLElement | null;
    if (!el || el.closest("[data-sfx='none']")) return;
    if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return;
    const named = el.closest<HTMLElement>("[data-sfx]")?.dataset['sfx'];
    if (named) { SIMPLE[named]?.(); return; }
    const role = el.getAttribute("role");
    if (el.closest("header nav")) return sfx.tab();
    if (role === "tab" || role === "radio" || role === "option" || el.hasAttribute("aria-pressed") || role === "checkbox" || role === "switch") return sfx.select();
    const label = (el.getAttribute("aria-label") ?? "").toLowerCase();
    if (label.includes("fermer") || label === "close") return sfx.back();
    if (el.tagName === "SELECT" || el.tagName === "LABEL") return sfx.select();
    sfx.click();
  };
  const seen = new WeakSet<Element>();
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes.forEach((n) => {
        if (!(n instanceof HTMLElement)) return;
        const toast = n.matches("[data-sonner-toast]") ? n : n.querySelector?.("[data-sonner-toast]");
        if (!toast || seen.has(toast)) return;
        seen.add(toast);
        const type = toast.getAttribute("data-type");
        if (recentlyPlayedSpecial()) return;
        if (type === "error") sfx.error();
        else if (type === "success") sfx.success();
      });
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("pointerdown", onPointer, { capture: true, passive: true });
  document.addEventListener("click", onClick, { capture: true });
  return () => {
    obs.disconnect();
    document.removeEventListener("pointerdown", onPointer, { capture: true });
    document.removeEventListener("click", onClick, { capture: true });
  };
}
