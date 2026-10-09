// 용병단 엔진 (docs/plan.md 1단계): 장부, 재현성, 시장 규칙이 깨지지 않는지 확인한다
import { describe, expect, it } from 'vitest';
import { setSeed } from '../src/core/rng';
import { CO, FLOORS, ITEMS, defaultPlan, emptyPlan, newWorld, potionPrice, priceOf, runMonth, us, worth } from '../src/core/company';
import { BOT, playGame } from '../sim/company';
import { aiPlan, carryPlan, maxParties, outlook, rankOf, rollParty } from '../src/core/company';
import { churchPrice, type Plan, type World } from '../src/core/company';
import { MONSTERS } from '../src/core/data';
import { depthsHtml, newsLines, plaqueHtml, resultsHtml, returnHtml } from '../src/ui/co/view';
import { DOC_TABS, expWeekHtml, infoWeekHtml, resultWeekHtml } from '../src/ui/co/desk';
const planHtml = (W: World, P: Plan) => DOC_TABS.map(([tab]) => infoWeekHtml(W, P, { phase: 0, tab, pins: DOC_TABS.map(t => t[0]), open: true })).join('') + expWeekHtml(W, P, { phase: 1, tab: 'report', pins: DOC_TABS.map(t => t[0]) }) + (W.last ? resultWeekHtml(W) + resultWeekHtml(W, true) : '');
import { coIssue, paperHtml } from '../src/ui/co/paper';
import { intelHtml } from '../src/ui/co/intel';
import { bookHtml, demandsNow } from '../src/ui/co/book';
import { allMats, floorMons, guideParts, matChance, matPrice, potsOf, probe, sanitize } from '../src/core/company';
import { INTEL, aiPlan as aiPlanOf } from '../src/core/company';
import { rnd } from '../src/core/rng';
import { floorMax, keyOf } from '../src/core/company';

describe('용병단 장부', () => {
  it('매달 모든 용병단의 금고 변화가 판매 수입에서 지출을 뺀 값과 같다', () => {
    for (let seed = 1; seed <= 20; seed++) {
      setSeed(seed); const W = newWorld();
      const bot = Object.values(BOT)[seed % 4];
      for (let m = 0; m < 36; m++) {
        const before = W.cos.map(c => c.cash);
        const M = runMonth(W, bot(W));
        W.cos.forEach((c, i) => {
          if (c.style === 'crowd') return;
          const r = M.res[i], spend = Object.values(r.spend).reduce((a, b) => a + b, 0);
          expect(c.cash - before[i], `시드 ${seed} 제${M.month}월 ${c.id}`).toBe(r.sales - spend);
          expect(r.net).toBe(r.sales - spend);
        });
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
      expect(priceOf(it, it.D * 2)).toBeLessThan(it.P0);
      expect(priceOf(it, it.D / 2)).toBeGreaterThan(it.P0);
      expect(priceOf(it, it.D * 100)).toBe(Math.round(it.P0 * it.lo));
      expect(priceOf(it, 1)).toBe(Math.round(it.P0 * it.hi));
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
    setSeed(5); const W = newWorld();
    const P = emptyPlan(); P.parties = [99, 99, 0, 0, 0];
    const M = runMonth(W, P);
    expect(M.res[0].sent.reduce((a, b) => a + b, 0)).toBe(Math.floor(36 / CO.PARTY));
    expect(M.res[0].sent[1]).toBe(0);        // 2층은 아직 닫혀 있다
    M.res.forEach((r, i) => { if (W.cos[i].style !== 'crowd') expect(r.sold).toEqual(r.got); });
    expect(M.Q[0]).toBe(M.res.reduce((a, r) => a + r.sold[0], 0));
  });
  it('계약 파티를 쓰면 수수료가 나가고, 캔 것의 일부는 군소 용병대 몫이 된다', () => {
    setSeed(9); const W = newWorld();
    const P = defaultPlan(W); P.hire = [2, 0, 0, 0, 0];
    const M = runMonth(W, P);
    expect(M.res[0].hired[0]).toBe(2);
    expect(M.res[0].spend.hire).toBe(2 * CO.HIRE_FEE);
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

describe('용병단 행정실 화면', () => {
  it('결정표와 정산서가 36개월 내내 깨지지 않고, 그려도 판은 그대로다', () => {
    for (const [name, bot] of Object.entries(BOT)) {
      setSeed(21); const W = newWorld();
      let plan = carryPlan(W, null);
      for (let m = 0; m < 36; m++) {
        const before = JSON.stringify(W);
        setSeed(1000 + m); const r0 = rnd(); setSeed(1000 + m);
        const html = plaqueHtml(W) + intelHtml(W) + bookHtml(W) + planHtml(W, plan) + resultsHtml(W) + newsLines(W).join('') + returnHtml(W) + depthsHtml(W, plan) + paperHtml(W);
        expect(html, `${name} 제${W.month}월`).not.toMatch(/undefined|NaN|Infinity|\[object/);
        expect(JSON.stringify(W)).toBe(before);
        expect(rnd(), '화면을 그려도 난수를 쓰지 않는다').toBe(r0);
        if (W.last) expect(paperHtml(W)).toContain('변경 일보');
        runMonth(W, bot(W));
        plan = carryPlan(W, plan);
      }
    }
  });
});

describe('경쟁 용병단', () => {
  it('판마다 성격이 조금씩 다르고, 같은 시드면 같다', () => {
    setSeed(1); const a = newWorld(); setSeed(1); const b = newWorld(); setSeed(2); const c = newWorld();
    expect(JSON.stringify(a.cos.map(x => x.trait))).toBe(JSON.stringify(b.cos.map(x => x.trait)));
    expect(JSON.stringify(a.cos.map(x => x.trait))).not.toBe(JSON.stringify(c.cos.map(x => x.trait)));
  });
  it('기회주의 용병단은 지난달 조당 남는 돈이 가장 좋았던 층에 가장 많이 보낸다', () => {
    let checked = 0;
    for (let seed = 30; seed < 90; seed++) {
      setSeed(seed); const W = newWorld();
      for (let m = 0; m < 12; m++) runMonth(W, BOT.even(W));
      const i = W.cos.findIndex(c => c.style === 'chaser'), look = outlook(W);
      const P = aiPlan(W, i), top = look.indexOf(Math.max(...look));
      // 적자로 허리띠를 졸라맨 달이나, 어느 층도 비용을 넘지 못해 남는 돈이 모두 바닥값인 달은 견줄 수 없다
      const cost = CO.SORTIE + P.pots[0] * W.potion, second = [...look].sort((a, b) => b - a)[1];
      if (W.cos[i].losses >= 2 || W.cos[i].cash < 3000 || look[top] - cost < 50 || look[top] - second < 30) continue;
      expect(P.parties[top], `시드 ${seed}`).toBe(Math.max(...P.parties));
      checked++;
    }
    expect(checked).toBeGreaterThan(3);
  });
  it('계약 파티는 군소 용병대가 가진 파티 수를 넘지 않는다', () => {
    setSeed(13); const W = newWorld();
    for (let m = 0; m < 24; m++) {
      const P = BOT.even(W); P.hire = [9, 9, 9, 9, 9];
      const crowd = W.cos.find(c => c.style === 'crowd')!, free = maxParties(crowd);
      const M = runMonth(W, P);
      expect(M.res.reduce((a, r) => a + r.hired.reduce((s, v) => s + v, 0), 0)).toBeLessThanOrEqual(free);
    }
  });
  it('시장을 읽는 숙련 봇이 고르게 두는 봇보다 평균 순위가 높다', () => {
    let smart = 0, even = 0;
    for (let g = 1; g <= 40; g++) { smart += rankOf(playGame(g, BOT.smart)); even += rankOf(playGame(g, BOT.even)); }
    expect(smart).toBeLessThan(even);
  });
});

describe('몬스터와 편성 지침', () => {
  it('편성 지침을 주면 파티가 그 직업이나 장비를 꼭 갖춘다', () => {
    setSeed(2);
    for (let i = 0; i < 200; i++) {
      expect(rollParty('c:마법사')).toContain('c:마법사');
      expect(rollParty('g:은')).toContain('g:은');
    }
  });
  it('현장 기록은 우리 직영 파티만 남기고, 처음 간 층에서는 겉모습 증언을 듣는다', () => {
    setSeed(4); const W = newWorld();
    const P = defaultPlan(W); P.hire = [2, 0, 0, 0, 0];
    runMonth(W, P);
    expect(W.obs[0]['*'].n).toBe(P.parties[0]);
    expect(W.notes[0]).toEqual({ m: 1, f: 0, t: MONSTERS[W.mons[0]].look[0] });
    for (let m = 0; m < 11; m++) runMonth(W, defaultPlan(W));
    // 오래된 기록일수록 흐려진다: 달마다 OBS_FADE를 곱한 뒤 이번 달 것을 더한다
    const faded = W.history.reduce((a, M) => a * CO.OBS_FADE + M.res[0].sent[0], 0);
    expect(W.obs[0]['*'].n).toBeCloseTo(faded, 6);
  });
  it('약점을 지침으로 삼으면 역효과를 지침으로 삼을 때보다 우리 성공률이 높다', () => {
    let good = 0, bad = 0, n = 0;
    for (let seed = 1; seed <= 20; seed++) {
      for (const which of ['key', 'bad'] as const) {
        setSeed(seed); const W = newWorld();
        for (let m = 0; m < 6; m++) {
          const P = defaultPlan(W); P.guide[0] = MONSTERS[W.mons[0]][which];
          const M = runMonth(W, P), r = M.res[0];
          if (which === 'key') { good += r.ok[0]; n += r.sent[0]; } else bad += r.ok[0];
        }
      }
    }
    expect(good / n - bad / n).toBeGreaterThan(0.1);   // 1층은 순해서 약점 차이가 작다
  });
  it('경쟁 용병단은 한 층에 오래 드나들면 약점을 깨치고, 그 소문이 기록에 남는다', () => {
    const W = playGame(8, BOT.smart);
    const learned = W.cos.filter(c => c.learned && c.learned.some(Boolean));
    expect(learned.length).toBeGreaterThan(0);
    expect(W.log.some(l => /챙겨 들어가기 시작했다/.test(l.t))).toBe(true);
    learned.forEach(c => c.learned.forEach((ok, f) => { if (ok) expect(aiPlan(W, W.cos.indexOf(c)).guide[f]).toBe(keyOf(W, f)); }));
  });
  it('숙련 봇은 현장 기록으로 추리한 지침 덕에 지침 없이 둘 때보다 앞선다', () => {
    let a = 0, b = 0;
    for (let g = 1; g <= 40; g++) { a += rankOf(playGame(g, BOT.smart)); b += rankOf(playGame(g, BOT.smartNoGuide)); }
    expect(a).toBeLessThan(b);
  });
});

describe('밸런스', () => {
  it('어느 한 용병단이 1위를 도맡지 않고, 숙련 봇도 가끔 1위를 한다', () => {
    const win: Record<string, number> = {};
    for (let g = 1; g <= 60; g++) { const W = playGame(g, BOT.smart); win[W.last!.rank[0]] = (win[W.last!.rank[0]] || 0) + 1; }
    expect(Math.max(...Object.values(win))).toBeLessThan(60 * 0.6);
    expect(win.us || 0).toBeGreaterThan(0);
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
  it('담합 전에는 소문이 먼저 돌고, 담합 중에는 상단·교회 포션 값이 함께 오른다', () => {
    let seen = 0;
    for (let g = 1; g <= 40; g++) {
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
      setSeed(g); const W: World = newWorld();
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
    for (let g = 1; g <= 30; g++) {
      for (const church of [0, 9999]) {
        setSeed(g); const W = newWorld();
        for (let m = 0; m < 12; m++) { const P = BOT.even(W); P.buy = { holy: church }; const M = runMonth(W, P); if (church) a += M.res[0].deaths; else b += M.res[0].deaths; }
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
  it('근원은 약점대로 들어가 성공을 쌓은 우리 파티만 찾는다', () => {
    let smart = 0, even = 0;
    for (let g = 1; g <= 10; g++) {
      smart += playGame(g, BOT.smart).roots!.filter(r => r.found).length;
      even += playGame(g, BOT.even).roots!.filter(r => r.found).length;
    }
    expect(even).toBe(0);
    expect(smart).toBeGreaterThan(5);
    const W = playGame(3, BOT.smart);
    // 찾은 달에는 우리 파티가 그 층에 지침을 갖고 들어갔다
    W.roots!.forEach((R, f) => { if (R.found) { const M = W.history[R.found - 1]; expect(M.res[0].sent[f]).toBeGreaterThan(0); expect(M.plans[0].guide[f]).not.toBe(''); } });
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
    setSeed(32); const W: World = newWorld();
    us(W).relM = 30;
    for (let m = 0; m < 12; m++) { runMonth(W, pay('mkt', 400)(W)); us(W).relM = 30; }
    expect(W.intel!.lv.mkt).toBe(1);
    us(W).relM = 80;
    for (let m = 0; m < 3; m++) { runMonth(W, pay('mkt', 400)(W)); us(W).relM = 80; }
    expect(W.intel!.lv.mkt).toBeGreaterThanOrEqual(2);
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
  it('채집 장비를 갖추면 성공 한 번에 캐 오는 양이 는다', () => {
    let a = 0, b = 0;
    for (const tool of [0, 2]) for (let g = 1; g <= 10; g++) {
      setSeed(g); const W = newWorld();
      for (let m = 0; m < 4; m++) { const P = BOT.even(W); P.tool = tool; const M = runMonth(W, P); const per = M.res[0].got[0] / Math.max(1, M.res[0].ok[0]); if (tool) b += per; else a += per; }
    }
    expect(b).toBeGreaterThan(a);
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
  it('소재는 성공한 우리 직영 조만 갈무리해 오고, 판 값은 판매 수입에 들어 있다', () => {
    setSeed(51); const W: World = newWorld();
    for (let m = 0; m < 12; m++) {
      const M = runMonth(W, BOT.smart(W)), r = M.res[0];
      M.ours.filter(x => !x.ok).forEach(x => expect(x.mats).toEqual([]));
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
    const B = W.mat!.book[0];
    expect(B.n['*']).toBe(ok);
    Object.values(B.got).forEach(g => Object.entries(g).forEach(([k, a]) => expect(a).toBeLessThanOrEqual(B.n[k])));
  });
  it('조건을 갖추면 그 소재가 더 잘 나오고, 층이 비면 덜 나온다', () => {
    const x = { n: 't', v: 10, p: 0.1, b: [['g:냉기', 3]] as [string, number][] };
    expect(matChance(x, ['g:냉기'], 1)).toBeCloseTo(0.4);
    expect(matChance(x, ['c:전사'], 1)).toBeCloseTo(0.1);
    expect(matChance(x, ['g:냉기'], 0)).toBeCloseTo(0.2);
    const y = { n: 'u', v: 10, p: 0.05, b: [['c:사제+g:은', 5]] as [string, number][] };
    expect(matChance(y, ['c:사제'], 1)).toBeCloseTo(0.05);
    expect(matChance(y, ['c:사제', 'g:은'], 1)).toBeCloseTo(0.3);
    // 실제 판에서도: 1층 주인 몬스터의 드문 소재를 부르는 조건을 챙기면 더 많이 얻는다
    let a = 0, b = 0;
    for (const on of [false, true]) for (let g = 1; g <= 8; g++) {
      setSeed(g); const W: World = newWorld();
      const rare = floorMons(W, 0)[0].mats.find(m => m.b && m.p < 0.1)!, kit = rare.b![0][0];
      for (let m = 0; m < 6; m++) { const P = BOT.even(W); if (on) P.guide[0] = kit; const M = runMonth(W, P); const n = M.res[0].matSold[rare.n] || 0; if (on) b += n; else a += n; }
    }
    expect(b).toBeGreaterThan(a * 1.5);
  });
  it('편성은 직업 하나와 장비 하나까지만 받고, 파티는 둘 다 갖춘다', () => {
    setSeed(53); const W: World = newWorld();
    const P = BOT.even(W); P.guide[0] = 'c:사제+g:은+c:전사+x:모름';
    const Q = sanitize(W, W.cos[0], P);
    expect(guideParts(Q.guide[0])).toEqual(['c:사제', 'g:은']);
    for (let i = 0; i < 30; i++) { const k = rollParty(Q.guide[0]); expect(k).toContain('c:사제'); expect(k).toContain('g:은'); }
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
    setSeed(61); const W: World = newWorld();
    const P = BOT.even(W); P.buy = { pot: 10 };
    const M = runMonth(W, P), r = M.res[0];
    expect(r.potUsed).toBeLessThanOrEqual(10);
    expect(r.potShort).toBeGreaterThan(0);
    expect(potsOf(us(W)).pot + potsOf(us(W)).holy).toBe(10 - r.potUsed);
    const P2 = BOT.even(W); P2.buy = { pot: 500 };
    const M2 = runMonth(W, P2);
    expect(M2.res[0].potShort).toBe(0);
    expect(potsOf(us(W)).pot).toBeGreaterThan(400);
  });
  it('장비는 한 벌을 조 하나가 들고 가고, 모자라면 그만큼은 장비 없이 가며, 망가진 만큼 창고에서 빠진다', () => {
    setSeed(62); const W: World = newWorld();
    const P = BOT.even(W); P.parties[0] = 6; P.kits = [[{ n: 6, g: 'g:냉기' }]]; P.buy = { gear: { 냉기: 4 } };
    const M = runMonth(W, P), r = M.res[0];
    expect(r.gearUsed['냉기']).toBe(4);
    expect(M.ours.filter(x => x.keys.includes('g:냉기') && x.kit === 0).length).toBeGreaterThanOrEqual(4);
    expect(us(W).sup!.gear['냉기']).toBe(4 - (r.gearLost['냉기'] || 0));
    expect(r.spend.gear).toBe(4 * CO.GEAR_PRICE);
  });
  it('포션은 산 달별로 쌓여 오래된 것부터 쓰이고, 기한이 지나면 그 묶음이 상한다', () => {
    setSeed(63); const W: World = newWorld();
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
  it('편성 줄은 층의 우리 조를 넘지 않게 맞춰지고, 줄마다 챙긴 것을 갖춘 조가 그 줄로 기록된다', () => {
    setSeed(65); const W: World = newWorld();
    const P = BOT.even(W); P.parties[0] = 5; P.kits = [[{ n: 3, g: 'c:사제' }, { n: 9, g: 'c:궁수+g:은+c:전사' }]];
    const Q = sanitize(W, us(W), P);
    expect(Q.kits![0]).toEqual([{ n: 3, g: 'c:사제' }, { n: 2, g: 'c:궁수+g:은' }]);
    const M = runMonth(W, P);
    const k0 = M.ours.filter(x => x.kit === 0), k1 = M.ours.filter(x => x.kit === 1);
    expect(k0.length).toBe(3); expect(k1.length).toBe(2);
    k0.forEach(x => expect(x.keys).toContain('c:사제'));
    k1.forEach(x => expect(x.keys).toContain('c:궁수'));
    const html = resultWeekHtml(W) + expWeekHtml(W, carryPlan(W, P), { phase: 1, tab: 'report', pins: [] });
    expect(html).not.toMatch(/undefined|NaN|\[object/);
    expect(html).toContain('편성 줄');
  });
});

describe('층의 성격', () => {
  it('시세는 수요와 공급으로 정해지고, 공급이 수요의 두 배가 되면 깊은 층 전리품일수록 크게 떨어진다', () => {
    const drop = ITEMS.map(it => priceOf(it, it.D * 2) / priceOf(it, it.D));
    ITEMS.forEach(it => expect(priceOf(it, it.D)).toBe(it.P0));
    for (let j = 1; j < ITEMS.length; j++) expect(drop[j]).toBeLessThan(drop[j - 1]);
    expect(drop[0]).toBeGreaterThan(0.75);
    expect(drop[ITEMS.length - 1]).toBeLessThan(0.5);
  });
  it('공급과 수요는 상단 장부 1단계부터 시세판에 보인다', () => {
    setSeed(71); const W: World = newWorld();
    for (let m = 0; m < 3; m++) runMonth(W, BOT.even(W));
    expect(resultsHtml(W)).toContain('상단 장부 1단계부터');
    expect(resultsHtml(W)).not.toContain(`/ ${ITEMS[0].D}</small>`);
    W.intel!.lv.mkt = 1;
    expect(resultsHtml(W)).toContain(`${W.last!.Q[0]} / ${ITEMS[0].D}</small>`);
  });
  it('얕은 층 전리품은 시세 폭이 좁고 깊은 층 전리품은 넓다', () => {
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
