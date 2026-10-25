// 구역 (docs/zones.md): 층마다 구역 여덟이 입구에서 거리 1 · 2 · 3으로 퍼져 있다. 바깥 구역은 안쪽 구역(parent)을 지나야 닿는다.
// 구역마다 구간 사건의 무게(채집 지점 · 조우 · 흔적), 조우할 몬스터의 무게, 채집 몫 · 부상 주사위 배율, 층 매장량에서의 몫이 있다(참값, 판마다 다르다).
// 우리는 그 숫자를 범위로 안다: 그 구역에서 일한 인일(사람 × 날)이 이해도 경험치로 쌓여 단계가 오르고 범위가 좁아진다.
// 이 파일은 데이터 · 판 만들기 · 이해도만 다룬다 (탐사를 굴리는 일은 company.ts가 구간 엔진으로).
import { rnd } from './rng';

export type ZoneKind = 'ore' | 'den' | 'mix' | 'stair';
// 비밀 (이해도 5단계에서 알고 나서야 덕이 된다): 입구로 바로 빠지는 옛길(오가는 날 0) · 안전한 발판(부상 주사위 절반) · 숨은 줄기(채집 몫 ×1.5)
export type Secret = 'short' | 'footing' | 'seam';
export type Zone = {
  id: number; f: number; r: number; parent?: number; nm: string; x: number; y: number; kind: ZoneKind;
  w: [number, number, number];   // 구간마다 사건의 무게: 채집 지점 · 조우 · 흔적
  mw: number[];                  // 조우할 때 그 층 몬스터(주인 · 곁 둘)의 무게
  rich: number; risk: number;    // 채집 몫 배율 · 부상 주사위 배율 (참값)
  max: number; res: number;      // 이 구역의 매장량 끝 · 남은 양 (층 매장량 W.pool은 구역의 합)
  secret: Secret; bias: number;  // 비밀, 우리 짐작이 참값에서 어긋난 쪽 (−1 ~ 1, 이해도가 오를수록 작아진다)
  stair?: number;                // 아래층 계단 (돌파의 어려움, 3단계에서 쓴다)
  xp: number; known: boolean;    // 우리 이해도 경험치(인일) · 지도에 있는지
  seen?: { v: number; d: number };   // 우리가 마지막으로 잰 남은 양과 그날(판 전체 날)
  rec: { trips: number; md: number; got: number; hurt: number; last?: number; gl?: number[]; dry?: number };   // 우리 실적: 다녀온 번, 일한 인일, 캐 온 채집품, 다친 사람, 마지막으로 돌아온 날, 최근 귀환마다 한 사람 하루 몫(넷까지), 남은 양이 모자라 덜 캔 날(마지막 귀환이 그랬으면)
};

export const ZONE = {
  N: 8, RING: [3, 3, 2],
  LV: [4, 12, 28, 52, 90],                 // 이해도 단계마다 필요한 경험치 (인일)
  WIDE: [0.6, 0.6, 0.6, 0.25, 0.1, 0.05],  // 단계마다 우리가 아는 범위 (±). 2단계까지는 층의 흔한 값으로 짐작
  PASS: 0.25,                              // 지나가며 쌓이는 이해도 (사람마다 하루에)
  KIND_W: { ore: [0.7, 0.2, 0.1], den: [0.15, 0.75, 0.1], mix: [0.45, 0.45, 0.1], stair: [0.25, 0.6, 0.15] } as Record<ZoneKind, number[]>,
};

const NAMES = ['서쪽 동굴', '동쪽 절벽', '무너진 갱도', '젖은 동굴', '박쥐 굴', '이끼 골', '넓은 홀', '메아리 방', '버려진 수레길', '갈라진 틈', '붉은 흙 비탈', '검은 기둥 방',
  '좁은 목', '녹슨 사다리', '물 떨어지는 방', '휘어진 굴', '마른 우물', '쇠사슬 방', '붉은 석실', '돌기둥 숲', '깨진 거울 방', '모래 흐르는 길', '검은 안개 굴', '빛 먹는 방',
  '그늘 골', '울음 들리는 방', '묘비 줄', '옛 광부 숙소', '버려진 감시초소', '무너진 예배실', '옛 창고', '이름 없는 무덤', '곰팡이 굴', '푸른 이끼 방', '썩은 바람 골',
  '숨 막히는 목', '녹슨 버팀목 길', '부서진 천장', '물웅덩이 방', '이끼 낀 샘', '눈먼 복도', '해골 벽', '무너진 제단', '거꾸로 선 종유석', '뜨거운 바닥', '얼음 굴', '종소리 방', '바람 우는 틈'];
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
const shuffle = <T>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// 판 만들기: 층마다 구역 여덟. maxOf(f)는 층 매장량 끝 (구역마다 채집 무게만큼 나눈다). 1층은 처음부터 지도에 있다
export function genZones(floors: number, maxOf: (f: number) => number): Zone[] {
  const Z: Zone[] = [], used = new Set<string>();
  for (let f = 0; f < floors; f++) {
    const F: Zone[] = [], R2 = [0, 21, 38, 55];
    ZONE.RING.forEach((n, k) => {
      const r = k + 1;
      for (let j = 0; j < n; j++) {
        const a = Math.PI * (0.12 + 0.76 * (j + 0.5) / n) + (rnd() - 0.5) * 0.25;
        F.push({ id: Z.length + F.length, f, r, x: clamp(50 - Math.cos(a) * R2[r] * 1.5, 10, 90), y: clamp(66 - Math.sin(a) * R2[r], 8, 60) } as Zone);
      }
    });
    F.forEach(z => { if (z.r > 1) z.parent = F.filter(q => q.r === z.r - 1).sort((a, b) => Math.hypot(a.x - z.x, a.y - z.y) - Math.hypot(b.x - z.x, b.y - z.y))[0].id; });
    const stair = f < floors - 1 ? pick(F.filter(z => z.r === 3)) : null;
    const kinds = shuffle<ZoneKind>(['ore', 'ore', 'ore', 'den', 'den', 'mix', 'mix', 'ore'].slice(0, stair ? 7 : 8) as ZoneKind[]);
    let ki = 0;
    F.forEach(z => {
      z.kind = z === stair ? 'stair' : kinds[ki++];
      const b = ZONE.KIND_W[z.kind], jit = () => 0.8 + rnd() * 0.4, w = [b[0] * jit(), b[1] * jit(), b[2] * jit()], s = w[0] + w[1] + w[2];
      z.w = [w[0] / s, w[1] / s, w[2] / s];
      const m0 = 0.25 + rnd() * 0.6, m1 = rnd();
      z.mw = [m0, (1 - m0) * m1, (1 - m0) * (1 - m1)];
      z.rich = Math.round((0.7 + rnd() * 0.7) * 100) / 100;
      z.risk = Math.round((0.7 + rnd() * 0.7) * (z.kind === 'den' ? 1.2 : 1) * (z.kind === 'stair' ? 1.3 : 1) * 100) / 100;
      z.secret = pick<Secret>(z.r > 1 ? ['short', 'footing', 'seam'] : ['footing', 'seam']);
      z.bias = Math.round((rnd() - 0.5) * 200) / 100;
      if (z === stair) z.stair = Math.round((0.2 + f * 0.08 + rnd() * 0.15) * 100) / 100;
      const nm = pick(NAMES.filter(n => !used.has(n))) || `${f + 1}층 ${z.id}번 굴`; used.add(nm); z.nm = nm;
      z.xp = 0; z.known = f === 0; z.rec = { trips: 0, md: 0, got: 0, hurt: 0 };
    });
    // 매장량: 층 끝을 채집 무게(× 채집 몫)대로 나눈다
    const tot = F.reduce((a, z) => a + z.w[0] * z.rich, 0);
    F.forEach(z => { z.max = Math.round(maxOf(f) * z.w[0] * z.rich / tot); z.res = z.max; });
    Z.push(...F);
  }
  return Z;
}

// 이해도: 단계(0~5) · 다음 단계까지 · 단계 안에서 얼마나 찼나
export const lvOf = (z: Zone) => ZONE.LV.filter(t => z.xp >= t).length;
export const nextXp = (z: Zone) => ZONE.LV[lvOf(z)] ?? null;
export function lvProg(z: Zone) { const L = lvOf(z), a = L ? ZONE.LV[L - 1] : 0, b = ZONE.LV[L]; return b == null ? 1 : (z.xp - a) / (b - a); }
export const knowSecret = (z: Zone) => lvOf(z) >= 5;
// 우리가 아는 범위의 너비 (±): 단계 사이에서도 경험치만큼 매끄럽게 좁아진다
export function wideOf(z: Zone) { const L = lvOf(z), a = ZONE.WIDE[L], b = ZONE.WIDE[Math.min(L + 1, ZONE.WIDE.length - 1)]; return L < 2 ? a : a - (a - b) * lvProg(z); }
// 참값 v를 우리가 아는 범위로 (2단계까지는 typ 둘레, 3단계부터는 참값 둘레. 가운데는 bias만큼 어긋난다)
export function estOf(z: Zone, v: number, typ: number) {
  const L = lvOf(z), w = wideOf(z), mid = L < 3 ? typ : v * (1 + z.bias * w * 0.5);
  return { lo: mid * (1 - w), mid, hi: mid * (1 + w), known: L >= 3 };
}
// 입구에서 이 구역까지 지나는 구역들 (이 구역 빼고, 비밀 옛길을 알면 바로 간다)
export function viaOf(Z: Zone[], z: Zone): Zone[] {
  if (z.secret === 'short' && knowSecret(z)) return [];
  const c: Zone[] = []; let p = z;
  while (p.parent != null) { p = Z[p.parent]; c.unshift(p); }
  return c;
}
// 한쪽 길에 드는 날 (지나는 구역 하나에 하루)
export const wayOf = (Z: Zone[], z: Zone) => viaOf(Z, z).length;
export const zonesOn = (Z: Zone[] | undefined, f: number) => (Z || []).filter(z => z.f === f);
export const poolOf = (Z: Zone[] | undefined, f: number) => zonesOn(Z, f).reduce((a, z) => a + z.res, 0);
// 층 매장량이 바뀌면(그믐에 다시 참 · 범람) 구역에 나눈다: k = 다시 차는 몫(끝까지 남은 칸의), cut = 남은 양에 곱할 값
export function refill(Z: Zone[] | undefined, f: number, k: number, maxK = 1) { zonesOn(Z, f).forEach(z => { const m = Math.round(z.max * maxK); z.res = Math.min(z.res, m); z.res += Math.round((m - z.res) * k); }); }
export function cutPool(Z: Zone[] | undefined, f: number, cut: number) { zonesOn(Z, f).forEach(z => { z.res = Math.round(z.res * cut); }); }
