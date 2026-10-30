// 미궁관리국 관할 지도: 40 × 24칸 타일(src/bureau/tiles.ts) 위에 관리국 · 미궁 셋 · 길드 본부 일곱 · 두 영주 성을 칸 자리에 놓는다.
// 땅과 처음부터 있는 길은 판마다 같아 한 번만 그리고(terrainSvg), 날마다 바뀌는 것은 그 위 층(mapHtml)에 그린다:
// 외진 미궁의 발전도(1단계 관리국에서 오는 새 길과 길목 여관, 2단계 곁 마을과 지부 깃발), 길드 조가 본부와 미궁을 오가는 말(날마다 칸을 옮긴다),
// 미궁 표식의 고리(보고된 수위), 세력 사이(본부 사이 선). 그리기만 하고 상태에 쓰지 않는다.
import { B, BUREAU_AT, HAVEL_AT, LORD_AT, ROADS, devRoadOf, devStage, type FacId, FACS, GUILDS, type World, wayOf, isGuildId, nameOf, pactK, relOf, seenLevel, subAt, teamsIn, worstPair } from '../../bureau/engine';
import { type At, GRID, type Ground, MAP_H, MAP_W, groundAt, isRoad, walkPath } from '../../bureau/tiles';
import { type BuUi, dungeonHtml, facHtml, guildsHtml, levelCls, levelWord, n0, n1, pactLine, relRow, relWord, relsTop } from './board';

// 칸 하나 = T (viewBox 단위). 지도 전체는 MAP_W·T × MAP_H·T
export const T = 32;
export const MAP_PX: [number, number] = [MAP_W * T, MAP_H * T];
const FAC_AT = (f: FacId): At => f === 'lord' ? LORD_AT : B.GUILD[f].at;
const cx = (a: At) => a[0] * T + T / 2, cy = (a: At) => a[1] * T + T / 2;
// 칸마다 같은 값을 내는 해시 (난수를 쓰지 않는다)
const hash = (x: number, y: number, k = 0) => { let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const label = (x: number, y: number, t: string, cls = '') => `<text class="lb ${cls}" x="${x}" y="${y}" text-anchor="middle">${t}</text>`;

const FILL: Record<Ground, string[]> = {
  '.': ['#b3c08f', '#aebc8a', '#b8c494'],
  f: ['#9cb07e', '#97ab79'],
  n: ['#c4c193', '#bfbb8c'],
  '^': ['#b5ab97', '#ada38e'],
  '~': ['#6f9aab', '#6b96a7'],
};
const wet = (x: number, y: number) => groundAt(x, y) === '~';
const nearLand = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const g = GRID[y + dy]?.[x + dx]; return g != null && g !== '~'; });

// 길: 이웃한 길 칸의 가운데끼리 잇는다. 대각선은 사이에 곧은 이음이 없을 때만
function roadSegs(has: (x: number, y: number) => boolean, only?: (x: number, y: number) => boolean) {
  const segs: string[] = [];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (!has(x, y)) continue;
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (!has(nx, ny)) continue;
      if (dx && dy && (has(x + dx, y) || has(x, y + dy))) continue;
      if (only && !only(x, y) && !only(nx, ny)) continue;
      segs.push(`M${cx([x, y])},${cy([x, y])}L${cx([nx, ny])},${cy([nx, ny])}`);
    }
  }
  return segs.join('');
}
const roadSvg = (d: string, cls = '') => d ? `<path class="road-case ${cls}" d="${d}"/><path class="road ${cls}" d="${d}"/>` : '';

// 땅: 판마다 같으니 한 번만 만든다
let terrain = '';
export function terrainSvg() {
  if (terrain) return terrain;
  let h = '';
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const g = groundAt(x, y), fs = FILL[g], X = x * T, Y = y * T, r = hash(x, y);
    const fill = g === '~' && !nearLand(x, y) ? '#6290a2' : fs[Math.floor(r * fs.length)];
    h += `<rect x="${X}" y="${Y}" width="${T}" height="${T}" fill="${fill}"/>`;
    if (g === 'f') {
      // 나무 둘셋
      const n = 2 + Math.floor(hash(x, y, 1) * 2);
      for (let k = 0; k < n; k++) {
        const tx = X + 7 + hash(x, y, 2 + k) * (T - 14), ty = Y + 9 + hash(x, y, 7 + k) * (T - 16);
        h += `<path d="M${tx},${ty - 8}l6,11h-12z" fill="${k % 2 ? '#56723f' : '#4b6637'}"/><rect x="${tx - 1}" y="${ty + 3}" width="2" height="3" fill="#5a4630"/>`;
      }
    } else if (g === 'n') {
      h += `<path d="M${X + 6},${Y + 22}q${7 + r * 3},-${9 + r * 4} ${14 + r * 4},0" fill="none" stroke="#948f5f" stroke-width="2" stroke-linecap="round"/>`;
    } else if (g === '^') {
      const px = X + T / 2 + (r - 0.5) * 6, top = Y + 5 + hash(x, y, 3) * 4;
      h += `<path d="M${X + 3},${Y + T - 5}L${px},${top}L${X + T - 3},${Y + T - 5}z" fill="#8d8371"/><path d="M${px},${top}L${X + T - 3},${Y + T - 5}H${px + 3}z" fill="#776e5d"/>`;
      if (hash(x, y, 4) < 0.55) h += `<path d="M${px},${top}l-4.5,7l2.5,-1.5l2,2l2,-2l2.5,1.5z" fill="#efebe2"/>`;
    } else if (g === '~' && hash(x, y, 5) < 0.3) {
      h += `<path d="M${X + 7},${Y + 15}q3,-3 6,0t6,0" fill="none" stroke="#9cc0cd" stroke-width="1.4" stroke-linecap="round"/>`;
    }
  }
  // 칸 금 (타일 지도임이 보이게, 옅게)
  let grid = '';
  for (let x = 1; x < MAP_W; x++) grid += `M${x * T},0V${MAP_H * T}`;
  for (let y = 1; y < MAP_H; y++) grid += `M0,${y * T}H${MAP_W * T}`;
  h += `<path class="tile-grid" d="${grid}"/>`;
  // 물가: 물 칸이 땅에 닿는 변을 진하게
  let shore = '';
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (!wet(x, y)) continue;
    const X = x * T, Y = y * T;
    if (y > 0 && !wet(x, y - 1)) shore += `M${X},${Y}h${T}`;
    if (y < MAP_H - 1 && !wet(x, y + 1)) shore += `M${X},${Y + T}h${T}`;
    if (x > 0 && !wet(x - 1, y)) shore += `M${X},${Y}v${T}`;
    if (x < MAP_W - 1 && !wet(x + 1, y)) shore += `M${X + T},${Y}v${T}`;
  }
  h += `<path class="shore" d="${shore}"/>`;
  h += roadSvg(roadSegs((x, y) => isRoad(ROADS, x, y)));
  return terrain = h;
}

// 길드 조가 오가는 길(본부 → 미궁, 걷는 길). 그리기용 캐시
const paths = new Map<string, At[]>();
const pathOf = (a: At, b: At) => { const k = a.join() + '|' + b.join(); if (!paths.has(k)) paths.set(k, walkPath(ROADS, a, b)); return paths.get(k)!; };
const ptAt = (p: At[], t: number): [number, number] => {
  const f = Math.max(0, Math.min(1, t)) * (p.length - 1), i = Math.floor(f), k = f - i, a = p[i], b = p[Math.min(p.length - 1, i + 1)];
  return [cx(a) + (cx(b) - cx(a)) * k, cy(a) + (cy(b) - cy(a)) * k];
};

// 작은 건물: 집 · 성 · 관리국
const house = (x: number, y: number, s = 1, roof = '#8a4b36') =>
  `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-6" y="-3" width="12" height="9" fill="#efe6d2" stroke="#3b2a17" stroke-width="1"/><path d="M-8,-3L0,-10L8,-3z" fill="${roof}" stroke="#3b2a17" stroke-width="1" stroke-linejoin="round"/><rect x="-1.5" y="1" width="3" height="5" fill="#5a4630"/></g>`;
const keep = (x: number, y: number, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-9,8V-4h3v-3h3v3h6v-3h3v3h3V8z" fill="#d8ccb2" stroke="#3b2a17" stroke-width="1.1" stroke-linejoin="round"/><rect x="-2" y="2" width="4" height="6" fill="#5a4630"/></g>`;

export function mapHtml(W: World, ui: BuUi) {
  const sel = ui.sel ?? '';
  let h = '';
  // 외진 미궁의 발전도: 1단계에 관리국에서 오는 길과 길목 여관, 2단계에 곁 마을(지부를 낸 길드 깃발)
  W.dungeons.forEach((d, i) => {
    const st = d.wild > 0 ? devStage(d) : 0;
    if (st < 1) return;
    const road = devRoadOf(i), on = new Set(road.map(([x, y]) => y * MAP_W + x));
    const has = (x: number, y: number) => on.has(y * MAP_W + x) || isRoad(ROADS, x, y) || (x === d.at[0] && y === d.at[1]);
    h += `<g class="dev"><title>${d.name} 가는 길 (발전도 ${st}단계)</title>${roadSvg(roadSegs(has, (x, y) => on.has(y * MAP_W + x) || (x === d.at[0] && y === d.at[1])), 'new')}`;
    const inn = road[Math.floor(road.length / 2)];
    if (inn) h += `<g class="inn"><title>길목 여관</title>${house(cx(inn) + 9, cy(inn) - 6, 0.9, '#6b4f22')}<rect x="${cx(inn) + 2}" y="${cy(inn) - 1}" width="5" height="4" fill="#c7a14b" stroke="#3b2a17" stroke-width=".8"/></g>`;
    if (st >= 2) {
      // 곁 칸 가운데 물 · 길이 아닌 곳에 집 넷 (이름표가 놓이는 아래 칸은 뒤로)
      const spots = [[-1, 0], [1, 0], [-1, -1], [1, -1], [0, -1], [-1, 1], [1, 1]].map(([dx, dy]) => [d.at[0] + dx, d.at[1] + dy] as At)
        .filter(([x, y]) => !wet(x, y) && !on.has(y * MAP_W + x)).slice(0, 4);
      h += `<g class="town${d.branch ? ` f-${d.branch}` : ''}"><title>${d.name} 곁 마을${d.branch ? ` · ${nameOf(W, d.branch)} 지부` : ''}</title>`;
      spots.forEach((p, k) => { h += `<rect class="lot" x="${p[0] * T + 2}" y="${p[1] * T + 2}" width="${T - 4}" height="${T - 4}" rx="3"/>` + house(cx(p) + (k % 2 ? 5 : -5), cy(p) + 3, 0.95); });
      if (d.branch && spots[0]) { const p = spots[0]; h += `<path class="flag" transform="translate(${cx(p) + 6} ${cy(p) + 8}) scale(1.15)" d="M0,0V-24h13l-4,4.5l4,4.5h-13" style="fill:var(--gc)"/>`; }
      h += '</g>';
    }
    h += '</g>';
  });
  // 세력 사이: 험악하거나 우호적인 짝 · 협정을 맺은 짝만 본부 사이에 선을 긋는다
  const [wa, wb] = worstPair(W);
  FACS.forEach((a, i) => FACS.slice(i + 1).forEach(b => {
    const v = relOf(W, a, b), pact = isGuildId(a) && isGuildId(b) && W.pact && W.day < W.pact.until && W.pact.who.includes(a) && W.pact.who.includes(b);
    if (Math.abs(v) < 25 && !pact) return;
    h += `<path class="rel-line ${v < -5 ? 'neg' : v >= 25 ? 'pos' : ''}" d="M${cx(FAC_AT(a))},${cy(FAC_AT(a))}L${cx(FAC_AT(b))},${cy(FAC_AT(b))}" style="stroke-width:${1 + Math.abs(v) / 25}"/>`;
  }));
  {
    const v = relOf(W, wa, wb), A = FAC_AT(wa), Bb = FAC_AT(wb), pact = W.pact && W.day < W.pact.until && W.pact.who.includes(wa) && W.pact.who.includes(wb);
    if (v <= -25) h += label((cx(A) + cx(Bb)) / 2, (cy(A) + cy(Bb)) / 2 - 6, relWord(v) + (pact ? (pactK(W, wa, wb) > 0 ? ' · 협정' : ' · 협정 대기') : ''), 'rel');
  }
  // 길드 조: 본부에서 미궁까지 걷는 길 위에 든 조만큼 말을 놓고, 날마다 한 칸쯤 옮긴다(오가는 날에 맞춰)
  W.dungeons.forEach((d, i) => {
    GUILDS.forEach(g => {
      const n = d.teams[g];
      if (n < 0.3) return;
      const p = d.branch === g ? [d.at, d.at] as At[] : pathOf(B.GUILD[g].at, d.at);
      if (p.length < 2) return;
      const way = wayOf(W, g, i), k = Math.max(1, Math.min(6, Math.round(n)));
      h += `<g class="party f-${g}"><title>${nameOf(W, g)} ${n1(n)}조 → ${d.name} (본부에서 ${way}일)</title>`;
      h += `<path class="route" d="M${p.map(a => `${cx(a)},${cy(a)}`).join('L')}"/>`;
      for (let j = 0; j < k; j++) {
        // 오가는 길: 앞 절반은 가는 길, 뒤 절반은 오는 길. 하루에 1 / (2 × 오가는 날)만큼 돈다
        const t = ((j / k + W.day / (2 * way) + hash(i, GUILDS.indexOf(g)) ) % 1), there = t < 0.5, f = there ? t * 2 : 2 - t * 2;
        const [x, y] = ptAt(p, f);
        h += `<circle class="pawn${there ? '' : ' back'}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5"/>`;
      }
      h += '</g>';
    });
  });
  // 관리국 · 두 영주 성
  h += `<g class="place bureau"><rect class="lot" x="${BUREAU_AT[0] * T + 1}" y="${BUREAU_AT[1] * T + 1}" width="${T - 2}" height="${T - 2}" rx="3"/>${house(cx(BUREAU_AT), cy(BUREAU_AT) + 2, 1.35, '#27465f')}${label(cx(BUREAU_AT), cy(BUREAU_AT) + 30, '미궁관리국', 'strong')}</g>`;
  h += `<g class="place castle">${keep(cx(HAVEL_AT), cy(HAVEL_AT), 1.1)}${label(cx(HAVEL_AT), cy(HAVEL_AT) + 28, '하벨 자작령', 'small')}</g>`;
  // 세력 표식: 본부 칸에 집과 깃발(몸집만큼 크다). 로이드 백작령은 성
  for (const f of FACS) {
    const at = FAC_AT(f), x = cx(at), y = cy(at), on = sel === `fac:${f}`, g = isGuildId(f) ? W.guilds[f] : null;
    const k = g ? Math.min(1.8, 0.75 + g.size / 25) : 1;
    h += `<g class="mk fac-mk f-${f}${on ? ' on' : ''}" data-act="sel:fac:${f}" role="button" tabindex="0" aria-label="${nameOf(W, f)}${g ? ` ${n0(g.size)}조` : ''}">
      <rect class="hit lot" x="${at[0] * T + 1}" y="${at[1] * T + 1}" width="${T - 2}" height="${T - 2}" rx="3"/>
      ${f === 'lord' ? keep(x, y + 2, 1.25) : house(x - 4, y + 5, 1)}
      ${f === 'lord' ? '' : `<path class="flag" transform="translate(${x + 5} ${y + 9}) scale(${k})" d="M0,0V-24h13l-4,4.5l4,4.5h-13"/>`}
      ${label(x, y + T / 2 + 14, f === 'lord' ? '로이드 백작령' : W.guilds[f].name, on ? 'strong' : '')}
      ${g ? label(x, y + T / 2 + 27, `${n0(g.size)}조`, 'small') : ''}</g>`;
  }
  // 미궁 표식: 굴 입구, 둘레 고리가 보고된 수위
  W.dungeons.forEach((d, i) => {
    const x = cx(d.at), y = cy(d.at), lv = seenLevel(W, i), on = sel === `dg:${i}`, R = 19, C = 2 * Math.PI * R;
    h += `<g class="mk dg-mk ${levelCls(lv)}${on ? ' on' : ''}${lv >= B.DANGER ? ' hot' : ''}" data-act="sel:dg:${i}" role="button" tabindex="0" aria-label="${d.name} 수위 ${n0(lv)}">
      <circle class="disc" cx="${x}" cy="${y}" r="${R}"/>
      <circle class="ring" cx="${x}" cy="${y}" r="${R}" style="stroke-dasharray:${(C * Math.min(1, lv / 100)).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 ${x} ${y})"/>
      <path class="cave" d="M${x - 9},${y + 7}V${y - 1}a9,9 0 0 1 18,0V${y + 7}z"/>
      <text class="lv" x="${x}" y="${y + 5}" text-anchor="middle">${n0(lv)}</text>
      ${subAt(W, i) > 0 ? `<g class="coin"><circle cx="${x + 17}" cy="${y - 16}" r="8"/><text x="${x + 17}" y="${y - 12.5}" text-anchor="middle">${subAt(W, i)}</text></g>` : ''}
      ${label(x, y + R + 15, d.name, on ? 'strong' : '')}
      ${label(x, y + R + 28, `${levelWord(lv)} · ${n1(teamsIn(d))}조${d.floods ? ` · 범람 ${d.floods}` : ''}`, 'small')}</g>`;
  });
  return h;
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
