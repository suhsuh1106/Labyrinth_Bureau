// 대물 토벌 시제품(public/proto/raid)의 봇: node sim/raid.mjs [판 수]
// naive = 싼 조부터 사서 아무 데나 세우고 길드가 원하는 부위를 노림, smart = 방패를 앞에, 척후를 뒤로 돌려 핵, 돌격은 뿔 다음 핵
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
new Function(readFileSync(fileURLToPath(new URL('../public/proto/raid/engine.js', import.meta.url)), 'utf8'))();
const R = globalThis.RAID;
for (const [k, v] of Object.entries(process.env)) if (k.startsWith('R_')) R.B[k.slice(2)] = +v;

function hire(C, pick) {
  const squad = []; let money = C.budget;
  for (const o of pick(C.offers.slice())) {
    if (squad.length >= R.B.MAX_SQUAD) break;
    if (o.fee <= money) { squad.push({ ...o }); money -= o.fee; }
  }
  C.budget = money;
  return squad;
}
function naive(C, rng) {
  const squad = hire(C, o => o.sort((a, b) => a.fee - b.fee));
  const cells = []; for (let x = 0; x <= R.B.DEPLOY_MAX_X; x++) for (let y = 0; y < R.ROWS; y++) cells.push([x, y]);
  for (const p of squad) { const i = Math.floor(rng() * cells.length); [p.x, p.y] = cells.splice(i, 1)[0]; p.target = R.GUILDS[p.g].want; }
  return squad;
}
function smart(C) {
  const want = { shield: 2, red: 1, wolf: 2 };
  const squad = hire(C, o => {
    const out = []; const left = { ...want };
    o.sort((a, b) => (b.ace - a.ace) || (b.pow * b.maxhp / b.fee - a.pow * a.maxhp / a.fee));
    for (const x of o) if (left[x.kind] > 0) { out.push(x); left[x.kind]--; }
    return out.concat(o.filter(x => !out.includes(x)));
  });
  const front = [[4, 2], [4, 1], [4, 3]], top = [[4, 0], [3, 0]], bot = [[4, 4], [3, 4], [2, 4]];
  for (const p of squad) {
    if (p.kind === 'shield') { [p.x, p.y] = front.shift() || bot.shift(); p.target = 'arm'; }
    else if (p.kind === 'red') { [p.x, p.y] = top.shift() || front.shift(); p.target = 'horn'; }
    else { [p.x, p.y] = bot.shift() || top.shift(); p.target = 'core'; }
  }
  return squad;
}

const games = +(process.argv[2] || 50);
for (const [name, bot] of [['naive', naive], ['smart', smart]]) {
  const kills = [0, 0, 0], plays = [0, 0, 0]; let town = 0, dead = 0, aces = 0, ticks = [0, 0, 0];
  for (let s = 1; s <= games; s++) {
    const C = R.newCampaign(s * 7919), rng = C.rng;
    while (!C.over) {
      const squad = bot(C, rng);
      const Bt = R.newBattle(C, squad);
      while (!Bt.over) R.tick(Bt);
      plays[C.op]++; ticks[C.op] += Bt.t; if (Bt.over === 'kill') kills[C.op]++;
      R.nextOp(C);
    }
    town += C.town; dead += C.dead; aces += C.aceAlive.filter(Boolean).length;
  }
  console.log(`${name}: 잡음 ${kills.map((k, i) => `${k}/${plays[i]}`).join(' · ')} · 전투 길이 ${ticks.map((t, i) => (t / (plays[i] || 1)).toFixed(0)).join('/')}틱 · 마을 ${(town / games).toFixed(0)} · 잃은 조 ${(dead / games).toFixed(1)} · 조장 생존 ${(aces / games).toFixed(1)}/3`);
}
