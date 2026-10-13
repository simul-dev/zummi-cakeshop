import { sfx } from './audio';
import type { Game } from './game';
import type { Layout } from './layout';

/**
 * 조작:
 *  - 컨베이어 접시를 끌어서 빈 슬롯에 놓기 (터치는 손가락에 가리지 않게 접시가 위로 떠서 따라옴)
 *  - 또는 접시를 탭해서 고른 뒤 빈 슬롯을 탭
 */
export function attachInput(canvas: HTMLCanvasElement, game: Game, getLayout: () => Layout) {
  const toLogical = (e: PointerEvent) => {
    const L = getLayout();
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / L.u, y: (e.clientY - r.top) / L.u };
  };

  canvas.addEventListener('pointerdown', (e) => {
    sfx.unlock();
    if (game.over || game.drag) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const p = toLogical(e);
    const ci = game.conveyorHit(p.x, p.y);
    if (ci >= 0) {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
      game.startDrag(ci, e.pointerId, p.x, p.y, e.pointerType === 'mouse' ? 14 : 62);
      return;
    }
    if (game.selected !== null) {
      const s = game.slotTap(p.x, p.y);
      if (s >= 0) game.placeSelected(s);
      else game.selected = null;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const d = game.drag;
    if (!d || d.pointerId !== e.pointerId) return;
    e.preventDefault();
    // 고주사율 터치 이벤트를 모두 반영해 끊김 없이 따라오게
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    const last = events.length ? events[events.length - 1] : e;
    const p = toLogical(last);
    game.moveDrag(p.x, p.y);
  });

  const end = (cancel: boolean) => (e: PointerEvent) => {
    const d = game.drag;
    if (!d || d.pointerId !== e.pointerId) return;
    game.endDrag(cancel);
  };
  canvas.addEventListener('pointerup', end(false));
  canvas.addEventListener('pointercancel', end(true));
  canvas.addEventListener('lostpointercapture', end(false));

  // 길게 누르기 메뉴 / 더블탭 확대 / 당겨서 새로고침 방지
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('dblclick', (e) => e.preventDefault());
}
