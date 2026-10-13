import { TILT } from './cake';
import { COLS, SLOTS } from './config';
import { circle, roundRect, TAU } from './draw';
import { CELL_W, slotCenter, type Layout } from './layout';

type Ctx = CanvasRenderingContext2D;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PASTELS = ['#ffb3c6', '#bde0fe', '#fff1a8', '#c8f2d8', '#e5d4ff', '#ffd6a5'];

/** 움직이지 않는 배경 전체. 리사이즈 때만 오프스크린 캔버스에 한 번 그린다. */
export function drawBackground(ctx: Ctx, L: Layout) {
  const rnd = mulberry32(11);
  const { LW, LH } = L;
  const floorY = L.table.y + L.table.h * 0.55;
  const awningH = Math.min(L.top * 0.82, 74);

  drawWallpaper(ctx, LW, floorY);
  // 아래쪽 민트 판넬
  ctx.fillStyle = '#c9eee3';
  ctx.fillRect(0, floorY - 110, LW, 110);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  for (let x = 14; x < LW; x += 70) {
    roundRect(ctx, x, floorY - 98, 56, 84, 6);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, floorY - 114, LW, 6);
  drawFloor(ctx, LW, LH, floorY);

  if (L.x0 > 46) {
    drawSideShelves(ctx, 8, L.x0 - 14, awningH + 20, floorY - 120, rnd);
    drawSideShelves(ctx, L.x0 + 456, LW - 8 - (L.x0 + 456), awningH + 20, floorY - 120, rnd);
  }
  drawTopDecor(ctx, L, awningH, rnd);
  drawAwning(ctx, LW, awningH);
  drawTable(ctx, L, rnd);
  drawBelt(ctx, L);
}

function drawWallpaper(ctx: Ctx, LW: number, floorY: number) {
  ctx.fillStyle = '#fde8ec';
  ctx.fillRect(0, 0, LW, floorY);
  ctx.fillStyle = '#fbd7df';
  for (let x = 0; x < LW; x += 48) ctx.fillRect(x, 0, 24, floorY);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let x = 12; x < LW; x += 48) {
    for (let y = 14; y < floorY; y += 34) {
      circle(ctx, x + ((y / 34) % 2 ? 24 : 0), y, 2.2);
      ctx.fill();
    }
  }
}

function drawFloor(ctx: Ctx, LW: number, LH: number, floorY: number) {
  const tile = 38;
  for (let y = floorY, r = 0; y < LH; y += tile, r++) {
    for (let x = 0, c = 0; x < LW; x += tile, c++) {
      ctx.fillStyle = (r + c) % 2 ? '#f6cfd8' : '#fff6ef';
      ctx.fillRect(x, y, tile + 0.5, tile + 0.5);
    }
  }
  const g = ctx.createLinearGradient(0, floorY, 0, floorY + 60);
  g.addColorStop(0, 'rgba(120,60,50,0.18)');
  g.addColorStop(1, 'rgba(120,60,50,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, floorY, LW, 60);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, floorY - 4, LW, 6);
}

function drawAwning(ctx: Ctx, LW: number, h: number) {
  const w = 34;
  for (let x = -w / 2, k = 0; x < LW + w; x += w, k++) {
    ctx.fillStyle = k % 2 ? '#fff4f7' : '#ff8fab';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + w, 0);
    ctx.lineTo(x + w, h);
    ctx.arc(x + w / 2, h, w / 2, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
  }
  const g = ctx.createLinearGradient(0, 0, 0, h + 17);
  g.addColorStop(0, 'rgba(120,30,50,0.18)');
  g.addColorStop(0.3, 'rgba(120,30,50,0)');
  g.addColorStop(1, 'rgba(120,30,50,0.08)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LW, h + 17);
  // 차양 아래 그림자
  ctx.fillStyle = 'rgba(150,60,80,0.10)';
  for (let x = -w / 2; x < LW + w; x += w) {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, h + 20, w / 2, 4, 0, 0, TAU);
    ctx.fill();
  }
}

function drawTopDecor(ctx: Ctx, L: Layout, awningH: number, rnd: () => number) {
  const gapTop = awningH + 22;
  const gap = L.table.y - gapTop;
  // 전구 줄
  const y0 = awningH + 26;
  const yAt = (x: number) => y0 + 10 * Math.sin((x / L.LW) * Math.PI * 3) ** 2;
  ctx.strokeStyle = '#7a5a48';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let x = 0; x <= L.LW; x += 8) {
    if (x === 0) ctx.moveTo(x, yAt(x));
    else ctx.lineTo(x, yAt(x));
  }
  ctx.stroke();
  for (let x = 18, k = 0; x < L.LW; x += 36, k++) {
    const y = yAt(x) + 6;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 14);
    glow.addColorStop(0, 'rgba(255,240,180,0.7)');
    glow.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = glow;
    circle(ctx, x, y, 14);
    ctx.fill();
    ctx.fillStyle = k % 3 === 0 ? '#ffd166' : k % 3 === 1 ? '#ffe9a8' : '#fff4d6';
    ctx.beginPath();
    ctx.ellipse(x, y, 4, 5.5, 0, 0, TAU);
    ctx.fill();
  }

  if (gap < 52) return;
  // 선반 + 진열 디저트
  const shelfY = L.table.y - 8;
  if (gap >= 96) {
    ctx.fillStyle = '#c98b5a';
    roundRect(ctx, L.x0 + 6, shelfY - 6, 438, 9, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(90,45,25,0.15)';
    ctx.fillRect(L.x0 + 10, shelfY + 3, 430, 4);
    const items: [number, (x: number, y: number) => void][] = [
      [L.x0 + 40, (x, y) => cupcake(ctx, x, y, 1, '#ffb3c6')],
      [L.x0 + 85, (x, y) => macaronStack(ctx, x, y, rnd)],
      [L.x0 + 365, (x, y) => cakeStand(ctx, x, y)],
      [L.x0 + 412, (x, y) => cupcake(ctx, x, y, 1, '#c8f2d8')],
    ];
    for (const [x, fn] of items) fn(x, shelfY - 6);
  }
  // 간판
  const sy = gapTop + Math.min(gap - 52, 30) / 2 + (gap >= 96 ? 0 : 4);
  const sw = 196;
  const sx = L.x0 + 225 - sw / 2;
  ctx.strokeStyle = '#8a5a3a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx + 30, sy - 22);
  ctx.lineTo(sx + 30, sy + 4);
  ctx.moveTo(sx + sw - 30, sy - 22);
  ctx.lineTo(sx + sw - 30, sy + 4);
  ctx.stroke();
  ctx.fillStyle = 'rgba(90,45,25,0.18)';
  roundRect(ctx, sx + 2, sy + 4, sw, 44, 14);
  ctx.fill();
  ctx.fillStyle = '#9c6644';
  roundRect(ctx, sx, sy, sw, 44, 14);
  ctx.fill();
  ctx.fillStyle = '#fff7ef';
  roundRect(ctx, sx + 4, sy + 4, sw - 8, 36, 11);
  ctx.fill();
  ctx.font = '25px Jua, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e0587a';
  ctx.fillText('쩜미 케이크샵', L.x0 + 225, sy + 23);
}

// ───── 진열 디저트 ─────

function cupcake(ctx: Ctx, x: number, y: number, s: number, frost: string) {
  ctx.fillStyle = '#f7a8b8';
  ctx.beginPath();
  ctx.moveTo(x - 13 * s, y - 20 * s);
  ctx.lineTo(x + 13 * s, y - 20 * s);
  ctx.lineTo(x + 9 * s, y);
  ctx.lineTo(x - 9 * s, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let k = -2; k <= 2; k++) {
    ctx.moveTo(x + k * 5 * s, y - 20 * s);
    ctx.lineTo(x + k * 3.6 * s, y);
  }
  ctx.stroke();
  ctx.fillStyle = frost;
  circle(ctx, x, y - 24 * s, 14 * s);
  ctx.fill();
  circle(ctx, x + 1 * s, y - 33 * s, 10 * s);
  ctx.fill();
  circle(ctx, x + 2 * s, y - 40 * s, 6 * s);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  circle(ctx, x - 5 * s, y - 30 * s, 3 * s);
  ctx.fill();
  ctx.fillStyle = '#e3193a';
  circle(ctx, x + 3 * s, y - 47 * s, 4 * s);
  ctx.fill();
}

function macaronStack(ctx: Ctx, x: number, y: number, rnd: () => number) {
  for (let k = 0; k < 3; k++) {
    const c = PASTELS[Math.floor(rnd() * PASTELS.length)];
    const yy = y - 6 - k * 11;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(x, yy + 2, 14, 5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff8ee';
    ctx.fillRect(x - 12, yy - 2, 24, 3);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(x, yy - 4, 14, 5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(x - 4, yy - 6, 5, 1.6, 0, 0, TAU);
    ctx.fill();
  }
}

function cakeStand(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 3, y - 14, 6, 14);
  ctx.beginPath();
  ctx.ellipse(x, y - 1, 12, 3, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, y - 15, 24, 5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f597ad';
  ctx.fillRect(x - 18, y - 36, 36, 20);
  ctx.beginPath();
  ctx.ellipse(x, y - 16, 18, 4, 0, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#fff6f8';
  ctx.beginPath();
  ctx.ellipse(x, y - 36, 18, 4.5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#e42c48';
  for (let k = -12; k <= 12; k += 8) {
    ctx.beginPath();
    ctx.moveTo(x + k - 3, y - 35);
    ctx.lineTo(x + k + 3, y - 35);
    ctx.lineTo(x + k + 3, y - 28 - (k % 3));
    ctx.arc(x + k, y - 28 - (k % 3), 3, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#e3193a';
  circle(ctx, x, y - 42, 4.5);
  ctx.fill();
}

function jar(ctx: Ctx, x: number, y: number, rnd: () => number) {
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  roundRect(ctx, x - 13, y - 34, 26, 34, 7);
  ctx.fill();
  for (let k = 0; k < 9; k++) {
    ctx.fillStyle = PASTELS[Math.floor(rnd() * PASTELS.length)];
    circle(ctx, x - 7 + (k % 3) * 7, y - 7 - Math.floor(k / 3) * 7, 3.6);
    ctx.fill();
  }
  ctx.fillStyle = '#e0587a';
  roundRect(ctx, x - 15, y - 40, 30, 7, 3);
  ctx.fill();
}

function drawSideShelves(ctx: Ctx, x: number, w: number, y0: number, y1: number, rnd: () => number) {
  if (w < 34) return;
  for (let y = y0 + 110; y < y1; y += 110) {
    ctx.fillStyle = '#c98b5a';
    roundRect(ctx, x, y, w, 9, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(90,45,25,0.15)';
    ctx.fillRect(x + 4, y + 9, w - 8, 4);
    for (let ix = x + 24; ix < x + w - 20; ix += 50) {
      const r = rnd();
      if (r < 0.3) cupcake(ctx, ix, y, 0.9, PASTELS[Math.floor(rnd() * PASTELS.length)]);
      else if (r < 0.55) macaronStack(ctx, ix, y, rnd);
      else if (r < 0.8) jar(ctx, ix, y, rnd);
      else cakeStand(ctx, ix, y);
    }
  }
}

// ───── 테이블 / 컨베이어 ─────

function drawTable(ctx: Ctx, L: Layout, rnd: () => number) {
  const t = L.table;
  ctx.fillStyle = 'rgba(90,45,25,0.2)';
  ctx.beginPath();
  ctx.ellipse(t.x + t.w / 2, t.y + t.h + 52, t.w * 0.48, 14, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#8a5230';
  roundRect(ctx, t.x + 38, t.y + t.h - 6, 30, 58, 6);
  ctx.fill();
  roundRect(ctx, t.x + t.w - 68, t.y + t.h - 6, 30, 58, 6);
  ctx.fill();
  ctx.fillStyle = '#a5683a';
  roundRect(ctx, t.x, t.y + 12, t.w, t.h, 22);
  ctx.fill();
  ctx.fillStyle = '#d1925a';
  roundRect(ctx, t.x, t.y, t.w, t.h, 22);
  ctx.fill();
  const inset = 8;
  const g = ctx.createLinearGradient(0, t.y, 0, t.y + t.h);
  g.addColorStop(0, '#f6d2a2');
  g.addColorStop(1, '#ebb97f');
  ctx.fillStyle = g;
  roundRect(ctx, t.x + inset, t.y + inset, t.w - inset * 2, t.h - inset * 2, 16);
  ctx.fill();
  ctx.save();
  roundRect(ctx, t.x + inset, t.y + inset, t.w - inset * 2, t.h - inset * 2, 16);
  ctx.clip();
  ctx.strokeStyle = 'rgba(170,105,50,0.14)';
  ctx.lineWidth = 1.5;
  for (let k = 0; k < 26; k++) {
    const x = t.x + inset + rnd() * (t.w - inset * 2);
    const y = t.y + rnd() * t.h;
    const len = 40 + rnd() * 90;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + 3, y + len * 0.3, x - 3, y + len * 0.6, x + 1, y + len);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(160,95,45,0.4)';
  ctx.lineWidth = 2.5;
  for (let c = 1; c < COLS; c++) {
    const x = L.gridX + c * CELL_W;
    ctx.beginPath();
    ctx.moveTo(x, t.y);
    ctx.lineTo(x, t.y + t.h);
    ctx.stroke();
  }
  ctx.restore();
  // 접시 놓는 자리: 레이스 페이퍼
  for (let i = 0; i < SLOTS; i++) {
    const c = slotCenter(L, i);
    const R = 42;
    ctx.fillStyle = 'rgba(170,105,50,0.18)';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 3, R, R * TILT, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    for (let k = 0; k <= 36; k++) {
      const a = (k / 36) * TAU;
      const rr = R + (k % 2 ? -2.5 : 1.5);
      const px = c.x + Math.cos(a) * rr;
      const py = c.y + Math.sin(a) * rr * TILT;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,252,247,0.72)';
    ctx.fill();
    ctx.fillStyle = 'rgba(214,170,130,0.45)';
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * TAU;
      ctx.beginPath();
      ctx.ellipse(c.x + Math.cos(a) * R * 0.8, c.y + Math.sin(a) * R * 0.8 * TILT, 1.8, 1.2, 0, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(214,170,130,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, R * 0.62, R * 0.62 * TILT, 0, 0, TAU);
    ctx.stroke();
  }
}

function drawBelt(ctx: Ctx, L: Layout) {
  const b = L.belt;
  ctx.fillStyle = 'rgba(90,45,25,0.16)';
  roundRect(ctx, b.x, b.y + 7, b.w, b.h, 58);
  ctx.fill();
  ctx.fillStyle = '#4fbfab';
  roundRect(ctx, b.x, b.y, b.w, b.h, 58);
  ctx.fill();
  ctx.fillStyle = '#a3eadd';
  roundRect(ctx, b.x + 9, b.y + 9, b.w - 18, b.h - 18, 49);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 3;
  roundRect(ctx, b.x + 3, b.y + 3, b.w - 6, b.h - 6, 55);
  ctx.stroke();
  ctx.fillStyle = '#d8faf3';
  for (const x of [b.x + 30, b.x + b.w - 30]) {
    circle(ctx, x, b.y + b.h / 2, 7);
    ctx.fill();
  }
}

/** 컨베이어 위를 왼쪽으로 흘러가는 화살표 (매 프레임) */
export function drawBeltArrows(ctx: Ctx, L: Layout, time: number) {
  const b = L.belt;
  const ix = b.x + 9;
  const iy = b.y + 9;
  const iw = b.w - 18;
  const ih = b.h - 18;
  ctx.save();
  roundRect(ctx, ix, iy, iw, ih, 49);
  ctx.clip();
  const seam = 36;
  const so = (time * 36) % seam;
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = ix - so; x < ix + iw + seam; x += seam) {
    ctx.moveTo(x, iy);
    ctx.lineTo(x, iy + ih);
  }
  ctx.stroke();
  const gap = 72;
  const off = (time * 36) % gap;
  const cy = iy + ih * 0.5;
  ctx.fillStyle = 'rgba(30,130,110,0.3)';
  for (let x = ix + 36 - off; x < ix + iw + gap; x += gap) {
    ctx.beginPath();
    ctx.moveTo(x - 11, cy);
    ctx.lineTo(x + 10, cy - 13);
    ctx.lineTo(x + 10, cy + 13);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
