import { useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TypingDots } from "./TypingDots";
import { MathText, hasMathDelimiters } from "./MathText";

type View5 = "summary" | "transcript" | "points" | "cards" | "quiz" | "ask";

const VIEWS: { key: View5; icon: any; label: string }[] = [
  { key: "summary",    icon: "document-text-outline", label: "Summary" },
  { key: "transcript", icon: "reader-outline",        label: "Transcript" },
  { key: "points",     icon: "list-outline",          label: "Key Points" },
  { key: "quiz",       icon: "help-circle-outline",   label: "Quizzes" },
  { key: "cards",      icon: "albums-outline",        label: "Flashcards" },
  { key: "ask",        icon: "sparkles-outline",      label: "Ask" },
];

const CATEGORY_COLOR: Record<string, string> = {
  Definition: "#4B5FE8",
  Important: "#DC2626",
  Formula: "#9333EA",
  Example: "#16A34A",
  Warning: "#EA580C",
};

export function LectureResults({
  api, lectureId, title, sheet, color = "#4B5FE8", onRecordAnother,
}: {
  api: any;
  lectureId: string;
  title: string;
  sheet: any | null;
  color?: string;
  onRecordAnother: () => void;
}) {
  const [view, setView] = useState<View5>("summary");

  const [points, setPoints] = useState<any[] | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [cards, setCards] = useState<any[] | null>(null);
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const [quiz, setQuiz] = useState<any | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState<View5 | null>(null);

  async function load(target: View5) {
    setView(target);
    if (loading) return;
    try {
      if (target === "transcript" && transcript === null) {
        setLoading("transcript");
        const r = await api.get(`/api/lectures/${lectureId}`);
        setTranscript(r.data?.data?.transcript ?? "");
      }
      if (target === "points" && !points) {
        setLoading("points");
        const r = await api.post("/api/studybook/key-points", { lectureId });
        setPoints(r.data?.data?.points ?? []);
      }
      if (target === "cards" && !cards) {
        setLoading("cards");
        const r = await api.post("/api/studybook/flashcards", { lectureId });
        setCards(r.data?.data?.cards ?? []);
      }
      if (target === "quiz" && !quiz) {
        setLoading("quiz");
        // Processing already made a quiz for this lecture — reuse it rather than
        // paying to generate another one every time this tab is opened.
        const existing = await api.get(`/api/quizzes?lectureId=${lectureId}`);
        const first = (existing.data?.data ?? [])[0];
        const id = first?.id ?? (await api.post("/api/quizzes/generate", { lectureId })).data?.data?.id;
        const full = await api.get(`/api/quizzes/${id}`);
        setQuiz(full.data?.data ?? null);
      }
    } catch (e: any) {
      Alert.alert("Couldn't generate", e?.response?.data?.error ?? e?.message ?? "Try again in a moment.");
    } finally {
      setLoading(null);
    }
  }

  const chatAbortRef = useRef<AbortController | null>(null);

  async function send() {
    const q = input.trim();
    if (!q || loading === "ask") return;
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setInput("");
    setLoading("ask");
    const controller = new AbortController();
    chatAbortRef.current = controller;
    try {
      const r = await api.post("/api/studybook/chat", { lectureId, messages: next }, { signal: controller.signal });
      setMessages([...next, { role: "assistant", content: r.data?.data?.reply ?? "" }]);
    } catch (e: any) {
      if (e?.code !== "ERR_CANCELED") {
        setMessages([...next, { role: "assistant", content: e?.response?.data?.error ?? "Something went wrong — try again." }]);
      }
    } finally {
      chatAbortRef.current = null;
      setLoading(null);
    }
  }

  async function submitQuiz() {
    if (!quiz) return;
    const ordered = quiz.questions.map((_: any, i: number) => answers[i] ?? -1);
    try {
      const r = await api.post(`/api/quizzes/${quiz.id}/attempt`, { answers: ordered });
      setScore({ correct: r.data?.data?.correct ?? 0, total: r.data?.data?.total ?? quiz.questions.length });
    } catch {
      const correct = quiz.questions.filter((q: any, i: number) => q.correctIndex === answers[i]).length;
      setScore({ correct, total: quiz.questions.length });
    }
  }

  const content = sheet?.content ?? {};

  return (
    <View>
      <View style={s.headRow}>
        <View style={[s.headDot, { backgroundColor: color }]} />
        <Text style={s.lectureTitle} numberOfLines={2}>{title}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabScroll} contentContainerStyle={s.tabRow}>
        {VIEWS.map(v => (
          <TouchableOpacity
            key={v.key}
            onPress={() => load(v.key)}
            style={[s.tab, view === v.key && { backgroundColor: color }]}
            activeOpacity={0.7}
          >
            <Ionicons name={v.icon} size={16} color={view === v.key ? "#fff" : "rgba(15,17,21,0.55)"} />
            <Text style={[s.tabLabel, view === v.key && s.tabLabelActive]}>{v.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading === view && (
        <View style={s.loadingBox}>
          <ActivityIndicator size="small" color="#4B5FE8" />
          <Text style={s.loadingTxt}>Generating…</Text>
        </View>
      )}

      {/* ── Summary ── (the screen opens straight away; the summary fills in when it arrives) */}
      {view === "summary" && !sheet && (
        <View style={s.loadingBox}>
          <ActivityIndicator size="small" color={color} />
          <Text style={s.loadingTxt}>Loading summary…</Text>
        </View>
      )}
      {view === "summary" && sheet && (
        <View style={s.card}>
          {(content.sections ?? []).map((sec: any, i: number) => (
            <View key={i} style={{ marginBottom: 14 }}>
              <MathText text={sec.heading} style={s.sectionLbl} interactive />
              {(sec.bullets ?? []).map((b: string, j: number) => (
                <View key={j} style={s.bulletRow}>
                  <Text style={s.bullet}>•</Text>
                  <MathText text={b} style={s.body} interactive />
                </View>
              ))}
            </View>
          ))}

          {(content.formulas ?? []).length > 0 && (
            <View style={s.tintBox}>
              <Text style={s.sectionLbl}>Formulas</Text>
              {content.formulas.map((f: string, i: number) => (
                <MathText key={i} text={f} style={s.formula} formula interactive />
              ))}
            </View>
          )}

          {(content.keyTerms ?? []).length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={s.sectionLbl}>Key Terms</Text>
              {content.keyTerms.map((kt: any, i: number) => (
                <MathText
                  key={i}
                  lead={{ text: kt.term, style: s.bodyStrong }}
                  text={` — ${kt.definition}`}
                  style={[s.body, { marginBottom: 6 }]}
                  interactive
                />
              ))}
            </View>
          )}

          {(content.examTips ?? []).length > 0 && (
            <View style={s.tintBox}>
              <Text style={s.sectionLbl}>Exam Tips</Text>
              {content.examTips.map((t: string, i: number) => (
                <View key={i} style={s.bulletRow}>
                  <Text style={s.bullet}>•</Text>
                  <MathText text={t} style={s.body} interactive />
                </View>
              ))}
            </View>
          )}

          {!content.sections?.length && <Text style={s.body}>No summary was generated for this lecture.</Text>}
        </View>
      )}

      {/* ── Transcript ── */}
      {view === "transcript" && transcript !== null && (
        <View style={s.card}>
          {transcript.trim()
            ? <MathText text={transcript} style={s.transcript} interactive />
            : <Text style={s.body}>No transcript available for this lecture.</Text>}
        </View>
      )}

      {/* ── Key points ── */}
      {view === "points" && points && (
        <View style={s.card}>
          {points.map((p: any, i: number) => (
            <View key={i} style={s.pointRow}>
              <View style={[s.catChip, { backgroundColor: (CATEGORY_COLOR[p.category] ?? "#4B5FE8") + "1A" }]}>
                <Text style={[s.catTxt, { color: CATEGORY_COLOR[p.category] ?? "#4B5FE8" }]}>{p.category}</Text>
              </View>
              <MathText text={p.point} style={[s.body, { flex: 1 }]} interactive />
            </View>
          ))}
          {!points.length && <Text style={s.body}>No key points found.</Text>}
        </View>
      )}

      {/* ── Ask this lecture ── */}
      {view === "ask" && (
        <View>
          {messages.length === 0 && (
            <View style={s.card}>
              <Text style={s.bodyStrong}>Ask anything about this lecture</Text>
              <Text style={[s.body, { marginTop: 4 }]}>Answers come from this recording's transcript.</Text>
              <View style={{ gap: 8, marginTop: 12 }}>
                {["Explain the main idea simply", "What formulas were covered?", "What might be on the exam?"].map(p => (
                  <TouchableOpacity key={p} style={s.promptChip} onPress={() => { setInput(p); }} activeOpacity={0.7}>
                    <Text style={s.promptTxt}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {messages.map((m, i) => (
            <View key={i} style={[s.msgRow, m.role === "user" ? s.msgRight : s.msgLeft]}>
              {/* A WebView has no intrinsic width, so a bubble holding math takes its max width. */}
              <View style={[s.bubble, m.role === "user" ? s.bubbleUser : s.bubbleAi, hasMathDelimiters(m.content) && s.bubbleWide]}>
                <MathText text={m.content} style={[s.body, m.role === "user" && { color: "#fff" }]} interactive />
              </View>
            </View>
          ))}
          {loading === "ask" && (
            <View style={[s.msgRow, s.msgLeft]}>
              <View style={[s.bubble, s.bubbleAi]}>
                <TypingDots color={color} />
              </View>
            </View>
          )}

          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask about this lecture…"
              placeholderTextColor="rgba(15,17,21,0.35)"
              onSubmitEditing={send}
              returnKeyType="send"
            />
            {loading === "ask" ? (
              <TouchableOpacity
                style={[s.sendBtn, { backgroundColor: "#0f1115" }]}
                onPress={() => chatAbortRef.current?.abort()}
                activeOpacity={0.8}
                accessibilityLabel="Stop"
              >
                <Ionicons name="stop" size={17} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.sendBtn, { backgroundColor: color }, !input.trim() && { opacity: 0.4 }]}
                onPress={send}
                disabled={!input.trim()}
                activeOpacity={0.8}
                accessibilityLabel="Send"
              >
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── Flashcards ── */}
      {view === "cards" && cards && (
        <View>
          {cards.map((c: any, i: number) => (
            <TouchableOpacity
              key={i}
              style={[s.card, flipped[i] && { borderColor: color, backgroundColor: color + "12" }]}
              onPress={() => setFlipped(f => ({ ...f, [i]: !f[i] }))}
              activeOpacity={0.8}
            >
              <Text style={s.cardIdx}>{i + 1} / {cards.length}</Text>
              <MathText text={flipped[i] ? c.back : c.front} style={flipped[i] ? [s.bodyStrong, { color }] : s.bodyStrong} />
              <Text style={s.flipHint}>{flipped[i] ? "Tap to hide" : "Tap to reveal"}</Text>
            </TouchableOpacity>
          ))}
          {!cards.length && <View style={s.card}><Text style={s.body}>No flashcards were generated.</Text></View>}
        </View>
      )}

      {/* ── Quiz ── */}
      {view === "quiz" && quiz && (
        <View>
          {quiz.questions.map((q: any, i: number) => (
            <View key={q.id ?? i} style={s.card}>
              <MathText text={`${i + 1}. ${q.question}`} style={[s.bodyStrong, { marginBottom: 10 }]} interactive />
              {(q.options ?? []).map((opt: string, oi: number) => {
                const picked = answers[i] === oi;
                const revealed = !!score;
                const isRight = q.correctIndex === oi;
                return (
                  <TouchableOpacity
                    key={oi}
                    onPress={() => !score && setAnswers(a => ({ ...a, [i]: oi }))}
                    style={[
                      s.option,
                      picked && !revealed && { borderColor: color, backgroundColor: color + "10" },
                      revealed && isRight && { borderColor: color, backgroundColor: color + "1A", borderWidth: 2 },
                      revealed && picked && !isRight && s.optionWrong,
                    ]}
                    activeOpacity={0.7}
                  >
                    <MathText text={opt} style={[s.body, picked && !revealed && { color }, revealed && isRight && { color, fontWeight: "700" }]} />
                  </TouchableOpacity>
                );
              })}
              {score && q.explanation && (
                <MathText text={q.explanation} style={[s.body, { marginTop: 8, color: "rgba(15,17,21,0.6)" }]} interactive />
              )}
            </View>
          ))}

          {score ? (
            <View style={[s.card, { alignItems: "center" }]}>
              <Text style={[s.scoreTxt, { color }]}>{score.correct} / {score.total}</Text>
              <Text style={s.body}>{Math.round((score.correct / Math.max(score.total, 1)) * 100)}% correct</Text>
            </View>
          ) : (
            <TouchableOpacity style={s.primaryBtn} onPress={submitQuiz} activeOpacity={0.85}>
              <Text style={s.primaryBtnTxt}>Check answers</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <TouchableOpacity onPress={onRecordAnother} style={s.againBtn} activeOpacity={0.7}>
        <Text style={s.againTxt}>Record another</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  headRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 14 },
  headDot: { width: 12, height: 12, borderRadius: 6 },
  lectureTitle: { fontSize: 16.5, fontWeight: "700", color: "#0f1115", flex: 1, lineHeight: 22 },

  tabScroll: { marginBottom: 14 },
  tabRow: { flexDirection: "row", gap: 6, backgroundColor: "#FFFFFF", borderRadius: 24, padding: 5, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" },
  tab: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 19 },
  tabLabel: { fontSize: 13.5, color: "rgba(15,17,21,0.55)", fontWeight: "600" },
  tabLabelActive: { color: "#fff" },

  loadingBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 28 },
  loadingTxt: { fontSize: 14, color: "rgba(15,17,21,0.55)" },

  card: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", marginBottom: 10 },
  sectionLbl: { fontSize: 11, fontWeight: "700", color: "rgba(15,17,21,0.55)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 7 },
  body: { fontSize: 14, color: "rgba(15,17,21,0.78)", lineHeight: 21 },
  transcript: { fontSize: 15, color: "rgba(15,17,21,0.85)", lineHeight: 24 },
  bodyStrong: { fontSize: 14.5, color: "#0f1115", fontWeight: "600", lineHeight: 21 },
  bulletRow: { flexDirection: "row", gap: 8, marginBottom: 5 },
  bullet: { color: "rgba(15,17,21,0.4)", fontSize: 14, lineHeight: 21 },
  tintBox: { backgroundColor: "rgba(75,95,232,0.06)", borderWidth: 1, borderColor: "rgba(75,95,232,0.15)", borderRadius: 12, padding: 12, marginTop: 12 },
  formula: { fontSize: 15, color: "#0f1115", lineHeight: 24, marginBottom: 4 },

  pointRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  catChip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, minWidth: 74, alignItems: "center" },
  catTxt: { fontSize: 10.5, fontWeight: "700" },

  promptChip: { borderWidth: 1, borderColor: "rgba(75,95,232,0.15)", backgroundColor: "rgba(75,95,232,0.06)", borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 },
  promptTxt: { color: "#4B5FE8", fontSize: 14, textAlign: "center" },
  msgRow: { marginBottom: 10 },
  msgRight: { alignItems: "flex-end" },
  msgLeft: { alignItems: "flex-start" },
  bubble: { maxWidth: "88%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11 },
  bubbleUser: { backgroundColor: "#4B5FE8", borderBottomRightRadius: 5 },
  bubbleAi: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", borderBottomLeftRadius: 5 },
  bubbleWide: { width: "88%" },
  inputRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  input: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: "#0f1115", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" },
  sendBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: "#4B5FE8", alignItems: "center", justifyContent: "center" },

  cardIdx: { fontSize: 11, color: "rgba(15,17,21,0.35)", marginBottom: 8, fontWeight: "600" },
  flipHint: { fontSize: 11.5, color: "rgba(15,17,21,0.35)", marginTop: 10 },

  option: { borderWidth: 1, borderColor: "rgba(0,0,0,0.1)", borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, marginBottom: 7 },
  optionWrong: { borderColor: "#DC2626", backgroundColor: "rgba(220,38,38,0.06)" },
  scoreTxt: { fontSize: 32, fontWeight: "800", marginBottom: 4 },

  primaryBtn: { backgroundColor: "#4B5FE8", borderRadius: 16, paddingVertical: 15, alignItems: "center", marginBottom: 10 },
  primaryBtnTxt: { fontSize: 15, color: "#fff", fontWeight: "600" },
  againBtn: { alignSelf: "center", marginTop: 8, marginBottom: 20, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderRadius: 999, paddingHorizontal: 20, paddingVertical: 9 },
  againTxt: { fontSize: 14, color: "rgba(15,17,21,0.55)" },
});
