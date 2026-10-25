// 기록 시트 (docs/board.md 4단계): 세로 카드. 구역(구역마다 카드, 누르면 판의 구역 보고서). 이달(돈)은 본 화면의 장부(ledger.ts)로 옮겼다
// 귀환 · 지난달 보고서 · 신문 · 도감 · 정보는 원래 세로 문서라 그대로 띄운다. 읽기만 한다 (상태를 쓰지 않는다)
import { FLOORS, type Plan, type World, dayAbs, richEst, riskEst, zoneKnown, zoneWay } from '../../core/company';
import { type Zone, lvOf, zonesOn } from '../../core/zones';
import { KIND_NAME } from './roster';
import { SECRET_NAME, lvBar } from './zones';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const f1 = (v: number) => (Math.round(v * 10) / 10).toString();
const riskWord = (v: number) => (v < 0.9 ? '낮음' : v < 1.15 ? '보통' : '높음');

// 구역: 층마다 구역 카드 (이해도 단계만큼만 적는다). 누르면 판의 구역 보고서
export function zoneCards(W: World, P: Plan) {
  if (!W.zones) return '';
  const now = dayAbs(W), on = (z: Zone) => (P.teams || []).filter(T => T.z === z.id).length;
  return FLOORS.slice(0, W.unlocked).map((F, f) => {
    const zs = zonesOn(W.zones, f).filter(z => zoneKnown(W, z)).sort((a, b) => b.xp - a.xp || a.r - b.r || a.id - b.id);
    return `<h3 class="mt">${F.name} <small>구역 ${zs.length} · 이해도 높은 순</small></h3><ul class="zcs">${zs.map(z => {
      const L = lvOf(z), r = richEst(z), k = riskEst(z), rc = z.rec, n = on(z), way = zoneWay(W, z);
      const bits = [`거리 ${z.r}${way ? ` · 오감 ${2 * way}일` : ''}`, L >= 2 ? `위험 ${riskWord(k.mid)}` : '', L >= 3 ? `채집 몫 ×${f1(r.lo)}~${f1(r.hi)}` : '', L >= 3 && z.seen ? `남은 양 ${Math.round(z.seen.v)} (${now - z.seen.d <= 0 ? '오늘' : `${now - z.seen.d}일 전`})` : '', rc.md ? `일손 ${f1(rc.md)}일 · 한 사람 하루 ${f1(rc.got / rc.md)}개` : ''].filter(Boolean);
      return `<li><button type="button" class="zc" data-act="bs-zone" data-z="${z.id}"><span class="zc-h"><b>${esc(z.nm)}</b>${L >= 1 ? `<span class="zk ${z.kind}">${KIND_NAME[z.kind]}</span>` : '<span class="dim">하는 일 ?</span>'}${n ? `<span class="chip go">우리 ${n}조</span>` : ''}${lvBar(z)}</span>
        <span class="zc-b">${bits.join(' · ')}</span>${L >= 5 ? `<span class="zc-b ok">${SECRET_NAME[z.secret]}</span>` : ''}</button></li>`;
    }).join('')}</ul>`;
  }).join('') + `<p class="note">일손(사람 × 날)이 이해도 경험치 · 단계마다 보고서가 한 겹씩 는다 · 구역을 누르면 판에서 그 구역 보고서</p>`;
}
