import { ScrollView, View, Text, StyleSheet, TouchableOpacity, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import useSWR from "swr";
import { makeApiFetcher } from "../../lib/api";
import { useAuth, useClerk } from "@clerk/clerk-expo";

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const fetcher = makeApiFetcher(getToken);
  const { data: progress, isLoading } = useSWR("/api/progress", fetcher);
  const { data: lectures } = useSWR("/api/lectures", fetcher);
  const { data: cheatSheets } = useSWR("/api/cheatsheets", fetcher);

  const p = progress?.data;
  const recent = lectures?.data?.[0];
  const notes = cheatSheets?.data?.slice(0, 3) ?? [];

  const STATS = [
    { val: isLoading ? "â€”" : String(p?.lectureCount ?? 0), lbl: "Lectures" },
    { val: isLoading ? "â€”" : (p?.avgScore ? `${p.avgScore}%` : "â€”"), lbl: "Avg score" },
    { val: isLoading ? "â€”" : String(p?.streak ?? 0), lbl: "Day streak" },
  ];

  const ACTIONS = [
    { icon: "mic-outline",           label: "Record",    route: "/(tabs)/record"    },
    { icon: "document-text-outline", label: "Summaries", route: "/(tabs)/summaries" },
    { icon: "book-outline",          label: "Quizzes",   route: "/(tabs)/quizzes"   },
    { icon: "calendar-outline",      label: "Schedule",  route: "/(tabs)/calendar"  },
  ];

  return (
    <>
      <StatusBar barStyle="light-content" />
      <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 16 }]}>
        <View style={s.header}>
          <View>
            <Text style={s.brand}>Flux</Text>
            <Text style={s.sub}>Your study activity at a glance</Text>
          </View>
          <TouchableOpacity onPress={() => signOut()} style={s.logoutBtn} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={20} color="#555" />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          {STATS.map((st) => (
            <View key={st.lbl} style={s.statCard}>
              <Text style={s.statNum}>{st.val}</Text>
              <Text style={s.statLbl}>{st.lbl}</Text>
            </View>
          ))}
        </View>

        {/* Latest lecture */}
        <Text style={s.sectionLabel}>Latest lecture</Text>
        {recent ? (
          <View style={s.card}>
            <View style={s.badge}><Text style={s.badgeTxt}>{recent.status}</Text></View>
            <Text style={s.cardTitle}>{recent.title}</Text>
            <Text style={s.cardMeta}>{recent.course?.name}</Text>
          </View>
        ) : (
          <View style={s.card}>
            <Text style={s.cardMeta}>No lectures yet. Tap Record below to start.</Text>
          </View>
        )}

        {/* Quick actions */}
        <Text style={s.sectionLabel}>Quick actions</Text>
        <View style={s.actionsGrid}>
          {ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={s.actionBtn}
              onPress={() => router.push(a.route as any)}
              activeOpacity={0.7}
            >
              <Ionicons name={a.icon as any} size={20} color="#555" />
              <Text style={s.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Saved notes */}
        {notes.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Saved notes</Text>
            {notes.map((cs: any) => (
              <View key={cs.id} style={s.noteRow}>
                <Ionicons name="document-text" size={15} color="#333" />
                <View style={s.noteInfo}>
                  <Text style={s.noteName} numberOfLines={1}>{cs.title}</Text>
                  <Text style={s.noteSub}>{cs.driveUrl ? "Drive synced" : "Local"}</Text>
                </View>
                <Ionicons name="chevron-forward" size={13} color="#333" />
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  content: { paddingHorizontal: 16, paddingBottom: 110 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  brand: { fontSize: 28, color: "#fff", fontStyle: "italic", fontWeight: "300", marginBottom: 4 },
  sub: { fontSize: 12, color: "#555" },
  logoutBtn: { padding: 8, marginTop: 4 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: "#111", borderRadius: 18, padding: 14, alignItems: "center", borderWidth: 0.5, borderColor: "#1e1e1e" },
  statNum: { fontSize: 26, color: "#fff", fontWeight: "200", marginBottom: 2 },
  statLbl: { fontSize: 9, color: "#555", letterSpacing: 0.5, textAlign: "center" },
  sectionLabel: { fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: 2, marginBottom: 10, fontWeight: "600" },
  card: { backgroundColor: "#111", borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: "#1e1e1e", marginBottom: 20 },
  badge: { backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start", marginBottom: 8 },
  badgeTxt: { fontSize: 9, color: "#000", fontWeight: "700", textTransform: "uppercase" },
  cardTitle: { fontSize: 13, color: "#fff", fontWeight: "500", marginBottom: 3 },
  cardMeta: { fontSize: 11, color: "#555" },
  actionsGrid: { flexDirection: "row", gap: 10, marginBottom: 24 },
  actionBtn: { flex: 1, backgroundColor: "#111", borderRadius: 14, padding: 12, alignItems: "center", gap: 6, borderWidth: 0.5, borderColor: "#1e1e1e" },
  actionLabel: { fontSize: 9, color: "#555" },
  noteRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#111", borderRadius: 14, padding: 12, borderWidth: 0.5, borderColor: "#1e1e1e", marginBottom: 8 },
  noteInfo: { flex: 1 },
  noteName: { fontSize: 12, color: "#ddd", fontWeight: "500" },
  noteSub: { fontSize: 10, color: "#444", marginTop: 2 },
});

