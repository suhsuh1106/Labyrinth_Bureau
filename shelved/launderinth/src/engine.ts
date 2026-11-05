// Launderinth(론더린스) 프로토타입 엔진. DOM을 쓰지 않는다. 하루가 한 턴(step), 한 달 L.MONTH일.
// 루프: 건설 · 집객 → 표면 수익 → 장부 조작(신고율 · 유령 대원 · 장비 밀수) → 비자금 → 세탁 → 상납 → 승진.
// 사건은 날짜가 아니라 상태 조건으로 터진다(감사 · 유족 항의 · 발길 끊김 · 승진).
import { rnd, setSeed } from '../../../src/core/rng';

export const MW = 24, MH = 16;
export const RANKS = ['남작', '자작', '대공'] as const;

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
  TAX: [0.7, 0.65, 0.6],     // 계급별 신고 수익 세율
  PROMOTE: [10000, 60000],    // 누적 상납: 자작 · 대공
  RISK_DECAY: 0.08,          // 하루 저절로 식는 의심
  SMELL_AT: 800,             // 이만큼 넘는 비자금은 냄새가 난다
  SMELL: 1 / 25000,          // (비자금 − SMELL_AT) × SMELL 만큼 하루 의심
  AUDIT_AT: 45,              // 이 위로는 감사관이 올 수 있다
  AUDIT_LEAD: 5,             // 예고에서 도착까지 날
  ARREST: 100,
  TERM: 18,                  // 임기(달). 그때까지 대공이 못 되면 다음 사람에게 인장이 간다
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

export type Kind = 'road' | 'inn' | 'tavern' | 'rental' | 'hospital' | 'casino' | 'cathedral';
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
  tag: '길' | '영업' | '체면' | '세탁';
  note: string;
}
export const BDEF: Record<Kind, BDef> = {
  road:      { name: '도로',       icon: '',   cost: 15,   upkeep: 0,  cap: 0,  rev: 0, pull: 0,   safe: 0,     calm: 0,    wash: 0,    cut: 0,    washRisk: 0,      rank: 0, tag: '길',   note: '흙을 다진 길' },
  inn:       { name: '여관',       icon: '🏨', cost: 280,  upkeep: 3,  cap: 4,  rev: 5, pull: 1.0, safe: 0,     calm: 0,    wash: 0,    cut: 0,    washRisk: 0,      rank: 0, tag: '영업', note: '젖은 이불, 비싼 숙박비' },
  tavern:    { name: '선술집',     icon: '🍺', cost: 180,  upkeep: 2,  cap: 6,  rev: 3, pull: 0.8, safe: 0,     calm: 0,    wash: 0,    cut: 0,    washRisk: 0,      rank: 0, tag: '영업', note: '묽은 맥주, 진한 소문' },
  rental:    { name: '장비 대여소', icon: '⚒️', cost: 240,  upkeep: 2,  cap: 4,  rev: 4, pull: 0.4, safe: 0.015, calm: 0,    wash: 0,    cut: 0,    washRisk: 0,      rank: 0, tag: '영업', note: '반납되지 않는 검이 더 많다' },
  hospital:  { name: '자선 병원',   icon: '🏥', cost: 420,  upkeep: 8,  cap: 0,  rev: 0, pull: 0.3, safe: 0.03,  calm: 0.12, wash: 0,    cut: 0,    washRisk: 0,      rank: 0, tag: '체면', note: '현판이 병상보다 크다' },
  casino:    { name: '카지노',     icon: '🎰', cost: 900,  upkeep: 10, cap: 6,  rev: 6, pull: 1.5, safe: 0,     calm: 0,    wash: 1500, cut: 0.25, washRisk: 0.0022, rank: 0, tag: '세탁', note: '잃은 돈은 기록에 남지 않는다' },
  cathedral: { name: '대성당',     icon: '⛪', cost: 1800, upkeep: 6,  cap: 0,  rev: 0, pull: 0.5, safe: 0,     calm: 0.2,  wash: 3200, cut: 0.12, washRisk: 0.0009, rank: 1, tag: '세탁', note: '헌금함에는 바닥이 없다' },
};
export const BUILD_ORDER: Kind[] = ['road', 'inn', 'tavern', 'rental', 'hospital', 'casino', 'cathedral'];

export type Terrain = 'grass' | 'forest' | 'rock' | 'water';
export interface Tile { t: Terrain; b: Kind | null; born: number; lv: number }

// 장부: 국장이 숫자로 정하는 것들. 달이 닫힐 때 그대로 제국에 올라간다
export interface Ledger {
  report: number;   // 신고율(%) 실제 수익 중 제국 장부에 적는 몫
  ghosts: number;   // 유령 탐사대원(명)
  smuggle: number;  // 사망자 장비 밀수 비율(%)
  bribe: number;    // 이번 달 상납(합법 자금)
  wash: { casino: number; cathedral: number }; // 이번 달 세탁 목표(비자금)
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
  fee: number; sales: Partial<Record<Kind, number>>; subsidy: number; wash: number;       // 들어온 돈
  upkeep: number; budget: number; capex: number; tax: number; bribe: number; toBlack: number; // 나간 돈
  visits: number; deaths: number; sat: number; guests: number;
}
export interface Book extends Flow { m: number; from: number; to: number; net: number }
export const emptyFlow = (): Flow => ({ fee: 0, sales: {}, subsidy: 0, wash: 0, upkeep: 0, budget: 0, capex: 0, tax: 0, bribe: 0, toBlack: 0, visits: 0, deaths: 0, sat: 0, guests: 0 });
export interface Budget { promo: number; safety: number; upkeep: number }
export const BUDGET_KEYS = ['promo', 'safety', 'upkeep'] as const;
export const BUDGET_NAME = { promo: '홍보', safety: '안전', upkeep: '정비' } as const;
export const effOf = (spend: number, k: number) => 1 - Math.exp(-spend / k);
export interface Note { day: number; text: string; kind: 'news' | 'warn' | 'good' | 'bad' }
export interface Audit { due: number; }

export interface World {
  seed: number; day: number; rank: number;
  clean: number; black: number; risk: number; favor: number;
  rep: number;               // 모험가들 사이 평판(발길)
  tiles: Tile[];
  spawn: number; gate: number; // 타일 번호
  led: Ledger;
  mo: { take: number; visits: number; deaths: number; gear: number; washed: { casino: number; cathedral: number } };
  last: null | MonthReport;
  audit: Audit | null;
  notes: Note[];
  over: null | 'arrest' | 'bankrupt' | 'duke' | 'term';
  delve: number; back: { n: number; gold: number }; // 미궁 개척 단계 · 어제 살아 돌아온 손님(수 · 가진 돈)
  budget: Budget; mb: Flow; books: Book[];
  price: Record<'inn' | 'tavern' | 'rental' | 'casino', number>; // 요금(%)
  stat: Stat;
  today: { visits: number; deaths: number; rev: number; byTile: Record<number, number> };
  flags: Record<string, number>;
}

export interface MonthReport {
  real: number; reported: number; skim: number; tax: number;
  registered: number; subsidy: number; ghostCut: number;
  gearSold: number; bribe: number; washed: number; washCut: number;
  look: number; // 대조 소견 0 깨끗 · 1 어색 · 2 수상 · 3 명백
  dRisk: number;
}

export const idx = (x: number, y: number) => y * MW + x;
export const xy = (i: number) => [i % MW, Math.floor(i / MW)] as const;

function makeMap(): { tiles: Tile[]; spawn: number; gate: number } {
  const tiles: Tile[] = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const r = rnd();
    let t: Terrain = 'grass';
    if (r < 0.1) t = 'forest';
    else if (r < 0.14) t = 'rock';
    // 오른쪽 위 바위 언덕, 아래쪽 개울
    if (x > 18 && y < 5 && rnd() < 0.7) t = 'rock';
    if (y === 13 && x > 2 && x < 15) t = 'water';
    if ((x < 3 || y < 2) && rnd() < 0.35) t = 'forest';
    tiles.push({ t, b: null, born: -99, lv: 1 });
  }
  const sy = 8, gx = 20, gy = 6;
  const spawn = idx(0, sy), gate = idx(gx, gy);
  // 처음 흙길: 서쪽 끝에서 미궁 어귀까지
  const path: number[] = [];
  for (let x = 0; x <= gx; x++) path.push(idx(x, sy));
  for (let y = sy - 1; y > gy; y--) path.push(idx(gx, y));
  for (const i of path) { tiles[i].t = 'grass'; tiles[i].b = 'road'; tiles[i].born = -99; }
  tiles[gate].t = 'rock'; tiles[gate].b = null;
  // 어귀 둘레는 바위
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1]]) {
    const i = idx(gx + dx, gy + dy); if (tiles[i].b !== 'road') tiles[i].t = 'rock';
  }
  return { tiles, spawn, gate };
}

export function newWorld(seed: number): World {
  setSeed(seed);
  const m = makeMap();
  return {
    seed, day: 0, rank: 0, clean: L.START_CLEAN, black: 0, risk: 4, favor: 0, rep: 1,
    tiles: m.tiles, spawn: m.spawn, gate: m.gate,
    led: { report: 100, ghosts: 0, smuggle: 0, bribe: 0, wash: { casino: 0, cathedral: 0 } },
    mo: { take: 0, visits: 0, deaths: 0, gear: 0, washed: { casino: 0, cathedral: 0 } },
    last: null, audit: null, over: null,
    notes: [{ day: 0, kind: 'news', text: '변방 영지의 인장이 새 주인의 손에 들어왔다. 미궁 어귀로 이어진 길은 하나, 그마저 진흙이다.' }],
    delve: 1, back: { n: 0, gold: 0 },
    budget: { promo: 0, safety: 0, upkeep: 0 }, mb: emptyFlow(), books: [],
    price: { inn: 100, tavern: 100, rental: 100, casino: 100 },
    stat: { hist: [], tile: {}, kind: {}, guests: 0, sat: 0, gold: 0, loot: 0, fee: 0, visits: 0, deaths: 0, spent: 0, upkeep: 0 },
    today: { visits: 0, deaths: 0, rev: 0, byTile: {} },
    flags: {},
  };
}

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export function nbrs(i: number): number[] {
  const [x, y] = xy(i); const out: number[] = [];
  for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < MW && ny < MH) out.push(idx(nx, ny)); }
  return out;
}

// 서쪽 끝 길에서 이어진 도로 칸
export function roadNet(w: World): Set<number> {
  const seen = new Set<number>([w.spawn]); const q = [w.spawn];
  while (q.length) { const c = q.shift()!; for (const n of nbrs(c)) if (!seen.has(n) && w.tiles[n].b === 'road') { seen.add(n); q.push(n); } }
  return seen;
}
// 이어진 길 옆에 선 건물(영업 중)
export function live(w: World): number[] {
  const net = roadNet(w); const out: number[] = [];
  w.tiles.forEach((t, i) => { if (t.b && t.b !== 'road' && nbrs(i).some(n => net.has(n))) out.push(i); });
  return out;
}
export function count(w: World, k: Kind, onlyLive = true): number {
  if (!onlyLive) return w.tiles.filter(t => t.b === k).length;
  return live(w).filter(i => w.tiles[i].b === k).length;
}

export function canBuild(w: World, i: number, k: Kind): string | null {
  const d = BDEF[k], t = w.tiles[i];
  if (w.over) return '임기 끝';
  if (d.rank > w.rank) return `${RANKS[d.rank]} 이상`;
  if (w.clean < d.cost) return '자금 부족';
  if (i === w.gate) return '미궁 어귀';
  if (t.b) return '이미 있음';
  if (t.t === 'water' || t.t === 'rock') return '지을 수 없는 땅';
  if (k === 'road') { if (!nbrs(i).some(n => w.tiles[n].b === 'road')) return '길과 떨어짐'; }
  else if (!nbrs(i).some(n => w.tiles[n].b === 'road')) return '길 옆에만';
  return null;
}
export const lvMul = (w: World, i: number, per: number) => 1 + per * (w.tiles[i].lv - 1);
export const capOf = (w: World, i: number) => Math.round(BDEF[w.tiles[i].b!].cap * lvMul(w, i, L.UP_CAP));
export function upCost(w: World, i: number): number { const t = w.tiles[i]; return t.b && t.b !== 'road' && t.lv < L.UP_MAX ? Math.round(BDEF[t.b].cost * L.UP_COST * t.lv / 10) * 10 : 0; }
export function upgrade(w: World, i: number): string | null {
  const t = w.tiles[i], c = upCost(w, i);
  if (w.over) return '임기 끝';
  if (!t.b || t.b === 'road') return '건물 아님';
  if (t.lv >= L.UP_MAX) return '최고 단계';
  if (w.clean < c) return '자금 부족';
  w.clean -= c; w.mb.capex += c; t.lv++; return null;
}
export function setBudget(w: World, k: keyof Budget, v: number) { w.budget[k] = Math.max(0, Math.min(L.BUD_MAX, Math.round(v / L.BUD_STEP) * L.BUD_STEP)); }
export const PRICED = ['inn', 'tavern', 'rental', 'casino'] as const;
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
  if (t.t === 'forest') t.t = 'grass';
  return true;
}
export function demolish(w: World, i: number): boolean {
  const t = w.tiles[i];
  if (!t.b || i === w.spawn) return false;
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
  l.ghosts = Math.max(0, Math.min(400, Math.round(l.ghosts)));
  l.smuggle = Math.max(0, Math.min(100, Math.round(l.smuggle / 10) * 10));
  l.bribe = Math.max(0, Math.round(l.bribe / 50) * 50);
  for (const k of ['casino', 'cathedral'] as const) l.wash[k] = Math.max(0, Math.min(washCap(w, k), Math.round(l.wash[k] / 50) * 50));
};

function note(w: World, kind: Note['kind'], text: string) { w.notes.unshift({ day: w.day, kind, text }); if (w.notes.length > 60) w.notes.length = 60; }

// 대조 소견: 제국 회계관이 신고 장부를 펼쳤을 때의 얼굴
export function lookOf(w: World, reported: number, registered: number, gearSold: number): number {
  const expect = Math.max(1, registered * L.EXPECT);
  const ratio = reported / expect;
  const ghostR = w.mo.visits > 0 ? w.led.ghosts / w.mo.visits : (w.led.ghosts > 0 ? 3 : 0);
  let s = 0;
  if (ratio < 0.85) s += (0.85 - ratio) * 4;
  s += ghostR * 1.2 + gearSold / 1500;
  return s < 0.25 ? 0 : s < 0.8 ? 1 : s < 1.6 ? 2 : 3;
}
export const LOOK = ['깨끗', '어색', '수상', '명백'];

// 달이 닫힐 때 무엇이 될지(장부 조작소의 미리보기). 상태를 바꾸지 않는다
export function preview(w: World): MonthReport {
  const l = w.led;
  const real = w.mo.take;
  const reported = Math.round(real * l.report / 100);
  const skim = real - reported;
  const tax = Math.round(reported * L.TAX[w.rank]);
  const registered = w.mo.visits + l.ghosts;
  const subsidy = registered * L.SUB;
  const ghostCut = l.ghosts * L.SUB;
  const gearSold = Math.round(w.mo.gear * l.smuggle / 100);
  const bribe = Math.min(l.bribe, Math.max(0, w.clean - skim - tax + subsidy - ghostCut));
  const look = lookOf(w, reported, registered, gearSold);
  const expect = Math.max(1, registered * L.EXPECT);
  const ratio = reported / expect;
  const ghostR = w.mo.visits > 0 ? l.ghosts / w.mo.visits : (l.ghosts > 0 ? 3 : 0);
  let dRisk = 0;
  if (ratio < 0.85) dRisk += (0.85 - ratio) * 45;
  dRisk += ghostR * 14 + gearSold * 0.006 - bribe / 1000;
  const washed = w.mo.washed.casino + w.mo.washed.cathedral;
  return { real, reported, skim, tax, registered, subsidy, ghostCut, gearSold, bribe, washed, washCut: 0, look, dRisk };
}

function closeMonth(w: World) {
  const p = preview(w);
  // 매상은 날마다 금고(합법 자금)에 들어와 있다. 장부에서 지운 몫은 금고에서 빼내 비자금이 된다
  const from = w.flags.from ?? L.START_CLEAN;
  w.clean += -p.skim - p.tax + (p.subsidy - p.ghostCut) - p.bribe;
  Object.assign(w.mb, { subsidy: p.subsidy - p.ghostCut, tax: p.tax, bribe: p.bribe, toBlack: p.skim });
  w.books.push({ ...w.mb, sales: { ...w.mb.sales }, m: Math.round(w.day / L.MONTH), from, to: w.clean, net: w.clean - from }); if (w.books.length > 24) w.books.shift();
  w.mb = emptyFlow(); w.flags.from = w.clean;
  w.black += p.skim + p.ghostCut + p.gearSold;
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
  while (w.rank < 2 && w.favor >= L.PROMOTE[w.rank]) {
    w.rank++;
    if (w.rank === 1) note(w, 'good', '제국의 문장이 찍힌 서한. 이제부터 이 땅의 주인은 자작이라 불린다. 청렴의 공을 기린다고 적혀 있었다.');
    if (w.rank === 2) { note(w, 'good', '대공의 관이 수도에서 내려왔다. 관에 박힌 보석 하나하나가, 누군가의 장부에서는 사라진 숫자였다.'); w.over = 'duke'; }
  }
  // 유족 항의(조건: 한 달 사망)
  if (w.mo.deaths >= 12 && w.mo.deaths / Math.max(1, w.mo.visits) >= 0.09) { w.rep = Math.max(0.5, w.rep - 0.12); note(w, 'bad', `미궁 어귀에 검은 천이 걸렸다. 돌아오지 못한 이름이 이번 달만 ${w.mo.deaths}개, 유족들의 행렬이 관청 앞을 막았다.`); }
  w.mo = { take: 0, visits: 0, deaths: 0, gear: w.mo.gear - p.gearSold, washed: { casino: 0, cathedral: 0 } };
  w.led.bribe = 0;
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
  const lv = live(w);
  const kinds = lv.map(i => w.tiles[i].b!);
  // 발길
  let pull = L.BASE_VISIT;
  for (const i of lv) pull += BDEF[w.tiles[i].b!].pull * lvMul(w, i, L.UP_PULL);
  const dr = deathRate(w);
  pull += L.DELVE_PULL * (w.delve - 1);
  pull *= 1 + L.BUD_PULL * effOf(w.budget.promo, L.BUD_PROMO);
  const arrivals = Math.max(0, Math.floor(pull * w.rep * (0.75 + rnd() * 0.5)));
  const ret = Math.floor(w.back.n * L.RETURN), retAvg = w.back.n ? w.back.gold / w.back.n : 0;
  const visits = arrivals + ret;
  const back = { n: 0, gold: 0 }; let lootSum = 0;
  // 손님 한 명씩: 돈을 들고 와서, 시설을 차례로 들르고, 못 받으면 불만이 쌓인다
  let rev = visits * L.FEE;
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
      if (!own) { if (k !== 'casino') { turnedK[k] = (turnedK[k] ?? 0) + 1; sat += L.SAT_NONE; } continue; }
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
      const loot = lootMean(w) * (0.4 + 1.2 * rnd()) * (kit ? 1.15 : 1);
      lootSum += loot; back.n++; back.gold += gold + loot;
    }
  }
  w.back = back; st.loot += lootSum;
  for (const k of PRICED) if (turnedK[k]) (st.kind[k] ?? (st.kind[k] = { rev: 0, served: 0, turned: 0 })).turned += turnedK[k]!;
  st.guests += visits; st.sat += satSum;
  w.mb.fee += visits * L.FEE; w.mb.visits += visits; w.mb.deaths += deaths; w.mb.sat += satSum; w.mb.guests += visits;
  const avgSat = visits ? satSum / visits : L.SAT_BASE + 20;
  w.rep += ((Math.max(0.5, Math.min(1.4, 1.15 - dr * 2.5 + count(w, 'hospital') * 0.04 + (avgSat - 70) / 200)) - w.rep) * 0.05);
  w.mo.take += rev; w.clean += rev; w.mo.visits += visits; w.mo.deaths += deaths; w.mo.gear += deaths * L.GEAR;
  // 유지비
  let up = 0; for (const i of lv) up += BDEF[w.tiles[i].b!].upkeep * lvMul(w, i, L.UP_UPKEEP);
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
  st.fee += visits * L.FEE; st.visits += visits; st.deaths += deaths; st.spent += rev; st.upkeep += up;
  st.hist.push({ v: visits, r: rev, d: deaths, s: Math.round(avgSat), l: Math.round(lootSum), b: ret, n: turnedK, x: pricey }); if (st.hist.length > 60) st.hist.shift();
  // 조건 사건
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
  const names: Partial<Record<Kind, [string, string]>> = { inn: ['잠잘 곳', '여관'], tavern: ['마실 곳', '선술집'], rental: ['빌릴 장비', '장비 대여소'] };
  for (const k of ['inn', 'tavern', 'rental'] as Kind[]) {
    const t = avg(d => d.n[k] ?? 0); const own = count(w, k);
    if (v >= 3 && t / Math.max(1, v) > 0.15) out.push({ sev: t / v > 0.5 ? 3 : 2, what: `${names[k]![0]} ${own ? '모자람' : '없음'}`, hint: `하루 ${t.toFixed(1)}명 그냥 돌아감`, kind: k });
  }
  for (const k of PRICED) {
    const x = avg(d => d.x[k] ?? 0);
    if (v >= 3 && x / Math.max(1, v) > 0.15) out.push({ sev: x / v > 0.4 ? 3 : 2, what: `${BDEF[k].name} 요금 비쌈`, hint: `하루 ${x.toFixed(1)}명 돈이 모자라 돌아감` });
  }
  const sat = avg(d => d.s);
  if (v >= 3 && sat < 55) out.push({ sev: sat < 40 ? 3 : 2, what: '손님 만족 낮음', hint: `평균 ${Math.round(sat)}점` });
  const dr = deathRate(w);
  if (dr > 0.09) out.push({ sev: dr > 0.11 ? 3 : 2, what: '미궁 사망률 높음', hint: `${Math.round(dr * 100)}% · 병원 · 장비 대여소`, kind: 'hospital' });
  const dead = w.tiles.filter(t => t.b && t.b !== 'road').length - live(w).length;
  if (dead > 0) out.push({ sev: 3, what: '길 끊긴 건물', hint: `${dead}채 영업 못 함`, kind: 'road' });
  if (w.black > 600 && !count(w, 'casino') && !count(w, 'cathedral')) out.push({ sev: 2, what: '세탁 거점 없음', hint: `비자금 ${Math.round(w.black)} 쌓이는 중`, kind: 'casino' });
  if (w.rep < 0.8) out.push({ sev: 2, what: '모험가 평판 하락', hint: '발길이 줄어드는 중' });
  
  if (!out.length) out.push({ sev: 1, what: '당장 급한 것 없음', hint: '' });
  return out.sort((a, b) => b.sev - a.sev);
}
