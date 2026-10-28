// 인과 루프 그림의 자료: 저량(마디) · 화살표(부호) · 고리. 엔진이 고리를 켜는 조건(`lit`)과 같은 이름을 쓴다.
// 개발용 확인 화면(`dev/loops.html`)이 이것으로 그림을 그리고, 테스트가 고리마다 길이 닫히는지 · 부호가 R · B와 맞는지 본다.
import type { LoopId } from './engine';

export interface LoopNode { id: string; label: string; x: number; y: number; hand?: boolean } // hand: 국장의 손
export interface LoopEdge { from: string; to: string; sign: 1 | -1; bend?: number }
export interface Loop { id: LoopId; kind: 'R' | 'B'; name: string; path: string[]; when: string; at: [number, number] } // at: 그림에서 고리 이름 자리

// 그림 자리 (viewBox 1000 × 560)
export const NODES: LoopNode[] = [
  { id: 'level', label: '수위', x: 190, y: 90 },
  { id: 'acc', label: '사고', x: 320, y: 175 },
  { id: 'fear', label: '꺼림', x: 290, y: 300 },
  { id: 'teams', label: '들어간 조', x: 150, y: 300 },
  { id: 'sub', label: '보조금', x: 50, y: 210, hand: true },
  { id: 'size', label: '몸집', x: 450, y: 110 },
  { id: 'infl', label: '영향력', x: 610, y: 110 },
  { id: 'share', label: '몫', x: 610, y: 270 },
  { id: 'money', label: '세력의 돈', x: 450, y: 270 },
  { id: 'check', label: '견제', x: 730, y: 190 },
  { id: 'clash', label: '다툼', x: 840, y: 100 },
  { id: 'rel', label: '세력 사이', x: 950, y: 190 },
  { id: 'pact', label: '협정', x: 840, y: 290 },
  { id: 'meet', label: '회의', x: 950, y: 340, hand: true },
  { id: 'give', label: '요청서에 줌', x: 260, y: 420, hand: true },
  { id: 'fav', label: '호감', x: 430, y: 420 },
  { id: 'stand', label: '입지', x: 430, y: 520 },
  { id: 'budget', label: '예산', x: 260, y: 520 },
  { id: 'owe', label: '신세', x: 90, y: 420 },
  { id: 'dun', label: '독촉', x: 90, y: 520 },
];

export const EDGES: LoopEdge[] = [
  { from: 'level', to: 'acc', sign: 1 },
  { from: 'acc', to: 'fear', sign: 1 },
  { from: 'fear', to: 'teams', sign: -1 },
  { from: 'teams', to: 'level', sign: -1 },
  { from: 'level', to: 'sub', sign: 1 },
  { from: 'sub', to: 'teams', sign: 1 },
  { from: 'size', to: 'infl', sign: 1 },
  { from: 'infl', to: 'share', sign: 1 },
  { from: 'share', to: 'money', sign: 1 },
  { from: 'money', to: 'size', sign: 1 },
  { from: 'infl', to: 'check', sign: 1 },
  { from: 'check', to: 'share', sign: -1 },
  { from: 'clash', to: 'rel', sign: -1 },
  { from: 'rel', to: 'clash', sign: -1 },
  { from: 'rel', to: 'meet', sign: -1 },
  { from: 'meet', to: 'pact', sign: 1 },
  { from: 'pact', to: 'clash', sign: -1 },
  { from: 'give', to: 'fav', sign: 1 },
  { from: 'fav', to: 'stand', sign: 1 },
  { from: 'stand', to: 'budget', sign: 1 },
  { from: 'budget', to: 'give', sign: 1 },
  { from: 'give', to: 'owe', sign: 1 },
  { from: 'owe', to: 'dun', sign: -1 },
  { from: 'dun', to: 'give', sign: 1 },
];

// 고리 사이를 잇는 화살표 (엮임): 고리 하나에 들지 않지만 한쪽 고리가 다른 고리를 민다
export const LINKS: LoopEdge[] = [
  { from: 'clash', to: 'acc', sign: 1, bend: 150 },   // 다툼의 죽음은 사고
  { from: 'rel', to: 'check', sign: -1 },              // 사이가 나쁠수록 다른 쪽이 결집
  { from: 'budget', to: 'sub', sign: 1, bend: -60 },    // 보조금은 예산에서
];

// when: 엔진이 그날 고리를 켜는 조건 (`engine.ts`의 `lit`)
export const LOOPS: Loop[] = [
  { id: 'R1', kind: 'R', name: '범람', path: ['level', 'acc', 'fear', 'teams', 'level'], when: '위험 수위 위에서 조가 빠진 날', at: [235, 225] },
  { id: 'B1', kind: 'B', name: '개입', path: ['level', 'sub', 'teams', 'level'], when: '보조금이 조를 들인 날', at: [118, 222] },
  { id: 'R3', kind: 'R', name: '몸집', path: ['size', 'infl', 'share', 'money', 'size'], when: '가장 큰 길드가 조를 늘린 날', at: [530, 190] },
  { id: 'B3', kind: 'B', name: '견제', path: ['infl', 'check', 'share', 'money', 'size', 'infl'], when: '어느 길드든 견제가 쌓여 있는 날', at: [668, 196] },
  { id: 'R4', kind: 'R', name: '원한', path: ['clash', 'rel', 'clash'], when: '두 길드가 다투고 사이가 나빠진 날', at: [915, 112] },
  { id: 'B4', kind: 'B', name: '회의 · 중재', path: ['rel', 'meet', 'pact', 'clash', 'rel'], when: '협정이 지켜지는 날', at: [890, 235] },
  { id: 'R5', kind: 'R', name: '신세 굴리기', path: ['give', 'fav', 'stand', 'budget', 'give'], when: '요청서에 응한 날', at: [345, 470] },
  { id: 'B5', kind: 'B', name: '빚 독촉', path: ['owe', 'dun', 'give', 'owe'], when: '독촉에 답한 날', at: [128, 466] },
];

export const edgeOf = (a: string, b: string) => EDGES.find(e => e.from === a && e.to === b);

// 고리마다: 길이 정의된 화살표로 닫히는가, 음(−) 화살표 수가 짝수면 R · 홀수면 B인가
export function checkLoops() {
  const ids = new Set(NODES.map(n => n.id));
  return LOOPS.map(l => {
    const why: string[] = [];
    if (l.path[0] !== l.path.at(-1)) why.push('길이 닫히지 않음');
    let neg = 0;
    for (let i = 0; i + 1 < l.path.length; i++) {
      const [a, b] = [l.path[i], l.path[i + 1]];
      if (!ids.has(a) || !ids.has(b)) { why.push(`없는 저량 ${ids.has(a) ? b : a}`); continue; }
      const e = edgeOf(a, b);
      if (!e) why.push(`화살표 없음 ${a}→${b}`);
      else if (e.sign < 0) neg++;
    }
    const kind = neg % 2 ? 'B' : 'R';
    if (!why.length && kind !== l.kind) why.push(`음 화살표 ${neg}개라 ${kind}`);
    return { id: l.id, ok: !why.length, neg, why };
  });
}
