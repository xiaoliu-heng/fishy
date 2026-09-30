import { useCallback, useEffect, useState } from "react";

export const saved = {
  get(key, fallback = "") {
    try {
      return localStorage.getItem(`party:${key}`) || fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`party:${key}`, value);
    } catch {
      /* Browser privacy mode can disable storage. */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(`party:${key}`);
    } catch {
      /* The current room remains usable. */
    }
  },
};

async function request(path, data) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: "same-origin",
      headers: data === undefined ? {} : { "Content-Type": "application/json" },
      method: data === undefined ? "GET" : "POST",
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error("暂时连接不上，请确认手机与房主在同一 Wi-Fi，然后重试。");
  }
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || "操作没有成功，请再试一次。");
    error.status = response.status;
    throw error;
  }
  return result;
}

export function useGame() {
  const initialCode =
    new URLSearchParams(location.search).get("room") || saved.get("room");
  const [room, setRoom] = useState(null),
    [restoring, setRestoring] = useState(!!initialCode);
  const [connected, setConnected] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [inviteCode, setInviteCode] = useState(initialCode),
    [networkUrls, setNetworkUrls] = useState([]);
  useEffect(() => {
    let active = true;
    request("/network")
      .then((v) => active && setNetworkUrls(v.urls))
      .catch(() => {});
    if (initialCode)
      request(`/rooms/${initialCode}`)
        .then((r) => {
          if (active) setRoom(r);
        })
        .catch((e) => {
          if (!active) return;
          if ([401, 404].includes(e.status)) saved.remove("room");
          else setError(e.message);
        })
        .finally(() => active && setRestoring(false));
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!room?.code) return;
    let active = true;
    const source = new EventSource(`/api/rooms/${room.code}/events`);
    source.onopen = () => active && setConnected(true);
    source.onmessage = (event) => {
      if (!active) return;
      setConnected(true);
      setRoom(JSON.parse(event.data));
    };
    source.addEventListener("removed", () => {
      if (!active) return;
      saved.remove("room");
      setRoom(null);
      setError("你已离开这个房间，可以重新加入。");
      source.close();
    });
    source.onerror = () => {
      if (!active) return;
      setConnected(false);
      request(`/rooms/${room.code}`).catch((e) => {
        if (active && [401, 404].includes(e.status)) {
          source.close();
          saved.remove("room");
          setRoom(null);
          setError(e.message);
        }
      });
    };
    const online = () =>
      request(`/rooms/${room.code}`)
        .then((r) => active && setRoom(r))
        .catch(() => {});
    const offline = () => setConnected(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      active = false;
      source.close();
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [room?.code]);
  const enter = async (kind, data) => {
    setBusy(true);
    setError("");
    try {
      const result = await request(
        kind === "create" ? "/rooms" : `/rooms/${data.code}/join`,
        data,
      );
      saved.set("room", result.code);
      saved.set("name", data.name);
      saved.set("avatar", String(data.avatar));
      setInviteCode(result.code);
      setRoom(result);
      history.replaceState(null, "", `/?room=${result.code}`);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const act = useCallback(
    async (action, data = {}) => {
      if (!room) return false;
      setBusy(true);
      setError("");
      try {
        const result = await request(`/rooms/${room.code}/${action}`, data);
        if (action === "leave") {
          saved.remove("room");
          setRoom(null);
          setInviteCode("");
          history.replaceState(null, "", "/");
        } else setRoom(result);
        return true;
      } catch (e) {
        setError(e.message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [room?.code],
  );
  return {
    room,
    restoring,
    connected,
    busy,
    error,
    setError,
    enter,
    act,
    inviteCode,
    networkUrls,
  };
}
