"use client";
import { useState, useEffect } from "react";
import useSWR from "swr";
import {
  BookMarked, Sparkles, Loader2, ChevronLeft, Mic, FileText,
  StickyNote, RotateCcw, CheckSquare, Square, Lightbulb,
  ChevronDown, ChevronUp, RotateCw, ChevronRight,
} from "lucide-react";
import { useApiFetch, useApiSWRFetcher } from "@/lib/apiFetch";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Flashcard  = { front: string; back: string };
type ExamQ      = { type: "mcq" | "short"; question: string; options: string[] | null; correctAnswer: string; explanation: string };
type Chapter    = { number: number; title: string; timestamp: string; explanation: string; keyTerms: { term: string; definition: string }[]; analogy: { concept: string; analogy: string }; flashcards: Flashcard[]; examQuestions: ExamQ[] };
type StudyBook  = { executiveSummary?: string; tableOfContents?: { chapter: number; title: string; timestamp: string }[]; chapters: Chapter[]; glossary?: { term: string; definition: string; highYield: boolean }[] };
type BookEntry  = { id: string; title: string; lectureId: string; courseId: string | null; createdAt: string; chapters: number; flashcards: number };

// ── Flip card ─────────────────────────────────────────────────────────────────
function FlipCardDark({ front, back }: Flashcard) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div onClick={() => setFlipped(!flipped)} style={{ perspective: "1000px" }} className="cursor-pointer h-36 relative select-none">
      <div style={{ position: "relative", width: "100%", height: "100%", transformStyle: "preserve-3d", transition: "transform 0.5s cubic-bezier(.4,0,.2,1)", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", background: "#f5f5f5", border: "1px solid #e5e5e5", borderRadius: 16 }}
          className="flex flex-col items-center justify-center p-5 gap-2">
          <div className="text-[9px] uppercase tracking-widest font-semibold text-[#bbb]">Question</div>
          <p className="text-sm text-gray-900 text-center leading-relaxed font-medium">{front}</p>
          <RotateCw size={11} className="text-gray-500 mt-1" />
        </div>
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "#111110", border: "1px solid #333", borderRadius: 16 }}
          className="flex flex-col items-center justify-center p-5 gap-2">
          <div className="text-[9px] uppercase tracking-widest font-semibold text-white/40">Answer</div>
          <p className="text-sm text-white text-center leading-relaxed">{back}</p>
        </div>
      </div>
    </div>
  );
}

// ── Exam question ─────────────────────────────────────────────────────────────
function ExamQuestion({ q, index }: { q: ExamQ; index: number }) {
  const [revealed, setRevealed] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  return (
    <div className="rounded-2xl p-5 border" style={{ background: "#fafafa", borderColor: "#ebebeb" }}>
      <div className="flex items-start gap-3 mb-4">
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mt-0.5"
          style={{ background: q.type === "mcq" ? "#111110" : "#6b7280", color: "white" }}>
          {q.type === "mcq" ? "MCQ" : "Short"}
        </span>
        <p className="text-sm text-gray-900 leading-relaxed font-medium">{index + 1}. {q.question}</p>
      </div>
      {q.type === "mcq" && q.options && (
        <div className="space-y-2 mb-4">
          {q.options.map((opt, i) => {
            const letter = opt[0];
            const isCorrect = letter === q.correctAnswer;
            const isChosen = chosen === letter;
            return (
              <button key={i} onClick={() => { setChosen(letter); setRevealed(true); }} disabled={revealed}
                className="w-full text-left text-sm px-4 py-3 rounded-xl transition-all"
                style={{
                  border: `1.5px solid ${revealed && isCorrect ? "#16a34a" : revealed && isChosen && !isCorrect ? "#dc2626" : "#e5e5e5"}`,
                  background: revealed && isCorrect ? "#f0fdf4" : revealed && isChosen && !isCorrect ? "#fef2f2" : "white",
                  color: revealed && isCorrect ? "#15803d" : revealed && isChosen && !isCorrect ? "#b91c1c" : "#333",
                }}>
                {opt}
              </button>
            );
          })}
        </div>
      )}
      {q.type === "short" && !revealed && (
        <button onClick={() => setRevealed(true)} className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors mb-4 flex items-center gap-1.5">
          Show answer <ChevronRight size={13} />
        </button>
      )}
      {revealed && (
        <div className="rounded-xl px-4 py-3 mt-2" style={{ background: "#f0f9ff", border: "1.5px solid #bae6fd" }}>
          {q.type === "short" && <p className="text-sm font-semibold text-gray-900 mb-1">Answer: <span className="font-normal">{q.correctAnswer}</span></p>}
          <p className="text-xs text-gray-600 leading-relaxed">{q.explanation}</p>
        </div>
      )}
      {!revealed && q.type === "mcq" && (
        <button onClick={() => setRevealed(true)} className="text-xs text-[#bbb] hover:text-gray-500 transition-colors mt-1">Skip</button>
      )}
    </div>
  );
}

// ── Chapter ───────────────────────────────────────────────────────────────────
const CHAPTER_COLORS = ["#6E7FF3", "#a855f7", "#22c55e", "#f97316", "#ec4899", "#14b8a6", "#eab308"];

function ChapterSection({ ch, idx }: { ch: Chapter; idx: number }) {
  const [open, setOpen] = useState(idx === 0);
  const color = CHAPTER_COLORS[idx % CHAPTER_COLORS.length];
  return (
    <div id={`ch-${ch.number}`} className="mb-4">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 p-5 rounded-2xl text-left transition-all hover:opacity-90"
        style={{ background: open ? color : "#f4f4f4", border: `2px solid ${open ? color : "#ebebeb"}` }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-lg"
          style={{ background: open ? "rgba(31,35,40,0.3)" : "rgba(0,0,0,0.07)", color: open ? "white" : "#555" }}>
          {ch.number}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-base truncate" style={{ color: open ? "white" : "#111" }}>{ch.title}</div>
          {ch.timestamp && <div className="text-xs font-mono mt-0.5" style={{ color: open ? "rgba(31,35,40,0.8)" : "#999" }}>{ch.timestamp}</div>}
        </div>
        {open ? <ChevronUp size={16} style={{ color: "rgba(31,35,40,0.7)", flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: "#6B7280", flexShrink: 0 }} />}
      </button>

      {open && (
        <div className="mt-3 space-y-4 pl-1">
          <div className="rounded-2xl p-6 border" style={{ background: "white", borderColor: "#ebebeb" }}>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{ch.explanation}</p>
          </div>
          {ch.keyTerms?.length > 0 && (
            <div className="rounded-2xl p-5 border" style={{ background: "white", borderColor: "#ebebeb" }}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#999] mb-4">Key Terms</div>
              <div className="space-y-3">
                {ch.keyTerms.map((kt, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: color }} />
                    <div>
                      <span className="text-sm font-semibold text-gray-900">{kt.term}</span>
                      <span className="text-sm text-gray-600 ml-2">— {kt.definition}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {ch.analogy && (
            <div className="rounded-2xl p-5 flex gap-4 border" style={{ background: `${color}08`, borderColor: `${color}25` }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
                <Lightbulb size={16} style={{ color }} />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color }}>Analogy — {ch.analogy.concept}</div>
                <p className="text-sm text-gray-600 leading-relaxed italic">&ldquo;{ch.analogy.analogy}&rdquo;</p>
              </div>
            </div>
          )}
          {ch.flashcards?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#999]">Flashcards</div>
                <div className="text-[10px] text-[#bbb]">tap to flip</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {ch.flashcards.map((fc, i) => <FlipCardDark key={i} {...fc} />)}
              </div>
            </div>
          )}
          {ch.examQuestions?.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#999] mb-3">Exam Questions</div>
              <div className="space-y-3">
                {ch.examQuestions.map((q, i) => <ExamQuestion key={i} q={q} index={i} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Viewer ────────────────────────────────────────────────────────────────────
function StudyBookViewer({ book, lectureTitle, onRegenerate, regenerating }: {
  book: StudyBook; lectureTitle: string; onRegenerate: () => void; regenerating: boolean;
}) {
  const [glossarySearch, setGlossarySearch] = useState("");
  const filtered = (book.glossary ?? []).filter(g =>
    !glossarySearch || g.term.toLowerCase().includes(glossarySearch.toLowerCase())
  );
  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <div className="flex items-start justify-between mb-10 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} style={{ color: "#a855f7" }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#a855f7" }}>Study Book</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 leading-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontStyle: "italic", fontWeight: 700 }}>
            {lectureTitle}
          </h1>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-xs text-[#999]">{book.chapters?.length ?? 0} chapters</span>
            <span className="text-[#ddd]">·</span>
            <span className="text-xs text-[#999]">{(book.glossary ?? []).length} glossary terms</span>
            <span className="text-[#ddd]">·</span>
            <span className="text-xs text-[#999]">{book.chapters?.reduce((acc, ch) => acc + (ch.flashcards?.length ?? 0), 0)} flashcards</span>
          </div>
        </div>
        <button onClick={onRegenerate} disabled={regenerating}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl border transition-all hover:border-black hover:text-gray-900 disabled:opacity-40 shrink-0"
          style={{ borderColor: "#e5e5e5", color: "#666", background: "white" }}>
          <RotateCcw size={13} className={regenerating ? "animate-spin" : ""} />
          {regenerating ? "Rebuilding..." : "Regenerate"}
        </button>
      </div>

      {book.executiveSummary && (
        <div className="rounded-3xl p-7 mb-8" style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(199,210,254,0.7)" }}>Executive Summary</div>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(224,231,255,0.9)" }}>{book.executiveSummary}</p>
        </div>
      )}

      {(book.tableOfContents?.length ?? 0) > 0 && (
        <div className="rounded-3xl p-6 mb-8 border" style={{ background: "#fafafa", borderColor: "#ebebeb" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#999] mb-5">Contents</div>
          <div className="space-y-1">
            {book.tableOfContents!.map((item, i) => {
              const color = CHAPTER_COLORS[i % CHAPTER_COLORS.length];
              return (
                <button key={item.chapter}
                  onClick={() => document.getElementById(`ch-${item.chapter}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left hover:bg-[#FFFFFF] transition-all group">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: `${color}18`, color }}>
                    {item.chapter}
                  </div>
                  <span className="flex-1 text-sm text-gray-600 group-hover:text-gray-900 transition-colors">{item.title}</span>
                  <span className="text-xs font-mono text-gray-500">{item.timestamp}</span>
                  <ChevronRight size={13} className="text-gray-500 group-hover:text-gray-500 transition-colors" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {book.chapters?.map((ch, i) => <ChapterSection key={ch.number} ch={ch} idx={i} />)}

      {filtered.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#999]">Glossary</div>
            <input value={glossarySearch} onChange={e => setGlossarySearch(e.target.value)}
              placeholder="Search terms..."
              className="bg-[#F7F6F4] border border-[rgba(0,0,0,0.09)] rounded-xl px-4 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[rgba(0,0,0,0.08)] w-48" />
          </div>
          <div className="rounded-3xl border overflow-hidden" style={{ borderColor: "#ebebeb" }}>
            {filtered.map((g, i) => (
              <div key={i} className="flex items-start gap-4 px-6 py-4 border-b last:border-0" style={{ borderColor: "#f0f0f0", background: i % 2 === 0 ? "white" : "#fafafa" }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900">{g.term}</span>
                    {g.highYield && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: "#fef3c7", color: "#92400e" }}>High yield</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{g.definition}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Cover colors ──────────────────────────────────────────────────────────────
const COVER_COLORS = [
  { bg: "#EEEDFE", fg: "#3C3489" },
  { bg: "#E1F5EE", fg: "#085041" },
  { bg: "#FAEEDA", fg: "#854F0B" },
  { bg: "#FAE8E8", fg: "#7C1D1D" },
  { bg: "#E8F4FA", fg: "#0C447C" },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function StudyBookPage() {
  const fetcher   = useApiSWRFetcher();
  const apiFetch  = useApiFetch();

  const [openBook, setOpenBook]   = useState<{ data: StudyBook; title: string } | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [useAll, setUseAll]       = useState(true);
  const [courseId, setCourseId]   = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [selectedRecordings, setSelectedRecordings] = useState<Set<string>>(new Set());
  const [selectedNotes, setSelectedNotes]           = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles]           = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [error, setError]           = useState("");

  const { data: booksData, mutate: mutateBooks } = useSWR(`${BASE}/api/studybook/list`, fetcher);
  const { data: coursesData } = useSWR(`${BASE}/api/courses`, fetcher);
  const books: BookEntry[]   = booksData?.data ?? [];
  const courses: any[]       = coursesData?.data ?? [];

  useEffect(() => {
    if (!courseId && courses.length > 0) setCourseId(courses[0].id);
  }, [courses, courseId]);

  const { data: lecturesData } = useSWR(courseId ? `${BASE}/api/lectures?courseId=${courseId}` : null, fetcher);
  const { data: notesData }    = useSWR(courseId ? `${BASE}/api/notes?courseId=${courseId}` : null, fetcher);

  const allLectures: any[] = (lecturesData?.data ?? []).filter((l: any) => l.status === "ready" && l.transcript);
  const recordings = allLectures.filter((l: any) => !!l.audioUrl);
  const files      = allLectures.filter((l: any) => !l.audioUrl);
  const notes: any[] = (notesData?.data ?? []).filter((n: any) => n.text?.trim());

  const totalMaterials = useAll
    ? recordings.length + notes.length + files.length
    : selectedRecordings.size + selectedNotes.size + selectedFiles.size;

  const canGenerate = !!(courseId && totalMaterials > 0 && !generating);

  async function generate() {
    if (!canGenerate) return;
    setGenerating(true); setError("");
    try {
      const course = courses.find(c => c.id === courseId);
      const title  = bookTitle.trim() || `${course?.name ?? "Course"} — Study Book`;
      const body: any = { courseId, title };
      if (!useAll) {
        const lectureIds = [...selectedRecordings, ...selectedFiles];
        const noteIds    = [...selectedNotes];
        if (lectureIds.length) body.lectureIds = lectureIds;
        if (noteIds.length)    body.noteIds    = noteIds;
      }
      const { jobId } = await apiFetch("/api/studybook/generate-from-course", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let done = false;
      for (let i = 0; i < 160; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const job = await apiFetch(`/api/studybook/job/${jobId}`);
        if (job.status === "ready") { setOpenBook({ data: job.data, title: job.title ?? title }); mutateBooks(); done = true; break; }
        if (job.status === "error") { setError(job.error ?? "Generation failed."); done = true; break; }
      }
      if (!done) setError("Generation is taking too long — please try again with fewer sources.");
    } catch (e: any) {
      setError(e?.message ?? "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function openSavedBook(entry: BookEntry) {
    try {
      const data = await apiFetch(`/api/studybook/${entry.lectureId}`);
      if (data?.data) setOpenBook({ data: data.data, title: entry.title });
    } catch {}
  }

  // ── Viewer ─────────────────────────────────────────────────────────────────
  if (openBook) {
    return (
      <div className="h-full overflow-y-auto" style={{ background: "#f7f7f6" }}>
        <div className="sticky top-0 z-10 flex items-center gap-3 px-8 py-4 border-b" style={{ background: "white", borderColor: "#ebebeb" }}>
          <button onClick={() => setOpenBook(null)}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors">
            <ChevronLeft size={14} /> Back
          </button>
          <span className="text-[#ddd]">/</span>
          <span className="text-sm font-medium text-gray-900 truncate">{openBook.title}</span>
        </div>
        <StudyBookViewer book={openBook.data} lectureTitle={openBook.title}
          onRegenerate={generate} regenerating={generating} />
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto" style={{ background: "#f7f5ef" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "2rem 1.5rem" }}>

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#E6F1FB", color: "#0C447C" }}>
            <BookMarked size={14} />
          </div>
          <h2 className="text-lg font-medium text-gray-900 m-0">Study books</h2>
        </div>

        {/* Generate panel */}
        <div className="rounded-xl p-5 mb-5 border" style={{ background: "white", borderColor: "rgba(0,0,0,0.08)" }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles size={15} className="text-gray-900" />
                <span className="text-sm font-medium text-gray-900">Generate study book</span>
              </div>
              <p className="text-xs m-0" style={{ color: "#6b6a64" }}>
                {useAll ? "Uses all recordings, files & notes" : `${totalMaterials} source${totalMaterials !== 1 ? "s" : ""} selected`}
              </p>
              <div className="flex gap-1.5 mt-2.5 flex-wrap">
                {recordings.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: "#EEEDFE", color: "#3C3489" }}>
                    <Mic size={10} /> {recordings.length} recording{recordings.length !== 1 ? "s" : ""}
                  </span>
                )}
                {notes.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: "#E1F5EE", color: "#085041" }}>
                    <StickyNote size={10} /> {notes.length} note{notes.length !== 1 ? "s" : ""}
                  </span>
                )}
                {files.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: "#FAEEDA", color: "#854F0B" }}>
                    <FileText size={10} /> {files.length} file{files.length !== 1 ? "s" : ""}
                  </span>
                )}
                {!courseId && <span className="text-xs" style={{ color: "#9c9a92" }}>Select a course below</span>}
                {courseId && totalMaterials === 0 && <span className="text-xs" style={{ color: "#9c9a92" }}>No materials yet</span>}
              </div>
            </div>
            <div className="flex gap-2 shrink-0 items-start">
              <button onClick={() => setShowPicker(p => !p)}
                className="text-xs px-3.5 py-1.5 rounded-lg border transition-all"
                style={{ borderColor: "rgba(0,0,0,0.15)", background: showPicker ? "#f5f5f5" : "transparent", color: "#1a1a17" }}>
                Choose
              </button>
              <button onClick={generate} disabled={!canGenerate}
                className="text-xs px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                style={{ background: canGenerate ? "#1a1a17" : "#e5e5e5", color: canGenerate ? "white" : "#999", border: "none", cursor: canGenerate ? "pointer" : "default" }}>
                {generating ? <><Loader2 size={11} className="animate-spin" />Building...</> : "Generate"}
              </button>
            </div>
          </div>

          {/* Picker */}
          {showPicker && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "rgba(0,0,0,0.07)" }}>
              <div className="mb-3">
                <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "#9c9a92" }}>Course</label>
                <select value={courseId} onChange={e => { setCourseId(e.target.value); setSelectedRecordings(new Set()); setSelectedNotes(new Set()); setSelectedFiles(new Set()); }}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "rgba(0,0,0,0.12)", background: "white", color: "#1a1a17" }}>
                  <option value="">Select course...</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button onClick={() => setUseAll(u => !u)} className="flex items-center gap-2 mb-3">
                {useAll ? <CheckSquare size={14} className="text-gray-900" /> : <Square size={14} style={{ color: "#ccc" }} />}
                <span className="text-xs font-medium" style={{ color: "#1a1a17" }}>Use all materials</span>
              </button>
              {!useAll && courseId && (
                <div className="space-y-0.5 mb-3 max-h-48 overflow-y-auto">
                  {recordings.map(r => (
                    <label key={r.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-black/[0.04] cursor-pointer">
                      <input type="checkbox" checked={selectedRecordings.has(r.id)}
                        onChange={() => { const n = new Set(selectedRecordings); n.has(r.id) ? n.delete(r.id) : n.add(r.id); setSelectedRecordings(n); }} />
                      <Mic size={11} style={{ color: "#3C3489" }} />
                      <span className="text-xs text-gray-900 truncate">{r.title}</span>
                    </label>
                  ))}
                  {notes.map(n => (
                    <label key={n.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-black/[0.04] cursor-pointer">
                      <input type="checkbox" checked={selectedNotes.has(n.id)}
                        onChange={() => { const s = new Set(selectedNotes); s.has(n.id) ? s.delete(n.id) : s.add(n.id); setSelectedNotes(s); }} />
                      <StickyNote size={11} style={{ color: "#085041" }} />
                      <span className="text-xs text-gray-900 truncate">{n.name}</span>
                    </label>
                  ))}
                  {files.map(f => (
                    <label key={f.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-black/[0.04] cursor-pointer">
                      <input type="checkbox" checked={selectedFiles.has(f.id)}
                        onChange={() => { const s = new Set(selectedFiles); s.has(f.id) ? s.delete(f.id) : s.add(f.id); setSelectedFiles(s); }} />
                      <FileText size={11} style={{ color: "#854F0B" }} />
                      <span className="text-xs text-gray-900 truncate">{f.title}</span>
                    </label>
                  ))}
                </div>
              )}
              <input value={bookTitle} onChange={e => setBookTitle(e.target.value)}
                placeholder="Book title (optional)..."
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                style={{ borderColor: "rgba(0,0,0,0.12)", background: "white", color: "#1a1a17" }} />
            </div>
          )}

          {error && <p className="text-xs text-red-500 mt-3 leading-relaxed">{error}</p>}
        </div>

        {/* Generating indicator */}
        {generating && (
          <div className="rounded-xl p-5 mb-5 flex items-center gap-4 border" style={{ background: "white", borderColor: "rgba(0,0,0,0.08)" }}>
            <Loader2 size={18} className="animate-spin shrink-0" style={{ color: "#6b6a64" }} />
            <div>
              <p className="text-sm font-medium text-gray-900 m-0">Building your study book...</p>
              <p className="text-xs m-0 mt-0.5" style={{ color: "#9c9a92" }}>Reading sources, structuring chapters, writing explanations</p>
            </div>
          </div>
        )}

        {/* Recent books */}
        {books.length > 0 && (
          <>
            <p className="text-xs mb-2.5 ml-1 m-0" style={{ color: "#9c9a92" }}>Recent</p>
            <div className="flex flex-col gap-2">
              {books.map((book, i) => {
                const cover = COVER_COLORS[i % COVER_COLORS.length];
                const date  = new Date(book.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                const parts = [date, book.chapters ? `${book.chapters} chapter${book.chapters !== 1 ? "s" : ""}` : null, book.flashcards ? `${book.flashcards} flashcard${book.flashcards !== 1 ? "s" : ""}` : null].filter(Boolean);
                return (
                  <div key={book.id} className="flex items-center gap-3.5 px-4 py-3.5 rounded-xl border" style={{ background: "white", borderColor: "rgba(0,0,0,0.08)" }}>
                    <div className="w-10 h-12 rounded-md flex items-center justify-center shrink-0" style={{ background: cover.bg, color: cover.fg }}>
                      <BookMarked size={17} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 m-0 truncate">{book.title}</p>
                      <p className="text-xs m-0 mt-0.5" style={{ color: "#6b6a64" }}>{parts.join(" · ")}</p>
                    </div>
                    <button onClick={() => openSavedBook(book)}
                      className="text-xs px-3.5 py-1.5 rounded-lg border transition-all hover:border-black hover:text-gray-900 shrink-0"
                      style={{ borderColor: "rgba(0,0,0,0.15)", color: "#1a1a17", background: "transparent" }}>
                      Open
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {books.length === 0 && !generating && (
          <div className="text-center py-16" style={{ color: "#9c9a92" }}>
            <BookMarked size={28} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm m-0">No study books yet. Generate your first one above.</p>
          </div>
        )}
      </div>
    </div>
  );
}
