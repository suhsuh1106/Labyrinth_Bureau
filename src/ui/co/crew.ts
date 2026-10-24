// 인원 시트 (docs/board.md 2단계): 세로 카드. 조 편성(조마다 조장 · 조원 · 빈자리 · 조 장비, 대기 = 훈련) · 명단(기록 카드 · 진급 · 해고) · 지원자(이력서 · 계약)
// 어디로 보낼지는 판에서, 누가 어느 조인지는 여기서. 읽기만 한다 (상태를 쓰지 않는다)
import { CO, FLOORS, type Person, type Plan, type World, awayIds, bedsOf, candNow, candPrice, capOf, cohesion, drillGain, eligible, grOf, hirePrice, isRook, personWage, roomOf, sanitize, stateOf, teamFx, us, zoneAt } from '../../core/company';
import { CLASSES, GRADE_N } from '../../core/data';
import { aptHtml, chHtml, dueHtml, gdHtml, nameOf, pcardHtml, rateHtml, resumeHtml, sqHtml, tierHtml, traitHtml } from './roster';
import type { DeskUi } from './desk';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');

// 사람 한 줄: 이름(누르면 기록 카드) · 직업 · 등급 · 특성 · 적성, 오른쪽에 그 줄의 조작
function who(p: Person, ui: DeskUi, right: string, sub = '') {
  return `<li class="pp${ui.who === p.id ? ' open' : ''}"><div class="pp-h">
    <button type="button" class="pp-n" data-act="who" data-id="${p.id}" aria-expanded="${ui.who === p.id}">${p.lead ? '<span class="lead-b">단장</span>' : ''}<b>${esc(nameOf(p))}</b><span class="pp-c">${p.c}</span></button>
    <span class="pp-r">${right}</span></div>
    <div class="pp-t">${tierHtml(p)}${dueHtml(p)}${traitHtml(p)}${aptHtml(p)}${sub}</div>${ui.who === p.id ? pcardHtml(p) : ''}</li>`;
}

// 조 편성: 조마다 카드, 그 아래 대기(= 본부 훈련)
export function teamsHtml(W: World, raw: Plan, ui: DeskUi) {
  const c = us(W), P = sanitize(W, c, raw), T = P.teams || [], crew = c.crew || [], byId = new Map(crew.map(p => [p.id, p])), out = awayIds(W);
  const inTeam = new Map<number, number>(); T.forEach((x, t) => x.m.forEach(id => { if (id != null) inTeam.set(id, t); }));
  // 옮길 곳: 조마다 (자리가 차면 막음) · 새 조 · 대기
  const moveSel = (p: Person, cur: number | null) => out.has(p.id) ? '<span class="dim">미궁</span>'
    : `<select data-k="assign" data-id="${p.id}" aria-label="${esc(nameOf(p))} 옮기기">${T.map((x, k) => { const n = x.m.filter(y => y != null).length, full = k !== cur && n >= capOf(byId.get(x.m.find(y => y != null)!)); return `<option value="${k}"${cur === k ? ' selected' : ''}${full ? ' disabled' : ''}>${k + 1}조${full ? ' (가득)' : ''}</option>`; }).join('')}<option value="new">새 조</option><option value="-1"${cur == null ? ' selected' : ''}>대기 · 훈련</option></select>`;
  const cards = T.map((x, t) => {
    const ms = x.m.filter((id): id is number => id != null).map(id => byId.get(id)).filter((p): p is Person => !!p), L = ms[0], X = teamFx(ms, 0), cap = X.cap;
    const away = ms.some(p => out.has(p.id)), z = zoneAt(W, x.z);
    const st = away ? '<span class="chip out">미궁</span>' : x.go ? '<span class="chip go">내일 출발</span>' : ms.some(p => stateOf(W, p, out) === 'hurt') ? '<span class="chip hurt">부상</span>' : ms.some(p => stateOf(W, p, out) === 'rest') ? '<span class="chip">쉬는 날</span>' : '<span class="chip ok">본부</span>';
    const empty = Math.max(0, cap - ms.length), bench = crew.filter(p => !inTeam.has(p.id) && !p.hurt && !(raw.fire || []).includes(p.id));
    return `<section class="tc"><header><b>${t + 1}조</b>${st}<button type="button" class="link" data-act="bs-team" data-t="${t}">${z ? `${FLOORS[z.f].name} ${esc(z.nm)}` : FLOORS[x.f].name} →</button></header>
      <div class="tc-l">${L ? `<label>조장 <select data-k="tlead" data-i="${t}" aria-label="${t + 1}조 조장"${away ? ' disabled' : ''}>${ms.map(p => `<option value="${p.id}"${p.id === L.id ? ' selected' : ''}>${esc(nameOf(p))} ${'●'.repeat(Math.max(1, (p.ch || 1)))}</option>`).join('')}</select></label>` : ''}
        <span class="dim">${ms.length}/${cap}명 · 조직력 ${Math.round(cohesion(ms) * 100)}</span><span class="tc-sq">${sqHtml(W, x, t, ms)}</span></div>
      <ul class="pps">${ms.map(p => who(p, ui, moveSel(p, t))).join('')}
        ${Array.from({ length: empty }, () => `<li class="pp empty"><span class="dim">빈자리</span>${!away && bench.length ? `<span class="fill">${bench.slice(0, 6).map(p => `<button type="button" class="mini" data-act="assign" data-id="${p.id}" data-t="${t}">${esc(nameOf(p))} <small>${p.c}</small></button>`).join('')}</span>` : ''}</li>`).join('')}</ul></section>`;
  }).join('');
  const bench = crew.filter(p => !inTeam.has(p.id));
  const tpl = (P.tpl || CO.TPL0).map((k, s) => `<select data-k="tpl" data-i="${s}" aria-label="기본 편성 ${s + 1}번 자리"><option value="">아무나</option>${CLASSES.map(x => `<option${x === k ? ' selected' : ''}>${x}</option>`).join('')}</select>`).join('');
  return `<div class="crew-h"><span class="dim">기본 편성</span>${tpl}<button type="button" class="mini" data-act="refill">다시 짜기</button><button type="button" class="mini" data-act="fill-rest">남은 사람으로 채우기</button></div>
    ${cards || '<p class="note">짠 조가 없어요. 대기에서 "새 조"로 옮겨 조를 만들어요</p>'}
    <section class="tc bench"><header><b>대기</b><span class="chip">본부 훈련</span><span class="dim">${bench.length}명</span></header>
      <ul class="pps">${bench.map(p => who(p, ui, p.hurt ? `<span class="chip hurt">부상 ${p.hurt}일</span>` : moveSel(p, null), p.hurt ? '' : `<span class="dim">훈련 +${drillGain(c, P, p)}${isRook(p) ? ' · 수습' : ''}</span>`)).join('') || '<li class="pp"><span class="dim">모두 조에 들었어요</span></li>'}</ul></section>
    <p class="note">조장의 카리스마 + 1이 조 크기 · 함께 나간 달만큼 조직력 (성공 최대 +${Math.round(CO.CO_SUCC * 100)}%p) · 빈자리 하나당 성공 −${Math.round(CO.SHORT_PEN * 100)}%p · 어디로 보낼지는 판에서</p>`;
}

// 명단: 등급 높은 순, 사람마다 성공 비율 · 불만 · 급여 · 해고
export function listHtml(W: World, raw: Plan, ui: DeskUi) {
  const c = us(W), crew = [...(c.crew || [])].sort((a, b) => grOf(b) - grOf(a) || eligible(b) - eligible(a) || a.id - b.id), out = raw.fire || [];
  const tiers = GRADE_N.map((_, t) => crew.filter(p => grOf(p) === t).length);
  return `<div class="crew-sum">${GRADE_N.map((n, t) => (tiers[t] ? `<span>${n} <b>${tiers[t]}</b></span>` : '')).join('')}<span>침상 <b>${c.members}/${bedsOf(c)}</b></span><span>급여 <b>${fmt(crew.reduce((a, p) => a + personWage(p), 0))}G</b></span><span>명성 <b>${Math.round(c.fame || 0)}</b></span></div>
    <ul class="pps">${crew.map(p => who(p, ui, p.lead ? '' : `<button type="button" class="mini${out.includes(p.id) ? ' on' : ''}" data-act="fire" data-id="${p.id}" aria-pressed="${out.includes(p.id)}" title="위로금 ${Math.round(personWage(p) * CO.FIRE_PAY)}G">${out.includes(p.id) ? '내보냄' : '해고'}</button>`,
      `<span class="pp-x">성공 ${rateHtml(p)} · ${chHtml(W, p)} · 불만 ${gdHtml(p)} · ${personWage(p)}G${p.hurt ? ` · <span class="neg">부상 ${p.hurt}일</span>` : ''}</span>`)).join('')}</ul>
    <p class="note">이름을 누르면 기록 카드 · 실제 실력은 숨어 있고 등급은 우리가 매긴다 · 해고는 다음 날 아침 떠나고 한 달 급여를 위로금으로</p>`;
}

// 지원자: 오늘까지 찾아온 사람 · 내일 합류할 사람. 계약하면 계약금이 바로 나간다 (그날 안엔 물림)
export function candsHtml(W: World) {
  const c = us(W), Q = c.hireQ || [], room = roomOf(c), rp = hirePrice(W), day = W.day || 1;
  const card = (p: Person, q: boolean) => {
    const full = !q && room <= 0, e = eligible(p), low = !q && e > 0, lowP = low ? Math.round(candPrice({ ...p, gr: e - 1 }, rp)) : 0;
    return `<li class="pp${q ? ' on' : ''}"><div class="pp-h"><span class="pp-n"><b>${esc(nameOf(p))}</b><span class="pp-c">${p.c}</span>${!q && (p.ad || 1) === day && day > 1 ? '<small class="new-b">오늘</small>' : ''}</span>
      <span class="pp-r"><button type="button" class="mini${q ? ' on' : ''}" data-act="hire" data-id="${p.id}" aria-pressed="${q}"${full ? ' disabled' : ''}>${q ? '내일 합류 · 물리기' : `계약 ${fmt(candPrice(p, rp))}G`}</button></span></div>
      <div class="pp-t">${tierHtml(p)}${traitHtml(p)}${aptHtml(p)}<span class="pp-x">${chHtml(W, p)} · 급여 ${personWage(p)}G</span></div>
      <div class="pp-x"><span class="dim">${esc(p.job || '')}</span> ${resumeHtml(p)}${low && !full ? ` · <button type="button" class="link" data-act="hire" data-low="1" data-id="${p.id}">${GRADE_N[e - 1]}로 낮춰 계약 ${fmt(lowP)}G</button>` : ''}</div></li>`;
  };
  const now = candNow(W);
  return `<div class="crew-sum"><span>빈 침상 <b>${room}</b></span><span>지원자 <b>${now.length}</b></span>${Q.length ? `<span>내일 합류 <b>${Q.length}</b></span>` : ''}</div>
    <ul class="pps">${[...Q.map(p => card(p, true)), ...now.map(p => card(p, false))].join('') || '<li class="pp"><span class="dim">오늘까지 찾아온 사람이 없어요 · 그달 며칠마다 하나씩 찾아온다</span></li>'}</ul>
    <p class="note">자격 등급은 이력서의 기록으로 매긴다 · 그달 뽑지 않은 사람은 그믐에 다른 데로 간다${room <= 0 ? ' · 빈 침상이 없으면 본부에서 숙소를 늘린다' : ''}</p>`;
}
