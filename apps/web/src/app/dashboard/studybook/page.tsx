"use client";
import { useState, useCallback } from "react";
import useSWR from "swr";
import { BookMarked, Loader2, ChevronDown, ChevronUp, RotateCcw, Lightbulb, BookOpen, Youtube, GraduationCap } from "lucide-react";
import { useApiFetch, useApiSWRFetcher } from "@/lib/apiFetch";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ── Types ─────────────────────────────────────────────────────────────────────
type Flashcard  = { front: string; back: string };
type ExamQ      = { type: "mcq" | "short"; question: string; options: string[] | null; correctAnswer: string; explanation: string };
type Chapter    = { number: number; title: string; timestamp: string; explanation: string; keyTerms: { term: string; definition: string }[]; analogy: { concept: string; analogy: string }; flashcards: Flashcard[]; examQuestions: ExamQ[] };
type StudyBook  = { executiveSummary: string; tableOfContents: { chapter: number; title: string; timestamp: string }[]; chapters: Chapter[]; glossary: { term: string; definition: string; highYield: boolean }[] };

// ── Flip Card ─────────────────────────────────────────────────────────────────
function FlipCard({ front, back }: Flashcard) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div onClick={() => setFlipped(!flipped)} style={{ perspective: "800px" }} className="cursor-pointer h-28 relative">
      <div style={{ position: "relative", width: "100%", height: "100%", transformStyle: "preserve-3d", transition: "transform 0.45s cubic-bezier(.4,0,.2,1)", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
        <div style={{ position: "absolute", width: "100%", height: "100%", backfaceVisibility: "hidden" }}
          className="bg-[#f5f5f5] border border-[#e5e5e5] rounded-xl flex flex-col items-center justify-center p-3 gap-1">
          <div className="text-[9px] text-[#ccc] uppercase tracking-widest">Question</div>
          <p className="text-xs text-black text-center leading-relaxed">{front}</p>
        </div>
        <div style={{ position: "absolute", width: "100%", height: "100%", backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          className="bg-black rounded-xl flex flex-col items-center justify-center p-3 gap-1">
          <div className="text-[9px] text-white/40 uppercase tracking-widest">Answer</div>
          <p className="text-xs text-white text-center leading-relaxed">{back}</p>
        </div>
      </div>
    </div>
  );
}

// ── Exam Question ─────────────────────────────────────────────────────────────
function ExamQuestion({ q, index }: { q: ExamQ; index: number }) {
  const [revealed, setRevealed] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  return (
    <div className="bg-[#f5f5f5] border border-[#e5e5e5] rounded-xl p-4">
      <div className="flex items-start gap-2 mb-3">
        <span className="text-[9px] text-[#444] uppercase tracking-widest shrink-0 mt-0.5">{q.type === "mcq" ? "MCQ" : "Short"}</span>
        <p className="text-xs text-black leading-relaxed">{index + 1}. {q.question}</p>
      </div>
      {q.type === "mcq" && q.options && (
        <div className="space-y-1.5 mb-3">
          {q.options.map((opt, i) => {
            const letter = opt[0];
            const isCorrect = letter === q.correctAnswer;
            const isChosen = chosen === letter;
            return (
              <button
                key={i}
                onClick={() => { setChosen(letter); setRevealed(true); }}
                disabled={revealed}
                className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-colors ${
                  revealed && isCorrect ? "bg-[#0a2a0a] border border-[#1a4a1a] text-[#4caf50]"
                  : revealed && isChosen && !isCorrect ? "bg-[#2a0a0a] border border-[#4a1a1a] text-[#f44336]"
                  : "border border-[#e8e8e8] text-[#666] hover:border-[#ccc] hover:text-black"
                }`}
              >{opt}</button>
            );
          })}
        </div>
      )}
      {q.type === "short" && !revealed && (
        <button onClick={() => setRevealed(true)} className="text-xs text-[#444] hover:text-black transition-colors mb-3">
          Show answer →
        </button>
      )}
      {revealed && (
        <div className="bg-[#f4f4f4] border border-[#e5e5e5] rounded-lg px-3 py-2">
          {q.type === "short" && <p className="text-xs text-black mb-1"><span className="text-[#444]">Answer: </span>{q.correctAnswer}</p>}
          <p className="text-[11px] text-[#555] leading-relaxed">{q.explanation}</p>
        </div>
      )}
      {!revealed && q.type === "mcq" && (
        <button onClick={() => setRevealed(true)} className="text-[11px] text-[#ccc] hover:text-[#888] transition-colors">
          Skip →
        </button>
      )}
    </div>
  );
}

// ── Chapter ───────────────────────────────────────────────────────────────────
function ChapterSection({ ch }: { ch: Chapter }) {
  const [open, setOpen] = useState(true);
  return (
    <div id={`ch-${ch.number}`} className="mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between bg-[#f4f4f4] border border-[#e5e5e5] rounded-2xl px-5 py-4 text-left hover:border-[#d4d4d4] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[#ccc] font-mono shrink-0">CH{String(ch.number).padStart(2, "0")}</span>
          <span className="text-sm font-medium text-black">{ch.title}</span>
          {ch.timestamp && <span className="text-[10px] text-[#444] font-mono">{ch.timestamp}</span>}
        </div>
        {open ? <ChevronUp size={14} className="text-[#444] shrink-0" /> : <ChevronDown size={14} className="text-[#444] shrink-0" />}
      </button>

      {open && (
        <div className="mt-2 pl-2 space-y-5">
          <div className="bg-[#fafafa] border border-[#e8e8e8] rounded-2xl p-5">
            <p className="text-sm text-[#888] leading-relaxed whitespace-pre-line">{ch.explanation}</p>
          </div>

          {ch.keyTerms?.length > 0 && (
            <div>
              <div className="text-[9px] text-[#444] uppercase tracking-widest mb-2">Key Terms</div>
              <div className="space-y-2">
                {ch.keyTerms.map((kt, i) => (
                  <div key={i} className="flex gap-3 text-xs">
                    <span className="text-black font-medium shrink-0">{kt.term}</span>
                    <span className="text-[#555]">— {kt.definition}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ch.analogy && (
            <div className="bg-[#f5f5f5] border border-[#e5e5e5] rounded-xl p-4 flex gap-3">
              <Lightbulb size={13} className="text-[#555] shrink-0 mt-0.5" />
              <div>
                <div className="text-[9px] text-[#444] uppercase tracking-widest mb-1">Analogy — {ch.analogy.concept}</div>
                <p className="text-xs text-[#777] leading-relaxed italic">&ldquo;{ch.analogy.analogy}&rdquo;</p>
              </div>
            </div>
          )}

          {ch.flashcards?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="text-[9px] text-[#444] uppercase tracking-widest">Flashcards</div>
                <div className="text-[9px] text-[#333]">Click to flip</div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {ch.flashcards.map((fc, i) => <FlipCard key={i} {...fc} />)}
              </div>
            </div>
          )}

          {ch.examQuestions?.length > 0 && (
            <div>
              <div className="text-[9px] text-[#444] uppercase tracking-widest mb-2">Exam Questions</div>
              <div className="space-y-2">
                {ch.examQuestions.map((q, i) => <ExamQuestion key={i} q={q} index={i} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Study Book Viewer ─────────────────────────────────────────────────────────
function StudyBookViewer({ book, lectureTitle, onRegenerate, regenerating }: { book: StudyBook; lectureTitle: string; onRegenerate: () => void; regenerating: boolean }) {
  const [glossarySearch, setGlossarySearch] = useState("");
  const filtered = book.glossary?.filter(g =>
    !glossarySearch || g.term.toLowerCase().includes(glossarySearch.toLowerCase())
  ) ?? [];

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="text-[10px] text-[#444] uppercase tracking-widest mb-1">Study Book</div>
          <h1 className="font-serif italic text-2xl text-black">{lectureTitle}</h1>
        </div>
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          className="flex items-center gap-1.5 text-xs text-[#444] hover:text-black border border-[#ddd] hover:border-[#bbb] rounded-full px-3 py-1.5 transition-colors shrink-0 disabled:opacity-40"
        >
          <RotateCcw size={11} className={regenerating ? "animate-spin" : ""} />
          {regenerating ? "Regenerating…" : "Regenerate"}
        </button>
      </div>

      <div className="bg-[#f4f4f4] border border-[#e5e5e5] rounded-2xl p-5 mb-6">
        <div className="text-[9px] text-[#444] uppercase tracking-widest mb-3">Executive Summary</div>
        <p className="text-sm text-[#888] leading-relaxed">{book.executiveSummary}</p>
      </div>

      {book.tableOfContents?.length > 0 && (
        <div className="bg-[#fafafa] border border-[#e8e8e8] rounded-2xl p-5 mb-6">
          <div className="text-[9px] text-[#444] uppercase tracking-widest mb-3">Contents</div>
          <div className="space-y-2">
            {book.tableOfContents.map((item) => (
              <button
                key={item.chapter}
                onClick={() => document.getElementById(`ch-${item.chapter}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="w-full flex items-center justify-between text-left hover:text-black transition-colors group"
              >
                <span className="text-xs text-[#555] group-hover:text-black transition-colors">
                  <span className="text-[#ccc] mr-2">CH{String(item.chapter).padStart(2, "0")}</span>
                  {item.title}
                </span>
                <span className="text-[10px] text-[#ccc] font-mono">{item.timestamp}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {book.chapters?.map(ch => <ChapterSection key={ch.number} ch={ch} />)}

      {book.glossary?.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="text-[9px] text-[#444] uppercase tracking-widest">Glossary</div>
            <input
              value={glossarySearch}
              onChange={e => setGlossarySearch(e.target.value)}
              placeholder="Search terms…"
              className="flex-1 bg-[#f4f4f4] border border-[#e5e5e5] rounded-lg px-3 py-1 text-xs text-black placeholder-[#ccc] outline-none focus:border-[#ccc]"
            />
          </div>
          <div className="bg-[#f4f4f4] border border-[#e5e5e5] rounded-2xl p-4 space-y-3">
            {filtered.map((g, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex-1">
                  <span className="text-xs text-black font-medium">{g.term}</span>
                  {g.highYield && (
                    <span className="ml-2 text-[9px] text-white bg-black rounded-full px-1.5 py-0.5 font-bold uppercase tracking-wider">High yield</span>
                  )}
                  <p className="text-xs text-[#555] mt-0.5 leading-relaxed">{g.definition}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function StudyBookPage() {
  const fetcher = useApiSWRFetcher();
  const apiFetch = useApiFetch();
  const { data: lecturesData } = useSWR(`${BASE}/api/tutor/lectures`, fetcher);
  const lectures: any[] = lecturesData?.data ?? [];

  const [mode, setMode] = useState<"lectures" | "youtube">("lectures");
  const [selected, setSelected] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [book, setBook] = useState<StudyBook | null>(null);
  const [bookTitle, setBookTitle] = useState("");
  const [error, setError] = useState("");

  // YouTube mode state
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [ytGenerating, setYtGenerating] = useState(false);
  const [ytError, setYtError] = useState("");

  const { isLoading: checkingExisting } = useSWR(
    selected && mode === "lectures" ? `${BASE}/api/studybook/${selected.id}` : null,
    fetcher,
    { onSuccess: (d) => { if (d?.data) { setBook(d.data); setBookTitle(selected?.title ?? ""); } } }
  );

  const generate = useCallback(async () => {
    if (!selected) return;
    setGenerating(true);
    setError("");
    try {
      const res = await apiFetch("/api/studybook/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lectureId: selected.id }),
      });
      setBook(res.data);
      setBookTitle(selected.title);
    } catch (e: any) {
      setError(e?.message ?? "Failed to generate study book");
    } finally {
      setGenerating(false);
    }
  }, [selected, apiFetch]);

  const generateFromYouTube = useCallback(async () => {
    if (!youtubeUrl.trim()) return;
    setYtGenerating(true);
    setYtError("");
    setBook(null);
    setBookTitle("");
    try {
      const { jobId } = await apiFetch("/api/studybook/from-youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: youtubeUrl.trim() }),
      });

      // Poll until the background job finishes (max ~6 minutes)
      for (let i = 0; i < 120; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const job = await apiFetch(`/api/studybook/job/${jobId}`);
        if (job.status === "ready") {
          setBook(job.data);
          setBookTitle(job.title ?? "YouTube Video");
          break;
        } else if (job.status === "error") {
          setYtError(job.error ?? "Processing failed. Please try again.");
          break;
        }
        // still "processing" — keep polling
      }
    } catch (e: any) {
      setYtError(e?.message ?? "Failed to generate study book from YouTube");
    } finally {
      setYtGenerating(false);
    }
  }, [youtubeUrl, apiFetch]);

  function selectLecture(l: any) {
    setSelected(l);
    setBook(null);
    setBookTitle("");
    setError("");
  }

  function switchMode(m: "lectures" | "youtube") {
    setMode(m);
    setBook(null);
    setBookTitle("");
    setError("");
    setYtError("");
    setSelected(null);
    setYoutubeUrl("");
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-[#e8e8e8] flex flex-col shrink-0">
        <div className="p-5 border-b border-[#e8e8e8]">
          <h2 className="font-serif italic text-xl text-black mb-3">Study Book</h2>
          {/* Mode tabs */}
          <div className="flex gap-1 bg-[#fafafa] border border-[#e8e8e8] rounded-xl p-1">
            <button
              onClick={() => switchMode("lectures")}
              className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] py-1.5 rounded-lg transition-colors ${
                mode === "lectures" ? "bg-black text-white font-medium" : "text-[#444] hover:text-black"
              }`}
            >
              <GraduationCap size={11} /> Lectures
            </button>
            <button
              onClick={() => switchMode("youtube")}
              className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] py-1.5 rounded-lg transition-colors ${
                mode === "youtube" ? "bg-black text-white font-medium" : "text-[#444] hover:text-black"
              }`}
            >
              <Youtube size={11} /> YouTube
            </button>
          </div>
        </div>

        {mode === "lectures" ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {lectures.length === 0 && (
              <p className="text-xs text-[#333] px-2 py-4">No processed lectures yet.</p>
            )}
            {lectures.map((l) => (
              <button
                key={l.id}
                onClick={() => selectLecture(l)}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${
                  selected?.id === l.id ? "bg-black text-white" : "text-[#555] hover:text-black hover:bg-[#f4f4f4]"
                }`}
              >
                <div className="text-xs font-medium truncate">{l.title}</div>
                <div className={`text-[10px] mt-0.5 truncate ${selected?.id === l.id ? "text-[#888]" : "text-[#ccc]"}`}>
                  {l.course?.name}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex-1 p-4 flex flex-col gap-3">
            <p className="text-[11px] text-[#444] leading-relaxed">
              Paste a YouTube video URL and Claude will extract the transcript and build a full study book.
            </p>
            <textarea
              value={youtubeUrl}
              onChange={e => setYoutubeUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              rows={3}
              className="bg-[#fafafa] border border-[#e8e8e8] focus:border-[#ccc] rounded-xl px-3 py-2.5 text-xs text-black placeholder-[#ccc] outline-none resize-none leading-relaxed"
            />
            {ytError && <p className="text-[11px] text-red-400 leading-relaxed">{ytError}</p>}
            <button
              onClick={generateFromYouTube}
              disabled={ytGenerating || !youtubeUrl.trim()}
              className="bg-black text-white text-xs font-medium px-4 py-2.5 rounded-full hover:bg-[#222] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {ytGenerating ? <><Loader2 size={12} className="animate-spin" /> Building…</> : "Generate Study Book"}
            </button>
            {ytGenerating && (
              <p className="text-[10px] text-[#ccc] text-center leading-relaxed">
                Fetching captions and building your study book… usually under 30 seconds
              </p>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {mode === "youtube" && ytGenerating ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Loader2 size={24} className="animate-spin text-[#333] mx-auto mb-4" />
              <p className="text-[#555] text-sm">Reading transcript and building chapters…</p>
              <p className="text-[#333] text-xs mt-2">Usually under 30 seconds</p>
            </div>
          </div>
        ) : book ? (
          <StudyBookViewer
            book={book}
            lectureTitle={bookTitle}
            onRegenerate={mode === "lectures" ? generate : generateFromYouTube}
            regenerating={generating || ytGenerating}
          />
        ) : mode === "lectures" && !selected ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <BookMarked size={36} className="mx-auto mb-4 text-[#e5e5e5]" />
              <p className="text-[#555] text-sm font-medium">Select a lecture or paste a YouTube URL</p>
              <p className="text-[#ccc] text-xs mt-1">Chapters · Flashcards · Analogies · Exam Questions · Glossary</p>
            </div>
          </div>
        ) : mode === "lectures" && selected && checkingExisting ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-[#333]" />
          </div>
        ) : mode === "lectures" && selected && !book ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-sm">
              <BookOpen size={36} className="mx-auto mb-4 text-[#e5e5e5]" />
              <p className="text-black font-medium mb-1">{selected.title}</p>
              <p className="text-[#555] text-xs mb-6 leading-relaxed">
                Claude will generate chapters with deep explanations, analogies, flashcards, exam questions, and a full glossary. Takes ~20 seconds.
              </p>
              {error && <p className="text-xs text-red-400 mb-4">{error}</p>}
              <button
                onClick={generate}
                disabled={generating}
                className="bg-black text-white text-sm font-medium px-6 py-2.5 rounded-full hover:bg-[#222] transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
              >
                {generating ? <><Loader2 size={14} className="animate-spin" /> Generating Study Book…</> : "Generate Study Book"}
              </button>
              {generating && (
                <p className="text-xs text-[#ccc] mt-4">Claude is reading the lecture and building your chapters…</p>
              )}
            </div>
          </div>
        ) : mode === "youtube" && !book ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Youtube size={36} className="mx-auto mb-4 text-[#e5e5e5]" />
              <p className="text-[#555] text-sm font-medium">Paste a YouTube URL to get started</p>
              <p className="text-[#ccc] text-xs mt-1">Works with any video that has captions or auto-generated subtitles</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
