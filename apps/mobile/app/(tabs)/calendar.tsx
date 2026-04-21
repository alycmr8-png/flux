import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from "date-fns";
import { useState } from "react";
import useSWR from "swr";
import { api } from "../../lib/api";

const fetcher = (url: string) => api.get(url).then((r) => r.data);

export default function CalendarScreen() {
  const [month, setMonth] = useState(new Date());
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
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.topbar}>
        <Text style={s.title}>Schedule</Text>
        <TouchableOpacity style={s.connectBtn} onPress={connectGoogle}>
          <Text style={s.connectTxt}>+ Google</Text>
        </TouchableOpacity>
      </View>

      <View style={s.calCard}>
        <View style={s.calHead}>
          <TouchableOpacity onPress={() => setMonth(subMonths(month, 1))}>
            <Text style={s.navArrow}>←</Text>
          </TouchableOpacity>
          <Text style={s.calMonth}>{format(month, "MMMM yyyy")}</Text>
          <TouchableOpacity onPress={() => setMonth(addMonths(month, 1))}>
            <Text style={s.navArrow}>→</Text>
          </TouchableOpacity>
        </View>
        <View style={s.grid}>
          {["S","M","T","W","T","F","S"].map((d, i) => (
            <Text key={i} style={s.dayLbl}>{d}</Text>
          ))}
          {Array.from({ length: startDay }).map((_, i) => <View key={`e${i}`} style={s.dayCell} />)}
          {days.map((day) => {
            const hasEv = sessions.some((s: any) => isSameDay(new Date(s.scheduledAt), day));
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
      {!sessions.length && <Text style={s.empty}>No sessions. Process a lecture to auto-schedule reviews.</Text>}
      {sessions.map((s: any) => (
        <View key={s.id} style={s2.evRow}>
          <Text style={s2.evTime}>{format(new Date(s.scheduledAt), "h'a'")}</Text>
          <View style={s2.evBar} />
          <View style={s2.evBody}>
            <Text style={s2.evTitle} numberOfLines={1}>{s.lecture?.title}</Text>
            <Text style={s2.evSub}>{s.type} · {s.lecture?.course?.code}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  content: { padding: 18, paddingBottom: 40 },
  topbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16, marginBottom: 4 },
  title: { fontFamily: "serif", fontSize: 28, color: "#fff" },
  connectBtn: { borderWidth: 0.5, borderColor: "#333", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  connectTxt: { fontFamily: "sans-serif", fontSize: 11, color: "#fff" },
  calCard: { backgroundColor: "#111", borderRadius: 18, padding: 16, borderWidth: 0.5, borderColor: "#1e1e1e", marginTop: 16, marginBottom: 16 },
  calHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  navArrow: { fontFamily: "sans-serif", fontSize: 16, color: "#555", paddingHorizontal: 4 },
  calMonth: { fontFamily: "sans-serif-medium", fontSize: 13, color: "#fff" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayLbl: { width: "14.28%", textAlign: "center", fontFamily: "sans-serif", fontSize: 9, color: "#333", paddingVertical: 3 },
  dayCell: { width: "14.28%", alignItems: "center", paddingVertical: 5, position: "relative" },
  dayCellToday: { backgroundColor: "#fff", borderRadius: 999 },
  dayTxt: { fontFamily: "sans-serif", fontSize: 11, color: "#555" },
  dayTxtToday: { color: "#000", fontFamily: "sans-serif-medium" },
  evDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#fff", marginTop: 1 },
  sectionLbl: { fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, fontFamily: "sans-serif-medium" },
  empty: { fontFamily: "sans-serif", fontSize: 13, color: "#444" },
});

const s2 = StyleSheet.create({
  evRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 10 },
  evTime: { fontFamily: "sans-serif", fontSize: 10, color: "#333", width: 28, textAlign: "right", paddingTop: 4 },
  evBar: { width: 1.5, backgroundColor: "#fff", alignSelf: "stretch", borderRadius: 1 },
  evBody: { flex: 1, backgroundColor: "#111", borderRadius: 10, padding: 10, borderWidth: 0.5, borderColor: "#1e1e1e" },
  evTitle: { fontFamily: "sans-serif-medium", fontSize: 11, color: "#ddd" },
  evSub: { fontFamily: "sans-serif", fontSize: 9, color: "#444", marginTop: 2, textTransform: "capitalize" },
});
