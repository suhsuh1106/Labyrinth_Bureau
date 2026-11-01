// 미궁관리국 진입점(index.html): 날마다 보고를 읽고 서류(조항을 조합한 공고문 · 받은 청) · 규정 · 회의로 손을 쓰고, 다음 날로 넘긴다.
// 판을 이 브라우저에 저장한다(`lb-bureau`). 엔진은 src/bureau/engine.ts
import './ui/bureau/bureau.css';
import { getSeed, setSeed } from './core/rng';
import { B, type FacId, type World, answer, crewFree, dispatch, upgrade, type DeptId, meet, newWorld, over, post, recall, run, send, step, withdraw } from './bureau/engine';
import { BOT } from './bureau/bots';
import { CLAUSE, type ClauseId, type Tag, FORM_OF, type To, addClause, canAdd, dropClause } from './bureau/clauses';
import { type BuUi, type DocKind, DISP0, DRAFT0, dispHtml, svOf, type Shelf, type Tab, SPEED, asksFloatHtml, deskHtml, docModalHtml, setHtml, fsOn, reportDocHtml, endHtml, introHtml, paneHtml, topHtml, tutHtml, writeHtml } from './ui/bureau/board';
import { mapHtml, minisOf, paintWash, terrainSvg } from './ui/bureau/map';
import { type Desk, makeDesk } from './ui/bureau/desk';
import { playOpening } from './ui/bureau/opening';

const $ = (id: string) => document.getElementById(id)!;
const KEY = 'lb-bureau', VERSION = 18;
let W: World, ui: BuUi, seed = 0, desk: Desk | null = null, cutOn = false;
// 설정 창의 새 임기 확인 단계(저장하지 않는다)
let resetAsk = false;

function save() { try { localStorage.setItem(KEY, JSON.stringify({ v: VERSION, seed, rng: getSeed(), W, ui })); } catch { /* 저장이 막혀도 판은 계속된다 */ } }
function load() { try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); return d && d.v === VERSION ? d : null; } catch { return null; } }

type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void };
type FsD = Document & { webkitExitFullscreen?: () => void };
function toggleFs() {
  const el = document.documentElement as FsEl, d = document as FsD;
  try {
    if (fsOn()) { if (d.exitFullscreen) void d.exitFullscreen().catch(() => {}); else d.webkitExitFullscreen?.(); }
    else if (el.requestFullscreen) void el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    else el.webkitRequestFullscreen?.();
  } catch { /* 막히면 그대로 둔다 */ }
}
// 전체 화면이 켜지거나 꺼지면(Esc 포함) 단추 모양을 바꾼다
for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, () => { if (W) draw(); });

function fresh() {
  seed = (Date.now() ^ 0x5bd1e995) >>> 0;
  W = newWorld(seed);
  ui = { tab: 'look', open: false, sel: 'dg:0', invite: [], give: {}, cut: true, intro: true, seenNews: W.reports.length, docSeen: 0, askSeen: 0 };
}

// 글이 바뀐 칸만 다시 넣는다: 같은 것을 다시 넣어도 그 칸(특히 지도 · 책상 장면)을 통째로 다시 칠해 휴대폰에서 창을 열 때마다 버벅인다
const shown = new Map<string, string>();
function put(id: string, html: string) {
  if (shown.get(id) === html) return;
  shown.set(id, html); $(id).innerHTML = html;
}

function draw() {
  put('top', topHtml(W, ui, play));
  // 땅은 한 번만 깔고(제 층), 날마다 바뀌는 표식 · 미니어처 · 책상 위 물건만 다시 그린다
  if (!desk) {
    desk = makeDesk($('desk'));
    document.querySelector('.map-ground .terrain')!.innerHTML = terrainSvg(W);
    // 번짐 굽기가 막혀도(오래된 브라우저 등) 종이 빛 바탕으로 판은 그린다
    try { paintWash(document.querySelector('.map-wash')!); } catch { /* 그대로 둔다 */ }
  }
  put('marks', mapHtml(W, ui));
  put('props', deskHtml(W, ui));
  desk.minis(minisOf(W, flow()));
  desk.stand();
  if (ui.open && ui.tab === 'office') ui.seenNews = W.reports.length;
  const sheet = $('sheet');
  sheet.hidden = !ui.open; sheet.dataset.tab = ui.tab;
  put('pane', ui.open ? paneHtml(W, ui) : '');
  put('tut', tutHtml(W, ui));
  put('asks', asksFloatHtml(W, ui));
  // 첫 장면: 부임 첫날 신문 앞에 한 번(설정에서 다시 볼 수 있다). 끝나면 신문이 책상에 떨어진다
  if (ui.cut && !cutOn) { cutOn = true; playOpening($('cut'), () => { cutOn = false; ui.cut = false; save(); draw(); }); }
  const ov = $('over');
  if (ui.intro) { ov.innerHTML = introHtml(); ov.hidden = false; }
  else if (over(W)) {
    // 같은 판을 봇이 처음부터 했다면: 난수 자리를 잠깐 빌려 쓰고 되돌린다
    const keep = getSeed(), idle = run(newWorld(seed), BOT.idle), smart = run(newWorld(seed), BOT.smart);
    setSeed(keep);
    ov.innerHTML = endHtml(W, idle, smart); ov.hidden = false;
  } else if (ui.read != null) { ov.innerHTML = reportDocHtml(W, ui.read, true); ov.hidden = false; }
  else if (ui.modal === 'set') { ov.innerHTML = setHtml(W, resetAsk); ov.hidden = false; }
  else if (ui.modal === 'disp') { ov.innerHTML = `<div class="card modal write-modal">${dispHtml(W, ui)}</div>`; ov.hidden = false; }
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
// 자동 진행 중에는 하루의 시간이 정해져 있으니 그만큼 고르게 다가간다
const flow = () => STILL ? 0 : play ? Math.min(1, held / dayMs()) : 0.92 * (1 - Math.exp(-(performance.now() - dayAt) / 30000));
// 자동 진행(세미 실시간): 재생하면 하루가 SPEED만큼 흐르고 저절로 넘어간다. 창(서류 · 청 · 설정 · 서류 쓰기)이 떠 있거나 탭이 숨으면 시계가 선다.
// 새 청 · 새 보고가 오면 멈춘다(읽고 정한 뒤 다시 재생). 다음 날 · 닷새 단추는 그대로 쓸 수 있다
let play = false, held = 0, last = performance.now();
const dayMs = () => (SPEED[ui.spd ?? 0] ?? SPEED[0]).ms;
const stalled = () => document.hidden || ui.intro || cutOn || over(W) || !$('over').hidden;
function setPlay(on: boolean) { play = on && !over(W); held = 0; last = performance.now(); }
function tick() {
  const now = performance.now(), dt = now - last;
  last = now;
  if (!desk || document.hidden || ui.intro || over(W)) return;
  if (play && !stalled()) {
    held += dt;
    if (held >= dayMs()) { nextDays(1, true); return; }
  }
  const bar = document.getElementById('dayBar');
  if (bar) bar.style.width = `${Math.min(100, held / dayMs() * 100)}%`;
  desk.minis(minisOf(W, flow()));
}
setInterval(tick, 250);

function nextDays(n: number, auto = false) {
  dayAt = performance.now(); held = 0;
  const asks = W.asks.filter(a => a.got == null).length, news = W.reports.length;
  for (let k = 0; k < n && !over(W); k++) {
    step(W);
    if (W.asks.filter(a => a.got == null).length > asks || W.reports.length > news) { if (auto || play) play = false; break; }
  }
  if (over(W)) play = false;
  save(); draw();
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const draft = () => ui.draft ?? DRAFT0;
function act(a: string, d = 0) {
  const [k, arg] = a.split(':'), rest = a.slice(k.length + 1);
  if (k === 'next') return nextDays(1);
  if (k === 'ff') return nextDays(5);
  if (k === 'play') { setPlay(!play); draw(); return; }
  if (k === 'spd') { const keep = held / dayMs(); ui.spd = ((ui.spd ?? 0) + 1) % SPEED.length; held = keep * dayMs(); save(); draw(); return; }
  if (k === 'start') ui.intro = false;
  else if (k === 'new') fresh();
  // 새로 시작: 지금 판을 지우므로 한 번 묻는다
  // confirm()은 아티팩트처럼 막힌 iframe에서 말없이 false를 돌려주므로 설정 창 안에서 한 번 더 묻는다
  else if (k === 'reset') resetAsk = true;
  else if (k === 'resetno') resetAsk = false;
  else if (k === 'resetyes') { resetAsk = false; fresh(); }
  // 단추 줄: 닫힌 시트를 열고, 열린 탭을 다시 누르면 닫는다
  else if (k === 'tab') { if (ui.open && ui.tab === arg) ui.open = false; else { ui.tab = arg as Tab; ui.open = true; } }
  else if (k === 'shut') ui.open = false;
  else if (k === 'sel') { ui.sel = rest; ui.tab = 'look'; ui.open = true; }
  else if (k === 'write') { ui.draft = { ...draft(), dg: +arg }; ui.tab = 'asks'; ui.open = true; ui.modal = 'write'; }
  else if (k === 'close') { resetAsk = false; ui.modal = undefined; ui.read = undefined; ui.ask = undefined; }
  else if (k === 'set') ui.modal = 'set';
  // 전체 화면: 주소창 · 탭 줄을 숨긴다. 막힌 곳(일부 iframe · 아이폰)에선 단추가 뜨지 않는다
  else if (k === 'fs') { toggleFs(); return; }
  else if (k === 'replay') { ui.modal = undefined; ui.cut = true; }
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
  // 파견서: 보낼 곳 · 인원 · 머물 날을 고르고 보낸다
  else if (k === 'disp') { ui.disp = { ...(ui.disp ?? DISP0), to: arg }; ui.tab = 'asks'; ui.open = true; ui.modal = 'disp'; }
  else if (k === 'dto') ui.disp = { ...(ui.disp ?? DISP0), to: arg };
  else if (k === 'dn') { const f = ui.disp ?? DISP0; ui.disp = { ...f, n: clamp(f.n + d, 1, B.SVY.max) }; }
  else if (k === 'ddays') { const f = ui.disp ?? DISP0; ui.disp = { ...f, days: clamp(f.days + d, B.SVY.days[0], B.SVY.days[1]) }; }
  else if (k === 'dsend') { const f = ui.disp ?? DISP0; if (dispatch(W, svOf(f.to), Math.min(f.n, crewFree(W)), f.days)) ui.modal = undefined; }
  else if (k === 'recall') recall(W, +arg);
  else if (k === 'dept') upgrade(W, arg as DeptId);
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
  // Space: 자동 진행 켜고 끄기 (단추 · 입력칸에 있을 때는 그쪽 몫)
  if (e.key === ' ' && !(e.target as Element).closest?.('button, input, select, textarea, [data-act]') && $('over').hidden && !cutOn && !over(W)) { e.preventDefault(); act('play'); return; }
  if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && $('over').hidden && !cutOn && !over(W)) nextDays(1);
});

const d = load();
if (d) { W = d.W; ui = d.ui; seed = d.seed; setSeed(d.rng); } else fresh();
// 같은 버전 번호로 모양이 다른 판(다른 빌드에서 저장한 판)이 남아 있으면 첫 그리기에서 터진다: 그때는 새 임기로 연다
try { draw(); } catch (e) { if (!d) throw e; console.error(e); fresh(); save(); draw(); }
