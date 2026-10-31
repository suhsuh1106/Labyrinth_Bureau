// 미궁관리국 관할 지도: 국장 책상에 펼친 먹선 지도(40 × 24칸 타일, src/bureau/tiles.ts). 관리국 · 미궁 셋 · 길드 본부 일곱 · 두 지방 성이 칸 자리에 선다.
// 땅과 처음부터 있는 길은 판마다 같아 한 번만 그리고(terrainSvg), 날마다 바뀌는 것은 그 위 층(mapHtml)에 그린다:
// 외진 미궁의 발전도(devPct: 길이 그어지고, 집이 길을 따라 한 채씩 늘고, 둘레 숲이 베여 밭이 되고, 목책이 두른다),
// 미궁 표식의 고리(보고된 수위), 세력 사이(본부 사이 선). 길드 조 · 본부 깃발 · 관리국은 지도 위에 선 미니어처(minisOf, 책상 장면이 세운다).
// 그리기만 하고 상태에 쓰지 않는다.
import { B, BUREAU_AT, HAVEL_AT, LOYD_AT, ROADS, devRoadOf, devStage, type Dungeon, type FacId, FACS, GUILDS, type World, wayOf, nameOf, pactK, relOf, seenLevel, subAt, teamsIn, worstPair } from '../../bureau/engine';
import { type At, MAP_H, MAP_W, groundAt, isRoad, walkPath } from '../../bureau/tiles';
import { type BuUi, dungeonHtml, facHtml, levelCls, levelWord, n0, n1, pactLine, relRow, relWord, relsTop } from './board';

// 칸 하나 = T (viewBox 단위). 지도 전체는 MAP_W·T × MAP_H·T
export const T = 32;
export const MAP_PX: [number, number] = [MAP_W * T, MAP_H * T];
const FAC_AT = (f: FacId): At => B.GUILD[f].at;
const cx = (a: At) => a[0] * T + T / 2, cy = (a: At) => a[1] * T + T / 2;
// 칸마다 같은 값을 내는 해시 (난수를 쓰지 않는다)
const hash = (x: number, y: number, k = 0) => { let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const label = (x: number, y: number, t: string, cls = '') => `<text class="lb ${cls}" x="${x}" y="${y}" text-anchor="middle">${t}</text>`;
const f1 = (v: number) => v.toFixed(1);

// 먹과 종이 (지도는 한 장의 그림이라 화면 밝기와 상관없이 같은 색)
const PAPER = '#e8dcc0', INK = '#3b2f22', SEP = '#7a5a3a', WASH = '#bfcac2', RED = '#a3392b';
const wet = (x: number, y: number) => groundAt(x, y) === '~';

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
// 칸 가운데를 잇는 부드러운 선 (길 · 조가 걷는 길)
const smooth = (p: [number, number][]) => {
  if (p.length < 2) return '';
  let d = `M${f1(p[0][0])},${f1(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] ?? p2;
    d += ` C${f1(p1[0] + (p2[0] - p0[0]) / 6)},${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)},${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])},${f1(p2[1])}`;
  }
  return d;
};
const centers = (p: At[], jit = 0, k = 0): [number, number][] => p.map(([x, y], i) => {
  const mid = i > 0 && i < p.length - 1 ? jit : 0;
  return [cx([x, y]) + (hash(x, y, 3 + k) - 0.5) * mid, cy([x, y]) + (hash(x, y, 5 + k) - 0.5) * mid];
});
// 경로를 일정한 걸음으로 나눈 점들 (자리 · 방향)
function sample(p: [number, number][], step: number) {
  const out: [number, number, number][] = [];
  let acc = 0;
  for (let i = 1; i < p.length; i++) {
    const [x1, y1] = p[i - 1], [x2, y2] = p[i], L = Math.hypot(x2 - x1, y2 - y1), a = Math.atan2(y2 - y1, x2 - x1);
    while (acc <= L) { out.push([x1 + (x2 - x1) * acc / L, y1 + (y2 - y1) * acc / L, a]); acc += step; }
    acc -= L;
  }
  return out;
}

// ── 그림 기호 ─────────────────────────────
const tree = (x: number, y: number, k: number) => `<path d="M${f1(x)},${f1(y + 6)}v-4" stroke="${INK}" stroke-width="1"/><circle cx="${f1(x)}" cy="${f1(y - 1)}" r="${f1(4.2 + k)}" fill="#d6cdaa" stroke="${INK}" stroke-width="1"/><path d="M${f1(x + 1.5)},${f1(y - 3.5)} a3,3 0 0 1 1.6,3.5" stroke="${INK}" stroke-width="0.6" fill="none"/>`;
const stump = (x: number, y: number) => `<ellipse cx="${f1(x)}" cy="${f1(y + 3)}" rx="2.4" ry="1.3" fill="${PAPER}" stroke="${SEP}" stroke-width="0.8"/>`;
const mount = (x: number, y: number, s: number, j: number) => {
  let h = `<path d="M${f1(x - s)},${f1(y + s * 0.55)} Q${f1(x - s * 0.35)},${f1(y - s * 0.15)} ${f1(x + j)},${f1(y - s * 0.9)} Q${f1(x + s * 0.45)},${f1(y - s * 0.15)} ${f1(x + s)},${f1(y + s * 0.55)} Z" fill="${PAPER}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`;
  for (let k = 1; k <= 4; k++) h += `<path d="M${f1(x + j + k * s * 0.17)},${f1(y - s * 0.85 + k * s * 0.28)} l${f1(s * 0.08)},${f1(s * 0.5)}" stroke="${INK}" stroke-width="0.8"/>`;
  return h;
};
// 위에서 본 집: 지붕 두 쪽, 길 방향으로 돈다
const roof = (x: number, y: number, a: number, w: number) => { const d = w * 0.6; return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${a.toFixed(0)})"><rect x="${f1(-w / 2)}" y="${f1(-d / 2)}" width="${f1(w)}" height="${f1(d / 2)}" fill="#e2c9a0" stroke="${INK}" stroke-width="1"/><rect x="${f1(-w / 2)}" y="0" width="${f1(w)}" height="${f1(d / 2)}" fill="#a98559" stroke="${INK}" stroke-width="1"/></g>`; };
// 밭 한 뙈기: 칸마다 하나, 결은 거의 같게 (조각보)
interface Field { id: string; x: number; y: number; a: number; crop: boolean; poly: [number, number][]; at: number }
const fieldSvg = (f: Field) => {
  const pts = f.poly.map(p => p.map(f1).join(',')).join(' ');
  let lines = '';
  for (let k = -24; k <= 24; k += 3.2) lines += `M${f1(f.x - 30)},${f1(f.y + k)}h60`;
  return `<clipPath id="fc-${f.id}"><polygon points="${pts}"/></clipPath><polygon points="${pts}" fill="${f.crop ? '#d9c99a' : '#cfd0a0'}" stroke="${SEP}" stroke-width="0.8"/><path clip-path="url(#fc-${f.id})" transform="rotate(${f.a.toFixed(0)} ${f1(f.x)} ${f1(f.y)})" d="${lines}" stroke="${SEP}" stroke-width="0.5" stroke-opacity="0.7"/>`;
};

// ── 외진 미궁 곁 마을: 자리는 판마다 같다 (칸 해시) ─────────────────────────────
// 발전도(조 × 날)를 0 ~ 100으로: 1단계(길)에 20, 2단계(마을)에 50, 그 뒤 천천히 100까지
export const devPct = (d: Dungeon) => {
  const [a, b] = B.DEV, v = d.dev;
  return v < a ? 20 * v / a : v < b ? 20 + 30 * (v - a) / (b - a) : Math.min(100, 50 + 50 * (v - b) / (b * 1.4));
};
interface Town { road: [number, number][]; vc: [number, number]; inn: [number, number]; houses: { x: number; y: number; a: number; w: number; at: number }[]; fields: Field[]; near: (x: number, y: number) => number }
const towns = new Map<number, Town>();
function townOf(i: number, d: Dungeon): Town {
  const had = towns.get(i);
  if (had) return had;
  const tiles = devRoadOf(i), full = [...tiles];
  // 새 길은 있는 길에서 갈라져 나온다: 갈림 칸 하나를 앞에 붙인다
  const first = tiles[0];
  if (first) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) if (isRoad(ROADS, first[0] + dx, first[1] + dy)) { full.unshift([first[0] + dx, first[1] + dy]); break; }
  const road = centers(full, 7, 9), pit: [number, number] = [cx(d.at), cy(d.at)];
  const dPit = (x: number, y: number) => Math.hypot(x - pit[0], y - pit[1]);
  // 마을 자리: 갱 입구에서 관리국 쪽 길을 따라 조금 나온 어귀
  const back = sample([...road].reverse(), 2), q = back.find(([x, y]) => dPit(x, y) >= 58) ?? back[back.length - 1] ?? [pit[0], pit[1], 0];
  const vc: [number, number] = [q[0], q[1]], dV = (x: number, y: number) => Math.hypot(x - vc[0], y - vc[1]);
  const okHouse = (x: number, y: number) => { const g = groundAt(Math.floor(x / T), Math.floor(y / T)); return (g === '.' || g === 'n') && dPit(x, y) > 24; };
  // 집 자리: 어귀에서 길을 따라 양옆으로 늘어서고, 그다음 둘레를 메운다
  const cand: { x: number; y: number; a: number; w: number; ord: number }[] = [];
  sample([...road].reverse(), 13).forEach(([x, y, a], k) => {
    const dd = dV(x, y);
    if (dd > 135) return;
    for (const side of [-1, 1]) {
      const off = 12 + hash(k, i, side + 5) * 4, hx = x + Math.cos(a + Math.PI / 2) * off * side, hy = y + Math.sin(a + Math.PI / 2) * off * side;
      if (okHouse(hx, hy)) cand.push({ x: hx, y: hy, a: a * 180 / Math.PI + (hash(k, i, 8) - 0.5) * 12, w: 11 + hash(k, i, side) * 5, ord: dd + hash(k, i, side + 9) * 14 });
    }
  });
  for (let k = 0; k < 160; k++) {
    const ang = hash(k, i, 31) * Math.PI * 2, rr = 16 + hash(k, i, 32) * 70, x = vc[0] + Math.cos(ang) * rr, y = vc[1] + Math.sin(ang) * rr * 0.8;
    if (okHouse(x, y)) cand.push({ x, y, a: (hash(k, i, 33) - 0.5) * 40 - 20, w: 10 + hash(k, i, 34) * 4, ord: dV(x, y) * 1.4 + 18 });
  }
  cand.sort((a, b) => a.ord - b.ord);
  const houses: Town['houses'] = [];
  for (const c of cand) {
    if (houses.length >= 34) break;
    if (dV(c.x, c.y) < 12 || houses.some(h => Math.hypot(h.x - c.x, h.y - c.y) < 15)) continue;
    houses.push({ ...c, at: 0 });
  }
  houses.forEach((h, k) => h.at = 28 + k * (62 / houses.length));
  // 밭: 마을 둘레의 들 · 베어낸 숲
  const fields: Field[] = [], vt = [Math.floor(vc[0] / T), Math.floor(vc[1] / T)], onRoad = new Set(full.map(([x, y]) => y * MAP_W + x));
  const near = (x: number, y: number) => Math.hypot(x - vt[0], (y - vt[1]) * 1.15);
  for (let y = vt[1] - 5; y <= vt[1] + 5; y++) for (let x = vt[0] - 6; x <= vt[0] + 6; x++) {
    const g = groundAt(x, y);
    if ((g !== '.' && g !== 'f') || onRoad.has(y * MAP_W + x) || isRoad(ROADS, x, y)) continue;
    const dd = near(x, y);
    if (dd < 1.6 || dd > 4.8) continue;
    const j = (k: number) => (hash(x, y, 80 + k) - 0.5) * 6, X = x * T, Y = y * T;
    fields.push({ id: `${i}-${x}-${y}`, x: X + 16, y: Y + 16, a: 14 + (hash(x, y, 59) - 0.5) * 14, crop: hash(x, y, 63) > 0.45,
      poly: [[X + 1 + j(1), Y + 1 + j(2)], [X + T - 1 + j(3), Y + 1 + j(4)], [X + T - 1 + j(5), Y + T - 1 + j(6)], [X + 1 + j(7), Y + T - 1 + j(8)]],
      at: 34 + dd * 10 + hash(x, y, 61) * 6 + (g === 'f' ? 4 : 0) });
  }
  const inn = road[Math.floor(road.length / 2)] ?? vc;
  const t: Town = { road, vc, inn, houses, fields, near };
  towns.set(i, t);
  return t;
}
// 숲 칸이 마을 둘레인지 (그 나무는 땅에 그리지 않고 마을 층이 베어 낸다)
let townTrees: Map<number, number> | null = null;
function cutTrees(W: World) {
  if (townTrees) return townTrees;
  townTrees = new Map();
  W.dungeons.forEach((d, i) => {
    if (d.wild <= 0) return;
    const t = townOf(i, d);
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (groundAt(x, y) === 'f' && t.near(x, y) < 5) townTrees!.set(y * MAP_W + x, i);
  });
  return townTrees;
}
const treesOf = (x: number, y: number) => [0, 1, 2].map(k => ({ x: x * T + 6 + hash(x, y, 20 + k) * 20, y: y * T + 8 + hash(x, y, 30 + k) * 18, s: hash(x, y, 40 + k) * 1.5, k }));

// ── 땅: 판마다 같으니 한 번만 만든다 ─────────────────────────────
let terrain = '';
export function terrainSvg(W: World) {
  if (terrain) return terrain;
  const cut = cutTrees(W);
  const goo = (id: string, erode = 0) => `<filter id="t-${id}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="8" result="b"/><feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="1" seed="7" result="n"/><feDisplacementMap in="b" in2="n" scale="26" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="2"/><feComponentTransfer><feFuncA type="linear" slope="18" intercept="-8"/></feComponentTransfer>${erode ? `<feMorphology operator="erode" radius="${erode}"/>` : ''}</filter>`;
  // 바깥 물 칸은 지도 밖으로 늘려 흐림이 가장자리에서 끊기지 않게
  const water = (fill: string) => {
    let s = '';
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      if (!wet(x, y)) continue;
      const e = 64, X = x * T - (x === 0 ? e : 0), Y = y * T - (y === 0 ? e : 0), w = T + (x === 0 || x === MAP_W - 1 ? e : 0) + 0.5, h = T + (y === 0 || y === MAP_H - 1 ? e : 0) + 0.5;
      s += `<rect x="${X}" y="${Y}" width="${w}" height="${h}" fill="${fill}"/>`;
    }
    return s;
  };
  let h = `<defs>${goo('g')}${goo('g1', 1.6)}${goo('g2', 7)}${goo('g3', 8.4)}${goo('g4', 14)}${goo('g5', 15.2)}
    <filter id="t-paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0.42  0 0 0 0 0.33  0 0 0 0 0.2  0 0 0 0.16 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
    <radialGradient id="t-vig" cx="50%" cy="50%" r="72%"><stop offset="62%" stop-color="#6b4f2a" stop-opacity="0"/><stop offset="100%" stop-color="#6b4f2a" stop-opacity="0.32"/></radialGradient></defs>`;
  h += `<rect width="${MAP_PX[0]}" height="${MAP_PX[1]}" fill="${PAPER}"/><rect width="${MAP_PX[0]}" height="${MAP_PX[1]}" fill="#000" filter="url(#t-paper)"/>`;
  // 물: 먹 해안선과 바다 쪽 물결선 두 겹
  h += `<g filter="url(#t-g)">${water(INK)}</g><g filter="url(#t-g1)">${water(WASH)}</g><g filter="url(#t-g2)" opacity="0.55">${water(SEP)}</g><g filter="url(#t-g3)">${water(WASH)}</g><g filter="url(#t-g4)" opacity="0.35">${water(SEP)}</g><g filter="url(#t-g5)">${water(WASH)}</g>`;
  // 기호: 아래쪽이 앞에 오도록 y 순서로
  const gl: [number, string][] = [];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const g = groundAt(x, y), X = x * T, Y = y * T;
    if (g === '.' && hash(x, y, 11) < 0.12) { const px = X + 8 + hash(x, y, 12) * 16, py = Y + 12 + hash(x, y, 13) * 12; h += `<path d="M${f1(px)},${f1(py)}l-2,-4M${f1(px + 3)},${f1(py)}l0,-5M${f1(px + 6)},${f1(py)}l2,-4" stroke="${SEP}" stroke-width="0.8" opacity="0.7"/>`; }
    else if (g === 'n') gl.push([Y + 18, `<path d="M${f1(X + 5 + hash(x, y, 1) * 4)},${Y + 22} Q${X + 16},${f1(Y + 6 + hash(x, y, 2) * 4)} ${X + 27},${Y + 22}" fill="${PAPER}" stroke="${INK}" stroke-width="1.1"/><path d="M${X + 18},${Y + 13} q4,3 5,8" stroke="${INK}" stroke-width="0.6" fill="none"/>`]);
    else if (g === '^') gl.push([Y + 22, mount(X + 16 + (hash(x, y, 1) - 0.5) * 8, Y + 17 + (hash(x, y, 2) - 0.5) * 6, 14 + hash(x, y, 3) * 6, (hash(x, y, 4) - 0.5) * 6)]);
    else if (g === 'f' && !cut.has(y * MAP_W + x)) for (const t of treesOf(x, y)) gl.push([t.y, tree(t.x, t.y, t.s)]);
  }
  gl.sort((a, b) => a[0] - b[0]).forEach(([, s]) => h += s);
  h += `<path class="road" d="${roadSegs((x, y) => isRoad(ROADS, x, y))}"/>`;
  h += label(cx(LOYD_AT), cy(LOYD_AT) + 52, '로 이 드', 'rg') + label(cx(HAVEL_AT) - 30, cy(HAVEL_AT) - 34, '하 벨', 'rg') + label(28 * T, 1.5 * T, '검 은 숲', 'rg');
  h += `<rect width="${MAP_PX[0]}" height="${MAP_PX[1]}" fill="url(#t-vig)" pointer-events="none"/><rect x="1" y="1" width="${MAP_PX[0] - 2}" height="${MAP_PX[1] - 2}" fill="none" stroke="${INK}" stroke-width="2"/>`;
  return terrain = h;
}

// 외진 미궁 곁 마을의 지금 모습
function townSvg(W: World, i: number, d: Dungeon) {
  const p = devPct(d), st = devStage(d), t = townOf(i, d), cut = cutTrees(W);
  const items: [number, string][] = [];
  // 마을 둘레 숲: 발전도가 오르면 가까운 것부터 베인다
  for (const [k, di] of cut) {
    if (di !== i) continue;
    const x = k % MAP_W, y = Math.floor(k / MAP_W), when = 36 + t.near(x, y) * 10;
    for (const tr of treesOf(x, y)) items.push([tr.y, p < when + hash(x, y, 70 + tr.k) * 6 ? tree(tr.x, tr.y, tr.s) : stump(tr.x, tr.y)]);
  }
  let h = '';
  for (const f of t.fields) if (p >= f.at) h += fieldSvg(f);
  if (st < 1) return h + items.sort((a, b) => a[0] - b[0]).map(x => x[1]).join('');
  // 1단계: 관리국에서 길이 그어진다 (자랄수록 굵게, 85부터 겹선 대로)
  const rd = smooth(t.road);
  h += `<g class="dev"><title>${d.name} 가는 길 (발전도 ${st}단계)</title>`;
  h += p >= 85 ? `<path d="${rd}" stroke="${INK}" stroke-width="4.6" fill="none" stroke-linecap="round"/><path d="${rd}" stroke="${PAPER}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
    : `<path class="road-new" d="${rd}" stroke="${SEP}" stroke-width="${f1(1.4 + Math.min(1, (p - 20) / 60) * 1.4)}" fill="none" stroke-linecap="round"/>`;
  const [ix, iy] = t.inn;
  h += `<g class="inn"><title>길목 여관</title>${roof(ix, iy, -10, 12)}<path d="M${f1(ix + 7)},${f1(iy - 7)} h5 v6" stroke="${INK}" stroke-width="0.9" fill="none"/><rect x="${f1(ix + 9.5)}" y="${f1(iy - 2)}" width="5" height="4" fill="${SEP}"/></g>`;
  // 갱 입구: 버팀목 · 버력 더미
  const [px, py] = [cx(d.at), cy(d.at)];
  if (p >= 28) h += `<path d="M${px - 13},${py + 9} v-9 M${px + 13},${py + 9} v-9 M${px - 15},${py - 1} h30" stroke="${INK}" stroke-width="1.6"/>`;
  if (p >= 40) h += `<path d="M${px + 16},${py + 12} q8,-12 18,0 z" fill="#d2c29c" stroke="${INK}" stroke-width="0.9"/>`;
  // 집: 길을 따라 한 채씩
  const up = t.houses.filter(x => p >= x.at);
  up.forEach(x => items.push([x.y, roof(x.x, x.y, x.a, x.w)]));
  if (p >= 45) up.slice(0, 18).filter((_, k) => k % 5 === 1).forEach((x, k) => items.push([x.y + 0.1, `<path class="smoke" style="animation-delay:${(k * 0.9).toFixed(1)}s" d="M${f1(x.x)},${f1(x.y - 5)} q-3,-4 0,-7 q3,-3 0,-7" stroke="${SEP}" stroke-width="0.9" fill="none" stroke-linecap="round"/>`]));
  h += items.sort((a, b) => a[0] - b[0]).map(x => x[1]).join('');
  const [vx, vy] = t.vc;
  if (st >= 2) {
    // 2단계: 곁 마을 · 광장 · 지부 (가장 많이 다닌 길드)
    h += `<g class="town${d.branch ? ` f-${d.branch}` : ''}"><title>${d.name} 곁 마을${d.branch ? ` · ${nameOf(W, d.branch)} 지부` : ''}</title>`;
    h += `<ellipse cx="${f1(vx)}" cy="${f1(vy)}" rx="13" ry="9" fill="${PAPER}" stroke="${SEP}" stroke-width="0.8" stroke-dasharray="2 2"/><circle cx="${f1(vx)}" cy="${f1(vy)}" r="2.6" fill="${PAPER}" stroke="${INK}" stroke-width="1"/>`;
    const big = t.houses[Math.min(t.houses.length - 1, 3)];
    if (d.branch && big) h += roof(big.x + 4, big.y - 12, big.a, 17) + `<path d="M${f1(big.x + 4)},${f1(big.y - 16)} v-18" stroke="${INK}" stroke-width="1.1"/><path class="flag" d="M${f1(big.x + 4)},${f1(big.y - 34)} q8,-3 14,1 q-6,4 -14,7 z" style="fill:var(--gc)" stroke="${INK}" stroke-width="0.7"/>`;
    h += '</g>';
  }
  // 목책 (85부터): 지은 집들을 두른다
  if (p >= 85 && up.length) {
    const ring: [number, number][] = [];
    for (let k = 0; k < 28; k++) {
      const a = k / 28 * Math.PI * 2;
      let r = 0;
      for (const x of up) { const dx = x.x - vx, dy = x.y - vy, diff = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - a), Math.cos(Math.atan2(dy, dx) - a))); if (diff < 0.4) r = Math.max(r, Math.hypot(dx, dy)); }
      r = Math.max(30, r + 12);
      ring.push([vx + Math.cos(a) * r, vy + Math.sin(a) * r]);
    }
    h += `<path d="${smooth([...ring, ring[0], ring[1]])}" stroke="${INK}" stroke-width="1.6" stroke-dasharray="1.5 2.2" fill="none"/>`;
  }
  // 이름: 어귀 → 촌 → 마을 (자랄수록 글자가 크다)
  const nm = p >= 80 ? [`${d.name} 마을`, 't3'] : p >= 50 ? [`${d.name}촌`, 't2'] : p >= 30 ? [`${d.name} 어귀`, 't1'] : null;
  if (nm) h += label(vx + 6, vy - 40, nm[0], nm[1]);
  return h + '</g>';
}

// 길드 조가 오가는 길(본부 → 미궁, 걷는 길). 그리기용 캐시
const paths = new Map<string, At[]>();
const pathOf = (a: At, b: At) => { const k = a.join() + '|' + b.join(); if (!paths.has(k)) paths.set(k, walkPath(ROADS, a, b)); return paths.get(k)!; };
const ptAt = (p: [number, number][], t: number): [number, number, number] => {
  const f = Math.max(0, Math.min(1, t)) * (p.length - 1), i = Math.floor(f), k = f - i, a = p[i], b = p[Math.min(p.length - 1, i + 1)];
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, Math.atan2(b[1] - a[1], b[0] - a[0])];
};

export function mapHtml(W: World, ui: BuUi) {
  const sel = ui.sel ?? '';
  let h = '';
  // 외진 미궁의 발전도
  W.dungeons.forEach((d, i) => { if (d.wild > 0) h += townSvg(W, i, d); });
  // 세력 사이: 험악하거나 우호적인 짝 · 협정을 맺은 짝만 본부 사이에 선을 긋는다
  const [wa, wb] = worstPair(W);
  FACS.forEach((a, i) => FACS.slice(i + 1).forEach(b => {
    const v = relOf(W, a, b), pact = W.pact && W.day < W.pact.until && W.pact.who.includes(a) && W.pact.who.includes(b);
    if (Math.abs(v) < 25 && !pact) return;
    h += `<path class="rel-line ${v < -5 ? 'neg' : v >= 25 ? 'pos' : ''}" d="M${cx(FAC_AT(a))},${cy(FAC_AT(a))}L${cx(FAC_AT(b))},${cy(FAC_AT(b))}" style="stroke-width:${1 + Math.abs(v) / 25}"/>`;
  }));
  {
    const v = relOf(W, wa, wb), A = FAC_AT(wa), Bb = FAC_AT(wb), pact = W.pact && W.day < W.pact.until && W.pact.who.includes(wa) && W.pact.who.includes(wb);
    if (v <= -25) h += label((cx(A) + cx(Bb)) / 2, (cy(A) + cy(Bb)) / 2 - 6, relWord(v) + (pact ? (pactK(W, wa, wb) > 0 ? ' · 협정' : ' · 협정 대기') : ''), 'rel');
  }
  // 길드 조가 걷는 길: 먹 점선 (말은 minisOf가 세운다)
  W.dungeons.forEach((d, i) => GUILDS.forEach(g => {
    if (d.teams[g] < 0.3 || d.branch === g) return;
    const p = pathOf(B.GUILD[g].at, d.at);
    if (p.length >= 2) h += `<path class="route f-${g}" d="${smooth(centers(p))}"><title>${nameOf(W, g)} ${n1(d.teams[g])}조 → ${d.name} (본부에서 ${wayOf(W, g, i)}일)</title></path>`;
  }));
  // 두 지방 성 (중앙 직할 지방의 징세소. 세력이 아니라 표식만)
  for (const [at, nm] of [[HAVEL_AT, '하벨 성'], [LOYD_AT, '로이드 성']] as [At, string][]) {
    const x = cx(at), y = cy(at);
    h += `<g class="place castle"><path d="M${x - 8},${y + 8} v-12 h3 v-3 h3 v3 h4 v-3 h3 v3 h3 v12 z" fill="${PAPER}" stroke="${INK}" stroke-width="1.2"/><path d="M${x - 2},${y + 8} v-5 a2,2 0 0 1 4,0 v5" fill="${INK}"/>${label(x, y + 24, nm, 'small')}</g>`;
  }
  h += `<g class="place bureau">${label(cx(BUREAU_AT), cy(BUREAU_AT) + 30, '미궁관리국', 'strong')}</g>`;
  // 길드 본부: 칸 자리(누르는 곳)와 이름. 천막 · 깃발은 미니어처
  for (const f of FACS) {
    const at = FAC_AT(f), x = cx(at), y = cy(at), on = sel === `fac:${f}`, g = W.guilds[f];
    h += `<g class="mk fac-mk f-${f}${on ? ' on' : ''}" data-act="sel:fac:${f}" role="button" tabindex="0" aria-label="${nameOf(W, f)} ${n0(g.size)}조">
      <rect class="hit" x="${at[0] * T - 6}" y="${at[1] * T - 20}" width="${T + 12}" height="${T + 26}" rx="4"/>
      ${label(x, y + T / 2 + 14, g.name, on ? 'strong' : '')}
      ${label(x, y + T / 2 + 27, `${n0(g.size)}조`, 'small')}</g>`;
  }
  // 미궁 표식: 먹으로 그린 굴 입구, 둘레 고리가 보고된 수위
  W.dungeons.forEach((d, i) => {
    const x = cx(d.at), y = cy(d.at), lv = seenLevel(W, i), on = sel === `dg:${i}`, R = 20, C = 2 * Math.PI * R;
    h += `<g class="mk dg-mk ${levelCls(lv)}${on ? ' on' : ''}${lv >= B.DANGER ? ' hot' : ''}" data-act="sel:dg:${i}" role="button" tabindex="0" aria-label="${d.name} 수위 ${n0(lv)}">
      <circle class="disc" cx="${x}" cy="${y}" r="${R}"/>
      <circle class="ring" cx="${x}" cy="${y}" r="${R}" style="stroke-dasharray:${(C * Math.min(1, lv / 100)).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 ${x} ${y})"/>
      <path class="cave" d="M${x - 11},${y + 8}v-6a11,10 0 0 1 22,0v6z"/>
      <text class="lv" x="${x}" y="${y + 5}" text-anchor="middle">${n0(lv)}</text>
      ${subAt(W, i) > 0 ? `<g class="coin"><circle cx="${x + 18}" cy="${y - 17}" r="8"/><text x="${x + 18}" y="${y - 13.5}" text-anchor="middle">${subAt(W, i)}</text></g>` : ''}
      ${label(x, y + R + 15, d.name, on ? 'strong' : '')}
      ${label(x, y + R + 28, `${levelWord(lv)} · ${n1(teamsIn(d))}조${d.floods ? ` · 범람 ${d.floods}` : ''}`, 'small')}</g>`;
  });
  return h;
}

// ── 지도 위에 선 미니어처: 길드 조(본부 ↔ 미궁 길 위, 날마다 걸음을 옮긴다) · 본부 천막과 깃발 · 관리국 청사 ─────────────
// 자리(지도 단위)와 그림만 내고, 세우는 일(각도 · 옮겨 가는 연출)은 책상 장면(desk.ts)이 한다. key가 같으면 같은 말이다
export interface Mini { key: string; x: number; y: number; w: number; h: number; svg: string; face?: -1 | 1; title: string; walk?: boolean }
const dark = (c: string) => `color-mix(in srgb, ${c} 70%, #000)`, light = (c: string) => `color-mix(in srgb, ${c} 55%, #fff)`;
const BASE = (r: number) => `<ellipse cx="0" cy="0" rx="${r}" ry="${f1(r * 0.32)}" fill="#2a2420"/><path d="M${-r},0 v-3 a${r},${f1(r * 0.32)} 0 0 1 ${2 * r},0 v3 a${r},${f1(r * 0.32)} 0 0 1 ${-2 * r},0" fill="#4a4038"/><ellipse cx="0" cy="-3" rx="${r}" ry="${f1(r * 0.32)}" fill="#6d7a4a"/>`;
const ART = {
  // 조: 망토 두른 모험가 둘, 하나는 길드 깃대
  team: (c: string, load = false) => `${BASE(12)}<path d="M-9,-4 q-1,-12 3,-20 q3,-3 6,0 q4,8 2,20 z" fill="${dark(c)}" stroke="#1d1712" stroke-width="0.8"/><circle cx="-3" cy="-27" r="3.6" fill="#e2b98f" stroke="#1d1712" stroke-width="0.7"/><path d="M-7,-27 q4,-7 8,0 q-4,-2 -8,0" fill="${dark(c)}"/><path d="M1,-4 q0,-14 3,-19 q3,-3 6,0 q3,6 1,19 z" fill="#7b6c5a" stroke="#1d1712" stroke-width="0.8"/><circle cx="6.5" cy="-26" r="3.4" fill="#d9ad84" stroke="#1d1712" stroke-width="0.7"/><path d="M3,-26 q3,-6 7,0 z" fill="#8a8a8a" stroke="#1d1712" stroke-width="0.5"/><path d="M-10,-6 V-44" stroke="#3a2a1a" stroke-width="1.4"/><path d="M-10,-44 h13 l-3,4 l3,4 h-13 z" fill="${c}" stroke="#1d1712" stroke-width="0.7"/><path d="M-10,-44 h13" stroke="${light(c)}" stroke-width="1"/><path d="M11,-12 l4,-14" stroke="#9aa0a6" stroke-width="1.2"/>${load ? `<path d="M5,-22 q7,-3 9,4 q1,7 -5,8 q-6,0 -4,-12 z" fill="#b0915e" stroke="#1d1712" stroke-width="0.7"/><path d="M7,-20 l5,9" stroke="#6d5432" stroke-width="0.6"/>` : ''}`,
  // 짐수레: 돌아오는 길에 짐을 실은 수레와 노새
  cart: (c: string) => `${BASE(16)}<path d="M-16,-9 h20 v-9 h-20 z" fill="#8a6a3e" stroke="#1d1712" stroke-width="0.8"/><path d="M-15,-18 q5,-7 9,-1 q4,-6 9,1 z" fill="#c9b07a" stroke="#1d1712" stroke-width="0.7"/><circle cx="-10" cy="-5" r="4.5" fill="none" stroke="#1d1712" stroke-width="1.2"/><circle cx="-1" cy="-5" r="4.5" fill="none" stroke="#1d1712" stroke-width="1.2"/><path d="M4,-12 h6" stroke="#3a2a1a" stroke-width="1.2"/><path d="M9,-7 l1,-8 q1,-4 6,-4 l3,-4 l1,4 q1,3 -2,4 l0,8 M11,-7 v-1 M17,-7 v-1" fill="#7a6656" stroke="#1d1712" stroke-width="0.8"/><path d="M-16,-18 v-6 h3 l2,2 h-5" fill="${c}" stroke="#1d1712" stroke-width="0.5"/>`,
  // 본부: 천막과 큰 깃발, 몸집만큼 크다
  hq: (c: string, k: number) => `${BASE(16)}<path d="M-13,-3 L-3,-22 L7,-3 z" fill="#d8cdb0" stroke="#1d1712" stroke-width="0.8"/><path d="M-3,-22 L-3,-3" stroke="#1d1712" stroke-width="0.6"/><path d="M-5,-3 l2,-7 l2,7" fill="#3a2a1a"/><path d="M10,-3 V${f1(-30 - k * 14)}" stroke="#3a2a1a" stroke-width="1.8"/><path d="M10,${f1(-30 - k * 14)} h${f1(16 + k * 6)} q-3,${f1(5 + k)} 0,${f1(10 + k * 2)} h${f1(-16 - k * 6)} z" fill="${c}" stroke="#1d1712" stroke-width="0.8"/><path d="M10,${f1(-30 - k * 14)} h${f1(16 + k * 6)}" stroke="${light(c)}" stroke-width="1.2"/><circle cx="10" cy="${f1(-31 - k * 14)}" r="1.8" fill="#c9a64a"/>`,
  // 관리국: 작은 청사 모형
  bureau: () => `${BASE(20)}<rect x="-15" y="-22" width="30" height="19" fill="#d9d2c2" stroke="#1d1712" stroke-width="0.9"/><path d="M-18,-22 L0,-34 L18,-22 z" fill="#6c2b23" stroke="#1d1712" stroke-width="0.9"/><rect x="-3" y="-44" width="6" height="12" fill="#d9d2c2" stroke="#1d1712" stroke-width="0.8"/><path d="M-4,-44 L0,-50 L4,-44 z" fill="#6c2b23" stroke="#1d1712" stroke-width="0.7"/>${[-11, -5, 5, 11].map(x => `<rect x="${x - 1.5}" y="-17" width="3" height="5" fill="#3b3a44"/>`).join('')}<rect x="-2.5" y="-11" width="5" height="8" fill="#4a3220"/>`,
};
const GC = (g: string) => `var(--g-${g})`;
// f: 오늘 안에서 흐른 몫(0 ~ 1). 화면이 날을 넘기지 않아도 조가 제 걸음 비율대로 조금씩 걷게 한다(판의 수치는 날마다 바뀐다)
export function minisOf(W: World, f = 0): Mini[] {
  const out: Mini[] = [{ key: 'bureau', x: cx(BUREAU_AT), y: cy(BUREAU_AT) + 4, w: 46, h: 56, svg: ART.bureau(), title: '미궁관리국' }];
  for (const g of GUILDS) {
    const k = Math.min(1.4, W.guilds[g].size / 10);
    out.push({ key: `hq-${g}`, x: cx(B.GUILD[g].at) - 6, y: cy(B.GUILD[g].at) + 4, w: 60, h: f1n(54 + k * 14), svg: ART.hq(GC(g), k), title: `${nameOf(W, g)} 본부 · ${n0(W.guilds[g].size)}조` });
  }
  // 조: 든 조만큼(여섯까지) 걷는 길 위에. 오가는 길의 앞 절반은 가는 길, 뒤 절반은 오는 길. 하루에 1 / (2 × 오가는 날)만큼 돈다
  W.dungeons.forEach((d, i) => GUILDS.forEach((g, gi) => {
    const n = d.teams[g];
    if (n < 0.3) return;
    const p = d.branch === g ? [d.at, d.at] as At[] : pathOf(B.GUILD[g].at, d.at);
    if (p.length < 2) return;
    const way = wayOf(W, g, i), k = Math.max(1, Math.min(6, Math.round(n))), c = centers(p);
    for (let j = 0; j < k; j++) {
      const t = (j / k + (W.day + f) / (2 * way) + hash(i, gi)) % 1, there = t < 0.5, [x, y, a] = ptAt(c, there ? t * 2 : 2 - t * 2);
      const dx = Math.cos(a) * (there ? 1 : -1);
      // 돌아오는 조는 짐을 지고, 셋 이상 든 길드는 그중 하나가 짐수레를 끈다
      const cart = !there && k >= 3 && j === 0;
      out.push({ key: `t-${i}-${g}-${j}`, x, y: y + 3, w: cart ? 44 : 34, h: 50, svg: cart ? ART.cart(GC(g)) : ART.team(GC(g), !there), face: dx < 0 ? -1 : 1, walk: true, title: `${nameOf(W, g)} 조 → ${d.name}${there ? '' : ' (돌아오는 길 · 짐)'}` });
    }
  }));
  return out;
}
const f1n = (v: number) => Math.round(v * 10) / 10;

// 살펴보기 탭: 지도에서 고른 것, 아니면 관할 요약
export function lookHtml(W: World, ui: BuUi) {
  const [k, v] = (ui.sel ?? '').split(':');
  const back = `<button type="button" class="link" data-act="sel:">← 관할 요약</button>`;
  if (k === 'dg') return back + dungeonHtml(W, +v);
  if (k === 'fac') {
    const f = v as FacId, others = FACS.filter(x => x !== f);
    return back + facHtml(W, f) + `<section class="rels">${others.map(o => relRow(W, f, o)).join('')}${pactLine(W)}</section>`;
  }
  return `<p class="note">지도에서 미궁이나 깃발을 누르면 자세히 본다.</p>
  <div class="sum">${W.dungeons.map((d, i) => { const lv = seenLevel(W, i); return `<button type="button" class="sum-row ${levelCls(lv)}" data-act="sel:dg:${i}"><b>${d.name}</b><span class="num">${n0(lv)}</span><span class="tag">${levelWord(lv)}</span><small class="num">${n1(teamsIn(d))}조 · 보조금 ${subAt(W, i)}G</small></button>`; }).join('')}</div>
  <button type="button" class="link" data-act="read:-1">관할 길드 현황 (기록실 보고)</button>
  <section class="rels"><h2>세력 사이 <small>나쁜 짝부터</small></h2>${relsTop(W)}${pactLine(W)}</section>`;
}
