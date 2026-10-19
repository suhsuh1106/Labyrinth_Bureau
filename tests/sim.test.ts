// 오래 걸리는 판 단위 시험(화면 36개월 · 경쟁 · 지침 · 밸런스)을 따로 둔다: 한 파일이 너무 길면 vitest 워커가 시간 초과를 낸다
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setSeed } from '../src/core/rng';
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
import { needOf, tripOdds, potShock, profitOf, drillGain, weakShare } from '../src/core/company';
import { WEAK_KEYS } from '../src/core/data';
import { DEX } from '../src/core/dex';

describe('용병단 행정실 화면', () => {
  it('결정표와 정산서가 36개월 내내 깨지지 않고, 그려도 판은 그대로다', async () => {
    for (const [name, bot] of Object.entries(BOT)) {
      await new Promise(r => setTimeout(r, 0));   // 오래 도는 테스트는 틈틈이 쉬어 테스트 일꾼이 멈춘 것으로 보이지 않게
      setSeed(21); const W = newWorld();
      let plan = carryPlan(W, null);
      for (let m = 0; m < 36; m++) {
        if (m % 6 === 0) await new Promise(r => setTimeout(r, 0));
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
  it('시장을 읽는 숙련 봇이 고르게 두는 봇보다 평균 순위가 높다', async () => {
    let smart = 0, even = 0;
    for (let g = 1; g <= 40; g++) { smart += rankOf(playGame(g, BOT.smart)); even += rankOf(playGame(g, BOT.even)); await new Promise(r => setTimeout(r, 0)); }
    expect(smart).toBeLessThan(even);
  });
});

