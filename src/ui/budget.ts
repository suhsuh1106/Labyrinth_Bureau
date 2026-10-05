// 예산안 패널
import { agendaCost, agendaOpt, has } from '../core/agendas';
import { C, OFFERS, PROV } from '../core/data';
import { adoptRate, intelQ, pLedgerC, pLedgerM, prices, project } from '../core/economy';
import { habitOn, partyCount, supply } from '../core/explore';
import { DEV, devDone, founding, gateOk } from '../core/founding';
import { appCount, appSkill, gearLvl, heroDemand, heroPicks, pickDemand, pubMul } from '../core/hero';
import { S, schismLines } from '../core/state';
import { clamp, eul, fmt, keyWord, pct, pick, sgn } from '../core/util';
import { allFacs, facUpkeep, fixedCost } from '../core/world';

// 화면 요소는 입력값(value)과 상태(disabled, open)를 바로 다루므로 느슨하게 받는다
const $ = (id: string): any => document.getElementById(id);

export function devHtml() {
  const card = d => {
    const st = S.dev[d.id], pick = S.devPick[d.id];
    if (st && st.left === 0) return `<div class="devcard done"><b>${d.name}</b> <span class="ok">완료 · ${d.opts[st.opt].label}</span></div>`;
    if (st) return `<div class="devcard"><b>${d.name}</b> <span class="dim">진행 중 · ${d.opts[st.opt].label} · ${st.left}개월 남음</span></div>`;
    if (d.need && !d.need()) return `<div class="devcard off"><b>${d.name}</b> <span class="dim">${d.needText}</span></div>`;
    return `<div class="devcard"><b>${d.name}</b>${d.core ? ' <span class="tag">필수</span>' : ''}<p class="hint">${d.why}</p>
      ${d.opts.map((o, i) => `<button type="button" class="devopt${pick === i ? ' on' : ''}" data-dev="${d.id}" data-opt="${i}" aria-pressed="${pick === i}">
        <span class="t">${o.who ? `<span class="dot" style="background:var(--${o.who})"></span>` : ''}${o.label}</span><span class="c">${o.cost ? fmt(o.cost) + 'G' : '무료'} · ${o.months}개월</span>
        <span class="d">${o.desc}</span></button>`).join('')}</div>`;
  };
  return DEV.map(card).join('');
}

export const LINES = [
  { id: 'potM', cat: 'potion', name: '상단 포션 구매', who: 'merchant', max: 20000, hint: () => `단가 ${fmt(prices().m)}G · 공급 한도 없음` },
  { id: 'potC', cat: 'potion', name: '교회 포션 구매', who: 'church', max: 8000, hint: () => S.deals.bulk ? `상단과 독점 계약 중이에요 (${S.deals.bulk.left}개월 남음). 사면 계약이 깨져요` : `단가 ${fmt(prices().c)}G · 한 달 최대 ${S.cap}병 (넘는 돈은 집행되지 않아요)` },
  { id: 'ws', cat: 'potion', name: '관리국 포션 공방', who: 'good', max: 2400, off: () => !S.wsBuilt, hint: () => S.wsBuilt ? `가동 중 · 병당 ${C.WS_COST}G · 한 달 최대 ${S.wsCap}병` : '공방이 없어요. 개척 시설 탭에서 착공할 수 있어요' },
  { id: 'food', cat: 'potion', name: '식량 (교회 곳간)', who: 'church', max: 4000, hint: () => provHint('food') },
  { id: 'repair', cat: 'potion', name: '장비 정비 (상단 대장간)', who: 'merchant', max: 4000, hint: () => provHint('repair') },
  { id: 'haul', cat: 'potion', name: '운송 (짐꾼 고용)', who: null, max: 3000, hint: () => provHint('haul') },
  { id: 'donation', cat: 'church', name: '교회 헌금', nameFn: () => schismLines() ? '정통파 헌금 (대사제)' : '교회 헌금', who: 'church', max: 8000, hint: () => S.schism && !S.schism.outcome
      ? `대사제가 이끄는 정통파에 내는 돈이에요. 관례 ${fmt(S.custom)}G는 두 줄 합계로 따져요`
      : S.schism && S.schism.outcome === 'compromise' ? `정통파 관례는 매달 ${fmt(S.custom)}G예요`
      : `관례는 매달 ${fmt(S.custom)}G예요. 더 내면 호의가 쌓이지만, 여섯 달 내내 많이 내면 그 금액이 새 관례가 돼요` },
  { id: 'donR', cat: 'church', name: '개혁파 헌금 (리아나 사제)', who: 'church', max: 6000, show: () => schismLines(), hint: () => S.schism && S.schism.outcome === 'compromise'
      ? `개혁파 관례는 매달 ${fmt(S.customR)}G예요`
      : '개혁파에 싣는 돈이에요. 정통파보다 많이 실으면 개혁파가 힘을 얻지만 대사제가 불쾌해해요' },
  { id: 'intel', cat: 'watch', name: '시장 조사비', who: null, max: 3000, hint: () => S.budget.intel
      ? `다음 달 서류함에 조사 보고서가 와요. 정확도 ${pct(intelQ(S.budget.intel))} · 약초 작황, 담합 위험과 그 이유. 세력은 눈치채지 못해요`
      : '정보원을 풀어 약초 작황과 상단·교회의 움직임을 미리 읽어요. 쓸수록 정확해져요' },
  { id: 'audit', cat: 'watch', name: '감찰비', who: null, max: 4000, hint: () => {
      const a = S.budget.audit;
      return a ? `장부 사본을 얻을 확률 상단 ${pct(pLedgerM(a))} · 교회 ${pct(pLedgerC(a))}. 감시가 이어지면 담합할 엄두를 못 내지만, 공급처가 불쾌해해요`
        : '돈을 쓸수록 상단(1,500G면 확실), 교회(3,000G면 확실) 장부 사본을 얻을 확률이 올라요. 감시가 끊기면 담합하기 쉬워져요';
    } },
  { id: 'support', cat: 'explore', name: '공략 지원금', who: 'ink', max: 4000, hint: () => {
      const n = S.floors.filter(f => f.guide).length + (S.pendingGuide ? 1 : 0);
      return n ? `공략본대로 편성하려는 파티 ${Math.round(adoptRate(S.budget.support) * 100)}%. 필요한 직업이나 장비가 모자라면 그만큼은 못 따라요` : '발간한 공략본이 없어요. 탐사 기록 탭에서 공략본을 내면 효과가 생겨요';
    } },
  { id: 'trial', cat: 'explore', name: '시험 탐사비', who: 'ink', max: 3000, off: () => !S.trial, hint: () => {
      const k = S.trial ? Math.min(partyCount(), Math.floor((S.budget.trial || 0) / C.TRIAL_COST)) : 0;
      return S.trial ? `${S.trial.f + 1}층에 ${keyWord(S.trial.key)}${eul(keyWord(S.trial.key))} 갖춘 시험 파티 ${k}개를 보내요 (파티당 ${fmt(C.TRIAL_COST)}G). 시험반은 결과를 꼼꼼히 적어 오지만, 틀린 조건이면 다치기도 해요`
        : '탐사 기록 탭에서 시험할 층과 조건을 고르면 쓸 수 있어요. 돈은 나가지 않아요';
    } },
  { id: 'rent', cat: 'explore', name: '장비 대여 (상단 매입)', who: 'merchant', max: 3000, off: () => !supply(S.budget).gk.length, hint: () => {
      const u = supply(S.budget);
      return u.gk.length ? `${u.gk.map(k => k.slice(2)).join('·')} 장비 ${u.sets}벌을 빌려줘요 (벌당 ${fmt(u.rp)}G, 상단 포션 단가를 따라 움직여요). 상단이 반겨요`
        : '장비 공략본이 없어서 빌려줄 장비가 정해지지 않았어요. 돈은 나가지 않아요';
    } },
  { id: 'priest', cat: 'explore', name: '사제 파견 요청 (교회)', who: 'church', max: 3000, hint: () => {
      const u = supply(S.budget);
      return `사제 1명당 매달 ${fmt(C.PRIEST_COST)}G · ${u.priestPaid}명 요청${u.priests < u.priestPaid ? `, 교회가 서운해서 ${u.priests}명만 보낼 것 같아요` : ''}. 교회가 반기지만, 오래 기대다 끊으면 서운해해요`;
    } },
  { id: 'recruit', cat: 'explore', name: '직업 장려금', who: 'ink', max: 3000, off: () => S.union || !supply(S.budget).ck.length, hint: () => {
      const u = supply(S.budget);
      return S.union ? '조합 보이콧 중이라 아무도 오지 않아요. 돈은 나가지 않아요'
        : u.ck.length ? `${u.ck.map(k => k.slice(2)).join('·')} ${u.heads}명을 새로 불러와요 (1명당 ${fmt(C.RECRUIT_COST)}G). 한 번 오면 계속 남지만 통행세를 내고 포션도 써요`
        : '전사·궁수·마법사·도적이 필요한 공략본이 없어요. 사제는 교회에 파견을 요청하세요. 돈은 나가지 않아요';
    } },
  { id: 'heroPay', cat: 'hero', name: '용사 후원금', who: 'good', max: 6000, hint: () => {
      const pay = S.budget.heroPay || 0, n = heroPicks().length;
      if (S.hero) { const d = heroDemand(); return `몸값 합계 ${fmt(d)}G${pay < d ? ` · ${fmt(d - pay)}G 모자라요. 사기가 떨어지고 야심 큰 용사부터 떠나요` : pay > d ? ' · 넘게 주면 사기가 올라요' : ''}${n ? ` · 명단의 지원자 ${n}명은 몸값 합계를 넘겨야 합류해요` : ''}`; }
      if (n >= 2) { const d = pickDemand(); return `명단 ${n}명 몸값 합계 ${fmt(d)}G. ${pay >= d ? '결재 때 결성돼요' : `${fmt(d - pay)}G 더 걸어야 결성돼요`}`; }
      return pay ? `공고 중 · 다음 달 지원자 약 ${appCount(pay)}명, 실력 ${appSkill(pay)} 안팎. 결성 전에는 돈이 나가지 않아요`
        : '용사 지원자를 모으는 공고 금액이에요. 높을수록 실력 좋은 지원자가 많이 와요. 결성 전에는 돈이 나가지 않아요';
    } },
  { id: 'heroGear', cat: 'hero', name: '용사 장비 지원 (상단)', who: 'merchant', max: 3000, off: () => !S.hero && heroPicks().length < 2, hint: () => S.hero || heroPicks().length >= 2
      ? `장비 등급 ${pct(gearLvl(S.budget.heroGear))} · 성공률 최대 +10%p, 사망 최대 절반. 500G 이상이면 최전선 공략본의 장비를 챙겨요. 상단이 반겨요`
      : '용사 파티가 생기면 쓸 수 있어요. 돈은 나가지 않아요' },
  { id: 'heroPub', cat: 'hero', name: '용사 홍보비', who: 'ink', max: 3000, off: () => !S.hero && heroPicks().length < 2, hint: () => S.hero || heroPicks().length >= 2
      ? `용사 소식이 명성을 움직이는 힘 ×${pubMul(S.budget.heroPub).toFixed(1)}. 승전도 죽음도 크게 퍼져요`
      : '용사 파티가 생기면 쓸 수 있어요. 돈은 나가지 않아요' },
];

export const UNLOCK = {
  potC: () => S.cap > 0, donation: () => has('church_greet'),
  intel: () => devDone('supply'), audit: () => devDone('supply'),
  support: gateOk, trial: gateOk, rent: gateOk, priest: gateOk, recruit: gateOk,
  heroPay: gateOk, heroGear: gateOk, heroPub: gateOk,
};

LINES.forEach(l => { const u = UNLOCK[l.id]; if (u) { const s0 = l.show; l.show = () => u() && (!s0 || s0()); } });

// 예산안은 성격이 같은 줄끼리 묶어 보여 준다. 소계는 실제로 집행될 금액이다
export const BUDGET_GROUPS = [
  { id: 'dev', name: '개척 사업', note: '이번 달 착수할 사업을 고르세요. 착수비는 한 번에 나가요', sub: p => p.devc, show: () => founding() },
  { id: 'potion', name: '보급', sub: p => p.sM + p.sC + p.sW + p.pv.spend },
  { id: 'explore', name: '탐사 지원', sub: (p, b) => b.support + p.trialSpend + p.sup.rentSpend + p.sup.priestSpend + p.sup.recruitSpend },
  { id: 'hero', name: '용사 파티', sub: p => p.hero.spend },
  { id: 'fees', name: '층별 입장료', note: '파티당, 음수면 보조금', sub: p => p.feeIn - p.feeOut, signed: true, show: gateOk },
  { id: 'church', name: '교회 헌금', sub: (p, b) => b.donation + (b.donR || 0) },
  { id: 'watch', name: '정보·감찰', sub: (p, b) => (b.intel || 0) + b.audit },
  { id: 'fixed', name: '고정 지출', sub: p => p.fee + p.facCost + p.upkeep + p.offers + p.fixed + p.extra + p.agc },
];

// 접힘 상태는 저장 데이터가 아니라 이 브라우저의 편의 설정으로 둔다. 고정 지출은 조정할 줄이 없어 처음엔 접어 둔다
export const GROUP_OPEN = (() => { try { return { fixed: false, ...JSON.parse(localStorage.getItem('lb-budget-groups') || '{}') }; } catch { return { fixed: false }; } })();

export const lineOff = l => !!(l.off && l.off());

export let VIS: any[] = [];

export function provHint(k) {
  const pv = project(S.budget).pv, it = pv[k], P = PROV[k];
  const unit = k === 'haul' ? `파티당 평균 ${fmt(it.unit)}G, 깊은 층일수록 비싸요` : k === 'repair' ? `파티당 ${fmt(it.unit)}G, 상단 포션 단가를 따라 움직여요` : `1인분 ${fmt(it.unit)}G`;
  const short = k === 'food' && it.fulfill < 1 ? ` · 교회가 서운해서 산 것의 ${pct(it.fulfill)}만 내줘요` : '';
  return `지금 ${pct(it.cov)} 충족${short}${it.cov < 1 ? ` · 모자라면 ${P.miss}` : ''} · 100%면 ${fmt(it.full)}G (${unit})`;
}

export function buildLines() {
  VIS = LINES.filter(l => !l.show || l.show());
  S._sig = lineSig();
  // 지금 쓸 수 없는 줄은 슬라이더 없이 이름과 안내만 한 줄로 보여 준다
  const lineHtml = l => lineOff(l) ? `
    <div class="line off">
      <span class="lbl">${l.who ? `<span class="dot" style="background:var(--${l.who})"></span>` : ''}${l.nameFn ? l.nameFn() : l.name}</span>
      <div class="hint" id="${l.id}-h"></div>
    </div>` : `
    <div class="line">
      <label for="${l.id}">${l.who ? `<span class="dot" style="background:var(--${l.who})"></span>` : ''}${l.nameFn ? l.nameFn() : l.name}</label>
      <input type="number" id="${l.id}" min="0" max="${l.max}" step="100" aria-label="${l.name} 금액">
      <input type="range" id="${l.id}-r" min="0" max="${l.max}" step="100" aria-label="${l.name} 조절">
      <div class="hint" id="${l.id}-h"></div>
    </div>`;
  const feeHtml = (_, i) => `
    <div class="line">
      <label for="fee-${i}">${i + 1}층 입장료</label>
      <input type="number" id="fee-${i}" min="${C.FEE_MIN}" max="${C.FEE_MAX}" step="${C.FEE_STEP}" aria-label="${i + 1}층 입장료">
      <input type="range" id="fee-${i}-r" min="${C.FEE_MIN}" max="${C.FEE_MAX}" step="${C.FEE_STEP}" aria-label="${i + 1}층 입장료 조절">
      <div class="hint" id="fee-${i}-h"></div>
    </div>`;
  $('lines').innerHTML = BUDGET_GROUPS.filter(g => g.show ? g.show() : (g.id === 'fixed' || VIS.some(l => l.cat === g.id))).map(g => {
    const body = g.id === 'dev' ? '<div id="dev"></div>' : g.id === 'fees' ? `<div id="fees">${S.floors.slice(0, S.unlocked).map(feeHtml).join('')}</div>`
      : g.id === 'fixed' ? '<div id="fixed"></div>'
      : VIS.filter(l => l.cat === g.id).map(lineHtml).join('');
    return `<details class="bgroup" data-group="${g.id}"${GROUP_OPEN[g.id] === false ? '' : ' open'}>
      <summary><span class="name">${g.name}</span><span class="sub" id="grp-${g.id}"></span></summary>
      ${g.note ? `<p class="note">${g.note}</p>` : ''}${body}
    </details>`;
  }).join('');
  document.querySelectorAll('#lines .bgroup').forEach((d: any) => d.addEventListener('toggle', () => {
    GROUP_OPEN[d.dataset.group] = d.open;
    try { localStorage.setItem('lb-budget-groups', JSON.stringify(GROUP_OPEN)); } catch {}
  }));
  VIS.filter(l => !lineOff(l)).forEach(l => {
    const n = $(l.id), r = $(l.id + '-r');
    const set = v => { S.budget[l.id] = clamp(Math.round((+v || 0) / 100) * 100, 0, l.max); syncBudget(); };
    r.addEventListener('input', () => set(r.value));
    n.addEventListener('change', () => set(n.value));
  });
  if (gateOk()) S.floors.slice(0, S.unlocked).forEach((_, i) => {
    const n = $('fee-' + i), r = $('fee-' + i + '-r');
    const set = v => { S.fees[i] = clamp(Math.round((+v || 0) / C.FEE_STEP) * C.FEE_STEP, C.FEE_MIN, C.FEE_MAX); syncBudget(); };
    r.addEventListener('input', () => set(r.value));
    n.addEventListener('change', () => set(n.value));
  });
}

export const lineSig = () => LINES.filter(l => !l.show || l.show()).map(l => l.id + (lineOff(l) ? '-' : '')).join(',') + (schismLines() ? '!' : '') + '/' + S.unlocked + '/' + S.phase + DEV.filter(d => devDone(d.id)).map(d => d.id).join('') + (has('church_greet') ? 'c' : '');

export function syncBudget() {
  VIS.forEach(l => {
    if (!lineOff(l)) {
      $(l.id).value = S.budget[l.id];
      $(l.id + '-r').value = S.budget[l.id];
    }
    $(l.id + '-h').textContent = l.hint();
  });
  $('fixed').innerHTML =
    (S.pendingGuide ? `<div class="line fixed"><span>${S.pendingGuide.f + 1}층 공략본 발간비</span><span class="val">${fmt(C.GUIDE_FEE)}</span></div>` : '') +
    allFacs().filter(f => S.fac[f.id] && S.fac[f.id].state === 'pending').map(f => `<div class="line fixed"><span>${f.name} 착공비</span><span class="val">${fmt(f.cost)}</span></div>`).join('') +
    S.offers.filter(o => o.accepted).map(o => `<div class="line fixed"><span>제안: ${OFFERS[o.id].title}</span><span class="val">${fmt(OFFERS[o.id].cost)}</span></div>`).join('') +
    (agendaCost() ? `<div class="line fixed"><span>안건: ${agendaOpt().label}</span><span class="val">${fmt(agendaCost())}</span></div>` : '') +
    S.upkeepX.map(u => `<div class="line fixed"><span>${u.name}</span><span class="val">${fmt(u.amt)}</span></div>`).join('') +
    (facUpkeep() ? `<div class="line fixed"><span>시설 유지비</span><span class="val">${fmt(facUpkeep())}</span></div>` : '') +
    `<div class="line fixed"><span>관리국 운영비 (용병 수에 비례)</span><span class="val">${fmt(fixedCost())}</span></div>`;
  const p = project(S.budget);
  if (founding()) $('dev').innerHTML = devHtml();
  if (gateOk()) S.floors.slice(0, S.unlocked).forEach((fl, i) => {
    const fee = S.fees[i], np = p.sh[i] * p.n;
    $('fee-' + i).value = fee;
    $('fee-' + i + '-r').value = fee;
    const tag = i === S.unlocked - 1 && fl.prog < 100 ? '개척 중 · ' : '';
    const H = fl.mon.habit, warn = !fl.habitKnown ? '' : H.k === 'cycle' && habitOn(fl, 0) ? ` · 이번 달은 ${H.label}, 놈들이 사나워요`
      : H.k === 'crowd' && np > C.CROWD_N ? ` · 파티 ${C.CROWD_N}개가 넘으면 놈들이 사나워요` : '';
    $('fee-' + i + '-h').textContent = `${tag}예상 파티 ${Math.round(np)}개 (${pct(p.sh[i])})` + (fee > 0 ? ` · 입장료 수입 약 ${fmt(fee * np)}G` : fee < 0 ? ` · 보조금 약 ${fmt(-fee * np)}G` : '') + warn;
  });
  BUDGET_GROUPS.forEach(g => {
    if (!$('grp-' + g.id)) return;
    const v = g.sub(p, S.budget);
    $('grp-' + g.id).textContent = g.signed ? (v ? `${v > 0 ? '수입' : '보조금'} ${fmt(Math.abs(v))}` : '0') : fmt(v);
  });
  $('proj').innerHTML = `
    <div class="row"><span>지급 예정 포션</span><b>상단 ${p.qM} + 교회 ${p.qC}${S.wsBuilt ? ` + 공방 ${p.qW}` : ''}${p.draw ? ` + 창고 ${p.draw}` : ''} = ${Math.min(p.need, p.qM + p.qC + p.qW + p.draw)} / ${p.need}병</b></div>
    <div class="cov ${p.cov < 0.95 ? 'low' : ''}"><span style="width:${Math.round(p.cov * 100)}%"></span></div>
    <div class="row"><span>보급 충족</span><b>${Object.keys(PROV).map(k => `${PROV[k].short} <span class="${p.pv[k].cov < 0.95 ? 'neg' : ''}">${pct(p.pv[k].cov)}</span>`).join(' · ')}</b></div>
    <div class="row"><span>창고 재고${p.waste ? ` <span class="neg">· 창고가 넘쳐 ${p.waste}병 버림</span>` : ''}</span><b>${S.stock} → ${S.stock - p.draw + p.toStock}병</b></div>
    <div class="row"><span>예상 수입 (전리품은 지난달 기준)</span><b>${fmt(p.income)}</b></div>
    <div class="row"><span>예산 합계</span><b>${fmt(p.spend)}</b></div>
    <div class="row total"><span>예상 손익</span><b class="${p.net < 0 ? 'neg' : 'pos'}">${sgn(p.net)}</b></div>`;
}
