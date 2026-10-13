import { angleDiff, drawCake, drawMovingSlice, drawPlate, TILT } from './cake';
import { CONVEYOR_SLOTS, ROWS, COLS, SLOTS } from './config';
import { circle, easeInOut, easeOutBack, easeOutCubic, roundRect, TAU } from './draw';
import type { Game, Plate } from './game';
import { conveyorPos, slotCenter, type Layout } from './layout';
import { drawBeltArrows } from './scene';

type Ctx = CanvasRenderingContext2D;

/** crisp: 크게 키워 보이는 순간에도 픽셀이 깨지지 않게 캐시 이미지 대신 새로 그린다 */
function plateAt(ctx: Ctx, p: Plate, x: number, y: number, s: number, lift = 0, crisp = false) {
  drawPlate(ctx, x, y, s, lift, crisp);
  drawCake(ctx, x, y, s, p.slices, p.rot, crisp);
}

function slotGlow(ctx: Ctx, L: Layout, i: number, alpha: number) {
  const c = slotCenter(L, i);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(255,248,205,0.55)';
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, 45, 45 * TILT, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#fff7c8';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

function star(ctx: Ctx, x: number, y: number, r: number, rot: number) {
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = rot + (k * Math.PI) / 4;
    const rr = k % 2 ? r * 0.35 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

export function renderFrame(ctx: Ctx, L: Layout, g: Game, bg: HTMLCanvasElement, time: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(bg, 0, 0);
  const S = L.dpr * L.u;
  ctx.setTransform(S, 0, 0, S, 0, 0);

  drawBeltArrows(ctx, L, time);

  const d = g.drag;
  if (d && d.hover >= 0) slotGlow(ctx, L, d.hover, 1);
  else if (g.selected !== null) {
    const a = 0.55 + 0.3 * Math.sin(time * 6);
    for (let i = 0; i < SLOTS; i++) if (!g.board[i]) slotGlow(ctx, L, i, a);
  }

  // 테이블 접시 (위 줄부터 그려야 아래 줄 케이크가 앞에 온다)
  for (let i = 0; i < SLOTS; i++) {
    const p = g.board[i];
    if (!p) continue;
    const s = easeOutBack(Math.max(0, p.pop));
    if (s <= 0.01) continue;
    const c = slotCenter(L, i);
    plateAt(ctx, p, c.x + p.ox, c.y + p.oy, s);
  }

  // 놓일 자리 미리보기
  if (d && d.hover >= 0) {
    const p = g.conveyor[d.ci];
    if (p) {
      const c = slotCenter(L, d.hover);
      ctx.globalAlpha = 0.4;
      plateAt(ctx, p, c.x, c.y, 1);
      ctx.globalAlpha = 1;
    }
  }

  // 완성 / 빈 접시 사라짐
  for (const e of g.effects) {
    const t = Math.min(1, e.t / e.dur);
    const c = slotCenter(L, e.slot);
    if (e.kind === 'vanish') {
      ctx.globalAlpha = 1 - t;
      drawPlate(ctx, c.x, c.y, Math.max(0.01, 1 - easeOutCubic(t)));
      ctx.globalAlpha = 1;
      continue;
    }
    // 잠깐 커졌다가 → 쏙 줄어들며 사라짐
    let s: number;
    let dy: number;
    let a = 1;
    if (t < 0.35) {
      const k = t / 0.35;
      s = 1 + 0.28 * easeOutBack(k);
      dy = -12 * easeOutCubic(k);
    } else {
      const k = (t - 0.35) / 0.65;
      s = 1.28 * (1 - k * k * k);
      dy = -12 - 14 * k;
      a = 1 - k * 0.6;
    }
    if (t > 0.25 && t < 0.6) {
      const k = (t - 0.25) / 0.35;
      ctx.fillStyle = `rgba(255,255,230,${0.55 * Math.sin(k * Math.PI)})`;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y - 14, 70, 70 * TILT, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = Math.max(0, a);
    plateAt(ctx, e.plate, c.x, c.y + dy, Math.max(0.01, s), 0, !e.sweep);
    ctx.globalAlpha = 1;
  }

  // 컨베이어 접시
  for (let i = 0; i < CONVEYOR_SLOTS; i++) {
    const p = g.conveyor[i];
    if (!p || (d && d.ci === i)) continue;
    const c = conveyorPos(L, i);
    const x = c.x + p.ox;
    const y = c.y + p.oy - p.lift * 16;
    const s = easeOutBack(Math.max(0, p.pop));
    if (s <= 0.01) continue;
    if (p.lift > 0.02) {
      ctx.save();
      ctx.globalAlpha = p.lift * (0.75 + 0.25 * Math.sin(time * 6));
      ctx.strokeStyle = '#fff3a6';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(x, c.y + p.oy + 4, 54, 54 * TILT, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    plateAt(ctx, p, x, y, s, p.lift * 0.6);
  }

  // 접시 사이를 직선으로 미끄러지는 조각: 출발 자리에서 도착 접시의 제자리까지, 각도도 같이 맞춰 간다
  for (const f of g.flyers) {
    const t = Math.min(1, f.t / f.dur);
    const e = easeInOut(t);
    const dst = g.board[f.to];
    const b = slotCenter(L, f.to);
    const x1 = b.x + (dst?.ox ?? 0);
    const y1 = b.y + (dst?.oy ?? 0);
    const a1 = f.slice.ang;
    const ang = f.a0 + angleDiff(a1, f.a0) * e;
    drawMovingSlice(ctx, f.x0 + (x1 - f.x0) * e, f.y0 + (y1 - f.y0) * e, 1, f.flavor, ang);
  }

  // 들고 있는 접시
  if (d) {
    const p = g.conveyor[d.ci];
    if (p) plateAt(ctx, p, d.x + d.gx, d.y + d.gy - d.liftCur, 1.06, Math.min(1, d.liftCur / 30), true);
  }

  // 파티클
  for (const p of g.particles) {
    ctx.globalAlpha = Math.min(1, (1 - p.t / p.life) * 1.6);
    ctx.fillStyle = p.color;
    if (p.shape === 0) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
      ctx.restore();
    } else if (p.shape === 1) {
      circle(ctx, p.x, p.y, p.size * 0.45);
      ctx.fill();
    } else {
      star(ctx, p.x, p.y, p.size * 1.1, p.rot);
    }
  }
  ctx.globalAlpha = 1;
  for (const r of g.rings) {
    const t = r.t / r.dur;
    const rad = 30 + 55 * easeOutCubic(t);
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7 * (1 - t) + 1;
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, rad, rad * TILT, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 점수 팝업
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const p of g.popups) {
    const t = p.t / p.dur;
    const s = t < 0.18 ? easeOutBack(t / 0.18) : 1;
    ctx.save();
    ctx.translate(p.x, p.y - 40 * easeOutCubic(t));
    ctx.scale(s, s);
    ctx.globalAlpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
    ctx.font = `${p.size}px Jua, sans-serif`;
    ctx.lineWidth = p.size * 0.24;
    ctx.strokeStyle = '#8a4317';
    ctx.strokeText(p.text, 0, 0);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, 0, 0);
    ctx.restore();
  }

  if (!g.placedOnce && !d && !g.over && g.selected === null) drawHint(ctx, L, g, time);
}

/** 첫 배치 전까지 보여주는 손가락 튜토리얼 */
function drawHint(ctx: Ctx, L: Layout, g: Game, time: number) {
  let target = -1;
  for (let r = ROWS - 1; r >= 0 && target < 0; r--) {
    for (const c of [1, 2, 0, 3]) {
      const i = r * COLS + c;
      if (!g.board[i]) { target = i; break; }
    }
  }
  if (target < 0) return;
  const from = conveyorPos(L, 1);
  const to = slotCenter(L, target);
  const t = (time % 2.2) / 2.2;
  let k: number;
  let a = 1;
  if (t < 0.15) { k = 0; a = t / 0.15; }
  else if (t < 0.75) k = easeInOut((t - 0.15) / 0.6);
  else { k = 1; a = 1 - (t - 0.75) / 0.25; }
  const x = from.x + (to.x - from.x) * k;
  const y = from.y + (to.y - from.y) * k;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = '46px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('👆', x + 8, y);
  ctx.restore();

  const msg = '접시를 끌어서 테이블에 올려요!';
  ctx.font = '17px Jua, sans-serif';
  const w = ctx.measureText(msg).width + 32;
  const bx = L.x0 + 225 - w / 2;
  const by = L.belt.y - 22;
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  roundRect(ctx, bx, by, w, 34, 17);
  ctx.fill();
  ctx.fillStyle = '#7a4220';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(msg, L.x0 + 225, by + 18);
}
