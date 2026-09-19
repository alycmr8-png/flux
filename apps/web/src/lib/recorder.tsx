"use client";
/**
 * The lecture recorder lives in the dashboard layout, not in the Record page, so
 * a recording keeps running while the student moves around the platform —
 * calendar, notes, another class. The Record page reads and drives it; the
 * floating RecordingBar shows it everywhere else.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import fixWebmDuration from "fix-webm-duration";
import { Pause, Play, ChevronRight, ChevronUp, ChevronDown, Square, Loader2, Check, X, Trash2, Sparkles } from "lucide-react";
import { useLiveTranscription } from "@/lib/useLiveTranscription";
import { useApiFetch, useApiSWRFetcher } from "@/lib/apiFetch";
import { apiBase } from "@/lib/apiBase";
import { recSafeStart, recSafeAppend, recSafeClear, recSafeLoad, type RecMeta } from "@/lib/recSafe";
import { useToast, useConfirm } from "@/components/Feedback";
import { MathText } from "@/components/MathText";
import { useTr } from "@/lib/useTr";

/** Photos per recording — taken while recording or attached afterwards (the API enforces the same). */
export const MAX_LECTURE_PHOTOS = 5;

export type RecorderCourse = { id: string; name: string; color?: string | null };

/** A lecture being built on the server — a new recording, or photos attached to one. */
export type ProcessingJob = {
  lectureId: string;
  course: RecorderCourse;
  title: string;
  kind: "recording" | "photos";
  status: string;
  error?: string;
};
type Capture = { stream: MediaStream; release: () => void; isLive: () => boolean };

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function autoTitleFor(course: RecorderCourse) {
  const now = new Date();
  const day = now.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const time = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${course.name} — ${day}, ${time}`;
}

function useRecorderEngine() {
  const tr = useTr();
  const toast = useToast();
  const apiFetch = useApiFetch();
  const fetcher = useApiSWRFetcher();
  const live = useLiveTranscription();
  const { data: usageData } = useSWR(`${apiBase()}/api/usage`, fetcher);
  const maxRecSeconds = (usageData?.data?.maxRecordingMinutes ?? 180) * 60;

  // The class this recording belongs to, and where it is: recording (or paused),
  // or stopped and waiting to be processed.
  const [course, setCourse] = useState<RecorderCourse | null>(null);
  const [phase, setPhase] = useState<"idle" | "recording" | "saved">("idle");
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [recTitle, setRecTitle] = useState("");
  const [images, setImages] = useState<{ file: File; url: string }[]>([]);
  const [savedBlob, setSavedBlob] = useState<Blob | null>(null);
  const [savedAudioUrl, setSavedAudioUrl] = useState<string | null>(null);
  // Set once the take has been uploaded, so it no longer counts as unsaved work.
  const [uploaded, setUploaded] = useState(false);
  const [recovered, setRecovered] = useState<{ meta: RecMeta; blob: Blob } | null>(null);
  const [stopPrompt, setStopPrompt] = useState(false);
  const [stopAtLimit, setStopAtLimit] = useState(false);
  // Which class's Record tab is on screen — the floating bar hides there.
  const [viewing, setViewing] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // Processing runs here too, so it carries on (and reports back) on any page.
  const [job, setJob] = useState<ProcessingJob | null>(null);
  const [finished, setFinished] = useState<ProcessingJob | null>(null);
  // "Bring this class (and maybe this lecture) back on screen" — the Record page acts on it.
  const [openRequest, setOpenRequest] = useState<{ courseId: string; lectureId?: string; nonce: number } | null>(null);
  // A freshly recorded take plays back from memory until the server copy is ready.
  const audioUrlsRef = useRef<Map<string, string>>(new Map());

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const captureRef = useRef<Capture | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Recording time comes from the wall clock, not from counting timer ticks:
  // browsers throttle timers in background tabs.
  const clockRef = useRef<{ accumulatedMs: number; runningSince: number | null }>({ accumulatedMs: 0, runningSince: null });
  const wakeLockRef = useRef<any>(null);
  const autoTitleRef = useRef("");
  const limitHitRef = useRef(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  const recording = phase === "recording";

  useEffect(() => {
    // A protected copy left behind means the last recording was interrupted.
    recSafeLoad().then(r => { if (r) setRecovered(r); }).catch(() => {});
  }, []);

  // ── clock ──
  const elapsedSeconds = useCallback(() => {
    const { accumulatedMs, runningSince } = clockRef.current;
    return Math.floor((accumulatedMs + (runningSince ? Date.now() - runningSince : 0)) / 1000);
  }, []);

  function startClock(fromZero: boolean) {
    if (fromZero) clockRef.current.accumulatedMs = 0;
    clockRef.current.runningSince = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setSeconds(elapsedSeconds()), 500);
    setSeconds(elapsedSeconds());
  }

  function stopClock() {
    const { runningSince } = clockRef.current;
    if (runningSince) clockRef.current.accumulatedMs += Date.now() - runningSince;
    clockRef.current.runningSince = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setSeconds(elapsedSeconds());
  }

  // ── wake lock ──
  async function acquireWakeLock() {
    try { wakeLockRef.current = await (navigator as any).wakeLock?.request?.("screen"); } catch { /* unsupported */ }
  }
  function releaseWakeLock() {
    try { wakeLockRef.current?.release?.(); } catch { /* ignore */ }
    wakeLockRef.current = null;
  }

  // While a lecture is in progress: catch the clock up when the tab is visible
  // again, re-take the wake lock, show it in the tab title, and warn before the
  // tab is closed with unsaved work.
  useEffect(() => {
    const unsaved = phase === "recording" || (phase === "saved" && !uploaded);
    if (!unsaved) return;
    // The tab title follows the student's language, so strip either wording.
    const recLabel = `● ${tr("Recording")}`, pauseLabel = `❚❚ ${tr("Paused")}`;
    const baseTitle = document.title.replace(
      new RegExp(`^(● Recording|❚❚ Paused|${recLabel}|${pauseLabel}) \\d+:\\d+ — `), "");
    const syncTitle = () => {
      if (phase === "recording") document.title = `${paused ? pauseLabel : recLabel} ${fmt(elapsedSeconds())} — ${baseTitle}`;
    };
    const onVisible = () => {
      setSeconds(elapsedSeconds());
      syncTitle();
      if (document.visibilityState === "visible" && mediaRef.current?.state === "recording") acquireWakeLock();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const titleTimer = setInterval(syncTitle, 1000);
    syncTitle();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      clearInterval(titleTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.title = baseTitle;
    };
  }, [phase, paused, uploaded, elapsedSeconds, tr]);

  // ── audio sources ──
  function releaseCapture() {
    captureRef.current?.release();
    captureRef.current = null;
  }

  async function openMicrophone(): Promise<Capture> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // lecture halls: suppress room noise, level out a far-away professor
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      return {
        stream,
        release: () => stream.getTracks().forEach(t => t.stop()),
        isLive: () => stream.getAudioTracks().some(t => t.readyState === "live"),
      };
    } catch {
      throw new Error("Microphone access was blocked. Allow it in your browser's site settings, then try again.");
    }
  }

  // ── lifecycle ──
  function lectureTitle(forCourse?: RecorderCourse | null) {
    const c = forCourse ?? course;
    // Pinned when recording started, so the name carries the time the lecture began.
    return recTitle.trim() || (c && course?.id === c.id && autoTitleRef.current) || (c ? autoTitleFor(c) : "Lecture");
  }

  async function start(forCourse: RecorderCourse) {
    // One lecture at a time: never over a recording in progress or an unsent take.
    if (phase === "recording" || (phase === "saved" && !uploaded)) return;
    // An uploaded take whose processing screen was left is done; clear it.
    if (phase === "saved") reset({ keepAudioUrl: true });
    // Browsers only expose the microphone over https or on localhost.
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMicError("Recording needs a secure connection. Open this page at http://localhost:3000 (or over https) to use the microphone.");
      return;
    }
    let capture: Capture;
    try {
      capture = await openMicrophone();
    } catch (e: any) {
      setMicError(e?.message || "Couldn't start recording — try again.");
      return;
    }
    setMicError(null);
    captureRef.current = capture;
    autoTitleRef.current = autoTitleFor(forCourse);
    setCourse(forCourse);
    const recorder = new MediaRecorder(capture.stream, { audioBitsPerSecond: 32000 });
    mediaRef.current = recorder;
    chunksRef.current = [];
    setRecovered(null);
    await recSafeStart({
      title: recTitle.trim() || autoTitleRef.current,
      courseId: forCourse.id,
      courseName: forCourse.name,
      startedAt: Date.now(),
      mime: recorder.mimeType || "audio/webm",
    });
    recorder.ondataavailable = e => { chunksRef.current.push(e.data); recSafeAppend(e.data); };
    recorder.start(250);
    limitHitRef.current = false;
    // The file upload is the source of truth; this is the words on screen.
    live.start(0, capture.stream).catch(() => { /* recording still works without live text */ });
    setPaused(false);
    setUploaded(false);
    setPhase("recording");
    startClock(true);
    acquireWakeLock();
  }

  function pause() {
    if (!mediaRef.current || pausedRef.current) return;
    mediaRef.current.pause();
    live.stop();
    setPaused(true);
    stopClock();
  }

  function resume() {
    if (!mediaRef.current || !pausedRef.current || elapsedSeconds() >= maxRecSeconds) return;
    if (captureRef.current && !captureRef.current.isLive()) {
      toast(tr("The microphone was disconnected. Process what you have, or delete it and start again."), "error");
      return;
    }
    mediaRef.current.resume();
    live.start(elapsedSeconds(), captureRef.current?.stream).catch(() => {});
    setPaused(false);
    startClock(false);
  }

  /** Ends the recording and keeps the take, ready to process. */
  async function stop(): Promise<{ blob: Blob; url: string } | null> {
    const recorder = mediaRef.current;
    if (!recorder) return null;
    releaseWakeLock();
    live.stop();
    const stopped = new Promise<void>(res => { recorder.onstop = () => res(); });
    if (recorder.state !== "inactive") recorder.stop();
    releaseCapture();
    stopClock();
    setPaused(false);
    await stopped;
    mediaRef.current = null;
    const raw = new Blob(chunksRef.current, { type: "audio/webm" });
    // Stamp the real length into the file so players can show progress and seek.
    const durationMs = Math.max(clockRef.current.accumulatedMs, 1000);
    const blob = await fixWebmDuration(raw, durationMs, { logger: false }).catch(() => raw);
    const url = URL.createObjectURL(blob);
    setSavedBlob(blob);
    setSavedAudioUrl(url);
    setPhase("saved");
    return { blob, url };
  }

  // Stop pauses and asks what to do, so a mis-tap can't cut a lecture short.
  function requestStop(atLimit = false) {
    if (!pausedRef.current) pause();
    setStopAtLimit(atLimit);
    setStopPrompt(true);
  }

  function chooseResume() {
    if (stopAtLimit) return; // nothing to resume past the plan's length limit
    setStopPrompt(false);
    resume();
  }

  // Stop on its own when a recording reaches the plan's length limit.
  useEffect(() => {
    if (phase !== "recording" || paused || limitHitRef.current) return;
    if (seconds >= maxRecSeconds) {
      limitHitRef.current = true;
      requestStop(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, phase, paused, maxRecSeconds]);

  /** Clears the session. `keepAudioUrl` when the page still plays the take back after upload. */
  function reset({ keepAudioUrl = false }: { keepAudioUrl?: boolean } = {}) {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    clockRef.current = { accumulatedMs: 0, runningSince: null };
    setSeconds(0);
    setRecTitle("");
    autoTitleRef.current = "";
    setImages(prev => { prev.forEach(({ url }) => URL.revokeObjectURL(url)); return []; });
    setPaused(false);
    setSavedBlob(null);
    if (savedAudioUrl && !keepAudioUrl) URL.revokeObjectURL(savedAudioUrl);
    setSavedAudioUrl(null);
    setUploaded(false);
    setStopPrompt(false);
    setStopAtLimit(false);
    setPhase("idle");
    setCourse(null);
  }

  /** Throws the recording away — the page confirms first. */
  function discard() {
    setStopPrompt(false);
    releaseWakeLock();
    live.stop();
    const recorder = mediaRef.current;
    if (recorder) {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
    }
    mediaRef.current = null;
    releaseCapture();
    chunksRef.current = [];
    recSafeClear();
    reset();
  }

  // ── processing ──
  /** Sends the take to be processed — stopping the recording first if it's still going. */
  async function processTake(): Promise<boolean> {
    if (uploading || !course) return false;
    let blob = savedBlob;
    let url = savedAudioUrl;
    const forCourse = course;
    const title = lectureTitle(forCourse);
    if (phase === "recording") {
      setStopPrompt(false);
      const take = await stop();
      if (!take) return false;
      blob = take.blob;
      url = take.url;
      // Let the live stream deliver its last words, and any sentence still being typeset.
      await new Promise(r => setTimeout(r, 1200));
      await live.flush();
    }
    if (!blob) return false;
    setUploading(true);
    setFinished(null);
    try {
      const fd = new FormData();
      fd.append("audio", blob, "lecture.webm");
      fd.append("courseId", forCourse.id);
      fd.append("title", title);
      fd.append("durationSeconds", String(Math.round(clockRef.current.accumulatedMs / 1000)));
      // The live transcript lets the server skip transcribing the same audio again.
      const liveText = live.getTranscript();
      if (liveText) {
        fd.append("liveTranscript", liveText);
        fd.append("liveSegments", JSON.stringify(live.getSegments()));
      }
      images.forEach(({ file }) => fd.append("images", file));
      const res = await apiFetch("/api/lectures", { method: "POST", body: fd });
      const lectureId: string | undefined = res.data?.id;
      if (!lectureId) throw new Error(tr("Upload failed — your recording is still here, give it another try."));
      if (url) audioUrlsRef.current.set(lectureId, url);
      setUploaded(true);
      recSafeClear();
      setJob({ lectureId, course: forCourse, title, kind: "recording", status: "processing" });
      return true;
    } catch (e: any) {
      toast(e?.name === "QuotaError" ? e.message : tr("Upload failed — your recording is still here, give it another try."), "error");
      return false;
    } finally {
      setUploading(false);
    }
  }

  /** Follow a lecture that's already processing on the server (e.g. photos just attached). */
  function trackJob(next: Omit<ProcessingJob, "status">) {
    setFinished(null);
    setJob({ ...next, status: "processing" });
  }

  useEffect(() => {
    if (!job) return;
    const startedAt = Date.now();
    let stopped = false;
    const finish = (result: ProcessingJob) => {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      if (result.kind === "recording") {
        // Ready: the take is done. Failed: keep it so it can be sent again.
        if (result.status === "ready") reset({ keepAudioUrl: true });
        else setUploaded(false);
      }
      setJob(null);
      setFinished(result);
    };
    const timer = setInterval(async () => {
      if (Date.now() - startedAt > 6 * 60 * 1000) {
        finish({ ...job, status: "error", error: "Processing is taking longer than usual — check back in a few minutes." });
        return;
      }
      try {
        const res = await apiFetch(`/api/lectures/${job.lectureId}/status`);
        const status: string = res.data?.status ?? "processing";
        if (status === "ready") finish({ ...job, status });
        else if (status === "error") finish({ ...job, status, error: res.data?.errorMessage || "Processing failed. Check your connection and try again." });
        else setJob(prev => (prev && prev.lectureId === job.lectureId && prev.status !== status ? { ...prev, status } : prev));
      } catch { /* try again on the next tick */ }
    }, 3000);
    return () => { stopped = true; clearInterval(timer); };
    // Re-run only for a new lecture, not for its status updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.lectureId]);

  function requestOpen(courseId: string, lectureId?: string) {
    setOpenRequest({ courseId, lectureId, nonce: Date.now() });
  }

  function restoreRecovered() {
    if (!recovered || phase !== "idle") return;
    setCourse({ id: recovered.meta.courseId, name: recovered.meta.courseName });
    setSavedBlob(recovered.blob);
    setSavedAudioUrl(URL.createObjectURL(recovered.blob));
    setRecTitle(recovered.meta.title);
    setUploaded(false);
    setPhase("saved");
    setRecovered(null);
  }

  function discardRecovered() {
    recSafeClear();
    setRecovered(null);
  }

  function addImages(files: FileList | null) {
    if (!files?.length) return;
    const picked = Array.from(files)
      .filter(f => f.type.startsWith("image/"))
      .map(f => ({ file: f, url: URL.createObjectURL(f) }));
    setImages(prev => [...prev, ...picked].slice(0, MAX_LECTURE_PHOTOS));
  }

  function removeImage(i: number) {
    setImages(prev => {
      const target = prev[i];
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((_, j) => j !== i);
    });
  }

  return {
    live, maxRecSeconds,
    course, phase, recording, paused, seconds,
    micError, setMicError,
    recTitle, setRecTitle, lectureTitle,
    images, addImages, removeImage,
    savedBlob, savedAudioUrl, uploaded, setUploaded,
    recovered, restoreRecovered, discardRecovered,
    stopPrompt, setStopPrompt, stopAtLimit,
    start, pause, resume, stop, requestStop, chooseResume, discard, reset,
    durationSeconds: () => Math.round(clockRef.current.accumulatedMs / 1000),
    viewing, setViewing,
    uploading, processTake, job, trackJob, finished, clearFinished: () => setFinished(null),
    openRequest, requestOpen, consumeOpenRequest: () => setOpenRequest(null),
    audioUrlFor: (lectureId: string) => audioUrlsRef.current.get(lectureId) ?? null,
  };
}

export type Recorder = ReturnType<typeof useRecorderEngine>;
const RecorderContext = createContext<Recorder | null>(null);

export function RecorderProvider({ children }: { children: ReactNode }) {
  const recorder = useRecorderEngine();
  return <RecorderContext.Provider value={recorder}>{children}</RecorderContext.Provider>;
}

export function useRecorder(): Recorder {
  const ctx = useContext(RecorderContext);
  if (!ctx) throw new Error("useRecorder must be used inside <RecorderProvider>");
  return ctx;
}

const STATUS_LABEL: Record<string, string> = {
  processing: "Getting your recording ready",
  transcribing: "Writing down every word",
  generating: "Building your study material",
};

/**
 * The recorder, everywhere but that class's Record tab: the class, the clock and
 * pause/resume at a glance; expanded, the live transcript, Stop with Delete /
 * Resume / Process now, processing progress, and a way back to the lecture.
 */
export function RecordingBar() {
  const tr = useTr();
  const r = useRecorder();
  const pathname = usePathname();
  const router = useRouter();
  const confirm = useConfirm();
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const liveText = r.live.text;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [liveText, r.live.partial, expanded]);

  // Stopping, a limit or a finished lecture needs a decision — open the panel for it.
  useEffect(() => { if (r.stopPrompt || r.finished) setExpanded(true); }, [r.stopPrompt, r.finished]);

  const unsaved = !!r.course && (r.phase === "recording" || (r.phase === "saved" && !r.uploaded));
  const subject = unsaved ? r.course : r.job?.course ?? r.finished?.course ?? null;
  if (!subject) return null;
  const onItsPage = pathname.startsWith("/dashboard/record") && r.viewing === subject.id;
  if (onItsPage) return null;

  const color = subject.color || "#4B5FE8";
  const recording = unsaved && r.phase === "recording";
  const saved = unsaved && r.phase === "saved";
  const live = recording && !r.paused;

  function open(lectureId?: string) {
    r.requestOpen(subject!.id, lectureId);
    if (lectureId) r.clearFinished();
    setExpanded(false);
    if (!pathname.startsWith("/dashboard/record")) router.push("/dashboard/record");
  }

  async function remove() {
    const ok = await confirm({
      title: tr("Delete this recording?"),
      message: tr("The audio and its live transcript are removed. This can't be undone."),
      confirmLabel: tr("Delete"),
      danger: true,
    });
    if (ok) { r.discard(); setExpanded(false); }
  }

  const status = recording
    ? r.stopPrompt ? (r.stopAtLimit ? tr("Recording limit reached") : "Paused — what next?") : r.paused ? tr("Paused") : tr("Recording")
    : saved ? (r.uploading ? tr("Sending it over…") : "Stopped — not processed yet")
    : r.job ? tr(STATUS_LABEL[r.job.status] ?? "Processing")
    : r.finished?.status === "ready" ? "Study material ready"
    : "Processing didn't finish";

  const btn = "flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[14.5px] font-semibold transition-colors disabled:opacity-50";

  return (
    <div
      className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-24 md:bottom-6 w-[calc(100%-32px)] max-w-lg rounded-2xl overflow-hidden"
      style={{ background: "#0f1115", color: "#FFFFFF", boxShadow: "0 16px 40px rgba(15,17,21,0.32)" }}
    >
      {expanded && (
        <div className="px-4 pt-4 pb-1 space-y-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          {recording && (
            <div ref={scrollRef} className="max-h-40 overflow-y-auto rounded-xl px-3.5 py-3 text-[15px] leading-relaxed" style={{ background: "rgba(255,255,255,0.06)" }} aria-live="polite">
              {liveText || r.live.partial ? (
                <>
                  <MathText text={liveText} />
                  {r.live.partial && <span style={{ color: "rgba(255,255,255,0.55)" }}>{liveText ? " " : ""}{r.live.partial}</span>}
                </>
              ) : (
                <span style={{ color: "rgba(255,255,255,0.6)" }}>{r.paused ? "Paused." : "Listening — words appear here as they're spoken."}</span>
              )}
            </div>
          )}

          {(recording && r.stopPrompt) || saved ? (
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={remove} className={btn} style={{ background: "rgba(255,255,255,0.08)", color: "#FCA5A5" }}>
                <Trash2 size={15} />{tr("Delete")}</button>
              {recording && !r.stopAtLimit && (
                <button onClick={() => r.chooseResume()} className={btn} style={{ background: "rgba(255,255,255,0.12)" }}>
                  <Play size={15} />{tr("Resume")}</button>
              )}
              <button onClick={() => r.processTake()} disabled={r.uploading} className={`${btn} ml-auto`} style={{ background: color }}>
                {r.uploading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Process now
              </button>
            </div>
          ) : null}

          {r.job && (
            <div className="flex items-center gap-2.5 text-[14.5px]" style={{ color: "rgba(255,255,255,0.85)" }}>
              <Loader2 size={16} className="animate-spin shrink-0" />
              {tr(STATUS_LABEL[r.job.status] ?? "Processing")} — you can keep working.
            </div>
          )}

          {!unsaved && r.finished && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14.5px] flex-1 min-w-[180px]" style={{ color: "rgba(255,255,255,0.85)" }}>
                {r.finished.status === "ready" ? `“${r.finished.title}” is ready.` : r.finished.error}
              </span>
              {r.finished.status === "ready" && (
                <button onClick={() => open(r.finished!.lectureId)} className={btn} style={{ background: color }}>
                  <Check size={15} />{tr("Open")}</button>
              )}
              <button onClick={() => { r.clearFinished(); setExpanded(false); }} className={btn} style={{ background: "rgba(255,255,255,0.1)" }}>{tr("Dismiss")}</button>
            </div>
          )}
          <div className="h-1" />
        </div>
      )}

      <div className="flex items-center gap-2 pl-4 pr-2 py-2.5">
        <span className="relative flex w-2.5 h-2.5 shrink-0">
          {live && <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping motion-reduce:animate-none" style={{ background: "#EF4444" }} />}
          <span className="relative inline-flex w-2.5 h-2.5 rounded-full" style={{ background: live ? "#EF4444" : r.finished?.status === "error" ? "#F59E0B" : color }} />
        </span>
        <button onClick={() => setExpanded(v => !v)} className="min-w-0 flex-1 text-left" aria-expanded={expanded}>
          <div className="text-[15px] font-semibold truncate">{subject.name}</div>
          <div className="text-[13px] truncate" style={{ color: "rgba(255,255,255,0.72)" }}>
            {status}
            {recording && <> · <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(r.seconds)}</span></>}
          </div>
        </button>
        {recording && !r.stopPrompt && (
          <>
            <button
              onClick={() => (r.paused ? r.resume() : r.pause())}
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors hover:bg-white/10"
              aria-label={r.paused ? tr("Resume recording") : "Pause recording"}
            >
              {r.paused ? <Play size={18} /> : <Pause size={18} />}
            </button>
            <button
              onClick={() => { r.requestStop(); setExpanded(true); }}
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors hover:bg-white/10"
              aria-label={tr("Stop recording")}
            >
              <Square size={16} fill="currentColor" />
            </button>
          </>
        )}
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors hover:bg-white/10"
          aria-label={expanded ? "Hide details" : "Show live transcript and controls"}
        >
          {expanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
        <button
          onClick={() => open(r.finished?.status === "ready" && !unsaved ? r.finished.lectureId : undefined)}
          className="flex items-center gap-1 rounded-full pl-3.5 pr-2.5 py-2 text-[14px] font-semibold shrink-0"
          style={{ background: color, color: "#FFFFFF" }}
        >{tr("Open")}<ChevronRight size={15} />
        </button>
        {!unsaved && !r.job && r.finished && (
          <button onClick={() => r.clearFinished()} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 hover:bg-white/10" aria-label={tr("Dismiss")}>
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
