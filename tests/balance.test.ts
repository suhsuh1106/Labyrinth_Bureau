// 오래 걸리는 판 단위 시험(지침 · 밸런스)을 따로 둔다: 한 파일이 너무 길면 vitest 워커가 시간 초과를 낸다
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
const planHtml = (W: World, P: Plan) => (W.draft ? draftHtml(W, {}) : '') + DOC_TABS.map(([tab]) => infoWeekHtml(W, P, { phase: 0, tab, pins: DOC_TABS.map(t => t[0]), open: true })).join('') + Object.keys(PLACES).map(place => infoWeekHtml(W, P, { phase: 0, tab: 'report', pins: [], place })).join('') + expWeekHtml(W, P, { phase: 1, tab: 'report', pins: DOC_TABS.map(t => t[0]) }) + (W.last ? resultWeekHtml(W) + resultWeekHtml(W, true) : '');
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
import { needOf, tripOdds, potShock, profitOf, drillGain, weakShare, hireCap } from '../src/core/company';
import { WEAK_KEYS } from '../src/core/data';
import { DEX } from '../src/core/dex';

describe('몬스터와 편성 지침', () => {
  it('편성 지침을 주면 파티가 그 직업이나 장비를 꼭 갖춘다', () => {
    setSeed(2);
    for (let i = 0; i < 200; i++) {
      expect(rollParty('c:마법사')).toContain('c:마법사');
      expect(rollParty('g:신성')).toContain('g:신성');
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
  it('약점은 그날 만난 몬스터의 것만 먹힌다: 주 몬스터의 약점을 갖추면 주 몬스터를 만난 날 더 해낸다', () => {
    const rate = { key: [0, 0], bad: [0, 0] }, fauna = { key: [0, 0], bad: [0, 0] };
    for (let seed = 1; seed <= 60; seed++) {
      for (const which of ['key', 'bad'] as const) {
        setSeed(seed); const W = newWorld(), main = MONSTERS[W.mons[0]];
        for (let m = 0; m < 6; m++) {
          const P = defaultPlan(W); P.guide[0] = main[which];
          runMonth(W, P).ours.forEach(o => o.days!.forEach(d => { const R = d.mon === main.name ? rate : fauna; R[which][0] += d.k; R[which][1] += d.n; }));   // 해낸 사람 비율
        }
      }
    }
    const r = (x: number[]) => x[0] / x[1];
    expect(r(rate.key) - r(rate.bad)).toBeGreaterThan(0.08);
    expect(Math.abs(r(fauna.key) - r(fauna.bad))).toBeLessThan(r(rate.key) - r(rate.bad));   // 곁 몬스터에게는 주 몬스터의 약점이 먹히지 않는다
  });
  it('경쟁 용병단은 한 층에 오래 드나들면 약점을 깨치고, 그 소문이 기록에 남는다', () => {
    const W = playGame(8, BOT.smart);
    const learned = W.cos.filter(c => c.learned && c.learned.some(Boolean));
    expect(learned.length).toBeGreaterThan(0);
    expect(W.log.some(l => /챙겨 들어가기 시작했다/.test(l.t))).toBe(true);
    learned.forEach(c => c.learned.forEach((ok, f) => { if (ok) expect(aiPlan(W, W.cos.indexOf(c)).guide[f]).toBe(keyOf(W, f)); }));
  });
  // 지침의 덕은 작다(200판 평균 순위: 공방을 뺀 뒤 3.35 대 3.37, 영주청 전에도 0.1 안팎). 여기서는 지침이 손해를 보지 않는지만 본다.
  // 120판 순위 합의 노이즈가 ±4% 안팎이라 6%까지 둔다
  it('숙련 봇은 현장 기록으로 추리한 지침을 써도 지침 없이 둘 때보다 뒤처지지 않는다', () => {
    let a = 0, b = 0;
    for (let g = 1; g <= 120; g++) { a += rankOf(playGame(g, BOT.smart, FILER.smart)); b += rankOf(playGame(g, BOT.smartNoGuide, FILER.smartNoGuide)); }
    expect(a).toBeLessThanOrEqual(b * 1.06);
  }, 90000);
});

describe('밸런스', () => {
  it('어느 한 용병단이 1위를 도맡지 않고, 숙련 봇도 가끔 1위를 한다', () => {
    const win: Record<string, number> = {};
    // 숙련 봇은 신고서도 다룬다 (장부 그대로 내면 성흔 기사단이 1위를 60% 넘게 가져간다)
    for (let g = 1; g <= 60; g++) { const W = playGame(g, BOT.smart, FILER.smart); win[W.last!.rank[0]] = (win[W.last!.rank[0]] || 0) + 1; }
    expect(Math.max(...Object.values(win))).toBeLessThan(60 * 0.6);
    expect(win.us || 0).toBeGreaterThan(0);
  });
});

