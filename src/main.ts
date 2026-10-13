import { setCakeResolution } from './cake';
import { Game } from './game';
import { bindHud } from './hud';
import { attachInput } from './input';
import { computeLayout, type Layout } from './layout';
import { renderFrame } from './render';
import { drawBackground } from './scene';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const safeProbe = document.getElementById('safe')!;
const bg = document.createElement('canvas');
const game = new Game();
let layout: Layout;

function resize() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const cs = getComputedStyle(safeProbe);
  layout = computeLayout(W, H, dpr, parseFloat(cs.paddingTop) || 0, parseFloat(cs.paddingBottom) || 0);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  bg.width = canvas.width;
  bg.height = canvas.height;
  const bctx = bg.getContext('2d')!;
  bctx.setTransform(dpr * layout.u, 0, 0, dpr * layout.u, 0, 0);
  drawBackground(bctx, layout);
  setCakeResolution(dpr * layout.u);
  game.layout = layout;
}

window.addEventListener('resize', resize);
resize();
// 간판 글씨가 웹폰트로 다시 그려지도록
void document.fonts?.ready.then(resize);

const hudTick = bindHud(game);
game.restart();
attachInput(canvas, game, () => layout);

if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  renderFrame(ctx, layout, game, bg, now / 1000);
  hudTick();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
