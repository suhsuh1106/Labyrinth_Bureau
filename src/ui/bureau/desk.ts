// 국장의 책상: 책상 · 지도 · 물건이 한 평면(.plane)에 비스듬히 누워 있다(CSS 원근). 평면은 납작한 한 장으로 칠하고(3D 쌓기 없음),
// 서 있는 것(미니어처 · 깃펜 · 종)은 평면 밖의 납작한 층(.minis)에 두고 평면 위 자리를 화면으로 옮겨 찍는다(project).
// 예전처럼 서 있는 것마다 3D 층을 두면 휴대폰 GPU가 층 수십 개를 맞대어 자르다 칠이 빠지고(뚫림) 시트 위로 지도가 비쳤다.
// 책상 보기에선 지도 너머로 책상 위 물건을 누르고, 지도를 누르면 지도를 세워(위에서 똑바로) 끌고 확대한다. 판 상태에 쓰지 않는다.
import type { Mini } from './map';

// 장면 한 장의 크기(이 안에서 그리고, 화면에 맞춰 통째로 줄이고 늘린다)와 평면 위 지도 자리
const STAGE = [1600, 1000], AT = [160, 250], MAP = [1280, 768];
const TILT = 46, PERSP = 1500, PO = [STAGE[0] / 2, STAGE[1] * 0.08];

export interface Desk { mode: 'desk' | 'map'; set(m: 'desk' | 'map'): void; zoom(d: number): void; minis(list: Mini[]): void; stand(): void }

export function makeDesk(host: HTMLElement): Desk {
  const fit = host.querySelector('.fit') as HTMLElement, plane = host.querySelector('.plane') as HTMLElement, layer = host.querySelector('.minis') as HTMLElement;
  let fs = 1, offL = 0, offT = 0;
  // 세운 지도: k배 확대, (ox, oy)만큼 끌림 (장면 단위)
  let k = 1, ox = 0, oy = 0;
  // 지금 놓인 미니어처들(평면 위 자리)과 평면 → 장면 행렬. 평면이 옮겨 가는 동안(1.1초)은 프레임마다 다시 찍는다
  let placed: { el: HTMLElement; x: number; y: number }[] = [], M: DOMMatrix | null = null, anim = 0;
  const matrix = () => {
    const t = getComputedStyle(plane).transform, pm = t && t !== 'none' ? new DOMMatrix(t) : new DOMMatrix();
    const per = new DOMMatrix(); per.m34 = -1 / PERSP;
    return new DOMMatrix().translate(PO[0], PO[1]).multiply(per).translate(-PO[0], -PO[1]).translate(AT[0], AT[1]).multiply(pm);
  };
  const proj = (x: number, y: number) => { const p = M!.transformPoint(new DOMPoint(x, y, 0, 1)); return [p.x / p.w, p.y / p.w]; };
  const place = (el: HTMLElement, x: number, y: number) => {
    const [px, py] = proj(x, y), [ax] = proj(x + 10, y), [, by] = proj(x, y + 10);
    const sx = Math.abs(ax - px) / 10, sy = Math.abs(by - py) / 10;
    const tr = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) scale(${sx.toFixed(3)})`;
    if (el.style.transform !== tr) el.style.transform = tr;
    // 그림자는 바닥에 누우니 평면이 누운 만큼 납작하게
    const sh = el.firstElementChild as HTMLElement, f = `scaleY(${(sy / sx).toFixed(3)})`;
    if (sh.style.transform !== f) sh.style.transform = f;
  };
  const reproject = () => { M = matrix(); for (const p of placed) place(p.el, p.x, p.y); };
  // 평면이 옮겨 가는 동안 미니어처가 따라오게: 옮김이 끝날 때까지 프레임마다
  const follow = () => {
    const until = performance.now() + 1200;
    host.classList.add('moving');
    cancelAnimationFrame(anim);
    const f = () => { reproject(); if (performance.now() < until) anim = requestAnimationFrame(f); else host.classList.remove('moving'); };
    anim = requestAnimationFrame(f);
  };
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
  // 끄는 동안 · 확대는 옮김 없이 바로(1.1초 옮김을 끌 때마다 다시 시작하면 지도가 늘 뒤따라 미끄러져 버벅인다)
  const D: Desk = {
    mode: 'desk',
    set(m) { if (m === D.mode) return; if (m === 'map') { k = 1; ox = oy = 0; } D.mode = m; put(); follow(); },
    zoom(d) { if (D.mode !== 'map') return; const nk = Math.max(1, Math.min(3, k * (d > 0 ? 1.25 : 0.8))); ox *= nk / k; oy *= nk / k; k = nk; put(); follow(); },
    stand() { reproject(); },
    minis(list) {
      if (!M) M = matrix();
      const next: typeof placed = [];
      const had = new Map([...layer.children].map(e => [(e as HTMLElement).dataset.key!, e as HTMLElement]));
      for (const m of list) {
        let el = had.get(m.key);
        if (el) had.delete(m.key);
        else {
          el = document.createElement('div'); el.className = m.walk ? 'mini mv walk' : 'mini mv'; el.dataset.key = m.key;
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
        // 바뀐 것만 쓴다(같은 값을 다시 써도 스타일 계산이 돈다). 앞(아래)에 있는 것이 위에 그려진다
        const z = String(Math.round(m.y) + 1000);
        if (el.style.zIndex !== z) el.style.zIndex = z;
        place(el, m.x, m.y);
        next.push({ el, x: m.x, y: m.y });
      }
      for (const el of had.values()) el.remove();
      placed = next;
    },
  };
  // 세운 지도는 끌어서 옮기고 휠로 확대한다. 끈 뒤의 누름은 표식을 고르지 않는다
  let drag: [number, number] | null = null, moved = false;
  host.addEventListener('pointerdown', e => { if (D.mode === 'map' && !(e.target as Element).closest('button, .sheet')) { drag = [e.clientX, e.clientY]; moved = false; } });
  host.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag[0], dy = e.clientY - drag[1];
    if (!moved && Math.hypot(dx, dy) < 6) return;
    moved = true; ox += dx / fs; oy += dy / fs; drag = [e.clientX, e.clientY]; host.classList.add('drag'); put(); reproject();
  });
  const up = () => { drag = null; host.classList.remove('drag'); };
  host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
  host.addEventListener('click', e => { if (moved) { e.stopPropagation(); moved = false; } }, true);
  host.addEventListener('wheel', e => { if (D.mode !== 'map') return; e.preventDefault(); D.zoom(e.deltaY < 0 ? 1 : -1); }, { passive: false });
  new ResizeObserver(() => { resize(); put(); reproject(); }).observe(host);
  resize(); put();
  return D;
}
