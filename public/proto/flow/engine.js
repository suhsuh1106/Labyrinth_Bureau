// 구역 흐름 관제 시제품 2판: 규칙. DOM을 쓰지 않는다 (index.html과 sim/flow.mjs가 함께 쓴다)
// 하루 = 4틱. 미궁 하나 = 4층 × 3구역. 사람은 길드별 흐름, 마물은 구역별 밀도
// 국장은 조를 부리지 않는다. 사람이 스스로 내려가고 올라오는 고리(고갈 · 숙련 · 시세)의 조건을 제도로 바꾼다
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
  // 통로(흐름 화살표 자리): a < b
  const EDGES = [];
  for (let z = 0; z < NZ; z++) for (const n of NB[z]) if (n > z) EDGES.push([z, n]);
  const edgeOf = (a, b) => { for (let i = 0; i < EDGES.length; i++) { const e = EDGES[i]; if (e[0] === a && e[1] === b) return [i, 1]; if (e[0] === b && e[1] === a) return [i, -1]; } return [-1, 0]; };
  const EIDX = Array.from({ length: NZ }, (_, a) => Array.from({ length: NZ }, (_, b) => edgeOf(a, b)));
  // 위로 한 칸 (1층 옆 구역은 입구 쪽으로, 입구는 마을로 = -1)
  const UP = z => zf(z) > 0 ? z - COLS : (z === ENTR ? -1 : ENTR);

  const B = {
    RMAX: [20, 32, 48, 70], EAST: 1.3,    // 층마다 캘 것의 끝 (동쪽 갱도는 광맥)
    REGEN: [0.012, 0.02, 0.03, 0.04],     // 얕은 층은 더디게 찬다 = 캐면 바닥난다 (고갈 고리)
    VAL: [1, 1.5, 2.2, 3],                // 층마다 캔 것의 바탕 시세
    DEMAND: [14, 9, 6, 4],             // 하루에 시장이 값을 깎지 않고 받는 양 (시세 고리)
    SOLD_EMA: 0.08,
    GATHER: 0.1, KILL: 0.12, MLOOT: 0.6, MLOOT_V: 0.03, // 마물 하나를 잡으면 나오는 몫 · 길드가 그걸 셈하는 무게
    M0: [3, 6, 12, 22], SPAWN: [0.04, 0.1, 0.25, 0.6], SPAWN_GROW: 0.08,
    SPILL_T: [22, 30, 40, 55], SPILL_K: 0.1, SPILL_UP: 0.6, SEAL_HOLD: 0.35,
    TOWN_HIT: 0.4,
    CAP: 30, CAP_CAMP: 50, CAP_ENTR: 45,
    PARTY: 12, DEATH_K: 0.006, DEATH_P: 1.5, DEATH_MAX: 0.15, CAMP_SAFE: 0.6, CROWD_D: 0.004,
    MOVE: 0.3, TEMP: 0.55, PERC: 0.05,   // 흐름: 틱마다 옮겨 갈 몫 · 고르는 결 · 소문이 따라오는 빠르기
    FAR: 0.55, FAR_CAMP: 0.35,            // 층 하나 깊어질 때마다 먼 길 (기지가 있으면 줄어듦)
    UPKEEP: 0.8, // 들어가 있는 값(품삯 · 보급): 캘 것이 없으면 나온다
    FLEE: 4, RETURN: 0.035, IDLE_GO: 0.08, ENTER: 0.05, RECRUIT: 0.25, RECRUIT_K: 0.03, // 신참: 바탕 + 길드 벌이(하루)에 비례 (몸집 고리)
    // 숙련 고리: 깊이 다녀오면 늘고, 많이 죽어 신참으로 채우면 묽어진다
    XP: 0.0015, ROOKIE: 0.12, SKILL0: 0.4,
    SURGE_AT: 220, SURGE_DAYS: 3, SURGE_CD: 10, SURGE_X: 2.5,
    START_BUDGET: 150, TAX0: 0.2, TAX_MAX: 0.4, BUY_STEP: 0.25,
  };

  const GUILDS = [
    { id: 'red', name: '붉은 깃발단', short: '깃발', color: '#e5654f', pool: 90, loot: 1.2, danger: 0.6, fav: 2, taxHate: 1.2 },
    { id: 'shield', name: '은빛 방패단', short: '방패', color: '#8fc0ea', pool: 70, loot: 0.7, danger: 1.3, fav: 1, taxHate: 0.6 },
    { id: 'wolf', name: '잿빛 늑대단', short: '늑대', color: '#d6cc9c', pool: 60, loot: 1.0, danger: 0.4, fav: 0, taxHate: 1.0 },
  ];
  const NG = GUILDS.length;
  const NAMED = [
    { name: '베르크', g: 0, title: '붉은 깃발단 조장' },
    { name: '이세른', g: 1, title: '은빛 방패단 기사장' },
    { name: '카야', g: 2, title: '잿빛 늑대단 두목' },
  ];
  // 구역에 거는 서류 (깊을수록 늦게 닿음). 제도(세율 · 수매가 · 출입)는 공고라서 값이 아니라 소문으로 늦는다
  const DOCS = {
    camp: { name: '전진 기지', cost: 90, build: 3 },
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
  const travel = z => 0.3 + 0.45 * zf(z);
  const lagOf = (W, f) => (f + 1) * OBS[W.obs].lag * 0.5;

  function newWorld(seed) {
    const rng = mkRng(seed || 1);
    const W = {
      seed, rng, t: 0, budget: B.START_BUDGET, town: 100, deaths: 0, deathsG: new Array(NG).fill(0),
      H: GUILDS.map(() => new Float64Array(NZ)), perc: GUILDS.map(() => new Float64Array(NZ)),
      M: new Float64Array(NZ), R: new Float64Array(NZ),
      pool: GUILDS.map(g => g.pool), transit: [], gw: new Array(NG).fill(55), inc: new Array(NG).fill(15), incDay: new Array(NG).fill(0), want: new Array(NG).fill(1), skill: new Array(NG).fill(B.SKILL0),
      // 시세 · 제도
      sold: B.DEMAND.slice(), soldDay: new Float64Array(FLOORS), price: B.VAL.slice(),
      tax: new Array(FLOORS).fill(B.TAX0), buy: new Array(FLOORS).fill(0), grade: new Array(FLOORS).fill(0),
      money: { tax: 0, buy: 0, docs: 0 }, today: { tax: 0, buy: 0 }, yday: { tax: 0, buy: 0 }, taxSum: 0, buySum: 0,
      camp: new Uint8Array(NZ), campAt: new Float64Array(NZ),
      seal: new Uint8Array(NZ), block: new Float64Array(NZ),
      docs: [], obs: 0, obsAt: 0,
      surge: 0, surgeCD: 0, pd: new Float64Array(NZ), dayLoss: GUILDS.map(() => new Float64Array(NZ)),
      flowP: new Float64Array(EDGES.length), flowM: new Float64Array(EDGES.length),
      named: NAMED.map(n => ({ ...n, z: -1, alive: true, wait: 0.5 + rng() * 2 })),
      hist: [], log: [], logQ: [], over: null, spilled: 0,
      flags: { front: new Uint8Array(NZ), crowd: new Uint8Array(NZ), dry: new Uint8Array(FLOORS), cheap: new Uint8Array(FLOORS), green: new Uint8Array(NG) },
    };
    for (let z = 0; z < NZ; z++) {
      W.R[z] = rmax(z);
      W.M[z] = B.M0[zf(z)] * (0.8 + 0.4 * rng());
    }
    for (let g = 0; g < NG; g++) {
      W.H[g][ENTR] = 10; W.H[g][ENTR + COLS] = 6; W.pool[g] -= 16;
      for (let z = 0; z < NZ; z++) W.perc[g][z] = value(W, g, z);
    }
    snap(W);
    return W;
  }

  const total = (W, z) => { let s = 0; for (let g = 0; g < NG; g++) s += W.H[g][z]; return s; };
  const capOf = (W, z) => (W.camp[z] === 2 ? B.CAP_CAMP - B.CAP : 0) + (z === ENTR ? B.CAP_ENTR : B.CAP);
  const closed = (W, z) => W.seal[z] === 1 || W.block[z] > W.t;
  const effH = (W, z) => { const h = total(W, z), c = capOf(W, z); return h <= c ? h : c + (h - c) * 0.35; };
  const campNear = (W, z) => W.camp[z] === 2 || (zf(z) > 0 && W.camp[z - COLS] === 2);
  // 길드가 받는 값: 시세와 수매가 중 큰 쪽에서 세를 뗀 것
  const netPrice = (W, f) => Math.max(W.price[f], W.buy[f]) * (1 - W.tax[f]);
  const roster = (W, g) => { let n = W.pool[g]; for (let z = 0; z < NZ; z++) n += W.H[g][z]; for (const r of W.transit) if (r.g === g) n += r.n; return n; };

  function value(W, g, z) {
    const G = GUILDS[g], f = zf(z), H = total(W, z), sk = W.skill[g];
    const danger = Math.min(4, W.M[z] / (H + B.PARTY));
    const crowd = Math.max(0, H / capOf(W, z) - 0.8);
    let v = G.loot * (W.R[z] / 40 + Math.min(W.M[z], 80) * B.MLOOT_V) * netPrice(W, f) // 캘 것 + 잡을 것(마물도 값이 된다)
      - G.danger * danger * (1.4 - sk) * (campNear(W, z) ? B.CAMP_SAFE : 1)
      + (zc(z) === G.fav ? 0.7 : 0)
      - f * (campNear(W, z) ? B.FAR_CAMP : B.FAR)
      - 2 * crowd
      - B.UPKEEP;
    if (W.grade[f] && sk < 0.5) v -= 3 * (0.5 - sk) / 0.5 + 0.5; // 출입 등급: 고참이 적은 길드는 들기 어렵다
    return v;
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
    if (type === 'camp' && W.camp[z]) return '이미 기지가 있음';
    if (type === 'seal' && W.seal[z]) return '이미 봉쇄됨';
    if (type === 'unseal' && !W.seal[z]) return '봉쇄되지 않음';
    W.budget -= D.cost; W.money.docs += D.cost;
    W.docs.push({ type, z, from: W.t, at: W.t + travel(z) });
    return null;
  }

  // 제도: 층마다 세율 · 수매가 · 출입 등급. 바로 바뀌지만 길드는 소문으로 늦게 안다
  function setPolicy(W, kind, f, dir) {
    if (W.over) return;
    if (kind === 'tax') W.tax[f] = Math.round(Math.max(0, Math.min(B.TAX_MAX, W.tax[f] + dir * 0.05)) * 100) / 100;
    else if (kind === 'buy') W.buy[f] = Math.max(0, Math.min(B.VAL[f] * 1.5, W.buy[f] + dir * B.BUY_STEP * (f + 1)));
    else if (kind === 'grade') W.grade[f] = W.grade[f] ? 0 : 1;
  }

  function upgradeObs(W) {
    const n = OBS[W.obs + 1];
    if (!n || W.obsAt) return '더 올릴 수 없음';
    if (W.budget < n.cost) return '예산 모자람';
    W.budget -= n.cost; W.money.docs += n.cost; W.obsAt = W.t + 1;
    return null;
  }

  function addFlow(arr, a, b, n) { if (b < 0) return; const [i, s] = EIDX[a][b]; if (i >= 0) arr[i] += s * n; }

  function moveAll(W, z, to) {
    for (let g = 0; g < NG; g++) {
      const n = W.H[g][z]; if (n <= 0) continue;
      W.H[g][z] = 0;
      if (to < 0) W.transit.push({ g, n, at: W.t + 0.5 }); else { W.H[g][to] += n; addFlow(W.flowP, z, to, n); }
    }
    for (const p of W.named) if (p.alive && p.z === z) { p.z = to; if (to < 0) p.wait = 1.5; }
  }

  function arrive(W, d) {
    const z = d.z, name = zoneName(z);
    if (d.type === 'camp') {
      W.camp[z] = 1; W.campAt[z] = W.t + DOCS.camp.build;
      say(W, z, `${name} · 기지 자재가 닿음`, 'doc');
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
      flowP: Float32Array.from(W.flowP), flowM: Float32Array.from(W.flowM),
    });
    if (W.hist.length > 48) W.hist.shift();
    W.flowP.fill(0); W.flowM.fill(0);
  }

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
    for (const d of W.docs.slice()) if (d.at <= t) { arrive(W, d); W.docs.splice(W.docs.indexOf(d), 1); }
    for (let z = 0; z < NZ; z++) if (W.camp[z] === 1 && W.campAt[z] <= t) { W.camp[z] = 2; say(W, z, `${zoneName(z)} · 전진 기지에 불이 들어옴`, 'doc'); }
    if (W.obsAt && W.obsAt <= t) { W.obs++; W.obsAt = 0; say(W, -1, `상황판 · 표식석 ${W.obs === 1 ? '중계소' : '심층 중계소'}가 이어짐`, 'doc'); }

    // 소문: 길드가 아는 구역의 값은 천천히 따라온다
    for (let g = 0; g < NG; g++) for (let z = 0; z < NZ; z++) W.perc[g][z] += (value(W, g, z) - W.perc[g][z]) * B.PERC;

    // 들어옴 · 돌아옴 · 신참
    for (let g = 0; g < NG; g++) {
      const gwF = 0.4 + Math.max(0, Math.min(100, W.gw[g])) / 100;
      const rec = (B.RECRUIT + B.RECRUIT_K * W.inc[g]) * gwF, n0 = roster(W, g);
      W.skill[g] = (W.skill[g] * n0 + B.ROOKIE * rec) / (n0 + rec);
      W.pool[g] += rec;
      let best = -9; for (let z = 0; z < NZ; z++) best = Math.max(best, W.perc[g][z]);
      const want = Math.max(0.15, Math.min(1.5, 0.6 + 0.4 * best)); // 남는 데가 없으면 들지 않는다
      W.want[g] = want;
      if (!closed(W, ENTR)) { const n = W.pool[g] * B.ENTER * gwF * want; W.pool[g] -= n; W.H[g][ENTR] += n; }
    }
    for (let i = W.transit.length - 1; i >= 0; i--) { const r = W.transit[i]; if (r.at <= t) { W.pool[r.g] += r.n; W.transit.splice(i, 1); } }

    // 흐름
    for (let g = 0; g < NG; g++) {
      const H = W.H[g], P = W.perc[g], nH = new Float64Array(H);
      for (let z = 0; z < NZ; z++) {
        const h = H[z]; if (h < 0.01) continue;
        const ret = h * (B.RETURN + B.IDLE_GO * Math.min(1, Math.max(0, -P[z]))); nH[z] -= ret; W.transit.push({ g, n: ret, at: t + (zf(z) + 1) * 0.5 });
        const up = UP(z), fl = h * Math.min(0.4, W.pd[z] * B.FLEE);
        if (fl > 0) { nH[z] -= fl; if (up < 0) W.transit.push({ g, n: fl, at: t + 0.5 }); else { nH[up] += fl; addFlow(W.flowP, z, up, fl); } }
        const shut = closed(W, z);
        const out = (h - ret - fl) * (shut ? 0.5 : B.MOVE);
        const opts = (shut ? [] : [z]).concat(NB[z].filter(n => !closed(W, n)));
        if (!opts.length) { if (shut) { nH[z] -= out; if (up < 0) W.transit.push({ g, n: out, at: t + 0.5 }); else { nH[up] += out; addFlow(W.flowP, z, up, out); } } continue; }
        let mx = -1e9; for (const o of opts) mx = Math.max(mx, P[o]);
        let sum = 0; const w = opts.map(o => { const e = Math.exp((P[o] - mx) / B.TEMP); sum += e; return e; });
        nH[z] -= out;
        opts.forEach((o, i) => { const n = out * w[i] / sum; nH[o] += n; if (o !== z) addFlow(W.flowP, z, o, n); });
      }
      for (let z = 0; z < NZ; z++) H[z] = Math.max(0, nH[z]);
    }

    // 싸움 · 캐기 · 죽음 · 숙련
    const xp = new Array(NG).fill(0);
    for (let z = 0; z < NZ; z++) {
      const f = zf(z), h = total(W, z), he = effH(W, z), m = W.M[z], camp = W.camp[z] === 2;
      let sk = 0; for (let g = 0; g < NG; g++) sk += W.H[g][z] * W.skill[g]; sk = h > 0 ? sk / h : B.SKILL0;
      const kills = Math.min(m, B.KILL * he * (0.5 + sk) * m / (m + 12));
      W.M[z] = m - kills;
      let pd = Math.min(B.DEATH_MAX, B.DEATH_K * Math.pow(m / (he + B.PARTY), B.DEATH_P)) * (1.5 - sk) * (camp ? B.CAMP_SAFE : 1);
      const cap = capOf(W, z);
      if (h > cap) pd += B.CROWD_D * (h / cap - 1);
      W.pd[z] = pd;
      for (let g = 0; g < NG; g++) {
        const d = W.H[g][z] * pd;
        xp[g] += W.H[g][z] * (f + 1) * (1 + Math.min(1, m / 30));
        if (d <= 0) continue;
        W.H[g][z] -= d; W.deaths += d; W.deathsG[g] += d; W.dayLoss[g][z] += d;
      }
      const dug = Math.min(W.R[z], B.GATHER * he * (1 - Math.min(0.8, m / (m + 40))));
      W.R[z] += (rmax(z) - W.R[z]) * B.REGEN[f] - dug;
      const gather = dug + kills * B.MLOOT;
      W.soldDay[f] += gather;
      // 돈: 시세가 수매가보다 낮으면 관리국이 수매가로 사서 시세로 되판다
      const p = W.price[f], b = W.buy[f], take = Math.max(p, b);
      const tax = gather * take * W.tax[f], buy = b > p ? gather * (b - p) : 0;
      if (h > 0) for (let g = 0; g < NG; g++) W.incDay[g] += gather * W.H[g][z] / h * take * (1 - W.tax[f]);
      W.budget += tax - buy; W.taxSum += tax; W.buySum += buy; W.today.tax += tax; W.today.buy += buy;
      const front = h > 3 && m > 10 && pd > 0.012, crowd = h > cap * 1.3;
      if (front && !W.flags.front[z] && pd > 0.035) say(W, z, `${zoneName(z)} · 전선이 밀림`, 'bad');
      W.flags.front[z] = front && pd > 0.035 ? 1 : (pd < 0.02 ? 0 : W.flags.front[z]);
      if (crowd && !W.flags.crowd[z]) say(W, z, `${zoneName(z)} · 사람이 몰려 길이 막힘`, 'warn');
      W.flags.crowd[z] = crowd ? 1 : (h < cap ? 0 : W.flags.crowd[z]);
    }
    for (let g = 0; g < NG; g++) { const n = roster(W, g); if (n > 1) W.skill[g] = Math.min(1, W.skill[g] + B.XP * xp[g] / n); }
    if (W.budget < 0) { // 빚으로는 사지 못한다: 수매가가 저절로 내려간다
      for (let f = 0; f < FLOORS; f++) if (W.buy[f] > 0) { W.buy[f] = 0; say(W, -1, `${FLOOR_NAME[f]} 수매 · 금고가 비어 멈춤`, 'bad'); }
      W.budget = 0;
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
        if (to < 0) { W.town -= n * B.TOWN_HIT; W.spilled += n; } else { dM[to] += n; addFlow(W.flowM, z, to, n); }
      }
    }
    for (let z = 0; z < NZ; z++) W.M[z] = Math.max(0, W.M[z] + dM[z]);

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
        p.alive = false; W.gw[p.g] -= 15;
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

    // 하루가 바뀔 때: 시세 · 호감 · 손실 보고
    if (Math.abs(t - Math.round(t)) < 1e-6) {
      for (let f = 0; f < FLOORS; f++) {
        W.sold[f] += (W.soldDay[f] - W.sold[f]) * B.SOLD_EMA * 4; W.soldDay[f] = 0;
        const D = B.DEMAND[f];
        W.price[f] = B.VAL[f] * Math.min(1.8, 2 * D / (D + W.sold[f]));
        const r = W.price[f] / B.VAL[f];
        if (r < 0.7 && !W.flags.cheap[f]) say(W, -1, `왕도 시장 · ${FLOOR_NAME[f]}에서 나온 것이 남아돎`, 'warn');
        W.flags.cheap[f] = r < 0.7 ? 1 : (r > 0.85 ? 0 : W.flags.cheap[f]);
        let rr = 0; for (let c = 0; c < COLS; c++) rr += W.R[f * COLS + c] / rmax(f * COLS + c); rr /= COLS;
        if (rr < 0.3 && !W.flags.dry[f]) say(W, f * COLS + 1, `${FLOOR_NAME[f]} · 캘 것이 바닥을 보임`, 'warn');
        W.flags.dry[f] = rr < 0.3 ? 1 : (rr > 0.5 ? 0 : W.flags.dry[f]);
      }
      let mt = 0; for (let f = 0; f < FLOORS; f++) mt += W.tax[f] / FLOORS;
      let nbuy = 0; for (let f = 0; f < FLOORS; f++) if (W.buy[f] > 0) nbuy++;
      for (let g = 0; g < NG; g++) {
        for (let z = 0; z < NZ; z++) {
          const l = W.dayLoss[g][z];
          if (l >= 5) { W.gw[g] -= Math.min(8, l * 0.5); say(W, z, `${zoneName(z)} · ${GUILDS[g].name}의 조 ${Math.round(l)}명이 돌아오지 못함`, 'dead'); }
          W.dayLoss[g][z] = 0;
        }
        const target = 50 + 80 * (B.TAX0 - mt) * GUILDS[g].taxHate + 4 * nbuy;
        W.gw[g] += (target - W.gw[g]) * 0.04;
        W.gw[g] = Math.max(0, Math.min(100, W.gw[g]));
        const green = W.skill[g] < 0.25;
        if (green && !W.flags.green[g]) say(W, -1, `${GUILDS[g].name} · 낯선 얼굴이 늘어남`, 'warn');
        W.flags.green[g] = green ? 1 : (W.skill[g] > 0.32 ? 0 : W.flags.green[g]);
      }
      for (let g = 0; g < NG; g++) { W.inc[g] += (W.incDay[g] - W.inc[g]) * 0.3; W.incDay[g] = 0; }
      W.yday = W.today; W.today = { tax: 0, buy: 0 };
    }

    for (let i = 0; i < W.logQ.length; i++) { const e = W.logQ[i]; if (e.at <= t) { W.log.push(e); W.logQ.splice(i--, 1); } }
    if (W.log.length > 80) W.log.splice(0, W.log.length - 80);

    snap(W);
    if (W.town <= 0) { W.town = 0; W.over = 'fall'; }
    else if (t >= SEASON - 1e-9) W.over = 'season';
  }

  root.FLOW = { B, DAY_TICKS, DT, SEASON, FLOORS, COLS, NZ, COL_NAME, FLOOR_NAME, ENTR, GUILDS, NAMED, DOCS, OBS, EDGES,
    zf, zc, zoneName, NB, UP, rmax, travel, lagOf, newWorld, tick, issue, setPolicy, upgradeObs, view, seesMonsters, total, capOf, closed, netPrice, roster };
})(typeof window !== 'undefined' ? window : globalThis);
