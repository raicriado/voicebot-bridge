import express from "express";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";

function mustGetEnv(name) {
  const v = process.env[name];
  if (!v || typeof v !== "string" || v.trim().length < 10) {
    throw new Error(`Missing/invalid env var: ${name}`);
  }
  return v.trim();
}

const OPENAI_API_KEY = mustGetEnv("OPENAI_API_KEY");

const DEMO_TOKEN = (process.env.DEMO_TOKEN || "").trim();

const app = express();
app.use(express.json({ limit: "2mb" }));

app.use(express.static("public"));

// Telnyx webhook (listo para cuando tengas número)
app.post("/telnyx/voice", (req, res) => {
  res.sendStatus(200);
});

// Test de conexión a OpenAI Realtime
app.get("/health/realtime", async (req, res) => {
  try {
    const ws = new WebSocket(
  "wss://api.openai.com/v1/realtime?model=gpt-realtime-1.5",
  { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
);

    const t = setTimeout(() => {
      try { ws.close(); } catch {}
      res.status(504).json({ ok: false, error: "timeout_connecting_realtime" });
    }, 6000);

    ws.on("open", () => {
      clearTimeout(t);
      ws.close();
      res.json({ ok: true });
    });

    ws.on("error", (err) => {
      clearTimeout(t);
      res.status(502).json({ ok: false, error: err?.message || "ws_error" });
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "server_error" });
  }
});

// endpoint para “mint” de ephemeral key
app.get("/auth/ephemeral", async (req, res) => {
  try {
    if (DEMO_TOKEN) {
  const t = req.query.t;
  if (typeof t !== "string" || t !== DEMO_TOKEN) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
}
    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-realtime-1.5",
        voice: "marin",
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({ ok: false, data });
    }

    return res.json({ ok: true, client_secret: data.client_secret });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || "server_error" });
  }
});

// WebSocket para Telnyx Media (placeholder)
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/telnyx/media" });

wss.on("connection", (socket) => {
  socket.send(JSON.stringify({ ok: true, msg: "telnyx media ws up" }));
  socket.on("error", () => {});
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Listening on ${PORT}`));
