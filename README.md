# VNDB HTML Generator

해당 프로그램은 vndb.org 주소를 입력하면 vndb api를 호출하여 
정해진 양식에 따라 자동으로 html으로파싱해줍니다. 

Geminy pai key를 추가하면 개요 및 별칭 번역을 시도하고,
실패하면 원본인 영문으로 삽입됩니다.

단 릴리즈 주소를 입력하면 작동하지 않습니다.

## 내부작동 로직
데이터 추출 및 API 연동: 입력된 URL에서 고유 식별자(VN ID)를 파싱한 후, 로컬 프록시 서버를 통해 VNDB API를 호출하여 원제, 제작사, 퍼블리셔, 평점 등의 메타데이터 원본을 수집합니다.

제미나이(Gemini) 기반 데이터 가공: 수집된 영문 시놉시스와 별칭(Alias) 데이터를 Gemini API로 전송하여, 자연스러운 한국어 번역 및 독음 텍스트로 변환하는 자연어 처리 과정을 거칩니다.

최종 HTML 구조화: 취합된 원본 데이터와 AI 번역 결과물을 미리 정의된 커뮤니티 게시 양식(HTML 테이블 및 details 태그)에 맞춰 렌더링하고, 사용자가 즉시 복사할 수 있는 최종 코드로 출력합니다.

입력된 제미나이키는 로컬 환경에서만 저장합니다. 외부 유출 없습니다.

## 구성

| 파일 | 설명 |
|---|---|
| `main.js` | Electron 메인 프로세스 |
| `server.js` | Express 로컬 프록시 서버 (VNDB API 중계) |
| `vndb_tool.html` | UI |
| `package.json` | 프로젝트 설정 및 빌드 스크립트 |

## 실행 방법 (소스에서)

```bash
npm install
npm start
```

## 포터블 EXE 빌드

```bash
npm run build
```

빌드 결과물은 `dist/` 폴더에 생성됩니다.

## 릴리즈

포터블 EXE는 [Releases](../../releases) 탭에서 다운로드할 수 있습니다.

## Docker (구버전 방식)

포터블화 이전의 서버 전용 실행 방식입니다.

```bash
docker-compose up -d
```

브라우저에서 `http://localhost:8080` 접속
