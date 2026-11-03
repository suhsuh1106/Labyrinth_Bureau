// 다중 전선 지휘 시제품: 규칙. DOM을 쓰지 않는다 (index.html과 sim/front.mjs가 함께 쓴다)
// 전선(판) 여덟이 저절로 굴러간다. 판마다 따로 파도가 오고, 마물 종류마다 이기는 교리가 다르다.
// 국장은 지휘력으로 칙령을 박는다(교리 · 증원 · 붕락 · 봉쇄). 뚫린 판의 마물은 입구 쪽 판으로 넘어가 다음 파도를 키운다.
(function (root) {
  const DT = 0.1;                 // 한 틱 = 0.1초
  const ROWS = 2, COLS = 4, NB = ROWS * COLS, LANE = 10;
  const COL_NAME = ['1층', '2층', '3층', '심층'], ROW_NAME = ['서쪽', '동쪽'];
  const bName = b => `${COL_NAME[b % COLS]} ${ROW_NAME[(b / COLS) | 0]}`;
  const bCol = b => b % COLS, bRow = b => (b / COLS) | 0;

  // 교리: 사수(자리를 지킴) · 돌격(밀고 나감) · 지연(물러나며 쏨)
  const DOCTRINES = {
    hold: { name: '사수', short: '사', speed: 0, take: 0.75, deal: 1, range: 0.8 },
    charge: { name: '돌격', short: '돌', speed: 1.2, take: 1.15, deal: 1.4, range: 0.8 },
    delay: { name: '지연', short: '지', speed: 0.7, take: 1, deal: 0.7, range: 1.8 },
  };
  // 마물: 떼(많고 약함) · 갑각(적고 단단함) · 돌진(빠르고 셈). 상성: 떼↔사수, 갑각↔돌격, 돌진↔지연
  const TYPES = {
    swarm: { name: '떼', hp: 4, dmg: 1.5, speed: 1.0, n: 1.0, vs: { hold: [0.5, 1.4], charge: [2.2, 0.7], delay: [1.2, 0.7] } },
    armor: { name: '갑각', hp: 15, dmg: 2.4, speed: 0.5, n: 0.3, vs: { hold: [1.0, 0.65], charge: [0.8, 1.6], delay: [0.9, 0.8] } },
    charger: { name: '돌진', hp: 6, dmg: 2.4, speed: 2.0, n: 0.5, vs: { hold: [0.9, 1.0], charge: [1.3, 0.85], delay: [0.6, 1.5] } },
  };
  // vs[doctrine] = [아군이 받는 피해 배수, 아군이 주는 피해 배수]
  const EDICTS = {
    doctrine: { name: '교리 변경', cost: 1 },
    reinforce: { name: '증원', cost: 2, n: 4 },
    collapse: { name: '붕락', cost: 3, dmg: 12, hurt: 4 },
    seal: { name: '봉쇄', cost: 2, dur: 25 },
    all: { name: '전 전선 교리', cost: 3 },
  };
  const B = {
    TIME: 360, CP_MAX: 6, CP_REGEN: 1 / 3, RESERVE: 16, RES_PER_CLEAR: 1,
    ALLY_HP: 10, ALLY_DMG: 2, START_ALLIES: 6,
    WAVE_GAP: [16, 28], WAVE_BASE: 3, WAVE_GROW: 0.0045, DEPTH: [0.8, 1, 1.25, 1.5], FIRST: [6, 22],
    BREACH_MAX: 8, REFILL: 10, FULL: 6, TOWN: 100, TOWN_HIT: 1, LEAK_ADD: 1, FALL_LEAK: 0.6,
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
  const pickType = rng => { const r = rng(); return r < 0.4 ? 'swarm' : r < 0.7 ? 'armor' : 'charger'; };

  function newGame(seed) {
    const rng = mkRng(seed || 1);
    const G = { seed, rng, t: 0, cp: 3, reserve: B.RESERVE, town: B.TOWN, over: null, nid: 1, boards: [], log: [], fx: [], leaks: [], stats: { cleared: 0, fell: 0, lost: 0, killed: 0, edicts: 0 } };
    for (let b = 0; b < NB; b++) {
      const bd = { id: b, doctrine: 'hold', allies: [], mons: [], breach: 0, fallen: false, sealed: 0, pending: 0, wave: 0, waveIdx: 0,
        next: { at: B.FIRST[0] + rng() * (B.FIRST[1] - B.FIRST[0]) + bCol(b) * 2, type: pickType(rng), size: 0 }, flash: null };
      for (let i = 0; i < B.START_ALLIES; i++) bd.allies.push(ally(G, 1.5 + rng() * 1.5));
      bd.next.size = waveSize(G, bd);
      G.boards.push(bd);
    }
    return G;
  }
  function ally(G, x) { return { id: G.nid++, x, hp: B.ALLY_HP, max: B.ALLY_HP, cd: 0 }; }
  function waveSize(G, bd) {
    const T = TYPES[bd.next.type];
    return Math.max(1, Math.round(B.WAVE_BASE * (1 + G.t * B.WAVE_GROW) * B.DEPTH[bCol(bd.id)] * T.n * 2) + Math.round(bd.pending));
  }
  function say(G, b, text, kind) { G.log.push({ t: G.t, b, text, kind: kind || '' }); if (G.log.length > 60) G.log.shift(); }

  function spawnWave(G, bd) {
    const T = TYPES[bd.next.type];
    let target = bd;
    if (bd.sealed > 0) { // 봉쇄: 파도는 같은 층의 다른 판으로 돌아간다
      target = G.boards[(1 - bRow(bd.id)) * COLS + bCol(bd.id)];
      say(G, bd.id, `${bName(bd.id)} 봉쇄 · 파도가 ${bName(target.id)}로 돌아감`, 'warn');
      G.leaks.push({ from: bd.id, to: target.id, t: G.t });
    }
    for (let i = 0; i < bd.next.size; i++) target.mons.push({ id: G.nid++, type: bd.next.type, x: LANE + 0.3 + i * (0.9 / Math.max(1, T.speed)) * 0.6, hp: T.hp, max: T.hp, slow: 0 });
    bd.pending = 0; bd.waveIdx++;
    const gap = B.WAVE_GAP[0] + G.rng() * (B.WAVE_GAP[1] - B.WAVE_GAP[0]);
    bd.next = { at: G.t + gap, type: pickType(G.rng), size: 0 };
    bd.next.size = waveSize(G, bd);
  }

  function edict(G, kind, b, arg) {
    if (G.over) return '끝난 판';
    const E = EDICTS[kind], bd = G.boards[b];
    if (G.cp < E.cost) return '지휘력이 모자람';
    if (kind === 'doctrine') { if (!bd || bd.doctrine === arg) return '이미 그 교리'; bd.doctrine = arg; bd.flash = { text: DOCTRINES[arg].name, t: G.t, kind: 'doc' }; }
    else if (kind === 'all') { let ch = 0; for (const x of G.boards) if (!x.fallen && x.doctrine !== arg) { x.doctrine = arg; x.flash = { text: DOCTRINES[arg].name, t: G.t, kind: 'doc' }; ch++; } if (!ch) return '바꿀 판이 없음'; }
    else if (kind === 'reinforce') {
      if (G.reserve <= 0) return '예비대가 없음';
      const n = Math.min(E.n, Math.floor(G.reserve)); G.reserve -= n;
      for (let i = 0; i < n; i++) bd.allies.push(ally(G, 0.4 + i * 0.3));
      if (bd.fallen) { bd.fallen = false; bd.breach = Math.floor(B.BREACH_MAX / 2); say(G, b, `${bName(b)} · 증원이 닿아 다시 줄을 세움`, 'good'); }
      bd.flash = { text: '증원', t: G.t, kind: 'good' };
    } else if (kind === 'collapse') {
      let k = 0;
      for (const m of bd.mons) if (m.x < LANE) { m.hp -= E.dmg; k++; }
      for (const a of bd.allies) a.hp -= E.hurt;
      bd.flash = { text: '붕락', t: G.t, kind: 'bad' };
      if (!k) { /* 비어 있는 판에 쏟아도 지휘력은 쓰인다 */ }
    } else if (kind === 'seal') {
      if (bd.sealed > 0) return '이미 봉쇄됨';
      bd.sealed = E.dur; bd.flash = { text: '봉쇄', t: G.t, kind: 'warn' };
    }
    G.cp -= E.cost; G.stats.edicts++;
    return null;
  }

  function tick(G) {
    if (G.over) return;
    G.t += DT;
    G.cp = Math.min(B.CP_MAX, G.cp + B.CP_REGEN * DT);
    for (const bd of G.boards) {
      // 길드가 빈자리를 천천히 채운다 (무너진 판은 채우지 않는다)
      if (!bd.fallen && bd.allies.length < B.FULL) { bd.refill = (bd.refill || 0) + DT; if (bd.refill >= B.REFILL) { bd.refill = 0; bd.allies.push(ally(G, 0.3)); } } else bd.refill = 0;
      if (bd.sealed > 0) bd.sealed = Math.max(0, bd.sealed - DT);
      if (G.t >= bd.next.at) spawnWave(G, bd);
      stepBoard(G, bd);
    }
    // 빈 파도를 다 막아 낸 판은 예비대를 조금 돌려준다
    G.leaks = G.leaks.filter(l => G.t - l.t < 1.2);
    if (G.town <= 0) { G.town = 0; G.over = 'fall'; say(G, -1, '입구가 무너짐', 'dead'); }
    else if (G.t >= B.TIME) G.over = 'hold';
  }

  function stepBoard(G, bd) {
    const D = DOCTRINES[bd.doctrine];
    const al = bd.allies, ms = bd.mons;
    // 마물
    for (const m of ms) {
      const T = TYPES[m.type];
      let tgt = null, best = 1e9;
      for (const a of al) { const d = m.x - a.x; if (d >= -0.2 && d < best) { best = d; tgt = a; } }
      if (tgt && best <= 0.8) {
        const vs = T.vs[bd.doctrine];
        tgt.hp -= T.dmg * D.take * vs[0] * DT;
      } else {
        m.x -= T.speed * (m.slow > 0 ? 0.55 : 1) * DT;
      }
      if (m.slow > 0) m.slow -= DT;
    }
    // 아군
    for (const a of al) {
      let tgt = null, best = 1e9;
      for (const m of ms) { const d = m.x - a.x; if (d >= -0.3 && d < best && m.x < LANE) { best = d; tgt = m; } }
      if (bd.doctrine === 'hold') { const home = 2.4 + (a.id % 3) * 0.35; if (Math.abs(a.x - home) > 0.05) a.x += Math.sign(home - a.x) * Math.min(0.8 * DT, Math.abs(home - a.x)); }
      else if (bd.doctrine === 'charge') { if (tgt && best > 0.6) a.x = Math.min(LANE - 0.5, a.x + D.speed * DT); else if (!tgt && a.x > 3) a.x -= 0.5 * DT; }
      else { if (tgt && best < 1.4 && a.x > 0.3) a.x -= D.speed * DT; else if (!tgt && a.x < 3.5) a.x += 0.5 * DT; else if (tgt && best > 1.7) a.x += 0.4 * DT; }
      if (tgt && best <= D.range) {
        const vs = TYPES[tgt.type].vs[bd.doctrine];
        tgt.hp -= B.ALLY_DMG * D.deal * vs[1] * DT;
        if (bd.doctrine === 'delay') tgt.slow = 0.6;
      }
    }
    // 죽음
    for (let i = ms.length - 1; i >= 0; i--) if (ms[i].hp <= 0) { ms.splice(i, 1); G.stats.killed++; }
    for (let i = al.length - 1; i >= 0; i--) if (al[i].hp <= 0) { al.splice(i, 1); G.stats.lost++; }
    // 뚫림: 왼쪽 끝을 넘은 마물은 입구 쪽 판(또는 마을)로 넘어간다
    for (let i = ms.length - 1; i >= 0; i--) {
      if (ms[i].x > 0) continue;
      ms.splice(i, 1);
      leak(G, bd, 1);
      bd.breach++;
      if (!bd.fallen && bd.breach >= B.BREACH_MAX) { bd.fallen = true; G.stats.fell++; say(G, bd.id, `${bName(bd.id)} · 전선이 무너짐`, 'dead'); }
    }
    if (ms.length === 0 && bd._had) { G.stats.cleared++; G.reserve += B.RES_PER_CLEAR; bd.breach = Math.max(0, bd.breach - 1); }
    bd._had = ms.length > 0;
  }

  function leak(G, bd, n) {
    const c = bCol(bd.id);
    if (c === 0) { G.town -= B.TOWN_HIT * n; G.leaks.push({ from: bd.id, to: -1, t: G.t }); return; }
    const to = G.boards[bd.id - 1];
    to.pending += B.LEAK_ADD * n;
    to.next.size = waveSize(G, to);
    G.leaks.push({ from: bd.id, to: to.id, t: G.t });
  }

  root.FRONT = { DT, ROWS, COLS, NB, LANE, COL_NAME, ROW_NAME, bName, bCol, bRow, DOCTRINES, TYPES, EDICTS, B, newGame, tick, edict };
})(typeof window !== 'undefined' ? window : globalThis);
