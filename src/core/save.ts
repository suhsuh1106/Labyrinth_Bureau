// 저장 데이터 불러오기. 맞는 버전이 없으면 새 게임으로 시작한다
import { project } from './economy';
import { S, newGame, setState } from './state';

export const SAVE_VERSION = 14;

export function loadGame(data?: { S?: any }) {
  newGame();
  const d = data && data.S;
  if (d && d.v >= 11 && d.v <= 13) {
    // 버전 11~13 저장은 보급품, 용사 파티, 장부, 개척기 중 일부가 없을 수 있다. 빠진 값은 새 게임 기본값으로 채우고,
    // 보급품 예산은 이번 달 필요량을 100% 채우는 금액으로 넣는다. 개척기 이전 저장은 이미 운영 중인 관리국이다
    const fresh = S; setState(d); S.v = SAVE_VERSION;
    if (!('phase' in S)) {
      Object.assign(S, { phase: 'run', runStart: S.month, devPick: {}, unsold: 0, lootMul: 1, mPriceAdj: 0, soldBacklog: 0,
        dev: { gate: { opt: 0, left: 0 }, supply: { opt: 2, left: 0 }, market: { opt: 0, left: 0 } } });
      S.flags.church_greet = 1; S.agendaDone.church_greet = S.agendaDone.merchant_greet = true;
    }
    Object.keys(fresh).forEach(k => { if (!(k in S)) S[k] = fresh[k]; });
    const noProv = S.budget.food == null;
    Object.keys(fresh.budget).forEach(k => { if (S.budget[k] == null) S.budget[k] = 0; });
    if (noProv) {
      const pv = project({ ...S.budget, food: 1e9, repair: 1e9, haul: 1e9 }).pv;
      ['food', 'repair', 'haul'].forEach(k => { S.budget[k] = Math.ceil(pv[k].full / 100) * 100; });
    }
  } else if (d && d.v === SAVE_VERSION) setState(d);
}
