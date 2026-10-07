// 관리국 직제: 국장은 부서마다 방침의 방향과 크기만 고르고, 부서가 그에 맞춰 품의(예산 줄 금액)를 올린다.
// 국장은 부서 품의를 승인하거나 반려한다. 부서는 신설·확장할 때마다 할 수 있는 일이 하나씩 늘어난다.
// 실제 게임 규칙은 예전처럼 예산 줄(S.budget)을 읽는다. 여기서는 방침·단계·결재를 그 줄 금액으로 옮겨 적기만 한다
import { has } from './agendas';
import { C } from './data';
import { prices, project } from './economy';
import { supply } from './explore';
import { devDone } from './founding';
import { heroDemand, heroPicks, pickDemand } from './hero';
import { S, schismLines } from './state';

export type DeptId = 'supply' | 'explore' | 'audit' | 'outer' | 'press' | 'finance';
export type Dept = { id: DeptId; name: string; tag: 'fin' | 'field' | 'info' | 'dip'; does: string; feats: string[]; cost: number[]; pay: number[]; need?: () => boolean; needText?: string };

// cost[i]: i단계로 올리는 비용(0→1이 신설). pay[i]: i+1단계일 때 매달 인건비
export const DEPTS: Dept[] = [
  { id: 'supply', name: '보급과', tag: 'fin', does: '포션과 식량·정비·운송을 사요',
    feats: ['보급 충족률 방침 · 공방, 교회, 상단 순으로 싼 곳부터 채움', '대량 구매 협상 · 상단 포션을 5% 싸게', '비축 창고 · 110% 비축 방침, 남는 포션을 창고에 쌓음'],
    cost: [0, 2500, 4000], pay: [0, 250, 450] },
  { id: 'explore', name: '탐사과', tag: 'field', does: '원정 지원과 공략본 보급을 맡아요',
    feats: ['공략 지원 방침 · 공략본을 따르는 파티를 늘림', '편성 지원 · 공략본에 맞춰 장비를 빌려주고 사제와 직업을 불러옴', '현장 연락소 · 공략본을 따르는 파티가 10%p 더 늚'],
    cost: [1500, 2500, 4000], pay: [200, 350, 500], need: () => devDone('gate'), needText: '면허 사무소가 문을 열어야 신설할 수 있어요' },
  { id: 'audit', name: '감찰관실', tag: 'info', does: '상단·교회의 속사정을 캐요',
    feats: ['소문 수집 · 다음 달 약초 작황과 담합 낌새 보고', '정식 감찰 · 상단·교회 장부 사본, 담합 억제', '상시 감시 · 소문 수집만으로도 감시가 이어지고 보고가 정확해짐'],
    cost: [1500, 2500, 3500], pay: [250, 400, 550], need: () => devDone('supply'), needText: '포션 공급망이 서야 신설할 수 있어요' },
  { id: 'outer', name: '대외과', tag: 'dip', does: '교회 헌금과 바깥 관계를 맡아요',
    feats: ['헌금 방침 · 관례 미만 / 관례대로 / 후하게', '의뢰 중개 · 의뢰가 늘고 수수료가 20%에서 30%로', '종파 중재 · 교회가 갈라지면 개혁파 헌금 방침이 열림'],
    cost: [1500, 2500, 3000], pay: [200, 350, 500], need: () => S.custom > 0 || has('church_greet'), needText: '교회와 관례가 생겨야 신설할 수 있어요' },
  { id: 'press', name: '공보관', tag: 'dip', does: '변경 일보와 여론을 맡아요',
    feats: ['소식지 방침 · 관리국 소식을 내서 명성을 조금씩 올림', '기고 · 더 크게 알리는 방침이 열리고, 용사 소식이 크게 퍼짐', '의전 · 우수 평가 보조금 +4,000G, 미흡 경고를 한 번 거둠'],
    cost: [1200, 2500, 4000], pay: [150, 300, 450], need: () => devDone('gate'), needText: '면허 사무소가 문을 열어야 신설할 수 있어요' },
  { id: 'finance', name: '재무과', tag: 'fin', does: '예상과 실적을 맞춰 봐요',
    feats: ['대조표 · 품의 예상과 결산이 10% 넘게 어긋난 달에 검토 요청을 올림', '원인 메모 · 어긋난 줄마다 이유를 짚어 줌', '손익 예측 · 예상 손익을 잘 풀린 달과 안 풀린 달 범위로 알려 줌'],
    cost: [2000, 2500, 3500], pay: [250, 350, 500] },
];
export const dept = (id: string) => DEPTS.find(d => d.id === id)!;

// 방침 선택지: [이름, 값, 필요한 단계]. 부서가 없어도 쓰는 줄(국장 직속)은 단계 0
export type Opt = [string, number, number];
export const POLICY: Record<string, { name: string; dept: DeptId | null; opts: Opt[]; show?: () => boolean }> = {
  supply: { name: '보급 충족률', dept: 'supply', opts: [['80%', 0.8, 1], ['90%', 0.9, 1], ['100%', 1, 1], ['110% 비축', 1.1, 3]] },
  explore: { name: '공략 지원', dept: 'explore', opts: [['없음', 0, 1], ['보통', 1, 1], ['적극', 2, 1], ['편성까지', 3, 2]] },
  audit: { name: '감찰', dept: 'audit', opts: [['없음', 0, 1], ['소문 수집', 1, 1], ['정식 감찰', 2, 2]] },
  outer: { name: '헌금', dept: 'outer', opts: [['관례 미만', 0, 1], ['관례대로', 1, 1], ['후하게', 2, 1]] },
  outerR: { name: '개혁파 헌금', dept: 'outer', opts: [['안 냄', 0, 3], ['관례대로', 1, 3], ['힘 실어 주기', 2, 3]], show: () => schismLines() },
  press: { name: '소식지', dept: 'press', opts: [['없음', 0, 1], ['소식지', 1, 1], ['기고', 2, 2]] },
  hero: { name: '용사 후원', dept: null, opts: [['없음', 0, 0], ['몸값 맞춤', 1, 0], ['넉넉히', 2, 0]], show: () => devDone('gate') },
};

export function newOrg() {
  return { lv: { supply: 1, explore: 0, audit: 0, outer: 0, press: 0, finance: 0 } as Record<DeptId, number>,
    pol: { supply: 2, explore: 1, audit: 1, outer: 1, outerR: 1, press: 1, hero: 0 } as Record<string, number>,
    rej: {} as Record<string, boolean>, up: null as DeptId | null };
}

export const lv = (id: DeptId) => (S.org ? S.org.lv[id] || 0 : 0);
export const canPick = (k: string, i: number) => { const P = POLICY[k], need = P.opts[i][2]; return P.dept ? lv(P.dept) >= need && lv(P.dept) > 0 : true; };
// 고른 방침이 단계가 모자라 막히면(불러온 저장 등) 열린 것 중 가장 가까운 값으로 내린다
export function polVal(k: string) {
  const P = POLICY[k]; let i = S.org.pol[k] ?? 0;
  while (i > 0 && !canPick(k, i)) i--;
  return P.opts[i][1];
}
export const rejected = (k: string) => !!S.org.rej[k];
export const deptOk = (d: Dept) => !d.need || d.need();
export const upCost = () => (S.org.up ? dept(S.org.up).cost[lv(S.org.up)] : 0);
export const staffPay = () => DEPTS.reduce((a, d) => a + (lv(d.id) ? d.pay[lv(d.id) - 1] : 0), 0);
// 부서 효과 (규칙 쪽에서 읽음)
export const potDisc = () => (lv('supply') >= 2 ? 0.95 : 1);
export const questCut = () => (lv('outer') >= 2 ? 0.3 : C.QUEST_CUT);
export const questMore = () => (lv('outer') >= 2 ? 1 : 0);
export const adoptOrg = () => (lv('explore') >= 3 ? 0.1 : 0);
export const steadyWatch = () => lv('audit') >= 3 && (S.budget.intel || 0) > 0;
export const r100 = (v: number) => Math.ceil(v / 100) * 100;

// 관례 헌금: 부서가 없으면 서기실이 관례대로 올린다
const customDon = () => S.custom || 0;

// 방침 → 예산 줄. 반려한 줄은 0이 된다. 화면과 봇이 결재 전에 부른다
export function compileBudget() {
  const b = S.budget, o = S.org;
  // 보급: 싼 곳부터 채운다 (공방 → 교회 한도 → 상단)
  const cov = o.rej.supply ? 0 : polVal('supply');
  const P = prices(), need = Math.round(S.M * C.NEED * cov);
  const qW = S.wsBuilt ? Math.min(S.wsCap, need) : 0;
  const bulk = !!S.deals.bulk;
  const qC = bulk ? 0 : Math.min(S.cap, need - qW);
  const qM = Math.max(0, need - qW - qC);
  b.ws = qW * C.WS_COST; b.potC = qC * P.c; b.potM = Math.ceil(qM * Math.round(P.m * potDisc()));
  const pv = project({ ...b, food: 1e9, repair: 1e9, haul: 1e9 }).pv;
  ['food', 'repair', 'haul'].forEach(k => { b[k] = o.rej.supply ? 0 : r100(pv[k].full * Math.min(1, cov)); });

  // 탐사: 지원금, 편성 지원(장비 대여·사제·장려금), 시험 탐사
  const ex = lv('explore') && !o.rej.explore ? polVal('explore') : 0;
  b.support = [0, 1000, 2500, 2500][ex];
  if (ex >= 3) {
    const u = supply({ rent: 1e9, priest: 0, recruit: 0 });
    b.rent = u.gk.length ? r100(Math.min(3000, u.rp * Math.ceil(S.M * 0.08))) : 0;
    b.priest = S.floors.some((f, i) => i < S.unlocked && f.guide === 'c:사제') ? 1000 : 0;
    b.recruit = u.ck.length && !S.union ? 1200 : 0;
  } else { b.rent = 0; b.priest = 0; b.recruit = 0; }
  b.trial = S.trial && !o.rej.trial ? 900 : 0;

  // 감찰
  const au = lv('audit') && !o.rej.audit ? polVal('audit') : 0;
  b.intel = au >= 1 ? (lv('audit') >= 3 ? 2000 : 1500) : 0;
  b.audit = au >= 2 ? 3000 : 0;

  // 헌금: 대외과가 없으면 서기실이 관례대로. 대외과가 있으면 방침대로
  const cu = customDon();
  if (!lv('outer')) b.donation = cu;
  else b.donation = o.rej.outer ? 0 : r100([cu * 0.6, cu, cu + 2500][polVal('outer')]);
  const cr = S.schism && S.schism.outcome === 'compromise' ? S.customR : 0;
  if (!schismLines()) b.donR = 0;
  else if (lv('outer') >= 3) b.donR = o.rej.outer ? 0 : r100([0, cr || 1000, Math.max(cr, 1000) + 1500][polVal('outerR')]);
  else b.donR = cr;

  // 공보: 소식지는 명성에, 용사가 있으면 그 돈이 용사 홍보비가 된다
  const pr = lv('press') && !o.rej.press ? polVal('press') : 0;
  b.heroPub = [0, 600, 1500][pr];

  // 용사 후원 (국장 직속): 공고 → 명단 결성 → 몸값
  const h = o.rej.hero ? 0 : polVal('hero');
  const picks = heroPicks().length;
  if (!h) { b.heroPay = 0; b.heroGear = 0; }
  else if (S.hero || picks >= 2) {
    const d = S.hero ? heroDemand() + pickDemand() : pickDemand();
    b.heroPay = r100(d * (h === 2 ? 1.2 : 1)); b.heroGear = h === 2 ? 800 : 0;
  } else { b.heroPay = h === 2 ? 4000 : 2000; b.heroGear = 0; }
}

// 부서별 품의: 그 부서 줄의 합계. 결재함에 보여 주고, 재무과 대조표가 실적과 맞춰 본다
export const MEMO_LINES: Record<string, string[]> = {
  supply: ['potM', 'potC', 'ws', 'food', 'repair', 'haul'],
  explore: ['support', 'rent', 'priest', 'recruit'],
  trial: ['trial'],
  audit: ['intel', 'audit'],
  outer: ['donation', 'donR'],
  press: ['heroPub'],
  hero: ['heroPay', 'heroGear'],
};
export const memoOf = (k: string, b = S.budget) => MEMO_LINES[k].reduce((a, l) => a + (b[l] || 0), 0);

// 이번 결재 뒤: 확장이 끝나고, 반려는 한 달짜리라 지운다
export function orgMonth(log: (t: string) => void) {
  const o = S.org;
  if (o.up) {
    const d = dept(o.up), L = lv(o.up) + 1;
    o.lv[o.up] = L;
    log(L === 1 ? `${d.name} 신설` : `${d.name} ${L}단계로 확장 · ${d.feats[L - 1].split(' · ')[0]}`);
    o.up = null;
  }
  o.rej = {};
}

// 재무과 대조표: 결재 때 예상한 수입·지출과 결산 실적을 맞춰 보고, 나쁜 쪽으로 10% 넘게(300G 이상) 어긋난 달에만 서류를 올린다.
// 2단계부터는 줄마다 원인을 짚는다. 국장이 장부를 매달 뒤질 필요 없이 이상한 달만 보면 되게 한다
export function financeReview(a: { pr: any; loot: number; mtax: number; qFee: number; quests: any[]; ex: any; spend: number; leakLost: number }) {
  if (!lv('finance') || S.phase !== 'run') return null;
  const { pr, ex } = a, L = S.last;
  const qExp = (L && L.questFee) || 0;
  const lines = [
    { k: 'loot', name: '수입 · 전리품 거래', exp: S.lastLoot, act: a.loot, inc: true },
    { k: 'market', name: '수입 · 시장세', exp: pr.mktGuess, act: a.mtax, inc: true },
    { k: 'quest', name: '수입 · 의뢰 수수료', exp: qExp, act: a.qFee, inc: true },
    { k: 'spend', name: '지출 합계', exp: pr.spend, act: a.spend, inc: false },
  ];
  const bad = (l) => { const d = l.inc ? l.exp - l.act : l.act - l.exp; return d >= 300 && d > l.exp * 0.1; };
  const flagged = lines.filter(bad);
  if (!flagged.length) return null;
  const why = (k: string) => {
    if (lv('finance') < 2) return '';
    if (k === 'loot' || k === 'market') {
      const r = ex.n ? ex.wins / ex.n : 0, r0 = L && L.ex && L.ex.n ? L.ex.wins / L.ex.n : r;
      return `성공한 파티 ${ex.wins}/${ex.n}조 (${Math.round(r * 100)}%, 지난달 ${Math.round(r0 * 100)}%)${a.leakLost ? ` · 밀반출로 ${a.leakLost.toLocaleString('ko-KR')}G어치가 빠짐` : ''}${S.privateExp ? ' · 상단 사설 탐사대가 최전선을 나눠 먹음' : ''}${k === 'market' ? ' · 시장세는 팔린 전리품을 따라 움직임' : ''}`;
    }
    if (k === 'quest') return `의뢰 ${a.quests.filter(q => q.done).length}/${a.quests.length}건 완수. 의뢰가 걸린 층에서 성공한 파티가 없으면 수수료가 없음`;
    return ex.feeOut > pr.feeOut ? '입장 보조금을 받은 파티가 예상보다 많았음' : '용사 파티 몸값과 장비 지원이 예상과 달랐음';
  };
  const f = (v: number) => Math.round(v).toLocaleString('ko-KR');
  const body = `<div class="tablewrap"><table class="stats"><tr><th>항목</th><th>예상</th><th>실적</th><th>차이</th></tr>${lines.map(l => {
    const d = l.act - l.exp, hit = flagged.includes(l);
    return `<tr${hit ? ' class="flag"' : ''}><td>${l.name}${hit ? ' <b class="neg">검토 요청</b>' : ''}${hit && why(l.k) ? `<br><small class="dim">${why(l.k)}</small>` : ''}</td><td>${f(l.exp)}</td><td>${f(l.act)}</td><td class="${hit ? 'ng' : ''}">${d > 0 ? '+' : d < 0 ? '−' : ''}${f(Math.abs(d))}</td></tr>`;
  }).join('')}</table></div>
    <p class="from">${lv('finance') < 2 ? '재무과를 2단계로 키우면 어긋난 줄마다 원인을 짚어 드립니다.' : '어긋난 줄만 보시면 됩니다. 나머지는 예상대로 집행되었습니다.'}</p>`;
  return { cls: 'secret', kind: '재무과 · 품의 대조표', title: `지난달 예상과 실적 · 검토 요청 ${flagged.length}건`, from: `제${S.month}월 결산`, stamp: '검토 요청', body };
}
