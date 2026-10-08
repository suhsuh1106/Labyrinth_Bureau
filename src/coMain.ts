// 용병단 행정실 진입점: 결정표를 고치고, 결재하면 한 달을 돌리고, 판을 이 브라우저에 저장한다
import './ui/co/base.css';
import './ui/co/co.css';
import { setSeed } from './core/rng';
import { type Plan, SRCS, type World, carryPlan, newWorld, rankOf, runMonth } from './core/company';
import { planHtml, plaqueHtml, resultsHtml } from './ui/co/view';
import { intelHtml } from './ui/co/intel';
import { advanceArrival, arrivalOpen, closeArrival, playArrival } from './ui/co/arrival';

const $ = (id: string): any => document.getElementById(id);
const KEY = 'lb-co', VERSION = 5, MONTHS = 36;   // 5: 정보망·전리품 비율·몬스터 적응이 생김 (이전 판은 새 게임으로)
let W: World, plan: Plan;

function save() { try { localStorage.setItem(KEY, JSON.stringify({ v: VERSION, W, plan })); } catch { /* 저장이 막혀도 판은 계속된다 */ } }
function load() { try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); return d && d.v === VERSION ? d : null; } catch { return null; } }

function render() {
  $('stats').innerHTML = plaqueHtml(W);
  $('intel').innerHTML = intelHtml(W);
  $('plan').innerHTML = planHtml(W, plan);
  $('results').innerHTML = resultsHtml(W);
  const over = W.month > MONTHS;
  $('go').disabled = over;
  $('go-note').textContent = over ? `임기가 끝났어요. 최종 ${rankOf(W)}위` : `${MONTHS - W.month + 1}개월 남음`;
}

function start(fresh = false) {
  const d = fresh ? null : load();
  if (d) { W = d.W; plan = d.plan; }
  else { setSeed((Date.now() ^ 0x5bd1e995) >>> 0); W = newWorld(); plan = carryPlan(W, null); }
  render(); save();
  // 새 판이면 미궁을 처음 여는 날의 장면부터 보여 주고, 끝나면 결정표로 간다
  if (!d) { window.scrollTo(0, 0); playArrival(() => $('plan').scrollIntoView({ block: 'start' })); }
}

// 첫날 장면: 화면을 누르거나 다음 단추로 넘기고, 건너뛰기나 Esc로 닫는다
$('ar-scene').addEventListener('click', (e: any) => { if (!e.target.closest('#ar-skip')) advanceArrival(); });
$('ar-skip').addEventListener('click', () => closeArrival());
document.addEventListener('keydown', e => { if (arrivalOpen() && e.key === 'Escape') closeArrival(); });

function say(t: string) {
  const el = $('toast'); el.textContent = t; el.classList.add('show');
  clearTimeout((say as any).t); (say as any).t = setTimeout(() => el.classList.remove('show'), 3200);
}

// 숫자 고치기: +/− 단추와 직접 입력
$('plan').addEventListener('click', (e: any) => {
  const b = e.target.closest('button[data-k]'); if (!b) return;
  edit(b.dataset.k, +b.dataset.i, (v: number) => v + +b.dataset.d);
});
$('plan').addEventListener('change', (e: any) => {
  const t = e.target;
  if (t.dataset.k === 'guide') { plan.guide = plan.guide || []; plan.guide[+t.dataset.i] = t.value; render(); save(); return; }
  if (t.dataset.k === 'spyOn') { const on = [...(plan.spyOn || [])]; on[+t.dataset.i] = t.value; plan.spyOn = on.filter(Boolean); render(); save(); return; }
  if (t.dataset.k === 'rootf') { plan.root = { f: +t.value, seal: plan.root ? plan.root.seal : 0, mine: plan.root ? plan.root.mine : 0 }; render(); save(); return; }
  if (t.dataset.k === 'basef') { plan.base = { f: +t.value, amt: plan.base ? plan.base.amt : 0 }; render(); save(); return; }
  if (t.dataset.k) edit(t.dataset.k, +t.dataset.i, () => Math.round(+t.value || 0));
});
function edit(k: string, i: number, fn: (v: number) => number) {
  if (k === 'train') plan.train = Math.max(0, fn(plan.train));
  else if (k === 'church') plan.church = Math.max(0, fn(plan.church || 0));
  else if (k === 'donate') plan.donate = Math.max(0, fn(plan.donate || 0));
  else if (k === 'tool') plan.tool = Math.max(0, Math.min(2, fn(plan.tool || 0)));
  else if (k === 'proc') plan.proc = Math.max(0, fn(plan.proc || 0));
  else if (k === 'intel') { const s = SRCS[i]; plan.intel = { ...(plan.intel || {}) }; plan.intel[s] = Math.max(0, fn(plan.intel[s] || 0)); }
  else if (k === 'seal' || k === 'mine') {
    const f = plan.root ? plan.root.f : (W.roots || []).findIndex(r => r.found && !r.done);
    const R = plan.root || { f, seal: 0, mine: 0 };
    R[k] = Math.max(0, fn(R[k])); plan.root = { ...R, f };
  }
  else if (k === 'base') { const f = plan.base ? plan.base.f : Math.max(0, W.unlocked - 1); plan.base = { f, amt: Math.max(0, fn(plan.base ? plan.base.amt : 0)) }; }
  else if (k === 'pots') plan.pots[i] = Math.max(1, Math.min(8, fn(plan.pots[i])));
  else (plan as any)[k][i] = Math.max(0, fn((plan as any)[k][i]));
  render(); save();
  // 다시 그린 뒤에도 같은 칸에 초점을 둔다
  const el = document.querySelector(`input[data-k="${k}"][data-i="${i}"]`) as HTMLElement | null; if (el && document.activeElement === document.body) el.focus();
}

$('go').addEventListener('click', () => {
  if (W.month > MONTHS) return;
  const M = runMonth(W, plan);
  plan = carryPlan(W, plan);
  render(); save();
  const r = M.res[0];
  say(`제${M.month}월 결재 · 순이익 ${r.net >= 0 ? '+' : '−'}${Math.abs(Math.round(r.net)).toLocaleString('ko-KR')}G · ${rankOf(W)}위${M.opened != null ? ` · ${M.opened + 1}층이 열렸어요` : ''}${M.overflow ? ' · 미궁이 넘쳤어요' : ''}${W.log.some(l => l.m === M.month && /근원 발견/.test(l.t)) ? ' · 근원을 찾았어요' : ''}`);
  $('results').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
});
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
