export type Topping = 'strawberry' | 'matcha' | 'lemon' | 'blueberry' | 'orange' | 'cherry';

export interface FlavorStyle {
  name: string;
  /** 윗면 프로스팅 [하이라이트, 가장자리] */
  top: [string, string];
  /** 바깥 옆면 프로스팅 [위, 아래] */
  side: [string, string];
  /** 단면 스펀지 [색, 기공] */
  sponge: [string, string];
  /** 생크림 층 / 짜 올린 크림 [색, 그늘] */
  cream: [string, string];
  /** 잼·필링 층 [색, 과육] */
  jam: [string, string];
  /** 옆면으로 흘러내리는 글레이즈 */
  drip: string | null;
  /** 윗면에 뿌린 가루 (말차, 코코아) */
  dust: string | null;
  /** 윗면 윤기 0..1 */
  gloss: number;
  topping: Topping;
  /** 완성 이펙트 색 */
  accent: string;
}

const GOLD_SPONGE: [string, string] = ['#ffe3a6', '#e9bd6c'];

// 배열 순서 = 단계별 등장 순서
export const FLAVORS: FlavorStyle[] = [
  {
    name: '딸기',
    top: ['#ffe1e9', '#ff9fbb'],
    side: ['#ffb9cb', '#ef6f94'],
    sponge: GOLD_SPONGE,
    cream: ['#fffafa', '#f2c9d3'],
    jam: ['#e8244a', '#ff8ca2'],
    drip: '#e02346',
    dust: null,
    gloss: 0.4,
    topping: 'strawberry',
    accent: '#ff5c7a',
  },
  {
    name: '말차',
    top: ['#c3e68f', '#7fb84a'],
    side: ['#a4d168', '#5c9a30'],
    sponge: ['#b2d777', '#8db554'],
    cream: ['#fdfff4', '#d9e4c2'],
    jam: ['#7a3a35', '#a05a52'],
    drip: null,
    dust: '#4b7f1f',
    gloss: 0.15,
    topping: 'matcha',
    accent: '#7ccf3f',
  },
  {
    name: '레몬',
    top: ['#fff5b5', '#ffd23a'],
    side: ['#ffe888', '#f0b924'],
    sponge: ['#fff1c4', '#f0d48e'],
    cream: ['#fffef3', '#efe1ac'],
    jam: ['#ffc400', '#ffe066'],
    drip: '#ffcb14',
    dust: null,
    gloss: 0.65,
    topping: 'lemon',
    accent: '#ffd21f',
  },
  {
    name: '블루베리',
    top: ['#e0daff', '#9f95ee'],
    side: ['#b7affa', '#6d63cf'],
    sponge: GOLD_SPONGE,
    cream: ['#faf8ff', '#d3ccf0'],
    jam: ['#5a3d9f', '#8e76d1'],
    drip: '#45309a',
    dust: null,
    gloss: 0.45,
    topping: 'blueberry',
    accent: '#8b84f5',
  },
  {
    name: '오렌지',
    top: ['#ffe0a0', '#ff9c2c'],
    side: ['#ffc86f', '#ea7a18'],
    sponge: ['#ffe6b4', '#efc27a'],
    cream: ['#fffaf1', '#f1dbbf'],
    jam: ['#ff8a1c', '#ffb75f'],
    drip: '#ff8a12',
    dust: null,
    gloss: 0.55,
    topping: 'orange',
    accent: '#ff8a1f',
  },
  {
    name: '초코',
    top: ['#9a5f3d', '#48230f'],
    side: ['#73402a', '#371a0c'],
    sponge: ['#6f3c22', '#4e2914'],
    cream: ['#fbf1e4', '#e1cbb2'],
    jam: ['#3a190b', '#5a2d16'],
    drip: '#2b1207',
    dust: '#2d1508',
    gloss: 0.6,
    topping: 'cherry',
    accent: '#c0703f',
  },
];

