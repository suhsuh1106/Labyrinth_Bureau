// 통행세와 전리품 말고 들어오는 돈: 영주 보조금, 시장세, 의뢰 수수료.
// 국장이 하나하나 고르는 것은 없다. 마을이 커지고 원정이 잘 풀리면 저절로 늘고, 결과는 결산과 신문에 남는다
import { C } from './data';
import { devDone } from './founding';
import { rnd } from './rng';
import { S } from './state';

// 영주 보조금: 부임 첫 몇 달만 나오고 점점 줄어든다. 끊기기 전에 흑자를 만드는 것이 첫 목표다
export const grant = (m = S.month) => C.GRANT[m - 1] || 0;
export const grantLeft = (m = S.month) => C.GRANT.slice(m - 1).filter(v => v > 0).length;

// 시장세: 면허 사무소가 열리면 용병을 상대로 장사하는 가게가 생기고, 전리품이 팔리면 그 돈이 마을을 한 번 더 돈다
export const marketTax = (M: number, lootSold: number) => (devDone('gate') ? Math.round(M * C.MKT_M) : 0) + Math.round(lootSold * C.MKT_L);

// 의뢰: 바깥 의뢰인(마법학교, 수집가, 교회 등)이 관리국 게시판에 의뢰를 걸고, 의뢰 담당이 알아서 파티에 붙인다.
// 그 층에서 성공한 파티가 있으면 완수되고, 관리국은 보상의 일부를 수수료로 받는다
const CLIENTS = ['마법학교 서부 분교', '수도의 수집가', '교회 회계실', '대장간 조합', '약방 푸른병', '하르덴 백작의 집사', '남부 상회'];
export type Quest = { who: string; f: number; reward: number; done: boolean };
export function rollQuests(winsByFloor: number[]): Quest[] {
  if (!devDone('gate')) return [];
  const n = Math.min(C.QUEST_MAX, Math.floor(S.unlocked / 2 + S.fame / 40 + rnd()));
  const out: Quest[] = [];
  for (let i = 0; i < n; i++) {
    // 깊은 층 의뢰가 더 많고 더 비싸다
    const f = Math.min(S.unlocked - 1, Math.floor(Math.sqrt(rnd()) * S.unlocked));
    const reward = Math.round(C.QUEST_BASE * (1 + f * 0.6) * (0.7 + 0.6 * rnd()) / 50) * 50;
    out.push({ who: CLIENTS[Math.floor(rnd() * CLIENTS.length)], f, reward, done: winsByFloor[f] > 0 });
  }
  return out;
}
export const questFee = (qs: Quest[]) => qs.filter(q => q.done).reduce((a, q) => a + Math.round(q.reward * C.QUEST_CUT), 0);
