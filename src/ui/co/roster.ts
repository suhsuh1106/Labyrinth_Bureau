// 단원 명단과 편성표: 엑셀처럼 한 줄에 한 사람. 머리글을 누르면 정렬한다.
// 인원 창의 명단 · 지원자 명단과, 출정의 편성표(조 요약 줄 + 배치 칸)를 그린다. 상태를 쓰지 않고 난수도 쓰지 않는다
import { type Ours, awayIds, dayAbs, sortieOf, stateOf, teamReady, CO, FLOORS, type Person, type Plan, type World, candPrice, candNow, hirePrice, boughtOf, cohesion, hqLv, mapOf, personWage, roomOf, teamOdds, teamPots, teamTorch, teamFood, teamMend, foodDays, clamp, tierOf, torchRate, torchOdds, segRate, MISSIONS, MISSION_NAME, type Mission, us, drillGain, isRook, weakShare, synTags, teamSlots, synOf, SYN, potSeen, hidSeen } from '../../core/company';
import { stepper } from './view';
import { type Day, evOf } from '../../core/expedition';
import { floorMons } from '../../core/company';
import { DEX, badSure } from '../../core/dex';
import { GEARS, HIDDEN, PAIR_CLASS, TIER_N, TRAITS, WEAK_KEYS } from '../../core/data';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
const GEAR_NAMES = GEARS.filter(g => g !== '일반');
export const nameOf = (p: Person) => p.n || `${p.c} ${p.id}`;
export const tierHtml = (p: Person) => { const t = tierOf(p); return `<span class="tier t${t}" title="실력 ${TIER_N[t]} · 성공 ${CO.TIER_B[t] >= 0 ? '+' : '−'}${Math.round(Math.abs(CO.TIER_B[t]) * 100)}%p"><span class="pips">${'<i></i>'.repeat(5)}</span><em>${TIER_N[t]}</em></span>`; };
export const traitHtml = (p: Person) => (p.tr ? `<span class="trait" title="${esc(TRAITS[p.tr] || '')}">${p.tr}</span>` : '')
  + (hidSeen(p) && p.hd !== '무난' ? `<span class="trait hid ${(HIDDEN[p.hd!] || { v: 0 }).v > 0 ? 'up' : 'dn'}" title="숨은 기질 · ${esc((HIDDEN[p.hd!] || { t: '' }).t)}">${p.hd}</span>` : '');
// 임무 적성 · 잠재력(함께한 지 CO.POT_SEE달 뒤에 보임) · 해낸 비율(나선 구간 중)
export const aptHtml = (p: Person) => (p.apt ? `<span class="ms-tag ${p.apt}" title="${MISSION_NAME[p.apt]} 사건에서 성공 +${Math.round(CO.APT_SUCC * 100)}%p">${MISSION_NAME[p.apt]}</span>` : '<span class="dim">–</span>');
export const potHtml = (p: Person) => (p.pt == null ? '<span class="dim">–</span>' : potSeen(p) ? `<span title="실력이 오를 수 있는 끝">${TIER_N[Math.min(4, Math.floor(p.pt / CO.TIER_STEP))]}까지</span>` : `<span class="dim" title="함께한 지 ${CO.POT_SEE}달이 지나면 보인다">?</span>`);
const rateOf = (p: Person) => (p.sg && p.sg[0] ? p.sg[1] / p.sg[0] : -1);
// 해낸 비율과 기대 비율(누적): 기대보다 꾸준히 낫거나 못하면 운이 아니라 사람 탓일 수 있다
const rateHtml = (p: Person) => {
  if (!p.sg || !p.sg[0]) return '<span class="dim">–</span>';
  const r = Math.round(rateOf(p) * 100), e = p.sg[2] != null ? Math.round(p.sg[2] / p.sg[0] * 100) : null, d = e == null ? 0 : r - e;
  return `${r}%${e == null ? '' : `<small class="luck ${d >= 5 ? 'up' : d <= -5 ? 'dn' : ''}" title="기대 ${e}% · 나선 구간 ${p.sg[0]}"> ${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)}</small>`}`;
};
// 귀환 줄: 해낸 구간과 기대(행정관이 아는 것만으로 셈한 확률의 합)의 차. 조원마다는 마우스를 올리면
export function luckHtml(r: Ours) {
  if (!r.sn || !r.se || !r.sw) return '';
  const n = r.sw.reduce((a, b) => a + b, 0), e = r.se.reduce((a, b) => a + b, 0), d = n - e;
  const who = r.sn.map((k, m) => (k ? `${(r.nm || [])[m] || `${m + 1}번`} ${r.sw![m]}/${k} · 기대 ${r.se![m].toFixed(1)} (${r.sw![m] - r.se![m] >= 0 ? '+' : '−'}${Math.abs(r.sw![m] - r.se![m]).toFixed(1)})` : '')).filter(Boolean).join('\n');
  return `<span class="luck ${d >= 1 ? 'up' : d <= -1 ? 'dn' : ''}" title="${esc(who)}">해냄 ${n} · 기대 ${e.toFixed(1)} (${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)})</span>`;
}
const exCell = (p: Person, f: number, hl: boolean) => { const v = (p.ex && p.ex[f]) || 0; return `<td class="n ex${hl ? ' hl' : ''}">${v ? `<i style="width:${Math.round(v * 0.36)}px"></i>${v}` : '<span class="dim">–</span>'}</td>`; };

// 정렬: ui.sort는 "열:방향" (방향 1 오름 · -1 내림). 실력 · 경험 · 해낸 수는 처음 누르면 높은 순
export const DESC_FIRST = ['sk', 'wins', 'pot', 'rate', 'ex0', 'ex1', 'ex2', 'ex3', 'ex4', 'wage', 'bond'];
export function sortKey(s: string | undefined, dflt: string) { const [k, d] = (s || dflt).split(':'); return { k, d: +d || 1 }; }
function sortRows<T extends { p: Person }>(rows: T[], k: string, d: number, val: (r: T, k: string) => number | string) {
  return [...rows].sort((a, b) => { const x = val(a, k), y = val(b, k); return (x > y ? 1 : x < y ? -1 : a.p.id - b.p.id) * d; });
}
const pval = (p: Person, k: string): number | string =>
  k === 'name' ? nameOf(p) : k === 'cls' ? p.c : k === 'sk' ? p.sk ?? 40 : k === 'tr' ? p.tr || '' : k === 'wins' ? p.wins || 0 : k === 'apt' ? p.apt || '' : k === 'pot' ? (potSeen(p) ? p.pt ?? 0 : -1) : k === 'rate' ? rateOf(p) : k === 'wage' ? personWage(p) : k === 'st' ? (p.hurt ? 1 : 0)
    : k.startsWith('ex') ? (p.ex && p.ex[+k.slice(2)]) || 0 : 0;
const th = (k: string, name: string, cur: { k: string; d: number }, scope: string, cls = '') =>
  `<th class="srt${cls ? ' ' + cls : ''}${cur.k === k ? (cur.d > 0 ? ' asc' : ' desc') : ''}" data-act="sort" data-scope="${scope}" data-k="${k}" aria-sort="${cur.k === k ? (cur.d > 0 ? 'ascending' : 'descending') : 'none'}" tabindex="0" role="columnheader">${name}</th>`;

// 인원 창의 명단
export function rosterHtml(W: World, sort?: string, raw?: Plan) {
  const out = (raw && raw.fire) || [];
  const c = us(W), crew = c.crew || [], cur = sortKey(sort, 'sk:-1'), open = FLOORS.slice(0, W.unlocked).map((_, f) => f);
  const rows = sortRows(crew.map(p => ({ p })), cur.k, cur.d, (r, k) => pval(r.p, k));
  const tiers = TIER_N.map((_, t) => crew.filter(p => tierOf(p) === t).length);
  return `<div class="rs-sum">${TIER_N.map((n, t) => (tiers[t] ? `<span>${n} <b>${tiers[t]}</b></span>` : '')).join('')}<span>급여 합 <b>${fmt(crew.reduce((a, p) => a + personWage(p), 0))}G</b> <small class="dim">(관리비 따로)</small></span></div>
    <div class="tw"><table class="grid crewt"><thead><tr>${th('name', '이름', cur, 'rs')}${th('cls', '직업', cur, 'rs')}${th('sk', '실력', cur, 'rs')}${th('tr', '특성', cur, 'rs')}${th('apt', '적성', cur, 'rs')}${th('pot', '잠재력', cur, 'rs')}${open.map(f => th('ex' + f, FLOORS[f].name + ' 경험', cur, 'rs', 'n')).join('')}${th('rate', '해낸 비율', cur, 'rs', 'n')}${th('st', '상태', cur, 'rs')}${th('wage', '급여', cur, 'rs', 'n')}<th title="다음 날 아침 떠남 · 위로금 ${CO.FIRE_PAY}달치 급여 (탐사 중인 사람은 돌아온 뒤)">해고</th></tr></thead>
    <tbody>${rows.map(({ p }) => `<tr${p.hurt || out.includes(p.id) ? ' class="away"' : ''}><td class="nm">${p.lead ? '<span class="lead-b" title="단장: 죽지 않고, 크게 다치면 두 달 쉰다. 단장 조사를 맡는다">단장</span>' : ''}${esc(nameOf(p))}</td><td class="cn">${p.c}</td><td>${tierHtml(p)}</td><td>${traitHtml(p)}</td><td>${aptHtml(p)}</td><td>${potHtml(p)}</td>${open.map(f => exCell(p, f, false)).join('')}<td class="n" title="나선 구간 중 해낸 비율 · 나선 구간">${rateHtml(p)}</td><td class="st">${p.hurt ? `<span class="hurt">부상 · ${p.hurt}일 쉼</span>` : ''}</td><td class="n">${personWage(p)}</td><td>${p.lead ? '' : `<button type="button" class="tog sm" data-act="fire" data-id="${p.id}" aria-pressed="${out.includes(p.id)}" title="위로금 ${Math.round(personWage(p) * CO.FIRE_PAY)}G">${out.includes(p.id) ? '내보냄' : '해고'}</button>`}</td></tr>`).join('')}</tbody></table></div>`;
}

// 지원자 명단: 오늘까지 찾아온 사람. 계약하면 계약금이 바로 나가고 다음 날 아침 들어온다 (그날 안에는 물릴 수 있다)
export function candHtml(W: World, _raw: Plan, sort?: string) {
  const c = us(W), Q = c.hireQ || [], room = roomOf(c), cur = sortKey(sort, 'sk:-1'), rp = hirePrice(W), day = W.day || 1;
  const rows = sortRows([...Q.map(p => ({ p, q: true })), ...candNow(W).map(p => ({ p, q: false }))], cur.k, cur.d, (r, k) => (k === 'price' ? candPrice(r.p, rp) : pval(r.p, k)));
  const B = boughtOf(W), got = (B.hired || []).length, fresh = candNow(W).filter(p => (p.ad || 1) === day).length;
  return `<div class="tw"><table class="grid crewt cand"><thead><tr>${th('name', '이름', cur, 'cd')}${th('cls', '직업', cur, 'cd')}${th('sk', '실력', cur, 'cd')}${th('tr', '특성', cur, 'cd')}${th('apt', '적성', cur, 'cd')}${th('price', '계약금', cur, 'cd', 'n')}${th('wage', '급여', cur, 'cd', 'n')}<th>계약</th></tr></thead>
    <tbody>${rows.map(({ p, q }) => { const full = !q && room <= 0, nu = !q && (p.ad || 1) === day && day > 1;
      return `<tr${q ? ' class="on"' : ''}><td class="nm">${esc(nameOf(p))}${nu ? ' <small class="new-b">오늘</small>' : ''}</td><td class="cn">${p.c}</td><td>${tierHtml(p)}</td><td>${traitHtml(p)}</td><td>${aptHtml(p)}</td><td class="n">${fmt(candPrice(p, rp))}</td><td class="n">${personWage(p)}</td>
        <td><button type="button" class="tog" data-act="hire" data-id="${p.id}" aria-pressed="${q}"${full ? ' disabled title="빈 침상이 모자라요"' : ''}>${q ? '내일 합류 · 물리기' : '계약'}</button></td></tr>`; }).join('') || '<tr><td colspan="8" class="dim">아직 찾아온 사람이 없어요</td></tr>'}</tbody></table></div>
    <p class="note">${got ? `이번 달 계약 ${got}명 · 계약금 ${fmt(B.cost.recruit || 0)}G` : '이번 달 계약 없음'}${fresh && day > 1 ? ` · 오늘 새로 ${fresh}명` : ''} · 빈 침상 ${room}개 · 1인 ${fmt(rp)}G부터 (드문 직업 · 실력 단계만큼 더). 지원자는 그믐까지 며칠마다 찾아오고, 그달 계약하지 않은 사람은 다른 용병단으로 가요.</p>`;
}

// 짐 칸: 한 사람 SLOT_PP칸. 쓰는 것(횃불 주황 · 포션 빨강 · 식량 초록 · 정비 도구 회색)이 앞에서부터, 채집품(금빛)은 뒤에서부터 찬다
// 탐사 구간 칸: 사건으로 색(채집 지점 · 조우 · 흔적), 해냈으면 채운 칸 · 못 해냈으면 빈 칸, 위기 ! · 사망 †
export const EV_NAME = { g: '채집 지점', f: '조우', t: '흔적' } as const;
export const dayCls = (d: Day) => `${d.win ? 'w' : 'x'} e${evOf(d)}${d.d ? ' dead' : ''}`;
export const dayMark = (d: Day) => (d.d ? '†' : d.cr ? '!' : '');
export const dayTip = (d: Day, j: number) => `${d.dd ?? j + 1}일 · ${d.mon ? `${d.am ? '들킴 · ' : ''}${d.mon}` : EV_NAME[evOf(d)]} · ${d.mon ? (d.win ? '승' : '패') : d.win ? '해냄' : '못 해냄'} ${d.k}/${d.n}${d.loot ? ` · 채집품 ${d.loot}칸` : ''}${d.mats.length ? ` · ${d.mats.map(([m, c]) => `${m} ×${c}`).join(', ')}` : ''}${d.cr ? ` · 부상 주사위 ${d.cr}${d.sv ? ` · 포션으로 살림 ${d.sv}` : ''}` : ''}`;
export const DAY_LEGEND = '<i class="w eg"></i>채집 지점 <i class="w ef"></i>조우 <i class="w et"></i>흔적 · 채운 칸 해냄 · 빈 칸 못 해냄 · ! 부상 · † 사망';
// 실어 온 것(채집품 금빛 · 전리품 장밋빛 · 지도 기록 푸른빛)은 뒤에서부터 찬다
export function packBar(slots: number, torch: number, pots: number, loot = 0, food = 0, mend = 0, mat = 0, map = 0) {
  const l = Math.min(slots, Math.round(loot)), m = Math.min(slots - l, Math.round(mat)), n = Math.min(slots - l - m, Math.round(map)), got = l + m + n;
  const t = Math.min(torch, slots - got), p = Math.min(pots, slots - got - t), fd = Math.min(Math.ceil(food / CO.FOOD_SLOT - 1e-9), slots - got - t - p), o = Math.min(mend, slots - got - t - p - fd), free = slots - got - t - p - fd - o;
  // 앞에서부터 쓰는 것(횃불 · 포션 · 식량 · 정비 도구), 빈 칸, 그리고 실어 온 것은 뒤에서부터 찬다
  const cells = [...Array(t).fill('t'), ...Array(p).fill('p'), ...Array(fd).fill('f'), ...Array(o).fill('o'), ...Array(free).fill('s'), ...Array(n).fill('n'), ...Array(m).fill('m'), ...Array(l).fill('l')];
  return `<span class="pack" role="img" aria-label="짐 ${slots}칸: 횃불 ${t} · 포션 ${p} · 식량 ${fd} · 정비 도구 ${o} · 빈 칸 ${free}${l ? ` · 채집품 ${l}` : ''}${m ? ` · 전리품 ${m}` : ''}${n ? ` · 지도 기록 ${n}` : ''}">${cells.map(k => `<i class="${k}"></i>`).join('')}</span>`;
}

// 보내기 단추: 누르면 보낼 예정(다음 날 단추를 누르면 떠난다), 다시 누르면 거둔다
export const sendBtn = (T: { f: number; go?: boolean }, t: number) => `<button type="button" class="send${T.go ? ' on' : ''}" data-act="send" data-t="${t}" aria-pressed="${!!T.go}" title="${T.go ? '다음 날 아침 떠남 · 다시 누르면 거둠' : `${FLOORS[T.f].name}까지 ${CO.TRIP_DAYS[T.f]}일 · 다음 날을 누르면 떠난다 · 모자란 채비는 떠날 때 상단에서 산다`}">${T.go ? '보낼 예정 ✓' : '보내기'}</button>`;
// ---------- 출정 편성표 ----------
// 임무: 구간마다 사건의 비중 (채집 지점 · 조우 · 흔적)
const MISSION_TIP: Record<Mission, string> = Object.fromEntries((['gather', 'hunt', 'scout'] as Mission[]).map(k => [k, `${{ gather: '채집: 몬스터를 피해 채집 지점 위주 · 안전', hunt: '사냥: 조우 위주 · 전리품과 도감', scout: '탐색: 흔적을 따라 지도 위주 · 흔적에서 다칠 수 있음' }[k]} · 채집 지점 ${Math.round(CO.MISSION_W[k][0] * 100)}% · 조우 ${Math.round(CO.MISSION_W[k][1] * 100)}% · 흔적 ${Math.round(CO.MISSION_W[k][2] * 100)}%`])) as Record<Mission, string>;
// 조 요약 줄: 층, 사람 수, 직업, 조직력, 성공률 어림, 장비, 살필 것. 아래 명단의 배치 칸으로 사람을 넣고 뺀다
export function assignHtml(W: World, P: Plan, others: (f: number) => number, sort?: string) {
  const c = us(W), crew = c.crew || [], byId = new Map(crew.map(p => [p.id, p])), teams = P.teams || [];
  const teamOf = new Map<number, number>(); teams.forEach((T, t) => T.m.forEach(id => { if (id != null) teamOf.set(id, t); }));
  const whoOf = (t: number) => teams[t].m.filter((x): x is number => x != null).map(id => byId.get(id)).filter((x): x is Person => !!x);
  const open = FLOORS.slice(0, W.unlocked).map((_, f) => f);
  const bondOf = (p: Person) => { const t = teamOf.get(p.id); if (t == null) return -1; const mates = whoOf(t).filter(x => x.id !== p.id); return mates.length ? mates.reduce((a, x) => a + Math.min(CO.CO_MAX, (p.mt && p.mt[x.id]) || 0), 0) / mates.length : 0; };
  const out = awayIds(W);
  // 조의 지금: 나갈 수 있으면 보내기 단추, 나가 있으면 며칠 뒤 돌아올지, 아니면 기다리는 까닭 (쉼 · 부상)
  const goCell = (T: typeof teams[number], t: number) => {
    const ids = T.m.filter((x): x is number => x != null), S = ids.map(id => sortieOf(W, id)).find(Boolean);
    if (S) { const left = S.d0 + CO.TRIP_DAYS[S.f] - dayAbs(W); return `<span class="go-st out">탐사 중<small>${left <= 0 ? '오늘쯤' : left === 1 ? '내일' : `${left}일 뒤`} 귀환</small></span>`; }
    if (teamReady(W, T)) return sendBtn(T, t);
    const why = ids.map(id => byId.get(id)).filter((p): p is Person => !!p).map(p => stateOf(W, p, out));
    return `<span class="go-st">${!ids.length ? '빈 조' : why.includes('rest') ? '쉬는 날' : why.includes('hurt') ? '부상' : '기다림'}</span>`;
  };
  const sum = teams.map((T, t) => {
    const who = whoOf(t), crowd = P.parties[T.f] + P.hire[T.f] + others(T.f), o = teamOdds(W, c, T.f, who, P.pots[T.f], crowd, T);
    const pk = teamPots(P, T), tk = teamTorch(P, T), fd = teamFood(P, T), md = teamMend(P, T), fdays = T.food != null ? clamp(Math.floor(T.food), 0, CO.DAYS) : foodDays(P, T.f), dark = torchOdds(T.f, Math.min(tk, teamSlots(who)), torchRate(T.f, o.u) * (synOf(who).arc ? SYN.ARC1_TORCH : 1)).dark, ms = T.mission || 'gather';
    const bonded = cohesion(who) > 0, fresh = bonded ? who.filter(p => who.every(x => x.id === p.id || !((p.mt && p.mt[x.id]) || 0))).length : 0;
    // 확정한 역효과: 그 층 몬스터의 역효과 장비를 들었거나, 그 속성을 맡는 직업이 맨몸으로 끼었으면 (단장이 있으면 괜찮다)
    const badW = synOf(who).lead ? [] : floorMons(W, T.f).flatMap(M => { const b = badSure((W.dex || {})[M.name]); if (!b) return []; const nm = b.slice(2);
      return T.g === b ? [`역효과 ${nm} 장비`] : who.some(p => PAIR_CLASS[nm] === p.c) ? [`역효과 ${PAIR_CLASS[nm]}`] : []; });
    const warn = [...new Set(badW),...(who.length < CO.PARTY ? [`빈자리 ${CO.PARTY - who.length}`] : []), ...(fresh ? [`새 얼굴 ${fresh}`] : []),
      ...(T.f > 0 && o.u < 50 && who.some(p => p.tr === '새가슴') ? ['새가슴'] : [])];
    const best = Math.max(0, ...who.map(p => (p.ex && p.ex[T.f]) || 0)), m = Math.round(mapOf(c, T.f)), guide = who.some(p => p.tr === '길잡이');
    const uTip = `지도 ${m}${best ? ` + 고참 경험 ${Math.round(Math.min(CO.UND_EX, best / 4))}` : ''}${guide ? ` + 길잡이 ${CO.UND_GUIDE}` : ''} · 성공 ${o.U.succ >= 0 ? '+' : '−'}${Math.round(Math.abs(o.U.succ) * 100)}%p · 위기 ×${o.U.crisis.toFixed(2)} · 캐 오는 양 ×${o.U.loot.toFixed(2)}`;
    return `<tr class="t${t % 8}"><td><b>${t + 1}조</b>${goCell(T, t)}</td>
      <td class="stk"><span class="seg sm" role="group" aria-label="${t + 1}조 층">${open.map(f => `<button type="button" data-act="tfloor" data-t="${t}" data-f="${f}" aria-pressed="${T.f === f}">${FLOORS[f].name}</button>`).join('')}</span>
      <span class="seg sm ms" role="group" aria-label="${t + 1}조 임무">${MISSIONS.map(k => `<button type="button" data-act="tmission" data-t="${t}" data-m="${k}" aria-pressed="${ms === k}" title="${MISSION_TIP[k]}">${MISSION_NAME[k]}</button>`).join('')}</span></td>
      <td class="n">${who.length}/${CO.PARTY}</td><td><span class="cl">${who.map(p => `<span${p.lead ? ' class="lead" title="단장"' : ''}>${p.lead ? '★' : ''}${p.c}</span>`).join('')}</span>${(() => { const ks = WEAK_KEYS.map(k => [k, weakShare(k, who.map(p => p.c), T.g ? [T.g] : [])] as const).filter(([, v]) => v > 0); return ks.length ? `<small class="dim wk" title="찌를 수 있는 약점: 직업 둘이나 장비 한 벌이면 다, 직업 하나면 ¼">약점 ${ks.map(([k, v]) => `${k.slice(2)}${v < 1 ? (v <= 0.25 ? '¼' : '½') : ''}`).join(' · ')}</small>` : ''; })()}${(() => { const tg = synTags(who); return tg.length ? `<span class="syn">${tg.map(([n, t]) => `<span title="${t}">${n}</span>`).join('')}</span>` : ''; })()}</td>
      <td class="stk"><span class="ubar" title="${esc(uTip)}"><i><b style="width:${o.u}%"></b></i><span class="n">${o.u}</span></span>
      <span class="cobar" title="조원 둘씩 함께 나간 달의 평균 (${CO.CO_MAX}달이 끝)"><i><b style="width:${Math.round(o.coh * 100)}%"></b></i><span class="n">${Math.round(o.coh * 100)}</span><small class="dim">+${Math.round(o.coh * CO.CO_SUCC * 100)}%p</small></span></td>
      <td class="n"><b>${Math.round(o.p * 100)}%</b></td>
      <td>${stepper('tpots', t, pk, `${t + 1}조 포션`)}<small class="dim" title="못 해낸 날 부상 주사위에 걸릴 확률 (조원 실력 평균) · 걸리면 포션 한 병이 먼저 막고, 없으면 다치고, 다친 채 또 걸리면 죽는다">부상 ${Math.round(Math.min(0.9, (CO.INJ_BASE + CO.INJ_K * FLOORS[T.f].risk) * o.U.crisis * (who.length ? who.reduce((x, p) => x + CO.INJ_TIER[tierOf(p)], 0) / who.length : 1)) * 100)}%</small></td>
      <td>${stepper('ttorch', t, tk, `${t + 1}조 횃불`)}<small class="${dark >= 0.25 ? 'neg' : 'dim'}" title="첫 구간 하나, 그 뒤 구간마다 ${Math.round(segRate(T.f, torchRate(T.f, o.u)) * 100)}% 확률로 하나 · 다 쓰면 돌아섬">돌아섬 ${Math.round(dark * 100)}%</small></td>
      <td>${stepper('tfood', t, fdays, `${t + 1}조 식량 (며칠치)`)}<small class="dim" title="한 사람 하루 하나 · ${CO.FOOD_SLOT}개가 짐 한 칸 · 굶은 날 성공 −${Math.round(CO.HUNGER_PEN * 100)}%p">${fd}개</small></td>
      <td>${stepper('tmend', t, md, `${t + 1}조 정비 도구`)}</td>
      <td>${packBar(teamSlots(who), tk, pk, 0, fd, md)}</td>
      <td class="stk"><select data-k="teamG" data-i="${t}" aria-label="${t + 1}조 장비"><option value="">섞인 대로</option>${GEAR_NAMES.map(g => `<option value="g:${g}"${T.g === 'g:' + g ? ' selected' : ''}>${g} (${PAIR_CLASS[g]} 대신)</option>`).join('')}</select>
      ${ms === 'hunt' ? `<select data-k="target" data-i="${t}" aria-label="${t + 1}조 노릴 몬스터"><option value="">섞여 만남</option>${floorMons(W, T.f).filter(M => ((W.dex || {})[M.name]?.n || 0) > 0).map(M => { const u = Math.round(((W.dex || {})[M.name]?.u) || 0), ok = u >= DEX.TARGET_AT; return `<option value="${esc(M.name)}"${T.target === M.name ? ' selected' : ''}${ok ? '' : ' disabled'}>${esc(M.name)}${ok ? '' : ` (이해도 ${u}/${DEX.TARGET_AT})`}</option>`; }).join('')}</select>` : ''}</td>
      <td><span class="warn-s">${warn.length ? warn.map(w => `<span>${w}</span>`).join('') : '<span class="ok">없음</span>'}</span></td></tr>`;
  }).join('');
  const bench = crew.filter(p => !teamOf.has(p.id));
  const cur = sortKey(sort, 'team:1');
  const rows = sortRows(crew.map(p => ({ p })), cur.k, cur.d, (r, k) => (k === 'team' ? teamOf.get(r.p.id) ?? (r.p.hurt ? 999 : 998) : k === 'bond' ? bondOf(r.p) : pval(r.p, k)));
  const nT = teams.length, seg = nT <= 6;
  const cell = (p: Person) => {
    const t = teamOf.get(p.id), st = stateOf(W, p, out);
    if (st === 'out') return `<span class="dim">탐사 중 · ${t != null ? `${t + 1}조` : ''}</span>`;
    if (p.hurt) return `<span class="dim">부상 · ${p.hurt}일 쉼</span>`;
    if (!seg) return `<select data-k="assign" data-id="${p.id}" aria-label="${esc(nameOf(p))} 배치">${teams.map((T, k) => `<option value="${k}"${t === k ? ' selected' : ''}${t !== k && whoOf(k).length >= CO.PARTY ? ' disabled' : ''}>${k + 1}조 · ${FLOORS[T.f].name}</option>`).join('')}<option value="new">새 조</option><option value="-1"${t == null ? ' selected' : ''}>대기 · 훈련 +${drillGain(c, P, p)}</option></select>`;
    return `<span class="seg asg" role="group" aria-label="${esc(nameOf(p))} 배치">${teams.map((_, k) => `<button type="button" class="k${k % 8}" data-act="assign" data-id="${p.id}" data-t="${k}" aria-pressed="${t === k}"${t !== k && whoOf(k).length >= CO.PARTY ? ' disabled' : ''}>${k + 1}조</button>`).join('')}<button type="button" data-act="assign" data-id="${p.id}" data-t="new" title="새 조를 만들어 넣기">+</button><button type="button" class="bn" data-act="assign" data-id="${p.id}" data-t="-1" aria-pressed="${t == null}" title="대기 = 본부 훈련: 이번 달 실력 +${drillGain(c, P, p)}${isRook(p) ? ' · 수습 한 달' : ''} (교관 · 훈련장 단계만큼)">대기</button></span>`;
  };
  const bondTxt = (p: Person) => { const b = bondOf(p); return b < 0 ? '' : b === 0 && whoOf(teamOf.get(p.id)!).length > 1 ? '<span class="fresh">새 얼굴</span>' : `${b.toFixed(b % 1 ? 1 : 0)}달`; };
  return `<div class="tw"><table class="grid tsum"><thead><tr><th>조</th><th title="위: 층 · 아래: 임무 (구간마다 채집 지점 · 조우 · 흔적의 비중)">층 · 임무</th><th class="n">인원</th><th>직업</th><th title="위: 이해도 (지도 완성도 + 고참 경험 + 길잡이) · 아래: 조직력 (함께 나간 달)">이해도 · 조직력</th><th class="n">성공률</th><th title="위기마다 한 병">포션</th><th title="첫 구간 하나, 그 뒤 구간마다 확률로 하나 · 다 쓰면 돌아섬 (층마다 ${CO.TRIP_DAYS.join(' · ')}일 · ${CO.SEGS.join(' · ')}구간)">횃불</th><th title="며칠치 · 모자라면 굶는 날 성공 −${Math.round(CO.HUNGER_PEN * 100)}%p">식량</th><th title="진 날 하나 써서 무기를 고친다 · 없으면 무뎌져 날마다 성공 −${Math.round(CO.MEND_PEN * 100)}%p씩 쌓임">정비</th><th title="한 사람 ${CO.SLOT_PP}칸 · 횃불(주황) · 포션(빨강) · 식량(초록, ${CO.FOOD_SLOT}개 한 칸) · 정비 도구(회색)이 앞에서부터 · 실어 온 것(채집품 금빛 · 전리품 장밋빛 · 지도 기록 푸른빛)은 뒤에서부터">짐</th><th title="위: 약점 장비 · 아래: 사냥 임무가 노릴 몬스터 (도감 이해도 ${DEX.TARGET_AT}부터 · 노린 몬스터를 더 자주 만나고 채집품이 더 나온다)">장비 · 노릴 몬스터</th><th>살필 것</th></tr></thead>
      <tbody>${sum || `<tr><td colspan="13" class="dim">짠 조가 없어요. 아래 명단의 + 를 눌러 새 조를 만들어요</td></tr>`}<tr class="rest"><td><b>대기</b></td><td colspan="12" class="dim">${bench.filter(p => !p.hurt).length}명${bench.some(p => !p.hurt) ? ` · 본부 훈련 (실력 +${bench.filter(p => !p.hurt).map(p => drillGain(c, P, p)).join(' · +')})` : ''}${bench.some(p => p.hurt) ? ` · 부상 ${bench.filter(p => p.hurt).length}명 쉼` : ''}</td></tr></tbody></table></div>
    <div class="tw"><table class="grid crewt asgn"><thead><tr>${th('name', '이름', cur, 'as')}${th('cls', '직업', cur, 'as')}${th('sk', '실력', cur, 'as')}${th('tr', '특성', cur, 'as')}${open.map(f => th('ex' + f, FLOORS[f].name, cur, 'as', 'n')).join('')}${th('bond', '함께한 달', cur, 'as')}${th('team', '배치', cur, 'as')}</tr></thead>
    <tbody>${rows.map(({ p }) => { const t = teamOf.get(p.id), f = t != null ? teams[t].f : -1;
      return `<tr class="${t != null ? 'k' + (t % 8) : ''}${p.hurt ? ' away' : ''}${t == null && !p.hurt ? ' drill' : ''}"><td class="nm">${p.lead ? '<span class="lead-b" title="단장: 죽지 않고, 크게 다치면 두 달 쉰다. 단장 조사를 맡는다">단장</span>' : ''}${esc(nameOf(p))}</td><td class="cn">${p.c}</td><td>${tierHtml(p)}</td><td>${traitHtml(p)}</td>${open.map(g => exCell(p, g, g === f)).join('')}<td class="bond">${bondTxt(p)}</td><td>${cell(p)}</td></tr>`; }).join('')}</tbody></table></div>`;
}
