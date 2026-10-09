// 결과 그래프: 금고의 흐름(시작 금고부터), 수입과 순이익, 수입 구성, 지출 구성, 인당·조당 효율, 채집 점유율, 시세 흐름.
// 기록을 읽어 SVG 문자열만 만든다. 상태를 쓰지 않고 난수도 쓰지 않는다. 숫자는 마우스를 올리면 data-tip으로 보인다
import { ITEMS, type MonthResult, type World, us } from '../../core/company';

const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
const sgn = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n));
// 눈금 끝값: 1 · 1.2 · 1.5 · 2 · 2.5 · 3 · 4 · 5 · 6 · 8 · 10 꼴로 올린다
function nice(v: number) {
  if (v <= 0) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(v))), m = v / e;
  return ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(x => m <= x) || 10) * e;
}
const short = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : `${Math.round(v * 10) / 10}`);
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

// 우리의 달별 숫자. 금고는 지금 금고에서 뒤로 순이익을 빼 가며 되짚는다 (첫 값은 시작 금고)
export function moneySeries(W: World) {
  const H = W.history, cash: number[] = [];
  let c = us(W).cash;
  for (let k = H.length - 1; k >= 0; k--) { cash[k] = c; c -= H[k].res[0].net; }
  const r = (M: MonthResult) => M.res[0];
  return {
    months: H.map(M => M.month), cash, start: c,
    sales: H.map(M => r(M).sales), loot: H.map(M => r(M).sales - r(M).matSales), mats: H.map(M => r(M).matSales), net: H.map(M => r(M).net),
    spend: H.map(M => { const s = r(M).spend; return { people: s.wage + s.recruit, sortie: s.sortie + s.hire + s.tool, supply: s.potion + s.gear, info: s.intel + s.probe, invest: s.train + s.base + s.proc + s.donate + s.root }; }),
    parties: H.map(M => sum(r(M).sent) + sum(r(M).hired)), heads: headsOf(W),
    share: H.map(M => { const mine = sum(r(M).got.map((g, f) => g * ITEMS[f].P0)), all = sum(M.res.map(x => sum(x.got.map((g, f) => g * ITEMS[f].P0)))); return all ? mine / all : 0; }),
    deaths: H.map(M => r(M).deaths), ok: H.map(M => sum(r(M).ok)),
  };
}
// 그달 입장할 때의 단원 수: 지금 단원 수에서 뒤로 신입을 빼고 사망을 더해 되짚는다
function headsOf(W: World) {
  const H = W.history, out: number[] = [];
  let m = us(W).members;
  for (let k = H.length - 1; k >= 0; k--) { const r = H[k].res[0]; m = m - r.recruited + r.deaths; out[k] = Math.max(1, m); }
  return out;
}
// 지출 구성의 이름과 색 (검증한 범주 색 순서대로)
export const SPEND_KEYS: [keyof ReturnType<typeof moneySeries>['spend'][number], string, string][] = [
  ['people', '급여 · 신입', 'var(--c-us)'], ['sortie', '출정 · 계약', 'var(--c-red)'], ['supply', '포션 · 장비', 'var(--c-holy)'], ['info', '정보', 'var(--c-iron)'], ['invest', '투자', 'var(--c-etc)'],
];

const VW = 560, VH = 170, PL = 42, PR = 12, PT = 14, PB = 22;
function frame(n: number, lo: number, hi: number) {
  const w = VW - PL - PR, h = VH - PT - PB, step = w / Math.max(1, n);
  return { X: (k: number) => PL + (k + 0.5) * step, Y: (v: number) => PT + h - ((v - lo) / Math.max(1e-9, hi - lo)) * h, step };
}
function axes(lo: number, hi: number, Y: (v: number) => number, labels: string[], X: (k: number) => number, unit = '') {
  const ticks = [lo, (lo + hi) / 2, hi].filter((v, i, a) => a.indexOf(v) === i);
  const every = Math.max(1, Math.ceil(labels.length / 8));
  return ticks.map(v => `<line class="gl" x1="${PL}" x2="${VW - PR}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${PL - 6}" y="${Y(v) + 3}" text-anchor="end">${short(v)}${unit}</text>`).join('')
    + labels.map((m, k) => (k % every === 0 || k === labels.length - 1 ? `<text x="${X(k)}" y="${VH - 6}" text-anchor="middle">${m}</text>` : '')).join('');
}
const hits = (n: number, X: (k: number) => number, step: number, tip: (k: number) => string) =>
  Array.from({ length: n }, (_, k) => `<rect class="hit" x="${X(k) - step / 2}" y="${PT}" width="${step}" height="${VH - PT - PB}" data-tip="${tip(k)}"/>`).join('');
const fig = (title: string, legend: string, svg: string, aria: string) =>
  `<figure class="chart"><figcaption>${title}${legend ? ` <span class="lg">${legend}</span>` : ''}</figcaption><svg viewBox="0 0 ${VW} ${VH}" role="img" aria-label="${aria}">${svg}</svg></figure>`;
const key = (color: string, name: string, line = false) => `<i style="background:${color}"${line ? ' class="line"' : ''}></i>${name}`;

// 금고: 시작 금고(입장 전)부터 달마다. 선과 면, 끝점에 지금 금고
export function cashChart(W: World) {
  const S = moneySeries(W), vals = [S.start, ...S.cash], labels = ['시작', ...S.months.map(m => `${m}월`)], n = vals.length;
  if (n < 2) return '';
  const mn = Math.min(...vals), hi = nice(Math.max(...vals) * 1.08), lo = mn < 0 ? -nice(-mn * 1.1) : 0;
  const { X, Y, step } = frame(n, lo, hi);
  const pts = vals.map((v, k) => `${X(k)},${Y(v)}`).join(' ');
  const last = vals[n - 1];
  return fig('금고', '', `${axes(lo, hi, Y, labels, X)}<polygon class="area" points="${X(0)},${Y(Math.max(lo, 0))} ${pts} ${X(n - 1)},${Y(Math.max(lo, 0))}"/><polyline class="ln" points="${pts}"/>
    <line class="ref" x1="${PL}" x2="${VW - PR}" y1="${Y(S.start)}" y2="${Y(S.start)}"/>
    <circle class="end" cx="${X(n - 1)}" cy="${Y(last)}" r="4"/><text class="endlab" x="${X(n - 1) - 6}" y="${Y(last) - 8}" text-anchor="end">${fmt(last)}G</text>
    ${hits(n, X, step, k => (k ? `제${S.months[k - 1]}월|금고 ${fmt(vals[k])}G|순이익 ${sgn(S.net[k - 1])}G` : `시작|금고 ${fmt(vals[0])}G`))}`, `달별 금고, 시작 ${fmt(S.start)}G, 지금 ${fmt(last)}G`);
}

// 수입과 순이익: 같은 G 눈금 하나. 순이익은 0을 기준으로 위(흑자)·아래(적자) 막대, 수입은 점선
export function flowChart(W: World) {
  const S = moneySeries(W), n = S.months.length;
  if (!n) return '';
  const hi = nice(Math.max(...S.sales, ...S.net, 1) * 1.08), mn = Math.min(0, ...S.net), lo = mn < 0 ? -nice(-mn * 1.08) : 0;
  const { X, Y, step } = frame(n, lo, hi), bw = Math.max(3, Math.min(16, step * 0.55));
  const bars = S.net.map((v, k) => { const y0 = Y(0), y1 = Y(v); return `<rect class="bar ${v < 0 ? 'neg' : 'pos'}" x="${X(k) - bw / 2}" y="${Math.min(y0, y1)}" width="${bw}" height="${Math.max(1, Math.abs(y1 - y0))}" rx="2"/>`; }).join('');
  return fig('수입과 순이익', `${key('var(--ink-soft)', '수입', true)} ${key('var(--c-us)', '흑자')} ${key('var(--c-red)', '적자')}`,
    `${axes(lo, hi, Y, S.months.map(m => `${m}월`), X)}<line class="zero" x1="${PL}" x2="${VW - PR}" y1="${Y(0)}" y2="${Y(0)}"/>${bars}<polyline class="ln2" points="${S.sales.map((v, k) => `${X(k)},${Y(v)}`).join(' ')}"/>
    ${hits(n, X, step, k => `제${S.months[k]}월|수입 ${fmt(S.sales[k])}G|지출 ${fmt(S.sales[k] - S.net[k])}G|순이익 ${sgn(S.net[k])}G`)}`, '달별 수입과 순이익');
}

// 쌓은 막대: 달마다 항목별 크기를 아래부터 쌓는다 (항목 사이 2px 틈)
function stacked(title: string, months: number[], parts: { name: string; color: string; v: number[] }[], aria: string) {
  const n = months.length; if (!n) return '';
  const tot = months.map((_, k) => sum(parts.map(p => p.v[k]))), hi = nice(Math.max(...tot, 1) * 1.08);
  const { X, Y, step } = frame(n, 0, hi), bw = Math.max(4, Math.min(18, step * 0.6));
  const bars = months.map((_, k) => { let acc = 0; return parts.map(p => { const v = p.v[k]; if (v <= 0) return ''; const y1 = Y(acc + v), y0 = Y(acc); acc += v; return `<rect x="${X(k) - bw / 2}" y="${y1}" width="${bw}" height="${Math.max(1, y0 - y1 - 1.5)}" fill="${p.color}" rx="1.5"/>`; }).join(''); }).join('');
  return fig(title, parts.map(p => key(p.color, p.name)).join(' '), `${axes(0, hi, Y, months.map(m => `${m}월`), X)}${bars}
    ${hits(n, X, step, k => `제${months[k]}월|${parts.map(p => `${p.name} ${fmt(p.v[k])}G`).join('|')}|모두 ${fmt(tot[k])}G`)}`, aria);
}
export const incomeMix = (W: World) => { const S = moneySeries(W); return stacked('수입 구성', S.months, [{ name: '전리품', color: 'var(--c-us)', v: S.loot }, { name: '갈무리 소재', color: 'var(--c-holy)', v: S.mats }], '달별 전리품과 소재 수입'); };
export const spendMix = (W: World) => { const S = moneySeries(W); return stacked('지출 구성', S.months, SPEND_KEYS.map(([k, name, color]) => ({ name, color, v: S.spend.map(x => x[k]) })), '달별 지출 구성'); };

// 선 하나짜리 작은 그래프 (효율 지표)
function single(title: string, months: number[], v: number[], unit: string, tip: (k: number) => string, aria: string, ref?: number) {
  const n = months.length; if (!n) return '';
  const mx = Math.max(...v, ref ?? 0), mn = Math.min(...v, 0), hi = nice(mx * 1.1 || 1), lo = mn < 0 ? -nice(-mn * 1.1) : 0;
  const { X, Y, step } = frame(n, lo, hi), pts = v.map((y, k) => `${X(k)},${Y(y)}`).join(' ');
  return fig(title, '', `${axes(lo, hi, Y, months.map(m => `${m}월`), X, unit)}${lo < 0 ? `<line class="zero" x1="${PL}" x2="${VW - PR}" y1="${Y(0)}" y2="${Y(0)}"/>` : ''}
    ${ref != null ? `<line class="ref" x1="${PL}" x2="${VW - PR}" y1="${Y(ref)}" y2="${Y(ref)}"/>` : ''}<polyline class="ln" points="${pts}"/>${v.map((y, k) => `<circle class="dot" cx="${X(k)}" cy="${Y(y)}" r="2.5"/>`).join('')}
    ${hits(n, X, step, tip)}`, aria);
}
// 조 하나가 벌어 온 것과 조 하나에 든 것 (출정·포션·장비·급여를 조 수로 나눔)
export function perPartyChart(W: World) {
  const S = moneySeries(W), n = S.months.length; if (!n) return '';
  const inc = S.sales.map((v, k) => (S.parties[k] ? v / S.parties[k] : 0)), cost = S.spend.map((s, k) => (S.parties[k] ? (s.people + s.sortie + s.supply) / S.parties[k] : 0));
  const hi = nice(Math.max(...inc, ...cost, 1) * 1.1), { X, Y, step } = frame(n, 0, hi);
  return fig('조당 수입과 조당 비용', `${key('var(--c-us)', '조당 수입', true)} ${key('var(--c-red)', '조당 비용', true)}`,
    `${axes(0, hi, Y, S.months.map(m => `${m}월`), X)}<polyline class="ln" points="${inc.map((v, k) => `${X(k)},${Y(v)}`).join(' ')}"/><polyline class="ln3" points="${cost.map((v, k) => `${X(k)},${Y(v)}`).join(' ')}"/>
    ${hits(n, X, step, k => `제${S.months[k]}월|조당 수입 ${fmt(inc[k])}G|조당 비용 ${fmt(cost[k])}G (급여·출정·보급)|보낸 조 ${S.parties[k]}`)}`, '조당 수입과 조당 비용');
}
// 단원 한 명당 순이익 (그달 입장할 때의 단원 수로 나눔)
export function perHeadChart(W: World) {
  const S = moneySeries(W); if (!S.months.length) return '';
  const v = S.net.map((x, k) => x / S.heads[k]);
  return single('단원 한 명당 순이익', S.months, v, 'G', k => `제${S.months[k]}월|한 명당 ${sgn(v[k])}G|순이익 ${sgn(S.net[k])}G · 단원 ${S.heads[k]}명`, '단원 한 명당 순이익');
}
// 채집 점유율: 모두가 캐 간 전리품 값 중 우리 몫
export function shareChart(W: World) {
  const S = moneySeries(W), v = S.share.map(x => x * 100);
  return single('채집 점유율', S.months, v, '%', k => `제${S.months[k]}월|우리 몫 ${v[k].toFixed(1)}%`, '달별 채집 점유율');
}

// 시세 흐름: 열린 층(시장에 풀린) 전리품마다 작은 선. 옅은 띠가 그 전리품이 오갈 수 있는 가격대(바닥~천장)이고,
// 얕은 층 전리품은 띠가 좁아 거의 평평하고 깊은 층 전리품은 띠가 넓어 크게 출렁인다. 점선은 기준 시세. 아직 안 열린 층의 전리품은 보이지 않는다
// 공급과 수요: 가운데 눈금이 수요(시장이 한 달에 사 가는 양), 막대가 그달 공급. 수요를 넘으면 주황(값이 떨어짐)
// 공급과 수요는 상단 장부(시장 정보망) 1단계부터 보인다. 가운데 눈금이 수요, 막대가 그달 시장 전체 공급, 수요를 넘으면 주황
function sdBar(D: number, Q: number | null, see: boolean) {
  if (!see) return '<span class="sd-lock">상단 장부 1단계부터</span>';
  const pctQ = Q == null ? 0 : Math.min(100, (Q / D) * 50);
  return `<span class="sd" title="${Q == null ? `수요 ${D} · 아직 안 팔림` : `공급 ${Q} / 수요 ${D}`}"><span class="sd-bar"><i class="${Q != null && Q > D ? 'over' : ''}" style="width:${pctQ}%"></i><b></b></span><small>${Q == null ? `- / ${D}` : `${Q} / ${D}`}</small></span>`;
}
export function priceBoard(W: World) {
  const H = W.history, seeQ = (W.intel ? W.intel.lv.mkt : 0) >= 1;
  const rows = ITEMS.map((it, j) => {
    const ps = H.map(M => (M.Q[j] ? M.price[j] : null)), have = ps.filter((v): v is number => v != null);
    if (j >= W.unlocked && !have.length) return '';
    const lo = Math.round(it.P0 * it.lo), hi = Math.round(it.P0 * it.hi);
    // 세로 눈금은 모든 전리품이 같은 비율(기준 시세의 가장 낮은 바닥 ~ 가장 높은 천장)이라 출렁임의 크기를 서로 견줄 수 있다
    const w = 150, h = 40, n = Math.max(2, ps.length), yLo = it.P0 * Math.min(...ITEMS.map(x => x.lo)), yHi = it.P0 * Math.max(...ITEMS.map(x => x.hi));
    const X = (k: number) => 4 + (k / Math.max(1, n - 1)) * (w - 8), Y = (v: number) => 3 + (1 - (v - yLo) / Math.max(1, yHi - yLo)) * (h - 6);
    const band = `<rect class="band" x="2" y="${Y(hi)}" width="${w - 4}" height="${Y(lo) - Y(hi)}"/><line class="base" x1="2" x2="${w - 2}" y1="${Y(it.P0)}" y2="${Y(it.P0)}"/>`;
    if (!have.length) return `<tr><td><b>${it.name}</b><small>${it.buyer}</small></td><td><svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${it.name} 아직 안 팔림">${band}</svg></td>
      <td class="n"><b>${fmt(it.P0)}G</b><small>기준</small></td><td class="n dim">-</td><td>${sdBar(it.D, null, seeQ)}</td><td class="n dim">${fmt(lo)}~${fmt(hi)}G</td></tr>`;
    const now = ps[ps.length - 1] ?? have[have.length - 1], prevV = [...ps.slice(0, -1)].reverse().find(v => v != null) ?? null;
    const d = prevV ? Math.round((now / prevV - 1) * 100) : 0;
    let path = '', pen = false;
    ps.forEach((v, k) => { if (v == null) { pen = false; return; } path += `${pen ? 'L' : 'M'}${X(k).toFixed(1)},${Y(v).toFixed(1)} `; pen = true; });
    const lastK = ps.lastIndexOf(now);
    const hs = ps.map((v, k) => (v == null ? '' : `<rect class="hit" x="${X(k) - w / n / 2}" y="0" width="${w / n}" height="${h}" data-tip="${it.name} · 제${H[k].month}월|${fmt(v)}G${seeQ ? `|공급 ${H[k].Q[j]} / 수요 ${it.D}` : ''}"/>`)).join('');
    return `<tr><td><b>${it.name}</b><small>${it.buyer}</small></td><td><svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${it.name} 시세 흐름">
      ${band}<path class="sp" d="${path}"/><circle class="spend ${d < 0 ? 'dn' : d > 0 ? 'up' : ''}" cx="${X(lastK)}" cy="${Y(now)}" r="3"/>${hs}</svg></td>
      <td class="n"><b>${fmt(now)}G</b><small>기준 ${fmt(it.P0)}</small></td><td class="n ${d > 0 ? 'pos' : d < 0 ? 'neg' : 'dim'}">${d > 0 ? '▲' : d < 0 ? '▼' : ''}${d ? Math.abs(d) + '%' : '±0%'}</td><td>${sdBar(it.D, H[H.length - 1].Q[j], seeQ)}</td><td class="n dim">${fmt(lo)}~${fmt(hi)}G</td></tr>`;
  }).join('');
  return `<table class="grid board"><thead><tr><th>전리품</th><th>흐름</th><th class="n">시세</th><th class="n">전월 대비</th><th>공급 / 수요</th><th class="n">가격대</th></tr></thead><tbody>${rows}</tbody></table>`;
}
