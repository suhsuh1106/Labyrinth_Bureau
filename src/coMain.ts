// 용병단 행정실 진입점: 결정표를 고치고, 결재하면 한 달을 돌리고, 판을 이 브라우저에 저장한다
import './ui/style.css';
import './ui/co/co.css';
import { setSeed } from './core/rng';
import { type Plan, type World, carryPlan, newWorld, rankOf, runMonth } from './core/company';
import { planHtml, plaqueHtml, resultsHtml } from './ui/co/view';

const $ = (id: string): any => document.getElementById(id);
const KEY = 'lb-co', VERSION = 4, MONTHS = 36;   // 4: 미궁의 압력·근원·귀환 보고가 생김 (이전 판은 새 게임으로)
let W: World, plan: Plan;

function save() { try { localStorage.setItem(KEY, JSON.stringify({ v: VERSION, W, plan })); } catch { /* 저장이 막혀도 판은 계속된다 */ } }
function load() { try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); return d && d.v === VERSION ? d : null; } catch { return null; } }

function render() {
  $('stats').innerHTML = plaqueHtml(W);
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
}

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
  if (t.dataset.k === 'rootf') { plan.root = { f: +t.value, seal: plan.root ? plan.root.seal : 0, mine: plan.root ? plan.root.mine : 0 }; render(); save(); return; }
  if (t.dataset.k === 'basef') { plan.base = { f: +t.value, amt: plan.base ? plan.base.amt : 0 }; render(); save(); return; }
  if (t.dataset.k) edit(t.dataset.k, +t.dataset.i, () => Math.round(+t.value || 0));
});
function edit(k: string, i: number, fn: (v: number) => number) {
  if (k === 'train') plan.train = Math.max(0, fn(plan.train));
  else if (k === 'church') plan.church = Math.max(0, fn(plan.church || 0));
  else if (k === 'donate') plan.donate = Math.max(0, fn(plan.donate || 0));
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
