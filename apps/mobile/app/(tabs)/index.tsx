import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import useSWR from "swr";
import { api } from "../../lib/api";

const fetcher = (url: string) => api.get(url).then((r) => r.data);

export default function HomeScreen() {
  const router = useRouter();
  const { data: progress } = useSWR("/api/progress", fetcher);
  const { data: lectures } = useSWR("/api/lectures", fetcher);
  const { data: cheatSheets } = useSWR("/api/cheatsheets", fetcher);

  const streak = progress?.data?.streak ?? 0;
  const recent = lectures?.data?.slice(0, 1)?.[0];
  const notes = cheatSheets?.data?.slice(0, 3) ?? [];

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.topbar}>
        <Text style={s.brand}>StudyAgent</Text>
      </View>

      <View style={s.streak}>
        <Text style={s.streakNum}>{streak}</Text>
        <View>
          <Text style={s.streakL}>Day streak</Text>
          <Text style={s.streakS}>Keep it going</Text>
        </View>
        <View style={s.dots}>
          {Array.from({ length: 7 }).map((_, i) => (
            <View key={i} style={[s.dot, i < streak ? s.dotOn : s.dotOff]} />
          ))}
        </View>
      </View>

      <Text style={s.sectionLbl}>Latest lecture</Text>
      {recent ? (
        <View style={s.card}>
          <View style={s.badge}><Text style={s.badgeTxt}>{recent.status}</Text></View>
          <Text style={s.cardTitle}>{recent.title}</Text>
          <Text style={s.cardMeta}>{recent.course?.name} · Today</Text>
        </View>
      ) : (
        <View style={s.card}><Text style={s.cardMeta}>No lectures yet. Hit Record to start.</Text></View>
      )}

      <View style={s.actRow}>
        {[
          { icon: "⏺", label: "Record", onPress: () => router.push("/(tabs)/record") },
          { icon: "◦", label: "Cheat Sheet", onPress: () => router.push("/(tabs)/summaries") },
          { icon: "✦", label: "Quiz", onPress: () => router.push("/(tabs)/quizzes") },
          { icon: "📅", label: "Schedule", onPress: () => router.push("/(tabs)/calendar") },
        ].map((a) => (
          <TouchableOpacity key={a.label} style={s.actBtn} onPress={a.onPress}>
            <Text style={s.actIcon}>{a.icon}</Text>
            <Text style={s.actLbl}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.sectionLbl}>Saved notes</Text>
      {notes.map((cs: any) => (
        <View key={cs.id} style={s.rowItem}>
          <View style={s.rowIcon}><Text>📄</Text></View>
          <View style={s.rowInfo}>
            <Text style={s.rowName} numberOfLines={1}>{cs.title}</Text>
            <Text style={s.rowSub}>{cs.driveUrl ? "Drive synced" : "Local"}</Text>
          </View>
          <Text style={s.rowRight}>→</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  content: { paddingBottom: 32 },
  topbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12 },
  brand: { fontFamily: "serif", fontSize: 22, color: "#fff" },
  streak: { marginHorizontal: 12, marginBottom: 16, backgroundColor: "#111", borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: "#1e1e1e", flexDirection: "row", alignItems: "center", gap: 10 },
  streakNum: { fontFamily: "serif", fontSize: 32, color: "#fff" },
  streakL: { fontFamily: "sans-serif-medium", fontSize: 12, color: "#ddd" },
  streakS: { fontFamily: "sans-serif", fontSize: 10, color: "#444", marginTop: 2 },
  dots: { flexDirection: "row", gap: 4, marginLeft: "auto" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { backgroundColor: "#fff" },
  dotOff: { backgroundColor: "#1e1e1e" },
  sectionLbl: { fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: 1.5, paddingHorizontal: 18, marginBottom: 8, fontFamily: "sans-serif-medium" },
  card: { marginHorizontal: 12, marginBottom: 12, backgroundColor: "#111", borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: "#222" },
  badge: { backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start", marginBottom: 8 },
  badgeTxt: { fontFamily: "sans-serif-medium", fontSize: 9, color: "#000" },
  cardTitle: { fontFamily: "sans-serif-medium", fontSize: 13, color: "#fff", marginBottom: 3 },
  cardMeta: { fontFamily: "sans-serif", fontSize: 10, color: "#555" },
  actRow: { flexDirection: "row", gap: 8, paddingHorizontal: 12, marginBottom: 16 },
  actBtn: { flex: 1, backgroundColor: "#111", borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 0.5, borderColor: "#222" },
  actIcon: { fontSize: 16, marginBottom: 4 },
  actLbl: { fontFamily: "sans-serif", fontSize: 9, color: "#555" },
  rowItem: { marginHorizontal: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#111", borderRadius: 12, padding: 10, borderWidth: 0.5, borderColor: "#1e1e1e" },
  rowIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: "#1e1e1e", alignItems: "center", justifyContent: "center" },
  rowInfo: { flex: 1 },
  rowName: { fontFamily: "sans-serif-medium", fontSize: 11, color: "#ddd" },
  rowSub: { fontFamily: "sans-serif", fontSize: 9, color: "#444", marginTop: 1 },
  rowRight: { fontFamily: "sans-serif", fontSize: 12, color: "#555" },
});
