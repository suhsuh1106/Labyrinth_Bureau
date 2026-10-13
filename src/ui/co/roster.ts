// 단원 명단과 편성표: 엑셀처럼 한 줄에 한 사람. 머리글을 누르면 정렬한다.
// 인원 창의 명단 · 지원자 명단과, 출정의 편성표(조 요약 줄 + 배치 칸)를 그린다. 상태를 쓰지 않고 난수도 쓰지 않는다
import { CO, FLOORS, type Person, type Plan, type World, candPrice, cohesion, hqLv, mapOf, personWage, recruitPrice, roomOf, teamOdds, teamPots, teamTorch, tierOf, torchRate, tripOdds, us } from '../../core/company';
import { stepper } from './view';
import { floorMons } from '../../core/company';
import { DEX } from '../../core/dex';
import { GEARS, TIER_N, TRAITS } from '../../core/data';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
const GEAR_NAMES = GEARS.filter(g => g !== '일반');
export const nameOf = (p: Person) => p.n || `${p.c} ${p.id}`;
export const tierHtml = (p: Person) => { const t = tierOf(p); return `<span class="tier t${t}" title="실력 ${TIER_N[t]} · 성공 ${CO.TIER_B[t] >= 0 ? '+' : '−'}${Math.round(Math.abs(CO.TIER_B[t]) * 100)}%p"><span class="pips">${'<i></i>'.repeat(5)}</span><em>${TIER_N[t]}</em></span>`; };
export const traitHtml = (p: Person) => (p.tr ? `<span class="trait" title="${esc(TRAITS[p.tr] || '')}">${p.tr}</span>` : '');
const exCell = (p: Person, f: number, hl: boolean) => { const v = (p.ex && p.ex[f]) || 0; return `<td class="n ex${hl ? ' hl' : ''}">${v ? `<i style="width:${Math.round(v * 0.36)}px"></i>${v}` : '<span class="dim">–</span>'}</td>`; };

// 정렬: ui.sort는 "열:방향" (방향 1 오름 · -1 내림). 실력 · 경험 · 해낸 수는 처음 누르면 높은 순
export const DESC_FIRST = ['sk', 'wins', 'ex0', 'ex1', 'ex2', 'ex3', 'ex4', 'wage', 'bond'];
export function sortKey(s: string | undefined, dflt: string) { const [k, d] = (s || dflt).split(':'); return { k, d: +d || 1 }; }
function sortRows<T extends { p: Person }>(rows: T[], k: string, d: number, val: (r: T, k: string) => number | string) {
  return [...rows].sort((a, b) => { const x = val(a, k), y = val(b, k); return (x > y ? 1 : x < y ? -1 : a.p.id - b.p.id) * d; });
}
const pval = (p: Person, k: string): number | string =>
  k === 'name' ? nameOf(p) : k === 'cls' ? p.c : k === 'sk' ? p.sk ?? 40 : k === 'tr' ? p.tr || '' : k === 'wins' ? p.wins || 0 : k === 'wage' ? personWage(p) : k === 'st' ? (p.hurt ? 1 : 0)
    : k.startsWith('ex') ? (p.ex && p.ex[+k.slice(2)]) || 0 : 0;
const th = (k: string, name: string, cur: { k: string; d: number }, scope: string, cls = '') =>
  `<th class="srt${cls ? ' ' + cls : ''}${cur.k === k ? (cur.d > 0 ? ' asc' : ' desc') : ''}" data-act="sort" data-scope="${scope}" data-k="${k}" aria-sort="${cur.k === k ? (cur.d > 0 ? 'ascending' : 'descending') : 'none'}" tabindex="0" role="columnheader">${name}</th>`;

// 인원 창의 명단
export function rosterHtml(W: World, sort?: string) {
  const c = us(W), crew = c.crew || [], cur = sortKey(sort, 'sk:-1'), open = FLOORS.slice(0, W.unlocked).map((_, f) => f);
  const rows = sortRows(crew.map(p => ({ p })), cur.k, cur.d, (r, k) => pval(r.p, k));
  const tiers = TIER_N.map((_, t) => crew.filter(p => tierOf(p) === t).length);
  return `<div class="rs-sum">${TIER_N.map((n, t) => (tiers[t] ? `<span>${n} <b>${tiers[t]}</b></span>` : '')).join('')}<span>급여 합 <b>${fmt(crew.reduce((a, p) => a + personWage(p), 0))}G</b> <small class="dim">(관리비 따로)</small></span></div>
    <div class="tw"><table class="grid crewt"><thead><tr>${th('name', '이름', cur, 'rs')}${th('cls', '직업', cur, 'rs')}${th('sk', '실력', cur, 'rs')}${th('tr', '특성', cur, 'rs')}${open.map(f => th('ex' + f, FLOORS[f].name + ' 경험', cur, 'rs', 'n')).join('')}${th('wins', '해낸 수', cur, 'rs', 'n')}${th('st', '상태', cur, 'rs')}${th('wage', '급여', cur, 'rs', 'n')}</tr></thead>
    <tbody>${rows.map(({ p }) => `<tr${p.hurt ? ' class="away"' : ''}><td class="nm">${p.lead ? '<span class="lead-b" title="단장: 죽지 않고, 크게 다치면 두 달 쉰다. 단장 조사를 맡는다">단장</span>' : ''}${esc(nameOf(p))}</td><td class="cn">${p.c}</td><td>${tierHtml(p)}</td><td>${traitHtml(p)}</td>${open.map(f => exCell(p, f, false)).join('')}<td class="n">${p.wins || 0}</td><td class="st">${p.hurt ? '<span class="hurt">부상 · 다음 달 복귀</span>' : ''}</td><td class="n">${personWage(p)}</td></tr>`).join('')}</tbody></table></div>`;
}

// 지원자 명단: 누르면 고르고(빈 침상까지), 고른 순서대로 들어온다. 다른 용병단과 겹치면 명성 순으로 나뉘어 뒤에 고른 사람부터 빠진다
export function candHtml(W: World, raw: Plan, sort?: string) {
  const c = us(W), cand = W.cand || [], room = roomOf(c), cur = sortKey(sort, 'sk:-1');
  const picks = raw.pick || [], rp = recruitPrice(0, 1);
  const rows = sortRows(cand.map(p => ({ p })), cur.k, cur.d, (r, k) => (k === 'price' ? candPrice(r.p, rp) : pval(r.p, k)));
  const total = picks.map(id => cand.find(x => x.id === id)).filter((x): x is Person => !!x).reduce((a, p) => a + candPrice(p, rp), 0);
  return `<div class="tw"><table class="grid crewt cand"><thead><tr>${th('name', '이름', cur, 'cd')}${th('cls', '직업', cur, 'cd')}${th('sk', '실력', cur, 'cd')}${th('tr', '특성', cur, 'cd')}${th('price', '계약금', cur, 'cd', 'n')}${th('wage', '급여', cur, 'cd', 'n')}<th>뽑기</th></tr></thead>
    <tbody>${rows.map(({ p }) => { const k = picks.indexOf(p.id), on = k >= 0, full = !on && picks.length >= room;
      return `<tr${on ? ' class="on"' : ''}><td class="nm">${p.lead ? '<span class="lead-b" title="단장: 죽지 않고, 크게 다치면 두 달 쉰다. 단장 조사를 맡는다">단장</span>' : ''}${esc(nameOf(p))}</td><td class="cn">${p.c}</td><td>${tierHtml(p)}</td><td>${traitHtml(p)}</td><td class="n">${fmt(candPrice(p, rp))}</td><td class="n">${personWage(p)}</td>
        <td><button type="button" class="tog" data-act="pick" data-id="${p.id}" aria-pressed="${on}"${full ? ' disabled title="빈 침상이 모자라요"' : ''}>${on ? `${k + 1}번째로 뽑기` : '뽑기'}</button></td></tr>`; }).join('') || '<tr><td colspan="7" class="dim">이번 달엔 찾아온 사람이 없어요</td></tr>'}</tbody></table></div>
    <p class="note">${picks.length ? `고른 ${picks.length}명 · 계약금 어림 ${fmt(total)}G` : raw.pick ? '아무도 뽑지 않아요' : `고르지 않으면 빈 침상만큼 기본 편성 직업 순으로 실력 좋은 사람부터 뽑아요`} · 빈 침상 ${room}개. 다른 용병단이 같은 사람을 찾으면 명성이 높은 곳이 먼저고, 찾는 사람이 많으면 계약금이 올라요.${raw.pick ? ' <button type="button" class="link" data-act="auto-recruit">자동으로 뽑기</button>' : ''}</p>`;
}

// 짐 칸: 한 사람 SLOT_PP칸. 횃불(주황) · 포션(빨강)이 먼저 차지하고 빈 칸에 전리품(갈색)을 싣는다. 돌아온 짐은 loot칸이 앞에 찬다
export function packBar(slots: number, torch: number, pots: number, loot = 0) {
  const l = Math.min(slots, Math.round(loot)), t = Math.min(torch, slots - l), p = Math.min(pots, slots - l - t), free = slots - l - t - p;
  const cells = [...Array(l).fill('l'), ...Array(t).fill('t'), ...Array(p).fill('p'), ...Array(free).fill('s')];
  return `<span class="pack" role="img" aria-label="짐 ${slots}칸: ${l ? `전리품 ${l} · ` : ''}횃불 ${t} · 포션 ${p} · 빈 칸 ${free}">${cells.map(k => `<i class="${k}"></i>`).join('')}</span>`;
}

// ---------- 출정 편성표 ----------
// 조 요약 줄: 층, 사람 수, 직업, 조직력, 성공률 어림, 장비, 살필 것. 아래 명단의 배치 칸으로 사람을 넣고 뺀다
export function assignHtml(W: World, P: Plan, others: (f: number) => number, sort?: string) {
  const c = us(W), crew = c.crew || [], byId = new Map(crew.map(p => [p.id, p])), teams = P.teams || [];
  const teamOf = new Map<number, number>(); teams.forEach((T, t) => T.m.forEach(id => { if (id != null) teamOf.set(id, t); }));
  const whoOf = (t: number) => teams[t].m.filter((x): x is number => x != null).map(id => byId.get(id)).filter((x): x is Person => !!x);
  const open = FLOORS.slice(0, W.unlocked).map((_, f) => f);
  const bondOf = (p: Person) => { const t = teamOf.get(p.id); if (t == null) return -1; const mates = whoOf(t).filter(x => x.id !== p.id); return mates.length ? mates.reduce((a, x) => a + Math.min(CO.CO_MAX, (p.mt && p.mt[x.id]) || 0), 0) / mates.length : 0; };
  const sum = teams.map((T, t) => {
    const who = whoOf(t), crowd = P.parties[T.f] + P.hire[T.f] + others(T.f), o = teamOdds(W, c, T.f, who, P.pots[T.f], crowd, T);
    const pk = teamPots(P, T), tk = teamTorch(P, T), dark = tripOdds(Math.min(tk, who.length * CO.SLOT_PP), torchRate(T.f, o.u)).dark;
    const bonded = cohesion(who) > 0, fresh = bonded ? who.filter(p => who.every(x => x.id === p.id || !((p.mt && p.mt[x.id]) || 0))).length : 0;
    const scoutOk = hqLv(c, 'rec') >= 2 && who.length <= 3;
    const warn = [...(who.length < CO.PARTY && !T.scout ? [`빈자리 ${CO.PARTY - who.length}`] : []), ...(fresh ? [`새 얼굴 ${fresh}`] : []),
      ...(o.U.crisis >= 1.5 ? [`위기 ×${o.U.crisis.toFixed(1)}`] : []), ...(T.f > 0 && o.u < 50 && who.some(p => p.tr === '새가슴') ? ['새가슴'] : [])];
    const best = Math.max(0, ...who.map(p => (p.ex && p.ex[T.f]) || 0)), m = Math.round(mapOf(c, T.f)), guide = who.some(p => p.tr === '길잡이');
    const uTip = `지도 ${m}${best ? ` + 고참 경험 ${Math.round(Math.min(CO.UND_EX, best / 4))}` : ''}${guide ? ` + 길잡이 ${CO.UND_GUIDE}` : ''} · 성공 ${o.U.succ >= 0 ? '+' : '−'}${Math.round(Math.abs(o.U.succ) * 100)}%p · 위기 ×${o.U.crisis.toFixed(2)} · 캐 오는 양 ×${o.U.loot.toFixed(2)}`;
    return `<tr class="t${t % 8}"><td><b>${t + 1}조</b></td>
      <td><span class="seg sm" role="group" aria-label="${t + 1}조 층">${open.map(f => `<button type="button" data-act="tfloor" data-t="${t}" data-f="${f}" aria-pressed="${T.f === f}">${FLOORS[f].name}</button>`).join('')}</span></td>
      <td class="n">${who.length}/${CO.PARTY}${scoutOk || T.scout ? ` <button type="button" class="tog sm" data-act="scout" data-t="${t}" aria-pressed="${!!T.scout}" title="정찰 조: 지도를 ${CO.SCOUT_MAP}배로 그리고 위기가 적지만 캐 오는 건 ${Math.round(CO.SCOUT_LOOT * 100)}%">정찰</button>` : ''}</td><td><span class="cl">${who.map(p => `<span${p.lead ? ' class="lead" title="단장"' : ''}>${p.lead ? '★' : ''}${p.c}</span>`).join('')}</span></td>
      <td><span class="ubar" title="${esc(uTip)}"><i><b style="width:${o.u}%"></b></i><span class="n">${o.u}</span></span></td>
      <td><span class="cobar" title="조원 둘씩 함께 나간 달의 평균 (${CO.CO_MAX}달이 끝)"><i><b style="width:${Math.round(o.coh * 100)}%"></b></i><span class="n">${Math.round(o.coh * 100)}</span><small class="dim">+${Math.round(o.coh * CO.CO_SUCC * 100)}%p</small></span></td>
      <td class="n"><b>${Math.round(o.p * 100)}%</b></td>
      <td>${stepper('tpots', t, pk, `${t + 1}조 포션`)}<small class="dim" title="못 해낸 날 부상 주사위에 걸릴 확률 · 다친 채 또 걸리면 포션 한 병으로 살고, 없으면 죽는다">부상 ${Math.round(Math.min(0.9, (CO.INJ_BASE + CO.INJ_K * FLOORS[T.f].risk) * o.U.crisis) * 100)}%</small></td>
      <td>${stepper('ttorch', t, tk, `${t + 1}조 횃불`)}<small class="${dark >= 0.25 ? 'neg' : 'dim'}" title="첫날 하나, 그 뒤 날마다 ${Math.round(torchRate(T.f, o.u) * 100)}% 확률로 하나 · 다 쓰면 돌아섬">돌아섬 ${Math.round(dark * 100)}%</small></td>
      <td>${packBar(who.length * CO.SLOT_PP, tk, pk)}</td>
      <td><select data-k="teamG" data-i="${t}" aria-label="${t + 1}조 장비"><option value="">섞인 대로</option>${GEAR_NAMES.map(g => `<option value="g:${g}"${T.g === 'g:' + g ? ' selected' : ''}>${g}</option>`).join('')}</select></td>
      <td><select data-k="target" data-i="${t}" aria-label="${t + 1}조 노릴 몬스터"><option value="">섞여 만남</option>${floorMons(W, T.f).map(M => { const u = Math.round(((W.dex || {})[M.name]?.u) || 0), ok = u >= DEX.TARGET_AT; return `<option value="${esc(M.name)}"${T.target === M.name ? ' selected' : ''}${ok ? '' : ' disabled'}>${esc(M.name)}${ok ? '' : ` (이해도 ${u}/${DEX.TARGET_AT})`}</option>`; }).join('')}</select></td>
      <td><span class="warn-s">${warn.length ? warn.map(w => `<span>${w}</span>`).join('') : '<span class="ok">없음</span>'}</span></td></tr>`;
  }).join('');
  const bench = crew.filter(p => !teamOf.has(p.id));
  const cur = sortKey(sort, 'team:1');
  const rows = sortRows(crew.map(p => ({ p })), cur.k, cur.d, (r, k) => (k === 'team' ? teamOf.get(r.p.id) ?? (r.p.hurt ? 999 : 998) : k === 'bond' ? bondOf(r.p) : pval(r.p, k)));
  const nT = teams.length, seg = nT <= 6;
  const cell = (p: Person) => {
    const t = teamOf.get(p.id);
    if (p.hurt) return '<span class="dim">부상 · 쉼</span>';
    if (!seg) return `<select data-k="assign" data-id="${p.id}" aria-label="${esc(nameOf(p))} 배치">${teams.map((T, k) => `<option value="${k}"${t === k ? ' selected' : ''}${t !== k && whoOf(k).length >= CO.PARTY ? ' disabled' : ''}>${k + 1}조 · ${FLOORS[T.f].name}</option>`).join('')}<option value="new">새 조</option><option value="-1"${t == null ? ' selected' : ''}>대기</option></select>`;
    return `<span class="seg asg" role="group" aria-label="${esc(nameOf(p))} 배치">${teams.map((_, k) => `<button type="button" class="k${k % 8}" data-act="assign" data-id="${p.id}" data-t="${k}" aria-pressed="${t === k}"${t !== k && whoOf(k).length >= CO.PARTY ? ' disabled' : ''}>${k + 1}조</button>`).join('')}<button type="button" data-act="assign" data-id="${p.id}" data-t="new" title="새 조를 만들어 넣기">+</button><button type="button" class="bn" data-act="assign" data-id="${p.id}" data-t="-1" aria-pressed="${t == null}">대기</button></span>`;
  };
  const bondTxt = (p: Person) => { const b = bondOf(p); return b < 0 ? '' : b === 0 && whoOf(teamOf.get(p.id)!).length > 1 ? '<span class="fresh">새 얼굴</span>' : `${b.toFixed(b % 1 ? 1 : 0)}달`; };
  return `<div class="tw"><table class="grid tsum"><thead><tr><th>조</th><th>층</th><th class="n">인원</th><th>직업</th><th title="지도 완성도 + 고참 경험 + 길잡이">이해도</th><th>조직력</th><th class="n">성공률</th><th title="위기마다 한 병">포션</th><th title="탐사 최대 ${CO.DAYS}일 · 횃불이 떨어지면 돌아섬">횃불</th><th title="한 사람 ${CO.SLOT_PP}칸 · 횃불(주황) · 포션(빨강)이 먼저 차지 · 빈 칸에 전리품">짐</th><th title="약점 장비">장비</th><th title="도감 이해도 ${DEX.TARGET_AT}부터 · 노린 몬스터를 더 자주 만나고 소재가 더 나온다">노릴 몬스터</th><th>살필 것</th></tr></thead>
      <tbody>${sum || `<tr><td colspan="13" class="dim">짠 조가 없어요. 아래 명단의 + 를 눌러 새 조를 만들어요</td></tr>`}<tr class="rest"><td><b>대기</b></td><td colspan="12" class="dim">${bench.filter(p => !p.hurt).length}명${bench.some(p => p.hurt) ? ` · 부상 ${bench.filter(p => p.hurt).length}명 (한 달 쉼)` : ''}</td></tr></tbody></table></div>
    <div class="tw"><table class="grid crewt asgn"><thead><tr>${th('name', '이름', cur, 'as')}${th('cls', '직업', cur, 'as')}${th('sk', '실력', cur, 'as')}${th('tr', '특성', cur, 'as')}${open.map(f => th('ex' + f, FLOORS[f].name, cur, 'as', 'n')).join('')}${th('bond', '함께한 달', cur, 'as')}${th('team', '배치', cur, 'as')}</tr></thead>
    <tbody>${rows.map(({ p }) => { const t = teamOf.get(p.id), f = t != null ? teams[t].f : -1;
      return `<tr class="${t != null ? 'k' + (t % 8) : ''}${p.hurt ? ' away' : ''}"><td class="nm">${p.lead ? '<span class="lead-b" title="단장: 죽지 않고, 크게 다치면 두 달 쉰다. 단장 조사를 맡는다">단장</span>' : ''}${esc(nameOf(p))}</td><td class="cn">${p.c}</td><td>${tierHtml(p)}</td><td>${traitHtml(p)}</td>${open.map(g => exCell(p, g, g === f)).join('')}<td class="bond">${bondTxt(p)}</td><td>${cell(p)}</td></tr>`; }).join('')}</tbody></table></div>`;
}
