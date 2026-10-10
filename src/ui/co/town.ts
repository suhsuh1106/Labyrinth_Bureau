// 정보 주차의 책상: 하르덴 마을 지도(그림)와 책상 위 물건(장부 · 도감 · 조사 봉투 · 신문 · 양초 · 필통)을 SVG 한 장으로 그린다.
// 지도의 장소나 물건을 누르면 그 업무 창이 뜬다(data-act). 챙길 일이 있는 곳엔 밀랍 봉인이 붙는다.
// 지도 그림 원본은 image_source/main_map.png (1408 × 768). 게임은 종이 바깥의 흰 바탕을 투명하게 오려 webp로 줄인 art/main_map.webp를 쓴다.
// 장소 자리는 그 그림의 좌표로 적는다. 상태를 쓰지 않고 난수도 쓰지 않는다
import mapUrl from './art/main_map.webp';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// 장소: 누르면 열 창과 그 장소 이름
export const PLACES: Record<string, { name: string; where: string }> = {
  staff: { name: '인원', where: '회색늑대 숙소' },
  train: { name: '건물', where: '훈련장 · 공방' },
  market: { name: '상단 거리', where: '상단 거리' },
  church: { name: '교회', where: '교회' },
  alley: { name: '정보망', where: '뒷골목 선술집' },
};

// 지도 그림을 책상 위 어디에 얼마나 크게 까는가 (그림 좌표 → 장면 좌표)
const MAP = { x: 20, y: 16, w: 1160, iw: 1408, ih: 768 };
const S = MAP.w / MAP.iw, MH = MAP.ih * S;
const X = (x: number) => +(MAP.x + x * S).toFixed(1), Y = (y: number) => +(MAP.y + y * S).toFixed(1);
// 그림 좌표로 적은 장소 자리 [x1, y1, x2, y2], 이름, 작은 설명, 이름표 자리(위 · 아래)
type Spot = { box: [number, number, number, number]; act: string; attrs: string; label: string; sub: string; aria: string; tag?: 'top' | 'bottom' };
const SPOTS: Record<string, Spot> = {
  church: { box: [335, 215, 525, 460], act: 'place', attrs: 'data-place="church"', label: '교회', sub: '성수 · 근원 기금', aria: '교회: 성수와 근원 기금' },
  market: { box: [555, 320, 860, 540], act: 'place', attrs: 'data-place="market"', label: '상단 거리', sub: '포션 · 장비 · 시장 조사', aria: '상단 거리: 포션과 장비 구매, 시장 조사' },
  train: { box: [950, 455, 1075, 575], act: 'place', attrs: 'data-place="train"', label: '훈련장 · 공방', sub: '훈련 · 갈무리장 · 거점 · 도구', aria: '훈련장과 공방: 건물' },
  staff: { box: [1090, 460, 1378, 670], act: 'place', attrs: 'data-place="staff"', label: '회색늑대 숙소', sub: '인원 · 신입 · 부상자', aria: '회색늑대 숙소: 인원' },
  alley: { box: [25, 555, 265, 735], act: 'place', attrs: 'data-place="alley"', label: '뒷골목 선술집', sub: '정보망 · 타 용병단 조사', aria: '뒷골목 선술집: 정보망과 타 용병단 조사', tag: 'top' },
  gate: { box: [1140, 60, 1378, 228], act: 'phase', attrs: 'data-phase="1"', label: '미궁 입구', sub: '탐험 주차로 →', aria: '미궁 입구: 탐험 주차로' },
};
// 책상 띠의 윗변과, 책상 위 물건의 봉인 자리 (책상 띠 안의 좌표)
const DESK_Y = Math.round(MAP.y + MH + 14);
const DESK_SEAL: Record<string, [number, number]> = { report: [186, 14], book: [318, 14], probe: [486, 14], paper: [706, 10] };

const spotHtml = (k: string, s: Spot) => {
  const [x1, y1, x2, y2] = s.box, cx = X((x1 + x2) / 2), ty = s.tag === 'top' ? Y(y1) + 18 : Y(y2) - 22;
  return `<g class="spot" tabindex="0" role="button" data-act="${s.act}" ${s.attrs} aria-label="${esc(s.aria)}">
    <rect class="hl" x="${X(x1)}" y="${Y(y1)}" width="${X(x2) - X(x1)}" height="${Y(y2) - Y(y1)}" rx="10"/>
    <rect class="tag" x="${(cx - s.label.length * 8.5 - 10).toFixed(1)}" y="${ty - 16}" width="${(s.label.length * 17 + 20).toFixed(1)}" height="22" rx="4"/>
    <text class="lab" x="${cx}" y="${ty}" text-anchor="middle">${esc(s.label)}</text><text class="sub" x="${cx}" y="${ty + 15}" text-anchor="middle">${esc(s.sub)}</text></g>`;
};
const deskSpot = (act: string, attrs: string, aria: string, body: string) => `<g class="spot" tabindex="0" role="button" data-act="${act}" ${attrs} aria-label="${esc(aria)}">${body}</g>`;

export function townSceneHtml(town: string, seals: Record<string, string>) {
  const seal = Object.entries(seals).filter(([, t]) => t).map(([k, t]) => {
    const sp = SPOTS[k], d = DESK_SEAL[k], at = sp ? [X(sp.box[2]) - 14, Y(sp.box[1]) + 14] : d ? [d[0], DESK_Y + d[1]] : null; if (!at) return '';
    const [x, y] = at, short = t.length <= 2;
    return `<g class="seal" aria-hidden="true"><circle cx="${x}" cy="${y}" r="11"/><text x="${x}" y="${y + 4}" text-anchor="middle">${short ? esc(t) : '!'}</text>${short ? '' : `<text class="tip" x="${x - 15}" y="${y + 4}" text-anchor="end">${esc(t)}</text>`}</g>`;
  }).join('');
  const H = DESK_Y + 150;
  return `<svg class="scene" viewBox="0 0 1200 ${H}" role="group" aria-label="행정관의 책상과 하르덴 마을 지도">
  <defs>
    <pattern id="tw-grain" width="240" height="24" patternUnits="userSpaceOnUse"><rect width="240" height="24" fill="#4a3322"/><path d="M0 6 C60 2 120 10 240 5 M0 16 C80 20 160 12 240 18" stroke="#3e2a1b" stroke-width="2" fill="none"/></pattern>
    <radialGradient id="tw-glow"><stop offset="0" stop-color="#ffd98a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
    <filter id="tw-shadow" x="-5%" y="-5%" width="110%" height="115%"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity=".45"/></filter>
  </defs>
  <rect width="1200" height="${H}" fill="url(#tw-grain)"/>
  <image href="${mapUrl}" x="${MAP.x}" y="${MAP.y}" width="${MAP.w}" height="${MH.toFixed(1)}" filter="url(#tw-shadow)" preserveAspectRatio="xMidYMid meet"/>
  <text x="${X(40)}" y="${Y(52)}" class="map-title">하르덴</text><text x="${X(40)}" y="${Y(52) + 18}" class="map-sub">서부 변경 · 주민 약 ${esc(town)}</text>
  <text x="${X(605)}" y="${Y(128)}" text-anchor="middle" class="map-note">영주성 · 관리국</text>
  ${Object.entries(SPOTS).map(([k, s]) => spotHtml(k, s)).join('')}
  <g transform="translate(0 ${DESK_Y})">
    ${deskSpot('open-doc', 'data-tab="report"', '장부: 보고서', `<rect class="hl" x="24" y="0" width="176" height="128" rx="6"/>
      <g transform="rotate(-4 110 60)"><rect x="40" y="18" width="140" height="22" fill="#6a2a22"/><rect x="34" y="40" width="148" height="24" fill="#2a4a3a"/><rect x="44" y="64" width="136" height="22" fill="#2a3a5a"/>
      <path d="M40 29 h140 M34 52 h148 M44 75 h136" stroke="#d9b45a" stroke-width="1.2" opacity=".7"/></g><text class="desk-lab" x="112" y="112" text-anchor="middle">장부 · 보고서</text>`)}
    ${deskSpot('open-doc', 'data-tab="book"', '미궁 도감', `<rect class="hl" x="214" y="0" width="120" height="128" rx="6"/>
      <g transform="rotate(6 274 50)"><rect x="232" y="10" width="84" height="80" fill="#4a3a6a" rx="3"/><circle cx="274" cy="50" r="14" fill="none" stroke="#d9b45a" stroke-width="2"/></g>
      <text class="desk-lab" x="274" y="112" text-anchor="middle">미궁 도감</text>`)}
    ${deskSpot('open-doc', 'data-tab="probe"', '조사 결과와 정보실', `<rect class="hl" x="348" y="0" width="150" height="128" rx="6"/>
      <rect x="362" y="18" width="100" height="66" fill="#e3d5b5" stroke="#b9a37a"/><path d="M362 18 L412 56 L462 18" fill="none" stroke="#b9a37a" stroke-width="1.5"/><circle cx="412" cy="56" r="8" fill="#a8332a"/>
      <rect x="430" y="30" width="60" height="52" fill="#d9c8a2" stroke="#b9a37a" transform="rotate(-8 460 56)"/>
      <text class="desk-lab" x="423" y="112" text-anchor="middle">조사 결과 · 정보실</text>`)}
    ${deskSpot('open-doc', 'data-tab="paper"', '변경 일보', `<rect class="hl" x="512" y="0" width="210" height="128" rx="6"/>
      <g transform="rotate(-3 617 50)"><rect x="530" y="6" width="180" height="92" fill="#efe6cf" stroke="#cbbd98"/>
      <text x="620" y="28" text-anchor="middle" class="paper-t">변경 일보</text><path d="M542 36 h156" stroke="#2b2417" stroke-width="1.5"/>
      <g stroke="#9a8a6a" stroke-width="2"><path d="M542 48 h150 M542 58 h130 M542 68 h70 M622 68 h70 M542 78 h70 M622 78 h60 M542 88 h70 M622 88 h66"/></g></g>
      <text class="desk-lab" x="617" y="116" text-anchor="middle">변경 일보</text>`)}
    <g transform="translate(860 20)" aria-hidden="true">
      <rect x="0" y="40" width="150" height="30" rx="8" fill="#6a4a2e" stroke="#3a2718" stroke-width="2"/><path d="M10 36 L140 20" stroke="#d9c8a2" stroke-width="5" stroke-linecap="round"/><path d="M134 21 l14 -3 l-10 8 z" fill="#3a2c1a"/>
      <ellipse cx="190" cy="74" rx="18" ry="7" fill="#1a1410"/><rect x="176" y="50" width="28" height="24" fill="#222" rx="4"/><path d="M196 48 C206 30 204 16 214 0" stroke="#efe6cf" stroke-width="3" fill="none"/>
    </g>
    <g transform="translate(1120 20)" aria-hidden="true">
      <circle cx="0" cy="0" r="62" fill="url(#tw-glow)" class="halo"/><ellipse cx="0" cy="98" rx="30" ry="8" fill="#2a1a0e"/><ellipse cx="0" cy="94" rx="24" ry="7" fill="#8a7a5a"/>
      <rect x="-11" y="30" width="22" height="64" fill="#efe3c4"/>
      <path class="flame" d="M0 0 C-9 14 -7 26 0 28 C7 26 9 14 0 0 Z" fill="#ffcf6a"/><path class="flame" d="M0 8 C-4 16 -3 23 0 24 C3 23 4 16 0 8 Z" fill="#fff3c4"/>
    </g>
  </g>
  ${seal}
</svg>`;
}
