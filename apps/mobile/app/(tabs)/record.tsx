import { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  StatusBar, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, AppState,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, usePathname } from "expo-router";
import { recordingSession, useRecordingSession } from "../../lib/recordingSession";
import {
  useAudioRecorder, useAudioRecorderState, useAudioPlayer, useAudioPlayerStatus,
  requestRecordingPermissionsAsync, setAudioModeAsync,
  IOSOutputFormat, AudioQuality, type RecordingOptions,
} from "expo-audio";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Notifications from "expo-notifications";
import { useApi, makeApiFetcher } from "../../lib/api";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import useSWR from "swr";
import { LectureResults } from "../../components/LectureResults";
import { ClassPhotos } from "../../components/ClassPhotos";
import { ProcessingCard } from "../../components/ProcessingCard";
import { LectureAudioBar } from "../../components/LectureAudioBar";
import { TypingDots } from "../../components/TypingDots";
import { MathText, hasMathDelimiters } from "../../components/MathText";
import { useLiveTranscription } from "../../lib/useLiveTranscription";
import { toMathNotation, SCIENCE_STRUCTURES, SCIENCE_SYMBOLS, type LiveEntry, type MathTemplate } from "@sano/shared";
import * as ImagePicker from "expo-image-picker";
import { Image } from "react-native";
import { useTr } from "../../lib/useTr";

const KEEP_AWAKE_TAG = "flux-recording";
// Photos per recording — taken while recording or attached afterwards (the API enforces the same).
const MAX_LECTURE_PHOTOS = 5;

/**
 * The live transcript: runs of plain sentences flow together as native text, and
 * each sentence with typeset maths gets its own MathText block. Math blocks only
 * render once their typeset version arrives and never change after, so the
 * WebView behind them isn't reloaded as new words stream in.
 */
function LiveTranscriptView({ entries, partial }: { entries: LiveEntry[]; partial: string }) {
  const blocks: { kind: "text" | "math"; key: string; text: string }[] = [];
  for (const entry of entries) {
    const last = blocks[blocks.length - 1];
    if (entry.math) blocks.push({ kind: "math", key: entry.key, text: entry.text });
    else if (last?.kind === "text") last.text += ` ${entry.text}`;
    else blocks.push({ kind: "text", key: entry.key, text: entry.text });
  }
  const partialText = partial ? toMathNotation(partial) : "";
  const endsInText = blocks[blocks.length - 1]?.kind === "text";
  return (
    <View>
      {blocks.map((block, i) =>
        block.kind === "math" ? (
          <MathText key={block.key} text={block.text} style={w.liveTxt} />
        ) : (
          <Text key={block.key} style={w.liveTxt}>
            {block.text}
            {i === blocks.length - 1 && partialText ? <Text style={w.livePartial}> {partialText}</Text> : null}
          </Text>
        )
      )}
      {partialText && !endsInText ? <Text style={[w.liveTxt, w.livePartial]}>{partialText}</Text> : null}
    </View>
  );
}

/**
 * Keeps the recording going when the student switches apps or locks the phone.
 * Background recording needs the "audio" background mode on iOS and a
 * foreground service (with its notification) on Android; builds get both from
 * the expo-audio config plugin. Where that isn't available — Expo Go on Android,
 * or notifications denied — expo-audio throws, so recording falls back to
 * foreground-only instead of failing to start.
 */
async function startLectureRecorder(recorder: ReturnType<typeof useAudioRecorder>): Promise<boolean> {
  try {
    if (Platform.OS === "android") {
      // The foreground service shows a notification, which Android 13+ must allow.
      const { granted } = await Notifications.requestPermissionsAsync();
      if (!granted) throw new Error("notifications denied");
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, allowsBackgroundRecording: true, shouldPlayInBackground: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    return true;
  } catch {
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, allowsBackgroundRecording: false, shouldPlayInBackground: false });
    await recorder.prepareToRecordAsync();
    recorder.record();
    return false;
  }
}

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
  const tr = useTr();
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
      Alert.alert(tr("Error"), e?.message ?? tr("Could not create class"));
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
        { text: tr("Cancel"), style: "cancel" },
        {
          text: tr("Delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/api/courses/${c.id}`);
              await mutate();
            } catch (e: any) {
              Alert.alert(tr("Couldn't delete"), e?.response?.data?.error ?? e?.message ?? tr("Try again."));
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
          <Text style={g.title}>{tr("Workspace")}</Text>
          <Text style={g.sub}>{tr("Select or create a class to get started")}</Text>
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
            {courses.length ? tr("New class") : tr("Create your first class")}
          </Text>
          <TextInput
            style={g.input}
            value={name}
            onChangeText={setName}
            placeholder={tr("e.g. Calculus II, Biology 101…")}
            placeholderTextColor="rgba(15,17,21,0.35)"
            returnKeyType="done"
            onSubmitEditing={create}
          />

          <Text style={[g.sectionLbl, { marginTop: 16 }]}>{tr("Colour")}</Text>
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
              : <Text style={g.createBtnTxt}>{tr("Create class")}</Text>}
          </TouchableOpacity>
        </View>
      )}

      {courses.length > 0 && (
        <>
          <Text style={g.sectionLbl}>{tr("Your classes")}</Text>
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
function ClassWorkspace({ insets, course, onBack, hidden = false }: { insets: any; course: any; onBack: () => void; hidden?: boolean }) {
  const tr = useTr();
  const api = useApi();
  const { getToken } = useAuth();
  const fetcher = makeApiFetcher(getToken);
  const [tab, setTab] = useState<"record" | "photo" | "note" | "ask">("record");

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
      Alert.alert(tr("Failed"), e?.response?.data?.error ?? e?.message ?? tr("Could not refresh memory"));
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

  const askAbortRef = useRef<AbortController | null>(null);

  async function sendAsk(text?: string) {
    const q = (text ?? askInput).trim();
    if (!q || askLoading) return;
    const next = [...askMessages, { role: "user" as const, content: q }];
    setAskMessages(next);
    setAskInput("");
    setAskLoading(true);
    const controller = new AbortController();
    askAbortRef.current = controller;
    try {
      const res = await api.post("/api/ask", {
        courseId: course.id,
        messages: next.map(m => ({ role: m.role, content: m.content })),
      }, { signal: controller.signal });
      setAskMessages([...next, { role: "assistant", content: res.data?.data?.reply ?? "", citations: res.data?.data?.citations ?? [] }]);
    } catch (e: any) {
      // Stopping is deliberate, so it shouldn't read as an error in the chat.
      if (e?.code !== "ERR_CANCELED") {
        setAskMessages([...next, { role: "assistant", content: e?.response?.data?.error ?? tr("Something went wrong — try again.") }]);
      }
    } finally {
      askAbortRef.current = null;
      setAskLoading(false);
    }
  }

  // ── record ──
  const audioRecorder = useAudioRecorder(LECTURE_RECORDING);
  // The native recorder counts recorded time itself, including while the app is
  // in the background where JS timers stop — so the clock is read from it.
  const recorderState = useAudioRecorderState(audioRecorder, 500);
  const live = useLiveTranscription();
  const { data: usageData } = useSWR("/api/usage", fetcher);
  const maxRecSeconds = (usageData?.data?.maxRecordingMinutes ?? 180) * 60;
  const limitHitRef = useRef(false);
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
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [openRecordedAt, setOpenRecordedAt] = useState<string | null>(null);
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
        if (status === "error") setProcessingError(res.data?.data?.errorMessage ?? null);
        if (status === "ready" || status === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
          if (status === "ready") {
            await mutateLectures();
            if (recordAction === "transcribe") {
              try {
                const lecRes = await api.get(`/api/lectures/${processingLectureId}`);
                setLectureTranscript(lecRes.data?.data?.transcript ?? tr("Transcript not available."));
              } catch { setLectureTranscript(tr("Could not load transcript.")); }
            } else {
              const sheetRes = await api.get(`/api/cheatsheets?lectureId=${processingLectureId}`);
              const sheets = (sheetRes.data?.data ?? []).filter((s: any) => !s.title?.startsWith("Study Book:"));
              if (sheets.length) {
                setLectureSheet(sheets[0]);
                sheetCacheRef.current.set(processingLectureId, sheets[0]);
              }
              setResultsReady(true);
            }
          }
        }
      } catch {}
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [processingLectureId, recordAction]);

  useEffect(() => {
    if (isSessionActive) setSeconds(Math.floor((recorderState.durationMillis ?? 0) / 1000));
  }, [recorderState.durationMillis, isSessionActive]);

  // ── Share this class's recording with the rest of the app (floating bar) ──
  const pathname = usePathname();
  const ownsSession = isSessionActive || !!savedUri;
  useEffect(() => {
    if (ownsSession) {
      recordingSession.set({
        course: { id: course.id, name: course.name, color: course.color },
        status: isSessionActive ? (paused ? "paused" : "recording") : "saved",
        seconds,
        onScreen: !hidden && tab === "record" && pathname === "/record",
      });
    } else if (recordingSession.get()?.course.id === course.id) {
      recordingSession.set(null);
    }
  }, [ownsSession, isSessionActive, paused, seconds, hidden, tab, pathname, course.id, course.name, course.color]);
  useEffect(() => {
    if (ownsSession) recordingSession.setControls({ pause: pauseRecording, resume: resumeRecording });
  });
  useEffect(() => recordingSession.onOpen(id => { if (id === course.id) setTab("record"); }), [course.id]);
  useEffect(() => () => {
    if (recordingSession.get()?.course.id === course.id) recordingSession.set(null);
  }, [course.id]);

  // Back in the foreground mid-lecture: pick up anything the OS paused (a call,
  // or foreground-only recording) and reconnect the live transcript.
  const sessionRef = useRef({ active: false, paused: false });
  sessionRef.current = { active: isSessionActive, paused };
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      const { active, paused: isPaused } = sessionRef.current;
      if (state !== "active" || !active || isPaused) return;
      try {
        if (!audioRecorder.getStatus().isRecording) audioRecorder.record();
      } catch { /* recorder already released */ }
      live.resume().catch(() => {});
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch out of recording mode once there's a take to review/play back.
  useEffect(() => {
    if (savedUri) {
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, allowsBackgroundRecording: false, shouldPlayInBackground: false }).catch(() => {});
    }
  }, [savedUri]);

  async function startRecording() {
    const other = recordingSession.get();
    if (other && other.course.id !== course.id) {
      Alert.alert(
        other.status === "saved" ? `Unprocessed recording in ${other.course.name}` : `Recording in ${other.course.name}`,
        tr("One recording at a time — finish or delete that one before starting here."),
        [{ text: tr("Cancel"), style: "cancel" }, { text: tr("Open it"), onPress: () => recordingSession.requestOpen(other.course.id) }],
      );
      return;
    }
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) { Alert.alert("Microphone denied", tr("Enable mic in Settings.")); return; }
      autoTitleRef.current = autoTitle();
      await startLectureRecorder(audioRecorder);
      activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
      limitHitRef.current = false;
      live.start(0).catch(() => { /* recording still works without live text */ });
      setIsSessionActive(true);
      setSeconds(0);
    } catch { Alert.alert(tr("Error"), tr("Could not start recording.")); }
  }

  function pauseRecording() {
    if (!isSessionActive || paused) return;
    audioRecorder.pause();
    live.stop();
    setPaused(true);
  }

  function resumeRecording() {
    if (!isSessionActive || !paused || seconds >= maxRecSeconds) return;
    audioRecorder.record();
    live.start(seconds).catch(() => {});
    setPaused(false);
  }

  async function stopRecording(): Promise<string | null> {
    if (!isSessionActive) return null;
    deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    setPaused(false);
    live.stop();
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      setIsSessionActive(false);
      if (!uri) { Alert.alert(tr("Recording failed"), tr("Could not read the audio file.")); return null; }
      setSavedUri(uri);
      return uri;
    } catch {
      Alert.alert(tr("Error"), tr("Could not stop recording."));
      setIsSessionActive(false);
      return null;
    }
  }

  // Stop pauses first and asks, so a mis-tap can't end a lecture early.
  function requestStop(atLimit = false) {
    pauseRecording();
    const limitLabel = maxRecSeconds >= 3600 ? `${maxRecSeconds / 3600}-hour` : `${Math.round(maxRecSeconds / 60)}-minute`;
    const process = {
      text: tr("Process"),
      onPress: async () => {
        const uri = await stopRecording();
        // Give the live stream a moment to deliver its last words, then wait for any
        // sentence still being typeset so the saved transcript matches what was shown.
        await new Promise(r => setTimeout(r, 1200));
        await live.flush();
        if (uri) await processAudio("summarize", uri);
      },
    };
    const remove = { text: tr("Delete"), style: "destructive" as const, onPress: () => confirmDelete(atLimit) };
    Alert.alert(
      atLimit ? tr("Recording limit reached") : tr("Recording paused"),
      atLimit
        ? `This recording hit the ${limitLabel} limit on your plan. Process it now, or delete it.`
        : `${fmt(seconds)} recorded${images.length ? ` · ${images.length} photo${images.length === 1 ? "" : "s"}` : ""}. What would you like to do?`,
      atLimit
        ? [remove, process]
        : [remove, { text: tr("Resume"), style: "cancel", onPress: resumeRecording }, process],
      atLimit ? { cancelable: false } : { cancelable: true, onDismiss: resumeRecording }
    );
  }

  // Stop on its own when a recording reaches the plan's length limit.
  useEffect(() => {
    if (!isSessionActive || paused || limitHitRef.current) return;
    if (seconds >= maxRecSeconds) {
      limitHitRef.current = true;
      requestStop(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, isSessionActive, paused, maxRecSeconds]);

  function confirmDelete(atLimit = false) {
    Alert.alert(tr("Delete this recording?"), "It can't be recovered.", [
      { text: "Keep it", style: "cancel", onPress: () => requestStop(atLimit) },
      {
        text: tr("Delete"),
        style: "destructive",
        onPress: async () => {
          deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
          live.stop();
          try { await audioRecorder.stop(); } catch { /* already stopped */ }
          setIsSessionActive(false);
          resetRecorder();
        },
      },
    ]);
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
  const autoTitleRef = useRef("");
  function autoTitle() {
    const now = new Date();
    const day = now.toLocaleDateString(undefined, { day: "numeric", month: "short" });
    const time = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${course.name} — ${day}, ${time}`;
  }
  // Pinned when recording starts, so the name carries the time the lecture began.
  function lectureTitle() {
    return recTitle.trim() || autoTitleRef.current || autoTitle();
  }

  async function addPhoto(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(fromCamera ? tr("Camera denied") : tr("Photos denied"), tr("Enable access in Settings to add board photos."));
      return;
    }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, allowsMultipleSelection: true, selectionLimit: MAX_LECTURE_PHOTOS });
    if (res.canceled) return;
    setImages(prev => [...prev, ...res.assets.map(a => a.uri)].slice(0, MAX_LECTURE_PHOTOS));
  }

  async function processAudio(action: "transcribe" | "summarize", uriArg?: string) {
    // A freshly stopped take is passed in directly — state set a moment ago isn't readable yet.
    const audioUri = uriArg ?? savedUri;
    if (!audioUri) return;
    setRecordAction(action);
    if (playerStatus.playing) player.pause();
    setProcessingError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("audio", { uri: audioUri, name: "lecture.m4a", type: "audio/m4a" } as any);
      fd.append("courseId", course.id);
      images.forEach((uri, i) => {
        const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
        fd.append("images", { uri, name: `photo-${i + 1}.${ext}`, type: ext === "png" ? "image/png" : "image/jpeg" } as any);
      });
      fd.append("title", lectureTitle());
      fd.append("durationSeconds", String(seconds));
      const liveText = live.getTranscript();
      if (liveText) {
        fd.append("liveTranscript", liveText);
        fd.append("liveSegments", JSON.stringify(live.getSegments()));
      }
      const res = await api.post("/api/lectures", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setProcessingLectureId(res.data?.data?.id ?? null);
      setProcessingStatus("processing");
      setLectureSheet(null);
      setLectureTranscript(null);
      setSavedUri(null);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.response?.data?.error ?? e?.message ?? tr("Unknown error");
      Alert.alert(tr("Upload failed"), msg);
    } finally {
      setUploading(false);
    }
  }

  // Tapping a past recording opens its results straight away — the summary is
  // fetched behind the screen (and remembered, so reopening is instant) instead
  // of showing the processing card while it loads.
  const sheetCacheRef = useRef<Map<string, any>>(new Map());
  const [openTitle, setOpenTitle] = useState("");
  const openLectureIdRef = useRef<string | null>(null);
  openLectureIdRef.current = processingLectureId;

  async function openPastLecture(l: any) {
    setRecordAction(null);
    setLectureTranscript(null);
    setOpenTitle(l.title ?? "");
    setOpenRecordedAt(l.recordedAt ?? null);
    setProcessingLectureId(l.id);
    setProcessingStatus(l.status ?? "ready");
    if (l.status !== "ready") { setLectureSheet(null); setResultsReady(false); return; }
    setLectureSheet(sheetCacheRef.current.get(l.id) ?? null);
    setResultsReady(true);
    let sheet: any;
    try {
      const sheetRes = await api.get(`/api/cheatsheets?lectureId=${l.id}`);
      const sheets = (sheetRes.data?.data ?? []).filter((x: any) => !x.title?.startsWith("Study Book:"));
      sheet = sheets[0] ?? { title: l.title, content: {} };
      sheetCacheRef.current.set(l.id, sheet);
    } catch {
      sheet = sheetCacheRef.current.get(l.id) ?? { title: l.title, content: {} };
    }
    // Only if the student is still looking at this lecture.
    if (openLectureIdRef.current === l.id) setLectureSheet(sheet);
  }

  // ── Recordings: archive (the list's delete), restore, delete forever ──
  const { data: archivedData, mutate: mutateArchived } = useSWR(`/api/lectures?courseId=${course.id}&archived=true`, fetcher);
  const archivedLectures: any[] = archivedData?.data ?? [];
  const isYoutubeUrl = (u?: string | null) => !!u && /youtube\.com|youtu\.be/.test(u);
  const audioLectures = lectures.filter((l: any) => l.audioUrl && !isYoutubeUrl(l.audioUrl));

  function archiveLecture(l: any) {
    Alert.alert(`Delete "${l.title}"?`, "It moves to Archived below, where you can restore it.", [
      { text: tr("Cancel"), style: "cancel" },
      {
        text: tr("Delete"),
        style: "destructive",
        onPress: async () => {
          try { await api.patch(`/api/lectures/${l.id}/archive`); } catch { Alert.alert(tr("Couldn't delete that recording"), tr("Try again.")); }
          mutateLectures();
          mutateArchived();
        },
      },
    ]);
  }

  async function restoreLecture(id: string) {
    try { await api.patch(`/api/lectures/${id}/restore`); } catch { Alert.alert(tr("Couldn't restore that recording"), tr("Try again.")); }
    mutateLectures();
    mutateArchived();
  }

  function deleteForever(l: any) {
    Alert.alert(`Permanently delete "${l.title}"?`, tr("The recording, its transcript and everything generated from it are removed for good."), [
      { text: tr("Cancel"), style: "cancel" },
      {
        text: tr("Delete forever"),
        style: "destructive",
        onPress: async () => {
          try { await api.delete(`/api/lectures/${l.id}`); } catch { Alert.alert(tr("Couldn't delete that recording"), tr("Try again.")); }
          mutateArchived();
        },
      },
    ]);
  }

  // ── Attach photos to a finished recording → reprocess it ──
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const photoCount = (l: any) => (Array.isArray(l?.imageUrls) ? l.imageUrls.length : 0);

  function startAttach(l: any) {
    if (isSessionActive || savedUri) {
      Alert.alert(tr("Finish the current recording first"), tr("Process or discard it, then attach photos."));
      return;
    }
    const room = MAX_LECTURE_PHOTOS - photoCount(l);
    if (room <= 0) {
      Alert.alert(tr("No room for more photos"), `This recording already has ${MAX_LECTURE_PHOTOS} photos.`);
      return;
    }
    Alert.alert(
      tr("Attach photos"),
      `Add up to ${room} more photo${room === 1 ? "" : "s"}. They're processed together with the audio as one lecture — the summary, key points, flashcards and quiz are rebuilt to include them.`,
      [
        { text: tr("Take photo"), onPress: () => attachPhotos(l, true, room) },
        { text: tr("Choose photos"), onPress: () => attachPhotos(l, false, room) },
        { text: tr("Cancel"), style: "cancel" },
      ],
    );
  }

  async function attachPhotos(l: any, fromCamera: boolean, room: number) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(fromCamera ? tr("Camera denied") : tr("Photos denied"), tr("Enable access in Settings to attach photos."));
      return;
    }
    // quality < 1 has the picker re-encode as JPEG, which the reader accepts (HEIC isn't).
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, allowsMultipleSelection: true, selectionLimit: room });
    if (res.canceled || !res.assets.length) return;
    const uris = res.assets.slice(0, room).map(a => a.uri);
    setAttachingId(l.id);
    try {
      const fd = new FormData();
      uris.forEach((uri, i) => {
        const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
        fd.append("images", { uri, name: `photo-${i + 1}.${ext === "png" ? "png" : "jpg"}`, type: ext === "png" ? "image/png" : "image/jpeg" } as any);
      });
      await api.post(`/api/lectures/${l.id}/photos`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      // Watch it rebuild on the processing screen; results open when it's done.
      sheetCacheRef.current.delete(l.id);
      setRecordAction(null);
      setOpenTitle(l.title ?? "");
      setOpenRecordedAt(l.recordedAt ?? null);
      setLectureSheet(null);
      setResultsReady(false);
      setProcessingError(null);
      setProcessingStatus("processing");
      setProcessingLectureId(l.id);
      mutateLectures();
    } catch (e: any) {
      const status = e?.response?.status;
      Alert.alert(
        tr("Couldn't attach photos"),
        status === 429 ? tr("You've hit this month's plan limit. Upgrade in Billing to keep going.")
          : e?.response?.data?.error ?? tr("Try again in a moment."),
      );
    } finally {
      setAttachingId(null);
    }
  }

  /** Back from an opened (or processing) lecture to the recordings list. */
  function closeOpenLecture() {
    setProcessingLectureId(null);
    setProcessingStatus("processing");
    setProcessingError(null);
    setLectureSheet(null);
    setResultsReady(false);
    setLectureTranscript(null);
    mutateLectures();
  }

  function resetRecorder() {
    setProcessingError(null);
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

  // ── notes — saved to the server and shared with the web app ──
  type NoteEntry = { id: string; name: string; text: string; updatedAt: string };
  const { data: notesData, mutate: mutateNotes } = useSWR(`/api/notes?courseId=${course.id}`, fetcher);
  const notes: NoteEntry[] = notesData?.data ?? [];
  const [noteView, setNoteView] = useState<"list" | "create" | "edit">("list");
  const [activeNote, setActiveNote] = useState<NoteEntry | null>(null);
  const [newNoteName, setNewNoteName] = useState("");
  const [noteSavedAt, setNoteSavedAt] = useState<string | null>(null);
  const noteSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteInputRef = useRef<any>(null);
  const noteCursorRef = useRef(0);
  const [creatingNote, setCreatingNote] = useState(false);

  /** Web notes are rich text; the phone edits them as plain text with $…$ maths. */
  function noteToPlain(text: string) {
    if (!text.trimStart().startsWith("<")) return text;
    return text
      .replace(/<span[^>]*data-type="block-math"[^>]*data-latex="([^"]*)"[^>]*>(?:[\s\S]*?<\/span>)?/g, (_m, tex) => `\n$$${tex}$$\n`)
      .replace(/<span[^>]*data-type="inline-math"[^>]*data-latex="([^"]*)"[^>]*>(?:[\s\S]*?<\/span>)?/g, (_m, tex) => `$${tex}$`)
      .replace(/<li[^>]*>/g, "• ")
      .replace(/<br\s*\/?>|<\/(p|h[1-6]|li|blockquote|pre)>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function openNote(n: NoteEntry) {
    setActiveNote({ ...n, text: noteToPlain(n.text) });
    setNoteSavedAt(null);
    setNoteSuggestion(null);
    setNoteView("edit");
  }

  async function createNote() {
    if (!newNoteName.trim() || creatingNote) return;
    setCreatingNote(true);
    try {
      const res = await api.post("/api/notes", { courseId: course.id, name: newNoteName.trim() });
      const entry: NoteEntry = res.data?.data;
      await mutateNotes({ data: [entry, ...notes] }, { revalidate: false });
      setNewNoteName("");
      openNote(entry);
    } catch {
      Alert.alert(tr("Couldn't create the note"), tr("Check your connection and try again."));
    } finally {
      setCreatingNote(false);
    }
  }

  async function saveNote(note: NoteEntry) {
    try {
      await api.patch(`/api/notes/${note.id}`, { text: note.text });
      setNoteSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      mutateNotes({ data: notes.map(n => (n.id === note.id ? { ...n, text: note.text, updatedAt: new Date().toISOString() } : n)) }, { revalidate: false });
    } catch {
      setNoteSavedAt(null);
    }
  }

  function handleNoteChange(val: string) {
    if (!activeNote) return;
    const updated = { ...activeNote, text: val, updatedAt: new Date().toISOString() };
    setActiveNote(updated);
    setNoteSuggestion(null);
    // Autosave once typing settles.
    if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current);
    noteSaveTimer.current = setTimeout(() => saveNote(updated), 800);
  }

  async function deleteNote(id: string) {
    if (activeNote?.id === id) { setActiveNote(null); setNoteView("list"); }
    await mutateNotes({ data: notes.filter(n => n.id !== id) }, { revalidate: false });
    try { await api.delete(`/api/notes/${id}`); } catch { Alert.alert(tr("Couldn't delete the note"), tr("Try again.")); mutateNotes(); }
  }

  // ── note suggestions: after a pause at the end of the note, Ucorns suggests the rest ──
  const [noteSuggestion, setNoteSuggestion] = useState<{ text: string; forText: string } | null>(null);
  const suggestAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    const note = activeNote;
    suggestAbortRef.current?.abort();
    if (tab !== "note" || noteView !== "edit" || !note) return;
    const text = note.text;
    const timer = setTimeout(async () => {
      if (noteCursorRef.current < text.length || text.trim().length < 12 || /\n\s*$/.test(text)) return;
      const controller = new AbortController();
      suggestAbortRef.current = controller;
      try {
        const res = await api.post("/api/notes/complete",
          { courseId: course.id, noteId: note.id, before: text.slice(-1500) },
          { signal: controller.signal, timeout: 6000 });
        const completion: string = res.data?.data?.completion ?? "";
        if (completion && !controller.signal.aborted) setNoteSuggestion({ text: completion, forText: text });
      } catch { /* no suggestion this time */ }
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNote?.text, activeNote?.id, tab, noteView]);

  // ── math writer ──
  const [mathOpen, setMathOpen] = useState(false);
  const [mathDisplay, setMathDisplay] = useState(false);

  /** A palette tap writes the notation in at the cursor, keeping the keyboard up. */
  /**
   * Tapping a citation opens what it points at: the recording it came from, the
   * note, or the photo. Previously these chips were inert on the phone, so the
   * one feature the product is sold on did nothing here.
   */
  async function openCitation(c: any) {
    const id = String(c.sourceId ?? "").replace(/_photos$|_slides$/, "");
    if (c.sourceType === "note") {
      const note = notes.find((n: any) => n.id === id);
      if (!note) return Alert.alert(tr("Couldn't find this note."));
      setActiveNote({ ...note, text: noteToPlain(note.text) });
      setNoteView("edit");
      setTab("note");
      return;
    }
    if (c.sourceType === "photo") {
      setTab("photo");
      return;
    }
    // lecture / video / file all live on a recording.
    const lecture = (lectures ?? []).find((l: any) => l.id === id);
    if (!lecture) return Alert.alert(tr("Couldn't locate this video."));
    setTab("record");
    await openPastLecture(lecture);
  }

  function insertFromPalette(t: MathTemplate) {
    const latex = t.latex.trim();
    if (latex) insertMath({ latex, display: mathDisplay });
  }

  function insertMath({ latex, display }: { latex: string; display: boolean }) {
    if (!activeNote || !latex) return;
    const text = activeNote.text;
    const pos = Math.min(noteCursorRef.current, text.length);
    const before = text.slice(0, pos);
    const after = text.slice(pos);
    const piece = display
      ? `${before && !before.endsWith("\n") ? "\n" : ""}$$${latex}$$\n`
      : `${before && !/\s$/.test(before) ? " " : ""}$${latex}$${after && !/^\s/.test(after) ? " " : ""}`;
    noteCursorRef.current = pos + piece.length;
    handleNoteChange(before + piece + after);
  }

  function acceptSuggestion() {
    if (!activeNote || !noteSuggestion || noteSuggestion.forText !== activeNote.text) return;
    const next = activeNote.text + noteSuggestion.text;
    noteCursorRef.current = next.length;
    handleNoteChange(next);
  }


  // Recording is what a student comes to a class for; Ask is where they end up after.
  const TABS = [
    { key: "record",    icon: "mic-outline",           label: tr("Record")        },
    { key: "photo",     icon: "camera-outline",        label: tr("Add Photo")     },
    { key: "note",      icon: "create-outline",        label: tr("Take Note")     },
    { key: "ask",       icon: "sparkles-outline",      label: tr("Ask")           },
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
              <Text style={a.sparkTxt}>{tr("Ask your course")}</Text>
            </View>
            <TouchableOpacity onPress={rebuildAskMemory} disabled={askIndexing} style={a.refreshBtn} activeOpacity={0.7}>
              {askIndexing
                ? <ActivityIndicator size="small" color="rgba(15,17,21,0.55)" />
                : <Ionicons name="refresh" size={14} color="rgba(15,17,21,0.55)" />}
            </TouchableOpacity>
          </View>
          <Text style={a.memLine}>
            {askIndexing
              ? tr("Building your course memory…")
              : askStatus
                ? `In memory: ${askStatus.sources?.length ?? 0} source${(askStatus.sources?.length ?? 0) === 1 ? "" : "s"}`
                : tr("Loading memory…")}
          </Text>

          {/* Empty state + quick prompts */}
          {askMessages.length === 0 && (
            <View style={a.emptyBox}>
              <Ionicons name="sparkles-outline" size={26} color="#4B5FE8" style={{ marginBottom: 10 }} />
              <Text style={a.emptyTitle}>Ask anything about {course.name}</Text>
              <Text style={a.emptySub}>{tr("Answers come from your lectures and notes — with sources.")}</Text>
              <View style={a.promptWrap}>
                {[tr("What did the professor emphasize most?"), tr("Quiz me on this course"), tr("What should I review before the exam?")].map(p => (
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
              {/* A WebView has no intrinsic width, so a bubble holding math takes its max width. */}
              <View style={[a.bubble, m.role === "user" ? a.bubbleUser : a.bubbleAi, hasMathDelimiters(m.content) && a.bubbleWide]}>
                <MathText text={m.content} style={[a.bubbleTxt, m.role === "user" && { color: "#fff" }]} interactive />
              </View>
              {m.role === "assistant" && (m.citations?.length ?? 0) > 0 && (
                <View style={a.citeWrap}>
                  {m.citations!.map((c: any) => {
                    const openable = ["lecture", "video", "file", "note", "photo"].includes(c.sourceType);
                    return (
                      <TouchableOpacity
                        key={c.n}
                        style={[a.citeChip, !openable && { opacity: 0.6 }]}
                        onPress={() => openCitation(c)}
                        disabled={!openable}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={c.sourceType === "note" ? "create-outline" : c.sourceType === "photo" ? "image-outline" : "play"}
                          size={11}
                          color="#4B5FE8"
                        />
                        <Text style={a.citeIdx}>[{c.n}]</Text>
                        <Text style={a.citeTxt} numberOfLines={1}>{c.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
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
              placeholder={tr("Ask anything about this course…")}
              placeholderTextColor="rgba(15,17,21,0.35)"
              returnKeyType="send"
              onSubmitEditing={() => sendAsk()}
              editable={!askLoading}
            />
            {askLoading ? (
              <TouchableOpacity
                style={[a.sendBtn, { backgroundColor: "#0f1115" }]}
                onPress={() => askAbortRef.current?.abort()}
                activeOpacity={0.8}
                accessibilityLabel={tr("Stop")}
              >
                <Ionicons name="stop" size={16} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[a.sendBtn, { backgroundColor: course.color || "#4B5FE8" }, !askInput.trim() && { opacity: 0.4 }]}
                onPress={() => sendAsk()}
                disabled={!askInput.trim()}
                activeOpacity={0.8}
                accessibilityLabel={tr("Send")}
              >
                <Ionicons name="send" size={17} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      {/* ── RECORD ── */}
      {tab === "record" && (
        <>
          {/* Processing — the same screen as the web workspace */}
          {processingLectureId && !resultsReady && (
            <ProcessingCard
              status={processingStatus}
              color={course.color || "#4B5FE8"}
              errorMessage={processingError}
              onBack={closeOpenLecture}
            />
          )}

          {/* Everything generated from the recording */}
          {resultsReady && processingLectureId && (
            <>
            <View style={w.openHead}>
              <TouchableOpacity onPress={closeOpenLecture} style={w.backLink} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={18} color="rgba(15,17,21,0.8)" />
                <Text style={w.backLinkTxt}>{tr("Back to recordings")}</Text>
              </TouchableOpacity>
              {(() => {
                const l = lectures.find((x: any) => x.id === processingLectureId);
                if (!l) return null;
                const count = photoCount(l);
                const full = count >= MAX_LECTURE_PHOTOS;
                return (
                  <TouchableOpacity
                    onPress={() => startAttach(l)}
                    disabled={attachingId === l.id || full}
                    style={[w.attachBtn, { borderColor: `${course.color || "#4B5FE8"}66` }, full && { opacity: 0.5 }]}
                    activeOpacity={0.7}
                  >
                    {attachingId === l.id
                      ? <ActivityIndicator size="small" color={course.color || "#4B5FE8"} />
                      : <Ionicons name="image-outline" size={17} color={course.color || "#4B5FE8"} />}
                    <Text style={w.attachTxt}>Photos {count}/{MAX_LECTURE_PHOTOS}</Text>
                  </TouchableOpacity>
                );
              })()}
            </View>
            <LectureAudioBar api={api} lectureId={processingLectureId} recordedAt={openRecordedAt} color={course.color || "#4B5FE8"} />
            <LectureResults
              key={processingLectureId}
              api={api}
              lectureId={processingLectureId}
              title={lectureSheet?.title ?? openTitle}
              sheet={lectureSheet}
              color={course.color || "#4B5FE8"}
              onRecordAnother={closeOpenLecture}
            />
            </>
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
                placeholder={tr("Rename this lecture (optional)")}
                placeholderTextColor="rgba(15,17,21,0.55)"
                returnKeyType="done"
              />

              <TouchableOpacity style={w.listenBtn} onPress={playAudio} activeOpacity={0.8}>
                <Ionicons name={playerStatus.playing ? "pause-circle" : "play-circle"} size={22} color="#4B5FE8" />
                <Text style={w.listenTxt}>{playerStatus.playing ? tr("Pause") : tr("Listen to recording")}</Text>
              </TouchableOpacity>

              {/* Board photos ride along with the audio */}
              <View style={w.photoSection}>
                <View style={w.photoHead}>
                  <Text style={[w.listLbl, { marginTop: 0, marginBottom: 0 }]}>
                    Board photos{images.length ? ` (${images.length}/${MAX_LECTURE_PHOTOS})` : ""}
                  </Text>
                  <TouchableOpacity
                    disabled={images.length >= MAX_LECTURE_PHOTOS}
                    style={[w.photoAddBtn, images.length >= MAX_LECTURE_PHOTOS && { opacity: 0.4 }]}
                    activeOpacity={0.7}
                    onPress={() => Alert.alert(tr("Add photos"), tr("Capture the board or pick existing photos."), [
                      { text: tr("Take photo"), onPress: () => addPhoto(true) },
                      { text: tr("Choose photos"), onPress: () => addPhoto(false) },
                      { text: tr("Cancel"), style: "cancel" },
                    ])}
                  >
                    <Ionicons name="image-outline" size={17} color="rgba(15,17,21,0.85)" />
                    <Text style={w.photoAddTxt}>{tr("Add photos")}</Text>
                  </TouchableOpacity>
                </View>
                {images.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingTop: 6 }}>
                    {images.map((uri, i) => (
                      <TouchableOpacity key={uri + i} onPress={() => setImages(prev => prev.filter((_, j) => j !== i))} activeOpacity={0.8}>
                        <Image source={{ uri }} style={w.savedThumb} />
                        <View style={w.thumbX}><Ionicons name="close" size={12} color="#fff" /></View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={w.photoHint}>{tr("Photos of the whiteboard or slides are read alongside the audio.")}</Text>
                )}
              </View>

              {processingError ? <Text style={w.errorBox}>{processingError}</Text> : null}

              <TouchableOpacity
                style={[w.processBtn, { backgroundColor: course.color || "#4B5FE8" }, uploading && { opacity: 0.5 }]}
                onPress={() => processAudio("summarize")}
                disabled={uploading}
                activeOpacity={0.85}
              >
                {uploading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="sparkles" size={18} color="#fff" />}
                <Text style={w.processTxt}>{uploading ? tr("Sending it over…") : tr("Make my study material")}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={resetRecorder} style={{ alignSelf: "center", marginTop: 14 }}>
                <Text style={{ fontSize: 16, color: "rgba(15,17,21,0.75)" }}>{tr("Discard recording")}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Recorder */}
          {!processingLectureId && !savedUri && (
            <>
              {isSessionActive ? (
                <>
                  {/* While recording the transcript is the screen — no waveform,
                      no mic art, just the words and the controls under them. */}
                  <View style={w.liveCard}>
                    <View style={w.liveHead}>
                      <View style={[w.liveDot, { backgroundColor: live.connected && !paused ? "#DC2626" : "rgba(15,17,21,0.25)" }]} />
                      <Text style={w.liveLbl}>
                        {paused ? tr("Paused") : live.connected ? tr("Live transcript") : tr("Connecting…")}
                      </Text>
                      <Text style={w.liveTimer}>{fmt(seconds)}</Text>
                    </View>
                    <Text style={w.liveTitle} numberOfLines={1}>{lectureTitle()}</Text>

                    <ScrollView
                      style={w.liveScroll}
                      contentContainerStyle={{ paddingBottom: 4 }}
                      ref={liveScrollRef}
                      onContentSizeChange={() => liveScrollRef.current?.scrollToEnd({ animated: true })}
                      showsVerticalScrollIndicator={false}
                    >
                      {live.fullText ? (
                        <LiveTranscriptView entries={live.entries} partial={live.partial} />
                      ) : (
                        <Text style={w.liveHint}>{tr("Start speaking — words appear here as you go.")}</Text>
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
                        <Ionicons name={paused ? "play" : "pause"} size={21} color="#0f1115" />
                        <Text style={w.ctrlTxt}>{paused ? tr("Resume") : tr("Pause")}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={w.ctrlBtn}
                        onPress={() => Alert.alert(tr("Add photo"), tr("Capture the board or pick an existing photo."), [
                          { text: tr("Take photo"), onPress: () => addPhoto(true) },
                          { text: tr("Choose photo"), onPress: () => addPhoto(false) },
                          { text: tr("Cancel"), style: "cancel" },
                        ])}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="camera-outline" size={21} color="#0f1115" />
                        <Text style={w.ctrlTxt}>Photo{images.length ? ` (${images.length})` : ""}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={w.ctrlStop} onPress={() => requestStop()} activeOpacity={0.8}>
                        <Ionicons name="stop" size={21} color="#fff" />
                        <Text style={w.ctrlStopTxt}>{tr("Stop")}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
                <View style={w.recCard}>
                  <View style={{ alignSelf: "stretch" }}>
                    <Text style={[w.listLbl, { marginTop: 0 }]}>{tr("Lecture title (optional)")}</Text>
                    <TextInput
                      style={w.titleInput}
                      value={recTitle}
                      onChangeText={setRecTitle}
                      placeholder={autoTitle()}
                      placeholderTextColor="rgba(15,17,21,0.55)"
                      returnKeyType="done"
                    />
                    <Text style={w.nameHint}>Leave it blank and we&rsquo;ll name it &ldquo;{autoTitle()}&rdquo;.</Text>
                  </View>
                  <TouchableOpacity
                    style={[w.startBtn, { backgroundColor: course.color || "#4B5FE8", borderColor: course.color || "#4B5FE8" }]}
                    onPress={startRecording}
                    disabled={uploading}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="mic" size={30} color="#fff" />
                  </TouchableOpacity>
                  <Text style={w.hint}>{tr("Tap to start recording")}</Text>
                </View>
              )}

            </>
          )}

          {/* Past recordings stay out of the way while one is in progress —
              the live transcript gets the whole screen. */}
          {audioLectures.length > 0 && !savedUri && !isSessionActive && !resultsReady && (
            <>
              <Text style={w.listLbl}>{tr("Recordings")}</Text>
              {audioLectures.map((l: any) => {
                const ready = l.status === "ready";
                const tint = course.color || "#4B5FE8";
                return (
                  <View key={l.id} style={w.listRow}>
                    <TouchableOpacity style={w.listMain} onPress={() => openPastLecture(l)} activeOpacity={0.7}>
                      <View style={[w.listIcon, { backgroundColor: `${tint}1A` }]}>
                        <Ionicons name="mic" size={17} color={tint} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={w.listTitle} numberOfLines={2}>{l.title}</Text>
                        <Text style={w.listSub}>
                          {ready
                            ? `${new Date(l.recordedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · Tap to open`
                            : l.status === "error" ? tr("Processing failed") : tr("Still processing…")}
                        </Text>
                      </View>
                      {ready ? (
                        <Ionicons name="chevron-forward" size={19} color="rgba(15,17,21,0.6)" />
                      ) : l.status === "error" ? (
                        <Text style={[w.badge, { color: "#DC2626", backgroundColor: "rgba(220,38,38,0.08)" }]}>{tr("Failed")}</Text>
                      ) : (
                        <View style={[w.badgeRow, { backgroundColor: "rgba(0,0,0,0.06)" }]}>
                          <ActivityIndicator size="small" color="rgba(15,17,21,0.7)" style={{ transform: [{ scale: 0.6 }] }} />
                          <Text style={[w.badge, { paddingHorizontal: 0, color: "rgba(15,17,21,0.78)" }]}>{tr("Processing")}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    {ready && (
                      <TouchableOpacity
                        onPress={() => startAttach(l)}
                        disabled={attachingId === l.id || photoCount(l) >= MAX_LECTURE_PHOTOS}
                        style={[w.attachChip, photoCount(l) >= MAX_LECTURE_PHOTOS && { opacity: 0.45 }]}
                        hitSlop={6}
                        activeOpacity={0.6}
                      >
                        {attachingId === l.id
                          ? <ActivityIndicator size="small" color="rgba(15,17,21,0.7)" />
                          : <Ionicons name="image-outline" size={18} color="rgba(15,17,21,0.75)" />}
                        <Text style={w.attachChipTxt}>{photoCount(l)}/{MAX_LECTURE_PHOTOS}</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => archiveLecture(l)} style={w.trashBtn} hitSlop={8} activeOpacity={0.6}>
                      <Ionicons name="trash-outline" size={19} color="rgba(15,17,21,0.62)" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </>
          )}

          {archivedLectures.length > 0 && !savedUri && !isSessionActive && !resultsReady && (
            <>
              <Text style={w.listLbl}>{tr("Archived")}</Text>
              {archivedLectures.map((l: any) => (
                <View key={l.id} style={[w.listRow, { backgroundColor: "rgba(0,0,0,0.02)" }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[w.listTitle, { color: "rgba(15,17,21,0.8)" }]} numberOfLines={2}>{l.title}</Text>
                    <Text style={w.listSub}>{new Date(l.recordedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</Text>
                  </View>
                  <TouchableOpacity onPress={() => restoreLecture(l.id)} style={w.restoreBtn} activeOpacity={0.7}>
                    <Text style={w.restoreTxt}>{tr("Restore")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteForever(l)} style={w.trashBtn} hitSlop={8} activeOpacity={0.6}>
                    <Ionicons name="trash-outline" size={19} color="rgba(15,17,21,0.62)" />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </>
      )}

      {/* ── ADD PHOTO ── */}
      {tab === "photo" && (
        <ClassPhotos api={api} fetcher={fetcher} course={course} color={course.color || "#4B5FE8"} />
      )}

      {/* ── TAKE NOTE — list ── */}
      {tab === "note" && noteView === "list" && (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text style={[w.listLbl, { marginTop: 0 }]}>{tr("Your Notes")}</Text>
            <TouchableOpacity
              onPress={() => { setNewNoteName(""); setNoteView("create"); }}
              style={{ backgroundColor: course.color || "#4B5FE8", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 6 }}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={{ fontSize: 15.5, fontWeight: "700", color: "#fff" }}>{tr("New Note")}</Text>
            </TouchableOpacity>
          </View>
          {notes.length === 0 ? (
            <View style={w.doneCard}>
              <Ionicons name="create-outline" size={28} color="rgba(15,17,21,0.35)" style={{ marginBottom: 12 }} />
              <Text style={w.doneTitle}>{tr("No notes yet")}</Text>
              <Text style={w.doneSub}>Create your first note for {course.name}</Text>
              <TouchableOpacity onPress={() => { setNewNoteName(""); setNoteView("create"); }} style={w.againBtn}>
                <Text style={w.againTxt}>{tr("Create a note")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            notes.map(n => (
              <View key={n.id} style={[w.listRow, { marginBottom: 6 }]}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => openNote(n)} activeOpacity={0.7}>
                  <Text style={[w.listTitle, { color: "#0f1115" }]}>{n.name}</Text>
                  <Text style={w.listSub}>
                    {new Date(n.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => Alert.alert(tr("Delete note"), `Delete "${n.name}"?`, [
                    { text: tr("Cancel"), style: "cancel" },
                    { text: tr("Delete"), style: "destructive", onPress: () => deleteNote(n.id) },
                  ])}
                  hitSlop={8}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={18} color="rgba(15,17,21,0.55)" />
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
            <Ionicons name="arrow-back" size={20} color="#0f1115" />
            <Text style={{ fontSize: 17, color: "rgba(15,17,21,0.85)" }}>{tr("Back")}</Text>
          </TouchableOpacity>
          <Text style={[w.courseName, { marginBottom: 4 }]}>{tr("New Note")}</Text>
          <Text style={[w.cardDesc, { marginBottom: 20, fontSize: 17, lineHeight: 24, color: "rgba(15,17,21,0.82)" }]}>{tr("Give your note a name to get started.")}</Text>
          <Text style={[w.listLbl, { marginTop: 0, marginBottom: 6 }]}>{tr("Note name")}</Text>
          <TextInput
            style={[w.titleInput, { marginBottom: 12 }]}
            value={newNoteName}
            onChangeText={setNewNoteName}
            placeholder={tr("e.g. Chapter 3 — Derivatives, Lecture 5…")}
            placeholderTextColor="rgba(15,17,21,0.35)"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={createNote}
          />
          <TouchableOpacity
            style={[w.primaryBtn, (!newNoteName.trim() || creatingNote) && { opacity: 0.4 }]}
            onPress={createNote}
            disabled={!newNoteName.trim() || creatingNote}
            activeOpacity={0.8}
          >
            <Text style={w.primaryBtnTxt}>{tr("Create Note")}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── TAKE NOTE — edit ── */}
      {tab === "note" && noteView === "edit" && activeNote && (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <TouchableOpacity onPress={() => setNoteView("list")} activeOpacity={0.7} hitSlop={10} accessibilityLabel={tr("Back to notes")}>
              <Ionicons name="arrow-back" size={24} color="#0f1115" />
            </TouchableOpacity>
            <Text style={w.noteName} numberOfLines={1}>{activeNote.name}</Text>
            {noteSavedAt && <Text style={w.noteSaved}>Saved {noteSavedAt}</Text>}
            <TouchableOpacity
              onPress={() => Alert.alert(tr("Delete note"), `Delete "${activeNote.name}"?`, [
                { text: tr("Cancel"), style: "cancel" },
                { text: tr("Delete"), style: "destructive", onPress: () => deleteNote(activeNote.id) },
              ])}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={21} color="rgba(15,17,21,0.6)" />
            </TouchableOpacity>
          </View>

          <View style={w.noteTools}>
            <TouchableOpacity onPress={() => setMathOpen(o => !o)} style={[w.mathBtn, { backgroundColor: mathOpen ? "#0f1115" : (course.color || "#4B5FE8") }]} activeOpacity={0.85}>
              <Text style={w.mathBtnSigma}>∑</Text>
              <Text style={w.mathBtnTxt}>{tr("Formula")}</Text>
            </TouchableOpacity>
            <Text style={w.noteToolsHint}>{tr("Maths, chemistry, physics, dosage calculations and statistics — build it with the buttons.")}</Text>
          </View>

          {/* The palette sits in the note screen, not over it: a tap drops the
              notation straight in where you were typing. */}
          {mathOpen && (
            <View style={w.palette}>
              <View style={w.paletteHead}>
                <Text style={w.paletteLbl}>{tr("Tap to drop it into your note")}</Text>
                <View style={w.paletteSeg}>
                  {([[false, tr("In the sentence")], [true, tr("Own line")]] as const).map(([value, label]) => (
                    <TouchableOpacity key={label} onPress={() => setMathDisplay(value)}
                      style={[w.paletteSegBtn, mathDisplay === value && w.paletteSegOn]} activeOpacity={0.8}>
                      <Text style={[w.paletteSegTxt, mathDisplay === value && { color: "#0f1115" }]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <ScrollView style={{ maxHeight: 190 }} keyboardShouldPersistTaps="always" nestedScrollEnabled>
                <View style={w.paletteWrap}>
                  {SCIENCE_STRUCTURES.map(t => (
                    <TouchableOpacity key={t.latex} onPress={() => insertFromPalette(t)} style={w.paletteStruct} activeOpacity={0.7} accessibilityLabel={t.title}>
                      <Text style={w.paletteStructTxt}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={w.paletteWrap}>
                  {SCIENCE_SYMBOLS.map(t => (
                    <TouchableOpacity key={t.latex} onPress={() => insertFromPalette(t)} style={[w.paletteSym, { backgroundColor: `${course.color || "#4B5FE8"}14` }]} activeOpacity={0.7}>
                      <Text style={w.paletteSymTxt}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {noteSuggestion && activeNote && noteSuggestion.forText === activeNote.text && (
            <TouchableOpacity onPress={acceptSuggestion} style={[w.suggestBar, { borderColor: `${course.color || "#4B5FE8"}55` }]} activeOpacity={0.8}>
              <Ionicons name="sparkles" size={16} color={course.color || "#4B5FE8"} />
              <Text style={w.suggestTxt} numberOfLines={3}>
                <Text style={{ color: "rgba(15,17,21,0.55)" }}>…</Text>{noteSuggestion.text.trimStart()}
              </Text>
              <View style={[w.suggestInsert, { backgroundColor: course.color || "#4B5FE8" }]}>
                <Text style={w.suggestInsertTxt}>{tr("Insert")}</Text>
              </View>
              <TouchableOpacity onPress={() => setNoteSuggestion(null)} hitSlop={10}>
                <Ionicons name="close" size={18} color="rgba(15,17,21,0.55)" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}

          <TextInput
            ref={noteInputRef}
            style={[w.titleInput, w.noteInput]}
            value={activeNote.text}
            onChangeText={handleNoteChange}
            onSelectionChange={e => { noteCursorRef.current = e.nativeEvent.selection.end; }}
            placeholder={tr("Start writing… pause and Ucorns suggests the rest.")}
            placeholderTextColor="rgba(15,17,21,0.5)"
            multiline
          />

          {/\$/.test(activeNote.text) && (
            <View style={w.notePreview}>
              <Text style={[w.listLbl, { marginTop: 0, marginBottom: 8 }]}>{tr("Preview")}</Text>
              <MathText text={activeNote.text} style={w.notePreviewTxt} interactive />
            </View>
          )}


          <TouchableOpacity
            onPress={() => activeNote && saveNote(activeNote)}
            style={[w.primaryBtn, { marginTop: 4 }]}
            activeOpacity={0.8}
          >
            <Text style={w.primaryBtnTxt}>{tr("Save")}</Text>
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
  const session = useRecordingSession();
  // The class that owns a recording stays mounted — hidden — while the student
  // goes back to the class list or opens another class, so the lecture keeps recording.
  const [recordingCourse, setRecordingCourse] = useState<any | null>(null);
  useEffect(() => {
    if (session && activeCourse?.id === session.course.id) setRecordingCourse(activeCourse);
    if (!session) setRecordingCourse(null);
  }, [session?.course.id, activeCourse?.id]);

  // Opening a class from Home hands it over as params. Clear them once consumed so
  // going back lands on the class list, and so re-picking the same class still opens it.
  useEffect(() => {
    if (!params.courseId) return;
    setActiveCourse({ id: params.courseId, name: params.courseName ?? "", code: params.courseCode ?? "", color: params.courseColor || undefined });
    router.setParams({ courseId: "", courseName: "", courseCode: "", courseColor: "" });
  }, [params.courseId]);

  // The floating bar's "Open" brings the recording's class back.
  useEffect(() => recordingSession.onOpen(id => {
    if (recordingCourse?.id === id) setActiveCourse(recordingCourse);
  }), [recordingCourse]);

  const mounted = [recordingCourse, activeCourse]
    .filter(Boolean)
    .filter((c, i, all) => all.findIndex(x => x.id === c.id) === i);

  return (
    <>
      <StatusBar barStyle="dark-content" />
      {mounted.map(c => {
        const visible = c.id === activeCourse?.id;
        return (
          <View key={c.id} style={visible ? { flex: 1 } : { display: "none" }}>
            <ClassWorkspace insets={insets} course={c} hidden={!visible} onBack={() => setActiveCourse(null)} />
          </View>
        );
      })}
      {!activeCourse && <ClassGate insets={insets} onSelect={setActiveCourse} />}
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
  input: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 18, paddingHorizontal: 17, paddingVertical: 15, fontSize: 16.5, color: "#0f1115", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" },
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
  tabLabel: { fontSize: 15.5, color: "rgba(15,17,21,0.72)", fontWeight: "600" },
  tabLabelActive: { color: "#fff" },
  titleInput: { backgroundColor: "#FFFFFF", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 15, fontSize: 18, color: "#0f1115", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", marginBottom: 10 },
  recCard: { backgroundColor: "#FFFFFF", borderRadius: 28, padding: 28, alignItems: "center", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", marginBottom: 10 },
  timer: { fontSize: 60, color: "#0f1115", fontWeight: "300", letterSpacing: -2, marginBottom: 10 },
  liveCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 15, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", marginBottom: 10 },
  liveHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 9 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveLbl: { fontSize: 15, fontWeight: "700", color: "rgba(15,17,21,0.88)", textTransform: "uppercase", letterSpacing: 1 },
  liveTimer: { fontSize: 18, color: "#0f1115", fontWeight: "600", marginLeft: "auto", fontVariant: ["tabular-nums"] },
  liveScroll: { maxHeight: 460, minHeight: 260 },
  liveTxt: { fontSize: 19.5, color: "#0f1115", lineHeight: 30 },
  thumbRow: { marginTop: 12, maxHeight: 62 },
  thumb: { width: 54, height: 54, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.05)" },
  thumbX: { position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(15,17,21,0.75)", alignItems: "center", justifyContent: "center" },
  ctrlRow: { flexDirection: "row", gap: 8, marginTop: 14, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.06)", paddingTop: 14 },
  ctrlBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "#FFFFFF", borderRadius: 16, paddingVertical: 13, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)" },
  ctrlTxt: { fontSize: 17, color: "#0f1115", fontWeight: "600" },
  ctrlStop: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "#4B5FE8", borderRadius: 16, paddingVertical: 13 },
  ctrlStopTxt: { fontSize: 17, color: "#fff", fontWeight: "700" },
  livePartial: { color: "rgba(15,17,21,0.66)" },
  liveHint: { fontSize: 18, color: "rgba(15,17,21,0.75)", lineHeight: 26 },
  recBtnRow: { flexDirection: "row", gap: 10, width: "100%" },
  pauseBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FFFFFF", borderRadius: 18, paddingVertical: 14, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)" },
  pauseBtnTxt: { fontSize: 15, color: "#0f1115", fontWeight: "500" },
  stopBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#4B5FE8", borderRadius: 18, paddingVertical: 14 },
  stopBtnTxt: { fontSize: 15, color: "#fff", fontWeight: "600" },
  startBtn: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#4B5FE8", borderWidth: 1, borderColor: "#4B5FE8", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  savedDot: { width: 12, height: 12, borderRadius: 6 },
  savedTitle: { flex: 1, fontSize: 19, fontWeight: "700", color: "#0f1115", lineHeight: 25 },
  savedLen: { fontSize: 16, color: "rgba(15,17,21,0.78)", fontWeight: "600" },
  processBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 16, paddingVertical: 16, marginTop: 10 },
  processTxt: { fontSize: 18.5, color: "#fff", fontWeight: "700" },
  savedCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", marginBottom: 10 },
  listenBtn: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(75,95,232,0.1)", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(75,95,232,0.2)" },
  listenTxt: { fontSize: 18, color: "#4B5FE8", fontWeight: "600" },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "#FFFFFF", borderRadius: 14, paddingVertical: 13, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)" },
  actionBtnPrimary: { backgroundColor: "#4B5FE8", borderColor: "#4B5FE8" },
  actionBtnTxt: { fontSize: 16, color: "rgba(15,17,21,0.8)", fontWeight: "600" },
  hint: { fontSize: 18, color: "rgba(15,17,21,0.8)", marginTop: 10 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", marginBottom: 10 },
  cardDesc: { fontSize: 14, color: "rgba(15,17,21,0.7)", lineHeight: 21 },
  primaryBtn: { backgroundColor: "#4B5FE8", borderRadius: 16, padding: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", marginBottom: 16 },
  primaryBtnTxt: { fontSize: 15, color: "#fff", fontWeight: "600" },
  doneCard: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 28, alignItems: "center", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", marginBottom: 16 },
  doneIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#4B5FE8", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  doneTitle: { fontSize: 21, color: "#0f1115", fontWeight: "700", marginBottom: 12, textAlign: "center" },
  doneSub: { fontSize: 17, color: "rgba(15,17,21,0.85)", textAlign: "center", lineHeight: 24 },
  againBtn: { marginTop: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderRadius: 999, paddingHorizontal: 18, paddingVertical: 7 },
  againTxt: { fontSize: 17, color: "rgba(15,17,21,0.88)", fontWeight: "600" },
  progressSteps: { flexDirection: "row", gap: 12, marginBottom: 8, alignItems: "center" },
  progressStep: { alignItems: "center", gap: 4 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(0,0,0,0.2)" },
  stepDotDone: { backgroundColor: "rgba(15,17,21,0.35)" },
  stepDotActive: { backgroundColor: "#4B5FE8" },
  stepTxt: { fontSize: 14.5, color: "rgba(15,17,21,0.65)", textTransform: "capitalize" },
  listLbl: { fontSize: 15, color: "rgba(15,17,21,0.82)", textTransform: "uppercase", letterSpacing: 2, fontWeight: "700", marginBottom: 10, marginTop: 18 },
  listRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", marginBottom: 6 },
  listRowSelected: { borderColor: "#4B5FE8" },
  listTitle: { fontSize: 18, color: "#0f1115", fontWeight: "600" },
  listMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  listIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  badge: { fontSize: 13.5, fontWeight: "700", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, overflow: "hidden" },
  badgeRow: { flexDirection: "row", alignItems: "center", borderRadius: 999, paddingRight: 9 },
  trashBtn: { paddingLeft: 10, paddingVertical: 4 },
  restoreBtn: { borderWidth: 1, borderColor: "rgba(0,0,0,0.14)", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  restoreTxt: { fontSize: 15.5, fontWeight: "600", color: "rgba(15,17,21,0.88)" },
  noteName: { fontSize: 22, fontWeight: "800", color: "#0f1115", flex: 1 },
  noteSaved: { fontSize: 14, color: "rgba(15,17,21,0.6)" },
  noteTools: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  palette: { backgroundColor: "rgba(0,0,0,0.02)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.07)", padding: 10, marginBottom: 12 },
  paletteHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  paletteLbl: { flex: 1, fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", color: "rgba(15,17,21,0.5)" },
  paletteSeg: { flexDirection: "row", backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 999, padding: 2 },
  paletteSegBtn: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
  paletteSegOn: { backgroundColor: "#FFFFFF" },
  paletteSegTxt: { fontSize: 12.5, fontWeight: "700", color: "rgba(15,17,21,0.7)" },
  paletteWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  paletteStruct: { minWidth: 44, alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", paddingHorizontal: 10, paddingVertical: 8 },
  paletteStructTxt: { fontSize: 16, color: "#0f1115" },
  paletteSym: { minWidth: 38, alignItems: "center", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 7 },
  paletteSymTxt: { fontSize: 15.5, color: "#0f1115" },
  mathBtn: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  mathBtnSigma: { fontSize: 20, color: "#fff", fontWeight: "700", lineHeight: 22 },
  mathBtnTxt: { fontSize: 16, color: "#fff", fontWeight: "700" },
  noteToolsHint: { flex: 1, fontSize: 14, color: "rgba(15,17,21,0.7)", lineHeight: 19 },
  noteInput: { minHeight: 300, textAlignVertical: "top", paddingTop: 16, fontSize: 18, lineHeight: 27 },
  notePreview: { backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", padding: 14, marginBottom: 10 },
  notePreviewTxt: { fontSize: 17.5, color: "#0f1115", lineHeight: 27 },
  suggestBar: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  suggestTxt: { flex: 1, fontSize: 15.5, color: "#0f1115", lineHeight: 21 },
  suggestInsert: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  suggestInsertTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
  backLink: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingVertical: 4 },
  openHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10 },
  attachBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 },
  attachTxt: { fontSize: 15.5, fontWeight: "600", color: "#0f1115" },
  attachChip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 4, marginLeft: 6 },
  attachChipTxt: { fontSize: 13.5, fontWeight: "700", color: "rgba(15,17,21,0.75)" },
  backLinkTxt: { fontSize: 17, color: "rgba(15,17,21,0.82)", fontWeight: "500" },
  liveTitle: { fontSize: 15.5, color: "rgba(15,17,21,0.75)", marginBottom: 10 },
  nameHint: { fontSize: 15.5, color: "rgba(15,17,21,0.72)", lineHeight: 22, marginBottom: 22 },
  photoSection: { marginTop: 14 },
  photoHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  photoAddBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  photoAddTxt: { fontSize: 15.5, color: "rgba(15,17,21,0.88)", fontWeight: "600" },
  photoHint: { fontSize: 15.5, color: "rgba(15,17,21,0.72)", lineHeight: 22 },
  savedThumb: { width: 84, height: 84, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.05)" },
  errorBox: { marginTop: 14, fontSize: 16, color: "#DC2626", backgroundColor: "rgba(220,38,38,0.06)", borderWidth: 1, borderColor: "rgba(220,38,38,0.2)", borderRadius: 12, padding: 12, overflow: "hidden" },
  listSub: { fontSize: 15, color: "rgba(15,17,21,0.75)", marginTop: 4 },
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
  msgRow: { marginBottom: 16 },
  msgRight: { alignItems: "flex-end" },
  msgLeft: { alignItems: "flex-start" },
  bubble: { maxWidth: "88%", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 13 },
  bubbleUser: { backgroundColor: "#4B5FE8", borderBottomRightRadius: 6 },
  bubbleAi: { backgroundColor: "rgba(75,95,232,0.06)", borderWidth: 1, borderColor: "rgba(75,95,232,0.15)", borderBottomLeftRadius: 6 },
  bubbleWide: { width: "88%" },
  bubbleTxt: { color: "#0f1115", fontSize: 16.5, lineHeight: 25 },
  citeWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8, maxWidth: "90%" },
  citeChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(75,95,232,0.1)", borderColor: "rgba(75,95,232,0.2)", borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, maxWidth: 280 },
  citeIdx: { color: "#4B5FE8", fontSize: 11.5, fontWeight: "800" },
  citeTxt: { color: "#4B5FE8", fontSize: 13.5, flexShrink: 1 },
  inputRow: { flexDirection: "row", gap: 10, marginTop: 8, alignItems: "center" },
  input: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 18, paddingHorizontal: 17, paddingVertical: 15, fontSize: 16.5, color: "#0f1115", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" },
  sendBtn: { width: 46, height: 46, borderRadius: 14, backgroundColor: "#4B5FE8", alignItems: "center", justifyContent: "center" },
});
