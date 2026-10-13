import { COLS, ROWS } from './config';

/** 논리 좌표계의 기준 폭. 화면이 넓으면 이 폭의 기둥을 가운데 두고 배경만 늘어난다. */
export const DESIGN_W = 450;
export const CELL_W = 100;
export const CELL_H = 98;
/** DOM HUD 높이(CSS px). style.css의 #hud height와 맞춘다. */
export const HUD_PX = 64;

export interface Rect { x: number; y: number; w: number; h: number; }

export interface Layout {
  /** CSS px 기준 화면 크기 */
  W: number; H: number; dpr: number;
  /** 논리 단위 1 = CSS px u */
  u: number;
  /** 논리 단위 기준 화면 크기 */
  LW: number; LH: number;
  /** 450 폭 기둥의 왼쪽 */
  x0: number;
  /** HUD 아래 경계 */
  top: number;
  table: Rect;
  gridX: number; gridY: number;
  belt: Rect;
  beltCY: number;
  convX: number[];
}

export function computeLayout(W: number, H: number, dpr: number, safeTop: number, safeBottom: number): Layout {
  const pad = 14;
  const tableW = COLS * CELL_W + pad * 2;
  const tableH = ROWS * CELL_H + pad * 2;
  const beltH = 132;
  const need = tableH + 30 + beltH + 26;
  const u = Math.min(W / DESIGN_W, (H - safeTop - safeBottom - HUD_PX) / need);
  const LW = W / u;
  const LH = H / u;
  const x0 = (LW - DESIGN_W) / 2;
  const top = (safeTop + HUD_PX) / u;
  const bottom = LH - safeBottom / u;
  const belt = { x: x0 + 6, y: bottom - 14 - beltH, w: DESIGN_W - 12, h: beltH };
  const free = belt.y - 30 - top - tableH;
  const table = { x: x0 + (DESIGN_W - tableW) / 2, y: top + Math.max(0, free * 0.45), w: tableW, h: tableH };
  return {
    W, H, dpr, u, LW, LH, x0, top, table,
    gridX: table.x + pad,
    gridY: table.y + pad,
    belt,
    beltCY: belt.y + 80,
    convX: [x0 + 82, x0 + 225, x0 + 368],
  };
}

/** 슬롯 중심. 케이크가 위로 솟아 있어 시각적 균형을 위해 약간 아래로 내린다. */
export function slotCenter(L: Layout, i: number) {
  const c = i % COLS;
  const r = (i / COLS) | 0;
  return { x: L.gridX + (c + 0.5) * CELL_W, y: L.gridY + (r + 0.5) * CELL_H + 5 };
}

export function conveyorPos(L: Layout, i: number) {
  return { x: L.convX[i], y: L.beltCY };
}
