# Labyrinth Bureau

> 사흘 만에, 아랫마을 셋이 세금 장부에서 빠졌다. 중앙은 관청 하나와 도장 하나를 내려보냈다.

미궁관리국 경영 · 정치 시뮬레이션입니다. 국장에게는 병사도 명령권도 없습니다. 예산과 서류로 길드 일곱을 움직여 미궁의 범람을 막습니다.

> **새 방향: Launderinth(론더린스).** 변방 미궁 영지의 영주가 겉으로는 건실한 타이쿤을, 속으로는 장부 조작과 돈세탁으로 비자금을 굴려 대공까지 오르는 정치 · 부패 경영 시뮬입니다. 프로토타입 `launderinth.html`, 기획 `docs/launderinth.md`.
>
> 아래 미궁관리국과 그 문서는 지난 기획입니다(`old/`).

- 게임 시스템: `old/docs/systems.md` (통합 기획서)
- 엔진 기록: `old/docs/bureau.md`
- 세계관: `old/docs/world.md`
- 옛 용병단 게임(`company.html`)의 자료: `old/docs/legacy/`

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
