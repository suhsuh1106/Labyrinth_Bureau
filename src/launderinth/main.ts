// Launderinth 화면: 상단바 · 영지 판(시설 카드) · 장부 조작소 · 건축 및 세탁소
import {
  World, Kind, newWorld, step, build, demolish, canBuild, BDEF, BUILD_ORDER, RANKS, L, TOWN, TOWN_AT, townStage, townScore, popOf, jobsOf,
  live, preview, needsOf, Day, delveUp, delveCost, lootMean, setBudget, BUDGET_KEYS, BUDGET_NAME, effOf, Book, upgrade, upCost, setPrice, PRICED, capOf, clampLed, washCap, count, deathRate, LOOK, monthDay, wantOf, slotsOf, firstFree,
} from './engine';
import { getSeed, setSeed } from '../core/rng';
import './style.css';

const KEY = 'lb-launder', VERSION = 8;
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');

// ── 판 ──────────────────────────────────────────────
let W: World;
function save() { try { localStorage.setItem(KEY, JSON.stringify({ v: VERSION, rng: getSeed(), W })); } catch { /* 저장이 막혀도 판은 계속 */ } }
function load(): World | null {
  try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && d.v === VERSION) { setSeed(d.rng); return d.W; } } catch { /* 새 판 */ }
  return null;
}
function fresh() { W = newWorld((Date.now() ^ 0x5eed) >>> 0); ui.sel = -1; ui.slot = -1; ui.slam = -1; save(); }
W = load() ?? newWorld((Date.now() ^ 0x5eed) >>> 0);

// ── 시간 ────────────────────────────────────────────
const SPEEDS = [0, 2.2, 0.8, 0.25]; // 하루가 걸리는 초
let speed = 0, acc = 0; // 시작은 멈춤: 읽고 놓고 나서 ▶
// sel: 칸 번호 · -1 없음 · -2 마을 · -5 미궁. slot: 카드를 놓으려고 고른 빈 칸
const ui = { tab: 'park' as 'park' | 'ledger' | 'build', sel: -1, slot: -1, slam: -1 };

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (speed && !W.over) {
    acc += dt;
    while (acc >= SPEEDS[speed]) { acc -= SPEEDS[speed]; dayTick(); if (W.over) break; }
  }
  requestAnimationFrame(frame);
}

function dayTick() {
  const nBooks = W.books.length;
  const before = { notes: W.notes.length, top: W.notes[0] };
  step(W);
  if (W.notes[0] !== before.top) flashNote();
  if (W.books.length > nBooks && !W.over) openBook(W.books[W.books.length - 1]);
  save();
  renderBar(); renderBoard();
  if (W.day % 2 === 0 || ui.tab !== 'build') renderPanel();
  if (W.over) renderOver();
}

// ── 영지 판 ─────────────────────────────────────────
const TAGC: Record<string, string> = { 세탁: 'text-black', 체면: 'text-moss', 영업: 'text-clean' };
const ART: Record<Kind, string> = { inn: '#4a3a28', tavern: '#4a2f2a', rental: '#3a3a3c', chapel: '#2e3a44', lodge: '#33412f', hospital: '#2d3b3a', casino: '#3d2a40', cathedral: '#3d3a2a', guild: '#3a3326', theater: '#44303a', auction: '#3d3322' };
function boardHtml(): string {
  const open = slotsOf(W), nextOpen = W.rank < RANKS.length - 1 ? L.SLOTS[W.rank + 1] : open;
  const cards: string[] = [];
  const dg = W.stat.hist.slice(-5), vday = dg.length ? Math.round(dg.reduce((a, d) => a + d.v, 0) / dg.length) : 0;
  cards.push(`<button data-sel="-5" class="card fixed ${ui.sel === -5 ? 'on' : ''}"><div class="art" style="background:#2c3d33">⛰</div><div class="ttl"><b>미궁</b><i>${W.delve}층</i></div><div class="fx">전리품 <span class="text-clean">${Math.round(lootMean(W))}</span> · 사망 <span class="${deathRate(W) > 0.09 ? 'text-blood' : ''}">${Math.round(deathRate(W) * 100)}%</span></div><div class="st">하루 ${vday}명 입장</div></button>`);
  cards.push(`<button data-sel="-2" class="card fixed ${ui.sel === -2 ? 'on' : ''}"><div class="art" style="background:#3a4a30">🏘</div><div class="ttl"><b>${TOWN[townStage(W)]}</b><i>${RANKS[W.rank]}</i></div><div class="fx">주민 <span class="text-paper">${popOf(W)}</span>명</div><div class="st">칸 ${live(W).length}/${open}</div></button>`);
  for (let i = 0; i < Math.max(open, nextOpen); i++) {
    const t = W.tiles[i];
    if (i >= open) { cards.push(`<div class="slot lock"><b>🔒</b><small>${RANKS[W.rank + 1]} 승급 시</small></div>`); continue; }
    if (!t.b) { cards.push(`<button data-slot="${i}" class="slot ${ui.slot === i ? 'on' : ''}"><b>＋ 카드 놓기</b><small>빈 칸</small></button>`); continue; }
    const d = BDEF[t.b], ts = W.stat.tile[i], today = W.today.byTile[i] ?? 0;
    const eff = d.cap ? `수용 ${capOf(W, i)}/일` : d.wash ? `세탁 한도 ${fmt(Math.round(d.wash * (1 + L.UP_CAP * (t.lv - 1))))}` : d.fx;
    const gear = t.lv > 1 ? `<div class="gear">${Array.from({ length: t.lv - 1 }, () => '<b>▲</b>').join('')}</div>` : '';
    cards.push(`<button data-sel="${i}" class="card lv${t.lv} ${ui.sel === i ? 'on' : ''} ${ui.slam === i ? 'slam' : ''}">${today && W.day > 0 ? `<span class="fl">+${today}</span>` : ''}<div class="art" style="background:${ART[t.b]}">${d.icon}</div><div class="ttl"><b>${d.name}</b><i>Lv${t.lv}</i></div><div class="fx">${eff}</div><div class="st">${ts ? `손님 ${fmt(ts.served)} · 누계 ${fmt(ts.rev)}` : '영업 전'}</div>${gear}</button>`);
  }
  ui.slam = -1;
  return cards.join('');
}
function renderBoard() { $('#board').innerHTML = boardHtml(); }

// ── 상단바 ──────────────────────────────────────────
function renderBar() {
  const { m, d } = monthDay(W);
  const r = Math.round(W.risk);
  const rc = r < 30 ? 'bg-moss' : r < 60 ? 'bg-clean' : 'bg-blood';
  const audit = W.audit ? `<span class="pulse-red rounded bg-blood/20 px-1.5 py-0.5 text-blood text-[11px]">감사관 D-${Math.max(0, W.audit.due - W.day)}</span>` : '';
  $('#bar').innerHTML = `
  <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2">
    <div class="flex items-baseline gap-2 mr-1">
      <span class="font-serif text-lg font-bold tracking-wide">Launderinth</span>
      <span class="hidden sm:inline text-[11px] text-dim">변방 미궁 영지</span>
    </div>
    <div class="flex items-center gap-1.5">
      <span class="text-[11px] text-dim">계급</span>
      <span class="rounded border border-clean/60 px-1.5 py-0.5 font-serif text-sm text-clean">${RANKS[W.rank]}</span>
    </div>
    <div class="flex items-center gap-2 min-w-[150px]">
      <span class="text-[11px] text-dim whitespace-nowrap">감사 위험도</span>
      <div class="relative h-2 w-20 rounded bg-line overflow-hidden"><div class="${rc} absolute inset-y-0 left-0" style="width:${r}%"></div></div>
      <span class="num text-sm ${r >= 60 ? 'text-blood' : ''}">${r}%</span>${audit}
    </div>
    <div class="flex items-center gap-1.5"><span class="text-[11px] text-dim">합법 자금</span><span class="num text-sm text-clean">${fmt(W.clean)}</span></div>
    <div class="flex items-center gap-1.5"><span class="text-[11px] text-dim">비자금</span><span class="num text-sm text-black">${fmt(W.black)}</span></div>
    <div class="ml-auto flex items-center gap-2">
      <span class="num text-xs text-dim">${m}월 ${d}일 · 임기 ${L.TERM}월</span>
      <div class="flex overflow-hidden rounded border border-line text-xs">
        ${['⏸', '▶', '▶▶', '▶▶▶'].map((s, k) => `<button data-speed="${k}" class="px-2 py-1 ${speed === k ? 'bg-clean text-ink' : 'text-dim hover:bg-felt'}" aria-label="속도 ${k}">${s}</button>`).join('')}
      </div>
    </div>
  </div>`;
}

// ── 패널 ────────────────────────────────────────────
function stepper(key: string, val: string, sub = '') {
  return `<div class="flex items-center gap-1">
    <button data-dec="${key}" class="h-7 w-7 rounded border border-line text-dim hover:bg-felt hover:text-paper">−</button>
    <span class="num w-16 text-center text-sm">${val}</span>
    <button data-inc="${key}" class="h-7 w-7 rounded border border-line text-dim hover:bg-felt hover:text-paper">+</button>
    ${sub ? `<span class="text-[11px] text-dim">${sub}</span>` : ''}
  </div>`;
}
const LOOK_COL = ['text-moss', 'text-clean', 'text-[#e08a3c]', 'text-blood'];

function ledgerHtml() {
  const p = preview(W), l = W.led, { d } = monthDay(W);
  const left = L.MONTH - d + 1;
  const next = W.rank < RANKS.length - 1 ? L.PROMOTE[W.rank] : 0;
  const prog = next ? Math.min(100, (W.favor + p.bribe) / next * 100) : 100;
  const row = (name: string, real: string, rep: string, ctl = '', cls = '') => `
    <div class="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-b border-[#cdbb95] py-1.5 ${cls}">
      <span class="text-[13px]">${name}</span><span class="num text-right text-[13px] text-[#6b5a3e]">${real}</span><span class="num text-right text-[13px] font-semibold">${rep}</span>
      ${ctl ? `<div class="col-span-3 pt-1 text-paper">${ctl}</div>` : ''}
    </div>`;
  return `
  <div class="flex items-baseline justify-between mb-2">
    <h2 class="font-serif text-base">${monthDay(W).m}월의 두 장부</h2>
    <span class="text-xs text-dim">봉인까지 <span class="num">${left}</span>일</span>
  </div>
  <div class="ledger-paper rounded-sm p-3 shadow-inner">
    <div class="grid grid-cols-[1fr_auto_auto] gap-x-3 pb-1 text-[11px] text-[#6b5a3e]"><span></span><span class="text-right">실제</span><span class="text-right">제국 신고</span></div>
    ${row('미궁 수익', fmt(p.real), fmt(p.reported), `<div class="rounded bg-ink/90 p-1.5 flex items-center justify-between"><span class="text-[11px] text-dim">신고율</span>${stepper('report', l.report + '%')}</div>`)}
    ${row('탐사대원 명부', fmt(W.mo.visits), fmt(p.registered), `<div class="rounded bg-ink/90 p-1.5 flex items-center justify-between"><span class="text-[11px] text-dim">유령 대원</span>${stepper('ghosts', l.ghosts + '명')}</div>`)}
    ${row('사망자 장비', fmt(W.mo.gear), l.smuggle ? `밀수 ${fmt(p.gearSold)}` : '유족 반환', `<div class="rounded bg-ink/90 p-1.5 flex items-center justify-between"><span class="text-[11px] text-dim">밀수 비율</span>${stepper('smuggle', l.smuggle + '%')}</div>`)}
    ${row('제국 세금', '', '−' + fmt(p.tax))}
    ${row('개척 보조금', '', '+' + fmt(p.subsidy))}
    ${row('상납', '', p.bribe ? '−' + fmt(p.bribe) : '0', `<div class="rounded bg-ink/90 p-1.5 flex items-center justify-between"><span class="text-[11px] text-dim">합법 자금에서</span>${stepper('bribe', fmt(l.bribe))}</div>`)}
    <div class="relative mt-2 flex items-end justify-between">
      <div class="text-[12px] leading-5">
        <div>금고 → 비자금 <span class="num font-semibold text-[#7a2e63]">${fmt(p.skim + p.ghostCut + p.gearSold)}</span></div>
        <div class="text-[11px] text-[#6b5a3e]">누락 ${fmt(p.skim)} · 유령 ${fmt(p.ghostCut)} · 밀수 ${fmt(p.gearSold)}</div>
      </div>
      <div class="text-center">
        <div class="text-[10px] text-[#6b5a3e] mb-0.5">대조 소견</div>
        <span class="stamp inline-block rounded-sm px-2 py-0.5 font-serif text-sm font-bold ${LOOK_COL[p.look]}" style="background:#0000">${LOOK[p.look]}</span>
      </div>
    </div>
  </div>
  <div class="mt-3 rounded border border-line p-2.5">
    <div class="flex items-baseline justify-between text-xs"><span class="text-dim">${W.rank < RANKS.length - 1 ? RANKS[W.rank + 1] + ' 청원' : RANKS[W.rank]}</span><span class="num text-dim">${fmt(W.favor)}${next ? ' / ' + fmt(next) : ''}</span></div>
    <div class="mt-1.5 h-1.5 rounded bg-line overflow-hidden"><div class="h-full bg-clean" style="width:${prog}%"></div></div>
  </div>
  <div class="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] text-dim">
    <div class="rounded border border-line py-1.5">세율<div class="num text-sm text-paper">${Math.round(L.TAX[W.rank] * 100)}%</div></div>
    <div class="rounded border border-line py-1.5">사망률<div class="num text-sm text-paper">${Math.round(deathRate(W) * 100)}%</div></div>
    <div class="rounded border border-line py-1.5">오늘 발길<div class="num text-sm text-paper">${W.today.visits}명</div></div>
  </div>`;
}

function buildHtml() {
  const free = firstFree(W), target = ui.slot >= 0 && !W.tiles[ui.slot].b ? ui.slot : free;
  const cards = BUILD_ORDER.map(k => {
    const d = BDEF[k], why = target < 0 ? '빈 칸 없음' : canBuild(W, target, k), own = count(W, k);
    const lock = d.rank > W.rank, poor = W.clean < d.cost;
    const tagc = TAGC[d.tag] ?? 'text-dim';
    return `<button data-place="${k}" ${why ? 'disabled' : ''} class="text-left rounded border border-line ${why ? 'opacity-45' : 'hover:bg-felt'} p-2">
      <div class="flex items-center justify-between"><span class="text-lg leading-none">${d.icon}</span><span class="text-[10px] ${tagc}">${d.tag}</span></div>
      <div class="mt-1 font-serif text-sm">${d.name} <span class="num text-[11px] text-dim">${own}/${d.max}</span></div>
      <div class="num text-xs ${poor && !lock ? 'text-blood' : 'text-clean'}">${fmt(d.cost)} <span class="text-dim">· 유지 ${d.upkeep}</span></div>
      <div class="text-[10px] text-dim">${lock ? RANKS[d.rank] + ' 이상' : d.fx}</div>
    </button>`;
  }).join('');
  const wash = (k: 'casino' | 'cathedral') => {
    const d = BDEF[k], cap = washCap(W, k), n = count(W, k);
    if (!n) return `<div class="rounded border border-dashed border-line p-2.5 text-xs text-dim">${d.icon} ${d.name} 없음</div>`;
    const done = W.mo.washed[k], goal = W.led.wash[k];
    return `<div class="rounded border border-line p-2.5">
      <div class="flex items-baseline justify-between"><span class="font-serif text-sm">${d.icon} ${d.name} <span class="num text-dim text-xs">×${n}</span></span><span class="text-[11px] text-dim">수수료 <span class="num">${Math.round(d.cut * 100)}%</span> · 한도 <span class="num">${fmt(cap)}</span></span></div>
      <div class="mt-2 flex items-center justify-between"><span class="text-[11px] text-dim">이번 달 세탁</span>${stepper('wash.' + k, fmt(goal))}</div>
      <div class="mt-2 h-1.5 rounded bg-line overflow-hidden"><div class="h-full bg-black" style="width:${goal ? Math.min(100, done / goal * 100) : 0}%"></div></div>
      <div class="mt-1 flex justify-between text-[11px] text-dim"><span>씻김 <span class="num text-paper">${fmt(done)}</span></span><span>합법 자금으로 <span class="num text-clean">${fmt(done * (1 - d.cut))}</span></span></div>
    </div>`;
  };
  return `
  <div class="flex items-baseline justify-between mb-2"><h2 class="font-serif text-base">카드 놓기</h2>
    <span class="text-[11px] text-dim">${firstFree(W) < 0 ? '빈 칸 없음 · 카드를 내려야 한다' : ui.slot >= 0 ? `${ui.slot + 1}번 칸에 놓는다` : '빈 칸 ' + (slotsOf(W) - live(W).length) + '개'}</span></div>
  <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 gap-2">${cards}</div>
  <h2 class="font-serif text-base mt-4 mb-2">세탁소</h2>
  <div class="space-y-2">${wash('casino')}${wash('cathedral')}</div>
  <div class="mt-2 text-[11px] text-dim">비자금 <span class="num text-black">${fmt(W.black)}</span></div>`;
}

function spark(vals: number[], color: string, h = 44) {
  const n = Math.max(2, vals.length), mx = Math.max(1, ...vals), w = 300;
  const pts = vals.map((v, i) => `${(i / (n - 1) * w).toFixed(1)},${(h - 3 - (v / mx) * (h - 8)).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" class="w-full" style="height:${h}px" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" vector-effect="non-scaling-stroke"/>
  </svg>`;
}
function townHtml() {
  const st = townStage(W), j = jobsOf(W), sc = townScore(W), next = TOWN_AT[st + 1];
  const pct = next ? Math.max(0, Math.min(100, (sc - TOWN_AT[st]) / (next - TOWN_AT[st]) * 100)) : 100;
  const chip = (n: string, v: number, c: string) => `<div class="rounded border border-line py-1 text-center"><div class="text-[11px] text-dim">${n}</div><div class="num text-sm ${c}">${v}</div></div>`;
  return `<div class="rounded border ${ui.sel === -2 ? 'border-clean/60' : 'border-line'} bg-felt/60 p-2.5">
    <div class="flex items-baseline justify-between"><span class="font-serif text-sm">🏘 ${TOWN[st]}</span><span class="text-[11px] text-dim">주민 <span class="num text-paper">${j.pop}</span> · 마을세 <span class="num text-clean">+${Math.round(j.pop * L.TOWN_TAX * L.MONTH)}</span>/달</span></div>
    <div class="mt-2 grid grid-cols-4 gap-1.5">${chip('농부', j.farm, 'text-moss')}${chip('장사', j.trade, 'text-paper')}${chip('숙박', j.inn, 'text-paper')}${chip('안내', j.guide, 'text-clean')}</div>
    <div class="mt-2 flex items-center gap-2 text-[11px] text-dim"><span>${next ? TOWN[st + 1] : '더 클 곳이 없다'}</span><div class="h-1.5 flex-1 rounded bg-line overflow-hidden"><div class="h-full bg-clean" style="width:${pct}%"></div></div></div>
  </div>`;
}
function selHtml() {
  const i = ui.sel; if (i < 0 || !W.tiles[i].b) return '';
  const t = W.tiles[i], d = BDEF[t.b!], ts = W.stat.tile[i], c = upCost(W, i);
  const eff = d.cap ? `수용 <span class="num text-paper">${capOf(W, i)}</span>/일` : d.wash ? `세탁 한도 <span class="num text-paper">${fmt(Math.round(d.wash * (1 + L.UP_CAP * (t.lv - 1))))}</span>/달` : '';
  return `<div class="rounded border border-clean/60 bg-felt p-2.5">
    <div class="flex items-center justify-between"><span class="font-serif text-sm">${d.icon} ${d.name} <span class="num text-clean text-xs">${'▲'.repeat(t.lv - 1) || '1단계'}</span></span>
      <button data-act="del" class="text-[11px] text-dim hover:text-blood">철거</button></div>
    <div class="mt-1 flex flex-wrap gap-x-4 text-[11px] text-dim">${eff}${ts ? `<span>손님 <span class="num text-paper">${fmt(ts.served)}</span></span><span>누계 <span class="num text-clean">${fmt(ts.rev)}</span></span>` : ''}</div>
    ${c ? `<button data-act="up" class="mt-2 w-full rounded border ${W.clean >= c ? 'border-clean text-clean hover:bg-clean/10' : 'border-line text-dim'} py-1.5 text-sm">업그레이드 <span class="num">${fmt(c)}</span></button>` : `<div class="mt-2 text-[11px] text-dim">${t.lv >= L.UP_MAX ? '최고 단계' : ''}</div>`}
  </div>`;
}
function delveHtml() {
  const h = W.stat.hist.slice(-10), n = h.reduce((a, d) => a + d.v, 0), d = h.reduce((a, x) => a + x.d, 0), l = h.reduce((a, x) => a + x.l, 0);
  const surv = n ? Math.round((1 - d / n) * 100) : 100, avg = n - d > 0 ? Math.round(l / (n - d)) : Math.round(lootMean(W));
  const c = delveCost(W), back = h.length ? Math.round(h.reduce((a, x) => a + x.b, 0) / h.length * 10) / 10 : 0;
  const cell = (t: string, v: string, col = 'text-paper') => `<div class="rounded border border-line py-1.5 text-center"><div class="text-[11px] text-dim">${t}</div><div class="num text-sm ${col}">${v}</div></div>`;
  return `<div class="rounded border ${ui.sel === -5 ? 'border-clean/60' : 'border-line'} bg-felt/60 p-2.5">
    <div class="flex items-baseline justify-between"><span class="font-serif text-sm">🕳 미궁 <span class="num text-clean text-xs">${W.delve}층</span></span><span class="text-[11px] text-dim">재방문 <span class="num text-paper">${back}</span>명/일</span></div>
    <div class="mt-2 grid grid-cols-3 gap-2">${cell('생환율', surv + '%', surv < 85 ? 'text-blood' : 'text-paper')}${cell('전리품', avg + '/명', 'text-clean')}${cell('최근 열흘', fmt(l), 'text-clean')}</div>
    ${c ? `<button data-act="delve" class="mt-2 w-full rounded border ${W.clean >= c ? 'border-clean text-clean hover:bg-clean/10' : 'border-line text-dim'} py-1.5 text-sm">${W.delve + 1}층 개척 <span class="num">${fmt(c)}</span></button>` : '<div class="mt-2 text-[11px] text-dim">가장 깊은 층까지 열렸다</div>'}
  </div>`;
}
// 월별 손익 막대(위로 +, 아래로 −)와 금고 · 비자금 꺾은선
function trendHtml() {
  const bs = W.books;
  if (!bs.length) return `<div class="rounded border border-dashed border-line p-3 text-center text-xs text-dim">첫 결산이 나오면 월별 추이가 그려진다</div>`;
  const slots = Math.max(6, L.TERM), w = 300, h = 74, mid = h / 2, bw = w / slots;
  const mx = Math.max(1, ...bs.map(b => Math.abs(b.net)));
  const bars = bs.map((b, i) => {
    const bh = Math.max(1.5, Math.abs(b.net) / mx * (mid - 6)), x = i * bw + bw * 0.18, y = b.net >= 0 ? mid - bh : mid;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${bh.toFixed(1)}" rx="1" fill="${b.net >= 0 ? '#d9b45a' : '#c2483d'}"/>`;
  }).join('');
  const ticks = bs.map((b, i) => (b.m % 3 === 0 || i === bs.length - 1) ? `<text x="${(i * bw + bw / 2).toFixed(1)}" y="${h + 10}" text-anchor="middle" font-size="8" fill="#a79878" font-family="IBM Plex Mono">${b.m}</text>` : '').join('');
  const last = bs[bs.length - 1], sum = bs.reduce((a, b) => a + b.net, 0);
  const lh = 50, ly = (v: number, top: number) => (lh - 4 - (v / top) * (lh - 10)).toFixed(1);
  const top = Math.max(1, ...bs.map(b => Math.max(b.to, b.black ?? 0)));
  const line = (f: (b: Book) => number, col: string) => bs.length < 2 ? '' : `<polyline fill="none" stroke="${col}" stroke-width="1.8" vector-effect="non-scaling-stroke" points="${bs.map((b, i) => `${(i * bw + bw / 2).toFixed(1)},${ly(f(b), top)}`).join(' ')}"/>`;
  const dot = (f: (b: Book) => number, col: string) => `<circle cx="${((bs.length - 1) * bw + bw / 2).toFixed(1)}" cy="${ly(f(last), top)}" r="2.6" fill="${col}"/>`;
  return `<div class="rounded border border-line p-2">
    <div class="flex items-baseline justify-between text-[11px] text-dim"><span>월 손익</span><span class="num ${sum >= 0 ? 'text-clean' : 'text-blood'}">누계 ${sum >= 0 ? '+' : '−'}${fmt(Math.abs(sum))}</span></div>
    <svg viewBox="0 0 ${w} ${h + 12}" class="w-full" style="height:${h + 12}px" preserveAspectRatio="none" aria-label="월별 손익">
      <line x1="0" x2="${w}" y1="${mid}" y2="${mid}" stroke="#3a3226" stroke-width="1"/>${bars}${ticks}</svg>
    <div class="mt-2 flex items-center gap-3 text-[11px] text-dim"><span><i class="inline-block h-0.5 w-3 align-middle bg-clean"></i> 금고 <span class="num text-clean">${fmt(last.to)}</span></span><span><i class="inline-block h-0.5 w-3 align-middle bg-black"></i> 비자금 <span class="num text-black">${fmt(last.black ?? 0)}</span></span></div>
    <svg viewBox="0 0 ${w} ${lh}" class="w-full" style="height:${lh}px" preserveAspectRatio="none" aria-label="금고와 비자금">${line(b => b.to, '#d9b45a')}${line(b => b.black ?? 0, '#b4609a')}${dot(b => b.to, '#d9b45a')}${dot(b => b.black ?? 0, '#b4609a')}</svg>
  </div>`;
}
function parkHtml() {
  const st = W.stat, h = st.hist, last30 = h.slice(-30);
  const sum = (a: Day[], f: (d: Day) => number) => a.reduce((x, d) => x + f(d), 0);
  const mV = sum(last30, d => d.v), mR = sum(last30, d => d.r), mD = sum(last30, d => d.d);
  const stars = Math.max(0, Math.min(5, Math.round((W.rep - 0.5) / 0.9 * 5)));
  const sat = h.slice(-10).length ? Math.round(sum(h.slice(-10), d => d.s) / h.slice(-10).length) : 0;
  const kpi = (l: string, v: string, c = 'text-paper') => `<div class="rounded border border-line py-1.5 text-center"><div class="text-[11px] text-dim">${l}</div><div class="num text-sm ${c}">${v}</div></div>`;
    const rows: string[] = [];
  rows.push(`<tr class="border-b border-line/60"><td class="py-1.5">🎫 입장료</td><td class="num text-right">${fmt(st.visits)}</td><td class="num text-right text-clean">${fmt(st.fee)}</td><td></td></tr>`);
  for (const k of PRICED) {
    const ks = st.kind[k], own = count(W, k), lv = count(W, k);
    if (!ks && !own) continue;
    const cap = live(W).filter(i => W.tiles[i].b === k).reduce((a, i) => a + capOf(W, i), 0);
    const use = cap && W.today.visits ? Math.min(100, Math.round(Math.min(cap, W.today.visits * (wantOf(W.price[k]))) / cap * 100)) : 0;
    rows.push(`<tr class="border-b border-line/60"><td class="py-1.5">${BDEF[k].icon} ${BDEF[k].name} <span class="text-dim text-[11px]">×${own}${lv ? ' · 가동 ' + use + '%' : ''}</span></td><td class="num text-right">${fmt(ks?.served ?? 0)}</td><td class="num text-right text-clean">${fmt(ks?.rev ?? 0)}</td><td class="py-1">${stepper('price.' + k, W.price[k] + '%')}</td></tr>`);
  }
  const needs = needsOf(W).map(n => {
    const c = n.sev === 3 ? 'border-blood text-blood' : n.sev === 2 ? 'border-[#e08a3c] text-[#e08a3c]' : 'border-line text-dim';
    return `<div class="flex items-center gap-2 rounded border ${c} px-2 py-1.5"><span class="num text-[11px]">${'●'.repeat(n.sev)}</span><div class="flex-1"><div class="text-[13px] text-paper">${n.what}</div>${n.hint ? `<div class="text-[11px] text-dim">${n.hint}</div>` : ''}</div>${n.kind ? `<button data-pick="${n.kind}" class="rounded border border-line px-2 py-0.5 text-[11px] text-paper hover:bg-felt">${BDEF[n.kind].name} 짓기</button>` : ''}</div>`;
  }).join('');
  const best = Object.entries(st.tile).sort((a, b) => b[1].rev - a[1].rev).slice(0, 3).filter(e => e[1].rev > 0);
  return `${selHtml()}${selHtml() ? '<div class="h-3"></div>' : ''}${townHtml()}<div class="h-3"></div>${delveHtml()}
  <div class="grid grid-cols-3 gap-2 mt-3">
    ${kpi('오늘 입장객', W.today.visits + '명')}${kpi('최근 30일', fmt(mV) + '명')}${kpi('누적', fmt(st.visits) + '명')}
    ${kpi('평판', '★'.repeat(stars) + '☆'.repeat(5 - stars), 'text-clean')}${kpi('사망률', Math.round(deathRate(W) * 100) + '%', deathRate(W) > 0.09 ? 'text-blood' : 'text-paper')}${kpi('손님 만족', h.length ? sat + '점' : '–', h.length && sat < 55 ? 'text-blood' : 'text-paper')}
  </div>
  <h2 class="font-serif text-base mt-4 mb-1">입장객 · 매상 <span class="text-[11px] text-dim">최근 30일</span></h2>
  <div class="rounded border border-line p-2">
    <div class="flex items-baseline justify-between text-[11px] text-dim"><span>입장객</span><span class="num text-paper">${fmt(mV)}</span></div>${spark(last30.map(d => d.v), '#7fa36b')}
    <div class="mt-1 flex items-baseline justify-between text-[11px] text-dim"><span>매상</span><span class="num text-clean">${fmt(mR)}</span></div>${spark(last30.map(d => d.r), '#d9b45a')}
  </div>
  <h2 class="font-serif text-base mt-4 mb-1">월별 추이</h2>
  ${trendHtml()}
  <h2 class="font-serif text-base mt-4 mb-1">수입원</h2>
  <table class="w-full text-[13px]"><thead><tr class="text-[11px] text-dim"><th class="text-left font-normal"></th><th class="text-right font-normal">손님</th><th class="text-right font-normal">매상</th><th class="text-right font-normal">요금</th></tr></thead><tbody>${rows.join('')}</tbody>
  <tfoot><tr><td class="pt-1.5 text-dim">유지비 누계</td><td></td><td class="num text-right text-blood pt-1.5">−${fmt(st.upkeep)}</td><td></td></tr></tfoot></table>
  ${best.length ? `<div class="mt-1.5 text-[11px] text-dim">잘 버는 곳 ${best.map(([i, t]) => `${BDEF[W.tiles[+i].b!].icon}<span class="num"> ${fmt(t.rev)}</span>`).join(' · ')}</div>` : ''}
  <h2 class="font-serif text-base mt-4 mb-1">월 예산 <span class="text-[11px] text-dim">달마다 나감 · <span class="num">${fmt(W.budget.promo + W.budget.safety + W.budget.upkeep)}</span></span></h2>
  <div class="space-y-1.5">${BUDGET_KEYS.map(k => {
    const v = W.budget[k], e = k === 'promo' ? effOf(v, L.BUD_PROMO) * L.BUD_PULL * 100 : k === 'safety' ? effOf(v, L.BUD_SAFE) * L.BUD_DEATH * 100 : effOf(v, L.BUD_CARE) * L.BUD_SAT;
    const eff = k === 'promo' ? `발길 +${e.toFixed(0)}%` : k === 'safety' ? `사망률 −${e.toFixed(1)}%p` : `만족 +${e.toFixed(0)}`;
    return `<div class="flex items-center justify-between rounded border border-line px-2 py-1.5"><div><div class="text-[13px]">${BUDGET_NAME[k]}</div><div class="num text-[11px] ${v ? 'text-moss' : 'text-dim'}">${eff}</div></div>${stepper('bud.' + k, fmt(v))}</div>`;
  }).join('')}</div>
  ${W.books.length ? `<button data-act="book" class="mt-3 w-full rounded border border-line py-1.5 text-sm hover:bg-felt">${W.books[W.books.length - 1].m}월 결산 <span class="num ${W.books[W.books.length - 1].net >= 0 ? 'text-clean' : 'text-blood'}">${W.books[W.books.length - 1].net >= 0 ? '+' : '−'}${fmt(Math.abs(W.books[W.books.length - 1].net))}</span></button>` : ''}
  <h2 class="font-serif text-base mt-4 mb-1">필요한 것</h2>
  <div class="space-y-1.5">${needs}</div>`;
}

let resume = 1;
function openBook(b: Book) {
  if (speed) resume = speed;
  const prev = W.books.length > 1 ? W.books[W.books.length - 2] : null;
  const rows: [string, number, string?][] = [];
  const inc: [string, number][] = [['입장료', b.fee], ...(PRICED as readonly Kind[]).filter(k => b.sales[k]).map(k => [BDEF[k].icon + ' ' + BDEF[k].name, b.sales[k]!] as [string, number]), ['개척 보조금', b.subsidy], ['세탁 유입', b.wash]];
  const out: [string, number][] = [['시설 유지비', b.upkeep], ['월 예산', b.budget], ['건축 · 업그레이드', b.capex], ['제국 세금', b.tax], ['상납', b.bribe], ['비자금으로 빠짐', b.toBlack]];
  void rows;
  const sI = inc.reduce((a, [, v]) => a + v, 0), sO = out.reduce((a, [, v]) => a + v, 0);
  const line = (l: string, v: number, sign: string, c: string) => v ? `<div class="flex justify-between py-0.5 text-[13px]"><span>${l}</span><span class="num ${c}">${sign}${fmt(v)}</span></div>` : '';
  const delta = (n: number, p?: number) => p == null ? '' : `<span class="text-[10px] ${n >= p ? 'text-moss' : 'text-blood'}">${n >= p ? '▲' : '▼'}</span>`;
  const sat = b.guests ? Math.round(b.sat / b.guests) : 0, psat = prev && prev.guests ? Math.round(prev.sat / prev.guests) : undefined;
  speed = 0; renderBar();
  const el = $('#book'); el.classList.remove('hidden');
  el.innerHTML = `<div class="w-full max-w-md bg-[#efe3c7] text-[#2a2218] max-h-full overflow-y-auto scroll-thin rounded-sm p-4 shadow-2xl">
    <div class="flex items-baseline justify-between"><h2 class="font-serif text-lg">${b.m}월 결산</h2><span class="num text-xs text-[#6b5a3e]">금고 ${fmt(b.from)} → ${fmt(b.to)}</span></div>
    <div class="mt-2 grid grid-cols-3 gap-2 text-center text-[11px] text-[#6b5a3e]">
      <div>입장객<div class="num text-sm text-[#2a2218]">${fmt(b.visits)}${delta(b.visits, prev?.visits)}</div></div>
      <div>귀환 못 함<div class="num text-sm text-[#2a2218]">${fmt(b.deaths)}</div></div>
      <div>손님 만족<div class="num text-sm text-[#2a2218]">${sat}${delta(sat, psat)}</div></div>
    </div>
    <h3 class="mt-3 border-b border-[#cdbb95] pb-0.5 text-[11px] text-[#6b5a3e]">들어온 돈</h3>
    ${inc.map(([l, v]) => line(l, v, '+', 'text-[#2f5a1f]')).join('')}
    <div class="flex justify-between border-t border-[#cdbb95] py-0.5 text-[13px] font-semibold"><span>합계</span><span class="num">+${fmt(sI)}</span></div>
    <h3 class="mt-3 border-b border-[#cdbb95] pb-0.5 text-[11px] text-[#6b5a3e]">나간 돈</h3>
    ${out.map(([l, v]) => line(l, v, '−', 'text-[#8a2f26]')).join('')}
    <div class="flex justify-between border-t border-[#cdbb95] py-0.5 text-[13px] font-semibold"><span>합계</span><span class="num">−${fmt(sO)}</span></div>
    <div class="mt-3 flex items-baseline justify-between border-t-2 border-[#2a2218] pt-1.5"><span class="font-serif">이달 손익</span><span class="num text-lg font-semibold ${b.net >= 0 ? 'text-[#2f5a1f]' : 'text-[#8a2f26]'}">${b.net >= 0 ? '+' : '−'}${fmt(Math.abs(b.net))}</span></div>
    <button data-act="next" class="mt-3 w-full rounded bg-[#2a2218] py-2 font-serif text-paper">다음 달</button>
  </div>`;
}
function renderPanel() {
  document.querySelectorAll<HTMLElement>('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab)));
  const p = $('#panel'); const top = p.scrollTop;
  p.innerHTML = ui.tab === 'park' ? parkHtml() : ui.tab === 'ledger' ? ledgerHtml() : buildHtml();
  p.scrollTop = top;
}
function flashNote() {
  const n = W.notes[0]; const el = $('#ticker');
  const col = n.kind === 'bad' ? 'border-blood/70' : n.kind === 'warn' ? 'border-[#e08a3c]/70' : n.kind === 'good' ? 'border-clean/70' : 'border-line';
  el.innerHTML = `<div class="mx-auto max-w-xl rounded border ${col} bg-desk/95 px-3 py-2 font-serif text-[13px] leading-relaxed shadow-lg transition-opacity duration-700">${n.text}</div>`;
  const box = el.firstElementChild as HTMLElement;
  setTimeout(() => { box.style.opacity = '0'; }, 6500);
}

function renderOver() {
  const o = $('#over'); o.classList.remove('hidden');
  const T: Record<string, [string, string]> = {
    duke: ['공작', '수도의 연회장, 새 대공의 잔이 가장 먼저 채워졌다. 변방의 진흙길은 그 잔 속 어디에도 비치지 않았다.'],
    arrest: ['체포', '인장은 회수되었다. 두 권의 장부는 이제 한 권이 되어, 법정의 탁자 위에 놓인다.'],
    bankrupt: ['파산', '빚쟁이들의 장부가 영주의 장부보다 두꺼워졌다. 변방은 다음 이름을 기다린다.'],
    term: [RANKS[W.rank], '임기는 끝났고 관은 끝내 내려오지 않았다. 떠나는 마차의 짐이 무거운 것만은 아무도 묻지 않았다.'],
  };
  const [h, p] = T[W.over!];
  o.innerHTML = `<div class="max-w-md w-full rounded border border-line bg-desk p-5 text-center shadow-2xl">
    <div class="text-[11px] tracking-[.3em] text-dim">임기 끝</div>
    <div class="mt-1 font-serif text-3xl ${W.over === 'duke' ? 'text-clean' : W.over === 'term' ? 'text-paper' : 'text-blood'}">${h}</div>
    <p class="mt-3 font-serif text-sm leading-relaxed">${p}</p>
    <div class="mt-4 grid grid-cols-3 gap-2 text-[11px] text-dim">
      <div>달<div class="num text-sm text-paper">${monthDay(W).m}</div></div>
      <div>상납 누계<div class="num text-sm text-clean">${fmt(W.favor)}</div></div>
      <div>남은 비자금<div class="num text-sm text-black">${fmt(W.black)}</div></div>
    </div>
    <button data-act="new" class="mt-5 rounded bg-clean px-4 py-2 font-serif text-ink">새 임기</button>
  </div>`;
}

// ── 손 ──────────────────────────────────────────────
const STEP: Record<string, number> = { 'bud.promo': 100, 'bud.safety': 100, 'bud.upkeep': 100, report: 5, ghosts: 5, smuggle: 10, bribe: 250, 'wash.casino': 250, 'wash.cathedral': 250 };
function bump(key: string, dir: number, big: boolean) {
  const s = STEP[key] * (big ? 4 : 1) * dir; const l = W.led;
  if (key.startsWith('bud.')) { const k = key.slice(4) as typeof BUDGET_KEYS[number]; setBudget(W, k, W.budget[k] + s); save(); renderPanel(); return; }
  if (key.startsWith('price.')) { const k = key.slice(6) as typeof PRICED[number]; setPrice(W, k, W.price[k] + dir * 10 * (big ? 3 : 1)); save(); renderPanel(); return; }
  if (key.startsWith('wash.')) { const k = key.slice(5) as 'casino' | 'cathedral'; l.wash[k] += s; }
  else (l as any)[key] += s;
  if (key === 'bribe') l.bribe = Math.min(l.bribe, Math.max(0, Math.floor(W.clean / 50) * 50));
  clampLed(W); save(); renderPanel();
}
let holdT = 0;
document.addEventListener('pointerdown', e => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-inc],[data-dec]'); if (!b) return;
  const key = b.dataset.inc ?? b.dataset.dec!, dir = b.dataset.inc ? 1 : -1;
  bump(key, dir, e.shiftKey);
  let n = 0; clearInterval(holdT);
  holdT = window.setInterval(() => { n++; if (n > 3) bump(key, dir, n > 12); }, 110);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => document.addEventListener(t, () => clearInterval(holdT)));
document.addEventListener('click', e => {
  const el = e.target as HTMLElement;
  const tab = el.closest<HTMLElement>('[data-tab]'); if (tab) { ui.tab = tab.dataset.tab as any; renderPanel(); return; }
  const sp = el.closest<HTMLElement>('[data-speed]'); if (sp) { speed = +sp.dataset.speed!; renderBar(); return; }
  const act = el.closest<HTMLElement>('[data-act]')?.dataset.act;
  if (act === 'next') { $('#book').classList.add('hidden'); speed = resume || 1; renderBar(); return; }
  if (act === 'book' && W.books.length) { resume = speed || resume; openBook(W.books[W.books.length - 1]); return; }
  if (act === 'up' && ui.sel >= 0) {
    const why = upgrade(W, ui.sel);
    if (!why) { ui.slam = ui.sel; save(); }
    renderBar(); renderBoard(); renderPanel(); return;
  }
  if (act === 'delve') { if (!delveUp(W)) save(); renderBar(); renderBoard(); renderPanel(); return; }
  if (act === 'del' && ui.sel >= 0) { demolish(W, ui.sel); ui.slot = ui.sel; ui.sel = -1; save(); renderBar(); renderBoard(); renderPanel(); return; }
  const place = el.closest<HTMLElement>('[data-place]');
  if (place) {
    const k = place.dataset.place as Kind, at = ui.slot >= 0 && !W.tiles[ui.slot].b ? ui.slot : firstFree(W);
    if (at >= 0 && build(W, at, k)) { ui.slam = at; ui.sel = at; ui.slot = -1; ui.tab = 'park'; save(); renderBar(); renderBoard(); renderPanel(); }
    return;
  }
  const slot = el.closest<HTMLElement>('[data-slot]');
  if (slot) { ui.slot = +slot.dataset.slot!; ui.sel = -1; ui.tab = 'build'; renderBoard(); renderPanel(); return; }
  const sel = el.closest<HTMLElement>('[data-sel]');
  if (sel) { ui.sel = +sel.dataset.sel!; ui.slot = -1; ui.tab = 'park'; renderBoard(); renderPanel(); return; }
  const pick = el.closest<HTMLElement>('[data-pick]');
  if (pick) { ui.tab = 'build'; renderPanel(); return; }
  if (el.closest('[data-act="new"]')) { $('#over').classList.add('hidden'); fresh(); renderAll(); }
});
document.addEventListener('keydown', e => {
  if (e.key === ' ') { speed = speed ? 0 : 1; renderBar(); e.preventDefault(); }
  if (e.key === 'Escape') { ui.slot = -1; ui.sel = -1; renderBoard(); renderPanel(); }
});

function renderAll() { renderBar(); renderBoard(); renderPanel(); flashNote(); if (W.over) renderOver(); }
renderAll();
requestAnimationFrame(frame);
// 개발 확인용 손잡이
(window as any).LB = { get W() { return W; }, step: () => dayTick(), fresh: () => { fresh(); renderAll(); }, ui };
