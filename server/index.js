import express from "express";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { GameStore, GameError } from "./game.js";

const root = resolve(import.meta.dirname, "..");
export function createApp({
  store = new GameStore(resolve(root, ".data/rooms.json")),
} = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "12kb" }));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    if (req.path.startsWith("/api/"))
      res.setHeader("Cache-Control", "no-store");
    if (
      req.method !== "GET" &&
      req.headers.origin &&
      new URL(req.headers.origin).host !== req.headers.host
    )
      return res.status(403).json({ error: "请从当前游戏页面操作。" });
    next();
  });
  const subscriptions = new Map(),
    limits = new Map();
  app.use("/api", (req, res, next) => {
    if (req.method === "GET") return next();
    const key = `${req.ip}:${req.path === "/rooms" ? "create" : "act"}`,
      now = Date.now();
    if (limits.size > 2000)
      for (const [k, v] of limits) if (now > v.until) limits.delete(k);
    let item = limits.get(key);
    if (!item || now > item.until) {
      item = { count: 0, until: now + 60000 };
      limits.set(key, item);
    }
    if (++item.count > (key.endsWith("create") ? 30 : 240))
      return res.status(429).json({ error: "操作太快啦，请稍等一分钟再试。" });
    next();
  });
  const cookieName = (code) => `party_${code}`;
  const tokenFor = (req, code) =>
    (req.headers.cookie || "")
      .split(";")
      .map((v) => v.trim().split("="))
      .find(([key]) => key === cookieName(code))?.[1];
  const setCookie = (res, code, token) =>
    res.cookie(cookieName(code), token, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 86400000,
      path: `/api/rooms/${code}`,
    });
  const online = (code) =>
    new Set([...(subscriptions.get(code) || [])].map((s) => s.playerId));
  const snapshot = (code, id) => store.snapshot(code, id, online(code));
  function publish(code) {
    for (const sub of subscriptions.get(code) || []) {
      try {
        sub.res.write(
          `data: ${JSON.stringify(snapshot(code, sub.playerId))}\n\n`,
        );
      } catch {
        sub.res.write("event: removed\ndata: {}\n\n");
        sub.res.end();
      }
    }
  }
  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.get("/api/network", (req, res) => {
    const port = req.socket.localPort;
    const addresses = Object.entries(networkInterfaces())
      .filter(
        ([name]) => !/^(utun|tun|docker|bridge|veth|tailscale)/.test(name),
      )
      .flatMap(([, records]) => records || [])
      .filter(
        (n) =>
          n.family === "IPv4" &&
          !n.internal &&
          /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address),
      )
      .map((n) => `http://${n.address}:${port}`);
    res.json({ urls: [...new Set(addresses)] });
  });
  app.post("/api/rooms", (req, res) => {
    const result = store.create(req.body);
    setCookie(res, result.room.code, result.token);
    res.status(201).json(snapshot(result.room.code, result.playerId));
  });
  app.post("/api/rooms/:code/join", (req, res) => {
    const { code } = req.params;
    const result = store.join(code, req.body, tokenFor(req, code));
    setCookie(res, code, result.token);
    publish(code);
    res.json(snapshot(code, result.playerId));
  });
  app.use("/api/rooms/:code", (req, res, next) => {
    req.playerId = store.authenticate(
      req.params.code,
      tokenFor(req, req.params.code),
    );
    next();
  });
  app.get("/api/rooms/:code", (req, res) =>
    res.json(snapshot(req.params.code, req.playerId)),
  );
  app.get("/api/rooms/:code/events", (req, res) => {
    const { code } = req.params;
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    const group = subscriptions.get(code) || new Set();
    subscriptions.set(code, group);
    const sub = { playerId: req.playerId, res };
    group.add(sub);
    publish(code);
    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15000);
    res.on("close", () => {
      clearInterval(heartbeat);
      group.delete(sub);
      if (!group.size) subscriptions.delete(code);
      else publish(code);
    });
  });
  app.post("/api/rooms/:code/:action", (req, res) => {
    const { code, action } = req.params;
    store.act(code, req.playerId, action, req.body);
    publish(code);
    if (action === "leave") {
      res.clearCookie(cookieName(code), { path: `/api/rooms/${code}` });
      return res.json({ ok: true });
    }
    res.json(snapshot(code, req.playerId));
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "找不到这个操作" }),
  );
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status =
      err instanceof GameError
        ? err.status
        : err.type === "entity.too.large"
          ? 413
          : err instanceof SyntaxError
            ? 400
            : 500;
    if (status === 500) console.error(err);
    res
      .status(status)
      .json({
        error:
          status === 500
            ? "保存失败，请稍后重试。"
            : status === 413
              ? "内容太长，请缩短后再试。"
              : err.message,
      });
  });
  return {
    app,
    store,
    closeStreams: () => {
      for (const group of subscriptions.values())
        for (const s of group) s.res.end();
    },
  };
}
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const { app } = createApp();
  if (process.argv.includes("--dev")) {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      express.static(resolve(root, "dist"), { index: false, maxAge: "1h" }),
    );
    app.get("/{*path}", (req, res) =>
      res.sendFile(resolve(root, "dist/index.html")),
    );
  }
  const port = Number(process.env.PORT || 4173);
  app.listen(port, "0.0.0.0", () =>
    console.log(
      `PartyGame: http://localhost:${port} (同一 Wi-Fi 下通过局域网地址加入)`,
    ),
  );
}
