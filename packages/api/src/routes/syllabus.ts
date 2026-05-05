import { Router } from "express";
import multer from "multer";
import path from "path";
import os from "os";
import fs from "fs";
import { parseSyllabus } from "../services/claude";

const uploadDir = path.join(os.tmpdir(), "sano");
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({ dest: uploadDir });
const router = Router();

const DAY_OFFSETS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

function normalizeScheduleDates(schedule: any[], semesterStart: Date): any[] {
  return schedule.map(item => {
    const raw = (item.raw_date_text ?? "").toLowerCase();
    let date: string | null = null;

    // "Week X [Day]" → compute actual date
    const weekMatch = raw.match(/week\s*(\d+)/);
    if (weekMatch) {
      const weekNum = parseInt(weekMatch[1]);
      const dayMatch = raw.match(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/);
      const dayOffset = dayMatch ? DAY_OFFSETS[dayMatch[0]] : 4; // default Friday
      const d = new Date(semesterStart);
      d.setDate(d.getDate() + (weekNum - 1) * 7 + dayOffset);
      date = d.toISOString().split("T")[0];
    }

    // "Month Day[th/st/nd/rd]" → e.g. "October 15th"
    if (!date) {
      const monthMatch = raw.match(
        /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d+)/
      );
      if (monthMatch) {
        const year = semesterStart.getFullYear();
        const d = new Date(`${monthMatch[1]} ${monthMatch[2]}, ${year}`);
        if (!isNaN(d.getTime())) date = d.toISOString().split("T")[0];
      }
    }

    // "MM/DD" → e.g. "10/15"
    if (!date) {
      const slashMatch = raw.match(/(\d{1,2})\/(\d{1,2})/);
      if (slashMatch) {
        const year = semesterStart.getFullYear();
        const d = new Date(`${year}-${slashMatch[1].padStart(2, "0")}-${slashMatch[2].padStart(2, "0")}`);
        if (!isNaN(d.getTime())) date = d.toISOString().split("T")[0];
      }
    }

    // Already ISO date in raw text
    if (!date) {
      const isoMatch = raw.match(/(\d{4}-\d{2}-\d{2})/);
      if (isoMatch) date = isoMatch[1];
    }

    return { ...item, date };
  });
}

router.post("/parse", upload.single("syllabus"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  let text = "";
  try {
    const pdfParse = require("pdf-parse");
    const buf = fs.readFileSync(req.file.path);
    const pdf = await pdfParse(buf);
    text = pdf.text;
  } finally {
    try { fs.unlinkSync(req.file.path); } catch {}
  }

  if (!text.trim()) {
    return res.status(400).json({ error: "Could not extract text from PDF" });
  }

  const courseName = (req.body.courseName as string) || "Course";
  const semesterStartRaw = req.body.semesterStartDate as string | undefined;

  const result = await parseSyllabus(text, courseName);

  // Resolve semester start: from request body, then from AI-extracted metadata, then today
  const semesterStart = semesterStartRaw
    ? new Date(semesterStartRaw)
    : result.metadata?.semesterStart
    ? new Date(result.metadata.semesterStart)
    : new Date();

  if (result.schedule?.length) {
    result.schedule = normalizeScheduleDates(result.schedule, semesterStart);
    // Sort by date
    result.schedule.sort((a: any, b: any) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    });
  }

  res.json({ data: result });
});

export { router as syllabusRouter };
