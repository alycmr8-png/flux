import { AsyncLocalStorage } from "node:async_hooks";

/**
 * What each processed lecture and each question actually costs in model spend.
 *
 * Unit cost decides whether a plan price works, and guessing it from the prompts
 * is unreliable — the generators retry, fall back to a cheaper model, and chunk
 * differently per transcript length. So every model call reports its real token
 * usage here, and the totals are attributed to whatever job is running.
 *
 * Rates are USD per million tokens, and they change: override any of them with
 * MODEL_PRICES_JSON (e.g. '{"gpt-4o":{"in":2.5,"out":10}}') rather than editing
 * this table on a deploy.
 */
type Rate = { in: number; out: number };

const DEFAULT_RATES: Record<string, Rate> = {
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "text-embedding-3-small": { in: 0.02, out: 0 },
};

const RATES: Record<string, Rate> = (() => {
  try {
    return { ...DEFAULT_RATES, ...JSON.parse(process.env.MODEL_PRICES_JSON ?? "{}") };
  } catch {
    console.warn("[cost] MODEL_PRICES_JSON is not valid JSON — using built-in rates");
    return DEFAULT_RATES;
  }
})();

/** Deepgram streaming, USD per minute of audio — the largest single cost per lecture. */
const DEEPGRAM_PER_MIN = Number(process.env.DEEPGRAM_PRICE_PER_MIN ?? 0.0059);
/** Whisper fallback, USD per minute. */
const WHISPER_PER_MIN = Number(process.env.WHISPER_PRICE_PER_MIN ?? 0.006);

export type Tally = {
  label: string;
  usd: number;
  calls: number;
  /** Spend per operation, so the expensive step in a job is obvious. */
  byOp: Record<string, { usd: number; calls: number }>;
};

const store = new AsyncLocalStorage<Tally>();

function add(tally: Tally, op: string, usd: number) {
  tally.usd += usd;
  tally.calls += 1;
  const row = (tally.byOp[op] ??= { usd: 0, calls: 0 });
  row.usd += usd;
  row.calls += 1;
}

/** Cost of one chat completion, from the usage block the API returns. */
export function priceCall(model: string, usage: { prompt_tokens?: number; completion_tokens?: number } | undefined): number {
  const rate = RATES[model] ?? RATES[model?.replace(/-\d{4}-\d{2}-\d{2}$/, "")] ?? null;
  if (!rate || !usage) return 0;
  return ((usage.prompt_tokens ?? 0) * rate.in + (usage.completion_tokens ?? 0) * rate.out) / 1_000_000;
}

/** Called by every model wrapper; a no-op outside a cost scope. */
export function recordCall(op: string, model: string, usage: any): void {
  const tally = store.getStore();
  if (!tally) return;
  add(tally, `${op} (${model})`, priceCall(model, usage));
}

/** Transcription is billed per minute of audio, not per token. */
export function recordAudioMinutes(provider: "deepgram" | "whisper", minutes: number): void {
  const tally = store.getStore();
  if (!tally) return;
  const perMin = provider === "deepgram" ? DEEPGRAM_PER_MIN : WHISPER_PER_MIN;
  add(tally, provider, Math.max(0, minutes) * perMin);
}

/**
 * Runs a job with its own cost tally and logs the breakdown when it finishes.
 * The tally is returned alongside the result so callers can store or bill it.
 */
export async function withCostScope<T>(label: string, fn: () => Promise<T>): Promise<{ result: T; tally: Tally }> {
  const tally: Tally = { label, usd: 0, calls: 0, byOp: {} };
  const result = await store.run(tally, fn);
  logTally(tally);
  return { result, tally };
}

export function logTally(tally: Tally): void {
  const breakdown = Object.entries(tally.byOp)
    .sort((a, b) => b[1].usd - a[1].usd)
    .map(([op, r]) => `${op} $${r.usd.toFixed(4)}${r.calls > 1 ? `×${r.calls}` : ""}`)
    .join("  ");
  console.log(`[cost] ${tally.label} — $${tally.usd.toFixed(4)} over ${tally.calls} calls | ${breakdown}`);
}
