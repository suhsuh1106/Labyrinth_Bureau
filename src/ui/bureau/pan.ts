// 관할 지도 끌기 · 확대: svg의 viewBox만 바꾼다(판 상태에 쓰지 않는다). 끌다 놓은 것은 누름으로 치지 않는다
import { MAP_PX, T } from './map';

export interface Pan { svg: SVGSVGElement; moved: boolean; zoom(d: number, at?: [number, number]): void; home(): void; fit(): void }

export function makePan(host: HTMLElement, svg: SVGSVGElement, home: [number, number]): Pan {
  // v: 보이는 곳의 왼쪽 위 (지도 단위)와 화면 1px이 지도 몇 단위인지
  let x = 0, y = 0, k = 1;
  const size = () => [host.clientWidth || 1, host.clientHeight || 1];
  // 가장 멀리: 지도 전체가 보이게(남는 곳은 바다 빛 바탕). 가장 가까이: 칸 하나가 72px
  const kMax = () => { const [w, h] = size(); return Math.max(MAP_PX[0] / w, MAP_PX[1] / h); };
  const kMin = () => T / 72;
  const clamp = () => {
    const [w, h] = size(), vw = w * k, vh = h * k;
    x = vw >= MAP_PX[0] ? (MAP_PX[0] - vw) / 2 : Math.max(0, Math.min(MAP_PX[0] - vw, x));
    y = vh >= MAP_PX[1] ? (MAP_PX[1] - vh) / 2 : Math.max(0, Math.min(MAP_PX[1] - vh, y));
  };
  const put = () => {
    clamp();
    const [w, h] = size();
    svg.setAttribute('viewBox', `${x.toFixed(1)} ${y.toFixed(1)} ${(w * k).toFixed(1)} ${(h * k).toFixed(1)}`);
    // 글은 확대와 상관없이 화면에서 같은 크기
    svg.style.setProperty('--k', k.toFixed(4));
  };
  const zoomTo = (nk: number, [px, py]: [number, number]) => {
    nk = Math.max(kMin(), Math.min(kMax(), nk));
    x += px * (k - nk); y += py * (k - nk); k = nk; put();
  };
  const P: Pan = {
    svg, moved: false,
    zoom(d, at) { const [w, h] = size(); zoomTo(k * (d > 0 ? 0.8 : 1.25), at ?? [w / 2, h / 2]); },
    // 처음 자리: 칸 하나가 화면 폭에 맞춰 22 ~ 34px, 관리국과 폐광 사이가 가운데
    home() { const [w, h] = size(); k = Math.max(kMin(), Math.min(kMax(), T / Math.max(22, Math.min(34, w / 26)))); x = home[0] - w * k / 2; y = home[1] - h * k / 2; put(); },
    fit() { put(); },
  };
  // 끌기 · 두 손가락 확대
  const pts = new Map<number, [number, number]>();
  let start: [number, number] | null = null, pinch = 0;
  host.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { start = [e.clientX, e.clientY]; P.moved = false; }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
  });
  host.addEventListener('pointermove', e => {
    const was = pts.get(e.pointerId);
    if (!was) return;
    const now: [number, number] = [e.clientX, e.clientY];
    pts.set(e.pointerId, now);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), r = host.getBoundingClientRect();
      if (pinch > 0 && d > 0) zoomTo(k * pinch / d, [(a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top]);
      pinch = d; P.moved = true; return;
    }
    if (start && !P.moved && Math.hypot(now[0] - start[0], now[1] - start[1]) > 6) { P.moved = true; host.setPointerCapture(e.pointerId); host.classList.add('drag'); }
    if (P.moved) { x -= (now[0] - was[0]) * k; y -= (now[1] - was[1]) * k; put(); }
  });
  const up = (e: PointerEvent) => { pts.delete(e.pointerId); if (!pts.size) { start = null; host.classList.remove('drag'); } pinch = 0; };
  host.addEventListener('pointerup', up);
  host.addEventListener('pointercancel', up);
  host.addEventListener('wheel', e => { e.preventDefault(); const r = host.getBoundingClientRect(); zoomTo(k * Math.exp(e.deltaY * 0.0015), [e.clientX - r.left, e.clientY - r.top]); }, { passive: false });
  // 끌고 난 뒤의 누름은 표식을 고르지 않는다
  host.addEventListener('click', e => { if (P.moved) { e.stopPropagation(); P.moved = false; } }, true);
  addEventListener('resize', () => put());
  return P;
}
