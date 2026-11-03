// 작전 지도 시제품: 규칙. DOM을 쓰지 않는다 (index.html과 sim/opmap.mjs가 함께 쓴다)
// 지도 하나 위에서 조 넷이 저절로 탐사하고, 마물을 보면 미리 정한 방침(교전/후퇴)대로 움직이며 경보를 올린다.
// 국장은 작전 캠프에서 세부 명령(이동 · 지키기 · 유인 · 일제사격)을 내린다. 명령은 본부에서 먼 조일수록 늦게 닿고,
// 일제사격은 두 턴 뒤 떨어진다. 마물은 눈에 보이는 조만 쫓는다. 조는 본부와 길이 이어져야 보급을 받고,
// 마물은 둥지와 길이 이어져야 힘을 쓴다. 병목을 막으면 줄이 끊긴다.
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
  const NB = i => { const x = X(i), y = Y(i), o = []; if (x > 0) o.push(i - 1); if (x < W - 1) o.push(i + 1); if (y > 0) o.push(i - W); if (y < H - 1) o.push(i + W); return o.filter(j => !WALL[j]); };
  const dist = (a, b) => Math.abs(X(a) - X(b)) + Math.abs(Y(a) - Y(b));

  const UNIT = {
    spear: { name: '창병', n: 6, hp: 3.5, atk: 0.8, range: 1, move: 1, sight: 4, def: 0.7 },
    bow: { name: '궁수', n: 5, hp: 2, atk: 0.45, range: 3, move: 1, sight: 5, def: 1 },
    raid: { name: '돌격', n: 5, hp: 3, atk: 0.8, range: 1, move: 2, sight: 4, def: 1 },
    scout: { name: '정찰', n: 3, hp: 2, atk: 0.3, range: 1, move: 2, sight: 6, def: 1 },
  };
  const MON = {
    swarm: { name: '떼', hp: 4, atk: 0.6, sight: 4 },
    brute: { name: '거구', hp: 14, atk: 1.8, sight: 3 },
  };
  const ORDER = { auto: '탐사', move: '이동', hold: '지키기', lure: '유인', volley: '일제사격' };
  const B = {
    HQ_HP: 20, HQ_ATK: 2, NEST_HP: 20, TURNS: 220,
    ORDER_PER: 7,          // 본부에서 이만큼 떨어질 때마다 명령이 한 턴 늦게 닿음
    VOLLEY_DELAY: 2, VOLLEY_DMG: 6, VOLLEY_CD: 6,
    SUP_RANGE: 60, SUP_MAX: 10, SUP_GAIN: 2, SUP_LOSS: 1, STARVE: 0.5, STARVE_HURT: 0.25,
    CUT_ATK: 0.5, CUT_HURT: 0.35,
    REGEN_EVERY: 4, REGEN_NEAR: 4,
    GUARD_EVERY: 9, GUARD_MAX: 4, RAID_FIRST: 24, RAID_GAP: 22, RAID_BASE: 3, LOSE_SIGHT: 2,
  };

  function mkRng(s) {
    let seed = s >>> 0;
    return () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // 시야: 두 칸 사이에 벽이 없어야 보인다
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

  // 너비 우선: from에서 퍼져 나가며 거리와 부모를 남김. block(i)이 참인 칸은 지나지 못함(끝 칸은 예외)
  function bfs(froms, block, limit) {
    const d = new Int16Array(W * H).fill(-1), par = new Int32Array(W * H).fill(-1), q = [];
    for (const f of froms) { d[f] = 0; q.push(f); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h]; if (limit != null && d[i] >= limit) continue;
      for (const j of NB(i)) if (d[j] < 0 && !(block && block(j))) { d[j] = d[i] + 1; par[j] = i; q.push(j); }
    }
    return { d, par };
  }
  // a에서 b로 가는 다음 칸 (막힌 칸은 피함, b 자체는 막혀도 됨)
  function stepToward(G, a, b, occ) {
    if (a === b) return a;
    const { d } = bfs([b], null);   // 길은 막힘을 무시하고 재고, 실제로 들어설 때만 빈 칸인지 본다
    if (d[a] < 0) return a;
    const opts = NB(a).filter(j => d[j] >= 0 && d[j] < d[a] && !occ.has(j));
    return opts.length ? opts[0] : a;
  }
  function pathToward(a, b, occ, n) {
    const { d, par } = bfs([b], null);
    const out = []; let c = a;
    for (let k = 0; k < n && d[c] > 0; k++) { c = par[c]; if (c < 0) break; out.push(c); }
    return out;
  }

  function newGame(seed) {
    const G = {
      seed, rng: mkRng(seed || 1), turn: 0, over: null, nid: 1, hq: B.HQ_HP,
      units: [], mons: [], nests: NEST_AT.map((at, k) => ({ id: k, at, hp: B.NEST_HP, alive: true, seen: false })),
      explored: new Uint8Array(W * H), vis: new Uint8Array(W * H), volleys: [], reports: [], alarm: null, autoPause: true,
      supplyPar: null, supplyD: null, nestPar: [], fx: [],
      stats: { kills: 0, lost: 0, volleys: 0, orders: 0, cutKills: 0 },
    };
    const start = [HQ + 1, HQ + W, HQ + W + 1, HQ + 2, HQ - W, HQ - W + 1].filter(i => !WALL[i]);
    [['spear', 'A'], ['bow', 'B'], ['raid', 'C'], ['scout', 'D']].forEach(([k, tag], i) => {
      const U = UNIT[k];
      G.units.push({ id: G.nid++, tag, k, at: start[i], hp: U.n * U.hp, n0: U.n, sup: B.SUP_MAX, order: { kind: 'auto' }, contact: k === 'scout' || k === 'bow' ? 'retreat' : 'engage', pending: null, lastSeen: -99, cd: 0, starving: false, plan: [] });
    });
    for (const N of G.nests) for (let k = 0; k < 2; k++) spawn(G, N, 'swarm', 'guard');
    refresh(G);
    G.reports = [];
    report(G, null, '네 조가 본부를 떠난다. 미궁의 지도는 아직 하얗다.');
    return G;
  }
  function spawn(G, N, type, mode) {
    const free = [N.at, ...NB(N.at), ...NB(N.at).flatMap(NB)].find(i => !G.mons.some(m => m.at === i) && !G.units.some(u => u.at === i));
    if (free == null) return null;
    const m = { id: G.nid++, type, at: free, hp: MON[type].hp, max: MON[type].hp, nest: N.id, mode, target: null, last: null, lastT: -99, cut: false, plan: [] };
    G.mons.push(m); return m;
  }
  const soldiers = u => Math.ceil(u.hp / UNIT[u.k].hp);
  const unitName = u => `${u.tag}조`;
  function report(G, u, text, kind) { G.reports.unshift({ turn: G.turn, who: u ? unitName(u) : '', text, kind: kind || '' }); if (G.reports.length > 60) G.reports.pop(); }
  function alarm(G, text, at) { if (G.autoPause && !G.alarm) G.alarm = { text, at }; }

  // ── 명령: 본부에서 멀수록 늦게 닿는다
  function orderDelay(G, u) { return Math.floor((G.supplyD && G.supplyD[u.at] >= 0 ? G.supplyD[u.at] : dist(HQ, u.at) * 1.5) / B.ORDER_PER); }
  function command(G, uid, kind, target) {
    if (G.over) return '끝난 판';
    const u = G.units.find(q => q.id === uid); if (!u) return '없는 조';
    if (kind === 'volley') {
      if (u.k !== 'bow') return '궁수만';
      if (u.cd > 0) return '화살을 다시 메기는 중';
      if (target == null || WALL[target]) return '쏠 칸을 고르세요';
    }
    if ((kind === 'move' || kind === 'lure') && (target == null || WALL[target])) return '갈 칸을 고르세요';
    const delay = orderDelay(G, u);
    u.pending = { kind, target, arrive: G.turn + delay, delay };
    G.stats.orders++;
    if (delay === 0) applyOrder(G, u);
    return null;
  }
  function setContact(G, uid) { const u = G.units.find(q => q.id === uid); if (u) u.contact = u.contact === 'engage' ? 'retreat' : 'engage'; }
  function applyOrder(G, u) {
    const p = u.pending; u.pending = null;
    if (p.kind === 'volley') {
      G.volleys.push({ at: p.target, land: G.turn + B.VOLLEY_DELAY, by: u.id });
      u.cd = B.VOLLEY_CD; G.stats.volleys++;
      if (p.delay) report(G, u, '전령이 닿았다. 지시받은 곳으로 활을 높이 든다.');
      return;
    }
    u.order = { kind: p.kind, target: p.target };
    if (p.delay) report(G, u, { move: '전령이 닿았다. 지시받은 곳으로 움직인다.', hold: '전령이 닿았다. 이 자리를 지킨다.', lure: '전령이 닿았다. 놈들을 달고 물러선다.', auto: '전령이 닿았다. 다시 길을 더듬어 나간다.' }[p.kind]);
  }

  // ── 시야 · 보급 · 둥지 줄
  function refresh(G) {
    G.vis.fill(0);
    for (const u of G.units) {
      const r = UNIT[u.k].sight;
      for (let y = Math.max(0, Y(u.at) - r); y <= Math.min(H - 1, Y(u.at) + r); y++) for (let x = Math.max(0, X(u.at) - r); x <= Math.min(W - 1, X(u.at) + r); x++) {
        const i = idx(x, y); if (sees(u.at, i, r)) { G.vis[i] = 1; G.explored[i] = 1; }
      }
    }
    G.vis[HQ] = 1; G.explored[HQ] = 1;
    for (const N of G.nests) if (G.vis[N.at] && !N.seen) { N.seen = true; report(G, null, '둥지를 찾았다는 보고가 들어온다.', 'warn'); }
    // 보급: 본부에서 마물이 서 있지 않은 길로 이어진 곳
    const monAt = new Set(G.mons.map(m => m.at));
    const s = bfs([HQ], j => monAt.has(j), B.SUP_RANGE);
    G.supplyD = s.d; G.supplyPar = s.par;
    // 둥지 줄: 둥지에서 조가 서 있지 않은 길로 이어진 곳
    const unitAt = new Set(G.units.map(u => u.at));
    G.nestPar = G.nests.map(N => N.alive ? bfs([N.at], j => unitAt.has(j)) : null);
    for (const m of G.mons) {
      const nb = G.nestPar[m.nest];
      const cut = !nb || nb.d[m.at] < 0;
      if (cut && !m.cut && G.vis[m.at]) {
        const near = G.units.find(u => sees(u.at, m.at, UNIT[u.k].sight));
        if (near && !G.cutTold) { report(G, near, '놈들이 갑자기 비틀거린다. 무엇이 놈들을 꺾었는지는 모르겠다.', 'good'); G.cutTold = G.turn; }
      }
      m.cut = cut;
    }
    if (G.cutTold != null && G.turn - G.cutTold > 6) G.cutTold = null;
  }

  function visibleMonsTo(G, u) { const r = UNIT[u.k].sight; return G.mons.filter(m => sees(u.at, m.at, r)); }
  function nearest(list, at) { let b = null, bd = 1e9; for (const o of list) { const d = dist(o.at, at); if (d < bd) { bd = d; b = o; } } return b; }

  function tick(G) {
    if (G.over || G.alarm) return;
    G.turn++;
    G.fx = G.fx.filter(f => G.turn - f.turn < 2);
    // 1) 전령이 닿음
    for (const u of G.units) if (u.pending && u.pending.arrive <= G.turn) applyOrder(G, u);
    // 2) 화살 비
    for (const v of G.volleys.filter(v => v.land <= G.turn)) {
      let hit = 0;
      for (const m of G.mons) if (Math.abs(X(m.at) - X(v.at)) <= 1 && Math.abs(Y(m.at) - Y(v.at)) <= 1) { m.hp -= B.VOLLEY_DMG; hit++; }
      for (const u of G.units) if (Math.abs(X(u.at) - X(v.at)) <= 1 && Math.abs(Y(u.at) - Y(v.at)) <= 1) u.hp -= B.VOLLEY_DMG * 0.5;
      G.fx.push({ kind: 'volley', at: v.at, turn: G.turn });
      const near = G.units.filter(u => dist(u.at, v.at) <= 4 && u.id !== v.by)[0];
      if (hit && near) report(G, near, '하늘에서 화살이 쏟아졌다. 어디서 날아온 것인지 알 길이 없다.', 'good');
      else if (!hit) report(G, null, '화살 비가 빈 땅을 때렸다.', 'mute');
    }
    G.volleys = G.volleys.filter(v => v.land > G.turn);
    // 3) 조가 움직이고 친다
    const occ = () => new Set([...G.units.map(u => u.at), ...G.mons.map(m => m.at), HQ]);
    for (const u of G.units) {
      if (u.hp <= 0) continue;
      const U = UNIT[u.k], seen = visibleMonsTo(G, u);
      if (u.cd > 0) u.cd--;
      if (seen.length) {
        if (G.turn - u.lastSeen > B.LOSE_SIGHT + 1) {
          const sw = seen.filter(m => m.type === 'swarm').length, br = seen.length - sw;
          report(G, u, `마물을 보았다. ${sw ? `떼 ${sw}` : ''}${sw && br ? ' · ' : ''}${br ? `거구 ${br}` : ''}. ${u.order.kind === 'auto' ? (u.contact === 'engage' ? '방침대로 맞선다.' : '방침대로 물러난다.') : '명령을 지킨다.'}`, 'warn');
          alarm(G, `${unitName(u)} 마물과 마주침`, u.at);
        }
        u.lastSeen = G.turn;
      }
      const mode = u.order.kind === 'auto' ? (seen.length || G.turn - u.lastSeen <= B.LOSE_SIGHT ? (u.contact === 'engage' ? 'engage' : 'retreat') : 'explore') : u.order.kind;
      const inRange = G.mons.filter(m => dist(m.at, u.at) <= U.range && (U.range === 1 || los(u.at, m.at)));
      const canFight = mode !== 'retreat' && mode !== 'lure';
      if (canFight && inRange.length) { hit(G, u, inRange); continue; }
      // 둥지 치기
      const nestAdj = G.nests.find(N => N.alive && dist(N.at, u.at) <= 1);
      if (canFight && nestAdj && (mode === 'engage' || mode === 'explore' || mode === 'hold' || (mode === 'move' && u.order.target === nestAdj.at))) { hitNest(G, u, nestAdj); continue; }
      let goal = null, slow = false;
      if (mode === 'explore') goal = frontier(G, u);
      else if (mode === 'engage') { const t = nearest(seen, u.at); goal = t ? t.at : null; }
      else if (mode === 'retreat') goal = HQ;
      else if (mode === 'move') goal = u.order.target;
      else if (mode === 'lure') {
        const chasers = G.mons.filter(m => dist(m.at, u.at) <= 3);
        goal = chasers.length ? u.order.target : null; slow = true;
        if (u.at === u.order.target) { u.order = { kind: 'hold' }; report(G, u, '정해진 자리에 닿았다. 돌아서서 맞선다.'); }
      }
      if (mode === 'move' && u.at === u.order.target) { u.order = { kind: 'hold' }; goal = null; }
      if (goal == null) continue;
      const steps = slow ? 1 : U.move;
      for (let s = 0; s < steps; s++) {
        const o = occ(); o.delete(u.at);
        const nx = stepToward(G, u.at, goal, o);
        if (nx === u.at || o.has(nx)) break;
        u.at = nx;
        if (canFight && G.mons.some(m => dist(m.at, u.at) <= U.range && (U.range === 1 || los(u.at, m.at)))) break;
      }
    }
    // 4) 마물이 움직이고 친다: 눈에 보이는 조만 쫓는다
    for (const m of G.mons) {
      if (m.hp <= 0) continue;
      const T = MON[m.type];
      const adjU = G.units.filter(u => u.hp > 0 && dist(u.at, m.at) === 1);
      if (adjU.length) { const t = adjU.reduce((a, b) => a.hp < b.hp ? a : b); hurtUnit(G, t, T.atk * (m.cut ? B.CUT_ATK : 1)); continue; }
      if (dist(m.at, HQ) === 1) { G.hq -= T.atk * (m.cut ? B.CUT_ATK : 1); if (!G.hqTold || G.turn - G.hqTold > 5) { G.hqTold = G.turn; report(G, null, '본부 문에 마물이 붙었다.', 'bad'); alarm(G, '본부가 공격받음', HQ); } continue; }
      const seenU = G.units.filter(u => u.hp > 0 && sees(m.at, u.at, T.sight));
      let goal;
      if (seenU.length) { const t = nearest(seenU, m.at); m.last = t.at; m.lastT = G.turn; goal = t.at; }
      else if (m.last != null && G.turn - m.lastT < 4 && m.at !== m.last) goal = m.last;
      else if (m.mode === 'raid') goal = HQ;
      else { const N = G.nests[m.nest]; goal = dist(m.at, N.at) > 3 ? N.at : (G.rng() < 0.3 ? NB(m.at)[(G.rng() * NB(m.at).length) | 0] : null); }
      if (goal == null) continue;
      const o = occ(); o.delete(m.at);
      const nx = stepToward(G, m.at, goal, o);
      if (nx !== m.at && !o.has(nx)) m.at = nx;
    }
    // 본부 망루가 붙은 마물을 쏨
    const atHq = G.mons.filter(m => dist(m.at, HQ) <= 2);
    if (atHq.length) atHq.reduce((a, b) => a.hp < b.hp ? a : b).hp -= B.HQ_ATK;
    // 5) 쓰러짐 · 줄 끊김 · 굶주림
    for (const m of G.mons) if (m.cut) m.hp -= B.CUT_HURT;
    const dead = G.mons.filter(m => m.hp <= 0);
    for (const m of dead) { G.stats.kills++; if (m.cut) G.stats.cutKills++; }
    G.mons = G.mons.filter(m => m.hp > 0);
    refresh(G);
    for (const u of G.units) {
      const sup = G.supplyD[u.at] >= 0;
      if (sup) { if (u.starving) report(G, u, '보급 수레가 다시 닿았다.', 'good'); u.sup = Math.min(B.SUP_MAX, u.sup + B.SUP_GAIN); u.starving = false; }
      else { u.sup = Math.max(0, u.sup - B.SUP_LOSS); if (u.sup === 0) { if (!u.starving) report(G, u, '보급이 끊겼다. 뒤쪽 길이 막힌 듯하다.', 'bad'); u.starving = true; u.hp -= B.STARVE_HURT; } }
      if (sup && G.supplyD[u.at] <= B.REGEN_NEAR && G.turn % B.REGEN_EVERY === 0) u.hp = Math.min(u.n0 * UNIT[u.k].hp, u.hp + UNIT[u.k].hp);
    }
    for (const u of G.units.filter(q => q.hp <= 0)) { G.stats.lost++; report(G, u, '— 연락이 끊겼다.', 'bad'); alarm(G, `${unitName(u)} 전멸`, u.at); }
    G.units = G.units.filter(u => u.hp > 0);
    // 6) 둥지
    for (const N of G.nests) {
      if (!N.alive) continue;
      const guards = G.mons.filter(m => m.nest === N.id && m.mode === 'guard').length;
      if (G.turn % B.GUARD_EVERY === 0 && guards < B.GUARD_MAX) spawn(G, N, G.turn > 60 && G.rng() < 0.25 ? 'brute' : 'swarm', 'guard');
    }
    if (G.turn >= B.RAID_FIRST && (G.turn - B.RAID_FIRST) % B.RAID_GAP === 0) {
      const alive = G.nests.filter(N => N.alive);
      if (alive.length) {
        const N = alive[(G.rng() * alive.length) | 0], k = ((G.turn - B.RAID_FIRST) / B.RAID_GAP) | 0;
        for (let i = 0; i < B.RAID_BASE + k; i++) spawn(G, N, 'swarm', 'raid');
        if (k >= 1) spawn(G, N, 'brute', 'raid');
        if (N.seen) report(G, null, '둥지 하나가 크게 들썩인다는 보고.', 'warn');
      }
    }
    refresh(G);
    plans(G);
    if (G.hq <= 0) { G.hq = 0; G.over = 'fall'; }
    else if (!G.units.length) G.over = 'lost';
    else if (G.nests.every(N => !N.alive)) G.over = 'win';
    else if (G.turn >= B.TURNS) G.over = 'time';
  }
  function hit(G, u, list) {
    const U = UNIT[u.k], t = list.reduce((a, b) => a.hp < b.hp ? a : b);
    t.hp -= soldiers(u) * U.atk * (u.sup > 0 ? 1 : B.STARVE);
    G.fx.push({ kind: 'hit', at: t.at, from: u.at, turn: G.turn });
  }
  function hitNest(G, u, N) {
    N.hp -= soldiers(u) * UNIT[u.k].atk * (u.sup > 0 ? 1 : B.STARVE);
    if (N.hp <= 0) {
      N.alive = false; report(G, u, '둥지를 무너뜨렸다. 굴 안쪽이 조용해진다.', 'good');
      for (const m of G.mons) if (m.nest === N.id) m.mode = 'raid';
      alarm(G, `${unitName(u)} 둥지를 무너뜨림`, N.at);
    }
  }
  function hurtUnit(G, u, dmg) { u.hp -= dmg * UNIT[u.k].def; u.hit = G.turn; }
  function frontier(G, u) {
    // 밝혀지지 않은 칸과 맞닿은 가장 가까운 밝은 칸
    const { d } = bfs([u.at], j => G.mons.some(m => m.at === j));
    let best = null, bd = 1e9;
    for (let i = 0; i < W * H; i++) {
      if (d[i] < 0 || !G.explored[i] || WALL[i]) continue;
      if (!NB(i).some(j => !G.explored[j]) && !(G.nests.some(N => N.alive && N.seen && dist(N.at, i) <= 1))) continue;
      const taken = G.units.some(o => o !== u && o.order.kind === 'auto' && o.goal === i);
      const score = d[i] + (taken ? 6 : 0);
      if (score < bd && d[i] > 0) { bd = score; best = i; }
    }
    u.goal = best;
    return best;
  }
  // 보이는 마물의 다음 두 수 (화면에 화살표로)
  function plans(G) {
    const occ = new Set([...G.units.map(u => u.at), ...G.mons.map(m => m.at), HQ]);
    for (const m of G.mons) {
      m.plan = [];
      if (!G.vis[m.at]) continue;
      if (G.units.some(u => dist(u.at, m.at) === 1) || dist(m.at, HQ) === 1) continue;
      const T = MON[m.type], seenU = G.units.filter(u => sees(m.at, u.at, T.sight));
      const goal = seenU.length ? nearest(seenU, m.at).at : m.last != null && G.turn - m.lastT < 4 ? m.last : m.mode === 'raid' ? HQ : null;
      if (goal == null) continue;
      const o = new Set(occ); o.delete(m.at); for (const u of G.units) o.delete(u.at);
      m.plan = pathToward(m.at, goal, o, 2);
    }
  }
  // 보급선 그림: 본부에서 그 칸까지
  function supplyPath(G, at) { const out = []; let c = at; if (!G.supplyD || G.supplyD[at] < 0) return out; while (c >= 0 && c !== HQ) { out.push(c); c = G.supplyPar[c]; } out.push(HQ); return out; }
  function nestPath(G, m) { const nb = G.nestPar[m.nest]; if (!nb || nb.d[m.at] < 0) return []; const out = []; let c = m.at; while (c >= 0) { out.push(c); c = nb.par[c]; } return out; }

  root.OPMAP = { MAP, W, H, idx, X, Y, WALL, HQ, NEST_AT, UNIT, MON, ORDER, B, NB, dist, los, newGame, tick, command, setContact, orderDelay, supplyPath, nestPath, soldiers };
})(typeof window !== 'undefined' ? window : globalThis);
