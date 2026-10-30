// 개발용 인과 루프 확인판 (`npm run dev` → /dev/loops.html). 봇 한 판을 돌려 날마다 켜진 고리를 그림 위에 켠다.
// 상태를 저장하지 않고, 판은 시드로 다시 굴린다.
import { B, GUILDS, type LoopId, type World, newWorld, over, relOf, step, worstPair } from '../src/bureau/engine';
import { BOT } from '../src/bureau/bots';
import { EDGES, LINKS, LOOPS, NODES, type LoopEdge, checkLoops } from '../src/bureau/loops';

interface Snap { lv: number[]; big: number; small: number; rel: number; standing: number; budget: number; lit: LoopId[] }
interface Game { W: World; snaps: Snap[] }

const $ = (id: string) => document.getElementById(id)!;
const col = (id: LoopId) => `var(--${id.toLowerCase()})`;
const NODE = Object.fromEntries(NODES.map(n => [n.id, n]));
const wOf = (label: string) => label.length * 14 + 26;

function play(seed: number, bot: string, noCheck: boolean): Game {
  const W = newWorld(seed, { noCheck }), snaps: Snap[] = [];
  while (!over(W)) {
    BOT[bot](W); step(W);
    snaps.push({ lv: W.dungeons.map(d => d.level), big: GUILDS.filter(g => B.GUILD[g].big).reduce((a, g) => a + W.guilds[g].size, 0), small: GUILDS.filter(g => !B.GUILD[g].big).reduce((a, g) => a + W.guilds[g].size, 0), rel: relOf(W, ...worstPair(W)), standing: W.standing, budget: W.budget, lit: W.stats.litHist.at(-1)! });
  }
  return { W, snaps };
}

const st = { seed: 1000, bot: 'smart', noCheck: false, day: 120, pin: null as LoopId | null, timer: 0 };
let G = play(st.seed, st.bot, st.noCheck);

// 그림: 화살표는 상자 가장자리에서 끊고, 서로 마주 보는 화살표는 반대쪽으로 휜다
function geom(e: LoopEdge) {
  const a = NODE[e.from], b = NODE[e.to];
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
  const two = EDGES.some(f => f.from === e.to && f.to === e.from);
  const bend = e.bend ?? (two ? 26 : 12);
  const cut = (n: typeof a) => { const hw = wOf(n.label) / 2 + 6, hh = 21; return Math.min(hw / Math.abs(ux || 1e-9), hh / Math.abs(uy || 1e-9)); };
  const ca = cut(a), cb = cut(b);
  const x1 = a.x + ux * ca, y1 = a.y + uy * ca, x2 = b.x - ux * cb, y2 = b.y - uy * cb;
  const cx = (x1 + x2) / 2 - uy * bend, cy = (y1 + y2) / 2 + ux * bend;
  const tx = x2 - cx, ty = y2 - cy, tl = Math.hypot(tx, ty), px = tx / tl, py = ty / tl;
  const head = `${x2},${y2} ${x2 - px * 10 - py * 5},${y2 - py * 10 + px * 5} ${x2 - px * 10 + py * 5},${y2 - py * 10 - px * 5}`;
  const t = 0.72, sx = (1 - t) ** 2 * x1 + 2 * (1 - t) * t * cx + t * t * x2, sy = (1 - t) ** 2 * y1 + 2 * (1 - t) * t * cy + t * t * y2;
  return { d: `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`, head, sx: sx - uy * 11, sy: sy + ux * 11 + 4 };
}
const loopsOf = (e: LoopEdge) => LOOPS.filter(l => l.path.some((n, i) => n === e.from && l.path[i + 1] === e.to));

function drawDiagram() {
  const lit = new Set(G.snaps[st.day - 1].lit);
  const show = (ids: LoopId[]) => !st.pin || ids.includes(st.pin);
  let h = '';
  for (const e of EDGES) {
    const ls = loopsOf(e), ids = ls.map(l => l.id), on = ls.find(l => lit.has(l.id) && show([l.id]));
    const c = col((on ?? ls.find(l => show([l.id])) ?? ls[0]).id), g = geom(e);
    h += `<g class="edge${on ? ' on' : ''}${show(ids) ? '' : ' dim'}"><path d="${g.d}" style="stroke:${c}"/><polygon points="${g.head}" style="fill:${c}"/><text class="sg" x="${g.sx}" y="${g.sy}" text-anchor="middle">${e.sign > 0 ? '+' : '−'}</text></g>`;
  }
  for (const e of LINKS) {
    const g = geom(e);
    h += `<g class="edge link${st.pin ? ' dim' : ''}"><path d="${g.d}"/><polygon points="${g.head}"/><text class="sg" x="${g.sx}" y="${g.sy}" text-anchor="middle">${e.sign > 0 ? '+' : '−'}</text></g>`;
  }
  for (const n of NODES) {
    const w = wOf(n.label);
    h += `<g class="node${n.hand ? ' hand' : ''}"><rect x="${n.x - w / 2}" y="${n.y - 15}" width="${w}" height="30" rx="4"/><text x="${n.x}" y="${n.y + 5}" text-anchor="middle">${n.label}</text></g>`;
  }
  for (const l of LOOPS) {
    if (!show([l.id])) continue;
    const on = lit.has(l.id), [x, y] = l.at;
    h += `<g class="badge${on ? ' on' : ''}"><circle cx="${x}" cy="${y}" r="${on ? 19 : 16}" style="stroke:${col(l.id)};fill:${on ? col(l.id) : 'var(--panel)'}"/><text class="id" x="${x}" y="${y + 4}" style="fill:${on ? 'var(--panel)' : col(l.id)}">${l.id}</text><text class="nm" x="${x}" y="${y + 33}">${l.name}</text></g>`;
  }
  $('dia').innerHTML = h;
}

function drawLoops() {
  const lit = new Set(G.snaps[st.day - 1].lit), n = G.snaps.length;
  $('loops').innerHTML = LOOPS.map(l => {
    const days = G.snaps.map(s => s.lit.includes(l.id)), cnt = days.filter(Boolean).length;
    let cells = '';
    days.forEach((on, i) => { if (on) cells += `<rect x="${i}" y="0" width="1" height="10" style="fill:${col(l.id)}"/>`; });
    return `<div class="loop${lit.has(l.id) ? ' on' : ''}${st.pin === l.id ? ' pin' : ''}" data-id="${l.id}" role="button" tabindex="0" aria-pressed="${st.pin === l.id}">
      <span class="tag" style="border-color:${col(l.id)};color:${col(l.id)};${lit.has(l.id) ? `background:${col(l.id)}` : ''}">${l.id}</span>
      <span class="n">${l.name}</span><span class="cnt">${cnt}일</span>
      <span class="when">${l.when}</span>
      <svg viewBox="0 0 ${n} 10" preserveAspectRatio="none" data-strip="1"><rect x="0" y="0" width="${n}" height="10" style="fill:var(--wash)"/>${cells}<rect x="${st.day - 1}" y="0" width="1.5" height="10" style="fill:var(--ink)"/></svg>
    </div>`;
  }).join('');
}

function spark(xs: number[], lo: number, hi: number, c: string, ref?: number) {
  const n = xs.length, y = (v: number) => 24 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * 22;
  const pts = xs.map((v, i) => `${i},${y(v).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${n} 26" preserveAspectRatio="none">${ref != null ? `<line x1="0" x2="${n}" y1="${y(ref)}" y2="${y(ref)}" style="stroke:var(--line)" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>` : ''}<polygon points="0,26 ${pts} ${n - 1},26" style="fill:${c};opacity:.12"/><polyline points="${pts}" style="fill:none;stroke:${c}" stroke-width="1.5" vector-effect="non-scaling-stroke"/><line x1="${st.day - 1}" x2="${st.day - 1}" y1="0" y2="26" style="stroke:var(--ink)" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>`;
}

function drawSparks() {
  const S = G.snaps, s = S[st.day - 1], f = (v: number) => (Math.round(v * 10) / 10).toLocaleString('ko-KR');
  const rows: [string, number[], number, number, string, number | undefined, number][] = [
    ...G.W.dungeons.map((d, i) => [`${d.name} 수위`, S.map(x => x.lv[i]), 0, 100, 'var(--r1)', B.DANGER, s.lv[i]] as [string, number[], number, number, string, number, number]),
    ['큰 길드 둘 조', S.map(x => x.big), 0, 90, 'var(--r3)', undefined, s.big],
    ['작은 길드 다섯 조', S.map(x => x.small), 0, 60, 'var(--b3)', undefined, s.small],
    ['나쁜 두 길드 사이', S.map(x => x.rel), -100, 100, 'var(--r4)', 0, s.rel],
    ['국장 입지', S.map(x => x.standing), 0, 100, 'var(--b4)', undefined, s.standing],
    ['예산', S.map(x => x.budget), Math.min(0, ...S.map(x => x.budget)), Math.max(1, ...S.map(x => x.budget)), 'var(--b5)', 0, s.budget],
  ];
  $('sparks').innerHTML = rows.map(([name, xs, lo, hi, c, ref, now]) => `<div class="spark"><span>${name}</span>${spark(xs, lo, hi, c, ref)}<b>${f(now)}</b></div>`).join('')
    + `<p class="note">점선: 위험 수위 ${B.DANGER} · 사이 0 · 예산 0. 세로줄이 고른 날.</p>`;
}

function drawReports() {
  const d = st.day, rs = G.W.reports.filter(r => r.day <= d).slice(-12).reverse();
  $('reps').innerHTML = rs.length ? rs.map(r => `<li class="${r.day === d ? 'today' : ''}"><div class="d">${r.day}일 · ${r.from}</div><div class="t">${r.title}</div>${r.chips.map(c => `<span class="chip">${c}</span>`).join('')}</li>`).join('') : '<li class="empty">아직 보고가 없다</li>';
}

function drawChecks() {
  $('checks').innerHTML = checkLoops().map(c => `<div><span class="${c.ok ? 'ok' : 'no'}">${c.ok ? '✓' : '✗'}</span> ${c.id} 길이 닫히고 음 화살표 ${c.neg}개 ${c.ok ? '' : '· ' + c.why.join(', ')}</div>`).join('');
}

// 봇마다 시드 20판: 고리마다 평균 켜진 날 · 한 번이라도 켜진 판 수. 손을 쓰는 봇에서 0인 고리는 빨갛게
function drawSweep() {
  const N = 20, ids = LOOPS.map(l => l.id);
  let h = `<table><thead><tr><th>봇</th>${ids.map(i => `<th style="color:${col(i)}">${i}</th>`).join('')}</tr></thead><tbody>`;
  for (const bot of Object.keys(BOT)) {
    const days: Record<string, number> = {}, games: Record<string, number> = {};
    for (let g = 0; g < N; g++) {
      const W = newWorld(1000 + g, { noCheck: st.noCheck });
      while (!over(W)) { BOT[bot](W); step(W); }
      for (const i of ids) { days[i] = (days[i] ?? 0) + W.stats.loops[i] / N; if (W.stats.loops[i]) games[i] = (games[i] ?? 0) + 1; }
    }
    h += `<tr><td>${bot}</td>${ids.map(i => `<td class="${bot !== 'idle' && !games[i] ? 'zero' : ''}" title="${games[i] ?? 0}/${N}판에서 켜짐">${Math.round(days[i])}</td>`).join('')}</tr>`;
  }
  $('sweep').innerHTML = h + `</tbody></table><p class="note">판당 켜진 날 평균 (시드 1000 ~ ${1000 + N - 1}${st.noCheck ? ', B3 끔' : ''}). 손을 쓰는 봇에서 한 번도 켜지지 않은 고리는 빨갛다.</p>`;
}

function drawDay() {
  ($('day') as HTMLInputElement).value = String(st.day);
  $('dayv').textContent = `${st.day}일`;
  drawDiagram(); drawLoops(); drawSparks(); drawReports();
}
function regame() { G = play(st.seed, st.bot, st.noCheck); $('seed').textContent = String(st.seed); drawDay(); }

$('bot').addEventListener('change', e => { st.bot = (e.target as HTMLSelectElement).value; regame(); });
$('sd-').addEventListener('click', () => { st.seed = Math.max(1, st.seed - 1); regame(); });
$('sd+').addEventListener('click', () => { st.seed++; regame(); });
$('nocheck').addEventListener('change', e => { st.noCheck = (e.target as HTMLInputElement).checked; regame(); setTimeout(drawSweep, 30); });
$('day').addEventListener('input', e => { st.day = +(e.target as HTMLInputElement).value; drawDay(); });
$('play').addEventListener('click', () => {
  if (st.timer) { clearInterval(st.timer); st.timer = 0; $('play').textContent = '재생'; return; }
  if (st.day >= G.snaps.length) st.day = 1;
  $('play').textContent = '멈춤';
  st.timer = window.setInterval(() => {
    if (st.day >= G.snaps.length) { clearInterval(st.timer); st.timer = 0; $('play').textContent = '재생'; return; }
    st.day++; drawDay();
  }, 80);
});
const pick = (t: EventTarget | null, x?: number) => {
  const row = (t as Element)?.closest?.('.loop') as HTMLElement | null;
  if (!row) return;
  const strip = (t as Element).closest('svg[data-strip]');
  if (strip && x != null) { const r = strip.getBoundingClientRect(); st.day = Math.max(1, Math.min(G.snaps.length, Math.round((x - r.left) / r.width * G.snaps.length) + 1)); }
  else { const id = row.dataset.id as LoopId; st.pin = st.pin === id ? null : id; }
  drawDay();
};
$('loops').addEventListener('click', e => pick(e.target, (e as MouseEvent).clientX));
$('loops').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e.target); } });

drawChecks();
drawDay();
setTimeout(drawSweep, 30);
