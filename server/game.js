import { randomBytes, randomInt, randomUUID, createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import { BUILTINS } from "./tasks.js";

export class GameError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const assert = (ok, message, status) => {
  if (!ok) throw new GameError(message, status);
};
export const hashToken = (token) =>
  createHash("sha256")
    .update(token || "")
    .digest("hex");
const modes = ["mixed", "secret", "taboo"];
const typesFor = (mode) => (mode === "mixed" ? ["secret", "taboo"] : [mode]);
const shuffled = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};
const cleanText = (value, max, label) => {
  assert(typeof value === "string", `请填写${label}`);
  const text = value.trim().normalize("NFKC");
  assert(
    text.length > 0 && [...text].length <= max,
    `${label}请填写 1–${max} 个字`,
  );
  assert(!/[\u0000-\u001f\u007f]/u.test(text), `${label}不能含有控制字符`);
  return text;
};
function profile(input) {
  const name = cleanText(input.name, 12, "昵称");
  assert(
    Number.isInteger(input.avatar) && input.avatar >= 0 && input.avatar < 12,
    "请选一个头像",
  );
  return { name, avatar: input.avatar };
}
const publicTask = (task) =>
  task ? { type: task.type, trigger: task.trigger, action: task.action } : null;
const signature = (task) =>
  `${task.type}:${task.trigger.replace(/[\s「」“”"'。！!，,]/g, "").toLowerCase()}:${task.action?.replace(/\s/g, "") || ""}`;

// Randomized bipartite matching: every player gets a distinct card, with author avoidance.
export function assign(players, pool, type) {
  const cards = shuffled(pool.filter((card) => card.type === type));
  const owner = new Map();
  const visit = (player, seen) => {
    for (const card of cards) {
      if (
        seen.has(card.id) ||
        (type === "taboo" && card.authorId === player.id)
      )
        continue;
      seen.add(card.id);
      if (!owner.has(card.id) || visit(owner.get(card.id), seen)) {
        owner.set(card.id, player);
        return true;
      }
    }
    return false;
  };
  for (const player of shuffled(players)) {
    assert(
      visit(player, new Set()),
      type === "taboo"
        ? "隐藏禁忌不足，或无法避开本人投稿。请再加几道题，或开启内置题库。"
        : "秘密任务不足，请添加题目或开启内置题库。",
    );
  }
  return Object.fromEntries(
    [...owner].map(([id, player]) => [
      player.id,
      cards.find((card) => card.id === id),
    ]),
  );
}

export class GameStore {
  constructor(path = null) {
    this.path = path;
    this.rooms = new Map();
    if (path) {
      mkdirSync(dirname(path), { recursive: true });
      try {
        const data = JSON.parse(readFileSync(path, "utf8"));
        assert(
          data.version === 1 && Array.isArray(data.rooms),
          "房间数据格式不正确",
          500,
        );
        this.rooms = new Map(
          data.rooms
            .filter((room) => Date.now() - room.updatedAt < 86400000)
            .map((room) => [room.code, room]),
        );
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
    }
  }
  persist(next) {
    if (this.path) {
      writeFileSync(
        `${this.path}.tmp`,
        JSON.stringify({ version: 1, rooms: [...next.values()] }),
        { mode: 0o600 },
      );
      renameSync(`${this.path}.tmp`, this.path);
    }
    this.rooms = next;
  }
  commit(room) {
    room.updatedAt = Date.now();
    room.version++;
    const next = new Map(
      [...this.rooms].filter(([, r]) => Date.now() - r.updatedAt < 86400000),
    );
    next.set(room.code, room);
    this.persist(next);
    return room;
  }
  get(code) {
    const room = this.rooms.get(code);
    assert(
      room && Date.now() - room.updatedAt < 86400000,
      "找不到这个房间，请检查房间码。房间会在 24 小时未操作后过期。",
      404,
    );
    return room;
  }
  authenticate(code, token) {
    const room = this.get(code);
    const player = room.players.find(
      (p) => p.tokenHash === hashToken(token) && !p.left,
    );
    assert(player, "当前身份已失效，请重新加入房间。", 401);
    return player.id;
  }
  create(input) {
    const details = profile(input);
    assert(modes.includes(input.mode), "请选择玩法");
    assert(typeof input.builtins === "boolean", "请选择题库来源");
    assert(this.rooms.size < 1000, "房间已满，请稍后再试。", 503);
    let code;
    do {
      code = String(randomInt(100000, 1000000));
    } while (this.rooms.has(code));
    const token = randomBytes(32).toString("hex"),
      id = randomUUID();
    const room = this.commit({
      code,
      mode: input.mode,
      builtins: input.builtins,
      status: "lobby",
      round: 1,
      version: 0,
      hostId: id,
      createdAt: Date.now(),
      players: [
        {
          id,
          ...details,
          tokenHash: hashToken(token),
          ready: false,
          left: false,
        },
      ],
      tasks: [],
      assignments: {},
      guessed: {},
    });
    return { room, playerId: id, token };
  }
  join(code, input, previousToken) {
    const existing = this.get(code);
    const prev = existing.players.find(
      (p) => p.tokenHash === hashToken(previousToken) && !p.left,
    );
    if (prev)
      return { room: existing, playerId: prev.id, token: previousToken };
    assert(
      existing.status === "lobby",
      "这局已经开始了，请等房主开启下一局再加入。",
      409,
    );
    const details = profile(input);
    const room = structuredClone(existing);
    assert(
      room.players.filter((p) => !p.left).length < 12,
      "房间已满，最多 12 人。",
      409,
    );
    assert(
      !room.players.some((p) => !p.left && p.name === details.name),
      "这个昵称已经有人用了，换一个吧。",
      409,
    );
    const token = randomBytes(32).toString("hex"),
      id = randomUUID();
    room.players.push({
      id,
      ...details,
      tokenHash: hashToken(token),
      ready: false,
      left: false,
    });
    this.commit(room);
    return { room, playerId: id, token };
  }
  pool(room) {
    return [...(room.builtins ? BUILTINS : []), ...room.tasks];
  }
  startIssue(room) {
    const players = room.players.filter((p) => !p.left);
    if (players.length < 2) return "再邀请 1 位朋友，就能开局了";
    const missing = players.filter((p) => !p.ready).length;
    if (missing) return `还有 ${missing} 位玩家没有准备`;
    try {
      for (const type of typesFor(room.mode))
        assign(players, this.pool(room), type);
    } catch (e) {
      return e.message;
    }
    return null;
  }
  act(code, playerId, action, input = {}) {
    const room = structuredClone(this.get(code));
    const player = room.players.find((p) => p.id === playerId && !p.left);
    assert(player, "请重新加入房间", 401);
    const host = () =>
      assert(room.hostId === playerId, "只有房主可以操作", 403);
    const lobby = () =>
      assert(room.status === "lobby", "本局已经开始，当前无法修改。", 409);
    const unready = () =>
      room.players.forEach((p) => {
        p.ready = false;
      });
    switch (action) {
      case "ready":
        lobby();
        assert(typeof input.ready === "boolean", "准备状态无效");
        player.ready = input.ready;
        break;
      case "settings":
        host();
        lobby();
        if (input.mode !== undefined) {
          assert(modes.includes(input.mode), "玩法无效");
          room.mode = input.mode;
        }
        if (input.builtins !== undefined) {
          assert(typeof input.builtins === "boolean", "题库来源无效");
          room.builtins = input.builtins;
        }
        unready();
        break;
      case "task": {
        lobby();
        assert(["secret", "taboo"].includes(input.type), "题目类型无效");
        const old = input.id ? room.tasks.find((t) => t.id === input.id) : null;
        if (input.id)
          assert(old?.authorId === playerId, "只能编辑自己的投稿", 403);
        assert(old || room.tasks.length < 200, "本局投稿已达上限");
        const task = {
          id: old?.id || randomUUID(),
          type: input.type,
          trigger: cleanText(input.trigger, 80, "触发条件"),
          action:
            input.type === "secret"
              ? cleanText(input.action, 80, "执行动作")
              : "",
          authorId: playerId,
        };
        // Compare against disabled built-ins too: a known submitted taboo must never reappear as a built-in for its author.
        assert(
          ![...BUILTINS, ...room.tasks].some(
            (t) => t.id !== task.id && signature(t) === signature(task),
          ),
          "这道题已经在题库里了，换个有趣的条件吧。",
          409,
        );
        room.tasks = [...room.tasks.filter((t) => t.id !== task.id), task];
        unready();
        break;
      }
      case "delete-task": {
        lobby();
        assert(
          room.tasks.some((t) => t.id === input.id && t.authorId === playerId),
          "只能删除自己的投稿",
          403,
        );
        room.tasks = room.tasks.filter((t) => t.id !== input.id);
        unready();
        break;
      }
      case "start": {
        host();
        lobby();
        const issue = this.startIssue(room);
        assert(!issue, issue);
        const players = room.players.filter((p) => !p.left);
        room.assignments = Object.fromEntries(players.map((p) => [p.id, {}]));
        for (const type of typesFor(room.mode)) {
          const assigned = assign(players, this.pool(room), type);
          for (const p of players)
            room.assignments[p.id][type] = assigned[p.id];
        }
        room.status = "playing";
        room.startedAt = Date.now();
        break;
      }
      case "guess":
        assert(room.status === "playing", "当前不在游戏中", 409);
        assert(input.playerId !== playerId, "请让另一位玩家确认你猜中了", 403);
        assert(
          room.players.some((p) => p.id === input.playerId && !p.left),
          "该玩家已离开",
        );
        assert(room.assignments[input.playerId]?.taboo, "该玩家没有隐藏禁忌");
        room.guessed[input.playerId] ||= { by: playerId, at: Date.now() };
        break;
      case "end":
        host();
        assert(room.status === "playing", "本局尚未开始或已经结束", 409);
        room.status = "ended";
        room.endedAt = Date.now();
        break;
      case "restart":
        host();
        assert(room.status === "ended", "请先结束本局", 409);
        room.status = "lobby";
        room.round++;
        room.assignments = {};
        room.guessed = {};
        room.players = room.players.filter((p) => !p.left);
        unready();
        break;
      case "remove":
        host();
        lobby();
        assert(input.playerId !== playerId, "请使用离开房间");
        assert(
          room.players.some((p) => p.id === input.playerId && !p.left),
          "玩家已离开",
        );
        room.players = room.players.filter((p) => p.id !== input.playerId);
        room.tasks = room.tasks.filter((t) => t.authorId !== input.playerId);
        unready();
        break;
      case "leave":
        player.left = true;
        if (room.status === "lobby") {
          room.tasks = room.tasks.filter((t) => t.authorId !== playerId);
          unready();
        }
        if (room.hostId === playerId)
          room.hostId = room.players.find((p) => !p.left)?.id || null;
        break;
      default:
        throw new GameError("找不到这个操作", 404);
    }
    return this.commit(room);
  }
  snapshot(code, viewerId, online = new Set()) {
    const room = this.get(code),
      viewer = room.players.find((p) => p.id === viewerId && !p.left);
    assert(viewer, "你已离开房间，请重新加入。", 401);
    const ended = room.status === "ended";
    const own = room.assignments[viewerId];
    return {
      code,
      status: room.status,
      round: room.round,
      version: room.version,
      mode: room.mode,
      builtins: room.builtins,
      hostId: room.hostId,
      meId: viewerId,
      players: room.players
        .filter((p) => !p.left || ended)
        .map((p) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          ready: p.ready,
          left: p.left,
          online: online.has(p.id),
          guessed: !!room.guessed[p.id],
        })),
      counts: Object.fromEntries(
        ["secret", "taboo"].map((type) => [
          type,
          this.pool(room).filter((t) => t.type === type).length,
        ]),
      ),
      submittedCount: room.tasks.length,
      myTasks: room.tasks
        .filter((t) => t.authorId === viewerId)
        .map((t) => ({ id: t.id, ...publicTask(t) })),
      startIssue: room.status === "lobby" ? this.startIssue(room) : null,
      hand: own
        ? {
            secret: publicTask(own.secret),
            taboo: {
              active: !!own.taboo,
              guessed: !!room.guessed[viewerId],
              task:
                room.guessed[viewerId] || ended ? publicTask(own.taboo) : null,
            },
          }
        : null,
      others:
        room.status === "lobby"
          ? []
          : room.players
              .filter((p) => p.id !== viewerId && !p.left)
              .map((p) => ({
                playerId: p.id,
                taboo: publicTask(room.assignments[p.id]?.taboo),
                guessed: !!room.guessed[p.id],
              })),
      reveal: ended
        ? room.players
            .filter((p) => room.assignments[p.id])
            .map((p) => ({
              playerId: p.id,
              secret: publicTask(room.assignments[p.id].secret),
              taboo: publicTask(room.assignments[p.id].taboo),
            }))
        : [],
    };
  }
}
