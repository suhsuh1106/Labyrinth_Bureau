// 작전 지도 시제품(public/proto/opmap)의 봇: node sim/opmap.mjs [판 수]
// idle = 보고를 받아도 명령을 내리지 않음(조는 첫 조우에서 멈춘 채로)
// resume = 보고마다 다시 탐사만 시킴, 계단을 본 조는 귀환
// careful = resume + 다친 조는 귀환, 지도를 많이 쌓은 조는 매핑 아이템을 씀, 전사는 적이 붙으면 지키기
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
new Function(readFileSync(fileURLToPath(new URL('../public/proto/opmap/engine.js', import.meta.url)), 'utf8'))();
const O = globalThis.OPMAP;
for (const [k, v] of Object.entries(process.env)) if (k.startsWith('O_')) O.B[k.slice(2)] = +v;

function resume(G) {
  for (const u of G.units) if (u.order.kind === 'wait' && !u.guard) {
    if (G.stairsSeen && !G.stairsKnown && O.dist(u.at, G.stairs) < 8) O.command(G, u.id, 'home');
    else O.command(G, u.id, 'explore');
  }
}
function careful(G) {
  for (const u of G.units) {
    const max = u.n0 * O.UNIT[u.k].hp, near = G.mons.some(m => O.cheb(m.at, u.at) <= 2);
    if (u.k === 'warrior' && near && u.guard === 0) { O.command(G, u.id, 'guard'); continue; }
    if (u.k === 'warrior' && !near && u.guard === 2) { O.command(G, u.id, 'guard'); continue; }
    if (u.guard) continue;
    if (u.hp < max * 0.5 && u.order.kind !== 'home') { O.command(G, u.id, 'home'); continue; }
    if (u.mem.size > 70 && u.maps > 0) O.command(G, u.id, 'map');
    if (u.k === 'archer' && u.uses > 0) {
      const d = O.DIRS.findIndex(([dx, dy]) => { let c = 0; for (let k = 1; k <= 3; k++) { const x = O.X(u.at) + dx * k, y = O.Y(u.at) + dy * k; if (O.WALL[O.idx(x, y)]) break; c += G.mons.filter(m => m.at === O.idx(x, y)).length; } return c >= 2; });
      if (d >= 0) O.command(G, u.id, 'shot', d);
    }
    if (u.k === 'rogue' && near && u.uses > 0) O.command(G, u.id, 'trap');
  }
  resume(G);
}
const games = +(process.argv[2] || 30);
for (const [name, bot] of [['idle', null], ['resume', resume], ['careful', careful]]) {
  const r = { win: 0, fall: 0, lost: 0, time: 0 }; let turn = 0, kills = 0, lost = 0, maps = 0, homes = 0, alarms = 0;
  for (let s = 1; s <= games; s++) {
    const G = O.newGame(s * 7919); G.autoPause = true;
    while (!G.over) { if (G.alarm) { alarms++; G.alarm = null; if (bot) bot(G); } else if (bot && G.turn % 2 === 0) bot(G); O.tick(G); }
    r[G.over]++; turn += G.turn; kills += G.stats.kills; lost += G.stats.lost; maps += G.stats.maps; homes += G.stats.homes;
  }
  const f = x => (x / games).toFixed(1);
  console.log(`${name.padEnd(8)}: 층 돌파 ${r.win} · 본부 무너짐 ${r.fall} · 전멸 ${r.lost} · 시간 끝 ${r.time} / ${games} · 턴 ${f(turn)} · 쓰러뜨림 ${f(kills)} · 잃은 조 ${f(lost)} · 매핑 ${f(maps)} · 귀환 ${f(homes)} · 경보 ${f(alarms)}`);
}
