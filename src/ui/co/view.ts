// 용병단 행정실 화면: 결정표(위)와 지난달 정산(아래). HTML 문자열을 만들기만 하고 상태는 건드리지 않는다
import { CO, FLOORS, INTEL, ITEMS, type Plan, SRCS, type World, bedsOf, fcRank, gradeOf, churchPrice, dormKeep, guideParts, hireCost, intelBlock, intelCost, lootMul, toolCost, trainBonus, maxParties, priceOf, rankOf, sanitize, sortieCost, succRate, us, worth } from '../../core/company';
import { CLASSES, GEARS, MONSTERS } from '../../core/data';
import { keyLabel } from '../../core/util';
import { cashChart, fcChart, flowChart, incomeMix, moneySeries, perHeadChart, perPartyChart, priceBoard, shareChart, spendMix } from './charts';
import { condLabel, kitHint } from './book';
import { SRC_INFO } from './intel';
// 정보망 단계 (화면이 무엇을 보여 줄지 정한다)
const lvOf = (W: World, k: keyof typeof INTEL.BASE) => (W.intel ? W.intel.lv[k] : INTEL.BASE[k]);

export const COLORS: Record<string, string> = {
  us: 'var(--merchant)', red: '#b8452f', holy: '#a57a12', iron: '#5b6670', crow: '#3b3346', silver: '#2f7d7a',
  fox: '#c07a2a', bridge: '#7a5c99', free: '#9a9a8c',
};
export const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
export const sgn = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));
export const pct = (v: number) => Math.round(v * 100) + '%';
const sw = (id: string) => `<i class="co-sw" style="background:${COLORS[id] || 'var(--ink-soft)'}"></i>`;

export function plaqueHtml(W: World) {
  const c = us(W), r = rankOf(W);
  return `<div class="stat"><span>현재</span><b>제${W.month}월</b></div>
    <div class="stat"><span>금고</span><b class="${c.cash < 0 ? 'neg' : ''}">${fmt(c.cash)}G</b></div>
    <div class="stat"><span>평가액</span><b>${fmt(worth(W, c))}G</b></div>
    <div class="stat"><span>순위</span><b>${r ? `${r}위` : '-'}</b></div>
    <div class="stat"><span>단원</span><b>${c.members}명</b></div>
    <div class="stat"><span>열린 층</span><b>${W.unlocked}층</b></div>`;
}

export function stepper(k: string, i: number, v: number, label: string, step = 1, disabled = false) {
  return `<span class="step"><button type="button" data-k="${k}" data-i="${i}" data-d="${-step}" aria-label="${label} 줄이기"${disabled ? ' disabled' : ''}>−</button><input type="number" inputmode="numeric" data-k="${k}" data-i="${i}" value="${v}" min="0" aria-label="${label}"${disabled ? ' disabled' : ''}><button type="button" data-k="${k}" data-i="${i}" data-d="${step}" aria-label="${label} 늘리기"${disabled ? ' disabled' : ''}>+</button></span>`;
}

// 지난달 정산: 숫자 넷, 금고와 수입·순이익 그래프, 순위, 시세 흐름, 탐사 결과, 우리 정산 (자세한 것은 접어 둔다)
export function resultsHtml(W: World) {
  const L = W.last;
  if (!L) return `<h2>첫 정산 전</h2><p class="note">첫 달 결재가 끝나면 여기에 결과가 붙어요.</p><section class="rp"><h3>시세</h3><div class="tw">${priceBoard(W)}</div></section>`;
  const prev = W.history.length > 1 ? W.history[W.history.length - 2].rank : null;
  const order = L.rank.map(id => W.cos.findIndex(c => c.id === id));
  // 남의 출정은 입구 출입 기록 2단계부터 보인다 (순위와 평가액은 연합이 발표한다)
  const seeGate = lvOf(W, 'gate') >= 2;
  const rk0 = L.rank.indexOf('us') + 1, pr0 = prev ? prev.indexOf('us') + 1 : 0;
  const row = (i: number) => {
    const c = W.cos[i], r = L.res[i], rk = L.rank.indexOf(c.id) + 1, pr = prev ? prev.indexOf(c.id) + 1 : 0, mv = pr && rk ? pr - rk : 0;
    return `<tr class="${c.style === 'player' ? 'us' : ''}"><td><b class="rk">${rk}</b>${mv ? `<span class="mv ${mv > 0 ? 'up' : 'dn'}">${mv > 0 ? '▲' : '▼'}${Math.abs(mv)}</span>` : ''}</td>
      <td><span class="co">${sw(c.id)}${c.name}</span></td><td class="n">${c.members}명${c.style !== 'crowd' && r.recruited - r.deaths ? `<small class="${r.recruited > r.deaths ? 'pos' : 'neg'}">${sgn(r.recruited - r.deaths)}</small>` : ''}</td>
      <td class="n">${i === 0 || seeGate ? `${r.sent.reduce((a, b) => a + b, 0) + r.hired.reduce((a, b) => a + b, 0)}조` : '?'}</td><td class="n">${fmt(worth(W, c))}</td></tr>`;
  };
  const r = L.res[0];
  const mine = `<div class="tw"><table class="grid"><thead><tr><th>층</th><th class="n">우리</th><th class="n">계약</th><th class="n">성공</th><th class="n">캐 온 양</th></tr></thead><tbody>${FLOORS.map((F, f) => (r.sent[f] + r.hired[f] ? `<tr><td>${F.name}</td><td class="n">${r.sent[f]}</td><td class="n">${r.hired[f]}</td><td class="n">${r.ok[f]}</td><td class="n">${r.got[f]}</td></tr>` : '')).join('')}</tbody></table></div>
    <div class="tw"><table class="grid"><thead><tr><th>정산</th><th class="n">금액</th></tr></thead><tbody>${ITEMS.map((it, j) => (r.sold[j] ? `<tr><td>${it.name} ${r.sold[j]}개 × ${fmt(L.price[j])}G</td><td class="n">${fmt(r.sold[j] * L.price[j])}</td></tr>` : '')).join('')}
      ${r.matSales ? `<tr><td>갈무리 소재 ${Object.values(r.matSold).reduce((a, b) => a + b, 0)}개</td><td class="n">${fmt(r.matSales)}</td></tr>` : ''}
      <tr><td>출정</td><td class="n">−${fmt(r.spend.sortie)}</td></tr>
      ${r.spend.potion ? `<tr><td>포션 구매 ${r.potNeed}병 (교회 ${r.potC}병)</td><td class="n">−${fmt(r.spend.potion)}</td></tr>` : ''}
      ${r.potUsed ? `<tr><td class="dim">위기에 쓴 포션 ${r.potUsed}병 (나머지는 창고로)</td><td class="n dim">-</td></tr>` : ''}
      ${r.spend.gear ? `<tr><td>장비 ${r.spend.gear / CO.GEAR_PRICE}벌</td><td class="n">−${fmt(r.spend.gear)}</td></tr>` : ''}
      ${r.spend.probe ? `<tr><td>조사 의뢰</td><td class="n">−${fmt(r.spend.probe)}</td></tr>` : ''}
      ${r.spend.hire ? `<tr><td>계약 파티 수수료</td><td class="n">−${fmt(r.spend.hire)}</td></tr>` : ''}
      <tr><td>급여</td><td class="n">−${fmt(r.spend.wage)}</td></tr>
      ${r.spend.heal ? `<tr><td>치료비 (부상 ${r.hurt}명 · 다음 달 쉼)</td><td class="n">−${fmt(r.spend.heal)}</td></tr>` : ''}
      ${r.recruitWant ? `<tr><td>신입 ${r.recruited}명 × ${fmt(r.recruitPrice)}G${r.recruited < r.recruitWant ? ` <span class="dim">(찾은 ${r.recruitWant}명 · 지원자가 모자람)</span>` : ''}</td><td class="n">−${fmt(r.spend.recruit)}</td></tr>` : ''}
      ${r.rookDone || r.rookDead ? `<tr><td class="dim">수습${r.rookDone ? ` ${r.rookDone}명이 대원이 됨` : ''}${r.rookDead ? `${r.rookDone ? ',' : ''} ${r.rookDead}명 사망` : ''}</td><td class="n dim">-</td></tr>` : ''}
      ${r.spend.dorm ? `<tr><td>숙소 ${r.spend.dorm > dormKeep(bedsOf(us(W))) ? '유지비 · 증축' : '유지비'}</td><td class="n">−${fmt(r.spend.dorm)}</td></tr>` : ''}
      ${r.spend.tool ? `<tr><td>채집 장비</td><td class="n">−${fmt(r.spend.tool)}</td></tr>` : ''}
      ${r.spend.intel ? `<tr><td>정보비</td><td class="n">−${fmt(r.spend.intel)}</td></tr>` : ''}
      ${r.spend.proc ? `<tr><td>갈무리장</td><td class="n">−${fmt(r.spend.proc)}</td></tr>` : ''}
      ${r.spend.root ? `<tr><td>근원 기금</td><td class="n">−${fmt(r.spend.root)}</td></tr>` : ''}
      ${r.spend.donate ? `<tr><td>교회 후원금</td><td class="n">−${fmt(r.spend.donate)}</td></tr>` : ''}
      ${r.spend.train + r.spend.base ? `<tr><td>훈련 · 거점</td><td class="n">−${fmt(r.spend.train + r.spend.base)}</td></tr>` : ''}
      ${r.potSpoil ? `<tr><td class="neg">보급 창고에서 상해 버린 포션 ${r.potSpoil}병</td><td class="n dim">-</td></tr>` : ''}
      <tr class="tot"><td>순이익</td><td class="n ${r.net < 0 ? 'neg' : 'pos'}">${sgn(r.net)}</td></tr></tbody></table></div>`;
  const r0 = L.res[0], S = moneySeries(W), k = S.months.length - 1;
  const perParty = S.parties[k] ? r0.sales / S.parties[k] : 0, perHead = r0.net / S.heads[k];
  const prevNet = k > 0 ? S.net[k - 1] : null;
  return `<div class="kind">제${L.month}월 정산</div>
    <div class="kpi">
      <div><span>금고</span><b>${fmt(us(W).cash)}G</b><small>시작 ${fmt(S.start)}G</small></div>
      <div><span>순이익</span><b class="${r0.net < 0 ? 'neg' : 'pos'}">${sgn(r0.net)}</b><small>${prevNet == null ? '첫 달' : `지난달 ${sgn(prevNet)}`}</small></div>
      <div><span>수입</span><b>${fmt(r0.sales)}G</b><small>지출 ${fmt(r0.sales - r0.net)}</small></div>
      <div><span>순위</span><b>${rk0}위</b><small class="${pr0 && pr0 > rk0 ? 'pos' : pr0 && pr0 < rk0 ? 'neg' : ''}">${pr0 && pr0 !== rk0 ? (pr0 > rk0 ? '▲' : '▼') + Math.abs(pr0 - rk0) : '그대로'}</small></div>
      <div><span>조당 수입</span><b>${fmt(perParty)}G</b><small>${S.parties[k]}조 보냄</small></div>
      <div><span>한 명당 순이익</span><b class="${perHead < 0 ? 'neg' : ''}">${sgn(perHead)}</b><small>단원 ${S.heads[k]}명</small></div>
    </div>
    <section class="rp"><h3>돈</h3>
      <div class="charts">${cashChart(W)}${flowChart(W)}</div>
      <div class="charts">${incomeMix(W)}${spendMix(W)}</div>
    </section>
    <section class="rp"><h3>효율</h3><div class="charts three">${perPartyChart(W)}${perHeadChart(W)}${shareChart(W)}</div></section>
    <section class="rp"><h3>시장</h3><div class="two">
      <section><h4>순위 · 평가액</h4><div class="tw"><table class="grid rank"><thead><tr><th>순위</th><th>용병단</th><th class="n">단원</th><th class="n">출정</th><th class="n">평가액</th></tr></thead><tbody>${order.map(row).join('')}</tbody></table></div></section>
      <section><h4>시세</h4><div class="tw">${priceBoard(W)}</div></section>
    </div></section>
    ${fcVsHtml(W)}
    <section class="rp"><h3>탐사</h3>${returnHtml(W)}</section>
    <details class="fold"><summary>우리 정산 자세히</summary><div class="mine">${mine}</div></details>`;
}

// 어림과 실제: 결재 직전 어림의 분포 위에 실제 수입을 긋고, 지난 몇 달의 어림과 실제를 나란히 둔다
function fcVsHtml(W: World) {
  const L = W.last; if (!L || !L.fc || !L.fc.mean) return '';
  const fc = L.fc, a = L.res[0].sales, rk = fcRank(fc, a), cost = a - L.res[0].net;
  const say = rk < 0.1 ? '어림의 아래쪽 끝이에요. 운이 나빴거나, 편성에 역효과가 있었을 수 있어요.' : rk > 0.9 ? '어림의 위쪽 끝이에요. 운이 좋았거나, 편성이 약점을 맞혔을 수 있어요.' : '어림 안쪽이에요.';
  const past = W.history.slice(-6).filter(M => M.fc && M.fc.mean);
  return `<section class="rp"><h3>어림과 실제</h3>
    ${fcChart(fc, cost, a, `제${L.month}월 수입 어림 기대 ${fmt(fc.mean)}G, 실제 ${fmt(a)}G`)}
    <p class="note">어림 기대 <b>${fmt(fc.mean)}G</b> (열에 여덟은 ${fmt(fc.p10)} ~ ${fmt(fc.p90)}G) → 실제 <b>${fmt(a)}G</b>, 어림의 아래에서 ${Math.round(rk * 100)}%. ${say}</p>
    ${past.length > 1 ? `<div class="tw"><table class="grid slim fcv"><thead><tr><th>달</th><th class="n">어림 기대</th><th class="n">열에 여덟</th><th class="n">실제</th><th class="n">차이</th></tr></thead><tbody>${past.map(M => { const x = M.res[0].sales, d = x - M.fc!.mean; return `<tr><td>제${M.month}월</td><td class="n">${fmt(M.fc!.mean)}</td><td class="n dim">${fmt(M.fc!.p10)} ~ ${fmt(M.fc!.p90)}</td><td class="n">${fmt(x)}</td><td class="n ${d < 0 ? 'neg' : 'pos'}">${sgn(d)}</td></tr>`; }).join('')}</tbody></table></div>` : ''}
  </section>`;
}

// 신문 한 단: 지난달 정산을 읽어 몇 줄로 옮긴다 (상태를 쓰지 않고 난수도 쓰지 않는다)
export function newsLines(W: World) {
  const L = W.last; if (!L) return [];
  const prevP = W.history.length > 1 ? W.history[W.history.length - 2].price : ITEMS.map(it => it.P0);
  const out: string[] = [];
  W.log.filter(l => l.m === L.month && /챙겨|포션 값|포션을 예전 값|마주 앉는다/.test(l.t)).forEach(l => out.push(l.t));
  if (L.opened != null) out.push(`${FLOORS[L.opened].name}으로 가는 길이 열렸다. 다음 달부터 ${ITEMS[L.opened].name}이 나온다.`);
  ITEMS.forEach((it, j) => {
    if (!L.Q[j]) return;
    if (L.price[j] < it.P0 * 0.7) out.push(`${it.name}이 쏟아져 ${it.buyer} 시세가 ${fmt(L.price[j])}G까지 떨어졌다.`);
    else if (L.price[j] > prevP[j] * 1.15) out.push(`${it.name} 시세가 ${fmt(L.price[j])}G로 뛰었다. 물건이 귀하다.`);
  });
  W.cos.forEach((c, i) => {
    if (c.style === 'player') return;
    const P = L.plans[i], r = L.res[i];
    if (c.style === 'crowd') { const n = r.sent.reduce((a, b) => a + b, 0); out.push(`군소 용병대는 이번 달 ${n}개 파티가 입구 앞에 줄을 섰다.`); return; }
    if (P.base) out.push(`${c.name}이 ${FLOORS[P.base.f].name}에 전진 거점을 짓기 시작했다는 소문이다.`);
    if (r.deaths >= 8) out.push(`${c.name}에서 이번 입장에만 ${r.deaths}명이 돌아오지 못했다.`);
  });
  return out.slice(0, 7);
}

// 현장 기록: 층마다 들은 증언(최근 넷)과, 구성별로 갖춘 파티와 안 갖춘 파티의 성공률
export function fieldHtml(W: World) {
  const open = FLOORS.slice(0, W.unlocked).map((F, f) => {
    const notes = W.notes.filter(n => n.f === f).slice(-4).reverse(), all = W.obs[f]['*'];
    if (!notes.length && !all) return `<div class="fblock"><b>${F.name}</b><p class="note">아직 우리 파티가 가 보지 않았어요.</p></div>`;
    const rows = lvOf(W, 'ret') < 2 ? [] : Object.entries(W.obs[f]).filter(([k, v]) => k !== '*' && v.n >= 3).map(([k, v]) => {
      const off = all.n - v.n, offR = off ? (all.w - v.w) / off : 0, r = v.w / v.n, d = off >= 3 ? r - offR : 0;
      return { k, n: v.n, r, d, off };
    }).sort((a, b) => b.d - a.d);
    return `<div class="fblock"><b>${F.name}</b> <span class="dim">최근 우리 파티 ${all ? Math.round(all.n) : 0}조 · 성공 ${all && all.n ? pct(all.w / all.n) : '-'}${lvOf(W, 'ret') < 2 ? ' · 구성별 성공률은 귀환 보고 2단계부터' : ''}</span>
      <ul class="notes">${notes.map(n => `<li><span class="dim">제${n.m}월</span> ${n.t}</li>`).join('')}</ul>
      ${rows.length ? `<div class="chips">${rows.map(x => `<span class="chip ${x.off >= 3 && x.d >= 0.12 ? 'up' : x.off >= 3 && x.d <= -0.12 ? 'dn' : ''}" title="갖춘 파티 ${Math.round(x.n)}조 성공 ${pct(x.r)}">${keyLabel(x.k)} ${pct(x.r)}${x.off >= 3 ? ` (${x.d >= 0 ? '+' : '−'}${Math.round(Math.abs(x.d) * 100)}%p)` : ''}</span>`).join('')}</div>` : ''}</div>`;
  });
  return `<div class="fgrid">${open.join('')}</div>`;
}

// 탐사 결과: 우리 직영 조 하나하나가 무엇을 갖추고 들어가 무엇을 갈무리해 왔나를 한 줄씩 적고, 판 소재를 늘어놓는다 (지난달 기록만 읽는다)
export const KTAG = '가나다라';
const CLS_SHORT = (k: string) => (k.startsWith('c:') ? k.slice(2) : '');
export function returnHtml(W: World) {
  const L = W.last; if (!L || !L.ours || !L.ours.length) return '<p class="note">이번 달 우리 직영 파티는 미궁에 들어가지 않았어요.</p>';
  const r = L.res[0], P = L.plans[0];
  let no = 0;
  const blocks = FLOORS.map((F, f) => {
    const ps = L.ours.filter(x => x.f === f); if (!ps.length) return '';
    const ok = ps.filter(x => x.ok).length, d = ps.reduce((a, x) => a + x.d, 0);
    const rows = ps.map(x => {
      const cls = x.keys.map(CLS_SHORT).filter(Boolean).join('·'), gear = x.keys.find(k => k.startsWith('g:'));
      const got = (x.mats || []).map(([m, n]) => `${(x.first || []).includes(m) ? `<b>${m} ×${n}</b><span class="bk-new">처음</span>` : `${m} ×${n}`}`).join(', ');
      const grade = x.k != null ? `<span class="grade g${Math.min(4, Math.max(1, x.k))}">${gradeOf(x.k)} ${x.k}/${x.n || 4}</span> ` : '';
      const what = grade + (x.k ? (got || '<span class="dim">갈무리한 것 없음</span>') : x.k == null && !x.ok ? `<span class="dim">실패</span>` : '') + (x.crisis ? ` <span class="dim">· 위기 ${x.crisis}${x.pots ? ` · 포션 ${x.pots}` : ''}</span>` : '');
      return `<div class="ld${(x.first || []).length ? ' first' : ''}"><span class="ld-w">${x.kit >= 0 ? `<span class="ktag">${KTAG[x.kit]}</span>` : ''}${++no}조 · ${cls || '혼성'}${gear ? ` · ${gear.slice(2)}` : ''}</span><span>${what}${x.hurt ? ` · <b class="hurt">${x.hurt}명 부상</b>` : ''}${x.d ? ` · <b class="neg">${x.d}명 사망</b>` : ''}</span></div>`;
    }).join('');
    // 같은 층의 편성 줄끼리 견주기: 줄마다 조 · 성공 · 사망 · 조당 소재 값, 그리고 줄 사이에 차이가 난 소재 둘
    const lines = [...new Set(ps.map(x => x.kit))].sort((a, b) => (a < 0 ? 99 : a) - (b < 0 ? 99 : b));
    let cmp = '';
    if (lines.length > 1) {
      const G = lines.map(k => { const xs = ps.filter(x => x.kit === k), m: Record<string, number> = {}; xs.forEach(x => (x.mats || []).forEach(([n, c]) => { m[n] = (m[n] || 0) + c; })); return { k, xs, m, g: k < 0 ? '' : xs[0].g }; });
      const names = [...new Set(G.flatMap(x => Object.keys(x.m)))].map(n => { const per = G.map(x => (x.m[n] || 0) / x.xs.length); return { n, d: Math.max(...per) - Math.min(...per) }; }).sort((a, b) => b.d - a.d).slice(0, 2).filter(x => x.d > 0).map(x => x.n);
      const top = Math.max(1, ...G.flatMap(x => names.map(n => x.m[n] || 0)));
      cmp = `<div class="tw"><table class="grid cmp"><thead><tr><th>편성 줄</th><th class="n">조</th><th class="n">성공</th><th class="n">사망</th>${names.map(n => `<th>${n}</th>`).join('')}<th class="n">조당 소재 값</th></tr></thead><tbody>${G.map(x => {
        const v = Object.entries(x.m).reduce((a, [n, c]) => a + c * (L.matPrice[n] || 0), 0) / x.xs.length;
        return `<tr><td><span class="ktag${x.k < 0 ? ' rest' : ''}">${x.k < 0 ? '–' : KTAG[x.k]}</span>${x.g ? condLabel(x.g) : '섞인 대로'}</td><td class="n">${x.xs.length}</td><td class="n">${x.xs.filter(y => y.ok).length}/${x.xs.length}</td><td class="n">${x.xs.reduce((a, y) => a + y.d, 0)}</td>${names.map(n => `<td>${x.m[n] ? `<span class="mbar" style="width:${Math.round((x.m[n] / top) * 48)}px"></span>${x.m[n]}개 · ${x.xs.filter(y => (y.mats || []).some(m => m[0] === n)).length}조` : '<span class="dim">없음</span>'}</td>`).join('')}<td class="n">${fmt(v)}G</td></tr>`;
      }).join('')}</tbody></table></div>`;
    }
    return `<section class="rf"><div class="rf-h"><b>${F.name}</b><span class="rf-sum">${ps.length}조 중 ${ok}조 성공${d ? ` · <span class="neg">${d}명 사망</span>` : ''} · 캐 온 전리품 ${r.got[f]}개${r.hired[f] ? ` (계약 ${r.hired[f]}조 몫 포함)` : ''}</span></div>${cmp}<details class="fold"><summary>조마다 보기</summary><div class="ld-list">${rows}</div></details></section>`;
  }).join('');
  const sold = Object.entries(r.matSold || {}).filter(([, n]) => n > 0);
  const tot = sold.reduce((a, [m, n]) => a + n * (L.matPrice[m] || 0), 0);
  const soldT = sold.length ? `<details class="fold"><summary>판 소재 ${sold.reduce((a, [, n]) => a + n, 0)}개 · ${fmt(tot)}G</summary><div class="tw"><table class="grid bk-sold"><thead><tr><th>소재</th><th class="n">개수</th><th class="n">받은 값</th><th class="n">평균 시세 대비</th></tr></thead><tbody>${sold.map(([m, n]) => {
    const p = L.matPrice[m] || 0, ref = L.matRef[m] || p, d = ref ? Math.round((p / ref - 1) * 100) : 0;
    return `<tr><td>${m}</td><td class="n">${n}</td><td class="n">${fmt(n * p)}</td><td class="n ${d > 0 ? 'pos' : d < 0 ? 'neg' : 'dim'}">${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)}%</td></tr>`;
  }).join('')}<tr class="tot"><td>모두</td><td class="n">${sold.reduce((a, [, n]) => a + n, 0)}</td><td class="n">${fmt(tot)}</td><td></td></tr></tbody></table></div></details>` : '';
  return `<div class="co-ret">${blocks}</div>${soldT}`;
}

// 미궁의 깊은 곳: 이상 징후와 근원. 압력 숫자는 보이지 않고, 징후가 몇 번 돌았는지로만 짐작한다. 근원 기금은 숫자로 넣는다
export function depthsHtml(W: World, raw: Plan) {
  const roots = (W.roots || []).map((R, f) => ({ R, f })).filter(x => x.R.found);
  const anoms = W.log.filter(l => /^이상 징후: /.test(l.t)), last = W.log.filter(l => /^범람: /.test(l.t)).slice(-1)[0];
  const k = W.anoms || 0, mood = k >= 3 ? '<b class="neg">위태로움</b> · 언제 넘쳐도 이상하지 않아요' : k === 2 ? '<b class="neg">술렁임</b>' : k === 1 ? '조금 술렁임' : '조용함';
  if (!roots.length && !anoms.length) return '';
  const open = roots.filter(x => !x.R.done), sel = raw.root && open.some(x => x.f === raw.root!.f) ? raw.root.f : open[0]?.f;
  const rows = roots.map(({ R, f }) => `<tr><td><b>${FLOORS[f].name}</b><small>${MONSTERS[W.mons[f]].name} · 제${R.found}월에 찾음</small></td>
    <td>${R.done === 'seal' ? `봉인함 (제${R.at}월)` : R.done === 'mine' ? `채굴장 냄 (제${R.at}월)` : `봉인 기금 ${fmt(R.seal)} · 채굴장 기금 ${fmt(R.mine)} / ${fmt(CO.ROOT_COST)}G`}</td></tr>`).join('');
  return `<h3>5 · 미궁의 깊은 곳</h3>
    <p class="note">미궁의 기운: ${mood}${last ? ` · 마지막 범람 제${last.m}월` : ''}. 모든 용병단이 많이 꺼낼수록 미궁이 차오르고, 넘치면 1·2층에 있던 파티가 당해요.${anoms.length ? ` 최근 징후: ${anoms.slice(-1)[0].t.replace(/^이상 징후: /, '')}` : ''}</p>
    ${roots.length ? `<div class="tw"><table class="grid"><thead><tr><th>근원</th><th>형편</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="note">약점을 갖춘 우리 파티가 한 층에서 성공을 쌓으면, 그 층에서 몬스터가 생겨나는 근원을 찾을 수 있어요.</p>'}
    ${open.length ? `<div class="invest">
      <label class="box">봉인 기금 <span class="step"><select data-k="rootf" aria-label="기금을 넣을 근원">${open.map(x => `<option value="${x.f}"${x.f === sel ? ' selected' : ''}>${FLOORS[x.f].name}</option>`).join('')}</select></span> ${stepper('seal', 0, raw.root ? raw.root.seal : 0, '봉인 기금', 250)}<small>교회가 같은 돈을 보태요. 다 차면 미궁의 기운이 크게 가라앉고, 그 층은 덜 차오르고 조금 작아져요. 길을 아는 우리 파티는 그 층 성공률 +${Math.round(CO.SEAL_SUCC * 100)}%p. 교회와 가까워져요.</small></label>
      <label class="box">채굴장 기금 ${stepper('mine', 0, raw.root ? raw.root.mine : 0, '채굴장 기금', 250)}<small>다 차면 그 층에서 우리 성공 조당 ${CO.MINE_TAKE}개를 더 캐요. 대신 그 층이 미궁을 ${CO.MINE_PRESS}배로 채워요. 상단은 반기고 교회는 멀어져요. 기금은 먼저 ${fmt(CO.ROOT_COST)}G가 찬 쪽으로 정해져요.</small></label>
    </div>` : ''}`;
}

