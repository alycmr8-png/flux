import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Linking, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useSWR from "swr";
import { makeApiFetcher } from "../../lib/api";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";

export default function SummariesScreen() {
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const fetcher = makeApiFetcher(getToken);
  const { data, isLoading } = useSWR("/api/cheatsheets", fetcher);
  const cheatSheets = data?.data ?? [];

  return (
    <>
      <StatusBar barStyle="light-content" />
      <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 16 }]}>
        <Text style={s.title}>Cheat Sheets</Text>
        <Text style={s.sub}>AI-generated from your lectures</Text>

        {isLoading && <Text style={s.empty}>Loading…</Text>}
        {!isLoading && !cheatSheets.length && (
          <View style={s.emptyCard}>
            <Ionicons name="document-text-outline" size={28} color="#333" style={{ marginBottom: 12 }} />
            <Text style={s.emptyTitle}>No cheat sheets yet</Text>
            <Text style={s.emptyHint}>Record a lecture and AI will generate one for you</Text>
          </View>
        )}

        {cheatSheets.map((cs: any) => (
          <View key={cs.id} style={s.card}>
            <View style={s.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle} numberOfLines={1}>{cs.title}</Text>
                {cs.lecture?.course?.code && (
                  <Text style={s.cardCourse}>{cs.lecture.course.code}</Text>
                )}
              </View>
              {cs.driveUrl && (
                <TouchableOpacity onPress={() => Linking.openURL(cs.driveUrl)} style={s.driveBtn}>
                  <Ionicons name="logo-google" size={12} color="#555" />
                  <Text style={s.driveTxt}>Drive</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Action items — pinned at top */}
            {cs.content?.actionItems?.length > 0 && (
              <View style={s.actionBox}>
                <View style={s.actionHeader}>
                  <Ionicons name="alarm-outline" size={11} color="#fff" />
                  <Text style={s.actionLabel}>Action items</Text>
                </View>
                {cs.content.actionItems.map((item: any, i: number) => (
                  <View key={i} style={s.actionRow}>
                    <Ionicons
                      name={
                        item.type === "exam"     ? "school-outline"     :
                        item.type === "deadline" ? "time-outline"       :
                        item.type === "reading"  ? "book-outline"       :
                                                   "checkbox-outline"
                      }
                      size={11}
                      color="#888"
                    />
                    <Text style={s.actionTxt}>{item.text}{item.dueDate ? ` — ${item.dueDate}` : ""}</Text>
                  </View>
                ))}
              </View>
            )}

            {cs.content?.sections?.slice(0, 2).map((section: any, i: number) => (
              <View key={i} style={s.section}>
                <Text style={s.sectionHead}>{section.heading}</Text>
                {section.bullets?.slice(0, 3).map((b: string, j: number) => (
                  <View key={j} style={s.bullet}>
                    <View style={s.bulletDot} />
                    <Text style={s.bulletTxt}>{b}</Text>
                  </View>
                ))}
              </View>
            ))}

            {cs.content?.examTips?.[0] && (
              <View style={s.tipBox}>
                <Text style={s.tipLabel}>Exam tip</Text>
                <Text style={s.tipText} numberOfLines={2}>{cs.content.examTips[0]}</Text>
              </View>
            )}
          </View>
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
  card: { backgroundColor: "#111", borderRadius: 20, padding: 16, borderWidth: 0.5, borderColor: "#1e1e1e", marginBottom: 12 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  cardTitle: { fontSize: 14, color: "#fff", fontWeight: "600", marginBottom: 3 },
  cardCourse: { fontSize: 10, color: "#444", letterSpacing: 0.5 },
  driveBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 0.5, borderColor: "#222", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  driveTxt: { fontSize: 10, color: "#555" },
  section: { marginBottom: 10 },
  sectionHead: { fontSize: 10, color: "#666", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
  bullet: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 4 },
  bulletDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#2a2a2a", marginTop: 6 },
  bulletTxt: { fontSize: 11, color: "#666", flex: 1, lineHeight: 17 },
  tipBox: { backgroundColor: "#0a0a0a", borderRadius: 12, padding: 12, borderWidth: 0.5, borderColor: "#1a1a1a", marginTop: 4 },
  tipLabel: { fontSize: 9, color: "#fff", fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  tipText: { fontSize: 11, color: "#555", lineHeight: 17 },
  actionBox: { backgroundColor: "#0d0d0d", borderRadius: 12, padding: 12, borderWidth: 0.5, borderColor: "#1e1e1e", marginBottom: 12 },
  actionHeader: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8 },
  actionLabel: { fontSize: 9, color: "#fff", fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  actionRow: { flexDirection: "row", alignItems: "flex-start", gap: 7, marginBottom: 5 },
  actionTxt: { fontSize: 11, color: "#888", flex: 1, lineHeight: 16 },
});
