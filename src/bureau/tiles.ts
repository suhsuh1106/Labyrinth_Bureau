// 관할 지도의 타일: 40 × 24칸, 판마다 같다. 길드 본부 · 미궁 · 관리국은 칸 자리(at)에 서고,
// 오가는 날(wayOf) · 공고가 닿는 날(hqOf)은 그 사이를 걷는 값(지형마다 걸음, 길은 싸고 물은 다리로만)으로 셈한다.
// 길은 처음부터 있는 길(engine.ts의 ROADS)을 판을 열 때 놓고, 외진 미궁의 발전도가 오르면 관리국에서 그 미궁까지 새 길이 놓인다(engine.ts의 devRoadOf).
// 엔진이 import하므로 DOM을 쓰지 않는다.
export type At = [number, number];
export const MAP_W = 40, MAP_H = 24;
// . 들 · f 숲 · n 언덕 · ^ 산 · ~ 물
export const GRID: string[] = [
  '~~~......^.^^^^.^.^^^^^...........~~~~~~',
  '~~~.......^^^^.^^........fffff.f..~~~~~~',
  '........n^^^^^^^^.......ffffffff........',
  '......nnnnn^^^^......~..ffffffff......~~',
  '..ff.nnnnnn.^^^......~..ffffffff......~~',
  '.ffff.nnnnn.^^^......~...fffff........~~',
  '..ff...nnn..^^n......~.............n.~~~',
  '............^^nn.....~..nnn.......nnn~~~',
  '~~...........nn^.....~.nnnnn....^^nnn~~~',
  '~~......fff..^^^.....~.nnnnn....^^nnn.~~',
  '~~...fffffff.^^^^..~~~~~.........~~...~~',
  '~~~.fffffffff.^^^.~~~~~~~........~~...~~',
  '~~~..fffffff..^^^.~~^~~~~......n......~~',
  '~~~....f.ff...^^^.~~~~~~~...nnnnnn......',
  '~~~............^^...~~~~~...nnnnfffn....',
  '~~~............^^........~..nnnnfffn..~~',
  '~~..............^^........~nnnnnfff...~~',
  '~~.............ffff........~.nnnnnn...~~',
  '....nnn.......ffffff.......~..........~~',
  '...nnnnn.......ffff.........~......ff~~~',
  '....nnn.....................~.....fff~~~',
  '..............~~~~~~~~~~~....~.....ff~~~',
  '...........~~~~~~~~~~~~~~~~..~.~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
];
export type Ground = '.' | 'f' | 'n' | '^' | '~';
export const groundAt = (x: number, y: number) => (GRID[y]?.[x] ?? '~') as Ground;
// 한 칸 걷는 값. 길 위는 땅과 상관없이 ROAD
export const STEP: Record<Ground, number> = { '.': 1, f: 1.6, n: 1.8, '^': 3.2, '~': Infinity };
export const ROAD = 0.55;
// 길을 낼 때: 물에는 다리를 놓되 비싸게, 산은 피한다
const LAY: Record<Ground, number> = { '.': 1, f: 1.5, n: 1.8, '^': 4, '~': 7 };

const idx = (x: number, y: number) => y * MAP_W + x;
const N8: At[] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// 가장 싼 길(대각선은 √2배). cost(칸) 가 Infinity면 못 지난다. 끝 칸들의 값은 반씩만 친다(본부 · 미궁 칸은 길 위)
function cheapest(a: At, b: At, cost: (i: number) => number) {
  const n = MAP_W * MAP_H, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  const s = idx(a[0], a[1]), t = idx(b[0], b[1]);
  dist[s] = 0;
  // 칸이 960개라 단순한 선형 탐색으로 충분하다
  for (;;) {
    let u = -1, best = Infinity;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u < 0 || u === t) break;
    done[u] = 1;
    const ux = u % MAP_W, uy = (u / MAP_W) | 0;
    for (const [dx, dy] of N8) {
      const x = ux + dx, y = uy + dy;
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
      const v = idx(x, y), c = v === t ? 0.5 : cost(v);
      if (!isFinite(c)) continue;
      const w = ((u === s ? 0.5 : cost(u)) + c) / 2 * (dx && dy ? Math.SQRT2 : 1);
      if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
    }
  }
  const tiles: At[] = [];
  for (let v = t; v >= 0; v = prev[v]) tiles.unshift([v % MAP_W, (v / MAP_W) | 0]);
  return { cost: dist[t], tiles: tiles[0]?.[0] === a[0] && tiles[0]?.[1] === a[1] ? tiles : [] };
}

const groundCost = (i: number) => STEP[GRID[(i / MAP_W) | 0][i % MAP_W] as Ground];
const layCost = (roads: Set<number>) => (i: number) => roads.has(i) ? 0.3 : LAY[GRID[(i / MAP_W) | 0][i % MAP_W] as Ground];

// 길 하나를 놓는다: 이미 있는 길을 타고 가장 싸게 (그래서 길이 갈래로 모인다)
export function layRoad(roads: Set<number>, a: At, b: At) {
  const p = cheapest(a, b, layCost(roads)).tiles;
  for (const [x, y] of p) roads.add(idx(x, y));
  return p;
}
export const isRoad = (roads: Set<number>, x: number, y: number) => roads.has(idx(x, y));

// 걷는 값: 길이면 ROAD, 아니면 땅 (물은 길(다리)일 때만)
export function walkCost(roads: Set<number>, a: At, b: At) {
  return cheapest(a, b, i => roads.has(i) ? ROAD : groundCost(i)).cost;
}

// 걷는 길의 칸들 (그리기용: 조가 오가는 길)
export function walkPath(roads: Set<number>, a: At, b: At) {
  return cheapest(a, b, i => roads.has(i) ? ROAD : groundCost(i)).tiles;
}
