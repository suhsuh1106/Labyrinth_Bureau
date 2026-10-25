// 장부 (본 화면의 둘째 판): 휴대폰 · PC 모두 위 띠의 지도 ↔ 장부로 갈아 본다.
// 이달 순이익 예측 · 열흘 달력 위의 조마다 막대(나간 날 → 돌아올 날, 끝에 손익) · 귀환 손익 · 들어올 돈과 나갈 돈 · 본부 공사의 투자 크기.
// 귀환 손익 = 가져온 값(채집품 오늘 시세 + 전리품 평균 시세) − 쓴 채비(정가) − 다녀온 날만큼의 급여 몫. 읽기만 한다 (상태를 쓰지 않고 난수를 쓰지 않는다)
import { CO, FLOORS, type Plan, type Sortie, type Team, type World, adminFee, bagDays, bedsOf, boughtOf, dayAbs, hqCost, hqLv, personWage, priceNow, profitOf, sanitize, taxGuess, teamMend, teamReady, unitPrice, us, zoneAt, zoneRate, zoneWay, matRefOf } from '../../core/company';
import { adminProj, costLines, homePlan, monthFc } from './desk';
import { lvOf } from '../../core/zones';
import { PLACE_MENU } from './board';
import { nameOf } from './roster';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
const sgn = (n: number) => `${Math.round(n) < 0 ? '−' : '+'}${fmt(Math.abs(n))}`;
const pc = (v: number) => `${Math.round(v * 100)}%`;
const go = (place: string) => { const m = place === 'gate' ? ['crew', 'team'] : PLACE_MENU[place] || ['hq', 'train']; return `data-act="bs-menu-tab" data-m="${m[0]}" data-k="${m[1]}"`; };

// 돌아온 조 하나의 손익: 가져온 값 − 쓴 채비 − 급여 몫 (다녀온 날 ÷ 한 달 날 × 간 사람의 월 급여)
export function tripPL(W: World, s: Sortie) {
  const o = s.out, r = s.rep, days = Math.max(1, s.d1 - s.d0);
  const loot = (s.got || 0) * priceNow(W, s.f), mats = (o ? o.mats : []).reduce((a, [m, k]) => a + k * matRefOf(W, m), 0);
  const pots = o ? (o.pu - o.h) * unitPrice(W, 'pot') + o.h * unitPrice(W, 'holy') : 0;
  const kit = s.kit.food * unitPrice(W, 'food') + s.kit.mend * unitPrice(W, 'mend') + (o ? o.tu : 0) * unitPrice(W, 'torch') + pots + (o && o.broke && s.kit.gear ? unitPrice(W, 'gear') : 0);
  const wage = s.who.reduce((a, p) => a + personWage(p), 0) * days / CO.MONTH_DAYS;
  return { loot, mats, kit, wage, net: loot + mats - kit - wage, days, dead: r && r.dead ? r.dead.length : 0 };
}
// 아직 돌아오지 않은 조(나가 있음 · 내일 출발)의 손익 예측: 채집품만 (구역 산출 범위 × 일할 날 × 오늘 시세) − 채비 − 급여 몫
export function teamPL(W: World, P: Plan, T: Team, days: number, work: number, sent?: Sortie) {
  const ids = T.m.filter((x): x is number => x != null), who = sent ? sent.who : ids.map(id => (us(W).crew || []).find(p => p.id === id)!).filter(Boolean);
  const r = zoneRate(W, P, T), price = priceNow(W, T.f);
  const kit = sent ? sent.kit.food * unitPrice(W, 'food') + sent.kit.mend * unitPrice(W, 'mend') : ids.length * (T.food || 0) * unitPrice(W, 'food') + teamMend(P, T) * unitPrice(W, 'mend');
  const wage = who.reduce((a, p) => a + personWage(p), 0) * days / CO.MONTH_DAYS, cost = kit + wage;
  return { lo: r.lo * work * price - cost, hi: r.hi * work * price - cost, net: r.mid * work * price - cost, kit, wage };
}

// 열흘 달력: 조마다 한 줄, 이달 다녀온 탐사 · 나가 있는 탐사 · 내일 출발할 탐사를 막대로 (끝에 손익, 예측은 ~)
function calHtml(W: World, P: Plan) {
  const D = CO.MONTH_DAYS, m0 = (W.month - 1) * D, today = W.day || 1, now = dayAbs(W), c = us(W), teams = P.teams || [];
  const col = (abs: number) => Math.min(D + 1, Math.max(1, abs - m0));
  const bar = (cls: string, a: number, b: number, label: string, act: string, tip: string, cut = false) =>
    `<button type="button" class="lg-bar ${cls}${cut ? ' cut' : ''}" style="grid-column:${col(a)} / ${Math.max(col(a) + 1, col(b) + 1)}" ${act} title="${esc(tip)}"><span>${label}</span></button>`;
  const rows = teams.map((T, t) => {
    const ids = T.m.filter((x): x is number => x != null), ld = (c.crew || []).find(p => p.id === ids[0]);
    const done = (W.back || []).filter(s => s.t === t), away = (W.away || []).filter(s => s.t === t || s.m.some(id => ids.includes(id)));
    let bars = done.map(s => { const L = tripPL(W, s); return bar(L.net >= 0 ? 'won' : 'lost', s.d0, s.d1, `${sgn(L.net)}${L.dead ? ' †' : ''}`, `data-act="bs-menu-tab" data-m="rec" data-k="back"`, `${s.rep && s.rep.zn ? s.rep.zn : FLOORS[s.f].name} · ${s.d1 - s.d0}일 · 손익 ${sgn(L.net)}G`, s.d0 <= m0); }).join('');
    bars += away.map(s => { const z = zoneAt(W, s.z); const L = z && lvOf(z) >= 1 ? teamPL(W, P, { ...T, z: s.z, f: s.f }, s.d1 - s.d0, s.work || 1, s) : null;   // (이해도 0단계 구역은 손익을 짐작하지 못한다)
      return bar('out', s.d0, s.d1, L ? `~${sgn(L.net)}` : '미궁', `data-act="bs-team" data-t="${t}"`, `${z ? z.nm : FLOORS[s.f].name} · 늦어도 ${s.d1 - m0 > D ? '다음 달' : `${s.d1 - m0}일`} 아침 귀환${L ? ` · 손익 예측 ${sgn(L.lo)} ~ ${sgn(L.hi)}G` : ''}`, s.d0 <= m0); }).join('');
    if (T.go && teamReady(W, T) && zoneAt(W, T.z)) {
      const z = zoneAt(W, T.z)!, d = T.days || CO.TRIP_DAYS[T.f], bd = bagDays(W, P, T), work = lvOf(z) >= 1 && !T.goal && bd < d - 0.5 ? Math.max(1, Math.round(bd)) : d, len = 2 * zoneWay(W, z) + work;
      const L = lvOf(z) >= 1 ? teamPL(W, P, T, len, work) : null;
      bars += bar('plan', now + 1, now + 1 + len, L ? `~${sgn(L.net)}` : '출발', `data-act="bs-team" data-t="${t}"`, `${z.nm} · 내일 출발 · ${L ? `${len}일 · 손익 예측 ${sgn(L.lo)} ~ ${sgn(L.hi)}G` : `늦어도 ${len}일 · 손익 모름`}`);
    }
    return `<div class="lg-row"><button type="button" class="lg-who" data-act="bs-team" data-t="${t}"><b>${t + 1}조</b><small>${ld ? esc(nameOf(ld)) : '빈 조'}</small></button><div class="lg-track" style="--today:${today}">${bars || ''}</div></div>`;
  }).join('');
  const head = Array.from({ length: D }, (_, j) => `<i class="${j + 1 < today ? 'past' : j + 1 === today ? 'now' : ''}">${j + 1}</i>`).join('');
  return `<section class="lg-cal" aria-label="열흘 달력"><h3>제${W.month}월 열흘 <small>막대 = 나간 날 → 돌아온 아침 · 끝에 손익 (~는 예측)</small></h3>
    <div class="lg-row lg-days"><span></span><div class="lg-track" style="--today:${today}">${head}</div></div>${rows || '<p class="note">조가 없어요</p>'}</section>`;
}

// 이달 돌아온 조의 손익: 번 것(채집품 · 전리품)과 쓴 것(채비 · 급여 몫)을 한 막대에 맞대고 남은 것을 크게
function plHtml(W: World) {
  const L = (W.back || []).map(s => ({ s, L: tripPL(W, s) }));
  if (!L.length) return `<section class="lg-pl"><h3>귀환 손익</h3><p class="note">이달 돌아온 조가 아직 없어요</p></section>`;
  const max = Math.max(1, ...L.map(x => Math.max(x.L.loot + x.L.mats, x.L.kit + x.L.wage))), w = (v: number) => `${Math.round(v / max * 100)}%`, sum = L.reduce((a, x) => a + x.L.net, 0);
  return `<section class="lg-pl"><h3>귀환 손익 <small>${L.length}건 · 합 <b class="${sum < 0 ? 'neg' : 'pos'}">${sgn(sum)}G</b></small></h3><ul>${L.map(({ s, L: x }) => {
    const r = s.rep;
    return `<li><button type="button" class="lg-pr" data-act="bs-menu-tab" data-m="rec" data-k="back"><span class="h"><b>${s.t + 1}조</b> ${esc(r && r.zn ? r.zn : FLOORS[s.f].name)} <small>${r ? `${r.d0}일 → ${r.d1}일` : ''}${x.dead ? ` · † ${x.dead}` : ''}</small><b class="n ${x.net < 0 ? 'neg' : 'pos'}">${sgn(x.net)}G</b></span>
      <span class="pb in" aria-hidden="true"><i class="loot" style="width:${w(x.loot)}"></i><i class="mat" style="width:${w(x.mats)}"></i></span><span class="pb out" aria-hidden="true"><i class="kit" style="width:${w(x.kit)}"></i><i class="wage" style="width:${w(x.wage)}"></i></span>
      <small class="t">채집품 ${fmt(x.loot)} · 전리품 ${fmt(x.mats)} − 채비 ${fmt(x.kit)} · 급여 몫 ${fmt(x.wage)} (${x.days}일)</small></button></li>`;
  }).join('')}</ul><p class="note">채집품은 오늘 시세, 전리품은 평균 시세 · 채비는 정가 · 급여 몫 = 간 사람 월 급여 × 다녀온 날 / ${CO.MONTH_DAYS}</p></section>`;
}

// 들어올 돈 · 나갈 돈: 줄마다 한 막대 (가장 큰 줄에 맞춤), 누르면 그 줄을 정하는 시트
function moneyHtml(W: World, raw: Plan, P: Plan) {
  const fc = monthFc(W, P, true), ls = costLines(W, raw).filter(l => l.now || l.last), G = taxGuess(W, P, fc), gov = G.sub + G.aid + G.adv;
  const ins: [string, number, string][] = [['채집품 · 전리품 (예측)', fc.mean, 'gate'], ...(gov ? [['영주청 지원금 · 선금', gov, 'board'] as [string, number, string]] : [])];
  const max = Math.max(1, ...ins.map(x => x[1]), ...ls.map(l => l.now)), w = (v: number) => `${Math.max(v > 0 ? 2 : 0, Math.round(v / max * 100))}%`;
  const out = ls.reduce((a, l) => a + l.now, 0);
  const row = (n: string, v: number, place: string, neg: boolean, last?: number) => `<li><button type="button" class="lg-ml" ${go(place)}><span>${esc(n)}</span><b class="${neg && v ? 'neg' : ''}">${neg ? (v ? '−' + fmt(v) : '0') : fmt(v)}</b><i class="${neg ? 'out' : 'in'}" style="width:${w(v)}"></i>${last != null && W.last ? `<small>지난달 ${neg ? (last ? '−' + fmt(last) : '0') : fmt(last)}</small>` : ''}</button></li>`;
  return `<section class="lg-money"><h3>들어올 돈 <small>${fmt(fc.mean + gov)}G</small></h3><ul>${ins.map(([n, v, p]) => row(n, v, p, false)).join('')}</ul>
    <h3>나갈 돈 <small>−${fmt(out)}G</small></h3><ul>${ls.map(l => row(l.name, l.now, l.place, true, l.last)).join('')}</ul></section>`;
}

// 본부 공사 하나의 투자 크기: 공사비가 금고 · 한 달 순이익에 견줘 얼마인지, 평가액이 달마다 줄어드는 몫(감가 + 유지비),
// 숫자로 셀 수 있는 효과(달마다 G)와 회수 달. 공사비는 금고에서 건물 장부가로 옮겨 갈 뿐이라 평가액(순위)은 감가 · 유지비만큼만 준다
export function investOf(W: World, P: Plan, k: string) {
  const c = us(W), lv = hqLv(c, k), cost = hqCost(c, k); if (!cost) return null;
  const L = W.last ? W.last.res[0] : null, profit = L ? profitOf(L) : 0, keep = k === 'dorm' ? 0 : CO.HQ_KEEP, dep = cost * CO.DEP;
  let gain = 0, how = '';
  if (k === 'dorm') {
    const add = CO.HQ_BEDS[lv + 1] - CO.HQ_BEDS[lv], per = L && c.members ? ((L.lootSales ?? 0) + L.matSales) / c.members - (c.crew || []).reduce((a, p) => a + personWage(p), 0) / Math.max(1, (c.crew || []).length) : 0;
    const dk = add * CO.DORM_KEEP;
    if (per > 0) { gain = add * per - dk; how = `침상 ${add} · 지난달 한 사람이 남긴 ${fmt(per)}G × ${add}명 − 침상 유지 ${fmt(dk)}`; }
    else how = `침상 ${add} · 지난달 한 사람이 남긴 돈이 없어 셀 수 없음`;
  } else if (k === 'med' && lv === 0) {
    const heal = L ? L.spend.heal || 0 : 0; gain = heal / 2; how = `치료비 절반 · 지난달 치료비 ${fmt(heal)}G`;
  } else if (k === 'rec') {
    const A = adminProj(W, P), w = (c.crew || []).reduce((a, p) => a + personWage(p), 0), r2 = A.sum / (A.cap + CO.A_REC);
    gain = w * (adminFee(A.r) - adminFee(r2)); how = `행정 역량 +${CO.A_REC} · 관리비 ${pc(adminFee(A.r))} → ${pc(adminFee(r2))}${lv === 0 ? ' · 지도 +25%는 셈에 없음' : ''}`;
  } else how = k === 'train' ? '실력 오르는 속도 · 돈으로 셀 수 없음' : '잃는 사람 · 돈으로 셀 수 없음';
  const net = gain - keep;
  return { cost, cashR: c.cash ? cost / c.cash : 0, profit, months: profit > 0 ? cost / profit : 0, dep, keep, gain, net, payback: net > 0 ? Math.ceil(cost / net) : 0, how, beds: bedsOf(c) };
}
export function investHtml(W: World, P: Plan, k: string, name: string) {
  const I = investOf(W, P, k); if (!I) return '';
  const pay = I.payback ? `<b class="pos">${I.payback}달</b>에 회수` : I.gain > 0 ? '<b class="neg">유지비보다 효과가 작음</b>' : '회수 셀 수 없음';
  return `<div class="inv"><div class="inv-h"><b>${esc(name)} ${fmt(I.cost)}G</b><span>금고의 <b>${pc(I.cashR)}</b>${I.profit > 0 ? ` · 지난달 순이익 <b>${Math.round(I.months * 10) / 10}</b>달치` : ''}</span></div>
    <span class="inv-b"><i style="width:${Math.min(100, Math.round(I.cashR * 100))}%"></i></span>
    <small>평가액: 공사 때는 그대로(금고 → 건물), 그 뒤 달마다 −${fmt(I.dep + I.keep)}G (감가 ${fmt(I.dep)}${I.keep ? ` · 유지 ${I.keep}` : ''})</small>
    <small>효과: ${I.gain ? `달 <b class="pos">+${fmt(I.gain)}G</b> · ` : ''}${esc(I.how)} · ${pay}</small></div>`;
}

export function ledgerHtml(W: World, raw: Plan) {
  const c = us(W), P = sanitize(W, c, raw), fc = monthFc(W, P, true), ls = costLines(W, raw), G = taxGuess(W, P, fc), gov = G.sub + G.aid + G.adv;
  // 이해도 0단계 구역에 나가 있거나 나갈 조 (벌이를 짐작하지 못해 예측에서 뺀다)
  const end = W.month * CO.MONTH_DAYS, bz = (z?: number) => { const q = z != null ? zoneAt(W, z) : undefined; return !!q && lvOf(q) < 1; };
  const blindN = (W.away || []).filter(s => s.d1 <= end && bz(s.z)).length + (homePlan(W, P).teams || []).filter(T => T.m.some(x => x != null) && bz(T.z)).length;
  const out = ls.reduce((a, l) => a + l.now, 0), net = fc.mean + gov - out, spent = Object.values(boughtOf(W).cost).reduce((a, b) => a + (b || 0), 0);
  const L = W.last ? W.last.res[0] : null, inc = fc.mean + gov, margin = inc > 0 ? net / inc : 0;
  const build = P.build && CO.HQ_COST[P.build] ? P.build : P.dorm ? 'dorm' : '';
  const NAME: Record<string, string> = { dorm: '숙소 증축', train: '훈련장', rec: '기록실', med: '의무실' };
  return `<section class="lg-head"><div><small>이달 순이익 예측</small><b class="${net < 0 ? 'neg' : 'pos'}">${sgn(net)}G</b><span>범위 ${sgn(fc.p10 + gov - out)} ~ ${sgn(fc.p90 + gov - out)} · 수입의 ${pc(margin)}${L ? ` · 지난달 ${sgn(profitOf(L))}` : ''}${blindN ? ` · 처음 가는 구역 ${blindN}조는 모름` : ''}</span></div>
      <div><small>금고</small><b>${fmt(c.cash)}G</b><span>그믐 뒤 예측 ${fmt(c.cash + net + spent)}G</span></div></section>
    ${calHtml(W, P)}${plHtml(W)}${moneyHtml(W, raw, P)}${build ? `<section class="lg-inv"><h3>이달 공사</h3>${investHtml(W, P, build, NAME[build])}</section>` : ''}
    <p class="note">들어올 돈: 이번 달 돌아온 조 · 그믐 전에 돌아올 조 · 본부의 조가 남은 ${CO.MONTH_DAYS - (W.day || 1) + 1}일 동안 나갈 예측 · 급여 · 유지비 · 영주세는 그믐에</p>`;
}
