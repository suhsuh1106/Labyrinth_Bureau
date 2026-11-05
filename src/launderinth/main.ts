// Launderinth 화면: 상단바 · 탑뷰 타일맵(캔버스) · 장부 조작소 · 건축 및 세탁소
import {
  World, Kind, newWorld, step, build, canBuild, demolish, BDEF, BUILD_ORDER, RANKS, L, MW, MH, idx, xy, nbrs, wantOf,
  roadNet, live, preview, needsOf, Day, setBudget, BUDGET_KEYS, BUDGET_NAME, effOf, Book, upgrade, upCost, setPrice, PRICED, capOf, clampLed, washCap, count, deathRate, LOOK, monthDay,
} from './engine';
import { getSeed, setSeed } from '../core/rng';
import './style.css';

const KEY = 'lb-launder', VERSION = 4;
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');

// ── 판 ──────────────────────────────────────────────
let W: World;
function save() { try { localStorage.setItem(KEY, JSON.stringify({ v: VERSION, rng: getSeed(), W })); } catch { /* 저장이 막혀도 판은 계속 */ } }
function load(): World | null {
  try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && d.v === VERSION) { setSeed(d.rng); return d.W; } } catch { /* 새 판 */ }
  return null;
}
function fresh() { W = newWorld((Date.now() ^ 0x5eed) >>> 0); resetFx(); save(); }
W = load() ?? newWorld((Date.now() ^ 0x5eed) >>> 0);

// 화면 연출용 난수: 판의 난수(rnd)를 건드리지 않는다
let fxs = 12345;
const fx = () => { fxs = (fxs * 1664525 + 1013904223) >>> 0; return fxs / 4294967296; };

// ── 시간 ────────────────────────────────────────────
const SPEEDS = [0, 2.2, 0.8, 0.25]; // 하루가 걸리는 초
let speed = 1, acc = 0;
let ui = { tab: 'park' as 'park' | 'ledger' | 'build', tool: null as Kind | 'demolish' | null, hover: -1, pending: -1, tipAt: -1, sel: -1 };

// ── 연출 상태 ────────────────────────────────────────
interface Agent { path: number[]; seg: number; t: number; wait: number; hue: number; stopAt: number; doom: boolean }
interface Float { x: number; y: number; text: string; color: string; t: number }
interface Dust { x: number; y: number; vx: number; vy: number; t: number }
let agents: Agent[] = [], floats: Float[] = [], dust: Dust[] = [], shake = 0;
let queue: { at: number; doom: boolean }[] = [];
let netCache: { key: string; net: Set<number> } = { key: '', net: new Set() };
function resetFx() { agents = []; floats = []; dust = []; queue = []; }

const gateRoad = () => { const [gx, gy] = xy(W.gate); return idx(gx, gy + 1); };
function netOf(): Set<number> {
  const key = W.tiles.map(t => t.b === 'road' ? 1 : 0).join('');
  if (key !== netCache.key) netCache = { key, net: roadNet(W) };
  return netCache.net;
}
function bfs(from: number, to: number, net: Set<number>): number[] {
  const prev = new Map<number, number>([[from, -1]]); const q = [from];
  while (q.length) {
    const c = q.shift()!; if (c === to) break;
    for (const n of nbrs(c)) if (net.has(n) && !prev.has(n)) { prev.set(n, c); q.push(n); }
  }
  if (!prev.has(to)) return [];
  const out: number[] = []; for (let c = to; c !== -1; c = prev.get(c)!) out.push(c);
  return out.reverse();
}
function spawnAgent(doom: boolean) {
  const net = netOf(); const lv = live(W).filter(i => BDEF[W.tiles[i].b!].cap > 0 || W.tiles[i].b === 'hospital' || W.tiles[i].b === 'cathedral');
  let path: number[]; let stopAt = -1;
  if (lv.length && fx() < 0.8) {
    const b = lv[Math.floor(fx() * lv.length)];
    const door = nbrs(b).find(n => net.has(n));
    const a = door != null ? bfs(W.spawn, door, net) : [];
    const c = door != null ? bfs(door, gateRoad(), net) : [];
    path = a.length && c.length ? [...a, ...c.slice(1)] : bfs(W.spawn, gateRoad(), net);
    if (a.length && c.length) stopAt = a.length - 1;
  } else path = bfs(W.spawn, gateRoad(), net);
  if (path.length < 2) return;
  path.push(W.gate);
  agents.push({ path, seg: 0, t: 0, wait: 0, hue: Math.floor(fx() * 360), stopAt, doom });
  if (agents.length > 90) agents.shift();
}

// ── 캔버스 ──────────────────────────────────────────
const cv = $<HTMLCanvasElement>('#map'); const g = cv.getContext('2d')!;
let TS = 24, OX = 0, OY = 0, DPR = 1;
function fit() {
  const r = cv.getBoundingClientRect(); DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(r.width * DPR); cv.height = Math.round(r.height * DPR);
  TS = Math.max(8, Math.floor(Math.min(r.width / MW, r.height / MH)));
  OX = Math.floor((r.width - TS * MW) / 2); OY = Math.floor((r.height - TS * MH) / 2);
}
new ResizeObserver(fit).observe(cv);
const hash = (i: number) => { let h = i * 2654435761 >>> 0; h ^= h >>> 13; return (h % 1000) / 1000; };
const cx = (i: number) => OX + (i % MW) * TS + TS / 2;
const cy = (i: number) => OY + Math.floor(i / MW) * TS + TS / 2;

const BCOL: Record<Kind, string> = {
  road: '#8b7350', inn: '#7a5236', tavern: '#6d4a2a', rental: '#56606a', hospital: '#d8d2c2', casino: '#5b2346', cathedral: '#8e8a7c',
};

function drawTile(i: number, now: number) {
  const t = W.tiles[i], x = OX + (i % MW) * TS, y = OY + Math.floor(i / MW) * TS, h = hash(i);
  const base = t.t === 'grass' ? (h < 0.5 ? '#3d4a2c' : '#425030') : t.t === 'forest' ? '#2c3a22' : t.t === 'rock' ? '#4a4640' : '#26404a';
  g.fillStyle = base; g.fillRect(x, y, TS, TS);
  if (t.t === 'grass' && h > 0.82) { g.fillStyle = '#56653a'; g.fillRect(x + TS * h * 0.6, y + TS * 0.6, 2, 2); }
  if (t.t === 'forest') {
    g.fillStyle = '#1e2a17'; g.beginPath(); g.arc(x + TS * 0.35, y + TS * 0.45, TS * 0.28, 0, 7); g.arc(x + TS * 0.68, y + TS * 0.62, TS * 0.24, 0, 7); g.fill();
  }
  if (t.t === 'rock') { g.fillStyle = '#5c5750'; g.fillRect(x + TS * 0.2, y + TS * 0.3, TS * 0.35, TS * 0.25); g.fillStyle = '#3a3732'; g.fillRect(x + TS * 0.5, y + TS * 0.55, TS * 0.3, TS * 0.2); }
  if (t.t === 'water') { g.strokeStyle = 'rgba(160,200,210,.25)'; g.beginPath(); const o = ((now / 900 + h) % 1) * TS; g.moveTo(x + o * 0.5, y + TS * 0.4); g.lineTo(x + o * 0.5 + TS * 0.3, y + TS * 0.4); g.stroke(); }
  if (t.b === 'road') {
    g.fillStyle = '#7d6748'; g.fillRect(x, y, TS, TS);
    g.fillStyle = '#6c583b';
    for (const n of nbrs(i)) if (W.tiles[n].b !== 'road' && n !== W.gate) {
      const [ax, ay] = xy(i), [bx, by] = xy(n);
      if (bx > ax) g.fillRect(x + TS - 2, y, 2, TS); if (bx < ax) g.fillRect(x, y, 2, TS);
      if (by > ay) g.fillRect(x, y + TS - 2, TS, 2); if (by < ay) g.fillRect(x, y, TS, 2);
    }
    if (h > 0.7) { g.fillStyle = '#8f7853'; g.fillRect(x + TS * 0.3, y + TS * 0.4, 2, 2); }
  }
}

function drawBuilding(i: number, now: number) {
  const t = W.tiles[i]; if (!t.b || t.b === 'road') return;
  const b0 = bornAt.get(i);
  const pop = b0 != null ? Math.min(1, (now - b0) / 380) : 1;
  const s = pop < 1 ? 1 + (1 - pop) * 0.9 : 1;
  const yOff = pop < 1 ? -(1 - pop) * TS * 1.2 : 0;
  const x = cx(i), y = cy(i) + yOff, w = TS * 0.86 * s;
  const lit = liveSet.has(i);
  g.globalAlpha = lit ? 1 : 0.45;
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x - w / 2 + 2, cy(i) - w / 2 + 3, w, w);
  g.fillStyle = BCOL[t.b]; g.fillRect(x - w / 2, y - w / 2, w, w);
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x - w / 2, y - w / 2, w, w * 0.22);
  if (t.b === 'casino') { g.fillStyle = (Math.floor(now / 400) % 2) ? '#e8c35a' : '#b4609a'; g.fillRect(x - w / 2, y + w / 2 - 3, w, 3); }
  g.font = `${Math.floor(TS * 0.58 * s)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#f3e6c8'; // 색 이모지 글꼴이 없는 기기에서도 보이게
  g.fillText(BDEF[t.b].icon, x, y + 1);
  g.globalAlpha = 1;
  for (let n = 1; n < t.lv; n++) { g.fillStyle = '#d9b45a'; g.fillRect(x - w / 2 + 2 + (n - 1) * 5, y - w / 2 + 2, 3, 3); }
  if (i === ui.sel) { g.strokeStyle = '#d9b45a'; g.lineWidth = 2; g.strokeRect(x - w / 2 - 2, cy(i) - w / 2 - 2, w + 4, w + 4); g.lineWidth = 1; }
}
const bornAt = new Map<number, number>();
let liveSet = new Set<number>();

function drawGate(now: number) {
  const x = cx(W.gate), y = cy(W.gate), r = TS * 0.48;
  const glow = 0.35 + 0.25 * Math.sin(now / 500);
  g.fillStyle = `rgba(194,72,61,${glow})`; g.beginPath(); g.arc(x, y + 2, r * 1.25, 0, 7); g.fill();
  g.fillStyle = '#0b0807'; g.beginPath(); g.moveTo(x - r, y + r); g.lineTo(x - r, y - r * 0.1); g.arc(x, y - r * 0.1, r, Math.PI, 0); g.lineTo(x + r, y + r); g.fill();
  g.strokeStyle = '#6a5f52'; g.lineWidth = 2; g.stroke(); g.lineWidth = 1;
}

function drawAgents(dt: number) {
  const spd = 3.2 / Math.max(0.6, SPEEDS[speed] || 2.2); // 칸/초
  for (const a of agents) {
    if (speed === 0) { /* 멈춤 */ }
    else if (a.wait > 0) a.wait -= dt;
    else {
      a.t += dt * spd;
      while (a.t >= 1 && a.seg < a.path.length - 1) {
        a.t -= 1; a.seg++;
        if (a.seg === a.stopAt) { a.wait = 0.5 + fx() * 0.6; a.t = 0; break; }
      }
    }
    const i0 = a.path[Math.min(a.seg, a.path.length - 1)], i1 = a.path[Math.min(a.seg + 1, a.path.length - 1)];
    const k = Math.min(1, a.t);
    const x = cx(i0) + (cx(i1) - cx(i0)) * k, y = cy(i0) + (cy(i1) - cy(i0)) * k;
    const bob = Math.sin((a.seg + a.t) * Math.PI * 2) * TS * 0.04;
    const r = Math.max(2, TS * 0.14);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(x, y + r, r, r * 0.45, 0, 0, 7); g.fill();
    g.fillStyle = `hsl(${a.hue} 55% 62%)`; g.beginPath(); g.arc(x, y - bob, r, 0, 7); g.fill();
    g.fillStyle = '#e9dcc0'; g.fillRect(x - 1, y - bob - r - 2, 2, 2);
  }
  // 어귀에 닿으면 사라진다. 못 돌아올 이에게는 표시를 남긴다
  agents = agents.filter(a => {
    if (a.seg >= a.path.length - 1) { if (a.doom) floats.push({ x: cx(W.gate), y: cy(W.gate) - TS * 0.4, text: '✝', color: '#c2483d', t: 0 }); return false; }
    return true;
  });
}

function drawInspector() {
  if (!W.audit) return;
  const net = netOf(); const path = bfs(W.spawn, gateRoad(), net); if (!path.length) return;
  const left = W.audit.due - W.day - acc / (SPEEDS[speed] || 1);
  const p = 1 - Math.max(0, Math.min(1, left / L.AUDIT_LEAD));
  const f = p * (path.length - 1) * 0.55, i0 = path[Math.floor(f)], i1 = path[Math.min(path.length - 1, Math.floor(f) + 1)], k = f % 1;
  const x = cx(i0) + (cx(i1) - cx(i0)) * k, y = cy(i0) + (cy(i1) - cy(i0)) * k;
  g.fillStyle = '#2b2a2e'; g.fillRect(x - TS * 0.45, y - TS * 0.32, TS * 0.9, TS * 0.5);
  g.fillStyle = '#8a8792'; g.fillRect(x - TS * 0.45, y - TS * 0.32, TS * 0.9, TS * 0.1);
  g.fillStyle = '#111'; g.beginPath(); g.arc(x - TS * 0.28, y + TS * 0.2, TS * 0.12, 0, 7); g.arc(x + TS * 0.28, y + TS * 0.2, TS * 0.12, 0, 7); g.fill();
  g.font = `${Math.floor(TS * 0.36)}px "IBM Plex Sans KR"`; g.fillStyle = '#e9dcc0'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('감사', x, y - TS * 0.07);
}

function drawHover() {
  const i = ui.pending >= 0 ? ui.pending : ui.hover; if (i < 0 || !ui.tool) return;
  const x = OX + (i % MW) * TS, y = OY + Math.floor(i / MW) * TS;
  const bad = ui.tool === 'demolish' ? !(W.tiles[i].b && i !== W.spawn) : !!canBuild(W, i, ui.tool);
  g.fillStyle = bad ? 'rgba(194,72,61,.35)' : 'rgba(127,163,107,.4)'; g.fillRect(x, y, TS, TS);
  g.strokeStyle = bad ? '#c2483d' : '#b9e09c'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, TS - 2, TS - 2); g.lineWidth = 1;
  if (ui.tool !== 'demolish' && ui.tool !== 'road' && !bad) { g.globalAlpha = 0.7; g.font = `${Math.floor(TS * 0.58)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(BDEF[ui.tool].icon, x + TS / 2, y + TS / 2 + 1); g.globalAlpha = 1; }
}

function drawFx(dt: number) {
  for (const d of dust) { d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 60 * dt; g.fillStyle = `rgba(200,180,140,${Math.max(0, 0.7 - d.t)})`; g.fillRect(d.x, d.y, 3, 3); }
  dust = dust.filter(d => d.t < 0.7);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const f of floats) {
    f.t += dt; g.globalAlpha = Math.max(0, 1 - f.t / 1.4);
    g.font = `600 ${Math.max(10, Math.floor(TS * 0.42))}px "IBM Plex Mono"`;
    g.fillStyle = '#0008'; g.fillText(f.text, f.x + 1, f.y - f.t * TS * 0.8 + 1);
    g.fillStyle = f.color; g.fillText(f.text, f.x, f.y - f.t * TS * 0.8);
  }
  g.globalAlpha = 1; floats = floats.filter(f => f.t < 1.4);
}

function slam(i: number) {
  bornAt.set(i, performance.now());
  setTimeout(() => {
    shake = 0.25;
    for (let n = 0; n < 14; n++) dust.push({ x: cx(i), y: cy(i) + TS * 0.35, vx: (fx() - 0.5) * 140, vy: -fx() * 80, t: 0 });
  }, 360);
}

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  // 날 넘기기
  if (speed && !W.over) {
    acc += dt;
    while (acc >= SPEEDS[speed]) { acc -= SPEEDS[speed]; dayTick(); if (W.over) break; }
    // 그날 손님을 하루에 흩어 내보낸다
    const p = acc / SPEEDS[speed];
    while (queue.length && queue[0].at <= p) spawnAgent(queue.shift()!.doom);
  }
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.fillStyle = '#14110d'; g.fillRect(0, 0, cv.width, cv.height);
  if (shake > 0) { shake -= dt; g.translate((fx() - 0.5) * 6 * shake * 4, (fx() - 0.5) * 6 * shake * 4); }
  for (let i = 0; i < MW * MH; i++) drawTile(i, now);
  drawGate(now);
  drawHover();
  liveSet = new Set(live(W));
  for (let i = 0; i < MW * MH; i++) drawBuilding(i, now);
  drawAgents(speed ? dt : 0);
  drawInspector();
  drawFx(dt);
  requestAnimationFrame(frame);
}

function dayTick() {
  const nBooks = W.books.length;
  const before = { clean: W.clean, black: W.black, rank: W.rank, notes: W.notes.length, top: W.notes[0] };
  step(W);
  const t = W.today;
  queue = [];
  const n = Math.min(t.visits, 24);
  for (let k = 0; k < n; k++) queue.push({ at: k / Math.max(1, n), doom: k < Math.min(t.deaths, n) && fx() < 0.9 });
  queue.sort((a, b) => a.at - b.at);
  for (const [i, v] of Object.entries(t.byTile)) if (fx() < 0.55) floats.push({ x: cx(+i), y: cy(+i) - TS * 0.3, text: `+${v}`, color: '#d9b45a', t: fx() * 0.3 });
  if (W.black - before.black > 0) floats.push({ x: OX + TS * 2.5, y: cy(W.spawn) - TS, text: `+${fmt(W.black - before.black)}`, color: '#b4609a', t: 0 });
  if (W.notes[0] !== before.top) flashNote();
  if (W.books.length > nBooks && !W.over) openBook(W.books[W.books.length - 1]);
  save();
  renderBar();
  if (ui.tab !== 'build' || W.day % 3 === 0) renderPanel();
  if (W.over) renderOver();
}

// ── 지도 손 ─────────────────────────────────────────
function tileAt(e: PointerEvent): number {
  const r = cv.getBoundingClientRect(); const x = Math.floor((e.clientX - r.left - OX) / TS), y = Math.floor((e.clientY - r.top - OY) / TS);
  return x >= 0 && y >= 0 && x < MW && y < MH ? idx(x, y) : -1;
}
cv.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { ui.hover = tileAt(e); if (!ui.tool) showTip(ui.hover, e); } });
cv.addEventListener('pointerleave', () => { ui.hover = -1; hideTip(); });
cv.addEventListener('pointerdown', e => {
  const i = tileAt(e); if (i < 0) return;
  if (!ui.tool) {
    const t = W.tiles[i]; ui.sel = t.b && t.b !== 'road' ? i : -1;
    if (ui.sel >= 0) ui.tab = 'park';
    renderPanel(); if (ui.sel < 0) showTip(i, e, true); else hideTip(); return;
  }
  // 손가락은 한 번 눌러 자리를 보고, 같은 칸을 한 번 더 눌러 짓는다
  if (e.pointerType !== 'mouse' && ui.pending !== i) { ui.pending = i; renderTool(); return; }
  act(i);
});
function act(i: number) {
  ui.pending = -1;
  if (ui.tool === 'demolish') { if (demolish(W, i)) { shake = 0.15; save(); } }
  else if (ui.tool) {
    const k = ui.tool, why = canBuild(W, i, k);
    if (why) { floats.push({ x: cx(i), y: cy(i), text: why, color: '#c2483d', t: 0 }); }
    else { build(W, i, k); if (k !== 'road') slam(i); else shake = 0.05; floats.push({ x: cx(i), y: cy(i), text: `−${BDEF[k].cost}`, color: '#a79878', t: 0.2 }); save(); }
  }
  renderBar(); renderPanel(); renderTool();
}
function showTip(i: number, e: PointerEvent, pin = false) {
  const tip = $('#tip'); if (i < 0) return hideTip();
  const t = W.tiles[i]; let h = '';
  if (i === W.gate) h = `<b class="font-serif">미궁 어귀</b><div class="text-dim mt-0.5">사망률 <span class="num">${Math.round(deathRate(W) * 100)}%</span></div>`;
  else if (t.b && t.b !== 'road') {
    const d = BDEF[t.b]; const on = live(W).includes(i);
    h = `<b class="font-serif">${d.icon} ${d.name}</b>${on ? '' : ' <span class="text-blood">길 끊김</span>'}<div class="text-dim mt-0.5">${d.note}</div>` +
      (W.stat.tile[i] ? `<div class="num text-clean mt-0.5">오늘 +${W.today.byTile[i] ?? 0} · 누계 ${fmt(W.stat.tile[i].rev)}</div><div class="num text-dim">손님 ${fmt(W.stat.tile[i].served)}명</div>` : '');
  } else if (pin) return hideTip();
  else return hideTip();
  tip.innerHTML = h; tip.classList.remove('hidden');
  const r = cv.getBoundingClientRect();
  tip.style.left = `${Math.min(r.width - 230, e.clientX - r.left + 12)}px`; tip.style.top = `${Math.max(4, e.clientY - r.top - 50)}px`;
  if (pin) setTimeout(hideTip, 2200);
}
function hideTip() { $('#tip').classList.add('hidden'); }

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
  const next = W.rank < 2 ? L.PROMOTE[W.rank] : 0;
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
    <div class="flex items-baseline justify-between text-xs"><span class="text-dim">${W.rank < 2 ? RANKS[W.rank + 1] + ' 청원' : '대공'}</span><span class="num text-dim">${fmt(W.favor)}${next ? ' / ' + fmt(next) : ''}</span></div>
    <div class="mt-1.5 h-1.5 rounded bg-line overflow-hidden"><div class="h-full bg-clean" style="width:${prog}%"></div></div>
  </div>
  <div class="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] text-dim">
    <div class="rounded border border-line py-1.5">세율<div class="num text-sm text-paper">${Math.round(L.TAX[W.rank] * 100)}%</div></div>
    <div class="rounded border border-line py-1.5">사망률<div class="num text-sm text-paper">${Math.round(deathRate(W) * 100)}%</div></div>
    <div class="rounded border border-line py-1.5">오늘 발길<div class="num text-sm text-paper">${W.today.visits}명</div></div>
  </div>`;
}

function buildHtml() {
  const cards = BUILD_ORDER.map(k => {
    const d = BDEF[k], lock = d.rank > W.rank, poor = W.clean < d.cost, on = ui.tool === k;
    const tagc = d.tag === '세탁' ? 'text-black border-black/50' : d.tag === '체면' ? 'text-moss border-moss/50' : d.tag === '영업' ? 'text-clean border-clean/50' : 'text-dim border-line';
    return `<button data-tool="${k}" ${lock ? 'disabled' : ''} class="relative text-left rounded border ${on ? 'border-clean bg-felt ring-1 ring-clean' : 'border-line hover:bg-felt'} p-2 ${lock ? 'opacity-40' : ''}">
      <div class="flex items-center justify-between"><span class="text-lg leading-none">${d.icon || '▦'}</span><span class="rounded border px-1 text-[10px] ${tagc}">${d.tag}</span></div>
      <div class="mt-1 font-serif text-sm">${d.name}</div>
      <div class="num text-xs ${poor ? 'text-blood' : 'text-clean'}">${fmt(d.cost)}</div>
      <div class="text-[10px] text-dim">${lock ? RANKS[d.rank] + ' 이상' : `${count(W, k, false) ? '보유 ' + count(W, k, false) : '&nbsp;'}`}</div>
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
  <div class="flex items-baseline justify-between mb-2"><h2 class="font-serif text-base">건축</h2>
    <button data-tool="demolish" class="rounded border px-2 py-0.5 text-xs ${ui.tool === 'demolish' ? 'border-blood text-blood' : 'border-line text-dim'}">철거</button></div>
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
function selHtml() {
  const i = ui.sel; if (i < 0 || !W.tiles[i].b || W.tiles[i].b === 'road') return '';
  const t = W.tiles[i], d = BDEF[t.b!], ts = W.stat.tile[i], on = live(W).includes(i), c = upCost(W, i);
  const eff = d.cap ? `수용 <span class="num text-paper">${capOf(W, i)}</span>/일` : d.wash ? `세탁 한도 <span class="num text-paper">${fmt(Math.round(d.wash * (1 + L.UP_CAP * (t.lv - 1))))}</span>/달` : '';
  return `<div class="rounded border border-clean/60 bg-felt p-2.5">
    <div class="flex items-center justify-between"><span class="font-serif text-sm">${d.icon} ${d.name} <span class="num text-clean text-xs">${'▲'.repeat(t.lv - 1) || '1단계'}</span>${on ? '' : ' <span class="text-blood text-xs">길 끊김</span>'}</span>
      <button data-act="del" class="text-[11px] text-dim hover:text-blood">철거</button></div>
    <div class="mt-1 flex flex-wrap gap-x-4 text-[11px] text-dim">${eff}${ts ? `<span>손님 <span class="num text-paper">${fmt(ts.served)}</span></span><span>누계 <span class="num text-clean">${fmt(ts.rev)}</span></span>` : ''}</div>
    ${c ? `<button data-act="up" class="mt-2 w-full rounded border ${W.clean >= c ? 'border-clean text-clean hover:bg-clean/10' : 'border-line text-dim'} py-1.5 text-sm">업그레이드 <span class="num">${fmt(c)}</span></button>` : `<div class="mt-2 text-[11px] text-dim">${t.lv >= L.UP_MAX ? '최고 단계' : ''}</div>`}
  </div>`;
}
function parkHtml() {
  const st = W.stat, h = st.hist, last30 = h.slice(-30);
  const sum = (a: Day[], f: (d: Day) => number) => a.reduce((x, d) => x + f(d), 0);
  const mV = sum(last30, d => d.v), mR = sum(last30, d => d.r), mD = sum(last30, d => d.d);
  const stars = Math.max(0, Math.min(5, Math.round((W.rep - 0.5) / 0.9 * 5)));
  const sat = h.slice(-10).length ? Math.round(sum(h.slice(-10), d => d.s) / h.slice(-10).length) : 0;
  const kpi = (l: string, v: string, c = 'text-paper') => `<div class="rounded border border-line py-1.5 text-center"><div class="text-[11px] text-dim">${l}</div><div class="num text-sm ${c}">${v}</div></div>`;
  const KN: Partial<Record<Kind, string>> = { inn: '여관', tavern: '선술집', rental: '장비 대여소', casino: '카지노' };
  const rows: string[] = [];
  rows.push(`<tr class="border-b border-line/60"><td class="py-1.5">🎫 입장료</td><td class="num text-right">${fmt(st.visits)}</td><td class="num text-right text-clean">${fmt(st.fee)}</td><td></td></tr>`);
  for (const k of PRICED) {
    const ks = st.kind[k], own = count(W, k, false), lv = count(W, k);
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
  return `${selHtml()}
  <div class="grid grid-cols-3 gap-2 ${ui.sel >= 0 ? 'mt-3' : ''}">
    ${kpi('오늘 입장객', W.today.visits + '명')}${kpi('최근 30일', fmt(mV) + '명')}${kpi('누적', fmt(st.visits) + '명')}
    ${kpi('평판', '★'.repeat(stars) + '☆'.repeat(5 - stars), 'text-clean')}${kpi('사망률', Math.round(deathRate(W) * 100) + '%', deathRate(W) > 0.09 ? 'text-blood' : 'text-paper')}${kpi('손님 만족', sat + '점', sat < 55 ? 'text-blood' : 'text-paper')}
  </div>
  <h2 class="font-serif text-base mt-4 mb-1">입장객 · 매상 <span class="text-[11px] text-dim">최근 30일</span></h2>
  <div class="rounded border border-line p-2">
    <div class="flex items-baseline justify-between text-[11px] text-dim"><span>입장객</span><span class="num text-paper">${fmt(mV)}</span></div>${spark(last30.map(d => d.v), '#7fa36b')}
    <div class="mt-1 flex items-baseline justify-between text-[11px] text-dim"><span>매상</span><span class="num text-clean">${fmt(mR)}</span></div>${spark(last30.map(d => d.r), '#d9b45a')}
  </div>
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
  const inc: [string, number][] = [['입장료', b.fee], ...(['inn', 'tavern', 'rental', 'casino'] as Kind[]).filter(k => b.sales[k]).map(k => [BDEF[k].icon + ' ' + BDEF[k].name, b.sales[k]!] as [string, number]), ['개척 보조금', b.subsidy], ['세탁 유입', b.wash]];
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
function renderTool() {
  const t = $('#tool');
  if (!ui.tool) { t.innerHTML = ''; return; }
  const name = ui.tool === 'demolish' ? '철거' : `${BDEF[ui.tool].icon} ${BDEF[ui.tool].name}`;
  const hint = ui.pending >= 0 ? (ui.tool === 'demolish' ? '한 번 더 눌러 철거' : (canBuild(W, ui.pending, ui.tool) ?? '한 번 더 눌러 착공')) : (ui.tool === 'road' ? '길에 잇닿은 칸' : ui.tool === 'demolish' ? '건물' : '길 옆 칸');
  t.innerHTML = `<div class="flex items-center gap-2 rounded border border-clean/60 bg-desk/95 px-2 py-1"><span class="font-serif">${name}</span><span class="text-dim">${hint}</span><button data-tool="off" class="ml-1 text-dim hover:text-paper" aria-label="그만">✕</button></div>`;
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
    duke: ['대공', '수도의 연회장, 새 대공의 잔이 가장 먼저 채워졌다. 변방의 진흙길은 그 잔 속 어디에도 비치지 않았다.'],
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
    if (why) floats.push({ x: cx(ui.sel), y: cy(ui.sel), text: why, color: '#c2483d', t: 0 });
    else { slam(ui.sel); floats.push({ x: cx(ui.sel), y: cy(ui.sel), text: '▲', color: '#d9b45a', t: 0 }); save(); }
    renderBar(); renderPanel(); return;
  }
  if (act === 'del' && ui.sel >= 0) { demolish(W, ui.sel); ui.sel = -1; shake = 0.15; save(); renderBar(); renderPanel(); return; }
  const pick = el.closest<HTMLElement>('[data-pick]');
  if (pick) { ui.tool = pick.dataset.pick as Kind; ui.pending = -1; ui.tab = 'build'; renderTool(); renderPanel(); return; }
  const tool = el.closest<HTMLElement>('[data-tool]');
  if (tool) { const k = tool.dataset.tool!; ui.tool = k === 'off' || ui.tool === k ? null : k as any; ui.pending = -1; hideTip(); renderTool(); if (ui.tab === 'build') renderPanel(); return; }
  if (el.closest('[data-act="new"]')) { $('#over').classList.add('hidden'); fresh(); renderAll(); }
});
document.addEventListener('keydown', e => {
  if (e.key === ' ') { speed = speed ? 0 : 1; renderBar(); e.preventDefault(); }
  if (e.key === 'Escape') { ui.tool = null; ui.pending = -1; renderTool(); renderPanel(); }
});

function renderAll() { renderBar(); renderPanel(); renderTool(); flashNote(); if (W.over) renderOver(); }
fit(); renderAll();
requestAnimationFrame(frame);
// 개발 확인용 손잡이
(window as any).LB = { get W() { return W; }, step: () => dayTick(), fresh: () => { fresh(); renderAll(); }, ui };
