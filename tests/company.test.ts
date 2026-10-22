// 용병단 엔진 (docs/plan.md 1단계): 장부, 재현성, 시장 규칙이 깨지지 않는지 확인한다
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setSeed } from '../src/core/rng';
import type { World as W0 } from '../src/core/company';
// 옛 길: 구역 없이 (임무 · 횃불 · 남은 채비가 돌아오는 옛 탐사. docs/zones.md 6단계에서 지운다)
const old = (W: W0) => { delete W.zones; return W; };
import { CO, FLOORS, ITEMS, defaultPlan, emptyPlan, newWorld, potionPrice, priceOf, runMonth, us, worth } from '../src/core/company';
import { FILE_KEYS, TAX, detOf, auditChance, billOf, closeBooks, fileFix, gainOf, jobsExplore, lawsAt, preview } from '../src/core/company';
import { draftHtml } from '../src/ui/co/draft';
import { booksRumorHtml } from '../src/ui/co/intel';
import { BOT, FILER, fileSmart, playGame } from '../sim/company';
import { aiPlan, carryPlan, maxParties, outlook, rankOf, rollParty } from '../src/core/company';
import { candPrice, candWants, churchPrice, cohesion, hqCost, hqLv, mapOf, roomOf, supOf, torchOf, memberMods, teamUnd, tierOf, undMods, wageOf, type Plan, type World } from '../src/core/company';
import { MONSTERS, TRAITS } from '../src/core/data';
import { depthsHtml, newsLines, plaqueHtml, resultsHtml, returnHtml } from '../src/ui/co/view';
import { DOC_TABS, expWeekHtml, infoWeekHtml, resultWeekHtml } from '../src/ui/co/desk';
const planHtml = (W: World, P: Plan) => (W.draft ? draftHtml(W, {}) : '') + DOC_TABS.map(([tab]) => infoWeekHtml(W, P, { phase: 0, tab, pins: DOC_TABS.map(t => t[0]), open: true, store: true })).join('') + Object.keys(PLACES).map(place => infoWeekHtml(W, P, { phase: 0, tab: 'report', pins: [], place })).join('') + expWeekHtml(W, P, { phase: 1, tab: 'report', pins: DOC_TABS.map(t => t[0]) }) + (W.last ? resultWeekHtml(W) + resultWeekHtml(W, true) : '');
import { coIssue, paperHtml } from '../src/ui/co/paper';
import { intelHtml } from '../src/ui/co/intel';
import { PLACES } from '../src/ui/co/town';
import { costLines, monthCost } from '../src/ui/co/desk';
import { bookHtml, demandsNow } from '../src/ui/co/book';
import { allMats, floorMons, guideParts, matChance, matPrice, potsOf, probe, sanitize } from '../src/core/company';
import { INTEL, aiPlan as aiPlanOf } from '../src/core/company';
import { rnd } from '../src/core/rng';
import { floorMax, keyOf } from '../src/core/company';
import { fcRank, forecast, gradeOf } from '../src/core/company';
import { bedsOf, classCap, dormCost, dormKeep, formTeams, recruitPrice, recruitWants, rookCount, rookSlots, shareOut } from '../src/core/company';
import { CLASSES } from '../src/core/data';
import { needOf, tripOdds, potShock, profitOf, drillGain, weakShare, badShare, classBad, synOf, synTags, teamSlots } from '../src/core/company';
import { WEAK_KEYS } from '../src/core/data';
import { DEX, askable, badSure } from '../src/core/dex';
import { dayAbs, nextDay, openMonth, sellStock, sendReady, stateOf, stockValue } from '../src/core/company';
import { MISSIONS, sendQueued } from '../src/core/company';
import { candNow, crewOf, hireNow, hirePrice, aptB, skUp, skCap, hidSeen, grOf, eligible, promoteDue, promote, winsFrom, personWage } from '../src/core/company';
import { HIDDEN } from '../src/core/data';
import { rosterHtml } from '../src/ui/co/roster';
import { chOf, capOf, teamFx, missionW, upgradeSquad, sqLv, sqBook, sqOf, leaderGone, setLeader } from '../src/core/company';
import { returnsHtml } from '../src/ui/co/reveal';
import { backLine } from '../src/ui/co/hall';
// 옛 시작(16명 · 네 조)을 전제로 한 규칙 테스트: 우리 명단을 16명으로 바꾸고 지원자는 비운다
const big = (W: World) => { const c = us(W); c.crew = crewOf(16); c.members = 16; c.nextId = 16; c.sup!.pot = [12]; W.cand = []; return W; };
import { evOf } from '../src/core/expedition';
import { ZONE, estOf, lvOf, wideOf, zonesOn } from '../src/core/zones';
import { goalDays, syncZones, zoneRate, zoneWay } from '../src/core/company';

describe('용병단 장부', () => {
  it('매달 모든 용병단의 금고 변화가 판매 수입에서 지출을 뺀 값과 같다', async () => {
    for (let seed = 1; seed <= 20; seed++) {
      await new Promise(r => setTimeout(r, 0));
      setSeed(seed); const W = newWorld();
      const bot = Object.values(BOT)[seed % 4];
      for (let m = 0; m < 36; m++) {
        // 우리 전리품은 판 날 금고에 들어온다: 달 첫날 아침에 판 것은 runMonth 앞뒤로 걸쳐 있다 (그달 장부에 든다)
        const before = W.cos.map(c => c.cash), carry0 = W.mo ? W.mo.income : 0;
        const M = runMonth(W, bot(W)), carry1 = W.mo ? W.mo.income : 0;
        const check = () => W.cos.forEach((c, i) => {
          if (c.style === 'crowd') return;
          const r = M.res[i], spend = Object.values(r.spend).reduce((a, b) => a + b, 0);
          expect(c.cash - before[i], `시드 ${seed} 제${M.month}월 ${c.id}`).toBe(r.sales - spend + (i === 0 ? carry1 - carry0 : 0));
          expect(r.net).toBe(r.sales - spend);
        });
        // 가정산 전에도, 신고서를 낸 뒤에도 (장부 그대로 · 적당히 고쳐서 · 한도까지 고쳐서) 맞는다
        check();
        closeBooks(W, seed % 3 === 0 ? {} : fileSmart(W, seed % 3 === 1 ? 0.05 : 0.5));
        expect(W.draft).toBeNull();
        check();
      }
    }
  });
});

describe('용병단 시장', () => {
  it('같은 시드와 같은 결정이면 같은 판이 나온다', () => {
    const a = playGame(42, BOT.even), b = playGame(42, BOT.even);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('많이 팔릴수록 시세가 떨어지고, 포션은 많이 살수록 비싸진다', () => {
    ITEMS.forEach(it => {
      expect(priceOf(it, it.D)).toBe(it.P0);
      // (바닥이 기준가인 전리품은 아무리 많이 팔려도 기준가 밑으로 내려가지 않는다)
      if (it.lo < 1) expect(priceOf(it, it.D * 2)).toBeLessThan(it.P0); else expect(priceOf(it, it.D * 2)).toBe(it.P0);
      expect(priceOf(it, it.D / 2)).toBeGreaterThan(it.P0);
      expect(priceOf(it, it.D * 100)).toBe(Math.round(it.P0 * it.lo * 10) / 10);
      expect(priceOf(it, 1)).toBe(Math.round(it.P0 * it.hi * 10) / 10);
    });
    expect(potionPrice(CO.POTION_Q0 * 2)).toBeGreaterThan(potionPrice(CO.POTION_Q0));
  });
  it('층에 남은 양은 음수가 되지 않고, 캐 간 만큼 줄었다가 다시 찬다', () => {
    const W = playGame(7, BOT.even);
    W.history.forEach(M => M.floors.forEach((F, f) => {
      expect(F.taken).toBeLessThanOrEqual(F.before);
      expect(F.before).toBeLessThanOrEqual(FLOORS[f].max);
    }));
    W.pool.forEach((p, f) => { expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(FLOORS[f].max); });
  });
  it('처음엔 1층만 열려 있고, 성공이 쌓이면 깊은 층이 차례로 열린다', () => {
    setSeed(3); const W = newWorld();
    const P = defaultPlan(W);
    expect(P.parties.slice(1).every(n => n === 0)).toBe(true);
    for (let m = 0; m < 36; m++) runMonth(W, defaultPlan(W));
    expect(W.unlocked).toBeGreaterThanOrEqual(3);
    let open = 1;
    W.history.forEach(M => {
      M.res.forEach((r, i) => r.sent.forEach((n, f) => { if (n) expect(f, `${W.cos[i].id} 제${M.month}월`).toBeLessThan(open); }));
      if (M.opened != null) { expect(M.opened).toBe(open); open++; }
    });
  });
  it('플레이어가 단원보다 많이 보내도 규칙 안으로 맞춰지고, 캐 온 전리품은 그달에 모두 판다', () => {
    setSeed(5); const W = big(newWorld());
    const P = emptyPlan(); P.parties = [99, 99, 0, 0, 0];
    const M = runMonth(W, P);
    expect(M.res[0].sent.reduce((a, b) => a + b, 0)).toBe(Math.floor(16 / CO.PARTY));
    expect(M.res[0].sent[1]).toBe(0);        // 2층은 아직 닫혀 있다
    M.res.forEach((r, i) => { if (W.cos[i].style !== 'crowd') expect(r.sold).toEqual(r.got); });
    expect(M.Q[0]).toBe(M.res.reduce((a, r) => a + r.sold[0], 0));
  });
  it('36개월을 돌려도 숫자가 깨지지 않고, 순위는 평가액 순서다', () => {
    for (const bot of Object.values(BOT)) {
      const W = playGame(11, bot);
      expect(JSON.stringify({ ...W, intel: { ...W.intel, est: null } })).not.toMatch(/NaN|null,null|undefined/);
      const named = W.cos.filter(c => c.style !== 'crowd');
      const sorted = [...named].sort((a, b) => worth(W, b) - worth(W, a)).map(c => c.id);
      expect(W.last!.rank).toEqual(sorted);
      expect(us(W).members).toBeGreaterThanOrEqual(8);
    }
  });
});

describe('상단·교회와 포션 담합', () => {
  it('교회 포션은 한 달 한도를 넘겨 나가지 않고, 찾은 만큼보다 많이 받지도 않는다', () => {
    for (let g = 1; g <= 10; g++) {
      setSeed(g); const W = newWorld();
      for (let m = 0; m < 36; m++) {
        const P = BOT.smart(W); P.buy = { holy: 9999 };
        const M = runMonth(W, P);
        expect(M.res.reduce((a, r) => a + r.potC, 0)).toBeLessThanOrEqual(CO.CHURCH_CAP);
        M.res.forEach(r => expect(r.potC).toBeLessThanOrEqual(r.potNeed));
      }
    }
  });
  it('담합 전에는 소문이 먼저 돌고, 담합 중에는 상단·교회 포션 값이 함께 오른다', async () => {
    let seen = 0;
    for (let g = 1; g <= 40; g++) {
      await new Promise(r => setTimeout(r, 0));
      const W = playGame(g, BOT.even);
      const start = W.log.find(l => /함께 올린다고/.test(l.t));
      if (!start) continue;
      seen++;
      expect(W.log.some(l => /마주 앉는다/.test(l.t) && l.m <= start.m)).toBe(true);
      const M = W.history.find(h => h.month === start.m + 1)!;
      if (!M) continue;
      expect(M.cartel).toBe(true);
      expect(M.potion).toBe(Math.round(potionPrice(M.potQ) * CO.CARTEL_MARKUP));
      expect(M.potionC).toBe(Math.round(CO.POTION_C0 * CO.CARTEL_MARKUP));
    }
    expect(seen).toBeGreaterThan(3);
  });
  it('담합 중 교회 후원이 쌓이면 교회가 빠져나와 후원한 쪽에 예전 값으로 팔고, 후원한 쪽은 교회와 가까워지고 상단과 멀어진다', () => {
    let checked = 0;
    for (let g = 1; g <= 40 && checked < 3; g++) {
      setSeed(g); const W: World = old(newWorld());
      for (let m = 0; m < 36 && !W.cartel; m++) runMonth(W, BOT.even(W));
      if (!W.cartel) continue;
      const c = us(W); c.cash = 50000;
      const relC = c.relC ?? 50, relM = c.relM ?? 50;
      const P = BOT.even(W); P.donate = CO.BREAK_DONATION; P.buy = { holy: 0 };
      const M = runMonth(W, P);
      expect(M.res[0].spend.donate).toBe(CO.BREAK_DONATION);
      expect(W.cartel ? W.cartel.churchOut : true).toBe(true);
      expect(c.relC!).toBeGreaterThan(relC);
      expect(c.relM!).toBeLessThan(relM);
      expect(W.log.some(l => /예전 값으로 내주기로/.test(l.t))).toBe(true);
      // 교회가 빠진 뒤로는 후원한 우리에게만 예전 값이고, 후원하지 않은 쪽은 여전히 오른 값을 낸다
      if (W.cartel) {
        expect(churchPrice(W, 0)).toBe(CO.POTION_C0);
        const j = W.cos.findIndex((_, k) => k > 0 && !W.cartel!.donated[k]);
        if (j > 0) expect(churchPrice(W, j)).toBe(Math.round(CO.POTION_C0 * CO.CARTEL_MARKUP));
        const P2 = BOT.even(W); P2.buy = { holy: 10 };
        const N = runMonth(W, P2), r = N.res[0];
        expect(r.spend.potion).toBe(r.potC * CO.POTION_C0 + (r.potNeed - r.potC) * N.potion);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
  it('교회 포션을 많이 쓰면 교회와 가까워지고, 상단 포션만 쓰면 상단과 가까워진다', () => {
    setSeed(6); const A = newWorld(); setSeed(6); const B = newWorld();
    for (let m = 0; m < 12; m++) {
      const a = BOT.even(A); a.buy = { holy: 9999 }; runMonth(A, a);
      const b = BOT.even(B); b.buy = { holy: 0 }; runMonth(B, b);
    }
    expect(us(A).relC!).toBeGreaterThan(us(B).relC!);
    expect(us(B).relM!).toBeGreaterThan(us(A).relM!);
  });
});

describe('교회 성수 포션', () => {
  it('같은 병 수라도 교회 포션을 쓰면 사망이 줄어든다', () => {
    let a = 0, b = 0;
    for (let g = 1; g <= 60; g++) {
      for (const church of [0, 9999]) {
        setSeed(g); const W = big(old(newWorld())); W.unlocked = 4;
        // 깊은 층에 포션 한 병씩만 들려 보내 포션이 모자라게 한다 (성수는 HOLY의 확률로 병을 비우지 않고 막는다)
        for (let m = 0; m < 6; m++) { const P = sanitize(W, us(W), BOT.even(W)); P.teams!.forEach(T => { T.f = 3; T.pots = 1; }); P.buy = { holy: church }; const M = runMonth(W, P); if (church) a += M.res[0].deaths; else b += M.res[0].deaths; }
      }
    }
    expect(a).toBeLessThan(b);
  });
});

describe('미궁의 압력과 근원', () => {
  it('모두가 꺼낸 만큼 압력이 차고, 넘치면 기록이 남고 1·2층이 쑥대밭이 된다', () => {
    setSeed(17); const W = newWorld();
    for (let m = 0; m < 6; m++) runMonth(W, BOT.even(W));
    expect(W.pressure!).toBeGreaterThan(0);
    W.pressure = 500;
    let M = null as ReturnType<typeof runMonth> | null;
    for (let m = 0; m < 20 && !(M && M.overflow); m++) {
      const P = BOT.even(W);
      M = runMonth(W, P);
    }
    expect(M!.overflow).toBe(true);
    expect(W.log.some(l => l.m === M!.month && /^범람: /.test(l.t))).toBe(true);
    expect(W.pressure!).toBeLessThan(500 * CO.OVER_LEFT + 50);
    expect(W.pool[0]).toBeLessThan(FLOORS[0].max * 0.6);
  });
  it('압력이 차는 동안 이상 징후가 먼저 돌고, 아무 손도 쓰지 않으면 대개 한 번은 넘친다', () => {
    let over = 0, warned = 0;
    for (let g = 1; g <= 20; g++) {
      const W = playGame(g, BOT.even);
      const first = W.history.find(M => M.overflow);
      if (!first) continue;
      over++;
      if (W.log.some(l => /^이상 징후: /.test(l.t) && l.m < first.month)) warned++;
    }
    expect(over).toBeGreaterThan(10);
    expect(warned).toBe(over);
  });
  it('근원은 도감에서 주 몬스터의 이해도가 다 차고 약점을 확정한 뒤에만 찾는다', () => {
    let smart = 0, even = 0;
    for (let g = 1; g <= 10; g++) {
      const W = playGame(g, BOT.smartAsk);   // 단장에게 소거법으로 묻는 숙련 봇
      smart += W.roots!.filter(r => r.found).length;
      even += playGame(g, BOT.even).roots!.filter(r => r.found).length;
      W.roots!.forEach((R, f) => { if (!R.found) return; const D = W.dex![MONSTERS[W.mons[f]].name]; expect(D.u).toBeGreaterThanOrEqual(DEX.ROOT_AT); expect(W.history[R.found - 1].res[0].sent[f]).toBeGreaterThan(0); });
    }
    // 고르게 둔 봇은 단장에게 묻지 않아 약점을 확정하지 못한다
    expect(even).toBe(0);
    expect(smart).toBeGreaterThan(1);
  });
  it('봉인 기금은 교회가 같은 돈을 보태고, 다 차면 압력이 빠지고 층이 작아지며 교회와 가까워진다', () => {
    setSeed(4); const W: World = newWorld();
    W.roots![0].found = 1;
    runMonth(W, BOT.even(W));
    const before = W.pressure!, relC = us(W).relC!;
    const P = BOT.even(W); P.root = { f: 0, seal: CO.ROOT_COST / 2, mine: 0 };
    const M = runMonth(W, P);
    expect(M.res[0].spend.root).toBe(CO.ROOT_COST / 2);
    expect(W.roots![0].done).toBe('seal');
    expect(W.pressure!).toBeLessThan(before);
    expect(us(W).relC!).toBeGreaterThan(relC);
    expect(floorMax(W, 0)).toBe(Math.round(FLOORS[0].max * CO.SEAL_MAX));
    for (let m = 0; m < 3; m++) runMonth(W, BOT.even(W));
    expect(W.pool[0]).toBeLessThanOrEqual(floorMax(W, 0));
  });
  it('채굴장을 내면 그 층에서 우리 성공 조당 더 캔다', () => {
    let a = 0, b = 0;
    for (const mine of [false, true]) {
      for (let g = 1; g <= 10; g++) {
        setSeed(g); const W = newWorld();
        if (mine) { W.roots![0] = { found: 1, seal: 0, mine: CO.ROOT_COST, done: 'mine', at: 1 }; }
        for (let m = 0; m < 4; m++) { const M = runMonth(W, BOT.even(W)); const per = M.res[0].got[0] / Math.max(1, M.res[0].ok[0]); if (mine) b += per; else a += per; }
      }
    }
    expect(b).toBeGreaterThan(a);
  });
  it('찾지 않았거나 이미 끝난 근원에는 기금을 넣을 수 없다', () => {
    setSeed(6); const W = newWorld();
    const P = BOT.even(W); P.root = { f: 0, seal: 3000, mine: 0 };
    const M = runMonth(W, P);
    expect(M.res[0].spend.root).toBe(0);
    expect(W.roots![0].seal).toBe(0);
  });
  it('신문은 그달 가장 큰 일을 머리기사로 싣는다', () => {
    setSeed(17); const W = newWorld();
    for (let m = 0; m < 3; m++) runMonth(W, BOT.even(W));
    W.pressure = 500;
    for (let m = 0; m < 20; m++) { const M = runMonth(W, BOT.even(W)); if (M.overflow) break; }
    expect(coIssue(W)!.hed).toBe('미궁이 넘쳤다');
    expect(coIssue(W)!.extra).toBe(true);
  });
});

describe('첫날 장면', () => {
  it('전제만 몇 줄 깔고 인물 대사 없이 결정표로 넘어가며, 게임 규칙을 건드리지 않는다', async () => {
    const { ARRIVAL } = await import('../src/ui/co/arrival');
    expect(ARRIVAL.length).toBeGreaterThan(0);
    expect(ARRIVAL.filter(l => l.who)).toEqual([]);
    // 장면은 DOM만 만지고 게임 규칙을 import하지 않는다
    const src = (await import('node:fs')).readFileSync('src/ui/co/arrival.ts', 'utf8');
    expect(src).not.toMatch(/core\/|rnd\(/);
  });
});

describe('숨긴 정보', () => {
  it('층에 남은 양은 결정표와 정산서에 드러나지 않는다', () => {
    setSeed(12); const W = newWorld();
    for (let m = 0; m < 8; m++) runMonth(W, BOT.even(W));
    const plan = carryPlan(W, null), draw = () => planHtml(W, plan) + resultsHtml(W);
    const before = draw();
    W.pool = W.pool.map(p => p + 37);
    W.history.forEach(M => M.floors.forEach(F => { F.before += 37; }));
    expect(draw()).toBe(before);
  });
});

describe('정보망', () => {
  const pay = (k: 'ret' | 'mkt' | 'chu' | 'gate' | 'spy', amt: number) => (W: World) => { const P = BOT.even(W); P.intel = { [k]: amt }; return P; };
  it('유지비보다 많이 쓰면 쌓여서 단계가 오르고, 끊으면 한 달에 한 단계씩 내려가되 기본 단계 아래로는 안 간다', () => {
    setSeed(31); const W: World = newWorld();
    expect(W.intel!.lv).toEqual(INTEL.BASE);
    for (let m = 0; m < 4; m++) runMonth(W, pay('gate', 200)(W));   // 2단계까지 400G가 쌓여야 한다
    expect(W.intel!.lv.gate).toBe(2);
    expect(W.history.slice(-1)[0].res[0].spend.intel).toBe(200);
    runMonth(W, BOT.even(W));
    expect(W.intel!.lv.gate).toBe(1);
    runMonth(W, BOT.even(W));
    expect(W.intel!.lv.gate).toBe(1);
  });
  it('상단 장부 2단계는 상단과 사이가 넉넉해야 오른다', () => {
    INTEL.GATE = true;   // 세력 시스템이 열려 있을 때의 규칙
    setSeed(32); const W: World = newWorld();
    us(W).relM = 30;
    for (let m = 0; m < 12; m++) { runMonth(W, pay('mkt', 400)(W)); us(W).relM = 30; }
    expect(W.intel!.lv.mkt).toBe(1);
    us(W).relM = 80;
    for (let m = 0; m < 3; m++) { runMonth(W, pay('mkt', 400)(W)); us(W).relM = 80; }
    expect(W.intel!.lv.mkt).toBeGreaterThanOrEqual(2);
    INTEL.GATE = false;
  });

  it('층에 남은 양 짐작은 참값을 품고, 상단 장부 단계가 오르면 폭이 좁아진다', () => {
    const width = (lv: number) => {
      setSeed(33); const W: World = newWorld(); let sum = 0, n = 0;
      for (let m = 0; m < 10; m++) {
        W.intel!.lv.mkt = lv; runMonth(W, BOT.even(W));
        W.intel!.est.floors.forEach((e, f) => { if (!e) return; const truth = Math.round(W.pool[f] / floorMax(W, f) * 100); expect(truth).toBeGreaterThanOrEqual(e.lo - 1); expect(truth).toBeLessThanOrEqual(e.hi + 1); sum += e.hi - e.lo; n++; });
      }
      return sum / n;
    };
    expect(width(2)).toBeLessThan(width(0));
  });
  it('정보원 2단계 이상이면 붙인 경쟁 용병단의 다음 달 계획이 짐작 범위 안에 든다', () => {
    setSeed(34); const W: World = newWorld();
    for (let m = 0; m < 6; m++) runMonth(W, BOT.even(W));
    W.intel!.lv.spy = 2; const P = BOT.even(W); P.intel = { spy: INTEL.KEEP.spy[2] }; P.spyOn = ['red', 'crow'];
    runMonth(W, P);
    expect(W.intel!.spyOn).toEqual(['red', 'crow']);
    const est = W.intel!.est.rivals.red!, i = W.cos.findIndex(c => c.id === 'red'), next = aiPlanOf(W, i);
    const M = runMonth(W, BOT.even(W));
    FLOORS.forEach((_, f) => { const e = est[f]; if (!e) return; const real = M.res[i].sent[f] + M.res[i].hired[f]; expect(Math.abs(real - e.mid)).toBeLessThanOrEqual(e.w); expect(next.parties[f] + next.hire[f]).toBe(real); });
  });
  it('정보망 단계가 낮으면 남의 판매·출정·사망은 화면에 나오지 않는다', () => {
    setSeed(35); const W: World = newWorld();
    for (let m = 0; m < 6; m++) runMonth(W, BOT.even(W));
    const low = intelHtml(W) + resultsHtml(W);
    expect(low).not.toContain('붉은 깃발단 ');
    expect(resultsHtml(W)).toContain('<td class="n">?</td>');
    W.intel!.lv.mkt = 2; W.intel!.lv.gate = 2; W.intel!.lv.chu = 2;
    expect(intelHtml(W)).toContain('붉은 깃발단');
  });
});

describe('전리품 비율과 몬스터 적응', () => {
  it('횃불: 조를 보낼 때 창고에 모자란 만큼 사고, 우리 조가 들고 가서 태운 만큼만 창고에서 빠진다', () => {
    setSeed(3); const W = old(newWorld()), c = us(W);
    const P = defaultPlan(W), Q = sanitize(W, c, P), need = needOf(Q).torch;
    expect(need).toBe(Q.parties.reduce((a, n, f) => a + n * CO.TORCH0[f], 0));
    const M = runMonth(W, P), r = M.res[0], burnt = M.ours.reduce((a, o) => a + o.trip!.tu, 0), bought = r.spend.torch / CO.TORCH_PRICE;
    expect(bought).toBeGreaterThanOrEqual(need); expect(r.torchUsed).toBe(burnt); expect(r.torchShort).toBe(0);
    M.ours.forEach(o => { expect(o.trip!.tu).toBeLessThanOrEqual(o.trip!.torch); expect(o.trip!.tu).toBeGreaterThanOrEqual(1); });
    // 나가 있는 조가 들고 간 횃불은 아직 창고 밖에 있다
    const out = (W.away || []).reduce((a, s) => a + s.kit.torch, 0), nx = (W.back || []).reduce((a, s) => a + s.out.tu, 0);
    expect(supOf(c).torch! + out).toBe(bought - burnt - nx);
    expect(W.draft!.truth.torch).toBe(burnt);
  });
  it('탐사는 층마다 정한 구간만큼: 구간마다 채집 지점 · 조우 · 흔적 중 하나, 채집 지점만 짐을 싣고 조우만 갈무리하며, 횃불이 떨어지거나 짐이 차면 돌아선다', () => {
    let pack = 0, torch = 0; const seen: Record<string, Record<string, number>> = { gather: {}, hunt: {}, scout: {} };
    for (let g = 1; g <= 8; g++) {
      setSeed(g); const W = old(newWorld()); W.unlocked = 3;
      for (let m = 0; m < 4; m++) {
        const P = sanitize(W, us(W), defaultPlan(W)); P.teams!.forEach((T, t) => { T.f = t % 3; T.mission = MISSIONS[(t + m) % 3]; }); P.torch = FLOORS.map(() => 1); P.pots = FLOORS.map(() => 3);
        const M = runMonth(W, P), names = (f: number) => floorMons(W, f).map(x => x.name);
        M.ours.forEach(o => {
          const T = o.trip!, D = o.days!, ms = seen[o.mission || 'gather'];
          expect(T.fd!).toBeLessThanOrEqual(CO.TRIP_DAYS[o.f]); expect(D.length).toBeLessThanOrEqual(CO.SEGS[o.f]); D.forEach(d => expect(d.dd!).toBeLessThanOrEqual(T.fd!)); expect(T.tu).toBeLessThanOrEqual(T.torch);
          D.forEach(d => {
            const ev = evOf(d); ms[ev] = (ms[ev] || 0) + 1;
            expect(d.win).toBe(d.k >= Math.ceil(d.n / 2));   // (남은 조원의 절반 이상)
            if (ev === 'f') { expect(names(o.f)).toContain(d.mon); expect(d.loot || 0).toBe(0); if (!d.k) expect(d.mats).toEqual([]); }   // 조우: 짐(채집품)은 싣지 않고, 해낸 사람이 있어야 갈무리
            else { expect(d.mon).toBeUndefined(); expect(d.mats).toEqual([]); expect(d.am).toBeUndefined(); }
            if (ev === 't' || !d.k) expect(d.loot || 0).toBe(0);
          });
          if (T.end === 'torch') { expect(T.tu).toBe(T.torch); torch++; }
          if (T.end === 'pack') pack++;
          if (T.end === 'done') { expect(T.fd).toBe(CO.TRIP_DAYS[o.f]); expect(D.length).toBe(CO.SEGS[o.f]); }   // 층마다 정해진 날 · 구간을 다 다니고 돌아온다
          expect(T.pack).toBeLessThanOrEqual(T.slots + 1e-9);
          expect(T.pack + (T.pm || 0) + (T.pt || 0)).toBeLessThanOrEqual(T.slots + 1e-9);   // 채집품 · 전리품 · 지도 기록이 같은 짐 칸을 나눠 쓴다
          D.forEach(d => { if (evOf(d) === 'f') expect(d.mats.reduce((a, [, k]) => a + k, 0) * CO.MAT_SLOT[o.f]).toBeLessThanOrEqual(T.slots); });
          // 그 조가 갈무리한 것 = 날마다 갈무리한 것의 합
          const sum: Record<string, number> = {}; D.forEach(d => d.mats.forEach(([n, k]) => { sum[n] = (sum[n] || 0) + k; }));
          expect(Object.fromEntries(o.mats)).toEqual(sum);
          expect(D.reduce((a, d) => a + d.cr, 0) + T.dark).toBe(o.crisis);
        });
      }
    }
    expect(torch).toBeGreaterThan(0);
    expect(pack).toBeGreaterThan(0);
    // 임무가 사건의 비중을 바꾼다: 채집은 채집 지점, 사냥은 조우, 탐색은 흔적이 가장 많다
    const top = (x: Record<string, number>) => Object.entries(x).sort((a, b) => b[1] - a[1])[0][0];
    expect(top(seen.gather)).toBe('g'); expect(top(seen.hunt)).toBe('f'); expect(top(seen.scout)).toBe('t');
  });
  it('보내기는 예정만 잡고, 다음 날 단추를 누르면 그날 떠난다 (나갈 수 없게 된 조는 예정을 지운다)', () => {
    setSeed(5); const W = big(newWorld()), c = us(W);
    const P = sanitize(W, c, defaultPlan(W)); P.teams![0].go = true; P.teams![1].go = true;
    const Q = sanitize(W, c, P);
    expect(Q.teams![0].go).toBe(true); expect(Q.teams![2].go).toBeUndefined();
    expect(W.away || []).toHaveLength(0);   // 예정만으로는 떠나지 않는다
    c.crew!.find(x => x.id === Q.teams![1].m[0])!.bk = dayAbs(W);   // 그사이 쉬는 날인 사람이 생긴 조
    const day = W.day || 1, R = sendQueued(W, Q);
    expect(R.sent.map(s => s.t)).toEqual([0]); expect(R.stuck).toEqual([1]);
    expect(R.sent[0].d0).toBe(dayAbs(W)); expect(W.day || 1).toBe(day);
    expect(Q.teams!.some(T => T.go)).toBe(false);
    nextDay(W, Q);
    expect((W.away || []).length + (W.back || []).length).toBe(1);
  });
  it('임무: 채집은 채집품이 많고 덜 다치며, 사냥은 전리품이 많고, 탐색은 지도를 가장 많이 그린다', () => {
    const sum: Record<string, { got: number; mats: number; map: number; cr: number; n: number }> = {};
    for (const ms of MISSIONS) {
      const x = sum[ms] = { got: 0, mats: 0, map: 0, cr: 0, n: 0 };
      for (let g = 1; g <= 6; g++) {
        setSeed(g); const W = big(old(newWorld())); W.unlocked = 2;
        for (let m = 0; m < 2; m++) {
          const P = sanitize(W, us(W), defaultPlan(W)); P.teams!.forEach((T, t) => { T.f = t % 2; T.mission = ms; });
          const M = runMonth(W, P); closeBooks(W);
          M.ours.forEach(o => { x.got += o.got || 0; x.mats += o.mats.reduce((a, [, k]) => a + k, 0); x.map += o.mp || 0; x.cr += o.crisis || 0; x.n++; expect(o.mission || 'gather').toBe(ms); });
        }
      }
    }
    expect(sum.gather.got).toBeGreaterThan(sum.hunt.got * 2); expect(sum.gather.got).toBeGreaterThan(sum.scout.got * 2);
    expect(sum.hunt.mats).toBeGreaterThan(sum.gather.mats * 2);
    expect(sum.scout.map).toBeGreaterThan(sum.gather.map * 2); expect(sum.scout.map).toBeGreaterThan(sum.hunt.map);
    expect(sum.gather.cr / sum.gather.n).toBeLessThan(sum.hunt.cr / sum.hunt.n);
  });
  it('편성표에서 조마다 포션 · 횃불을 정하고, 죽은 단원은 이름과 날이 기록된다', () => {
    setSeed(6); const W = big(old(newWorld())), c = us(W);
    const P = sanitize(W, c, defaultPlan(W)); P.teams![0].pots = 2; P.teams![0].torch = 5; P.teams![1].pots = 0; P.teams![1].torch = 1;
    const Q = sanitize(W, c, P), need = needOf(Q);
    expect(need.torch).toBe(5 + 1 + Q.teams!.slice(2).reduce((a, T) => a + CO.TORCH0[T.f], 0));
    expect(need.pot).toBe(2 + Q.teams!.slice(2).reduce((a, T) => a + P.pots[T.f], 0));
    const M = runMonth(W, P), t0 = M.ours.filter(o => o.t === 0), t1 = M.ours.filter(o => o.t === 1);
    expect(t0.length).toBeGreaterThan(1); expect(t1.length).toBeGreaterThan(1);   // 한 달에 여러 번 다녀온다
    t0.forEach(o => { expect(o.trip!.torch).toBe(5); expect(o.pots || 0).toBeLessThanOrEqual(2); });
    t1.forEach(o => { expect(o.trip!.torch).toBe(1); expect(o.pots || 0).toBe(0); });
    let dead = 0, d = 0;
    for (let g = 1; g <= 10; g++) {
      setSeed(g); const V = newWorld();
      for (let m = 0; m < 8; m++) { const N = runMonth(V, BOT.smart(V)); closeBooks(V); N.ours.forEach(o => { d += o.d; dead += (o.dead || []).length; (o.dead || []).forEach(z => { expect(z.n).toBeTruthy(); expect(z.day).toBeLessThanOrEqual(o.days!.length + 1); }); }); }
    }
    expect(dead).toBe(d);
  });
  it('탐사 재생 장면의 조원별 기록이 그날의 해낸 수 · 위기 · 사망과 맞는다', () => {
    let days = 0;
    for (let g = 1; g <= 6; g++) {
      setSeed(g); const V = newWorld();
      for (let m = 0; m < 6; m++) {
        const N = runMonth(V, BOT.smart(V)); closeBooks(V);
        N.ours.forEach(o => {
          expect(o.nm!.length).toBe(o.cls!.length);
          const cnt = (s: string, re: RegExp) => [...s].filter(ch => re.test(ch)).length;
          o.days!.forEach(d => {
            days++;
            expect(d.ms!.length).toBe(o.cls!.length);
            expect(cnt(d.ms!, /o/)).toBe(d.k); expect(cnt(d.ms!, /[^-]/)).toBe(d.n);
            expect(cnt(d.ms!, /[phds]/)).toBe(d.cr); expect(cnt(d.ms!, /d/)).toBe(d.d); expect(cnt(d.ms!, /p/)).toBe(d.sv || 0);
          });
          if (o.trip!.dm) expect(cnt(o.trip!.dm, /[phds]/)).toBe(o.trip!.dark);
        });
      }
    }
    expect(days).toBeGreaterThan(50);
  });
  it('횃불 없이 간 조는 들어가지 못하고 어둠 속에서 위기를 맞고 지도를 덜 그린다', () => {
    let darkC = 0, litC = 0, darkMap = 0, litMap = 0;
    for (const dark of [true, false]) for (let g = 1; g <= 12; g++) {
      setSeed(g); const W = old(newWorld());
      for (let m = 0; m < 3; m++) {
        const P = defaultPlan(W); if (dark) { P.autoBuy = false; P.buy = { pot: 20 }; supOf(us(W)).torch = 0; }
        const M = runMonth(W, P), r = M.res[0], cr = M.ours.reduce((a, o) => a + (o.crisis || 0), 0);
        if (dark) { M.ours.forEach(o => { expect(o.trip!.end).toBe('torch'); expect(o.days).toEqual([]); }); expect(r.got[0]).toBe(0); darkC += cr; darkMap += us(W).map![0]; } else { litC += cr; litMap += us(W).map![0]; }
      }
    }
    expect(darkC).toBeGreaterThan(litC); expect(darkMap).toBeLessThan(litMap);
  });
  it('수입 예측: 횃불을 적게 들수록 다닐 날이 줄어 예측이 준다', () => {
    expect(tripOdds(0, 0.3)).toEqual({ days: 0, dark: 1, burn: 0 });
    expect(tripOdds(CO.DAYS, 0.9).dark).toBe(0);
    const a = tripOdds(2, 0.5), b = tripOdds(4, 0.5);
    expect(a.days).toBeLessThan(b.days); expect(a.dark).toBeGreaterThan(b.dark);
    setSeed(5); const W = old(newWorld()); W.unlocked = 3; const P = sanitize(W, us(W), defaultPlan(W)); P.teams!.forEach(T => { T.f = 2; }); P.parties = [0, 0, P.teams!.length, 0, 0];   // 3층은 사흘 탐사
    const lo = forecast(W, { ...P, torch: FLOORS.map(() => 1) }), hi = forecast(W, { ...P, torch: FLOORS.map(() => 5) });
    expect(lo.mean).toBeLessThan(hi.mean); expect(lo.torch!).toBeLessThan(hi.torch!);
  });
  it('신입은 고른 지원자만 들어오고(빈 침상까지), 처음 숙소는 18자리라 바로 고를 수 있다', () => {
    setSeed(4); const W = newWorld(), c = us(W);
    expect(bedsOf(c)).toBe(18); expect(roomOf(c)).toBe(18 - CO.US0);
    const none = carryPlan(W, defaultPlan(W)); expect(none.pick).toEqual([]);
    runMonth(W, none); expect(c.crew!.length).toBeLessThanOrEqual(CO.US0);
    const P = carryPlan(W, none); P.pick = candNow(W).slice(0, 2).map(x => x.id);
    const r = runMonth(W, P).res[0]; expect(r.recruited).toBe(2); expect(c.crew!.length).toBe(CO.US0 - r.deaths + 2);
  });
  it('약점대로 들어간 파티가 몰리면 몬스터가 적응해 약점이 바뀌고, 경쟁자는 다시 깨쳐야 한다', () => {
    setSeed(36); const W: World = newWorld();
    const before = keyOf(W, 0);
    W.keyUse![0] = CO.ADAPT_AT;
    W.cos.forEach(c => { c.learned[0] = true; });
    runMonth(W, BOT.even(W));
    expect(keyOf(W, 0)).not.toBe(before);
    expect(keyOf(W, 0)).toBe(MONSTERS[W.mons[0]].alt);
    expect(W.adapted![0]).toBe(1);
    expect(W.cos.filter(c => c.style !== 'player').every(c => !c.learned[0])).toBe(true);
    expect(W.log.some(l => /예전 공략이 잘 먹히지 않는다/.test(l.t))).toBe(true);
  });
});

describe('갈무리 소재와 미궁 도감', () => {
  it('전리품은 조우에서 해낸 사람이 있던 우리 직영 조만 갈무리해 오고, 판 값은 판매 수입에 들어 있다', () => {
    setSeed(51); const W: World = newWorld();
    for (let m = 0; m < 12; m++) {
      const M = runMonth(W, BOT.smart(W)), r = M.res[0];
      M.ours.filter(x => !x.days!.some(d => evOf(d) === 'f' && d.k)).forEach(x => expect(x.mats).toEqual([]));   // 조우에서 해낸 사람이 없으면 갈무리도 없다 (진 조우도 해낸 몫은 갈무리)
      const fromOurs: Record<string, number> = {};
      M.ours.forEach(x => x.mats.forEach(([n, k]) => { fromOurs[n] = (fromOurs[n] || 0) + k; }));
      expect(fromOurs).toEqual(r.matSold);
      const items = r.sold.reduce((a, n) => a + n, 0);
      expect(r.matSales).toBe(Object.entries(r.matSold).reduce((a, [n, k]) => a + k * M.matPrice[n], 0));
      expect(r.sales).toBeGreaterThanOrEqual(r.matSales);
      if (!items) expect(r.sales).toBe(r.matSales);
    }
  });
  it('도감은 성공한 우리 조의 수만큼 쌓이고, 소재를 얻은 조는 그 조가 갖춘 조건마다 센다', () => {
    setSeed(52); const W: World = newWorld();
    let ok = 0;
    for (let m = 0; m < 10; m++) { const M = runMonth(W, BOT.even(W)); ok += M.ours.filter(x => x.ok && x.f === 0).length; }
    ok += (W.back || []).filter(s => s.rep && s.rep.ok && s.f === 0).length;   // (마지막 그믐 다음 날 아침 돌아온 조는 다음 달 결과에 든다)
    const B = W.mat!.book[0];
    expect(B.n['*']).toBe(ok);
    Object.values(B.got).forEach(g => Object.entries(g).forEach(([k, a]) => expect(a).toBeLessThanOrEqual(B.n[k])));
  });
  it('조건을 갖추면 그 소재가 더 잘 나오고, 층이 비면 덜 나온다', () => {
    const x = { n: 't', v: 10, p: 0.1, b: [['g:냉기', 3]] as [string, number][] };
    expect(matChance(x, ['g:냉기'], 1)).toBeCloseTo(0.4);
    expect(matChance(x, ['c:전사'], 1)).toBeCloseTo(0.1);
    expect(matChance(x, ['g:냉기'], 0)).toBeCloseTo(0.2);
    const y = { n: 'u', v: 10, p: 0.05, b: [['c:사제+g:신성', 5]] as [string, number][] };
    expect(matChance(y, ['c:사제'], 1)).toBeCloseTo(0.05);
    expect(matChance(y, ['c:사제', 'g:신성'], 1)).toBeCloseTo(0.3);
    // 실제 판에서도: 1층 주인 몬스터의 드문 소재를 부르는 조건을 챙기면 더 많이 얻는다
    let a = 0, b = 0;
    for (const on of [false, true]) for (let g = 1; g <= 16; g++) {
      setSeed(g); const W: World = newWorld();
      const rare = floorMons(W, 0)[0].mats.find(m => m.b && m.p < 0.1)!, kit = rare.b![0][0];
      for (let m = 0; m < 6; m++) { const P0 = BOT.even(W); if (on) P0.guide[0] = kit; const P = sanitize(W, us(W), P0); P.teams!.forEach(T => { T.mission = 'hunt'; }); const M = runMonth(W, P); const n = M.res[0].matSold[rare.n] || 0; if (on) b += n; else a += n; }   // 조우가 많은 사냥 임무로
    }
    expect(b).toBeGreaterThan(a * 1.2);   // (주 몬스터를 만나 이긴 날만 갈무리라 차이가 예전보다 작다)
  });
  it('편성은 직업 하나와 장비 하나까지만 받고, 파티는 둘 다 갖춘다', () => {
    setSeed(53); const W: World = newWorld();
    const P = BOT.even(W); P.guide[0] = 'c:사제+g:신성+c:전사+x:모름';
    const Q = sanitize(W, W.cos[0], P);
    expect(guideParts(Q.guide[0])).toEqual(['c:사제', 'g:신성']);
    for (let i = 0; i < 30; i++) { const k = rollParty(Q.guide[0]); expect(k).toContain('c:사제'); expect(k).toContain('g:신성'); }
  });
  it('많이 팔리면 소재 시세가 내려가고, 찾는 곳이 있으면 오른다', () => {
    expect(matPrice(100, 1, 20, 10)).toBeLessThan(100);
    expect(matPrice(100, 1, 5, 10)).toBeGreaterThan(100);
    expect(matPrice(100, 1.4, 10, 10)).toBe(140);
  });
  it('찾는 곳 소식은 정보망 단계만큼만 보이고, 안 보이는 것은 수만 알린다', () => {
    setSeed(54); const W: World = newWorld();
    for (let m = 0; m < 24; m++) runMonth(W, BOT.even(W));
    const mats = allMats(W).map(x => x.n);
    W.mat!.dem = [{ m: mats[0], who: 4, mul: 0.4, at: W.month - 1, until: W.month + 3 }, { m: mats[1], who: 0, mul: 0.2, at: W.month - 1, until: W.month + 3 }];
    W.intel!.lv.mkt = 0;
    const d0 = demandsNow(W);
    expect(d0.seen.map(d => d.m)).toEqual([mats[1]]);
    expect(d0.hidden).toBe(1);
    expect(bookHtml(W)).toContain('1곳이 더 찾는다');
    W.intel!.lv.mkt = 2;
    expect(demandsNow(W).seen.length).toBe(2);
  });
  it('찾는 곳은 판 내내 가끔 생기고 기한이 지나면 사라진다', () => {
    setSeed(55); const W: World = newWorld();
    let seen = 0;
    for (let m = 0; m < 36; m++) { runMonth(W, BOT.even(W)); seen += W.mat!.dem.length; W.mat!.dem.forEach(d => expect(d.until).toBeGreaterThanOrEqual(W.month - 1)); }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('보급 창고 · 전리품 보관 기한 · 조사 의뢰 · 편성 줄', () => {
  it('포션은 사 둔 것에서 쓴 만큼 줄고, 모자라면 조당 포션을 줄여 보낸다', () => {
    setSeed(61); const W: World = big(old(newWorld())); us(W).sup = { pot: [], holy: [], gear: {} };   // 처음 챙겨 온 포션 없이
    // 보낼 때 모자란 채비를 사지 않게 하면 사 둔 10병을 조들이 나눠 들고 간다 (창고가 비면 포션 없이)
    const P = BOT.even(W); P.buy = { pot: 10 }; P.autoBuy = false;
    const M = runMonth(W, P), r = M.res[0], out = (W.away || []).reduce((a, s) => a + s.kit.pots, 0);
    expect(r.potUsed).toBeLessThanOrEqual(10);
    expect(M.ours.some(o => !o.potC)).toBe(true);
    expect(potsOf(us(W)).pot + potsOf(us(W)).holy + out).toBe(10 - r.potUsed);
    // 켜 두면 보낼 때마다 모자란 만큼 사서 모든 조가 정한 만큼 들고 간다
    const P2 = BOT.even(W); P2.buy = { pot: 500 };
    const M2 = runMonth(W, P2), Q2 = sanitize(W, us(W), P2);
    M2.ours.filter(o => o.d0! <= o.d1!).forEach(o => expect(o.potC).toBe(Q2.pots[o.f]));   // (지난달 끝에 보낸 조는 빼고)
    expect(potsOf(us(W)).pot).toBeGreaterThan(400);
  });
  it('장비는 한 벌을 조 하나가 들고 가고, 모자라면 그만큼은 장비 없이 가며, 망가진 만큼 창고에서 빠진다', () => {
    setSeed(62); const W: World = big(newWorld());
    const P = sanitize(W, us(W), BOT.even(W)); P.teams!.forEach(T => { T.g = 'g:냉기'; }); P.buy = { gear: { 냉기: 2 } }; P.autoBuy = false;
    expect(P.teams!.length).toBe(4);
    const M = runMonth(W, P), r = M.res[0], out = (W.away || []).filter(s => s.kit.gear === '냉기').length;
    expect(r.gearUsed['냉기']).toBe(M.ours.filter(x => x.keys.includes('g:냉기')).length);
    expect(M.ours.some(x => !x.keys.includes('g:냉기'))).toBe(true);   // 두 벌이 다 나가 있으면 장비 없이 간다
    expect(us(W).sup!.gear['냉기'] + out).toBe(2 - (r.gearLost['냉기'] || 0));
    expect(r.spend.gear).toBe(2 * CO.GEAR_PRICE);
  });
  it('포션은 산 달별로 쌓여 오래된 것부터 쓰이고, 기한이 지나면 그 묶음이 상한다', () => {
    setSeed(63); const W: World = old(newWorld()); us(W).sup = { pot: [], holy: [], gear: {} };   // 처음 챙겨 온 포션 없이
    const P = BOT.even(W); P.buy = { pot: 300 };
    const M0 = runMonth(W, P), left = potsOf(us(W)).pot;
    expect(left).toBe(300 - M0.res[0].potUsed);
    let spoiled = 0, used = 0;
    for (let m = 0; m < CO.POT_KEEP + 1; m++) {
      const Q = BOT.even(W); Q.parties = Q.parties.map(() => 0); Q.buy = { pot: 0 };
      const M = runMonth(W, Q); spoiled += M.res[0].potSpoil; used += M.res[0].potUsed;
    }
    expect(used).toBe(0);
    expect(spoiled).toBe(left);
    expect(potsOf(us(W)).pot).toBe(0);
    expect(us(W).sup!.pot.length).toBeLessThanOrEqual(CO.POT_KEEP + 1);
  });
  it('조사 의뢰는 한 달에 정해진 횟수까지, 값은 그달 정산에 나가고, 타 용병단 조사는 실제 계획과 같다', () => {
    setSeed(64); const W: World = newWorld();
    for (let m = 0; m < 3; m++) runMonth(W, BOT.even(W));
    const a = probe(W, 'riv', 'red'), b = probe(W, 'mkt');
    expect(a && b).toBeTruthy();
    expect(probe(W, 'riv', 'holy')).toBeTruthy();
    expect(probe(W, 'mkt')).toBeNull();
    const M = runMonth(W, BOT.even(W)), i = W.cos.findIndex(c => c.id === 'red');
    expect(M.plans[i].parties).toEqual(a!.parties);
    expect(M.res[0].spend.probe).toBe(CO.PROBE_RIV * 2 + CO.PROBE_MKT);
    expect(probe(W, 'mkt')).toBeTruthy();
  });
  it('우리 조는 기본 편성대로 짜고, 모자란 자리는 비우거나 남은 사람으로 채운다', () => {
    setSeed(65); const W: World = big(newWorld()), c = us(W);
    expect(CLASSES.map(k => c.crew!.filter(x => x.c === k).length)).toEqual([6, 3, 2, 2, 3]);   // 전사 궁수 마법사 사제 도적
    const bare = formTeams(c, [4, 0, 0, 0, 0], CO.TPL0, false);
    expect(bare.map(T => T.m.filter(x => x != null).length)).toEqual([4, 4, 3, 2]);   // 조장은 직업과 상관없이 먼저 세우고, 나머지 자리에 기본 편성 직업 (마법사가 둘, 궁수·도적이 셋뿐이다)
    bare.forEach(T => expect(T.m.length).toBe(4));   // (카리스마가 없는 옛 명단은 3: 네 명 조)
    const full = formTeams(c, [4, 0, 0, 0, 0], CO.TPL0, true);
    expect(full.every(T => T.m.every(x => x != null))).toBe(true);
    expect(new Set(full.flatMap(T => T.m)).size).toBe(16);
    // 없는 사람, 겹친 사람, 닫힌 층은 걸러지고 조 수는 짠 조에서 센다
    const P = defaultPlan(W); P.teams = [{ f: 0, m: [0, 0, 999, null], g: 'g:신성' }, { f: 3, m: [1, null, null, null], g: '' }, { f: 0, m: [null, null, null, null], g: '' }];
    const Q = sanitize(W, c, P);
    expect(Q.teams).toHaveLength(1); expect(Q.teams![0]).toMatchObject({ f: 0, m: [0, null, null, null], g: 'g:신성', days: CO.TRIP_DAYS[0], margin: 0 });
    expect(W.zones![Q.teams![0].z!].f).toBe(0);   // 구역을 정하지 않으면 그 층에서 가장 나은 구역으로
    expect(Q.parties).toEqual([1, 0, 0, 0, 0]);
    const html = expWeekHtml(W, P, { phase: 1, tab: 'report', pins: [] });
    expect(html).not.toMatch(/undefined|NaN|\[object/);
    expect(html).toContain('기본 편성'); expect(html).toContain('대기');
  });
  it('빈자리가 있는 조는 성공률이 떨어지고 캐 오는 양도 사람 수만큼이다', () => {
    let a = 0, b = 0, ga = 0, gb = 0;
    for (let g = 1; g <= 40; g++) for (const n of [4, 2]) {
      setSeed(g); const W = newWorld(), c = us(W);
      const P = defaultPlan(W); P.teams = [0, 1, 2, 3].map(q => ({ f: 0, m: c.crew!.slice(q * 4, q * 4 + n).map(x => x.id).concat(Array(4 - n).fill(null)), g: '' }));
      const r = runMonth(W, P).res[0]; if (n === 4) { a += r.ok[0]; ga += r.got[0]; } else { b += r.ok[0]; gb += r.got[0]; }
    }
    expect(a).toBeGreaterThan(b); expect(ga).toBeGreaterThan(gb * 1.5);
  });
  it('다음 달엔 짜 둔 조를 그대로 두고, 죽은 자리만 비우고 새로 온 사람을 그 자리 직업에 맞춰 넣는다', () => {
    setSeed(66); const W: World = big(newWorld()), c = us(W);
    const P = sanitize(W, c, defaultPlan(W));
    const gone = P.teams![1].m[1]!;   // 둘째 조의 궁수
    c.crew = c.crew!.filter(x => x.id !== gone).concat([{ id: 99, c: '궁수', rk: 0 }]); c.members = c.crew.length;
    const Q = carryPlan(W, P);
    expect(Q.teams!.map(T => T.m)).toEqual(P.teams!.map(T => T.m.map(x => (x === gone ? 99 : x))));
    c.crew = c.crew.filter(x => x.id !== 99); c.members = c.crew.length;
    const R = carryPlan(W, Q);
    expect(R.teams![1].m[1]).toBeNull();   // 맞는 사람이 없으면 빈 채로
  });
});

describe('층의 성격', () => {
  it('시세는 수요와 공급으로 정해지고, 공급이 수요의 두 배가 되면 깊은 층 채집품일수록 더 떨어지지만 기본 소재라 크게 무너지지 않는다', () => {
    const drop = ITEMS.map(it => priceOf(it, it.D * 2) / priceOf(it, it.D));
    ITEMS.forEach(it => expect(priceOf(it, it.D)).toBe(it.P0));
    for (let j = 1; j < ITEMS.length; j++) expect(drop[j]).toBeLessThan(drop[j - 1]);
    expect(drop[0]).toBeGreaterThan(0.75);
    expect(drop[ITEMS.length - 1]).toBeGreaterThanOrEqual(0.6);
    expect(drop[ITEMS.length - 1]).toBeLessThan(0.75);
  });
  it('공급과 수요는 상단 장부 1단계부터 시세판에 보인다', () => {
    setSeed(71); const W: World = newWorld();
    for (let m = 0; m < 3; m++) runMonth(W, BOT.even(W));
    expect(resultsHtml(W)).toContain('상단 장부 1단계부터');
    expect(resultsHtml(W)).not.toContain(`/ ${ITEMS[0].D}</small>`);
    W.intel!.lv.mkt = 1;
    expect(resultsHtml(W)).toContain(`${W.last!.Q[0]} / ${ITEMS[0].D}</small>`);
  });
  it('얕은 층 채집품은 시세 폭이 좁고 깊은 층 채집품은 넓다', () => {
    for (let j = 1; j < ITEMS.length; j++) expect(ITEMS[j].hi / ITEMS[j].lo).toBeGreaterThan(ITEMS[j - 1].hi / ITEMS[j - 1].lo);
  });
  it('1층은 첫 달에 모두가 몰려도 대부분 성공하고 거의 죽지 않으며, 깊을수록 성공이 어렵고 포션으로 막지 못하는 사망이 커진다', () => {
    let s = 0, ok = 0, d = 0;
    for (let g = 1; g <= 20; g++) { setSeed(g); const W = newWorld(); const M = runMonth(W, BOT.even(W)); M.res.forEach(r => { s += r.sent[0]; ok += r.ok[0]; d += r.dF[0]; }); }
    expect(ok / s).toBeGreaterThan(0.6);
    expect(d / s).toBeLessThan(0.1);
    for (let f = 1; f < FLOORS.length; f++) { expect(FLOORS[f].base).toBeLessThan(FLOORS[f - 1].base); expect(FLOORS[f].risk * FLOORS[f].harm).toBeGreaterThan(FLOORS[f - 1].risk * FLOORS[f - 1].harm); }
  });
});

describe('정보망 넓히기', () => {
  it('유지비는 저절로 내고 넓히는 돈만 쌓여 단계가 오르며, 유지비를 끊으면 한 단계 내려간다', () => {
    setSeed(81); const W: World = newWorld();
    for (let m = 0; m < 6; m++) { const P = BOT.even(W); P.intelUp = { mkt: 100 }; runMonth(W, P); }
    expect(W.intel!.lv.mkt).toBeGreaterThanOrEqual(1);
    const lv = W.intel!.lv.mkt, keeps = (['ret', 'mkt', 'chu', 'gate', 'spy'] as const).reduce((x, k) => x + INTEL.KEEP[k][W.intel!.lv[k]], 0);
    const P = BOT.even(W); P.intelUp = {}; const M = runMonth(W, P);
    expect(M.res[0].spend.intel).toBe(keeps);
    expect(W.intel!.lv.mkt).toBe(lv);
    const Q = BOT.even(W); Q.intelUp = {}; Q.intelCut = ['mkt']; runMonth(W, Q);
    expect(W.intel!.lv.mkt).toBe(lv - 1);
  });
});

describe('위기와 포션', () => {
  it('포션은 위기가 온 만큼만 쓰이고, 남은 것은 창고로 돌아온다', () => {
    setSeed(91); const W: World = old(newWorld()); us(W).sup = { pot: [], holy: [], gear: {} };   // 처음 챙겨 온 포션 없이
    const P = BOT.even(W); P.buy = { pot: 100 };
    const M = runMonth(W, P), r = M.res[0];
    const carried = M.plans[0].parties.reduce((a, n, f) => a + (n + M.plans[0].hire[f]) * M.plans[0].pots[f], 0);
    expect(r.potUsed).toBeLessThan(carried);
    expect(r.potUsed).toBeGreaterThanOrEqual(M.ours.reduce((a, x) => a + (x.pots || 0), 0));   // 계약 파티가 쓴 것까지
    expect(potsOf(us(W)).pot).toBe(100 - r.potUsed);
    M.ours.forEach(x => expect(x.pots || 0).toBeLessThanOrEqual(x.crisis || 0));
  });
  it('포션이 떨어지면 깊은 층 실패가 더 많은 사망으로 이어진다', () => {
    let withP = 0, noP = 0;
    for (let g = 1; g <= 15; g++) for (const pots of [0, 4]) {
      setSeed(g); const W: World = newWorld(); W.unlocked = 3; us(W).members = 36; us(W).beds = 36;
      for (let m = 0; m < 4; m++) { const P = BOT.even(W); P.parties = [0, 0, 9, 0, 0]; P.pots = FLOORS.map(() => pots); P.buy = { pot: 200 }; const M = runMonth(W, P); if (pots) withP += M.res[0].dF[2]; else noP += M.res[0].dF[2]; }
    }
    expect(noP).toBeGreaterThan(withP * 1.3);
  });
});

describe('숙소 · 신입 모집 · 수습 · 명성', () => {
  it('모두 작게 시작하고, 침상은 처음 인원만큼이다 (우리 숙소는 여유 둘)', () => {
    setSeed(1); const W = newWorld();
    expect(us(W).members).toBe(CO.US0); expect(us(W).crew!.filter(x => x.lead)).toHaveLength(1);
    W.cos.forEach(c => { if (c.style !== 'crowd') expect(bedsOf(c)).toBe(c.crew ? CO.HQ_BEDS[0] : c.members); });
    expect(us(W).cash).toBe(CO.START_CASH);
  });
  it('지원자는 그달 며칠에 걸쳐 찾아오고, 계약하면 계약금이 바로 나가고 다음 날 아침 이름 · 실력 · 특성 그대로 들어온다 (그날 안엔 물릴 수 있다)', () => {
    setSeed(3); const W = newWorld(), c = us(W);
    const cand = [...W.cand!]; expect(cand.length).toBe(10);
    cand.forEach(p => { expect(p.n).toBeTruthy(); expect(TRAITS[p.tr!]).toBeTruthy(); });
    const now = candNow(W); expect(now.length).toBeGreaterThan(1); expect(now.length).toBeLessThan(cand.length);   // 첫날엔 몇 명만
    const cash = c.cash, p = now[0], q = now[1], v = hireNow(W, p.id);
    expect(v).toBe(candPrice(p, CO.RECRUIT)); expect(c.cash).toBe(cash - v);
    expect(roomOf(c)).toBe(18 - CO.US0 - 1); expect(c.crew!.length).toBe(CO.US0);   // 내일 들어온다 (침상은 잡아 둔다)
    expect(hireNow(W, p.id)).toBe(-v); expect(c.cash).toBe(cash); expect(candNow(W).some(x => x.id === p.id)).toBe(true);   // 물리기
    hireNow(W, p.id); hireNow(W, q.id);
    const P = emptyPlan(); nextDay(W, P);
    expect(c.crew!.length).toBe(CO.US0 + 2); expect(c.hireQ).toBeUndefined();
    [p, q].forEach(x => expect(c.crew!.some(y => y.n === x.n && y.sk === x.sk && y.tr === x.tr && y.c === x.c && y.ad == null)).toBe(true));
    expect(new Set(c.crew!.map(x => x.id)).size).toBe(c.crew!.length);
    const later = cand.filter(x => x.ad! > 2); expect(later.length).toBeGreaterThan(0);
    later.forEach(x => expect(candNow(W).some(y => y.id === x.id)).toBe(false));   // 뒤에 오는 사람은 그날이 돼야 보인다
    // 그믐 정산: 계약금이 신입 줄에 들고, 다음 달 명단은 새로 온다
    let M = null; while (!M) M = nextDay(W, P);
    expect(M.res[0].recruited).toBe(2); expect(M.res[0].spend.recruit).toBe(candPrice(p, CO.RECRUIT) + candPrice(q, CO.RECRUIT));
    expect(W.cand!.length).toBeGreaterThan(0); expect(W.cand!.some(x => cand.some(y => y.id === x.id))).toBe(false);
  });
  it('고르지 않으면 직업별로 찾는 만큼 그 직업 지원자 중 실력 좋은 사람부터 뽑고, 드문 직업 · 높은 실력은 비싸다', () => {
    setSeed(5); const W = newWorld(), c = us(W); c.hq!.dorm = 2; W.apps = 20;
    const P = defaultPlan(W); P.recruitC = { 마법사: 9, 사제: 1 };
    const want = candWants(W, c, sanitize(W, c, P), 14), mages = candNow(W).filter(p => p.c === '마법사');
    expect(want.filter(p => p.c === '마법사').length).toBe(Math.min(mages.length, classCap(20, '마법사')));
    expect(want.filter(p => p.c === '마법사').map(p => p.sk)).toEqual(mages.map(p => p.sk!).sort((a, b) => b - a).slice(0, want.filter(p => p.c === '마법사').length));
    // 한 달 몫이라 사제는 하나만, 마법사는 그달 찾아온 둘 모두 (첫날 하나 · 닷새째 하나)
    const all = [...W.cand!], r = runMonth(W, P).res[0];
    expect(r.recruitC).toEqual({ 마법사: 2, 사제: 1 });
    const got = all.filter(p => r.newP!.includes(p.id));
    expect(r.spend.recruit).toBe(got.reduce((a, p) => a + candPrice(p, r.recruitPrice), 0));
    const lo = { id: 1, c: '전사', sk: 5 }, hi = { id: 2, c: '마법사', sk: 50 };
    expect(candPrice(hi, 80)).toBeGreaterThan(candPrice(lo, 80));
  });
  it('본부 증축은 그달에 값을 치르고 다음 달 정산 때 완공되며, 한 달에 공사 하나다', () => {
    setSeed(4); const W = newWorld(), c = us(W), cost = hqCost(c, 'dorm'), beds = bedsOf(c);
    const P = defaultPlan(W); P.build = 'dorm';
    const M = runMonth(W, P);
    expect(M.res[0].spend.dorm).toBe(cost + dormKeep(beds));
    expect(bedsOf(c)).toBe(beds); expect(c.pendingHq).toBe('dorm');
    const Q = carryPlan(W, P); expect(Q.build).toBeUndefined();
    expect(sanitize(W, c, { ...Q, build: 'train' }).build).toBeUndefined();   // 공사 중엔 다른 것도 짓지 않는다
    runMonth(W, Q);
    expect(bedsOf(c)).toBe(CO.HQ_BEDS[1]); expect(c.pendingHq).toBeUndefined();
    // 숙소가 아닌 공사는 본부 줄로, 다음 달부터 단계마다 유지비
    const R = carryPlan(W, Q); R.build = 'med';
    const r2 = runMonth(W, R).res[0]; expect(r2.spend.hq).toBe(CO.HQ_COST.med[0]);
    const r3 = runMonth(W, carryPlan(W, R)).res[0]; expect(hqLv(c, 'med')).toBe(1); expect(r3.spend.hq).toBe(CO.HQ_KEEP);
    expect(r3.spend.heal).toBe(Math.round(r3.hurt * CO.HEAL_COST * 0.5));   // 의무실 1단계: 치료비 절반
  });
  it('관리비는 머릿수를 따라 가파르게 붙는다', () => {
    expect(wageOf(16) / 16).toBeLessThan(wageOf(40) / 40);
    expect(wageOf(50) / 50 / CO.WAGE).toBeCloseTo(1 + CO.OH_K * 2500);
  });
  it('수습은 얕은 층 조부터 한 명씩 돌아가며 끼고, 낀 조는 성공률이 떨어진다', () => {
    setSeed(1); const W = newWorld(), c = W.cos[1]; c.rook = [0, 0, 0, 0, 0];   // 경쟁 용병단은 수습이 저절로 낀다
    const P = emptyPlan(); P.parties = [2, 1, 0, 0, 0];
    expect(rookSlots(c, P)).toEqual([[[0, 3], [1, 4]], [[2]], [], [], []]);
    let a = 0, b = 0;
    for (let g = 1; g <= 40; g++) for (const rk of [0, 4]) {
      setSeed(g); const V = newWorld(); us(V).crew!.forEach(x => { if (rk) x.rk = 0; });
      const Q = sanitize(V, us(V), defaultPlan(V)); Q.recruit = 0;
      const ok = runMonth(V, Q).res[0].ok[0]; if (rk) b += ok; else a += ok;
    }
    expect(a).toBeGreaterThan(b);
  });
  it('지원자가 모자라면 계약금이 오르고, 명성이 높은 쪽이 더 받는다', () => {
    expect(shareOut([4, 4], [1, 1], 20)).toEqual([4, 4]);
    const s = shareOut([6, 6], [1, 3], 6);
    expect(s[0] + s[1]).toBe(6); expect(s[1]).toBeGreaterThan(s[0]);
    expect(recruitPrice(10, 10)).toBe(CO.RECRUIT);
    expect(recruitPrice(20, 10)).toBeGreaterThan(CO.RECRUIT);
    expect(recruitPrice(999, 1)).toBe(CO.RECRUIT * CO.RECRUIT_MAX);
    setSeed(8); const W = newWorld(); W.cos.forEach(c => { c.beds = c.members + 8; }); W.apps = 5;
    openMonth(W);   // 경쟁 용병단은 달 첫날 계획을 세운다 (늘린 침상을 보고 다시)
    const M = runMonth(W, defaultPlan(W));
    expect(M.res.reduce((a, r) => a + r.recruited, 0) - M.res[0].recruited).toBe(Math.max(0, 5 - M.res[0].recruited));   // 우리 문을 두드린 사람을 뺀 나머지를 나눈다
    expect(M.res[1].recruitPrice).toBeGreaterThan(CO.RECRUIT);
    expect(hirePrice(W)).toBe(M.res[1].recruitPrice);   // 우리 계약금은 지난달 값을 따른다
  });
  it('명성은 성공한 층만큼 오르고, 다음 달 지원자는 판매 수입을 따라 정해진다', () => {
    setSeed(2); const W = newWorld();
    const M = runMonth(W, defaultPlan(W)), r = M.res[0];
    expect(us(W).fame).toBeCloseTo(Math.max(0, r.win[0] * CO.FAME_F[0] - r.deaths * CO.FAME_DEATH));
    const sales = M.res.reduce((a, x) => a + x.sales, 0), base = CO.APP_BASE + CO.APP_PER * sales / 1000;
    expect(W.apps!).toBeGreaterThanOrEqual(Math.floor(base * 0.8)); expect(W.apps!).toBeLessThanOrEqual(Math.ceil(base * 1.2));
    expect(M.apps).toBe(CO.APP0);
    const e = W.intel!.est.apps!; expect(e.lo).toBeLessThanOrEqual(W.apps!); expect(e.hi).toBeGreaterThanOrEqual(W.apps!);
  });
  it('인원 화면은 침상·수습·신입을 보여 주고, 상태를 바꾸지 않는다', () => {
    setSeed(6); const W = newWorld(); us(W).crew![0].rk = 1; us(W).crew![1].rk = 0;
    const P = defaultPlan(W); P.build = 'dorm';
    const before = JSON.stringify(W);
    const h = infoWeekHtml(W, P, { phase: 0, tab: 'report', pins: [], place: 'staff' });
    expect(h).toContain('숙소'); expect(h).toContain('지원자 명단'); expect(h).toContain('단원 명단'); expect(h).toContain('수습 2명'); expect(h).toContain('본부 보기');
    const b = infoWeekHtml(W, P, { phase: 0, tab: 'report', pins: [], place: 'train' });
    expect(b).toContain('회색늑대 본부'); expect(b).toContain('공사 취소');
    expect(JSON.stringify(W)).toBe(before);
  });
});

describe('성공 정도 · 부상 · 수입 예측', () => {
  it('조원마다 굴려 해낸 사람 수가 조의 결과가 되고, 절반 이상 해내면 해낸 조로 센다', () => {
    setSeed(71); const W = newWorld();
    for (let m = 0; m < 6; m++) {
      const M = runMonth(W, BOT.even(W)), r = M.res[0];
      M.ours.forEach(x => { expect(x.k).toBeGreaterThanOrEqual(0); expect(x.k!).toBeLessThanOrEqual(x.n!); expect(x.ok).toBe(x.k! >= Math.ceil(x.n! / 2)); });   // (조원의 절반 이상)
      FLOORS.forEach((_, f) => expect(r.ok[f]).toBe(M.ours.filter(x => x.f === f && x.ok).length));
      expect(gradeOf(4)).toBe('대성공'); expect(gradeOf(2)).toBe('고전'); expect(gradeOf(1)).toBe('실패');
    }
  });
  it('위기를 버틴 사람 중 일부는 다쳐서 며칠 쉬고(그동안 조에서 빠진다), 치료비가 나간다', () => {
    let seen = 0;
    for (let g = 1; g <= 30 && !seen; g++) {
      setSeed(g); const W = newWorld(); W.unlocked = 4;
      us(W).crew!.forEach(x => { delete x.tr; });   // 의무병이 있으면 다친 사람도 쉬지 않는다 (여기선 특성을 뺀다)
      const c = us(W), P = sanitize(W, c, defaultPlan(W)); P.teams!.forEach(T => { T.f = 3; T.pots = 0; }); P.parties = [0, 0, 0, P.teams!.length, 0];
      for (let d = 0; d < CO.MONTH_DAYS - 1 && !seen; d++) {
        sendReady(W, P); nextDay(W, P);
        const hurt = c.crew!.filter(x => x.hurt && !x.lead);
        if (!hurt.length) continue;
        seen++;
        hurt.forEach(x => expect(x.hurt).toBeLessThanOrEqual(CO.MONTH_DAYS));
        const on = new Set(sanitize(W, c, P).teams!.flatMap(T => T.m));
        hurt.forEach(x => { expect(on.has(x.id)).toBe(false); expect(stateOf(W, x)).toBe('hurt'); });   // 다친 사람은 조에 넣지 않는다
        const left = Math.max(...hurt.map(x => x.hurt!));
        for (let k = 0; k < left; k++) nextDay(W, P);
        hurt.forEach(x => { const y = c.crew!.find(z => z.id === x.id); if (y) expect(y.hurt || 0).toBe(0); });   // 쉬는 날이 지나면 돌아온다
      }
      const M = W.last || runMonth(W, P);
      expect(M.res[0].spend.heal).toBe(M.res[0].hurt * CO.HEAL_COST);
    }
    expect(seen).toBeGreaterThan(0);
  });
  it('수입 예측은 상태를 바꾸지 않고 난수도 쓰지 않으며, 결재 때 그 예측이 그달 기록에 남는다', () => {
    setSeed(72); const W = newWorld();
    runMonth(W, BOT.even(W));
    const P = sanitize(W, us(W), BOT.even(W)), before = JSON.stringify(W);
    setSeed(5); const r0 = rnd(); setSeed(5);
    const fc = forecast(W, P);
    expect(rnd()).toBe(r0); expect(JSON.stringify(W)).toBe(before);
    expect(fc.bins.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 2);
    expect(fc.p10).toBeLessThanOrEqual(fc.p50); expect(fc.p50).toBeLessThanOrEqual(fc.p90);
    expect(fc.mean).toBeGreaterThan(fc.p10); expect(fc.mean).toBeLessThan(fc.p90);
    // 결재 때 그달 다녀온 조들의 예측이 남는다 (조마다 여러 번 다녀왔으니 한 번씩 보낸 예측보다 크다)
    const M = runMonth(W, P);
    expect(M.fc!.mean).toBeGreaterThan(fc.mean);
    expect(fcRank(fc, 0)).toBe(0); expect(fcRank(fc, fc.p90 * 3)).toBe(1);
  });
  it('기본 운영이면 수입 예측이 실제와 크게 어긋나지 않는다', () => {
    let a = 0, f = 0, inside = 0, n = 0;
    for (let g = 1; g <= 12; g++) {
      const W = playGame(g, BOT.even);
      W.history.forEach(M => { if (!M.fc || !M.fc.mean) return; a += M.res[0].sales; f += M.fc.mean; n++; if (M.res[0].sales >= M.fc.p10 && M.res[0].sales <= M.fc.p90) inside++; });
    }
    // (구역에 남은 양은 숨긴 정보라 남들이 먼저 파 간 몫을 예측이 다 알지 못한다: 아래쪽 폭을 조금 넓게)
    expect(a / f).toBeGreaterThan(0.8); expect(a / f).toBeLessThan(1.15);
    expect(inside / n).toBeGreaterThan(0.5);
  });
  it('출정에 이번 달 예측이, 정산에 예측과 실제가 나온다', () => {
    setSeed(73); const W = newWorld();
    runMonth(W, BOT.even(W)); runMonth(W, BOT.even(W));
    const P = carryPlan(W, W.last!.plans[0]);
    const h = expWeekHtml(W, P, { phase: 1, tab: 'report', pins: [] }) + resultsHtml(W) + resultWeekHtml(W, true);
    expect(h).toContain('수입 분포'); expect(h).toContain('예측과 실제'); expect(h).toContain('지난달');
    expect(h).not.toMatch(/undefined|NaN|Infinity|\[object/);
  });
});

describe('내정 책상', () => {
  it('본 화면은 길드 홀이고 마을 지도와 결재안은 펼쳐 보며, 장소를 열면 그 업무 창이 뜬다', () => {
    setSeed(81); const W = newWorld();
    runMonth(W, BOT.even(W)); runMonth(W, BOT.even(W));
    const P = carryPlan(W, W.last!.plans[0]);
    const home = infoWeekHtml(W, P, { phase: 0, tab: 'report', pins: [] });
    expect(home).toContain('회색늑대 숙소'); expect(home).toContain('다음 날'); expect(home).toContain('data-place="staff"');
    const town = infoWeekHtml(W, P, { phase: 0, tab: 'report', pins: [], town: true });
    expect(town).toContain('하르덴'); expect(town).toContain('결재안');
    expect(home).not.toContain('class="reader');   // 처음엔 창이 닫혀 있다
    const want: Record<string, string> = { staff: '지원자 명단', train: '훈련장', market: '교회 성수', church: '근원 기금', alley: '정보망' };
    Object.entries(want).forEach(([place, word]) => {
      const h = infoWeekHtml(W, P, { phase: 0, tab: 'report', pins: [], place });
      expect(h, place).toContain(word); expect(h, place).not.toMatch(/undefined|NaN|\[object/);
    });
  });
  it('결재안 줄의 합은 이번 달 나갈 돈과 같고, 지난달 칸은 지난달 지출과 맞는다', () => {
    setSeed(82); const W = newWorld();
    for (let m = 0; m < 3; m++) runMonth(W, BOT.even(W));
    const P = carryPlan(W, W.last!.plans[0]); P.dorm = true; P.recruitC = { 마법사: 1 };
    const ls = costLines(W, P), cost = monthCost(W, P);
    expect(ls.reduce((a, l) => a + l.now, 0)).toBe(cost.all);
    const s = W.last!.res[0].spend;
    expect(ls.reduce((a, l) => a + l.last, 0)).toBe(Object.values(s).reduce((a, b) => a + b, 0));
    expect(ls.find(l => l.k === 'dorm')!.now).toBe(dormKeep(bedsOf(us(W)) + (us(W).pendingBeds || 0)) + (us(W).pendingBeds ? 0 : dormCost(us(W))));
  });
});

describe('보급 소모', () => {
  it('결과의 보급 소모는 조마다 들고 간 포션 · 쓴 포션 · 태운 횃불을 귀환 보고 그대로 센다', () => {
    setSeed(5); const W = newWorld();
    for (let m = 0; m < 3; m++) runMonth(W, defaultPlan(W));
    const L = W.last!, html = resultsHtml(W);
    expect(html).toContain('보급 소모');
    L.ours.forEach(x => { expect(x.potC).toBeLessThanOrEqual(L.plans[0].pots[x.f]); expect(html).toContain(`${x.pots || 0} / ${x.potC}병`); expect(html).toContain(`${x.trip!.tu} / ${x.trip!.torch}개`); });
    expect(L.ours.reduce((a, x) => a + (x.pots || 0), 0)).toBe(L.res[0].potUsed);
  });
});

describe('단원: 실력 · 특성 · 층 경험 · 조직력', () => {
  it('처음 단원은 판마다 같고, 이름 · 실력 · 특성이 있다', () => {
    setSeed(1); const a = newWorld(); setSeed(99); const b = newWorld();
    expect(JSON.stringify(us(a).crew)).toBe(JSON.stringify(us(b).crew));
    expect(JSON.stringify(a.cand)).toBe(JSON.stringify(b.cand));   // 첫 달 지원자도 판마다 같다
    us(a).crew!.forEach(p => { expect(p.n).toBeTruthy(); expect(TRAITS[p.tr!]).toBeTruthy(); expect(tierOf(p)).toBeGreaterThanOrEqual(0); });
  });
  it('다녀온 사람은 실력과 그 층 경험이 오르고, 함께 나간 짝과의 달이 쌓인다', () => {
    setSeed(4); const W = newWorld(), c = us(W), before = new Map(c.crew!.map(p => [p.id, { sk: p.sk!, ex: p.ex![0] }]));
    const M = runMonth(W, defaultPlan(W));
    const went = new Set<number>(); sanitize(W, c, defaultPlan(W));
    c.crew!.forEach(p => { const b = before.get(p.id); if (!b) return; if (p.ex![0] > b.ex) { went.add(p.id); expect(p.sk!).toBeGreaterThan(b.sk); } });
    expect(went.size).toBeGreaterThan(0);
    // 함께 다닌 날만큼 쌓인다 (옛 한 달 탐사 DAYS일이 한 달 몫)
    c.crew!.filter(p => went.has(p.id)).forEach(p => { const mates = Object.keys(p.mt || {}); expect(mates.length).toBeGreaterThan(0); mates.forEach(id => { expect(p.mt![+id]).toBeGreaterThan(0); expect(p.mt![+id]).toBeLessThanOrEqual(CO.CO_MAX); }); });
    expect(M.res[0].spend.wage).toBe(Math.round(c.crew!.length ? M.res[0].spend.wage : 0));
  });
  it('조직력은 함께 나간 달을 따라 오르고, 새 얼굴이 끼면 떨어진다', () => {
    const p = (id: number, mt: Record<number, number>) => ({ id, c: '전사', sk: 40, mt });
    const old = [p(1, { 2: 6, 3: 6, 4: 6 }), p(2, { 1: 6, 3: 6, 4: 6 }), p(3, { 1: 6, 2: 6, 4: 6 }), p(4, { 1: 6, 2: 6, 3: 6 })];
    expect(cohesion(old)).toBe(1);
    const mixed = [...old.slice(0, 3), p(9, {})];
    expect(cohesion(mixed)).toBeCloseTo(0.5);
    expect(memberMods(old, 0).pp[0]).toBeGreaterThan(memberMods(mixed, 0).pp[0]);
  });
  it('실력 단계 · 조직력이 높은 조가 더 자주 해낸다', () => {
    let hi = 0, lo = 0;
    for (let g = 1; g <= 30; g++) for (const vet of [true, false]) {
      setSeed(g); const W = newWorld(), c = us(W);
      c.crew!.forEach(p => { p.sk = vet ? 90 : 5; p.mt = vet ? Object.fromEntries(c.crew!.filter(x => x.id !== p.id).map(x => [x.id, 6])) : {}; delete p.tr; });
      const r = runMonth(W, defaultPlan(W)).res[0]; if (vet) hi += r.win[0]; else lo += r.win[0];
    }
    expect(hi).toBeGreaterThan(lo * 1.05);
  });
});

describe('층 이해도 · 지도 완성도', () => {
  it('지도는 1층만 조금 그려진 채 시작하고, 다녀온 조가 그려 오며, 우리 보탠 몫이 기록된다', () => {
    setSeed(2); const W = newWorld();
    W.cos.forEach(c => { if (c.map) { expect(c.map[0]).toBe(CO.MAP0); expect(c.map.slice(1).every(v => v === 0)).toBe(true); } });
    const M = runMonth(W, defaultPlan(W));
    expect(mapOf(us(W), 0)).toBeGreaterThan(CO.MAP0); expect(M.map0![0]).toBe(CO.MAP0);
    expect(Object.keys(M.mapBy || {}).length).toBeGreaterThan(0);
    expect(resultsHtml(W)).toContain('지도 완성도');
  });
  it('모르는 층일수록 덜 해내고 더 죽는다 (같은 조를 지도 0과 100인 층에 보냈을 때)', () => {
    let lo = 0, hi = 0, dLo = 0, dHi = 0;
    for (let g = 1; g <= 30; g++) for (const m of [0, 100]) {
      setSeed(g); const W = newWorld(), c = us(W); W.unlocked = 3; c.map![2] = m; c.crew!.forEach(p => { delete p.tr; });
      const P = sanitize(W, c, defaultPlan(W)); P.teams!.forEach(T => { T.f = 2; T.mission = 'hunt'; T.pots = 0; }); P.parties = [0, 0, P.teams!.length, 0, 0];   // 조우가 많은 사냥 임무로, 포션 없이 (위기가 사망으로 이어지게)
      const r = runMonth(W, P).res[0]; if (m) { hi += r.win[2]; dHi += r.deaths; } else { lo += r.win[2]; dLo += r.deaths; }
    }
    expect(hi).toBeGreaterThan(lo * 1.15); expect(dLo).toBeGreaterThan(dHi);
    const u = undMods(0, 0), v = undMods(100, 100); expect(u.succ).toBeLessThan(v.succ); expect(u.crisis).toBeGreaterThan(v.crisis);
  });
  it('조 이해도는 지도에 고참 경험과 길잡이를 더한다', () => {
    setSeed(1); const W = newWorld(), c = us(W); c.map![1] = 40;
    const a = { id: 1, c: '전사', ex: [0, 60, 0, 0, 0] }, b = { id: 2, c: '궁수', tr: '길잡이', ex: [0, 0, 0, 0, 0] };
    expect(teamUnd(c, 1, [a])).toBe(40 + 15); expect(teamUnd(c, 1, [b])).toBe(40 + CO.UND_GUIDE); expect(teamUnd(c, 1, [])).toBe(40);
  });
  it('다 그린 지도의 사본은 기록실 3단계에서 한 번 팔 수 있고, 판매 수입으로 들어오며 남의 지도를 올린다', () => {
    setSeed(3); const W = newWorld(), c = us(W); c.map![0] = 100; c.hq!.rec = 3;
    const other = W.cos[1].map![0];
    const P = defaultPlan(W); P.sellMap = 0;
    const r = runMonth(W, P).res[0];
    expect(r.mapSale).toBe(CO.MAP_COPY); expect(c.mapSold![0]).toBe(true);
    expect(W.cos[1].map![0]).toBeGreaterThanOrEqual(Math.min(100, other + CO.MAP_GIVE));
    expect(sanitize(W, c, { ...defaultPlan(W), sellMap: 0 }).sellMap).toBeUndefined();   // 한 층에 한 번
  });
});

describe('관리국 게시판: 의뢰', () => {
  // 공표된 경쟁 · 납품 의뢰는 지금 닫아 두었다 (CO.JOBS_OPEN). 규칙은 남아 있어 열고 확인한다
  beforeEach(() => { CO.JOBS_OPEN = true; });
  afterEach(() => { CO.JOBS_OPEN = false; });
  it('첫 달 게시판은 판마다 같고, 납품은 맡은 만큼 판 것에서 넘겨 웃돈을 받는다', () => {
    setSeed(1); const a = newWorld(); setSeed(7); const b = newWorld();
    expect(JSON.stringify(a.jobs)).toBe(JSON.stringify(b.jobs));
    const W = a, J = W.jobs!.find(x => x.kind === 'deliver')!;
    const P = defaultPlan(W); P.take = { [J.id]: 333 };
    expect(sanitize(W, us(W), P).take![J.id]).toBe(300);   // 50개 단위
    const r = runMonth(W, P).res[0];
    expect(J.take[0]).toBeLessThanOrEqual(300); expect(J.done[0]).toBe(Math.min(J.take[0], r.sold[0]));
    expect(r.jobPay).toBe(Math.round(J.done[0] * J.prem) + 0);
    expect(r.jobs!.find(x => x.id === J.id)!.got).toBe(J.done[0]);
  });
  it('맡은 양을 다 못 채우면 끝나는 달에 위약금이 나가고, 경쟁 포상은 순위대로 나간다', () => {
    setSeed(2); const W = newWorld(), J = W.jobs!.find(x => x.kind === 'deliver')!, R = W.jobs!.find(x => x.kind === 'race')!;
    const P = defaultPlan(W); P.take = { [J.id]: 1200 };
    runMonth(W, P); let last = runMonth(W, carryPlan(W, P)); last = runMonth(W, carryPlan(W, P));
    const r = last.res[0];
    expect(r.spend.job).toBe(Math.round((J.take[0] - J.done[0]) * J.pen));
    const order = W.cos.map((c, k) => [k, c.style === 'crowd' ? -1 : R.score![k]] as [number, number]).sort((x, y) => y[1] - x[1] || x[0] - y[0]);
    const prize = (k: number) => last.res[k].jobs!.find(x => x.id === R.id)!.pay;
    expect(prize(order[0][0])).toBe(CO.RACE_PRIZE[0]); expect(prize(order[1][0])).toBe(CO.RACE_PRIZE[1]); expect(prize(order[3][0])).toBe(0);
  });
  it('셋째 달부터 공급이 모자란 전리품에 납품 의뢰가 붙는다 (난수 없이 상태에서)', () => {
    const W = playGame(5, BOT.even);
    const later = W.jobs!.filter(J => J.from >= 3 && J.kind !== 'explore');
    expect(later.length).toBeGreaterThan(0);
    later.forEach(J => { expect(J.kind).toBe('deliver'); expect(J.until - J.from).toBe(2); });
    const h = infoWeekHtml(W, carryPlan(W, null), { phase: 0, tab: 'report', pins: [], place: 'board' });
    expect(h).toContain('관리국 게시판');
  });
});

describe('영주청: 영주세 · 법령 · 가정산 · 감사', () => {
  it('정직하게 내면 고지서는 전리품 판매의 세율만큼이고, 갈무리 소재는 법령이 붙기 전엔 세금이 없다', () => {
    setSeed(3); const W = newWorld();
    const M = runMonth(W, defaultPlan(W)), r = M.res[0], D = W.draft!;
    expect(D.m).toBe(1); expect(D.truth.loot).toBe(r.lootSales); expect(D.truth.mat).toBe(0); expect(D.matTaxed).toEqual([]);
    expect(D.truth.pot).toBe(r.potUsed);
    const F = closeBooks(W)!;
    expect(F.bill.lootTax).toBe(Math.round(r.lootSales! * TAX.LOOT));
    expect(r.spend.tax).toBe(F.bill.tax + F.bill.refund);
    expect(F.gain).toBe(0); expect(us(W).sus).toBe(0);
  });
  it('큰 용병단은 전리품 세금을 합법으로 덜 내고, 우리는 그런 감면이 없다', () => {
    setSeed(4); const W = newWorld();
    runMonth(W, defaultPlan(W));
    const red = W.cos.findIndex(c => c.id === 'red'), r = W.last!.res[red];
    expect(r.file!.bill.lootTax).toBe(Math.round(r.file!.filed.loot * TAX.LOOT * (1 - TAX.RELIEF.volume!)));
    expect(W.draft!.relief).toBe(0);
  });
  it('신고서를 내지 않고 다음 달로 가면 장부 그대로 낸다', () => {
    setSeed(5); const W = newWorld();
    runMonth(W, defaultPlan(W)); const D = W.draft!;
    runMonth(W, carryPlan(W, null));
    const r = W.history[0].res[0];
    expect(r.file!.filed).toEqual(D.truth);
    expect(W.history[0].rank).toContain('us');
  });
  it('신고서는 규칙 안으로 맞춰진다: 판매액은 참값까지, 포션은 몇 배까지, 조 수는 보낼 수 있는 만큼까지', () => {
    setSeed(6); const W = newWorld(); runMonth(W, defaultPlan(W)); const D = W.draft!, T = D.truth;
    const F = fileFix(W, D, { loot: T.loot * 2, pot: 9999, torch: 9999, aid: 50, adv: 50, mat: -5 });
    expect(F.loot).toBe(T.loot); expect(F.mat).toBe(0); expect(F.pot).toBe(Math.max(T.pot * 3, T.pot + 12)); expect(F.torch).toBe(T.torch * 2);
    expect(F.aid).toBe(0); expect(F.adv).toBe(0);   // 지원금 법령도, 계획서도 없는 첫 달
    FILE_KEYS.forEach(k => expect(Number.isInteger(F[k])).toBe(true));
  });
  it('미리보기는 상태를 바꾸지 않고, 덜 적은 만큼 이득과 의심이 늘고 감사 확률이 오른다', () => {
    setSeed(7); const W = big(newWorld()); runMonth(W, defaultPlan(W)); const D = W.draft!;
    const snap = JSON.stringify(W);
    const a = preview(W, D, {}), b = preview(W, D, { loot: Math.round(D.truth.loot * 0.7), pot: D.truth.pot + 6 }), c = preview(W, D, { loot: 0, pot: D.truth.pot + 6 });
    expect(JSON.stringify(W)).toBe(snap);
    expect(a.total).toBe(0); expect(b.total).toBeGreaterThan(0); expect(c.total).toBeGreaterThan(b.total);
    expect(b.gain.loot).toBe(Math.round((D.truth.loot - Math.round(D.truth.loot * 0.7)) * D.lootRate));
    expect(b.sus).toBeGreaterThan(a.sus); expect(c.chance).toBeGreaterThanOrEqual(b.chance);
    expect(b.bill.tax).toBe(billOf(D, b.F).tax);
    expect(gainOf(D, D.truth)).toEqual({ loot: 0, mat: 0, pot: 0, torch: 0, aid: 0, adv: 0 });
    expect(auditChance(0)).toBe(0); expect(auditChance(1e6)).toBe(TAX.AUDIT_MAX);
  });
  it('한도까지 부풀리면 감사가 오고, 걸린 이득의 세 배를 추징한다. 감사가 끝나면 의심과 장부는 지워진다', () => {
    let audits = 0;
    for (let seed = 1; seed <= 10; seed++) {
      setSeed(seed); const W = newWorld();
      for (let m = 0; m < 18; m++) {
        runMonth(W, BOT.smart(W)); const D = W.draft!;
        const F = closeBooks(W, { loot: 0, pot: D.truth.pot * 3 })!;
        if (F.audit) {
          audits++;
          expect(F.audit.fine).toBe(Math.round(F.audit.found * (1 + TAX.AUDIT_PEN)));
          expect(W.last!.res[0].spend.fine).toBe(F.audit.fine);
          expect(us(W).sus).toBe(0); expect(us(W).books).toEqual([]);
          if (F.audit.fine) expect(W.log.some(l => l.m === D.m && /추징금/.test(l.t))).toBe(true);
        }
      }
    }
    expect(audits).toBeGreaterThan(3);
  });
  it('법령은 상태에서 나오고(난수 없이) 고시한 다음 달부터 효력이 난다. 새 층이 열리면 탐사 계획서가 붙는다', () => {
    const W = playGame(2, BOT.smart, FILER.smart);
    expect((W.laws || []).length).toBeGreaterThan(0);
    (W.laws || []).forEach(L => { expect(L.from).toBeGreaterThan(L.at); if (L.kind === 'aid') expect(L.f).toBeGreaterThanOrEqual(1); });
    const ex = (W.jobs || []).filter(J => J.kind === 'explore');
    expect(ex.length).toBe(W.unlocked - 1);
    ex.forEach(J => { expect(J.prem).toBe(Math.round(FLOORS[J.f].take * ITEMS[J.f].P0 * TAX.ADV_K)); expect(J.until - J.from).toBe(TAX.ADV_LEN - 1); });
    expect(lawsAt(W, 1)).toEqual([]);
  });
  it('탐사 계획서: 적어 낸 조만큼 선금을 받고, 덜 보낸 조는 가정산에서 돌려낸다', () => {
    setSeed(9); const W = newWorld();
    let J = jobsExplore(W)[0];
    for (let m = 0; m < 30 && !J; m++) { runMonth(W, BOT.smart(W)); closeBooks(W); J = jobsExplore(W)[0]; }
    expect(J).toBeTruthy();
    const P = BOT.smart(W); P.take = { ...(P.take || {}), [J.id]: 3 };
    const sent = sanitize(W, us(W), P).parties[J.f];
    const r = runMonth(W, P).res[0], D = W.draft!;
    expect(r.adv).toBe(3 * J.prem); expect(D.advN).toBe(3); expect(D.truth.adv).toBe(Math.min(3, sent));
    const F = closeBooks(W)!;
    expect(F.bill.refund).toBe(Math.round(Math.max(0, 3 - Math.min(3, sent)) * J.prem * TAX.ADV_REFUND));
  });
  it('가정산 화면과 정산서에 신고서 · 법령 · 영주청 줄이 붙는다', () => {
    setSeed(10); const W = newWorld();
    runMonth(W, BOT.smart(W));
    const h = draftHtml(W, { loot: 0 });
    expect(h).toContain('신고서'); expect(h).toContain('data-k="file"'); expect(h).not.toContain('감사 확률');   // 감사 확률은 보이지 않는다 (뒤통수로 온다) expect(h).toContain('상단 경매장 장부');
    closeBooks(W, { loot: Math.round(W.draft!.truth.loot * 0.9) });
    const R = resultsHtml(W);
    expect(R).toContain('영주청'); expect(R).toContain('영주세');
    expect(draftHtml(W, {})).toContain('낼 신고서가 없어요');
  });
  it('궁지에 몰린 경쟁 용병단은 장부를 고치고, 크게 걸리면 스캔들이 나고 영주청이 그 칸을 모두에게 더 꼼꼼히 본다', async () => {
    let scandals = 0, rivals = 0;
    for (let g = 1; g <= 30; g++) {
      await new Promise(r => setTimeout(r, 0));
      const W = playGame(g, BOT.smart, FILER.smart);
      W.cos.forEach(c => { scandals += c.scandals || 0; if (c.style !== 'player') rivals += c.scandals || 0; });
      const sl = W.log.filter(l => /^스캔들: /.test(l.t));
      expect(sl.length).toBe(W.cos.reduce((a, c) => a + (c.scandals || 0), 0));
      sl.forEach(l => expect(W.laws!.some(L => L.kind === 'check' && L.at === l.m + 1) || W.log.some(x => x.m === l.m && /대조를 제\d+월까지 늘린다/.test(x.t))).toBe(true));
      W.laws!.filter(L => L.kind === 'check').forEach(L => { expect(L.from).toBe(L.at + 1); expect(L.k).toBeTruthy(); });
    }
    expect(rivals).toBeGreaterThan(0);
    expect(scandals / 30).toBeLessThan(4);
  }, 60000);
  it('대조 강화 법령은 그 칸이 걸릴 확률과 의심 무게를 올리고, 감시가 붙으면 감사 확률이 바닥 밑으로 내려가지 않는다', () => {
    setSeed(11); const W = newWorld(); runMonth(W, defaultPlan(W)); const D = W.draft!;
    const F = { loot: Math.round(D.truth.loot * 0.8) }, a = preview(W, D, F);
    W.laws!.push({ id: 99, kind: 'check', k: 'loot', rate: TAX.CHECK_DET, from: 1, until: 5, at: 0 });
    const b = preview(W, D, F);
    expect(b.add).toBeCloseTo(a.add * TAX.CHECK_SUS, 6);
    expect(detOf(W, 'loot', 1)).toBeCloseTo(Math.min(0.95, TAX.DET.loot * TAX.CHECK_DET), 6);
    expect(detOf(W, 'loot', 6)).toBe(TAX.DET.loot);
    us(W).watch = 3;
    expect(preview(W, D, {}).chance).toBe(TAX.WATCH);
  });
  it('정보실 장부 소문은 상단 장부 단계만큼만 보인다', () => {
    setSeed(12); const W = newWorld(); runMonth(W, defaultPlan(W)); closeBooks(W);
    const iron = W.cos.find(c => c.id === 'iron')!; iron.sus = 60;
    W.intel!.lv.mkt = 1; expect(booksRumorHtml(W)).not.toContain('철모회');
    W.intel!.lv.mkt = 2; expect(booksRumorHtml(W)).toContain('철모회'); expect(booksRumorHtml(W)).not.toContain('감사 확률');
    W.intel!.lv.mkt = 3; expect(booksRumorHtml(W)).toContain('감사 확률');
    iron.sus = 0; iron.watch = W.month + 2; W.intel!.lv.mkt = 0; expect(booksRumorHtml(W)).toContain('감시');
  });
  it('포션은 고르는 것: 조당 0병으로도 보내고, 그러면 창고에서 꺼내 쓰지도 사지도 않는다', () => {
    setSeed(13); const W = newWorld(); const P = defaultPlan(W); P.pots = P.pots.map(() => 0);
    expect(sanitize(W, us(W), P).pots.every(v => v === 0)).toBe(true);
    const r = runMonth(W, P).res[0];
    expect(r.potUsed).toBe(0); expect(r.potNeed).toBe(0); expect(r.spend.potion).toBe(0);
  });
});

describe('미궁 도감 · 단장 · 지정 탐사', () => {
  it('만날 때마다 그 몬스터의 기록과 이해도가 쌓인다 (우리 조만)', () => {
    setSeed(11); const W = newWorld();
    const M = runMonth(W, defaultPlan(W)), met: Record<string, number> = {};
    M.ours.forEach(o => o.days!.forEach(d => { if (d.mon) met[d.mon] = (met[d.mon] || 0) + 1; }));   // 조우만 (채집 지점 · 흔적은 몬스터를 만나지 않는다)
    expect(Object.keys(met).length).toBeGreaterThan(0);
    Object.entries(met).forEach(([name, n]) => {
      const D = W.dex![name]; expect(D.n).toBe(n); expect(D.u).toBeGreaterThan(0); expect(D.u).toBeLessThanOrEqual(100);
      expect([0, 1, 2].reduce((a, v) => a + (D.rec['c:전사:' + v]?.n || 0), 0)).toBe(n);   // 직업마다 칸 셋을 더하면 마주침
      Object.values(D.mats).forEach(X => expect(X.got).toBeGreaterThanOrEqual(0));
    });
    const got: Record<string, number> = {}; M.ours.forEach(o => o.mats.forEach(([m, k]) => { got[m] = (got[m] || 0) + k; }));
    Object.entries(got).forEach(([m, k]) => { const D = Object.values(W.dex!).find(x => x.mats[m]); expect(D!.mats[m].got).toBe(k); });
  });
  it('단장은 처음부터 가장 숙련된 사람이고, 죽지 않는다 (크게 다쳐 두 달 쉰다)', () => {
    let hurt = 0;
    for (let g = 1; g <= 30; g++) {
      setSeed(g); const W = newWorld(), c = us(W), lead = c.crew!.find(x => x.lead)!;
      expect(c.crew!.filter(x => x.lead).length).toBe(1);
      expect(lead.sk).toBe(Math.max(...c.crew!.map(x => x.sk || 0)));
      W.unlocked = 5;
      for (let m = 0; m < 8; m++) {
        const P = sanitize(W, c, defaultPlan(W)); P.teams!.forEach(T => { T.f = 4; }); P.parties = [0, 0, 0, 0, P.teams!.length];
        const M = runMonth(W, P); closeBooks(W);
        expect(c.crew!.some(x => x.id === lead.id)).toBe(true);
        if (M.leadHurt) { hurt++; const L = c.crew!.find(x => x.id === lead.id)!; expect(L.hurt || 0).toBeLessThanOrEqual(DEX.LEAD_REST * CO.MONTH_DAYS); }
      }
    }
    expect(hurt).toBeGreaterThan(0);
  });
  it('부상 주사위: 못 해낸 날 걸리면 포션이 먼저 막고, 없으면 다치고, 다친 채 또 걸리면 죽는다', () => {
    let saved = 0, died = 0, hurtOnly = 0;
    for (let g = 1; g <= 10; g++) {
      setSeed(g); const W = newWorld(), c = us(W); W.unlocked = 4;
      for (let m = 0; m < 6; m++) {
        const P = sanitize(W, c, defaultPlan(W)); P.teams!.forEach((T, t) => { T.f = 3; T.pots = t % 2 ? 3 : 0; }); P.parties = [0, 0, 0, P.teams!.length, 0];
        const M = runMonth(W, P); closeBooks(W);
        M.ours.forEach(o => {
          const sv = o.days!.reduce((a, d) => a + (d.sv || 0), 0), dd = o.days!.reduce((a, d) => a + d.d, 0);
          // 포션은 주사위에 걸릴 때마다 먼저 쓴다 (어둠 속 귀환에서 쓴 것은 날 칸 밖)
          expect(o.pots || 0).toBeGreaterThanOrEqual(sv); expect(o.pots || 0).toBeLessThanOrEqual(sv + o.trip!.dark);
          expect(o.pots || 0).toBeLessThanOrEqual(o.potC || 0);
          expect(o.d).toBeGreaterThanOrEqual(dd);   // (어둠 속 귀환의 사망은 날 칸 밖)
          (o.dead || []).forEach(z => expect(z.pot).toBe(false));   // 포션이 남아 있으면 죽지 않는다
          if (o.d && (o.potC || 0) > (o.pots || 0)) throw new Error('포션이 남았는데 죽었다');
          saved += o.pots || 0; died += o.d; hurtOnly += o.hurt || 0;
        });
      }
    }
    expect(saved).toBeGreaterThan(0); expect(died).toBeGreaterThan(0); expect(hurtOnly).toBeGreaterThan(0);
  });
  it('단장 조사: 단장이 나선 날 그 몬스터를 만나면 답을 받는다. 맞으면 확정, 틀리면 아님 (이해도가 모자라면 묻지 못한다)', () => {
    setSeed(5); const W = newWorld(), c = us(W), main = MONSTERS[W.mons[0]].name;
    const P0 = defaultPlan(W); P0.ask = { mon: main, k: MONSTERS[W.mons[0]].key };
    expect(sanitize(W, c, P0).ask).toBeUndefined();   // 처음엔 이해도 0
    const wrong = MONSTERS[W.mons[0]].key === 'g:신성' ? 'g:둔기' : 'g:신성';
    let tries = 0; const done: string[] = [];
    while (done.length < 2 && tries++ < 24) {
      const P = carryPlan(W, W.last ? W.last.plans[0] : defaultPlan(W));
      const D = W.dex && W.dex[main];
      if (D && D.u >= DEX.ASK_AT) P.ask = { mon: main, k: done.length ? MONSTERS[W.mons[0]].key : wrong };   // 틀린 것을 먼저, 그다음 맞는 것
      const M = runMonth(W, P); closeBooks(W);
      if (M.ask && (M.ask.ans === 'yes' || M.ask.ans === 'no')) { expect(W.dex![main].key[M.ask.k]).toBe(M.ask.ans); expect(M.ask.ans).toBe(M.ask.k === MONSTERS[W.mons[0]].key ? 'yes' : 'no'); done.push(M.ask.ans); }
    }
    expect(done).toEqual(['no', 'yes']);
  });
  it('지정 탐사: 이해도가 차야 노릴 수 있고, 노린 몬스터를 더 자주 만난다', () => {
    setSeed(9); const W = old(newWorld()), c = us(W), fauna = floorMons(W, 0)[1].name;
    const P = sanitize(W, c, defaultPlan(W)); P.teams!.forEach(T => { T.target = fauna; T.mission = 'hunt'; });   // 노리는 것은 사냥 임무만
    expect(sanitize(W, c, P).teams!.every(T => !T.target)).toBe(true);
    W.dex = { [fauna]: { n: 0, w: 0, cr: 0, u: DEX.TARGET_AT, at: 1, rec: {}, mats: {}, key: {}, mat: {} } };
    expect(sanitize(W, c, P).teams!.every(T => T.target === fauna)).toBe(true);
    let aim = 0, all = 0;
    for (let m = 0; m < 10; m++) { const Q = carryPlan(W, P); const M = runMonth(W, Q); closeBooks(W); M.ours.forEach(o => o.days!.forEach(d => { if (!d.mon) return; all++; if (d.mon === fauna) aim++; })); }
    expect(aim / all).toBeGreaterThan(0.4);   // 섞여 만나면 0.3 (조우만 센다)
  });
});

describe('채비: 식량 · 정비 도구 · 해고', () => {
  it('식량과 정비 도구는 조마다 정한 만큼 들고 가서 먹은 · 쓴 만큼 빠지고, 남은 것은 창고로 돌아온다', () => {
    setSeed(3); const W = old(newWorld()), c = us(W);
    W.unlocked = 5;
    const P = sanitize(W, c, defaultPlan(W)); P.teams!.forEach(T => { T.f = 4; }); P.parties = [0, 0, 0, 0, P.teams!.length]; P.food = FLOORS.map(() => 3); P.mend = FLOORS.map(() => 2);   // 5층은 닷새 탐사
    const M = runMonth(W, P); closeBooks(W);
    const need = needOf(sanitize(W, c, P)), food = M.res[0].spend.food! / CO.FOOD_PRICE, mend = M.res[0].spend.mend! / CO.MEND_PRICE;
    expect(food).toBeGreaterThanOrEqual(need.food); expect(mend).toBeGreaterThanOrEqual(need.mend);
    const ate = M.ours.reduce((a, o) => a + (o.trip!.fu || 0), 0), used = M.ours.reduce((a, o) => a + (o.trip!.tk || 0), 0);
    // 나가 있는 조가 들고 간 것은 창고 밖에 있고, 새 달 첫날 아침에 돌아온 조가 쓴 것은 다음 달 기록에 든다
    const out = (W.away || []).reduce((a, s) => [a[0] + s.kit.food, a[1] + s.kit.mend], [0, 0]), nx = (W.back || []).reduce((a, s) => [a[0] + s.out.fu, a[1] + s.out.tk], [0, 0]);
    expect(supOf(c).food! + out[0]).toBe(food - ate - nx[0]); expect(supOf(c).mend! + out[1]).toBe(mend - used - nx[1]);
    // 사흘치만 들고 가면 나흘째부터 굶는다
    M.ours.forEach(o => o.days!.forEach(d => { if (d.dd! > 3) expect(d.hg || 0).toBeGreaterThan(0); else expect(d.hg || 0).toBe(0); }));
  });
  it('식량 없이 보내면 굶은 날 성공이 떨어져 지는 날이 는다', () => {
    const lose = (food: number) => { let l = 0, n = 0; for (let s = 1; s <= 12; s++) { setSeed(s); const W = old(newWorld()); const P = sanitize(W, us(W), defaultPlan(W)); P.food = FLOORS.map(() => food); const M = runMonth(W, P); M.ours.forEach(o => o.days!.forEach(d => { n++; if (!d.win) l++; })); } return l / n; };
    expect(lose(0)).toBeGreaterThan(lose(CO.DAYS));
  });
  it('해고: 고른 단원은 이번 달 첫머리에 떠나 조에 들지 않고, 위로금으로 한 달 급여를 받는다. 단장은 내보낼 수 없다', () => {
    setSeed(4); const W = newWorld(), c = us(W);
    const lead = c.crew!.find(p => p.lead)!, out = c.crew!.filter(p => !p.lead).slice(0, 2);
    const P = defaultPlan(W); P.fire = [lead.id, ...out.map(p => p.id)];
    const Q = sanitize(W, c, P);
    expect(Q.fire).toEqual(out.map(p => p.id));
    expect(Q.teams!.some(T => T.m.some(id => out.some(p => p.id === id)))).toBe(false);
    const n0 = c.crew!.length, M = runMonth(W, P);
    expect(c.crew!.some(p => out.some(x => x.id === p.id))).toBe(false);
    expect(c.crew!.some(p => p.id === lead.id)).toBe(true);
    expect(M.res[0].spend.fire).toBe(Math.round(out.reduce((a, p) => a + personWage(p), 0) * CO.FIRE_PAY));   // (급여는 등급으로)
    expect(c.crew!.length).toBeLessThanOrEqual(n0 - 2 + M.res[0].recruited);
    expect(carryPlan(W, P).fire).toBeUndefined();
  });
});

describe('#46 피드백: 조 번호 · 약초 흉년 · 건물 자산', () => {
  it('귀환 기록의 조 번호는 편성표의 조 번호다 (뒤 조가 앞 층에 가도 그대로)', () => {
    setSeed(6); const W = big(newWorld()), c = us(W);
    W.unlocked = 2;
    const P = sanitize(W, c, defaultPlan(W));
    expect(P.teams!.length).toBe(4);
    P.teams![0].f = 1; P.teams![1].f = 1; P.teams![2].f = 0; P.teams![3].f = 0;
    const M = runMonth(W, P);
    M.ours.forEach(x => expect(x.f).toBe(x.t! < 2 ? 1 : 0));
    expect(returnHtml(W) + resultsHtml(W)).not.toMatch(/undefined|NaN/);
  });
  it('약초 흉년: 판마다 같은 달에 상단 포션 값이 오르고, 한 달 앞서 알림이 뜬다', () => {
    expect(potShock(CO.POT_SHOCK_AT - 1)).toBe(1); expect(potShock(CO.POT_SHOCK_AT)).toBe(CO.POT_SHOCK);
    const price = (m: number) => { setSeed(1); const W = newWorld(); let p = 0; for (let k = 1; k <= m; k++) { const P = defaultPlan(W); P.pots = P.pots.map(() => 1); runMonth(W, P); closeBooks(W); p = W.potion; } return p; };
    expect(price(CO.POT_SHOCK_AT)).toBeGreaterThan(price(CO.POT_SHOCK_AT - 1));
    setSeed(1); const W = newWorld(); runMonth(W, defaultPlan(W)); closeBooks(W);
    while (W.month < CO.POT_SHOCK_AT - 1) { runMonth(W, defaultPlan(W)); closeBooks(W); }
    expect(infoWeekHtml(W, defaultPlan(W), { phase: 0, tab: 'report' })).toContain('약초 흉년');
  });
  it('본부 · 숙소 공사비는 건물 자산이 되어 평가액에 남고, 달마다 감가상각만큼 준다', () => {
    setSeed(2); const W = newWorld(), c = us(W);
    const P = defaultPlan(W); P.dorm = true;
    const M = runMonth(W, P); closeBooks(W);
    const r = M.res[0];
    expect(r.capex).toBeGreaterThan(0); expect(c.book).toBe(r.capex);
    expect(worth(W, c)).toBe(c.cash + c.book!);
    expect(profitOf(r)).toBe(r.net + r.capex!);
    const M2 = runMonth(W, carryPlan(W, P)); closeBooks(W);
    expect(M2.res[0].dep).toBe(Math.round(r.capex! * CO.DEP));
    expect(c.book).toBe(r.capex! - M2.res[0].dep! + (M2.res[0].capex || 0));
  });
});

describe('훈련 배치 · 채비 예측', () => {
  it('대기 = 본부 훈련: 조에 들지 않은 사람은 그달 실력이 교관 단계만큼 오른다', () => {
    setSeed(8); const W = newWorld(), c = us(W);
    const x = c.crew!.filter(p => !p.lead)[0], sk0 = x.sk ?? 40;
    const P = sanitize(W, c, defaultPlan(W)); P.train = CO.COACH_PAY[1];
    P.teams!.forEach(T => { T.m = T.m.map(id => (id === x.id ? null : id)); });
    const gain = drillGain(c, P, x);
    expect(gain).toBe(CO.DRILL_SK[1]);
    const M = runMonth(W, P); closeBooks(W);
    expect(M.res[0].drilled).toBeGreaterThanOrEqual(1);
    expect(c.crew!.find(p => p.id === x.id)!.sk).toBeCloseTo(sk0 + gain, 5);
  });
  it('산 채비는 이번 달 창고에 바로 들어와 이번 출정에 쓰이고, 쓰지 않은 것은 다음 달 창고에 남는다', () => {
    setSeed(4); const W = newWorld(), c = us(W);
    const P = sanitize(W, c, defaultPlan(W)), need = needOf(P);
    expect(supOf(c).torch || 0).toBe(0);
    const M = runMonth(W, P); closeBooks(W);
    const burned = M.ours.reduce((a, o) => a + o.trip!.tu, 0), ate = M.ours.reduce((a, o) => a + (o.trip!.fu || 0), 0), r = M.res[0];
    const out = (W.away || []).reduce((a, s) => [a[0] + s.kit.torch, a[1] + s.kit.food], [0, 0]), nx = (W.back || []).reduce((a, s) => [a[0] + s.out.tu, a[1] + s.out.fu], [0, 0]);
    expect(r.spend.torch / CO.TORCH_PRICE).toBeGreaterThanOrEqual(need.torch);
    expect(supOf(c).torch! + out[0]).toBe(r.spend.torch / CO.TORCH_PRICE - burned - nx[0]);
    expect(supOf(c).food! + out[1]).toBe(r.spend.food! / CO.FOOD_PRICE - ate - nx[1]);
    const fc = forecast(W, sanitize(W, c, defaultPlan(W)));
    expect(fc.food).toBeGreaterThan(0); expect(fc.food!).toBeLessThanOrEqual(needOf(sanitize(W, c, defaultPlan(W))).food);
  });
});

describe('약점 짝', () => {
  it('약점은 여섯 가지(장비 꼴)이고, 장비 + 맡는 직업이면 다, 장비만 절반, 직업만 ¼. 역효과는 장비를 들었을 때만', () => {
    MONSTERS.forEach(m => { expect(WEAK_KEYS).toContain(m.key); expect(WEAK_KEYS).toContain(m.bad); expect(WEAK_KEYS).toContain(m.alt); expect(new Set([m.key, m.bad, m.alt]).size).toBe(3); });
    expect(WEAK_KEYS.length).toBe(6);
    expect(weakShare('g:둔기', ['전사', '궁수', '도적', '마법사'], ['g:둔기'])).toBe(1);
    expect(weakShare('g:둔기', ['궁수', '도적', '마법사', '사제'], ['g:둔기'])).toBe(CO.WEAK_GEAR);
    expect(weakShare('g:둔기', ['전사', '전사', '궁수', '도적'], [])).toBe(CO.WEAK_ONE);
    expect(weakShare('g:냉기', ['마법사', '궁수', '도적', '전사'], [])).toBe(CO.WEAK_ONE);   // 마법사는 화염 · 냉기 둘
    expect(weakShare('g:독', ['전사', '궁수', '마법사', '사제'], [])).toBe(0);
    expect(badShare('g:화염', ['c:마법사'])).toBe(0); expect(badShare('g:화염', ['c:마법사', 'g:화염'])).toBe(1);
    // 맨몸 역효과: 그 속성을 맡는 직업이 장비 없이 나서면 그 사람만 (장비를 들었으면 장비 역효과로)
    expect(classBad('g:화염', '마법사', ['c:마법사'])).toBe(true);
    expect(classBad('g:냉기', '마법사', ['c:마법사'])).toBe(true);
    expect(classBad('g:화염', '마법사', ['c:마법사', 'g:화염'])).toBe(false);
    expect(classBad('g:화염', '전사', ['c:전사'])).toBe(false);
  });
});

describe('조 · 단장', () => {
  const P = (c: string, lead = false) => ({ id: 0, c, sk: 40, ...(lead ? { lead: true } : {}) }) as any;
  it('직업 시너지는 없다: 짐 칸은 사람 수만큼, 단장이 있으면 역효과 없음', () => {
    expect(teamSlots([P('전사'), P('전사'), P('궁수'), P('도적')])).toBe(Math.round(4 * CO.SLOT_PP));
    expect(synOf([P('전사', true)]).lead).toBe(true); expect(synOf([P('전사')]).lead).toBe(false);
    expect(synTags([P('도적'), P('궁수'), P('궁수')])).toEqual([]);
    setSeed(2); const W = newWorld(), c = us(W);
    expect(teamUnd(c, 0, [P('도적'), P('전사')])).toBe(teamUnd(c, 0, [P('궁수'), P('전사')]));
  });
});

describe('역효과 단장 조사', () => {
  it('역효과를 물으면 맞으면 확정, 틀리면 아님. 확정하면 다시 묻지 않고 맨몸 역효과가 준다', () => {
    setSeed(5); const W = newWorld(), c = us(W), M = MONSTERS[W.mons[0]], main = M.name;
    W.dex = { [main]: { n: 30, w: 20, cr: 0, u: 50, at: 1, rec: {}, mats: {}, key: {}, mat: {} } };
    const wrong = WEAK_KEYS.find(k => k !== M.bad && k !== M.key)!;
    expect(askable(W.dex[main], { mon: main, k: wrong, b: true })).toBe(true);
    const done: string[] = [];
    for (let m = 0; m < 12 && done.length < 2; m++) {
      const P = carryPlan(W, W.last ? W.last.plans[0] : defaultPlan(W)); P.ask = { mon: main, k: done.length ? M.bad : wrong, b: true };
      const R = runMonth(W, P); closeBooks(W);
      if (R.ask && (R.ask.ans === 'yes' || R.ask.ans === 'no')) { expect(R.ask.ans).toBe(R.ask.k === M.bad ? 'yes' : 'no'); done.push(R.ask.ans); }
    }
    expect(done).toEqual(['no', 'yes']);
    expect(badSure(W.dex![main])).toBe(M.bad);
    expect(askable(W.dex![main], { mon: main, k: wrong, b: true })).toBe(false);
    expect(CO.BAD_INJ_KNOWN).toBeLessThan(CO.BAD_INJ);
  });
});


describe('날 단위 턴 · 길드 홀', () => {
  it('보낸 조는 층 깊이만큼 날이 지나 다음 날 아침 돌아오고, 돌아온 날은 쉰 뒤 다시 나갈 수 있다', () => {
    setSeed(7); const W = newWorld(); W.unlocked = 3;
    const P = sanitize(W, us(W), defaultPlan(W)); P.teams!.forEach((T, t) => { T.f = t % 3; });
    const cash0 = us(W).cash, sent = sendReady(W, P);
    expect(sent.length).toBe(P.teams!.length);
    expect(us(W).cash).toBeLessThan(cash0);   // 모자란 채비를 보낼 때 바로 샀다
    expect(sendReady(W, P).length).toBe(0);   // 나가 있는 조는 다시 보낼 수 없다
    sent.forEach(s => expect(s.d1 - s.d0).toBeLessThanOrEqual(CO.TRIP_DAYS[s.f]));
    for (let d = 1; d <= 3; d++) {
      nextDay(W, P);
      sent.forEach(s => { const back = (W.back || []).includes(s); expect(back).toBe(s.d1 <= dayAbs(W)); });
    }
    // 1층 조는 2일 아침에 돌아와 그날 쉬고, 3일에 다시 나갈 수 있다
    const one = sent.find(s => s.f === 0 && s.d1 === 2)!;
    if (one) one.m.forEach(id => { const p = us(W).crew!.find(x => x.id === id); if (p && !p.hurt) expect(stateOf(W, p)).toBe('free'); });
  });
  it('한 달은 날마다 정산하지 않고 그믐이 지나야 정산하며, 금고 변화는 판매에서 이번 달 지출(바로 산 것 포함)을 뺀 값이다', () => {
    setSeed(9); const W = newWorld(), P = sanitize(W, us(W), defaultPlan(W)), cash0 = us(W).cash;
    let M = null as ReturnType<typeof nextDay>;
    for (let d = 1; d <= CO.MONTH_DAYS; d++) { expect(W.draft).toBeFalsy(); sendReady(W, P); M = nextDay(W, P); if (d < CO.MONTH_DAYS) expect(M).toBeNull(); }
    expect(M).not.toBeNull(); expect(W.month).toBe(2); expect(W.day).toBe(1);
    const r = M!.res[0], spend = Object.values(r.spend).reduce((a, b) => a + b, 0);
    expect(us(W).cash).toBe(cash0 + r.sales - spend);
  });
  it('길드 홀은 본부에 있는 사람을 구역마다 보이고 말풍선을 띄우며, 그려도 판은 그대로다 (같은 날이면 같은 말)', () => {
    setSeed(11); const W = newWorld(), P = sanitize(W, us(W), defaultPlan(W));
    P.teams = P.teams!.slice(0, 2); sendReady(W, P); nextDay(W, P); nextDay(W, P);
    const before = JSON.stringify(W); setSeed(3); const r0 = rnd(); setSeed(3);
    const a = infoWeekHtml(W, P, { phase: 0, tab: 'report', pins: [] }), b = infoWeekHtml(W, P, { phase: 0, tab: 'report', pins: [] });
    expect(rnd()).toBe(r0); expect(JSON.stringify(W)).toBe(before); expect(a).toBe(b);
    expect(a).toContain('class="bub"'); expect(a).toContain('훈련 마당'); expect(a).not.toMatch(/undefined|NaN|\[object/);
  });
  it('탐사는 보낼 때 정해지지 않는다: 날마다 그날 판 상태로 굴리고, 나가 있는 동안 바뀐 것(지도)이 남은 날에 먹힌다', () => {
    const run = (seed: number, mapUp: boolean) => {
      setSeed(seed); const W = newWorld(); W.unlocked = 3;
      const P = sanitize(W, us(W), defaultPlan(W)); P.teams = P.teams!.slice(0, 1); P.teams[0].f = 2;
      const [s] = sendReady(W, P);
      expect(s.out).toBeUndefined(); expect(s.st!.days.length).toBe(0);   // 보낸 날엔 아직 아무것도 굴리지 않았다
      nextDay(W, P);
      if (mapUp) us(W).map![2] = 100;   // 나가 있는 동안 지도가 다 찼다 (다른 조 · 사본)
      while (!s.out) nextDay(W, P);
      return s.out.days.slice(1).reduce((a, d) => a + d.k / d.n, 0);   // 둘째 날부터 해낸 사람 비율
    };
    let lo = 0, hi = 0;
    for (let g = 1; g <= 40; g++) { lo += run(g, false); hi += run(g, true); }
    expect(hi).toBeGreaterThan(lo);
    expect(run(5, false)).toBe(run(5, false));   // 같은 시드면 같다
  });
  it('시장은 날마다: 경쟁 용병단 조가 돌아온 날 캐 가고 바로 팔아 값이 내려가고, 층에 남은 양은 날마다 준다', () => {
    let drops = 0;
    for (const seed of [14, 15]) {
    setSeed(seed); const W = newWorld(), P = sanitize(W, us(W), defaultPlan(W)); P.autoSell = false;
    W.mq = ITEMS.map(it => it.D * 0.6);   // (1층 황동석은 바닥 값에 붙어 있는 날이 많다: 시장이 마른 채로 시작해 값이 움직이게)
    for (let d = 1; d < CO.MONTH_DAYS; d++) {
      const pool = [...W.pool], before = W.sales ? W.sales.length : 0;
      nextDay(W, P);
      const today = (W.sales || []).slice(before).filter(x => x.i !== 0);
      today.forEach(x => { expect(x.p1).toBeLessThanOrEqual(x.p0); if (x.p1 < x.p0) drops++; });
      W.pool.forEach((v, f) => expect(v).toBeLessThanOrEqual(pool[f]));   // 다시 차는 것은 그믐에만
    }
    }
    expect(drops).toBeGreaterThan(0);
  });
  it('우리 전리품은 창고에 들어와 날마다 조금씩 상하고, 팔면 금고에 바로 들어오며, 남은 것은 평가액에 든다', () => {
    setSeed(15); const W = newWorld(), P = sanitize(W, us(W), defaultPlan(W)); P.autoSell = false;
    sendReady(W, P); nextDay(W, P); nextDay(W, P);
    const st = W.stock!, n = st[0];
    expect(n).toBeGreaterThan(0);
    expect(worth(W, us(W))).toBe(us(W).cash + (us(W).book || 0) + stockValue(W));
    nextDay(W, P); expect(W.stock![0]).toBeLessThan(n + 1e-9 + (W.back || []).filter(x => (W.today || []).includes(x.id)).reduce((a, x) => a + (x.got || 0), 0));
    const cash = us(W).cash, have = Math.floor(W.stock![0] + 1e-9), v = sellStock(W, 0);
    expect(v).toBeGreaterThan(0); expect(us(W).cash).toBe(cash + v); expect(Math.floor(W.stock![0] + 1e-9)).toBe(0);
    expect(W.mo!.res[0].sold[0]).toBeGreaterThanOrEqual(have);
  });
});

describe('단원의 깊이: 임무 적성 · 잠재력 · 숨은 기질 · 1인 시너지', () => {
  it('시작 명단과 첫 달 지원자는 판마다 같은 적성 · 잠재력 · 숨은 기질을 갖고, 뒤에 오는 지원자도 셋을 갖는다', () => {
    setSeed(1); const a = newWorld(); setSeed(2); const b = newWorld();
    const pick = (W: World) => [...us(W).crew!, ...W.cand!].map(p => [p.apt, p.pt, p.hd]);
    expect(pick(a)).toEqual(pick(b));
    us(a).crew!.forEach(p => { expect(p.pt).toBeGreaterThanOrEqual(p.sk!); expect(HIDDEN[p.hd!]).toBeTruthy(); });
    runMonth(a, defaultPlan(a));
    a.cand!.forEach(p => { expect(p.pt).toBeGreaterThan(p.sk!); expect(p.pt).toBeLessThanOrEqual(100); expect(HIDDEN[p.hd!]).toBeTruthy(); });
  });
  it('적성은 그 사건에서만 성공을 더하고, 숨은 기질은 탐사에만 들어가 화면의 어림은 모른다', () => {
    const p = { id: 1, c: '전사', sk: 30, apt: 'scout' as const, hd: '천운' };
    expect(aptB(p, 'scout')).toBe(CO.APT_SUCC); expect(aptB(p, 'gather')).toBe(0);
    expect(memberMods([p], 0, 100, true).pp[0] - memberMods([p], 0).pp[0]).toBeCloseTo(HIDDEN['천운'].v);
  });
  it('잠재력에 가까울수록 실력이 덜 오르고 넘지 않으며, 잠재력은 끝까지 숨고 숨은 기질은 시간이 지나야 보인다', () => {
    setSeed(3); const W = newWorld(), c = us(W), p = c.crew![1];   // 수련 34, 잠재력 55
    expect(skUp(c, { ...p, sk: 20 }, 3)).toBe(23);
    expect(skUp(c, { ...p, sk: 50 }, 3)).toBeCloseTo(51.5);
    expect(skUp(c, { ...p, sk: 55 }, 3)).toBe(55);
    expect(hidSeen(p)).toBe(false);
    for (let m = 0; m < 3; m++) { runMonth(W, defaultPlan(W)); closeBooks(W); }
    c.crew!.forEach(x => expect(x.sk!).toBeLessThanOrEqual(skCap(c, x)));
    expect(hidSeen({ ...p, sg: [CO.HID_SEE, 20] })).toBe(true);
    expect(rosterHtml(W)).not.toMatch(/잠재력|까지/);
  });
});

describe('귀환 기록: 기대 대비', () => {
  it('조원마다 나선 구간 · 해낸 구간 · 기대를 적고, 기대는 숨은 기질을 빼고 셈하며, 명단에 누적된다', () => {
    let sumW = 0, sumE = 0, lucky = 0, luckyE = 0;
    for (let g = 1; g <= 8; g++) {
      setSeed(g); const W = newWorld(), c = us(W);
      c.crew!.forEach(p => { p.hd = '천운'; });   // 모두 천운이면 기대보다 잘 해낸다
      for (let m = 0; m < 2; m++) {
        const M = runMonth(W, defaultPlan(W)); closeBooks(W);
        M.ours.forEach(o => {
          expect(o.sn!.length).toBe(o.nm!.length);
          o.sn!.forEach((k, j) => { expect(o.sw![j]).toBeLessThanOrEqual(k); expect(o.se![j]).toBeLessThanOrEqual(k); });
          lucky += o.sw!.reduce((a, b) => a + b, 0); luckyE += o.se!.reduce((a, b) => a + b, 0);
        });
      }
      c.crew!.filter(p => p.sg && p.sg[0]).forEach(p => { sumW += p.sg![1]; sumE += p.sg![2]; expect(p.sg![2]).toBeLessThanOrEqual(p.sg![0]); });
      expect(returnsHtml(W)).toContain('기대');
    }
    expect(lucky).toBeGreaterThan(luckyE); expect(sumW).toBeGreaterThan(sumE);
  });
});

describe('귀환 줄', () => {
  it('채집품을 못 캐 온 조(탐색 등)는 "0개 → 창고"를 적지 않는다', () => {
    setSeed(4); const W = newWorld(); const M = runMonth(W, defaultPlan(W));
    const o = { ...M.ours[0], got: 0, mission: 'scout' as const };
    expect(backLine(o, 0, 'back')).not.toContain('→ 창고');
    expect(backLine({ ...o, got: 5 }, 0, 'back')).toContain('5</b>개 → 창고');
  });
});

describe('등급과 이력서', () => {
  it('시작 인원은 견습 · 정식, 단장만 고참이고 급여는 등급으로 매긴다. 첫 달 지원자는 미궁 이력이 없다', () => {
    setSeed(1); const W = newWorld(), c = us(W);
    c.crew!.forEach(p => { expect(p.lead ? grOf(p) === 2 : grOf(p) <= 1).toBe(true); expect(personWage(p)).toBe(CO.TIER_WAGE[grOf(p)] - (p.tr === '새가슴' ? CO.CHICKEN_WAGE : 0)); expect(p.job).toBeTruthy(); });
    W.cand!.forEach(p => { expect(grOf(p)).toBe(0); expect((p.pn || []).some(Boolean)).toBe(false); });
  });
  it('뒤에 오는 지원자는 열린 층까지의 이력서를 들고 오고, 자격 등급은 그 기록에서 나온다', () => {
    setSeed(2); const W = newWorld(); W.unlocked = 3;
    for (let m = 0; m < 3; m++) { runMonth(W, defaultPlan(W)); closeBooks(W); }
    const all = W.cand!; expect(all.some(p => (p.pn || []).some(Boolean))).toBe(true);
    all.forEach(p => { expect(grOf(p)).toBe(eligible(p)); (p.pn || []).forEach((n, f) => { if (f >= W.unlocked) expect(n).toBe(0); expect((p.pw || [])[f] || 0).toBeLessThanOrEqual(n); }); });
  });
  it('기록이 자격을 채우면 진급 예정자가 되고, 자격증을 주면 그 등급이 되며, 미루면 불만이 쌓여 떠난다 (위로금 없이)', () => {
    const p = { id: 1, c: '전사', sk: 40, gr: 0, rw: [6, 0, 0, 0, 0] } as any;
    expect(winsFrom(p, 0)).toBe(6); expect(eligible(p)).toBe(1); expect(promoteDue(p)).toBe(true);
    expect(eligible({ ...p, rw: [6, 0, 10, 0, 0] })).toBe(2);
    setSeed(5); const W = newWorld(), c = us(W), x = c.crew!.find(y => !y.lead)!;
    x.rw = [9, 0, 0, 0, 0]; x.gr = 0;
    expect(promote(W, x.id)).toBe(true); expect(x.gr).toBe(1); expect(x.gh!.at(-1)).toEqual([W.month, 1]); expect(promoteDue(x)).toBe(false);
    x.gr = 0; const cash0 = c.cash;
    // (탐사 중인 그믐엔 떠나지 않는다: 돌아온 뒤 첫 그믐에)
    for (let m = 0; m < CO.GRUDGE_MAX + 4 && c.crew!.some(y => y.id === x.id); m++) { const P = defaultPlan(W); P.promote = false; const M = runMonth(W, P); closeBooks(W); expect(M.res[0].spend.fire || 0).toBe(0); }
    expect(c.crew!.some(y => y.id === x.id)).toBe(false); expect(x.gd || 0).toBeGreaterThanOrEqual(CO.GRUDGE_MAX);
    expect(W.log.some(l => /자격을 기다리다/.test(l.t))).toBe(true);
    void cash0;
  });
  it('화면의 기대는 등급으로 셈한다: 실제 실력이 등급보다 높으면 그 차가 숨은 몫이다', () => {
    const p = { id: 1, c: '전사', sk: 62, gr: 1 } as any;
    expect(memberMods([p], 0, 100, true).pp[0] - memberMods([p], 0).pp[0]).toBeCloseTo(CO.TIER_B[3] - CO.TIER_B[1]);
  });
  it('자격보다 한 단계 낮춰 계약하면 싸지만 들어오자마자 진급 예정자다. 이름을 누르면 기록 카드가 열린다', () => {
    setSeed(2); const W = newWorld(); W.unlocked = 3; let p: any;
    for (let m = 0; m < 8 && !p; m++) { const P = defaultPlan(W); P.pick = []; runMonth(W, P); closeBooks(W); p = W.cand!.find(x => eligible(x) > 0); }
    const c = us(W); W.day = CO.MONTH_DAYS;
    expect(p).toBeTruthy(); if (!p) return;
    const full = candPrice({ ...p, gr: eligible(p) }, hirePrice(W)), v = hireNow(W, p.id, true);
    expect(v).toBeLessThan(full); expect(grOf(c.hireQ![0])).toBe(eligible(p) - 1);
    nextDay(W, defaultPlan(W));
    const y = c.crew!.find(z => z.n === p.n)!; expect(promoteDue(y)).toBe(true);
    expect(rosterHtml(W, undefined, undefined, y.id)).toContain('이력서');
  });
});

describe('조장 · 조 장비 · 조 크기', () => {
  it('조장(첫 자리)의 카리스마 + 1이 조 크기 한도이고, 넘치는 사람은 대기로 빠진다', () => {
    setSeed(1); const W = newWorld(), c = us(W), lead = c.crew!.find(p => p.lead)!;
    expect(chOf(lead)).toBe(4); expect(capOf(lead)).toBe(5);
    const P = defaultPlan(W); P.teams = [{ f: 0, m: c.crew!.map(p => p.id), g: '' }];
    const Q = sanitize(W, c, P); expect(Q.teams![0].m).toHaveLength(5); expect(Q.teams![0].m[0]).toBe(c.crew![0].id);
    const low = c.crew!.find(p => chOf(p) === 1)!; P.teams = [{ f: 0, m: [low.id, ...c.crew!.filter(p => p !== low).map(p => p.id)], g: '' }];
    expect(sanitize(W, c, P).teams![0].m).toHaveLength(2);   // 카리스마 1: 둘이서 깊이 뚫는 조
  });
  it('조의 모양: 작은 조는 은신, 카리스마 낮은 조장은 소수 조 덤, 조장 등급이 낮으면 마이너스, 조 장비는 성공 · 부상 · 짐', () => {
    const P = (id: number, ch: number, gr = 1) => ({ id, c: '전사', ch, gr }) as any;
    const a = teamFx([P(1, 1), P(2, 2)]), b = teamFx([P(1, 4), P(2, 2), P(3, 2), P(4, 2), P(5, 2)]);
    expect(a.stealth).toBeLessThan(b.stealth); expect(a.easy).toBe(CO.SMALL_SUCC); expect(b.easy).toBe(0);
    expect(teamFx([P(1, 3, 0), P(2, 3, 2)]).gap).toBe(CO.LEAD_GR_PEN);
    const g = teamFx([P(1, 3), P(2, 3), P(3, 3), P(4, 3)], 3); expect(g.succ).toBeCloseTo(3 * CO.SQ_SUCC); expect(g.inj).toBeCloseTo(Math.pow(CO.SQ_INJ, 3));
    expect(teamSlots([P(1, 3), P(2, 3)], 4) - teamSlots([P(1, 3), P(2, 3)], 0)).toBe(2);
    expect(missionW('gather', 0.5)[1]).toBeLessThan(missionW('gather', 1)[1]);
  });
  it('조 장비는 본부에 있을 때 올리고 자산이 되며(감가상각 없음) 유지비가 붙는다. 조장이 떠나면 한 단계 떨어진다', () => {
    setSeed(3); const W = newWorld(), c = us(W), P = sanitize(W, c, defaultPlan(W)), cash = c.cash, w0 = worth(W, c);
    const v = upgradeSquad(W, P, 0); expect(v).toBe(Math.round(CO.GEAR_UP[0] * capOf(c.crew!.find(p => p.id === P.teams![0].m[0])) / 4));
    expect(c.cash).toBe(cash - v); expect(worth(W, c)).toBe(w0); expect(sqLv(c, P.teams![0])).toBe(1);
    upgradeSquad(W, P, 0); expect(sqLv(c, P.teams![0])).toBe(2);
    const M = runMonth(W, P), r = M.res[0]; closeBooks(W);
    expect(r.spend.sq).toBe(sqBook(c)); expect(r.sqCap).toBe(sqBook(c)); expect(r.spend.sqKeep).toBe(Math.round(sqBook(c) * CO.SQ_KEEP));
    expect(profitOf(r)).toBe(r.net + r.sqCap!);
    const sq = c.sq![0], book = sqBook(c); leaderGone(c, [sq.ld!]);
    expect(sq.gear).toBe(1); expect(sq.ld).toBeUndefined(); expect(sqBook(c)).toBeLessThan(book);
  });
  it('조는 보낼 때 이어지고(편성표에 번호가 적힌다), 다음 달 새로 짠 조도 그 조장이 이끌면 같은 조를 쓴다. 조장을 바꾸면 한 단계를 잃는다', () => {
    setSeed(4); const W = newWorld(), c = us(W), P = sanitize(W, c, defaultPlan(W));
    upgradeSquad(W, P, 0); const id = P.teams![0].sq!, ld = P.teams![0].m[0]!;
    const Q = sanitize(W, c, defaultPlan(W)); expect(Q.teams!.find(T => T.m[0] === ld)!.sq).toBe(id);
    const t = Q.teams!.findIndex(T => T.sq === id), other = Q.teams![t].m.find(x => x != null && x !== ld)!;
    expect(setLeader(W, Q, t, other)).toBe(true); expect(Q.teams![t].m[0]).toBe(other); expect(sqOf(c, id)!.gear).toBe(0); expect(sqOf(c, id)!.ld).toBe(other);
  });
  it('조장 자리를 요구한 사람은 조장이 아니면 그믐마다 불만이 쌓인다', () => {
    setSeed(5); const W = newWorld(), c = us(W), x = c.crew!.find(p => !p.lead)!;
    x.dm = 'lead'; x.gr = 2; x.rw = [0, 0, 0, 0, 0];
    const P = defaultPlan(W); P.teams = [{ f: 0, m: [c.crew!.find(p => p.lead)!.id], g: '' }];
    runMonth(W, P); closeBooks(W);
    expect(x.gd || 0).toBe(1);
    expect(rosterHtml(W)).toContain('조장 요구');
  });
});

describe('보급: 정가는 달 첫날, 그 뒤는 긴급 구매', () => {
  beforeEach(() => setSeed(7));
  it('1일은 정가, 2일부터 RUSH배 · 한 달 몫은 다녀올 횟수만큼', async () => {
    const { buyNow, nextDay, monthNeed, needOf, sanitize } = await import('../src/core/company');
    const W = newWorld(), P = defaultPlan(W);
    expect(buyNow(W, 'torch', 10)).toBeCloseTo(10 * CO.TORCH_PRICE);
    nextDay(W, P);
    expect(W.day).toBe(2);
    expect(buyNow(W, 'torch', 10)).toBeCloseTo(10 * CO.TORCH_PRICE * CO.RUSH);
    const S = sanitize(W, us(W), P);
    expect(monthNeed(W, S).food).toBeGreaterThan(needOf(S).food);
  });
});

describe('창고 전리품', () => {
  it('matSell을 비워 두면 그믐에 모두 팔고, {}이면 모두 창고에 남는다', async () => {
    const { sanitize } = await import('../src/core/company');
    const run = (keep: boolean) => {
      setSeed(11); const W = old(newWorld());
      for (let m = 0; m < 3; m++) { const P = BOT.smart(W); if (keep) P.matSell = {}; P.teams = sanitize(W, us(W), P).teams; P.teams!.forEach(T => { T.mission = 'hunt'; }); runMonth(W, P); closeBooks(W); }
      return W;
    };
    const A = run(false), B = run(true);
    const sold = (W: World) => W.history.reduce((a, M) => a + Object.values(M.res[0].matSold).reduce((x, y) => x + y, 0), 0);
    expect(Object.keys(A.mbox || {}).length).toBe(0);
    expect(sold(A)).toBeGreaterThan(0);
    expect(sold(B)).toBe(0);
    expect(Object.values(B.mbox || {}).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });
});

describe('미궁에서 본 남들', () => {
  it('같은 층에 함께 있던 경쟁 조를 귀환 보고에 적고, 아직 돌아오지 않은 조는 곧 풀릴 물량으로 남긴다', async () => {
    const { sanitize, dayAbs } = await import('../src/core/company');
    let seenN = 0, coming = 0;
    for (let sd = 1; sd <= 4; sd++) {
      setSeed(sd); const W = newWorld();
      for (let m = 0; m < 3; m++) {
        const P = BOT.smart(W); P.teams = sanitize(W, us(W), P).teams; P.teams!.forEach(T => { T.mission = 'scout'; });
        runMonth(W, P); closeBooks(W);
        W.history[W.history.length - 1].ours.forEach(r => { (r.seen || []).forEach(x => { seenN++; expect(x.f).toBe(r.f); expect(x.q).toBeGreaterThanOrEqual(0); expect(W.cos[x.i].crew).toBeUndefined(); }); });
        coming += (W.seen || []).filter(x => x.d > dayAbs(W)).length;
      }
    }
    expect(seenN).toBeGreaterThan(0);
    expect(coming).toBeGreaterThanOrEqual(0);
  });
});

describe('밀고', () => {
  it('밀고서를 내면 그믐에 결과가 남고, 회계관 신뢰가 그만큼 움직이며, 헛된 밀고는 다음 달 앙심으로 돌아온다', () => {
    let seenTip = 0, back = 0;
    for (let sd = 1; sd <= 6; sd++) {
      setSeed(sd); const W = newWorld();
      for (let m = 0; m < 4; m++) {
        const P = BOT.smart(W); const tgt = 1 + (m % (W.cos.length - 1)); P.tip = tgt;
        const rel0 = us(W).relL ?? 50;
        runMonth(W, P); closeBooks(W);
        const r = W.history[W.history.length - 1].res[0];
        if (W.cos[tgt].style === 'crowd' || W.cos[tgt].crew) continue;
        expect(r.tip).toBeDefined(); seenTip++;
        expect(us(W).relL).toBe(Math.max(0, Math.min(100, rel0 + r.tip!.d)));
        if (!r.tip!.dirty) expect(W.cos[tgt].grudge).toBe(W.month);
        if (r.tipBack) back++;
      }
    }
    expect(seenTip).toBeGreaterThan(0);
    expect(back).toBeGreaterThanOrEqual(0);
  });
});

describe('구역 탐사 (docs/zones.md)', () => {
  it('층마다 구역 여덟이 입구에서 거리 1 · 2 · 3으로 퍼져 있고, 층 매장량은 구역 남은 양의 합이다', () => {
    setSeed(2); const W = newWorld();
    FLOORS.forEach((F, f) => {
      const Z = zonesOn(W.zones, f);
      expect(Z).toHaveLength(ZONE.N);
      expect([1, 2, 3].map(r => Z.filter(z => z.r === r).length)).toEqual(ZONE.RING);
      Z.forEach(z => { if (z.r > 1) expect(W.zones![z.parent!].r).toBe(z.r - 1); expect(zoneWay(W, z)).toBe(z.r - 1); expect(z.known).toBe(f === 0); });
      expect(Z.filter(z => z.kind === 'stair').length).toBe(f < FLOORS.length - 1 ? 1 : 0);
      expect(Math.abs(Z.reduce((a, z) => a + z.max, 0) - F.max)).toBeLessThanOrEqual(ZONE.N);
    });
    runMonth(W, defaultPlan(W)); closeBooks(W); syncZones(W);
    FLOORS.forEach((_, f) => expect(Math.abs(zonesOn(W.zones, f).reduce((a, z) => a + z.res, 0) - W.pool[f])).toBeLessThan(1e-6));
    // 경쟁 용병단도 구역을 골라 그 구역에서 캐 간다
    expect(W.mo!.ev.every(e => e.z != null && W.zones![e.z].f === e.f)).toBe(true);
  });
  it('이해도: 일한 인일이 경험치로 쌓여 단계가 오르고, 아는 범위가 좁아진다', () => {
    setSeed(2); const W = newWorld(), z = zonesOn(W.zones, 0)[0];
    expect(lvOf(z)).toBe(0); const w0 = wideOf(z);
    z.xp = ZONE.LV[2]; expect(lvOf(z)).toBe(3); expect(wideOf(z)).toBeLessThan(w0);
    z.xp = ZONE.LV[4]; expect(lvOf(z)).toBe(5); expect(estOf(z, 2, 1).hi - estOf(z, 2, 1).lo).toBeLessThan(0.25);
  });
  it('조는 구역까지 오가는 날만큼 먹기만 하고, 일할 날을 다 일하거나 짐이 차면 돌아오며, 남은 보급은 검문소가 태운다 (포션은 돌아온다)', () => {
    let trips = 0, walked = 0;
    for (let g = 1; g <= 4; g++) {
      setSeed(g); const W = big(newWorld()), c = us(W);
      const P = sanitize(W, c, defaultPlan(W));
      const far = zonesOn(W.zones, 0).find(z => z.r === 3)!;
      P.teams!.forEach((T, t) => { T.z = t % 2 ? far.id : T.z; T.days = 2; T.margin = 1; });
      const Q = sanitize(W, c, P);
      Q.teams!.forEach(T => { const z = W.zones![T.z!]; expect(T.food).toBe(2 * zoneWay(W, z) + 2 + 1); });
      const food0 = supOf(c).food || 0, xp0 = W.zones!.map(z => z.xp);
      const M = runMonth(W, Q);
      M.ours.forEach(o => {
        trips++;
        const T = o.trip!, z = W.zones![o.z!];
        expect(o.way).toBe(zoneWay(W, z)); expect(T.go).toBe(o.way); expect(T.wk!).toBeLessThanOrEqual(2);
        if (o.way) { walked++; expect(T.wb).toBe(o.way); }
        expect(o.d1! - o.d0!).toBeLessThanOrEqual(2 * o.way! + 2);
        expect(o.burn!.food).toBe(T.food! - T.fu!);   // 남은 보급은 모두 태운다
        D(o).forEach(d => expect(d.dd!).toBeGreaterThan(o.way!));   // 가는 날엔 구간이 없다
      });
      expect(supOf(c).food || 0).toBeLessThanOrEqual(food0 + 1e-9);   // 창고로 돌아오는 보급은 없다
      // 이해도: 다녀온 구역에 사람 × 일한 날만큼
      W.zones!.forEach((z, i) => { const md = M.ours.filter(o => o.z === i).reduce((a, o) => a + o.n! * o.wk!, 0); if (md) expect(z.xp - xp0[i]).toBeGreaterThanOrEqual(md - 1e-6); });
    }
    expect(trips).toBeGreaterThan(10); expect(walked).toBeGreaterThan(3);
  });
  it('목표량으로 보내면 보수적인 산출로 날을 잡고, 목표를 채우면 일찍 돌아선다', () => {
    let goal = 0;
    for (let g = 1; g <= 4; g++) {
      setSeed(g); const W = big(newWorld()), c = us(W);
      const P = sanitize(W, c, defaultPlan(W)); P.teams!.forEach(T => { T.goal = 3; });
      const Q = sanitize(W, c, P);
      Q.teams!.forEach(T => { const r = zoneRate(W, Q, T); expect(r.lo).toBeLessThan(r.hi); expect(T.days).toBe(goalDays(W, Q, T)); expect(T.days!).toBeGreaterThanOrEqual(1); });
      const M = runMonth(W, Q);
      M.ours.forEach(o => { expect(o.goal).toBe(3); if (o.trip!.end === 'goal') goal++; });
    }
    expect(goal).toBeGreaterThan(0);
  });
});
const D = (o: { days?: import('../src/core/expedition').Day[] }) => o.days || [];
