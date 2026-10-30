// 미궁관리국 관할 지도: 양피지 지도(art/map.webp, 원본은 프로젝트 파일 design/tactical-map-base.png 1920 × 1088) 위에
// 관리국 · 미궁 셋 · 길드 본부 일곱 · 영주 성을 놓는다. 본부 자리는 미궁마다 오가는 날(GUILD[g].way)과 맞춘다. 길드 본부에서 미궁으로 가는 길은 들어간 조만큼 굵고,
// 미궁 표식의 고리는 보고된 수위, 세력 사이는 본부 사이의 선 색 · 낱말이다. 그리기만 하고 상태에 쓰지 않는다.
import mapUrl from './art/map.webp';
import { B, type FacId, FACS, GUILDS, type World, isGuildId, nameOf, pactK, relOf, seenLevel, subAt, teamsIn, worstPair } from '../../bureau/engine';
import { type BuUi, dungeonHtml, facHtml, guildsHtml, levelCls, levelWord, n0, n1, pactLine, relRow, relWord, relsTop } from './board';

// 지도 자리 (viewBox 1000 × 567, 그림과 같은 비율)
const DG_AT: [number, number][] = [[452, 282], [700, 140], [800, 262]];   // 폐광 · 검은숲 미궁 · 수몰 갱도
const FAC_AT: Record<FacId, [number, number]> = {
  red: [300, 236], shield: [606, 112], wolf: [500, 384], lamp: [318, 352], river: [848, 330], dawn: [848, 112], drift: [262, 452], lord: [392, 436],
};
// 그림 가운데 땅만 보인다 (나침반 · 테두리는 바깥 배경으로)
const VIEW = '210 70 700 420';
const BUREAU_AT: [number, number] = [588, 345];
const HAVEL_AT: [number, number] = [790, 168];   // 하벨 자작령 성 (영주들 표식은 로이드 백작령)
const FAC_LABEL = (W: World, f: FacId) => f === 'lord' ? '로이드 백작령' : W.guilds[f].name;

const curve = ([x1, y1]: [number, number], [x2, y2]: [number, number], bend: number) => {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
  return `M${x1},${y1} Q${mx - dy / L * bend},${my + dx / L * bend} ${x2},${y2}`;
};
const label = (x: number, y: number, t: string, cls = '') => `<text class="lb ${cls}" x="${x}" y="${y}" text-anchor="middle">${t}</text>`;

export function mapHtml(W: World, ui: BuUi) {
  const sel = ui.sel ?? '';
  let h = `<svg class="map-svg" viewBox="${VIEW}" role="img" aria-label="관할 지도"><image href="${mapUrl}" x="0" y="0" width="1000" height="567" preserveAspectRatio="none"/>`;
  // 지도 위 띠에 제목
  h += `<text class="banner" x="520" y="133" text-anchor="middle">미궁관리국 관할</text>`;
  // 세력 사이: 표식 사이의 선. 짝이 많아 험악하거나 우호적인 짝 · 협정을 맺은 짝만 긋는다
  const [wa, wb] = worstPair(W);
  FACS.forEach((a, i) => FACS.slice(i + 1).forEach(b => {
    const v = relOf(W, a, b), pact = isGuildId(a) && isGuildId(b) && W.pact && W.day < W.pact.until && W.pact.who.includes(a) && W.pact.who.includes(b);
    if (Math.abs(v) < 25 && !pact) return;
    h += `<path class="rel-line ${v < -5 ? 'neg' : v >= 25 ? 'pos' : ''}" d="${curve(FAC_AT[a], FAC_AT[b], 18)}" style="stroke-width:${1 + Math.abs(v) / 25}"/>`;
  }));
  // 낱말은 가장 나쁜 두 길드 사이에만 (나머지는 선 색과 살펴보기 탭으로)
  {
    const v = relOf(W, wa, wb), [x1, y1] = FAC_AT[wa], [x2, y2] = FAC_AT[wb], pact = W.pact && W.day < W.pact.until && W.pact.who.includes(wa) && W.pact.who.includes(wb);
    if (v <= -25) h += label(x1 + (x2 - x1) * 0.5, y1 + (y2 - y1) * 0.5 - 6, relWord(v) + (pact ? (pactK(W, wa, wb) > 0 ? ' · 협정' : ' · 협정 대기') : ''), 'rel');
  }
  // 길드의 조가 미궁으로 가는 길: 들어간 조만큼 굵게
  W.dungeons.forEach((d, i) => {
    GUILDS.forEach((g, k) => {
      const n = d.teams[g];
      if (n < 0.3) return;
      h += `<path class="flow f-${g}" d="${curve(FAC_AT[g], DG_AT[i], k % 2 ? 24 : -24)}" style="stroke-width:${1.5 + n * 0.9}"><title>${nameOf(W, g)} ${n1(n)}조 → ${d.name} (본부에서 ${B.GUILD[g].way[i]}일)</title></path>`;
    });
    // 보고가 오는 길 (관리국 ← 미궁)
    h += `<path class="report" d="${curve(DG_AT[i], BUREAU_AT, 12)}"/>`;
  });
  // 관리국 · 하벨 성
  h += `<g class="place bureau"><rect x="${BUREAU_AT[0] - 9}" y="${BUREAU_AT[1] - 9}" width="18" height="18" rx="2"/>${label(BUREAU_AT[0], BUREAU_AT[1] + 26, '미궁관리국', 'strong')}</g>`;
  h += `<g class="place castle"><path d="M${HAVEL_AT[0] - 8},${HAVEL_AT[1] + 8} v-12 l4,-4 l4,4 l4,-4 l4,4 v12 z"/>${label(HAVEL_AT[0], HAVEL_AT[1] + 22, '하벨 자작령', 'small')}</g>`;
  // 세력 표식: 깃발
  for (const f of FACS) {
    // 길드 깃발은 몸집(조 수)만큼 크다
    const [x, y] = FAC_AT[f], on = sel === `fac:${f}`, g = isGuildId(f) ? W.guilds[f] : null;
    const k = g ? Math.min(2.2, 0.8 + g.size / 22) : 1;
    h += `<g class="mk fac-mk f-${f}${on ? ' on' : ''}" data-act="sel:fac:${f}" role="button" tabindex="0" aria-label="${nameOf(W, f)}${g ? ` ${n0(g.size)}조` : ''}">
      <circle class="hit" cx="${x}" cy="${y}" r="${26 * k}"/>
      <path class="flag" transform="translate(${x} ${y}) scale(${k}) translate(${-x} ${-y})" d="M${x - 2},${y + 14} V${y - 16} h18 l-5,6 l5,6 h-18"/>
      ${label(x, y + 14 * k + 16, FAC_LABEL(W, f), on ? 'strong' : '')}
      ${g ? label(x, y + 14 * k + 30, `${n0(g.size)}조`, 'small') : ''}</g>`;
  }
  // 미궁 표식: 고리가 보고된 수위
  W.dungeons.forEach((d, i) => {
    const [x, y] = DG_AT[i], lv = seenLevel(W, i), on = sel === `dg:${i}`, C = 2 * Math.PI * 22;
    h += `<g class="mk dg-mk ${levelCls(lv)}${on ? ' on' : ''}${lv >= B.DANGER ? ' hot' : ''}" data-act="sel:dg:${i}" role="button" tabindex="0" aria-label="${d.name} 수위 ${n0(lv)}">
      <circle class="disc" cx="${x}" cy="${y}" r="22"/>
      <circle class="ring" cx="${x}" cy="${y}" r="22" style="stroke-dasharray:${C * Math.min(1, lv / 100)} ${C}" transform="rotate(-90 ${x} ${y})"/>
      <text class="lv" x="${x}" y="${y + 6}" text-anchor="middle">${n0(lv)}</text>
      ${subAt(W, i) > 0 ? `<g class="coin"><circle cx="${x + 20}" cy="${y - 18}" r="9"/><text x="${x + 20}" y="${y - 14}" text-anchor="middle">${subAt(W, i)}</text></g>` : ''}
      ${label(x, y + 38, d.name, on ? 'strong' : '')}
      ${label(x, y + 52, `${levelWord(lv)} · ${n1(teamsIn(d))}조${d.floods ? ` · 범람 ${d.floods}` : ''}`, 'small')}</g>`;
  });
  return h + '</svg>';
}

// 살펴보기 탭: 지도에서 고른 것, 아니면 관할 요약
export function lookHtml(W: World, ui: BuUi) {
  const [k, v] = (ui.sel ?? '').split(':');
  const back = `<button type="button" class="link" data-act="sel:">← 관할 요약</button>`;
  if (k === 'dg') return back + dungeonHtml(W, +v);
  if (k === 'fac') {
    const f = v as FacId, others = FACS.filter(x => x !== f);
    return back + facHtml(W, f) + `<section class="rels">${others.map(o => relRow(W, f, o)).join('')}${f !== 'lord' ? pactLine(W) : ''}</section>`;
  }
  return `<p class="note">지도에서 미궁이나 깃발을 누르면 자세히 본다.</p>
  <div class="sum">${W.dungeons.map((d, i) => { const lv = seenLevel(W, i); return `<button type="button" class="sum-row ${levelCls(lv)}" data-act="sel:dg:${i}"><b>${d.name}</b><span class="num">${n0(lv)}</span><span class="tag">${levelWord(lv)}</span><small class="num">${n1(teamsIn(d))}조 · 보조금 ${subAt(W, i)}G</small></button>`; }).join('')}</div>
  ${guildsHtml(W)}
  <section class="rels"><h2>세력 사이 <small>나쁜 짝부터</small></h2>${relsTop(W)}${pactLine(W)}</section>`;
}
