// Geometry for the 2D Secret Ultimate dragon that crawls round the card's border. Pure math (no DOM) so it is testable.
// Coordinates are y-down (canvas). The dragon travels clockwise, so the card is always on its right:
// the inward normal of a tangent (tx, ty) is (-ty, tx).

export type Rect = { x: number; y: number; w: number; h: number; r: number };
export type PathPoint = { x: number; y: number; tx: number; ty: number };

export function perimeter({ w, h, r }: Rect): number {
  return 2 * (w - 2 * r) + 2 * (h - 2 * r) + 2 * Math.PI * r;
}

/** Point and unit tangent at arc length s along the rounded rectangle, starting at the top-left end of the top edge. */
export function pointAt(rect: Rect, s: number): PathPoint {
  const { x, y, w, h, r } = rect;
  const P = perimeter(rect);
  let d = ((s % P) + P) % P;
  const sw = w - 2 * r, sh = h - 2 * r, arc = (Math.PI * r) / 2;
  const corner = (cx: number, cy: number, a0: number, t: number): PathPoint => {
    const a = a0 + (t / arc) * (Math.PI / 2);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), tx: -Math.sin(a), ty: Math.cos(a) };
  };
  if (d < sw) return { x: x + r + d, y, tx: 1, ty: 0 };
  d -= sw;
  if (d < arc) return corner(x + w - r, y + r, -Math.PI / 2, d);
  d -= arc;
  if (d < sh) return { x: x + w, y: y + r + d, tx: 0, ty: 1 };
  d -= sh;
  if (d < arc) return corner(x + w - r, y + h - r, 0, d);
  d -= arc;
  if (d < sw) return { x: x + w - r - d, y: y + h, tx: -1, ty: 0 };
  d -= sw;
  if (d < arc) return corner(x + r, y + h - r, Math.PI / 2, d);
  d -= arc;
  if (d < sh) return { x, y: y + h - r - d, tx: 0, ty: -1 };
  d -= sh;
  return corner(x + r, y + r, Math.PI, Math.min(d, arc));
}

/** Body radius along the dragon, u = 0 at the neck and 1 at the tail tip, as a multiple of the neck radius. */
export function bodyRadius(u: number): number {
  const k = Math.min(1, Math.max(0, u));
  if (k < 0.12) return 1 + 0.15 * (k / 0.12);
  return 1.15 * Math.pow(1 - k, 0.75) + 0.08 * (1 - k);
}

export type Crawl = { phase: number; lap: number; wiggle: number };

/** Each card draws its own start point and lap time, so SU cards side by side never crawl in step. */
export function makeCrawl(rand: () => number = Math.random): Crawl {
  return { phase: rand(), lap: 13 + rand() * 6, wiggle: rand() * Math.PI * 2 };
}

/** Arc length of the dragon's head at time t (seconds). */
export function headDistance(c: Crawl, P: number, t: number): number {
  return ((c.phase + t / c.lap) % 1) * P;
}

/**
 * Point and unit tangent of the border path box-blurred over ±win: the position is the mean of `samples` points and
 * the tangent is the chord from s-win to s+win, so the dragon turns round the corners in a long smooth curve
 * instead of snapping its heading where the straight edges meet the corner arcs.
 */
export function smoothPointAt(rect: Rect, s: number, win: number, samples = 7): PathPoint {
  if (win <= 0) return pointAt(rect, s);
  let x = 0, y = 0;
  for (let i = 0; i < samples; i++) {
    const p = pointAt(rect, s - win + (2 * win * i) / (samples - 1));
    x += p.x; y += p.y;
  }
  const a = pointAt(rect, s - win), b = pointAt(rect, s + win);
  let tx = b.x - a.x, ty = b.y - a.y;
  const n = Math.hypot(tx, ty) || 1;
  tx /= n; ty /= n;
  return { x: x / samples, y: y / samples, tx, ty };
}

/** Smooth 0→1 ease (zero slope at both ends) used for the head's rear-and-lunge motion. */
export function smoothstep(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}
