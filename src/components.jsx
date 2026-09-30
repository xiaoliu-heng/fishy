import { useEffect, useRef, useState } from "react";
import {
  Eye,
  UsersRound,
  ChevronRight,
  ChevronLeft,
  LockKeyhole,
  Check,
  Plus,
  ArrowRight,
  X,
  BookOpen,
} from "lucide-react";
import { Logo } from "./Logo.jsx";
import { saved } from "./useGame.js";
export const MODE = {
  secret: "秘密任务",
  taboo: "隐藏禁忌",
  mixed: "混合模式",
};
const positions = [
  [4.19, 7.17],
  [49.91, 7.17],
  [95.58, 7.17],
  [4.19, 90.7],
  [49.82, 90.7],
  [95.63, 90.61],
];
const avatarNames = [
  "眼镜同学",
  "短发同学",
  "卷发同学",
  "长发同学",
  "帽子同学",
  "小白狗",
  "丸子头同学",
  "胡子同学",
  "贝雷帽同学",
  "耳机同学",
  "小橘猫",
  "小兔子",
];
const extraAvatarScales = [113.2, 112.4, 111.2, 110.4, 111, 109.4];
export function Avatar({ id = 0, size = 60 }) {
  const p = positions[id] || positions[0];
  return (
    <span
      aria-hidden="true"
      className="avatar"
      style={{
        width: size,
        height: size,
        backgroundPosition: id >= 6 ? "center" : `${p[0]}% ${p[1]}%`,
        ...(id >= 6 && id < 12
          ? {
              backgroundImage: `url(/assets/avatars-extra/${String(id).padStart(2, "0")}.png)`,
              backgroundSize: `${extraAvatarScales[id - 6]}% ${extraAvatarScales[id - 6]}%`,
            }
          : {}),
      }}
    />
  );
}
export function KindIcon({ type, ...props }) {
  return type === "taboo" ? <LockKeyhole {...props} /> : <Eye {...props} />;
}
export function Button({
  children,
  kind = "primary",
  className = "",
  ...props
}) {
  return (
    <button className={`btn ${kind} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Alert({ text }) {
  return text ? (
    <div role="alert" className="error-note">
      {text}
    </div>
  ) : null;
}
export function Heading({ children, note }) {
  return (
    <div className="page-heading">
      <h1>{children}</h1>
      {note && <p>{note}</p>}
    </div>
  );
}
export function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 20 }, (_, i) => (
        <i
          key={i}
          style={{
            "--i": i,
            "--x": `${(i * 37) % 100}%`,
            "--r": `${i * 41}deg`,
          }}
        />
      ))}
    </div>
  );
}
export function CardBack({ type = "secret", compact = false }) {
  return (
    <div
      className={`card-back ${type} ${compact ? "compact" : ""}`}
      aria-hidden="true"
    >
      <img
        className="card-art"
        src={`/assets/scenes/card-${type}.png`}
        alt=""
      />
      {type === "taboo" && (
        <img className="card-seal" src="/assets/scenes/seal.png" alt="" />
      )}
    </div>
  );
}
export function Deck({ mode = "mixed", dealing = false }) {
  return (
    <div
      className={`deck ${mode} ${dealing ? "dealing" : ""}`}
      aria-hidden="true"
    >
      {mode !== "taboo" && <CardBack />}
      {mode !== "secret" && <CardBack type="taboo" />}
    </div>
  );
}
export function Modal({ title, children, close, error }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-content">
        <button
          className="icon-btn modal-close"
          aria-label="关闭"
          onClick={close}
        >
          <X />
        </button>
        <h2 id="dialog-title">{title}</h2>
        {children}
        <Alert text={error} />
      </div>
    </dialog>
  );
}
export function AvatarPicker({ value, onChange }) {
  return (
    <div className="avatar-picker" role="group" aria-label="选一个头像">
      {avatarNames.map((name, id) => (
        <button
          type="button"
          key={id}
          aria-label={name}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
        >
          <Avatar id={id} size={48} />
          {value === id && <Check className="avatar-check" size={17} />}
        </button>
      ))}
    </div>
  );
}
export function ModePicker({ value, onChange }) {
  return (
    <fieldset className="mode-picker">
      <legend className="sr-only">选择玩法</legend>
      {Object.entries(MODE).map(([mode, label]) => (
        <label
          className={`mode-option ${mode === value ? "selected" : ""}`}
          key={mode}
        >
          <span className="mini-deck">
            <CardBack compact type={mode === "taboo" ? "taboo" : "secret"} />
            {mode === "mixed" && <CardBack compact type="taboo" />}
          </span>
          <span>
            <strong>{label}</strong>
            <small>
              {mode === "secret"
                ? "只有你知道，触发就得演"
                : mode === "taboo"
                  ? "大家都知道，等你来猜"
                  : "两种都有，每人各一张"}
            </small>
          </span>
          <input
            type="radio"
            name="mode"
            value={mode}
            checked={value === mode}
            onChange={() => onChange(mode)}
          />
        </label>
      ))}
    </fieldset>
  );
}
export function Rules() {
  return (
    <div className="rules">
      <div className="rule secret">
        <Eye />
        <div>
          <h3>秘密任务</h3>
          <p>只有自己知道。当别人做了某件事，你就必须执行卡牌上的动作。</p>
          <p className="rule-foot">被猜出来，也要继续执行。</p>
        </div>
      </div>
      <div className="rule taboo">
        <LockKeyhole />
        <div>
          <h3>隐藏禁忌</h3>
          <p>
            大家都知道，只有你不知道。你的行为触发禁忌后，接受大家现场约定的惩罚。
          </p>
          <p className="rule-foot">自己猜中后，让另一位玩家确认解除。</p>
        </div>
      </div>
      <p className="muted">
        混合模式下，每人同时拥有两张牌。先约定好现场规则，再把手机放下，开始演吧。
      </p>
    </div>
  );
}
export const formatCode = (code) => `${code.slice(0, 3)} ${code.slice(3)}`;
export function Entry({ navigate, rules }) {
  return (
    <main className="app-shell entry">
      <header className="entry-brand">
        <Logo />
        <span>PartyGame</span>
      </header>
      <div className="entry-copy">
        <h1>
          今晚，<span>都有戏。</span>
        </h1>
        <p>一人一个秘密，一屋子都是戏。</p>
      </div>
      <img
        className="entry-art"
        src="/assets/hero-deck.png"
        alt="秘密卡牌和六个朋友的头像筹码"
      />
      <div className="entry-actions">
        <Button onClick={() => navigate("join")}>
          <Eye />
          加入房间
          <ChevronRight />
        </Button>
        <Button kind="secondary" onClick={() => navigate("create")}>
          <UsersRound />
          我来组局
          <ChevronRight />
        </Button>
        <button className="text-link" onClick={rules}>
          先看怎么玩
          <ChevronRight size={18} />
        </button>
      </div>
    </main>
  );
}
export function EntryForm({ kind, code, busy, error, back, enter }) {
  const [name, setName] = useState(saved.get("name")),
    [avatar, setAvatar] = useState(Number(saved.get("avatar", "0"))),
    [roomCode, setCode] = useState(code || "");
  const [mode, setMode] = useState("mixed"),
    [builtins, setBuiltins] = useState(true);
  const isJoin = kind === "join";
  return (
    <main className="app-shell screen">
      <div className="page-bar">
        <button className="icon-btn" aria-label="返回首页" onClick={back}>
          <ChevronLeft />
        </button>
        <strong>{isJoin ? "加入房间" : "选择玩法"}</strong>
        <span />
      </div>
      <Heading note={isJoin ? "好戏马上开始！" : "选一种玩法，开始这场聚会！"}>
        {isJoin ? "来，入座。" : "今晚怎么玩？"}
      </Heading>
      {isJoin && (
        <div className="welcome-tokens">
          <Avatar id={1} size={94} />
          <Avatar id={2} size={94} />
          <Avatar id={5} size={94} />
        </div>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await enter(kind, {
            name,
            avatar,
            mode,
            builtins,
            code: roomCode.replace(/\s/g, ""),
          });
        }}
        className="join-form"
      >
        {!isJoin && <ModePicker value={mode} onChange={setMode} />}
        <div className="fields">
          {isJoin && (
            <label>
              房间码
              <input
                name="code"
                aria-label="房间码"
                className="code-input"
                inputMode="numeric"
                autoComplete="off"
                placeholder="六位房间码"
                value={roomCode}
                maxLength={7}
                pattern="[0-9 ]{6,7}"
                required
                onChange={(e) =>
                  setCode(e.target.value.replace(/[^0-9 ]/g, ""))
                }
              />
            </label>
          )}
          <label>
            你的昵称
            <input
              name="name"
              placeholder="让朋友一眼认出你"
              maxLength={12}
              autoComplete="nickname"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        </div>
        <div className="avatar-field">
          <span className="field-label">选一个头像</span>
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </div>
        {!isJoin && (
          <label className="switch-row">
            <BookOpen />
            <span>
              <strong>带上内置任务</strong>
              <small>两种任务各 30 道，好戏随时开始</small>
            </span>
            <input
              type="checkbox"
              className="switch"
              checked={builtins}
              onChange={(e) => setBuiltins(e.target.checked)}
            />
          </label>
        )}
        <Alert text={error} />
        <Button disabled={busy} type="submit" className="full">
          {busy ? "正在入座…" : isJoin ? "加入本局" : "开一局"}
          <ArrowRight size={22} />
        </Button>
        <p className="form-note">同一个 Wi-Fi，同一桌好戏。</p>
      </form>
    </main>
  );
}
