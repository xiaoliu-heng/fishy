import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GameStore, assign } from "../server/game.js";
import { createApp } from "../server/index.js";

const input = (name = "阿宁", mode = "mixed", builtins = true) => ({
  name,
  mode,
  builtins,
  avatar: 0,
});
function setup(mode = "mixed", builtins = true, path = null) {
  const store = new GameStore(path),
    host = store.create(input("阿宁", mode, builtins));
  const peer = store.join(host.room.code, input("小满"));
  return {
    store,
    host,
    peer,
    code: host.room.code,
    ready: () =>
      [host, peer].forEach((p) =>
        store.act(host.room.code, p.playerId, "ready", { ready: true }),
      ),
  };
}

test("mixed mode hides own taboo and every other secret, including from host; guesses keep secret alive", () => {
  const { store, host, peer, code, ready } = setup();
  ready();
  store.act(code, host.playerId, "start");
  const a = store.snapshot(code, host.playerId),
    b = store.snapshot(code, peer.playerId);
  assert.ok(a.hand.secret);
  assert.equal(a.hand.taboo.task, null);
  assert.equal(b.hand.taboo.task, null);
  assert.equal(a.reveal.length, 0);
  assert.equal(a.others[0].secret, undefined);
  const actual = store.get(code).assignments;
  assert.deepEqual(
    a.others[0].taboo.trigger,
    actual[peer.playerId].taboo.trigger,
  );
  assert.ok(!JSON.stringify(a).includes(actual[peer.playerId].secret.action));
  assert.throws(
    () => store.act(code, host.playerId, "guess", { playerId: host.playerId }),
    /另一位/,
  );
  assert.throws(() => store.act(code, peer.playerId, "end"), /房主/);
  store.act(code, peer.playerId, "guess", { playerId: host.playerId });
  const guessed = store.snapshot(code, host.playerId);
  assert.ok(guessed.hand.taboo.task);
  assert.deepEqual(guessed.hand.secret, a.hand.secret);
  assert.equal(guessed.status, "playing");
  store.act(code, host.playerId, "end");
  assert.equal(store.snapshot(code, peer.playerId).reveal.length, 2);
  store.act(code, host.playerId, "restart");
  assert.equal(store.snapshot(code, host.playerId).hand, null);
  assert.equal(store.snapshot(code, host.playerId).round, 2);
  assert.equal(store.snapshot(code, host.playerId).players[0].ready, false);
});

test("single modes only allocate selected type; no duplicate cards", () => {
  for (const mode of ["secret", "taboo"]) {
    const { store, host, peer, code, ready } = setup(mode);
    ready();
    store.act(code, host.playerId, "start");
    const room = store.get(code),
      a = room.assignments[host.playerId],
      b = room.assignments[peer.playerId];
    assert.equal(Object.keys(a).length, 1);
    assert.ok(a[mode]);
    assert.notEqual(a[mode].id, b[mode].id);
  }
});

test("a full twelve-player room preserves all twelve avatar identities through the round", () => {
  const store = new GameStore();
  const host = store.create({ ...input("玩家1"), avatar: 0 });
  const clients = [host];
  for (let avatar = 1; avatar < 12; avatar++) {
    clients.push(
      store.join(host.room.code, { ...input(`玩家${avatar + 1}`), avatar }),
    );
  }
  assert.throws(
    () => store.join(host.room.code, { ...input("第十三人"), avatar: 0 }),
    /满/,
  );
  for (const client of clients)
    store.act(host.room.code, client.playerId, "ready", { ready: true });
  store.act(host.room.code, host.playerId, "start");
  for (const client of clients) {
    const snapshot = store.snapshot(host.room.code, client.playerId);
    assert.deepEqual(
      snapshot.players.map((p) => p.avatar),
      Array.from({ length: 12 }, (_, i) => i),
    );
    assert.equal(snapshot.hand.taboo.task, null);
  }
  store.act(host.room.code, host.playerId, "end");
  assert.equal(store.snapshot(host.room.code, host.playerId).reveal.length, 12);
  assert.throws(() => store.create({ ...input(), avatar: 12 }), /头像/);
  assert.throws(() => store.create({ ...input(), avatar: -1 }), /头像/);
});

test("submitted taboos avoid their authors, private submissions stay private, edits enforce ownership", () => {
  const { store, host, peer, code, ready } = setup("taboo", false);
  store.act(code, host.playerId, "task", {
    type: "taboo",
    trigger: "说出西瓜两个字",
  });
  store.act(code, peer.playerId, "task", {
    type: "taboo",
    trigger: "说出香蕉两个字",
  });
  const taskId = store.snapshot(code, host.playerId).myTasks[0].id;
  assert.equal(store.snapshot(code, peer.playerId).myTasks.length, 1);
  assert.ok(
    !JSON.stringify(store.snapshot(code, peer.playerId)).includes("西瓜"),
  );
  assert.throws(
    () =>
      store.act(code, peer.playerId, "task", {
        id: taskId,
        type: "taboo",
        trigger: "坏",
      }),
    /自己的投稿/,
  );
  ready();
  store.act(code, host.playerId, "start");
  const room = store.get(code);
  assert.equal(room.assignments[host.playerId].taboo.authorId, peer.playerId);
  assert.equal(room.assignments[peer.playerId].taboo.authorId, host.playerId);
});

test("impossible matching and insufficient cards do not partially start a game", () => {
  const { store, host, code, ready } = setup("taboo", false);
  store.act(code, host.playerId, "task", {
    type: "taboo",
    trigger: "说出葡萄两个字",
  });
  store.act(code, host.playerId, "task", {
    type: "taboo",
    trigger: "说出芒果两个字",
  });
  ready();
  assert.throws(() => store.act(code, host.playerId, "start"), /避开本人投稿/);
  assert.equal(store.get(code).status, "lobby");
  assert.deepEqual(store.get(code).assignments, {});
  assert.throws(() => assign([{ id: "a" }], [], "secret"), /不足/);
});

test("settings reset readiness, midgame joins rejected, existing player resumes, host leaves transfer ownership", () => {
  const { store, host, peer, code, ready } = setup();
  ready();
  store.act(code, host.playerId, "settings", { mode: "secret" });
  assert.ok(store.get(code).players.every((p) => !p.ready));
  ready();
  store.act(code, host.playerId, "start");
  assert.throws(() => store.join(code, input("新人")), /已经开始/);
  assert.equal(store.join(code, {}, peer.token).playerId, peer.playerId);
  store.act(code, host.playerId, "leave");
  assert.equal(store.get(code).hostId, peer.playerId);
  assert.throws(() => store.authenticate(code, host.token), /身份已失效/);
});

test("local persistence restores identity, assignments, guesses and round", () => {
  const dir = mkdtempSync(join(tmpdir(), "partygame-"));
  try {
    const path = join(dir, "rooms.json");
    const { store, host, peer, code, ready } = setup("mixed", true, path);
    ready();
    store.act(code, host.playerId, "start");
    store.act(code, host.playerId, "guess", { playerId: peer.playerId });
    const restored = new GameStore(path);
    assert.equal(restored.authenticate(code, peer.token), peer.playerId);
    assert.deepEqual(
      restored.snapshot(code, peer.playerId),
      store.snapshot(code, peer.playerId),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("validation rejects unknown modes, duplicate names/cards and overlong input", () => {
  const { store, host, code } = setup();
  assert.throws(() => store.create(input("张三", "unknown")), /玩法/);
  assert.throws(() => store.join(code, input("阿宁")), /昵称/);
  assert.throws(() => store.join(code, input("好".repeat(13))), /12/);
  assert.throws(
    () =>
      store.act(code, host.playerId, "task", {
        type: "taboo",
        trigger: "说出「我」",
      }),
    /已经在/,
  );
});

test("HTTP cookies, unauthorized reads, per-player SSE snapshots and cross-origin protection", async () => {
  const { app, closeStreams } = createApp({ store: new GameStore() });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const controller = new AbortController();
  try {
    const created = await fetch(`${base}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input()),
    });
    assert.equal(created.status, 201);
    const cookie = created.headers.get("set-cookie").split(";")[0];
    assert.match(created.headers.get("set-cookie"), /HttpOnly/);
    const host = await created.json();
    assert.equal((await fetch(`${base}/api/rooms/${host.code}`)).status, 401);
    const stream = await fetch(`${base}/api/rooms/${host.code}/events`, {
      headers: { cookie },
      signal: controller.signal,
    });
    const reader = stream.body.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    assert.match(first, /data:/);
    assert.ok(!first.includes("tokenHash"));
    assert.ok(!first.includes("authorId"));
    const joinResponse = await fetch(`${base}/api/rooms/${host.code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input("小满")),
    });
    assert.equal(joinResponse.status, 200);
    const updated = new TextDecoder().decode((await reader.read()).value);
    assert.match(updated, /小满/);
    const csrf = await fetch(`${base}/api/rooms/${host.code}/ready`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
        origin: "https://evil.example",
      },
      body: '{"ready":true}',
    });
    assert.equal(csrf.status, 403);
  } finally {
    controller.abort();
    closeStreams();
    await new Promise((resolve) => server.close(resolve));
  }
});
