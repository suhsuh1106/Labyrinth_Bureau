// 길드 홀: 본부에 남은 단원들이 탁자 · 훈련 마당 · 출정 대기 · 의무실에 모여 있고, 몇몇이 서로 말을 주고받는다.
// 옆 판에는 미궁에 나가 있는 조(며칠째 · 언제 돌아올지 · 예측), 오늘 아침 돌아온 조, 나갈 수 있는 조가 있다.
// 대화는 기록(오늘 돌아온 조 · 다친 사람 · 시세 · 소문 · 특성)에서 고르고, 고르는 데 난수 대신 날짜와 사람 번호의 해시를 쓴다.
// 상태를 쓰지 않고 난수도 쓰지 않는다
import { tripPL } from './ledger';
import { MISSION_NAME, priceNow, CO, FLOORS, ITEMS, type Ours, type Person, type Plan, type Sortie, type World, awayIds, boughtOf, candNow, roomOf, grOf, dayAbs, dayOf, floorMons, forecast, forecastTrips, isLeader, jo, kitShort, potShock, potsExpiring, promoteDue, sanitize, stateOf, matRefOf, rushOn, teamReady, unitPrice, us, teamDays } from '../../core/company';
import { TRIP_END } from '../../core/events';
import { adminBar, fillOf, orderCost } from './desk';
import { stepper } from './view';
import { dayCls, dayMark, dayTip, luckHtml, nameOf, packBar, sendBtn, sqHtml } from './roster';
import { LV_SAYS, lvBar } from './zones';
import { type Zone as LZone, ZONE as LZ, lvOf } from '../../core/zones';

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
    const F = FLOORS[s.f].name, mon = [...r.days].reverse().find(d => d.mon)?.mon || '', T = r.trip!;
    const who = s.m.filter(id => byId.has(id)), dead = r.dead || [];
    who.forEach((id, k) => {
      const p = byId.get(id)!, to = mate(p, 'back');
      if (dead.length && k === 0) return say(id, 'grief', [`${J(dead[0].n, '이', '가')} 바로 옆에 있었는데…`, `${dead[0].n}의 몫까지 살아야지.`], 9, to, ['…자리를 비워 두자.', '오늘은 아무 말 하지 말자.']);
      if (T.end === 'torch' && k === 0) return say(id, 'dark', ['횃불이 꺼졌을 땐 정말 끝인 줄 알았어.', '어둠 속에서 길을 더듬어 나왔어.'], 7, to, ['다음엔 횃불을 더 챙겨.', '살아 돌아왔으면 됐어.']);
      if (r.days!.some(d => d.hg) && k === 1) return say(id, 'hungry', ['식량이 모자라서 배를 곯았어.', '빈속으로 칼을 휘두르는 건 못 할 짓이야.'], 6, to, ['행정관님께 말씀드려.', '오늘은 실컷 먹어.']);
      if (r.days!.some(d => d.bl) && k === 2) return say(id, 'blunt', ['날이 다 빠진 칼로 싸우는 건 두 번 다시 싫어.', '정비 도구가 떨어져서 애먹었어.'], 5, to, REPLY);
      if (r.mission === 'scout' && r.mp && k === 0) return say(id, 'map', [`${F} 지도를 ${r.mp}칸쯤 더 그려 왔어.`, '낯선 통로를 하나 찾았어. 다음 조는 덜 헤맬 거야.'], 6, to, ['그게 다 우리 재산이지.', '고생했어. 발은 괜찮아?', ...REPLY]);
      if (r.mission === 'hunt' && r.mats.length && k === 0) return say(id, 'hunt', [`${r.mats[0][0]}, 이번엔 제대로 갈무리했어.`, mon ? `${J(mon, '은', '는')} 이제 좀 알겠어.` : '사냥은 손이 많이 가.'], 6, to, ['값 좋을 때 팔자.', '도감에 적어 둬.', ...REPLY]);
      if (r.ok && k === 0) return say(id, 'ok', T.pack >= T.slots * 0.6 ? ['짐이 꽉 찼어. 등이 아직도 뻐근해.', `${F} 바닥엔 아직 남은 게 많더라.`] : [`${mon ? J(mon, '은', '는') + ' 이제 좀 알겠어.' : '이번엔 손발이 잘 맞았지.'}`, '이번엔 손발이 잘 맞았지.'], 6, to, ['고생했어. 한 잔 받아.', '역시 너희 조야.', ...REPLY]);
      if (!r.ok && k === 0) return say(id, 'fail', [`${F}는 아직 버거워.`, mon ? `${mon}한테 혼쭐이 났어.` : '오늘은 운이 없었어.'], 6, to, ['다음엔 채비를 더 챙기자.', '살아 왔으면 된 거야.']);
      if (r.ld >= 0 && r.ok && k === 1 && !byId.get(id)!.lead) return say(id, 'lead', ['단장님 덕에 살았어.', '단장님이 앞에 서니 든든하더라.'], 4, to, REPLY);
    });
  });
  here.forEach(p => {
    const z = zone.get(p.id)!;
    if (z === 'ward') say(p.id, 'hurt', [`${p.hurt}일만 더 누워 있으래.`, '의무실 죽은 맛이 없어.', '누워만 있으니 몸이 근질거려.'], 5, anyone(p, 'hurt'), ['빨리 나아. 네 자리 비워 둘게.', '푹 쉬어. 미궁은 안 도망가.']);
    // 진급을 오래 기다린 사람은 예를 갖춰 돌려 말한다 (불만 두 칸부터)
    if ((p.gd || 0) >= 2) say(p.id, 'grudge', ['자격 심사는 언제쯤일지, 여쭤봐도 될까요.', '기록은 장부에 다 있을 텐데요.', '다른 데서 기별이 왔는데, 아직 답은 안 했어요.'], 6, anyone(p, 'grudge'), ['행정관님도 사정이 있으시겠지.', '조금만 더 기다려 봐.']);
    if (z === 'yard') {
      const tier = grOf(p);   // (말풍선도 행정관이 아는 등급으로)
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
      else say(p.id, 'ready', [`${F}로 간다며? 이번엔 ${J(m0, '을', '를')} 잡아 보자.`, '짐은 다 쌌어. 문 열리면 바로 간다.', `${F}까지 ${teamDays(T)}일 길이야.`], 3, mate(p, 'ready'), ['몸조심해.', '돌아오면 한 잔 사.', ...REPLY]);
    }
    // 특성 · 단장 · 손발 맞는 짝
    const TR: Record<string, string[]> = {
      욕심쟁이: ['이번엔 전리품 좀 넉넉히 챙겨 와야지.', '갈무리 칼은 내가 제일 잘 갈아.'], 새가슴: ['깊은 층 얘기만 들어도 손이 떨려.', '나는 1층이 좋아. 정말로.'],
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
    const soon = away.filter(s => s.d1 === now + 1);
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

// 나가 있는 조 하나: 며칠째(예정 날까지 칸), 언제 돌아올지(예정), 조원, 들고 간 채비, 수입 예측
function awayCard(W: World, P: Plan, s: Sortie) {
  const L = Math.max(1, s.d1 - s.d0), gone = Math.min(L, dayAbs(W) - s.d0), back = s.d1;
  const fc = forecastTrips(W, P, [s]).mean;
  const cells = Array.from({ length: L }, (_, j) => `<i class="${j < gone ? 'gone' : j === gone ? 'now' : ''}"></i>`).join('');
  const when = back - dayAbs(W) <= 0 ? '오늘쯤' : back - dayAbs(W) === 1 ? '내일 아침' : `${back - dayAbs(W)}일 뒤`;
  return `<li class="aw"><div class="aw-h"><b>${s.t + 1}조</b> ${FLOORS[s.f].name} ${s.z != null && W.zones ? `<b class="zn">${esc(W.zones[s.z].nm)}</b>` : `<span class="ms-tag ${s.mission || 'gather'}">${MISSION_NAME[s.mission || 'gather']}</span>`} <span class="dim">${dayOf(s.d0)}일 출발${s.goal ? ` · 목표 ${s.goal}개` : ''}</span><span class="when">귀환 ${when}${back > CO.MONTH_DAYS * W.month ? ' · 다음 달' : ''}</span></div>
    <div class="aw-d" role="img" aria-label="${L}일 중 ${gone}일째">${cells}</div>
    <div class="aw-m">${s.who.map(p => `<span class="${CLS_TAG[p.c] || ''}">${p.lead ? '★' : ''}${esc(nameOf(p))}</span>`).join('')}</div>
    <div class="aw-k">${packBar(Math.round(s.who.length * CO.SLOT_PP), s.kit.torch, s.kit.pots, 0, s.kit.food, s.kit.mend)}<span class="dim">예측 <b>${fmt(fc)}G</b></span></div></li>`;
}
// 구역 탐사의 실적 한 줄: 일손(사람 × 날) · 한 사람 하루 몫, 이해도 막대(단계가 오르면 띠), 검문소가 태운 채비
function zoneLine(r: Ours) {
  if (!r.zx || r.wk == null) return '';
  const md = (r.n || 0) * r.wk, [x0, x1] = r.zx, L0 = LZ.LV.filter(t => x0 >= t).length, L1 = LZ.LV.filter(t => x1 >= t).length, b = r.burn;
  const z = { xp: x1 } as LZone;
  return `<div class="bk-z"><span>일손 ${md}일 · 한 사람 하루 <b>${md ? (Math.round((r.got || 0) / md * 10) / 10) : 0}</b>개${r.goal ? ` · 목표 ${r.goal}개${(r.got || 0) >= r.goal ? ' 채움' : ''}` : ''}</span>${r.dry ? `<b class="neg" title="구역에 남은 양이 캐려던 것보다 적어 남은 만큼만 캤다 (남의 조도 캐 간다 · 그믐에 빈 만큼의 절반이 다시 찬다)">구역 바닥 · 캐려던 ${r.dry}개 중 ${r.got || 0}개</b>` : ''}
    <span class="zx">이해도 ${lvBar(z)} <small class="pos">+${Math.round((x1 - x0) * 10) / 10}</small></span>${L1 > L0 ? `<b class="lvup">이해도 ${L1}단계 · ${LV_SAYS[L1]}이 보인다</b>` : ''}
    ${b && (b.food || b.mend) ? `<span class="dim" title="미궁에 들고 간 보급 · 수리 도구는 기운이 스며 검문소가 거둬 태운다">검문소 태움 ${[b.food ? `보급 ${b.food}` : '', b.mend ? `수리 도구 ${b.mend}` : ''].filter(Boolean).join(' · ')} (${b.v}G)</span>` : ''}</div>`;
}
// 오늘 아침 돌아온 조 하나: 해냈나 · 다닌 날 · 짐 · 잃은 사람. ▶ 보기는 탐사 재생 장면
export function backLine(r: Ours, i: number, src: string) {
  const T = r.trip!, D = r.days || [], wins = D.filter(d => d.win).length, dead = r.dead || [];
  // 구간 하나가 한 칸(색이 사건), 하루가 바뀌면 띄운다
  const days = D.map((d, j) => `<i class="${dayCls(d)}${j && d.dd !== D[j - 1].dd ? ' nd' : ''}" title="${esc(dayTip(d, j))}">${dayMark(d)}</i>`).join('');
  // 임무마다 초점 하나를 앞에: 채집은 캐 온 채집품, 사냥은 전리품, 탐색은 그려 온 지도
  const ms = r.mission || 'gather', mapT = r.mp ? `<span>지도 <b>+${r.mp}</b>%p</span>` : '';
  const gotT = r.got ? `<span>${esc(ITEMS[r.f].name)} <b>${fmt(r.got)}</b>개 → 창고</span>` : '', matT = r.mats.length ? `<span>${r.mats.slice(0, 3).map(([m, n]) => `${esc(m)} ×${n}`).join(', ')}${r.mats.length > 3 ? ` 외 ${r.mats.length - 3}` : ''}</span>` : '';
  const focus = ms === 'scout' ? [mapT, gotT, matT] : ms === 'hunt' ? [matT, gotT, mapT] : [gotT, matT, mapT];
  // 계획한 날보다 일찍 돌아왔으면 까닭과 함께 (짐 가득 · 후퇴 · 목표 채움)
  const wk = r.wk ?? 0, short = r.pw && wk < r.pw ? r.pw - wk : 0;
  const head = r.zn ? `<b class="zn">${esc(r.zn)}</b> <span class="dim">${r.way ? `→${r.way} · ` : ''}일 ${wk}${r.pw ? `/${r.pw}` : ''}일${r.way ? ` · ←${T.wb ?? r.way}` : ''} · 구간 ${D.length} · 성공 ${wins} · </span>${short ? `<b class="early">${TRIP_END[T.end]} · ${short}일 일찍</b>` : `<span class="dim">${TRIP_END[T.end]}</span>`}` : `<span class="ms-tag ${ms}">${MISSION_NAME[ms]}</span> <span class="dim">${T.fd ?? D.length}일 · 구간 ${D.length} · 성공 ${wins} · ${TRIP_END[T.end]}</span>`;
  return `<li class="bk ${dead.length ? 'die' : r.ok ? 'ok' : 'no'}"><div class="bk-h"><b>${(r.t ?? i) + 1}조</b> ${FLOORS[r.f].name} ${head}
    <button type="button" class="sc-open" data-act="scene" data-src="${src}" data-i="${i}" aria-label="${(r.t ?? i) + 1}조 탐사 재생">▶ 보기</button></div>
    <div class="bk-d"><span class="days">${days || '<i class="dk"></i>'}</span>${packBar(T.slots, T.torch - T.tu, Math.max(0, (r.potC || 0) - (r.pots || 0)), T.pack, (T.food || 0) - (T.fu || 0), (T.tools || 0) - (T.tk || 0), T.pm || 0, T.pt || 0)}</div>
    ${zoneLine(r)}<div class="bk-r">${luckHtml(r)}${focus[0]}${dead.length ? `<b class="dead-n">† ${dead.map(z => esc(z.n)).join(', ')}</b>` : ''}${focus[1]}${focus[2]}${r.hurt ? `<span class="neg">부상 ${r.hurt}</span>` : ''}</div>${seenHtml(r)}</li>`;
}

// 귀환 보고 창: 다음 날 아침 돌아온 조가 있으면 저절로 뜬다. 오늘 돌아온 조(조 장비 올리기)와 이달 앞서 돌아온 조
export function backWinHtml(W: World, raw: Plan) {
  return `<div class="reader back-w" role="dialog" aria-modal="true" aria-label="귀환 보고"><div class="reader-in">
    <div class="reader-bar"><h2 class="exp-h">귀환 보고 <small>제${W.month}월 ${W.day || 1}일 아침</small></h2><span class="sp"></span><button type="button" class="close" data-act="close-backs" aria-label="창 닫기">×</button></div>
    ${backBodyHtml(W, raw)}</div></div>`;
}
// 귀환 보고의 몸: 오늘 아침 돌아온 조 · 이달 앞서 돌아온 조 (조마다 손익을 크게, 탐사 기록은 접음) (판의 기록 시트도 이것을 띄운다)
export function backBodyHtml(W: World, raw: Plan, close = true) {
  const P = sanitize(W, us(W), raw), all = W.back || [], today = todayBack(W), before = all.filter(s => !today.includes(s)).reverse();
  // 조마다 한 장: 위에 투입 → 가져옴과 손익을 크게, 구간 칸 · 짐 · 구역 기록은 접어 둔다
  const line = (s: Sortie, up: boolean) => `<li class="bk2 ${(s.rep!.dead || []).length ? 'die' : ''}">${heroHtml(W, s, all.indexOf(s))}<details class="bk-more"><summary>탐사 기록</summary><ol class="bks">${backLine(s.rep!, all.indexOf(s), 'back').replace(/<button type="button" class="sc-open"[^]*?<\/button>/, '')}</ol></details>${up ? upBtn(W, P, s) : ''}</li>`;
  return `<div class="hall-side back-body">
      ${today.length ? `<div class="panel backs"><header><h2>오늘 아침 돌아온 조</h2><span class="right">${today.length}조</span></header><ol class="bk2s">${today.map(s => line(s, true)).join('')}</ol></div>` : ''}
      ${before.length ? `<details class="panel backs"${today.length ? '' : ' open'}><summary><h2>이달 앞서 돌아온 조</h2><span class="right">${before.length}조</span></summary><ol class="bk2s">${before.map(s => line(s, false)).join('')}</ol></details>` : ''}
      ${all.length ? '' : '<p class="note">이달 돌아온 조가 없어요</p>'}
      ${close ? '<button type="button" class="nextday" data-act="close-backs">확인</button>' : ''}
    </div>`;
}
// 귀환 한 장의 머리: 투입(채비 + 급여 몫) → 가져옴(채집품 오늘 시세 + 전리품 평균 시세), 손익을 크게 · 배율 · 두 막대,
// 그 아래 얻은 것(채집품 · 새 소재 · 이해도 단계 · 지도)과 잃은 것(사망 · 부상)을 꼬리표로. 장부의 귀환 손익과 같은 셈
function heroHtml(W: World, s: Sortie, i: number) {
  const x = tripPL(W, s), r = s.rep!, cost = x.kit + x.wage, got = x.loot + x.mats, mul = cost > 0 ? got / cost : 0, max = Math.max(1, cost, got);
  const w = (v: number) => `${Math.round(v / max * 100)}%`, dead = r.dead || [];
  const L0 = r.zx ? lvOf({ xp: r.zx[0] } as LZone) : 0, L1 = r.zx ? lvOf({ xp: r.zx[1] } as LZone) : 0;
  const tags = [r.got ? `<span class="tg gold">${esc(ITEMS[r.f].name)} ${fmt(r.got)}</span>` : '', r.mats.length ? `<span class="tg">전리품 ${r.mats.reduce((a, [, k]) => a + k, 0)}점</span>` : '',
    ...(r.first || []).map(m => `<span class="tg new">새 소재 ${esc(m)}</span>`), L1 > L0 ? `<span class="tg new">이해도 ${L1}단계</span>` : '', r.mp ? `<span class="tg">지도 +${r.mp}%p</span>` : '',
    dead.length ? `<span class="tg dead">† ${dead.map(d => esc(d.n)).join(', ')}</span>` : '', r.hurt ? `<span class="tg hurt">부상 ${r.hurt}</span>` : ''].filter(Boolean).join('');
  return `<div class="bk-hero ${x.net < 0 ? 'loss' : 'gain'}">
    <div class="bh-h"><b>${(r.t ?? i) + 1}조</b><span>${r.zn ? esc(r.zn) : FLOORS[r.f].name} · ${r.d0 ?? ''}일 → ${r.d1 ?? ''}일 · ${r.n || s.m.length}명</span><button type="button" class="sc-open" data-act="scene" data-src="back" data-i="${i}" aria-label="${(r.t ?? i) + 1}조 탐사 재생">▶ 보기</button></div>
    <div class="bh-n"><b>${x.net < 0 ? '−' : '+'}${fmt(Math.abs(x.net))}G</b>${cost > 0 ? `<span class="mul">×${(Math.round(mul * 10) / 10).toFixed(1)}</span>` : ''}</div>
    <div class="bh-bars"><span>투입 ${fmt(cost)}</span><i class="out" style="width:${w(cost)}"></i><span>가져옴 ${fmt(got)}</span><i class="in" style="width:${w(got)}"></i></div>
    <small class="bh-t">채비 ${fmt(x.kit)} · 급여 몫 ${fmt(x.wage)} (${x.days}일) → 채집품 ${fmt(x.loot)} · 전리품 ${fmt(x.mats)}</small>
    ${tags ? `<div class="bh-tags">${tags}</div>` : ''}</div>`;
}
// 미궁에서 본 남들: 누가 · 몇 조 · 무엇을 얼마나 지고 · 우리보다 언제 돌아오나
const relTxt = (rel: number) => (rel > 0 ? `${rel}일 뒤 귀환` : rel === 0 ? '같은 아침 귀환' : '먼저 나감');
export const seenHtml = (r: Ours) => { const L = [...(r.seen || [])].sort((a, b) => (b.rel > 0 ? 1 : 0) - (a.rel > 0 ? 1 : 0) || a.rel - b.rel); return L.length ? `<div class="bk-s"><b>미궁에서 본 남들</b>${L.slice(0, 4).map(x => `<span class="${x.rel > 0 ? 'soon' : ''}">${esc(x.nm)}${x.n > 1 ? ` ${x.n}조` : ''}${x.zn ? ` · ${esc(x.zn)}` : ''}${x.h ? ' · <b class="hunt">사냥</b>' : ''} · ${esc(ITEMS[x.f].name)} ${fmt(x.q)}개쯤${x.mt ? ` · 전리품 ${fmt(x.mt)}점쯤` : ''} · ${relTxt(x.rel)}</span>`).join('')}${L.length > 4 ? `<span>외 ${L.length - 4}</span>` : ''}</div>` : ''; };
// 곧 풀릴 물량: 우리 조가 본, 아직 돌아오지 않은 경쟁 조 (돌아오는 날 그 층 채집품을 바로 판다)
export const comingOf = (W: World) => { const now = dayAbs(W); return (W.seen || []).filter(x => x.d > now).sort((a, b) => a.d - b.d); };
// 돌아온 조의 성과급 자리: 그 조의 장비 올리기 (편성표의 같은 조가 같은 조(남는 단위)를 쓰고 있을 때)
function upBtn(W: World, P: Plan, s: Sortie) {
  const T = (P.teams || [])[s.t]; if (!T || (s.sq != null && T.sq !== s.sq)) return '';
  const who = T.m.filter((x): x is number => x != null).map(id => (us(W).crew || []).find(p => p.id === id)).filter((x): x is Person => !!x);
  return `<div class="bk-up">${sqHtml(W, T, s.t, who, true)}</div>`;
}
// 오늘 안건: 오늘 정할 것만 한 줄씩, 그 결정의 크기(G · 명)와 바로 여는 단추. must는 다음 날 단추에 "남은 안건"으로 센다 (넘겨도 막지는 않는다)
export type Agenda = { k: string; h: string; t: string; btn: string; must: boolean };
export function agendaOf(W: World, raw: Plan): Agenda[] {
  const c = us(W), P = sanitize(W, c, raw), crew = c.crew || [], A: Agenda[] = [];
  if (!c.crew || W.draft) return A;
  const teams = P.teams || [], ready = teams.map((T, t) => ({ T, t })).filter(x => teamReady(W, x.T));
  // 달 첫날: 한 달 몫 보급을 정가로 (2일부터는 긴급 구매)
  if (!rushOn(W)) { const oc = orderCost(W, { ...fillOf(W, raw), holy: 0 }); if (oc >= 1) A.push({ k: 'buy', h: '이달 보급 · 오늘만 정가', t: `한 달 몫 ${fmt(oc)}G · 2일부터 긴급 구매 ×${CO.RUSH}`, btn: '<button type="button" class="ghost sm" data-act="place" data-place="market">보급</button>', must: true }); }
  // 떠날 조의 채비가 창고에 모자람 (자동 구매를 끈 때)
  const go = ready.filter(x => x.T.go).map(x => x.t);
  if (raw.autoBuy === false && go.length) {
    const K = kitShort(W, raw, go), parts = [['포션', K.pot], ['횃불', K.torch], ['보급', K.food], ['수리 도구', K.mend], ...Object.entries(K.gear).map(([g, n]) => [g + ' 장비', n])].filter(x => +x[1] > 0);
    if (parts.length) A.push({ k: 'kit', h: '채비 모자람', t: `${go.map(t => `${t + 1}조`).join(' · ')} · ${parts.map(([n, v]) => `${n} ${v}`).join(' · ')}`, btn: `<button type="button" class="send" data-act="buy-short">${rushOn(W) ? '긴급 구매' : '사기'} −${fmt(K.cost)}G</button>`, must: true });
  }
  // 나갈 수 있는 조: 보내면 예측 (예정을 잡은 조는 내일 출발, 다시 누르면 거둠)
  ready.forEach(({ T, t }) => {
    const fc = forecast(W, { ...P, teams: [T], parties: FLOORS.map((_, f) => (f === T.f ? 1 : 0)) }).mean;
    A.push({ k: T.go ? 'sent' : 'send', h: `${t + 1}조 ${T.go ? '내일 출발' : '대기'}`, t: `${FLOORS[T.f].name} ${T.z != null && W.zones ? W.zones[T.z].nm : MISSION_NAME[T.mission || 'gather']} · ${T.m.filter(x => x != null).length}명 · ${teamDays(T)}일 길 · 예측 +${fmt(fc)}G`, btn: sendBtn(T, t), must: !T.go });
  });
  // 빈자리: 조 크기 한도까지 비어 있는 자리 (본부에 있는 조만)
  const out = awayIds(W), empty = teams.filter(T => !T.m.some(id => id != null && out.has(id))).reduce((a, T) => a + T.m.filter(x => x == null).length, 0);
  if (empty) { const now = candNow(W), fresh = now.filter(p => (p.ad || 1) === (W.day || 1)).length; A.push({ k: 'hire', h: `빈자리 ${empty}`, t: now.length ? `지원자 ${now.length}명${fresh ? ` · 오늘 ${fresh}명` : ''} · 빈 침상 ${roomOf(c)}` : '지원자 없음 · 대기 인원으로 채울 수 있음', btn: `<button type="button" class="ghost sm" data-act="${now.length ? 'place" data-place="staff' : 'exp'}">${now.length ? '인원' : '편성'}</button>`, must: true }); }
  // 진급 예정자: 미루면 달마다 불만
  const due = crew.filter(promoteDue);
  if (due.length) A.push({ k: 'grade', h: `진급 예정 ${due.length}명`, t: `${due.slice(0, 3).map(p => esc(nameOf(p))).join(' · ')}${due.length > 3 ? ` 외 ${due.length - 3}` : ''} · 미루면 불만`, btn: '<button type="button" class="ghost sm" data-act="place" data-place="staff">인원</button>', must: true });
  // 조장 자리를 요구하는데 조장이 아닌 사람
  const dm = crew.filter(p => p.dm === 'lead' && !isLeader(c, p.id));
  if (dm.length) A.push({ k: 'lead', h: `조장 요구 ${dm.length}명`, t: `${dm.slice(0, 3).map(p => esc(nameOf(p))).join(' · ')} · 조장이 아니면 불만`, btn: '<button type="button" class="ghost sm" data-act="exp">편성</button>', must: false });
  // 창고 채집품: 오늘 팔면 얼마, 기준보다 비싼 것
  if (P.autoSell === false) {
    const st = W.stock || [], js = ITEMS.map((_, j) => j).filter(j => Math.floor((st[j] || 0) + 1e-9) > 0);
    const v = js.reduce((a, j) => a + Math.floor(st[j] + 1e-9) * priceNow(W, j), 0);
    if (v >= 1) { const hi = js.map(j => ({ j, d: priceNow(W, j) / ITEMS[j].P0 - 1 })).sort((a, b) => b.d - a.d)[0];
      A.push({ k: 'sell', h: '창고 채집품', t: `오늘 팔면 ${fmt(v)}G · ${esc(ITEMS[hi.j].name)} 기준 ${hi.d >= 0 ? '+' : '−'}${Math.round(Math.abs(hi.d) * 100)}%`, btn: '<button type="button" class="ghost sm" data-act="store">창고</button>', must: false }); }
  }
  // 그믐에 팔 전리품 (마지막 날)
  const mb = W.mbox || {}, mN = Object.values(mb).reduce((a, b) => a + b, 0);
  if (mN && (W.day || 1) >= CO.MONTH_DAYS) { const ms = raw.matSell, sN = Object.keys(mb).reduce((a, n) => a + (ms ? Math.min(mb[n], ms[n] || 0) : mb[n]), 0);
    A.push({ k: 'mats', h: '그믐 · 전리품', t: `창고 ${fmt(mN)}점 · 팔 양 ${fmt(sN)}점`, btn: '<button type="button" class="ghost sm" data-act="store">창고</button>', must: false }); }
  // 곧 풀릴 물량: 우리 조가 미궁에서 본 경쟁 조가 돌아와 팔 것 (그 전에 창고의 같은 채집품을 팔지)
  const nowA = dayAbs(W), byItem = new Map<number, { q: number; d: number; nm: string[] }>();
  comingOf(W).forEach(x => { const g = byItem.get(x.f) || { q: 0, d: x.d, nm: [] }; g.q += x.q; g.d = Math.min(g.d, x.d); if (!g.nm.includes(x.nm)) g.nm.push(x.nm); byItem.set(x.f, g); });
  [...byItem.entries()].slice(0, 2).forEach(([f, g]) => { const n = Math.floor(((W.stock || [])[f] || 0) + 1e-9);
    A.push({ k: 'coming', h: `곧 풀릴 ${esc(ITEMS[f].name)}`, t: `${g.nm.map(esc).join(' · ')} · ${fmt(g.q)}개쯤 · ${g.d - nowA}일 뒤${n ? ` · 우리 창고 ${fmt(n)}개 · 오늘 팔면 ${fmt(n * priceNow(W, f))}G` : ''}`, btn: '<button type="button" class="ghost sm" data-act="store">창고</button>', must: false }); });
  // 그믐에 버릴 포션
  const ex = potsExpiring(c);
  if (ex.pot + ex.holy) A.push({ k: 'pot', h: `포션 ${ex.pot + ex.holy}병 보관 끝`, t: `그믐에 버림 · ${fmt((ex.pot + ex.holy) * unitPrice(W, 'pot'))}G어치`, btn: '<button type="button" class="ghost sm" data-act="exp">편성</button>', must: false });
  return A;
}
function agendaHtml(A: Agenda[], W: World, ready: number) {
  const next = (W.away || []).reduce((m, s) => Math.min(m, s.d1 - dayAbs(W)), Infinity);
  return `<div class="panel agenda"><header><h2>오늘 안건</h2>${ready > 1 ? `<button type="button" class="ghost sm" data-act="send-all">${A.filter(a => a.k === 'send').length ? '모두 보내기' : '예정 모두 거두기'}</button>` : ''}<button type="button" class="link right" data-act="exp">출정 편성 →</button></header>
    ${A.length ? `<ul class="ags">${A.map(a => `<li class="ag ag-${a.k}${a.must ? ' must' : ''}"><div><b>${a.h}</b><small>${a.t}</small></div>${a.btn}</li>`).join('')}</ul>` : `<p class="note">정할 것 없음${isFinite(next) ? ` · 다음 귀환 ${next <= 1 ? '내일 아침' : `${next}일 뒤`}` : ''}</p>`}</div>`;
}
// 날 띠: 이번 달 열흘. 지난 날 · 오늘 · 돌아올 조가 있는 날(예정)
export function dayStrip(W: World) {
  const day = W.day || 1, base = (W.month - 1) * CO.MONTH_DAYS, due = new Map<number, number>();
  (W.away || []).forEach(s => { const d = s.d1 - base; due.set(d, (due.get(d) || 0) + 1); });
  return `<span class="dstrip" role="img" aria-label="제${W.month}월 ${day}일 / ${CO.MONTH_DAYS}일">${Array.from({ length: CO.MONTH_DAYS }, (_, j) => {
    const d = j + 1, n = due.get(d) || 0;
    return `<i class="${d < day ? 'past' : d === day ? 'today' : ''}${d === CO.MONTH_DAYS ? ' end' : ''}" title="${d}일${d === CO.MONTH_DAYS ? ' · 그믐 (정산)' : ''}${n ? ` · ${n}조 귀환 예정` : ''}">${d}${n ? `<sup>${n}</sup>` : ''}</i>`;
  }).join('')}</span>`;
}
// 다음 날 단추: 마지막 날이면 그믐 정산으로. go: 보낼 예정인 조 수 (누르면 떠난다)
export function nextDayBtn(W: World, cls = '', go = 0, left = 0) {
  const last = (W.day || 1) >= CO.MONTH_DAYS, gt = (go ? ` <small class="go">${go}조 출발</small>` : '') + (left ? ` <small class="left">안건 ${left} 남음</small>` : '');
  return `<button type="button" class="nextday${cls ? ' ' + cls : ''}${last ? ' end' : ''}" data-act="next-day">${last ? `그믐 · 제${W.month}월 정산 ▶` : `다음 날 ▶ <small>${(W.day || 1) + 1}일</small>`}${gt}</button>`;
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
  const ag = agendaOf(W, P), monthBack = (W.back || []).length, spent = Object.values(B.cost).reduce((a, b) => a + b, 0);
  const haul = forecastTrips(W, P, [...(W.back || []), ...away.filter(s => s.d1 <= W.month * CO.MONTH_DAYS)]).mean;
  return `<div class="hall">
    <div class="hall-room" aria-label="회색늑대 숙소 · 길드 홀">
      <div class="hall-top"><b>회색늑대 숙소</b> <span class="dim">본부 ${here.length}명 · 미궁 ${out.size}명</span></div>
      <div class="hall-zones">${zones}</div>
    </div>
    <aside class="hall-side">
      ${back.length ? `<button type="button" class="backs-open" data-act="backs">오늘 아침 귀환 <b>${back.length}조</b>${back.some(s => (s.rep!.dead || []).length) ? ' <span class="dead-n">†</span>' : ''} <small>보고 ▶</small></button>` : ''}
      ${agendaHtml(ag, W, ready.length)}
      <div class="panel aways"><header><h2>미궁에 나간 조</h2><span class="right">${away.length}조</span></header>${away.length ? `<ol class="aws">${away.map(s => awayCard(W, P, s)).join('')}</ol>` : '<p class="note">나가 있는 조가 없어요</p>'}</div>
      ${candPanel(W)}
      <div class="panel month"><header><h2>제${W.month}월 장부</h2><span class="right">${W.day || 1}일 / ${CO.MONTH_DAYS}일</span></header>
        <dl class="fc-line"><div><dt>돌아온 조</dt><dd>${monthBack ? `<button type="button" class="link" data-act="backs" title="이달 귀환 보고">${monthBack}</button>` : 0}</dd></div><div><dt>짐 예측</dt><dd>${fmt(haul)}G</dd></div><div><dt>바로 쓴 돈</dt><dd>${fmt(spent)}G</dd></div></dl>
        ${adminBar(W, P)}
        <p class="note">채집품은 창고에서 팔 날을 고른다 (시세는 날마다) · 전리품 · 급여 · 본부 유지비는 그믐에</p></div>
      ${nextDayBtn(W, 'big', ready.filter(x => x.T.go).length, ag.filter(a => a.must).length)}
    </aside></div>`;
}

// 지원자: 오늘까지 찾아온 사람 · 오늘 새로 온 사람 · 내일 들어올 신입 (계약은 인원 창에서)
function candPanel(W: World) {
  const c = us(W), now = candNow(W), day = W.day || 1, fresh = now.filter(p => (p.ad || 1) === day).length, Q = c.hireQ || [];
  if (!c.crew || (!now.length && !Q.length)) return '';
  return `<div class="panel cands"><header><h2>지원자</h2><span class="right">${now.length}명${fresh && day > 1 ? ` · 오늘 ${fresh}명` : ''}</span></header>
    ${Q.length ? `<p class="note">내일 합류 ${Q.map(p => `<b>${esc(nameOf(p))}</b> ${p.c}`).join(' · ')}</p>` : ''}
    <p class="note">빈 침상 ${roomOf(c)}개 · ${now.length ? [...new Set(now.map(p => p.c))].join(' · ') : '기다리는 사람 없음'}</p>
    <button type="button" class="link" data-act="place" data-place="staff">인원 · 계약 →</button></div>`;
}

// ---------- 창고의 채집품과 시장 소식 ----------
// 창고의 채집품 칸: 층마다 캐 온 채집품, 오늘 값(어제 · 기준 값과 견줘), 지금 팔면 얼마, 하루에 상하는 몫. 팔기 · 반 팔기 · 모두 팔기, 돌아오면 바로 팔기
// (채비 칸과 함께 창고 창 하나에 든다. desk.ts의 storeHtml)
export function lootStock(W: World, P: Plan) {
  const st = W.stock || [], rows = ITEMS.map((it, j) => ({ it, j, n: Math.floor((st[j] || 0) + 1e-9) })).filter(x => x.n > 0 || x.j < W.unlocked);
  const pp = W.pp || W.price, total = rows.reduce((a, x) => a + x.n * priceNow(W, x.j), 0);
  const row = ({ it, j, n }: { it: typeof ITEMS[number]; j: number; n: number }) => {
    const p = priceNow(W, j), d = p - (pp[j] ?? p), vs = p / it.P0 - 1;
    return `<tr><td><b>${esc(it.name)}</b><small>${FLOORS[j].name}${n ? ` · 하루 −${Math.round(CO.LOOT_ROT[j] * 1000) / 10}% 상함` : ''}</small></td><td class="n">${fmt(n)}</td>
      <td class="n">${p.toFixed(1)}G<small class="${vs > 0.02 ? 'pos' : vs < -0.02 ? 'neg' : 'dim'}">기준 ${vs >= 0 ? '+' : '−'}${Math.round(Math.abs(vs) * 100)}%${Math.abs(d) >= 0.05 ? ` · 어제 ${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}` : ''}</small></td>
      <td class="n">${n ? `<button type="button" class="send sm" data-act="sell" data-j="${j}" data-n="all" title="${fmt(n * p)}G">${fmt(n * p)}G</button>${n > 1 ? `<button type="button" class="link" data-act="sell" data-j="${j}" data-n="half">반만</button>` : ''}` : '<span class="dim">-</span>'}</td></tr>`;
  };
  return `<section class="stockp"><header><h3>채집품</h3><span class="right">지금 팔면 <b>${fmt(total)}G</b></span></header>
    <table class="grid slim stk"><thead><tr><th>물품</th><th class="n">개수</th><th class="n">오늘 값</th><th class="n">팔기</th></tr></thead><tbody>${rows.map(row).join('')}</tbody></table>
    <div class="buybar"><button type="button" class="tog" data-act="auto-sell" aria-pressed="${P.autoSell !== false}" title="돌아온 날 캐 온 것을 그날 시세로 바로 판다">돌아오면 바로 팔기</button><span class="sp"></span>${total ? '<button type="button" class="ghost sm" data-act="sell-all">모두 팔기</button>' : ''}</div>
    ${marketNews(W)}</section>`;
}
// 창고의 전리품: 갈무리해 온 소재 (상하지 않는다). 시세는 그믐에 모두가 판 양으로 정해지니, 팔 양을 그믐 전에 정한다 (지난 그믐 값 · 평균 값을 보고)
export function matStock(W: World, P: Plan) {
  const B = W.mbox || {}, names = Object.keys(B).sort(), ms = P.matSell;
  const sellN = (n: string) => (ms ? Math.min(B[n], ms[n] || 0) : B[n]);
  const last = W.last ? W.last.matPrice : {};
  const rows = names.map((n, i) => { const ref = matRefOf(W, n), lp = last[n];
    return `<tr><td><b>${esc(n)}</b></td><td class="n">${fmt(B[n])}</td><td class="n">${fmt(ref)}G${lp ? `<small class="${lp > ref * 1.02 ? 'pos' : lp < ref * 0.98 ? 'neg' : 'dim'}">지난 그믐 ${fmt(lp)}G</small>` : ''}</td><td>${stepper('matSell', i, sellN(n), `${n} 그믐에 팔 양`)}</td></tr>`; });
  const v = names.reduce((a, n) => a + B[n] * matRefOf(W, n), 0), sv = names.reduce((a, n) => a + sellN(n) * matRefOf(W, n), 0);
  return `<section class="stockp mats"><header><h3>전리품</h3><span class="right">${names.length ? `평균 시세로 <b>${fmt(v)}G</b>` : ''}</span></header>
    ${names.length ? `<table class="grid slim stk"><thead><tr><th>소재</th><th class="n">개수</th><th class="n">평균 시세</th><th>그믐에 팔 양</th></tr></thead><tbody>${rows.join('')}</tbody></table>
    <div class="buybar"><span class="dim">그믐에 ${fmt(sv)}G어치 · 값은 그달 모두가 판 양으로</span><span class="sp"></span><button type="button" class="ghost sm" data-act="mat-keep">모두 보관</button><button type="button" class="ghost sm" data-act="mat-all">모두 팔기</button></div>` : '<p class="note">갈무리해 온 전리품이 없어요 (사냥 임무 · 조우에서)</p>'}</section>`;
}
// 시장 소식: 최근 사흘의 큰 판매. 값이 움직인 것은 누구나 보고, 판 양은 상단 장부 1단계부터, 누가 팔았는지는 2단계부터
export function marketNews(W: World) {
  const lv = W.intel ? W.intel.lv.mkt : 0, now = dayAbs(W);
  const big = (W.sales || []).filter(s => s.i !== 0 && now - s.d <= 2 && s.p1 < s.p0 * 0.96).slice(-5).reverse(), soon = comingOf(W);
  if (!big.length && !soon.length) return '';
  return `<ul class="mnews">${soon.map(x => `<li class="soon"><span class="dim">${x.d - now}일 뒤</span> <b>${esc(ITEMS[x.f].name)}</b> ${fmt(x.q)}개쯤 · ${x.n > 1 ? `${esc(x.nm)} ${x.n}조가` : esc(jo(x.nm, '이', '가'))} 풀 듯 <small class="dim">(우리 조가 봄)</small></li>`).join('')}${big.map(s => `<li><span class="dim">${s.d === now ? '오늘' : `${now - s.d}일 전`}</span> <b>${esc(ITEMS[s.j].name)}</b> ${Math.round((s.p1 / s.p0 - 1) * 100)}% · ${lv >= 2 ? esc(W.cos[s.i].name) : '누군가'}${lv >= 1 ? ` ${fmt(s.q)}개` : ' 많이'} 풀었다</li>`).join('')}</ul>`;
}
