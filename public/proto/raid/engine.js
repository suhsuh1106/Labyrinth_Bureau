// 대물 토벌 시제품: 규칙. DOM을 쓰지 않는다 (index.html과 sim/raid.mjs가 함께 쓴다)
// 한 철 = 작전 셋. 작전마다 영입(계약) → 배치(자리 · 노릴 부위) → 자동 전투(틱) → 정산(전리품 · 공 · 길드 마음)
(function (root) {
  const COLS = 10, ROWS = 5;
  const OPS = 3;

  const KINDS = {
    shield: { name: '방패조', hp: 44, pow: 1.8, move: 2, armor: 0.5, hold: 2, fee: 45 },
    red: { name: '돌격조', hp: 26, pow: 4, move: 2, armor: 1, hold: 1, fee: 55 },
    wolf: { name: '척후조', hp: 18, pow: 2.4, move: 1, armor: 1, hold: 0.5, fee: 35 },
  };
  const GUILDS = [
    { id: 'red', name: '붉은 깃발단', short: '깃발', color: '#e5654f', kind: 'red', want: 'horn', ace: '베르크' },
    { id: 'shield', name: '은빛 방패단', short: '방패', color: '#8fc0ea', kind: 'shield', want: 'arm', ace: '이세른' },
    { id: 'wolf', name: '잿빛 늑대단', short: '늑대', color: '#d6cc9c', kind: 'wolf', want: 'core', ace: '카야' },
  ];
  const NG = GUILDS.length;
  // 부위: 어느 쪽에 붙어야 칠 수 있나. 부수면 무엇이 꺼지나
  const PARTS = {
    horn: { name: '뿔', side: 'top', off: '포효가 멎음' },
    arm: { name: '팔', side: 'front', off: '앞발이 약해짐' },
    leg: { name: '다리', side: 'bottom', off: '걸음이 느려지고 짓밟기가 멎음' },
    core: { name: '핵', side: 'back', off: '쓰러짐' },
  };
  const PART_IDS = ['horn', 'arm', 'leg', 'core'];
  const MONSTERS = [
    { name: '바위등', hp: { horn: 30, arm: 40, leg: 36, core: 55 }, step: 7, arm: 6, armEvery: 3, roar: [10, 3], stomp: [4, 4], tail: [5, 2],
      loot: { horn: 90, arm: 40, leg: 40, core: 110 },
      intro: '사흘 전부터 심층 계단의 표식석이 흔들렸다. 오늘 새벽, 그것이 3층 회랑까지 올라왔다. 등에 얹힌 것이 바위인지 껍질인지, 본 사람마다 말이 달랐다.' },
    { name: '잿빛 껍질', hp: { horn: 42, arm: 58, leg: 50, core: 80 }, step: 6, arm: 8, armEvery: 3, roar: [9, 4], stomp: [4, 5], tail: [5, 3],
      loot: { horn: 120, arm: 55, leg: 55, core: 150 },
      intro: '첫째가 쓰러진 자리에서 열흘이 채 지나지 않아 둘째가 올라왔다. 껍질은 더 두꺼웠고, 걸음은 더 빨랐다.' },
    { name: '심층의 어미', hp: { horn: 44, arm: 60, leg: 54, core: 92 }, step: 5, arm: 9, armEvery: 3, roar: [8, 5], stomp: [3, 5], tail: [5, 3],
      loot: { horn: 160, arm: 70, leg: 70, core: 200 },
      intro: '심층 바닥이 통째로 들썩였다. 표식석 보고서에는 크기를 적을 칸이 모자랐고, 중앙은 답신 대신 관할 지도를 한 장 더 보내왔다.' },
  ];
  const B = { HPX: 1.8, DMGX: 1.3, START_BUDGET: 320, GRANT: 160, KILL_GRANT: 80, MAX_SQUAD: 5, DOCS: 2, DOC_DELAY: 3, DEPLOY_MAX_X: 4, START_X: 7 };

  // 받침에 따라 이/가, 을/를, 으로/로
  const jong = w => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c < 11172 ? c % 28 : 0; };
  const iga = w => w + (jong(w) ? '이' : '가');
  const euro = w => w + (jong(w) && jong(w) !== 8 ? '으로' : '로');

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

  // ---- 한 철 ----
  function newCampaign(seed) {
    const C = { seed, rng: mkRng(seed || 1), op: 0, budget: B.START_BUDGET, town: 100, gw: [55, 55, 55], aceAlive: [true, true, true], nextId: 1, history: [], dead: 0, offers: [] };
    C.offers = makeOffers(C);
    return C;
  }
  const feeOf = (C, g, base) => Math.round(base * (1.45 - C.gw[g] / 100));
  // 길드 마음이 영입 조건을 바꾼다: 몇 조를 내주는지, 이름난 조장을 내주는지, 값은 얼마인지
  function makeOffers(C) {
    const out = [];
    for (let g = 0; g < NG; g++) {
      const G = GUILDS[g], K = KINDS[G.kind], gw = C.gw[g];
      const n = gw >= 60 ? 3 : gw >= 35 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const v = 0.9 + C.rng() * 0.2;
        out.push(party(C, g, G.kind, `${G.short} ${i + 1}조`, v, 1, false));
      }
      if (gw >= 50 && C.aceAlive[g]) out.push(party(C, g, G.kind, G.ace, 1.45, 1.7, true));
    }
    return out;
  }
  function party(C, g, kind, name, v, feeX, ace) {
    const K = KINDS[kind];
    return { id: C.nextId++, g, kind, name, ace, maxhp: Math.round(K.hp * v), pow: +(K.pow * v).toFixed(1), move: K.move, armor: K.armor, hold: K.hold, fee: feeOf(C, g, K.fee * feeX * v) };
  }

  // ---- 전투 ----
  function bodyCells(x) { const a = []; for (let c = x; c <= x + 1; c++) for (let r = 1; r <= 3; r++) a.push([c, r]); return a; }
  function sideCells(side, x) {
    let a;
    if (side === 'front') a = [[x - 1, 1], [x - 1, 2], [x - 1, 3]];
    else if (side === 'back') a = [[x + 2, 1], [x + 2, 2], [x + 2, 3]];
    else if (side === 'top') a = [[x, 0], [x + 1, 0]];
    else a = [[x, 4], [x + 1, 4]];
    return a.filter(([c, r]) => c >= 0 && c < COLS && r >= 0 && r < ROWS);
  }
  const inBody = (B, c, r) => c >= B.mon.x && c <= B.mon.x + 1 && r >= 1 && r <= 3;
  const occ = (B, c, r, except) => B.parties.some(p => p !== except && p.alive && !p.gone && p.x === c && p.y === r);

  function newBattle(C, squad) {
    const M = MONSTERS[C.op];
    const parts = {};
    for (const k of PART_IDS) parts[k] = { hp: M.hp[k] * B.HPX, max: M.hp[k] * B.HPX, broken: false, dmg: new Map() };
    const Bt = {
      C, M, t: 0, mon: { x: B.START_X, stepCd: M.step }, parts,
      parties: squad.map(p => ({ ...p, hp: p.maxhp, alive: true, gone: false, leaving: false, x: p.x, y: p.y, target: p.target, cd: 0, dealt: 0, hurt: 0, front: 0 })),
      warn: [], fx: [], log: [], docs: [], docsLeft: B.DOCS, over: null,
    };
    planAttacks(Bt);
    return Bt;
  }
  function validDeploy(squad) {
    const seen = new Set();
    for (const p of squad) {
      if (p.x == null || p.x < 0 || p.x > B.DEPLOY_MAX_X || p.y < 0 || p.y >= ROWS) return '배치 칸 밖에 선 조가 있음';
      const k = p.x + ',' + p.y; if (seen.has(k)) return '한 칸에 두 조'; seen.add(k);
    }
    return null;
  }

  function say(Bt, text, kind) { Bt.log.push({ t: Bt.t, text, kind: kind || '' }); }
  function hit(Bt, cells, dmg, label) {
    for (const [c, r] of cells) {
      const p = Bt.parties.find(p => p.alive && !p.gone && p.x === c && p.y === r);
      Bt.fx.push({ x: c, y: r, kind: 'mon', text: '' });
      if (!p) continue;
      const d = dmg * p.armor;
      p.hp -= d; p.hurt += d;
      Bt.fx.push({ x: c, y: r, kind: 'hurt', text: '-' + Math.round(d) });
      if (p.hp <= 0) { p.hp = 0; p.alive = false; say(Bt, `${p.name} · ${label}에 쓰러짐`, 'dead'); }
    }
  }

  // 다음 틱에 올 공격을 미리 알린다 (예고 칸)
  function planAttacks(Bt) {
    const M = Bt.M, P = Bt.parts, t = Bt.t + 1, x = Bt.mon.x, w = [];
    if (t % M.armEvery === 0) w.push({ kind: 'arm', cells: sideCells('front', x), dmg: M.arm * (P.arm.broken ? 0.3 : 1), label: '앞발' });
    if (!P.horn.broken && t % M.roar[0] === 0) w.push({ kind: 'roar', cells: ['front', 'back', 'top', 'bottom'].flatMap(s => sideCells(s, x)), dmg: M.roar[1], label: '포효' });
    if (!P.leg.broken && t % M.stomp[0] === 0) w.push({ kind: 'stomp', cells: sideCells('bottom', x), dmg: M.stomp[1], label: '짓밟기' });
    if (t % M.tail[0] === 0) w.push({ kind: 'tail', cells: sideCells('back', x), dmg: M.tail[1], label: '꼬리' });
    Bt.warn = w;
  }

  function issueDoc(Bt, pid, type, target) {
    if (Bt.over) return '끝난 전투';
    if (Bt.docsLeft <= 0) return '서류가 남지 않음';
    const p = Bt.parties.find(p => p.id === pid);
    if (!p || !p.alive || p.gone) return '닿을 조가 없음';
    if (Bt.docs.some(d => d.pid === pid)) return '그 조에 가는 서류가 있음';
    Bt.docsLeft--;
    Bt.docs.push({ pid, type, target, at: Bt.t + B.DOC_DELAY });
    return null;
  }

  // 길 찾기: 몸통을 피하고, 다른 조가 선 칸은 지나갈 수 있으나 설 수는 없다
  function stepToward(Bt, p, goals) {
    const key = (c, r) => c * 10 + r;
    const goalSet = new Set(goals.filter(([c, r]) => !occ(Bt, c, r, p)).map(([c, r]) => key(c, r)));
    if (!goalSet.size) return false;
    const prev = new Map(); const q = [[p.x, p.y]]; prev.set(key(p.x, p.y), null);
    let end = null;
    while (q.length) {
      const [c, r] = q.shift();
      if (goalSet.has(key(c, r))) { end = [c, r]; break; }
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS || inBody(Bt, nc, nr) || prev.has(key(nc, nr))) continue;
        prev.set(key(nc, nr), [c, r]); q.push([nc, nr]);
      }
    }
    if (!end) return false;
    let cur = end, path = [];
    while (cur && !(cur[0] === p.x && cur[1] === p.y)) { path.unshift(cur); cur = prev.get(key(cur[0], cur[1])); }
    const nxt = path[0];
    if (nxt && !occ(Bt, nxt[0], nxt[1], p)) { p.x = nxt[0]; p.y = nxt[1]; return true; }
    return false;
  }

  function onSide(Bt, p, side) { return sideCells(side, Bt.mon.x).some(([c, r]) => c === p.x && r === p.y); }
  function fallback(Bt) { for (const k of ['core', 'horn', 'arm', 'leg']) if (!Bt.parts[k].broken) return k; return 'core'; }

  function tick(Bt) {
    if (Bt.over) return;
    const M = Bt.M, P = Bt.parts;
    Bt.t++; Bt.fx = [];
    // 서류 도착
    for (const d of Bt.docs.slice()) if (d.at <= Bt.t) {
      Bt.docs.splice(Bt.docs.indexOf(d), 1);
      const p = Bt.parties.find(p => p.id === d.pid); if (!p || !p.alive || p.gone) continue;
      if (d.type === 'retreat') { p.leaving = true; say(Bt, `${p.name} · 후퇴령을 받음`, 'doc'); }
      else { p.target = d.target; say(Bt, `${p.name} · ${euro(PARTS[d.target].name)} 표적을 옮김`, 'doc'); }
    }
    // 대물의 공격 (지난 틱에 예고한 것)
    for (const a of Bt.warn) hit(Bt, a.cells, a.dmg * B.DMGX, a.label);
    // 조의 움직임 · 공격
    for (const p of Bt.parties) {
      if (!p.alive || p.gone) continue;
      if (p.leaving) {
        if (p.x === 0) { p.gone = true; say(Bt, `${p.name} · 계단 위로 빠짐`, 'doc'); continue; }
        if (p.cd > 0) { p.cd--; continue; }
        stepToward(Bt, p, [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]]); p.cd = p.move - 1; continue;
      }
      if (P[p.target].broken) p.target = fallback(Bt);
      const side = PARTS[p.target].side;
      if (onSide(Bt, p, side)) {
        const part = P[p.target];
        const d = p.pow * (0.85 + Bt.C.rng() * 0.3);
        part.hp -= d; p.dealt += d;
        part.dmg.set(p.id, (part.dmg.get(p.id) || 0) + d);
        Bt.fx.push({ x: p.x, y: p.y, kind: 'atk', text: '' });
        if (part.hp <= 0 && !part.broken) {
          part.hp = 0; part.broken = true;
          say(Bt, `${iga(PARTS[p.target].name)} 부서짐 · ${PARTS[p.target].off}`, 'good');
          if (p.target === 'core') { Bt.over = 'kill'; break; }
        }
      } else {
        if (p.cd > 0) { p.cd--; continue; }
        stepToward(Bt, p, sideCells(side, Bt.mon.x)); p.cd = p.move - 1;
      }
      if (onSide(Bt, p, 'front')) p.front++;
    }
    if (Bt.over) return finish(Bt);
    // 대물의 걸음: 앞을 막아선 조가 많을수록 더디다. 다리가 부서지면 절반
    let hold = 0;
    for (const p of Bt.parties) if (p.alive && !p.gone && onSide(Bt, p, 'front')) hold += p.hold;
    Bt.mon.stepCd -= 1 / (1 + hold * 0.45);
    if (Bt.mon.stepCd <= 0) {
      Bt.mon.stepCd = M.step * (P.leg.broken ? 2 : 1);
      if (Bt.mon.x <= 1) { Bt.over = 'through'; say(Bt, `${iga(M.name)} 계단을 넘음`, 'dead'); return finish(Bt); }
      Bt.mon.x--;
      // 몸통이 들어온 칸의 조는 밀려나며 다친다
      for (const p of Bt.parties) {
        if (!p.alive || p.gone || !inBody(Bt, p.x, p.y)) continue;
        p.hp -= 4 * p.armor; p.hurt += 4 * p.armor;
        Bt.fx.push({ x: p.x, y: p.y, kind: 'hurt', text: '-' + Math.round(4 * p.armor) });
        if (p.hp <= 0) { p.hp = 0; p.alive = false; say(Bt, `${p.name} · 몸통에 깔림`, 'dead'); continue; }
        const spots = [[p.x - 1, p.y], [p.x - 1, p.y - 1], [p.x - 1, p.y + 1], [p.x - 2, p.y], [p.x, 0], [p.x, 4]];
        const s = spots.find(([c, r]) => c >= 0 && r >= 0 && r < ROWS && !inBody(Bt, c, r) && !occ(Bt, c, r, p));
        if (s) { p.x = s[0]; p.y = s[1]; } else { p.hp = 0; p.alive = false; say(Bt, `${p.name} · 몸통에 깔림`, 'dead'); }
      }
    }
    if (!Bt.parties.some(p => p.alive && !p.gone)) {
      // 남은 조가 없으면 대물은 그대로 계단을 넘는다
      Bt.over = 'through'; say(Bt, `막아설 조가 없음 · ${iga(M.name)} 계단을 넘음`, 'dead'); return finish(Bt);
    }
    planAttacks(Bt);
  }

  // ---- 정산 ----
  function finish(Bt) {
    const C = Bt.C, M = Bt.M, P = Bt.parts, R = { op: C.op, name: M.name, outcome: Bt.over, loot: 0, credit: [], lost: [], gwBefore: C.gw.slice(), lines: [], town: 0, grant: 0 };
    const dg = [0, 0, 0];
    for (const k of PART_IDS) {
      const part = P[k]; if (!part.broken) continue;
      R.loot += M.loot[k];
      let best = null, bd = -1;
      for (const [id, d] of part.dmg) if (d > bd) { bd = d; best = id; }
      const p = Bt.parties.find(q => q.id === best);
      if (!p) continue;
      const wanted = GUILDS[p.g].want === k;
      dg[p.g] += wanted ? 10 : 4;
      R.credit.push({ part: k, pid: p.id, name: p.name, g: p.g, wanted });
      // 원하던 부위를 남이 가져가면 서운하다
      for (let g = 0; g < NG; g++) if (g !== p.g && GUILDS[g].want === k && Bt.parties.some(q => q.g === g)) { dg[g] -= 5; R.lines.push({ g, key: 'taken', part: k }); }
      if (wanted) R.lines.push({ g: p.g, key: 'got', part: k });
    }
    for (const p of Bt.parties) {
      if (p.alive) { dg[p.g] += 2; continue; }
      C.dead++; dg[p.g] -= p.ace ? 25 : 14;
      if (p.ace) C.aceAlive[p.g] = false;
      R.lost.push({ name: p.name, g: p.g, ace: p.ace });
      R.lines.push({ g: p.g, key: 'dead', name: p.name });
    }
    // 부르지 않은 길드는 조금 식는다
    for (let g = 0; g < NG; g++) if (!Bt.parties.some(p => p.g === g)) { dg[g] -= 4; R.lines.push({ g, key: 'skipped' }); }
    if (Bt.over === 'kill') { R.grant = B.KILL_GRANT; }
    else { const left = P.core.hp / P.core.max; R.town = Math.round(25 + 30 * left); C.town = Math.max(0, C.town - R.town); }
    for (let g = 0; g < NG; g++) C.gw[g] = Math.max(0, Math.min(100, C.gw[g] + dg[g]));
    C.budget += R.loot + R.grant;
    R.dg = dg; R.gwAfter = C.gw.slice();
    C.history.push(R);
    Bt.result = R;
    return R;
  }

  function nextOp(C) {
    C.op++;
    if (C.op >= OPS || C.town <= 0) { C.over = true; return; }
    C.budget += B.GRANT;
    C.offers = makeOffers(C);
  }

  root.RAID = { iga, euro, COLS, ROWS, OPS, KINDS, GUILDS, PARTS, PART_IDS, MONSTERS, B, newCampaign, newBattle, validDeploy, tick, issueDoc, nextOp, sideCells, bodyCells, inBody };
})(typeof window !== 'undefined' ? window : globalThis);
