// 미궁관리국 배경 엔진 0단계: 인과 루프 두 쌍이 폭주하거나 멈추지 않는지, 국장의 손이 판을 바꾸는지
import { describe, expect, it } from 'vitest';
import { B, newWorld, run, step } from '../src/bureau/engine';
import { BOT, playGame } from '../sim/bureau';

const SEEDS = Array.from({ length: 30 }, (_, i) => 1000 + i);
const avg = (bot: string, f: (W: ReturnType<typeof playGame>) => number, o = {}) =>
  SEEDS.reduce((s, seed) => s + f(playGame(seed, bot, o)), 0) / SEEDS.length;

describe('미궁관리국 엔진 0단계', () => {
  it('같은 시드와 같은 봇이면 같은 판', () => {
    const a = playGame(7, 'smart'), b = playGame(7, 'smart');
    expect(a.standing).toBe(b.standing);
    expect(a.hist).toEqual(b.hist);
  });

  it('저량은 늘 숫자이고 제 범위 안에 있다', () => {
    for (const bot of Object.keys(BOT)) {
      const W = newWorld(3);
      while (W.day < B.DAYS) {
        BOT[bot](W); step(W);
        for (const d of W.dungeons) { expect(d.level).toBeGreaterThanOrEqual(0); expect(d.level).toBeLessThan(B.FLOOD); expect(Number.isFinite(d.teams.big + d.teams.small)).toBe(true); }
        for (const o of [W.guilds.big, W.guilds.small, W.lord]) { expect(o.fav).toBeGreaterThanOrEqual(0); expect(o.fav).toBeLessThanOrEqual(100); expect(o.infl).toBeLessThan(100); }
        expect(W.standing).toBeGreaterThanOrEqual(0); expect(W.standing).toBeLessThanOrEqual(100);
      }
    }
  });

  it('R1: 손을 놓으면 폐광이 거듭 범람한다', () => {
    expect(avg('idle', W => W.dungeons[0].floods)).toBeGreaterThan(10);
  });

  it('B1: 보조금이 범람을 붙잡는다', () => {
    expect(avg('normal', W => W.stats.floods)).toBeLessThan(avg('idle', W => W.stats.floods) / 3);
  });

  it('숙련 봇이 앞선다: 범람 · 죽음은 적고 입지는 높다', () => {
    const f = (bot: string) => [avg(bot, W => W.stats.floods), avg(bot, W => W.stats.dead), avg(bot, W => W.standing)];
    const [sF, sD, sS] = f('smart'), [nF, nD, nS] = f('normal'), [, , iS] = f('idle');
    expect(sF).toBeLessThan(nF);
    expect(sD).toBeLessThan(nD);
    expect(sS).toBeGreaterThan(nS);
    expect(nS).toBeGreaterThan(iS);
  });

  it('R3 · B3: 큰 길드는 커지다 멈추고, 견제를 끄면 계속 커진다', () => {
    const peak = avg('normal', W => Math.max(...W.stats.bigSize)), end = avg('normal', W => W.stats.bigSize.at(-1)!);
    const free = avg('normal', W => W.stats.bigSize.at(-1)!, { noCheck: true });
    expect(peak).toBeGreaterThan(20);                // 처음 12조에서 커진다
    expect(end).toBeLessThanOrEqual(peak);           // 끝까지 커지지 않는다
    expect(free).toBeGreaterThan(end * 1.5);         // 붙잡는 고리가 없으면 훨씬 크다
  });

  it('같은 시작에서 봇마다 판이 갈린다', () => {
    const a = run(newWorld(1001), BOT.idle), b = run(newWorld(1001), BOT.smart);
    expect(a.dungeons[0].floods).not.toBe(b.dungeons[0].floods);
  });

  it('보고는 거리만큼 늦게 도착한다', () => {
    const W = newWorld(5);
    for (let t = 0; t < 20; t++) step(W);
    W.dungeons.forEach((d, i) => expect(W.seen[i].at(-1)).toBe(W.hist[i].at(-1 - d.dist)));
  });
});
