import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  EyeOff,
  UsersRound,
  ChevronRight,
  ChevronLeft,
  MoreHorizontal,
  Check,
  Share2,
  X,
  BookOpen,
  LogOut,
  WifiOff,
} from "lucide-react";
import { Logo } from "./Logo.jsx";
import { saved, useGame } from "./useGame.js";
import {
  Avatar,
  Button,
  Alert,
  Modal,
  ModePicker,
  Rules,
  Deck,
  Entry,
  EntryForm,
  formatCode,
} from "./components.jsx";
import {
  Lobby,
  Pool,
  Submit,
  Deal,
  Playing,
  Celebration,
  Recap,
  Invite,
} from "./screens.jsx";
const TITLES = {
  rules: "好戏，怎么玩？",
  menu: "这局的牌桌",
  invite: "喊朋友入座",
  settings: "本局怎么玩",
  members: "本局的伙伴",
  guess: "确认猜中了？",
  end: "结束并揭晓？",
  leave: "要离开这一局吗？",
  deleteTask: "移除这道题？",
  remove: "请这位玩家离开？",
};
export default function App() {
  const {
    room,
    busy,
    error,
    setError,
    act,
    enter,
    restoring,
    connected,
    inviteCode,
    networkUrls,
  } = useGame();
  const [screen, setScreen] = useState(
    location.hash.slice(1) ||
      (new URLSearchParams(location.search).has("room") ? "join" : "home"),
  );
  const [modal, setModal] = useState(null),
    [editTask, setEditTask] = useState(null),
    [tab, setTabState] = useState("mine"),
    [peek, setPeek] = useState(false),
    [shield, setShield] = useState(false);
  const [dealt, setDealt] = useState(""),
    [celebrated, setCelebrated] = useState(""),
    [toastText, setToast] = useState("");
  const toastTimer = useRef(null);
  const roundKey = room ? `${room.code}:${room.round}` : "";
  const hide = () => flushSync(() => setPeek(false));
  const navigate = (page) => {
    hide();
    setError("");
    setEditTask(null);
    setScreen(page);
    history.pushState(
      null,
      "",
      `${location.pathname}${location.search}${page === "home" ? "" : `#${page}`}`,
    );
    window.scrollTo({ top: 0 });
  };
  const show = (type, data) => {
    hide();
    setError("");
    setModal({ type, data });
  };
  const close = () => {
    setModal(null);
    setError("");
  };
  const toast = (text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => {
    const change = () => {
      setPeek(false);
      setScreen(location.hash.slice(1) || "home");
    };
    window.addEventListener("popstate", change);
    return () => window.removeEventListener("popstate", change);
  }, []);
  useLayoutEffect(() => {
    const conceal = () =>
      flushSync(() => {
        setPeek(false);
        setShield(true);
      });
    const visibility = () => {
      if (document.hidden) conceal();
    };
    window.addEventListener("blur", conceal);
    window.addEventListener("pagehide", conceal);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", conceal);
      window.removeEventListener("pagehide", conceal);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (!room) return;
    setPeek(false);
    setModal(null);
    setScreen("home");
    setShield(false);
    setTabState(room.mode === "taboo" ? "others" : "mine");
    history.replaceState(null, "", `/?room=${room.code}`);
    window.scrollTo({ top: 0 });
  }, [room?.code, room?.status, room?.round]);
  useEffect(() => setPeek(false), [room?.hand?.taboo.guessed]);
  const markDealt = () => {
    saved.set(`dealt:${roundKey}`, "yes");
    setDealt(roundKey);
    setShield(false);
  };
  const markCelebrated = () => {
    hide();
    saved.set(`guessed:${roundKey}`, "yes");
    setCelebrated(roundKey);
    setShield(false);
  };
  const host = room?.hostId === room?.meId;
  let body;
  if (restoring)
    body = (
      <main className="app-shell loading">
        <Logo />
        <h1>回到你的牌桌…</h1>
        <div className="loading-card" />
        <p>正在恢复本局身份</p>
      </main>
    );
  else if (!room)
    body =
      screen === "create" || screen === "join" ? (
        <EntryForm
          key={screen}
          kind={screen}
          code={inviteCode}
          busy={busy}
          error={error}
          back={() => {
            setError("");
            setScreen("home");
            history.replaceState(null, "", "/");
          }}
          enter={async (...args) => {
            if (await enter(...args)) setScreen("home");
          }}
        />
      ) : (
        <Entry navigate={navigate} rules={() => show("rules")} />
      );
  else
    body = (
      <main
        className={`app-shell screen ${room.status === "playing" ? "playing-screen" : ""}`}
      >
        <header className="room-header">
          {room.status === "lobby" && screen !== "home" ? (
            <>
              <button
                className="icon-btn"
                aria-label="返回房间"
                onClick={() => navigate(screen === "submit" ? "pool" : "home")}
              >
                <ChevronLeft />
              </button>
              <strong>{screen === "pool" ? "任务池" : "我的投稿"}</strong>
            </>
          ) : (
            <div className="brand">
              <Logo />
              <div>
                <strong>PartyGame</strong>
                <small>房间 {formatCode(room.code)}</small>
              </div>
            </div>
          )}
          <div className="header-actions">
            {room.status === "playing" && (
              <button
                className="conceal-button"
                onClick={() => {
                  hide();
                  setShield(true);
                }}
              >
                <EyeOff size={17} />
                收起
              </button>
            )}
            <button
              className="icon-btn"
              aria-label="房间菜单"
              onClick={() => show("menu")}
            >
              <MoreHorizontal />
            </button>
          </div>
        </header>
        {!connected && (
          <div className="connection-note" role="status">
            <WifiOff size={16} />
            正在重新连接，身份和任务会保留。
          </div>
        )}
        <Alert text={modal ? "" : error} />
        <div className="view-content" key={`${room.status}:${screen}`}>
          {room.status === "lobby" ? (
            screen === "pool" ? (
              <Pool
                room={room}
                busy={busy}
                act={act}
                navigate={navigate}
                show={show}
                edit={(task) => {
                  navigate("submit");
                  setEditTask(task);
                }}
              />
            ) : screen === "submit" ? (
              <Submit
                key={editTask?.id || "new"}
                room={room}
                task={editTask}
                busy={busy}
                act={act}
                done={() => {
                  navigate("pool");
                  toast("任务已入池，记得重新准备");
                }}
              />
            ) : (
              <Lobby
                room={room}
                busy={busy}
                act={act}
                show={show}
                navigate={navigate}
              />
            )
          ) : room.status === "ended" ? (
            <Recap room={room} act={act} busy={busy} show={show} />
          ) : dealt !== roundKey && !saved.get(`dealt:${roundKey}`) ? (
            <Deal room={room} done={markDealt} />
          ) : room.hand?.taboo.guessed &&
            celebrated !== roundKey &&
            !saved.get(`guessed:${roundKey}`) ? (
            <Celebration room={room} done={markCelebrated} />
          ) : (
            <Playing
              room={room}
              tab={tab}
              setTab={(value) => {
                hide();
                setTabState(value);
                setShield(false);
              }}
              peek={peek}
              reveal={() => setPeek(true)}
              conceal={hide}
              shield={shield}
              unshield={() => setShield(false)}
              guess={(player, item) => show("guess", { player, item })}
              rules={() => show("rules")}
            />
          )}
        </div>
      </main>
    );
  return (
    <>
      {body}
      {!room && !["create", "join"].includes(screen) && error && (
        <div className="floating-error">
          <Alert text={error} />
        </div>
      )}
      {toastText && (
        <div className="toast" role="status">
          <Check size={18} />
          {toastText}
        </div>
      )}
      {modal && (room || modal.type === "rules") && (
        <Modal title={TITLES[modal.type]} close={close} error={error}>
          {modal.type === "rules" && <Rules />}
          {modal.type === "invite" && (
            <Invite room={room} networkUrls={networkUrls} toast={toast} />
          )}
          {modal.type === "menu" && (
            <div className="room-menu">
              <button onClick={() => show("members")}>
                <UsersRound />
                查看玩家
                <ChevronRight />
              </button>
              <button onClick={() => show("rules")}>
                <BookOpen />
                游戏规则
                <ChevronRight />
              </button>
              {room.status === "lobby" && (
                <button onClick={() => show("invite")}>
                  <Share2 />
                  邀请朋友
                  <ChevronRight />
                </button>
              )}
              {room.status === "playing" && host && (
                <button className="end-menu" onClick={() => show("end")}>
                  <LogOut />
                  结束并揭晓
                  <ChevronRight />
                </button>
              )}
              <button onClick={() => show("leave")}>
                <LogOut />
                离开房间
                <ChevronRight />
              </button>
            </div>
          )}
          {modal.type === "settings" && (
            <>
              <ModePicker
                value={room.mode}
                onChange={async (mode) => {
                  if (await act("settings", { mode })) {
                    toast("玩法已更新，请大家重新准备");
                    close();
                  }
                }}
              />
              <p className="form-note">修改玩法后，大家需要重新准备。</p>
            </>
          )}
          {modal.type === "members" && (
            <div className="member-list">
              {room.players.map((p) => (
                <div key={p.id}>
                  <Avatar id={p.avatar} size={50} />
                  <span>
                    <strong>
                      {p.name}
                      {p.id === room.meId ? " · 你" : ""}
                    </strong>
                    <small>
                      {p.id === room.hostId ? "房主 · " : ""}
                      {p.left ? "已离开" : p.online ? "在线" : "暂时离线"}
                    </small>
                  </span>
                  {host && room.status === "lobby" && p.id !== room.meId && (
                    <button
                      className="icon-btn"
                      aria-label={`移除${p.name}`}
                      onClick={() => show("remove", p)}
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {modal.type === "guess" && (
            <div className="confirm-view">
              <Avatar id={modal.data.player.avatar} size={90} />
              <h3>{modal.data.player.name} 的隐藏禁忌</h3>
              <p className="revealed-trigger">
                {modal.data.item.taboo.trigger}
              </p>
              <p>
                确认 TA 已经在现场说中了这个条件。
                <br />
                确认后，这条禁忌就解除了。
              </p>
              <Button
                kind="lime"
                disabled={busy}
                onClick={async () => {
                  if (await act("guess", { playerId: modal.data.player.id })) {
                    close();
                    toast(`${modal.data.player.name} 的禁忌已解除`);
                  }
                }}
              >
                <Check />
                确认猜中
              </Button>
              <Button kind="soft" onClick={close}>
                还没有，继续游戏
              </Button>
            </div>
          )}
          {modal.type === "end" && (
            <div className="confirm-view">
              <Deck mode={room.mode} />
              <p>
                <strong>结束后，所有人的秘密任务和隐藏禁忌都会公开。</strong>
              </p>
              <p>请先和大家确认。</p>
              <Button
                kind="lime"
                disabled={busy}
                onClick={async () => {
                  if (await act("end")) close();
                }}
              >
                结束并揭晓
              </Button>
              <Button kind="soft" onClick={close}>
                继续游戏
              </Button>
            </div>
          )}
          {modal.type === "leave" && (
            <div className="confirm-view">
              <p>
                {host
                  ? "离开后，房主会交给下一位玩家。"
                  : "离开后，当前身份将退出本局。"}
                {room.status === "playing"
                  ? "游戏进行中，离开后需要等下一局再加入。"
                  : ""}
              </p>
              <Button
                disabled={busy}
                onClick={async () => {
                  if (await act("leave")) {
                    close();
                    setScreen("home");
                  }
                }}
              >
                确认离开
              </Button>
              <Button kind="soft" onClick={close}>
                继续留在牌桌
              </Button>
            </div>
          )}
          {modal.type === "deleteTask" && (
            <div className="confirm-view">
              <p>{modal.data.trigger}</p>
              <p>移除后，这道投稿不会参与抽签。</p>
              <Button
                disabled={busy}
                onClick={async () => {
                  if (await act("delete-task", { id: modal.data.id })) {
                    close();
                    toast("已移除这道题");
                  }
                }}
              >
                移除这道题
              </Button>
              <Button kind="soft" onClick={close}>
                保留
              </Button>
            </div>
          )}
          {modal.type === "remove" && (
            <div className="confirm-view">
              <p>将移除 {modal.data.name} 以及 TA 的投稿。大家需要重新准备。</p>
              <Button
                disabled={busy}
                onClick={async () => {
                  if (await act("remove", { playerId: modal.data.id })) close();
                }}
              >
                确认移除
              </Button>
              <Button kind="soft" onClick={close}>
                取消
              </Button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
