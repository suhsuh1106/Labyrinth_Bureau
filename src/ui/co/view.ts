// 용병단 행정실 화면: 결정표(위)와 지난달 정산(아래). HTML 문자열을 만들기만 하고 상태는 건드리지 않는다
import { CO, FLOORS, ITEMS, type Plan, type World, churchPrice, hireCost, trainBonus, keysAll, maxParties, priceOf, rankOf, sanitize, sortieCost, succRate, us, worth } from '../../core/company';
import { MONSTERS } from '../../core/data';
import { keyLabel } from '../../core/util';
import { paperHtml } from './paper';

export const COLORS: Record<string, string> = {
  us: 'var(--merchant)', red: '#b8452f', holy: '#a57a12', iron: '#5b6670', crow: '#3b3346', silver: '#2f7d7a',
  fox: '#c07a2a', bridge: '#7a5c99', free: '#9a9a8c',
};
const STYLE_NOTE: Record<string, string> = {
  volume: '대형 · 얕은 층에 많이 보내고 바로 판다', steady: '대형 · 포션을 넉넉히, 값이 낮으면 쌓아 둔다', deep: '중형 · 깊은 층, 훈련과 거점',
  chaser: '중형 · 지난달 벌이가 좋았던 층으로', hoarder: '중형 · 값이 낮으면 팔지 않고 버틴다', shallow: '소형 · 1층에서만', second: '소형 · 2층에서만',
  crowd: '한 파티짜리 여럿 · 벌이에 따라 늘고 준다',
};
const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
const sgn = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));
const pct = (v: number) => Math.round(v * 100) + '%';
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

function stepper(k: string, i: number, v: number, label: string, step = 1, disabled = false) {
  return `<span class="step"><button type="button" data-k="${k}" data-i="${i}" data-d="${-step}" aria-label="${label} 줄이기"${disabled ? ' disabled' : ''}>−</button><input type="number" inputmode="numeric" data-k="${k}" data-i="${i}" value="${v}" min="0" aria-label="${label}"${disabled ? ' disabled' : ''}><button type="button" data-k="${k}" data-i="${i}" data-d="${step}" aria-label="${label} 늘리기"${disabled ? ' disabled' : ''}>+</button></span>`;
}

// 결정표의 예상치는 경쟁자가 지난달만큼 움직인다고 보고 어림한다 (정보는 지난달 것뿐이다)
export function planHtml(W: World, raw: Plan) {
  const c = us(W), P = sanitize(W, c, raw), L = W.last;
  const others = (f: number) => (L ? L.plans.reduce((a, Q, i) => a + (i ? Q.parties[f] + Q.hire[f] : 0), 0) : f === 0 ? 75 : 0);
  const needP = P.parties.reduce((a, n, f) => a + (n + P.hire[f]) * P.pots[f], 0), chP = Math.min(P.church || 0, needP);
  const unitP = needP ? (chP * churchPrice(W, 0) + (needP - chP) * W.potion) / needP : W.potion;
  const sc = sortieCost(P, unitP);
  const rows = FLOORS.map((F, f) => {
    const open = f < W.unlocked;
    if (!open) return `<tr class="closed"><td><b>${F.name}</b><small>${ITEMS[f].name}</small></td><td colspan="8">${f === W.unlocked ? `아직 닫혀 있다 · 길 뚫기 ${Math.min(99, Math.round(W.prog / CO.OPEN_WINS[W.unlocked - 1] * 100))}%` : '아직 닫혀 있다'}</td></tr>`;
    const crowd = P.parties[f] + P.hire[f] + others(f), p = succRate(c, f, P.pots[f], crowd);
    // 층에 남은 양은 보이지 않는다. 지난달 우리 성공 파티가 캐 온 양을 가득할 때의 양과 견줘 짐작한다
    const lr = L ? L.res[0] : null, per = lr && lr.ok[f] ? (lr.got[f] / lr.ok[f]).toFixed(1) : '-';
    const root = W.roots && W.roots[f].done ? (W.roots[f].done === 'seal' ? ' · 봉인' : ' · 채굴장') : '';
    return `<tr><td><b>${F.name}</b><small>${ITEMS[f].name} · 위험 ${pct(F.risk)}${root}</small></td>
      <td class="n" data-l="지난달 남들">${others(f)}조</td><td class="n" data-l="지난달 우리 성공 조당">${per}${per === '-' ? '' : '개'}<small>가득하면 ${F.take}개</small></td>
      <td data-l="우리 파티">${stepper('parties', f, raw.parties[f], `${F.name} 파티 수`)}</td>
      <td data-l="계약 파티">${stepper('hire', f, raw.hire[f], `${F.name} 계약 파티`)}</td>
      <td data-l="파티당 포션">${stepper('pots', f, raw.pots[f], `${F.name} 파티당 포션`)}</td>
      <td data-l="편성 지침"><select class="guide" data-k="guide" data-i="${f}" aria-label="${F.name} 편성 지침"><option value="">지침 없음</option>${keysAll.map(k => `<option value="${k}"${P.guide[f] === k ? ' selected' : ''}>${keyLabel(k)}</option>`).join('')}</select>${P.guide[f] ? `<small>조당 +${CO.GUIDE_COST}G</small>` : ''}</td>
      <td class="n" data-l="예상 성공률">${P.parties[f] + P.hire[f] ? pct(p) : '-'}</td>
      <td class="n" data-l="출정 비용">${fmt(sc[f] + P.hire[f] * CO.HIRE_FEE)}G</td></tr>`;
  }).join('');
  const sell = ITEMS.map((it, j) => {
    const s = P.sell[j], Qo = L ? L.Q[j] - L.res[0].sold[j] : it.D, est = priceOf(it, Qo + s);
    if (!c.stock[j] && j >= W.unlocked) return '';
    return `<tr><td><b>${it.name}</b><small>${it.buyer}</small></td><td class="n" data-l="창고">${c.stock[j]}</td>
      <td data-l="이번 달 판매량">${stepper('sell', j, s, `${it.name} 판매량`, 5)}<small>${s === c.stock[j] ? (s ? '전부' : '') : `${c.stock[j] - s}개는 창고에`}</small></td>
      <td class="n" data-l="지난달 시장 전체">${L ? L.Q[j] : '-'}</td><td class="n" data-l="지난달 시세">${fmt(W.price[j])}G</td><td class="n" data-l="기준 시세">${fmt(it.P0)}G</td>
      <td class="n" data-l="예상 판매 수입">${fmt(s * est)}G<small>남들이 지난달만큼 팔면 ${fmt(est)}G</small></td></tr>`;
  }).join('');
  const sent = P.parties.reduce((a, b) => a + b, 0), hired = P.hire.reduce((a, b) => a + b, 0);
  const spend = sc.reduce((a, b) => a + b, 0) + hireCost(P) + Math.round(c.members * CO.WAGE * (1 + c.members / CO.OVERHEAD)) + P.train + (P.base ? P.base.amt : 0) + (P.donate || 0) + (P.root ? P.root.seal + P.root.mine : 0);
  const sales = ITEMS.reduce((a, it, j) => { const Qo = L ? L.Q[j] - L.res[0].sold[j] : it.D; return a + P.sell[j] * priceOf(it, Qo + P.sell[j]); }, 0);
  const warn: string[] = [];
  if (raw.parties.reduce((a, b) => a + b, 0) > maxParties(c)) warn.push(`단원이 모자라 ${maxParties(c)}조까지만 보내요`);
  if (c.cash + sales - spend < 0) warn.push('이대로면 금고가 마이너스가 돼요');
  const bf = raw.base ? raw.base.f : Math.max(0, W.unlocked - 1), ba = raw.base ? raw.base.amt : 0;
  return `<div class="kind">회색늑대 용병단 · 행정실</div>
    <h2>제${W.month}월 결정표</h2>
    <p class="lead">파티는 4명 한 조. 단원 ${c.members}명이면 ${maxParties(c)}조까지 직접 보낼 수 있고, 모자라면 군소 용병대를 계약 파티로 빌려요 (한 조 ${CO.HIRE_FEE}G, 캔 것의 ${pct(CO.HIRE_CUT)}는 그들 몫). 예상치는 경쟁자가 지난달처럼 움직인다고 보고 어림한 값이에요.</p>
    <h3>1 · 어느 층에 몇 조를 보낼까</h3>
    <div class="tw"><table class="grid cards"><thead><tr><th>층 · 전리품</th><th class="n">지난달 남들</th><th class="n">지난달 우리<br>성공 조당</th><th>우리 파티</th><th>계약 파티</th><th>파티당 포션 (${W.potion}G)</th><th>편성 지침</th><th class="n">예상 성공률</th><th class="n">출정 비용</th></tr></thead><tbody>${rows}</tbody></table></div>
    <details class="field"${W.notes.length ? ' open' : ''}><summary>현장 기록 · 우리 파티만 가져오는 정보</summary>
      <p class="note">파티마다 직업 넷과 장비 하나가 섞여 들어가요. 그 층에 사는 것의 약점을 갖춘 파티는 잘 돌아오고, 역효과를 갖춘 파티는 크게 당해요. 증언과 성공률을 보고 약점이라 여기는 것을 편성 지침으로 정하면, 우리 파티는 모두 그것을 갖추고 들어가요. 경쟁 용병단도 한 층에 오래 드나들면 약점을 깨쳐요.</p>
      ${fieldHtml(W)}
    </details>
    <h3>2 · 창고의 전리품을 얼마나 팔까</h3>
    <p class="note">이번 달에 캐 온 것은 정산 때 창고로 들어와요. 창고에 두면 매달 ${pct(CO.SPOIL)}씩 상해요.</p>
    <div class="tw"><table class="grid cards"><thead><tr><th>전리품 · 사 가는 곳</th><th class="n">창고</th><th>이번 달 판매량</th><th class="n">지난달 시장 전체</th><th class="n">지난달 시세</th><th class="n">기준 시세</th><th class="n">예상 판매 수입</th></tr></thead><tbody>${sell || '<tr><td colspan="7" class="dim">창고가 비어 있어요</td></tr>'}</tbody></table></div>
    <h3>3 · 투자</h3>
    <div class="invest">
      <label class="box">훈련비 ${stepper('train', 0, raw.train, '훈련비', 100)}<small>훈련도 ${c.skill.toFixed(1)} (성공률 +${(trainBonus(c.skill) * 100).toFixed(1)}%p) → 이번 달 +${(raw.train / 200).toFixed(1)}. 매달 5%씩 식고, 이 훈련비를 계속 내면 훈련도 ${Math.round(raw.train / 10)} (성공률 +${(trainBonus(raw.train / 10) * 100).toFixed(1)}%p)에 머물러요. 갈수록 덜 올라요</small></label>
      <label class="box">전진 거점 <span class="step"><select data-k="basef" aria-label="거점을 둘 층">${FLOORS.slice(0, W.unlocked).map((F, f) => `<option value="${f}"${f === bf ? ' selected' : ''}>${F.name}</option>`).join('')}</select></span> ${stepper('base', 0, ba, '거점 투자', 500)}<small>${fmt(CO.BASE_STEP)}G마다 1단계 (최대 ${CO.BASE_MAX}). 다음 달부터 그 층 성공률 +5%p, 2단계면 조당 채집 +1. 지금 ${FLOORS.slice(0, W.unlocked).map((F, f) => c.bases[f] ? `${F.name} ${c.bases[f].toFixed(1)}` : '').filter(Boolean).join(' · ') || '없음'}${c.pendingBase ? ` · ${FLOORS[c.pendingBase.f].name} 공사 중` : ''}</small></label>
    </div>
    ${supplyHtml(W, raw, P)}
    ${depthsHtml(W, raw)}
    <div class="sum"><div><span>출정</span><b>${sent} + 계약 ${hired}조</b></div><div><span>지출 (급여 ${fmt(Math.round(c.members * CO.WAGE * (1 + c.members / CO.OVERHEAD)))} 포함)</span><b>${fmt(spend)}</b></div><div><span>예상 판매 수입</span><b>${fmt(sales)}</b></div><div><span>예상 순이익</span><b class="${sales - spend < 0 ? 'neg' : 'pos'}">${sgn(sales - spend)}</b></div></div>
    ${warn.length ? `<div class="warn">${warn.join(' · ')}</div>` : ''}`;
}

// 지난달 정산: 순위표, 층별 채집, 시세표, 동향, 우리 정산
export function resultsHtml(W: World) {
  const L = W.last;
  if (!L) return `<div class="kind">변경 용병단 연합 · 월례 정산</div><h2>첫 정산 전</h2><p class="note">첫 달 결재가 끝나면 순위표와 시세표가 이 자리에 붙어요. 지금은 다들 1층 입구 앞에 줄을 서 있어요.</p>`;
  const named = W.cos.map((c, i) => i).filter(i => W.cos[i].style !== 'crowd');
  const prev = W.history.length > 1 ? W.history[W.history.length - 2].rank : null;
  const order = L.rank.map(id => W.cos.findIndex(c => c.id === id));
  const ci = W.cos.findIndex(c => c.style === 'crowd');
  const row = (i: number) => {
    const c = W.cos[i], r = L.res[i], rk = L.rank.indexOf(c.id) + 1, pr = prev ? prev.indexOf(c.id) + 1 : 0, mv = pr && rk ? pr - rk : 0;
    const got = r.got.reduce((a, b, f) => a + b * ITEMS[f].P0, 0), all = L.res.reduce((a, x) => a + x.got.reduce((s, b, f) => s + b * ITEMS[f].P0, 0), 0);
    return `<tr class="${c.style === 'player' ? 'us' : ''}"><td>${rk ? `<b class="rk">${rk}</b>${mv ? `<span class="mv ${mv > 0 ? 'up' : 'dn'}">${mv > 0 ? '▲' : '▼'}${Math.abs(mv)}</span>` : ''}` : '-'}</td>
      <td><span class="co">${sw(c.id)}${c.name}</span><small>${c.style === 'player' ? '우리' : STYLE_NOTE[c.style]}</small></td>
      <td class="n">${c.members}</td><td class="n">${r.sent.reduce((a, b) => a + b, 0) + r.hired.reduce((a, b) => a + b, 0)}조</td><td class="n">${all ? pct(got / all) : '-'}</td>
      <td class="n">${fmt(r.sales)}</td><td class="n ${r.net < 0 ? 'neg' : 'pos'}">${sgn(r.net)}</td>
      <td class="n">${c.style === 'crowd' ? '-' : fmt(c.cash)}</td><td class="n">${c.style === 'crowd' ? '-' : fmt(worth(W, c))}</td><td class="n">${r.deaths}</td></tr>`;
  };
  const floors = FLOORS.slice(0, Math.max(...L.res.map(r => r.sent.reduce((m, n, f) => (n ? f + 1 : m), 1)))).map((F, f) => {
    const I = L.floors[f], got = L.res.map(r => r.got[f]);
    return `<div class="frow"><b>${F.name}</b><div class="bar" role="img" aria-label="${F.name}에서 모두 ${I.taken}개를 캐 감, 우리 ${got[0]}개">${got.map((n, i) => (n ? `<span style="width:${n / Math.max(1, I.taken) * 100}%;background:${COLORS[W.cos[i].id]}" title="${W.cos[i].name} ${n}개"></span>` : '')).join('')}</div><span class="r">우리 ${got[0]} · 모두 ${I.taken} · ${I.crowd}조</span></div>`;
  }).join('');
  const prices = ITEMS.map((it, j) => {
    if (!L.Q[j] && j >= W.unlocked) return '';
    const sold = L.res.map(r => r.sold[j]);
    return `<tr><td><b>${it.name}</b><small>${it.buyer}</small></td><td class="n">${L.Q[j]}</td><td class="n">${it.D}</td><td class="n"><b>${fmt(L.price[j])}G</b></td><td class="n ${L.price[j] < it.P0 ? 'neg' : 'pos'}">${pct(L.price[j] / it.P0)}</td>
      <td><div class="bar">${sold.map((n, i) => (n ? `<span style="width:${n / Math.max(1, L.Q[j]) * 100}%;background:${COLORS[W.cos[i].id]}" title="${W.cos[i].name} ${n}개"></span>` : '')).join('')}</div></td></tr>`;
  }).join('');
  const r = L.res[0];
  const mine = `<div class="tw"><table class="grid"><thead><tr><th>층</th><th class="n">우리</th><th class="n">계약</th><th class="n">성공</th><th class="n">캐 온 양</th></tr></thead><tbody>${FLOORS.map((F, f) => (r.sent[f] + r.hired[f] ? `<tr><td>${F.name}</td><td class="n">${r.sent[f]}</td><td class="n">${r.hired[f]}</td><td class="n">${r.ok[f]}</td><td class="n">${r.got[f]}</td></tr>` : '')).join('')}</tbody></table></div>
    <div class="tw"><table class="grid"><thead><tr><th>정산</th><th class="n">금액</th></tr></thead><tbody>${ITEMS.map((it, j) => (r.sold[j] ? `<tr><td>${it.name} ${r.sold[j]}개 × ${fmt(L.price[j])}G</td><td class="n">${fmt(r.sold[j] * L.price[j])}</td></tr>` : '')).join('')}
      <tr><td>출정 (포션 ${r.potNeed}병 중 교회 ${r.potC}병 · ${fmt(r.spend.potion)} 포함)</td><td class="n">−${fmt(r.spend.sortie + r.spend.potion)}</td></tr>
      ${r.spend.hire ? `<tr><td>계약 파티 수수료</td><td class="n">−${fmt(r.spend.hire)}</td></tr>` : ''}
      <tr><td>급여</td><td class="n">−${fmt(r.spend.wage)}</td></tr>
      ${r.spend.recruit ? `<tr><td>신입 계약금 (${r.recruited}명)</td><td class="n">−${fmt(r.spend.recruit)}</td></tr>` : ''}
      ${r.spend.root ? `<tr><td>근원 기금</td><td class="n">−${fmt(r.spend.root)}</td></tr>` : ''}
      ${r.spend.donate ? `<tr><td>교회 후원금</td><td class="n">−${fmt(r.spend.donate)}</td></tr>` : ''}
      ${r.spend.train + r.spend.base ? `<tr><td>훈련 · 거점</td><td class="n">−${fmt(r.spend.train + r.spend.base)}</td></tr>` : ''}
      <tr class="tot"><td>순이익</td><td class="n ${r.net < 0 ? 'neg' : 'pos'}">${sgn(r.net)}</td></tr></tbody></table></div>`;
  return `<div class="kind">변경 용병단 연합 · 월례 정산</div>
    <h2>제${L.month}월 용병단 순위</h2>
    <div class="tw"><table class="grid wide"><thead><tr><th>순위</th><th>용병단</th><th class="n">단원</th><th class="n">출정</th><th class="n">채집 점유율</th><th class="n">판매 수입</th><th class="n">순이익</th><th class="n">금고</th><th class="n">평가액</th><th class="n">사망</th></tr></thead>
      <tbody>${order.map(row).join('')}${ci >= 0 ? row(ci) : ''}</tbody></table></div>
    <div class="cols2">
      <div><h3>층별로 누가 캐 갔나</h3><div class="floors">${floors}</div><div class="legend">${named.concat(ci >= 0 ? [ci] : []).map(i => `<span class="co">${sw(W.cos[i].id)}${W.cos[i].name}</span>`).join('')}</div></div>
      <div><h3>동향</h3><ul class="co-news">${newsLines(W).map(t => `<li>${t}</li>`).join('')}</ul></div>
    </div>
    <h3>시세표</h3>
    <div class="tw"><table class="grid wide"><thead><tr><th>전리품</th><th class="n">시장 전체 판매</th><th class="n">수요</th><th class="n">시세</th><th class="n">기준 대비</th><th>누가 팔았나</th></tr></thead><tbody>${prices}</tbody></table></div>
    <h3>귀환 보고 · 우리 직영 파티</h3>
    ${returnHtml(W)}
    <h3>우리 정산</h3>
    <div class="mine">${mine}</div>
    ${paperHtml(W)}`;
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
    if (ITEMS.some((_, j) => c.stock[j] > 20 && r.sold[j] === 0)) out.push(`${c.name}이 창고 문을 걸어 잠갔다는 말이 돈다. 값이 오르기를 기다리는 모양이다.`);
  });
  return out.slice(0, 7);
}

// 현장 기록: 층마다 들은 증언(최근 넷)과, 구성별로 갖춘 파티와 안 갖춘 파티의 성공률
export function fieldHtml(W: World) {
  const open = FLOORS.slice(0, W.unlocked).map((F, f) => {
    const notes = W.notes.filter(n => n.f === f).slice(-4).reverse(), all = W.obs[f]['*'];
    if (!notes.length && !all) return `<div class="fblock"><b>${F.name}</b><p class="note">아직 우리 파티가 가 보지 않았어요.</p></div>`;
    const rows = Object.entries(W.obs[f]).filter(([k, v]) => k !== '*' && v.n >= 3).map(([k, v]) => {
      const off = all.n - v.n, offR = off ? (all.w - v.w) / off : 0, r = v.w / v.n, d = off >= 3 ? r - offR : 0;
      return { k, n: v.n, r, d, off };
    }).sort((a, b) => b.d - a.d);
    return `<div class="fblock"><b>${F.name}</b> <span class="dim">우리 파티 ${all ? all.n : 0}조 출정 · 성공 ${all ? pct(all.w / all.n) : '-'}</span>
      <ul class="notes">${notes.map(n => `<li><span class="dim">제${n.m}월</span> ${n.t}</li>`).join('')}</ul>
      ${rows.length ? `<div class="chips">${rows.map(x => `<span class="chip ${x.off >= 3 && x.d >= 0.12 ? 'up' : x.off >= 3 && x.d <= -0.12 ? 'dn' : ''}" title="갖춘 파티 ${x.n}조 성공 ${pct(x.r)}">${keyLabel(x.k)} ${pct(x.r)}${x.off >= 3 ? ` (${x.d >= 0 ? '+' : '−'}${Math.round(Math.abs(x.d) * 100)}%p)` : ''}</span>`).join('')}</div>` : ''}</div>`;
  });
  return `<div class="fgrid">${open.join('')}</div>`;
}

// 포션 구매처와 세력: 상단·교회 포션 값, 교회 한도, 우리와의 사이, 담합 형편. 교회 병 수와 후원금은 숫자로 정한다
export function supplyHtml(W: World, raw: Plan, P: Plan) {
  const c = us(W), K = W.cartel, need = P.parties.reduce((a, n, f) => a + (n + P.hire[f]) * P.pots[f], 0);
  const pc = churchPrice(W, 0), church = Math.min(P.church || 0, need);
  const rel = (v: number | undefined) => { const x = Math.round(v ?? 50); return `${x} ${x >= 65 ? '(가까움)' : x <= 35 ? '(멀어짐)' : '(보통)'}`; };
  const status = K ? (K.churchOut ? `담합 중 · 교회는 빠졌어요. 후원한 용병단에만 예전 값(${CO.POTION_C0}G)으로 팔아요 (${K.left}개월 남음)${K.donated[0] ? '' : '. 우리도 후원하면 예전 값으로 살 수 있어요'}` : `<b class="neg">담합 중</b> · 상단과 교회가 값을 ${Math.round((CO.CARTEL_MARKUP - 1) * 100)}% 올렸어요 (${K.left}개월 남음). 교회 후원이 모두 합쳐 ${fmt(CO.BREAK_DONATION)}G 쌓이면 교회가 빠져요 (지금 ${fmt(K.donated.reduce((a, b) => a + b, 0))}G)`) : '담합 없음';
  return `<h3>4 · 포션은 어디서 살까</h3>
    <p class="note">${status}</p>
    <div class="invest">
      <label class="box">교회 성수 포션 ${stepper('church', 0, raw.church || 0, '교회에서 살 포션 병 수', 10)}<small>교회 ${pc}G · 상단 ${W.potion}G (지난달). 이번 달 우리에게 필요한 포션 ${need}병 중 ${church}병을 교회에서, 나머지는 상단에서 사요. 교회는 한 달 ${CO.CHURCH_CAP}병까지만 내고, 모자라면 사이가 좋은 용병단부터 줘요. 성수가 섞여 있어 같은 병 수라도 사망이 더 줄어요.</small></label>
      <label class="box">교회 후원금 ${stepper('donate', 0, raw.donate || 0, '교회 후원금', 100)}<small>교회와 가까워지고 상단과는 조금 멀어져요. 담합 중에 후원이 쌓이면 교회가 담합에서 빠지고, 후원한 용병단에만 예전 값으로 팔아요. 이번 달만 나가는 돈이에요.</small></label>
    </div>
    <p class="note">우리와의 사이 · 상단 ${rel(c.relM)} · 교회 ${rel(c.relC)}. 상단 포션을 사면 상단과, 교회 포션을 사면 교회와 가까워져요. 상단과 가까우면 상단 경매장(가죽·마석)이 조금 더 쳐줘요.</p>`;
}

// 귀환 보고: 우리 직영 파티 하나하나가 무엇을 갖추고 들어가 어떻게 돌아왔나 (지난달 기록만 읽는다)
const CLS_SHORT = (k: string) => (k.startsWith('c:') ? k.slice(2) : '');
export function returnHtml(W: World) {
  const L = W.last; if (!L || !L.ours || !L.ours.length) return '<p class="note">이번 달 우리 직영 파티는 미궁에 들어가지 않았어요.</p>';
  const r = L.res[0], P = L.plans[0];
  const blocks = FLOORS.map((F, f) => {
    const ps = L.ours.filter(x => x.f === f); if (!ps.length) return '';
    const ok = ps.filter(x => x.ok).length, d = ps.reduce((a, x) => a + x.d, 0);
    const g = P.guide[f], withG = g ? ps.filter(x => x.keys.includes(g)) : [];
    const chips = ps.map(x => {
      const cls = x.keys.map(CLS_SHORT).filter(Boolean).join('·'), gear = x.keys.find(k => k.startsWith('g:'));
      return `<span class="pc ${x.ok ? 'ok' : 'no'}"><i>${x.ok ? '✓' : '–'}</i><span>${cls || '혼성'}</span>${gear ? `<span class="pt-gear">${gear.slice(2)}</span>` : ''}${x.d ? `<b class="neg">${x.d}명</b>` : ''}</span>`;
    }).join('');
    return `<section class="rf"><div class="rf-h"><b>${F.name}</b><span class="rf-sum">${ps.length}조 중 ${ok}조 성공${d ? ` · <span class="neg">${d}명 사망</span>` : ''} · 캐 온 양 ${r.got[f]}개${r.hired[f] ? ` (계약 ${r.hired[f]}조 몫 포함)` : ''}${g ? ` · 지침 '${keyLabel(g)}' 갖춘 조 ${withG.filter(x => x.ok).length}/${withG.length} 성공` : ''}</span></div><div class="rf-p">${chips}</div></section>`;
  }).join('');
  return `<div class="co-ret">${blocks}</div>`;
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
