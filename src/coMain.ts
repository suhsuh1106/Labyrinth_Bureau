// 용병단 행정실 진입점: 날마다 길드 홀에서 조를 보내고 보급을 사고, 다음 날로 넘기면 돌아올 조가 돌아온다. 그믐이 지나면 가정산 · 정산. 판을 이 브라우저에 저장한다
import './ui/co/base.css';
import './ui/co/co.css';
import { setSeed } from './core/rng';
import { sellStock, setClerks, buyNow, fireNow, hireNow, promote, nextDay, sendQueued, teamReady, CO, FILE_KEYS, teamPots, teamTorch, teamMend, carryOf, foodDays, mendOf, FLOORS, type Plan, SRCS, type World, carryPlan, closeBooks, fileFix, fillTeams, formTeams, newWorld, probe, rankOf, roomOf, sanitize, awayIds, us, MISSIONS, type Mission } from './core/company';
import { DESC_FIRST, packBar } from './ui/co/roster';
import { CLASSES, GEARS } from './core/data';
import { plaqueHtml } from './ui/co/view';
import { type DeskUi, DOC_KEYS, PLACE_KEYS, infoWeekHtml, orderOf, resultWeekHtml, weeksHtml } from './ui/co/desk';
import { todayBack } from './ui/co/hall';
import { draftHtml } from './ui/co/draft';
import { closeScene, openScene } from './ui/co/scene';
import { advanceArrival, arrivalOpen, closeArrival, playArrival } from './ui/co/arrival';

const $ = (id: string): any => document.getElementById(id);
const KEY = 'lb-co', VERSION = 35, MONTHS = 36;   // 35: 등급과 이력서 (이전 판은 새 게임으로)
const GEAR_NAMES = GEARS.filter(g => g !== '일반');
let W: World, plan: Plan, ui: DeskUi;
// 도장을 막 찍은 결과 화면이면 귀환 장부를 한 줄씩 띄운다 (저장하지 않는 화면 상태)
let live = false, runTimer: any = null;

function save() { try { localStorage.setItem(KEY, JSON.stringify({ v: VERSION, W, plan, ui })); } catch { /* 저장이 막혀도 판은 계속된다 */ } }
function load() { try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); return d && d.v === VERSION ? d : null; } catch { return null; } }

// 다시 그려도 보던 자리를 지킨다: 창(장소 창 · 자료함 등) 안의 스크롤과 책상의 스크롤을 기억했다가 되돌린다 (페이지는 화면 크기에 고정이라 스크롤이 없다)
function pathOf(e: Element) { const out: string[] = []; for (let x: Element | null = e; x && x.id !== 'desk'; x = x.parentElement) out.unshift(`${x.tagName}.${x.className}:${x.parentElement ? [...x.parentElement.children].indexOf(x) : 0}`); return out.join('>'); }
function render() {
  const y = $('desk').scrollTop, keep = [...document.querySelectorAll('#desk *')].filter(e => e.scrollTop > 0).map(e => [pathOf(e), e.scrollTop] as const);
  draw();
  if (keep.length) { const m = new Map(keep); document.querySelectorAll('#desk *').forEach(e => { const t = m.get(pathOf(e)); if (t) e.scrollTop = t; }); }
  if ($('desk').scrollTop !== y) $('desk').scrollTop = y;
}
function draw() {
  $('stats').innerHTML = plaqueHtml(W);
  // 신고서를 아직 내지 않았으면 가정산에 머문다. 임기가 끝나면 정산만
  if (ui.phase === 1) { ui.phase = 0; ui.exp = true; }   // 출정은 길드 위의 창
  if (W.draft) ui.phase = 2;
  else if (ui.phase === 2) ui.phase = 3;
  if (ui.phase) ui.exp = false;
  const over = W.month > MONTHS && !W.draft;
  if (over) ui.phase = 3;
  $('weeks').innerHTML = weeksHtml(W, ui.phase);
  $('desk').className = `co-desk ph${ui.phase}`;
  $('desk').innerHTML = ui.phase === 0 ? infoWeekHtml(W, plan, ui) : ui.phase === 2 ? draftHtml(W, ui.file || {}, live) : resultWeekHtml(W, live, !!ui.mute);
  if (over) { const b = document.querySelector('#desk .resultwrap .btn-next') as HTMLButtonElement | null; if (b) { b.disabled = true; b.textContent = `임기가 끝났어요. 최종 ${rankOf(W)}위`; } }
}
function setPhase(p: number) { stopRun(); closeScene(); ui.phase = p; ui.open = false; ui.place = undefined; ui.store = false; render(); save(); toTop(); }
const toTop = () => { $('desk').scrollTop = 0; };

function start(fresh = false) {
  const d = fresh ? null : load();
  if (d) { W = d.W; plan = d.plan; ui = d.ui || { phase: 0, tab: 'report', pins: [] }; }
  // 첫 결정표: 포션 상한 0병(처음 받은 포션은 창고에), 신입 없음, 교관 없음. 돈 드는 것은 모두 고르는 것
  else { setSeed((Date.now() ^ 0x5bd1e995) >>> 0); W = newWorld(); plan = carryPlan(W, null); plan.pots = plan.pots.map(() => 0); plan.pick = []; plan.train = 0; plan.coach = 0; plan.autoSell = false; ui = { phase: 0, tab: 'report', pins: [] }; }
  plan.intelUp = plan.intelUp || {};   // 정보망은 유지비를 저절로 내고, 넓히는 돈만 따로 정한다
  tidyTeams();
  render(); save();
  if (!d) { toTop(); playArrival(toTop); }
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
  // n: 다음 날 (길드 · 출정에서, 입력 칸이 아닐 때)
  if ((e.key === 'n' || e.key === 'N') && ui && ui.phase <= 1 && !arrivalOpen() && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); advance(); return; }
  if (e.key !== 'Escape') return;
  if (arrivalOpen()) closeArrival();
  else if (ui && ui.open) { ui.open = false; render(); save(); }
  else if (ui && ui.place) { ui.place = undefined; render(); save(); }
  else if (ui && ui.store) { ui.store = false; render(); save(); }
  else if (ui && ui.exp) { ui.exp = false; ui.pick = null; render(); save(); }
});

// 우리 조 편성: 고칠 때마다 규칙 안으로 맞춰 둔다 (없는 사람·겹친 자리·빈 조를 지우고 조 수를 다시 센다)
function tidyTeams() {
  if (!us(W).crew) return;
  const Q = sanitize(W, us(W), plan);
  plan.teams = Q.teams; plan.tpl = Q.tpl; plan.parties = Q.parties;
}
function teamAct(a: string, b: HTMLElement) {
  const c = us(W), T = plan.teams || [], tpl = plan.tpl || CO.TPL0, pick = ui.pick, out = awayIds(W);
  // 미궁에 나가 있는 사람은 돌아올 때까지 다른 자리로 옮기지 않는다
  const outAt = (t: number, s: number) => T[t] && T[t].m[s] != null && out.has(T[t].m[s]!);
  if ((a === 'assign' || a === 'bench') && out.has(+(b.dataset.id || -1))) return;
  if (a === 'slot' && (outAt(+(b.dataset.t || 0), +(b.dataset.s || 0)) || (pick && pick.t != null && outAt(pick.t, pick.s!)))) return;
  if (a === 'refill') { plan.teams = formTeams(c, plan.parties, tpl, false).filter(x => x.m.some(y => y != null)); ui.pick = null; }
  else if (a === 'fill-rest') { fillTeams(c, T, tpl); ui.pick = null; }
  else if (a === 'bench') { const id = +(b.dataset.id || 0); ui.pick = pick && pick.id === id ? null : { id }; }
  else if (a === 'to-bench') { if (pick && pick.t != null && T[pick.t]) T[pick.t].m[pick.s!] = null; ui.pick = null; }
  else if (a === 'assign') assignTo(+(b.dataset.id || 0), b.dataset.t || '-1');
  else if (a === 'tfloor') { const x = T[+(b.dataset.t || 0)]; if (x) x.f = +(b.dataset.f || 0); }
  else if (a === 'tmission') { const x = T[+(b.dataset.t || 0)], m = b.dataset.m as Mission; if (x && MISSIONS.includes(m)) { if (m === 'gather') delete x.mission; else x.mission = m; } }
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
  if (a === 'exp') { ui.exp = true; ui.place = undefined; ui.open = false; render(); save(); (document.querySelector('.reader.exp .close') as HTMLElement | null)?.focus(); return; }
  if (a === 'close-exp') { ui.exp = false; ui.pick = null; render(); save(); return; }
  if (a === 'probe-mkt' || a === 'probe-riv') {
    const r = probe(W, a === 'probe-mkt' ? 'mkt' : 'riv', ui.rival || ($('probe-rival') && $('probe-rival').value) || '');
    if (r) { ui.tab = 'probe'; say(a === 'probe-mkt' ? '시장 조사 답이 왔어요' : '타 용병단 조사 답이 왔어요'); }
    render(); save(); return;
  }
  if (a === 'dex-tab') { ui.dexMon = b.dataset.mon; render(); save(); return; }
  if (a === 'seen') { ui.seen = W.month; render(); save(); return; }
  if (a === 'place') { ui.place = b.dataset.place; ui.open = false; render(); save(); (document.querySelector('.place .close') as HTMLElement | null)?.focus(); return; }
  if (a === 'close-place') { const k = ui.place; ui.place = undefined; render(); save(); (document.querySelector(`.spot[data-place="${k}"]`) as HTMLElement | null)?.focus(); return; }
  if (a === 'open-doc') { ui.tab = b.dataset.tab || 'report'; ui.open = true; ui.place = undefined; render(); save(); (document.querySelector('.reader .close') as HTMLElement | null)?.focus(); return; }
  if (a === 'close-doc') { ui.open = false; render(); save(); return; }
  if (a === 'intel-cut') { const k = b.dataset.src as any, cut = new Set(plan.intelCut || []); cut.has(k) ? cut.delete(k) : cut.add(k); plan.intelCut = [...cut] as any; render(); save(); return; }
  if (a === 'dorm') { plan.dorm = !plan.dorm; render(); save(); return; }
  if (a === 'auto-recruit') { delete plan.recruit; delete plan.recruitC; delete plan.pick; render(); save(); return; }
  if (a === 'sellmap') { const f = +(b.dataset.f || 0); if (plan.sellMap === f) delete plan.sellMap; else plan.sellMap = f; render(); save(); return; }
  if (a === 'coach') { plan.coach = +(b.dataset.i || 0); render(); save(); return; }
  if (a === 'build') { const k = b.dataset.k || ''; if (plan.build === k) delete plan.build; else plan.build = k; render(); save(); return; }
  if (a === 'fire') {
    const id = +(b.dataset.id || 0), F = plan.fire ? [...plan.fire] : [], k = F.indexOf(id);
    if (k >= 0) F.splice(k, 1); else F.push(id);
    plan.fire = F;
    if (plan.teams) plan.teams.forEach(T => { T.m = T.m.map(x => (x === id && k < 0 ? null : x)); });
    render(); save(); return;
  }
  if (a === 'hire') { hireNow(W, +(b.dataset.id || 0), b.dataset.low === '1'); render(); save(); return; }
  if (a === 'promote') { promote(W, +(b.dataset.id || 0)); render(); save(); return; }
  if (a === 'who') { const id = +(b.dataset.id || 0); ui.who = ui.who === id ? undefined : id; render(); save(); return; }
  if (a === 'sort') {
    const sc = b.dataset.scope || 'rs', k = b.dataset.k || 'name', cur = (ui.sort || {})[sc], [ck, cd] = (cur || '').split(':');
    const d = ck === k ? -(+cd || 1) : DESC_FIRST.includes(k) ? -1 : 1;
    ui.sort = { ...(ui.sort || {}), [sc]: `${k}:${d}` }; render(); save(); return;
  }
  if (a === 'refill' || a === 'fill-rest' || a === 'bench' || a === 'to-bench' || a === 'slot' || a === 'assign' || a === 'tfloor' || a === 'tmission') return teamAct(a, b);
  if (a === 'auto-pot') { plan.buy = { ...(plan.buy || {}) }; delete plan.buy.pot; render(); save(); return; }
  if (a === 'auto-torch') { plan.buy = { ...(plan.buy || {}) }; delete plan.buy.torch; render(); save(); return; }
  if (a === 'auto-food') { plan.buy = { ...(plan.buy || {}) }; delete plan.buy.food; render(); save(); return; }
  if (a === 'auto-mend') { plan.buy = { ...(plan.buy || {}) }; delete plan.buy.mend; render(); save(); return; }
  if (a === 'kit-add') { const f = +(b.dataset.f || 0); plan.kits = plan.kits || []; plan.kits[f] = [...(plan.kits[f] || []), { n: 0, g: '' }]; render(); save(); return; }
  if (a === 'kit-del') { const f = +(b.dataset.f || 0), k = +(b.dataset.j || 0); if (plan.kits && plan.kits[f]) plan.kits[f].splice(k, 1); render(); save(); return; }
  // 보내기는 예정만 잡는다 (다시 누르면 취소). 다음 날 단추를 누르면 그날 떠난다
  if (a === 'go' || a === 'send-all') {
    tidyTeams(); const T = plan.teams || [], ready = T.map((x, t) => t).filter(t => teamReady(W, T[t])), all = ready.length > 0 && ready.every(t => T[t].go);
    ready.forEach(t => { if (all) delete T[t].go; else T[t].go = true; }); render(); save();
    say(!ready.length ? '지금 나갈 수 있는 조가 없어요' : all ? '보낼 예정을 모두 거뒀어요' : `${ready.map(t => `${t + 1}조`).join(' · ')} 보낼 예정 · 다음 날을 누르면 떠나요`); return;
  }
  if (a === 'send') {
    tidyTeams(); const t = +(b.dataset.t || 0), T = (plan.teams || [])[t];
    if (!T || !teamReady(W, T)) { render(); say('그 조는 지금 나갈 수 없어요'); return; }
    if (T.go) delete T.go; else T.go = true;
    render(); save();
    say(T.go ? `${t + 1}조 보낼 예정 · ${FLOORS[T.f].name} ${CO.TRIP_DAYS[T.f]}일 길 · 다음 날을 누르면 떠나요` : `${t + 1}조 보낼 예정을 거뒀어요`); return;
  }
  if (a === 'next-day') return advance();
  if (a === 'buy-now') {
    const o = orderOf(W, plan); let v = 0;
    (['pot', 'holy', 'torch', 'food', 'mend'] as const).forEach(k => { v += buyNow(W, k, o[k]); });
    Object.entries(o.gear).forEach(([g, n]) => { v += buyNow(W, 'gear', n, g); });
    plan.buy = {}; render(); save(); say(v ? `보급 ${Math.round(v).toLocaleString('ko-KR')}G어치가 창고에 들어왔어요` : '살 것이 없어요'); return;
  }
  if (a === 'sell' || a === 'sell-all') {
    const js = a === 'sell-all' ? FLOORS.map((_, j) => j) : [+(b.dataset.j || 0)];
    let v = 0; js.forEach(j => { const n = Math.floor(((W.stock || [])[j] || 0) + 1e-9); v += sellStock(W, j, b.dataset.n === 'half' ? Math.ceil(n / 2) : n); });
    render(); save(); say(v ? `채집품 ${Math.round(v).toLocaleString('ko-KR')}G어치를 팔았어요` : '팔 것이 없어요'); return;
  }
  if (a === 'auto-sell') { if (plan.autoSell === false) delete plan.autoSell; else plan.autoSell = false; render(); save(); return; }
  if (a === 'auto-buy') { if (plan.autoBuy === false) delete plan.autoBuy; else plan.autoBuy = false; render(); save(); return; }
  if (a === 'town') { ui.town = !ui.town; ui.place = undefined; ui.open = false; render(); save(); return; }
  if (a === 'store') { ui.store = true; ui.place = undefined; ui.open = false; render(); save(); (document.querySelector('.reader.store-w .close') as HTMLElement | null)?.focus(); return; }
  if (a === 'close-store') { ui.store = false; render(); save(); return; }
  if (a === 'file') return file();
  if (a === 'file-reset') { ui.file = W.draft ? { ...W.draft.truth } : {}; render(); save(); return; }
  if (a === 'skip-run') return finishRun();
  if (a === 'scene') return openScene(W, +(b.dataset.i || 0), k => SOUND[k]?.(0), b.dataset.src || 'last');
  if (a === 'mute') { ui.mute = !ui.mute; save(); b.textContent = ui.mute ? '소리 켜기' : '소리 끄기'; return; }
}

// 다음 날: 내보낼 사람이 떠나고, 날이 넘어가고, 돌아올 조가 돌아온다. 그믐이 지나면 그달을 정산하고 가정산(신고서)으로 간다. 신고서를 내야 정산이 끝난다
function advance() {
  if (W.month > MONTHS || W.draft) return;
  stopRun(); closeScene();
  if (plan.fire && plan.fire.length) { fireNow(W, plan.fire); delete plan.fire; }
  // 보낼 예정인 조가 오늘 떠난다 (모자란 채비는 지금 산다)
  tidyTeams();
  const Q = sendQueued(W, plan), gone = Q.sent.length ? `${Q.sent.map(x => `${x.t + 1}조`).join(' · ')} 출발${Q.stuck.length ? ` · ${Q.stuck.map(t => `${t + 1}조`).join(' · ')}는 못 떠남` : ''} · ` : Q.stuck.length ? `${Q.stuck.map(t => `${t + 1}조`).join(' · ')}는 못 떠남 · ` : '';
  const M = nextDay(W, plan);
  tidyTeams();
  if (M) {
    plan = carryPlan(W, plan); ui.pick = null; tidyTeams();
    ui.file = W.draft ? { ...W.draft.truth } : {};
    ui.phase = 2; live = true; render(); save(); toTop();
    playRun();
    say(`제${M.month}월 그믐 정산${M.opened != null ? ` · ${M.opened + 1}층이 열렸어요` : ''}${M.overflow ? ' · 미궁이 넘쳤어요' : ''} · 영주청에 낼 신고서를 꾸며요`);
    return;
  }
  render(); save();
  // 오늘 아침 돌아온 조: 몇 조가 해냈고, 누가 다치고 누구를 잃었나
  const back = todayBack(W).map(x => x.rep!).filter(Boolean), dead = back.reduce((a, r) => a + (r.dead || []).length, 0);
  if (back.length) { SOUND[dead ? 'die' : back.some(r => r.ok) ? 'win' : 'lose']?.(0); say(`${gone}${W.day}일 아침 · ${back.map(r => `${(r.t ?? 0) + 1}조`).join(' · ')} 귀환 · ${back.filter(r => r.ok).length}조 해냄${dead ? ` · ${dead}명을 잃었어요` : ''}`); }
  else say(`${gone}제${W.month}월 ${W.day}일${(W.away || []).length ? ` · ${(W.away || []).length}조가 미궁에 있어요` : ''}`);
}
// 신고서를 내면 정산이 끝나고 귀환 장부가 한 줄씩 뜬다
function file() {
  if (!W.draft) return;
  clearTimeout(runTimer); runTimer = null;   // 가정산의 귀환 연출이 아직 돌고 있으면 멈춘다
  const m = W.draft.m, F = closeBooks(W, ui.file || {});
  ui.file = undefined; ui.phase = 3; live = true; render(); save(); toTop();
  playRun();
  const M = W.history.find(x => x.month === m)!, r = M.res[0];
  say(`제${m}월 결재 · 순이익 ${r.net >= 0 ? '+' : '−'}${Math.abs(Math.round(r.net)).toLocaleString('ko-KR')}G · ${rankOf(W)}위${F && F.audit ? (F.audit.fine ? ` · 감사로 추징금 ${F.audit.fine.toLocaleString('ko-KR')}G` : ' · 감사가 다녀갔어요') : ''}${W.log.some(l => l.m === m && /근원 발견/.test(l.t)) ? ' · 근원을 찾았어요' : ''}`);
}

// − + 단추를 길게 누르면 되풀이한다 (처음엔 한 칸씩, 오래 누를수록 다섯 칸씩). 손을 떼면 멈추고, 그때의 click은 넘긴다
let hold: { tm: number; n: number } | null = null, held = false;
const stopHold = () => { if (hold) { clearTimeout(hold.tm); hold = null; } };
$('desk').addEventListener('pointerdown', (e: any) => {
  const b = e.target.closest('.step button[data-k]'); if (!b || b.disabled) return;
  const k = b.dataset.k, i = +b.dataset.i, d = +b.dataset.d, j = +(b.dataset.j || 0);
  held = false; stopHold();
  const tick = () => { held = true; hold!.n++; edit(k, i, (v: number) => v + d * (hold!.n > 10 ? 5 : 1), j); hold!.tm = window.setTimeout(tick, hold!.n > 4 ? 70 : 140); };
  hold = { tm: window.setTimeout(tick, 420), n: 0 };
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => $('desk').addEventListener(ev, stopHold));
$('desk').addEventListener('click', (e: any) => {
  // 버튼과, 지도 · 책상 위 물건(SVG의 data-act)을 누른다
  const t = e.target.closest('button, .spot[data-act], th[data-act]'); if (!t || t.disabled) return;
  if (held && t.dataset.d) { held = false; return; }   // 길게 눌러 되풀이한 뒤의 click은 넘긴다
  if (t.dataset.act) return act(t);
  if (t.dataset.tab) { ui.tab = t.dataset.tab; render(); save(); return; }
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
  if (k === 'ask') { if (t.value) plan.ask = JSON.parse(t.value); else delete plan.ask; render(); save(); return; }
  if (k === 'target') { const T = plan.teams && plan.teams[+t.dataset.i]; if (T) { if (t.value) T.target = t.value; else delete T.target; } render(); save(); return; }
  if (k === 'teamG') { const T = plan.teams && plan.teams[+t.dataset.i]; if (T) T.g = t.value; render(); save(); return; }
  if (k === 'assign') { assignTo(+t.dataset.id, t.value); tidyTeams(); render(); save(); return; }
  if (k === 'spyOn') { const on = [...(plan.spyOn || [])]; on[+t.dataset.i] = t.value; plan.spyOn = on.filter(Boolean); render(); save(); return; }
  if (k === 'rootf') { plan.root = { f: +t.value, seal: plan.root ? plan.root.seal : 0, mine: plan.root ? plan.root.mine : 0 }; render(); save(); return; }
  if (k === 'basef') { plan.base = { f: +t.value, amt: plan.base ? plan.base.amt : 0 }; render(); save(); return; }
  edit(k, +t.dataset.i, () => Math.round(+t.value || 0), +(t.dataset.j || 0));
});

function edit(k: string, i: number, fn: (v: number) => number, j = 0) {
  const buy = () => (plan.buy = { ...(plan.buy || {}) });
  // 가정산 신고서 칸 (규칙 안으로 맞춰 둔다)
  if (k === 'file') {
    if (!W.draft) return;
    const key = FILE_KEYS[i], cur = fileFix(W, W.draft, ui.file || {});
    ui.file = fileFix(W, W.draft, { ...cur, [key]: Math.max(0, fn(cur[key])) });
    render(); save();
    const el = document.querySelector(`input[data-k="file"][data-i="${i}"]`) as HTMLElement | null; if (el && document.activeElement === document.body) el.focus({ preventScroll: true });
    return;
  }
  if (k === 'clerks') { setClerks(W, fn(us(W).clerks || 0)); render(); save(); return; }
  if (k === 'train') plan.train = Math.max(0, fn(plan.train));
  else if (k === 'donate') plan.donate = Math.max(0, fn(plan.donate || 0));
  else if (k === 'tool') plan.tool = Math.max(0, Math.min(2, fn(plan.tool || 0)));
  else if (k === 'proc') plan.proc = Math.max(0, fn(plan.proc || 0));
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
  else if (k === 'buyTorch') { const cur = +(document.querySelector('input[data-k="buyTorch"]') as HTMLInputElement)?.value || 0; buy().torch = Math.max(0, fn(plan.buy && plan.buy.torch != null ? plan.buy.torch : cur)); }
  else if (k === 'buyFood') { const cur = +(document.querySelector('input[data-k="buyFood"]') as HTMLInputElement)?.value || 0; buy().food = Math.max(0, fn(plan.buy && plan.buy.food != null ? plan.buy.food : cur)); }
  else if (k === 'buyMend') { const cur = +(document.querySelector('input[data-k="buyMend"]') as HTMLInputElement)?.value || 0; buy().mend = Math.max(0, fn(plan.buy && plan.buy.mend != null ? plan.buy.mend : cur)); }
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
  else if (k === 'dtorch') { plan.torch = FLOORS.map((_, f) => carryOf(plan, f)); plan.torch[i] = Math.max(0, Math.min(CO.DAYS, fn(plan.torch[i]))); }
  else if (k === 'dfood') { plan.food = FLOORS.map((_, f) => foodDays(plan, f)); plan.food[i] = Math.max(0, Math.min(CO.DAYS, fn(plan.food[i]))); }
  else if (k === 'dmend') { plan.mend = FLOORS.map((_, f) => mendOf(plan, f)); plan.mend[i] = Math.max(0, Math.min(6, fn(plan.mend[i]))); }
  else if (k === 'tpots' || k === 'ttorch' || k === 'tfood' || k === 'tmend') {
    const T = plan.teams && plan.teams[i];
    if (T) {
      if (k === 'tpots') T.pots = Math.max(0, Math.min(8, fn(teamPots(plan, T))));
      else if (k === 'ttorch') T.torch = Math.max(0, Math.min(CO.DAYS, fn(teamTorch(plan, T))));
      else if (k === 'tfood') T.food = Math.max(0, Math.min(CO.DAYS, fn(T.food != null ? T.food : foodDays(plan, T.f))));
      else T.mend = Math.max(0, Math.min(6, fn(teamMend(plan, T))));
    }
  }
  else if ((plan as any)[k]) (plan as any)[k][i] = Math.max(0, fn((plan as any)[k][i]));
  render(); save();
  const el = document.querySelector(`input[data-k="${k}"][data-i="${i}"]`) as HTMLElement | null; if (el && document.activeElement === document.body) el.focus({ preventScroll: true });
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
// 귀환(가정산): 마주침마다 1조부터 차례로 그 칸을 켜고 짐 막대를 그날 모습으로 바꾼다. 다 돌면 결과 · 단장 보고 · 잃은 사람을 띄운다
function playTrips(box: HTMLElement) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return finishRun();
  const teams = [...box.querySelectorAll('li.rv')] as HTMLElement[];
  const steps: (() => number)[] = [];
  for (let j = 0; j <= CO.DAYS * CO.ENC_DAY; j++) teams.forEach(li => {
    const cell = li.querySelectorAll('.days i')[j] as HTMLElement | undefined;
    if (!cell || !cell.classList.contains('hid')) return;
    steps.push(() => {
      cell.classList.remove('hid'); cell.classList.add('pop');
      const pw = li.querySelector('.packw') as HTMLElement | null;
      if (pw) { const st = JSON.parse(pw.dataset.steps || '[]') as number[][], x = st[Math.min(j + 1, st.length - 1)]; pw.innerHTML = packBar(+(pw.dataset.slots || 0), x[1], x[2], x[0], x[3], x[4], x[5], x[6]); }
      const s = cell.dataset.s || ''; SOUND[s.includes('die') ? 'die' : s.startsWith('ok') ? 'ok' : 'no']?.(j);
      // 그 조의 마지막 칸이면 결과를 띄운다
      const left = [...li.querySelectorAll('.days i.hid')].length;
      if (!left) { li.querySelectorAll('.hid').forEach(e => e.classList.remove('hid')); const pw2 = li.querySelector('.packw') as HTMLElement | null; if (pw2) { const st = JSON.parse(pw2.dataset.steps || '[]') as number[][], x = st[st.length - 1]; pw2.innerHTML = packBar(+(pw2.dataset.slots || 0), x[1], x[2], x[0], x[3], x[4], x[5], x[6]); } }
      return s.includes('die') ? 700 : 80;
    });
  });
  let i = 0;
  const step = () => { if (i >= steps.length) return finishRun(); runTimer = setTimeout(step, steps[i++]()); };
  runTimer = setTimeout(step, 300);
}
function playRun() {
  const box = document.querySelector('.run.live') as HTMLElement | null; if (!box) return;
  if (box.classList.contains('trips')) return playTrips(box);
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
    if (v && tv) { countTo(tv, acc, acc + v); acc += v; }
    SOUND[k] && SOUND[k](k === 'ok' ? nOk++ : i);
    const next = items[i] ? items[i].dataset.k : '';
    runTimer = setTimeout(step, k === 'ok' || k === 'no' ? 520 : k === 'die' ? 1100 : next === 'net' ? 900 : k === 'gain' ? 480 : 340);
  };
  runTimer = setTimeout(step, 350);
}
function finishRun() {
  clearTimeout(runTimer); runTimer = null;
  const box = document.querySelector('.run.live') as HTMLElement | null;
  if (box) {
    box.querySelectorAll('li.rv').forEach(li => li.classList.add('on'));
    box.querySelectorAll('.hid').forEach(e => e.classList.remove('hid'));
    box.querySelectorAll('.packw').forEach(pw => { const p = pw as HTMLElement, st = JSON.parse(p.dataset.steps || '[]') as number[][], x = st[st.length - 1]; if (x) p.innerHTML = packBar(+(p.dataset.slots || 0), x[1], x[2], x[0], x[3], x[4], x[5], x[6]); });
    const fin = +(box.dataset.net || 0), tv = box.querySelector('.tv') as HTMLElement | null;
    if (tv) { tv.textContent = sgnG(fin); tv.classList.toggle('neg', fin < 0); box.classList.add(fin >= 0 ? 'win' : 'lose'); }
    box.classList.remove('live');
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
