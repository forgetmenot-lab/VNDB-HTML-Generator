/**
 * RELEASE_MODE.JS
 * ================
 * 참고용 파일. 실제 동작 코드는 vndb_tool.html 하단 <script> 인라인.
 * 이 파일은 main.js/server.js에서 로드되지 않으며, package.json build.files에도
 * 포함되지 않는다 (multi_mode.js와 동일한 취급 — 저장소 가독성용).
 *
 * 목적: 검색창에 릴리즈(r) 주소가 단독으로 입력됐을 때의 전용 파이프라인.
 * VN 주소(v) 입력과는 완전히 다른 출력 폼을 사용한다.
 *
 * 데이터 소스 우선순위:
 *   1. /release 단일 호출 (title, alttitle, minage, released, producers, vns.* 전부 중첩 조회)
 *   2. 릴리즈 자체에 없는 값(개발사 미표시, 연령등급 null)만 별도 호출로 보강
 *      - 개발사 없음 → /vn 호출 (developers.name)
 *      - 연령등급 null → 기존 fetchAgeRating(vnId) 재사용 (VN의 ja 릴리즈 집계)
 *   3. 평점/게임태그는 release 쿼리에 vns.rating/vns.votecount/vns.tags.*로 중첩 조회하므로
 *      별도 호출 불필요
 *
 * 관련제품(Relation) 항목은 VNDB Kana API가 노출하지 않는 필드라 제외됨.
 * (공식 문서: "Currently missing from the old API: VN relations, ...")
 *
 * 출력 구조:
 *   빈 문단 (이미지 수동 삽입 공간)
 *   <table>
 *     타이틀 / 원제 / 개발사 / 퍼블리셔 / VNDB(입력된 r주소) / 발매일 / 연령등급 / 평점 / 게임태그
 *   </table>
 *   <hr>
 *   📌 한패출처 :
 *   🔗 링크 :
 */

// ---- 릴리즈 ID 추출 ----

/**
 * v/vn/vndb + 숫자 형태의 r ID 추출. 대소문자 무관.
 * "https://vndb.org/r63343", "r63343", "vndbr63343" 모두 처리
 */
function extractReleaseId(url) {
  const s = url.trim();
  const m = s.match(/vndb\.org\/(r\d+)/i) || s.match(/^(?:vndb|vn)r(\d+)$/i) || s.match(/^r(\d+)$/i);
  if (!m) return null;
  return "r" + m[1].replace(/^r/i, "");
}

// ---- 릴리즈 데이터 조회 (VN 중첩 필드 포함 단일 호출) ----

async function fetchReleaseFull(rId) {
  const r = await fetch(PROXY_RELEASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filters: ["id", "=", rId],
      fields: "title, alttitle, minage, released, languages.lang, " +
               "producers.name, producers.developer, producers.publisher, " +
               "vns.id, vns.title, vns.alttitle, vns.rating, vns.votecount, " +
               "vns.tags.id, vns.tags.name, vns.tags.rating, vns.tags.spoiler, vns.tags.category"
    })
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return data.results?.[0] || null;
}

// ---- 개발사 보강 (릴리즈에 없을 때만) ----

async function fetchVnDeveloper(vnId) {
  const r = await fetch(PROXY_VN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filters: ["id", "=", vnId], fields: "developers.name" })
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return data.results?.[0]?.developers?.map(d => d.name).join(", ") || "";
}

// ---- 게임 개요 조회 (release에 없는 필드라 VN 모드처럼 별도 호출) ----

async function fetchVnDescription(vnId) {
  const r = await fetch(PROXY_VN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filters: ["id", "=", vnId], fields: "description" })
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return data.results?.[0]?.description || "";
}

// ---- 퍼블리셔 포맷 (릴리즈 기준 단순화, VN 모드처럼 다중 언어 집계 안 함) ----

function formatReleasePublisher(release) {
  const pubs = (release.producers || []).filter(p => p.publisher).map(p => p.name);
  if (!pubs.length) return "미상";
  const releaseLangs = new Set((release.languages || []).map(l => l.lang));
  const supported = ["ja", "en", "zh-Hans"].filter(lang => releaseLangs.has(lang));
  if (!supported.length) return "미상";
  return supported.map(lang => `[${LANG_CODE[lang]}] ${pubs.join(" & ")}`).join("\n");
}

// ---- 연령등급 포맷. null이면 fallback 필요 신호로 null 반환 ----

function formatReleaseAge(minage) {
  if (minage === null || minage === undefined) return null;
  if (minage === 0) return "전연령";
  return `${minage}+`;
}

// ---- HTML 생성 ----

function buildReleaseHtml(rId, release, developer, ageRatingStr, tagHtml, descHtml) {
  const vn = release.vns?.[0] || {};
  const releaseTitle = release.title || vn.title || "미상";
  const releaseAltTitle = release.alttitle || vn.alttitle || releaseTitle;
  const publisher = formatReleasePublisher(release);
  const rating = vn.rating || null;
  const votecount = vn.votecount || null;
  const ratingStr = rating ? `${(rating / 10).toFixed(2)} / 10.00` : "정보 없음";
  const voteStr = votecount ? `${votecount.toLocaleString()}표` : "정보 없음";
  const releaseUrl = `https://vndb.org/${rId}`;
  const th = 'style="width:100px;"';
  const tagRow = tagHtml
    ? `<tr><td ${th}><b>게임 태그</b></td><td><details><summary>스포 주의 (클릭하여 펼치기)</summary><div data-type="detailsContent">${tagHtml}</div></details></td></tr>`
    : "";

  return `<p><br></p>
<table>
<tr><td ${th}><b>타이틀</b></td><td>${releaseTitle}</td></tr>
<tr><td ${th}><b>원제</b></td><td>${releaseAltTitle}</td></tr>
<tr><td ${th}><b>개발사</b></td><td>${developer || "미상"}</td></tr>
<tr><td ${th}><b>퍼블리셔</b></td><td>${publisher}</td></tr>
<tr><td ${th}><b>VNDB</b></td><td><a href="${releaseUrl}">${releaseUrl}</a></td></tr>
<tr><td ${th}><b>발매일</b></td><td>${release.released || "정보 없음"}</td></tr>
<tr><td ${th}><b>연령등급</b></td><td>${ageRatingStr}</td></tr>
<tr><td ${th}><b>평점</b></td><td>${ratingStr} (${voteStr})</td></tr>
${tagRow}
</table>
<details open=""><summary><b>게임 개요(VNDB)</b></summary><div data-type="detailsContent">
${descHtml}
</div></details>
<p><br></p>
<br>
<b>📌 한패출처 :</b>
<br>
<br>
<b>🔗 링크 :</b>
<hr>
<p><br></p>
<br>`;
}

// ---- 릴리즈 모드 메인 진입점 ----

async function runRelease(rId, apiKey, log) {
  log("릴리즈 데이터 조회 중...", "run");
  let release;
  try {
    release = await fetchReleaseFull(rId);
  } catch (e) {
    log(`릴리즈 조회 실패: ${e.message}`, "fail");
    return null;
  }
  if (!release) { log("결과 없음 — ID를 확인해주세요.", "fail"); return null; }
  log(`타이틀: ${release.title}`, "ok");

  const vnId = release.vns?.[0]?.id;
  if (!vnId) { log("연결된 VN을 찾을 수 없습니다.", "fail"); return null; }

  // 개발사: 릴리즈 producers에 developer 표시 없으면 VN 별도 조회
  let developer = (release.producers || []).filter(p => p.developer).map(p => p.name).join(", ");
  if (!developer) {
    log("릴리즈에 개발사 정보 없음 → VN 정보 조회 중...", "run");
    try { developer = await fetchVnDeveloper(vnId); }
    catch (e) { log(`개발사 조회 실패: ${e.message}`, "fail"); }
  }

  // 연령등급: 릴리즈 자체 minage 없으면 기존 fetchAgeRating(VN ja 릴리즈 집계) 재사용
  let ageRatingStr = formatReleaseAge(release.minage);
  if (ageRatingStr === null) {
    log("릴리즈에 연령등급 정보 없음 → VN 릴리즈 목록 조회 중...", "run");
    try { ageRatingStr = await fetchAgeRating(vnId); }
    catch (e) { ageRatingStr = "정보 없음"; log(`연령등급 조회 실패: ${e.message}`, "fail"); }
  }

  // 태그 번역 (VN 소속 필드, 이미 release 쿼리에서 중첩 조회됨)
  const vn = release.vns[0];
  const rawTags = (vn.tags || []).sort((a, b) => b.rating - a.rating).slice(0, 5);
  let translatedTags = "";
  if (rawTags.length > 0) {
    const tagNames = rawTags.map(t => t.name).join("\n");
    if (apiKey) {
      log("태그 번역 중...", "run");
      try {
        translatedTags = await translateWithGemini(tagNames, apiKey, "tags");
        log("태그 번역 완료", "ok");
      } catch (e) {
        log(e.message === "CONTENT_BLOCKED" ? "태그 번역 거부 — 원문 사용" : `태그 번역 실패: ${e.message} → 원문 사용`, "fail");
      }
    }
  }

  // 게임 개요: release에 없는 필드라 VN 모드처럼 별도 호출 → 번역 → 완성된 폼으로 병합
  log("게임 개요 조회 중...", "run");
  let rawDesc = "";
  try { rawDesc = await fetchVnDescription(vnId); }
  catch (e) { log(`게임 개요 조회 실패: ${e.message}`, "fail"); }

  let descHtml;
  if (!rawDesc) { descHtml = "<p>(설명 없음)</p>"; }
  else if (!apiKey) { log("API Key 없음 → 원문 삽입", "fail"); descHtml = descToHtml(rawDesc); }
  else {
    const model = document.getElementById("modelSelect").value;
    log(`게임 개요 번역 중... (${model})`, "run");
    try { descHtml = descToHtml(await translateWithGemini(rawDesc, apiKey, "desc")); log("번역 완료", "ok"); }
    catch (e) {
      log(e.message === "CONTENT_BLOCKED" ? "번역 거부 — Gemini 콘텐츠 필터로 인해 거부되었습니다. 원문 삽입" : `번역 실패: ${e.message} → 원문 삽입`, "fail");
      descHtml = descToHtml(rawDesc);
    }
  }

  const html = buildReleaseHtml(rId, release, developer, ageRatingStr, buildTagHtml(rawTags, translatedTags), descHtml);
  log("생성 완료 ✓", "ok");
  return html;
}
