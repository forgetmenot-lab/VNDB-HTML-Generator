# VNDB HTML Generator

VNDB URL을 입력하면 kone.gg 게시글용 HTML을 자동 생성하는 Electron 데스크탑 앱.

---

## 설치 및 실행

```bash
cd src
npm install
npm start          # 개발 실행
npm run build      # 포터블 EXE 빌드 → dist/VNDB-HTML-Generator.exe
```

---

## 사용법

### 기본
1. Gemini API Key 입력 ([Google AI Studio](https://aistudio.google.com/apikey)에서 무료 발급)
2. VNDB URL 입력 후 생성 버튼
3. 자동으로 클립보드 복사 → kone.gg 에디터에 붙여넣기

### 입력 형식 (모두 동일하게 처리, 대소문자 무관)
```
https://vndb.org/v7724   ← VN URL
https://vndb.org/r63343  ← 릴리즈 URL
v7724 / vn7724 / vndb7724
r63343
```

**VN 주소(v)와 릴리즈 주소(r)는 단독 입력 시 서로 다른 출력 폼을 생성합니다.**
- VN 주소: 원제/개발사/퍼블리셔/별칭/플레이타임/연령등급/평점/태그
- 릴리즈 주소: 타이틀/원제/개발사/퍼블리셔/발매일/연령등급/평점/태그 (별칭 제외, 발매일 추가, 퍼블리셔는 해당 릴리즈 기준 단순 표기)

### 다중 입력 (쉼표 구분, v/r 혼용 가능)
```
v1, v2, r456
https://vndb.org/v1, vn2
```
2개 이상 입력 시 자동으로 다중 모드 처리. 다중 모드에서는 r 주소가 섞여도 VN 집계 포맷 그대로 사용되며, VNDB 링크만 입력한 주소(r/v) 그대로 표기됩니다.

### 이미지 업로드 모드
1. 토글 ON → 폴더 선택
2. 생성 후 "폴더 열기" 버튼 → 탐색기에서 전체 선택 → kone.gg에 드래그

---

## 파일 구조

아래 소스 파일은 `src/`에 있습니다.

```
main.js             # Electron + Express 서버 (포트 17373)
vndb_tool.html      # UI + 전체 클라이언트 로직
multi_mode.js       # 다중 URL 처리 참고용 (vndb_tool.html에 인라인)
release_mode.js     # 릴리즈(r) 단독 입력 처리 참고용 (vndb_tool.html에 인라인)
```

---

## 요구사항

- Node.js 18+
- Gemini API Key (번역 기능 사용 시)


## v1.3 릴리즈 검토 (2026-09-10)

- 제공된 src.zip의 실제 인라인 코드에서 v1.3 기능을 확인했습니다.
- 소스 위치는 저장소의 src/입니다. 설치 및 빌드 명령은 src/에서 실행합니다.
- 패키지 버전을 1.3.0으로 정리하고, multi_mode.js를 실제 인라인 코드와 동기화했습니다.
- 과거 문서에 언급된 image_routes.js, vndb_tool_image.js, IMAGE_UPLOAD.md는 이번 제공 자료에 없습니다. 이미지 구현은 main.js와 vndb_tool.html에 있습니다.
- Gemini API 번역, kone.gg 붙여넣기와 Windows GUI 실사용은 이번 검토에서 검증하지 않았습니다. 기존의 빌드 가능 및 외부 서비스 관련 서술은 과거 인수인계 기록입니다.
- 릴리즈 연령등급의 일본어판 fallback은 기존 알려진 제한으로 유지합니다.
