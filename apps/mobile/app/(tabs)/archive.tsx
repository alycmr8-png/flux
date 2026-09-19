import { ScrollView, View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import useSWR from "swr";
import { useAuth } from "@clerk/clerk-expo";
import { useApi, makeApiFetcher } from "../../lib/api";
import { useTr } from "../../lib/useTr";

export default function ArchiveScreen() {
  const tr = useTr();
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
      tr("This permanently removes the lecture and its content from your course memory. This can't be undone."),
      [
        { text: tr("Cancel"), style: "cancel" },
        { text: tr("Delete"), style: "destructive", onPress: async () => { await api.delete(`/api/lectures/${l.id}`); mutate(); } },
      ]
    );
  }

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]}>
        <Text style={s.eyebrow}>{tr("Archive")}</Text>
        <Text style={s.h1}>{tr("Archived items")}</Text>

        {isLoading ? (
          <Text style={s.muted}>{tr("Loading…")}</Text>
        ) : lectures.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="archive-outline" size={26} color="rgba(15,17,21,0.35)" style={{ marginBottom: 10 }} />
            <Text style={s.muted}>{tr("Nothing archived. Deleted recordings and videos land here first.")}</Text>
          </View>
        ) : (
          lectures.map((l: any) => (
            <View key={l.id} style={s.row}>
              <View style={s.rowIc}>
                <Ionicons name={/youtube\.com|youtu\.be/.test(l.audioUrl ?? "") ? "logo-youtube" : "mic-outline"} size={15} color="#4B5FE8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle} numberOfLines={1}>{l.title}</Text>
                <Text style={s.rowSub}>{l.course?.name ?? ""}</Text>
              </View>
              <TouchableOpacity onPress={() => restore(l.id)} style={s.actionBtn} activeOpacity={0.7}>
                <Text style={s.restoreTxt}>{tr("Restore")}</Text>
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
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { paddingHorizontal: 18, paddingBottom: 142 },
  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase", color: "#4B5FE8", marginBottom: 8 },
  h1: { fontSize: 27, color: "#0f1115", fontWeight: "800", letterSpacing: -0.5, marginBottom: 22 },
  muted: { color: "rgba(15,17,21,0.55)", fontSize: 12.5, textAlign: "center", lineHeight: 18 },
  emptyBox: { alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", borderRadius: 18, padding: 28 },
  row: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", borderRadius: 14, padding: 12, marginBottom: 8 },
  rowIc: { width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(75,95,232,0.1)", borderWidth: 1, borderColor: "rgba(75,95,232,0.2)", alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 13, color: "#0f1115", fontWeight: "500" },
  rowSub: { fontSize: 10.5, color: "rgba(15,17,21,0.55)", marginTop: 1 },
  actionBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  restoreTxt: { color: "#4B5FE8", fontSize: 12, fontWeight: "600" },
});
