# HANDOFF.md — 다음 세션 인수인계

> 이 문서만 읽으면 바로 이어서 작업 가능합니다.

---

## 현재 상태

v1.4 완료. 포터블 EXE 빌드 가능 상태. v1.3 릴리즈(r) 전용 출력 폼에 더해 Gemini 무료 API 중심의 모델 선택, R18 번역 프롬프트, 오류 분류 및 fallback 처리가 반영됨. 미해결 기능 요청 없음 (단, 아래 "미완성/보류 항목"의 연령등급 fallback 이슈는 답변 대기 중).

---

## 파일별 최신 상태

| 파일 | 상태 | 비고 |
|------|------|------|
| `main.js` | ✅ 최신 | Gemini v1.4 모델 allowlist, 태그/설명 프롬프트, 오류 분류와 재시도/fallback 포함 |
| `vndb_tool.html` | ✅ 최신 | v1.4, 모델 선택 + 다중 모드 + 릴리즈 모드 인라인 |
| `multi_mode.js` | ✅ 최신 | 참고용 별도 파일 (실제 로드 안 됨) |
| `release_mode.js` | ✅ 신규(v1.3) | 참고용 별도 파일 (실제 로드 안 됨), multi_mode.js와 동일 취급 |
| `server.js` | ⚠️ 미사용 | 레거시, 건드리지 말 것 |
| `image_routes.js` | 📄 참고용 | 실제 동작은 main.js 인라인 |
| `vndb_tool_image.js` | 📄 참고용 | 실제 동작은 vndb_tool.html 인라인 |

---

## 핵심 구조 (빠른 파악용)

```
단일 입력 (run())
  ├── r형식 → extractReleaseId() → runRelease() 전용 파이프라인 ★v1.3 신규
  │             (release_mode.js — VN과 다른 필드/출력 폼)
  └── v형식 → extractId() → 기존 VN 파이프라인 (변경 없음)

다중 입력 (2개+, runMulti())
  └── resolveMultiTokens() → 각 토큰을 {vnId, displayUrl}로 정규화
        ├── v형식 → vnId, displayUrl 동일
        └── r형식 → Release API로 vnId 리졸브, displayUrl만 원본 r주소 유지
      → 이후 전부 기존 VN 집계 테이블 포맷 그대로 (release_mode.js 미적용)
```

**포트:** 17373
**번역:** Gemini API (사용자 키, 모델 선택 가능, localStorage 저장)
**이미지:** 로컬 폴더 저장 → 사용자가 kone.gg에 수동 드래그

---

## 주의사항

### 코드 수정 시
- 서버 엔드포인트 → `main.js` `startServer()` 안
- 다중 모드 로직 → `vndb_tool.html` 인라인 + `multi_mode.js` **양쪽 동시**
- 릴리즈 모드 로직 → `vndb_tool.html` 인라인 + `release_mode.js` **양쪽 동시** ★v1.3
- `th`/`tw` 변수: 반드시 tagRow보다 먼저 선언 (TDZ 에러 전적 2건)
- 태그 번역은 반드시 `mode: "tags"` 사용 (`alias`는 작품 별칭 음역 전용)
- `CONTENT_BLOCKED`는 다른 모델로 우회하지 않고 원문을 유지

### kone.gg 제약
- `background-color` inline style → 다크모드 가독성 문제, 사용 금지
- 외부 이미지 URL, base64 img → 저장 시 제거/차단
- 게임 태그 `<details>`는 기본 닫힘, 게임 개요 `<details open="">`는 기본 펼침이며 `<div data-type="detailsContent">` 구조 유지
- 태그는 VNDB 원문 링크를 항상 포함하고 번역 성공 시 한국어를 괄호로 병기
- 퍼블리셔 언어 → JP(`ja`), EN(`en`), CN(`zh-Hans`)만 출력. RU/TW 등 나머지는 제외

### VNDB API 제약 ★v1.3
- **VN relations(관련제품) 필드는 API 자체에 없음** — 공식 문서에 "Currently missing from the old API: VN relations, staff, anime relations and external links" 명시. 스크래핑으로 우회하지 말 것(합의됨).
- release 객체에는 rating/votecount/tags/description이 없음 — VN 쪽 필드. release 모드는 `/release` 쿼리에 `vns.rating`/`vns.tags.*`를 중첩으로 끼워 넣거나(평점/태그), `/vn` 별도 호출로 보강(개발사/개요)하는 방식으로 처리.

### 배포 시
- `img_save_path`는 사용자별 localStorage에 저장해 재실행 시 복원. 소스나 배포 EXE에는 실제 경로가 포함되지 않음
- 빌드: `npm run build`
- 출력: `dist/VNDB-HTML-Generator.exe`

---

## 미완성/보류 항목

**연령등급 fallback의 언어 불일치 가능성** ★v1.3 신규, 답변 대기
- 릴리즈 모드에서 `release.minage`가 null이면 기존 `fetchAgeRating(vnId)`를 재사용하는데, 이 함수는 VN의 **ja 언어 릴리즈만** 필터링해서 집계함
- 즉 minage가 비어있는 릴리즈가 ja가 아닌 언어판이면, fallback으로 채워지는 값이 "이 릴리즈"가 아니라 "그 VN의 일본어판" 연령등급일 수 있음
- 현재는 VN 모드 로직을 그대로 재사용한 상태 — 수정 여부 확인 필요

**kone.gg 직접 이미지 업로드**
- API: `POST https://api.kone.gg/v1/upload/image`
- Content-Type: `application/cbor`, 인증: 세션 쿠키
- 상세: `IMAGE_UPLOAD.md` 참고

**Gemini 3.x 모델 검증**
- 모델명을 3.x로 교체했으나 실제 API 동작 미확인
- 오류 시 모델명 재확인 필요


## v1.3 릴리즈 검토 (2026-09-10)

- 제공된 src.zip의 실제 인라인 코드에서 v1.3 기능을 확인했습니다.
- 소스 위치는 저장소의 src/입니다. 설치 및 빌드 명령은 src/에서 실행합니다.
- 패키지 버전을 1.3.0으로 정리하고, multi_mode.js를 실제 인라인 코드와 동기화했습니다.
- 과거 문서에 언급된 image_routes.js, vndb_tool_image.js, IMAGE_UPLOAD.md는 이번 제공 자료에 없습니다. 이미지 구현은 main.js와 vndb_tool.html에 있습니다.
- Gemini API 번역, kone.gg 붙여넣기와 Windows GUI 실사용은 이번 검토에서 검증하지 않았습니다. 기존의 빌드 가능 및 외부 서비스 관련 서술은 과거 인수인계 기록입니다.
- 릴리즈 연령등급의 일본어판 fallback은 기존 알려진 제한으로 유지합니다.
