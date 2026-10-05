// 시드를 줄 수 있는 난수 (mulberry32). 같은 시드와 같은 선택이면 같은 판이 나온다
// 봇 시뮬레이션과 회귀 테스트가 이걸로 결과를 재현한다
let seed = (Date.now() ^ 0x9e3779b9) >>> 0;
export function setSeed(s: number) { seed = s >>> 0; }
export function rnd(): number {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
