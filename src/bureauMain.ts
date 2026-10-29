// 미궁관리국 진입점(index.html): 날마다 보고를 읽고 보조금 · 조항 · 요청서 · 회의로 손을 쓰고, 다음 날로 넘긴다.
// 판을 이 브라우저에 저장한다(`lb-bureau`). 엔진은 src/bureau/engine.ts
import './ui/bureau/bureau.css';
import { getSeed, setSeed } from './core/rng';
import { type FacId, type World, answer, meet, newWorld, over, run, step } from './bureau/engine';
import { BOT } from './bureau/bots';
import { type BuUi, type Tab, endHtml, introHtml, paneHtml, tabsHtml, topHtml } from './ui/bureau/board';
import { mapHtml } from './ui/bureau/map';

const $ = (id: string) => document.getElementById(id)!;
const KEY = 'lb-bureau', VERSION = 1;
let W: World, ui: BuUi, seed = 0;

function save() { try { localStorage.setItem(KEY, JSON.stringify({ v: VERSION, seed, rng: getSeed(), W, ui })); } catch { /* 저장이 막혀도 판은 계속된다 */ } }
function load() { try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); return d && d.v === VERSION ? d : null; } catch { return null; } }

function fresh() {
  seed = (Date.now() ^ 0x5bd1e995) >>> 0;
  W = newWorld(seed);
  ui = { tab: 'look', sel: 'dg:0', invite: ['big', 'small'], give: {}, intro: true, seenNews: W.reports.length };
}

function draw() {
  $('top').innerHTML = topHtml(W);
  $('board').innerHTML = mapHtml(W, ui);
  if (ui.tab === 'news') ui.seenNews = W.reports.length;
  $('tabs').innerHTML = tabsHtml(W, ui);
  $('pane').innerHTML = paneHtml(W, ui);
  const ov = $('over');
  if (ui.intro) { ov.innerHTML = introHtml(); ov.hidden = false; }
  else if (over(W)) {
    // 같은 판을 봇이 처음부터 했다면: 난수 자리를 잠깐 빌려 쓰고 되돌린다
    const keep = getSeed(), idle = run(newWorld(seed), BOT.idle), smart = run(newWorld(seed), BOT.smart);
    setSeed(keep);
    ov.innerHTML = endHtml(W, idle, smart); ov.hidden = false;
  } else ov.hidden = true;
}

// 하루 넘기기. 닷새는 새 요청서 · 새 보고가 오면 멈춘다
function nextDays(n: number) {
  const asks = W.asks.filter(a => a.got == null).length, news = W.reports.length;
  for (let k = 0; k < n && !over(W); k++) {
    step(W);
    if (W.asks.filter(a => a.got == null).length > asks || W.reports.length > news) break;
  }
  save(); draw();
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
function act(a: string, d = 0) {
  const [k, arg] = a.split(':'), rest = a.slice(k.length + 1);
  if (k === 'next') return nextDays(1);
  if (k === 'ff') return nextDays(5);
  if (k === 'start') ui.intro = false;
  else if (k === 'new') fresh();
  else if (k === 'tab') ui.tab = arg as Tab;
  else if (k === 'sel') { ui.sel = rest; ui.tab = 'look'; }
  else if (k === 'sub') { const dg = W.dungeons[+arg]; dg.sub = clamp(dg.sub + d * 5, 0, 60); }
  else if (k === 'prio') W.prio = clamp(W.prio + d * 5, 0, 100);
  else if (k === 'share') W.lordShare = clamp(W.lordShare + d, 0, 40);
  else if (k === 'give') { const ask = W.asks.find(x => x.id === +arg); if (ask) ui.give[ask.id] = clamp((ui.give[ask.id] ?? ask.want) + d * 10, 0, ask.want); }
  else if (k === 'answer' || k === 'refuse') { const ask = W.asks.find(x => x.id === +arg); if (ask) { answer(W, ask.id, k === 'refuse' ? 0 : ui.give[ask.id] ?? ask.want); delete ui.give[ask.id]; } }
  else if (k === 'inv') { const f = arg as FacId; ui.invite = ui.invite.includes(f) ? ui.invite.filter(x => x !== f) : [...ui.invite, f]; }
  else if (k === 'meet') { meet(W, ui.invite); ui.tab = 'news'; }
  else return;
  save(); draw();
}

// − + 단추는 길게 누르면 빨라진다
let hold: any = null;
const stopHold = () => { clearTimeout(hold); clearInterval(hold); hold = null; };
document.addEventListener('pointerdown', e => {
  const b = (e.target as Element).closest('[data-d]') as HTMLElement | null;
  if (!b) return;
  e.preventDefault();
  const run1 = () => act(b.dataset.act!, +b.dataset.d!);
  run1();
  hold = setTimeout(() => { hold = setInterval(run1, 70); }, 380);
});
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) document.addEventListener(ev, stopHold);
document.addEventListener('click', e => {
  const b = (e.target as Element).closest('[data-act]') as HTMLElement | null;
  if (!b || b.dataset.d || (b as HTMLButtonElement).disabled) return;
  act(b.dataset.act!);
});
document.addEventListener('keydown', e => {
  const b = (e.target as Element).closest?.('[data-d]') as HTMLElement | null;
  if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); act(b.dataset.act!, +b.dataset.d!); return; }
  // 지도 표식(svg)은 단추가 아니라서 Enter를 직접 받는다
  const m = (e.target as Element).closest?.('svg [data-act]') as SVGElement | null;
  if (m && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); act(m.dataset.act!); return; }
  if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !ui.intro && !over(W)) nextDays(1);
});

const d = load();
if (d) { W = d.W; ui = d.ui; seed = d.seed; setSeed(d.rng); } else fresh();
draw();
