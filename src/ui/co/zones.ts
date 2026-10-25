// 구역 보고서 (docs/zones.md): 층마다 구역 여덟을 우리가 아는 만큼만 적는다.
// 이해도 단계마다 한 겹씩 더: 1 하는 일 · 2 위험 · 3 채집 몫 범위 · 잰 남은 양 · 4 좁은 범위 · 사고율 · 5 비밀. 실적은 우리가 일한 만큼.
// 읽기만 한다 (상태를 쓰지 않고 난수도 쓰지 않는다)
import { CO, FLOORS, type Plan, type World, dayAbs, richEst, riskEst, zoneKnown, zoneWay } from '../../core/company';
import { type Secret, type Zone, ZONE, lvOf, lvProg, nextXp, zonesOn } from '../../core/zones';
import { KIND_NAME } from './roster';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const f1 = (v: number) => (Math.round(v * 10) / 10).toString();
export const SECRET_NAME: Record<Secret, string> = { short: '옛길 (오가는 날 없음)', footing: '안전한 발판 (부상 주사위 절반)', seam: '숨은 줄기 (채집 몫 ×1.5)' };
export const LV_SAYS = ['이름 · 거리', '하는 일', '위험', '채집 몫 범위 · 남은 양', '좁은 범위 · 사고율', '비밀'];

// 이해도 막대: 단계 · 다음 단계까지 (경험치는 일손: 사람 × 날)
export function lvBar(z: Zone, xp = z.xp) {
  const q = { ...z, xp }, L = lvOf(q), nx = nextXp(q);
  return `<span class="zlv" title="이해도 ${L}단계 · 일손 ${f1(xp)}일${nx != null ? ` · 다음 단계까지 일손 ${f1(nx - xp)}일 (${LV_SAYS[L + 1]})` : ' · 끝'}"><b>${L}</b><i><em style="width:${Math.round(lvProg(q) * 100)}%"></em></i></span>`;
}
const riskWord = (v: number) => (v < 0.9 ? '낮음' : v < 1.15 ? '보통' : '높음');

export function zoneReportHtml(W: World, P: Plan) {
  if (!W.zones) return '';
  const now = dayAbs(W), on = (z: Zone) => (P.teams || []).filter(T => T.z === z.id).length;
  const floors = FLOORS.slice(0, W.unlocked).map((F, f) => {
    const zs = zonesOn(W.zones, f).filter(z => zoneKnown(W, z)).sort((a, b) => a.r - b.r || a.id - b.id);
    const rows = zs.map(z => {
      const L = lvOf(z), r = richEst(z), k = riskEst(z), rc = z.rec;
      const kind = L >= 1 ? `<span class="zk ${z.kind}">${KIND_NAME[z.kind]}</span>` : '<span class="dim">?</span>';
      const risk = L >= 4 ? `${riskWord(k.mid)} <small class="dim">×${f1(k.lo)}~${f1(k.hi)}</small>` : L >= 2 ? riskWord(k.mid) : '<span class="dim">—</span>';
      const rich = L >= 3 ? `×${f1(r.lo)}~${f1(r.hi)}` : '<span class="dim">—</span>';
      const left = L >= 3 && z.seen ? `${Math.round(z.seen.v)}개 <small class="dim">${now - z.seen.d <= 0 ? '오늘' : `${now - z.seen.d}일 전`}</small>` : '<span class="dim">—</span>';
      const rec = rc.md ? `일손 ${f1(rc.md)}일 · 한 사람 하루 <b>${f1(rc.got / rc.md)}</b>개` : '<span class="dim">—</span>';
      const sec = L >= 5 ? `<small class="ok">${SECRET_NAME[z.secret]}</small>` : '';
      const n = on(z);
      return `<tr${n ? ' class="on"' : ''}><td><b>${esc(z.nm)}</b>${sec}</td><td class="n">${z.r}${zoneWay(W, z) ? `<small class="dim">오감 ${2 * zoneWay(W, z)}일</small>` : ''}</td><td>${kind}</td><td>${lvBar(z)}</td><td>${risk}</td><td class="n">${rich}</td><td class="n">${left}</td><td class="n">${rec}</td><td class="n">${n ? `<b>${n}</b>조` : ''}</td></tr>`;
    }).join('');
    return `<tr class="zf"><th colspan="9">${F.name}</th></tr>${rows}`;
  }).join('');
  return `<div class="panel zones"><header><h2>구역 보고서</h2><span class="sub">일손(사람 × 날)이 이해도 경험치 · 단계 ${ZONE.LV.join(' · ')}일 · 오가는 날은 먹기만 한다 · 미궁에 들고 간 보급 · 수리 도구는 검문소가 태운다</span></header>
    <div class="tw"><table class="grid zrep"><thead><tr><th>구역</th><th class="n">거리</th><th>하는 일</th><th title="단계마다 보고서가 한 겹씩 는다: ${LV_SAYS.map((s, i) => `${i} ${s}`).join(' · ')}">이해도</th><th>위험</th><th class="n" title="층의 흔한 값에 견준 채집 몫 (우리가 아는 범위)">채집 몫</th><th class="n" title="우리 조가 마지막으로 잰 남은 양">남은 양</th><th class="n" title="우리가 일한 일손(사람 × 날) · 한 사람 하루에 캐 온 채집품">실적</th><th class="n">우리 조</th></tr></thead><tbody>${floors}</tbody></table></div>
    <p class="note">조마다 아래 편성표에서 구역 · 일할 날(또는 목표량) · 여유를 정한다. 오가는 날 + 일할 날 + 여유만큼 한 사람 하루 보급 하나 · 쉬는 날 ${CO.REST_DAYS}일.</p></div>`;
}
