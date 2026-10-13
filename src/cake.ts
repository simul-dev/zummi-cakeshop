import { MAX_SLICES } from './config';
import { circle, TAU } from './draw';
import { FLAVORS, type FlavorStyle } from './flavors';

/** 접시 위 조각 하나. ang는 렌더용 현재 각도(조각이 움직일 때 부드럽게 따라간다). */
export interface Slice {
  f: number;
  ang: number;
  /** false면 아직 도착하지 않은 조각 (자리만 잡아 둠) */
  vis: boolean;
}

/** 위에서 비스듬히 내려다보는 시점: 원을 세로로 이만큼 눌러 그린다 */
export const TILT = 0.64;
export const PLATE_R = 48;
export const CAKE_R = 40;
export const CAKE_H = 30;
export const STEP = TAU / MAX_SLICES;

type Ctx = CanvasRenderingContext2D;

/** 빈 자리가 화면 앞쪽을 향하도록 회전 (잘린 단면이 보여서 입체감이 산다) */
export function targetRot(n: number) {
  return Math.PI / 2 + ((MAX_SLICES - n) * Math.PI) / MAX_SLICES;
}

/** a - b 를 [-π, π) 로 */
export function angleDiff(a: number, b: number) {
  return ((((a - b + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
}

/** 조각들이 전부 제자리에 있고 회전도 끝났는지 (→ 캐시된 그림을 써도 된다) */
export function isSettled(slices: Slice[], rot: number) {
  if (Math.abs(angleDiff(rot, targetRot(slices.length))) > 1e-3) return false;
  return slices.every((s, j) => s.vis && Math.abs(angleDiff(s.ang, rot + j * STEP)) < 1e-3);
}

/** 결정적 의사난수 (같은 케이크는 매번 같은 모양) */
function hash(x: number) {
  const s = Math.sin(x * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// ───────────────────────── 스프라이트 캐시 ─────────────────────────
// 케이크는 그릴 게 많아서 조합(맛 배열)별로 한 번만 그려 두고 이미지로 찍는다.
// 이미지는 화면 픽셀과 1:1일 때만 쓴다. 키우거나(드래그·완성 연출) 소수점 위치에 찍으면
// 픽셀이 늘어나 흐릿하고 깨져 보이므로, 그때는 매번 새로 그린다.

interface Box { l: number; r: number; u: number; d: number; }
const CAKE_BOX: Box = { l: CAKE_R + 18, r: CAKE_R + 18, u: CAKE_R * TILT + CAKE_H + 48, d: CAKE_R * TILT + 16 };
const PLATE_BOX: Box = { l: PLATE_R + 3, r: PLATE_R + 3, u: PLATE_R * TILT + 3, d: PLATE_R * TILT + 8 };

/** ox, oy: 이미지 안에서 그리기 원점의 정수 픽셀 위치 */
interface Sprite { c: HTMLCanvasElement; ox: number; oy: number; }

const cache = new Map<string, Sprite>();
/** 논리 단위 1당 화면(장치) 픽셀 수 = 메인 캔버스 변환 배율과 같아야 한다 */
let ppu = 2;

/** 논리 단위 1당 실제 픽셀 수. 바뀌면 캐시를 버린다. */
export function setCakeResolution(pxPerUnit: number) {
  if (Math.abs(pxPerUnit - ppu) < 1e-6) return;
  ppu = pxPerUnit;
  cache.clear();
}

function sprite(key: string, box: Box, paint: (g: Ctx) => void): Sprite {
  let sp = cache.get(key);
  if (sp) {
    cache.delete(key);
    cache.set(key, sp);
    return sp;
  }
  const ox = Math.ceil(box.l * ppu);
  const oy = Math.ceil(box.u * ppu);
  const c = document.createElement('canvas');
  c.width = ox + Math.ceil(box.r * ppu);
  c.height = oy + Math.ceil(box.d * ppu);
  const g = c.getContext('2d')!;
  g.setTransform(ppu, 0, 0, ppu, ox, oy);
  paint(g);
  sp = { c, ox, oy };
  cache.set(key, sp);
  if (cache.size > 90) cache.delete(cache.keys().next().value!);
  return sp;
}

/** 원점을 장치 픽셀 격자에 맞춰 1:1로 복사한다 (리샘플링 없음). s<1로 줄일 때만 부드럽게 축소. */
function stamp(ctx: Ctx, sp: Sprite, x: number, y: number, s: number) {
  if (Math.abs(s - 1) < 1e-3) {
    const dx = Math.round(x * ppu) - sp.ox;
    const dy = Math.round(y * ppu) - sp.oy;
    ctx.drawImage(sp.c, dx / ppu, dy / ppu, sp.c.width / ppu, sp.c.height / ppu);
    return;
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sp.c, x - (sp.ox / ppu) * s, y - (sp.oy / ppu) * s, (sp.c.width / ppu) * s, (sp.c.height / ppu) * s);
}

/** 키워서 보여야 하고 선명해야 하는 순간(드래그, 완성 연출)이면 직접 그린다 */
const mustRepaint = (s: number, crisp: boolean) => crisp && s > 1.001;

// ───────────────────────── 접시 ─────────────────────────

function paintPlate(g: Ctx) {
  const R = PLATE_R;
  const ry = R * TILT;
  g.fillStyle = '#c9d0db';
  g.beginPath();
  g.ellipse(0, 4, R, ry, 0, 0, TAU);
  g.fill();
  const grad = g.createRadialGradient(-R * 0.3, -ry * 0.4, 2, 0, 0, R);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#e9edf3');
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
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 1.6;
  g.beginPath();
  g.ellipse(0, 0, R * 0.95, ry * 0.95, 0, Math.PI * 1.08, Math.PI * 1.5);
  g.stroke();
}

export function drawPlate(ctx: Ctx, x: number, y: number, s: number, lift = 0, crisp = false) {
  const R = PLATE_R * s;
  ctx.fillStyle = `rgba(90,45,30,${0.2 - lift * 0.07})`;
  ctx.beginPath();
  ctx.ellipse(x + lift * 6 * s, y + 7 * s + lift * 26 * s, R * (1 - lift * 0.06), R * TILT * (1 - lift * 0.06), 0, 0, TAU);
  ctx.fill();
  if (mustRepaint(s, crisp)) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    paintPlate(ctx);
    ctx.restore();
    return;
  }
  stamp(ctx, sprite('plate', PLATE_BOX, paintPlate), x, y, s);
}

// ───────────────────────── 토핑 ─────────────────────────

function softShadow(g: Ctx, x: number, y: number, rx: number, ry: number, a = 0.18) {
  g.fillStyle = `rgba(70,30,20,${a})`;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, TAU);
  g.fill();
}

/** 짜 올린 생크림 (아래 넓고 위로 갈수록 좁아지는 3단 소용돌이) */
function rosette(g: Ctx, x: number, y: number, rad: number, [c, shade]: [string, string]) {
  softShadow(g, x, y + rad * 0.6, rad * 1.05, rad * 0.45, 0.18);
  const tiers: [number, number, number][] = [[0, 0, 1], [0.05, -0.42, 0.68], [0.1, -0.78, 0.38]];
  for (const [dx, dy, k] of tiers) {
    const cx = x + dx * rad;
    const cy = y + dy * rad;
    const rr = rad * k;
    g.fillStyle = shade;
    circle(g, cx, cy + rr * 0.16, rr);
    g.fill();
    const grad = g.createRadialGradient(cx - rr * 0.35, cy - rr * 0.4, 0, cx, cy, rr);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.55, c);
    grad.addColorStop(1, shade);
    g.fillStyle = grad;
    circle(g, cx, cy, rr);
    g.fill();
    g.strokeStyle = shade;
    g.lineCap = 'round';
    g.lineWidth = rr * 0.2;
    g.beginPath();
    g.arc(cx, cy - rr * 0.05, rr * 0.6, Math.PI * 0.15, Math.PI * 0.9);
    g.stroke();
  }
}

function mintLeaf(g: Ctx, x: number, y: number, w: number, rot: number) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  const grad = g.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, '#3f9a3c');
  grad.addColorStop(1, '#6cc95f');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(w * 0.5, -w * 0.48, w, 0);
  g.quadraticCurveTo(w * 0.5, w * 0.48, 0, 0);
  g.fill();
  g.strokeStyle = '#2d7a2f';
  g.lineWidth = w * 0.06;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(w * 0.85, 0);
  g.stroke();
  g.restore();
}

function strawberry(g: Ctx, x: number, y: number, w: number) {
  softShadow(g, x, y + w * 0.2, w * 0.75, w * 0.3);
  const by = y - w * 0.55;
  g.beginPath();
  g.moveTo(x, by + w * 0.98);
  g.bezierCurveTo(x - w * 1.0, by + w * 0.45, x - w * 0.9, by - w * 0.58, x, by - w * 0.5);
  g.bezierCurveTo(x + w * 0.9, by - w * 0.58, x + w * 1.0, by + w * 0.45, x, by + w * 0.98);
  const grad = g.createRadialGradient(x - w * 0.32, by - w * 0.18, 0, x, by, w * 1.15);
  grad.addColorStop(0, '#ff8591');
  grad.addColorStop(0.5, '#e8163a');
  grad.addColorStop(1, '#9d0a22');
  g.fillStyle = grad;
  g.fill();
  g.fillStyle = '#ffeaa8';
  for (const [dx, dy] of [[-0.42, -0.05], [0, -0.18], [0.4, -0.02], [-0.24, 0.3], [0.22, 0.28], [0, 0.6], [-0.52, 0.28], [0.52, 0.24], [-0.1, 0.05]]) {
    g.beginPath();
    g.ellipse(x + dx * w, by + dy * w, w * 0.05, w * 0.075, 0, 0, TAU);
    g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.65)';
  g.beginPath();
  g.ellipse(x - w * 0.38, by + w * 0.02, w * 0.13, w * 0.28, 0.35, 0, TAU);
  g.fill();
  g.fillStyle = '#3f9e3a';
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k - 2) * 0.55;
    g.beginPath();
    g.moveTo(x - w * 0.12, by - w * 0.44);
    g.lineTo(x + Math.cos(a) * w * 0.6, by - w * 0.44 + Math.sin(a) * w * 0.34 + w * 0.12);
    g.lineTo(x + w * 0.12, by - w * 0.44);
    g.fill();
  }
  g.fillStyle = '#2e7d2b';
  g.fillRect(x - w * 0.045, by - w * 0.8, w * 0.09, w * 0.34);
}

function fruitWheel(g: Ctx, x: number, y: number, rad: number, rim: string, flesh: string, seg: string, half: boolean) {
  softShadow(g, x, y + rad * 0.15, rad * 0.95, rad * 0.34);
  const cy = y - rad * 0.85;
  const oy = half ? cy + rad * 0.5 : cy;
  const wheel = (rr: number, color: string) => {
    g.fillStyle = color;
    g.beginPath();
    if (half) {
      g.moveTo(x - rr, oy);
      g.arc(x, oy, rr, Math.PI, TAU);
    } else {
      g.ellipse(x, cy, rr * 0.86, rr, 0, 0, TAU);
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
  const count = half ? 4 : 8;
  for (let k = 0; k < count + (half ? 1 : 0); k++) {
    const a = half ? Math.PI + (k / count) * Math.PI : (k / count) * TAU;
    g.moveTo(x, oy);
    g.lineTo(x + Math.cos(a) * rad * 0.76 * (half ? 1 : 0.86), oy + Math.sin(a) * rad * 0.76);
  }
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.6)';
  circle(g, x - rad * 0.32, half ? oy - rad * 0.4 : cy - rad * 0.38, rad * 0.14);
  g.fill();
}

function blueberry(g: Ctx, x: number, y: number, rad: number) {
  softShadow(g, x, y + rad * 0.75, rad * 1.05, rad * 0.42);
  const grad = g.createRadialGradient(x - rad * 0.35, y - rad * 0.4, 0, x, y, rad);
  grad.addColorStop(0, '#8d97e6');
  grad.addColorStop(0.5, '#3d479f');
  grad.addColorStop(1, '#1b2060');
  g.fillStyle = grad;
  circle(g, x, y, rad);
  g.fill();
  g.strokeStyle = '#13173f';
  g.lineWidth = rad * 0.16;
  g.beginPath();
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    g.moveTo(x, y - rad * 0.45);
    g.lineTo(x + Math.cos(a) * rad * 0.24, y - rad * 0.45 + Math.sin(a) * rad * 0.16);
  }
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.55)';
  circle(g, x - rad * 0.38, y - rad * 0.1, rad * 0.17);
  g.fill();
}

function cherry(g: Ctx, x: number, y: number, rad: number) {
  softShadow(g, x, y + rad * 0.85, rad * 1.15, rad * 0.42);
  const cy = y - rad * 0.2;
  g.strokeStyle = '#5b3a1c';
  g.lineWidth = rad * 0.18;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x + rad * 0.05, cy - rad * 0.7);
  g.quadraticCurveTo(x + rad * 0.2, cy - rad * 1.9, x + rad * 1.0, cy - rad * 2.2);
  g.stroke();
  const grad = g.createRadialGradient(x - rad * 0.35, cy - rad * 0.35, 0, x, cy, rad * 1.05);
  grad.addColorStop(0, '#ff7a82');
  grad.addColorStop(0.5, '#d8102c');
  grad.addColorStop(1, '#760513');
  g.fillStyle = grad;
  circle(g, x, cy, rad);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.beginPath();
  g.ellipse(x - rad * 0.38, cy - rad * 0.36, rad * 0.17, rad * 0.28, 0.6, 0, TAU);
  g.fill();
}

function chocoCurl(g: Ctx, x: number, y: number, w: number, rot: number) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = '#3a1a0a';
  g.beginPath();
  g.ellipse(0, 0, w, w * 0.34, 0, 0, TAU);
  g.fill();
  g.strokeStyle = '#9a6a48';
  g.lineWidth = w * 0.15;
  g.beginPath();
  g.ellipse(0, -w * 0.05, w * 0.8, w * 0.18, 0, Math.PI * 1.1, Math.PI * 1.9);
  g.stroke();
  g.restore();
}

/** 벚꽃 한 송이: 끝이 살짝 갈라진 꽃잎 5장 + 진분홍 꽃술. 윗면에 눕혀 있어서 세로로 눌러 그린다. */
function blossom(g: Ctx, x: number, y: number, rad: number, rot: number) {
  softShadow(g, x + rad * 0.1, y + rad * 0.35, rad * 1.05, rad * 0.5, 0.14);
  g.save();
  g.translate(x, y);
  g.scale(1, 0.78);
  for (let k = 0; k < 5; k++) {
    g.save();
    g.rotate(rot + (k * TAU) / 5);
    const grad = g.createLinearGradient(0, 0, 0, -rad);
    grad.addColorStop(0, '#ff8fb3');
    grad.addColorStop(0.45, '#ffc6d9');
    grad.addColorStop(1, '#fff0f5');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(-rad * 0.62, -rad * 0.3, -rad * 0.48, -rad * 0.95, -rad * 0.14, -rad * 0.98);
    g.lineTo(0, -rad * 0.84);
    g.lineTo(rad * 0.14, -rad * 0.98);
    g.bezierCurveTo(rad * 0.48, -rad * 0.95, rad * 0.62, -rad * 0.3, 0, 0);
    g.fill();
    g.strokeStyle = 'rgba(230,110,150,0.35)';
    g.lineWidth = rad * 0.04;
    g.beginPath();
    g.moveTo(0, -rad * 0.15);
    g.lineTo(0, -rad * 0.6);
    g.stroke();
    g.restore();
  }
  g.fillStyle = '#e8487a';
  circle(g, 0, 0, rad * 0.2);
  g.fill();
  g.fillStyle = '#ffd86b';
  for (let k = 0; k < 6; k++) {
    const a = rot + (k * TAU) / 6 + 0.3;
    circle(g, Math.cos(a) * rad * 0.3, Math.sin(a) * rad * 0.3, rad * 0.065);
    g.fill();
  }
  g.restore();
}

/** 은색 아라잔 (작은 진주 장식) */
function pearl(g: Ctx, x: number, y: number, rad: number) {
  const grad = g.createRadialGradient(x - rad * 0.35, y - rad * 0.35, 0, x, y, rad);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.6, '#e6e1ea');
  grad.addColorStop(1, '#b9b2c2');
  g.fillStyle = grad;
  circle(g, x, y, rad);
  g.fill();
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
      strawberry(g, x, y, r * 0.27);
      break;
    case 'matcha': {
      const [bx, by] = P(r * 0.3, m + 0.36);
      redBean(g, bx, by - r * 0.02, r * 0.06);
      const [cx, cy] = P(r * 0.64, m - 0.3);
      redBean(g, cx, cy - r * 0.02, r * 0.06);
      rosette(g, x, y - r * 0.06, r * 0.2, st.cream);
      break;
    }
    case 'lemon':
      mintLeaf(g, x + r * 0.07, y - r * 0.05, r * 0.22, -0.5);
      fruitWheel(g, x - r * 0.04, y, r * 0.23, '#e8b400', '#ffe55c', '#fff6c4', false);
      break;
    case 'orange':
      fruitWheel(g, x, y, r * 0.25, '#e8660a', '#ffa236', '#ffe1bd', true);
      mintLeaf(g, x + r * 0.14, y - r * 0.02, r * 0.18, -0.2);
      break;
    case 'blueberry': {
      mintLeaf(g, x + r * 0.05, y - r * 0.14, r * 0.2, -0.9);
      const [ax, ay] = P(r * 0.4, m - 0.22);
      const [bx, by] = P(r * 0.6, m + 0.12);
      const [cx, cy] = P(r * 0.35, m + 0.3);
      blueberry(g, ax, ay - r * 0.09, r * 0.115);
      blueberry(g, cx, cy - r * 0.09, r * 0.11);
      blueberry(g, bx, by - r * 0.08, r * 0.12);
      break;
    }
    case 'sakura': {
      for (const [rho, dt] of [[0.26, 0.42], [0.7, -0.22], [0.62, 0.3]] as const) {
        const [px, py] = P(r * rho, m + dt);
        pearl(g, px, py - r * 0.02, r * 0.035);
      }
      const [bx, by] = P(r * 0.66, m + 0.2);
      blossom(g, bx, by - r * 0.03, r * 0.15, m * 2 + 0.6);
      blossom(g, x, y - r * 0.04, r * 0.26, m * 3);
      break;
    }
    case 'cherry':
      chocoCurl(g, x - r * 0.13, y + r * 0.02, r * 0.11, 0.5);
      chocoCurl(g, x + r * 0.15, y + r * 0.04, r * 0.1, -0.4);
      cherry(g, x, y - r * 0.04, r * 0.12);
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

/** 단면 층 구성 (아래 → 위): 스펀지 · 생크림 · 잼 · 스펀지 · 생크림 · 프로스팅 */
const LAYERS: [number, number, 'sponge' | 'cream' | 'jam' | 'frost'][] = [
  [0, 0.3, 'sponge'],
  [0.3, 0.44, 'cream'],
  [0.44, 0.52, 'jam'],
  [0.52, 0.8, 'sponge'],
  [0.8, 0.9, 'cream'],
  [0.9, 1, 'frost'],
];

/** 조각이 빠진 쪽에서 보이는 단면 */
function cutFace(g: Ctx, cx: number, cy: number, r: number, h: number, a: number, st: FlavorStyle, seed: number) {
  const ex = cx + r * Math.cos(a);
  const ey = cy + r * TILT * Math.sin(a);
  const at = (u: number, z: number): [number, number] => [cx + (ex - cx) * u, cy + (ey - cy) * u - z];
  for (const [z0, z1, kind] of LAYERS) {
    radialQuad(g, cx, cy, ex, ey, z0 * h, z1 * h);
    if (kind === 'sponge') {
      const grad = g.createLinearGradient(0, cy - z1 * h, 0, cy - z0 * h);
      grad.addColorStop(0, st.sponge[0]);
      grad.addColorStop(1, st.sponge[1]);
      g.fillStyle = grad;
      g.fill();
      g.fillStyle = st.sponge[1];
      for (let k = 0; k < 11; k++) {
        const u = 0.08 + 0.84 * hash(seed + k * 3.1 + z0);
        const z = (z0 + (z1 - z0) * (0.15 + 0.7 * hash(seed + k * 7.7 + z1))) * h;
        const [px, py] = at(u, z);
        g.beginPath();
        g.ellipse(px, py, r * (0.018 + 0.012 * hash(k + seed)), r * 0.014, 0, 0, TAU);
        g.fill();
      }
    } else if (kind === 'cream') {
      g.fillStyle = st.cream[0];
      g.fill();
      radialQuad(g, cx, cy, ex, ey, z0 * h, (z0 + 0.02) * h);
      g.fillStyle = st.cream[1];
      g.fill();
    } else if (kind === 'jam') {
      g.fillStyle = st.jam[0];
      g.fill();
      g.fillStyle = st.jam[1];
      for (let k = 0; k < 4; k++) {
        const u = 0.15 + 0.7 * hash(seed + k * 5.3 + 1);
        const [px, py] = at(u, ((z0 + z1) / 2) * h);
        g.beginPath();
        g.ellipse(px, py, r * 0.045, (z1 - z0) * h * 0.3, 0, 0, TAU);
        g.fill();
      }
      radialQuad(g, cx, cy, ex, ey, (z1 - 0.015) * h, z1 * h);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fill();
    } else {
      g.fillStyle = st.top[0];
      g.fill();
    }
  }
  // 바깥 프로스팅 코팅
  radialQuad(g, cx, cy, ex, ey, 0, h, 0.94, 1);
  g.fillStyle = st.side[0];
  g.fill();
  // 안쪽으로 갈수록 살짝 그늘
  radialQuad(g, cx, cy, ex, ey, 0, h);
  const grad = g.createLinearGradient(cx, cy, ex, ey);
  grad.addColorStop(0, 'rgba(60,25,10,0.16)');
  grad.addColorStop(0.6, 'rgba(60,25,10,0)');
  g.fillStyle = grad;
  g.fill();
  g.strokeStyle = 'rgba(90,45,25,0.2)';
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

  // 바깥 옆면: 위→아래 색, 왼쪽에서 빛이 들어오는 하이라이트, 밑단 그늘
  for (const [s0, e0] of frontRanges(a0, a1)) {
    wallPath(g, cx, cy, r, 0, h, s0, e0);
    const vg = g.createLinearGradient(0, top, 0, cy + ry);
    vg.addColorStop(0, st.side[0]);
    vg.addColorStop(1, st.side[1]);
    g.fillStyle = vg;
    g.fill();
    const hg = g.createLinearGradient(cx - r, 0, cx + r, 0);
    hg.addColorStop(0, 'rgba(255,255,255,0.04)');
    hg.addColorStop(0.22, 'rgba(255,255,255,0.34)');
    hg.addColorStop(0.5, 'rgba(255,255,255,0)');
    hg.addColorStop(0.8, 'rgba(60,20,10,0.1)');
    hg.addColorStop(1, 'rgba(60,20,10,0.24)');
    g.fillStyle = hg;
    g.fill();
    wallPath(g, cx, cy, r, 0, h * 0.22, s0, e0);
    const ag = g.createLinearGradient(0, cy - h * 0.22, 0, cy + ry * 0.6);
    ag.addColorStop(0, 'rgba(60,20,10,0)');
    ag.addColorStop(1, 'rgba(60,20,10,0.26)');
    g.fillStyle = ag;
    g.fill();
    if (st.drip) {
      wallPath(g, cx, cy, r, h * 0.85, h, s0, e0);
      g.fillStyle = st.drip;
      g.fill();
      const w = r * 0.085;
      for (let th = s0 + 0.16; th < e0 - 0.08; th += 0.3) {
        const len = h * (0.22 + 0.42 * hash(th * 13 + seed));
        const px = cx + r * Math.cos(th);
        const py = cy - h * 0.9 + ry * Math.sin(th);
        g.fillStyle = st.drip;
        g.beginPath();
        g.moveTo(px - w, py);
        g.lineTo(px - w, py + len - w);
        g.arc(px, py + len - w, w, Math.PI, 0, true);
        g.lineTo(px + w, py);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.35)';
        g.lineWidth = w * 0.45;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(px - w * 0.45, py + w * 0.3);
        g.lineTo(px - w * 0.45, py + len - w * 1.3);
        g.stroke();
      }
      g.strokeStyle = 'rgba(255,255,255,0.45)';
      g.lineWidth = r * 0.03;
      g.beginPath();
      g.ellipse(cx, cy - h * 0.95, r, ry, 0, s0, e0);
      g.stroke();
    }
    if (st.ribbon) {
      wallPath(g, cx, cy, r, h * 0.38, h * 0.56, s0, e0);
      const rg = g.createLinearGradient(0, cy - h * 0.56, 0, cy - h * 0.38 + ry);
      rg.addColorStop(0, st.ribbon[0]);
      rg.addColorStop(1, st.ribbon[1]);
      g.fillStyle = rg;
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = r * 0.02;
      g.beginPath();
      g.ellipse(cx, cy - h * 0.53, r, ry, 0, s0, e0);
      g.stroke();
    }
    // 밑단 크림 테두리 (두 줄)
    for (let th = s0 + 0.1; th < e0; th += 0.23) {
      const px = cx + r * Math.cos(th);
      const py = cy + ry * Math.sin(th);
      g.fillStyle = st.cream[1];
      circle(g, px, py - h * 0.01, r * 0.082);
      g.fill();
    }
    for (let th = s0 + 0.1; th < e0; th += 0.23) {
      const px = cx + r * Math.cos(th);
      const py = cy + ry * Math.sin(th);
      const grad = g.createRadialGradient(px - r * 0.025, py - h * 0.08, 0, px, py - h * 0.05, r * 0.075);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.6, st.cream[0]);
      grad.addColorStop(1, st.cream[1]);
      g.fillStyle = grad;
      circle(g, px, py - h * 0.05, r * 0.072);
      g.fill();
    }
  }

  // 윗면
  const wedge = () => {
    g.beginPath();
    g.moveTo(cx, top);
    g.ellipse(cx, top, r, ry, 0, a0, a1);
    g.closePath();
  };
  wedge();
  const tg = g.createRadialGradient(cx - r * 0.3, top - ry * 0.45, 0, cx, top, r * 1.05);
  tg.addColorStop(0, st.top[0]);
  tg.addColorStop(1, st.top[1]);
  g.fillStyle = tg;
  g.fill();
  if (st.gloss > 0) {
    g.save();
    wedge();
    g.clip();
    const sg = g.createRadialGradient(cx - r * 0.38, top - ry * 0.3, 0, cx - r * 0.38, top - ry * 0.3, r * 0.55);
    sg.addColorStop(0, `rgba(255,255,255,${0.75 * st.gloss})`);
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sg;
    g.fillRect(cx - r, top - ry, r * 2, ry * 2);
    g.restore();
  }
  wedge();
  g.strokeStyle = 'rgba(80,35,20,0.14)';
  g.lineWidth = 0.8;
  g.stroke();

  const P = (rho: number, th: number): [number, number] => [cx + rho * Math.cos(th), top + rho * TILT * Math.sin(th)];
  const m = (a0 + a1) / 2;
  if (st.dust) {
    g.fillStyle = st.dust;
    g.globalAlpha = 0.5;
    for (let k = 0; k < 16; k++) {
      const [px, py] = P(r * (0.12 + 0.82 * hash(seed + k * 2.3)), a0 + (a1 - a0) * hash(seed + k * 9.1));
      circle(g, px, py, r * 0.017);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  // 앞쪽 테두리 하이라이트
  for (const [s0, e0] of frontRanges(a0, a1)) {
    g.strokeStyle = 'rgba(255,255,255,0.45)';
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(cx, top, r, ry, 0, s0, e0);
    g.stroke();
  }

  const rim = () => {
    for (const f of [0.27, 0.73]) {
      const [px, py] = P(r * 0.8, a0 + (a1 - a0) * f);
      rosette(g, px, py, r * 0.13, st.cream);
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

function wedgeShadow(g: Ctx, x: number, y: number, r: number, a0: number, a1: number) {
  g.fillStyle = 'rgba(90,40,25,0.2)';
  g.beginPath();
  g.moveTo(x, y + 3);
  g.ellipse(x, y + 3, r * 1.06, r * TILT * 1.06, 0, a0 - 0.04, a1 + 0.04);
  g.closePath();
  g.fill();
}

/** 조각들을 현재 각도 그대로 그린다 (뒤쪽 조각부터) */
function paintSlices(g: Ctx, x: number, y: number, s: number, slices: Slice[]) {
  const vis = slices.filter((sl) => sl.vis);
  if (!vis.length) return;
  const r = CAKE_R * s;
  const h = CAKE_H * s;
  const cy = y - 2 * s;
  for (const sl of vis) wedgeShadow(g, x, cy, r, sl.ang, sl.ang + STEP);
  const flush = (a: number, b: number) => Math.abs(angleDiff(a, b)) < 0.03;
  const order = vis.slice().sort((A, B) => Math.sin(A.ang + STEP / 2) - Math.sin(B.ang + STEP / 2));
  for (const sl of order) {
    // 옆에 조각이 딱 붙어 있지 않은 면만 단면을 그린다
    const cut0 = !vis.some((o) => o !== sl && flush(o.ang + STEP, sl.ang));
    const cut1 = !vis.some((o) => o !== sl && flush(o.ang, sl.ang + STEP));
    const j = slices.indexOf(sl);
    drawSlice(g, x, cy, r, h, sl.ang, sl.ang + STEP, FLAVORS[sl.f], cut0, cut1, j * 17 + sl.f * 5);
  }
}

/** 접시 위 케이크 */
export function drawCake(ctx: Ctx, x: number, y: number, s: number, slices: Slice[], rot: number, crisp = false) {
  if (!slices.length) return;
  // 조각이 움직이는 중이거나 크게 키워 보여야 하면 매번 새로 그려서 선명하게
  if (mustRepaint(s, crisp) || !isSettled(slices, rot)) {
    paintSlices(ctx, x, y, s, slices);
    return;
  }
  const key = slices.map((sl) => sl.f).join(',');
  stamp(ctx, sprite(key, CAKE_BOX, (g) => paintSlices(g, 0, 0, 1, slices)), x, y, s);
}

/** 접시 사이를 이동 중인 조각 하나: 중심 (cx,cy)에 꼭짓점을 두고 a0부터 60° */
export function drawMovingSlice(ctx: Ctx, cx: number, cy: number, s: number, flavor: number, a0: number) {
  const r = CAKE_R * s;
  const h = CAKE_H * s;
  const y = cy - 2 * s;
  ctx.fillStyle = 'rgba(90,40,25,0.28)';
  ctx.beginPath();
  ctx.moveTo(cx, y + 5 * s);
  ctx.ellipse(cx, y + 5 * s, r * 1.1, r * TILT * 1.1, 0, a0 - 0.05, a0 + STEP + 0.05);
  ctx.closePath();
  ctx.fill();
  drawSlice(ctx, cx, y, r, h, a0, a0 + STEP, FLAVORS[flavor], true, true, flavor * 7);
}
