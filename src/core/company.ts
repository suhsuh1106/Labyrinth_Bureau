// 용병단 경영 (새 전제, docs/plan.md 1단계). 옛 관리국 규칙과 따로 돌아가는 엔진이다.
// 여러 용병단이 같은 층에서 전리품을 캐고 같은 시장에 판다. 층마다 캘 수 있는 양이 한정돼 몰리면 나눠 갖고,
// 모두가 같은 시세에 팔아서 다 같이 많이 팔면 값이 떨어진다. 플레이어는 그중 한 용병단의 행정관이다.
// 화면에 붙이기 전까지는 상태를 S가 아니라 이 파일의 World 하나로 둔다.
import { ANOMALIES, BUYERS, CLASSES, CLASS_SHARE, FAMILY, FAUNA, GEARS, GEAR_SHARE, GIVEN, KEYS, MAT_TIER, MONSTERS, type Mat, ROOT_LORE, TRAIT_KEYS } from './data';
import { rnd } from './rng';
import { keyWord } from './util';

export const CO = {
  PARTY: 4, WAGE: 30, SORTIE: 50, POTION0: 35, POTION_Q0: 500,
  // 횃불: 창고 품목 (상하지 않는다). 경쟁 용병단은 조마다 그 층 TAX.TORCH개씩 들고 가고, 모자라면 그 조는 위기 ×DARK_CRISIS, 그려 오는 지도 ×DARK_MAP
  TORCH_PRICE: 3, DARK_CRISIS: 1.3, DARK_MAP: 0.5,
  // 우리 조의 탐사 (다키스트 던전처럼): 최대 DAYS일. 첫날 횃불 하나를 켜고, 그 뒤로는 날마다 TORCH_F[층] + TORCH_UND × (모르는 만큼 × UND_F)의 확률로 하나를 더 태운다.
  // 태울 횃불이 없으면 그날 돌아서고, 남은 사람마다 DARK_MIN + 진 날 위기 × DARK_BACK의 확률로 어둠 속 위기를 맞는다.
  // 날마다 그 층 몬스터 하나(주인 · 곁 몬스터 둘, ENC_W 무게)를 만나 조원마다 굴리고, 둘 이상 해내면 이긴다.
  // 이기면 해낸 몫만큼 전리품을 짐에 싣고(하루 한 조 다 해내면 LOOT_SLOT칸) 그 몬스터의 소재를 MAT_ENC배 확률로 갈무리한다. 위기는 날마다 한 달 몫의 1/DAYS.
  // 짐 칸: 한 사람 SLOT_PP칸. 횃불 · 포션이 먼저 차지하고, 다 쓴 만큼 비운다. 짐이 다 차면 돌아선다. 캐 오는 양은 다닌 날 몫 × FIND
  DAYS: 6, TORCH_F: [0.15, 0.25, 0.3, 0.35, 0.4], TORCH_UND: 0.4, DARK_MIN: 0.05, DARK_BACK: 0.5,
  ENC_W: [0.4, 0.3, 0.3], SLOT_PP: 3, LOOT_SLOT: 1.5, MAT_ENC: 0.6, FIND: 1.12,
  // 관리국 게시판의 공표된 경쟁 · 납품 의뢰 (지금은 닫아 둔다. 탐사 계획서는 따로 열려 있다)
  JOBS_OPEN: false,
  // 거점 2단계면 성공 한 번에 BASE_TAKE개를 더 캔다
  BASE_STEP: 3000, BASE_MAX: 2, BASE_TAKE: 10, REGEN: 0.5,
  HIRE_FEE: 120, HIRE_CUT: 0.4,
  // 시작 금고: START_SIZE명인 용병단이 START_CASH를 들고 온다 (규모^CASH_EXP에 비례)
  START_CASH: 3000, START_SIZE: 16,
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
  // 단원 한 사람: 실력(0~100)은 TIER_STEP마다 한 단계(신입 · 수련 · 숙련 · 노련 · 명인). 단계마다 그 사람의 성공 굴림에 TIER_B를 더하고,
  // 급여는 TIER_WAGE, 뽑는 값은 신입 값의 TIER_COST배다. 나가서 해내면 실력 +SK_WIN, 못 해내도 +SK_TRY. 그 층 경험은 +EX_WIN / +EX_TRY (100까지)
  TIER_STEP: 20, TIER_B: [-0.06, -0.02, 0.02, 0.05, 0.08], TIER_WAGE: [26, 28, 31, 35, 40], TIER_COST: [1, 1.5, 2.2, 3, 4],
  SK_WIN: 2, SK_TRY: 1, EX_WIN: 6, EX_TRY: 3, CHICKEN_WAGE: 4,
  // 조직력: 조원 둘씩 짝지어 같은 조로 함께 나간 달(CO_MAX달이 끝)을 평균해 0~1. 1이면 성공 +CO_SUCC, 위기 ×(1 − CO_CRISIS)
  CO_MAX: 6, CO_SUCC: 0.05, CO_CRISIS: 0.15,
  // 지원자 명단: 달마다 우리 문을 두드리는 사람 (CAND_MAX명까지)
  CAND_MAX: 8,
  // 본부(우리만): 숙소 · 훈련장 · 기록실 · 의무실을 단계로 올린다. 한 달에 공사 하나, 다음 달 정산 때 완공. 숙소 단계가 침상 수(끝이 50)다.
  // 숙소 말고 한 단계마다 유지비 HQ_KEEP. 훈련장: 실력 오르는 속도 ×TRAIN_GROW(1단계), 신입은 두 배(2단계), 명인은 3단계부터.
  // 의무실: 치료비 절반(1단계), 죽을 사람 중 MED_SAVE는 다치고 버팀(2단계, 한 달 쉼), 3단계면 MED_SAVE3
  HQ_BEDS: [18, 24, 32, 40, 50], HQ_COST: { dorm: [1500, 2400, 4800, 9000], train: [800, 1500, 3000], rec: [800, 1500, 3000], med: [600, 1500, 3000] } as Record<string, number[]>,
  HQ_KEEP: 10, TRAIN_GROW: 1.5, MED_SAVE: 0.25, MED_SAVE3: 0.45, SK_CAP: 79,
  // 층 이해도(0~100): 용병단마다 층의 지도 완성도(map)가 있고, 우리 조는 거기에 그 층을 가장 잘 아는 조원 경험의 ¼(최대 UND_EX)과 길잡이(UND_GUIDE)를 더한다.
  // 모르는 만큼(und = 1 − 이해도/100) 성공 −UND_SUCC × und, 위기 ×(1 + UND_CRISIS × und), 포션 들고도 사망 ×(1 + UND_HARM × und), 캐 오는 양 ×(1 − UND_LOOT × und).
  // 지도 이정표: 25 갈림길(위기 ×0.9), 50 주 사냥터(캐 오는 양 ×1.1), 75 근원 단서(성공 +3%p), 100 완성(기록실 3단계면 사본을 팔 수 있다)
  UND_EX: 15, UND_GUIDE: 15, UND_AI: 5,
  // 명단이 없는 쪽(경쟁 용병단 · 계약 파티)이 실력 · 조직력 대신 받는 성공 보정: AI_VET0에서 AI_VET_M달에 걸쳐 AI_VET까지
  AI_VET0: 0.03, AI_VET: 0.12, AI_VET_M: 24, UND_SUCC: 0.25, UND_CRISIS: 1.5, UND_HARM: 0.5, UND_LOOT: 0.3, MAP0: 0, UND_F: [0.4, 1, 1, 1, 1],
  // 지도: 조 하나가 다녀오면 (1 + 해낸 비율) × 그 층의 MAP_STEP만큼, 남은 칸이 적을수록 덜(× (1 − 지도/110)). 길잡이 ×1.5, 기록실 1단계 ×1.25, 정찰 조 ×SCOUT_MAP.
  // 넓은 층일수록 천천히 찬다 (1층은 모두가 0%에서 시작해 여러 달에 걸쳐 그린다)
  MAP_STEP: [1, 2, 3, 4, 5], SCOUT_MAP: 2.5, SCOUT_CRISIS: 0.6, SCOUT_LOOT: 0.3, MAP_COPY: 1500, MAP_GIVE: 30,
  // 의뢰: 공표된 경쟁의 포상(1 · 2 · 3등)과 명성, 납품은 TAKE_STEP개 단위로 맡는다. 맡겠다는 쪽이 물량보다 많으면 명성 무게로 나눈다
  RACE_PRIZE: [900, 500, 250], RACE_FAME: [6, 3, 0], TAKE_STEP: 50, JOB_MAX: 2,
  // 교관: 달마다 내는 급료(훈련비). 효과는 훈련도가 차오르는 만큼 (지금 훈련비와 같은 원리)
  COACH_PAY: [0, 150, 300, 600],
  // 관리비: 급여 × (1 + OH_K × 인원²). 머릿수가 늘수록 가파르게 붙는다 (16명 ×1.1, 32명 ×1.4, 40명 ×1.64, 50명 ×2)
  OH_K: 0.0004,
  CLASS_COST: { 전사: 1, 궁수: 1.2, 도적: 1.2, 마법사: 1.5, 사제: 1.5 } as Record<string, number>,
  // 마을 지원자: 매달 APP_BASE + 지난달 모두의 판매 수입 1000G당 APP_PER명 (±20%). 첫 달은 APP0명.
  // 찾는 사람이 더 많으면 명성의 무게(1 + 명성 / FAME_K)대로 나눈다
  APP_BASE: 6, APP_PER: 0.8, APP0: 14,
  // 명성: 성공한 조마다 그 층의 FAME_F, 사망마다 -FAME_DEATH. 매달 FAME_FADE를 곱한다
  FAME_F: [1, 2, 3, 5, 8], FAME_DEATH: 1, FAME_FADE: 0.9, FAME_K: 50,
  // 시작 금고는 규모^CASH_EXP에 비례 (큰 조직의 관리비는 OH_K)
  CASH_EXP: 1,
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
  EXP_MAX: 0.15, EXP_K: 40, PROC_STEP: 5000, PROC_MAX: 2, PROC_BONUS: 0.06, TOOL_COST: [0, 40, 90], TOOL_BONUS: [0, 0.12, 0.24],   // 경쟁 용병단의 채집 도구 = 우리 운반(손수레 · 노새)과 같은 값
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
// 영주세 · 지원금 · 신고 · 감사. 영주청은 모든 용병단을 똑같이 상대한다 (세율 · 지원금 · 법령은 모두에게 같다).
// 한 달은 출정 뒤 가정산에서 신고서를 내야 끝난다. 신고서는 장부의 참값이 기본이고, 고친 만큼 의심이 쌓인다.
export const TAX = {
  // 전리품 판매 수입에 붙는 영주세. 갈무리 소재는 처음엔 세금이 없다 (법령으로 소재마다 붙을 수 있다)
  LOOT: 0.15,
  // 소재 과세: 넉 달마다 영주청이 장부를 살펴, 석 달 동안 모두가 판 소재 값이 전리품 값의 MAT_SHARE를 넘으면 가장 많이 팔린 소재에 MAT_RATE를 매긴다 (MAT_LEN달)
  MAT_RATE: 0.3, MAT_SHARE: 0.12, MAT_LEN: 12,
  // 보급 지원금: 위기에 쓴 포션 한 병, 태운 횃불 하나마다. TORCH는 조마다 들고 가는 기본 개수 (층이 깊을수록 많이).
  // 영주청이 모두에게 준 지원금이 SUB_BUDGET을 넘으면 절반으로, 그다음엔 끊는다 (누가 부풀리든 모두의 지원금이 빨리 마른다)
  SUB_POT: 6, SUB_TORCH: 3, TORCH: [3, 4, 4, 5, 5], SUB_BUDGET: [30000, 60000],
  // 층 지원금: 사람이 덜 가는 열린 층에 조당 (그 층 한 조가 캐 오는 기준 값 × AID_K), AID_LEN달
  AID_K: 0.12, AID_LEN: 6,
  // 탐사 계획서: 새 층이 열리면 ADV_LEN달 동안, 내정에서 그 층에 보낼 조를 적어 내면 조당 선금(기준 값 × ADV_K)을 바로 준다. 덜 보내면 모자란 조만큼 ADV_REFUND배를 돌려낸다
  ADV_K: 0.15, ADV_LEN: 3, ADV_REFUND: 1.2,
  // 범람 복구세: 범람한 다음 달부터 FLOOD_LEN달 동안 전리품 세율 +FLOOD_UP
  FLOOD_UP: 0.05, FLOOD_LEN: 6,
  // 교회 후원금은 그 절반을 세금에서 빼 준다 (낼 세금까지)
  DONATE_CREDIT: 0.5,
  // 절세 특혜: 몸집과 연줄이 있는 큰 용병단은 전리품 세금을 합법으로 덜 낸다 (붉은 깃발단은 영주 납품 계약, 성흔 기사단은 교회 면세 기부, 철모회는 거점 투자 공제).
  // 우리에겐 없다. 그 차이를 메우는 길이 가정산이다
  RELIEF: { volume: 0.1, steady: 0.1, deep: 0.08 } as Partial<Record<string, number>>,
  // 의심: 신고서로 얻은 이득 ÷ 정직한 세금 · 지원금(SUS_BASE 이상) × SUS_K × 출처 무게만큼 쌓이고, 매달 SUS_FADE를 곱한다.
  // 감사 확률은 (의심 − SUS_FREE) ÷ SUS_SPAN (AUDIT_MAX까지). 감사는 지난 AUDIT_BACK달 장부를 다른 기록과 맞대 보고,
  // 출처마다 DET 확률로 걸린 이득에 AUDIT_PEN배를 더해 추징한다(걸린 이득의 세 배를 낸다). 감사가 끝나면 의심과 묵은 장부는 지워진다
  SUS_K: 10, SUS_BASE: 300, SUS_FADE: 0.85, SUS_FREE: 12, SUS_SPAN: 90, AUDIT_MAX: 0.5, AUDIT_BACK: 6, AUDIT_PEN: 2, AUDIT_FAME: 4,
  SUS_W: { loot: 1, mat: 1, pot: 1.2, torch: 0.7, aid: 2, adv: 2 } as Record<string, number>,
  DET: { loot: 0.7, mat: 0.6, pot: 0.5, torch: 0.3, aid: 0.9, adv: 0.9 } as Record<string, number>,
  // 재정 압박(0~1): 이어진 적자 한 달마다 PRESS_LOSS, 금고가 지난달 지출의 PRESS_RUN달 치에 못 미치면 모자란 비율만큼. 경쟁 용병단은 압박이 클수록 과감하게 장부를 고친다
  PRESS_LOSS: 0.35, PRESS_RUN: 2,
  // 스캔들: 감사에서 걸린 이득이 SCANDAL_G 이상이면 신문에 나고, 그 용병단은 TAINT_LEN달 동안 감면이 절반이 되고 감사 확률이 WATCH 밑으로 내려가지 않는다(명성 −SCANDAL_FAME 더).
  // 영주청은 가장 크게 걸린 칸을 CHECK_LEN달 동안 더 꼼꼼히 맞대 본다(걸릴 확률 ×CHECK_DET, 의심 무게 ×CHECK_SUS). 포션 · 횃불이면 그동안 보급 지원금도 절반. 모두에게 같다
  SCANDAL_G: 1000, SCANDAL_FAME: 6, TAINT_LEN: 8, WATCH: 0.08, CHECK_LEN: 12, CHECK_DET: 1.4, CHECK_SUS: 2,
};
// 조사: 받침이 있으면 a, 없으면 b ('과'/'와', '은'/'는', '을'/'를', '이'/'가')
export const jo = (w: string, a: string, b: string) => { const ch = w.charCodeAt(w.length - 1); return ch >= 0xac00 && ch <= 0xd7a3 && (ch - 0xac00) % 28 ? a : b; };
// 신고서 칸: 전리품 판매액(G) · 과세 소재 판매액(G) · 위기에 쓴 포션(병) · 횃불(개) · 지원금 층에 보낸 조 · 선금 받은 층에 보낸 조
export const FILE_KEYS = ['loot', 'mat', 'pot', 'torch', 'aid', 'adv'] as const;
export type FileKey = typeof FILE_KEYS[number];
export type Filing = Record<FileKey, number>;
// 그 칸을 맞대 볼 수 있는 기록 (화면과 감사 기사에 쓴다)
export const FILE_SRC: Record<FileKey, string> = { loot: '상단 경매장 장부', mat: '상단 경매장 장부', pot: '교회 치료 기록', torch: '상단 보급 장부', aid: '관리국 출입 기록', adv: '관리국 출입 기록' };
// 법령: 소재 과세(m) · 층 지원금(f, amt) · 보급 지원금 배율(rate) · 전리품 세율 가산(rate). at은 고시한 달
export type Law = { id: number; kind: 'mat' | 'aid' | 'sub' | 'loot' | 'check'; from: number; until: number; at: number; m?: string; f?: number; rate?: number; amt?: number; k?: FileKey };   // check: 그 칸(k)을 더 꼼꼼히 맞대 본다
// 가정산: 그달 장부의 참값과, 그달 세율 · 지원금 단가 · 선금 (신고서를 고쳐도 이것은 그대로다)
export type Draft = { m: number; i: number; truth: Filing; lootRate: number; relief: number; matRate: number; matTaxed: string[]; subPot: number; subTorch: number;
  aidF: number; aidAmt: number; advF: number; advN: number; advPer: number; donate: number; losses0: number };
export type Bill = { lootTax: number; matTax: number; credit: number; tax: number; sub: number; aid: number; refund: number };
// 신고 기록: 달마다 출처별로 신고서로 얻은 이득 (감사가 맞대 본다)
export type Books = { m: number; gain: Partial<Record<FileKey, number>> };
export type Audit = { found: number; fine: number; hit: FileKey[]; scandal?: boolean };
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
// 시세: 모든 물품이 같은 식이다. 값 = 기본 가치(희귀도) × 공급 · 수요 배율. 시장이 사 가는 양(D)보다 많이 풀리면(Q) 내려가고 모자라면 오른다(el은 민감도, lo ~ hi는 바닥과 천장).
// 전리품(층마다 하나, 0티어)은 수요가 정해져 있고, 갈무리 소재는 평소 팔리던 물량(흐르는 평균)을 수요로 본다
export function marketMul(D: number, Q: number, el: number, lo: number, hi: number) { return clamp(Math.pow(D / Q, el), lo, hi); }
// 소재 시세: 기준 값 × 찾는 곳 웃돈 × 공급 · 수요 배율
export const matPrice = (val: number, mul: number, Q: number, avg: number | undefined) => Math.round(val * mul * (avg && Q ? marketMul(avg, Q, CO.MAT_EXP, CO.MAT_LO, CO.MAT_HI) : 1));
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
// 가죽과 점액은 마을 살림에 늘 드는 물건이라 상단이 기준가 밑으로는 사들이지 않는다(바닥이 기준가). 1층만 열린 첫 달들에
// 모두가 1층에 몰려도 값이 무너지지 않는다. 천장은 그대로라 1층이 나중에 더 좋아지지는 않는다
export type Item = { name: string; buyer: string; P0: number; D: number; el: number; lo: number; hi: number };
export const ITEMS: Item[] = [
  { name: '가죽과 점액', buyer: '상단 경매장', P0: 8, D: 850, el: 0.35, lo: 1, hi: 1.15 },
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
export const priceOf = (it: Item, Q: number) => Math.round(it.P0 * (Q ? marketMul(it.D, Q, it.el, it.lo, it.hi) : it.hi) * 10) / 10;
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
  hq?: Record<string, number>; pendingHq?: string;   // 본부 단계(우리만)와 짓고 있는 것
  map?: number[]; mapSold?: boolean[];   // 층마다 지도 완성도(0~100), 사본을 판 층
  // 우리 단원 명단 (직업, 수습이면 겪은 성공 수). 우리 수습은 rook 대신 여기에 둔다. 경쟁 용병단은 명단 없이 조마다 직업이 섞여 나간다
  crew?: Person[]; nextId?: number; hurtN?: number;   // hurtN: 이번 달 부상으로 쉬는 사람 (경쟁 용병단)
  sus?: number; books?: Books[]; audits?: number;   // 영주청의 의심, 감사가 맞대 볼 신고 기록, 받은 감사 수
  taint?: number; watch?: number; scandals?: number;   // 스캔들로 감면이 절반인 달 · 감시가 붙은 달(그달까지), 스캔들 수
};
// 단원: 직업(c), 이름(n), 실력(sk, 0~100), 특성(tr), 층마다 경험(ex, 0~100), 함께 나간 짝마다 함께한 달(mt), 해낸 수(wins), 부상으로 쉬는 달(hurt).
// rk는 옛 수습(경쟁 용병단과 옛 판에만)
export type Person = { id: number; c: string; rk?: number; hurt?: number; n?: string; sk?: number; tr?: string; ex?: number[]; mt?: Record<number, number>; wins?: number };
// 우리 조 하나: 층, 자리 넷(단원 id, 빈자리는 null), 챙길 장비("g:은" 꼴, 빈 문자열이면 섞인 대로)
export type Team = { f: number; m: (number | null)[]; g: string; scout?: boolean };   // scout: 정찰 조 (기록실 2단계부터, 둘 · 셋만)
// guide: 층마다 편성 지침 (KEYS 중 하나, 없으면 빈 문자열)
// donate: 교회 후원금, root: 찾아낸 근원 하나에 봉인·채굴장 기금으로 넣는 돈
// tool: 채집 장비 수준(0~2), proc: 갈무리장 투자, intel: 출처별 정보비, spyOn: 정보원을 붙일 경쟁 용병단
// 보급 창고: 포션은 산 달별 묶음(pot[a]는 a달 전에 산 것), 장비는 종류별 벌 수
export type Supply = { pot: number[]; holy: number[]; gear: Record<string, number>; torch?: number };
// 편성 줄: n조가 g를 꼭 챙긴다 ("c:사제+g:은" 꼴, 빈 문자열이면 섞인 대로)
export type Kit = { n: number; g: string };
export type Plan = { parties: number[]; pots: number[]; train: number; base: { f: number; amt: number } | null; hire: number[]; guide: string[]; donate?: number;
  root?: { f: number; seal: number; mine: number } | null; tool?: number; proc?: number; intel?: Partial<Record<Src, number>>; spyOn?: string[];
  // 정보망을 화면에서 정하는 꼴: 유지비는 저절로 내고(cut에 든 출처는 끊는다), up만큼 더 넣어 넓힌다. 있으면 intel을 이것으로 다시 셈한다
  intelUp?: Partial<Record<Src, number>>; intelCut?: Src[];
  // buy: 이번 달 사 둘 보급. 비워 둔 칸은 "필요한 만큼" (포션은 모자란 만큼 상단에서, 장비는 편성에 모자란 만큼)
  buy?: { pot?: number; holy?: number; gear?: Record<string, number>; torch?: number };
  // kits: 층마다 편성 줄 (플레이어). 있으면 guide 대신 이것을 따르고, 줄에 들지 않은 우리 조와 계약 파티는 섞인 대로 간다
  kits?: Kit[][];
  // recruit: 이번 달 뽑을 신입 수 (비워 두면 빈 침상만큼), dorm: 숙소 증축
  recruit?: number; dorm?: boolean;
  build?: string;   // 본부에서 이번 달 올릴 것 (dorm · train · rec · med)
  sellMap?: number;   // 다 그린 지도의 사본을 관리국에 팔 층 (기록실 3단계)
  take?: Record<number, number>;   // 이번 달 받는 납품 의뢰에 맡을 양 (의뢰 id → 개수)
  coach?: number;   // 교관 (0~3단계, 훈련비가 된다)
  // 우리 조 편성: 기본 편성(자리 넷의 직업), 조마다의 편성. 있으면 parties·kits 대신 이것을 따른다. recruitC: 직업별로 뽑을 신입
  tpl?: string[]; teams?: Team[]; recruitC?: Record<string, number>;
  pick?: number[];   // 지원자 명단에서 고른 사람(지원자 id, 먼저 고른 순)
  tplF?: (string[] | undefined)[];   // 층마다 따로 짤 모양 (봇이 쓴다. 화면은 기본 편성 하나로 짜고 손으로 고친다)
  torch?: number[] };   // 층마다 우리 조가 들고 갈 횃불 (비워 두면 TAX.TORCH)
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
  spend: { sortie: number; potion: number; wage: number; train: number; base: number; hire: number; recruit: number; donate: number; root: number; tool: number; proc: number; intel: number; gear: number; probe: number; dorm: number; heal: number; hq: number; job: number; torch: number; tax: number; fine: number }; net: number; recruited: number;
  // 영주청: 판매 중 전리품 몫, 탐사 선금(판매 수입에 들어 있다), 가정산을 마친 신고(참값 · 신고 · 고지서 · 감사). tax는 영주세와 선금 반납, fine은 추징금
  lootSales?: number; adv?: number; file?: { truth: Filing; filed: Filing; bill: Bill; gain: number; audit?: Audit };
  recruitWant: number; recruitPrice: number; rookDone: number; rookDead: number;
  recruitC?: Record<string, number>; newP?: number[]; mapSale?: number;
  torchUsed?: number; torchShort?: number;   // 태운 횃불(경쟁 용병단은 들고 간 만큼), 횃불 없이 간 조 (경쟁 용병단)
  jobPay?: number; jobFame?: number; jobs?: { id: number; got: number; pay: number; pen: number; rank?: number }[];   // 의뢰로 받은 돈 · 명성, 의뢰마다 이번 달   // 우리가 직업별로 들인 신입, 들어온 지원자 id   // 찾은 신입 수와 한 명 값, 대원이 된 수습과 죽은 수습
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
  ours: { f: number; keys: string[]; ok: boolean; d: number; mats: [string, number][]; first: string[]; kit: number; g: string; crisis?: number; pots?: number; n?: number; k?: number; hurt?: number; days?: Day[]; trip?: Trip }[];   // n: 간 사람, k: 해낸 사람, hurt: 다친 사람   // kit: 편성 줄 번호(-1이면 섞인 대로), g: 챙겨 간 것
  matPrice: Record<string, number>; matRef: Record<string, number>;   // 소재 시세와, 그달 전까지의 평균 시세
  pressure: number; overflow: boolean;
  apps: number;   // 그달 마을 지원자
  fc?: Forecast;   // 결재 직전 우리 수입 어림 (결과와 견준다)
  map0?: number[]; mapBy?: Record<number, number>;   // 우리 지도: 이번 달 전 완성도, 단원마다 보탠 몫
};
// 탐사 하루: 만난 몬스터, 이겼나, 해낸 사람 / 나선 사람, 실은 짐 칸, 갈무리한 것, 위기 · 사망
export type Day = { mon: string; win: boolean; k: number; n: number; loot?: number; mats: [string, number][]; cr: number; d: number };
// 탐사 한 번: 들고 간 횃불 · 태운 횃불, 짐 칸 · 전리품을 채운 칸 · 남은 횃불과 포션이 차지한 칸, 돌아선 까닭(다 돎 · 횃불 · 짐 · 물러남), 어둠 속 위기
export type Trip = { torch: number; tu: number; slots: number; pack: number; rest: number; end: 'done' | 'torch' | 'pack' | 'flee'; dark: number };
// 수입 어림: 전리품과 소재 판매 수입의 분포 (약점 · 역효과는 넣지 않는다. 플레이어가 아는 것만으로 셈한다)
export type Forecast = { mean: number; p10: number; p50: number; p90: number; bins: number[]; step: number; dead: number; hurt: number; loot?: number; crisis?: number; torch?: number };   // loot: 그중 전리품 기대값, crisis: 우리 조가 맞을 위기 기대값, torch: 태울 횃불 기대값
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
  cand?: Person[];   // 이번 달 우리 문을 두드린 지원자 명단 (지난달 말에 정해 둔다)
  jobs?: Job[]; jobSeq?: number;   // 관리국 게시판의 의뢰 (끝난 것도 남는다)
  laws?: Law[]; lawSeq?: number; subPaid?: number;   // 영주청 법령 (끝난 것도 남는다), 모두에게 준 보급 지원금 누적
  draft?: Draft | null;   // 출정이 끝나고 아직 신고서를 내지 않은 우리 가정산
};
export type Cartel = { left: number; churchOut: boolean; donated: number[] };
// 의뢰(관리국 게시판): 영주 · 상단 · 교회 · 마법학교가 모든 용병단에 똑같이 내건다.
// race: 공표된 경쟁 (그 층에서 해낸 조 수로 순위, 끝나는 달에 포상). deliver: 납품 (from달에 맡을 양을 정하고 until달까지 넘기면 개당 웃돈, 못 채운 개수엔 위약금)
// explore: 탐사 계획서 (영주청. 달마다 그 층에 보낼 조를 적어 내면 조당 선금 prem을 바로 주고, 덜 보낸 조는 가정산에서 pen배를 돌려낸다)
// take · done · score는 용병단마다(W.cos 순서). explore의 take는 이번 달 적어 낸 조 수
export type Job = { id: number; by: string; kind: 'race' | 'deliver' | 'explore'; title: string; f: number; qty: number; prem: number; pen: number; from: number; until: number;
  take: number[]; done: number[]; score?: number[]; prize?: number[]; fame?: number[] };
// 이번 달 i번 용병단이 교회 포션에 내는 값: 담합 중엔 올라 있고, 교회가 빠진 뒤로는 후원한 용병단에만 예전 값으로 판다
export const churchPrice = (W: World, i: number) => {
  const K = W.cartel;
  return Math.round(CO.POTION_C0 * (K && !(K.churchOut && K.donated[i] > 0) ? CO.CARTEL_MARKUP : 1));
};

export function newWorld(): World {
  // 층마다 사는 것은 판마다 다르다
  const mons = MONSTERS.map((_, i) => i).sort(() => rnd() - 0.5).slice(0, FLOORS.length);
  const W: World = {
    mons, notes: [], obs: FLOORS.map(() => ({})), potionC: CO.POTION_C0, cartel: null, tension: 0, cool: 0,
    pressure: 0, anoms: 0, anomN: 0, roots: FLOORS.map(() => ({ found: 0, seal: 0, mine: 0, done: '' as const, at: 0 })),
    keys: mons.map(m => MONSTERS[m].key), keyUse: zeros(), adapted: zeros(),
    mat: { avgQ: {}, ref: {}, dem: [], book: FLOORS.map(() => ({ n: {}, got: {} })) },
    intel: { lv: { ...INTEL.BASE }, acc: { ret: 0, mkt: 0, chu: 0, gate: 0, spy: 0 }, spyOn: [], tenure: {}, est: { floors: FLOORS.map((_, f) => (f === 0 ? { lo: 40, hi: 100, mid: 75 } : null)), rivals: {}, apps: { lo: CO.APP0 - 4, hi: CO.APP0 + 4 } } },
    month: 1, unlocked: 1, prog: 0, pool: FLOORS.map(F => F.max), price: ITEMS.map(it => it.P0), potion: CO.POTION0,
    apps: CO.APP0,
    cos: ROSTER.map(r => ({ ...r, members: r.size, cash: r.style === 'crowd' ? 0 : Math.round(CO.START_CASH * Math.pow(r.size / CO.START_SIZE, CO.CASH_EXP)),
      beds: r.size + CO.BED_SPARE, pendingBeds: 0, dorms: 0, rook: [] as number[], fame: 0,
      ...(r.style === 'player' ? { crew: crewOf(r.size), nextId: r.size, hq: { dorm: 0, train: 0, rec: 0, med: 0 } } : {}),
      map: FLOORS.map((_, f) => (f === 0 ? CO.MAP0 : 0)), mapSold: FLOORS.map(() => false),
      sus: 0, books: [] as Books[], audits: 0,
      skill: 0, bases: zeros(), pendingBase: null, losses: 0, know: zeros(), learned: FLOORS.map(() => false), relM: 50, relC: 50, exp: zeros(), proc: 0, pendingProc: 0,
      // 처음 들어올 때 조마다 포션 세 병씩은 챙겨 온다
      sup: { pot: [Math.floor(r.size / CO.PARTY) * 3], holy: [], gear: {} },
      trait: { resp: 0.8 + 0.4 * rnd(), pots: rnd() < 0.3 ? 1 : 0 } })),
    last: null, history: [], log: [], probes: [], laws: [], lawSeq: 0, subPaid: 0, draft: null,
  };
  W.cand = candsOf(W, true);
  // 첫 달 게시판은 판마다 같다: 영주의 "2층 길 트기"(석 달 동안 1층에서 해낸 조 수 순위)와 상단의 "가죽 납품"
  const N = W.cos.length;
  W.jobs = !CO.JOBS_OPEN ? [] : [
    { id: 1, by: '영주', kind: 'race', title: '2층 길 트기', f: 0, qty: 0, prem: 0, pen: 0, from: 1, until: 3, take: Array(N).fill(0), done: Array(N).fill(0), score: Array(N).fill(0), prize: CO.RACE_PRIZE, fame: CO.RACE_FAME },
    { id: 2, by: '상단', kind: 'deliver', title: '가죽 납품', f: 0, qty: 1200, prem: 2, pen: 1, from: 1, until: 3, take: Array(N).fill(0), done: Array(N).fill(0) },
  ];
  W.jobSeq = 2;
  return W;
}

export const us = (W: World) => W.cos[0];
// 금고 기준선(경쟁 용병단 · 봇이 "넉넉하다"고 보는 선)은 시작 금고에 비례한다 (8,000G일 때 맞춘 값 × CASH_K)
export const cashK = () => CO.START_CASH / 8000;
// 그 층 몬스터의 지금 약점 (적응하면 바뀐다)
export const keyOf = (W: World, f: number) => (W.keys && W.keys[f]) || MONSTERS[W.mons[f]].key;
// 전리품 비율: 성공 한 번에 캐 오는 양에 곱하는 값
export const expBonus = (n: number) => CO.EXP_MAX * n / (n + CO.EXP_K);
export const lootMul = (c: Company, f: number, tool = 0) =>
  1 + expBonus(((c.exp && c.exp[f]) || 0) * CO.SIZE_REF / Math.max(CO.SIZE_REF / 2, c.members)) + CO.PROC_BONUS * Math.min(CO.PROC_MAX, c.proc || 0) + (CO.TOOL_BONUS[tool] || 0);
export const rootOf = (W: World, f: number): Root => (W.roots && W.roots[f]) || { found: 0, seal: 0, mine: 0, done: '', at: 0 };
// 층의 크기: 봉인한 층은 조금 작아진다 (모두가 덜 캔다)
export const floorMax = (W: World, f: number) => Math.round(FLOORS[f].max * (rootOf(W, f).done === 'seal' ? CO.SEAL_MAX : 1));
// 층이 압력에 보태는 배율: 봉인하면 줄고, 채굴장을 내면 는다
export const pressOf = (W: World, f: number) => { const d = rootOf(W, f).done; return d === 'seal' ? CO.SEAL_PRESS : d === 'mine' ? CO.MINE_PRESS : 1; };
export const maxParties = (c: Company) => Math.floor((c.crew ? c.crew.filter(x => !x.hurt).length : c.members - (c.hurtN || 0)) / CO.PARTY);
export const isHurt = (p: Person) => !!p.hurt;
// 인원: 침상, 빈 침상, 증축 값(공사 중인 것까지 친 침상 수로 셈), 숙소 유지비, 급여
export const bedsOf = (c: Company) => (c.hq ? CO.HQ_BEDS[c.hq.dorm || 0] : c.beds ?? c.members + CO.BED_SPARE);
export const roomOf = (c: Company) => Math.max(0, bedsOf(c) - c.members);
export const dormCost = (c: Company) => (c.hq ? hqCost(c, 'dorm') : CO.DORM_ADD * (CO.DORM_BED + CO.DORM_GROW * (bedsOf(c) + (c.pendingBeds || 0))));
// 본부: 다음 단계 공사비 (끝까지 올렸으면 0), 숙소 말고 올린 단계의 유지비
export const hqLv = (c: Company, k: string) => (c.hq && c.hq[k]) || 0;
export const hqCost = (c: Company, k: string) => (CO.HQ_COST[k] ? CO.HQ_COST[k][hqLv(c, k)] || 0 : 0);
export const hqKeep = (c: Company) => (c.hq ? (hqLv(c, 'train') + hqLv(c, 'rec') + hqLv(c, 'med')) * CO.HQ_KEEP : 0);
export const dormKeep = (beds: number) => beds * CO.DORM_KEEP;
export const wageOf = (m: number) => Math.round(m * CO.WAGE * (1 + CO.OH_K * m * m));
// 신입 한 명 값: 찾는 사람(want)이 지원자(apps)보다 많으면 오른다
export const recruitPrice = (want: number, apps: number) => Math.round(CO.RECRUIT * Math.min(CO.RECRUIT_MAX, 1 + CO.RECRUIT_UP * Math.max(0, want / Math.max(1, apps) - 1)));
// 처음 단원 명단: 직업은 마을 사람들의 비율대로, 이름 · 실력 · 특성도 판마다 같다 (실력은 수련 · 숙련이 대부분, 노련 하나, 신입 하나)
const SK0 = [62, 55, 50, 46, 44, 42, 40, 38, 36, 34, 32, 30, 28, 26, 22, 18];
export function crewOf(n: number): Person[] {
  const k = CLASS_SHARE.map(v => Math.floor(n * v));
  const order = CLASS_SHARE.map((v, i) => [n * v - k[i], i]).sort((a, b) => b[0] - a[0]);
  for (let j = 0, rest = n - k.reduce((a, b) => a + b, 0); rest > 0; j++, rest--) k[order[j][1]]++;
  return CLASSES.flatMap((c, i) => Array.from({ length: k[i] }, () => c)).map((c, id) => ({
    id, c, n: GIVEN[id % GIVEN.length] + ' ' + FAMILY[id % FAMILY.length], sk: SK0[(id * 7) % SK0.length], tr: TRAIT_KEYS[(id * 3) % TRAIT_KEYS.length], ex: FLOORS.map(() => 0), mt: {}, wins: 0,
  }));
}
// 실력 단계(0 신입 ~ 4 명인), 한 사람의 급여
export const tierOf = (p: Person) => (p.sk == null ? 2 : Math.min(4, Math.floor(p.sk / CO.TIER_STEP)));
export const personWage = (p: Person) => CO.TIER_WAGE[tierOf(p)] - (p.tr === '새가슴' ? CO.CHICKEN_WAGE : 0);
// 급여: 우리는 사람마다 단계대로, 경쟁 용병단은 머릿수로. 큰 조직일수록 관리비가 붙는다
export const wageCo = (c: Company) => (c.crew ? Math.round(c.crew.reduce((a, p) => a + personWage(p), 0) * (1 + CO.OH_K * c.crew.length * c.crew.length)) : wageOf(c.members));
// 조직력: 조원 둘씩 짝지어 함께 나간 달(CO_MAX가 끝)의 평균, 0~1
export function cohesion(who: Person[]) {
  let s = 0, n = 0;
  for (let a = 0; a < who.length; a++) for (let b = a + 1; b < who.length; b++) { n++; s += Math.min(CO.CO_MAX, (who[a].mt && who[a].mt![who[b].id]) || 0); }
  return n ? s / n / CO.CO_MAX : 0;
}
// 조원마다 성공 굴림에 더할 값 · 위기 배수 · 캐 오는 몫, 조의 소재 배수, 의무병이 있는지 (실력 단계 · 특성 · 조직력)
export function memberMods(who: Person[], f: number, u = 100) {
  const coh = cohesion(who), has = (t: string) => who.some(p => p.tr === t);
  return {
    coh,
    pp: who.map(p => CO.TIER_B[tierOf(p)] + coh * CO.CO_SUCC + (p.tr === '새가슴' && f > 0 && u < 50 ? -0.1 : 0)),
    cr: who.map(p => (p.tr === '신중함' ? 0.7 : p.tr === '욕심쟁이' ? 1.2 : 1) * (1 - CO.CO_CRISIS * coh)),
    loot: who.map(p => (p.tr === '신중함' ? 0.9 : 1)),
    mat: (has('욕심쟁이') ? 1.3 : 1) * (has('눈썰미') ? 1.15 : 1),
    medic: has('의무병'),
  };
}
// 층 이해도: 용병단의 지도에, 우리 조는 그 층을 가장 잘 아는 조원 경험의 ¼(최대 UND_EX)과 길잡이를 더한다
export const mapOf = (c: Company, f: number) => (c.map ? c.map[f] || 0 : f === 0 ? CO.MAP0 : 0);
export function teamUnd(c: Company, f: number, who: Person[] | null) {
  const m = mapOf(c, f);
  // 경쟁 용병단(명단이 없다): 그 층에서 쌓은 성공만큼 고참 몫(최대 UND_EX)과, 길잡이가 낀 셈 치는 몫(UND_AI)
  if (!c.crew) return Math.round(Math.min(100, m + Math.min(CO.UND_EX, ((c.exp && c.exp[f]) || 0) / 4) + CO.UND_AI));
  if (!who || !who.length) return Math.round(m);
  const best = Math.max(...who.map(p => (p.ex && p.ex[f]) || 0));
  return Math.round(Math.min(100, m + Math.min(CO.UND_EX, best / 4) + (who.some(p => p.tr === '길잡이') ? CO.UND_GUIDE : 0)));
}
// 이해도가 바꾸는 것: 성공에 더할 값, 위기 · 사망 · 캐 오는 양 배수 (지도 이정표 포함)
// f: 층 (1층은 넓고 순해 모르는 데서 오는 손해가 UND_F배로 작다)
export function undMods(u: number, map: number, f = 1) {
  const x = (100 - u) / 100 * (CO.UND_F[f] ?? 1);
  return { succ: -CO.UND_SUCC * x + (map >= 75 ? 0.03 : 0), crisis: (1 + CO.UND_CRISIS * x) * (map >= 25 ? 0.9 : 1), harm: 1 + CO.UND_HARM * x, loot: (1 - CO.UND_LOOT * x) * (map >= 50 ? 1.1 : 1) };
}
// 우리 조 하나의 성공률 어림: 층 · 훈련 · 거점 · 봉인 · 빈자리에 조원마다 실력 단계 · 특성 · 조직력을 더한 값의 평균 (약점 · 역효과는 모른다)
export function teamOdds(W: World, c: Company, f: number, who: Person[], pots: number, crowd: number, T: Team | null = null) {
  const p0 = succRate(c, f, pots, crowd) + (rootOf(W, f).done === 'seal' ? CO.SEAL_SUCC : 0);
  const u = teamUnd(c, f, who), U = undMods(u, mapOf(c, f), f);
  const pt0 = clamp(p0 + U.succ - who.filter(isRook).length * CO.ROOK_PEN - (CO.PARTY - who.length) * CO.SHORT_PEN, 0.05, 0.97);
  if (!who.length) return { p: pt0, coh: 0, u, U };
  const MM = memberMods(who, f, u);
  return { p: MM.pp.reduce((a, d) => a + clamp(pt0 + d, 0.05, 0.97), 0) / who.length, coh: MM.coh, u, U };
}
// 지원자 하나를 만든다: 실력은 대개 신입, 명성이 높을수록 수련 · 숙련이 섞인다. 첫 달은 판마다 같다(난수 없이)
function candOf(id: number, fame: number, first: number | null): Person {
  const cls = first != null ? CLASSES[[0, 1, 4, 2, 3, 0, 1, 4][first % 8]] : (() => { let r = rnd(), k = 0; while (k < CLASSES.length - 1 && r >= CLASS_SHARE[k]) { r -= CLASS_SHARE[k]; k++; } return CLASSES[k]; })();
  let sk: number;
  if (first != null) sk = [12, 26, 8, 30, 16, 6, 22, 14][first % 8];
  else { const r = rnd(), fb = fame / 100; sk = r < 0.06 + fb * 0.1 ? 40 + Math.floor(rnd() * 16) : r < 0.35 + fb * 0.2 ? 20 + Math.floor(rnd() * 19) : 4 + Math.floor(rnd() * 15); }
  const name = first != null ? GIVEN[(16 + first * 3) % GIVEN.length] + ' ' + FAMILY[(16 + first * 5) % FAMILY.length] : GIVEN[Math.floor(rnd() * GIVEN.length)] + ' ' + FAMILY[Math.floor(rnd() * FAMILY.length)];
  const tr = first != null ? TRAIT_KEYS[(first * 2 + 1) % TRAIT_KEYS.length] : TRAIT_KEYS[Math.floor(rnd() * TRAIT_KEYS.length)];
  return { id, c: cls, n: name, sk, tr, ex: FLOORS.map(() => 0), mt: {}, wins: 0 };
}
export function candsOf(W: World, first = false): Person[] {
  const c = us(W), n = Math.min(CO.CAND_MAX, W.apps ?? CO.APP0), base = 100000 + W.month * 100;
  return Array.from({ length: n }, (_, k) => candOf(base + k, c.fame || 0, first ? k : null));
}
// 신입 하나의 계약금: 그 달의 값 × 드문 직업 × 실력 단계
export const candPrice = (p: Person, rPrice: number) => Math.round(rPrice * (CO.CLASS_COST[p.c] || 1) * CO.TIER_COST[tierOf(p)]);
// 이번 달 뽑으려는 지원자: 고른 사람(pick)이 있으면 그 순서대로, 없으면 직업별로 찾는 만큼 실력 좋은 사람부터 (빈 침상까지)
export function candWants(W: World, c: Company, P: Plan, room: number): Person[] {
  const cand = W.cand || [];
  if (P.pick) return P.pick.map(id => cand.find(x => x.id === id)).filter((x): x is Person => !!x).slice(0, room);
  const want = recruitWants(c, P, room, W.apps ?? CO.APP0), left = [...cand].sort((a, b) => (b.sk || 0) - (a.sk || 0)), out: Person[] = [];
  Object.entries(want).forEach(([cls, n]) => { for (let k = 0; k < n; k++) { const j = left.findIndex(x => x.c === cls); if (j < 0) break; out.push(left.splice(j, 1)[0]); } });
  return out.slice(0, room);
}
export const isRook = (p: Person) => p.rk != null;
// 수습 수 (우리는 명단에서, 경쟁 용병단은 rook에서)
export const rookCount = (c: Company) => (c.crew ? c.crew.filter(isRook).length : (c.rook || []).length);
// 조를 기본 편성대로 짠다: 조마다 자리 넷에 그 직업을 대원 먼저 찾아 넣는다. fill이면 남은 빈자리를 남은 사람으로 채운다.
// want[f]가 있으면 그 층 조의 앞 두 자리는 그 직업으로 (지침), gear[f]는 그 층 조의 장비
// tplF[f]가 있으면 그 층은 그 모양으로 짠다. 대원은 깊은 층 조부터 넣는다 (수습은 얕은 층에 남는다)
export function formTeams(c: Company, parties: number[], tpl: string[], fill = true, want: string[] = [], gear: string[] = [], tplF: (string[] | undefined)[] = []): Team[] {
  const crew = (c.crew || []).filter(p => !p.hurt).sort((a, b) => (isRook(a) ? 1 : 0) - (isRook(b) ? 1 : 0)), used = new Set<number>();
  // 그 직업 중 이미 조에 든 사람과 함께 나간 달이 가장 많은 사람을 고른다 (손발 맞는 조가 흩어지지 않게)
  const take = (cls: string, T: Team) => {
    const inT = T.m.filter((x): x is number => x != null), bond = (p: Person) => inT.reduce((a, id) => a + ((p.mt && p.mt[id]) || 0), 0);
    let x: Person | undefined; crew.forEach(p => { if (p.c === cls && !used.has(p.id) && (!x || bond(p) > bond(x))) x = p; });
    if (x) used.add(x.id); return x ? x.id : null;
  };
  const teams: Team[] = [];
  parties.forEach((n, f) => { for (let q = 0; q < n; q++) teams.push({ f, m: [null, null, null, null], g: gear[f] || '' }); });
  // 지침 직업은 두 자리에 넣는다 (직업 약점은 두 명이어야 다 먹힌다)
  [...teams].sort((a, b) => b.f - a.f).forEach(T => { const w = want[T.f]; (tplF[T.f] || (w ? [w, w, ...tpl.filter((x, i) => i !== tpl.indexOf(w))].slice(0, CO.PARTY) : tpl)).forEach((cls, s) => { T.m[s] = cls ? take(cls, T) : null; }); });
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
  const pot = P.parties.reduce((a, n, f) => a + (n + P.hire[f]) * P.pots[f], 0), gear: Record<string, number> = {}, torch = P.teams ? P.parties.reduce((a, n, f) => a + n * carryOf(P, f), 0) : torchOf(P.parties);
  FLOORS.forEach((_, f) => { for (let q = 0; q < P.parties[f] + P.hire[f]; q++) guideParts(kitOf(P, f, q).g).filter(k => k.startsWith('g:')).forEach(k => { gear[k.slice(2)] = (gear[k.slice(2)] || 0) + 1; }); });
  return { pot, gear, torch };
}
// 우리 조가 그 층에 들고 갈 횃불 (조당)
export const carryOf = (P: Plan, f: number) => clamp(Math.floor(P.torch && P.torch[f] != null ? P.torch[f] : TAX.TORCH[f]), 0, CO.DAYS);
// 첫날 뒤로 날마다 횃불을 하나 더 태울 확률 (이해도 u가 낮을수록 길을 헤매 더 태운다)
export const torchRate = (f: number, u: number) => clamp(CO.TORCH_F[f] + CO.TORCH_UND * (100 - u) / 100 * (CO.UND_F[f] ?? 1), 0, 0.95);
// 횃불 t개로 다닐 날의 기대(DAYS 대비 비율), 횃불이 떨어져 돌아설 확률, 태울 횃불의 기대 (난수 없이)
export function tripOdds(t: number, rate: number) {
  if (t < 1) return { days: 0, dark: 1, burn: 0 };
  let dist = Array(t + 1).fill(0), days = 1, dark = 0; dist[1] = 1;
  for (let d = 1; d < CO.DAYS; d++) {
    const nx = Array(t + 1).fill(0);
    dist.forEach((p, b) => { if (!p) return; nx[b] += p * (1 - rate); if (b < t) nx[b + 1] += p * rate; else dark += p * rate; });
    dist = nx; days += dist.reduce((a, b) => a + b, 0);
  }
  const burn = dist.reduce((a, p, b) => a + p * b, 0) + dark * t;
  return { days: days / CO.DAYS, dark, burn };
}
// 이번 달 살 횃불 (비워 두면 모자란 만큼)
export const torchBuy = (c: Company, P: Plan) => (P.buy && P.buy.torch != null ? Math.max(0, Math.floor(P.buy.torch)) : Math.max(0, needOf(P).torch - (supOf(c).torch || 0)));
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
// ---------- 의뢰 ----------
export const jobsOpen = (W: World) => (W.jobs || []).filter(J => J.from <= W.month && J.until >= W.month);
export const jobsSign = (W: World) => (W.jobs || []).filter(J => J.kind === 'deliver' && J.from === W.month);
// 이번 달 계획서를 받는 탐사 의뢰
export const jobsExplore = (W: World) => jobsOpen(W).filter(J => J.kind === 'explore');
// 경쟁 용병단이 납품 의뢰에 맡을 양: 지난달 그 층에서 캐 온 양을 석 달 치로 늘려 성향만큼 (그 층에 보낼 때만)
const TAKE_SHARE: Partial<Record<Style, number>> = { volume: 0.35, steady: 0.35, chaser: 0.5, hoarder: 0.3, shallow: 0.5, second: 0.4, deep: 0.2 };
function aiTake(W: World, i: number, P: Plan) {
  const out: Record<number, number> = {}, c = W.cos[i], L = W.last, sh = TAKE_SHARE[c.style] || 0;
  jobsSign(W).forEach(J => {
    if (!sh || !P.parties[J.f]) return;
    const per = L && L.res[i].sent[J.f] ? L.res[i].got[J.f] / L.res[i].sent[J.f] : FLOORS[J.f].take * 0.7;
    const want = Math.floor(per * P.parties[J.f] * (J.until - J.from + 1) * sh / CO.TAKE_STEP) * CO.TAKE_STEP;
    if (want > 0) out[J.id] = Math.min(J.qty, want);
  });
  // 탐사 계획서: 그 층에 보낼 조를 그대로 적어 낸다 (군소 용병대는 내지 않는다)
  if (c.style !== 'crowd') jobsExplore(W).forEach(J => { if (P.parties[J.f]) out[J.id] = P.parties[J.f]; });
  return out;
}
// 이번 달 게시판에 새 납품 의뢰를 붙인다: 지난달 공급이 수요에 못 미친 전리품 (모자란 정도가 큰 것부터, 같은 전리품에 하나씩).
// 상태에서만 정하고 난수는 쓰지 않는다
function postJobs(W: World) {
  const L = W.last, m = W.month; if (!CO.JOBS_OPEN || !L || m < 3) return;
  const live = (W.jobs || []).filter(J => J.kind === 'deliver' && J.until >= m);
  if (live.length >= CO.JOB_MAX) return;
  const cand = ITEMS.map((it, j) => ({ j, r: L.Q[j] ? it.D / L.Q[j] : 0 })).filter(x => x.j < W.unlocked && x.r > 1.05 && !live.some(J => J.f === x.j)).sort((a, b) => b.r - a.r);
  if (!cand.length) return;
  const j = cand[0].j, it = ITEMS[j], N = W.cos.length;
  W.jobSeq = (W.jobSeq || 0) + 1;
  (W.jobs || (W.jobs = [])).push({ id: W.jobSeq, by: it.buyer.split(' · ')[0], kind: 'deliver', title: `${it.name} 납품`, f: j, qty: Math.max(CO.TAKE_STEP, Math.round(it.D * 1.2 / CO.TAKE_STEP) * CO.TAKE_STEP),
    prem: Math.round(it.P0 * 0.25 * 10) / 10, pen: Math.round(it.P0 * 0.12 * 10) / 10, from: m, until: m + 2, take: Array(N).fill(0), done: Array(N).fill(0) });
  W.log.push({ m: m - 1, t: `${it.buyer.split(' · ')[0]}이 관리국 게시판에 ${it.name} 납품 의뢰를 내걸었다. 요즘 물건이 모자란다는 말이 돈다.` });
}

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
  P.donate = c.style === 'steady' && W.cartel && (!W.cartel.churchOut || !W.cartel.donated[i]) && c.cash > 8000 * cashK() ? 800 : 0;
  // 깨친 층에서는 약점대로 갖춰 들어간다
  P.guide = FLOORS.map((_, f) => (c.learned && c.learned[f] ? keyOf(W, f) : ''));
  P.tool = S.tool;
  if (S.proc && (c.proc || 0) + (c.pendingProc || 0) / CO.PROC_STEP < CO.PROC_MAX && c.cash > 14000 * cashK() && W.month % 6 === 3) P.proc = CO.PROC_STEP;
  // 큰 용병단은 남는 장사인 층이 있으면 군소 용병대를 계약 파티로 빌린다
  if ((c.style === 'volume' || c.style === 'steady' || c.style === 'chaser') && c.cash > 8000 * cashK()) {
    const best = margin.indexOf(Math.max(...margin));
    if (look[best] * (1 - CO.HIRE_CUT) - cost - CO.HIRE_FEE > 60) P.hire[best] = Math.floor(c.members / 16);
  }
  if (c.style === 'deep' && W.month % 4 === 1 && c.cash > 9000 * cashK()) P.base = { f: W.unlocked - 1, amt: CO.BASE_STEP };
  // 몸집: 빈 침상은 채우고, 침상이 차면 금고가 증축 값의 build배를 넘을 때 숙소를 늘린다 (cap명까지)
  const G = GROW[c.style];
  if (c.style !== 'crowd') {
    P.recruit = roomOf(c);
    // 조를 하나 더 보냈을 때 남는 돈이 넉넉해야 짓는다 (층이 붐벼 조당 벌이가 줄면 사람만 늘리지 않는다)
    if (G.build && !c.pendingBeds && roomOf(c) <= 2 && c.members < G.cap && c.losses === 0 && partyMargin(W, i) > G.margin && c.cash > dormCost(c) * G.build) P.dorm = true;
  }
  // 두 달 넘게 적자면 허리띠를 졸라맨다
  if (c.style !== 'crowd' && (c.cash < 3000 * cashK() || c.losses >= 2)) { P.train = 0; P.base = null; P.proc = 0; P.tool = 0; P.hire = zeros(); P.pots = P.pots.map(v => Math.max(2, v - 1)); P.dorm = false; P.recruit = Math.min(P.recruit || 0, 2); }
  P.take = aiTake(W, i, P);
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
  // 지난달 신고서를 내지 않았으면 장부 그대로 낸다
  if (W.draft) closeBooks(W);
  const plans = W.cos.map((c, i) => (c.style === 'player' ? sanitize(W, c, playerPlan) : aiPlan(W, i)));
  // 이번 달 받는 납품 의뢰: 맡겠다는 양을 모아, 물량보다 많으면 명성 무게로 나눈다 (TAKE_STEP개 단위)
  jobsSign(W).forEach(J => {
    const want = plans.map(P => Math.floor(Math.min(J.qty, (P.take && P.take[J.id]) || 0) / CO.TAKE_STEP));
    const got = shareOut(want, W.cos.map(c => 1 + (c.fame || 0) / CO.FAME_K), J.qty / CO.TAKE_STEP);
    J.take = got.map(n => n * CO.TAKE_STEP);
  });
  // 탐사 계획서: 이번 달 그 층에 보내겠다고 적어 낸 조 (보낼 수 있는 조까지)
  jobsExplore(W).forEach(J => { J.take = plans.map((P, i) => clamp(Math.floor((P.take && P.take[J.id]) || 0), 0, maxParties(W.cos[i]))); });
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
  const gearB = W.cos.map((c, i) => gearBuy(c, plans[i])), torchB = W.cos.map((c, i) => torchBuy(c, plans[i]));
  const potUse = W.cos.map((c, i) => {
    const S = sups[i]; S.pot[0] = (S.pot[0] || 0) + buyM[i]; S.holy[0] = (S.holy[0] || 0) + gotC[i];
    Object.entries(gearB[i]).forEach(([g, n]) => { S.gear[g] = (S.gear[g] || 0) + n; });
    S.torch = (S.torch || 0) + torchB[i];
    const P = plans[i], have = sumOf(S.pot) + sumOf(S.holy);
    if (need[i] > have) { const r = have / need[i]; P.pots = P.pots.map(v => Math.floor(v * r)); }
    // 조마다 들고 가는 상한만 정해 두고, 실제로 쓴 만큼은 탐험이 끝난 뒤 창고에서 뺀다 (성수부터)
    return { used: 0, h: 0, holyLeft: sumOf(S.holy), short: Math.max(0, need[i] - needOf(P).pot) };
  });
  // 장비: 이번 달 들고 나갈 수 있는 벌 수 (한 벌은 조 하나만)
  const gearLeft = sups.map(S => ({ ...S.gear }));
  // 횃불: 우리 조마다 그 층만큼 꺼내 간다 (얕은 층 조부터). 모자란 조는 어둠 속으로 들어간다
  const torchLeft = sups.map(S => S.torch || 0), torchUsed = W.cos.map(() => 0), torchShort = W.cos.map(() => 0);
  const res: CoResult[] = W.cos.map(() => ({ sent: zeros(), hired: zeros(), ok: zeros(), got: zeros(), deaths: 0, sold: zeros(), sales: 0,
    win: zeros(), hurt: 0,
    spend: { sortie: 0, potion: 0, wage: 0, train: 0, base: 0, hire: 0, recruit: 0, donate: 0, root: 0, tool: 0, proc: 0, intel: 0, gear: 0, probe: 0, dorm: 0, heal: 0, hq: 0, job: 0, torch: 0, tax: 0, fine: 0 }, net: 0, recruited: 0, potNeed: 0, potC: 0, dF: zeros(),
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
  // 우리 단원 하나하나가 이번 달 어디에 가서 해냈는지, 누구와 함께였는지 (실력 · 경험 · 조직력에 쓴다)
  const outP = W.cos.map(() => new Map<number, { f: number; did: boolean; mates: number[] }>());
  const heavyP = W.cos.map(() => new Map<number, number>());   // 중상으로 쉬는 달
  const mapGain = W.cos.map(() => zeros()), mapBy: Record<number, number> = {}, map0 = FLOORS.map((_, f) => mapOf(W.cos[0], f));   // 이번 달 그려 온 지도
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
        // 층 이해도: 모르는 층일수록 덜 해내고 위기가 잦고 더 죽는다 (정찰 조는 위기가 적고 캐 오는 게 적다)
        const scout = !!(TT && TT.scout), u = teamUnd(c, f, who), U = undMods(u, mapOf(c, f), f);
        const pp = clamp(p + U.succ + kw * CO.KEY_BONUS - bw * CO.BAD_PEN + (sealed && c.style === 'player' ? CO.SEAL_SUCC : 0) - rooks * CO.ROOK_PEN - (CO.PARTY - size) * CO.SHORT_PEN, 0.05, 0.97);
        // 우리 조는 조원마다 실력 단계 · 특성 · 조직력을 더해 굴린다
        const MM = who ? memberMods(who, f, u) : null;
        // 경쟁 용병단과 계약 파티(명단이 없다)는 손발 · 실력이 붙는 만큼을 숫자로: 처음 AI_VET0, AI_VET_M달에 걸쳐 AI_VET까지
        const vet = MM ? 0 : CO.AI_VET0 + (CO.AI_VET - CO.AI_VET0) * Math.min(1, W.month / CO.AI_VET_M);
        const pm = (m: number) => clamp(pp + (MM ? MM.pp[m] : vet), 0.05, 0.97);
        const crP = (m: number, ok: boolean) => Math.min(0.95, F.risk * (ok ? CO.CRISIS_OK : CO.CRISIS_FAIL) * (MM ? MM.cr[m] : 1) * U.crisis * (scout ? CO.SCOUT_CRISIS : 1));
        // 위기: 위기마다 들고 간 포션을 한 병 쓴다. 포션이 있으면 대개 다치고 층의 harm만큼만 죽는다 (성수는 그보다 덜).
        // 포션이 없으면 CRISIS_DEATH만큼 죽는다. 다친 사람은 다음 달 한 달 쉰다 (계약 파티의 사망 · 부상은 그들 몫)
        let crisis = 0, potsIn = P.pots[f], pu = 0, dq = 0, hq = 0;
        const gone = new Set<number>();
        const hit = (m: number): '' | 'd' | 'h' => {
          crisis++;
          let die = who && who[m].tr === '강골' ? CO.CRISIS_DEATH / 2 : CO.CRISIS_DEATH, hurt = 1;
          if (potsIn > 0) {
            potsIn--; pu++; potUse[i].used++;
            const holyNow = potUse[i].holyLeft > 0; if (holyNow) { potUse[i].holyLeft--; potUse[i].h++; }
            die = Math.min(0.9, F.harm * U.harm * (holyNow ? 1 - CO.HOLY : 1)); hurt = CO.INJURE;
          }
          if (q >= P.parties[f]) return '';
          const roll = rnd();
          if (roll >= die + (1 - die) * hurt) return '';   // 포션으로 버텼다
          if (roll < die) {
            // 의무실 2단계: 죽을 사람 넷에 하나는 다치고 버틴다 (한 달 쉼, 3단계면 더 많이)
            if (who && hqLv(c, 'med') >= 2 && rnd() < (hqLv(c, 'med') >= 3 ? CO.MED_SAVE3 : CO.MED_SAVE)) { hq++; heavyP[i].set(who[m].id, 1); return 'h'; }
            gone.add(m);
            if (who) { deadP[i].add(who[m].id); dq++; return 'd'; }
            // 죽은 사람이 수습일 수도 있다 (앞자리가 수습)
            if (m < rk.length) rookDead[i].add(rk[m]);
            dq++; return 'd';
          }
          hq++; if (who && !MM!.medic) hurtP[i].add(who[m].id);   // 의무병이 있는 조는 다친 사람도 쉬지 않는다
          return 'h';
        };
        // 직영 파티는 만난 몬스터를 갈무리한다
        const got: [string, number][] = [];
        const addMat = (to: [string, number][], x: MatRef) => {
          const n = x.k ? x.k[0] + Math.floor(rnd() * (x.k[1] - x.k[0] + 1)) : 1;
          to.push([x.n, n]); const e = got.find(g => g[0] === x.n); if (e) e[1] += n; else got.push([x.n, n]);
          res[i].matSold[x.n] = (res[i].matSold[x.n] || 0) + n;
        };
        let did: boolean[], lootK: number, winK = -1, dayLog: Day[] | undefined, trip: Trip | undefined, mapK = 1;
        if (who) {
          // 우리 조의 탐사: 날마다(최대 DAYS일) 횃불을 태우고 그 층 몬스터 하나를 만난다 (다키스트 던전처럼).
          // 첫날은 횃불을 하나 켜고, 그 뒤로는 날마다 torchRate의 확률로 하나를 더 태운다. 태울 횃불이 없으면 그날 어둠 속으로 돌아선다.
          // 조우: 조원마다 성공을 굴려 둘 이상 해내면 이긴다. 이기면 전리품을 짐에 싣고 그 몬스터를 갈무리한다.
          // 위기는 날마다 조원마다 (진 사람은 크게). 짐 칸이 다 차면 돌아서고, 둘 넘게 쓰러지면 물러난다
          const slots = size * CO.SLOT_PP, want = carryOf(P, f);
          const tc = Math.min(want, torchLeft[i], slots); torchLeft[i] -= tc;
          potsIn = Math.min(potsIn, slots - tc);
          const rate = torchRate(f, u), mons3 = mons, wins = Array(size).fill(0), seen = Array(size).fill(0);
          let tu = 0, pack = 0, lootSum = 0, end: Trip['end'] = 'done';
          dayLog = [];
          for (let day = 0; day < CO.DAYS; day++) {
            const up = Array.from({ length: size }, (_, m) => m).filter(m => !gone.has(m));
            if (up.length < 2) { end = 'flee'; break; }
            if (day === 0 || rnd() < rate) { if (tu < tc) tu++; else { end = 'torch'; break; } }
            const M = pickW(mons3, CO.ENC_W);
            const dd = up.map(m => rnd() < pm(m)), kd = dd.filter(Boolean).length, win = kd >= 2;
            up.forEach((m, j) => { seen[m]++; if (dd[j]) wins[m]++; });
            const DL: Day = { mon: M.name, win, k: kd, n: up.length, mats: [], cr: 0, d: 0 };
            if (win) {
              // 전리품: 해낸 사람 몫만큼 짐 칸을 채운다 (다 쓴 횃불 · 포션 칸도 쓴다). 칸이 모자라면 두고 온다
              const l = up.reduce((a, m, j) => a + (dd[j] ? MM!.loot[m] : 0), 0) / CO.PARTY, need = l * CO.LOOT_SLOT;
              const room = Math.max(0, slots - (tc - tu) - potsIn - pack), take = Math.min(need, room);
              pack += take; lootSum += need ? l * take / need : 0; DL.loot = Math.round(take * 10) / 10;
              if (take < need) end = 'pack';
              if (q < P.parties[f]) M.mats.forEach(x => { if (rnd() < matChance(x, keys, full) * kd / CO.PARTY * CO.MAT_ENC * MM!.mat) addMat(DL.mats, x); });
            }
            up.forEach((m, j) => { if (rnd() < crP(m, dd[j]) / CO.DAYS) { DL.cr++; const o = hit(m); if (o === 'd') DL.d++; } });
            dayLog.push(DL);
            if (end === 'pack') break;
          }
          // 어둠 속 귀환: 횃불이 떨어지면 남은 사람마다 위기를 한 번 더 맞을 수 있다
          let darkCr = 0;
          if (end === 'torch') Array.from({ length: size }, (_, m) => m).filter(m => !gone.has(m)).forEach(m => { if (rnd() < Math.min(0.9, CO.DARK_MIN + crP(m, false) * CO.DARK_BACK)) { darkCr++; hit(m); } });
          torchLeft[i] += tc - tu; torchUsed[i] += tu;
          did = wins.map((w, m) => seen[m] > 0 && w * 2 >= seen[m]);
          winK = wins.reduce((a, w, m) => a + (seen[m] ? w / seen[m] * MM!.loot[m] : 0), 0);
          lootK = lootSum / CO.DAYS * CO.FIND * CO.PARTY;
          mapK = dayLog.length / CO.DAYS;
          trip = { torch: tc, tu, slots, pack: Math.round(pack * 10) / 10, rest: tc - tu + potsIn, end, dark: darkCr };
        } else {
          // 경쟁 용병단과 계약 파티: 조원마다 한 번 굴린다. 경쟁 용병단은 그 층만큼 횃불을 들고 가고, 모자라면 어둠 속으로 들어간다
          let dark = false;
          if (q < P.parties[f]) { if (torchLeft[i] >= TAX.TORCH[f]) { torchLeft[i] -= TAX.TORCH[f]; torchUsed[i] += TAX.TORCH[f]; } else { dark = true; torchShort[i]++; } }
          did = Array.from({ length: size }, (_, m) => rnd() < pm(m));
          lootK = did.filter(Boolean).length;
          if (dark) mapK = CO.DARK_MAP;
          const k0 = lootK;
          if (k0 && q < P.parties[f]) mons.forEach(m => m.mats.forEach(x => { if (rnd() < matChance(x, keys, full) * k0 / CO.PARTY) addMat([], x); }));
          for (let m = 0; m < size; m++) if (rnd() < Math.min(0.95, crP(m, did[m]) * (dark ? CO.DARK_CRISIS : 1))) hit(m);
        }
        const k = did.filter(Boolean).length, ok = k >= 2;
        if (who) who.forEach((x, m) => outP[i].set(x.id, { f, did: did[m], mates: who.map(y => y.id) }));
        // 수습은 자기가 해낸 만큼 겪는다 (경쟁 용병단의 수습은 앞자리부터 끼어 있다)
        if (c.rook) rk.forEach((t, m) => { if (did[m]) c.rook![t]++; });
        if (who) who.forEach((x, m) => { if (isRook(x) && did[m]) x.rk = (x.rk || 0) + 1; });
        // 캐 오는 몫(해낸 사람 수로 센 값)과 해낸 몫(숙련 · 길 뚫기 · 명성)
        lootW[f][i] += lootK / CO.PARTY * U.loot * (scout ? CO.SCOUT_LOOT : 1); w += (winK >= 0 ? winK : k) / CO.PARTY;
        // 지도: 다녀온 조가 그 층을 그려 온다 (해낸 사람이 많을수록, 길잡이 · 기록실 · 정찰 조면 더. 우리 조는 다닌 날만큼)
        if (q < P.parties[f]) {
          const gain = (1 + k / size) * CO.MAP_STEP[f] * (who && who.some(x => x.tr === '길잡이') ? 1.5 : 1) * (hqLv(c, 'rec') >= 1 ? 1.25 : 1) * (scout ? CO.SCOUT_MAP : 1) * mapK;
          mapGain[i][f] += gain;
          if (who && c.style === 'player') who.forEach((x, m) => { mapBy[x.id] = (mapBy[x.id] || 0) + gain * (did[m] ? 1.25 : 0.75) * (x.tr === '길잡이' ? 1.5 : 1) / size; });
        }
        if (ok) okN++;
        if (gearOut) {
          const r = res[i]; r.gearUsed[gearOut] = (r.gearUsed[gearOut] || 0) + 1;
          if (rnd() < (ok ? CO.GEAR_BREAK : CO.GEAR_LOST)) { r.gearLost[gearOut] = (r.gearLost[gearOut] || 0) + 1; sups[i].gear[gearOut]--; }
        }
        if (W.keyUse && (who ? hasKey : guideParts(gk).includes(key))) W.keyUse[f]++;
        d += dq; h += hq;
        // 우리 직영 파티만 무엇을 갖추고 갔고 어떻게 됐는지 기록해 온다 (현장 기록은 해낸 사람 비율로 센다)
        if (c.style === 'player' && q < P.parties[f]) {
          ['*', ...keys].forEach(kk => { const o = W.obs[f][kk] || (W.obs[f][kk] = { n: 0, w: 0 }); o.n++; o.w += k / size; });   // '*'는 그 층 전체
          const first = got.filter(([m]) => bookOld && !bookOld[f].has(m) && !ours.some(o => o.mats.some(g => g[0] === m))).map(([m]) => m);
          ours.push({ f, keys, ok, d: dq, mats: got, first, kit: kit.k, g: gk, crisis, pots: pu, n: size, k, hurt: hq, ...(dayLog ? { days: dayLog, trip } : {}) });
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
  // 지도: 그려 온 만큼 채운다 (남은 칸이 적을수록 덜 채워진다)
  W.cos.forEach((c, i) => { if (!c.map) c.map = FLOORS.map((_, f) => (f === 0 ? CO.MAP0 : 0)); FLOORS.forEach((_, f) => { const g = mapGain[i][f]; if (g) c.map![f] = Math.min(100, Math.round((c.map![f] + g * (1 - c.map![f] / 110)) * 10) / 10); }); });
  // 탐험에서 실제로 쓴 포션만 창고에서 뺀다 (성수부터)
  potUse.forEach((u, i) => { takeOld(sups[i].holy, u.h); takeOld(sups[i].pot, u.used - u.h); sups[i].torch = torchLeft[i]; res[i].torchUsed = torchUsed[i]; res[i].torchShort = torchShort[i]; });
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
  W.cos.forEach(c => {
    if (c.pendingBeds) { c.beds = bedsOf(c) + c.pendingBeds; c.pendingBeds = 0; }
    if (c.pendingHq && c.hq) { c.hq[c.pendingHq] = hqLv(c, c.pendingHq) + 1; delete c.pendingHq; }   // 지난달 공사가 끝났다
  });
  const apps = W.apps ?? CO.APP0;
  // 우리는 지원자 명단에서 사람을 골라 뽑는다 (빈 침상까지)
  const rWantP = W.cos.map((c, i) => (c.crew ? candWants(W, c, plans[i], Math.max(0, bedsOf(c) - (c.members - res[i].deaths))) : null));
  const rWant = W.cos.map((c, i) => {
    if (c.style === 'crowd') return 0;
    if (rWantP[i]) return rWantP[i]!.length;
    const room = Math.max(0, bedsOf(c) - (c.members - res[i].deaths)), P = plans[i];
    return P.recruit == null ? room : clamp(Math.floor(P.recruit), 0, room);
  });
  const rGot = shareOut(rWant, W.cos.map(c => 1 + (c.fame || 0) / CO.FAME_K), apps);
  const rPrice = recruitPrice(rWant.reduce((a, b) => a + b, 0), apps);
  // 공표된 경쟁: 모두의 이번 달 해낸 조를 먼저 쌓고 순위를 본다
  jobsOpen(W).forEach(J => { if (J.kind !== 'deliver' && J.score) W.cos.forEach((_, i) => { J.score![i] += res[i].win[J.f]; }); });
  W.cos.forEach((c, i) => {
    const P = plans[i], r = res[i];
    // 상단 경매장(가죽·마석)은 단골을 조금 더 쳐준다: 상단과의 사이에 따라 ±5%
    const favor = (j: number) => (j <= 1 ? 1 + ((c.relM ?? 50) - 50) / 1000 : 1);
    r.lootSales = 0;
    ITEMS.forEach((_, j) => { r.sold[j] = sold[i][j]; const v = Math.round(sold[i][j] * price[j] * favor(j)); r.sales += v; r.lootSales! += v; });
    // 보급 창고를 한 달 묵힌다: 기한을 넘긴 포션 묶음은 상해서 버린다
    const S = supOf(c); r.potSpoil = ageLots(S.pot, CO.POT_KEEP) + ageLots(S.holy, CO.HOLY_KEEP);
    const pot = gotC[i] * pc[i] + buyM[i] * potion;
    const sortie = sortieCost(P).reduce((a, b) => a + b, 0);
    r.potNeed = buyM[i] + gotC[i]; r.potC = gotC[i]; r.potUsed = potUse[i].used; r.potShort = potUse[i].short;
    // 신입: 찾은 만큼 중 지원자에서 받은 만큼. 모두 같은 값을 낸다 (군소 용병대는 따로)
    r.recruitWant = rWant[i]; r.recruited = rGot[i]; r.recruitPrice = rPrice;
    // 우리는 고른 순서대로 받은 수만큼 들어온다 (나머지는 다른 용병단으로 갔다). 값은 사람마다: 드문 직업 · 실력 단계
    let rCost = r.recruited * rPrice;
    if (rWantP[i]) {
      const got = rWantP[i]!.slice(0, r.recruited);
      r.newP = got.map(x => x.id); r.recruitC = {};
      got.forEach(x => { r.recruitC![x.c] = (r.recruitC![x.c] || 0) + 1; });
      rCost = got.reduce((a, x) => a + candPrice(x, rPrice), 0);
    }
    // 숙소: 침상 유지비와 증축 값 (공사 중엔 더 짓지 않는다)
    const build = c.style !== 'crowd' && !c.hq && P.dorm && !c.pendingBeds ? dormCost(c) : 0;
    // 본부 공사 (우리): 이번 달 값을 치르고 다음 달 정산 때 완공
    const hqB = c.hq && P.build && !c.pendingHq ? hqCost(c, P.build) : 0;
    // 의뢰: 납품은 이번 달 판 것 중 맡은 만큼 넘기고 개당 웃돈을 받는다. 끝나는 달엔 못 채운 개수만큼 위약금.
    // 공표된 경쟁은 그 층에서 해낸 조 수를 쌓고, 끝나는 달에 순위대로 포상
    let jobPay = 0, jobPen = 0; r.jobs = [];
    jobsOpen(W).forEach(J => {
      if (J.kind === 'deliver') {
        const n = Math.max(0, Math.min(sold[i][J.f], J.take[i] - J.done[i])); J.done[i] += n; const pay = Math.round(n * J.prem);
        const pen = J.until === W.month ? Math.round((J.take[i] - J.done[i]) * J.pen) : 0;
        jobPay += pay; jobPen += pen; if (J.take[i]) r.jobs!.push({ id: J.id, got: n, pay, pen });
      } else if (J.score) {
        if (J.until === W.month && c.style !== 'crowd') {
          const order = W.cos.map((o, k) => [k, o.style === 'crowd' ? -1 : J.score![k]] as [number, number]).sort((a, b) => b[1] - a[1] || a[0] - b[0]), rank = order.findIndex(x => x[0] === i);
          const pay = (J.prize || [])[rank] || 0; jobPay += pay; r.jobFame = (r.jobFame || 0) + ((J.fame || [])[rank] || 0);
          if (rank === 0) W.log.push({ m: W.month, t: `${J.by}이 "${J.title}"의 첫 포상을 ${c.name}에 내렸다. ${FLOORS[J.f].name}에서 석 달 동안 ${J.score[i].toFixed(1)}조가 해냈다.` });
          r.jobs!.push({ id: J.id, got: Math.round(J.score[i] * 10) / 10, pay, pen: 0, rank: rank + 1 });
        } else r.jobs!.push({ id: J.id, got: Math.round(J.score[i] * 10) / 10, pay: 0, pen: 0 });
      }
    });
    r.jobPay = jobPay; r.sales += jobPay;
    // 탐사 계획서의 선금: 적어 낸 조마다 바로 받는다 (덜 보냈으면 가정산에서 돌려낸다)
    const EX = jobsExplore(W)[0];
    if (EX && EX.take[i]) { r.adv = EX.take[i] * EX.prem; r.sales += r.adv; }
    r.spend = { sortie, potion: pot, wage: wageCo(c), train: P.train, base: P.base ? P.base.amt : 0, hire: hireCost(P), recruit: rCost, donate: Math.max(0, Math.floor(P.donate || 0)), root: P.root ? P.root.seal + P.root.mine : 0,
      tool: toolCost(P), proc: Math.max(0, Math.floor(P.proc || 0)), intel: c.style === 'player' ? intelCost(P) : 0,
      gear: Object.values(gearB[i]).reduce((a, b) => a + b, 0) * CO.GEAR_PRICE, probe: c.style === 'player' ? probeCost(W) : 0,
      dorm: c.style === 'crowd' ? 0 : dormKeep(bedsOf(c)) + build + (P.build === 'dorm' ? hqB : 0), heal: Math.round(r.hurt * CO.HEAL_COST * (hqLv(c, 'med') >= 1 ? 0.5 : 1)),
      hq: hqKeep(c) + (P.build !== 'dorm' ? hqB : 0), job: jobPen, torch: torchB[i] * CO.TORCH_PRICE, tax: 0, fine: 0 };
    if (build) { c.pendingBeds = CO.DORM_ADD; c.dorms = (c.dorms || 0) + 1; }
    if (hqB) c.pendingHq = P.build;
    // 지도 사본: 다 그린 층의 지도를 관리국에 판다 (한 층에 한 번). 산 쪽(다른 용병단)의 지도도 MAP_GIVE만큼 오른다
    if (P.sellMap != null && c.map && c.map[P.sellMap] >= 100 && hqLv(c, 'rec') >= 3 && !(c.mapSold && c.mapSold[P.sellMap])) {
      const f = P.sellMap; r.mapSale = CO.MAP_COPY; r.sales += CO.MAP_COPY; (c.mapSold || (c.mapSold = FLOORS.map(() => false)))[f] = true;
      W.cos.forEach(o => { if (o !== c && o.map) o.map[f] = Math.min(100, o.map[f] + CO.MAP_GIVE); });
      W.log.push({ m: W.month, t: `${c.name}이 ${FLOORS[f].name} 지도 사본을 관리국에 넘겼다는 소문이다.` });
    }
    // 가정산: 장부의 참값을 모은다. 우리는 화면에서 신고서를 고쳐 내고(closeBooks), 경쟁 용병단은 성향대로 바로 낸다
    const D = draftOf(W, i, r, matP, P);
    if (c.style === 'player') W.draft = D; else settle(W, i, D, aiFiling(W, i, D), r);
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
    c.fame = Math.max(0, (c.fame || 0) * CO.FAME_FADE + r.win.reduce((a, n, f) => a + n * CO.FAME_F[f], 0) - r.deaths * CO.FAME_DEATH + (r.jobFame || 0));
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
      crew.forEach(x => { if (x.hurt) { x.hurt--; if (!x.hurt) delete x.hurt; } if (hurtP[i].has(x.id)) x.hurt = 1; if (heavyP[i].has(x.id)) x.hurt = heavyP[i].get(x.id); });
      for (let extra = r.deaths - deadP[i].size; extra > 0 && crew.length; extra--) crew.splice(Math.floor(rnd() * crew.length), 1);
      r.rookDead = c.crew.filter(x => isRook(x) && !crew.includes(x)).length;
      r.rookDone = crew.filter(x => isRook(x) && x.rk! >= CO.ROOK_WINS).length;
      crew.forEach(x => { if (isRook(x) && x.rk! >= CO.ROOK_WINS) delete x.rk; });
      // 다녀온 사람: 실력과 그 층 경험이 오르고, 함께 나간 짝과의 달이 쌓인다 (다른 조로 옮기면 새로 쌓는다)
      const alive = new Set(crew.map(x => x.id));
      crew.forEach(x => {
        const o = outP[i].get(x.id); if (!o) return;
        // 실력: 훈련장 1단계면 ×TRAIN_GROW, 2단계면 신입은 두 배. 명인(80~)은 훈련장 3단계부터
        const tl = hqLv(c, 'train'), g = (o.did ? CO.SK_WIN : CO.SK_TRY) * (tl >= 1 ? CO.TRAIN_GROW : 1) * (tl >= 2 && tierOf(x) === 0 ? 2 : 1);
        x.sk = Math.min(tl >= 3 ? 100 : CO.SK_CAP, Math.max(x.sk ?? 40, Math.round(((x.sk ?? 40) + g) * 10) / 10));
        const ex = x.ex || (x.ex = FLOORS.map(() => 0)); ex[o.f] = Math.min(100, (ex[o.f] || 0) + (o.did ? CO.EX_WIN : CO.EX_TRY));
        if (o.did) x.wins = (x.wins || 0) + 1;
        const mt: Record<number, number> = {}; o.mates.forEach(id => { if (id !== x.id && alive.has(id)) mt[id] = Math.min(CO.CO_MAX, ((x.mt && x.mt[id]) || 0) + 1); }); x.mt = mt;
      });
      // 신입: 고른 지원자가 새 번호를 받고 들어온다
      (r.newP || []).forEach(cid => { const x = (W.cand || []).find(y => y.id === cid); if (x) crew.push({ ...x, id: c.nextId = (c.nextId || crew.length) + 1, ex: FLOORS.map(() => 0), mt: {}, wins: 0 }); });
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
  const M: MonthResult = { month: W.month, res, plans, Q, price, potion, potQ, potionC, cartel: !!K, floors, perParty, opened, rank, ours, pressure: Math.round(W.pressure || 0), overflow, matPrice: matP, matRef, apps, fc, map0, mapBy };
  W.last = M; W.history.push(M); W.month++;
  // 다음 달 마을 지원자: 미궁 벌이가 좋을수록 많이 몰려온다
  W.apps = Math.round((CO.APP_BASE + CO.APP_PER * res.reduce((a, r) => a + r.sales, 0) / 1000) * (0.8 + 0.4 * rnd()));
  W.cand = candsOf(W);
  postJobs(W);
  if (opened != null) postExplore(W, opened);
  legislate(W);
  demands(W);
  estimate(W);
  return M;
}

// ---------- 영주청: 법령 · 가정산 · 신고 · 감사 ----------
// 법령은 그달(m)에 효력이 있는 것만 센다
export const lawsAt = (W: World, m = W.month) => (W.laws || []).filter(L => L.from <= m && m <= L.until);
export const lootRate = (W: World, m = W.month) => Math.round((TAX.LOOT + lawsAt(W, m).filter(L => L.kind === 'loot').reduce((a, L) => a + (L.rate || 0), 0)) * 100) / 100;
export const matTaxed = (W: World, m = W.month) => [...new Set(lawsAt(W, m).filter(L => L.kind === 'mat').map(L => L.m!))];
export const subMul = (W: World, m = W.month) => lawsAt(W, m).filter(L => L.kind === 'sub').reduce((a, L) => Math.min(a, L.rate ?? 1), 1);
export const aidAt = (W: World, m = W.month) => lawsAt(W, m).find(L => L.kind === 'aid') || null;
// 대조 강화: 그 칸이 걸릴 확률과 의심 무게 (스캔들 뒤 법령으로 오른다)
const checked = (W: World, k: FileKey, m: number) => lawsAt(W, m).some(L => L.kind === 'check' && L.k === k);
export const detOf = (W: World, k: FileKey, m = W.month) => Math.min(0.95, TAX.DET[k] * (checked(W, k, m) ? TAX.CHECK_DET : 1));
export const susWOf = (W: World, k: FileKey, m = W.month) => TAX.SUS_W[k] * (checked(W, k, m) ? TAX.CHECK_SUS : 1);
// 재정 압박 (0~1): 이어진 적자와, 금고가 지난달 지출 몇 달 치인지
export function pressureOf(W: World, i: number) {
  const c = W.cos[i], r = W.last ? W.last.res[i] : null, spend = r ? Object.values(r.spend).reduce((a, b) => a + b, 0) : 0;
  const run = spend > 0 ? c.cash / spend : TAX.PRESS_RUN;
  return clamp(TAX.PRESS_LOSS * (c.losses || 0) + Math.max(0, (TAX.PRESS_RUN - run) / TAX.PRESS_RUN), 0, 1);
}
// 조마다 들고 가는 횃불 (깊은 층일수록 많이)
export const torchOf = (parties: number[]) => parties.reduce((a, n, f) => a + n * TAX.TORCH[f], 0);
// 층 한 조가 캐 오는 기준 값 (지원금 · 선금 단가의 기준)
const floorUnit = (f: number) => FLOORS[f].take * ITEMS[f].P0;

// 장부의 참값: 전리품 판매액, 과세 소재 판매액, 위기에 쓴 포션, 들고 간 횃불, 지원금 층 · 선금 층에 보낸 조
function draftOf(W: World, i: number, r: CoResult, matP: Record<string, number>, P: Plan): Draft {
  const m = W.month, c = W.cos[i], taxed = matTaxed(W, m), aid = aidAt(W, m), EX = jobsExplore(W)[0];
  const advN = EX ? EX.take[i] || 0 : 0;
  const truth: Filing = {
    loot: r.lootSales || 0, mat: taxed.reduce((a, n) => a + (r.matSold[n] || 0) * (matP[n] || 0), 0), pot: r.potUsed,
    torch: r.torchUsed || 0, aid: aid ? r.sent[aid.f!] : 0, adv: EX ? Math.min(advN, r.sent[EX.f]) : 0,
  };
  return { m, i, truth, lootRate: lootRate(W, m), relief: (TAX.RELIEF[c.style] || 0) * (m <= (c.taint || 0) ? 0.5 : 1), matRate: TAX.MAT_RATE, matTaxed: taxed, subPot: TAX.SUB_POT * subMul(W, m), subTorch: TAX.SUB_TORCH * subMul(W, m),
    aidF: aid ? aid.f! : -1, aidAmt: aid ? aid.amt! : 0, advF: EX ? EX.f : -1, advN, advPer: EX ? EX.prem : 0, donate: Math.max(0, Math.floor(P.donate || 0)), losses0: c.losses };
}
// 신고서를 규칙 안으로: 판매액은 참값을 넘겨 적을 까닭이 없고, 포션 · 횃불은 참값의 몇 배까지, 조는 보낼 수 있는 만큼까지
export function fileFix(W: World, D: Draft, F: Partial<Filing>): Filing {
  const T = D.truth, n = (k: FileKey) => Math.max(0, Math.floor(F[k] ?? T[k])), cap = maxParties(W.cos[D.i]) + 4;
  return {
    loot: Math.min(T.loot, n('loot')), mat: Math.min(T.mat, n('mat')), pot: Math.min(Math.max(T.pot * 3, T.pot + 12), n('pot')),
    torch: Math.min(T.torch * 2, n('torch')), aid: D.aidF >= 0 ? Math.min(cap, n('aid')) : 0, adv: Math.min(D.advN, n('adv')),
  };
}
// 고지서: 낼 세금(후원금 공제 뒤), 받을 지원금, 선금 반납
export function billOf(D: Draft, F: Filing): Bill {
  const lootTax = Math.round(F.loot * D.lootRate * (1 - (D.relief || 0))), matTax = Math.round(F.mat * D.matRate), credit = Math.min(lootTax + matTax, Math.round(D.donate * TAX.DONATE_CREDIT));
  return { lootTax, matTax, credit, tax: lootTax + matTax - credit, sub: Math.round(F.pot * D.subPot + F.torch * D.subTorch), aid: F.aid * D.aidAmt,
    refund: Math.round(Math.max(0, D.advN - F.adv) * D.advPer * TAX.ADV_REFUND) };
}
// 칸마다 신고서로 얻은 이득 (참값대로 냈을 때보다 덜 낸 세금 · 더 받은 지원금 · 덜 돌려낸 선금)
export function gainOf(D: Draft, F: Filing): Record<FileKey, number> {
  const T = D.truth, pos = (v: number) => Math.max(0, Math.round(v));
  return { loot: pos((T.loot - F.loot) * D.lootRate * (1 - (D.relief || 0))), mat: pos((T.mat - F.mat) * D.matRate), pot: pos((F.pot - T.pot) * D.subPot), torch: pos((F.torch - T.torch) * D.subTorch),
    aid: pos((F.aid - T.aid) * D.aidAmt), adv: pos((F.adv - T.adv) * D.advPer * TAX.ADV_REFUND) };
}
// 감사 확률 (의심에서)
export const auditChance = (sus: number) => clamp((sus - TAX.SUS_FREE) / TAX.SUS_SPAN, 0, TAX.AUDIT_MAX);
// 이 신고서를 내면: 고지서, 정직하게 냈을 때의 고지서, 이득, 쌓일 의심, 이번 달 감사 확률 (상태를 쓰지 않고 난수도 쓰지 않는다)
export function preview(W: World, D: Draft, F0: Partial<Filing>) {
  const F = fileFix(W, D, F0), bill = billOf(D, F), honest = billOf(D, D.truth), gain = gainOf(D, F), c = W.cos[D.i];
  const base = Math.max(TAX.SUS_BASE, honest.tax + honest.sub + honest.aid);
  const add = TAX.SUS_K * FILE_KEYS.reduce((a, k) => a + susWOf(W, k, D.m) * gain[k], 0) / base;
  const sus = (c.sus || 0) * TAX.SUS_FADE + add, watched = D.m <= (c.watch || 0);
  return { F, bill, honest, gain, total: FILE_KEYS.reduce((a, k) => a + gain[k], 0), add, sus, chance: Math.max(auditChance(sus), watched ? TAX.WATCH : 0), watched };
}
// 신고서를 낸다: 고지서대로 금고가 움직이고(세금 · 반납은 지출, 지원금은 수입), 의심이 쌓이고, 감사가 올 수 있다
function settle(W: World, i: number, D: Draft, F0: Partial<Filing>, r: CoResult) {
  const c = W.cos[i], X = preview(W, D, F0);
  r.spend.tax = X.bill.tax + X.bill.refund; r.sales += X.bill.sub + X.bill.aid;
  W.subPaid = (W.subPaid || 0) + X.bill.sub;
  c.sus = X.sus;
  const books = (c.books || []).filter(b => b.m > D.m - TAX.AUDIT_BACK);
  if (X.total) books.push({ m: D.m, gain: Object.fromEntries(FILE_KEYS.filter(k => X.gain[k]).map(k => [k, X.gain[k]])) });
  c.books = books;
  r.file = { truth: { ...D.truth }, filed: X.F, bill: X.bill, gain: X.total };
  if (!X.chance || rnd() >= X.chance) return;
  // 감사: 지난 장부를 출처마다 다른 기록과 맞대 본다. 걸린 이득에 AUDIT_PEN배를 더해 추징하고, 의심과 묵은 장부는 지운다
  let found = 0; const hit = new Set<FileKey>(), by: Partial<Record<FileKey, number>> = {};
  books.forEach(b => FILE_KEYS.forEach(k => { const g = b.gain[k] || 0; if (g && rnd() < detOf(W, k, D.m)) { found += g; hit.add(k); by[k] = (by[k] || 0) + g; } }));
  const fine = Math.round(found * (1 + TAX.AUDIT_PEN));
  r.spend.fine = fine; r.file.audit = { found, fine, hit: [...hit] };
  c.sus = 0; c.books = []; c.audits = (c.audits || 0) + 1;
  if (fine) c.fame = Math.max(0, (c.fame || 0) - TAX.AUDIT_FAME);
  if (found >= TAX.SCANDAL_G) { scandal(W, c, D.m, found, fine, by); r.file.audit.scandal = true; return; }
  const srcs = (h: Set<FileKey>) => [...h].map(k => FILE_SRC[k]).filter((x, j, a) => a.indexOf(x) === j).join(' · ');
  W.log.push({ m: D.m, t: fine
    ? `영주청 회계관이 ${c.name}의 장부를 ${srcs(hit)}${jo(srcs(hit), '과', '와')} 맞대 보고 추징금 ${fine.toLocaleString('ko-KR')}G를 물렸다. 회계관은 "장부가 참 정성스럽더군요"라고만 했다.`
    : `영주청 회계관이 ${c.name}의 장부를 살피고 돌아갔다. 별다른 말은 없었다고 한다.` });
}
// 법령 하나를 고시한다 (at: 고시한 것이 보이는 달)
function addLaw(W: World, x: Omit<Law, 'id' | 'at'>, at: number, t: string) {
  W.lawSeq = (W.lawSeq || 0) + 1; (W.laws || (W.laws = [])).push({ ...x, id: W.lawSeq, at }); W.log.push({ m: at - 1, t });
}
// 스캔들: 크게 걸린 감사. 그 용병단은 한동안 감면이 절반이고 감시가 붙는다. 영주청은 가장 크게 걸린 칸을 모두에게 더 꼼꼼히 본다
function scandal(W: World, c: Company, m: number, found: number, fine: number, by: Partial<Record<FileKey, number>>) {
  c.taint = m + TAX.TAINT_LEN; c.watch = m + TAX.TAINT_LEN; c.scandals = (c.scandals || 0) + 1;
  c.fame = Math.max(0, (c.fame || 0) - TAX.SCANDAL_FAME);
  const k = (Object.entries(by) as [FileKey, number][]).sort((a, b) => b[1] - a[1])[0][0], fmtG = (v: number) => v.toLocaleString('ko-KR');
  W.log.push({ m, t: `스캔들: ${c.name}의 장부에서 ${fmtG(found)}G가 ${FILE_SRC[k]}${jo(FILE_SRC[k], '과', '와')} 맞지 않았다. 추징금 ${fmtG(fine)}G. 영주께서는 "변경의 장부는 변경의 얼굴"이라 하셨고, ${c.name}${jo(c.name, '은', '는')} 한동안 영주청의 눈을 피하기 어렵게 됐다.` });
  const at = m + 1, from = m + 2, until = m + 1 + TAX.CHECK_LEN, old = (W.laws || []).find(L => L.kind === 'check' && L.k === k && L.until >= from);
  if (old) { old.until = Math.max(old.until, until); W.log.push({ m, t: `영주청이 ${FILE_SRC[k]} 대조를 제${old.until}월까지 늘린다고 고시했다.` }); }
  else addLaw(W, { kind: 'check', k, rate: TAX.CHECK_DET, from, until }, at, `영주청이 다음 달부터 신고서의 ${CHECK_WHAT[k]}${jo(CHECK_WHAT[k], '을', '를')} ${FILE_SRC[k]}${jo(FILE_SRC[k], '과', '와')} 더 꼼꼼히 맞대 보겠다고 고시했다. 모든 용병단에 같다.`);
  if (k === 'pot' || k === 'torch') addLaw(W, { kind: 'sub', rate: 0.5, from, until }, at, `영주청이 ${c.name} 일을 들어 다음 달부터 ${TAX.CHECK_LEN}달 동안 보급 지원금을 절반으로 줄인다고 고시했다.`);
}
const CHECK_WHAT: Record<FileKey, string> = { loot: '전리품 판매액', mat: '소재 판매액', pot: '포션 사용', torch: '횃불', aid: '지원금 층 출입', adv: '계획서 층 출입' };
// 우리 가정산을 마친다 (신고서를 비워 두면 장부 그대로). 금고 · 순이익 · 순위를 고친다
export function closeBooks(W: World, F: Partial<Filing> = {}) {
  const D = W.draft; if (!D) return null;
  const M = W.history.find(x => x.month === D.m); if (!M) { W.draft = null; return null; }
  const c = W.cos[D.i], r = M.res[D.i], before = r.net;
  settle(W, D.i, D, F, r);
  r.net = r.sales - Object.values(r.spend).reduce((a, b) => a + b, 0);
  c.cash += r.net - before;
  c.losses = r.net < 0 ? D.losses0 + 1 : 0;
  M.rank = rankNow(W);
  W.draft = null;
  return r.file || null;
}
const rankNow = (W: World) => W.cos.filter(c => c.style !== 'crowd').map(c => [worth(W, c), c.id] as [number, string]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
// 경쟁 용병단의 신고: 평소엔 성향만큼 조금(e0) 고치고, 재정 압박이 클수록(push) 과감해진다. 의심이 stop을 넘으면 몸을 사리지만,
// 압박이 크면 그 선도 올라간다(궁지에 몰리면 위험을 무릅쓴다). 아주 몰리면 지원금 층에 보낸 조까지 부풀린다
const EVADE: Partial<Record<Style, { e0: number; push: number; stop: number }>> = {
  volume: { e0: 0.04, push: 0.3, stop: 20 }, steady: { e0: 0, push: 0.15, stop: 12 }, deep: { e0: 0.03, push: 0.3, stop: 18 }, chaser: { e0: 0.08, push: 0.45, stop: 35 },
  hoarder: { e0: 0.04, push: 0.3, stop: 20 }, shallow: { e0: 0.06, push: 0.35, stop: 25 }, second: { e0: 0.03, push: 0.25, stop: 18 },
};
function aiFiling(W: World, i: number, D: Draft): Filing {
  const c = W.cos[i], E = EVADE[c.style], T = D.truth, p = pressureOf(W, i);
  if (!E || (c.sus || 0) > E.stop + 60 * p) return { ...T };
  const e = E.e0 + E.push * p;
  if (!e) return { ...T };
  return { loot: Math.round(T.loot * (1 - e)), mat: Math.round(T.mat * (1 - e)), pot: Math.round(T.pot * (1 + 2 * e)), torch: Math.round(T.torch * (1 + 2 * e)),
    aid: p >= 0.6 && D.aidF >= 0 && T.aid ? T.aid + 1 + Math.floor(2 * p) : T.aid, adv: T.adv };
}
// 탐사 계획서: 새 층이 열리면 영주청이 ADV_LEN달 동안 그 층에 보낼 조의 선금을 내건다 (앞의 것은 닫는다)
function postExplore(W: World, f: number) {
  const m = W.month, N = W.cos.length;
  (W.jobs || []).forEach(J => { if (J.kind === 'explore' && J.until >= m) J.until = m - 1; });
  W.jobSeq = (W.jobSeq || 0) + 1;
  (W.jobs || (W.jobs = [])).push({ id: W.jobSeq, by: '영주', kind: 'explore', title: `${FLOORS[f].name} 탐사 계획서`, f, qty: 0, prem: Math.round(floorUnit(f) * TAX.ADV_K), pen: TAX.ADV_REFUND,
    from: m, until: m + TAX.ADV_LEN - 1, take: Array(N).fill(0), done: Array(N).fill(0) });
  W.log.push({ m: m - 1, t: `영주청이 ${FLOORS[f].name} 탐사 계획서를 받는다고 고시했다. 적어 낸 조마다 선금을 먼저 내준다고 한다.` });
}
// 법령: 영주청은 상태만 보고 정한다 (난수 없이). 고시한 다음 달부터 효력이 난다
function legislate(W: World) {
  const m = W.month, L = W.last, laws = W.laws || (W.laws = []);
  const add = (x: Omit<Law, 'id' | 'at'>, t: string) => addLaw(W, x, m, t);
  // 범람 복구세
  if (L && L.overflow) add({ kind: 'loot', rate: TAX.FLOOD_UP, from: m + 1, until: m + TAX.FLOOD_LEN }, `영주청이 범람 복구에 쓸 돈을 모은다며 다음 달부터 ${TAX.FLOOD_LEN}달 동안 전리품 세금을 ${Math.round(TAX.FLOOD_UP * 100)}%p 올린다고 고시했다.`);
  // 보급 지원금: 모두에게 준 돈이 예산을 넘으면 줄이고, 다시 넘으면 끊는다
  const cut = TAX.SUB_BUDGET.filter(b => (W.subPaid || 0) >= b).length, had = laws.filter(x => x.kind === 'sub' && x.until >= 999).length;
  if (cut > had) add({ kind: 'sub', rate: cut >= 2 ? 0 : 0.5, from: m + 1, until: 999 }, cut >= 2
    ? '영주청이 보급 지원금을 다음 달부터 끊는다고 고시했다. 예산이 바닥났다는 말 끝에 "요즘 포션을 참 많이들 쓰시더군요"라는 말이 붙었다.'
    : '영주청이 보급 지원금을 다음 달부터 절반으로 줄인다고 고시했다. 예산보다 빨리 나간다는 이유를 들었다.');
  if (m < 5 || (m - 5) % 4) return;
  // 넉 달마다: 소재 과세와 층 지원금
  const H = W.history.slice(-3);
  const matV: Record<string, number> = {}; let lootV = 0;
  H.forEach(M => { lootV += M.Q.reduce((a, q, j) => a + q * M.price[j], 0); M.res.forEach(r => Object.entries(r.matSold).forEach(([n, k]) => { matV[n] = (matV[n] || 0) + k * (M.matPrice[n] || 0); })); });
  const taxed = new Set(laws.filter(x => x.kind === 'mat' && x.until >= m).map(x => x.m)), allMat = Object.values(matV).reduce((a, b) => a + b, 0);
  const top = Object.entries(matV).filter(([n]) => !taxed.has(n)).sort((a, b) => b[1] - a[1])[0];
  if (top && allMat >= TAX.MAT_SHARE * lootV) add({ kind: 'mat', m: top[0], rate: TAX.MAT_RATE, from: m + 1, until: m + TAX.MAT_LEN }, `영주청이 ${top[0]}을(를) 다음 달부터 시장에 정식 등록하고 ${Math.round(TAX.MAT_RATE * 100)}% 세금을 매긴다고 고시했다. 영주께서는 "고루 나누는 뜻"이라 하셨다.`);
  if (L && !laws.some(x => x.kind === 'aid' && x.until > m)) {
    const open = FLOORS.map((F, f) => ({ f, r: L.plans.reduce((a, P) => a + P.parties[f] + P.hire[f], 0) / F.cap })).filter(x => x.f >= 1 && x.f < W.unlocked).sort((a, b) => a.r - b.r);
    if (open.length && open[0].r < 0.8) {
      const f = open[0].f, amt = Math.round(floorUnit(f) * TAX.AID_K);
      add({ kind: 'aid', f, amt, from: m + 1, until: m + TAX.AID_LEN }, `영주청이 다음 달부터 ${TAX.AID_LEN}달 동안 ${FLOORS[f].name}에 들어가는 조마다 ${amt}G를 지원한다고 고시했다. 그 층에서 나오는 물건이 모자라다는 이유다.`);
    }
  }
}
// 이번 달 결재안의 어림 (정직하게 신고할 때): 영주세, 보급 · 층 지원금, 탐사 선금
export function taxGuess(W: World, P: Plan, fc: Forecast) {
  const m = W.month, aid = aidAt(W, m), EX = jobsExplore(W)[0], mul = subMul(W, m);
  const adv = EX ? clamp(Math.floor((P.take && P.take[EX.id]) || 0), 0, maxParties(us(W))) * EX.prem : 0;
  return { tax: Math.round((fc.loot || 0) * lootRate(W, m)), sub: Math.round(((fc.crisis || 0) * TAX.SUB_POT + (fc.torch ?? torchOf(P.parties)) * TAX.SUB_TORCH) * mul), aid: aid ? P.parties[aid.f!] * aid.amt! : 0, adv };
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
  Q.pots = Q.pots.map(v => clamp(Math.floor(v), 0, 8));
  if (Q.torch) Q.torch = FLOORS.map((_, f) => (Q.torch![f] != null ? clamp(Math.floor(Q.torch![f]), 0, CO.DAYS) : TAX.TORCH[f]));   // 포션 없이 보내도 된다 (위기를 그대로 맞는다)
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
  // 본부(우리): 숙소 증축(dorm)은 숙소 단계 올리기로. 공사 중이거나 끝까지 올린 것은 짓지 않는다
  if (c.hq) {
    if (Q.dorm && !Q.build) Q.build = 'dorm';
    Q.dorm = false;
    if (!Q.build || !CO.HQ_COST[Q.build] || c.pendingHq || !hqCost(c, Q.build)) delete Q.build;
  } else delete Q.build;
  // 우리(명단이 있는 쪽): 교관이 훈련비가 되고, 옛 숫자 칸(채집 도구 · 갈무리장 · 거점 공사비)은 쓰지 않는다
  if (c.crew) {
    if (Q.coach != null) Q.coach = clamp(Math.floor(Q.coach), 0, CO.COACH_PAY.length - 1);
    if (Q.coach != null) Q.train = CO.COACH_PAY[Q.coach];
    Q.tool = 0; Q.proc = 0; Q.base = null;
  }
  // 납품 의뢰는 받는 달에만, TAKE_STEP개 단위로 물량까지
  // 탐사 계획서는 이번 달 보낼 수 있는 조까지
  if (Q.take) { const sign = jobsSign(W), ex = jobsExplore(W); Q.take = Object.fromEntries(Object.entries(Q.take).map(([k, v]) => { const J = sign.find(x => x.id === +k), E = ex.find(x => x.id === +k); return [k, J ? Math.min(J.qty, Math.max(0, Math.floor((v || 0) / CO.TAKE_STEP) * CO.TAKE_STEP)) : E ? clamp(Math.floor(v || 0), 0, maxParties(c)) : 0]; }).filter(([, v]) => v)); }
  if (Q.sellMap != null && !(c.map && c.map[Q.sellMap] >= 100 && hqLv(c, 'rec') >= 3 && !(c.mapSold && c.mapSold[Q.sellMap]))) delete Q.sellMap;
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
    Q.buy = { pot: Q.buy.pot == null ? undefined : Math.max(0, Math.floor(Q.buy.pot)), holy: Math.max(0, Math.floor(Q.buy.holy || 0)), gear: g, torch: Q.buy.torch == null ? undefined : Math.max(0, Math.floor(Q.buy.torch)) };
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
      f: T.f, g: GEARS.includes((T.g || '').slice(2)) && T.g !== 'g:일반' ? T.g : '', ...(T.scout ? { scout: true } : {}),
      m: [0, 1, 2, 3].map(s => { const id = T.m[s]; if (id == null || !ids.has(id) || seen.has(id)) return null; seen.add(id); return id; }),
    })).filter(T => T.m.some(x => x != null));
    // 정찰 조: 기록실 2단계부터, 셋 이하인 조만
    Q.teams.forEach(T => { if (T.scout && !(hqLv(c, 'rec') >= 2 && T.m.filter(x => x != null).length <= 3)) delete T.scout; });
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
  let dead = 0, hurt = 0, maxV = 0, floorLoss = 0, lootE = 0, crisis = 0, burn = 0;
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
      // 층 이해도 (계약 파티는 우리 지도를 모른다고 보지 않고 지도만큼)
      const scout = !!(T && T.scout), u = teamUnd(c, f, who), U = undMods(u, mapOf(c, f), f);
      const pt0 = clamp(p0 + U.succ - rooks * CO.ROOK_PEN - (CO.PARTY - size) * CO.SHORT_PEN, 0.05, 0.97);
      // 우리 조는 조원마다 실력 단계 · 특성 · 조직력을 더한 성공률의 평균으로 (조원끼리 다른 성공률을 하나로 어림)
      const MM = who && who.length ? memberMods(who, f, u) : null;
      const pt = MM ? MM.pp.reduce((a, d) => a + clamp(pt0 + d, 0.05, 0.97), 0) / who!.length : pt0;
      const crM = (MM ? MM.cr.reduce((a, x) => a + x, 0) / who!.length : 1) * U.crisis * (scout ? CO.SCOUT_CRISIS : 1), loM = (MM ? MM.loot.reduce((a, x) => a + x, 0) / who!.length : 1) * U.loot * (scout ? CO.SCOUT_LOOT : 1);
      const keys = who ? [...new Set(who.map(x => 'c:' + x.c)), ...(T!.g ? [T!.g] : [])] : [];
      // 우리 조의 탐사: 횃불로 다닐 날의 기대만큼 캐고 갈무리하고 위기를 맞는다. 횃불이 떨어질 확률만큼 어둠 속 위기를 더한다
      const odds = who ? tripOdds(Math.min(carryOf(P, f), size * CO.SLOT_PP), torchRate(f, u)) : null, dk = odds ? odds.days : 1, lk = odds ? dk * CO.FIND : 1;
      if (odds) burn += odds.burn;
      const matOf = (M: typeof mons[number]) => M.mats.reduce((b, x) => b + matChance(x, keys, full) / CO.PARTY * ((W.mat && W.mat.ref[x.n]) || x.val) * (x.k ? (x.k[0] + x.k[1]) / 2 : 1) * demandMul(W, x.n), 0);
      const mat = hired ? 0 : (MM ? MM.mat : 1) * (odds ? mons.reduce((a, M, j) => a + CO.ENC_W[j] * CO.DAYS * CO.MAT_ENC * matOf(M), 0) * dk : mons.reduce((a, M) => a + matOf(M), 0));
      parts.push({ n: size, p: pt, v: per * loM * lk * (hired ? 1 - CO.HIRE_CUT : 1) + mat }); lootE += size * pt * per * loM * lk * (hired ? 1 - CO.HIRE_CUT : 1);
      if (!hired) {
        const cp0 = pt * Math.min(0.95, F.risk * CO.CRISIS_OK * crM) + (1 - pt) * Math.min(0.95, F.risk * CO.CRISIS_FAIL * crM);
        const cp = cp0 * dk + (odds ? odds.dark * Math.min(0.9, CO.DARK_MIN + Math.min(0.95, F.risk * CO.CRISIS_FAIL * crM) * CO.DARK_BACK) : 0), die = P.pots[f] ? Math.min(0.9, F.harm * U.harm) : CO.CRISIS_DEATH;
        dead += size * cp * die; hurt += size * cp * (1 - die) * (P.pots[f] ? CO.INJURE : 1); crisis += Math.min(size * cp, P.pots[f]);
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
  return { mean: Math.round(mean), p10: q(0.1), p50: q(0.5), p90: q(0.9), bins: bins.map(x => Math.round(x * 1000) / 1000), step: width, dead: Math.round(dead * 10) / 10, hurt: Math.round(hurt * 10) / 10, loot: Math.round(Math.max(0, lootE - floorLoss)), crisis: Math.round(crisis * 10) / 10, torch: Math.round(burn) };
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
  P.base = null; P.donate = 0; P.root = null; P.proc = 0; P.buy = {}; P.dorm = false; delete P.build; delete P.take; delete P.sellMap;
  if (c.crew) P.pick = [];   // 신입은 이번 달 지원자 중 고른 사람만 (고르지 않으면 아무도 들이지 않는다)
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
