// 탐사 엔진: 우리 조 하나가 미궁에 들어가 돌아오기까지 (다키스트 던전처럼).
//   최대 days일. 첫날 횃불 하나를 켜고, 그 뒤로는 날마다 rate의 확률로 하나를 더 태운다. 태울 횃불이 없으면 그날 돌아서고,
//   남은 사람마다 어둠 속 위기를 맞을 수 있다(darkMin + 진 날 위기 × darkBack).
//   하루는 enc번의 마주침이다. 마주침마다 그 층 몬스터 하나를 무게(w)대로 만나 조원마다 굴린다. 둘 이상 해내면 이긴다(혼자 남았으면 혼자 해내면).
//   해낸 몫만큼 전리품을 짐에 싣고(하루 한 조 다 해내면 lootSlot칸, 진 날은 loseLoot배) 이긴 날은 그 몬스터를 갈무리한다.
//   부상 주사위: 해내지 못한 사람은 주사위를 굴린다. 걸리면 포션이 있으면 한 병 써서 막고, 없으면 다치고(그 탐사 동안 성공 −injPen, 다음 달 쉰다),
//   다친 채 또 걸리면 죽는다.
//   식량: 하루 한 사람에 하나를 먹고, 모자라면 굶은 사람은 그날 성공 −hungerPen. 정비 도구: 진 날 하나 써서 무기를 고친다. 없으면 무뎌져 그 뒤로 날마다 성공 −toolPen씩 쌓인다. 짐 칸이 다 차면 돌아서고, 둘이 죽으면 물러난다.
// 탐사는 날마다 한 걸음씩 굴린다(stepTrip): 그날의 성공률 · 위기는 그날의 판 상태로 다시 셈한다. 이 파일은 하루하루를 굴리기만 한다. 성공률 · 위기 · 포션 · 사망 · 갈무리 · 도감 기록은 runMonth가 넘겨 준 함수가 정한다.
// 경쟁 용병단과 계약 파티는 숫자로 한 번 굴리고 여기를 거치지 않는다
import { rnd } from './rng';

// 탐사 하루: 만난 몬스터, 이겼나, 해낸 사람 / 나선 사람, 실은 짐 칸, 갈무리한 것, 위기 · 사망
// pk · tl · pl: 그날이 끝났을 때 전리품으로 찬 짐 칸, 남은 횃불, 남은 포션 (귀환 연출이 짐 막대를 날마다 그린다)
// cr: 부상 주사위에 걸린 수, sv: 포션으로 살린 수, d: 죽은 수, hu: 그날 끝에 다쳐 있는 사람, hg: 굶은 사람, fx: 정비 도구로 고침, bl: 무뎌진 정도
// fl · ol: 그날 끝에 남은 식량 · 정비 도구
// ms: 조원마다 한 글자 (조원 순서대로). - 없음(앞서 죽음) · o 해냄 · x 못 해냄 · p 주사위에 걸려 포션으로 막음 · h 다침 · d 죽음 · s 죽을 뻔하고 버팀 (탐사 재생 장면이 읽는다)
export type Day = { dd?: number; mon: string; win: boolean; k: number; n: number; loot?: number; mats: [string, number][]; cr: number; d: number; sv?: number; hu?: number; pk?: number; tl?: number; pl?: number; hg?: number; fx?: number; bl?: number; fl?: number; ol?: number; ms?: string };
// 탐사 한 번: 다닌 날(fd), 들고 간 횃불 · 태운 횃불, 짐 칸 · 전리품을 채운 칸 · 남은 횃불과 포션이 차지한 칸, 돌아선 까닭, 어둠 속 위기
// food · fu: 들고 간 식량(사람×날) · 먹은 것, tools · tk: 들고 간 정비 도구 · 쓴 것, blunt: 고치지 못하고 끝난 진 날 (무뎌짐)
// dm: 어둠 속 귀환에서 조원마다 한 글자 (Day.ms와 같은 글자, 주사위에 안 걸렸으면 o)
export type Trip = { fd?: number; torch: number; tu: number; slots: number; pack: number; rest: number; end: 'done' | 'torch' | 'pack' | 'flee'; dark: number; food?: number; fu?: number; tools?: number; tk?: number; blunt?: number; dm?: string };

export type TripCfg = {
  size: number; days: number; enc?: number; slots: number; torch: number; rate: number;   // enc: 하루에 마주치는 몬스터 수
  names: string[]; w: number[];   // 그 층 몬스터와 만날 무게
  lootSlot: number; darkMin: number; darkBack: number; party: number;
  injPen: number;   // 다친 사람의 성공 굴림에서 빼는 값
  loseLoot: number;   // 진 날에도 해낸 사람 몫의 이만큼은 싣는다
  food: number; foodSlot: number; hungerPen: number;   // 들고 간 식량(사람 × 날), 짐 한 칸에 드는 식량, 굶은 사람의 성공 −
  tools: number; toolPen: number;   // 들고 간 정비 도구, 진 날 고치지 못하면 쌓이는 성공 −
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

// 탐사의 지금 상태 (저장할 수 있는 모양). 탐사는 날마다 한 걸음씩 굴린다: 그날의 성공률 · 위기는 그날의 판 상태로 다시 셈한다
export type TripState = { day: number; e?: number; lost?: boolean; hg?: number; gone: number[]; hurt: number[]; wins: number[]; seen: number[]; days: Day[]; tu: number; pack: number; lootSum: number;
  end: Trip['end']; food: number; tools: number; blunt: number; fu: number; tk: number; done: boolean };
export function startTrip(size: number, food: number, tools: number): TripState {
  return { day: 0, gone: [], hurt: [], wins: Array(size).fill(0), seen: Array(size).fill(0), days: [], tu: 0, pack: 0, lootSum: 0, end: 'done', food, tools, blunt: 0, fu: 0, tk: 0, done: false };
}
// 부상 주사위: 걸리면 포션이 먼저 막고(성수면 그 탐사 동안의 부상도 낫는다), 없으면 다치고, 다친 채 또 걸리면 죽는다
// 돌려주는 글자: '' 안 걸림 · p 포션으로 막음 · h 다침 · d 죽음 · s 죽을 뻔하고 버팀
function dice(C: TripCfg, S: TripState, m: number, j: number, day: number, D: { cr: number; d: number; sv?: number }) {
  if (rnd() >= C.injP(m, j)) return '';
  D.cr++;
  const pot = C.usePot(); if (pot) { D.sv = (D.sv || 0) + 1; if (pot === 'holy') S.hurt = S.hurt.filter(x => x !== m); return 'p'; }
  if (!S.hurt.includes(m)) { S.hurt.push(m); C.hurt(m, day); return 'h'; }
  if (C.kill(m, day)) { D.d++; S.gone.push(m); return 'd'; }
  return 's';
}
// 마주침 하나를 굴린다 (끝났으면 S.done). 하루는 enc번의 마주침이다: 그날 첫 마주침에 횃불을 켜고(그 뒤로는 확률로 하나 더) 식량을 먹고,
// 마주침마다 그 층 몬스터 하나를 만나 조원마다 굴리고 짐을 싣고 갈무리하고 부상 주사위를 굴린다. 그날 진 마주침이 있으면 그날 끝에 정비 도구 하나
export function stepTrip(C: TripCfg, S: TripState) {
  if (S.done) return;
  if (S.day >= C.days) { S.done = true; return; }
  const enc = C.enc || 1, e = S.e || 0, day = S.day, gone = new Set(S.gone), hurt = new Set(S.hurt);
  // 짐 칸: 남은 횃불 · 포션 · 정비 도구가 한 칸씩, 식량은 foodSlot개가 한 칸
  const held = () => (C.torch - S.tu) + C.pots() + S.food / C.foodSlot + S.tools;
  const up = Array.from({ length: C.size }, (_, m) => m).filter(m => !gone.has(m));
  if (!up.length || gone.size >= 2) { S.end = 'flee'; S.done = true; return; }
  if (e === 0) {
    if (day === 0 || rnd() < C.rate) { if (S.tu < C.torch) S.tu++; else { S.end = 'torch'; S.done = true; return; } }
    // 식량: 하루 한 사람에 하나. 모자라면 뒷사람부터 굶는다 (굶은 사람은 그날 성공 −hungerPen)
    const eat = Math.min(S.food, up.length); S.food -= eat; S.fu += eat; S.hg = up.length - eat; S.lost = false;
  }
  const hungry = new Set(up.slice(up.length - (S.hg || 0)));
  const j = pickW(C.w);
  const dd = up.map(m => rnd() < Math.max(0.03, C.pm(m, j) - (hurt.has(m) ? C.injPen : 0) - (hungry.has(m) ? C.hungerPen : 0) - S.blunt * C.toolPen)), kd = dd.filter(Boolean).length, win = kd >= Math.min(2, up.length);
  up.forEach((m, x) => { S.seen[m]++; if (dd[x]) S.wins[m]++; });
  const D: Day = { dd: day + 1, mon: C.names[j], win, k: kd, n: up.length, mats: [], cr: 0, d: 0, ...(hungry.size ? { hg: hungry.size } : {}) };
  if (kd) {
    // 전리품: 해낸 사람 몫만큼 짐 칸을 채운다 (진 마주침은 loseLoot배만. 다 쓴 횃불 · 포션 칸도 쓴다). 칸이 모자라면 두고 온다
    const l = up.reduce((a, m, x) => a + (dd[x] ? C.loot(m) : 0), 0) / C.party * (win ? 1 : C.loseLoot), need = l * C.lootSlot;
    const room = Math.max(0, C.slots - held() - S.pack), take = Math.min(need, room);
    S.pack += take; S.lootSum += need ? l * take / need : 0; D.loot = Math.round(take * 10) / 10;
    if (take < need) S.end = 'pack';
    if (win) D.mats = C.win(j, kd);
  }
  const ms = Array(C.size).fill('-');
  up.forEach((m, x) => { ms[m] = dd[x] ? 'o' : dice(C, S, m, j, day + 1, D) || 'x'; });
  D.ms = ms.join('');
  if (!win) S.lost = true;
  const last = e + 1 >= enc || S.end === 'pack';
  // 정비 도구: 진 마주침이 있었던 날은 그날 끝에 무기가 상한다. 도구가 있으면 하나 써서 고치고, 없으면 무뎌진 채로 다닌다 (그 뒤로 성공 −toolPen씩 쌓임)
  if (last && S.lost) { if (S.tools > 0) { S.tools--; S.tk++; D.fx = 1; } else { S.blunt++; D.bl = S.blunt; } }
  if (C.meet) C.meet(j, up, win, D.cr, kd);
  const g2 = new Set(S.gone);
  D.pk = Math.round(S.pack * 10) / 10; D.tl = C.torch - S.tu; D.pl = C.pots(); D.fl = S.food; D.ol = S.tools; D.hu = S.hurt.filter(m => !g2.has(m)).length;
  S.days.push(D);
  if (last) { S.day++; S.e = 0; } else S.e = e + 1;
  if (S.end === 'pack' || S.day >= C.days) S.done = true;
}
// 탐사를 마친다: 횃불이 떨어졌으면 남은 사람마다 어둠 속 귀환의 부상 주사위를 한 번 더 (darkMin + 그 층 주사위 × darkBack)
export function finishTrip(C: TripCfg, S: TripState) {
  const DK = { cr: 0, d: 0 }, dm = Array(C.size).fill('-');
  if (S.end === 'torch') Array.from({ length: C.size }, (_, m) => m).filter(m => !S.gone.includes(m)).forEach(m => { dm[m] = dice(C, S, m, -1, 0, DK) || 'o'; });
  const rest = (C.torch - S.tu) + C.pots() + S.food / C.foodSlot + S.tools;
  const trip: Trip = { fd: S.day + (S.e ? 1 : 0), torch: C.torch, tu: S.tu, slots: C.slots, pack: Math.round(S.pack * 10) / 10, rest: Math.round(rest * 10) / 10, end: S.end, dark: DK.cr, food: C.food, fu: S.fu, tools: C.tools, tk: S.tk, blunt: S.blunt, ...(S.end === 'torch' ? { dm: dm.join('') } : {}) };
  return { days: S.days, trip, wins: S.wins, seen: S.seen, lootSum: S.lootSum, tu: S.tu, fu: S.fu, tk: S.tk, foodLeft: S.food, toolsLeft: S.tools };
}
// 하루를 굴린다 (그날의 마주침을 모두, 끝났으면 S.done)
export function stepDay(C: TripCfg, S: TripState) {
  const d = S.day;
  while (!S.done && S.day === d) stepTrip(C, S);
}
// 한꺼번에 굴리기 (하루씩 굴리는 것과 같다)
export function runTrip(C: TripCfg) {
  const S = startTrip(C.size, C.food, C.tools);
  while (!S.done) stepTrip(C, S);   // (마주침마다 한 걸음)
  return finishTrip(C, S);
}
