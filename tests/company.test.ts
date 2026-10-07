// 용병단 엔진 (docs/plan.md 1단계): 장부, 재현성, 시장 규칙이 깨지지 않는지 확인한다
import { describe, expect, it } from 'vitest';
import { setSeed } from '../src/core/rng';
import { CO, FLOORS, ITEMS, defaultPlan, emptyPlan, newWorld, potionPrice, priceOf, runMonth, us, worth } from '../src/core/company';
import { BOT, playGame } from '../sim/company';
import { aiPlan, carryPlan, maxParties, outlook, rankOf } from '../src/core/company';
import { newsLines, planHtml, plaqueHtml, resultsHtml } from '../src/ui/co/view';

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
      expect(priceOf(it, it.D * 100)).toBeGreaterThanOrEqual(Math.round(it.P0 * 0.35));
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
  it('플레이어가 단원보다 많이 보내거나 창고보다 많이 팔려 해도 규칙 안으로 맞춰진다', () => {
    setSeed(5); const W = newWorld();
    const P = emptyPlan(); P.parties = [99, 99, 0, 0, 0]; P.sell = [50, 0, 0, 0, 0];
    const M = runMonth(W, P);
    expect(M.res[0].sent.reduce((a, b) => a + b, 0)).toBe(Math.floor(36 / CO.PARTY));
    expect(M.res[0].sent[1]).toBe(0);        // 2층은 아직 닫혀 있다
    expect(M.res[0].sold[0]).toBe(0);        // 첫 달 창고는 비어 있다
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
      expect(JSON.stringify(W)).not.toMatch(/NaN|null,null|undefined/);
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
        const html = plaqueHtml(W) + planHtml(W, plan) + resultsHtml(W) + newsLines(W).join('');
        expect(html, `${name} 제${W.month}월`).not.toMatch(/undefined|NaN|Infinity/);
        expect(JSON.stringify(W)).toBe(before);
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
    for (let seed = 30; seed < 40; seed++) {
      setSeed(seed); const W = newWorld();
      for (let m = 0; m < 12; m++) runMonth(W, BOT.even(W));
      const i = W.cos.findIndex(c => c.style === 'chaser'), look = outlook(W);
      const P = aiPlan(W, i), top = look.indexOf(Math.max(...look));
      if (W.cos[i].losses >= 2 || W.cos[i].cash < 3000) continue;
      expect(P.parties.indexOf(Math.max(...P.parties)), `시드 ${seed}`).toBe(top);
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
