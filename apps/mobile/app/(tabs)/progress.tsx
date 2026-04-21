import { ScrollView, View, Text, StyleSheet } from "react-native";
import useSWR from "swr";
import { api } from "../../lib/api";

const fetcher = (url: string) => api.get(url).then((r) => r.data);

export default function ProgressScreen() {
  const { data, isLoading } = useSWR("/api/progress", fetcher);
  const p = data?.data;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.title}>Progress</Text>
      <Text style={s.sub}>This semester</Text>

      <View style={s.scoreRow}>
        {[
          { val: isLoading ? "—" : p?.lectureCount ?? "0", lbl: "Lectures" },
          { val: isLoading ? "—" : p?.avgScore ? `${p.avgScore}%` : "—", lbl: "Avg score" },
          { val: isLoading ? "—" : p?.streak ?? "0", lbl: "Streak" },
        ].map((sc) => (
          <View key={sc.lbl} style={s.scoreCard}>
            <Text style={s.scoreNum}>{sc.val}</Text>
            <Text style={s.scoreLbl}>{sc.lbl}</Text>
          </View>
        ))}
      </View>

      <Text style={s.sectionLbl}>Retention by course</Text>
      <View style={s.retCard}>
        {!p?.courseRetention?.length && (
          <Text style={s.empty}>Complete quizzes to see retention scores.</Text>
        )}
        {p?.courseRetention?.map((c: any) => (
          <View key={c.code} style={s.retItem}>
            <View style={s.retHead}>
              <Text style={s.retCourse}>{c.code} — {c.name}</Text>
              <Text style={s.retPct}>{c.avg}%</Text>
            </View>
            <View style={s.barBg}>
              <View style={[s.barFill, { width: `${c.avg}%` as any }]} />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  content: { padding: 18, paddingBottom: 40 },
  title: { fontFamily: "serif", fontSize: 28, color: "#fff", marginTop: 16, marginBottom: 4 },
  sub: { fontFamily: "sans-serif", fontSize: 12, color: "#555", marginBottom: 20 },
  scoreRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  scoreCard: { flex: 1, backgroundColor: "#111", borderRadius: 14, padding: 12, alignItems: "center", borderWidth: 0.5, borderColor: "#1e1e1e" },
  scoreNum: { fontFamily: "serif", fontSize: 28, color: "#fff" },
  scoreLbl: { fontFamily: "sans-serif", fontSize: 9, color: "#444", marginTop: 2 },
  sectionLbl: { fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "sans-serif-medium" },
  retCard: { backgroundColor: "#111", borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: "#1e1e1e" },
  retItem: { marginBottom: 14 },
  retHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  retCourse: { fontFamily: "sans-serif", fontSize: 10, color: "#888" },
  retPct: { fontFamily: "sans-serif", fontSize: 10, color: "#fff" },
  barBg: { height: 2, backgroundColor: "#1e1e1e", borderRadius: 1 },
  barFill: { height: 2, backgroundColor: "#fff", borderRadius: 1 },
  empty: { fontFamily: "sans-serif", fontSize: 12, color: "#444" },
});
