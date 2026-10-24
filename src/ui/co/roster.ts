// 단원 명단과 편성표: 엑셀처럼 한 줄에 한 사람. 머리글을 누르면 정렬한다.
// 인원 창의 명단 · 지원자 명단과, 출정의 편성표(조 요약 줄 + 배치 칸)를 그린다. 상태를 쓰지 않고 난수도 쓰지 않는다
import { type Ours, awayIds, dayAbs, sortieOf, stateOf, teamReady, CO, FLOORS, type Person, type Plan, type World, candPrice, candNow, hirePrice, boughtOf, cohesion, hqLv, mapOf, personWage, roomOf, teamOdds, teamPots, teamTorch, teamFood, teamMend, foodDays, clamp, tierOf, torchRate, torchOdds, segRate, MISSIONS, MISSION_NAME, type Mission, us, drillGain, isRook, weakShare, synTags, teamSlots, synOf, hidSeen, grOf, eligible, promoteDue, winsFrom, teamFx, sqLv, sqOf, sqCost, capOf, chOf, isLeader, type Team, zoneAt, zoneKnown, zoneWay, zoneRate, teamDays } from '../../core/company';
import { type Zone, type ZoneKind, lvOf, zonesOn } from '../../core/zones';
import { stepper } from './view';
import { type Day, evOf } from '../../core/expedition';
import { floorMons } from '../../core/company';
import { DEX, badSure } from '../../core/dex';
import { GEARS, GRADE_N, HIDDEN, PAIR_CLASS, TRAITS, WEAK_KEYS } from '../../core/data';
import { el } from './icons';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
const GEAR_NAMES = GEARS.filter(g => g !== '일반');
export const nameOf = (p: Person) => p.n || `${p.c} ${p.id}`;
// 표시 등급 (우리 길드가 부여한 자격. 실제 실력은 보이지 않는다)
export const tierHtml = (p: Person) => { const g = grOf(p); return `<span class="tier t${g}" title="등급 ${GRADE_N[g]} · 급여 ${CO.TIER_WAGE[g]}G · 계약금 ×${CO.TIER_COST[g]}"><span class="pips">${'<i></i>'.repeat(5)}</span><em>${GRADE_N[g]}</em></span>`; };
// 진급 예정: 기록이 자격 조건을 채웠다 (자격증을 주면 그 등급으로, 미루면 불만)
export const dueHtml = (p: Person) => (promoteDue(p) ? ` <button type="button" class="tog sm due" data-act="promote" data-id="${p.id}" title="기록이 ${GRADE_N[eligible(p)]} 자격을 채웠다 · 자격증을 주면 급여 ${CO.TIER_WAGE[eligible(p)]}G · 미루면 달마다 불만">자격 → ${GRADE_N[eligible(p)]}</button>` : '');
// 불만 칸 (CO.GRUDGE_MAX칸이 차면 그달 첫머리에 떠난다)
export const gdHtml = (p: Person) => (p.gd ? `<span class="gd" title="불만 ${p.gd}/${CO.GRUDGE_MAX} · 한 칸마다 성공 −${Math.round(CO.GRUDGE_PEN * 100)}%p · 다 차면 떠남">${'<i class="on"></i>'.repeat(Math.min(p.gd, CO.GRUDGE_MAX))}${'<i></i>'.repeat(Math.max(0, CO.GRUDGE_MAX - p.gd))}</span>` : '<span class="dim">–</span>');
// 기대 대비 추세: 최근 석 달 · 그 전 석 달 (달마다 남긴 누적 기록의 차, %p)
function trendOf(p: Person) {
  const h = p.sh || [], n = h.length, d = (a?: number[], b?: number[]) => (a && b && a[0] - b[0] > 0 ? Math.round(((a[1] - b[1]) - ((a[2] || 0) - (b[2] || 0))) / (a[0] - b[0]) * 100) : null);
  return { last: n ? d(h[n - 1], n > 3 ? h[n - 4] : [0, 0, 0]) : null, prev: n > 3 ? d(h[n - 4], n > 6 ? h[n - 7] : [0, 0, 0]) : null };
}
const sgnP = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v)}`;
export const trendHtml = (p: Person) => { const t = trendOf(p); if (t.last == null) return '<span class="dim">–</span>'; return `<span class="luck ${t.last >= 5 ? 'up' : t.last <= -5 ? 'dn' : ''}" title="기대 대비 (성공 비율 − 기대 비율) · 최근 석 달${t.prev != null ? ' · 그 전 석 달' : ''}">${sgnP(t.last)}</span>${t.prev != null ? `<small class="dim"> · ${sgnP(t.prev)}</small>` : ''}`; };
// 이력서 · 기록 한 줄: 층마다 해낸/나선 (예: 1층 9/12)
const recLine = (n?: number[], w?: number[]) => (n && n.some(Boolean) ? n.map((k, f) => (k ? `${FLOORS[f].name} ${(w && w[f]) || 0}/${k}` : '')).filter(Boolean).join(' · ') : '');
export const resumeHtml = (p: Person) => recLine(p.pn, p.pw) || `<span class="dim">미궁 이력 없음</span>`;
// 개인 기록 카드: 이력서와 우리 기록, 다음 자격 조건, 기대 대비, 진급 · 부상 이력
function cardHtml(p: Person, cols: number) { return `<tr class="card"><td colspan="${cols}">${pcardHtml(p)}</td></tr>`; }
export function pcardHtml(p: Person) {
  const g = grOf(p), e = eligible(p), next = CO.GRADE_REQ[Math.min(4, Math.max(g, e) + 1)], nf = next ? next[0] : 0;
  const nextT = Math.max(g, e) >= 4 ? '더 오를 등급이 없다' : `다음 ${GRADE_N[Math.max(g, e) + 1]}: ${nf ? `${FLOORS[nf].name} 이상에서 ` : ''}${next[1]}번 성공 (지금 ${winsFrom(p, nf)})`;
  const r = p.sg && p.sg[0] ? `성공 비율 ${Math.round(p.sg[1] / p.sg[0] * 100)}% · 기대 ${Math.round((p.sg[2] || 0) / p.sg[0] * 100)}% (구간 ${p.sg[0]})` : '아직 나선 구간 없음';
  return `<div class="pcard">
    <div><small>이력서</small><b>${esc(p.job || '–')}</b><span>${resumeHtml(p)}</span></div>
    <div><small>우리 기록</small><b>함께한 ${p.mo || 0}달 · 다친 ${p.hc || 0}번</b><span>${recLine(p.rn, p.rw) || '<span class="dim">아직 다녀온 탐사 없음</span>'}</span></div>
    <div><small>자격</small><b>${GRADE_N[g]}${e > g ? ` → ${GRADE_N[e]} 자격` : ''}</b><span>${nextT}</span></div>
    <div><small>기대 대비</small><b>${r}</b><span>${(p.gh || []).map(([m, k]) => `${m}월 ${GRADE_N[k]}`).join(' · ') || '진급 이력 없음'}</span></div>
  </div>`;
}
export const traitHtml = (p: Person) => (p.tr ? `<span class="trait" title="${esc(TRAITS[p.tr] || '')}">${p.tr}</span>` : '')
  + (hidSeen(p) && p.hd !== '무난' ? `<span class="trait hid ${(HIDDEN[p.hd!] || { v: 0 }).v > 0 ? 'up' : 'dn'}" title="숨은 기질 · ${esc((HIDDEN[p.hd!] || { t: '' }).t)}">${p.hd}</span>` : '');
// 임무 적성 · 해낸 비율(나선 구간 중)
export const aptHtml = (p: Person) => (p.apt ? `<span class="ms-tag ${p.apt}" title="${MISSION_NAME[p.apt]} 사건에서 성공 +${Math.round(CO.APT_SUCC * 100)}%p">${MISSION_NAME[p.apt]}</span>` : '<span class="dim">–</span>');
// 카리스마 (조장이 되면 조 크기 한도 = 카리스마 + 1), 조장 꼬리표, 조장 자리 요구
export const chHtml = (W: World, p: Person) => `<span class="ch" title="카리스마 ${chOf(p)} · 조장이 되면 ${capOf(p)}명 조${chOf(p) <= CO.SMALL_CH ? ' · 소수 조 덤 (은신 · 채집 · 흔적)' : ''}">${'<i class="on"></i>'.repeat(chOf(p))}${'<i></i>'.repeat(5 - chOf(p))}</span>${isLeader(us(W), p.id) ? ' <small class="ld-b">조장</small>' : ''}${p.dm === 'lead' ? ` <small class="dm-b" title="조장 자리를 바란다 · 조장이 아니면 그믐마다 불만 한 칸">조장 요구</small>` : ''}`;
const rateOf = (p: Person) => (p.sg && p.sg[0] ? p.sg[1] / p.sg[0] : -1);
// 해낸 비율과 기대 비율(누적): 기대보다 꾸준히 낫거나 못하면 운이 아니라 사람 탓일 수 있다
export const rateHtml = (p: Person) => {
  if (!p.sg || !p.sg[0]) return '<span class="dim">–</span>';
  const r = Math.round(rateOf(p) * 100), e = p.sg[2] != null ? Math.round(p.sg[2] / p.sg[0] * 100) : null, d = e == null ? 0 : r - e;
  return `${r}%${e == null ? '' : `<small class="luck ${d >= 5 ? 'up' : d <= -5 ? 'dn' : ''}" title="기대 ${e}% · 나선 구간 ${p.sg[0]}"> ${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)}</small>`}`;
};
// 귀환 줄: 해낸 구간과 기대(행정관이 아는 것만으로 셈한 확률의 합)의 차. 조원마다는 마우스를 올리면
export function luckHtml(r: Ours) {
  if (!r.sn || !r.se || !r.sw) return '';
  const n = r.sw.reduce((a, b) => a + b, 0), e = r.se.reduce((a, b) => a + b, 0), d = n - e;
  const who = r.sn.map((k, m) => (k ? `${(r.nm || [])[m] || `${m + 1}번`} ${r.sw![m]}/${k} · 기대 ${r.se![m].toFixed(1)} (${r.sw![m] - r.se![m] >= 0 ? '+' : '−'}${Math.abs(r.sw![m] - r.se![m]).toFixed(1)})` : '')).filter(Boolean).join('\n');
  return `<span class="luck ${d >= 1 ? 'up' : d <= -1 ? 'dn' : ''}" title="${esc(who)}">성공 ${n} · 기대 ${e.toFixed(1)} (${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)})</span>`;
}
const exCell = (p: Person, f: number, hl: boolean) => { const v = (p.ex && p.ex[f]) || 0; return `<td class="n ex${hl ? ' hl' : ''}">${v ? `<i style="width:${Math.round(v * 0.36)}px"></i>${v}` : '<span class="dim">–</span>'}</td>`; };

// 정렬: ui.sort는 "열:방향" (방향 1 오름 · -1 내림). 실력 · 경험 · 해낸 수는 처음 누르면 높은 순
export const DESC_FIRST = ['gr', 'ch', 'wins', 'gd', 'trend', 'rate', 'ex0', 'ex1', 'ex2', 'ex3', 'ex4', 'wage', 'bond'];
export function sortKey(s: string | undefined, dflt: string) { const [k, d] = (s || dflt).split(':'); return { k, d: +d || 1 }; }
function sortRows<T extends { p: Person }>(rows: T[], k: string, d: number, val: (r: T, k: string) => number | string) {
  return [...rows].sort((a, b) => { const x = val(a, k), y = val(b, k); return (x > y ? 1 : x < y ? -1 : a.p.id - b.p.id) * d; });
}
const pval = (p: Person, k: string): number | string =>
  k === 'name' ? nameOf(p) : k === 'cls' ? p.c : k === 'gr' ? grOf(p) * 10 + eligible(p) : k === 'ch' ? chOf(p) * 2 + (p.dm ? 1 : 0) : k === 'tr' ? p.tr || '' : k === 'wins' ? p.wins || 0 : k === 'apt' ? p.apt || '' : k === 'gd' ? p.gd || 0 : k === 'trend' ? trendOf(p).last ?? -999 : k === 'rate' ? rateOf(p) : k === 'wage' ? personWage(p) : k === 'st' ? (p.hurt ? 1 : 0)
    : k.startsWith('ex') ? (p.ex && p.ex[+k.slice(2)]) || 0 : 0;
const th = (k: string, name: string, cur: { k: string; d: number }, scope: string, cls = '') =>
  `<th class="srt${cls ? ' ' + cls : ''}${cur.k === k ? (cur.d > 0 ? ' asc' : ' desc') : ''}" data-act="sort" data-scope="${scope}" data-k="${k}" aria-sort="${cur.k === k ? (cur.d > 0 ? 'ascending' : 'descending') : 'none'}" tabindex="0" role="columnheader">${name}</th>`;

// 인원 창의 명단
// who: 기록 카드를 펼친 단원 (이름을 누르면)
export function rosterHtml(W: World, sort?: string, raw?: Plan, who?: number) {
  const out = (raw && raw.fire) || [];
  const c = us(W), crew = c.crew || [], cur = sortKey(sort, 'gr:-1'), open = FLOORS.slice(0, W.unlocked).map((_, f) => f), cols = 12 + open.length;
  const rows = sortRows(crew.map(p => ({ p })), cur.k, cur.d, (r, k) => pval(r.p, k));
  const tiers = GRADE_N.map((_, t) => crew.filter(p => grOf(p) === t).length), due = crew.filter(promoteDue).length;
  return `<div class="rs-sum">${GRADE_N.map((n, t) => (tiers[t] ? `<span>${n} <b>${tiers[t]}</b></span>` : '')).join('')}${due ? `<span class="due-n">진급 예정 <b>${due}</b></span>` : ''}<span>급여 합 <b>${fmt(crew.reduce((a, p) => a + personWage(p), 0))}G</b> <small class="dim">(관리비 따로)</small></span></div>
    <div class="tw"><table class="grid crewt"><thead><tr>${th('name', '이름', cur, 'rs')}${th('cls', '직업', cur, 'rs')}${th('gr', '등급', cur, 'rs')}${th('tr', '특성', cur, 'rs')}${th('apt', '적성', cur, 'rs')}${th('ch', '카리스마', cur, 'rs')}${open.map(f => th('ex' + f, FLOORS[f].name + ' 경험', cur, 'rs', 'n')).join('')}${th('rate', '성공 비율', cur, 'rs', 'n')}${th('trend', '추세', cur, 'rs', 'n')}${th('gd', '불만', cur, 'rs')}${th('st', '상태', cur, 'rs')}${th('wage', '급여', cur, 'rs', 'n')}<th title="다음 날 아침 떠남 · 위로금 ${CO.FIRE_PAY}달치 급여 (탐사 중인 사람은 돌아온 뒤)">해고</th></tr></thead>
    <tbody>${rows.map(({ p }) => `<tr class="${[p.hurt || out.includes(p.id) ? 'away' : '', who === p.id ? 'open' : ''].filter(Boolean).join(' ')}"><td class="nm">${p.lead ? '<span class="lead-b" title="단장: 죽지 않고, 크게 다치면 두 달 쉰다. 단장 조사를 맡는다">단장</span>' : ''}<button type="button" class="link who" data-act="who" data-id="${p.id}" aria-expanded="${who === p.id}" title="기록 카드">${esc(nameOf(p))}</button></td><td class="cn">${p.c}</td><td>${tierHtml(p)}${dueHtml(p)}</td><td>${traitHtml(p)}</td><td>${aptHtml(p)}</td><td>${chHtml(W, p)}</td>${open.map(f => exCell(p, f, false)).join('')}<td class="n" title="나선 구간 중 성공 비율 · 기대와의 차">${rateHtml(p)}</td><td class="n">${trendHtml(p)}</td><td>${gdHtml(p)}</td><td class="st">${p.hurt ? `<span class="hurt">부상 · ${p.hurt}일 쉼</span>` : ''}</td><td class="n">${personWage(p)}</td><td>${p.lead ? '' : `<button type="button" class="tog sm" data-act="fire" data-id="${p.id}" aria-pressed="${out.includes(p.id)}" title="위로금 ${Math.round(personWage(p) * CO.FIRE_PAY)}G">${out.includes(p.id) ? '내보냄' : '해고'}</button>`}</td></tr>${who === p.id ? cardHtml(p, cols) : ''}`).join('')}</tbody></table></div>`;
}

// 지원자 명단: 오늘까지 찾아온 사람. 계약하면 계약금이 바로 나가고 다음 날 아침 들어온다 (그날 안에는 물릴 수 있다)
export function candHtml(W: World, _raw: Plan, sort?: string) {
  const c = us(W), Q = c.hireQ || [], room = roomOf(c), cur = sortKey(sort, 'gr:-1'), rp = hirePrice(W), day = W.day || 1;
  const rows = sortRows([...Q.map(p => ({ p, q: true })), ...candNow(W).map(p => ({ p, q: false }))], cur.k, cur.d, (r, k) => (k === 'price' ? candPrice(r.p, rp) : pval(r.p, k)));
  const B = boughtOf(W), got = (B.hired || []).length, fresh = candNow(W).filter(p => (p.ad || 1) === day).length;
  return `<div class="tw"><table class="grid crewt cand"><thead><tr>${th('name', '이름', cur, 'cd')}${th('cls', '직업', cur, 'cd')}<th>이력서</th>${th('gr', '자격', cur, 'cd')}${th('tr', '특성', cur, 'cd')}${th('apt', '적성', cur, 'cd')}${th('ch', '카리스마', cur, 'cd')}${th('price', '계약금', cur, 'cd', 'n')}${th('wage', '급여', cur, 'cd', 'n')}<th>계약</th></tr></thead>
    <tbody>${rows.map(({ p, q }) => { const full = !q && room <= 0, nu = !q && (p.ad || 1) === day && day > 1, e = eligible(p), low = !q && e > 0;
      // (낮춰 계약: 자격보다 한 단계 아래 등급으로. 싸지만 들어오자마자 진급 예정자라 불만이 쌓인다)
      const lowP = low ? Math.round(candPrice({ ...p, gr: e - 1 }, rp)) : 0;
      return `<tr${q ? ' class="on"' : ''}><td class="nm">${esc(nameOf(p))}${nu ? ' <small class="new-b">오늘</small>' : ''}<br><small class="dim">${esc(p.job || '')}</small></td><td class="cn">${p.c}</td><td class="rsm">${resumeHtml(p)}</td><td>${tierHtml(p)}${q && grOf(p) < e ? ' <small class="neg">낮춰 계약</small>' : ''}</td><td>${traitHtml(p)}</td><td>${aptHtml(p)}</td><td>${chHtml(W, p)}</td><td class="n">${fmt(candPrice(p, rp))}</td><td class="n">${personWage(p)}</td>
        <td><button type="button" class="tog" data-act="hire" data-id="${p.id}" aria-pressed="${q}"${full ? ' disabled title="빈 침상이 모자라요"' : ''}>${q ? '내일 합류 · 물리기' : '계약'}</button>${low && !full ? ` <button type="button" class="tog sm" data-act="hire" data-low="1" data-id="${p.id}" title="${GRADE_N[e - 1]}로 계약 · 계약금 ${fmt(lowP)}G · 들어오자마자 진급 예정자 (미루면 불만)">낮춰 ${GRADE_N[e - 1]}</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="10" class="dim">아직 찾아온 사람이 없어요</td></tr>'}</tbody></table></div>
    <p class="note">${got ? `이번 달 계약 ${got}명 · 계약금 ${fmt(B.cost.recruit || 0)}G` : '이번 달 계약 없음'}${fresh && day > 1 ? ` · 오늘 새로 ${fresh}명` : ''} · 빈 침상 ${room}개 · 1인 ${fmt(rp)}G부터 (드문 직업 · 등급만큼 더). 등급은 이력서의 기록으로 우리가 매긴다. 지원자는 그믐까지 며칠마다 찾아오고, 그달 계약하지 않은 사람은 다른 용병단으로 가요.</p>`;
}

// 짐 칸: 한 사람 SLOT_PP칸. 쓰는 것(횃불 주황 · 포션 빨강 · 식량 초록 · 정비 도구 회색)이 앞에서부터, 채집품(금빛)은 뒤에서부터 찬다
// 탐사 구간 칸: 사건으로 색(채집 지점 · 조우 · 흔적), 해냈으면 채운 칸 · 못 해냈으면 빈 칸, 위기 ! · 사망 †
export const EV_NAME = { g: '채집 지점', f: '조우', t: '흔적' } as const;
export const dayCls = (d: Day) => `${d.win ? 'w' : 'x'} e${evOf(d)}${d.d ? ' dead' : ''}`;
export const dayMark = (d: Day) => (d.d ? '†' : d.cr ? '!' : '');
export const dayTip = (d: Day, j: number) => `${d.dd ?? j + 1}일 · ${d.mon ? `${d.am ? '들킴 · ' : ''}${d.mon}` : EV_NAME[evOf(d)]} · ${d.mon ? (d.win ? '승' : '패') : d.win ? '성공' : '실패'} ${d.k}/${d.n}${d.loot ? ` · 채집품 ${d.loot}칸` : ''}${d.mats.length ? ` · ${d.mats.map(([m, c]) => `${m} ×${c}`).join(', ')}` : ''}${d.cr ? ` · 부상 주사위 ${d.cr}${d.sv ? ` · 포션으로 살림 ${d.sv}` : ''}` : ''}`;
export const DAY_LEGEND = '<i class="w eg"></i>채집 지점 <i class="w ef"></i>조우 <i class="w et"></i>흔적 · 채운 칸 성공 · 빈 칸 실패 · ! 부상 · † 사망';
// 실어 온 것(채집품 금빛 · 전리품 장밋빛 · 지도 기록 푸른빛)은 뒤에서부터 찬다
export function packBar(slots: number, torch: number, pots: number, loot = 0, food = 0, mend = 0, mat = 0, map = 0) {
  const l = Math.min(slots, Math.round(loot)), m = Math.min(slots - l, Math.round(mat)), n = Math.min(slots - l - m, Math.round(map)), got = l + m + n;
  const t = Math.min(torch, slots - got), p = Math.min(pots, slots - got - t), fd = Math.min(Math.ceil(food / CO.FOOD_SLOT - 1e-9), slots - got - t - p), o = Math.min(mend, slots - got - t - p - fd), free = slots - got - t - p - fd - o;
  // 앞에서부터 쓰는 것(횃불 · 포션 · 식량 · 정비 도구), 빈 칸, 그리고 실어 온 것은 뒤에서부터 찬다
  const cells = [...Array(t).fill('t'), ...Array(p).fill('p'), ...Array(fd).fill('f'), ...Array(o).fill('o'), ...Array(free).fill('s'), ...Array(n).fill('n'), ...Array(m).fill('m'), ...Array(l).fill('l')];
  return `<span class="pack" role="img" aria-label="짐 ${slots}칸: 횃불 ${t} · 포션 ${p} · 식량 ${fd} · 정비 도구 ${o} · 빈 칸 ${free}${l ? ` · 채집품 ${l}` : ''}${m ? ` · 전리품 ${m}` : ''}${n ? ` · 지도 기록 ${n}` : ''}">${cells.map(k => `<i class="${k}"></i>`).join('')}</span>`;
}

// 보내기 단추: 누르면 보낼 예정(다음 날 단추를 누르면 떠난다), 다시 누르면 거둔다
export const sendBtn = (T: Team, t: number) => `<button type="button" class="send${T.go ? ' on' : ''}" data-act="send" data-t="${t}" aria-pressed="${!!T.go}" title="${T.go ? '다음 날 아침 떠남 · 다시 누르면 거둠' : `${FLOORS[T.f].name} ${teamDays(T)}일 · 다음 날을 누르면 떠난다`}">${T.go ? '보낼 예정 ✓' : '보내기'}</button>`;
// ---------- 출정 편성표 ----------
// 조 장비: 단계 칸(0 ~ 5)과 올리기 단추 (조가 본부에 있을 때. 값은 조장의 조 크기 한도에 비례, 그믐마다 장부가의 SQ_KEEP가 유지비)
export function sqHtml(W: World, T: Team, t: number, who: Person[], big = false) {
  const c = us(W), lv = sqLv(c, T), v = sqCost(c, T), out = awayIds(W), away = T.m.some(id => id != null && out.has(id)), sq = sqOf(c, T.sq);
  const book = sq ? sq.paid.reduce((a, b) => a + b, 0) : 0;
  const tip = `조 장비 ${lv}단계 · 성공 +${Math.round(lv * CO.SQ_SUCC * 100)}%p · 부상 ×${Math.pow(CO.SQ_INJ, lv).toFixed(2)}${lv >= 2 ? ` · 짐 +${lv >= 4 ? 2 : 1}칸` : ''}${book ? ` · 장부가 ${fmt(book)}G · 유지비 월 ${fmt(Math.round(book * CO.SQ_KEEP))}G` : ''}`;
  const btn = !who.length || !v ? '' : `<button type="button" class="tog sm squp${big ? ' big' : ''}" data-act="sqUp" data-t="${t}"${away || W.draft ? ' disabled' : ''} title="${away ? '미궁에서 돌아온 뒤에 올린다' : `다음 단계 · 효과는 다음 출정부터 · 유지비 월 +${fmt(Math.round(v * CO.SQ_KEEP))}G`}">장비 ${lv + 1}단계 ${fmt(v)}G</button>`;
  return `<span class="sqlv" title="${esc(tip)}">${Array.from({ length: CO.GEAR_UP.length }, (_, k) => `<i${k < lv ? ' class="on"' : ''}></i>`).join('')}</span>${btn}`;
}
// 임무: 구간마다 사건의 비중 (채집 지점 · 조우 · 흔적)
// 구역의 하는 일 (이해도 1단계부터 보인다)
export const KIND_NAME: Record<ZoneKind, string> = { ore: '채집터', den: '사냥터', mix: '섞인 곳', stair: '계단' };
export const kindOf = (z: Zone) => (lvOf(z) >= 1 || z.f === 0 && z.xp > 0 ? KIND_NAME[z.kind] : '?');
// 편성표의 구역 칸: 그 층의 구역(지도에 있는 것) · 거리 · 하는 일 · 이해도 단계
function zoneSel(W: World, T: Team, t: number) {
  const zs = zonesOn(W.zones, T.f).filter(z => zoneKnown(W, z)); if (!zs.length) return '';
  return `<select data-k="tzone" data-i="${t}" aria-label="${t + 1}조 구역">${zs.map(z => `<option value="${z.id}"${T.z === z.id ? ' selected' : ''}>${esc(z.nm)} · 거리 ${z.r} · ${lvOf(z) >= 1 ? KIND_NAME[z.kind] : '?'} · 이해 ${lvOf(z)}</option>`).join('')}</select>`;
}
// 일할 날 또는 목표량 (목표량이면 보수적인 산출로 날을 잡는다). 아래에 오가는 날 · 산출 예측
function workCell(W: World, P: Plan, T: Team, t: number) {
  const z = zoneAt(W, T.z); if (!z) return '';
  const way = zoneWay(W, z), r = zoneRate(W, P, T), d = T.days || CO.TRIP_DAYS[T.f], goal = !!T.goal;
  const mode = `<span class="seg sm" role="group" aria-label="${t + 1}조 기준"><button type="button" data-act="tmode" data-t="${t}" data-m="days" aria-pressed="${!goal}" title="일할 날을 정한다">날</button><button type="button" data-act="tmode" data-t="${t}" data-m="goal" aria-pressed="${goal}" title="목표량을 정하면 보수적인 산출(범위의 아래)로 날을 잡고, 채우면 일찍 돌아선다">목표</button></span>`;
  const st = goal ? stepper('tgoal', t, T.goal!, `${t + 1}조 목표량 (채집품)`) : stepper('tdays', t, d, `${t + 1}조 일할 날`);
  return `${mode}${st}<small class="dim" title="오가는 날은 먹기만 한다 · 산출은 우리가 아는 범위 (이해도가 오를수록 좁아진다)">${way ? `오감 ${2 * way}일 + ` : ''}일 ${d}일 · ${Math.round(r.lo * d)}~${Math.round(r.hi * d)}개</small>`;
}
const MISSION_TIP: Record<Mission, string> = Object.fromEntries((['gather', 'hunt', 'scout'] as Mission[]).map(k => [k, `${{ gather: '채집: 몬스터를 피해 채집 지점 위주 · 안전', hunt: '사냥: 조우 위주 · 전리품과 도감', scout: '탐색: 흔적을 따라 지도 위주 · 흔적에서 다칠 수 있음' }[k]} · 채집 지점 ${Math.round(CO.MISSION_W[k][0] * 100)}% · 조우 ${Math.round(CO.MISSION_W[k][1] * 100)}% · 흔적 ${Math.round(CO.MISSION_W[k][2] * 100)}%`])) as Record<Mission, string>;
// 조 요약 줄: 층, 사람 수, 직업, 조직력, 성공률 예측, 장비, 살필 것. 아래 명단의 배치 칸으로 사람을 넣고 뺀다
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
    if (S) { const left = S.d1 - dayAbs(W); return `<span class="go-st out">탐사 중<small>${left <= 0 ? '오늘쯤' : left === 1 ? '내일' : `${left}일 뒤`} 귀환</small></span>`; }
    if (teamReady(W, T)) return sendBtn(T, t);
    const why = ids.map(id => byId.get(id)).filter((p): p is Person => !!p).map(p => stateOf(W, p, out));
    return `<span class="go-st">${!ids.length ? '빈 조' : why.includes('rest') ? '쉬는 날' : why.includes('hurt') ? '부상' : '기다림'}</span>`;
  };
  const sum = teams.map((T, t) => {
    const who = whoOf(t), crowd = P.parties[T.f] + P.hire[T.f] + others(T.f), o = teamOdds(W, c, T.f, who, P.pots[T.f], crowd, T);
    const pk = teamPots(P, T), tk = teamTorch(P, T), fd = teamFood(P, T), md = teamMend(P, T), fdays = T.food != null ? clamp(Math.floor(T.food), 0, CO.DAYS) : foodDays(P, T.f), dark = torchOdds(T.f, Math.min(tk, teamSlots(who)), torchRate(T.f, o.u)).dark, ms = T.mission || 'gather';
    const bonded = cohesion(who) > 0, fresh = bonded ? who.filter(p => who.every(x => x.id === p.id || !((p.mt && p.mt[x.id]) || 0))).length : 0;
    // 확정한 역효과: 그 층 몬스터의 역효과 장비를 들었거나, 그 속성을 맡는 직업이 맨몸으로 끼었으면 (단장이 있으면 괜찮다)
    const badW = synOf(who).lead ? [] : floorMons(W, T.f).flatMap(M => { const b = badSure((W.dex || {})[M.name]); if (!b) return []; const nm = b.slice(2);
      return T.g === b ? [`역효과 ${el(b, { bad: true, tip: `역효과 ${nm} 장비` })}장비`] : who.some(p => PAIR_CLASS[nm] === p.c) ? [`역효과 ${el(b, { bad: true, tip: `역효과 ${nm}` })}${PAIR_CLASS[nm]} 맨몸`] : []; });
    const L = who[0], X = teamFx(who, sqLv(c, T)), sq = sqOf(c, T.sq), temp = sq && sq.ld != null && L && sq.ld !== L.id && crew.some(p => p.id === sq.ld);
    const warn = [...new Set(badW),...(who.length < X.cap ? [`빈자리 ${X.cap - who.length}`] : []), ...(fresh ? [`새 얼굴 ${fresh}`] : []), ...(X.gap ? ['조장 등급이 낮음'] : []), ...(temp ? ['임시 조장'] : []),
      ...(T.f > 0 && o.u < 50 && who.some(p => p.tr === '새가슴') ? ['새가슴'] : [])];
    const best = Math.max(0, ...who.map(p => (p.ex && p.ex[T.f]) || 0)), m = Math.round(mapOf(c, T.f)), guide = who.some(p => p.tr === '길잡이');
    const uTip = `지도 ${m}${best ? ` + 고참 경험 ${Math.round(Math.min(CO.UND_EX, best / 4))}` : ''}${guide ? ` + 길잡이 ${CO.UND_GUIDE}` : ''} · 성공 ${o.U.succ >= 0 ? '+' : '−'}${Math.round(Math.abs(o.U.succ) * 100)}%p · 위기 ×${o.U.crisis.toFixed(2)} · 캐 오는 양 ×${o.U.loot.toFixed(2)}`;
    return `<tr class="t${t % 8}"><td><b>${t + 1}조</b>${goCell(T, t)}</td>
      <td class="stk"><span class="seg sm" role="group" aria-label="${t + 1}조 층">${open.map(f => `<button type="button" data-act="tfloor" data-t="${t}" data-f="${f}" aria-pressed="${T.f === f}">${FLOORS[f].name}</button>`).join('')}</span>
      ${W.zones ? zoneSel(W, T, t) : `<span class="seg sm ms" role="group" aria-label="${t + 1}조 임무">${MISSIONS.map(k => `<button type="button" data-act="tmission" data-t="${t}" data-m="${k}" aria-pressed="${ms === k}" title="${MISSION_TIP[k]}">${MISSION_NAME[k]}</button>`).join('')}</span>`}</td>
      <td class="n stk"><span>${who.length}/${X.cap}</span>${L ? `<select data-k="tlead" data-i="${t}" aria-label="${t + 1}조 조장" title="조장: 카리스마 + 1이 조 크기 한도${sq && sq.gear ? ' · 원래 조장이 있는데 바꾸면 조 장비 한 단계를 잃는다' : ''}">${who.map(p => `<option value="${p.id}"${p.id === L.id ? ' selected' : ''}>${esc(nameOf(p))} ${'●'.repeat(chOf(p))}</option>`).join('')}</select>` : ''}</td><td>${sqHtml(W, T, t, who)}<span class="cl">${who.map(p => `<span${p.lead ? ' class="lead" title="단장"' : ''}>${p.lead ? '★' : ''}${p.c}</span>`).join('')}</span>${(() => { const ks = WEAK_KEYS.map(k => [k, weakShare(k, who.map(p => p.c), T.g ? [T.g] : [])] as const).filter(([, v]) => v > 0); return ks.length ? `<small class="dim wkn" title="찌를 수 있는 약점: 직업 둘이나 장비 한 벌이면 다, 직업 하나면 ¼">약점 ${ks.map(([k, v]) => `${el(k)}${v < 1 ? (v <= 0.25 ? '¼' : '½') : ''}`).join(' ')}</small>` : ''; })()}${(() => { const tg = synTags(who); return tg.length ? `<span class="syn">${tg.map(([fx, by]) => `<span title="${by}">${fx}</span>`).join('')}</span>` : ''; })()}</td>
      <td class="stk"><span class="ubar" title="${esc(uTip)}"><i><b style="width:${o.u}%"></b></i><span class="n">${o.u}</span></span>
      <span class="cobar" title="조원 둘씩 함께 나간 달의 평균 (${CO.CO_MAX}달이 끝)"><i><b style="width:${Math.round(o.coh * 100)}%"></b></i><span class="n">${Math.round(o.coh * 100)}</span><small class="dim">+${Math.round(o.coh * CO.CO_SUCC * 100)}%p</small></span></td>
      <td class="n"><b>${Math.round(o.p * 100)}%</b></td>
      <td>${stepper('tpots', t, pk, `${t + 1}조 포션`)}<small class="dim" title="실패한 날 부상 주사위에 걸릴 확률 (조원 등급 평균으로 예측) · 걸리면 포션 한 병이 먼저 막고, 없으면 다치고, 다친 채 또 걸리면 죽는다">부상 ${Math.round(Math.min(0.9, (CO.INJ_BASE + CO.INJ_K * FLOORS[T.f].risk) * o.U.crisis * (who.length ? who.reduce((x, p) => x + CO.INJ_TIER[grOf(p)], 0) / who.length : 1)) * 100)}%</small></td>
      ${T.z != null ? `<td class="stk">${workCell(W, P, T, t)}</td>
      <td>${stepper('tmargin', t, T.margin || 0, `${t + 1}조 여유 (며칠치 더)`)}<small class="dim" title="보급: 한 사람 하루 하나(오가는 날 포함) · ${CO.FOOD_SLOT}개가 짐 한 칸 · 굶은 날 성공 −${Math.round(CO.HUNGER_PEN * 100)}%p · 남은 것은 검문소가 태운다">보급 ${fd}개</small></td>` : `<td>${stepper('ttorch', t, tk, `${t + 1}조 횃불`)}<small class="${dark >= 0.25 ? 'neg' : 'dim'}" title="첫 구간 하나, 그 뒤 구간마다 ${Math.round(segRate(T.f, torchRate(T.f, o.u)) * 100)}% 확률로 하나 · 다 쓰면 돌아섬">돌아섬 ${Math.round(dark * 100)}%</small></td>
      <td>${stepper('tfood', t, fdays, `${t + 1}조 식량 (며칠치)`)}<small class="dim" title="한 사람 하루 하나 · ${CO.FOOD_SLOT}개가 짐 한 칸 · 굶은 날 성공 −${Math.round(CO.HUNGER_PEN * 100)}%p">${fd}개</small></td>`}
      <td>${stepper('tmend', t, md, `${t + 1}조 정비 도구`)}</td>
      <td>${packBar(teamSlots(who), tk, pk, 0, fd, md)}</td>
      <td class="stk"><select data-k="teamG" data-i="${t}" aria-label="${t + 1}조 장비"><option value="">섞인 대로</option>${GEAR_NAMES.map(g => `<option value="g:${g}"${T.g === 'g:' + g ? ' selected' : ''}>${g} (${PAIR_CLASS[g]} 대신)</option>`).join('')}</select>
      ${ms === 'hunt' && !W.zones ? `<select data-k="target" data-i="${t}" aria-label="${t + 1}조 노릴 몬스터"><option value="">섞여 만남</option>${floorMons(W, T.f).filter(M => ((W.dex || {})[M.name]?.n || 0) > 0).map(M => { const u = Math.round(((W.dex || {})[M.name]?.u) || 0), ok = u >= DEX.TARGET_AT; return `<option value="${esc(M.name)}"${T.target === M.name ? ' selected' : ''}${ok ? '' : ' disabled'}>${esc(M.name)}${ok ? '' : ` (이해도 ${u}/${DEX.TARGET_AT})`}</option>`; }).join('')}</select>` : ''}</td>
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
    if (!seg) return `<select data-k="assign" data-id="${p.id}" aria-label="${esc(nameOf(p))} 배치">${teams.map((T, k) => `<option value="${k}"${t === k ? ' selected' : ''}${t !== k && whoOf(k).length >= capOf(whoOf(k)[0]) ? ' disabled' : ''}>${k + 1}조 · ${FLOORS[T.f].name}</option>`).join('')}<option value="new">새 조</option><option value="-1"${t == null ? ' selected' : ''}>대기 · 훈련 +${drillGain(c, P, p)}</option></select>`;
    return `<span class="seg asg" role="group" aria-label="${esc(nameOf(p))} 배치">${teams.map((_, k) => `<button type="button" class="k${k % 8}" data-act="assign" data-id="${p.id}" data-t="${k}" aria-pressed="${t === k}"${t !== k && whoOf(k).length >= capOf(whoOf(k)[0]) ? ' disabled' : ''}>${k + 1}조</button>`).join('')}<button type="button" data-act="assign" data-id="${p.id}" data-t="new" title="새 조를 만들어 넣기">+</button><button type="button" class="bn" data-act="assign" data-id="${p.id}" data-t="-1" aria-pressed="${t == null}" title="대기 = 본부 훈련: 이번 달 실력 +${drillGain(c, P, p)}${isRook(p) ? ' · 수습 한 달' : ''} (교관 · 훈련장 단계만큼)">대기</button></span>`;
  };
  const bondTxt = (p: Person) => { const b = bondOf(p); return b < 0 ? '' : b === 0 && whoOf(teamOf.get(p.id)!).length > 1 ? '<span class="fresh">새 얼굴</span>' : `${b.toFixed(b % 1 ? 1 : 0)}달`; };
  return `<div class="tw"><table class="grid tsum"><thead><tr><th>조</th><th title="위: 층 · 아래: 구역 (거리 · 하는 일 · 이해도 단계). 구역이 구간마다 채집 지점 · 조우 · 흔적의 비중을 정한다">층 · 구역</th><th class="n">인원</th><th>직업</th><th title="위: 이해도 (지도 완성도 + 고참 경험 + 길잡이) · 아래: 조직력 (함께 나간 달)">이해도 · 조직력</th><th class="n">성공률</th><th title="위기마다 한 병">포션</th><th title="날: 일할 날을 정한다 · 목표: 목표량을 정하면 보수적인 산출로 날을 잡고 채우면 일찍 돌아선다 (오가는 날은 먹기만 한다)">일할 날 · 목표</th><th title="보급을 며칠치 더 들고 간다 (모자라면 굶는 날 성공 −${Math.round(CO.HUNGER_PEN * 100)}%p · 남은 것은 검문소가 태운다)">여유</th><th title="진 날 하나 써서 무기를 고친다 · 없으면 무뎌져 날마다 성공 −${Math.round(CO.MEND_PEN * 100)}%p씩 쌓임">정비</th><th title="한 사람 ${CO.SLOT_PP}칸 · 횃불(주황) · 포션(빨강) · 식량(초록, ${CO.FOOD_SLOT}개 한 칸) · 정비 도구(회색)이 앞에서부터 · 실어 온 것(채집품 금빛 · 전리품 장밋빛 · 지도 기록 푸른빛)은 뒤에서부터">짐</th><th title="위: 약점 장비 · 아래: 사냥 임무가 노릴 몬스터 (도감 이해도 ${DEX.TARGET_AT}부터 · 노린 몬스터를 더 자주 만나고 채집품이 더 나온다)">장비 · 노릴 몬스터</th><th>살필 것</th></tr></thead>
      <tbody>${sum || `<tr><td colspan="13" class="dim">짠 조가 없어요. 아래 명단의 + 를 눌러 새 조를 만들어요</td></tr>`}<tr class="rest"><td><b>대기</b></td><td colspan="12" class="dim">${bench.filter(p => !p.hurt).length}명${bench.some(p => !p.hurt) ? ` · 본부 훈련 (실력 +${bench.filter(p => !p.hurt).map(p => drillGain(c, P, p)).join(' · +')})` : ''}${bench.some(p => p.hurt) ? ` · 부상 ${bench.filter(p => p.hurt).length}명 쉼` : ''}</td></tr></tbody></table></div>
    <div class="tw"><table class="grid crewt asgn"><thead><tr>${th('name', '이름', cur, 'as')}${th('cls', '직업', cur, 'as')}${th('gr', '등급', cur, 'as')}${th('tr', '특성', cur, 'as')}${open.map(f => th('ex' + f, FLOORS[f].name, cur, 'as', 'n')).join('')}${th('bond', '함께한 달', cur, 'as')}${th('team', '배치', cur, 'as')}</tr></thead>
    <tbody>${rows.map(({ p }) => { const t = teamOf.get(p.id), f = t != null ? teams[t].f : -1;
      return `<tr class="${t != null ? 'k' + (t % 8) : ''}${p.hurt ? ' away' : ''}${t == null && !p.hurt ? ' drill' : ''}"><td class="nm">${p.lead ? '<span class="lead-b" title="단장: 죽지 않고, 크게 다치면 두 달 쉰다. 단장 조사를 맡는다">단장</span>' : ''}${esc(nameOf(p))}</td><td class="cn">${p.c}</td><td>${tierHtml(p)}</td><td>${traitHtml(p)}</td>${open.map(g => exCell(p, g, g === f)).join('')}<td class="bond">${bondTxt(p)}</td><td>${cell(p)}</td></tr>`; }).join('')}</tbody></table></div>`;
}
