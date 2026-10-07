// 첫날 장면: 미궁을 처음 여는 날, 관리국 앞마당에 용병단들이 모이고 영주·대사제·조합장이 한마디씩 한 뒤 첫 결정표를 받는다.
// 새 게임을 시작할 때만 나오고, 보여 주기만 할 뿐 게임 상태에는 아무것도 쓰지 않고 난수도 쓰지 않는다 (docs/world.md의 첫날 장면)
const $ = (id: string): any => document.getElementById(id);

// at: 등불이 비추는 자리 (말하는 사람 쪽으로 옮겨 간다)
type Line = { t: string; who?: string; role?: string; seal?: string; color?: string; at?: string };
export const ARRIVAL: Line[] = [
  { t: '서부 변경 하르덴 백작령에 미궁이 열렸다. 제국은 미궁 관리국을 세워 입구를 지키고, 한 달에 한 번 면허를 가진 용병단만 들여보내기로 했다.' },
  { t: '돈 냄새를 맡은 용병단들이 몰려들었다. 쉰 명을 넘게 거느린 붉은 깃발단과 성흔 기사단, 깊은 층만 노리는 철모회, 그리고 한 파티짜리 군소 용병대가 수십.' },
  { t: '서른여섯 명짜리 회색늑대 용병단은 그 사이에 끼어 있다. 단장은 칼을 들고 앞장선다. 돈과 사람과 물건을 나누는 일은 행정관인 당신의 몫이다.' },
  { t: '입구를 처음 여는 날 아침, 관리국 앞마당. 용병단장들이 늘어선 앞으로 세 사람이 차례로 나섰다.', at: '50%' },
  { who: '하르덴 백작', role: '영주', seal: '백', color: 'var(--lord)', at: '30%',
    t: '이 작은 땅에 이토록 많은 분들이 마음을 써 주시니, 대대로 이곳을 맡아 온 가문으로서 그저 고마울 따름입니다. 부디 이 땅의 사람들과도 오래 좋은 이웃이 되어 주십시오.' },
  { who: '대사제 엘마', role: '서부 교구', seal: '교', color: 'var(--church)', at: '70%',
    t: '입구에 사제들을 두어 내려가는 이들을 돌보겠습니다. 단장님들의 장부에 적히는 것이 몇 조가 아니라 몇 사람이라는 것을, 잊지 말아 주십시오.' },
  { who: '오르반 조합장', role: '변경 상단 조합', seal: '상', color: 'var(--merchant)', at: '42%',
    t: '저희 조합이야 물건을 대고 값을 매기는 것밖에 모르는 사람들입니다. 어느 단이든 똑같이 모시겠으니, 필요하신 것이 있으면 무엇이든 말씀만 하십시오.' },
  { t: '인사가 끝나자 관리국 서기가 입구의 빗장을 확인했다. 첫 입장은 다음 달 초하루. 그때까지 행정관이 채워야 할 것은 결정표 한 장이다.', at: '60%' },
];

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
