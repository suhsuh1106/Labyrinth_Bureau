// 고정 데이터: 파티를 이루는 직업과 장비, 소재를 찾는 곳, 단원의 이름과 특성.
// 몬스터와 소재는 monsters.ts, 근원 · 이상 징후 · 탐사 이야기 글은 events.ts에 있다 (여기서 다시 내보낸다)
export { type Mat, MAT_TIER, FAUNA, MONSTERS, type Monster, type Fauna } from './monsters';
export { ROOT_LORE, ANOMALIES } from './events';


// 소재를 찾는 곳: 어디서 들은 말인지(src)와 그 말을 들으려면 필요한 정보망 단계(lv). board는 누구나 보는 관리국 게시판
export const BUYERS: { who: string; src: 'board' | 'mkt' | 'chu'; lv: number }[] = [
  { who: '백작령 무기고', src: 'board', lv: 0 }, { who: '마법학교 연구실', src: 'mkt', lv: 1 }, { who: '약재상 조합', src: 'mkt', lv: 1 },
  { who: '교회 시약소', src: 'chu', lv: 1 }, { who: '수도 수집가', src: 'mkt', lv: 2 },
];
export const SRC_NAME = { board: '관리국 게시판', mkt: '상단 시세표', chu: '교회 소식지' };

export const CLASSES = ['전사', '궁수', '마법사', '사제', '도적'];

export const CLASS_SHARE = [0.35, 0.2, 0.12, 0.13, 0.2];

export const GEARS = ['일반', '화염', '냉기', '은', '둔기'];

export const GEAR_SHARE = [0.6, 0.1, 0.1, 0.1, 0.1];



export const KEYS = [...CLASSES.map(c => 'c:' + c), ...GEARS.filter(g => g !== '일반').map(g => 'g:' + g)];

// ---------- 단원 ----------
// 실력은 숫자 하나(0~100)이고 화면엔 다섯 단계로만 보인다
export const TIER_N = ['신입', '수련', '숙련', '노련', '명인'];
// 특성: 한 사람에 하나. 뽑을 때부터 보인다
export const TRAITS: Record<string, string> = {
  길잡이: '조의 층 이해도 +15, 지도에 보태는 몫 ×1.5',
  신중함: '본인 위기 −30%, 본인이 캐 오는 몫 −10%',
  욕심쟁이: '조의 갈무리 소재 +30%, 본인 위기 +20%',
  의무병: '조에서 다친 사람이 쉬지 않고 바로 복귀',
  눈썰미: '조의 갈무리 소재 +15%',
  강골: '포션 없이 맞은 위기에도 덜 죽는다 (절반)',
  새가슴: '조 이해도 50 밑의 층에서 성공 −10%p (1층은 상관없음). 급여가 싸다',
};
export const TRAIT_KEYS = Object.keys(TRAITS);
// 이름: 변경 사람들의 이름 (하르덴 · 엘마 · 오르반처럼)
export const GIVEN = ['브란', '이르마', '케일', '요아스', '미렐', '토르', '페드', '넬라', '우도', '리스', '하나', '오렌', '디아', '로웬', '사라', '카엘',
  '베른', '알마', '도란', '세라', '헤인', '마르타', '이반', '루네', '가브', '엘사', '오토', '니나', '라스', '테아', '빌름', '조라', '펠릭', '아다', '콘라', '마야',
  '구스', '레나', '하로', '일제', '얀', '베타', '로드', '키라', '말테', '솔베', '에반', '유타'];
export const FAMILY = ['오스카', '벨', '도랑', '펠', '하스', '갈렌', '누아', '크로', '반', '엠', '셀', '비', '룬', '키', '문', '둔', '하겐', '로크', '마렌', '에크',
  '브룩', '홀트', '바일', '린데', '스톤', '페어', '그란', '보스', '케른', '할로'];
