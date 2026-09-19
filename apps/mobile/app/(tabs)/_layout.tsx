import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { recordingSession, useRecordingSession } from "../../lib/recordingSession";
import { useTr } from "../../lib/useTr";

const clock = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

/** A lecture in progress, shown above the tab bar on every screen but its own Record tab. */
function RecordingBar({ bottom, onOpen }: { bottom: number; onOpen: (courseId: string) => void }) {
  const tr = useTr();
  const session = useRecordingSession();
  if (!session || session.onScreen) return null;
  const color = session.course.color || "#4B5FE8";
  const live = session.status === "recording";
  return (
    <View
      accessibilityRole="summary"
      style={{
        position: "absolute", left: 16, right: 16, bottom,
        flexDirection: "row", alignItems: "center", gap: 10,
        backgroundColor: "#0f1115", borderRadius: 18, paddingLeft: 14, paddingRight: 6, paddingVertical: 8,
        shadowColor: "#0f1115", shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8,
      }}
    >
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: live ? "#EF4444" : color }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }} numberOfLines={1}>{session.course.name}</Text>
        <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 13 }} numberOfLines={1}>
          {session.status === "saved" ? tr("Stopped — not processed yet") : `${live ? tr("Recording") : tr("Paused")} · ${clock(session.seconds)}`}
        </Text>
      </View>
      {session.status !== "saved" && (
        <TouchableOpacity
          onPress={() => (live ? recordingSession.pause() : recordingSession.resume())}
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }}
          accessibilityLabel={live ? tr("Pause recording") : tr("Resume recording")}
          activeOpacity={0.7}
        >
          <Ionicons name={live ? "pause" : "play"} size={20} color="#fff" />
        </TouchableOpacity>
      )}
      <TouchableOpacity
        onPress={() => onOpen(session.course.id)}
        style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: color, borderRadius: 999, paddingLeft: 14, paddingRight: 10, paddingVertical: 9 }}
        activeOpacity={0.85}
      >
        <Text style={{ color: "#fff", fontSize: 14.5, fontWeight: "700" }}>{tr("Open")}</Text>
        <Ionicons name="chevron-forward" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const CENTER_TAB = "record";

function TabBar({ state, navigation }: any) {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const openRecording = (courseId: string) => {
    navigation.navigate("record");
    // Let the Workspace tab come forward, then bring the class and its Record tab up.
    setTimeout(() => recordingSession.requestOpen(courseId), 0);
  };
  const tabs: Record<string, { on: any; off: any; label: string }> = {
    index:    { on: "home",     off: "home-outline",     label: tr("Home")      },
    record:   { on: "layers",   off: "layers-outline",   label: tr("Workspace") },
    calendar: { on: "calendar", off: "calendar-outline", label: tr("Calendar")  },
    archive:  { on: "archive",  off: "archive-outline",  label: tr("Archive")   },
    account:  { on: "person",   off: "person-outline",   label: tr("Account")   },
  };

  return (
    <>
    <RecordingBar bottom={insets.bottom + 92} onOpen={openRecording} />
    <View style={{
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      backgroundColor: "rgba(255,255,255,0.97)",
      borderTopWidth: 0.5,
      borderTopColor: "rgba(0,0,0,0.08)",
      paddingTop: 12,
      paddingBottom: insets.bottom + 10,
      paddingHorizontal: 8,
      justifyContent: "space-around",
      alignItems: "flex-start",
    }}>
      {state.routes.map((route: any, i: number) => {
        const t = tabs[route.name];
        if (!t) return null;
        const focused = state.index === i;
        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!event.defaultPrevented) navigation.navigate(route.name);
        };

        if (route.name === CENTER_TAB) {
          return (
            <TouchableOpacity
              key={route.key}
              style={{ flex: 1, alignItems: "center" }}
              activeOpacity={0.85}
              onPress={onPress}
            >
              <View style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                marginTop: -31,
                backgroundColor: focused ? "#4B5FE8" : "#6E7FF3",
                borderWidth: 4,
                borderColor: "#FFFFFF",
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#4B5FE8",
                shadowOpacity: 0.4,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 5 },
                elevation: 6,
              }}>
                <Ionicons name={focused ? t.on : t.off} size={28} color="#FFFFFF" />
              </View>
              <Text style={{
                fontSize: 12,
                fontWeight: "700",
                color: focused ? "#4B5FE8" : "rgba(15,17,21,0.55)",
                marginTop: 5,
              }}>{t.label}</Text>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={route.key}
            style={{ flex: 1, alignItems: "center", gap: 5, paddingVertical: 4 }}
            activeOpacity={0.7}
            onPress={onPress}
          >
            <Ionicons name={focused ? t.on : t.off} size={25} color={focused ? "#4B5FE8" : "rgba(15,17,21,0.55)"} />
            <Text style={{ fontSize: 11, fontWeight: "600", color: focused ? "#4B5FE8" : "rgba(15,17,21,0.55)" }}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
    </>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"    />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="record"   />
      <Tabs.Screen name="archive"  />
      <Tabs.Screen name="account"  />
    </Tabs>
  );
}
