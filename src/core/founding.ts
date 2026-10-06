// 개척기
import { flag } from './agendas';
import { C, CLASS_SHARE } from './data';
import { partyCount } from './explore';
import { rows } from './html';
import { compileBudget } from './org';
import { sayLine } from './secrets';
import { S, log } from './state';
import { fmt } from './util';

// 입구·공급망·판로 세 축이 서면 운영기로 넘어간다. 고른 선택지는 플래그와 수치로 남아 뒤의 사건을 만든다
export function addMercs(n, share = CLASS_SHARE) {
  const tot = share.reduce((a, v) => a + v, 0);
  S.M += n; S.cls = S.cls.map((v, i) => v + n * share[i] / tot);
}

export const DEV: any[] = [
  { id: 'gate', name: '입구 정비와 면허 사무소', core: true,
    why: '사무소가 없으면 면허도 통행세도 없어요. 지금 들어가는 개척 용병 20명은 아무것도 내지 않아요',
    opts: [
      { label: '천막 사무소', cost: 3000, months: 1, desc: '한 달 뒤 문을 열어요. 용병 40명이 면허를 받으러 와요',
        apply() { S.toll = C.TOLL; addMercs(40); } },
      { label: '석조 사무소와 숙소', cost: 7000, months: 2, desc: '두 달 걸려요. 용병 70명이 오고, 숙소 덕에 통행세를 10G 더 받아요',
        apply() { S.toll = C.TOLL + 10; addMercs(70); } },
    ] },
  { id: 'supply', name: '포션 공급망', core: true,
    why: '지금은 떠돌이 상인에게 웃돈(병당 +30G)을 주고 포션을 사요. 누구에게 맡기느냐가 앞으로의 힘 관계를 정해요',
    opts: [
      { label: '상단에 주로 맡긴다', cost: 2000, months: 1, who: 'merchant', desc: '상단 단가가 3G 싸져요. 교회는 한 달 40병만 대요. 상단의 입김이 세지고, 공급처가 사실상 하나라 값을 올려도 피할 곳이 적어요',
        apply() { S.mPriceAdj = -3; S.cap = 40; S.gM -= 10; S.gC += 6; flag('supply_merchant'); } },
      { label: '교회에 주로 맡긴다', cost: 2000, months: 1, who: 'church', desc: '교회가 한 달 160병까지, 병당 8G 싸게 대요. 상단은 서운해하며 값을 5G 더 받아요. 교회 관례 헌금이 200G 오르고 교회의 입김이 세져요',
        apply() { S.mPriceAdj = 5; S.cPriceAdj = -8; S.cap = 160; S.gC -= 10; S.gM += 8; S.custom += 200; flag('supply_church'); } },
      { label: '둘 다 경쟁 입찰', cost: 3000, months: 2, desc: '경쟁 덕에 상단은 2G, 교회는 5G 싸게 받고, 어느 한쪽에 기대지 않아요. 대신 두 공급처가 입찰장에서 자주 마주 앉게 돼요 (담합 위험)',
        apply() { S.mPriceAdj = -2; S.cPriceAdj = -5; S.cap = 80; S.rel = Math.min(80, S.rel + 15); flag('supply_bid'); } },
    ] },
  { id: 'market', name: '전리품 판로', core: true,
    why: '판로가 없으면 용병이 가져온 전리품을 팔 수 없어 창고에 쌓여요. 개통하는 달에 쌓인 것을 한꺼번에 팔아요',
    opts: [
      { label: '상단이 사들인다', cost: 0, months: 1, who: 'merchant', desc: '돈이 들지 않아요. 대신 감정가를 상단이 정해요',
        apply() { S.lootMul = 1; S.gM -= 8; flag('market_merchant'); } },
      { label: '수도 상회와 직거래', cost: 4000, months: 2, desc: '전리품 값을 15% 더 받아요. 상단은 이권을 뺏겼다고 여겨요',
        apply() { S.lootMul = 1.15; S.gM += 12; flag('market_capital'); } },
      { label: '교회 성물 거래', cost: 1500, months: 1, who: 'church', desc: '교회가 축성해 성물로 팔아요. 값은 5% 덜 받지만 교회가 크게 반겨요',
        apply() { S.lootMul = 0.95; S.gC -= 10; flag('market_church'); } },
    ] },
  { id: 'survey', name: '1층 측량',
    why: '관리국 측량반이 1층을 먼저 훑어요. 하지 않아도 운영기로 넘어갈 수 있어요',
    opts: [
      { label: '측량반을 보낸다', cost: 1500, months: 1, desc: '1층 개척이 25% 진행되고, 1층에 사는 것의 겉모습을 바로 알아내요',
        apply(notes) { const fl = S.floors[0]; fl.prog = Math.max(fl.prog, 25); fl.n += 10; if (!fl.heard.look0) sayLine(fl, 0, 'trial', fl.mon.look[0], notes, 'look0'); } },
    ] },
  { id: 'poster', name: '용병 모집 공고', need: () => devDone('gate'), needText: '면허 사무소가 문을 열어야 낼 수 있어요',
    why: '어디에 공고를 내느냐에 따라 오는 용병의 직업이 달라요. 공략본이 요구하는 직업이 모자라면 나중에 고생해요',
    opts: [
      { label: '변경 마을', cost: 1000, months: 1, desc: '전사·도적 위주로 30명', apply() { addMercs(30, [0.5, 0.15, 0.03, 0.02, 0.3]); } },
      { label: '남부 항구', cost: 2000, months: 1, desc: '궁수·도적 위주로 30명', apply() { addMercs(30, [0.2, 0.45, 0.03, 0.02, 0.3]); } },
      { label: '수도', cost: 3000, months: 1, desc: '마법사·사제가 섞인 30명', apply() { addMercs(30, [0.2, 0.15, 0.35, 0.3, 0]); } },
    ] },
];

export const devDone = id => !!(S.dev[id] && S.dev[id].left === 0);

export const devCost = () => (Object.entries(S.devPick) as [string, any][]).reduce((a, [id, i]) => a + DEV.find(d => d.id === id).opts[i].cost, 0);

export const coreDone = () => DEV.filter(d => d.core).every(d => devDone(d.id));

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
  log('개척기를 마치고 운영기로 넘어감');
  S.eventDocs.push({ month: S.month, cls: 'secret', kind: '제국 행정성 · 보고', title: '관리국이 문을 열었습니다', from: `제${S.month}월`, stamp: '개청',
    body: rows([['면허 사무소', pickOf('gate')], ['포션 공급망', pickOf('supply')], ['전리품 판로', pickOf('market')], ['1층 측량', pickOf('survey')], ['모집 공고', pickOf('poster')]])
      + `<p>이제 관리국 직제가 정식으로 열립니다. 탐사과·감찰관실·대외과·공보관·재무과를 신설해 맡길 일을 늘리고, 매달 부서 방침과 층별 입장료를 정할 수 있습니다.</p>
      <p class="from">개척기에 맺은 계약과 이권은 그대로 남습니다. 누구에게 무엇을 맡겼는지가 앞으로의 힘 관계를 정합니다.</p>` });
}

// 개척기에는 필요한 기반이 생길 때마다 예산 줄이 열린다
export const gateOk = () => devDone('gate');
