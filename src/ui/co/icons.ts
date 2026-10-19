// 약점 · 장비 속성 아이콘: 둔기 · 찌르기 · 화염 · 냉기 · 신성 · 독. 원형 바탕에 흰 그림 (임시 그림, 이름은 title로)
const S = 'fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';
const EL: Record<string, [string, string]> = {
  둔기: ['#8a6440', '<path fill="#fff" d="M4 5h11v5H4z"/><path fill="#fff" d="M8.5 10h2.4v10H8.5z"/>'],
  찌르기: ['#5e7486', `<path ${S} d="M5 19 18 6M11 6h7v7"/>`],
  화염: ['#c9532a', '<path fill="#fff" d="M12 3c.8 3.6 5.5 5.2 5.5 10.2a5.5 5.5 0 0 1-11 0c0-2.8 1.6-4.2 2.3-6.4 1.1 1 1.7 2.3 1.8 3.8 1.2-2.2 1.6-4.6 1.4-7.6z"/>'],
  냉기: ['#3a86bd', `<path ${S} d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>`],
  신성: ['#b8921f', '<path fill="#fff" d="M10.6 3.5h2.8v5.1h5.1v2.8h-5.1v9.1h-2.8v-9.1H5.5V8.6h5.1z"/>'],
  독: ['#5a9236', '<path fill="#fff" d="M12 3c3.2 4.6 6 7.8 6 11.6a6 6 0 0 1-12 0C6 10.8 8.8 7.6 12 3z"/>'],
};
// g: '화염' 또는 'g:화염'. bad면 붉은 테(역효과), tip은 title 앞뒤에 붙일 말
export function el(g: string, o: { bad?: boolean; tip?: string } = {}) {
  const k = g.startsWith('g:') ? g.slice(2) : g, x = EL[k]; if (!x) return k;
  const t = o.tip ?? k;
  return `<i class="el${o.bad ? ' bad' : ''}" style="--el:${x[0]}" role="img" aria-label="${t}" title="${t}"><svg viewBox="0 0 24 24" aria-hidden="true">${x[1]}</svg></i>`;
}
// 장비 한 벌: 아이콘 + "장비"
export const gearTag = (g: string) => `${el(g, { tip: `${g.replace(/^g:/, '')} 장비` })} 장비`;
