// 미궁관리국 배경 엔진 0단계: 인과 루프 두 쌍이 폭주하거나 멈추지 않는지, 국장의 손이 판을 바꾸는지
import { describe, expect, it } from 'vitest';
import { B, answer, clauseOn, hireClerk, subAt, letterScore, meet, newWorld, over, pactK, post, recall, relOf, run, send, step, teamsIn, withdraw } from '../src/bureau/engine';
import { BOT, playGame } from '../sim/bureau';
import { EDGES, LINKS, LOOPS, NODES, checkLoops } from '../src/bureau/loops';
import { type BuUi, docModalHtml, endHtml, introHtml, paneHtml, topHtml, writeHtml } from '../src/ui/bureau/board';
import { mapHtml } from '../src/ui/bureau/map';
import { canAdd, dropClause, toLock } from '../src/bureau/clauses';
import { getSeed, setSeed } from '../src/core/rng';

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
    expect(sF).toBeLessThanOrEqual(nF);             // 왕국군이 폐광을 눌러 두고 시작해 손을 쓰는 봇은 거의 범람이 없다
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
    expect(clauseOn(W, d, 'sub', 'small')).toBeUndefined();
    step(W);
    expect(clauseOn(W, d, 'sub', 'small')).toBe(20);
    expect(clauseOn(W, d, 'sub', 'big')).toBeUndefined();
    step(W);
    expect(clauseOn(W, d, 'sub', 'big')).toBe(20);
  });

  it('첫 요구서: 폐광에 조를 들여 군에게서 넘겨받으면 예산 · 입지를 받고 요청서가 열린다. 손을 놓으면 인내가 다해 군이 물러난다', () => {
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

  it('출입 기록 제출: 그 미궁의 수위 보고가 그날 오고, 붉은 깃발단이 언짢아한다', () => {
    const a = newWorld(8), b = newWorld(8);
    post(b, 1, 30, { rec: 1 });
    setSeed(8); step(a); const ra = getSeed();
    setSeed(8); step(b); expect(getSeed()).toBe(ra);
    expect(b.seen[1].at(-1)).toBe(b.hist[1].at(-1));
    expect(a.seen[1].at(-1)).not.toBe(a.hist[1].at(-1));
    for (let t = 0; t < 3; t++) { setSeed(80 + t); step(a); setSeed(80 + t); step(b); }   // 붉은 깃발단에는 이틀 뒤 닿는다
    expect(b.guilds.big.fav).toBeLessThan(a.guilds.big.fav);
  });

  it('위로금: 사고의 꺼림을 덜고 잃은 조만큼 예산이 나간다', () => {
    const a = newWorld(9), b = newWorld(9);
    post(b, 0, 60, { comfort: 120 });
    for (let t = 0; t < 30; t++) { setSeed(900 + t); step(a); setSeed(900 + t); step(b); }
    expect(b.dungeons[0].dead).toBeGreaterThan(0);
    expect(b.dungeons[0].fear).toBeLessThan(a.dungeons[0].fear);
  });

  it('공고문을 기한 전에 내리면 조항이 멎고 길드들이 서운해한다', () => {
    const W = newWorld(6), n = post(W, 2, 30, { sub: 15 })!;
    const fav = W.guilds.big.fav;
    expect(withdraw(W, n.id)).toBe(true);
    expect(subAt(W, 2)).toBe(0);
    expect(W.guilds.big.fav).toBeLessThan(fav);
    expect(withdraw(W, n.id)).toBe(false);
  });

  it('서기 수만큼만 서류를 낸다: 같은 미궁의 공고문을 고쳐 내거는 것은 더 쓰지 않는다', () => {
    const W = newWorld(5);
    expect(post(W, 0, 20, { sub: 10 })).not.toBeNull();
    expect(post(W, 1, 20, { sub: 10 })).toBeNull();
    expect(post(W, 0, 20, { sub: 20 })).not.toBeNull();
    W.pts = 1;
    expect(hireClerk(W)).toBe(true);
    expect(hireClerk(W)).toBe(false);
    expect(post(W, 1, 20, { sub: 10 })).not.toBeNull();
  });

  it('집무실: 입지가 새 단계에 닿으면 서기 몫이 생기고, 2단계에 요청서가 열린다', () => {
    const W = newWorld(5);
    expect(W.rank).toBe(1);
    expect(send(W, 'small', 0, 20, { sub: 10 })).toBeNull();
    W.standing = B.STAND_LV[1] + 5;
    step(W);
    expect(W.rank).toBe(2);
    expect(W.pts).toBe(1);
    expect(W.reports.at(-1)!.chips).toContain('길드 지정 서신(요청서) 열림');
    expect(toLock(W, 'small')).toBe('');
    expect(toLock(W, 'trade')).not.toBe('');
  });

  it('요청서: 이틀 뒤 답하고, 서명하면 그 길드에만 걸린다. 정보를 내달라는 청은 붉은 깃발단이 사양한다', () => {
    const W = newWorld(11);
    W.rank = 2; W.clerks = 3;
    const ok = send(W, 'small', 0, 30, { sub: 20 })!, no = send(W, 'big', 1, 30, { rec: 1 })!;
    expect(ok && no).toBeTruthy();
    step(W); expect(ok.until).toBeUndefined();
    step(W);
    expect(W.letters.find(l => l.id === ok.id)?.until).toBe(W.day + 30);
    expect(W.letters.find(l => l.id === no.id)).toBeUndefined();
    expect(W.reports.some(r => r.title.includes('돌아가서 검토') && r.chips.includes('－ 정보 내주기'))).toBe(true);
    expect(subAt(W, 0)).toBe(0);
    const s0 = W.dungeons[0].teams.small;
    for (let t = 0; t < 10; t++) step(W);
    expect(W.dungeons[0].teams.small).toBeGreaterThan(s0);
    const fav = W.guilds.small.fav;
    expect(recall(W, ok.id)).toBe(true);
    expect(W.guilds.small.fav).toBeLessThan(fav);
    expect(letterScore(W, { to: 'big', cl: { rec: 1 } }).v).toBeLessThan(letterScore(W, { to: 'small', cl: { rec: 1 } }).v);
  });

  it('서류 탭: 열린 받는 쪽 · 조항만 드롭다운에, 받는 쪽마다 양식이 바뀐다', () => {
    const W = newWorld(7);
    const ui: BuUi = { tab: 'asks', invite: ['big', 'small'], give: {}, intro: false, seenNews: 0, draft: { to: 'all', dg: 2, days: 30, cl: { sub: 25, rec: 1 } } };
    let h = writeHtml(W, ui);
    expect(h).toContain('공고문');
    expect(h).toContain('<select data-act="wto"');
    expect(h).toContain('수신: 미궁 출입 길드 전체');
    expect(h).toContain('제2조 출입 기록 제출');
    expect(h).not.toContain('🔒');
    expect(h).not.toContain('붉은 깃발단 · 요청서');
    expect(h).not.toContain('상단');
    expect(writeHtml(W, { ...ui, draft: { to: 'big', dg: 2, days: 30, cl: { sub: 25 } } })).toContain('수신: 미궁 출입 길드 전체');
    W.rank = 2;
    h = writeHtml(W, { ...ui, draft: { to: 'big', dg: 2, days: 30, cl: { sub: 25 } } });
    expect(h).toContain('붉은 깃발단 귀하');
    expect(h).toContain('요청서 보내기');
    const n = post(W, 2, 30, { sub: 25 })!;
    expect(paneHtml(W, ui)).toContain(`withdraw:${n.id}`);
    expect(paneHtml(W, ui)).toContain('data-act="write:2"');
    expect(writeHtml(W, ui)).toContain('고쳐 내걸기');
    expect(paneHtml(W, { ...ui, tab: 'look', sel: 'dg:2' })).toContain('공고문 · 30일 남음');
    expect(paneHtml(W, { ...ui, tab: 'rules' })).not.toContain('상단 물품 추가');
    expect(paneHtml(W, { ...ui, tab: 'look', sel: '' })).not.toContain('우선권');
    expect(paneHtml(W, { ...ui, tab: 'office' })).toContain('서기');
  });
});

describe('첫 화면과 받은 서류 창', () => {
  it('신문 한 면으로 시작하고, 업무를 시작하면 요구서가 창으로 온다. 길드 답신 · 청도 한 장씩 창으로', () => {
    expect(introHtml()).toContain('업무 시작');
    expect(introHtml()).toContain('미궁관리국 신설');
    const W = newWorld(5);
    const ui: BuUi = { tab: 'look', invite: ['big', 'small'], give: {}, intro: false, seenNews: 0, docSeen: 0, askSeen: 0 };
    let h = docModalHtml(W, ui);
    expect(h).toContain('요 구 서');
    const k = Number(/seen:(\d+)/.exec(h)![1]);
    expect(docModalHtml(W, { ...ui, docSeen: k + 1 })).toBe('');
    W.asks.push({ id: 1, day: 0, due: 5, from: 'small', kind: 'aid', want: 200, chips: [] });
    h = docModalHtml(W, { ...ui, docSeen: k + 1 });
    expect(h).toContain('answer:1');
    expect(h).toContain('later:1');
    expect(docModalHtml(W, { ...ui, docSeen: k + 1, askSeen: 1 })).toBe('');
  });
});

describe('미궁 손익 자료', () => {
  it('조당 하루 손익을 날마다 적는다: 범람 뒤 폐광은 손해, 다른 미궁은 남는다. 보조금은 빼고 적는다', () => {
    const W = newWorld(5);
    expect(W.pnl[0][0]).toBeLessThan(0);
    expect(W.pnl[1][0]).toBeGreaterThan(0);
    W.dungeons[0].sub = 30;
    step(W);
    expect(W.pnl[0].length).toBe(2);
    expect(W.pnl[0][1]).toBeLessThan(0);
    expect(writeHtml(W, { tab: 'asks', invite: [], give: {}, intro: false, seenNews: 0 })).toContain('미궁 손익 자료');
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
    for (const l of LOOPS) expect(on[l.id], l.id).toBeGreaterThan(0);
  });
});

describe('미궁관리국 게임판 (ui/bureau)', () => {
  it('판 · 탭 · 끝 화면을 날마다 그린다', () => {
    const W = newWorld(1003);
    const ui: BuUi = { tab: 'asks', invite: ['big', 'small'], give: {}, intro: false, seenNews: 0 };
    while (!over(W)) {
      BOT.smart(W); step(W);
      if (W.day % 45 === 0) {
        expect(topHtml(W)).toContain('예산');
        for (const d of W.dungeons) expect(mapHtml(W, ui)).toContain(d.name);
        for (const tab of ['look', 'asks', 'rules', 'meet', 'office'] as const) expect(paneHtml(W, { ...ui, tab }).length).toBeGreaterThan(20);
        for (const sel of ['dg:1', 'fac:big', 'fac:lord']) expect(paneHtml(W, { ...ui, tab: 'look', sel })).toContain('관할 요약');
      }
    }
    expect(endHtml(W, W, W)).toContain('임기');
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
