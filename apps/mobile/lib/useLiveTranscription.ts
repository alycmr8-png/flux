import { useCallback, useRef, useState } from "react";
import { useAudioStream } from "expo-audio";
import { useAuth } from "@clerk/clerk-expo";
import { LiveTranscriptBuffer, type LiveEntry } from "@sano/shared";
import { API_BASE } from "./apiBase";

const BASE_URL = API_BASE;
const WS_URL = BASE_URL.replace(/^http/, "ws") + "/ws/transcribe";

/**
 * Streams microphone audio to the API's Deepgram relay and exposes the
 * transcript as it arrives. `text` is the settled transcript; `partial` is the
 * words Deepgram is still revising.
 *
 * Students lock the phone or switch apps mid-lecture, so a dropped connection
 * reconnects on its own, and `resume()` restarts the stream if the OS stopped it
 * while the app was in the background.
 *
 * Sentences with spoken maths are typeset by the server a moment after they
 * arrive; `entries` carries each typeset version as soon as it lands.
 */
export function useLiveTranscription() {
  const { getToken } = useAuth();
  const [text, setText] = useState("");
  const [entries, setEntries] = useState<LiveEntry[]>([]);
  const [partial, setPartial] = useState("");
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  // The buffer is the source of truth, so callers reading the transcript right
  // after stop (to upload) get the latest words rather than a stale render.
  const bufferRef = useRef(new LiveTranscriptBuffer());
  const connectionRef = useRef(0);
  // True between start() and stop(); a socket closing while this is set was not asked to.
  const activeRef = useRef(false);
  // Deepgram timestamps restart at zero on every connection, so each one is
  // offset by the lecture time elapsed when it opened (pausing calls stop()).
  const baseOffsetRef = useRef(0);
  const startedAtRef = useRef(0);
  const retryRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; attempt: number }>({ timer: null, attempt: 0 });

  const publish = useCallback(() => {
    setEntries(bufferRef.current.entries());
    setText(bufferRef.current.displayText());
  }, []);

  const { stream } = useAudioStream({
    sampleRate: 16000,
    channels: 1,
    encoding: "int16",
    onBuffer: (buf) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(buf.data);
    },
  });

  const connect = useCallback(async () => {
    if (!activeRef.current) return;
    const token = await getToken();
    if (!token || !activeRef.current) return;

    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;
    const connection = ++connectionRef.current;
    const offset = baseOffsetRef.current + (Date.now() - startedAtRef.current) / 1000;

    // Typeset versions keep arriving on this socket for a few seconds after stop(),
    // so messages are handled by connection rather than by whichever socket is current.
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
        const buffer = bufferRef.current;
        if (msg.type === "ready") { setConnected(true); retryRef.current.attempt = 0; }
        if (msg.type === "transcript") {
          if (msg.isFinal) {
            buffer.addFinal(connection, msg, offset);
            publish();
            setPartial("");
          } else if (wsRef.current === ws) {
            setPartial(msg.text);
          }
        }
        if (msg.type === "typeset") {
          buffer.applyTypeset(connection, msg.id, msg.text ?? null);
          publish();
        }
      } catch { /* ignore non-JSON frames */ }
    };
    ws.onclose = () => {
      bufferRef.current.settle(connection);
      publish();
      if (wsRef.current !== ws) return;
      wsRef.current = null;
      setConnected(false);
      if (!activeRef.current) return;
      const attempt = ++retryRef.current.attempt;
      const delay = Math.min(15000, 1000 * 2 ** Math.min(attempt - 1, 4));
      retryRef.current.timer = setTimeout(() => { connect().catch(() => {}); }, delay);
    };
    ws.onerror = () => { try { ws.close(); } catch { /* already closing */ } };
  }, [getToken, publish]);

  const start = useCallback(async (offsetSec = 0) => {
    // A resume continues the same lecture: keep what's already transcribed and
    // shift new timestamps past the time already recorded.
    baseOffsetRef.current = offsetSec;
    startedAtRef.current = Date.now();
    if (offsetSec === 0) {
      bufferRef.current.clear();
      publish();
    }
    setPartial("");
    activeRef.current = true;
    retryRef.current.attempt = 0;
    await connect();
    await stream.start();
  }, [connect, stream]);

  /** Back in the foreground: reconnect now instead of waiting out the backoff, and restart a stopped stream. */
  const resume = useCallback(async () => {
    if (!activeRef.current) return;
    if (!wsRef.current) {
      if (retryRef.current.timer) clearTimeout(retryRef.current.timer);
      retryRef.current.timer = null;
      await connect();
    }
    if (!stream.isStreaming) await stream.start().catch(() => {});
  }, [connect, stream]);

  const stop = useCallback(() => {
    activeRef.current = false;
    if (retryRef.current.timer) clearTimeout(retryRef.current.timer);
    retryRef.current.timer = null;
    try { stream.stop(); } catch { /* already stopped */ }
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws && ws.readyState === WebSocket.OPEN) {
      // The server flushes Deepgram's closing words and any sentences still being
      // typeset, then closes; this is only a backstop.
      ws.send("stop");
      setTimeout(() => { if (ws.readyState === WebSocket.OPEN) ws.close(); }, 10000);
    }
    setConnected(false);
    setPartial("");
  }, [stream]);

  /** Resolves once no sentence is still waiting for its typeset version (or after `timeoutMs`). */
  const flush = useCallback(async (timeoutMs = 6000) => {
    const deadline = Date.now() + timeoutMs;
    while (bufferRef.current.pendingCount > 0 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 150));
    }
  }, []);

  const fullText = partial ? `${text} ${partial}`.trim() : text;

  const getTranscript = useCallback(() => bufferRef.current.transcript(), []);
  const getSegments = useCallback(() => bufferRef.current.segments(), []);

  return { start, stop, resume, flush, text, entries, partial, fullText, connected, getTranscript, getSegments };
}
