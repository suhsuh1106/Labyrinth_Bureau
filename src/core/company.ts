// 용병단 경영 (새 전제, docs/plan.md 1단계). 옛 관리국 규칙과 따로 돌아가는 엔진이다.
// 여러 용병단이 같은 층에서 전리품을 캐고 같은 시장에 판다. 층마다 캘 수 있는 양이 한정돼 몰리면 나눠 갖고,
// 모두가 같은 시세에 팔아서 다 같이 많이 팔면 값이 떨어진다. 플레이어는 그중 한 용병단의 행정관이다.
// 화면에 붙이기 전까지는 상태를 S가 아니라 이 파일의 World 하나로 둔다.
import { CLASSES, CLASS_SHARE, GEARS, GEAR_SHARE, KEYS, MONSTERS } from './data';
import { rnd } from './rng';
import { keyWord } from './util';

export const CO = {
  PARTY: 4, WAGE: 30, SORTIE: 60, POTION0: 35, POTION_Q0: 500,
  BASE_STEP: 3000, BASE_MAX: 2, SPOIL: 0.03, REGEN: 0.5,
  HIRE_FEE: 120, HIRE_CUT: 0.4, START_CASH: 12000,
  // 가장 깊은 열린 층에서 이만큼 성공이 쌓이면 다음 층이 열린다 (모든 용병단이 함께 뚫는다)
  OPEN_WINS: [40, 60, 80, 100],
  // 편성 지침: 그 층 몬스터의 약점을 갖춘 파티는 성공률이 오르고, 역효과를 갖춘 파티는 떨어진다. 지침대로 갖추는 데 조당 돈이 든다
  GUIDE_COST: 20, KEY_BONUS: 0.20, BAD_PEN: 0.15,
  // 포션 공급: 상단은 물량이 무제한이고 수요가 많을수록 비싸진다. 교회 성수 포션은 조금 비싸고 한 달 공급 한도가 있지만,
  // 사망을 더 줄인다 (모두 교회 포션이면 한 병이 1+HOLY병 몫)
  POTION_C0: 32, CHURCH_CAP: 360, HOLY: 0.25,
  // 담합: 포션 수요와 사망이 쌓이면 긴장이 차고, 넘치면 상단과 교회가 함께 값을 올린다. 교회 후원이 쌓이면 교회가 빠진다
  CARTEL_MARKUP: 1.4, CARTEL_MONTHS: 5, CARTEL_COOL: 8, BREAK_DONATION: 3000, TENSION_Q: 300,
  // 죽은 자리를 채우는 신입에게 주는 계약금 (한 명당)
  RECRUIT: 80,
  // 큰 조직일수록 사람 하나 굴리는 데 드는 관리비가 오른다: 급여 × (1 + 단원 수 / OVERHEAD). 시작 금고는 규모^CASH_EXP에 비례
  OVERHEAD: 100, CASH_EXP: 1,
};
// 경쟁 용병단이 한 층에 몇 달 드나들어야 그 층의 약점을 깨치는가 (군소 용병대는 깨치지 못한다)
const LEARN_AT: Record<string, number> = { deep: 5, steady: 6, shallow: 6, second: 6, chaser: 8, volume: 9, hoarder: 9 };

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
  know: number[]; learned: boolean[];   // 층마다 드나든 달 수와 약점을 깨쳤는지 (경쟁 용병단)
  relM?: number; relC?: number;   // 상단·교회와의 사이 (0~100, 50이 보통)
  // 판마다 조금씩 다른 성격: 지난달 벌이에 얼마나 민감한지, 포션을 더 쓰는지, 얼마나 값이 올라야 파는지
  trait?: { resp: number; pots: number; sellBar: number };
};
// guide: 층마다 편성 지침 (KEYS 중 하나, 없으면 빈 문자열)
// church: 교회에서 사려는 포션 병 수 (나머지는 상단), donate: 교회 후원금
export type Plan = { parties: number[]; pots: number[]; sell: number[]; train: number; base: { f: number; amt: number } | null; hire: number[]; guide: string[]; church?: number; donate?: number };

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
  spend: { sortie: number; potion: number; wage: number; train: number; base: number; hire: number; recruit: number; donate: number }; net: number; recruited: number;
  potNeed: number; potC: number;   // 이번 달 쓴 포션과 그중 교회 포션
};
export type MonthResult = {
  month: number; res: CoResult[]; plans: Plan[]; Q: number[]; price: number[]; potion: number; potQ: number; potionC: number; cartel: boolean;
  floors: { before: number; taken: number; crowd: number }[]; perParty: number[]; opened: number | null; rank: string[];
};
// 현장 기록: 우리 파티만 가져오는 정보다. 증언(notes)과, 어떤 직업·장비를 갖춘 파티가 몇 번 나가 몇 번 성공했는지(obs, '*'는 그 층 전체)
export type Note = { m: number; f: number; t: string };
export type World = {
  month: number; unlocked: number; prog: number; pool: number[]; price: number[]; potion: number;
  cos: Company[]; last: MonthResult | null; history: MonthResult[]; log: { m: number; t: string }[];
  mons: number[]; notes: Note[]; obs: Record<string, { n: number; w: number }>[];
  potionC?: number;   // 지난달 교회 포션 값 (후원하지 않은 쪽이 내는 값)
  cartel?: Cartel | null; tension?: number; cool?: number;
};
export type Cartel = { left: number; churchOut: boolean; donated: number[] };
// 이번 달 i번 용병단이 교회 포션에 내는 값: 담합 중엔 올라 있고, 교회가 빠진 뒤로는 후원한 용병단에만 예전 값으로 판다
export const churchPrice = (W: World, i: number) => {
  const K = W.cartel;
  return Math.round(CO.POTION_C0 * (K && !(K.churchOut && K.donated[i] > 0) ? CO.CARTEL_MARKUP : 1));
};

export function newWorld(): World {
  // 층마다 사는 것은 판마다 다르다
  const mons = MONSTERS.map((_, i) => i).sort(() => rnd() - 0.5).slice(0, FLOORS.length);
  return {
    mons, notes: [], obs: FLOORS.map(() => ({})), potionC: CO.POTION_C0, cartel: null, tension: 0, cool: 0,
    month: 1, unlocked: 1, prog: 0, pool: FLOORS.map(F => F.max), price: ITEMS.map(it => it.P0), potion: CO.POTION0,
    cos: ROSTER.map(r => ({ ...r, members: r.size, cash: r.style === 'crowd' ? 0 : Math.round(CO.START_CASH * Math.pow(r.size / 36, CO.CASH_EXP)),
      skill: 0, bases: zeros(), pendingBase: null, stock: zeros(), losses: 0, know: zeros(), learned: FLOORS.map(() => false), relM: 50, relC: 50,
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

export function emptyPlan(): Plan { return { parties: zeros(), pots: FLOORS.map(() => 3), sell: zeros(), train: 0, base: null, hire: zeros(), guide: FLOORS.map(() => '') }; }

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
  // 교회와 가까운 안정형은 포션을 주로 교회에서 사고, 담합이 터지면 교회를 후원해 빼내려 한다. 나머지는 상단 위주로 산다
  const need = FLOORS.reduce((a, _, f) => a + P.parties[f] * pots, 0);
  // 교회 값이 상단보다 싸지면(교회가 담합에서 빠지면) 모두 교회로 몰린다
  const cheap = churchPrice(W, i) < W.potion;
  P.church = Math.round(need * (cheap ? 1 : c.style === 'steady' ? 0.6 : 0.15));
  P.donate = c.style === 'steady' && W.cartel && (!W.cartel.churchOut || !W.cartel.donated[i]) && c.cash > 8000 ? 800 : 0;
  // 깨친 층에서는 약점대로 갖춰 들어간다
  P.guide = FLOORS.map((_, f) => (c.learned && c.learned[f] ? MONSTERS[W.mons[f]].key : ''));
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
export const sortieCost = (P: Plan, potion: number) => FLOORS.map((_, f) => (P.parties[f] + P.hire[f]) * (CO.SORTIE + P.pots[f] * potion + (P.guide && P.guide[f] ? CO.GUIDE_COST : 0)));

// ---------- 한 달 ----------
export function runMonth(W: World, playerPlan: Plan): MonthResult {
  const plans = W.cos.map((c, i) => (c.style === 'player' ? sanitize(W, c, playerPlan) : aiPlan(W, i)));
  // 계약 파티로 빌려 간 만큼 군소 용병대가 직접 보내는 파티가 준다
  const ci = W.cos.findIndex(c => c.style === 'crowd');
  // 군소 용병대가 가진 파티보다 많이 빌릴 수는 없다. 플레이어가 먼저 빌리고, 나머지는 순서대로 나눠 빌린다
  if (ci >= 0) { let free = maxParties(W.cos[ci]); plans.forEach(P => { P.hire = P.hire.map(h => { const x = Math.min(h, free); free -= x; return x; }); }); }
  const hiredAll = plans.reduce((a, P) => a + P.hire.reduce((s, v) => s + v, 0), 0);
  if (ci >= 0) { let cut = hiredAll; const P = plans[ci]; for (let f = 0; f < NF && cut > 0; f++) { const d = Math.min(cut, P.parties[f]); P.parties[f] -= d; cut -= d; } }
  const need = plans.map(P => P.parties.reduce((s, n, f) => s + (n + P.hire[f]) * P.pots[f], 0));
  const potQ = need.reduce((a, b) => a + b, 0);
  // 포션 값: 상단은 수요를 따라, 교회는 정해진 값. 담합 중이면 둘 다 오르고, 교회가 빠졌으면 교회 값은 돌아온다
  const K = W.cartel;
  const potion = Math.round(potionPrice(potQ) * (K ? CO.CARTEL_MARKUP : 1));
  const potionC = Math.round(CO.POTION_C0 * (K ? CO.CARTEL_MARKUP : 1)), pc = W.cos.map((_, i) => churchPrice(W, i));
  // 교회 포션 나누기: 한도보다 많이 찾으면 교회와 사이가 좋은 용병단부터 더 받는다
  const req = plans.map((P, i) => clamp(Math.floor(P.church || 0), 0, need[i]));
  const reqAll = req.reduce((a, b) => a + b, 0);
  const wt = req.map((q, i) => q * (0.5 + (W.cos[i].relC ?? 50) / 100)), wtAll = wt.reduce((a, b) => a + b, 0);
  const gotC = req.map((q, i) => (reqAll <= CO.CHURCH_CAP ? q : Math.min(q, Math.floor(CO.CHURCH_CAP * wt[i] / wtAll))));
  const holy = need.map((n, i) => 1 + (n ? CO.HOLY * gotC[i] / n : 0));
  const res: CoResult[] = W.cos.map(() => ({ sent: zeros(), hired: zeros(), ok: zeros(), got: zeros(), deaths: 0, sold: zeros(), sales: 0,
    spend: { sortie: 0, potion: 0, wage: 0, train: 0, base: 0, hire: 0, recruit: 0, donate: 0 }, net: 0, recruited: 0, potNeed: 0, potC: 0 }));
  const floors: MonthResult['floors'] = [];
  let deepWins = 0;
  FLOORS.forEach((F, f) => {
    const crowd = plans.reduce((a, P) => a + P.parties[f] + P.hire[f], 0);
    const mon = MONSTERS[W.mons[f]], seen = { good: false, bad: false };
    const wins = W.cos.map((c, i) => {
      const P = plans[i], n = P.parties[f] + P.hire[f], p = succRate(c, f, P.pots[f], crowd);
      let w = 0, d = 0;
      for (let q = 0; q < n; q++) {
        // 파티마다 직업 넷과 장비 하나가 섞여 들어간다. 지침이 있으면 그 직업이나 장비를 꼭 갖춘다
        const keys = rollParty(P.guide ? P.guide[f] : '');
        const hasKey = keys.includes(mon.key), hasBad = keys.includes(mon.bad);
        const ok = rnd() < clamp(p + (hasKey ? CO.KEY_BONUS : 0) - (hasBad ? CO.BAD_PEN : 0), 0.05, 0.97);
        if (ok) w++;
        else if (q < P.parties[f]) d += Math.round(Math.max(0, CO.PARTY * F.risk * Math.max(0.2, 1.9 - 0.3 * P.pots[f] * holy[i]) * (0.5 + rnd())));   // 계약 파티의 사망은 그들 몫
        // 우리 직영 파티만 무엇을 갖추고 갔고 어떻게 됐는지 기록해 온다
        if (c.style === 'player' && q < P.parties[f]) {
          ['*', ...keys].forEach(k => { const o = W.obs[f][k] || (W.obs[f][k] = { n: 0, w: 0 }); o.n++; if (ok) o.w++; });   // '*'는 그 층 전체
          if (ok && hasKey) seen.good = true;
          if (!ok && hasBad) seen.bad = true;
        }
      }
      res[i].sent[f] = P.parties[f]; res[i].hired[f] = P.hire[f]; res[i].ok[f] = w; res[i].deaths += d;
      return w;
    });
    if (f === W.unlocked - 1) deepWins = wins.reduce((a, b) => a + b, 0);
    if (plans[0].parties[f]) testimony(W, f, seen);
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
    // 상단 경매장(가죽·마석)은 단골을 조금 더 쳐준다: 상단과의 사이에 따라 ±5%
    const favor = (j: number) => (j <= 1 ? 1 + ((c.relM ?? 50) - 50) / 1000 : 1);
    ITEMS.forEach((_, j) => { const s = Math.min(P.sell[j], c.stock[j]); r.sold[j] = s; c.stock[j] -= s; r.sales += Math.round(s * price[j] * favor(j)); });
    c.stock = c.stock.map(v => Math.floor(v * (1 - CO.SPOIL)));
    FLOORS.forEach((_, f) => { c.stock[f] += r.got[f]; });
    const pot = gotC[i] * pc[i] + (need[i] - gotC[i]) * potion;
    // 출정비(포션 제외)는 정수로 따로 센다. 섞인 포션 단가로 빼면 소수점 오차가 장부에 남는다
    const sortie = sortieCost(P, 0).reduce((a, b) => a + b, 0);
    r.potNeed = need[i]; r.potC = gotC[i];
    // 빈자리는 원래 규모까지, 한 달에 규모의 1/10씩 채운다. 신입마다 계약금이 든다 (군소 용병대는 따로)
    r.recruited = c.style === 'crowd' ? 0 : Math.min(Math.round(c.size / 10), Math.max(0, c.size - c.members + r.deaths));
    r.spend = { sortie, potion: pot, wage: Math.round(c.members * CO.WAGE * (1 + c.members / CO.OVERHEAD)), train: P.train, base: P.base ? P.base.amt : 0, hire: hireCost(P), recruit: r.recruited * CO.RECRUIT, donate: Math.max(0, Math.floor(P.donate || 0)) };
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
    } else c.members = Math.max(8, c.members - r.deaths + r.recruited);
  });
  politics(W, plans, res, potQ);
  // 경쟁 용병단은 한 층에 오래 드나들수록 그 층의 약점을 깨친다. 깨친 소문은 신문에 새어 나온다
  W.cos.forEach((c, i) => {
    const at = LEARN_AT[c.style]; if (!at || !c.know) return;
    FLOORS.forEach((F, f) => {
      if (!plans[i].parties[f] || c.learned[f]) return;
      if (++c.know[f] >= at) { c.learned[f] = true; const k = MONSTERS[W.mons[f]].key; W.log.push({ m: W.month, t: `${c.name} 파티들이 ${F.name}에 ${keyWord(k)}${eulOf(keyWord(k))} 챙겨 들어가기 시작했다는 말이 돈다.` }); }
    });
  });
  // 길 뚫기: 가장 깊은 열린 층에서 성공이 쌓이면 다음 층이 열린다
  let opened: number | null = null;
  if (W.unlocked < NF) {
    W.prog += deepWins;
    if (W.prog >= CO.OPEN_WINS[W.unlocked - 1]) { opened = W.unlocked; W.unlocked++; W.prog = 0; W.log.push({ m: W.month, t: `${FLOORS[opened].name}이 열렸다` }); }
  }
  const perParty = FLOORS.map((_, f) => { const n = plans.reduce((a, P) => a + P.parties[f] + P.hire[f], 0); return n ? res.reduce((a, r) => a + r.got[f], 0) * price[f] / n : 0; });
  W.price = price; W.potion = potion; W.potionC = potionC;
  const rank = W.cos.filter(c => c.style !== 'crowd').map(c => [worth(W, c), c.id] as [number, string]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
  const M: MonthResult = { month: W.month, res, plans, Q, price, potion, potQ, potionC, cartel: !!K, floors, perParty, opened, rank };
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
  Q.church = Math.max(0, Math.floor(Q.church || 0)); Q.donate = Math.max(0, Math.floor(Q.donate || 0));
  Q.guide = FLOORS.map((_, f) => (Q.guide && KEYS.includes(Q.guide[f]) && f < W.unlocked ? Q.guide[f] : ''));
  if (Q.base && (Q.base.amt <= 0 || Q.base.f >= W.unlocked)) Q.base = null;
  return Q;
}

// 상단·교회와의 사이, 담합. 사는 쪽과 가까워지고, 교회 후원은 교회와 가깝게 상단과 멀게 한다.
// 담합은 포션 수요와 사망이 쌓인 긴장에서 생기고, 한 달 전에 소문이 돈다. 교회 후원이 쌓이면 교회가 빠진다 (모두에게 이득이다)
function politics(W: World, plans: Plan[], res: CoResult[], potQ: number) {
  const deaths = res.reduce((a, r) => a + r.deaths, 0);
  W.cos.forEach((c, i) => {
    if (c.style === 'crowd') return;
    const r = res[i], don = r.spend.donate;
    c.relC = clamp((c.relC ?? 50) + r.potC / 60 + don / 200, 0, 100);
    c.relM = clamp((c.relM ?? 50) + (r.potNeed - r.potC) / 120, 0, 100);
    c.relC += (50 - c.relC) * 0.05; c.relM += (50 - c.relM) * 0.05;
  });
  const K = W.cartel;
  if (K) {
    plans.forEach((P, i) => { K.donated[i] = (K.donated[i] || 0) + Math.max(0, Math.floor(P.donate || 0)); });
    if (!K.churchOut && K.donated.reduce((a, b) => a + b, 0) >= CO.BREAK_DONATION) {
      K.churchOut = true;
      W.cos.forEach((c, i) => { if (K.donated[i] > 0) { c.relC = clamp((c.relC ?? 50) + 10, 0, 100); c.relM = clamp((c.relM ?? 50) - 15, 0, 100); } });
      const who = W.cos.filter((_, i) => K.donated[i] > 0).map(c => c.name).join(', ');
      W.log.push({ m: W.month, t: `교회가 ${who}에는 성수 포션을 예전 값으로 내주기로 했다. 후원에 대한 답례라고 했다. 상단 조합장은 말을 아꼈다.` });
    }
    if (--K.left <= 0) { W.cartel = null; W.cool = CO.CARTEL_COOL; W.log.push({ m: W.month, t: '상단 포션 값이 내려왔다. 한동안 이어지던 값 올리기가 끝난 모양이다.' }); }
    return;
  }
  if ((W.cool || 0) > 0) { W.cool = (W.cool || 0) - 1; return; }
  const before = W.tension || 0;
  // 긴장: 포션 수요(상단의 약초 사정)와 사망(교회의 장례 기금)이 함께 누른다. 평소에는 0.8 안팎에서 오르내린다
  W.tension = before * 0.7 + 0.17 * (potQ / CO.TENSION_Q + deaths / 40);
  // 소문이 적어도 한 달 먼저 돈다: 긴장이 한 번에 1을 넘어도 그달은 소문만 나고, 다음 달에도 높으면 담합이 된다
  if (W.tension > 1 && before > 0.9) {
    W.cartel = { left: CO.CARTEL_MONTHS, churchOut: false, donated: W.cos.map(() => 0) }; W.tension = 0;
    W.log.push({ m: W.month, t: '상단과 교회가 다음 달부터 포션 값을 함께 올린다고 알려 왔다. 상단은 약초 값을, 교회는 장례 기금을 이유로 들었다.' });
  } else if (W.tension > 0.9 && before <= 0.9) {
    W.log.push({ m: W.month, t: '상단 조합 회계와 교회 회계 사제가 요즘 자주 마주 앉는다는 말이 돈다.' });
  }
}

const eulOf = (w: string) => ((w.charCodeAt(w.length - 1) - 0xac00) % 28 ? '을' : '를');
const pickW = <T,>(xs: T[], ws: number[]) => { let x = rnd() * ws.reduce((a, b) => a + b, 0); for (let i = 0; i < xs.length; i++) { x -= ws[i]; if (x <= 0) return xs[i]; } return xs[xs.length - 1]; };
// 파티 하나의 구성: 직업 넷과 장비 하나. 지침(key)이 있으면 그것을 꼭 넣는다. 갖춘 것을 KEYS 꼴로 돌려준다
export function rollParty(guide = '') {
  const cls = [0, 1, 2, 3].map(() => pickW(CLASSES, CLASS_SHARE));
  let gear = pickW(GEARS, GEAR_SHARE);
  if (guide.startsWith('c:') && !cls.includes(guide.slice(2))) cls[0] = guide.slice(2);
  if (guide.startsWith('g:')) gear = guide.slice(2);
  return [...new Set(cls.map(x => 'c:' + x)), ...(gear !== '일반' ? ['g:' + gear] : [])];
}
// 현장 증언: 우리 파티가 다녀온 층에서 들은 말을 남긴다. 처음 가면 겉모습, 세 달째 더 자세한 겉모습,
// 약점을 갖춘 파티가 성공하거나 역효과를 갖춘 파티가 실패하면 그 이야기를 가끔 가져온다
function testimony(W: World, f: number, seen: { good: boolean; bad: boolean }) {
  const mon = MONSTERS[W.mons[f]], here = W.notes.filter(n => n.f === f), say = (t: string) => W.notes.push({ m: W.month, f, t });
  const visits = W.history.filter(M => M.res[0].sent[f] > 0).length + 1;
  if (!here.length) say(mon.look[0]);
  else if (visits >= 3 && !here.some(n => n.t === mon.look[1])) say(mon.look[1]);
  const recent = here.slice(-3).map(n => n.t);
  if (seen.good && rnd() < 0.5 && !recent.includes(mon.good)) say(mon.good);
  if (seen.bad && rnd() < 0.5 && !recent.includes(mon.badSay)) say(mon.badSay);
}
export const keysAll = KEYS;

export const rankOf = (W: World, id = 'us') => (W.last ? W.last.rank.indexOf(id) + 1 : 0);

// 다음 달 결정표: 지난달에 고른 파티·포션·훈련·계약 파티는 그대로 두고, 단원 수와 열린 층에 맞춰 고친다.
// 거점 투자는 한 번 나가는 돈이라 비우고, 창고는 기본으로 다 판다
export function carryPlan(W: World, prev: Plan | null): Plan {
  if (!prev) return defaultPlan(W);
  const c = us(W), P: Plan = JSON.parse(JSON.stringify(prev));
  P.base = null; P.donate = 0;
  P.sell = [...c.stock];
  P.parties = P.parties.map((n, f) => (f < W.unlocked ? n : 0));
  let over = P.parties.reduce((a, b) => a + b, 0) - maxParties(c);
  for (let f = 0; f < NF && over > 0; f++) { const d = Math.min(over, P.parties[f]); P.parties[f] -= d; over -= d; }
  return P;
}
