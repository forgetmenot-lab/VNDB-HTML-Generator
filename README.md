# VNDB HTML Generator

## v1.4

- 무료 Gemini API 사용자를 위한 모델 구성을 `3.5 Flash-Lite` 기본, `3.8 Flash` 고품질 옵션으로 갱신했습니다.
- VNDB의 R18 태그와 작품 설명을 임의로 순화하지 않는 보존적 번역 프롬프트를 적용했습니다.
- 무료 할당량 초과·일시 장애 재시도, 모델 fallback, 안전 정책 차단 및 API 오류 구분을 추가했습니다.
- 번역이 불가능하면 기존 동작대로 원문을 사용합니다.
- 게임 태그는 VNDB 원문과 태그 정의 링크를 항상 유지하고, 번역 성공 시 한국어를 함께 표시합니다.
- 퍼블리셔는 JP/EN/CN 중 실제 존재하는 항목만 출력합니다.
- 게임 태그는 기본 닫힘, 게임 개요는 기본 펼침 상태로 생성합니다.
- 이미지 저장 폴더는 배포본에 포함하지 않고 각 사용자 PC에만 저장하여 재실행 시 복원합니다.
- 중복 실행 방지, 로컬 서버 포트 충돌 안내 및 kone.gg 게시글용 하단 입력 공간을 개선했습니다.

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
- 릴리즈 주소: 타이틀/원제/개발사/퍼블리셔/발매일/연령등급/평점/태그 (별칭 제외, 발매일 추가)
- 퍼블리셔는 JP/EN/CN 중 VNDB에 실제 존재하는 언어만 출력하며 RU/TW 등 그 외 언어는 제외
- 게임 태그는 기본 닫힘, 게임 개요는 기본 펼침 상태로 생성
- 태그는 `VNDB 원문 링크 (한국어 번역)` 형식이며 번역 실패 시에도 원문 링크를 유지

### 다중 입력 (쉼표 구분, v/r 혼용 가능)
```
v1, v2, r456
https://vndb.org/v1, vn2
```
2개 이상 입력 시 자동으로 다중 모드 처리. 다중 모드에서는 r 주소가 섞여도 VN 집계 포맷 그대로 사용되며, VNDB 링크만 입력한 주소(r/v) 그대로 표기됩니다.

### 이미지 업로드 모드
1. 토글 ON → 폴더 선택
2. 생성 후 "폴더 열기" 버튼 → 탐색기에서 전체 선택 → kone.gg에 드래그
3. 선택한 폴더는 해당 사용자 PC에만 저장되어 다음 실행 시 복원

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
