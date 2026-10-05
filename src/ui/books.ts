// 수입·지출 탭과 장부 합계
import { doc, rows } from '../core/html';
import { S } from '../core/state';
import { fmt, pct, sgn } from '../core/util';
import { BUDGET_GROUPS } from './budget';

// 장부 항목은 예산안 묶음(BUDGET_GROUPS)을 따라 분류한다. 결산에 새 항목을 넣으면 여기에도 줄을 더할 것
export const BOOK_INC = [
  { k: 'toll', name: '통행세', color: 'var(--c1)' },
  { k: 'loot', name: '전리품 거래', color: 'var(--c2)' },
  { k: 'heroLoot', name: '용사 파티 전리품', color: 'var(--c6)' },
  { k: 'feeIn', name: '층별 입장료', color: 'var(--c3)' },
  { k: 'lord', name: '하르덴 백작의 사례금', color: 'var(--c4)' },
  { k: 'backlog', name: '쌓아 둔 전리품 일괄 판매', color: 'var(--c5)' },
  { k: 'misc', name: '사건·기타', color: 'var(--c7)' },
];

export const BOOK_EXP = {
  potion: [['sM', '상단 포션'], ['sC', '교회 포션'], ['sW', '공방 포션·건설'], ['food', '식량'], ['repair', '장비 정비'], ['haul', '운송']],
  explore: [['support', '공략 지원금'], ['trial', '시험 탐사'], ['rent', '장비 대여'], ['priest', '사제 파견'], ['recruit', '직업 장려금']],
  hero: [['heroPay', '용사 후원금'], ['heroGear', '용사 장비 지원'], ['heroPub', '용사 홍보비']],
  fees: [['feeOut', '층별 입장 보조금']],
  church: [['donation', '교회 헌금'], ['donR', '개혁파 헌금']],
  watch: [['intel', '시장 조사비'], ['audit', '감찰비']],
  fixed: [['fixed', '관리국 운영비'], ['guide', '공략본 발간비'], ['fac', '개척 시설 착공'], ['upkeep', '시설 유지비'], ['offers', '세력 제안 수락'], ['extra', '약속한 정기 지출'], ['agc', '안건 처리비']],
  other: [['misc', '사건·기타 (범람 복구비 등)']],
  dev: [['dev', '개척 사업 착수']],
};

// 차트 색은 일곱 개뿐이라 예산 묶음에 차례로 주고, 사건·기타와 개척기에만 쓰는 개척 사업은 무채색으로 둔다
export const EXP_GROUPS = BUDGET_GROUPS.filter(g => g.id !== 'dev').map((g, i) => ({ id: g.id, name: g.name, color: `var(--c${i + 1})` }))
  .concat({ id: 'other', name: '사건·기타', color: 'var(--ink-soft)' }, { id: 'dev', name: '개척 사업', color: 'var(--ink)' });

// 한 달 또는 여러 달을 합친 장부. 기타는 달마다 부호를 보고 수입이나 지출로 나눈다
export function bookSum(list) {
  const inc: any = {}, exp: any = {};
  list.forEach(r => {
    (Object.entries(r.inc) as [string, any][]).forEach(([k, v]) => { inc[k] = (inc[k] || 0) + (v || 0); });
    (Object.entries(r.exp) as [string, any][]).forEach(([k, v]) => { exp[k] = (exp[k] || 0) + (v || 0); });
    if (r.misc > 0) inc.misc = (inc.misc || 0) + r.misc;
    if (r.misc < 0) exp.misc = (exp.misc || 0) - r.misc;
  });
  const grp = {};
  EXP_GROUPS.forEach(g => { grp[g.id] = (BOOK_EXP[g.id] || []).reduce((a, [k]) => a + (exp[k] || 0), 0); });
  const tIn = (Object.values(inc) as any[]).reduce((a, v) => a + v, 0), tOut = (Object.values(exp) as any[]).reduce((a, v) => a + v, 0);
  return { inc, exp, grp, tIn, tOut, net: tIn - tOut };
}

export function donut(parts, total, cap) {
  const R = 44, L = 2 * Math.PI * R, live = parts.filter(p => p.v > 0);
  const gap = live.length > 1 ? 2 : 0;
  let off = 0, g = `<circle cx="60" cy="60" r="${R}" fill="none" stroke="var(--paper-2)" stroke-width="20"/>`;
  live.forEach(p => {
    const len = p.v / total * L;
    g += `<circle class="seg" cx="60" cy="60" r="${R}" fill="none" stroke="${p.color}" stroke-width="20" stroke-dasharray="${Math.max(0.5, len - gap).toFixed(2)} ${L.toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 60 60)"><title>${p.name} ${fmt(p.v)}G (${pct(p.v / total)})</title></circle>`;
    off += len;
  });
  g += `<text x="60" y="58" text-anchor="middle" class="cap">${cap}</text><text x="60" y="72" text-anchor="middle" font-size="13">${fmt(total)}</text>`;
  const legend = parts.filter(p => p.v > 0).map(p => `<tr><td><span class="sw" style="background:${p.color}"></span>${p.name}</td><td>${fmt(p.v)}</td><td>${pct(p.v / total)}</td></tr>`).join('');
  return `<div class="donut"><svg viewBox="0 0 120 120" role="img" aria-label="${cap} 구성">${g}</svg>
    <div class="tablewrap"><table class="stats"><tr><th>항목</th><th>G</th><th>비율</th></tr>${legend || '<tr><td colspan="3" class="dim">없음</td></tr>'}</table></div></div>`;
}

export function renderBooksTab() {
  const B = S.books || [];
  if (!B.length) return doc({ kind: '재무과', title: '수입·지출 내역', body: '<p>첫 예산안을 결재하면 그달의 수입과 지출이 항목별로 여기 쌓입니다.</p>' });
  const last = B[B.length - 1].m;
  const view = S.bookView == null || S.bookView === 'last' ? last : S.bookView;
  const one = typeof view === 'number' ? B.find(r => r.m === view) : null;
  const sel = one ? [one] : view === 'year' ? B.slice(-12) : B;
  const T = bookSum(sel);
  const label = one ? `제${one.m}월` : view === 'year' ? `최근 ${sel.length}개월 (제${sel[0].m}~${last}월)` : `임기 전체 (제${B[0].m}~${last}월)`;
  const opts = [['year', '최근 12개월 합계'], ['all', '임기 전체 합계'], ...B.map(r => [r.m, `제${r.m}월${r.m === last ? ' (지난달)' : ''}`]).reverse()]
    .map(([v, t]) => `<option value="${v}" ${String(v) === String(view) ? 'selected' : ''}>${t}</option>`).join('');

  // 한 달을 볼 때는 그 전달과 비교해 무엇이 늘고 줄었는지 보여 준다
  const prevRow = one ? B[B.indexOf(one) - 1] : null;
  const P = prevRow ? bookSum([prevRow]) : null;
  const diff = (a, b) => P == null ? '' : `<td class="${a - b > 0 ? 'ok' : a - b < 0 ? 'ng' : 'dim'}">${a === b ? '−' : sgn(a - b)}</td>`;
  const diffX = (a, b) => P == null ? '' : `<td class="${a - b > 0 ? 'ng' : a - b < 0 ? 'ok' : 'dim'}">${a === b ? '−' : sgn(a - b)}</td>`;
  const head = `<tr><th>항목</th><th>G</th>${P ? `<th>전달 대비</th>` : ''}</tr>`;
  let detail = `<tr class="grp"><td colspan="3">수입</td></tr>`;
  BOOK_INC.forEach(i => { const v = T.inc[i.k] || 0, pv = P ? P.inc[i.k] || 0 : 0; if (v || pv) detail += `<tr><td>${i.name}</td><td>${fmt(v)}</td>${diff(v, pv)}</tr>`; });
  detail += `<tr class="grp"><td colspan="3">지출</td></tr>`;
  EXP_GROUPS.forEach(g => {
    const v = T.grp[g.id], pv = P ? P.grp[g.id] : 0;
    if (!v && !pv) return;
    detail += `<tr><td><span class="sw" style="background:${g.color}"></span>${g.name}</td><td>${fmt(v)}</td>${diffX(v, pv)}</tr>`;
    // 묶음 안에 쓰인 항목이 하나뿐이면 세부 줄은 묶음과 같아 생략한다
    const items = (BOOK_EXP[g.id] || []).filter(([k]) => T.exp[k] || (P && P.exp[k]));
    if (items.length > 1) items.forEach(([k, n]) => { const x = T.exp[k] || 0, px = P ? P.exp[k] || 0 : 0; detail += `<tr class="sub"><td>${n}</td><td>${fmt(x)}</td>${diffX(x, px)}</tr>`; });
  });

  const summary = rows([
    ['수입', fmt(T.tIn)], ['지출', fmt(T.tOut)],
    { sum: true, 0: one ? '이번 달 손익' : '기간 손익', 1: `<span class="${T.net < 0 ? 'neg' : 'pos'}">${sgn(T.net)}</span>` },
  ]);
  const charts = `<div class="grid2">
    ${doc({ kind: label, title: '어디서 들어왔나', body: donut(BOOK_INC.map(i => ({ name: i.name, color: i.color, v: T.inc[i.k] || 0 })), T.tIn, '수입') })}
    ${doc({ kind: label, title: '어디로 나갔나', body: donut(EXP_GROUPS.map(g => ({ name: g.name, color: g.color, v: T.grp[g.id] })), T.tOut, '지출') })}
  </div>`;

  const recent = B.slice(-12).reverse().map(r => {
    const t = bookSum([r]);
    const top = EXP_GROUPS.reduce((a, g) => t.grp[g.id] > t.grp[a.id] ? g : a, EXP_GROUPS[0]);
    return `<tr class="pick ${one && one.m === r.m ? 'cur' : ''}" data-action="book-month" data-m="${r.m}"><td>제${r.m}월</td><td>${fmt(t.tIn)}</td><td>${fmt(t.tOut)}</td><td class="${t.net < 0 ? 'ng' : 'ok'}">${sgn(t.net)}</td><td style="font-family:var(--f-body)">${top.name} ${pct(t.grp[top.id] / Math.max(1, t.tOut))}</td></tr>`;
  }).join('');

  return `<div class="controls"><label>기간 <select data-book="view">${opts}</select></label></div>
    ${doc({ kind: '재무과', title: `${label} 수입·지출`, body: summary + '<p class="from">맨 아래 달마다 손익 표에서 달을 누르면 그달 내역으로 바뀝니다.</p>' })}
    ${charts}
    ${doc({ kind: label, title: '항목별 내역', body: `<div class="tablewrap"><table class="stats">${head}${detail}</table></div>` })}
    ${doc({ kind: '재무과', title: '달마다 손익', body: `<div class="tablewrap"><table class="stats"><tr><th>월</th><th>수입</th><th>지출</th><th>손익</th><th>가장 큰 지출</th></tr>${recent}</table></div>` })}`;
}
