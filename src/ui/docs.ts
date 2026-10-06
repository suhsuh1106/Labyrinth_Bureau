// 서류함 탭
import { AGENDAS, has } from '../core/agendas';
import { C, OFFERS, PROV, ROOT_LORE, TARGETS } from '../core/data';
import { fameWord } from '../core/hero';
import { doc, rows } from '../core/html';
import { S } from '../core/state';
import { evalItems } from '../core/turn';
import { fmt, keyLabel, keyWord, pct, pick, sgn, val } from '../core/util';
import { allFacs, done } from '../core/world';
import { lineChart } from './charts';
import { trustWord } from './explore';

export function intelDoc() {
  const I = S.intel, lv = ['낮음', '주의', '높음'];
  const acc = I.q >= 0.8 ? '높음' : I.q >= 0.5 ? '보통' : '낮음';
  const crop = ['평년작으로 보입니다', '<span class="ng">흉작 조짐이 있습니다.</span> 두어 달 안에 포션 원가가 오를 수 있습니다', '<span class="ng">흉작입니다.</span> 원가 상승이 이어집니다'][I.crop];
  const risk = I.risk == null ? '이미 값을 맞춘 것으로 보입니다' : `<span class="${['ok', '', 'ng'][I.risk]}">${lv[I.risk]}</span>`;
  return doc({ kind: '시장 조사 보고 · 정보원', title: '앞으로 두어 달의 전망', from: `정보 신뢰도 ${acc}`,
    body: rows([['남부 약초 작황', crop], ['상단·교회 담합 위험', risk]])
      + (I.reasons.length ? `<p class="from" style="margin-top:8px">위험을 키우는 것</p><ul class="feed">${I.reasons.map(r => `<li>${r}</li>`).join('')}</ul>`
        : I.risk != null && I.q < 0.5 ? '<p class="dim">조사비를 더 쓰면 위험을 키우는 이유까지 알 수 있어요.</p>' : '')
      + (I.leak ? `<p>전리품 쪽 소식: ${I.leak}</p>` : '')
      + `<p class="from">대비: 필요량보다 포션을 더 사면 창고에 비축돼요 (최대 ${C.STOCK_CAP}병, 매달 5% 상함). 비축분으로 버티며 주문을 줄이면 값을 올린 공급처도 오래 못 버팁니다.</p>` });
}

export const arrow = (a, b, u = 'G') => a === b ? `${fmt(b)}${u}` : `${fmt(a)} → ${fmt(b)}${u}`;

export function logList() { return `<ul>${S.log.map(e => `<li><span class="num">${e.m}월</span> · ${e.t}</li>`).join('')}</ul>`; }

export function ledgerDocM(lm) {
  const sales = lm.q * lm.price, buy = lm.q * lm.cost, ship = lm.q * 8;
  const list: any[] = [
    { sec: '포션 (지난달 → 이번 달)' },
    ['매입 원가', arrow(lm.prevCost, lm.cost, 'G/병')],
    ['관리국 납품 단가', arrow(lm.prevPrice, lm.price, 'G/병')],
    { sec: '이번 달 장부' },
    [`관리국 납품 ${lm.q}병`, fmt(sales)],
    ['포션 매입', fmt(buy)],
    ['운송·창고', fmt(ship)],
  ];
  if (lm.rebate > 0) list.push(['신전 축복 수수료', fmt(lm.rebate)]);
  if (lm.skim > 0) list.push(['전리품 감정 차익 (용병 매입가와 판매가 차이)', `+${fmt(lm.skim)}`]);
  list.push({ sum: true, 0: '조합 순익', 1: fmt(sales - buy - ship - lm.rebate + (lm.skim || 0)) });
  return doc({ cls: 'merchant', kind: '감찰 사본 · 대외비', title: `상단 조합 장부 (제${lm.month}월)`, stamp: '감찰', body: rows(list) });
}

export function ledgerDocC(lc) {
  const sales = lc.q * lc.price;
  const list: any[] = [
    { sec: '성수 포션 (지난달 → 이번 달)' },
    ['원가', arrow(lc.prevCost, lc.cost, 'G/병')],
    ['관리국 납품 단가', arrow(lc.prevPrice, lc.price, 'G/병')],
    { sec: '수입 (지난달 → 이번 달)' },
    [`포션 판매 (${lc.q}병)`, arrow(lc.prevSales, sales)],
    ['관리국 헌금', fmt(lc.donation)],
  ];
  if (lc.rebate > 0) list.push(['기타 기부 수입 (기부자 미기재)', fmt(lc.rebate)]);
  list.push({ sum: true, 0: '이번 달 수입 합계', 1: fmt(sales + lc.donation + lc.rebate) });
  return doc({ cls: 'church', kind: '감찰 사본 · 대외비', title: `교회 회계 장부 (제${lc.month}월)`, stamp: '감찰', body: rows(list) });
}

export function agendaDoc() {
  const A = AGENDAS.find(a => a.id === S.agenda.id), pick = S.agenda.pick;
  const opts = A.opts.map((o, i) => {
    const ok = !o.need || o.need(), on = pick === i;
    return `<div class="notice ${on ? A.who : ''}" style="${ok ? '' : 'opacity:.55'}"><div class="guide" style="margin:0">
      ${ok ? `<button type="button" class="btn ${on ? '' : 'ghost'}" data-action="agenda" data-i="${i}" aria-pressed="${on}">${on ? '✓ ' : ''}${o.label}${o.cost ? ` (${fmt(o.cost)}G)` : ''}</button>`
        : `<span class="dim">${o.label} · ${o.needText}</span>`}${i === A.def ? '<span class="dim" style="font-size:12px">고르지 않으면 이걸로 처리</span>' : ''}</div>
      <p style="margin:4px 0 0;font-size:13px">${val(o.desc)}</p></div>`;
  }).join('');
  return doc({ cls: A.who, kind: '안건 · 이번 결재와 함께 처리', title: A.title, from: A.name,
    body: `<p>${A.text()}</p>${opts}` });
}

export function renderDocsTab() {
  const top = [], events = [], reports = [], bottom = [];
  if (S.over) top.push(endingDoc());
  if (S.month === 1) {
    top.push(doc({ kind: '제국 행정성 · 인사 통지', title: '미궁 관리국장 부임을 명함', from: '제1월 1일', stamp: '임명',
      body: `<p>서부 변경에 미궁이 열렸습니다. 관리국은 아직 이름뿐입니다. 사무소도, 포션을 대 줄 곳도, 전리품을 팔 곳도 없습니다. 수도가 보낸 초기 예산 ${fmt(S.treasury)}G로 맨땅에서 관리국을 세우십시오.</p>
      <p>결재함의 <b>개척 사업</b>에서 무엇부터 지을지 고릅니다. <b>면허 사무소, 포션 공급망, 전리품 판로</b> 세 가지가 서면 관리국이 정식으로 문을 열고, 부서를 신설해 맡길 일을 늘릴 수 있습니다.</p>
      <p>벌써 개척 용병 ${S.M}명이 미궁에 드나들고 있습니다. 용병 한 명은 매달 포션 <b>2병</b>과 식량 <b>1인분</b>이 필요하고, 파티마다 장비 정비와 짐꾼이 필요합니다. 포션이 모자라면 죽고, 식량이 모자라면 떠납니다. 지금은 떠돌이 상인에게 웃돈을 주고 사야 합니다. 판로가 없는 동안 그들이 가져온 전리품은 창고에 쌓입니다.</p>
      <p>무엇을 누구에게 맡기느냐는 한 번 정하면 오래 갑니다. 상단과 교회는 저마다 셈이 있습니다.</p>
      <p>임기는 ${C.MONTHS}개월이고, 12개월마다 수도가 임기를 평가합니다. 금고가 석 달 연속 마이너스면 해임됩니다.</p>` }));
  }
  if (S.notes.length) top.push(`<div class="memo"><div class="memo-head">제${S.month}월 서기의 메모 · 이번 달 들려오는 말</div><ul>${S.notes.map(n => `<li>${n}</li>`).join('')}</ul></div>`);

  const ev = S.evals[S.evals.length - 1];
  if (ev && ev.month === S.month) {
    events.push(doc({ cls: 'secret', kind: '제국 행정성 · 임기 평가', title: `${ev.year}년 차 평가: ${ev.grade}`, from: `제${S.month - 1}월 말 기준`, stamp: ev.grade,
      body: rows(ev.items.map(i => [`${i.label} (목표 ${i.target})`, `<span class="${i.ok ? 'ok' : 'ng'}">${i.actual} ${i.ok ? '달성' : '미달'}</span>`])) + `<p>${ev.reward}</p>` }));
  }
  S.eventDocs.filter(d => d.month === S.month).forEach(d => events.push(doc(d)));
  if (S.agenda) events.unshift(agendaDoc());
  if (S.intel && S.intel.month === S.month) events.push(intelDoc());
  S.offers.forEach(o => {
    const O = OFFERS[o.id];
    events.push(doc({ cls: O.who, kind: `${O.who === 'merchant' ? '상단' : '교회'}의 제안 · 이번 달까지`, title: O.title, from: O.name,
      body: `<div class="notice ${O.who}"><q>${O.text}</q></div><p>${O.terms}</p><div class="guide">${o.accepted
        ? `<span class="ok">수락함 · 다음 결재에 반영</span><button type="button" class="btn ghost" data-action="offer" data-id="${o.id}">수락 취소</button>`
        : `<button type="button" class="btn" data-action="offer" data-id="${o.id}">수락${O.cost ? ` (${fmt(O.cost)}G)` : ''}</button><span class="dim">수락하지 않으면 이번 달이 지나면 사라져요</span>`}</div>` }));
  });
  if (S.notices.length) {
    events.push(doc({ cls: 'secret', kind: '소모품 계약 · 단가 변경 통보', title: '공급처에서 서신이 왔습니다', from: `제${S.month}월`,
      body: S.notices.map(n => `<div class="notice ${n.who}"><div class="who">${n.name}${n.date ? ` · <span class="num">${n.date}</span>` : ''}</div><q>${n.text}</q></div>`).join('') }));
  }
  if (S.talk) {
    const t = S.talk;
    const list: any[] = [
      { sec: '상단 쪽에 남으면 얻는 것 (매달)' },
      [`상단이 보내던 '축복 수수료'${t.spooked ? ' · 감찰 이후 위험한 돈이라 40%로 침' : ''}`, t.spooked ? `${fmt(t.rebate)} → ${fmt(t.rebate * 0.4)}` : fmt(t.rebate)],
      [`비싼 값으로 더 번 돈 (관리국에 ${t.qC}병 × ${t.over}G 웃돈)`, fmt(t.extra)],
      { sum: true, 0: '담합으로 얻는 몫', 1: fmt(t.value) },
      { sec: '관리국 쪽으로 오면 얻는 것' },
      [`관리국 헌금 · 깨끗한 돈이라 1.5배로 침${t.gC > 0 ? ' · 쌓인 서운함만큼 깎음' : ''}`, `${fmt(t.donation)} → ${fmt(t.offer)}`],
      { sum: true, 0: '헌금의 무게', 1: fmt(t.offer) },
    ];
    events.push(doc({ cls: 'church', kind: '면담 기록 · 관리국장실', title: '대사제가 찾아왔습니다', from: `제${t.month}월 말`, stamp: '면담',
      body: `<p>"상단 조합장이 매달 보내던 돈은 '축복 수수료'라 불렀지만, 결국 장부에 이름을 쓸 수 없는 돈이었습니다.${t.spooked ? ' 감찰관께서 회계실을 다녀가신 뒤로는 언제 터질지 모르는 약점이 되었지요.' : ''} 관리국의 헌금은 신전 이름을 높이는 돈입니다. 교회는 상단과의 약조를 끊겠습니다."</p>
      <p class="from">서기가 대사제의 말을 숫자로 옮겨 적었습니다. 앞으로는 이 수준의 헌금이 새 관례가 됩니다.</p>` + rows(list) }));
  }
  if (S.ledgers) { if (S.ledgers.m) events.push(ledgerDocM(S.ledgers.m)); if (S.ledgers.c) events.push(ledgerDocC(S.ledgers.c)); }

  const L = S.last;
  if (L) {
    const exp = [[`상단 포션 ${L.qM}병 × ${L.P.m}G`, fmt(L.sM)], [`교회 포션 ${L.qC}병 × ${L.P.c}G`, fmt(L.sC)]];
    if (L.sW) exp.push([L.qW ? `공방 포션 ${L.qW}병 × ${C.WS_COST}G` : '공방 건설비', fmt(L.sW)]);
    Object.keys(PROV).forEach(k => { const it = L.pv[k]; exp.push([`${PROV[k].name} ${pct(it.cov)} 충족`, fmt(it.spend)]); });
    if (L.fee) exp.push(['공략본 발간비', fmt(L.fee)]);
    if (L.facCost) exp.push(['개척 시설 착공', fmt(L.facCost)]);
    if (L.upkeep) exp.push(['시설 유지비', fmt(L.upkeep)]);
    if (L.offers) exp.push(['세력 제안 수락', fmt(L.offers)]);
    if (L.agc) exp.push(['안건 처리비', fmt(L.agc)]);
    if (L.extra) exp.push(['약속한 정기 지출 (위로금·인건비 등)', fmt(L.extra)]);
    exp.push([L.b.donR ? '정통파 헌금' : '교회 헌금', fmt(L.b.donation)]);
    if (L.b.donR) exp.push(['개혁파 헌금', fmt(L.b.donR)]);
    reports.push(doc({ kind: '재무과 보고', title: `제${L.month}월 결산`, from: `금고 ${sgn(L.net)}G`,
      body: rows([
        { sec: '수입' },
        [`통행세 (용병 ${L.M}명 × ${L.tollRate}G)`, fmt(L.toll)],
        [`전리품 거래 (성공한 파티 ${L.ex.wins}개 · 파티당 ${fmt(L.loot / Math.max(1, L.ex.wins))}G)`, fmt(L.loot)],
        ...(L.heroLoot ? [[`용사 파티 전리품 (원정 ${L.hr.runs}번 중 성공 ${L.hr.wins}번)`, fmt(L.heroLoot)]] : []),
        ...(L.ex.feeIn ? [['층별 입장료', fmt(L.ex.feeIn)]] : []),
        ...(L.lord ? [['하르덴 백작의 사례금', fmt(L.lord)]] : []),
        ...(L.mtax ? [['시장세 (마을 가게들)', fmt(L.mtax)]] : []),
        ...(L.quests && L.quests.length ? [[`의뢰 수수료 (${L.quests.length}건 중 ${L.quests.filter(q => q.done).length}건 완수)`, fmt(L.questFee)]] : []),
        ...(L.grant ? [['영주 보조금', fmt(L.grant)]] : []),
        { sec: '지출' }, ...exp,
        ['시장 조사비', fmt(L.b.intel || 0)],
        ['감찰비', fmt(L.b.audit)],
        ['공략 지원금', fmt(L.b.support)],
        ...(L.ex.trial && L.ex.trial.n ? [[`시험 탐사 ${L.ex.trial.n}개 파티`, fmt(L.ex.trial.n * C.TRIAL_COST)]] : []),
        ...(L.ex.feeOut ? [['층별 입장 보조금', fmt(L.ex.feeOut)]] : []),
        ...(L.sup && L.sup.rentSpend ? [[`장비 대여 ${L.sup.sets}벌`, fmt(L.sup.rentSpend)]] : []),
        ...(L.sup && L.sup.priestSpend ? [[`사제 파견 ${L.sup.priestPaid}명 요청 (${L.sup.priests}명 옴)`, fmt(L.sup.priestSpend)]] : []),
        ...(L.sup && L.sup.recruitSpend ? [[`직업 장려금 ${L.sup.heads}명`, fmt(L.sup.recruitSpend)]] : []),
        ...(L.hr && L.hr.spend ? [['용사 파티 (후원금·장비·홍보)', fmt(L.hr.spend)]] : []),
        [`관리국 운영비`, fmt(L.fixed)],
        { sum: true, 0: '이번 달 손익', 1: `<span class="${L.net < 0 ? 'neg' : 'pos'}">${sgn(L.net)}</span>` },
      ]) }));
    reports.push(supplyReport(L));
    reports.push(doc({ kind: '현장 보고', title: `제${L.month}월 미궁 현황`, from: '현장 사무소',
      body: rows([
        ['출발한 파티 / 성공', `${L.ex.n} / ${L.ex.wins}개 (${pct(L.ex.wins / Math.max(1, L.ex.n))})`],
        ['필요 포션 / 지급 포션', `${fmt(L.need)} / ${fmt(Math.min(L.need, L.qM + L.qC + L.qW + (L.draw || 0)))}병 (${pct(L.cov)})`],
        ['창고에서 꺼냄 / 새로 비축', `${L.draw || 0} / ${L.toStock || 0}병 · 남은 재고 ${L.stock || 0}병`],
        ['사망', `${L.deaths}명`],
        ['면허 반납 후 떠남', `${L.leave}명`],
        ['새로 면허 발급', `${L.arrive}명`],
        { sum: true, 0: '현재 용병', 1: `${S.M}명` },
      ]) + `<p class="from">층별 기록과 파티 통계는 탐사 기록 탭에 있습니다.</p>` }));
  }

  if (!S.over) {
    const year = Math.ceil(S.month / 12), T = TARGETS[year - 1];
    bottom.push(`<div class="memo"><div class="memo-head">${year}년 차 임기 목표 · 제${year * 12}월 말 평가 (${year * 12 - S.month + 1}개월 남음)</div>
      <div class="tablewrap"><table class="stats">${evalItems(T).map(i => `<tr><td>${i.label}</td><td>${i.target}</td><td class="${i.ok ? 'ok' : 'ng'}">${i.actual}</td></tr>`).join('')}</table></div>
      <p class="dim" style="margin:6px 0 0;font-size:12px">5개 중 4개 이상이면 우수(보조금), 1개 이하면 미흡. 미흡이 두 번이면 소환됩니다.</p></div>`);
  }
  if (S.log.length && !S.over) {
    const recent = S.log.slice(-6).reverse();
    bottom.push(`<div class="memo"><div class="memo-head">사건 일지 · 최근 ${recent.length}건</div><ul>${recent.map(e => `<li><span class="num">${e.m}월</span> · ${e.t}</li>`).join('')}</ul>${S.log.length > 6 ? `<details><summary style="cursor:pointer;font-size:13px">전체 일지 ${S.log.length}건 보기</summary>${logList()}</details>` : ''}</div>`);
  }
  if (S.hist.length) {
    const h = S.hist, tv = h.map(r => r.treasury), step = 10000;
    const tmin = Math.floor(Math.min(-10000, ...tv) / step) * step, tmax = Math.ceil(Math.max(30000, ...tv) / step) * step;
    const tt = []; const st = (tmax - tmin) > 80000 ? 40000 : step; for (let v = tmin; v <= tmax; v += st) tt.push(v);
    bottom.push(`<div class="charts">
      <div class="chart"><h4>금고 (G)</h4><div class="legend"><span><i style="background:var(--ink)"></i>월말 잔액</span></div>
        ${lineChart([{ color: 'var(--ink)', vals: tv }], { min: tmin, max: tmax, ticks: tt, fmtTick: v => (v / 1000) + 'k' })}</div>
      <div class="chart"><h4>용병 수 (명)</h4><div class="legend"><span><i style="background:var(--good)"></i>월말 인원</span></div>
        ${lineChart([{ color: 'var(--good)', vals: h.map(r => r.M) }], { min: 0, max: 250, ticks: [0, 50, 100, 150, 200, 250] })}</div></div>`);
  }
  const head = (t) => `<div class="tray-head">${t}</div>`;
  return [
    ...top,
    events.length ? head(`제${S.month}월에 새로 온 서류 ${events.length}건`) : '', ...events,
    reports.length ? head('지난달 보고') : '', reports.length ? `<div class="grid2">${reports.join('')}</div>` : '',
    ...bottom,
  ].join('');
}

// 보급품별로 100%에 얼마가 필요했고, 얼마를 넣었고, 모자라서 무엇을 잃었는지
export function supplyReport(L) {
  // 포션은 공급처가 여럿이라, 실제로 쓴 돈에 모자란 병을 상단가로 채웠을 금액을 더해 100% 기준으로 본다
  const potGot = Math.min(L.need, L.qM + L.qC + L.qW + (L.draw || 0));
  const potFull = L.sM + L.sC + L.sW + (L.need - potGot) * L.P.m;
  const row = (name, full, spent, cov, lost) => `<tr><td>${name}</td><td>${fmt(full)}</td><td>${fmt(spent)}</td><td class="${cov < 0.95 ? 'ng' : ''}">${pct(cov)}</td></tr>`
    + (cov < 0.995 ? `<tr><td colspan="4" class="ng" style="text-align:left;white-space:normal;font-family:var(--f-body);font-size:12px;padding-top:0">모자라서 ${lost}</td></tr>` : '');
  const pv = L.pv, rLost = L.ex.n ? pct(L.ex.repairLost / L.ex.n) : '0%';
  const lines = [
    row('포션', potFull, L.sM + L.sC + L.sW, L.cov, `사망 위험 ×${(1 + 1.5 * (1 - L.cov)).toFixed(2)}, 성공률 하락`),
    row('식량', pv.food.full, pv.food.spend, pv.food.cov, `떠난 용병 +${L.fLeave}명${pv.food.fulfill < 1 ? ` (교회가 ${pct(pv.food.fulfill)}만 내줌)` : ''}`),
    row('장비 정비', pv.repair.full, pv.repair.spend, pv.repair.cov, `성공률 −${rLost}p (성공 약 ${L.ex.repairLost.toFixed(1)}회 놓침)`),
    row('운송', pv.haul.full, pv.haul.spend, pv.haul.cov, `전리품 −${fmt(L.ex.haulLost)}G`),
  ].join('');
  const worst = Object.keys(PROV).filter(k => pv[k].cov < 0.95).map(k => PROV[k].name).concat(L.cov < 0.95 ? ['포션'] : []);
  return doc({ kind: '보급과 보고', title: `제${L.month}월 보급 충족`, from: worst.length ? `<span class="ng">${worst.join('·')} 부족</span>` : '모두 충족',
    body: `<div class="tablewrap"><table class="stats"><tr><th>물품</th><th>100%에 필요</th><th>집행</th><th>충족</th></tr>${lines}</table></div>
      <p class="from">용병이 늘고 깊은 층이 열리면 같은 돈으로는 100%를 못 채웁니다. 돈이 모자랄 때 어디를 깎을지는 관리국장의 몫입니다.</p>` });
}

export function endingDoc() {
  const best = S.evals.filter(e => e.grade === '우수').length;
  const title = S.over === 'fired' ? '해임 통지' : S.over === 'empty' ? '미궁 운영 중단' : S.over === 'recalled' ? '소환 명령' : best >= 2 ? '수도 복귀 명령' : '임기 만료';
  const lead = S.over === 'fired' ? '금고가 석 달 연속 마이너스를 기록해 관리국장직에서 해임되었습니다.'
    : S.over === 'empty' ? '용병이 40명 아래로 줄어 미궁 운영이 멈췄습니다.'
    : S.over === 'recalled' ? '두 번의 미흡 평가로 수도가 관리국장을 소환했습니다.'
    : best >= 2 ? `${C.MONTHS}개월 임기를 마쳤습니다. 수도가 당신을 차기 국장 후보로 부릅니다.` : `${C.MONTHS}개월 임기를 마쳤습니다. 수도는 당신을 이 변경에 더 두기로 했습니다.`;
  const solved = S.floors.filter(f => f.guide && f.guideOk).length;
  return doc({ cls: 'secret', kind: '제국 행정성', title, stamp: S.over === 'done' ? '평가' : '통지',
    body: `<p>${lead}</p>` + rows([
      ['최종 금고', `<span class="${S.treasury < 0 ? 'neg' : ''}">${fmt(S.treasury)}G</span>`],
      ['남은 용병', `${S.M}명 · ${trustWord()}`],
      ['누적 사망', `${S.deathsTotal}명`],
      ['개척한 층', `${S.unlocked}층 (${Math.round(S.floors[S.unlocked - 1].prog)}%)`],
      ['맞힌 공략본', `${solved}개`],
      ['명성', `${Math.round(S.fame)} · ${fameWord()}`],
      ['용사 파티', S.hero ? `${S.hero.members.map(m => m.name).join(', ')} · 원정 ${S.hero.runs}번` : has('hero') ? '흩어짐' : '꾸리지 않음'],
      ...(S.heroFallen.length ? [['떠나거나 쓰러진 용사', S.heroFallen.map(m => `${m.name}(${m.end})`).join(', ')]] : []),
      ['지은 시설', allFacs().filter(f => done(f.id)).map(f => f.name).join(', ') || '없음'],
      ['임기 평가', S.evals.map(e => `${e.year}년 차 ${e.grade}`).join(' · ') || '-'],
      ['담합 발생', `${S.cartels}번 · ${S.cartelMonths}개월`],
      ['담합 때문에 더 낸 돈', `${fmt(S.overpaid)}G`],
    ]) + `<p class="from" style="margin-top:14px">각 층의 정체</p><ul>${S.floors.map((f, i) => `<li>${i + 1}층 · ${f.mon.name}${f.mon.trap ? ' (겉모습과 다른 함정)' : ''} → ${keyLabel(f.mon.key)}${f.adapted ? `, ${f.adapted}월에 적응해 ${keyLabel(f.mon.alt)}` : ''} · 역효과 ${keyWord(f.mon.bad)} · 습성 ${f.habitKnown ? '알아냄' : '모름'} · 근원 ${done('seal' + i) ? '봉인' : done('mine' + i) ? '채굴' : f.root ? '찾음' : '못 찾음'}</li>`).join('')}</ul>`
      + (S.log.length ? `<p class="from" style="margin-top:14px">사건 일지</p>${logList()}` : '')
      + (S.floors.some(f => f.root) ? `<p class="from" style="margin-top:14px">근원에서 읽어 낸 것</p><ul class="feed">${ROOT_LORE.slice(0, S.floors.filter(f => f.root).length).map(t => `<li>${t}</li>`).join('')}</ul>` : '')
      + (S.anoms.length ? `<p style="margin-top:14px">그리고 미궁은 아직 숨 쉬고 있습니다. 학술원의 보고서는 수도의 서랍 속에서 누군가 읽어 주기를 기다립니다. <span class="dim">(이야기는 여기서 이어집니다)</span></p>` : '')
      + `<p><button type="button" class="approve" data-action="restart" style="margin-top:12px">처음부터 다시</button></p>` });
}
