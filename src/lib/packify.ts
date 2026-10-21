// Turns any picture into a real-looking foil pack (crimped top and bottom, glossy curved body, tinted edges,
// GOALMASTER wordmark) so a custom pack image sits with the base Classique / Premium artwork. Browser only.

export const PACK_W = 768;
export const PACK_H = 1152;
const CRIMP = 74; // height of the sealed foil strips
const TEETH = 30; // zigzag teeth across the width

/** Pack outline: zigzag sealed edges and slightly pinched sides, like a crisp foil pack. */
function packPath(ctx: CanvasRenderingContext2D) {
  const L = 34, R = PACK_W - 34, top = 14, bot = PACK_H - 14, tooth = (R - L) / TEETH;
  ctx.beginPath();
  ctx.moveTo(L, top + 10);
  for (let i = 0; i < TEETH; i++) {
    ctx.lineTo(L + tooth * (i + 0.5), top);
    ctx.lineTo(L + tooth * (i + 1), top + 10);
  }
  ctx.lineTo(R, top + CRIMP);
  ctx.bezierCurveTo(R + 10, PACK_H * 0.35, R + 10, PACK_H * 0.65, R, bot - CRIMP);
  ctx.lineTo(R, bot - 10);
  for (let i = TEETH; i > 0; i--) {
    ctx.lineTo(L + tooth * (i - 0.5), bot);
    ctx.lineTo(L + tooth * (i - 1), bot - 10);
  }
  ctx.lineTo(L, bot - CRIMP);
  ctx.bezierCurveTo(L - 10, PACK_H * 0.65, L - 10, PACK_H * 0.35, L, top + CRIMP);
  ctx.closePath();
}

function crimp(ctx: CanvasRenderingContext2D, y: number, h: number, tint: string) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "#f4f4f6"); g.addColorStop(0.35, "#9a9aa4"); g.addColorStop(0.55, "#ffffff"); g.addColorStop(1, "#6c6c78");
  ctx.fillStyle = g;
  ctx.fillRect(0, y, PACK_W, h);
  ctx.globalAlpha = 0.35; ctx.fillStyle = tint; ctx.fillRect(0, y, PACK_W, h); ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.22)"; ctx.lineWidth = 2;
  for (let yy = y + 6; yy < y + h; yy += 7) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(PACK_W, yy); ctx.stroke(); }
}

/** Draws `img` as a foil pack and returns the canvas (transparent around the pack). */
export async function packifyImage(img: CanvasImageSource & { width: number; height: number }, tint = "#ff3d9a"): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  c.width = PACK_W; c.height = PACK_H;
  const ctx = c.getContext("2d")!;
  try { await document.fonts?.load('120px "Bebas Neue"'); } catch { /* fallback font */ }

  ctx.save();
  packPath(ctx);
  ctx.clip();
  ctx.fillStyle = "#0b0b10"; ctx.fillRect(0, 0, PACK_W, PACK_H);

  // Picture: cover the body between the two crimps, centred.
  const bodyY = CRIMP, bodyH = PACK_H - CRIMP * 2;
  const k = Math.max(PACK_W / img.width, bodyH / img.height);
  const w = img.width * k, h = img.height * k;
  ctx.drawImage(img, (PACK_W - w) / 2, bodyY + (bodyH - h) / 2, w, h);

  // Harmonise: tint wash, darker top/bottom for the logo and crimps, curved foil shading on the sides.
  ctx.globalCompositeOperation = "soft-light"; ctx.globalAlpha = 0.45; ctx.fillStyle = tint; ctx.fillRect(0, 0, PACK_W, PACK_H);
  ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  const v = ctx.createLinearGradient(0, 0, 0, PACK_H);
  v.addColorStop(0, "rgba(0,0,0,0.75)"); v.addColorStop(0.24, "rgba(0,0,0,0.05)"); v.addColorStop(0.72, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.7)");
  ctx.fillStyle = v; ctx.fillRect(0, 0, PACK_W, PACK_H);
  const s = ctx.createLinearGradient(0, 0, PACK_W, 0);
  s.addColorStop(0, "rgba(0,0,0,0.65)"); s.addColorStop(0.1, "rgba(255,255,255,0.18)"); s.addColorStop(0.2, "rgba(0,0,0,0)");
  s.addColorStop(0.8, "rgba(0,0,0,0)"); s.addColorStop(0.9, "rgba(255,255,255,0.14)"); s.addColorStop(1, "rgba(0,0,0,0.65)");
  ctx.fillStyle = s; ctx.fillRect(0, 0, PACK_W, PACK_H);
  // Diagonal gloss streak.
  const gl = ctx.createLinearGradient(0, PACK_H * 0.15, PACK_W, PACK_H * 0.55);
  gl.addColorStop(0.35, "rgba(255,255,255,0)"); gl.addColorStop(0.47, "rgba(255,255,255,0.22)"); gl.addColorStop(0.53, "rgba(255,255,255,0.05)"); gl.addColorStop(0.62, "rgba(255,255,255,0)");
  ctx.fillStyle = gl; ctx.fillRect(0, 0, PACK_W, PACK_H);

  crimp(ctx, 0, CRIMP + 6, tint);
  crimp(ctx, PACK_H - CRIMP - 6, CRIMP + 6, tint);

  // Wordmark.
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = '132px "Bebas Neue", Impact, sans-serif';
  ctx.lineJoin = "round";
  ctx.shadowColor = tint; ctx.shadowBlur = 28;
  ctx.lineWidth = 12; ctx.strokeStyle = "#0b0b10"; ctx.strokeText("GOALMASTER", PACK_W / 2, 196);
  ctx.shadowBlur = 0;
  ctx.fillStyle = tint; ctx.fillText("GOALMASTER", PACK_W / 2, 196);
  ctx.lineWidth = 2.5; ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.strokeText("GOALMASTER", PACK_W / 2, 196);
  ctx.restore();

  // Tinted rim light around the outline.
  ctx.save();
  packPath(ctx);
  ctx.shadowColor = tint; ctx.shadowBlur = 10;
  ctx.lineWidth = 4; ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.stroke();
  ctx.restore();
  return c;
}

/** Loads a picture from a File or a URL (same-origin or CORS-enabled) for packifyImage. */
export async function loadPicture(src: File | string): Promise<ImageBitmap> {
  if (typeof src !== "string") return createImageBitmap(src);
  const res = await fetch(src, { mode: "cors" });
  if (!res.ok) throw new Error("Image introuvable");
  return createImageBitmap(await res.blob());
}
