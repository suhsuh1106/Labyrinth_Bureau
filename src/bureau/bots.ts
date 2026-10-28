// 국장 봇 셋: 시뮬레이터(`sim/bureau.ts`) · 테스트 · 개발용 확인 화면(`dev/loops.html`)이 함께 쓴다.
// idle(손 놓음, 요청서도 답하지 않음) · normal(위험 수위 보고를 보면 보조금, 요청서는 다 들어줌, 사이가 크게 틀어지면 두 길드만 불러 회의)
// smart(늦은 보고를 추세로 메우고, 예산 · 조항 · 영주 몫, 청은 신세를 받아 둔 쪽엔 반만, 사이가 틀어지기 전에 영주까지 불러 회의)
import { B, type World, answer, meet, relOf, seenLevel, willOf } from './engine';

export const BOT: Record<string, (W: World) => void> = {
  idle: () => {},
  normal: W => {
    W.dungeons.forEach((d, i) => { d.sub = seenLevel(W, i) >= B.DANGER && W.budget > 0 ? 15 : 0; });
    for (const a of W.asks) if (a.got == null) answer(W, a.id, W.budget > a.want * 2 ? a.want : 0);
    if (relOf(W, 'big', 'small') < -40) meet(W, ['big', 'small']);
  },
  smart: W => {
    // 보고는 거리만큼 늦다: 추세를 더해 오늘 수위를 어림하고, 위험 수위에 닿기 전에 들인다.
    // 보조금은 상대 값이라 여기저기 주면 아무 데도 안 준 것과 같다: 가장 급한 두 곳에만, 수위가 내려갈 때까지
    const est = W.dungeons.map((d, i) => {
      const s = W.seen[i], now = s.at(-1)!, trend = (now - (s.at(-6) ?? now)) / 5;
      return now + trend * (d.dist + 1);
    });
    let k = 0;
    W.dungeons.map((_, i) => i).sort((a, b) => est[b] - est[a]).forEach(i => {
      const d = W.dungeons[i], hot = est[i] >= 65 || (d.sub > 0 && est[i] >= 62);
      d.sub = W.budget > 0 && hot && k < 2 ? 15 : 0;
      if (d.sub) k++;
    });
    // 큰 길드가 눈에 띄면 우선권을 중소 연합 쪽으로, 영주가 식으면 몫을 조금 올린다
    const G = W.guilds;
    W.prio = Math.round(Math.max(30, Math.min(60, 50 - (G.big.infl - G.small.infl) / 4)));
    W.lordShare = W.lord.fav < 45 ? Math.min(25, W.lordShare + 1) : W.lord.fav > 60 ? Math.max(5, W.lordShare - 1) : W.lordShare;
    // 독촉은 갚고, 청은 신세를 이미 받아 둔 쪽에는 반만 들어준다(예산을 아껴 회의 서명에 쓸 신세를 고루 모은다)
    for (const a of W.asks) if (a.got == null && W.budget > a.want) answer(W, a.id, a.kind === 'dun' || W.owe[a.from] < 5 ? a.want : a.want / 2);
    // 사이가 틀어지기 전에, 두 길드가 서명할 마음이 있을 때 영주까지 불러 회의
    if (relOf(W, 'big', 'small') < -25 && Math.min(willOf(W, 'big'), willOf(W, 'small')) >= B.SIGN_AT - 5) meet(W, ['big', 'small', 'lord']);
  },
};
