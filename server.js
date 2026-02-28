import express from "express";
import http from "http";
import WebSocket from "ws";
-
function mustGetEnv(name) {
  const v = process.env[name];
  if (!v || typeof v !== "string" || v.trim().length < 10) {
    throw new Error(`Missing/invalid env var: ${name}`);
  }
  return v;
}

const OPENAI_API_KEY = mustGetEnv("OPENAI_API_KEY");

const app = express();
app.use(express.json({ limit: "2mb" }));

// 1) Webhook Telnyx (aunque aún no tengas número, lo dejamos listo)
app.post("/telnyx/voice", (req, res) => {
  // Responder rápido para que Telnyx no corte
  res.sendStatus(200);
});

// 2) Endpoint de test: abre una sesión Realtime y devuelve OK si conecta
app.get("/health/realtime", async (req, res) => {
  try {
    const ws = new WebSocket(
      "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`
        }
      }
    );

    const timeout = setTimeout(() => {
      try { ws.close(); } catch {}
      res.status(504).json({ ok: false, error: "timeout_connecting_realtime" });
    }, 6000);

    ws.on("open", () => {
      clearTimeout(timeout);
      ws.close();
      res.json({ ok: true });
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      res.status(502).json({ ok: false, error: err?.message || "ws_error" });
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "server_error" });
  }
});

// 3) WebSocket Telnyx media (placeholder para cuando activemos streaming)
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: "/telnyx/media" });

wss.on("connection", (socket) => {
  // Por ahora solo confirmamos conexión.
  socket.send(JSON.stringify({ ok: true, msg: "telnyx media ws up" }));
  socket.on("error", () => {});
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Listening on ${PORT}`));