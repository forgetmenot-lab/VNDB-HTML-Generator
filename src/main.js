const { app, BrowserWindow, shell, screen } = require("electron");
const path   = require("path");
const http   = require("http");
const fs     = require("fs");

let serverStarted = false;
const PORT = 17373;

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
  if (serverStarted) return;
  serverStarted = true;

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
    if (!apiKey) return res.status(400).json({ error: "Gemini API key missing" });
    const { text, mode } = req.body;
    if (!text) return res.status(400).json({ error: "text missing" });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const prompt = mode === "alias"
      ? `다음은 비주얼 노벨의 영문 별칭 목록이야. 각 별칭을 한국어 발음으로 변환해줘.\n규칙:\n- 영문 이름을 한국어 독음으로 변환한다 (예: Tokihate → 토키하테)\n- 숫자는 그대로 유지한다 (예: Kara no Shoujo 2 → 카라 노 쇼죠 2)\n- 출력 형식: 영문명(한국어독음) 형태로 쉼표로 구분\n- 다른 설명 없이 결과만 출력\n\n별칭 목록:\n${text}`
      : `다음 텍스트를 한국어로 번역해줘.\n\n규칙:\n- 직역보다 자연스러운 의역을 우선한다\n- 고유명사(인명·지명·작품명)는 원문 그대로 유지한다\n- 소설 뒷표지 소개글처럼 읽기 편하게 문장을 다듬는다\n- 의미상 흐름이 바뀌는 지점에서만 단락을 나누고, 단락 사이에는 반드시 빈 줄을 하나 넣는다\n- 한 단락 안에서는 줄바꿈 없이 이어서 쓴다\n- 번역문만 출력하고 다른 설명은 붙이지 마라\n\n텍스트:\n${text}`;

    try {
      const r = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || "Gemini API error" });
      res.json({ translated: data?.candidates?.[0]?.content?.parts?.[0]?.text || "" });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  expressApp.listen(PORT, () => console.log(`Server running on :${PORT}`));
}

function waitForServer(callback) {
  const req = http.get(`http://localhost:${PORT}/`, () => { callback(); });
  req.on("error", () => { setTimeout(() => waitForServer(callback), 200); });
  req.end();
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

app.whenReady().then(() => {
  startServer();
  waitForServer(() => createWindow());
});

app.on("window-all-closed", () => app.quit());

