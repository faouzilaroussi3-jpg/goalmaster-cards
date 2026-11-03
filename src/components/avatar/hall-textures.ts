import * as THREE from "three";

/** Canvas-painted surfaces of the gala hall (no image downloads). Call only in the browser. */

type Painter = (g: CanvasRenderingContext2D, w: number, h: number) => void;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function make(w: number, h: number, paint: Painter, opts: { repeat?: boolean; color?: boolean; redrawOnFonts?: boolean } = {}) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  paint(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (opts.color !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  // Titles use the site fonts: repaint once they are loaded.
  if (opts.redrawOnFonts && typeof document !== "undefined" && document.fonts) {
    Promise.all([document.fonts.load('120px "Bebas Neue"'), document.fonts.load('600 40px "Barlow"')])
      .then(() => { g.clearRect(0, 0, w, h); paint(g, w, h); t.needsUpdate = true; })
      .catch(() => {});
  }
  return t;
}

const goldGradient = (g: CanvasRenderingContext2D, y0: number, y1: number) => {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, "#fff4c8"); gr.addColorStop(0.45, "#f0c050"); gr.addColorStop(0.55, "#b9821e"); gr.addColorStop(1, "#ffe08a");
  return gr;
};

/** Black marble tiles with pale veins, gold joints and small diamond inlays at the corners. 2 x 2 tiles. */
export function marbleTexture() {
  return make(1024, 1024, (g, w) => {
    const r = rng(7);
    const T = w / 2;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? "#0f0c12" : "#141017";
      g.fillRect(i * T, j * T, T, T);
      g.save();
      g.beginPath(); g.rect(i * T, j * T, T, T); g.clip();
      for (let v = 0; v < 9; v++) {
        g.strokeStyle = `rgba(${200 + r() * 40},${190 + r() * 30},${215},${0.04 + r() * 0.1})`;
        g.lineWidth = 0.6 + r() * 2.4;
        g.beginPath();
        let x = i * T + r() * T, y = j * T + r() * T;
        g.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
          const nx = x + (r() - 0.3) * T * 0.5, ny = y + (r() - 0.5) * T * 0.4;
          g.quadraticCurveTo(x + (r() - 0.5) * 120, y + (r() - 0.5) * 120, nx, ny);
          x = nx; y = ny;
        }
        g.stroke();
      }
      g.restore();
    }
    g.strokeStyle = "#9a7428"; g.lineWidth = 5;
    for (let k = 0; k <= 2; k++) {
      g.beginPath(); g.moveTo(k * T, 0); g.lineTo(k * T, w); g.stroke();
      g.beginPath(); g.moveTo(0, k * T); g.lineTo(w, k * T); g.stroke();
    }
    g.fillStyle = "#d9a441";
    for (let i = 0; i <= 2; i++) for (let j = 0; j <= 2; j++) {
      g.save(); g.translate(i * T, j * T); g.rotate(Math.PI / 4); g.fillRect(-16, -16, 32, 32);
      g.fillStyle = "#1a0f14"; g.fillRect(-8, -8, 16, 16); g.fillStyle = "#d9a441"; g.restore();
    }
  }, { repeat: true });
}

/** Velvet carpet with gold edging and a repeated diamond motif (one motif every quarter of the texture). */
export function carpetTexture() {
  return make(256, 1024, (g, w, h) => {
    const r = rng(11);
    g.fillStyle = "#8a0c45"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) {
      g.fillStyle = r() > 0.5 ? `rgba(255,120,180,${r() * 0.06})` : `rgba(30,0,12,${r() * 0.12})`;
      g.fillRect(r() * w, r() * h, 2, 2);
    }
    g.fillStyle = "#e3b04b";
    g.fillRect(10, 0, 8, h); g.fillRect(w - 18, 0, 8, h);
    g.fillRect(26, 0, 2, h); g.fillRect(w - 28, 0, 2, h);
    g.strokeStyle = "rgba(255,170,205,0.35)"; g.lineWidth = 3;
    for (let k = 0; k < 4; k++) {
      const cy = k * 256 + 128;
      g.beginPath(); g.moveTo(w / 2, cy - 70); g.lineTo(w / 2 + 50, cy); g.lineTo(w / 2, cy + 70); g.lineTo(w / 2 - 50, cy); g.closePath(); g.stroke();
      g.fillStyle = "rgba(227,176,75,0.55)";
      g.beginPath(); g.arc(w / 2, cy, 8, 0, Math.PI * 2); g.fill();
    }
  }, { repeat: true });
}

/** Stage front: dark lacquer with art-deco gold fans and the title in the middle. */
export function fasciaTexture() {
  return make(2048, 128, (g, w, h) => {
    g.fillStyle = "#0b090d"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#c99a3c"; g.fillRect(0, 6, w, 4); g.fillRect(0, h - 10, w, 4);
    g.strokeStyle = "rgba(217,164,65,0.75)"; g.lineWidth = 2;
    for (let x = 80; x < w; x += 160) {
      if (Math.abs(x - w / 2) < 380) continue;
      for (let k = 0; k <= 8; k++) {
        const a = Math.PI + (k / 8) * Math.PI;
        g.beginPath(); g.moveTo(x, h - 14); g.lineTo(x + Math.cos(a) * 62, h - 14 + Math.sin(a) * 62); g.stroke();
      }
      g.beginPath(); g.arc(x, h - 14, 62, Math.PI, 0); g.stroke();
      g.beginPath(); g.arc(x, h - 14, 30, Math.PI, 0); g.stroke();
    }
    g.font = '86px "Bebas Neue", Impact, sans-serif';
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = goldGradient(g, 24, 104);
    g.fillText("BALLON D'OR  ·  GOALMASTER", w / 2, h / 2 + 4);
  }, { redrawOnFonts: true });
}

/** Giant LED wall: golden ball with laurels on a ray burst, title above. Laid out for an 8.4 x 4.7 m screen. */
export function screenTexture() {
  return make(2048, 1146, (g, w, h) => {
    const cx = w / 2, cy = 536;
    const bg = g.createRadialGradient(cx, cy, 40, cx, cy, w * 0.62);
    bg.addColorStop(0, "#4a2406"); bg.addColorStop(0.35, "#1c0710"); bg.addColorStop(1, "#050307");
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 56; k++) {
      const a = (k / 56) * Math.PI * 2;
      g.fillStyle = k % 2 ? "rgba(255,60,150,0.05)" : "rgba(255,200,90,0.07)";
      g.beginPath(); g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a - 0.025) * w, cy + Math.sin(a - 0.025) * w);
      g.lineTo(cx + Math.cos(a + 0.025) * w, cy + Math.sin(a + 0.025) * w);
      g.closePath(); g.fill();
    }
    const r = rng(3);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(255,${200 + r() * 55},${180 + r() * 60},${r() * 0.7})`;
      const s = r() * 3 + 0.5;
      g.fillRect(r() * w, r() * h, s, s);
    }
    // Laurels hugging the ring
    for (const side of [-1, 1]) {
      for (let k = 0; k < 13; k++) {
        const a = Math.PI / 2 + side * (0.35 + k * 0.17);
        const R = 300;
        const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
        g.save(); g.translate(x, y); g.rotate(a + side * 0.9);
        g.fillStyle = goldGradient(g, -20, 20);
        g.beginPath(); g.ellipse(0, 0, 34 - k, 12, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      }
    }
    // Golden ball
    const R = 220;
    const ball = g.createRadialGradient(cx - 70, cy - 80, 10, cx, cy, R);
    ball.addColorStop(0, "#fffbe4"); ball.addColorStop(0.3, "#f6cf62"); ball.addColorStop(0.75, "#a46c12"); ball.addColorStop(1, "#4a2c04");
    g.fillStyle = ball; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
    g.strokeStyle = "rgba(80,45,4,0.55)"; g.lineWidth = 5;
    const s = 64;
    for (let row = -5; row <= 5; row++) for (let col = -5; col <= 5; col++) {
      const hx = cx + col * s * 1.5, hy = cy + row * s * Math.sqrt(3) + (col % 2 ? (s * Math.sqrt(3)) / 2 : 0);
      g.beginPath();
      for (let q = 0; q < 6; q++) { const a = (q / 6) * Math.PI * 2; g[q ? "lineTo" : "moveTo"](hx + Math.cos(a) * s, hy + Math.sin(a) * s); }
      g.closePath(); g.stroke();
    }
    const shade = g.createRadialGradient(cx, cy, R * 0.6, cx, cy, R);
    shade.addColorStop(0, "rgba(0,0,0,0)"); shade.addColorStop(1, "rgba(40,20,0,0.55)");
    g.fillStyle = shade; g.fillRect(cx - R, cy - R, R * 2, R * 2);
    g.fillStyle = "rgba(255,255,255,0.45)"; g.beginPath(); g.ellipse(cx - 80, cy - 95, 70, 38, -0.6, 0, Math.PI * 2); g.fill();
    g.restore();
    // Title
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = '150px "Bebas Neue", Impact, sans-serif';
    g.shadowColor = "rgba(255,190,80,0.6)"; g.shadowBlur = 30;
    g.fillStyle = goldGradient(g, 50, 180);
    g.fillText("BALLON D'OR", cx, 112);
    g.shadowBlur = 0;
    g.font = '600 46px "Barlow", sans-serif';
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.fillText("G O A L M A S T E R   ·   C É R É M O N I E", cx, 1040);
  }, { redrawOnFonts: true });
}

/** Diagonal light sweep band (moved across the screen with texture offset). */
export function sheenTexture() {
  return make(512, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.save(); g.translate(w / 2, h / 2); g.transform(1, 0, -0.35, 1, 0, 0);
    const gr = g.createLinearGradient(-60, 0, 60, 0);
    gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,240,215,0.5)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(-60, -h, 120, h * 2);
    g.restore();
  }, { repeat: true });
}

/** Stage floor: glossy black with a gold star burst centred on the winner's spot (u 0.5, v 0.139). */
export function stageFloorTexture() {
  return make(2048, 738, (g, w, h) => {
    g.fillStyle = "#08070b"; g.fillRect(0, 0, w, h);
    const px = w / 10;
    g.strokeStyle = "rgba(255,45,135,0.07)"; g.lineWidth = 2;
    for (let x = 0; x <= w; x += px) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = h; y >= 0; y -= px) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    const cx = w / 2, cy = h * (1 - 0.139);
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * Math.PI * 2;
      const L = k % 2 ? px * 1.6 : px * 2.6;
      g.strokeStyle = k % 2 ? "rgba(217,164,65,0.35)" : "rgba(240,192,80,0.6)";
      g.lineWidth = k % 2 ? 2 : 4;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * px * 0.95, cy + Math.sin(a) * px * 0.95); g.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L); g.stroke();
    }
    g.strokeStyle = "#d9a441";
    for (const [rad, lw] of [[0.6, 3], [0.92, 6], [1.15, 2]] as const) { g.lineWidth = lw; g.beginPath(); g.arc(cx, cy, px * rad, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = "rgba(240,192,80,0.9)";
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.save(); g.translate(cx + Math.cos(a) * px * 0.76, cy + Math.sin(a) * px * 0.76); g.rotate(a);
      g.beginPath(); g.moveTo(-10, 0); g.lineTo(0, -18); g.lineTo(10, 0); g.lineTo(0, 18); g.closePath(); g.fill(); g.restore();
    }
  });
}

/** Dark damask wall paper with a pink lattice and gold medallions. One tile = 3 m. */
export function damaskTexture() {
  return make(512, 512, (g, w) => {
    g.fillStyle = "#160b13"; g.fillRect(0, 0, w, w);
    g.strokeStyle = "rgba(255,45,135,0.08)"; g.lineWidth = 3;
    for (let k = -2; k <= 2; k++) {
      g.beginPath(); g.moveTo(k * w / 2, 0); g.lineTo(k * w / 2 + w, w); g.stroke();
      g.beginPath(); g.moveTo(k * w / 2 + w, 0); g.lineTo(k * w / 2, w); g.stroke();
    }
    const medal = (x: number, y: number) => {
      g.fillStyle = "rgba(217,164,65,0.12)";
      for (let q = 0; q < 4; q++) {
        g.save(); g.translate(x, y); g.rotate((q * Math.PI) / 2);
        g.beginPath(); g.ellipse(0, -28, 12, 30, 0, 0, Math.PI * 2); g.fill(); g.restore();
      }
      g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill();
    };
    medal(w / 2, w / 2); medal(0, 0); medal(w, 0); medal(0, w); medal(w, w);
  }, { repeat: true });
}

/** Coffered ceiling: one recessed panel with gold edge per tile (2.4 m). */
export function cofferTexture() {
  return make(256, 256, (g, w) => {
    g.fillStyle = "#0b080c"; g.fillRect(0, 0, w, w);
    const gr = g.createLinearGradient(0, 0, w, w);
    gr.addColorStop(0, "#1c1218"); gr.addColorStop(1, "#0d090c");
    g.fillStyle = gr; g.fillRect(24, 24, w - 48, w - 48);
    g.strokeStyle = "#8a6526"; g.lineWidth = 4; g.strokeRect(24, 24, w - 48, w - 48);
    g.strokeStyle = "rgba(217,164,65,0.35)"; g.lineWidth = 2; g.strokeRect(44, 44, w - 88, w - 88);
    g.fillStyle = "rgba(217,164,65,0.4)"; g.beginPath(); g.arc(w / 2, w / 2, 10, 0, Math.PI * 2); g.fill();
  }, { repeat: true });
}

/** Soft round glow for light bulbs, light pools and wall washes. */
export function glowTexture() {
  return make(128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.2, "rgba(255,255,255,0.6)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
}

/** Wall wash: a fan of light rising from a sconce. */
export function washTexture() {
  return make(128, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h, 0, w / 2, h, h);
    gr.addColorStop(0, "rgba(255,226,168,0.9)"); gr.addColorStop(0.5, "rgba(255,190,120,0.25)"); gr.addColorStop(1, "rgba(255,190,120,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}
