import { ScrollView, View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import useSWR from "swr";
import { useAuth } from "@clerk/clerk-expo";
import { useApi, makeApiFetcher } from "../../lib/api";

export default function ArchiveScreen() {
  const insets = useSafeAreaInsets();
  const api = useApi();
  const { getToken } = useAuth();
  const fetcher = makeApiFetcher(getToken);
  const { data, mutate, isLoading } = useSWR("/api/lectures?archived=true", fetcher);
  const lectures: any[] = data?.data ?? [];

  async function restore(id: string) {
    await api.patch(`/api/lectures/${id}/restore`);
    mutate();
  }

  function confirmDelete(l: any) {
    Alert.alert(
      `Delete "${l.title}"?`,
      "This permanently removes the lecture and its content from your course memory. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => { await api.delete(`/api/lectures/${l.id}`); mutate(); } },
      ]
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" />
      <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]}>
        <Text style={s.eyebrow}>Archive</Text>
        <Text style={s.h1}>Archived items</Text>

        {isLoading ? (
          <Text style={s.muted}>Loading…</Text>
        ) : lectures.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="archive-outline" size={26} color="#333" style={{ marginBottom: 10 }} />
            <Text style={s.muted}>Nothing archived. Deleted recordings and videos land here first.</Text>
          </View>
        ) : (
          lectures.map((l: any) => (
            <View key={l.id} style={s.row}>
              <View style={s.rowIc}>
                <Ionicons name={/youtube\.com|youtu\.be/.test(l.audioUrl ?? "") ? "logo-youtube" : "mic-outline"} size={15} color="#888" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle} numberOfLines={1}>{l.title}</Text>
                <Text style={s.rowSub}>{l.course?.name ?? ""}</Text>
              </View>
              <TouchableOpacity onPress={() => restore(l.id)} style={s.actionBtn} activeOpacity={0.7}>
                <Text style={s.restoreTxt}>Restore</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(l)} style={s.actionBtn} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={15} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0F0F0E" },
  content: { paddingHorizontal: 18, paddingBottom: 120 },
  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase", color: "#60A5FA", marginBottom: 8 },
  h1: { fontSize: 27, color: "#fff", fontWeight: "800", letterSpacing: -0.5, marginBottom: 22 },
  muted: { color: "#666", fontSize: 12.5, textAlign: "center", lineHeight: 18 },
  emptyBox: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 0.5, borderColor: "#1e1e1e", borderRadius: 18, padding: 28 },
  row: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 0.5, borderColor: "#1e1e1e", borderRadius: 14, padding: 12, marginBottom: 8 },
  rowIc: { width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 13, color: "#fff", fontWeight: "500" },
  rowSub: { fontSize: 10.5, color: "#555", marginTop: 1 },
  actionBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  restoreTxt: { color: "#60A5FA", fontSize: 12, fontWeight: "600" },
});
