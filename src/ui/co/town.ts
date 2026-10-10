// 정보 주차의 책상: 하르덴 마을 지도와 책상 위 물건(장부 · 도감 · 조사 봉투 · 신문 · 양초 · 필통)을 SVG 한 장으로 그린다.
// 지도의 장소나 물건을 누르면 그 업무 창이 뜬다(data-act). 챙길 일이 있는 곳엔 밀랍 봉인이 붙는다.
// 그림은 자리잡기용이다 (나중에 실제 그림으로 바꾼다). 상태를 쓰지 않고 난수도 쓰지 않는다
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// 장소: 누르면 열 창, 그림 자리, 이름과 작은 설명
export const PLACES: Record<string, { name: string; where: string }> = {
  staff: { name: '인원', where: '회색늑대 숙소' },
  train: { name: '건물', where: '훈련장 · 공방' },
  market: { name: '상단 거리', where: '상단 거리' },
  church: { name: '교회', where: '교회' },
  alley: { name: '정보망', where: '뒷골목 선술집' },
};
// 봉인 자리 (지도 좌표)와 글이 붙는 쪽
const SEAL_AT: Record<string, [number, number, 'l' | 'r']> = {
  staff: [505, 390, 'r'], train: [330, 312, 'r'], market: [782, 290, 'l'], church: [238, 452, 'r'], alley: [648, 478, 'r'],
  report: [1035, 72, 'l'], book: [1158, 72, 'l'], probe: [1158, 200, 'l'], paper: [1080, 352, 'l'],
};

const spot = (act: string, attrs: string, label: string, body: string) =>
  `<g class="spot" tabindex="0" role="button" data-act="${act}" ${attrs} aria-label="${esc(label)}">${body}</g>`;

export function townSceneHtml(town: string, seals: Record<string, string>) {
  const seal = Object.entries(seals).filter(([k, t]) => t && SEAL_AT[k]).map(([k, t]) => {
    const [x, y, side] = SEAL_AT[k], short = t.length <= 2;
    return `<g class="seal" aria-hidden="true"><circle cx="${x}" cy="${y}" r="11"/><text x="${x}" y="${y + 4}" text-anchor="middle">${short ? esc(t) : '!'}</text>${short ? '' : `<text class="tip" x="${side === 'r' ? x + 15 : x - 15}" y="${y + 4}" text-anchor="${side === 'r' ? 'start' : 'end'}">${esc(t)}</text>`}</g>`;
  }).join('');
  return `<svg class="scene" viewBox="0 0 1200 760" role="group" aria-label="행정관의 책상과 하르덴 마을 지도">
  <defs>
    <pattern id="tw-grain" width="240" height="24" patternUnits="userSpaceOnUse"><rect width="240" height="24" fill="#4a3322"/><path d="M0 6 C60 2 120 10 240 5 M0 16 C80 20 160 12 240 18" stroke="#3e2a1b" stroke-width="2" fill="none"/></pattern>
    <filter id="tw-rough"><feTurbulence type="fractalNoise" baseFrequency=".02" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="6"/></filter>
    <radialGradient id="tw-glow"><stop offset="0" stop-color="#ffd98a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
    <linearGradient id="tw-parch" x1="0" x2="1"><stop offset="0" stop-color="#e8dcc0"/><stop offset=".55" stop-color="#e3d5b5"/><stop offset="1" stop-color="#d6c39c"/></linearGradient>
  </defs>
  <rect width="1200" height="760" fill="url(#tw-grain)"/>
  <g transform="rotate(-1.2 470 380)">
    <rect x="40" y="40" width="820" height="660" fill="url(#tw-parch)" filter="url(#tw-rough)"/>
    <rect x="62" y="62" width="776" height="616" fill="none" stroke="#b9a37a" stroke-width="2"/>
    <text x="80" y="98" class="map-title">하르덴</text><text x="80" y="118" class="map-sub">서부 변경 · 주민 약 ${esc(town)}</text>
    <path d="M62 560 C220 520 300 600 460 580 S760 520 838 560 L838 600 C720 570 600 640 460 626 S200 570 62 604 Z" fill="#a9bcc0" opacity=".8"/>
    <path d="M150 140 L430 330 L700 300 M430 330 L470 560 M470 560 L640 470 L760 380 M430 330 L250 440 L180 600" stroke="#c9b48a" stroke-width="14" stroke-linecap="round" fill="none"/>
    <path d="M150 140 L430 330 L700 300 M430 330 L470 560 M470 560 L640 470 L760 380 M430 330 L250 440 L180 600" stroke="#b39e72" stroke-width="1" stroke-dasharray="4 6" fill="none"/>
    <g fill="#a3b07c" opacity=".7"><circle cx="110" cy="250" r="9"/><circle cx="128" cy="262" r="7"/><circle cx="780" cy="160" r="10"/><circle cx="800" cy="175" r="7"/><circle cx="320" cy="660" r="8"/></g>
    <g class="map-other"><rect x="560" y="200" width="36" height="24"/><text x="578" y="240" text-anchor="middle">붉은 깃발단</text><rect x="300" y="200" width="32" height="22"/><text x="316" y="236" text-anchor="middle">철모회</text><rect x="640" y="560" width="30" height="20"/><text x="655" y="595" text-anchor="middle">성흔 기사단</text></g>
    ${spot('place', 'data-place="staff"', '회색늑대 숙소: 인원', `<rect class="hl" x="350" y="380" width="160" height="110" rx="10"/>
      <rect x="380" y="400" width="70" height="44" fill="#5a6e8a"/><path d="M372 402 L415 376 L458 402 Z" fill="#46597a"/><rect x="455" y="414" width="30" height="30" fill="#5a6e8a" opacity=".85"/>
      <path d="M398 376 L398 352 L416 358 L398 364" fill="#8a9bb8" stroke="#46597a"/>
      <text class="lab" x="430" y="466" text-anchor="middle">회색늑대 숙소</text><text class="sub" x="430" y="482" text-anchor="middle">인원 · 신입 · 부상자</text>`)}
    ${spot('place', 'data-place="train"', '훈련장과 공방: 건물', `<rect class="hl" x="190" y="300" width="150" height="110" rx="10"/>
      <rect x="215" y="320" width="56" height="38" fill="#9a7a52"/><path d="M210 322 L243 302 L276 322 Z" fill="#7a5a3a"/>
      <circle cx="300" cy="345" r="14" fill="none" stroke="#7a5a3a" stroke-width="3"/><path d="M290 335 L310 355 M310 335 L290 355" stroke="#7a5a3a" stroke-width="2"/>
      <circle class="smoke" cx="230" cy="296" r="5" fill="#bbb"/>
      <text class="lab" x="265" y="384" text-anchor="middle">훈련장 · 공방</text><text class="sub" x="265" y="400" text-anchor="middle">훈련 · 갈무리장 · 거점 · 도구</text>`)}
    ${spot('place', 'data-place="market"', '상단 거리: 포션과 장비 구매, 시장 조사', `<rect class="hl" x="590" y="270" width="190" height="120" rx="10"/>
      <g fill="#b07a3a"><rect x="610" y="300" width="34" height="30"/><rect x="650" y="294" width="40" height="36"/><rect x="696" y="302" width="34" height="28"/></g>
      <g fill="#d9a35a"><path d="M606 300 h42 l-6 -10 h-30 z"/><path d="M646 294 h48 l-6 -10 h-36 z"/><path d="M692 302 h42 l-6 -10 h-30 z"/></g>
      <circle cx="745" cy="320" r="11" fill="#d9b45a" stroke="#8a6a2a"/><text x="745" y="324" text-anchor="middle" class="coin">G</text>
      <text class="lab" x="680" y="358" text-anchor="middle">상단 거리</text><text class="sub" x="680" y="374" text-anchor="middle">포션 · 장비 · 시장 조사</text>`)}
    ${spot('place', 'data-place="church"', '교회: 성수와 근원 기금', `<rect class="hl" x="90" y="440" width="150" height="120" rx="10"/>
      <rect x="130" y="470" width="50" height="44" fill="#8a7d5a"/><path d="M124 472 L155 446 L186 472 Z" fill="#6a6040"/>
      <rect x="186" y="454" width="16" height="60" fill="#8a7d5a"/><path d="M183 456 L194 436 L205 456 Z" fill="#6a6040"/><path d="M194 422 v12 M189 427 h10" stroke="#5a5030" stroke-width="2"/>
      <text class="lab" x="165" y="536" text-anchor="middle">교회</text><text class="sub" x="165" y="552" text-anchor="middle">성수 · 근원 기금</text>`)}
    ${spot('place', 'data-place="alley"', '뒷골목 선술집: 정보망과 타 용병단 조사', `<rect class="hl" x="500" y="470" width="150" height="110" rx="10"/>
      <rect x="530" y="492" width="46" height="34" fill="#5a4636"/><path d="M526 494 L553 474 L580 494 Z" fill="#3e2e22"/><rect x="580" y="500" width="22" height="26" fill="#5a4636" opacity=".85"/>
      <circle cx="566" cy="510" r="5" fill="#ffd98a" opacity=".8"/><path d="M600 486 l14 0 l0 10 l-14 0 z" fill="#8a6a2a"/>
      <text class="lab" x="575" y="548" text-anchor="middle">뒷골목 선술집</text><text class="sub" x="575" y="564" text-anchor="middle">정보망 · 타 용병단 조사</text>`)}
    ${spot('phase', 'data-phase="1"', '미궁 입구와 관리국: 탐험 주차로', `<rect class="hl" x="660" y="80" width="170" height="150" rx="10"/>
      <path d="M700 200 Q745 110 790 200 Z" fill="#2a2a2a"/><path d="M712 200 Q745 132 778 200 Z" fill="#111"/><rect x="690" y="196" width="110" height="8" fill="#6a5a4a"/>
      <rect x="770" y="120" width="40" height="34" fill="#7a6a5a"/><path d="M766 122 L790 104 L814 122 Z" fill="#5a4a3a"/>
      <text class="lab" x="745" y="96" text-anchor="middle">미궁 입구 · 관리국</text><text class="sub" x="745" y="222" text-anchor="middle">탐험 주차로 →</text>`)}
  </g>
  <g transform="translate(900 60)">
    <rect x="0" y="0" width="270" height="250" fill="#3a2718" stroke="#2a1a0e" stroke-width="3"/><rect x="0" y="120" width="270" height="10" fill="#2a1a0e"/><rect x="0" y="240" width="270" height="10" fill="#2a1a0e"/>
    ${spot('open-doc', 'data-tab="report"', '장부: 보고서', `<rect class="hl" x="10" y="8" width="130" height="114" rx="6"/>
      <rect x="18" y="22" width="22" height="98" fill="#6a2a22"/><rect x="42" y="16" width="24" height="104" fill="#2a4a3a"/><rect x="68" y="26" width="20" height="94" fill="#5a4a2a"/><rect x="90" y="20" width="26" height="100" fill="#2a3a5a"/>
      <path d="M18 40 h22 M42 34 h24 M68 44 h20 M90 38 h26" stroke="#d9b45a" stroke-width="1.5"/><text class="desk-lab" x="70" y="140" text-anchor="middle">장부 · 보고서</text>`)}
    ${spot('open-doc', 'data-tab="book"', '미궁 도감', `<rect class="hl" x="150" y="8" width="112" height="114" rx="6"/>
      <rect x="160" y="30" width="34" height="90" fill="#4a3a6a"/><rect x="196" y="40" width="30" height="80" fill="#6a5a3a" transform="rotate(8 211 80)"/><circle cx="177" cy="60" r="7" fill="none" stroke="#d9b45a" stroke-width="1.5"/>
      <text class="desk-lab" x="205" y="140" text-anchor="middle">미궁 도감</text>`)}
    ${spot('open-doc', 'data-tab="probe"', '조사 결과와 정보실', `<rect class="hl" x="10" y="134" width="250" height="104" rx="6"/>
      <rect x="24" y="160" width="90" height="62" fill="#e3d5b5" stroke="#b9a37a"/><path d="M24 160 L69 196 L114 160" fill="none" stroke="#b9a37a" stroke-width="1.5"/>
      <rect x="128" y="166" width="90" height="56" fill="#d9c8a2" stroke="#b9a37a" transform="rotate(-6 173 194)"/><circle cx="69" cy="196" r="7" fill="#a8332a"/>
      <text class="desk-lab" x="135" y="236" text-anchor="middle">조사 결과 · 정보실</text>`)}
  </g>
  ${spot('open-doc', 'data-tab="paper"', '변경 일보', `<rect class="hl" x="895" y="340" width="190" height="170" rx="6"/>
    <g transform="rotate(7 990 425)"><rect x="910" y="356" width="160" height="140" fill="#efe6cf" stroke="#cbbd98"/>
      <text x="990" y="380" text-anchor="middle" class="paper-t">변경 일보</text><path d="M922 388 h136" stroke="#2b2417" stroke-width="1.5"/>
      <g stroke="#9a8a6a" stroke-width="2"><path d="M922 404 h120 M922 416 h136 M922 424 h120 M922 432 h130 M922 444 h60 M992 444 h66 M922 452 h60 M992 452 h56 M922 460 h60 M992 460 h62"/></g></g>
    <text class="desk-lab" x="990" y="530" text-anchor="middle">변경 일보</text>`)}
  <g transform="translate(1110 560)" aria-hidden="true">
    <circle cx="0" cy="-40" r="70" fill="url(#tw-glow)" class="halo"/><ellipse cx="0" cy="62" rx="34" ry="9" fill="#2a1a0e"/><ellipse cx="0" cy="58" rx="28" ry="8" fill="#8a7a5a"/>
    <rect x="-12" y="-10" width="24" height="68" fill="#efe3c4"/><path d="M-12 -10 q6 10 4 22" stroke="#d9c8a2" stroke-width="3" fill="none"/>
    <path class="flame" d="M0 -40 C-9 -26 -7 -14 0 -12 C7 -14 9 -26 0 -40 Z" fill="#ffcf6a"/><path class="flame" d="M0 -32 C-4 -24 -3 -17 0 -16 C3 -17 4 -24 0 -32 Z" fill="#fff3c4"/>
  </g>
  <g transform="translate(905 600)" aria-hidden="true">
    <rect x="0" y="0" width="150" height="34" rx="8" fill="#6a4a2e" stroke="#3a2718" stroke-width="2"/><path d="M10 -4 L140 -22" stroke="#d9c8a2" stroke-width="5" stroke-linecap="round"/><path d="M134 -21 l14 -3 l-10 8 z" fill="#3a2c1a"/>
    <ellipse cx="190" cy="24" rx="18" ry="8" fill="#1a1410"/><rect x="176" y="0" width="28" height="24" fill="#222" rx="4"/><path d="M196 -6 C210 -30 206 -50 220 -70" stroke="#efe6cf" stroke-width="3" fill="none"/>
  </g>
  ${seal}
</svg>`;
}
