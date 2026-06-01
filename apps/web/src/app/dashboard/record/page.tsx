"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Mic, Square, FileUp, CheckCircle, Loader2, Plus, Pause, Play, StopCircle,
  BookOpen, Calendar, X, Mic2, FileText, ArrowLeft, Layers, BookMarked, Youtube,
  ChevronDown, PenLine, Trash2, RotateCcw, Sparkles, FileText as FileTextIcon, MessageSquare,
} from "lucide-react";
import { useApiFetch, useApiSWRFetcher } from "@/lib/apiFetch";
import { useAuth } from "@clerk/nextjs";
import { useT } from "@/lib/useT";
import useSWR from "swr";
import Link from "next/link";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { TiptapNoteEditor } from "@/components/TiptapNoteEditor";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const SEMESTERS = ["Fall", "Spring", "Summer", "Winter"];

// ─── Hover-to-Define ─────────────────────────────────────────────────────────
function TermTooltip({ term, definition, highYield }: { term: string; definition: string; highYield?: boolean }) {
  return (
    <span className="relative group/tt inline">
      <span className={`cursor-help border-b border-dotted font-medium transition-colors ${highYield ? "border-yellow-500 text-[#111110]" : "border-[rgba(0,0,0,0.3)] text-[#111110]"} hover:border-[#111110]`}>
        {term}
      </span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 bg-[#111110] text-white text-xs rounded-xl px-3.5 py-3 shadow-xl opacity-0 group-hover/tt:opacity-100 pointer-events-none transition-opacity duration-150 leading-relaxed text-left whitespace-normal">
        {highYield && <span className="text-yellow-400 text-[9px] uppercase tracking-widest block mb-1">★ High Yield</span>}
        <span className="opacity-50 text-[9px] uppercase tracking-widest block mb-1">{term}</span>
        {definition}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-[#111110]" />
      </span>
    </span>
  );
}

function TextWithTerms({ text, glossaryMap }: { text: string; glossaryMap: Map<string, { definition: string; highYield?: boolean }> }) {
  if (!glossaryMap.size) return <>{text}</>;
  const terms = Array.from(glossaryMap.keys()).sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) => {
        const hit = glossaryMap.get(part.toLowerCase());
        return hit
          ? <TermTooltip key={i} term={part} definition={hit.definition} highYield={hit.highYield} />
          : <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ─── Create Class Mini-Page ───────────────────────────────────────────────────
function CreateClassPage({ onBack, onCreate }: { onBack: () => void; onCreate: (c: any) => void }) {
  const apiFetch = useApiFetch();
  const [name, setName] = useState("");
  const [semester, setSemester] = useState("Fall");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const code = name.trim().slice(0, 5).toUpperCase().replace(/\s/g, "") + year.slice(2);
      const res = await apiFetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), code, color: semester }),
      });
      const course = res.data;

      onCreate(course);
    } catch (e: any) {
      alert(e?.message ?? "Could not create class. Is the API running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <button onClick={onBack} className="flex items-center gap-2 text-[#555] hover:text-[#111110] transition-colors text-sm mb-8">
        <ArrowLeft size={14} /> Back
      </button>

      <h1 className="font-serif italic text-5xl mb-1">New Class</h1>
      <p className="text-[#555] text-sm mb-8">Set up your class to start organizing lectures and materials.</p>

      <div className="space-y-4">
        {/* Class name */}
        <div>
          <label className="text-[10px] text-[#555] uppercase tracking-widest block mb-1.5">Class Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && create()}
            placeholder="e.g. Calculus II, Biology 101…"
            className="w-full bg-white border border-[rgba(0,0,0,0.08)] focus:border-[rgba(0,0,0,0.1)] rounded-xl px-4 py-3 text-sm text-[#111110] placeholder-[rgba(0,0,0,0.3)] outline-none"
          />
        </div>

        {/* Semester */}
        <div>
          <label className="text-[10px] text-[#555] uppercase tracking-widest block mb-1.5">Semester</label>
          <div className="flex gap-2">
            <div className="flex gap-1 bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-1">
              {SEMESTERS.map(s => (
                <button
                  key={s}
                  onClick={() => setSemester(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    semester === s ? "bg-white text-[#111110]" : "text-[#555] hover:text-[#111110]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <input
              value={year}
              onChange={e => setYear(e.target.value)}
              className="w-20 bg-white border border-[rgba(0,0,0,0.08)] focus:border-[rgba(0,0,0,0.1)] rounded-xl px-3 py-2 text-sm text-[#111110] outline-none text-center"
              maxLength={4}
            />
          </div>
        </div>

        <button
          onClick={create}
          disabled={loading || !name.trim()}
          className="w-full bg-white text-[#111110] rounded-xl py-3 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-[#eee] transition-colors"
        >
          {loading ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : "Create Class"}
        </button>
      </div>
    </div>
  );
}

// ─── Class list (home) ────────────────────────────────────────────────────────
function ClassList({ onSelect, onCreate }: { onSelect: (c: any) => void; onCreate: () => void }) {
  const t = useT();
  const { userId } = useAuth();
  const fetcher = useApiSWRFetcher();
  const apiFetch = useApiFetch();
  const { data, isLoading, mutate } = useSWR(userId ? `${BASE}/api/courses` : null, fetcher, { revalidateOnFocus: false });
  const courses: any[] = data?.data ?? [];
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function deleteCourse(id: string) {
    setDeleting(true);
    try {
      await apiFetch(`/api/courses/${id}`, { method: "DELETE" });
      await mutate();
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif italic text-3xl mb-1">{t.workspace.title}</h1>
          <p className="text-[#555] text-sm">{t.workspace.subtitle}</p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 bg-white text-[#111110] text-sm font-medium px-4 py-2 rounded-full hover:bg-[#eee] transition-colors"
        >
          <Plus size={14} /> {t.workspace.newClass}
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-7 animate-pulse">
              <div className="h-4 bg-[#1e1e1e] rounded w-2/3 mb-3" />
              <div className="h-3 bg-[#f0ede8] rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="border border-dashed border-[rgba(0,0,0,0.08)] rounded-2xl p-16 text-center">
          <Layers size={36} className="mx-auto mb-4 text-[#222]" />
          <p className="text-[#555] text-sm font-medium mb-1">No classes yet</p>
          <p className="text-[#555] text-xs mb-4">Create your first class to start recording lectures</p>
          <button onClick={onCreate} className="text-xs text-[#6b6b69] border border-[rgba(0,0,0,0.1)] px-4 py-2 rounded-full hover:border-[#ddd] transition-colors">
            Create a class
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => (
            <div key={c.id} className="relative group/card">
              {confirmDeleteId === c.id ? (
                <div className="bg-white border border-red-200 rounded-2xl p-7 flex flex-col gap-3">
                  <p className="text-sm font-medium text-[#111110]">Delete &ldquo;{c.name}&rdquo;?</p>
                  <p className="text-xs text-[#666] leading-relaxed">All lectures, notes, and materials in this class will be permanently deleted.</p>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => setConfirmDeleteId(null)} disabled={deleting}
                      className="flex-1 text-xs py-2 rounded-lg border border-[rgba(0,0,0,0.12)] text-[#555] hover:text-black transition-colors">
                      Cancel
                    </button>
                    <button onClick={() => deleteCourse(c.id)} disabled={deleting}
                      className="flex-1 text-xs py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5">
                      {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => onSelect(c)}
                    className="w-full bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-7 text-left hover:border-[rgba(0,0,0,0.1)] hover:bg-white/5 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#f0ede8] flex items-center justify-center mb-4 group-hover:bg-[#222] transition-colors">
                      <Layers size={16} className="text-[#555] group-hover:text-[#111110] transition-colors" />
                    </div>
                    <div className="text-[#111110] font-medium text-base mb-1">{c.name}</div>
                    <div className="text-[#555] text-xs">{c.code}</div>
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDeleteId(c.id); }}
                    className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity hover:bg-red-50"
                    title="Delete class"
                  >
                    <Trash2 size={13} className="text-[#bbb] hover:text-red-500 transition-colors" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Class workspace ──────────────────────────────────────────────────────────
type InitialYtState = { videoId: string; url: string };

function ClassWorkspace({ course, allCourses, onSelect, onBack, initialTab, initialYtState }: {
  course: any; allCourses: any[]; onSelect: (c: any) => void; onBack: () => void;
  initialTab?: string; initialYtState?: InitialYtState;
}) {
  const t = useT();
  const apiFetch = useApiFetch();
  const fetcher = useApiSWRFetcher();
  const { userId } = useAuth();
  const [tab, setTab] = useState<"record" | "files" | "quizzes" | "video" | "studybook" | "note">(
    (initialTab as any) ?? "record"
  );

  // Track which tabs have been visited so we only fetch data on demand
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set([initialTab ?? "record"]));
  function switchTab(next: typeof tab) {
    setVisitedTabs(prev => new Set([...prev, next]));
    switchTab(next);
  }

  // Lectures always fetch — needed for Record tab (primary tab)
  const { data: lecturesData, mutate: mutateLectures } = useSWR(
    `${BASE}/api/lectures?courseId=${course.id}`,
    fetcher,
    { revalidateOnFocus: false }
  );
  const lectures: any[] = lecturesData?.data ?? [];
  const audioLectures: any[] = lectures.filter((l: any) => l.audioUrl);

  // Sheets — only fetch when Files or Review tab visited
  const needsSheets = visitedTabs.has("files") || visitedTabs.has("studybook");
  const { data: sheetsData, mutate: mutateSheets } = useSWR(
    needsSheets ? `${BASE}/api/cheatsheets?courseId=${course.id}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const sheets: any[] = (sheetsData?.data ?? []).filter((s: any) => !s.title?.startsWith("Study Book:"));
  const studyBooks: any[] = (sheetsData?.data ?? []).filter((s: any) => s.title?.startsWith("Study Book:"));

  // ── study book navigation ──
  const [sbView, setSbView] = useState<"list" | "detail">("list");
  const [activeSb, setActiveSb] = useState<any | null>(null);
  const [sbEditMode, setSbEditMode] = useState(false);
  const [sbEditSummary, setSbEditSummary] = useState("");
  const [sbEditSections, setSbEditSections] = useState<{ heading: string; bullets: string }[]>([]);
  const [sbEditKeyTerms, setSbEditKeyTerms] = useState("");
  const [sbSaving, setSbSaving] = useState(false);
  const [sbQuizMode, setSbQuizMode] = useState(false);
  const [sbQuizName, setSbQuizName] = useState("");
  const [sbQuizGenerating, setSbQuizGenerating] = useState(false);
  const [sbQuizDone, setSbQuizDone] = useState(false);
  const [generateBookName, setGenerateBookName] = useState("");
  const [generatingBook, setGeneratingBook] = useState(false);
  const [generateBookError, setGenerateBookError] = useState("");
  const [generateBookDone, setGenerateBookDone] = useState(false);
  const generateBookPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showMaterials, setShowMaterials] = useState(false);
  const [selectedLectureIds, setSelectedLectureIds] = useState<Set<string>>(new Set());
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());

  function openMaterialPicker() {
    setSelectedLectureIds(new Set(lectures.filter(l => l.status === "ready" && l.transcript).map((l: any) => l.id)));
    setSelectedNoteIds(new Set(notes.map(n => n.id)));
    setShowMaterials(true);
  }

  function toggleLecture(id: string) {
    setSelectedLectureIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleNote(id: string) {
    setSelectedNoteIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());
  const [expandedSbSections, setExpandedSbSections] = useState<{ glossary: boolean; flashcards: boolean; examQ: boolean; tips: boolean; practiceQ: boolean }>({ glossary: false, flashcards: false, examQ: false, tips: false, practiceQ: false });

  function toggleChapter(i: number) {
    setExpandedChapters(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }

  const { data: quizzesData, mutate: mutateQuizzes } = useSWR(
    visitedTabs.has("quizzes") ? `${BASE}/api/quizzes?courseId=${course.id}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const quizzes: any[] = quizzesData?.data ?? [];

  // ── record ──
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [recTitle, setRecTitle] = useState("");
  const [slidesFile, setSlidesFile] = useState<File | null>(null);
  const [savedBlob, setSavedBlob] = useState<Blob | null>(null);
  const [savedAudioUrl, setSavedAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [recordAction, setRecordAction] = useState<"transcribe" | "summarize" | null>(null);
  const [recStep, setRecStep] = useState<"name" | "recording" | "saved" | "processing" | "done">("name");
  const [openLectureId, setOpenLectureId] = useState<string | null>(null);
  const [openTab, setOpenTab] = useState<"transcript" | "summary" | "keypoints">("transcript");
  const [openLectureKeyPoints, setOpenLectureKeyPoints] = useState<any[] | null>(null);
  const [openLectureKeyPointsLoading, setOpenLectureKeyPointsLoading] = useState(false);
  const [openLectureData, setOpenLectureData] = useState<{ transcript: string; sheet: any | null; audioUrl: string | null } | null>(null);
  const localAudioUrlsRef = useRef<Map<string, string>>(new Map());
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioElemRef = useRef<HTMLAudioElement | null>(null);
  const openAudioRef = useRef<HTMLAudioElement | null>(null);
  const wakeLockRef = useRef<any>(null);
  const waveHeights = useRef(Array.from({ length: 20 }, () => 0.3 + Math.random() * 0.7));
  const waveDurations = useRef(Array.from({ length: 20 }, () => 0.4 + Math.random() * 0.7));

  // processing + inline sheet state
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState("processing");
  const [lectureSheet, setLectureSheet] = useState<any | null>(null);
  const [lectureTranscript, setLectureTranscript] = useState("");
  const [resultTab, setResultTab] = useState<"read" | "transcript" | "summarise">("read");
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSections, setEditSections] = useState<{ heading: string; bullets: string }[]>([]);
  const [editKeyTerms, setEditKeyTerms] = useState("");
  const [savingSheet, setSavingSheet] = useState(false);
  const [addingToBook, setAddingToBook] = useState(false);
  const [addedToBook, setAddedToBook] = useState(false);
  const [processingError, setProcessingError] = useState("");
  const [inlineTranscript, setInlineTranscript] = useState("");
  const [inlineSummary, setInlineSummary] = useState<any | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  useEffect(() => {
    if (!processingId) return;
    setProcessingError("");
    pollStartRef.current = Date.now();
    pollRef.current = setInterval(async () => {
      if (Date.now() - pollStartRef.current > 6 * 60 * 1000) {
        if (pollRef.current) clearInterval(pollRef.current);
        setProcessingError("Processing timed out. Please try again.");
        setProcessingId(null);
        setRecStep("saved");
        return;
      }
      try {
        const res = await apiFetch(`/api/lectures/${processingId}/status`);
        const status = res.data?.status;
        setProcessingStatus(status);
        if (status === "ready" || status === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
          if (status === "error") {
            setProcessingError("Processing failed. Check that your API keys are set in Railway and try again.");
            setProcessingId(null);
            setRecStep("saved");
            return;
          }
          await mutateLectures();
          setProcessingId(null);
          setRecStep("done");
        }
      } catch (_) {}
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processingId]);

  useEffect(() => {
    if (recStep !== "done") return;
    const t = setTimeout(() => {
      setRecStep("name");
      setSeconds(0);
      setRecTitle("");
      setSavedBlob(null);
      setSavedAudioUrl(null);
      setPlaying(false);
      setProcessingError("");
      if (audioElemRef.current) { audioElemRef.current.pause(); audioElemRef.current = null; }
    }, 3000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recStep]);

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    mediaRef.current = recorder;
    chunksRef.current = [];
    recorder.ondataavailable = e => chunksRef.current.push(e.data);
    recorder.start(250);
    setRecording(true);
    setRecStep("recording");
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
  }

  function pauseRecording() {
    if (!mediaRef.current || paused) return;
    mediaRef.current.pause();
    setPaused(true);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function resumeRecording() {
    if (!mediaRef.current || !paused) return;
    mediaRef.current.resume();
    setPaused(false);
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
  }

  async function stopRecording() {
    if (!mediaRef.current) return;
    mediaRef.current.stop();
    mediaRef.current.stream.getTracks().forEach(t => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    setPaused(false);
    setRecording(false);
    await new Promise<void>(res => { mediaRef.current!.onstop = () => res(); });
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const url = URL.createObjectURL(blob);
    setSavedBlob(blob);
    setSavedAudioUrl(url);
    setRecStep("saved");
  }

  function playAudio() {
    if (!savedAudioUrl) return;
    if (!audioElemRef.current) {
      audioElemRef.current = new Audio(savedAudioUrl);
      audioElemRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioElemRef.current.pause();
      setPlaying(false);
    } else {
      audioElemRef.current.play();
      setPlaying(true);
    }
  }

  async function processAudio() {
    if (!savedBlob) return;
    if (audioElemRef.current) { audioElemRef.current.pause(); setPlaying(false); }
    setUploading(true);
    setRecStep("processing");
    try {
      const fd = new FormData();
      fd.append("audio", savedBlob, "lecture.webm");
      fd.append("courseId", course.id);
      fd.append("title", recTitle.trim() || `Lecture ${new Date().toLocaleDateString()}`);
      if (slidesFile) fd.append("slides", slidesFile);
      const res = await apiFetch("/api/lectures", { method: "POST", body: fd });
      const lectureId = res.data?.id ?? null;
      if (lectureId && savedAudioUrl) {
        localAudioUrlsRef.current.set(lectureId, savedAudioUrl);
      } else if (savedAudioUrl) {
        URL.revokeObjectURL(savedAudioUrl);
      }
      setProcessingId(lectureId);
      setProcessingStatus("processing");
      setSavedBlob(null);
      setSavedAudioUrl(null);
    } catch (e: any) {
      alert(e?.message ?? "Upload failed");
      setRecStep("saved");
    } finally {
      setUploading(false);
    }
  }

  async function saveSheet() {
    if (!lectureSheet) return;
    setSavingSheet(true);
    const updatedContent = {
      ...lectureSheet.content,
      sections: editSections.map(s => ({
        heading: s.heading,
        bullets: s.bullets.split("\n").map(b => b.trim()).filter(Boolean),
      })),
      keyTerms: editKeyTerms.split("\n").filter(Boolean).map(line => {
        const idx = line.indexOf(":");
        return idx > -1
          ? { term: line.slice(0, idx).trim(), definition: line.slice(idx + 1).trim() }
          : { term: line.trim(), definition: "" };
      }),
    };
    await apiFetch(`/api/cheatsheets/${lectureSheet.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle, content: updatedContent }),
    });
    setLectureSheet((prev: any) => ({ ...prev, title: editTitle, content: updatedContent }));
    setSavingSheet(false);
    setEditMode(false);
  }

  async function generateClassBook() {
    setGeneratingBook(true);
    setGenerateBookError("");
    setGenerateBookDone(false);
    try {
      const res = await apiFetch("/api/studybook/generate-from-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: course.id,
          title: generateBookName.trim() || undefined,
          ...(showMaterials
            ? {
                lectureIds: Array.from(selectedLectureIds),
                noteIds: Array.from(selectedNoteIds),
              }
            : {
                notes: notes.map(n => ({ name: n.name, text: n.text })),
              }),
        }),
      });
      const jobId = res.jobId;
      if (!jobId) throw new Error("No job ID returned");

      generateBookPollRef.current = setInterval(async () => {
        try {
          const job = await apiFetch(`/api/studybook/job/${jobId}`);
          if (job.status === "ready") {
            if (generateBookPollRef.current) clearInterval(generateBookPollRef.current);
            setGeneratingBook(false);
            setGenerateBookDone(true);
            setGenerateBookName("");
            mutateSheets();
          } else if (job.status === "error") {
            if (generateBookPollRef.current) clearInterval(generateBookPollRef.current);
            setGeneratingBook(false);
            setGenerateBookError(job.error ?? "Generation failed — please try again.");
          }
        } catch (_) {}
      }, 4000);
    } catch (e: any) {
      setGeneratingBook(false);
      setGenerateBookError(e?.message ?? "Failed to generate. Make sure you have recorded lectures first.");
    }
  }

  async function addToStudyBook() {
    if (!processingId) return;
    setAddingToBook(true);
    await apiFetch("/api/studybook/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lectureId: processingId }),
    });
    setAddedToBook(true);
    setAddingToBook(false);
  }

  function resetRecorder() {
    setProcessingId(null);
    setProcessingStatus("processing");
    setLectureSheet(null);
    setLectureTranscript("");
    setSeconds(0);
    setRecTitle("");
    setSlidesFile(null);
    setEditMode(false);
    setAddedToBook(false);
    setPaused(false);
    setSavedBlob(null);
    if (savedAudioUrl) URL.revokeObjectURL(savedAudioUrl);
    setSavedAudioUrl(null);
    setPlaying(false);
    setRecordAction(null);
    if (audioElemRef.current) { audioElemRef.current.pause(); audioElemRef.current = null; }
    setProcessingError("");
    setInlineTranscript("");
    setInlineSummary(null);
    setRecStep("name");
    setOpenLectureId(null);
    setOpenLectureData(null);
  }

  async function openLecture(lecture: any) {
    setOpenLectureId(lecture.id);
    setOpenTab("transcript");
    setOpenLectureData(null);
    const transcript = lecture.transcript ?? "";

    let audioUrl: string | null = localAudioUrlsRef.current.get(lecture.id) ?? null;
    if (!audioUrl) {
      try {
        const r = await fetch(`${BASE}/api/lectures/${lecture.id}/audio`, {
          headers: { "x-clerk-user-id": userId ?? "" },
        });
        if (r.ok) {
          const blob = await r.blob();
          audioUrl = URL.createObjectURL(blob);
          localAudioUrlsRef.current.set(lecture.id, audioUrl);
        }
      } catch { /* audio unavailable */ }
    }

    try {
      const sheetRes = await apiFetch(`/api/cheatsheets?lectureId=${lecture.id}`);
      const shts = (sheetRes.data ?? []).filter((s: any) => !s.title?.startsWith("Study Book:"));
      setOpenLectureData({ transcript, sheet: shts[0] ?? null, audioUrl });
    } catch {
      setOpenLectureData({ transcript, sheet: null, audioUrl });
    }
  }

  function closeOpenLecture() {
    setOpenLectureId(null);
    setOpenLectureData(null);
    setOpenTab("transcript");
    setOpenLectureKeyPoints(null);
  }

  async function generateOpenLectureKeyPoints() {
    if (!openLectureId || openLectureKeyPointsLoading) return;
    setOpenLectureKeyPointsLoading(true);
    try {
      const res = await apiFetch("/api/studybook/key-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lectureId: openLectureId }),
      });
      setOpenLectureKeyPoints(res.data.points ?? []);
    } catch { /* silent */ } finally {
      setOpenLectureKeyPointsLoading(false);
    }
  }

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── file upload ──
  type DocView = "idle" | "staging" | "naming" | "processing" | "result" | "editing";
  type QueueItem = { file: File; title: string };
  type BatchResult = { title: string; status: "done" | "error"; error?: string };
  const [docView, setDocView] = useState<DocView>("idle");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("");
  const [docResult, setDocResult] = useState<any | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [docError, setDocError] = useState("");
  const [docTab, setDocTab] = useState<"summary" | "sections" | "terms" | "quiz" | "tips">("summary");
  const [docQuizSelected, setDocQuizSelected] = useState<number | null>(null);
  const [docFlipped, setDocFlipped] = useState<Set<number>>(new Set());
  const [docSaving, setDocSaving] = useState(false);
  const [docSaved, setDocSaved] = useState(false);
  const [docRegenerating, setDocRegenerating] = useState(false);
  const [docSaveChoice, setDocSaveChoice] = useState<"none" | "choosing" | "existing">("none");
  const [editSummary, setEditSummary] = useState("");
  const [editDocSections, setEditDocSections] = useState<{ heading: string; bullets: string }[]>([]);
  const [editDocKeyTerms, setEditDocKeyTerms] = useState("");
  const [docQueue, setDocQueue] = useState<QueueItem[]>([]);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);

  function handleDocFilesSelect(files: FileList) {
    if (files.length === 1) {
      setDocFile(files[0]);
      setDocName(files[0].name.replace(/\.[^.]+$/, ""));
      setDocView("naming");
      setDocError("");
      setDocSaved(false);
      setDocResult(null);
      setDocSaveChoice("none");
    } else {
      const items: QueueItem[] = Array.from(files).map(f => ({ file: f, title: f.name.replace(/\.[^.]+$/, "") }));
      setDocQueue(q => [...q, ...items]);
      setBatchResults([]);
      setDocView("staging");
    }
  }

  function handleDocFileSelect(file: File) {
    setDocFile(file);
    setDocName(file.name.replace(/\.[^.]+$/, ""));
    setDocView("naming");
    setDocError("");
    setDocSaved(false);
    setDocResult(null);
    setDocSaveChoice("none");
  }

  async function saveFiles() {
    if (!docQueue.length) return;
    setBatchProcessing(true);
    const titles = docQueue.map(item => item.title || item.file.name.replace(/\.[^.]+$/, ""));
    const results: BatchResult[] = [];
    try {
      await apiFetch("/api/documents/quick-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titles, courseId: course.id }),
      });
      titles.forEach(title => results.push({ title, status: "done" }));
      await mutateLectures();
    } catch (e: any) {
      titles.forEach(title => results.push({ title, status: "error", error: e?.message ?? "Failed" }));
    }
    setBatchResults(results);
    setBatchProcessing(false);
  }

  async function generateBatch() {
    if (!docQueue.length) return;
    setBatchProcessing(true);
    const results: BatchResult[] = [];
    for (let i = 0; i < docQueue.length; i++) {
      const item = docQueue[i];
      const title = item.title || item.file.name.replace(/\.[^.]+$/, "");
      setBatchProgress({ current: i + 1, total: docQueue.length, name: title });
      try {
        const fd = new FormData();
        fd.append("document", item.file);
        fd.append("title", title);
        fd.append("courseId", course.id);
        const genRes = await apiFetch("/api/documents", { method: "POST", body: fd });
        const { data: content, docId } = genRes;
        await apiFetch("/api/documents/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content, courseId: course.id, docId }),
        });
        results.push({ title, status: "done" });
      } catch (e: any) {
        results.push({ title, status: "error", error: e?.message ?? "Failed" });
      }
    }
    setBatchResults(results);
    setBatchProcessing(false);
    setBatchProgress(null);
    await mutateSheets();
  }

  async function generateDocument() {
    if (!docFile) return;
    setDocView("processing");
    setDocError("");
    try {
      const fd = new FormData();
      fd.append("document", docFile);
      fd.append("title", docName.trim() || docFile.name.replace(/\.[^.]+$/, ""));
      fd.append("courseId", course.id);
      const res = await apiFetch("/api/documents", { method: "POST", body: fd });
      setDocResult(res.data);
      setDocId(res.docId);
      setDocView("result");
    } catch (e: any) {
      setDocError(e?.message ?? "Failed to generate");
      setDocView("naming");
    }
  }

  async function regenerateDocument() {
    if (!docId) return;
    setDocRegenerating(true);
    setDocError("");
    try {
      const res = await apiFetch("/api/documents/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId }),
      });
      setDocResult(res.data);
      setDocSaved(false);
    } catch (e: any) {
      setDocError(e?.message ?? "Regeneration failed");
    } finally {
      setDocRegenerating(false);
    }
  }

  async function saveDocument(content = docResult) {
    setDocSaving(true);
    try {
      await apiFetch("/api/documents/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: docName, content, courseId: course.id, docId }),
      });
      setDocSaved(true);
      setDocSaveChoice("none");
      mutateSheets();
    } catch (e: any) {
      setDocError(e?.message ?? "Failed to save");
    } finally {
      setDocSaving(false);
    }
  }

  async function saveToExistingStudyBook(targetSbId: string) {
    const targetSb = studyBooks.find((sb: any) => sb.id === targetSbId);
    if (!targetSb || !docResult) return;
    setDocSaving(true);
    const existing = targetSb.content as any;
    const isStudybookType = existing?._type === "studybook";
    let updatedContent: any;
    if (isStudybookType) {
      const newChapter = {
        number: (existing.chapters ?? []).length + 1,
        title: docName,
        timestamp: "00:00",
        explanation: docResult.summary ?? "",
        keyPoints: (docResult.sections ?? []).flatMap((s: any) => s.bullets ?? []),
        keyTerms: docResult.keyTerms ?? [],
        analogy: null,
        flashcards: [],
        examQuestions: (docResult.practiceQuestions ?? []).map((pq: any) => ({
          type: "short",
          question: pq.question,
          options: null,
          correctAnswer: pq.answer ?? "",
          explanation: "",
        })),
      };
      updatedContent = {
        ...existing,
        chapters: [...(existing.chapters ?? []), newChapter],
        glossary: [
          ...(existing.glossary ?? []),
          ...(docResult.keyTerms ?? []).map((kt: any) => ({ term: kt.term, definition: kt.definition, highYield: false })),
        ],
      };
    } else {
      updatedContent = {
        ...existing,
        sections: [...(existing.sections ?? []), ...(docResult.sections ?? [])],
        keyTerms: [...(existing.keyTerms ?? []), ...(docResult.keyTerms ?? [])],
      };
    }
    try {
      await apiFetch(`/api/cheatsheets/${targetSbId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: updatedContent }),
      });
      setDocSaved(true);
      setDocSaveChoice("none");
      mutateSheets();
    } catch (e: any) {
      setDocError(e?.message ?? "Failed to save");
    } finally {
      setDocSaving(false);
    }
  }

  function enterEditMode() {
    setEditSummary(docResult?.summary ?? "");
    setEditDocSections((docResult?.sections ?? []).map((s: any) => ({
      heading: s.heading ?? "",
      bullets: (s.bullets ?? []).join("\n"),
    })));
    setEditDocKeyTerms((docResult?.keyTerms ?? []).map((kt: any) => `${kt.term}: ${kt.definition}`).join("\n"));
    setDocView("editing");
  }

  function saveEditedDocument() {
    const updatedContent = {
      ...docResult,
      summary: editSummary,
      sections: editDocSections.map(s => ({
        heading: s.heading,
        bullets: s.bullets.split("\n").map((b: string) => b.trim()).filter(Boolean),
      })),
      keyTerms: editDocKeyTerms.split("\n").filter(Boolean).map((line: string) => {
        const idx = line.indexOf(":");
        return idx > -1
          ? { term: line.slice(0, idx).trim(), definition: line.slice(idx + 1).trim() }
          : { term: line.trim(), definition: "" };
      }),
    };
    setDocResult(updatedContent);
    setDocView("result");
    saveDocument(updatedContent);
  }

  // ── youtube video ──
  const [ytDraft, setYtDraft] = useState("");
  const [ytUrl, setYtUrl] = useState(initialYtState?.url ?? "");
  const [ytVideoId, setYtVideoId] = useState<string | null>(initialYtState?.videoId ?? null);
  const [ytTitle, setYtTitle] = useState("");
  const [ytLectureId, setYtLectureId] = useState<string | null>(null);
  const [ytTranscript, setYtTranscript] = useState("");
  const [ytTranscriptLoading, setYtTranscriptLoading] = useState(false);
  const [ytActiveTab, setYtActiveTab] = useState<"transcript" | "quiz" | "summary" | "note" | "chatbot" | "flashcards" | "keypoints">("transcript");
  const [ytQuizName, setYtQuizName] = useState("");
  const [ytQuizLoading, setYtQuizLoading] = useState(false);
  const [ytQuizSaved, setYtQuizSaved] = useState(false);
  const [ytInlineQuiz, setYtInlineQuiz] = useState<any[] | null>(null);
  const [ytInlineQuizLoading, setYtInlineQuizLoading] = useState(false);
  const [ytQuizRevealed, setYtQuizRevealed] = useState<Set<number>>(new Set());
  const [ytKeyPoints, setYtKeyPoints] = useState<any[] | null>(null);
  const [ytKeyPointsLoading, setYtKeyPointsLoading] = useState(false);
  const [ytSummary, setYtSummary] = useState("");
  const [ytSummaryLoading, setYtSummaryLoading] = useState(false);
  const [ytNote, setYtNote] = useState("");
  const [ytFlashcards, setYtFlashcards] = useState<any[] | null>(null);
  const [ytFlashcardsLoading, setYtFlashcardsLoading] = useState(false);
  const [ytFlipped, setYtFlipped] = useState<Set<number>>(new Set());
  const [ytMessages, setYtMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [ytChatInput, setYtChatInput] = useState("");
  const [ytChatLoading, setYtChatLoading] = useState(false);
  const [ytError, setYtError] = useState("");
  const [ytNoteNaming, setYtNoteNaming] = useState(false);
  const [ytNoteName, setYtNoteName] = useState("");
  const [ytNoteSaved, setYtNoteSaved] = useState(false);

  function confirmYtUrl() {
    const url = ytDraft.trim();
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([^&?\s/]+)/);
    const id = m?.[1] ?? null;
    if (!id) { setYtError("Invalid YouTube URL"); return; }
    setYtUrl(url);
    setYtVideoId(id);
    setYtTranscript(""); setYtLectureId(null); setYtQuizName(""); setYtQuizSaved(false);
    setYtTitle(""); setYtSummary(""); setYtFlashcards(null); setYtMessages([]); setYtNote(""); setYtError("");
    setYtInlineQuiz(null); setYtQuizRevealed(new Set()); setYtKeyPoints(null);
  }

  function handleYtUrl(url: string) {
    setYtDraft("");
    setYtUrl(url);
    setYtVideoId(null);
    setYtTranscript(""); setYtLectureId(null); setYtQuizName(""); setYtQuizSaved(false);
    setYtTitle(""); setYtSummary(""); setYtFlashcards(null); setYtMessages([]); setYtNote(""); setYtError("");
  }

  async function ensureLecture(): Promise<string | null> {
    if (ytLectureId) return ytLectureId;
    setYtTranscriptLoading(true);
    setYtError("");
    try {
      const res = await apiFetch("/api/studybook/fetch-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ytUrl, courseId: course.id }),
      });
      setYtLectureId(res.data.lectureId);
      setYtTitle(res.data.title);
      setYtTranscript(res.data.transcript);
      return res.data.lectureId;
    } catch (e: any) {
      setYtError(e?.message ?? "Failed to fetch transcript");
      return null;
    } finally {
      setYtTranscriptLoading(false);
    }
  }

  async function loadTranscript() {
    if (ytTranscript || ytTranscriptLoading) return;
    await ensureLecture();
  }

  async function generateYtQuiz() {
    if (!ytQuizName.trim()) return;
    setYtQuizLoading(true); setYtError("");
    try {
      const lid = await ensureLecture();
      if (!lid) return;
      await apiFetch("/api/quizzes/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lectureId: lid, title: ytQuizName.trim() }),
      });
      await mutateQuizzes();
      setYtQuizSaved(true);
    } catch (e: any) {
      setYtError(e?.message ?? "Failed to generate quiz");
    } finally { setYtQuizLoading(false); }
  }

  async function generateYtInlineQuiz() {
    setYtInlineQuizLoading(true); setYtQuizRevealed(new Set()); setYtError("");
    try {
      const lid = await ensureLecture();
      if (!lid) return;
      const res = await apiFetch("/api/studybook/inline-quiz", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lectureId: lid }),
      });
      setYtInlineQuiz(res.data.questions ?? []);
    } catch (e: any) {
      setYtError(e?.message ?? "Failed to generate quiz");
    } finally { setYtInlineQuizLoading(false); }
  }

  async function generateYtKeyPoints() {
    setYtKeyPointsLoading(true); setYtError("");
    try {
      const lid = await ensureLecture();
      if (!lid) return;
      const res = await apiFetch("/api/studybook/key-points", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lectureId: lid }),
      });
      setYtKeyPoints(res.data.points ?? []);
    } catch (e: any) {
      setYtError(e?.message ?? "Failed to generate key points");
    } finally { setYtKeyPointsLoading(false); }
  }

  async function generateYtSummary() {
    setYtSummaryLoading(true); setYtError("");
    try {
      const lid = await ensureLecture();
      if (!lid) return;
      const res = await apiFetch("/api/studybook/summarize", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lectureId: lid }),
      });
      setYtSummary(res.data.summary);
    } catch (e: any) {
      setYtError(e?.message ?? "Failed to summarize");
    } finally { setYtSummaryLoading(false); }
  }

  async function generateYtFlashcards() {
    setYtFlashcardsLoading(true); setYtFlipped(new Set()); setYtError("");
    try {
      const lid = await ensureLecture();
      if (!lid) return;
      const res = await apiFetch("/api/studybook/flashcards", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lectureId: lid }),
      });
      setYtFlashcards(res.data.flashcards ?? []);
    } catch (e: any) {
      setYtError(e?.message ?? "Failed to generate flashcards");
    } finally { setYtFlashcardsLoading(false); }
  }

  async function sendYtChat() {
    if (!ytChatInput.trim() || ytChatLoading) return;
    const userMsg = { role: "user" as const, content: ytChatInput.trim() };
    const next = [...ytMessages, userMsg];
    setYtMessages(next); setYtChatInput(""); setYtChatLoading(true); setYtError("");
    try {
      const lid = await ensureLecture();
      if (!lid) return;
      const res = await apiFetch("/api/studybook/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lectureId: lid, messages: next }),
      });
      setYtMessages([...next, { role: "assistant", content: res.data.reply }]);
    } catch (e: any) {
      setYtError(e?.message ?? "Failed to send message");
    } finally { setYtChatLoading(false); }
  }

  async function saveYtNote(name: string) {
    if (!ytNote.trim() || !name.trim()) return;
    await apiFetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: course.id, name: name.trim() }),
    }).then(async (res) => {
      await apiFetch(`/api/notes/${res.data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ytNote }),
      });
      mutateNotes();
    });
    setYtNoteNaming(false);
    setYtNoteName("");
    setYtNote("");
    setYtNoteSaved(true);
    setTimeout(() => setYtNoteSaved(false), 3000);
  }

  // ── notes (database) ──
  type NoteEntry = { id: string; name: string; text: string; updatedAt: string };
  const { data: notesData, mutate: mutateNotes } = useSWR(
    visitedTabs.has("note") || visitedTabs.has("studybook") ? `${BASE}/api/notes?courseId=${course.id}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const notes: NoteEntry[] = notesData?.data ?? [];
  const [noteView, setNoteView] = useState<"list" | "create" | "edit">("list");
  const [activeNote, setActiveNote] = useState<NoteEntry | null>(null);
  const [newNoteName, setNewNoteName] = useState("");
  const [noteSavedAt, setNoteSavedAt] = useState<Date | null>(null);
  const noteSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function createNote() {
    if (!newNoteName.trim()) return;
    const res = await apiFetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: course.id, name: newNoteName.trim() }),
    });
    const entry = res.data;
    await mutateNotes();
    setActiveNote(entry);
    setNewNoteName("");
    setNoteView("edit");
  }

  function handleNoteChange(val: string) {
    if (!activeNote) return;
    const updated = { ...activeNote, text: val, updatedAt: new Date().toISOString() };
    setActiveNote(updated);
    if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current);
    noteSaveTimer.current = setTimeout(async () => {
      await apiFetch(`/api/notes/${updated.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: val }),
      });
      mutateNotes();
      setNoteSavedAt(new Date());
    }, 800);
  }

  async function saveNoteNow() {
    if (!activeNote) return;
    if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current);
    await apiFetch(`/api/notes/${activeNote.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: activeNote.text }),
    });
    mutateNotes();
    setNoteSavedAt(new Date());
    setNoteView("list");
  }

  async function deleteNote(id: string) {
    await apiFetch(`/api/notes/${id}`, { method: "DELETE" });
    mutateNotes();
    if (activeNote?.id === id) { setActiveNote(null); setNoteView("list"); }
  }

  // ── study book helpers ──
  function openSb(sb: any) {
    setActiveSb(sb);
    setSbView("detail");
    setSbEditMode(false);
    setSbQuizMode(false);
    setSbQuizDone(false);
    setSbQuizName("");
    setExpandedChapters(new Set());
    setExpandedSbSections({ glossary: false, flashcards: false, examQ: false, tips: false, practiceQ: false });
  }

  function closeSb() {
    setSbView("list");
    setActiveSb(null);
    setSbEditMode(false);
    setSbQuizMode(false);
    setSbQuizDone(false);
  }

  function enterSbEditMode() {
    if (!activeSb) return;
    const c = activeSb.content as any;
    const isStudybookType = c?._type === "studybook";
    setSbEditSummary(isStudybookType ? (c?.executiveSummary ?? "") : (c?.summary ?? ""));
    setSbEditSections(
      isStudybookType
        ? (c?.chapters ?? []).map((ch: any) => ({ heading: ch.title ?? "", bullets: (ch.keyPoints ?? []).join("\n") }))
        : (c?.sections ?? []).map((s: any) => ({ heading: s.heading ?? "", bullets: (s.bullets ?? []).join("\n") }))
    );
    setSbEditKeyTerms(
      isStudybookType
        ? (c?.glossary ?? []).map((g: any) => `${g.term}: ${g.definition}`).join("\n")
        : (c?.keyTerms ?? []).map((kt: any) => `${kt.term}: ${kt.definition}`).join("\n")
    );
    setSbEditMode(true);
  }

  async function saveSbEdit() {
    if (!activeSb) return;
    setSbSaving(true);
    const c = activeSb.content as any;
    const isStudybookType = c?._type === "studybook";
    const parsedKeyTerms = sbEditKeyTerms.split("\n").filter(Boolean).map((line: string) => {
      const idx = line.indexOf(":");
      return idx > -1 ? { term: line.slice(0, idx).trim(), definition: line.slice(idx + 1).trim() } : { term: line.trim(), definition: "" };
    });
    let updatedContent: any;
    if (isStudybookType) {
      updatedContent = {
        ...c,
        executiveSummary: sbEditSummary,
        chapters: (c.chapters ?? []).map((ch: any, i: number) => {
          const edited = sbEditSections[i];
          if (!edited) return ch;
          return { ...ch, title: edited.heading, keyPoints: edited.bullets.split("\n").map((b: string) => b.trim()).filter(Boolean) };
        }),
        glossary: parsedKeyTerms.map(kt => ({ ...kt, highYield: false })),
      };
    } else {
      updatedContent = {
        ...c,
        summary: sbEditSummary,
        sections: sbEditSections.map(s => ({
          heading: s.heading,
          bullets: s.bullets.split("\n").map((b: string) => b.trim()).filter(Boolean),
        })),
        keyTerms: parsedKeyTerms,
      };
    }
    try {
      await apiFetch(`/api/cheatsheets/${activeSb.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: updatedContent }),
      });
      setActiveSb((prev: any) => ({ ...prev, content: updatedContent }));
      setSbEditMode(false);
      mutateSheets();
    } catch (e: any) {
      alert(e?.message ?? "Failed to save");
    } finally {
      setSbSaving(false);
    }
  }

  async function generateSbQuiz() {
    if (!activeSb?.lectureId || !sbQuizName.trim()) return;
    setSbQuizGenerating(true);
    try {
      await apiFetch("/api/quizzes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lectureId: activeSb.lectureId, title: sbQuizName.trim() }),
      });
      await mutateQuizzes();
      setSbQuizDone(true);
      setSbQuizMode(false);
    } catch (e: any) {
      alert("Failed: " + (e?.message ?? String(e)));
    } finally {
      setSbQuizGenerating(false);
    }
  }

  // ── archive ──
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const { data: archivedData, mutate: mutateArchived } = useSWR(
    visitedTabs.has("record") && openLectureId === null ? `${BASE}/api/lectures?courseId=${course.id}&archived=true` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const archivedLectures: any[] = archivedData?.data ?? [];

  async function archiveLecture(id: string) {
    await apiFetch(`/api/lectures/${id}/archive`, { method: "PATCH" });
    setConfirmArchiveId(null);
    mutateLectures();
    mutateArchived();
  }

  async function restoreLecture(id: string) {
    await apiFetch(`/api/lectures/${id}/restore`, { method: "PATCH" });
    mutateLectures();
    mutateArchived();
  }

  async function permanentlyDelete(id: string) {
    await apiFetch(`/api/lectures/${id}`, { method: "DELETE" });
    mutateArchived();
  }

  // ── quiz generate ──
  const [selectedLecture, setSelectedLecture] = useState<string | null>(null);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [quizDone, setQuizDone] = useState(false);

  async function generateQuiz() {
    if (!selectedLecture) return;
    setGeneratingQuiz(true);
    try {
      await apiFetch("/api/quizzes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lectureId: selectedLecture }),
      });
      await mutateQuizzes();
      setQuizDone(true);
    } catch (e: any) {
      alert("Failed: " + (e?.message ?? String(e)));
    } finally {
      setGeneratingQuiz(false);
    }
  }

  const TABS = [
    { key: "record",    label: t.workspace.tabs.record,    icon: Mic2     },
    { key: "files",     label: t.workspace.tabs.files,     icon: FileText },
    { key: "quizzes",   label: t.workspace.tabs.quizzes,   icon: BookOpen },
    { key: "video",     label: t.workspace.tabs.video,     icon: Youtube  },
    { key: "studybook", label: "Review", icon: BookMarked },
    { key: "note",      label: t.workspace.tabs.note,      icon: PenLine  },
  ] as const;

  return (
    <div className="w-full min-h-full flex justify-center">
    <div className="w-full max-w-5xl px-3 py-5 md:px-6 md:py-8">
      {/* Header */}
      <div className="mb-8">
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#3b82f6", marginBottom: 14 }}>
          Workspace
        </div>
        {/* Class pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {allCourses.map(c => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className="whitespace-nowrap transition-all"
              style={c.id === course.id
                ? { padding: "10px 22px", borderRadius: 999, fontSize: 15, fontWeight: 700, background: "#2563eb", color: "white", border: "none" }
                : { padding: "10px 22px", borderRadius: 999, fontSize: 15, fontWeight: 500, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.12)" }
              }
            >
              {c.name}
            </button>
          ))}
          <button
            onClick={onBack}
            className="whitespace-nowrap transition-all"
            style={{ padding: "10px 18px", borderRadius: 999, fontSize: 14, fontWeight: 500, background: "transparent", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            ← All classes
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            className="flex items-center gap-2 whitespace-nowrap transition-all"
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              fontSize: 15,
              fontWeight: tab === key ? 700 : 500,
              background: tab === key ? "#2563eb" : "rgba(255,255,255,0.07)",
              color: tab === key ? "white" : "rgba(255,255,255,0.5)",
              border: tab === key ? "none" : "1px solid rgba(255,255,255,0.1)",
              letterSpacing: "-0.01em",
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── RECORD ── */}
      {tab === "record" && (
        <div className="space-y-4">
          <style>{`
            @keyframes waveBar {
              0%, 100% { transform: scaleY(0.25); }
              50% { transform: scaleY(1); }
            }
            @keyframes ringPulse {
              0% { transform: scale(1); opacity: 0.5; }
              100% { transform: scale(2.4); opacity: 0; }
            }
          `}</style>

          {/* ── Open lecture detail screen ── */}
          {openLectureId ? (
            <div>
              <button onClick={closeOpenLecture} className="flex items-center gap-2 text-sm text-[#555] hover:text-[#111110] transition-colors mb-6">
                <ArrowLeft size={14} /> Back to recordings
              </button>
              {openLectureData === null ? (
                <div className="flex items-center gap-3 text-sm text-[#555] py-8">
                  <Loader2 size={16} className="animate-spin" /> Loading…
                </div>
              ) : (
                <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl overflow-hidden">
                  <div className="px-6 py-5 border-b border-[rgba(0,0,0,0.06)]">
                    <div className="text-lg font-medium text-[#111110]">
                      {audioLectures.find(l => l.id === openLectureId)?.title ?? "Recording"}
                    </div>
                    <div className="text-xs text-[#888] mt-0.5">
                      {(() => { const l = audioLectures.find(l => l.id === openLectureId); return l ? format(new Date(l.recordedAt), "MMMM d, yyyy") : ""; })()}
                    </div>
                  </div>
                  {/* Sticky audio player — always visible */}
                  {openLectureData.audioUrl ? (
                    <div className="px-6 py-3 border-b border-[rgba(0,0,0,0.06)] sticky top-0 z-10 bg-white">
                      <audio
                        ref={openAudioRef}
                        src={openLectureData.audioUrl}
                        controls
                        className="w-full"
                        onPlay={async () => {
                          try {
                            if ("wakeLock" in navigator && !wakeLockRef.current) {
                              wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
                            }
                          } catch {}
                        }}
                        onPause={() => {
                          wakeLockRef.current?.release().catch(() => {});
                          wakeLockRef.current = null;
                        }}
                        onEnded={() => {
                          wakeLockRef.current?.release().catch(() => {});
                          wakeLockRef.current = null;
                        }}
                      />
                    </div>
                  ) : (
                    <div className="px-6 py-3 border-b border-[rgba(0,0,0,0.06)] text-sm text-[#888]">Audio not available.</div>
                  )}
                  {/* Tabs */}
                  <div className="flex gap-2 overflow-x-auto p-3" style={{ background: "rgba(37,99,235,0.05)", borderBottom: "1px solid rgba(37,99,235,0.12)" }}>
                    {(([
                      { key: "transcript" as const, label: "Transcript" },
                      { key: "summary" as const,    label: "Summary"    },
                      { key: "keypoints" as const,  label: "Key Points" },
                    ])).map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => {
                          setOpenTab(key);
                          if (key === "keypoints" && !openLectureKeyPoints) generateOpenLectureKeyPoints();
                        }}
                        className="shrink-0 whitespace-nowrap transition-all"
                        style={{
                          padding: "10px 20px",
                          borderRadius: 999,
                          fontSize: 15,
                          fontWeight: openTab === key ? 700 : 500,
                          background: openTab === key ? "#2563eb" : "rgba(255,255,255,0.8)",
                          color: openTab === key ? "white" : "rgba(0,0,0,0.5)",
                          border: openTab === key ? "none" : "1px solid rgba(0,0,0,0.1)",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="relative overflow-hidden" style={{ height: 460 }}>
                    {openTab === "transcript" && (
                      <div className="absolute inset-0 overflow-y-auto px-6 py-6">
                        <p className="text-sm text-[#444] leading-[1.85] whitespace-pre-wrap">
                          {openLectureData.transcript || "Transcript not available."}
                        </p>
                      </div>
                    )}
                    {openTab === "keypoints" && (
                      <div className="absolute inset-0 overflow-y-auto px-6 py-6">
                        {openLectureKeyPointsLoading ? (
                          <div className="h-full flex flex-col items-center justify-center gap-3">
                            <Loader2 size={18} className="animate-spin text-[#bbb]" />
                            <span className="text-sm text-[#aaa]">Generating key points…</span>
                          </div>
                        ) : openLectureKeyPoints ? (
                          <div className="space-y-2">
                            {openLectureKeyPoints.map((kp: any, i: number) => {
                              const colors: Record<string, string> = { Definition: "#3b82f6", Important: "#f97316", Formula: "#8b5cf6", Example: "#22c55e", Warning: "#ef4444" };
                              const bg: Record<string, string> = { Definition: "rgba(59,130,246,0.06)", Important: "rgba(249,115,22,0.06)", Formula: "rgba(139,92,246,0.06)", Example: "rgba(34,197,94,0.06)", Warning: "rgba(239,68,68,0.06)" };
                              const color = colors[kp.category] ?? "#6b7280";
                              const background = bg[kp.category] ?? "rgba(107,114,128,0.06)";
                              return (
                                <div key={i} className="rounded-xl px-4 py-3 flex gap-3 items-start" style={{ background }}>
                                  <span className="text-[9px] font-bold uppercase tracking-widest mt-1 shrink-0 px-1.5 py-0.5 rounded" style={{ color, background: `${color}22` }}>{kp.category}</span>
                                  <span className="text-sm text-[#333] leading-relaxed">{kp.point}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center gap-4">
                            <p className="text-sm text-[#aaa]">Generate key points from this lecture</p>
                            <button onClick={generateOpenLectureKeyPoints} className="px-5 py-2.5 rounded-full text-sm font-semibold text-white" style={{ background: "#2563eb" }}>
                              Generate Key Points
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {openTab === "summary" && (
                      <div className="absolute inset-0 overflow-y-auto px-6 py-6">
                        {openLectureData.sheet ? (
                          <div className="space-y-6">
                            {(openLectureData.sheet.content?.sections ?? []).slice(0, 3).map((s: any, i: number) => (
                              <div key={i} className="border-l-2 border-[rgba(37,99,235,0.2)] pl-4">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#2563eb] mb-2">{s.heading}</div>
                                <ul className="space-y-2">
                                  {(s.bullets ?? []).slice(0, 4).map((b: string, j: number) => (
                                    <li key={j} className="flex gap-2 text-sm text-[#444] leading-[1.75]">
                                      <span className="text-[#ccc] shrink-0 mt-0.5">·</span>{b}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                            {(openLectureData.sheet.content?.keyTerms ?? []).length > 0 && (
                              <div className="border-l-2 border-[rgba(0,0,0,0.08)] pl-4">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#888] mb-2">Key Terms</div>
                                <div className="space-y-2">
                                  {(openLectureData.sheet.content.keyTerms ?? []).map((kt: any, i: number) => (
                                    <div key={i} className="flex gap-2 text-sm">
                                      <span className="font-semibold text-[#333] shrink-0">{kt.term}:</span>
                                      <span className="text-[#666]">{kt.definition}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-sm text-[#aaa]">Summary not available.</div>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* ── Step: name ── */}
              {recStep === "name" && (
                <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-8 flex flex-col items-center gap-5">
                  <div className="w-full space-y-2">
                    <label className="text-[10px] text-[#555] uppercase tracking-widest block">Recording Name</label>
                    <input
                      autoFocus
                      value={recTitle}
                      onChange={e => setRecTitle(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && recTitle.trim() && startRecording()}
                      placeholder="e.g. Lecture 3 — Cell Division"
                      className="w-full bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-sm text-[#111110] placeholder-[rgba(0,0,0,0.3)] outline-none focus:border-[rgba(0,0,0,0.18)]"
                    />
                    <p className="text-xs text-[#888]">{format(new Date(), "MMMM d, yyyy")}</p>
                  </div>
                  <button
                    onClick={startRecording}
                    disabled={!recTitle.trim()}
                    className="w-16 h-16 rounded-full flex items-center justify-center bg-[rgba(0,0,0,0.06)] hover:bg-[rgba(0,0,0,0.1)] transition-colors disabled:opacity-30"
                  >
                    <Mic size={22} className="text-[#111110]" />
                  </button>
                  <p className="text-xs text-[#888]">{recTitle.trim() ? "Tap to start recording" : "Enter a name to start"}</p>
                </div>
              )}

              {/* ── Step: recording ── */}
              {recStep === "recording" && (
                <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-8 flex flex-col items-center gap-4">
                  <div className="text-xs text-[#888] self-start font-medium">{recTitle}</div>
                  <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 64, fontWeight: 400, color: "#111110", letterSpacing: -2, fontVariantNumeric: "tabular-nums" }}>{fmt(seconds)}</div>
                  <div className="flex items-end gap-0.5 h-12 my-1" style={{ opacity: paused ? 0.2 : 1, transition: "opacity 0.3s" }}>
                    {waveHeights.current.map((h, i) => (
                      <div key={i} style={{ width: 3, height: 48, borderRadius: 2, background: "#111110", transformOrigin: "center", animation: paused ? "none" : `waveBar ${waveDurations.current[i]}s ease-in-out infinite`, animationDelay: `${i * 0.04}s`, transform: paused ? "scaleY(0.25)" : undefined }} />
                    ))}
                  </div>
                  <div className="flex gap-3 w-full">
                    <button
                      onClick={paused ? resumeRecording : pauseRecording}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-[rgba(0,0,0,0.12)] hover:bg-[rgba(0,0,0,0.03)] transition-colors"
                    >
                      {paused ? <Play size={16} className="text-[#111110]" /> : <Pause size={16} className="text-[#111110]" />}
                      <span className="text-sm font-medium text-[#111110]">{paused ? "Resume" : "Pause"}</span>
                    </button>
                    <button
                      onClick={stopRecording}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#111110] hover:opacity-90 transition-opacity"
                    >
                      <StopCircle size={16} className="text-white" />
                      <span className="text-sm font-medium text-white">Stop</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step: saved ── */}
              {recStep === "saved" && (
                <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={15} className="text-green-500" />
                    <span className="text-sm font-medium text-[#111110]">{recTitle || "Recording"}</span>
                    <span className="ml-auto text-xs text-[#888]">{fmt(seconds)}</span>
                  </div>
                  <button
                    onClick={playAudio}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[rgba(0,0,0,0.08)] hover:bg-[rgba(0,0,0,0.02)] transition-colors"
                  >
                    {playing ? <Pause size={15} className="text-[#111110]" /> : <Play size={15} className="text-[#111110]" />}
                    <span className="text-sm text-[#111110]">{playing ? "Pause" : "Listen to recording"}</span>
                  </button>
                  {processingError && (
                    <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">{processingError}</div>
                  )}
                  <button
                    onClick={processAudio}
                    disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#111110] hover:opacity-90 transition-opacity disabled:opacity-40"
                  >
                    {uploading ? <Loader2 size={16} className="animate-spin text-white" /> : <Sparkles size={16} className="text-white" />}
                    <span className="text-base font-medium text-white">Process Audio</span>
                  </button>
                  <button onClick={resetRecorder} className="w-full text-xs text-[rgba(0,0,0,0.3)] hover:text-[#555] transition-colors">
                    Discard recording
                  </button>
                </div>
              )}

              {/* ── Step: processing ── */}
              {recStep === "processing" && (
                <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-16 flex flex-col items-center gap-6">
                  <div className="relative flex items-center justify-center w-28 h-28">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="absolute rounded-full border border-[rgba(0,0,0,0.1)]" style={{
                        width: 40 + i * 22,
                        height: 40 + i * 22,
                        animation: `ringPulse 2s ease-out ${i * 0.45}s infinite`,
                      }} />
                    ))}
                    <Loader2 size={22} className="animate-spin text-[#111110] relative z-10" />
                  </div>
                  <div className="text-center space-y-1">
                    <div className="text-sm font-medium text-[#111110]">Processing your audio…</div>
                    <div className="text-xs text-[#888]">
                      {processingStatus === "transcribing"
                        ? "Converting speech to text"
                        : processingStatus === "generating"
                        ? "AI is building your summary"
                        : "Uploading audio"}
                    </div>
                  </div>
                  <div className="flex items-end gap-0.5 h-6 opacity-20">
                    {waveHeights.current.slice(0, 14).map((_, i) => (
                      <div key={i} style={{ width: 3, height: 24, borderRadius: 2, background: "#111110", transformOrigin: "center", animation: `waveBar ${waveDurations.current[i]}s ease-in-out infinite`, animationDelay: `${i * 0.07}s` }} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Step: done ── */}
              {recStep === "done" && (
                <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-12 flex flex-col items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                    <CheckCircle size={24} className="text-green-500" />
                  </div>
                  <div className="text-center">
                    <div className="text-base font-medium text-[#111110] mb-1">Processing complete!</div>
                    <div className="text-sm text-[#888]">Your recording is ready. Open it from the list below.</div>
                  </div>
                </div>
              )}

              {/* ── Recordings list ── */}
              {audioLectures.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-[#555] uppercase tracking-widest mb-3">Recordings</p>
                  <div className="space-y-2">
                    {audioLectures.map(l => (
                      <div key={l.id} className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 transition-all" style={{ borderColor: confirmArchiveId === l.id ? "rgba(239,68,68,0.25)" : undefined }}>
                        {confirmArchiveId === l.id ? (
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs text-[#555] flex-1">Delete <span className="font-medium text-[#111110]">"{l.title}"</span>?</p>
                            <div className="flex items-center gap-2 shrink-0">
                              <button onClick={() => setConfirmArchiveId(null)} className="text-xs px-3 py-1.5 rounded-lg text-[#555] hover:text-[#111110] transition-colors">Cancel</button>
                              <button onClick={() => archiveLecture(l.id)} className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors">Delete</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[rgba(0,0,0,0.04)]">
                              <Mic2 size={12} className="text-[#444]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-[#111110] truncate">{l.title}</div>
                              <div className="text-xs text-[#888] mt-0.5">{format(new Date(l.recordedAt), "MMM d, yyyy")}</div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {l.status === "ready" ? (
                                <button
                                  onClick={() => openLecture(l)}
                                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[rgba(0,0,0,0.06)] text-[#111110] hover:bg-[rgba(0,0,0,0.1)] transition-colors"
                                >
                                  Open
                                </button>
                              ) : l.status === "error" ? (
                                <span className="text-[9px] font-semibold text-red-400 px-2 py-0.5 rounded-full bg-red-50">Failed</span>
                              ) : (
                                <span className="text-[9px] font-semibold text-[#555] px-2 py-0.5 rounded-full bg-[rgba(0,0,0,0.05)] flex items-center gap-1">
                                  <Loader2 size={8} className="animate-spin" /> Processing
                                </span>
                              )}
                              <button
                                onClick={() => setConfirmArchiveId(l.id)}
                                className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                style={{ color: "rgba(0,0,0,0.3)" }}
                                title="Delete recording"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── FILES ── */}
      {tab === "files" && (
        <div className="space-y-4">

          {/* upload area — always visible unless processing/done */}
          {(docView === "idle" || docView === "staging") && !batchProgress && batchResults.length === 0 && (
            <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl overflow-hidden">
              {/* Drop zone */}
              <label className="flex flex-col items-center gap-3 border-2 border-dashed border-[rgba(0,0,0,0.08)] rounded-2xl m-4 p-10 cursor-pointer transition-colors hover:border-[rgba(0,0,0,0.15)] text-[#555] hover:text-[#111110]">
                <FileUp size={28} />
                <div className="text-center">
                  <div className="text-sm font-medium mb-0.5">Click to add documents</div>
                  <div className="text-xs text-[#555]">PDF, Word, PowerPoint, Excel, OpenDocument, images, TXT — add as many as you need</div>
                </div>
                <input type="file" accept=".pdf,.txt,.md,.csv,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.odt,.odp,.ods,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif" className="hidden" multiple
                  onChange={e => {
                    if (!e.target.files?.length) return;
                    handleDocFilesSelect(e.target.files);
                    e.target.value = "";
                  }} />
              </label>

              {/* File list */}
              {docQueue.length > 0 && (
                <>
                  <div className="divide-y divide-[rgba(0,0,0,0.06)] mx-4">
                    {docQueue.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 py-3">
                        <FileText size={13} className="text-[#555] shrink-0" />
                        <span className="flex-1 text-sm text-[#111110] truncate">{item.file.name}</span>
                        <span className="text-[10px] text-[#555] shrink-0">{(item.file.size / 1024).toFixed(0)} KB</span>
                        <button onClick={() => setDocQueue(q => q.filter((_, j) => j !== i))} className="text-[#555] hover:text-red-400 transition-colors shrink-0 p-1">
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-4 border-t border-[rgba(0,0,0,0.06)] flex items-center gap-3">
                    <button
                      onClick={saveFiles}
                      disabled={batchProcessing}
                      className="flex items-center gap-2 bg-[#111110] text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-[#222] transition-colors disabled:opacity-40"
                    >
                      Save ({docQueue.length})
                    </button>
                    <button
                      onClick={generateBatch}
                      disabled={batchProcessing}
                      className="flex items-center gap-2 border border-[rgba(0,0,0,0.12)] text-[#111110] text-sm font-medium px-5 py-2.5 rounded-full hover:bg-[rgba(0,0,0,0.04)] transition-colors disabled:opacity-40"
                    >
                      Process files
                    </button>
                    <button onClick={() => { setDocQueue([]); setDocView("idle"); }} className="text-xs text-[#555] hover:text-[#111110] transition-colors ml-auto">
                      Clear
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* batch processing */}
          {batchProgress && (
            <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-12 text-center">
              <Loader2 size={28} className="mx-auto mb-4 animate-spin text-[#555]" />
              <div className="text-sm font-medium text-[#111110] mb-1">Processing {batchProgress.current} of {batchProgress.total}</div>
              <div className="text-xs text-[#555]">Generating "{batchProgress.name}"…</div>
              <div className="mt-4 h-1 rounded-full bg-[rgba(0,0,0,0.06)] overflow-hidden">
                <div className="h-1 rounded-full bg-[#111110] transition-all" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }} />
              </div>
            </div>
          )}

          {/* batch results */}
          {batchResults.length > 0 && !batchProgress && (
            <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl overflow-hidden">
              <div className="px-6 py-5 border-b border-[rgba(0,0,0,0.08)]">
                <div className="text-sm font-medium text-[#111110]">
                  {batchResults.filter(r => r.status === "done").length} of {batchResults.length} generated
                </div>
              </div>
              <div className="divide-y divide-[rgba(0,0,0,0.06)]">
                {batchResults.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 px-6 py-3">
                    {r.status === "done"
                      ? <CheckCircle size={14} className="text-green-500 shrink-0" />
                      : <X size={14} className="text-red-400 shrink-0" />}
                    <span className="text-sm text-[#111110] flex-1 truncate">{r.title}</span>
                    <span className="text-xs text-[#555]">{r.status === "done" ? "Saved" : r.error}</span>
                  </div>
                ))}
              </div>
              <div className="px-6 py-4 border-t border-[rgba(0,0,0,0.06)]">
                <button
                  onClick={() => { setDocView("idle"); setDocQueue([]); setBatchResults([]); }}
                  className="text-xs text-[#555] hover:text-[#111110] transition-colors"
                >
                  Upload more
                </button>
              </div>
            </div>
          )}

          {/* naming — ask for file name */}
          {docView === "naming" && (
            <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-8 max-w-lg">
              <button onClick={() => setDocView("idle")} className="flex items-center gap-2 text-[#555] hover:text-[#111110] text-sm mb-6 transition-colors">
                <ArrowLeft size={13} /> Back
              </button>
              <h2 className="font-serif italic text-2xl mb-1">Name your file</h2>
              <p className="text-[#555] text-sm mb-6">Give this document a name before generating.</p>
              <div className="flex items-center gap-2 bg-white border border-[rgba(0,0,0,0.08)] rounded-xl px-3 py-1.5 mb-2">
                <FileText size={13} className="text-[#555] shrink-0" />
                <span className="text-xs text-[#555] truncate">{docFile?.name}</span>
              </div>
              <input
                autoFocus
                value={docName}
                onChange={e => setDocName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && docName.trim() && generateDocument()}
                placeholder="e.g. Chapter 3 — Thermodynamics"
                className="w-full bg-white border border-[rgba(0,0,0,0.08)] focus:border-[rgba(0,0,0,0.1)] rounded-xl px-4 py-3 text-sm text-[#111110] placeholder-[rgba(0,0,0,0.3)] outline-none mb-4"
              />
              {docError && <p className="text-xs text-red-400 mb-3">{docError}</p>}
              <button
                onClick={generateDocument}
                disabled={!docName.trim()}
                className="w-full bg-white text-[#111110] rounded-xl py-3 text-sm font-medium disabled:opacity-40 hover:bg-[#eee] transition-colors"
              >
                Generate
              </button>
            </div>
          )}

          {/* processing */}
          {docView === "processing" && (
            <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-12 text-center">
              <Loader2 size={28} className="mx-auto mb-4 animate-spin text-[#555]" />
              <div className="text-sm text-[#111110] font-medium mb-1">Analysing "{docName}"</div>
              <div className="text-xs text-[#555]">Generating your structured learning file…</div>
            </div>
          )}

          {/* result */}
          {docView === "result" && docResult && (
            <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="px-6 py-5 border-b border-[rgba(0,0,0,0.08)] flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-medium text-[#111110] mb-0.5">{docName}</div>
                  <div className="text-[10px] text-[#555] uppercase tracking-widest">
                    {(docResult.sections ?? []).length} sections · {(docResult.keyTerms ?? []).length} key terms
                  </div>
                </div>
                {docSaved && (
                  <div className="flex items-center gap-1.5 text-[10px] text-green-500 shrink-0 mt-1">
                    <CheckCircle size={11} /> Saved to Study Book
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="flex gap-1 px-4 pt-4 pb-0">
                {(["summary","sections","terms","quiz","tips"] as const).map(t => {
                  const labels: Record<string, string> = { summary: "Summary", sections: "Sections", terms: "Key Terms", quiz: "Practice Q&A", tips: "Exam Tips" };
                  return (
                    <button key={t} onClick={() => { setDocTab(t); setDocQuizSelected(null); }}
                      className="px-5 py-2.5 rounded-full text-sm font-medium transition-all"
                      style={{
                        background: docTab === t ? "#2563eb" : "rgba(37,99,235,0.07)",
                        color: docTab === t ? "white" : "rgba(0,0,0,0.45)",
                        border: `1px solid ${docTab === t ? "#2563eb" : "rgba(37,99,235,0.15)"}`,
                      }}>
                      {labels[t]}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div className="px-6 py-5 space-y-4 min-h-[200px]">

                {docTab === "summary" && (
                  <div className="space-y-3">
                    {docResult.summary && (
                      <p className="text-sm text-[#555] leading-relaxed">{docResult.summary}</p>
                    )}
                    {(docResult.formulas ?? []).length > 0 && (
                      <div>
                        <div className="text-[10px] text-[#555] font-bold uppercase tracking-widest mb-2">Formulas</div>
                        <div className="space-y-1">
                          {(docResult.formulas ?? []).map((f: string, i: number) => (
                            <div key={i} className="text-xs font-mono bg-[rgba(0,0,0,0.04)] rounded-lg px-3 py-2 text-[#111110]">{f}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {docTab === "sections" && (
                  <div className="space-y-5">
                    {(docResult.sections ?? []).map((s: any, i: number) => (
                      <div key={i}>
                        <div className="text-xs font-bold text-[#111110] mb-2">{s.heading}</div>
                        <div className="space-y-1.5">
                          {(s.bullets ?? []).map((b: string, j: number) => (
                            <div key={j} className="flex gap-2 text-sm text-[#555]">
                              <span className="shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-[#2563eb]" />
                              {b}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {docTab === "terms" && (
                  <div className="space-y-2">
                    {(docResult.keyTerms ?? []).map((kt: any, i: number) => (
                      <div key={i} className="rounded-xl border border-[rgba(0,0,0,0.07)] px-4 py-3">
                        <div className="text-sm font-semibold text-[#111110] mb-0.5">{kt.term}</div>
                        <div className="text-xs text-[#555] leading-relaxed">{kt.definition}</div>
                      </div>
                    ))}
                  </div>
                )}

                {docTab === "quiz" && (
                  <div className="space-y-4">
                    {(docResult.practiceQuestions ?? []).map((pq: any, i: number) => (
                      <div key={i}
                        onClick={() => setDocFlipped(p => { const s = new Set(p); s.has(i) ? s.delete(i) : s.add(i); return s; })}
                        className="cursor-pointer rounded-xl border px-4 py-3 transition-all"
                        style={{
                          background: docFlipped.has(i) ? "rgba(37,99,235,0.06)" : "white",
                          borderColor: docFlipped.has(i) ? "#3b82f6" : "rgba(0,0,0,0.08)",
                        }}>
                        <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: docFlipped.has(i) ? "#3b82f6" : "rgba(0,0,0,0.35)" }}>
                          {docFlipped.has(i) ? "Answer" : `Q${i + 1}`}
                        </div>
                        <div className="text-sm text-[#111110]">{docFlipped.has(i) ? pq.answer : pq.question}</div>
                        {!docFlipped.has(i) && <div className="text-[10px] text-[#555] mt-2">Tap to reveal answer</div>}
                      </div>
                    ))}
                  </div>
                )}

                {docTab === "tips" && (
                  <div className="space-y-2">
                    {(docResult.examTips ?? []).map((tip: string, i: number) => (
                      <div key={i} className="flex gap-3 text-sm text-[#555] rounded-xl border border-[rgba(0,0,0,0.07)] px-4 py-3">
                        <span className="shrink-0 font-bold text-[#2563eb]">{i + 1}.</span>
                        {tip}
                      </div>
                    ))}
                  </div>
                )}

              </div>

              {/* Actions */}
              {docError && <div className="px-6 pb-3 text-xs text-red-400">{docError}</div>}
              <div className="px-6 py-4 border-t border-[rgba(0,0,0,0.08)] space-y-3">
                {/* Save choice UI */}
                {!docSaved ? (
                  docSaveChoice === "none" ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDocSaveChoice("choosing")}
                        disabled={docSaving}
                        className="flex items-center gap-1.5 text-xs bg-white text-[#111110] px-4 py-2 rounded-full font-medium hover:bg-[#eee] transition-colors disabled:opacity-40"
                      >
                        Save to Study Book
                      </button>
                      <button
                        onClick={enterEditMode}
                        className="text-xs text-[#555] hover:text-[#111110] border border-[rgba(0,0,0,0.08)] hover:border-[#444] px-4 py-2 rounded-full transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={regenerateDocument}
                        disabled={docRegenerating}
                        className="text-xs text-[#555] hover:text-[#111110] border border-[rgba(0,0,0,0.08)] hover:border-[#444] px-4 py-2 rounded-full transition-colors disabled:opacity-40 flex items-center gap-1.5"
                      >
                        {docRegenerating ? <><Loader2 size={10} className="animate-spin" /> Regenerating…</> : "Regenerate"}
                      </button>
                      <button onClick={() => { setDocView("idle"); setDocFile(null); setDocResult(null); setDocSaved(false); setDocSaveChoice("none"); setDocTab("summary"); setDocFlipped(new Set()); setDocQuizSelected(null); }}
                        className="ml-auto text-xs text-[#555] hover:text-[#555] transition-colors">
                        Upload another
                      </button>
                    </div>
                  ) : docSaveChoice === "choosing" ? (
                    <div className="space-y-2">
                      <p className="text-[10px] text-[#555] uppercase tracking-widest">Where to save?</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => saveDocument()}
                          disabled={docSaving}
                          className="flex items-center gap-1.5 text-xs bg-white text-[#111110] px-4 py-2 rounded-full font-medium hover:bg-[#eee] transition-colors disabled:opacity-40"
                        >
                          {docSaving ? <><Loader2 size={10} className="animate-spin" /> Saving…</> : "Create New Study Book"}
                        </button>
                        {studyBooks.length > 0 && (
                          <button
                            onClick={() => setDocSaveChoice("existing")}
                            className="text-xs text-[#555] hover:text-[#111110] border border-[rgba(0,0,0,0.08)] hover:border-[#444] px-4 py-2 rounded-full transition-colors"
                          >
                            Add to Existing
                          </button>
                        )}
                        <button onClick={() => setDocSaveChoice("none")} className="text-xs text-[#555] hover:text-[#555] transition-colors px-2">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[10px] text-[#555] uppercase tracking-widest">Select a study book</p>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {studyBooks.map((sb: any) => (
                          <button
                            key={sb.id}
                            onClick={() => saveToExistingStudyBook(sb.id)}
                            disabled={docSaving}
                            className="w-full text-left px-3 py-2.5 rounded-xl border border-[rgba(0,0,0,0.08)] hover:border-[#444] text-sm text-[#111110] hover:bg-white/[0.02] transition-colors disabled:opacity-40"
                          >
                            {sb.title?.replace(/^Study Book:\s*/, "") ?? "Untitled"}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setDocSaveChoice("choosing")} className="text-xs text-[#555] hover:text-[#555] transition-colors">
                        ← Back
                      </button>
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-green-500">
                      <CheckCircle size={11} /> Saved to Study Book
                    </div>
                    <button onClick={() => { setDocView("idle"); setDocFile(null); setDocResult(null); setDocSaved(false); setDocSaveChoice("none"); setDocTab("summary"); setDocFlipped(new Set()); setDocQuizSelected(null); }}
                      className="ml-auto text-xs text-[#555] hover:text-[#555] transition-colors">
                      Upload another
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* editing */}
          {docView === "editing" && (
            <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-3">
                <button onClick={() => setDocView("result")} className="text-[#555] hover:text-[#111110] transition-colors">
                  <ArrowLeft size={15} />
                </button>
                <div className="text-sm font-medium text-[#111110]">Editing — {docName}</div>
              </div>
              <div>
                <div className="text-[10px] text-[#555] uppercase tracking-widest mb-1.5">Summary</div>
                <textarea
                  value={editSummary}
                  onChange={e => setEditSummary(e.target.value)}
                  rows={3}
                  className="w-full bg-white border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-sm text-[#555] outline-none focus:border-[rgba(0,0,0,0.1)] resize-none leading-relaxed"
                />
              </div>
              {editDocSections.map((sec, i) => (
                <div key={i}>
                  <input
                    value={sec.heading}
                    onChange={e => setEditDocSections(prev => prev.map((s, j) => j === i ? { ...s, heading: e.target.value } : s))}
                    className="w-full bg-transparent border-b border-[rgba(0,0,0,0.08)] pb-1 mb-2 text-[10px] text-[#555] uppercase tracking-widest outline-none focus:border-[#444]"
                  />
                  <textarea
                    value={sec.bullets}
                    onChange={e => setEditDocSections(prev => prev.map((s, j) => j === i ? { ...s, bullets: e.target.value } : s))}
                    rows={Math.max(3, sec.bullets.split("\n").length)}
                    className="w-full bg-white border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-xs text-[#555] outline-none focus:border-[rgba(0,0,0,0.1)] resize-none leading-relaxed"
                    placeholder="One bullet per line"
                  />
                </div>
              ))}
              <div>
                <div className="text-[10px] text-[#555] uppercase tracking-widest mb-1.5">Key Terms</div>
                <textarea
                  value={editDocKeyTerms}
                  onChange={e => setEditDocKeyTerms(e.target.value)}
                  rows={Math.max(3, editDocKeyTerms.split("\n").length)}
                  className="w-full bg-white border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-xs text-[#555] outline-none focus:border-[rgba(0,0,0,0.1)] resize-none leading-relaxed"
                  placeholder="Term: Definition (one per line)"
                />
              </div>
              {docError && <p className="text-xs text-red-400">{docError}</p>}
              <button
                onClick={saveEditedDocument}
                disabled={docSaving}
                className="w-full bg-[rgba(255,255,255,0.15)] text-[#111110] rounded-xl py-3 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {docSaving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Save to Study Book"}
              </button>
            </div>
          )}

        </div>
      )}

      {/* ── QUIZZES ── */}
      {tab === "quizzes" && (
        <div className="space-y-4">
          {!quizDone ? (
            <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-6">
              <p className="text-xs text-[#555] uppercase tracking-widest mb-4">Generate a quiz</p>
              {lectures.filter(l => l.status === "ready").length === 0 ? (
                <p className="text-sm text-[#555]">No quiz generated yet.</p>
              ) : (
                <>
                  <div className="space-y-2 mb-4">
                    {lectures.filter(l => l.status === "ready").map(l => (
                      <button
                        key={l.id}
                        onClick={() => setSelectedLecture(l.id)}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                          selectedLecture === l.id ? "border-white bg-white/5 text-[#111110]" : "border-[rgba(0,0,0,0.08)] text-[#555] hover:border-[rgba(0,0,0,0.1)] hover:text-[#111110]"
                        }`}
                      >
                        <div className="text-sm font-medium">{l.title}</div>
                        <div className="text-xs opacity-50 mt-0.5">{format(new Date(l.recordedAt), "MMM d")}</div>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={generateQuiz}
                    disabled={!selectedLecture || generatingQuiz}
                    className="w-full bg-[rgba(255,255,255,0.15)] text-[#111110] rounded-xl py-2.5 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2 hover:opacity-80 transition-opacity"
                  >
                    {generatingQuiz ? <><Loader2 size={14} className="animate-spin" /> Generating…</> : "Generate Quiz"}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-6 text-center">
              <CheckCircle size={28} className="mx-auto mb-2 text-[#111110]" />
              <div className="text-sm font-medium mb-3">Quiz generated</div>
              <button onClick={() => { setQuizDone(false); setSelectedLecture(null); }} className="text-xs text-[#555] hover:text-[#111110] transition-colors">
                Generate another
              </button>
            </div>
          )}

          {quizzes.length > 0 && (
            <div>
              <p className="text-xs text-[#555] uppercase tracking-widest mb-3">Quizzes in this class</p>
              <div className="space-y-2">
                {quizzes.map(q => (
                  <Link
                    key={q.id}
                    href={`/dashboard/quizzes/${q.id}`}
                    className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 flex items-center justify-between hover:border-[rgba(0,0,0,0.1)] transition-colors block"
                  >
                    <div className="text-sm text-[#111110]">{q.title}</div>
                    <div className="text-xs text-[#555]">{q._count?.questions} questions</div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── UPLOAD VIDEO ── */}
      {tab === "video" && (
        <div className="space-y-4">
          {/* URL input */}
          <div className="flex gap-2">
            <div className="flex-1 bg-white rounded-2xl px-4 py-3 flex items-center gap-3" style={{ border: "1.5px solid rgba(37,99,235,0.3)" }}>
              <Youtube size={14} style={{ color: "#2563eb" }} className="shrink-0" />
              <input
                value={ytVideoId ? ytUrl : ytDraft}
                onChange={e => { if (ytVideoId) return; setYtDraft(e.target.value); setYtError(""); }}
                onKeyDown={e => e.key === "Enter" && !ytVideoId && confirmYtUrl()}
                placeholder="Paste a YouTube URL…"
                className="flex-1 bg-transparent text-sm text-[#111110] placeholder-[rgba(0,0,0,0.3)] outline-none"
              />
              {ytVideoId && (
                <button onClick={() => handleYtUrl("")} className="text-[#555] hover:text-[#111110] transition-colors">
                  <X size={13} />
                </button>
              )}
            </div>
            {!ytVideoId && (
              <button
                onClick={confirmYtUrl}
                disabled={!ytDraft.trim()}
                className="text-sm font-semibold px-5 rounded-2xl transition-opacity disabled:opacity-40 shrink-0"
                style={{ background: "#2563eb", color: "white" }}
              >
                Load
              </button>
            )}
          </div>

          {ytError && <p className="text-xs text-red-400 px-1">{ytError}</p>}

          {(ytVideoId || ytLectureId) && (
            <>
              {/* Video box — only when we have the URL */}
              {ytVideoId && <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl overflow-hidden p-3">
                <div className="rounded-xl overflow-hidden bg-black w-full" style={{ aspectRatio: "16/9" }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${ytVideoId}`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                {ytTitle && <p className="text-xs text-[#555] mt-2 truncate">{ytTitle}</p>}
              </div>}

              {/* Feature tabs + content */}
              <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(37,99,235,0.14)", boxShadow: "0 2px 12px rgba(37,99,235,0.05), 0 1px 3px rgba(0,0,0,0.06)" }}>
                {/* Tab bar */}
                <div className="flex gap-2 overflow-x-auto p-3" style={{ background: "rgba(37,99,235,0.05)", borderBottom: "1px solid rgba(37,99,235,0.12)" }}>
                  {([
                    { key: "transcript", label: "Transcript" },
                    { key: "summary",    label: "Summary"    },
                    { key: "keypoints",  label: "Key Points" },
                    { key: "quiz",       label: "Quiz"       },
                    { key: "flashcards", label: "Flashcards" },
                    { key: "note",       label: "Take Note"  },
                    { key: "chatbot",    label: "Chatbot"    },
                  ] as const).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => { setYtActiveTab(key); if (key === "transcript") loadTranscript(); }}
                      className="shrink-0 whitespace-nowrap transition-all"
                      style={{
                        padding: "10px 20px",
                        borderRadius: 999,
                        fontSize: 15,
                        fontWeight: ytActiveTab === key ? 700 : 500,
                        background: ytActiveTab === key ? "#2563eb" : "rgba(255,255,255,0.8)",
                        color: ytActiveTab === key ? "white" : "rgba(0,0,0,0.5)",
                        border: ytActiveTab === key ? "none" : "1px solid rgba(0,0,0,0.1)",
                      }}
                    >{label}</button>
                  ))}
                </div>

                {/* Content area — fixed height, each tab scrolls within */}
                <div className="relative overflow-hidden" style={{ height: 460 }}>

                  {/* Transcript */}
                  {ytActiveTab === "transcript" && (
                    <div className="absolute inset-0 overflow-y-auto p-6">
                      {ytTranscriptLoading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-3">
                          <Loader2 size={18} className="animate-spin text-[#bbb]" />
                          <span className="text-sm text-[#aaa]">Fetching transcript…</span>
                        </div>
                      ) : ytTranscript ? (
                        <textarea
                          value={ytTranscript}
                          onChange={e => setYtTranscript(e.target.value)}
                          className="w-full h-full bg-transparent text-sm text-[#444] outline-none resize-none leading-[1.85] tracking-[0.01em]"
                        />
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center gap-4">
                          <p className="text-sm text-[#aaa]">Load the full transcript for this video.</p>
                          <button onClick={loadTranscript} className="text-sm font-semibold px-5 py-2.5 rounded-full" style={{ background: "#2563eb", color: "white" }}>
                            Load Transcript
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Summary */}
                  {ytActiveTab === "summary" && (
                    <div className="absolute inset-0 overflow-y-auto p-6">
                      {ytSummaryLoading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-3">
                          <Loader2 size={18} className="animate-spin text-[#bbb]" />
                          <span className="text-sm text-[#aaa]">Summarizing…</span>
                        </div>
                      ) : ytSummary ? (
                        <div className="space-y-5">
                          <p className="text-sm text-[#444] leading-[1.85] whitespace-pre-line">{ytSummary}</p>
                          <button onClick={generateYtSummary} className="text-xs text-[#bbb] hover:text-[#888] transition-colors">Regenerate</button>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center gap-4">
                          <p className="text-sm text-[#aaa]">Get a concise summary of this video lecture.</p>
                          <button onClick={generateYtSummary} className="text-sm font-semibold px-5 py-2.5 rounded-full" style={{ background: "#2563eb", color: "white" }}>
                            Generate Summary
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Key Points */}
                  {ytActiveTab === "keypoints" && (
                    <div className="absolute inset-0 overflow-y-auto p-6">
                      {ytKeyPointsLoading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-3">
                          <Loader2 size={18} className="animate-spin text-[#bbb]" />
                          <span className="text-sm text-[#aaa]">Extracting key points…</span>
                        </div>
                      ) : ytKeyPoints ? (
                        <div className="space-y-2">
                          {ytKeyPoints.map((kp: any, i: number) => {
                            const colorMap: Record<string, { bg: string; text: string; border: string }> = {
                              Definition: { bg: "rgba(37,99,235,0.06)",  text: "#2563eb", border: "rgba(37,99,235,0.2)"  },
                              Important:  { bg: "rgba(245,158,11,0.06)", text: "#d97706", border: "rgba(245,158,11,0.2)" },
                              Formula:    { bg: "rgba(16,185,129,0.06)", text: "#059669", border: "rgba(16,185,129,0.2)" },
                              Example:    { bg: "rgba(139,92,246,0.06)", text: "#7c3aed", border: "rgba(139,92,246,0.2)" },
                              Warning:    { bg: "rgba(239,68,68,0.06)",  text: "#dc2626", border: "rgba(239,68,68,0.2)"  },
                            };
                            const c = colorMap[kp.category] ?? colorMap["Important"];
                            return (
                              <div key={i} className="flex gap-3 items-start rounded-xl px-4 py-3" style={{ background: c.bg }}>
                                <span className="text-[9px] font-bold uppercase tracking-widest shrink-0 mt-0.5 px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: c.border, color: c.text }}>
                                  {kp.category}
                                </span>
                                <p className="text-sm text-[#333] leading-relaxed">{kp.point}</p>
                              </div>
                            );
                          })}
                          <button onClick={generateYtKeyPoints} className="text-xs text-[#bbb] hover:text-[#888] transition-colors pt-1">Regenerate</button>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center gap-4">
                          <p className="text-sm text-[#aaa]">Extract and highlight all key points from this video.</p>
                          <button onClick={generateYtKeyPoints} className="text-sm font-semibold px-5 py-2.5 rounded-full" style={{ background: "#2563eb", color: "white" }}>
                            Extract Key Points
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quiz */}
                  {ytActiveTab === "quiz" && (
                    <div className="absolute inset-0 overflow-y-auto p-6">
                      {ytInlineQuizLoading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-3">
                          <Loader2 size={18} className="animate-spin text-[#bbb]" />
                          <span className="text-sm text-[#aaa]">Generating quiz…</span>
                        </div>
                      ) : ytInlineQuiz ? (
                        <div className="space-y-3">
                          {ytInlineQuiz.map((q: any, i: number) => {
                            const revealed = ytQuizRevealed.has(i);
                            return (
                              <div key={i} className="rounded-xl border overflow-hidden" style={{ borderColor: revealed ? "rgba(37,99,235,0.3)" : "rgba(0,0,0,0.07)" }}>
                                <div className="px-4 py-3 text-sm font-medium text-[#111110]" style={{ background: revealed ? "rgba(37,99,235,0.04)" : "rgba(0,0,0,0.02)" }}>
                                  <span className="text-[#2563eb] font-bold mr-2">Q{i + 1}.</span>{q.question}
                                </div>
                                <div className="px-4 pb-3 pt-2 space-y-1.5 bg-white">
                                  {(q.options ?? []).map((opt: string, j: number) => {
                                    const letter = ["A","B","C","D"][j];
                                    const isCorrect = revealed && letter === q.answer;
                                    return (
                                      <div key={j} className="text-sm px-3 py-2 rounded-lg flex items-center gap-2"
                                        style={{ background: isCorrect ? "rgba(16,185,129,0.08)" : "rgba(0,0,0,0.025)", color: isCorrect ? "#059669" : "#555", fontWeight: isCorrect ? 600 : 400 }}>
                                        {isCorrect && <CheckCircle size={12} className="shrink-0" />}
                                        {opt}
                                      </div>
                                    );
                                  })}
                                  {revealed && q.explanation && (
                                    <p className="text-xs text-[#888] mt-2 px-1 leading-relaxed">{q.explanation}</p>
                                  )}
                                  {!revealed && (
                                    <button onClick={() => setYtQuizRevealed(p => { const s = new Set(p); s.add(i); return s; })}
                                      className="text-xs font-semibold text-[#2563eb] mt-1 px-1 hover:opacity-70 transition-opacity">
                                      Reveal answer →
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          <button onClick={generateYtInlineQuiz} className="text-xs text-[#bbb] hover:text-[#888] transition-colors pt-1">Regenerate</button>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center gap-4">
                          <p className="text-sm text-[#aaa]">Generate quiz questions from this video.</p>
                          <button onClick={generateYtInlineQuiz} className="text-sm font-semibold px-5 py-2.5 rounded-full" style={{ background: "#2563eb", color: "white" }}>
                            Generate Quiz
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Flashcards */}
                  {ytActiveTab === "flashcards" && (
                    <div className="absolute inset-0 overflow-y-auto p-6">
                      {ytFlashcardsLoading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-3">
                          <Loader2 size={18} className="animate-spin text-[#bbb]" />
                          <span className="text-sm text-[#aaa]">Generating flashcards…</span>
                        </div>
                      ) : ytFlashcards ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {ytFlashcards.map((fc: any, i: number) => (
                              <div key={i} onClick={() => setYtFlipped(p => { const s = new Set(p); s.has(i) ? s.delete(i) : s.add(i); return s; })}
                                className="cursor-pointer rounded-xl p-4 min-h-[100px] flex flex-col items-center justify-center text-center transition-all select-none"
                                style={{ background: ytFlipped.has(i) ? "rgba(37,99,235,0.06)" : "rgba(0,0,0,0.02)", border: `1px solid ${ytFlipped.has(i) ? "rgba(37,99,235,0.25)" : "rgba(0,0,0,0.07)"}` }}>
                                <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: ytFlipped.has(i) ? "#2563eb" : "#bbb" }}>{ytFlipped.has(i) ? "Answer" : "Question"}</div>
                                <p className="text-sm leading-relaxed" style={{ color: ytFlipped.has(i) ? "#1e3a8a" : "#555" }}>{ytFlipped.has(i) ? fc.back : fc.front}</p>
                              </div>
                            ))}
                          </div>
                          <button onClick={generateYtFlashcards} className="text-xs text-[#bbb] hover:text-[#888] transition-colors">Regenerate</button>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center gap-4">
                          <p className="text-sm text-[#aaa]">Create flashcards from key concepts in this video.</p>
                          <button onClick={generateYtFlashcards} className="text-sm font-semibold px-5 py-2.5 rounded-full" style={{ background: "#2563eb", color: "white" }}>
                            Generate Flashcards
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Take Note */}
                  {ytActiveTab === "note" && (
                    <div className="absolute inset-0 flex flex-col p-6 gap-3">
                      <textarea
                        value={ytNote}
                        onChange={e => { setYtNote(e.target.value); setYtNoteNaming(false); }}
                        placeholder="Start typing your notes…"
                        className="flex-1 w-full bg-transparent text-sm text-[#444] placeholder-[rgba(0,0,0,0.25)] outline-none resize-none leading-[1.85]"
                      />
                      <div className="flex items-center gap-2 shrink-0 pt-2 border-t border-[rgba(0,0,0,0.06)]">
                        {ytNoteSaved ? (
                          <div className="flex items-center gap-1.5 text-sm text-green-600"><CheckCircle size={13} /> Saved!</div>
                        ) : ytNoteNaming ? (
                          <>
                            <input autoFocus value={ytNoteName} onChange={e => setYtNoteName(e.target.value)}
                              onKeyDown={e => e.key === "Enter" && saveYtNote(ytNoteName)}
                              placeholder="Name this note…"
                              className="flex-1 bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.08)] focus:border-[rgba(0,0,0,0.15)] rounded-lg px-3 py-2 text-sm text-[#111110] placeholder-[rgba(0,0,0,0.3)] outline-none" />
                            <button onClick={() => saveYtNote(ytNoteName)} disabled={!ytNoteName.trim()}
                              className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40" style={{ background: "#2563eb", color: "white" }}>Save</button>
                            <button onClick={() => { setYtNoteNaming(false); setYtNoteName(""); }} className="text-sm text-[#999] hover:text-[#555] px-2 py-2 transition-colors">Cancel</button>
                          </>
                        ) : (
                          <button onClick={() => setYtNoteNaming(true)} disabled={!ytNote.trim()}
                            className="text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40" style={{ background: "#2563eb", color: "white" }}>
                            Save to Notes
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Chatbot */}
                  {ytActiveTab === "chatbot" && (
                    <div className="absolute inset-0 flex flex-col">
                      <div className="flex-1 overflow-y-auto px-6 pt-5 pb-3 space-y-3">
                        {ytMessages.length === 0 && !ytChatLoading && (
                          <div className="h-full flex flex-col items-center justify-center gap-2 py-12">
                            <p className="text-sm text-[#bbb]">Ask anything about this video.</p>
                          </div>
                        )}
                        {ytMessages.map((m, i) => (
                          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                            <span className="text-sm px-4 py-2.5 max-w-[85%] leading-relaxed"
                              style={{
                                background: m.role === "user" ? "#2563eb" : "rgba(0,0,0,0.04)",
                                color: m.role === "user" ? "white" : "#333",
                                borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                              }}>{m.content}</span>
                          </div>
                        ))}
                        {ytChatLoading && (
                          <div className="flex justify-start">
                            <span className="px-4 py-3 rounded-2xl rounded-bl-sm" style={{ background: "rgba(0,0,0,0.04)" }}>
                              <Loader2 size={13} className="animate-spin text-[#bbb]" />
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 px-4 pb-4 pt-3 border-t border-[rgba(0,0,0,0.06)] shrink-0">
                        <input
                          value={ytChatInput}
                          onChange={e => setYtChatInput(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendYtChat()}
                          placeholder="Ask a question…"
                          className="flex-1 bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.08)] focus:border-[rgba(0,0,0,0.15)] rounded-xl px-4 py-2.5 text-sm text-[#333] placeholder-[rgba(0,0,0,0.3)] outline-none"
                        />
                        <button onClick={sendYtChat} disabled={!ytChatInput.trim() || ytChatLoading}
                          className="text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-40" style={{ background: "#2563eb", color: "white" }}>
                          Send
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── STUDY BOOK ── */}
      {tab === "studybook" && sbView === "list" && (
        <div className="space-y-3">
          {/* Generate Study Book card */}
          <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-5">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[rgba(0,0,0,0.38)] mb-1">Generate Study Book</div>

            {generateBookDone ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-[#111110]">
                  <CheckCircle size={14} className="text-green-500" /> Study book ready — see below
                </div>
                <button onClick={() => { setGenerateBookDone(false); setShowMaterials(false); }} className="text-xs text-[#555] hover:text-[#111110] transition-colors">Generate another</button>
              </div>
            ) : (
              <>
                {/* Material selector */}
                {!showMaterials ? (
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-xs text-[#6b6b69] space-y-0.5">
                      <p className="font-medium text-[#444]">Uses all class materials:</p>
                      <p>
                        {[
                          lectures.filter((l: any) => l.status === "ready").length > 0 && `${lectures.filter((l: any) => l.status === "ready").length} recording${lectures.filter((l: any) => l.status === "ready").length !== 1 ? "s" : ""}`,
                          sheets.filter((s: any) => !s.title?.startsWith("Study Book:")).length > 0 && `${sheets.filter((s: any) => !s.title?.startsWith("Study Book:")).length} uploaded file${sheets.filter((s: any) => !s.title?.startsWith("Study Book:")).length !== 1 ? "s" : ""}`,
                          notes.length > 0 && `${notes.length} note${notes.length !== 1 ? "s" : ""}`,
                        ].filter(Boolean).join(" · ") || "No materials yet"}
                      </p>
                    </div>
                    <button onClick={openMaterialPicker} className="text-[10px] font-medium text-[#555] hover:text-[#111110] border border-[rgba(0,0,0,0.1)] px-2.5 py-1 rounded-full transition-colors shrink-0 ml-3">
                      Choose
                    </button>
                  </div>
                ) : (
                  <div className="mb-4 border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-[rgba(0,0,0,0.02)] border-b border-[rgba(0,0,0,0.06)]">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#555]">Select materials</span>
                      <button onClick={() => setShowMaterials(false)} className="text-[10px] text-[#555] hover:text-[#111110]">Use all</button>
                    </div>

                    {/* Recordings & Files */}
                    {lectures.filter((l: any) => l.status === "ready").length > 0 && (
                      <div className="border-b border-[rgba(0,0,0,0.06)]">
                        <div className="flex items-center justify-between px-4 py-2 bg-white">
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#888]">Recordings & Files</span>
                          <button
                            onClick={() => {
                              const all = lectures.filter((l: any) => l.status === "ready").map((l: any) => l.id);
                              const allSelected = all.every((id: string) => selectedLectureIds.has(id));
                              setSelectedLectureIds(allSelected ? new Set() : new Set(all));
                            }}
                            className="text-[10px] text-[#555] hover:text-[#111110]"
                          >
                            {lectures.filter((l: any) => l.status === "ready").every((l: any) => selectedLectureIds.has(l.id)) ? "Deselect all" : "Select all"}
                          </button>
                        </div>
                        {lectures.filter((l: any) => l.status === "ready").map((l: any) => (
                          <label key={l.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[rgba(0,0,0,0.02)] cursor-pointer border-t border-[rgba(0,0,0,0.04)]">
                            <input type="checkbox" checked={selectedLectureIds.has(l.id)} onChange={() => toggleLecture(l.id)} className="rounded accent-[#111110]" />
                            <span className="text-xs text-[#111110] truncate">{l.title}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {/* Notes */}
                    {notes.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between px-4 py-2 bg-white">
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#888]">Notes</span>
                          <button
                            onClick={() => {
                              const all = notes.map(n => n.id);
                              const allSelected = all.every(id => selectedNoteIds.has(id));
                              setSelectedNoteIds(allSelected ? new Set() : new Set(all));
                            }}
                            className="text-[10px] text-[#555] hover:text-[#111110]"
                          >
                            {notes.every(n => selectedNoteIds.has(n.id)) ? "Deselect all" : "Select all"}
                          </button>
                        </div>
                        {notes.map(n => (
                          <label key={n.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[rgba(0,0,0,0.02)] cursor-pointer border-t border-[rgba(0,0,0,0.04)]">
                            <input type="checkbox" checked={selectedNoteIds.has(n.id)} onChange={() => toggleNote(n.id)} className="rounded accent-[#111110]" />
                            <span className="text-xs text-[#111110] truncate">{n.name}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {lectures.filter((l: any) => l.status === "ready").length === 0 && notes.length === 0 && (
                      <p className="text-xs text-[#6b6b69] px-4 py-3">No materials yet.</p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    value={generateBookName}
                    onChange={e => { setGenerateBookName(e.target.value); setGenerateBookError(""); }}
                    onKeyDown={e => e.key === "Enter" && !generatingBook && generateClassBook()}
                    placeholder="e.g. Midterm Complete Study Guide"
                    disabled={generatingBook}
                    className="flex-1 bg-white border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-2.5 text-sm text-[#111110] placeholder-[rgba(0,0,0,0.3)] outline-none focus:border-[rgba(0,0,0,0.1)] disabled:opacity-50"
                  />
                  <button
                    onClick={generateClassBook}
                    disabled={generatingBook}
                    className="flex items-center gap-2 bg-[rgba(255,255,255,0.15)] text-[#111110] text-sm font-medium px-5 py-2.5 rounded-xl hover:opacity-80 transition-opacity disabled:opacity-40 shrink-0"
                  >
                    {generatingBook ? <><Loader2 size={13} className="animate-spin" /> Generating…</> : "Generate"}
                  </button>
                </div>
                {generatingBook && <p className="text-xs text-[#6b6b69] mt-2">This may take 1–2 minutes…</p>}
                {generateBookError && <p className="text-xs text-red-400 mt-2">{generateBookError}</p>}
              </>
            )}
          </div>

          {studyBooks.length === 0 ? (
            <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-8 text-center">
              <BookMarked size={28} className="mx-auto mb-3 text-[#555]" />
              <p className="text-sm text-[#555] mb-1">No study books yet.</p>
              <p className="text-xs text-[#555]">Enter a title above and click Generate to create one.</p>
            </div>
          ) : (
            studyBooks.map((sb: any, idx: number) => {
              const title = sb.title?.replace(/^Study Book:\s*/, "") ?? "Untitled";
              const c = sb.content as any;
              const isStudybookType = c?._type === "studybook";
              const chapterCount = (c?.chapters ?? []).length;
              const sectionCount = (c?.sections ?? []).length;
              const flashcardCount = isStudybookType
                ? (c?.chapters ?? []).reduce((acc: number, ch: any) => acc + (ch.flashcards?.length ?? 0), 0)
                : 0;
              const glossaryCount = (c?.glossary ?? []).length;
              const spineColors = ["#8fa389", "#b0a08a", "#a08ab0", "#8ab0b0", "#b08a8a", "#a0b08a"];
              const spine = spineColors[idx % spineColors.length];
              return (
                <button
                  key={sb.id}
                  onClick={() => openSb(sb)}
                  className="w-full bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl text-left hover:shadow-sm transition-all overflow-hidden flex"
                >
                  <div className="w-2.5 shrink-0 self-stretch rounded-l-2xl" style={{ background: spine }} />
                  <div className="flex-1 px-5 py-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-[#111110] mb-0.5">{title}</div>
                      <div className="text-[10px] text-[#6b6b69]">
                        {format(new Date(sb.createdAt), "MMM d, yyyy")}
                        {chapterCount > 0 && ` · ${chapterCount} chapter${chapterCount !== 1 ? "s" : ""}`}
                        {sectionCount > 0 && chapterCount === 0 && ` · ${sectionCount} section${sectionCount !== 1 ? "s" : ""}`}
                        {flashcardCount > 0 && ` · ${flashcardCount} flashcards`}
                        {glossaryCount > 0 && ` · ${glossaryCount} terms`}
                      </div>
                    </div>
                    <span className="text-[10px] font-medium px-3 py-1.5 rounded-full shrink-0" style={{ background: "rgba(0,0,0,0.06)", color: "#555" }}>Open</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {tab === "studybook" && sbView === "detail" && activeSb && (() => {
        const c = activeSb.content as any;
        const sbTitle = activeSb.title?.replace(/^Study Book:s*/, '') ?? 'Untitled';
        const summary: string = c?.summary ?? c?.executiveSummary ?? '';
        const takeaways: string[] = c?.keyTakeaways ?? (c?.chapters ?? []).flatMap((ch: any) => ch.keyPoints ?? []);
        const keyTerms: any[] = c?.keyTerms ?? c?.glossary ?? [];
        const questions: any[] = c?.practiceQuestions ?? (c?.chapters ?? []).flatMap((ch: any) => ch.examQuestions ?? []);
        const openQ = expandedChapters;
        const setOpenQ = (fn: (p: Set<number>) => Set<number>) => setExpandedChapters(fn(expandedChapters));
        return (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <button onClick={closeSb} className="text-[#555] hover:text-[#111110] transition-colors">
                <ArrowLeft size={15} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-base font-medium text-[#111110] truncate">{sbTitle}</div>
                <div className="text-[10px] text-[#555]">{format(new Date(activeSb.createdAt), 'MMM d, yyyy')}</div>
              </div>
              {!sbQuizDone ? (
                <button onClick={() => setSbQuizMode(true)}
                  className="text-xs text-[#555] hover:text-[#111110] border border-[rgba(0,0,0,0.08)] hover:border-[#444] px-3 py-1.5 rounded-full transition-colors shrink-0">
                  Generate Quiz
                </button>
              ) : (
                <div className="flex items-center gap-1 text-xs text-green-500"><CheckCircle size={10} /> Quiz created</div>
              )}
            </div>

            {/* Generate Quiz modal */}
            {sbQuizMode && (
              <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-5 space-y-3">
                <p className="text-[10px] text-[#555] uppercase tracking-widest">Name your quiz</p>
                <input autoFocus value={sbQuizName} onChange={e => setSbQuizName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && generateSbQuiz()}
                  placeholder={'Quiz — ' + sbTitle}
                  className="w-full bg-white border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-2.5 text-sm text-[#111110] placeholder-[rgba(0,0,0,0.3)] outline-none" />
                <div className="flex gap-2">
                  <button onClick={generateSbQuiz} disabled={!sbQuizName.trim() || sbQuizGenerating}
                    className="flex items-center gap-1.5 text-xs bg-white text-[#111110] px-4 py-2 rounded-full font-medium hover:bg-[#eee] transition-colors disabled:opacity-40">
                    {sbQuizGenerating ? <><Loader2 size={10} className="animate-spin" /> Generating…</> : 'Generate'}
                  </button>
                  <button onClick={() => setSbQuizMode(false)} className="text-xs text-[#555]">Cancel</button>
                </div>
              </div>
            )}

            {/* Summary */}
            {summary && (
              <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#555] mb-2">Overview</div>
                <p className="text-sm text-[#444] leading-relaxed">{summary}</p>
              </div>
            )}

            {/* Key Takeaways */}
            {takeaways.length > 0 && (
              <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#555] mb-3">Key Takeaways · {takeaways.length}</div>
                <div className="space-y-2">
                  {takeaways.map((pt: string, i: number) => (
                    <div key={i} className="flex gap-2.5 text-sm text-[#444] leading-relaxed">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#2563eb] shrink-0" />
                      {pt}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Key Terms */}
            {keyTerms.length > 0 && (
              <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#555] mb-3">Key Terms · {keyTerms.length}</div>
                <div className="space-y-2.5">
                  {keyTerms.map((kt: any, i: number) => (
                    <div key={i} className="flex gap-2 text-sm">
                      <span className="font-semibold text-[#111110] shrink-0">{kt.term}:</span>
                      <span className="text-[#555]">{kt.definition}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Practice Questions */}
            {questions.length > 0 && (
              <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#555] mb-3">Practice Questions · {questions.length}</div>
                <div className="space-y-3">
                  {questions.map((q: any, i: number) => {
                    const revealed = openQ.has(i);
                    const answer = q.answer ?? q.correctAnswer ?? '';
                    return (
                      <div key={i} className="rounded-xl border overflow-hidden" style={{ borderColor: revealed ? 'rgba(37,99,235,0.25)' : 'rgba(0,0,0,0.07)' }}>
                        <div className="px-4 py-3 text-sm font-medium text-[#111110]" style={{ background: revealed ? 'rgba(37,99,235,0.04)' : 'rgba(0,0,0,0.02)' }}>
                          <span className="text-[#2563eb] font-bold mr-2">Q{i + 1}.</span>{q.question}
                        </div>
                        {revealed ? (
                          <div className="px-4 py-3 bg-white text-sm text-[#444] leading-relaxed border-t border-[rgba(0,0,0,0.06)]">{answer}</div>
                        ) : (
                          <button onClick={() => setOpenQ(p => { const s = new Set(p); s.add(i); return s; })}
                            className="w-full text-left px-4 py-2 text-xs font-semibold text-[#2563eb] hover:opacity-70 transition-opacity bg-white border-t border-[rgba(0,0,0,0.06)]">
                            Reveal answer →
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── TAKE NOTE ── */}
      {tab === "note" && noteView === "list" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-[#555] uppercase tracking-widest">Your Notes</p>
            <button
              onClick={() => { setNewNoteName(""); setNoteView("create"); }}
              className="flex items-center gap-1.5 text-xs bg-white text-[#111110] px-3 py-1.5 rounded-full font-medium hover:bg-[#eee] transition-colors"
            >
              <Plus size={11} /> New Note
            </button>
          </div>

          {notes.length === 0 ? (
            <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-10 text-center">
              <PenLine size={28} className="mx-auto mb-3 text-[#222]" />
              <p className="text-sm text-[#555] mb-1">No notes yet</p>
              <p className="text-xs text-[#555] mb-4">Create your first note for {course.name}</p>
              <button
                onClick={() => { setNewNoteName(""); setNoteView("create"); }}
                className="text-xs border border-[rgba(0,0,0,0.1)] px-4 py-2 rounded-full text-[#111110] hover:border-[#ddd] transition-colors"
              >
                Create a note
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {notes.map(n => (
                <div key={n.id} className="group bg-white border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 flex items-center justify-between hover:border-[rgba(0,0,0,0.1)] transition-colors">
                  <button className="flex-1 text-left" onClick={() => { setActiveNote(n); setNoteSavedAt(null); setNoteView("edit"); }}>
                    <div className="text-sm text-[#111110]">{n.name}</div>
                    <div className="text-[10px] text-[#555] mt-0.5">
                      {format(new Date(n.updatedAt), "MMM d, yyyy · h:mm a")}
                    </div>
                  </button>
                  <button
                    onClick={() => deleteNote(n.id)}
                    className="opacity-0 group-hover:opacity-100 text-[#555] hover:text-red-400 transition-all ml-3"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "note" && noteView === "create" && (
        <div className="max-w-sm">
          <button onClick={() => setNoteView("list")} className="flex items-center gap-2 text-[#555] hover:text-[#111110] transition-colors text-sm mb-6">
            <ArrowLeft size={14} /> Back
          </button>
          <h2 className="font-serif italic text-2xl mb-1">New Note</h2>
          <p className="text-[#555] text-sm mb-6">Give your note a name to get started.</p>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-[#555] uppercase tracking-widest block mb-1.5">Note name</label>
              <input
                autoFocus
                value={newNoteName}
                onChange={e => setNewNoteName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createNote()}
                placeholder="e.g. Chapter 3 — Derivatives, Lecture 5…"
                className="w-full bg-white border border-[rgba(0,0,0,0.08)] focus:border-[rgba(0,0,0,0.1)] rounded-xl px-4 py-3 text-sm text-[#111110] placeholder-[rgba(0,0,0,0.3)] outline-none"
              />
            </div>
            <button
              onClick={createNote}
              disabled={!newNoteName.trim()}
              className="w-full bg-white text-[#111110] rounded-xl py-3 text-sm font-medium disabled:opacity-40 hover:bg-[#eee] transition-colors"
            >
              Create Note
            </button>
          </div>
        </div>
      )}

      {tab === "note" && noteView === "edit" && activeNote && (
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button onClick={() => setNoteView("list")} className="text-[#555] hover:text-[#111110] transition-colors">
              <ArrowLeft size={15} />
            </button>
            <div className="text-sm font-medium text-[#111110]">{activeNote.name}</div>
            <div className="ml-auto flex items-center gap-3">
              {noteSavedAt && (
                <span className="text-[10px] text-[#555]">
                  Saved {noteSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <button
                onClick={saveNoteNow}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#111110] text-white hover:bg-[#333] transition-colors"
              >
                Save
              </button>
            </div>
            <button onClick={() => { if (window.confirm(`Delete "${activeNote.name}"?`)) deleteNote(activeNote.id); }}
              className="text-[#555] hover:text-red-400 transition-colors">
              <Trash2 size={13} />
            </button>
          </div>

          <TiptapNoteEditor
            content={activeNote.text}
            onChange={val => handleNoteChange(val)}
          />
        </div>
      )}

    </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
type View = "list" | "create" | "class";

function WorkspacePageInner() {
  const fetcher = useApiSWRFetcher();
  const { userId } = useAuth();
  const searchParams = useSearchParams();
  const videoIdParam = searchParams.get("videoId");
  const courseIdParam = searchParams.get("courseId");

  const { data: coursesData } = useSWR(userId ? `${BASE}/api/courses` : null, fetcher, { revalidateOnFocus: false });
  const allCourses: any[] = coursesData?.data ?? [];

  const [view, setView] = useState<View>("list");
  const [activeCourse, setActiveCourse] = useState<any | null>(null);
  const [initialYtState, setInitialYtState] = useState<InitialYtState | null>(null);
  const autoNavigatedRef = useRef(false);

  useEffect(() => {
    if (!videoIdParam || !courseIdParam || !coursesData || autoNavigatedRef.current || allCourses.length === 0) return;
    autoNavigatedRef.current = true;
    const course = allCourses.find((c: any) => c.id === courseIdParam);
    if (!course) return;
    setInitialYtState({ videoId: videoIdParam, url: `https://www.youtube.com/watch?v=${videoIdParam}` });
    setActiveCourse(course);
    setView("class");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoIdParam, courseIdParam, coursesData, allCourses.length]);

  if (view === "create") {
    return (
      <div className="p-8 max-w-2xl">
        <CreateClassPage
          onBack={() => setView("list")}
          onCreate={c => { setActiveCourse(c); setView("class"); }}
        />
      </div>
    );
  }

  if (view === "class" && activeCourse) {
    return (
      <ClassWorkspace
        course={activeCourse}
        allCourses={allCourses}
        onSelect={c => setActiveCourse(c)}
        onBack={() => { setView("list"); setInitialYtState(null); autoNavigatedRef.current = false; }}
        initialTab={initialYtState ? "video" : undefined}
        initialYtState={initialYtState ?? undefined}
      />
    );
  }

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-5xl px-6 py-8">
        <ClassList
          onSelect={c => { setActiveCourse(c); setView("class"); }}
          onCreate={() => setView("create")}
        />
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={null}>
      <WorkspacePageInner />
    </Suspense>
  );
}
