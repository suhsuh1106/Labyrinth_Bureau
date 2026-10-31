// 국장의 책상: 책상 · 지도 · 물건이 한 평면(.plane)에 비스듬히 누워 있고, 서 있는 것(미니어처 · 잉크병 · 종)만 그 각도만큼 되돌려 세운다(CSS 3D).
// 책상 보기에선 지도 너머로 책상 위 물건을 누르고, 지도를 누르면 지도를 세워(위에서 똑바로) 끌고 확대한다. 판 상태에 쓰지 않는다.
import type { Mini } from './map';

// 장면 한 장의 크기(이 안에서 그리고, 화면에 맞춰 통째로 줄이고 늘린다)와 평면 위 지도 자리
const STAGE = [1600, 1000], AT = [160, 250], MAP = [1280, 768];
const TILT = 46;

export interface Desk { mode: 'desk' | 'map'; set(m: 'desk' | 'map'): void; zoom(d: number): void; minis(list: Mini[]): void; stand(): void }

export function makeDesk(host: HTMLElement): Desk {
  const fit = host.querySelector('.fit') as HTMLElement, plane = host.querySelector('.plane') as HTMLElement, layer = host.querySelector('.minis') as HTMLElement;
  let fs = 1, offL = 0, offT = 0;
  // 세운 지도: k배 확대, (ox, oy)만큼 끌림 (장면 단위)
  let k = 1, ox = 0, oy = 0;
  const base = () => Math.min(STAGE[0] / MAP[0], STAGE[1] / MAP[1]);
  const resize = () => {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    // 가로 화면을 꽉 채우되, 4:3처럼 좁으면 양옆 물건이, 21:9처럼 넓으면 위아래 지도 · 종이 잘리지 않을 만큼만 (남는 쪽은 책상이 더 보인다)
    fs = Math.min(Math.max(w / STAGE[0], h / STAGE[1]), w / 1560, h / 900); offL = (w - STAGE[0] * fs) / 2; offT = (h - STAGE[1] * fs) / 2;
    fit.style.transform = `translate(${offL}px, ${offT}px) scale(${fs})`;
    // 위에 뜨는 것(숫자 띠 · 다음 날 · 쪽지)의 배율: 1280 × 720을 1.15로 두고 화면을 따라 0.85 ~ 1.4
    // 시트 너비도 여기서 px로 정한다(뜨는 것들이 zoom 안에서 이 값을 다시 셈하지 않게)
    // 글자 배율 U: 브라우저를 150%로 키운 것과 같게(화면이 넉넉할 때 1.5, 작은 화면은 1까지). 시트 · 띠 · 창은 화면을 U로 나눈 크기로 잰 뒤 U를 곱한다
    const U = Math.max(1, Math.min(1.5, w / 960, h / 600)), vw = w / U, vh = h / U, P = host.parentElement?.style;
    P?.setProperty('--uz', U.toFixed(3));
    // 서류 쓰기 창은 세 칸이 넓어 화면 너비가 허락하는 만큼만 키운다
    P?.setProperty('--wz', Math.max(1, Math.min(U, (w - 32) / 1180)).toFixed(3));
    P?.setProperty('--sheet-w', `${Math.round(U * (vw <= 640 || vh <= 480 ? 340 : Math.max(380, Math.min(520, vw * 0.3))))}px`);
    P?.setProperty('--hz', (U * Math.max(0.85, Math.min(1.4, 1.15 * Math.min(vw / 1280, vh / 720)))).toFixed(3));
  };
  const clamp = () => {
    const s = base() * k, lim = [(MAP[0] * s - STAGE[0]) / 2 + 80, (MAP[1] * s - STAGE[1]) / 2 + 80];
    ox = Math.max(-Math.max(0, lim[0]), Math.min(Math.max(0, lim[0]), ox));
    oy = Math.max(-Math.max(0, lim[1]), Math.min(Math.max(0, lim[1]), oy));
  };
  const put = () => {
    const [mx, my] = [MAP[0] / 2, MAP[1] / 2];
    if (D.mode === 'desk') plane.style.transform = `translate(${mx}px, ${my}px) translate(0px, -120px) rotateX(${TILT}deg) scale(0.8) translate(${-mx}px, ${-my}px)`;
    else { clamp(); const s = base() * k; plane.style.transform = `translate(${mx - mx * s + (STAGE[0] / 2 - AT[0] - mx) + ox}px, ${my - my * s + (STAGE[1] / 2 - AT[1] - my) + oy}px) scale(${s})`; }
    host.dataset.mode = D.mode;
  };
  const D: Desk = {
    mode: 'desk',
    set(m) { if (m === 'map' && D.mode !== 'map') { k = 1; ox = oy = 0; } D.mode = m; put(); D.stand(); },
    zoom(d) { if (D.mode !== 'map') return; const nk = Math.max(1, Math.min(3, k * (d > 0 ? 1.25 : 0.8))); ox *= nk / k; oy *= nk / k; k = nk; put(); },
    // 세운 것들: 책상 보기에선 평면이 누운 만큼 되돌려 세우고, 지도를 세우면 그대로
    stand() { const a = D.mode === 'desk' ? TILT : 0, t = `rotateX(${-a}deg)`; plane.querySelectorAll<HTMLElement>('.st').forEach(s => { if (s.style.transform !== t) s.style.transform = t; }); },
    minis(list) {
      let fresh = false;
      const had = new Map([...layer.children].map(e => [(e as HTMLElement).dataset.key!, e as HTMLElement]));
      for (const m of list) {
        let el = had.get(m.key);
        if (el) had.delete(m.key);
        else {
          el = document.createElement('div'); el.className = m.walk ? 'mini mv walk' : 'mini mv'; el.dataset.key = m.key; fresh = true;
          el.innerHTML = `<div class="sh"></div><div class="st" style="left:${-m.w / 2}px;top:${-m.h}px;width:${m.w}px;height:${m.h}px"><svg width="${m.w}" height="${m.h}" viewBox="${-m.w / 2} ${-m.h} ${m.w} ${m.h}"></svg></div>`;
          layer.appendChild(el);
        }
        const svg = el.querySelector('svg')!, st = el.querySelector('.st') as HTMLElement;
        // 몸집이 바뀌는 것(수레 ↔ 사람)은 자리 틀도 고친다
        if (svg.getAttribute('width') !== String(m.w)) { svg.setAttribute('width', String(m.w)); svg.setAttribute('viewBox', `${-m.w / 2} ${-m.h} ${m.w} ${m.h}`); st.style.left = `${-m.w / 2}px`; st.style.width = `${m.w}px`; }
        // 그림이 바뀔 때만 (몸집이 커진 깃발 등) 다시 그린다
        if (svg.dataset.art !== m.svg) { svg.innerHTML = `<title>${m.title}</title>${m.svg}`; svg.dataset.art = m.svg; }
        const face = m.face === -1 ? 'scaleX(-1)' : '';
        if (svg.style.transform !== face) svg.style.transform = face;
        // 바뀐 것만 쓴다(같은 값을 다시 써도 스타일 계산이 돈다)
        const tr = `translate3d(${m.x.toFixed(1)}px, ${m.y.toFixed(1)}px, 0)`, z = String(Math.round(m.y));
        if (el.style.transform !== tr) el.style.transform = tr;
        if (el.style.zIndex !== z) el.style.zIndex = z;
      }
      for (const el of had.values()) el.remove();
      // 새로 생긴 것만 세운다
      if (fresh) D.stand();
    },
  };
  // 세운 지도는 끌어서 옮기고 휠로 확대한다. 끈 뒤의 누름은 표식을 고르지 않는다
  let drag: [number, number] | null = null, moved = false;
  host.addEventListener('pointerdown', e => { if (D.mode === 'map' && !(e.target as Element).closest('button, .sheet')) { drag = [e.clientX, e.clientY]; moved = false; } });
  host.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag[0], dy = e.clientY - drag[1];
    if (!moved && Math.hypot(dx, dy) < 6) return;
    moved = true; ox += dx / fs; oy += dy / fs; drag = [e.clientX, e.clientY]; host.classList.add('drag'); put();
  });
  const up = () => { drag = null; host.classList.remove('drag'); };
  host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
  host.addEventListener('click', e => { if (moved) { e.stopPropagation(); moved = false; } }, true);
  host.addEventListener('wheel', e => { if (D.mode !== 'map') return; e.preventDefault(); D.zoom(e.deltaY < 0 ? 1 : -1); }, { passive: false });
  new ResizeObserver(() => { resize(); put(); }).observe(host);
  resize(); put();
  return D;
}
