import { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  StatusBar, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useAudioRecorder, useAudioPlayer, useAudioPlayerStatus,
  requestRecordingPermissionsAsync, setAudioModeAsync,
  IOSOutputFormat, AudioQuality, type RecordingOptions,
} from "expo-audio";
import { useApi, makeApiFetcher } from "../../lib/api";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import useSWR from "swr";
import { LectureResults } from "../../components/LectureResults";
import { TypingDots } from "../../components/TypingDots";
import { useLiveTranscription } from "../../lib/useLiveTranscription";
import { toMathNotation } from "@sano/shared";
import * as ImagePicker from "expo-image-picker";
import { Image } from "react-native";

const LECTURE_RECORDING: RecordingOptions = {
  extension: ".m4a",
  sampleRate: 22050,
  numberOfChannels: 1,
  bitRate: 32000,
  android: { outputFormat: "mpeg4", audioEncoder: "aac" },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: "audio/webm", bitsPerSecond: 32000 },
};

// ─── Class Gate ───────────────────────────────────────────────────────────────
const CLASS_COLORS = [
  "#4B5FE8", "#6E7FF3", "#3B82F6", "#0891B2", "#0D9488", "#16A34A",
  "#65A30D", "#D97706", "#EA580C", "#DC2626", "#E11D48", "#DB2777",
  "#9333EA", "#7C3AED", "#0F766E", "#475569", "#1F2937", "#B45309",
];

function ClassGate({ insets, onSelect }: { insets: any; onSelect: (c: any) => void }) {
  const api = useApi();
  const { getToken } = useAuth();
  const fetcher = makeApiFetcher(getToken);
  const { data, mutate } = useSWR("/api/courses", fetcher);
  const courses: any[] = data?.data ?? [];
  const [name, setName] = useState("");
  const [color, setColor] = useState(CLASS_COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const code = name.trim().slice(0, 6).toUpperCase().replace(/\s/g, "");
      const res = await api.post("/api/courses", { name: name.trim(), code, color });
      await mutate();
      setName("");
      setCreating(false);
      onSelect(res.data?.data);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not create class");
    } finally {
      setLoading(false);
    }
  }

  // Deleting a class cascades to its recordings and notes, so this asks twice
  // and spells out what goes with it.
  function confirmDelete(c: any) {
    Alert.alert(
      `Delete "${c.name}"?`,
      "This permanently deletes the class and everything in it — recordings, transcripts, summaries and notes. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/api/courses/${c.id}`);
              await mutate();
            } catch (e: any) {
              Alert.alert("Couldn't delete", e?.response?.data?.error ?? e?.message ?? "Try again.");
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={g.root} contentContainerStyle={[g.content, { paddingTop: insets.top + 16 }]}>
      <View style={g.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={g.title}>Workspace</Text>
          <Text style={g.sub}>Select or create a class to get started</Text>
        </View>
        <TouchableOpacity
          style={[g.newBtn, creating && { backgroundColor: "rgba(15,17,21,0.08)" }]}
          onPress={() => setCreating(v => !v)}
          activeOpacity={0.8}
        >
          <Ionicons name={creating ? "close" : "add"} size={22} color={creating ? "#0f1115" : "#fff"} />
        </TouchableOpacity>
      </View>

      {(creating || courses.length === 0) && (
        <View style={g.createCard}>
          <Text style={[g.sectionLbl, { marginTop: 0 }]}>
            {courses.length ? "New class" : "Create your first class"}
          </Text>
          <TextInput
            style={g.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Calculus II, Biology 101…"
            placeholderTextColor="rgba(15,17,21,0.35)"
            returnKeyType="done"
            onSubmitEditing={create}
          />

          <Text style={[g.sectionLbl, { marginTop: 16 }]}>Colour</Text>
          <View style={g.swatchRow}>
            {CLASS_COLORS.map(c => (
              <TouchableOpacity
                key={c}
                onPress={() => setColor(c)}
                style={[g.swatch, { backgroundColor: c }, color === c && g.swatchOn]}
                activeOpacity={0.8}
              >
                {color === c && <Ionicons name="checkmark" size={15} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[g.createBtn, { backgroundColor: color }, (!name.trim() || loading) && { opacity: 0.4 }]}
            onPress={create}
            disabled={!name.trim() || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={g.createBtnTxt}>Create class</Text>}
          </TouchableOpacity>
        </View>
      )}

      {courses.length > 0 && (
        <>
          <Text style={g.sectionLbl}>Your classes</Text>
          {courses.map((c) => {
            const tint = c.color || CLASS_COLORS[0];
            return (
              <TouchableOpacity
                key={c.id}
                style={[g.classCard, { borderLeftWidth: 5, borderLeftColor: tint }]}
                onPress={() => onSelect(c)}
                onLongPress={() => confirmDelete(c)}
                delayLongPress={450}
                activeOpacity={0.7}
              >
                <View style={[g.classBadge, { backgroundColor: tint }]}>
                  <Text style={g.classBadgeTxt}>{(c.name ?? "?").trim().charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={g.className}>{c.name}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => confirmDelete(c)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  activeOpacity={0.6}
                >
                  <Ionicons name="ellipsis-horizontal" size={18} color="rgba(15,17,21,0.3)" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

// ─── Class Workspace ──────────────────────────────────────────────────────────
function ClassWorkspace({ insets, course, onBack }: { insets: any; course: any; onBack: () => void }) {
  const api = useApi();
  const { getToken } = useAuth();
  const fetcher = makeApiFetcher(getToken);
  const [tab, setTab] = useState<"ask" | "record" | "note">("ask");

  const { data: lecturesData, mutate: mutateLectures } = useSWR(`/api/lectures?courseId=${course.id}`, fetcher);
  const lectures: any[] = lecturesData?.data ?? [];
  // ── ask your course (RAG chat over everything captured) ──
  const { data: askStatusData, mutate: mutateAskStatus } = useSWR(`/api/ask/status?courseId=${course.id}`, fetcher);
  const askStatus = askStatusData?.data;
  const [askMessages, setAskMessages] = useState<{ role: "user" | "assistant"; content: string; citations?: any[] }[]>([]);
  const [askInput, setAskInput] = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const [askIndexing, setAskIndexing] = useState(false);
  const askAutoIndexed = useRef(false);

  async function rebuildAskMemory() {
    setAskIndexing(true);
    try {
      await api.post("/api/ask/index", { courseId: course.id });
      await mutateAskStatus();
    } catch (e: any) {
      Alert.alert("Failed", e?.response?.data?.error ?? e?.message ?? "Could not refresh memory");
    } finally {
      setAskIndexing(false);
    }
  }

  // First visit with content but empty memory → build it automatically
  useEffect(() => {
    if (!askStatusData || askAutoIndexed.current) return;
    if ((askStatusData.data?.chunkCount ?? 0) > 0) return;
    if (lectures.length === 0) return;
    askAutoIndexed.current = true;
    rebuildAskMemory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askStatusData, lectures.length]);

  async function sendAsk(text?: string) {
    const q = (text ?? askInput).trim();
    if (!q || askLoading) return;
    const next = [...askMessages, { role: "user" as const, content: q }];
    setAskMessages(next);
    setAskInput("");
    setAskLoading(true);
    try {
      const res = await api.post("/api/ask", {
        courseId: course.id,
        messages: next.map(m => ({ role: m.role, content: m.content })),
      });
      setAskMessages([...next, { role: "assistant", content: res.data?.data?.reply ?? "", citations: res.data?.data?.citations ?? [] }]);
    } catch (e: any) {
      setAskMessages([...next, { role: "assistant", content: e?.response?.data?.error ?? "Something went wrong — try again." }]);
    } finally {
      setAskLoading(false);
    }
  }

  // ── record ──
  const audioRecorder = useAudioRecorder(LECTURE_RECORDING);
  const live = useLiveTranscription();
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [recTitle, setRecTitle] = useState("");
  const [savedUri, setSavedUri] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [recordAction, setRecordAction] = useState<"transcribe" | "summarize" | null>(null);
  const player = useAudioPlayer(savedUri);
  const playerStatus = useAudioPlayerStatus(player);
  const [processingLectureId, setProcessingLectureId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>("processing");
  const [lectureSheet, setLectureSheet] = useState<any | null>(null);
  const [resultsReady, setResultsReady] = useState(false);
  const [lectureTranscript, setLectureTranscript] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveScrollRef = useRef<ScrollView | null>(null);
  const [kbOpen, setKbOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKbOpen(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKbOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Poll lecture status until ready
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
            if (recordAction === "transcribe") {
              try {
                const lecRes = await api.get(`/api/lectures/${processingLectureId}`);
                setLectureTranscript(lecRes.data?.data?.transcript ?? "Transcript not available.");
              } catch { setLectureTranscript("Could not load transcript."); }
            } else {
              const sheetRes = await api.get(`/api/cheatsheets?lectureId=${processingLectureId}`);
              const sheets = (sheetRes.data?.data ?? []).filter((s: any) => !s.title?.startsWith("Study Book:"));
              if (sheets.length) setLectureSheet(sheets[0]);
              setResultsReady(true);
            }
          }
        }
      } catch {}
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [processingLectureId, recordAction]);

  // Switch out of recording mode once there's a take to review/play back.
  useEffect(() => {
    if (savedUri) {
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    }
  }, [savedUri]);

  async function startRecording() {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) { Alert.alert("Microphone denied", "Enable mic in Settings."); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      live.start().catch(() => { /* recording still works without live text */ });
      setIsSessionActive(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch { Alert.alert("Error", "Could not start recording."); }
  }

  function pauseRecording() {
    if (!isSessionActive || paused) return;
    audioRecorder.pause();
    live.stop();
    setPaused(true);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function resumeRecording() {
    if (!isSessionActive || !paused) return;
    audioRecorder.record();
    live.start().catch(() => {});
    setPaused(false);
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
  }

  async function stopRecording() {
    if (!isSessionActive) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setPaused(false);
    live.stop();
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      setIsSessionActive(false);
      if (!uri) { Alert.alert("Recording failed", "Could not read the audio file."); return; }
      setSavedUri(uri);
    } catch {
      Alert.alert("Error", "Could not stop recording.");
      setIsSessionActive(false);
    }
  }

  function playAudio() {
    if (!savedUri) return;
    if (playerStatus.playing) {
      player.pause();
      return;
    }
    if (playerStatus.didJustFinish || (playerStatus.duration > 0 && playerStatus.currentTime >= playerStatus.duration)) {
      player.seekTo(0);
    }
    player.play();
  }

  // "Biology 101 — 13 Sep, 2:15pm" beats "Untitled Lecture" in the list later.
  function lectureTitle() {
    if (recTitle.trim()) return recTitle.trim();
    const now = new Date();
    const day = now.toLocaleDateString(undefined, { day: "numeric", month: "short" });
    const time = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${course.name} — ${day}, ${time}`;
  }

  async function addPhoto(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(fromCamera ? "Camera denied" : "Photos denied", "Enable access in Settings to add board photos.");
      return;
    }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, allowsMultipleSelection: true, selectionLimit: 6 });
    if (res.canceled) return;
    setImages(prev => [...prev, ...res.assets.map(a => a.uri)].slice(0, 12));
  }

  async function processAudio(action: "transcribe" | "summarize") {
    if (!savedUri) return;
    setRecordAction(action);
    if (playerStatus.playing) player.pause();
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("audio", { uri: savedUri, name: "lecture.m4a", type: "audio/m4a" } as any);
      fd.append("courseId", course.id);
      images.forEach((uri, i) => {
        const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
        fd.append("images", { uri, name: `photo-${i + 1}.${ext}`, type: ext === "png" ? "image/png" : "image/jpeg" } as any);
      });
      fd.append("title", lectureTitle());
      const res = await api.post("/api/lectures", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setProcessingLectureId(res.data?.data?.id ?? null);
      setProcessingStatus("processing");
      setLectureSheet(null);
      setLectureTranscript(null);
      setSavedUri(null);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.response?.data?.error ?? e?.message ?? "Unknown error";
      Alert.alert("Upload failed", msg);
    } finally {
      setUploading(false);
    }
  }

  // Tapping a past recording reopens everything that was generated for it.
  async function openPastLecture(l: any) {
    setRecordAction(null);
    setLectureTranscript(null);
    setLectureSheet(null);
    setProcessingLectureId(l.id);
    setProcessingStatus(l.status ?? "ready");
    if (l.status !== "ready") { setResultsReady(false); return; }
    try {
      const sheetRes = await api.get(`/api/cheatsheets?lectureId=${l.id}`);
      const sheets = (sheetRes.data?.data ?? []).filter((x: any) => !x.title?.startsWith("Study Book:"));
      setLectureSheet(sheets[0] ?? { title: l.title, content: {} });
    } catch {
      setLectureSheet({ title: l.title, content: {} });
    }
    setResultsReady(true);
  }

  function resetRecorder() {
    setProcessingLectureId(null);
    setProcessingStatus("processing");
    setLectureSheet(null);
    setResultsReady(false);
    setLectureTranscript(null);
    setSeconds(0);
    setRecTitle("");
    setSavedUri(null);
    setImages([]);
    setRecordAction(null);
    setPaused(false);
    if (playerStatus.playing) player.pause();
  }

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

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

  const TABS = [
    { key: "ask",       icon: "sparkles-outline",      label: "Ask"           },
    { key: "record",    icon: "mic-outline",           label: "Record"        },
    { key: "note",      icon: "create-outline",        label: "Take Note"     },
  ] as const;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
    <ScrollView
      style={g.root}
      contentContainerStyle={[g.content, { paddingTop: insets.top + 16 }, kbOpen && { paddingBottom: 12 }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      {/* Header */}
      <View style={w.header}>
        <TouchableOpacity onPress={onBack} style={w.backBtn}>
          <Ionicons name="arrow-back" size={18} color="rgba(15,17,21,0.55)" />
        </TouchableOpacity>
        <View style={[w.courseBadge, { backgroundColor: course.color || "#4B5FE8" }]}>
          <Text style={w.courseBadgeTxt}>{(course.name ?? "?").trim().charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={w.courseName}>{course.name}</Text>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={w.tabScroll} contentContainerStyle={w.tabRow}>
        {TABS.map(({ key, icon, label }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setTab(key)}
            style={[w.tab, tab === key && { backgroundColor: course.color || "#4B5FE8" }]}
            activeOpacity={0.7}
          >
            <Ionicons name={icon as any} size={18} color={tab === key ? "#fff" : "rgba(15,17,21,0.55)"} />
            <Text style={[w.tabLabel, tab === key && w.tabLabelActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── ASK YOUR COURSE ── */}
      {tab === "ask" && (
        <>
          {/* Memory status header */}
          <View style={a.headRow}>
            <View style={a.sparkChip}>
              <Ionicons name="sparkles" size={12} color="#4B5FE8" />
              <Text style={a.sparkTxt}>Ask your course</Text>
            </View>
            <TouchableOpacity onPress={rebuildAskMemory} disabled={askIndexing} style={a.refreshBtn} activeOpacity={0.7}>
              {askIndexing
                ? <ActivityIndicator size="small" color="rgba(15,17,21,0.55)" />
                : <Ionicons name="refresh" size={14} color="rgba(15,17,21,0.55)" />}
            </TouchableOpacity>
          </View>
          <Text style={a.memLine}>
            {askIndexing
              ? "Building your course memory…"
              : askStatus
                ? `In memory: ${askStatus.sources?.length ?? 0} source${(askStatus.sources?.length ?? 0) === 1 ? "" : "s"} · ${askStatus.chunkCount ?? 0} chunks`
                : "Loading memory…"}
          </Text>

          {/* Empty state + quick prompts */}
          {askMessages.length === 0 && (
            <View style={a.emptyBox}>
              <Ionicons name="sparkles-outline" size={26} color="#4B5FE8" style={{ marginBottom: 10 }} />
              <Text style={a.emptyTitle}>Ask anything about {course.name}</Text>
              <Text style={a.emptySub}>Answers come from your lectures and notes — with sources.</Text>
              <View style={a.promptWrap}>
                {["What did the professor emphasize most?", "Quiz me on this course", "What should I review before the exam?"].map(p => (
                  <TouchableOpacity key={p} style={a.promptChip} onPress={() => sendAsk(p)} activeOpacity={0.7}>
                    <Text style={a.promptTxt}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Messages */}
          {askMessages.map((m, i) => (
            <View key={i} style={[a.msgRow, m.role === "user" ? a.msgRight : a.msgLeft]}>
              <View style={[a.bubble, m.role === "user" ? a.bubbleUser : a.bubbleAi]}>
                <Text style={[a.bubbleTxt, m.role === "user" && { color: "#fff" }]}>{m.content}</Text>
              </View>
              {m.role === "assistant" && (m.citations?.length ?? 0) > 0 && (
                <View style={a.citeWrap}>
                  {m.citations!.map((c: any) => (
                    <View key={c.n} style={a.citeChip}>
                      <Text style={a.citeIdx}>[{c.n}]</Text>
                      <Text style={a.citeTxt} numberOfLines={1}>{c.label}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
          {askLoading && (
            <View style={[a.msgRow, a.msgLeft]}>
              <View style={[a.bubble, a.bubbleAi]}>
                <TypingDots color={course.color || "#4B5FE8"} />
              </View>
            </View>
          )}

          {/* Input */}
          <View style={a.inputRow}>
            <TextInput
              style={a.input}
              value={askInput}
              onChangeText={setAskInput}
              placeholder="Ask anything about this course…"
              placeholderTextColor="rgba(15,17,21,0.35)"
              returnKeyType="send"
              onSubmitEditing={() => sendAsk()}
              editable={!askLoading}
            />
            <TouchableOpacity
              style={[a.sendBtn, (!askInput.trim() || askLoading) && { opacity: 0.4 }]}
              onPress={() => sendAsk()}
              disabled={!askInput.trim() || askLoading}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-up" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── RECORD ── */}
      {tab === "record" && (
        <>
          {/* Processing */}
          {processingLectureId && !resultsReady && !lectureTranscript && (
            <View style={w.doneCard}>
              {processingStatus === "error"
                ? <Ionicons name="alert-circle-outline" size={28} color="rgba(15,17,21,0.55)" style={{ marginBottom: 12 }} />
                : <ActivityIndicator size="small" color="rgba(15,17,21,0.55)" style={{ marginBottom: 14 }} />
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
                        <Text style={[w.stepTxt, i <= idx && { color: "rgba(15,17,21,0.55)" }]}>
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

          {/* Transcript view */}
          {lectureTranscript && (
            <View style={w.card}>
              <Text style={[w.listLbl, { marginTop: 0, marginBottom: 10 }]}>Transcript</Text>
              <ScrollView style={{ maxHeight: 300 }} nestedScrollEnabled>
                <Text style={[w.cardDesc, { color: "rgba(15,17,21,0.75)", lineHeight: 20 }]}>{lectureTranscript}</Text>
              </ScrollView>
              <View style={{ borderTopWidth: 0.5, borderTopColor: "rgba(0,0,0,0.08)", paddingTop: 12, marginTop: 12 }}>
                <TouchableOpacity onPress={resetRecorder} style={[w.againBtn, { marginTop: 0, alignSelf: "center" }]}>
                  <Text style={w.againTxt}>Record another</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Everything generated from the recording */}
          {resultsReady && processingLectureId && lectureSheet && (
            <LectureResults
              api={api}
              lectureId={processingLectureId}
              title={lectureSheet.title}
              sheet={lectureSheet}
              color={course.color || "#4B5FE8"}
              onRecordAnother={resetRecorder}
            />
          )}

          {/* Saved audio action card */}
          {savedUri && !processingLectureId && (
            <View style={w.savedCard}>
              <View style={s_savedHead}>
                <View style={[w.savedDot, { backgroundColor: course.color || "#4B5FE8" }]} />
                <Text style={w.savedTitle} numberOfLines={2}>{lectureTitle()}</Text>
                <Text style={w.savedLen}>{fmt(seconds)}</Text>
              </View>
              <TextInput
                style={[w.titleInput, { marginBottom: 12 }]}
                value={recTitle}
                onChangeText={setRecTitle}
                placeholder="Rename this lecture (optional)"
                placeholderTextColor="rgba(15,17,21,0.35)"
                returnKeyType="done"
              />

              <TouchableOpacity style={w.listenBtn} onPress={playAudio} activeOpacity={0.8}>
                <Ionicons name={playerStatus.playing ? "pause-circle" : "play-circle"} size={22} color="#4B5FE8" />
                <Text style={w.listenTxt}>{playerStatus.playing ? "Pause" : "Listen to recording"}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[w.processBtn, { backgroundColor: course.color || "#4B5FE8" }, uploading && { opacity: 0.5 }]}
                onPress={() => processAudio("summarize")}
                disabled={uploading}
                activeOpacity={0.85}
              >
                {uploading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="sparkles" size={18} color="#fff" />}
                <Text style={w.processTxt}>{uploading ? "Processing…" : "Process Lecture"}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={resetRecorder} style={{ alignSelf: "center", marginTop: 14 }}>
                <Text style={{ fontSize: 13.5, color: "rgba(15,17,21,0.55)" }}>Discard recording</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Recorder */}
          {!processingLectureId && !savedUri && (
            <>
              <TextInput
                style={w.titleInput}
                value={recTitle}
                onChangeText={setRecTitle}
                placeholder="Lecture title (optional)"
                placeholderTextColor="rgba(15,17,21,0.35)"
              />
              {isSessionActive ? (
                <>
                  {/* While recording the transcript is the screen — no waveform,
                      no mic art, just the words and the controls under them. */}
                  <View style={w.liveCard}>
                    <View style={w.liveHead}>
                      <View style={[w.liveDot, { backgroundColor: live.connected && !paused ? "#DC2626" : "rgba(15,17,21,0.25)" }]} />
                      <Text style={w.liveLbl}>
                        {paused ? "Paused" : live.connected ? "Live transcript" : "Connecting…"}
                      </Text>
                      <Text style={w.liveTimer}>{fmt(seconds)}</Text>
                    </View>

                    <ScrollView
                      style={w.liveScroll}
                      contentContainerStyle={{ paddingBottom: 4 }}
                      ref={liveScrollRef}
                      onContentSizeChange={() => liveScrollRef.current?.scrollToEnd({ animated: true })}
                      showsVerticalScrollIndicator={false}
                    >
                      {live.fullText ? (
                        <Text style={w.liveTxt}>
                          {toMathNotation(live.text)}
                          {live.partial ? <Text style={w.livePartial}>{live.text ? " " : ""}{toMathNotation(live.partial)}</Text> : null}
                        </Text>
                      ) : (
                        <Text style={w.liveHint}>Start speaking — words appear here as you go.</Text>
                      )}
                    </ScrollView>

                    {images.length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={w.thumbRow} contentContainerStyle={{ gap: 8 }}>
                        {images.map((uri, i) => (
                          <TouchableOpacity
                            key={uri + i}
                            onPress={() => setImages(prev => prev.filter((_, j) => j !== i))}
                            activeOpacity={0.8}
                          >
                            <Image source={{ uri }} style={w.thumb} />
                            <View style={w.thumbX}><Ionicons name="close" size={11} color="#fff" /></View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}

                    <View style={w.ctrlRow}>
                      <TouchableOpacity style={w.ctrlBtn} onPress={paused ? resumeRecording : pauseRecording} activeOpacity={0.8}>
                        <Ionicons name={paused ? "play" : "pause"} size={19} color="#0f1115" />
                        <Text style={w.ctrlTxt}>{paused ? "Resume" : "Pause"}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={w.ctrlBtn}
                        onPress={() => Alert.alert("Add photo", "Capture the board or pick an existing photo.", [
                          { text: "Take photo", onPress: () => addPhoto(true) },
                          { text: "Choose photo", onPress: () => addPhoto(false) },
                          { text: "Cancel", style: "cancel" },
                        ])}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="camera-outline" size={19} color="#0f1115" />
                        <Text style={w.ctrlTxt}>Photo{images.length ? ` (${images.length})` : ""}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={w.ctrlStop} onPress={stopRecording} activeOpacity={0.8}>
                        <Ionicons name="stop" size={19} color="#fff" />
                        <Text style={w.ctrlStopTxt}>Stop</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
                <View style={w.recCard}>
                  <Text style={w.timer}>{fmt(seconds)}</Text>
                  <Text style={[w.hint, { marginBottom: 20 }]}>Tap to start recording</Text>
                  <TouchableOpacity style={w.startBtn} onPress={startRecording} disabled={uploading} activeOpacity={0.8}>
                    <Ionicons name="mic" size={28} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}

            </>
          )}

          {/* Past recordings stay out of the way while one is in progress —
              the live transcript gets the whole screen. */}
          {lectures.length > 0 && !savedUri && !isSessionActive && (
            <>
              <Text style={w.listLbl}>Recordings</Text>
              {lectures.map((l) => (
                <TouchableOpacity
                  key={l.id}
                  style={w.listRow}
                  onPress={() => openPastLecture(l)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={w.listTitle}>{l.title}</Text>
                    <Text style={w.listSub}>{l.status === "ready" ? "Tap to open" : l.status}</Text>
                  </View>
                  <Ionicons
                    name={l.status === "ready" ? "chevron-forward" : "time-outline"}
                    size={16}
                    color="rgba(15,17,21,0.35)"
                  />
                </TouchableOpacity>
              ))}
            </>
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
              style={{ backgroundColor: "#4B5FE8", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 6 }}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={14} color="#fff" />
              <Text style={{ fontSize: 11, fontWeight: "600", color: "#fff" }}>New Note</Text>
            </TouchableOpacity>
          </View>
          {notes.length === 0 ? (
            <View style={w.doneCard}>
              <Ionicons name="create-outline" size={28} color="rgba(15,17,21,0.35)" style={{ marginBottom: 12 }} />
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
                  <Text style={[w.listTitle, { color: "#0f1115" }]}>{n.name}</Text>
                  <Text style={w.listSub}>
                    {new Date(n.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteNote(n.id)} activeOpacity={0.7}>
                  <Ionicons name="trash-outline" size={14} color="rgba(15,17,21,0.35)" />
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
            <Ionicons name="arrow-back" size={14} color="rgba(15,17,21,0.55)" />
            <Text style={[w.cardDesc, { color: "rgba(15,17,21,0.55)" }]}>Back</Text>
          </TouchableOpacity>
          <Text style={[w.courseName, { marginBottom: 4 }]}>New Note</Text>
          <Text style={[w.cardDesc, { marginBottom: 20 }]}>Give your note a name to get started.</Text>
          <Text style={[w.listLbl, { marginTop: 0, marginBottom: 6 }]}>Note name</Text>
          <TextInput
            style={[w.titleInput, { marginBottom: 12 }]}
            value={newNoteName}
            onChangeText={setNewNoteName}
            placeholder="e.g. Chapter 3 — Derivatives, Lecture 5…"
            placeholderTextColor="rgba(15,17,21,0.35)"
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
              <Ionicons name="arrow-back" size={16} color="rgba(15,17,21,0.55)" />
            </TouchableOpacity>
            <Text style={[w.listTitle, { color: "#0f1115", flex: 1 }]} numberOfLines={1}>{activeNote.name}</Text>
            {noteSavedAt && <Text style={[w.listSub, { color: "rgba(15,17,21,0.35)" }]}>Saved {noteSavedAt}</Text>}
            <TouchableOpacity
              onPress={() => Alert.alert("Delete note", `Delete "${activeNote.name}"?`, [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => deleteNote(activeNote.id) },
              ])}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={15} color="rgba(15,17,21,0.35)" />
            </TouchableOpacity>
          </View>

          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", padding: 12, marginBottom: 8 }}>
            <Text style={[w.listLbl, { marginTop: 0, marginBottom: 8 }]}>Math Symbols</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {MATH_SYMBOLS.map(sym => (
                  <TouchableOpacity
                    key={sym}
                    onPress={() => insertSymbol(sym)}
                    style={{ backgroundColor: "rgba(75,95,232,0.06)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(75,95,232,0.15)", paddingHorizontal: 10, paddingVertical: 6 }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: "#4B5FE8", fontSize: 14, fontFamily: "monospace" }}>{sym}</Text>
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
            placeholderTextColor="rgba(15,17,21,0.35)"
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

    </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Entry point ──────────────────────────────────────────────────────────────
export default function WorkspaceScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ courseId?: string; courseName?: string; courseCode?: string; courseColor?: string }>();
  const [activeCourse, setActiveCourse] = useState<any | null>(null);

  // Opening a class from Home hands it over as params. Clear them once consumed so
  // going back lands on the class list, and so re-picking the same class still opens it.
  useEffect(() => {
    if (!params.courseId) return;
    setActiveCourse({ id: params.courseId, name: params.courseName ?? "", code: params.courseCode ?? "", color: params.courseColor || undefined });
    router.setParams({ courseId: "", courseName: "", courseCode: "", courseColor: "" });
  }, [params.courseId]);

  return (
    <>
      <StatusBar barStyle="dark-content" />
      {activeCourse
        ? <ClassWorkspace insets={insets} course={activeCourse} onBack={() => setActiveCourse(null)} />
        : <ClassGate insets={insets} onSelect={setActiveCourse} />
      }
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s_savedHead = { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, marginBottom: 14 };

const g = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { paddingHorizontal: 16, paddingBottom: 132 },
  title: { fontSize: 32, color: "#0f1115", fontStyle: "italic", fontWeight: "300", marginBottom: 4 },
  sub: { fontSize: 14, color: "rgba(15,17,21,0.6)", marginBottom: 24 },
  sectionLbl: { fontSize: 11, color: "rgba(15,17,21,0.55)", textTransform: "uppercase", letterSpacing: 2, fontWeight: "600", marginBottom: 10 },
  headRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 20 },
  newBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#4B5FE8", alignItems: "center", justifyContent: "center" },
  createCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", marginBottom: 22 },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 4 },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  swatchOn: { borderWidth: 3, borderColor: "rgba(15,17,21,0.18)" },
  createBtnTxt: { fontSize: 15, color: "#fff", fontWeight: "600" },
  classCard: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", marginBottom: 8 },
  classBadge: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  classBadgeTxt: { color: "#fff", fontSize: 18, fontWeight: "800" },
  className: { fontSize: 16.5, color: "#0f1115", fontWeight: "600" },
  createRow: { flexDirection: "row", gap: 10 },
  input: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: "#0f1115", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" },
  createBtn: { borderRadius: 16, paddingVertical: 15, alignItems: "center", justifyContent: "center", marginTop: 18 },
});

const w = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", alignItems: "center", justifyContent: "center" },
  courseBadge: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  courseBadgeTxt: { color: "#fff", fontSize: 17, fontWeight: "800" },
  courseName: { fontSize: 26, color: "#0f1115", fontWeight: "700" },
  tabScroll: { marginBottom: 20 },
  tabRow: { flexDirection: "row", gap: 6, backgroundColor: "#FFFFFF", borderRadius: 24, padding: 5, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" },
  tab: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 19 },
  tabLabel: { fontSize: 14.5, color: "rgba(15,17,21,0.55)", fontWeight: "600" },
  tabLabelActive: { color: "#fff" },
  titleInput: { backgroundColor: "#FFFFFF", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: "#0f1115", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", marginBottom: 10 },
  recCard: { backgroundColor: "#FFFFFF", borderRadius: 28, padding: 28, alignItems: "center", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", marginBottom: 10 },
  timer: { fontSize: 52, color: "#0f1115", fontWeight: "200", letterSpacing: -2, marginBottom: 10 },
  liveCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 15, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", marginBottom: 10 },
  liveHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 9 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveLbl: { fontSize: 12.5, fontWeight: "700", color: "rgba(15,17,21,0.7)", textTransform: "uppercase", letterSpacing: 1 },
  liveTimer: { fontSize: 14.5, color: "rgba(15,17,21,0.7)", marginLeft: "auto", fontVariant: ["tabular-nums"] },
  liveScroll: { maxHeight: 460, minHeight: 260 },
  liveTxt: { fontSize: 17.5, color: "#0f1115", lineHeight: 27 },
  thumbRow: { marginTop: 12, maxHeight: 62 },
  thumb: { width: 54, height: 54, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.05)" },
  thumbX: { position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(15,17,21,0.75)", alignItems: "center", justifyContent: "center" },
  ctrlRow: { flexDirection: "row", gap: 8, marginTop: 14, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.06)", paddingTop: 14 },
  ctrlBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "#FFFFFF", borderRadius: 16, paddingVertical: 13, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)" },
  ctrlTxt: { fontSize: 15.5, color: "#0f1115", fontWeight: "600" },
  ctrlStop: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "#4B5FE8", borderRadius: 16, paddingVertical: 13 },
  ctrlStopTxt: { fontSize: 15.5, color: "#fff", fontWeight: "600" },
  livePartial: { color: "rgba(15,17,21,0.55)" },
  liveHint: { fontSize: 15.5, color: "rgba(15,17,21,0.55)", lineHeight: 23 },
  recBtnRow: { flexDirection: "row", gap: 10, width: "100%" },
  pauseBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FFFFFF", borderRadius: 18, paddingVertical: 14, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)" },
  pauseBtnTxt: { fontSize: 15, color: "#0f1115", fontWeight: "500" },
  stopBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#4B5FE8", borderRadius: 18, paddingVertical: 14 },
  stopBtnTxt: { fontSize: 15, color: "#fff", fontWeight: "600" },
  startBtn: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#4B5FE8", borderWidth: 1, borderColor: "#4B5FE8", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  savedDot: { width: 12, height: 12, borderRadius: 6 },
  savedTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: "#0f1115", lineHeight: 22 },
  savedLen: { fontSize: 13.5, color: "rgba(15,17,21,0.55)", fontWeight: "600" },
  processBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 16, paddingVertical: 16, marginTop: 10 },
  processTxt: { fontSize: 16.5, color: "#fff", fontWeight: "700" },
  savedCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", marginBottom: 10 },
  listenBtn: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(75,95,232,0.1)", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(75,95,232,0.2)" },
  listenTxt: { fontSize: 16, color: "#4B5FE8", fontWeight: "600" },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "#FFFFFF", borderRadius: 14, paddingVertical: 13, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)" },
  actionBtnPrimary: { backgroundColor: "#4B5FE8", borderColor: "#4B5FE8" },
  actionBtnTxt: { fontSize: 16, color: "rgba(15,17,21,0.8)", fontWeight: "600" },
  hint: { fontSize: 15, color: "rgba(15,17,21,0.6)" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", marginBottom: 10 },
  cardDesc: { fontSize: 14, color: "rgba(15,17,21,0.7)", lineHeight: 21 },
  primaryBtn: { backgroundColor: "#4B5FE8", borderRadius: 16, padding: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", marginBottom: 16 },
  primaryBtnTxt: { fontSize: 15, color: "#fff", fontWeight: "600" },
  doneCard: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 28, alignItems: "center", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", marginBottom: 16 },
  doneIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#4B5FE8", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  doneTitle: { fontSize: 18, color: "#0f1115", fontWeight: "700", marginBottom: 12, textAlign: "center" },
  doneSub: { fontSize: 15, color: "rgba(15,17,21,0.75)", textAlign: "center", lineHeight: 22 },
  againBtn: { marginTop: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderRadius: 999, paddingHorizontal: 18, paddingVertical: 7 },
  againTxt: { fontSize: 15, color: "rgba(15,17,21,0.7)" },
  progressSteps: { flexDirection: "row", gap: 12, marginBottom: 8, alignItems: "center" },
  progressStep: { alignItems: "center", gap: 4 },
  stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.12)" },
  stepDotDone: { backgroundColor: "rgba(15,17,21,0.35)" },
  stepDotActive: { backgroundColor: "#4B5FE8" },
  stepTxt: { fontSize: 12, color: "rgba(15,17,21,0.5)", textTransform: "capitalize" },
  listLbl: { fontSize: 12.5, color: "rgba(15,17,21,0.6)", textTransform: "uppercase", letterSpacing: 2, fontWeight: "600", marginBottom: 8, marginTop: 16 },
  listRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFFFF", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", marginBottom: 6 },
  listRowSelected: { borderColor: "#4B5FE8" },
  listTitle: { fontSize: 16, color: "rgba(15,17,21,0.9)", flex: 1 },
  listSub: { fontSize: 13, color: "rgba(15,17,21,0.55)", marginTop: 3 },
  sessionRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFFFF", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", marginBottom: 8 },
  sessionDate: { alignItems: "center", width: 40 },
  sessionMon: { fontSize: 11, color: "rgba(15,17,21,0.45)", textTransform: "uppercase", letterSpacing: 0.5 },
  sessionDay: { fontSize: 25, color: "#0f1115", fontWeight: "200" },
  sessionDivider: { width: 0.5, height: 32, backgroundColor: "rgba(0,0,0,0.08)" },
  sessionTitle: { fontSize: 14.5, color: "#0f1115", fontWeight: "500" },
  sessionSub: { fontSize: 12, color: "rgba(15,17,21,0.55)", marginTop: 2, textTransform: "capitalize" },
});

// ─── Ask tab styles ───────────────────────────────────────────────────────────
const a = StyleSheet.create({
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  sparkChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(75,95,232,0.1)", borderColor: "rgba(75,95,232,0.2)", borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  sparkTxt: { color: "#4B5FE8", fontSize: 14, fontWeight: "700" },
  refreshBtn: { padding: 8 },
  memLine: { fontSize: 13, color: "rgba(15,17,21,0.55)", marginBottom: 14 },
  emptyBox: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", paddingVertical: 28, paddingHorizontal: 18, marginBottom: 14 },
  emptyTitle: { color: "#0f1115", fontSize: 16.5, fontWeight: "600", marginBottom: 6, textAlign: "center" },
  emptySub: { color: "rgba(15,17,21,0.7)", fontSize: 13.5, textAlign: "center", lineHeight: 20, marginBottom: 16 },
  promptWrap: { gap: 8, width: "100%" },
  promptChip: { borderWidth: 1, borderColor: "rgba(75,95,232,0.15)", backgroundColor: "rgba(75,95,232,0.06)", borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14 },
  promptTxt: { color: "#4B5FE8", fontSize: 14, textAlign: "center" },
  msgRow: { marginBottom: 12 },
  msgRight: { alignItems: "flex-end" },
  msgLeft: { alignItems: "flex-start" },
  bubble: { maxWidth: "85%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: "#4B5FE8", borderBottomRightRadius: 5 },
  bubbleAi: { backgroundColor: "rgba(75,95,232,0.06)", borderWidth: 1, borderColor: "rgba(75,95,232,0.15)", borderBottomLeftRadius: 5 },
  bubbleTxt: { color: "#0f1115", fontSize: 15.5, lineHeight: 22 },
  citeWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8, maxWidth: "90%" },
  citeChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(75,95,232,0.1)", borderColor: "rgba(75,95,232,0.2)", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, maxWidth: 260 },
  citeIdx: { color: "#4B5FE8", fontSize: 11.5, fontWeight: "800" },
  citeTxt: { color: "#4B5FE8", fontSize: 12, flexShrink: 1 },
  inputRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  input: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: "#0f1115", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" },
  sendBtn: { width: 46, height: 46, borderRadius: 14, backgroundColor: "#4B5FE8", alignItems: "center", justifyContent: "center" },
});
