const express = require("express");
const cors    = require("cors");
const path    = require("path");
const fetch   = (...a) => import("node-fetch").then(({ default: f }) => f(...a));

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "vndb_tool.html"));
});

app.post("/vn", async (req, res) => {
  try {
    const r = await fetch("https://api.vndb.org/kana/vn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });
    res.json(await r.json());
  } catch (e) {
    console.error("[vn]", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post("/release", async (req, res) => {
  try {
    const r = await fetch("https://api.vndb.org/kana/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });
    res.json(await r.json());
  } catch (e) {
    console.error("[release]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// Gemini 번역 (모델 선택 + 2회 재시도)
app.post("/translate", async (req, res) => {
  const apiKey = req.headers["x-goog-api-key"];
  if (!apiKey) return res.status(400).json({ error: "Gemini API key missing" });

  const { text, mode, model } = req.body;
  if (!text) return res.status(400).json({ error: "text missing" });

  const selectedModel = model || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

  const prompt = mode === "alias"
    ? `다음은 비주얼 노벨의 영문 별칭 목록이야. 각 별칭을 한국어 발음으로 변환해줘.\n규칙:\n- 영문 이름을 한국어 독음으로 변환한다 (예: Tokihate → 토키하테, Kara no Shoujo → 카라 노 쇼죠)\n- 숫자는 그대로 유지한다 (예: Kara no Shoujo 2 → 카라 노 쇼죠 2)\n- 출력 형식: 영문명(한국어독음) 형태로 쉼표로 구분\n- 별칭이 하나면 그것만 출력\n- 다른 설명 없이 결과만 출력\n\n별칭 목록:\n${text}`
    : `다음 텍스트를 한국어로 번역해줘.\n\n규칙:\n- 직역보다 자연스러운 의역을 우선한다\n- 고유명사(인명·지명·작품명)는 원문 그대로 유지한다\n- 소설 뒷표지 소개글처럼 읽기 편하게 문장을 다듬는다\n- 의미상 흐름이 바뀌는 지점에서만 단락을 나누고, 단락 사이에는 반드시 빈 줄을 하나 넣는다 (빈 줄 = 줄바꿈 2번 연속)\n- 한 단락 안에서는 줄바꿈 없이 이어서 쓴다\n- 번역문만 출력하고 다른 설명은 붙이지 마라\n\n텍스트:\n${text}`;

  const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });

  // 최대 2회 재시도
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body
      });
      const data = await r.json();
      console.log(`[translate] attempt ${attempt} status:`, r.status);

      if (!r.ok) {
        const errMsg = data?.error?.message || "Gemini API error";
        // 콘텐츠 필터 거부 (SAFETY)
        if (data?.candidates?.[0]?.finishReason === "SAFETY" || errMsg.includes("SAFETY")) {
          return res.status(200).json({ error: "CONTENT_BLOCKED", translated: "" });
        }
        if (attempt === 2) return res.status(r.status).json({ error: errMsg });
        continue; // 재시도
      }

      const finishReason = data?.candidates?.[0]?.finishReason;
      if (finishReason === "SAFETY") {
        return res.status(200).json({ error: "CONTENT_BLOCKED", translated: "" });
      }

      const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (!translated && attempt < 2) continue; // 빈 결과면 재시도
      return res.json({ translated });

    } catch (e) {
      console.error(`[translate] attempt ${attempt} exception:`, e.message);
      if (attempt === 2) return res.status(500).json({ error: e.message });
    }
  }
});

app.listen(17373, () => console.log("VNDB proxy v1.1 running on :17373"));
