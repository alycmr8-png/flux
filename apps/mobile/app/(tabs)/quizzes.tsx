import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import useSWR from "swr";
import { api } from "../../lib/api";

const fetcher = (url: string) => api.get(url).then((r) => r.data);

export default function QuizzesScreen() {
  const router = useRouter();
  const { data, isLoading } = useSWR("/api/quizzes", fetcher);
  const quizzes = data?.data ?? [];

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.title}>Practice Quizzes</Text>
      <Text style={s.sub}>From your own lecture notes</Text>

      {isLoading && <Text style={s.empty}>Loading…</Text>}
      {!isLoading && !quizzes.length && (
        <Text style={s.empty}>No quizzes yet. Record a lecture to get started.</Text>
      )}

      {quizzes.map((quiz: any) => (
        <TouchableOpacity
          key={quiz.id}
          style={s.card}
          onPress={() => router.push(`/quiz/${quiz.id}`)}
        >
          <Text style={s.cardTitle} numberOfLines={2}>{quiz.title}</Text>
          <Text style={s.cardMeta}>{quiz.lecture?.course?.code}</Text>
          <View style={s.cardFoot}>
            <Text style={s.footTxt}>{quiz._count?.questions} questions</Text>
            <Text style={s.footTxt}>{quiz._count?.attempts} attempts</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  content: { padding: 18, paddingBottom: 32 },
  title: { fontFamily: "serif", fontSize: 28, color: "#fff", marginTop: 16, marginBottom: 4 },
  sub: { fontFamily: "sans-serif", fontSize: 12, color: "#555", marginBottom: 20 },
  empty: { fontFamily: "sans-serif", fontSize: 13, color: "#444" },
  card: { backgroundColor: "#111", borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: "#1e1e1e", marginBottom: 10 },
  cardTitle: { fontFamily: "sans-serif-medium", fontSize: 13, color: "#fff", marginBottom: 4 },
  cardMeta: { fontFamily: "sans-serif", fontSize: 10, color: "#444", marginBottom: 10 },
  cardFoot: { flexDirection: "row", gap: 16 },
  footTxt: { fontFamily: "sans-serif", fontSize: 10, color: "#555" },
});
