import { B, GUILDS, newWorld, step, post, teamsIn } from '../src/bureau/engine';
for (const k of Object.keys(B) as (keyof typeof B)[]) if (process.env['B_' + k]) (B as any)[k] = +process.env['B_' + k]!;
const cases: [number, number][] = [[0, 0], [10, 30], [15, 20], [15, 30], [20, 20], [20, 30], [30, 30]];
for (const [sub, days] of cases) {
  let ok = 0, dsum = 0, fail = 0; const by: Record<string, number> = {};
  for (let s = 0; s < 20; s++) {
    const W = newWorld(1000 + s);
    if (sub) post(W, 0, days, { sub });
    let peak = 0;
    for (let d = 0; d < 60; d++) {
      step(W);
      if (W.day === 12) for (const g of GUILDS) by[g] = (by[g] ?? 0) + W.dungeons[0].teams[g] / 20;
      peak = Math.max(peak, teamsIn(W.dungeons[0]));
      if (W.order.done) break;
    }
    if (W.order.done === 'ok') { ok++; dsum += W.day; } else if (W.order.done === 'fail') fail++;
  }
  console.log(`${sub}G·${days}일  인계 ${ok}/20 ${ok ? '평균 ' + (dsum / ok).toFixed(1) + '일' : ''} 철수 ${fail}  12일째 폐광: ${GUILDS.map(g => g + ' ' + (by[g] ?? 0).toFixed(1)).join(' ')}`);
}
