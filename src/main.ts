// 진입점: 화면 이벤트를 연결하고 게임을 시작한다
import './ui/style.css';
import { S, newGame } from './core/state';
import { resolve } from './core/turn';
import { render, start } from './ui/app';
import { syncBudget } from './ui/budget';

const $ = (id: string): any => document.getElementById(id);

$('lines').addEventListener('click', e => {
  const b = e.target.closest('[data-dev]'); if (!b || S.over) return;
  const id = b.dataset.dev, i = +b.dataset.opt;
  if (S.devPick[id] === i) delete S.devPick[id]; else S.devPick[id] = i;
  syncBudget();
});
$('tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-tab]'); if (!b) return;
  S.tab = b.dataset.tab; render(false);
});
$('panel').addEventListener('click', e => {
  const b = e.target.closest('[data-action]'); if (!b) return;
  const a = b.dataset.action;
  if (a === 'restart') { newGame(); render(); window.scrollTo(0, 0); }
  if (a === 'guide') {
    const f = +b.dataset.floor, key = S.guideDraft[f] || $('g-' + f).value;
    if (!key || S.over) return;
    S.pendingGuide = { f, key }; render(false);
  }
  if (a === 'cancel-guide') { S.pendingGuide = null; render(false); }
  if (a === 'trial-stop') { S.trial = null; render(false); }
  if (a === 'build' && !S.over) { S.fac[b.dataset.fac] = { state: 'pending' }; render(false); }
  if (a === 'cancel-build') { delete S.fac[b.dataset.fac]; render(false); }
  if (a === 'offer') { const o = S.offers.find(x => x.id === b.dataset.id); if (o) { o.accepted = !o.accepted; if (o.id === 'bulk' && o.accepted) S.budget.potC = 0; } render(false); }
  if (a === 'agenda' && S.agenda && !S.over) { const i = +b.dataset.i; S.agenda.pick = S.agenda.pick === i ? null : i; render(false); }
  if (a === 'stat-toggle') S.statOpen = !S.statOpen;
  if (a === 'hero-pick' && !S.over) { const x = S.heroApps.find(y => y.id === +b.dataset.id); if (x) x.pick = !x.pick; render(false); }
  if (a === 'book-month') { S.bookView = +b.dataset.m; render(false); }
});
$('panel').addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.floor !== undefined && t.tagName === 'SELECT') { S.guideDraft[+t.dataset.floor] = t.value; render(false); return; }
  if (t.dataset.trial) {
    const f = t.dataset.trial === 'f' ? +t.value : (S.trial ? S.trial.f : +$('t-f').value);
    const key = t.dataset.trial === 'key' ? t.value : (S.trial ? S.trial.key : $('t-k').value);
    S.trial = key ? { f, key } : null;
    if (S.trial && !S.budget.trial) S.budget.trial = 900;
    render(false); return;
  }
  if (t.dataset.stat === 'floor') { S.statFloor = +t.value; render(false); }
  if (t.dataset.stat === 'range') { S.statRange = +t.value; render(false); }
  if (t.dataset.book === 'view') { S.bookView = /^\d+$/.test(t.value) ? +t.value : t.value; render(false); }
});
$('form').addEventListener('submit', e => {
  e.preventDefault();
  if (S.over) return;
  resolve(); S.guideDraft = {}; S.bookView = 'last'; render();
  if (window.innerWidth <= 860) window.scrollTo({ top: 0 });
});

start({});
