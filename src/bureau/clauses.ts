// 국장이 서류에 넣는 조항(설계: 프로젝트 파일 design/clause-contract.md). 서류의 양식은 받는 쪽이 정한다:
// 길드 전체 → 공고문, 길드 하나 → 요청서, 상단 → 제안서. 조항마다 돈 · 정보 · 권리 · 안전 중 무엇을 주고받는지(꼬리표),
// 어느 양식에 넣을 수 있는지, 숫자 칸, 걸린 바탕 조항(⛓), 잠김 까닭을 데이터로 둔다. 효과는 engine.ts가 셈한다.
// 잠김 · 열림 조건은 조항 정의 안에만 둔다(코드 곳곳에 흩지 않는다).
import { B, type GuildId, type World } from './engine';

export type Tag = '돈' | '정보' | '권리' | '안전';
export type Form = 'notice' | 'letter' | 'offer';
export type To = 'all' | GuildId | 'trade';
export type ClauseId = 'sub' | 'rec' | 'comfort' | 'ration' | 'first' | 'excl' | 'goods' | 'ledger';
export type Clauses = Partial<Record<ClauseId, number>>;

export const FORM_OF = (to: To): Form => to === 'all' ? 'notice' : to === 'trade' ? 'offer' : 'letter';
export const FORM_NAME: Record<Form, string> = { notice: '공고문', letter: '요청서', offer: '제안서' };
export const toName = (to: To) => to === 'all' ? '길드 전체' : to === 'trade' ? '상단' : B.GUILD[to].name;
// 받는 쪽이 잠긴 까닭 (비우면 열림)
// 길드 하나에 보내는 요청서는 입지 단계가 B.LETTER_LV에 닿으면 열린다. 화면은 잠긴 받는 쪽을 보이지 않는다
export const toLock = (W: World, to: To) =>
  to === 'trade' ? '상단과 거래가 아직 열리지 않음' : to !== 'all' && W.rank < B.LETTER_LV ? `입지 ${B.LETTER_LV}단계에 열림` : '';

export interface Field { unit: string; min: number; max: number; step: number; def: number }
export interface Clause {
  id: ClauseId; name: string;
  give: Tag[]; take: Tag[];       // 관리국이 내주는 것 · 받는 것
  forms: Form[];
  field?: Field;                  // 숫자 칸 하나 (없으면 넣고 빼기만)
  needs?: ClauseId;               // 바탕 조항: 없으면 넣을 수 없고, 빼면 함께 빠진다
  lock?: string;                  // 잠김 까닭
  line: (v: number) => string;    // 서류에 적히는 문장
  fx: string;                     // 조항 탭의 효과 설명
}

export const CLAUSES: Clause[] = [
  { id: 'sub', name: '진입 보조금', give: ['돈'], take: [], forms: ['notice', 'letter'],
    field: { unit: 'G', min: 5, max: 60, step: 5, def: 10 },
    line: v => `미궁에 들어가는 조마다 하루 ${v}G를 지급한다.`,
    fx: '들어간 조마다 하루 값을 준다. 돈을 보는 길드가 반긴다. 본부가 먼 길드는 더 줘야 온다.' },
  { id: 'rec', name: '출입 기록 제출', give: [], take: ['정보'], forms: ['notice', 'letter'],
    line: () => '들고 난 조의 인원을 그날 검문소에 적어 낸다.',
    fx: '그 미궁 소식이 그날 들어온다. 서류가 귀찮아 조가 조금 덜 든다. 붉은 깃발단 · 강나루 조합은 꺼리고, 은빛 방패단은 반긴다.' },
  { id: 'comfort', name: '위로금', give: ['돈', '안전'], take: [], forms: ['notice', 'letter'],
    field: { unit: 'G', min: 20, max: 200, step: 10, def: 50 },
    line: v => `미궁에서 잃은 조마다 위로금 ${v}G를 지급한다.`,
    fx: '사람을 잃은 미궁에도 조가 남는다. 잃은 조마다 값을 준다. 등불회가 반긴다.' },
  { id: 'ration', name: '보급 표 지급', give: ['돈'], take: [], forms: ['notice', 'letter'], needs: 'rec', lock: '보급 창고가 아직 없음',
    field: { unit: '장', min: 1, max: 4, step: 1, def: 2 },
    line: v => `기록을 낸 조에 보급 표 ${v}장을 준다.`,
    fx: '출입 기록을 낸 조에 보급 표를 준다.' },
  { id: 'first', name: '등록 길드 우선 출입', give: ['권리'], take: [], forms: ['notice'], needs: 'rec', lock: '중앙 법령이 있어야',
    line: () => '기록을 낸 길드가 먼저 들어간다.',
    fx: '떠돌이 · 신생 길드가 밀려난다. 큰 길드가 반긴다.' },
  { id: 'excl', name: '독점 출입', give: ['권리'], take: [], forms: ['letter'], lock: '개별 길드 서신이 열려야',
    line: () => '기한 동안 이 미궁은 귀 길드만 들어간다.',
    fx: '한 길드에 미궁을 맡긴다. 다른 길드는 크게 서운해한다.' },
  { id: 'goods', name: '상단 물품 추가', give: ['돈'], take: [], forms: ['offer'], lock: '상단과 거래가 열려야',
    field: { unit: '짐', min: 1, max: 10, step: 1, def: 3 },
    line: v => `미궁 입구 보급소에 물품 ${v}짐을 더 들인다.`,
    fx: '보급이 늘어 깊이 들어간다. 상단이 값을 받는다.' },
  { id: 'ledger', name: '수령 기록 공유', give: ['정보'], take: ['정보'], forms: ['offer'], needs: 'rec', lock: '상단과 거래가 열려야',
    line: () => '검문소 출입 기록과 상단 수령 기록을 서로 맞춰 본다.',
    fx: '수확량이 보인다. 상단도 그 기록을 쥔다.' },
];
export const CLAUSE = Object.fromEntries(CLAUSES.map(c => [c.id, c])) as Record<ClauseId, Clause>;
export const CLAUSE_MAX = 5;      // 한 서류에 다섯 조까지

export const clauseLock = (_W: World, id: ClauseId) => CLAUSE[id].lock ?? '';
// 이 양식의 서류에 있어도 되나: 열렸고, 양식이 맞고, 바탕 조항이 함께 있다
export const fits = (W: World, form: Form, cl: Clauses, id: ClauseId) =>
  !clauseLock(W, id) && CLAUSE[id].forms.includes(form) && (!CLAUSE[id].needs || cl[CLAUSE[id].needs!] != null);
// 더 넣을 수 있나: 위에 더해 아직 없고, 다섯 조가 차지 않았다
export const canAdd = (W: World, form: Form, cl: Clauses, id: ClauseId) =>
  fits(W, form, cl, id) && cl[id] == null && Object.keys(cl).length < CLAUSE_MAX;
// 조항을 빼면 그것에 걸린 조항도 함께 빠진다
export function dropClause(cl: Clauses, id: ClauseId): Clauses {
  const out: Clauses = { ...cl };
  delete out[id];
  for (const c of CLAUSES) if (c.needs === id) delete out[c.id];
  return out;
}
export const addClause = (cl: Clauses, id: ClauseId): Clauses => ({ ...cl, [id]: CLAUSE[id].field?.def ?? 1 });
