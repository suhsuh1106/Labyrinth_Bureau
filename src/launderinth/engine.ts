// Launderinth(론더린스) 프로토타입 엔진. DOM을 쓰지 않는다. 하루가 한 턴(step), 한 달 L.MONTH일.
// 루프: 시설 카드 놓기 · 집객 → 표면 수익 → 장부 조작(신고율 · 유령 대원 · 장비 밀수) → 비자금 → 세탁 → 상납 → 승진.
// 영지는 지도가 아니라 판 위의 카드 칸이다: 자리(칸)는 계급이 오를수록 늘고, 시설 종류마다 상한이 있다.
// 사건은 날짜가 아니라 상태 조건으로 터진다(감사 · 유족 항의 · 발길 끊김 · 승진).
import { rnd, setSeed } from '../core/rng';

export const RANKS = ['남작', '자작', '백작', '후작', '공작'] as const;

// 숫자는 모두 여기
export const L = {
  MONTH: 30,
  START_CLEAN: 1500,
  FEE: 2,                    // 입장료(모험가 한 명)
  BASE_VISIT: 3,             // 아무것도 없을 때 하루 발길
  DEATH_BASE: 0.12,          // 미궁에서 돌아오지 못하는 몫
  DEATH_MIN: 0.03,
  GEAR: 40,                  // 죽은 모험가 장비 한 벌 값
  SUB: 5,                   // 등록 탐사대원 한 명당 제국 보조금(달)
  EXPECT: 9,                 // 제국이 대원 한 명에게서 기대하는 달 수익(대조 기준)
  TOWN_TAX: 0.02,            // 주민 한 명당 하루 마을세
  TAX: [0.7, 0.67, 0.64, 0.61, 0.58], // 계급별 신고 수익 세율
  PROMOTE: [4000, 11000, 22000, 38000], // 누적 상납: 자작 · 백작 · 후작 · 공작
  SLOTS: [8, 10, 12, 14, 16], // 계급별 영지 판의 칸 수(처음 넷은 여관 · 선술집 · 민가 둘)
  SLOT_MAX: 16,
  OPEN_DAY: 3,               // 미궁이 땅을 가르고 나오는 날(첫 사건: 판마다 같다)
  QUOTA0: 60,                // 미궁 이전 공납 할당(달)
  QUOTA1: 600,               // 중앙의 관심이 쏠린 뒤 할당(달)
  QUOTA_DELVE: 220, QUOTA_RANK: 350, // 개척 층 · 계급마다 늘어나는 할당
  LOOT_OFF: 0.4,             // 매입소가 없을 때 행상이 쳐 주는 전리품 몫
  BUY_DEF: 70,               // 매입가(시세의 %) 기본값
  LEVY_DEF: 10,              // 거래세(%) 기본값: 모험가가 전리품을 팔 때 떼는 몫
  FEE_MAX: 8,                // 입장료 상한
  SPOT: 0.8,                 // 뒷문 출하는 시세의 이 몫으로 팔린다
  TRADER_AT: 250,            // 모험가들이 들고 나온 전리품이 이만큼 쌓이면 상단이 온다
  MKT_MIN: 0.7, MKT_MAX: 1.35,
  RISK_DECAY: 0.08,          // 하루 저절로 식는 의심
  SMELL_AT: 800,             // 이만큼 넘는 비자금은 냄새가 난다
  SMELL: 1 / 25000,          // (비자금 − SMELL_AT) × SMELL 만큼 하루 의심
  AUDIT_AT: 45,              // 이 위로는 감사관이 올 수 있다
  AUDIT_LEAD: 5,             // 예고에서 도착까지 날
  ARREST: 100,
  TERM: 18,                  // 임기(달). 그때까지 공작이 못 되면 다음 사람에게 인장이 간다
  BANKRUPT: -400,
  UP_COST: 0.7,              // 업그레이드 값 = 건축비 × 이 값 × 지금 단계
  BUD_STEP: 100, BUD_MAX: 2000,
  BUD_PROMO: 600, BUD_PULL: 0.35,       // 홍보: 달 600이면 효과의 63%, 발길 최대 +35%
  BUD_SAFE: 500, BUD_DEATH: 0.04,       // 안전: 사망률 최대 −4%p
  BUD_CARE: 400, BUD_SAT: 10,           // 정비: 손님 만족 최대 +10
  DELVE_COST: [0, 800, 1800, 3200, 5000], // 미궁 개척 단계(2~5)로 올리는 값
  DELVE_MAX: 5,
  LOOT: 10, LOOT_STEP: 6,    // 생환자 한 명의 전리품 평균(1단계) · 단계마다 늘어나는 몫
  DEATH_STEP: 0.025,          // 단계마다 늘어나는 사망률
  DELVE_PULL: 0.9,            // 단계마다 늘어나는 발길(소문)
  RETURN: 0.3,               // 살아 돌아온 손님이 다음 날 다시 오는 몫
  NEW_MIN: 4, NEW_VAR: 18,    // 새로 온 손님의 지갑
  UP_MAX: 3,
  UP_CAP: 0.5, UP_PULL: 0.3, UP_UPKEEP: 0.5, // 단계마다 늘어나는 몫
  GOLD_MIN: 8, GOLD_VAR: 42, // 손님이 가져오는 돈
  SAT_BASE: 50, SAT_OK: 8, SAT_FULL: -12, SAT_NONE: -4, SAT_PRICEY: -10, SAT_UP: 3,
};

export type Kind = 'house' | 'checkpoint' | 'buyer' | 'inn' | 'tavern' | 'rental' | 'chapel' | 'lodge' | 'hospital' | 'casino' | 'cathedral' | 'guild' | 'theater' | 'auction';
export interface BDef {
  name: string; icon: string; cost: number; upkeep: number;
  cap: number;      // 하루에 받는 손님
  rev: number;      // 손님 한 명 매상
  pull: number;     // 발길을 끄는 힘
  safe: number;     // 사망률을 낮추는 몫
  calm: number;     // 하루 의심을 덜어 주는 몫(체면)
  wash: number;     // 달 세탁 한도
  cut: number;      // 세탁 수수료
  washRisk: number; // 세탁한 한 닢의 의심
  rank: number;     // 필요한 계급
  max: number;      // 한 영지에 놓을 수 있는 장 수
  tag: '영업' | '체면' | '세탁' | '주거' | '관문' | '매입';
  fx: string;       // 카드에 적힌 효과
  note: string;
}
const Z = { safe: 0, calm: 0, wash: 0, cut: 0, washRisk: 0 };
export const BDEF: Record<Kind, BDef> = {
  house:      { name: '민가',       icon: '🏠', cost: 120,  upkeep: 1,  cap: 0,  rev: 0, pull: 0.1, ...Z, rank: 0, max: 4, tag: '주거', fx: '주민 + · 마을세', note: '굴뚝 연기가 곧은 집들' },
  checkpoint: { name: '검문소',     icon: '🚧', cost: 200,  upkeep: 3,  cap: 0,  rev: 0, pull: 0,   ...Z, rank: 0, max: 1, tag: '관문', fx: '입장료 · 출입 명부', note: '명부에 없는 이름은 미궁에 없다' },
  buyer:      { name: '전리품 매입소', icon: '⚖️', cost: 450, upkeep: 5,  cap: 0,  rev: 0, pull: 0.5, ...Z, rank: 0, max: 1, tag: '매입', fx: '전리품 매입 · 상단 출하', note: '저울은 정직하고 장부는 그렇지 않다' },
  inn:       { name: '여관',       icon: '🏨', cost: 280,  upkeep: 3,  cap: 4,  rev: 5, pull: 1.0, ...Z, rank: 0, max: 2, tag: '영업', fx: '잠자리 · 발길 +', note: '젖은 이불, 비싼 숙박비' },
  tavern:    { name: '선술집',     icon: '🍺', cost: 180,  upkeep: 2,  cap: 6,  rev: 3, pull: 0.8, ...Z, rank: 0, max: 2, tag: '영업', fx: '먹고 마실 곳 · 소문 +', note: '묽은 맥주, 진한 소문' },
  rental:    { name: '무기 상점',   icon: '⚒️', cost: 240,  upkeep: 2,  cap: 4,  rev: 4, pull: 0.4, ...Z, safe: 0.015, rank: 0, max: 2, tag: '영업', fx: '장비 · 전리품 +15% · 사망 −', note: '반납되지 않는 검이 더 많다' },
  chapel:    { name: '작은 교회',   icon: '⛪', cost: 200,  upkeep: 2,  cap: 0,  rev: 0, pull: 0.2, ...Z, safe: 0.01, calm: 0.05, rank: 0, max: 1, tag: '체면', fx: '체면 · 사망 −', note: '종탑이 예배당보다 높다' },
  lodge:     { name: '숙소',       icon: '🛏', cost: 420,  upkeep: 4,  cap: 6,  rev: 4, pull: 0.7, ...Z, rank: 1, max: 2, tag: '영업', fx: '수용 · 만족 +', note: '벽이 얇아서 소문이 빠르다' },
  hospital:  { name: '자선 병원',   icon: '🏥', cost: 420,  upkeep: 8,  cap: 0,  rev: 0, pull: 0.3, ...Z, safe: 0.03, calm: 0.12, rank: 1, max: 1, tag: '체면', fx: '사망 − · 체면 +', note: '현판이 병상보다 크다' },
  casino:    { name: '카지노',     icon: '🎰', cost: 900,  upkeep: 10, cap: 6,  rev: 6, pull: 1.5, ...Z, wash: 1500, cut: 0.25, washRisk: 0.0022, rank: 1, max: 2, tag: '세탁', fx: '지출 크게 · 세탁', note: '잃은 돈은 기록에 남지 않는다' },
  cathedral: { name: '대성당',     icon: '⛪', cost: 1800, upkeep: 6,  cap: 0,  rev: 0, pull: 0.5, ...Z, calm: 0.2, wash: 3200, cut: 0.12, washRisk: 0.0009, rank: 2, max: 1, tag: '세탁', fx: '체면 크게 · 세탁', note: '헌금함에는 바닥이 없다' },
  guild:     { name: '상단 지부',   icon: '📦', cost: 1400, upkeep: 7,  cap: 6,  rev: 7, pull: 0.8, ...Z, rank: 2, max: 1, tag: '영업', fx: '큰손 손님 · 지출 +', note: '송장이 곧 소문이다' },
  theater:   { name: '극장',       icon: '🎭', cost: 2200, upkeep: 9,  cap: 8,  rev: 7, pull: 1.4, ...Z, rank: 3, max: 1, tag: '영업', fx: '발길 크게 · 지출 +', note: '미궁 영웅담이 한 번에 세 편' },
  auction:   { name: '경매장',     icon: '🔨', cost: 3000, upkeep: 12, cap: 5,  rev: 11, pull: 1.0, ...Z, rank: 3, max: 1, tag: '영업', fx: '전리품 매입 · 큰 지출', note: '망치 소리 한 번에 장부 한 줄' },
};
export const BUILD_ORDER: Kind[] = ['house', 'checkpoint', 'buyer', 'inn', 'tavern', 'rental', 'chapel', 'lodge', 'hospital', 'casino', 'cathedral', 'guild', 'theater', 'auction'];
export const BASIC: Kind[] = ['inn', 'tavern', 'rental'];

export interface Tile { b: Kind | null; born: number; lv: number } // 판 위의 한 칸

// 장부: 국장이 숫자로 정하는 것들. 달이 닫힐 때 그대로 제국에 올라간다
export interface Ledger {
  report: number;   // 신고율(%) 실제 수익 중 제국 장부에 적는 몫
  ghosts: number;   // 유령 탐사대원(명)
  smuggle: number;  // 사망자 장비 밀수 비율(%)
  bribe: number;    // 이번 달 상납(합법 자금)
  wash: { casino: number; cathedral: number }; // 이번 달 세탁 목표(비자금)
  backdoor: number; // 뒷문 출하(%) 매입소 재고 중 장부 없이 파는 몫
}

// 영지 현황: 입장객 · 건물별 매상 · 돌려보낸 손님. 읽어 보여 주는 용도이고 규칙에는 쓰지 않는다
export interface Day { v: number; r: number; d: number; s: number; l: number; b: number; n: Partial<Record<Kind, number>>; x: Partial<Record<Kind, number>> }
export interface Stat {
  hist: Day[];                                   // 최근 60일
  tile: Record<number, { rev: number; served: number }>;
  kind: Partial<Record<Kind, { rev: number; served: number; turned: number }>>;
  guests: number; sat: number; gold: number; loot: number;        // 손님 수 · 만족 합 · 가져온 돈 합
  fee: number; visits: number; deaths: number; spent: number; upkeep: number;
}
// 월 결산: 금고(합법 자금)가 한 달 동안 어디서 들어와 어디로 나갔나
export interface Flow {
  town: number; fee: number; sales: Partial<Record<Kind, number>>; subsidy: number; wash: number;       // 들어온 돈
  upkeep: number; budget: number; capex: number; tax: number; bribe: number; toBlack: number; buy: number; levy: number; trade: number; // 나간 돈 · 매입 / 들어온 돈 · 상단 출하
  visits: number; deaths: number; sat: number; guests: number;
}
export interface Book extends Flow { m: number; from: number; to: number; net: number; black: number }
export const emptyFlow = (): Flow => ({ town: 0, fee: 0, sales: {}, subsidy: 0, wash: 0, upkeep: 0, budget: 0, capex: 0, tax: 0, bribe: 0, toBlack: 0, buy: 0, levy: 0, trade: 0, visits: 0, deaths: 0, sat: 0, guests: 0 });
export interface Budget { promo: number; safety: number; upkeep: number }
export const BUDGET_KEYS = ['promo', 'safety', 'upkeep'] as const;
export const BUDGET_NAME = { promo: '홍보', safety: '안전', upkeep: '정비' } as const;
export const effOf = (spend: number, k: number) => 1 - Math.exp(-spend / k);
export interface Note { day: number; text: string; kind: 'news' | 'warn' | 'good' | 'bad' }
export interface Audit { due: number; }

export interface World {
  seed: number; day: number; rank: number;
  phase: number;             // 0 평범한 영지 · 1 미궁이 열림 · 2 중앙의 서한이 닿음
  qBase: number;             // 공납 할당의 바탕(달)
  cards: Kind[];             // 손패: 지금 내려놓을 수 있는 카드
  stock: number;             // 매입소 재고(시세 1.0 기준 값)
  mkt: number;               // 상단의 이번 달 시세 지수
  buyPct: number;            // 매입가(시세의 %)
  levy: number;              // 거래세(%) 팔 때 떼는 세금
  fee: number;               // 입장료(검문소)
  clean: number; black: number; risk: number; favor: number;
  rep: number;               // 모험가들 사이 평판(발길)
  tiles: Tile[];             // 영지 판의 칸(SLOT_MAX개, 열린 칸은 계급에 따라)
  led: Ledger;
  mo: { take: number; visits: number; deaths: number; gear: number; bought: number; bv: number; washed: { casino: number; cathedral: number } };
  last: null | MonthReport;
  audit: Audit | null;
  notes: Note[];
  over: null | 'arrest' | 'bankrupt' | 'duke' | 'term';
  delve: number; back: { n: number; gold: number }; // 미궁 개척 단계 · 어제 살아 돌아온 손님(수 · 가진 돈)
  budget: Budget; mb: Flow; books: Book[];
  price: Record<typeof PRICED[number], number>; // 요금(%)
  stat: Stat;
  today: { visits: number; deaths: number; rev: number; byTile: Record<number, number> };
  flags: Record<string, number>;
}

export interface MonthReport {
  real: number; reported: number; skim: number; tax: number;
  registered: number; subsidy: number; ghostCut: number;
  gearSold: number; bribe: number; washed: number; washCut: number;
  trade: number; leak: number; vol: number; expect: number; // 상단 출하액 · 뒷문으로 샌 돈 · 재고 · 명부가 말하는 물량
  look: number; // 대조 소견 0 깨끗 · 1 어색 · 2 수상 · 3 명백
  dRisk: number;
}

export const slotsOf = (w: World) => L.SLOTS[w.rank];

export const quotaOf = (w: World) => w.qBase >= L.QUOTA1 ? w.qBase + L.QUOTA_DELVE * (w.delve - 1) + L.QUOTA_RANK * w.rank : w.qBase;
// bare: 빈 판(시험 · 봇 비교용). 미궁이 이미 열려 있고 카드가 다 있으며 할당이 없다
export function newWorld(seed: number, bare = false): World {
  setSeed(seed);
  const w: World = {
    seed, day: 0, rank: 0, phase: bare ? 2 : 0, qBase: bare ? 0 : L.QUOTA0, stock: 0, mkt: 1, buyPct: L.BUY_DEF, levy: L.LEVY_DEF, fee: L.FEE,
    cards: bare ? [...BUILD_ORDER] : ['house', 'inn', 'tavern'], clean: L.START_CLEAN, black: 0, risk: 4, favor: 0, rep: 1,
    tiles: Array.from({ length: L.SLOT_MAX }, () => ({ b: null, born: -99, lv: 1 })),
    led: { report: 100, ghosts: 0, smuggle: 0, bribe: 0, backdoor: 0, wash: { casino: 0, cathedral: 0 } },
    mo: { take: 0, visits: 0, deaths: 0, gear: 0, bought: 0, bv: 0, washed: { casino: 0, cathedral: 0 } },
    last: null, audit: null, over: null,
    notes: [{ day: 0, kind: 'news', text: '변방 영지의 인장이 새 주인의 손에 들어왔다. 미궁 어귀로 이어진 길은 하나, 그마저 진흙이다. 판 위에는 여관 하나와 선술집 하나, 낡은 민가 몇 채가 전부다. 이 땅은 해마다 제국에 올리는 몇 푼의 공납으로 이름이 불렸다.' }],
    delve: 1, back: { n: 0, gold: 0 },
    budget: { promo: 0, safety: 0, upkeep: 0 }, mb: emptyFlow(), books: [],
    price: { inn: 100, tavern: 100, rental: 100, lodge: 100, casino: 100, guild: 100, theater: 100, auction: 100 },
    stat: { hist: [], tile: {}, kind: {}, guests: 0, sat: 0, gold: 0, loot: 0, fee: 0, visits: 0, deaths: 0, spent: 0, upkeep: 0 },
    today: { visits: 0, deaths: 0, rev: 0, byTile: {} },
    flags: {},
  };
  if (!bare) for (const [i, k] of (['inn', 'tavern', 'house', 'house'] as Kind[]).entries()) { w.tiles[i].b = k; w.tiles[i].born = -99; }
  return w;
}

// 영업 중인 칸(열린 칸 안에서 카드가 놓인 것)
export function live(w: World): number[] {
  const out: number[] = [];
  for (let i = 0; i < slotsOf(w); i++) if (w.tiles[i].b) out.push(i);
  return out;
}
export function count(w: World, k: Kind): number { return live(w).filter(i => w.tiles[i].b === k).length; }
export const firstFree = (w: World): number => { for (let i = 0; i < slotsOf(w); i++) if (!w.tiles[i].b) return i; return -1; };

export function canBuild(w: World, i: number, k: Kind): string | null {
  const d = BDEF[k];
  if (w.over) return '임기 끝';
  if (d.rank > w.rank) return `${RANKS[d.rank]} 이상`;
  if (!w.cards.includes(k)) return '카드 없음';
  if (i < 0 || i >= slotsOf(w)) return '닫힌 자리';
  if (w.tiles[i].b) return '이미 있음';
  if (count(w, k) >= d.max) return `${d.max}장까지`;
  if (w.clean < d.cost) return '자금 부족';
  return null;
}
// 마을: 처음엔 농사짓는 사람들, 미궁이 돈이 되면서 관광 도시가 된다. 읽어 보여 주는 값이고 난수는 쓰지 않는다
export const TOWN = ['농촌', '장터 마을', '관광 마을', '관광 도시'] as const;
export const TOWN_AT = [0, 6, 22, 60]; // 점수 문턱
export const builtCount = (w: World) => live(w).length;
export const townScore = (w: World) => w.stat.visits / 40 + builtCount(w) * 1.6 + (w.delve - 1) * 3;
export const townStage = (w: World) => { const sc = townScore(w); let n = 0; for (let k = 1; k < TOWN_AT.length; k++) if (sc >= TOWN_AT[k]) n = k; return n; };
export const popOf = (w: World) => Math.min(520, 40 + count(w, 'house') * 9 + Math.floor(w.stat.visits / 18) + builtCount(w) * 5 + (w.delve - 1) * 12);
// 주민의 직업: 농부는 줄고, 장사 · 숙박 · 안내가 는다
export function jobsOf(w: World) {
  const pop = popOf(w), st = townStage(w);
  const farm = Math.round(pop * [0.82, 0.55, 0.28, 0.12][st]), guide = Math.round(pop * [0, 0.03, 0.1, 0.18][st]);
  const inn = Math.round(pop * [0.04, 0.12, 0.22, 0.3][st]);
  return { farm, trade: Math.max(0, pop - farm - guide - inn), inn, guide, pop };
}
export const lvMul = (w: World, i: number, per: number) => 1 + per * (w.tiles[i].lv - 1);
export const capOf = (w: World, i: number) => Math.round(BDEF[w.tiles[i].b!].cap * lvMul(w, i, L.UP_CAP));
export function upCost(w: World, i: number): number { const t = w.tiles[i]; return t.b && t.lv < L.UP_MAX ? Math.round(BDEF[t.b].cost * L.UP_COST * t.lv / 10) * 10 : 0; }
export function upgrade(w: World, i: number): string | null {
  const t = w.tiles[i], c = upCost(w, i);
  if (w.over) return '임기 끝';
  if (!t.b) return '빈 자리';
  if (t.lv >= L.UP_MAX) return '최고 단계';
  if (w.clean < c) return '자금 부족';
  w.clean -= c; w.mb.capex += c; t.lv++; return null;
}
export function setBuy(w: World, pct: number) { w.buyPct = Math.max(40, Math.min(100, Math.round(pct / 10) * 10)); }
export function setLevy(w: World, pct: number) { w.levy = Math.max(0, Math.min(30, Math.round(pct / 5) * 5)); }
export function setFee(w: World, v: number) { w.fee = Math.max(0, Math.min(L.FEE_MAX, Math.round(v))); }
// 입장료가 오르면 길을 돌아가는 모험가가 는다(기본 요금에서 1.0)
export const feeWant = (fee: number) => Math.max(0.2, Math.min(1.3, 1.35 - 0.175 * fee));
export const gateOf = (w: World) => count(w, 'checkpoint') > 0;
export const buyerOf = (w: World) => count(w, 'buyer') > 0;
export function setBudget(w: World, k: keyof Budget, v: number) { w.budget[k] = Math.max(0, Math.min(L.BUD_MAX, Math.round(v / L.BUD_STEP) * L.BUD_STEP)); }
export const PRICED = ['inn', 'tavern', 'rental', 'lodge', 'casino', 'guild', 'theater', 'auction'] as const;
export function setPrice(w: World, k: typeof PRICED[number], pct: number) { w.price[k] = Math.max(50, Math.min(200, Math.round(pct / 10) * 10)); }
// 요금이 오르면 안 오는 손님이 는다
export const wantOf = (pct: number) => Math.max(0.1, Math.min(1.3, 1.6 - 0.6 * pct / 100));
export const delveCost = (w: World) => w.delve < L.DELVE_MAX ? L.DELVE_COST[w.delve] : 0;
export function delveUp(w: World): string | null {
  const c = delveCost(w);
  if (w.over) return '임기 끝';
  if (!c) return '최고 단계';
  if (w.clean < c) return '자금 부족';
  w.clean -= c; w.mb.capex += c; w.delve++; return null;
}
export const lootMean = (w: World) => L.LOOT + L.LOOT_STEP * (w.delve - 1);
export function build(w: World, i: number, k: Kind): boolean {
  if (canBuild(w, i, k)) return false;
  const t = w.tiles[i];
  w.clean -= BDEF[k].cost; w.mb.capex += BDEF[k].cost;
  t.b = k; t.born = w.day; t.lv = 1;
  return true;
}
export function demolish(w: World, i: number): boolean {
  const t = w.tiles[i];
  if (!t.b) return false;
  t.b = null; return true;
}

export function deathRate(w: World): number {
  let r = L.DEATH_BASE;
  for (const i of live(w)) r -= BDEF[w.tiles[i].b!].safe * lvMul(w, i, L.UP_CAP);
  r += L.DEATH_STEP * (w.delve - 1);
  r -= L.BUD_DEATH * effOf(w.budget.safety, L.BUD_SAFE);
  return Math.max(L.DEATH_MIN, r);
}
export function washCap(w: World, k: 'casino' | 'cathedral'): number { return Math.round(live(w).filter(i => w.tiles[i].b === k).reduce((a, i) => a + BDEF[k].wash * lvMul(w, i, L.UP_CAP), 0)); }

export const clampLed = (w: World) => {
  const l = w.led;
  l.report = Math.max(30, Math.min(100, Math.round(l.report / 5) * 5));
  l.ghosts = gateOf(w) ? Math.max(0, Math.min(400, Math.round(l.ghosts))) : 0;
  l.smuggle = gateOf(w) ? Math.max(0, Math.min(100, Math.round(l.smuggle / 10) * 10)) : 0;
  l.backdoor = buyerOf(w) ? Math.max(0, Math.min(60, Math.round(l.backdoor / 10) * 10)) : 0;
  l.bribe = Math.max(0, Math.round(l.bribe / 50) * 50);
  for (const k of ['casino', 'cathedral'] as const) l.wash[k] = Math.max(0, Math.min(washCap(w, k), Math.round(l.wash[k] / 50) * 50));
};

function note(w: World, kind: Note['kind'], text: string) { w.notes.unshift({ day: w.day, kind, text }); if (w.notes.length > 60) w.notes.length = 60; }

// 대조 소견: 제국 회계관이 신고 장부를 펼쳤을 때의 얼굴
// 제국이 대원 한 명에게 기대하는 달 수익: 입장료에, 영지에 서 있는 시설 종류만큼 얹는다
export function expectPer(w: World): number {
  const have = new Set(live(w).map(i => w.tiles[i].b!));
  let e = L.FEE; for (const k of PRICED) if (have.has(k)) e += BDEF[k].rev * 0.33;
  return e;
}
export function lookOf(w: World, reported: number, registered: number, gearSold: number, gap = 0): number {
  const expect = Math.max(1, registered * expectPer(w));
  const ratio = reported / expect;
  const ghostR = w.mo.visits > 0 ? w.led.ghosts / w.mo.visits : (w.led.ghosts > 0 ? 3 : 0);
  let s = 0;
  if (ratio < 0.85) s += (0.85 - ratio) * 4;
  s += ghostR * 1.2 + gearSold / 1500 + gap * 2.2;
  return s < 0.25 ? 0 : s < 0.8 ? 1 : s < 1.6 ? 2 : 3;
}
export const LOOK = ['깨끗', '어색', '수상', '명백'];

// 달이 닫힐 때 무엇이 될지(장부 조작소의 미리보기). 상태를 바꾸지 않는다
export function preview(w: World): MonthReport {
  const l = w.led;
  const real = w.mo.take;
  const reported = Math.round(real * l.report / 100);
  const skim = real - reported;
  const tax = Math.max(Math.round(reported * L.TAX[w.rank]), quotaOf(w)); // 할당에 모자라면 할당만큼 낸다
  const gate = gateOf(w);
  const registered = gate ? w.mo.visits + l.ghosts : 0;
  const subsidy = registered * L.SUB;
  const ghostCut = l.ghosts * L.SUB;
  const gearSold = Math.round(w.mo.gear * l.smuggle / 100);
  // 상단 출하: 재고는 달마다 시세로 실려 가고, 뒷문으로 뺀 몫은 장부 없이 비자금이 된다
  const vol = w.stock, bd = buyerOf(w) ? l.backdoor : 0;
  const leak = Math.round(vol * bd / 100 * w.mkt * L.SPOT), trade = Math.round(vol * (1 - bd / 100) * w.mkt);
  // 명부 ↔ 매입량 대조: 명부가 말하는 만큼의 전리품이 상단 장부에 실려 갔는가
  const bvShare = w.mo.visits ? w.mo.bv / w.mo.visits : 0;
  const expect = (w.mo.bv + l.ghosts * bvShare) * (1 - deathRate(w)) * lootMean(w);
  const gap = w.mo.bv > 0 && expect > 40 ? Math.max(0, Math.min(1, 1 - vol * (1 - bd / 100) / expect)) : 0;
  const bribe = Math.min(l.bribe, Math.max(0, w.clean - skim - tax + subsidy - ghostCut + trade));
  const look = lookOf(w, reported, registered, gearSold, gap);
  const expectR = Math.max(1, registered * expectPer(w));
  const ratio = reported / expectR;
  const ghostR = w.mo.visits > 0 ? l.ghosts / w.mo.visits : (l.ghosts > 0 ? 3 : 0);
  let dRisk = 0;
  if (ratio < 0.85) dRisk += (0.85 - ratio) * 45;
  dRisk += ghostR * 5 + gap * 10 + gearSold * 0.006 - bribe / 1000;
  const washed = w.mo.washed.casino + w.mo.washed.cathedral;
  return { real, reported, skim, tax, registered, subsidy, ghostCut, gearSold, bribe, washed, washCut: 0, trade, leak, vol, expect, look, dRisk };
}

function closeMonth(w: World) {
  const p = preview(w);
  // 매상은 날마다 금고(합법 자금)에 들어와 있다. 장부에서 지운 몫은 금고에서 빼내 비자금이 된다
  const from = w.flags.from ?? L.START_CLEAN;
  w.clean += -p.skim - p.tax + (p.subsidy - p.ghostCut) - p.bribe + p.trade;
  Object.assign(w.mb, { subsidy: p.subsidy - p.ghostCut, tax: p.tax, bribe: p.bribe, toBlack: p.skim, trade: p.trade });
  w.books.push({ ...w.mb, sales: { ...w.mb.sales }, m: Math.round(w.day / L.MONTH), from, to: w.clean, net: w.clean - from, black: w.black + p.skim + p.ghostCut + p.gearSold + p.leak }); if (w.books.length > 24) w.books.shift();
  w.mb = emptyFlow(); w.flags.from = w.clean;
  w.black += p.skim + p.ghostCut + p.gearSold + p.leak;
  w.stock = 0; w.mkt = Math.max(L.MKT_MIN, Math.min(L.MKT_MAX, w.mkt + (1 - w.mkt) * 0.3 + (rnd() - 0.5) * 0.32));
  w.favor += p.bribe;
  w.risk = Math.max(0, Math.min(100, w.risk + p.dRisk));
  w.last = p;
  const m = Math.round(w.day / L.MONTH);
  const T = [
    `${m}번째 장부가 봉인되어 북쪽으로 떠났다. 밀랍은 아직 따뜻했다.`,
    `${m}번째 달의 장부가 마차에 실렸다. 숫자들은 서로 눈을 마주치지 않았다.`,
    `${m}번째 장부. 회계관의 도장은 언제나처럼 졸린 각도로 찍혔다.`,
    `${m}번째 장부가 떠났다. 받아 적는 손이 한 번 멈칫했다는 말이 돌았다.`,
  ];
  note(w, 'news', T[p.look]);
  if (p.dRisk > 8) note(w, 'warn', '제국 회계청 서기 하나가 우리 영지의 장부를 따로 서랍에 넣었다고 한다.');
  // 승진(조건: 누적 상납)
  while (w.rank < RANKS.length - 1 && w.favor >= L.PROMOTE[w.rank]) {
    w.rank++;
    const R = [
      '', '제국의 문장이 찍힌 서한. 이제부터 이 땅의 주인은 자작이라 불린다. 청렴의 공을 기린다고 적혀 있었다. 판에 두 칸이 열렸다.',
      '백작의 인장이 도착했다. 상자 바닥에는 영지 지도가 한 장 더 깔려 있었고, 새 성벽의 값은 이미 치러져 있었다.',
      '후작의 문장이 마차에서 내렸다. 아무도 어느 달의 장부가 이 값을 치렀는지 묻지 않았다.',
      '공작의 관이 수도에서 내려왔다. 관에 박힌 보석 하나하나가, 누군가의 장부에서는 사라진 숫자였다.'];
    note(w, 'good', R[w.rank]);
    if (w.rank === RANKS.length - 1) w.over = 'duke';
  }
  // 유족 항의(조건: 한 달 사망)
  if (w.mo.deaths >= 12 && w.mo.deaths / Math.max(1, w.mo.visits) >= 0.09) { w.rep = Math.max(0.5, w.rep - 0.12); note(w, 'bad', `미궁 어귀에 검은 천이 걸렸다. 돌아오지 못한 이름이 이번 달만 ${w.mo.deaths}개, 유족들의 행렬이 관청 앞을 막았다.`); }
  w.mo = { take: 0, visits: 0, deaths: 0, gear: w.mo.gear - p.gearSold, bought: 0, bv: 0, washed: { casino: 0, cathedral: 0 } };
  w.led.bribe = 0;
  w.cards = [...new Set([...w.cards, ...BUILD_ORDER.filter(k => BDEF[k].rank <= w.rank && BDEF[k].rank > 0)])];
  clampLed(w);
}

function startAudit(w: World) {
  w.audit = { due: w.day + L.AUDIT_LEAD };
  note(w, 'warn', '북쪽 길에 회색 마차가 보인다는 전갈. 제국 감사관이다. 닷새 안에 관청 문을 두드릴 것이다.');
}
function resolveAudit(w: World) {
  w.audit = null;
  const r = w.risk;
  if (r >= 75) { w.over = 'arrest'; note(w, 'bad', '감사관은 장부 두 권을 나란히 펼쳤다. 그리고 아무 말 없이 영주의 인장을 상자에 넣었다.'); return; }
  const take = Math.round(w.black * (r / 160));
  const fine = Math.round(Math.max(0, w.clean) * (r / 400));
  w.black -= take; w.clean -= fine;
  w.risk = Math.max(0, r - 15);
  if (take + fine > 0) note(w, 'bad', `감사관은 사흘을 머물렀다. 떠날 때 마차 바퀴가 올 때보다 깊이 파였다. 금고 하나가 비었고, 벌금 고지서 한 장이 남았다.`);
  else note(w, 'news', '감사관은 차 한 잔을 비우고 떠났다. 장부의 여백까지 읽고 간 눈이었다.');
}

// 하루
export function step(w: World) {
  if (w.over) return;
  w.day++;
  // 첫 사건(판마다 같은 자리): 땅이 갈라지고 미궁이 나온다. 다음 날 중앙의 서한이 닿는다
  if (w.phase === 0 && w.day >= L.OPEN_DAY) {
    w.phase = 1;
    for (const k of ['checkpoint', 'rental', 'chapel'] as Kind[]) if (!w.cards.includes(k)) w.cards.push(k);
    note(w, 'bad', '새벽에 밭이 갈라졌다. 틈 아래에서 올라온 것은 흙냄새가 아니라 수백 년 묵은 돌과 쇠의 냄새였다. 이 땅에 미궁이 열렸다. 길목에 세울 검문소의 설계도가 관청에서 내려왔다.');
  } else if (w.phase === 1 && w.day >= L.OPEN_DAY + 1) {
    w.phase = 2; w.qBase = L.QUOTA1;
    note(w, 'warn', '수도에서 서한이 왔다. 변방의 영주 따위에게는 보내 본 적 없는 두꺼운 봉투였고, 인장의 밀랍은 아직 따뜻했다. "새 미궁은 제국의 재산이다. 잘 관리하여 응분의 공납을 올릴 것." 장부의 숫자가 지난해의 열 배로 적혀 있었다.');
  }
  const open = w.phase >= 1;
  const lv = live(w);
  const kinds = lv.map(i => w.tiles[i].b!);
  // 발길
  let pull = open ? L.BASE_VISIT : 1.4;
  for (const i of lv) pull += BDEF[w.tiles[i].b!].pull * lvMul(w, i, L.UP_PULL);
  const dr = open ? deathRate(w) : 0;
  if (buyerOf(w)) pull *= 1 + (w.buyPct * (1 - w.levy / 100) - L.BUY_DEF * (1 - L.LEVY_DEF / 100)) / 200;
  if (gateOf(w)) pull *= feeWant(w.fee);
  pull += L.DELVE_PULL * (w.delve - 1);
  pull *= 1 + L.BUD_PULL * effOf(w.budget.promo, L.BUD_PROMO);
  const arrivals = Math.max(0, Math.floor(pull * w.rep * (0.75 + rnd() * 0.5)));
  const ret = Math.floor(w.back.n * L.RETURN), retAvg = w.back.n ? w.back.gold / w.back.n : 0;
  const visits = arrivals + ret;
  const back = { n: 0, gold: 0 }; let lootSum = 0;
  // 손님 한 명씩: 돈을 들고 와서, 시설을 차례로 들르고, 못 받으면 불만이 쌓인다
  const gate = gateOf(w), buyer = buyerOf(w), feeN = gate ? visits * w.fee : 0;
  let rev = feeN, paidSum = 0, volSum = 0, levySum = 0;
  const byTile: Record<number, number> = {};
  const st = w.stat, turnedK: Partial<Record<Kind, number>> = {}, pricey: Partial<Record<Kind, number>> = {};
  const room: Record<number, number> = {}; for (const i of lv) room[i] = capOf(w, i);
  const byKind: Record<string, number[]> = {}; for (const i of lv) (byKind[w.tiles[i].b!] ??= []).push(i);
  const careSat = L.BUD_SAT * effOf(w.budget.upkeep, L.BUD_CARE);
  let deaths = 0, satSum = 0;
  for (let n = 0; n < visits; n++) {
    const old = n < ret; // 앞의 손님은 어제 미궁에서 돌아온 사람들
    let gold = old ? retAvg * (0.6 + 0.8 * rnd()) : L.NEW_MIN + rnd() * L.NEW_VAR, sat = L.SAT_BASE + careSat + (old ? 6 : 0); st.gold += gold; let kit = false;
    for (const k of PRICED) {
      const own = byKind[k];
      if (!own) { if (BASIC.includes(k)) { turnedK[k] = (turnedK[k] ?? 0) + 1; sat += L.SAT_NONE; } continue; }
      const pct = w.price[k];
      const want = wantOf(pct);
      if (want < 1 && rnd() >= want) continue; // 마음이 안 가서 지나감
      const spot = own.find(i => room[i] > 0);
      if (spot == null) { turnedK[k] = (turnedK[k] ?? 0) + 1; sat += L.SAT_FULL; continue; }
      const price = Math.max(1, Math.round(BDEF[k].rev * pct / 100));
      if (gold < price) { pricey[k] = (pricey[k] ?? 0) + 1; sat += L.SAT_PRICEY; continue; }
      gold -= price; room[spot]--; rev += price; byTile[spot] = (byTile[spot] ?? 0) + price;
      sat += L.SAT_OK + L.SAT_UP * (w.tiles[spot].lv - 1); if (k === 'rental') kit = true;
      const ts = st.tile[spot] ?? (st.tile[spot] = { rev: 0, served: 0 }); ts.rev += price; ts.served++;
      const ks = st.kind[k] ?? (st.kind[k] = { rev: 0, served: 0, turned: 0 }); ks.rev += price; ks.served++;
      w.mb.sales[k] = (w.mb.sales[k] ?? 0) + price;
    }
    sat = Math.max(0, Math.min(100, sat)); satSum += sat;
    if (rnd() < dr) deaths++;
    else { // 살아 돌아온 손님: 전리품을 지갑에 담아 간다
      const loot = open ? lootMean(w) * (0.4 + 1.2 * rnd()) * (kit ? 1.15 : 1) : 0;
      // 매입소가 있으면 전리품을 매입가로 사 들여 재고로 쌓고, 없으면 행상이 헐값에 쳐 준다
      const gross = loot * w.buyPct / 100, cash = buyer ? gross * (1 - w.levy / 100) : loot * L.LOOT_OFF;
      if (buyer) { paidSum += gross; levySum += gross * w.levy / 100; volSum += loot; }
      lootSum += loot; back.n++; back.gold += gold + cash;
    }
  }
  w.back = back; st.loot += lootSum;
  if (paidSum) { w.clean -= paidSum - levySum; w.mb.buy += paidSum; w.mb.levy += levySum; w.stock += volSum; w.mo.bought += volSum; w.mo.bv += visits; }
  for (const k of PRICED) if (turnedK[k]) (st.kind[k] ?? (st.kind[k] = { rev: 0, served: 0, turned: 0 })).turned += turnedK[k]!;
  st.guests += visits; st.sat += satSum;
  w.mb.fee += feeN; w.mb.visits += visits; w.mb.deaths += deaths; w.mb.sat += satSum; w.mb.guests += visits;
  const avgSat = visits ? satSum / visits : L.SAT_BASE + 20;
  w.rep += ((Math.max(0.5, Math.min(1.4, 1.15 - dr * 2.5 + count(w, 'hospital') * 0.04 + (avgSat - 70) / 200)) - w.rep) * 0.05);
  w.mo.take += rev; w.clean += rev; w.mo.visits += visits; w.mo.deaths += deaths; w.mo.gear += deaths * L.GEAR;
  // 유지비
  let up = 0; for (const i of lv) up += BDEF[w.tiles[i].b!].upkeep * lvMul(w, i, L.UP_UPKEEP);
  const town = popOf(w) * L.TOWN_TAX; w.clean += town; w.mb.town += town;
  w.clean -= up; w.mb.upkeep += up;
  const bud = (w.budget.promo + w.budget.safety + w.budget.upkeep) / L.MONTH; w.clean -= bud; w.mb.budget += bud;
  // 세탁: 목표의 30분의 1씩
  for (const k of ['casino', 'cathedral'] as const) {
    const goal = w.led.wash[k]; if (!goal) continue;
    const amt = Math.min(w.black, Math.ceil(goal / L.MONTH), goal - w.mo.washed[k]);
    if (amt <= 0) continue;
    w.black -= amt; w.mo.washed[k] += amt;
    const got = Math.round(amt * (1 - BDEF[k].cut)); w.clean += got; w.mb.wash += got;
    w.risk += amt * BDEF[k].washRisk;
  }
  // 의심: 쌓인 비자금의 냄새, 체면 시설, 저절로 식음
  let calm = L.RISK_DECAY; for (const i of lv) calm += BDEF[w.tiles[i].b!].calm * lvMul(w, i, L.UP_CAP);
  w.risk += Math.max(0, w.black - L.SMELL_AT) * L.SMELL - calm;
  w.risk = Math.max(0, Math.min(100, w.risk));
  w.today = { visits, deaths, rev, byTile };
  const ts = townStage(w);
  if (ts > (w.flags.town ?? 0)) {
    w.flags.town = ts;
    note(w, 'good', [
      '', '길가에 천막이 늘었다. 소작농들은 곡식 값보다 하룻밤 방값이 높다는 사실을 처음 알았다.',
      '쟁기 대신 간판이 팔렸다. 마을 아이들은 이제 모험가의 장비 이름을 먼저 외운다.',
      '곡식밭은 골목이 되었고, 이 땅은 이제 미궁 관광의 도시라 불린다. 쟁기를 아는 이는 노인뿐이다.'][ts]);
  }
  st.fee += feeN; st.visits += visits; st.deaths += deaths; st.spent += rev; st.upkeep += up;
  st.hist.push({ v: visits, r: rev, d: deaths, s: Math.round(avgSat), l: Math.round(lootSum), b: ret, n: turnedK, x: pricey }); if (st.hist.length > 60) st.hist.shift();
  // 조건 사건: 전리품이 쌓이면 상단이 와서 매입소 카드를 준다
  if (open && !w.cards.includes('buyer') && w.stat.loot >= L.TRADER_AT) {
    w.cards.push('buyer');
    note(w, 'good', '짐수레 여섯 대가 길목에 멈췄다. 상단의 대리인은 모험가들의 자루를 오래 바라보더니, 저울과 도장이 든 작은 상자를 관청 문 앞에 놓고 갔다. "값은 저희가 쳐 드리지요. 장부는 영주님 몫이고요."');
  }
  if (deaths >= 3 && !w.flags.bigloss) { w.flags.bigloss = 1; note(w, 'bad', `하루에 ${deaths}명이 돌아오지 않았다. 대여소 반납대에는 주인 없는 방패만 쌓였다.`); }
  if (w.rep < 0.7 && (w.flags.rep ?? -99) < w.day - 40) { w.flags.rep = w.day; note(w, 'bad', '"그 영지 미궁은 무덤이다." 이웃 영지 선술집에서 그런 노래가 불린다고 한다.'); }
  if (w.black > 2500 && (w.flags.smell ?? -99) < w.day - 45) { w.flags.smell = w.day; note(w, 'warn', '관청 지하 창고의 자물쇠가 셋으로 늘었다. 하인들은 그 앞을 지날 때 목소리를 낮춘다.'); }
  if (w.audit && w.day >= w.audit.due) resolveAudit(w);
  else if (!w.audit && w.risk >= L.AUDIT_AT && rnd() < (w.risk - L.AUDIT_AT + 5) / 300) startAudit(w);
  if (w.risk >= L.ARREST && !w.over) { w.over = 'arrest'; note(w, 'bad', '새벽, 제국 기병대가 관청을 둘러쌌다. 영지의 장부는 이제 수도의 법정에서 읽힌다.'); }
  if (w.day % L.MONTH === 0 && !w.over) closeMonth(w);
  if (!w.over && w.day >= L.TERM * L.MONTH) { w.over = 'term'; note(w, 'news', '임기가 끝났다. 새 영주의 마차가 진흙길에 멈춰 섰고, 떠나는 마차에는 짐이 생각보다 많았다.'); }
  if (w.clean < L.BANKRUPT && !w.over) { w.over = 'bankrupt'; note(w, 'bad', '금고는 텅 비었고 채권자들이 관청 계단에 앉았다. 영지는 다음 주인을 기다린다.'); }
}

export function monthDay(w: World) { return { m: Math.floor(w.day / L.MONTH) + 1, d: (w.day % L.MONTH) + 1 }; }

// 부족한 것: 최근 열흘 하루 평균으로 읽는다. 무엇을 지을지는 국장이 정한다
export interface Need { sev: 1 | 2 | 3; what: string; hint: string; kind?: Kind }
export function needsOf(w: World): Need[] {
  const out: Need[] = []; const h = w.stat.hist.slice(-10);
  if (h.length < 3) return [{ sev: 1, what: '통계 모으는 중', hint: '며칠 지켜볼 것' }];
  const avg = (f: (d: Day) => number) => h.reduce((a, d) => a + f(d), 0) / h.length;
  const v = avg(d => d.v);
  const names: Partial<Record<Kind, [string, string]>> = { inn: ['잠잘 곳', '여관'], tavern: ['마실 곳', '선술집'], rental: ['빌릴 장비', '무기 상점'] };
  for (const k of ['inn', 'tavern', 'rental'] as Kind[]) {
    const t = avg(d => d.n[k] ?? 0); const own = count(w, k);
    if (v >= 3 && t / Math.max(1, v) > 0.15) out.push({ sev: t / v > 0.5 ? 3 : 2, what: `${names[k]![0]} ${own ? '모자람' : '없음'}`, hint: `하루 ${t.toFixed(1)}명 그냥 돌아감`, kind: k });
  }
  for (const k of PRICED) {
    const x = avg(d => d.x[k] ?? 0);
    if (v >= 3 && x / Math.max(1, v) > 0.15) out.push({ sev: x / v > 0.4 ? 3 : 2, what: `${BDEF[k].name} 요금 비쌈`, hint: `하루 ${x.toFixed(1)}명 돈이 모자라 돌아감` });
  }
  if (w.phase >= 2 && !gateOf(w)) out.push({ sev: 3, what: '입장료를 받을 곳이 없음', hint: '검문소가 서야 입장료와 출입 명부가 생긴다', kind: 'checkpoint' });
  if (w.cards.includes('buyer') && !buyerOf(w)) out.push({ sev: 3, what: '전리품이 헐값에 흩어짐', hint: '매입소가 서야 시세와 거래세로 번다', kind: 'buyer' });
  const sat = avg(d => d.s);
  if (v >= 3 && sat < 55) out.push({ sev: sat < 40 ? 3 : 2, what: '손님 만족 낮음', hint: `평균 ${Math.round(sat)}점` });
  const dr = deathRate(w);
  if (dr > 0.09) out.push({ sev: dr > 0.11 ? 3 : 2, what: '미궁 사망률 높음', hint: `${Math.round(dr * 100)}% · 병원 · 장비 대여소`, kind: 'hospital' });
  if (firstFree(w) >= 0 && w.clean > 600) out.push({ sev: 1, what: '빈 자리 있음', hint: `${slotsOf(w) - live(w).length}칸 비어 있음` });
  if (w.black > 600 && !count(w, 'casino') && !count(w, 'cathedral')) out.push({ sev: 2, what: '세탁 거점 없음', hint: `비자금 ${Math.round(w.black)} 쌓이는 중`, kind: 'casino' });
  if (w.rep < 0.8) out.push({ sev: 2, what: '모험가 평판 하락', hint: '발길이 줄어드는 중' });
  
  if (!out.length) out.push({ sev: 1, what: '당장 급한 것 없음', hint: '' });
  return out.sort((a, b) => b.sev - a.sev);
}
