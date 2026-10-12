// 영주청: 법령 게시와 정산서의 신고 줄. 가정산 화면은 draft.ts. HTML 문자열만 만든다 (상태를 쓰지 않고 난수도 쓰지 않는다)
import { FILE_KEYS, FILE_SRC, FLOORS, type FileKey, type Law, TAX, type World, auditChance, lawsAt, us } from '../../core/company';

const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
// 신고서 칸: 이름, 단위, 고칠 때 한 번에 움직이는 양, 그 칸이 무엇을 바꾸는지
export const ROW: Record<FileKey, { n: string; u: string; step: number; dir: string }> = {
  loot: { n: '전리품 판매액', u: 'G', step: 100, dir: '덜 적으면 세금이 준다' },
  mat: { n: '과세 소재 판매액', u: 'G', step: 50, dir: '덜 적으면 세금이 준다' },
  pot: { n: '위기에 쓴 포션', u: '병', step: 1, dir: '더 적으면 지원금이 는다' },
  torch: { n: '들고 간 횃불', u: '개', step: 2, dir: '더 적으면 지원금이 는다' },
  aid: { n: '지원금 층에 보낸 조', u: '조', step: 1, dir: '더 적으면 지원금이 는다' },
  adv: { n: '계획서 층에 보낸 조', u: '조', step: 1, dir: '더 적으면 돌려낼 선금이 준다' },
};

const LAW_NAME: Record<Law['kind'], string> = { mat: '소재 과세', aid: '층 지원금', sub: '보급 지원금', loot: '전리품 세율' };
export function lawLine(L: Law) {
  if (L.kind === 'mat') return `${L.m} 판매에 ${Math.round((L.rate || 0) * 100)}% 세금`;
  if (L.kind === 'aid') return `${FLOORS[L.f!].name}에 들어가는 조마다 ${fmt(L.amt || 0)}G`;
  if (L.kind === 'sub') return L.rate ? `포션 · 횃불 지원금 ${Math.round((L.rate || 0) * 100)}%로 줄임` : '포션 · 횃불 지원금 끊음';
  return `전리품 세율 +${Math.round((L.rate || 0) * 100)}%p (범람 복구)`;
}
const until = (L: Law) => (L.until >= 999 ? '계속' : `제${L.until}월까지`);
// 법령 게시: 지금 효력이 있는 것과 다음 달부터의 것. 지금의 기본 세율과 지원금 단가도 함께
export function lawsHtml(W: World, m = W.month) {
  const now = lawsAt(W, m), next = (W.laws || []).filter(L => L.from > m);
  const rate = TAX.LOOT + now.filter(L => L.kind === 'loot').reduce((a, L) => a + (L.rate || 0), 0), mul = now.filter(L => L.kind === 'sub').reduce((a, L) => Math.min(a, L.rate ?? 1), 1);
  const row = (L: Law, soon: boolean) => `<li class="law ${L.kind}"><span class="lk">${LAW_NAME[L.kind]}</span><span>${lawLine(L)}</span><span class="dim">${soon ? `제${L.from}월부터 · ` : ''}${until(L)}</span></li>`;
  return `<div class="laws"><p class="note">영주세: 전리품 판매의 <b>${Math.round(rate * 100)}%</b> · 갈무리 소재는 법령이 붙은 것만 · 보급 지원금 포션 한 병 <b>${fmt(TAX.SUB_POT * mul)}G</b> · 횃불 하나 <b>${fmt(TAX.SUB_TORCH * mul)}G</b> · 교회 후원금의 ${Math.round(TAX.DONATE_CREDIT * 100)}%는 세금에서 빼 줘요.
    붉은 깃발단 · 성흔 기사단 · 철모회는 영주 계약 · 교회 기부 · 거점 공제로 전리품 세금을 합법으로 덜 내요. 우리에겐 그런 연줄이 없어요.</p>
    ${now.length || next.length ? `<ul class="lawlist">${next.map(L => row(L, true)).join('')}${now.map(L => row(L, false)).join('')}</ul>` : '<p class="note">지금 붙은 법령이 없어요. 영주청은 넉 달마다 장부를 살펴 법령을 고시해요.</p>'}</div>`;
}

// 정산서의 신고 줄: 낸 신고와 고지서, 감사 결과 (기록을 읽어 보여 주기만 한다)
export function fileResultHtml(W: World) {
  const L = W.last; if (!L) return '';
  const r = L.res[0], X = r.file; if (!X) return '';
  const T = X.truth, F = X.filed, B = X.bill, A = X.audit;
  const diff = FILE_KEYS.filter(k => T[k] !== F[k]).map(k => `${ROW[k].n} ${fmt(T[k])} → ${fmt(F[k])}${ROW[k].u}`);
  return `<section class="rp"><h3>영주청</h3>
    ${A ? `<div class="audit ${A.fine ? 'hit' : ''}"><b>${A.fine ? `감사 · 추징금 ${fmt(A.fine)}G` : '감사 · 별일 없음'}</b><span>${A.fine ? `${A.hit.map(k => FILE_SRC[k]).filter((x, j, a) => a.indexOf(x) === j).join(' · ')}와 맞대 보니 지난 신고에서 ${fmt(A.found)}G가 맞지 않았어요. 의심과 묵은 장부는 지워졌어요.` : '회계관이 장부를 살피고 돌아갔어요. 의심과 묵은 장부는 지워졌어요.'}</span></div>` : ''}
    <div class="tw"><table class="grid slim"><tbody>
      <tr><td>영주세 (전리품${B.matTax ? ' · 소재' : ''}${B.credit ? ' · 후원 공제 뒤' : ''})</td><td class="n">−${fmt(B.tax)}</td></tr>
      ${B.sub ? `<tr><td>보급 지원금 (포션 ${fmt(F.pot)}병 · 횃불 ${fmt(F.torch)}개)</td><td class="n">+${fmt(B.sub)}</td></tr>` : ''}
      ${B.aid ? `<tr><td>층 지원금 (${fmt(F.aid)}조)</td><td class="n">+${fmt(B.aid)}</td></tr>` : ''}
      ${r.adv ? `<tr><td>탐사 선금</td><td class="n">+${fmt(r.adv)}</td></tr>` : ''}
      ${B.refund ? `<tr><td class="neg">선금 반납 (덜 보낸 조)</td><td class="n">−${fmt(B.refund)}</td></tr>` : ''}
      ${r.spend.fine ? `<tr><td class="neg">추징금</td><td class="n">−${fmt(r.spend.fine)}</td></tr>` : ''}
    </tbody></table></div>
    <p class="note">${diff.length ? `신고서에서 고친 칸: ${diff.join(' · ')} · 그로 얻은 돈 +${fmt(X.gain)}G.` : '장부 그대로 냈어요.'} 지금 의심 ${Math.round(us(W).sus || 0)} · 다음 신고 전 감사 확률 ${Math.round(auditChance((us(W).sus || 0) * TAX.SUS_FADE) * 100)}%.</p></section>`;
}
