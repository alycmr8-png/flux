import { ScrollView, View, Text, StyleSheet, TouchableOpacity, StatusBar } from "react-native";
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
  const { data: sheetsData } = useSWR("/api/cheatsheets", fetcher);

  const events: any[] = (eventsData?.data ?? [])
    .filter((e: any) => daysUntil(e.date) >= 0)
    .sort((x: any, y: any) => new Date(x.date).getTime() - new Date(y.date).getTime())
    .slice(0, 3);
  const courses: any[] = coursesData?.data ?? [];
  const notes: any[] = (sheetsData?.data ?? []).slice(0, 3);

  const firstName = user?.firstName ?? "";

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]}>
        <Text style={s.eyebrow}>Overview</Text>
        <Text style={s.h1}>{greeting()}{firstName ? `, ${firstName}` : ""}.</Text>

        {/* Coming up */}
        <Text style={s.sectionLbl}>Coming up</Text>
        {events.length === 0 ? (
          <TouchableOpacity style={s.emptyRow} onPress={() => router.push("/(tabs)/calendar" as any)} activeOpacity={0.7}>
            <Ionicons name="add" size={16} color="rgba(15,17,21,0.55)" />
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
                  <Text style={s.eventSub}>{e.type}{e.course?.name ? ` · ${e.course.name}` : ""}</Text>
                </View>
                <View style={[s.countChip, { backgroundColor: diff === 0 ? "rgba(239,68,68,0.12)" : "rgba(15,17,21,0.06)" }]}>
                  <Text style={[s.countTxt, diff === 0 && { color: "#DC2626" }]}>
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
            <Ionicons name="add" size={16} color="rgba(15,17,21,0.55)" />
            <Text style={s.emptyTxt}>Create your first class</Text>
          </TouchableOpacity>
        ) : (
          courses.map((c: any) => (
            <TouchableOpacity
              key={c.id}
              style={s.classCard}
              onPress={() => router.push({ pathname: "/(tabs)/record", params: { courseId: c.id, courseName: c.name, courseCode: c.code, courseColor: c.color ?? "" } } as any)}
              activeOpacity={0.7}
            >
              <View style={[s.classIc, { backgroundColor: c.color || "#4B5FE8", borderColor: c.color || "#4B5FE8" }]}>
                <Text style={s.classIcTxt}>{(c.name ?? "?").trim().charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.className}>{c.name}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(15,17,21,0.35)" />
            </TouchableOpacity>
          ))
        )}

        {/* Saved notes */}
        {notes.length > 0 && (
          <>
            <Text style={s.sectionLbl}>Saved notes</Text>
            {notes.map((cs: any) => (
              <View key={cs.id} style={s.noteRow}>
                <Ionicons name="document-text-outline" size={17} color="rgba(15,17,21,0.55)" />
                <Text style={s.noteName} numberOfLines={1}>{cs.title}</Text>
                <Ionicons name="chevron-forward" size={15} color="rgba(15,17,21,0.35)" />
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { paddingHorizontal: 18, paddingBottom: 142 },
  eyebrow: { fontSize: 11.5, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase", color: "#4B5FE8", marginBottom: 8 },
  h1: { fontSize: 31, color: "#0f1115", fontWeight: "800", letterSpacing: -0.5, marginBottom: 26 },
  sectionLbl: { fontSize: 12, color: "#4B5FE8", textTransform: "uppercase", letterSpacing: 1.6, fontWeight: "700", marginBottom: 10, marginTop: 8 },
  emptyRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderStyle: "dashed", borderRadius: 16, padding: 15, marginBottom: 18 },
  emptyTxt: { color: "rgba(15,17,21,0.6)", fontSize: 13.5 },
  eventCard: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", borderLeftWidth: 3, borderRadius: 16, padding: 13, marginBottom: 9 },
  dateBlock: { width: 44, alignItems: "center" },
  dateDay: { fontSize: 22, fontWeight: "800", color: "#0f1115", lineHeight: 25 },
  dateMon: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: "rgba(15,17,21,0.55)", marginTop: 1 },
  eventTitle: { fontSize: 15.5, fontWeight: "600", color: "#0f1115" },
  eventSub: { fontSize: 12.5, color: "rgba(15,17,21,0.55)", marginTop: 2, textTransform: "capitalize" },
  countChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  countTxt: { fontSize: 11.5, fontWeight: "700", color: "rgba(15,17,21,0.55)" },
  classCard: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", borderRadius: 16, padding: 14, marginBottom: 9 },
  classIc: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(75,95,232,0.1)", borderWidth: 1, borderColor: "rgba(75,95,232,0.2)", alignItems: "center", justifyContent: "center" },
  classIcTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },
  className: { fontSize: 16, color: "#0f1115", fontWeight: "600" },
  noteRow: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", borderRadius: 14, padding: 13, marginBottom: 8 },
  noteName: { flex: 1, fontSize: 14.5, color: "#0f1115", fontWeight: "500" },
});
