// The live transcript arrives one finished sentence at a time. A sentence with
// spoken maths is sent twice: first as the words speech recognition heard, then
// — about a second later — rewritten with its maths typeset in LaTeX, the same
// style the lecture notes use. This buffer keeps sentences in order, swaps each
// typeset version in when it lands, and is shared by the web and mobile apps so
// both show and upload exactly the same text.
import { toMathNotation } from "./mathText";

type Final = {
  key: string;
  raw: string;
  typeset?: string;
  /** Flagged as maths by the server. */
  math: boolean;
  /** Waiting for its typeset version. */
  pending: boolean;
  start?: number;
  end?: number;
};

export type LiveEntry = { key: string; text: string; math: boolean; pending: boolean };

export class LiveTranscriptBuffer {
  private finals: Final[] = [];
  private byKey = new Map<string, Final>();

  clear() {
    this.finals = [];
    this.byKey.clear();
  }

  /** A finished sentence. `connection` distinguishes ids from separate streams (pause/resume, reconnects). */
  addFinal(connection: number, msg: { id?: number; text: string; math?: boolean; start?: number; duration?: number }, offsetSec: number) {
    const key = `${connection}:${msg.id ?? this.finals.length}`;
    const final: Final = { key, raw: msg.text, math: !!msg.math, pending: !!msg.math };
    if (typeof msg.start === "number") {
      final.start = offsetSec + msg.start;
      final.end = final.start + (msg.duration ?? 0);
    }
    this.finals.push(final);
    this.byKey.set(key, final);
  }

  /** The typeset version of a sentence, or null when the words as heard should stay. */
  applyTypeset(connection: number, id: number, text: string | null) {
    const final = this.byKey.get(`${connection}:${id}`);
    if (!final) return;
    if (text) final.typeset = text;
    final.pending = false;
  }

  /** A stream closed: anything still waiting on it will not arrive. */
  settle(connection: number) {
    for (const final of this.finals) {
      if (final.pending && final.key.startsWith(`${connection}:`)) final.pending = false;
    }
  }

  get pendingCount() {
    return this.finals.reduce((n, f) => n + (f.pending ? 1 : 0), 0);
  }

  /** What to show: typeset sentences, with a quick symbol conversion for those still on their way. */
  entries(): LiveEntry[] {
    return this.finals.map(f => {
      const text = f.typeset ?? (f.math ? toMathNotation(f.raw) : f.raw);
      return { key: f.key, text, math: text.includes("$"), pending: f.pending };
    });
  }

  displayText() {
    return this.entries().map(e => e.text).join(" ");
  }

  /** What to upload: typeset where available, otherwise the words as heard. */
  transcript() {
    return this.finals.map(f => f.typeset ?? f.raw).join(" ");
  }

  segments(): { start: number; end: number; text: string }[] {
    return this.finals
      .filter(f => typeof f.start === "number")
      .map(f => ({ start: f.start!, end: f.end!, text: f.typeset ?? f.raw }));
  }
}
