import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import useSWR from "swr";
import { useApi, makeApiFetcher } from "../../lib/api";
import { useAuth } from "@clerk/clerk-expo";

export default function QuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAuth();
  const api = useApi();
  const fetcher = makeApiFetcher(userId);
  const { data } = useSWR(`/api/quizzes/${id}`, fetcher);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);

  const quiz = data?.data;
  if (!quiz) return <View style={s.root}><Text style={s.empty}>Loading…</Text></View>;

  async function submit() {
    const answerArr = quiz.questions.map((_: any, i: number) => answers[i] ?? -1);
    const res = await api.post(`/api/quizzes/${id}/attempt`, { answers: answerArr });
    setResult(res.data.data);
    setSubmitted(true);
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <TouchableOpacity onPress={() => router.back()} style={s.back}>
        <Text style={s.backTxt}>← Back</Text>
      </TouchableOpacity>
      <Text style={s.title} numberOfLines={2}>{quiz.title}</Text>

      {submitted && result && (
        <View style={s.scoreRow}>
          {[
            { val: `${Math.round(result.score)}%`, lbl: "Score" },
            { val: result.correct, lbl: "Correct" },
            { val: result.total, lbl: "Total" },
          ].map((sc) => (
            <View key={sc.lbl} style={s.scoreCard}>
              <Text style={s.scoreNum}>{sc.val}</Text>
              <Text style={s.scoreLbl}>{sc.lbl}</Text>
            </View>
          ))}
        </View>
      )}

      {quiz.questions.map((q: any, qi: number) => (
        <View key={q.id} style={s.qCard}>
          <Text style={s.qNum}>Question {qi + 1} of {quiz.questions.length}</Text>
          <Text style={s.qText}>{q.question}</Text>
          {(q.options as string[]).map((opt: string, oi: number) => {
            const selected = answers[qi] === oi;
            const correct = submitted && oi === q.correctIndex;
            const wrong = submitted && selected && oi !== q.correctIndex;
            return (
              <TouchableOpacity
                key={oi}
                style={[s.opt, correct && s.optOk, wrong && s.optNo, selected && !submitted && s.optSelected]}
                onPress={() => !submitted && setAnswers({ ...answers, [qi]: oi })}
              >
                <View style={[s.optDot, (selected || correct) && s.optDotOn]} />
                <Text style={[s.optTxt, correct && s.optTxtOk, wrong && s.optTxtNo]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
          {submitted && (
            <View style={s.hint}>
              <Text style={s.hintLbl}>✓ Correct — from your notes</Text>
              <Text style={s.hintTxt}>{q.explanation}</Text>
              {q.timestampSeconds != null && (
                <Text style={s.hintTime}>
                  From lecture at {Math.floor(q.timestampSeconds / 60)}:{String(q.timestampSeconds % 60).padStart(2, "0")}
                </Text>
              )}
            </View>
          )}
        </View>
      ))}

      {!submitted && (
        <TouchableOpacity style={s.submitBtn} onPress={submit}>
          <Text style={s.submitTxt}>Submit quiz</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  content: { padding: 18, paddingBottom: 40 },
  back: { marginTop: 16, marginBottom: 4 },
  backTxt: { fontFamily: "sans-serif", fontSize: 12, color: "#555" },
  title: { fontFamily: "serif", fontSize: 24, color: "#fff", marginBottom: 20 },
  empty: { fontFamily: "sans-serif", fontSize: 13, color: "#444", padding: 18 },
  scoreRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  scoreCard: { flex: 1, backgroundColor: "#111", borderRadius: 14, padding: 12, alignItems: "center", borderWidth: 0.5, borderColor: "#1e1e1e" },
  scoreNum: { fontFamily: "serif", fontSize: 26, color: "#fff" },
  scoreLbl: { fontFamily: "sans-serif", fontSize: 9, color: "#444", marginTop: 2 },
  qCard: { backgroundColor: "#111", borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: "#1e1e1e", marginBottom: 12 },
  qNum: { fontFamily: "sans-serif", fontSize: 9, color: "#444", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 },
  qText: { fontFamily: "sans-serif", fontSize: 12, color: "#ddd", lineHeight: 18, marginBottom: 12 },
  opt: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, borderWidth: 0.5, borderColor: "#1e1e1e", marginBottom: 6, backgroundColor: "#111" },
  optOk: { borderColor: "#fff", backgroundColor: "#1a1a1a" },
  optNo: { borderColor: "#333", opacity: 0.5 },
  optSelected: { borderColor: "#fff" },
  optDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 0.5, borderColor: "#333" },
  optDotOn: { backgroundColor: "#fff", borderColor: "#fff" },
  optTxt: { fontFamily: "sans-serif", fontSize: 11, color: "#666", flex: 1 },
  optTxtOk: { color: "#fff" },
  optTxtNo: { textDecorationLine: "line-through" },
  hint: { backgroundColor: "#0a0a0a", borderRadius: 10, padding: 10, borderWidth: 0.5, borderColor: "#1a1a1a", marginTop: 6 },
  hintLbl: { fontFamily: "sans-serif-medium", fontSize: 10, color: "#fff", marginBottom: 3 },
  hintTxt: { fontFamily: "sans-serif", fontSize: 10, color: "#666", lineHeight: 15 },
  hintTime: { fontFamily: "sans-serif", fontSize: 9, color: "#333", marginTop: 4 },
  submitBtn: { backgroundColor: "#fff", borderRadius: 999, padding: 14, alignItems: "center", marginTop: 8 },
  submitTxt: { fontFamily: "sans-serif-medium", fontSize: 14, color: "#000" },
});
