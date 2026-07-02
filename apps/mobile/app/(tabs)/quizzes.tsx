import { ScrollView, View, Text, StyleSheet, TouchableOpacity, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import useSWR from "swr";
import { makeApiFetcher } from "../../lib/api";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";

export default function QuizzesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const fetcher = makeApiFetcher(getToken);
  const { data, isLoading } = useSWR("/api/quizzes", fetcher);
  const quizzes = data?.data ?? [];

  return (
    <>
      <StatusBar barStyle="light-content" />
      <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 16 }]}>
        <Text style={s.title}>Quizzes</Text>
        <Text style={s.sub}>From your own lecture notes</Text>

        {isLoading && <Text style={s.empty}>Loading…</Text>}

        {!isLoading && !quizzes.length && (
          <View style={s.emptyCard}>
            <Ionicons name="book-outline" size={28} color="#333" style={{ marginBottom: 12 }} />
            <Text style={s.emptyTitle}>No quizzes yet</Text>
            <Text style={s.emptyHint}>Record a lecture and AI will generate practice questions</Text>
          </View>
        )}

        {quizzes.map((quiz: any) => (
          <TouchableOpacity
            key={quiz.id}
            style={s.card}
            onPress={() => router.push(`/quiz/${quiz.id}` as any)}
            activeOpacity={0.7}
          >
            <View style={s.cardTop}>
              <Text style={s.cardTitle} numberOfLines={2}>{quiz.title}</Text>
              <Ionicons name="chevron-forward" size={16} color="#333" />
            </View>
            {quiz.lecture?.course?.code && (
              <Text style={s.course}>{quiz.lecture.course.code}</Text>
            )}
            <View style={s.pills}>
              <View style={s.pill}>
                <Text style={s.pillTxt}>{quiz._count?.questions ?? 0} questions</Text>
              </View>
              {quiz._count?.attempts > 0 && (
                <View style={s.pill}>
                  <Text style={s.pillTxt}>{quiz._count.attempts} attempts</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  content: { paddingHorizontal: 16, paddingBottom: 110 },
  title: { fontSize: 32, color: "#fff", fontStyle: "italic", fontWeight: "300", marginBottom: 4 },
  sub: { fontSize: 12, color: "#444", marginBottom: 20 },
  empty: { fontSize: 13, color: "#444" },
  emptyCard: { backgroundColor: "#111", borderRadius: 20, padding: 32, alignItems: "center", borderWidth: 0.5, borderColor: "#1e1e1e" },
  emptyTitle: { fontSize: 15, color: "#555", fontWeight: "500", marginBottom: 6 },
  emptyHint: { fontSize: 12, color: "#333", textAlign: "center", lineHeight: 18 },
  card: { backgroundColor: "#111", borderRadius: 20, padding: 16, borderWidth: 0.5, borderColor: "#1e1e1e", marginBottom: 10 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 },
  cardTitle: { fontSize: 14, color: "#fff", fontWeight: "600", flex: 1, lineHeight: 20 },
  course: { fontSize: 10, color: "#444", letterSpacing: 0.5, marginBottom: 12 },
  pills: { flexDirection: "row", gap: 8 },
  pill: { backgroundColor: "#1a1a1a", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillTxt: { fontSize: 10, color: "#555" },
});
