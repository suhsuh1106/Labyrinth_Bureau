// 플래그와 안건
import { C, DIRTY } from './data';
import { rnd } from './rng';
import { S, log } from './state';
import { fmt } from './util';
import { done } from './world';

// 플래그: 플레이어가 실제로 한 선택만 기록한다 (수치가 아니라 행동). 안건은 이 기록이 맞아야 올라온다
export const has = k => (S.flags[k] || 0) > 0;

export function flag(k) { S.flags[k] = (S.flags[k] || 0) + 1; if (!S.flagM[k]) S.flagM[k] = S.month; }

export const since = k => S.month - (S.flagM[k] || S.month);

export const extraUpkeep = () => S.upkeepX.reduce((a, u) => a + u.amt, 0);

export function addUpkeep(name, amt) { S.upkeepX.push({ name, amt }); }

export const agendaOpt = () => { if (!S.agenda) return null; const A = AGENDAS.find(a => a.id === S.agenda.id); return A.opts[S.agenda.pick ?? A.def]; };

export const agendaCost = () => { const o = agendaOpt(); return o && o.cost ? o.cost : 0; };

export function endUnion(how) { S.union = null; S.evCool.union = 12; log(`용병 조합 사태 마무리: ${how}`); }

export function endLeak(notes, how) { log(`전리품 누수가 멈춤 (${how}) · 그동안 샌 돈 ${fmt(S.leak.lost)}G`); notes.push(`전리품 거래 수입이 제자리를 찾았습니다. 그동안 새어 나간 돈은 약 ${fmt(S.leak.lost)}G였습니다.`); S.leak = null; S.evCool.leak = 8; }

export function endLord(how) { S.lord = null; S.evCool.lord = 12; log(`하르덴 백작의 용병 포섭이 끝남: ${how}`); }

export const AGENDAS: any[] = [
  // 교회의 첫인사는 이제 첫날 장면과 개척 사업(입구 축성)으로 들어간다. 옛 저장에 걸려 있는 안건을 처리하려고 정의만 남긴다
  { id: 'church_greet', prio: 3, who: 'church', name: '서부 교구 대사제', title: '대사제가 미궁 입구를 축성하겠답니다',
    when: () => false,
    text: () => '"미궁이 열린 땅은 불안한 법입니다. 입구를 축성하고 용병들의 무사를 비는 일을 교회에 맡겨 주시지요. 대신 관리국에서 매달 관례대로 헌금을 조금 보태 주시면 됩니다."',
    opts: [
      { label: '축성을 받는다', desc: '매달 관례 헌금 1,000G를 내기로 해요. 교회가 반기고, 용병들도 마음을 놓아요', apply() { S.custom = C.CUSTOM; S.budget.donation = C.CUSTOM; S.gC -= 15; S.trust += 4; flag('church_greet'); flag('church_blessed'); } },
      { label: '정중히 사양한다', desc: '관례 헌금이 생기지 않아요. 교회는 서운해하고, 나중에 헌금을 내려 해도 관례가 없다며 덜 반겨요', apply() { S.gC += 15; flag('church_greet'); flag('church_refused'); } },
    ], def: 0 },
  { id: 'merchant_greet', prio: 3, who: 'merchant', name: '상단 조합장', title: '상단 조합장이 환영 연회를 열었습니다',
    // 개청하고 나서 여는 환영 연회. 첫 달 출발점을 벌리지 않도록 운영기에 들어서야 올라온다
    when: () => S.phase === 'run',
    text: () => '"변경에 관리국이 생기다니 반가운 일입니다. 작은 성의를 준비했으니 받아 주시지요. 앞으로 오래 함께할 사이 아니겠습니까?" 연회가 끝날 무렵 조합장이 묵직한 상자를 내밉니다.',
    opts: [
      { label: '선물을 받는다', desc: '금고에 1,500G가 들어오고 상단이 크게 반겨요. 이 일은 어딘가에 기록으로 남아요', apply() { S.treasury += 1500; S.gM -= 10; flag('merchant_gift'); } },
      { label: '선물은 사양한다', desc: '조합장이 조금 머쓱해해요. 관리국이 만만치 않다는 인상을 남겨요', apply() { S.gM += 5; S.rel = Math.max(0, S.rel - 10); flag('clean_start'); } },
    ], def: 0 },
  // 사건이 걸린 안건 (사건이 이어지는 동안 거듭 올라옴)
  { id: 'union', prio: 2, repeat: true, who: 'secret', name: '용병 조합 대표 "철망치" 브란', title: '용병 조합이 요구서를 보냈습니다',
    when: () => !!S.union,
    text: () => `"새 면허는 아무도 받지 않을 겁니다. 통행세를 ${S.toll}G에서 ${S.toll - 20}G로 내리고, 미궁에서 죽은 동료의 가족에게 위로금을 주십시오."${S.union.refused ? ` 관리국은 이미 ${S.union.refused}번 거절했습니다.` : ''}`,
    opts: [
      { label: '모두 받아들인다', desc: () => `통행세가 ${S.toll - 20}G로 내리고, 매달 위로금 500G가 나가요. 조합이 해산하고 신뢰가 크게 올라요`,
        apply() { S.toll -= 20; addUpkeep('사망자 위로금 (조합 합의)', 500); S.trust += 10; flag('union_ok'); endUnion('요구를 모두 수용'); } },
      { label: '위로금만 준다', desc: '매달 위로금 500G. 조합원 절반쯤은 이걸로 만족할 거예요', apply(notes) {
        if (!S.union.halfPaid) { addUpkeep('사망자 위로금', 500); S.union.halfPaid = true; }
        S.trust += 3; if (rnd() < 0.55) endUnion('위로금으로 타협'); else notes.push('조합이 위로금은 받겠지만 통행세 이야기는 끝나지 않았다고 합니다.'); } },
      { label: '교회에 중재를 부탁한다', need: () => S.gC <= -15, needText: '교회가 호의적이어야 해요',
        desc: '통행세는 10G만 내려가요. 교회가 공을 세웠다며 관례 헌금을 200G 올려 달라 할 거예요',
        apply() { S.toll -= 10; S.custom += 200; S.gC += 10; flag('church_mediated'); endUnion('교회의 중재'); } },
      { label: '거부한다', desc: '신규 면허 보이콧이 이어져요. 세 번 거부하면 조합이 무너지지만 원한이 남아요',
        apply() { S.union.refused++; if (S.union.refused >= 3) { S.trust -= 12; flag('union_broken'); endUnion('조합이 무너짐'); } } },
    ], def: 3 },
  { id: 'leak', prio: 2, repeat: true, who: 'secret', name: '재무과', title: '전리품 수입이 새고 있습니다',
    when: () => S.leak && S.month - S.leak.m >= 2,
    text: () => `성공한 파티 수에 비해 전리품 거래 수입이 지난 ${S.month - S.leak.start}개월 동안 약 ${fmt(S.leak.lost)}G 모자랍니다. 상단 감정소가 값을 후려친다는 말도, 용병들이 전리품을 몰래 빼돌린다는 말도 돕니다. 어느 쪽인지 정해야 손을 쓸 수 있습니다.`,
    opts: [
      { label: '입구에 검문소를 세운다', cost: 1000, desc: '용병이 빼돌리는 거라면 막혀요. 어느 쪽이든 용병들은 불쾌해해요',
        apply(notes) { S.trust -= 4; flag('checkpoint');
          if (S.leak.who === 'mercs') endLeak(notes, '입구 검문');
          else { S.trust -= 4; S.leak.m = S.month; notes.push('검문소에서는 아무것도 나오지 않았습니다. 용병들만 몸수색에 불쾌해합니다.'); } } },
      { label: '상단 감정소를 고발한다', desc: '상단이 차익을 챙긴 거라면 절반을 돌려받아요. 틀리면 상단이 크게 분노해요',
        apply(notes) {
          if (S.leak.who === 'merchant') { S.treasury += Math.round(S.leak.lost * 0.5); S.gM += 10; flag('exposed_merchant'); endLeak(notes, '상단 고발'); }
          else { S.gM += 35; flag('false_accuse'); S.leak.m = S.month; notes.push('상단 감정소에서는 차익이 나오지 않았습니다. 조합장이 모욕을 당했다며 길길이 뜁니다.'); } } },
      { label: '더 지켜본다', desc: '감찰비를 넣으면 상단 장부가, 시장 조사비를 넣으면 조사 보고서가 단서가 돼요. 서기의 메모와 결산의 파티당 수입도 살펴보세요', apply() { S.leak.m = S.month; } },
    ], def: 2 },
  { id: 'lord', prio: 2, repeat: true, who: 'secret', name: '하르덴 백작의 사절', title: '이웃 영주가 용병을 데려가고 있습니다',
    when: () => S.lord && S.month >= S.lord.next,
    text: () => `"백작께서는 관리국과 다툴 생각이 없으십니다. 용병 몇을 영지 경비대로 넘겨주시면 매달 사례하겠습니다. 수도에 알릴 필요까지야 있겠습니까?" 지금까지 ${S.lord.taken}명이 백작령으로 떠났습니다.`,
    opts: [
      { label: '밀약을 맺는다', desc: '용병 15명을 넘기고 매달 800G를 받아요. 수도 몰래 하는 거래예요',
        apply() { S.M = Math.max(0, S.M - 15); S.lordIncome = 800; flag('lord_pact'); endLord('밀약'); } },
      { label: '수도에 고발한다', desc: '두 달 뒤 수도가 백작을 견제해요. 그동안은 계속 빠져나가요',
        apply() { S.lord.until = S.month + 2; S.lord.next = 99; flag('reported_lord'); } },
      { label: '면허 장려금으로 맞선다', cost: 3000, desc: '새로 오는 용병에게 장려금을 줘서 붙잡아요. 신뢰가 조금 올라요',
        apply() { S.trust += 6; endLord('장려금'); } },
      { label: '내버려 둔다', desc: '용병이 계속 조금씩 빠져나가요. 백작이 배를 채우면 언젠가 그치겠지요', apply() { S.lord.next = S.month + 3; } },
    ], def: 3 },
  // 선택이 쌓여서 생기는 안건 (한 번씩)
  { id: 'crown_inquiry', prio: 2, who: 'secret', name: '수도 감찰관', title: '수도가 백작과의 거래를 묻습니다',
    when: () => has('lord_pact') && since('lord_pact') >= 5,
    text: () => '"하르덴 백작령 경비대에 관리국 면허를 가진 자들이 있다는 보고가 올라왔습니다. 관리국장께서 직접 해명하시지요."',
    opts: [
      { label: '인정하고 밀약을 끊는다', cost: 3000, desc: '벌금 3,000G를 내고 사례금이 끊겨요', apply() { S.lordIncome = 0; log('수도에 백작과의 밀약을 인정함'); } },
      { label: '부인한다', desc: () => has('opened_books') ? '이미 공개한 장부에 사례금이 적혀 있어요' : '들키면 경고장이 와요. 반쯤은 넘어갈 수 있어요',
        apply(notes) { flag('lied_crown');
          if (has('opened_books') || rnd() < 0.45) { S.warn++; S.lordIncome = 0; log('밀약을 부인했다가 들통남 → 수도의 경고'); notes.push('감찰관이 백작령 장부 사본을 내밀었습니다. 수도에서 경고장이 날아옵니다.'); }
          else notes.push('감찰관이 의심스러운 눈으로 돌아갔습니다.'); } },
    ], def: 1 },
  { id: 'm_comp', prio: 1, who: 'merchant', name: '상단 조합장', title: '상단이 손실 보전을 요구합니다',
    when: () => has('cartel_bought') && !S.cartel,
    text: () => '"관리국이 헌금으로 교회를 데려가는 바람에 상단만 비싼 물건을 떠안은 꼴이 됐습니다. 그동안 신전에 들인 돈도 있으니, 손실을 조금은 보전해 주셔야 하지 않겠습니까?"',
    opts: [
      { label: '보전금을 준다', cost: 2000, desc: '상단의 서운함이 크게 풀려요. 다만 장부에 남고, 상단은 담합해도 손해 볼 게 없다고 배워요', apply() { S.gM -= 25; flag('paid_merchant'); } },
      { label: '거절한다', desc: '상단이 앙금을 품어요', apply() { S.gM += 15; flag('merchant_grudge'); } },
      { label: '감찰 장부를 내민다', need: () => has('audit'), needText: '상단을 감찰한 적이 있어야 해요', desc: '축복 수수료 기록으로 입을 막아요. 상단이 한동안 담합을 꿈꾸지 못해요',
        apply() { S.gM += 5; S.rel = Math.max(0, S.rel - 25); flag('exposed_merchant'); } },
    ], def: 1 },
  { id: 'c_apology', prio: 1, who: 'church', name: '대사제', title: '대사제가 사과문을 요구합니다',
    when: () => has('cartel_audited') && !(S.schism && S.schism.outcome === 'reform'),
    text: () => '"신전 회계실을 죄인 다루듯 뒤진 일이 신도들 사이에 퍼졌습니다. 관리국장 명의의 사과문 한 장이면 이 일을 덮겠습니다."',
    opts: [
      { label: '사과문을 보낸다', desc: '교회의 앙금이 풀려요. 대신 앞으로는 감찰을 세 달 연속 해야 교회가 겁을 먹어요', apply() { S.gC -= 25; flag('apologized'); } },
      { label: '감찰 결과를 공개한다', desc: '용병과 신도들이 관리국을 다시 봐요. 교회는 크게 분노해요', apply() { S.gC += 20; S.trust += 6; flag('public_audit'); } },
      { label: '답하지 않는다', desc: '교회의 앙금이 조금 더 쌓여요', apply() { S.gC += 8; } },
    ], def: 2 },
  { id: 'open_books', prio: 1, who: 'church', name: '리아나 사제와 용병 대표들', title: '관리국 장부도 공개하라고 합니다',
    when: () => (has('public_audit') || (S.schism && S.schism.outcome === 'reform')) && S.month >= 14,
    text: () => '"교회 장부를 열라고 한 관리국이니, 관리국 장부도 열어 보여야 공평하지 않겠습니까?"',
    opts: [
      { label: '장부를 공개한다', desc: '깨끗하다면 신뢰를 얻어요. 숨길 게 있었다면 드러나요', apply(notes) {
        const dirty = Object.keys(DIRTY).filter(has); flag('opened_books');
        if (!dirty.length) { S.trust += 10; notes.push('공개된 관리국 장부에서 흠잡을 데가 없다는 말이 돕니다.'); }
        else { S.trust -= 6 * dirty.length; S.gC += 10; notes.push(`공개된 장부에서 ${dirty.map(d => DIRTY[d]).join(', ')}이(가) 드러나 말이 많습니다.`); log('장부 공개로 드러난 일: ' + dirty.map(d => DIRTY[d]).join(', ')); } } },
      { label: '거부한다', desc: '용병들이 관리국을 의심해요', apply() { S.trust -= 6; flag('secretive'); } },
    ], def: 1 },
  { id: 'ws_artisans', prio: 1, who: 'merchant', name: '상단 소속 약제사 셋', title: '상단 약제사들이 공방으로 옮기고 싶어 합니다',
    when: () => done('ws') && since('fac_ws') >= 5,
    text: () => '"상단에서는 일한 만큼 받지 못합니다. 관리국 공방에서 일하게 해 주시면 생산량을 크게 늘려 드리겠습니다."',
    opts: [
      { label: '고용한다', desc: `공방의 한 달 생산 한도가 ${C.WS_CAP}병에서 100병으로 늘고, 매달 인건비 400G가 나가요. 상단이 크게 분노해요`,
        apply() { S.wsCap = 100; addUpkeep('약제사 인건비', 400); S.gM += 25; flag('poached'); } },
      { label: '돌려보낸다', desc: '조합장이 이 일을 전해 듣고 고마워해요', apply() { S.gM -= 10; } },
    ], def: 1 },
  { id: 'consign_fee', prio: 1, who: 'merchant', name: '상단 조합장', title: '감정 위탁 수수료를 올려 달랍니다',
    when: () => done('consign') && since('fac_consign') >= 6,
    text: () => '"감정 일이 늘어 일손이 모자랍니다. 매달 수수료 300G만 얹어 주시면 지금처럼 정성껏 모시지요."',
    opts: [
      { label: '받아들인다', desc: '매달 300G가 나가요. 상단이 더 호의적이 돼요', apply() { addUpkeep('감정 위탁 수수료', 300); S.gM -= 10; } },
      { label: '위탁을 거둬들인다', desc: '전리품 수입 15% 보너스가 사라지고 상단이 크게 서운해해요. 감정소를 지을 수 있게 돼요', apply() { delete S.fac.consign; S.gM += 20; flag('consign_cut'); } },
    ], def: 0 },
  { id: 'guide_comp', prio: 1, who: 'secret', name: '용병 파티 대표들', title: '빗나간 공략본의 책임을 묻습니다',
    when: () => has('guide_wrong'),
    text: () => '"관리국 공략본대로 편성했다가 동료를 잃었습니다. 관리국이 낸 책이니 관리국이 책임지십시오."',
    opts: [
      { label: '위로금을 준다', cost: 2500, desc: '용병들이 관리국이 책임질 줄 안다고 여겨요', apply() { S.trust += 8; flag('compensated'); } },
      { label: '교회에 장례를 부탁한다', cost: 800, need: () => S.gC <= 0, needText: '교회와 사이가 나쁘지 않아야 해요', desc: '교회가 장례 미사를 열어 줘요. 위로는 되지만 책임을 피했다는 말도 나와요', apply() { S.trust += 3; S.gC -= 5; } },
      { label: '거절한다', desc: '공략본은 참고일 뿐이라고 답해요. 용병들 사이에 원망이 남아요', apply() { S.trust -= 6; flag('cold'); } },
    ], def: 2 },
  { id: 'guide_rights', prio: 1, who: 'secret', name: '수도의 출판업자', title: '공략본 판권을 사겠답니다',
    when: () => (S.flags.guide_ok || 0) >= 2,
    text: () => '"관리국 공략본이 잘 맞는다는 소문이 수도까지 났습니다. 판권을 넘겨주시면 넉넉히 드리지요. 물론 그 뒤로는 저희가 값을 매겨 팝니다."',
    opts: [
      { label: '판권을 판다', desc: '당장 4,000G가 들어와요. 대신 책값 때문에 공략본을 따르는 파티가 10%p 줄어요', apply() { S.treasury += 4000; S.adoptBonus -= 0.1; flag('sold_guides'); } },
      { label: '무상으로 배포한다', desc: '공략본을 따르는 파티가 10%p 늘고 용병 신뢰가 올라요', apply() { S.adoptBonus += 0.1; S.trust += 5; flag('free_guides'); } },
    ], def: 1 },
  { id: 'novice_stay', prio: 1, who: 'church', name: '대사제', title: '견습 사제들을 상주시키고 싶답니다',
    when: () => has('deal_novice') && !S.deals.novice,
    text: () => '"견습 사제들이 용병들과 정이 들었습니다. 아예 미궁 입구에 상주하게 해 주시면 어떻겠습니까? 숙소와 식비만 대 주시면 됩니다."',
    opts: [
      { label: '상주를 허가한다', desc: '매달 500G로 사망이 20% 줄어요. 교회의 입김이 미궁 안까지 들어와요', apply() { addUpkeep('견습 사제 상주비', 500); S.deathMul *= 0.8; S.gC -= 10; flag('church_in'); } },
      { label: '돌려보낸다', desc: '교회가 조금 서운해해요', apply() { S.gC += 5; } },
    ], def: 1 },
];

export function applyAgenda(notes) {
  if (!S.agenda) return;
  const A = AGENDAS.find(a => a.id === S.agenda.id);
  let i = S.agenda.pick ?? A.def;
  if (A.opts[i].need && !A.opts[i].need()) i = A.def;
  const o = A.opts[i];
  o.apply(notes);
  if (!A.repeat) S.agendaDone[A.id] = true;
  log(`안건 결재: ${A.title} → ${o.label}${S.agenda.pick == null ? ' (고르지 않아 기본 처리)' : ''}`);
  S.agenda = null;
}

export function pickAgenda() {
  const c = AGENDAS.filter(a => !S.agendaDone[a.id] && a.when());
  if (!c.length) return;
  const top = Math.max(...c.map(a => a.prio));
  const pool = c.filter(a => a.prio === top);
  S.agenda = { id: pool[Math.floor(rnd() * pool.length)].id, pick: null, m: S.month };
}
