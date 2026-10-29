import { defineConfig } from 'vite';

// GitHub Pages는 저장소 이름 아래(/Labyrinth_Bureau/)로 서비스되므로 빌드할 때 base를 맞춘다
export default defineConfig({
  base: process.env.PAGES_BASE ?? '/',
  // 두 게임: index.html(용병단 행정실) · bureau.html(미궁관리국)
  build: { rollupOptions: { input: { main: 'index.html', bureau: 'bureau.html' } } },
  // 판 단위 시험(36개월 × 여러 시드)은 CI에서 파일 셋이 함께 돌면 5초를 넘긴다
  test: { include: ['tests/**/*.test.ts'], testTimeout: 120000 },
} as any);
