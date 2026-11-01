// 첫 장면: 부임 첫날 신문 앞에 도는 짧은 컷신(먹선 그림 여섯 장 · 한 장에 한두 줄).
// 화면을 누르거나 Space · Enter · → 로 넘기고, 건너뛰기 · Esc로 바로 신문으로 간다. 고르는 단추는 없다.
// 그리기만 하고 판 상태에 쓰지 않으며 난수도 쓰지 않는다(산 능선의 들쭉날쭉은 해시).
import { dateOf } from './docs';

const INK = '#1d1712', SEP = '#3b2f22', PAPER = '#e8dcc0', RED = '#a3392b', WATER = '#5d7480';
const hash = (k: number) => { let h = Math.imul(k ^ 0x9e3779b9, 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// 능선: 왼쪽에서 오른쪽으로 봉우리를 이어 아래를 막는다
const ridge = (y: number, amp: number, k: number, fill: string, step = 80) => {
  let d = `M0,720 L0,${y}`;
  for (let x = step / 2, i = 0; x <= 1280 + step; x += step, i++) d += ` L${x},${(y - amp * hash(k * 97 + i)).toFixed(0)}`;
  return `<path d="${d} L1280,720 Z" fill="${fill}"/>`;
};
const sky = (id: string, stops: string[]) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map((c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient><rect width="1280" height="720" fill="url(#${id})"/>`;
const svg = (body: string) => `<svg viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${body}</svg>`;
// 갱도 입구: 기둥 둘 · 들보 · 검은 아가리
const mouth = (x: number, y: number, s = 1) => `<g transform="translate(${x},${y}) scale(${s})">
  <path d="M-34,0 L-30,-78 L30,-78 L34,0 Z" fill="#0b0a09"/>
  <rect x="-44" y="-84" width="12" height="86" fill="#6b5137" stroke="${INK}" stroke-width="2"/><rect x="32" y="-84" width="12" height="86" fill="#6b5137" stroke="${INK}" stroke-width="2"/>
  <rect x="-54" y="-96" width="108" height="16" fill="#6b5137" stroke="${INK}" stroke-width="2" transform="rotate(-3)"/></g>`;
const house = (x: number, y: number, w: number) => `<g transform="translate(${x},${y})"><rect x="${-w / 2}" y="${-w * .55}" width="${w}" height="${w * .7}" fill="#8a7a62" stroke="${INK}" stroke-width="2"/><path d="M${-w * .62},${-w * .5} L0,${-w * 1.05} L${w * .62},${-w * .5} Z" fill="#4a3a2a" stroke="${INK}" stroke-width="2"/></g>`;
const eyes = (x: number, y: number, d: number) => `<g class="cut-eye" style="animation-delay:${d}s"><circle cx="${x}" cy="${y}" r="5" fill="#e8b84a"/><circle cx="${x + 18}" cy="${y - 2}" r="5" fill="#e8b84a"/></g>`;
// 병사 하나: 투구 · 몸 · 둥근 방패 · 창
const soldier = (x: number, y: number, s: number, c: string) => `<g transform="translate(${x},${y}) scale(${s})" fill="${c}"><path d="M10,-118 L14,40" stroke="${c}" stroke-width="4"/><path d="M8,-122 l6,-16 l6,16 z"/>
  <circle cx="0" cy="-70" r="13"/><path d="M-14,-74 q14,-18 28,0 z"/><path d="M-18,-56 L18,-56 L22,10 L-22,10 Z"/><path d="M-14,10 L-12,40 L-4,40 L-2,10 Z M2,10 L4,40 L12,40 L14,10 Z"/><ellipse cx="-16" cy="-24" rx="18" ry="26"/></g>`;

const P1 = svg(`${sky('s1', ['#1c1f24', '#33373a', '#4a4a44'])}
  <circle cx="990" cy="150" r="110" fill="${PAPER}" opacity=".07"/><circle cx="990" cy="150" r="44" fill="${PAPER}" opacity=".8"/>
  ${ridge(430, 120, 1, '#3a3d3e')}${ridge(500, 80, 2, '#2c2b28', 70)}
  <path d="M0,720 L0,420 Q260,350 470,400 Q760,470 1280,560 L1280,720 Z" fill="#1f1c18"/>
  ${mouth(390, 446, 1.1)}<ellipse class="cut-glow" cx="390" cy="436" rx="20" ry="9" fill="#7fa3ad"/>
  <path d="M370,450 L330,720 M412,450 L470,720" stroke="#5a4a3a" stroke-width="5"/>${[0, 1, 2, 3, 4, 5].map(i => `<path d="M${355 - i * 7},${490 + i * 42} L${430 + i * 10},${490 + i * 42}" stroke="#5a4a3a" stroke-width="4"/>`).join('')}
  <path d="M560,430 L566,520" stroke="${INK}" stroke-width="6"/><rect x="520" y="420" width="96" height="30" fill="#6b5137" stroke="${INK}" stroke-width="2" transform="rotate(14 566 435)"/>
  <path d="M150,400 L160,300 M160,330 L130,300 M158,316 L190,282 M720,486 L728,400 M726,420 L750,396" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`);

const P2 = svg(`${sky('s2', ['#15171b', '#24282c', '#2d3236'])}
  ${ridge(300, 80, 3, '#262829')}
  <path d="M0,720 L0,190 Q170,160 330,230 Q520,320 640,720 Z" fill="#1c1a17"/>
  ${mouth(220, 250, .9)}
  <path d="M190,250 Q240,250 260,262 Q420,330 520,450 Q640,560 1280,560 L1280,720 L0,720 L0,560 Q120,520 180,420 Q200,330 190,250 Z" fill="${WATER}"/>
  ${house(820, 600, 120)}${house(980, 610, 100)}${house(1140, 596, 130)}
  <rect x="0" y="584" width="1280" height="136" fill="#4f6672" opacity=".96"/>
  <path d="M230,280 q40,30 70,70 M300,340 q50,40 90,100 M420,430 q60,50 120,80 M0,600 q160,-18 320,0 t320,0 t320,0 t320,0 M0,650 q160,-14 320,0 t320,0 t320,0 t320,0" stroke="#c9d4d6" stroke-width="3" fill="none" opacity=".7"/>
  <ellipse cx="520" cy="620" rx="70" ry="22" fill="#26343b"/><ellipse cx="700" cy="680" rx="54" ry="18" fill="#26343b"/><ellipse cx="300" cy="660" rx="60" ry="20" fill="#26343b"/>
  ${eyes(498, 612, 0)}${eyes(684, 674, .7)}${eyes(282, 652, 1.4)}${eyes(1020, 640, 2)}`);

const P3 = svg(`${sky('s3', ['#5d6b78', '#c7956a', '#f1d39e'])}
  <circle cx="930" cy="350" r="150" fill="#f8e6b4" opacity=".25"/><circle cx="930" cy="350" r="74" fill="#f8e6b4"/>
  ${ridge(440, 120, 4, '#5a4c40')}<path d="M0,720 L0,470 Q640,420 1280,480 L1280,720 Z" fill="#3a3027"/>
  ${mouth(640, 470, 1)}
  <path d="M584,470 L696,400 M584,400 L696,470 M610,470 L670,410 M610,410 L670,470" stroke="#6b5137" stroke-width="9" stroke-linecap="round"/>
  <path d="M548,470 L548,250" stroke="${INK}" stroke-width="6"/><path d="M548,252 L668,262 L650,300 L670,338 L548,330 Z" fill="${RED}" stroke="${INK}" stroke-width="2"/><circle cx="600" cy="294" r="16" fill="none" stroke="${PAPER}" stroke-width="4"/>
  ${Array.from({ length: 16 }, (_, i) => soldier(60 + i * 80 + (i > 7 ? 120 : 0), 540, .7, '#2a221b')).filter((_, i) => i < 7 || i > 8).join('')}
  ${Array.from({ length: 14 }, (_, i) => soldier(20 + i * 96, 640, .92, INK)).join('')}`);

const SEAL = (x: number, y: number) => `<g class="cut-seal" style="transform-origin:${x}px ${y}px"><rect x="${x - 70}" y="${y - 70}" width="140" height="140" rx="8" fill="none" stroke="${RED}" stroke-width="8"/>
  <text x="${x}" y="${y - 8}" text-anchor="middle" font-family="Gowun Batang, serif" font-weight="700" font-size="48" fill="${RED}">미궁</text><text x="${x}" y="${y + 46}" text-anchor="middle" font-family="Gowun Batang, serif" font-weight="700" font-size="40" fill="${RED}">관리국</text></g>`;
const P4 = svg(`${sky('s4', ['#cbbd9e', PAPER])}
  ${[120, 360, 920, 1160].map(x => `<rect x="${x - 34}" y="40" width="68" height="420" fill="#d8caa8" stroke="${SEP}" stroke-width="3"/><rect x="${x - 50}" y="30" width="100" height="22" fill="#cdbd98" stroke="${SEP}" stroke-width="3"/>`).join('')}
  <path d="M520,40 L760,40 L760,300 Q640,240 520,300 Z" fill="#b8a582" stroke="${SEP}" stroke-width="3"/>
  <path d="M0,470 L1280,470 L1280,720 L0,720 Z" fill="#6b5137"/><path d="M0,470 L1280,470" stroke="${INK}" stroke-width="4"/>
  <g transform="translate(0,-130) rotate(-4 640 560)"><rect x="390" y="430" width="500" height="300" fill="#f4ecd8" stroke="${SEP}" stroke-width="3"/>
  <text x="640" y="486" text-anchor="middle" font-family="Gowun Batang, serif" font-weight="700" font-size="34" fill="${SEP}">중 앙 행 정 원</text>
  ${[520, 552, 584, 616, 648].map((y, i) => `<path d="M430,${y} L${830 - (i % 2) * 120},${y}" stroke="#9a8a70" stroke-width="5" stroke-linecap="round"/>`).join('')}
  ${SEAL(790, 620)}</g>`);

// 국장실: 빈 의자 · 지도 펼친 책상 · 창 너머 산 · 문간의 테사
const P5 = svg(`${sky('s5', ['#cfc2a4', '#e3d6b8'])}
  <rect x="860" y="80" width="300" height="300" fill="#9fb0b2" stroke="${SEP}" stroke-width="6"/>
  <clipPath id="w5"><rect x="860" y="80" width="300" height="300"/></clipPath><g clip-path="url(#w5)">${ridge(300, 110, 6, '#6c7a78', 60)}</g>
  <path d="M1010,80 L1010,380 M860,230 L1160,230" stroke="${SEP}" stroke-width="6"/>
  <rect x="80" y="120" width="170" height="420" fill="#8c7458" stroke="${SEP}" stroke-width="5"/><rect x="100" y="140" width="130" height="380" fill="#2a221b"/>
  <g transform="translate(200,540)"><path d="M-28,0 q2,-110 28,-120 q26,10 28,120 z" fill="#2f4a5c" stroke="${INK}" stroke-width="2"/><ellipse cx="0" cy="-138" rx="18" ry="21" fill="#e8c29a" stroke="${INK}" stroke-width="2"/>
  <path d="M-18,-140 q0,-26 18,-27 q20,0 18,27 q-6,-14 -18,-16 q-8,8 -18,16 z" fill="#4a2e1c"/><circle cx="16" cy="-160" r="8" fill="#4a2e1c"/><rect x="10" y="-92" width="34" height="44" fill="#f4ecd8" stroke="${INK}" stroke-width="2" transform="rotate(-8)"/></g>
  <path d="M540,470 L536,250 Q640,200 744,250 L740,470 Z" fill="#4a3424" stroke="${INK}" stroke-width="4"/><path d="M566,450 L564,270 Q640,236 716,270 L714,450" fill="none" stroke="#6b5137" stroke-width="5"/>
  <path d="M260,500 L1020,500 L1180,720 L100,720 Z" fill="#6b5137" stroke="${INK}" stroke-width="4"/>
  <g transform="rotate(-3 640 590)"><rect x="410" y="520" width="440" height="170" fill="${PAPER}" stroke="${SEP}" stroke-width="3"/>
  <path d="M430,640 Q520,560 620,600 T830,560" stroke="${SEP}" stroke-width="4" fill="none"/><path d="M470,560 L520,590 L560,560 M700,650 l20,-30 l20,30 z" stroke="${SEP}" stroke-width="3" fill="none"/><circle cx="760" cy="590" r="12" fill="none" stroke="${RED}" stroke-width="4"/></g>
  <ellipse cx="940" cy="600" rx="30" ry="12" fill="${INK}"/><path d="M915,600 q0,-40 25,-40 q25,0 25,40" fill="#2a2f33"/><path d="M948,560 Q990,470 1030,450" stroke="${PAPER}" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M310,610 q0,-40 30,-40 q30,0 30,40 z" fill="#b08a3a" stroke="${INK}" stroke-width="3"/><circle cx="340" cy="566" r="6" fill="#b08a3a" stroke="${INK}" stroke-width="2"/>`);

const P6 = svg(`<rect width="1280" height="720" fill="#14110e"/>`);

interface Shot { art: string; say: string[]; ms: number; kb: string; title?: boolean }
const SHOTS: Shot[] = [
  { art: P1, say: ['로이드 백작령 산속.', '아무도 돌보지 않던 폐광이 있었다.'], ms: 5200, kb: '-2%, 1%' },
  { art: P2, say: ['그날 밤, 미궁이 넘쳤다.', '아랫마을 셋이 물과 마물에 잠겼다.'], ms: 5200, kb: '2%, -1%' },
  { art: P3, say: ['새벽, 왕국군이 폐광을 막아 섰다.', '하지만 군은 미궁을 지키는 곳이 아니다.'], ms: 5600, kb: '0%, 2%' },
  { art: P4, say: ['중앙은 미궁관리국을 새로 두었다.'], ms: 4600, kb: '-1%, -2%' },
  { art: P5, say: ['길드에 명령할 수는 없다.', '공고와 편지로 움직일 뿐.'], ms: 5400, kb: '1%, 1%' },
  { art: P6, say: [], ms: 4200, kb: '0%, 0%', title: true },
];
export const SHOT_N = SHOTS.length;

export function openingHtml() {
  return `<div class="cut" role="dialog" aria-label="첫 장면">
  ${SHOTS.map((s, i) => `<figure class="cut-p${s.title ? ' cut-title' : ''}" data-k="${i}" style="--dur:${s.ms}ms;--kb:${s.kb}">
    <div class="cut-art">${s.art}</div>
    ${s.title ? `<div class="cut-name"><small>왕도 · ${dateOf(0)}</small><h1>미 궁 관 리 국</h1><p>초대 국장, 오늘 부임.</p></div>` : `<figcaption>${s.say.map((t, j) => `<span style="animation-delay:${.5 + j * 1.1}s">${t}</span>`).join('')}</figcaption>`}
  </figure>`).join('')}
  <i class="cut-bar t" aria-hidden="true"></i><i class="cut-bar b" aria-hidden="true"></i><i class="cut-rain" aria-hidden="true"></i>
  <div class="cut-dots" aria-hidden="true">${SHOTS.map(() => '<b></b>').join('')}</div>
  <button type="button" class="cut-skip">건너뛰기 ›</button>
</div>`;
}

// 컷신을 띄운다. 끝나거나 건너뛰면 done(). 다시 부르면 처음부터
let stop: (() => void) | null = null;
export function playOpening(host: HTMLElement, done: () => void) {
  stop?.();
  host.innerHTML = openingHtml(); host.hidden = false;
  const root = host.firstElementChild as HTMLElement, ps = [...root.querySelectorAll<HTMLElement>('.cut-p')], dots = [...root.querySelectorAll('.cut-dots b')];
  let k = -1, timer = 0;
  const end = () => { stop?.(); done(); };
  const show = (n: number) => {
    if (n >= ps.length) return end();
    k = n;
    ps.forEach((p, i) => p.classList.toggle('on', i === n));
    dots.forEach((d, i) => d.classList.toggle('on', i <= n));
    root.dataset.k = String(n);
    clearTimeout(timer); timer = window.setTimeout(() => show(k + 1), SHOTS[n].ms);
  };
  const click = (e: Event) => { e.stopPropagation(); if ((e.target as Element).closest('.cut-skip')) end(); else show(k + 1); };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); end(); }
    else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); show(k + 1); }
    else e.stopImmediatePropagation();
  };
  root.addEventListener('click', click);
  window.addEventListener('keydown', key, true);
  stop = () => { clearTimeout(timer); window.removeEventListener('keydown', key, true); host.innerHTML = ''; host.hidden = true; stop = null; };
  show(0);
}
