# VNDB HTML Generator — 프로젝트 컨텍스트 문서

> 새 대화창에서 이 문서를 붙여넣으면 프로젝트 맥락을 즉시 이어받을 수 있습니다.

---

## 1. 프로젝트 개요

**목적:** VNDB URL을 입력하면 VNDB API를 호출해 게임 정보를 파싱하고, kone.gg 커뮤니티에 바로 붙여넣을 수 있는 서식 있는 HTML을 클립보드에 복사해주는 Electron 데스크탑 앱.

**배포 형태:** Windows 포터블 EXE (`npm run build`)

**핵심 제약:**
- 출력 대상이 kone.gg rich text 에디터. `ClipboardItem text/html` 방식으로 복사해야 붙여넣기 시 렌더링됨
- kone.gg는 외부 이미지 URL, base64 img src 모두 저장 시 제거/차단함
- kone.gg `<details>` 태그는 `<div data-type="detailsContent">` 구조를 유지하며, 게임 태그는 닫힘·게임 개요는 `open=""`으로 펼침
- kone.gg 다크모드에서 inline style `background-color` 사용 금지 (텍스트 가독성 문제)
- 릴리즈(r) URL 단독 입력 시 **VN과 완전히 다른 전용 출력 폼**으로 처리됨 (v1.3) — 다중 입력에 섞인 경우는 기존 VN 집계 포맷 유지
- VNDB Kana API에는 VN relations(관련제품) 필드가 없음 — 공식 문서 확인됨, 향후에도 이 필드 요청 들어오면 API 미지원 사실부터 짚을 것

---

## 2. 파일 구조

```
main.js             # Electron 메인 프로세스 + 인라인 Express 서버 (포트 17373)
server.js           # 미사용 레거시 (건드리지 말 것)
vndb_tool.html      # UI + 전체 클라이언트 로직 (multi_mode.js, release_mode.js 인라인 포함)
multi_mode.js       # 다중 URL 처리 로직 참고용 별도 파일
release_mode.js     # 릴리즈(r) 단독 입력 처리 로직 참고용 별도 파일 (v1.3 신규)
image_routes.js     # 이미지 서버 라우트 참고용 별도 파일
vndb_tool_image.js  # 이미지 프론트엔드 로직 참고용 별도 파일
IMAGE_UPLOAD.md      # kone.gg 이미지 업로드 시도 기록 + 미래 구현 가이드
```

> **주의:** `multi_mode.js`, `release_mode.js`는 둘 다 참고용. 실제 동작 코드는 `vndb_tool.html` 하단 `<script>` 인라인.
> 다중 모드 수정 시 **vndb_tool.html 인라인 + multi_mode.js 양쪽 동시 수정** 필수.
> 릴리즈 모드 수정 시 **vndb_tool.html 인라인 + release_mode.js 양쪽 동시 수정** 필수.

---

## 3. 아키텍처

```
vndb_tool.html (UI)
    │  fetch
    ▼
localhost:17373 (main.js 인라인 Express 서버)
    │  node-fetch
    ├── POST /vn          → https://api.vndb.org/kana/vn
    ├── POST /release     → https://api.vndb.org/kana/release
    ├── POST /translate   → https://generativelanguage.googleapis.com (Gemini)
    ├── GET  /selectfolder → Electron dialog.showOpenDialog
    ├── POST /saveimg     → VNDB 이미지 URL → 로컬 파일 저장
    └── GET  /openfolder  → shell.openPath (탐색기 열기)
```

릴리즈 모드는 새 서버 엔드포인트 없이 기존 `/vn`, `/release` 범용 프록시를 다른 `fields` 파라미터로 재사용함. **main.js는 v1.3에서 변경 없음.**

---

## 4. main.js 핵심 사항

- `startServer()` 안에 Express 라우트 전부 포함
- `dialog` import 추가됨
- `/translate` 엔드포인트: allowlist 내 `req.body.model`로 동적 모델 선택, 기본값 `gemini-3.5-flash-lite`
- 무료 API의 429/일시 장애는 한 번 재시도하며, 선택 모델 사용 불가 시 기본 모델로 fallback
- 안전 정책 차단은 fallback하지 않고 `CONTENT_BLOCKED`로 반환
- 창 위치/크기: `userData/window-state.json` 저장/복원

---

## 5. vndb_tool.html 핵심 함수

### VN 모드 / 공통

| 함수 | 역할 |
|------|------|
| `extractId(url)` | v 형식 입력에서 vnId 추출 |
| `resolveToVnId(input)` | v→그대로, r→Release API로 상위 VN ID 조회 (다중모드에서 사용) |
| `run()` | 단일/다중/릴리즈 분기 후 처리 |
| `buildHtml(...)` | VN 단일 모드 최종 HTML 생성 |
| `fetchVndb(vnId)` | VN 데이터 조회 |
| `fetchPublishers(vnId)` | 퍼블리셔 조회 → JP/EN/CN만 언어별 집계하고 실제 존재하는 항목만 출력 |
| `fetchAgeRating(vnId)` | 연령등급 조회 (VN의 ja 릴리즈 집계). null/0 → 전연령 |
| `translateWithGemini(text, apiKey, mode)` | Gemini 번역. mode: desc/alias/tags |
| `copyAsRichText(html)` | ClipboardItem text/html 방식 복사 |
| `buildImagePool(vnData)` | 이미지 URL 풀 생성 (safe/adult) |

### 다중 모드 (multi_mode.js)

| 함수 | 역할 |
|------|------|
| `parseMultiUrls(input)` | 쉼표 구분 토큰 배열 반환 (원문 그대로, 정규화는 다음 함수에서) |
| `resolveMultiTokens(tokens, log)` | ★v1.3 변경. 각 토큰을 `{vnId, displayUrl}`로 정규화. r 토큰은 vnId로 리졸브하되 displayUrl은 원본 r주소 유지 |
| `runMulti(resolvedTokens, apiKey)` | 다중 URL 처리 메인 함수. `resolveMultiTokens` 결과를 받음 |
| `buildMultiGameTable(vnId, vnData, tagStr, displayUrl)` | ★v1.3 `displayUrl` 파라미터 추가. VNDB 행에 원본 주소 표기 |

> **폐지:** `resolveMultiToVnIds` → `resolveMultiTokens`로 대체 (반환 타입이 `vnId[]`에서 `{vnId, displayUrl}[]`로 변경)

### 릴리즈 모드 (release_mode.js) — v1.3 신규

| 함수 | 역할 |
|------|------|
| `extractReleaseId(url)` | r 형식 입력에서 rId 추출 |
| `fetchReleaseFull(rId)` | `/release` 단일 호출. title/alttitle/minage/released/producers + 중첩 `vns.rating/vns.votecount/vns.tags.*` 한 번에 조회 |
| `fetchVnDeveloper(vnId)` | 릴리즈에 developer 표시 없을 때만 `/vn`에서 `developers.name` 별도 조회 |
| `fetchVnDescription(vnId)` | `/vn`에서 `description` 별도 조회 (release 객체엔 없는 필드) |
| `formatReleasePublisher(release)` | 릴리즈 자체 언어 중 JP/EN/CN만 실제 존재하는 순서대로 포맷 |
| `formatReleaseAge(minage)` | null이면 fallback 필요 신호로 null 반환, 0이면 전연령 |
| `buildReleaseHtml(rId, release, developer, ageRatingStr, tagStr, descHtml)` | 릴리즈 모드 최종 HTML 생성 |
| `runRelease(rId, apiKey, log)` | 릴리즈 모드 메인 진입점. 개발사/연령등급/개요 순으로 빈 값 보강 후 병합 |

---

## 6. 입력 형식

모두 동일하게 처리 (대소문자 무관):
```
https://vndb.org/v7724   → VN 직접
https://vndb.org/r63343  → 릴리즈 직접 (v1.3부터 전용 출력 폼)
v7724 / vn7724 / vndb7724
r63343
V7724 / VN7724 / VNDB7724
```

쉼표 구분 다중 입력 (v/r 혼용 가능):
```
v12345, r123
https://vndb.org/v1, vn2, r456
```
다중 입력에서는 r도 VN 집계 포맷으로 처리되며, VNDB 주소 행만 원본 r주소로 표기됨 (release_mode.js 전용 필드는 다중모드에 적용 안 됨).

---

## 7. run() 실행 흐름

```
입력값 파싱
  → parseMultiUrls()로 토큰 분리
  → 토큰 2개+: resolveMultiTokens() → runMulti()
  → 토큰 1개, r형식: extractReleaseId() → runRelease() ★v1.3
  → 토큰 1개, v형식: extractId() → 기존 VN 파이프라인

VN 단일 파이프라인 (7단계, 변경 없음):
1. fetchVndb() — VN 데이터
2. 이미지 저장 (업로드 모드 ON + 폴더 지정 시)
3. fetchPublishers() + fetchAgeRating() 병렬
4. 별칭 번역 (Gemini alias)
5. Description 번역 (Gemini desc)
6. 태그 상위 5개 번역 (Gemini tags) + VNDB 원문 링크 병기
7. buildHtml() → 클립보드 복사

릴리즈 단일 파이프라인 (runRelease, v1.3 신규):
1. fetchReleaseFull() — 릴리즈 데이터 (VN 중첩 필드 포함, 단일 호출)
2. 개발사 보강 — 릴리즈에 없으면 fetchVnDeveloper() 별도 호출
3. 연령등급 보강 — release.minage null이면 fetchAgeRating() 재사용
4. 태그 번역 (Gemini tags, vns.tags에서 이미 조회됨) + VNDB 원문 링크 병기
5. 개요 조회 + 번역 — fetchVnDescription() 별도 호출 → Gemini desc 번역
6. buildReleaseHtml() → 클립보드 복사
```

---

## 8. 출력 HTML 구조

### 단일 VN 모드 (변경 없음)
```
빈 문단 (이미지 수동 삽입 공간)

<table style 왼쪽열 width:100px>
  원제 / 개발사 / 퍼블리셔(JP/EN/CN 중 존재 항목) / 별칭 / VNDB링크(정규화된 URL)
  플레이타임 / 연령등급(전연령 포함) / 평점
  게임태그 (VNDB 원문 링크 + 한국어 번역, 기본 닫힘 details)
</table>
<details open=""><summary>게임 개요(VNDB)</summary>
  <div data-type="detailsContent"><p>...</p></div>
</details>

📌 한패출처 : (굵게)
🔗 링크 : (굵게)
<hr> + 사용자 입력 여백
```

### 단일 릴리즈 모드 (v1.3 신규)
```
빈 문단 (이미지 수동 삽입 공간)

<table style 왼쪽열 width:100px>
  타이틀(release.title) / 원제(release.alttitle) / 개발사 / 퍼블리셔(단순 포맷)
  VNDB링크(입력된 r주소) / 발매일 / 연령등급 / 평점
  게임태그 (VNDB 원문 링크 + 한국어 번역, 기본 닫힘 details)
</table>
<details open=""><summary>게임 개요(VNDB)</summary>
  <div data-type="detailsContent"><p>...</p></div>
</details>

📌 한패출처 : (굵게)
🔗 링크 : (굵게)
<hr> + 사용자 입력 여백
```
관련제품(Relation) 행 없음 — API 미지원으로 제외됨.

### 다중 모드 (변경 없음, VNDB 행만 v1.3에서 displayUrl 사용)
```
<table style 왼쪽열 width:100px>
  제목(colspan=2) / 이미지(colspan=2)
  원제 / 개발사 / VNDB(입력된 주소 그대로, r/v 혼용 가능) / 플레이타임 / 평점 / 게임태그 / 한패출처 / 특이사항
</table>
<hr>
... (n개 반복)
＊ 링크 :
```

---

## 9. Gemini 모델 목록 (v1.4)

| 드롭다운 표시 | API 모델 스트링 |
|------|------|
| gemini-3.5-flash-lite (기본·번역 권장) | `gemini-3.5-flash-lite` |
| gemini-3.8-flash (고품질) | `gemini-3.8-flash` |
| gemini-3.1-flash-lite (호환) | `gemini-3.1-flash-lite` |
| gemini-3.1-pro-preview | `gemini-3.1-pro-preview` |

`gemini-3.8-flash` 번역 요청은 불필요한 지연과 thinking 토큰을 줄이기 위해 thinking level `low`를 사용한다. 기존 localStorage 값 `gemini-3.5-flash`와 `gemini-3.1-pro`는 각각 새 기본 모델과 올바른 preview ID로 자동 이관한다.

---

## 10. localStorage 저장 항목 (변경 없음)

| 키 | 비고 |
|----|------|
| `gemini_api_key` | 저장됨 |
| `gemini_model` | 저장됨 |
| `upload_mode` | 저장됨 |
| `image_mode` | 저장됨 |
| `img_save_path` | 사용자 PC에 저장됨. 배포 EXE에는 실제 경로가 포함되지 않음 |

---

## 11. 이미지 업로드 현황 (변경 없음)

kone.gg API 스펙 확인 (2025-04):
- `POST https://api.kone.gg/v1/upload/image`
- Content-Type: `application/cbor`, 인증: 쿠키(`__Secure-Neko`)
- 구현 보류 (복잡도 높음)

**현재 방식:** VNDB 이미지 → 로컬 폴더 저장 → 탐색기 다중 선택 → kone.gg 드래그

---

## 12. 코딩 컨벤션

- Surgical 수정 — 요청된 것만, 인접 코드 건드리지 않기
- 서버 수정 → `main.js` `startServer()` 내부만
- 다중 모드 수정 → `vndb_tool.html` 인라인 + `multi_mode.js` 양쪽
- 릴리즈 모드 수정 → `vndb_tool.html` 인라인 + `release_mode.js` 양쪽 (v1.3)
- TDZ 주의: `th`/`tw` 같은 변수는 반드시 사용 전 선언
- VNDB API에 없는 필드(관련제품/relations 등) 요청 들어오면 API 미지원 사실부터 확인 후 진행


## v1.3 릴리즈 검토 (2026-09-10)

- 제공된 src.zip의 실제 인라인 코드에서 v1.3 기능을 확인했습니다.
- 소스 위치는 저장소의 src/입니다. 설치 및 빌드 명령은 src/에서 실행합니다.
- 패키지 버전을 1.3.0으로 정리하고, multi_mode.js를 실제 인라인 코드와 동기화했습니다.
- 과거 문서에 언급된 image_routes.js, vndb_tool_image.js, IMAGE_UPLOAD.md는 이번 제공 자료에 없습니다. 이미지 구현은 main.js와 vndb_tool.html에 있습니다.
- Gemini API 번역, kone.gg 붙여넣기와 Windows GUI 실사용은 이번 검토에서 검증하지 않았습니다. 기존의 빌드 가능 및 외부 서비스 관련 서술은 과거 인수인계 기록입니다.
- 릴리즈 연령등급의 일본어판 fallback은 기존 알려진 제한으로 유지합니다.
