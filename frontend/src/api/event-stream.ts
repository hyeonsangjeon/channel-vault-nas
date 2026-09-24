import type { ArchiveEvent } from "./channels";

type StreamStatus = "connecting" | "live" | "error" | "closed";

type EventStreamOptions = {
  url: () => string;
  onEvent: (event: ArchiveEvent) => void;
  onStatus: (status: StreamStatus) => void;
  onAuthRequired: () => void;
  onReconnect: () => void;
};

export function connectArchiveEvents(options: EventStreamOptions): () => void {
  let socket: WebSocket | null = null;
  let retryTimer: number | null = null;
  let retryDelay = 500;
  let stopped = false;
  let authBlocked = false;
  let connectedBefore = false;

  function clearRetry() {
    if (retryTimer !== null) window.clearTimeout(retryTimer);
    retryTimer = null;
  }

  function connect() {
    if (stopped || authBlocked) return;
    clearRetry();
    const connection = new WebSocket(options.url());
    socket = connection;
    options.onStatus("connecting");
    connection.onopen = () => {
      if (stopped || socket !== connection) return;
      retryDelay = 500;
      options.onStatus("live");
      if (connectedBefore) options.onReconnect();
      connectedBefore = true;
    };
    connection.onmessage = (message) => {
      if (stopped || socket !== connection) return;
      try {
        options.onEvent(JSON.parse(message.data) as ArchiveEvent);
      } catch {
        return;
      }
    };
    connection.onerror = () => {
      if (!stopped && socket === connection) options.onStatus("error");
    };
    connection.onclose = (event) => {
      if (stopped || socket !== connection) return;
      options.onStatus("closed");
      if (event.code === 1008) {
        authBlocked = true;
        options.onAuthRequired();
        return;
      }
      retryTimer = window.setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 10_000);
    };
  }

  function reconnectWhenAvailable() {
    if (document.visibilityState === "hidden" || stopped || authBlocked) return;
    if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
    connect();
  }

  window.addEventListener("online", reconnectWhenAvailable);
  document.addEventListener("visibilitychange", reconnectWhenAvailable);
  connect();

  return () => {
    stopped = true;
    clearRetry();
    window.removeEventListener("online", reconnectWhenAvailable);
    document.removeEventListener("visibilitychange", reconnectWhenAvailable);
    socket?.close();
  };
}
