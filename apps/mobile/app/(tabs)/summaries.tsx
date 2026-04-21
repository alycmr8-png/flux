import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Linking } from "react-native";
import useSWR from "swr";
import { api } from "../../lib/api";
import { Ionicons } from "@expo/vector-icons";

const fetcher = (url: string) => api.get(url).then((r) => r.data);

export default function SummariesScreen() {
  const { data, isLoading } = useSWR("/api/cheatsheets", fetcher);
  const cheatSheets = data?.data ?? [];

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.title}>Cheat Sheets</Text>
      <Text style={s.sub}>AI-generated from your lectures</Text>

      {isLoading && <Text style={s.empty}>Loading…</Text>}
      {!isLoading && !cheatSheets.length && (
        <Text style={s.empty}>No cheat sheets yet. Record a lecture to get started.</Text>
      )}

      {cheatSheets.map((cs: any) => (
        <View key={cs.id} style={s.card}>
          <View style={s.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle} numberOfLines={1}>{cs.title}</Text>
              <Text style={s.cardMeta}>{cs.lecture?.course?.code}</Text>
            </View>
            {cs.driveUrl && (
              <TouchableOpacity onPress={() => Linking.openURL(cs.driveUrl)}>
                <Ionicons name="open-outline" size={14} color="#555" />
              </TouchableOpacity>
            )}
          </View>
          {cs.content?.sections?.slice(0, 2).map((section: any, i: number) => (
            <View key={i} style={s.section}>
              <Text style={s.sectionHead}>{section.heading}</Text>
              {section.bullets?.slice(0, 2).map((b: string, j: number) => (
                <View key={j} style={s.bulletRow}>
                  <View style={s.bulletDot} />
                  <Text style={s.bulletTxt}>{b}</Text>
                </View>
              ))}
            </View>
          ))}
          {cs.content?.examTips?.length > 0 && (
            <View style={s.tipRow}>
              <Text style={s.tipLbl}>Exam tip: </Text>
              <Text style={s.tipTxt} numberOfLines={2}>{cs.content.examTips[0]}</Text>
            </View>
          )}
        </View>
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
  card: { backgroundColor: "#111", borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: "#1e1e1e", marginBottom: 12 },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  cardTitle: { fontFamily: "sans-serif-medium", fontSize: 13, color: "#fff" },
  cardMeta: { fontFamily: "sans-serif", fontSize: 10, color: "#444", marginTop: 2 },
  section: { marginBottom: 8 },
  sectionHead: { fontFamily: "sans-serif-medium", fontSize: 10, color: "#888", marginBottom: 4 },
  bulletRow: { flexDirection: "row", gap: 6, alignItems: "flex-start", marginBottom: 3 },
  bulletDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#333", marginTop: 5 },
  bulletTxt: { fontFamily: "sans-serif", fontSize: 10, color: "#555", flex: 1, lineHeight: 16 },
  tipRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  tipLbl: { fontFamily: "sans-serif-medium", fontSize: 10, color: "#fff" },
  tipTxt: { fontFamily: "sans-serif", fontSize: 10, color: "#666", flex: 1 },
});
