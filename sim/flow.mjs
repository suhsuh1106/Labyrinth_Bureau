// 구역 흐름 관제 시제품(public/proto/flow)의 봇 시뮬레이션: node sim/flow.mjs [판 수]
// idle = 아무것도 안 함, smart = 보이는 것(늦은 보고)만 보고 서류를 거는 간단한 봇
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const src = readFileSync(fileURLToPath(new URL('../public/proto/flow/engine.js', import.meta.url)), 'utf8');
new Function(src)();
const F = globalThis.FLOW;
for (const [k, v] of Object.entries(process.env)) if (k.startsWith('F_')) F.B[k.slice(2)] = v.includes(',') ? v.split(',').map(Number) : +v;

function smart(W) {
  if (Math.abs(W.t - Math.round(W.t)) > 1e-6) return;
  if (W.t === 1) { for (let i = 0; i < 4; i++) { F.setPolicy(W, 'tax', 0, 1); F.setPolicy(W, 'tax', 2, -1); F.setPolicy(W, 'tax', 3, -1); } }
  if (W.t === 2) F.issue(W, 'camp', 4);
  if (W.t > 8 && !W.camp[7] && W.budget > 100) F.issue(W, 'camp', 7);
  if (W.t > 14 && W.obs === 0 && W.budget > 130) F.upgradeObs(W);
  // 깊은 층 시세가 떨어지면 수매가로 받치고, 금고가 얇으면 뗀다
  for (const f of [2, 3]) {
    if (W.price[f] < F.B.VAL[f] * 0.9 && W.budget > 120 && W.buy[f] < F.B.VAL[f]) F.setPolicy(W, 'buy', f, 1);
    if (W.budget < 60 && W.buy[f] > 0) F.setPolicy(W, 'buy', f, -1);
  }
  let hot = -1, hs = 0;
  for (let z = 0; z < F.NZ; z++) {
    const v = F.view(W, F.zf(z)); if (!F.seesMonsters(W, F.zf(z))) continue;
    let h = 0; for (const a of v.H) h += a[z];
    if (v.pd[z] > 0.05 && h > 15 && v.pd[z] > hs) { hs = v.pd[z]; hot = z; }
  }
  if (hot >= 0 && W.budget > 20) F.issue(W, 'retreat', hot);
}

const games = +(process.argv[2] || 30);
for (const style of ['idle', 'smart']) {
  let fall = 0, town = 0, deaths = 0, tax = 0, named = 0, endDay = 0, budget = 0;
  const curve = [];
  for (let s = 1; s <= games; s++) {
    const W = F.newWorld(s * 7919);
    while (!W.over) {
      if (style === 'smart') smart(W);
      F.tick(W);
      if (s === 1 && Math.abs(W.t % 10) < 1e-6) {
        let h = 0, m = 0; for (let z = 0; z < F.NZ; z++) { h += F.total(W, z); m += W.M[z]; }
        const fl = [0,1,2,3].map(f => { let a = 0; for (let c = 0; c < 3; c++) a += F.total(W, f * 3 + c); return a | 0; }).join('/');
        curve.push(`d${W.t} 층별${fl} 마물${m | 0} 마을${W.town | 0} 예산${W.budget | 0} 죽음${W.deaths | 0} 숙련${W.skill.map(x => x.toFixed(2)).join('/')} 시세${W.price.map((x, f) => (x / F.B.VAL[f]).toFixed(2)).join('/')} 호감${W.gw.map(x => x | 0).join('/')} 벌이${W.inc.map(x => x | 0).join('/')}`);
      }
    }
    if (W.over === 'fall') fall++;
    town += W.town; deaths += W.deaths; tax += W.taxSum - W.buySum; named += W.named.filter(p => p.alive).length; endDay += W.t; budget += W.budget;
  }
  const n = games;
  console.log(`${style}: 범람 ${fall}/${n} · 끝날 ${(endDay / n).toFixed(1)} · 마을 ${(town / n).toFixed(0)} · 죽음 ${(deaths / n).toFixed(0)} · 세수 ${(tax / n).toFixed(0)} · 남은 예산 ${(budget / n).toFixed(0)} · 이름 생존 ${(named / n).toFixed(1)}/3`);
  console.log('  ' + curve.join('\n  '));
}
