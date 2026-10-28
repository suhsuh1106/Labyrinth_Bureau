// 미궁관리국 배경 엔진 0단계: 저량 넷(수위 · 세력의 돈 · 영향력 · 호감)과 인과 루프 두 쌍
//   R1 범람 소용돌이 ↔ B1 개입: 수위가 오르면 사고가 늘어 조가 발을 빼고, 덜 들어가니 수위가 더 오른다.
//                              국장은 출입 보조금(예산)으로 조를 다시 들인다.
//   R3 몸집 ↔ B3 견제: 커진 길드는 영향력으로 몫을 더 가져가 더 커진다.
//                      눈에 띄면 영주의 세금 · 다른 길드의 결집이 붙잡는다(어느 길드든).
// 국장은 고리를 직접 돌리지 않고 숫자(보조금 · 우선권 조항 · 영주 몫)로 연결을 조금 휜다.
// 화면이 없다. 하루가 한 턴이고, 그날의 보고는 거리만큼 늦게 도착한다(`seen`).
// 숫자는 모두 자리표시: `npm run sim:bureau`로 돌려 보고 정한다. 설계는 docs/bureau.md.
import { rnd, setSeed } from '../core/rng';

export const B = {
  DAYS: 360, MONTH: 30,
  DANGER: 70, FLOOD: 100, FLOOD_TO: 80,   // 위험 수위 · 범람 · 범람 뒤 수위
  CLEAR: 0.15,                            // 조 하나가 하루에 내리는 수위 (수위 50에서. 붐빌수록 더 잡는다: clearOf)
  RISK_AT: 55, RISK_K: 1 / 2000,          // 이 수위부터 조마다 사고(죽음, 조 단위)
  FEAR: 20, FEAR_FADE: 0.85,              // 사고가 남기는 꺼림(R1): 죽은 조 하나당, 하루에 남는 몫
  MOVE: 0.25,                             // 조가 하루에 바라는 자리로 옮겨 가는 몫
  SUB_LURE: 2, WANT_K: 1.4,               // 보조금 G당 끌림 · 끌림 1당 바라는 조
  PRICE: 10, FEE: 2,                      // 소재 값 · 조마다 하루 입장료
  UPKEEP: 0.9, GROW: 120, GROW_COST: 100, SHRINK: -80, SIZE_MIN: 2,
  INFL_SIZE: 4, INFL_MONEY: 1 / 60, INFL_HALF: 60, // 영향력 = 100 × x / (x + 60), x = 조 × 4 + 돈 / 60: 끝에 붙지 않는다
  RICH: 40,                               // 수위가 이보다 낮으면 캘 것도 적다 (몬스터 · 광맥이 함께 준다)
  R3: 1 / 200,                            // 영향력 1이 몫 무게에 더하는 값
  NOTICE: 50, CHECK_K: 0.02, CHECK_FADE: 0.98, // B3: 영향력이 이보다 크면 견제가 쌓인다 (쌓이는 끝 = 넘친 만큼)
  CHECK_TAX: 0.02, CHECK_RALLY: 0.03,     // 견제 1당 그 길드의 세금 · 다른 길드의 몫 무게(결집)
  CHECK_ON: 5,                            // 이 위면 견제가 켜졌다고 센다
  LORD_SPEND: 0.01,                       // 영주가 날마다 쓰는 돈의 몫
  GRANT: 1000, GRANT_K: 20,               // 달마다 중앙의 배정 = 1000 + 입지 × 20
  FAV_BACK: 0.01, STAND_FLOOD: 18, STAND_POL: 1 / 30000, STAND_OUT: 0.1, // 입지: 범람마다 깎임 · 영향력 × 호감 · 물량
};

export type GuildId = 'big' | 'small';
export interface Dungeon {
  id: string; name: string; lord: string; dist: number;
  rise: number; yld: number; cap: number;
  level: number; teams: Record<GuildId, number>;
  fear: number; floods: number; dead: number;
  sub: number;                    // 국장이 정한 출입 보조금 (조마다 하루 G)
  dangerAt: number | null;        // 위험 수위를 넘은 날 (범람까지 날 수를 잰다)
}
export interface Guild { id: GuildId; name: string; size: number; money: number; infl: number; fav: number; check: number; peak: number }
export interface Lord { name: string; money: number; infl: number; fav: number }
export interface Report { day: number; from: string; title: string; chips: string[] }
export interface Stats {
  floods: number; dead: number; spent: number;
  toFlood: number[];              // 위험 수위부터 범람까지 날 수
  pinned: Record<string, number>; // 저량이 끝에 붙은 날
  loops: Record<'R1' | 'B1' | 'R3' | 'B3', number>; // 고리가 켜진 날
  bigSize: number[];              // 날마다 가장 큰 길드의 조 수
}
export interface World {
  day: number; budget: number; standing: number;
  prio: number;                   // 우선권 조항 0 ~ 100: 50보다 크면 큰 길드 편
  lordShare: number;              // 입장료에서 영주 몫 %
  dungeons: Dungeon[]; guilds: Record<GuildId, Guild>; lord: Lord;
  seen: number[][];               // 국장 책상에 도착한 미궁마다 수위 (보고가 거리만큼 늦다)
  hist: number[][];               // 미궁마다 날마다 참 수위
  reports: Report[];
  stats: Stats;
  noCheck?: boolean;              // B3를 끈 판 (고리 확인용)
  noFear?: boolean;               // R1의 꺼림을 끈 판
}

const DUNGEONS: Omit<Dungeon, 'teams' | 'fear' | 'floods' | 'dead' | 'sub' | 'dangerAt'>[] = [
  { id: 'pit', name: '폐광', lord: '로이드 백작령', dist: 1, rise: 1.25, yld: 6, cap: 12, level: 84 },
  { id: 'wood', name: '검은숲 미궁', lord: '하벨 자작령', dist: 2, rise: 1.0, yld: 9, cap: 10, level: 45 },
  { id: 'sunk', name: '수몰 갱도', lord: '로이드 백작령', dist: 2, rise: 1.5, yld: 12, cap: 10, level: 55 },
];

export function newWorld(seed: number, o: { noCheck?: boolean; noFear?: boolean } = {}): World {
  setSeed(seed);
  // 첫 미궁(폐광)은 판마다 같다. 나머지는 성질이 판마다 조금 다르다
  const dungeons = DUNGEONS.map((d, i) => ({
    ...d,
    rise: i ? +(d.rise * (0.85 + rnd() * 0.3)).toFixed(2) : d.rise,
    yld: i ? Math.round(d.yld * (0.8 + rnd() * 0.4)) : d.yld,
    teams: { big: i ? 4 : 0, small: i ? 2 : 0 }, fear: 0, floods: 0, dead: 0, sub: 0, dangerAt: null,
  }));
  const guild = (id: GuildId, name: string, size: number, fav: number): Guild =>
    ({ id, name, size, money: 0, infl: 0, fav: fav + Math.round((rnd() - 0.5) * 12), check: 0, peak: size });
  const W: World = {
    day: 0, budget: 3000, standing: 20, prio: 50, lordShare: 10,
    dungeons,
    guilds: { big: guild('big', '붉은 깃발단', 12, 50), small: guild('small', '중소 길드 연합', 6, 55) },
    lord: { name: '영주들', money: 0, infl: 0, fav: 45 + Math.round((rnd() - 0.5) * 12) },
    seen: dungeons.map(d => [d.level]), hist: dungeons.map(d => [d.level]),
    reports: [{ day: 0, from: '왕도일보', title: '폐광 아래 미궁 범람, 미궁관리국 신설', chips: ['범람 직후'] }],
    stats: { floods: 0, dead: 0, spent: 0, toFlood: [], pinned: {}, loops: { R1: 0, B1: 0, R3: 0, B3: 0 }, bigSize: [] },
    ...o,
  };
  return W;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const fav = (o: { fav: number }, v: number) => { o.fav = clamp(o.fav + v, 0, 100); };
export const teamsIn = (d: Dungeon) => d.teams.big + d.teams.small;
// 국장이 아는 수위: 거리만큼 늦은 보고
export const seenLevel = (W: World, i: number) => W.seen[i].at(-1)!;

// 조 하나가 하루에 내리는 수위: 몬스터가 많으면 한 조가 더 잡는다
export const clearOf = (level: number) => B.CLEAR * (0.5 + level / 100);
export const richOf = (level: number) => Math.min(1, level / B.RICH);
const inflOf = (x: number) => 100 * Math.max(0, x) / (Math.max(0, x) + B.INFL_HALF);
// 조 하나가 이 미궁에 들어가 하루 버는 값의 어림: 벌이 + 보조금 − 위험 − 꺼림
export function lure(W: World, d: Dungeon) {
  return d.yld * B.PRICE / 10 * richOf(d.level) * (1 - d.level / 160) + d.sub / B.SUB_LURE - Math.max(0, d.level - 65) / 8 - (W.noFear ? 0 : d.fear / 10);
}

// 길드가 영향력으로 더 가져가는 몫(R3)과, 다른 길드가 눈에 띄어 결집한 몫(B3). 우선권 조항은 큰 길드(big) 쪽으로 기운다
export const otherOf = (g: GuildId): GuildId => g === 'big' ? 'small' : 'big';
export function weightOf(W: World, g: GuildId) {
  const G = W.guilds, tilt = (W.prio - 50) / 100 * (g === 'big' ? 1 : -1);
  return Math.max(0.3, 1 + tilt + G[g].infl * B.R3 + (W.noCheck ? 0 : G[otherOf(g)].check * B.CHECK_RALLY));
}

export function step(W: World) {
  const S = W.stats, G = W.guilds;
  W.day++;
  const r1Before = W.dungeons.map(d => teamsIn(d));
  // 조가 어디로 가나: 미궁마다 바라는 조 수, 길드 크기만큼만
  const want = W.dungeons.map(d => clamp(lure(W, d) * B.WANT_K, 0, d.cap * 1.6));
  const sum = want.reduce((a, b) => a + b, 0);
  let fees = 0, subs = 0;
  const haul: Record<GuildId, number> = { big: 0, small: 0 };
  W.dungeons.forEach((d, i) => {
    for (const g of ['big', 'small'] as GuildId[]) {
      const tgt = sum > 0 ? G[g].size * Math.min(1, sum / (G.big.size + G.small.size)) * want[i] / sum : 0;
      d.teams[g] += (tgt - d.teams[g]) * B.MOVE;
    }
    const n = teamsIn(d);
    d.level = Math.max(0, d.level + d.rise * (0.85 + rnd() * 0.3) - clearOf(d.level) * n);
    // 캐는 양은 붐비면 덜 는다. 나누는 몫은 길드의 무게대로
    const out = d.cap * (1 - Math.exp(-n / d.cap)) * d.yld * richOf(d.level) * (1 - d.level / 250);
    const wb = d.teams.big * weightOf(W, 'big'), ws = d.teams.small * weightOf(W, 'small');
    if (wb + ws > 0) { haul.big += out * wb / (wb + ws); haul.small += out * ws / (wb + ws); }
    // 사고: 위험 수위 언저리부터 죽는다. 죽음은 꺼림으로 남아 조를 밀어낸다(R1)
    const dead = n * Math.max(0, d.level - B.RISK_AT) * B.RISK_K * (0.5 + rnd());
    d.dead += dead; S.dead += dead;
    d.fear = d.fear * B.FEAR_FADE + dead * B.FEAR;
    for (const g of ['big', 'small'] as GuildId[]) if (n > 0) G[g].size = Math.max(B.SIZE_MIN, G[g].size - dead * d.teams[g] / n);
    fees += n * B.FEE; subs += n * d.sub;
    if (d.level >= B.DANGER && d.dangerAt == null) d.dangerAt = W.day;
    if (d.level < B.DANGER - 10) d.dangerAt = null;
    if (d.level >= B.FLOOD) {
      d.floods++; S.floods++; d.level = B.FLOOD_TO;
      if (d.dangerAt != null) S.toFlood.push(W.day - d.dangerAt);
      d.dangerAt = W.day;
      W.standing -= B.STAND_FLOOD; fav(W.lord, -8); fav(G.small, -3); fav(G.big, -3);
      W.budget -= 300;   // 피해 복구
      W.reports.push({ day: W.day, from: '왕도일보', title: `${d.name} 범람`, chips: [`${d.lord} 마을 피해`, `이번이 ${d.floods}번째`] });
    }
    W.hist[i].push(d.level);
    W.seen[i].push(W.hist[i].at(-1 - d.dist) ?? W.hist[i][0]);
    const sn = W.seen[i];
    if (sn.at(-1)! >= B.DANGER && sn.at(-2)! < B.DANGER) W.reports.push({ day: W.day, from: '관리국 조사관', title: `${d.name} 위험 수위`, chips: [`${d.name} 수위`, `${d.dist}일 전 보고`] });
    // R1: 위험 수위 위에서 조가 빠지고 있다 / B1: 보조금이 조를 들이고 있다
    if (d.level >= B.DANGER && n < r1Before[i] - 0.01) S.loops.R1++;
    if (d.sub > 0 && n > r1Before[i] + 0.01) S.loops.B1++;
  });
  // 세력의 돈: 판매 − 급여·보급 − 세금(견제). 넉넉하면 조를 늘리고 모자라면 줄인다
  const top = G.big.size >= G.small.size ? G.big : G.small, topBefore = top.size;
  for (const g of ['big', 'small'] as GuildId[]) {
    const f = G[g], sale = haul[g] * B.PRICE * 0.06, tax = W.noCheck ? 0 : clamp(f.check * B.CHECK_TAX, 0, 0.4);
    f.money += sale * (1 - tax) - f.size * B.UPKEEP;
    W.lord.money += sale * tax;
    if (f.money > B.GROW) { f.size++; f.money -= B.GROW_COST; }
    if (f.money < B.SHRINK && f.size > B.SIZE_MIN) { f.size--; f.money += 60; }
    f.infl = inflOf(f.size * B.INFL_SIZE + f.money * B.INFL_MONEY);
    f.peak = Math.max(f.peak, f.size);
  }
  if (top.size > topBefore) S.loops.R3++;
  // B3 견제: 눈에 띈 길드에 쌓이고(영주의 세금 · 다른 쪽의 결집), 시간이 지나면 빠진다
  if (!W.noCheck) {
    for (const f of [G.big, G.small]) f.check = f.check * B.CHECK_FADE + Math.max(0, f.infl - B.NOTICE) * B.CHECK_K;
    if (G.big.check > B.CHECK_ON || G.small.check > B.CHECK_ON) S.loops.B3++;
  }
  // 예산: 입장료(영주 몫을 뺀 나머지) − 보조금, 달마다 중앙의 배정
  W.lord.money += fees * W.lordShare / 100;
  W.budget += fees * (1 - W.lordShare / 100) - subs;
  S.spent += subs;
  if (W.day % B.MONTH === 0) W.budget += B.GRANT + W.standing * B.GRANT_K;
  W.lord.money *= 1 - B.LORD_SPEND;
  W.lord.infl = inflOf(60 + W.lord.money / 20);
  // 호감: 평소로 천천히, 조항이 끌어당긴다
  for (const o of [G.big, G.small, W.lord]) o.fav += (50 - o.fav) * B.FAV_BACK;
  fav(G.big, (W.prio - 50) / 500); fav(G.small, -(W.prio - 50) / 400);
  fav(W.lord, (W.lordShare - 15) / 300);
  for (const d of W.dungeons) if (d.sub > 0) fav(G.small, d.sub / 4000);
  // 입지 = 물량 + 영향력 × 호감, 예산 적자는 깎는다
  const out = Object.values(haul).reduce((a, b) => a + b, 0);
  let pol = 0;
  for (const o of [G.big, G.small, W.lord]) pol += o.infl * (o.fav - 50);
  W.standing = clamp(W.standing + B.STAND_OUT * Math.log(1 + out / 40) + pol * B.STAND_POL - (W.budget < 0 ? 0.15 - W.budget / 5000 : 0), 0, 100);
  // 저량이 끝에 붙은 날
  const pin = (k: string, on: boolean) => { if (on) S.pinned[k] = (S.pinned[k] ?? 0) + 1; };
  pin('수위', W.dungeons.some(d => d.level <= 0 || d.level >= B.FLOOD - 1));
  pin('돈', G.big.money <= B.SHRINK || G.small.money <= B.SHRINK);
  pin('영향력', [G.big, G.small, W.lord].some(o => o.infl <= 0 || o.infl >= 100));
  pin('호감', [G.big, G.small, W.lord].some(o => o.fav <= 0 || o.fav >= 100));
  pin('입지', W.standing <= 0 || W.standing >= 100);
  S.bigSize.push(Math.max(G.big.size, G.small.size));
}

export const over = (W: World) => W.day >= B.DAYS;

export function run(W: World, bot: (W: World) => void = () => {}) {
  while (!over(W)) { bot(W); step(W); }
  return W;
}
