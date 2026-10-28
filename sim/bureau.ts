// 미궁관리국 배경 엔진 시뮬레이터: 봇마다 여러 판을 돌려 인과 루프가 폭주하거나 멈추지 않는지 본다.
//   npm run sim:bureau                     기본 200판, 봇 셋
//   npm run sim:bureau -- --games 50 --curve   한 판의 날마다 저량 곡선도
//   npm run sim:bureau -- --noCheck        B3 견제를 끈 판과 견준다
// 봇: idle(손 놓음, 요청서도 답하지 않음) · normal(위험 수위 보고를 보면 보조금, 요청서는 다 들어줌, 사이가 크게 틀어지면 두 길드만 불러 회의)
//     smart(늦은 보고를 추세로 메우고, 예산 · 조항 · 영주 몫, 청은 신세를 받아 둔 쪽엔 반만, 사이가 틀어지기 전에 영주까지 불러 회의)
import { B, type World, answer, meet, newWorld, relOf, run, seenLevel, willOf } from '../src/bureau/engine';

// 숫자를 바꿔 보며 잴 때: B_CLEAR=0.14 B_GRANT=1000 npm run sim:bureau
for (const k of Object.keys(B) as (keyof typeof B)[]) if (process.env['B_' + k]) (B as any)[k] = +process.env['B_' + k]!;

export const BOT: Record<string, (W: World) => void> = {
  idle: () => {},
  normal: W => {
    W.dungeons.forEach((d, i) => { d.sub = seenLevel(W, i) >= B.DANGER && W.budget > 0 ? 15 : 0; });
    for (const a of W.asks) if (a.got == null) answer(W, a.id, W.budget > a.want * 2 ? a.want : 0);
    if (relOf(W, 'big', 'small') < -40) meet(W, ['big', 'small']);
  },
  smart: W => {
    // 보고는 거리만큼 늦다: 추세를 더해 오늘 수위를 어림하고, 위험 수위에 닿기 전에 들인다.
    // 보조금은 상대 값이라 여기저기 주면 아무 데도 안 준 것과 같다: 가장 급한 두 곳에만, 수위가 내려갈 때까지
    const est = W.dungeons.map((d, i) => {
      const s = W.seen[i], now = s.at(-1)!, trend = (now - (s.at(-6) ?? now)) / 5;
      return now + trend * (d.dist + 1);
    });
    let k = 0;
    W.dungeons.map((_, i) => i).sort((a, b) => est[b] - est[a]).forEach(i => {
      const d = W.dungeons[i], hot = est[i] >= 65 || (d.sub > 0 && est[i] >= 62);
      d.sub = W.budget > 0 && hot && k < 2 ? 15 : 0;
      if (d.sub) k++;
    });
    // 큰 길드가 눈에 띄면 우선권을 중소 연합 쪽으로, 영주가 식으면 몫을 조금 올린다
    const G = W.guilds;
    W.prio = Math.round(Math.max(30, Math.min(60, 50 - (G.big.infl - G.small.infl) / 4)));
    W.lordShare = W.lord.fav < 45 ? Math.min(25, W.lordShare + 1) : W.lord.fav > 60 ? Math.max(5, W.lordShare - 1) : W.lordShare;
    // 독촉은 갚고, 청은 신세를 이미 받아 둔 쪽에는 반만 들어준다(예산을 아껴 회의 서명에 쓸 신세를 고루 모은다)
    for (const a of W.asks) if (a.got == null && W.budget > a.want) answer(W, a.id, a.kind === 'dun' || W.owe[a.from] < 5 ? a.want : a.want / 2);
    // 사이가 틀어지기 전에, 두 길드가 서명할 마음이 있을 때 영주까지 불러 회의
    if (relOf(W, 'big', 'small') < -25 && Math.min(willOf(W, 'big'), willOf(W, 'small')) >= B.SIGN_AT - 5) meet(W, ['big', 'small', 'lord']);
  },
};

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
