// 새 모듈 코드가 옛 프로토타입과 똑같이 움직이는지 본다.
// 같은 시드, 같은 봇 선택이면 매달 게임 상태 전체가 같아야 한다.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { setSeed } from '../src/core/rng';
import { S, newGame } from '../src/core/state';
import { resolve } from '../src/core/turn';
import { prices, project } from '../src/core/economy';
import { heroPlan } from '../src/core/hero';
import { DEV } from '../src/core/founding';
import { AGENDAS } from '../src/core/agendas';
import { KEYS } from '../src/core/data';
import { botRng, botTurn, type BotStyle } from '../sim/bot';
import { loadProto } from './proto';

const PROTO = 'proto/budget-potion.html';
const api = { S: () => S, prices, project, heroPlan, DEV, AGENDAS, KEYS };
const styles: BotStyle[] = [{}, { cartel: 'donate' }, { cartel: 'audit', wild: true }, { hero: true, wild: true }];

describe.skipIf(!fs.existsSync(PROTO))('옛 프로토타입과 동작 비교', () => {
  const proto = loadProto(PROTO);
  const seen = { months: 0, cartel: 0, hero: 0, agenda: 0, union: 0, leak: 0, lord: 0, guide: 0 };
  for (let seed = 1; seed <= 24; seed++) {
    const style = styles[seed % styles.length];
    it(`시드 ${seed} · ${JSON.stringify(style)}`, () => {
      const old = proto(seed);
      setSeed(seed);
      old.newGame(); newGame();
      const r1 = botRng(seed * 7919), r2 = botRng(seed * 7919);
      for (let m = 0; m < 40 && !S.over; m++) {
        botTurn(old, r1, style); botTurn(api, r2, style);
        expect(JSON.stringify(S)).toBe(JSON.stringify(old.S()));
        if (S.cartel) seen.cartel++; if (S.hero) seen.hero++; if (S.agenda) seen.agenda++;
        if (S.union) seen.union++; if (S.leak) seen.leak++; if (S.lord) seen.lord++;
        old.resolve(); resolve();
      }
      expect(JSON.stringify(S)).toBe(JSON.stringify(old.S()));
      seen.months += S.month; if (S.floors.some(f => f.guide)) seen.guide++;
    });
  }
  // 비교가 의미 있으려면 봇이 여러 갈래를 실제로 지나가야 한다
  it('비교한 판들이 주요 시스템을 두루 지나갔다', () => {
    expect(seen.months).toBeGreaterThan(24 * 15);
    for (const k of ['cartel', 'hero', 'agenda', 'guide'] as const) expect(seen[k], k).toBeGreaterThan(0);
  });
});
