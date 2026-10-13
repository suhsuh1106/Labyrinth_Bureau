// 탐사 엔진: 우리 조 하나가 미궁에 들어가 돌아오기까지 (다키스트 던전처럼).
//   최대 days일. 첫날 횃불 하나를 켜고, 그 뒤로는 날마다 rate의 확률로 하나를 더 태운다. 태울 횃불이 없으면 그날 돌아서고,
//   남은 사람마다 어둠 속 위기를 맞을 수 있다(darkMin + 진 날 위기 × darkBack).
//   날마다 그 층 몬스터 하나를 무게(w)대로 만나 조원마다 굴린다. 둘 이상 해내면 이긴다(혼자 남았으면 혼자 해내면).
//   이긴 날만 해낸 몫만큼 전리품을 짐에 싣고(하루 한 조 다 해내면 lootSlot칸) 그 몬스터를 갈무리한다.
//   위기는 날마다 조원마다 한 달 몫의 1/days (진 사람은 크게). 짐 칸이 다 차면 돌아서고, 둘이 죽으면 물러난다.
// 이 파일은 하루하루를 굴리기만 한다. 성공률 · 위기 · 포션 · 사망 · 갈무리 · 도감 기록은 runMonth가 넘겨 준 함수가 정한다.
// 경쟁 용병단과 계약 파티는 숫자로 한 번 굴리고 여기를 거치지 않는다
import { rnd } from './rng';

// 탐사 하루: 만난 몬스터, 이겼나, 해낸 사람 / 나선 사람, 실은 짐 칸, 갈무리한 것, 위기 · 사망
// pk · tl · pl: 그날이 끝났을 때 전리품으로 찬 짐 칸, 남은 횃불, 남은 포션 (귀환 연출이 짐 막대를 날마다 그린다)
export type Day = { mon: string; win: boolean; k: number; n: number; loot?: number; mats: [string, number][]; cr: number; d: number; pk?: number; tl?: number; pl?: number };
// 탐사 한 번: 들고 간 횃불 · 태운 횃불, 짐 칸 · 전리품을 채운 칸 · 남은 횃불과 포션이 차지한 칸, 돌아선 까닭, 어둠 속 위기
export type Trip = { torch: number; tu: number; slots: number; pack: number; rest: number; end: 'done' | 'torch' | 'pack' | 'flee'; dark: number };

export type TripCfg = {
  size: number; days: number; slots: number; torch: number; rate: number;
  names: string[]; w: number[];   // 그 층 몬스터와 만날 무게
  lootSlot: number; darkMin: number; darkBack: number; party: number;
  pots: () => number;   // 지금 남은 포션 (위기에 쓰면 hit 안에서 준다)
  pm: (m: number, j: number) => number;   // 조원 m이 몬스터 j를 상대로 해낼 확률
  crP: (m: number, ok: boolean, j: number) => number;   // 한 달 몫의 위기 확률 (j < 0이면 어둠 속 귀환)
  hit: (m: number, day: number) => '' | 'd' | 'h';   // 위기 하나 (day는 몇째 날, 0이면 어둠 속 귀환). 'd'면 그 사람은 죽었다
  loot: (m: number) => number;   // 조원 m이 캐 오는 몫
  win: (j: number, kd: number) => [string, number][];   // 이긴 날의 갈무리
  meet?: (j: number, up: number[], win: boolean, cr: number, k: number) => void;   // 만난 것을 적는다 (도감 · 단장 조사)
};

const pickW = (ws: number[]) => { let x = rnd() * ws.reduce((a, b) => a + b, 0); for (let i = 0; i < ws.length; i++) { x -= ws[i]; if (x <= 0) return i; } return ws.length - 1; };

export function runTrip(C: TripCfg) {
  const gone = new Set<number>(), wins = Array(C.size).fill(0), seen = Array(C.size).fill(0), days: Day[] = [];
  let tu = 0, pack = 0, lootSum = 0, end: Trip['end'] = 'done';
  for (let day = 0; day < C.days; day++) {
    const up = Array.from({ length: C.size }, (_, m) => m).filter(m => !gone.has(m));
    if (!up.length || gone.size >= 2) { end = 'flee'; break; }
    if (day === 0 || rnd() < C.rate) { if (tu < C.torch) tu++; else { end = 'torch'; break; } }
    const j = pickW(C.w);
    const dd = up.map(m => rnd() < C.pm(m, j)), kd = dd.filter(Boolean).length, win = kd >= Math.min(2, up.length);
    up.forEach((m, x) => { seen[m]++; if (dd[x]) wins[m]++; });
    const D: Day = { mon: C.names[j], win, k: kd, n: up.length, mats: [], cr: 0, d: 0 };
    if (win) {
      // 전리품: 해낸 사람 몫만큼 짐 칸을 채운다 (다 쓴 횃불 · 포션 칸도 쓴다). 칸이 모자라면 두고 온다
      const l = up.reduce((a, m, x) => a + (dd[x] ? C.loot(m) : 0), 0) / C.party, need = l * C.lootSlot;
      const room = Math.max(0, C.slots - (C.torch - tu) - C.pots() - pack), take = Math.min(need, room);
      pack += take; lootSum += need ? l * take / need : 0; D.loot = Math.round(take * 10) / 10;
      if (take < need) end = 'pack';
      D.mats = C.win(j, kd);
    }
    up.forEach((m, x) => { if (rnd() < C.crP(m, dd[x], j) / C.days) { D.cr++; if (C.hit(m, day + 1) === 'd') { D.d++; gone.add(m); } } });
    if (C.meet) C.meet(j, up, win, D.cr, kd);
    D.pk = Math.round(pack * 10) / 10; D.tl = C.torch - tu; D.pl = C.pots();
    days.push(D);
    if (end === 'pack') break;
  }
  // 어둠 속 귀환: 횃불이 떨어지면 남은 사람마다 위기를 한 번 더 맞을 수 있다
  let dark = 0;
  if (end === 'torch') Array.from({ length: C.size }, (_, m) => m).filter(m => !gone.has(m)).forEach(m => {
    if (rnd() < Math.min(0.9, C.darkMin + C.crP(m, false, -1) * C.darkBack)) { dark++; if (C.hit(m, 0) === 'd') gone.add(m); }
  });
  const trip: Trip = { torch: C.torch, tu, slots: C.slots, pack: Math.round(pack * 10) / 10, rest: C.torch - tu + C.pots(), end, dark };
  return { days, trip, wins, seen, lootSum, tu };
}
