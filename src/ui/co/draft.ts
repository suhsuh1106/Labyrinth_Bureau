// 가정산: 출정이 끝난 뒤 영주청에 낼 신고서를 꾸미는 화면. 신고서는 장부의 참값이 기본이고, 칸을 고치면 이득과 쌓일 의심이 바로 보인다.
// HTML 문자열만 만든다 (상태를 쓰지 않고 난수도 쓰지 않는다)
import { FILE_KEYS, FILE_SRC, FLOORS, ITEMS, type FileKey, type Filing, TAX, type World, preview, profitOf, us } from '../../core/company';
import { ROW, lawsHtml } from './books';
import { fmt, sgn, stepper } from './view';
import { returnsHtml } from './reveal';

// 의심 정도의 말 (영주청 회계관의 돌려 말하기)
const suspSay = (s: number) => s < TAX.SUS_FREE * 0.5 ? '영주청은 우리 장부에 관심이 없어요.'
  : s < TAX.SUS_FREE ? '회계관이 우리 장부를 "깔끔하다"고 했다는 말이 들려요.'
  : s < TAX.SUS_FREE + TAX.SUS_SPAN * 0.25 ? '회계관이 우리 신고서를 한 번 더 넘겨 봤다고 해요.'
  : s < TAX.SUS_FREE + TAX.SUS_SPAN * 0.5 ? '회계관이 "요즘 회색늑대는 운이 좋더군요"라고 했대요.'
  : '회계관이 상단 경매장 장부를 빌려 갔다는 말이 있어요.';

// 가정산 화면: 귀환 요약, 판매 · 손익, 신고서(참값 · 신고 · 고지서 · 이득 · 맞대 볼 기록), 회계관 소문 한 줄, 법령, 제출 단추.
// 의심과 감사 확률은 숫자로 보이지 않는다 (감사는 뒤통수로 온다)
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
  const pay = (B: typeof honest) => B.sub + B.aid - B.tax - B.refund, op = profitOf(r), netH = op + pay(honest), netF = op + pay(X.bill);
  const ok = r.ok.reduce((a, b) => a + b, 0), sent = r.sent.reduce((a, b) => a + b, 0) + r.hired.reduce((a, b) => a + b, 0);
  return `<div class="draftwrap">${returnsHtml(W, live)}<article class="co-sheet doc" id="draft">
    <div class="kind">제${D.m}월 가정산</div>
    ${salesHtml(W)}
    ${plHtml(W, netF, X.bill)}
    <section class="rp"><h3>신고서</h3><div class="tw"><table class="grid filing"><thead><tr><th>항목</th><th class="n">장부</th><th class="n">신고</th><th class="n">세금 · 지원</th><th class="n">이득</th><th>맞대 볼 기록</th></tr></thead><tbody>${rows}
      ${X.bill.credit ? `<tr><td><b>교회 후원금 공제</b><small>후원금 ${fmt(D.donate)}G의 ${Math.round(TAX.DONATE_CREDIT * 100)}%</small></td><td></td><td></td><td class="n">공제 ${fmt(X.bill.credit)}</td><td></td><td class="dim">합법</td></tr>` : ''}
      </tbody></table></div>
      <div class="billsum">
        <div><small>순이익 (세금 전)</small><b class="${op < 0 ? 'neg' : 'pos'}">${sgn(op)}G</b><i>판매 − 비용${r.capex ? ' · 공사비는 자산' : ''}</i></div>
        <div><small>순이익 (장부 그대로)</small><b class="${netH < 0 ? 'neg' : 'pos'}">${sgn(netH)}G</b><i>세금 ${fmt(honest.tax)} · 지원 ${fmt(honest.sub + honest.aid)}${honest.refund ? ` · 반납 ${fmt(honest.refund)}` : ''}</i></div>
        <div class="me"><small>순이익 (이 신고서)</small><b class="${netF < 0 ? 'neg' : 'pos'}">${sgn(netF)}G</b><i>${X.total ? `장부 그대로보다 <b class="pos">+${fmt(X.total)}</b> · 걸리면 ×${1 + TAX.AUDIT_PEN} 추징` : '장부 그대로'}</i></div>
      </div>
      <p class="note rumor">${X.watched || (c.watch || 0) >= D.m ? '스캔들 뒤로 회계관이 우리 장부를 지켜본다는 말이 있어요.' : suspSay(c.sus || 0)}</p></section>
    <section class="rp"><h3>법령</h3>${lawsHtml(W, D.m)}</section>
  </article>
  <div class="foot"><button type="button" class="ghost" data-act="file-reset">장부 그대로 다시</button><span class="tot">순이익 <b class="${netF < 0 ? 'neg' : 'pos'}">${sgn(netF)}G</b>${X.total ? ` <span class="dim">(장부 그대로보다 +${fmt(X.total)})</span>` : ''}</span><button type="button" class="seal" data-act="file">신고서 내기</button></div></div>`;
}

// 판매 내역: 품목마다 개수 · 판매액 · 세율 · 장부대로 낼 세금. 전리품은 처음부터 시장에 등록된 물품이라 영주세, 갈무리 소재는 시장에 등록된 것만(법령), 의뢰 · 선금 · 지도 판매는 비과세
function salesHtml(W: World) {
  const D = W.draft!, L = W.last!, r = L.res[D.i], lootR = D.lootRate * (1 - (D.relief || 0));
  const lootV = ITEMS.map((_, j) => (r.sold[j] ? Math.round(r.sold[j] * L.price[j]) : 0)), lootSum = lootV.reduce((a, b) => a + b, 0);
  const scale = lootSum ? (r.lootSales || 0) / lootSum : 1;   // 상단 단골 값(±5%)을 얹은 실제 판매액에 맞춘다
  const rows: string[] = [];
  ITEMS.forEach((it, j) => { if (!r.sold[j]) return; const v = Math.round(lootV[j] * scale); rows.push(`<tr><td>${it.name}</td><td class="n">${fmt(r.sold[j])}개</td><td class="n">${fmt(v)}</td><td class="n">${Math.round(lootR * 100)}%</td><td class="n">${fmt(v * lootR)}</td></tr>`); });
  const mats = Object.entries(r.matSold).filter(([, n]) => n > 0), taxed = mats.filter(([m]) => D.matTaxed.includes(m)), free = mats.filter(([m]) => !D.matTaxed.includes(m));
  taxed.forEach(([m, n]) => { const v = n * (L.matPrice[m] || 0); rows.push(`<tr><td>${m}</td><td class="n">${fmt(n)}개</td><td class="n">${fmt(v)}</td><td class="n">${Math.round(D.matRate * 100)}%</td><td class="n">${fmt(v * D.matRate)}</td></tr>`); });
  if (free.length) { const n = free.reduce((a, [, k]) => a + k, 0), v = free.reduce((a, [m, k]) => a + k * (L.matPrice[m] || 0), 0); rows.push(`<tr><td>갈무리 소재<small>${free.slice(0, 4).map(([m]) => m).join(' · ')}${free.length > 4 ? ' …' : ''}</small></td><td class="n">${fmt(n)}개</td><td class="n">${fmt(v)}</td><td class="n dim">미등록</td><td class="n dim">0</td></tr>`); }
  const other = (r.jobPay || 0) + (r.adv || 0) + (r.mapSale || 0);
  if (other) rows.push(`<tr><td>의뢰 · 선금 · 지도 판매</td><td></td><td class="n">${fmt(other)}</td><td class="n dim">비과세</td><td class="n dim">0</td></tr>`);
  return `<section class="rp"><h3>판매</h3><div class="tw"><table class="grid slim sales"><thead><tr><th>품목</th><th class="n">개수</th><th class="n">판매액</th><th class="n">세율</th><th class="n">세금</th></tr></thead><tbody>${rows.join('')}
    <tr class="tot"><td>합계</td><td></td><td class="n">${fmt(r.sales)}</td><td></td><td class="n">${fmt(Math.round((r.lootSales || 0) * lootR) + taxed.reduce((a, [m, n]) => a + n * (L.matPrice[m] || 0) * D.matRate, 0))}</td></tr></tbody></table></div></section>`;
}

// 손익: 판매 − 지출 = 순이익(세금 전), 그리고 이 신고서대로의 세금 · 지원 → 순이익
function plHtml(W: World, netF: number, B: ReturnType<typeof preview>['bill']) {
  const L = W.last!, r = L.res[W.draft!.i], s = r.spend;
  const loot = r.lootSales || 0, other = r.sales - loot - r.matSales;
  const cost: [string, number][] = [['급여', s.wage + (s.fire || 0)], ['신입 계약금', s.recruit], ['치료비', s.heal || 0], ['계약 조', s.sortie + s.hire + s.tool], ['포션', s.potion], ['횃불', s.torch || 0], ['식량 · 정비 도구', (s.food || 0) + (s.mend || 0)], ['장비', s.gear],
    ['정보 · 조사', s.intel + s.probe], ['교관', s.train], ['숙소 · 본부 유지비', (s.dorm || 0) + (s.hq || 0) - (r.capex || 0) + s.base + s.proc], ['건물 감가상각', r.dep || 0], ['교회 후원 · 근원 기금', s.donate + s.root], ['의뢰 위약금', s.job || 0]];
  const row = (t: string, v: number, cls = '') => `<tr class="${cls}"><td>${t}</td><td class="n ${v < 0 ? 'neg' : ''}">${sgn(Math.round(v))}</td></tr>`;
  return `<section class="rp"><h3>손익</h3><div class="tw"><table class="grid slim pl"><tbody>
    ${row('전리품 판매', loot)}${r.matSales ? row('갈무리 소재 판매', r.matSales) : ''}${other ? row('의뢰 · 선금 · 지도 판매', other) : ''}
    ${row('판매 합계', r.sales, 'sub')}
    ${cost.filter(([, v]) => v > 0).map(([t, v]) => row(t, -v)).join('')}
    ${row('순이익 (세금 전)', profitOf(r), 'sub')}
    ${B.tax ? row('영주세 (이 신고서)', -B.tax) : ''}${B.sub + B.aid ? row('보급 · 층 지원금', B.sub + B.aid) : ''}${B.refund ? row('선금 반납', -B.refund) : ''}
    ${row('순이익', netF, 'tot')}
    ${r.capex || r.dep ? row(`금고 변화 <small class="dim">순이익${r.capex ? ` − 공사비 ${fmt(r.capex)} (건물 자산)` : ''}${r.dep ? ` + 감가상각 ${fmt(r.dep)}` : ''}</small>`, netF - (r.capex || 0) + (r.dep || 0)) : ''}
  </tbody></table></div></section>`;
}
