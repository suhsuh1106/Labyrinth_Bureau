// 용병단 시뮬레이터: 플레이어 봇 성향마다 여러 판을 돌려 평균 순위와 1위 분포를 본다.
//   npm run sim                         기본 200판, 모든 성향
//   npm run sim -- --games 500 --style smart
// 성향: even(고르게) · deep(깊은 층 위주) · hold(시세가 낮으면 쌓아 둠) · hire(계약 파티를 씀) · smart(시장을 읽는 숙련자)
import { setSeed } from '../src/core/rng';
import { CO, FLOORS, ITEMS, type Plan, type World, defaultPlan, maxParties, newWorld, rankOf, runMonth, succRate, us, worth } from '../src/core/company';

const arg = (k: string, d: string) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const games = +arg('games', '200'), seed0 = +arg('seed', '1'), only = arg('style', '');
const MONTHS = 36;

export const BOT: Record<string, (W: World) => Plan> = {
  even: W => defaultPlan(W),
  deep: W => {
    const P = defaultPlan(W), n = maxParties(us(W)), d = W.unlocked - 1;
    P.parties = FLOORS.map(() => 0);
    if (d === 0) P.parties[0] = n; else { P.parties[d] = Math.ceil(n * 0.6); P.parties[d - 1] = n - P.parties[d]; }
    P.pots = FLOORS.map(() => 4); P.train = 500;
    if (W.month % 6 === 0 && us(W).cash > 10000) P.base = { f: d, amt: CO.BASE_STEP };
    return P;
  },
  hold: W => { const P = defaultPlan(W); P.sell = us(W).stock.map((s, j) => (W.price[j] >= ITEMS[j].P0 * 0.95 || us(W).cash < 3000 ? s : 0)); return P; },
  hire: W => { const P = defaultPlan(W), d = W.unlocked - 1; if (W.last && W.last.perParty[d] > 400) P.hire[d] = 2; return P; },
  smart: W => smartPlan(W),
};

// 숙련 봇: 경쟁자와 군소 용병대가 지난달 벌이를 쫓아 몰려다니므로, 한 층에 몰아넣지 않고 열린 층에 고르게 나누되
// 조당 남는 돈(기준 시세와 지난 시세의 중간으로 어림)에 비례해 기울인다. 포션은 넉넉히, 크게 남는 층에는 계약 파티를 쓴다.
// 거점과 쌓아 두기는 지금 규모에서는 손해라 쓰지 않는다 (시뮬레이션으로 확인함)
export function smartPlan(W: World): Plan {
  const c = us(W), P = defaultPlan(W), L = W.last, pots = 4;
  const value = FLOORS.map((F, f) => {
    if (f >= W.unlocked) return 0;
    const p = succRate(c, f, pots, F.cap), unit = ((L && L.Q[f] ? W.price[f] : ITEMS[f].P0) + ITEMS[f].P0) / 2;
    return Math.max(1, p * F.take * unit - (CO.SORTIE + pots * W.potion));
  });
  const sum = value.reduce((a, b) => a + b, 0), n = maxParties(c);
  P.parties = value.map(v => Math.floor(n * v / sum));
  const order = value.map((v, f) => [v, f]).sort((a, b) => b[0] - a[0]);
  for (let k = 0, rest = n - P.parties.reduce((a, b) => a + b, 0); rest > 0; k++, rest--) P.parties[order[k % W.unlocked][1]]++;
  P.pots = FLOORS.map(() => pots);
  const best = value.indexOf(Math.max(...value));
  if (c.cash > 6000 && value[best] * (1 - CO.HIRE_CUT) - CO.HIRE_FEE > 150) P.hire[best] = 2;
  return P;
}

export function playGame(seed: number, bot: (W: World) => Plan) {
  setSeed(seed);
  const W = newWorld();
  for (let m = 0; m < MONTHS; m++) runMonth(W, bot(W));
  return W;
}

if (process.argv[1] && process.argv[1].endsWith('company.ts')) {
  for (const name of Object.keys(BOT).filter(k => !only || k === only)) {
    let rankSum = 0, worthSum = 0, firsts = 0, broke = 0;
    const winners: Record<string, number> = {}, opens = FLOORS.map(() => 0);
    for (let g = 0; g < games; g++) {
      const W = playGame(seed0 + g, BOT[name]);
      const r = rankOf(W); rankSum += r; if (r === 1) firsts++;
      worthSum += worth(W, us(W)); if (us(W).cash < 0) broke++;
      const top = W.last!.rank[0]; winners[top] = (winners[top] || 0) + 1;
      W.history.forEach(M => { if (M.opened != null) opens[M.opened] += M.month; });
      opens[0] += 0;
    }
    const n = W0().cos.filter(c => c.style !== 'crowd').length;
    console.log(`봇 '${name}' · ${games}판 · ${MONTHS}개월`);
    console.log(`  우리 평균 순위 ${(rankSum / games).toFixed(2)} / ${n} · 1위 ${Math.round(firsts / games * 100)}% · 평균 평가액 ${Math.round(worthSum / games).toLocaleString()}G · 금고 마이너스로 끝난 판 ${broke}`);
    console.log(`  1위 용병단 ${Object.entries(winners).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(v / games * 100)}%`).join(' · ')}`);
  }
}
function W0() { return newWorld(); }
