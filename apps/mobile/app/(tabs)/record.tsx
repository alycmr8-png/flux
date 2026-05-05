import { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  StatusBar, ScrollView, TextInput, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import { useApi, makeApiFetcher } from "../../lib/api";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import useSWR from "swr";

// ─── Class Gate ───────────────────────────────────────────────────────────────
function ClassGate({ insets, onSelect }: { insets: any; onSelect: (c: any) => void }) {
  const api = useApi();
  const { userId } = useAuth();
  const fetcher = makeApiFetcher(userId);
  const { data, mutate } = useSWR("/api/courses", fetcher);
  const courses: any[] = data?.data ?? [];
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const code = name.trim().slice(0, 6).toUpperCase().replace(/\s/g, "");
      const res = await api.post("/api/courses", { name: name.trim(), code });
      await mutate();
      onSelect(res.data?.data);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not create class");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={g.root} contentContainerStyle={[g.content, { paddingTop: insets.top + 16 }]}>
      <Text style={g.title}>Workspace</Text>
      <Text style={g.sub}>Select or create a class to get started</Text>

      {courses.length > 0 && (
        <>
          <Text style={g.sectionLbl}>Your classes</Text>
          {courses.map((c) => (
            <TouchableOpacity key={c.id} style={g.classCard} onPress={() => onSelect(c)} activeOpacity={0.7}>
              <Text style={g.className}>{c.name}</Text>
              <Text style={g.classCode}>{c.code}</Text>
            </TouchableOpacity>
          ))}
        </>
      )}

      <Text style={[g.sectionLbl, { marginTop: courses.length ? 24 : 0 }]}>
        {courses.length ? "New class" : "Create your first class"}
      </Text>
      <View style={g.createRow}>
        <TextInput
          style={g.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Calculus II, Biology 101…"
          placeholderTextColor="#333"
          returnKeyType="done"
          onSubmitEditing={create}
        />
        <TouchableOpacity
          style={[g.createBtn, (!name.trim() || loading) && { opacity: 0.4 }]}
          onPress={create}
          disabled={!name.trim() || loading}
          activeOpacity={0.8}
        >
          {loading ? <ActivityIndicator size="small" color="#000" /> : <Ionicons name="add" size={20} color="#000" />}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Class Workspace ──────────────────────────────────────────────────────────
function ClassWorkspace({ insets, course, onBack }: { insets: any; course: any; onBack: () => void }) {
  const api = useApi();
  const router = useRouter();
  const { userId } = useAuth();
  const fetcher = makeApiFetcher(userId);
  const [tab, setTab] = useState<"record" | "files" | "quizzes" | "video" | "studybook" | "note" | "plan">("record");

  const { data: lecturesData, mutate: mutateLectures } = useSWR(`/api/lectures?courseId=${course.id}`, fetcher);
  const lectures: any[] = lecturesData?.data ?? [];
  const { data: sheetsData, mutate: mutateSheets } = useSWR(`/api/cheatsheets?courseId=${course.id}`, fetcher);
  const studyBooks: any[] = (sheetsData?.data ?? []).filter((s: any) => s.title?.startsWith("Study Book:"));
  const [expandedBook, setExpandedBook] = useState<string | null>(null);
  const { data: quizzesData, mutate: mutateQuizzes } = useSWR(`/api/quizzes?courseId=${course.id}`, fetcher);
  const { data: sessionsData } = useSWR(
    `/api/calendar/sessions?from=${new Date().toISOString()}&to=${new Date(Date.now() + 30 * 86400000).toISOString()}`,
    fetcher
  );
  const allSessions: any[] = sessionsData?.data ?? [];
  const sessions = allSessions.filter((s: any) => s.lecture?.course?.id === course.id);
  const quizzes: any[] = quizzesData?.data ?? [];

  // ── record ──
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [recTitle, setRecTitle] = useState("");
  const [slidesUri, setSlidesUri] = useState<string | null>(null);
  const [processingLectureId, setProcessingLectureId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>("processing");
  const [lectureSheet, setLectureSheet] = useState<any | null>(null);
  const [addingToBook, setAddingToBook] = useState(false);
  const [addedToBook, setAddedToBook] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll lecture status until ready, then load sheet
  useEffect(() => {
    if (!processingLectureId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/api/lectures/${processingLectureId}/status`);
        const status = res.data?.data?.status;
        setProcessingStatus(status);
        if (status === "ready" || status === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
          if (status === "ready") {
            await mutateLectures();
            const sheetRes = await api.get(`/api/cheatsheets?lectureId=${processingLectureId}`);
            const sheets = (sheetRes.data?.data ?? []).filter((s: any) => !s.title?.startsWith("Study Book:"));
            if (sheets.length) setLectureSheet(sheets[0]);
          }
        }
      } catch {}
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [processingLectureId]);

  async function startRecording() {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { Alert.alert("Microphone denied", "Enable mic in Settings."); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch { Alert.alert("Error", "Could not start recording."); }
  }

  async function stopRecording() {
    if (!recording) return;
    if (timerRef.current) clearInterval(timerRef.current);
    const uri = recording.getURI();
    await recording.stopAndUnloadAsync();
    setRecording(null);
    if (!uri) {
      Alert.alert("Recording failed", "Could not read the audio file. Please try again.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("audio", { uri, name: "lecture.m4a", type: "audio/m4a" } as any);
      fd.append("courseId", course.id);
      fd.append("title", recTitle.trim() || `Lecture ${new Date().toLocaleDateString()}`);
      if (slidesUri) fd.append("slides", { uri: slidesUri, name: "slides.pdf", type: "application/pdf" } as any);
      const res = await api.post("/api/lectures", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setProcessingLectureId(res.data?.data?.id ?? null);
      setProcessingStatus("processing");
      setLectureSheet(null);
      setAddedToBook(false);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.response?.data?.error ?? e?.message ?? "Unknown error";
      const status = e?.response?.status;
      Alert.alert("Upload failed", status ? `${status}: ${msg}` : msg);
    } finally {
      setUploading(false);
    }
  }

  async function addToStudyBook() {
    if (!processingLectureId) return;
    setAddingToBook(true);
    try {
      await api.post("/api/studybook/generate", { lectureId: processingLectureId });
      setAddedToBook(true);
    } catch (e: any) {
      Alert.alert("Failed", e?.response?.data?.error ?? e?.message ?? "Could not add to Study Book");
    } finally {
      setAddingToBook(false);
    }
  }

  function resetRecorder() {
    setProcessingLectureId(null);
    setProcessingStatus("processing");
    setLectureSheet(null);
    setSeconds(0);
    setRecTitle("");
    setSlidesUri(null);
    setAddedToBook(false);
  }

  async function pickSlides() {
    const r = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
    if (!r.canceled) setSlidesUri(r.assets[0].uri);
  }

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── file upload ──
  const [docUri, setDocUri] = useState<string | null>(null);
  const [docName, setDocName] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [docProcessing, setDocProcessing] = useState(false);
  const [docDone, setDocDone] = useState(false);

  async function pickDoc() {
    const r = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "text/plain"] });
    if (!r.canceled) { setDocUri(r.assets[0].uri); setDocName(r.assets[0].name); }
  }

  async function uploadDoc() {
    if (!docUri) return;
    setDocProcessing(true);
    try {
      const fd = new FormData();
      fd.append("document", { uri: docUri, name: docName, type: "application/pdf" } as any);
      fd.append("title", docTitle.trim() || docName.replace(/\.[^.]+$/, ""));
      fd.append("courseId", course.id);
      await api.post("/api/documents", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setDocDone(true);
    } catch (e: any) {
      Alert.alert("Failed", e?.response?.data?.message ?? e?.message ?? "Unknown error");
    } finally {
      setDocProcessing(false);
    }
  }

  // ── youtube video ──
  const [ytUrl, setYtUrl] = useState("");
  const [ytLoading, setYtLoading] = useState(false);
  const [ytJobId, setYtJobId] = useState<string | null>(null);
  const [ytResult, setYtResult] = useState<any | null>(null);
  const [ytError, setYtError] = useState("");
  const ytPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!ytJobId) return;
    let failCount = 0;
    ytPollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/api/studybook/job/${ytJobId}`);
        const job = res.data;
        failCount = 0;
        if (job.status === "ready") {
          clearInterval(ytPollRef.current!);
          setYtJobId(null);
          setYtLoading(false);
          setYtResult({ ...job.data, title: job.title, generatedAt: new Date().toISOString() });
          mutateSheets();
        } else if (job.status === "error") {
          clearInterval(ytPollRef.current!);
          setYtJobId(null);
          setYtLoading(false);
          setYtError(job.error ?? "Processing failed");
        }
      } catch (_) {
        if (++failCount >= 3) {
          clearInterval(ytPollRef.current!);
          setYtJobId(null);
          setYtLoading(false);
          setYtError("Lost connection to server. Please try again.");
        }
      }
    }, 4000);
    return () => { if (ytPollRef.current) clearInterval(ytPollRef.current); };
  }, [ytJobId]);

  async function generateFromYouTube() {
    if (!ytUrl.trim()) return;
    setYtLoading(true);
    setYtError("");
    try {
      const res = await api.post("/api/studybook/from-youtube", { url: ytUrl.trim(), courseId: course.id });
      setYtUrl("");
      setYtJobId(res.data?.jobId);
    } catch (e: any) {
      setYtError(e?.response?.data?.error ?? e?.message ?? "Failed to start processing");
      setYtLoading(false);
    }
  }

  // ── notes (in-memory) ──
  type NoteEntry = { id: string; name: string; text: string; updatedAt: string };
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [noteView, setNoteView] = useState<"list" | "create" | "edit">("list");
  const [activeNote, setActiveNote] = useState<NoteEntry | null>(null);
  const [newNoteName, setNewNoteName] = useState("");
  const [noteSavedAt, setNoteSavedAt] = useState<string | null>(null);
  const noteSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteInputRef = useRef<any>(null);
  const noteCursorRef = useRef(0);

  function createNote() {
    if (!newNoteName.trim()) return;
    const entry: NoteEntry = { id: String(Date.now()), name: newNoteName.trim(), text: "", updatedAt: new Date().toISOString() };
    setNotes(prev => [entry, ...prev]);
    setActiveNote(entry);
    setNewNoteName("");
    setNoteView("edit");
  }

  function handleNoteChange(val: string) {
    if (!activeNote) return;
    const updated = { ...activeNote, text: val, updatedAt: new Date().toISOString() };
    setActiveNote(updated);
    setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
    if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current);
    noteSaveTimer.current = setTimeout(() => {
      setNoteSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }, 800);
  }

  function insertSymbol(sym: string) {
    const pos = noteCursorRef.current;
    const text = activeNote?.text ?? "";
    const next = text.slice(0, pos) + sym + text.slice(pos);
    handleNoteChange(next);
    noteCursorRef.current = pos + sym.length;
  }

  function deleteNote(id: string) {
    setNotes(prev => prev.filter(n => n.id !== id));
    if (activeNote?.id === id) { setActiveNote(null); setNoteView("list"); }
  }

  const MATH_SYMBOLS = ["=","≠","+","−","×","÷","±","≤","≥","≈","∞","α","β","γ","δ","π","σ","φ","ω","Δ","Σ","∫","∂","∇","∑","√","²","³","°","∈","∅","ℝ","⊥"];

  // ── quiz ──
  const [selectedLecture, setSelectedLecture] = useState<string | null>(null);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [quizDone, setQuizDone] = useState(false);

  async function generateQuiz() {
    if (!selectedLecture) return;
    setGeneratingQuiz(true);
    try {
      await api.post("/api/quizzes/generate", { lectureId: selectedLecture });
      await mutateQuizzes();
      setQuizDone(true);
    } catch (e: any) {
      Alert.alert("Failed", e?.response?.data?.message ?? e?.message ?? "Unknown error");
    } finally {
      setGeneratingQuiz(false);
    }
  }

  const TABS = [
    { key: "record",    icon: "mic-outline",           label: "Record"        },
    { key: "files",     icon: "document-text-outline", label: "Files"         },
    { key: "quizzes",   icon: "book-outline",          label: "Quizzes"       },
    { key: "video",     icon: "logo-youtube",          label: "Upload Video"  },
    { key: "studybook", icon: "bookmark-outline",      label: "Study Book"    },
    { key: "note",      icon: "create-outline",        label: "Take Note"     },
    { key: "plan",      icon: "calendar-outline",      label: "Plan"          },
  ] as const;

  return (
    <ScrollView style={g.root} contentContainerStyle={[g.content, { paddingTop: insets.top + 16 }]}>
      {/* Header */}
      <View style={w.header}>
        <TouchableOpacity onPress={onBack} style={w.backBtn}>
          <Ionicons name="arrow-back" size={18} color="#555" />
        </TouchableOpacity>
        <View>
          <Text style={w.courseName}>{course.name}</Text>
          <Text style={w.courseCode}>{course.code}</Text>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={w.tabScroll} contentContainerStyle={w.tabRow}>
        {TABS.map(({ key, icon, label }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setTab(key)}
            style={[w.tab, tab === key && w.tabActive]}
            activeOpacity={0.7}
          >
            <Ionicons name={icon as any} size={14} color={tab === key ? "#000" : "#555"} />
            <Text style={[w.tabLabel, tab === key && w.tabLabelActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── RECORD ── */}
      {tab === "record" && (
        <>
          {/* Processing spinner */}
          {processingLectureId && !lectureSheet && (
            <View style={w.doneCard}>
              {processingStatus === "error"
                ? <Ionicons name="alert-circle-outline" size={28} color="#555" style={{ marginBottom: 12 }} />
                : <ActivityIndicator size="small" color="#555" style={{ marginBottom: 14 }} />
              }
              <Text style={w.doneTitle}>
                {processingStatus === "transcribing" ? "Transcribing your lecture…"
                  : processingStatus === "generating" ? "Generating your summary…"
                  : processingStatus === "error" ? "Processing failed"
                  : "Uploading & analysing…"}
              </Text>
              {processingStatus !== "error" && (
                <View style={w.progressSteps}>
                  {["processing","transcribing","generating","ready"].map((s, i) => {
                    const idx = ["processing","transcribing","generating","ready"].indexOf(processingStatus);
                    return (
                      <View key={s} style={w.progressStep}>
                        <View style={[w.stepDot, i < idx && w.stepDotDone, i === idx && w.stepDotActive]} />
                        <Text style={[w.stepTxt, i <= idx && { color: "#666" }]}>
                          {s === "processing" ? "Upload" : s === "transcribing" ? "Transcribe" : s === "generating" ? "Summarise" : "Done"}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
              <TouchableOpacity onPress={resetRecorder} style={w.againBtn}>
                <Text style={w.againTxt}>Record another</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Inline summary sheet */}
          {lectureSheet && (
            <View style={w.card}>
              <Text style={[w.listTitle, { color: "#fff", fontSize: 14, marginBottom: 12 }]}>{lectureSheet.title}</Text>

              {(lectureSheet.content?.sections ?? []).slice(0, 3).map((s: any, i: number) => (
                <View key={i} style={{ marginBottom: 12 }}>
                  <Text style={[w.listLbl, { marginTop: 0, marginBottom: 6 }]}>{s.heading}</Text>
                  {(s.bullets ?? []).slice(0, 4).map((b: string, j: number) => (
                    <View key={j} style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
                      <Text style={{ color: "#2a2a2a", marginTop: 5 }}>•</Text>
                      <Text style={[w.cardDesc, { flex: 1 }]}>{b}</Text>
                    </View>
                  ))}
                </View>
              ))}

              {(lectureSheet.content?.keyTerms ?? []).length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={[w.listLbl, { marginTop: 0, marginBottom: 6 }]}>Key Terms</Text>
                  {(lectureSheet.content.keyTerms ?? []).slice(0, 4).map((kt: any, i: number) => (
                    <Text key={i} style={[w.cardDesc, { marginBottom: 4 }]}>
                      <Text style={{ color: "#fff" }}>{kt.term}</Text>
                      {" — "}{kt.definition}
                    </Text>
                  ))}
                </View>
              )}

              {(lectureSheet.content?.examTips ?? []).length > 0 && (
                <View style={{ backgroundColor: "#0a0a0a", borderRadius: 12, padding: 10, marginBottom: 12 }}>
                  <Text style={[w.listLbl, { marginTop: 0, marginBottom: 4 }]}>Exam Tip</Text>
                  <Text style={w.cardDesc}>{lectureSheet.content.examTips[0]}</Text>
                </View>
              )}

              <View style={{ flexDirection: "row", alignItems: "center", borderTopWidth: 0.5, borderTopColor: "#1a1a1a", paddingTop: 12, gap: 10 }}>
                <TouchableOpacity
                  onPress={addToStudyBook}
                  disabled={addingToBook || addedToBook}
                  style={[w.againBtn, { flexDirection: "row", gap: 6, alignItems: "center", opacity: (addingToBook || addedToBook) ? 0.5 : 1 }]}
                  activeOpacity={0.7}
                >
                  {addingToBook
                    ? <><ActivityIndicator size="small" color="#888" /><Text style={w.againTxt}>Adding…</Text></>
                    : addedToBook
                    ? <Text style={[w.againTxt, { color: "#4ade80" }]}>✓ Added to Study Book</Text>
                    : <Text style={w.againTxt}>+ Add to Study Book</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity onPress={resetRecorder} style={{ marginLeft: "auto" as any }}>
                  <Text style={[w.againTxt, { color: "#333" }]}>Record another</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Recorder — only shown when not processing */}
          {!processingLectureId && (
            <>
              <TextInput
                style={w.titleInput}
                value={recTitle}
                onChangeText={setRecTitle}
                placeholder="Lecture title (optional)"
                placeholderTextColor="#333"
              />
              <View style={w.recCard}>
                <Text style={w.timer}>{fmt(seconds)}</Text>
                {recording && (
                  <View style={w.liveRow}>
                    <View style={w.liveDot} />
                    <Text style={w.liveText}>Recording — {course.name}</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[w.btn, recording ? w.btnStop : w.btnStart]}
                  onPress={recording ? stopRecording : startRecording}
                  disabled={uploading}
                  activeOpacity={0.8}
                >
                  {uploading
                    ? <ActivityIndicator size="small" color="#555" />
                    : <Ionicons name={recording ? "stop" : "mic"} size={28} color={recording ? "#000" : "#fff"} />
                  }
                </TouchableOpacity>
                {uploading && <Text style={w.hint}>Uploading…</Text>}
                {!recording && !uploading && <Text style={w.hint}>Tap to start</Text>}
              </View>
              <TouchableOpacity style={w.attachRow} onPress={pickSlides} activeOpacity={0.7}>
                <Ionicons name="attach" size={15} color={slidesUri ? "#fff" : "#555"} />
                <Text style={[w.attachTxt, slidesUri && { color: "#fff" }]}>
                  {slidesUri ? "Slides attached" : "Attach PDF slides (optional)"}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {lectures.length > 0 && (
            <>
              <Text style={w.listLbl}>Recordings</Text>
              {lectures.map((l) => (
                <View key={l.id} style={w.listRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={w.listTitle}>{l.title}</Text>
                    <Text style={w.listSub}>{l.status}</Text>
                  </View>
                  <Ionicons name={l.status === "ready" ? "checkmark-circle" : "time-outline"} size={14} color="#333" />
                </View>
              ))}
            </>
          )}
        </>
      )}

      {/* ── FILES ── */}
      {tab === "files" && (
        <>
          {docDone ? (
            <View style={w.doneCard}>
              <View style={w.doneIcon}><Ionicons name="checkmark" size={24} color="#000" /></View>
              <Text style={w.doneTitle}>Saved to {course.name}</Text>
              <Text style={w.doneSub}>Your structured learning file is in Summaries.</Text>
              <TouchableOpacity onPress={() => { setDocDone(false); setDocUri(null); setDocTitle(""); }} style={w.againBtn}>
                <Text style={w.againTxt}>Upload another</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={w.card}>
                <Text style={w.cardDesc}>
                  Upload slides, notes, or a PDF — AI will generate a structured learning file for <Text style={{ color: "#fff" }}>{course.name}</Text>.
                </Text>
                <TextInput
                  style={[w.titleInput, { marginTop: 12 }]}
                  value={docTitle}
                  onChangeText={setDocTitle}
                  placeholder="Document title (optional)"
                  placeholderTextColor="#333"
                />
                <TouchableOpacity style={[w.attachRow, { marginTop: 10 }]} onPress={pickDoc} activeOpacity={0.7}>
                  <Ionicons name="document-attach-outline" size={15} color={docUri ? "#fff" : "#555"} />
                  <Text style={[w.attachTxt, docUri && { color: "#fff" }]}>
                    {docUri ? docName : "Select PDF or text file"}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[w.primaryBtn, (!docUri || docProcessing) && { opacity: 0.4 }]}
                onPress={uploadDoc}
                disabled={!docUri || docProcessing}
                activeOpacity={0.8}
              >
                {docProcessing
                  ? <><ActivityIndicator size="small" color="#000" /><Text style={w.primaryBtnTxt}>  Generating…</Text></>
                  : <Text style={w.primaryBtnTxt}>Generate Learning File</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </>
      )}

      {/* ── QUIZZES ── */}
      {tab === "quizzes" && (
        <>
          {!quizDone ? (
            <View style={w.card}>
              <Text style={w.listLbl}>Generate a quiz</Text>
              {lectures.filter((l) => l.status === "ready").length === 0 ? (
                <Text style={w.cardDesc}>No processed recordings yet. Record a lecture first.</Text>
              ) : (
                <>
                  {lectures.filter((l) => l.status === "ready").map((l) => (
                    <TouchableOpacity
                      key={l.id}
                      style={[w.listRow, selectedLecture === l.id && w.listRowSelected]}
                      onPress={() => setSelectedLecture(l.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[w.listTitle, selectedLecture === l.id && { color: "#fff" }]}>{l.title}</Text>
                      {selectedLecture === l.id && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[w.primaryBtn, { marginTop: 12 }, (!selectedLecture || generatingQuiz) && { opacity: 0.4 }]}
                    onPress={generateQuiz}
                    disabled={!selectedLecture || generatingQuiz}
                    activeOpacity={0.8}
                  >
                    {generatingQuiz
                      ? <><ActivityIndicator size="small" color="#000" /><Text style={w.primaryBtnTxt}>  Generating…</Text></>
                      : <Text style={w.primaryBtnTxt}>Generate Quiz</Text>
                    }
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : (
            <View style={w.doneCard}>
              <View style={w.doneIcon}><Ionicons name="checkmark" size={24} color="#000" /></View>
              <Text style={w.doneTitle}>Quiz generated</Text>
              <Text style={w.doneSub}>Find it in the Quizzes tab.</Text>
              <TouchableOpacity onPress={() => { setQuizDone(false); setSelectedLecture(null); }} style={w.againBtn}>
                <Text style={w.againTxt}>Generate another</Text>
              </TouchableOpacity>
            </View>
          )}

          {quizzes.length > 0 && (
            <>
              <Text style={w.listLbl}>Quizzes in this class</Text>
              {quizzes.map((q) => (
                <TouchableOpacity
                  key={q.id}
                  style={w.listRow}
                  onPress={() => router.push(`/quiz/${q.id}` as any)}
                  activeOpacity={0.7}
                >
                  <Text style={w.listTitle}>{q.title}</Text>
                  <Text style={w.listSub}>{q._count?.questions} questions</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </>
      )}

      {/* ── UPLOAD VIDEO ── */}
      {tab === "video" && (
        <>
          {!ytResult && (
            <View style={w.card}>
              <Text style={w.listLbl}>YouTube URL</Text>
              <TextInput
                style={w.titleInput}
                value={ytUrl}
                onChangeText={setYtUrl}
                placeholder="https://youtube.com/watch?v=…"
                placeholderTextColor="#333"
                autoCapitalize="none"
                keyboardType="url"
              />
              {!!ytError && (
                <Text style={{ fontSize: 11, color: "#f87171", marginBottom: 10 }}>{ytError}</Text>
              )}
              <TouchableOpacity
                style={[w.primaryBtn, (!ytUrl.trim() || ytLoading) && { opacity: 0.4 }]}
                onPress={generateFromYouTube}
                disabled={!ytUrl.trim() || ytLoading}
                activeOpacity={0.8}
              >
                {ytLoading
                  ? <><ActivityIndicator size="small" color="#000" /><Text style={w.primaryBtnTxt}>  Building chapters…</Text></>
                  : <Text style={w.primaryBtnTxt}>Generate Study Book</Text>
                }
              </TouchableOpacity>
              {ytLoading && (
                <Text style={[w.cardDesc, { textAlign: "center", marginTop: 8, color: "#333" }]}>
                  Long videos can take up to 30 seconds
                </Text>
              )}
            </View>
          )}

          {ytResult && (
            <View style={w.card}>
              {/* Header */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[w.listTitle, { color: "#fff", fontSize: 13 }]} numberOfLines={2}>{ytResult.title ?? "YouTube Study Book"}</Text>
                  <Text style={[w.listSub, { marginTop: 2 }]}>
                    {new Date(ytResult.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </Text>
                </View>
                <Text style={{ fontSize: 10, color: "#4ade80" }}>✓ Saved</Text>
              </View>

              {/* Chapters */}
              {(ytResult.chapters ?? []).length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={[w.listLbl, { marginTop: 0, marginBottom: 8 }]}>Chapters</Text>
                  {(ytResult.chapters ?? []).map((ch: any, i: number) => (
                    <View key={i} style={{ marginBottom: 10 }}>
                      <Text style={[w.listTitle, { color: "#fff", marginBottom: 2 }]}>{i + 1}. {ch.title}</Text>
                      {ch.summary && <Text style={w.cardDesc} numberOfLines={3}>{ch.summary}</Text>}
                      {(ch.keyPoints ?? []).slice(0, 2).map((kp: string, j: number) => (
                        <Text key={j} style={[w.cardDesc, { marginTop: 3 }]} numberOfLines={1}>· {kp}</Text>
                      ))}
                    </View>
                  ))}
                </View>
              )}

              {/* Stats */}
              <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
                {(ytResult.flashcards ?? []).length > 0 && (
                  <Text style={w.listSub}>{ytResult.flashcards.length} flashcards</Text>
                )}
                {(ytResult.glossary ?? []).length > 0 && (
                  <Text style={w.listSub}>{ytResult.glossary.length} glossary terms</Text>
                )}
              </View>

              <TouchableOpacity onPress={() => { setYtResult(null); setYtError(""); }} style={w.againBtn}>
                <Text style={w.againTxt}>Generate another</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* ── STUDY BOOK ── */}
      {tab === "studybook" && (
        <>
          {studyBooks.length === 0 ? (
            <View style={w.doneCard}>
              <Ionicons name="bookmark-outline" size={28} color="#333" style={{ marginBottom: 12 }} />
              <Text style={w.doneTitle}>No study books yet</Text>
              <Text style={w.doneSub}>Use the Upload Video tab to generate one from YouTube.</Text>
            </View>
          ) : (
            studyBooks.map((sb: any) => {
              const title = sb.title?.replace(/^Study Book:\s*/, "") ?? "Untitled";
              const chapters: any[] = sb.content?.chapters ?? [];
              const flashcards: any[] = sb.content?.flashcards ?? [];
              const glossary: any[] = sb.content?.glossary ?? [];
              const examQ: any[] = sb.content?.examQuestions ?? [];
              const isOpen = expandedBook === sb.id;
              return (
                <View key={sb.id} style={[w.card, { padding: 0, overflow: "hidden" }]}>
                  {/* Tappable header */}
                  <TouchableOpacity
                    onPress={() => setExpandedBook(isOpen ? null : sb.id)}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[w.listTitle, { color: "#fff" }]} numberOfLines={1}>{title}</Text>
                      <Text style={[w.listSub, { marginTop: 2 }]}>
                        {new Date(sb.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {" · "}{chapters.length} chapter{chapters.length !== 1 ? "s" : ""}
                        {flashcards.length > 0 ? ` · ${flashcards.length} flashcards` : ""}
                      </Text>
                    </View>
                    <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={14} color="#444" />
                  </TouchableOpacity>

                  {/* Expanded */}
                  {isOpen && (
                    <View style={{ borderTopWidth: 0.5, borderTopColor: "#1a1a1a", padding: 14 }}>
                      {chapters.length > 0 && (
                        <View style={{ marginBottom: 14 }}>
                          <Text style={[w.listLbl, { marginTop: 0, marginBottom: 8 }]}>Chapters</Text>
                          {chapters.map((ch: any, i: number) => (
                            <View key={i} style={{ marginBottom: 10 }}>
                              <Text style={[w.listTitle, { color: "#fff", marginBottom: 2 }]}>{i + 1}. {ch.title}</Text>
                              {ch.summary && <Text style={w.cardDesc} numberOfLines={2}>{ch.summary}</Text>}
                              {(ch.keyPoints ?? []).slice(0, 2).map((kp: string, j: number) => (
                                <Text key={j} style={[w.cardDesc, { marginTop: 2 }]} numberOfLines={1}>· {kp}</Text>
                              ))}
                            </View>
                          ))}
                        </View>
                      )}
                      {flashcards.length > 0 && (
                        <View style={{ marginBottom: 14 }}>
                          <Text style={[w.listLbl, { marginTop: 0, marginBottom: 8 }]}>Flashcards · {flashcards.length}</Text>
                          {flashcards.slice(0, 3).map((fc: any, i: number) => (
                            <View key={i} style={{ backgroundColor: "#0a0a0a", borderRadius: 10, padding: 10, marginBottom: 6 }}>
                              <Text style={[w.listTitle, { color: "#fff", marginBottom: 4 }]}>{fc.front}</Text>
                              <Text style={w.cardDesc}>{fc.back}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                      {glossary.length > 0 && (
                        <View style={{ marginBottom: 8 }}>
                          <Text style={[w.listLbl, { marginTop: 0, marginBottom: 8 }]}>Glossary · {glossary.length} terms</Text>
                          {glossary.map((g: any, i: number) => (
                            <Text key={i} style={[w.cardDesc, { marginBottom: 4 }]}>
                              <Text style={{ color: "#fff" }}>{g.term}</Text>{" — "}{g.definition}
                            </Text>
                          ))}
                        </View>
                      )}
                      {examQ.length > 0 && (
                        <View>
                          <Text style={[w.listLbl, { marginTop: 0, marginBottom: 8 }]}>Practice Questions · {examQ.length}</Text>
                          {examQ.map((q: any, i: number) => (
                            <View key={i} style={{ backgroundColor: "#0a0a0a", borderRadius: 10, padding: 10, marginBottom: 6 }}>
                              <Text style={[w.listTitle, { color: "#fff", marginBottom: 4 }]}>{q.question}</Text>
                              <Text style={w.cardDesc}>Answer: {q.answer}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </>
      )}

      {/* ── TAKE NOTE — list ── */}
      {tab === "note" && noteView === "list" && (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text style={[w.listLbl, { marginTop: 0 }]}>Your Notes</Text>
            <TouchableOpacity
              onPress={() => { setNewNoteName(""); setNoteView("create"); }}
              style={{ backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 6 }}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={14} color="#000" />
              <Text style={{ fontSize: 11, fontWeight: "600", color: "#000" }}>New Note</Text>
            </TouchableOpacity>
          </View>
          {notes.length === 0 ? (
            <View style={w.doneCard}>
              <Ionicons name="create-outline" size={28} color="#333" style={{ marginBottom: 12 }} />
              <Text style={w.doneTitle}>No notes yet</Text>
              <Text style={w.doneSub}>Create your first note for {course.name}</Text>
              <TouchableOpacity onPress={() => { setNewNoteName(""); setNoteView("create"); }} style={w.againBtn}>
                <Text style={w.againTxt}>Create a note</Text>
              </TouchableOpacity>
            </View>
          ) : (
            notes.map(n => (
              <View key={n.id} style={[w.listRow, { marginBottom: 6 }]}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => { setActiveNote(n); setNoteSavedAt(null); setNoteView("edit"); }} activeOpacity={0.7}>
                  <Text style={[w.listTitle, { color: "#fff" }]}>{n.name}</Text>
                  <Text style={w.listSub}>
                    {new Date(n.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteNote(n.id)} activeOpacity={0.7}>
                  <Ionicons name="trash-outline" size={14} color="#333" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </>
      )}

      {/* ── TAKE NOTE — create ── */}
      {tab === "note" && noteView === "create" && (
        <View>
          <TouchableOpacity onPress={() => setNoteView("list")} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 24 }} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={14} color="#555" />
            <Text style={[w.cardDesc, { color: "#555" }]}>Back</Text>
          </TouchableOpacity>
          <Text style={[w.courseName, { marginBottom: 4 }]}>New Note</Text>
          <Text style={[w.cardDesc, { marginBottom: 20 }]}>Give your note a name to get started.</Text>
          <Text style={[w.listLbl, { marginTop: 0, marginBottom: 6 }]}>Note name</Text>
          <TextInput
            style={[w.titleInput, { marginBottom: 12 }]}
            value={newNoteName}
            onChangeText={setNewNoteName}
            placeholder="e.g. Chapter 3 — Derivatives, Lecture 5…"
            placeholderTextColor="#333"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={createNote}
          />
          <TouchableOpacity
            style={[w.primaryBtn, !newNoteName.trim() && { opacity: 0.4 }]}
            onPress={createNote}
            disabled={!newNoteName.trim()}
            activeOpacity={0.8}
          >
            <Text style={w.primaryBtnTxt}>Create Note</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── TAKE NOTE — edit ── */}
      {tab === "note" && noteView === "edit" && activeNote && (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <TouchableOpacity onPress={() => setNoteView("list")} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={16} color="#555" />
            </TouchableOpacity>
            <Text style={[w.listTitle, { color: "#fff", flex: 1 }]} numberOfLines={1}>{activeNote.name}</Text>
            {noteSavedAt && <Text style={[w.listSub, { color: "#2a2a2a" }]}>Saved {noteSavedAt}</Text>}
            <TouchableOpacity
              onPress={() => Alert.alert("Delete note", `Delete "${activeNote.name}"?`, [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => deleteNote(activeNote.id) },
              ])}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={15} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={{ backgroundColor: "#111", borderRadius: 16, borderWidth: 0.5, borderColor: "#1e1e1e", padding: 12, marginBottom: 8 }}>
            <Text style={[w.listLbl, { marginTop: 0, marginBottom: 8 }]}>Math Symbols</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {MATH_SYMBOLS.map(sym => (
                  <TouchableOpacity
                    key={sym}
                    onPress={() => insertSymbol(sym)}
                    style={{ backgroundColor: "#0a0a0a", borderRadius: 8, borderWidth: 0.5, borderColor: "#1e1e1e", paddingHorizontal: 10, paddingVertical: 6 }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: "#888", fontSize: 14, fontFamily: "monospace" }}>{sym}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <TextInput
            ref={noteInputRef}
            style={[w.titleInput, { height: 260, textAlignVertical: "top", paddingTop: 14, fontFamily: "monospace" }]}
            value={activeNote.text}
            onChangeText={handleNoteChange}
            onSelectionChange={e => { noteCursorRef.current = e.nativeEvent.selection.end; }}
            placeholder="Start writing…"
            placeholderTextColor="#333"
            multiline
          />

          <TouchableOpacity
            onPress={() => {
              setNotes(prev => prev.map(n => n.id === activeNote.id ? activeNote : n));
              setNoteSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
            }}
            style={[w.primaryBtn, { marginTop: 4 }]}
            activeOpacity={0.8}
          >
            <Text style={w.primaryBtnTxt}>Save</Text>
          </TouchableOpacity>
        </>
      )}

      {/* ── STUDY PLAN ── */}
      {tab === "plan" && (
        <>
          {sessions.length === 0 ? (
            <View style={w.doneCard}>
              <Ionicons name="calendar-outline" size={28} color="#333" style={{ marginBottom: 12 }} />
              <Text style={w.doneSub}>No upcoming sessions for {course.name}.</Text>
              <Text style={[w.doneSub, { marginTop: 4, fontSize: 10, color: "#333" }]}>
                Record a lecture — AI will auto-schedule spaced reviews.
              </Text>
            </View>
          ) : (
            sessions.map((s: any) => (
              <View key={s.id} style={w.sessionRow}>
                <View style={w.sessionDate}>
                  <Text style={w.sessionMon}>{new Date(s.scheduledAt).toLocaleString("default", { month: "short" })}</Text>
                  <Text style={w.sessionDay}>{new Date(s.scheduledAt).getDate()}</Text>
                </View>
                <View style={w.sessionDivider} />
                <View style={{ flex: 1 }}>
                  <Text style={w.sessionTitle} numberOfLines={1}>{s.lecture?.title}</Text>
                  <Text style={w.sessionSub}>{s.type} review</Text>
                </View>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

// ─── Entry point ──────────────────────────────────────────────────────────────
export default function WorkspaceScreen() {
  const insets = useSafeAreaInsets();
  const [activeCourse, setActiveCourse] = useState<any | null>(null);

  return (
    <>
      <StatusBar barStyle="light-content" />
      {activeCourse
        ? <ClassWorkspace insets={insets} course={activeCourse} onBack={() => setActiveCourse(null)} />
        : <ClassGate insets={insets} onSelect={setActiveCourse} />
      }
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const g = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  content: { paddingHorizontal: 16, paddingBottom: 110 },
  title: { fontSize: 32, color: "#fff", fontStyle: "italic", fontWeight: "300", marginBottom: 4 },
  sub: { fontSize: 12, color: "#444", marginBottom: 24 },
  sectionLbl: { fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: 2, fontWeight: "600", marginBottom: 10 },
  classCard: { backgroundColor: "#111", borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: "#1e1e1e", marginBottom: 8 },
  className: { fontSize: 14, color: "#fff", fontWeight: "500", marginBottom: 2 },
  classCode: { fontSize: 10, color: "#444" },
  createRow: { flexDirection: "row", gap: 10 },
  input: { flex: 1, backgroundColor: "#111", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: "#fff", borderWidth: 0.5, borderColor: "#1e1e1e" },
  createBtn: { width: 46, height: 46, borderRadius: 14, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
});

const w = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#111", borderWidth: 0.5, borderColor: "#1e1e1e", alignItems: "center", justifyContent: "center" },
  courseName: { fontSize: 22, color: "#fff", fontStyle: "italic", fontWeight: "300" },
  courseCode: { fontSize: 10, color: "#444", marginTop: 1 },
  tabScroll: { marginBottom: 20 },
  tabRow: { flexDirection: "row", gap: 6, backgroundColor: "#111", borderRadius: 20, padding: 4, borderWidth: 0.5, borderColor: "#1e1e1e" },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  tabActive: { backgroundColor: "#fff" },
  tabLabel: { fontSize: 12, color: "#555", fontWeight: "500" },
  tabLabelActive: { color: "#000" },
  titleInput: { backgroundColor: "#111", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: "#fff", borderWidth: 0.5, borderColor: "#1e1e1e", marginBottom: 10 },
  recCard: { backgroundColor: "#111", borderRadius: 28, padding: 28, alignItems: "center", borderWidth: 0.5, borderColor: "#1e1e1e", marginBottom: 10 },
  timer: { fontSize: 52, color: "#fff", fontWeight: "200", letterSpacing: -2, marginBottom: 10 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  liveText: { fontSize: 11, color: "#888" },
  btn: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  btnStart: { backgroundColor: "#1a1a1a", borderWidth: 0.5, borderColor: "#333" },
  btnStop: { backgroundColor: "#fff" },
  hint: { fontSize: 11, color: "#333" },
  attachRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#111", borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: "#1e1e1e", marginBottom: 10 },
  attachTxt: { fontSize: 12, color: "#555" },
  card: { backgroundColor: "#111", borderRadius: 20, padding: 16, borderWidth: 0.5, borderColor: "#1e1e1e", marginBottom: 10 },
  cardDesc: { fontSize: 12, color: "#555", lineHeight: 18 },
  primaryBtn: { backgroundColor: "#fff", borderRadius: 16, padding: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", marginBottom: 16 },
  primaryBtnTxt: { fontSize: 13, color: "#000", fontWeight: "600" },
  doneCard: { backgroundColor: "#111", borderRadius: 24, padding: 28, alignItems: "center", borderWidth: 0.5, borderColor: "#1e1e1e", marginBottom: 16 },
  doneIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  doneTitle: { fontSize: 14, color: "#fff", fontWeight: "600", marginBottom: 12, textAlign: "center" },
  doneSub: { fontSize: 12, color: "#555", textAlign: "center", lineHeight: 18 },
  againBtn: { marginTop: 16, borderWidth: 0.5, borderColor: "#333", borderRadius: 999, paddingHorizontal: 18, paddingVertical: 7 },
  againTxt: { fontSize: 12, color: "#888" },
  progressSteps: { flexDirection: "row", gap: 12, marginBottom: 8, alignItems: "center" },
  progressStep: { alignItems: "center", gap: 4 },
  stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#222" },
  stepDotDone: { backgroundColor: "#555" },
  stepDotActive: { backgroundColor: "#fff" },
  stepTxt: { fontSize: 9, color: "#333", textTransform: "capitalize" },
  listLbl: { fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: 2, fontWeight: "600", marginBottom: 8, marginTop: 16 },
  listRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#111", borderRadius: 14, padding: 12, borderWidth: 0.5, borderColor: "#1e1e1e", marginBottom: 6 },
  listRowSelected: { borderColor: "#fff" },
  listTitle: { fontSize: 13, color: "#888", flex: 1 },
  listSub: { fontSize: 10, color: "#333", marginTop: 2 },
  sessionRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#111", borderRadius: 18, padding: 14, borderWidth: 0.5, borderColor: "#1e1e1e", marginBottom: 8 },
  sessionDate: { alignItems: "center", width: 36 },
  sessionMon: { fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: 0.5 },
  sessionDay: { fontSize: 22, color: "#fff", fontWeight: "200" },
  sessionDivider: { width: 0.5, height: 32, backgroundColor: "#1e1e1e" },
  sessionTitle: { fontSize: 12, color: "#fff", fontWeight: "500" },
  sessionSub: { fontSize: 10, color: "#555", marginTop: 2, textTransform: "capitalize" },
});
