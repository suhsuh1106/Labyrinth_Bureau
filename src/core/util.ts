// 글자 도우미: 받침에 맞는 조사와, 편성 지침(c:직업 / g:장비)을 사람이 읽는 말로 옮기기

export const josa = (w: string) => ((w.charCodeAt(w.length - 1) - 0xAC00) % 28 ? '이' : '가');

// 결정표·현장 기록에 쓰는 이름: "마법사가 있는 파티", "은 장비"
export const keyLabel = (k: string) => (k.startsWith('c:') ? `${k.slice(2)}${josa(k.slice(2))} 있는 파티` : `${k.slice(2)} 장비`);

// 소문 문장에 쓰는 짧은 이름: "마법사", "은 장비"
export const keyWord = (k: string) => (k.startsWith('c:') ? k.slice(2) : `${k.slice(2)} 장비`);
