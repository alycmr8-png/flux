// Relays microphone audio from the app to Deepgram and streams transcripts back.
//
// The audio is proxied rather than letting the client talk to Deepgram directly:
// DEEPGRAM_API_KEY never leaves the server, and every stream is tied to a verified
// Clerk session.
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { verifyToken } from "@clerk/backend";
import { looksLikeSpokenMath, typesetSpokenMath } from "../services/claude";

// Typesetting runs alongside the stream; a few at a time keeps a burst of maths
// from queueing behind itself without flooding the model.
const TYPESET_CONCURRENCY = 4;
// After the student stops, wait this long at most for sentences still being typeset.
const TYPESET_DRAIN_MS = 8000;

const DG_URL =
  "wss://api.deepgram.com/v1/listen" +
  "?model=nova-3" +
  "&encoding=linear16" +
  "&sample_rate=16000" +
  "&channels=1" +
  "&interim_results=true" +
  "&punctuate=true" +
  "&smart_format=true" +
  "&endpointing=300";

export function attachLiveTranscribe(server: Server) {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) {
    console.warn("[live] DEEPGRAM_API_KEY not set — live transcription disabled");
    return;
  }

  const wss = new WebSocketServer({ server, path: "/ws/transcribe" });

  wss.on("connection", async (client, req) => {
    const token = new URL(req.url ?? "", "http://x").searchParams.get("token");
    if (!token) return client.close(4001, "Missing token");
    try {
      await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY! });
    } catch {
      return client.close(4001, "Invalid session");
    }

    const dg = new WebSocket(DG_URL, { headers: { Authorization: `Token ${key}` } });
    // Audio that arrives before Deepgram is ready would otherwise be dropped.
    const pending: Buffer[] = [];
    let dgReady = false;

    // Finished sentences are numbered so a typeset version can replace its original.
    let nextId = 0;
    let previousFinal = "";
    let inFlight = 0;
    const queue: { id: number; text: string; previous: string }[] = [];
    let dgClosed = false;

    const send = (payload: object) => {
      if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(payload));
    };
    const closeWhenDrained = () => {
      if (dgClosed && inFlight === 0 && queue.length === 0 && client.readyState === WebSocket.OPEN) client.close();
    };
    const pump = () => {
      while (inFlight < TYPESET_CONCURRENCY && queue.length) {
        const job = queue.shift()!;
        inFlight++;
        typesetSpokenMath(job.text, job.previous)
          // Always answer, so the client knows the sentence is settled either way.
          .then(text => send({ type: "typeset", id: job.id, text: text ?? null }))
          .catch(() => send({ type: "typeset", id: job.id, text: null }))
          .finally(() => { inFlight--; pump(); closeWhenDrained(); });
      }
    };

    dg.on("open", () => {
      dgReady = true;
      for (const buf of pending) dg.send(buf);
      pending.length = 0;
      client.send(JSON.stringify({ type: "ready" }));
    });

    dg.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const alt = msg?.channel?.alternatives?.[0];
        if (!alt?.transcript) return;
        const isFinal = !!msg.is_final;
        const id = isFinal ? nextId++ : undefined;
        const math = isFinal && looksLikeSpokenMath(alt.transcript);
        if (math) {
          queue.push({ id: id!, text: alt.transcript, previous: previousFinal });
          pump();
        }
        if (isFinal) previousFinal = alt.transcript;
        send({
          type: "transcript",
          text: alt.transcript,
          isFinal,
          id,
          // A typeset version of this sentence will follow.
          math,
          // Seconds from the start of this stream; the client offsets them by
          // time already recorded so pause/resume doesn't reset the clock.
          start: typeof msg.start === "number" ? msg.start : undefined,
          duration: typeof msg.duration === "number" ? msg.duration : undefined,
        });
      } catch { /* keepalives and metadata frames */ }
    });

    dg.on("error", (err) => {
      client.send(JSON.stringify({ type: "error", message: err.message }));
      client.close();
    });
    dg.on("close", () => {
      dgClosed = true;
      closeWhenDrained();
      setTimeout(() => { if (client.readyState === WebSocket.OPEN) client.close(); }, TYPESET_DRAIN_MS);
    });

    client.on("message", (data, isBinary) => {
      if (!isBinary) {
        // A "stop" tells Deepgram to flush its final words before closing.
        if (data.toString() === "stop" && dgReady) dg.send(JSON.stringify({ type: "CloseStream" }));
        return;
      }
      const buf = data as Buffer;
      if (dgReady) dg.send(buf);
      else if (pending.length < 200) pending.push(buf);
    });

    client.on("close", () => {
      queue.length = 0;
      if (dg.readyState === WebSocket.OPEN || dg.readyState === WebSocket.CONNECTING) dg.close();
    });
  });

  console.log("[live] transcription relay listening on /ws/transcribe");
}
