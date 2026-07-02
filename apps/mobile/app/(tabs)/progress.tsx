import { useState } from "react";
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput, StatusBar, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useSWR from "swr";
import { makeApiFetcher, useApi } from "../../lib/api";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";

function LectureRow({ lecture, onRename }: { lecture: any; onRename: (id: string, title: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(lecture.title);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!val.trim() || val === lecture.title) { setEditing(false); return; }
    setSaving(true);
    await onRename(lecture.id, val.trim());
    setSaving(false);
    setEditing(false);
  }

  return (
    <View style={s.lectureRow}>
      <View style={{ flex: 1, marginRight: 8 }}>
        {editing ? (
          <TextInput
            autoFocus
            value={val}
            onChangeText={setVal}
            onSubmitEditing={save}
            onBlur={() => setEditing(false)}
            style={s.renameInput}
            returnKeyType="done"
          />
        ) : (
          <Text style={s.lectureTitle} numberOfLines={1}>{lecture.title}</Text>
        )}
        <Text style={s.lectureSub}>{lecture.status}</Text>
      </View>
      {editing ? (
        <View style={{ flexDirection: "row", gap: 6 }}>
          <TouchableOpacity onPress={save} disabled={saving}>
            <Ionicons name="checkmark" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setEditing(false); setVal(lecture.title); }}>
            <Ionicons name="close" size={16} color="#444" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={() => setEditing(true)}>
          <Ionicons name="pencil-outline" size={14} color="#333" />
        </TouchableOpacity>
      )}
    </View>
  );
}

function ClassSection({ cls, onRename }: { cls: any; onRename: (id: string, title: string) => Promise<void> }) {
  const [open, setOpen] = useState(true);

  return (
    <View style={s.classCard}>
      <TouchableOpacity style={s.classHeader} onPress={() => setOpen(!open)} activeOpacity={0.7}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name={open ? "chevron-down" : "chevron-forward"} size={12} color="#444" />
          <Text style={s.className}>{cls.name}</Text>
          <View style={s.badge}><Text style={s.badgeTxt}>{cls.lectures.length}</Text></View>
        </View>
        <Text style={s.classCode}>{cls.code}</Text>
      </TouchableOpacity>

      {open && (
        <View style={s.lectureList}>
          {cls.lectures.length === 0 ? (
            <Text style={s.empty}>No recordings yet.</Text>
          ) : (
            cls.lectures.map((l: any) => (
              <LectureRow key={l.id} lecture={l} onRename={onRename} />
            ))
          )}
        </View>
      )}
    </View>
  );
}

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const { getToken, signOut } = useAuth();
  const api = useApi();
  const fetcher = makeApiFetcher(getToken);
  const { data, isLoading, mutate } = useSWR("/api/progress", fetcher);
  const p = data?.data;

  async function handleRename(id: string, title: string) {
    try {
      await api.patch(`/api/lectures/${id}`, { title });
      await mutate();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not rename");
    }
  }

  return (
    <>
      <StatusBar barStyle="light-content" />
      <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 16 }]}>
        <Text style={s.title}>Progress</Text>
        <Text style={s.sub}>This semester</Text>

        {/* Stats */}
        <View style={s.statsRow}>
          {[
            { val: isLoading ? "—" : String(p?.lectureCount ?? 0), lbl: "Lectures" },
            { val: isLoading ? "—" : p?.avgScore ? `${p.avgScore}%` : "—", lbl: "Avg score" },
            { val: isLoading ? "—" : String(p?.streak ?? 0), lbl: "Streak" },
          ].map((sc) => (
            <View key={sc.lbl} style={s.statCard}>
              <Text style={s.statNum}>{sc.val}</Text>
              <Text style={s.statLbl}>{sc.lbl}</Text>
            </View>
          ))}
        </View>

        {/* Lectures by class */}
        <Text style={s.sectionLbl}>Recordings by class</Text>
        {isLoading && <Text style={s.empty}>Loading…</Text>}
        {!isLoading && !p?.lecturesByClass?.length && (
          <Text style={s.empty}>No classes yet. Create one in the Workspace tab.</Text>
        )}
        {p?.lecturesByClass?.map((cls: any) => (
          <ClassSection key={cls.id} cls={cls} onRename={handleRename} />
        ))}

        {/* Retention */}
        {p?.courseRetention?.length > 0 && (
          <>
            <Text style={[s.sectionLbl, { marginTop: 24 }]}>Retention by course</Text>
            <View style={s.retCard}>
              {p.courseRetention.map((c: any) => (
                <View key={c.code} style={s.retItem}>
                  <View style={s.retHead}>
                    <Text style={s.retCourse}>{c.code} — {c.name}</Text>
                    <Text style={s.retPct}>{c.avg}%</Text>
                  </View>
                  <View style={s.barBg}>
                    <View style={[s.barFill, { width: `${c.avg}%` as any }]} />
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Sign out */}
        <TouchableOpacity
          style={s.signOutBtn}
          onPress={() => Alert.alert("Sign out", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign out", style: "destructive", onPress: () => signOut() },
          ])}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={14} color="#444" />
          <Text style={s.signOutTxt}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  content: { paddingHorizontal: 16, paddingBottom: 110 },
  title: { fontSize: 32, color: "#fff", fontStyle: "italic", fontWeight: "300", marginBottom: 4 },
  sub: { fontSize: 12, color: "#444", marginBottom: 20 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: "#111", borderRadius: 20, padding: 14, alignItems: "center", borderWidth: 0.5, borderColor: "#1e1e1e" },
  statNum: { fontSize: 28, color: "#fff", fontWeight: "200", marginBottom: 2 },
  statLbl: { fontSize: 9, color: "#444", letterSpacing: 0.5, textAlign: "center" },
  sectionLbl: { fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: 2, marginBottom: 10, fontWeight: "600" },
  classCard: { backgroundColor: "#111", borderRadius: 18, borderWidth: 0.5, borderColor: "#1e1e1e", marginBottom: 8, overflow: "hidden" },
  classHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  className: { fontSize: 13, color: "#fff", fontWeight: "500" },
  classCode: { fontSize: 10, color: "#333" },
  badge: { backgroundColor: "#1a1a1a", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  badgeTxt: { fontSize: 9, color: "#444" },
  lectureList: { borderTopWidth: 0.5, borderTopColor: "#1a1a1a", paddingHorizontal: 14, paddingBottom: 8 },
  lectureRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: "#0f0f0f" },
  lectureTitle: { fontSize: 12, color: "#888" },
  lectureSub: { fontSize: 10, color: "#333", marginTop: 1, textTransform: "capitalize" },
  renameInput: { fontSize: 12, color: "#fff", borderBottomWidth: 0.5, borderBottomColor: "#333", paddingVertical: 2 },
  empty: { fontSize: 12, color: "#333", paddingVertical: 8 },
  retCard: { backgroundColor: "#111", borderRadius: 18, padding: 16, borderWidth: 0.5, borderColor: "#1e1e1e" },
  retItem: { marginBottom: 14 },
  retHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  retCourse: { fontSize: 11, color: "#666" },
  retPct: { fontSize: 11, color: "#fff", fontWeight: "600" },
  barBg: { height: 2, backgroundColor: "#1a1a1a", borderRadius: 1 },
  barFill: { height: 2, backgroundColor: "#fff", borderRadius: 1 },
  signOutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 32, paddingVertical: 12 },
  signOutTxt: { fontSize: 12, color: "#444" },
});
