// 메인 사건: 용병 조합 · 전리품 누수 · 이웃 영주
import { endLeak, endLord, has } from './agendas';
import { founding } from './founding';
import { rnd } from './rng';
import { S, log } from './state';
import { done } from './world';

export function rollEvents(ctx) {
  const { notes, ed, deaths, M } = ctx;
  Object.keys(S.evCool).forEach(k => { if (S.evCool[k] > 0) S.evCool[k]--; });
  // 용병 조합: 용병을 함부로 다뤘던 기록이 쌓일수록 잘 생긴다
  if (!S.union && !S.evCool.union && S.month >= 7 && !founding() && M >= 90) {
    const recent = S.hist.slice(-3).reduce((a, h) => a + h.deaths, 0) + deaths;
    let sc = (recent / Math.max(1, M) * 100 > 9 ? 1 : 0) + (S.trust < 45 ? 1 : 0)
      + (has('cold') ? 1 : 0) + (has('checkpoint') ? 1 : 0) + (has('fee_gouge') ? 1 : 0) + (has('union_broken') ? 1 : 0) - (has('compensated') ? 1 : 0) - (has('union_ok') ? 1.5 : 0);
    if (sc > 0 && rnd() < 0.04 * sc) {
      S.union = { m: S.month, refused: 0 };
      log('용병 조합 결성: 신규 면허 보이콧 시작');
      ed({ kind: '현장 사무소 · 긴급 보고', title: '용병들이 조합을 만들었습니다', from: `제${S.month}월`, stamp: '보이콧',
        body: `<p>노련한 용병 "철망치" 브란을 중심으로 용병 조합이 결성되었습니다. 조합은 요구가 받아들여질 때까지 새 면허를 받지 말자고 다른 지역 용병들에게 편지를 돌렸습니다.</p><p class="from">조합이 버티는 동안 새로 오는 용병이 없고, 떠나는 사람이 늘어납니다. 요구서는 안건으로 올라옵니다.</p>` });
    }
  }
  // 전리품 누수: 누가 빼돌리는지는 숨겨져 있고, 단서로 추리한다
  if (!S.leak && !S.evCool.leak && S.month >= 5 && !founding() && rnd() < (done('consign') ? 0.09 : 0.05)) {
    const merchantCan = !done('appraise') && (has('market_merchant') || done('consign'));
    const pM = !merchantCan ? 0 : done('consign') ? 0.75 : S.trust < 45 ? 0.3 : 0.5;
    S.leak = { who: rnd() < pM ? 'merchant' : 'mercs', m: S.month, start: S.month, lost: 0 };
    log(`전리품 누수 시작 (원인: ${S.leak.who === 'merchant' ? '상단 감정 차익' : '용병 밀반출'})`);
  }
  if (S.leak && rnd() < 0.5) {
    const real = rnd() < 0.7, who = real ? S.leak.who : (S.leak.who === 'merchant' ? 'mercs' : 'merchant');
    notes.push(who === 'merchant'
      ? ['상단 감정소에서 값을 너무 짜게 쳐 준다는 용병들의 볼멘소리가 들립니다.', '상단 창고가 요즘 부쩍 꽉 찼다고 합니다. 들어온 물건에 비해 장부가 얇다는 말도 있습니다.'][Math.floor(rnd() * 2)]
      : ['변두리 술집에서 미궁 보석이 시세보다 싸게 돈다고 합니다.', '파티가 돌아오는 시간이 밤으로 몰린다는 현장 사무소의 보고가 있습니다.'][Math.floor(rnd() * 2)]);
  }
  if (S.leak && S.leak.who === 'merchant' && done('appraise')) endLeak(notes, '감정소 직영');
  else if (S.leak && S.month - S.leak.start >= 9) endLeak(notes, '저절로 잦아듦');
  // 이웃 영주: 관리국이 잘될수록 눈독을 들인다
  if (!S.lord && !S.evCool.lord && S.month >= 10 && (S.treasury > 30000 || M >= 130) && rnd() < 0.07) {
    S.lord = { m: S.month, taken: 0, until: null, next: S.month };
    log('하르덴 백작이 미궁 용병을 영지 경비대로 끌어가기 시작함');
    ed({ kind: '서기 보고 · 이웃 영지', title: '하르덴 백작이 용병을 데려가고 있습니다', from: `제${S.month}월`, stamp: '영주',
      body: '<p>동쪽 백작령에서 미궁 용병에게 경비대 자리를 제안하고 있습니다. 보수는 적지만 죽을 일이 없다는 말에 용병들이 흔들립니다.</p><p class="from">백작이 노리는 것은 용병만이 아닐 겁니다. 미궁이 돈이 된다는 소문이 변경에 퍼졌습니다.</p>' });
  }
  if (S.lord && !S.lord.until && S.month - S.lord.m >= 7) { endLord('백작령 경비대가 다 참'); notes.push('하르덴 백작령 경비대가 다 찼는지, 백작령으로 떠나는 용병이 끊겼습니다.'); }
  if (S.lord && S.lord.until && S.month >= S.lord.until) { endLord('수도의 견제'); notes.push('수도가 하르덴 백작에게 경고장을 보냈다고 합니다. 백작령으로 떠나는 용병이 끊겼습니다.'); }
}
