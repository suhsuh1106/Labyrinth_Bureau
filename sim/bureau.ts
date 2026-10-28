// 미궁관리국 배경 엔진 시뮬레이터: 봇마다 여러 판을 돌려 인과 루프가 폭주하거나 멈추지 않는지 본다.
//   npm run sim:bureau                     기본 200판, 봇 셋
//   npm run sim:bureau -- --games 50 --curve   한 판의 날마다 저량 곡선도
//   npm run sim:bureau -- --noCheck        B3 견제를 끈 판과 견준다
// 봇은 `src/bureau/bots.ts`
import { B, newWorld, relOf, run } from '../src/bureau/engine';
import { BOT } from '../src/bureau/bots';
export { BOT };

// 숫자를 바꿔 보며 잴 때: B_CLEAR=0.14 B_GRANT=1000 npm run sim:bureau
for (const k of Object.keys(B) as (keyof typeof B)[]) if (process.env['B_' + k]) (B as any)[k] = +process.env['B_' + k]!;

export function playGame(seed: number, bot: string, o: { noCheck?: boolean } = {}) {
  return run(newWorld(seed, o), BOT[bot]);
}

export interface Sum { games: number; floods: number; dead: number; standing: number; budgetEnd: number; toFlood: number[]; pinned: Record<string, number>; loops: Record<string, number>; bigPeak: number; bigEnd: number; bigAt: number[]; clashes: number; meets: number; relEnd: number; relMin: number; asks: number; sides: number; owe: number }
export function summarize(bot: string, games: number, o: { noCheck?: boolean } = {}): Sum {
  const S: Sum = { games, floods: 0, dead: 0, standing: 0, budgetEnd: 0, toFlood: [], pinned: {}, loops: {}, bigPeak: 0, bigEnd: 0, bigAt: [0, 0, 0, 0, 0], clashes: 0, meets: 0, relEnd: 0, relMin: 0, asks: 0, sides: 0, owe: 0 };
  for (let g = 0; g < games; g++) {
    const W = playGame(1000 + g, bot, o), s = W.stats;
    S.floods += s.floods / games; S.dead += s.dead / games;
    S.standing += W.standing / games; S.budgetEnd += W.budget / games;
    S.toFlood.push(...s.toFlood);
    for (const k in s.pinned) S.pinned[k] = (S.pinned[k] ?? 0) + s.pinned[k] / B.DAYS / games;
    for (const k in s.loops) S.loops[k] = (S.loops[k] ?? 0) + s.loops[k] / games;
    S.bigPeak += W.guilds.big.peak / games; S.bigEnd += W.guilds.big.size / games;
    [0, 89, 179, 269, 359].forEach((d, i) => { S.bigAt[i] += s.bigSize[d] / games; });
    S.clashes += s.clashes / games; S.meets += s.meets / games; S.asks += s.asks / games; S.sides += s.sides / games;
    S.relEnd += relOf(W, 'big', 'small') / games; S.relMin += s.relMin / games;
    S.owe += Object.values(W.owe).reduce((a, b) => a + b, 0) / games;
  }
  return S;
}

const SPARK = '▁▂▃▄▅▆▇█';
const spark = (xs: number[], lo: number, hi: number, n = 60) =>
  Array.from({ length: n }, (_, i) => xs[Math.floor(i * xs.length / n)]).map(v => SPARK[Math.max(0, Math.min(7, Math.floor((v - lo) / (hi - lo) * 8)))]).join('');

function main() {
  const args = process.argv.slice(2);
  const games = +(args[args.indexOf('--games') + 1] || 0) || 200;
  const o = { noCheck: args.includes('--noCheck') };
  const f1 = (v: number) => v.toFixed(1), pct = (v: number) => (v * 100).toFixed(1) + '%';
  console.log(`미궁관리국 엔진 1단계 · ${games}판 · ${B.DAYS}일${o.noCheck ? ' · B3 끔' : ''}\n`);
  console.log('봇      범람  죽음   입지  예산끝  위험→범람(날)  가장 큰 길드의 조(0·90·180·270·360일 / 최대)');
  const sums: Record<string, Sum> = {};
  for (const bot of Object.keys(BOT)) {
    const S = sums[bot] = summarize(bot, games, o);
    const tf = S.toFlood.length ? f1(S.toFlood.reduce((a, b) => a + b, 0) / S.toFlood.length) : '—';
    console.log(`${bot.padEnd(7)} ${f1(S.floods).padStart(4)} ${f1(S.dead).padStart(5)} ${f1(S.standing).padStart(6)} ${Math.round(S.budgetEnd).toString().padStart(7)}  ${tf.padStart(12)}   ${S.bigAt.map(f1).join(' · ')} / ${f1(S.bigPeak)}`);
  }
  console.log('\n저량이 끝에 붙은 날의 비율');
  for (const bot of Object.keys(BOT)) console.log(`${bot.padEnd(7)} ${Object.entries(sums[bot].pinned).map(([k, v]) => `${k} ${pct(v)}`).join(' · ') || '없음'}`);
  console.log('\n세력 사이 · 신세 (판당)');
  console.log('봇      다툼  회의  두 길드 사이(끝 / 가장 낮을 때)  요청서(하루)  편들기  받은 신세 합');
  for (const bot of Object.keys(BOT)) {
    const S = sums[bot];
    console.log(`${bot.padEnd(7)} ${f1(S.clashes).padStart(4)} ${f1(S.meets).padStart(5)}  ${f1(S.relEnd).padStart(10)} / ${f1(S.relMin).padStart(6)}         ${(S.asks / B.DAYS).toFixed(2).padStart(5)}    ${f1(S.sides).padStart(4)}   ${f1(S.owe).padStart(6)}`);
  }
  console.log('\n고리마다 켜진 날 (판당)');
  for (const bot of Object.keys(BOT)) console.log(`${bot.padEnd(7)} ${Object.entries(sums[bot].loops).map(([k, v]) => `${k} ${f1(v)}`).join(' · ')}`);
  if (args.includes('--curve')) {
    console.log('\n한 판의 곡선 (시드 1000)');
    for (const bot of Object.keys(BOT)) {
      const W = playGame(1000, bot, o);
      console.log(`\n[${bot}]`);
      W.dungeons.forEach((d, i) => console.log(`  ${d.name.padEnd(6)} 수위 ${spark(W.hist[i], 0, 100)} 끝 ${f1(d.level)} · 범람 ${d.floods}`));
      console.log(`  가장 큰 길드 ${spark(W.stats.bigSize, 0, 40)} 끝 ${f1(W.guilds.big.size)}`);
      console.log(`  두 길드 사이 ${spark(W.stats.relHist, -100, 100)} 끝 ${f1(relOf(W, 'big', 'small'))}`);
    }
  }
}

if (process.argv[1]?.endsWith('bureau.ts')) main();
