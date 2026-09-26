import fs from "fs";
import path from "path";

/**
 * Pulls the text out of the files a student actually has: the professor's slide
 * deck, a handout, a reading.
 *
 * These go through the same path as a board photo — extract text, store it on the
 * row, index it into the course memory — so Ask can cite a slide the same way it
 * cites a moment in the audio. The difference is that a photo needs a vision model
 * and costs money per page, while a PDF or PPTX already contains its text and costs
 * nothing to read.
 */

/** Slide decks, documents and plain text we can read without a vision model. */
export const DOCUMENT_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "text/plain": ".txt",
  "text/markdown": ".md",
  "text/csv": ".csv",
};

/**
 * The old binary Office formats are not zip archives, so nothing here can read
 * them. Named explicitly to return an explanation rather than "unsupported file".
 */
const LEGACY_OFFICE: Record<string, string> = {
  "application/vnd.ms-powerpoint": "PowerPoint 97–2003 (.ppt)",
  "application/msword": "Word 97–2003 (.doc)",
};

export function isDocument(mimetype: string): boolean {
  return mimetype in DOCUMENT_TYPES;
}

export function legacyOfficeName(mimetype: string): string | null {
  return LEGACY_OFFICE[mimetype] ?? null;
}

/**
 * Upper bound on extracted text, in characters.
 *
 * Every chunk of this gets an embedding, so a 400-page course reader uploaded by
 * accident would otherwise run up a real bill on one request. Roughly 50k tokens,
 * which comfortably covers any lecture's slides.
 */
const MAX_CHARS = 200_000;

/** Collapses the runs of whitespace that XML and PDF extraction both leave behind. */
function tidy(s: string): string {
  return s
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Decodes the five XML entities that appear in Office text runs. */
function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** The text inside every <tag>…</tag> run, in document order. */
function xmlRuns(xml: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  for (const m of xml.matchAll(re)) out.push(unescapeXml(m[1]));
  return out;
}

async function readPdf(file: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse");
  const { text } = await pdfParse(fs.readFileSync(file));
  return text ?? "";
}

/**
 * PPTX text, one labelled section per slide.
 *
 * The labels are the point: indexed into course memory, "Slide 7" is something a
 * student can turn to, where an unbroken wall of deck text is not.
 */
function readPptx(file: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AdmZip = require("adm-zip");
  const zip = new AdmZip(file);

  const slides = zip
    .getEntries()
    .map((e: any) => e.entryName as string)
    .filter((n: string) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    // Numeric order — a string sort puts slide10 before slide2.
    .sort((a: string, b: string) => slideNumber(a) - slideNumber(b));

  const parts: string[] = [];
  for (const name of slides) {
    const xml = zip.readAsText(name);
    // <a:t> holds the text of every run, in titles, bullets and text boxes alike.
    const body = tidy(xmlRuns(xml, "a:t").join("\n"));
    if (body) parts.push(`Slide ${slideNumber(name)}\n${body}`);
  }
  return parts.join("\n\n");
}

function slideNumber(entryName: string): number {
  return Number(/slide(\d+)\.xml$/.exec(entryName)?.[1] ?? 0);
}

function readDocx(file: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AdmZip = require("adm-zip");
  const xml = new AdmZip(file).readAsText("word/document.xml") ?? "";
  // Paragraph boundaries are lost if every run is simply concatenated, so split on
  // <w:p> first and join the runs inside each.
  const paragraphs = xmlRuns(xml, "w:p").map((p) => xmlRuns(p, "w:t").join(""));
  return paragraphs.filter((p) => p.trim()).join("\n");
}

/**
 * The text of a stored document, tidied and capped.
 *
 * Throws with a message meant for the student when the file yields nothing — a
 * scanned deck of page images is the common case, and it needs a different answer
 * ("photograph the slides") than a genuine failure.
 */
export async function extractDocumentText(file: string, mimetype: string): Promise<string> {
  let raw = "";

  switch (mimetype) {
    case "application/pdf":
      raw = await readPdf(file);
      break;
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      raw = readPptx(file);
      break;
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      raw = readDocx(file);
      break;
    case "text/plain":
    case "text/markdown":
    case "text/csv":
      raw = fs.readFileSync(file, "utf8");
      break;
    default:
      throw new Error(`Unsupported document type: ${mimetype}`);
  }

  const text = tidy(raw);
  if (!text) {
    // A PDF of scanned page images has no text layer at all. Saying "couldn't read
    // the file" would send the student looking for a broken upload.
    throw new Error(
      "NO_TEXT_LAYER: This file has no readable text — it's probably scanned pages or images. Photograph the slides instead and attach the photos.",
    );
  }
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}\n\n[truncated]` : text;
}

/** A short, human label for a stored document, used as its title in course memory. */
export function documentTitle(originalName: string, date: Date): string {
  const base = path.basename(originalName, path.extname(originalName)).trim();
  if (base) return base.slice(0, 120);
  return `Document — ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

/**
 * The student's own filename, carried in the stored path rather than a new column.
 *
 * "Lecture 4 — Glycolysis.pdf" is what makes a citation recognisable, so it has to
 * survive upload. There is no migrations directory in this project — schema changes
 * are applied by hand with `prisma db push` — so adding a column would mean the
 * deploy had to land strictly after the DDL, and code that selected a column the
 * database lacked would break every photo upload, not just documents. Keeping the
 * name in the filename removes that ordering hazard, and leaves the files on disk
 * readable when something needs debugging.
 */
const NAME_SEP = "__";

/** Filesystem-safe, and stripped of anything that could climb out of the directory. */
function safeBase(originalName: string): string {
  return path
    .basename(originalName, path.extname(originalName))
    .replace(/[^A-Za-z0-9 .\-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-. ]+|[-. ]+$/g, "")
    .slice(0, 80);
}

/** Storage name for an upload: unique prefix, then the student's own name. */
export function storedFilename(originalName: string, mimetype: string): string {
  const ext = path.extname(originalName) || DOCUMENT_TYPES[mimetype] || "";
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const base = safeBase(originalName);
  return `doc-${unique}${base ? NAME_SEP + base : ""}${ext}`;
}

/** Recovers the student's filename from a stored path, or null if it carries none. */
export function originalNameFromPath(filePath: string): string | null {
  const name = path.basename(filePath, path.extname(filePath));
  const at = name.indexOf(NAME_SEP);
  if (at === -1) return null;
  const base = name.slice(at + NAME_SEP.length).trim();
  return base || null;
}

/**
 * The document type for a stored path, or null when it isn't one.
 *
 * Attached files are identified by extension after upload, because only the path is
 * kept. Without this the lecture processor guesses image/jpeg for anything it does
 * not recognise and hands a PDF to the vision model, which refuses it — and the
 * refusal is swallowed as non-fatal, so the deck contributes nothing and nobody is
 * told why.
 */
export function documentMimeForPath(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  for (const [mimetype, knownExt] of Object.entries(DOCUMENT_TYPES)) {
    if (knownExt === ext) return mimetype;
  }
  return null;
}
