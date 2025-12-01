# 📚 힙독클럽 아카이버

서울야외도서관 힙독클럽 활동 기록을 노션으로 내보내는 데스크톱 앱

## 기능

- **나의서재** - 등록한 도서, 완독인증, 도서추천, 독서기록 내보내기
- **게시글** - 독서인증샷, 활동후기, 필사인증, 자유게시판 (댓글 포함)
- **출석현황** - 4월~12월 월별 방문/온라인 출석 기록

## 설치

### 요구사항

- Node.js 18+
- npm

### 실행

```bash
npm install
npm start
```

## 사용법

### 1. 서울야외도서관 로그인

앱 내 로그인 버튼을 눌러 서울야외도서관에 로그인

### 2. 노션 연결

1. [Notion Integrations](https://www.notion.so/my-integrations)에서 새 통합 생성
2. 생성된 시크릿 키를 앱에 입력
3. 저장할 노션 페이지에서 `···` → `연결` → 만든 통합 추가
4. 페이지 링크 복사 후 앱에 입력

### 3. 내보내기

원하는 항목 선택 후 내보내기 시작

## 빌드

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# 전체
npm run build
```

## 기술 스택

- Electron
- Cheerio (HTML 파싱)
- Notion API

## 라이선스

MIT License
