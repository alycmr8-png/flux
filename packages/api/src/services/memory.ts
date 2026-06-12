import OpenAI from "openai";
import { prisma } from "../lib/prisma";

let _openai: OpenAI | null = null;
function getClient() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60000 });
  return _openai;
}

export interface ChunkMeta {
  startSec?: number;
  endSec?: number;
}

export interface SourceInput {
  userId: string;
  courseId: string;
  sourceType: "lecture" | "video" | "file" | "note";
  sourceId: string;
  sourceTitle: string;
  text?: string;
  segments?: { start: number; end: number; text: string }[];
}

export interface RetrievedChunk {
  id: string;
  sourceType: string;
  sourceId: string;
  sourceTitle: string;
  content: string;
  meta: ChunkMeta | null;
  score: number;
}

// ─── Chunking ────────────────────────────────────────────────────────────────

const TARGET_CHARS = 1100;
const OVERLAP_CHARS = 150;

/** Sentence-aware splitter for plain text (no timestamps). */
export function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= TARGET_CHARS) return [clean];

  const sentences = clean.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [clean];
  const chunks: string[] = [];
  let current = "";

  for (const s of sentences) {
    if (current.length + s.length > TARGET_CHARS && current) {
      chunks.push(current.trim());
      current = current.slice(-OVERLAP_CHARS) + s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/** Groups timestamped segments into ~75-second windows, keeping start/end times. */
export function chunkSegments(
  segments: { start: number; end: number; text: string }[]
): { content: string; meta: ChunkMeta }[] {
  const WINDOW_SEC = 75;
  const chunks: { content: string; meta: ChunkMeta }[] = [];
  let buf: string[] = [];
  let startSec = segments[0]?.start ?? 0;
  let endSec = startSec;

  for (const seg of segments) {
    buf.push(seg.text.trim());
    endSec = seg.end;
    if (endSec - startSec >= WINDOW_SEC || buf.join(" ").length > TARGET_CHARS * 1.5) {
      const content = buf.join(" ").replace(/\s+/g, " ").trim();
      if (content) chunks.push({ content, meta: { startSec: Math.floor(startSec), endSec: Math.ceil(endSec) } });
      buf = [];
      startSec = seg.end;
    }
  }
  const rest = buf.join(" ").replace(/\s+/g, " ").trim();
  if (rest) chunks.push({ content: rest, meta: { startSec: Math.floor(startSec), endSec: Math.ceil(endSec) } });
  return chunks;
}

// ─── Embeddings ──────────────────────────────────────────────────────────────

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const BATCH = 100;
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH).map(t => t.slice(0, 8000));
    const res = await getClient().embeddings.create({ model: "text-embedding-3-small", input: batch });
    out.push(...res.data.map(d => d.embedding));
  }
  return out;
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

// ─── Indexing ────────────────────────────────────────────────────────────────

/** Re-indexes one source: deletes old chunks, chunks + embeds + saves the new content. */
export async function indexSource(input: SourceInput): Promise<number> {
  const pieces: { content: string; meta: ChunkMeta | null }[] =
    input.segments?.length
      ? chunkSegments(input.segments)
      : chunkText(input.text ?? "").map(c => ({ content: c, meta: null }));

  await prisma.memoryChunk.deleteMany({ where: { sourceId: input.sourceId, userId: input.userId } });
  if (!pieces.length) return 0;

  const embeddings = await embedTexts(pieces.map(p => p.content));

  await prisma.memoryChunk.createMany({
    data: pieces.map((p, i) => ({
      userId: input.userId,
      courseId: input.courseId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceTitle: input.sourceTitle,
      content: p.content,
      meta: (p.meta ?? undefined) as any,
      embedding: embeddings[i] as any,
    })),
  });
  return pieces.length;
}

export async function deleteSource(sourceId: string, userId: string) {
  await prisma.memoryChunk.deleteMany({ where: { sourceId, userId } });
}

// ─── Retrieval ───────────────────────────────────────────────────────────────

export async function searchCourse(
  userId: string,
  courseId: string,
  query: string,
  k = 8
): Promise<RetrievedChunk[]> {
  const [queryEmbedding] = await embedTexts([query]);
  const chunks = await prisma.memoryChunk.findMany({
    where: { userId, courseId },
    select: { id: true, sourceType: true, sourceId: true, sourceTitle: true, content: true, meta: true, embedding: true },
  });

  return chunks
    .map(c => ({
      id: c.id,
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      sourceTitle: c.sourceTitle,
      content: c.content,
      meta: c.meta as ChunkMeta | null,
      score: cosineSim(queryEmbedding, c.embedding as unknown as number[]),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export async function courseMemoryStatus(userId: string, courseId: string) {
  const chunks = await prisma.memoryChunk.groupBy({
    by: ["sourceType"],
    where: { userId, courseId },
    _count: { id: true },
  });
  const sources = await prisma.memoryChunk.findMany({
    where: { userId, courseId },
    distinct: ["sourceId"],
    select: { sourceId: true, sourceType: true, sourceTitle: true },
  });
  return {
    chunkCount: chunks.reduce((acc, c) => acc + c._count.id, 0),
    byType: Object.fromEntries(chunks.map(c => [c.sourceType, c._count.id])),
    sources,
  };
}
