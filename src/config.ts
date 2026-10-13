export const COLS = 4;
export const ROWS = 5;
export const SLOTS = COLS * ROWS;
/** 접시 하나에 들어가는 최대 조각 수 = 케이크 1개 */
export const MAX_SLICES = 6;
export const CONVEYOR_SLOTS = 3;

export const CONFIG = {
  /** 케이크 1개 완성 점수 (연쇄 시 x콤보) */
  pointsPerCake: 100,
  /** 테이블을 다 비웠을 때 보너스 (x단계) */
  clearBonus: 500,
};

export interface StageDef {
  /** 이 단계 목표: 케이크를 몇 개 만들면 클리어인지 */
  cakes: number;
  /** 등장하는 케이크 종류 수 */
  flavors: number;
  /** 시작할 때 테이블에 깔리는 접시 수 */
  plates: number;
  /** 시작 접시의 조각 수 [최소, 최대] */
  boardSlices: [number, number];
  /** 시작 접시가 여러 맛으로 섞일 확률 / 최대 몇 가지 맛 */
  mix: number;
  mixKinds: number;
  /** 컨베이어 접시 조각 수 가중치 (1, 2, 3, 4조각) */
  sizes: number[];
  /** 컨베이어 접시에 섞이는 맛 종류 수 가중치 (1, 2, 3종) */
  kinds: number[];
  /** 컨베이어가 케이크 완성에 모자란 조각을 챙겨 줄 확률 (낮을수록 아무 맛이나 섞여 나와서 어려움) */
  help: number;
}

/** 단계는 5개. 단계마다 케이크 수·맛 종류·섞임 정도가 확 늘어난다. */
export const STAGES: StageDef[] = [
  { cakes: 6, flavors: 3, plates: 5, boardSlices: [2, 3], mix: 0.25, mixKinds: 2, sizes: [10, 40, 40, 10], kinds: [75, 25, 0], help: 1 },
  { cakes: 9, flavors: 4, plates: 7, boardSlices: [2, 4], mix: 0.5, mixKinds: 2, sizes: [10, 35, 40, 15], kinds: [50, 40, 10], help: 0.85 },
  { cakes: 12, flavors: 5, plates: 10, boardSlices: [2, 4], mix: 0.7, mixKinds: 2, sizes: [10, 30, 38, 22], kinds: [30, 45, 25], help: 0.65 },
  { cakes: 16, flavors: 6, plates: 12, boardSlices: [2, 4], mix: 0.8, mixKinds: 3, sizes: [8, 27, 35, 30], kinds: [18, 45, 37], help: 0.5 },
  { cakes: 20, flavors: 6, plates: 14, boardSlices: [3, 4], mix: 0.9, mixKinds: 3, sizes: [5, 25, 35, 35], kinds: [10, 40, 50], help: 0.4 },
];
