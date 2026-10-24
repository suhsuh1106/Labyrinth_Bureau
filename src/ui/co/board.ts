// 판 (docs/board.md 1단계): 휴대폰을 세로로 든 한 화면. 위 요약 띠 · 가운데 작전 지도(구역에 깃발 말을 끌어다 놓는다) · 아래 단추 줄(인원 · 물자 · 기록 · 본부 · 다음 날).
// 단추를 누르면 판 위로 시트가 올라온다 (1단계는 지금 있는 창의 내용을 시트 안에 그대로 띄운다).
// 읽기만 한다 (상태를 쓰지 않고 난수를 쓰지 않는다). 지도 바탕은 구역 자리로만 그려 같은 판이면 같은 그림이다
import { CO, FLOORS, type Plan, type Team, type World, awayIds, bagDays, dayAbs, rankOf, richEst, riskEst, sanitize, stateOf, teamPots, teamMend, teamReady, supOf, potsOf, us, zoneAt, zoneKnown, zoneRate, zoneWay } from '../../core/company';
import { type Zone, lvOf, lvProg, nextXp, viaOf, zonesOn } from '../../core/zones';
import { KIND_NAME, nameOf } from './roster';
import { GEARS, PAIR_CLASS } from '../../core/data';
import { agendaOf, backBodyHtml, nextDayBtn, todayBack } from './hall';
import { type DeskUi, docBody, kitWarn, placeBody, staffBlds } from './desk';
import { candsHtml, listHtml, teamsHtml } from './crew';
import { buyHtml, kitHtml, sellHtml } from './goods';
import { monthHtml, zoneCards } from './records';
import { askPanel } from './book';
import { LV_SAYS, SECRET_NAME } from './zones';
import { stepper } from './view';
import { DUTIES, hasDuty, tabOpen } from './duty';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
const f1 = (v: number) => (Math.round(v * 10) / 10).toString();
const SYM: Record<string, string> = { ore: '⛏', den: '⚔', mix: '◐', stair: '⇣' };
// 구역 자리 (zones.ts의 x 10~90 · y 8~60, 입구는 y 66) → 판 위 % (입구가 아래 끝 가까이)
export const zx = (z: { x: number }) => 14 + (z.x - 10) * 0.9;   // (가장자리 구역의 이름 · 깃발이 판 밖으로 나가지 않게)
export const zy = (z: { y: number }) => z.y * 1.33;
const GATE = { x: 50, y: 92 };
const riskWord = (v: number) => (v < 0.9 ? '낮음' : v < 1.15 ? '보통' : '높음');

// 단추 시트: 단추마다 탭 (1단계는 지금 있는 창의 내용)
export const MENUS: Record<string, { n: string; sub: string; tabs: [string, string][] }> = {
  crew: { n: '인원', sub: '보유 인원과 조 편성', tabs: [['team', '조 편성'], ['list', '명단'], ['cand', '지원자']] },
  goods: { n: '물자', sub: '구매 · 조마다 배분 · 창고와 팔기', tabs: [['buy', '구매'], ['kit', '배분'], ['sell', '팔기']] },
  rec: { n: '기록', sub: '수입 · 지출과 모은 정보', tabs: [['month', '이달'], ['back', '귀환'], ['zone', '구역'], ['report', '지난달'], ['paper', '신문'], ['book', '도감'], ['probe', '정보']] },
  hq: { n: '본부', sub: '업그레이드와 바깥 상대', tabs: [['train', '본부'], ['board', '게시판 · 영주청'], ['church', '교회'], ['alley', '정보망']] },
};
// 옛 창을 여는 단추(장소 · 자료 · 창고 · 출정 · 귀환)가 가리키는 시트와 탭
export const PLACE_MENU: Record<string, [string, string]> = { board: ['hq', 'board'], staff: ['crew', 'list'], train: ['hq', 'train'], market: ['goods', 'buy'], church: ['hq', 'church'], alley: ['hq', 'alley'] };
// 안건이 가리키는 단추 (배지)
const AGENDA_MENU: Record<string, string> = { buy: 'goods', kit: 'goods', pot: 'goods', sell: 'goods', mats: 'goods', coming: 'goods', hire: 'crew', grade: 'crew', lead: 'crew' };

// 깃발 말: 우리 붉은 기(본부) · 초록 기(미궁) · 남의 푸른 작은 기
const flagSvg = (no: string, col: string) => `<svg viewBox="0 0 44 46" aria-hidden="true"><ellipse cx="6" cy="44" rx="6" ry="2" fill="rgba(0,0,0,.35)"/><rect x="4.5" y="4" width="3" height="40" rx="1" fill="#3a2b1d"/><path d="M7.5 5h30l-7 9 7 9h-30z" fill="${col}" stroke="#2b2118" stroke-width="1.2"/><text x="19" y="18.5" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-weight="600" font-size="11" fill="#fff">${no}</text></svg>`;
const rivSvg = (n: number) => `<svg viewBox="0 0 18 22" aria-hidden="true"><rect x="2" y="2" width="2" height="19" fill="#2b2118"/><path d="M4 3h12l-3 4 3 4H4z" fill="#2f4f7a"/><text x="10" y="9.5" text-anchor="middle" font-size="7" font-weight="700" fill="#fff" font-family="IBM Plex Mono, monospace">${n}</text></svg>`;

// 조마다 지금: 미궁(그 구역 · 남은 날) · 명령 받음(내일 출발) · 본부(나갈 수 있나, 아니면 까닭)
function teamState(W: World, T: Team) {
  const ids = T.m.filter((x): x is number => x != null), s = (W.away || []).find(x => x.m.some(id => ids.includes(id)));
  if (s) return { k: 'away' as const, s };
  if (teamReady(W, T)) return { k: T.go ? 'go' as const : 'home' as const };
  const c = us(W), out = awayIds(W), st = ids.map(id => (c.crew || []).find(p => p.id === id)).filter(Boolean).map(p => stateOf(W, p!, out));
  return { k: 'busy' as const, why: !ids.length ? '빈 조' : st.includes('hurt') ? '부상' : st.includes('rest') ? '쉬는 날' : '기다림' };
}

export function boardShellHtml(W: World, raw: Plan, ui: DeskUi) {
  const c = us(W), P = sanitize(W, c, raw), teams = P.teams || [], now = dayAbs(W), day = W.day || 1;
  const f = Math.min(Math.max(0, ui.floor ?? 0), W.unlocked - 1);
  const ag = agendaOf(W, P), badge: Record<string, number> = {};
  ag.forEach(a => { const m = AGENDA_MENU[a.k]; if (m) badge[m] = (badge[m] || 0) + 1; });
  const back = todayBack(W); if (back.length) badge.rec = back.length;
  const out = (W.away || []).reduce((a, s) => a + s.m.length, 0), due = new Map<number, number>();
  (W.away || []).forEach(s => { const d = s.d1 - (W.month - 1) * CO.MONTH_DAYS; due.set(d, (due.get(d) || 0) + 1); });
  const top = `<header class="bs-top">
    <div class="r1"><h1>${esc(c.name)}</h1><span class="when">제${W.month}월 ${day}일</span><button type="button" class="opt" data-act="newgame-ask" aria-label="새 게임">⋯</button></div>
    <div class="r2"><span>금고 <b>${fmt(c.cash)}</b>G</span><span>순위 <b>${rankOf(W) || '−'}</b>/${W.cos.filter(x => x.style !== 'crowd').length}</span><span>본부 <b>${c.members - out}</b></span><span>미궁 <b>${out}</b></span></div>
    <div class="days" role="img" aria-label="제${W.month}월 ${day}일 / ${CO.MONTH_DAYS}일">${Array.from({ length: CO.MONTH_DAYS }, (_, j) => `<i class="${j + 1 < day ? 'past' : j + 1 === day ? 'now' : ''}${due.get(j + 1) ? ' ret' : ''}" title="${j + 1}일${due.get(j + 1) ? ` · ${due.get(j + 1)}조 귀환 예정` : ''}${j + 1 === CO.MONTH_DAYS ? ' · 그믐' : ''}"></i>`).join('')}</div></header>`;
  // 지도: 이 층의 구역 · 길 · 우리 깃발(미궁 · 명령 받음) · 남의 깃발
  const Z = zonesOn(W.zones, f).filter(z => zoneKnown(W, z)), P2 = (z: Zone) => [zx(z), zy(z)];
  const route = (z: Zone) => [[GATE.x, GATE.y], ...viaOf(W.zones || [], z).map(P2), P2(z)].map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
  const st = teams.map(T => teamState(W, T));
  let arrows = '';
  teams.forEach((T, t) => { const S = st[t]; const z = S.k === 'away' ? zoneAt(W, S.s.z) : S.k === 'go' ? zoneAt(W, T.z) : undefined; if (z && z.f === f) arrows += `<path class="${S.k === 'away' ? 'out' : 'go'}" d="${route(z)}"/>`; });
  const zones = Z.map(z => {
    const L = lvOf(z), k = zoneKnown(W, z) && L >= 1 ? z.kind : 'unk', pr = lvProg(z), on = ui.zone === z.id || (ui.order != null && teams[ui.order] && teams[ui.order].z === z.id);
    const ticks = Array.from({ length: 5 }, (_, i) => `<i class="${i < L ? 'on' : i === L && pr > 0 ? 'part' : ''}"></i>`).join('');
    return `<button type="button" class="bz ${k}${on ? ' sel' : ''}" data-act="bs-zone" data-z="${z.id}" style="left:${zx(z)}%;top:${zy(z)}%" aria-label="${esc(z.nm)}, 거리 ${z.r}, 이해도 ${L}단계"><span class="sym">${k === 'unk' ? '?' : SYM[z.kind]}</span><span class="nm">${esc(z.nm)}</span><span class="tk" aria-hidden="true">${ticks}</span></button>`;
  }).join('');
  const rivs = new Map<number, number>(); (W.seen || []).filter(x => x.d > now && x.z != null).forEach(x => rivs.set(x.z!, (rivs.get(x.z!) || 0) + x.n));
  const rivHtml = [...rivs].map(([id, n]) => { const z = zoneAt(W, id); return z && z.f === f ? `<span class="briv" style="left:${zx(z)}%;top:${zy(z)}%" title="우리 조가 본 남의 조 ${n} (아직 미궁에)">${rivSvg(n)}</span>` : ''; }).join('');
  const flag = (T: Team, t: number, on: boolean) => {
    const S = st[t], L = T.m.filter((x): x is number => x != null).map(id => (c.crew || []).find(p => p.id === id)), ld = L[0];
    const col = S.k === 'away' ? '#3f7d4e' : S.k === 'go' ? '#c9473c' : S.k === 'busy' ? '#7d6b55' : '#a8322a';
    const left = S.k === 'away' ? S.s.d1 - now : 0;
    const tip = S.k === 'away' ? `미궁 · ${left <= 0 ? '오늘' : `늦어도 ${left}일 뒤`} 귀환` : S.k === 'go' ? '내일 아침 출발' : S.k === 'busy' ? S.why : '본부';
    return `<button type="button" class="bf ${S.k}${on ? ' onmap' : ''}${ui.order === t ? ' sel' : ''}" data-act="bs-team" data-t="${t}" aria-label="${t + 1}조 ${ld ? esc(nameOf(ld)) : ''} ${L.length}명 · ${tip}">${flagSvg(`${t + 1}조`, col)}${on ? '' : `<span class="tag">${ld && ld.lead ? '★' : ''}${ld ? esc(nameOf(ld)) : '빈 조'} · ${L.length}명</span>`}${S.k === 'away' ? `<span class="left">${Math.max(0, left)}일</span>` : S.k === 'busy' ? `<span class="why">${S.why}</span>` : ''}</button>`;
  };
  const onMap = teams.map((T, t) => { const S = st[t], z = S.k === 'away' ? zoneAt(W, S.s.z) : S.k === 'go' ? zoneAt(W, T.z) : undefined; return z && z.f === f ? `<span class="bfp" style="left:${zx(z)}%;top:${zy(z)}%">${flag(T, t, true)}</span>` : ''; }).join('');
  const tray = teams.map((T, t) => (st[t].k === 'home' || st[t].k === 'busy' ? flag(T, t, false) : '')).join('');
  const elsewhere = teams.filter((T, t) => { const S = st[t], z = S.k === 'away' ? zoneAt(W, S.s.z) : S.k === 'go' ? zoneAt(W, T.z) : undefined; return z && z.f !== f; }).length;
  const backBar = back.length && ui.backs ? `<div class="bs-ret" role="status"><b>아침 귀환 ${back.length}조</b><span>${back.map(s => { const r = s.rep!; const up = r.zx && Math.floor(lvOf({ xp: r.zx[1] } as Zone)) > lvOf({ xp: r.zx[0] } as Zone); return `${(r.t ?? 0) + 1}조 ${r.zn ? esc(r.zn) : FLOORS[r.f].name}${r.got ? ` · 채집품 ${r.got}` : ''}${(r.dead || []).length ? ' · †' : ''}${up ? ' · 이해도 오름' : ''}`; }).join(' / ')}</span><button type="button" class="mini" data-act="bs-backs">보고</button><button type="button" class="x" data-act="close-backs" aria-label="접기">×</button></div>` : '';
  // 단장의 인계: 새로 넘겨받은 업무 한 장 (열면 그 탭으로, ×로 접는다)
  const dn = (ui.dutyNew || []).map(k => DUTIES.find(d => d.k === k)).filter(Boolean)[0];
  const dutyBar = dn ? `<div class="bs-ret duty" role="status"><b>단장 브란 · ${dn.n}</b><span>${esc(dn.memo)}</span><button type="button" class="mini" data-act="duty-go" data-k="${dn.k}">열기</button><button type="button" class="x" data-act="duty-ok" data-k="${dn.k}" aria-label="접기">×</button></div>` : '';
  const hint = !tray ? '본부에 남은 조가 없어요' : '깃발을 구역에 끌어다 놓기 · 깃발을 누르면 명령서';
  const mid = `<div class="bs-mid">
    <div class="bs-floors">${FLOORS.slice(0, W.unlocked).map((F, g) => `<button type="button" data-act="bs-floor" data-f="${g}" aria-pressed="${g === f}">${F.name}</button>`).join('')}${elsewhere ? `<span class="dim">다른 층 ${elsewhere}조</span>` : ''}<span class="legend"><i class="us"></i>우리 <i class="them"></i>남</span></div>
    <div class="bs-map" id="bs-map" data-f="${f}"><canvas id="bs-terrain" aria-hidden="true"></canvas>
      <svg class="bs-arrows" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${arrows}</svg>
      ${zones}${rivHtml}${onMap}${backBar || dutyBar}</div>
    <div class="bs-tray"><span class="lbl">본부</span><div class="flags">${tray}</div><span class="hint">${hint}</span></div>
  </div>`;
  const goN = st.filter(x => x.k === 'go').length, must = ag.filter(a => a.must).length;
  const btn = (k: string, icon: string) => `<button type="button" data-act="bs-menu" data-m="${k}" aria-pressed="${ui.menu === k}"><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>${MENUS[k].n}${badge[k] ? `<span class="badge">${badge[k]}</span>` : ''}</button>`;
  const bot = `<nav class="bs-bot" aria-label="행정">
    ${btn('crew', '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2c3 .2 5.5 2.4 5.5 5.8"/>')}
    ${btn('goods', '<path d="M3 9l9-5 9 5v10l-9 4-9-4z"/><path d="M3 9l9 5 9-5M12 14v9"/>')}
    ${btn('rec', '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/>')}
    ${btn('hq', '<path d="M3 10l9-6 9 6v10H3z"/><path d="M9 20v-6h6v6"/>')}
    ${nextDayBtn(W, 'bs-next', goN, must)}</nav>`;
  return `<div class="bs${ui.menu || ui.order != null || ui.zone != null ? ' has-sheet' : ''}">${top}${mid}${sheetHtml(W, raw, P, ui)}${bot}</div>`;
}

// ---------- 시트 ----------
function sheetHtml(W: World, raw: Plan, P: Plan, ui: DeskUi) {
  if (ui.menu && MENUS[ui.menu]) return menuSheet(W, raw, P, ui);
  if (ui.order != null && P.teams && P.teams[ui.order]) return orderSheet(W, raw, P, ui.order, hasDuty(ui, 'book'));
  if (ui.zone != null && zoneAt(W, ui.zone)) return zoneSheet(W, P, zoneAt(W, ui.zone)!);
  return '';
}
// (손잡이를 끌어 올리면 크게, 내리면 닫는다. 누르면 크게 ↔ 보통)
let full = false;
export const setSheetFull = (v: boolean) => { full = v; };
// tall: 단추 시트는 내용이 적어도 같은 높이로 올라온다 (탭을 바꿔도 시트가 들썩이지 않게, 남는 아래는 여백)
const sheet = (body: string, label: string, tall = false) => `<section class="bs-sheet${tall ? ' tall' : ''}${full ? ' full' : ''}" role="dialog" aria-label="${label}"><button type="button" class="grab" data-act="bs-grow" aria-label="${full ? '시트 줄이기' : '시트 키우기'}"></button>${body}</section>`;
const zoneHead = (W: World, z: Zone, extra = '') => { const L = lvOf(z), nx = nextXp(z), k = L >= 1 ? z.kind : 'unk';
  return `<h2>${esc(z.nm)} <span class="kind ${k}">${L >= 1 ? KIND_NAME[z.kind] : '하는 일 모름'}</span><small>${FLOORS[z.f].name} · 이해도 ${L}단계${nx != null ? ` · ${f1(z.xp)}/${nx}인일` : ''}${extra}</small><button type="button" class="x" data-act="bs-close" aria-label="닫기">×</button></h2>`; };

// 구역 보고서: 이해도 단계마다 한 겹씩 (잠긴 칸은 "N단계에"), 경험치 막대, 이 구역으로 보낼 본부의 조
function zoneSheet(W: World, P: Plan, z: Zone) {
  const L = lvOf(z), r = richEst(z), k = riskEst(z), nx = nextXp(z), now = dayAbs(W), rc = z.rec, way = zoneWay(W, z);
  const facts: [string, string | null, number][] = [
    ['거리', `${z.r}`, 0], ['오가는 날', way ? `${2 * way}일` : '없음', 0], ['위험', L >= 2 ? `${riskWord(k.mid)}${L >= 4 ? ` ×${f1(k.lo)}~${f1(k.hi)}` : ''}` : null, 2],
    ['채집 몫', L >= 3 ? `×${f1(r.lo)}~${f1(r.hi)}` : null, 3], ['남은 양', L >= 3 ? (z.seen ? `${Math.round(z.seen.v)}개 · ${now - z.seen.d <= 0 ? '오늘' : `${now - z.seen.d}일 전`}` : '잰 적 없음') : null, 3], ['비밀', L >= 5 ? SECRET_NAME[z.secret] : null, 5],
  ];
  const home = (P.teams || []).map((T, t) => ({ T, t })).filter(x => teamState(W, x.T).k === 'home');
  return sheet(`${zoneHead(W, z)}
    <dl class="facts">${facts.map(([a, b, n]) => `<div><dt>${a}</dt><dd class="${b == null ? 'lock' : ''}">${b == null ? `${n}단계에` : esc(b)}</dd></div>`).join('')}</dl>
    <div class="xp"><i><b style="width:${Math.round(lvProg(z) * 100)}%"></b></i><p>${nx != null ? `다음 단계에 <b>${LV_SAYS[lvOf(z) + 1]}</b> · ` : ''}실적 ${rc.md ? `${f1(rc.md)}인일 · 한 사람 하루 ${f1(rc.got / rc.md)}개` : '없음'}</p></div>
    ${home.length ? `<div class="zpick"><span class="dim">이 구역으로</span>${home.map(({ t }) => `<button type="button" class="mini" data-act="bs-place" data-t="${t}" data-z="${z.id}">${t + 1}조</button>`).join('')}</div>` : '<p class="note">본부에 나갈 수 있는 조가 없어요</p>'}`, `${z.nm} 구역 보고서`);
}

// 명령서: 그 조를 그 구역으로. 날/목표 · 일할 날(목표량) · 여유 · 포션, 오감 · 일 · 보급 · 예측, 단장 조사(단장이 낀 조), 내일 아침 출발
function orderSheet(W: World, raw: Plan, P: Plan, t: number, ask = true) {
  const T = P.teams![t], z = zoneAt(W, T.z), S = teamState(W, T);
  if (!z) return '';
  const n = T.m.filter(x => x != null).length, way = zoneWay(W, z), d = T.days || CO.TRIP_DAYS[T.f], r = zoneRate(W, P, T), goal = !!T.goal, L = lvOf(z), k = riskEst(z);
  const c = us(W), lead = (c.crew || []).find(p => p.lead), hasLead = !!lead && T.m.includes(lead.id);
  const S0 = supOf(c), H0 = potsOf(c);
  // 짐: 계획한 날보다 먼저 찰 것 같으면 그날 돌아온다 (예측 · 귀환 날도 그만큼)
  const bd = bagDays(W, P, T), early = !goal && bd < d - 0.5, dE = early ? Math.max(1, Math.round(bd)) : d;
  const chips = `<div class="chips"><span>거리 <b>${z.r}</b></span>${L >= 2 ? `<span>위험 <b>${riskWord(k.mid)}</b></span>` : ''}${L >= 3 && z.seen ? `<span>남은 양 <b>${Math.round(z.seen.v)}</b></span>` : ''}<span>한 조 하루 <b>${f1(r.lo)}~${f1(r.hi)}</b>개</span></div>`;
  const status = S.k === 'away' ? `<p class="note">미궁에 있어요 · 늦어도 ${Math.max(0, S.s.d1 - dayAbs(W))}일 뒤 아침 귀환 (짐이 차거나 물러나면 더 일찍)</p>` : S.k === 'busy' ? `<p class="note neg">지금 나갈 수 없어요 · ${S.why}</p>` : '';
  return sheet(`${zoneHead(W, z, ` · ${t + 1}조 ${n}명`)}${chips}
    <div class="row"><span class="k">기준</span><span class="seg" role="group" aria-label="${t + 1}조 기준"><button type="button" data-act="tmode" data-t="${t}" data-m="days" aria-pressed="${!goal}">날</button><button type="button" data-act="tmode" data-t="${t}" data-m="goal" aria-pressed="${goal}">목표</button></span></div>
    <div class="row"><span class="k">${goal ? '목표량' : '일할 날'}</span>${goal ? stepper('tgoal', t, T.goal!, `${t + 1}조 목표량 (채집품)`) : stepper('tdays', t, d, `${t + 1}조 일할 날`)}</div>
    <div class="kit-h"><b>채비</b><small>창고 · 보급 ${S0.food || 0} · 포션 ${H0.pot + H0.holy} · 수리 도구 ${S0.mend || 0}</small></div>
    <div class="row"><span class="k">보급</span>${stepper('tmargin', t, T.margin || 0, `${t + 1}조 보급 여유 (며칠치 더)`)}<small class="dim">여유 일 · ${n * (T.food || 0)}개 = ${n}명 × ${T.food || 0}일</small></div>
    <div class="row"><span class="k">포션</span>${stepper('tpots', t, teamPots(P, T), `${t + 1}조 포션`)}<small class="dim">쓰지 않으면 돌아온다</small></div>
    <div class="row"><span class="k">수리 도구</span>${stepper('tmend', t, teamMend(P, T), `${t + 1}조 수리 도구`)}<small class="dim">진 날 하나</small></div>
    <div class="row"><span class="k">장비</span><select data-k="teamG" data-i="${t}" aria-label="${t + 1}조 장비"><option value="">없음</option>${GEARS.filter(g => g !== '일반').map(g => `<option value="g:${g}"${T.g === 'g:' + g ? ' selected' : ''}>${g} (${PAIR_CLASS[g]} 대신) · 창고 ${S0.gear[g] || 0}</option>`).join('')}</select></div>
    ${early ? `<p class="bag-w"><b>짐 ~${dE}일째 가득</b><span>짐이 차면 그날 돌아온다 · 일할 날 ${d}일 중 ${dE}일쯤</span></p>` : ''}
    <div class="calc"><div><span>오감</span><b>${2 * way}일</b></div><div><span>일</span><b>${early ? `~${dE}/${d}` : d}일</b></div><div><span>보급</span><b>${n * (T.food || 0)}</b></div><div class="big"><span>예측</span><b>${Math.round(r.lo * dE)}~${Math.round(r.hi * dE)}</b></div></div>
    <p class="note">${early ? `${2 * way + dE}일 뒤 아침 귀환 예측 (늦어도 ${2 * way + d}일)` : `${2 * way + d}일 뒤 아침 귀환`} · 한 사람 하루 보급 하나 · 남은 보급은 검문소가 태운다${L < 3 ? ' · 이해도가 낮아 예측 폭이 넓다' : ''}</p>
    ${hasLead && ask ? askPanel(W, P) : ''}${status}${S.k === 'go' || S.k === 'home' ? kitWarn(W, raw) : ''}
    <div class="acts"><button type="button" data-act="bs-home" data-t="${t}">${S.k === 'go' ? '명령 거두기' : '닫기'}</button>${S.k === 'home' || S.k === 'go' ? `<button type="button" class="go" data-act="send" data-t="${t}" aria-pressed="${S.k === 'go'}">${S.k === 'go' ? '내일 아침 출발 ✓' : '내일 아침 출발'}</button>` : ''}</div>`, `${t + 1}조 명령서`);
}

// 단추 시트: 탭마다 지금 있는 창의 내용
function menuSheet(W: World, raw: Plan, P: Plan, ui: DeskUi) {
  // 단장이 아직 맡고 있는 탭은 잠근다 (docs/plan.md "단장의 인계")
  const M = MENUS[ui.menu!], open = M.tabs.filter(([k]) => tabOpen(ui, ui.menu!, k)), tab = open.some(x => x[0] === ui.mtab) ? ui.mtab! : open.length ? open[0][0] : '';
  const body = !tab ? `<p class="note">단장이 맡고 있어요 · ${M.tabs.map(([k]) => DUTIES.find(d => d.tabs.some(([m, t]) => m === ui.menu && t === k))?.n).filter((x, i, a) => x && a.indexOf(x) === i).join(' · ')}</p>` : (() => {
    if (ui.menu === 'crew') return tab === 'team' ? teamsHtml(W, raw, ui) : tab === 'list' ? listHtml(W, raw, ui) : candsHtml(W);
    if (ui.menu === 'goods') return tab === 'buy' ? buyHtml(W, raw) : tab === 'kit' ? kitHtml(W, raw, ui) : sellHtml(W, raw);
    if (ui.menu === 'rec') {
      if (tab === 'month') return monthHtml(W, raw);
      if (tab === 'back') return backBodyHtml(W, raw, false);
      if (tab === 'zone') return zoneCards(W, P);
      return `<article class="co-sheet doc" id="${tab === 'report' ? 'results' : tab === 'probe' ? 'intel' : tab === 'book' ? 'book' : 'doc-' + tab}">${docBody(W, tab, P, ui)}</article>`;
    }
    return tab === 'train' ? `${staffBlds(W, raw)}${placeBody(W, raw, ui, tab)}` : placeBody(W, raw, ui, tab);
  })();
  return sheet(`<h2>${M.n}<small>${M.sub}</small><button type="button" class="x" data-act="bs-close" aria-label="닫기">×</button></h2>
    <div class="tabs" role="tablist">${M.tabs.map(([k, n]) => tabOpen(ui, ui.menu!, k) ? `<button type="button" role="tab" data-act="bs-tab" data-k="${k}" aria-selected="${k === tab}">${n}</button>` : `<button type="button" role="tab" class="lock" disabled aria-selected="false" title="단장이 맡고 있어요">${n}</button>`).join('')}</div>
    <div class="bs-body">${body}</div>`, M.n, true);
}

// ---------- 지도 바탕 (화면에 붙은 뒤 크기를 알고 그린다) ----------
// 바위에 빗금, 굴과 통로는 밝은 양피지에 잉크 테두리, 격자 좌표 · 나침반 · "한 칸 = 하루 길". 같은 판 · 같은 크기면 같은 그림
function hash(a: number, b: number) { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function drawTerrain(cv: HTMLCanvasElement, W: World, f: number) {
  const box = cv.parentElement!, w = box.clientWidth, h = box.clientHeight, dpr = window.devicePixelRatio || 1;
  if (!w || !h) return;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const g = cv.getContext('2d'); if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const Z = zonesOn(W.zones, f).filter(z => zoneKnown(W, z)), P = (z: Zone) => [zx(z) / 100 * w, zy(z) / 100 * h], gate = [GATE.x / 100 * w, GATE.y / 100 * h + 6];
  const rg = g.createRadialGradient(w / 2, h * .6, 20, w / 2, h / 2, Math.max(w, h) * .75);
  rg.addColorStop(0, '#cbb68c'); rg.addColorStop(1, '#9d865d'); g.fillStyle = rg; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(60,44,28,.22)'; g.lineWidth = 1;
  for (let i = 0; i < Math.round(w * h / 300); i++) { const x = hash(i, 1 + f) * w, y = hash(i, 2 + f) * h, l = 4 + hash(i, 3) * 6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y - l * .7); g.stroke(); }
  const rx = Math.max(30, Math.min(46, w / 9)), ry = rx * .66;
  const blob = (cx: number, cy: number, a: number, b: number, seed: number) => { g.beginPath(); for (let k = 0; k <= 24; k++) { const t = k / 24 * Math.PI * 2, j = .78 + hash(seed, k % 24) * .38, x = cx + Math.cos(t) * a * j, y = cy + Math.sin(t) * b * j; if (k) g.lineTo(x, y); else g.moveTo(x, y); } g.closePath(); };
  const tunnel = (a: number[], b: number[], seed: number) => { g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo((a[0] + b[0]) / 2 + (hash(seed, 9) - .5) * 40, (a[1] + b[1]) / 2 + (hash(seed, 8) - .5) * 20, b[0], b[1]); };
  const pass = (lw: number, col: string, grow: number) => {
    g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = lw;
    Z.forEach(z => { const p = z.parent != null ? zoneAt(W, z.parent) : undefined; tunnel(p ? P(p) : gate, P(z), z.id); g.stroke(); });
    Z.forEach(z => { const [x, y] = P(z); blob(x, y, rx + grow, ry + grow, z.id + 50); g.fill(); });
    blob(gate[0], gate[1], rx * .9 + grow, ry * .6 + grow, 99 + f); g.fill();
  };
  pass(lwOf(w), '#3a2b1d', 3); pass(lwOf(w) - 6, '#eadfc3', 0);
  g.strokeStyle = 'rgba(107,90,69,.25)'; g.setLineDash([2, 4]);
  Z.forEach(z => { const [x, y] = P(z); for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(x, y, rx * .7 - k * 8, ry * .7 - k * 5, 0, 0, Math.PI * 2); g.stroke(); } });
  g.setLineDash([]);
  g.strokeStyle = 'rgba(43,33,24,.12)'; const cols = 6, rows = Math.max(4, Math.round(cols * h / w));
  for (let i = 1; i < cols; i++) { g.beginPath(); g.moveTo(i * w / cols, 0); g.lineTo(i * w / cols, h); g.stroke(); }
  for (let j = 1; j < rows; j++) { g.beginPath(); g.moveTo(0, j * h / rows); g.lineTo(w, j * h / rows); g.stroke(); }
  g.fillStyle = 'rgba(43,33,24,.55)'; g.font = '600 10px "IBM Plex Mono", monospace';
  for (let i = 0; i < cols; i++) g.fillText('ABCDEFGH'[i], i * w / cols + 4, 12);
  for (let j = 0; j < rows; j++) g.fillText(String(j + 1), 4, j * h / rows + 24);
  g.fillStyle = '#2b2118'; g.font = '700 12px "Gowun Batang", serif'; g.textAlign = 'center'; g.fillText('미궁 입구', gate[0], h - 6);
  g.save(); g.translate(w - 26, 30); g.strokeStyle = '#2b2118'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(0, -12); g.lineTo(4, 4); g.lineTo(0, 1); g.lineTo(-4, 4); g.closePath(); g.fill(); g.fillText('N', 0, -17); g.restore();
  g.textAlign = 'left'; g.fillStyle = 'rgba(43,33,24,.7)'; g.font = '600 10px "IBM Plex Mono", monospace'; g.fillText(`${FLOORS[f].name} · 한 칸 = 하루 길`, 10, h - 10);
  const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .35, w / 2, h / 2, Math.max(w, h) * .72); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(40,26,10,.45)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
}
const lwOf = (w: number) => Math.max(18, Math.min(26, w / 15));
