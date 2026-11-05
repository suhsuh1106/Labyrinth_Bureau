// 종이의 꼴: 신문 지면 · 관청 공문 · 길드 서신. 그리기만 한다(상태에 쓰지 않고 난수도 쓰지 않는다).
// 받은 보고(Report)를 그 서식에 맞는 문체의 글로 옮기는 것도 여기서 한다.
import { B, GUILDS, type GuildId, type Peek, type Report, type Trip, type World, demOf, knowLv, priceWord, stockWord, svName, wayOf } from '../../bureau/engine';

// 날짜: 한 달 서른 날, 임기 첫날이 왕국력 412년 1월 1일
export const dateOf = (day: number) => `왕국력 412년 ${Math.floor(day / 30) + 1}월 ${(day % 30) + 1}일`;
const num = (v: number) => Math.round(v).toLocaleString('ko-KR');

export interface News { day: number; no: number; extra?: boolean; head: string; deck?: string; lead: string; cols: { h: string; p: string }[]; box?: { h: string; rows: [string, string][] } }
// 신문 한 면: 제호 · 날짜 띠 · 머리기사(부제 · 첫머리) · 단 나눔 · 곁 상자
export function newsHtml(n: News) {
  return `<article class="newspaper">
    <header class="np-mast"><small class="np-ear">왕도와 변경의 소식</small><h1>왕 도 일 보</h1><small class="np-ear">${n.extra ? '호 외' : '조 간'}</small></header>
    <div class="np-line"><span>${dateOf(n.day)}</span><span>제${num(1203 + n.no)}호</span><span>한 부 동전 한 닢</span></div>
    <h2 class="np-head">${n.head}</h2>
    ${n.deck ? `<p class="np-deck">${n.deck}</p>` : ''}
    <div class="np-body">
      <p class="np-lead">${n.lead}</p>
      ${n.cols.map(c => `<section><h3>${c.h}</h3><p>${c.p}</p></section>`).join('')}
      ${n.box ? `<aside class="np-box"><h3>${n.box.h}</h3><dl>${n.box.rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></aside>` : ''}
    </div>
  </article>`;
}

export interface Gov { org: string; no: string; day: number; to: string; title: string; body: string[]; attach?: string[]; sign: string; seal: string }
// 관청 공문: 기관명 · 수신 · 제목 · 번호 붙인 본문 · 붙임 · 끝. · 발신 명의와 직인 · 문서번호 · 시행일
export function govHtml(g: Gov) {
  return `<article class="gov-doc">
    <header class="gd-org">${g.org.replace(/ /g, '').split('').join(' ')}</header>
    <dl class="gd-meta"><dt>수신</dt><dd>${g.to}</dd><dt>제목</dt><dd><b>${g.title}</b></dd></dl>
    <ol class="gd-body">${g.body.map(p => `<li>${p}</li>`).join('')}</ol>
    ${g.attach?.length ? `<p class="gd-attach"><span>붙임</span>${g.attach.join(' · ')}. <b>끝.</b></p>` : '<p class="gd-attach"><b>끝.</b></p>'}
    <footer class="gd-sign"><b>${g.sign}</b><i class="seal sq" aria-label="직인">${g.seal}</i></footer>
    <p class="gd-no"><span>${g.no}</span><span>시행 ${dateOf(g.day)}</span></p>
  </article>`;
}

export interface Letter { house: string; day: number; to: string; title: string; body: string[]; sign: string; seal: string; tone?: string }
// 길드 서신: 편지지 머리(길드 이름) · 날짜 · 받는 이 · 제목 · 인사로 여닫는 본문 · 서명과 둥근 인장
export function letterHtml(l: Letter) {
  return `<article class="guild-letter${l.tone ? ` f-${l.tone}` : ''}">
    <header class="gl-head"><b>${l.house}</b><small>${dateOf(l.day)}</small></header>
    <p class="gl-to">${l.to}</p>
    <p class="gl-title">${l.title}</p>
    ${l.body.map(p => `<p>${p}</p>`).join('')}
    <footer class="gl-sign"><span>${l.sign}</span><i class="seal rd" aria-label="인장">${l.seal}</i></footer>
  </article>`;
}

// 첫 화면: 범람(미궁에 마물이 가득 차 밖으로 쏟아짐) · 왕국군 투입 · 미궁관리국 신설
export const introNews = (): News => ({
  day: 0, no: 1, extra: true,
  head: '로이드 산중 폐광서 마물 쏟아져, 마을 셋 장부에서 지워져',
  deck: '왕국군 국경 병력 돌려 갱도 어귀 막아 · 중앙, 미궁관리국 새로 둬',
  lead: '일곱 해 동안 아무도 드나들지 않던 로이드 지방 산중의 폐광. 그 아래 미궁에서 넘친 마물이 사흘 밤낮 산비탈을 타고 내려왔다. 징세소가 이튿날 다시 셈한 로이드 북부의 장부에서는 마을 셋의 이름이 빠져 있었다.',
  cols: [
    { h: '창은 막을 뿐', p: '국경 수비대에서 빼 온 창병들이 새벽에 갱도 어귀를 틀어막았다. 쏟아지던 것은 굴 안으로 도로 밀려 들어갔지만, 안쪽의 수가 줄었다고 말하는 병사는 없다. "우리는 문을 지킬 뿐이오. 집 안을 치우는 건 우리 일이 아니지." 진지의 한 장교는 그렇게만 말했다.' },
    { h: '미궁관리국 새로 둬', p: '중앙 행정원은 미궁을 맡을 관청을 새로 열었다. 내려간 것은 도장 하나와 서기 몇, 그리고 한 해 살림에 빠듯한 예산. 길드에 명령할 권한은 법전 어디에도 없다. 초대 국장은 오늘 부임한다.' },
    { h: '광맥은 두껍고 길은 없다', p: '옛 광부들은 그 아래 광맥이 관할에서 가장 두껍다고 입을 모은다. 다만 수레 길은 무너진 마을 어귀에서 끊기고, 그 너머는 산길뿐이다. "캐는 날보다 지고 오는 날이 길다오." 왕도의 한 조장은 고개를 저었다.' },
  ],
  box: { h: '관할 미궁', rows: [['폐광', '범람 직후 · 군 주둔'], ['검은숲 미궁', '조 드나듦'], ['수몰 갱도', '물소리 잦음']] },
});

// 범람 기사: 보고 한 줄을 지면으로 (길 · 마을 소식은 그 기사로)
export const floodNews = (W: World, r: Report, no: number): News => {
  const grow = growNews(r, no) ?? mktNews(r, no);
  if (grow) return grow;
  const d = W.dungeons.find(x => r.title.startsWith(x.name));
  return {
    day: r.day, no, extra: true,
    head: r.title.replace(' 범람', ' 다시 범람') + `, ${d?.land ?? ''} 마을 피해`,
    deck: r.chips.join(' · '),
    lead: `${d?.name ?? '미궁'} 어귀에서 다시 마물이 넘쳤다. ${d?.land ?? '인근'}의 밭과 지붕이 하룻밤 사이 짓밟혔고, 무너진 것을 다시 세울 돈은 관리국의 얇은 금고에서 나간다. 중앙은 서면으로, 길드들은 술자리에서 같은 것을 묻는다. 관리국은 그동안 무엇을 했는가.`,
    cols: [{ h: '발길이 끊긴 어귀', p: '범람 뒤로 그 굴에 드는 조는 눈에 띄게 줄었다. "사람을 묻은 곳에 다시 들어가려면, 그만한 셈이 맞아야 하오." 한 길드 사람의 말이다. 셈이 맞지 않는 동안 굴 안의 수는 또 불어난다.' }],
  };
};

// 시세 기사: 소재 값이 문턱을 넘을 때만(내림세 · 제자리). 값 · 재고의 수치는 쓰지 않는다
function mktNews(r: Report, no: number): News | null {
  if (r.title.startsWith('소재 값 내림세')) return {
    day: r.day, no, head: '로이드 성 상단 창고에 소재 쌓여, 값 물러나', deck: '왕도 주문은 그대로 · 산에서 내려오는 수레만 늘어',
    lead: '로이드 성 창고 마당에 지붕 없는 짐이 늘었다. 산에서 내려오는 수레는 줄지 않는데 왕도에서 올라오는 주문서는 지난 철 그대로다. 상단은 값을 깎아 부르기 시작했고, 길드 조장들은 받아 든 동전을 두 번씩 센다.',
    cols: [
      { h: '같은 짐, 얇아진 주머니', p: '"지난달과 똑같이 지고 내려왔는데 손에 쥔 건 덜하오." 창고 앞에서 만난 한 조장의 말이다. 같은 굴에 다음 철에도 들지 말지, 그는 셈을 처음부터 다시 하겠다고 했다.' },
      { h: '창고는 셈을 한다', p: '상단 사람들은 짐이 오래 묵을수록 값이 빠진다고 입을 모은다. 마당에 쌓인 짐은 비를 맞고, 창고 삯은 날마다 붙는다.' },
    ],
  };
  if (r.title.startsWith('소재 값 제자리로')) return {
    day: r.day, no, head: '상단 창고 비어 가, 소재 값 제자리로', deck: '수레가 뜸해진 사이 왕도 주문이 창고를 따라잡아',
    lead: '한 철 내내 마당을 덮었던 짐이 걷혔다. 산에서 내려오는 수레가 뜸해진 사이 왕도의 주문이 창고를 따라잡았고, 상단은 다시 제값을 부른다.',
    cols: [{ h: '굴은 그동안', p: '값이 물러났던 동안 몇몇 굴은 발길이 줄었다. 창고가 비는 것과 굴 안이 차는 것은 같은 철에 일어났다.' }],
  };
  return null;
}

// 발전 기사: 외진 미궁에 길이 나고 마을이 선 소식 (발전도 같은 판의 수치는 지면에 적지 않는다)
function growNews(r: Report, no: number): News | null {
  const name = r.title.split(/ 가는 | 곁에 /)[0];
  if (r.title.includes('길 닦여')) return {
    day: r.day, no, head: `${name} 가는 길 닦여, 길목에 여관`, deck: '오가는 길 하루 줄어',
    lead: `짐을 진 발들이 한 철 내내 같은 비탈을 밟고 지나가자, ${name}으로 가는 수레 길이 저절로 굳었다. 그 길목에 누군가 여관 간판을 내걸었다.`,
    cols: [{ h: '길에서 덜 샌다', p: '"지고 오던 걸 이젠 싣고 온다." 한 조장의 말이다. 바퀴 자국이 산길을 따라 깊어지고 있다.' }],
  };
  if (r.title.includes('곁에 마을')) {
    const g = r.chips.at(-1)?.replace(/는 하루 길$/, '') ?? '';
    return {
      day: r.day, no, head: r.title.replace(' · ', ', ').replace(/ 지부$/, ' 지부 열어'), deck: '오가는 길 하루 더 줄어',
      lead: `여관 곁에 대장간이, 대장간 곁에 집이 붙더니 ${name} 어귀에 마을 하나가 섰다.${g ? ` ${g}는 이곳에 지부 깃발을 꽂았다.` : ''}`,
      cols: [{ h: '군막이 있던 자리', p: '창병들의 군막이 줄지어 서 있던 비탈이다. 지금 그 자리에선 장이 서고, 저녁마다 굴뚝 연기가 오른다.' }],
    };
  }
  return null;
}

// 조사 보고서: 돌아온 사신이 본 것만 짧게. 판의 수치 이름(끌림 · 호감 · 견제 같은 말)은 쓰지 않는다
const won = (v: number) => `${num(Math.abs(v))}G`;
// 길드 본부에서 알아 온 것: 장부 셈 · 다음에 보낼 곳 · 관리국 서류를 대하는 마음 · 징세청 눈치
// 길드 금고는 숫자로 읽히지 않는다: 조 하나가 쓸 만한지로 말만
export const moneyWord = (g: { money: number; size: number }) => { const m = g.money / Math.max(1, g.size); return g.money <= 0 ? '바닥' : m < 15 ? '빠듯' : m < 45 ? '보통' : '넉넉'; };
// 본부에서 알아 온 것: 이해도 단계(lv)만큼만 읽는다. 0 마음 · 1 다음에 보낼 곳 · 2 장부 셈과 금고 · 3 징세청 눈길
export function peekLines(W: World, p: Peek, lv: number, g?: GuildId) {
  const led = W.dungeons.map((d, i) => `${d.name} ${p.pnl[i] < 0 ? `${won(p.pnl[i])} 밑짐` : `${won(p.pnl[i])} 남음`}`).join(' · ');
  const go = W.dungeons.map((d, i) => [d.name, p.want[i]] as const).filter(([, v]) => v >= 0.5).sort((a, b) => b[1] - a[1]);
  const will = p.will >= B.SIGN_AT ? '관리국 서류에는 기꺼이 응할 듯합니다.' : p.will >= B.SIGN_AT - 20 ? '관리국 서류에는 마지못해 응할 듯합니다.' : '지금은 관리국 서류에 응하지 않을 듯합니다.';
  return [
    will,
    ...(lv >= 1 ? [go.length ? `다음에 보낼 곳: ${go.map(([n, v]) => `${n} ${num(v)}조`).join(' · ')} 언저리.` : '당분간 조를 더 내보낼 생각이 없어 보입니다.'] : []),
    ...(lv >= 2 ? [`장부 셈(조 하나 · 하루, 오가는 길 넣고): ${led}.`, ...(g ? [`금고는 ${moneyWord(W.guilds[g])} 쪽으로 보입니다.`] : [])] : []),
    ...(lv >= 3 && p.check > B.CHECK_ON ? ['징세청의 눈길을 꺼려 몸을 사리는 중입니다.'] : []),
  ];
}
// 창고 장부를 말로: 수치 대신 상단 사람들의 말투로
const PRICE_TALK: Record<string, string> = { '헐값': '헐값에 가깝습니다. 사 가겠다는 사람이 값을 부릅니다', '내림세': '제값을 밑돕니다. 흥정이 길어지고 있습니다', '제값': '제값을 받고 있습니다', '오름세': '제값을 웃돕니다. 왕도의 주문이 창고를 기다립니다' };
const STOCK_TALK: Record<string, string> = { '바닥': '바닥이 드러나 있습니다', '얇음': '선반 몇 칸이 비어 있습니다', '보통': '여느 철만큼 차 있습니다', '두툼': '통로까지 짐이 나와 있습니다', '넘침': '처마 밑과 마당까지 짐이 쌓였습니다' };
const holdWord = (y: number) => y >= 13 ? '무거운' : y >= 10 ? '보통의' : '가벼운';
export function tripLines(W: World, t: Trip & { logged?: boolean }) {
  const stay = Math.max(0, t.until - t.at);
  if (typeof t.to === 'number') {
    const d = W.dungeons[t.to], lv = knowLv(d.know), L = t.log;
    const teams = L ? GUILDS.map((g, i) => [g, L.teams[i]] as const).filter(([, v]) => v >= 0.5).sort((a, b) => b[1] - a[1]).slice(0, 3) : [];
    return [
      `사신 ${t.sent}명이 ${stay}일 동안 어귀에 머물며 드나든 조와 실려 나간 짐을 헤아렸습니다.`,
      ...(L && lv >= 1 ? [teams.length ? `드나드는 조: ${teams.map(([g, v]) => `${B.GUILD[g].name} ${num(v)}조`).join(' · ')}.` : '근래 어귀를 지나는 발자국이 거의 없습니다.'] : []),
      ...(L && lv >= 2 ? [`갱도에서 ${holdWord(L.yld)} 짐이 실려 나갑니다.`] : []),
      t.logged ? '모은 출입 기록을 엮어 길드마다 한 부씩 돌렸습니다. 모르는 굴보다 아는 굴이 덜 무서운 법입니다.' : d.logged ? '' : lv >= 1 ? '아직 기록이 성깁니다. 한 번 더 보내 주시면 빈칸을 메워 오겠습니다.' : '',
    ].filter(Boolean);
  }
  if (t.to === 'mkt') {
    const m = t.mkt;
    if (!m) return ['창고 문이 열리기 전에 돌아왔습니다. 장부는 넘겨 보지 못했습니다.'];
    const turn = m.price < m.prev - 0.04 ? '열흘 전보다 값이 한 칸씩 물러나 있습니다' : m.price > m.prev + 0.04 ? '열흘 전보다 값이 올라 있습니다' : '열흘 전과 값이 크게 다르지 않습니다';
    const inn = m.inflow > demOf() * 1.1 ? '왕도로 나가는 수레보다 산에서 들어오는 수레가 잦습니다' : m.inflow < demOf() * 0.9 ? '산에서 들어오는 수레가 왕도로 나가는 수레를 따라가지 못합니다' : '들어오는 수레와 나가는 수레가 엇비슷합니다';
    return [
      `사신 ${t.sent}명이 로이드 성 상단 창고에 ${stay}일 머물며 장부를 넘겼습니다.`,
      `소재 값은 ${PRICE_TALK[priceWord(m.price)]}. ${turn}.`,
      `창고는 ${STOCK_TALK[stockWord(m.stock)]}. ${inn}.`,
      ['두툼', '넘침'].includes(stockWord(m.stock)) ? '장부를 덮자 상단 사람들은 관리국이 무엇을 사 줄 수 있는지부터 물었습니다. 마당의 짐을 가리키는 손이 바빴습니다.' : '상단 사람들은 장부를 순순히 내주었습니다. 관청이 창고를 들여다보는 까닭은 묻지 않았습니다.',
    ];
  }
  const p = t.peek, g = t.to as GuildId, lv = knowLv(W.guilds[g].know);
  return [
    `사신 ${t.sent}명이 본부 언저리 주막에 ${stay}일 머물렀습니다.${t.caught ? ' 얼굴이 익을 무렵 본부 사람들 눈에 띄어, 서둘러 돌아왔습니다.' : ''}`,
    ...(p ? peekLines(W, p, lv, g) : ['빈손으로 돌아왔습니다.']),
  ];
}
export const tripGov = (W: World, r: Report): Gov => ({
  org: '미궁관리국 조사관실', no: `조사 제${r.trip!.id}호`, day: r.day, to: '미궁관리국장', title: `${svName(W, r.trip!.to)} 조사 보고`,
  body: tripLines(W, r.trip!), sign: '조사관', seal: '調査',
});

// 첫 요구서의 붙임: 눌러서 펼친다(받은 서류 철에도 한 줄)
export const SURVEY_LINK = '<button type="button" class="link" data-act="read:-3">폐광 실태 조사서 1부</button>';
// 폐광 실태 조사서: 부임 전에 왕국군 주둔대와 징세소가 함께 올린 조사. 첫날의 값(길 · 광맥 · 마물)으로 고정해 적는다
export function mineSurveyHtml(W: World) {
  const d0 = W.dungeons[0], at0 = { ...W, dungeons: W.dungeons.map((d, i) => i ? d : { ...d, dev: 0, branch: null }) } as World;
  const way = (g: GuildId) => wayOf(at0, g, 0);
  const field = (i: number) => Math.round((W.pnl[i]?.[0] ?? 0) / 5) * 5;
  const near = [...GUILDS].sort((a, b) => way(a) - way(b) || B.GUILD[b].size - B.GUILD[a].size);
  const ko = ['', '하루', '이틀', '사흘', '나흘', '닷새', '엿새', '이레', '여드레', '아흐레', '열흘'];
  const days = (n: number) => ko[n] ?? `${n}일`;
  const row = (g: GuildId) => `<tr class="f-${g}"><th><b>${B.GUILD[g].name}</b></th><td class="num">${B.GUILD[g].size}조 안팎</td><td class="num">${days(way(g))}</td></tr>`;
  return `<article class="gov-doc s-report">
    <header class="gd-org">왕 국 군 로 이 드 주 둔 대</header>
    <dl class="gd-meta"><dt>수신</dt><dd>중앙 행정원 (미궁관리국 이첩)</dd><dt>제목</dt><dd><b>${d0.land} 폐광 실태 조사</b></dd></dl>
    <ol class="gd-body">
      <li><b>위치와 길.</b> 로이드 성에서 북서로 산 셋 너머. 수레 길은 범람으로 지워진 마을 어귀에서 끊기고, 그 위로는 짐을 지고 오르는 산길뿐임. 어느 길드 본부에서 출발하든 길 없는 산길 ${days(d0.wild)}이 더 붙음.</li>
      <li><b>갱도 안.</b> 범람 이후 어귀에서 첫 갈림길까지 마물이 들어차 있음. 주둔대가 밤마다 어귀를 밀어 넣고 있으나, 안쪽의 수가 줄었다는 징후는 없음. 주둔대장 소견: "문을 막는 데는 창이면 족하나, 집 안을 비우는 데는 사람이 드나들어야 한다."</li>
      <li><b>광맥.</b> 옛 광산 장부와 범람 때 밀려 나온 소재로 미루어, 관할 미궁 가운데 가장 두꺼운 광맥으로 봄. 그러나 징세소 어림으로 지금 조 하나가 하루 캐 나오는 값은 폐광 ${field(0)}G 안팎으로, ${W.dungeons.slice(1).map((d, i) => `${d.name} ${field(i + 1)}G`).join(' · ')}에 못 미침. 광맥 탓이 아님. 마물이 들끓는 동안은 캐는 손보다 막는 손이 더 들기 때문임.</li>
      <li><b>인계의 조건.</b> 하루 ${B.ORDER.min}조 안팎이 드나들어야 안쪽의 수가 더 불지 않을 것으로 봄. 그보다 적으면 주둔대가 물러나는 날부터 다시 차오름.</li>
      <li><b>길드 본부에서 폐광까지</b> (가는 길과 돌아오는 길, 산길 포함)
        <table class="g-table s-table"><thead><tr><th></th><th>몸집</th><th>오가는 길</th></tr></thead><tbody>${near.map(row).join('')}</tbody></table></li>
      <li><b>종합 소견.</b> 길드가 이 굴에 들지 않은 것은 마물 때문이 아니라 길 때문임. 대부분의 길드에게 하루 캐는 값보다 산길에서 새는 날의 값이 큼. 셈이 맞지 않는 한 스스로 들어올 길드는 없을 것으로 봄. 주둔대의 군량은 국경 수비대 몫을 덜어 대는 중이며, 오래 이어 갈 수 없음.</li>
    </ol>
    <p class="gd-no"><span>로이드 주둔대장 · 로이드 징세소장 연명</span><span>${dateOf(0)}</span></p>
  </article>`;
}

// 길드 서신의 서명 · 인장 · 색: 길드 이름으로 찾는다
const guildBy = (name: string) => { const g = GUILDS.find(x => B.GUILD[x].name === name); return g ? { sign: B.GUILD[g].sign, seal: B.GUILD[g].seal, tone: g as string } : null; };
const gov = (r: Report, title: string, body: string[], attach?: string[]): Gov =>
  ({ org: '중앙 행정원', no: `행정원 제412-${String(r.day + 1).padStart(3, '0')}호`, day: r.day, to: '미궁관리국장', title, body, attach, sign: '중앙 행정원장', seal: '行政院印' });

// 받은 보고를 서식에 맞는 글로: 중앙 행정원은 공문, 길드는 서신
export function docOf(r: Report): { gov: Gov } | { letter: Letter } {
  if (r.from === '중앙 행정원') {
    if (r.day === 0) {
      const o = B.ORDER;
      return { gov: gov(r, '폐광 인계에 관한 요구', [
        '로이드 지방 폐광 어귀를 지키는 왕국군은 국경 수비대에서 덜어 낸 병력입니다. 본원은 그 주둔을 오래 이어 갈 병력도, 군량을 댈 예산도 갖고 있지 않습니다.',
        `귀 국은 길드의 조를 폐광에 들여 군의 자리를 대신하게 하십시오. <b>하루 ${o.min}조 이상이 ${o.need}일 이어서</b> 드나드는 것이 확인되면 인계된 것으로 봅니다.`,
        `인계가 확인되는 날 예산 ${num(o.pay)}G를 더 내려보냅니다. 그 전에 주둔이 다하면 군은 인계 없이 물러나며, 그 뒤 폐광에서 일어나는 일은 귀 국의 기록에 남습니다.`,
        '귀 국에 길드를 강제할 법적 근거가 없음은 본원도 압니다. 그 근거를 마련할 예산 또한 없습니다.',
      ], [SURVEY_LINK]) };
    }
    // 붙임에는 세상 안의 것만 (명성 같은 판의 수치는 서류에 적지 않는다)
    const att = r.chips.filter(c => !c.startsWith('명성'));
    if (r.title.startsWith('폐광 인계')) return { gov: gov(r, '폐광 인계 완료 통보', [
      '귀 국이 폐광을 왕국군에게서 넘겨받았음을 확인합니다.',
      `약속한 예산 ${num(B.ORDER.pay)}G를 보냅니다.`,
      '주둔대는 오늘 진지를 걷고 국경으로 돌아갑니다. 이 날부터 폐광 어귀를 지키는 것은 길드의 발길뿐입니다.',
    ], att) };
    if (r.title.startsWith('인내가 다함')) return { gov: gov(r, '폐광 주둔 왕국군 철수 통보', [
      '폐광에 드는 길드의 조는 끝내 정한 수에 닿지 않았습니다.',
      '국경의 사정이 더는 기다려 주지 않아, 주둔대는 인계 없이 오늘 진지를 걷습니다. 어귀는 이 날부터 비어 있습니다.',
      '본원은 이 경과를 귀 국의 기록에 남깁니다.',
    ], att) };
    if (r.title.startsWith('명성')) return { gov: gov(r, '미궁관리국 직제 확대 통보', [
      '귀 국의 그간 업무를 살펴 직제를 한 단계 넓힙니다. 늘어나는 것은 자리일 뿐, 권한은 그대로임을 아울러 밝혀 둡니다.',
      '서기 한 자리를 더 둘 수 있으니 귀 국에서 사람을 정하시기 바랍니다.',
      ...(r.chips.some(c => c.includes('요청서')) ? ['아울러 길드 한 곳을 지정하여 요청서를 보낼 수 있습니다.'] : []),
    ]) };
    return { gov: gov(r, r.title, ['아래와 같이 알립니다.'], att) };
  }
  const g = guildBy(r.from) ?? { sign: r.from, seal: '印', tone: undefined };
  const L = (title: string, body: string[]): { letter: Letter } =>
    ({ letter: { house: r.from, day: r.day, to: '미궁관리국장 귀하', title, body, sign: g.sign, seal: g.seal, tone: g.tone } });
  const why = r.chips.filter(c => /^[＋－]/.test(c)).map(c => c.slice(2));
  const WHY: Record<string, string> = { '돈': '보조금을 약속해 주신 뜻', '안전': '잃은 이들을 위로해 주시려는 뜻', '관청 기록': '저희 출입을 관청 기록에 올려 주시는 뜻' };
  const glad = why.filter(w => WHY[w]).map(w => WHY[w]);
  if (r.title.startsWith('요청서 서명')) return L(`제목: 귀 국 요청서(${r.title.split(': ')[1]})에 대한 회신`, [
    '국장님께. 보내 주신 요청서는 단원들 앞에서 조항 하나하나를 소리 내어 읽었습니다.',
    `${glad.length ? `${glad.join('과 ')}을 가벼이 여기지 않기로 하여, ` : ''}서명하여 돌려보냅니다. 약정 기간은 ${r.chips.at(-1)}입니다.`,
    '종이에 적힌 대로 저희도 지키겠습니다. 평안하시기를.',
  ]);
  if (r.title.startsWith('요청서:')) return L(`제목: 귀 국 요청서(${r.chips[0]})에 대한 회신`, [
    '국장님께. 보내 주신 요청서는 감사히 받았습니다.',
    `다만 지금 저희 형편에 이 조항들은 무겁습니다.${why.includes('정보 내주기') ? ' 저희 발걸음을 관청 장부에 내어 드리는 일은 더더욱 그렇습니다.' : ''} 서명은 조금 더 묵혀 두겠습니다.`,
    '너그러이 헤아려 주시기를 바랍니다.',
  ]);
  if (r.title.includes('서운함')) return L('제목: 지난 회의에 관하여', [
    '국장님께. 지난번 회의 소식은 저희도 남의 입을 거쳐 들었습니다.',
    '탁자에 빈자리가 없었다는 말이 단원들 사이에 오래 돌고 있습니다. 다음 자리에는 의자 하나가 더 놓이기를 바랍니다.',
  ]);
  if (r.title.includes('지부 개설')) return L(`제목: ${r.chips[0]} 곁 지부 개설 알림`, [
    `국장님께. 길이 굳고 마을이 서서, 저희가 ${r.chips[0]} 어귀에 지부 깃발을 꽂았습니다.`,
    '산길에서 새던 날들이 이제 저희 장부로 돌아옵니다. 아무도 돌보지 않던 곳이었음을 저희는 잊지 않겠습니다. 평안하시기를.',
  ]);
  if (r.title.includes('기웃거린')) return L('제목: 본부에 오신 손님에 관하여', [
    '국장님께. 요 며칠 저희 본부 담장 밖에서 낯익은 관청 옷자락을 뵈었습니다.',
    '저희 장부와 단원들의 술자리 말이 궁금하셨던 모양이라, 길을 잃으신 것으로 알고 정중히 큰길까지 모셔 드렸습니다. 물으실 것이 있으면 서신으로 주십시오. 문은 늘 열려 있습니다.',
    '평안하시기를.',
  ]);
  if (r.title.includes('협정 이행')) return L('제목: 출입 협정 이행 알림', ['국장님께. 서명한 출입 협정을 오늘부터 지킵니다. 붓을 든 날과 발을 맞춘 날 사이가 길었던 점, 너그러이 보아 주십시오.']);
  return L(`제목: ${r.title}`, ['국장님께. 아래와 같이 알려 드립니다.', r.chips.join(' · ')]);
}

// 청원 · 독촉: 길드 서신
export function askLetter(W: World, a: { day: number; from: string; kind: 'aid' | 'dun' | 'permit'; want: number; chips: string[]; dg?: number }): Letter {
  const name = W.guilds[a.from as GuildId].name;
  const g = guildBy(name) ?? { sign: '', seal: '', tone: undefined };
  return {
    house: name, day: a.day, to: '미궁관리국장 귀하', sign: g.sign, seal: g.seal, tone: g.tone,
    title: a.kind === 'permit' ? '제목: 출입 허가 신청서' : a.kind === 'dun' ? '제목: 지난 신세에 관하여' : '제목: 도움을 청하는 글',
    body: a.kind === 'permit'
      ? ['국장님께. 미궁의 문을 쥐고 계신 분께 격식을 갖추어 청합니다.', `저희는 <b>${W.dungeons[a.dg!].name}</b>에 <b>${num(a.want)}조</b>를 들이고자 합니다. ${a.chips.includes('처음 신청') ? '이 문으로 처음 올리는 글이니 이름만이라도 장부에 올려 주십시오.' : '지금 받은 허락으로는 일손이 모자라 횃불 값만 나갑니다.'} 도장을 찍어 주시면 그날부터 이름 아래서 들겠습니다. 덜 주신다면 그 몫만 받아 가겠습니다.`]
      : a.kind === 'dun'
      ? ['국장님께. 늘 애써 주시는 데 감사드립니다.', `지난 회의에서 저희가 이름을 적어 드린 종이를 국장님도 기억하시리라 믿습니다. 이제 저희 겨울이 길어져, 그때의 신세를 <b>${num(a.want)}G</b>로 셈해 주시기를 청합니다.`]
      : ['국장님께. 염치 불고하고 붓을 듭니다.', ...(a.chips.includes('소재 값 내림') ? ['지고 내려온 짐은 지난 철과 같은데, 로이드 창고에서 쳐 주는 값이 지난 철보다 얇습니다.'] : []), `금고 바닥이 드러난 지 오래라, 다음 조를 꾸릴 횃불 값도 빠듯합니다. <b>${num(a.want)}G</b>를 빌려주십시오. 이 신세는 저희 장부 맨 앞장에 적어 두겠습니다.`],
  };
}
