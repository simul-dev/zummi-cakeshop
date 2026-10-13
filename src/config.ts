export const COLS = 4;
export const ROWS = 5;
export const SLOTS = COLS * ROWS;
/** 접시 하나에 들어가는 최대 조각 수 = 케이크 1개 */
export const MAX_SLICES = 6;
export const CONVEYOR_SLOTS = 3;

/** 밸런스 조절용 값들 */
export const CONFIG = {
  /** 시작할 때 테이블에 깔리는 접시의 조각 수 [최소, 최대] */
  boardSlices: [2, 4] as [number, number],
  /** 시작 접시가 두 가지 맛으로 섞여 나올 확률 */
  boardMixChance: 0.5,
  /** 컨베이어 접시 조각 수 가중치 (1, 2, 3, 4조각) */
  conveyorSliceWeights: [20, 35, 30, 15],
  /** 컨베이어 접시에 섞이는 맛 종류 수 가중치 (1, 2, 3종) */
  conveyorKindWeights: [45, 40, 15],
  /** 케이크 1개 완성 점수 (연쇄 시 x콤보) */
  pointsPerCake: 100,
  /** 테이블을 다 비웠을 때 보너스 */
  clearBonus: 500,
};

/** 단계별 시작 접시 수 / 등장 맛 종류 수 */
export function stageParams(stage: number) {
  return {
    plates: Math.min(5 + stage, 10),
    flavors: stage <= 2 ? 4 : stage <= 4 ? 5 : 6,
  };
}
