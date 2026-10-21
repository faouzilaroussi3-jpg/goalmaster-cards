// One controller for every device: keyboard (physical keys, so AZERTY and QWERTY both work), gamepad and touch.
// read() merges them into the PadInput the match engine expects; buttons are counters so presses are never lost.
import { idlePad, shotPower, type PadInput } from "@/lib/live-match";

export type PadAction = "pass" | "through" | "cross" | "swap" | "shot" | "sprint";

/** event.code → action (physical positions: KeyW is Z on an AZERTY keyboard). */
export const KEY_ACTIONS: Record<string, PadAction> = {
  KeyJ: "pass", KeyX: "pass",
  KeyI: "through", KeyV: "through",
  KeyL: "cross", KeyB: "cross",
  KeyK: "shot", KeyC: "shot", Space: "shot",
  ShiftLeft: "sprint", ShiftRight: "sprint",
  KeyE: "swap", KeyN: "swap",
};
const KEY_MOVES: Record<string, [number, number]> = {
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
};
/** Standard gamepad layout (Xbox / PlayStation / Switch Pro in the browser). */
const PAD_BUTTONS: Partial<Record<number, PadAction>> = { 0: "pass", 1: "shot", 2: "cross", 3: "through", 4: "swap", 5: "sprint", 7: "sprint" };
const DEADZONE = 0.22;

export class Pad {
  private keys = new Set<string>();
  private held = new Map<PadAction, Set<string>>();
  private c = { pass: 0, through: 0, cross: 0, swap: 0, shot: 0, shotPress: 0 };
  private power = 0;
  private shotDown = 0;
  private gpPrev: boolean[] = [];
  touch = { mx: 0, my: 0 };
  gamepad: string | null = null;
  onPause: (() => void) | null = null;

  press(a: PadAction, src: string, now = performance.now()) {
    const set = this.held.get(a) ?? new Set<string>();
    const was = set.size > 0;
    set.add(src);
    this.held.set(a, set);
    if (was) return;
    if (a === "shot") { this.c.shotPress++; this.shotDown = now; }
    else if (a !== "sprint") this.c[a]++;
  }

  release(a: PadAction, src: string, now = performance.now()) {
    const set = this.held.get(a);
    if (!set?.delete(src) || set.size) return;
    if (a === "shot") { this.power = shotPower(now - this.shotDown); this.c.shot++; }
  }

  isHeld(a: PadAction) { return (this.held.get(a)?.size ?? 0) > 0; }

  /** Current shot charge (0..1) while the shoot button is held, for the power bar. */
  charge(now = performance.now()) { return this.isHeld("shot") ? shotPower(now - this.shotDown) : 0; }

  keyDown(code: string) {
    if (KEY_MOVES[code]) { this.keys.add(code); return true; }
    const a = KEY_ACTIONS[code];
    if (a) { this.press(a, `k:${code}`); return true; }
    return false;
  }

  keyUp(code: string) {
    this.keys.delete(code);
    const a = KEY_ACTIONS[code];
    if (a) this.release(a, `k:${code}`);
  }

  /** Window lost focus: let go of everything (a shot in charge is not fired). */
  clear() {
    this.keys.clear();
    for (const set of this.held.values()) set.clear();
    this.touch = { mx: 0, my: 0 };
  }

  private pollGamepad(now: number): [number, number] {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return [0, 0];
    const gp = Array.from(navigator.getGamepads()).find((p) => p && p.connected) ?? null;
    this.gamepad = gp?.id ?? null;
    if (!gp) return [0, 0];
    const pressed = gp.buttons.map((b) => b.pressed || b.value > 0.4);
    pressed.forEach((on, i) => {
      if (on === !!this.gpPrev[i]) return;
      const a = PAD_BUTTONS[i];
      if (a) { if (on) this.press(a, `g:${i}`, now); else this.release(a, `g:${i}`, now); }
      if (i === 9 && on) this.onPause?.();
    });
    this.gpPrev = pressed;
    let x = gp.axes[0] ?? 0, y = gp.axes[1] ?? 0;
    if (Math.hypot(x, y) < DEADZONE) { x = 0; y = 0; }
    if (pressed[12]) y = -1;
    if (pressed[13]) y = 1;
    if (pressed[14]) x = -1;
    if (pressed[15]) x = 1;
    return [x, y];
  }

  read(now = performance.now()): PadInput {
    const [gx, gy] = this.pollGamepad(now);
    let kx = 0, ky = 0;
    for (const k of this.keys) { const m = KEY_MOVES[k]; if (m) { kx += m[0]; ky += m[1]; } }
    const km = Math.hypot(kx, ky);
    if (km > 0) { kx /= km; ky /= km; }
    // The strongest source wins, so a resting stick never cancels the keyboard.
    const cands: [number, number][] = [[kx, ky], [gx, gy], [this.touch.mx, this.touch.my]];
    const [mx, my] = cands.reduce((a, b) => (Math.hypot(b[0], b[1]) > Math.hypot(a[0], a[1]) ? b : a));
    return {
      ...idlePad(), mx, my, sprint: this.isHeld("sprint"), shootHeld: this.isHeld("shot"),
      ...this.c, power: this.power,
    };
  }
}

/** Short French reminders shown under the pitch. */
export const CONTROL_HELP = {
  keyboard: [
    ["Se déplacer", "ZQSD / WASD ou flèches"],
    ["Passe", "J ou X"],
    ["Passe en profondeur", "I ou V"],
    ["Centre", "L ou B"],
    ["Tir (maintenir = puissance)", "K, C ou Espace"],
    ["Récupérer le ballon", "passe sur le porteur, ou tir maintenu tout près"],
    ["Sprint", "Maj"],
    ["Changer de joueur", "E ou N"],
  ],
  gamepad: [
    ["Se déplacer", "stick gauche ou croix"],
    ["Passe", "A / Croix"],
    ["Passe en profondeur", "Y / Triangle"],
    ["Centre", "X / Carré"],
    ["Tir (maintenir = puissance)", "B / Rond"],
    ["Récupérer le ballon", "passe sur le porteur, ou tir maintenu tout près"],
    ["Sprint", "RB / R1 ou RT / R2"],
    ["Changer de joueur", "LB / L1"],
  ],
} as const;
