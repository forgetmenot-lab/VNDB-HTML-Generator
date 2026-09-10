# VNDB HTML Generator v1.3

제공된 v1.3 소스와 인수인계 문서를 반영한 릴리즈입니다.

## 주요 변경
- 릴리즈(r) 단독 입력 전용 출력: 타이틀, 원제, 발매일, 연령등급, 평점, 태그, 게임 개요.
- v/r 혼합 다중 입력 지원 및 입력한 VNDB 주소 보존.
- 이미지 로컬 폴더 저장, HTML 서식 클립보드 복사, Gemini 모델 선택 전달.
- README, PROJECT, STATUS, HANDOFF 문서 추가 및 갱신.
- 패키지 버전 1.3.0 정리, 참고용 multi_mode.js와 실제 인라인 코드 동기화.

## 검증
- JavaScript 문법 검사 통과.
- 입력 파싱, 릴리즈 출력 및 모의 응답 처리, 혼합 입력 링크 보존, 참고 코드 일치, HTML 클립보드 테스트 통과.
- Windows 포터블 EXE는 GitHub Actions 빌드 성공 후 첨부됩니다.
- Gemini 실제 번역, kone.gg 붙여넣기, Windows GUI 실사용은 검증하지 않았습니다.

## 알려진 제한
- 릴리즈 연령등급이 없으면 VN의 일본어 릴리즈 등급으로 보강합니다.
- Gemini 모델 이름과 계정별 API 사용 가능 여부는 실사용 검증이 필요합니다.
- kone.gg 직접 이미지 업로드는 제공하지 않으며 이미지를 수동으로 드래그해야 합니다.
- 과거 문서의 image_routes.js, vndb_tool_image.js, IMAGE_UPLOAD.md는 제공 자료에 없습니다.

## 사용
- Windows: 첨부된 VNDB-HTML-Generator.exe 실행.
- 소스: src 폴더에서 npm ci 후 npm start. 빌드는 npm run build.
