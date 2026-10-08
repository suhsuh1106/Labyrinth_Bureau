// 변경 일보 (용병단 판): 지난달 정산과 기록(W.log)만 읽어 1면을 꾸민다. 상인 조합이 내는 신문이라 장사 쪽 눈으로 본다.
// 상태를 쓰지 않고 난수도 쓰지 않는다. 같은 달이면 늘 같은 신문이 나온다.
import { CO, FLOORS, ITEMS, type MonthResult, type World, us } from '../../core/company';

export type CoIssue = {
  no: number; extra: boolean; date: string; ears: [string, string];
  kicker: string; hed: string; dek: string; by: string; body: string[]; briefs: string[];
  figures: { label: string; value: string; delta?: string; dir?: 'up' | 'dn' | '' }[];
  lower: { tag: string; hed: string; text: string }[];
  ads: { title: string; text: string; inv?: boolean }[];
};
type Story = { p: number; extra?: boolean; kicker: string; hed: string; dek: string; body: string[] };

const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
// 같은 달이면 늘 같은 것을 고른다
const by = <T,>(arr: T[], m: number, salt = 0): T => arr[(m * 31 + salt * 17) % arr.length];
// 서류 말투(-습니다)를 신문 말투(-다)로
const plain = (t: string) => t.replace(/입니다(?=[.,]|$| )/g, '이다').replace(/습니다(?=[.,]|$| )/g, '다')
  .replace(/([가-힣])니다(?=[.,]|$| )/g, (w, c) => { const k = c.charCodeAt(0) - 0xac00; return k % 28 === 17 ? String.fromCharCode(c.charCodeAt(0) - 13) + '다' : w; });
const nameOf = (W: World, id: string) => (W.cos.find(c => c.id === id) || { name: id }).name;
const deathsOf = (M: MonthResult) => M.res.reduce((a, r) => a + r.deaths, 0);
const partiesOf = (M: MonthResult) => M.plans.reduce((a, P) => a + P.parties.reduce((s, v) => s + v, 0) + P.hire.reduce((s, v) => s + v, 0), 0);
// 받침이 있으면 앞 것, 없으면 뒤 것 (은/는, 을/를)
const jo = (w: string, a: string, b: string) => ((w.charCodeAt(w.length - 1) - 0xac00) % 28 ? a : b);

const REPORTERS = ['미궁 담당 기자 하람', '시장 담당 기자 오윤', '용병단 담당 기자 세렌', '편집장'];
const ADS: { title: string; text: string; inv?: boolean }[] = [
  { title: '불꽃모루 대장간', text: '날 빠진 칼 하루 만에<br>용병단 단체 주문 1할 할인' },
  { title: '북문 경비대', text: '사람 구함<br>죽을 일 없는 일당 70G', inv: true },
  { title: '약방 푸른병', text: '포션값이 오를 때는<br>푸른병 물약을 찾으시오' },
  { title: '주막 늙은 곰', text: '미궁 다녀온 조 첫 잔 무료<br>미궁 이야기 사 드림' },
  { title: '변경 짐꾼 조합', text: '짐 지고 따라갑니다<br>전리품 운반 한 짐 15G', inv: true },
  { title: '은세공 길드', text: '은 장비 새로 들어옴<br>용병단 납품 상담 환영' },
  { title: '털가죽 상회', text: '깊은 층은 춥소<br>털망토 입고 · 35G' },
  { title: '알림', text: '본지는 독자 투고를 받습니다<br>상인 조합 회관 2층' },
];

function stories(W: World, M: MonthResult, prev: MonthResult | null, logs: string[]): Story[] {
  const out: Story[] = [], add = (s: Story) => out.push(s);
  const find = (re: RegExp) => logs.find(t => re.test(t));
  const dead = deathsOf(M);
  let t = find(/^범람: /);
  if (t) add({ p: 100, extra: true, kicker: '긴급', hed: '미궁이 넘쳤다', dek: `깊은 층의 것들 1·2층 야영지 덮쳐… 용병 ${t.match(/용병 (\d+)명/)?.[1] ?? dead}명 돌아오지 못해`,
    body: [plain(t.replace(/^범람: /, '')), '현장의 노련한 용병들은 "꺼낸 만큼 차오른다"고 입을 모은다. 1·2층에 기대던 용병단들은 한동안 장부가 빌 것이다.'] });
  t = find(/근원 봉인: /);
  if (t) add({ p: 92, extra: true, kicker: '미궁', hed: `${t.match(/^(\d)층/)?.[1]}층 근원, 봉인됐다`, dek: '회색늑대 용병단이 기금 내고 교회가 보태… 미궁의 숨이 잦아들까', body: [plain(t.replace(/^\d층 근원 봉인: /, ''))] });
  t = find(/채굴장: /);
  if (t) add({ p: 90, kicker: '미궁', hed: `${t.match(/^(\d)층/)?.[1]}층 근원에 채굴장`, dek: '회색늑대 용병단 "캘 수 있는 만큼 캔다"… 교회는 침묵', body: [plain(t.replace(/^\d층 채굴장: /, ''))] });
  if (M.opened != null) add({ p: 86, extra: true, kicker: '미궁', hed: `미궁 ${M.opened + 1}층 문이 열렸다`, dek: `용병단들 벌써 ${M.opened + 1}층 입구에 줄… ${ITEMS[M.opened].name}, 다음 달부터 시장에`,
    body: [`서부 변경 미궁의 ${M.opened + 1}층으로 가는 길이 이달 뚫렸다. 깊은 층일수록 전리품 값이 오른다는 것이 상인들의 계산이다.`, `다만 처음 내려가는 조는 아무것도 모른 채 들어간다. ${M.opened + 1}층에 무엇이 사는지는 아직 아무도 말하지 못한다.`] });
  t = find(/근원 발견: /);
  if (t) add({ p: 80, kicker: '미궁', hed: `${t.match(/^(\d)층/)?.[1]}층에서 '근원'을 찾았다`, dek: '몬스터가 생겨나는 곳… 봉인이냐 채굴이냐', body: [plain(t.replace(/^\d층 근원 발견: /, '')), '봉인하자는 교회와, 캐내자는 쪽의 말이 벌써 갈린다. 상인 조합은 어느 쪽이든 장사가 되는 쪽을 따를 것이다.'] });
  t = find(/함께 올린다고/);
  if (t) add({ p: 78, kicker: '물가', hed: '상단·교회, 다음 달부터 포션값 함께 올린다', dek: `상단은 약초 값, 교회는 장례 기금 이유로… 인상 폭 ${Math.round((CO.CARTEL_MARKUP - 1) * 100)}%`,
    body: [plain(t), '본지는 상인 조합의 신문이다. 다만 같은 날 같은 폭으로 값이 오른다는 것을 두고 시장에서 고개를 갸웃하는 사람이 적지 않다는 것도 적어 둔다.'] });
  t = find(/포션을 예전 값으로 내주기로/);
  if (t) add({ p: 76, kicker: '물가', hed: '교회, 포션값 인상에서 빠졌다', dek: '후원한 용병단에는 예전 값으로… 상단은 말 아껴', body: [plain(t)] });
  t = find(/^이상 징후: /);
  if (t) add({ p: 70, kicker: '미궁', hed: '미궁에서 이상한 일이', dek: plain(t.replace(/^이상 징후: /, '')).split('. ')[0].replace(/\.$/, ''), body: [plain(t.replace(/^이상 징후: /, '')), '어느 용병단도 아직 이렇다 할 설명을 내놓지 않았다.'] });
  t = find(/값 올리기가 끝난/);
  if (t) add({ p: 60, kicker: '물가', hed: '포션값, 제자리로', dek: '상단 값 내려와… 용병단들 한숨 돌려', body: [plain(t)] });
  t = find(/마주 앉는다/);
  if (t) add({ p: 55, kicker: '물가', hed: '상단 회계와 교회 회계, 요즘 자주 만난다', dek: '포션값 두고 무슨 말이 오가나', body: [plain(t), '양쪽 모두 "늘 하던 회계 이야기"라고만 했다.'] });
  t = find(/챙겨 들어가기 시작했다/);
  if (t) add({ p: 50, kicker: '용병단', hed: `${t.split(' 파티들이')[0]}, 약점을 알아냈나`, dek: '같은 층에서 캐는 용병단들 셈이 복잡해져', body: [plain(t)] });
  // 순위표 맨 위가 바뀌었는가
  if (prev && prev.rank[0] !== M.rank[0]) add({ p: 45, kicker: '순위', hed: `${nameOf(W, M.rank[0])}, 변경 1위에 올랐다`, dek: `${nameOf(W, prev.rank[0])}${jo(nameOf(W, prev.rank[0]), '은', '는')} 한 계단 아래로`, body: [`이달 정산에서 ${nameOf(W, M.rank[0])}의 평가액이 ${nameOf(W, prev.rank[0])}${jo(nameOf(W, prev.rank[0]), '을', '를')} 앞질렀다.`] });
  if (dead >= 25) add({ p: 40, kicker: '미궁', hed: `이달 미궁에서 ${dead}명을 잃었다`, dek: '장례 미사 줄 이어', body: [`이달 미궁에서 돌아오지 못한 용병이 ${dead}명이다. 숙소에는 빈 침상이 늘었다.`] });
  ITEMS.forEach((it, j) => {
    if (M.Q[j] && M.price[j] < it.P0 * 0.6) add({ p: 30, kicker: '시장', hed: `${it.name} 값 무너졌다`, dek: `${it.buyer} 시세 ${fmt(M.price[j])}G… 기준의 ${Math.round(M.price[j] / it.P0 * 100)}%`, body: [`이달 ${it.name}${jo(it.name, '이', '가')} ${M.Q[j]}개 풀렸다. 사 가는 쪽이 감당할 양을 넘었다.`] });
  });
  const n = partiesOf(M), grew = prev ? n - partiesOf(prev) : 0;
  add({ p: 5, kicker: '미궁', hed: grew >= 6 ? '입구 앞 줄이 길어졌다' : '변경은 조용했다', dek: `이달 ${n}개 파티 입장 · ${dead}명 돌아오지 못해`,
    body: [grew >= 6 ? `미궁 입구 앞 줄이 지난달보다 ${grew}개 파티 길어졌다. 벌이가 좋다는 소문이 돌면 줄은 늘 이렇게 길어진다. 같은 층에 몰리면 나눠 가질 몫은 줄어든다.`
      : '이달 미궁은 별다른 소동 없이 지나갔다. 파티들은 평소대로 들어갔고 평소대로 돌아왔다.'] });
  return out.sort((a, b) => b.p - a.p);
}

// 지난달(L.month) 신문. 첫 정산 전이면 null
export function coIssue(W: World): CoIssue | null {
  const M = W.last; if (!M) return null;
  const m = M.month, prev = W.history.length > 1 ? W.history[W.history.length - 2] : null;
  const logs = W.log.filter(l => l.m === m).map(l => l.t);
  const st = stories(W, M, prev, logs), lead = st[0];
  const dead = deathsOf(M), n = partiesOf(M);
  const body = [...lead.body];
  body.push(`이달 미궁에 들어간 파티는 ${n}개, 돌아오지 못한 용병은 ${dead}명이다. 평가액 1위는 ${nameOf(W, M.rank[0])}, 회색늑대 용병단은 ${M.rank.indexOf('us') + 1}위다.`);
  if (prev && M.potion > prev.potion) body.push(`상단 포션 값은 한 병 ${M.potion}G로 지난달보다 ${M.potion - prev.potion}G 올랐다. 상인 조합은 "값이 오른 데는 다 사정이 있다"고 했다.`);

  const dir = (a: number, b: number): 'up' | 'dn' | '' => (a > b ? 'up' : a < b ? 'dn' : '');
  const dt = (a: number, b: number | undefined) => (b == null ? '' : a === b ? '–' : `${a > b ? '▲' : '▼'}${fmt(Math.abs(a - b))}`);
  const figures: CoIssue['figures'] = [
    { label: '상단 포션 한 병', value: `${M.potion}G`, delta: dt(M.potion, prev?.potion), dir: dir(M.potion, prev?.potion ?? M.potion) },
    { label: '교회 포션 한 병', value: `${M.potionC}G`, delta: dt(M.potionC, prev?.potionC), dir: dir(M.potionC, prev?.potionC ?? M.potionC) },
    ...ITEMS.map((it, j) => (M.Q[j] || (prev && prev.Q[j]) ? { label: it.name, value: `${fmt(M.price[j])}G`, delta: dt(M.price[j], prev?.price[j]), dir: dir(M.price[j], prev?.price[j] ?? M.price[j]) } : null)).filter(Boolean) as CoIssue['figures'],
    { label: '입장한 파티', value: `${n}개`, delta: '', dir: '' },
    { label: '사망', value: `${dead}명`, delta: prev ? dt(dead, deathsOf(prev)) : '', dir: '' },
  ];

  // 아래 세 꼭지: 순위 · 소문 · 세력 동향
  const top = M.rank.slice(0, 3).map((id, k) => `${k + 1}위 ${nameOf(W, id)}`).join(', ');
  const rankPart = { tag: '순위', hed: '이달의 평가액 순위', text: `${top}. 회색늑대 용병단은 ${M.rank.indexOf('us') + 1}위${prev ? (prev.rank.indexOf('us') > M.rank.indexOf('us') ? '로 올라섰다' : prev.rank.indexOf('us') < M.rank.indexOf('us') ? '로 내려앉았다' : '를 지켰다') : '다'}.` };
  const hoard = W.cos.find((c, i) => c.style !== 'player' && c.style !== 'crowd' && M.res[i].potNeed > Math.max(40, M.res[i].potUsed * 1.6));
  const builder = W.cos.find((c, i) => c.style !== 'player' && M.plans[i].base);
  const crowd = W.cos.findIndex(c => c.style === 'crowd'), cn = crowd >= 0 ? M.res[crowd].sent.reduce((a, b) => a + b, 0) : 0;
  const rumor = builder ? { tag: '소문', hed: `${builder.name}, 거점 짓는다`, text: `${builder.name}${jo(builder.name, '이', '가')} ${FLOORS[M.plans[W.cos.indexOf(builder)].base!.f].name}에 전진 거점을 짓기 시작했다는 말이 돈다. 본지는 확인하지 못했다.` }
    : hoard ? { tag: '소문', hed: `${hoard.name}, 포션 쟁인다`, text: `${hoard.name}${jo(hoard.name, '이', '가')} 상단 포션을 쓸 양보다 훨씬 많이 사 들였다는 말이 돈다. 값이 쌀 때 쟁여 두려는 모양이다. 본지는 확인하지 못했다.` }
    : { tag: '소문', hed: '입구 앞의 군소 용병대', text: `이달 한 파티짜리 군소 용병대 ${cn}개가 입구 앞에 줄을 섰다. 벌이가 좋으면 줄이 길어지고, 나쁘면 흩어진다.` };
  const c = us(W), K = W.cartel;
  const fac = K ? { tag: '세력 동향', hed: K.churchOut ? '교회는 빠지고 상단만 남았다' : '상단과 교회, 값 올린 채 버틴다', text: K.churchOut ? '교회는 후원한 용병단에만 예전 값으로 포션을 내준다. 상단 조합장은 이 일을 두고 말을 아낀다.' : `포션값 인상이 ${K.left}달 더 이어진다. 교회 쪽에서는 장례 기금이 채워지면 생각이 달라질 수 있다는 말도 나온다.` }
    : (W.anoms || 0) > 0 ? { tag: '세력 동향', hed: '교회, 미궁을 걱정하다', text: '대사제는 이달 미사에서 "미궁은 먹인 만큼 자란다"는 옛 기록을 읽었다. 상단은 장사에 지장이 없기를 바란다는 말만 남겼다.' }
    : { tag: '세력 동향', hed: '상단도 교회도 잠잠', text: `이달은 상단 조합장도 대사제도 별말이 없었다. 회색늑대 용병단을 두고는 상단 쪽이 ${Math.round(c.relM ?? 50) >= 60 ? '반기는' : Math.round(c.relM ?? 50) <= 40 ? '서운해하는' : '무덤덤한'} 눈치다.` };

  const year = Math.ceil(m / 12), mo = (m - 1) % 12 + 1;
  const rest = ADS.filter(a => a !== ADS[2]);
  const ads = [prev && M.potion > prev.potion ? ADS[2] : dead >= 25 ? ADS[1] : by(ADS, m, 3), by(rest, m, 4), by(rest, m, 6)].filter((a, i, xs) => xs.indexOf(a) === i);
  return {
    no: m, extra: !!lead.extra, date: `제${year}년 제${mo}월 마지막 날`,
    ears: [`<b>오늘의 미궁</b>${n}개 파티 입장<br>사망 ${dead}명`, `<b>포션 한 병</b>상단 ${M.potion}G${prev && M.potion !== prev.potion ? ` ${M.potion > prev.potion ? '▲' : '▼'}${Math.abs(M.potion - prev.potion)}` : ''}`],
    kicker: lead.kicker, hed: lead.hed, dek: lead.dek, by: `본지 ${by(REPORTERS, m)}`, body,
    briefs: st.slice(1).filter(x => x.p >= 30).slice(0, 4).map(x => x.hed),
    figures, lower: [rankPart, rumor, fac], ads,
  };
}

export function paperHtml(W: World) {
  const I = coIssue(W);
  if (!I) return '';
  const nums = I.figures.map(f => `<tr><td>${f.label}</td><td>${f.value}${f.delta ? ` <span class="${f.dir || ''}">${f.delta}</span>` : ''}</td></tr>`).join('');
  return `<article class="news co-paper" aria-label="변경 일보 제${I.no}호">
    <div class="top"><div class="ear">${I.ears[0]}</div>
      <div class="title"><span class="hanja">邊境日報</span><h1>변경 일보</h1></div>
      <div class="ear">${I.ears[1]}</div></div>
    <div class="dateline"><span>제${I.no}호${I.extra ? ' · 호외' : ''}</span><span>${I.date}</span><span>변경 상인 조합 발행</span><span>값 3동전</span></div>
    ${I.extra ? '<div class="extra" aria-label="호외">號外<small>호외</small></div>' : ''}
    <div class="lead"><div>
        <div class="kicker">${I.kicker}</div><h2 class="hed">${I.hed}</h2><p class="dek">${I.dek}</p><div class="byline">${I.by}</div>
        <div class="body">${I.body.map(t => `<p>${t}</p>`).join('')}</div></div>
      <aside>
        <div><div class="box-h">이달의 숫자</div><table>${nums}</table></div>
        ${I.briefs.length ? `<div><div class="box-h">단신</div><ul class="briefs">${I.briefs.map(b => `<li>${b}</li>`).join('')}</ul></div>` : ''}
      </aside></div>
    <div class="lower">${I.lower.map(x => `<section><div class="tag">${x.tag}</div><h4>${x.hed}</h4><p>${x.text}</p></section>`).join('')}</div>
    <div class="ads">${I.ads.map(a => `<div class="ad${a.inv ? ' inv' : ''}"><b>${a.title}</b>${a.text}</div>`).join('')}</div>
  </article>`;
}
