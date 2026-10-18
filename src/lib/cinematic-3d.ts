export const cinematicSeconds = (tier: number) => tier >= 5 ? 7.5 : tier >= 3 ? 6 : 4.5;

export function cinematicProgress(seconds: number, tier: number) {
  return Math.min(1, Math.max(0, seconds / cinematicSeconds(tier)));
}

export function ballPosition(progress: number, tier: number): [number, number, number] {
  if (progress < .4) {
    const p = progress / .4;
    return [tier >= 5 ? 1.3 - p : -.2 + p * .9, tier >= 4 ? 2.6 - p * .6 : .24 + Math.abs(Math.sin(p * Math.PI * 3)) * .2, .7];
  }
  const p = Math.min(1, (progress - .4) / .3);
  return [.3 + p * 1.1, (tier >= 4 ? 2 : .3) + Math.sin(p * Math.PI) * 1.4 - p * .3, .7 - p * 9];
}

// Resolve CSS semantic tokens to sRGB for WebGL; Three does not parse oklch.
export function cinematicPalette(tier: number) {
  const names = ["--r-common", "--r-uncommon", "--r-rare", "--r-sr", "--r-legendary", "--r-sl", "--r-su"];
  const css = getComputedStyle(document.documentElement);
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d");
  const read = (token: string) => {
    if (!ctx) return "rgb(128,128,128)";
    ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = css.getPropertyValue(token).trim(); ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `rgb(${r},${g},${b})`;
  };
  return { accent: read(names[tier - 1] ?? "--primary"), dark: read("--card-night"), player: read("--cinema-silhouette"), white: read("--card-light"), grass: read("--cinema-turf"), grassLight: read("--cinema-turf-light"), gold: read("--primary"), electric: read("--electric") };
}
export type CinemaPalette = ReturnType<typeof cinematicPalette>;