// 결과 그래프: 우리 금고의 흐름, 달마다 수입과 순이익, 전리품 시세의 흐름(주식 시세처럼 작은 선).
// 기록을 읽어 SVG 문자열만 만든다. 상태를 쓰지 않고 난수도 쓰지 않는다. 숫자는 마우스를 올리면 data-tip으로 보인다
import { ITEMS, type World, us } from '../../core/company';

const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
const sgn = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n));
// 눈금 끝값: 1 · 1.2 · 1.5 · 2 · 2.5 · 3 · 4 · 5 · 6 · 8 · 10 꼴로 올린다
function nice(v: number) {
  if (v <= 0) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(v))), m = v / e;
  return ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(x => m <= x) || 10) * e;
}
const short = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : `${Math.round(v)}`);

// 우리의 달별 금고(그달 정산 뒤), 수입, 순이익. 금고는 지금 금고에서 뒤로 순이익을 빼 가며 되짚는다
export function moneySeries(W: World) {
  const H = W.history, cash: number[] = [];
  let c = us(W).cash;
  for (let k = H.length - 1; k >= 0; k--) { cash[k] = c; c -= H[k].res[0].net; }
  return { months: H.map(M => M.month), cash, sales: H.map(M => M.res[0].sales), net: H.map(M => M.res[0].net), start: c };
}

const VW = 560, VH = 170, PL = 40, PR = 12, PT = 12, PB = 22;
function frame(n: number, lo: number, hi: number) {
  const w = VW - PL - PR, h = VH - PT - PB, step = w / Math.max(1, n);
  return { X: (k: number) => PL + (k + 0.5) * step, Y: (v: number) => PT + h - ((v - lo) / Math.max(1, hi - lo)) * h, step, w, h };
}
function axes(lo: number, hi: number, Y: (v: number) => number, months: number[], X: (k: number) => number) {
  const ticks = [lo, (lo + hi) / 2, hi].filter((v, i, a) => a.indexOf(v) === i);
  const every = Math.max(1, Math.ceil(months.length / 8));
  return ticks.map(v => `<line class="gl" x1="${PL}" x2="${VW - PR}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${PL - 6}" y="${Y(v) + 3}" text-anchor="end">${short(v)}</text>`).join('')
    + months.map((m, k) => (k % every === 0 || k === months.length - 1 ? `<text x="${X(k)}" y="${VH - 6}" text-anchor="middle">${m}월</text>` : '')).join('');
}

// 금고: 선 하나와 면. 끝점에 지금 금고를 적는다
export function cashChart(W: World) {
  const S = moneySeries(W), n = S.months.length;
  if (!n) return '';
  const hi = nice(Math.max(...S.cash, S.start) * 1.08), lo = Math.min(0, nice(Math.min(...S.cash)) * (Math.min(...S.cash) < 0 ? 1 : 0));
  const { X, Y, step } = frame(n, lo, hi);
  const pts = S.cash.map((v, k) => `${X(k)},${Y(v)}`).join(' ');
  const area = `${X(0)},${Y(lo)} ${pts} ${X(n - 1)},${Y(lo)}`;
  const last = S.cash[n - 1];
  const hits = S.months.map((m, k) => `<rect class="hit" x="${X(k) - step / 2}" y="${PT}" width="${step}" height="${VH - PT - PB}" data-tip="제${m}월|금고 ${fmt(S.cash[k])}G|순이익 ${sgn(S.net[k])}G"/>`).join('');
  return `<figure class="chart"><figcaption>금고</figcaption><svg viewBox="0 0 ${VW} ${VH}" role="img" aria-label="달별 금고, 지금 ${fmt(last)}G">
    ${axes(lo, hi, Y, S.months, X)}<polygon class="area" points="${area}"/><polyline class="ln" points="${pts}"/>
    <circle class="end" cx="${X(n - 1)}" cy="${Y(last)}" r="4"/><text class="endlab" x="${X(n - 1) - 6}" y="${Y(last) - 8}" text-anchor="end">${fmt(last)}G</text>${hits}</svg></figure>`;
}

// 수입과 순이익: 같은 G 눈금 하나. 순이익은 0을 기준으로 위(흑자)·아래(적자) 막대, 수입은 선
export function flowChart(W: World) {
  const S = moneySeries(W), n = S.months.length;
  if (!n) return '';
  const hi = nice(Math.max(...S.sales, ...S.net, 1) * 1.08), minNet = Math.min(0, ...S.net), lo = minNet < 0 ? -nice(-minNet * 1.08) : 0;
  const { X, Y, step } = frame(n, lo, hi);
  const bw = Math.max(3, Math.min(16, step * 0.55));
  const bars = S.net.map((v, k) => { const y0 = Y(0), y1 = Y(v); return `<rect class="bar ${v < 0 ? 'neg' : 'pos'}" x="${X(k) - bw / 2}" y="${Math.min(y0, y1)}" width="${bw}" height="${Math.max(1, Math.abs(y1 - y0))}" rx="2"/>`; }).join('');
  const pts = S.sales.map((v, k) => `${X(k)},${Y(v)}`).join(' ');
  const hits = S.months.map((m, k) => `<rect class="hit" x="${X(k) - step / 2}" y="${PT}" width="${step}" height="${VH - PT - PB}" data-tip="제${m}월|수입 ${fmt(S.sales[k])}G|지출 ${fmt(S.sales[k] - S.net[k])}G|순이익 ${sgn(S.net[k])}G"/>`).join('');
  return `<figure class="chart"><figcaption>수입과 순이익 <span class="lg"><i class="l-sales"></i>수입 <i class="l-pos"></i>흑자 <i class="l-neg"></i>적자</span></figcaption>
    <svg viewBox="0 0 ${VW} ${VH}" role="img" aria-label="달별 수입과 순이익">${axes(lo, hi, Y, S.months, X)}<line class="zero" x1="${PL}" x2="${VW - PR}" y1="${Y(0)}" y2="${Y(0)}"/>
    ${bars}<polyline class="ln2" points="${pts}"/>${hits}</svg></figure>`;
}

// 시세 흐름: 전리품마다 작은 선 (점선은 기준 시세), 지금 시세와 지난달 대비
export function priceBoard(W: World) {
  const H = W.history;
  if (!H.length) return '';
  const rows = ITEMS.map((it, j) => {
    const ps = H.map(M => (M.Q[j] ? M.price[j] : null)), have = ps.filter((v): v is number => v != null);
    if (!have.length) return '';
    const now = ps[ps.length - 1] ?? have[have.length - 1], prevV = [...ps.slice(0, -1)].reverse().find(v => v != null) ?? null;
    const d = prevV ? Math.round((now / prevV - 1) * 100) : 0;
    const w = 150, h = 34, lo = Math.min(...have, it.P0) * 0.95, hi = Math.max(...have, it.P0) * 1.05, n = ps.length;
    const X = (k: number) => 4 + (k / Math.max(1, n - 1)) * (w - 8), Y = (v: number) => 3 + (1 - (v - lo) / Math.max(1, hi - lo)) * (h - 6);
    let path = '', pen = false;
    ps.forEach((v, k) => { if (v == null) { pen = false; return; } path += `${pen ? 'L' : 'M'}${X(k).toFixed(1)},${Y(v).toFixed(1)} `; pen = true; });
    const lastK = ps.lastIndexOf(now);
    const hits = ps.map((v, k) => (v == null ? '' : `<rect class="hit" x="${X(k) - w / n / 2}" y="0" width="${w / n}" height="${h}" data-tip="${it.name} · 제${H[k].month}월|${fmt(v)}G|팔린 양 ${H[k].Q[j]}"/>`)).join('');
    return `<tr><td><b>${it.name}</b></td><td><svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${it.name} 시세 흐름">
      <line class="base" x1="2" x2="${w - 2}" y1="${Y(it.P0)}" y2="${Y(it.P0)}"/><path class="sp" d="${path}"/><circle class="spend ${d < 0 ? 'dn' : d > 0 ? 'up' : ''}" cx="${X(lastK)}" cy="${Y(now)}" r="3"/>${hits}</svg></td>
      <td class="n"><b>${fmt(now)}G</b></td><td class="n ${d > 0 ? 'pos' : d < 0 ? 'neg' : 'dim'}">${d > 0 ? '▲' : d < 0 ? '▼' : ''}${d ? Math.abs(d) + '%' : '±0%'}</td><td class="n dim">기준 ${fmt(it.P0)}</td></tr>`;
  }).join('');
  return `<table class="grid board"><tbody>${rows}</tbody></table>`;
}
