// 첫날 장면: 미궁이 열리고 용병단들이 몰려든 판의 전제를 몇 줄로 깔고, 첫 결정표로 넘어간다.
// 새 게임을 시작할 때만 나오고, 보여 주기만 할 뿐 게임 상태에는 아무것도 쓰지 않고 난수도 쓰지 않는다 (docs/world.md의 첫날 장면).
// 인물이 말하는 줄(who)도 그릴 수 있게 틀은 남겨 둔다
const $ = (id: string): any => document.getElementById(id);

// at: 등불이 비추는 자리 (말하는 사람 쪽으로 옮겨 간다)
type Line = { t: string; who?: string; role?: string; seal?: string; color?: string; at?: string };
export const ARRIVAL: Line[] = [
  { t: '서부 변경 하르덴 백작령에 미궁이 열렸다. 제국은 미궁 관리국을 세워 입구를 지키고, 한 달에 한 번 면허를 가진 용병단만 들여보내기로 했다.' },
  { t: '돈 냄새를 맡은 용병단들이 몰려들었다. 쉰 명을 넘게 거느린 붉은 깃발단과 성흔 기사단, 깊은 층만 노리는 철모회, 그리고 한 파티짜리 군소 용병대가 수십.', at: '35%' },
  { t: '서른여섯 명짜리 회색늑대 용병단은 그 사이에 끼어 있다. 단장은 칼을 들고 앞장선다. 돈과 사람과 물건을 나누는 일은 행정관인 당신의 몫이다.', at: '65%' },
  { t: '첫 입장은 다음 달 초하루. 그때까지 행정관이 채워야 할 것은 결정표 한 장이다.', at: '60%' },
]

let i = 0, typing: any = null, done: (() => void) | null = null;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const arrivalOpen = () => !$('arrival').hidden;

function show(k: number) {
  const L = ARRIVAL[k], box = $('ar-box');
  box.classList.toggle('narr', !L.who);
  if (L.who) { $('ar-seal').style.background = L.color; $('ar-seal').textContent = L.seal; $('ar-who').innerHTML = `${L.who}<small>${L.role}</small>`; }
  $('ar-dots').innerHTML = ARRIVAL.map((_, j) => `<i class="${j <= k ? 'on' : ''}"></i>`).join('');
  $('ar-next').textContent = k === ARRIVAL.length - 1 ? '결정표 받기' : '다음';
  $('ar-lamp').style.left = L.at || '50%';
  clearInterval(typing); typing = null;
  if (reduced()) { $('ar-line').textContent = L.t; return; }
  let n = 0; $('ar-line').textContent = '';
  typing = setInterval(() => { n += 2; $('ar-line').textContent = L.t.slice(0, n); if (n >= L.t.length) { clearInterval(typing); typing = null; } }, 28);
}

export function advanceArrival() {
  // 글자가 나오는 중이면 먼저 문장을 다 보여 준다
  if (typing) { clearInterval(typing); typing = null; $('ar-line').textContent = ARRIVAL[i].t; return; }
  if (i < ARRIVAL.length - 1) show(++i); else closeArrival();
}

export function closeArrival() {
  clearInterval(typing); typing = null;
  $('arrival').hidden = true;
  const cb = done; done = null; cb?.();
}

export function playArrival(then: () => void) {
  i = 0; done = then;
  $('arrival').hidden = false;
  show(0);
  $('ar-next').focus();
}
