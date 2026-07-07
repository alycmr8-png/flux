import { ScrollView, View, Text, StyleSheet, TouchableOpacity, StatusBar, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import useSWR from "swr";
import { makeApiFetcher } from "../../lib/api";
import { useAuth, useUser } from "@clerk/clerk-expo";

const TYPE_COLOR: Record<string, string> = {
  exam: "#EF4444", assignment: "#F97316", deadline: "#EAB308",
  quiz: "#A855F7", class: "#3B82F6", other: "#6B7280",
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function daysUntil(dateStr: string) {
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { user } = useUser();
  const fetcher = makeApiFetcher(getToken);

  const range = useMemo(() => ({
    from: new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
    to: new Date(Date.now() + 30 * 86400000).toISOString(),
  }), []);

  const { data: eventsData } = useSWR(`/api/events?from=${range.from}&to=${range.to}`, fetcher);
  const { data: coursesData } = useSWR("/api/courses", fetcher);
  const { data: videosData } = useSWR("/api/studybook/recent-videos", fetcher);
  const { data: sheetsData } = useSWR("/api/cheatsheets", fetcher);

  const events: any[] = (eventsData?.data ?? [])
    .filter((e: any) => daysUntil(e.date) >= 0)
    .sort((x: any, y: any) => new Date(x.date).getTime() - new Date(y.date).getTime())
    .slice(0, 3);
  const courses: any[] = coursesData?.data ?? [];
  const videos: any[] = (videosData?.data ?? []).slice(0, 4);
  const notes: any[] = (sheetsData?.data ?? []).slice(0, 3);

  const firstName = user?.firstName ?? "";

  return (
    <>
      <StatusBar barStyle="light-content" />
      <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]}>
        <Text style={s.eyebrow}>Overview</Text>
        <Text style={s.h1}>{greeting()}{firstName ? `, ${firstName}` : ""}.</Text>

        {/* Coming up */}
        <Text style={s.sectionLbl}>Coming up</Text>
        {events.length === 0 ? (
          <TouchableOpacity style={s.emptyRow} onPress={() => router.push("/(tabs)/calendar" as any)} activeOpacity={0.7}>
            <Ionicons name="add" size={14} color="#555" />
            <Text style={s.emptyTxt}>No upcoming events — add one in Calendar</Text>
          </TouchableOpacity>
        ) : (
          events.map((e: any) => {
            const diff = daysUntil(e.date);
            const color = TYPE_COLOR[e.type] ?? "#6B7280";
            const d = new Date(e.date);
            return (
              <TouchableOpacity key={e.id} style={[s.eventCard, { borderLeftColor: color }]}
                onPress={() => router.push("/(tabs)/calendar" as any)} activeOpacity={0.7}>
                <View style={s.dateBlock}>
                  <Text style={s.dateDay}>{d.getDate()}</Text>
                  <Text style={s.dateMon}>{d.toLocaleString("default", { month: "short" })}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.eventTitle} numberOfLines={1}>{e.title}</Text>
                  <Text style={s.eventSub}>{e.type}{e.course?.code ? ` · ${e.course.code}` : ""}</Text>
                </View>
                <View style={[s.countChip, { backgroundColor: diff === 0 ? "rgba(239,68,68,0.14)" : "rgba(255,255,255,0.06)" }]}>
                  <Text style={[s.countTxt, diff === 0 && { color: "#F87171" }]}>
                    {diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : `In ${diff} days`}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* My classes */}
        <Text style={s.sectionLbl}>My classes</Text>
        {courses.length === 0 ? (
          <TouchableOpacity style={s.emptyRow} onPress={() => router.push("/(tabs)/record" as any)} activeOpacity={0.7}>
            <Ionicons name="add" size={14} color="#555" />
            <Text style={s.emptyTxt}>Create your first class</Text>
          </TouchableOpacity>
        ) : (
          courses.map((c: any) => (
            <TouchableOpacity key={c.id} style={s.classCard} onPress={() => router.push("/(tabs)/record" as any)} activeOpacity={0.7}>
              <View style={s.classIc}><Ionicons name="layers-outline" size={16} color="#60A5FA" /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.className}>{c.name}</Text>
                <Text style={s.classCode}>{c.code}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="#333" />
            </TouchableOpacity>
          ))
        )}

        {/* Recent videos */}
        {videos.length > 0 && (
          <>
            <Text style={s.sectionLbl}>Recent videos</Text>
            <View style={s.videoGrid}>
              {videos.map((v: any) => (
                <TouchableOpacity key={v.videoId ?? v.title} style={s.videoCard}
                  onPress={() => router.push("/(tabs)/record" as any)} activeOpacity={0.7}>
                  {v.thumbnail
                    ? <Image source={{ uri: v.thumbnail }} style={s.thumb} />
                    : <View style={[s.thumb, s.thumbEmpty]}><Ionicons name="logo-youtube" size={18} color="#444" /></View>}
                  <Text style={s.videoTitle} numberOfLines={2}>{v.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Saved notes */}
        {notes.length > 0 && (
          <>
            <Text style={s.sectionLbl}>Saved notes</Text>
            {notes.map((cs: any) => (
              <View key={cs.id} style={s.noteRow}>
                <Ionicons name="document-text-outline" size={15} color="#666" />
                <Text style={s.noteName} numberOfLines={1}>{cs.title}</Text>
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
  root: { flex: 1, backgroundColor: "#0F0F0E" },
  content: { paddingHorizontal: 18, paddingBottom: 120 },
  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase", color: "#60A5FA", marginBottom: 8 },
  h1: { fontSize: 27, color: "#fff", fontWeight: "800", letterSpacing: -0.5, marginBottom: 26 },
  sectionLbl: { fontSize: 10, color: "#60A5FA", textTransform: "uppercase", letterSpacing: 1.6, fontWeight: "700", marginBottom: 10, marginTop: 8 },
  emptyRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#222", borderStyle: "dashed", borderRadius: 16, padding: 15, marginBottom: 18 },
  emptyTxt: { color: "#666", fontSize: 12 },
  eventCard: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 0.5, borderColor: "#1e1e1e", borderLeftWidth: 3, borderRadius: 16, padding: 13, marginBottom: 9 },
  dateBlock: { width: 40, alignItems: "center" },
  dateDay: { fontSize: 19, fontWeight: "800", color: "#fff", lineHeight: 22 },
  dateMon: { fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "#555", marginTop: 1 },
  eventTitle: { fontSize: 13.5, fontWeight: "600", color: "#fff" },
  eventSub: { fontSize: 11, color: "#555", marginTop: 2, textTransform: "capitalize" },
  countChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  countTxt: { fontSize: 10.5, fontWeight: "700", color: "#999" },
  classCard: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 0.5, borderColor: "#1e1e1e", borderRadius: 16, padding: 14, marginBottom: 9 },
  classIc: { width: 36, height: 36, borderRadius: 11, backgroundColor: "rgba(37,99,235,0.14)", alignItems: "center", justifyContent: "center" },
  className: { fontSize: 14, color: "#fff", fontWeight: "600" },
  classCode: { fontSize: 11, color: "#555", marginTop: 1 },
  videoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  videoCard: { width: "47.5%" },
  thumb: { width: "100%", aspectRatio: 16 / 9, borderRadius: 12, backgroundColor: "#161616" },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  videoTitle: { fontSize: 11.5, color: "#ccc", fontWeight: "500", marginTop: 6, lineHeight: 15 },
  noteRow: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 0.5, borderColor: "#1e1e1e", borderRadius: 14, padding: 13, marginBottom: 8 },
  noteName: { flex: 1, fontSize: 12.5, color: "#ddd", fontWeight: "500" },
});
