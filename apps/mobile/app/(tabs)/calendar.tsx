import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Linking, StatusBar, TextInput, Alert, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay,
  eachDayOfInterval, isSameDay, isToday,
  addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
} from "date-fns";
import { useState, useEffect } from "react";
import useSWR from "swr";
import { useApi, makeApiFetcher } from "../../lib/api";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { syncEventReminders } from "../../lib/eventReminders";
import { useTr } from "../../lib/useTr";

type CalView = "day" | "week" | "month";
const VIEWS: CalView[] = ["day", "week", "month"];

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const HOUR_H = 52;          // row height in the week grid
const FIRST_VISIBLE_HOUR = 7; // the grid opens on the morning, not midnight

const EVENT_TYPES = ["exam", "assignment", "deadline", "quiz", "class", "other"] as const;
const TYPE_COLOR: Record<string, string> = {
  exam: "#EF4444", assignment: "#F97316", deadline: "#EAB308",
  quiz: "#A855F7", class: "#3B82F6", other: "#6B7280",
};

export default function CalendarScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<CalView>("week");
  const [anchor, setAnchor] = useState(new Date());
  const [selected, setSelected] = useState(new Date());
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<string>("exam");
  const [newHour, setNewHour] = useState(9);
  const [saving, setSaving] = useState(false);
  const { getToken } = useAuth();
  const api = useApi();
  const fetcher = makeApiFetcher(getToken);

  // Fetch exactly the span on screen so each view stays cheap.
  const range =
    view === "day"   ? { from: startOfDay(anchor),   to: endOfDay(anchor) } :
    view === "week"  ? { from: startOfWeek(anchor),  to: endOfWeek(anchor) } :
                       { from: startOfMonth(anchor), to: endOfMonth(anchor) };

  const { data } = useSWR(
    `/api/calendar/sessions?from=${range.from.toISOString()}&to=${range.to.toISOString()}`,
    fetcher
  );
  const sessions: any[] = data?.data ?? [];

  const { data: eventsData, mutate: mutateEvents } = useSWR(
    `/api/events?from=${range.from.toISOString()}&to=${range.to.toISOString()}`,
    fetcher
  );
  const events: any[] = eventsData?.data ?? [];

  // Events come back per visible range, so reminders are reconciled whenever
  // that set changes — creating, deleting or browsing all keep them accurate.
  useEffect(() => {
    if (!eventsData?.data) return;
    syncEventReminders(eventsData.data, { from: range.from, to: range.to }).catch(() => {});
  }, [eventsData]);

  // Reviews Flux schedules and events the student adds share the day list.
  const itemsOn = (d: Date) => [
    ...sessions.filter((ev) => isSameDay(new Date(ev.scheduledAt), d))
      .map((ev) => ({ kind: "session" as const, id: ev.id, at: new Date(ev.scheduledAt), title: ev.lecture?.title ?? tr("Study session"), sub: ev.type, course: ev.lecture?.course?.name })),
    ...events.filter((ev) => isSameDay(new Date(ev.date), d))
      .map((ev) => ({ kind: "event" as const, id: ev.id, at: new Date(ev.date), title: ev.title, sub: ev.type, course: ev.course?.name })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  const eventsOn = itemsOn;

  function step(dir: 1 | -1) {
    if (view === "day")   return setAnchor(dir > 0 ? addDays(anchor, 1)   : subDays(anchor, 1));
    if (view === "week")  return setAnchor(dir > 0 ? addWeeks(anchor, 1)  : subWeeks(anchor, 1));
    setAnchor(dir > 0 ? addMonths(anchor, 1) : subMonths(anchor, 1));
  }

  // Tapping an empty slot in the week grid starts an event at that day and hour.
  function openSlot(day: Date, hour: number) {
    setSelected(day);
    setNewHour(hour);
    setAdding(true);
  }

  async function addEvent() {
    if (!newTitle.trim() || saving) return;
    setSaving(true);
    try {
      // Schedule at 9am local on the chosen day — a date without a time reads oddly in a list.
      const when = new Date(listDate);
      when.setHours(newHour, 0, 0, 0);
      await api.post("/api/events", { title: newTitle.trim(), date: when.toISOString(), type: newType });
      await mutateEvents();
      setNewTitle("");
      setAdding(false);
    } catch (e: any) {
      Alert.alert(tr("Couldn't schedule"), e?.response?.data?.error ?? e?.message ?? tr("Try again."));
    } finally {
      setSaving(false);
    }
  }

  function removeEvent(id: string, title: string) {
    Alert.alert(tr("Delete event?"), `"${title}" will be removed from your schedule.`, [
      { text: tr("Cancel"), style: "cancel" },
      {
        text: tr("Delete"), style: "destructive",
        onPress: async () => {
          try { await api.delete(`/api/events/${id}`); await mutateEvents(); }
          catch (e: any) { Alert.alert(tr("Couldn't delete"), e?.message ?? tr("Try again.")); }
        },
      },
    ]);
  }

  async function connectGoogle() {
    const res = await api.get("/api/calendar/auth-url");
    await Linking.openURL(res.data.data.url);
  }

  const monthDays = eachDayOfInterval({ start: startOfMonth(anchor), end: endOfMonth(anchor) });
  const weekDays = eachDayOfInterval({ start: startOfWeek(anchor), end: endOfWeek(anchor) });
  const headerLabel =
    view === "day"  ? format(anchor, "EEEE d MMMM") :
    view === "week" ? `${format(startOfWeek(anchor), "d MMM")} – ${format(endOfWeek(anchor), "d MMM")}` :
                      format(anchor, "MMMM yyyy");

  // Day and week focus one date; month lists whatever day you tap.
  const listDate = view === "day" ? anchor : selected;
  const listEvents = eventsOn(listDate);

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 16 }]}>
        <View style={s.topbar}>
          <Text style={s.title}>{tr("Schedule")}</Text>
          <TouchableOpacity style={s.connectBtn} onPress={connectGoogle} activeOpacity={0.7}>
            <Ionicons name="logo-google" size={14} color="#0f1115" />
            <Text style={s.connectTxt}>{tr("Google")}</Text>
          </TouchableOpacity>
        </View>

        {/* Day / Week / Month */}
        <View style={s.segment}>
          {VIEWS.map((v) => (
            <TouchableOpacity
              key={v}
              onPress={() => { setView(v); if (v !== "month") setSelected(anchor); }}
              style={[s.segBtn, view === v && s.segBtnOn]}
              activeOpacity={0.8}
            >
              <Text style={[s.segTxt, view === v && s.segTxtOn]}>
                {v === "day" ? "Day" : v === "week" ? tr("Week") : "Month"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.calCard}>
          <View style={s.calHead}>
            <TouchableOpacity onPress={() => step(-1)} style={s.navBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color="rgba(15,17,21,0.55)" />
            </TouchableOpacity>
            <Text style={s.calLabel}>{headerLabel}</Text>
            <TouchableOpacity onPress={() => step(1)} style={s.navBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={20} color="rgba(15,17,21,0.55)" />
            </TouchableOpacity>
          </View>

          {view === "month" && (
            <View style={s.grid}>
              {["S","M","T","W","T","F","S"].map((d, i) => (
                <Text key={i} style={s.dayLbl}>{d}</Text>
              ))}
              {Array.from({ length: startOfMonth(anchor).getDay() }).map((_, i) => (
                <View key={`pad${i}`} style={s.dayCell} />
              ))}
              {monthDays.map((day) => {
                const isSel = isSameDay(day, selected);
                const count = eventsOn(day).length;
                return (
                  <TouchableOpacity
                    key={day.toISOString()}
                    style={s.dayCell}
                    onPress={() => setSelected(day)}
                    activeOpacity={0.7}
                  >
                    <View style={[s.dayPill, isToday(day) && s.dayPillToday, isSel && !isToday(day) && s.dayPillSel]}>
                      <Text style={[s.dayTxt, isToday(day) && s.dayTxtToday, isSel && !isToday(day) && s.dayTxtSel]}>
                        {format(day, "d")}
                      </Text>
                    </View>
                    <View style={s.dotRow}>
                      {count > 0 && Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                        <View key={i} style={[s.evDot, isToday(day) && { backgroundColor: "#4B5FE8" }]} />
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {view === "week" && (
            <View>
              <View style={s.wkHeadRow}>
                <View style={s.wkGutter} />
                {weekDays.map((day) => {
                  const isSel = isSameDay(day, selected);
                  return (
                    <TouchableOpacity
                      key={day.toISOString()}
                      style={s.wkHeadCell}
                      onPress={() => setSelected(day)}
                      activeOpacity={0.7}
                    >
                      <Text style={s.wkHeadDow}>{format(day, "EEEEE")}</Text>
                      <View style={[s.wkHeadNum, isToday(day) && s.wkHeadNumToday, isSel && !isToday(day) && s.wkHeadNumSel]}>
                        <Text style={[s.wkHeadNumTxt, isToday(day) && { color: "#fff" }, isSel && !isToday(day) && { color: "#4B5FE8" }]}>
                          {format(day, "d")}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <ScrollView
                style={s.wkScroll}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                contentOffset={{ x: 0, y: FIRST_VISIBLE_HOUR * HOUR_H }}
              >
                {HOURS.map((h) => (
                  <View key={h} style={s.wkHourRow}>
                    <View style={s.wkGutter}>
                      <Text style={s.wkHourTxt}>
                        {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
                      </Text>
                    </View>
                    {weekDays.map((day) => {
                      const slotItems = itemsOn(day).filter((it) => it.at.getHours() === h);
                      return (
                        <TouchableOpacity
                          key={day.toISOString() + h}
                          style={[s.wkCell, isToday(day) && s.wkCellToday]}
                          onPress={() => openSlot(day, h)}
                          activeOpacity={0.6}
                        >
                          {slotItems.map((it) => (
                            <View
                              key={`${it.kind}-${it.id}`}
                              style={[s.wkChip, { backgroundColor: it.kind === "event" ? (TYPE_COLOR[it.sub] ?? "#6B7280") : "#4B5FE8" }]}
                            >
                              <Text style={s.wkChipTxt} numberOfLines={1}>{it.title}</Text>
                            </View>
                          ))}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
              <Text style={s.wkHintTxt}>{tr("Tap any slot to schedule something")}</Text>
            </View>
          )}

          {view === "day" && (
            <View style={s.dayHero}>
              <Text style={s.dayHeroNum}>{format(anchor, "d")}</Text>
              <View>
                <Text style={s.dayHeroDow}>{format(anchor, "EEEE")}</Text>
                <Text style={s.dayHeroSub}>
                  {listEvents.length
                    ? `${listEvents.length} session${listEvents.length === 1 ? "" : "s"}`
                    : tr("Nothing scheduled")}
                </Text>
              </View>
              {!isToday(anchor) && (
                <TouchableOpacity onPress={() => { setAnchor(new Date()); setSelected(new Date()); }} style={s.todayBtn} activeOpacity={0.7}>
                  <Text style={s.todayTxt}>{tr("Today")}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <View style={s.listHead}>
          <Text style={[s.sectionLbl, { marginBottom: 0 }]}>
            {isToday(listDate) ? tr("Today") : format(listDate, "EEEE")} · {format(listDate, "d MMM")}
          </Text>
          <TouchableOpacity
            style={[s.addBtn, adding && { backgroundColor: "rgba(15,17,21,0.08)" }]}
            onPress={() => setAdding(v => !v)}
            activeOpacity={0.8}
          >
            <Ionicons name={adding ? "close" : "add"} size={17} color={adding ? "#0f1115" : "#fff"} />
            <Text style={[s.addTxt, adding && { color: "#0f1115" }]}>{adding ? tr("Cancel") : tr("Schedule")}</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setAdding(false)} />
            <View style={s.sheet}>
              <View style={s.sheetGrip} />
              <Text style={s.sheetTitle}>
                {format(listDate, "EEEE d MMM")}
              </Text>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
              >

            <TextInput
              style={s.addInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder={tr("Exam, assignment, reading…")}
              placeholderTextColor="rgba(15,17,21,0.35)"
              returnKeyType="done"
              onSubmitEditing={addEvent}
            />
            <View style={s.typeRow}>
              {EVENT_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setNewType(t)}
                  style={[s.typeChip, newType === t && { backgroundColor: TYPE_COLOR[t], borderColor: TYPE_COLOR[t] }]}
                  activeOpacity={0.8}
                >
                  <Text style={[s.typeTxt, newType === t && { color: "#fff" }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.fieldLbl}>{tr("Time")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.hourRow}>
              {HOURS.map(h => (
                <TouchableOpacity
                  key={h}
                  onPress={() => setNewHour(h)}
                  style={[s.hourChip, newHour === h && s.hourChipOn]}
                  activeOpacity={0.8}
                >
                  <Text style={[s.hourChipTxt, newHour === h && { color: "#fff" }]}>
                    {h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[s.saveBtn, (!newTitle.trim() || saving) && { opacity: 0.4 }]}
              onPress={addEvent}
              disabled={!newTitle.trim() || saving}
              activeOpacity={0.85}
            >
              <Text style={s.saveTxt}>
                {saving
                  ? tr("Scheduling…")
                  : !newTitle.trim()
                  ? "Name it first"
                  : `Add to ${format(listDate, "d MMM")} · ${newHour === 0 ? "12am" : newHour < 12 ? `${newHour}am` : newHour === 12 ? "12pm" : `${newHour - 12}pm`}`}
              </Text>
            </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {!listEvents.length ? (
          <Text style={s.empty}>
            {`Nothing on this day — tap Schedule to add an exam, assignment or deadline.`}
          </Text>
        ) : (
          listEvents.map((it) => (
            <View key={`${it.kind}-${it.id}`} style={s.evRow}>
              <Text style={s.evTime}>{format(it.at, "h:mma").toLowerCase()}</Text>
              <View style={[s.evBar, { backgroundColor: it.kind === "event" ? (TYPE_COLOR[it.sub] ?? "#6B7280") : "#4B5FE8" }]} />
              <TouchableOpacity
                style={s.evBody}
                activeOpacity={it.kind === "event" ? 0.7 : 1}
                onLongPress={() => it.kind === "event" && removeEvent(it.id, it.title)}
                delayLongPress={450}
              >
                <Text style={s.evTitle} numberOfLines={2}>{it.title}</Text>
                <Text style={s.evSub}>
                  {it.kind === "session" ? "review" : it.sub}{it.course ? ` · ${it.course}` : ""}
                </Text>
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
  content: { paddingHorizontal: 16, paddingBottom: 132 },
  topbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 32, color: "#0f1115", fontStyle: "italic", fontWeight: "300" },
  connectBtn: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  connectTxt: { fontSize: 13, color: "#0f1115", fontWeight: "500" },

  segment: { flexDirection: "row", gap: 6, backgroundColor: "#FFFFFF", borderRadius: 24, padding: 5, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", marginBottom: 16 },
  segBtn: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 19 },
  segBtnOn: { backgroundColor: "#4B5FE8" },
  segTxt: { fontSize: 14.5, fontWeight: "600", color: "rgba(15,17,21,0.55)" },
  segTxtOn: { color: "#fff" },

  calCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", marginBottom: 22, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  calHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  navBtn: { padding: 6 },
  calLabel: { fontSize: 16, color: "#0f1115", fontWeight: "700" },

  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayLbl: { width: "14.28%", textAlign: "center", fontSize: 12, fontWeight: "700", color: "rgba(15,17,21,0.4)", paddingVertical: 6 },
  dayCell: { width: "14.28%", alignItems: "center", paddingVertical: 4 },
  dayPill: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  dayPillToday: { backgroundColor: "#4B5FE8" },
  dayPillSel: { borderWidth: 2, borderColor: "#4B5FE8" },
  dayTxt: { fontSize: 15.5, color: "rgba(15,17,21,0.75)" },
  dayTxtToday: { color: "#fff", fontWeight: "700" },
  dayTxtSel: { color: "#4B5FE8", fontWeight: "700" },
  dotRow: { flexDirection: "row", gap: 3, height: 8, alignItems: "center" },
  evDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#4B5FE8" },

  wkHeadRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.08)", paddingBottom: 8, marginBottom: 2 },
  wkGutter: { width: 34, alignItems: "flex-end", paddingRight: 6 },
  wkHeadCell: { flex: 1, alignItems: "center", gap: 4 },
  wkHeadDow: { fontSize: 11, fontWeight: "700", color: "rgba(15,17,21,0.4)" },
  wkHeadNum: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  wkHeadNumToday: { backgroundColor: "#4B5FE8" },
  wkHeadNumSel: { borderWidth: 2, borderColor: "#4B5FE8" },
  wkHeadNumTxt: { fontSize: 14.5, fontWeight: "700", color: "#0f1115" },
  wkScroll: { height: 420 },
  wkHourRow: { flexDirection: "row", height: HOUR_H, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)" },
  wkHourTxt: { fontSize: 10.5, color: "rgba(15,17,21,0.4)", fontWeight: "600", marginTop: -6 },
  wkCell: { flex: 1, borderLeftWidth: 1, borderLeftColor: "rgba(0,0,0,0.05)", paddingHorizontal: 2, paddingTop: 2, gap: 2 },
  wkCellToday: { backgroundColor: "rgba(75,95,232,0.04)" },
  wkChip: { borderRadius: 5, paddingHorizontal: 4, paddingVertical: 3 },
  wkChipTxt: { fontSize: 9.5, color: "#fff", fontWeight: "600" },
  wkHintTxt: { fontSize: 12, color: "rgba(15,17,21,0.4)", textAlign: "center", marginTop: 10 },

  dayHero: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 6 },
  dayHeroNum: { fontSize: 52, fontWeight: "200", color: "#0f1115", letterSpacing: -2 },
  dayHeroDow: { fontSize: 18, fontWeight: "700", color: "#0f1115" },
  dayHeroSub: { fontSize: 14, color: "rgba(15,17,21,0.55)", marginTop: 2 },
  todayBtn: { marginLeft: "auto", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  todayTxt: { fontSize: 13, fontWeight: "600", color: "#0f1115" },

  listHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#4B5FE8", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  addTxt: { fontSize: 13.5, color: "#fff", fontWeight: "600" },
  backdrop: { flex: 1, backgroundColor: "rgba(15,17,21,0.35)" },
  sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34, maxHeight: "85%" },
  sheetGrip: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(15,17,21,0.15)", alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: "#0f1115", marginBottom: 16 },
  addInput: { backgroundColor: "#FFFFFF", borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15, color: "#0f1115", borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  typeChip: { borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  typeTxt: { fontSize: 12.5, color: "rgba(15,17,21,0.65)", fontWeight: "600", textTransform: "capitalize" },
  fieldLbl: { fontSize: 11, fontWeight: "700", color: "rgba(15,17,21,0.45)", textTransform: "uppercase", letterSpacing: 1, marginTop: 14, marginBottom: 8 },
  hourRow: { gap: 7, paddingRight: 4 },
  hourChip: { borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  hourChipOn: { backgroundColor: "#4B5FE8", borderColor: "#4B5FE8" },
  hourChipTxt: { fontSize: 12.5, color: "rgba(15,17,21,0.65)", fontWeight: "600" },
  saveBtn: { backgroundColor: "#4B5FE8", borderRadius: 14, paddingVertical: 13, alignItems: "center", marginTop: 14 },
  saveTxt: { fontSize: 14.5, color: "#fff", fontWeight: "600" },
  sectionLbl: { fontSize: 12, color: "rgba(15,17,21,0.5)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12, fontWeight: "700" },
  empty: { fontSize: 14, color: "rgba(15,17,21,0.5)", lineHeight: 21 },
  evRow: { flexDirection: "row", gap: 12, alignItems: "stretch", marginBottom: 10 },
  evTime: { fontSize: 12.5, color: "rgba(15,17,21,0.5)", width: 58, textAlign: "right", paddingTop: 14, fontWeight: "600" },
  evBar: { width: 3, backgroundColor: "#4B5FE8", borderRadius: 2 },
  evBody: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" },
  evTitle: { fontSize: 14.5, color: "#0f1115", fontWeight: "600", lineHeight: 20 },
  evSub: { fontSize: 12.5, color: "rgba(15,17,21,0.55)", marginTop: 3, textTransform: "capitalize" },
});
