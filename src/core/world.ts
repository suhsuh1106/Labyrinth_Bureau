// 시설·제안 같은 상태에서 바로 읽는 값
import { C, FACILITIES, OFFERS } from './data';
import { S } from './state';

export const offerCost = () => S.offers.filter(o => o.accepted).reduce((a, o) => a + OFFERS[o.id].cost, 0);

export const fixedCost = () => 1000 + C.OPS_PER_M * S.M;

export const done = id => !!(S.fac[id] && S.fac[id].state === 'done');

// 근원을 찾은 층마다 봉인과 채굴 중 하나를 고르는 시설이 생긴다
export function rootFacs() {
  return S.floors.flatMap((fl, i) => !fl.root ? [] : [
    { id: 'seal' + i, floor: i, name: `${i + 1}층 근원 봉인`, cost: 3500, months: 2, upkeep: 0, excl: 'mine' + i,
      effect: '이 층 몬스터가 약해져 성공률이 10%p 오르고, 이 층에서 꺼낸 전리품이 미궁의 압력을 거의 채우지 않아요. 대신 전리품이 10% 줄어요', hint: '교회가 반기고, 상단은 아쉬워할 거예요',
      react: { gC: -10, gM: 8 }, rumor: `관리국이 ${i + 1}층 근원을 봉인한다는 소식에 교회가 축복 기도를 올립니다. 상단은 아까운 광맥을 묻는다며 혀를 찹니다.`, doneMsg: `${i + 1}층 근원을 봉인했습니다. 그 층의 맥이 식어 갑니다.` },
    { id: 'mine' + i, floor: i, name: `${i + 1}층 근원 채굴장`, cost: 4000, months: 2, upkeep: 300, excl: 'seal' + i,
      effect: '근원에서 직접 캐내 이 층 전리품이 50% 늘어요. 대신 이 층에서 꺼낸 전리품이 미궁의 압력을 2.5배로 채워요', hint: '상단이 크게 반기고, 교회는 불길해할 거예요',
      react: { gM: -15, gC: 8 }, rumor: `${i + 1}층 근원에 채굴장을 낸다는 소식에 상단이 들떴습니다. 교회는 "건드리지 말아야 할 것"이라며 수군댑니다.`, doneMsg: `${i + 1}층 근원 채굴장이 문을 열었습니다.` },
  ]);
}

export const allFacs = () => [...FACILITIES, ...rootFacs()];

export const facPendingCost = () => allFacs().reduce((a, f) => a + (S.fac[f.id] && S.fac[f.id].state === 'pending' ? f.cost : 0), 0);

export const facUpkeep = () => allFacs().reduce((a, f) => a + (done(f.id) ? f.upkeep : 0), 0);
