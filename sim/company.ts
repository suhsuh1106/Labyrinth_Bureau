// 용병단 시뮬레이터: 플레이어 봇 성향마다 여러 판을 돌려 평균 순위와 1위 분포를 본다.
//   npm run sim                         기본 200판, 모든 성향
//   npm run sim -- --games 500 --style smart
// 성향: even(고르게) · deep(깊은 층 위주) · smart(시장을 읽는 숙련자, 근원에는 채굴장)
//       smartNoGuide · smartSeal · smartNoRoot: 숙련 봇에서 지침을 빼거나 근원을 달리 다룬 것
import { setSeed } from '../src/core/rng';
import { type Mission, type Team, forecast, CO, TAX, FLOORS, potShock, cashK, aidAt, jobsExplore, churchPrice, ITEMS, type Filing, type Plan, type World, closeBooks, preview, setClerks, defaultPlan, dormCost, jobsSign, partyMargin, roomOf, SYN, demandMul, potsOf, probe, floorMons, mapOf, maxParties, newWorld, torchRate, torchOdds, sanitize, canTarget, rankOf, runMonth, succRate, us, worth } from '../src/core/company';
import { demandSeen } from '../src/ui/co/book';
import { ASK_KEYS, DEX, MAT_KEYS, type Dex, askable, badSure, keySure } from '../src/core/dex';
import { CLASSES, PAIR_CLASS, classWeaks } from '../src/core/data';

// 영주청 숫자를 바꿔 보며 잴 때 (TAX_LOOT=0.15 TAX_SUSK=20 TAX_RELIEF=0.5 npm run sim)
if (process.env.KEY_BONUS) CO.KEY_BONUS = +process.env.KEY_BONUS;
if (process.env.DEP) CO.DEP = +process.env.DEP;
if (process.env.WEAK_ONE) CO.WEAK_ONE = +process.env.WEAK_ONE;
const ASK_ALL = process.env.ASK_ALL === '1';   // 단장 조사를 소거법으로 (짐작이 없으면 아직 묻지 않은 것부터). 켜면 숙련 봇 1위 86%라 밸런스를 정한 뒤 기본으로
if (process.env.TAX_LOOT) TAX.LOOT = +process.env.TAX_LOOT;
if (process.env.UND_F0) CO.UND_F[0] = +process.env.UND_F0;
if (process.env.PRESS_RUN) TAX.PRESS_RUN = +process.env.PRESS_RUN;
if (process.env.TAX_SUSK) TAX.SUS_K = +process.env.TAX_SUSK;
if (process.env.TAX_PEN) TAX.AUDIT_PEN = +process.env.TAX_PEN;
if (process.env.TAX_RELIEF) Object.keys(TAX.RELIEF).forEach(k => { TAX.RELIEF[k] = TAX.RELIEF[k]! * +process.env.TAX_RELIEF!; });
if (process.env.START_CASH) CO.START_CASH = +process.env.START_CASH;
if (process.env.FIND) CO.FIND = +process.env.FIND;
if (process.env.HARD_F) CO.HARD_F = process.env.HARD_F.split(',').map(Number);
if (process.env.HARD_MAIN) CO.HARD_MAIN = +process.env.HARD_MAIN;
if (process.env.INJ_K) CO.INJ_K = +process.env.INJ_K;
if (process.env.INJ_BASE) CO.INJ_BASE = +process.env.INJ_BASE;
if (process.env.INJ_REST) CO.INJ_REST = +process.env.INJ_REST;
if (process.env.INJ_PEN) CO.INJ_PEN = +process.env.INJ_PEN;
if (process.env.LOSE_LOOT) CO.LOSE_LOOT = +process.env.LOSE_LOOT;
if (process.env.SLOT_PP) CO.SLOT_PP = +process.env.SLOT_PP;
if (process.env.LOOT_SLOT) CO.LOOT_SLOT = process.env.LOOT_SLOT.split(',').map(Number);
if (process.env.P0X) ITEMS[0].P0 *= +process.env.P0X;
for (const k of ['TARGET_AT', 'TARGET_W', 'TARGET_SUCC', 'TARGET_MAT', 'KEY_SUCC', 'KEY_CRISIS', 'MAT_SURE', 'ASK_AT'] as const) if (process.env['DEX_' + k]) DEX[k] = +process.env['DEX_' + k]!;
if (process.env.ENC_W0) { const a = +process.env.ENC_W0; CO.ENC_W = [a, (1 - a) / 2, (1 - a) / 2]; }
if (process.env.MAT_ENC) CO.MAT_ENC = +process.env.MAT_ENC;
for (const k of ['GATHER_K', 'GATHER_EASE', 'TRAIL_EASE', 'TRAIL_INJ', 'TRAIL_MAP', 'MAP_BASE', 'AMBUSH', 'HUNT_MAT', 'HUNT_CARE', 'LOSE_MAT', 'FIND', 'MAT_FLOW', 'MAT_LO', 'MAT_HI', 'MAT_EXP', 'MAT_VAL'] as const) if (process.env[k]) (CO as any)[k] = +process.env[k]!;
for (const k of ['gather', 'hunt', 'scout'] as const) { const v = process.env['MW_' + k.toUpperCase()]; if (v) CO.MISSION_W[k] = v.split(',').map(Number); }
if (process.env.SEGS) CO.SEGS = process.env.SEGS.split(',').map(Number);
if (process.env.MAT_SLOT) CO.MAT_SLOT = FLOORS.map(() => +process.env.MAT_SLOT!);
if (process.env.TRAIL_SLOT) CO.TRAIL_SLOT = +process.env.TRAIL_SLOT;
if (process.env.TIER_DEEP) CO.TIER_DEEP = process.env.TIER_DEEP.split(',').map(Number);
for (const k of ['A_MEMBER_K', 'A_K', 'A_CLERK', 'CLERK_WAGE', 'A_TRIP', 'A_BASE', 'A_MEMBER', 'A_FLOOR', 'A_FREE'] as const) if (process.env[k]) (CO as any)[k] = +process.env[k]!;
for (const k of Object.keys(SYN) as (keyof typeof SYN)[]) if (process.env['SYN_' + k]) SYN[k] = +process.env['SYN_' + k]!;   // 조 시너지 숫자 (SYN_WAR2_SUCC=0 등)
const arg = (k: string, d: string) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const games = +arg('games', '200'), seed0 = +arg('seed', '1'), only = arg('style', '');
const MONTHS = 36;

// 몸집 불리기: 빈 침상은 채우고(기본안이 그렇다), 침상이 다 차고 지난달 남았고 조 하나를 더 보내 m 넘게 남을 듯하면 금고가 증축 값의 k배를 넘을 때 숙소를 늘린다
export function grow(W: World, P: Plan, k = 3, m = 100) {
  const c = us(W), L = W.last;
  if (!c.pendingBeds && roomOf(c) <= 1 && L && L.res[0].net > 0 && partyMargin(W, 0) > m && c.cash > dormCost(c) * k) P.dorm = true;
  return P;
}

export const BOT: Record<string, (W: World) => Plan> = {
  even: W => grow(W, defaultPlan(W)),
  deep: W => {
    const P = defaultPlan(W), n = maxParties(us(W)), d = W.unlocked - 1;
    P.parties = FLOORS.map(() => 0);
    if (d === 0) P.parties[0] = n; else { P.parties[d] = Math.ceil(n * 0.6); P.parties[d - 1] = n - P.parties[d]; }
    P.pots = FLOORS.map(() => 4); P.train = 500;
    if (W.month % 6 === 0 && us(W).cash > 10000 * cashK()) P.base = { f: d, amt: CO.BASE_STEP };
    return grow(W, P);
  },
  // 몸집을 불리지 않는 숙련 봇 (숙소·모집이 순위에 얼마나 보태는지 재는 기준)
  smartStay: W => { const P = smartPlan(W); P.dorm = false; return P; },
  smart: W => smartPlan(W),
  // 소수 정예: 숙련 봇과 같되 단원을 ELITE_CAP명(기본 24)까지만 뽑는다 (다수 길드인 숙련 봇과 견준다)
  smartElite: W => { const P = smartPlan(W), c = us(W); if (P.pick) P.pick = P.pick.slice(0, Math.max(0, ELITE_CAP - c.members - (c.hireQ || []).length)); return P; },
  // 숙련 봇이 전리품을 창고에 두고 지정가(기준 값의 SELL_AT배)를 넘으면 파는 것 (창고 보관이 이득인지 재는 기준)
  smartHold: W => { const P = smartPlan(W); P.autoSell = false; P.sellAt = +(process.env.SELL_AT || 1); return P; },
  // 숙련 봇에서 추리만 뺀 것 (편성 지침이 순위에 얼마나 보태는지 재는 기준)
  smartNoGuide: W => smartPlan(W, 'mine', true, false, false),
  smartAsk: W => smartPlan(W, 'mine', true, false, true, true),   // 단장 조사를 소거법으로
  // 숙련 봇에서 도감으로 소재 챙기기만 뺀 것 (갈무리 편성이 순위에 얼마나 보태는지 재는 기준)
  smartNoKit: W => smartPlan(W, 'mine', false),
  // 숙련 봇에 조사 의뢰(큰 용병단 둘의 이번 달 계획 사 보기)로 붐빔을 읽어 나누기를 더한 것 (아직 숙련 봇보다 못하다)
  smartScout: W => smartPlan(W, 'mine', true, true),
  // 숙련 봇이 근원을 봉인하는 쪽과, 근원을 그대로 두는 쪽 (채굴장과 견주는 기준)
  smartSeal: W => smartPlan(W, 'seal'),
  smartNoRoot: W => smartPlan(W, 'none'),
  // 숙련 봇이 신고서를 장부 그대로 내는 것과, 한도까지 부풀려 내는 것 (가정산의 값을 재는 기준)
  smartHonest: W => smartPlan(W),
  smartGreedy: W => smartPlan(W),
  // 숙련 봇이 임무를 고르지 않고 모두 채집으로 보내는 것 (임무를 골라 쓰는 값을 재는 기준)
  smartGather: W => smartPlan(W, 'mine', true, false, true, ASK_ALL, false),
};

// 신고서: 숙련 봇은 이번 달 감사 확률이 FILE_RISK를 넘지 않는 데까지만 전리품을 덜 적고 포션 · 횃불을 부풀린다
// (출입 기록에 바로 걸리는 지원금 층 · 선금 층의 조는 손대지 않는다). 다른 봇은 장부 그대로 낸다
const FILE_RISK = +(process.env.FILE_RISK || 0.04);
const TORCH_RISK = +(process.env.TORCH_RISK || 0.1);
const fileAt = (T: Filing, s: number): Partial<Filing> => ({ loot: Math.round(T.loot * (1 - 0.6 * s)), mat: Math.round(T.mat * (1 - 0.6 * s)), pot: Math.round(T.pot * (1 + 2 * s)), torch: Math.round(T.torch * (1 + s)) });
export function fileSmart(W: World, risk = FILE_RISK): Partial<Filing> {
  const D = W.draft; if (!D) return {};
  // 감시가 붙어 장부 그대로도 risk를 넘으면 몸을 사린다 (감시 중에 고치면 걸린 만큼 세 배로 문다)
  let lo = 0, hi = 1;
  if (preview(W, D, fileAt(D.truth, 0)).chance > risk) return {};
  for (let k = 0; k < 12; k++) { const s = (lo + hi) / 2; if (preview(W, D, fileAt(D.truth, s)).chance <= risk) lo = s; else hi = s; }
  return fileAt(D.truth, lo);
}
export const FILER: Record<string, (W: World) => Partial<Filing>> = {
  smart: W => fileSmart(W), smartNoGuide: W => fileSmart(W), smartAsk: W => fileSmart(W), smartNoKit: W => fileSmart(W), smartScout: W => fileSmart(W), smartSeal: W => fileSmart(W), smartNoRoot: W => fileSmart(W), smartStay: W => fileSmart(W), smartHold: W => fileSmart(W), smartGather: W => fileSmart(W), smartElite: W => fileSmart(W),
  smartGreedy: W => (W.draft ? fileAt(W.draft.truth, 1) : {}),
};

// 숙련 봇: 경쟁자와 군소 용병대가 지난달 벌이를 쫓아 몰려다니므로, 한 층에 몰아넣지 않고 열린 층에 고르게 나누되
// 조당 남는 돈(기준 시세와 지난 시세의 중간으로 어림)에 비례해 기울인다. 포션은 5병, 훈련비는 300(훈련은 갈수록 덜 올라 이 근처가 가장 낫다), 채집 장비 1단계,
// 크게 남는 층에는 계약 파티를 쓴다.
// 거점과 쌓아 두기는 지금 규모에서는 손해라 쓰지 않는다 (시뮬레이션으로 확인함)
const GROW_K = +(process.env.GROW_K || 1.2), GROW_M = +(process.env.GROW_M || 80);
const CLERK_HI = +(process.env.CLERK_HI || 0.8), CLERK_LO = +(process.env.CLERK_LO || 0.5)// 지정 탐사로 주 몬스터를 노리는 것도 지금은 조금 손해다 (주 몬스터가 더 어렵다). AIM=1이면 노린다
, AIM = process.env.AIM === '1', KEY_TPL = process.env.KEY_TPL === '1';
// 임무: 지도가 SCOUT_UNDER 밑인 층마다 한 조는 탐색, 단장 조는 사냥(도감 · 단장 조사), 나머지는 채집. MISSION=0이면 모두 채집
// 사냥은 조마다 수입 어림(사망 하나를 DEATH_V로 뺀)이 채집보다 HUNT_EDGE만큼 나으면, 조의 HUNT_MAX까지 (어림은 사냥을 조금 후하게 본다)
const MISSION = process.env.MISSION !== '0', SCOUT_UNDER = +(process.env.SCOUT_UNDER || 60), LEAD_HUNT = process.env.LEAD_HUNT !== '0';
// 직업 실험(--classes): 신입을 그 직업부터 뽑거나(pre) 그 직업은 뽑지 않는다(avoid)
// 지원자 거르기(HIRE_SKIP=40이면 직업과 상관없이 지원자 열에 넷을 거른다): 몸집을 얼마나 키울지 재는 기준
const HIRE_SKIP = +(process.env.HIRE_SKIP || 0);
// 인원 상한(SIZE_CAP=24면 단원을 24명까지만 뽑는다): 작게 굴리는 봇과 크게 굴리는 봇을 견주는 기준
const SIZE_CAP = +(process.env.SIZE_CAP || 99);
const ELITE_CAP = +(process.env.ELITE_CAP || 24);
let BIAS: { c: string; mode: 'pre' | 'avoid' | 'thin' } | null = null;   // thin: 직업과 상관없이 지원자 다섯에 하나를 거른다 (빼기가 직업 탓인지 덜 뽑은 탓인지 가르는 기준)
const DEATH_V = +(process.env.DEATH_V || 300), HUNT_EDGE = +(process.env.HUNT_EDGE || 0.05), HUNT_MAX = +(process.env.HUNT_MAX || 0.5);
export function smartPlan(W: World, rootMode: 'mine' | 'seal' | 'none' = 'mine', kit = true, scout = false, guide = true, askAll = ASK_ALL, missions = MISSION): Plan {
  const c = us(W), P = defaultPlan(W), L = W.last, pots = 3;
  // 조당 남는 돈: 성공해서 캐 올 값(모형과 지난달 실제 조당 벌이의 중간) − 출정·포션 − 사망의 값(신입 계약금과 빈자리)
  const real = L ? L.perParty : null;
  const value = FLOORS.map((F, f) => {
    if (f >= W.unlocked) return 0;
    // (층 이해도는 셈에 넣지 않는다: 갓 열린 층의 손해를 무겁게 보면 층을 늦게 들어가 더 손해다. 시뮬레이션으로 확인함)
    const p = succRate(c, f, pots, F.cap), unit = ((L && L.Q[f] ? W.price[f] : ITEMS[f].P0) + ITEMS[f].P0) / 2;
    const model = p * F.take * unit, got = model;
    // 위기 하나는 포션이 있으면 harm만큼, 없으면 그대로 사망으로 이어진다 (조당 포션이 위기 수보다 넉넉하다고 본다)
    const crises = CO.PARTY * ((1 - p) * Math.min(0.95, F.risk * CO.CRISIS_FAIL) + p * F.risk * CO.CRISIS_OK);
    // 위기 하나는 harm만큼 사망(신입 값과 빈자리), 나머지는 부상(치료비와 한 달 쉬는 급여)
    const die = crises * (F.harm * (CO.RECRUIT + 250) + (1 - F.harm) * (CO.HEAL_COST + CO.WAGE));
    // 영주청 층 지원금은 조마다 붙는다
    const aid = aidAt(W);
    return Math.max(1, got - (CO.SORTIE + pots * W.potion) - die + (aid && aid.f === f ? aid.amt! : 0));
  });
  const sum = value.reduce((a, b) => a + b, 0), n = maxParties(c);
  P.parties = value.map(v => Math.floor(n * v / sum));
  const order = value.map((v, f) => [v, f]).sort((a, b) => b[0] - a[0]);
  for (let k = 0, rest = n - P.parties.reduce((a, b) => a + b, 0); rest > 0; k++, rest--) P.parties[order[k % W.unlocked][1]]++;
  if (scout) P.parties = scoutSplit(W, n, pots, value);
  // 포션: 얕은 층은 덜 다쳐서 적게 (짐 칸을 전리품에 남긴다)
  P.pots = FLOORS.map((_, f) => Math.min(pots, 1 + f));
  P.tool = 0;   // 단원마다 급여가 붙은 뒤로는 채집 장비 · 갈무리장이 본전이 안 된다 (시뮬레이션으로 확인함)
  const best = value.indexOf(Math.max(...value));
  const key = deduce(W);
  P.guide = kit ? key.map((g, f) => addKit(W, f, g, P.parties[f])) : key;
  // 조 모양: 층마다 추리한 약점 직업은 두 자리에(소재용으로 더한 직업이 아니라), 기록상 손해 보는 직업은 빼고 전사로
  // (명단이 있는 판은 도감이 기록을 모으므로 직업을 돌려 시험하지 않는다: 확정한 약점이 있는 층만 그 모양으로)
  P.tplF = FLOORS.map((_, f) => (c.crew && !key[f] ? [...CO.TPL0] : floorTpl(W, f, key[f], P.guide[f])));
  // 확정한 약점 직업을 둘씩 넣는 조 모양은 지금 손해다 (탐사 날의 60%는 곁 몬스터를 만난다. 60판: 쓰면 1.92위, 안 쓰면 1.73위). KEY_TPL=1이면 쓴다
  if (!KEY_TPL) { P.tplF = undefined; P.guide = P.guide.map(() => ''); }
  if (!guide) { P.guide = P.guide.map(() => ''); P.tplF = undefined; }
  // 포션: 교회 값이 상단보다 싸면(후원해서 교회가 예전 값으로 내줄 때) 교회에서 사고, 담합이 터지면 여유가 있을 때 한 번 후원한다
  const need = P.parties.reduce((a, n, f) => a + (n + P.hire[f]) * P.pots[f], 0);
  P.buy = { holy: churchPrice(W, 0) < W.potion ? Math.max(0, need - potsOf(us(W)).holy) : 0 };
  // 약초 흉년 소문이 돌면 다음 달 몫까지 미리 사 둔다 (포션은 두 달 간다)
  if (potShock(W.month + 1) > potShock(W.month)) { const H = potsOf(us(W)); P.buy.pot = Math.max(0, need * 2 - H.pot - H.holy - P.buy.holy!); }
  P.donate = W.cartel && !W.cartel.donated[0] && c.cash > 8000 * cashK() ? 1000 : 0;
  // 근원: 찾은 근원이 있으면 여유가 있을 때 채굴장 기금을 넣는다. 채굴장과 그대로 두기는 순위가 비슷하고,
  // 봉인은 범람을 절반으로 줄이지만 우리 순위로는 손해다(200판 3.13 · 3.14 대 3.45). 봉인은 교회가 같은 돈을 보태 절반만 든다
  const rf = (W.roots || []).findIndex(r => r.found && !r.done);
  if (rf >= 0 && c.cash > 8000 * cashK()) P.root = rootMode === 'none' ? null : { f: rf, seal: rootMode === 'seal' ? CO.ROOT_COST / 4 : 0, mine: rootMode === 'mine' ? CO.ROOT_COST / 2 : 0 };
  // 의뢰: 받는 달의 납품 의뢰는 그 층에 보내는 조가 석 달 동안 캐 올 양의 70%까지 맡는다
  P.take = Object.fromEntries(jobsSign(W).filter(J => P.parties[J.f]).map(J => {
    const per = L && L.res[0].sent[J.f] ? L.res[0].got[J.f] / L.res[0].sent[J.f] : FLOORS[J.f].take * 0.8;
    return [J.id, Math.min(J.qty, Math.floor(per * P.parties[J.f] * (J.until - J.from + 1) * 0.7 / CO.TAKE_STEP) * CO.TAKE_STEP)];
  }));
  // 탐사 계획서: 그 층에 보낼 조를 그대로 적어 내고 선금을 받는다
  jobsExplore(W).forEach(J => { if (P.parties[J.f]) P.take![J.id] = P.parties[J.f]; });
  // 서기: 지난달 행정 여력이 CLERK_HI를 넘었으면 한 명 더 (빈 침상을 신입보다 먼저), CLERK_LO 밑이면 한 명 줄인다
  // (넘친 만큼 한 번에: 지난달 부하가 CLERK_HI 밑이 되는 데 모자란 역량을 서기로. 단원 부하는 머릿수가 늘수록 가팔라 한 명씩으론 늦다)
  const A = L && L.res[0].admin; if (c.crew && A) { const r = A.load / A.cap; if (r > CLERK_HI && roomOf(c) > 0) setClerks(W, (c.clerks || 0) + Math.max(1, Math.ceil((A.load / CLERK_HI - A.cap) / CO.A_CLERK))); else if (r < CLERK_LO && c.clerks) setClerks(W, c.clerks - 1); }
  // 신입: 지원자 명단에서 실력 좋은 사람부터 빈 침상만큼 (그달 찾아오는 날에 계약한다)
  const B = BIAS, fav = (x: { c: string }) => (B && B.mode === 'pre' && x.c === B.c ? 1 : 0);
  if (c.crew && W.cand) P.pick = [...W.cand].filter(x => !(B && B.mode === 'avoid' && x.c === B.c) && !(B && B.mode === 'thin' && x.id % 5 === 0) && !(HIRE_SKIP && (x.id * 2654435761 >>> 0) % 100 < HIRE_SKIP)).sort((a, b) => fav(b) - fav(a) || (b.sk || 0) - (a.sk || 0)).slice(0, Math.min(roomOf(c), Math.max(0, SIZE_CAP - c.members - (c.hireQ || []).length))).map(x => x.id);
  // 몸집: 조당 남는 돈이 급여보다 넉넉하면 숙소를 늘린다. 본부의 질(훈련장 · 의무실)은 올리지 않는다:
  // 공사가 숙소 증축을 한 달씩 미루는 값이 커서 이 봇의 운영에선 손해였다 (의무실 1단계만 본전 근처)
  // 횃불: 지도만큼 헤맬 것을 셈해, 돌아설 확률이 TORCH_RISK 밑이 되는 데까지 들고 간다
  P.torch = FLOORS.map((_, f) => { const r = torchRate(f, mapOf(c, f)); let t = 1; while (t < CO.DAYS && torchOdds(f, t, r).dark > TORCH_RISK) t++; return t; });
  grow(W, P, GROW_K, GROW_M);
  if (!c.crew || !guide) return P;
  // 조를 짜 두고: 도감 이해도가 찬 주 몬스터는 노리고(지정 탐사), 단장이 가는 층의 몬스터 중 하나에 기록상 가장 그럴듯한 약점을 묻는다
  const Q = sanitize(W, c, P), dex = W.dex || {};
  // (주 몬스터는 어려워서 약점을 확정한 뒤에만 노린다)
  if (AIM) Q.teams!.forEach(T => { const M = floorMons(W, T.f)[0]; if (canTarget(W, T.f, M.name) && keySure(dex[M.name])) T.target = M.name; });
  const lead = (c.crew || []).find(x => x.lead), LT = lead ? Q.teams!.find(T => T.m.includes(lead.id)) : null;
  if (missions) {
    const drawn = new Set<number>();
    Q.teams!.forEach(T => { if (T !== LT && mapOf(c, T.f) < SCOUT_UNDER && !drawn.has(T.f)) { T.mission = 'scout'; drawn.add(T.f); } });
    if (LT && LEAD_HUNT) LT.mission = 'hunt';
    const one = (T: Team, m: Mission) => { const fc = forecast(W, { ...Q, teams: [{ ...T, mission: m }], parties: FLOORS.map((_, f) => (f === T.f ? 1 : 0)), hire: FLOORS.map(() => 0) }); return fc.mean - fc.dead * DEATH_V; };
    const cand = Q.teams!.filter(T => !T.mission).map(T => ({ T, d: one(T, 'hunt') - one(T, 'gather') * (1 + HUNT_EDGE) })).filter(x => x.d >= 0).sort((a, b) => b.d - a.d);
    cand.slice(0, Math.max(0, Math.floor(Q.teams!.length * HUNT_MAX) - Q.teams!.filter(T => T.mission === 'hunt').length)).forEach(x => { x.T.mission = 'hunt'; });
  }
  // (기록에서 짐작이 서면 그것부터, 서지 않으면 아직 묻지 않은 것을 하나씩 지워 간다. 묻는 데 돈이 들지 않는다)
  if (LT && askAll) for (const M of floorMons(W, LT.f)) {
    const D = dex[M.name]; if (!D || D.u < DEX.ASK_AT || keySure(D)) continue;
    const k = guessKeys(D).find(x => !D.key[x]) || ASK_KEYS.find(x => !D.key[x]); if (k) { Q.ask = { mon: M.name, k }; break; }
  }
  else if (LT) for (const M of floorMons(W, LT.f)) {
    const D = dex[M.name]; if (!D || D.u < DEX.ASK_AT || keySure(D)) continue;
    const k = guessKeys(D).find(x => !D.key[x]); if (k) { Q.ask = { mon: M.name, k }; break; }
  }
  // 약점을 확정한 몬스터는 역효과를 하나씩 지워 가며 묻는다 (확정하면 맨몸 역효과가 준다)
  if (LT && !Q.ask) for (const M of floorMons(W, LT.f)) {
    const D = dex[M.name]; if (!D || !keySure(D) || badSure(D)) continue;
    const k = ASK_KEYS.find(x => askable(D, { mon: M.name, k: x, b: true })); if (k) { Q.ask = { mon: M.name, k, b: true }; break; }
  }
  return Q;
}

// 층의 조 모양: 기록상 갖추면 성공률이 10%p 넘게 떨어지는 직업은 빼고, 지침 직업은 두 자리에 넣는다
export function floorTpl(W: World, f: number, guide: string, kitG = guide) {
  const all = W.obs[f]['*']; const avoid = new Set<string>();
  if (all) Object.entries(W.obs[f]).forEach(([k, v]) => {
    if (!k.startsWith('c:')) return; const off = all.n - v.n;
    if (v.n >= 6 && off >= 6 && v.w / v.n - (all.w - v.w) / off < -0.1) avoid.add(k.slice(2));
  });
  // 지침이 아직 없는 층은 석 달마다 다른 직업을 둘씩 넣어 본다 (모든 조가 같은 모양이면 기록으로 견줄 수가 없다.
  // 달마다 바꾸면 조가 매달 흩어져 조직력이 쌓이지 않는다)
  const g = (guide.split('+').find(k => k.startsWith('c:')) || '').slice(2) || (guide ? '' : CLASSES[(Math.floor(W.month / 3) + f) % CLASSES.length]);
  // 소재용으로 더한 직업은 한 자리 (기본 편성에 없으면 넣는다)
  const extra = (kitG.split('+').find(k => k.startsWith('c:') && k.slice(2) !== g) || '').slice(2);
  const base = [...(extra && !CO.TPL0.includes(extra) ? [extra] : []), ...CO.TPL0.filter(x => x !== g && !avoid.has(x))];
  const filler = ['전사', '도적', '궁수', '사제', '마법사'].find(x => !avoid.has(x) && x !== g) || '전사';
  const out = [...(g ? [g, g] : []), ...base];
  while (out.length < CO.PARTY) out.push(filler);
  return out.slice(0, CO.PARTY);
}

// 현장 기록으로 약점 추리: 그 구성을 갖춘 파티와 안 갖춘 파티의 성공률을 견줘, 양쪽 다 여섯 번 넘게 나갔고
// 갖춘 쪽이 12%p 넘게 높은 구성 중 차이가 가장 큰 것을 지침으로 삼는다
export function deduce(W: World) {
  // 명단이 있는 판: 도감에서 그 층 주 몬스터의 약점 (확정이면 그것, 아니면 기록상 가장 그럴듯한 것)
  if (us(W).crew) return FLOORS.map((_, f) => {
    if (f >= W.unlocked) return '';
    const D = (W.dex || {})[floorMons(W, f)[0].name]; if (!D) return '';
    // 약점은 그날 만난 몬스터에게만 먹혀서, 짐작만으로 조를 몰아 짜면 곁 몬스터와 싸우는 날 손해다 (확정한 약점만 편성에 쓴다)
    // 약점은 직업으로도 장비로도 찌를 수 있다: 명단이 있으면 짝지은 직업으로 (장비는 닳는다)
    const k = Object.keys(D.key).find(x => D.key[x] === 'yes') || '';
    return k ? 'c:' + PAIR_CLASS[k.slice(2)] : '';
  });
  return FLOORS.map((_, f) => {
    const all = W.obs[f]['*'];
    if (f >= W.unlocked || !all) return '';
    let best = '', bd = 0.12;
    Object.entries(W.obs[f]).forEach(([k, v]) => {
      if (k === '*') return;
      const on = v.n - 0, off = all.n - v.n;
      if (on < 6 || off < 6) return;
      const d = v.w / on - (all.w - v.w) / off;
      if (d > bd) { bd = d; best = k; }
    });
    return best;
  });
}

// 조사 의뢰로 붐빔 읽기: 금고가 넉넉하면 지난달 가장 많이 보낸 경쟁 용병단 둘의 이번 달 계획을 사 보고, 나머지는 지난달만큼 온다고 본다.
// 층마다 모두가 캐 갈 양이 층의 크기를 넘으면 나눠 갖는다고 보고(층에 남은 양은 모르므로 가득의 3/4로 어림), 사망의 값까지 빼서
// 한 조를 더 보냈을 때 우리 몫이 가장 많이 느는 층에 한 조씩 나눈다. 조사할 수 없는 달은 원래 나누기(base)를 쓴다
export function scoutSplit(W: World, n: number, pots: number, value: number[]) {
  const c = us(W), L = W.last;
  if (!L || W.month < 3 || c.cash < 4000 * cashK()) return spreadBy(n, value, W.unlocked);
  const big = W.cos.map((x, i) => [i, L.res[i].sent.reduce((a, b) => a + b, 0)] as [number, number]).filter(([i]) => W.cos[i].style !== 'player' && W.cos[i].style !== 'crowd').sort((a, b) => b[1] - a[1]).slice(0, 2).map(([i]) => W.cos[i].id);
  big.forEach(id => { if (!(W.probes || []).some(x => x.m === W.month && x.id === id)) probe(W, 'riv', id); });
  const known: Record<string, number[]> = {};
  (W.probes || []).filter(x => x.m === W.month && x.k === 'riv').forEach(x => { known[x.id!] = x.parties!.map((v, f) => v + x.hire![f]); });
  // 사 보지 않은 곳은 지난 두 달의 평균만큼 온다고 본다 (지난달 벌이를 쫓아 층을 오가므로 한 달 치는 잘 틀린다)
  const H = W.history.slice(-2);
  const others = FLOORS.map((_, f) => H.reduce((s0, M) => s0 + M.plans.reduce((a, Q, i) => a + (i && !known[W.cos[i].id] ? Q.parties[f] + Q.hire[f] : 0), 0), 0) / H.length + Object.values(known).reduce((a, v) => a + v[f], 0));
  const unit = FLOORS.map((_, f) => ((L.Q[f] ? W.price[f] : ITEMS[f].P0) + ITEMS[f].P0) / 2);
  const DEATH = CO.RECRUIT + 200;
  const total = (f: number, k: number) => {
    if (!k) return 0;
    const F = FLOORS[f], all = others[f] + k, p = succRate(c, f, pots, all);
    const share = Math.min(1, F.max * 0.75 / Math.max(1, all * p * F.take));
    const die = (1 - p) * CO.PARTY * F.risk * Math.max(0.2, 1.9 - 0.3 * pots);
    return k * (p * F.take * share * unit[f] - CO.SORTIE - pots * W.potion - die * DEATH);
  };
  const out = FLOORS.map(() => 0);
  for (let q = 0; q < n; q++) {
    let bf = -1, bv = -Infinity;
    // 한 층에 절반 넘게 몰지 않는다 (짐작이 틀렸을 때 한꺼번에 무너지지 않게)
    for (let f = 0; f < W.unlocked; f++) { if (out[f] >= Math.ceil(n / 2) && W.unlocked > 1) continue; const v = total(f, out[f] + 1) - total(f, out[f]); if (v > bv) { bv = v; bf = f; } }
    out[bf]++;
  }
  return out;
}
function spreadBy(n: number, value: number[], open: number) {
  const sum = value.reduce((a, b) => a + b, 0) || 1, out = value.map(v => Math.floor(n * v / sum));
  const order = value.map((v, f) => [v, f]).sort((a, b) => b[0] - a[0]);
  for (let k = 0, rest = n - out.reduce((a, b) => a + b, 0); rest > 0; k++, rest--) out[order[k % open][1]]++;
  return out;
}

// 도감 기록으로 소재 편성: 약점 지침이 직업이면 장비를, 장비면 직업을 하나 더 고른다. 기록에서 그 조건을 갖춘 조가
// 평소보다 더 얻어 온 소재의 값(눈에 보이는 찾는 곳 웃돈 포함)이 조당 지침 비용을 넘는 조건 중 가장 큰 것
export function addKit(W: World, f: number, g: string, n: number) {
  const B = W.mat && W.mat.book[f]; if (!B || !n || !B.n['*']) return g;
  const slot = g.startsWith('g:') ? 'c:' : g.startsWith('c:') ? 'g:' : '';
  const seen = new Set((W.mat!.dem || []).filter(d => d.until >= W.month && demandSeen(W, d.who)).map(d => d.m));
  let best = '', bv = CO.GUIDE_COST * 1.5;
  Object.keys(B.n).filter(k => k !== '*' && !k.includes('+') && (!slot || k.startsWith(slot)) && B.n[k] >= 4).forEach(k => {
    let v = 0;
    floorMons(W, f).forEach(M => M.mats.forEach(x => {
      const got = B.got[x.n]; if (!got) return;
      const lift = (got[k] || 0) / B.n[k] - (got['*'] || 0) / B.n['*'];
      if (lift > 0) v += lift * (W.mat!.ref[x.n] || x.val) * (x.k ? (x.k[0] + x.k[1]) / 2 : 1) * (seen.has(x.n) ? demandMul(W, x.n) : 1);
    }));
    if (v > bv) { bv = v; best = k; }
  });
  return best ? [g, best].filter(Boolean).sort().join('+') : g;
}

// onMonth: 달마다 봇이 낸 결정표와 결재 결과를 본다 (지표가 쓴다)
export function playGame(seed: number, bot: (W: World) => Plan, file: (W: World) => Partial<Filing> = () => ({}), onMonth?: (W: World, P: Plan, M: ReturnType<typeof runMonth>, before: { unlocked: number; explore: number }) => void) {
  setSeed(seed);
  const W = newWorld();
  if (process.env.US_CASH) us(W).cash = +process.env.US_CASH;   // 우리 시작 금고만 바꿔 볼 때
  for (let m = 0; m < MONTHS; m++) {
    const P = bot(W), before = { unlocked: W.unlocked, explore: jobsExplore(W).length };
    const M = runMonth(W, P, true); closeBooks(W, file(W));
    if (onMonth) onMonth(W, P, M, before);
  }
  return W;
}

if (process.argv[1] && process.argv[1].endsWith('company.ts') && process.argv.includes('--classes')) {
  // npm run sim -- --classes --games 100: 직업마다 현장 기록과, 신입을 그 직업으로 몰거나 빼 본 숙련 봇의 순위
  classes(games);
} else if (process.argv[1] && process.argv[1].endsWith('company.ts') && process.argv.includes('--metrics')) {
  // npm run sim -- --metrics --games 100 [--style smart]: 인력 손실 · 관리 부담 · 인원 지표
  for (const name of only ? [only] : ['smart', 'even']) metrics(name, games);
} else if (process.argv[1] && process.argv[1].endsWith('company.ts')) {
  for (const name of Object.keys(BOT).filter(k => !only || k === only)) {
    let rankSum = 0, worthSum = 0, firsts = 0, broke = 0, overs = 0, taxSum = 0, gainSum = 0, fineSum = 0, audits = 0;
    const auditsBy: Record<string, number> = {}, scanBy: Record<string, number> = {}; let scans = 0, checks = 0;
    const net = Array.from({ length: MONTHS }, () => 0), mem: Record<string, number> = {}, pos = Array.from({ length: MONTHS }, () => 0);
    const winners: Record<string, number> = {}, opens = FLOORS.map(() => 0);
    for (let g = 0; g < games; g++) {
      const W = playGame(seed0 + g, BOT[name], FILER[name]);
      const r = rankOf(W); rankSum += r; if (r === 1) firsts++;
      worthSum += worth(W, us(W)); if (us(W).cash < 0) broke++;
      overs += W.history.filter(M => M.overflow).length;
      W.history.forEach((M, m) => { net[m] += M.res[0].net; if (M.res[0].net > 0) pos[m]++; });
      W.cos.forEach(c => { mem[c.id] = (mem[c.id] || 0) + c.members; });
      const top = W.last!.rank[0]; winners[top] = (winners[top] || 0) + 1;
      W.history.forEach(M => { if (M.opened != null) opens[M.opened] += M.month; });
      W.history.forEach(M => { const r = M.res[0]; taxSum += r.spend.tax; fineSum += r.spend.fine; gainSum += r.file ? r.file.gain : 0; });
      audits += us(W).audits || 0; W.cos.forEach(c => { auditsBy[c.id] = (auditsBy[c.id] || 0) + (c.audits || 0); scanBy[c.id] = (scanBy[c.id] || 0) + (c.scandals || 0); scans += c.scandals || 0; });
      checks += (W.laws || []).filter(L => L.kind === 'check').length;
    }
    const n = W0().cos.filter(c => c.style !== 'crowd').length;
    console.log(`봇 '${name}' · ${games}판 · ${MONTHS}개월`);
    console.log(`  우리 평균 순위 ${(rankSum / games).toFixed(2)} / ${n} · 1위 ${Math.round(firsts / games * 100)}% · 평균 평가액 ${Math.round(worthSum / games).toLocaleString()}G · 금고 마이너스로 끝난 판 ${broke} · 범람 판당 ${(overs / games).toFixed(2)}번`);
    console.log(`  1위 용병단 ${Object.entries(winners).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(v / games * 100)}%`).join(' · ')}`);
    console.log(`  우리 달별 순이익 ${[1, 2, 3, 6, 12, 24, 36].map(m => `${m}월 ${Math.round(net[m - 1] / games).toLocaleString()} (흑자 ${Math.round(pos[m - 1] / games * 100)}%)`).join(' · ')}`);
    console.log(`  영주청: 판당 세금 ${Math.round(taxSum / games).toLocaleString()}G · 신고서 이득 ${Math.round(gainSum / games).toLocaleString()}G · 추징 ${Math.round(fineSum / games).toLocaleString()}G · 감사 ${(audits / games).toFixed(2)}번 (모두 ${Object.entries(auditsBy).map(([k, v]) => `${k} ${(v / games).toFixed(1)}`).join(' · ')})`);
    console.log(`  스캔들 판당 ${(scans / games).toFixed(2)}번 (${Object.entries(scanBy).filter(([, v]) => v).map(([k, v]) => `${k} ${(v / games).toFixed(2)}`).join(' · ')}) · 대조 강화 법령 ${(checks / games).toFixed(2)}개`);
    console.log(`  36개월 뒤 인원 ${Object.entries(mem).map(([k, v]) => `${k} ${Math.round(v / games)}`).join(' · ')}`);
  }
}
function W0() { return newWorld(); }

// 도감 전적에서 약점 후보: 갖춘 쪽과 안 갖춘 쪽의 해낸 사람 비율 차가 큰 순 (아니라고 들은 것은 뺀다). 직업은 하나 이상을 갖춘 쪽으로 본다
export function guessKeys(D: Dex, min = 0, n0 = 3) {
  const r = (k: string) => D.rec[k] || { n: 0, w: 0, cr: 0, k: 0, p: 0 };
  // 직업 · 장비마다 갖춘 쪽 − 안 갖춘 쪽의 해낸 사람 비율을 보고, 짝지은 약점으로 모은다 (둘 중 큰 쪽)
  const best: Record<string, number> = {};
  MAT_KEYS.forEach(k => {
    const on = k.startsWith('c:') ? [r(k + ':1'), r(k + ':2')] : [r(k + ':1')], off = r(k + ':0');
    const n = on.reduce((a, x) => a + x.n, 0), hit = on.reduce((a, x) => a + (x.k || 0), 0), ppl = on.reduce((a, x) => a + (x.p || 0), 0);
    const d = n >= n0 && off.n >= n0 && ppl && off.p ? hit / ppl - (off.k || 0) / off.p : -1;
    classWeaks(k).forEach(w => { best[w] = Math.max(best[w] ?? -1, d); });
  });
  return ASK_KEYS.filter(k => D.key[k] !== 'no' && best[k] > min).sort((a, b) => best[b] - best[a]);
}

// ---------- 지표: 인력 손실 · 관리 부담 · 인원 ----------
// 결정표의 잎 칸을 "경로 = 값"으로 펴서 지난달과 다른 칸을 센다 (클릭 수의 대리 지표)
function leaves(x: unknown, pre = '', out: Record<string, string> = {}) {
  if (x && typeof x === 'object') Object.entries(x as Record<string, unknown>).forEach(([k, v]) => leaves(v, pre ? `${pre}.${k}` : k, out));
  else if (x !== undefined) out[pre] = JSON.stringify(x);
  return out;
}
function pc(a: number, b: number) { return `${b ? Math.round(a / b * 100) : 0}%`; }
function metrics(name: string, games: number) {
  const T = ['신입', '수련', '숙련', '노련', '명인'], dTier = [0, 0, 0, 0, 0];
  let dUnknown = 0, pairs = 0, exLost = 0, rank = 0, firsts = 0;
  const shaken = [0, 0, 0], monthsN = [0, 0, 0], whyS = [0, 0, 0], whyD = [0, 0, 0];
  const diff: Record<string, { n: number; d: number; teams: number }> = {};
  const members: number[] = [], clerks: number[] = [], adm: number[] = [];
  // 임무: 탐사 수를 넉 달 묶음마다 (채집 · 사냥 · 탐색)
  const mis: Record<string, number>[] = Array.from({ length: 9 }, () => ({ gather: 0, hunt: 0, scout: 0 }));
  for (let g = 0; g < games; g++) {
    let prevPlan: Record<string, string> | null = null, prevTier: Record<number, number> = {}, prevDeaths = 0, prevLoss = 0;
    const W = playGame(seed0 + g, BOT[name], FILER[name], (W, P, M, before) => {
      const m = M.month - 1, third = Math.min(2, Math.floor(m / 12));
      // 1. 인력 손실: 실력 단계별 사망, 잃은 짝 · 경험, 편성이 흔들린 달 (빈자리로 나간 탐사가 있거나, 조의 평균 실력 단계가 지난달보다 반 단계 넘게 낮아짐)
      let known = 0;
      M.ours.forEach(o => { mis[Math.min(8, Math.floor(m / 4))][o.mission || 'gather']++; });
      M.ours.forEach(o => (o.dead || []).forEach(d => { known++; if (d.tk != null) dTier[d.tk]++; pairs += d.mt || 0; exLost += d.ex || 0; }));
      dUnknown += M.res[0].deaths - known;
      const tier: Record<number, number> = {};
      M.ours.forEach(o => { if (o.t == null || !o.tk) return; const a = o.tk.reduce((x, y) => x + y, 0) / o.tk.length; tier[o.t] = Math.max(tier[o.t] ?? -1, a); });
      // 줄어든 조: 같은 조가 그달 안에서 처음보다 적은 사람으로 나감 (부상 · 사망). 자투리로 처음부터 적은 조는 세지 않는다
      const first: Record<number, number> = {}, short = M.ours.some(o => { if (o.t == null) return false; const n = o.n || CO.PARTY; if (first[o.t] == null) { first[o.t] = n; return false; } return n < first[o.t]; });
      // 실력 낮아짐: 지난달 잃은 · 다친 사람이 있었고, 조의 평균 실력 단계가 반 단계 넘게 낮아짐 (몸집을 불려 신입이 끼는 것은 세지 않는다)
      const drop = prevLoss > 0 && Object.entries(tier).some(([t, a]) => prevTier[+t] != null && a < prevTier[+t] - 0.5);
      monthsN[third]++; if (short || drop) shaken[third]++; if (short) whyS[third]++; if (drop) whyD[third]++;
      prevTier = tier;
      // 2. 관리 부담: 지난달과 달라진 결정 칸 수 (조 수 대비)
      const L = leaves(P), nT = (P.teams || []).length || P.parties.reduce((a, b) => a + b, 0);
      if (prevPlan) {
        const keys = new Set([...Object.keys(L), ...Object.keys(prevPlan)]); let d = 0; keys.forEach(k => { if (L[k] !== prevPlan![k]) d++; });
        const b = nT <= 4 ? '조 4 이하' : nT <= 7 ? '조 5~7' : '조 8 이상'; const x = diff[b] || (diff[b] = { n: 0, d: 0, teams: 0 }); x.n++; x.d += d; x.teams += nT;
      }
      prevPlan = L;
      prevDeaths = M.res[0].deaths; prevLoss = M.res[0].deaths + M.res[0].hurt;
    });
    const r = rankOf(W); rank += r; if (r === 1) firsts++;
    members.push(us(W).members); clerks.push(us(W).clerks || 0); adm.push(...W.history.map(M => (M.res[0].admin ? M.res[0].admin.load / M.res[0].admin.cap : 0)));
  }
  const deaths = dTier.reduce((a, b) => a + b, 0) + dUnknown;
  console.log(`지표 '${name}' · ${games}판 · 평균 순위 ${(rank / games).toFixed(2)} · 1위 ${pc(firsts, games)}`);
  console.log(`  [인력 손실] 판당 사망 ${(deaths / games).toFixed(1)}명: ${T.map((n, t) => `${n} ${(dTier[t] / games).toFixed(1)}`).join(' · ')} · 범람 등 ${(dUnknown / games).toFixed(1)} → 노련 · 명인 ${((dTier[3] + dTier[4]) / games).toFixed(1)}명`);
  console.log(`  [인력 손실] 판당 잃은 조직력 짝 ${(pairs / games).toFixed(1)} · 층 경험 ${Math.round(exLost / games)} · 편성이 흔들린 달 ${[0, 1, 2].map(k => `${['1~12', '13~24', '25~36'][k]}월 ${pc(shaken[k], monthsN[k])} (줄어든 조 ${pc(whyS[k], monthsN[k])} · 실력 낮아짐 ${pc(whyD[k], monthsN[k])})`).join(' · ')}`);
  console.log(`  [임무] 넉 달마다 채집 · 사냥 · 탐색 비율 ${mis.map((x, k) => { const t = x.gather + x.hunt + x.scout || 1; return `${k * 4 + 1}~${k * 4 + 4}월 ${pc(x.gather, t)} · ${pc(x.hunt, t)} · ${pc(x.scout, t)}`; }).join(' / ')}`);
  console.log(`  [관리 부담] 달마다 바뀐 결정 칸 ${Object.entries(diff).sort().map(([b, x]) => `${b}: ${(x.d / x.n).toFixed(1)}칸 (조당 ${(x.d / x.teams).toFixed(1)}, ${x.n}달)`).join(' · ')}`);
  const at50 = members.filter(x => x >= 50).length, mid = members.filter(x => x >= 30 && x <= 40).length;
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  console.log(`  [인원] 36개월 뒤 단원 평균 ${avg(members).toFixed(1)}명 · 50명(상한) ${pc(at50, games)} · 30~40명 ${pc(mid, games)} · 서기 ${avg(clerks).toFixed(1)}명 · 행정 여력 평균 ${Math.round(avg(adm) * 100)}% (넘친 달 ${pc(adm.filter(x => x > 1).length, adm.length)}, 70% 넘은 달 ${pc(adm.filter(x => x > CO.A_FREE).length, adm.length)})`);
}

// ---------- 직업: 어떤 직업이 값을 하나 ----------
// (1) 숙련 봇 판의 현장 기록: 직업마다 나선 구간 · 해낸 비율 · 부상 주사위에 걸린 비율 · 죽음, 그 직업이 낀 조와 안 낀 조의 탐사 한 번 벌이(채집품 + 전리품, 그달 시세)
// (2) 실험: 신입을 그 직업부터 뽑는 숙련 봇(몰기)과 그 직업을 뽑지 않는 숙련 봇(빼기)의 평균 순위 · 평가액 · 36개월 뒤 인원을, 그냥 숙련 봇과 견준다
type ClsRec = { seg: number; win: number; dice: number; dead: number; trips: number; val: number; offT: number; offV: number; ppl: number };
function classes(games: number) {
  const R: Record<string, ClsRec> = Object.fromEntries(CLASSES.map(k => [k, { seg: 0, win: 0, dice: 0, dead: 0, trips: 0, val: 0, offT: 0, offV: 0, ppl: 0 }]));
  // 조 구성별 벌이: 탐사 한 번마다 (구성, 층, 임무, 벌이, 죽음). 층 · 임무마다 평균이 크게 달라 같은 층 · 같은 임무의 평균 탐사를 1.00으로 둔 지수로 견준다
  const trips: { key: string; cls: string[]; f: number; ms: string; v: number; d: number; lead: boolean }[] = [];
  const run = (bias: typeof BIAS, rec: boolean) => {
    BIAS = bias; let rank = 0, wsum = 0, firsts = 0, mem = 0;
    for (let g = 0; g < games; g++) {
      const W = playGame(seed0 + g, BOT.smart, FILER.smart, rec ? (W, P, M) => {
        M.ours.forEach(o => {
          const cls = o.cls || [], val = (o.got || 0) * (M.price[o.f] || 0) + o.mats.reduce((a, [m, n]) => a + n * ((M.matPrice || {})[m] || 0), 0);
          CLASSES.forEach(k => { const x = R[k]; if (cls.includes(k)) { x.trips++; x.val += val; } else { x.offT++; x.offV += val; } });
          const key = CLASSES.map(k => { const n = cls.filter(c => c === k).length; return n ? (n > 1 ? `${k}${n}` : k) : ''; }).filter(Boolean).join(' ') + (cls.length < CO.PARTY ? ` (${cls.length}명)` : '');
          trips.push({ key, cls, f: o.f, ms: o.mission || 'gather', v: val, d: (o.dead || []).length, lead: (o.ld ?? -1) >= 0 });
          cls.forEach((k, j) => {
            const x = R[k]; if (!x) return;
            (o.days || []).forEach(d => { const ch = (d.ms || '')[j]; if (!ch || ch === '-') return; x.seg++; if (ch === 'o') x.win++; else if (ch !== 'x') x.dice++; if (ch === 'd') x.dead++; });
            if (o.trip && o.trip.dm && o.trip.dm[j] === 'd') x.dead++;
          });
        });
        if (M.month === MONTHS) (us(W).crew || []).forEach(p => { if (R[p.c]) R[p.c].ppl++; });
      } : undefined);
      const r = rankOf(W); rank += r; if (r === 1) firsts++; wsum += worth(W, us(W)); mem += us(W).members;
    }
    BIAS = null;
    return { rank: rank / games, first: firsts / games, worth: wsum / games, mem: mem / games };
  };
  const base = run(null, true), f1 = (v: number) => v.toFixed(1), p0 = (v: number) => `${Math.round(v * 100)}%`;
  console.log(`직업 · 숙련 봇 ${games}판 · ${MONTHS}개월 · 기준 평균 순위 ${base.rank.toFixed(2)} · 1위 ${p0(base.first)} · 평가액 ${Math.round(base.worth).toLocaleString()}G`);
  console.log('  [현장] 직업 | 나선 구간(판당) | 해낸 비율 | 주사위 걸림 | 죽음(판당) | 낀 조 벌이/탐사 | 안 낀 조 | 36개월 뒤 인원');
  CLASSES.forEach(k => { const x = R[k]; console.log(`  ${k} | ${Math.round(x.seg / games)} | ${p0(x.win / Math.max(1, x.seg))} | ${p0(x.dice / Math.max(1, x.seg))} | ${f1(x.dead / games)} | ${Math.round(x.val / Math.max(1, x.trips))}G | ${Math.round(x.offV / Math.max(1, x.offT))}G | ${f1(x.ppl / games)}명`); });
  // 지수: 같은 층 · 같은 임무 탐사의 평균 벌이에 견준 이 탐사의 벌이
  const avgBy: Record<string, [number, number]> = {}; trips.forEach(t => { const a = avgBy[t.f + t.ms] || (avgBy[t.f + t.ms] = [0, 0]); a[0] += t.v; a[1]++; });
  const idx = (t: typeof trips[number]) => { const a = avgBy[t.f + t.ms]; return a && a[0] ? t.v / (a[0] / a[1]) : 1; };
  const MSN: Record<string, string> = { gather: '채집', hunt: '사냥', scout: '탐색' };
  const share = (ts: typeof trips) => (['gather', 'hunt', 'scout'] as const).map(m => `${MSN[m]} ${p0(ts.filter(t => t.ms === m).length / Math.max(1, ts.length))}`).join(' · ');
  console.log('  [직업 지수] 직업 | 낀 조 지수 | 안 낀 조 지수 | 낀 조의 임무 · 단장 조 비율 (층 · 임무를 맞춘 벌이)');
  CLASSES.forEach(k => {
    const on = trips.filter(t => t.cls.includes(k)), off = trips.filter(t => !t.cls.includes(k)), m = (ts: typeof trips) => ts.reduce((a, t) => a + idx(t), 0) / Math.max(1, ts.length);
    console.log(`  ${k} | ${m(on).toFixed(2)} | ${m(off).toFixed(2)} | ${share(on)} · 단장 조 ${p0(on.filter(t => t.lead).length / Math.max(1, on.length))}`);
  });
  const groups: Record<string, typeof trips> = {}; trips.forEach(t => { (groups[t.key] || (groups[t.key] = [])).push(t); });
  console.log(`  [조 구성] 구성 | 탐사(판당) | 지수 | 탐사 한 번 벌이 | 죽음(100탐사) | 임무 (전체 ${trips.length}탐사, 판당 ${Math.round(trips.length / games)})`);
  Object.entries(groups).sort((a, b) => b[1].length - a[1].length).slice(0, +(arg('top', '18'))).forEach(([k, ts]) => {
    console.log(`  ${k} | ${f1(ts.length / games)} | ${(ts.reduce((a, t) => a + idx(t), 0) / ts.length).toFixed(2)} | ${Math.round(ts.reduce((a, t) => a + t.v, 0) / ts.length)}G | ${f1(ts.reduce((a, t) => a + t.d, 0) / ts.length * 100)} | ${share(ts)}`);
  });
  if (process.argv.includes('--no-exp')) return;
  const th = run({ c: '', mode: 'thin' }, false);
  console.log(`  [기준] 직업과 상관없이 다섯에 하나 거르기: 순위 ${th.rank.toFixed(2)} · 1위 ${p0(th.first)} · 평가액 ${th.worth >= base.worth ? '+' : '−'}${Math.round(Math.abs(th.worth - base.worth)).toLocaleString()}G · ${f1(th.mem)}명`);
  console.log('  [실험] 직업 | 몰기: 순위 · 1위 · 평가액 · 인원 | 빼기: 순위 · 1위 · 평가액 · 인원 (평가액은 기준과의 차)');
  CLASSES.forEach(k => {
    const a = run({ c: k, mode: 'pre' }, false), b = run({ c: k, mode: 'avoid' }, false), d = (v: number) => `${v >= base.worth ? '+' : '−'}${Math.round(Math.abs(v - base.worth)).toLocaleString()}G`;
    console.log(`  ${k} | 몰기 ${a.rank.toFixed(2)} · ${p0(a.first)} · ${d(a.worth)} · ${f1(a.mem)}명 | 빼기 ${b.rank.toFixed(2)} · ${p0(b.first)} · ${d(b.worth)} · ${f1(b.mem)}명`);
  });
}
