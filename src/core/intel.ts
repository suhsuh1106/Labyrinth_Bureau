// 시장 조사 보고
import { has } from './agendas';
import { cartelScore } from './economy';
import { rnd } from './rng';
import { S } from './state';
import { clamp } from './util';

export function intelReport(q, pr, month) {
  const noisy = i => rnd() < q ? i : clamp(i + (rnd() < 0.5 ? -1 : 1), 0, 2);
  const crop = noisy(S.shock > 1 ? 2 : S.shockIn > 0 ? 1 : 0);
  let risk = null; const reasons = [];
  if (!S.cartel) {
    const p = S.cooldown > 0 || S.churchReform ? 0 : clamp(0.08 * cartelScore(pr), 0, 0.5);
    risk = noisy(p < 0.06 ? 0 : p < 0.14 ? 1 : 2);
    if (q >= 0.5) {
      if (1 - clamp((pr.qW + 0.5 * S.stock) / Math.max(1, pr.need), 0, 1) > 0.8) reasons.push('관리국이 상단·교회 포션에 거의 전부 기대고 있음 (공방이나 비축이 없음)');
      if (S.noAudit >= 3) reasons.push('감찰의 눈이 몇 달째 느슨함');
      if (S.treasury > 20000) reasons.push('관리국 금고가 넉넉해서 값을 올려도 낼 거라 여김');
      if (S.gM + S.gC > 20) reasons.push('두 세력 모두 관리국에 서운한 게 쌓여 있음');
      if (S.rel > 55) reasons.push('상단 조합장과 교회 회계 사제가 자주 만남');
      if (S.shock > 0 || S.shockIn > 0) reasons.push('흉작이 값을 올릴 핑계가 됨');
      if (has('merchant_grudge') || has('paid_merchant')) reasons.push('상단이 지난 일로 관리국을 만만하게, 혹은 괘씸하게 여김');
    }
  }
  const leak = S.leak && rnd() < q ? (S.leak.who === 'merchant' ? '상단 감정소의 매입가와 수도 시세가 맞지 않습니다' : '밤에 미궁을 드나드는 파티가 있고, 암시장 보석 시세가 내려갔습니다') : null;
  return { month, q, crop, risk, reasons, leak };
}
