// 작전 지도 시제품(public/proto/opmap)의 봇: node sim/opmap.mjs [판 수]
// auto = 명령 없이 자동 방침만, volley = 자동 + 보이는 무리의 두 수 뒤 칸에 일제사격,
// commander = 일제사격 + 습격대가 오면 창병을 본부 앞 병목에 세우고 돌격대를 둥지 쪽으로 돌려 줄을 끊음
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
new Function(readFileSync(fileURLToPath(new URL('../public/proto/opmap/engine.js', import.meta.url)), 'utf8'))();
const O = globalThis.OPMAP;
for (const [k, v] of Object.entries(process.env)) if (k.startsWith('O_')) O.B[k.slice(2)] = +v;

function volley(G) {
  const b = G.units.find(u => u.k === 'bow'); if (!b || b.cd > 0 || b.pending) return;
  const vis = G.mons.filter(m => G.vis[m.at] && m.plan.length);
  let best = null, bc = 0;
  for (const m of vis) { const t = m.plan[m.plan.length - 1]; const c = vis.filter(o => O.dist(o.plan[o.plan.length - 1] ?? o.at, t) <= 1).length; if (c > bc && !G.units.some(u => O.dist(u.at, t) <= 1)) { bc = c; best = t; } }
  if (best != null && bc >= 2) O.command(G, b.id, 'volley', best);
}
// 정찰이 밝히고, 창병 · 돌격 · 궁수는 한 덩어리로 찾은 둥지를 치며 일제사격을 맞춘다
function commander(G) {
  volley(G);
  if (G.turn % 3) return;
  const sp = G.units.find(u => u.k === 'spear'), rd = G.units.find(u => u.k === 'raid'), bw = G.units.find(u => u.k === 'bow');
  const lead = sp || rd; if (!lead) return;
  const N = G.nests.filter(n => n.alive && n.seen).sort((a, b) => O.dist(a.at, lead.at) - O.dist(b.at, lead.at))[0];
  const goal = N ? N.at : null;
  for (const u of [sp, rd]) if (u && !u.pending) {
    if (goal == null) { if (u.order.kind !== 'auto') O.command(G, u.id, 'auto'); }
    else if (u.order.target !== goal || u.order.kind !== 'move') O.command(G, u.id, 'move', goal);
  }
  if (bw && !bw.pending && lead && goal != null && O.dist(bw.at, lead.at) > 2) O.command(G, bw.id, 'move', lead.at);
}
const games = +(process.argv[2] || 30);
for (const [name, bot] of [['auto', null], ['volley', volley], ['commander', commander]]) {
  const r = { win: 0, fall: 0, lost: 0, time: 0 }; let turn = 0, nests = 0, kills = 0, vol = 0, cut = 0;
  for (let s = 1; s <= games; s++) {
    const G = O.newGame(s * 7919); G.autoPause = false;
    while (!G.over) { if (bot) bot(G); O.tick(G); }
    r[G.over]++; turn += G.turn; nests += G.nests.filter(N => !N.alive).length; kills += G.stats.kills; vol += G.stats.volleys; cut += G.stats.cutKills;
  }
  const f = x => (x / games).toFixed(1);
  console.log(`${name.padEnd(9)}: 이김 ${r.win} · 본부 무너짐 ${r.fall} · 전멸 ${r.lost} · 시간 끝 ${r.time} / ${games} · 턴 ${f(turn)} · 무너뜨린 둥지 ${f(nests)} · 쓰러뜨림 ${f(kills)} (줄 끊겨 ${f(cut)}) · 일제사격 ${f(vol)}`);
}
