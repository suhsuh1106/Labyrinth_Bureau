// 미궁 도감(헌터 노트): 우리 조가 몬스터를 만난 기록을 몬스터마다 쌓는다.
// 도감은 기록만 보여 주고 짐작은 플레이어가 한다 (약점을 별점이나 "~인 듯"으로 알려 주지 않는다).
//   이해도: 만날 때마다 오른다(이긴 날 더). ECO_AT마다 생태 글이 한 줄씩, REC_AT부터 전적표, TARGET_AT부터 지정 탐사, ROOT_AT이면 근원을 쫓을 수 있다
//   전적: 갖춘 것(직업마다 없음 · 하나 · 둘 이상, 장비마다 없음 · 있음)별로 마주침 · 승 · 위기 · 해낸 사람 비율
//   소재: 이긴 조우마다 갖춘 것별로 몇 번 이겼고 그중 몇 번 그 소재를 얻었나 (얻은 소재만 화면에 보인다)
//   단장 조사: 한 달에 한 번 몬스터 하나에 물을 것 하나(약점이 이것인가 · 이 소재가 이것을 갖추면 잘 나오나). 맞으면 확정, 틀리면 아님
// 상태를 바꾸는 것은 엔진(runMonth)만 부른다. 화면은 읽기만 한다
import { CLASSES, GEARS, PAIR_CLASS, WEAK_KEYS } from './data';

export const DEX = {
  // 이해도: 한 번 만나면 이긴 날 U_WIN, 진 날 U_LOSS × (1 − 이해도/U_SLOW). 100이 끝
  U_WIN: 3, U_LOSS: 2.2, U_SLOW: 120,
  ECO_AT: [1, 20, 60], REC_AT: 20, ASK_AT: 20, TARGET_AT: 40, ROOT_AT: 100,
  // 지정 탐사: 노린 몬스터를 만날 무게 TARGET_W(나머지는 남은 몫을 나눈다), 그 몬스터 상대 성공 +TARGET_SUCC, 소재 ×TARGET_MAT
  // 약점을 확정해 두었으면 노린 조는 성공 +KEY_SUCC 더, 위기 ×KEY_CRISIS. 소재 조건을 확정해 두었으면 그 소재 ×MAT_SURE
  // (숙련 봇 200판으로 맞춤: 0.7 · +5%p · ×1.2로 두면 우리가 1위를 81% 가져간다)
  TARGET_W: 0.5, TARGET_SUCC: 0, TARGET_MAT: 1.1, KEY_SUCC: 0.02, KEY_CRISIS: 0.9, MAT_SURE: 1.3,
  // 단장: 죽지 않는다. 죽을 위기를 맞으면 크게 다쳐 LEAD_REST달 쉰다
  LEAD_REST: 2,
};
export type DexRec = { n: number; w: number; cr: number; k?: number; p?: number };   // 마주침 · 승 · 위기 · 해낸 사람 · 나선 사람
export type DexMat = { got: number; rec: Record<string, { n: number; g: number }> };
export type Ans = 'yes' | 'no';
// at: 처음 만난 달
export type Dex = { n: number; w: number; cr: number; u: number; at: number; rec: Record<string, DexRec>; mats: Record<string, DexMat>; key: Record<string, Ans>; mat: Record<string, Record<string, Ans>>; bad?: Record<string, Ans> };   // bad: 역효과 조사의 답
// 단장 조사: 몬스터(mon), 물은 것(k: 'c:마법사' · 'g:냉기'), 소재(m, 없으면 약점을 묻는다)
export type Ask = { mon: string; k: string; m?: string; b?: boolean };   // b: 역효과를 묻는다
export type AskRes = Ask & { ans: Ans | 'miss' | 'away' };

// 전적의 칸: 직업마다 0 · 1 · 2(둘 이상), 장비마다 0 · 1
export const CLASS_KEYS = CLASSES.map(c => 'c:' + c);
export const GEAR_KEYS = GEARS.filter(g => g !== '일반').map(g => 'g:' + g);
// 소재 조건은 직업 · 장비 하나하나로 묻고(MAT_KEYS), 약점은 다섯 가지 중 하나로 묻는다(WEAK_KEYS, 장비 꼴)
export const MAT_KEYS = [...CLASS_KEYS, ...GEAR_KEYS];
export const ASK_KEYS = WEAK_KEYS;
export function condKeys(cls: string[], gear: string) {
  return [...CLASSES.map(c => `c:${c}:${Math.min(2, cls.filter(x => x === c).length)}`), ...GEAR_KEYS.map(g => `${g}:${gear === g ? 1 : 0}`)];
}
// 'c:마법사' → '마법사', 'g:냉기' → '냉기 장비'
export const keyName = (k: string) => (k.startsWith('c:') ? k.slice(2) : `${k.slice(2)} 장비`);
// 약점 이름: 'g:냉기' → '냉기 (마법사)'
export const weakName = (k: string) => `${k.slice(2)} (${PAIR_CLASS[k.slice(2)] || ''})`;

export function newDex(m: number): Dex { return { n: 0, w: 0, cr: 0, u: 0, at: m, rec: {}, mats: {}, key: {}, mat: {} }; }
// 한 번 만난 것을 적는다 (갖춘 것 · 이겼나 · 그날 맞은 위기)
export function dexMeet(D: Dex, conds: string[], win: boolean, cr: number, k = 0, p = 0) {
  D.n++; if (win) D.w++; D.cr += cr;
  D.u = Math.min(100, Math.round((D.u + (win ? DEX.U_WIN : DEX.U_LOSS) * (1 - D.u / DEX.U_SLOW)) * 10) / 10);
  conds.forEach(c => { const r = D.rec[c] || (D.rec[c] = { n: 0, w: 0, cr: 0 }); r.n++; if (win) r.w++; r.cr += cr; r.k = (r.k || 0) + k; r.p = (r.p || 0) + p; });
}
// 이긴 조우에서 그 몬스터의 소재마다 얻었나를 적는다
export function dexWin(D: Dex, conds: string[], mats: string[], got: Set<string>) {
  mats.forEach(m => {
    const X = D.mats[m] || (D.mats[m] = { got: 0, rec: {} });
    conds.forEach(k => { const r = X.rec[k] || (X.rec[k] = { n: 0, g: 0 }); r.n++; if (got.has(m)) r.g++; });
  });
}
export function dexGot(D: Dex, m: string, n: number) { const X = D.mats[m] || (D.mats[m] = { got: 0, rec: {} }); X.got += n; }
// 확정해 둔 약점이 있나 · 이 소재의 조건을 확정해 두었나
export const keySure = (D: Dex | undefined) => !!D && Object.values(D.key).includes('yes');
// 확정해 둔 역효과 (없으면 '')
export const badSure = (D: Dex | undefined) => (D && D.bad ? Object.keys(D.bad).find(k => D.bad![k] === 'yes') || '' : '');
export const matSure = (D: Dex | undefined, m: string) => !!D && !!D.mat[m] && Object.values(D.mat[m]).includes('yes');
// 물을 수 있는가: 이해도 ASK_AT 이상, 아직 답을 받지 않은 것, 소재는 한 번은 얻은 것
export function askable(D: Dex | undefined, A: Ask) {
  if (!D || D.u < DEX.ASK_AT || !(A.m ? MAT_KEYS : WEAK_KEYS).includes(A.k)) return false;
  if (A.m) return !!D.mats[A.m] && D.mats[A.m].got > 0 && !(D.mat[A.m] && D.mat[A.m][A.k]);
  if (A.b) return !(D.bad && D.bad[A.k]) && !badSure(D) && D.key[A.k] !== 'yes';
  return !D.key[A.k] && !keySure(D);
}
