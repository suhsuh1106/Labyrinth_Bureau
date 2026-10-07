import { defineConfig } from 'vite';

// GitHub Pages는 저장소 이름 아래(/Labyrinth_Bureau/)로 서비스되므로 빌드할 때 base를 맞춘다
export default defineConfig({
  base: process.env.PAGES_BASE ?? '/',
  // 새 용병단 게임(index.html)과, 정리 단계까지 남겨 두는 옛 관리국 게임(bureau.html)
  build: { rollupOptions: { input: { main: 'index.html', bureau: 'bureau.html' } } },
  test: { include: ['tests/**/*.test.ts'] },
} as any);
