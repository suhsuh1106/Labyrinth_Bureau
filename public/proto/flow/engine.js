// 구역 흐름 관제 시제품: 규칙. DOM을 쓰지 않는다 (index.html과 sim.mjs가 함께 쓴다)
// 하루 = 4틱. 미궁 하나 = 4층 × 3구역. 사람은 길드별 흐름, 마물은 구역별 밀도
(function (root) {
  const DAY_TICKS = 4, DT = 1 / DAY_TICKS;
  const SEASON = 60;
  const FLOORS = 4, COLS = 3, NZ = FLOORS * COLS;
  const COL_NAME = ['서쪽 굴', '중앙 회랑', '동쪽 갱도'];
  const FLOOR_NAME = ['1층', '2층', '3층', '심층'];
  const ENTR = 1; // 1층 중앙 회랑 = 입구. 사람이 드나들고, 마물도 여기로 넘친다
  const zf = z => (z / COLS) | 0, zc = z => z % COLS;
  const zoneName = z => FLOOR_NAME[zf(z)] + ' ' + COL_NAME[zc(z)];
  const NB = [];
  for (let z = 0; z < NZ; z++) {
    const f = zf(z), c = zc(z), n = [];
    if (f > 0) n.push(z - COLS);
    if (f < FLOORS - 1) n.push(z + COLS);
    if (c > 0) n.push(z - 1);
    if (c < COLS - 1) n.push(z + 1);
    NB.push(n);
  }
  // 위로 한 칸 (1층 옆 구역은 입구 쪽으로, 입구는 마을로 = -1)
  const UP = z => zf(z) > 0 ? z - COLS : (z === ENTR ? -1 : ENTR);

  const B = {
    RMAX: [18, 30, 48, 70], EAST: 1.35,   // 층마다 캘 것의 끝 (동쪽 갱도는 광맥)
    VAL: [1, 1.4, 2, 2.8],                // 층마다 캔 것의 값
    TAX: 0.3,                             // 캔 값 중 관리국 몫
    REGEN: 0.035,
    SPAWN: [0.04, 0.1, 0.28, 0.75], SPAWN_GROW: 0.06, // 틱마다 구역 하나에 새로 나는 마물, 날마다 늘어남
    SPILL_T: [22, 30, 40, 55], SPILL_K: 0.1, SPILL_UP: 0.6, SEAL_HOLD: 0.35,
    TOWN_HIT: 0.3,
    CAP: 30, CAP_SUP: 50, CAP_ENTR: 45, // 입구는 넓은 홀
    KILL: 0.09, KILL_SUP: 1.4, GATHER: 0.1,
    DEATH_K: 0.006, DEATH_P: 1.5, DEATH_MAX: 0.15, DEATH_SUP: 0.55, CROWD_D: 0.004,
    MOVE: 0.15, TEMP: 0.6, PERC: 0.06,     // 흐름: 틱마다 옮겨 갈 몫 · 고르는 결 · 소문이 따라오는 빠르기
    FLEE: 4, RETURN: 0.035, ENTER: 0.05, RECRUIT: 0.8,
    SURGE_AT: 220, SURGE_DAYS: 3, SURGE_CD: 10, SURGE_X: 2.5,
    START_BUDGET: 120,
  };

  const GUILDS = [
    { id: 'red', name: '붉은 깃발단', short: '깃발', color: '#e5654f', pool: 90, loot: 1.2, bounty: 0.5, supply: 0.3, danger: 0.5, depth: 0.15, fav: 2 },
    { id: 'shield', name: '은빛 방패단', short: '방패', color: '#8fc0ea', pool: 70, loot: 0.6, bounty: 0.4, supply: 1.0, danger: 1.4, depth: -0.25, fav: 1 },
    { id: 'wolf', name: '잿빛 늑대단', short: '늑대', color: '#d6cc9c', pool: 60, loot: 0.9, bounty: 1.6, supply: 0.2, danger: 0.35, depth: 0, fav: 0 },
  ];
  const NG = GUILDS.length;
  const NAMED = [
    { name: '베르크', g: 0, title: '붉은 깃발단 조장' },
    { name: '이세른', g: 1, title: '은빛 방패단 기사장' },
    { name: '카야', g: 2, title: '잿빛 늑대단 두목' },
  ];
  const DOCS = {
    bounty: { name: '현상금', cost: 50, dur: 8 },
    supply: { name: '보급소', cost: 80, build: 2 },
    seal: { name: '봉쇄', cost: 30 },
    unseal: { name: '봉쇄 해제', cost: 0 },
    retreat: { name: '후퇴령', cost: 20, block: 2 },
  };
  const OBS = [{ lag: 1.0, see: 2 }, { lag: 0.55, see: 3, cost: 100 }, { lag: 0.25, see: 4, cost: 160 }];

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
  const rmax = z => B.RMAX[zf(z)] * (zc(z) === 2 ? B.EAST : 1);
  const travel = z => 0.3 + 0.45 * zf(z);                   // 서류가 구역에 닿기까지 날
  const lagOf = (W, f) => (f + 1) * OBS[W.obs].lag * 0.5;    // 표식석 보고가 늦는 날

  function newWorld(seed) {
    const rng = mkRng(seed || 1);
    const W = {
      seed, rng, t: 0, budget: B.START_BUDGET, town: 100, taxSum: 0, deaths: 0, deathsG: new Array(NG).fill(0),
      H: GUILDS.map(() => new Float64Array(NZ)), perc: GUILDS.map(() => new Float64Array(NZ)),
      M: new Float64Array(NZ), R: new Float64Array(NZ),
      pool: GUILDS.map(g => g.pool), transit: [], gw: new Array(NG).fill(55),
      bounty: new Float64Array(NZ), supply: new Uint8Array(NZ), supplyAt: new Float64Array(NZ),
      seal: new Uint8Array(NZ), block: new Float64Array(NZ),
      docs: [], obs: 0, obsAt: 0,
      surge: 0, surgeCD: 0, pd: new Float64Array(NZ), dayLoss: GUILDS.map(() => new Float64Array(NZ)),
      named: NAMED.map(n => ({ ...n, z: -1, alive: true, wait: 0.5 + rng() * 2 })),
      hist: [], log: [], logQ: [], over: null, spilled: 0,
      flags: { front: new Uint8Array(NZ), crowd: new Uint8Array(NZ) },
    };
    for (let z = 0; z < NZ; z++) {
      W.R[z] = rmax(z);
      W.M[z] = [4, 9, 18, 32][zf(z)] * (0.8 + 0.4 * rng());
    }
    for (let g = 0; g < NG; g++) {
      W.H[g][ENTR] = 10; W.H[g][ENTR + COLS] = 6; W.pool[g] -= 16;
      for (let z = 0; z < NZ; z++) W.perc[g][z] = value(W, g, z);
    }
    snap(W);
    return W;
  }

  const total = (W, z) => { let s = 0; for (let g = 0; g < NG; g++) s += W.H[g][z]; return s; };
  const capOf = (W, z) => (W.supply[z] === 2 ? B.CAP_SUP - B.CAP : 0) + (z === ENTR ? B.CAP_ENTR : B.CAP);
  const closed = (W, z) => W.seal[z] === 1 || W.block[z] > W.t;
  const effH = (W, z) => { const h = total(W, z), c = capOf(W, z); return h <= c ? h : c + (h - c) * 0.35; };

  function value(W, g, z) {
    const G = GUILDS[g], f = zf(z), H = total(W, z);
    const danger = Math.min(4, W.M[z] / (H + 8));
    const crowd = Math.max(0, H / capOf(W, z) - 0.8);
    const bw = W.gw[g] < 30 ? G.bounty * 0.4 : G.bounty;
    return G.loot * W.R[z] * B.VAL[f] / 40
      + (W.bounty[z] > 0 ? bw * 3 : 0)
      + (W.supply[z] === 2 ? G.supply * 1.5 : 0)
      - G.danger * danger
      + (zc(z) === G.fav ? 0.8 : 0)
      + G.depth * f
      - 2 * crowd;
  }

  function say(W, z, text, kind) {
    const f = z < 0 ? 0 : zf(z);
    W.logQ.push({ at: W.t + (z < 0 ? 0 : lagOf(W, f)), day: W.t, z, text, kind: kind || '' });
  }

  function issue(W, type, z) {
    const D = DOCS[type];
    if (!D || W.over) return '끝난 판';
    if (W.budget < D.cost) return '예산 모자람';
    if (W.docs.some(d => d.z === z && d.type === type)) return '같은 서류가 가는 중';
    if (type === 'supply' && W.supply[z]) return '이미 보급소가 있음';
    if (type === 'seal' && W.seal[z]) return '이미 봉쇄됨';
    if (type === 'unseal' && !W.seal[z]) return '봉쇄되지 않음';
    if (type === 'bounty' && W.bounty[z] > 2) return '현상금이 걸려 있음';
    W.budget -= D.cost;
    W.docs.push({ type, z, from: W.t, at: W.t + travel(z) });
    return null;
  }

  function upgradeObs(W) {
    const n = OBS[W.obs + 1];
    if (!n || W.obsAt) return '더 올릴 수 없음';
    if (W.budget < n.cost) return '예산 모자람';
    W.budget -= n.cost; W.obsAt = W.t + 1;
    return null;
  }

  function moveAll(W, z, to) { // z의 사람을 모두 to로 (to = -1이면 마을로)
    for (let g = 0; g < NG; g++) {
      const n = W.H[g][z]; if (n <= 0) continue;
      W.H[g][z] = 0;
      if (to < 0) W.transit.push({ g, n, at: W.t + 0.5 }); else W.H[g][to] += n;
    }
    for (const p of W.named) if (p.alive && p.z === z) { p.z = to; if (to < 0) p.wait = 1.5; }
  }

  function arrive(W, d) {
    const z = d.z, name = zoneName(z);
    if (d.type === 'bounty') {
      W.bounty[z] = DOCS.bounty.dur;
      for (let g = 0; g < NG; g++) W.gw[g] += GUILDS[g].bounty * 2;
      say(W, z, `${name} · 현상금 방이 붙음`, 'doc');
    } else if (d.type === 'supply') {
      W.supply[z] = 1; W.supplyAt[z] = W.t + DOCS.supply.build;
      say(W, z, `${name} · 보급소 자재가 닿음`, 'doc');
    } else if (d.type === 'seal') {
      W.seal[z] = 1;
      const H = total(W, z) + 1;
      for (let g = 0; g < NG; g++) W.gw[g] -= (zc(z) === GUILDS[g].fav ? 8 : 0) + 4 * W.H[g][z] / H;
      say(W, z, `${name} · 목책이 섬`, 'doc');
    } else if (d.type === 'unseal') {
      W.seal[z] = 0;
      for (let g = 0; g < NG; g++) if (zc(z) === GUILDS[g].fav) W.gw[g] += 3;
      say(W, z, `${name} · 목책이 걷힘`, 'doc');
    } else if (d.type === 'retreat') {
      const hot = W.pd[z] > 0.02;
      for (let g = 0; g < NG; g++) if (W.H[g][z] > 3) W.gw[g] += hot ? 5 : -3;
      W.block[z] = W.t + DOCS.retreat.block;
      say(W, z, hot ? `${name} · 조들이 물러남. 뒤에서 마물이 길을 메움` : `${name} · 조들이 물러남. 자루는 반쯤 빈 채`, 'doc');
      moveAll(W, z, UP(z));
    }
  }

  function snap(W) {
    W.hist.push({
      t: W.t, H: W.H.map(a => Float32Array.from(a)), M: Float32Array.from(W.M), R: Float32Array.from(W.R),
      pd: Float32Array.from(W.pd), named: W.named.map(p => (p.alive ? p.z : -2)),
    });
    if (W.hist.length > 48) W.hist.shift();
  }

  // 국장이 보는 것: 층마다 늦은 표식석 보고
  function view(W, f) {
    const back = Math.round(lagOf(W, f) * DAY_TICKS);
    return W.hist[Math.max(0, W.hist.length - 1 - back)];
  }
  const seesMonsters = (W, f) => f < OBS[W.obs].see;

  function tick(W) {
    if (W.over) return;
    const rng = W.rng;
    W.t += DT;
    const t = W.t;
    // 서류 도착
    for (const d of W.docs.slice()) if (d.at <= t) { arrive(W, d); W.docs.splice(W.docs.indexOf(d), 1); }
    for (let z = 0; z < NZ; z++) if (W.supply[z] === 1 && W.supplyAt[z] <= t) { W.supply[z] = 2; say(W, z, `${zoneName(z)} · 보급소에 불이 들어옴`, 'doc'); }
    if (W.obsAt && W.obsAt <= t) { W.obs++; W.obsAt = 0; say(W, -1, `상황판 · 표식석 ${W.obs === 1 ? '중계소' : '심층 중계소'}가 이어짐`, 'doc'); }

    // 소문: 길드가 아는 구역의 값은 천천히 따라온다
    for (let g = 0; g < NG; g++) for (let z = 0; z < NZ; z++) W.perc[g][z] += (value(W, g, z) - W.perc[g][z]) * B.PERC;

    // 들어옴 · 돌아옴
    for (let g = 0; g < NG; g++) {
      const gwF = 0.4 + Math.max(0, Math.min(100, W.gw[g])) / 100;
      W.pool[g] += B.RECRUIT * gwF;
      if (!closed(W, ENTR)) { const n = W.pool[g] * B.ENTER * gwF; W.pool[g] -= n; W.H[g][ENTR] += n; }
    }
    for (let i = W.transit.length - 1; i >= 0; i--) { const r = W.transit[i]; if (r.at <= t) { W.pool[r.g] += r.n; W.transit.splice(i, 1); } }

    // 흐름
    for (let g = 0; g < NG; g++) {
      const H = W.H[g], P = W.perc[g], nH = new Float64Array(H);
      for (let z = 0; z < NZ; z++) {
        const h = H[z]; if (h < 0.01) continue;
        // 돌아감
        const ret = h * B.RETURN; nH[z] -= ret; W.transit.push({ g, n: ret, at: t + (zf(z) + 1) * 0.5 });
        // 달아남: 무너지는 구역에서는 위로
        const up = UP(z), fl = h * Math.min(0.4, W.pd[z] * B.FLEE);
        if (fl > 0) { nH[z] -= fl; if (up < 0) W.transit.push({ g, n: fl, at: t + 0.5 }); else nH[up] += fl; }
        // 옮겨 감
        const shut = closed(W, z);
        const out = (h - ret - fl) * (shut ? 0.5 : B.MOVE);
        const opts = (shut ? [] : [z]).concat(NB[z].filter(n => !closed(W, n)));
        if (!opts.length) { if (shut) { nH[z] -= out; if (up < 0) W.transit.push({ g, n: out, at: t + 0.5 }); else nH[up] += out; } continue; }
        let mx = -1e9; for (const o of opts) mx = Math.max(mx, P[o]);
        let sum = 0; const w = opts.map(o => { const e = Math.exp((P[o] - mx) / B.TEMP); sum += e; return e; });
        nH[z] -= out;
        opts.forEach((o, i) => { nH[o] += out * w[i] / sum; });
      }
      for (let z = 0; z < NZ; z++) H[z] = Math.max(0, nH[z]);
    }

    // 싸움 · 캐기 · 죽음
    for (let z = 0; z < NZ; z++) {
      const f = zf(z), h = total(W, z), he = effH(W, z), m = W.M[z], sup = W.supply[z] === 2;
      const kills = Math.min(m, B.KILL * he * (sup ? B.KILL_SUP : 1) * m / (m + 12));
      W.M[z] = m - kills;
      let pd = Math.min(B.DEATH_MAX, B.DEATH_K * Math.pow(m / (he + 4), B.DEATH_P)) * (sup ? B.DEATH_SUP : 1);
      const cap = capOf(W, z);
      if (h > cap) pd += B.CROWD_D * (h / cap - 1);
      W.pd[z] = pd;
      for (let g = 0; g < NG; g++) {
        const d = W.H[g][z] * pd; if (d <= 0) continue;
        W.H[g][z] -= d; W.deaths += d; W.deathsG[g] += d; W.dayLoss[g][z] += d;
      }
      const gather = Math.min(W.R[z], B.GATHER * he * (1 - Math.min(0.8, m / (m + 40))));
      W.R[z] += (rmax(z) - W.R[z]) * B.REGEN - gather;
      const tax = gather * B.VAL[f] * B.TAX; W.budget += tax; W.taxSum += tax;
      // 표시: 전선 · 과밀
      const front = h > 3 && m > 10 && pd > 0.012, crowd = h > cap * 1.3;
      if (front && !W.flags.front[z] && pd > 0.035) say(W, z, `${zoneName(z)} · 전선이 밀림`, 'bad');
      W.flags.front[z] = front && pd > 0.035 ? 1 : (pd < 0.02 ? 0 : W.flags.front[z]);
      if (crowd && !W.flags.crowd[z]) say(W, z, `${zoneName(z)} · 사람이 몰려 길이 막힘`, 'warn');
      W.flags.crowd[z] = crowd ? 1 : (h < cap ? 0 : W.flags.crowd[z]);
    }

    // 마물: 깊은 데서 나고, 차면 위로 밀려 오른다
    const grow = 1 + t * B.SPAWN_GROW;
    for (let z = 0; z < NZ; z++) W.M[z] += B.SPAWN[zf(z)] * grow * (W.surge > 0 && zf(z) >= 2 ? B.SURGE_X : 1) * (0.85 + 0.3 * rng());
    const dM = new Float64Array(NZ);
    for (let z = 0; z < NZ; z++) {
      const T = B.SPILL_T[zf(z)] * (W.surge > 0 ? 0.8 : 1);
      if (W.M[z] <= T) continue;
      let ex = (W.M[z] - T) * B.SPILL_K;
      if (W.seal[z]) ex *= B.SEAL_HOLD;
      const up = UP(z), side = NB[z].filter(n => zf(n) === zf(z));
      const targets = [[up, B.SPILL_UP]].concat(side.map(s => [s, (1 - B.SPILL_UP) / side.length]));
      for (const [to, share] of targets) {
        let n = ex * share;
        if (to >= 0 && W.seal[to]) n *= B.SEAL_HOLD;
        dM[z] -= n;
        if (to < 0) { W.town -= n * B.TOWN_HIT; W.spilled += n; } else dM[to] += n;
      }
    }
    for (let z = 0; z < NZ; z++) W.M[z] = Math.max(0, W.M[z] + dM[z]);

    // 파동: 심층이 차면 (날짜가 아니라 상태로)
    if (W.surge > 0) W.surge -= DT;
    if (W.surgeCD > 0) W.surgeCD -= DT;
    let deep = 0; for (let c = 0; c < COLS; c++) deep += W.M[(FLOORS - 1) * COLS + c];
    if (deep > B.SURGE_AT && W.surgeCD <= 0) {
      W.surge = B.SURGE_DAYS; W.surgeCD = B.SURGE_CD;
      say(W, (FLOORS - 1) * COLS + 1, '심층 · 표식석이 한꺼번에 떨림', 'bad');
    }

    // 이름 있는 이들
    for (const p of W.named) {
      if (!p.alive) continue;
      if (p.z < 0) {
        p.wait -= DT;
        if (p.wait <= 0 && !closed(W, ENTR)) { p.z = ENTR; say(W, -1, `${p.name}(${GUILDS[p.g].short}) · 입구로 내려감`, 'name'); }
        continue;
      }
      if (rng() < W.pd[p.z] * 0.3) {
        p.alive = false;
        W.gw[p.g] -= 15;
        say(W, p.z, `${zoneName(p.z)} · ${p.name}의 표식석이 꺼짐`, 'dead');
        continue;
      }
      if (closed(W, p.z)) { p.z = UP(p.z); if (p.z < 0) p.wait = 1.5; continue; }
      if (rng() < 0.03) { p.z = -1; p.wait = 1.5 + rng() * 2.5; continue; }
      if (rng() < 0.12) {
        const opts = [p.z].concat(NB[p.z].filter(n => !closed(W, n)));
        const P = W.perc[p.g];
        let mx = -1e9; for (const o of opts) mx = Math.max(mx, P[o]);
        const w = opts.map(o => Math.exp((P[o] - mx) / B.TEMP)); let s = w.reduce((a, b) => a + b, 0) * rng();
        for (let i = 0; i < opts.length; i++) { s -= w[i]; if (s <= 0) { p.z = opts[i]; break; } }
      }
    }

    // 하루가 바뀔 때
    if (Math.abs(t - Math.round(t)) < 1e-6) {
      for (let z = 0; z < NZ; z++) if (W.bounty[z] > 0) W.bounty[z] = Math.max(0, W.bounty[z] - 1);
      for (let g = 0; g < NG; g++) {
        for (let z = 0; z < NZ; z++) {
          const l = W.dayLoss[g][z];
          if (l >= 5) { W.gw[g] -= Math.min(8, l * 0.5); say(W, z, `${zoneName(z)} · ${GUILDS[g].name}의 조 ${Math.round(l)}명이 돌아오지 못함`, 'dead'); }
          W.dayLoss[g][z] = 0;
        }
        W.gw[g] += (50 - W.gw[g]) * 0.02;
        W.gw[g] = Math.max(0, Math.min(100, W.gw[g]));
      }
    }

    // 늦은 보고 풀기
    for (let i = 0; i < W.logQ.length; i++) { const e = W.logQ[i]; if (e.at <= t) { W.log.push(e); W.logQ.splice(i--, 1); } }
    if (W.log.length > 80) W.log.splice(0, W.log.length - 80);

    snap(W);
    if (W.town <= 0) { W.town = 0; W.over = 'fall'; }
    else if (t >= SEASON - 1e-9) W.over = 'season';
  }

  root.FLOW = { B, DAY_TICKS, DT, SEASON, FLOORS, COLS, NZ, COL_NAME, FLOOR_NAME, ENTR, GUILDS, NAMED, DOCS, OBS,
    zf, zc, zoneName, NB, UP, rmax, travel, lagOf, newWorld, tick, issue, upgradeObs, view, seesMonsters, total, capOf, closed };
})(typeof window !== 'undefined' ? window : globalThis);
