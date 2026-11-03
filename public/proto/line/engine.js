// 방어선 판 짜기 시제품: 규칙. DOM을 쓰지 않는다 (index.html과 sim/line.mjs가 함께 쓴다)
// 타이머가 없다. 파도 사이 멈춘 채로 판을 짠다(배치 · 방침 · 갈림길). 전투는 짜 놓은 대로 저절로 굴러가고,
// 큰 변수(숨은 무리 · 바리케이드 무너짐 · 부대 전멸 · 마을에 닿음)가 터질 때만 멈춰서 신임을 써 긴급 개입한다.
// 판 여섯: 아래 셋(굴)에서 마물이 들어와 갈림길을 따라 위 셋(회랑)을 거쳐 마을로 간다.
(function (root) {
  const DT = 0.1, CELLS = 6;
  const ZONES = [
    { id: 0, name: '서쪽 굴', deep: true, exits: [3, 4], x: 0 },
    { id: 1, name: '깊은 홀', deep: true, exits: [3, 4, 5], x: 1 },
    { id: 2, name: '동쪽 굴', deep: true, exits: [4, 5], x: 2 },
    { id: 3, name: '서쪽 회랑', deep: false, exits: [], x: 0 },
    { id: 4, name: '중앙 광장', deep: false, exits: [], x: 1 },
    { id: 5, name: '동쪽 회랑', deep: false, exits: [], x: 2 },
  ];
  // 마물: 떼(많고 약함) · 갑각(화살 · 함정에 강함) · 파성(바리케이드를 부숨) · 날쌘(바리케이드 말고는 막지 못함)
  const MON = {
    swarm: { name: '떼', hp: 3, dmg: 1, bash: 1, speed: 0.9, pow: 1, town: 1, loot: 0.4 },
    armor: { name: '갑각', hp: 16, dmg: 2, bash: 2, speed: 0.45, pow: 4, town: 3, loot: 2, arm: true },
    brute: { name: '파성', hp: 24, dmg: 2, bash: 7, speed: 0.5, pow: 6, town: 4, loot: 3 },
    runner: { name: '날쌘', hp: 5, dmg: 1, bash: 1, speed: 1.6, pow: 1.5, town: 2, loot: 0.8, slip: true },
  };
  // 시설(칸에 하나): 바리케이드(막음) · 함정(들어오는 마물을 침, 세 번) · 기름(이 칸과 위 칸에 셋이 몰리면 불붙음)
  const STRUCT = {
    wall: { name: '바리케이드', cost: 4, hp: 30 },
    trap: { name: '함정', cost: 3, uses: 3, dmg: 7 },
    oil: { name: '기름', cost: 4, dur: 6, dps: 2.5, crowd: 3 },
  };
  // 부대(칸에 하나): 창병(막고 같은 칸을 찌름) · 궁수(아래 세 칸까지 쏨, 막지는 못하지만 마물이 멈춰 덤빔)
  const SQUAD = {
    spear: { name: '창병', cost: 8, n: 4, hp: 6, dps: 1.4, range: 0 },
    bow: { name: '궁수', cost: 10, n: 4, hp: 4, dps: 0.9, range: 3 },
  };
  const LEVER = {
    collapse: { name: '붕락', cost: 2 },   // 판 하나를 무너뜨림: 안의 마물 · 부대 · 시설이 모두 묻히고 다음 파도까지 막힘
    route: { name: '길 돌리기', cost: 1 }, // 굴의 갈림길을 지금 바꿈
    rush: { name: '급파', cost: 1, n: 3 }, // 창병 셋을 지금 보냄(파도가 끝나면 돌아감)
  };
  const STANCE = { hold: '사수', back: '후퇴' };
  const B = {
    WAVES: 10, TOWN: 30, BUDGET: 30, INCOME: 8, TRUST: 2, TRUST_MAX: 3, TRUST_REGEN: 1,
    POW_BASE: 14, POW_GROW: 10, SPAWN_GAP: 0.7, ARM_BOW: 0.35, ARM_TRAP: 0.5,
    REFILL: 2, REPAIR: 2, SELL: 0.5, NEST_PASS: 8, NEST_SPAWN: 2, CLOSE: 1,
    HIDDEN_P: 0.45, HIDDEN_SHARE: 0.35, BACK_AT: 0.4, MAX_T: 150,
  };

  function mkRng(s) {
    let seed = s >>> 0;
    return () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function newGame(seed) {
    const G = {
      seed, rng: mkRng(seed || 1), wave: 0, phase: 'plan', over: null, nid: 1, t: 0,
      budget: B.BUDGET, trust: B.TRUST, town: B.TOWN, autoPause: true, pause: null,
      zones: ZONES.map(z => ({ id: z.id, cells: Array.from({ length: CELLS }, () => null), route: z.deep ? z.id + 3 : null, closed: 0, nest: 0, pass: 0, kills: 0 })),
      squads: [], mons: [], queue: [], fx: [], log: [], report: null, next: null,
      stats: { killed: 0, lost: 0, townHits: 0, levers: 0, spent: 0, loot: 0 },
    };
    G.next = genWave(G);
    return G;
  }

  // 파도 만들기: 힘을 들어오는 굴 몇 곳에 나눔. 숨은 무리는 예보에 나오지 않는다
  function pickType(G, w) {
    const r = G.rng();
    if (w < 1) return 'swarm';
    if (w < 2) return r < 0.6 ? 'swarm' : 'armor';
    if (w < 3) return r < 0.4 ? 'swarm' : r < 0.7 ? 'armor' : 'runner';
    return r < 0.3 ? 'swarm' : r < 0.55 ? 'armor' : r < 0.8 ? 'brute' : 'runner';
  }
  function genWave(G) {
    const w = G.wave, rng = G.rng;
    const pow = B.POW_BASE + B.POW_GROW * w;
    const k = w < 2 ? 1 : w < 5 ? 2 : (rng() < 0.5 ? 2 : 3);
    const srcs = w === 0 ? [1] : [0, 1, 2].sort(() => rng() - 0.5).slice(0, k); // 첫 파도는 늘 깊은 홀에서
    const groups = [];
    const hidden = w >= 2 && rng() < B.HIDDEN_P;
    const shown = hidden ? pow * (1 - B.HIDDEN_SHARE) : pow;
    srcs.forEach((s, i) => {
      const share = shown / k;
      const type = pickType(G, w);
      const n = Math.max(1, Math.round(share / MON[type].pow));
      groups.push({ src: s, type, n, at: i * 2 });
    });
    for (const z of G.zones) if (z.nest > 0) groups.push({ src: z.id, cell: 3, type: 'swarm', n: z.nest * B.NEST_SPAWN, at: 1, nest: true });
    let hid = null;
    if (hidden) {
      const type = pickType(G, w);
      hid = { src: (rng() * 3) | 0, type, n: Math.max(1, Math.round(pow * B.HIDDEN_SHARE / MON[type].pow)), at: 12 + rng() * 14, hidden: true };
    }
    return { groups, hid, pow };
  }

  // ── 계획 단계: 예산으로 시설 · 부대, 갈림길과 방침은 공짜
  const inPlan = G => G.phase === 'plan' && !G.over;
  const squadAt = (G, z, c) => G.squads.find(s => s.zone === z && s.cell === c);
  function build(G, z, c, k) {
    if (!inPlan(G)) return '전투 중';
    if (G.zones[z].cells[c]) return '이미 시설이 있음';
    if (G.budget < STRUCT[k].cost) return '예산 모자람';
    G.budget -= STRUCT[k].cost; G.stats.spent += STRUCT[k].cost;
    G.zones[z].cells[c] = k === 'wall' ? { k, hp: STRUCT.wall.hp } : k === 'trap' ? { k, uses: STRUCT.trap.uses } : { k, burn: 0 };
    return null;
  }
  function sell(G, z, c) {
    if (!inPlan(G)) return '전투 중';
    const s = G.zones[z].cells[c]; if (!s) return '시설 없음';
    G.budget += Math.floor(STRUCT[s.k].cost * B.SELL); G.zones[z].cells[c] = null;
    return null;
  }
  function repair(G, z, c) {
    if (!inPlan(G)) return '전투 중';
    const s = G.zones[z].cells[c]; if (!s || s.k !== 'wall' || s.hp >= STRUCT.wall.hp) return '고칠 것 없음';
    if (G.budget < B.REPAIR) return '예산 모자람';
    G.budget -= B.REPAIR; G.stats.spent += B.REPAIR; s.hp = STRUCT.wall.hp;
    return null;
  }
  function hire(G, k, z, c) {
    if (!inPlan(G)) return '전투 중';
    if (squadAt(G, z, c)) return '이미 부대가 있음';
    if (G.budget < SQUAD[k].cost) return '예산 모자람';
    G.budget -= SQUAD[k].cost; G.stats.spent += SQUAD[k].cost;
    G.squads.push(mkSquad(G, k, z, c, SQUAD[k].n));
    return null;
  }
  function mkSquad(G, k, z, c, n) { return { id: G.nid++, k, zone: z, cell: c, n0: SQUAD[k].n, hp: n * SQUAD[k].hp, stance: 'hold', hit: 0 }; }
  function move(G, id, z, c) {
    if (!inPlan(G)) return '전투 중';
    const s = G.squads.find(q => q.id === id); if (!s) return '부대 없음';
    const o = squadAt(G, z, c); if (o && o !== s) { o.zone = s.zone; o.cell = s.cell; }
    s.zone = z; s.cell = c; return null;
  }
  function stance(G, id) {
    const s = G.squads.find(q => q.id === id); if (!s) return '부대 없음';
    s.stance = s.stance === 'hold' ? 'back' : 'hold'; return null;
  }
  function refill(G, id) {
    if (!inPlan(G)) return '전투 중';
    const s = G.squads.find(q => q.id === id); if (!s) return '부대 없음';
    const max = s.n0 * SQUAD[s.k].hp; if (s.hp >= max) return '가득함';
    const need = Math.ceil((max - s.hp) / SQUAD[s.k].hp) * B.REFILL;
    if (G.budget < need) return '예산 모자람';
    G.budget -= need; G.stats.spent += need; s.hp = max; return null;
  }
  function dismiss(G, id) {
    if (!inPlan(G)) return '전투 중';
    G.squads = G.squads.filter(q => q.id !== id); return null;
  }
  function setRoute(G, z, to, lever) {
    const Z = ZONES[z]; if (!Z.deep || !Z.exits.includes(to)) return '갈 수 없는 길';
    if (G.zones[z].route === to) return '이미 그 길';
    if (!inPlan(G)) {
      if (!lever) return '전투 중';
      if (G.trust < LEVER.route.cost) return '신임 모자람';
      G.trust -= LEVER.route.cost; G.stats.levers++;
      fx(G, z, '길 돌리기');
    }
    G.zones[z].route = to; return null;
  }

  // ── 전투 중 긴급 개입 (신임)
  function lever(G, kind, z, c) {
    if (G.phase !== 'battle' || G.over) return '전투 때만';
    if (kind === 'route') return setRoute(G, z, c, true);
    if (G.trust < LEVER[kind].cost) return '신임 모자람';
    if (kind === 'collapse') {
      const Zs = G.zones[z]; if (Zs.closed) return '이미 막힘';
      for (const m of G.mons) if (m.zone === z) { m.hp = 0; m.buried = true; }
      const lost = G.squads.filter(s => s.zone === z);
      for (const s of lost) G.stats.lost += Math.ceil(s.hp / SQUAD[s.k].hp);
      G.squads = G.squads.filter(s => s.zone !== z);
      Zs.cells = Zs.cells.map(() => null); Zs.closed = B.CLOSE + 1; Zs.nest = 0;
      fx(G, z, '붕락');
    } else if (kind === 'rush') {
      const cc = c == null ? CELLS - 1 : c;
      const q = mkSquad(G, 'spear', z, cc, LEVER.rush.n); q.temp = true; G.squads.push(q);
      fx(G, z, '급파');
    } else return '모르는 개입';
    G.trust -= LEVER[kind].cost; G.stats.levers++;
    return null;
  }
  function fx(G, z, text) { G.fx.push({ z, text, t: G.t, life: 1.6 }); }

  function startBattle(G) {
    if (!inPlan(G)) return '계획 단계가 아님';
    G.phase = 'battle'; G.t = 0; G.mons = []; G.queue = []; G.fx = []; G.pause = null;
    G.cur = { kills: 0, loot: 0, town: 0, lost: 0, events: {}, hiddenShown: false };
    for (const z of G.zones) { z.pass = 0; z.kills = 0; }
    const all = G.next.groups.slice(); if (G.next.hid) all.push(G.next.hid);
    for (const g of all) for (let i = 0; i < g.n; i++) G.queue.push({ at: g.at + i * B.SPAWN_GAP, zone: g.src, cell: g.cell || 0, type: g.type, hidden: !!g.hidden });
    G.queue.sort((a, b) => a.at - b.at);
    return null;
  }

  function nextZone(G, z) {
    const Z = G.zones[z];
    if (!G.zones[Z.route].closed) return Z.route;
    const alt = ZONES[z].exits.find(e => !G.zones[e].closed);
    return alt == null ? null : alt;
  }
  function event(G, kind, z, text) {
    G.log.unshift({ w: G.wave, t: G.t, text });
    if (G.log.length > 40) G.log.pop();
    if (G.autoPause && !G.pause) G.pause = { kind, z, text };
  }

  function tick(G) {
    if (G.phase !== 'battle' || G.over || G.pause) return;
    G.t += DT;
    // 1) 들어옴
    while (G.queue.length && G.queue[0].at <= G.t) {
      const q = G.queue.shift();
      let z = q.zone, cell = q.cell;
      if (G.zones[z].closed) { const n = nextZone(G, z); if (n == null) continue; z = n; cell = 0; }
      const T = MON[q.type];
      G.mons.push({ id: G.nid++, type: q.type, hp: T.hp, max: T.hp, zone: z, cell, pos: 0, hidden: q.hidden });
      if (q.hidden && !G.cur.hiddenShown) { G.cur.hiddenShown = true; event(G, 'hidden', z, `${ZONES[z].name}에 숨은 무리 · ${T.name}`); }
    }
    // 2) 기름
    for (const Z of G.zones) for (let c = 0; c < CELLS; c++) {
      const s = Z.cells[c]; if (!s || s.k !== 'oil') continue;
      const inArea = G.mons.filter(m => m.zone === Z.id && (m.cell === c || m.cell === c + 1) && m.hp > 0);
      if (!s.burn && inArea.length >= STRUCT.oil.crowd) s.burn = STRUCT.oil.dur;
      if (s.burn > 0) {
        for (const m of inArea) m.hp -= STRUCT.oil.dps * DT;
        s.burn -= DT; if (s.burn <= 0) Z.cells[c] = null;
      }
    }
    // 3) 부대가 침
    for (const s of G.squads) {
      const S = SQUAD[s.k], n = Math.ceil(s.hp / S.hp);
      let best = null;
      for (const m of G.mons) {
        if (m.hp <= 0 || m.zone !== s.zone || m.cell > s.cell || m.cell < s.cell - S.range) continue;
        if (!best || m.cell > best.cell || (m.cell === best.cell && m.pos > best.pos)) best = m;
      }
      if (best) best.hp -= n * S.dps * DT * (s.k === 'bow' && MON[best.type].arm ? B.ARM_BOW : 1);
    }
    // 4) 마물이 걷거나 덤빔
    for (const m of G.mons) {
      if (m.hp <= 0) continue;
      const T = MON[m.type], Z = G.zones[m.zone], st = Z.cells[m.cell];
      let blk = null;
      if (st && st.k === 'wall') blk = { wall: st };
      else if (!T.slip) {
        const sq = G.squads.filter(s => s.zone === m.zone && s.cell === m.cell);
        const sp = sq.find(s => s.k === 'spear') || sq[0];
        if (sp) blk = { sq: sp };
      }
      if (blk && m.pos >= 0.5) {
        if (blk.wall) {
          blk.wall.hp -= T.bash * DT;
          if (blk.wall.hp <= 0) { Z.cells[m.cell] = null; event(G, 'wall', m.zone, `${ZONES[m.zone].name} 바리케이드 무너짐`); }
        } else {
          const s = blk.sq; s.hp -= T.dmg * DT; s.hit = G.t;
          if (s.hp <= 0) {
            G.squads = G.squads.filter(q => q !== s); G.stats.lost += s.n0; G.cur.lost += s.n0;
            event(G, 'squad', m.zone, `${ZONES[m.zone].name} ${SQUAD[s.k].name}대 전멸`);
          } else if (s.stance === 'back' && s.hp < s.n0 * SQUAD[s.k].hp * B.BACK_AT) retreat(G, s);
        }
        continue;
      }
      m.pos += T.speed * DT;
      if (blk && m.pos > 0.5) m.pos = 0.5;
      if (m.pos < 1) continue;
      // 다음 칸으로
      m.pos = 0;
      if (m.cell + 1 < CELLS) { m.cell++; enter(G, m); continue; }
      Z.pass += T.pow;
      if (ZONES[m.zone].deep) {
        const n = nextZone(G, m.zone);
        if (n == null) { m.pos = 0.5; continue; }
        m.zone = n; m.cell = 0; enter(G, m);
      } else {
        G.town -= T.town; G.cur.town += T.town; G.stats.townHits += T.town; m.hp = 0; m.gone = true;
        if (!G.cur.events.town) { G.cur.events.town = 1; event(G, 'town', m.zone, `${ZONES[m.zone].name}을 지나 마을에 닿음`); }
      }
    }
    // 5) 쓰러짐
    for (const m of G.mons) if (m.hp <= 0 && !m.gone && !m.buried) {
      const T = MON[m.type]; G.cur.kills++; G.stats.killed++; G.cur.loot += T.loot; G.zones[m.zone].kills++;
    }
    G.mons = G.mons.filter(m => m.hp > 0);
    for (const f of G.fx) f.life -= DT;
    G.fx = G.fx.filter(f => f.life > 0);
    if (G.town <= 0) { G.town = 0; G.over = 'fall'; G.phase = 'over'; return; }
    if ((!G.queue.length && !G.mons.length) || G.t > B.MAX_T) endWave(G);
  }
  function enter(G, m) {
    const s = G.zones[m.zone].cells[m.cell]; if (!s || s.k !== 'trap') return;
    m.hp -= STRUCT.trap.dmg * (MON[m.type].arm ? B.ARM_TRAP : 1);
    if (--s.uses <= 0) G.zones[m.zone].cells[m.cell] = null;
  }
  function retreat(G, s) {
    if (s.cell + 1 < CELLS) { s.cell++; return; }
    if (ZONES[s.zone].deep) { const n = nextZone(G, s.zone); if (n != null) { s.zone = n; s.cell = 0; } }
  }

  function endWave(G) {
    const loot = Math.round(G.cur.loot);
    const income = B.INCOME + loot;
    const nests = [];
    G.squads = G.squads.filter(s => !s.temp); // 급파된 창병은 파도가 끝나면 돌아감
    for (const Z of G.zones) {
      const held = G.squads.some(s => s.zone === Z.id);
      if (held) Z.nest = 0;
      else if (Z.pass >= B.NEST_PASS && !Z.closed && G.wave > 0) { Z.nest++; nests.push(Z.id); } // 첫 파도는 둥지를 남기지 않음
      if (Z.closed) Z.closed--;
    }
    G.budget += income; G.stats.loot += loot;
    G.trust = Math.min(B.TRUST_MAX, G.trust + B.TRUST_REGEN);
    G.report = { wave: G.wave, kills: G.cur.kills, town: G.cur.town, lost: G.cur.lost, loot, income, nests, hidden: !!G.next.hid };
    G.mons = []; G.queue = []; G.pause = null;
    G.wave++;
    if (G.wave >= B.WAVES) { G.over = 'hold'; G.phase = 'over'; return; }
    G.phase = 'plan';
    G.next = genWave(G);
  }

  // 판 하나의 지금 모습 (화면 · 봇이 함께 씀)
  function zoneThreat(G, z) { return G.mons.filter(m => m.zone === z).reduce((s, m) => s + MON[m.type].pow, 0); }

  root.LINE = { DT, CELLS, ZONES, MON, STRUCT, SQUAD, LEVER, STANCE, B, newGame, genWave, build, sell, repair, hire, move, stance, refill, dismiss, setRoute, lever, startBattle, tick, squadAt, zoneThreat, nextZone };
})(typeof window !== 'undefined' ? window : globalThis);
