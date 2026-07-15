# 어린이 특허 명세서 메이커

초등학생이 자기 발명품으로 특허 명세서를 쓰고, 전자출원까지 체험하는 발명교육용 웹앱.

## 흐름

1. **명세서 만들기** (`/`) — 활동코드+별명 입장 → 손글씨 활동지 사진 OCR → 명세서 편집 + AI 변리사 도우미 → 도면 사진 → 한글(HWPX) 파일 다운로드
2. **출원 체험** (`/office.html`) — 모의 "특허로" 사이트에서 특허고객번호 발급 → 로그인 → 출원서 작성 → 수수료 면제 → 접수증 → 정리 퀴즈. 교사가 대시보드에서 열어야 입장 가능(잠금).
3. **교사 대시보드** (`/teacher.html`) — 비밀번호 로그인, 활동코드 발급/마감, 출원 체험 열기/잠그기, 학생별 초안·AI 대화 기록 열람

## 기술

- 바닐라 HTML/JS + Vercel Functions (`api/`)
- OCR·챗봇: 업스테이지 API (document-digitization, solar-pro2) — 키는 서버에서만 사용
- DB: Firebase Firestore (Admin SDK, 서버 전용)
- HWPX: 브라우저에서 직접 생성 (`hwpx.js` + `/hwpx/` 템플릿 + JSZip)

## 환경변수 (Vercel)

| 이름 | 내용 |
|---|---|
| `UPSTAGE_API_KEY` | 업스테이지 API 키 |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase 서비스 계정 키 JSON 전체 |
| `TEACHER_PASSWORD` | 교사 대시보드 비밀번호 |

## 로컬 개발

```
npm install
npm run dev   # localhost:3000 (.env 필요)
```
