// 봇 시뮬레이터: 여러 판을 돌려 완주율과 결과를 요약한다. 밸런스를 바꿨을 때 전후 비교용.
//   npm run sim                        기본 300판
//   npm run sim -- --games 1000 --style hero --seed 1
// style: plain(담합 대응 없음) · donate(담합 때 헌금) · audit(담합 때 감찰) · hero(용사 파티 운영) · wild(공략본·제안·안건까지)
import { setSeed } from '../src/core/rng';
import { S, newGame } from '../src/core/state';
import { resolve } from '../src/core/turn';
import { prices, project } from '../src/core/economy';
import { heroPlan } from '../src/core/hero';
import { DEV } from '../src/core/founding';
import { AGENDAS } from '../src/core/agendas';
import { KEYS } from '../src/core/data';
import { botRng, botTurn, type BotStyle } from './bot';

const arg = (k: string, d: string) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const games = +arg('games', '300'), seed0 = +arg('seed', '1'), styleName = arg('style', 'donate');
const STYLES: Record<string, BotStyle> = {
  plain: {}, donate: { cartel: 'donate' }, audit: { cartel: 'audit' },
  hero: { cartel: 'donate', hero: true }, wild: { cartel: 'donate', hero: true, wild: true },
};
const style = STYLES[styleName];
if (!style) { console.error(`style은 ${Object.keys(STYLES).join(', ')} 중 하나`); process.exit(1); }

const api = { S: () => S, prices, project, heroPlan, DEV, AGENDAS, KEYS };
const ends: Record<string, number> = {};
let best2 = 0, treasury = 0, floors = 0, deaths = 0, cartelMonths = 0, runAt = 0;
for (let g = 0; g < games; g++) {
  setSeed(seed0 + g); newGame();
  const r = botRng((seed0 + g) * 7919);
  while (!S.over) { botTurn(api, r, style); resolve(); }
  ends[S.over] = (ends[S.over] || 0) + 1;
  if (S.evals.filter(e => e.grade === '우수').length >= 2) best2++;
  treasury += S.treasury; floors += S.unlocked; deaths += S.deathsTotal; cartelMonths += S.cartelMonths; runAt += S.runStart || 0;
}
const avg = (v: number) => (v / games).toFixed(1);
console.log(`봇 '${styleName}' · ${games}판 (시드 ${seed0}부터)`);
console.log(`  결과        ${Object.entries(ends).map(([k, v]) => `${k} ${v} (${Math.round(v / games * 100)}%)`).join(' · ')}`);
console.log(`  우수 2회 이상 ${best2}판`);
console.log(`  평균        금고 ${Math.round(treasury / games).toLocaleString()}G · 개척 ${avg(floors)}층 · 누적 사망 ${avg(deaths)}명 · 담합 ${avg(cartelMonths)}개월 · 운영기 전환 ${avg(runAt)}월`);
