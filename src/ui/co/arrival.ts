// 첫날 장면: 미궁이 열리고, 아슬아슬한 흑자로 버텨 온 단장이 행정관을 들였다는 전제를 몇 줄로 깔고, 단장의 한마디 뒤 판으로 넘어간다.
// 새 게임을 시작할 때만 나오고, 보여 주기만 할 뿐 게임 상태에는 아무것도 쓰지 않고 난수도 쓰지 않는다 (docs/world.md의 첫날 장면).
// 인물이 말하는 줄(who)도 그릴 수 있게 틀은 남겨 둔다
const $ = (id: string): any => document.getElementById(id);

// at: 등불이 비추는 자리 (말하는 사람 쪽으로 옮겨 간다)
type Line = { t: string; who?: string; role?: string; seal?: string; color?: string; at?: string };
export const ARRIVAL: Line[] = [
  { t: '서부 변경 하르덴 백작령에 미궁이 열렸다. 백작이 탐사를 허가하자 용병단들이 입구 앞으로 몰려들었다.' },
  { t: '회색늑대 용병단의 단장 브란 오스카는 혼자서도 단을 꾸려 왔지만, 장부는 늘 아슬아슬한 흑자였다. 그래서 행정관을 들였다. 계약 조건은 순이익 20% 이상.', at: '40%' },
  { t: '이봐 행정관! 미궁이 열렸어, 우리도 바로 출발하자고!', who: '브란 오스카', role: '회색늑대 단장', seal: '브', color: '#a8322a', at: '30%' },
]

let i = 0, typing: any = null, done: (() => void) | null = null;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const arrivalOpen = () => !$('arrival').hidden;

function show(k: number) {
  const L = ARRIVAL[k], box = $('ar-box');
  box.classList.toggle('narr', !L.who);
  if (L.who) { $('ar-seal').style.background = L.color; $('ar-seal').textContent = L.seal; $('ar-who').innerHTML = `${L.who}<small>${L.role}</small>`; }
  $('ar-dots').innerHTML = ARRIVAL.map((_, j) => `<i class="${j <= k ? 'on' : ''}"></i>`).join('');
  $('ar-next').textContent = k === ARRIVAL.length - 1 ? '잠깐, 보급부터' : '다음';
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
