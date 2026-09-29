// 참고용: 실제 실행 코드는 vndb_tool.html에 인라인되어 있습니다.
/**
 * MULTI_MODE.JS
 * =============
 * VNDB URL 2개 이상 입력 시 다중 처리 모드.
 * 기존 단일 처리 run()과 완전히 분리된 독립 로직.
 *
 * v1.3: 다중 입력에 r(릴리즈) 토큰이 섞여도 테이블 포맷은 기존 VN 집계 포맷을
 * 그대로 유지한다. 단 VNDB 주소 행만 입력된 r 주소 그대로 표기한다
 * (release_mode.js의 릴리즈 전용 필드/파이프라인은 다중모드에 적용하지 않음).
 *
 * 출력 형태:
 *   [게임1 테이블]
 *   <br><hr><br>
 *   ...
 *   [게임n 테이블]
 *   🔗 링크 :
 *
 * 테이블 항목: 제목(병합), 이미지(병합), 원제, 개발사, VNDB, 플레이타임, 평점, 게임태그, 한패출처, 특이사항
 * 퍼블리셔/연령등급/별칭 제외 (다중 모드 전용 스펙)
 */

// ---- URL 파싱 ----

/**
 * 입력 문자열에서 토큰 배열 추출 (v/r 원문 그대로, 정규화는 resolveMultiTokens에서 처리)
 */
function parseMultiUrls(input) {
  return input
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * 각 토큰을 { vnId, displayUrl } 형태로 정규화.
 * r 토큰은 VN ID로 해석하되 표시 주소는 입력된 r 주소를 그대로 유지한다.
 */
async function resolveMultiTokens(tokens, log) {
  const out = [];
  for (const token of tokens) {
    const rId = extractReleaseId(token);
    if (rId) {
      try {
        const vnId = await resolveToVnId(token);
        if (vnId) out.push({ vnId, displayUrl: `https://vndb.org/${rId}` });
        else log(`인식할 수 없는 입력: ${token}`, "fail");
      } catch (e) {
        log(`${token} → ${e.message}`, "fail");
      }
      continue;
    }
    const vId = extractId(token);
    if (vId) {
      out.push({ vnId: vId, displayUrl: `https://vndb.org/${vId}` });
    } else {
      log(`인식할 수 없는 입력: ${token}`, "fail");
    }
  }
  return out;
}

// ---- 단일 게임 데이터 조회 ----

async function fetchVndbMulti(vnId) {
  const r = await fetch(PROXY_VN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filters: ["id", "=", vnId],
      fields: "title, alttitle, description, developers.name, rating, votecount, length, length_minutes, tags.id, tags.name, tags.rating, tags.spoiler"
    })
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return data.results?.[0] || null;
}

// ---- 태그 번역 ----

async function translateTagsMulti(tagNames, apiKey, vnId) {
  if (!apiKey || !tagNames) return tagNames;
  try {
    return await translateWithGemini(tagNames, apiKey, "tags");
  } catch (e) {
    log(`${vnId} — 태그 번역 실패: ${e.message} → 원문 사용`, "fail");
    return tagNames;
  }
}

// ---- 단일 게임 테이블 HTML 생성 ----

function buildMultiGameTable(vnId, vnData, tagHtml, displayUrl) {
  const originalTitle = vnData.alttitle || vnData.title || "미상";
  const developer = vnData.developers?.map(d => d.name).join(", ") || "미상";
  const vnUrl = displayUrl || `https://vndb.org/${vnId}`;
  const playStr = formatPlayTime(vnData.length || null, vnData.length_minutes || null);
  const rating = vnData.rating || null;
  const votecount = vnData.votecount || null;
  const ratingStr = rating ? `${(rating / 10).toFixed(2)} / 10.00` : "정보 없음";
  const voteStr = votecount ? `${votecount.toLocaleString()}표` : "정보 없음";
  const tw = 'style="width:100px;"';
  const tagRow = tagHtml
    ? `<tr><td ${tw}><b>게임 태그</b></td><td><details><summary>스포 주의 (클릭하여 펼치기)</summary><div data-type="detailsContent">${tagHtml}</div></details></td></tr>`
    : "";
  return `<table>
<tr><td colspan="2"><b>제목</b></td></tr>
<tr><td colspan="2"><b>이미지</b></td></tr>
<tr><td ${tw}><b>원제</b></td><td>${originalTitle}</td></tr>
<tr><td ${tw}><b>개발사</b></td><td>${developer}</td></tr>
<tr><td ${tw}><b>VNDB</b></td><td><a href="${vnUrl}">${vnUrl}</a></td></tr>
<tr><td ${tw}><b>플레이 타임</b></td><td>${playStr}</td></tr>
<tr><td ${tw}><b>평점</b></td><td>${ratingStr} (${voteStr})</td></tr>
${tagRow}
<tr><td ${tw}><b>📌 한패출처</b></td><td></td></tr>
<tr><td ${tw}><b>특이사항</b></td><td></td></tr>
</table>`;
}

// ---- 다중 모드 메인 진입점 ----

async function runMulti(resolvedTokens, apiKey) {
  const tables = [];

  for (let i = 0; i < resolvedTokens.length; i++) {
    const { vnId, displayUrl } = resolvedTokens[i];
    log(`[${i + 1}/${resolvedTokens.length}] ${vnId} 처리 중...`, "run");

    // VN 데이터 조회
    let vnData;
    try {
      vnData = await fetchVndbMulti(vnId);
      if (!vnData) { log(`${vnId} — 결과 없음, 건너뜀`, "fail"); continue; }
      log(`${vnId} — ${vnData.alttitle || vnData.title}`, "ok");
    } catch (e) {
      log(`${vnId} — 조회 실패: ${e.message}`, "fail");
      continue;
    }

    // 태그 처리 (상위 5개, rating 내림차순)
    const rawTags = (vnData.tags || []).sort((a, b) => b.rating - a.rating).slice(0, 5);
    let translatedTags = "";
    if (rawTags.length > 0) {
      const tagNames = rawTags.map(t => t.name).join("\n");
      if (apiKey) {
        log(`${vnId} — 태그 번역 중...`, "run");
        translatedTags = await translateTagsMulti(tagNames, apiKey, vnId);
        log(`${vnId} — 태그 완료`, "ok");
      }
    }

    tables.push(buildMultiGameTable(vnId, vnData, buildTagHtml(rawTags, translatedTags), displayUrl));
  }

  if (!tables.length) {
    log("처리된 게임이 없습니다.", "fail");
    return null;
  }

  // 게임 사이: <hr>, 마지막 뒤: 🔗 링크 : + 사용자 작성 영역
  const html = tables.join("\n<hr>\n") + "\n\n<b>🔗 링크 :</b>\n<hr>\n<p><br></p>\n<br>";
  log(`다중 생성 완료 ✓ (${tables.length}개)`, "ok");
  return html;
}
