// 탐사 엔진: 우리 조 하나가 미궁에 들어가 돌아오기까지 (다키스트 던전처럼).
//   최대 days일. 첫날 횃불 하나를 켜고, 그 뒤로는 날마다 rate의 확률로 하나를 더 태운다. 태울 횃불이 없으면 그날 돌아서고,
//   남은 사람마다 어둠 속 위기를 맞을 수 있다(darkMin + 진 날 위기 × darkBack).
//   날마다 그 층 몬스터 하나를 무게(w)대로 만나 조원마다 굴린다. 둘 이상 해내면 이긴다(혼자 남았으면 혼자 해내면).
//   해낸 몫만큼 전리품을 짐에 싣고(하루 한 조 다 해내면 lootSlot칸, 진 날은 loseLoot배) 이긴 날은 그 몬스터를 갈무리한다.
//   부상 주사위: 해내지 못한 사람은 주사위를 굴린다. 걸리면 포션이 있으면 한 병 써서 막고, 없으면 다치고(그 탐사 동안 성공 −injPen, 다음 달 쉰다),
//   다친 채 또 걸리면 죽는다. 짐 칸이 다 차면 돌아서고, 둘이 죽으면 물러난다.
// 이 파일은 하루하루를 굴리기만 한다. 성공률 · 위기 · 포션 · 사망 · 갈무리 · 도감 기록은 runMonth가 넘겨 준 함수가 정한다.
// 경쟁 용병단과 계약 파티는 숫자로 한 번 굴리고 여기를 거치지 않는다
import { rnd } from './rng';

// 탐사 하루: 만난 몬스터, 이겼나, 해낸 사람 / 나선 사람, 실은 짐 칸, 갈무리한 것, 위기 · 사망
// pk · tl · pl: 그날이 끝났을 때 전리품으로 찬 짐 칸, 남은 횃불, 남은 포션 (귀환 연출이 짐 막대를 날마다 그린다)
// cr: 부상 주사위에 걸린 수, sv: 포션으로 살린 수, d: 죽은 수, hu: 그날 끝에 다쳐 있는 사람
export type Day = { mon: string; win: boolean; k: number; n: number; loot?: number; mats: [string, number][]; cr: number; d: number; sv?: number; hu?: number; pk?: number; tl?: number; pl?: number };
// 탐사 한 번: 들고 간 횃불 · 태운 횃불, 짐 칸 · 전리품을 채운 칸 · 남은 횃불과 포션이 차지한 칸, 돌아선 까닭, 어둠 속 위기
export type Trip = { torch: number; tu: number; slots: number; pack: number; rest: number; end: 'done' | 'torch' | 'pack' | 'flee'; dark: number };

export type TripCfg = {
  size: number; days: number; slots: number; torch: number; rate: number;
  names: string[]; w: number[];   // 그 층 몬스터와 만날 무게
  lootSlot: number; darkMin: number; darkBack: number; party: number;
  injPen: number;   // 다친 사람의 성공 굴림에서 빼는 값
  loseLoot: number;   // 진 날에도 해낸 사람 몫의 이만큼은 싣는다
  pots: () => number;   // 지금 남은 포션
  pm: (m: number, j: number) => number;   // 조원 m이 몬스터 j를 상대로 해낼 확률 (다치기 전)
  injP: (m: number, j: number) => number;   // 해내지 못한 조원 m이 부상 주사위에 걸릴 확률 (j < 0이면 어둠 속 귀환)
  hurt: (m: number, day: number) => void;   // 처음 다쳤다 (다음 달 쉰다)
  usePot: () => false | 'pot' | 'holy';   // 주사위에 걸리면 먼저 포션 한 병으로 막는다 (포션이 없으면 false). 성수면 그 탐사 동안의 부상도 낫는다
  kill: (m: number, day: number) => boolean;   // 포션 없이 또 걸렸다: 죽으면 true (단장 · 의무실 · 강골은 버틸 수 있다)
  loot: (m: number) => number;   // 조원 m이 캐 오는 몫
  win: (j: number, kd: number) => [string, number][];   // 이긴 날의 갈무리
  meet?: (j: number, up: number[], win: boolean, cr: number, k: number) => void;   // 만난 것을 적는다 (도감 · 단장 조사)
};

const pickW = (ws: number[]) => { let x = rnd() * ws.reduce((a, b) => a + b, 0); for (let i = 0; i < ws.length; i++) { x -= ws[i]; if (x <= 0) return i; } return ws.length - 1; };

export function runTrip(C: TripCfg) {
  const gone = new Set<number>(), hurt = new Set<number>(), wins = Array(C.size).fill(0), seen = Array(C.size).fill(0), days: Day[] = [];
  let tu = 0, pack = 0, lootSum = 0, end: Trip['end'] = 'done';
  // 부상 주사위: 처음 걸리면 다치고(그 탐사 동안 성공 −injPen), 다친 채 또 걸리면 포션으로 살리거나 죽는다
  // 포션이 1차 방어다: 걸리면 먼저 포션을 한 병 써서 막는다(성수면 그 탐사 동안의 부상도 낫는다). 포션이 없으면 다치고, 다친 채 또 걸리면 죽는다
  const dice = (m: number, j: number, day: number, D: { cr: number; d: number; sv?: number }) => {
    if (rnd() >= C.injP(m, j)) return;
    D.cr++;
    const pot = C.usePot(); if (pot) { D.sv = (D.sv || 0) + 1; if (pot === 'holy') hurt.delete(m); return; }
    if (!hurt.has(m)) { hurt.add(m); C.hurt(m, day); return; }
    if (C.kill(m, day)) { D.d++; gone.add(m); }
  };
  for (let day = 0; day < C.days; day++) {
    const up = Array.from({ length: C.size }, (_, m) => m).filter(m => !gone.has(m));
    if (!up.length || gone.size >= 2) { end = 'flee'; break; }
    if (day === 0 || rnd() < C.rate) { if (tu < C.torch) tu++; else { end = 'torch'; break; } }
    const j = pickW(C.w);
    const dd = up.map(m => rnd() < Math.max(0.03, C.pm(m, j) - (hurt.has(m) ? C.injPen : 0))), kd = dd.filter(Boolean).length, win = kd >= Math.min(2, up.length);
    up.forEach((m, x) => { seen[m]++; if (dd[x]) wins[m]++; });
    const D: Day = { mon: C.names[j], win, k: kd, n: up.length, mats: [], cr: 0, d: 0 };
    if (kd) {
      // 전리품: 해낸 사람 몫만큼 짐 칸을 채운다 (진 날은 loseLoot배만. 다 쓴 횃불 · 포션 칸도 쓴다). 칸이 모자라면 두고 온다
      const l = up.reduce((a, m, x) => a + (dd[x] ? C.loot(m) : 0), 0) / C.party * (win ? 1 : C.loseLoot), need = l * C.lootSlot;
      const room = Math.max(0, C.slots - (C.torch - tu) - C.pots() - pack), take = Math.min(need, room);
      pack += take; lootSum += need ? l * take / need : 0; D.loot = Math.round(take * 10) / 10;
      if (take < need) end = 'pack';
      if (win) D.mats = C.win(j, kd);
    }
    up.forEach((m, x) => { if (!dd[x]) dice(m, j, day + 1, D); });
    if (C.meet) C.meet(j, up, win, D.cr, kd);
    D.pk = Math.round(pack * 10) / 10; D.tl = C.torch - tu; D.pl = C.pots(); D.hu = hurt.size - [...hurt].filter(m => gone.has(m)).length;
    days.push(D);
    if (end === 'pack') break;
  }
  // 어둠 속 귀환: 횃불이 떨어지면 남은 사람마다 부상 주사위를 한 번 더 (darkMin + 그 층 주사위 × darkBack)
  const DK = { cr: 0, d: 0 };
  if (end === 'torch') Array.from({ length: C.size }, (_, m) => m).filter(m => !gone.has(m)).forEach(m => dice(m, -1, 0, DK));
  const trip: Trip = { torch: C.torch, tu, slots: C.slots, pack: Math.round(pack * 10) / 10, rest: C.torch - tu + C.pots(), end, dark: DK.cr };
  return { days, trip, wins, seen, lootSum, tu };
}
