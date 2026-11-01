# Labyrinth Bureau

> 사흘 만에, 아랫마을 셋이 세금 장부에서 빠졌다. 중앙은 관청 하나와 도장 하나를 내려보냈다.

미궁관리국 경영 · 정치 시뮬레이션입니다. 국장에게는 병사도 명령권도 없습니다. 예산과 서류로 길드 일곱을 움직여 미궁의 범람을 막습니다.

- 게임 시스템: `docs/systems.md` (통합 기획서)
- 엔진 기록: `docs/bureau.md`
- 세계관: `docs/world.md`
- 옛 용병단 게임(`company.html`)의 자료: `docs/legacy/` (지금 게임의 기준이 아닙니다)

## 해 보기

웹 브라우저 게임입니다 (TypeScript + Vite, 프레임워크 없음). 가로 화면 전용.

- **바로 하기**: main에 머지될 때마다 GitHub Pages에 올라갑니다. `https://suhsuh1106.github.io/Labyrinth_Bureau/`
- **내 컴퓨터에서**: Node 22가 필요합니다.

  ```bash
  npm install
  npm run dev        # 개발 서버 (http://localhost:5173)
  ```

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 (`/dev/loops.html`: 인과 루프 확인판) |
| `npm test` | 테스트 |
| `npm run typecheck` | 타입 검사 |
| `npm run sim:bureau` | 미궁관리국 봇 시뮬레이션 (idle · normal · smart) |
| `npm run build` | 배포용 빌드 (`dist/`) |
