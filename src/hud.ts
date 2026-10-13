import { sfx } from './audio';
import type { Game } from './game';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fmt = (n: number) => n.toLocaleString('ko-KR');

export function bindHud(game: Game) {
  const scoreEl = $('score');
  const leftEl = $('left');
  const soundBtn = $<HTMLButtonElement>('sound');
  const overlay = $('overlay');
  const title = $('endTitle');
  const sub = $('endSub');
  const finalScore = $('finalScore');
  const finalBest = $('finalBest');
  const newBest = $('newBest');
  const nextBtn = $<HTMLButtonElement>('next');
  const restartBtn = $<HTMLButtonElement>('restart');
  let shownLeft = -1;

  const renderSound = () => {
    soundBtn.textContent = sfx.muted ? '🔇' : '🔊';
    soundBtn.setAttribute('aria-pressed', String(!sfx.muted));
  };
  renderSound();

  game.onScore = (score, gained) => {
    scoreEl.textContent = fmt(score);
    if (gained > 0) {
      scoreEl.classList.remove('bump');
      void scoreEl.offsetWidth; // 애니메이션 재시작
      scoreEl.classList.add('bump');
    }
  };

  game.onEnd = (kind, isNewBest) => {
    const clear = kind === 'clear';
    title.textContent = clear ? `${game.stage}단계 클리어!` : '테이블이 꽉 찼어요!';
    sub.textContent = clear ? '케이크를 전부 완성했어요' : `${game.stage}단계에서 멈췄어요`;
    finalScore.textContent = fmt(game.score);
    finalBest.textContent = fmt(game.best);
    newBest.hidden = !isNewBest;
    nextBtn.hidden = !clear;
    restartBtn.textContent = clear ? '처음부터' : '다시 하기';
    restartBtn.classList.toggle('secondary', clear);
    overlay.classList.toggle('clear', clear);
    overlay.hidden = false;
  };

  nextBtn.addEventListener('click', () => {
    sfx.unlock();
    overlay.hidden = true;
    game.nextStage();
  });

  restartBtn.addEventListener('click', () => {
    sfx.unlock();
    overlay.hidden = true;
    game.restart();
  });

  soundBtn.addEventListener('click', () => {
    sfx.unlock();
    sfx.setMuted(!sfx.muted);
    renderSound();
  });

  /** 매 프레임 호출: 남은 케이크 수 갱신 */
  return () => {
    const n = game.remainingCakes();
    if (n !== shownLeft) {
      shownLeft = n;
      leftEl.textContent = String(n);
    }
  };
}
