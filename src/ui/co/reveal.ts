// 귀환 장부: 결재 도장을 찍으면 조가 하나씩 돌아오고, 층마다 판 값이 더해지고, 지출이 빠지고, 마지막에 순이익이 나온다.
// 줄마다 data-v(장부에 더할 금액)와 data-k(종류: ok·no·die·gain·cost·net)를 달아 두고, 한 줄씩 띄우는 것은 coMain이 한다.
// 기록을 읽어 HTML만 만든다. 상태를 쓰지 않고 난수도 쓰지 않는다
import { CO, FLOORS, ITEMS, MISSION_NAME, type World, gradeOf } from '../../core/company';
import { DAY_LEGEND, dayCls, dayMark, dayTip, packBar } from './roster';
import { segsOf } from '../../core/expedition';
import { ASK_SAY, TRIP_END } from '../../core/events';
import { DEX, keyName, weakName } from '../../core/dex';
import { fmtG } from './charts';

const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
const sgn = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n));

const END = TRIP_END;
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
// 조마다 한 줄: 어느 층에서 누가 갔고, 날마다(묶음 하나가 하루, 칸 하나가 마주침) 이겼나 졌나, 짐이 얼마나 찼나, 누가 죽었나.
// 날마다의 자세한 것(몬스터 · 갈무리 · 위기)은 칸에 마우스를 올리면 보인다
function teamLines(W: World, live = false) {
  const L = W.last!, lines: { k: string; v: number; t: string; amt?: string }[] = [];
  // 편성표의 조 번호 순서대로 (조 번호가 없는 옛 기록은 나간 순서)
  L.ours.map((x, j) => ({ x, j, no: (x.t ?? j) + 1 })).sort((a, b) => a.no - b.no || (a.x.d0 ?? 0) - (b.x.d0 ?? 0)).forEach(({ x, j: oi, no }) => {
    const F = FLOORS[x.f];
    const cls = (x.cls || x.keys.filter(k => k.startsWith('c:')).map(k => k.slice(2))).join('·'), gear = x.keys.find(k => k.startsWith('g:'));
    const n = x.n || 4, k = x.k != null ? x.k : x.ok ? n : 0, T = x.trip, D = x.days, dead = x.dead || [];
    const mats = (x.mats || []).map(([m, c]) => `${m} ×${c}`);
    const ms = x.mission || 'gather', head = `<b>${no}조</b> ${F.name} <span class="ms-tag ${ms}">${MISSION_NAME[ms]}</span> <span class="grade g${Math.min(4, Math.max(1, k))}">${gradeOf(k)}</span> <span class="dim">${cls || '혼성'}${gear ? ` · ${gear.slice(2)}` : ''}${n < 4 ? ` · ${n}명` : ''}${x.d0 != null ? ` · ${x.d0}일 → ${x.d1}일` : ''}</span>`;
    if (!D || !T) { lines.push({ k: x.d ? 'die' : x.ok ? 'ok' : 'no', v: 0, t: head, amt: `${mats.join(', ') || (k ? '' : '빈손')}${x.d ? ` · ${x.d}명 사망` : ''}` }); return; }
    // 날 칸: 승(초록) · 패(빨강) · 위기(!) · 사망(†). 못 간 날은 빈 칸, 돌아선 날은 어둠
    const back = T.end === 'torch' || T.end === 'flee';
    // 하루 한 묶음 (그날의 구간 칸). 칸 색이 사건 (채집 지점 · 조우 · 흔적)
    const cell = (d: typeof D[number], j: number) => `<i class="${dayCls(d)}${live ? ' hid' : ''}" data-s="${d.win ? 'ok' : 'no'}${d.d ? ' die' : ''}" style="--j:${j}" title="${esc(dayTip(d, j))}">${dayMark(d)}</i>`;
    const per = segsOf(CO.SEGS[x.f], CO.TRIP_DAYS[x.f]);
    const days = Array.from({ length: CO.TRIP_DAYS[x.f] }, (_, k) => {
      const es = D.map((d, j) => ({ d, j })).filter(({ d, j }) => (d.dd ?? j + 1) === k + 1);
      const fill = es.length ? '' : Array.from({ length: per[k] }, () => '<i class="o"></i>').join('');
      return `<span class="dg" title="${k + 1}일">${es.map(({ d, j }) => cell(d, j)).join('')}${fill}</span>`;
    }).join('') + (back ? (() => { const z = dead.filter(y => y.day === 0); return `<span class="dg"><i class="dk${z.length ? ' dead' : ''}${live ? ' hid' : ''}" data-s="${z.length ? 'die' : 'no'}" style="--j:${D.length}" title="${esc(`${END[T.end]} · 어둠 속 귀환${T.dark ? ` · 위기 ${T.dark}` : ''}${z.length ? ` · 사망 ${z.map(y => y.n).join(', ')}` : ''}`)}">${z.length ? '†' : T.dark ? '!' : ''}</i></span>`; })() : '');
    const fLeft = (T.food || 0) - (T.fu || 0), oLeft = (T.tools || 0) - (T.tk || 0);
    const potLeft = Math.max(0, Math.round(T.rest - (T.torch - T.tu) - fLeft / CO.FOOD_SLOT - oLeft)), wins = D.filter(d => d.win).length;
    // 짐 막대의 구간마다 모습: [채집품 칸, 남은 횃불, 남은 포션, 남은 식량, 남은 정비 도구, 전리품 칸, 지도 기록 칸] — 떠날 때, 구간마다, 돌아왔을 때 (연출이 구간마다 바꿔 그린다)
    const steps = [[0, T.torch, x.potC ?? potLeft, T.food || 0, T.tools || 0, 0, 0], ...D.map(d => [d.pk ?? 0, d.tl ?? 0, d.pl ?? 0, d.fl ?? 0, d.ol ?? 0, d.pm ?? 0, d.pt ?? 0]), [T.pack, T.torch - T.tu, potLeft, fLeft, oLeft, T.pm || 0, T.pt || 0]];
    const st0 = live ? steps[0] : steps[steps.length - 1];
    const strip = `<span class="trip"><span class="days" role="img" aria-label="${T.fd ?? D.length}일 다님 · 구간 ${D.length} · 성공 ${wins} · ${END[T.end]}">${days}</span><span class="packw" data-slots="${T.slots}" data-steps="${JSON.stringify(steps)}">${packBar(T.slots, st0[1], st0[2], st0[0], st0[3], st0[4], st0[5], st0[6])}</span><small class="${live ? 'hid' : ''}">${END[T.end]}</small></span>`;
    const deadTxt = dead.length ? `<b class="dead-n">† ${dead.map(z => `${esc(z.n)}${z.pot ? ' (포션 쓰고도)' : ''}`).join(', ')}</b>` : '';
    // 재생 장면: 이 조의 하루하루를 조원 카드와 몬스터로 다시 본다 (scene.ts)
    const play = `<button type="button" class="sc-open" data-act="scene" data-i="${oi}" aria-label="${no}조 탐사 재생">▶ 보기</button>`;
    lines.push({ k: dead.length ? 'die' : x.ok ? 'ok' : 'no', v: 0, t: `${head}${play}${strip}`,
      amt: [deadTxt, ms === 'scout' && x.mp ? `지도 +${x.mp}%p` : '', mats.length ? `${mats.slice(0, 3).join(', ')}${mats.length > 3 ? ` 외 ${mats.length - 3}` : ''}` : '', x.got ? `${ITEMS[x.f].name} ${x.got}개` : '', x.hurt ? `부상 ${x.hurt}` : ''].filter(Boolean).join(' · ') || '빈손' });
  });
  return lines;
}
// 가정산 위에 붙이는 귀환 결과: 조마다 한 줄 (돈은 신고서를 낸 뒤 정산에서)
export function returnsHtml(W: World, live = false) {
  const L = W.last; if (!L) return '';
  const r = L.res[0], ok = r.ok.reduce((a, b) => a + b, 0), sent = r.sent.reduce((a, b) => a + b, 0) + r.hired.reduce((a, b) => a + b, 0);
  // 잃은 사람: 이름과 어디서 (크게 따로 적는다)
  const fallen: string[] = [];
  L.ours.map((x, j) => ({ x, no: (x.t ?? j) + 1 })).sort((a, b) => a.no - b.no).forEach(({ x, no }) => (x.dead || []).forEach(z => fallen.push(`<b>${esc(z.n)}</b> <span>${no}조 · ${FLOORS[x.f].name} · ${x.d0 != null ? `${x.d0}일 출발 · ` : ''}${z.day ? `탐사 ${z.day}일째` : '어둠 속 귀환'}${z.pot ? ' · 포션 쓰고도' : ' · 포션 없이'}</span>`)));
  return `<section class="run trips${live ? ' live' : ''}" aria-label="제${L.month}월 귀환"><header><h3>제${L.month}월 귀환</h3><span class="dim">성공 ${ok}/${sent}조${r.hurt ? ` · 부상 ${r.hurt}` : ''}${r.deaths ? ` · <b class="neg">사망 ${r.deaths}</b>` : ''}</span>
      <span class="legend-d">${DAY_LEGEND} · <i class="o"></i>못 감 · 칸 하나가 구간, 묶음 하나가 하루 (층마다 ${CO.TRIP_DAYS.join(' · ')}일 · ${CO.SEGS.join(' · ')}구간) · 짐 <i class="l"></i>채집품 <i class="m"></i>전리품 <i class="n"></i>지도 기록 <i class="t"></i>횃불 <i class="p"></i>포션 <i class="lf"></i>식량 <i class="lo"></i>정비 도구</span></header>
    <div class="after${live ? ' hid' : ''}">${askLine(W)}</div>
    ${fallen.length ? `<div class="fallen after${live ? ' hid' : ''}"><span class="fx">†</span><div><small>잃은 사람</small>${fallen.map(t => `<p>${t}</p>`).join('')}</div></div>` : ''}
    <ol>${teamLines(W, live).map(l => `<li class="rv ${l.k} on" data-k="${l.k}"><span class="mk${live ? ' hid' : ''}" aria-hidden="true">${l.k === 'ok' ? '✓' : l.k === 'no' ? '✗' : '†'}</span><span class="tx">${l.t}</span><span class="am${live ? ' hid' : ''}">${l.amt || ''}</span></li>`).join('')}</ol></section>`;
}
export function revealHtml(W: World, live: boolean, mute = false) {
  const L = W.last; if (!L) return '';
  const r = L.res[0], s = r.spend;
  // 조마다의 귀환은 가정산에서 띄웠다. 정산은 돈 줄만
  const lines: { k: string; v: number; t: string; amt?: string }[] = [];
  // 층마다 판 채집품 (상단 단골 값을 얹은 실제 판매 수입을 층별 몫으로 나눈다)
  const loot0 = r.lootSales ?? r.sales - r.matSales, loot = loot0, base = ITEMS.map((_, j) => (r.soldV ? r.soldV[j] : r.sold[j] * L.price[j])), bsum = base.reduce((a, b) => a + b, 0);
  let left = loot;
  const sold = ITEMS.map((_, j) => j).filter(j => r.sold[j] > 0);
  sold.forEach((j, i) => {
    const v = i === sold.length - 1 ? left : Math.round(loot * base[j] / Math.max(1, bsum)); left -= v;
    lines.push({ k: 'gain', v, t: `${ITEMS[j].name} ${fmt(r.sold[j])}개 · 개당 ${fmtG(v / r.sold[j])}G`, amt: sgn(v) });
  });
  if (r.matSales) lines.push({ k: 'gain', v: r.matSales, t: `전리품 ${Object.values(r.matSold).reduce((a, b) => a + b, 0)}개`, amt: sgn(r.matSales) });
  // 영주청: 탐사 선금과 보급 · 층 지원금 (의뢰 포상 · 지도 판매도 같은 줄에)
  const other = r.sales - loot0 - r.matSales;
  if (other) lines.push({ k: 'gain', v: other, t: `의뢰 · 영주청 지원금${r.adv ? ' · 탐사 선금' : ''}`, amt: sgn(other) });
  const costs: [string, number][] = [['급여 · 관리비 · 신입 · 치료', s.wage + (s.admin || 0) + (s.fire || 0) + s.recruit + (s.heal || 0)], ['채비 (포션 · 횃불 · 식량 · 정비 · 장비)', s.potion + s.gear + (s.torch || 0) + (s.food || 0) + (s.mend || 0)], ['정보 · 조사', s.intel + s.probe], ['훈련 · 숙소 · 건물', s.train + s.base + s.proc + s.donate + s.root + (s.dorm || 0) + (s.hq || 0) + (s.job || 0)], ['영주세', s.tax || 0], ['추징금', s.fine || 0]];
  costs.filter(([, v]) => v > 0).forEach(([t, v]) => lines.push({ k: 'cost', v: -v, t, amt: sgn(-v) }));
  lines.push({ k: 'net', v: 0, t: r.capex ? `금고 변화 <small>(공사비 ${fmt(r.capex)}는 건물 자산)</small>` : '순이익', amt: sgn(r.net) });
  const ok = r.ok.reduce((a, b) => a + b, 0), sent = r.sent.reduce((a, b) => a + b, 0) + r.hired.reduce((a, b) => a + b, 0);
  return `<section class="run${live ? ' live' : ''}" aria-label="제${L.month}월 귀환 장부" data-net="${r.net}">
    <header><h3>제${L.month}월 귀환</h3><span class="dim">성공 ${ok}/${sent}조${r.hurt ? ` · ${r.hurt}명 부상` : ''}${r.deaths ? ` · <b class="neg">${r.deaths}명 사망</b>` : ''}</span>
      <span class="tally" aria-live="polite"><small>이번 달 장부</small><b class="tv" data-final="${r.net}">${live ? '0' : sgn(r.net)}</b></span>
      <button type="button" class="mute" data-act="mute">${mute ? '소리 켜기' : '소리 끄기'}</button>${live ? '<button type="button" class="skip" data-act="skip-run">건너뛰기</button>' : ''}</header>
    <ol>${lines.map(l => `<li class="rv ${l.k}${live ? '' : ' on'}" data-k="${l.k}" data-v="${l.v}"><span class="mk" aria-hidden="true">${l.k === 'ok' ? '✓' : l.k === 'no' ? '✗' : l.k === 'die' ? '†' : l.k === 'gain' ? '+' : l.k === 'cost' ? '−' : '='}</span><span class="tx">${l.t}</span><span class="am">${l.amt || ''}</span></li>`).join('')}</ol>
  </section>`;
}

// 단장 조사의 답과 크게 다친 단장 (귀환 결과 위 한 줄)
function askLine(W: World) {
  const L = W.last!, A = L.ask, out: string[] = [];
  if (A) {
    const k = A.m ? keyName(A.k) : weakName(A.k);
    const t = A.ans === 'away' ? ASK_SAY.away : A.ans === 'miss' ? ASK_SAY.miss(A.mon) : A.m ? ASK_SAY.mat[A.ans](A.mon, k, A.m) : A.b ? ASK_SAY.bad[A.ans](A.mon, k) : ASK_SAY.key[A.ans](A.mon, k);
    out.push(`<p class="ask ${A.ans}"><small>단장 조사</small> ${esc(t)}${A.ans === 'yes' ? ' <b class="st">확정</b>' : A.ans === 'no' ? ' <b class="st no">아님</b>' : ''}</p>`);
  }
  if (L.leadHurt) out.push(`<p class="ask hurt"><small>단장</small> ${esc(L.leadHurt)} 크게 다침 · ${DEX.LEAD_REST * CO.MONTH_DAYS}일 쉼</p>`);
  return out.join('');
}
