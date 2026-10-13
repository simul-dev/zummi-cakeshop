import { haptic, sfx } from './audio';
import { angleDiff, STEP, targetRot, type Slice } from './cake';
import { CONFIG, CONVEYOR_SLOTS, COLS, MAX_SLICES, ROWS, SLOTS, STAGES, type StageDef } from './config';
import { TAU } from './draw';
import { FLAVORS } from './flavors';
import { CELL_H, CELL_W, conveyorPos, slotCenter, type Layout } from './layout';

export interface Plate {
  id: number;
  /** 같은 맛끼리 붙어 있도록 정렬된 조각 목록 (최대 6). 각 조각은 자기 각도를 부드럽게 따라간다. */
  slices: Slice[];
  /** 원래 자리에서 벗어난 렌더 오프셋. 매 프레임 0으로 수렴 → 미끄러지는 애니메이션 */
  ox: number;
  oy: number;
  /** 접시 회전 (조각 수가 바뀌면 빈 자리가 앞을 보도록 부드럽게 돌아감) */
  rot: number;
  /** 등장 팝 진행도 0..1 (음수면 대기) */
  pop: number;
  /** 컨베이어에서 탭 선택되어 들린 정도 0..1 */
  lift: number;
  /** 방금 플레이어가 놓은 접시 (합칠 때 기존 접시 쪽을 우선하기 위해) */
  fresh: boolean;
}

/** 접시에서 접시로 직선으로 미끄러져 가는 조각 */
export interface Flyer {
  flavor: number;
  from: number;
  to: number;
  /** 출발 지점(접시 중심)과 출발 각도 */
  x0: number;
  y0: number;
  a0: number;
  /** 도착 접시에 미리 끼워 둔 자리 (도착할 때까지 안 보임). 각도는 접시가 돌면 같이 바뀐다. */
  slice: Slice;
  t: number;
  dur: number;
  done: () => void;
}
export interface Effect { kind: 'complete' | 'vanish'; plate: Plate; slot: number; t: number; dur: number; }
export interface Particle {
  x: number; y: number; vx: number; vy: number; t: number; life: number;
  color: string; size: number; rot: number; vr: number; shape: 0 | 1 | 2;
}
export interface Popup { text: string; x: number; y: number; t: number; dur: number; size: number; color: string; }
export interface Ring { x: number; y: number; t: number; dur: number; }
export interface Drag {
  ci: number; pointerId: number;
  /** 누른 지점 */
  sx: number; sy: number;
  /** 현재 포인터 */
  x: number; y: number;
  /** 잡은 위치 오프셋 (0으로 수렴 → 접시가 손가락 쪽으로 붙음) */
  gx: number; gy: number;
  /** 손가락에 가리지 않도록 접시를 위로 띄우는 양 */
  lift: number; liftCur: number;
  moved: boolean;
  hover: number;
}
export type EndKind = 'clear' | 'allclear' | 'fail';

interface Move { flavor: number; target: number; sources: { idx: number; count: number }[]; }
interface Timer { t: number; fn: () => void; }

const rand = Math.random;
const randInt = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const unique = (s: number[]) => [...new Set(s)];
/** 접시의 맛 목록 */
export const flavorsOf = (p: Plate) => p.slices.map((s) => s.f);
const countOf = (p: Plate, f: number) => p.slices.reduce((a, s) => a + (s.f === f ? 1 : 0), 0);
const has = (p: Plate, f: number) => p.slices.some((s) => s.f === f);

function weighted(ws: number[]): number {
  let r = rand() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ws.length; i++) {
    r -= ws[i];
    if (r < 0) return i;
  }
  return ws.length - 1;
}

function weightedPick(items: number[], weight: (x: number) => number): number {
  return items[weighted(items.map(weight))];
}

/** n조각을 주어진 맛들에 최소 1개씩 나눠 담는다 */
function distribute(n: number, flavors: number[]): number[] {
  const counts = flavors.map(() => 1);
  for (let i = flavors.length; i < n; i++) counts[Math.floor(rand() * flavors.length)]++;
  return flavors.flatMap((f, i) => Array<number>(counts[i]).fill(f));
}

function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** 두 칸이 변을 맞대고 있는지 (대각선은 아님) */
function adjacent(a: number, b: number): boolean {
  const dr = Math.abs(((a / COLS) | 0) - ((b / COLS) | 0));
  const dc = Math.abs((a % COLS) - (b % COLS));
  return dr + dc === 1;
}

let plateId = 1;
function makePlate(flavors: number[]): Plate {
  const grouped = unique(flavors).flatMap((f) => flavors.filter((x) => x === f));
  const rot = targetRot(grouped.length);
  return {
    id: plateId++,
    slices: grouped.map((f, j) => ({ f, ang: rot + j * STEP, vis: true })),
    ox: 0, oy: 0, rot, pop: 1, lift: 0, fresh: false,
  };
}

/** 같은 맛 무리 끝에 조각을 끼운다 (아직 안 보이는 상태로). 뒤 조각들은 자리를 비켜 준다. */
function insertSlice(p: Plate, f: number): Slice {
  let j = -1;
  for (let i = p.slices.length - 1; i >= 0; i--) if (p.slices[i].f === f) { j = i; break; }
  const at = j < 0 ? p.slices.length : j + 1;
  const s: Slice = { f, ang: p.rot + at * STEP, vis: false };
  p.slices.splice(at, 0, s);
  return s;
}

/** 같은 맛 무리의 마지막 조각을 뺀다. 남은 조각들은 빈틈을 메우러 움직인다. */
function takeSlice(p: Plate, f: number): Slice | null {
  for (let i = p.slices.length - 1; i >= 0; i--) {
    if (p.slices[i].f === f) return p.slices.splice(i, 1)[0];
  }
  return null;
}

export class Game {
  layout!: Layout;
  board: (Plate | null)[] = [];
  conveyor: (Plate | null)[] = [];
  flyers: Flyer[] = [];
  effects: Effect[] = [];
  particles: Particle[] = [];
  popups: Popup[] = [];
  rings: Ring[] = [];
  drag: Drag | null = null;
  selected: number | null = null;
  stage = 1;
  score = 0;
  best = 0;
  over = false;
  placedOnce = false;
  onScore?: (score: number, gained: number) => void;
  onEnd?: (kind: EndKind, newBest: boolean) => void;

  private bestAtStart = 0;
  private timers: Timer[] = [];
  private dirty: number[] = [];
  private processing = false;
  /** reset 시 증가 → 진행 중이던 비동기 연쇄를 끊는다 */
  private gen = 0;
  private combo = 0;
  /** 이 단계 목표 케이크 수 / 지금까지 완성한 수 */
  private cakesTotal = 0;
  private cakesDone = 0;

  constructor() {
    try { this.best = Number(localStorage.getItem('zummi.best')) || 0; } catch { /* 저장소 없음 */ }
  }

  get def(): StageDef {
    return STAGES[Math.min(this.stage, STAGES.length) - 1];
  }

  /** 처음부터 (1단계, 점수 0) */
  restart() {
    this.stage = 1;
    this.score = 0;
    this.bestAtStart = this.best;
    this.startStage();
  }

  nextStage() {
    if (this.stage >= STAGES.length) return;
    this.stage++;
    this.startStage();
  }

  private startStage() {
    this.gen++;
    this.board = Array<Plate | null>(SLOTS).fill(null);
    this.conveyor = Array<Plate | null>(CONVEYOR_SLOTS).fill(null);
    this.flyers = [];
    this.effects = [];
    this.particles = [];
    this.popups = [];
    this.rings = [];
    this.timers = [];
    this.dirty = [];
    this.processing = false;
    this.drag = null;
    this.selected = null;
    this.combo = 0;
    this.over = false;

    const def = this.def;
    this.cakesTotal = def.cakes;
    this.cakesDone = 0;

    // 시작할 때만 테이블 랜덤 슬롯에 접시를 깐다. 이후로는 절대 저절로 생기지 않는다.
    for (let k = 0; k < def.plates; k++) {
      const i = this.spawnInitialPlate(def);
      if (i >= 0) this.board[i]!.pop = -k * 0.08;
    }
    const L = this.layout;
    this.fillConveyor();
    this.conveyor.forEach((p, i) => { if (p) p.ox = L.LW + 80 + i * 120 - L.convX[i]; });
    if (this.dirty.length) this.after(1.0, () => void this.process());
    const cy = L.table.y + L.table.h * 0.42;
    this.popups.push({ text: `${this.stage}단계`, x: L.x0 + 225, y: cy, t: 0, dur: 1.5, size: 48, color: '#ffffff' });
    this.popups.push({ text: `케이크 ${def.cakes}개 · ${def.flavors}종`, x: L.x0 + 225, y: cy + 46, t: 0, dur: 1.5, size: 22, color: '#ffe066' });
    this.onScore?.(this.score, 0);
  }

  /** 이 단계에서 아직 완성하지 못한 케이크 수 */
  remainingCakes(): number {
    return this.cakesTotal - this.cakesDone;
  }

  // ───────────────────────── 시간/타이머 ─────────────────────────

  private after(sec: number, fn: () => void) {
    this.timers.push({ t: sec, fn });
  }

  private wait(sec: number) {
    return new Promise<void>((res) => this.after(sec, res));
  }

  update(dt: number) {
    if (this.timers.length) {
      const due: Timer[] = [];
      this.timers = this.timers.filter((t) => {
        t.t -= dt;
        if (t.t <= 0) { due.push(t); return false; }
        return true;
      });
      for (const t of due) t.fn();
    }
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i];
      f.t += dt;
      if (f.t >= f.dur) {
        this.flyers.splice(i, 1);
        f.done();
      }
    }
    this.effects = this.effects.filter((e) => (e.t += dt) < e.dur);
    for (const p of this.particles) {
      p.t += dt;
      p.vy += 900 * dt;
      p.vx *= 1 - 1.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.particles = this.particles.filter((p) => p.t < p.life);
    this.popups = this.popups.filter((p) => (p.t += dt) < p.dur);
    this.rings = this.rings.filter((r) => (r.t += dt) < r.dur);

    const kBoard = 1 - Math.exp(-dt * 20);
    const kBelt = 1 - Math.exp(-dt * 9);
    const kRot = 1 - Math.exp(-dt * 12);
    const kFast = 1 - Math.exp(-dt * 18);
    for (const p of this.board) if (p) this.settle(p, kBoard, kRot, dt);
    this.conveyor.forEach((p, i) => {
      if (!p) return;
      this.settle(p, kBelt, kRot, dt);
      p.lift += ((this.selected === i ? 1 : 0) - p.lift) * kFast;
    });

    const d = this.drag;
    if (d) {
      d.gx -= d.gx * kFast;
      d.gy -= d.gy * kFast;
      d.liftCur += (d.lift - d.liftCur) * kFast;
      const hover = d.moved ? this.dropSlotAt(d.x + d.gx, d.y + d.gy - d.liftCur) : -1;
      if (hover !== d.hover && hover >= 0) haptic(4);
      d.hover = hover;
    }
  }

  private settle(p: Plate, k: number, kRot: number, dt: number) {
    p.ox -= p.ox * k;
    p.oy -= p.oy * k;
    if (Math.abs(p.ox) < 0.05) p.ox = 0;
    if (Math.abs(p.oy) < 0.05) p.oy = 0;
    const tr = targetRot(p.slices.length);
    const dr = angleDiff(tr, p.rot);
    p.rot = Math.abs(dr) < 0.002 ? tr : p.rot + dr * kRot;
    // 조각마다 제자리(회전 + 순서)로 부드럽게. 아직 도착 안 한 조각은 자리를 정확히 잡고 기다린다.
    p.slices.forEach((s, j) => {
      const target = p.rot + j * STEP;
      if (!s.vis) { s.ang = target; return; }
      const da = angleDiff(target, s.ang);
      s.ang = Math.abs(da) < 0.002 ? target : s.ang + da * kRot;
    });
    if (p.pop < 1) p.pop = Math.min(1, p.pop + dt / 0.4);
  }

  // ───────────────────────── 입력 (드래그/탭) ─────────────────────────

  conveyorHit(x: number, y: number): number {
    for (let i = 0; i < CONVEYOR_SLOTS; i++) {
      const p = this.conveyor[i];
      if (!p) continue;
      const c = conveyorPos(this.layout, i);
      const px = c.x + p.ox;
      const py = c.y + p.oy - p.lift * 16;
      if (Math.abs(x - px) < 68 && y > py - 86 && y < py + 52) return i;
    }
    return -1;
  }

  /** 접시 중심 기준 가장 가까운 빈 슬롯 (너무 멀면 -1) */
  dropSlotAt(x: number, y: number): number {
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < SLOTS; i++) {
      if (this.board[i]) continue;
      const c = slotCenter(this.layout, i);
      const dx = (x - c.x) / CELL_W;
      const dy = (y - c.y) / CELL_H;
      const dd = dx * dx + dy * dy;
      if (dd < bd) { bd = dd; best = i; }
    }
    return bd < 0.75 * 0.75 ? best : -1;
  }

  /** 탭으로 고른 빈 슬롯 */
  slotTap(x: number, y: number): number {
    for (let i = 0; i < SLOTS; i++) {
      if (this.board[i]) continue;
      const c = slotCenter(this.layout, i);
      const dx = (x - c.x) / CELL_W;
      const dy = (y - c.y) / CELL_H;
      if (dx * dx + dy * dy < 0.5 * 0.5) return i;
    }
    return -1;
  }

  startDrag(ci: number, pointerId: number, x: number, y: number, lift: number) {
    const p = this.conveyor[ci];
    if (!p || this.over) return;
    const c = conveyorPos(this.layout, ci);
    const px = c.x + p.ox;
    const py = c.y + p.oy - p.lift * 16;
    this.drag = { ci, pointerId, sx: x, sy: y, x, y, gx: px - x, gy: py - y, lift, liftCur: 0, moved: false, hover: -1 };
    sfx.pick();
    haptic(6);
  }

  moveDrag(x: number, y: number) {
    const d = this.drag;
    if (!d) return;
    d.x = x;
    d.y = y;
    if (!d.moved && Math.hypot(x - d.sx, y - d.sy) > 7) d.moved = true;
  }

  endDrag(cancel = false) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    const p = this.conveyor[d.ci];
    if (!p) return;
    const rx = d.x + d.gx;
    const ry = d.y + d.gy - d.liftCur;
    if (!cancel && d.moved && !this.over) {
      // 아주 빠르게 튕겨 놓으면 프레임 갱신 전에 손을 뗄 수 있어 최종 목표 위치로도 한 번 더 찾는다
      let slot = this.dropSlotAt(rx, ry);
      if (slot < 0) slot = this.dropSlotAt(d.x, d.y - d.lift);
      if (slot >= 0) {
        this.selected = null;
        this.place(d.ci, slot, rx, ry);
        return;
      }
    }
    // 그냥 탭이면 선택 토글 (선택 후 빈 슬롯을 탭해서 놓을 수도 있음)
    if (!d.moved && !cancel) this.selected = this.selected === d.ci ? null : d.ci;
    else this.selected = null;
    if (d.moved) sfx.cancel();
    const c = conveyorPos(this.layout, d.ci);
    p.lift = this.selected === d.ci ? 1 : 0;
    p.ox = rx - c.x;
    p.oy = ry - c.y + p.lift * 16;
  }

  placeSelected(slot: number) {
    const ci = this.selected;
    if (ci === null || this.board[slot] || this.over) return;
    const p = this.conveyor[ci];
    if (!p) return;
    const c = conveyorPos(this.layout, ci);
    this.selected = null;
    this.place(ci, slot, c.x + p.ox, c.y + p.oy - p.lift * 16);
  }

  private place(ci: number, slot: number, px: number, py: number) {
    const plate = this.conveyor[ci]!;
    const L = this.layout;
    // 오른쪽 접시들이 한 칸씩 왼쪽으로 밀려온다
    for (let j = ci; j < CONVEYOR_SLOTS - 1; j++) {
      const p = this.conveyor[j + 1];
      this.conveyor[j] = p;
      if (p) p.ox += L.convX[j + 1] - L.convX[j];
    }
    this.conveyor[CONVEYOR_SLOTS - 1] = null;
    this.selected = null;

    const c = slotCenter(L, slot);
    plate.ox = px - c.x;
    plate.oy = py - c.y;
    plate.lift = 0;
    plate.fresh = true;
    this.board[slot] = plate;
    this.placedOnce = true;

    // 새 접시는 놓인 뒤의 테이블 상태를 보고 만든다
    this.fillConveyor();

    sfx.place();
    haptic(12);
    this.dirty.push(slot);
    void this.process();
  }

  // ───────────────────────── 합치기 / 완성 ─────────────────────────

  private neighbors(i: number): number[] {
    const c = i % COLS;
    const r = (i / COLS) | 0;
    const out: number[] = [];
    if (c > 0) out.push(i - 1);
    if (c < COLS - 1) out.push(i + 1);
    if (r > 0) out.push(i - COLS);
    if (r < ROWS - 1) out.push(i + COLS);
    return out.filter((n) => this.board[n]);
  }

  /**
   * idx 접시와 상하좌우 이웃 사이에서 가장 좋은 이동 하나를 고른다.
   * 같은 맛 조각을 가장 많이 모을 수 있는 접시로 모으고,
   * 동점이면 원래 테이블에 있던 접시 → 다른 맛이 덜 섞인 접시 순으로 우선한다.
   */
  private findMove(idx: number): Move | null {
    const p = this.board[idx];
    if (!p) return null;
    let best: Move | null = null;
    let bestScore = -Infinity;
    for (const f of unique(flavorsOf(p))) {
      const group = [idx, ...this.neighbors(idx).filter((n) => has(this.board[n]!, f))];
      if (group.length < 2) continue;
      for (const t of group) {
        const T = this.board[t]!;
        const have = countOf(T, f);
        const free = MAX_SLICES - T.slices.length;
        // 조각은 변을 맞댄(상하좌우) 접시끼리만 옮긴다. 대각선이나 한 칸 건너 접시에서 직접 가져오지 않는다.
        const others = group
          .filter((g) => g !== t && adjacent(g, t))
          .map((g) => ({ idx: g, have: countOf(this.board[g]!, f) }))
          .sort((a, b) => a.have - b.have);
        const avail = others.reduce((a, o) => a + o.have, 0);
        const gain = Math.min(free, avail);
        if (gain <= 0) continue;
        let need = gain;
        // 같은 맛의 '뭉침 정도'(접시별 개수 제곱합)가 늘어나는 이동만 허용한다.
        // 매 이동마다 이 값이 엄격히 커지므로 조각이 두 접시 사이를 왔다 갔다 할 수 없다.
        let delta = (have + gain) ** 2 - have ** 2;
        const sources: Move['sources'] = [];
        for (const o of others) {
          if (!need) break;
          const c = Math.min(o.have, need);
          sources.push({ idx: o.idx, count: c });
          delta -= o.have ** 2 - (o.have - c) ** 2;
          need -= c;
        }
        if (delta <= 0) continue;
        const otherKinds = unique(flavorsOf(T)).filter((x) => x !== f).length;
        const score = (have + gain) * 100 + (T.fresh ? 0 : 50) - otherKinds * 10;
        if (score > bestScore) {
          bestScore = score;
          best = { flavor: f, target: t, sources };
        }
      }
    }
    return best;
  }

  private async process() {
    if (this.processing || this.over) return;
    this.processing = true;
    const gen = this.gen;
    this.combo = 0;
    let steps = 0;
    while (gen === this.gen && this.dirty.length) {
      if (++steps > 200) {
        this.dirty.length = 0;
        break;
      }
      const idx = this.dirty.shift()!;
      const move = this.findMove(idx);
      if (!move) continue;
      await this.execMove(move);
      if (gen !== this.gen) return;

      const touched = [move.target, ...move.sources.map((s) => s.idx)];
      let completed = false;
      for (const i of touched) {
        const p = this.board[i];
        if (!p) continue;
        if (!p.slices.length) {
          this.board[i] = null;
          this.effects.push({ kind: 'vanish', plate: p, slot: i, t: 0, dur: 0.22 });
        } else if (p.slices.length === MAX_SLICES && p.slices.every((s) => s.f === p.slices[0].f)) {
          this.complete(i);
          completed = true;
        }
      }
      // 바뀐 접시들은 다른 맛도 이웃과 합쳐질 수 있으니 다시 검사
      this.dirty = unique([idx, ...touched, ...this.dirty]).filter((i) => this.board[i]);
      if (completed) await this.wait(0.3);
    }
    if (gen !== this.gen) return;
    this.processing = false;
    for (const p of this.board) if (p) p.fresh = false;

    // 목표 케이크를 다 만들면 클리어 (남은 케이크는 축하하며 전부 치운다). 테이블이 꽉 차면 실패.
    if (this.cakesDone >= this.cakesTotal) this.stageClear();
    else if (!this.board.includes(null)) this.fail();
  }

  private execMove(m: Move): Promise<void> {
    const jobs: Promise<void>[] = [];
    let k = 0;
    for (const s of m.sources) {
      for (let i = 0; i < s.count; i++) {
        jobs.push(this.slideSlice(s.idx, m.target, m.flavor, k * 0.09, k));
        k++;
      }
    }
    return Promise.all(jobs).then(() => undefined);
  }

  /**
   * 조각 하나를 from 접시에서 to 접시로 직선으로 옮긴다.
   * 출발할 때 도착 접시에 자리를 미리 끼워 두므로, 가는 동안 도착 접시의 조각들이 비켜서고
   * 접시가 돌아도 조각은 정확히 그 자리에 가서 멈춘다.
   */
  private slideSlice(from: number, to: number, f: number, delay: number, k: number): Promise<void> {
    return new Promise((resolve) => {
      this.after(delay, () => {
        const src = this.board[from];
        const dst = this.board[to];
        if (!src || !dst) { resolve(); return; }
        const taken = takeSlice(src, f);
        if (!taken) { resolve(); return; }
        const seat = insertSlice(dst, f);
        const c = slotCenter(this.layout, from);
        sfx.slide(k);
        this.flyers.push({
          flavor: f, from, to,
          x0: c.x + src.ox, y0: c.y + src.oy, a0: taken.ang,
          slice: seat, t: 0, dur: 0.32,
          done: () => {
            seat.vis = true;
            sfx.settle();
            resolve();
          },
        });
      });
    });
  }

  private complete(i: number) {
    const p = this.board[i]!;
    this.board[i] = null;
    this.combo++;
    this.cakesDone++;
    const gained = CONFIG.pointsPerCake * this.combo;
    this.effects.push({ kind: 'complete', plate: p, slot: i, t: 0, dur: 0.55 });
    const c = slotCenter(this.layout, i);
    const color = FLAVORS[p.slices[0].f].accent;
    this.after(0.18, () => this.burst(c.x, c.y - 24, color, 28));
    const px = Math.min(Math.max(c.x, this.layout.x0 + 70), this.layout.x0 + 380);
    this.popups.push({ text: `+${gained}`, x: px, y: c.y - 44, t: 0, dur: 1.0, size: 32, color: '#ffffff' });
    if (this.combo >= 2) {
      this.popups.push({ text: `콤보 x${this.combo}!`, x: px, y: c.y - 82, t: 0, dur: 1.1, size: 26, color: '#ffe066' });
    }
    sfx.complete(this.combo);
    haptic(this.combo >= 2 ? 40 : 25);
    this.addScore(gained);
  }

  private burst(x: number, y: number, color: string, count: number) {
    const palette = ['#ffffff', color, '#ffd84d', '#ff8fb1', '#9be7d8'];
    for (let k = 0; k < count; k++) {
      const a = rand() * TAU;
      const sp = 140 + rand() * 280;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.8 - 170,
        t: 0,
        life: 0.6 + rand() * 0.5,
        color: k < 8 ? color : pick(palette),
        size: 4 + rand() * 5,
        rot: rand() * TAU,
        vr: (rand() - 0.5) * 14,
        shape: k % 5 === 0 ? 2 : ((k % 2) as 0 | 1),
      });
    }
    this.rings.push({ x, y: y + 18, t: 0, dur: 0.45 });
  }

  private addScore(n: number) {
    this.score += n;
    if (this.score > this.best) {
      this.best = this.score;
      try { localStorage.setItem('zummi.best', String(this.best)); } catch { /* 저장소 없음 */ }
    }
    this.onScore?.(this.score, n);
  }

  private stageClear() {
    this.over = true;
    this.drag = null;
    this.selected = null;
    const L = this.layout;
    const bonus = CONFIG.clearBonus * this.stage;
    const last = this.stage >= STAGES.length;
    // 테이블에 남은 케이크도 하나씩 톡톡 터지며 치워진다
    let k = 0;
    this.board.forEach((p, i) => {
      if (!p) return;
      this.board[i] = null;
      const c = slotCenter(L, i);
      const color = FLAVORS[p.slices[0]?.f ?? 0].accent;
      this.after(k * 0.07, () => {
        this.effects.push({ kind: 'complete', plate: p, slot: i, t: 0, dur: 0.5 });
        this.after(0.16, () => this.burst(c.x, c.y - 24, color, 10));
      });
      k++;
    });
    this.addScore(bonus);
    this.popups.push({ text: last ? '모든 단계 클리어!' : '클리어!', x: L.x0 + 225, y: L.table.y + L.table.h * 0.42, t: 0, dur: 1.8, size: last ? 42 : 56, color: '#ffe066' });
    this.popups.push({ text: `보너스 +${bonus}`, x: L.x0 + 225, y: L.table.y + L.table.h * 0.42 + 56, t: 0, dur: 1.8, size: 26, color: '#ffffff' });
    for (let k = 0; k < (last ? 9 : 5); k++) {
      this.after(k * 0.12, () => this.burst(L.x0 + 60 + rand() * 330, L.table.y + 80 + rand() * (L.table.h - 160), pick(FLAVORS).accent, 22));
    }
    sfx.clear();
    haptic(60);
    this.after(last ? 1.8 : 1.3, () => this.onEnd?.(last ? 'allclear' : 'clear', this.score > this.bestAtStart));
  }

  private fail() {
    this.over = true;
    this.drag = null;
    this.selected = null;
    sfx.over();
    haptic(80);
    this.after(0.7, () => this.onEnd?.('fail', this.score > this.bestAtStart));
  }

  // ───────────────────────── 생성 ─────────────────────────

  private boardCounts(): number[] {
    const c = FLAVORS.map(() => 0);
    for (const p of this.board) if (p) for (const s of p.slices) c[s.f]++;
    return c;
  }

  /** 시작 접시: 테이블 빈칸 중 랜덤한 곳에. 아직 테이블에 없는 맛을 먼저 써서 모든 맛이 한 번씩은 깔리게 한다. */
  private spawnInitialPlate(def: StageDef): number {
    const empties = range(SLOTS).filter((i) => !this.board[i]);
    if (!empties.length) return -1;
    const idx = pick(empties);
    // 이웃과 같은 맛을 피해서 시작하자마자 합쳐지지 않게
    const avoid = new Set<number>();
    for (const n of this.neighbors(idx)) for (const s of this.board[n]!.slices) avoid.add(s.f);
    const B = this.boardCounts();
    const active = range(def.flavors);
    let pool = active.filter((f) => !avoid.has(f));
    if (!pool.length) pool = active;
    const unseen = pool.filter((f) => B[f] === 0);
    const n = randInt(def.boardSlices[0], def.boardSlices[1]);
    const k = Math.min(pool.length, n, rand() < def.mix ? randInt(2, def.mixKinds) : 1);
    const first = unseen.length ? [pick(unseen)] : [];
    const flavors = [...first, ...shuffle(pool.filter((f) => !first.includes(f)))].slice(0, k);
    const p = makePlate(distribute(n, flavors));
    p.pop = 0;
    this.board[idx] = p;
    if (p.slices.some((s) => avoid.has(s.f))) this.dirty.push(idx);
    return idx;
  }

  /**
   * 컨베이어 접시는 지금 테이블에 있는 맛으로만 만든다.
   * 맛마다 (테이블 + 컨베이어) 조각 수가 6의 배수가 되도록 모자란 만큼을 우선 채우고,
   * 모자란 게 없으면 테이블에 많은 맛으로 케이크 하나 분량(6조각)을 새로 연다.
   * 단, 단계별 help 확률만큼만 이렇게 챙겨 주고 나머지는 테이블의 아무 맛이나 나온다.
   */
  private makeConveyorSlices(): number[] {
    const def = this.def;
    const B = this.boardCounts();
    const C = FLAVORS.map(() => 0);
    for (const p of this.conveyor) if (p) for (const s of p.slices) C[s.f]++;
    let onBoard = range(FLAVORS.length).filter((f) => B[f] > 0);
    // 테이블이 잠깐 비었으면 이 단계의 맛 중에서
    if (!onBoard.length) onBoard = range(def.flavors);
    const need = new Map(onBoard.map((f) => [f, (MAX_SLICES - ((B[f] + C[f]) % MAX_SLICES)) % MAX_SLICES]));
    const size = weighted(def.sizes) + 1;
    const kinds = weighted(def.kinds) + 1;
    const out: number[] = [];
    const chosen: number[] = [];
    while (out.length < size) {
      // 단계가 높을수록 모자란 조각 대신 테이블의 아무 맛이나 나온다
      if (rand() > def.help) {
        const any = onBoard.filter((f) => chosen.includes(f) || chosen.length < kinds);
        const f = pick(any);
        if (!chosen.includes(f)) chosen.push(f);
        out.push(f);
        need.set(f, need.get(f)! > 0 ? need.get(f)! - 1 : MAX_SLICES - 1);
        continue;
      }
      const pool = onBoard.filter((f) => need.get(f)! > 0 && (chosen.includes(f) || chosen.length < kinds));
      if (!pool.length) {
        if (out.length) break;
        need.set(weightedPick(onBoard, (f) => B[f] + 1), MAX_SLICES);
        continue;
      }
      const f = weightedPick(pool, (x) => need.get(x)!);
      if (!chosen.includes(f)) chosen.push(f);
      out.push(f);
      need.set(f, need.get(f)! - 1);
    }
    return out;
  }

  /** 비어 있는 오른쪽 칸만 새 접시로 채운다. 이미 나온 접시는 쓸 때까지 절대 바꾸지 않는다. */
  private fillConveyor() {
    const L = this.layout;
    const n = this.conveyor.filter(Boolean).length;
    for (let i = n; i < CONVEYOR_SLOTS; i++) {
      const slices = this.makeConveyorSlices();
      if (!slices.length) break;
      const np = makePlate(slices);
      np.ox = L.LW + 70 + (i - n) * 120 - L.convX[i];
      this.conveyor[i] = np;
    }
  }
}
