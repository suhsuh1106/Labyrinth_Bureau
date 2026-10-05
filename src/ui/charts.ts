// 선 그래프
import { C } from '../core/data';
import { clamp } from '../core/util';

export function lineChart(series, { min, max, ticks, fmtTick = v => v }) {
  const W = 300, H = 120, L = 34, R = 8, T = 8, B = 18;
  const x = m => L + (m - 1) * (W - L - R) / (C.MONTHS - 1);
  const y = v => T + (1 - (v - min) / (max - min)) * (H - T - B);
  let g = '';
  ticks.forEach(t => {
    g += `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="var(--rule)" stroke-width="1"/>`;
    g += `<text x="${L - 4}" y="${y(t) + 3}" text-anchor="end">${fmtTick(t)}</text>`;
  });
  [1, 12, 24, 36].forEach(m => { g += `<text x="${x(m)}" y="${H - 4}" text-anchor="middle">${m}월</text>`; });
  series.forEach(s => {
    const pts = s.vals.map((v, i) => `${x(i + 1).toFixed(1)},${y(clamp(v, min, max)).toFixed(1)}`);
    if (pts.length > 1) g += `<polyline points="${pts.join(' ')}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round"/>`;
    const lv = s.vals[s.vals.length - 1];
    if (lv !== undefined) g += `<circle cx="${x(s.vals.length)}" cy="${y(clamp(lv, min, max))}" r="3" fill="${s.color}"/>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
}
