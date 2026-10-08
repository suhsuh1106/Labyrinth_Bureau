// 용병단 시뮬레이터: 플레이어 봇 성향마다 여러 판을 돌려 평균 순위와 1위 분포를 본다.
//   npm run sim                         기본 200판, 모든 성향
//   npm run sim -- --games 500 --style smart
// 성향: even(고르게) · deep(깊은 층 위주) · hold(시세가 낮으면 쌓아 둠) · hire(계약 파티를 씀) · smart(시장을 읽는 숙련자, 근원에는 채굴장)
//       smartNoGuide · smartSeal · smartNoRoot: 숙련 봇에서 지침을 빼거나 근원을 달리 다룬 것
import { setSeed } from '../src/core/rng';
import { CO, FLOORS, churchPrice, ITEMS, type Plan, type World, defaultPlan, demandMul, floorMons, maxParties, newWorld, rankOf, runMonth, succRate, us, worth } from '../src/core/company';
import { demandSeen } from '../src/ui/co/book';

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
  // 숙련 봇에서 추리만 뺀 것 (편성 지침이 순위에 얼마나 보태는지 재는 기준)
  smartNoGuide: W => { const P = smartPlan(W); P.guide = P.guide.map(() => ''); return P; },
  // 숙련 봇에서 도감으로 소재 챙기기만 뺀 것 (갈무리 편성이 순위에 얼마나 보태는지 재는 기준)
  smartNoKit: W => smartPlan(W, 'mine', false),
  // 숙련 봇이 근원을 봉인하는 쪽과, 근원을 그대로 두는 쪽 (채굴장과 견주는 기준)
  smartSeal: W => smartPlan(W, 'seal'),
  smartNoRoot: W => smartPlan(W, 'none'),
};

// 숙련 봇: 경쟁자와 군소 용병대가 지난달 벌이를 쫓아 몰려다니므로, 한 층에 몰아넣지 않고 열린 층에 고르게 나누되
// 조당 남는 돈(기준 시세와 지난 시세의 중간으로 어림)에 비례해 기울인다. 포션은 5병, 훈련비는 300(훈련은 갈수록 덜 올라 이 근처가 가장 낫다), 채집 장비 1단계,
// 크게 남는 층에는 계약 파티를 쓴다.
// 거점과 쌓아 두기는 지금 규모에서는 손해라 쓰지 않는다 (시뮬레이션으로 확인함)
export function smartPlan(W: World, rootMode: 'mine' | 'seal' | 'none' = 'mine', kit = true): Plan {
  const c = us(W), P = defaultPlan(W), L = W.last, pots = 5;
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
  P.tool = 1;   // 채집 장비 1단계가 가장 낫다 (2단계와 갈무리장은 이 규모에서 본전이 안 된다)
  const best = value.indexOf(Math.max(...value));
  if (c.cash > 6000 && value[best] * (1 - CO.HIRE_CUT) - CO.HIRE_FEE > 150) P.hire[best] = 2;
  P.guide = deduce(W);
  if (kit) P.guide = P.guide.map((g, f) => addKit(W, f, g, P.parties[f]));
  // 포션: 교회 값이 상단보다 싸면(후원해서 교회가 예전 값으로 내줄 때) 교회에서 사고, 담합이 터지면 여유가 있을 때 한 번 후원한다
  const need = P.parties.reduce((a, n, f) => a + (n + P.hire[f]) * P.pots[f], 0);
  P.church = churchPrice(W, 0) < W.potion ? need : 0;
  P.donate = W.cartel && !W.cartel.donated[0] && c.cash > 8000 ? 1000 : 0;
  // 근원: 찾은 근원이 있으면 여유가 있을 때 채굴장 기금을 넣는다. 채굴장과 그대로 두기는 순위가 비슷하고,
  // 봉인은 범람을 절반으로 줄이지만 우리 순위로는 손해다(200판 3.13 · 3.14 대 3.45). 봉인은 교회가 같은 돈을 보태 절반만 든다
  const rf = (W.roots || []).findIndex(r => r.found && !r.done);
  if (rf >= 0 && c.cash > 8000) P.root = rootMode === 'none' ? null : { f: rf, seal: rootMode === 'seal' ? CO.ROOT_COST / 4 : 0, mine: rootMode === 'mine' ? CO.ROOT_COST / 2 : 0 };
  return P;
}

// 현장 기록으로 약점 추리: 그 구성을 갖춘 파티와 안 갖춘 파티의 성공률을 견줘, 양쪽 다 여섯 번 넘게 나갔고
// 갖춘 쪽이 12%p 넘게 높은 구성 중 차이가 가장 큰 것을 지침으로 삼는다
export function deduce(W: World) {
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

export function playGame(seed: number, bot: (W: World) => Plan) {
  setSeed(seed);
  const W = newWorld();
  for (let m = 0; m < MONTHS; m++) runMonth(W, bot(W));
  return W;
}

if (process.argv[1] && process.argv[1].endsWith('company.ts')) {
  for (const name of Object.keys(BOT).filter(k => !only || k === only)) {
    let rankSum = 0, worthSum = 0, firsts = 0, broke = 0, overs = 0;
    const winners: Record<string, number> = {}, opens = FLOORS.map(() => 0);
    for (let g = 0; g < games; g++) {
      const W = playGame(seed0 + g, BOT[name]);
      const r = rankOf(W); rankSum += r; if (r === 1) firsts++;
      worthSum += worth(W, us(W)); if (us(W).cash < 0) broke++;
      overs += W.history.filter(M => M.overflow).length;
      const top = W.last!.rank[0]; winners[top] = (winners[top] || 0) + 1;
      W.history.forEach(M => { if (M.opened != null) opens[M.opened] += M.month; });
      opens[0] += 0;
    }
    const n = W0().cos.filter(c => c.style !== 'crowd').length;
    console.log(`봇 '${name}' · ${games}판 · ${MONTHS}개월`);
    console.log(`  우리 평균 순위 ${(rankSum / games).toFixed(2)} / ${n} · 1위 ${Math.round(firsts / games * 100)}% · 평균 평가액 ${Math.round(worthSum / games).toLocaleString()}G · 금고 마이너스로 끝난 판 ${broke} · 범람 판당 ${(overs / games).toFixed(2)}번`);
    console.log(`  1위 용병단 ${Object.entries(winners).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(v / games * 100)}%`).join(' · ')}`);
  }
}
function W0() { return newWorld(); }
