// 효과음은 파일 없이 WebAudio로 합성한다. 모바일은 첫 터치 때 unlock() 해야 소리가 난다.

interface ToneOpts { type?: OscillatorType; vol?: number; to?: number; delay?: number; }

class Sfx {
  muted = false;
  private ac: AudioContext | null = null;

  constructor() {
    try { this.muted = localStorage.getItem('zummi.muted') === '1'; } catch { /* 저장소 없음 */ }
  }

  unlock() {
    if (!this.ac) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) this.ac = new AC();
    }
    if (this.ac?.state === 'suspended') void this.ac.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    try { localStorage.setItem('zummi.muted', m ? '1' : '0'); } catch { /* 저장소 없음 */ }
  }

  private tone(freq: number, dur: number, { type = 'sine', vol = 0.15, to, delay = 0 }: ToneOpts = {}) {
    if (this.muted || !this.ac) return;
    const t0 = this.ac.currentTime + delay;
    const o = this.ac.createOscillator();
    const g = this.ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.ac.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  pick() { this.tone(520, 0.08, { type: 'triangle', to: 780, vol: 0.1 }); }
  place() {
    this.tone(240, 0.12, { to: 130, vol: 0.25 });
    this.tone(1100, 0.04, { type: 'triangle', vol: 0.05 });
  }
  cancel() { this.tone(330, 0.09, { type: 'triangle', to: 220, vol: 0.08 }); }
  slice(i: number) {
    const f = 600 * Math.pow(2, (i % 8) / 12);
    this.tone(f, 0.07, { type: 'triangle', to: f * 1.3, vol: 0.08 });
  }
  complete(combo: number) {
    const root = 523.25 * Math.pow(2, (Math.min(combo - 1, 6) * 2) / 12);
    [1, 1.26, 1.5, 2].forEach((m, i) => this.tone(root * m, 0.24, { vol: 0.12, delay: i * 0.055 }));
  }
  clear() {
    [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((f, i) =>
      this.tone(f, i === 5 ? 0.5 : 0.16, { type: 'triangle', vol: 0.12, delay: i * 0.1 }));
  }
  over() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.32, { type: 'triangle', vol: 0.14, delay: i * 0.17 })); }
}

export const sfx = new Sfx();

/** 안드로이드 진동. iOS 사파리는 미지원이라 조용히 무시된다. */
export function haptic(ms: number) {
  try { navigator.vibrate?.(ms); } catch { /* 미지원 */ }
}
