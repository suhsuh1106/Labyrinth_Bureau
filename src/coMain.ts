// 용병단 행정실 진입점: 한 달을 정보 주차와 탐험 주차로 나눠 결정하고, 도장을 찍으면 한 달을 돌린다. 판을 이 브라우저에 저장한다
import './ui/co/base.css';
import './ui/co/co.css';
import { setSeed } from './core/rng';
import { CO, PREP_KEYS, type Plan, SRCS, type World, carryPlan, fillTeams, formTeams, newWorld, probe, rankOf, roomOf, runMonth, sanitize, us } from './core/company';
import { DESC_FIRST } from './ui/co/roster';
import { CLASSES, GEARS } from './core/data';
import { plaqueHtml } from './ui/co/view';
import { type DeskUi, DOC_KEYS, PLACE_KEYS, expWeekHtml, infoWeekHtml, resultWeekHtml, weeksHtml } from './ui/co/desk';
import { advanceArrival, arrivalOpen, closeArrival, playArrival } from './ui/co/arrival';

const $ = (id: string): any => document.getElementById(id);
const KEY = 'lb-co', VERSION = 14, MONTHS = 36;   // 14: 짐 칸(운반 4단계) · 조마다 포션 · 횃불 (이전 판은 새 게임으로)
const GEAR_NAMES = GEARS.filter(g => g !== '일반');
let W: World, plan: Plan, ui: DeskUi;
// 도장을 막 찍은 결과 화면이면 귀환 장부를 한 줄씩 띄운다 (저장하지 않는 화면 상태)
let live = false, runTimer: any = null;

function save() { try { localStorage.setItem(KEY, JSON.stringify({ v: VERSION, W, plan, ui })); } catch { /* 저장이 막혀도 판은 계속된다 */ } }
function load() { try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); return d && d.v === VERSION ? d : null; } catch { return null; } }

function render() {
  $('stats').innerHTML = plaqueHtml(W);
  const over = W.month > 36;
  if (over && ui.phase !== 2) ui.phase = 2;
  $('weeks').innerHTML = weeksHtml(W, ui.phase);
  $('desk').innerHTML = ui.phase === 0 ? infoWeekHtml(W, plan, ui) : ui.phase === 1 ? expWeekHtml(W, plan, ui) : resultWeekHtml(W, live, !!ui.mute);
  if (over) { const b = document.querySelector('#desk .resultwrap .btn-next') as HTMLButtonElement | null; if (b) { b.disabled = true; b.textContent = `임기가 끝났어요. 최종 ${rankOf(W)}위`; } }
}
function setPhase(p: number) { stopRun(); ui.phase = p; ui.open = false; ui.place = undefined; render(); save(); window.scrollTo({ top: 0 }); }

function start(fresh = false) {
  const d = fresh ? null : load();
  if (d) { W = d.W; plan = d.plan; ui = d.ui || { phase: 0, tab: 'report', pins: [] }; }
  else { setSeed((Date.now() ^ 0x5bd1e995) >>> 0); W = newWorld(); plan = carryPlan(W, null); ui = { phase: 0, tab: 'report', pins: [] }; }
  plan.intelUp = plan.intelUp || {};   // 정보망은 유지비를 저절로 내고, 넓히는 돈만 따로 정한다
  tidyTeams();
  render(); save();
  if (!d) { window.scrollTo(0, 0); playArrival(() => window.scrollTo(0, 0)); }
}

// 첫날 장면: 화면을 누르거나 다음 단추로 넘기고, 건너뛰기나 Esc로 닫는다
$('ar-scene').addEventListener('click', (e: any) => { if (!e.target.closest('#ar-skip')) advanceArrival(); });
$('ar-skip').addEventListener('click', () => closeArrival());
document.addEventListener('keydown', e => {
  // 내정에서 숫자 키: 1~5 장소 창, 6~9 자료 (입력 칸에 있을 때는 넘긴다)
  if (/^[0-9]$/.test(e.key) && ui && ui.phase === 0 && !arrivalOpen() && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const i = e.key === '0' ? 9 : +e.key - 1;
    if (i < PLACE_KEYS.length) { ui.open = false; ui.place = PLACE_KEYS[i]; }
    else if (DOC_KEYS[i - PLACE_KEYS.length]) { ui.place = undefined; ui.open = true; ui.tab = DOC_KEYS[i - PLACE_KEYS.length]; }
    else return;
    e.preventDefault(); render(); save(); return;
  }
  if (e.key !== 'Escape') return;
  if (arrivalOpen()) closeArrival();
  else if (ui && ui.open) { ui.open = false; render(); save(); }
  else if (ui && ui.place) { ui.place = undefined; render(); save(); }
});

// 우리 조 편성: 고칠 때마다 규칙 안으로 맞춰 둔다 (없는 사람·겹친 자리·빈 조를 지우고 조 수를 다시 센다)
function tidyTeams() {
  if (!us(W).crew) return;
  const Q = sanitize(W, us(W), plan);
  plan.teams = Q.teams; plan.tpl = Q.tpl; plan.parties = Q.parties;
}
function teamAct(a: string, b: HTMLElement) {
  const c = us(W), T = plan.teams || [], tpl = plan.tpl || CO.TPL0, pick = ui.pick;
  if (a === 'refill') { plan.teams = formTeams(c, plan.parties, tpl, false).filter(x => x.m.some(y => y != null)); ui.pick = null; }
  else if (a === 'fill-rest') { fillTeams(c, T, tpl); ui.pick = null; }
  else if (a === 'bench') { const id = +(b.dataset.id || 0); ui.pick = pick && pick.id === id ? null : { id }; }
  else if (a === 'to-bench') { if (pick && pick.t != null && T[pick.t]) T[pick.t].m[pick.s!] = null; ui.pick = null; }
  else if (a === 'assign') assignTo(+(b.dataset.id || 0), b.dataset.t || '-1');
  else if (a === 'tfloor') { const x = T[+(b.dataset.t || 0)]; if (x) x.f = +(b.dataset.f || 0); }
  else if (a === 'scout') { const x = T[+(b.dataset.t || 0)]; if (x) { if (x.scout) delete x.scout; else x.scout = true; } }
  else if (a === 'ttorch-auto') { const x = T[+(b.dataset.t || 0)]; if (x) delete x.torch; }
  else if (a === 'slot') {
    const t = +(b.dataset.t || 0), s = +(b.dataset.s || 0);
    if (pick && pick.id != null) { T[t].m[s] = pick.id; ui.pick = null; }   // 대기 인원을 넣는다 (있던 사람은 대기로)
    else if (pick && pick.t != null) { const x = T[pick.t].m[pick.s!]; T[pick.t].m[pick.s!] = T[t].m[s]; T[t].m[s] = x; ui.pick = null; }   // 두 자리를 바꾼다
    else if (T[t].m[s] != null) ui.pick = { t, s };
  }
  tidyTeams(); render(); save();
}
// 편성표 배치 칸: 사람을 t번 조의 빈자리에 넣는다 ('new'면 새 조를 만들고, '-1'이면 대기로)
function assignTo(id: number, t: string) {
  const T = plan.teams || (plan.teams = []);
  T.forEach(x => { x.m = x.m.map(y => (y === id ? null : y)); });
  if (t === 'new') { const f = T.length ? T[T.length - 1].f : 0; T.push({ f, m: [id, null, null, null], g: '' }); return; }
  const x = T[+t]; if (!x) return;
  const s = x.m.findIndex(y => y == null); if (s >= 0) x.m[s] = id;
}
// 한 층의 조 수를 바꾼다: 늘리면 대기 인원으로 기본 편성대로 짠 조를 더하고, 줄이면 그 층의 마지막 조를 대기로 돌린다
function setTeams(f: number, n: number) {
  const c = us(W), tpl = plan.tpl || CO.TPL0;
  let T = plan.teams || [];
  const now = T.filter(x => x.f === f).length;
  for (let k = now; k > n; k--) { const last = T.map((x, i) => [x, i] as const).filter(([x]) => x.f === f).pop(); if (last) T = T.filter((_, i) => i !== last[1]); }
  for (let k = now; k < n; k++) {
    const on = new Set(T.flatMap(x => x.m)), rest = { ...c, crew: (c.crew || []).filter(x => !on.has(x.id)) };
    const add = formTeams(rest, FLOORS_ONE(f), tpl, true);
    if (!add.length) break;
    T = [...T, add[0]];
  }
  plan.teams = T; tidyTeams();
}
const FLOORS_ONE = (f: number) => [0, 1, 2, 3, 4].map(x => (x === f ? 1 : 0));

function say(t: string) {
  const el = $('toast'); el.textContent = t; el.classList.add('show');
  clearTimeout((say as any).t); (say as any).t = setTimeout(() => el.classList.remove('show'), 3200);
}

function act(b: HTMLElement) {
  const a = b.dataset.act;
  if (a === 'phase') return setPhase(+(b.dataset.phase || 0));
  if (a === 'probe-mkt' || a === 'probe-riv') {
    const r = probe(W, a === 'probe-mkt' ? 'mkt' : 'riv', ui.rival || ($('probe-rival') && $('probe-rival').value) || '');
    if (r) { ui.tab = 'probe'; say(a === 'probe-mkt' ? '시장 조사 답이 왔어요' : '타 용병단 조사 답이 왔어요'); }
    render(); save(); return;
  }
  if (a === 'place') { ui.place = b.dataset.place; ui.open = false; render(); save(); (document.querySelector('.place .close') as HTMLElement | null)?.focus(); return; }
  if (a === 'close-place') { const k = ui.place; ui.place = undefined; render(); save(); (document.querySelector(`.spot[data-place="${k}"]`) as HTMLElement | null)?.focus(); return; }
  if (a === 'open-doc') { ui.tab = b.dataset.tab || 'report'; ui.open = true; ui.place = undefined; render(); save(); (document.querySelector('.reader .close') as HTMLElement | null)?.focus(); return; }
  if (a === 'close-doc') { ui.open = false; render(); save(); return; }
  if (a === 'intel-cut') { const k = b.dataset.src as any, cut = new Set(plan.intelCut || []); cut.has(k) ? cut.delete(k) : cut.add(k); plan.intelCut = [...cut] as any; render(); save(); return; }
  if (a === 'dorm') { plan.dorm = !plan.dorm; render(); save(); return; }
  if (a === 'auto-recruit') { delete plan.recruit; delete plan.recruitC; delete plan.pick; render(); save(); return; }
  if (a === 'sellmap') { const f = +(b.dataset.f || 0); if (plan.sellMap === f) delete plan.sellMap; else plan.sellMap = f; render(); save(); return; }
  if (a === 'wsbuild') { const k = b.dataset.k || ''; if (plan.wsBuild === k) delete plan.wsBuild; else plan.wsBuild = k; render(); save(); return; }
  if (a === 'wsdown') { const k = b.dataset.k || ''; if (plan.wsDown === k) delete plan.wsDown; else plan.wsDown = k; render(); save(); return; }
  if (a === 'coach') { plan.coach = +(b.dataset.i || 0); render(); save(); return; }
  if (a === 'auto-prep') { delete plan.prep; render(); save(); return; }
  if (a === 'build') { const k = b.dataset.k || ''; if (plan.build === k) delete plan.build; else plan.build = k; render(); save(); return; }
  if (a === 'pick') {
    const id = +(b.dataset.id || 0), P = plan.pick ? [...plan.pick] : [], k = P.indexOf(id);
    if (k >= 0) P.splice(k, 1); else if (P.length < roomOf(us(W))) P.push(id);
    plan.pick = P; render(); save(); return;
  }
  if (a === 'sort') {
    const sc = b.dataset.scope || 'rs', k = b.dataset.k || 'name', cur = (ui.sort || {})[sc], [ck, cd] = (cur || '').split(':');
    const d = ck === k ? -(+cd || 1) : DESC_FIRST.includes(k) ? -1 : 1;
    ui.sort = { ...(ui.sort || {}), [sc]: `${k}:${d}` }; render(); save(); return;
  }
  if (a === 'refill' || a === 'fill-rest' || a === 'bench' || a === 'to-bench' || a === 'slot' || a === 'assign' || a === 'tfloor' || a === 'scout' || a === 'ttorch-auto') return teamAct(a, b);
  if (a === 'auto-pot') { plan.buy = { ...(plan.buy || {}) }; delete plan.buy.pot; render(); save(); return; }
  if (a === 'kit-add') { const f = +(b.dataset.f || 0); plan.kits = plan.kits || []; plan.kits[f] = [...(plan.kits[f] || []), { n: 0, g: '' }]; render(); save(); return; }
  if (a === 'kit-del') { const f = +(b.dataset.f || 0), k = +(b.dataset.j || 0); if (plan.kits && plan.kits[f]) plan.kits[f].splice(k, 1); render(); save(); return; }
  if (a === 'go') return stamp();
  if (a === 'skip-run') return finishRun();
  if (a === 'mute') { ui.mute = !ui.mute; save(); b.textContent = ui.mute ? '소리 켜기' : '소리 끄기'; return; }
}

function stamp() {
  if (W.month > MONTHS) return;
  const M = runMonth(W, plan);
  plan = carryPlan(W, plan); ui.pick = null; tidyTeams();
  ui.phase = 2; live = true; render(); save(); window.scrollTo({ top: 0 });
  playRun();
  const r = M.res[0];
  say(`제${M.month}월 결재 · 순이익 ${r.net >= 0 ? '+' : '−'}${Math.abs(Math.round(r.net)).toLocaleString('ko-KR')}G · ${rankOf(W)}위${M.opened != null ? ` · ${M.opened + 1}층이 열렸어요` : ''}${M.overflow ? ' · 미궁이 넘쳤어요' : ''}${W.log.some(l => l.m === M.month && /근원 발견/.test(l.t)) ? ' · 근원을 찾았어요' : ''}`);
}

$('desk').addEventListener('click', (e: any) => {
  // 버튼과, 지도 · 책상 위 물건(SVG의 data-act)을 누른다
  const t = e.target.closest('button, .spot[data-act], th[data-act]'); if (!t || t.disabled) return;
  if (t.dataset.act) return act(t);
  if (t.dataset.tab) { ui.tab = t.dataset.tab; render(); save(); return; }
  if (t.dataset.pin) { const p = t.dataset.pin; ui.pins = ui.pins.includes(p) ? ui.pins.filter(x => x !== p) : [...ui.pins, p]; render(); save(); return; }
  if (t.dataset.k) edit(t.dataset.k, +t.dataset.i, (v: number) => v + +t.dataset.d, +(t.dataset.j || 0));
});
// 지도 위 장소는 Tab으로 고르고 Enter · Space로 연다
$('desk').addEventListener('keydown', (e: any) => {
  const t = e.target; if (!(t instanceof Element) || !(t.classList.contains('spot') || t.matches('th[data-act]')) || (e.key !== 'Enter' && e.key !== ' ')) return;
  e.preventDefault(); act(t as HTMLElement);
});
$('desk').addEventListener('change', (e: any) => {
  const t = e.target, k = t.dataset.k;
  if (!k) return;
  if (k === 'rival') { ui.rival = t.value; save(); return; }
  if (k === 'kitC' || k === 'kitG') {
    const f = +t.dataset.i, j = +t.dataset.j, pre = k === 'kitC' ? 'c:' : 'g:';
    const K = plan.kits && plan.kits[f] && plan.kits[f][j]; if (!K) return;
    const ps = (K.g || '').split('+').filter((x: string) => x && !x.startsWith(pre));
    if (t.value) ps.push(t.value);
    K.g = ps.sort().join('+'); render(); save(); return;
  }
  if (k === 'tpl') { const tp = [...(plan.tpl || CO.TPL0)]; tp[+t.dataset.i] = t.value; plan.tpl = tp; render(); save(); return; }
  if (k === 'teamG') { const T = plan.teams && plan.teams[+t.dataset.i]; if (T) T.g = t.value; render(); save(); return; }
  if (k === 'assign') { assignTo(+t.dataset.id, t.value); tidyTeams(); render(); save(); return; }
  if (k === 'tarm' || k === 'tcart') { const T = plan.teams && plan.teams[+t.dataset.i]; if (T) { const v = +t.value; if (k === 'tarm') { if (v) T.arm = v; else delete T.arm; } else { if (v) T.cart = v; else delete T.cart; } } render(); save(); return; }
  if (k === 'wsF') { plan.wsF = +t.value; render(); save(); return; }
  if (k === 'spyOn') { const on = [...(plan.spyOn || [])]; on[+t.dataset.i] = t.value; plan.spyOn = on.filter(Boolean); render(); save(); return; }
  if (k === 'rootf') { plan.root = { f: +t.value, seal: plan.root ? plan.root.seal : 0, mine: plan.root ? plan.root.mine : 0 }; render(); save(); return; }
  if (k === 'basef') { plan.base = { f: +t.value, amt: plan.base ? plan.base.amt : 0 }; render(); save(); return; }
  edit(k, +t.dataset.i, () => Math.round(+t.value || 0), +(t.dataset.j || 0));
});

function edit(k: string, i: number, fn: (v: number) => number, j = 0) {
  const buy = () => (plan.buy = { ...(plan.buy || {}) });
  if (k === 'train') plan.train = Math.max(0, fn(plan.train));
  else if (k === 'donate') plan.donate = Math.max(0, fn(plan.donate || 0));
  else if (k === 'tool') plan.tool = Math.max(0, Math.min(2, fn(plan.tool || 0)));
  else if (k === 'proc') plan.proc = Math.max(0, fn(plan.proc || 0));
  else if (k === 'prep') { const key = PREP_KEYS[i], cur = (plan.prep && plan.prep[key] != null) ? plan.prep[key] : (sanitize(W, us(W), plan).prep || {})[key] || 0; plan.prep = { ...(sanitize(W, us(W), plan).prep || {}), ...(plan.prep || {}), [key]: Math.max(0, fn(cur)) }; }
  else if (k === 'take') plan.take = { ...(plan.take || {}), [i]: Math.max(0, fn((plan.take && plan.take[i]) || 0)) };
  else if (k === 'recruitC') {
    const cls = CLASSES[i], cur = +(document.querySelector(`input[data-k="recruitC"][data-i="${i}"]`) as HTMLInputElement)?.value || 0;
    if (!plan.recruitC) plan.recruitC = Object.fromEntries(CLASSES.map((x, j) => [x, +(document.querySelector(`input[data-k="recruitC"][data-i="${j}"]`) as HTMLInputElement)?.value || 0]));
    plan.recruitC[cls] = Math.max(0, fn(plan.recruitC[cls] != null ? plan.recruitC[cls] : cur));
  }
  else if (k === 'parties' && us(W).crew) setTeams(i, Math.max(0, fn((plan.teams || []).filter(x => x.f === i).length)));
  else if (k === 'recruit') { const cur = +(document.querySelector('input[data-k="recruit"]') as HTMLInputElement)?.value || 0; plan.recruit = Math.max(0, fn(plan.recruit != null ? plan.recruit : cur)); }
  else if (k === 'buyPot') { const cur = +(document.querySelector('input[data-k="buyPot"]') as HTMLInputElement)?.value || 0; buy().pot = Math.max(0, fn(plan.buy && plan.buy.pot != null ? plan.buy.pot : cur)); }
  else if (k === 'buyHoly') buy().holy = Math.max(0, fn((plan.buy && plan.buy.holy) || 0));
  else if (k === 'buyGear') {
    const g = GEAR_NAMES[i], cur = +(document.querySelector(`input[data-k="buyGear"][data-i="${i}"]`) as HTMLInputElement)?.value || 0;
    const B = buy(); B.gear = { ...(B.gear || {}) }; B.gear[g] = Math.max(0, fn(B.gear[g] != null ? B.gear[g] : cur));
  }
  else if (k === 'kitN') { const K = plan.kits && plan.kits[i] && plan.kits[i][j]; if (K) K.n = Math.max(0, fn(K.n)); }
  else if (k === 'intelUp') { const s = SRCS[i]; plan.intelUp = { ...(plan.intelUp || {}) }; plan.intelUp[s] = Math.max(0, fn(plan.intelUp[s] || 0)); }
  else if (k === 'intel') { const s = SRCS[i]; plan.intel = { ...(plan.intel || {}) }; plan.intel[s] = Math.max(0, fn(plan.intel[s] || 0)); }
  else if (k === 'seal' || k === 'mine') {
    const f = plan.root ? plan.root.f : (W.roots || []).findIndex(r => r.found && !r.done);
    const R = plan.root || { f, seal: 0, mine: 0 };
    R[k] = Math.max(0, fn(R[k])); plan.root = { ...R, f };
  }
  else if (k === 'base') { const f = plan.base ? plan.base.f : Math.max(0, W.unlocked - 1); plan.base = { f, amt: Math.max(0, fn(plan.base ? plan.base.amt : 0)) }; }
  else if (k === 'pots') plan.pots[i] = Math.max(0, Math.min(8, fn(plan.pots[i])));
  // 조마다 챙길 포션 · 횃불: 지금 보이는 값(비워 둔 조는 그 층 조당 포션 · 지도로 어림한 횃불)에서 바꾼다
  else if (k === 'tpots' || k === 'ttorch') { const T = plan.teams && plan.teams[i], cur = +(document.querySelector(`input[data-k="${k}"][data-i="${i}"]`) as HTMLInputElement)?.value || 0; if (T) T[k === 'tpots' ? 'pots' : 'torch'] = Math.max(0, Math.min(12, fn(cur))); }
  else if ((plan as any)[k]) (plan as any)[k][i] = Math.max(0, fn((plan as any)[k][i]));
  render(); save();
  const el = document.querySelector(`input[data-k="${k}"][data-i="${i}"]`) as HTMLElement | null; if (el && document.activeElement === document.body) el.focus();
}

// ---------- 귀환 장부 연출: 줄마다 띵 하고 뜨고, 장부 금액이 따라 오르내리고, 마지막에 순이익이 찍힌다 ----------
let actx: AudioContext | null = null;
function tone(freqs: number[], dur = 0.09, type: OscillatorType = 'triangle', gap = 0.07, vol = 0.07) {
  if (ui.mute) return;
  try {
    actx = actx || new (window.AudioContext || (window as any).webkitAudioContext)();
    const t0 = actx.currentTime;
    freqs.forEach((f, i) => {
      const o = actx!.createOscillator(), g = actx!.createGain(), t = t0 + i * gap;
      o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(actx!.destination); o.start(t); o.stop(t + dur + 0.02);
    });
  } catch { /* 소리를 못 내도 연출은 이어진다 */ }
}
const SOUND: Record<string, (i: number) => void> = {
  ok: i => tone([660 + i * 18]), no: () => tone([233], 0.12, 'sine'), die: () => tone([147, 110], 0.2, 'square', 0.08, 0.05),
  gain: i => tone([988 + i * 30, 1319 + i * 30], 0.1), cost: () => tone([330, 247], 0.12, 'sine'),
  win: () => tone([523, 659, 784, 1047], 0.32, 'triangle', 0.09), lose: () => tone([220, 196, 165], 0.36, 'sine', 0.12),
};
const sgnG = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(Math.round(n)).toLocaleString('ko-KR');
function countTo(el: HTMLElement, from: number, to: number) {
  const t0 = performance.now(), d = 260;
  const f = (t: number) => { const k = Math.min(1, (t - t0) / d); el.textContent = sgnG(from + (to - from) * k); el.classList.toggle('neg', from + (to - from) * k < 0); if (k < 1) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}
function stopRun() { clearTimeout(runTimer); runTimer = null; live = false; }
function playRun() {
  const box = document.querySelector('.run.live') as HTMLElement | null; if (!box) return;
  const items = [...box.querySelectorAll('li.rv')] as HTMLElement[], tv = box.querySelector('.tv') as HTMLElement;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return finishRun();
  let acc = 0, i = 0, nOk = 0;
  const step = () => {
    if (i >= items.length) return finishRun();
    const li = items[i++], k = li.dataset.k || '', v = +(li.dataset.v || 0);
    li.classList.add('on');
    if (k === 'net') {
      const fin = +(box.dataset.net || 0);
      countTo(tv, acc, fin); box.classList.add(fin >= 0 ? 'win' : 'lose'); SOUND[fin >= 0 ? 'win' : 'lose'](0);
      runTimer = setTimeout(finishRun, 900); return;
    }
    if (v) { countTo(tv, acc, acc + v); acc += v; }
    SOUND[k] && SOUND[k](k === 'ok' ? nOk++ : i);
    const next = items[i] ? items[i].dataset.k : '';
    runTimer = setTimeout(step, k === 'ok' || k === 'no' ? 170 : k === 'die' ? 420 : next === 'net' ? 900 : k === 'gain' ? 480 : 340);
  };
  runTimer = setTimeout(step, 350);
}
function finishRun() {
  clearTimeout(runTimer); runTimer = null;
  const box = document.querySelector('.run.live') as HTMLElement | null;
  if (box) {
    box.querySelectorAll('li.rv').forEach(li => li.classList.add('on'));
    const fin = +(box.dataset.net || 0), tv = box.querySelector('.tv') as HTMLElement;
    tv.textContent = sgnG(fin); tv.classList.toggle('neg', fin < 0); box.classList.add(fin >= 0 ? 'win' : 'lose'); box.classList.remove('live');
    box.querySelector('.skip')?.remove();
  }
  live = false;
  document.querySelector('.resultwrap')?.classList.add('done');
}

$('newgame').addEventListener('click', () => { if (W.month === 1 || confirm('지금 판을 버리고 새 게임을 시작할까요?')) start(true); });

start();

// 그래프 위에 마우스를 올리면 그달 숫자를 보여 준다 (data-tip: "제목|줄|줄")
const tip = $('tip');
document.addEventListener('pointermove', (ev: PointerEvent) => {
  const el = (ev.target as HTMLElement).closest('[data-tip]') as HTMLElement | null;
  if (!el) { tip.hidden = true; return; }
  const [t, ...ls] = (el.dataset.tip || '').split('|');
  tip.innerHTML = `<b>${t}</b>${ls.map(l => `<div>${l}</div>`).join('')}`; tip.hidden = false;
  const r = tip.getBoundingClientRect(); let x = ev.clientX + 14, y = ev.clientY + 14;
  if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14; if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 14;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
});
