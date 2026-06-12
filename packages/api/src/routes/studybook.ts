import { Router } from "express";
import axios from "axios";
import fs from "fs";
import os from "os";
import path from "path";
import { prisma } from "../lib/prisma";
import { generateStudyBook, condenseTranscript, summarizeTranscript, generateFlashcardsFromTranscript, answerVideoQuestion, generateInlineQuiz, generateKeyPoints } from "../services/claude";
import { transcribeAudio } from "../services/whisper";
import { indexSource } from "../services/memory";

const router = Router();

const ytJobs = new Map<string, { status: "processing" | "ready" | "error"; data?: any; title?: string; lectureId?: string; error?: string }>();

function extractVideoId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([^&?\s/]+)/);
  return m?.[1] ?? null;
}

function parseXmlTranscript(xml: string): string {
  const decode = (s: string) =>
    s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
     .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
     .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
     .replace(/<[^>]+>/g, "");

  const matches = [...xml.matchAll(/<(?:text|p)[^>]+>([\s\S]*?)<\/(?:text|p)>/g)];
  return matches.map(m => decode(m[1]).trim()).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

interface YTTranscript {
  text: string;
  segments: { start: number; end: number; text: string }[];
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer!));
}

async function fetchYouTubeTranscript(videoId: string): Promise<YTTranscript> {
  // Strategy 0: Supadata API — reliable, bypasses Railway IP blocks
  if (process.env.SUPADATA_API_KEY) {
    try {
      const url = `https://api.supadata.ai/v1/youtube/transcript?url=https://www.youtube.com/watch?v=${videoId}&lang=en`;
      const { data } = await axios.get(url, {
        timeout: 15000,
        headers: { "x-api-key": process.env.SUPADATA_API_KEY },
      });
      const items: any[] = data?.content ?? [];
      if (items.length) {
        const segments = items.map((t: any) => ({
          start: (t.offset ?? 0) / 1000,
          end: ((t.offset ?? 0) + (t.duration ?? 5000)) / 1000,
          text: t.text ?? "",
        }));
        const text = segments.map(s => s.text).join(" ").replace(/\s+/g, " ").trim();
        if (text) { console.log(`[studybook] captions via Supadata (${text.length} chars)`); return { text, segments }; }
      }
    } catch (_e) { console.log(`[studybook] Supadata failed: ${(_e as any)?.message}`); }
  }

  // Strategy 1: youtube-transcript package — returns timestamps
  try {
    const { YoutubeTranscript } = await import("youtube-transcript");
    const items = await withTimeout(YoutubeTranscript.fetchTranscript(videoId), 15000, "YouTube transcript fetch");
    if (items.length) {
      const segments = items.map((t: any) => ({
        start: (t.offset ?? 0) / 1000,
        end: ((t.offset ?? 0) + (t.duration ?? 5000)) / 1000,
        text: t.text,
      }));
      const text = segments.map(s => s.text).join(" ").replace(/\s+/g, " ").trim();
      if (text) { console.log(`[studybook] captions via youtube-transcript (${text.length} chars)`); return { text, segments }; }
    }
  } catch (_e) { console.log(`[studybook] youtube-transcript failed: ${(_e as any)?.message}`); }

  // Strategy 1.5: Direct timedtext endpoint (auto-generated captions)
  for (const kind of ["asr", ""]) {
    try {
      const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3${kind ? `&kind=${kind}` : ""}`;
      const { data } = await axios.get(url, { timeout: 8000, headers: { "User-Agent": "Mozilla/5.0" } });
      const events: any[] = data?.events ?? [];
      const text = events.flatMap((e: any) => (e.segs ?? []).map((s: any) => s.utf8 ?? "")).join(" ").replace(/\s+/g, " ").trim();
      if (text) { console.log(`[studybook] captions via timedtext kind=${kind||"manual"} (${text.length} chars)`); return { text, segments: [] }; }
    } catch (_e) {}
  }

  // Strategy 2: InnerTube API — try multiple clients
  const captionClients = [
    { name: "WEB",     version: "2.20240101.00.00", headers: { "Origin": "https://www.youtube.com", "Referer": "https://www.youtube.com/", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } },
    { name: "IOS",     version: "19.09.3",           headers: { "User-Agent": "com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_0 like Mac OS X)" } },
    { name: "ANDROID", version: "20.10.38",           headers: { "User-Agent": "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip" } },
    { name: "TVHTML5", version: "7.20240101.00.00",   headers: { "User-Agent": "Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/538.1" } },
  ];
  for (const client of captionClients) {
    try {
      const { data: player } = await axios.post(
        "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
        { context: { client: { clientName: client.name, clientVersion: client.version, hl: "en", gl: "US" } }, videoId, contentCheckOk: true, racyCheckOk: true },
        { timeout: 6000, headers: { "Content-Type": "application/json", ...client.headers } }
      );
      const tracks: any[] = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
      console.log(`[studybook] InnerTube ${client.name}: ${tracks.length} caption tracks`);
      if (!tracks.length) continue;
      const track = tracks.find((t: any) => t.languageCode === "en") ?? tracks[0];
      const { data: xml } = await axios.get(track.baseUrl, { timeout: 5000, responseType: "text" });
      const text = parseXmlTranscript(xml);
      if (text) { console.log(`[studybook] captions via InnerTube ${client.name} (${text.length} chars)`); return { text, segments: [] }; }
    } catch (_e) { console.log(`[studybook] InnerTube ${client.name} error: ${(_e as any)?.message}`); }
  }

  // Strategy 3: InnerTube IOS/ANDROID — IOS client returns non-ciphered direct audio URLs
  console.log(`[studybook] captions unavailable — trying InnerTube audio for ${videoId}`);
  const audioClients = [
    { clientName: "IOS",     clientVersion: "19.09.3",  ua: "com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_0 like Mac OS X)", extra: { deviceModel: "iPhone14,3", osName: "iPhone", osVersion: "15.0" } },
    { clientName: "ANDROID", clientVersion: "20.10.38", ua: "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip",             extra: { androidSdkVersion: 30 } },
  ];
  for (const client of audioClients) {
    try {
      const { data: player } = await axios.post(
        "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
        { context: { client: { clientName: client.clientName, clientVersion: client.clientVersion, hl: "en", gl: "US", ...client.extra } }, videoId, contentCheckOk: true, racyCheckOk: true },
        { timeout: 8000, headers: { "Content-Type": "application/json", "User-Agent": client.ua } }
      );
      const audioFormats: any[] = (player?.streamingData?.adaptiveFormats ?? [])
        .filter((f: any) => f.mimeType?.startsWith("audio/") && f.url)
        .sort((a: any, b: any) => (a.bitrate ?? 0) - (b.bitrate ?? 0));
      console.log(`[studybook] ${client.clientName} audio formats with direct URL: ${audioFormats.length}`);
      if (!audioFormats.length) continue;
      const tmpFile = path.join(os.tmpdir(), `yt_${videoId}_${Date.now()}.mp4`);
      try {
        const resp = await axios.get(audioFormats[0].url, {
          responseType: "stream",
          timeout: 120000,
          headers: {
            "User-Agent": client.ua,
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
          },
          maxRedirects: 5,
        });
        await new Promise<void>((resolve, reject) => {
          const out = fs.createWriteStream(tmpFile);
          resp.data.pipe(out);
          out.on("finish", resolve);
          out.on("error", reject);
          resp.data.on("error", reject);
        });
        const result = await transcribeAudio(tmpFile);
        if (result.text) return result;
      } finally {
        fs.unlink(tmpFile, () => {});
      }
    } catch (_e) {
      console.log(`[studybook] ${client.clientName} audio failed: ${(_e as any)?.message}`);
    }
  }

  // Strategy 4: ytdl-core audio download as last resort
  console.log(`[studybook] falling back to ytdl-core for ${videoId}`);
  const tmpFile = path.join(os.tmpdir(), `yt_${videoId}_${Date.now()}.mp4`);
  try {
    const ytdl = (await import("@distube/ytdl-core")).default;
    await new Promise<void>((resolve, reject) => {
      let stream: any;
      try {
        stream = ytdl(`https://www.youtube.com/watch?v=${videoId}`, {
          filter: "audioonly",
          quality: "lowestaudio",
        });
      } catch (e) { return reject(e); }
      const out = fs.createWriteStream(tmpFile);
      stream.pipe(out);
      stream.on("error", reject);
      out.on("finish", resolve);
      out.on("error", reject);
    });
    const result = await transcribeAudio(tmpFile);
    return result;
  } catch (e: any) {
    throw new Error(`This video doesn't have captions and audio download is blocked by YouTube on our servers. Please use a video that has auto-generated captions (most YouTube lectures do).`);
  } finally {
    fs.unlink(tmpFile, () => {});
  }
}

async function getVideoTitle(videoId: string): Promise<string> {
  try {
    const { data } = await axios.get(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { timeout: 5000 }
    );
    return (data as any).title ?? "YouTube Video";
  } catch {
    return "YouTube Video";
  }
}

router.get("/recent-videos", async (req, res) => {
  const user = (req as any).user;
  const ytCourse = await prisma.course.findFirst({ where: { userId: user.id, name: "YouTube Videos" } });
  const lectures = await prisma.lecture.findMany({
    where: {
      userId: user.id,
      status: "ready",
      archived: false,
      OR: [
        { audioUrl: { contains: "youtube.com" } },
        { audioUrl: { contains: "youtu.be" } },
        ...(ytCourse ? [{ courseId: ytCourse.id }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  const seen = new Set<string>();
  const data = lectures.map(l => {
    const videoId = l.audioUrl?.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([^&?\s/]+)/)?.[1] ?? null;
    return { lectureId: l.id, courseId: l.courseId, videoId, title: l.title, thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null };
  }).filter(v => {
    const key = v.videoId ?? v.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  res.json({ data });
});

router.get("/list", async (req, res) => {
  const user = (req as any).user;
  const books = await prisma.cheatSheet.findMany({
    where: { userId: user.id, title: { startsWith: "Study Book:" } },
    orderBy: { createdAt: "desc" },
    include: { lecture: { select: { id: true, courseId: true } } },
  });
  res.json({
    data: books.map(b => ({
      id: b.id,
      title: (b.title as string).replace(/^Study Book:\s*/, ""),
      lectureId: b.lectureId,
      courseId: (b.lecture as any)?.courseId ?? null,
      createdAt: b.createdAt,
      chapters: (b.content as any)?.chapters?.length ?? 0,
      flashcards: (b.content as any)?.chapters?.reduce(
        (acc: number, ch: any) => acc + (ch.flashcards?.length ?? 0), 0
      ) ?? 0,
    })),
  });
});

router.get("/job/:jobId", (req, res) => {
  const job = ytJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

router.get("/:lectureId", async (req, res) => {
  const user = (req as any).user;
  const sheet = await prisma.cheatSheet.findFirst({
    where: { lectureId: req.params.lectureId, userId: user.id, title: { startsWith: "Study Book:" } },
  });
  res.json({ data: sheet ? { id: sheet.id, ...sheet.content as object } : null });
});

router.post("/summarize", async (req, res) => {
  const user = (req as any).user;
  const { lectureId } = req.body;
  const lecture = await prisma.lecture.findFirst({ where: { id: lectureId, userId: user.id } });
  if (!lecture?.transcript) return res.status(400).json({ error: "No transcript available." });
  const summary = await summarizeTranscript(lecture.transcript, lecture.title, user.language ?? "en");
  res.json({ data: { summary } });
});

router.post("/flashcards", async (req, res) => {
  const user = (req as any).user;
  const { lectureId } = req.body;
  const lecture = await prisma.lecture.findFirst({ where: { id: lectureId, userId: user.id } });
  if (!lecture?.transcript) return res.status(400).json({ error: "No transcript available." });
  const flashcards = await generateFlashcardsFromTranscript(lecture.transcript, user.language ?? "en");
  res.json({ data: { flashcards } });
});

router.post("/inline-quiz", async (req, res) => {
  const user = (req as any).user;
  const { lectureId } = req.body;
  const lecture = await prisma.lecture.findFirst({ where: { id: lectureId, userId: user.id } });
  if (!lecture?.transcript) return res.status(400).json({ error: "No transcript available." });
  const questions = await generateInlineQuiz(lecture.transcript, user.language ?? "en");
  res.json({ data: { questions } });
});

router.post("/key-points", async (req, res) => {
  const user = (req as any).user;
  const { lectureId } = req.body;
  const lecture = await prisma.lecture.findFirst({ where: { id: lectureId, userId: user.id } });
  if (!lecture?.transcript) return res.status(400).json({ error: "No transcript available." });
  const points = await generateKeyPoints(lecture.transcript, user.language ?? "en");
  res.json({ data: { points } });
});

router.post("/chat", async (req, res) => {
  const user = (req as any).user;
  const { lectureId, messages } = req.body;
  const lecture = await prisma.lecture.findFirst({ where: { id: lectureId, userId: user.id } });
  if (!lecture?.transcript) return res.status(400).json({ error: "No transcript available." });
  const reply = await answerVideoQuestion(lecture.transcript, lecture.title, messages, user.language ?? "en");
  res.json({ data: { reply } });
});

// Fetch transcript only — no AI generation
router.post("/fetch-transcript", async (req, res) => {
  const user = (req as any).user;
  const { url, courseId } = req.body as { url: string; courseId?: string };

  if (!url?.trim()) return res.status(400).json({ error: "YouTube URL is required" });
  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: "Invalid YouTube URL" });

  try {
    const ytAudioUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // ── Check cache first — return immediately if transcript already stored ──
    const existing = await prisma.lecture.findFirst({
      where: { userId: user.id, audioUrl: ytAudioUrl, status: "ready", transcript: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    if (existing?.transcript) {
      console.log(`[fetch-transcript] returning cached transcript for ${videoId}`);
      return res.json({ data: { lectureId: existing.id, title: existing.title, transcript: existing.transcript } });
    }

    // ── Not cached — fetch from YouTube ──
    const { text: transcript, segments } = await fetchYouTubeTranscript(videoId);
    const title = await getVideoTitle(videoId);

    let course: any;
    if (courseId) course = await prisma.course.findFirst({ where: { id: courseId, userId: user.id } });
    if (!course) {
      course = await prisma.course.findFirst({ where: { userId: user.id, name: "YouTube Videos" } });
      if (!course) course = await prisma.course.create({ data: { userId: user.id, name: "YouTube Videos", code: "YT" } });
    }

    let lecture = await prisma.lecture.findFirst({ where: { userId: user.id, courseId: course.id, title } });
    if (!lecture) {
      lecture = await prisma.lecture.create({ data: { userId: user.id, courseId: course.id, title, transcript, status: "ready", audioUrl: ytAudioUrl } });
    } else {
      await prisma.lecture.update({ where: { id: lecture.id }, data: { transcript, status: "ready", audioUrl: ytAudioUrl } });
    }

    // Index into course memory (non-fatal)
    try {
      await indexSource({ userId: user.id, courseId: course.id, sourceType: "video", sourceId: lecture.id, sourceTitle: title, text: transcript, segments });
    } catch (e: any) { console.error("[fetch-transcript] indexing failed:", e?.message); }

    res.json({ data: { lectureId: lecture.id, title, transcript } });
  } catch (err: any) {
    console.error("[fetch-transcript] error:", err?.message ?? err);
    const msg = err?.message ?? "Failed to fetch transcript";
    res.status(500).json({ error: msg });
  }
});

router.post("/generate", async (req, res) => {
  const user = (req as any).user;
  const { lectureId, transcript: transcriptOverride } = req.body as { lectureId: string; transcript?: string };

  const lecture = await prisma.lecture.findFirst({ where: { id: lectureId, userId: user.id } });
  if (!lecture) return res.status(404).json({ error: "Lecture not found" });

  const transcript = transcriptOverride ?? lecture.transcript ?? "";
  if (!transcript) return res.status(400).json({ error: "No transcript available." });

  // Persist edited transcript if provided
  if (transcriptOverride) {
    await prisma.lecture.update({ where: { id: lectureId }, data: { transcript: transcriptOverride } });
  }

  const source = await condenseTranscript(transcript, [], lecture.title, user.language ?? "en");
  const book = await generateStudyBook(source, lecture.title, user.language);

  const existing = await prisma.cheatSheet.findFirst({
    where: { lectureId, userId: user.id, title: { startsWith: "Study Book:" } },
  });

  if (existing) {
    await prisma.cheatSheet.update({ where: { id: existing.id }, data: { content: book } });
  } else {
    await prisma.cheatSheet.create({
      data: { lectureId, userId: user.id, title: `Study Book: ${lecture.title}`, content: book },
    });
  }

  res.json({ data: book });
});

router.post("/generate-from-course", async (req, res) => {
  const user = (req as any).user;
  const { courseId, title, lectureIds, noteIds, notes } = req.body as {
    courseId: string;
    title?: string;
    lectureIds?: string[];
    noteIds?: string[];
    notes?: Array<{ name: string; text: string }>;
  };

  if (!courseId) return res.status(400).json({ error: "courseId is required" });

  const course = await prisma.course.findFirst({ where: { id: courseId, userId: user.id } });
  if (!course) return res.status(404).json({ error: "Course not found" });

  const lectureWhere: any = { courseId, userId: user.id, status: "ready", transcript: { not: null } };
  if (lectureIds?.length) lectureWhere.id = { in: lectureIds };

  const lectures = await prisma.lecture.findMany({
    where: lectureWhere,
    orderBy: { createdAt: "asc" },
  });

  let dbNotes: any[] = [];
  if (noteIds === undefined) {
    // "use all" mode — include every note in the course
    dbNotes = await prisma.note.findMany({ where: { userId: user.id, courseId } });
  } else if (noteIds.length) {
    dbNotes = await prisma.note.findMany({ where: { id: { in: noteIds }, userId: user.id, courseId } });
  }

  const inlineNotes = (notes ?? []).filter((n) => n.text?.trim());

  if (!lectures.length && !dbNotes.length && !inlineNotes.length) {
    return res.status(400).json({ error: "No materials found yet. Record a lecture, upload a file, or save a note first." });
  }

  // Uploaded files — cheat sheets from documents (not Study Books, not lecture cheat sheets)
  const uploadedFileSheets = await prisma.cheatSheet.findMany({
    where: {
      userId: user.id,
      title: { not: { startsWith: "Study Book:" } },
      lecture: { courseId, userId: user.id },
    },
    include: { lecture: { select: { id: true, title: true, audioUrl: true } } },
  });
  // Only keep sheets from uploaded documents (no audioUrl = uploaded file, not recording)
  const docSheets = uploadedFileSheets.filter(
    s => !s.lecture?.audioUrl && !s.title.includes("— Cheat Sheet")
  );

  // ── Separate recordings (long, need condensing) from notes/files (short, keep verbatim) ──
  const transcriptParts: string[] = [];
  const verbatimParts: string[] = [];

  for (const l of lectures) {
    if (l.transcript?.trim()) transcriptParts.push(`[Recording: ${l.title}]\n${l.transcript}`);
  }
  for (const s of docSheets) {
    const c = s.content as any;
    const text = [
      c?.summary ?? "",
      ...(c?.sections ?? []).flatMap((sec: any) => [sec.heading, ...(sec.bullets ?? [])]),
      ...(c?.keyTerms ?? []).map((kt: any) => `${kt.term}: ${kt.definition}`),
    ].filter(Boolean).join("\n");
    if (text.trim()) verbatimParts.push(`[Uploaded file: ${s.title}]\n${text}`);
  }
  // Notes always verbatim — never truncated
  const seenNoteIds = new Set<string>();
  for (const n of dbNotes) {
    if (n.text?.trim()) { seenNoteIds.add(n.id); verbatimParts.push(`[Note: ${n.name}]\n${n.text}`); }
  }
  for (const n of inlineNotes) {
    if (n.text?.trim()) verbatimParts.push(`[Note: ${n.name}]\n${n.text}`);
  }

  if (!transcriptParts.length && !verbatimParts.length) {
    return res.status(400).json({ error: "No content found for this class." });
  }

  const bookTitle = title?.trim() || `${course.name} — Study Book`;
  const jobId = `cb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  ytJobs.set(jobId, { status: "processing" });

  const deadline = setTimeout(() => {
    if (ytJobs.get(jobId)?.status === "processing")
      ytJobs.set(jobId, { status: "error", error: "Generation timed out — please try again." });
  }, 9 * 60 * 1000);

  (async () => {
    try {
      // Condense only the recording transcripts (the long content)
      const transcriptCombined = transcriptParts.join("\n\n---\n\n");
      const condensedTranscripts = transcriptCombined
        ? await condenseTranscript(transcriptCombined, [], bookTitle, user.language ?? "en")
        : "";

      // Notes and files are appended verbatim AFTER condensing — never truncated
      const source = [condensedTranscripts, ...verbatimParts]
        .filter(Boolean)
        .join("\n\n===\n\n")
        .slice(0, 100000);

      const book = await generateStudyBook(source, bookTitle, user.language ?? "en");

      // Need a lectureId — create a placeholder lecture if none exist for this course
      let saveLectureId = lectures[0]?.id;
      if (!saveLectureId) {
        const placeholder = await prisma.lecture.create({
          data: { userId: user.id, courseId, title: bookTitle, transcript: source, status: "ready" },
        });
        saveLectureId = placeholder.id;
      }

      const existingBook = await prisma.cheatSheet.findFirst({
        where: { userId: user.id, title: `Study Book: ${bookTitle}` },
      });
      if (existingBook) {
        await prisma.cheatSheet.update({ where: { id: existingBook.id }, data: { content: book } });
      } else {
        await prisma.cheatSheet.create({
          data: { lectureId: saveLectureId, userId: user.id, title: `Study Book: ${bookTitle}`, content: book },
        });
      }
      ytJobs.set(jobId, { status: "ready", data: book, title: bookTitle });
    } catch (e: any) {
      console.error("[generate-from-course] error:", e?.message);
      ytJobs.set(jobId, { status: "error", error: e?.message ?? "Generation failed — please try again." });
    } finally {
      clearTimeout(deadline);
    }
  })();

  res.json({ jobId });
});

router.post("/from-youtube", async (req, res) => {
  const user = (req as any).user;
  const { url, courseId } = req.body as { url: string; courseId?: string };

  console.log(`[studybook] from-youtube request — url: ${url}`);

  if (!url?.trim()) return res.status(400).json({ error: "YouTube URL is required" });
  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: "Invalid YouTube URL" });
  console.log(`[studybook] videoId: ${videoId}`);

  const jobId = `yt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  ytJobs.set(jobId, { status: "processing" });

  // Hard deadline — fail fast instead of hanging for 10+ minutes
  const deadline = setTimeout(() => {
    const job = ytJobs.get(jobId);
    if (job?.status === "processing") {
      ytJobs.set(jobId, { status: "error", error: "Processing timed out. Please try again." });
    }
  }, 5 * 60 * 1000);

  // Fire and forget — process in background
  (async () => {
    try {
      console.log(`[studybook] fetching transcript for ${videoId}…`);
      const { text: transcript, segments } = await fetchYouTubeTranscript(videoId);
      console.log(`[studybook] transcript fetched — ${transcript.length} chars, ${segments.length} segments`);
      const title = await getVideoTitle(videoId);

      let course: any;
      if (courseId) course = await prisma.course.findFirst({ where: { id: courseId, userId: user.id } });
      if (!course) {
        course = await prisma.course.findFirst({ where: { userId: user.id, name: "YouTube Videos" } });
        if (!course) course = await prisma.course.create({ data: { userId: user.id, name: "YouTube Videos", code: "YT" } });
      }

      const ytAudioUrl = `https://www.youtube.com/watch?v=${videoId}`;
      let lecture = await prisma.lecture.findFirst({ where: { userId: user.id, courseId: course.id, title } });
      if (!lecture) {
        lecture = await prisma.lecture.create({ data: { userId: user.id, courseId: course.id, title, transcript, status: "ready", audioUrl: ytAudioUrl } });
      } else {
        await prisma.lecture.update({ where: { id: lecture.id }, data: { transcript, status: "ready", audioUrl: ytAudioUrl } });
      }

      // Index into course memory (non-fatal)
      try {
        await indexSource({ userId: user.id, courseId: course.id, sourceType: "video", sourceId: lecture.id, sourceTitle: title, text: transcript, segments });
      } catch (e: any) { console.error("[studybook] indexing failed:", e?.message); }

      console.log(`[studybook] condensing transcript…`);
      const source = await condenseTranscript(transcript, segments, title, user.language ?? "en");
      console.log(`[studybook] generating study book (${source.length} chars)…`);
      const book = await generateStudyBook(source, title, user.language);
      console.log(`[studybook] study book generated ✓`);

      const existing = await prisma.cheatSheet.findFirst({
        where: { lectureId: lecture.id, userId: user.id, title: { startsWith: "Study Book:" } },
      });
      if (existing) {
        await prisma.cheatSheet.update({ where: { id: existing.id }, data: { content: book } });
      } else {
        await prisma.cheatSheet.create({ data: { lectureId: lecture.id, userId: user.id, title: `Study Book: ${title}`, content: book } });
      }

      ytJobs.set(jobId, { status: "ready", data: book, title, lectureId: lecture.id });
    } catch (err: any) {
      console.error(`[studybook] job ${jobId} failed:`, err?.message ?? err);
      const isOverloaded = err?.status === 529 || err?.message?.includes("overloaded") || err?.message?.includes("529");
      ytJobs.set(jobId, {
        status: "error",
        error: isOverloaded
          ? "The AI is temporarily busy. Please try again in a minute."
          : err.message ?? "Processing failed",
      });
    } finally {
      clearTimeout(deadline);
    }
  })();

  res.json({ jobId });
});

export { router as studyBookRouter };
