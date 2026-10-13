// 가정산: 출정이 끝난 뒤 영주청에 낼 신고서를 꾸미는 화면. 신고서는 장부의 참값이 기본이고, 칸을 고치면 이득과 쌓일 의심이 바로 보인다.
// HTML 문자열만 만든다 (상태를 쓰지 않고 난수도 쓰지 않는다)
import { FILE_KEYS, FILE_SRC, FLOORS, type FileKey, type Filing, TAX, type World, auditChance, preview, us } from '../../core/company';
import { ROW, lawsHtml } from './books';
import { fmt, sgn, stepper } from './view';
import { returnsHtml } from './reveal';

// 의심 정도의 말 (영주청 회계관의 돌려 말하기)
const suspSay = (s: number) => s < TAX.SUS_FREE * 0.5 ? '영주청은 우리 장부에 관심이 없어요.'
  : s < TAX.SUS_FREE ? '회계관이 우리 장부를 "깔끔하다"고 했다는 말이 들려요.'
  : s < TAX.SUS_FREE + TAX.SUS_SPAN * 0.25 ? '회계관이 우리 신고서를 한 번 더 넘겨 봤다고 해요.'
  : s < TAX.SUS_FREE + TAX.SUS_SPAN * 0.5 ? '회계관이 "요즘 회색늑대는 운이 좋더군요"라고 했대요.'
  : '회계관이 상단 경매장 장부를 빌려 갔다는 말이 있어요.';

// 가정산 화면: 귀환 요약, 신고서(참값 · 신고 · 고지서 · 이득 · 맞대 볼 기록), 의심과 감사 확률, 법령, 제출 단추
export function draftHtml(W: World, F0: Partial<Filing>, live = false) {
  const D = W.draft, L = W.last; if (!D || !L) return '<p class="note">낼 신고서가 없어요.</p>';
  const c = us(W), r = L.res[D.i], X = preview(W, D, F0), T = D.truth, honest = X.honest;
  const show = (k: FileKey) => k === 'loot' || (k === 'mat' && D.matTaxed.length > 0) || (k === 'pot' && D.subPot > 0) || (k === 'torch' && D.subTorch > 0) || (k === 'aid' && D.aidF >= 0) || (k === 'adv' && D.advN > 0);
  const effect = (k: FileKey) => {
    const B = X.bill;
    if (k === 'loot') return `세금 ${fmt(B.lootTax)}`;
    if (k === 'mat') return `세금 ${fmt(B.matTax)}`;
    if (k === 'pot') return `지원 +${fmt(X.F.pot * D.subPot)}`;
    if (k === 'torch') return `지원 +${fmt(X.F.torch * D.subTorch)}`;
    if (k === 'aid') return `지원 +${fmt(B.aid)}`;
    return B.refund ? `반납 ${fmt(B.refund)}` : '반납 없음';
  };
  const note = (k: FileKey) => k === 'mat' ? D.matTaxed.join(' · ') : k === 'aid' ? `${FLOORS[D.aidF].name} · 조당 ${fmt(D.aidAmt)}G` : k === 'adv' ? `${FLOORS[D.advF].name} · 선금 ${D.advN}조 × ${fmt(D.advPer)}G 받음` : k === 'loot' ? `세율 ${Math.round(D.lootRate * 100)}%` : k === 'pot' ? `병당 ${fmt(D.subPot)}G` : `개당 ${fmt(D.subTorch)}G`;
  const rows = FILE_KEYS.filter(show).map(k => {
    const i = FILE_KEYS.indexOf(k), R = ROW[k], g = X.gain[k], off = X.F[k] !== T[k];
    return `<tr class="${off ? 'off' : ''}"><td><b>${R.n}</b><small>${note(k)}</small></td><td class="n">${fmt(T[k])}${R.u}</td>
      <td class="n">${stepper('file', i, X.F[k], `${R.n} 신고`, R.step)}</td><td class="n">${effect(k)}</td>
      <td class="n ${g ? 'pos' : 'dim'}">${g ? '+' + fmt(g) : '-'}</td><td class="rec${off ? ' hot' : ' dim'}">${off ? FILE_SRC[k] : R.dir}</td></tr>`;
  }).join('');
  const pay = (B: typeof honest) => B.sub + B.aid - B.tax - B.refund, netH = r.net + pay(honest), netF = r.net + pay(X.bill);
  const now = auditChance(c.sus || 0), sev = X.chance >= 0.2 ? 'bad' : X.chance >= 0.05 ? 'mid' : 'ok';
  const back = (c.books || []).filter(b => b.m > D.m - TAX.AUDIT_BACK), owed = back.reduce((a, b) => a + Object.values(b.gain).reduce((x, y) => x + (y || 0), 0), 0);
  const ok = r.ok.reduce((a, b) => a + b, 0), sent = r.sent.reduce((a, b) => a + b, 0) + r.hired.reduce((a, b) => a + b, 0);
  return `<div class="draftwrap">${returnsHtml(W, live)}<article class="co-sheet doc" id="draft">
    <div class="kind">제${D.m}월 가정산</div>
    <p class="lead">판매 <b>${fmt(r.sales)}G</b>${r.adv ? ` (선금 ${fmt(r.adv)} 포함)` : ''} · 신고서 기본값 = 장부</p>
    <section class="rp"><h3>신고서</h3><div class="tw"><table class="grid filing"><thead><tr><th>항목</th><th class="n">장부</th><th class="n">신고</th><th class="n">세금 · 지원</th><th class="n">이득</th><th>맞대 볼 기록</th></tr></thead><tbody>${rows}
      ${X.bill.credit ? `<tr><td><b>교회 후원금 공제</b><small>후원금 ${fmt(D.donate)}G의 ${Math.round(TAX.DONATE_CREDIT * 100)}%</small></td><td></td><td></td><td class="n">공제 ${fmt(X.bill.credit)}</td><td></td><td class="dim">합법</td></tr>` : ''}
      </tbody></table></div>
      <div class="billsum">
        <div><small>순이익 (세금 전)</small><b class="${r.net < 0 ? 'neg' : 'pos'}">${sgn(r.net)}G</b><i>판매 − 지출</i></div>
        <div><small>순이익 (장부 그대로)</small><b class="${netH < 0 ? 'neg' : 'pos'}">${sgn(netH)}G</b><i>세금 ${fmt(honest.tax)} · 지원 ${fmt(honest.sub + honest.aid)}${honest.refund ? ` · 반납 ${fmt(honest.refund)}` : ''}</i></div>
        <div class="me"><small>순이익 (이 신고서)</small><b class="${netF < 0 ? 'neg' : 'pos'}">${sgn(netF)}G</b><i>${X.total ? `장부 그대로보다 <b class="pos">+${fmt(X.total)}</b> · 걸리면 ×${1 + TAX.AUDIT_PEN} 추징` : '장부 그대로'}</i></div>
      </div></section>
    <section class="rp"><h3>영주청의 눈</h3>
      <div class="susp ${sev}"><div class="meter" role="img" aria-label="의심 ${Math.round(X.sus)}, 이번 달 감사 확률 ${Math.round(X.chance * 100)}%"><span class="done" style="width:${Math.min(100, Math.round(X.sus / (TAX.SUS_FREE + TAX.SUS_SPAN) * 100))}%"></span><span class="free" style="left:${Math.round(TAX.SUS_FREE / (TAX.SUS_FREE + TAX.SUS_SPAN) * 100)}%"></span></div>
        <p>의심 <b>${Math.round(c.sus || 0)}</b> → <b>${Math.round(X.sus)}</b> · 이번 달 감사 확률 <b>${Math.round(X.chance * 100)}%</b>${now !== X.chance ? ` <span class="dim">(장부 그대로면 ${Math.round(preview(W, D, {}).chance * 100)}%)</span>` : ''}. ${X.watched ? ` <b class="neg">스캔들 뒤로 감시가 붙어 있어 감사 확률이 ${Math.round(TAX.WATCH * 100)}% 밑으로 내려가지 않아요 (제${c.watch}월까지).</b>` : suspSay(X.sus)}</p></div>
      <p class="note">의심: 신고서 이득만큼 쌓임 · 달마다 −${Math.round((1 - TAX.SUS_FADE) * 100)}% · 출입 기록 칸 ×2<br>감사: 지난 ${TAX.AUDIT_BACK}달 대조 · 걸린 이득 ×${1 + TAX.AUDIT_PEN} 추징 · 끝나면 의심 초기화${owed ? ` · 지금 걸릴 수 있는 이득 <b>${fmt(owed)}G</b>` : ''}${c.audits ? ` · 감사 ${c.audits}번` : ''}</p></section>
    <section class="rp"><h3>법령</h3>${lawsHtml(W, D.m)}</section>
  </article>
  <div class="foot"><button type="button" class="ghost" data-act="file-reset">장부 그대로 다시</button><span class="tot">순이익 <b class="${netF < 0 ? 'neg' : 'pos'}">${sgn(netF)}G</b>${X.total ? ` <span class="dim">(장부 그대로보다 +${fmt(X.total)} · 감사 확률 ${Math.round(X.chance * 100)}%)</span>` : ''}</span><button type="button" class="seal" data-act="file">신고서 내기</button></div></div>`;
}

