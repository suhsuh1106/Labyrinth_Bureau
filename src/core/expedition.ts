// 탐사 엔진: 우리 조 하나가 미궁에 들어가 돌아오기까지 (다키스트 던전처럼, 그 위에 몬스터 헌터의 채집과 사냥).
//   탐사 한 번은 구간 몇 개다(segs: 날마다 구간 수, 층마다 5 · 6 · 6 · 7 · 7구간). 구간마다 사건 하나를 무게(evs)대로 뽑는다:
//     채집 지점(g): 조원마다 채집 굴림. 해낸 몫만큼 채집품(기본 소재)을 짐에 싣는다(둘 미만이면 loseLoot배). 몬스터를 상대하지 않아 부상 주사위가 없다.
//     조우(f): 그 층 몬스터 하나를 만나 조원마다 굴린다. 둘 이상 해내면 이긴다(혼자 남았으면 혼자 해내면). 해낸 만큼 갈무리해 전리품(사냥 소재)을 짐에 싣는다(한 점에 matSlot칸, 진 조우는 적게).
//     흔적(t): 조원마다 굴려 지도를 그린다. 그린 것(탁본 · 표식 · 측량 기록)도 짐이다(다 해내면 trailSlot칸). 못 해낸 사람은 부상 주사위(조우보다 약하게).
//   셋 모두 짐 칸을 채운다. 칸이 모자라면 남는 것은 두고 오고 돌아선다.
//   채집 · 흔적에서 둘 미만 해내면 ambush의 확률로 들켜, 다음 구간은 조우가 된다.
//   횃불: 첫 구간에 하나를 켜고, 그 뒤로는 구간마다 rate의 확률로 하나를 더 태운다. 태울 횃불이 없으면 돌아서고,
//   남은 사람마다 어둠 속 위기를 맞을 수 있다(darkMin + 그 층 주사위 × darkBack).
//   부상 주사위: 해내지 못한 사람은 주사위를 굴린다. 걸리면 포션이 있으면 한 병 써서 막고, 없으면 다치고(그 탐사 동안 성공 −injPen, 다음 달 쉰다),
//   다친 채 또 걸리면 죽는다.
//   식량: 하루 한 사람에 하나를 먹고, 모자라면 굶은 사람은 그날 성공 −hungerPen. 정비 도구: 진 조우가 있었던 날 끝에 하나 써서 무기를 고친다. 없으면 무뎌져 그 뒤로 성공 −toolPen씩 쌓인다.
//   짐 칸이 다 차면 돌아서고, 둘이 죽으면 물러난다.
// 탐사는 구간마다 한 걸음씩 굴린다(stepTrip, 하루는 stepDay): 성공률 · 위기는 그날의 판 상태로 다시 셈한다. 이 파일은 굴리기만 한다.
// 성공률 · 위기 · 포션 · 사망 · 갈무리 · 도감 기록은 runMonth가 넘겨 준 함수가 정한다.
// 경쟁 용병단은 숫자로 한 번 굴리고 여기를 거치지 않는다
import { rnd } from './rng';

// 탐사 구간 하나: 사건(ev: g 채집 지점 · t 흔적, 없으면 조우), 만난 몬스터(조우만), 해냈나(둘 이상), 해낸 사람 / 나선 사람, 실은 짐 칸, 갈무리한 것, 위기 · 사망
// am: 채집 · 흔적에서 들켜 만난 조우
// pk · pm · pt · tl · pl: 그 구간이 끝났을 때 채집품 · 전리품 · 지도 기록으로 찬 짐 칸, 남은 횃불, 남은 포션 (귀환 연출이 짐 막대를 구간마다 그린다)
// cr: 부상 주사위에 걸린 수, sv: 포션으로 살린 수, d: 죽은 수, hu: 그 구간 끝에 다쳐 있는 사람, hg: 굶은 사람, fx: 정비 도구로 고침, bl: 무뎌진 정도
// fl · ol: 그 구간 끝에 남은 식량 · 정비 도구
// ms: 조원마다 한 글자 (조원 순서대로). - 없음(앞서 죽음) · o 해냄 · x 못 해냄 · p 주사위에 걸려 포션으로 막음 · h 다침 · d 죽음 · s 죽을 뻔하고 버팀 (탐사 재생 장면이 읽는다)
export type EvKind = 'g' | 'f' | 't';
export type Day = { dd?: number; ev?: 'g' | 't'; mon?: string; am?: 1; win: boolean; k: number; n: number; loot?: number; mats: [string, number][]; cr: number; d: number; sv?: number; hu?: number; pk?: number; pm?: number; pt?: number; tl?: number; pl?: number; hg?: number; fx?: number; bl?: number; fl?: number; ol?: number; ms?: string };
export const evOf = (d: Day): EvKind => d.ev || 'f';
// 탐사 한 번: 다닌 날(fd), 들고 간 횃불 · 태운 횃불, 짐 칸 · 채집품 · 전리품(pm) · 지도 기록(pt)을 채운 칸 · 남은 횃불과 포션이 차지한 칸, 돌아선 까닭, 어둠 속 위기
// food · fu: 들고 간 식량(사람×날) · 먹은 것, tools · tk: 들고 간 정비 도구 · 쓴 것, blunt: 고치지 못하고 끝난 진 날 (무뎌짐)
// dm: 어둠 속 귀환에서 조원마다 한 글자 (Day.ms와 같은 글자, 주사위에 안 걸렸으면 o)
export type Trip = { fd?: number; torch: number; tu: number; slots: number; pack: number; pm?: number; pt?: number; rest: number; end: 'done' | 'torch' | 'pack' | 'flee'; dark: number; food?: number; fu?: number; tools?: number; tk?: number; blunt?: number; dm?: string };

// 사건: 한 구간에 하나. g 채집 지점, f 그 층 몬스터 j와의 조우, t 흔적
export type Ev = { k: EvKind; j?: number; w: number };

export type TripCfg = {
  size: number; segs: number[]; slots: number; torch: number; rate: number;   // segs: 날마다 구간 수, rate: 구간마다 횃불 하나를 더 태울 확률
  names: string[];   // 그 층 몬스터 이름
  evs: Ev[];   // 구간마다 뽑을 사건과 무게
  ambush: number;   // 채집 · 흔적에서 둘 미만 해냈을 때 다음 구간이 조우가 될 확률
  lootSlot: number; matSlot: number; trailSlot: number;   // 짐 칸: 채집품(옛 마주침 몫마다) · 전리품 한 점 · 흔적 하나를 다 해냈을 때
  darkMin: number; darkBack: number; party: number;
  injPen: number;   // 다친 사람의 성공 굴림에서 빼는 값
  loseLoot: number;   // 채집에서 둘 미만 해내도 해낸 사람 몫의 이만큼은 싣는다
  food: number; foodSlot: number; hungerPen: number;   // 들고 간 식량(사람 × 날), 짐 한 칸에 드는 식량, 굶은 사람의 성공 −
  tools: number; toolPen: number;   // 들고 간 정비 도구, 진 날 고치지 못하면 쌓이는 성공 −
  pots: () => number;   // 지금 남은 포션
  pm: (m: number, j: number) => number;   // 조원 m이 몬스터 j를 상대로 해낼 확률 (다치기 전)
  gp: (m: number) => number;   // 조원 m이 채집 지점에서 해낼 확률
  tp: (m: number) => number;   // 조원 m이 흔적을 따라 해낼 확률
  hid?: (m: number) => number;   // 그 확률에 든 숨은 몫 (기대에서 뺀다: 기대는 행정관이 아는 것만으로)
  injP: (m: number, j: number) => number;   // 해내지 못한 조원 m이 부상 주사위에 걸릴 확률 (j: 몬스터, −1 어둠 속 귀환, −2 흔적)
  hurt: (m: number, day: number) => void;   // 처음 다쳤다 (다음 달 쉰다)
  usePot: () => false | 'pot' | 'holy';   // 주사위에 걸리면 먼저 포션 한 병으로 막는다 (포션이 없으면 false). 성수면 그 탐사 동안의 부상도 낫는다
  kill: (m: number, day: number) => boolean;   // 포션 없이 또 걸렸다: 죽으면 true (단장 · 의무실 · 강골은 버틸 수 있다)
  loot: (m: number) => number;   // 조원 m이 채집 지점 하나에서 캐 오는 몫
  win: (j: number, kd: number, won: boolean) => [string, number][];   // 조우의 갈무리 (해낸 사람 kd, 이겼나)
  meet?: (j: number, up: number[], win: boolean, cr: number, k: number, mats: [string, number][]) => void;   // 만난 것과 실어 온 전리품을 적는다 (도감 · 단장 조사)
};

const pickW = (ws: number[]) => { let x = rnd() * ws.reduce((a, b) => a + b, 0); for (let i = 0; i < ws.length; i++) { x -= ws[i]; if (x <= 0) return i; } return ws.length - 1; };
// 층마다 구간 n개를 d일에 나눈다 (앞날부터 하나씩 더)
export const segsOf = (n: number, d: number) => Array.from({ length: d }, (_, i) => Math.floor(n / d) + (i < n % d ? 1 : 0));

// 탐사의 지금 상태 (저장할 수 있는 모양). 탐사는 구간마다 한 걸음씩 굴린다: 그날의 성공률 · 위기는 그날의 판 상태로 다시 셈한다
// e: 그날 몇째 구간, amb: 들켜서 다음 구간이 조우, trail: 흔적에서 해낸 비율의 합 (지도를 그린 만큼), pm · pt: 전리품 · 지도 기록이 차지한 짐 칸
export type TripState = { day: number; e?: number; amb?: boolean; trail?: number; pm?: number; pt?: number; lost?: boolean; hg?: number; gone: number[]; hurt: number[]; wins: number[]; seen: number[]; days: Day[]; tu: number; pack: number; lootSum: number; ex?: number[];   // ex: 조원마다 해낼 기대 (숨은 기질을 뺀 확률의 합)
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
// 조원마다 굴린다: 다쳤거나 굶었거나 무뎌졌으면 그만큼 어렵다
function rolls(C: TripCfg, S: TripState, up: number[], hungry: Set<number>, p: (m: number) => number) {
  const hurt = new Set(S.hurt);
  const pen = (m: number) => (hurt.has(m) ? C.injPen : 0) + (hungry.has(m) ? C.hungerPen : 0) + S.blunt * C.toolPen;
  const dd = up.map(m => rnd() < Math.max(0.03, p(m) - pen(m)));
  const ex = S.ex || (S.ex = Array(S.seen.length).fill(0));
  up.forEach((m, x) => { S.seen[m]++; if (dd[x]) S.wins[m]++; ex[m] += Math.max(0.03, p(m) - pen(m) - (C.hid ? C.hid(m) : 0)); });
  return { dd, kd: dd.filter(Boolean).length };
}
// 짐에 남은 칸 (남은 채비 · 채집품 · 전리품 · 지도 기록을 뺀)
const roomOf = (C: TripCfg, S: TripState, held: () => number) => Math.max(0, C.slots - held() - S.pack - (S.pm || 0) - (S.pt || 0));
// 조우: 그 층 몬스터 j를 만나 조원마다 굴리고, 해낸 만큼 갈무리해 짐에 싣고(칸이 모자라면 남는 것은 두고 온다), 못 해낸 사람은 부상 주사위를 굴린다
function fight(C: TripCfg, S: TripState, j: number, up: number[], hungry: Set<number>, held: () => number): Day {
  const day = S.day, { dd, kd } = rolls(C, S, up, hungry, m => C.pm(m, j)), win = kd >= Math.min(2, up.length);
  const mats: [string, number][] = [];
  if (kd) {
    let fit = Math.floor(roomOf(C, S, held) / C.matSlot + 1e-9);
    C.win(j, kd, win).forEach(([m, n]) => { const k = Math.min(n, fit); fit -= k; if (k) mats.push([m, k]); if (k < n) S.end = 'pack'; });
    S.pm = (S.pm || 0) + mats.reduce((a, [, n]) => a + n, 0) * C.matSlot;
  }
  const D: Day = { dd: day + 1, mon: C.names[j], win, k: kd, n: up.length, mats, cr: 0, d: 0, ...(hungry.size ? { hg: hungry.size } : {}) };
  const ms = Array(C.size).fill('-');
  up.forEach((m, x) => { ms[m] = dd[x] ? 'o' : dice(C, S, m, j, day + 1, D) || 'x'; });
  D.ms = ms.join('');
  if (!win) S.lost = true;
  if (C.meet) C.meet(j, up, win, D.cr, kd, mats);
  return D;
}
// 채집 지점: 해낸 사람 몫만큼 짐 칸을 채운다 (둘 미만이면 loseLoot배만. 다 쓴 횃불 · 포션 칸도 쓴다). 칸이 모자라면 두고 온다
function gather(C: TripCfg, S: TripState, up: number[], hungry: Set<number>, held: () => number): Day {
  const { dd, kd } = rolls(C, S, up, hungry, C.gp), win = kd >= Math.min(2, up.length);
  const D: Day = { dd: S.day + 1, ev: 'g', win, k: kd, n: up.length, mats: [], cr: 0, d: 0, ...(hungry.size ? { hg: hungry.size } : {}) };
  if (kd) {
    const l = up.reduce((a, m, x) => a + (dd[x] ? C.loot(m) : 0), 0) / C.party * (win ? 1 : C.loseLoot), need = l * C.lootSlot;
    const room = roomOf(C, S, held), take = Math.min(need, room);
    S.pack += take; S.lootSum += need ? l * take / need : 0; D.loot = Math.round(take * 10) / 10;
    if (take < need) S.end = 'pack';
  }
  const ms = Array(C.size).fill('-');
  up.forEach((m, x) => { ms[m] = dd[x] ? 'o' : 'x'; });
  D.ms = ms.join('');
  if (!win && rnd() < C.ambush) S.amb = true;
  return D;
}
// 흔적: 해낸 비율만큼 지도를 그리고 그 기록을 짐에 싣는다(칸이 모자라면 그린 만큼만 남는다). 못 해낸 사람은 부상 주사위 (j = −2)
function trail(C: TripCfg, S: TripState, up: number[], hungry: Set<number>, held: () => number): Day {
  const day = S.day, { dd, kd } = rolls(C, S, up, hungry, C.tp), win = kd >= Math.min(2, up.length);
  const D: Day = { dd: day + 1, ev: 't', win, k: kd, n: up.length, mats: [], cr: 0, d: 0, ...(hungry.size ? { hg: hungry.size } : {}) };
  if (kd) {
    const need = kd / up.length * C.trailSlot, take = Math.min(need, roomOf(C, S, held));
    S.trail = (S.trail || 0) + kd / up.length * (need ? take / need : 0); S.pt = (S.pt || 0) + take;
    if (take < need) S.end = 'pack';
  }
  const ms = Array(C.size).fill('-');
  up.forEach((m, x) => { ms[m] = dd[x] ? 'o' : dice(C, S, m, -2, day + 1, D) || 'x'; });
  D.ms = ms.join('');
  if (!win && rnd() < C.ambush) S.amb = true;
  return D;
}
// 구간 하나를 굴린다 (끝났으면 S.done). 그날 첫 구간에 식량을 먹고, 첫 구간 말고는 구간마다 확률로 횃불 하나를 더 태운다.
// 구간마다 사건 하나를 뽑아 굴린다 (들켰으면 조우). 그날 진 조우가 있으면 그날 끝에 정비 도구 하나
export function stepTrip(C: TripCfg, S: TripState) {
  if (S.done) return;
  if (S.day >= C.segs.length) { S.done = true; return; }
  const e = S.e || 0, day = S.day, gone = new Set(S.gone);
  // 짐 칸: 남은 횃불 · 포션 · 정비 도구가 한 칸씩, 식량은 foodSlot개가 한 칸
  const held = () => (C.torch - S.tu) + C.pots() + S.food / C.foodSlot + S.tools;
  const up = Array.from({ length: C.size }, (_, m) => m).filter(m => !gone.has(m));
  if (!up.length || gone.size >= 2) { S.end = 'flee'; S.done = true; return; }
  if ((day === 0 && e === 0) || rnd() < C.rate) { if (S.tu < C.torch) S.tu++; else { S.end = 'torch'; S.done = true; return; } }
  if (e === 0) {
    // 식량: 하루 한 사람에 하나. 모자라면 뒷사람부터 굶는다 (굶은 사람은 그날 성공 −hungerPen)
    const eat = Math.min(S.food, up.length); S.food -= eat; S.fu += eat; S.hg = up.length - eat; S.lost = false;
  }
  const hungry = new Set(up.slice(up.length - (S.hg || 0)));
  let D: Day;
  if (S.amb) {
    const fs = C.evs.filter(x => x.k === 'f');
    S.amb = false; D = fight(C, S, fs[pickW(fs.map(x => x.w))].j!, up, hungry, held); D.am = 1;
  } else {
    const E = C.evs[pickW(C.evs.map(x => x.w))];
    D = E.k === 'g' ? gather(C, S, up, hungry, held) : E.k === 't' ? trail(C, S, up, hungry, held) : fight(C, S, E.j!, up, hungry, held);
  }
  const last = e + 1 >= C.segs[day] || S.end === 'pack';
  // 정비 도구: 진 조우가 있었던 날은 그날 끝에 무기가 상한다. 도구가 있으면 하나 써서 고치고, 없으면 무뎌진 채로 다닌다 (그 뒤로 성공 −toolPen씩 쌓임)
  if (last && S.lost) { if (S.tools > 0) { S.tools--; S.tk++; D.fx = 1; } else { S.blunt++; D.bl = S.blunt; } }
  const g2 = new Set(S.gone);
  D.pk = Math.round(S.pack * 10) / 10; D.pm = Math.round((S.pm || 0) * 10) / 10; D.pt = Math.round((S.pt || 0) * 10) / 10; D.tl = C.torch - S.tu; D.pl = C.pots(); D.fl = S.food; D.ol = S.tools; D.hu = S.hurt.filter(m => !g2.has(m)).length;
  S.days.push(D);
  if (last) { S.day++; S.e = 0; } else S.e = e + 1;
  if (S.end === 'pack' || S.day >= C.segs.length) S.done = true;
}
// 탐사를 마친다: 횃불이 떨어졌으면 남은 사람마다 어둠 속 귀환의 부상 주사위를 한 번 더 (darkMin + 그 층 주사위 × darkBack)
export function finishTrip(C: TripCfg, S: TripState) {
  const DK = { cr: 0, d: 0 }, dm = Array(C.size).fill('-');
  if (S.end === 'torch') Array.from({ length: C.size }, (_, m) => m).filter(m => !S.gone.includes(m)).forEach(m => { dm[m] = dice(C, S, m, -1, 0, DK) || 'o'; });
  const rest = (C.torch - S.tu) + C.pots() + S.food / C.foodSlot + S.tools;
  const trip: Trip = { fd: S.day + (S.e ? 1 : 0), torch: C.torch, tu: S.tu, slots: C.slots, pack: Math.round(S.pack * 10) / 10, pm: Math.round((S.pm || 0) * 10) / 10, pt: Math.round((S.pt || 0) * 10) / 10, rest: Math.round(rest * 10) / 10, end: S.end, dark: DK.cr, food: C.food, fu: S.fu, tools: C.tools, tk: S.tk, blunt: S.blunt, ...(S.end === 'torch' ? { dm: dm.join('') } : {}) };
  return { days: S.days, trip, wins: S.wins, seen: S.seen, ex: (S.ex || S.seen.map(() => 0)).map(v => Math.round(v * 100) / 100), lootSum: S.lootSum, trail: S.trail || 0, tu: S.tu, fu: S.fu, tk: S.tk, foodLeft: S.food, toolsLeft: S.tools };
}
// 하루를 굴린다 (그날의 구간을 모두, 끝났으면 S.done)
export function stepDay(C: TripCfg, S: TripState) {
  const d = S.day;
  while (!S.done && S.day === d) stepTrip(C, S);
}
// 한꺼번에 굴리기 (하루씩 굴리는 것과 같다)
export function runTrip(C: TripCfg) {
  const S = startTrip(C.size, C.food, C.tools);
  while (!S.done) stepTrip(C, S);   // (구간마다 한 걸음)
  return finishTrip(C, S);
}
