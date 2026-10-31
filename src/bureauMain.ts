// 미궁관리국 진입점(index.html): 날마다 보고를 읽고 서류(조항을 조합한 공고문 · 받은 청) · 규정 · 회의로 손을 쓰고, 다음 날로 넘긴다.
// 판을 이 브라우저에 저장한다(`lb-bureau`). 엔진은 src/bureau/engine.ts
import './ui/bureau/bureau.css';
import { getSeed, setSeed } from './core/rng';
import { type FacId, type World, answer, hireClerk, meet, newWorld, over, post, recall, run, send, step, withdraw } from './bureau/engine';
import { BOT } from './bureau/bots';
import { CLAUSE, type ClauseId, type Tag, FORM_OF, type To, addClause, canAdd, dropClause } from './bureau/clauses';
import { type BuUi, type DocKind, DRAFT0, type Shelf, type Tab, asksFloatHtml, deskHtml, docModalHtml, setHtml, reportDocHtml, endHtml, introHtml, paneHtml, topHtml, tutHtml, writeHtml } from './ui/bureau/board';
import { mapHtml, minisOf, terrainSvg } from './ui/bureau/map';
import { type Desk, makeDesk } from './ui/bureau/desk';
import { rumorAt } from './ui/bureau/rumor';

const $ = (id: string) => document.getElementById(id)!;
const KEY = 'lb-bureau', VERSION = 15;
let W: World, ui: BuUi, seed = 0, desk: Desk | null = null;

function save() { try { localStorage.setItem(KEY, JSON.stringify({ v: VERSION, seed, rng: getSeed(), W, ui })); } catch { /* 저장이 막혀도 판은 계속된다 */ } }
function load() { try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); return d && d.v === VERSION ? d : null; } catch { return null; } }

function fresh() {
  seed = (Date.now() ^ 0x5bd1e995) >>> 0;
  W = newWorld(seed);
  ui = { tab: 'look', open: false, sel: 'dg:0', invite: [], give: {}, intro: true, seenNews: W.reports.length, docSeen: 0, askSeen: 0 };
}

function draw() {
  $('top').innerHTML = topHtml(W, ui);
  // 땅은 한 번만 깔고, 날마다 바뀌는 표식 · 미니어처 · 책상 위 물건만 다시 그린다
  if (!desk) { $('map').querySelector('.terrain')!.innerHTML = terrainSvg(W); desk = makeDesk($('desk')); }
  $('marks').innerHTML = mapHtml(W, ui);
  $('props').innerHTML = deskHtml(W, ui);
  desk.minis(minisOf(W, flow()));
  desk.stand();
  if (ui.open && ui.tab === 'office') ui.seenNews = W.reports.length;
  const sheet = $('sheet');
  sheet.hidden = !ui.open; sheet.dataset.tab = ui.tab;
  $('pane').innerHTML = ui.open ? paneHtml(W, ui) : '';
  $('tut').innerHTML = tutHtml(W, ui);
  $('asks').innerHTML = asksFloatHtml(W, ui);
  rumor();
  const ov = $('over');
  if (ui.intro) { ov.innerHTML = introHtml(); ov.hidden = false; }
  else if (over(W)) {
    // 같은 판을 봇이 처음부터 했다면: 난수 자리를 잠깐 빌려 쓰고 되돌린다
    const keep = getSeed(), idle = run(newWorld(seed), BOT.idle), smart = run(newWorld(seed), BOT.smart);
    setSeed(keep);
    ov.innerHTML = endHtml(W, idle, smart); ov.hidden = false;
  } else if (ui.read != null) { ov.innerHTML = reportDocHtml(W, ui.read, true); ov.hidden = false; }
  else if (ui.modal === 'set') { ov.innerHTML = setHtml(W); ov.hidden = false; }
  else if (ui.modal === 'write') { ov.innerHTML = `<div class="card modal write-modal">${writeHtml(W, ui)}</div>`; ov.hidden = false; }
  else {
    // 받은 서류는 한 장씩 새 창으로(청 · 독촉은 오른쪽 위 쪽지를 눌러 펼친다)
    const doc = docModalHtml(W, ui);
    ov.innerHTML = doc; ov.hidden = !doc;
  }
}

// 하루 넘기기. 닷새는 새 요청서 · 새 보고가 오면 멈춘다
// 날 사이의 걸음: 날을 넘기지 않아도 조가 제 걸음 비율대로 조금씩 걸어 다음 날 자리에 다가간다(그날 몫의 92%까지, 점점 느리게).
// 화면만 움직이고 판의 수치는 날마다 바뀐다
let dayAt = performance.now();
const STILL = matchMedia('(prefers-reduced-motion: reduce)').matches;
const flow = () => STILL ? 0 : 0.92 * (1 - Math.exp(-(performance.now() - dayAt) / 30000));
// 소문은 몇 초마다 하나씩 바뀐다 (같은 말이면 다시 그리지 않는다)
const RUMOR_MS = 9000;
function rumor() {
  const el = $('rumor'), t = ui.intro || over(W) ? '' : rumorAt(W, Math.floor(performance.now() / RUMOR_MS));
  if (el.dataset.t === t) return;
  el.dataset.t = t; el.innerHTML = t ? `<span>${t}</span>` : '';
}
setInterval(() => { if (desk && !document.hidden && !ui.intro && !over(W)) { desk.minis(minisOf(W, flow())); rumor(); } }, 250);

function nextDays(n: number) {
  dayAt = performance.now();
  const asks = W.asks.filter(a => a.got == null).length, news = W.reports.length;
  for (let k = 0; k < n && !over(W); k++) {
    step(W);
    if (W.asks.filter(a => a.got == null).length > asks || W.reports.length > news) break;
  }
  save(); draw();
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const draft = () => ui.draft ?? DRAFT0;
function act(a: string, d = 0) {
  const [k, arg] = a.split(':'), rest = a.slice(k.length + 1);
  if (k === 'next') return nextDays(1);
  if (k === 'ff') return nextDays(5);
  if (k === 'start') ui.intro = false;
  else if (k === 'new') fresh();
  // 새로 시작: 지금 판을 지우므로 한 번 묻는다
  else if (k === 'reset') { if (!confirm('지금 판을 지우고 새 임기를 시작할까요?')) return; fresh(); }
  // 단추 줄: 닫힌 시트를 열고, 열린 탭을 다시 누르면 닫는다
  else if (k === 'tab') { if (ui.open && ui.tab === arg) ui.open = false; else { ui.tab = arg as Tab; ui.open = true; } }
  else if (k === 'shut') ui.open = false;
  else if (k === 'sel') { ui.sel = rest; ui.tab = 'look'; ui.open = true; }
  else if (k === 'write') { ui.draft = { ...draft(), dg: +arg }; ui.tab = 'asks'; ui.open = true; ui.modal = 'write'; }
  else if (k === 'close') { ui.modal = undefined; ui.read = undefined; ui.ask = undefined; }
  else if (k === 'set') ui.modal = 'set';
  else if (k === 'ask') { ui.ask = +arg; ui.askSeen = Math.max(ui.askSeen ?? 0, +arg); }
  else if (k === 'shelf') ui.shelf = arg as Shelf;
  else if (k === 'ctag') ui.ctag = (arg || undefined) as Tag | undefined;
  else if (k === 'dkind') ui.dkind = (arg || undefined) as DocKind | undefined;
  // 테사의 첫 보고를 읽으면 안내가 다음(서류 쓰기)으로 넘어간다
  else if (k === 'read') { ui.read = +arg; if (+arg === -2) ui.tutPnl = true; }
  else if (k === 'unread') ui.read = undefined;
  else if (k === 'seen') ui.docSeen = +arg + 1;
  else if (k === 'later') ui.askSeen = Math.max(ui.askSeen ?? 0, +arg);
  else if (k === 'wdg') ui.draft = { ...draft(), dg: +arg };
  else if (k === 'wto') {
    // 양식이 바뀌면 새 양식에 넣을 수 없는 조항은 빠진다
    const f = draft(), to = arg as To, form = FORM_OF(to);
    let cl = f.cl;
    for (const id of Object.keys(cl) as ClauseId[]) if (!CLAUSE[id].forms.includes(form)) cl = dropClause(cl, id);
    ui.draft = { ...f, to, cl };
  }
  else if (k === 'wdays') { const f = draft(); ui.draft = { ...f, days: clamp(f.days + d * 5, 10, 60) }; }
  else if (k === 'wadd') { const f = draft(); if (canAdd(W, FORM_OF(f.to), f.cl, arg as ClauseId)) ui.draft = { ...f, cl: addClause(f.cl, arg as ClauseId) }; }
  else if (k === 'wdel') { const f = draft(); ui.draft = { ...f, cl: dropClause(f.cl, arg as ClauseId) }; }
  else if (k === 'wv') {
    const f = draft(), id = arg as ClauseId, fd = CLAUSE[id].field;
    if (fd && f.cl[id] != null) ui.draft = { ...f, cl: { ...f.cl, [id]: clamp(f.cl[id]! + d * fd.step, fd.min, fd.max) } };
  }
  else if (k === 'post') {
    const f = draft();
    const done = FORM_OF(f.to) === 'notice' ? post(W, f.dg, f.days, f.cl) : f.to !== 'all' && f.to !== 'trade' ? send(W, f.to, f.dg, f.days, f.cl) : null;
    if (done) ui.modal = undefined;
  }
  else if (k === 'recall') recall(W, +arg);
  else if (k === 'clerk') hireClerk(W);
  else if (k === 'withdraw') withdraw(W, +arg);
  else if (k === 'give') { const ask = W.asks.find(x => x.id === +arg); if (ask) ui.give[ask.id] = clamp((ui.give[ask.id] ?? ask.want) + d * 10, 0, ask.want); }
  else if (k === 'answer' || k === 'refuse') { const ask = W.asks.find(x => x.id === +arg); if (ask) { answer(W, ask.id, k === 'refuse' ? 0 : ui.give[ask.id] ?? ask.want); delete ui.give[ask.id]; ui.askSeen = Math.max(ui.askSeen ?? 0, ask.id); ui.ask = undefined; } }
  else if (k === 'inv') { const f = arg as FacId; ui.invite = ui.invite.includes(f) ? ui.invite.filter(x => x !== f) : [...ui.invite, f]; }
  else if (k === 'meet') { meet(W, ui.invite); ui.tab = 'office'; ui.open = true; }
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
// 드롭다운: 고른 값을 붙여 보낸다 ('wto' + 'big' → 'wto:big')
document.addEventListener('change', e => {
  const s = e.target as HTMLSelectElement;
  if (s.tagName === 'SELECT' && s.dataset.act && s.value) act(`${s.dataset.act}:${s.value}`);
});
document.addEventListener('click', e => {
  // 지도 확대 · 책상으로 단추: 판 상태와 상관없다
  const z = (e.target as Element).closest('[data-zoom]') as HTMLElement | null;
  if (z && desk) { +z.dataset.zoom! ? desk.zoom(+z.dataset.zoom!) : desk.set('desk'); return; }
  // 책상 보기에서 지도를 누르면 지도를 세운다
  if (desk && desk.mode === 'desk' && (e.target as Element).closest('#map')) desk.set('map');
  const b = (e.target as Element).closest('[data-act]') as HTMLElement | null;
  if (!b || b.tagName === 'SELECT' || b.dataset.d || (b as HTMLButtonElement).disabled) return;
  act(b.dataset.act!);
});
document.addEventListener('keydown', e => {
  const b = (e.target as Element).closest?.('[data-d]') as HTMLElement | null;
  if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); act(b.dataset.act!, +b.dataset.d!); return; }
  // 지도 표식(svg)은 단추가 아니라서 Enter를 직접 받는다
  const m = (e.target as Element).closest?.('svg [data-act]') as SVGElement | null;
  if (m && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); act(m.dataset.act!); return; }
  if (e.key === 'Escape' && (ui.modal || ui.read != null || ui.ask != null)) { act('close'); return; }
  if (e.key === 'Escape' && ui.open) { act('shut'); return; }
  if (e.key === 'Escape' && desk?.mode === 'map') { desk.set('desk'); return; }
  // 창이 떠 있는 동안은 날을 넘기지 않는다
  if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && $('over').hidden && !over(W)) nextDays(1);
});

const d = load();
if (d) { W = d.W; ui = d.ui; seed = d.seed; setSeed(d.rng); } else fresh();
draw();
