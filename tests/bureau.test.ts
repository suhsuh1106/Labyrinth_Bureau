// 미궁관리국 배경 엔진 0단계: 인과 루프 두 쌍이 폭주하거나 멈추지 않는지, 국장의 손이 판을 바꾸는지
import { describe, expect, it } from 'vitest';
import { B, answer, meet, newWorld, pactK, relOf, run, step } from '../src/bureau/engine';
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

describe('미궁관리국 엔진 1단계: 세력 사이 · 신세', () => {
  const W0 = () => { const W = newWorld(11); for (let t = 0; t < 5; t++) step(W); return W; };
  const until = (W: ReturnType<typeof newWorld>, ok: () => boolean) => { for (let t = 0; t < 60 && !ok(); t++) step(W); expect(ok()).toBe(true); };

  it('R4 · B4: 손을 놓으면 두 길드 사이가 무너지고, 회의를 여는 봇은 붙잡는다', () => {
    const idle = avg('idle', W => relOf(W, 'big', 'small')), normal = avg('normal', W => relOf(W, 'big', 'small')), smart = avg('smart', W => relOf(W, 'big', 'small'));
    expect(idle).toBeLessThan(-60);
    expect(normal).toBeGreaterThan(idle + 30);
    expect(smart).toBeGreaterThan(normal);
    expect(avg('smart', W => W.stats.clashes)).toBeLessThan(avg('idle', W => W.stats.clashes));
  });

  it('회의: 협정이 서고, 빠진 영주는 이틀 뒤 앙금을 남긴다', () => {
    const W = W0();
    W.guilds.big.fav = W.guilds.small.fav = 70;
    const lordFav = W.lord.fav, rel = relOf(W, 'big', 'small');
    expect(meet(W, ['big', 'small'])).toBe(true);
    expect(pactK(W)).toBeGreaterThan(0);
    expect(relOf(W, 'big', 'small')).toBeGreaterThan(rel);
    expect(W.owe.big).toBeLessThan(0);                 // 부탁한 만큼 신세를 졌다
    step(W);
    expect(W.reports.some(r => r.chips.includes('자기를 빼고 정해서'))).toBe(false);
    step(W);
    expect(W.reports.find(r => r.chips.includes('자기를 빼고 정해서'))?.day).toBe(W.day);
    expect(W.lord.fav).toBeLessThan(lordFav);
    expect(meet(W, ['big', 'small'])).toBe(false);     // 열흘 안엔 다시 못 연다
  });

  it('마지못한 서명은 나흘 뒤에야 이행되고, 마음이 많이 모자라면 거절한다', () => {
    const W = W0();
    W.guilds.big.fav = 70; W.guilds.small.fav = B.SIGN_AT - 10;   // 영주를 부르면 +5
    expect(meet(W, ['big', 'small', 'lord'])).toBe(true);
    expect(pactK(W)).toBe(0);
    for (let t = 0; t < B.SLOW_DAYS; t++) step(W);
    expect(pactK(W)).toBeGreaterThan(0);
    expect(W.reports.some(r => r.chips.includes('마지못해 서명해서'))).toBe(true);
    const V = W0();
    V.guilds.big.fav = 70; V.guilds.small.fav = B.SIGN_AT - 30;
    expect(meet(V, ['big', 'small'])).toBe(false);
    expect(V.pact).toBeNull();
  });

  it('R5 · B5: 청을 들어주면 신세를 받고, 진 빚은 독촉으로 돌아오며 모른 척하면 입지를 잃는다', () => {
    const W = W0();
    W.guilds.small.money = -200;
    W.rel['lord:small'] = -50;                        // 영주가 빌려주지 않는 사이
    until(W, () => W.asks.some(a => a.from === 'small' && a.kind === 'aid'));
    const aid = W.asks.find(a => a.from === 'small' && a.kind === 'aid')!, budget = W.budget;
    answer(W, aid.id, aid.want);
    expect(W.owe.small).toBeGreaterThan(0);
    expect(W.budget).toBe(budget - aid.want);
    W.owe.big = -20;
    until(W, () => W.asks.some(a => a.from === 'big' && a.kind === 'dun'));
    const dun = W.asks.find(a => a.from === 'big' && a.kind === 'dun')!;
    expect(dun.want).toBeGreaterThan(0);
    const st = W.standing, f = W.guilds.big.fav;
    for (let t = 0; t <= B.ASK_DUE; t++) step(W);  // 답하지 않으면 기한에 0으로 답한 것
    expect(dun.got).toBe(0);
    expect(W.guilds.big.fav).toBeLessThan(f);
    expect(W.standing).toBeLessThan(st + 1);
  });

  it('세력끼리의 빚: 빚진 쪽은 엿새쯤 뒤 빌려준 쪽 편을 든다', () => {
    const W = W0();
    W.fowe.small.lord = B.LEND_OWE;
    W.rel['big:lord'] = -50;
    const rel = relOf(W, 'big', 'small');
    step(W);
    const side = W.later.find(l => l.kind === 'side')!;
    expect(side.day).toBe(W.day + B.SIDE_DAYS);
    until(W, () => W.day >= side.day);
    expect(W.reports.some(r => r.chips.some(c => c.includes('진 빚을 갚느라')))).toBe(true);
    expect(relOf(W, 'big', 'small')).toBeLessThan(rel - B.SIDE_REL / 2);
  });

  it('요청서는 세력마다 한 장씩만 열려 있다', () => {
    const W = newWorld(2);
    while (W.day < B.DAYS) {
      step(W);
      for (const f of ['big', 'small', 'lord']) expect(W.asks.filter(a => a.from === f && a.got == null).length).toBeLessThanOrEqual(1);
    }
  });
});
