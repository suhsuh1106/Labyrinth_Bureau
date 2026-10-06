// 게임 전체를 봇으로 돌리며 깨지면 안 되는 성질을 확인한다
import { describe, expect, it } from 'vitest';
import { setSeed } from '../src/core/rng';
import { S, newGame } from '../src/core/state';
import { resolve } from '../src/core/turn';
import { prices, project } from '../src/core/economy';
import { heroPlan } from '../src/core/hero';
import { DEV } from '../src/core/founding';
import { AGENDAS } from '../src/core/agendas';
import { KEYS } from '../src/core/data';
import { loadGame, SAVE_VERSION } from '../src/core/save';
import { bookSum } from '../src/ui/books';
import { renderDocsTab } from '../src/ui/docs';
import { renderFactionTab } from '../src/ui/faction';
import { renderExploreTab } from '../src/ui/explore';
import { renderBuildTab } from '../src/ui/build';
import { renderBooksTab } from '../src/ui/books';
import { renderHeroTab } from '../src/ui/hero';
import { calendarHtml, deskBudgetHtml } from '../src/ui/desk';
import { renderNewsTab } from '../src/ui/news';
import { issue } from '../src/core/news';
import { botRng, botTurn, type BotStyle } from '../sim/bot';

const api = { S: () => S, prices, project, heroPlan, DEV, AGENDAS, KEYS };
const styles: BotStyle[] = [{ cartel: 'donate' }, { cartel: 'audit', wild: true }, { hero: true, wild: true }];

function play(seed: number, style: BotStyle, each?: () => void) {
  setSeed(seed); newGame();
  const r = botRng(seed);
  while (!S.over) { botTurn(api, r, style); each?.(); }
}

describe('장부', () => {
  it('매달 수입·지출 합계가 금고 변화와 같다', () => {
    let months = 0;
    for (let seed = 100; seed < 160; seed++) play(seed, styles[seed % 3], () => {
      const t0 = S.treasury; resolve(); months++;
      const r = S.books[S.books.length - 1];
      expect(Math.abs(S.treasury - t0 - bookSum([r]).net), `시드 ${seed} 제${r.m}월`).toBeLessThanOrEqual(1);
    });
    expect(months).toBeGreaterThan(600);
  });
});

describe('화면', () => {
  it('모든 탭과 책상 위 서류가 매달 오류 없이 그려진다', () => {
    for (let seed = 200; seed < 215; seed++) play(seed, styles[seed % 3], () => {
      resolve();
      for (const f of [renderDocsTab, renderFactionTab, renderExploreTab, renderBuildTab, renderBooksTab, renderHeroTab, deskBudgetHtml, calendarHtml, renderNewsTab]) {
        const html = f();
        expect(typeof html).toBe('string');
        expect(html).not.toMatch(/undefined|NaN/);
      }
    });
  });
});

describe('변경 일보', () => {
  it('매달 신문이 나오고, 신문을 만들어도 게임 상태는 그대로다', () => {
    const heds = new Set<string>(); let extras = 0, issues = 0;
    for (let seed = 400; seed < 430; seed++) play(seed, styles[seed % 3], () => {
      resolve();
      const before = JSON.stringify(S);
      const I = issue(S.month - 1);
      expect(I, `시드 ${seed} 제${S.month - 1}호`).not.toBeNull();
      expect(JSON.stringify(I)).not.toMatch(/undefined|NaN/);
      expect(JSON.stringify(S)).toBe(before);
      heds.add(I!.kicker); if (I!.extra) extras++; issues++;
    });
    // 큰 일이 있는 달에만 호외가 나오고, 1면감도 여러 갈래여야 한다
    expect(extras).toBeGreaterThan(0);
    expect(extras).toBeLessThan(issues / 2);
    expect(heds.size).toBeGreaterThanOrEqual(5);
  });
  it('지난 호는 다시 펼쳐도 같다', () => {
    play(431, styles[2], () => { if (S.month < 10) resolve(); else S.over = 'stop'; });
    const old = JSON.stringify(issue(4));
    S.over = null; for (let i = 0; i < 5 && !S.over; i++) resolve();
    expect(JSON.stringify(issue(4))).toBe(old);
  });
});

describe('저장', () => {
  it('지금 버전 저장은 그대로 이어진다', () => {
    play(300, styles[0], () => { if (S.month < 6) resolve(); else S.over = 'stop'; });
    S.over = null;
    const saved = JSON.parse(JSON.stringify(S));
    loadGame({ S: saved });
    expect(S.month).toBe(6);
    expect(S.v).toBe(SAVE_VERSION);
  });
  it('개척기 이전(버전 13) 저장은 운영 중인 관리국으로 이어진다', () => {
    play(301, styles[0], () => { if (S.month < 6) resolve(); else S.over = 'stop'; });
    const old = JSON.parse(JSON.stringify(S));
    ['phase', 'dev', 'devPick', 'unsold', 'lootMul', 'mPriceAdj', 'runStart', 'soldBacklog'].forEach(k => delete old[k]);
    old.v = 13; old.over = null;
    loadGame({ S: old });
    expect(S.phase).toBe('run');
    expect(S.v).toBe(SAVE_VERSION);
    resolve();
    expect(S.month).toBe(7);
  });
  it('모르는 버전이면 새 게임으로 시작한다', () => {
    loadGame({ S: { v: 3 } });
    expect(S.month).toBe(1);
    expect(S.phase).toBe('found');
  });
});
