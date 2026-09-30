import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GameStore, assign, remixSecrets } from "../server/game.js";
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

const secret = (id, trigger, action) => ({
  id,
  type: "secret",
  trigger,
  action,
});
const pair = (task) => JSON.stringify([task.trigger, task.action]);
const drawRemixed = (pool, count) =>
  Object.values(
    remixSecrets(
      Array.from({ length: count }, (_, i) => ({ id: `player-${i}` })),
      pool,
    ),
  );

test("remixing uses different original pairs and does not reuse fragments or mutate the pool", () => {
  const pool = [
    secret("a", "有人举起杯子", "拍三下手"),
    secret("b", "有人站起来", "眨两下眼"),
  ];
  const original = structuredClone(pool);
  for (let round = 0; round < 20; round++) {
    const cards = drawRemixed(pool, 2);
    assert.deepEqual(
      new Set(cards.map(pair)),
      new Set([
        pair(secret("", pool[0].trigger, pool[1].action)),
        pair(secret("", pool[1].trigger, pool[0].action)),
      ]),
    );
    assert.equal(new Set(cards.map((card) => card.id)).size, 2);
  }
  assert.deepEqual(pool, original);
});

test("duplicate wording cannot bypass original-pair avoidance or produce duplicate new cards", () => {
  const pool = [
    secret("a", "甲", "一"),
    secret("b", "甲！", "二"),
    secret("c", "乙", "一"),
    secret("d", "乙", "三"),
    secret("e", "丙", "二"),
    secret("f", "丙", "三"),
  ];
  const normalize = (task) =>
    JSON.stringify([task.trigger.replace("！", ""), task.action]);
  const cards = drawRemixed(pool, 3);
  assert.deepEqual(
    new Set(cards.map(normalize)),
    new Set(['["甲","三"]', '["乙","二"]', '["丙","一"]']),
  );
  assert.throws(() => drawRemixed(pool, 4), /不足以重组/);
  assert.throws(
    () =>
      drawRemixed(
        [secret("x", "条件甲", "同一后果"), secret("y", "条件乙", "同一后果")],
        2,
      ),
    /不足以重组/,
  );
});

test("remix setting is opt-in, host-only, resets readiness and cannot change during a round", () => {
  const { store, host, peer, code, ready } = setup();
  assert.equal(store.snapshot(code, peer.playerId).remixSecrets, false);
  assert.throws(
    () => store.create({ ...input("无效"), remixSecrets: "true" }),
    /随机重组/,
  );
  assert.throws(
    () => store.act(code, peer.playerId, "settings", { remixSecrets: true }),
    /房主/,
  );
  assert.throws(
    () => store.act(code, host.playerId, "settings", { remixSecrets: 1 }),
    /重组设置/,
  );
  ready();
  store.act(code, host.playerId, "settings", { remixSecrets: true });
  assert.ok(store.get(code).players.every((player) => !player.ready));
  assert.equal(store.snapshot(code, peer.playerId).remixSecrets, true);
  ready();
  store.act(code, host.playerId, "start");
  assert.throws(
    () => store.act(code, host.playerId, "settings", { remixSecrets: false }),
    /已经开始/,
  );
  const originals = new Set(
    store
      .pool(store.get(code))
      .filter((task) => task.type === "secret")
      .map(pair),
  );
  for (const player of [host, peer]) {
    const snapshot = store.snapshot(code, player.playerId);
    assert.ok(!originals.has(pair(snapshot.hand.secret)));
    assert.equal(snapshot.hand.taboo.task, null);
    assert.ok(snapshot.others.every((other) => other.secret === undefined));
    assert.deepEqual(Object.keys(snapshot.hand.secret).sort(), [
      "action",
      "trigger",
      "type",
    ]);
  }
});

test("an impossible remix leaves the room untouched and disabling it restores original dealing", () => {
  const { store, host, peer, code, ready } = setup("secret", false);
  for (const [client, trigger] of [
    [host, "有人点头两次"],
    [peer, "有人摇头两次"],
  ])
    store.act(code, client.playerId, "task", {
      type: "secret",
      trigger,
      action: "说出同一条台词",
    });
  store.act(code, host.playerId, "settings", { remixSecrets: true });
  ready();
  const before = structuredClone(store.get(code));
  assert.match(store.snapshot(code, host.playerId).startIssue, /不足以重组/);
  assert.throws(() => store.act(code, host.playerId, "start"), /不足以重组/);
  assert.deepEqual(store.get(code), before);
  store.act(code, host.playerId, "settings", { remixSecrets: false });
  ready();
  store.act(code, host.playerId, "start");
  const originals = new Set(before.tasks.map(pair));
  assert.ok(
    Object.values(store.get(code).assignments).every((hand) =>
      originals.has(pair(hand.secret)),
    ),
  );
});

test("remix does not change taboo-only games or author avoidance", () => {
  const { store, host, peer, code, ready } = setup("taboo", false);
  for (const [client, trigger] of [
    [host, "同时握住两支笔"],
    [peer, "同时举起两只手"],
  ])
    store.act(code, client.playerId, "task", { type: "taboo", trigger });
  store.act(code, host.playerId, "settings", { remixSecrets: true });
  ready();
  store.act(code, host.playerId, "start");
  for (const client of [host, peer]) {
    const hand = store.get(code).assignments[client.playerId];
    assert.deepEqual(Object.keys(hand), ["taboo"]);
    assert.notEqual(hand.taboo.authorId, client.playerId);
    assert.equal(store.snapshot(code, client.playerId).hand.taboo.task, null);
  }
});

test("a full mixed room remixes enabled built-ins and submitted components together", () => {
  const store = new GameStore(),
    host = store.create({ ...input("玩家1"), remixSecrets: true });
  const code = host.room.code,
    clients = [host];
  for (let i = 2; i <= 12; i++)
    clients.push(store.join(code, input(`玩家${i}`)));
  store.act(code, host.playerId, "task", {
    type: "secret",
    trigger: "有人提起第十三个故事",
    action: "对着天花板挥一次手",
  });
  for (const [i, client] of clients.entries())
    store.act(code, client.playerId, "task", {
      type: "secret",
      trigger: `有人提起第${i + 1}场演唱会`,
      action: `喊出数字${i + 1}三次`,
    });
  const pool = store
    .pool(store.get(code))
    .filter((task) => task.type === "secret");
  for (const client of clients)
    store.act(code, client.playerId, "ready", { ready: true });
  store.act(code, host.playerId, "start");
  const secrets = Object.values(store.get(code).assignments).map(
    (hand) => hand.secret,
  );
  assert.equal(secrets.length, 12);
  assert.equal(new Set(secrets.map(pair)).size, 12);
  for (const task of secrets) {
    assert.ok(!pool.some((original) => pair(original) === pair(task)));
    assert.ok(pool.some((original) => original.trigger === task.trigger));
    assert.ok(pool.some((original) => original.action === task.action));
  }
  for (const field of ["trigger", "action"]) {
    const counts = (cards, value) =>
      cards.filter((card) => card[field] === value).length;
    assert.ok(
      secrets.every(
        (card) => counts(secrets, card[field]) <= counts(pool, card[field]),
      ),
    );
  }
  for (const client of clients) {
    const hand = store.get(code).assignments[client.playerId].secret;
    for (const own of pool.filter(
      (task) => task.authorId === client.playerId,
    )) {
      assert.notEqual(hand.trigger, own.trigger);
      assert.notEqual(hand.action, own.action);
    }
  }
});

test("ordinary secret and mixed rounds never deal a complete submission to its author", () => {
  for (const mode of ["secret", "mixed"]) {
    const { store, host, peer, code, ready } = setup(mode, false);
    for (const [i, client] of [host, peer].entries()) {
      store.act(code, client.playerId, "task", {
        type: "secret",
        trigger: `有人提起故事${i}`,
        action: `念出台词${i}`,
      });
      if (mode === "mixed")
        store.act(code, client.playerId, "task", {
          type: "taboo",
          trigger: `本人说出水果${i}`,
        });
    }
    ready();
    store.act(code, host.playerId, "start");
    const room = store.get(code);
    assert.equal(
      room.assignments[host.playerId].secret.authorId,
      peer.playerId,
    );
    assert.equal(
      room.assignments[peer.playerId].secret.authorId,
      host.playerId,
    );
    if (mode === "mixed") {
      assert.equal(
        room.assignments[host.playerId].taboo.authorId,
        peer.playerId,
      );
      assert.equal(
        room.assignments[peer.playerId].taboo.authorId,
        host.playerId,
      );
    }
  }
});

test("own-only secret pool blocks atomically; changing the pool invalidates the start hint", () => {
  const { store, host, code, ready } = setup("secret", false);
  for (let i = 0; i < 2; i++)
    store.act(code, host.playerId, "task", {
      type: "secret",
      trigger: `有人打开盒子${i}`,
      action: `模仿动物${i}`,
    });
  ready();
  const before = structuredClone(store.get(code));
  assert.match(store.snapshot(code, host.playerId).startIssue, /避开本人投稿/);
  assert.throws(() => store.act(code, host.playerId, "start"), /避开本人投稿/);
  assert.deepEqual(store.get(code), before);
  store.act(code, host.playerId, "settings", { builtins: true });
  ready();
  assert.equal(store.snapshot(code, host.playerId).startIssue, null);
  store.act(code, host.playerId, "start");
  assert.notEqual(
    store.get(code).assignments[host.playerId].secret.authorId,
    host.playerId,
  );
});

test("two authored ingredients cannot be remixed back to either writer; a third player makes it possible", () => {
  const { store, host, peer, code, ready } = setup("secret", false);
  for (const [i, client] of [host, peer].entries())
    store.act(code, client.playerId, "task", {
      type: "secret",
      trigger: `有人提起旅行${i}`,
      action: `模仿交通工具${i}`,
    });
  store.act(code, host.playerId, "settings", { remixSecrets: true });
  ready();
  const before = structuredClone(store.get(code));
  assert.match(store.snapshot(code, host.playerId).startIssue, /避开本人投稿/);
  assert.throws(() => store.act(code, host.playerId, "start"), /避开本人投稿/);
  assert.deepEqual(store.get(code), before);
  const third = store.join(code, input("第三位"));
  store.act(code, third.playerId, "task", {
    type: "secret",
    trigger: "有人提起旅行2",
    action: "模仿交通工具2",
  });
  const clients = [host, peer, third];
  for (const client of clients)
    store.act(code, client.playerId, "ready", { ready: true });
  assert.equal(store.snapshot(code, host.playerId).startIssue, null);
  store.act(code, host.playerId, "start");
  const room = store.get(code);
  for (const client of clients) {
    const hand = store.snapshot(code, client.playerId).hand.secret;
    const own = room.tasks.find((task) => task.authorId === client.playerId);
    assert.notEqual(hand.trigger, own.trigger);
    assert.notEqual(hand.action, own.action);
    assert.ok(!room.tasks.some((task) => pair(task) === pair(hand)));
    assert.deepEqual(Object.keys(hand).sort(), ["action", "trigger", "type"]);
  }
});

test("shared ingredient wording cannot bypass author avoidance through another submission or built-in", () => {
  const players = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const pool = [
    { ...secret("1", "共同条件", "共同后果"), authorId: "a" },
    { ...secret("2", "共同条件！", "后果二"), authorId: "b" },
    { ...secret("3", "条件三", "共同后果。"), authorId: "c" },
    secret("4", "共同条件", "后果四"),
    secret("5", "条件五", "共同后果"),
    secret("6", "条件六", "后果六"),
  ];
  const before = structuredClone(pool);
  const clean = (value) => value.replace(/[！。]/g, "");
  for (let round = 0; round < 20; round++) {
    const hands = remixSecrets(players, pool);
    for (const player of players) {
      for (const own of pool.filter((task) => task.authorId === player.id)) {
        assert.notEqual(clean(hands[player.id].trigger), clean(own.trigger));
        assert.notEqual(clean(hands[player.id].action), clean(own.action));
      }
    }
  }
  assert.deepEqual(pool, before);
});

test("joint remix allocation agrees with exhaustive small deals instead of rejecting an unlucky first pairing", () => {
  const players = [{ id: "a" }, { id: "b" }, { id: "c" }];
  let seed = 42;
  const random = (max) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor((seed / 4294967296) * max);
  };
  let possible = 0,
    impossible = 0;
  for (let sample = 0; sample < 100; sample++) {
    const pool = Array.from({ length: 3 + random(3) }, (_, i) => ({
      ...secret(String(i), `条件${random(4)}`, `后果${random(4)}`),
      authorId: [undefined, "a", "b", "c"][random(4)],
    }));
    const originals = new Set(pool.map(pair));
    // Small reference oracle enumerates actual fragment occurrences, without grouping or pruning.
    const enumerate = (index, triggers, actions, pairs) => {
      if (index === players.length) return true;
      const own = pool.filter((task) => task.authorId === players[index].id);
      for (let t = 0; t < pool.length; t++) {
        if (
          triggers.includes(t) ||
          own.some((task) => task.trigger === pool[t].trigger)
        )
          continue;
        for (let a = 0; a < pool.length; a++) {
          if (
            actions.includes(a) ||
            own.some((task) => task.action === pool[a].action)
          )
            continue;
          const value = pair({
            trigger: pool[t].trigger,
            action: pool[a].action,
          });
          if (originals.has(value) || pairs.includes(value)) continue;
          if (
            enumerate(
              index + 1,
              [...triggers, t],
              [...actions, a],
              [...pairs, value],
            )
          )
            return true;
        }
      }
      return false;
    };
    if (enumerate(0, [], [], [])) {
      possible++;
      assert.equal(
        Object.keys(remixSecrets(players, pool)).length,
        players.length,
      );
    } else {
      impossible++;
      assert.throws(() => remixSecrets(players, pool), /不足以重组/);
    }
  }
  assert.ok(possible > 0 && impossible > 0);
});

test("remix setting and actual new pairs survive reload; old room files default to off", () => {
  const dir = mkdtempSync(join(tmpdir(), "partygame-remix-"));
  try {
    const path = join(dir, "rooms.json");
    const { store, host, code, ready } = setup("secret", true, path);
    store.act(code, host.playerId, "settings", { remixSecrets: true });
    ready();
    store.act(code, host.playerId, "start");
    let restored = new GameStore(path);
    assert.deepEqual(
      restored.snapshot(code, host.playerId),
      store.snapshot(code, host.playerId),
    );
    const data = JSON.parse(readFileSync(path));
    delete data.rooms[0].remixSecrets;
    writeFileSync(path, JSON.stringify(data));
    restored = new GameStore(path);
    assert.equal(restored.snapshot(code, host.playerId).remixSecrets, false);
    assert.deepEqual(
      restored.get(code).assignments,
      store.get(code).assignments,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

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
