import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Linking, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from "date-fns";
import { useState } from "react";
import useSWR from "swr";
import { useApi, makeApiFetcher } from "../../lib/api";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(new Date());
  const { userId } = useAuth();
  const api = useApi();
  const fetcher = makeApiFetcher(userId);
  const { data } = useSWR(
    `/api/calendar/sessions?from=${startOfMonth(month).toISOString()}&to=${endOfMonth(month).toISOString()}`,
    fetcher
  );

  const sessions = data?.data ?? [];
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const startDay = startOfMonth(month).getDay();

  async function connectGoogle() {
    const res = await api.get("/api/calendar/auth-url");
    await Linking.openURL(res.data.data.url);
  }

  return (
    <>
      <StatusBar barStyle="light-content" />
      <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 16 }]}>
        <View style={s.topbar}>
          <Text style={s.title}>Schedule</Text>
          <TouchableOpacity style={s.connectBtn} onPress={connectGoogle}>
            <Ionicons name="logo-google" size={12} color="#fff" />
            <Text style={s.connectTxt}>Google</Text>
          </TouchableOpacity>
        </View>

        <View style={s.calCard}>
          <View style={s.calHead}>
            <TouchableOpacity onPress={() => setMonth(subMonths(month, 1))} style={s.navBtn}>
              <Ionicons name="chevron-back" size={16} color="#555" />
            </TouchableOpacity>
            <Text style={s.calMonth}>{format(month, "MMMM yyyy")}</Text>
            <TouchableOpacity onPress={() => setMonth(addMonths(month, 1))} style={s.navBtn}>
              <Ionicons name="chevron-forward" size={16} color="#555" />
            </TouchableOpacity>
          </View>
          <View style={s.grid}>
            {["S","M","T","W","T","F","S"].map((d, i) => (
              <Text key={i} style={s.dayLbl}>{d}</Text>
            ))}
            {Array.from({ length: startDay }).map((_, i) => <View key={`e${i}`} style={s.dayCell} />)}
            {days.map((day) => {
              const hasEv = sessions.some((ev: any) => isSameDay(new Date(ev.scheduledAt), day));
              return (
                <View key={day.toISOString()} style={[s.dayCell, isToday(day) && s.dayCellToday]}>
                  <Text style={[s.dayTxt, isToday(day) && s.dayTxtToday]}>{format(day, "d")}</Text>
                  {hasEv && !isToday(day) && <View style={s.evDot} />}
                </View>
              );
            })}
          </View>
        </View>

        <Text style={s.sectionLbl}>Today · {format(new Date(), "MMM d")}</Text>
        {!sessions.length && (
          <Text style={s.empty}>No sessions. Process a lecture to auto-schedule reviews.</Text>
        )}
        {sessions.map((ev: any) => (
          <View key={ev.id} style={s.evRow}>
            <Text style={s.evTime}>{format(new Date(ev.scheduledAt), "h'a'")}</Text>
            <View style={s.evBar} />
            <View style={s.evBody}>
              <Text style={s.evTitle} numberOfLines={1}>{ev.lecture?.title}</Text>
              <Text style={s.evSub}>{ev.type} · {ev.lecture?.course?.code}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  content: { paddingHorizontal: 16, paddingBottom: 110 },
  topbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 32, color: "#fff", fontStyle: "italic", fontWeight: "300" },
  connectBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 0.5, borderColor: "#333", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  connectTxt: { fontSize: 11, color: "#fff" },
  calCard: { backgroundColor: "#111", borderRadius: 20, padding: 16, borderWidth: 0.5, borderColor: "#1e1e1e", marginBottom: 20 },
  calHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  navBtn: { padding: 4 },
  calMonth: { fontSize: 13, color: "#fff", fontWeight: "500" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayLbl: { width: "14.28%", textAlign: "center", fontSize: 9, color: "#333", paddingVertical: 3 },
  dayCell: { width: "14.28%", alignItems: "center", paddingVertical: 5 },
  dayCellToday: { backgroundColor: "#fff", borderRadius: 999 },
  dayTxt: { fontSize: 11, color: "#555" },
  dayTxtToday: { color: "#000", fontWeight: "600" },
  evDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#fff", marginTop: 1 },
  sectionLbl: { fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontWeight: "600" },
  empty: { fontSize: 13, color: "#444" },
  evRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 10 },
  evTime: { fontSize: 10, color: "#333", width: 28, textAlign: "right", paddingTop: 4 },
  evBar: { width: 1.5, backgroundColor: "#fff", alignSelf: "stretch", borderRadius: 1 },
  evBody: { flex: 1, backgroundColor: "#111", borderRadius: 10, padding: 10, borderWidth: 0.5, borderColor: "#1e1e1e" },
  evTitle: { fontSize: 11, color: "#ddd", fontWeight: "500" },
  evSub: { fontSize: 9, color: "#444", marginTop: 2, textTransform: "capitalize" },
});
