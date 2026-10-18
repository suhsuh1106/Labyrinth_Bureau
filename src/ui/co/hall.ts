// 길드 홀: 본부에 남은 단원들이 탁자 · 훈련 마당 · 출정 대기 · 의무실에 모여 있고, 몇몇이 서로 말을 주고받는다.
// 옆 판에는 미궁에 나가 있는 조(며칠째 · 언제 돌아올지 · 어림), 오늘 아침 돌아온 조, 나갈 수 있는 조가 있다.
// 대화는 기록(오늘 돌아온 조 · 다친 사람 · 시세 · 소문 · 특성)에서 고르고, 고르는 데 난수 대신 날짜와 사람 번호의 해시를 쓴다.
// 상태를 쓰지 않고 난수도 쓰지 않는다
import { priceNow, CO, FLOORS, ITEMS, type Ours, type Person, type Plan, type Sortie, type World, awayIds, boughtOf, dayAbs, dayOf, floorMons, forecastTrips, jo, potShock, sanitize, stateOf, teamReady, us } from '../../core/company';
import { TRIP_END } from '../../core/events';
import { adminBar } from './desk';
import { nameOf, packBar } from './roster';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
const ICON: Record<string, string> = { 전사: '🛡️', 궁수: '🏹', 마법사: '🔮', 사제: '✝️', 도적: '🗡️' };
const CLS_TAG: Record<string, string> = { 전사: 'war', 궁수: 'arc', 마법사: 'mag', 사제: 'pri', 도적: 'thf' };
// 문자열 해시 (FNV-1a): 같은 날 같은 사람이면 같은 말을 고른다
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; };
const pick = <T>(a: T[], key: string) => a[hash(key) % a.length];
// 받침에 맞춘 조사: 이/가 · 은/는 · 을/를 · 과/와 · 이랑/랑
const J = (w: string, a: string, b: string) => w + jo(w, a, b);

type Zone = 'table' | 'gate' | 'yard' | 'ward';
const ZONE: Record<Zone, { n: string; sub: string }> = {
  table: { n: '탁자', sub: '돌아와 쉬는 날' },
  gate: { n: '출정 대기', sub: '짐을 다 싼 조' },
  yard: { n: '훈련 마당', sub: '대기 = 본부 훈련' },
  ward: { n: '의무실', sub: '다친 사람' },
};
// 말 한 줄: 누가, 무엇을, 얼마나 할 법한가(w), 받아 줄 사람과 대꾸
type Talk = { id: number; t: string; w: number; to?: number; re?: string };

// 오늘 아침 돌아온 조 (이번 달 돌아온 것 중 오늘 거둔 것)
export const todayBack = (W: World) => (W.back || []).filter(s => (W.today || []).includes(s.id));

function talksOf(W: World, P: Plan, here: Person[], zone: Map<number, Zone>) {
  const day = W.day || 1, key = (id: number, k: string) => `${W.month}-${day}-${id}-${k}`, out: Talk[] = [];
  const say = (id: number, k: string, lines: string[], w: number, to?: number, re?: string[]) => out.push({ id, t: pick(lines, key(id, k)), w, ...(to != null && re ? { to, re: pick(re, key(to, k + 're')) } : {}) });
  const byId = new Map(here.map(p => [p.id, p])), mate = (p: Person, k: string) => { const o = here.filter(x => x.id !== p.id && zone.get(x.id) === zone.get(p.id)); return o.length ? o[hash(key(p.id, k + 'm')) % o.length].id : undefined; };
  const anyone = (p: Person, k: string) => { const o = here.filter(x => x.id !== p.id); return o.length ? o[hash(key(p.id, k + 'a')) % o.length].id : undefined; };
  const REPLY = ['그러게.', '맞아, 조심하자.', '한 잔 하면서 얘기하자.', '다음엔 나도 데려가.', '행정관님이 알아서 하시겠지.', '그 말이 맞아.'];
  // 오늘 돌아온 조: 해낸 것 · 혼난 것 · 잃은 사람 · 횃불 · 굶음 · 무뎌짐
  todayBack(W).forEach(s => {
    const r = s.rep; if (!r || !r.days) return;
    const F = FLOORS[s.f].name, mon = r.days.length ? r.days[r.days.length - 1].mon : '', T = r.trip!;
    const who = s.m.filter(id => byId.has(id)), dead = r.dead || [];
    who.forEach((id, k) => {
      const p = byId.get(id)!, to = mate(p, 'back');
      if (dead.length && k === 0) return say(id, 'grief', [`${J(dead[0].n, '이', '가')} 바로 옆에 있었는데…`, `${dead[0].n}의 몫까지 살아야지.`], 9, to, ['…자리를 비워 두자.', '오늘은 아무 말 하지 말자.']);
      if (T.end === 'torch' && k === 0) return say(id, 'dark', ['횃불이 꺼졌을 땐 정말 끝인 줄 알았어.', '어둠 속에서 길을 더듬어 나왔어.'], 7, to, ['다음엔 횃불을 더 챙겨.', '살아 돌아왔으면 됐어.']);
      if (r.days!.some(d => d.hg) && k === 1) return say(id, 'hungry', ['식량이 모자라서 배를 곯았어.', '빈속으로 칼을 휘두르는 건 못 할 짓이야.'], 6, to, ['행정관님께 말씀드려.', '오늘은 실컷 먹어.']);
      if (r.days!.some(d => d.bl) && k === 2) return say(id, 'blunt', ['날이 다 빠진 칼로 싸우는 건 두 번 다시 싫어.', '정비 도구가 떨어져서 애먹었어.'], 5, to, REPLY);
      if (r.ok && k === 0) return say(id, 'ok', T.pack >= T.slots * 0.6 ? ['짐이 꽉 찼어. 등이 아직도 뻐근해.', `${F} 바닥엔 아직 남은 게 많더라.`] : [`${mon ? J(mon, '은', '는') + ' 이제 좀 알겠어.' : '이번엔 손발이 잘 맞았지.'}`, '이번엔 손발이 잘 맞았지.'], 6, to, ['고생했어. 한 잔 받아.', '역시 너희 조야.', ...REPLY]);
      if (!r.ok && k === 0) return say(id, 'fail', [`${F}는 아직 버거워.`, mon ? `${mon}한테 혼쭐이 났어.` : '오늘은 운이 없었어.'], 6, to, ['다음엔 채비를 더 챙기자.', '살아 왔으면 된 거야.']);
      if (r.ld >= 0 && r.ok && k === 1 && !byId.get(id)!.lead) return say(id, 'lead', ['단장님 덕에 살았어.', '단장님이 앞에 서니 든든하더라.'], 4, to, REPLY);
    });
  });
  here.forEach(p => {
    const z = zone.get(p.id)!;
    if (z === 'ward') say(p.id, 'hurt', [`${p.hurt}일만 더 누워 있으래.`, '의무실 죽은 맛이 없어.', '누워만 있으니 몸이 근질거려.'], 5, anyone(p, 'hurt'), ['빨리 나아. 네 자리 비워 둘게.', '푹 쉬어. 미궁은 안 도망가.']);
    if (z === 'yard') {
      const tier = Math.min(4, Math.floor((p.sk ?? 40) / CO.TIER_STEP));
      if (tier === 0) say(p.id, 'rook', ['교관님 목검이 진검보다 무서워.', '언제쯤 나도 내려가 보려나.'], 3, mate(p, 'rook'), ['때가 되면 행정관님이 부르실 거야.', '서두르지 마. 살아남는 게 먼저야.']);
      else say(p.id, 'drill', [(P.coach || 0) ? '오늘도 마당 열 바퀴.' : '교관도 없이 허수아비만 치니 팔만 아파.', '쉬는 것도 일이야.', '몸이 굳기 전에 한 번 내려가고 싶은데.'], 2, mate(p, 'drill'), REPLY);
    }
    if (z === 'gate') {
      const T = (P.teams || []).find(x => x.m.includes(p.id)); if (!T) return;
      const F = FLOORS[T.f].name, mons = floorMons(W, T.f), m0 = mons[0].name;
      const lead = T.m.find(x => x != null) === p.id;
      if (!lead) return;
      if ((T.pots ?? P.pots[T.f] ?? 0) === 0) say(p.id, 'nopot', ['포션도 없이 가라는 건 아니겠지?', '포션 한 병만 있으면 마음이 놓일 텐데.'], 6, mate(p, 'nopot'), ['행정관님 셈이 있으시겠지.', '조심하면 돼.']);
      else if (T.target) say(p.id, 'aim', [`이번엔 ${T.target}만 노린다.`, `${T.target} 잡는 법은 다 외웠어.`], 4, mate(p, 'aim'), REPLY);
      else say(p.id, 'ready', [`${F}로 간다며? 이번엔 ${J(m0, '을', '를')} 잡아 보자.`, '짐은 다 쌌어. 문 열리면 바로 간다.', `${F}까지 ${CO.TRIP_DAYS[T.f]}일 길이야.`], 3, mate(p, 'ready'), ['몸조심해.', '돌아오면 한 잔 사.', ...REPLY]);
    }
    // 특성 · 단장 · 손발 맞는 짝
    const TR: Record<string, string[]> = {
      욕심쟁이: ['이번엔 소재 좀 넉넉히 챙겨 와야지.', '갈무리 칼은 내가 제일 잘 갈아.'], 새가슴: ['깊은 층 얘기만 들어도 손이 떨려.', '나는 1층이 좋아. 정말로.'],
      길잡이: [`${FLOORS[Math.max(0, W.unlocked - 1)].name} 길은 이제 눈 감고도 가.`, '지도에 없는 샛길을 하나 봐 뒀어.'], 강골: ['이 정도 상처는 침 바르면 낫지.'], 신중함: ['서두르면 죽어. 한 걸음씩이야.'],
      눈썰미: ['껍질은 결대로 벗겨야 값이 나가.'], 의무병: ['다치면 나한테 먼저 와. 붕대는 넉넉해.'],
    };
    if (p.tr && TR[p.tr]) say(p.id, 'tr', TR[p.tr], 1.5, mate(p, 'tr'), REPLY);
    if (p.lead) say(p.id, 'lead', ['무리하지 마라. 셈은 행정관이 한다.', '다들 오늘은 일찍 자 둬.'], 2.5, anyone(p, 'lead'), ['예, 단장님.', '알겠습니다.']);
    const pal = Object.entries(p.mt || {}).filter(([id, v]) => v >= 3 && byId.has(+id)).sort((a, b) => b[1] - a[1])[0];
    if (pal) say(p.id, 'pal', [`${J(nameOf(byId.get(+pal[0])!), '이랑', '랑')}은 이제 눈빛만 봐도 알지.`], 2, +pal[0], ['그럼, 몇 번을 같이 내려갔는데.']);
  });
  // 바깥 소식: 나가 있는 조, 시세, 약초 흉년, 그믐, 미궁의 숨소리
  const away = W.away || [], now = dayAbs(W), p0 = here[hash(key(0, 'news')) % Math.max(1, here.length)];
  if (p0) {
    const soon = away.filter(s => s.d0 + CO.TRIP_DAYS[s.f] === now + 1);
    if (soon.length) say(p0.id, 'soon', [`${s1(soon[0])}네 조가 내일쯤 돌아올 거야.`], 3, anyone(p0, 'soon'), ['무사해야 할 텐데.', '오면 한 잔 하자.']);
    else if (away.length) { const s = away[hash(key(0, 'deep')) % away.length]; say(p0.id, 'deep', [`${s.t + 1}조는 지금쯤 ${FLOORS[s.f].name} 어디쯤이겠지.`, `${s1(s)}네는 잘 있으려나.`], 2.5, anyone(p0, 'deep'), REPLY); }
    const hi = ITEMS.findIndex((it, f) => f < W.unlocked && W.price[f] > it.P0 * 1.12), lo = ITEMS.findIndex((it, f) => f < W.unlocked && W.price[f] < it.P0 * 0.85);
    if (hi >= 0) say(p0.id, 'hi', [`${ITEMS[hi].name} 값이 좋다던데. 지금이 때야.`], 2, anyone(p0, 'hi'), REPLY);
    else if (lo >= 0) say(p0.id, 'lo', [`${J(ITEMS[lo].name, '이', '가')} 너무 풀려서 값이 바닥이래.`], 2, anyone(p0, 'lo'), REPLY);
    const drop = (W.sales || []).filter(s => s.i !== 0 && s.d === dayAbs(W) && s.p1 < s.p0 * 0.94)[0];
    if (drop) say(p0.id, 'drop', [`${J(ITEMS[drop.j].name, '이', '가')} 오늘 확 떨어졌대. 누가 잔뜩 풀었나 봐.`, `경매장에 ${ITEMS[drop.j].name}이 산더미래.`], 4, anyone(p0, 'drop'), ['우리 건 좀 들고 있자.', '값이 오를 때까지 기다리자.', ...REPLY]);
    if (potShock(W.month + 1) > potShock(W.month)) say(p0.id, 'shock', ['약초 흉년이라던데, 포션 값이 오르겠어.'], 4, anyone(p0, 'shock'), ['행정관님이 미리 사 두시겠지.']);
    if (day >= CO.MONTH_DAYS - 1) say(p0.id, 'end', ['그믐이 코앞이야. 장부 넘기는 소리가 들려.', '이달 장사는 어땠으려나.'], 2, anyone(p0, 'end'), REPLY);
    if ((W.anoms || 0) > 0 && (W.pressure || 0) > 50) say(p0.id, 'anom', ['요즘 미궁 숨소리가 거칠어졌어.', '입구 바람이 뜨뜻하더라. 좋은 징조는 아니야.'], 3, anyone(p0, 'anom'), ['교회에서도 그 얘기를 하더라.']);
  }
  return out;
}
const s1 = (s: Sortie) => (s.who[0] ? s.who[0].n || s.who[0].c : `${s.t + 1}조`);

// 말풍선: 무게가 큰 것부터, 한 사람은 한 번만 (말하는 사람 · 받는 사람). 하루에 다섯 마디까지
// near: 같은 구역에서 옆자리 · 아랫줄 사람 (말풍선이 겹치지 않게 그 사람은 함께 말하지 않는다)
function bubbles(talks: Talk[], W: World, near: Map<number, number[]>) {
  const used = new Set<number>(), out = new Map<number, string>();
  const block = (id: number) => { used.add(id); (near.get(id) || []).forEach(x => used.add(x)); };
  talks.map((x, i) => ({ x, r: x.w + (hash(`${W.month}-${W.day}-${i}`) % 100) / 100 })).sort((a, b) => b.r - a.r).forEach(({ x }) => {
    if (out.size >= 6 || used.has(x.id)) return;
    block(x.id); out.set(x.id, x.t);
    if (x.to != null && x.re && !used.has(x.to)) { block(x.to); out.set(x.to, x.re); }
  });
  return out;
}

const fig = (p: Person, say?: string, sub = '') => `<div class="mc ${CLS_TAG[p.c] || ''}${p.lead ? ' lead' : ''}${say ? ' talk' : ''}" title="${esc(`${nameOf(p)} · ${p.c}${p.tr ? ' · ' + p.tr : ''}`)}">
  ${say ? `<span class="bub">${esc(say)}</span>` : ''}<span class="body" aria-hidden="true">${ICON[p.c] || '·'}</span><b>${p.lead ? '★' : ''}${esc(nameOf(p))}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;

// 나가 있는 조 하나: 며칠째(예정 날까지 칸), 언제 돌아올지(예정), 조원, 들고 간 채비, 수입 어림
function awayCard(W: World, P: Plan, s: Sortie) {
  const L = CO.TRIP_DAYS[s.f], gone = Math.min(L, dayAbs(W) - s.d0), back = s.d0 + L;
  const fc = forecastTrips(W, P, [s]).mean;
  const cells = Array.from({ length: L }, (_, j) => `<i class="${j < gone ? 'gone' : j === gone ? 'now' : ''}"></i>`).join('');
  const when = back - dayAbs(W) <= 0 ? '오늘쯤' : back - dayAbs(W) === 1 ? '내일 아침' : `${back - dayAbs(W)}일 뒤`;
  return `<li class="aw"><div class="aw-h"><b>${s.t + 1}조</b> ${FLOORS[s.f].name} <span class="dim">${dayOf(s.d0)}일 출발</span><span class="when">귀환 ${when}${back > CO.MONTH_DAYS * W.month ? ' · 다음 달' : ''}</span></div>
    <div class="aw-d" role="img" aria-label="${L}일 중 ${gone}일째">${cells}</div>
    <div class="aw-m">${s.who.map(p => `<span class="${CLS_TAG[p.c] || ''}">${p.lead ? '★' : ''}${esc(nameOf(p))}</span>`).join('')}</div>
    <div class="aw-k">${packBar(s.who.length * CO.SLOT_PP, s.kit.torch, s.kit.pots, 0, s.kit.food, s.kit.mend)}<span class="dim">어림 <b>${fmt(fc)}G</b></span></div></li>`;
}
// 오늘 아침 돌아온 조 하나: 해냈나 · 다닌 날 · 짐 · 잃은 사람. ▶ 보기는 탐사 재생 장면
export function backLine(r: Ours, i: number, src: string) {
  const T = r.trip!, D = r.days || [], wins = D.filter(d => d.win).length, dead = r.dead || [];
  const days = D.map((d, j) => `<i class="${d.win ? 'w' : 'x'}${dead.some(z => z.day === j + 1) ? ' dead' : ''}" title="${esc(`${j + 1}일 · ${d.mon} · ${d.win ? '승' : '패'} ${d.k}/${d.n}`)}">${dead.some(z => z.day === j + 1) ? '†' : d.cr ? '!' : ''}</i>`).join('');
  return `<li class="bk ${dead.length ? 'die' : r.ok ? 'ok' : 'no'}"><div class="bk-h"><b>${(r.t ?? i) + 1}조</b> ${FLOORS[r.f].name} <span class="dim">${D.length}일 · ${wins}승 ${D.length - wins}패 · ${TRIP_END[T.end]}</span>
    <button type="button" class="sc-open" data-act="scene" data-src="${src}" data-i="${i}" aria-label="${(r.t ?? i) + 1}조 탐사 재생">▶ 보기</button></div>
    <div class="bk-d"><span class="days">${days || '<i class="dk"></i>'}</span>${packBar(T.slots, T.torch - T.tu, Math.max(0, (r.potC || 0) - (r.pots || 0)), T.pack, (T.food || 0) - (T.fu || 0), (T.tools || 0) - (T.tk || 0))}</div>
    <div class="bk-r">${r.got != null ? `<span>${esc(ITEMS[r.f].name)} <b>${fmt(r.got)}</b>개 → 창고</span>` : ''}${dead.length ? `<b class="dead-n">† ${dead.map(z => esc(z.n)).join(', ')}</b>` : ''}${r.mats.length ? `<span>${r.mats.slice(0, 3).map(([m, n]) => `${esc(m)} ×${n}`).join(', ')}${r.mats.length > 3 ? ` 외 ${r.mats.length - 3}` : ''}</span>` : ''}${r.hurt ? `<span class="neg">부상 ${r.hurt}</span>` : ''}</div></li>`;
}

// 날 띠: 이번 달 열흘. 지난 날 · 오늘 · 돌아올 조가 있는 날(예정)
export function dayStrip(W: World) {
  const day = W.day || 1, base = (W.month - 1) * CO.MONTH_DAYS, due = new Map<number, number>();
  (W.away || []).forEach(s => { const d = s.d0 + CO.TRIP_DAYS[s.f] - base; due.set(d, (due.get(d) || 0) + 1); });
  return `<span class="dstrip" role="img" aria-label="제${W.month}월 ${day}일 / ${CO.MONTH_DAYS}일">${Array.from({ length: CO.MONTH_DAYS }, (_, j) => {
    const d = j + 1, n = due.get(d) || 0;
    return `<i class="${d < day ? 'past' : d === day ? 'today' : ''}${d === CO.MONTH_DAYS ? ' end' : ''}" title="${d}일${d === CO.MONTH_DAYS ? ' · 그믐 (정산)' : ''}${n ? ` · ${n}조 귀환 예정` : ''}">${d}${n ? `<sup>${n}</sup>` : ''}</i>`;
  }).join('')}</span>`;
}
// 다음 날 단추: 마지막 날이면 그믐 정산으로
export function nextDayBtn(W: World, cls = '') {
  const last = (W.day || 1) >= CO.MONTH_DAYS;
  return `<button type="button" class="nextday${cls ? ' ' + cls : ''}${last ? ' end' : ''}" data-act="next-day">${last ? `그믐 · 제${W.month}월 정산 ▶` : `다음 날 ▶ <small>${(W.day || 1) + 1}일</small>`}</button>`;
}

export function hallHtml(W: World, raw: Plan) {
  const c = us(W), P = sanitize(W, c, raw), crew = c.crew || [], out = awayIds(W);
  const inTeam = new Map<number, number>(); (P.teams || []).forEach((T, t) => T.m.forEach(id => { if (id != null) inTeam.set(id, t); }));
  const zone = new Map<number, Zone>(), here: Person[] = [];
  crew.forEach(p => {
    const st = stateOf(W, p, out); if (st === 'out') return;
    here.push(p);
    const t = inTeam.get(p.id);
    zone.set(p.id, st === 'hurt' ? 'ward' : st === 'rest' ? 'table' : t != null && teamReady(W, P.teams![t]) ? 'gate' : 'yard');
  });
  // 구역마다 한 줄에 넷쯤 선다: 양옆과 아래 · 위 줄의 사람
  const near = new Map<number, number[]>();
  (['table', 'gate', 'yard', 'ward'] as Zone[]).forEach(z => { const ps = here.filter(p => zone.get(p.id) === z); ps.forEach((p, i) => near.set(p.id, [i - 2, i - 1, i + 1, i + 2, i - 4, i + 4, i - 3, i + 3, i - 5, i + 5].filter(j => j >= 0 && j < ps.length).map(j => ps[j].id))); });
  const talk = bubbles(talksOf(W, P, here, zone), W, near);
  const zones = (['table', 'gate', 'yard', 'ward'] as Zone[]).map(z => {
    const ps = here.filter(p => zone.get(p.id) === z);
    const sub = (p: Person) => (z === 'ward' ? `${p.hurt}일` : z === 'gate' ? `${inTeam.get(p.id)! + 1}조` : '');
    return `<section class="zone ${z}" aria-label="${ZONE[z].n}"><header><b>${ZONE[z].n}</b><small>${ZONE[z].sub}${ps.length ? ` · ${ps.length}명` : ''}</small></header>
      <div class="figs">${ps.map(p => fig(p, talk.get(p.id), sub(p))).join('') || '<span class="empty">비었음</span>'}</div></section>`;
  }).join('');
  const away = W.away || [], back = todayBack(W), B = boughtOf(W);
  const ready = (P.teams || []).map((T, t) => ({ T, t })).filter(x => teamReady(W, x.T));
  const monthBack = (W.back || []).length, spent = Object.values(B.cost).reduce((a, b) => a + b, 0);
  const haul = forecastTrips(W, P, [...(W.back || []), ...away.filter(s => s.d0 + CO.TRIP_DAYS[s.f] <= W.month * CO.MONTH_DAYS)]).mean;
  return `<div class="hall">
    <div class="hall-room" aria-label="회색늑대 숙소 · 길드 홀">
      <div class="hall-top"><b>회색늑대 숙소</b> <span class="dim">본부 ${here.length}명 · 미궁 ${out.size}명</span></div>
      <div class="hall-zones">${zones}</div>
    </div>
    <aside class="hall-side">
      ${back.length ? `<div class="panel backs"><header><h2>오늘 아침 돌아온 조</h2></header><ol class="bks">${back.map(s => backLine(s.rep!, (W.back || []).indexOf(s), 'back')).join('')}</ol></div>` : ''}
      ${stockPanel(W, P)}
      <div class="panel aways"><header><h2>미궁에 나간 조</h2><span class="right">${away.length}조</span></header>${away.length ? `<ol class="aws">${away.map(s => awayCard(W, P, s)).join('')}</ol>` : '<p class="note">나가 있는 조가 없어요</p>'}</div>
      <div class="panel readys"><header><h2>나갈 수 있는 조</h2>${ready.length > 1 ? '<button type="button" class="ghost sm" data-act="send-all">모두 보내기</button>' : ''}</header>
        ${ready.length ? `<ul class="rds">${ready.map(({ T, t }) => `<li><b>${t + 1}조</b> ${FLOORS[T.f].name} <span class="dim">${T.m.filter(x => x != null).length}명 · ${CO.TRIP_DAYS[T.f]}일 길</span><button type="button" class="send" data-act="send" data-t="${t}">보내기</button></li>`).join('')}</ul>` : '<p class="note">본부에 짐을 다 싼 조가 없어요 (편성은 출정에서)</p>'}
        <button type="button" class="link" data-act="phase" data-phase="1">출정 편성 →</button></div>
      <div class="panel month"><header><h2>제${W.month}월 장부</h2><span class="right">${W.day || 1}일 / ${CO.MONTH_DAYS}일</span></header>
        <dl class="fc-line"><div><dt>돌아온 조</dt><dd>${monthBack}</dd></div><div><dt>짐 어림</dt><dd>${fmt(haul)}G</dd></div><div><dt>바로 쓴 돈</dt><dd>${fmt(spent)}G</dd></div></dl>
        ${adminBar(W, P)}
        <p class="note">전리품은 창고에서 팔 날을 고른다 (시세는 날마다) · 소재 · 급여 · 본부 유지비는 그믐에</p></div>
      ${nextDayBtn(W, 'big')}
    </aside></div>`;
}

// ---------- 창고의 전리품과 시장 소식 ----------
// 창고: 층마다 캐 온 전리품, 오늘 값(어제 · 기준 값과 견줘), 지금 팔면 얼마, 하루에 상하는 몫. 팔기 · 반 팔기 · 모두 팔기, 돌아오면 바로 팔기
export function stockPanel(W: World, P: Plan) {
  const st = W.stock || [], rows = ITEMS.map((it, j) => ({ it, j, n: Math.floor((st[j] || 0) + 1e-9) })).filter(x => x.n > 0 || x.j < W.unlocked);
  const pp = W.pp || W.price, total = rows.reduce((a, x) => a + x.n * priceNow(W, x.j), 0);
  const row = ({ it, j, n }: { it: typeof ITEMS[number]; j: number; n: number }) => {
    const p = priceNow(W, j), d = p - (pp[j] ?? p), vs = p / it.P0 - 1;
    return `<tr><td><b>${esc(it.name)}</b><small>${FLOORS[j].name}${n ? ` · 하루 −${Math.round(CO.LOOT_ROT[j] * 1000) / 10}% 상함` : ''}</small></td><td class="n">${fmt(n)}</td>
      <td class="n">${p.toFixed(1)}G<small class="${vs > 0.02 ? 'pos' : vs < -0.02 ? 'neg' : 'dim'}">기준 ${vs >= 0 ? '+' : '−'}${Math.round(Math.abs(vs) * 100)}%${Math.abs(d) >= 0.05 ? ` · 어제 ${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}` : ''}</small></td>
      <td class="n">${n ? `<button type="button" class="send sm" data-act="sell" data-j="${j}" data-n="all" title="${fmt(n * p)}G">${fmt(n * p)}G</button>${n > 1 ? `<button type="button" class="link" data-act="sell" data-j="${j}" data-n="half">반만</button>` : ''}` : '<span class="dim">-</span>'}</td></tr>`;
  };
  return `<div class="panel stockp"><header><h2>창고 전리품</h2><span class="right">지금 팔면 <b>${fmt(total)}G</b></span></header>
    <table class="grid slim stk"><thead><tr><th>물품</th><th class="n">개수</th><th class="n">오늘 값</th><th class="n">팔기</th></tr></thead><tbody>${rows.map(row).join('')}</tbody></table>
    <div class="buybar"><button type="button" class="tog" data-act="auto-sell" aria-pressed="${P.autoSell !== false}" title="돌아온 날 캐 온 것을 그날 시세로 바로 판다">돌아오면 바로 팔기</button><span class="sp"></span>${total ? '<button type="button" class="ghost sm" data-act="sell-all">모두 팔기</button>' : ''}</div>
    ${marketNews(W)}</div>`;
}
// 시장 소식: 최근 사흘의 큰 판매. 값이 움직인 것은 누구나 보고, 판 양은 상단 장부 1단계부터, 누가 팔았는지는 2단계부터
export function marketNews(W: World) {
  const lv = W.intel ? W.intel.lv.mkt : 0, now = dayAbs(W);
  const big = (W.sales || []).filter(s => s.i !== 0 && now - s.d <= 2 && s.p1 < s.p0 * 0.96).slice(-5).reverse();
  if (!big.length) return '';
  return `<ul class="mnews">${big.map(s => `<li><span class="dim">${s.d === now ? '오늘' : `${now - s.d}일 전`}</span> <b>${esc(ITEMS[s.j].name)}</b> ${Math.round((s.p1 / s.p0 - 1) * 100)}% · ${lv >= 2 ? esc(W.cos[s.i].name) : '누군가'}${lv >= 1 ? ` ${fmt(s.q)}개` : ' 많이'} 풀었다</li>`).join('')}</ul>`;
}
