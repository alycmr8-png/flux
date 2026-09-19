"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { LiveTranscriptBuffer, type LiveEntry } from "@sano/shared";
import { apiBase } from "@/lib/apiBase";

const BASE = apiBase();
const WS_URL = BASE.replace(/^http/, "ws") + "/ws/transcribe";
const TARGET_RATE = 16000; // what the relay tells Deepgram to expect

/**
 * Streams microphone audio to the API's Deepgram relay and exposes the
 * transcript as it arrives. `text` is settled; `partial` is still being revised.
 *
 * The browser hands us float32 at the device's sample rate (usually 48 kHz), so
 * each buffer is downsampled and converted to 16-bit PCM before being sent.
 *
 * A lecture runs for an hour or more while the student switches tabs and
 * windows, so a dropped connection reconnects on its own and a suspended audio
 * context is resumed when the page becomes visible again.
 *
 * Sentences with spoken maths are typeset by the server a moment after they
 * arrive; `text` shows each typeset version as soon as it lands.
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
  const offsetRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  // True between start() and stop(); a socket closing while this is set was not asked to.
  const activeRef = useRef(false);
  // Deepgram timestamps restart at zero on every connection, so each one is
  // offset by the lecture time elapsed when it opened (no pauses happen while
  // active — pausing calls stop()).
  const baseOffsetRef = useRef(0);
  const startedAtRef = useRef(0);
  const retryRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; attempt: number }>({ timer: null, attempt: 0 });

  const publish = useCallback(() => {
    setEntries(bufferRef.current.entries());
    setText(bufferRef.current.displayText());
  }, []);

  const connect = useCallback(async (knownToken?: string) => {
    const token = knownToken ?? (await getToken());
    if (!token || !activeRef.current) return;

    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;
    const connection = ++connectionRef.current;
    const offset = baseOffsetRef.current + (Date.now() - startedAtRef.current) / 1000;
    offsetRef.current = offset;

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
      } catch {
        /* non-JSON frames */
      }
    };
    const onDrop = () => {
      bufferRef.current.settle(connection);
      publish();
      if (wsRef.current !== ws) return;
      setConnected(false);
      if (!activeRef.current) return;
      wsRef.current = null;
      const attempt = ++retryRef.current.attempt;
      const delay = Math.min(15000, 1000 * 2 ** Math.min(attempt - 1, 4));
      retryRef.current.timer = setTimeout(() => { connect().catch(() => {}); }, delay);
    };
    ws.onclose = onDrop;
    ws.onerror = () => { try { ws.close(); } catch { /* already closing */ } };
  }, [getToken, publish]);

  // Whether stop() should end the stream's tracks — only when this hook opened them.
  const ownsStreamRef = useRef(true);

  /**
   * Starts streaming. By default it opens the microphone; pass `audio` to
   * transcribe another stream instead — e.g. an online class's tab audio, which
   * the recorder owns and stops itself.
   */
  const start = useCallback(async (offsetSec = 0, audio?: MediaStream) => {
    // A resume continues the same lecture: keep what's already transcribed and
    // shift new timestamps past the time already recorded.
    baseOffsetRef.current = offsetSec;
    startedAtRef.current = Date.now();
    if (offsetSec === 0) {
      bufferRef.current.clear();
      publish();
    }
    setPartial("");

    const token = await getToken();
    if (!token) throw new Error("Not signed in");

    let stream: MediaStream;
    if (audio) {
      stream = audio;
      ownsStreamRef.current = false;
    } else {
      // Browsers only expose the microphone in a secure context, so this is
      // missing entirely over plain http on a LAN address. Fail with something
      // actionable instead of throwing on an undefined property.
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Microphone access needs a secure connection. Open the app at http://localhost:3000 (or over https) to record."
        );
      }
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      ownsStreamRef.current = true;
    }
    streamRef.current = stream;

    activeRef.current = true;
    retryRef.current.attempt = 0;
    await connect(token);

    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const node = ctx.createScriptProcessor(4096, 1, 1);
    nodeRef.current = node;

    const ratio = ctx.sampleRate / TARGET_RATE;
    node.onaudioprocess = (e) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const input = e.inputBuffer.getChannelData(0);
      const outLength = Math.floor(input.length / ratio);
      const pcm = new Int16Array(outLength);
      for (let i = 0; i < outLength; i++) {
        const sample = input[Math.floor(i * ratio)];
        const clamped = Math.max(-1, Math.min(1, sample));
        pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      }
      ws.send(pcm.buffer);
    };

    source.connect(node);
    node.connect(ctx.destination); // required for the processor to run in some browsers
  }, [getToken, connect]);

  const stop = useCallback(() => {
    activeRef.current = false;
    if (retryRef.current.timer) clearTimeout(retryRef.current.timer);
    retryRef.current.timer = null;
    nodeRef.current?.disconnect();
    nodeRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    if (ownsStreamRef.current) streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

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
  }, []);

  /** Resolves once no sentence is still waiting for its typeset version (or after `timeoutMs`). */
  const flush = useCallback(async (timeoutMs = 6000) => {
    const deadline = Date.now() + timeoutMs;
    while (bufferRef.current.pendingCount > 0 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 150));
    }
  }, []);

  // Coming back to the tab: wake a suspended audio context and reconnect straight
  // away rather than waiting out the retry backoff.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !activeRef.current) return;
      if (ctxRef.current?.state === "suspended") ctxRef.current.resume().catch(() => {});
      if (!wsRef.current && retryRef.current.timer) {
        clearTimeout(retryRef.current.timer);
        retryRef.current.timer = null;
        connect().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [connect]);

  const fullText = partial ? `${text} ${partial}`.trim() : text;
  const getTranscript = useCallback(() => bufferRef.current.transcript(), []);
  const getSegments = useCallback(() => bufferRef.current.segments(), []);
  return { start, stop, flush, text, entries, partial, fullText, connected, getTranscript, getSegments };
}
