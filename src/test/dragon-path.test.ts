import { describe, expect, it } from "vitest";
import { bodyRadius, headDistance, makeCrawl, perimeter, pointAt, smoothPointAt, type Rect } from "@/lib/dragon-path";

const rect: Rect = { x: 10, y: 20, w: 100, h: 140, r: 10 };

describe("SU dragon path round the card", () => {
  it("follows the card border all the way round and wraps back to the start", () => {
    const P = perimeter(rect);
    for (let s = 0; s < P; s += P / 200) {
      const p = pointAt(rect, s);
      const inX = p.x >= rect.x - 1e-9 && p.x <= rect.x + rect.w + 1e-9;
      const inY = p.y >= rect.y - 1e-9 && p.y <= rect.y + rect.h + 1e-9;
      expect(inX && inY).toBe(true);
      expect(Math.hypot(p.tx, p.ty)).toBeCloseTo(1, 9);
    }
    const a = pointAt(rect, 3), b = pointAt(rect, 3 + P);
    expect(b.x).toBeCloseTo(a.x, 9);
    expect(b.y).toBeCloseTo(a.y, 9);
  });

  it("crawls clockwise with the card on its right (inward normal points to the card centre)", () => {
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    const P = perimeter(rect);
    for (let s = 0; s < P; s += P / 50) {
      const p = pointAt(rect, s);
      const nx = -p.ty, ny = p.tx;
      expect(nx * (cx - p.x) + ny * (cy - p.y)).toBeGreaterThan(0);
    }
  });

  it("is thickest just behind the neck and tapers to a thin tail", () => {
    expect(bodyRadius(0)).toBe(1);
    expect(bodyRadius(0.12)).toBeGreaterThan(1);
    expect(bodyRadius(0.5)).toBeLessThan(bodyRadius(0.12));
    expect(bodyRadius(1)).toBe(0);
  });

  it("two cards start at different points and crawl at different speeds", () => {
    let i = 0;
    const seq = [0.1, 0.2, 0.3, 0.7, 0.9, 0.4];
    const a = makeCrawl(() => seq[i++]!);
    const b = makeCrawl(() => seq[i++]!);
    const P = perimeter(rect);
    expect(Math.abs(headDistance(a, P, 5) - headDistance(b, P, 5))).toBeGreaterThan(10);
    expect(a.lap).not.toBe(b.lap);
  });

  it("turns round the corners smoothly: the heading never jumps between two nearby points", () => {
    const P = perimeter(rect);
    const step = P / 400;
    const turn = (f: (d: number) => { tx: number; ty: number }) => {
      let worst = 0;
      for (let d = 0; d < P; d += step) {
        const a = f(d), b = f(d + step);
        worst = Math.max(worst, Math.abs(Math.atan2(a.tx * b.ty - a.ty * b.tx, a.tx * b.tx + a.ty * b.ty)));
      }
      return worst;
    };
    const raw = turn((d) => pointAt(rect, d));
    const smooth = turn((d) => smoothPointAt(rect, d, 12));
    expect(smooth).toBeLessThan(raw * 0.6);
    for (let d = 0; d < P; d += P / 60) expect(Math.hypot(smoothPointAt(rect, d, 12).tx, smoothPointAt(rect, d, 12).ty)).toBeCloseTo(1, 9);
  });
});
