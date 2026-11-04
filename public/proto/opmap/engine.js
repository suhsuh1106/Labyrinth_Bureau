// 작전 지도 시제품: 규칙. DOM을 쓰지 않는다 (index.html과 sim/opmap.mjs가 함께 쓴다)
// 조 넷(전사 · 궁수 · 마법사 · 도적)이 미궁을 더듬는다. 명령과 보고는 곧바로 오가지만, 본부가 보는 것은 조의 자리와
// 그 둘레 한 칸뿐이다. 조가 지나며 본 길은 본부로 돌아오거나 매핑 아이템을 써야 지도에 그려진다.
// 조는 스스로 맞서지 않는다. 적이나 계단을 보면 멈춰 보고하고 명령을 기다린다(곁에 붙은 적은 막아 싸운다).
// 층을 넘는 기준은 본부 지도 위에 본부에서 계단까지 이어진 길이 그려지는 것.
(function (root) {
  const MAP = [
    '############################',
    '#.....#########......##.N..#',
    '#.....#########......##....#',
    '#..........###...........###',
    '###.###....###..####..##.###',
    '###.###.##.###..####..##...#',
    '#H....#.##.......##........#',
    '#.....#.##.###...##.##...N.#',
    '#.........#####..##.##.....#',
    '###.#######......##.######.#',
    '#.....######..##.......###.#',
    '#.....#......###.####......#',
    '#.......####.....####.##.N.#',
    '#.....#####......####......#',
    '############################'];
  const W = MAP[0].length, H = MAP.length;
  const idx = (x, y) => y * W + x, X = i => i % W, Y = i => (i / W) | 0;
  const WALL = new Uint8Array(W * H);
  let HQ = 0; const NEST_AT = [];
  MAP.forEach((r, y) => [...r].forEach((c, x) => { WALL[idx(x, y)] = c === '#' ? 1 : 0; if (c === 'H') HQ = idx(x, y); if (c === 'N') NEST_AT.push(idx(x, y)); }));
  const STAIRS_AT = [idx(26, 8), idx(14, 1), idx(26, 5), idx(16, 13)]; // 판마다 이 가운데 한 곳
  const NB = i => { const x = X(i), y = Y(i), o = []; if (x > 0) o.push(i - 1); if (x < W - 1) o.push(i + 1); if (y > 0) o.push(i - W); if (y < H - 1) o.push(i + W); return o.filter(j => !WALL[j]); };
  const ring = i => { const o = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = X(i) + dx, y = Y(i) + dy; if (x >= 0 && y >= 0 && x < W && y < H) o.push(idx(x, y)); } return o; };
  const dist = (a, b) => Math.abs(X(a) - X(b)) + Math.abs(Y(a) - Y(b));
  const cheb = (a, b) => Math.max(Math.abs(X(a) - X(b)), Math.abs(Y(a) - Y(b)));
  const DIRS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

  const UNIT = {
    warrior: { name: '전사', n: 5, hp: 4, atk: 0.9, range: 1, min: 1, move: 1, sight: 4, take: 0.8 },
    archer: { name: '궁수', n: 4, hp: 2.5, atk: 0.6, range: 2, min: 1, move: 1, sight: 5, take: 1 },
    mage: { name: '마법사', n: 3, hp: 2.2, atk: 1.0, range: 3, min: 2, move: 1, sight: 4, take: 1.2 },
    rogue: { name: '도적', n: 4, hp: 2.5, atk: 0.5, range: 1, min: 1, move: 2, sight: 5, take: 1 },
  };
  const SKILL = {
    warrior: { name: '지키기', uses: null, atk: 1.6, take: 0.45 },
    archer: { name: '직사', uses: 5, len: 3, dmg: 5 },
    mage: { name: '포격', uses: null, cd: 5, reach: 3, delay: 2, dmg: 7 },
    rogue: { name: '함정', uses: 3, dmg: 6, root: 2 },
  };
  const MON = {
    swarm: { name: '떼', hp: 4, atk: 0.6, sight: 4 },
    brute: { name: '거구', hp: 14, atk: 1.8, sight: 3 },
  };
  const B = {
    HQ_HP: 20, HQ_ATK: 2, TURNS: 400, MAP_USES: 3, MAP_R: 5,
    GUARD_EVERY: 9, GUARD_MAX: 4, RAID_FIRST: 30, RAID_GAP: 26, RAID_BASE: 3,
  };

  function mkRng(s) {
    let seed = s >>> 0;
    return () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function los(a, b) {
    let x0 = X(a), y0 = Y(a); const x1 = X(b), y1 = Y(b), dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      if (x0 === x1 && y0 === y1) return true;
      if (WALL[idx(x0, y0)] && idx(x0, y0) !== a) return false;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  const sees = (a, b, r) => dist(a, b) <= r && los(a, b);
  function bfs(froms, block) {
    const d = new Int16Array(W * H).fill(-1), par = new Int32Array(W * H).fill(-1), q = [];
    for (const f of froms) { d[f] = 0; q.push(f); }
    for (let h = 0; h < q.length; h++) { const i = q[h]; for (const j of NB(i)) if (d[j] < 0 && !(block && block(j))) { d[j] = d[i] + 1; par[j] = i; q.push(j); } }
    return { d, par };
  }
  function stepToward(a, b, blocked) {
    if (a === b) return a;
    const { d } = bfs([b], null);
    if (d[a] < 0) return a;
    const opts = NB(a).filter(j => d[j] >= 0 && d[j] < d[a] && !blocked(j));
    return opts.length ? opts[0] : a;
  }

  function newGame(seed) {
    const rng = mkRng(seed || 1);
    const G = {
      seed, rng, turn: 0, over: null, nid: 1, hq: B.HQ_HP,
      stairs: STAIRS_AT[(rng() * STAIRS_AT.length) | 0], stairsSeen: false, stairsKnown: false,
      units: [], mons: [], traps: [], blasts: [], fx: [], pings: [], reports: [], alarm: null, autoPause: true,
      known: new Uint8Array(W * H), reported: new Set(), nests: NEST_AT.map((at, k) => ({ id: k, at, alive: true, seen: false })),
      stats: { kills: 0, lost: 0, orders: 0, skills: 0, maps: 0, homes: 0 },
    };
    for (const i of ring(HQ)) G.known[i] = 1;
    const start = ring(HQ).filter(i => !WALL[i] && i !== HQ);
    [['warrior', '전'], ['archer', '궁'], ['mage', '법'], ['rogue', '도']].forEach(([k, tag], n) => {
      const U = UNIT[k];
      G.units.push({ id: G.nid++, tag, k, at: start[n % start.length], hp: U.n * U.hp, n0: U.n, order: { kind: 'explore' }, mem: new Set(), maps: B.MAP_USES, uses: SKILL[k].uses, cd: 0, guard: 0, guardT: 0, hit: -9, goal: null });
    });
    for (const N of G.nests) for (let k = 0; k < 2; k++) spawn(G, N, 'swarm', 'guard');
    report(G, null, '네 조가 본부를 떠난다. 탁자 위 지도는 아직 하얗다.');
    look(G, true);
    return G;
  }
  function spawn(G, N, type, mode) {
    const free = [N.at, ...NB(N.at), ...NB(N.at).flatMap(NB)].find(i => !G.mons.some(m => m.at === i) && !G.units.some(u => u.at === i));
    if (free == null) return null;
    const m = { id: G.nid++, type, at: free, hp: MON[type].hp, max: MON[type].hp, nest: N.id, mode, last: null, lastT: -99, root: 0 };
    G.mons.push(m); return m;
  }
  const soldiers = u => Math.ceil(u.hp / UNIT[u.k].hp);
  const uname = u => `${UNIT[u.k].name}조`;
  function report(G, u, text, kind) { G.reports.unshift({ turn: G.turn, who: u ? uname(u) : '', text, kind: kind || '' }); if (G.reports.length > 80) G.reports.pop(); }
  function alarm(G, text, at) { if (G.autoPause && !G.alarm) G.alarm = { text, at }; }
  const atHome = u => cheb(u.at, HQ) <= 1;
  // 본부가 지금 보는 칸: 조의 자리와 둘레 한 칸, 본부 둘레
  function liveSet(G) { const s = new Set(ring(HQ)); for (const u of G.units) for (const i of ring(u.at)) s.add(i); return s; }

  // ── 명령 (곧바로 닿는다)
  function command(G, uid, kind, arg) {
    if (G.over) return '끝난 판';
    const u = G.units.find(q => q.id === uid); if (!u) return '없는 조';
    if (kind === 'move' && (arg == null || WALL[arg])) return '갈 칸을 고르세요';
    if (u.guard && kind !== 'guard') {
      if (u.guard === 2) return '지키는 중: 먼저 풀어야 함';
      if (u.guard === 1) return '자리를 잡는 중';
    }
    if (kind === 'move' || kind === 'explore' || kind === 'home' || kind === 'wait') { u.order = { kind, target: arg }; G.stats.orders++; return null; }
    if (kind === 'map') {
      if (u.maps <= 0) return '매핑 아이템이 없음';
      u.maps--; G.stats.maps++;
      let n = 0;
      for (let y = Math.max(0, Y(u.at) - B.MAP_R); y <= Math.min(H - 1, Y(u.at) + B.MAP_R); y++) for (let x = Math.max(0, X(u.at) - B.MAP_R); x <= Math.min(W - 1, X(u.at) + B.MAP_R); x++) {
        const i = idx(x, y); if (sees(u.at, i, B.MAP_R) || (WALL[i] && NB(i).some(j => sees(u.at, j, B.MAP_R)))) { if (!G.known[i]) n++; G.known[i] = 1; }
      }
      for (const i of u.mem) if (cheb(i, u.at) <= B.MAP_R) G.known[i] = 1;
      report(G, u, `둘레의 지도를 그려 보낸다.`, 'good');
      checkStairs(G);
      return null;
    }
    if (kind === 'guard') {
      if (u.k !== 'warrior') return '전사만';
      if (u.guard === 0) { u.guard = 1; u.guardT = G.turn + 1; u.order = { kind: 'wait' }; report(G, u, '방패를 세운다.'); }
      else if (u.guard === 2) { u.guard = 3; u.guardT = G.turn + 1; report(G, u, '방패를 거둔다.'); }
      else return '준비 중';
      G.stats.skills++; return null;
    }
    if (kind === 'trap') {
      if (u.k !== 'rogue') return '도적만';
      if (u.uses <= 0) return '함정이 없음: 본부에서 채워야 함';
      if (G.traps.some(t => t.at === u.at)) return '이미 함정이 있음';
      u.uses--; G.traps.push({ at: u.at }); G.stats.skills++;
      report(G, u, '발밑에 덫을 묻었다.'); return null;
    }
    if (kind === 'shot' || kind === 'blast') {
      const D = DIRS[arg]; if (!D) return '방향을 고르세요';
      if (kind === 'shot') {
        if (u.k !== 'archer') return '궁수만';
        if (u.uses <= 0) return '화살이 없음: 본부에서 채워야 함';
        u.uses--; G.stats.skills++;
        let x = X(u.at), y = Y(u.at), hit = 0; const line = [];
        for (let k = 0; k < SKILL.archer.len; k++) {
          x += D[0]; y += D[1]; if (x < 0 || y < 0 || x >= W || y >= H || WALL[idx(x, y)]) break;
          const i = idx(x, y); line.push(i);
          for (const m of G.mons) if (m.at === i) { m.hp -= SKILL.archer.dmg; hit++; }
        }
        G.fx.push({ kind: 'shot', from: u.at, line, turn: G.turn });
        report(G, u, hit ? `시위를 당겼다. ${hit}을 꿰었다.` : '시위를 당겼으나 빈 곳을 갈랐다.', hit ? 'good' : 'mute');
        cleanup(G);
        return null;
      }
      if (u.k !== 'mage') return '마법사만';
      if (u.cd > 0) return `${u.cd}턴 뒤에 다시 쓸 수 있음`;
      let x = X(u.at), y = Y(u.at);
      for (let k = 0; k < SKILL.mage.reach; k++) { const nx = x + D[0], ny = y + D[1]; if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1 || WALL[idx(nx, ny)]) break; x = nx; y = ny; }
      if (idx(x, y) === u.at) return '그쪽은 막혀 있음';
      G.blasts.push({ at: idx(x, y), land: G.turn + SKILL.mage.delay, by: u.id });
      u.cd = SKILL.mage.cd; G.stats.skills++;
      report(G, u, '주문을 읊기 시작한다.');
      return null;
    }
    return '모르는 명령';
  }

  // 조가 보는 것: 기억에 쌓이고, 새로 본 적 · 계단 · 둥지는 보고한다
  function look(G, quiet) {
    for (const u of G.units) {
      const r = UNIT[u.k].sight, newMons = [];
      for (let y = Math.max(0, Y(u.at) - r); y <= Math.min(H - 1, Y(u.at) + r); y++) for (let x = Math.max(0, X(u.at) - r); x <= Math.min(W - 1, X(u.at) + r); x++) {
        const i = idx(x, y);
        if (!sees(u.at, i, r) && !(WALL[i] && NB(i).some(j => sees(u.at, j, r)))) continue;
        u.mem.add(i);
      }
      for (const m of G.mons) if (sees(u.at, m.at, r)) {
        G.pings = G.pings.filter(p => p.id !== m.id); G.pings.push({ id: m.id, at: m.at, type: m.type, turn: G.turn });
        if (!G.reported.has(m.id)) { G.reported.add(m.id); newMons.push(m); }
      }
      if (newMons.length && !quiet) {
        const sw = newMons.filter(m => m.type === 'swarm').length, br = newMons.length - sw;
        report(G, u, `적을 조우함. ${sw ? `떼 ${sw}` : ''}${sw && br ? ' · ' : ''}${br ? `거구 ${br}` : ''}. 명령 대기.`, 'warn');
        if (u.order.kind !== 'home' && u.order.kind !== 'move') u.order = { kind: 'wait' };
        alarm(G, `${uname(u)} 적을 조우함 · 명령 대기`, u.at);
      }
      if (!G.stairsSeen && sees(u.at, G.stairs, r)) {
        G.stairsSeen = true;
        report(G, u, '아래로 내려가는 계단을 보았다. 명령 대기.', 'good');
        if (u.order.kind !== 'home') u.order = { kind: 'wait' };
        alarm(G, `${uname(u)} 계단 발견 · 명령 대기`, u.at);
      }
      for (const N of G.nests) if (N.alive && !N.seen && sees(u.at, N.at, r)) { N.seen = true; report(G, u, '마물이 들끓는 굴을 보았다.', 'warn'); }
    }
    G.pings = G.pings.filter(p => G.turn - p.turn < 12 && G.mons.some(m => m.id === p.id));
  }
  function checkStairs(G) {
    if (!G.known[G.stairs]) return;
    const { d } = bfs([HQ], j => !G.known[j]);
    if (d[G.stairs] >= 0 && !G.stairsKnown) { G.stairsKnown = true; G.over = 'win'; report(G, null, '탁자 위에 계단까지 이어진 길이 그려졌다.', 'good'); }
  }

  function tick(G) {
    if (G.over || G.alarm) return;
    G.turn++;
    G.fx = G.fx.filter(f => G.turn - f.turn < 2);
    // 1) 포격이 떨어짐
    for (const b of G.blasts.filter(b => b.land <= G.turn)) {
      let hit = 0;
      for (const m of G.mons) if (cheb(m.at, b.at) <= 1) { m.hp -= SKILL.mage.dmg; hit++; }
      for (const u of G.units) if (cheb(u.at, b.at) <= 1) u.hp -= SKILL.mage.dmg * 0.5;
      G.fx.push({ kind: 'blast', at: b.at, turn: G.turn });
      const by = G.units.find(u => u.id === b.by), near = G.units.find(u => u.id !== b.by && cheb(u.at, b.at) <= 3);
      if (near && hit) report(G, near, '눈앞에서 불기둥이 솟았다. 어디서 온 것인지 모르겠다.', 'good');
      else if (by) report(G, by, hit ? '주문이 떨어졌다. 무언가 쓰러지는 소리.' : '주문이 빈 땅을 태웠다.', hit ? 'good' : 'mute');
    }
    G.blasts = G.blasts.filter(b => b.land > G.turn);
    // 2) 조
    const monAt = () => new Set(G.mons.map(m => m.at));
    for (const u of G.units) {
      const U = UNIT[u.k];
      if (u.cd > 0) u.cd--;
      if (u.guard === 1 && G.turn >= u.guardT) { u.guard = 2; report(G, u, '자리를 굳혔다.'); }
      if (u.guard === 3 && G.turn >= u.guardT) { u.guard = 0; }
      // 곁의 적은 막아 싸운다 (기본 교전)
      const targets = G.mons.filter(m => { const d = cheb(m.at, u.at); return d >= U.min && d <= U.range && los(u.at, m.at); });
      const fleeing = u.order.kind === 'home';
      if (targets.length && !fleeing) {
        const t = targets.reduce((a, b) => a.hp < b.hp ? a : b);
        t.hp -= soldiers(u) * U.atk * (u.guard === 2 ? SKILL.warrior.atk : 1);
        G.fx.push({ kind: 'hit', at: t.at, from: u.at, turn: G.turn });
        continue;
      }
      if (u.guard) continue;
      let goal = null;
      if (u.order.kind === 'explore') goal = frontier(G, u);
      else if (u.order.kind === 'move') { goal = u.order.target; if (u.at === goal) { u.order = { kind: 'wait' }; report(G, u, '닿았다. 명령 대기.'); goal = null; } }
      else if (u.order.kind === 'home') goal = HQ;
      if (u.order.kind === 'explore' && goal == null) { u.order = { kind: 'wait' }; report(G, u, '더 갈 곳이 보이지 않는다. 명령 대기.'); }
      if (goal == null) continue;
      for (let s = 0; s < U.move; s++) {
        const ma = monAt();
        const nx = stepToward(u.at, goal, j => ma.has(j) || j === HQ && goal !== HQ);
        if (nx === u.at) break;
        u.at = nx;
        if (G.mons.some(m => cheb(m.at, u.at) <= U.range && cheb(m.at, u.at) >= U.min)) break;
        if (atHome(u) && u.order.kind === 'home') break;
      }
      if (u.order.kind === 'home' && atHome(u)) { u.order = { kind: 'wait' }; }
    }
    // 3) 마물: 눈에 보이는 조만 쫓는다
    for (const m of G.mons) {
      if (m.hp <= 0) continue;
      if (m.root > 0) { m.root--; }
      const T = MON[m.type];
      const adj = G.units.filter(u => cheb(u.at, m.at) === 1);
      if (adj.length) {
        const t = adj.reduce((a, b) => a.hp < b.hp ? a : b);
        t.hp -= T.atk * UNIT[t.k].take * (t.guard === 2 ? SKILL.warrior.take : 1); t.hit = G.turn;
        continue;
      }
      if (cheb(m.at, HQ) === 1) { G.hq -= T.atk; if (!G.hqTold || G.turn - G.hqTold > 5) { G.hqTold = G.turn; report(G, null, '본부 문에 마물이 붙었다.', 'bad'); alarm(G, '본부가 공격받음', HQ); } continue; }
      if (m.root > 0) continue;
      const seen = G.units.filter(u => sees(m.at, u.at, T.sight));
      let goal;
      if (seen.length) { const t = seen.reduce((a, b) => dist(a.at, m.at) < dist(b.at, m.at) ? a : b); m.last = t.at; m.lastT = G.turn; goal = t.at; }
      else if (m.last != null && G.turn - m.lastT < 4 && m.at !== m.last) goal = m.last;
      else if (m.mode === 'raid') goal = HQ;
      else { const N = G.nests[m.nest]; goal = dist(m.at, N.at) > 3 ? N.at : (G.rng() < 0.3 ? NB(m.at)[(G.rng() * NB(m.at).length) | 0] : null); }
      if (goal == null) continue;
      const occ = new Set([...G.units.map(u => u.at), ...G.mons.map(o => o.at), HQ]); occ.delete(m.at);
      const nx = stepToward(m.at, goal, j => occ.has(j));
      if (nx !== m.at) {
        m.at = nx;
        const t = G.traps.find(t => t.at === nx);
        if (t) {
          m.hp -= SKILL.rogue.dmg; m.root = SKILL.rogue.root; G.traps = G.traps.filter(q => q !== t);
          G.fx.push({ kind: 'trap', at: nx, turn: G.turn });
          const near = G.units.find(u => cheb(u.at, nx) <= 3);
          if (near && near.k !== 'rogue') report(G, near, '놈 하나가 무언가에 발이 묶였다.', 'good');
        }
      }
    }
    // 본부 망루
    const nearHq = G.mons.filter(m => cheb(m.at, HQ) <= 2);
    if (nearHq.length) nearHq.reduce((a, b) => a.hp < b.hp ? a : b).hp -= B.HQ_ATK;
    cleanup(G);
    // 4) 본부에 닿은 조: 지도를 넘기고, 다치고 쓴 것을 채운다
    for (const u of G.units) if (atHome(u)) {
      let n = 0; for (const i of u.mem) { if (!G.known[i]) n++; G.known[i] = 1; } u.mem.clear();
      const full = u.hp >= u.n0 * UNIT[u.k].hp && (SKILL[u.k].uses == null || u.uses >= SKILL[u.k].uses) && u.maps >= B.MAP_USES;
      u.hp = u.n0 * UNIT[u.k].hp; if (SKILL[u.k].uses != null) u.uses = SKILL[u.k].uses; u.maps = B.MAP_USES;
      if (n || !full) { G.stats.homes++; report(G, u, n ? '본부에 닿아 지나온 길을 지도에 옮겼다.' : '본부에서 채우고 다시 채비한다.', 'good'); }
    }
    checkStairs(G);
    if (G.over) return;
    // 5) 둥지
    for (const N of G.nests) {
      const guards = G.mons.filter(m => m.nest === N.id && m.mode === 'guard').length;
      if (G.turn % B.GUARD_EVERY === 0 && guards < B.GUARD_MAX) spawn(G, N, G.turn > 80 && G.rng() < 0.25 ? 'brute' : 'swarm', 'guard');
    }
    if (G.turn >= B.RAID_FIRST && (G.turn - B.RAID_FIRST) % B.RAID_GAP === 0) {
      const N = G.nests[(G.rng() * G.nests.length) | 0], k = ((G.turn - B.RAID_FIRST) / B.RAID_GAP) | 0;
      for (let i = 0; i < B.RAID_BASE + k; i++) spawn(G, N, 'swarm', 'raid');
      if (k >= 1) spawn(G, N, 'brute', 'raid');
    }
    look(G);
    if (G.hq <= 0) { G.hq = 0; G.over = 'fall'; }
    else if (!G.units.length) G.over = 'lost';
    else if (G.turn >= B.TURNS) G.over = 'time';
  }
  function cleanup(G) {
    for (const m of G.mons.filter(m => m.hp <= 0)) G.stats.kills++;
    G.mons = G.mons.filter(m => m.hp > 0);
    for (const u of G.units.filter(q => q.hp <= 0)) { G.stats.lost++; report(G, u, '— 연락이 끊겼다.', 'bad'); alarm(G, `${uname(u)}와 연락이 끊김`, u.at); }
    G.units = G.units.filter(u => u.hp > 0);
  }
  // 탐사: 자기가 아직 안 본 칸과 맞닿은 가장 가까운 칸 (조마다 따로 기억한다)
  function frontier(G, u) {
    const ma = new Set(G.mons.map(m => m.at));
    const { d } = bfs([u.at], j => ma.has(j));
    let best = null, bd = 1e9;
    for (let i = 0; i < W * H; i++) {
      if (d[i] <= 0 || WALL[i]) continue;
      const seen = k => u.mem.has(k) || G.known[k];
      if (!seen(i) || !NB(i).some(j => !seen(j)) && !ring(i).some(j => !seen(j))) continue;
      const taken = G.units.some(o => o !== u && o.order.kind === 'explore' && o.goal != null && dist(o.goal, i) < 4);
      const score = d[i] + (taken ? 8 : 0);
      if (score < bd) { bd = score; best = i; }
    }
    u.goal = best;
    return best;
  }

  root.OPMAP = { MAP, W, H, idx, X, Y, WALL, HQ, NEST_AT, UNIT, SKILL, MON, B, DIRS, NB, ring, dist, cheb, los, newGame, tick, command, liveSet, soldiers, atHome };
})(typeof window !== 'undefined' ? window : globalThis);
