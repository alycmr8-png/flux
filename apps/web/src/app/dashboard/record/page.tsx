"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import {
  Mic, Square, FileUp, CheckCircle, Loader2, Plus, Pause, Play, StopCircle,
  Calendar, X, Mic2, FileText, ArrowLeft, Layers, BookMarked,
  ChevronDown, ChevronRight, PenLine, Trash2, RotateCcw, Sparkles, MessageSquare,
  GraduationCap, Target, AlertTriangle,
} from "lucide-react";
import { useApiFetch, useApiSWRFetcher } from "@/lib/apiFetch";
import { useToast, useConfirm } from "@/components/Feedback";
import { useAuth } from "@clerk/nextjs";
import { useT } from "@/lib/useT";
import useSWR from "swr";
import Link from "next/link";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { TiptapNoteEditor } from "@/components/TiptapNoteEditor";
import { recSafeStart, recSafeAppend, recSafeClear, recSafeLoad, type RecMeta } from "@/lib/recSafe";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const SEMESTERS = ["Fall", "Spring", "Summer", "Winter"];

// ─── Hover-to-Define ─────────────────────────────────────────────────────────
function TermTooltip({ term, definition, highYield }: { term: string; definition: string; highYield?: boolean }) {
  return (
    <span className="relative group/tt inline">
      <span className={`cursor-help border-b border-dotted font-medium transition-colors ${highYield ? "border-yellow-500 text-gray-900" : "border-[rgba(0,0,0,0.3)] text-gray-900"} hover:border-[#111110]`}>
        {term}
      </span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 bg-indigo-600 text-white text-xs rounded-xl px-3.5 py-3 shadow-xl opacity-0 group-hover/tt:opacity-100 pointer-events-none transition-opacity duration-150 leading-relaxed text-left whitespace-normal">
        {highYield && <span className="text-yellow-400 text-[9px] uppercase tracking-widest block mb-1">★ High Yield</span>}
        <span className="opacity-50 text-[9px] uppercase tracking-widest block mb-1">{term}</span>
        {definition}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-indigo-600" />
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
  const toast = useToast();
  const t = useT();
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

      toast(`${course.name} is ready`, "success");
      onCreate(course);
    } catch (e: any) {
      toast(e?.message ?? "Couldn't create the class. Check that you're online and try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm mb-8">
        <ArrowLeft size={14} /> {t.common.back}
      </button>

      <h1 className="font-serif italic text-5xl mb-1">{t.newClass.title}</h1>
      <p className="text-gray-600 text-sm mb-8">{t.newClass.subtitle}</p>

      <div className="space-y-4">
        {/* Class name */}
        <div>
          <label className="text-[10px] text-gray-600 uppercase tracking-widest block mb-1.5">{t.newClass.classNameLabel}</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && create()}
            placeholder={t.newClass.classNamePlaceholder}
            className="w-full bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] focus:border-indigo-500/50 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none"
          />
        </div>

        {/* Semester */}
        <div>
          <label className="text-[10px] text-gray-600 uppercase tracking-widest block mb-1.5">{t.newClass.semester}</label>
          <div className="flex gap-2">
            <div className="flex gap-1 bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] rounded-xl p-1">
              {SEMESTERS.map(s => (
                <button
                  key={s}
                  onClick={() => setSemester(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    semester === s ? "bg-[#4B5FE8] text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {t.newClass.semesters[s] ?? s}
                </button>
              ))}
            </div>
            <input
              value={year}
              onChange={e => setYear(e.target.value)}
              className="w-20 bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] focus:border-indigo-500/50 rounded-xl px-3 py-2 text-sm text-gray-900 outline-none text-center"
              maxLength={4}
            />
          </div>
        </div>

        <button
          onClick={create}
          disabled={loading || !name.trim()}
          className="w-full bg-[#FFFFFF] text-gray-900 rounded-xl py-3 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-[#F1F0EE] transition-colors"
        >
          {loading ? <><Loader2 size={14} className="animate-spin" /> {t.common.creating}</> : t.newClass.create}
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
          <p className="text-gray-600 text-sm">{t.workspace.subtitle}</p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 bg-[#FFFFFF] text-gray-900 text-sm font-medium px-4 py-2 rounded-full hover:bg-[#F1F0EE] transition-colors"
        >
          <Plus size={14} /> {t.workspace.newClass}
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] rounded-2xl p-7 animate-pulse">
              <div className="h-4 bg-[#1e1e1e] rounded w-2/3 mb-3" />
              <div className="h-3 bg-[rgba(99,102,241,0.12)] rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="border border-dashed border-[rgba(0,0,0,0.08)] rounded-2xl p-16 text-center">
          <Layers size={36} className="mx-auto mb-4 text-[#222]" />
          <p className="text-gray-600 text-sm font-medium mb-1">No classes yet</p>
          <p className="text-gray-600 text-xs mb-4">Create your first class to start recording lectures</p>
          <button onClick={onCreate} className="text-xs text-[#6b6b69] border border-[rgba(0,0,0,0.1)] px-4 py-2 rounded-full hover:border-[#ddd] transition-colors">
            Create a class
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => (
            <div key={c.id} className="relative group/card">
              {confirmDeleteId === c.id ? (
                <div className="bg-[#FFFFFF] border border-red-200 rounded-2xl p-7 flex flex-col gap-3">
                  <p className="text-sm font-medium text-gray-900">Delete &ldquo;{c.name}&rdquo;?</p>
                  <p className="text-xs text-gray-600 leading-relaxed">All lectures, notes, and materials in this class will be permanently deleted.</p>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => setConfirmDeleteId(null)} disabled={deleting}
                      className="flex-1 text-xs py-2 rounded-lg border border-[rgba(0,0,0,0.12)] text-gray-600 hover:text-gray-900 transition-colors">
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
                    className="w-full bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] rounded-2xl p-7 text-left hover:border-[rgba(0,0,0,0.1)] hover:bg-[#FFFFFF]/5 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[rgba(99,102,241,0.12)] flex items-center justify-center mb-4 group-hover:bg-indigo-500 transition-colors">
                      <Layers size={16} className="text-gray-600 group-hover:text-gray-900 transition-colors" />
                    </div>
                    <div className="text-gray-900 font-medium text-base mb-1">{c.name}</div>
                    <div className="text-gray-600 text-xs">{c.code}</div>
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
function ClassWorkspace({ course, allCourses, onSelect, onBack }: {
  course: any; allCourses: any[]; onSelect: (c: any) => void; onBack: () => void;
}) {
  const t = useT();
  const apiFetch = useApiFetch();
  const fetcher = useApiSWRFetcher();
  const toast = useToast();
  const confirm = useConfirm();
  const { userId, getToken } = useAuth();
  const [tab, setTab] = useState<"record" | "studybook" | "note" | "ask">("record");

  // Track which tabs have been visited so we only fetch data on demand
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set(["record"]));
  function switchTab(next: typeof tab) {
    setVisitedTabs(prev => new Set([...prev, next]));
    setTab(next);
  }

  // Lectures always fetch — needed for Record tab (primary tab)
  const { data: lecturesData, mutate: mutateLectures } = useSWR(
    `${BASE}/api/lectures?courseId=${course.id}`,
    fetcher,
    { revalidateOnFocus: false }
  );
  const lectures: any[] = lecturesData?.data ?? [];
  // A handful of lectures may still carry a youtube.com/youtu.be audioUrl from
  // before video import was removed — keep them out of the Record tab's list.
  const isYoutubeUrl = (u?: string | null) => !!u && /youtube\.com|youtu\.be/.test(u);
  const ytIdFromUrl = (u?: string | null) =>
    u?.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([^&?\s/]+)/)?.[1] ?? null;
  const audioLectures: any[] = lectures.filter((l: any) => l.audioUrl && !isYoutubeUrl(l.audioUrl));

  // Sheets — only fetch when the Study Book tab is visited
  const { data: sheetsData, mutate: mutateSheets } = useSWR(
    visitedTabs.has("studybook") ? `${BASE}/api/cheatsheets?courseId=${course.id}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const studyBooks: any[] = (sheetsData?.data ?? []).filter((s: any) => s.title?.startsWith("Study Book:"));

  // ── study book navigation ──
  const [sbView, setSbView] = useState<"list" | "detail">("list");
  const [activeSb, setActiveSb] = useState<any | null>(null);
  const [sbEditMode, setSbEditMode] = useState(false);
  const [sbEditSummary, setSbEditSummary] = useState("");
  const [sbEditSections, setSbEditSections] = useState<{ heading: string; bullets: string }[]>([]);
  const [sbEditKeyTerms, setSbEditKeyTerms] = useState("");
  const [sbSaving, setSbSaving] = useState(false);

  // ── Exam Mode ──────────────────────────────────────────────────────────────
  const { data: examPackData, mutate: mutateExamPack } = useSWR(
    visitedTabs.has("studybook") ? `${BASE}/api/examprep?courseId=${course.id}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const examContent: any = examPackData?.data?.content ?? null;
  const [examLoading, setExamLoading] = useState(false);
  const [examDateInput, setExamDateInput] = useState("");
  const [examChosen, setExamChosen] = useState<Record<number, string>>({});
  const [examRevealed, setExamRevealed] = useState<Set<number>>(new Set());
  const examDaysLeft = examContent?.examDate
    ? Math.max(0, Math.ceil((new Date(examContent.examDate).getTime() - Date.now()) / 86400000))
    : null;

  async function generateExam() {
    setExamLoading(true);
    setExamChosen({});
    setExamRevealed(new Set());
    try {
      const res = await apiFetch(`/api/examprep/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id, examDate: examDateInput || undefined }),
      });
      mutateExamPack({ data: res.data }, false);
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      toast(
        e?.name === "QuotaError" ? msg : msg.includes("empty_memory") ? t.workspace.exam.emptyMemory : t.workspace.exam.failed,
        "error"
      );
    } finally {
      setExamLoading(false);
    }
  }

  function renderExamCites(citations: any[]) {
    if (!citations?.length) return null;
    return (
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {citations.map((c: any, i: number) => {
          const clickable = citationClickable(c);
          const Icon = c.sourceType === "note" ? PenLine : c.sourceType === "file" ? FileText : Play;
          return (
            <button
              key={i}
              disabled={!clickable}
              onClick={() => clickable && openCitation(c)}
              className="flex items-center gap-1 text-[10px] rounded-full border px-2 py-0.5 transition-colors disabled:opacity-60 hover:bg-[rgba(75,95,232,0.1)]"
              style={{ borderColor: "rgba(75,95,232,0.3)", color: "#4B5FE8", background: "rgba(75,95,232,0.05)" }}
            >
              {askCiteLoading === c.n ? <Loader2 size={9} className="animate-spin" /> : <Icon size={9} />}
              <span className="truncate max-w-[220px]">{c.label}</span>
            </button>
          );
        })}
      </div>
    );
  }
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
  const [recovered, setRecovered] = useState<{ meta: RecMeta; blob: Blob } | null>(null);
  useEffect(() => {
    // A protected copy left behind means the last recording was interrupted
    recSafeLoad().then(r => { if (r) setRecovered(r); }).catch(() => {});
  }, []);
  const [openLectureId, setOpenLectureId] = useState<string | null>(null);
  const [openTab, setOpenTab] = useState<"transcript" | "summary" | "keypoints" | "chatbot">("transcript");
  const [openChatMessages, setOpenChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [openChatInput, setOpenChatInput] = useState("");
  const [openChatLoading, setOpenChatLoading] = useState(false);
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
            const errorMessage = res.data?.errorMessage;
            setProcessingError(errorMessage || "Processing failed. Check your internet connection and try again.");
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

  async function acquireWakeLock() {
    // Keep the screen awake during long recordings — a locked/sleeping screen
    // can silently suspend the recorder, killing a whole lecture.
    try {
      wakeLockRef.current = await (navigator as any).wakeLock?.request?.("screen");
    } catch { /* unsupported browser — recording still works, screen may sleep */ }
  }

  function releaseWakeLock() {
    try { wakeLockRef.current?.release?.(); } catch { /* ignore */ }
    wakeLockRef.current = null;
  }

  // Re-acquire the lock if the user tabs away and back mid-recording
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && mediaRef.current?.state === "recording") acquireWakeLock();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({
      // lecture halls: suppress room noise, level out a far-away professor
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const recorder = new MediaRecorder(stream);
    mediaRef.current = recorder;
    chunksRef.current = [];
    setRecovered(null);
    await recSafeStart({
      title: recTitle.trim() || `Lecture ${new Date().toLocaleDateString()}`,
      courseId: course.id,
      courseName: course.name,
      startedAt: Date.now(),
      mime: recorder.mimeType || "audio/webm",
    });
    recorder.ondataavailable = e => { chunksRef.current.push(e.data); recSafeAppend(e.data); };
    recorder.start(250);
    setRecording(true);
    setRecStep("recording");
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    acquireWakeLock();
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
    releaseWakeLock();
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
      recSafeClear();
    } catch (e: any) {
      toast(e?.message ?? "Upload failed — your recording is still here, give it another try.", "error");
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

    // Just-recorded lectures already have a local blob URL; otherwise stream
    // via a signed URL so playback starts instantly and seeking works.
    let audioUrl: string | null = localAudioUrlsRef.current.get(lecture.id) ?? null;
    if (!audioUrl) {
      try {
        const r = await apiFetch(`/api/lectures/${lecture.id}/audio-url`);
        if (r?.data?.url) audioUrl = `${BASE}${r.data.url}`;
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
    setOpenChatMessages([]);
    setOpenChatInput("");
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

  async function sendOpenChat() {
    if (!openChatInput.trim() || openChatLoading || !openLectureId) return;
    const userMsg = { role: "user" as const, content: openChatInput.trim() };
    const next = [...openChatMessages, userMsg];
    setOpenChatMessages(next);
    setOpenChatInput("");
    setOpenChatLoading(true);
    try {
      const res = await apiFetch("/api/studybook/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lectureId: openLectureId, messages: next }),
      });
      setOpenChatMessages([...next, { role: "assistant", content: res.data.reply }]);
    } catch { /* silent */ } finally {
      setOpenChatLoading(false);
    }
  }

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

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
    try {
      await apiFetch(`/api/notes/${id}`, { method: "DELETE" });
      mutateNotes();
      if (activeNote?.id === id) { setActiveNote(null); setNoteView("list"); }
      toast("Note deleted", "success");
    } catch (e: any) {
      toast(e?.message ?? "Couldn't delete the note — try again.", "error");
    }
  }

  // ── study book helpers ──
  function openSb(sb: any) {
    setActiveSb(sb);
    setSbView("detail");
    setSbEditMode(false);
    setExpandedChapters(new Set());
    setExpandedSbSections({ glossary: false, flashcards: false, examQ: false, tips: false, practiceQ: false });
  }

  function closeSb() {
    setSbView("list");
    setActiveSb(null);
    setSbEditMode(false);
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
      toast("Changes saved", "success");
    } catch (e: any) {
      toast(e?.message ?? "Couldn't save your changes — try again.", "error");
    } finally {
      setSbSaving(false);
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

  // ── ask your course (RAG chat over everything captured) ──
  const { data: askStatusData, mutate: mutateAskStatus } = useSWR(
    visitedTabs.has("ask") ? `${BASE}/api/ask/status?courseId=${course.id}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const askStatus = askStatusData?.data;
  const [askMessages, setAskMessages] = useState<{ role: "user" | "assistant"; content: string; citations?: any[] }[]>([]);
  const [askInput, setAskInput] = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const [askIndexing, setAskIndexing] = useState(false);
  const askAutoIndexed = useRef(false);

  async function rebuildAskMemory() {
    setAskIndexing(true);
    try {
      await apiFetch("/api/ask/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id }),
      });
      await mutateAskStatus();
    } catch { /* non-fatal */ }
    setAskIndexing(false);
  }

  // First visit with content but no memory yet — build it automatically
  useEffect(() => {
    if (!askStatusData || askAutoIndexed.current) return;
    if ((askStatusData.data?.chunkCount ?? 0) > 0) return;
    if (!lectures.length && !notes.length) return;
    askAutoIndexed.current = true;
    rebuildAskMemory();
  }, [askStatusData]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendAsk(text?: string) {
    const q = (text ?? askInput).trim();
    if (!q || askLoading) return;
    const history = [...askMessages.map(m => ({ role: m.role, content: m.content })), { role: "user" as const, content: q }];
    setAskMessages(prev => [...prev, { role: "user", content: q }]);
    setAskInput("");
    setAskLoading(true);
    try {
      const res = await apiFetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id, messages: history }),
      });
      setAskMessages(prev => [...prev, { role: "assistant", content: res.data.reply, citations: res.data.citations ?? [] }]);
    } catch (e: any) {
      setAskMessages(prev => [...prev, { role: "assistant", content: e?.message ?? "Something went wrong — try again." }]);
    } finally {
      setAskLoading(false);
    }
  }

  // ── clickable citations: jump straight to the cited moment ──
  const [askPlayer, setAskPlayer] = useState<{ title: string; url: string; startSec: number } | null>(null);
  const [askCiteLoading, setAskCiteLoading] = useState<number | null>(null);
  const askAudioRef = useRef<HTMLAudioElement | null>(null);

  function citationClickable(c: any) {
    return ["lecture", "video", "file", "note"].includes(c.sourceType);
  }

  async function openCitation(c: any) {
    const startSec = Math.max(0, Math.floor(c.startSec ?? 0));

    // YouTube source → open the video at the cited timestamp
    if (c.sourceType === "video") {
      const lec = lectures.find((l: any) => l.id === c.sourceId);
      const vid = ytIdFromUrl(lec?.audioUrl);
      if (vid) { window.open(`https://www.youtube.com/watch?v=${vid}&t=${startSec}s`, "_blank"); return; }
      toast("Couldn't locate this video.", "error");
      return;
    }

    // Attached slides (or another indexed file source) → open the underlying
    // recording's detail view, where its cheat sheet/transcript live.
    if (c.sourceType === "file") {
      setAskCiteLoading(c.n);
      try {
        // Slides are indexed as "<lectureId>_slides", pointing back at the lecture.
        const targetId = String(c.sourceId).replace(/_slides$/, "");
        const lec = lectures.find((l: any) => l.id === targetId);
        if (!lec) { toast("Couldn't find this file's saved content.", "error"); return; }
        switchTab("record");
        await openLecture(lec);
      } finally {
        setAskCiteLoading(null);
      }
      return;
    }

    // Note → open it in the note editor
    if (c.sourceType === "note") {
      setAskCiteLoading(c.n);
      try {
        let note = notes.find((n: any) => n.id === c.sourceId);
        if (!note) {
          const r = await apiFetch(`/api/notes?courseId=${course.id}`);
          note = (r.data ?? []).find((n: any) => n.id === c.sourceId);
        }
        if (!note) { toast("Couldn't find this note.", "error"); return; }
        switchTab("note");
        setActiveNote(note);
        setNoteView("edit");
      } finally {
        setAskCiteLoading(null);
      }
      return;
    }

    // Recorded lecture → inline player seeked to the cited second
    if (c.sourceType === "lecture") {
      setAskCiteLoading(c.n);
      try {
        // Signed URL lets the browser stream + seek (range requests) instead
        // of downloading the whole lecture before playback starts.
        const r = await apiFetch(`/api/lectures/${c.sourceId}/audio-url`);
        if (!r?.data?.url) throw new Error();
        setAskPlayer({ title: c.sourceTitle ?? c.label, url: `${BASE}${r.data.url}`, startSec });
      } catch {
        toast("Audio for this lecture isn't available.", "error");
      } finally {
        setAskCiteLoading(null);
      }
    }
  }

  // When the player opens, seek to the cited moment and start playing
  useEffect(() => {
    if (!askPlayer) return;
    const el = askAudioRef.current;
    if (!el) return;
    const seekAndPlay = () => {
      el.currentTime = askPlayer.startSec;
      el.play().catch(() => { /* autoplay blocked — user presses play, position is set */ });
    };
    if (el.readyState >= 1) seekAndPlay();
    else el.addEventListener("loadedmetadata", seekAndPlay, { once: true });
    return () => el.removeEventListener("loadedmetadata", seekAndPlay);
  }, [askPlayer]);

  const TABS = [
    { key: "ask",       label: t.workspace.tabs.ask,       icon: Sparkles },
    { key: "record",    label: t.workspace.tabs.record,    icon: Mic2     },
    { key: "studybook", label: t.workspace.exam.tab, icon: GraduationCap },
    { key: "note",      label: t.workspace.tabs.note,      icon: PenLine  },
  ] as const;

  return (
    <div className="w-full min-h-full flex justify-center">
    <div className="w-full max-w-7xl px-3 py-5 md:px-8 md:py-8">
      {/* Header */}
      <div className="mb-8">
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#6E7FF3", marginBottom: 14 }}>
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
                ? { padding: "8px 16px", borderRadius: 999, fontSize: 13.5, fontWeight: 600, background: "#4B5FE8", color: "white", border: "1px solid #4B5FE8", boxShadow: "0 4px 16px rgba(75,95,232,0.35)" }
                : { padding: "8px 16px", borderRadius: 999, fontSize: 13.5, fontWeight: 500, background: "transparent", color: "rgba(31,35,40,0.8)", border: "1px solid rgba(0,0,0,0.08)" }
              }
            >
              {c.name}
            </button>
          ))}
          <button
            onClick={onBack}
            className="whitespace-nowrap transition-all"
            style={{ padding: "8px 15px", borderRadius: 999, fontSize: 13.5, fontWeight: 500, background: "transparent", color: "rgba(31,35,40,0.66)", border: "1px solid rgba(0,0,0,0.07)" }}
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
              padding: "8px 15px",
              borderRadius: 999,
              fontSize: 13.5,
              fontWeight: tab === key ? 600 : 500,
              background: tab === key ? "#4B5FE8" : "transparent",
              color: tab === key ? "white" : "rgba(31,35,40,0.8)",
              border: tab === key ? "1px solid #4B5FE8" : "1px solid rgba(0,0,0,0.08)",
              boxShadow: tab === key ? "0 4px 16px rgba(75,95,232,0.35)" : "none",
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── ASK YOUR COURSE ── */}
      {tab === "ask" && (
        <div className="flex flex-col overflow-hidden"
          style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 24, height: "calc(100dvh - 300px)", minHeight: 440 }}>

          {/* Header */}
          <div className="px-5 py-4 flex items-center gap-3 shrink-0" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(75,95,232,0.18)" }}>
              <Sparkles size={16} style={{ color: "#4B5FE8" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900">{t.workspace.ask.title}</div>
              <div className="text-[11px]" style={{ color: "rgba(31,35,40,0.6)" }}>
                {askIndexing
                  ? t.workspace.ask.building
                  : askStatus
                    ? `${t.workspace.ask.memoryLine}: ${askStatus.sources?.length ?? 0} ${(askStatus.sources?.length ?? 0) === 1 ? "source" : "sources"} · ${askStatus.chunkCount ?? 0} chunks`
                    : t.workspace.ask.subtitle}
              </div>
            </div>
            <button onClick={rebuildAskMemory} disabled={askIndexing}
              className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full transition-colors disabled:opacity-40"
              style={{ color: "rgba(31,35,40,0.7)", border: "1px solid rgba(0,0,0,0.08)" }}>
              {askIndexing ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
              {t.workspace.ask.refresh}
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {askIndexing && askMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                <Loader2 size={22} className="animate-spin" style={{ color: "#4B5FE8" }} />
                <div className="text-sm" style={{ color: "rgba(31,35,40,0.8)" }}>{t.workspace.ask.building}</div>
                <div className="text-xs" style={{ color: "rgba(31,35,40,0.55)" }}>{t.workspace.ask.buildingHint}</div>
              </div>
            )}
            {!askIndexing && askMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
                {(askStatus?.chunkCount ?? 0) === 0 ? (
                  <div className="text-sm max-w-sm" style={{ color: "rgba(31,35,40,0.66)" }}>{t.workspace.ask.empty}</div>
                ) : (
                  <>
                    <div className="text-sm" style={{ color: "rgba(31,35,40,0.66)" }}>{t.workspace.ask.subtitle}</div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {t.workspace.ask.quickPrompts.map(p => (
                        <button key={p} onClick={() => sendAsk(p)}
                          className="text-xs px-3.5 py-2 rounded-full transition-colors hover:bg-black/[0.04]"
                          style={{ color: "rgba(31,35,40,0.8)", border: "1px solid rgba(0,0,0,0.08)" }}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {askMessages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                <span className="text-sm max-w-[85%] leading-relaxed px-4 py-2.5 whitespace-pre-wrap"
                  style={{
                    background: m.role === "user" ? "#4B5FE8" : "rgba(0,0,0,0.05)",
                    color: m.role === "user" ? "white" : "rgba(31,35,40,0.85)",
                    borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  }}>{m.content}</span>
                {m.role === "assistant" && (m.citations?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 max-w-[85%]">
                    {m.citations!.map((c: any) => {
                      const playable = citationClickable(c);
                      return (
                        <button key={c.n}
                          title={
                            c.sourceType === "lecture" || c.sourceType === "video"
                              ? `Jump to this moment — ${c.snippet ?? ""}`
                              : `Open source — ${c.snippet ?? ""}`
                          }
                          onClick={() => playable && openCitation(c)}
                          disabled={!playable}
                          className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full transition-all"
                          style={{
                            background: "rgba(75,95,232,0.12)",
                            color: "#4B5FE8",
                            border: "1px solid rgba(75,95,232,0.25)",
                            cursor: playable ? "pointer" : "default",
                          }}
                          onMouseEnter={e => { if (playable) (e.currentTarget as HTMLElement).style.background = "rgba(75,95,232,0.28)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(75,95,232,0.12)"; }}
                        >
                          {askCiteLoading === c.n
                            ? <Loader2 size={9} className="animate-spin" />
                            : c.sourceType === "file"
                            ? <FileText size={9} />
                            : c.sourceType === "note"
                            ? <PenLine size={9} />
                            : <Play size={9} fill="currentColor" />}
                          <span className="font-bold">[{c.n}]</span> {c.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            {askLoading && (
              <div className="flex justify-start">
                <span className="px-4 py-3" style={{ background: "rgba(0,0,0,0.05)", borderRadius: "18px 18px 18px 4px" }}>
                  <Loader2 size={13} className="animate-spin" style={{ color: "rgba(31,35,40,0.6)" }} />
                </span>
              </div>
            )}
          </div>

          {/* Citation playback bar — jumps to the cited moment */}
          {askPlayer && (
            <div className="flex items-center gap-3 mx-4 mb-2 px-3 py-2 rounded-xl shrink-0"
              style={{ background: "rgba(75,95,232,0.14)", border: "1px solid rgba(75,95,232,0.35)" }}>
              <Play size={13} style={{ color: "#4B5FE8", flexShrink: 0 }} fill="currentColor" />
              <div className="min-w-0" style={{ maxWidth: 180 }}>
                <div className="text-[11px] font-semibold truncate" style={{ color: "#1F2328" }}>{askPlayer.title}</div>
                <div className="text-[9px]" style={{ color: "#4B5FE8" }}>
                  from {Math.floor(askPlayer.startSec / 60)}:{String(askPlayer.startSec % 60).padStart(2, "0")}
                </div>
              </div>
              <audio ref={askAudioRef} src={askPlayer.url} controls className="flex-1 h-8" style={{ minWidth: 0 }} />
              <button onClick={() => setAskPlayer(null)} aria-label="Close player"
                className="p-1 rounded-lg transition-colors hover:bg-black/[0.05]" style={{ color: "rgba(31,35,40,0.6)" }}>
                <X size={14} />
              </button>
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2 px-4 pb-4 pt-3 shrink-0" style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
            <input value={askInput} onChange={e => setAskInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendAsk()}
              placeholder={t.workspace.ask.placeholder}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.07)", color: "#1F2328" }} />
            <button onClick={() => sendAsk()} disabled={!askInput.trim() || askLoading}
              className="text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-40"
              style={{ background: "#4B5FE8", color: "white" }}>
              {t.workspace.ask.send}
            </button>
          </div>
        </div>
      )}

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
              <button onClick={closeOpenLecture} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-6">
                <ArrowLeft size={14} /> Back to recordings
              </button>
              {openLectureData === null ? (
                <div className="flex items-center gap-3 text-sm text-gray-600 py-8">
                  <Loader2 size={16} className="animate-spin" /> Loading…
                </div>
              ) : (
                <div className="bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] rounded-2xl overflow-hidden">
                  <div className="px-6 py-5 border-b border-[rgba(0,0,0,0.07)]">
                    <div className="text-lg font-medium text-gray-900">
                      {audioLectures.find(l => l.id === openLectureId)?.title ?? "Recording"}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {(() => { const l = audioLectures.find(l => l.id === openLectureId); return l ? format(new Date(l.recordedAt), "MMMM d, yyyy") : ""; })()}
                    </div>
                  </div>
                  {/* Sticky audio player — always visible */}
                  {openLectureData.audioUrl ? (
                    <div className="px-6 py-3 border-b border-[rgba(0,0,0,0.07)] sticky top-0 z-10 bg-[#FFFFFF]">
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
                    <div className="px-6 py-3 border-b border-[rgba(0,0,0,0.07)] text-sm text-gray-500">Audio not available.</div>
                  )}
                  {/* Tabs */}
                  <div className="flex gap-2 overflow-x-auto p-3" style={{ background: "rgba(75,95,232,0.05)", borderBottom: "1px solid rgba(75,95,232,0.12)" }}>
                    {(([
                      { key: "transcript" as const, label: "Transcript" },
                      { key: "summary" as const,    label: "Summary"    },
                      { key: "keypoints" as const,  label: "Key Points" },
                      { key: "chatbot" as const,    label: "Ask AI"     },
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
                          background: openTab === key ? "#4B5FE8" : "rgba(255,255,255,0.8)",
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
                        <p className="text-sm text-gray-600 leading-[1.85] whitespace-pre-wrap">
                          {openLectureData.transcript || "Transcript not available."}
                        </p>
                      </div>
                    )}
                    {openTab === "keypoints" && (
                      <div className="absolute inset-0 overflow-y-auto px-6 py-6">
                        {openLectureKeyPointsLoading ? (
                          <div className="h-full flex flex-col items-center justify-center gap-3">
                            <Loader2 size={18} className="animate-spin text-[#bbb]" />
                            <span className="text-sm text-gray-500">Generating key points…</span>
                          </div>
                        ) : openLectureKeyPoints ? (
                          <div className="space-y-2">
                            {openLectureKeyPoints.map((kp: any, i: number) => {
                              const colors: Record<string, string> = { Definition: "#6E7FF3", Important: "#f97316", Formula: "#8b5cf6", Example: "#22c55e", Warning: "#ef4444" };
                              const bg: Record<string, string> = { Definition: "rgba(110,127,243,0.06)", Important: "rgba(249,115,22,0.06)", Formula: "rgba(139,92,246,0.06)", Example: "rgba(34,197,94,0.06)", Warning: "rgba(239,68,68,0.06)" };
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
                            <p className="text-sm text-gray-500">Generate key points from this lecture</p>
                            <button onClick={generateOpenLectureKeyPoints} className="px-5 py-2.5 rounded-full text-sm font-semibold text-white" style={{ background: "#4B5FE8" }}>
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
                              <div key={i} className="border-l-2 border-[rgba(75,95,232,0.2)] pl-4">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#4B5FE8] mb-2">{s.heading}</div>
                                <ul className="space-y-2">
                                  {(s.bullets ?? []).slice(0, 4).map((b: string, j: number) => (
                                    <li key={j} className="flex gap-2 text-sm text-gray-600 leading-[1.75]">
                                      <span className="text-gray-500 shrink-0 mt-0.5">·</span>{b}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                            {(openLectureData.sheet.content?.keyTerms ?? []).length > 0 && (
                              <div className="border-l-2 border-[rgba(0,0,0,0.08)] pl-4">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Key Terms</div>
                                <div className="space-y-2">
                                  {(openLectureData.sheet.content.keyTerms ?? []).map((kt: any, i: number) => (
                                    <div key={i} className="flex gap-2 text-sm">
                                      <span className="font-semibold text-[#333] shrink-0">{kt.term}:</span>
                                      <span className="text-gray-600">{kt.definition}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-sm text-gray-500">Summary not available.</div>
                        )}
                      </div>
                    )}

                    {openTab === "chatbot" && (
                      <div className="absolute inset-0 flex flex-col">
                        <div className="flex-1 overflow-y-auto px-6 pt-5 pb-3 space-y-3">
                          {openChatMessages.length === 0 && !openChatLoading && (
                            <div className="h-full flex flex-col items-center justify-center gap-3 py-10">
                              <p className="text-sm text-gray-500 text-center max-w-xs">Ask anything about this lecture — definitions, explanations, key concepts.</p>
                              <div className="flex flex-wrap gap-2 justify-center">
                                {["Summarize the main points", "What are the key terms?", "Quiz me on this lecture"].map(s => (
                                  <button key={s} onClick={() => { setOpenChatInput(s); }}
                                    className="text-xs px-3 py-1.5 rounded-full border border-[rgba(75,95,232,0.3)] text-[#4B5FE8] hover:bg-[rgba(75,95,232,0.06)] transition-colors">
                                    {s}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {openChatMessages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                              <span className="text-sm max-w-[85%] leading-relaxed px-4 py-2.5"
                                style={{
                                  background: m.role === "user" ? "#4B5FE8" : "rgba(0,0,0,0.04)",
                                  color: m.role === "user" ? "white" : "#333",
                                  borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                                }}>{m.content}</span>
                            </div>
                          ))}
                          {openChatLoading && (
                            <div className="flex justify-start">
                              <span className="px-4 py-3 rounded-2xl rounded-bl-sm" style={{ background: "rgba(0,0,0,0.04)" }}>
                                <Loader2 size={13} className="animate-spin text-[#bbb]" />
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 px-4 pb-4 pt-3 border-t border-[rgba(0,0,0,0.07)] shrink-0">
                          <input value={openChatInput} onChange={e => setOpenChatInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendOpenChat()}
                            placeholder="Ask about this lecture…"
                            className="flex-1 bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.08)] focus:border-[rgba(0,0,0,0.15)] rounded-xl px-4 py-2.5 text-sm text-[#333] placeholder-gray-400 outline-none" />
                          <button onClick={sendOpenChat} disabled={!openChatInput.trim() || openChatLoading}
                            className="text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-40" style={{ background: "#4B5FE8", color: "white" }}>
                            Send
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* ── Interrupted-recording recovery ── */}
              {recovered && recStep === "name" && (
                <div className="rounded-2xl p-4 mb-4 border flex flex-wrap items-center gap-3" style={{ background: "rgba(217,119,6,0.07)", borderColor: "rgba(217,119,6,0.3)" }}>
                  <div className="flex-1 min-w-[200px]">
                    <div className="text-sm font-semibold" style={{ color: "#92400E" }}>Recording recovered</div>
                    <div className="text-xs mt-0.5" style={{ color: "rgba(31,35,40,0.6)" }}>
                      "{recovered.meta.title}" · {recovered.meta.courseName} · {(recovered.blob.size / 1048576).toFixed(1)} MB — interrupted before it was saved.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSavedBlob(recovered.blob);
                        setSavedAudioUrl(URL.createObjectURL(recovered.blob));
                        setRecTitle(recovered.meta.title);
                        setRecStep("saved");
                        setRecovered(null);
                      }}
                      className="text-xs font-semibold px-4 py-2 rounded-full text-white"
                      style={{ background: "#D97706" }}>
                      Restore
                    </button>
                    <button
                      onClick={() => { recSafeClear(); setRecovered(null); }}
                      className="text-xs px-3 py-2 transition-colors hover:text-red-600"
                      style={{ color: "rgba(31,35,40,0.5)" }}>
                      Discard
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step: name ── */}
              {recStep === "name" && (
                <div className="bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] rounded-2xl p-8 flex flex-col items-center gap-5">
                  <div className="w-full space-y-2">
                    <label className="text-[10px] text-gray-600 uppercase tracking-widest block">Recording Name</label>
                    <input
                      autoFocus
                      value={recTitle}
                      onChange={e => setRecTitle(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && recTitle.trim() && startRecording()}
                      placeholder="e.g. Lecture 3 — Cell Division"
                      className="w-full bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[rgba(0,0,0,0.18)]"
                    />
                    <p className="text-xs text-gray-500">{format(new Date(), "MMMM d, yyyy")}</p>
                  </div>
                  <button
                    onClick={startRecording}
                    disabled={!recTitle.trim()}
                    className="w-16 h-16 rounded-full flex items-center justify-center bg-[rgba(0,0,0,0.05)] hover:bg-[rgba(0,0,0,0.07)] transition-colors disabled:opacity-30"
                  >
                    <Mic size={22} className="text-gray-900" />
                  </button>
                  <p className="text-xs text-gray-500">{recTitle.trim() ? "Tap to start recording" : "Enter a name to start"}</p>
                </div>
              )}

              {/* ── Step: recording ── */}
              {recStep === "recording" && (
                <div className="bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] rounded-2xl p-8 flex flex-col items-center gap-4">
                  <div className="text-xs text-gray-500 self-start font-medium">{recTitle}</div>
                  <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 64, fontWeight: 400, color: "#1F2328", letterSpacing: -2, fontVariantNumeric: "tabular-nums" }}>{fmt(seconds)}</div>
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
                      {paused ? <Play size={16} className="text-gray-900" /> : <Pause size={16} className="text-gray-900" />}
                      <span className="text-sm font-medium text-gray-900">{paused ? "Resume" : "Pause"}</span>
                    </button>
                    <button
                      onClick={stopRecording}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:opacity-90 transition-opacity"
                    >
                      <StopCircle size={16} className="text-white" />
                      <span className="text-sm font-medium text-white">Stop</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step: saved ── */}
              {recStep === "saved" && (
                <div className="bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={15} className="text-green-500" />
                    <span className="text-sm font-medium text-gray-900">{recTitle || "Recording"}</span>
                    <span className="ml-auto text-xs text-gray-500">{fmt(seconds)}</span>
                  </div>
                  <button
                    onClick={playAudio}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[rgba(0,0,0,0.08)] hover:bg-[rgba(0,0,0,0.02)] transition-colors"
                  >
                    {playing ? <Pause size={15} className="text-gray-900" /> : <Play size={15} className="text-gray-900" />}
                    <span className="text-sm text-gray-900">{playing ? "Pause" : "Listen to recording"}</span>
                  </button>
                  {processingError && (
                    <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">{processingError}</div>
                  )}
                  <button
                    onClick={processAudio}
                    disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-indigo-600 hover:opacity-90 transition-opacity disabled:opacity-40"
                  >
                    {uploading ? <Loader2 size={16} className="animate-spin text-white" /> : <Sparkles size={16} className="text-white" />}
                    <span className="text-base font-medium text-white">Process Audio</span>
                  </button>
                  <button onClick={resetRecorder} className="w-full text-xs text-[rgba(0,0,0,0.3)] hover:text-gray-600 transition-colors">
                    Discard recording
                  </button>
                </div>
              )}

              {/* ── Step: processing ── */}
              {recStep === "processing" && (
                <div className="bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] rounded-2xl p-16 flex flex-col items-center gap-6">
                  <div className="relative flex items-center justify-center w-28 h-28">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="absolute rounded-full border border-[rgba(0,0,0,0.1)]" style={{
                        width: 40 + i * 22,
                        height: 40 + i * 22,
                        animation: `ringPulse 2s ease-out ${i * 0.45}s infinite`,
                      }} />
                    ))}
                    <Loader2 size={22} className="animate-spin text-gray-900 relative z-10" />
                  </div>
                  <div className="text-center space-y-1">
                    <div className="text-sm font-medium text-gray-900">Processing your audio…</div>
                    <div className="text-xs text-gray-500">
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
                <div className="bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] rounded-2xl p-12 flex flex-col items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                    <CheckCircle size={24} className="text-green-500" />
                  </div>
                  <div className="text-center">
                    <div className="text-base font-medium text-gray-900 mb-1">Processing complete!</div>
                    <div className="text-sm text-gray-500">Your recording is ready. Open it from the list below.</div>
                  </div>
                </div>
              )}

              {/* ── Recordings list ── */}
              {audioLectures.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">Recordings</p>
                  <div className="space-y-2">
                    {audioLectures.map(l => (
                      <div key={l.id} className="bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 transition-all" style={{ borderColor: confirmArchiveId === l.id ? "rgba(239,68,68,0.25)" : undefined }}>
                        {confirmArchiveId === l.id ? (
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs text-gray-600 flex-1">Delete <span className="font-medium text-gray-900">"{l.title}"</span>?</p>
                            <div className="flex items-center gap-2 shrink-0">
                              <button onClick={() => setConfirmArchiveId(null)} className="text-xs px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
                              <button onClick={() => archiveLecture(l.id)} className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors">Delete</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[rgba(0,0,0,0.06)]">
                              <Mic2 size={12} className="text-gray-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-gray-900 truncate">{l.title}</div>
                              <div className="text-xs text-gray-500 mt-0.5">{format(new Date(l.recordedAt), "MMM d, yyyy")}</div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {l.status === "ready" ? (
                                <button
                                  onClick={() => openLecture(l)}
                                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[rgba(0,0,0,0.05)] text-gray-900 hover:bg-[rgba(0,0,0,0.07)] transition-colors"
                                >
                                  Open
                                </button>
                              ) : l.status === "error" ? (
                                <span className="text-[9px] font-semibold text-red-600 px-2 py-0.5 rounded-full bg-red-50">Failed</span>
                              ) : (
                                <span className="text-[9px] font-semibold text-gray-600 px-2 py-0.5 rounded-full bg-[rgba(0,0,0,0.06)] flex items-center gap-1">
                                  <Loader2 size={8} className="animate-spin" /> Processing
                                </span>
                              )}
                              <button
                                onClick={() => setConfirmArchiveId(l.id)}
                                className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                style={{ color: "rgba(148,163,184,0.4)" }}
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

      {/* ── EXAM MODE ── */}
      {tab === "studybook" && (
        <div className="space-y-4">
          {!examContent && !examLoading && (
            <div className="rounded-3xl border p-8 md:p-12 text-center" style={{ background: "#FFFFFF", borderColor: "rgba(0,0,0,0.07)" }}>
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "linear-gradient(135deg,#4B5FE8,#6E7FF3)", boxShadow: "0 8px 24px rgba(75,95,232,0.35)" }}>
                <GraduationCap size={26} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{t.workspace.exam.title}</h2>
              <p className="text-sm text-gray-600 max-w-md mx-auto mb-7 leading-relaxed">{t.workspace.exam.tagline}</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 whitespace-nowrap">{t.workspace.exam.dateLabel}</label>
                  <input type="date" value={examDateInput} onChange={e => setExamDateInput(e.target.value)}
                    className="rounded-xl border px-3 py-2 text-sm text-gray-900 outline-none"
                    style={{ borderColor: "rgba(0,0,0,0.1)", background: "#FBFBFA" }} />
                </div>
                <button onClick={generateExam}
                  className="flex items-center gap-2 text-sm font-semibold px-6 py-2.5 rounded-full text-white hover:opacity-90 transition-opacity"
                  style={{ background: "#4B5FE8", boxShadow: "0 4px 16px rgba(75,95,232,0.35)" }}>
                  <Sparkles size={15} /> {t.workspace.exam.generate}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-5">{t.workspace.exam.note}</p>
            </div>
          )}

          {examLoading && (
            <div className="rounded-3xl border p-12 text-center" style={{ background: "#FFFFFF", borderColor: "rgba(0,0,0,0.07)" }}>
              <Loader2 size={28} className="animate-spin mx-auto mb-4" style={{ color: "#4B5FE8" }} />
              <div className="text-sm font-medium text-gray-900 mb-1">{t.workspace.exam.generating}</div>
              <p className="text-xs text-gray-500">{t.workspace.exam.generatingSub}</p>
            </div>
          )}

          {examContent && !examLoading && (
            <>
              {/* Status / countdown bar */}
              <div className="rounded-2xl border p-4 flex flex-wrap items-center gap-3" style={{ background: "#FFFFFF", borderColor: "rgba(0,0,0,0.07)" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#4B5FE8,#6E7FF3)" }}>
                  <GraduationCap size={17} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900">
                    {examDaysLeft != null
                      ? (examDaysLeft > 0 ? t.workspace.exam.daysLeft.replace("{n}", String(examDaysLeft)) : t.workspace.exam.examToday)
                      : t.workspace.exam.title}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {t.workspace.exam.builtFrom.replace("{s}", String(examContent.sourceCount ?? 0)).replace("{c}", String(examContent.chunkCount ?? 0))}
                  </div>
                </div>
                <input type="date" value={examDateInput} onChange={e => setExamDateInput(e.target.value)}
                  className="rounded-xl border px-3 py-1.5 text-xs text-gray-900 outline-none" style={{ borderColor: "rgba(0,0,0,0.1)", background: "#FBFBFA" }} />
                <button onClick={generateExam}
                  className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full border text-gray-700 hover:bg-[#F1F0EE] transition-colors"
                  style={{ borderColor: "rgba(0,0,0,0.1)" }}>
                  <RotateCcw size={12} /> {t.workspace.exam.regenerate}
                </button>
              </div>

              {/* Likely topics */}
              {(examContent.topics ?? []).length > 0 && (
                <div className="rounded-2xl border p-5" style={{ background: "#FFFFFF", borderColor: "rgba(0,0,0,0.07)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Target size={14} style={{ color: "#4B5FE8" }} />
                    <h3 className="text-sm font-bold text-gray-900">{t.workspace.exam.topics}</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">{t.workspace.exam.topicsSub}</p>
                  <div className="space-y-3">
                    {examContent.topics.map((tp: any, i: number) => (
                      <div key={i} className="rounded-xl border p-4" style={{ borderColor: "rgba(0,0,0,0.06)", background: "#FBFBFA" }}>
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <div className="text-sm font-semibold text-gray-900">{tp.name}</div>
                          <div className="flex gap-1 shrink-0">
                            {[1, 2, 3, 4, 5].map(n => (
                              <span key={n} className="w-4 h-1.5 rounded-full" style={{ background: n <= tp.importance ? "#4B5FE8" : "rgba(0,0,0,0.08)" }} />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">{tp.why}</p>
                        {renderExamCites(tp.citations)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Predicted questions */}
              {(examContent.questions ?? []).length > 0 && (
                <div className="rounded-2xl border p-5" style={{ background: "#FFFFFF", borderColor: "rgba(0,0,0,0.07)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={14} style={{ color: "#4B5FE8" }} />
                    <h3 className="text-sm font-bold text-gray-900">{t.workspace.exam.questions}</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">{t.workspace.exam.questionsSub}</p>
                  <div className="space-y-3">
                    {examContent.questions.map((q: any, qi: number) => {
                      const chosen = examChosen[qi];
                      const answered = q.type === "mcq" ? chosen != null : examRevealed.has(qi);
                      return (
                        <div key={qi} className="rounded-xl border p-4" style={{ borderColor: "rgba(0,0,0,0.06)", background: "#FBFBFA" }}>
                          <div className="flex items-start gap-2.5 mb-3">
                            <span className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold mt-0.5" style={{ background: "rgba(75,95,232,0.1)", color: "#4B5FE8" }}>{qi + 1}</span>
                            <p className="text-sm text-gray-900 font-medium leading-relaxed">{q.question}</p>
                          </div>
                          {q.type === "mcq" && q.options && (
                            <div className="space-y-1.5 mb-2">
                              {q.options.map((opt: string) => {
                                const letter = opt.match(/^[A-D]/)?.[0] ?? opt[0];
                                const isCorrect = letter === q.correctAnswer;
                                const isChosen = chosen === letter;
                                return (
                                  <button key={opt} disabled={answered}
                                    onClick={() => setExamChosen(p => ({ ...p, [qi]: letter }))}
                                    className="w-full text-left text-xs rounded-lg border px-3 py-2 transition-colors disabled:cursor-default"
                                    style={{
                                      borderColor: answered && isCorrect ? "rgba(22,163,74,0.5)" : answered && isChosen ? "rgba(220,38,38,0.5)" : "rgba(0,0,0,0.08)",
                                      background: answered && isCorrect ? "rgba(22,163,74,0.08)" : answered && isChosen ? "rgba(220,38,38,0.07)" : "#FFFFFF",
                                      color: "#1F2328",
                                    }}>
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {q.type === "short" && !answered && (
                            <button onClick={() => setExamRevealed(p => new Set([...p, qi]))}
                              className="text-xs font-semibold px-4 py-2 rounded-full border text-gray-700 hover:bg-[#F1F0EE] transition-colors mb-2"
                              style={{ borderColor: "rgba(0,0,0,0.1)" }}>
                              {t.workspace.exam.reveal}
                            </button>
                          )}
                          {answered && (
                            <div className="rounded-lg p-3 mb-1" style={{ background: "rgba(75,95,232,0.06)", border: "1px solid rgba(75,95,232,0.2)" }}>
                              {q.type === "short" && <div className="text-xs text-gray-900 font-medium mb-1">{q.correctAnswer}</div>}
                              <p className="text-xs text-gray-600 leading-relaxed">{q.explanation}</p>
                            </div>
                          )}
                          {renderExamCites(q.citations)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Gaps in your notes */}
              {(examContent.gaps ?? []).length > 0 && (
                <div className="rounded-2xl border p-5" style={{ background: "#FFFFFF", borderColor: "rgba(0,0,0,0.07)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={14} style={{ color: "#D97706" }} />
                    <h3 className="text-sm font-bold text-gray-900">{t.workspace.exam.gaps}</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">{t.workspace.exam.gapsSub}</p>
                  <div className="space-y-3">
                    {examContent.gaps.map((g: any, i: number) => (
                      <div key={i} className="rounded-xl p-4 border" style={{ background: "rgba(217,119,6,0.06)", borderColor: "rgba(217,119,6,0.25)" }}>
                        <div className="text-sm font-semibold text-gray-900 mb-1">{g.topic}</div>
                        <p className="text-xs text-gray-600 leading-relaxed mb-1.5">{g.evidence}</p>
                        <p className="text-xs font-medium" style={{ color: "#B45309" }}>→ {g.suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Study plan */}
              {(examContent.plan ?? []).length > 0 && (
                <div className="rounded-2xl border p-5" style={{ background: "#FFFFFF", borderColor: "rgba(0,0,0,0.07)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar size={14} style={{ color: "#4B5FE8" }} />
                    <h3 className="text-sm font-bold text-gray-900">{t.workspace.exam.plan}</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">{t.workspace.exam.planSub}</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {examContent.plan.map((d: any, i: number) => (
                      <div key={i} className="rounded-xl border p-4" style={{ background: "#FBFBFA", borderColor: "rgba(0,0,0,0.06)" }}>
                        <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#4B5FE8" }}>{d.label}</div>
                        <div className="text-sm font-semibold text-gray-900 mb-2">{d.focus}</div>
                        <div className="space-y-1">
                          {(d.items ?? []).map((it: string, j: number) => (
                            <div key={j} className="flex gap-2 text-xs text-gray-600">
                              <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: "rgba(0,0,0,0.3)" }} />
                              {it}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAKE NOTE ── */}
      {tab === "note" && noteView === "list" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-600 uppercase tracking-widest">Your Notes</p>
            <button
              onClick={() => { setNewNoteName(""); setNoteView("create"); }}
              className="flex items-center gap-1.5 text-xs bg-[#FFFFFF] text-gray-900 px-3 py-1.5 rounded-full font-medium hover:bg-[#F1F0EE] transition-colors"
            >
              <Plus size={11} /> New Note
            </button>
          </div>

          {notes.length === 0 ? (
            <div className="bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] rounded-2xl p-10 text-center">
              <PenLine size={28} className="mx-auto mb-3 text-[#222]" />
              <p className="text-sm text-gray-600 mb-1">No notes yet</p>
              <p className="text-xs text-gray-600 mb-4">Create your first note for {course.name}</p>
              <button
                onClick={() => { setNewNoteName(""); setNoteView("create"); }}
                className="text-xs border border-[rgba(0,0,0,0.1)] px-4 py-2 rounded-full text-gray-900 hover:border-[#ddd] transition-colors"
              >
                Create a note
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {notes.map(n => (
                <div key={n.id} className="group bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 flex items-center justify-between hover:border-[rgba(0,0,0,0.1)] transition-colors">
                  <button className="flex-1 text-left" onClick={() => { setActiveNote(n); setNoteSavedAt(null); setNoteView("edit"); }}>
                    <div className="text-sm text-gray-900">{n.name}</div>
                    <div className="text-[10px] text-gray-600 mt-0.5">
                      {format(new Date(n.updatedAt), "MMM d, yyyy · h:mm a")}
                    </div>
                  </button>
                  <button
                    onClick={() => deleteNote(n.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-600 transition-all ml-3"
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
          <button onClick={() => setNoteView("list")} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm mb-6">
            <ArrowLeft size={14} /> Back
          </button>
          <h2 className="font-serif italic text-2xl mb-1">New Note</h2>
          <p className="text-gray-600 text-sm mb-6">Give your note a name to get started.</p>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-gray-600 uppercase tracking-widest block mb-1.5">Note name</label>
              <input
                autoFocus
                value={newNoteName}
                onChange={e => setNewNoteName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createNote()}
                placeholder="e.g. Chapter 3 — Derivatives, Lecture 5…"
                className="w-full bg-[#FFFFFF] border border-[rgba(0,0,0,0.08)] focus:border-indigo-500/50 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none"
              />
            </div>
            <button
              onClick={createNote}
              disabled={!newNoteName.trim()}
              className="w-full bg-[#FFFFFF] text-gray-900 rounded-xl py-3 text-sm font-medium disabled:opacity-40 hover:bg-[#F1F0EE] transition-colors"
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
            <button onClick={() => setNoteView("list")} className="text-gray-600 hover:text-gray-900 transition-colors">
              <ArrowLeft size={15} />
            </button>
            <div className="text-sm font-medium text-gray-900">{activeNote.name}</div>
            <div className="ml-auto flex items-center gap-3">
              {noteSavedAt && (
                <span className="text-[10px] text-gray-600">
                  Saved {noteSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <button
                onClick={saveNoteNow}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
              >
                Save
              </button>
            </div>
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: `Delete "${activeNote.name}"?`,
                  message: "This note will be permanently removed and dropped from your course memory. This can't be undone.",
                  confirmLabel: "Delete note",
                  danger: true,
                });
                if (ok) deleteNote(activeNote.id);
              }}
              className="text-gray-600 hover:text-red-600 transition-colors"
              aria-label="Delete note"
            >
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

  const { data: coursesData } = useSWR(userId ? `${BASE}/api/courses` : null, fetcher, { revalidateOnFocus: false });
  const allCourses: any[] = coursesData?.data ?? [];

  const [view, setView] = useState<View>("list");
  const [activeCourse, setActiveCourse] = useState<any | null>(null);

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
        onBack={() => setView("list")}
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
