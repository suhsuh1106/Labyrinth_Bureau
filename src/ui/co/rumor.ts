// 마을 소문 (정보망 0단계): 경쟁 조가 돌아온 날 마을이 본 것과 구역의 옛말을 낱말로 보여 준다 (숫자는 정보망 단계가 오르면).
// 엔진이 들어 둔 W.rum만 읽는다. 상태를 쓰지 않고 난수도 쓰지 않는다
import { CO, FLOORS, INTEL, ITEMS, type Rumor, type World, dayAbs, zoneKnown } from '../../core/company';
import type { Zone } from '../../core/zones';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const LOAD = ['짐 가벼움', '짐 보통', '짐 무거움'];
// 경쟁 조는 층 깊이만큼의 날(TRIP_DAYS)에 다녀온다: 마을은 나간 날과 돌아온 날을 본다
const DAYS = ['', '하루', '이틀', '사흘', '나흘', '닷새', '엿새', '이레'];
const chuLv = (W: World) => (W.intel ? W.intel.lv.chu : INTEL.BASE.chu);
const ago = (W: World, d: number) => { const n = dayAbs(W) - d; return n <= 0 ? '오늘' : n === 1 ? '어제' : `${n}일 전`; };

export function sayOf(r: Rumor) {
  const it = ITEMS[r.f].name;
  return r.say === 'rich' ? `${it} 많이 난다더라` : r.say === 'poor' ? `${it} 드물다더라` : r.say === 'risk' ? '사람이 잘 다친다더라' : r.say === 'safe' ? '비교적 순하다더라' : '짐승 소굴이라더라';
}
// 귀환 소문 한 줄: 낱말만. 장례 수는 교회 장례 기록 1단계, 부상자 수는 3단계부터
export function backWords(W: World, r: Rumor) {
  const chu = chuLv(W);
  return [`${DAYS[CO.TRIP_DAYS[r.f]] || `${CO.TRIP_DAYS[r.f]}일`} 만에`, r.full ? '짐 가득' : LOAD[r.ld ?? 1], ...(r.h ? ['사냥'] : []), ...(r.mt ? ['전리품'] : []), ...(r.dead ? [chu >= 1 ? `장례 ${r.dead}` : '장례'] : []), ...(r.hurt ? [chu >= 3 ? `부상자 ${r.hurt}` : '부상자'] : [])];
}
// 구역 보고서의 마을 소문: 옛말 먼저, 그다음 최근 귀환 (새것부터 다섯)
export function zoneRumHtml(W: World, z: Zone) {
  const R = (W.rum || []).filter(r => r.z === z.id), old = R.filter(r => r.k === 'old'), back = R.filter(r => r.k === 'back').sort((a, b) => b.d - a.d).slice(0, 5);
  if (!old.length && !back.length) return '<div class="zrum"><b>마을 소문</b><p class="note">들은 말 없음</p></div>';
  return `<div class="zrum"><b>마을 소문</b><ul>${old.map(r => `<li><span class="when">옛말</span>${esc(sayOf(r))}</li>`).join('')}${back.map(r => `<li class="${r.dead ? 'dead' : r.ld === 2 || r.full ? 'heavy' : ''}"><span class="when">${ago(W, r.d)}</span>${esc(W.cos[r.i!].name)} · ${backWords(W, r).join(' · ')}</li>`).join('')}</ul></div>`;
}
// 지도 구역 칸의 표식: 최근 RUM_MARK일 안에 들은 장례(†) · 무거운 짐(◆)
const RUM_MARK = 5;
export function zoneMark(W: World, z: Zone) {
  const now = dayAbs(W), R = (W.rum || []).filter(r => r.k === 'back' && r.z === z.id && now - r.d < RUM_MARK);
  if (R.some(r => r.dead)) return '<span class="rm dead" title="최근 장례 소문">†</span>';
  if (R.some(r => r.ld === 2 || r.full)) return '<span class="rm heavy" title="최근 무거운 짐 소문">◆</span>';
  return '';
}
// 구역 보고서의 캐 온 양: 최근 귀환마다 한 사람 하루 몫의 흐름, 마지막 귀환이 바닥이었으면 왜 · 어떻게 (우리 조가 겪은 것)
export function digHtml(W: World, z: Zone) {
  const gl = z.rec.gl || [], dry = z.rec.dry != null && z.rec.dry === z.rec.last;
  if (!gl.length) return '';
  const others = (W.rum || []).filter(r => r.k === 'back' && r.z === z.id && dayAbs(W) - r.d < CO.MONTH_DAYS).length;
  const down = gl.length >= 2 && gl[gl.length - 1] < gl[0] * 0.75;
  return `<div class="zdig"><b>최근 귀환</b><span>한 사람 하루 ${gl.map(v => `<b>${v}</b>`).join(' → ')}개${down ? ' <em class="neg">줄어듦</em>' : ''}</span>
    ${dry ? `<p class="neg">지난 귀환에 바닥 · 남은 만큼만 캠${others ? ` · 최근 열흘 남의 조 귀환 ${others}번 들림` : ''}</p><p class="note">그믐에 빈 만큼의 절반이 다시 찬다 · 그 전엔 다른 구역으로</p>` : down ? `<p class="note">구역이 비어 가는 중일 수 있다 (남의 조도 캐 간다 · 그믐에 다시 찬다)</p>` : ''}</div>`;
}
// 정보실의 마을 소문: 최근 열흘에 들은 귀환 (새것부터)
export function townHtml(W: World) {
  const now = dayAbs(W), R = (W.rum || []).filter(r => r.k === 'back' && now - r.d < CO.MONTH_DAYS).sort((a, b) => b.d - a.d).slice(0, 12);
  if (!R.length) return '<p class="note">최근 열흘은 들은 말이 없어요.</p>';
  const zn = (r: Rumor) => { const z = r.z != null && W.zones ? W.zones[r.z] : undefined; return z && zoneKnown(W, z) ? `${FLOORS[r.f].name} ${z.nm}` : FLOORS[r.f].name; };
  return `<ul class="town-rum">${R.map(r => `<li><span class="when">${ago(W, r.d)}</span><b>${esc(W.cos[r.i!].name)}</b> · ${esc(zn(r))} · ${backWords(W, r).join(' · ')}</li>`).join('')}</ul>`;
}
