// 용병단 경영 (새 전제, docs/plan.md 1단계). 옛 관리국 규칙과 따로 돌아가는 엔진이다.
// 여러 용병단이 같은 층에서 전리품을 캐고 같은 시장에 판다. 층마다 캘 수 있는 양이 한정돼 몰리면 나눠 갖고,
// 모두가 같은 시세에 팔아서 다 같이 많이 팔면 값이 떨어진다. 플레이어는 그중 한 용병단의 행정관이다.
// 화면에 붙이기 전까지는 상태를 S가 아니라 이 파일의 World 하나로 둔다.
import { rnd } from './rng';

export const CO = {
  PARTY: 4, WAGE: 30, SORTIE: 60, POTION0: 35, POTION_Q0: 500,
  BASE_STEP: 3000, BASE_MAX: 2, SPOIL: 0.03, REGEN: 0.5,
  HIRE_FEE: 120, HIRE_CUT: 0.4, START_CASH: 12000,
  // 가장 깊은 열린 층에서 이만큼 성공이 쌓이면 다음 층이 열린다 (모든 용병단이 함께 뚫는다)
  OPEN_WINS: [40, 60, 80, 100],
};

export type Floor = { name: string; max: number; take: number; base: number; risk: number; cap: number };
export const FLOORS: Floor[] = [
  { name: '1층', max: 280, take: 5, base: 0.74, risk: 0.10, cap: 30 },
  { name: '2층', max: 120, take: 4, base: 0.62, risk: 0.16, cap: 22 },
  { name: '3층', max: 70, take: 3, base: 0.52, risk: 0.22, cap: 16 },
  { name: '4층', max: 36, take: 3, base: 0.43, risk: 0.30, cap: 10 },
  { name: '5층', max: 16, take: 2, base: 0.35, risk: 0.40, cap: 6 },
];
// 층마다 전리품 한 가지. P0는 수요(D)만큼 팔렸을 때의 시세다
export type Item = { name: string; buyer: string; P0: number; D: number };
export const ITEMS: Item[] = [
  { name: '가죽과 점액', buyer: '상단 경매장', P0: 90, D: 110 },
  { name: '마석 조각', buyer: '마법학교 · 상단', P0: 230, D: 45 },
  { name: '정령 결정', buyer: '마법학교', P0: 340, D: 30 },
  { name: '고대 유물', buyer: '수도 수집가 · 교회', P0: 560, D: 15 },
  { name: '심층의 핵', buyer: '수도', P0: 1200, D: 6 },
];
const NF = FLOORS.length;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const zeros = () => FLOORS.map(() => 0);

// ---------- 시장 ----------
// 시장 전체 판매량 Q가 수요 D보다 많으면 값이 떨어지고(최저 35%), 적으면 오른다(최고 130%)
export const priceOf = (it: Item, Q: number) => Math.round(it.P0 * (Q ? clamp(Math.pow(it.D / Q, 0.7), 0.35, 1.3) : 1.3));
// 포션은 모든 용병단이 많이 살수록 비싸진다
export const potionPrice = (Q: number) => Math.round(CO.POTION0 * clamp(Math.sqrt(Q / CO.POTION_Q0), 0.8, 1.6));

// ---------- 용병단 ----------
export type Style = 'player' | 'volume' | 'steady' | 'deep' | 'chaser' | 'hoarder' | 'shallow' | 'second' | 'crowd';
export type Company = {
  id: string; name: string; style: Style; size: number;
  members: number; cash: number; skill: number; bases: number[]; pendingBase: { f: number; amt: number } | null;
  stock: number[]; losses: number;
  // 판마다 조금씩 다른 성격: 지난달 벌이에 얼마나 민감한지, 포션을 더 쓰는지, 얼마나 값이 올라야 파는지
  trait?: { resp: number; pots: number; sellBar: number };
};
export type Plan = { parties: number[]; pots: number[]; sell: number[]; train: number; base: { f: number; amt: number } | null; hire: number[] };

export const ROSTER: { id: string; name: string; style: Style; size: number }[] = [
  { id: 'us', name: '회색늑대 용병단', style: 'player', size: 36 },
  { id: 'red', name: '붉은 깃발단', style: 'volume', size: 56 },
  { id: 'holy', name: '성흔 기사단', style: 'steady', size: 52 },
  { id: 'iron', name: '철모회', style: 'deep', size: 36 },
  { id: 'crow', name: '까마귀단', style: 'chaser', size: 36 },
  { id: 'silver', name: '은빛 창', style: 'hoarder', size: 32 },
  { id: 'fox', name: '여우굴 패', style: 'shallow', size: 20 },
  { id: 'bridge', name: '돌다리 형제단', style: 'second', size: 20 },
  { id: 'free', name: '군소 용병대', style: 'crowd', size: 60 },
];

export type CoResult = {
  sent: number[]; hired: number[]; ok: number[]; got: number[]; deaths: number; sold: number[]; sales: number;
  spend: { sortie: number; potion: number; wage: number; train: number; base: number; hire: number }; net: number;
};
export type MonthResult = {
  month: number; res: CoResult[]; plans: Plan[]; Q: number[]; price: number[]; potion: number; potQ: number;
  floors: { before: number; taken: number; crowd: number }[]; perParty: number[]; opened: number | null; rank: string[];
};
export type World = {
  month: number; unlocked: number; prog: number; pool: number[]; price: number[]; potion: number;
  cos: Company[]; last: MonthResult | null; history: MonthResult[]; log: { m: number; t: string }[];
};

export function newWorld(): World {
  return {
    month: 1, unlocked: 1, prog: 0, pool: FLOORS.map(F => F.max), price: ITEMS.map(it => it.P0), potion: CO.POTION0,
    cos: ROSTER.map(r => ({ ...r, members: r.size, cash: r.style === 'crowd' ? 0 : Math.round(CO.START_CASH * r.size / 36),
      skill: 0, bases: zeros(), pendingBase: null, stock: zeros(), losses: 0,
      trait: { resp: 0.8 + 0.4 * rnd(), pots: rnd() < 0.3 ? 1 : 0, sellBar: 0.95 * (0.9 + 0.2 * rnd()) } })),
    last: null, history: [], log: [],
  };
}

export const us = (W: World) => W.cos[0];
export const maxParties = (c: Company) => Math.floor(c.members / CO.PARTY);
// 평가액: 금고 + 창고 전리품을 지난 시세로 매긴 값. 순위의 기준이다
export const worth = (W: World, c: Company) => c.cash + c.stock.reduce((a, n, j) => a + n * W.price[j], 0);
export const succRate = (c: Company, f: number, pots: number, crowd: number) =>
  clamp(FLOORS[f].base + 0.035 * (pots - 3) + c.skill * 0.004 + Math.min(CO.BASE_MAX, c.bases[f]) * 0.05 - 0.008 * Math.max(0, crowd - FLOORS[f].cap), 0.1, 0.95);

// 층별 파티 수를 가중치대로 나눈다. 열린 층에만 보낸다
function spread(W: World, n: number, w: number[]) {
  const ws = w.map((v, f) => (f < W.unlocked ? Math.max(0, v) : 0)), s = ws.reduce((a, b) => a + b, 0) || 1;
  const out = ws.map(v => Math.floor(n * v / s));
  let rest = n - out.reduce((a, b) => a + b, 0);
  const order = ws.map((v, f) => [v, f]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0; k = (k + 1) % order.length) if (order[k][0] > 0) { out[order[k][1]]++; rest--; }
  return out;
}

export function emptyPlan(): Plan { return { parties: zeros(), pots: FLOORS.map(() => 3), sell: zeros(), train: 0, base: null, hire: zeros() }; }

// 플레이어 기본안: 열린 층에 고르게, 포션 3병, 창고는 다 판다
export function defaultPlan(W: World): Plan {
  const c = us(W), P = emptyPlan();
  P.parties = spread(W, maxParties(c), FLOORS.map((_, f) => 1 + f * 0.2));
  P.sell = [...c.stock]; P.train = 300;
  return P;
}

// ---------- 경쟁 용병단 ----------
// 층별 조당 벌이 전망: 지난달 그 층에 간 파티가 실제로 캐 온 값. 지난달 아무도 안 간 층(새로 열린 층 등)은 기준 시세로 어림한다
export function outlook(W: World) {
  const L = W.last;
  return FLOORS.map((F, f) => {
    if (f >= W.unlocked) return 0;
    const n = L ? L.plans.reduce((a, P) => a + P.parties[f] + P.hire[f], 0) : 0;
    return n && L ? L.perParty[f] : ITEMS[f].P0 * F.take * F.base * 0.8;
  });
}
const STYLE: Record<Style, { prior: (W: World, f: number) => number; resp: number; pots: number; train: number }> = {
  volume: { prior: (_, f) => 1 / (f + 1) ** 1.5, resp: 0.5, pots: 2, train: 0 },
  steady: { prior: () => 1, resp: 0.3, pots: 4, train: 300 },
  deep: { prior: (W, f) => (f >= W.unlocked - 2 ? (f === W.unlocked - 1 ? 2 : 1) : 0.15), resp: 0.4, pots: 5, train: 600 },
  chaser: { prior: () => 1, resp: 2, pots: 3, train: 0 },
  crowd: { prior: () => 1, resp: 1.2, pots: 2, train: 0 },
  hoarder: { prior: (_, f) => (f === 0 ? 0.6 : 1), resp: 0.6, pots: 3, train: 0 },
  shallow: { prior: (_, f) => (f === 0 ? 1 : 0), resp: 0, pots: 2, train: 0 },
  second: { prior: (W, f) => (f === Math.min(1, W.unlocked - 1) ? 1 : 0), resp: 0, pots: 3, train: 0 },
  player: { prior: () => 1, resp: 0, pots: 3, train: 0 },
};

// 성향대로 결정표를 채우고, 지난달 결과에 반응한다. 우리처럼 시세와 붐빔을 보지만 정보는 지난달 것뿐이다
export function aiPlan(W: World, i: number): Plan {
  const c = W.cos[i], P = emptyPlan(), n = maxParties(c), L = W.last, S = STYLE[c.style];
  const t = c.trait || { resp: 1, pots: 0, sellBar: 0.95 };
  const pots = Math.min(6, S.pots + t.pots + (L && L.res[i].deaths / Math.max(1, L.res[i].sent.reduce((a, b) => a + b, 0)) > 0.6 ? 1 : 0));
  // 조당 남는 돈(전망 - 출정 비용)이 평균보다 좋은 층에 더 보낸다. 반응 정도는 성향과 성격이 정한다
  const look = outlook(W), cost = CO.SORTIE + pots * W.potion;
  const margin = look.map((v, f) => (f < W.unlocked ? Math.max(1, v - cost) : 0));
  const open = margin.filter(v => v > 0), avg = open.reduce((a, b) => a + b, 0) / Math.max(1, open.length);
  const w = FLOORS.map((_, f) => (f < W.unlocked ? S.prior(W, f) * Math.pow(margin[f] / avg, S.resp * t.resp) : 0));
  P.parties = spread(W, n, w);
  P.pots = FLOORS.map(() => pots);
  P.train = S.train;
  // 큰 용병단은 남는 장사인 층이 있으면 군소 용병대를 계약 파티로 빌린다
  if ((c.style === 'volume' || c.style === 'steady' || c.style === 'chaser') && c.cash > 8000) {
    const best = margin.indexOf(Math.max(...margin));
    if (look[best] * (1 - CO.HIRE_CUT) - cost - CO.HIRE_FEE > 60) P.hire[best] = Math.floor(c.size / 16);
  }
  // 파는 법: 투기형은 시세가 기준의 sellBar 아래면 안 팔고, 안정형은 80% 아래면 절반만. 금고가 바닥나면 다 판다
  P.sell = c.stock.map((s, j) => {
    const low = W.price[j] / ITEMS[j].P0;
    if (c.cash < 3000) return s;
    if (c.style === 'hoarder' && low < t.sellBar) return 0;
    if (c.style === 'steady' && low < 0.8) return Math.floor(s / 2);
    return s;
  });
  if (c.style === 'deep' && W.month % 4 === 1 && c.cash > 9000) P.base = { f: W.unlocked - 1, amt: CO.BASE_STEP };
  // 두 달 넘게 적자면 허리띠를 졸라맨다
  if (c.style !== 'crowd' && (c.cash < 3000 || c.losses >= 2)) { P.train = 0; P.base = null; P.hire = zeros(); P.pots = P.pots.map(v => Math.max(2, v - 1)); }
  return P;
}

// 계약 파티: 군소 용병대를 이번 달만 빌린다. 한 조에 HIRE_FEE를 주고, 캐 온 것의 HIRE_CUT은 그들 몫이다
export const hireCost = (P: Plan) => P.hire.reduce((a, b) => a + b, 0) * CO.HIRE_FEE;
export const sortieCost = (P: Plan, potion: number) => FLOORS.map((_, f) => (P.parties[f] + P.hire[f]) * (CO.SORTIE + P.pots[f] * potion));

// ---------- 한 달 ----------
export function runMonth(W: World, playerPlan: Plan): MonthResult {
  const plans = W.cos.map((c, i) => (c.style === 'player' ? sanitize(W, c, playerPlan) : aiPlan(W, i)));
  // 계약 파티로 빌려 간 만큼 군소 용병대가 직접 보내는 파티가 준다
  const ci = W.cos.findIndex(c => c.style === 'crowd');
  // 군소 용병대가 가진 파티보다 많이 빌릴 수는 없다. 플레이어가 먼저 빌리고, 나머지는 순서대로 나눠 빌린다
  if (ci >= 0) { let free = maxParties(W.cos[ci]); plans.forEach(P => { P.hire = P.hire.map(h => { const x = Math.min(h, free); free -= x; return x; }); }); }
  const hiredAll = plans.reduce((a, P) => a + P.hire.reduce((s, v) => s + v, 0), 0);
  if (ci >= 0) { let cut = hiredAll; const P = plans[ci]; for (let f = 0; f < NF && cut > 0; f++) { const d = Math.min(cut, P.parties[f]); P.parties[f] -= d; cut -= d; } }
  const potQ = plans.reduce((a, P) => a + P.parties.reduce((s, n, f) => s + (n + P.hire[f]) * P.pots[f], 0), 0);
  const potion = potionPrice(potQ);
  const res: CoResult[] = W.cos.map(() => ({ sent: zeros(), hired: zeros(), ok: zeros(), got: zeros(), deaths: 0, sold: zeros(), sales: 0,
    spend: { sortie: 0, potion: 0, wage: 0, train: 0, base: 0, hire: 0 }, net: 0 }));
  const floors: MonthResult['floors'] = [];
  let deepWins = 0;
  FLOORS.forEach((F, f) => {
    const crowd = plans.reduce((a, P) => a + P.parties[f] + P.hire[f], 0);
    const wins = W.cos.map((c, i) => {
      const P = plans[i], n = P.parties[f] + P.hire[f], p = succRate(c, f, P.pots[f], crowd);
      let w = 0, d = 0;
      for (let q = 0; q < n; q++) {
        if (rnd() < p) w++;
        else if (q < P.parties[f]) d += Math.round(Math.max(0, CO.PARTY * F.risk * (1.6 - 0.15 * P.pots[f]) * (0.5 + rnd())));   // 계약 파티의 사망은 그들 몫
      }
      res[i].sent[f] = P.parties[f]; res[i].hired[f] = P.hire[f]; res[i].ok[f] = w; res[i].deaths += d;
      return w;
    });
    if (f === W.unlocked - 1) deepWins = wins.reduce((a, b) => a + b, 0);
    const want = W.cos.map((c, i) => wins[i] * (F.take + Math.floor(Math.min(CO.BASE_MAX, c.bases[f]) / 2)));
    const total = want.reduce((a, b) => a + b, 0), before = W.pool[f], k = total ? Math.min(1, before / total) : 0;
    // 손에 쥐는 양은 몫보다 조금 적을 수 있다 (흘리고 깨뜨린다). 몫을 넘지는 않아서 층에 남은 양을 넘겨 캐지 못한다
    W.cos.forEach((c, i) => { res[i].got[f] = Math.floor(want[i] * k * (0.85 + 0.15 * rnd())); });
    const taken = res.reduce((a, r) => a + r.got[f], 0);
    floors.push({ before, taken, crowd });
    W.pool[f] = before - taken;
    W.pool[f] += Math.round((F.max - W.pool[f]) * CO.REGEN);
  });
  // 계약 파티가 캔 것 중 그들 몫은 군소 용병대 창고로 간다
  if (ci >= 0) W.cos.forEach((_, i) => {
    if (i === ci) return;
    FLOORS.forEach((_, f) => {
      const P = plans[i], n = P.parties[f] + P.hire[f]; if (!P.hire[f] || !n) return;
      const share = Math.floor(res[i].got[f] * P.hire[f] / n * CO.HIRE_CUT);
      res[i].got[f] -= share; W.cos[ci].stock[f] += share;
    });
  });
  // 판매: 창고에서 내놓은 만큼 모두가 같은 시세에 판다
  const Q = ITEMS.map((_, j) => plans.reduce((a, P, i) => a + Math.min(P.sell[j], W.cos[i].stock[j]), 0));
  const price = ITEMS.map((it, j) => priceOf(it, Q[j]));
  W.cos.forEach((c, i) => {
    const P = plans[i], r = res[i];
    ITEMS.forEach((_, j) => { const s = Math.min(P.sell[j], c.stock[j]); r.sold[j] = s; c.stock[j] -= s; r.sales += s * price[j]; });
    c.stock = c.stock.map(v => Math.floor(v * (1 - CO.SPOIL)));
    FLOORS.forEach((_, f) => { c.stock[f] += r.got[f]; });
    const sc = sortieCost(P, potion);
    const pot = FLOORS.reduce((a, _, f) => a + (P.parties[f] + P.hire[f]) * P.pots[f] * potion, 0);
    r.spend = { sortie: sc.reduce((a, b) => a + b, 0) - pot, potion: pot, wage: c.members * CO.WAGE, train: P.train, base: P.base ? P.base.amt : 0, hire: hireCost(P) };
    r.net = r.sales - Object.values(r.spend).reduce((a, b) => a + b, 0);
    c.cash += r.net;
    c.losses = r.net < 0 ? c.losses + 1 : 0;
    c.skill = c.skill * 0.95 + P.train / 200;
    if (c.pendingBase) { c.bases[c.pendingBase.f] += c.pendingBase.amt / CO.BASE_STEP; c.pendingBase = null; }
    if (P.base) c.pendingBase = { ...P.base };
  });
  // 단원: 죽은 만큼 줄고, 원래 규모까지만 조금씩 보충된다 (규모를 키우는 모집 경쟁은 나중 단계). 군소 용병대는 벌이가 좋으면 몰려오고 나쁘면 떠난다
  W.cos.forEach((c, i) => {
    const r = res[i];
    if (c.style === 'crowd') {
      const sent = r.sent.reduce((a, b) => a + b, 0) || 1;
      c.members = clamp(c.members - r.deaths + Math.round(r.net / sent / 25) * CO.PARTY, 24, 200);
      c.cash = 0;   // 군소 용병대는 버는 대로 쓴다
    } else c.members = Math.max(8, c.members - r.deaths + Math.min(Math.round(c.size / 10), Math.max(0, c.size - c.members + r.deaths)));
  });
  // 길 뚫기: 가장 깊은 열린 층에서 성공이 쌓이면 다음 층이 열린다
  let opened: number | null = null;
  if (W.unlocked < NF) {
    W.prog += deepWins;
    if (W.prog >= CO.OPEN_WINS[W.unlocked - 1]) { opened = W.unlocked; W.unlocked++; W.prog = 0; W.log.push({ m: W.month, t: `${FLOORS[opened].name}이 열렸다` }); }
  }
  const perParty = FLOORS.map((_, f) => { const n = plans.reduce((a, P) => a + P.parties[f] + P.hire[f], 0); return n ? res.reduce((a, r) => a + r.got[f], 0) * price[f] / n : 0; });
  W.price = price; W.potion = potion;
  const rank = W.cos.filter(c => c.style !== 'crowd').map(c => [worth(W, c), c.id] as [number, string]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
  const M: MonthResult = { month: W.month, res, plans, Q, price, potion, potQ, floors, perParty, opened, rank };
  W.last = M; W.history.push(M); W.month++;
  return M;
}

// 플레이어 결정표를 규칙 안으로 맞춘다: 열린 층만, 단원 수만큼, 계약 파티는 군소 용병대가 가진 만큼, 창고에 있는 만큼만 판다
export function sanitize(W: World, c: Company, P: Plan): Plan {
  const Q: Plan = JSON.parse(JSON.stringify(P));
  Q.parties = Q.parties.map((n, f) => (f < W.unlocked ? Math.max(0, Math.floor(n)) : 0));
  let over = Q.parties.reduce((a, b) => a + b, 0) - maxParties(c);
  for (let f = 0; f < NF && over > 0; f++) { const d = Math.min(over, Q.parties[f]); Q.parties[f] -= d; over -= d; }
  const crowd = W.cos.find(x => x.style === 'crowd');
  let free = crowd ? maxParties(crowd) : 0;
  Q.hire = Q.hire.map((n, f) => { const h = f < W.unlocked ? clamp(Math.floor(n), 0, free) : 0; free -= h; return h; });
  Q.pots = Q.pots.map(v => clamp(Math.floor(v), 1, 8));
  Q.sell = Q.sell.map((v, j) => clamp(Math.floor(v), 0, c.stock[j]));
  Q.train = Math.max(0, Math.floor(Q.train));
  if (Q.base && (Q.base.amt <= 0 || Q.base.f >= W.unlocked)) Q.base = null;
  return Q;
}

export const rankOf = (W: World, id = 'us') => (W.last ? W.last.rank.indexOf(id) + 1 : 0);

// 다음 달 결정표: 지난달에 고른 파티·포션·훈련·계약 파티는 그대로 두고, 단원 수와 열린 층에 맞춰 고친다.
// 거점 투자는 한 번 나가는 돈이라 비우고, 창고는 기본으로 다 판다
export function carryPlan(W: World, prev: Plan | null): Plan {
  if (!prev) return defaultPlan(W);
  const c = us(W), P: Plan = JSON.parse(JSON.stringify(prev));
  P.base = null;
  P.sell = [...c.stock];
  P.parties = P.parties.map((n, f) => (f < W.unlocked ? n : 0));
  let over = P.parties.reduce((a, b) => a + b, 0) - maxParties(c);
  for (let f = 0; f < NF && over > 0; f++) { const d = Math.min(over, P.parties[f]); P.parties[f] -= d; over -= d; }
  return P;
}
