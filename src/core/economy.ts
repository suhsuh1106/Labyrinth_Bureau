// 포션 단가, 예산 예상, 담합 점수
import { agendaCost, extraUpkeep, has } from './agendas';
import { C } from './data';
import { floorShares, partyCount, provisions, supply } from './explore';
import { devCost } from './founding';
import { heroPlan } from './hero';
import { S } from './state';
import { clamp, r5 } from './util';
import { facPendingCost, facUpkeep, fixedCost, offerCost } from './world';

export const adoptRate = s => 0.25 + 0.6 * Math.min(1, s / 3000);

export const intelQ = x => Math.min(1, Math.sqrt(x / 3000));

export const pLedgerM = a => clamp(a / 1500, 0, 1);

export const pLedgerC = a => clamp((a - 1000) / 2000, 0, 1);

export function costs() { const s = S.shock > 0 ? C.SHOCK_COST : 0; return { m: C.BASE_COST_M + s, c: C.BASE_COST_C + s }; }

export function fair() { const k = costs(); return { m: k.m + 20 + S.mPriceAdj, c: k.c + 30 + S.cPriceAdj }; }

export function prices() {
  const f = fair();
  if (!S.cartel) return S.deals.bulk ? { m: r5(f.m * 0.8), c: f.c } : f;
  const K = S.cartel;
  const sh = S.shock > 0 ? C.SHOCK_COST : 0;
  const m = K.caved ? f.m + 20 : r5((f.m - sh) * K.markup) + sh;
  // 교회가 주 공급처면 교회 물량이 커서, 인상 폭은 원가의 1.5배 안에서 맞춘다
  return { m, c: Math.max(f.c, has('supply_church') ? Math.min(m - 10, r5(f.c * 1.5)) : m - 10) };
}

export function project(b) {
  const P = prices();
  const qM = Math.floor(b.potM / P.m);
  const qC = Math.min(Math.floor(b.potC / P.c), S.cap);
  const qW = S.wsBuilt ? Math.min(Math.floor(b.ws / C.WS_COST), S.wsCap) : 0;
  const sW = qW * C.WS_COST;
  const need = S.M * C.NEED, buy = qM + qC + qW;
  const draw = Math.min(S.stock, Math.max(0, need - buy));
  const toStock = Math.min(C.STOCK_CAP - S.stock, Math.max(0, buy - need));
  const waste = Math.max(0, buy - need - toStock);
  const cov = need ? Math.min(1, (buy + draw) / need) : 1;
  const sM = qM * P.m, sC = qC * P.c;
  const fee = S.pendingGuide ? C.GUIDE_FEE : 0;
  const facCost = facPendingCost(), upkeep = facUpkeep();
  const offers = offerCost(), fixed = fixedCost(), extra = extraUpkeep(), agc = agendaCost(), devc = devCost();
  const sup = supply(b);
  const trialSpend = S.trial ? Math.min(partyCount(), Math.floor((b.trial || 0) / C.TRIAL_COST)) * C.TRIAL_COST : 0;
  // 입장료는 파티가 층을 고른 결과에 달려 있어 예상치로 셈한다
  const hero = heroPlan(b);
  const n = partyCount(), sh = floorShares(cov);
  const pv = provisions(b, sh);
  const feeIn = sh.reduce((a, x, i) => a + Math.max(0, S.fees[i]) * x * n, 0), feeOut = sh.reduce((a, x, i) => a + Math.max(0, -S.fees[i]) * x * n, 0);
  const spend = sM + sC + sW + pv.spend + b.donation + (b.donR || 0) + (b.intel || 0) + b.audit + b.support + trialSpend + sup.rentSpend + sup.priestSpend + sup.recruitSpend + feeOut + fee + facCost + upkeep + offers + fixed + extra + agc + hero.spend + devc;
  const income = S.M * S.toll + S.lastLoot + S.lordIncome + feeIn;
  return { P, qM, qC, qW, draw, toStock, waste, sM, sC, sW, pv, fee, facCost, upkeep, offers, fixed, extra, agc, devc, need, cov, sup, sh, n, feeIn, feeOut, trialSpend, hero, spend, income, net: income - spend };
}

export function cartelScore(pr) {
  // 공방 생산과 창고 비축이 있으면 관리국이 덜 아쉽다
  const dep = 1 - clamp((pr.qW + 0.5 * S.stock) / Math.max(1, pr.need), 0, 1);
  let s = -1.6;
  s += 2.0 * dep;
  s += 0.8 * clamp((S.treasury - 10000) / 20000, 0, 1.5);
  s += 0.015 * (S.gM + S.gC);
  s += 0.02 * (S.rel - 50);
  s += 0.3 * Math.min(S.noAudit, 6);
  if (S.shock > 0) s += 1;
  // 지난 선택이 상단의 셈을 바꾼다
  if (has('merchant_grudge')) s += 0.6;
  if (has('paid_merchant')) s += 0.5;
  if (has('exposed_merchant')) s -= 0.8;
  // 한 공급처에 몰아주면 그쪽이 값을 쥔다
  if (has('supply_merchant')) s += 0.6;
  if (has('supply_church')) s += 0.3;
  return s;
}
