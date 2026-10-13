export type Topping = 'strawberry' | 'matcha' | 'lemon' | 'blueberry' | 'orange' | 'cherry';

export interface Layer {
  /** 단면에서 아래(0) ~ 위(1) 높이 비율 */
  z0: number;
  z1: number;
  color: string;
  /** 스펀지 기공 색 (있으면 점무늬) */
  pores?: string;
  /** 잼 층 과육 색 */
  bits?: string;
}

export interface FlavorStyle {
  name: string;
  /** 윗면 크림/글레이즈 [밝은, 어두운] */
  top: [string, string];
  /** 바깥 옆면 [위, 아래] */
  side: [string, string];
  /** 잘린 단면 층 (아래→위) */
  layers: Layer[];
  /** 짜 올린 크림 [색, 그늘] */
  cream: [string, string];
  /** 옆면으로 흘러내리는 글레이즈 */
  drip: string | null;
  /** 윗면에 뿌린 가루 (말차, 코코아) */
  dust: string | null;
  /** 윤기 하이라이트 강도 */
  gloss: number;
  topping: Topping;
  /** 완성 이펙트 색 */
  accent: string;
}

const VANILLA = '#ffe6b5';
const VANILLA_PORE = '#f0cd8c';

// 배열 순서 = 단계별 등장 순서
export const FLAVORS: FlavorStyle[] = [
  {
    name: '딸기',
    top: ['#ffe6ec', '#ffa7bc'],
    side: ['#ffb0c2', '#ec6a8b'],
    layers: [
      { z0: 0, z1: 0.3, color: VANILLA, pores: VANILLA_PORE },
      { z0: 0.3, z1: 0.38, color: '#fffaf3' },
      { z0: 0.38, z1: 0.47, color: '#e8364f', bits: '#ff8a9a' },
      { z0: 0.47, z1: 0.75, color: VANILLA, pores: VANILLA_PORE },
      { z0: 0.75, z1: 0.84, color: '#fffaf3' },
    ],
    cream: ['#fffaf7', '#f3d6dc'],
    drip: '#e42c48',
    dust: null,
    gloss: 0.25,
    topping: 'strawberry',
    accent: '#ff5c7a',
  },
  {
    name: '말차',
    top: ['#b3db78', '#86ba4b'],
    side: ['#9fd062', '#5e9a31'],
    layers: [
      { z0: 0, z1: 0.3, color: '#a5cf62', pores: '#87b24a' },
      { z0: 0.3, z1: 0.39, color: '#fdfff3' },
      { z0: 0.39, z1: 0.46, color: '#7b3a36', bits: '#9a5550' },
      { z0: 0.46, z1: 0.75, color: '#a5cf62', pores: '#87b24a' },
      { z0: 0.75, z1: 0.84, color: '#fdfff3' },
    ],
    cream: ['#fcfff5', '#dfe8cf'],
    drip: null,
    dust: '#5f8f2a',
    gloss: 0.1,
    topping: 'matcha',
    accent: '#7ccf3f',
  },
  {
    name: '레몬',
    top: ['#fff7b8', '#ffdc4a'],
    side: ['#fff1a8', '#f2c53d'],
    layers: [
      { z0: 0, z1: 0.32, color: '#fff0c2', pores: '#efd58e' },
      { z0: 0.32, z1: 0.42, color: '#ffd21f' },
      { z0: 0.42, z1: 0.74, color: '#fff0c2', pores: '#efd58e' },
      { z0: 0.74, z1: 0.84, color: '#fffdf2' },
    ],
    cream: ['#fffef5', '#efe6bf'],
    drip: '#ffcf1a',
    dust: null,
    gloss: 0.55,
    topping: 'lemon',
    accent: '#ffd21f',
  },
  {
    name: '블루베리',
    top: ['#d4d1ff', '#8f89ea'],
    side: ['#a19df2', '#5b54c2'],
    layers: [
      { z0: 0, z1: 0.3, color: VANILLA, pores: VANILLA_PORE },
      { z0: 0.3, z1: 0.39, color: '#5b3d9c', bits: '#8467c4' },
      { z0: 0.39, z1: 0.47, color: '#f5f0ff' },
      { z0: 0.47, z1: 0.76, color: VANILLA, pores: VANILLA_PORE },
      { z0: 0.76, z1: 0.84, color: '#f5f0ff' },
    ],
    cream: ['#f8f6ff', '#d2cbf2'],
    drip: '#3e2a86',
    dust: null,
    gloss: 0.35,
    topping: 'blueberry',
    accent: '#7f7cf0',
  },
  {
    name: '오렌지',
    top: ['#ffd38f', '#ff9a2e'],
    side: ['#ffbd6e', '#ec7c1f'],
    layers: [
      { z0: 0, z1: 0.31, color: '#ffe2ae', pores: '#efc380' },
      { z0: 0.31, z1: 0.41, color: '#ff8a1c', bits: '#ffb35e' },
      { z0: 0.41, z1: 0.74, color: '#ffe2ae', pores: '#efc380' },
      { z0: 0.74, z1: 0.84, color: '#fff7ec' },
    ],
    cream: ['#fffaf2', '#f3dfc4'],
    drip: null,
    dust: null,
    gloss: 0.45,
    topping: 'orange',
    accent: '#ff8a1f',
  },
  {
    name: '초코',
    top: ['#8a5233', '#4a2413'],
    side: ['#6e3d22', '#3c1d0e'],
    layers: [
      { z0: 0, z1: 0.3, color: '#6e3c22', pores: '#4f2a16' },
      { z0: 0.3, z1: 0.39, color: '#f6e4cf' },
      { z0: 0.39, z1: 0.46, color: '#3a190b' },
      { z0: 0.46, z1: 0.75, color: '#6e3c22', pores: '#4f2a16' },
      { z0: 0.75, z1: 0.84, color: '#f6e4cf' },
    ],
    cream: ['#fbf0e2', '#e2ccb3'],
    drip: '#2e1408',
    dust: '#2d1508',
    gloss: 0.5,
    topping: 'cherry',
    accent: '#c0703f',
  },
];
