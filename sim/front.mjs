// 다중 전선 지휘 시제품(public/proto/front)의 봇: node sim/front.mjs [판 수]
// idle = 손 놓음, fixed = 교리는 사수로 고정하고 증원만, smart = 오는 마물에 맞춰 교리를 바꾸고 증원 · 붕락
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
new Function(readFileSync(fileURLToPath(new URL('../public/proto/front/engine.js', import.meta.url)), 'utf8'))();
const F = globalThis.FRONT;
for (const [k, v] of Object.entries(process.env)) if (k.startsWith('F_')) F.B[k.slice(2)] = +v;
const COUNTER = { swarm: 'hold', armor: 'charge', charger: 'delay' };

function threat(bd) { let s = 0; for (const m of bd.mons) if (m.x < F.LANE) s += m.hp / 3 + (F.LANE - m.x) * 0.3; return s; }
function fixed(G, step) {
  if (step % 5) return;
  const bd = G.boards.slice().sort((a, b) => (a.allies.length - b.allies.length) || (threat(b) - threat(a)))[0];
  if (G.cp >= 2 && bd.allies.length < 4) F.edict(G, 'reinforce', bd.id);
}
function smart(G, step) {
  if (step % 5) return; // 0.5초마다 한 번 본다 (사람의 손 빠르기)
  // 1) 교리: 지금 싸우는 무리, 없으면 곧 올 파도에 맞춤
  let need = null;
  for (const bd of G.boards) {
    const cur = bd.mons.filter(m => m.x < F.LANE);
    const type = cur.length ? cur[0].type : (bd.next.at - G.t < 5 ? bd.next.type : null);
    if (type && bd.doctrine !== COUNTER[type]) { const w = cur.length ? 10 + threat(bd) : 3; if (!need || w > need.w) need = { bd, d: COUNTER[type], w }; }
  }
  if (need && G.cp >= 1) { F.edict(G, 'doctrine', need.bd.id, need.d); return; }
  // 2) 증원: 아군이 적고 위협이 큰 판
  const weak = G.boards.filter(b => b.allies.length < 4 && (threat(b) > 4 || b.next.at - G.t < 6)).sort((a, b) => a.allies.length - b.allies.length)[0];
  if (weak && G.cp >= 2) { F.edict(G, 'reinforce', weak.id); return; }
  // 3) 붕락: 무리가 입구 가까이 밀려든 판
  const hot = G.boards.filter(b => b.mons.filter(m => m.x < 4).length >= 4).sort((a, b) => threat(b) - threat(a))[0];
  if (hot && G.cp >= 3) F.edict(G, 'collapse', hot.id);
}

const games = +(process.argv[2] || 30);
for (const [name, bot] of [['idle', null], ['fixed', fixed], ['smart', smart]]) {
  let fall = 0, town = 0, endT = 0, lost = 0, fell = 0, edicts = 0;
  for (let s = 1; s <= games; s++) {
    const G = F.newGame(s * 7919);
    let step = 0;
    while (!G.over) { if (bot) bot(G, step); F.tick(G); step++; }
    if (G.over === 'fall') fall++;
    town += G.town; endT += G.t; lost += G.stats.lost; fell += G.stats.fell; edicts += G.stats.edicts;
  }
  const n = games;
  console.log(`${name}: 입구 무너짐 ${fall}/${n} · 끝난 때 ${(endT / n).toFixed(0)}초 · 마을 ${(town / n).toFixed(0)} · 무너진 전선 ${(fell / n).toFixed(1)} · 잃은 조각 ${(lost / n).toFixed(0)} · 칙령 ${(edicts / n).toFixed(0)}`);
}
