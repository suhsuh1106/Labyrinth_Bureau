// 단장의 인계: 새로 온 행정관은 판 · 인원 · 보급만 맡고, 나머지 업무는 판의 상태가 그 일을 낳을 때 단장이 하나씩 넘긴다.
// 넘기기 전에는 그 탭이 잠겨 있고, 단장이 지금처럼 처리한다(장부 그대로 신고 · 공사 · 정보망 · 근원 기금 없음).
// 날짜가 아니라 조건으로 연다. 읽기만 한다 (판에 아무것도 쓰지 않고 난수도 쓰지 않는다). 넘긴 업무는 화면 상태(ui.duty)에 남는다
import { adminOf, roomOf, us, type Ours, type World } from '../../core/company';

export type DutyKey = 'sell' | 'book' | 'books' | 'hq' | 'intel' | 'church';
// 지금까지 돌아온 우리 조의 귀환 보고 (지난달까지 + 이달)
const reps = (W: World): Ours[] => [...W.history.flatMap(M => M.ours), ...(W.back || []).map(s => s.rep).filter((r): r is Ours => !!r)];
// 그믐 정산을 한 번이라도 마쳤나 (첫 그믐의 가정산 중에는 아직)
const settled = (W: World) => W.history.length > (W.draft ? 1 : 0);

// tabs: 이 업무가 여는 단추 시트의 탭 ([단추, 탭]). memo: 단장이 넘기며 남기는 한 줄
export const DUTIES: { k: DutyKey; n: string; tabs: [string, string][]; memo: string; go: [string, string]; when: (W: World) => boolean }[] = [
  { k: 'sell', n: '창고 · 팔기', tabs: [['goods', 'sell'], ['rec', 'back']], go: ['goods', 'sell'],
    memo: '짐은 창고에 풀어 두었소. 언제 팔지는 이제 행정관이 정하시오. 오래 두면 상하오.',
    when: W => reps(W).length > 0 },
  { k: 'book', n: '미궁 도감 · 단장 조사', tabs: [['rec', 'book']], go: ['rec', 'book'],
    memo: '놈들과 맞붙은 기록을 수첩에 모으기 시작했소. 내가 나갈 때 직접 알아볼 것을 달마다 하나 정해 주시오.',
    when: W => Object.values(W.dex || {}).some(d => d.n > 0) },
  { k: 'books', n: '신고서 · 게시판', tabs: [['hq', 'board'], ['rec', 'report'], ['rec', 'paper']], go: ['hq', 'board'],
    memo: '첫 장부는 내가 있는 그대로 영주청에 냈소. 다음 달부터 신고서와 게시판은 행정관 몫이오.',
    when: settled },
  { k: 'intel', n: '정보망', tabs: [['hq', 'alley'], ['rec', 'probe']], go: ['hq', 'alley'],
    memo: '다른 단 녀석들을 미궁에서 봤다는 보고요. 그런 소식을 사고파는 골목이 있다 하더이다.',
    when: W => reps(W).some(o => (o.seen || []).length > 0) },
  { k: 'church', n: '교회', tabs: [['hq', 'church']], go: ['hq', 'church'],
    memo: '미궁이 술렁인다는 말이 돌고 있소. 대사제께서 행정관을 한번 뵙자 하시더이다.',
    when: W => (W.anoms || 0) > 0 || (W.roots || []).some(R => R.found > 0) },
  { k: 'hq', n: '본부 공사 · 교관 · 서기', tabs: [['hq', 'train']], go: ['hq', 'train'],
    memo: '살림이 커졌소. 숙소를 늘릴지 훈련장을 지을지, 본부는 이제 행정관이 꾸리시오.',
    when: W => { const c = us(W); return roomOf(c) <= 4 || adminOf(W).r >= 0.45 || c.cash >= 4500; } },
];
export const DUTY_KEYS = DUTIES.map(d => d.k);

// ui.duty가 없으면(옛 판 · 테스트) 모두 넘겨받은 것으로 본다
export const hasDuty = (ui: { duty?: string[] }, k: DutyKey) => !ui.duty || ui.duty.includes(k);
// 이 탭을 쓸 수 있나 (어떤 업무에도 묶이지 않은 탭은 처음부터 열려 있다)
export function tabOpen(ui: { duty?: string[] }, menu: string, tab: string) {
  const d = DUTIES.find(x => x.tabs.some(([m, t]) => m === menu && t === tab));
  return !d || hasDuty(ui, d.k);
}
// 조건이 찬 업무 가운데 아직 넘겨받지 않은 것 (판 순서대로)
export const dutyDue = (W: World, ui: { duty?: string[] }) => (ui.duty ? DUTIES.filter(d => !ui.duty!.includes(d.k) && d.when(W)).map(d => d.k) : []);
