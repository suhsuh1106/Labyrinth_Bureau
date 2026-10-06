// 결재함: 부서마다 ① 방침 → ② 품의 → ③ 승인/반려. 옆 장에서 부서를 신설·확장한다
import { C, PROV } from '../core/data';
import { adoptRate, intelQ, pLedgerC, pLedgerM, project } from '../core/economy';
import { habitOn } from '../core/explore';
import { DEV, founding, gateOk } from '../core/founding';
import { appCount, appSkill, heroPicks, heroPlan, pubMul } from '../core/hero';
import { DEPTS, POLICY, canPick, compileBudget, dept, deptOk, lv, memoOf, polVal, staffPay, type DeptId } from '../core/org';
import { S, schismLines } from '../core/state';
import { eul, fmt, keyWord, pct, sgn } from '../core/util';
import { facUpkeep, fixedCost } from '../core/world';
import { renderDeskBudget } from './desk';
import { saveLocal } from './storage';

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

// 책상 위 결재 서류와 장부가 쓰는 묶음. 장부 색은 dev를 뺀 순서대로 c1~c7을 받는다
export const BUDGET_GROUPS = [
  { id: 'dev', name: '개척 사업', sub: p => p.devc, show: () => founding() },
  { id: 'potion', name: '보급과', sub: p => p.sM + p.sC + p.sW + p.pv.spend },
  { id: 'explore', name: '탐사과 · 시험 탐사', sub: (p, b) => b.support + p.trialSpend + p.sup.rentSpend + p.sup.priestSpend + p.sup.recruitSpend, show: () => lv('explore') > 0 || !!S.trial },
  { id: 'hero', name: '용사 후원', sub: p => p.hero.spend, show: () => p0().hero.spend > 0 },
  { id: 'fees', name: '층별 입장료', sub: p => p.feeIn - p.feeOut, signed: true, show: gateOk },
  { id: 'church', name: '헌금 · 공보', sub: (p, b) => b.donation + (b.donR || 0) + p.pub },
  { id: 'watch', name: '감찰관실', sub: (p, b) => (b.intel || 0) + b.audit, show: () => lv('audit') > 0 },
  { id: 'fixed', name: '고정 지출 · 부서 인건비', sub: p => p.fee + p.facCost + p.upkeep + p.offers + p.fixed + p.extra + p.agc + p.staff + p.orgUp },
];
const p0 = () => project(S.budget);
export const shownGroups = () => BUDGET_GROUPS.filter(g => !g.show || g.show());

// 이 화면에서만 쓰는 상태: 지금 펼친 장
let view: 'desk' | 'org' = 'desk';
export const setView = (v: 'desk' | 'org') => { view = v; };

const lvPips = (L: number) => `<span class="lv" aria-label="${L}단계">${[1, 2, 3].map(i => `<i class="${i <= L ? 'on' : ''}"></i>`).join('')}</span>`;
const won = (v: number) => `${fmt(v)}G`;

function segHtml(k: string) {
  const P = POLICY[k], cur = P.opts.findIndex(o => o[1] === polVal(k));
  const lockNote = P.opts.filter((_, i) => !canPick(k, i)).map(o => `${o[0]}: ${o[2]}단계부터`).join(' · ');
  return `<div class="seg" role="group" aria-label="${P.name} 방침">${P.opts.map((o, i) => {
    const ok = canPick(k, i);
    return `<button type="button" data-pol="${k}" data-i="${i}" aria-pressed="${i === cur}"${ok ? '' : ` disabled title="${P.dept ? dept(P.dept).name : ''} ${o[2]}단계에서 열려요"`}>${o[0]}</button>`;
  }).join('')}</div>${lockNote ? `<div class="pnote">${lockNote}</div>` : ''}`;
}

// 품의 내용: [항목, 예상 효과, 주의]
function memoText(k: string, p: any): [string, string, string] {
  const b = S.budget;
  if (k === 'supply') {
    const buy = p.qM + p.qC + p.qW;
    const src = [p.qW && `공방 ${p.qW}`, p.qC && `교회 ${p.qC}`, p.qM && `상단 ${p.qM}`].filter(Boolean).join(' · ') || '없음';
    const prov = Object.keys(PROV).map(x => `${PROV[x].short} ${pct(p.pv[x].cov)}`).join(' · ');
    return [`포션 ${buy}병 (${src}) · 식량 ${won(p.pv.food.spend)} · 정비 ${won(p.pv.repair.spend)} · 운송 ${won(p.pv.haul.spend)}`,
      `포션 충족 <b>${pct(p.cov)}</b> · ${prov}${p.toStock ? ` · 남는 ${p.toStock}병은 창고로` : ''}${p.draw ? ` · 창고에서 ${p.draw}병 꺼냄` : ''}`,
      p.cov < 0.95 ? '포션이 모자라면 떠나는 용병과 사망이 늘어요.' : lv('supply') < 2 ? '보급과를 2단계로 키우면 상단 포션을 5% 싸게 사요.' : ''];
  }
  if (k === 'explore') {
    const u = p.sup, guides = S.floors.some(f => f.guide) || !!S.pendingGuide;
    const items = [b.support && `공략 지원금 ${won(b.support)}`, u.sets && `${u.gk.map(x => x.slice(2)).join('·')} 장비 ${u.sets}벌 대여`, u.priestPaid && `사제 ${u.priestPaid}명 파견 요청`, u.heads && `${u.ck.map(x => x.slice(2)).join('·')} ${u.heads}명 장려금`].filter(Boolean).join(' · ') || '지원 없음';
    return [items, guides ? `공략본을 따르려는 파티 약 <b>${pct(Math.min(0.95, adoptRate(b.support) + (lv('explore') >= 3 ? 0.1 : 0)))}</b>` : '발간한 공략본이 없어 이번 달은 효과가 없어요',
      polVal('explore') >= 3 && !u.gk.length && !u.ck.length ? '편성 지원할 공략본(장비·직업)이 없어요.' : ''];
  }
  if (k === 'trial') {
    const T = S.trial, n = Math.floor((b.trial || 0) / C.TRIAL_COST);
    return [`${T.f + 1}층 · ${keyWord(T.key)}${eul(keyWord(T.key))} 갖춘 시험 파티 ${n}개`, '시험반은 결과를 꼼꼼히 적어 와요. 틀린 조건이면 다치기도 해요', ''];
  }
  if (k === 'audit') {
    const items = [b.intel && `시장 소문 수집 ${won(b.intel)}`, b.audit && `상단·교회 장부 사본 ${won(b.audit)}`].filter(Boolean).join(' · ') || '이번 달은 들여다보지 않음';
    const eff = b.audit ? `장부 사본을 얻을 확률 상단 <b>${pct(pLedgerM(b.audit))}</b> · 교회 <b>${pct(pLedgerC(b.audit))}</b> · 담합할 엄두를 못 냄` : b.intel ? `다음 달 작황·담합 낌새 보고 (정확도 ${pct(intelQ(b.intel))})${lv('audit') >= 3 ? ' · 상시 감시로 담합을 누름' : ''}` : '감시가 끊기면 담합하기 쉬워져요';
    return [items, eff, b.audit ? '공급처가 불쾌해해요.' : ''];
  }
  if (k === 'outer') {
    const cu = S.custom || 0, sch = schismLines();
    const items = `${sch ? '정통파 헌금' : '교회 헌금'} ${won(b.donation)} (관례 ${won(cu)})${sch ? ` · 개혁파 헌금 ${won(b.donR || 0)}` : ''}`;
    const eff = b.donation < cu ? '교회가 <b>서운해함</b> · 교회 포션 공급이 줄 수 있어요' : b.donation > cu ? '교회가 <b>반김</b> · 오래 많이 내면 그 금액이 새 관례가 돼요' : '교회와의 사이 <b>그대로</b>';
    return [items, eff, sch && lv('outer') < 3 ? '대외과 3단계(종파 중재)가 되면 개혁파 헌금도 방침으로 정해요.' : ''];
  }
  if (k === 'press') {
    const pub = b.heroPub || 0;
    return [pub ? `변경 일보 ${pub >= 1500 ? '기고와 광고' : '관리국 소식지'} ${won(pub)}` : '대응 없음',
      pub ? `명성 <b>+${(pub / 1000 * 0.8).toFixed(1)}</b>/월${S.hero ? ` · 용사 소식 ×${pubMul(pub).toFixed(1)}` : ''}` : '명성은 가만두면 식어요', ''];
  }
  if (k === 'hero') {
    const plan = heroPlan(b), n = heroPicks().length;
    if (!polVal('hero')) return ['후원 없음', S.hero ? '몸값을 못 받은 용사들이 떠나요' : '용사 지원자를 모으지 않아요', S.hero ? '용사 파티가 있는데 후원을 끊으면 사기가 무너져요.' : ''];
    if (S.hero) return [`몸값 ${won(b.heroPay)}${b.heroGear ? ` · 장비 지원 ${won(b.heroGear)}` : ''}`, `몸값 합계 ${won(plan.demand)}${b.heroPay > plan.demand ? ' · 넉넉히 주면 사기가 올라요' : ''}`, ''];
    if (n >= 2) return [`명단 ${n}명 몸값 ${won(b.heroPay)}`, plan.forming ? '결재하면 용사 파티가 <b>결성</b>돼요' : '몸값 합계를 넘겨야 결성돼요', ''];
    return [`용사 공고 ${won(b.heroPay)} (결성 전에는 돈이 나가지 않아요)`, `다음 달 지원자 약 ${appCount(b.heroPay)}명, 실력 ${appSkill(b.heroPay)} 안팎`, '용사 탭에서 명단을 2명 이상 고르면 결성 품의가 올라와요.'];
  }
  return ['', '', ''];
}

function deptRow(id: DeptId, extraPol?: string) {
  const d = dept(id), L = lv(id), rej = !!S.org.rej[id];
  const pending = S.org.up === id;
  if (!L) {
    const why = !deptOk(d) ? d.needText : id === 'outer' && S.custom ? `서기실이 관례 헌금 ${won(S.custom)}을 그대로 올렸어요. 헌금을 조절하려면 대외과가 필요해요.` : `${d.name}${eul(d.name)} 신설하면: ${d.feats[0]}`;
    return `<div class="orow clerk"><div class="dept"><b>${d.name}</b><span>없음</span></div><div class="cnote">${why}</div>
      <div class="dec">${deptOk(d) ? `<button type="button" data-goorg="${id}">${pending ? '다음 달 신설' : '신설 검토'}</button>` : ''}</div></div>`;
  }
  if (id === 'finance') {
    const t = ['', '결산이 예상과 10% 넘게 어긋난 달에만 대조표를 올려요.', '어긋난 달에 대조표와 원인 메모를 올려요.', '어긋난 달에 대조표와 원인 메모를 올리고, 예상 손익을 범위로 알려 줘요.'][L];
    return `<div class="orow clerk"><div class="dept"><b>${d.name}</b><span>${L}단계</span> ${lvPips(L)}</div><div class="cnote">고를 방침이 없는 부서예요. ${t}</div><div class="dec"></div></div>`;
  }
  return policyRow(id, d.name, `<span>${L}단계</span> ${lvPips(L)}`, [id, ...(extraPol ? [extraPol] : [])], rej);
}

function policyRow(k: string, name: string, sub: string, pols: string[], rej: boolean) {
  const p = project(S.budget);
  const amt = memoOf(k), last = S.last && S.last.b ? memoOf(k, S.last.b) : null;
  const [items, eff, warn] = memoText(k, p);
  const delta = last == null ? '' : amt === last ? '<span class="delta">지난달과 같음</span>' : `<span class="delta ${amt > last ? 'up' : 'dn'}">지난달보다 ${sgn(amt - last)}</span>`;
  const label = k === 'trial' ? '시험 탐사' : name;
  return `<div class="orow${rej ? ' rej' : ''}">
    <div class="dept"><b>${name}</b>${sub}</div>
    <div class="pol">${pols.length ? `<div class="cap"><i>1</i>방침</div>${pols.map(x => (pols.length > 1 ? `<div class="psub">${POLICY[x].name}</div>` : '') + segHtml(x)).join('')}` : '<div class="cap"><i>1</i>방침</div><div class="pnote">탐사 기록에서 고른 시험 조건대로</div>'}</div>
    <div class="omemo"><div class="cap"><i>2</i>${label} 품의</div><span class="amt">${rej ? '<s>' + won(amt) + '</s>' : won(amt)}</span>${delta}
      <div class="items">${items}</div><div class="eff">${rej ? '이번 달은 하지 않아요' : eff}</div>${warn && !rej ? `<div class="warnl">${warn}</div>` : ''}</div>
    <div class="dec"><div class="cap"><i>3</i>결재</div><button type="button" class="yes" data-rej="${k}" data-v="0" aria-pressed="${!rej}">승인</button><button type="button" class="no" data-rej="${k}" data-v="1" aria-pressed="${rej}">반려</button></div></div>`;
}

function feesRow(p: any) {
  const opts = [];
  for (let v = C.FEE_MIN; v <= C.FEE_MAX; v += C.FEE_STEP) opts.push(v);
  return `<div class="orow fees"><div class="dept"><b>층별 입장료</b><span>국장 직속 · 파티당</span></div>
    <div class="feegrid">${S.floors.slice(0, S.unlocked).map((fl, i) => {
      const fee = S.fees[i], np = p.sh[i] * p.n;
      const H = fl.mon.habit, warn = !fl.habitKnown ? '' : H.k === 'cycle' && habitOn(fl, 0) ? ` · 이번 달은 ${H.label}` : H.k === 'crowd' && np > C.CROWD_N ? ` · ${C.CROWD_N}개 넘으면 사나워요` : '';
      return `<label class="fee"><span>${i + 1}층${i === S.unlocked - 1 && fl.prog < 100 ? ' (개척 중)' : ''}</span>
        <select data-fee="${i}" aria-label="${i + 1}층 입장료">${opts.map(v => `<option value="${v}"${v === fee ? ' selected' : ''}>${v > 0 ? `${v}G 받기` : v < 0 ? `${-v}G 보조` : '없음'}</option>`).join('')}</select>
        <small>예상 파티 ${Math.round(np)}개${fee > 0 ? ` · 수입 약 ${won(fee * np)}` : fee < 0 ? ` · 보조 약 ${won(-fee * np)}` : ''}${warn}</small></label>`;
    }).join('')}</div></div>`;
}

export function deskHtml(p: any) {
  const rows: string[] = [];
  rows.push(deptRow('supply'));
  if (gateOk() || lv('explore')) rows.push(deptRow('explore'));
  if (S.trial) rows.push(policyRow('trial', '시험 탐사', '<span>탐사 기록에서 지정</span>', [], !!S.org.rej.trial));
  rows.push(deptRow('audit'));
  rows.push(deptRow('outer', lv('outer') >= 3 && POLICY.outerR.show!() ? 'outerR' : undefined));
  if (gateOk() || lv('press')) rows.push(deptRow('press'));
  rows.push(deptRow('finance'));
  if (POLICY.hero.show!()) rows.push(policyRow('hero', '용사 후원', '<span>국장 직속</span>', ['hero'], !!S.org.rej.hero));
  if (gateOk()) rows.push(feesRow(p));
  const fixedItems = [
    S.pendingGuide && [`${S.pendingGuide.f + 1}층 공략본 발간비`, C.GUIDE_FEE],
    p.facCost && ['개척 시설 착공비', p.facCost], p.offers && ['세력 제안 수락', p.offers], p.agc && ['안건 처리비', p.agc],
    ...S.upkeepX.map(u => [u.name, u.amt]), facUpkeep() && ['시설 유지비', facUpkeep()],
    ['관리국 운영비', fixedCost()], p.staff && ['부서 인건비', p.staff], p.orgUp && [`${dept(S.org.up).name} ${lv(S.org.up) ? '확장' : '신설'}비`, p.orgUp],
  ].filter(Boolean) as [string, number][];
  return `<div class="flow" aria-label="결재 순서">
      <div><i>1</i><span><b>방침을 고른다</b>안 바꾸면 지난달 그대로</span></div>
      <div><i>2</i><span><b>품의가 올라온다</b>부서가 방침에 맞춰 금액을 적어 옴</span></div>
      <div><i>3</i><span><b>승인하거나 반려한다</b>기본은 승인</span></div></div>
    ${founding() ? `<div class="devwrap"><h3>개척 사업</h3><p class="note">이번 달 착수할 사업을 고르세요. 착수비는 영주 개척 자금에서 먼저 나가요</p><div id="dev">${devHtml()}</div></div>` : ''}
    <div class="orows">${rows.join('')}</div>
    <div class="fixedl"><div class="fl-h"><span>고정 지출 (품의 없음)</span><b>${fmt(fixedItems.reduce((a, x) => a + x[1], 0))}</b></div>${fixedItems.map(([n, v]) => `<span>${n} ${fmt(v)}</span>`).join('')}</div>`;
}

export function orgHtml() {
  const tags: Record<string, number> = {};
  DEPTS.forEach(d => { if (lv(d.id)) tags[d.tag] = (tags[d.tag] || 0) + lv(d.id); });
  const TAG = { fin: '재무형', field: '현장형', info: '정보형', dip: '외교형' };
  const chips = Object.entries(tags).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<span class="chip t-${t}">${TAG[t]} ${n}</span>`).join('');
  const up = S.org.up as DeptId | null;
  return `<p class="note">부서를 신설하면 그 일을 부서가 맡고, 확장할 때마다 할 수 있는 일이 하나씩 늘어나요. 신설·확장비는 결재 때 한 번 나가고, 다음 달부터 새 단계로 일해요. 한 달에 한 부서만 손댈 수 있어요.</p>
    <div class="orgbar"><span>부서 인건비 매달 <b>${fmt(staffPay())}G</b></span><span>관리국의 색깔</span>${chips}</div>
    <div class="depts">${DEPTS.map(d => {
      const L = lv(d.id), next = L < 3 ? d.cost[L] : null, mine = up === d.id;
      const feats = d.feats.map((f, i) => `<li class="${i < L ? 'have' : i === L ? 'next' : 'later'}"><span class="k">${i + 1}</span><span>${f}</span></li>`).join('');
      const btn = next == null ? '<span class="dim">모두 갖춤</span>'
        : !deptOk(d) ? `<span class="dim">${d.needText}</span>`
        : mine ? `<button type="button" class="btn on" data-up="${d.id}" aria-pressed="true">${L ? `${L + 1}단계 확장` : '신설'} 품의 취소</button>`
        : `<button type="button" class="btn" data-up="${d.id}"${up ? ` disabled title="이번 달은 ${dept(up).name}에 손대기로 했어요"` : ''}>${L ? `${L + 1}단계로 확장` : '신설'} · ${fmt(next)}G</button>`;
      return `<div class="dcard${L ? ' have' : ''}${mine ? ' pending' : ''}"><div class="dh"><b>${d.name}</b><span class="chip t-${d.tag}">${TAG[d.tag]}</span></div>
        <p>${d.does}. ${L ? `지금 ${L}단계 · 인건비 매달 ${fmt(d.pay[L - 1])}G` : '아직 없어요.'}</p><ol>${feats}</ol>
        <div class="up"><span>${next == null ? '' : `${L ? '확장' : '신설'}하면 인건비 매달 ${fmt(d.pay[L])}G`}</span>${btn}</div></div>`;
    }).join('')}</div>`;
}

// 예전 화면과 같은 이름을 남겨 둔다: 줄을 새로 짜야 하는지 보는 서명과, 다시 그리기
export const lineSig = () => '';
export function buildLines() { /* 결재함은 매번 통째로 다시 그린다 */ }

export function syncBudget() {
  compileBudget();
  const p = project(S.budget);
  $('otab-desk')?.setAttribute('aria-selected', String(view === 'desk'));
  $('otab-org')?.setAttribute('aria-selected', String(view === 'org'));
  const ob = $('otab-org'); if (ob) ob.querySelector('small').textContent = S.org.up ? `${dept(S.org.up).name} ${lv(S.org.up) ? '확장' : '신설'} 품의` : '신설 · 확장';
  $('lines').innerHTML = view === 'desk' ? deskHtml(p) : orgHtml();
  const range = lv('finance') >= 3 ? (() => { const lo = Math.round(p.net - S.lastLoot * 0.3), hi = Math.round(p.net + S.lastLoot * 0.2); return `<div class="row"><span>재무과 예측 (안 풀린 달 ~ 잘 풀린 달)</span><b>${sgn(lo)} ~ ${sgn(hi)}</b></div>`; })() : '';
  $('proj').innerHTML = `
    <div class="row"><span>예상 수입 (전리품은 지난달 기준)</span><b>${fmt(p.income)}</b></div>
    <div class="row"><span>집행할 예산</span><b>${fmt(p.spend)}</b></div>
    ${p.devFund ? `<div class="row"><span>개척 사업비 중 영주 개척 자금이 내는 몫</span><b>${fmt(p.devFund)}</b></div>` : ''}
    <div class="row total"><span>예상 손익</span><b class="${p.net < 0 ? 'neg' : 'pos'}">${sgn(p.net)}</b></div>${range}
    ${Object.keys(S.org.rej).some(k => S.org.rej[k]) ? `<div class="row"><span class="neg">반려 ${Object.values(S.org.rej).filter(Boolean).length}건 · 반려한 일은 이번 달에 하지 않아요</span></div>` : ''}`;
  renderDeskBudget();
}

// 결재함 클릭: 방침, 승인/반려, 부서 신설·확장, 장 넘기기
export function onBudgetClick(t: HTMLElement) {
  if (S.over) return false;
  const pol = t.closest('[data-pol]') as HTMLElement, rej = t.closest('[data-rej]') as HTMLElement, up = t.closest('[data-up]') as HTMLElement;
  const go = t.closest('[data-goorg]') as HTMLElement, tab = t.closest('[data-otab]') as HTMLElement;
  if (pol) { const k = pol.dataset.pol!; S.org.pol[k] = +pol.dataset.i!; delete S.org.rej[POLICY[k].dept === 'outer' ? 'outer' : k]; }
  else if (rej) { if (rej.dataset.v === '1') S.org.rej[rej.dataset.rej!] = true; else delete S.org.rej[rej.dataset.rej!]; }
  else if (up) { const id = up.dataset.up as DeptId; S.org.up = S.org.up === id ? null : id; }
  else if (go) view = 'org';
  else if (tab) view = tab.dataset.otab as any;
  else return false;
  syncBudget();
  saveLocal();
  return true;
}
