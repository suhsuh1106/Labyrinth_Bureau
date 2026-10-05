// 한 달 결재: resolve와 해마다의 사건, 임기 평가
import { applyAgenda, flag, has, pickAgenda } from './agendas';
import { ANOMALIES, C, CLASSES, CLASS_SHARE, OFFERS, TARGETS } from './data';
import { adoptRate, cartelScore, costs, fair, intelQ, pLedgerC, pLedgerM, prices, project } from './economy';
import { rollEvents } from './events';
import { explore, foodLeave, rootPress } from './explore';
import { coreDone, devDone, endFounding, founding, resolveDev, staffRebudget } from './founding';
import { fameAdd, heroApplicants, heroMonth, heroOpened } from './hero';
import { rows } from './html';
import { intelReport } from './intel';
import { rnd } from './rng';
import { floorSecrets } from './secrets';
import { S, learn, log } from './state';
import { clamp, fmt, keyLabel, pct } from './util';
import { allFacs, done } from './world';

export function resolve() {
  const t0 = S.treasury;
  S.soldBacklog = 0;
  const b = { ...S.budget };
  const pr = project(b);
  const { P, qM, qC, qW, cov } = pr;
  const F = fair(), K0 = costs();
  const notes = [], notices = [];
  applyAgenda(notes);
  const M = S.M;
  const nextMonth = S.month + 1;
  let rebate = 0;
  S.talk = null;

  // 세력 제안 수락
  S.offers.filter(o => o.accepted).forEach(o => {
    const O = OFFERS[o.id];
    if (o.id === 'cap') { S.cap = 120; S.used.cap = true; S.gM += 10; }
    else S.deals[o.id] = { left: 3 };
    if (O.who === 'merchant') S.gM -= 8; else S.gC -= 8;
    flag('deal_' + o.id);
    log(`${O.who === 'merchant' ? '상단' : '교회'} 제안 수락: ${O.title}`);
  });
  S.offers = [];

  // 공략본 발간
  if (S.pendingGuide) {
    const { f, key } = S.pendingGuide;
    const fl = S.floors[f];
    fl.guide = key; fl.guideMonth = S.month; fl.guideOk = key === fl.weak;
    log(`${f + 1}층 공략본 발간: "${keyLabel(key)}"`);
    S.pendingGuide = null;
  }

  // 탐사
  const adopt = S.floors.some(f => f.guide) ? clamp(adoptRate(b.support) + (done('mapper') ? 0.15 : 0) + S.adoptBonus, 0, 0.95) : 0;
  const sup = pr.sup;
  const pv = pr.pv;
  const ex = explore(cov, adopt, sup, pv);
  const hr = heroMonth(b, pr, ex, notes);
  let heroLoot = Math.round(hr.loot);
  S.stock = Math.floor((S.stock - pr.draw + pr.toStock) * (1 - C.SPOIL));
  const deaths = ex.deaths;
  let leakLost = 0;
  if (S.leak) { leakLost = Math.round(ex.loot * 0.2); ex.loot -= leakLost; S.leak.lost += leakLost; }
  if (S.privateExp) {
    ex.loot = Math.round(ex.loot * 0.9); heroLoot = Math.round(heroLoot * 0.9);
    if (--S.privateExp.left <= 0) { S.privateExp = null; notes.push('상단 사설 탐사대가 최전선에서 철수했습니다.'); }
  }
  // 판로가 없으면 전리품은 팔리지 못하고 창고에 쌓인다 (용사 파티가 가져온 것도 마찬가지)
  if (!devDone('market')) { S.unsold += ex.loot + heroLoot; ex.loot = 0; heroLoot = 0; }
  else { ex.loot = Math.round(ex.loot * S.lootMul); heroLoot = Math.round(heroLoot * S.lootMul); }
  const tollRate = S.toll;   // 개척 사업이 이번 달 끝에 통행세를 바꿔도 이번 달 장부는 이 요율로 남긴다
  const income = M * tollRate + ex.loot + heroLoot + S.lordIncome + ex.feeIn;
  const spend = pr.spend - pr.feeOut + ex.feeOut;
  const net = income - spend;
  S.treasury += net;
  S.lastLoot = ex.loot + heroLoot;
  // 미궁의 압력: 꺼낸 만큼 차오른다. 봉인한 층은 덜, 채굴하는 층은 더 채운다
  S.pressure += ex.byFloor.reduce((a, bf, i) => a + bf.got * rootPress(i), 0) / 15000 + ex.n / 100;
  // 이상 징후와 범람은 날짜가 아니라 압력이 차야 일어난다. 어떤 판은 끝까지 조용하다
  if (S.anoms.length < ANOMALIES.length && S.pressure >= 22 + 7 * S.anoms.length && rnd() < 0.4) {
    const t = ANOMALIES[S.anoms.length]; S.anoms.push({ m: S.month, t }); log('이상 징후: ' + t); notes.push(t);
  }
  let od = 0;
  if (!S.overflow && S.anoms.length >= 2 && S.pressure >= 38 && rnd() < 0.3) {
    od = Math.round(S.M * 0.06);
    S.overflow = { m: S.month, deaths: od, cost: 5000, pressure: Math.round(S.pressure) };
    S.treasury -= 5000; S.trust -= 12; S.gC += 15;
    log(`소규모 범람: 몬스터가 위층으로 쏟아져 용병 ${od}명 사망, 복구비 5,000G`);
  }

  const deep = S.floors[S.unlocked - 1];
  const before = deep.prog;
  deep.prog = Math.min(100, deep.prog + ex.byFloor[S.unlocked - 1].w * C.PROG_PER_WIN * (done('camp') ? 1.5 : 1) + hr.prog);
  deep.heroProg = (deep.heroProg || 0) + Math.min(hr.prog, deep.prog - before);
  floorSecrets(notes, ex);
  if (deep.prog >= 70 && deep.known < 2) { deep.known = 2; log(`${S.unlocked}층에 사는 것의 이름이 알려짐: ${deep.mon.name}`); notes.push(`용병들이 ${S.unlocked}층에 사는 것을 '${deep.mon.name}'(이)라 부르기 시작했습니다.`); }
  if (before < 100 && deep.prog >= 100) {
    heroOpened(S.unlocked - 1, notes);
    if (S.unlocked < S.floors.length) { log(`${S.unlocked}층 개척 완료 → ${S.unlocked + 1}층 개방`); notes.push(`${S.unlocked}층 개척을 마쳤습니다. ${S.unlocked + 1}층이 열렸습니다. 더 깊을수록 전리품 값이 오릅니다.`); S.unlocked++; }
    else log(`${S.floors.length}층 개척 완료. 최심부로 가는 길이 보입니다`);
  }

  // 공략본 평판 (발간 다음 달 결과로)
  S.floors.forEach((fl, i) => {
    if (fl.guide && fl.guideMonth === S.month && ex.byFloor[i].n) {
      if (fl.guideOk) { flag('guide_ok'); S.trust += 10; notes.push(`${i + 1}층 공략본이 맞아떨어졌다는 평이 돕니다. 용병들이 관리국을 다시 봅니다.`); log(`${i + 1}층 공략본 적중 → 용병 신뢰 상승`); }
      else { flag('guide_wrong'); S.trust -= 8; notes.push(`${i + 1}층 공략본대로 했다가 크게 당했다는 원성이 들립니다.`); log(`${i + 1}층 공략본이 빗나감 → 용병 신뢰 하락`); }
    }
  });
  const rate = ex.n ? ex.wins / ex.n : 0;
  S.trust += (rate - 0.5) * 16 - Math.max(0, deaths - 4) * 1.5;
  // 입장료가 비싸면 용병들이 박하다고 느끼고, 보조금을 주면 반긴다
  const avgFee = (ex.feeIn - ex.feeOut) / Math.max(1, ex.n);
  S.trust -= avgFee / 150;
  if (avgFee >= 100) { flag('fee_gouge'); notes.push('용병들이 관리국이 입장료로 등골을 뺀다며 투덜댑니다.'); }
  else if (ex.feeOut > 0 && rnd() < 0.3) notes.push('입장 보조금이 나오는 층으로 가자는 말이 용병 숙소에서 돕니다.');
  // 명성: 홍보비가 조금씩 쌓고, 가만두면 식는다. 이름난 관리국은 용병이 믿고 찾아온다
  if (pr.hero.active && S.hero) fameAdd((b.heroPub || 0) / 1000 * 0.8);
  S.fame += (C.FAME0 - S.fame) * 0.04;
  S.trust += (S.fame - 50) * 0.02;
  S.trust += (50 - S.trust) * 0.05;
  S.trust = clamp(S.trust, 0, 100);
  const fLeave = foodLeave(pv.food.cov, M);
  if (pv.food.cov < 1) S.trust -= (1 - pv.food.cov) * 5;
  let leave = Math.round(M * 0.03 + (1 - cov) * M * 0.08 + (S.trust < 35 ? M * 0.03 : 0)) + fLeave;
  let arrive = Math.max(0, Math.round(3 + S.trust / 10) - (S.gC >= 60 ? 3 : 0) + Math.round((S.fame - C.FAME0) / 10));
  if (S.union) { arrive = 0; leave += Math.round(M * 0.01); notes.push('용병 조합의 보이콧으로 새 면허를 받으러 오는 사람이 없습니다.'); }
  if (S.lord) { const t = Math.round(M * 0.025); leave += t; arrive = Math.max(0, arrive - 3); S.lord.taken += t; }

  // 개척 시설
  allFacs().forEach(fa => {
    const st = S.fac[fa.id];
    if (!st) return;
    if (st.state === 'pending') {
      st.state = 'building'; st.left = fa.months; flag('fac_' + fa.id);
      if (fa.react.gM) S.gM += fa.react.gM;
      if (fa.react.gC) S.gC += fa.react.gC;
      if (fa.trust) S.trust += fa.trust;
      if (fa.id === 'consign') learn('merchant', 'like', 'consign');
      if (fa.id === 'ws' || fa.id === 'appraise') learn('merchant', 'hate', 'build');
      if (fa.id === 'clinic' || fa.id === 'camp') learn('church', 'like', 'clinic');
      log(`${fa.name} 착공 (${fmt(fa.cost)}G, ${fa.months}개월)`);
      notes.push(fa.rumor);
    } else if (st.state === 'building') {
      st.left--;
      if (st.left <= 0) {
        st.state = 'done';
        log(`${fa.name} 완공`); notes.push(fa.doneMsg);
        if (fa.id === 'ws') S.wsBuilt = true;
        if (fa.id.startsWith('seal')) S.pressure = Math.max(0, S.pressure - 6);
        if (fa.id === 'clinic') { S.custom += 200; log(`교회 관례 헌금이 ${fmt(S.custom)}G로 오름 (구호소 공동 운영)`); }
      }
    }
  });


  // 세력 관계 (양수 = 서운함, 음수 = 호의). 가만히 두면 무덤덤으로 돌아감
  S.gM *= 0.9; S.gC *= 0.9;
  if (!devDone('supply')) S.avgVol = qM;
  else if (qM < 0.7 * S.avgVol) { S.gM += 15; learn('merchant', 'hate', 'drop'); notes.push('상단 조합장이 관리국 주문이 줄었다고 투덜댑니다.'); }
  else if (qM >= 0.9 * S.avgVol) { S.gM -= 4; if (S.month >= 3) learn('merchant', 'like', 'steady'); }
  S.avgVol = 0.7 * S.avgVol + 0.3 * qM;
  const gearGuides = S.floors.filter(f => f.guide && f.guide.startsWith('g:')).length;
  if (gearGuides && b.support > 0) { S.gM -= Math.min(6, b.support / 500); learn('merchant', 'like', 'gear'); if (rnd() < 0.4) notes.push('공략본 덕에 원소 장비가 잘 팔린다며 상단이 흐뭇해합니다.'); }
  if (S.deals.gear) S.gM -= 3;
  if (sup.sets) { S.gM -= Math.min(5, sup.sets / 3); learn('merchant', 'like', 'rent'); if (rnd() < 0.3) notes.push(`상단이 관리국에 빌려준 ${sup.gk.map(k => k.slice(2)).join('·')} 장비 값이 쏠쏠하다며 웃습니다.`); }
  // 보급을 크게 깎으면 그 물건을 대던 쪽이 서운해한다
  if (pv.repair.paidCov < 0.7) { S.gM += 4; learn('merchant', 'hate', 'repair'); }
  if (pv.food.paidCov < 0.7) { S.gC += 4; learn('church', 'hate', 'food'); }
  if (pv.food.fulfill < 1 && pv.food.paidCov > 0) notes.push(`교회 곳간이 관리국이 산 식량의 ${pct(pv.food.fulfill)}만 내주었습니다. 서운한 게 있다는 눈치입니다.`);
  if (pv.food.cov < 0.8) notes.push('용병 숙소의 식탁이 비었다는 말이 돕니다. 배를 곯느니 다른 미궁으로 가겠다는 사람이 늘었습니다.');
  if (pv.haul.cov < 0.8) notes.push('짐꾼이 모자라 미궁 안에 두고 나온 전리품이 있다고 합니다.');
  if (pv.repair.cov < 0.8) notes.push('날이 빠진 무기를 그대로 들고 들어가는 파티가 늘었습니다.');
  if (sup.priestPaid) {
    S.gC -= Math.min(5, sup.priestPaid / 2); learn('church', 'like', 'dispatch'); S.priestRun++;
    if (sup.priests < sup.priestPaid) notes.push(`교회가 요청한 사제 ${sup.priestPaid}명 중 ${sup.priests}명만 보냈습니다. 관리국에 서운한 게 있다는 눈치입니다.`);
  } else {
    if (S.priestRun >= 4) { S.gC += 10; learn('church', 'hate', 'cutoff'); notes.push('오래 보내던 사제 파견을 관리국이 끊자 교회가 서운해합니다.'); }
    S.priestRun = 0;
  }
  if (done('consign')) S.gM -= 2;
  const twoCustom = S.schism && S.schism.outcome === 'compromise';
  const donTotal = b.donation + (b.donR || 0);
  if (twoCustom) {
    [['donation', S.custom, '정통파'], ['donR', S.customR, '개혁파']].forEach(([k, cu, nm]) => {
      if ((b[k] || 0) < cu) { S.gC += 8; learn('church', 'hate', 'lowdon'); notes.push(`${nm} 헌금이 관례보다 줄었다며 ${nm}가 불만을 표합니다.`); }
      else S.gC -= 1 + ((b[k] || 0) - cu) / 100;
    });
  } else if (donTotal < S.custom) { S.gC += 12; learn('church', 'hate', 'lowdon'); notes.push('헌금이 관례보다 줄었다며 교회에서 불만이 나옵니다.'); }
  else { S.gC -= 2 + (donTotal - S.custom) / 100; if (donTotal > S.custom) learn('church', 'like', 'donation'); }
  if (!twoCustom) {
    S.donHist.push(donTotal); if (S.donHist.length > 6) S.donHist.shift();
    if (S.donHist.length === 6) {
      const settled = Math.floor(Math.min(...S.donHist) * 0.9 / 100) * 100;
      if (settled > S.custom) { S.custom = settled; log(`교회가 매달 ${fmt(settled)}G를 당연하게 여기기 시작함 (새 관례)`); notes.push(`여섯 달째 비슷한 헌금이 들어오자 교회가 이제 ${fmt(settled)}G를 당연한 관례로 여깁니다.`); }
    }
  }
  const dRate = deaths / Math.max(1, M) * 100;
  if (dRate > 3) { S.gC += 3 * (dRate - 3) * S.deathSens; if (dRate > 4) learn('church', 'hate', 'deaths'); }
  else if (dRate <= 2) { S.gC -= 4; learn('church', 'like', 'safe'); if (rnd() < 0.4) notes.push('관리국이 사람을 아낀다는 말이 교회에서 나옵니다.'); }
  if (S.floors.some(f => f.guide === 'c:사제')) { S.gC -= 3; learn('church', 'like', 'priest'); }
  if (S.gM < S.gC - 50) { S.gC += 3; learn('church', 'hate', 'jealous'); if (rnd() < 0.5) notes.push('교회가 관리국이 상단과만 가깝게 지낸다며 못마땅해합니다.'); }
  else if (S.gC < S.gM - 50) { S.gM += 3; learn('merchant', 'hate', 'jealous'); if (rnd() < 0.5) notes.push('상단이 관리국이 교회 편만 든다며 투덜댑니다.'); }
  if (pr.hero.active) {
    if ((b.heroGear || 0) > 0) { S.gM -= Math.min(4, b.heroGear / 500); learn('merchant', 'like', 'hero_gear'); }
    if (S.hero && S.fame >= 50 && S.hero.members.some(m => m.origin === 'church')) S.gC -= 2;
    if (S.hero && S.fame >= 50 && S.hero.members.some(m => m.origin === 'merchant')) S.gM -= 2;
  }
  if (dRate >= 5) notes.push(`이번 달 사망자가 ${deaths}명입니다. 교회가 장례 미사에서 관리국을 언급했습니다.`);
  if (cov < 0.8) notes.push('용병들 사이에서 물약이 모자란다는 불만이 돕니다. 떠나는 사람이 늘었습니다.');
  if (S.gC >= 60) notes.push('교회가 설교에서 관리국을 비판했습니다. 새로 오는 용병이 줄어듭니다.');

  // 약속 · 제안 기간
  if (S.deals.bulk && qC > 0) { delete S.deals.bulk; S.gM += 25; flag('breach'); learn('merchant', 'hate', 'breach'); log('독점 계약 중에 교회 포션을 삼 → 계약 파기, 상단이 크게 서운해함'); notes.push('독점 계약을 어기고 교회 포션을 샀다며 상단 조합장이 크게 언짢아합니다. 할인도 끝났습니다.'); }
  else if (S.deals.bulk) { S.gC += 6; learn('church', 'hate', 'excl'); notes.push('관리국이 상단하고만 거래한다며 교회 회계실이 한숨을 쉽니다.'); }
  Object.keys(S.deals).forEach(k => { if (--S.deals[k].left <= 0) { delete S.deals[k]; log(`${OFFERS[k].title} 기간 종료`); } });

  // 감찰
  // 감찰: 쓴 만큼 장부를 얻을 확률·감시 효과·불쾌감이 함께 오른다
  const a = b.audit;
  const audited = a > 0 && rnd() < pLedgerM(a), full = a > 0 && rnd() < pLedgerC(a);
  S.noAudit = clamp(S.noAudit + 1 - a / 1000, 0, 6);
  if (audited) flag('audit');
  if (full) flag('audit_church');
  if (a > 0 && !S.cartel) {
    if (audited) learn('merchant', 'hate', 'audit'); if (full) learn('church', 'hate', 'audit');
    const k = a / 1000, kc = Math.max(0, a - 1000) / 1000;
    if (S.shock > 0) { S.gM += 3 * k; S.gC += 3 * kc; if (a >= 1000) notes.push('흉작으로 값을 올렸을 뿐인데 감찰을 받았다며 공급처들이 불쾌해합니다.'); }
    else { S.gM += 1.3 * k; S.gC += 1.3 * kc; }
  }

  // 교회 종파 다툼
  if (S.schism && !S.schism.outcome) {
    const SC = S.schism, dR = b.donR || 0;
    SC.R = clamp(SC.R + (dR - b.donation) / 300 + (dRate > 3 ? 1 : 0) + (full ? 2 : 0), 0, 100);
    if (dR > b.donation) { S.gC += (dR - b.donation) / 500; notes.push('대사제가 관리국이 개혁파에 돈을 댄다며 불쾌해합니다.'); }
    notes.push(SC.R >= 60 ? '개혁파의 집회에 사람이 몰립니다. 젊은 사제들이 대사제의 회계를 공개하라고 외칩니다.' : SC.R <= 25 ? '정통파가 개혁파 사제들을 징계하기 시작했습니다.' : '교회 안의 다툼이 팽팽합니다. 신도들이 두 쪽으로 갈려 수군댑니다.');
  }

  // 담합 진행
  let ended = null;
  if (S.cartel) {
    const K = S.cartel;
    K.months++; S.cartelMonths++;
    S.overpaid += (P.m - F.m) * qM + (P.c - F.c) * qC;
    rebate = Math.round(0.3 * Math.max(0, P.m - F.m) * qM);
    const extra = Math.max(0, P.c - F.c) * qC;
    if (full) { K.auditStreak++; if (!K.spooked) { K.spooked = true; log('감찰관이 교회 회계실을 조사 → 교회가 상단의 뒷돈을 꺼리기 시작'); notes.push('감찰관이 신전 회계실을 다녀간 뒤로 사제들이 부쩍 말을 아낍니다.'); } }
    else K.auditStreak = 0;
    const value = rebate * (K.spooked ? 0.4 : 1) + extra;
    const offer = b.donation * 1.5 * (1 - clamp(S.gC, 0, 100) / 200);
    const share = qW / Math.max(1, pr.need);

    if (b.donation > S.custom && !K.raised) { K.raised = true; log(`교회 헌금을 관례보다 늘림 (${fmt(b.donation)}G)`); }
    if (b.donation > S.custom && offer > value) {
      ended = 'donation';
      S.talk = { month: S.month, rebate, spooked: K.spooked, extra, qC, over: P.c - F.c, donation: b.donation, value: Math.round(value), offer: Math.round(offer), gC: Math.round(S.gC) };
    } else if (K.auditStreak >= (has('apologized') ? 3 : 2)) {
      ended = 'audit';
    } else {
      if (offer >= 0.7 * value && b.donation > S.custom) {
        if (!K.wavered) { K.wavered = true; log('대사제가 흔들리기 시작함'); }
        notes.push('대사제가 관리국의 헌금에 각별한 감사를 전해 왔습니다. 무언가 망설이는 눈치입니다.');
      }
      // 비축으로 버티며 담합한 두 곳의 주문을 함께 줄여야 효과가 있다
      if (qM + qC < 0.5 * K.vol0) K.low++; else K.low = 0;
      if (share >= 0.25) K.wsMonths = (K.wsMonths || 0) + 1; else K.wsMonths = 0;
      if (K.wsMonths >= 2) ended = 'merchant';
      else if (K.low >= 3) ended = 'boycott';
      else if (K.low >= 2 && !K.caved) {
        K.caved = true; S.gM += 15;
        log('상단 주문이 두 달 연속 급감 → 상단이 단가를 일부 양보');
        notices.push({ who: 'merchant', name: '상단 조합장', text: `관리국과의 오랜 거래를 생각해 다음 달부터 단가를 ${F.m + 20}G로 조정해 드리겠습니다.` });
      }
      if (rnd() < 0.5) notes.push('상단 조합장이 요즘 신전에 자주 드나든다고 합니다.');
    }

    if (ended) {
      flag({ donation: 'cartel_bought', audit: 'cartel_audited', merchant: 'cartel_ws', boycott: 'cartel_boycott' }[ended]);
      S.cartel = null; S.cooldown = 4; S.rel = 5;
      if (ended === 'donation') {
        const nc = Math.max(S.custom, Math.round(b.donation * 0.6 / 100) * 100);
        log(`교회가 담합에서 이탈 (헌금으로 데려옴). 관례 헌금이 ${fmt(nc)}G로 오름`);
        S.custom = nc; S.gC -= 25; S.gM += 25;
        notices.push({ who: 'church', name: '대사제', text: '교회는 다음 달부터 성수 포션을 제값에 공급하겠습니다. 관리국의 깊은 신앙심에 감사드립니다.' });
        notices.push({ who: 'merchant', name: '상단 조합장', text: '상단도 단가를 되돌리겠습니다. 부디 거래를 이어 가 주시길 바랍니다.' });
        notes.push('상단 조합장이 신전 앞에서 대사제와 크게 언성을 높였다는 목격담이 있습니다.');
      } else if (ended === 'audit') {
        log('두 달 연속 감찰 → 교회가 겁을 먹고 담합에서 이탈. 대신 관리국에 앙금이 남음');
        S.gC += 30; S.gM += 15;
        notices.push({ who: 'church', name: '대사제', text: '관리국이 신전을 죄인 다루듯 하니 유감입니다. 포션은 제값에 드리겠으나, 이 일은 잊지 않겠습니다.' });
        notices.push({ who: 'merchant', name: '상단 조합장', text: '…상단도 단가를 되돌리겠습니다.' });
      } else if (ended === 'boycott') {
        log('비축분으로 버티며 석 달 주문을 끊음 → 상단과 교회가 담합을 포기');
        S.gM += 12; S.gC += 6; S.rel = 10;
        notices.push({ who: 'merchant', name: '상단 조합장', text: '창고에 쌓인 물건이 썩어 갑니다. 단가를 되돌릴 테니 주문을 다시 넣어 주십시오.' });
        notices.push({ who: 'church', name: '교회 회계 사제', text: '교회도 단가를 예전대로 맞추겠습니다.' });
      } else {
        log('공방 가동으로 관리국이 덜 아쉬워짐 → 상단이 담합을 포기');
        S.gM += 10; S.rel = 15;
        notices.push({ who: 'merchant', name: '상단 조합장', text: '관리국이 직접 포션을 만드신다니 저희도 욕심을 접겠습니다. 단가를 되돌리지요.' });
        notices.push({ who: 'church', name: '교회 회계 사제', text: '교회도 단가를 예전대로 맞추겠습니다.' });
      }
    }
  }

  // 담합 발생 판정
  let formed = false;
  if (!S.cartel && !ended) {
    if (S.cooldown > 0) S.cooldown--;
    else if (!founding() && S.month >= S.runStart + 3 && S.rel >= 25 && S.gM > -30 && S.gC > -30 && !S.churchReform) {
      const sc = cartelScore(pr);
      const p = clamp(0.08 * sc, 0, 0.5);
      if (rnd() < p) {
        formed = true; S.cartels++;
        S.cartel = { start: nextMonth, markup: 1.6 + 0.12 * clamp(sc, 0, 3.3), months: 0, low: 0, caved: false, spooked: false, auditStreak: 0, vol0: Math.max(40, qM + qC) };
      } else if (p > 0.14 && rnd() < 0.5) {
        notes.push('상단 조합장과 교회 회계 사제가 함께 식사하는 모습이 자주 보입니다.');
      }
    }
  }

  // 약초 흉작 (진짜 원가 상승)
  const shockBefore = S.shock > 0;
  // 흉작은 두 달 전부터 조짐이 있다 (시장 조사로 미리 읽을 수 있음)
  if (S.shock > 0) S.shock--;
  else if (S.shockIn > 0) { S.shockIn--; if (S.shockIn === 0) S.shock = 3; }
  else if (S.month >= 3 && rnd() < 0.07) S.shockIn = 2;
  if (S.shockIn > 0 && rnd() < 0.3) notes.push('남부에서 올라온 상인들이 올해 약초밭 작황을 걱정합니다.');
  const shockStarted = !shockBefore && S.shock > 0, shockEnded = shockBefore && S.shock === 0;
  if (shockStarted) {
    log('약초 흉작으로 원가 상승 (진짜)');
    if (rnd() < 0.6) notes.push('남부 약초 산지에 흉작이 들었다는 소식입니다.');
    if (!S.cartel) {
      notices.push({ who: 'merchant', name: '상단 조합장', text: `약초 흉작으로 원가가 올라 다음 달부터 단가를 ${C.BASE_COST_M + C.SHOCK_COST + 20}G로 조정합니다.`, date: `제${nextMonth}월 1일` });
      notices.push({ who: 'church', name: '교회 회계 사제', text: `약초 값이 올라 성수 포션 단가를 ${C.BASE_COST_C + C.SHOCK_COST + 30}G로 조정합니다.`, date: `제${nextMonth}월 1일` });
    }
  }
  if (shockEnded && !S.cartel) {
    notices.push({ who: 'merchant', name: '상단 조합장', text: '약초 수급이 회복되어 단가를 되돌립니다.' });
    notices.push({ who: 'church', name: '교회 회계 사제', text: '약초 값이 안정되어 단가를 예전대로 맞춥니다.' });
  }
  if (formed) {
    const np = prices();
    const why = S.shock > 0 ? '약초 흉작으로' : '원자재 수급 악화로';
    log(`상단(${np.m}G)과 교회(${np.c}G)가 같은 날 포션 단가를 올림`);
    notices.push({ who: 'merchant', name: '상단 조합장', text: `${why} 이번 달부터 포션 단가를 ${np.m}G로 조정합니다. 양해 바랍니다.`, date: `제${nextMonth}월 1일` });
    notices.push({ who: 'church', name: '교회 회계 사제', text: `성수 수급 사정으로 이번 달부터 포션 단가를 ${np.c}G로 조정함을 양해 바랍니다.`, date: `제${nextMonth}월 1일` });
  }

  if (!S.cartel && !ended) S.rel = Math.min(80, S.rel + 3);
  S.gM = clamp(S.gM, -100, 100); S.gC = clamp(S.gC, -100, 100);

  // 호의적인 세력의 제안 (다음 달 서류함)
  ['merchant', 'church'].forEach(who => {
    const g = who === 'merchant' ? S.gM : S.gC;
    if (g > -25 || S.cartel || rnd() > 0.35) return;
    const ids = Object.keys(OFFERS).filter(id => OFFERS[id].who === who && !S.deals[id] && !(OFFERS[id].once && S.used[id]));
    if (!ids.length) return;
    const id = ids[Math.floor(rnd() * ids.length)];
    S.offers.push({ id, accepted: false });
    log(`${who === 'merchant' ? '상단이' : '교회가'} 제안을 보내옴: ${OFFERS[id].title}`);
  });

  // 장부 사본
  const prev = S.hist[S.hist.length - 1];
  let ledgerM = null, ledgerC = null;
  if (audited) {
    ledgerM = { month: S.month, price: P.m, cost: K0.m, q: qM, rebate, skim: S.leak && S.leak.who === 'merchant' ? leakLost : 0, prevPrice: prev ? prev.pm : P.m, prevCost: prev ? prev.cm : K0.m };
    if (rebate > 0) log(`상단 장부에서 '신전 축복 수수료' ${fmt(rebate)}G 발견`);
  }
  if (full) {
    ledgerC = { month: S.month, price: P.c, cost: K0.c, q: qC, donation: b.donation, rebate, prevPrice: prev ? prev.pc : P.c, prevCost: prev ? prev.cc : K0.c, prevSales: prev ? prev.qC * prev.pc : qC * P.c };
    if (rebate > 0) log(`교회 장부에서 '기부자 미기재' 수입 ${fmt(rebate)}G 발견`);
  }

  S.M = Math.max(0, M - deaths - leave + arrive);
  S.M = Math.max(0, S.M - od);
  // 떠나고 죽은 만큼 직업 구성이 고르게 줄고, 새로 온 용병은 평소 비율대로 온다. 장려금을 보고 온 용병은 그 직업으로 온다
  const kept = Math.max(0, S.M - arrive), tot = S.cls.reduce((a, v) => a + v, 0) || 1;
  S.cls = S.cls.map((v, i) => v * kept / tot + arrive * CLASS_SHARE[i]);
  if (sup.heads) {
    sup.ck.forEach(k => { S.cls[CLASSES.indexOf(k.slice(2))] += sup.heads / sup.ck.length; });
    S.M += sup.heads;
    log(`직업 장려금으로 ${sup.ck.map(k => k.slice(2)).join('·')} ${sup.heads}명이 새로 면허를 받음`);
    notes.push(`장려금 소식을 듣고 ${sup.ck.map(k => k.slice(2)).join('·')} ${sup.heads}명이 면허를 받으러 왔습니다.`);
  }
  // 개척 사업은 이번 달 정산이 끝난 뒤 완공된다 (새 용병과 통행세는 다음 달부터)
  resolveDev(notes);
  S.deathsTotal += deaths + od + hr.dead.length; S.yearDeaths += deaths + od + hr.dead.length;
  S.hist.push({ month: S.month, pm: P.m, pc: P.c, cm: K0.m, cc: K0.c, qC, treasury: S.treasury, M: S.M, deaths, rate });
  S.last = { month: S.month, P, qM, qC, qW, cov, pv, fLeave, deaths, leave, arrive, heads: sup.heads, sup, fees: [...S.fees], need: pr.need, toll: M * tollRate, tollRate, hr, heroLoot, adopt, draw: pr.draw, toStock: pr.toStock, waste: pr.waste, stock: S.stock, lord: S.lordIncome, extra: pr.extra, agc: pr.agc, loot: ex.loot, ex, sM: pr.sM, sC: pr.sC, sW: pr.sW, fee: pr.fee, facCost: pr.facCost, upkeep: pr.upkeep, offers: pr.offers, fixed: pr.fixed, b, net, M };
  S.ledgers = (ledgerM || ledgerC) ? { m: ledgerM, c: ledgerC } : null;
  if (ledgerM) S.ledgerArchive.unshift({ m: ledgerM });
  if (ledgerC) S.ledgerArchive.unshift({ c: ledgerC });
  S.ledgerArchive = S.ledgerArchive.slice(0, 6);

  S.intel = b.intel > 0 ? intelReport(intelQ(b.intel), project(S.budget), nextMonth) : null;
  if (S.treasury < 0) S.neg++; else S.neg = 0;
  S.month = nextMonth;
  S.notes = notes; S.notices = notices;
  monthEvents(notes, notices);
  rollEvents({ notes, deaths, M, ed: (o) => S.eventDocs.push({ month: S.month, ...o }) });
  notices.forEach(n => S.archive.push({ m: S.month, who: n.who, t: `${n.name}: “${n.text}”` }));
  notes.forEach(t => S.archive.push({ m: S.month, who: /상단|조합장/.test(t) && /교회|신전|사제/.test(t) ? 'both' : /상단|조합장/.test(t) ? 'merchant' : /교회|신전|사제|헌금/.test(t) ? 'church' : 'other', t }));
  if ((S.month - 1) % 12 === 0) evaluate();
  if (S.neg >= 3) S.over = 'fired';
  else if (S.M < 40 && !founding()) S.over = 'empty';
  else if (S.warn >= 2) S.over = 'recalled';
  else if (S.month > C.MONTHS) S.over = 'done';
  if (S.rebudget) { staffRebudget(notes, `${S.rebudget}에 맞춰`); S.rebudget = null; }
  if (!S.over && founding() && coreDone()) endFounding();
  if (!S.over) { pickAgenda(); heroApplicants(); }
  // 수입·지출 탭용 장부. 결산에 잡히지 않는 금고 변화(범람 복구비, 평가 보조금, 사건 선택 등)는 기타로 묶는다
  const sp = pr.sup;
  (S.books = S.books || []).push({
    m: nextMonth - 1,
    inc: { toll: M * S.last.tollRate, loot: ex.loot, heroLoot, feeIn: ex.feeIn, lord: S.last.lord, backlog: S.soldBacklog },
    exp: { sM: pr.sM, sC: pr.sC, sW: pr.sW, food: pr.pv.food.spend, repair: pr.pv.repair.spend, haul: pr.pv.haul.spend, support: b.support, trial: pr.trialSpend, rent: sp.rentSpend, priest: sp.priestSpend, recruit: sp.recruitSpend, feeOut: ex.feeOut,
      heroPay: pr.hero.active ? b.heroPay || 0 : 0, heroGear: pr.hero.active ? b.heroGear || 0 : 0, heroPub: pr.hero.active ? b.heroPub || 0 : 0,
      donation: b.donation, donR: b.donR || 0, intel: b.intel || 0, audit: b.audit, guide: pr.fee, fac: pr.facCost, upkeep: pr.upkeep, offers: pr.offers, fixed: pr.fixed, extra: pr.extra, agc: pr.agc, dev: pr.devc },
    misc: S.treasury - t0 - net - S.soldBacklog,
  });
}

export function monthEvents(notes, notices) {
  const ed = (o) => S.eventDocs.push({ month: S.month, ...o });
  if (S.month === 11) notes.push('교회 안에서 젊은 사제들이 대사제의 방식에 반발한다는 소문이 돕니다.');
  if (S.month === 13 && !S.schism) {
    S.schism = { R: 40, start: 13, outcome: null };
    log('교회 종파 분열: 개혁파가 일어남. 헌금이 정통파와 개혁파 두 줄로 나뉨');
    ed({ cls: 'church', kind: '교회 · 개혁파의 서신', title: '교회가 둘로 갈라지고 있습니다', from: '개혁파 수장 리아나 사제', stamp: '분열',
      body: `<div class="notice church"><q>대사제께서는 헌금을 쌓아 두고 신전 이름만 높이십니다. 그사이 미궁에서 죽어 가는 용병들은 기도 한 줄 받지 못합니다. 관리국이 저희를 도와주신다면, 교회는 다시 사람을 위한 곳이 될 것입니다.</q></div>
        <div class="notice church"><div class="who">대사제</div><q>젊은 사제들의 치기에 관리국이 휘말리지 않기를 바랍니다. 교회의 질서는 하루아침에 바뀌지 않습니다.</q></div>
        <p>이제 예산안의 교회 헌금이 <b>정통파 헌금(대사제)</b>과 <b>개혁파 헌금</b> 두 줄로 나뉩니다. 앞으로 1년 동안 어느 쪽에 얼마를 싣는지가 교회의 앞날을 정합니다. 관례 헌금은 두 줄 합계로 따지고, 교회 포션 공급은 아직 대사제가 쥐고 있습니다.</p>
        <p class="from">개혁파에 힘을 실을지, 대사제를 지킬지, 양쪽에 고르게 걸고 줄을 탈지 정해야 합니다. 사망이 많거나 감찰이 잦으면 개혁파에 힘이 붙습니다.</p>` });
  }
  if (S.month === 19 && S.schism && !S.schism.outcome) {
    const R = S.schism.R;
    ed({ cls: 'church', kind: '서기 보고 · 교회 판세', title: R >= 60 ? '개혁파가 기세를 잡았습니다' : R <= 25 ? '대사제가 개혁파를 몰아붙이고 있습니다' : '두 종파가 팽팽하게 맞서고 있습니다', from: '제18월 말',
      body: `<p>${R >= 60 ? '리아나 사제의 설교에 용병과 신도가 몰립니다. 대사제 측은 관리국의 돈이 개혁파로 흘러간다고 공공연히 비난합니다.' : R <= 25 ? '대사제가 개혁파 사제 몇을 변방 교구로 보냈습니다. 리아나 사제는 관리국에 마지막 도움을 청하는 편지를 보냈습니다.' : '어느 쪽도 물러서지 않습니다. 양쪽 모두 관리국이 누구 편인지 주시하고 있습니다.'}</p><p class="from">결론은 제24월 말에 납니다.</p>` });
  }
  if (S.month === 25 && S.schism && !S.schism.outcome) {
    const R = S.schism.R, out = R >= 60 ? 'reform' : R <= 25 ? 'orthodox' : 'compromise';
    S.schism.outcome = out;
    let title, body;
    if (out === 'reform') {
      S.custom = 800; S.churchReform = true; S.cPriceAdj = -10; S.M = Math.max(0, S.M - 8); S.gC = -20; S.deathSens = 1.5; S.budget.donR = 0; S.rel = 0;
      title = '개혁파가 교회를 이끌게 되었습니다';
      body = `<p>대사제가 물러나고 리아나 사제가 새 대사제로 추대되었습니다. 첫 설교에서 그는 교회의 장부를 모두 공개하겠다고 약속했습니다.</p><ul class="feed"><li>관례 헌금이 800G로 내려갑니다</li><li>교회 포션 단가가 10G 내려갑니다</li><li>투명해진 교회는 다시는 상단과 뒷거래를 하지 않습니다</li><li>옛 신앙을 따르던 용병 8명이 떠났습니다</li><li>새 교회는 사망에 더 민감합니다</li></ul>`;
    } else if (out === 'orthodox') {
      S.gC -= 40; S.custom += 500; S.rel = Math.min(80, S.rel + 30); S.cPriceAdj = 5; S.trust += 8; S.budget.donR = 0;
      title = '대사제가 개혁파를 누르고 자리를 지켰습니다';
      body = `<p>개혁파 사제들은 변방 교구로 흩어졌습니다. 대사제는 관리국의 변함없는 지지에 감사하며 미궁 입구에서 용병들을 위한 축복 미사를 열었습니다.</p><ul class="feed"><li>교회가 관리국을 크게 신뢰합니다</li><li>관례 헌금이 500G 오릅니다</li><li>대사제의 축복으로 용병들의 신뢰가 오릅니다</li><li>교회 포션 단가가 5G 오릅니다</li><li>대사제와 상단 조합장이 다시 가까워졌다는 말이 돕니다</li></ul>`;
    } else {
      S.custom = 700; S.customR = 600; S.gC -= 10; S.trust += 5;
      title = '교회는 둘로 나뉜 채 공존하기로 했습니다';
      body = `<p>관리국이 양쪽에 고르게 힘을 실은 덕에 어느 쪽도 이기지 못했습니다. 두 종파는 각자의 예배당을 두고 공존하기로 합의했고, 양쪽 모두 관리국을 중재자로 여깁니다.</p><ul class="feed"><li>헌금란이 두 줄로 계속 남습니다</li><li>정통파 관례 700G, 개혁파 관례 600G를 따로 지켜야 합니다</li><li>중재자라는 평판으로 용병들의 신뢰가 조금 오릅니다</li></ul>`;
    }
    log(`교회 종파 다툼의 결론: ${title}`);
    ed({ cls: 'church', kind: '교회 · 종파 다툼의 결론', title, from: '제24월 말', stamp: '결론', body });
  }
  if (S.overflow && S.overflow.m === S.month - 1) {
    const o = S.overflow;
    ed({ cls: 'secret', kind: '현장 사무소 · 긴급 보고', title: '미궁이 넘쳤습니다', from: `제${o.m}월`, stamp: '범람',
      body: `<p>깊은 층의 몬스터들이 위층으로 쏟아져 나와 1층 야영지를 덮쳤습니다. 다행히 입구에서 막아 냈지만 피해가 큽니다.</p>` + rows([['사망한 용병', `${o.deaths}명`], ['복구비', `${fmt(o.cost)}G`]]) + `<p class="from">교회가 크게 놀랐고, 용병들의 신뢰가 흔들렸습니다. 현장에서는 "꺼낸 만큼 차오른다"는 말이 돌고 있습니다.</p>` });
  }
  if (!S.academy && (S.anoms.length >= 3 || S.floors.filter(f => f.root).length >= 2)) {
    S.academy = S.month;
    const lootSum = S.floors.reduce((a, f) => a + (f.lootTotal || 0), 0);
    const years = Math.max(2, Math.round(9 - S.pressure / 12));
    ed({ cls: 'secret', kind: '왕립 학술원 · 대외비', title: '미궁 수지에 관한 보고서', from: '파견 학자 일동', stamp: '대외비',
      body: rows([['지금까지 미궁에서 꺼낸 전리품', `${fmt(lootSum)}G`], ['기록된 이상 징후', `${S.anoms.length}건`], ['범람', S.overflow ? `1회 · 용병 ${S.overflow.deaths}명 사망` : '아직 없음'], ['찾아낸 근원 (봉인 · 채굴)', `${S.floors.filter(f => f.root).length}곳 (${S.floors.filter((f, i) => done('seal' + i)).length} · ${S.floors.filter((f, i) => done('mine' + i)).length})`]])
        + `<p>꺼낸 양이 늘수록 미궁의 압력이 오르고, 범람의 간격이 짧아지고 있습니다. 이 추세라면 약 <b>${years}년</b> 안에 범람의 피해가 미궁의 수익을 넘어섭니다.</p>
        <p class="from">학자들은 보고서 끝에 한 줄을 지웠다가 다시 적었습니다. "가장 값싼 해법은 봉인이다."</p>` });
  }
}

export function evalItems(T) {
  return [
    { label: '금고', target: `${fmt(T.treasury)}G 이상`, actual: `${fmt(S.treasury)}G`, ok: S.treasury >= T.treasury },
    { label: '개척', target: `${T.floor}층 진입`, actual: `${S.unlocked}층`, ok: S.unlocked >= T.floor },
    { label: '용병', target: `${T.M}명 이상`, actual: `${S.M}명`, ok: S.M >= T.M },
    { label: '올해 사망', target: `${T.deaths}명 이하`, actual: `${S.yearDeaths}명`, ok: S.yearDeaths <= T.deaths },
    { label: '지역 세력', target: '불만이 큰 세력 없음', actual: S.gM >= 45 || S.gC >= 45 ? '불만이 큰 세력 있음' : '없음', ok: S.gM < 45 && S.gC < 45 },
  ];
}

export function evaluate() {
  const year = (S.month - 1) / 12;
  const items = evalItems(TARGETS[year - 1]);
  const score = items.filter(i => i.ok).length;
  const grade = score >= 4 ? '우수' : score >= 2 ? '보통' : '미흡';
  let reward = '';
  // 정치적 이미지: 이름난 관리국에 수도는 너그럽다
  if (grade === '우수') { S.treasury += 8000; S.trust += 5; reward = '수도에서 특별 보조금 8,000G를 보내왔습니다.'; if (S.fame >= 60) { S.treasury += 3000; reward += ' 용사 소식을 들은 수도가 3,000G를 더 얹었습니다.'; } }
  else if (grade === '미흡' && S.fame >= 60 && !S.fameSaved) { S.fameSaved = true; reward = '평가는 미흡이지만, 용사 소식으로 이름이 난 덕에 수도가 이번 한 번은 경고를 거둡니다.'; }
  else if (grade === '미흡') { S.warn++; reward = S.warn >= 2 ? '두 번째 미흡입니다. 수도가 관리국장을 소환합니다.' : '수도에서 경고장이 왔습니다. 다음 평가도 미흡하면 소환됩니다.'; }
  else reward = '수도는 지켜보겠다는 입장입니다.';
  S.evals.push({ year, month: S.month, items, grade, reward });
  log(`${year}년 차 임기 평가: ${grade}`);
  S.yearDeaths = 0;
}
