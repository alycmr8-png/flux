import { prisma } from "../lib/prisma";
import { indexSource, stripHtml } from "./memory";

const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (buf: Buffer) => Promise<{ text: string }>;

// Per-course caps keep a first sync fast and the OpenAI embedding bill sane.
const MAX_FILES_PER_COURSE = 15;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export type SyncResult = {
  coursesCreated: number;
  coursesMatched: number;
  filesIndexed: number;
  filesSkipped: number;
  syllabiIndexed: number;
  eventsCreated: number;
  errors: string[];
};

// One sync at a time per user; the status route reads this map.
const syncing = new Map<string, { startedAt: number }>();
export function isSyncing(userId: string) {
  return syncing.has(userId);
}

export function normalizeBaseUrl(input: string): string | null {
  let raw = input.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    const u = new URL(raw);
    if (!u.hostname.includes(".")) return null;
    return `https://${u.hostname}`;
  } catch {
    return null;
  }
}

async function canvasGet(baseUrl: string, token: string, path: string): Promise<any> {
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Canvas ${res.status} on ${path}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export async function validateCanvas(baseUrl: string, token: string): Promise<{ name: string }> {
  const me = await canvasGet(baseUrl, token, "/users/self");
  return { name: me?.name ?? "Canvas user" };
}

async function alreadyIndexed(userId: string, sourceId: string): Promise<boolean> {
  const hit = await prisma.memoryChunk.findFirst({ where: { userId, sourceId }, select: { id: true } });
  return !!hit;
}

export async function runCanvasSync(userId: string): Promise<SyncResult> {
  const result: SyncResult = {
    coursesCreated: 0, coursesMatched: 0, filesIndexed: 0, filesSkipped: 0,
    syllabiIndexed: 0, eventsCreated: 0, errors: [],
  };
  if (syncing.has(userId)) return result;
  syncing.set(userId, { startedAt: Date.now() });

  try {
    const conn = await prisma.canvasConnection.findUnique({ where: { userId } });
    if (!conn) throw new Error("Not connected");
    const { baseUrl, token } = conn;

    const canvasCourses: any[] = await canvasGet(
      baseUrl, token,
      "/courses?enrollment_state=active&include[]=syllabus_body&per_page=50"
    );

    for (const cc of canvasCourses) {
      if (!cc?.id || !cc?.name) continue;
      const canvasCourseId = String(cc.id);

      try {
        // Match by canvas id first, then by identical name (user may have made it by hand)
        let course = await prisma.course.findFirst({ where: { userId, canvasCourseId } });
        if (!course) {
          course = await prisma.course.findFirst({
            where: { userId, name: { equals: cc.name, mode: "insensitive" } },
          });
          if (course) {
            course = await prisma.course.update({ where: { id: course.id }, data: { canvasCourseId } });
            result.coursesMatched++;
          }
        } else {
          result.coursesMatched++;
        }
        if (!course) {
          course = await prisma.course.create({
            data: { userId, name: cc.name, code: cc.course_code ?? "", canvasCourseId },
          });
          result.coursesCreated++;
        }

        // ── Syllabus ──
        const syllabusText = stripHtml(cc.syllabus_body ?? "").trim();
        const syllabusSourceId = `canvas_syllabus_${canvasCourseId}`;
        if (syllabusText.length > 80 && !(await alreadyIndexed(userId, syllabusSourceId))) {
          await indexSource({
            userId, courseId: course.id, sourceType: "file",
            sourceId: syllabusSourceId, sourceTitle: `Syllabus — ${cc.name}`,
            text: syllabusText,
          });
          result.syllabiIndexed++;
        }

        // ── Files (PDFs) ──
        let files: any[] = [];
        try {
          files = await canvasGet(
            baseUrl, token,
            `/courses/${canvasCourseId}/files?content_types[]=application/pdf&sort=created_at&order=desc&per_page=${MAX_FILES_PER_COURSE}`
          );
        } catch (e: any) {
          // Files tab is often disabled for students — not an error worth surfacing
          if (!String(e?.message).includes("Canvas 40")) throw e;
        }
        for (const f of files ?? []) {
          const fileSourceId = `canvas_file_${f.id}`;
          if (!f?.url || (f.size ?? 0) > MAX_FILE_BYTES) { result.filesSkipped++; continue; }
          if (await alreadyIndexed(userId, fileSourceId)) { result.filesSkipped++; continue; }
          try {
            const dl = await fetch(f.url, { headers: { Authorization: `Bearer ${token}` } });
            if (!dl.ok) { result.filesSkipped++; continue; }
            const buf = Buffer.from(await dl.arrayBuffer());
            const parsed = await pdfParse(buf);
            const text = (parsed.text ?? "").replace(/\u0000/g, " ").trim();
            if (text.length < 100) { result.filesSkipped++; continue; }
            await indexSource({
              userId, courseId: course.id, sourceType: "file",
              sourceId: fileSourceId, sourceTitle: f.display_name ?? f.filename ?? "Canvas file",
              text,
            });
            result.filesIndexed++;
          } catch (e: any) {
            result.filesSkipped++;
            result.errors.push(`file ${f.display_name}: ${e?.message}`.slice(0, 160));
          }
        }

        // ── Assignments → calendar ──
        let assignments: any[] = [];
        try {
          assignments = await canvasGet(
            baseUrl, token,
            `/courses/${canvasCourseId}/assignments?bucket=future&per_page=50`
          );
        } catch (e: any) {
          if (!String(e?.message).includes("Canvas 40")) throw e;
        }
        for (const a of assignments ?? []) {
          if (!a?.due_at || !a?.name) continue;
          const canvasId = `canvas_assignment_${a.id}`;
          const exists = await prisma.calendarEvent.findFirst({ where: { userId, canvasId } });
          if (exists) continue;
          const isExam = /exam|midterm|final|test/i.test(a.name);
          await prisma.calendarEvent.create({
            data: {
              userId,
              courseId: course.id,
              canvasId,
              title: a.name,
              date: new Date(a.due_at),
              type: isExam ? "exam" : "assignment",
              description: `Imported from Canvas — ${cc.name}`,
            },
          });
          result.eventsCreated++;
        }
      } catch (e: any) {
        result.errors.push(`${cc.name}: ${e?.message}`.slice(0, 200));
      }
    }

    await prisma.canvasConnection.update({
      where: { userId },
      data: { lastSyncAt: new Date(), lastResult: result as any },
    });
    return result;
  } finally {
    syncing.delete(userId);
  }
}
