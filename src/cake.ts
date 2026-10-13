import { MAX_SLICES } from './config';
import { circle, TAU } from './draw';
import { FLAVORS, type FlavorStyle } from './flavors';

/** 위에서 비스듬히 내려다보는 시점: 원을 세로로 이만큼 눌러 그린다 */
export const TILT = 0.64;
export const PLATE_R = 47;
const CAKE_R = 39;
const CAKE_H = 27;
const STEP = TAU / MAX_SLICES;

type Ctx = CanvasRenderingContext2D;

/** 빈 자리가 화면 앞쪽을 향하도록 회전 (잘린 단면이 보여서 입체감이 산다) */
export function targetRot(n: number) {
  return Math.PI / 2 + ((MAX_SLICES - n) * Math.PI) / MAX_SLICES;
}

function angleDiff(a: number, b: number) {
  return ((((a - b + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
}

/** 결정적 의사난수 (같은 케이크는 매번 같은 모양) */
function hash(x: number) {
  const s = Math.sin(x * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// ───────────────────────── 스프라이트 캐시 ─────────────────────────
// 케이크는 그릴 게 많아서 조합(맛 배열)별로 한 번만 그려 두고 이미지로 찍는다.

interface Box { l: number; r: number; u: number; d: number; }
const CAKE_BOX: Box = { l: CAKE_R + 16, r: CAKE_R + 16, u: CAKE_R * TILT + CAKE_H + 42, d: CAKE_R * TILT + 14 };
const PLATE_BOX: Box = { l: PLATE_R + 3, r: PLATE_R + 3, u: PLATE_R * TILT + 3, d: PLATE_R * TILT + 8 };

const cache = new Map<string, HTMLCanvasElement>();
let ppu = 2;

/** 논리 단위 1당 실제 픽셀 수. 바뀌면 캐시를 버린다. */
export function setCakeResolution(pxPerUnit: number) {
  if (Math.abs(pxPerUnit - ppu) < 1e-3) return;
  ppu = pxPerUnit;
  cache.clear();
}

function sprite(key: string, box: Box, paint: (g: Ctx) => void): HTMLCanvasElement {
  let c = cache.get(key);
  if (c) {
    cache.delete(key);
    cache.set(key, c);
    return c;
  }
  c = document.createElement('canvas');
  c.width = Math.ceil((box.l + box.r) * ppu);
  c.height = Math.ceil((box.u + box.d) * ppu);
  const g = c.getContext('2d')!;
  g.setTransform(ppu, 0, 0, ppu, box.l * ppu, box.u * ppu);
  paint(g);
  cache.set(key, c);
  if (cache.size > 90) cache.delete(cache.keys().next().value!);
  return c;
}

function stamp(ctx: Ctx, c: HTMLCanvasElement, box: Box, x: number, y: number, s: number) {
  ctx.drawImage(c, x - box.l * s, y - box.u * s, (box.l + box.r) * s, (box.u + box.d) * s);
}

// ───────────────────────── 접시 ─────────────────────────

function paintPlate(g: Ctx) {
  const R = PLATE_R;
  const ry = R * TILT;
  g.fillStyle = '#cdd4de';
  g.beginPath();
  g.ellipse(0, 4, R, ry, 0, 0, TAU);
  g.fill();
  const grad = g.createRadialGradient(-R * 0.3, -ry * 0.4, 2, 0, 0, R);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#eaeef4');
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(0, 0, R, ry, 0, 0, TAU);
  g.fill();
  // 레이스 페이퍼 (도일리)
  const dr = R * 0.86;
  g.beginPath();
  for (let k = 0; k <= 40; k++) {
    const a = (k / 40) * TAU;
    const rr = dr + (k % 2 ? 0 : R * 0.04);
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr * TILT + 1;
    if (k === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fillStyle = '#fffdf9';
  g.fill();
  g.strokeStyle = '#eadbd0';
  g.lineWidth = 0.8;
  g.stroke();
  g.fillStyle = '#f0e4da';
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * TAU;
    g.beginPath();
    g.ellipse(Math.cos(a) * R * 0.76, Math.sin(a) * R * 0.76 * TILT + 1, 1.6, 1.1, 0, 0, TAU);
    g.fill();
  }
  // 반짝임
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 1.6;
  g.beginPath();
  g.ellipse(0, 0, R * 0.95, ry * 0.95, 0, Math.PI * 1.08, Math.PI * 1.5);
  g.stroke();
}

export function drawPlate(ctx: Ctx, x: number, y: number, s: number, lift = 0) {
  const R = PLATE_R * s;
  ctx.fillStyle = `rgba(90,45,30,${0.2 - lift * 0.07})`;
  ctx.beginPath();
  ctx.ellipse(x + lift * 6 * s, y + 7 * s + lift * 26 * s, R * (1 - lift * 0.06), R * TILT * (1 - lift * 0.06), 0, 0, TAU);
  ctx.fill();
  stamp(ctx, sprite('plate', PLATE_BOX, paintPlate), PLATE_BOX, x, y, s);
}

// ───────────────────────── 토핑 ─────────────────────────

function softShadow(g: Ctx, x: number, y: number, rx: number, ry: number, a = 0.18) {
  g.fillStyle = `rgba(70,30,20,${a})`;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, TAU);
  g.fill();
}

function rosette(g: Ctx, x: number, y: number, rad: number, [c, shade]: [string, string]) {
  softShadow(g, x, y + rad * 0.55, rad, rad * 0.42, 0.16);
  g.fillStyle = shade;
  circle(g, x, y + rad * 0.12, rad);
  g.fill();
  g.fillStyle = c;
  circle(g, x, y, rad * 0.94);
  g.fill();
  g.strokeStyle = shade;
  g.lineCap = 'round';
  g.lineWidth = rad * 0.16;
  g.beginPath();
  g.arc(x, y - rad * 0.05, rad * 0.62, Math.PI * 0.12, Math.PI * 0.95);
  g.stroke();
  g.fillStyle = c;
  circle(g, x + rad * 0.06, y - rad * 0.42, rad * 0.66);
  g.fill();
  g.beginPath();
  g.arc(x + rad * 0.06, y - rad * 0.42, rad * 0.4, Math.PI * 0.2, Math.PI * 1.0);
  g.stroke();
  g.fillStyle = c;
  circle(g, x + rad * 0.12, y - rad * 0.78, rad * 0.34);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.75)';
  circle(g, x - rad * 0.3, y - rad * 0.5, rad * 0.17);
  g.fill();
}

function mintLeaf(g: Ctx, x: number, y: number, w: number, rot: number) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = '#4fb34c';
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(w * 0.5, -w * 0.45, w, 0);
  g.quadraticCurveTo(w * 0.5, w * 0.45, 0, 0);
  g.fill();
  g.strokeStyle = '#2f7f33';
  g.lineWidth = w * 0.06;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(w * 0.85, 0);
  g.stroke();
  g.restore();
}

function strawberry(g: Ctx, x: number, y: number, w: number) {
  softShadow(g, x, y + w * 0.15, w * 0.7, w * 0.28);
  const by = y - w * 0.55;
  g.beginPath();
  g.moveTo(x, by + w * 0.95);
  g.bezierCurveTo(x - w * 0.95, by + w * 0.45, x - w * 0.85, by - w * 0.55, x, by - w * 0.48);
  g.bezierCurveTo(x + w * 0.85, by - w * 0.55, x + w * 0.95, by + w * 0.45, x, by + w * 0.95);
  const grad = g.createRadialGradient(x - w * 0.3, by - w * 0.15, 0, x, by, w * 1.15);
  grad.addColorStop(0, '#ff7482');
  grad.addColorStop(0.55, '#e3193a');
  grad.addColorStop(1, '#a50c24');
  g.fillStyle = grad;
  g.fill();
  g.fillStyle = '#ffe7a3';
  for (const [dx, dy] of [[-0.4, -0.05], [0, -0.15], [0.38, -0.02], [-0.22, 0.3], [0.2, 0.28], [0, 0.58], [-0.5, 0.25], [0.5, 0.22]]) {
    g.beginPath();
    g.ellipse(x + dx * w, by + dy * w, w * 0.045, w * 0.07, 0, 0, TAU);
    g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath();
  g.ellipse(x - w * 0.36, by + w * 0.05, w * 0.12, w * 0.24, 0.35, 0, TAU);
  g.fill();
  g.fillStyle = '#3f9e3a';
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k - 2) * 0.55;
    g.beginPath();
    g.moveTo(x - w * 0.12, by - w * 0.42);
    g.lineTo(x + Math.cos(a) * w * 0.55, by - w * 0.42 + Math.sin(a) * w * 0.32 + w * 0.12);
    g.lineTo(x + w * 0.12, by - w * 0.42);
    g.fill();
  }
  g.fillStyle = '#2e7d2b';
  g.fillRect(x - w * 0.04, by - w * 0.75, w * 0.08, w * 0.3);
}

function fruitWheel(g: Ctx, x: number, y: number, rad: number, rim: string, flesh: string, seg: string, half: boolean) {
  softShadow(g, x, y + rad * 0.15, rad * 0.9, rad * 0.32);
  const cy = y - rad * 0.85;
  const a0 = half ? Math.PI : 0;
  const a1 = half ? TAU : TAU;
  const wheel = (rr: number, color: string) => {
    g.fillStyle = color;
    g.beginPath();
    if (half) {
      g.moveTo(x - rr, cy + rad * 0.5);
      g.ellipse(x, cy + rad * 0.5, rr, rr, 0, a0, a1);
    } else {
      g.ellipse(x, cy, rr * 0.86, rr, 0, a0, a1);
    }
    g.closePath();
    g.fill();
  };
  wheel(rad, rim);
  wheel(rad * 0.86, '#fffbea');
  wheel(rad * 0.76, flesh);
  g.strokeStyle = seg;
  g.lineWidth = rad * 0.09;
  g.beginPath();
  const ox = x;
  const oy = half ? cy + rad * 0.5 : cy;
  const count = half ? 4 : 8;
  for (let k = 0; k <= count; k++) {
    if (!half && k === count) break;
    const a = half ? Math.PI + (k / count) * Math.PI : (k / count) * TAU;
    g.moveTo(ox, oy);
    g.lineTo(ox + Math.cos(a) * rad * 0.76 * (half ? 1 : 0.86), oy + Math.sin(a) * rad * 0.76);
  }
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.55)';
  circle(g, x - rad * 0.32, (half ? cy + rad * 0.15 : cy - rad * 0.35), rad * 0.13);
  g.fill();
}

function blueberry(g: Ctx, x: number, y: number, rad: number) {
  softShadow(g, x, y + rad * 0.7, rad, rad * 0.4);
  const grad = g.createRadialGradient(x - rad * 0.35, y - rad * 0.4, 0, x, y, rad);
  grad.addColorStop(0, '#7f8ad8');
  grad.addColorStop(0.5, '#3b4499');
  grad.addColorStop(1, '#1e2462');
  g.fillStyle = grad;
  circle(g, x, y, rad);
  g.fill();
  g.strokeStyle = '#141846';
  g.lineWidth = rad * 0.16;
  g.beginPath();
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    g.moveTo(x, y - rad * 0.45);
    g.lineTo(x + Math.cos(a) * rad * 0.24, y - rad * 0.45 + Math.sin(a) * rad * 0.16);
  }
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.5)';
  circle(g, x - rad * 0.38, y - rad * 0.1, rad * 0.16);
  g.fill();
}

function cherry(g: Ctx, x: number, y: number, rad: number) {
  softShadow(g, x, y + rad * 0.8, rad * 1.1, rad * 0.4);
  const cy = y - rad * 0.2;
  g.strokeStyle = '#5b3a1c';
  g.lineWidth = rad * 0.18;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x + rad * 0.05, cy - rad * 0.7);
  g.quadraticCurveTo(x + rad * 0.2, cy - rad * 1.8, x + rad * 0.95, cy - rad * 2.1);
  g.stroke();
  const grad = g.createRadialGradient(x - rad * 0.35, cy - rad * 0.35, 0, x, cy, rad * 1.05);
  grad.addColorStop(0, '#ff6b74');
  grad.addColorStop(0.5, '#d8132c');
  grad.addColorStop(1, '#7d0716');
  g.fillStyle = grad;
  circle(g, x, cy, rad);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.beginPath();
  g.ellipse(x - rad * 0.38, cy - rad * 0.35, rad * 0.16, rad * 0.26, 0.6, 0, TAU);
  g.fill();
}

function chocoShaving(g: Ctx, x: number, y: number, w: number, rot: number) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = '#3a1a0a';
  g.beginPath();
  g.ellipse(0, 0, w, w * 0.32, 0, 0, TAU);
  g.fill();
  g.strokeStyle = '#8a5a3a';
  g.lineWidth = w * 0.14;
  g.beginPath();
  g.ellipse(0, -w * 0.05, w * 0.8, w * 0.18, 0, Math.PI * 1.1, Math.PI * 1.9);
  g.stroke();
  g.restore();
}

function redBean(g: Ctx, x: number, y: number, rad: number) {
  g.fillStyle = '#5e1f22';
  g.beginPath();
  g.ellipse(x, y, rad * 1.2, rad, 0.4, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,220,220,0.5)';
  circle(g, x - rad * 0.35, y - rad * 0.3, rad * 0.3);
  g.fill();
}

function topping(g: Ctx, st: FlavorStyle, P: (rho: number, th: number) => [number, number], r: number, m: number) {
  const [x, y] = P(r * 0.47, m);
  switch (st.topping) {
    case 'strawberry':
      strawberry(g, x, y, r * 0.24);
      break;
    case 'matcha': {
      const [bx, by] = P(r * 0.3, m + 0.35);
      redBean(g, bx, by - r * 0.02, r * 0.055);
      const [cx, cy] = P(r * 0.62, m - 0.32);
      redBean(g, cx, cy - r * 0.02, r * 0.055);
      rosette(g, x, y - r * 0.06, r * 0.17, st.cream);
      break;
    }
    case 'lemon':
      mintLeaf(g, x + r * 0.06, y - r * 0.04, r * 0.2, -0.5);
      fruitWheel(g, x - r * 0.04, y, r * 0.2, '#e8b400', '#ffe55c', '#fff6c4', false);
      break;
    case 'orange':
      fruitWheel(g, x, y, r * 0.22, '#e8660a', '#ffa236', '#ffe1bd', true);
      mintLeaf(g, x + r * 0.12, y - r * 0.02, r * 0.16, -0.2);
      break;
    case 'blueberry': {
      mintLeaf(g, x + r * 0.05, y - r * 0.12, r * 0.18, -0.9);
      const [ax, ay] = P(r * 0.4, m - 0.22);
      const [bx, by] = P(r * 0.58, m + 0.12);
      const [cx, cy] = P(r * 0.36, m + 0.3);
      blueberry(g, ax, ay - r * 0.08, r * 0.1);
      blueberry(g, cx, cy - r * 0.08, r * 0.095);
      blueberry(g, bx, by - r * 0.07, r * 0.105);
      break;
    }
    case 'cherry':
      chocoShaving(g, x - r * 0.12, y + r * 0.02, r * 0.1, 0.5);
      chocoShaving(g, x + r * 0.14, y + r * 0.04, r * 0.09, -0.4);
      cherry(g, x, y - r * 0.04, r * 0.1);
      break;
  }
}

// ───────────────────────── 조각 ─────────────────────────

/** 각도 [a0,a1] 중 화면 앞쪽(sin>0)을 향하는 구간들 */
function frontRanges(a0: number, a1: number): [number, number][] {
  const off = Math.floor(a0 / TAU) * TAU;
  const s = a0 - off;
  const e = a1 - off;
  const out: [number, number][] = [];
  for (const [fs, fe] of [[0, Math.PI], [TAU, TAU + Math.PI]]) {
    const lo = Math.max(s, fs);
    const hi = Math.min(e, fe);
    if (hi - lo > 1e-4) out.push([lo + off, hi + off]);
  }
  return out;
}

function wallPath(g: Ctx, cx: number, cy: number, r: number, z0: number, z1: number, s0: number, e0: number) {
  const ry = r * TILT;
  g.beginPath();
  g.ellipse(cx, cy - z0, r, ry, 0, s0, e0);
  g.ellipse(cx, cy - z1, r, ry, 0, e0, s0, true);
  g.closePath();
}

function radialQuad(g: Ctx, cx: number, cy: number, ex: number, ey: number, z0: number, z1: number, u0 = 0, u1 = 1) {
  const ax = cx + (ex - cx) * u0;
  const ay = cy + (ey - cy) * u0;
  const bx = cx + (ex - cx) * u1;
  const by = cy + (ey - cy) * u1;
  g.beginPath();
  g.moveTo(ax, ay - z0);
  g.lineTo(bx, by - z0);
  g.lineTo(bx, by - z1);
  g.lineTo(ax, ay - z1);
  g.closePath();
}

/** 조각이 빠진 쪽에서 보이는 단면: 스펀지 · 크림 · 잼 층 */
function cutFace(g: Ctx, cx: number, cy: number, r: number, h: number, a: number, st: FlavorStyle, seed: number) {
  const ex = cx + r * Math.cos(a);
  const ey = cy + r * TILT * Math.sin(a);
  const at = (u: number, z: number): [number, number] => [cx + (ex - cx) * u, cy + (ey - cy) * u - z];
  for (const L of st.layers) {
    radialQuad(g, cx, cy, ex, ey, L.z0 * h, L.z1 * h);
    g.fillStyle = L.color;
    g.fill();
    if (L.pores) {
      g.fillStyle = L.pores;
      for (let k = 0; k < 9; k++) {
        const u = 0.08 + 0.8 * hash(seed + k * 3.1);
        const z = (L.z0 + (L.z1 - L.z0) * (0.2 + 0.6 * hash(seed + k * 7.7))) * h;
        const [px, py] = at(u, z);
        g.beginPath();
        g.ellipse(px, py, r * 0.022, r * 0.016, 0, 0, TAU);
        g.fill();
      }
    }
    if (L.bits) {
      g.fillStyle = L.bits;
      for (let k = 0; k < 4; k++) {
        const u = 0.15 + 0.7 * hash(seed + k * 5.3 + 1);
        const [px, py] = at(u, ((L.z0 + L.z1) / 2) * h);
        g.beginPath();
        g.ellipse(px, py, r * 0.05, (L.z1 - L.z0) * h * 0.3, 0, 0, TAU);
        g.fill();
      }
    }
  }
  // 윗면 크림 층과 바깥 코팅
  radialQuad(g, cx, cy, ex, ey, h * 0.84, h);
  g.fillStyle = st.top[0];
  g.fill();
  radialQuad(g, cx, cy, ex, ey, 0, h, 0.94, 1);
  g.fillStyle = st.side[0];
  g.fill();
  // 안쪽으로 갈수록 살짝 그늘
  radialQuad(g, cx, cy, ex, ey, 0, h);
  const grad = g.createLinearGradient(cx, cy, ex, ey);
  grad.addColorStop(0, 'rgba(60,25,10,0.14)');
  grad.addColorStop(0.6, 'rgba(60,25,10,0)');
  g.fillStyle = grad;
  g.fill();
  g.strokeStyle = 'rgba(90,45,25,0.18)';
  g.lineWidth = 0.8;
  g.stroke();
}

function drawSlice(
  g: Ctx, cx: number, cy: number, r: number, h: number,
  a0: number, a1: number, st: FlavorStyle, cut0: boolean, cut1: boolean, seed: number,
) {
  const ry = r * TILT;
  const top = cy - h;
  if (cut0 && Math.cos(a0) < 0) cutFace(g, cx, cy, r, h, a0, st, seed);
  if (cut1 && Math.cos(a1) > 0) cutFace(g, cx, cy, r, h, a1, st, seed + 50);

  // 바깥 옆면
  for (const [s0, e0] of frontRanges(a0, a1)) {
    wallPath(g, cx, cy, r, 0, h, s0, e0);
    const grad = g.createLinearGradient(0, cy - h, 0, cy + ry);
    grad.addColorStop(0, st.side[0]);
    grad.addColorStop(1, st.side[1]);
    g.fillStyle = grad;
    g.fill();
    const shade = Math.abs(Math.cos((s0 + e0) / 2)) * 0.2;
    g.fillStyle = `rgba(60,25,10,${shade})`;
    g.fill();
    if (st.drip) {
      wallPath(g, cx, cy, r, h * 0.86, h, s0, e0);
      g.fillStyle = st.drip;
      g.fill();
      g.fillStyle = st.drip;
      const w = r * 0.07;
      for (let th = s0 + 0.12; th < e0 - 0.08; th += 0.21) {
        const len = h * (0.22 + 0.45 * hash(th * 13 + seed));
        const px = cx + r * Math.cos(th);
        const py = cy - h * 0.92 + ry * Math.sin(th);
        g.beginPath();
        g.moveTo(px - w, py);
        g.lineTo(px - w, py + len - w);
        g.arc(px, py + len - w, w, Math.PI, 0, true);
        g.lineTo(px + w, py);
        g.closePath();
        g.fill();
      }
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = r * 0.025;
      g.beginPath();
      g.ellipse(cx, cy - h * 0.95, r, ry, 0, s0, e0);
      g.stroke();
    }
    // 밑단 크림 테두리
    g.fillStyle = st.cream[1];
    for (let th = s0 + 0.1; th < e0; th += 0.24) {
      circle(g, cx + r * Math.cos(th), cy + ry * Math.sin(th) - h * 0.02, r * 0.075);
      g.fill();
    }
    g.fillStyle = st.cream[0];
    for (let th = s0 + 0.1; th < e0; th += 0.24) {
      circle(g, cx + r * Math.cos(th), cy + ry * Math.sin(th) - h * 0.06, r * 0.065);
      g.fill();
    }
  }

  // 윗면
  g.beginPath();
  g.moveTo(cx, top);
  g.ellipse(cx, top, r, ry, 0, a0, a1);
  g.closePath();
  const tg = g.createRadialGradient(cx - r * 0.3, top - ry * 0.4, 0, cx, top, r * 1.1);
  tg.addColorStop(0, st.top[0]);
  tg.addColorStop(1, st.top[1]);
  g.fillStyle = tg;
  g.fill();
  g.strokeStyle = 'rgba(80,35,20,0.12)';
  g.lineWidth = 0.8;
  g.stroke();

  const P = (rho: number, th: number): [number, number] => [cx + rho * Math.cos(th), top + rho * TILT * Math.sin(th)];
  const m = (a0 + a1) / 2;
  if (st.dust) {
    g.fillStyle = st.dust;
    g.globalAlpha = 0.45;
    for (let k = 0; k < 14; k++) {
      const [px, py] = P(r * (0.15 + 0.8 * hash(seed + k * 2.3)), a0 + (a1 - a0) * hash(seed + k * 9.1));
      circle(g, px, py, r * 0.016);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  if (st.gloss > 0) {
    g.strokeStyle = `rgba(255,255,255,${st.gloss})`;
    g.lineWidth = r * 0.05;
    g.lineCap = 'round';
    const lo = Math.max(a0 + 0.06, Math.PI * 1.05);
    const hi = Math.min(a1 - 0.06, Math.PI * 1.45);
    const lo2 = Math.max(a0 + 0.06, Math.PI * 3.05);
    const hi2 = Math.min(a1 - 0.06, Math.PI * 3.45);
    for (const [s, e] of [[lo, hi], [lo2, hi2]]) {
      if (e > s) {
        g.beginPath();
        g.ellipse(cx, top, r * 0.72, ry * 0.72, 0, s, e);
        g.stroke();
      }
    }
  }
  // 앞쪽 테두리 하이라이트
  for (const [s0, e0] of frontRanges(a0, a1)) {
    g.strokeStyle = 'rgba(255,255,255,0.4)';
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(cx, top, r, ry, 0, s0, e0);
    g.stroke();
  }

  const rim = () => {
    for (const f of [0.28, 0.72]) {
      const [px, py] = P(r * 0.8, a0 + (a1 - a0) * f);
      rosette(g, px, py, r * 0.12, st.cream);
    }
  };
  // 앞쪽 조각은 가장자리 크림이 토핑보다 앞에 온다
  if (Math.sin(m) > 0) {
    topping(g, st, P, r, m);
    rim();
  } else {
    rim();
    topping(g, st, P, r, m);
  }
}

function slicesShadow(g: Ctx, x: number, y: number, r: number, rot: number, n: number) {
  g.fillStyle = 'rgba(90,40,25,0.16)';
  g.beginPath();
  g.moveTo(x, y + 3);
  g.ellipse(x, y + 3, r * 1.05, r * TILT * 1.05, 0, rot - 0.05, rot + n * STEP + 0.05);
  g.closePath();
  g.fill();
}

function paintCake(g: Ctx, x: number, y: number, s: number, slices: number[], rot: number) {
  const n = slices.length;
  const r = CAKE_R * s;
  const h = CAKE_H * s;
  const cy = y - 2 * s;
  slicesShadow(g, x, cy, r, rot, n);
  const mid = (j: number) => Math.sin(rot + (j + 0.5) * STEP);
  const order = slices.map((_, j) => j).sort((A, B) => mid(A) - mid(B));
  for (const j of order) {
    const a0 = rot + j * STEP;
    drawSlice(g, x, cy, r, h, a0, a0 + STEP, FLAVORS[slices[j]], n < MAX_SLICES && j === 0, n < MAX_SLICES && j === n - 1, j * 17 + slices[j] * 5);
  }
}

/** 접시 위 케이크. 조각은 rot부터 시계 방향으로 60°씩 채운다. */
export function drawCake(ctx: Ctx, x: number, y: number, s: number, slices: number[], rot: number) {
  const n = slices.length;
  if (!n) return;
  const tr = targetRot(n);
  // 회전 애니메이션 중에만 직접 그리고, 멈춰 있으면 캐시된 이미지를 찍는다
  if (Math.abs(angleDiff(rot, tr)) > 0.015) {
    paintCake(ctx, x, y, s, slices, rot);
    return;
  }
  const c = sprite(slices.join(','), CAKE_BOX, (g) => paintCake(g, 0, 0, 1, slices, tr));
  stamp(ctx, c, CAKE_BOX, x, y, s);
}

/** 날아가는 조각 하나 (뾰족한 쪽이 화면 앞을 향함) */
export function drawLooseSlice(ctx: Ctx, x: number, y: number, s: number, flavor: number, height: number) {
  const r = CAKE_R * s;
  ctx.fillStyle = `rgba(90,40,25,${0.16 * (1 - height * 0.5)})`;
  ctx.beginPath();
  ctx.ellipse(x, y + 8 * s + height * 30 * s, r * 0.45, r * 0.45 * TILT, 0, 0, TAU);
  ctx.fill();
  const c = sprite(`loose:${flavor}`, CAKE_BOX, (g) => {
    const a0 = -Math.PI / 2 - STEP / 2;
    drawSlice(g, 0, CAKE_R * TILT * 0.45, CAKE_R, CAKE_H, a0, a0 + STEP, FLAVORS[flavor], true, true, flavor * 7);
  });
  stamp(ctx, c, CAKE_BOX, x, y, s);
}
