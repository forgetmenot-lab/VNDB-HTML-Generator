# STATUS.md — 현재 작업 상태

> 마지막 업데이트: v1.3 세션 완료

---

## 현재 버전: v1.3

---

## 완료된 작업 (v1.22 → v1.3)

- 릴리즈(r) 단독 입력 전용 파이프라인 신설 (`release_mode.js`) — 기존엔 상위 VN으로 리졸브해서 VN 모드와 동일하게 출력했으나, v1.3부터 완전히 다른 출력 폼 사용
  - 타이틀/원제 분리 표기 (release.title / release.alttitle)
  - 개발사: 릴리즈에 없으면 VN 별도 호출로 보강
  - 퍼블리셔: 릴리즈 자체 언어 기준 단순 포맷 (VN 모드의 다중 릴리즈 집계와 다름)
  - 발매일 필드 추가 (release.released)
  - 연령등급: release.minage, 없으면 기존 fetchAgeRating() 재사용
  - 평점/게임태그: `/release` 쿼리에 vns.* 중첩으로 한 번에 조회
  - 게임 개요: VN 별도 호출로 description 조회 → Gemini 번역 → VN 모드와 동일한 details 구조로 병합
  - 관련제품(Relation) 항목은 제외 — VNDB API가 해당 필드를 노출하지 않음 (공식 문서 확인)
- 다중 모드: `resolveMultiToVnIds()` → `resolveMultiTokens()`로 교체, 반환 타입이 `{vnId, displayUrl}[]`로 변경
  - v/r 혼용 시 테이블 포맷은 기존 VN 집계 그대로, VNDB 주소 행만 원본 입력 주소(r이면 r, v면 v) 표기
- 버전 표기 1.22 → 1.3

---

## 완료된 작업 (v1.2 → v1.22)

### v1.21
- VNDB 링크 정규화: 입력값 그대로가 아닌 `https://vndb.org/${vnId}` 생성
- 연령등급 전연령 처리: `minage null/undefined/0` → "전연령" 표시
- 버그: buildHtml TDZ 에러 수정 (th 선언 순서)
- 버그: buildMultiGameTable TDZ 에러 수정 (tw 선언 순서)
- 버그: translateTagsMulti 에러 무시 → 로그 출력으로 수정

### v1.22
- Gemini 모델 2.5 → 3.x 교체 (드롭다운 + main.js 동적 처리)
- 릴리즈 ID 입력 지원: `r1234` 입력 시 Release API로 상위 VN ID 조회
- `extractReleaseId()`, `resolveToVnId()`, `resolveMultiToVnIds()` 추가
- 단일/다중 모드 모두 v/r 혼용 입력 처리

---

## 완료된 작업 (v1.1 → v1.2)

- 이미지: base64 포기 → 로컬 폴더 저장 방식
- 퍼블리셔: flagcdn 이미지 → `[JP]` 텍스트 태그
- 다중 URL 입력 모드 추가
- 입력 형식 확장: v/vn/vndb 단축형 + 대소문자 무관
- 테이블 회색 배경 제거 (다크모드 가독성)
- `img_save_path` localStorage 제거 (배포 오염 방지)

---

## 미해결 이슈

| 이슈 | 상태 |
|------|------|
| 릴리즈 모드 연령등급 fallback의 언어 불일치 가능성 | 답변 대기 (fetchAgeRating이 ja 릴리즈만 집계하는 기존 로직 재사용 중) |
| kone.gg 직접 이미지 업로드 | 보류 (CBOR+쿠키 방식, IMAGE_UPLOAD.md 참고) |
| details open 저장 버그 | kone.gg 자체 버그 |
| Gemini 3.x 모델 실제 동작 검증 | 미확인 (모델명 변경 후 테스트 필요) |

---

## 다음 작업 후보

- 없음 (현재 요청된 작업 없음, 단 위 "연령등급 fallback" 이슈는 방향 확정 시 코드 수정 필요)


## v1.3 릴리즈 검토 (2026-09-10)

- 제공된 src.zip의 실제 인라인 코드에서 v1.3 기능을 확인했습니다.
- 소스 위치는 저장소의 src/입니다. 설치 및 빌드 명령은 src/에서 실행합니다.
- 패키지 버전을 1.3.0으로 정리하고, multi_mode.js를 실제 인라인 코드와 동기화했습니다.
- 과거 문서에 언급된 image_routes.js, vndb_tool_image.js, IMAGE_UPLOAD.md는 이번 제공 자료에 없습니다. 이미지 구현은 main.js와 vndb_tool.html에 있습니다.
- Gemini API 번역, kone.gg 붙여넣기와 Windows GUI 실사용은 이번 검토에서 검증하지 않았습니다. 기존의 빌드 가능 및 외부 서비스 관련 서술은 과거 인수인계 기록입니다.
- 릴리즈 연령등급의 일본어판 fallback은 기존 알려진 제한으로 유지합니다.
