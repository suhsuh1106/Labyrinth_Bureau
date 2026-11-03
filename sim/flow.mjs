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
  const { NZ, zf, total } = F;
  if (W.t > 4 && W.obs === 0 && W.budget > 140) F.upgradeObs(W);
  let worst = -1, ws = 0, hot = -1, hs = 0;
  for (let z = 0; z < NZ; z++) {
    const v = F.view(W, zf(z)); if (!F.seesMonsters(W, zf(z))) continue;
    let h = 0; for (const a of v.H) h += a[z];
    const s = v.M[z] / (h + 5);
    if (v.M[z] > 30 && s > ws) { ws = s; worst = z; }
    if (v.pd[z] > 0.05 && h > 15 && v.pd[z] > hs) { hs = v.pd[z]; hot = z; }
  }
  if (hot >= 0 && W.budget > 20) F.issue(W, 'retreat', hot);
  if (worst >= 0 && W.budget > 70 && W.bounty[worst] <= 2) F.issue(W, 'bounty', worst);
  for (const z of [4, 7]) if (!W.supply[z] && W.budget > 110 && W.t > 6) F.issue(W, 'supply', z);
  if (W.M[1] > 35 && !W.seal[4] && W.budget > 60) F.issue(W, 'seal', 4);
  if (W.seal[4] && W.M[4] < 20) F.issue(W, 'unseal', 4);
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
        curve.push(`d${W.t} 사람${h | 0} 마물${m | 0} 마을${W.town | 0} 예산${W.budget | 0} 죽음${W.deaths | 0} 호감${W.gw.map(x => x | 0).join('/')}`);
      }
    }
    if (W.over === 'fall') fall++;
    town += W.town; deaths += W.deaths; tax += W.taxSum; named += W.named.filter(p => p.alive).length; endDay += W.t; budget += W.budget;
  }
  const n = games;
  console.log(`${style}: 범람 ${fall}/${n} · 끝날 ${(endDay / n).toFixed(1)} · 마을 ${(town / n).toFixed(0)} · 죽음 ${(deaths / n).toFixed(0)} · 세수 ${(tax / n).toFixed(0)} · 남은 예산 ${(budget / n).toFixed(0)} · 이름 생존 ${(named / n).toFixed(1)}/3`);
  console.log('  ' + curve.join('\n  '));
}
