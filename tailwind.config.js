// Launderinth 프로토타입 전용(launderinth.html · src/launderinth/). 다른 화면의 CSS에는 @tailwind가 없어 영향이 없다
export default {
  content: ['./launderinth.html', './src/launderinth/**/*.ts'],
  theme: { extend: {
    colors: {
      ink: '#14110d', desk: '#1d1913', felt: '#26211a', line: '#3a3226', paper: '#e9dcc0', dim: '#a79878',
      clean: '#d9b45a', black: '#b4609a', blood: '#c2483d', moss: '#7fa36b',
    },
    fontFamily: { serif: ['"Gowun Batang"', 'serif'], sans: ['"IBM Plex Sans KR"', 'sans-serif'], mono: ['"IBM Plex Mono"', 'monospace'] },
  } },
};
