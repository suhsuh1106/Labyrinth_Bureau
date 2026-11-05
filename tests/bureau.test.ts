// 미궁관리국 배경 엔진 0단계: 인과 루프 두 쌍이 폭주하거나 멈추지 않는지, 국장의 손이 판을 바꾸는지
import { describe, expect, it } from 'vitest';
import { B, FACS, pairOf, BUREAU_AT, HAVEL_AT, LOYD_AT, ROADS, devRoadOf, GUILDS, answer, clauseOn, upgrade, payOf, lagOf, crewMax, subAt, letterScore, meet, newWorld, over, pactK, pnlGuild, pnlSum, devStage, post, recall, relOf, run, send, step as stepRaw, buildGate, permitOf, dispatch, crewFree, knowLv, willOf, svWay, teamsIn, withdraw, worstPair, wayOf, hqOf, type World, demOf, lure, propose, unpropose } from '../src/bureau/engine';
import { BOT, playGame } from '../sim/bureau';
import { EDGES, LINKS, LOOPS, NODES, checkLoops } from '../src/bureau/loops';
import { SHOT_N, openingHtml } from '../src/ui/bureau/opening';
import { peekLines } from '../src/ui/bureau/docs';
import { type BuUi, asksFloatHtml, docModalHtml, reportDocHtml, setHtml, endHtml, introHtml, paneHtml, deskHtml, topHtml, tutOf, tessaReportHtml, writeHtml } from '../src/ui/bureau/board';
import { mapHtml, minisOf } from '../src/ui/bureau/map';
import { groundAt, isRoad, walkCost } from '../src/bureau/tiles';
import { canAdd, dropClause, toLock } from '../src/bureau/clauses';
import { getSeed, setSeed } from '../src/core/rng';
import { docOf } from '../src/ui/bureau/docs';

// 신청서가 오면 다 허락하고 하루를 넘긴다(출입 허가제 이전의 판과 같은 흐름). 허가제 자체를 재는 시험은 stepRaw를 쓴다
const step = (W: World) => { for (const a of W.asks) if (a.kind === 'permit' && a.got == null) answer(W, a.id, a.want); stepRaw(W); };
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
        for (const d of W.dungeons) { expect(d.level).toBeGreaterThanOrEqual(0); expect(d.level).toBeLessThan(B.FLOOD); expect(Number.isFinite(teamsIn(d))).toBe(true); }
        for (const o of Object.values(W.guilds)) { expect(o.fav).toBeGreaterThanOrEqual(0); expect(o.fav).toBeLessThanOrEqual(100); expect(o.infl).toBeLessThan(100); }
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

  it('숙련 봇이 앞선다: 범람 · 죽음은 적고 명성는 높다', () => {
    const f = (bot: string) => [avg(bot, W => W.stats.floods), avg(bot, W => W.stats.dead), avg(bot, W => W.standing)];
    const [sF, sD, sS] = f('smart'), [nF, nD, nS] = f('normal'), [, , iS] = f('idle');
    expect(sF).toBeLessThanOrEqual(nF);             // 왕국군이 폐광을 눌러 두고 시작해 손을 쓰는 봇은 거의 범람이 없다
    expect(sD).toBeLessThan(nD);
    expect(sS).toBeGreaterThan(nS);
    expect(nS).toBeGreaterThan(iS);
  });

  it('R3 · B3: 큰 길드는 커지다 멈추고, 견제를 끄면 계속 커진다', () => {
    const peak = avg('normal', W => Math.max(...W.stats.bigSize)), end = avg('normal', W => W.stats.bigSize.at(-1)!);
    const free = avg('normal', W => W.stats.bigSize.at(-1)!, { noCheck: true });
    expect(peak).toBeGreaterThan(20);                // 처음 15조에서 커진다
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

  it('R4 · B4: 손을 놓으면 가장 나쁜 두 길드 사이가 무너지고, 회의를 여는 봇은 붙잡는다', () => {
    const worst = (W: ReturnType<typeof newWorld>) => relOf(W, ...worstPair(W));
    const idle = avg('idle', worst), normal = avg('normal', worst), smart = avg('smart', worst);
    expect(idle).toBeLessThan(-60);
    expect(normal).toBeGreaterThan(idle + 25);
    expect(smart).toBeGreaterThan(normal);
    // 손 놓은 판은 범람으로 미궁이 비어 다툼이 적다: 회의를 여는 두 봇끼리 견준다
    expect(avg('smart', W => W.stats.clashes)).toBeLessThan(avg('normal', W => W.stats.clashes));
  });

  it('회의: 협정이 서고, 빠진 길드 중 체면을 보는 쪽은 이틀 뒤 앙금을 남긴다', () => {
    const W = W0();
    W.guilds.red.fav = W.guilds.shield.fav = 70;
    expect(meet(W, ['red'])).toBe(false);              // 길드 하나로는 회의가 안 된다
    const dawnFav = W.guilds.dawn.fav, rel = relOf(W, 'red', 'shield');
    expect(meet(W, ['red', 'shield'])).toBe(true);
    expect(pactK(W, 'red', 'shield')).toBeGreaterThan(0);
    expect(pactK(W, 'red', 'wolf')).toBe(0);           // 협정은 부른 길드 사이에만
    expect(relOf(W, 'red', 'shield')).toBeGreaterThan(rel);
    expect(W.owe.red).toBeLessThan(0);                 // 부탁한 만큼 신세를 졌다
    step(W);
    expect(W.reports.some(r => r.chips.includes('자기를 빼고 정해서'))).toBe(false);
    step(W);
    expect(W.reports.find(r => r.chips.includes('자기를 빼고 정해서'))?.day).toBe(W.day);
    expect(W.guilds.dawn.fav).toBeLessThan(dawnFav);
    // 체면을 보는 길드(권리 1 이상)만 서운해한다
    expect(W.reports.some(r => r.from === W.guilds.dawn.name && r.chips.includes('자기를 빼고 정해서'))).toBe(true);
    expect(W.reports.some(r => r.from === W.guilds.wolf.name && r.chips.includes('자기를 빼고 정해서'))).toBe(false);
    expect(meet(W, ['red', 'shield'])).toBe(false);     // 열흘 안엔 다시 못 연다
  });

  it('마지못한 서명은 나흘 뒤에야 이행되고, 마음이 많이 모자라면 거절한다', () => {
    const W = W0();
    W.guilds.red.fav = 70; W.guilds.shield.fav = B.SIGN_AT - 5;
    expect(meet(W, ['red', 'shield'])).toBe(true);
    expect(pactK(W)).toBe(0);
    for (let t = 0; t < B.SLOW_DAYS; t++) step(W);
    expect(pactK(W)).toBeGreaterThan(0);
    expect(W.reports.some(r => r.chips.includes('마지못해 서명해서'))).toBe(true);
    const V = W0();
    V.guilds.red.fav = 70; V.guilds.shield.fav = B.SIGN_AT - 30;
    expect(meet(V, ['red', 'shield'])).toBe(false);
    expect(V.pact).toBeNull();
  });

  it('R5 · B5: 청을 들어주면 신세를 받고, 진 빚은 독촉으로 돌아오며 모른 척하면 명성를 잃는다', () => {
    const W = W0();
    W.guilds.wolf.money = -200;
    for (const g of GUILDS) if (g !== 'wolf') W.rel[pairOf('wolf', g)] = -50;   // 빌려줄 길드가 없는 사이
    until(W, () => W.asks.some(a => a.from === 'wolf' && a.kind === 'aid'));
    const aid = W.asks.find(a => a.from === 'wolf' && a.kind === 'aid')!, budget = W.budget;
    answer(W, aid.id, aid.want);
    expect(W.owe.wolf).toBeGreaterThan(0);
    expect(W.budget).toBe(budget - aid.want);
    W.owe.red = -20;
    until(W, () => W.asks.some(a => a.from === 'red' && a.kind === 'dun'));
    const dun = W.asks.find(a => a.from === 'red' && a.kind === 'dun')!;
    expect(dun.want).toBeGreaterThan(0);
    const st = W.standing, f = W.guilds.red.fav;
    for (let t = 0; t <= B.ASK_DUE; t++) step(W);  // 답하지 않으면 기한에 0으로 답한 것
    expect(dun.got).toBe(0);
    expect(W.guilds.red.fav).toBeLessThan(f);
    expect(W.standing).toBeLessThan(st + 1);
  });

  it('세력끼리의 빚: 빚진 쪽은 엿새쯤 뒤 빌려준 쪽 편을 든다', () => {
    const W = W0();
    W.fowe.wolf.shield = B.LEND_OWE;
    W.rel[pairOf('shield', 'red')] = -50;
    const rel = relOf(W, 'red', 'wolf');
    step(W);
    const side = W.later.find(l => l.kind === 'side')!;
    expect(side.day).toBe(W.day + B.SIDE_DAYS);
    until(W, () => W.day >= side.day);
    expect(W.reports.some(r => r.chips.some(c => c.includes('진 빚을 갚느라')))).toBe(true);
    expect(relOf(W, 'red', 'wolf')).toBeLessThan(rel - B.SIDE_REL / 2);
  });

  it('중앙으로 합친 뒤: 세력은 길드 일곱뿐이고, 금고가 바닥난 길드에는 사이가 괜찮은 넉넉한 길드가 빌려준다', () => {
    expect(FACS).toEqual(GUILDS);
    const W = W0();
    for (const g of GUILDS) W.guilds[g].money = 0;
    W.guilds.wolf.money = -150; W.guilds.shield.money = 900;
    W.rel[pairOf('wolf', 'shield')] = 10;
    step(W);
    expect(W.fowe.wolf.shield).toBe(B.LEND_OWE);
    expect(W.guilds.wolf.money).toBeGreaterThan(-150);
  });

  it('요청서는 세력마다 한 장씩만 열려 있다', () => {
    const W = newWorld(2);
    while (W.day < B.DAYS) {
      step(W);
      for (const f of GUILDS) expect(W.asks.filter(a => a.from === f && a.got == null && a.kind !== 'permit').length).toBeLessThanOrEqual(1);
    }
  });
});

describe('국장의 서류 (조항 조합)', () => {
  it('공고문: 기한 동안 걸리고, 끝나면 멎으며, 같은 미궁의 새 공고문이 옛것을 바꾼다', () => {
    const W = newWorld(5);
    const n = post(W, 1, 10, { sub: 20 })!;
    expect(subAt(W, 1)).toBe(20);
    expect(W.reports.at(-1)!.chips).toContain('길드 전체');
    post(W, 1, 15, { sub: 30 });
    expect(W.notices.length).toBe(1);
    expect(W.notices[0].id).not.toBe(n.id);
    expect(subAt(W, 1)).toBe(30);
    const until = W.notices[0].until, b0 = W.budget;
    while (W.day < until - 1) step(W);
    expect(subAt(W, 1)).toBe(30);
    expect(W.budget).not.toBe(b0);
    step(W);
    expect(subAt(W, 1)).toBe(0);
    expect(W.notices.length).toBe(0);
    expect(W.reports.some(r => r.title.startsWith('공고 기한 끝'))).toBe(true);
  });

  it('공고문은 신문으로 퍼져 길드 본부까지 거리만큼 뒤에 걸린다', () => {
    const W = newWorld(5);
    post(W, 1, 20, { sub: 20 });
    const d = W.dungeons[1];
    for (let t = 1; t <= 3; t++) {
      step(W);
      for (const g of GUILDS) expect(clauseOn(W, d, 'sub', g)).toBe(t >= hqOf(g) ? 20 : undefined);
    }
    expect(hqOf('wolf')).toBeLessThan(hqOf('drift'));            // 관리국 곁의 늑대단은 이튿날, 변두리의 떠돌이 칼은 사흘
  });

  it('첫 요구서: 폐광에 조를 들여 군에게서 넘겨받으면 예산 · 명성를 받고 요청서가 열린다. 손을 놓으면 인내가 다해 군이 물러난다', () => {
    const a = newWorld(5), b = newWorld(5);
    expect(post(a, 0, 30, { sub: 20, comfort: 100 })).not.toBeNull();
    for (let t = 0; t < 40 && !(a.order.done && b.order.done); t++) { step(a); step(b); }
    expect(a.order.done).toBe('ok');
    expect(a.rank).toBeGreaterThanOrEqual(B.LETTER_LV);
    expect(b.order.done).toBe('fail');
    expect(b.reports.some(r => r.title.startsWith('인내가 다함'))).toBe(true);
    // 군이 떠난 폐광은 다시 차오른다: 손 놓은 판은 두 달 안에 범람한다
    for (let t = 0; t < 50; t++) step(b);
    expect(b.dungeons[0].floods).toBeGreaterThan(0);
  });

  it('공고문은 공탁을 떼어 두고 보조금을 거기서 먼저 낸다. 예산이 모자라면 걸지 않고, 내리면 남은 공탁이 돌아온다', () => {
    const W = newWorld(5), b0 = W.budget;
    expect(post(W, 0, 60, { sub: 60 })).toBeNull();          // 60 × 60 × 3조 > 예산
    const n = post(W, 0, 20, { sub: 10 })!;
    expect(n.dep).toBe(600);
    expect(W.budget).toBe(b0 - 600);
    for (let t = 0; t < 5; t++) step(W);
    expect(n.dep).toBeLessThan(600);
    const left = n.dep, b1 = W.budget;
    withdraw(W, n.id);
    expect(W.budget).toBeCloseTo(b1 + left);
  });

  it('공고문은 기한이 길수록 믿고 온다: 같은 보조금이라도 짧은 공고엔 덜 든다', () => {
    const a = newWorld(5), b = newWorld(5);
    post(a, 0, 40, { sub: 15 }); post(b, 0, 10, { sub: 15 });
    for (let t = 0; t < 8; t++) { step(a); step(b); }
    expect(teamsIn(a.dungeons[0])).toBeGreaterThan(teamsIn(b.dungeons[0]));
  });

  it('공고문에 넣을 수 없는 조항(잠김 · 다른 양식 · 바탕 없음)이 있거나 조항이 없으면 내걸지 않는다', () => {
    const W = newWorld(5);
    expect(post(W, 0, 20, {})).toBeNull();
    expect(post(W, 0, 20, { goods: 3 })).toBeNull();           // 제안서 조항 · 잠김
    expect(post(W, 0, 20, { first: 1 })).toBeNull();           // 잠김 · 바탕 없음
    expect(post(W, 0, 20, { sub: 10, rec: 1, comfort: 50 })).not.toBeNull();
    expect(dropClause({ rec: 1, ration: 2, sub: 5 }, 'rec')).toEqual({ sub: 5 });
    expect(canAdd(W, 'notice', { sub: 5 }, 'ration')).toBe(false);
    expect(canAdd(W, 'notice', { sub: 5 }, 'rec')).toBe(true);
  });

  it('출입 기록 제출: 그 미궁의 마물 보고가 그날 오고, 붉은 깃발단이 언짢아한다', () => {
    const a = newWorld(8), b = newWorld(8);
    post(b, 1, 30, { rec: 1 });
    setSeed(8); step(a); const ra = getSeed();
    setSeed(8); step(b); expect(getSeed()).toBe(ra);
    expect(b.seen[1].at(-1)).toBe(b.hist[1].at(-1));
    expect(a.seen[1].at(-1)).not.toBe(a.hist[1].at(-1));
    for (let t = 0; t < 3; t++) { setSeed(80 + t); step(a); setSeed(80 + t); step(b); }   // 붉은 깃발단에는 이틀 뒤 닿는다
    expect(b.guilds.red.fav).toBeLessThan(a.guilds.red.fav);
    expect(b.guilds.shield.fav).toBeGreaterThan(a.guilds.shield.fav);   // 기사단 출신은 관청 기록을 반긴다
  });

  it('위로금: 사고의 꺼림을 덜고 잃은 조만큼 예산이 나간다', () => {
    const a = newWorld(9), b = newWorld(9);
    post(b, 0, 60, { comfort: 120 });
    for (let t = 0; t < 30; t++) { setSeed(900 + t); step(a); setSeed(900 + t); step(b); }
    expect(b.dungeons[0].dead).toBeGreaterThan(0);
    expect(b.dungeons[0].fear).toBeLessThan(a.dungeons[0].fear);
  });

  it('파견서: 사신은 걸어가 머물다 돌아오고, 품삯이 나가며 미궁 이해도가 쌓인다. 출입 기록은 돌아온 날 돌리고 보고서가 온다', () => {
    const a = newWorld(5), b = newWorld(5);
    // 관리국에 남은 사람만큼만, 한 번에 넷까지, 머물 날은 정한 범위 안
    expect(dispatch(b, 0, 5, 6)).toBeNull();
    expect(dispatch(b, 0, 2, 1)).toBeNull();
    const t = dispatch(b, 0, 4, 8)!;
    expect(crewFree(b)).toBe(0);
    expect(dispatch(b, 'wolf', 1, 4)).toBeNull();
    const way = svWay(b, 0);
    expect(t.at).toBe(way); expect(t.back).toBe(way * 2 + 8);
    const both = () => { setSeed(700 + a.day); step(a); setSeed(700 + b.day); step(b); };
    both();
    expect(b.budget).toBeCloseTo(a.budget - 4 * B.SVY.pay, 0);
    expect(b.dungeons[0].know).toBe(0);   // 가는 동안은 쌓이지 않는다
    while (b.day <= t.at + 1) both();
    expect(b.dungeons[0].know).toBeGreaterThan(0);
    // 사신은 미궁에서 죽지도 않고 꺼림을 건드리지도 않는다
    expect(b.dungeons[0].fear).toBe(a.dungeons[0].fear);
    while (b.trips.length) step(b);
    expect(b.day).toBe(t.back);
    const r = b.reports.find(x => x.trip)!;
    expect(r.title).toBe('조사 보고: 폐광');
    expect(b.dungeons[0].logged).toBe(b.dungeons[0].know >= B.SVY.full);
    expect(crewFree(b)).toBe(b.crew);
  });

  it('파견서: 짧은 공고에 사신을 붙이면 출입 기록이 길드에 돌아 넘겨받는다', () => {
    let ok = 0, rep = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const x = newWorld(seed), y = newWorld(seed);
      post(x, 0, 20, { sub: 15 }); post(y, 0, 20, { sub: 15 });
      dispatch(y, 0, 4, 8);
      for (let t = 0; t < 40; t++) { step(x); step(y); }
      expect(x.order.done).not.toBe('ok');
      if (y.order.done === 'ok') ok++;
      if (y.dungeons[0].logged) rep++;
    }
    expect(ok).toBeGreaterThanOrEqual(4);
    expect(rep).toBeGreaterThanOrEqual(4);
  });

  it('길드 본부 파견: 이해도와 영향력이 쌓이고, 속내는 이해도 단계만큼 읽힌다. 들키면 호감과 영향력이 깎인다', () => {
    const W = newWorld(7);
    const t = dispatch(W, 'wolf', 2, 4)!;
    const g = W.guilds.wolf;
    while (W.day < t.at + 2) step(W);
    expect(g.peek).toBeNull();
    expect(g.know).toBeGreaterThan(0); expect(g.grip).toBeGreaterThan(0);
    while (W.trips.length) step(W);
    const p = g.peek!;
    expect(p.pnl.length).toBe(W.dungeons.length);
    expect(p.pnl[0]).toBeLessThan(p.pnl[1]);   // 폐광은 멀어 덜 남는다
    expect(W.reports.find(x => x.trip)!.title).toBe('조사 보고: 잿빛 늑대단 본부');
    expect(knowLv(0)).toBe(0); expect(knowLv(25)).toBe(1); expect(knowLv(75)).toBe(3);
    // 이해도 낮으면 마음 한 줄뿐, 높으면 장부 셈과 금고 말
    expect(peekLines(W, p, 0).length).toBe(1);
    expect(peekLines(W, p, 2, 'wolf').some(l => l.startsWith('금고는'))).toBe(true);
    expect(peekLines(W, p, 2, 'wolf').join('')).not.toMatch(/\d+G 있|금고 \d/);
    // 영향력은 서명할 마음을 올린다
    const w0 = willOf(W, 'wolf'); g.grip += 40;
    expect(willOf(W, 'wolf')).toBeCloseTo(w0 + 40 * B.SVY.gripK, 5);
    // 호감보다 영향력이 한참 높으면(공포정치) 호감이 깎인다
    const C = JSON.parse(JSON.stringify(W)) as typeof W;
    g.fav = 10; g.grip = 80; C.guilds.wolf.fav = 10; C.guilds.wolf.grip = 0;
    setSeed(55); step(W); setSeed(55); step(C);
    expect(g.fav).toBeLessThan(C.guilds.wolf.fav);
    // 강나루 조합은 정보를 가장 꺼려 곧 들킨다
    let caught = false;
    for (let k = 0; k < 8 && !caught; k++) {
      const u = dispatch(W, 'river', 4, 20);
      while (W.trips.length) step(W);
      caught = !!u && W.reports.some(x => x.from === '강나루 조합' && x.title.includes('기웃거린'));
    }
    expect(caught).toBe(true);
  });

  it('공고문을 기한 전에 내리면 조항이 멎고 길드들이 서운해한다', () => {
    const W = newWorld(6), n = post(W, 2, 30, { sub: 15 })!;
    const fav = W.guilds.red.fav;
    expect(withdraw(W, n.id)).toBe(true);
    expect(subAt(W, 2)).toBe(0);
    expect(W.guilds.red.fav).toBeLessThan(fav);
    expect(withdraw(W, n.id)).toBe(false);
  });

  it('서기 수만큼만 서류를 낸다: 같은 미궁의 공고문을 고쳐 내거는 것은 더 쓰지 않는다', () => {
    const W = newWorld(5);
    expect(post(W, 0, 20, { sub: 10 })).not.toBeNull();
    expect(post(W, 1, 20, { sub: 10 })).toBeNull();
    expect(post(W, 0, 20, { sub: 20 })).not.toBeNull();
    expect(upgrade(W, 'clerk')).toBe(true);
    expect(upgrade(W, 'clerk')).toBe(false);   // 2단계는 명성 2단계에
    expect(post(W, 1, 20, { sub: 10 })).not.toBeNull();
  });

  it('관리국: 명성가 새 단계에 닿으면 부서 다음 단계가 열리고, 2단계에 요청서가 열린다', () => {
    const W = newWorld(5);
    expect(W.rank).toBe(1);
    expect(send(W, 'wolf', 0, 20, { sub: 10 })).toBeNull();
    W.standing = B.STAND_LV[1] + 5;
    step(W);
    expect(W.rank).toBe(2);
    expect(W.reports.at(-1)!.chips).toContain('길드 지정 서신(요청서) 열림');
    expect(toLock(W, 'wolf')).toBe('');
    expect(toLock(W, 'trade')).not.toBe('');
  });

  it('관리국 부서: 공사비는 예산에서 바로, 급료는 달 배정에서. 사신실은 사신을, 기록실은 보고 늦음을 줄인다', () => {
    const W = newWorld(5), b0 = W.budget;
    expect(upgrade(W, 'envoy')).toBe(true);
    expect(upgrade(W, 'rec')).toBe(true);
    expect(W.budget).toBe(b0 - B.DEPT.envoy.cost[0] - B.DEPT.rec.cost[0]);
    expect(crewMax(W)).toBe(B.SVY.crew + B.DEPT.envoy.add!);
    expect(payOf(W)).toBe(B.DEPT.envoy.pay + B.DEPT.rec.pay);
    expect(lagOf(W, 0)).toBe(W.dungeons[0].dist - 1);
    W.budget = 100;
    expect(upgrade(W, 'clerk')).toBe(false);   // 예산 모자람
  });

  it('예산: 입장료는 달 끝에 중앙 배정과 함께 한 번에 들어온다', () => {
    const W = newWorld(5);
    for (let t = 0; t < 5; t++) step(W);
    const b = W.budget;
    expect(W.feeMo).toBeGreaterThan(0);
    step(W);
    expect(W.budget).toBe(b);   // 보조금 · 품삯 없으면 날마다는 그대로
    while (W.day % B.MONTH) step(W);
    expect(W.feeMo).toBe(0);
    expect(W.budget).toBeGreaterThan(b + B.GRANT);
  });

  it('요청서: 이틀 뒤 답하고, 서명하면 그 길드에만 걸린다. 정보를 내달라는 청은 붉은 깃발단이 사양한다', () => {
    const W = newWorld(11);
    W.rank = 2; W.clerks = 3;
    const ok = send(W, 'wolf', 0, 30, { sub: 20 })!, no = send(W, 'red', 1, 30, { rec: 1 })!;
    expect(ok && no).toBeTruthy();
    step(W); expect(ok.until).toBeUndefined();
    step(W);
    expect(W.letters.find(l => l.id === ok.id)?.until).toBe(W.day + 30);
    expect(W.letters.find(l => l.id === no.id)).toBeUndefined();
    expect(W.reports.some(r => r.title.includes('돌아가서 검토') && r.chips.includes('－ 정보 내주기'))).toBe(true);
    expect(subAt(W, 0)).toBe(0);
    const s0 = W.dungeons[0].teams.wolf;
    for (let t = 0; t < 10; t++) step(W);
    expect(W.dungeons[0].teams.wolf).toBeGreaterThan(s0);
    const fav = W.guilds.wolf.fav;
    expect(recall(W, ok.id)).toBe(true);
    expect(W.guilds.wolf.fav).toBeLessThan(fav);
    W.guilds.red.fav = W.guilds.lamp.fav = 50; W.owe.red = W.owe.lamp = 0;
    expect(letterScore(W, { to: 'red', cl: { rec: 1 } }).v).toBeLessThan(letterScore(W, { to: 'lamp', cl: { rec: 1 } }).v);
    expect(letterScore(W, { to: 'shield', cl: { rec: 1 } }).why).toContain('＋ 관청 기록');
  });

  it('서류 쓰기: 열린 받는 쪽 · 조항만 단추와 서랍에, 받는 쪽마다 양식이 바뀐다', () => {
    const W = newWorld(7);
    const ui: BuUi = { tab: 'asks', invite: [], give: {}, intro: false, seenNews: 0, draft: { to: 'all', dg: 2, days: 30, cl: { sub: 25, rec: 1 } } };
    let h = writeHtml(W, ui);
    expect(h).toContain('공고문');
    expect(h).toContain('data-act="wto:all" aria-pressed="true"');
    expect(h).toContain('조항 서랍');
    expect(h).toContain('data-act="wadd:comfort"');                 // 서랍에서 넣기
    expect(h).not.toContain('data-act="wadd:sub"');                 // 넣은 조항은 '넣음'
    expect(h).toContain('data-act="wdel:rec"');
    expect(h).toContain('미궁 출입 길드 전체');
    expect(h).toMatch(/제2조<\/b><div class="c-body"><p>들고 난 조의 인원/);
    expect(h).not.toContain('🔒');
    expect(h).not.toContain('붉은 깃발단 · 요청서');
    expect(h).not.toContain('상단');
    expect(writeHtml(W, { ...ui, draft: { to: 'red', dg: 2, days: 30, cl: { sub: 25 } } })).toContain('미궁 출입 길드 전체');
    W.rank = 2;
    h = writeHtml(W, { ...ui, draft: { to: 'red', dg: 2, days: 30, cl: { sub: 25 } } });
    expect(h).toContain('붉은 깃발단 귀하');
    expect(h).toContain('요청서 보내기');
    const n = post(W, 2, 30, { sub: 25 })!;
    expect(paneHtml(W, ui)).toContain(`withdraw:${n.id}`);
    expect(paneHtml(W, ui)).toContain('data-act="write:2"');
    expect(writeHtml(W, ui)).toContain('고쳐 내걸기');
    expect(paneHtml(W, { ...ui, tab: 'look', sel: 'dg:2' })).toContain('공고문 · 30일 남음');
    expect(paneHtml(W, { ...ui, tab: 'lib' })).not.toContain('상단 물품 추가');
    expect(paneHtml(W, { ...ui, tab: 'lib' })).toContain('진입 보조금');
    expect(paneHtml(W, { ...ui, tab: 'look', sel: '' })).not.toContain('우선권');
    expect(paneHtml(W, { ...ui, tab: 'office' })).toContain('서기');
  });
});

describe('첫 화면과 받은 서류 창', () => {
  it('신문 한 면으로 시작하고, 업무를 시작하면 요구서가 창으로 온다. 청 · 독촉은 오른쪽 위 쪽지로 떠 있고 누르면 펼친다', () => {
    expect(introHtml()).toContain('업무 시작');
    expect(introHtml()).toContain('미궁관리국 새로 둬');
    expect(introHtml()).toContain('왕 도 일 보');
    // 신문 앞 첫 장면: 그림 여덟 장, 단추는 건너뛰기 하나뿐(고르는 단추 없음)
    const cut = openingHtml();
    expect(cut.match(/class="cut-p/g)?.length).toBe(SHOT_N);
    expect(cut.match(/<button/g)?.length).toBe(1);
    expect(cut).toContain('건너뛰기');
    const W = newWorld(5);
    const ui: BuUi = { tab: 'look', invite: [], give: {}, intro: false, seenNews: 0, docSeen: 0, askSeen: 0 };
    let h = docModalHtml(W, ui);
    expect(h).toContain('폐광 인계에 관한 요구');
    expect(h).toContain('중 앙 행 정 원');
    // 붙임은 실제로 펼쳐진다: 폐광 실태 조사서(길드마다 오가는 길)
    expect(h).toContain('data-act="read:-3"');
    const sv = reportDocHtml(W, -3, true);
    expect(sv).toContain('폐광 실태 조사');
    for (const g of GUILDS) expect(sv).toContain(B.GUILD[g].name);
    const k = Number(/seen:(\d+)/.exec(h)![1]);
    expect(docModalHtml(W, { ...ui, docSeen: k + 1 })).toBe('');
    W.asks.push({ id: 1, day: 0, due: 5, from: 'wolf', kind: 'aid', want: 200, chips: [] });
    expect(docModalHtml(W, { ...ui, docSeen: k + 1 })).toBe('');          // 저절로 뜨지 않는다
    expect(asksFloatHtml(W, { ...ui, docSeen: k + 1 })).toContain('data-act="ask:1"');
    expect(asksFloatHtml(W, { ...ui, docSeen: k + 1 })).toContain('pulse');   // 아직 펼치지 않음
    expect(asksFloatHtml(W, { ...ui, askSeen: 1 })).not.toContain('pulse');
    h = docModalHtml(W, { ...ui, docSeen: k + 1, ask: 1 });
    expect(h).toContain('answer:1');
    expect(h).toContain('refuse:1');
    W.asks[0].got = 0;
    expect(asksFloatHtml(W, ui)).not.toContain('ask-note');
    // 쪽지 맨 위엔 할 일(받은 요구서를 줄인 것) · 효력 중인 서류
    expect(asksFloatHtml(W, ui)).toContain('폐광 인계');
    expect(asksFloatHtml(W, ui)).not.toContain('효력 중');
    post(W, 0, 20, { sub: 10 });
    expect(asksFloatHtml(W, ui)).toContain('효력 중');
  });
});

describe('첫 사건의 업무 안내', () => {
  it('상태로 넘어간다: 요구서 받음 → 기록 → 서류 → 날 넘기기 → 조가 듦, 요구서가 끝나면 사라진다', () => {
    const W = newWorld(5);
    const ui: BuUi = { tab: 'look', invite: [], give: {}, intro: false, seenNews: 0, docSeen: 0 };
    expect(tutOf(W, ui)).toBe('');                               // 요구서를 아직 받지 않음
    ui.docSeen = W.reports.length;
    expect(tutOf(W, ui)).toBe('lib');
    expect(deskHtml(W, ui)).toContain('class="obj pulse" data-act="tab:lib"');
    ui.tutPnl = true;
    expect(tutOf(W, ui)).toBe('write');
    post(W, 0, 30, { sub: 15 });
    expect(tutOf(W, ui)).toBe('wait');
    expect(topHtml(W, ui)).toContain('go pulse');
    for (let t = 0; t < 6 && tutOf(W, ui) === 'wait'; t++) stepRaw(W);
    expect(tutOf(W, ui)).toBe('permit');                           // 길드가 신청서를 보냄: 허락해야 조가 든다
    for (let t = 0; t < 6 && tutOf(W, ui) !== 'see'; t++) step(W);
    expect(tutOf(W, ui)).toBe('see');
    // 요구서가 끝나면 다음 목표(마을이 서는 폐광)를 가리키고, 마을이 서면 사라진다
    W.order.done = 'ok';
    expect(tutOf(W, ui)).toBe('road');
    W.dungeons[0].dev = B.DEV[0];
    expect(tutOf(W, ui)).toBe('town');
    W.dungeons[0].dev = B.DEV[1];
    expect(tutOf(W, ui)).toBe('');
    expect(docModalHtml(newWorld(5), { ...ui, docSeen: 0 })).toContain('폐광 실태 조사서 1부');
    // 서류 글은 세상 안의 말로만: 명성 같은 판의 수치를 적지 않는다
    for (const title of ['폐광 인계 · 요구서 달성', '인내가 다함 · 왕국군 철수'])
      expect(JSON.stringify(docOf({ day: 9, from: '중앙 행정원', title, chips: ['예산 +1000G', '명성 +10'] }))).not.toContain('명성');
  });
});

describe('미궁 손익 자료', () => {
  it('현장 수익을 날마다 적는다: 폐광도 현장에선 남지만, 길이 멀어 길드 대부분에겐 밑진다. 보조금은 빼고 적는다', () => {
    const W = newWorld(5);
    expect(W.pnl[0][0]).toBeGreaterThan(0);
    expect(W.pnl[1][0]).toBeGreaterThan(0);
    // 남는 값 = 현장 수익 − 오가는 날 × 하루 값: 폐광은 중간값이 0보다 낮고, 다른 미궁은 높다
    expect(pnlSum(W, 0).mid).toBeLessThan(0);
    expect(pnlSum(W, 0).way).toBeGreaterThan(pnlSum(W, 1).way);
    expect(pnlSum(W, 1).mid).toBeGreaterThan(0);
    const p0 = W.pnl[0][0];
    W.dungeons[0].sub = 30;
    step(W);
    expect(W.pnl[0].length).toBe(2);
    expect(Math.abs(W.pnl[0][1] - p0)).toBeLessThan(10);
    const ui: BuUi = { tab: 'lib', invite: [], give: {}, intro: false, seenNews: 0, shelf: 'in' };
    // 손익 자료는 아직 서가에 없다(미궁 앞 기록소가 서면 받은 서류로 온다). 대신 테사의 첫 보고가 받은 서류 맨 위에 있다
    expect(writeHtml(W, ui)).not.toContain('손익 자료');
    expect(paneHtml(W, { ...ui, shelf: 'cl' })).not.toContain('손익 자료');
    expect(paneHtml(W, ui)).toContain('read:-2');
    expect(tessaReportHtml(W)).toContain('징세청 장부');
    // 받은 서류는 종류로 거른다
    expect(paneHtml(W, { ...ui, dkind: '신문' })).not.toContain('read:-2');
    // 조항은 꼬리표로 거른다
    expect(paneHtml(W, { ...ui, shelf: 'cl', ctag: '안전' })).not.toContain('진입 보조금');
    expect(paneHtml(W, { ...ui, shelf: 'cl', ctag: '돈' })).toContain('진입 보조금');
    // 낸 서류 기록 · 받은 서류 철 (다시 보기)
    post(W, 0, 20, { sub: 10 });
    expect(paneHtml(W, { ...ui, shelf: 'out' })).toContain('공고문: 폐광');
    const h = paneHtml(W, { ...ui, shelf: 'in', docSeen: W.reports.length });
    expect(h).toContain('read:');
  });
});

describe('길드 일곱: 큰 길드 둘 · 작은 길드 다섯, 본부에서 미궁까지 거리', () => {
  const W5 = () => newWorld(5);
  it('큰 길드 둘과 작은 길드 다섯으로 시작하고, 큰 길드는 몸집이 몇 곱절이다', () => {
    const W = newWorld(5), big = GUILDS.filter(g => B.GUILD[g].big), small = GUILDS.filter(g => !B.GUILD[g].big);
    expect(big.length).toBe(2);
    expect(small.length).toBe(5);
    expect(Math.min(...big.map(g => W.guilds[g].size))).toBeGreaterThan(Math.max(...small.map(g => W.guilds[g].size)) * 3);
    // 성격(돈 · 안전 · 정보 · 권리 · 기한 읽기 · 거리)이 겹치지 않는다
    const sig = GUILDS.map(g => { const t = B.GUILD[g]; return [t.cash, t.safe, t.info, t.right, t.trust.base, t.at.join()].join('|'); });
    expect(new Set(sig).size).toBe(GUILDS.length);
  });

  it('오가는 날 · 공고가 닿는 날은 지도(타일) 위를 걷는 값으로 셈한다: 본부를 옮기면 바뀐다', () => {
    const at = B.GUILD.wolf.at;
    try {
      const W = W5();
      B.GUILD.wolf.at = [...W.dungeons[2].at];
      expect(wayOf(W, 'wolf', 2)).toBe(1);
      B.GUILD.wolf.at = [38, 2];
      expect(wayOf(W, 'wolf', 0)).toBeGreaterThanOrEqual(3);
      expect(hqOf('wolf')).toBeGreaterThanOrEqual(3);
    } finally { B.GUILD.wolf.at = at; }
  });

  it('본부가 먼 길드는 같은 보조금에도 폐광에 덜 온다: 손익 자료엔 길드 하나하나 대신 중간값 · 평균값만', () => {
    // 몸집이 같은 작은 길드 둘: 잿빛 늑대단(폐광까지 1일) · 강나루 조합(3일)
    expect(B.GUILD.wolf.size).toBe(B.GUILD.river.size);
    const W0 = newWorld(5);
    expect(wayOf(W0, 'wolf', 0)).toBeLessThan(wayOf(W0, 'river', 0));
    let near = 0, far = 0;
    for (const seed of SEEDS.slice(0, 10)) {
      const W = newWorld(seed);
      post(W, 0, 30, { sub: 15 });
      for (let t = 0; t < 12; t++) step(W);
      near += W.dungeons[0].teams.wolf; far += W.dungeons[0].teams.river;
      expect(pnlGuild(W, 'wolf', 0)).toBeGreaterThan(pnlGuild(W, 'river', 0));
    }
    expect(near).toBeGreaterThan(far * 1.2);
    const W = newWorld(5);
    const h = tessaReportHtml(W);
    expect(h).toContain('길드마다');
    expect(h).toContain(' ~ ');
    expect(h).not.toContain(B.GUILD.wolf.name);
  });
});

describe('외진 폐광과 발전도 (R2 발길)', () => {
  it('폐광은 어느 본부에서도 사흘 이상이다: 벌이가 아니라 길이 문제다', () => {
    const W = newWorld(5);
    for (const g of GUILDS) expect(wayOf(W, g, 0), g).toBeGreaterThanOrEqual(3);
    expect(W.dungeons[0].yld).toBeGreaterThan(W.dungeons[1].yld);
  });

  it('발길이 쌓이면 길이 닦이고(−1일), 마을이 서며 가장 많이 다닌 길드가 지부를 낸다(하루 길)', () => {
    const W = newWorld(5), way0 = GUILDS.map(g => wayOf(W, g, 0));
    expect(devStage(W.dungeons[0])).toBe(0);
    post(W, 0, 30, { sub: 20 });
    let s1 = 0;
    for (let t = 0; t < 120 && devStage(W.dungeons[0]) < 2; t++) {
      step(W);
      if (!s1 && devStage(W.dungeons[0]) === 1) { s1 = W.day; GUILDS.forEach((g, k) => expect(wayOf(W, g, 0)).toBe(way0[k] - 1)); }
    }
    expect(s1).toBeGreaterThan(0);
    expect(devStage(W.dungeons[0])).toBe(2);
    const br = W.dungeons[0].branch!;
    expect(br).toBe(GUILDS.reduce((a, b) => W.dungeons[0].gdev[b] > W.dungeons[0].gdev[a] ? b : a));
    expect(wayOf(W, br, 0)).toBe(1);
    expect(W.reports.some(r => r.title.includes('지부 개설') && r.from === W.guilds[br].name)).toBe(true);
    // 다른 미궁은 외지지 않아 발전도가 쌓이지 않는다
    expect(W.dungeons[1].dev).toBe(0);
  });

  it('관할 지도는 타일이다: 본부 · 미궁은 물이 아닌 칸에 서고, 처음 길은 폐광에 닿지 않는다. 1단계에 관리국에서 새 길이 놓인다', () => {
    for (const g of GUILDS) expect(groundAt(...B.GUILD[g].at), g).not.toBe('~');
    for (const at of [BUREAU_AT, LOYD_AT, HAVEL_AT, ...newWorld(1).dungeons.map(d => d.at)]) expect(groundAt(...at)).not.toBe('~');
    const pit = newWorld(1).dungeons[0].at;
    expect(isRoad(ROADS, ...pit)).toBe(false);
    expect(isRoad(ROADS, ...BUREAU_AT)).toBe(true);
    const r = devRoadOf(0);
    expect(r.length).toBeGreaterThan(0);
    expect(r.at(-1)).toEqual(pit);
    for (const [x, y] of r) expect(isRoad(ROADS, x, y)).toBe(false);
    // 길은 들보다 싸다: 같은 두 칸이라도 길을 타면 덜 든다
    expect(walkCost(ROADS, BUREAU_AT, LOYD_AT)).toBeLessThan(walkCost(new Set(), BUREAU_AT, LOYD_AT));
  });

  it('지도에 발전도가 보인다: 0단계엔 새 길이 없고, 2단계엔 마을과 지부 깃발', () => {
    const W = newWorld(5), ui: BuUi = { tab: 'look', invite: [], give: {}, intro: false, seenNews: 0 };
    expect(mapHtml(W, ui)).not.toContain('class="dev"');
    post(W, 0, 30, { sub: 20 });
    for (let t = 0; t < 120 && devStage(W.dungeons[0]) < 2; t++) step(W);
    const h = mapHtml(W, ui);
    expect(h).toContain('class="dev"');
    expect(h).toContain('길목 여관');
    expect(h).toContain(`town f-${W.dungeons[0].branch}`);
    // 미궁에 든 길드는 길 위에 말(미니어처)이 있다
    expect(minisOf(W).some(m => m.key.startsWith('t-0-'))).toBe(true);
  });

  it('보조금을 거둔 뒤에도 마을이 선 폐광엔 발길이 이어진다: 보조금 없이 둔 판보다 훨씬 많다', () => {
    let built = 0, none = 0;
    for (const seed of SEEDS.slice(0, 6)) {
      const A = newWorld(seed), N = newWorld(seed);
      post(A, 0, 30, { sub: 20 });
      for (let t = 0; t < 150; t++) { step(A); step(N); }
      expect(subAt(A, 0)).toBe(0);
      built += teamsIn(A.dungeons[0]); none += teamsIn(N.dungeons[0]);
    }
    expect(built).toBeGreaterThan(none * 3);
  });
});

describe('인과 루프 그림 (loops.ts)', () => {
  it('고리마다 길이 정의된 화살표로 닫히고, 음 화살표 수가 R · B와 맞는다', () => {
    for (const c of checkLoops()) expect(c.why, c.id).toEqual([]);
    const ids = new Set(NODES.map(n => n.id));
    for (const e of [...EDGES, ...LINKS]) expect(ids.has(e.from) && ids.has(e.to), `${e.from}→${e.to}`).toBe(true);
  });

  it('엔진이 켜는 고리가 모두 그림에 있고, smart · normal 봇 판에서 모두 켜진다', () => {
    const W0 = newWorld(1000);
    expect(LOOPS.map(l => l.id).sort()).toEqual(Object.keys(W0.stats.loops).sort());
    const on: Record<string, number> = {};
    // R1(범람 소용돌이)은 폐광을 눌러 둔 채 시작해 smart 판에선 드물다: normal 판까지 함께 본다
    for (let g = 0; g < 20; g++) {
      const W = run(newWorld(1000 + (g >> 1)), g % 2 ? BOT.normal : BOT.smart);
      expect(W.stats.litHist.length).toBe(B.DAYS);
      for (const l of LOOPS) on[l.id] = (on[l.id] ?? 0) + W.stats.loops[l.id];
    }
    // B5(빚 독촉)는 봇 판에서 드물다(판당 0 ~ 0.3번, 시세 사슬 뒤로 더 드묾): 회의를 거듭 열어 빚을 지는 판으로 따로 본다
    for (const l of LOOPS) if (l.id !== 'B5') expect(on[l.id], l.id).toBeGreaterThan(0);
    const W = newWorld(1000);
    while (W.day < 120) { BOT.normal(W); meet(W, ['red', 'shield', 'wolf']); step(W); }
    expect(W.stats.loops.B5).toBeGreaterThan(0);
  });
});

describe('미궁관리국 게임판 (ui/bureau)', () => {
  it('판 · 탭 · 끝 화면을 날마다 그린다', () => {
    const W = newWorld(1003);
    const ui: BuUi = { tab: 'asks', invite: [], give: {}, intro: false, seenNews: 0 };
    while (!over(W)) {
      BOT.smart(W); step(W);
      if (W.day % 45 === 0) {
        expect(topHtml(W)).toContain('예산');
        for (const d of W.dungeons) expect(mapHtml(W, ui)).toContain(d.name);
        for (const tab of ['look', 'asks', 'lib', 'meet', 'office'] as const) expect(paneHtml(W, { ...ui, tab }).length).toBeGreaterThan(20);
        for (const sel of ['dg:1', 'fac:red', 'fac:drift', 'fac:dawn']) expect(paneHtml(W, { ...ui, tab: 'look', sel })).toContain('관할 요약');
      }
    }
    expect(endHtml(W, W, W)).toContain('임기');
    expect(topHtml(W)).not.toContain('data-act="reset"');  // 새로 시작은 위 띠 구석의 설정 창에만
    expect(topHtml(W)).toContain('data-act="set"');
    expect(setHtml(W)).toContain('data-act="reset"');
  });

  it('저장한 판(JSON + 난수 자리)을 이어 하면 그대로 흘러간다', () => {
    const a = newWorld(1004);
    for (let t = 0; t < 40; t++) { BOT.normal(a); step(a); }
    const saved = JSON.stringify(a), rng = getSeed();
    for (let t = 0; t < 40; t++) { BOT.normal(a); step(a); }
    const b = JSON.parse(saved); setSeed(rng);
    for (let t = 0; t < 40; t++) { BOT.normal(b); step(b); }
    expect(b.day).toBe(a.day);
    expect(b.standing).toBeCloseTo(a.standing, 9);
    expect(b.dungeons.map((d: any) => d.level)).toEqual(a.dungeons.map(d => d.level));
  });
});

// 시세 사슬(반출 과잉, docs/systems.md §0.17): 반출 → 상단 재고 → 시세 → 벌이 → 조
describe('시세 사슬', () => {
  const tick = (W: World, n: number) => { for (let t = 0; t < n; t++) step(W); };

  it('창고가 무거우면 시세가 닷새마다 조금씩 내려가고, 벌이와 판매가 함께 준다', () => {
    const a = newWorld(41), b = newWorld(41);
    a.mkt.stock = B.MKT.hold * demOf() * 3;
    tick(a, 4); tick(b, 4);
    expect(a.mkt.price).toBe(1);                       // 닷새 전에는 그대로(느린 값)
    tick(a, 1); tick(b, 1);
    expect(a.mkt.price).toBeLessThan(1);
    tick(a, 20); tick(b, 20);
    expect(a.mkt.price).toBeLessThan(b.mkt.price);
    expect(lure(a, a.dungeons[1])).toBeLessThan(lure(b, b.dungeons[1]));
    expect(a.stats.litHist.flat()).toContain('B6');
  });

  it('반출 짐은 며칠 걸려 창고에 닿는다(징후가 먼저, 값은 나중)', () => {
    const W = newWorld(42), s0 = W.mkt.stock;
    W.mkt.road = Array(B.MKT.lag).fill(0);           // 길 위에 짐이 없다: lag일 동안 창고는 줄기만 한다
    tick(W, B.MKT.lag);
    expect(W.mkt.stock).toBeLessThan(s0);
    const before = W.mkt.stock; tick(W, 1);
    expect(W.mkt.outHist.length).toBe(B.MKT.lag + 1);
    expect(W.mkt.stock).toBeGreaterThan(before - demOf()); // 그날 처음으로 짐이 닿는다
  });

  it('신문은 문턱을 넘을 때만 쓴다: 내림세 한 번, 돌아올 때 한 번', () => {
    const W = newWorld(43);
    W.mkt.stock = B.MKT.hold * demOf() * 6;
    tick(W, 60);
    const low = W.reports.filter(r => r.title.startsWith('소재 값 내림세'));
    expect(low.length).toBe(1);
    W.mkt.stock = 0;
    tick(W, 60);
    expect(W.reports.filter(r => r.title.startsWith('소재 값 내림세')).length).toBe(1);
    expect(W.reports.filter(r => r.title.startsWith('소재 값 제자리로')).length).toBe(1);
    // 기사에는 수치가 없다
    const k = W.reports.findIndex(r => r.title.startsWith('소재 값 내림세'));
    expect(reportDocHtml(W, k, true)).not.toMatch(/\d+\.\d|%/);
  });

  it('국장은 시세를 모른다: 사신이 창고 장부를 읽어 와야 상단 제안서가 열린다', () => {
    const W = newWorld(44);
    expect(toLock(W, 'trade')).not.toBe('');
    expect(propose(W, 0, 20, { buy: 6 })).toBeNull();
    expect(writeHtml(W, { tab: 'asks', open: true, invite: [], give: {}, draft: { to: 'trade', dg: 0, days: 20, cl: {} } } as unknown as BuUi)).not.toContain('비축 매입');
    const t = dispatch(W, 'mkt', 2, 4)!;
    expect(t).not.toBeNull();
    while (W.trips.length) step(W);
    expect(W.mkt.read).toBeGreaterThan(0);
    expect(toLock(W, 'trade')).toBe('');
    const r = [...W.reports].reverse().find(x => x.trip?.to === 'mkt')!;
    expect(r.trip!.mkt).toBeDefined();
    const k = W.reports.indexOf(r);
    const doc = reportDocHtml(W, k, true);
    expect(doc).toContain('상단 창고');
    expect(doc).not.toMatch(/시세 \d|\d+\.\d/);          // 장부도 말로만
    expect(writeHtml(W, { tab: 'asks', open: true, invite: [], give: {}, draft: { to: 'trade', dg: 0, days: 20, cl: {} } } as unknown as BuUi)).toContain('비축 매입');
  });

  it('비축 매입은 창고를 덜어 시세를 받치고, 값은 예산에서 나간다', () => {
    const make = () => { const W = newWorld(45); W.mkt.read = 0; W.mkt.stock = B.MKT.hold * demOf() * 2; return W; };
    const a = make(), b = make();
    const o = propose(a, 0, 40, { buy: 20 })!;
    expect(o).not.toBeNull();
    expect(propose(a, 0, 40, { buy: 20 })).toBeNull();       // 서기 한 명뿐
    const b0 = a.budget, c0 = b.budget;
    tick(a, 30); tick(b, 30);
    expect(a.mkt.bought).toBeGreaterThan(0);
    expect(a.mkt.price).toBeGreaterThan(b.mkt.price);
    expect(b0 - a.budget).toBeGreaterThan(c0 - b.budget);
    expect(unpropose(a, o.id)).toBe(true);
    expect(a.offers.length).toBe(0);
  });

  it('보조금을 늘 세게 거는 국장은 시세가 꺾여 범람을 맞는다(보조금이 많을수록 좋다는 답이 깨진다)', () => {
    const heavy = (W: World) => { for (const a of W.asks) if (a.kind === 'permit' && a.got == null) answer(W, a.id, a.want); W.dungeons.forEach(d => { d.sub = W.budget > 0 ? 30 : 0; }); };
    const seeds = SEEDS.slice(0, 10);
    const floods = () => seeds.reduce((s, seed) => s + run(newWorld(seed), heavy).stats.floods, 0) / seeds.length;
    const withMkt = floods();
    const k = B.MKT.k; B.MKT.k = 0;                          // 시세를 묶은 판
    const fixed = floods();
    B.MKT.k = k;
    expect(withMkt).toBeGreaterThan(fixed);
  });
});

describe('출입 허가제 · 검문소 · 탐사 명성', () => {
  const denyAll = (W: World) => { for (const a of W.asks) if (a.kind === 'permit' && a.got == null) answer(W, a.id, 0); };
  it('길드는 허가보다 많이 바라면 신청서를 낸다. 답하지 않으면 지금 허가 그대로, 숫자로 답하면 그 조 수가 허가다', () => {
    const W = newWorld(5);
    post(W, 0, 30, { sub: 20 });
    expect(permitOf(W, 0)).toBe(0);
    for (let t = 0; t < 8 && !W.asks.some(x => x.kind === 'permit' && x.dg === 0); t++) stepRaw(W);
    const a = W.asks.find(x => x.kind === 'permit' && x.dg === 0)!;
    expect(a).toBeTruthy();
    expect(a.want).toBeGreaterThan(1);
    const g = a.from as typeof GUILDS[number], half = Math.floor(a.want / 2);
    answer(W, a.id, half);
    expect(W.permit[g][0]).toBe(half);
    expect(a.got).toBe(half);
    // 답하지 않은 신청서는 기한이 지나면 지금 허가 그대로
    const W2 = newWorld(5);
    post(W2, 0, 30, { sub: 20 });
    for (let t = 0; t < 8 && !W2.asks.some(x => x.kind === 'permit' && x.dg === 0); t++) stepRaw(W2);
    const b = W2.asks.find(x => x.kind === 'permit' && x.dg === 0)!, before = W2.permit[b.from as typeof GUILDS[number]][0];
    for (let t = 0; t < B.PERMIT.due + 1 && b.got == null; t++) stepRaw(W2);
    expect(b.got).toBe(before);
    expect(W2.permit[b.from as typeof GUILDS[number]][0]).toBe(before);
  });

  it('허가 밖 조는 몰래 들어 입장료를 내지 않고, 검문소가 있으면 막아 되돌린다. 공사비와 달 급료가 든다', () => {
    const run1 = (gate: boolean) => {
      const W = newWorld(5);
      post(W, 0, 30, { sub: 25 });
      if (gate) expect(buildGate(W, 0)).toBe(true);
      for (let t = 0; t < 20; t++) { denyAll(W); stepRaw(W); }
      return W;
    };
    const open = run1(false), shut = run1(true);
    expect(open.stats.leaked).toBeGreaterThan(0);
    expect(teamsIn(open.dungeons[0])).toBeGreaterThan(0.3);            // 몰래 든 조
    expect(teamsIn(shut.dungeons[0])).toBeLessThan(teamsIn(open.dungeons[0]));
    expect(shut.stats.turned).toBeGreaterThan(0);
    expect(shut.stats.leaked).toBeLessThan(open.stats.leaked);
    expect(payOf(shut)).toBe(B.GATE.pay);
    expect(buildGate(shut, 0)).toBe(false);                            // 두 번 짓지 않는다
  });

  it('명성은 허가받은 조의 탐사가 성공할 때 쌓인다. 허가를 모두 거두면 쌓이지 않는다', () => {
    const play = (grant: boolean) => {
      const W = newWorld(5);
      post(W, 1, 30, { sub: 10 }); post(W, 2, 30, { sub: 10 });
      if (!grant) for (const g of GUILDS) W.permit[g] = W.permit[g].map(() => 0);
      for (let t = 0; t < 60; t++) { if (grant) for (const a of W.asks) if (a.kind === 'permit' && a.got == null) answer(W, a.id, a.want); else denyAll(W); stepRaw(W); }
      return W;
    };
    const yes = play(true), no = play(false);
    expect(yes.stats.expN).toBeGreaterThan(0);
    expect(yes.stats.expOk).toBeGreaterThan(no.stats.expOk + 5);
    expect(yes.standing).toBeGreaterThan(no.standing);
    expect(yes.reports.some(r => r.title === '이달 탐사 결산')).toBe(true);
  });

  it('화면: 신청서는 쪽지 · 편지 · 받은 서류 칸에 조 수로 적히고 도장으로 답하며, 관리국 창에 검문소 줄이 있다', () => {
    const W = newWorld(5);
    post(W, 0, 30, { sub: 20 });
    for (let t = 0; t < 8 && !W.asks.some(x => x.kind === 'permit'); t++) stepRaw(W);
    const a = W.asks.find(x => x.kind === 'permit')!, ui: BuUi = { tab: 'asks', invite: [], give: {}, intro: false, seenNews: 0, docSeen: W.reports.length };
    expect(asksFloatHtml(W, ui)).toContain(`${a.want}조`);
    expect(paneHtml(W, ui)).toContain('도장');
    expect(docModalHtml(W, { ...ui, ask: a.id })).toContain('출입 허가 신청서');
    expect(paneHtml(W, { ...ui, tab: 'office' })).toContain('data-act="gate:0"');
    expect(deskHtml(W, ui)).toContain('신청서');
  });

  it('범람은 명성을 깎는다', () => {
    const W = newWorld(5);
    const s0 = W.standing;
    W.dungeons[0].level = 99.9; W.dungeons[0].fear = 0;
    for (let t = 0; t < 3; t++) stepRaw(W);
    expect(W.stats.floods).toBeGreaterThan(0);
    expect(W.standing).toBeLessThan(s0);
  });

  it('숙련 봇(허가를 헤아려 주고 검문소를 짓는다)이 보통 봇보다 명성이 높다', () => {
    const smart = avg('smart', W => W.standing), normal = avg('normal', W => W.standing);
    expect(smart).toBeGreaterThan(normal);
  });
});
