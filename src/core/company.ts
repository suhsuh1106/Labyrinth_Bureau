// 용병단 경영 (새 전제, docs/plan.md 1단계). 옛 관리국 규칙과 따로 돌아가는 엔진이다.
// 여러 용병단이 같은 층에서 전리품을 캐고 같은 시장에 판다. 층마다 캘 수 있는 양이 한정돼 몰리면 나눠 갖고,
// 모두가 같은 시세에 팔아서 다 같이 많이 팔면 값이 떨어진다. 플레이어는 그중 한 용병단의 행정관이다.
// 화면에 붙이기 전까지는 상태를 S가 아니라 이 파일의 World 하나로 둔다.
import { ANOMALIES, BUYERS, CLASSES, CLASS_SHARE, FAUNA, GEARS, GEAR_SHARE, KEYS, MAT_TIER, MONSTERS, type Mat, ROOT_LORE } from './data';
import { rnd } from './rng';
import { keyWord } from './util';

export const CO = {
  PARTY: 4, WAGE: 30, SORTIE: 60, POTION0: 35, POTION_Q0: 500,
  // 거점 2단계면 성공 한 번에 BASE_TAKE개를 더 캔다
  BASE_STEP: 3000, BASE_MAX: 2, BASE_TAKE: 10, REGEN: 0.5,
  HIRE_FEE: 120, HIRE_CUT: 0.4,
  // 시작 금고: START_SIZE명인 용병단이 START_CASH를 들고 온다 (규모^CASH_EXP에 비례)
  START_CASH: 8000, START_SIZE: 16,
  // 가장 깊은 열린 층에서 이만큼 성공이 쌓이면 다음 층이 열린다 (모든 용병단이 함께 뚫는다)
  OPEN_WINS: [40, 60, 80, 100],
  // 편성 지침: 그 층 몬스터의 약점을 갖춘 파티는 성공률이 오르고, 역효과를 갖춘 파티는 떨어진다. 지침대로 갖추는 데 조당 돈이 든다
  // (우리 조는 직업 약점을 사람 수로 따진다: 그 직업 한 명이면 절반, 둘이면 다)
  GUIDE_COST: 20, KEY_BONUS: 0.20, BAD_PEN: 0.15,
  // 포션 공급: 상단은 물량이 무제한이고 수요가 많을수록 비싸진다. 교회 성수 포션은 조금 비싸고 한 달 공급 한도가 있지만,
  // 사망을 더 줄인다 (모두 교회 포션이면 한 병이 1+HOLY병 몫)
  POTION_C0: 32, CHURCH_CAP: 360, HOLY: 0.25,
  // 담합: 포션 수요와 사망이 쌓이면 긴장이 차고, 넘치면 상단과 교회가 함께 값을 올린다. 교회 후원이 쌓이면 교회가 빠진다
  CARTEL_MARKUP: 1.4, CARTEL_MONTHS: 5, CARTEL_COOL: 8, BREAK_DONATION: 3000, TENSION_Q: 110,
  // 신입 계약금 (한 명당). 지원자보다 찾는 사람이 많으면 모자란 비율 × RECRUIT_UP만큼 오른다 (RECRUIT_MAX배까지)
  RECRUIT: 80, RECRUIT_UP: 0.5, RECRUIT_MAX: 2,
  // 숙소: 인원은 침상 수를 넘지 못한다. 처음엔 인원보다 BED_SPARE개 많다. 증축하면 침상 DORM_ADD개가 다음 달에 생기고(한 번에 한 채),
  // 값은 침상 하나에 DORM_BED + DORM_GROW × 지금 침상 수다. 빈 침상에도 침상마다 DORM_KEEP씩 유지비가 든다
  BED_SPARE: 0, DORM_ADD: 8, DORM_BED: 120, DORM_GROW: 4, DORM_KEEP: 4,
  // 수습: 새로 뽑은 사람은 다음 달부터 얕은 층 조부터 한 명씩 끼어 나가고, 낀 조가 ROOK_WINS번 성공하면 대원이 된다.
  // 수습이 낀 조는 한 명당 성공률이 ROOK_PEN 떨어진다
  ROOK_WINS: 3, ROOK_PEN: 0.05,
  // 우리 조 편성: 단원마다 직업이 있고, 조는 있는 사람으로 짠다. 자리가 빈 채 나가면 빈자리 하나당 성공률 -SHORT_PEN,
  // 캐 오는 양은 사람 수만큼(4명 기준)만. 신입은 직업을 골라 뽑고, 드문 직업은 CLASS_COST배 비싸다(지원자 중 그 직업의 몫까지만)
  SHORT_PEN: 0.12, TPL0: ['전사', '궁수', '도적', '마법사'],
  CLASS_COST: { 전사: 1, 궁수: 1.2, 도적: 1.2, 마법사: 1.5, 사제: 1.5 } as Record<string, number>,
  // 마을 지원자: 매달 APP_BASE + 지난달 모두의 판매 수입 1000G당 APP_PER명 (±20%). 첫 달은 APP0명.
  // 찾는 사람이 더 많으면 명성의 무게(1 + 명성 / FAME_K)대로 나눈다
  APP_BASE: 6, APP_PER: 0.8, APP0: 14,
  // 명성: 성공한 조마다 그 층의 FAME_F, 사망마다 -FAME_DEATH. 매달 FAME_FADE를 곱한다
  FAME_F: [1, 2, 3, 5, 8], FAME_DEATH: 1, FAME_FADE: 0.9, FAME_K: 50,
  // 큰 조직일수록 사람 하나 굴리는 데 드는 관리비가 오른다: 급여 × (1 + 단원 수 / OVERHEAD). 시작 금고는 규모^CASH_EXP에 비례
  OVERHEAD: 100, CASH_EXP: 1,
  // 몸집과 질: 훈련과 탐사 숙련은 사람 머릿수로 나뉜다. 같은 훈련비·같은 성공이라도 SIZE_REF명보다 크면 한 사람에게 덜 돌아간다.
  // 큰 용병단은 조를 많이 보내고 건물 값을 여럿이 나눠 내지만, 한 조 한 조는 무뎌진다. 작은 용병단은 그 반대다
  SIZE_REF: 36,
  // 훈련: 훈련도는 매달 5%씩 식고 훈련비/200만큼 찬다(훈련비를 계속 내면 훈련비/10에 머문다).
  // 성공률 보너스는 갈수록 덜 오른다: TRAIN_MAX × 훈련도 / (훈련도 + TRAIN_K)
  TRAIN_MAX: 0.2, TRAIN_K: 20,
  // 미궁의 압력: 모두가 꺼낸 전리품 값(기준 시세)이 PRESS_DIV마다 1씩 차고 매달 PRESS_DECAY만큼 빠진다.
  // ANOM_AT마다 이상 징후가 돌고, OVER를 넘으면 달마다 OVER_CHANCE로 범람한다. 범람하면 1·2층에 있던 파티가 당하고 두 층이 쑥대밭이 된다
  PRESS_DIV: 6000, PRESS_DECAY: 0.03, ANOM_AT: [55, 75, 90], OVER: 100, OVER_CHANCE: 0.4, OVER_KILL: 0.2, OVER_POOL: 0.4, OVER_LEFT: 0.35,
  // 근원: 약점을 갖춘 우리 직영 파티가 그 층에서 ROOT_WINS번 성공하면, 약점대로 들어간 달에 근원을 찾는다.
  // 기금이 ROOT_COST에 차면 봉인이나 채굴장이 된다. 봉인: 교회가 같은 돈을 보태고(SEAL_MATCH), 압력이 SEAL_DRAIN 빠지고,
  // 그 층 압력 ×SEAL_PRESS, 층 크기 ×SEAL_MAX, 길을 아는 우리 파티 성공률 +SEAL_SUCC. 채굴장: 우리 조당 채집 +MINE_TAKE, 그 층 압력 ×MINE_PRESS
  ROOT_WINS: 12, ROOT_COST: 5000, SEAL_PRESS: 0.3, SEAL_MAX: 0.9, SEAL_SUCC: 0.15, SEAL_MATCH: 1, SEAL_DRAIN: 25,
  MINE_TAKE: 20, MINE_PRESS: 2.5,
  // 전리품 비율: 성공 한 번에 캐 오는 양 = 층의 기본 양 × (1 + 탐사 숙련도 + 갈무리장 + 채집 장비)
  // 숙련도는 그 층에서 쌓은 성공 수에서 나오고 갈수록 덜 오른다: EXP_MAX × 성공 / (성공 + EXP_K)
  // 이 값들은 손익이 맞을 듯 말 듯하게 맞췄다. 더 키우면 작은 우리가 공유하는 층에서 몫을 너무 빨리 넓혀 혼자 앞서 나간다
  EXP_MAX: 0.15, EXP_K: 40, PROC_STEP: 5000, PROC_MAX: 2, PROC_BONUS: 0.06, TOOL_COST: [0, 25, 60], TOOL_BONUS: [0, 0.04, 0.08],
  // 몬스터 적응: 모든 용병단이 약점대로 갖춰 들어간 파티가 ADAPT_AT에 이르면 그 층 몬스터의 약점이 바뀐다 (한 번)
  ADAPT_AT: 220,
  // 현장 기록은 오래된 것일수록 흐려진다 (매달 OBS_FADE를 곱한다)
  OBS_FADE: 0.92,
  // 갈무리 소재: 성공한 직영 파티가 몬스터에게서 얻는 것 (계약 파티는 갈무리하지 않는다). 층이 비어 갈수록 덜 나온다.
  // 소재는 정산 때 모두 판다 (창고에 두지 않는다). 시세는 시장 전체 물량이 평소(지난 물량의 흐르는 평균)보다 많으면 떨어진다
  // MAT_VAL: 소재 값 전체에 곱하는 값. 소재는 판매 수입의 한 할 남짓이 되게 맞췄다 (더 크면 모두가 부자가 되고 큰 용병단이 더 앞선다)
  MAT_VAL: 0.45, MAT_FLOW: 0.25, MAT_EXP: 0.4, MAT_LO: 0.7, MAT_HI: 1.2,
  // 보급 창고: 포션은 산 달별 묶음으로 쌓이고 오래된 것부터 꺼내 쓴다. 산 뒤 POT_KEEP달(성수는 HOLY_KEEP달)이 지나면 그 묶음이 상한다
  // (전리품은 창고에 두지 않고 캐 온 달에 모두 판다)
  POT_KEEP: 2, HOLY_KEEP: 4,
  // 위기와 포션: 조마다 사람 하나하나가 위기를 맞을 수 있다(실패한 조는 층 위험 × CRISIS_FAIL, 성공한 조는 × CRISIS_OK).
  // 위기마다 들고 간 포션을 한 병 꺼내 쓴다. 포션이 떨어진 뒤의 위기는 그대로 맞는다.
  // 맞은 위기는 CRISIS_DEATH로 사망이 된다 (성수는 그 몫을 HOLY만큼 줄인다). 쓰지 않은 포션은 창고로 돌아온다
  // 포션이 있으면 위기를 맞은 사람은 대개 다치고(다음 달 한 달 쉼, 치료비 HEAL_COST) 층의 harm만큼만 죽는다. 포션이 없으면 CRISIS_DEATH만큼 죽는다
  // 포션으로 버틴 위기는 INJURE만큼만 부상으로 남는다 (포션 없이 맞은 위기는 죽지 않으면 다친다)
  CRISIS_FAIL: 2.2, CRISIS_OK: 0.35, CRISIS_DEATH: 0.6, HEAL_COST: 30, INJURE: 0.1,
  // 보급: 포션과 장비는 내정에서 사 두고 탐험에 꺼내 쓴다. 포션은 쓴 만큼 줄고, 장비는 한 벌을 조 하나가 들고 가서
  // 성공하면 GEAR_BREAK, 실패하면 GEAR_LOST로 망가지거나 잃어버린다. 직업을 꼭 넣는 데는 조당 GUIDE_COST가 든다
  GEAR_PRICE: 80, GEAR_BREAK: 0.1, GEAR_LOST: 0.35,
  // 조사 의뢰: 정보 주차에 돈을 내면 이번 달 것을 바로 알려 준다. 한 달에 PROBE_MAX번까지
  PROBE_MKT: 150, PROBE_RIV: 200, PROBE_MAX: 3,
  // 편성 줄: 한 층의 우리 조를 줄마다 다르게 챙겨 보낸다 (층마다 KIT_MAX줄까지, 나머지는 섞인 대로)
  KIT_MAX: 3,
  // 찾는 곳: 매달 DEM_CHANCE로 새로 생기고(동시에 DEM_MAX까지), DEM_MUL 사이로 값을 더 쳐주며 DEM_LEN달 동안 이어진다
  DEM_CHANCE: 0.35, DEM_MAX: 4, DEM_MUL: [0.15, 0.5], DEM_LEN: [3, 8],
};
// 소재 하나: 이름, 층, 몬스터, 1층 기준 값을 층에 맞춘 값
export type MatRef = Mat & { f: number; mon: string; val: number };
// 그 판의 층마다 사는 몬스터 셋(주인 하나와 곁 몬스터 둘)과 소재들
export const floorMons = (W: World, f: number) => [MONSTERS[W.mons[f]], ...FAUNA[f]].map(m => ({ name: m.name, mats: m.mats.map(x => ({ ...x, f, mon: m.name, val: Math.max(1, Math.round(x.v * MAT_TIER[f] * CO.MAT_VAL)) })) as MatRef[] }));
export const allMats = (W: World) => FLOORS.flatMap((_, f) => floorMons(W, f).flatMap(m => m.mats));
// 소재를 찾는 곳 (모든 용병단에 똑같이 값을 더 쳐준다)
export type Demand = { m: string; who: number; mul: number; at: number; until: number };
// 도감 기록: 우리 성공 조가 갖춘 것(직업·장비 하나, 또는 둘의 짝)마다 몇 조였고, 그중 몇 조가 그 소재를 얻었나. '*'는 성공한 조 전체
export type Book = { n: Record<string, number>; got: Record<string, Record<string, number>> };
export type Mats = { avgQ: Record<string, number>; ref: Record<string, number>; dem: Demand[]; book: Book[] };
// 편성 지침은 직업 하나와 장비 하나까지 함께 줄 수 있다 ("c:사제+g:은")
export const guideParts = (g: string | undefined) => (g ? g.split('+').filter(Boolean) : []);
// 파티가 갖춘 것에서 도감 기록의 조건을 만든다: 하나씩과, 둘씩 짝
export const condsOf = (keys: string[]) => { const k = [...keys].sort(), out = [...k]; for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) out.push(k[i] + '+' + k[j]); return out; };
// 소재를 얻을 확률: 조건을 갖췄으면 (1+값)배, 층이 비어 갈수록 줄어든다
export const matChance = (x: Mat, keys: string[], full: number) =>
  Math.min(0.95, x.p * (1 + (x.b || []).reduce((a, [c, v]) => a + (c.split('+').every(k => keys.includes(k)) ? v : 0), 0))) * (0.5 + 0.5 * clamp(full, 0, 1));
// 소재 시세: 기준 값 × 찾는 곳 웃돈 × 물량 (평소보다 많이 팔리면 내려간다)
export const matPrice = (val: number, mul: number, Q: number, avg: number | undefined) => Math.round(val * mul * (avg && Q ? clamp(Math.pow(avg / Q, CO.MAT_EXP), CO.MAT_LO, CO.MAT_HI) : 1));
export const demandMul = (W: World, m: string) => (W.mat ? W.mat.dem.filter(d => d.m === m && d.until >= W.month).reduce((a, d) => Math.max(a, 1 + d.mul), 1) : 1);
// 정보망: 출처마다 0~3단계. 매달 유지비(KEEP)보다 적게 쓰면 한 단계 내려가고, 넘게 쓴 만큼 쌓여 UP에 이르면 한 단계 오른다.
// 귀환 보고와 입구 출입 기록은 1단계가 공짜로 주어진다. 상단 장부·교회 기록 2단계부터는 그 세력과의 사이가 INTEL_REL 이상이어야 한다
export type Src = 'ret' | 'mkt' | 'chu' | 'gate' | 'spy';
export const SRCS: Src[] = ['ret', 'mkt', 'chu', 'gate', 'spy'];
export const INTEL = {
  KEEP: { ret: [0, 0, 60, 120], mkt: [0, 60, 150, 250], chu: [0, 60, 120, 200], gate: [0, 0, 120, 220], spy: [0, 150, 300, 450] } as Record<Src, number[]>,
  UP: { ret: [0, 300, 500], mkt: [300, 500, 800], chu: [300, 500, 700], gate: [0, 400, 600], spy: [400, 600, 900] } as Record<Src, number[]>,
  BASE: { ret: 1, mkt: 0, chu: 0, gate: 1, spy: 0 } as Record<Src, number>,
  REL: 55,
  // 세력(상단·교회와의 사이) 시스템은 지금 닫아 두었다. 닫혀 있는 동안 2단계부터의 사이 조건을 따지지 않는다
  GATE: false,
};
// 다음 단계로 오르는 데 세력과의 사이가 모자라 막혀 있으면, 어느 세력과 지금 사이를 돌려준다
export function intelBlock(W: World, k: Src): { who: string; now: number } | null {
  const lv = W.intel ? W.intel.lv[k] : INTEL.BASE[k], c = W.cos[0];
  if (!INTEL.GATE || lv + 1 < 2 || lv >= 3) return null;
  if (k === 'mkt' && (c.relM ?? 50) < INTEL.REL) return { who: '상단', now: Math.round(c.relM ?? 50) };
  if (k === 'chu' && (c.relC ?? 50) < INTEL.REL) return { who: '교회', now: Math.round(c.relC ?? 50) };
  return null;
}
export type Intel = {
  lv: Record<Src, number>; acc: Record<Src, number>;
  spyOn: string[]; tenure: Record<string, number>;
  // 매달 말 엔진이 만든 짐작: 층마다 다음 달 남은 양(가득 대비 %), 경쟁 용병단마다 다음 달 층별 파티 수
  est: { floors: ({ lo: number; hi: number; mid: number } | null)[]; rivals: Record<string, ({ mid: number; w: number } | null)[]>;
    apps?: { lo: number; hi: number } };   // 이번 달 마을 지원자 (관문 기록 단계만큼 좁아진다)
};
// 경쟁 용병단이 한 층에 몇 달 드나들어야 그 층의 약점을 깨치는가 (군소 용병대는 깨치지 못한다)
const LEARN_AT: Record<string, number> = { deep: 5, steady: 6, shallow: 6, second: 6, chaser: 8, volume: 9, hoarder: 9 };

// 1층은 넓고 순해서 여럿이 몰려도 견딘다(cap이 크고 위험이 낮다). 깊을수록 좁고 사납다.
// harm: 포션을 들고 위기를 맞았을 때 죽는 몫 (나머지는 다친다). 깊은 층은 포션으로 다 막지 못한다
export type Floor = { name: string; max: number; take: number; base: number; risk: number; cap: number; harm: number };
export const FLOORS: Floor[] = [
  { name: '1층', max: 2400, take: 50, base: 0.86, risk: 0.04, cap: 90, harm: 0.08 },
  { name: '2층', max: 1200, take: 40, base: 0.70, risk: 0.13, cap: 35, harm: 0.1 },
  { name: '3층', max: 700, take: 30, base: 0.55, risk: 0.24, cap: 18, harm: 0.18 },
  { name: '4층', max: 360, take: 30, base: 0.42, risk: 0.36, cap: 10, harm: 0.3 },
  { name: '5층', max: 160, take: 20, base: 0.28, risk: 0.55, cap: 6, harm: 0.5 },
];
// 층마다 전리품 한 가지. P0는 수요(D)만큼 팔렸을 때의 시세다
// 시세는 수요와 공급으로 정해진다: D는 한 달에 시장이 사 가는 양(수요), 공급은 그달 모든 용병단이 판 양.
// 공급이 수요를 넘으면 값이 떨어지고 모자라면 오른다. el은 그 민감도, lo~hi는 기준 시세에 곱하는 값의 바닥과 천장.
// 얕은 층: 사는 곳이 많아(수요가 크고) 모두가 많이 팔아도 값이 잘 안 움직인다.
// 깊은 층: 사는 곳이 몇 안 되고(수요가 작고) 공급도 적다. 여럿이 몰려 공급이 수요를 넘으면 값이 크게 무너진다
export type Item = { name: string; buyer: string; P0: number; D: number; el: number; lo: number; hi: number };
export const ITEMS: Item[] = [
  { name: '가죽과 점액', buyer: '상단 경매장', P0: 8, D: 850, el: 0.35, lo: 0.8, hi: 1.15 },
  { name: '마석 조각', buyer: '마법학교 · 상단', P0: 23, D: 550, el: 0.55, lo: 0.6, hi: 1.3 },
  { name: '정령 결정', buyer: '마법학교', P0: 34, D: 300, el: 0.75, lo: 0.45, hi: 1.5 },
  { name: '고대 유물', buyer: '수도 수집가 · 교회', P0: 56, D: 150, el: 0.95, lo: 0.35, hi: 1.7 },
  { name: '심층의 핵', buyer: '수도', P0: 120, D: 60, el: 1.15, lo: 0.25, hi: 2.0 },
];
const NF = FLOORS.length;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const zeros = () => FLOORS.map(() => 0);

// ---------- 시장 ----------
// 시장 전체 판매량 Q가 수요 D보다 많으면 값이 떨어지고(바닥 lo), 적으면 오른다(천장 hi). 얼마나 민감한지는 el
// 값은 0.1G 단위까지 (싼 전리품은 개수가 많고 한 개 값이 몇 G라서, 정수로 자르면 출렁임이 뚝뚝 끊긴다)
export const priceOf = (it: Item, Q: number) => Math.round(it.P0 * (Q ? clamp(Math.pow(it.D / Q, it.el), it.lo, it.hi) : it.hi) * 10) / 10;
// 포션은 모든 용병단이 많이 살수록 비싸진다
export const potionPrice = (Q: number) => Math.round(CO.POTION0 * clamp(Math.sqrt(Q / CO.POTION_Q0), 0.8, 1.6));

// ---------- 용병단 ----------
export type Style = 'player' | 'volume' | 'steady' | 'deep' | 'chaser' | 'hoarder' | 'shallow' | 'second' | 'crowd';
export type Company = {
  id: string; name: string; style: Style; size: number;
  members: number; cash: number; skill: number; bases: number[]; pendingBase: { f: number; amt: number } | null;
  losses: number;
  know: number[]; learned: boolean[];   // 층마다 드나든 달 수와 약점을 깨쳤는지 (경쟁 용병단)
  relM?: number; relC?: number;   // 상단·교회와의 사이 (0~100, 50이 보통)
  exp?: number[]; proc?: number; pendingProc?: number;
  sup?: Supply;        // 사 둔 포션과 장비   // 층별 탐사 숙련(그 층에서 쌓은 성공), 갈무리장 단계와 공사 중인 투자
  // 판마다 조금씩 다른 성격: 지난달 벌이에 얼마나 민감한지, 포션을 더 쓰는지, 얼마나 값이 올라야 파는지
  trait?: { resp: number; pots: number };
  // 인원: 침상, 증축 중인 침상, 증축한 횟수, 수습마다 겪은 성공 수, 명성
  beds?: number; pendingBeds?: number; dorms?: number; rook?: number[]; fame?: number;
  // 우리 단원 명단 (직업, 수습이면 겪은 성공 수). 우리 수습은 rook 대신 여기에 둔다. 경쟁 용병단은 명단 없이 조마다 직업이 섞여 나간다
  crew?: Person[]; nextId?: number; hurtN?: number;   // hurtN: 이번 달 부상으로 쉬는 사람 (경쟁 용병단)
};
export type Person = { id: number; c: string; rk?: number; hurt?: number };   // hurt: 부상으로 쉬는 달 수
// 우리 조 하나: 층, 자리 넷(단원 id, 빈자리는 null), 챙길 장비("g:은" 꼴, 빈 문자열이면 섞인 대로)
export type Team = { f: number; m: (number | null)[]; g: string };
// guide: 층마다 편성 지침 (KEYS 중 하나, 없으면 빈 문자열)
// donate: 교회 후원금, root: 찾아낸 근원 하나에 봉인·채굴장 기금으로 넣는 돈
// tool: 채집 장비 수준(0~2), proc: 갈무리장 투자, intel: 출처별 정보비, spyOn: 정보원을 붙일 경쟁 용병단
// 보급 창고: 포션은 산 달별 묶음(pot[a]는 a달 전에 산 것), 장비는 종류별 벌 수
export type Supply = { pot: number[]; holy: number[]; gear: Record<string, number> };
// 편성 줄: n조가 g를 꼭 챙긴다 ("c:사제+g:은" 꼴, 빈 문자열이면 섞인 대로)
export type Kit = { n: number; g: string };
export type Plan = { parties: number[]; pots: number[]; train: number; base: { f: number; amt: number } | null; hire: number[]; guide: string[]; donate?: number;
  root?: { f: number; seal: number; mine: number } | null; tool?: number; proc?: number; intel?: Partial<Record<Src, number>>; spyOn?: string[];
  // 정보망을 화면에서 정하는 꼴: 유지비는 저절로 내고(cut에 든 출처는 끊는다), up만큼 더 넣어 넓힌다. 있으면 intel을 이것으로 다시 셈한다
  intelUp?: Partial<Record<Src, number>>; intelCut?: Src[];
  // buy: 이번 달 사 둘 보급. 비워 둔 칸은 "필요한 만큼" (포션은 모자란 만큼 상단에서, 장비는 편성에 모자란 만큼)
  buy?: { pot?: number; holy?: number; gear?: Record<string, number> };
  // kits: 층마다 편성 줄 (플레이어). 있으면 guide 대신 이것을 따르고, 줄에 들지 않은 우리 조와 계약 파티는 섞인 대로 간다
  kits?: Kit[][];
  // recruit: 이번 달 뽑을 신입 수 (비워 두면 빈 침상만큼), dorm: 숙소 증축
  recruit?: number; dorm?: boolean;
  // 우리 조 편성: 기본 편성(자리 넷의 직업), 조마다의 편성. 있으면 parties·kits 대신 이것을 따른다. recruitC: 직업별로 뽑을 신입
  tpl?: string[]; teams?: Team[]; recruitC?: Record<string, number>;
  tplF?: (string[] | undefined)[] };   // 층마다 따로 짤 모양 (봇이 쓴다. 화면은 기본 편성 하나로 짜고 손으로 고친다)
// 조사 의뢰 한 건: 시장 조사는 지금 나와 있는 찾는 곳 전부, 타 용병단 조사는 그 용병단의 이번 달 층별 파티 수
export type Probe = { m: number; k: 'mkt' | 'riv'; id?: string; cost: number; dem?: Demand[]; parties?: number[]; hire?: number[]; guide?: string[] };

export const ROSTER: { id: string; name: string; style: Style; size: number }[] = [
  // 미궁이 막 열려 모두 작게 시작한다. size는 처음 들어온 인원이다
  { id: 'us', name: '회색늑대 용병단', style: 'player', size: 16 },
  { id: 'red', name: '붉은 깃발단', style: 'volume', size: 28 },
  { id: 'holy', name: '성흔 기사단', style: 'steady', size: 24 },
  { id: 'iron', name: '철모회', style: 'deep', size: 16 },
  { id: 'crow', name: '까마귀단', style: 'chaser', size: 16 },
  { id: 'silver', name: '은빛 창', style: 'hoarder', size: 16 },
  { id: 'fox', name: '여우굴 패', style: 'shallow', size: 8 },
  { id: 'bridge', name: '돌다리 형제단', style: 'second', size: 8 },
  { id: 'free', name: '군소 용병대', style: 'crowd', size: 30 },
];

export type CoResult = {
  // ok: 해낸 조(둘 이상 해냄) 수, win: 해낸 사람을 4명 기준 조로 센 값(숙련 · 길 뚫기 · 명성에 쓴다), hurt: 다친 사람
  sent: number[]; hired: number[]; ok: number[]; win: number[]; got: number[]; deaths: number; hurt: number; sold: number[]; sales: number;
  spend: { sortie: number; potion: number; wage: number; train: number; base: number; hire: number; recruit: number; donate: number; root: number; tool: number; proc: number; intel: number; gear: number; probe: number; dorm: number; heal: number }; net: number; recruited: number;
  recruitWant: number; recruitPrice: number; rookDone: number; rookDead: number;
  recruitC?: Record<string, number>;   // 우리가 직업별로 들인 신입   // 찾은 신입 수와 한 명 값, 대원이 된 수습과 죽은 수습
  potSpoil: number;   // 기한이 지나 버린 포션
  potUsed: number; potShort: number; gearUsed: Record<string, number>; gearLost: Record<string, number>;   // 꺼내 쓴 포션과 모자랐던 병, 들고 간 장비와 망가진 것
  matSold: Record<string, number>; matSales: number;   // 정산 때 판 소재 (판매 수입 sales에 들어 있다)
  dF: number[];   // 층별 사망
  potNeed: number; potC: number;   // 이번 달 산 포션과 그중 교회 포션
};
export type MonthResult = {
  month: number; res: CoResult[]; plans: Plan[]; Q: number[]; price: number[]; potion: number; potQ: number; potionC: number; cartel: boolean;
  floors: { before: number; taken: number; crowd: number; cut?: number }[]; perParty: number[]; opened: number | null; rank: string[];
  // 우리 직영 파티 하나하나: 간 층, 갖춘 직업·장비, 성공, 사망 (귀환 보고에 쓴다)
  ours: { f: number; keys: string[]; ok: boolean; d: number; mats: [string, number][]; first: string[]; kit: number; g: string; crisis?: number; pots?: number; n?: number; k?: number; hurt?: number }[];   // n: 간 사람, k: 해낸 사람, hurt: 다친 사람   // kit: 편성 줄 번호(-1이면 섞인 대로), g: 챙겨 간 것
  matPrice: Record<string, number>; matRef: Record<string, number>;   // 소재 시세와, 그달 전까지의 평균 시세
  pressure: number; overflow: boolean;
  apps: number;   // 그달 마을 지원자
  fc?: Forecast;   // 결재 직전 우리 수입 어림 (결과와 견준다)
};
// 수입 어림: 전리품과 소재 판매 수입의 분포 (약점 · 역효과는 넣지 않는다. 플레이어가 아는 것만으로 셈한다)
export type Forecast = { mean: number; p10: number; p50: number; p90: number; bins: number[]; step: number; dead: number; hurt: number };
// 근원: 찾은 달(0이면 아직), 봉인·채굴장 기금, 다 모은 쪽과 그 달
export type Root = { found: number; seal: number; mine: number; done: '' | 'seal' | 'mine'; at: number };
// 현장 기록: 우리 파티만 가져오는 정보다. 증언(notes)과, 어떤 직업·장비를 갖춘 파티가 몇 번 나가 몇 번 성공했는지(obs, '*'는 그 층 전체)
export type Note = { m: number; f: number; t: string };
export type World = {
  month: number; unlocked: number; prog: number; pool: number[]; price: number[]; potion: number;
  cos: Company[]; last: MonthResult | null; history: MonthResult[]; log: { m: number; t: string }[];
  mons: number[]; notes: Note[]; obs: Record<string, { n: number; w: number }>[];
  potionC?: number;   // 지난달 교회 포션 값 (후원하지 않은 쪽이 내는 값)
  cartel?: Cartel | null; tension?: number; cool?: number;
  pressure?: number; anoms?: number; anomN?: number; roots?: Root[];
  keys?: string[]; keyUse?: number[]; adapted?: number[];   // 층마다 지금의 약점, 약점대로 들어간 파티 누적, 약점이 바뀐 달(0이면 아직)
  intel?: Intel;
  mat?: Mats;
  probes?: Probe[];
  apps?: number;   // 이번 달 정산 때 마을에 와 있을 지원자 (지난달 말에 정해 둔다)
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
    pressure: 0, anoms: 0, anomN: 0, roots: FLOORS.map(() => ({ found: 0, seal: 0, mine: 0, done: '' as const, at: 0 })),
    keys: mons.map(m => MONSTERS[m].key), keyUse: zeros(), adapted: zeros(),
    mat: { avgQ: {}, ref: {}, dem: [], book: FLOORS.map(() => ({ n: {}, got: {} })) },
    intel: { lv: { ...INTEL.BASE }, acc: { ret: 0, mkt: 0, chu: 0, gate: 0, spy: 0 }, spyOn: [], tenure: {}, est: { floors: FLOORS.map((_, f) => (f === 0 ? { lo: 40, hi: 100, mid: 75 } : null)), rivals: {}, apps: { lo: CO.APP0 - 4, hi: CO.APP0 + 4 } } },
    month: 1, unlocked: 1, prog: 0, pool: FLOORS.map(F => F.max), price: ITEMS.map(it => it.P0), potion: CO.POTION0,
    apps: CO.APP0,
    cos: ROSTER.map(r => ({ ...r, members: r.size, cash: r.style === 'crowd' ? 0 : Math.round(CO.START_CASH * Math.pow(r.size / CO.START_SIZE, CO.CASH_EXP)),
      beds: r.size + CO.BED_SPARE, pendingBeds: 0, dorms: 0, rook: [] as number[], fame: 0,
      ...(r.style === 'player' ? { crew: crewOf(r.size), nextId: r.size } : {}),
      skill: 0, bases: zeros(), pendingBase: null, losses: 0, know: zeros(), learned: FLOORS.map(() => false), relM: 50, relC: 50, exp: zeros(), proc: 0, pendingProc: 0,
      // 처음 들어올 때 조마다 포션 세 병씩은 챙겨 온다
      sup: { pot: [Math.floor(r.size / CO.PARTY) * 3], holy: [], gear: {} },
      trait: { resp: 0.8 + 0.4 * rnd(), pots: rnd() < 0.3 ? 1 : 0 } })),
    last: null, history: [], log: [], probes: [],
  };
}

export const us = (W: World) => W.cos[0];
// 그 층 몬스터의 지금 약점 (적응하면 바뀐다)
export const keyOf = (W: World, f: number) => (W.keys && W.keys[f]) || MONSTERS[W.mons[f]].key;
// 전리품 비율: 성공 한 번에 캐 오는 양에 곱하는 값
export const expBonus = (n: number) => CO.EXP_MAX * n / (n + CO.EXP_K);
export const lootMul = (c: Company, f: number, tool = 0) =>
  1 + expBonus(((c.exp && c.exp[f]) || 0) * CO.SIZE_REF / Math.max(CO.SIZE_REF / 2, c.members)) + CO.PROC_BONUS * Math.min(CO.PROC_MAX, c.proc || 0) + (CO.TOOL_BONUS[tool] || 0);
const rootOf = (W: World, f: number): Root => (W.roots && W.roots[f]) || { found: 0, seal: 0, mine: 0, done: '', at: 0 };
// 층의 크기: 봉인한 층은 조금 작아진다 (모두가 덜 캔다)
export const floorMax = (W: World, f: number) => Math.round(FLOORS[f].max * (rootOf(W, f).done === 'seal' ? CO.SEAL_MAX : 1));
// 층이 압력에 보태는 배율: 봉인하면 줄고, 채굴장을 내면 는다
export const pressOf = (W: World, f: number) => { const d = rootOf(W, f).done; return d === 'seal' ? CO.SEAL_PRESS : d === 'mine' ? CO.MINE_PRESS : 1; };
export const maxParties = (c: Company) => Math.floor((c.crew ? c.crew.filter(x => !x.hurt).length : c.members - (c.hurtN || 0)) / CO.PARTY);
export const isHurt = (p: Person) => !!p.hurt;
// 인원: 침상, 빈 침상, 증축 값(공사 중인 것까지 친 침상 수로 셈), 숙소 유지비, 급여
export const bedsOf = (c: Company) => c.beds ?? c.members + CO.BED_SPARE;
export const roomOf = (c: Company) => Math.max(0, bedsOf(c) - c.members);
export const dormCost = (c: Company) => CO.DORM_ADD * (CO.DORM_BED + CO.DORM_GROW * (bedsOf(c) + (c.pendingBeds || 0)));
export const dormKeep = (beds: number) => beds * CO.DORM_KEEP;
export const wageOf = (m: number) => Math.round(m * CO.WAGE * (1 + m / CO.OVERHEAD));
// 신입 한 명 값: 찾는 사람(want)이 지원자(apps)보다 많으면 오른다
export const recruitPrice = (want: number, apps: number) => Math.round(CO.RECRUIT * Math.min(CO.RECRUIT_MAX, 1 + CO.RECRUIT_UP * Math.max(0, want / Math.max(1, apps) - 1)));
// 처음 단원 명단: 직업은 마을 사람들의 비율대로 (판마다 같다)
export function crewOf(n: number): Person[] {
  const k = CLASS_SHARE.map(v => Math.floor(n * v));
  const order = CLASS_SHARE.map((v, i) => [n * v - k[i], i]).sort((a, b) => b[0] - a[0]);
  for (let j = 0, rest = n - k.reduce((a, b) => a + b, 0); rest > 0; j++, rest--) k[order[j][1]]++;
  return CLASSES.flatMap((c, i) => Array.from({ length: k[i] }, () => c)).map((c, id) => ({ id, c }));
}
export const isRook = (p: Person) => p.rk != null;
// 수습 수 (우리는 명단에서, 경쟁 용병단은 rook에서)
export const rookCount = (c: Company) => (c.crew ? c.crew.filter(isRook).length : (c.rook || []).length);
// 조를 기본 편성대로 짠다: 조마다 자리 넷에 그 직업을 대원 먼저 찾아 넣는다. fill이면 남은 빈자리를 남은 사람으로 채운다.
// want[f]가 있으면 그 층 조의 앞 두 자리는 그 직업으로 (지침), gear[f]는 그 층 조의 장비
// tplF[f]가 있으면 그 층은 그 모양으로 짠다. 대원은 깊은 층 조부터 넣는다 (수습은 얕은 층에 남는다)
export function formTeams(c: Company, parties: number[], tpl: string[], fill = true, want: string[] = [], gear: string[] = [], tplF: (string[] | undefined)[] = []): Team[] {
  const crew = (c.crew || []).filter(p => !p.hurt).sort((a, b) => (isRook(a) ? 1 : 0) - (isRook(b) ? 1 : 0)), used = new Set<number>();
  const take = (cls: string) => { const x = crew.find(p => p.c === cls && !used.has(p.id)); if (x) used.add(x.id); return x ? x.id : null; };
  const teams: Team[] = [];
  parties.forEach((n, f) => { for (let q = 0; q < n; q++) teams.push({ f, m: [null, null, null, null], g: gear[f] || '' }); });
  // 지침 직업은 두 자리에 넣는다 (직업 약점은 두 명이어야 다 먹힌다)
  [...teams].sort((a, b) => b.f - a.f).forEach(T => { const w = want[T.f]; (tplF[T.f] || (w ? [w, w, ...tpl.filter((x, i) => i !== tpl.indexOf(w))].slice(0, CO.PARTY) : tpl)).forEach((cls, s) => { T.m[s] = cls ? take(cls) : null; }); });
  if (fill) fillTeams(c, teams, tpl);
  return teams.filter(T => T.m.some(x => x != null) || !fill);
}
// 빈자리를 남은 사람으로 채운다 (그 자리의 기본 편성 직업을 먼저)
export function fillTeams(c: Company, teams: Team[], tpl: string[]) {
  const on = new Set(teams.flatMap(T => T.m).filter((x): x is number => x != null));
  const rest = (c.crew || []).filter(p => !on.has(p.id) && !p.hurt).sort((a, b) => (isRook(a) ? 1 : 0) - (isRook(b) ? 1 : 0));
  [...teams].sort((a, b) => b.f - a.f).forEach(T => T.m.forEach((x, s) => {
    if (x != null || !rest.length) return;
    const i = Math.max(0, rest.findIndex(p => p.c === tpl[s])); T.m[s] = rest.splice(i, 1)[0].id;
  }));
  return teams;
}
// 이번 달 지원자 중 그 직업의 몫 (그 직업으로 뽑을 수 있는 최대)
export const classCap = (apps: number, cls: string) => Math.ceil(apps * CLASS_SHARE[CLASSES.indexOf(cls)]);
// 직업별로 뽑을 신입: 정해 두지 않았으면 빈 침상만큼 기본 편성 순서대로 돌아가며
export function recruitWants(c: Company, P: Plan, room: number, apps: number) {
  const out: Record<string, number> = {};
  if (P.recruitC) CLASSES.forEach(k => { const n = clamp(Math.floor(P.recruitC![k] || 0), 0, classCap(apps, k)); if (n) out[k] = n; });
  else { const tpl = (P.tpl && P.tpl.length ? P.tpl : CO.TPL0).filter(Boolean); for (let j = 0, n = P.recruit == null ? room : P.recruit; j < n && tpl.length; j++) { const k = tpl[j % tpl.length]; out[k] = (out[k] || 0) + 1; } }
  // 빈 침상을 넘으면 흔한 직업부터 덜 뽑는다
  let over = Object.values(out).reduce((a, b) => a + b, 0) - room;
  for (const k of [...CLASSES].sort((a, b) => CLASS_SHARE[CLASSES.indexOf(b)] - CLASS_SHARE[CLASSES.indexOf(a)])) { while (over > 0 && out[k]) { out[k]--; over--; } }
  return out;
}

// 수습이 조에 끼는 자리: 얕은 층 조부터 한 명씩 돌아가며 (q번째 조에 낀 수습 번호들). 조마다 PARTY명까지
export function rookSlots(c: Company, P: Plan) {
  const out = FLOORS.map((_, f) => Array.from({ length: P.parties[f] }, () => [] as number[]));
  const order = FLOORS.flatMap((_, f) => Array.from({ length: P.parties[f] }, (_, q) => [f, q]));
  (c.rook || []).forEach((_, t) => { if (order.length && t < order.length * CO.PARTY) { const [f, q] = order[t % order.length]; out[f][q].push(t); } });
  return out;
}
// 평가액: 금고. 순위의 기준이다 (전리품은 캐 온 달에 모두 팔고, 보급은 쓰는 물건이라 셈하지 않는다)
export const worth = (_W: World, c: Company) => c.cash;
export const supOf = (c: Company): Supply => c.sup || (c.sup = { pot: [], holy: [], gear: {} });
const sumOf = (a: number[]) => a.reduce((x, y) => x + (y || 0), 0);
// 창고에 있는 포션 (상단 · 성수)
export const potsOf = (c: Company) => { const S = supOf(c); return { pot: sumOf(S.pot), holy: sumOf(S.holy) }; };
// 이번 달 쓰지 않으면 정산 때 상하는 포션 (가장 오래된 묶음)
export const potsExpiring = (c: Company) => { const S = supOf(c); return { pot: S.pot[CO.POT_KEEP] || 0, holy: S.holy[CO.HOLY_KEEP] || 0 }; };
// 묶음에서 오래된 것부터 n개를 꺼낸다 (꺼낸 수를 돌려준다)
function takeOld(a: number[], n: number) { let left = n; for (let i = a.length - 1; i >= 0 && left > 0; i--) { const d = Math.min(left, a[i] || 0); a[i] = (a[i] || 0) - d; left -= d; } return n - left; }
// 한 달 묵히기: keep달을 넘긴 묶음은 상해서 버린다 (버린 수를 돌려준다)
function ageLots(a: number[], keep: number) { a.unshift(0); const lost = sumOf(a.slice(keep + 1)); a.length = Math.min(a.length, keep + 1); while (a.length && !a[a.length - 1]) a.pop(); return lost; }
// 직업을 꼭 넣는 값 (장비는 사 둔 것을 들고 가므로 따로 들지 않는다)
const classCost = (g: string) => guideParts(g).filter(k => k.startsWith('c:')).length * CO.GUIDE_COST;
// q번째 조가 챙겨 가는 것: 편성 줄이 있으면 줄 순서대로, 줄 밖의 우리 조와 계약 파티는 섞인 대로
export function kitOf(P: Plan, f: number, q: number): { k: number; g: string } {
  if (P.teams) { const T = P.teams.filter(x => x.f === f)[q]; return { k: -1, g: T ? T.g : '' }; }
  const ks = P.kits && P.kits[f];
  if (!ks) return { k: -1, g: (P.guide && P.guide[f]) || '' };
  let at = 0;
  for (let k = 0; k < ks.length; k++) { if (q < at + ks[k].n && q < P.parties[f]) return { k, g: ks[k].g }; at += ks[k].n; }
  return { k: -1, g: '' };
}
// 한 층에서 챙겨 가는 것들 (줄마다)
export const kitsOn = (P: Plan, f: number) => (P.kits && P.kits[f] ? P.kits[f].filter(x => x.n > 0).map(x => x.g) : [(P.guide && P.guide[f]) || '']).filter(Boolean);
// 이번 달 필요한 포션과 장비 (편성대로 다 들고 간다면)
export function needOf(P: Plan) {
  const pot = P.parties.reduce((a, n, f) => a + (n + P.hire[f]) * P.pots[f], 0), gear: Record<string, number> = {};
  FLOORS.forEach((_, f) => { for (let q = 0; q < P.parties[f] + P.hire[f]; q++) guideParts(kitOf(P, f, q).g).filter(k => k.startsWith('g:')).forEach(k => { gear[k.slice(2)] = (gear[k.slice(2)] || 0) + 1; }); });
  return { pot, gear };
}
// 비워 둔 장비 칸은 편성에 모자란 만큼 산다
export function gearBuy(c: Company, P: Plan) {
  const want = needOf(P).gear, have = supOf(c).gear, out: Record<string, number> = {};
  GEARS.filter(g => g !== '일반').forEach(g => {
    const b = P.buy && P.buy.gear && P.buy.gear[g] != null ? P.buy.gear[g] : Math.max(0, (want[g] || 0) - (have[g] || 0));
    if (b > 0) out[g] = Math.floor(b);
  });
  return out;
}
export const trainBonus = (skill: number) => CO.TRAIN_MAX * skill / (skill + CO.TRAIN_K);
export const succRate = (c: Company, f: number, pots: number, crowd: number) =>
  clamp(FLOORS[f].base + trainBonus(c.skill) + Math.min(CO.BASE_MAX, c.bases[f]) * 0.05 - 0.008 * Math.max(0, crowd - FLOORS[f].cap), 0.1, 0.95);

// 층별 파티 수를 가중치대로 나눈다. 열린 층에만 보낸다
function spread(W: World, n: number, w: number[]) {
  const ws = w.map((v, f) => (f < W.unlocked ? Math.max(0, v) : 0)), s = ws.reduce((a, b) => a + b, 0) || 1;
  const out = ws.map(v => Math.floor(n * v / s));
  let rest = n - out.reduce((a, b) => a + b, 0);
  const order = ws.map((v, f) => [v, f]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0; k = (k + 1) % order.length) if (order[k][0] > 0) { out[order[k][1]]++; rest--; }
  return out;
}

export function emptyPlan(): Plan { return { parties: zeros(), pots: FLOORS.map(() => 3), train: 0, base: null, hire: zeros(), guide: FLOORS.map(() => '') }; }

// 플레이어 기본안: 열린 층에 고르게, 포션 3병
export function defaultPlan(W: World): Plan {
  const c = us(W), P = emptyPlan();
  P.parties = spread(W, maxParties(c), FLOORS.map((_, f) => 1 + f * 0.2));
  P.train = 300;
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
// tool: 채집 장비 수준, proc: 금고가 넉넉하면 갈무리장을 짓는가
const STYLE: Record<Style, { prior: (W: World, f: number) => number; resp: number; pots: number; train: number; tool: number; proc: boolean }> = {
  volume: { prior: (_, f) => 1 / (f + 1) ** 1.5, resp: 0.5, pots: 2, train: 0, tool: 0, proc: true },
  steady: { prior: () => 1, resp: 0.3, pots: 4, train: 300, tool: 1, proc: true },
  deep: { prior: (W, f) => (f >= W.unlocked - 2 ? (f === W.unlocked - 1 ? 2 : 1) : 0.15), resp: 0.4, pots: 5, train: 400, tool: 1, proc: false },
  chaser: { prior: () => 1, resp: 1, pots: 3, train: 300, tool: 0, proc: false },
  crowd: { prior: () => 1, resp: 1.2, pots: 2, train: 0, tool: 0, proc: false },
  hoarder: { prior: (_, f) => (f === 0 ? 0.6 : 1), resp: 0.6, pots: 3, train: 300, tool: 1, proc: false },
  shallow: { prior: (_, f) => (f === 0 ? 1 : 0), resp: 0, pots: 2, train: 0, tool: 0, proc: false },
  second: { prior: (W, f) => (f === Math.min(1, W.unlocked - 1) ? 1 : 0), resp: 0, pots: 3, train: 0, tool: 1, proc: false },
  player: { prior: () => 1, resp: 0, pots: 3, train: 0, tool: 0, proc: false },
};

// 성향마다 몸집을 불리는 정도: build는 증축할 때 금고가 증축 값의 몇 배여야 하는지(0이면 짓지 않는다), cap은 그 이상 짓지 않는 인원
// margin은 조 하나를 더 보냈을 때 남아야 하는 돈
const GROW: Record<Style, { build: number; cap: number; margin: number }> = {
  volume: { build: 1.5, cap: 140, margin: 60 }, steady: { build: 2.5, cap: 100, margin: 120 }, deep: { build: 3.5, cap: 48, margin: 150 }, chaser: { build: 2, cap: 80, margin: 100 },
  hoarder: { build: 3, cap: 64, margin: 120 }, shallow: { build: 3, cap: 20, margin: 120 }, second: { build: 3, cap: 16, margin: 120 }, crowd: { build: 0, cap: 0, margin: 0 }, player: { build: 0, cap: 0, margin: 0 },
};
// 조 하나를 더 보냈을 때 남을 돈 어림: 지난달 그 용병단이 보낸 층들의 조당 벌이(평균) − 출정비와 포션 − 늘어날 급여
export function partyMargin(W: World, i: number) {
  const L = W.last, c = W.cos[i]; if (!L) return 0;
  const sent = L.res[i].sent, n = sent.reduce((a, b) => a + b, 0); if (!n) return 0;
  const per = sent.reduce((a, k, f) => a + k * L.perParty[f], 0) / n;
  return per - CO.SORTIE - 2 * W.potion - (wageOf(c.members + CO.PARTY) - wageOf(c.members));
}

// 성향대로 결정표를 채우고, 지난달 결과에 반응한다. 우리처럼 시세와 붐빔을 보지만 정보는 지난달 것뿐이다
export function aiPlan(W: World, i: number): Plan {
  const c = W.cos[i], P = emptyPlan(), n = maxParties(c), L = W.last, S = STYLE[c.style];
  const t = c.trait || { resp: 1, pots: 0 };
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
  const S0 = potsOf(c), holyWant = Math.round(need * (cheap ? 1 : c.style === 'steady' ? 0.6 : 0.15));
  P.buy = { holy: Math.max(0, holyWant - S0.holy) };
  // 쟁여 두는 용병단: 상단 포션 값이 평소 아래면 두 달 치를 사 둔다 (오래 두면 상한다)
  if (c.style === 'hoarder' && W.potion <= CO.POTION0) P.buy.pot = Math.max(0, need * 2 - S0.pot - S0.holy - P.buy.holy!);
  // 안정형은 늘 쓸 양의 절반만큼 더 쟁여 둔다 (모자라서 덜 들고 가는 일이 없게. 대신 일부는 상한다)
  if (c.style === 'steady') P.buy.pot = Math.max(0, Math.ceil(need * 1.5) - S0.pot - S0.holy - P.buy.holy!);
  P.donate = c.style === 'steady' && W.cartel && (!W.cartel.churchOut || !W.cartel.donated[i]) && c.cash > 8000 ? 800 : 0;
  // 깨친 층에서는 약점대로 갖춰 들어간다
  P.guide = FLOORS.map((_, f) => (c.learned && c.learned[f] ? keyOf(W, f) : ''));
  P.tool = S.tool;
  if (S.proc && (c.proc || 0) + (c.pendingProc || 0) / CO.PROC_STEP < CO.PROC_MAX && c.cash > 14000 && W.month % 6 === 3) P.proc = CO.PROC_STEP;
  // 큰 용병단은 남는 장사인 층이 있으면 군소 용병대를 계약 파티로 빌린다
  if ((c.style === 'volume' || c.style === 'steady' || c.style === 'chaser') && c.cash > 8000) {
    const best = margin.indexOf(Math.max(...margin));
    if (look[best] * (1 - CO.HIRE_CUT) - cost - CO.HIRE_FEE > 60) P.hire[best] = Math.floor(c.members / 16);
  }
  if (c.style === 'deep' && W.month % 4 === 1 && c.cash > 9000) P.base = { f: W.unlocked - 1, amt: CO.BASE_STEP };
  // 몸집: 빈 침상은 채우고, 침상이 차면 금고가 증축 값의 build배를 넘을 때 숙소를 늘린다 (cap명까지)
  const G = GROW[c.style];
  if (c.style !== 'crowd') {
    P.recruit = roomOf(c);
    // 조를 하나 더 보냈을 때 남는 돈이 넉넉해야 짓는다 (층이 붐벼 조당 벌이가 줄면 사람만 늘리지 않는다)
    if (G.build && !c.pendingBeds && roomOf(c) <= 2 && c.members < G.cap && c.losses === 0 && partyMargin(W, i) > G.margin && c.cash > dormCost(c) * G.build) P.dorm = true;
  }
  // 두 달 넘게 적자면 허리띠를 졸라맨다
  if (c.style !== 'crowd' && (c.cash < 3000 || c.losses >= 2)) { P.train = 0; P.base = null; P.proc = 0; P.tool = 0; P.hire = zeros(); P.pots = P.pots.map(v => Math.max(2, v - 1)); P.dorm = false; P.recruit = Math.min(P.recruit || 0, 2); }
  return P;
}

// 계약 파티: 군소 용병대를 이번 달만 빌린다. 한 조에 HIRE_FEE를 주고, 캐 온 것의 HIRE_CUT은 그들 몫이다
export const hireCost = (P: Plan) => P.hire.reduce((a, b) => a + b, 0) * CO.HIRE_FEE;
// 출정비: 조당 SORTIE와, 직업을 꼭 넣은 조의 수당 (포션과 장비는 사 둔 것을 꺼내 쓴다)
export const sortieCost = (P: Plan) => FLOORS.map((_, f) => { let a = 0; for (let q = 0; q < P.parties[f] + P.hire[f]; q++) a += CO.SORTIE + classCost(kitOf(P, f, q).g); return a; });
export const probeCost = (W: World) => (W.probes || []).filter(x => x.m === W.month).reduce((a, x) => a + x.cost, 0);
export const probesLeft = (W: World) => CO.PROBE_MAX - (W.probes || []).filter(x => x.m === W.month).length;
// 조사 의뢰: 돈은 이번 달 정산 때 나가고, 답은 바로 온다. 숨긴 정보를 상태에 남긴다 (화면은 이것만 읽는다)
export function probe(W: World, k: 'mkt' | 'riv', id = ''): Probe | null {
  if (probesLeft(W) <= 0) return null;
  const P0: Probe = { m: W.month, k, cost: k === 'mkt' ? CO.PROBE_MKT : CO.PROBE_RIV };
  if (k === 'mkt') P0.dem = (W.mat ? W.mat.dem.filter(d => d.until >= W.month) : []).map(d => ({ ...d }));
  else {
    const i = W.cos.findIndex(c => c.id === id && c.style !== 'player' && c.style !== 'crowd'); if (i < 0) return null;
    const P = aiPlan(W, i); P0.id = id; P0.parties = [...P.parties]; P0.hire = [...P.hire]; P0.guide = [...P.guide];
  }
  (W.probes || (W.probes = [])).push(P0);
  W.probes = W.probes.filter(x => x.m >= W.month - 6);
  return P0;
}
export const toolCost = (P: Plan) => P.parties.reduce((a, n, f) => a + (n + P.hire[f]) * (CO.TOOL_COST[P.tool || 0] || 0), 0);
export const intelCost = (P: Plan) => SRCS.reduce((a, k) => a + Math.max(0, Math.floor((P.intel && P.intel[k]) || 0)), 0);

// ---------- 한 달 ----------
export function runMonth(W: World, playerPlan: Plan): MonthResult {
  const plans = W.cos.map((c, i) => (c.style === 'player' ? sanitize(W, c, playerPlan) : aiPlan(W, i)));
  // 계약 파티로 빌려 간 만큼 군소 용병대가 직접 보내는 파티가 준다
  const ci = W.cos.findIndex(c => c.style === 'crowd');
  // 군소 용병대가 가진 파티보다 많이 빌릴 수는 없다. 플레이어가 먼저 빌리고, 나머지는 순서대로 나눠 빌린다
  if (ci >= 0) { let free = maxParties(W.cos[ci]); plans.forEach(P => { P.hire = P.hire.map(h => { const x = Math.min(h, free); free -= x; return x; }); }); }
  const hiredAll = plans.reduce((a, P) => a + P.hire.reduce((s, v) => s + v, 0), 0);
  const fc = W.cos[0].crew ? forecast(W, plans[0]) : undefined;   // 결재 직전 어림 (굴리기 전에, 난수 없이)
  if (ci >= 0) { let cut = hiredAll; const P = plans[ci]; for (let f = 0; f < NF && cut > 0; f++) { const d = Math.min(cut, P.parties[f]); P.parties[f] -= d; cut -= d; } }
  // 보급 사기: 교회 성수는 찾은 만큼(한도 안에서), 상단 포션은 정한 만큼. 비워 둔 상단 칸은 쓸 만큼에서 창고와 교회 몫을 뺀 만큼
  const need = plans.map(P => needOf(P).pot), sups = W.cos.map(c => supOf(c));
  const reqH = plans.map(P => Math.max(0, Math.floor((P.buy && P.buy.holy) || 0)));
  const reqAll = reqH.reduce((a, b) => a + b, 0);
  const wt = reqH.map((q, i) => q * (0.5 + (W.cos[i].relC ?? 50) / 100)), wtAll = wt.reduce((a, b) => a + b, 0);
  const gotC = reqH.map((q, i) => (reqAll <= CO.CHURCH_CAP ? q : Math.min(q, Math.floor(CO.CHURCH_CAP * wt[i] / wtAll))));
  const have0 = W.cos.map(c => potsOf(c));
  const buyM = plans.map((P, i) => (P.buy && P.buy.pot != null ? Math.max(0, Math.floor(P.buy.pot)) : Math.max(0, need[i] - have0[i].pot - have0[i].holy - gotC[i])));
  const potQ = buyM.reduce((a, b) => a + b, 0) + gotC.reduce((a, b) => a + b, 0);
  // 포션 값: 상단은 수요를 따라, 교회는 정해진 값. 담합 중이면 둘 다 오르고, 교회가 빠졌으면 교회 값은 돌아온다
  const K = W.cartel;
  const potion = Math.round(potionPrice(potQ) * (K ? CO.CARTEL_MARKUP : 1));
  const potionC = Math.round(CO.POTION_C0 * (K ? CO.CARTEL_MARKUP : 1)), pc = W.cos.map((_, i) => churchPrice(W, i));
  // (교회 포션 나누기: 한도보다 많이 찾으면 교회와 사이가 좋은 용병단부터 더 받는다)
  // 산 것은 창고로 들어오고, 탐험에는 창고에서 꺼낸다. 모자라면 층마다 조당 포션을 같은 비율로 줄인다. 성수부터 쓴다
  const gearB = W.cos.map((c, i) => gearBuy(c, plans[i]));
  const potUse = W.cos.map((c, i) => {
    const S = sups[i]; S.pot[0] = (S.pot[0] || 0) + buyM[i]; S.holy[0] = (S.holy[0] || 0) + gotC[i];
    Object.entries(gearB[i]).forEach(([g, n]) => { S.gear[g] = (S.gear[g] || 0) + n; });
    const P = plans[i], have = sumOf(S.pot) + sumOf(S.holy);
    if (need[i] > have) { const r = have / need[i]; P.pots = P.pots.map(v => Math.floor(v * r)); }
    // 조마다 들고 가는 상한만 정해 두고, 실제로 쓴 만큼은 탐험이 끝난 뒤 창고에서 뺀다 (성수부터)
    return { used: 0, h: 0, holyLeft: sumOf(S.holy), short: Math.max(0, need[i] - needOf(P).pot) };
  });
  // 장비: 이번 달 들고 나갈 수 있는 벌 수 (한 벌은 조 하나만)
  const gearLeft = sups.map(S => ({ ...S.gear }));
  const res: CoResult[] = W.cos.map(() => ({ sent: zeros(), hired: zeros(), ok: zeros(), got: zeros(), deaths: 0, sold: zeros(), sales: 0,
    win: zeros(), hurt: 0,
    spend: { sortie: 0, potion: 0, wage: 0, train: 0, base: 0, hire: 0, recruit: 0, donate: 0, root: 0, tool: 0, proc: 0, intel: 0, gear: 0, probe: 0, dorm: 0, heal: 0 }, net: 0, recruited: 0, potNeed: 0, potC: 0, dF: zeros(),
    recruitWant: 0, recruitPrice: 0, rookDone: 0, rookDead: 0,
    matSold: {} as Record<string, number>, matSales: 0, potSpoil: 0, potUsed: 0, potShort: 0, gearUsed: {} as Record<string, number>, gearLost: {} as Record<string, number> }));
  const bookOld = W.mat ? W.mat.book.map(B => new Set(Object.keys(B.got).filter(m => B.got[m]['*'] > 0))) : null;
  // 현장 기록은 오래된 것일수록 흐려진다 (몬스터가 바뀌면 옛 기록이 덜 속이게)
  W.obs.forEach(o => Object.values(o).forEach(v => { v.n *= CO.OBS_FADE; v.w *= CO.OBS_FADE; }));
  const floors: MonthResult['floors'] = [], ours: MonthResult['ours'] = [];
  let deepWins = 0;
  // 수습: 조마다 낀 수습 번호, 이번 달 죽은 수습
  const slots = W.cos.map((c, i) => rookSlots(c, plans[i])), rookDead = W.cos.map(() => new Set<number>());
  // 우리 조: 명단에서 조마다 누가 가는지, 이번 달 죽은 단원, 사람 수만큼 센 성공(캐 오는 양에 쓴다)
  const crewMap = W.cos.map(c => new Map((c.crew || []).map(x => [x.id, x] as [number, Person]))), deadP = W.cos.map(() => new Set<number>()), hurtP = W.cos.map(() => new Set<number>());
  const teamsF = plans.map(P => FLOORS.map((_, f) => (P.teams ? P.teams.filter(T => T.f === f) : null)));
  const lootW = FLOORS.map(() => W.cos.map(() => 0));
  const keyHit = new Set<number>();   // 우리 조가 약점을 제대로 갖춰 들어간 층 (직업이면 두 명, 장비면 한 벌)
  FLOORS.forEach((F, f) => {
    const crowd = plans.reduce((a, P) => a + P.parties[f] + P.hire[f], 0);
    const mon = MONSTERS[W.mons[f]], key = keyOf(W, f), seen = { good: false, bad: false }, sealed = rootOf(W, f).done === 'seal';
    const mons = floorMons(W, f), full = W.pool[f] / Math.max(1, floorMax(W, f)), B = W.mat ? W.mat.book[f] : null;
    const wins = W.cos.map((c, i) => {
      const P = plans[i], n = P.parties[f] + P.hire[f], p = succRate(c, f, P.pots[f], crowd);
      let w = 0, d = 0, h = 0, okN = 0;
      for (let q = 0; q < n; q++) {
        // 파티마다 직업 넷과 장비 하나가 섞여 들어간다. 편성대로 챙길 직업은 꼭 넣고, 장비는 창고에 남은 벌이 있어야 들고 간다
        const kit = kitOf(P, f, q);
        let gk = kit.g, gearOut = '';
        const gp = guideParts(gk).find(x => x.startsWith('g:'));
        if (gp) { const gname = gp.slice(2); if ((gearLeft[i][gname] || 0) > 0) { gearLeft[i][gname]--; gearOut = gname; } else gk = guideParts(gk).filter(x => x !== gp).join('+'); }
        // 우리 조는 짠 사람들 그대로 간다 (빈자리는 빈 채로). 경쟁 용병단과 계약 파티는 직업이 섞여 들어간다
        const TT = q < P.parties[f] && teamsF[i][f] ? teamsF[i][f]![q] : null;
        const who = TT ? TT.m.filter((x): x is number => x != null).map(id => crewMap[i].get(id)).filter((x): x is Person => !!x) : null;
        const rolled = who ? null : rollCrew(gk), cls = who ? who.map(x => x.c) : rolled!.cls;
        const keys = who ? [...new Set(cls.map(x => 'c:' + x)), ...(gearOut ? ['g:' + gearOut] : [])] : rolled!.keys;
        // 직업 약점은 사람 수로 따진다: 그 직업 한 명이면 절반, 둘이면 다 (역효과도 같다). 장비는 들고 갔으면 다
        const share = (k: string) => (!keys.includes(k) ? 0 : k.startsWith('c:') ? Math.min(2, cls.filter(x => 'c:' + x === k).length) / 2 : 1);
        const kw = share(key), bw = share(mon.bad), hasKey = kw >= 1, hasBad = bw > 0;
        const rk = q < P.parties[f] && !who ? slots[i][f][q] : [], size = who ? who.length : CO.PARTY;
        const rooks = who ? who.filter(isRook).length : rk.length;
        // 성공 정도: 조원마다 그 조의 성공률로 굴린다. 해낸 사람 비율만큼 캐 오고, 둘 이상 해내면(고전 이상) 해낸 조로 친다
        const pp = clamp(p + kw * CO.KEY_BONUS - bw * CO.BAD_PEN + (sealed && c.style === 'player' ? CO.SEAL_SUCC : 0) - rooks * CO.ROOK_PEN - (CO.PARTY - size) * CO.SHORT_PEN, 0.05, 0.97);
        const did = Array.from({ length: size }, () => rnd() < pp), k = did.filter(Boolean).length, ok = k >= 2;
        // 수습은 자기가 해낸 만큼 겪는다 (경쟁 용병단의 수습은 앞자리부터 끼어 있다)
        if (c.rook) rk.forEach((t, m) => { if (did[m]) c.rook![t]++; });
        if (who) who.forEach((x, m) => { if (isRook(x) && did[m]) x.rk = (x.rk || 0) + 1; });
        lootW[f][i] += k / CO.PARTY; w += k / CO.PARTY;
        if (ok) okN++;
        let dq = 0, hq = 0;
        // 직영 파티는 만난 몬스터를 갈무리한다 (해낸 사람 비율만큼 덜 나온다)
        const got: [string, number][] = [];
        if (k && q < P.parties[f]) mons.forEach(m => m.mats.forEach(x => {
          if (rnd() >= matChance(x, keys, full) * k / CO.PARTY) return;
          const n = x.k ? x.k[0] + Math.floor(rnd() * (x.k[1] - x.k[0] + 1)) : 1;
          got.push([x.n, n]); res[i].matSold[x.n] = (res[i].matSold[x.n] || 0) + n;
        }));
        if (gearOut) {
          const r = res[i]; r.gearUsed[gearOut] = (r.gearUsed[gearOut] || 0) + 1;
          if (rnd() < (ok ? CO.GEAR_BREAK : CO.GEAR_LOST)) { r.gearLost[gearOut] = (r.gearLost[gearOut] || 0) + 1; sups[i].gear[gearOut]--; }
        }
        if (W.keyUse && (who ? hasKey : guideParts(gk).includes(key))) W.keyUse[f]++;
        // 위기: 사람마다 따로 맞는다 (못 해낸 사람은 크게, 해낸 사람은 작게). 위기마다 들고 간 포션을 한 병 쓴다.
        // 포션이 있으면 대개 다치고 층의 harm만큼만 죽는다 (성수는 그보다 덜). 포션이 없으면 CRISIS_DEATH만큼 죽는다.
        // 다친 사람은 다음 달 한 달 쉰다 (계약 파티의 사망 · 부상은 그들 몫)
        let crisis = 0, potsIn = P.pots[f], pu = 0;
        for (let m = 0; m < size; m++) {
          if (rnd() >= Math.min(0.95, F.risk * (did[m] ? CO.CRISIS_OK : CO.CRISIS_FAIL))) continue;
          crisis++;
          let die = CO.CRISIS_DEATH, hurt = 1;
          if (potsIn > 0) {
            potsIn--; pu++; potUse[i].used++;
            const holyNow = potUse[i].holyLeft > 0; if (holyNow) { potUse[i].holyLeft--; potUse[i].h++; }
            die = F.harm * (holyNow ? 1 - CO.HOLY : 1); hurt = CO.INJURE;
          }
          if (q >= P.parties[f]) continue;
          const roll = rnd();
          if (roll >= die + (1 - die) * hurt) continue;   // 포션으로 버텼다
          if (roll < die) {
            if (who) { deadP[i].add(who[m].id); dq++; continue; }
            // 죽은 사람이 수습일 수도 있다 (앞자리가 수습)
            if (m < rk.length) rookDead[i].add(rk[m]);
            dq++;
          } else { hq++; if (who) hurtP[i].add(who[m].id); }
        }
        d += dq; h += hq;
        // 우리 직영 파티만 무엇을 갖추고 갔고 어떻게 됐는지 기록해 온다 (현장 기록은 해낸 사람 비율로 센다)
        if (c.style === 'player' && q < P.parties[f]) {
          ['*', ...keys].forEach(kk => { const o = W.obs[f][kk] || (W.obs[f][kk] = { n: 0, w: 0 }); o.n++; o.w += k / size; });   // '*'는 그 층 전체
          const first = got.filter(([m]) => bookOld && !bookOld[f].has(m) && !ours.some(o => o.mats.some(g => g[0] === m))).map(([m]) => m);
          ours.push({ f, keys, ok, d: dq, mats: got, first, kit: kit.k, g: gk, crisis, pots: pu, n: size, k, hurt: hq });
          if (ok && B) {
            const cs = ['*', ...condsOf(keys)];
            cs.forEach(kk => { B.n[kk] = (B.n[kk] || 0) + 1; });
            got.forEach(([m]) => { const g = B.got[m] || (B.got[m] = {}); cs.forEach(kk => { g[kk] = (g[kk] || 0) + 1; }); });
          }
          if (ok && hasKey) seen.good = true;
          if (hasKey) keyHit.add(f);
          if (!ok && hasBad) seen.bad = true;
        }
      }
      res[i].sent[f] = P.parties[f]; res[i].hired[f] = P.hire[f]; res[i].ok[f] = okN; res[i].win[f] = w; res[i].deaths += d; res[i].dF[f] = d; res[i].hurt += h;
      return w;
    });
    if (f === W.unlocked - 1) deepWins = wins.reduce((a, b) => a + b, 0);
    if (plans[0].parties[f]) testimony(W, f, seen);
    const mined = rootOf(W, f).done === 'mine';
    // 성공 한 번에 캐 오는 양: 층의 기본 양 × 전리품 비율(숙련·갈무리장·장비) + 거점 2단계 + 채굴장
    // 성공한 조가 캐 오는 양 (빈자리가 있던 조는 사람 수만큼만)
    const want = W.cos.map((c, i) => lootW[f][i] * (F.take * lootMul(c, f, plans[i].tool || 0) + Math.floor(Math.min(CO.BASE_MAX, c.bases[f]) / 2) * CO.BASE_TAKE + (mined && c.style === 'player' ? CO.MINE_TAKE : 0)));
    W.cos.forEach((c, i) => { if (c.exp) c.exp[f] += wins[i]; });
    const total = want.reduce((a, b) => a + b, 0), before = W.pool[f], k = total ? Math.min(1, before / total) : 0;
    // 손에 쥐는 양은 몫보다 조금 적을 수 있다 (흘리고 깨뜨린다). 몫을 넘지는 않아서 층에 남은 양을 넘겨 캐지 못한다
    W.cos.forEach((c, i) => { res[i].got[f] = Math.floor(want[i] * k * (0.85 + 0.15 * rnd())); });
    const taken = res.reduce((a, r) => a + r.got[f], 0);
    floors.push({ before, taken, crowd, cut: k });
    W.pool[f] = before - taken;
    W.pool[f] = Math.min(W.pool[f], floorMax(W, f));
    W.pool[f] += Math.round((floorMax(W, f) - W.pool[f]) * CO.REGEN);
  });
  // 탐험에서 실제로 쓴 포션만 창고에서 뺀다 (성수부터)
  potUse.forEach((u, i) => { takeOld(sups[i].holy, u.h); takeOld(sups[i].pot, u.used - u.h); });
  const overflow = depths(W, plans, res, floors, keyHit);
  adapt(W);
  // 계약 파티가 캔 것 중 그들 몫은 군소 용병대가 판다
  const sold = res.map(r => [...r.got]);
  if (ci >= 0) W.cos.forEach((_, i) => {
    if (i === ci) return;
    FLOORS.forEach((_, f) => {
      const P = plans[i], n = P.parties[f] + P.hire[f]; if (!P.hire[f] || !n) return;
      const share = Math.floor(res[i].got[f] * P.hire[f] / n * CO.HIRE_CUT);
      res[i].got[f] -= share; sold[i][f] -= share; sold[ci][f] += share;
    });
  });
  // 판매: 캐 온 것은 창고에 두지 않고 그달에 모두 판다. 모두가 같은 시세에 판다
  const Q = ITEMS.map((_, j) => sold.reduce((a, x) => a + x[j], 0));
  const price = ITEMS.map((it, j) => priceOf(it, Q[j]));
  // 소재: 모두 정산 때 판다. 시세는 기준 값 × 찾는 곳 웃돈 × 물량
  const MT = W.mat, mats = allMats(W), matP: Record<string, number> = {}, matRef: Record<string, number> = {};
  mats.forEach(x => {
    const Qm = res.reduce((a, r) => a + (r.matSold[x.n] || 0), 0);
    matRef[x.n] = MT && MT.ref[x.n] ? MT.ref[x.n] : x.val;
    if (!Qm) return;
    matP[x.n] = matPrice(x.val, demandMul(W, x.n), Qm, MT ? MT.avgQ[x.n] : undefined);
    if (MT) { MT.avgQ[x.n] = MT.avgQ[x.n] ? MT.avgQ[x.n] * (1 - CO.MAT_FLOW) + Qm * CO.MAT_FLOW : Qm; MT.ref[x.n] = Math.round(matRef[x.n] * (1 - CO.MAT_FLOW) + matP[x.n] * CO.MAT_FLOW); }
  });
  res.forEach(r => { r.matSales = Object.entries(r.matSold).reduce((a, [m, n]) => a + n * (matP[m] || 0), 0); r.sales += r.matSales; });
  // 숙소: 지난달 증축한 침상이 생긴다. 신입은 빈 침상(이번 달 죽은 자리 포함)까지 찾고, 마을 지원자를 모두가 나눠 갖는다
  W.cos.forEach(c => { if (c.pendingBeds) { c.beds = bedsOf(c) + c.pendingBeds; c.pendingBeds = 0; } });
  const apps = W.apps ?? CO.APP0;
  // 우리는 직업을 골라 뽑는다 (그 직업 지원자의 몫까지)
  const rWantC = W.cos.map((c, i) => (c.crew ? recruitWants(c, plans[i], Math.max(0, bedsOf(c) - (c.members - res[i].deaths)), apps) : null));
  const rWant = W.cos.map((c, i) => {
    if (c.style === 'crowd') return 0;
    if (rWantC[i]) return Object.values(rWantC[i]!).reduce((a, b) => a + b, 0);
    const room = Math.max(0, bedsOf(c) - (c.members - res[i].deaths)), P = plans[i];
    return P.recruit == null ? room : clamp(Math.floor(P.recruit), 0, room);
  });
  const rGot = shareOut(rWant, W.cos.map(c => 1 + (c.fame || 0) / CO.FAME_K), apps);
  const rPrice = recruitPrice(rWant.reduce((a, b) => a + b, 0), apps);
  W.cos.forEach((c, i) => {
    const P = plans[i], r = res[i];
    // 상단 경매장(가죽·마석)은 단골을 조금 더 쳐준다: 상단과의 사이에 따라 ±5%
    const favor = (j: number) => (j <= 1 ? 1 + ((c.relM ?? 50) - 50) / 1000 : 1);
    ITEMS.forEach((_, j) => { r.sold[j] = sold[i][j]; r.sales += Math.round(sold[i][j] * price[j] * favor(j)); });
    // 보급 창고를 한 달 묵힌다: 기한을 넘긴 포션 묶음은 상해서 버린다
    const S = supOf(c); r.potSpoil = ageLots(S.pot, CO.POT_KEEP) + ageLots(S.holy, CO.HOLY_KEEP);
    const pot = gotC[i] * pc[i] + buyM[i] * potion;
    const sortie = sortieCost(P).reduce((a, b) => a + b, 0);
    r.potNeed = buyM[i] + gotC[i]; r.potC = gotC[i]; r.potUsed = potUse[i].used; r.potShort = potUse[i].short;
    // 신입: 찾은 만큼 중 지원자에서 받은 만큼. 모두 같은 값을 낸다 (군소 용병대는 따로)
    r.recruitWant = rWant[i]; r.recruited = rGot[i]; r.recruitPrice = rPrice;
    // 직업별로: 찾은 직업을 돌아가며 받은 수만큼 채운다. 드문 직업은 값이 더 든다
    let rCost = r.recruited * rPrice;
    if (rWantC[i]) {
      const want = { ...rWantC[i]! }, got: Record<string, number> = {};
      for (let k = 0; k < r.recruited;) { let any = false; for (const cls of CLASSES) { if (k < r.recruited && (want[cls] || 0) > 0) { want[cls]--; got[cls] = (got[cls] || 0) + 1; k++; any = true; } } if (!any) break; }
      r.recruitC = got; rCost = Object.entries(got).reduce((a, [cls, n]) => a + n * Math.round(rPrice * (CO.CLASS_COST[cls] || 1)), 0);
    }
    // 숙소: 침상 유지비와 증축 값 (공사 중엔 더 짓지 않는다)
    const build = c.style !== 'crowd' && P.dorm && !c.pendingBeds ? dormCost(c) : 0;
    r.spend = { sortie, potion: pot, wage: wageOf(c.members), train: P.train, base: P.base ? P.base.amt : 0, hire: hireCost(P), recruit: rCost, donate: Math.max(0, Math.floor(P.donate || 0)), root: P.root ? P.root.seal + P.root.mine : 0,
      tool: toolCost(P), proc: Math.max(0, Math.floor(P.proc || 0)), intel: c.style === 'player' ? intelCost(P) : 0,
      gear: Object.values(gearB[i]).reduce((a, b) => a + b, 0) * CO.GEAR_PRICE, probe: c.style === 'player' ? probeCost(W) : 0,
      dorm: c.style === 'crowd' ? 0 : dormKeep(bedsOf(c)) + build, heal: r.hurt * CO.HEAL_COST };
    if (build) { c.pendingBeds = CO.DORM_ADD; c.dorms = (c.dorms || 0) + 1; }
    r.net = r.sales - Object.values(r.spend).reduce((a, b) => a + b, 0);
    c.cash += r.net;
    c.losses = r.net < 0 ? c.losses + 1 : 0;
    c.skill = c.skill * 0.95 + P.train / 200 * CO.SIZE_REF / Math.max(CO.SIZE_REF / 2, c.members);
    if (c.pendingBase) { c.bases[c.pendingBase.f] += c.pendingBase.amt / CO.BASE_STEP; c.pendingBase = null; }
    // 갈무리장: 이번 달 넣은 돈은 다음 달부터 효과가 난다
    if (c.pendingProc) { c.proc = (c.proc || 0) + c.pendingProc / CO.PROC_STEP; c.pendingProc = 0; }
    if (P.proc) c.pendingProc = Math.max(0, Math.floor(P.proc));
    if (P.base) c.pendingBase = { ...P.base };
  });
  // 단원: 죽은 만큼 줄고 뽑은 신입만큼 는다. 신입은 수습으로 들어오고, 성공을 ROOK_WINS번 겪은 수습은 대원이 된다.
  // 명성은 성공한 층만큼 오르고 사망만큼 깎인다. 군소 용병대는 벌이가 좋으면 몰려오고 나쁘면 떠난다
  W.cos.forEach((c, i) => {
    const r = res[i];
    c.fame = Math.max(0, (c.fame || 0) * CO.FAME_FADE + r.win.reduce((a, n, f) => a + n * CO.FAME_F[f], 0) - r.deaths * CO.FAME_DEATH);
    if (c.style === 'crowd') {
      const sent = r.sent.reduce((a, b) => a + b, 0) || 1;
      c.members = clamp(c.members - r.deaths + Math.round(r.net / sent / 25) * CO.PARTY, 16, 200);
      c.cash = 0;   // 군소 용병대는 버는 대로 쓴다
      return;
    }
    if (c.crew) {
      // 우리 명단: 죽은 사람을 빼고(범람처럼 누군지 모르는 사망은 아무나), 세 번 겪은 수습은 대원이 되고, 신입은 수습으로 들어온다
      let crew = c.crew.filter(x => !deadP[i].has(x.id));
      // 쉬던 부상자는 돌아오고, 이번 달 다친 사람은 다음 달 쉰다
      crew.forEach(x => { if (x.hurt) { x.hurt--; if (!x.hurt) delete x.hurt; } if (hurtP[i].has(x.id)) x.hurt = 1; });
      for (let extra = r.deaths - deadP[i].size; extra > 0 && crew.length; extra--) crew.splice(Math.floor(rnd() * crew.length), 1);
      r.rookDead = c.crew.filter(x => isRook(x) && !crew.includes(x)).length;
      r.rookDone = crew.filter(x => isRook(x) && x.rk! >= CO.ROOK_WINS).length;
      crew.forEach(x => { if (isRook(x) && x.rk! >= CO.ROOK_WINS) delete x.rk; });
      Object.entries(r.recruitC || {}).forEach(([cls, n]) => { for (let k = 0; k < n; k++) crew.push({ id: c.nextId = (c.nextId || crew.length) + 1, c: cls, rk: 0 }); });
      c.crew = crew; c.members = crew.length;
      return;
    }
    c.hurtN = r.hurt;   // 경쟁 용병단은 다친 수만큼 다음 달 조를 덜 보낸다
    const rook = (c.rook || []).filter((_, t) => !rookDead[i].has(t));
    r.rookDead = (c.rook || []).length - rook.length;
    const stay = rook.filter(w => w < CO.ROOK_WINS);
    r.rookDone = rook.length - stay.length;
    c.members = Math.max(4, c.members - r.deaths + r.recruited);
    c.rook = [...stay, ...Array.from({ length: r.recruited }, () => 0)].slice(-c.members);
  });
  politics(W, plans, res, potQ);
  fundRoot(W, plans[0]);
  fundIntel(W, plans[0]);
  // 경쟁 용병단은 한 층에 오래 드나들수록 그 층의 약점을 깨친다. 깨친 소문은 신문에 새어 나온다
  W.cos.forEach((c, i) => {
    const at = LEARN_AT[c.style]; if (!at || !c.know) return;
    FLOORS.forEach((F, f) => {
      if (!plans[i].parties[f] || c.learned[f]) return;
      if (++c.know[f] >= at) { c.learned[f] = true; const k = keyOf(W, f); W.log.push({ m: W.month, t: `${c.name} 파티들이 ${F.name}에 ${keyWord(k)}${eulOf(keyWord(k))} 챙겨 들어가기 시작했다는 말이 돈다.` }); }
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
  const M: MonthResult = { month: W.month, res, plans, Q, price, potion, potQ, potionC, cartel: !!K, floors, perParty, opened, rank, ours, pressure: Math.round(W.pressure || 0), overflow, matPrice: matP, matRef, apps, fc };
  W.last = M; W.history.push(M); W.month++;
  // 다음 달 마을 지원자: 미궁 벌이가 좋을수록 많이 몰려온다
  W.apps = Math.round((CO.APP_BASE + CO.APP_PER * res.reduce((a, r) => a + r.sales, 0) / 1000) * (0.8 + 0.4 * rnd()));
  demands(W);
  estimate(W);
  return M;
}

// 찾는 곳: 열린 층의 소재 중 하나를 누군가 몇 달 동안 값을 더 쳐주고 찾는다. 흔한 것보다 드문 것을 더 자주 찾는다
function demands(W: World) {
  const MT = W.mat; if (!MT) return;
  MT.dem = MT.dem.filter(d => d.until >= W.month);
  if (MT.dem.length >= CO.DEM_MAX || rnd() >= CO.DEM_CHANCE) return;
  const pool = allMats(W).filter(x => x.f < W.unlocked && !MT.dem.some(d => d.m === x.n));
  if (!pool.length) return;
  const x = pickW(pool, pool.map(m => (m.p >= 0.5 ? 1 : 2))), who = Math.floor(rnd() * BUYERS.length);
  const mul = Math.round((CO.DEM_MUL[0] + rnd() * (CO.DEM_MUL[1] - CO.DEM_MUL[0])) * 20) / 20;
  const len = CO.DEM_LEN[0] + Math.floor(rnd() * (CO.DEM_LEN[1] - CO.DEM_LEN[0] + 1));
  MT.dem.push({ m: x.n, who, mul, at: W.month, until: W.month + len - 1 });
}

// 몬스터 적응: 약점대로 갖춘 파티가 오래 몰리면 그 층 몬스터의 약점이 바뀐다. 경쟁 용병단은 다시 깨쳐야 하고,
// 바뀌었다는 것은 처음엔 막연한 말로만 돈다 (정확한 달은 귀환 보고 3단계 × 교회 기록 2단계로 안다)
function adapt(W: World) {
  if (!W.keys || !W.keyUse || !W.adapted) return;
  FLOORS.forEach((F, f) => {
    if (W.adapted![f] || W.keyUse![f] < CO.ADAPT_AT) return;
    const mon = MONSTERS[W.mons[f]];
    W.keys![f] = mon.alt; W.adapted![f] = W.month;
    W.cos.forEach(c => { if (c.learned) c.learned[f] = false; if (c.know) c.know[f] = 0; });
    W.log.push({ m: W.month, t: `${F.name}에서 예전 공략이 잘 먹히지 않는다는 말이 돈다.` });
  });
}

// 정보망: 출처마다 이번 달 정보비로 단계를 지키거나 올린다. 정보원은 단계만큼의 경쟁 용병단에 붙는다
function fundIntel(W: World, P: Plan) {
  const I = W.intel, c = us(W); if (!I) return;
  SRCS.forEach(k => {
    const b = Math.max(0, Math.floor((P.intel && P.intel[k]) || 0)), lv = I.lv[k], keep = INTEL.KEEP[k][lv];
    const relOk = (to: number) => !INTEL.GATE || to < 2 || (k === 'mkt' ? (c.relM ?? 50) >= INTEL.REL : k === 'chu' ? (c.relC ?? 50) >= INTEL.REL : true);
    if (b < keep) { I.lv[k] = Math.max(INTEL.BASE[k], lv - 1); I.acc[k] = 0; return; }
    if (lv >= 2 && !relOk(lv)) { I.lv[k] = 1; I.acc[k] = 0; return; }
    // 다음 단계에 필요한 만큼까지만 쌓인다 (사이가 모자라 막혀 있으면 그 이상 쌓이지 않는다)
    if (lv < 3) I.acc[k] = Math.min(INTEL.UP[k][lv], I.acc[k] + b - keep);
    if (lv < 3 && I.acc[k] >= INTEL.UP[k][lv] && relOk(lv + 1)) { I.lv[k] = lv + 1; I.acc[k] = 0; }
  });
  const named = W.cos.filter(x => x.style !== 'player' && x.style !== 'crowd').map(x => x.id);
  const want = (P.spyOn || []).filter(id => named.includes(id));
  const next = want.slice(0, I.lv.spy);
  const ten: Record<string, number> = {};
  next.forEach(id => { ten[id] = (I.tenure[id] || 0) + 1; });
  I.spyOn = next; I.tenure = ten;
}

// 짐작: 매달 말, 다음 달 층에 남은 양과 경쟁 용병단의 다음 달 파티 수를 정보망 단계만큼의 폭으로 짐작해 둔다.
// 참값은 짐작의 폭 안에 든다. 정보원 1단계는 가끔 엉뚱한 계획을 물어 온다
function estimate(W: World) {
  const I = W.intel; if (!I) return;
  const lv = I.lv, L = W.last;
  I.est.floors = FLOORS.map((F, f) => {
    if (f >= W.unlocked) return null;
    const truth = Math.round(W.pool[f] / Math.max(1, floorMax(W, f)) * 100);
    const visited = W.history.slice(-2).some(M => M.res[0].sent[f] > 0);
    let w = visited ? 50 : 90;
    if (lv.mkt >= 1) w *= 0.6;
    if (lv.mkt >= 2) w *= 0.4;
    w = Math.max(6, Math.round(w));
    const mid = clamp(Math.round(truth + (rnd() - 0.5) * w * 0.6), 0, 100);
    return { lo: clamp(mid - Math.round(w / 2), 0, 100), hi: clamp(mid + Math.round(w / 2), 0, 100), mid };
  });
  const rivals: Intel['est']['rivals'] = {};
  W.cos.forEach((c, i) => {
    if (c.style === 'player' || c.style === 'crowd') return;
    const P = aiPlan(W, i), next = FLOORS.map((_, f) => P.parties[f] + P.hire[f]);
    const spied = I.spyOn.includes(c.id), last = L ? L.res[i].sent.map((n, f) => n + L.res[i].hired[f]) : null;
    let lie = spied && lv.spy === 1 && rnd() < 0.25 ? Math.floor(rnd() * Math.max(1, W.unlocked)) : -1;
    rivals[c.id] = FLOORS.map((_, f) => {
      if (f >= W.unlocked) return null;
      if (spied) {
        let w = [3, 3, 2, 1][lv.spy] - ((I.tenure[c.id] || 0) >= 6 ? 1 : 0);
        if (lv.mkt >= 3 && lv.spy >= 2) w = 0;
        return { mid: Math.max(0, next[f] + (f === lie ? (rnd() < 0.5 ? -3 : 3) : 0)), w: Math.max(0, w) };
      }
      if (lv.mkt >= 3) return { mid: next[f], w: 2 };
      if (lv.gate >= 2 && last) return { mid: last[f], w: 4 };
      return null;
    });
  });
  I.est.rivals = rivals;
  // 마을 지원자: 관문 기록 1단계는 ±35%, 2단계는 ±15%, 3단계는 정확히. 참값은 폭 안에 든다
  const A = W.apps ?? CO.APP0, aw = [0.5, 0.35, 0.15, 0][lv.gate] * A;
  const amid = A + (rnd() - 0.5) * aw;
  I.est.apps = { lo: Math.max(0, Math.round(Math.min(A, amid - aw / 2))), hi: Math.round(Math.max(A, amid + aw / 2)) };
}

// 플레이어 결정표를 규칙 안으로 맞춘다: 열린 층만, 단원 수만큼, 계약 파티는 군소 용병대가 가진 만큼
export function sanitize(W: World, c: Company, P: Plan): Plan {
  const Q: Plan = JSON.parse(JSON.stringify(P));
  Q.parties = Q.parties.map((n, f) => (f < W.unlocked ? Math.max(0, Math.floor(n)) : 0));
  let over = Q.parties.reduce((a, b) => a + b, 0) - maxParties(c);
  for (let f = 0; f < NF && over > 0; f++) { const d = Math.min(over, Q.parties[f]); Q.parties[f] -= d; over -= d; }
  const crowd = W.cos.find(x => x.style === 'crowd');
  let free = crowd ? maxParties(crowd) : 0;
  Q.hire = Q.hire.map((n, f) => { const h = f < W.unlocked ? clamp(Math.floor(n), 0, free) : 0; free -= h; return h; });
  Q.pots = Q.pots.map(v => clamp(Math.floor(v), 1, 8));
  Q.train = Math.max(0, Math.floor(Q.train));
  Q.donate = Math.max(0, Math.floor(Q.donate || 0));
  Q.tool = clamp(Math.floor(Q.tool || 0), 0, CO.TOOL_COST.length - 1);
  Q.proc = (c.proc || 0) + (c.pendingProc || 0) / CO.PROC_STEP >= CO.PROC_MAX ? 0 : Math.max(0, Math.floor(Q.proc || 0));
  if (Q.intelUp || Q.intelCut) {
    const lv = W.intel ? W.intel.lv : INTEL.BASE;
    Q.intel = Object.fromEntries(SRCS.map(k => [k, ((Q.intelCut || []).includes(k) ? 0 : INTEL.KEEP[k][lv[k]]) + Math.max(0, Math.floor((Q.intelUp && Q.intelUp[k]) || 0))]));
  }
  Q.intel = Object.fromEntries(SRCS.map(k => [k, Math.max(0, Math.floor((Q.intel && Q.intel[k]) || 0))]));
  const named = W.cos.filter(x => x.style !== 'player' && x.style !== 'crowd').map(x => x.id);
  Q.spyOn = [...new Set((Q.spyOn || []).filter(id => named.includes(id)))].slice(0, 3);
  // 근원 기금은 찾았고 아직 끝나지 않은 근원에만 넣는다
  const R = Q.root ? rootOf(W, Q.root.f) : null;
  Q.root = Q.root && R && R.found && !R.done ? { f: Q.root.f, seal: Math.max(0, Math.floor(Q.root.seal || 0)), mine: Math.max(0, Math.floor(Q.root.mine || 0)) } : null;
  if (Q.root && !Q.root.seal && !Q.root.mine) Q.root = null;
  // 지침은 직업 하나와 장비 하나까지
  Q.guide = FLOORS.map((_, f) => {
    if (!Q.guide || f >= W.unlocked) return '';
    const ps = guideParts(Q.guide[f]).filter(k => KEYS.includes(k));
    return [ps.find(k => k.startsWith('c:')), ps.find(k => k.startsWith('g:'))].filter(Boolean).join('+');
  });
  if (Q.base && (Q.base.amt <= 0 || Q.base.f >= W.unlocked)) Q.base = null;
  // 신입은 빈 침상까지 (비워 두면 빈 침상만큼), 증축은 공사 중이 아닐 때 한 채
  if (Q.recruit != null) Q.recruit = clamp(Math.floor(Q.recruit), 0, roomOf(c));
  Q.dorm = !!Q.dorm && !c.pendingBeds;
  // 편성 줄: 층마다 KIT_MAX줄까지, 줄의 조를 더해 그 층 우리 조를 넘지 않게
  if (Q.kits) Q.kits = FLOORS.map((_, f) => {
    let room = Q.parties[f];
    return ((Q.kits && Q.kits[f]) || []).slice(0, CO.KIT_MAX).map(x => {
      const n = clamp(Math.floor(x.n || 0), 0, room); room -= n;
      const ps = guideParts(x.g).filter(k => KEYS.includes(k));
      return { n, g: [ps.find(k => k.startsWith('c:')), ps.find(k => k.startsWith('g:'))].filter(Boolean).join('+') };
    });
  });
  if (Q.buy) {
    const g: Record<string, number> = {};
    Object.entries(Q.buy.gear || {}).forEach(([k, v]) => { if (GEARS.includes(k) && k !== '일반' && v != null) g[k] = Math.max(0, Math.floor(v)); });
    Q.buy = { pot: Q.buy.pot == null ? undefined : Math.max(0, Math.floor(Q.buy.pot)), holy: Math.max(0, Math.floor(Q.buy.holy || 0)), gear: g };
  }
  if (Q.recruitC) Q.recruitC = Object.fromEntries(CLASSES.map(k => [k, Math.max(0, Math.floor(Q.recruitC![k] || 0))]));
  // 우리 조 편성: 명단에 있는 사람만, 한 사람은 한 자리에만, 열린 층에만. 짜 둔 것이 없으면 기본 편성대로 짜고 남은 사람으로 채운다
  // (지침이 있는 층은 그 직업을 먼저 넣고 그 장비를 챙긴다). 조 수는 짠 조에서 다시 센다
  if (c.crew) {
    Q.tpl = [0, 1, 2, 3].map(s => { const x = (Q.tpl || CO.TPL0)[s] || ''; return CLASSES.includes(x) ? x : ''; });
    if (!Q.teams) {
      const ps = Q.guide.map(g => guideParts(g));
      Q.teams = formTeams(c, Q.parties, Q.tpl, true, ps.map(x => (x.find(k => k.startsWith('c:')) || '').slice(2)), ps.map(x => x.find(k => k.startsWith('g:')) || ''), Q.tplF || []);
    }
    const ids = new Set(c.crew.filter(x => !x.hurt).map(x => x.id)), seen = new Set<number>();
    Q.teams = Q.teams.filter(T => T.f >= 0 && T.f < W.unlocked).map(T => ({
      f: T.f, g: GEARS.includes((T.g || '').slice(2)) && T.g !== 'g:일반' ? T.g : '',
      m: [0, 1, 2, 3].map(s => { const id = T.m[s]; if (id == null || !ids.has(id) || seen.has(id)) return null; seen.add(id); return id; }),
    })).filter(T => T.m.some(x => x != null));
    Q.parties = FLOORS.map((_, f) => Q.teams!.filter(T => T.f === f).length);
    delete Q.kits;
  }
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

// 미궁의 압력과 근원: 모두가 꺼낸 만큼 미궁이 차오른다. 이상 징후가 먼저 돌고, 넘치면 범람한다.
// 우리 직영 파티는 약점대로 들어가 성공을 쌓으면 근원을 찾는다 (경쟁 용병단은 현장 기록을 가져오지 않아 찾지 못한다)
function depths(W: World, plans: Plan[], res: CoResult[], floors: MonthResult['floors'], keyHit: Set<number>) {
  const add = floors.reduce((a, F, f) => a + F.taken * ITEMS[f].P0 * pressOf(W, f), 0) / CO.PRESS_DIV;
  W.pressure = (W.pressure || 0) * (1 - CO.PRESS_DECAY) + add;
  const k = W.anoms || 0;
  if (k < CO.ANOM_AT.length && W.pressure >= CO.ANOM_AT[k]) {
    W.anoms = k + 1; W.anomN = (W.anomN || 0) + 1;
    W.log.push({ m: W.month, t: '이상 징후: ' + ANOMALIES[(W.anomN - 1) % ANOMALIES.length] });
  }
  let over = false;
  if (W.pressure >= CO.OVER && rnd() < CO.OVER_CHANCE) {
    over = true;
    // 1·2층에 있던 파티가 당한다. 계약 파티의 사망은 군소 용병대 몫이라 직영 파티만 센다
    let all = 0;
    W.cos.forEach((_, i) => {
      const n = plans[i].parties[0] + plans[i].parties[1];
      const d = Math.round(n * CO.PARTY * CO.OVER_KILL * (0.6 + 0.8 * rnd()));
      res[i].deaths += d; all += d;
    });
    [0, 1].forEach(f => { W.pool[f] = Math.round(W.pool[f] * CO.OVER_POOL); });
    W.pressure *= CO.OVER_LEFT; W.anoms = 0;
    W.log.push({ m: W.month, t: `범람: 깊은 층의 것들이 1·2층 야영지를 덮쳤다. 용병 ${all}명이 돌아오지 못했고, 두 층은 한동안 캘 것이 없다.` });
  }
  const P = plans[0];
  FLOORS.forEach((F, f) => {
    const R = rootOf(W, f), key = keyOf(W, f), o = W.obs[f][key];
    if (!W.roots || R.found || !P.parties[f] || !(P.teams ? keyHit.has(f) : kitsOn(P, f).some(g => guideParts(g).includes(key))) || !o || o.w < CO.ROOT_WINS) return;
    R.found = W.month;
    const n = W.roots.filter(r => r.found).length;
    W.notes.push({ m: W.month, f, t: `${MONSTERS[W.mons[f]].root} ${ROOT_LORE[Math.min(n, ROOT_LORE.length) - 1]}` });
    W.log.push({ m: W.month, t: `${F.name} 근원 발견: 회색늑대 용병단 파티가 ${F.name} 깊은 곳에서 몬스터가 생겨나는 곳을 찾았다.` });
  });
  return over;
}
// 근원 기금: 봉인 쪽이든 채굴장 쪽이든 먼저 ROOT_COST를 채운 쪽으로 정해진다
function fundRoot(W: World, P: Plan) {
  if (!P.root || !W.roots) return;
  const R = W.roots[P.root.f], F = FLOORS[P.root.f], c = us(W);
  if (!R || !R.found || R.done) return;
  R.seal += P.root.seal * (1 + CO.SEAL_MATCH); R.mine += P.root.mine;
  const top = Math.max(R.seal, R.mine);
  if (top < CO.ROOT_COST) return;
  R.done = R.seal >= R.mine ? 'seal' : 'mine'; R.at = W.month;
  if (R.done === 'seal') {
    W.pressure = Math.max(0, (W.pressure || 0) - CO.SEAL_DRAIN);
    c.relC = clamp((c.relC ?? 50) + 15, 0, 100);
    W.log.push({ m: W.month, t: `${F.name} 근원 봉인: 회색늑대 용병단이 ${F.name}의 근원을 막았다. 교회가 입구에서 미사를 올렸고, 상단은 그 층에서 나올 물건이 줄겠다며 셈을 다시 한다.` });
  } else {
    c.relM = clamp((c.relM ?? 50) + 10, 0, 100); c.relC = clamp((c.relC ?? 50) - 10, 0, 100);
    W.log.push({ m: W.month, t: `${F.name} 채굴장: 회색늑대 용병단이 ${F.name}의 근원 곁에 채굴장을 냈다. 상단은 반겼고, 교회는 말을 아꼈다.` });
  }
}

// 성공 정도: 해낸 사람 수로 (넷 다 대성공, 셋 성공, 둘 고전, 하나 이하 실패)
export const gradeOf = (k: number) => (k >= 4 ? '대성공' : k === 3 ? '성공' : k === 2 ? '고전' : '실패');
// 수입 어림: 우리 조마다 해낼 사람 수의 분포(이항)를 굴리지 않고 그대로 합쳐, 이번 달 전리품 · 소재 수입의 분포를 낸다.
// 성공률은 화면에 보이는 것(층 · 훈련 · 거점 · 수습 · 빈자리, 붐빔은 지난달 남들만큼)이고 약점과 역효과는 모른다고 본다.
// 값은 지난달 시세, 층에서 나눠 가진 몫은 지난달 우리 몫, 소재는 기록된 평소 값으로 어림한다. 상태를 쓰지 않고 난수도 쓰지 않는다
export function forecast(W: World, P: Plan): Forecast {
  const c = us(W), L = W.last, I = W.intel;
  let dead = 0, hurt = 0, maxV = 0, floorLoss = 0;
  const parts: { n: number; p: number; v: number }[] = [];
  FLOORS.forEach((F, f) => {
    const n = P.parties[f] + P.hire[f]; if (f >= W.unlocked || !n) return;
    const others = L ? L.plans.reduce((a, Q, i) => a + (i ? Q.parties[f] + Q.hire[f] : 0), 0) : 0;
    const p0 = succRate(c, f, P.pots[f], n + others) + (rootOf(W, f).done === 'seal' ? CO.SEAL_SUCC : 0);
    // 층에서 나눠 가진 몫은 층 전체에 같다 (지난달 그 층에 모두가 캐려던 양 대비 층에 있던 양). 지난달 아무도 안 갔으면 다 가진다고 본다
    const cut = L && L.floors[f] && L.floors[f].cut ? Math.min(1, L.floors[f].cut!) : 1;
    const est = I && I.est.floors[f], full = est ? est.mid / 100 : 0.75;
    // 손에 쥐는 양은 몫의 85~100%(평균 0.925)이고 낱개로 내림한다 (층마다 평균 반 개쯤 덜 쥔다)
    const per = (F.take * lootMul(c, f, P.tool || 0) + Math.floor(Math.min(CO.BASE_MAX, c.bases[f]) / 2) * CO.BASE_TAKE + (rootOf(W, f).done === 'mine' ? CO.MINE_TAKE : 0)) * cut * 0.925 * W.price[f] / CO.PARTY;
    floorLoss += 0.5 * W.price[f];
    const crew = new Map((c.crew || []).map(x => [x.id, x])), mons = floorMons(W, f);
    const teams = P.teams ? P.teams.filter(T => T.f === f) : [];
    for (let q = 0; q < n; q++) {
      const T = q < P.parties[f] ? teams[q] : null, hired = q >= P.parties[f];
      const who = T ? T.m.filter((x): x is number => x != null).map(id => crew.get(id)).filter((x): x is Person => !!x) : null;
      const size = who ? who.length : CO.PARTY, rooks = who ? who.filter(isRook).length : 0;
      const pt = clamp(p0 - rooks * CO.ROOK_PEN - (CO.PARTY - size) * CO.SHORT_PEN, 0.05, 0.97);
      const keys = who ? [...new Set(who.map(x => 'c:' + x.c)), ...(T!.g ? [T!.g] : [])] : [];
      const mat = hired ? 0 : mons.reduce((a, M) => a + M.mats.reduce((b, x) => b + matChance(x, keys, full) / CO.PARTY * ((W.mat && W.mat.ref[x.n]) || x.val) * (x.k ? (x.k[0] + x.k[1]) / 2 : 1) * demandMul(W, x.n), 0), 0);
      parts.push({ n: size, p: pt, v: per * (hired ? 1 - CO.HIRE_CUT : 1) + mat });
      if (!hired) {
        const cp = pt * Math.min(0.95, F.risk * CO.CRISIS_OK) + (1 - pt) * Math.min(0.95, F.risk * CO.CRISIS_FAIL), die = P.pots[f] ? F.harm : CO.CRISIS_DEATH;
        dead += size * cp * die; hurt += size * cp * (1 - die) * (P.pots[f] ? CO.INJURE : 1);
      }
    }
  });
  maxV = parts.reduce((a, x) => a + x.n * x.v, 0);
  // 퍼뜨린 뒤 꼭대기를 넘어갈 자리까지 칸을 둔다
  const step = Math.max(10, Math.round(maxV / 240 / 10) * 10), NBIN = Math.ceil(maxV * 1.45 / step) + 2;
  // 조마다 이항 분포를 칸(step) 단위로 합친다 (배열로)
  let dist = new Float64Array(NBIN); dist[0] = 1; let hi = 0;
  parts.forEach(x => {
    const next = new Float64Array(NBIN);
    const pk = Array.from({ length: x.n + 1 }, (_, k) => binom(x.n, k) * Math.pow(x.p, k) * Math.pow(1 - x.p, x.n - k)), off = pk.map((_, k) => k * x.v / step);
    for (let b = 0; b <= hi; b++) { const pr = dist[b]; if (!pr) continue; for (let k = 0; k <= x.n; k++) { const nb = Math.min(NBIN - 1, Math.round(b + off[k])); next[nb] += pr * pk[k]; } }
    hi = Math.min(NBIN - 1, Math.ceil(hi + off[x.n]) + 1); dist = next;
  });
  // 낱개로 내림해 덜 쥐는 몫만큼 왼쪽으로 민다
  const sh = Math.round(floorLoss / step);
  if (sh) { const moved = new Float64Array(NBIN); for (let b = 0; b < NBIN; b++) moved[Math.max(0, b - sh)] += dist[b]; dist = moved; }
  // 시세와 붐빔도 달마다 흔들린다: 평균의 12% 폭으로 한 번 더 퍼뜨린다 (정규 분포를 칸 단위로)
  let mean = 0; for (let b = 0; b < NBIN; b++) mean += b * step * dist[b];
  const sdB = 0.12 * mean / step;
  if (sdB >= 0.5) {
    const R = Math.ceil(sdB * 2.5), ker = Array.from({ length: 2 * R + 1 }, (_, j) => Math.exp(-((j - R) ** 2) / (2 * sdB * sdB))), ks = ker.reduce((a, b) => a + b, 0);
    const spread = new Float64Array(NBIN);
    for (let b = 0; b < NBIN; b++) { const pr = dist[b]; if (pr < 1e-9) continue; for (let j = 0; j < ker.length; j++) spread[Math.min(NBIN - 1, Math.max(0, b + j - R))] += pr * ker[j] / ks; }
    dist = spread; mean = 0; for (let b = 0; b < NBIN; b++) mean += b * step * dist[b];
  }
  const q = (t: number) => { let acc = 0; for (let b = 0; b < NBIN; b++) { acc += dist[b]; if (acc >= t) return b * step; } return (NBIN - 1) * step; };
  // 그림용: 0부터 최대까지 24칸
  const NB = 24, width = Math.max(step, Math.ceil(((NBIN - 1) * step || 1) / NB / step) * step), bins = Array(NB).fill(0);
  for (let b = 0; b < NBIN; b++) if (dist[b]) bins[Math.min(NB - 1, Math.floor(b * step / width))] += dist[b];
  return { mean: Math.round(mean), p10: q(0.1), p50: q(0.5), p90: q(0.9), bins: bins.map(x => Math.round(x * 1000) / 1000), step: width, dead: Math.round(dead * 10) / 10, hurt: Math.round(hurt * 10) / 10 };
}
const binom = (n: number, k: number) => { let r = 1; for (let j = 1; j <= k; j++) r = r * (n - k + j) / j; return r; };
// 어림에서 이 값이 아래에서 몇 %쯤인가 (그림 칸으로 셈)
export const fcRank = (fc: Forecast, v: number) => { let acc = 0; for (let b = 0; b < fc.bins.length; b++) { const lo = b * fc.step; if (v < lo + fc.step) return Math.min(1, acc + fc.bins[b] * Math.max(0, (v - lo) / fc.step)); acc += fc.bins[b]; } return 1; };

// 하르덴 주민 어림: 용병 한 명마다 식구·대장장이·여관·짐꾼이 따라붙는다 (화면과 신문이 쓴다)
export const townOf = (W: World) => Math.round((600 + 6 * W.cos.reduce((a, c) => a + c.members, 0)) / 100) * 100;
// want만큼 찾는 이들에게 pool을 무게(want × wt)대로 나눈다. 다 줄 수 있으면 찾는 만큼, 모자라면 무게대로 (찾는 것보다 많이는 주지 않는다)
export function shareOut(want: number[], wt: number[], pool: number) {
  const got = want.map(() => 0);
  let left = Math.max(0, Math.floor(pool));
  if (want.reduce((a, b) => a + b, 0) <= left) return [...want];
  while (left > 0) {
    const open = want.map((w, i) => i).filter(i => got[i] < want[i]); if (!open.length) break;
    const ws = open.map(i => (want[i] - got[i]) * wt[i]), tot = ws.reduce((a, b) => a + b, 0);
    let given = 0;
    open.forEach((i, k) => { const n = Math.min(want[i] - got[i], Math.floor(left * ws[k] / tot)); got[i] += n; given += n; });
    // 나머지 한 명씩은 무게가 큰 쪽부터
    if (!given) { const k = ws.indexOf(Math.max(...ws)); got[open[k]]++; given = 1; }
    left -= given;
  }
  return got;
}
const eulOf = (w: string) => ((w.charCodeAt(w.length - 1) - 0xac00) % 28 ? '을' : '를');
const pickW = <T,>(xs: T[], ws: number[]) => { let x = rnd() * ws.reduce((a, b) => a + b, 0); for (let i = 0; i < xs.length; i++) { x -= ws[i]; if (x <= 0) return xs[i]; } return xs[xs.length - 1]; };
// 파티 하나의 구성: 직업 넷과 장비 하나. 지침(key)이 있으면 그것을 꼭 넣는다. 갖춘 것을 KEYS 꼴로 돌려준다
export function rollParty(guide = '') { return rollCrew(guide).keys; }
// 섞여 들어가는 파티의 직업 넷(겹칠 수 있다)과, 갖춘 것을 KEYS 꼴로
export function rollCrew(guide = '') {
  const cls = [0, 1, 2, 3].map(() => pickW(CLASSES, CLASS_SHARE));
  let gear = pickW(GEARS, GEAR_SHARE);
  guideParts(guide).forEach(g => {
    if (g.startsWith('c:') && !cls.includes(g.slice(2))) cls[0] = g.slice(2);
    if (g.startsWith('g:')) gear = g.slice(2);
  });
  return { cls, keys: [...new Set(cls.map(x => 'c:' + x)), ...(gear !== '일반' ? ['g:' + gear] : [])] };
}
// 현장 증언: 우리 파티가 다녀온 층에서 들은 말을 남긴다. 처음 가면 겉모습, 세 달째 더 자세한 겉모습,
// 약점을 갖춘 파티가 성공하거나 역효과를 갖춘 파티가 실패하면 그 이야기를 가끔 가져온다
function testimony(W: World, f: number, seen: { good: boolean; bad: boolean }) {
  const mon = MONSTERS[W.mons[f]], here = W.notes.filter(n => n.f === f), say = (t: string) => W.notes.push({ m: W.month, f, t });
  const visits = W.history.filter(M => M.res[0].sent[f] > 0).length + 1;
  if (!here.length) say(mon.look[0]);
  else if (visits >= 3 && !here.some(n => n.t === mon.look[1])) say(mon.look[1]);
  const recent = here.slice(-3).map(n => n.t);
  // 몬스터가 바뀐 뒤로는 새 약점 이야기가 들려온다
  const adapted = W.adapted && W.adapted[f];
  if (adapted && !here.some(n => n.t === mon.altSay) && rnd() < 0.5) say(mon.altSay);
  if (seen.good && rnd() < 0.5 && !recent.includes(mon.good) && !adapted) say(mon.good);
  if (seen.bad && rnd() < 0.5 && !recent.includes(mon.badSay)) say(mon.badSay);
}
export const keysAll = KEYS;

export const rankOf = (W: World, id = 'us') => (W.last ? W.last.rank.indexOf(id) + 1 : 0);

// 다음 달 결정표: 지난달에 고른 파티·포션·훈련·계약 파티는 그대로 두고, 단원 수와 열린 층에 맞춰 고친다.
// 거점 투자와 보급 사기는 한 번 나가는 돈이라 비운다
export function carryPlan(W: World, prev: Plan | null): Plan {
  if (!prev) return defaultPlan(W);
  const c = us(W), P: Plan = JSON.parse(JSON.stringify(prev));
  P.base = null; P.donate = 0; P.root = null; P.proc = 0; P.buy = {}; P.dorm = false;
  // 짜 둔 조는 그대로 두고 바뀐 것만 고친다: 없어진 사람의 자리는 비우고, 대기 중인 사람(새로 들어온 신입 등) 중 그 자리의 기본 편성 직업이 있으면 넣는다
  if (P.teams && c.crew) {
    const ids = new Set(c.crew.filter(x => !x.hurt).map(x => x.id)), tpl = P.tpl || CO.TPL0;
    P.teams = P.teams.filter(T => T.f < W.unlocked).map(T => ({ ...T, m: T.m.map(x => (x != null && ids.has(x) ? x : null)) }));
    const on = new Set(P.teams.flatMap(T => T.m)), bench = c.crew.filter(x => !on.has(x.id) && !x.hurt);
    P.teams.forEach(T => T.m.forEach((x, s) => { if (x == null) { const k = bench.findIndex(y => y.c === tpl[s]); if (k >= 0) T.m[s] = bench.splice(k, 1)[0].id; } }));
    P.teams = P.teams.filter(T => T.m.some(x => x != null));
    P.parties = FLOORS.map((_, f) => P.teams!.filter(T => T.f === f).length);
    return P;
  }
  P.parties = P.parties.map((n, f) => (f < W.unlocked ? n : 0));
  let over = P.parties.reduce((a, b) => a + b, 0) - maxParties(c);
  for (let f = 0; f < NF && over > 0; f++) { const d = Math.min(over, P.parties[f]); P.parties[f] -= d; over -= d; }
  return P;
}
