import { defineConfig } from 'vite';

// GitHub Pages는 저장소 이름 아래(/Labyrinth_Bureau/)로 서비스되므로 빌드할 때 base를 맞춘다
export default defineConfig({
  base: process.env.PAGES_BASE ?? '/',
  test: { include: ['tests/**/*.test.ts'] },
} as any);
