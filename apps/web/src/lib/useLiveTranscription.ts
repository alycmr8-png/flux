"use client";
import { useCallback, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const WS_URL = BASE.replace(/^http/, "ws") + "/ws/transcribe";
const TARGET_RATE = 16000; // what the relay tells Deepgram to expect

/**
 * Streams microphone audio to the API's Deepgram relay and exposes the
 * transcript as it arrives. `text` is settled; `partial` is still being revised.
 *
 * The browser hands us float32 at the device's sample rate (usually 48 kHz), so
 * each buffer is downsampled and converted to 16-bit PCM before being sent.
 */
export function useLiveTranscription() {
  const { getToken } = useAuth();
  const [text, setText] = useState("");
  const [partial, setPartial] = useState("");
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);

  const start = useCallback(async () => {
    setText("");
    setPartial("");

    const token = await getToken();
    if (!token) throw new Error("Not signed in");

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    streamRef.current = stream;

    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
        if (msg.type === "ready") setConnected(true);
        if (msg.type === "transcript") {
          if (msg.isFinal) {
            setText((t) => (t ? `${t} ${msg.text}` : msg.text));
            setPartial("");
          } else {
            setPartial(msg.text);
          }
        }
      } catch {
        /* non-JSON frames */
      }
    };
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const node = ctx.createScriptProcessor(4096, 1, 1);
    nodeRef.current = node;

    const ratio = ctx.sampleRate / TARGET_RATE;
    node.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN) return;
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
  }, [getToken]);

  const stop = useCallback(() => {
    nodeRef.current?.disconnect();
    nodeRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send("stop");
      setTimeout(() => ws.close(), 900); // let Deepgram flush its closing words
    }
    wsRef.current = null;
    setConnected(false);
  }, []);

  const fullText = partial ? `${text} ${partial}`.trim() : text;
  return { start, stop, text, partial, fullText, connected };
}
