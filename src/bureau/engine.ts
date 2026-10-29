// 미궁관리국 배경 엔진. 0단계: 저량 넷(수위 · 세력의 돈 · 영향력 · 호감)과 인과 루프 두 쌍
//   R1 범람 소용돌이 ↔ B1 개입: 수위가 오르면 사고가 늘어 조가 발을 빼고, 덜 들어가니 수위가 더 오른다.
//                              국장은 출입 보조금(예산)으로 조를 다시 들인다.
//   R3 몸집 ↔ B3 견제: 커진 길드는 영향력으로 몫을 더 가져가 더 커진다.
//                      눈에 띄면 영주의 세금 · 다른 길드의 결집이 붙잡는다(어느 길드든).
// 1단계: 세력 사이 · 신세와 인과 루프 두 쌍
//   R4 원한 ↔ B4 회의 · 중재: 같은 미궁에 겹친 길드는 부딪치고, 부딪칠수록 사이가 벌어져 더 부딪친다.
//                              국장이 회의를 열어 협정을 맺게 한다(빠진 쪽은 앙금, 마지못한 쪽은 이행이 늦다).
//   R5 신세 굴리기 ↔ B5 빚 독촉: 청을 들어주면 신세를 받고, 받은 신세로 회의 서명을 얻는다.
//                                 내가 진 빚은 독촉 요청서로 돌아와 예산과 다른 쪽 호감을 쓴다.
//   세력끼리도 빚을 지고, 빚진 쪽은 엿새쯤 뒤 빌려준 쪽 편을 든다.
// 국장은 고리를 직접 돌리지 않고 숫자(보조금 · 우선권 조항 · 영주 몫 · 요청서에 줄 값)와 회의로 연결을 조금 휜다.
// 화면이 없다. 하루가 한 턴이고, 그날의 보고는 거리만큼 늦게 도착한다(`seen`).
// 숫자는 모두 자리표시: `npm run sim:bureau`로 돌려 보고 정한다. 설계는 docs/bureau.md.
import { rnd, setSeed } from '../core/rng';
import { CLAUSE, type Clauses, type ClauseId, CLAUSE_MAX, fits } from './clauses';

export const B = {
  DAYS: 360, MONTH: 30,
  DANGER: 70, FLOOD: 100, FLOOD_TO: 80,   // 위험 수위 · 범람 · 범람 뒤 수위
  CLEAR: 0.15,                            // 조 하나가 하루에 내리는 수위 (수위 50에서. 붐빌수록 더 잡는다: clearOf)
  RISK_AT: 55, RISK_K: 1 / 2000,          // 이 수위부터 조마다 사고(죽음, 조 단위)
  FEAR: 20, FEAR_FADE: 0.85,              // 사고가 남기는 꺼림(R1): 죽은 조 하나당, 하루에 남는 몫
  MOVE: 0.25,                             // 조가 하루에 바라는 자리로 옮겨 가는 몫
  SUB_LURE: 2, WANT_K: 1.4,               // 보조금 G당 끌림 · 끌림 1당 바라는 조
  WITHDRAW_FAV: 3, WITHDRAW_LEFT: 30,     // 공고를 기한 전에 내리면 길드마다 잃는 호감 (남은 기한이 이 날 수만큼이면 곱절)
  // 공고문의 기한이 길드의 믿음이다: 길면 믿고 오고, 짧으면 망설인다. 공고문 보조금의 끌림 = 값 × 믿음(기한으로, 길드마다).
  // 붉은 깃발단은 몸이 무거워 긴 공고에만 움직이고, 중소 연합은 짧아도 몇 조 보내 본다
  TRUST: { big: { base: -0.2, per: 1 / 30, lo: 0.1, hi: 1.2 }, small: { base: 0.6, per: 1 / 60, lo: 0.7, hi: 1.2 } } as Record<'big' | 'small', { base: number; per: number; lo: number; hi: number }>,
  // 공탁: 공고문을 걸 때 기한 동안 쓸 돈을 예산에서 떼어 둔다(보조금 × 기한 × 조 어림 + 위로금 × 잃을 조 어림).
  // 공고의 보조금 · 위로금은 공탁에서 먼저 나가고, 기한이 끝나거나 내리면 남은 공탁이 돌아온다
  ESCROW_T: 3, ESCROW_C: 1,
  REC_LURE: 1, REC_FAV: 1 / 50,           // 출입 기록 제출: 서류가 귀찮아 덜 끌림 · 붉은 깃발단이 하루에 잃는 호감
  COMFORT_HALF: 60, COMFORT_FAV: 1 / 6000, // 위로금: 이 값(G)이면 사고가 남기는 꺼림이 반 · 중소 연합이 G당 하루에 얻는 호감
  // 집무실: 입지 단계(이 입지에 닿으면 오름, 내려가지 않음). 단계가 오를 때마다 서기 한 명을 들일 수 있다. 서기 수 = 한꺼번에 내놓는 서류 수
  STAND_LV: [0, 30, 45, 60, 75], LETTER_LV: 2,
  // 요청서(길드 하나에 보내는 서신): 읽고 답하는 날 · 서명할 마음의 문턱 · 길드마다 꼬리표를 보는 무게
  LETTER_DAYS: 2, LETTER_AT: 50,
  // 공고문은 신문에 실려 퍼진다: 관리국에서 길드 본부까지 걸리는 날만큼 뒤에 그 길드에 걸린다
  HQ_DIST: { big: 2, small: 1 } as Record<'big' | 'small', number>,
  // 첫 요구서(중앙 행정원): 왕국군이 눌러 두고 있는 폐광을 넘겨받아라. 길드 조가 하루 min조 이상 need일 이어 들면 군이 물러나고(인계)
  // 예산 · 입지를 준다. 군이 버티는 동안 중앙의 인내가 모자란 조만큼 줄고(pat), 바닥나면 인계 없이 물러난다(입지를 깎는다).
  // 군은 주둔하는 동안 하루 clear만큼 수위를 누른다(오르는 만큼). fear: 범람이 남긴 꺼림
  ORDER: { dg: 0, min: 7, need: 3, pat: 100, drain: 1.4, clear: 1.25, fear: 30, pay: 1000, stand: 12, fail: 5 },
  LETTER_W: { big: { money: 0.4, info: 15, safe: 1 }, small: { money: 0.8, info: 5, safe: 3 } } as Record<'big' | 'small', { money: number; info: number; safe: number }>,
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
  // 1단계: 세력 사이(-100 ~ 100) · 신세
  CLASH_K: 0.04, CLASH_REL: 1.5, CLASH_DEAD: 0.05, CLASH_OUT: 0.1, // R4: 겹친 조 하나당 다툼 · 다툼 하나에 사이 · 죽음 · 덜 캐는 몫
  REL_FADE: 0.003,                        // 세력 사이가 0쪽으로 돌아가는 몫 (아주 천천히)
  PACT: 0.8, PACT_DAYS: 40, MEET_REL: 15, MEET_COOL: 10, MEET_OWE: 5, // B4: 협정이 줄이는 다툼 · 기간 · 사이 회복 · 다시 열 날 · 부탁한 값(신세)
  GRUDGE_DAYS: 2, GRUDGE: 6, SLOW_DAYS: 4, // 빠진 쪽의 앙금(이틀 뒤) · 마지못한 서명은 나흘 뒤 이행
  SIGN_AT: 45, SIGN_OWE: 2,               // 서명할 마음 = 호감 + 받은 신세 × 2. 이보다 낮으면 마지못해, 20 더 낮으면 거절
  ASK_DUE: 5, OWE_FADE: 0.995,            // 요청서는 닷새 안에 답한다 · 신세는 오래 두면 흐려진다
  DUN_AT: -6, DUN_EVERY: 15, DUN_G: 20,  // B5: 내가 진 빚이 이보다 크면 보름마다 독촉, 신세 1 = 20G
  LEND: 100, LEND_OWE: 10, SIDE_DAYS: 6, SIDE_REL: 8, // 세력끼리 빌려줌 · 그 빚 · 편들기까지 날 · 편들기 한 번에 사이
};

export type GuildId = 'big' | 'small';
export type LoopId = 'R1' | 'B1' | 'R3' | 'B3' | 'R4' | 'B4' | 'R5' | 'B5';
export type FacId = GuildId | 'lord';
export const FACS: FacId[] = ['big', 'small', 'lord'];
// 세력 둘의 사이를 적는 열쇠 (순서 없이 같은 열쇠)
export type PairKey = 'big:small' | 'big:lord' | 'lord:small';
export const pairOf = (a: FacId, b: FacId) => [a, b].sort().join(':') as PairKey;
// 요청서: 세력이 국장에게 보내는 청(aid)과 독촉(dun). 국장은 숫자(줄 값)로 답한다
export interface Ask { id: number; day: number; due: number; from: FacId; kind: 'aid' | 'dun'; want: number; chips: string[]; got?: number }
// 늦게 도착하는 결과: 앙금 · 마지못한 서명의 이행 · 편들기
export interface Later { day: number; kind: 'grudge' | 'pact' | 'side'; who: FacId; vs?: FacId; chips: string[] }
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
  loops: Record<LoopId, number>;  // 고리가 켜진 날
  litHist: LoopId[][];            // 날마다 켜진 고리 (개발용 확인 화면이 그림 위에 불을 켠다)
  clashes: number; meets: number; asks: number; answered: number; sides: number; relMin: number;
  relHist: number[];              // 날마다 두 길드 사이
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
  rel: Record<PairKey, number>;   // 세력 사이
  owe: Record<FacId, number>;     // 신세: 세력이 국장에게 진 것(+) · 국장이 진 것(−)
  fowe: Record<FacId, Partial<Record<FacId, number>>>; // 세력끼리의 빚: fowe[빚진 쪽][빌려준 쪽]
  pact: { from: number; until: number; k: number } | null; // 두 길드의 협정
  meetAt: number;                 // 마지막 회의 날
  asks: Ask[]; later: Later[]; askN: number;
  lit: LoopId[];                  // 오늘 켜진 고리 (국장의 손은 그날 아침, 엔진은 그날 안에 켠다)
  notices: Notice[];              // 길드 전체에 내건 공고문
  letters: Letter[];              // 길드 하나에 보낸 요청서 (답을 기다림 · 서명됨)
  docN: number;                   // 서류 번호
  rank: number; clerks: number; pts: number; // 집무실: 닿은 입지 단계 · 서기 · 서기를 들일 수 있는 몫
  order: Order;                   // 중앙 행정원의 요구서
  pnl: number[][];                // 미궁마다 날마다 조 하나의 하루 손익 어림(G, 보조금 빼고). 첫 칸은 영주청에서 넘겨받은 기록
}
export interface Order { dg: number; min: number; need: number; got: number; pat: number; done: '' | 'ok' | 'fail' }
// 길드 하나에 보낸 요청서: 이틀 뒤 서명할 마음 + 조항의 꼬리표 무게로 답한다. 서명하면 그 길드에만 조항이 걸린다
export interface Letter { id: number; day: number; to: GuildId; dg: number; days: number; cl: Clauses; at: number; until?: number }
// 국장이 쓰는 서류 중 길드 전체에 내건 공고문(clauses.ts의 조항 조합). 미궁 하나에 기한까지 걸린다
export interface Notice { id: number; day: number; to: 'all'; dg: number; until: number; cl: Clauses; dep: number }
export type Opts = { noCheck?: boolean; noFear?: boolean };

const DUNGEONS: Omit<Dungeon, 'teams' | 'fear' | 'floods' | 'dead' | 'sub' | 'dangerAt'>[] = [
  // 폐광은 막 넘쳤다. 왕국군이 주둔해 위험 수위 언저리에 붙들고 있고, 물러나면 다시 오른다
  { id: 'pit', name: '폐광', lord: '로이드 백작령', dist: 1, rise: 1.25, yld: 6, cap: 12, level: 75 },
  { id: 'wood', name: '검은숲 미궁', lord: '하벨 자작령', dist: 2, rise: 1.0, yld: 9, cap: 10, level: 45 },
  { id: 'sunk', name: '수몰 갱도', lord: '로이드 백작령', dist: 2, rise: 1.5, yld: 12, cap: 10, level: 55 },
];

export function newWorld(seed: number, o: Opts = {}): World {
  setSeed(seed);
  // 첫 미궁(폐광)은 판마다 같다. 나머지는 성질이 판마다 조금 다르다
  const dungeons = DUNGEONS.map((d, i) => ({
    ...d,
    rise: i ? +(d.rise * (0.85 + rnd() * 0.3)).toFixed(2) : d.rise,
    yld: i ? Math.round(d.yld * (0.8 + rnd() * 0.4)) : d.yld,
    teams: { big: i ? 4 : 0, small: i ? 2 : 0 }, fear: i ? 0 : B.ORDER.fear, floods: 0, dead: 0, sub: 0, dangerAt: null,
  }));
  const guild = (id: GuildId, name: string, size: number, fav: number): Guild =>
    ({ id, name, size, money: 0, infl: 0, fav: fav + Math.round((rnd() - 0.5) * 12), check: 0, peak: size });
  const W: World = {
    day: 0, budget: 3000, standing: 20, prio: 50, lordShare: 10,
    dungeons,
    guilds: { big: guild('big', '붉은 깃발단', 12, 50), small: guild('small', '중소 길드 연합', 6, 55) },
    lord: { name: '영주들', money: 0, infl: 0, fav: 45 + Math.round((rnd() - 0.5) * 12) },
    seen: dungeons.map(d => [d.level]), hist: dungeons.map(d => [d.level]),
    reports: [
      { day: 0, from: '왕도일보', title: '폐광 아래 미궁 범람, 로이드 백작령 마을 잠겨', chips: ['범람 직후'] },
      { day: 0, from: '왕국군', title: '폐광 1차 진압, 주둔 중', chips: ['수위를 붙들고 있음', '길드에 넘기면 물러남'] },
      { day: 0, from: '중앙 행정원', title: '요구서: 폐광을 왕국군에게서 넘겨받을 것', chips: [`하루 ${B.ORDER.min}조 이상 ${B.ORDER.need}일 이어서`, `예산 ${B.ORDER.pay}G · 입지 +${B.ORDER.stand}`] },
    ],
    stats: { floods: 0, dead: 0, spent: 0, toFlood: [], pinned: {}, loops: { R1: 0, B1: 0, R3: 0, B3: 0, R4: 0, B4: 0, R5: 0, B5: 0 }, bigSize: [], clashes: 0, meets: 0, asks: 0, answered: 0, sides: 0, relMin: 0, relHist: [], litHist: [] },
    rel: { 'big:small': -10 + Math.round((rnd() - 0.5) * 10), 'big:lord': 10, 'lord:small': 0 },
    owe: { big: 0, small: 0, lord: 0 }, fowe: { big: {}, small: {}, lord: {} },
    pact: null, meetAt: -99, asks: [], later: [], askN: 0, lit: [], notices: [], letters: [], docN: 0, rank: 1, clerks: 1, pts: 0,
    order: { dg: B.ORDER.dg, min: B.ORDER.min, need: B.ORDER.need, got: 0, pat: B.ORDER.pat, done: '' },
    pnl: [],
    ...o,
  };
  W.pnl = W.dungeons.map(d => [pnlOf(W, d)]);
  return W;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
// 고리가 오늘 켜졌다: 날마다 한 번만 센다
const lit = (W: World, id: LoopId) => { if (!W.lit.includes(id)) W.lit.push(id); };
const fav = (o: { fav: number }, v: number) => { o.fav = clamp(o.fav + v, 0, 100); };
export const facOf = (W: World, f: FacId) => f === 'lord' ? W.lord : W.guilds[f];
export const nameOf = (W: World, f: FacId) => facOf(W, f).name;
export const relOf = (W: World, a: FacId, b: FacId) => W.rel[pairOf(a, b)];
const relAdd = (W: World, a: FacId, b: FacId, v: number) => { const k = pairOf(a, b); W.rel[k] = clamp(W.rel[k] + v, -100, 100); };
// 협정이 지금 줄이는 다툼의 몫
export const pactK = (W: World) => W.pact && W.day >= W.pact.from && W.day < W.pact.until ? W.pact.k : 0;
export const teamsIn = (d: Dungeon) => d.teams.big + d.teams.small;
// 국장이 아는 수위: 거리만큼 늦은 보고
export const seenLevel = (W: World, i: number) => W.seen[i].at(-1)!;

// 조 하나가 하루에 내리는 수위: 몬스터가 많으면 한 조가 더 잡는다
export const clearOf = (level: number) => B.CLEAR * (0.5 + level / 100);
export const richOf = (level: number) => Math.min(1, level / B.RICH);
const inflOf = (x: number) => 100 * Math.max(0, x) / (Math.max(0, x) + B.INFL_HALF);
// 조 하나가 이 미궁에 들어가 하루 버는 값의 어림: 벌이 + 보조금 − 위험 − 꺼림
// 그 미궁에 걸린 공고문의 조항 값 (없으면 undefined). 길드 g를 주면 그 길드에 닿은 공고문만
export const clauseOn = (W: World, d: Dungeon, id: ClauseId, g?: GuildId) =>
  W.notices.find(n => W.dungeons[n.dg] === d && (!g || W.day >= n.day + B.HQ_DIST[g]))?.cl[id];
// 화면에 보이는 그 미궁의 보조금: 봇이 바로 정한 값 + 공고문
export const subAt = (W: World, i: number) => W.dungeons[i].sub + (clauseOn(W, W.dungeons[i], 'sub') ?? 0);
// 공고문의 믿음: 내건 기한이 길수록 길드가 믿고 온다 (길드마다 읽는 법이 다르다)
export const trustOf = (g: GuildId, days: number) => { const t = B.TRUST[g]; return Math.max(t.lo, Math.min(t.hi, t.base + days * t.per)); };
const noticeTrust = (W: World, i: number, g: GuildId) => {
  const n = W.notices.find(x => x.dg === i && W.day >= x.day + B.HQ_DIST[g]);
  return n ? trustOf(g, n.until - n.day) : 1;
};
// 공고문을 걸 때 떼어 둘 공탁
export const depOf = (cl: Clauses, days: number) => Math.round((cl.sub ?? 0) * days * B.ESCROW_T + (cl.comfort ?? 0) * B.ESCROW_C);
export const escrowOf = (W: World) => W.notices.reduce((a, n) => a + n.dep, 0);
// 공고가 내려가면 남은 공탁이 예산으로 돌아온다
const refund = (W: World, n: Notice) => { W.budget += n.dep; n.dep = 0; };
// 서명된 요청서의 조항 값: 길드 g가 미궁 i에서
const signed = (W: World) => W.letters.filter(l => l.until != null);
const letterOn = (W: World, g: GuildId, i: number, id: ClauseId) => signed(W).find(l => l.to === g && l.dg === i)?.cl[id];
// 출입 기록: 공고문이나 서명된 요청서 어느 쪽이든 걸려 있으면 그 미궁의 보고가 그날 온다
const recAt = (W: World, i: number) => (['big', 'small'] as GuildId[]).some(g => clauseOn(W, W.dungeons[i], 'rec', g) != null) || signed(W).some(l => l.dg === i && l.cl.rec != null);
// 길드 g가 미궁 i에서 받는 조항 값: 그 길드에 닿은 공고문 + 서명한 요청서
const guildCl = (W: World, g: GuildId, i: number, id: ClauseId) => (clauseOn(W, W.dungeons[i], id, g) ?? 0) + (letterOn(W, g, i, id) ?? 0);
const guildRec = (W: World, g: GuildId, i: number) => clauseOn(W, W.dungeons[i], 'rec', g) != null || letterOn(W, g, i, 'rec') != null;
// 서류가 그 길드에만 더하는 끌림
// 공고문 보조금은 믿음만큼만 끈다
const letterLure = (W: World, g: GuildId, i: number) =>
  ((clauseOn(W, W.dungeons[i], 'sub', g) ?? 0) * noticeTrust(W, i, g) + (letterOn(W, g, i, 'sub') ?? 0)) / B.SUB_LURE - (guildRec(W, g, i) ? B.REC_LURE : 0);
export const levelOf = (standing: number) => B.STAND_LV.filter(t => standing >= t).length;
export const docsOut = (W: World) => W.notices.length + W.letters.length;

// 조 하나가 이 미궁에서 하루 남기는 값의 어림(G): 끌림에서 보조금을 뺀 몫. 국장이 보조금을 가늠하는 자료다
export const pnlOf = (W: World, d: Dungeon) => Math.round((lure(W, d) - d.sub / B.SUB_LURE) * B.SUB_LURE);
// 최근 n일 평균 (기록이 모자라면 있는 만큼)
export const pnlAvg = (W: World, i: number, n: number) => { const a = W.pnl[i].slice(-n); return a.reduce((x, y) => x + y, 0) / a.length; };
export function lure(W: World, d: Dungeon) {
  return d.yld * B.PRICE / 10 * richOf(d.level) * (1 - d.level / 160) + d.sub / B.SUB_LURE - Math.max(0, d.level - 65) / 8 - (W.noFear ? 0 : d.fear / 10);
}

// 길드가 영향력으로 더 가져가는 몫(R3)과, 다른 길드가 눈에 띄어 결집한 몫(B3). 우선권 조항은 큰 길드(big) 쪽으로 기운다
export const otherOf = (g: GuildId): GuildId => g === 'big' ? 'small' : 'big';
export function weightOf(W: World, g: GuildId) {
  const G = W.guilds, tilt = (W.prio - 50) / 100 * (g === 'big' ? 1 : -1);
  // 사이가 나쁠수록 상대를 견제하는 결집이 세다
  const rally = W.noCheck ? 0 : G[otherOf(g)].check * B.CHECK_RALLY * (1 + Math.max(0, -relOf(W, 'big', 'small')) / 100);
  return Math.max(0.3, 1 + tilt + G[g].infl * B.R3 + rally);
}

export function step(W: World) {
  const S = W.stats, G = W.guilds;
  W.day++;
  // 기한이 다한 공고는 내린다: 그 미궁의 보조금이 멎는다
  for (const n of W.notices) if (W.day >= n.until) {
    W.reports.push({ day: W.day, from: '관리국', title: `공고 기한 끝: ${W.dungeons[n.dg].name}`, chips: [...clauseLine(n.cl).map(c => `${c} 멎음`), ...(n.dep > 0 ? [`공탁 ${Math.round(n.dep)}G 돌아옴`] : [])] });
    refund(W, n);
  }
  W.notices = W.notices.filter(n => W.day < n.until);
  lettersDay(W);
  const r1Before = W.dungeons.map(d => teamsIn(d));
  // 조가 어디로 가나: 미궁마다 바라는 조 수, 길드 크기만큼만
  // 요청서가 없으면 두 길드가 같은 끌림을 본다
  const base = W.dungeons.map(d => lure(W, d));
  W.dungeons.forEach((d, i) => W.pnl[i].push(pnlOf(W, d)));
  const wantOf = (g: GuildId) => W.dungeons.map((d, i) => clamp((base[i] + letterLure(W, g, i)) * B.WANT_K, 0, d.cap * 1.6));
  const want = { big: wantOf('big'), small: wantOf('small') };
  const sum = { big: want.big.reduce((a, b) => a + b, 0), small: want.small.reduce((a, b) => a + b, 0) };
  let fees = 0, subs = 0, clashes = 0, escrowPaid = 0;
  const relBefore = relOf(W, 'big', 'small');
  const haul: Record<GuildId, number> = { big: 0, small: 0 };
  W.dungeons.forEach((d, i) => {
    for (const g of ['big', 'small'] as GuildId[]) {
      const tgt = sum[g] > 0 ? G[g].size * Math.min(1, sum[g] / (G.big.size + G.small.size)) * want[g][i] / sum[g] : 0;
      d.teams[g] += (tgt - d.teams[g]) * B.MOVE;
    }
    const n = teamsIn(d);
    const army = armyIn(W, i) ? B.ORDER.clear : 0;
    d.level = Math.max(0, d.level + d.rise * (0.85 + rnd() * 0.3) - clearOf(d.level) * n - army);
    // 캐는 양은 붐비면 덜 는다. 나누는 몫은 길드의 무게대로
    // R4: 두 길드가 겹친 만큼 부딪친다. 사이가 나쁠수록 잦고, 협정이 있으면 드물다. 다툼은 사람을 잃고 덜 캐게 한다
    const hostile = clamp(0.3 - relOf(W, 'big', 'small') / 100, 0, 1.3);
    const clash = Math.min(d.teams.big, d.teams.small) * hostile * B.CLASH_K * (1 - pactK(W)) * (0.5 + rnd());
    clashes += clash;
    const out = d.cap * (1 - Math.exp(-n / d.cap)) * d.yld * richOf(d.level) * (1 - d.level / 250) * (1 - Math.min(0.5, clash * B.CLASH_OUT));
    const wb = d.teams.big * weightOf(W, 'big'), ws = d.teams.small * weightOf(W, 'small');
    if (wb + ws > 0) { haul.big += out * wb / (wb + ws); haul.small += out * ws / (wb + ws); }
    // 사고: 위험 수위 언저리부터 죽는다. 죽음은 꺼림으로 남아 조를 밀어낸다(R1)
    const dead = n * Math.max(0, d.level - B.RISK_AT) * B.RISK_K * (0.5 + rnd()) + clash * B.CLASH_DEAD;
    d.dead += dead; S.dead += dead;
    // 위로금: 공고문은 모두에게, 요청서는 그 길드가 잃은 몫만큼
    const share = (g: GuildId) => n > 0 ? d.teams[g] / n : 0;
    const comfort = (['big', 'small'] as GuildId[]).reduce((a, g) => a + guildCl(W, g, i, 'comfort') * share(g), 0);
    d.fear = d.fear * B.FEAR_FADE + dead * B.FEAR / (1 + comfort / B.COMFORT_HALF);
    subs += dead * comfort;
    for (const g of ['big', 'small'] as GuildId[]) subs += d.teams[g] * guildCl(W, g, i, 'sub');
    // 공고문 몫은 공탁에서 먼저 나간다 (예산에서는 이미 떼어 두었다)
    const nt = W.notices.find(x => x.dg === i);
    if (nt && nt.dep > 0) {
      const due = (['big', 'small'] as GuildId[]).reduce((a, g) => a + d.teams[g] * (clauseOn(W, d, 'sub', g) ?? 0) + dead * share(g) * (clauseOn(W, d, 'comfort', g) ?? 0), 0);
      const draw = Math.min(nt.dep, due);
      nt.dep -= draw; escrowPaid += draw;
    }
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
    W.seen[i].push(W.hist[i].at(recAt(W, i) ? -1 : -1 - d.dist) ?? W.hist[i][0]);
    const sn = W.seen[i];
    if (sn.at(-1)! >= B.DANGER && sn.at(-2)! < B.DANGER) W.reports.push({ day: W.day, from: '관리국 조사관', title: `${d.name} 위험 수위`, chips: [`${d.name} 수위`, `${d.dist}일 전 보고`] });
    // R1: 위험 수위 위에서 조가 빠지고 있다 / B1: 보조금이 조를 들이고 있다
    if (d.level >= B.DANGER && n < r1Before[i] - 0.01) lit(W, 'R1');
    if (subAt(W, i) > 0 && n > r1Before[i] + 0.01) lit(W, 'B1');
  });
  // 세력의 돈: 판매 − 급여·보급 − 세금(견제). 넉넉하면 조를 늘리고 모자라면 줄인다
  const top = G.big.size >= G.small.size ? G.big : G.small, topBefore = top.size;
  for (const g of ['big', 'small'] as GuildId[]) {
    // 영주는 사이가 나쁜 길드에서 더 떼어 가고, 떼인 길드는 영주와 사이가 벌어진다
    const f = G[g], sale = haul[g] * B.PRICE * 0.06;
    const tax = W.noCheck ? 0 : clamp(f.check * B.CHECK_TAX * (1 + Math.max(0, -relOf(W, g, 'lord')) / 100), 0, 0.4);
    f.money += sale * (1 - tax) - f.size * B.UPKEEP;
    W.lord.money += sale * tax;
    relAdd(W, g, 'lord', -tax * 0.5);
    // 돈이 바닥난 길드에 사이가 괜찮은 영주가 빌려준다: 세력끼리의 빚. 사이가 나쁘면 국장에게 청이 온다
    if (f.money < 0 && relOf(W, g, 'lord') > -20 && W.lord.money > B.LEND * 2 && (W.fowe[g].lord ?? 0) < B.LEND_OWE * 2) {
      f.money += B.LEND; W.lord.money -= B.LEND;
      W.fowe[g].lord = (W.fowe[g].lord ?? 0) + B.LEND_OWE;
    }
    if (f.money > B.GROW) { f.size++; f.money -= B.GROW_COST; }
    if (f.money < B.SHRINK && f.size > B.SIZE_MIN) { f.size--; f.money += 60; }
    f.infl = inflOf(f.size * B.INFL_SIZE + f.money * B.INFL_MONEY);
    f.peak = Math.max(f.peak, f.size);
  }
  if (top.size > topBefore) lit(W, 'R3');
  // B3 견제: 눈에 띈 길드에 쌓이고(영주의 세금 · 다른 쪽의 결집), 시간이 지나면 빠진다
  if (!W.noCheck) {
    for (const f of [G.big, G.small]) f.check = f.check * B.CHECK_FADE + Math.max(0, f.infl - B.NOTICE) * B.CHECK_K;
    if (G.big.check > B.CHECK_ON || G.small.check > B.CHECK_ON) lit(W, 'B3');
  }
  // 세력 사이: 다툼만큼 벌어지고(R4), 아주 천천히 0쪽으로
  S.clashes += clashes;
  relAdd(W, 'big', 'small', -clashes * B.CLASH_REL);
  for (const k of Object.keys(W.rel) as PairKey[]) W.rel[k] -= W.rel[k] * B.REL_FADE;
  if (clashes > 0.02 && relOf(W, 'big', 'small') < relBefore) lit(W, 'R4');
  if (pactK(W) > 0) lit(W, 'B4');
  S.relMin = Math.min(S.relMin, ...Object.values(W.rel));
  S.relHist.push(relOf(W, 'big', 'small'));
  dueLater(W);
  sideWith(W);
  makeAsks(W);
  for (const f of FACS) W.owe[f] *= B.OWE_FADE;
  // 예산: 입장료(영주 몫을 뺀 나머지) − 보조금, 달마다 중앙의 배정
  W.lord.money += fees * W.lordShare / 100;
  W.budget += fees * (1 - W.lordShare / 100) - subs + escrowPaid;
  S.spent += subs;
  if (W.day % B.MONTH === 0) W.budget += B.GRANT + W.standing * B.GRANT_K;
  W.lord.money *= 1 - B.LORD_SPEND;
  W.lord.infl = inflOf(60 + W.lord.money / 20);
  // 호감: 평소로 천천히, 조항이 끌어당긴다
  for (const o of [G.big, G.small, W.lord]) o.fav += (50 - o.fav) * B.FAV_BACK;
  fav(G.big, (W.prio - 50) / 500); fav(G.small, -(W.prio - 50) / 400);
  fav(W.lord, (W.lordShare - 15) / 300);
  for (const d of W.dungeons) if (d.sub > 0) fav(G.small, d.sub / 4000);
  for (const n of W.notices) {
    const at = (g: GuildId) => W.day >= n.day + B.HQ_DIST[g];
    if (n.cl.sub && at('small')) fav(G.small, n.cl.sub / 4000);
    if (n.cl.rec != null && at('big')) fav(G.big, -B.REC_FAV);
    if (n.cl.comfort && at('small')) fav(G.small, n.cl.comfort * B.COMFORT_FAV);
  }
  for (const l of signed(W)) {
    if (l.cl.rec != null) fav(G[l.to], -B.REC_FAV * B.LETTER_W[l.to].info / B.LETTER_W.big.info);
    if (l.cl.comfort) fav(G[l.to], l.cl.comfort * B.COMFORT_FAV);
  }
  orderDay(W);
  officeDay(W);
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
  pin('세력 사이', Object.values(W.rel).some(v => v <= -100 || v >= 100));
  S.bigSize.push(Math.max(G.big.size, G.small.size));
  for (const id of W.lit) S.loops[id]++;
  S.litHist.push(W.lit);
  W.lit = [];
}

// 늦게 도착하는 결과를 그날 적용한다
function dueLater(W: World) {
  const now = W.later.filter(l => l.day <= W.day);
  W.later = W.later.filter(l => l.day > W.day);
  for (const l of now) {
    if (l.kind === 'grudge') fav(facOf(W, l.who), -B.GRUDGE);
    if (l.kind === 'pact' && W.pact) W.pact.from = W.day;
    if (l.kind === 'side' && l.vs) { relAdd(W, l.who, l.vs, -B.SIDE_REL); W.stats.sides++; }
    W.reports.push({ day: W.day, from: nameOf(W, l.who), title: l.kind === 'grudge' ? '회의 결과에 서운함' : l.kind === 'pact' ? '협정 이행 시작' : `${nameOf(W, l.vs!)}와 등을 짐`, chips: l.chips });
  }
}

// 세력끼리의 빚 → 편들기: 빌려준 쪽이 누군가와 사이가 나쁘면 빚진 쪽이 엿새쯤 뒤 그 편을 든다
function sideWith(W: World) {
  for (const a of FACS) for (const c of FACS) {
    const debt = W.fowe[a][c] ?? 0;
    if (a === c || debt < B.LEND_OWE) continue;
    const foe = FACS.find(x => x !== a && x !== c && relOf(W, c, x) < -20);
    if (!foe || W.later.some(l => l.kind === 'side' && l.who === a)) continue;
    W.fowe[a][c] = debt - B.LEND_OWE;
    W.later.push({ day: W.day + B.SIDE_DAYS, kind: 'side', who: a, vs: foe, chips: [`${nameOf(W, c)}에 진 빚을 갚느라`] });
  }
}

// 요청서: 길드는 돈이 바닥나면 청(aid)을, 국장이 진 빚이 크면 보름마다 독촉(dun)을 보낸다. 세력마다 한 장씩만 열려 있다
function makeAsks(W: World) {
  for (const f of FACS) {
    if (W.asks.some(a => a.from === f && a.got == null)) continue;
    const o = facOf(W, f);
    let ask: Omit<Ask, 'id' | 'day' | 'due' | 'from'> | null = null;
    if (W.owe[f] <= B.DUN_AT && W.day % B.DUN_EVERY === 0) ask = { kind: 'dun', want: Math.round(-W.owe[f] * B.DUN_G), chips: ['회의에 서명해 준 일'] };
    else if (f !== 'lord' && (o as Guild).money < 0 && W.day % 5 === 0) ask = { kind: 'aid', want: 200, chips: [`${o.name} 금고 바닥`] };
    else if (f === 'lord' && o.fav < 45 && W.day % 10 === 0) ask = { kind: 'aid', want: 150, chips: ['영주 몫이 적어서'] };
    if (!ask) continue;
    W.asks.push({ id: ++W.askN, day: W.day, due: W.day + B.ASK_DUE, from: f, ...ask });
    W.stats.asks++;
  }
  // 답하지 않고 기한이 지난 요청서는 0으로 답한 것
  for (const a of W.asks) if (a.got == null && W.day >= a.due) answer(W, a.id, 0);
}

// 요청서에 숫자로 답한다: 줄 값(G). 청을 들어주면 호감과 신세를 받고(R5) 다른 쪽은 편애로 본다.
// 독촉에 갚으면 빚이 준다. 덜 주면 그만큼 호감을 잃고, 독촉을 모른 척하면 입지도 깎인다(B5)
export function answer(W: World, id: number, v: number) {
  const a = W.asks.find(x => x.id === id);
  if (!a || a.got != null) return;
  v = clamp(Math.round(v), 0, Math.max(0, Math.min(a.want, W.budget)));
  a.got = v;
  W.stats.answered += v > 0 ? 1 : 0;
  const r = a.want > 0 ? v / a.want : 0, o = facOf(W, a.from);
  W.budget -= v;
  if (a.kind === 'aid') {
    if (a.from === 'lord') W.lord.money += v; else W.guilds[a.from].money += v;
    fav(o, 10 * r - 4);
    W.owe[a.from] += 6 * r;
    for (const f of FACS) if (f !== a.from) fav(facOf(W, f), -2 * r);
    if (r > 0) lit(W, 'R5');
  } else {
    W.owe[a.from] += v / B.DUN_G;
    fav(o, 6 * r - 6);
    for (const f of FACS) if (f !== a.from) fav(facOf(W, f), -1.5 * r);
    if (r < 0.5) W.standing = clamp(W.standing - 2, 0, 100);
    lit(W, 'B5');
  }
  W.asks = W.asks.filter(x => x.got == null || x.day > W.day - 30);
}

// 서명할 마음: 호감과 받은 신세
export const willOf = (W: World, f: FacId) => facOf(W, f).fav + W.owe[f] * B.SIGN_OWE;

// 회의: 부른 세력끼리 협정을 맺게 한다. 두 길드를 다 불러야 협정이 선다.
// 부르는 것은 부탁이라 부른 세력마다 신세를 쓴다(모자라면 빚이 된다, B5). 빠진 세력은 이틀 뒤 앙금을 남긴다.
// 마음이 모자란 길드는 마지못해 서명해 나흘 뒤에야 이행하고, 많이 모자라면 거절한다
export function meet(W: World, who: FacId[]) {
  if (W.day - W.meetAt < B.MEET_COOL || !who.includes('big') || !who.includes('small')) return false;
  W.meetAt = W.day;
  W.stats.meets++;
  const will = (['big', 'small'] as GuildId[]).map(g => willOf(W, g) + (who.includes('lord') ? 5 : 0));
  for (const f of who) W.owe[f] -= B.MEET_OWE;
  for (const f of FACS) if (!who.includes(f)) W.later.push({ day: W.day + B.GRUDGE_DAYS, kind: 'grudge', who: f, chips: ['자기를 빼고 정해서'] });
  if (Math.min(...will) < B.SIGN_AT - 20) {
    W.reports.push({ day: W.day, from: '관리국', title: '회의 결렬', chips: ['서명 거절'] });
    return false;
  }
  const slow = Math.min(...will) < B.SIGN_AT;
  W.pact = { from: slow ? W.day + 999 : W.day, until: W.day + B.PACT_DAYS, k: B.PACT + (who.includes('lord') ? 0.1 : 0) };
  if (slow) W.later.push({ day: W.day + B.SLOW_DAYS, kind: 'pact', who: will[0] < will[1] ? 'big' : 'small', chips: ['마지못해 서명해서'] });
  relAdd(W, 'big', 'small', B.MEET_REL);
  if (who.includes('lord')) { relAdd(W, 'big', 'lord', 3); relAdd(W, 'lord', 'small', 3); }
  W.reports.push({ day: W.day, from: '관리국', title: '미궁 출입 협정', chips: who.map(f => nameOf(W, f)) });
  return true;
}

// 공고문 게시: 길드 전체에 미궁 하나의 조항들을 days일 건다. 같은 미궁의 공고는 새것으로 바뀐다.
// 공고문에 넣을 수 없는 조항(잠김 · 양식이 다름 · 바탕이 없음)이 있거나 조항이 없으면 내걸지 않는다
export const clauseLine = (cl: Clauses) => (Object.keys(cl) as ClauseId[]).map(k => CLAUSE[k].name + (CLAUSE[k].field ? ` ${cl[k]}${CLAUSE[k].field!.unit}` : ''));
export function post(W: World, dg: number, days: number, cl: Clauses) {
  const d = W.dungeons[dg], ids = Object.keys(cl) as ClauseId[];
  if (!d || days <= 0 || !ids.length || ids.length > CLAUSE_MAX) return null;
  if (ids.some(k => !fits(W, 'notice', cl, k))) return null;
  // 같은 미궁의 공고문을 고쳐 내거는 것은 서기를 더 쓰지 않는다
  const old = W.notices.find(n => n.dg === dg);
  if (!old && docsOut(W) >= W.clerks) return null;
  // 공탁을 떼어 둘 예산이 있어야 한다 (고쳐 내걸면 옛 공탁을 돌려받고 새로 뗀다)
  const dep = depOf(cl, days);
  if (W.budget + (old?.dep ?? 0) < dep) return null;
  if (old) refund(W, old);
  const id = ++W.docN;
  W.notices = W.notices.filter(n => n.dg !== dg);
  const n: Notice = { id, day: W.day, to: 'all', dg, until: W.day + days, cl: { ...cl }, dep };
  W.budget -= dep;
  W.notices.push(n);
  W.reports.push({ day: W.day, from: '관리국', title: `공고문: ${d.name}`, chips: ['길드 전체', ...clauseLine(cl), `${days}일`, ...(dep ? [`공탁 ${dep}G`] : []), `신문으로 퍼짐 · 중소 연합 ${B.HQ_DIST.small}일 · 붉은 깃발단 ${B.HQ_DIST.big}일 뒤`] });
  return n;
}

// 공고를 기한 전에 내린다: 믿고 온 길드들이 서운해한다. 남은 기한이 길수록 더
export const withdrawFav = (W: World, n: Notice) => B.WITHDRAW_FAV * (1 + Math.max(0, n.until - W.day) / B.WITHDRAW_LEFT);
export function withdraw(W: World, id: number) {
  const n = W.notices.find(x => x.id === id);
  if (!n) return false;
  const d = W.dungeons[n.dg], v = withdrawFav(W, n);
  refund(W, n);
  W.notices = W.notices.filter(x => x !== n);
  for (const g of ['big', 'small'] as GuildId[]) fav(W.guilds[g], -v);
  W.reports.push({ day: W.day, from: '관리국', title: `공고 철회: ${d.name}`, chips: ['기한 전에 내림', '길드들 서운함'] });
  return true;
}

// 요청서: 길드 하나에 미궁 하나의 조항을 청한다. 입지 단계가 LETTER_LV에 닿아야 열리고, 서기 한 명을 쓴다
export function send(W: World, to: GuildId, dg: number, days: number, cl: Clauses) {
  const ids = Object.keys(cl) as ClauseId[];
  if (W.rank < B.LETTER_LV || !W.dungeons[dg] || days <= 0 || !ids.length || ids.length > CLAUSE_MAX || docsOut(W) >= W.clerks) return null;
  if (ids.some(k => !fits(W, 'letter', cl, k))) return null;
  const l: Letter = { id: ++W.docN, day: W.day, to, dg, days, cl: { ...cl }, at: W.day + B.LETTER_DAYS };
  W.letters.push(l);
  W.reports.push({ day: W.day, from: '관리국', title: `요청서: ${nameOf(W, to)} · ${W.dungeons[dg].name}`, chips: [...clauseLine(cl), `${days}일`, `${B.LETTER_DAYS}일 뒤 답`] });
  return l;
}

// 길드가 요청서를 어떻게 보나: 조항마다 꼬리표 무게(돈 · 정보 · 안전). 보내기 전에는 보이지 않고 답신에 ＋/－로 적혀 온다
export function letterScore(W: World, l: Pick<Letter, 'to' | 'cl'>) {
  const w = B.LETTER_W[l.to], why: string[] = [];
  let v = 0;
  if (l.cl.sub) { v += l.cl.sub * w.money; why.push('＋ 돈'); }
  if (l.cl.comfort) { v += l.cl.comfort / 20 * w.safe; why.push('＋ 안전'); }
  if (l.cl.rec != null) { v -= w.info; why.push('－ 정보 내주기'); }
  return { v: willOf(W, l.to) + v, why };
}

function lettersDay(W: World) {
  for (const l of W.letters) {
    if (l.until == null && W.day >= l.at) {
      const { v, why } = letterScore(W, l), g = nameOf(W, l.to), dn = W.dungeons[l.dg].name;
      if (v >= B.LETTER_AT) {
        l.until = W.day + l.days;
        fav(W.guilds[l.to], 2);
        W.reports.push({ day: W.day, from: g, title: `요청서 서명: ${dn}`, chips: [...why, `${l.days}일`] });
      } else {
        l.until = -1;
        W.reports.push({ day: W.day, from: g, title: `요청서: 돌아가서 검토하겠습니다`, chips: [dn, ...why] });
      }
    } else if (l.until != null && l.until >= 0 && W.day >= l.until) {
      W.reports.push({ day: W.day, from: '관리국', title: `요청서 기한 끝: ${nameOf(W, l.to)} · ${W.dungeons[l.dg].name}`, chips: clauseLine(l.cl).map(c => `${c} 멎음`) });
      l.until = -1;
    }
  }
  W.letters = W.letters.filter(l => l.until !== -1);
}

// 서명된 요청서를 기한 전에 거두면 그 길드가 크게 서운해한다. 답을 기다리는 것은 그냥 거둔다
export function recall(W: World, id: number) {
  const l = W.letters.find(x => x.id === id);
  if (!l) return false;
  if (l.until != null) fav(W.guilds[l.to], -2 * B.WITHDRAW_FAV);
  W.letters = W.letters.filter(x => x !== l);
  W.reports.push({ day: W.day, from: '관리국', title: `요청서 거둠: ${nameOf(W, l.to)} · ${W.dungeons[l.dg].name}`, chips: l.until != null ? ['서명 뒤 거둠', `${nameOf(W, l.to)} 서운함`] : ['답 전에 거둠'] });
  return true;
}

// 왕국군이 이 미궁에 주둔해 있나: 요구서가 끝나기 전까지
export const armyIn = (W: World, i: number) => !!W.order && !W.order.done && W.order.dg === i;
// 중앙 요구서: 하루 min조 이상 든 날이 이어지면 센다(검문소 수라 늦지 않는다). 모자란 날은 끊기고 중앙의 인내가 모자란 조만큼 준다.
// need일 이어지면 군이 물러나며 넘긴다(예산 · 입지). 인내가 바닥나면 넘기지 않고 물러난다(입지를 깎는다)
function orderDay(W: World) {
  const o = W.order;
  if (!o || o.done) return;
  const n = teamsIn(W.dungeons[o.dg]);
  if (n >= o.min) o.got++;
  else { o.got = 0; o.pat = Math.max(0, o.pat - (o.min - n) * B.ORDER.drain); }
  if (o.got >= o.need) {
    o.done = 'ok';
    W.budget += B.ORDER.pay;
    W.standing = clamp(W.standing + B.ORDER.stand, 0, 100);
    W.reports.push({ day: W.day, from: '중앙 행정원', title: '폐광 인계 · 요구서 달성', chips: ['왕국군 물러남', `예산 +${B.ORDER.pay}G`, `입지 +${B.ORDER.stand}`] });
  } else if (o.pat <= 0) {
    o.done = 'fail';
    W.standing = clamp(W.standing - B.ORDER.fail, 0, 100);
    W.reports.push({ day: W.day, from: '중앙 행정원', title: '인내가 다함 · 왕국군 철수', chips: ['인계 없이 물러남', '폐광 수위가 다시 오름', `입지 −${B.ORDER.fail}`] });
  }
}

// 집무실: 입지가 새 단계에 닿으면 서기를 들일 몫이 하나 생긴다. 단계는 내려가지 않는다
function officeDay(W: World) {
  const lv = levelOf(W.standing);
  if (lv <= W.rank) return;
  W.pts += lv - W.rank;
  W.rank = lv;
  W.reports.push({ day: W.day, from: '중앙 행정원', title: `입지 ${lv}단계`, chips: ['서기 한 명을 더 들일 수 있음', ...(lv === B.LETTER_LV ? ['길드 지정 서신(요청서) 열림'] : [])] });
}
export function hireClerk(W: World) {
  if (W.pts <= 0) return false;
  W.pts--; W.clerks++;
  return true;
}

export const over = (W: World) => W.day >= B.DAYS;

export function run(W: World, bot: (W: World) => void = () => {}) {
  while (!over(W)) { bot(W); step(W); }
  return W;
}
