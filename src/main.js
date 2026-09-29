const { app, BrowserWindow, shell, screen, dialog } = require("electron");
const path   = require("path");
const fs     = require("fs");

let serverStarted = false;
const PORT = 17373;
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
const ALLOWED_GEMINI_MODELS = new Set([
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.1-pro-preview"
]);

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildTranslationPrompt(text, mode) {
  if (mode === "alias") {
    return `다음은 비주얼 노벨의 영문 별칭 목록이야. 각 별칭을 한국어 발음으로 변환해줘.\n규칙:\n- 영문 이름을 한국어 독음으로 변환한다 (예: Tokihate → 토키하테)\n- 숫자는 그대로 유지한다 (예: Kara no Shoujo 2 → 카라 노 쇼죠 2)\n- 출력 형식: 영문명(한국어독음) 형태로 쉼표로 구분\n- 다른 설명 없이 결과만 출력\n\n별칭 목록:\n${text}`;
  }

  if (mode === "tags") {
    return `다음 입력은 성인용 비주얼 노벨을 포함할 수 있는 기존 VNDB 분류 태그 목록이야. 한 줄에 하나씩 입력된 각 태그를 한국어 분류 용어로 정확하게 번역해줘.\n규칙:\n- 새로운 내용을 만들지 않고 원문에 있는 태그만 번역한다\n- 성인용 또는 민감한 표현도 임의로 삭제하거나 순화하지 않고 의미를 보존한다\n- 고유명사는 원문 그대로 유지한다\n- 입력 순서와 줄 수를 반드시 유지한다\n- 각 줄에는 해당 태그의 한국어 번역만 출력한다\n- 번호, 글머리 기호, 원문 반복, 추가 설명을 붙이지 마라\n\n태그 목록:\n${text}`;
  }

  return `다음 입력은 성인용 비주얼 노벨을 포함할 수 있는 기존 VNDB 작품 설명이야. 새로운 내용을 생성하지 말고 원문의 의미를 보존해 한국어로 번역해줘.\n\n규칙:\n- 직역보다 자연스러운 의역을 우선한다\n- 원문에 있는 성인용 또는 민감한 표현을 임의로 삭제하거나 순화하지 않는다\n- 고유명사(인명·지명·작품명)는 원문 그대로 유지한다\n- 소설 뒷표지 소개글처럼 읽기 편하게 문장을 다듬는다\n- 의미상 흐름이 바뀌는 지점에서만 단락을 나누고, 단락 사이에는 반드시 빈 줄을 하나 넣는다\n- 한 단락 안에서는 줄바꿈 없이 이어서 쓴다\n- 번역문만 출력하고 다른 설명은 붙이지 마라\n\n텍스트:\n${text}`;
}

function getGeminiBlockReason(data) {
  const finishReason = data?.candidates?.[0]?.finishReason;
  const promptReason = data?.promptFeedback?.blockReason;
  const blockedReasons = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST"]);
  if (blockedReasons.has(promptReason)) return promptReason;
  if (blockedReasons.has(finishReason)) return finishReason;
  return null;
}

// 창 상태 저장 경로 (userData 폴더 — 포터블 exe에서도 안전하게 유지됨)
function getWinStatePath() {
  return path.join(app.getPath("userData"), "window-state.json");
}

function loadWinState() {
  try {
    const raw = fs.readFileSync(getWinStatePath(), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveWinState(win) {
  if (win.isMaximized() || win.isMinimized()) return;
  const bounds = win.getBounds();
  try {
    fs.writeFileSync(getWinStatePath(), JSON.stringify(bounds), "utf-8");
  } catch {}
}

// 저장된 위치가 현재 연결된 모니터 범위 안에 있는지 검증
function isWithinDisplay(bounds) {
  const displays = screen.getAllDisplays();
  return displays.some(d => {
    const b = d.workArea;
    return (
      bounds.x < b.x + b.width  &&
      bounds.x + bounds.width  > b.x &&
      bounds.y < b.y + b.height &&
      bounds.y + bounds.height > b.y
    );
  });
}

function startServer() {
  if (serverStarted) return Promise.resolve();

  const express  = require("express");
  const cors     = require("cors");
  const fetch    = (...a) => import("node-fetch").then(({ default: f }) => f(...a));

  const expressApp = express();
  expressApp.use(cors());
  expressApp.use(express.json());

  expressApp.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "vndb_tool.html"));
  });

  expressApp.post("/vn", async (req, res) => {
    try {
      const r = await fetch("https://api.vndb.org/kana/vn", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req.body)
      });
      res.json(await r.json());
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  expressApp.post("/release", async (req, res) => {
    try {
      const r = await fetch("https://api.vndb.org/kana/release", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req.body)
      });
      res.json(await r.json());
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  expressApp.post("/translate", async (req, res) => {
    const apiKey = req.headers["x-goog-api-key"];
    if (!apiKey) return res.status(400).json({ error: "API_KEY_MISSING", message: "Gemini API key missing" });
    const { text, mode, model } = req.body;
    if (!text) return res.status(400).json({ error: "TEXT_MISSING", message: "text missing" });

    const selectedModel = ALLOWED_GEMINI_MODELS.has(model) ? model : DEFAULT_GEMINI_MODEL;
    const prompt = buildTranslationPrompt(text, mode);
    const modelsToTry = selectedModel === DEFAULT_GEMINI_MODEL
      ? [selectedModel]
      : [selectedModel, DEFAULT_GEMINI_MODEL];

    let lastFailure = { status: 500, error: "GEMINI_API_ERROR", message: "Gemini API error" };

    for (const candidateModel of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${candidateModel}:generateContent?key=${apiKey}`;
      const requestBody = { contents: [{ parts: [{ text: prompt }] }] };
      if (candidateModel === "gemini-3.8-flash") {
        requestBody.generationConfig = { thinkingConfig: { thinkingLevel: "low" } };
      }

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const r = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody)
          });
          const data = await r.json();
          const blockReason = getGeminiBlockReason(data);

          if (blockReason) {
            return res.json({ error: "CONTENT_BLOCKED", reason: blockReason, translated: "" });
          }

          if (r.ok) {
            const translated = data?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim() || "";
            if (translated) {
              return res.json({
                translated,
                model: candidateModel,
                fallback: candidateModel !== selectedModel
              });
            }
            lastFailure = { status: 502, error: "EMPTY_RESPONSE", message: "Gemini returned an empty response" };
          } else {
            const apiMessage = data?.error?.message || "Gemini API error";
            const apiStatus = data?.error?.status;
            let error = "GEMINI_API_ERROR";
            if (r.status === 401 || r.status === 403) error = "API_KEY_INVALID";
            else if (r.status === 404) error = "MODEL_UNAVAILABLE";
            else if (r.status === 429 || apiStatus === "RESOURCE_EXHAUSTED") error = "QUOTA_EXCEEDED";
            else if ([500, 502, 503, 504].includes(r.status)) error = "SERVICE_UNAVAILABLE";
            lastFailure = { status: r.status, error, message: apiMessage };

            if (["API_KEY_INVALID"].includes(error)) {
              return res.status(r.status).json(lastFailure);
            }

            if (!["QUOTA_EXCEEDED", "SERVICE_UNAVAILABLE", "MODEL_UNAVAILABLE"].includes(error)) {
              return res.status(r.status).json(lastFailure);
            }
          }
        } catch (e) {
          lastFailure = { status: 503, error: "SERVICE_UNAVAILABLE", message: e.message };
        }

        if (attempt < 2 && lastFailure.error !== "MODEL_UNAVAILABLE") await wait(1200);
        else break;
      }
    }

    return res.status(lastFailure.status).json(lastFailure);
  });

  expressApp.get("/imgproxy", async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "url missing" });
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buffer = await r.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      const mime = r.headers.get("content-type") || "image/jpeg";
      res.json({ dataUrl: `data:${mime};base64,${base64}` });
    } catch (e) {
      console.error("[imgproxy]", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // 폴더 선택 다이얼로그
  expressApp.get("/selectfolder", async (req, res) => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (result.canceled || !result.filePaths.length) return res.json({ canceled: true });
    res.json({ folderPath: result.filePaths[0] });
  });

  // 이미지 URL → 로컬 파일 저장
  expressApp.post("/saveimg", async (req, res) => {
    const { url, folderPath, filename } = req.body;
    if (!url || !folderPath || !filename) return res.status(400).json({ error: "params missing" });
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buffer = Buffer.from(await r.arrayBuffer());
      const filePath = require("path").join(folderPath, filename);
      require("fs").writeFileSync(filePath, buffer);
      res.json({ ok: true, filePath });
    } catch (e) {
      console.error("[saveimg]", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // 폴더 열기
  expressApp.get("/openfolder", (req, res) => {
    const fp = req.query.path;
    if (!fp) return res.status(400).json({ error: "path missing" });
    shell.openPath(fp);
    res.json({ ok: true });
  });

  return new Promise((resolve, reject) => {
    const server = expressApp.listen(PORT, "127.0.0.1", () => {
      serverStarted = true;
      console.log(`Server running on 127.0.0.1:${PORT}`);
      resolve();
    });
    server.once("error", reject);
  });
}

function createWindow() {
  const saved    = loadWinState();
  const defaults = { width: 1060, height: 780 };

  // 저장된 상태가 있고 현재 모니터 범위 안이면 복원, 아니면 기본값
  const winOptions = (saved && isWithinDisplay(saved))
    ? { x: saved.x, y: saved.y, width: saved.width, height: saved.height }
    : defaults;

  const win = new BrowserWindow({
    ...winOptions,
    title: "VNDB → HTML Generator",
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  win.loadURL(`http://localhost:${PORT}/`);
  win.setMenuBarVisibility(false);

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // 창 닫히기 직전에 저장
  win.on("close", () => saveWinState(win));
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.show();
    win.focus();
  });

  app.whenReady().then(async () => {
    try {
      await startServer();
      createWindow();
    } catch (e) {
      const message = e?.code === "EADDRINUSE"
        ? `로컬 포트 ${PORT}이 이미 사용 중입니다. 실행 중인 VNDB HTML Generator를 확인하거나 해당 포트를 사용하는 프로그램을 종료해주세요.`
        : `로컬 서버를 시작하지 못했습니다.\n\n${e?.message || e}`;
      dialog.showErrorBox("VNDB HTML Generator 실행 오류", message);
      app.quit();
    }
  });

  app.on("window-all-closed", () => app.quit());
}
