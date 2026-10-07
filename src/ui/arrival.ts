// 첫날 장면: 미궁을 처음 여는 날 영주·대사제·조합장이 인사를 하고 가면, 서기가 첫 품의를 가져온다.
// 새 게임을 시작할 때만 나오고, 보여 주기만 할 뿐 게임 상태에는 아무것도 쓰지 않는다 (docs/world.md의 첫날 장면)
const $ = (id: string): any => document.getElementById(id);

type Line = { t: string; who?: string; role?: string; seal?: string; color?: string };
export const ARRIVAL: Line[] = [
  { t: '제국 재무원에서 촉망받던 당신은 서부 변경 미궁 관리국장으로 임명되었다. 미궁은 큰 부를 안겨 주지만, 다스리지 못하면 무법지대가 되고, 아직 아무도 모르는 위험도 품고 있다.' },
  { t: '미궁을 용병들에게 처음 여는 날. 관리국 천막 앞으로 세 사람이 차례로 인사를 왔다.' },
  { who: '하르덴 백작', role: '영주', seal: '백', color: 'var(--lord)', t: '개청을 축하드립니다. 황실께서 이 변방 땅에까지 이리 마음을 써 주시니, 대대로 이곳을 맡아 온 가문으로서 그저 황송할 따름입니다.' },
  { who: '대사제 엘마', role: '서부 교구', seal: '교', color: 'var(--church)', t: '사제들을 입구에 두어 내려가는 이들을 돌보겠습니다. 그들이 값으로 매겨지지 않도록, 관리국도 함께 지켜봐 주시리라 믿습니다.' },
  { who: '오르반 조합장', role: '변경 상단 조합', seal: '상', color: 'var(--merchant)', t: '개청을 진심으로 축하드립니다, 국장님. 필요하신 것이 있으면 무엇이든 말씀만 하십시오. 저희 조합 식구들 모두 국장님만 믿고 따르겠습니다.' },
  { t: '첫 용병들이 입구로 내려간 저녁, 서기가 첫 품의를 가져왔다.' },
];

let i = 0, typing: any = null, done: (() => void) | null = null;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const arrivalOpen = () => !$('arrival').hidden;

function show(k: number) {
  const L = ARRIVAL[k], box = $('ar-box');
  box.classList.toggle('narr', !L.who);
  if (L.who) { $('ar-seal').style.background = L.color; $('ar-seal').textContent = L.seal; $('ar-who').innerHTML = `${L.who}<small>${L.role}</small>`; }
  $('ar-dots').innerHTML = ARRIVAL.map((_, j) => `<i class="${j <= k ? 'on' : ''}"></i>`).join('');
  $('ar-next').textContent = k === ARRIVAL.length - 1 ? '품의 받기' : '다음';
  $('ar-scene').dataset.k = String(k);
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
