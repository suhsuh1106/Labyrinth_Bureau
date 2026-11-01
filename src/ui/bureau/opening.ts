// 첫 장면: 부임 첫날 신문 앞에 도는 짧은 컷신(먹선 그림 여덟 장 · 한 장에 한두 줄).
// 세계(미궁이 열리고 길드가 캔다 · 드나드는 조가 마물을 솎는다) → 아무도 들지 않는 미궁에 마물이 차서 넘친다 → 폐광 범람 · 왕국군 → 관리국 신설 → 국장 부임
// 화면을 누르거나 Space · Enter · → 로 넘기고, 건너뛰기 · Esc로 바로 신문으로 간다. 고르는 단추는 없다.
// 그리기만 하고 판 상태에 쓰지 않으며 난수도 쓰지 않는다(산 능선의 들쭉날쭉은 해시).
import { dateOf } from './docs';

const INK = '#1d1712', SEP = '#3b2f22', PAPER = '#e8dcc0', RED = '#a3392b';
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

// 굴 아가리(멀리 보이는 미궁) · 안에서 새는 빛
const arch = (x: number, y: number, s: number, d = 0) => `<g transform="translate(${x},${y}) scale(${s})"><ellipse class="cut-glow" style="animation-delay:${d}s" cx="0" cy="-22" rx="46" ry="34" fill="#f0c070"/><path d="M-30,0 Q-30,-46 0,-50 Q30,-46 30,0 Z" fill="#0b0a09" stroke="${INK}" stroke-width="2"/></g>`;
// 길드 조원 하나: 몸 · 머리 · 짐 · 길드 깃발
const walker = (x: number, y: number, s: number, c: string) => `<g transform="translate(${x},${y}) scale(${s})"><path d="M14,-10 L14,-96" stroke="${INK}" stroke-width="3"/><path d="M14,-96 L44,-90 L14,-80 Z" fill="${c}" stroke="${INK}" stroke-width="1.5"/>
  <rect x="-20" y="-58" width="16" height="26" rx="4" fill="#6b5137" stroke="${INK}" stroke-width="1.5"/><path d="M-8,-60 L10,-60 L12,-14 L-10,-14 Z" fill="#3b2f22"/><circle cx="1" cy="-70" r="9" fill="#d9b48c" stroke="${INK}" stroke-width="1.5"/><path d="M-8,-14 L-10,0 M8,-14 L12,0" stroke="#3b2f22" stroke-width="5" stroke-linecap="round"/></g>`;

// 왕국 곳곳에 열린 미궁: 저물녘 능선 사이로 굴 아가리 셋이 빛난다
const W1 = svg(`${sky('s0', ['#3d4a5a', '#c99a6a', '#ecd3a0'])}
  ${ridge(360, 110, 7, '#7d6a58', 90)}${arch(300, 330, .7, .4)}
  ${ridge(450, 90, 8, '#5a4a3c', 80)}${arch(980, 420, .9, 1.1)}
  <path d="M0,720 L0,540 Q320,480 640,520 Q960,560 1280,500 L1280,720 Z" fill="#3a3027"/>${arch(560, 560, 1.5, 0)}
  <path d="M1280,640 Q900,600 760,590 Q640,580 600,566" stroke="#a8916a" stroke-width="6" fill="none" stroke-dasharray="14 10"/>`);

// 길드들이 미궁을 캔다: 깃발 든 조가 줄지어 들고, 소재 실은 수레가 나온다
const GC = ['#a8323e', '#4f6a8a', '#b8761c', '#1f6d86', '#7d4f9a', '#4f6b3a'];
const W2 = svg(`${sky('s1b', ['#a9b9c2', '#e6dcc2'])}
  ${ridge(380, 100, 9, '#8d8a7c', 100)}
  <path d="M380,720 L460,300 Q640,180 820,300 L920,720 Z" fill="#5c5046" stroke="${INK}" stroke-width="3"/><path d="M560,560 Q560,400 640,390 Q720,400 720,560 Z" fill="#0b0a09" stroke="${INK}" stroke-width="3"/>
  <path d="M0,720 L0,560 L1280,560 L1280,720 Z" fill="#6b5a46"/>
  ${GC.map((c, i) => walker(110 + i * 72, 600 - i * 6, 1.1 - i * .06, c)).join('')}
  <g transform="translate(900,612)"><rect x="-70" y="-50" width="140" height="44" fill="#6b5137" stroke="${INK}" stroke-width="2"/><path d="M-60,-50 l14,-24 l16,14 l18,-26 l14,22 l20,-18 l14,32 z" fill="#5d8fa8" stroke="${INK}" stroke-width="2"/>
  <circle cx="-44" cy="0" r="14" fill="#3b2f22"/><circle cx="44" cy="0" r="14" fill="#3b2f22"/><path d="M70,-30 L120,-40" stroke="${INK}" stroke-width="4"/></g>
  ${walker(1060, 612, 1, '#6b6258')}`);

const P1 = svg(`${sky('s1', ['#1c1f24', '#33373a', '#4a4a44'])}
  <circle cx="990" cy="150" r="110" fill="${PAPER}" opacity=".07"/><circle cx="990" cy="150" r="44" fill="${PAPER}" opacity=".8"/>
  ${ridge(430, 120, 1, '#3a3d3e')}${ridge(500, 80, 2, '#2c2b28', 70)}
  <path d="M0,720 L0,420 Q260,350 470,400 Q760,470 1280,560 L1280,720 Z" fill="#1f1c18"/>
  ${mouth(390, 446, 1.1)}<ellipse class="cut-glow" cx="390" cy="436" rx="20" ry="9" fill="#a8603a"/>
  <path d="M370,450 L330,720 M412,450 L470,720" stroke="#5a4a3a" stroke-width="5"/>${[0, 1, 2, 3, 4, 5].map(i => `<path d="M${355 - i * 7},${490 + i * 42} L${430 + i * 10},${490 + i * 42}" stroke="#5a4a3a" stroke-width="4"/>`).join('')}
  <path d="M560,430 L566,520" stroke="${INK}" stroke-width="6"/><rect x="520" y="420" width="96" height="30" fill="#6b5137" stroke="${INK}" stroke-width="2" transform="rotate(14 566 435)"/>
  <path d="M150,400 L160,300 M160,330 L130,300 M158,316 L190,282 M720,486 L728,400 M726,420 L750,396" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`);

// 범람: 마물로 가득 찬 미궁이 끝내 넘친다. 굴에서 마물 떼가 비탈을 타고 쏟아져 아랫마을을 덮친다(물이 아니다)
// 마물 하나: 웅크린 등 · 가시 · 두 눈 (먹 그림자)
const beast = (x: number, y: number, s: number, k: number) => `<g transform="translate(${x},${y}) scale(${s * (hash(k) < .5 ? -1 : 1)},${s})">
  <path d="M-26,0 Q-30,-22 -10,-30 L-6,-40 L0,-30 L6,-42 L10,-29 Q30,-24 28,0 Q14,6 0,2 Q-14,6 -26,0 Z" fill="#0f0d0b" stroke="${INK}" stroke-width="1.5"/>
  <path d="M-20,0 l-6,10 M-6,2 l-2,10 M10,2 l4,10 M22,0 l6,9" stroke="#0f0d0b" stroke-width="4" stroke-linecap="round"/></g>`;
// 비탈 위 떼의 자리: 굴 어귀(220, 260)에서 마을(1000, 600) 쪽으로 퍼지며 내려온다
const HORDE = Array.from({ length: 26 }, (_, i) => {
  const t = (i + hash(i * 7 + 1)) / 26, sp = 30 + t * 210;
  return { x: 220 + t * 760 + (hash(i * 7 + 2) - .5) * sp, y: 262 + t * 360 + (hash(i * 7 + 3) - .5) * sp * .45, s: .45 + t * .75, k: i };
});
const P2 = svg(`${sky('s2', ['#15171b', '#2a2224', '#4a2e26'])}
  ${ridge(300, 80, 3, '#262829')}
  <path d="M0,720 L0,190 Q170,160 330,230 Q520,320 640,720 Z" fill="#1c1a17"/>
  <path d="M0,720 L0,560 Q420,520 1280,560 L1280,720 Z" fill="#2b2620"/>
  ${mouth(220, 250, .9)}<ellipse class="cut-glow" cx="220" cy="232" rx="26" ry="16" fill="#c0502a"/>
  ${[0, 1, 2].map(i => `<ellipse class="cut-glow" style="animation-delay:${i * .6}s" cx="${880 + i * 150}" cy="${540 - i * 8}" rx="90" ry="60" fill="#d0662e"/>`).join('')}
  ${house(820, 600, 120)}${house(980, 610, 100)}${house(1140, 596, 130)}
  ${[820, 980, 1140].map((x, i) => `<path d="M${x - 10},${520 - i * 6} q-24,-50 6,-90 q28,-40 -4,-90" stroke="#3a302a" stroke-width="16" fill="none" stroke-linecap="round" opacity=".6"/>`).join('')}
  ${[...HORDE].sort((a, b) => a.y - b.y).map(b => beast(b.x, b.y, b.s, b.k)).join('')}
  ${HORDE.filter((_, i) => i % 3 === 1).map((b, i) => eyes(b.x - 8 * b.s, b.y - 20 * b.s, i * .4)).join('')}`);

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
  { art: W1, say: ['왕국의 산과 들 아래, 아무도 판 적 없는 굴이 열리기 시작한 지 서른 해.', '깊이 내려갈수록, 땅 위에는 없는 것들이 올라왔다.'], ms: 5600, kb: '0%, 2%' },
  { art: W2, say: ['길드는 그 굴을 광맥이라 불렀다.', '조가 드나드는 동안에는, 안쪽의 것들도 제 수를 넘지 못했다.'], ms: 5600, kb: '-2%, 0%' },
  { art: P1, say: ['길이 닿지 않는 굴은 장부에서도 지워졌다.', '로이드 산중의 폐광. 마지막 조가 나온 지 일곱 해째.'], ms: 5600, kb: '-2%, 1%' },
  { art: P2, say: ['안에서 불어난 것들이 끝내 갱도를 거슬러 올랐고,', '사흘 만에, 아랫마을 셋이 세금 장부에서 빠졌다.'], ms: 5600, kb: '2%, -1%' },
  { art: P3, say: ['국경에서 빼 온 창병 이천이 갱도 어귀에 말뚝을 박았다.', '창은 쏟아지는 것을 막을 뿐, 굴 안을 비우지는 못한다.'], ms: 5600, kb: '0%, 2%' },
  { art: P4, say: ['중앙은 관청 하나와 도장 하나를 내려보냈다.', '병사도, 명령권도 딸려 보내지 않은 채.'], ms: 5200, kb: '-1%, -2%' },
  { art: P5, say: ['길드는 왕의 신하가 아니다. 그들은 남는 곳으로 간다.', '국장의 손에 남은 것은 종이와, 빠듯한 예산뿐.'], ms: 5600, kb: '1%, 1%' },
  { art: P6, say: [], ms: 4200, kb: '0%, 0%', title: true },
];
export const SHOT_N = SHOTS.length;

export function openingHtml() {
  return `<div class="cut" role="dialog" aria-label="첫 장면">
  ${SHOTS.map((s, i) => `<figure class="cut-p${s.title ? ' cut-title' : ''}" data-k="${i}" style="--dur:${s.ms}ms;--kb:${s.kb}">
    <div class="cut-art">${s.art}</div>
    ${s.title ? `<div class="cut-name"><small>왕도 · ${dateOf(0)}</small><h1>미 궁 관 리 국</h1><p>초대 국장 부임</p></div>` : `<figcaption>${s.say.map((t, j) => `<span style="animation-delay:${.5 + j * 1.1}s">${t}</span>`).join('')}</figcaption>`}
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
