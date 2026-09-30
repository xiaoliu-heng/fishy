import { useEffect, useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  UsersRound,
  ChevronRight,
  LockKeyhole,
  LockKeyholeOpen,
  Check,
  Plus,
  Play,
  Copy,
  Share2,
  BookOpen,
  Pencil,
  Crown,
  Trash2,
  LogOut,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
} from "lucide-react";
import QRCode from "qrcode";
import {
  Avatar,
  Button,
  Heading,
  CardBack,
  Deck,
  KindIcon,
  Confetti,
  MODE,
  formatCode,
} from "./components.jsx";
export function Lobby({ room, busy, act, show, navigate }) {
  const me = room.players.find((p) => p.id === room.meId),
    host = room.hostId === room.meId;
  const seats = [
    [50, 20],
    [19, 38],
    [81, 38],
    [19, 68],
    [81, 68],
    [50, 82],
  ];
  const visible =
    room.players.length <= 6
      ? [...room.players, ...Array(6 - room.players.length).fill(null)]
      : room.players;
  return (
    <>
      <Heading>等朋友入座</Heading>
      <div className="invite-row">
        <button className="room-code" onClick={() => show("invite")}>
          房间号 <b>{formatCode(room.code)}</b>
          <Copy size={16} />
        </button>
        <Button onClick={() => show("invite")}>
          <Share2 size={18} />
          邀请朋友
        </Button>
      </div>
      <div
        className={`table-scene ${room.players.length > 6 ? "many-players" : ""}`}
      >
        <div className="table-deck">
          <CardBack compact />
          <CardBack compact />
        </div>
        {visible.map((p, i) => (
          <div
            className={`player-seat ${!p ? "empty" : ""}`}
            key={p?.id || `empty-${i}`}
            style={{
              left: `${seats[i]?.[0] || 0}%`,
              top: `${seats[i]?.[1] || 0}%`,
              "--seat": i,
            }}
          >
            {p ? (
              <>
                <div className="seat-avatar">
                  <Avatar id={p.avatar} size={70} />
                  {p.id === room.hostId && (
                    <Crown size={26} className="crown" />
                  )}
                  {p.ready && <Check size={20} className="ready-check" />}
                </div>
                <strong>{p.name}</strong>
                <small>
                  {p.id === room.meId ? "你 · " : ""}
                  {p.id === room.hostId ? "房主 · " : ""}
                  {p.ready ? "已准备" : "未准备"}
                </small>
              </>
            ) : (
              <button aria-label="邀请朋友入座" onClick={() => show("invite")}>
                <Plus size={22} />
                <small>待入座</small>
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        className="mode-summary row-button"
        onClick={() => show(host ? "settings" : "rules")}
      >
        <UsersRound />
        {MODE[room.mode]}
        <small>{room.players.length} / 12 人</small>
        <ChevronRight />
      </button>
      <div className="pool-counts">
        {["secret", "taboo"]
          .filter((t) => room.mode === "mixed" || room.mode === t)
          .map((type) => (
            <button
              className={`pool-count ${type}`}
              key={type}
              onClick={() => navigate("pool")}
            >
              <CardBack compact type={type} />
              <span>
                {MODE[type]}
                <strong>
                  {room.counts[type]} <small>道</small>
                </strong>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
      </div>
      <button className="add-task" onClick={() => navigate("submit")}>
        <Plus size={20} />
        加一道题
      </button>
      <div className="lobby-actions">
        <Button
          kind={me.ready ? "soft" : "primary"}
          disabled={busy}
          onClick={() => act("ready", { ready: !me.ready })}
        >
          {me.ready ? <Check /> : <Eye />}
          {me.ready ? "已准备 · 取消准备" : "准备好了"}
        </Button>
        {host ? (
          <>
            <Button
              kind="lime"
              disabled={busy || !!room.startIssue}
              onClick={() => act("start")}
            >
              <Play fill="currentColor" />
              {busy ? "请稍等…" : "开始抽签"}
            </Button>
            <p className="form-note" aria-live="polite">
              {room.startIssue || "全员就位，好戏开场！"}
            </p>
          </>
        ) : (
          <p className="form-note">
            {me.ready
              ? "等房主开始抽签，先和朋友聊聊天。"
              : "准备好后，房主就可以开始抽签。"}
          </p>
        )}
      </div>
    </>
  );
}
export function Pool({ room, busy, act, edit, navigate, show }) {
  return (
    <>
      <Heading note="把好点子放进来，把小秘密留到开局。">本局任务池</Heading>
      <div className="pool-counts large">
        {["secret", "taboo"].map((type) => (
          <div className={`pool-count ${type}`} key={type}>
            <CardBack compact type={type} />
            <span>
              {MODE[type]}
              <strong>
                {room.counts[type]}
                <small> 道</small>
              </strong>
            </span>
          </div>
        ))}
      </div>
      <label className="switch-row pool-source">
        <BookOpen />
        <span>
          <strong>内置题库</strong>
          <small>
            {room.hostId === room.meId
              ? "修改后大家需要重新准备"
              : "由房主选择是否使用"}
          </small>
        </span>
        <input
          type="checkbox"
          className="switch"
          checked={room.builtins}
          disabled={busy || room.hostId !== room.meId}
          onChange={(e) => act("settings", { builtins: e.target.checked })}
        />
      </label>
      <div className="source-count">
        <UsersRound />
        <span>朋友投稿</span>
        <b>{room.submittedCount} 道</b>
      </div>
      <h2 className="section-heading">
        我的投稿 <Pencil size={20} />
      </h2>
      {room.myTasks.length ? (
        room.myTasks.map((task) => (
          <div className={`submitted-task ${task.type}`} key={task.id}>
            <KindIcon type={task.type} />
            <div>
              <small>{MODE[task.type]}</small>
              <p>
                {task.trigger}
                {task.action && <> → {task.action}</>}
              </p>
            </div>
            <button
              className="icon-btn"
              aria-label={`编辑：${task.trigger}`}
              onClick={() => edit(task)}
            >
              <Pencil size={19} />
            </button>
            <button
              className="icon-btn"
              aria-label={`删除：${task.trigger}`}
              onClick={() => show("deleteTask", task)}
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))
      ) : (
        <div className="empty-pool">
          <div className="mini-deck">
            <CardBack compact />
          </div>
          <h3>还差你的鬼点子</h3>
          <p>
            日常的一句话、一个小动作，
            <br />
            都能变成今晚的好戏。
          </p>
        </div>
      )}
      <p className="privacy-note">
        <LockKeyhole size={16} />
        其他人的投稿内容暂时保密
      </p>
      <Button className="full" onClick={() => navigate("submit")}>
        <Plus />
        出一道题
      </Button>
    </>
  );
}
export function Submit({ room, task, busy, act, done }) {
  const [type, setType] = useState(
      task?.type || (room.mode === "taboo" ? "taboo" : "secret"),
    ),
    [trigger, setTrigger] = useState(task?.trigger || ""),
    [action, setAction] = useState(task?.action || ""),
    [sent, setSent] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <>
      <Heading>
        {task
          ? "编辑这道题"
          : type === "secret"
            ? "出一道秘密任务"
            : "出一道隐藏禁忌"}
      </Heading>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act("task", { id: task?.id, type, trigger, action })) {
            setSent(true);
            timer.current = setTimeout(done, 560);
          }
        }}
      >
        <div className="segmented" role="group" aria-label="任务类型">
          {["secret", "taboo"].map((t) => (
            <button
              key={t}
              type="button"
              className={t === type ? "active" : ""}
              aria-pressed={t === type}
              onClick={() => setType(t)}
            >
              <KindIcon type={t} size={20} />
              {MODE[t]}
            </button>
          ))}
        </div>
        <div className="fields">
          <label>
            {type === "secret" ? "当……" : "当本人……"}
            <textarea
              placeholder={
                type === "secret"
                  ? "例如：有人说「好家伙」"
                  : "例如：说出「没想到」"
              }
              required
              maxLength={80}
              rows={2}
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
            />
            <small className="char-count">{[...trigger].length} / 80</small>
          </label>
          {type === "secret" && (
            <label>
              你就……
              <textarea
                placeholder="例如：摆一个超级英雄的姿势"
                required
                maxLength={80}
                rows={2}
                value={action}
                onChange={(e) => setAction(e.target.value)}
              />
              <small className="char-count">{[...action].length} / 80</small>
            </label>
          )}
        </div>
        <div className="submission-stage">
          <div className="pool-destination" aria-hidden="true">
            <span>任务池</span>
            <div className="mini-deck">
              <CardBack compact />
              <CardBack type="taboo" compact />
            </div>
          </div>
          <div className={`task-preview ${type} ${sent ? "submitted" : ""}`}>
            <div className="preview-title">
              <KindIcon type={type} />
              <h2>{MODE[type]}</h2>
            </div>
            <small>
              {type === "secret" ? "只有抽到的人知道" : "抽到的人暂时不知道"}
            </small>
            <div className="preview-paper">
              <span>{type === "secret" ? "触发条件" : "当本人"}</span>
              <p>{trigger || "写下一个日常的小动作…"}</p>
              {type === "secret" && (
                <>
                  <hr />
                  <span>执行动作</span>
                  <p>{action || "会发生什么好戏？"}</p>
                </>
              )}
            </div>
          </div>
        </div>
        {type === "taboo" && (
          <p className="privacy-note">
            <ShieldCheck size={18} />
            不会分配给投稿者本人
          </p>
        )}
        <Button
          type="submit"
          kind="lime"
          className="full"
          disabled={busy || sent}
        >
          <Sparkles />
          {sent
            ? "已放进任务池"
            : busy
              ? "正在放入…"
              : task
                ? "保存这道题"
                : "放进任务池"}
        </Button>
        <p className="form-note">描述清楚、容易判断，才更好玩。</p>
      </form>
    </>
  );
}
export function Deal({ room, done }) {
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setFinished(true), 1200);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="deal-view">
      <Heading note="请记住自己的牌，开始演吧！">你的牌，发好了</Heading>
      <div className="dealing-table">
        <Deck mode={room.mode} dealing />
        <div className="deck-labels">
          {room.mode !== "taboo" && (
            <div>
              <strong>秘密任务</strong>
              <small>只有你看</small>
            </div>
          )}
          {room.mode !== "secret" && (
            <div>
              <strong>隐藏禁忌</strong>
              <small>其他人看</small>
            </div>
          )}
        </div>
      </div>
      <div className="friend-strip">
        <p>本局的伙伴（{room.players.length} 人）</p>
        <div>
          {room.players.map((p) => (
            <span key={p.id}>
              <Avatar id={p.avatar} size={46} />
              <small>{p.name}</small>
            </span>
          ))}
        </div>
      </div>
      <Button className="full" kind="lime" onClick={done}>
        {finished ? "进入游戏" : "跳过动画，进入游戏"}
        <ArrowRight />
      </Button>
    </div>
  );
}
function Secret({ task, peek, reveal, conceal }) {
  return (
    <>
      <div className={`secret-card ${peek ? "is-open" : ""}`}>
        <div className="secret-card-title">
          <Eye />
          <h2>秘密任务</h2>
          <span>只有你知道</span>
        </div>
        {peek ? (
          <div className="secret-reading">
            <span>当……</span>
            <p>{task.trigger}</p>
            <span>你就……</span>
            <p>{task.action}</p>
          </div>
        ) : (
          <div className="secret-cover">
            <span>守住你的小秘密</span>
          </div>
        )}
        <div className="card-rule">被猜出来，也要继续执行</div>
      </div>
      <button
        className="btn lime full peek-button"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          reveal();
        }}
        onPointerUp={conceal}
        onPointerCancel={conceal}
        onLostPointerCapture={conceal}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if ([" ", "Enter"].includes(e.key)) {
            e.preventDefault();
            reveal();
          }
        }}
        onKeyUp={(e) => {
          if ([" ", "Enter"].includes(e.key)) {
            e.preventDefault();
            conceal();
          }
        }}
        aria-label="按住偷看秘密任务，松手隐藏"
      >
        <Eye />
        {peek ? "松手即隐藏" : "按住偷看"}
      </button>
      <button
        className="text-link peek-alternative"
        onClick={() => (peek ? conceal() : reveal())}
      >
        {peek ? "收起任务" : "也可以点按查看 / 收起"}
      </button>
    </>
  );
}
function OwnTaboo({ hand }) {
  return (
    <div className={`own-taboo ${hand.guessed ? "cleared" : ""}`}>
      <div>
        <h2>{hand.guessed ? "你的禁忌已解除" : "我的隐藏禁忌"}</h2>
        {hand.guessed ? (
          <p>{hand.task?.trigger}</p>
        ) : (
          <>
            <p>大家都知道，只有你不知道</p>
            <span className="status-tag">等你猜中</span>
          </>
        )}
      </div>
      {hand.guessed ? (
        <LockKeyholeOpen size={38} />
      ) : (
        <CardBack compact type="taboo" />
      )}
    </div>
  );
}
export function Playing({
  room,
  tab,
  setTab,
  peek,
  reveal,
  conceal,
  shield,
  unshield,
  guess,
  rules,
}) {
  const secret = room.mode !== "taboo",
    taboo = room.mode !== "secret";
  return (
    <>
      <Heading
        note={
          tab === "others"
            ? "留意他们的小动作"
            : secret
              ? "悄悄完成任务，别被发现！"
              : "你的禁忌，藏在朋友的手机里"
        }
      >
        {tab === "others"
          ? "大家的禁忌"
          : secret
            ? "轮到你演了"
            : "谁先露出破绽？"}
      </Heading>
      {shield ? (
        <div className="privacy-shield">
          <EyeOff size={48} />
          <h2>牌已经收好了</h2>
          <p>确认身旁没有人偷看，再继续。</p>
          <Button onClick={unshield}>
            <Eye />
            继续查看
          </Button>
        </div>
      ) : (
        <>
          {tab === "mine" && secret && (
            <Secret
              task={room.hand.secret}
              peek={peek}
              reveal={reveal}
              conceal={conceal}
            />
          )}
          <div className={tab === "others" ? "own-taboo-small" : ""}>
            {taboo && <OwnTaboo hand={room.hand.taboo} />}
          </div>
          {tab === "others" && (
            <div className="taboo-list">
              {room.others
                .filter((p) => p.taboo)
                .map((item) => {
                  const p = room.players.find((p) => p.id === item.playerId);
                  return (
                    <button
                      className={`taboo-row ${item.guessed ? "guessed" : ""}`}
                      key={p.id}
                      onClick={() => guess(p, item)}
                      disabled={item.guessed}
                    >
                      <Avatar id={p.avatar} size={58} />
                      <div>
                        <strong>{p.name}</strong>
                        <p>{item.taboo.trigger}</p>
                        {item.guessed && (
                          <small>
                            <Check size={14} />
                            已猜中 · 禁忌解除
                          </small>
                        )}
                      </div>
                      {item.guessed ? (
                        <LockKeyholeOpen size={22} />
                      ) : (
                        <ChevronRight />
                      )}
                    </button>
                  );
                })}
              <p className="privacy-note">
                <HelpCircle size={18} />
                猜中后，由其他玩家现场确认
              </p>
            </div>
          )}
        </>
      )}
      <nav className="game-nav" aria-label="游戏页面">
        {secret && (
          <button
            className={tab === "mine" ? "active" : ""}
            onClick={() => setTab("mine")}
            aria-current={tab === "mine" ? "page" : undefined}
          >
            <Eye />
            我的任务
          </button>
        )}
        {taboo && (
          <button
            className={tab === "others" ? "active" : ""}
            onClick={() => setTab("others")}
            aria-current={tab === "others" ? "page" : undefined}
          >
            <UsersRound />
            大家的禁忌
          </button>
        )}
        {room.mode !== "mixed" && (
          <button onClick={rules}>
            <BookOpen />
            规则
          </button>
        )}
      </nav>
    </>
  );
}
export function Celebration({ room, done }) {
  return (
    <div className="celebration">
      <Confetti />
      <Heading>猜中了！</Heading>
      <div className="unlock-scene" aria-hidden="true">
        <div className="unlocked-card">
          <img
            className="card-art"
            src="/assets/scenes/card-taboo.png"
            alt=""
          />
          <LockKeyholeOpen className="opened-lock" size={58} />
          <img
            className="seal-piece seal-left"
            src="/assets/scenes/seal.png"
            alt=""
          />
          <img
            className="seal-piece seal-right"
            src="/assets/scenes/seal.png"
            alt=""
          />
        </div>
      </div>
      <h2>你的隐藏禁忌已解除</h2>
      <p className="revealed-trigger">{room.hand.taboo.task?.trigger}</p>
      {room.mode === "mixed" && (
        <p className="continuing">
          <Eye size={20} />
          你的秘密任务还在继续
        </p>
      )}
      <Button kind="lime" className="full" onClick={done}>
        回到游戏
        <ArrowRight />
      </Button>
    </div>
  );
}
export function Recap({ room, act, busy, show }) {
  return (
    <div className="recap">
      <Confetti />
      <Heading note={`${room.reveal.length} 位玩家的任务`}>
        原来你也在演
      </Heading>
      <span className="ended-label">
        <Check size={16} />
        本局已结束
      </span>
      <div className="reveal-fan" aria-hidden="true">
        {room.reveal.map((item, i) => {
          const player = room.players.find((p) => p.id === item.playerId);
          const spread = i - (room.reveal.length - 1) / 2;
          return (
            <div
              className="fan-hand"
              key={item.playerId}
              style={{
                "--fan-x": `${spread * Math.min(32, 200 / room.reveal.length)}px`,
                "--fan-angle": `${spread * Math.min(12, 64 / room.reveal.length)}deg`,
                "--fan-delay": `${i * 35}ms`,
              }}
            >
              <CardBack
                type={
                  room.mode === "taboo" || (room.mode === "mixed" && i % 2)
                    ? "taboo"
                    : "secret"
                }
                compact
              />
              <Avatar id={player.avatar} size={28} />
            </div>
          );
        })}
      </div>
      <div className="recap-list">
        {room.reveal.map((item, i) => {
          const p = room.players.find((p) => p.id === item.playerId);
          return (
            <div className="recap-row" key={p.id} style={{ "--seat": i }}>
              <div className="recap-person">
                <Avatar id={p.avatar} size={55} />
                <strong>{p.name}</strong>
                {p.left && <small>已离开</small>}
              </div>
              <div>
                {item.secret && (
                  <div className="reveal-task secret">
                    <span>
                      <Eye size={15} />
                      秘密任务
                    </span>
                    <p>
                      当{item.secret.trigger}，<br />
                      你就{item.secret.action}
                    </p>
                  </div>
                )}
                {item.taboo && (
                  <div className="reveal-task taboo">
                    <span>
                      <LockKeyhole size={15} />
                      隐藏禁忌
                    </span>
                    <p>{item.taboo.trigger}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="recap-actions">
        {room.hostId === room.meId ? (
          <Button kind="lime" disabled={busy} onClick={() => act("restart")}>
            <RotateCcw />
            再来一局
          </Button>
        ) : (
          <p className="form-note">等房主开启下一局</p>
        )}
        <Button kind="soft" onClick={() => show("leave")}>
          <LogOut size={20} />
          离开房间
        </Button>
      </div>
    </div>
  );
}
export function Invite({ room, networkUrls, toast }) {
  const local = ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
  const base = local ? networkUrls[0] || location.origin : location.origin;
  const link = `${base}/?room=${room.code}`;
  const [qr, setQr] = useState(""),
    [manual, setManual] = useState(false);
  const input = useRef(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(link, {
      width: 480,
      margin: 2,
      color: { dark: "#183E39", light: "#F5F6F0" },
    })
      .then((s) => alive && setQr(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [link]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast("邀请链接已复制");
    } catch {
      setManual(true);
      input.current.focus();
      input.current.select();
    }
  };
  return (
    <div className="invite-content">
      <p>连上同一个 Wi-Fi，扫码入座。</p>
      {qr && <img className="qr" src={qr} alt="加入本局的二维码" />}
      <div className="invite-code">{formatCode(room.code)}</div>
      <label className="share-link-label">
        房间链接
        <input ref={input} readOnly value={link} aria-label="房间邀请链接" />
      </label>
      {manual && (
        <p role="status" className="copy-hint">
          请长按上方链接，选择复制。
        </p>
      )}
      {local && !networkUrls.length && (
        <p className="error-note">
          还没有找到局域网地址，请检查电脑是否已连接 Wi-Fi。
        </p>
      )}
      <Button className="full" onClick={copy}>
        <Copy size={20} />
        复制邀请链接
      </Button>
      <p className="form-note">共用一个链接，每人拿到自己的牌。</p>
    </div>
  );
}
