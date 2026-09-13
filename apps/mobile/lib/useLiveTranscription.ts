import { useCallback, useRef, useState } from "react";
import { useAudioStream } from "expo-audio";
import { useAuth } from "@clerk/clerk-expo";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";
const WS_URL = BASE_URL.replace(/^http/, "ws") + "/ws/transcribe";

/**
 * Streams microphone audio to the API's Deepgram relay and exposes the
 * transcript as it arrives. `text` is the settled transcript; `partial` is the
 * words Deepgram is still revising.
 */
export function useLiveTranscription() {
  const { getToken } = useAuth();
  const [text, setText] = useState("");
  const [partial, setPartial] = useState("");
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const { stream } = useAudioStream({
    sampleRate: 16000,
    channels: 1,
    encoding: "int16",
    onBuffer: (buf) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(buf.data);
    },
  });

  const start = useCallback(async () => {
    setText("");
    setPartial("");
    const token = await getToken();
    if (!token) return;

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
      } catch { /* ignore non-JSON frames */ }
    };
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    await stream.start();
  }, [getToken, stream]);

  const stop = useCallback(() => {
    try { stream.stop(); } catch { /* already stopped */ }
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send("stop");
      // Give Deepgram a moment to flush its closing words before hanging up.
      setTimeout(() => ws.close(), 900);
    }
    wsRef.current = null;
    setConnected(false);
  }, [stream]);

  const fullText = partial ? `${text} ${partial}`.trim() : text;

  return { start, stop, text, partial, fullText, connected };
}
