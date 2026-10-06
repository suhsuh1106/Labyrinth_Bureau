// 변경 일보: 매달 말일에 나오는 신문. 상인 조합이 내는 신문이라 장사 쪽 눈으로 관리국을 본다.
// 지난 기록(로그 · 세력 소식 · 월별 통계 · 장부 · 평가)만 읽어서 만든다.
// 상태에 아무것도 쓰지 않고 난수도 쓰지 않으므로, 지난 호도 언제든 같은 모습으로 다시 펼칠 수 있다.
import { S } from './state';
import { fmt, josa, pct } from './util';

export type Issue = {
  no: number; m: number; extra: boolean; first: boolean;
  date: string; ears: [string, string];
  kicker: string; hed: string; dek: string; by: string; body: string[]; briefs: string[];
  figures: { label: string; value: string; delta?: string; dir?: 'up' | 'dn' | '' }[];
  lower: { tag: string; hed: string; text: string }[];
  ads: { title: string; text: string; inv?: boolean }[];
};

// 같은 달이면 늘 같은 것을 고른다
const by = <T>(arr: T[], m: number, salt = 0): T => arr[(m * 31 + salt * 17) % arr.length];
const rx = (re: RegExp, logs: string[]) => { for (const t of logs) { const x = t.match(re); if (x) return x; } return null; };
// 관리국 서류 말투(-습니다)를 신문 말투(-다)로
const plain = (t: string) => t
  .replace(/입니다(?=[.,]|$| )/g, '이다').replace(/습니다(?=[.,]|$| )/g, '다')
  // 나옵니다 → 나온다처럼 받침 ㅂ을 ㄴ으로 바꾼다
  .replace(/([가-힣])니다(?=[.,]|$| )/g, (w, c) => { const k = c.charCodeAt(0) - 0xAC00; return k % 28 === 17 ? String.fromCharCode(c.charCodeAt(0) - 13) + '다' : w; });
// 달이 넘어간 뒤에 남는 기록(종파 다툼, 개척기 끝)도 그달 신문에 싣는다
const LATE = /^교회 종파|^개척기를 마치고/;
const logsFor = (m: number) => S.log.filter(e => (e.m === m && !LATE.test(e.t)) || (e.m === m + 1 && LATE.test(e.t))).map(e => e.t);

// 신문이 나온 마지막 달 (지금 결재 중인 달의 바로 앞)
export const latestIssue = () => S.month - 1;
export const hasIssue = (m: number) => m >= 1 && m < S.month && S.hist.some(h => h.month === m);

type Story = { p: number; extra?: boolean; kicker: string; hed: string; dek: string; body: string[] };

// 그달 로그에서 1면감을 찾는다. 우선순위가 가장 높은 것이 머리기사가 된다
function stories(m: number, logs: string[], h, prev): Story[] {
  const out: Story[] = [];
  const add = (s: Story) => out.push(s);
  const ev = S.evals.find(e => e.month === m + 1);
  if (ev) {
    const ok = ev.items.filter(i => i.ok).length;
    add({ p: 95, extra: true, kicker: '수도', hed: ev.grade === '우수' ? "수도, 관리국에 '우수' 판정" : ev.grade === '미흡' ? "관리국 '미흡'… 수도에서 경고장" : "수도 평가 '보통'… \"지켜보겠다\"",
      dek: `${ev.year}년 차 임기 평가, 다섯 항목 중 ${ok}개 달성`,
      body: [`제국 행정성이 서부 변경 미궁 관리국의 ${ev.year}년 차 임기를 평가했다. 결과는 '${ev.grade}'. ${ev.reward}`,
        ev.grade === '미흡' ? '상인 조합 안에서는 "관리국장이 바뀌면 거래 조건도 처음부터 다시 맞춰야 한다"며 걱정하는 목소리가 나온다.' : '상인 조합은 "관리국이 안정되어야 장사도 안정된다"며 반겼다.'] });
  }
  let x = rx(/소규모 범람: .*용병 (\d+)명 사망/, logs);
  if (x) add({ p: 100, extra: true, kicker: '긴급', hed: '미궁이 넘쳤다', dek: `깊은 층 몬스터 1층 야영지 덮쳐… 용병 ${x[1]}명 사망, 복구비 5,000G`,
    body: ['미궁 깊은 곳의 몬스터들이 위층으로 쏟아져 나와 1층 야영지를 덮쳤다. 입구에서 가까스로 막아 냈지만 피해가 크다.',
      '현장의 노련한 용병들은 "꺼낸 만큼 차오른다"고 입을 모은다. 관리국은 아직 공식 입장을 내지 않았다.'] });
  x = rx(/^용사 (\S+)\((\S+)\) 전사 · (\d+)층/, logs);
  if (x) {
    const saint = rx(/교회가 용사 \S+ 성인으로 추대/, logs), blame = rx(/관리국 탓으로 돌림/, logs);
    add({ p: 90, extra: true, kicker: '부고', hed: `용사 ${x[1]}, ${x[3]}층에서 잠들다`,
      dek: saint ? '대사제, 미궁의 첫 성인으로 추대' : blame ? '교회 "관리국이 사지로 몰았다"' : `${x[2]} ${x[1]}, 최전선에서 돌아오지 못해`,
      body: [`관리국이 띄운 용사 파티의 ${x[2]} ${x[1]}${josa(x[1])} ${x[3]}층에서 돌아오지 못했다.`,
        saint ? '교회는 그를 성인으로 모시기로 했고, 추모 미사에는 용병과 신도가 줄을 섰다.' : blame ? '장례 설교에서 대사제는 "교회가 내어 준 아이를 관리국이 사지로 몰았다"고 말했다. 설교는 변경 곳곳에 퍼졌다.' : '숙소의 용병들은 그의 이름을 술잔에 새겼다.'] });
  }
  x = rx(/^(\d+)층 개척 완료 → (\d+)층 개방/, logs);
  if (x) add({ p: 85, extra: true, kicker: '개척', hed: `미궁 ${x[2]}층 문이 열렸다`, dek: `${x[1]}층 개척 끝나자 용병들 벌써 ${x[2]}층 입구에 줄`,
    body: [`서부 변경 미궁의 ${x[2]}층 문이 이달 열렸다. 더 깊은 층일수록 전리품 값도 오른다는 것이 상인들의 계산이다.`,
      `다만 처음 내려가는 조는 아무것도 모른 채 들어간다. ${x[2]}층에 무엇이 사는지는 아직 아무도 말하지 못한다.`] });
  if (rx(/개척 완료\. 최심부로 가는 길/, logs)) add({ p: 88, extra: true, kicker: '개척', hed: '최심부로 가는 길이 보인다', dek: '마지막 층 개척 끝나… 미궁의 바닥은 어디인가', body: ['관리국이 맡은 마지막 층의 개척이 끝났다. 용병들은 이제 미궁의 가장 깊은 곳을 이야기한다.'] });
  if (rx(/용사 파티가 \d+층 개척을 이끌어/, logs) && !out.some(s => s.kicker === '개척')) add({ p: 84, kicker: '개척', hed: '용사 파티가 길을 열었다', dek: '최전선 앞장선 용사들… 용병들이 뒤따라', body: ['관리국이 띄운 용사 파티가 최전선 개척을 이끌었다. 숙소에서는 용사들의 이름이 오르내린다.'] });
  x = rx(/^상단\((\d+)G\)과 교회\((\d+)G\)가 같은 날 포션 단가를 올림/, logs);
  if (x) add({ p: 80, kicker: '물가', hed: '상단·교회, 같은 날 포션값 올렸다', dek: `상단 ${x[1]}G, 교회 ${x[2]}G… "원자재 탓" 해명`,
    body: ['상단과 교회가 같은 날 포션 단가를 올렸다. 양쪽 모두 원자재 사정을 이유로 들었다.', '본지는 상인 조합의 신문이다. 다만 같은 날 같은 폭으로 값이 오른 것을 두고 시장에서 고개를 갸웃하는 사람이 적지 않다는 것도 적어 둔다.'] });
  if (rx(/담합에서 이탈|담합을 포기/, logs)) add({ p: 78, kicker: '물가', hed: '포션값, 제자리로', dek: '상단·교회 단가 되돌려… 시장에 안도', body: ['한동안 높았던 포션 단가가 예전으로 돌아갔다. 상인 조합은 "거래가 다시 순해졌다"고 반겼다.'] });
  x = rx(/^교회 종파 다툼의 결론: (.+)/, logs);
  if (x) add({ p: 82, extra: true, kicker: '교회', hed: plain(x[1]), dek: '1년 넘게 이어진 종파 다툼 끝나', body: ['교회 안의 종파 다툼이 끝났다. 관리국의 헌금이 어느 쪽에 실렸는지가 결론을 갈랐다는 것이 신전 주변의 평이다.'] });
  if (rx(/^교회 종파 분열/, logs)) add({ p: 72, extra: true, kicker: '교회', hed: '교회가 둘로 갈라졌다', dek: '개혁파 "대사제는 장부를 공개하라"', body: ['젊은 사제들이 대사제의 방식에 반기를 들었다. 개혁파 수장 리아나 사제는 관리국의 도움을 청했다.'] });
  if (rx(/^개척기를 마치고/, logs)) add({ p: 76, extra: true, kicker: '관리국', hed: '관리국, 개척기 끝내고 본격 운영', dek: '판로·보급 갖추자 용병들 몰려', body: ['미궁 관리국이 개척기를 마쳤다. 판로와 보급이 갖춰지면서 미궁은 이제 변경의 돈줄로 자리 잡을 참이다.'] });
  x = rx(/^판로 개통 · 쌓아 둔 전리품을 ([\d,]+)G에/, logs);
  if (x) add({ p: 74, kicker: '시장', hed: '미궁 전리품, 드디어 시장에', dek: `창고에 쌓였던 전리품 ${x[1]}G어치 한꺼번에 풀려`, body: ['판로가 열리자 관리국 창고에 쌓여 있던 전리품이 시장으로 쏟아졌다. 상인 조합은 "이제야 장사가 된다"며 반겼다.'] });
  x = rx(/^용사 파티 결성: (.+)/, logs);
  if (x) add({ p: 66, kicker: '용사', hed: '관리국, 용사 파티 띄웠다', dek: x[1], body: ['관리국이 몸값을 치르고 용사 파티를 꾸렸다. 최전선을 앞장서 열 것이라는 기대와 돈값을 할지 두고 보자는 말이 함께 나온다.'] });
  if (rx(/^용사 파티 해체|하르덴 백작령으로 넘어감|상단 사설 탐사대로 감/, logs)) add({ p: 58, kicker: '용사', hed: '용사 파티, 흩어졌다', dek: '관리국 품을 떠난 용사들', body: ['관리국의 용사 파티가 흩어졌다. 몸값과 대우를 두고 말이 많았다는 후문이다.'] });
  x = rx(/^(\d+)층 공략본 적중/, logs);
  if (x) add({ p: 62, kicker: '관리국', hed: '관리국 공략본, 적중했다', dek: `${x[1]}층 공략본대로 간 조들 전과 좋아… "관리국 종이가 처음으로 쓸모 있었다"`, body: [`관리국이 낸 ${x[1]}층 공략본이 맞아떨어졌다. 공략본을 따른 조들이 눈에 띄게 많은 전리품을 들고 나왔다.`] });
  x = rx(/^(\d+)층 공략본이 빗나감/, logs);
  if (x) add({ p: 60, kicker: '관리국', hed: '관리국 공략본, 빗나갔다', dek: `${x[1]}층 공략본 따른 조들 "종이 한 장 믿었다가 낭패"`, body: [`관리국이 낸 ${x[1]}층 공략본이 빗나갔다. 공략본대로 했다가 크게 당했다는 원성이 숙소에 가득하다.`] });
  x = rx(/^용병 조합 결성/, logs);
  if (x) add({ p: 64, kicker: '용병', hed: '용병 조합, 면허 보이콧', dek: '새로 면허 받으러 오는 사람 끊겨', body: ['용병들이 조합을 꾸리고 관리국 면허를 거부하기 시작했다. 새 얼굴이 끊기면 원정도 줄어든다.'] });
  if (rx(/^하르덴 백작이 미궁 용병을/, logs)) add({ p: 56, kicker: '용병', hed: '하르덴 백작, 용병 빼 간다', dek: '영지 경비대로 옮기는 용병 늘어', body: ['이웃 하르덴 백작령이 미궁 용병들을 영지 경비대로 끌어가고 있다. 품삯이 후하다는 말이 돈다.'] });
  if (rx(/^약초 흉작/, logs)) add({ p: 57, kicker: '물가', hed: '남부 약초 흉작… 포션값 오른다', dek: '상단·교회 다음 달부터 단가 조정', body: ['남부 약초 산지에 흉작이 들었다. 포션 원가가 오르면서 상단과 교회 모두 단가를 올리겠다고 알려 왔다. 이번 인상은 진짜 원가 탓이라는 것이 본지 판단이다.'] });
  x = rx(/^이상 징후: (.+)/, logs);
  if (x) add({ p: 52, kicker: '미궁', hed: '미궁에서 이상한 일이', dek: plain(x[1]).split('. ')[0].replace(/\.$/, ''), body: [plain(x[1]), '관리국은 아직 이렇다 할 설명을 내놓지 않았다.'] });
  x = rx(/^(\d+)층 근원 발견/, logs);
  if (x) add({ p: 54, kicker: '미궁', hed: `${x[1]}층에서 '근원'을 찾았다`, dek: '미궁이 차오르는 곳… 봉인이냐 채굴이냐', body: [`${x[1]}층 깊은 곳에서 미궁의 근원으로 보이는 곳이 발견되었다. 봉인하자는 쪽과 캐내자는 쪽의 말이 벌써 갈린다.`] });
  x = rx(/^(\d+)층에 사는 것의 이름이 알려짐: (.+)/, logs);
  if (x) add({ p: 46, kicker: '미궁', hed: `${x[1]}층의 주인은 '${x[2]}'`, dek: '용병들 사이에서 이름 굳어져', body: [`용병들이 ${x[1]}층에 사는 것을 '${x[2]}'(이)라 부르기 시작했다. 이름이 생기면 대처법도 따라온다는 것이 노련한 용병들의 말이다.`] });
  x = rx(/^(?!개척 사업)(.+) 완공$/, logs);
  if (x) add({ p: 42, kicker: '관리국', hed: `${x[1]}, 문 열었다`, dek: '관리국 시설 완공', body: [`관리국이 짓던 ${x[1]}${josa(x[1])} 완공되었다.`] });
  x = rx(/^개척 사업 완료: (.+) · (.+)/, logs);
  if (x) add({ p: 44, kicker: '개척', hed: `${x[1]} 마쳤다`, dek: x[2], body: [`관리국의 개척 사업 '${x[1]}'${josa(x[1])} 끝났다. 방식은 '${x[2]}'.`] });
  x = rx(/^안건 결재: (.+) → (.+?)( \(|$)/, logs);
  if (x) add({ p: 36, kicker: '관리국', hed: plain(x[1]), dek: `관리국은 '${x[2]}'`, body: [`${plain(x[1])}. 관리국의 답은 '${x[2]}'.`] });
  x = rx(/^(\d+)층 공략본 발간: "(.+)"/, logs);
  if (x) add({ p: 30, kicker: '관리국', hed: `관리국, ${x[1]}층 공략본 냈다`, dek: `"${x[2]}"… 용병들 반신반의`, body: [`관리국이 ${x[1]}층 공략본을 냈다. 요지는 "${x[2]}". 맞을지는 다음 달 원정이 말해 줄 것이다.`] });
  // 큰 일이 없던 달: 원정 성적으로 1면을 채운다
  const rate = h.rate, d = h.deaths;
  if (d >= Math.max(5, h.M * 0.06)) add({ p: 20, kicker: '미궁', hed: `이달 미궁에서 ${d}명을 잃었다`, dek: '장례 미사 줄 이어… 교회 "관리국은 무엇을 하나"', body: [`이달 미궁에서 돌아오지 못한 용병이 ${d}명이다. 숙소에는 빈 침상이 늘었다.`] });
  else if (rate >= 0.6) add({ p: 10, kicker: '미궁', hed: '원정 풍년, 전리품 쏟아졌다', dek: `원정 성공률 ${pct(rate)}… 대장간·주막 모처럼 북적`, body: ['이달 원정은 잘 풀렸다. 전리품을 지고 나온 조가 많아 시장에도 활기가 돌았다.'] });
  else if (rate < 0.4 && h.month > 1) add({ p: 10, kicker: '미궁', hed: '빈손 원정 늘었다', dek: `원정 성공률 ${pct(rate)}… "미궁이 짜졌다"`, body: ['이달 원정은 신통치 않았다. 빈손으로 돌아온 조가 절반을 넘었다.'] });
  else add({ p: 5, kicker: '미궁', hed: prev && h.M > prev.M ? '용병 숙소, 새 얼굴 늘었다' : '변경은 조용했다', dek: `원정 성공률 ${pct(rate)} · 용병 ${h.M}명`, body: ['이달 미궁은 별다른 소동 없이 지나갔다. 원정은 평소대로 나갔고 평소대로 돌아왔다.'] });
  return out.sort((a, b) => b.p - a.p);
}

const PARTIES = ['철망치 조', '은빛 화살', '늪지 형제', '붉은 등불', '남부 항구 조', '대장간 아이들', '회색 망토', '마지막 촛불', '쌍둥이 도끼', '순례자 일행', '북문 경비 출신', '셋째 골목'];
const NAMES = ['바르그', '미라', '오르텐', '세라', '한스', '토린', '루카', '이브', '다란', '케일'];
const REPORTERS = ['미궁 담당 기자 하람', '관리국 담당 기자 세렌', '시장 담당 기자 오윤', '편집장'];

// 독자 투고: 이달 용병 숙소에서 돈 불만을 한 사람의 목소리로
const LETTERS: [RegExp, string, string][] = [
  [/물약이 모자란다/, '"포션 좀 넉넉히 주시오"', '"이달에도 우리 조는 포션이 모자랐소. 관리국은 숫자만 보지 말고 숙소에 한번 와 보시오."'],
  [/식탁이 비었다/, '"배를 곯고 미궁에 들어가란 말이오"', '"빈 속으로 들어가면 칼끝이 떨리오. 식량 값 아끼다 사람 잃소."'],
  [/짐꾼이 모자라/, '"들고 나올 손이 없소"', '"전리품을 두고 나왔소. 짐꾼만 있었어도 두 배는 벌었을 거요."'],
  [/날이 빠진 무기/, '"이 칼로 뭘 베란 말이오"', '"수리 맡길 데가 없어 날 빠진 칼을 그대로 들고 들어갔소."'],
  [/입장료로 등골/, '"입장료가 품삯보다 무섭소"', '"들어가기도 전에 돈부터 떼 가니 남는 게 없소."'],
  [/보조금이 나오는 층/, '"보조금 주는 층으로 갑시다"', '"관리국이 보조금 주는 층이 있다길래 그리로 가오. 고맙소."'],
  [/공략본대로 했다가 크게 당했다/, '"종이 한 장 믿었다가"', '"관리국 공략본대로 했다가 동료를 잃을 뻔했소. 다음 공략본은 좀 더 알아보고 내시오."'],
  [/공략본이 맞아떨어졌다/, '"공략본, 고맙소"', '"관리국 공략본대로 갔더니 정말 통했소. 이런 종이라면 매달 받고 싶소."'],
  [/사람을 아낀다/, '"관리국이 우릴 아끼긴 하오"', '"이달엔 우리 조 누구도 다치지 않았소. 관리국이 사람 귀한 줄은 아는 모양이오."'],
];
// 세력 동향 머리말
const FACTION_HED = { merchant: '상단 쪽 소식', church: '교회 쪽 소식', both: '상단과 교회' };
const RUMOR_RE = /소문|말이 돕니다|목격담|수군|자주 드나든다|함께 식사|작황을 걱정/;

const ADS: { title: string; text: string; inv?: boolean; when?: () => boolean }[] = [
  { title: '불꽃모루 대장간', text: '날 빠진 칼 하루 만에<br>원정 가는 조 1할 할인' },
  { title: '북문 경비대', text: '용병 모집<br>죽을 일 없는 일당 70G', inv: true },
  { title: '약방 푸른병', text: '교회 포션이 비쌀 때는<br>푸른병 물약을 찾으시오' },
  { title: '주막 늙은 곰', text: '원정 다녀온 조 첫 잔 무료<br>미궁 이야기 사 드림' },
  { title: '마법학교 서부 분교', text: '마법사 수습생 파견<br>원정 한 번 120G', inv: true },
  { title: '구함', text: '깊은 층 지도 그린 사람<br>후사하겠음 · 남부 항구 조' },
  { title: '은세공 길드', text: '은 장비 새로 들어옴<br>늑대 나오는 층 가는 조 환영' },
  { title: '변경 짐꾼 조합', text: '짐 지고 따라갑니다<br>전리품 운반 한 짐 15G', inv: true },
  { title: '털가죽 상회', text: '깊은 층은 춥소<br>털망토 입고 · 35G' },
  { title: '알림', text: '본지는 독자 투고를 받습니다<br>상인 조합 회관 2층' },
];

export function issue(m: number): Issue | null {
  const h = S.hist.find(x => x.month === m); if (!h) return null;
  const prev = S.hist.find(x => x.month === m - 1);
  const logs = logsFor(m);
  const arch = S.archive.filter(a => a.m === m + 1);
  const book = (S.books || []).find(b => b.m === m);
  const st = stories(m, logs, h, prev);
  const lead = st[0];
  const year = Math.ceil(m / 12), mo = (m - 1) % 12 + 1;
  const founding = S.runStart == null || m < S.runStart;

  // 1면 본문: 머리기사 + 이달 숫자 + 상인 조합의 논조
  const loot = book ? (book.inc.loot || 0) + (book.inc.heroLoot || 0) + (book.inc.backlog || 0) : 0;
  const body = [...lead.body];
  body.push(`이달 원정 성공률은 ${pct(h.rate)}, 돌아오지 못한 용병은 ${h.deaths}명이다. 관리국 면허를 가진 용병은 ${h.M}명${prev ? `으로 지난달보다 ${h.M >= prev.M ? `${h.M - prev.M}명 늘었다` : `${prev.M - h.M}명 줄었다`}` : '이다'}.`);
  if (founding) body.push(loot ? `관리국은 이달 전리품으로 ${fmt(loot)}G를 벌었다. 아직 개척기라 변경 사람들은 이 미궁이 돈이 될지 반신반의한다.` : '판로가 없어 전리품은 아직 관리국 창고에 쌓여만 있다. 상인 조합은 "물건이 돌아야 장사가 된다"며 판로를 재촉했다.');
  else if (prev && h.pm > prev.pm) body.push(`상단 포션 값은 한 병 ${h.pm}G로 지난달보다 ${h.pm - prev.pm}G 올랐다. 상인 조합은 "값이 오른 데는 다 사정이 있다"고 했지만, 용병들의 지갑은 얇아졌다.`);
  else if (loot) body.push(`전리품 거래로 관리국 금고에 들어온 돈은 ${fmt(loot)}G. 시장에 물건이 돌면 상인도 웃는다는 것이 본지의 오랜 지론이다.`);

  // 이달의 숫자
  const dir = (a, b): 'up' | 'dn' | '' => (a > b ? 'up' : a < b ? 'dn' : '');
  const dt = (a, b, unit = '') => b == null ? '' : a === b ? '–' : `${a > b ? '▲' : '▼'}${fmt(Math.abs(a - b))}${unit}`;
  const figures = [
    { label: '상단 포션 한 병', value: `${h.pm}G`, delta: dt(h.pm, prev?.pm), dir: dir(h.pm, prev?.pm ?? h.pm) },
    ...(h.qC > 0 || (prev && prev.qC > 0) ? [{ label: '교회 포션 한 병', value: `${h.pc}G`, delta: dt(h.pc, prev?.pc), dir: dir(h.pc, prev?.pc ?? h.pc) }] : []),
    { label: '원정 성공률', value: pct(h.rate), delta: prev ? dt(Math.round(h.rate * 100), Math.round(prev.rate * 100), '%p') : '', dir: '' as const },
    { label: '사망', value: `${h.deaths}명`, delta: prev ? dt(h.deaths, prev.deaths) : '', dir: '' as const },
    { label: '면허 가진 용병', value: `${h.M}명`, delta: prev ? dt(h.M, prev.M) : '', dir: '' as const },
    { label: '전리품 거래', value: `${fmt(loot)}G`, delta: '', dir: '' as const },
    { label: '관리국 금고', value: `${fmt(h.treasury)}G`, delta: prev ? dt(h.treasury, prev.treasury) : '', dir: '' as const },
  ];

  // 아래 세 꼭지: 세력 동향 · 독자 투고 · 소문
  // 현장 증언(1층 · 교회: "...")은 소문 칸에 싣는다
  const facs = arch.filter(a => a.who !== 'other' && !/^\d+층 · /.test(a.t));
  const fac = facs.find(a => /: “/.test(a.t)) || facs.find(a => !RUMOR_RE.test(a.t));
  const facPart = fac
    ? (/: “/.test(fac.t) ? { tag: '세력 동향', hed: `${fac.t.split(':')[0]}의 말`, text: fac.t.slice(fac.t.indexOf('“')) } : { tag: '세력 동향', hed: FACTION_HED[fac.who] || '세력 동향', text: plain(fac.t) })
    : { tag: '세력 동향', hed: '상단도 교회도 잠잠', text: '이달은 상단 조합장도 대사제도 관리국을 두고 별말이 없었다. 조용한 것이 좋은 일인지는 두고 볼 일이다.' };
  const lt = LETTERS.find(([re]) => arch.some(a => re.test(a.t)));
  const sign = `— ${by(PARTIES, m, 1)} ${by(NAMES, m, 2)}`;
  const letter = lt ? { tag: '독자 투고', hed: lt[1], text: `${lt[2]} ${sign}` }
    : h.rate >= 0.55 ? { tag: '독자 투고', hed: '"이번 달은 할 만했소"', text: `"원정이 잘 풀렸소. 이대로만 가면 겨울 나기는 걱정 없겠소." ${sign}` }
    : { tag: '독자 투고', hed: '"이번 달도 빠듯했소"', text: `"빈손으로 나온 날이 더 많았소. 관리국이 무슨 수를 좀 내 주시오." ${sign}` };
  const testimony = rx(/^(\d+)층 증언 \((.+?)\): "(.+)"$/, logs);
  const rumorNote = arch.find(a => RUMOR_RE.test(a.t));
  const rumor = testimony ? { tag: '소문', hed: `${testimony[1]}층에서 들려온 말`, text: `${testimony[2]}에게서 나온 말이다. "${testimony[3]}" 본지는 확인하지 못했다. 관리국 공략본이 이 말을 받을지 지켜볼 일이다.` }
    : rumorNote ? { tag: '소문', hed: '주막에서 들은 이야기', text: `${plain(rumorNote.t)} 본지는 확인하지 못했다.` }
    : { tag: '소문', hed: '주막도 조용했다', text: '이달은 술잔 너머로 건너온 이야기가 별로 없었다. 소문이 없다는 것도 소식이라면 소식이다.' };

  // 광고: 그달 형편에 맞는 것이 먼저 실린다
  const ads = ADS.slice();
  const first = (h.pc > (prev?.pc ?? h.pc) || h.pm > (prev?.pm ?? h.pm)) ? ads[2] : h.deaths >= 5 ? ads[1] : by(ads, m, 3);
  const rest = ads.filter(a => a !== first);
  const pickAds = [first, by(rest, m, 4), by(rest.filter(a => a !== by(rest, m, 4)), m, 5)];

  const leftEar = founding ? `<b>관리국 개척기</b>${m}개월째` : `<b>오늘의 미궁</b>원정 성공 ${pct(h.rate)}<br>사망 ${h.deaths}명`;
  const rightEar = `<b>포션 한 병</b>상단 ${h.pm}G${prev && h.pm !== prev.pm ? ` ${h.pm > prev.pm ? '▲' : '▼'}${Math.abs(h.pm - prev.pm)}` : ''}`;

  return {
    no: m, m, extra: !!lead.extra, first: m === 1,
    date: `제${year}년 제${mo}월 마지막 날 · 임기 제${m}월`,
    ears: [leftEar, rightEar],
    kicker: lead.kicker, hed: lead.hed, dek: lead.dek, by: `본지 ${by(REPORTERS, m)}`, body,
    briefs: st.slice(1).filter(x => x.p >= 30).slice(0, 3).map(x => x.hed),
    figures, lower: [facPart, letter, rumor], ads: pickAds,
  };
}
