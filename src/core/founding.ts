// 개척기
import { flag } from './agendas';
import { C, CLASS_SHARE } from './data';
import { partyCount } from './explore';
import { rows } from './html';
import { compileBudget } from './org';
import { sayLine } from './secrets';
import { S, log } from './state';
import { fmt } from './util';

// 입구·공급망·판로 세 축이 서면 운영기로 넘어간다. 개척기는 판마다 같은 순서로, 서기실이 첫날 들은 말에 맞춰 짠 대로 간다.
// 국장은 매달 품의를 결재할 뿐 출발점을 고르지 않는다. 판의 차이는 운영기의 선택과 사건에서 생긴다
export function addMercs(n, share = CLASS_SHARE) {
  const tot = share.reduce((a, v) => a + v, 0);
  S.M += n; S.cls = S.cls.map((v, i) => v + n * share[i] / tot);
}

export const DEV: any[] = [
  { id: 'gate', name: '면허 사무소 천막', core: true, who: null, from: '서기실',
    opts: [{ label: '천막 사무소', cost: 3000, months: 1, desc: '다음 달 문을 엽니다. 용병 40명이 면허를 받으러 오고, 그때부터 통행세가 들어옵니다',
      apply() { S.toll = C.TOLL; addMercs(40); } }] },
  { id: 'supply', name: '포션 공급 계약', core: true, who: 'merchant', from: '서기실',
    opts: [{ label: '상단 주 공급 · 교회 성수 포션 병행', cost: 2500, months: 1, desc: '떠돌이 상인의 웃돈이 사라집니다. 상단이 주로 대고, 교회가 성수 포션을 한 달 80병까지 함께 댑니다',
      apply() { S.mPriceAdj = -2; S.cPriceAdj = -5; S.cap = 80; S.rel = Math.min(80, S.rel + 10); flag('supply_both'); } }] },
  { id: 'market', name: '전리품 매입', core: true, who: 'merchant', from: '상단 조합',
    opts: [{ label: '상단 조합 매입', cost: 0, months: 1, desc: '용병이 들고 온 전리품을 상단이 바로 사 갑니다. 감정가는 상단이 정합니다',
      apply() { S.lootMul = 1; S.gM -= 8; flag('market_merchant'); } }] },
  { id: 'blessing', name: '입구 축성과 사제 상주', who: 'church', from: '대사제 엘마',
    opts: [{ label: '교회 사제 상주', cost: 0, months: 1, desc: '사제들이 입구에 머물며 다친 용병을 돌봅니다. 석 달 동안 사망이 줄고, 다음 달부터 관례 헌금 1,000G를 냅니다',
      apply() { S.custom = C.CUSTOM; S.gC -= 15; S.trust += 4; S.deals.novice = { left: 3 }; flag('church_greet'); flag('church_blessed'); } }] },
  { id: 'survey', name: '1층 측량', who: null, from: '서기실',
    opts: [{ label: '측량반 파견', cost: 1500, months: 1, desc: '측량반이 1층을 먼저 훑어 1층에 사는 것의 겉모습을 알아냅니다',
      apply(notes) { const fl = S.floors[0]; fl.prog = Math.max(fl.prog, 25); fl.n += 10; if (!fl.heard.look0) sayLine(fl, 0, 'trial', fl.mon.look[0], notes, 'look0'); } }] },
  { id: 'poster', name: '용병 모집 공고', who: null, from: '서기실', need: () => devDone('gate'),
    opts: [{ label: '변경 마을과 수도에 공고', cost: 2000, months: 1, desc: '여러 직업이 고르게 섞인 용병 30명이 옵니다', apply() { addMercs(30); } }] },
];

// 서기실이 이번 달 착수할 사업을 품의에 올린다. 조건이 된 사업은 빠짐없이 올라오고, 국장은 결재만 한다
export function staffPlan() {
  if (S.phase !== 'found') return;
  DEV.forEach(d => { if (!S.dev[d.id] && S.devPick[d.id] == null && (!d.need || d.need())) S.devPick[d.id] = 0; });
}

export const devDone = id => !!(S.dev[id] && S.dev[id].left === 0);

export const devCost = () => (Object.entries(S.devPick) as [string, any][]).reduce((a, [id, i]) => a + DEV.find(d => d.id === id).opts[i].cost, 0);

// 서기실이 짠 개척 사업이 모두 끝나야 운영기로 넘어간다 (모집 공고는 사무소가 연 다음 달)
export const coreDone = () => DEV.every(d => devDone(d.id));

export const founding = () => S.phase === 'found';

export function resolveDev(notes) {
  // 이번 달 착수
  (Object.entries(S.devPick) as [string, any][]).forEach(([id, i]) => {
    const d = DEV.find(x => x.id === id), o = d.opts[i];
    S.dev[id] = { opt: i, left: o.months };
    log(`개척 사업 착수: ${d.name} · ${o.label}${o.cost ? ` (${fmt(o.cost)}G)` : ''}`);
  });
  S.devPick = {};
  // 진행과 완공
  (Object.entries(S.dev) as [string, any][]).forEach(([id, st]) => {
    if (st.left <= 0) return;
    st.left--;
    if (st.left === 0) {
      const d = DEV.find(x => x.id === id), o = d.opts[st.opt];
      o.apply(notes);
      if (id === 'supply') S.avgVol = 0;   // 공급 구조가 바뀌었으니 주문량 기준을 새로 잡는다
      if (id === 'gate' || id === 'supply' || id === 'poster') S.rebudget = d.name;
      log(`개척 사업 완료: ${d.name} · ${o.label}`);
      notes.push(`${d.name}(${o.label})이 마무리되었습니다.`);
      if (id === 'market' && S.unsold > 0) {
        const sold = Math.round(S.unsold * S.lootMul);
        S.treasury += sold; S.soldBacklog = sold;
        log(`판로 개통 · 쌓아 둔 전리품을 ${fmt(sold)}G에 팔았음`);
        notes.push(`판로가 열리자 창고에 쌓아 둔 전리품을 한꺼번에 내다 팔았습니다. ${fmt(sold)}G가 금고로 들어왔습니다.`);
        S.unsold = 0;
      }
    }
  });
  staffPlan();
}

// 기반이 바뀌면 보급과가 방침은 그대로 두고 품의를 새 상황에 맞춰 다시 올린다
export function staffRebudget(notes, why) {
  compileBudget();
  notes.push(`보급과가 ${why} 포션과 보급품 품의를 다시 올렸습니다. 용병 ${S.M}명, 파티 약 ${partyCount()}개 기준입니다.`);
}

export function endFounding() {
  S.phase = 'run'; S.runStart = S.month;
  // 쓰고 남은 영주 개척 자금은 관리국 금고로 넘어온다. 개척기를 아껴 마칠수록 운영기가 넉넉하게 시작한다
  if (S.fund > 0) { S.fundBack = S.fund; S.treasury += S.fund; log(`남은 개척 자금 ${fmt(S.fund)}G를 금고로 옮김`); S.fund = 0; }
  const pickOf = id => { const d = DEV.find(x => x.id === id), st = S.dev[id]; return st ? d.opts[st.opt].label : '하지 않음'; };
  S.devPick = {};
  log('개척기를 마치고 운영기로 넘어감');
  S.eventDocs.push({ month: S.month, cls: 'secret', kind: '제국 행정성 · 보고', title: '관리국이 문을 열었습니다', from: `제${S.month}월`, stamp: '개청',
    body: rows(DEV.map(d => [d.name, pickOf(d.id)]))
      + `<p>이제 관리국 직제가 정식으로 열립니다. 탐사과·감찰관실·대외과·공보관·재무과를 신설해 맡길 일을 늘리고, 매달 부서 방침과 층별 입장료를 정할 수 있습니다.</p>
      <p class="from">개척기에 맺은 계약과 이권은 그대로 남습니다. 누구에게 무엇을 맡겼는지가 앞으로의 힘 관계를 정합니다.</p>` });
}

// 개척기에는 필요한 기반이 생길 때마다 예산 줄이 열린다
export const gateOk = () => devDone('gate');
