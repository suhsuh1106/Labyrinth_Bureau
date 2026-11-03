// 방어선 판 짜기 시제품(public/proto/line)의 봇: node sim/line.mjs [판 수]
// idle = 손 놓음, spread = 회랑 셋에 고르게 펴기, funnel = 갈림길을 한가운데로 몰고 광장을 죽음의 골목으로,
// smart = 몰아넣기 + 예보를 읽어 시설을 바꾸고 들어오는 굴에 앞막이(둥지 막기) + 큰 변수에 신임을 씀
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
new Function(readFileSync(fileURLToPath(new URL('../public/proto/line/engine.js', import.meta.url)), 'utf8'))();
const L = globalThis.LINE;
for (const [k, v] of Object.entries(process.env)) if (k.startsWith('L_')) L.B[k.slice(2)] = +v;

function upkeep(G) {
  for (const z of G.zones) z.cells.forEach((s, c) => { if (s && s.k === 'wall' && s.hp < L.STRUCT.wall.hp) L.repair(G, z.id, c); });
  for (const s of G.squads.slice()) L.refill(G, s.id);
}
function tryList(G, list) {
  for (const [kind, k, z, c] of list) {
    if (kind === 's') { if (!G.zones[z].cells[c] && G.budget >= L.STRUCT[k].cost) L.build(G, z, c, k); }
    else if (!L.squadAt(G, z, c) && G.budget >= L.SQUAD[k].cost) L.hire(G, k, z, c);
  }
}
const spread = {
  plan(G) {
    upkeep(G);
    const list = [];
    for (const z of [3, 4, 5]) list.push(['s', 'wall', z, 4]);
    for (const z of [3, 4, 5]) list.push(['q', 'spear', z, 4]);
    for (const z of [3, 4, 5]) list.push(['q', 'bow', z, 5]);
    for (const z of [3, 4, 5]) list.push(['s', 'trap', z, 2]);
    for (const z of [3, 4, 5]) list.push(['s', 'oil', z, 3]);
    for (const z of [3, 4, 5]) list.push(['s', 'trap', z, 1]);
    tryList(G, list);
  },
};
const box = [['s', 'wall', 4, 4], ['q', 'spear', 4, 4], ['s', 'oil', 4, 3], ['q', 'bow', 4, 5], ['s', 'trap', 4, 2], ['s', 'trap', 4, 1],
  ['s', 'wall', 4, 2], ['s', 'oil', 4, 1], ['q', 'spear', 4, 2], ['q', 'bow', 4, 3], ['s', 'trap', 4, 0], ['q', 'bow', 4, 1]];
const funnel = {
  plan(G) {
    for (const z of [0, 1, 2]) L.setRoute(G, z, 4);
    upkeep(G); tryList(G, box);
  },
};
const smart = {
  plan(G) {
    for (const z of [0, 1, 2]) L.setRoute(G, z, 4);
    upkeep(G);
    const types = new Set(G.next.groups.map(g => g.type));
    const list = [];
    // 파성이 오면 바리케이드 대신 함정 · 창병을 앞에, 날쌘이 오면 바리케이드를 앞 칸에
    if (types.has('brute')) list.push(['s', 'trap', 4, 0], ['s', 'trap', 4, 1]);
    if (types.has('runner')) list.push(['s', 'wall', 4, 2]);
    list.push(...box);
    // 굴에 둥지가 생기면 작은 부대를 남겨 걷어냄
    for (const z of [0, 1, 2]) if (G.zones[z].nest > 0) list.push(['q', 'spear', z, 5]);
    // 남는 예산: 파도가 들어오는 굴에 앞막이(둥지도 막음)
    for (const g of G.next.groups) if (!g.nest) list.push(['s', 'trap', g.src, 1], ['q', 'spear', g.src, 3], ['s', 'wall', g.src, 3], ['s', 'oil', g.src, 2]);
    tryList(G, list);
  },
  onPause(G) {
    const p = G.pause;
    if (p.kind === 'town' || p.kind === 'squad' || (p.kind === 'wall' && p.z === 4)) {
      if (G.trust >= 1 && L.zoneThreat(G, p.z) > 6) L.lever(G, 'rush', p.z, 5);
      if (G.trust >= 2 && L.zoneThreat(G, p.z) > 25 && p.z !== 4) L.lever(G, 'collapse', p.z);
    }
  },
};

const games = +(process.argv[2] || 30);
for (const [name, bot] of [['idle', null], ['spread', spread], ['funnel', funnel], ['smart', smart]]) {
  let fall = 0, town = 0, wave = 0, killed = 0, lost = 0, levers = 0, budget = 0;
  for (let s = 1; s <= games; s++) {
    const G = L.newGame(s * 7919);
    G.autoPause = !!(bot && bot.onPause);
    while (!G.over) {
      if (G.phase === 'plan') { if (bot) bot.plan(G); L.startBattle(G); }
      if (G.pause) { bot.onPause(G); G.pause = null; }
      L.tick(G);
    }
    if (G.over === 'fall') fall++;
    town += G.town; wave += G.wave; killed += G.stats.killed; lost += G.stats.lost; levers += G.stats.levers; budget += G.budget;
  }
  const n = games, f = x => (x / n).toFixed(1);
  console.log(`${name.padEnd(6)}: 마을 무너짐 ${fall}/${n} · 버틴 파도 ${f(wave)} · 남은 마을 ${f(town)} · 쓰러뜨림 ${f(killed)} · 잃은 병사 ${f(lost)} · 개입 ${f(levers)} · 남은 예산 ${f(budget)}`);
}
