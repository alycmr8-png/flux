import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import OpenAI, { toFile } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptSegment[];
}

// OpenAI's Whisper API rejects files over 25 MB. Real college lectures
// (50–75+ min) easily exceed that, so oversized files are split into
// ~10-minute chunks, transcribed sequentially, and stitched back together
// with timestamps offset so citations stay accurate.
const MAX_SINGLE_BYTES = 20 * 1024 * 1024; // safety margin under the 25 MB cap
const CHUNK_SECONDS = 600;

async function transcribeOne(filePath: string, prompt?: string): Promise<TranscriptionResult> {
  const ext = path.extname(filePath) || ".m4a";
  const mime = ext === ".webm" ? "audio/webm" : ext === ".mp3" ? "audio/mpeg" : "audio/mp4";

  const file = await toFile(fs.createReadStream(filePath), `audio${ext}`, { type: mime });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5 * 60 * 1000);

  let response: any;
  try {
    response = await openai.audio.transcriptions.create(
      {
        file,
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
        ...(prompt ? { prompt } : {}),
      },
      { signal: controller.signal }
    ) as any;
  } finally {
    clearTimeout(timer);
  }

  return {
    text: response.text ?? "",
    segments: (response.segments ?? []).map((s: any) => ({
      start: s.start,
      end: s.end,
      text: s.text,
    })),
  };
}

function chunkDurationSec(filePath: string): number {
  const probe = spawnSync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath,
  ], { encoding: "utf8" });
  const d = parseFloat((probe.stdout || "").trim());
  return Number.isFinite(d) ? d : CHUNK_SECONDS;
}

export async function transcribeAudio(filePath: string): Promise<TranscriptionResult> {
  const size = fs.statSync(filePath).size;
  if (size <= MAX_SINGLE_BYTES) {
    return transcribeOne(filePath);
  }

  console.log(`[whisper] ${Math.round(size / 1024 / 1024)}MB recording — chunking for transcription`);

  // Re-encode to compact mono mp3 while splitting into 10-minute chunks.
  // (Re-encoding makes chunk sizes predictable and is what Whisper hears anyway.)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flux-whisper-"));
  const pattern = path.join(dir, "chunk-%03d.mp3");
  const ff = spawnSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error",
    "-i", filePath,
    "-ac", "1", "-ar", "16000", "-b:a", "48k",
    "-f", "segment", "-segment_time", String(CHUNK_SECONDS),
    pattern,
  ], { encoding: "utf8" });

  const chunks = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(f => f.startsWith("chunk-")).sort().map(f => path.join(dir, f))
    : [];

  if (ff.error || !chunks.length) {
    fs.rmSync(dir, { recursive: true, force: true });
    const reason = (ff.error as any)?.code === "ENOENT"
      ? "ffmpeg is not installed on this server"
      : `ffmpeg failed: ${ff.stderr?.slice(0, 200) || "unknown error"}`;
    throw new Error(`This recording is too large to transcribe in one pass and chunking failed (${reason}).`);
  }

  try {
    const allSegments: TranscriptSegment[] = [];
    const allText: string[] = [];
    let offset = 0;
    let prevTail = "";

    for (const chunk of chunks) {
      const result = await transcribeOne(chunk, prevTail || undefined);
      for (const s of result.segments) {
        allSegments.push({ start: s.start + offset, end: s.end + offset, text: s.text });
      }
      allText.push(result.text.trim());
      prevTail = result.text.slice(-200); // context so sentences continue cleanly across cuts
      offset += chunkDurationSec(chunk);
    }

    console.log(`[whisper] chunked transcription done — ${chunks.length} chunks, ${allSegments.length} segments`);
    return { text: allText.filter(Boolean).join(" "), segments: allSegments };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
