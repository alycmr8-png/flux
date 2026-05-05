import fs from "fs";
import path from "path";
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

export async function transcribeAudio(filePath: string): Promise<TranscriptionResult> {
  const ext = path.extname(filePath) || ".m4a";
  const mime = ext === ".webm" ? "audio/webm" : "audio/mp4";

  const file = await toFile(fs.createReadStream(filePath), `audio${ext}`, { type: mime });

  const response = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  }) as any;

  return {
    text: response.text ?? "",
    segments: (response.segments ?? []).map((s: any) => ({
      start: s.start,
      end: s.end,
      text: s.text,
    })),
  };
}
