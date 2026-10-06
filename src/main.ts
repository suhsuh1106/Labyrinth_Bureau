// 진입점: 책상 위 물건과 서류의 이벤트를 연결하고 게임을 시작한다
import './ui/style.css';
import { S, newGame } from './core/state';
import { render, start } from './ui/app';
import { onBudgetClick, syncBudget } from './ui/budget';
import { approve, closeReader, openReader, readerKey, renderReader } from './ui/desk';
import { showIssue } from './ui/news';
import { momentsOpen, renderShelf, renderSoundBtn, skipMoments, toggleSound } from './ui/moments';

const $ = (id: string): any => document.getElementById(id);

// 책상 위 물건을 누르면 그 서류를 집어 든다
document.querySelectorAll('[data-open]').forEach((b: any) => b.addEventListener('click', () => openReader(b.dataset.open, b)));
$('close').addEventListener('click', () => closeReader());
$('reader').addEventListener('click', e => { if (e.target === $('reader')) closeReader(); });
document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (momentsOpen()) skipMoments(); else if (readerKey()) closeReader(); });
$('mo-skip').addEventListener('click', () => skipMoments());
$('sound').addEventListener('click', () => toggleSound());

// 결재: 책상 위 도장이든 예산안 안의 버튼이든 같은 연출로 한 달을 넘긴다
$('stamp').addEventListener('click', () => approve());
$('form').addEventListener('submit', e => { e.preventDefault(); approve(); });

$('budget-editor').addEventListener('click', e => {
  if (onBudgetClick(e.target)) return;
  const b = e.target.closest('[data-dev]'); if (!b || S.over) return;
  const id = b.dataset.dev, i = +b.dataset.opt;
  if (S.devPick[id] === i) delete S.devPick[id]; else S.devPick[id] = i;
  syncBudget();
});
$('panel').addEventListener('click', e => {
  const b = e.target.closest('[data-action]'); if (!b) return;
  const a = b.dataset.action;
  if (a === 'restart') { newGame(); closeReader(false); render(); renderShelf(); window.scrollTo(0, 0); }
  if (a === 'guide') {
    const f = +b.dataset.floor, key = S.guideDraft[f] || $('g-' + f).value;
    if (!key || S.over) return;
    S.pendingGuide = { f, key }; render(false);
  }
  if (a === 'cancel-guide') { S.pendingGuide = null; render(false); }
  if (a === 'trial-stop') { S.trial = null; render(false); }
  if (a === 'build' && !S.over) { S.fac[b.dataset.fac] = { state: 'pending' }; render(false); }
  if (a === 'cancel-build') { delete S.fac[b.dataset.fac]; render(false); }
  if (a === 'offer') { const o = S.offers.find(x => x.id === b.dataset.id); if (o) { o.accepted = !o.accepted; } render(false); }
  if (a === 'agenda' && S.agenda && !S.over) { const i = +b.dataset.i; S.agenda.pick = S.agenda.pick === i ? null : i; render(false); }
  if (a === 'stat-toggle') S.statOpen = !S.statOpen;
  if (a === 'hero-pick' && !S.over) { const x = S.heroApps.find(y => y.id === +b.dataset.id); if (x) x.pick = !x.pick; render(false); }
  if (a === 'book-month') { S.bookView = +b.dataset.m; render(false); }
  if (a === 'paper') { showIssue(+b.dataset.m); renderReader(); $('held').scrollTop = 0; }
});
$('lines').addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.fee !== undefined && !S.over) { S.fees[+t.dataset.fee] = +t.value; syncBudget(); }
});
$('panel').addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.floor !== undefined && t.tagName === 'SELECT') { S.guideDraft[+t.dataset.floor] = t.value; render(false); return; }
  if (t.dataset.trial) {
    const f = t.dataset.trial === 'f' ? +t.value : (S.trial ? S.trial.f : +$('t-f').value);
    const key = t.dataset.trial === 'key' ? t.value : (S.trial ? S.trial.key : $('t-k').value);
    S.trial = key ? { f, key } : null;
    render(false); return;
  }
  if (t.dataset.paper === 'pick') { showIssue(+t.value); renderReader(); $('held').scrollTop = 0; return; }
  if (t.dataset.stat === 'floor') { S.statFloor = +t.value; render(false); }
  if (t.dataset.stat === 'range') { S.statRange = +t.value; render(false); }
  if (t.dataset.book === 'view') { S.bookView = /^\d+$/.test(t.value) ? +t.value : t.value; render(false); }
});

start({});
renderShelf(); renderSoundBtn();
