# STATUS.md — 현재 작업 상태

> 마지막 업데이트: v1.4 세션 완료

---

## 현재 버전: v1.4

---

## 완료된 작업 (v1.3 → v1.4)

- 번역 기본 모델을 `gemini-3.5-flash-lite`로 변경
- `gemini-3.8-flash` 고품질 옵션 추가, 번역 호출은 thinking level `low` 사용
- 잘못된 `gemini-3.1-pro` ID를 `gemini-3.1-pro-preview`로 수정
- 기존 저장값(`gemini-3.5-flash`, `gemini-3.1-pro`) 자동 이관
- VNDB 태그에 별칭 음역 프롬프트를 쓰던 문제를 수정하고 R18 용어를 보존하는 태그 전용 번역 모드 추가
- 성인용 작품 설명은 새로운 내용을 생성하지 않고 원문의 의미를 보존하는 번역 작업임을 프롬프트에 명시
- 무료 API 할당량 초과와 일시 장애를 한 번 재시도하고, 선택 모델을 사용할 수 없을 때 `gemini-3.5-flash-lite`로 fallback
- 안전 정책 차단은 다른 모델로 우회하지 않고 원문을 사용하도록 `promptFeedback.blockReason`과 `finishReason` 판별
- API 키, 할당량, 모델 접근, 일시 장애, 빈 응답 오류를 사용자 메시지로 구분
- 테이블과 게임 개요 사이의 `[내용]` 및 강제 여백을 제거
- 상단 `[이미지]` 문구를 제거하고 이미지 수동 삽입용 여백으로 교체
- 게임 개요 아래와 마지막 구분선 아래에 kone.gg 붙여넣기 기준의 입력 여백 적용
- `📌 한패출처 :`와 `🔗 링크 :`를 아이콘과 굵은 글씨로 강조
- Electron 단일 인스턴스 잠금 적용: 중복 실행 시 새 프로세스는 종료하고 기존 창을 복원·전면 표시
- 로컬 서버를 `127.0.0.1:17373`에만 바인딩하고 별도 포트 충돌 시 안내 후 정상 종료
- 게임 태그는 기본 닫힘, 게임 개요는 기본 펼침 상태로 생성
- 게임 태그는 VNDB 원문과 태그 정의 링크를 항상 유지하고 한국어 번역을 병기
- 이미지 저장 폴더는 사용자 PC의 localStorage에 저장하여 재실행 시 복원하며 배포본에는 포함하지 않음
- 퍼블리셔는 JP/EN/CN만 고정 순서로 출력하고 RU/TW 등 다른 언어는 제외

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
