import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function TabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const tabs: Record<string, { on: any; off: any; label: string }> = {
    index:    { on: "home",     off: "home-outline",     label: "Home"      },
    record:   { on: "layers",   off: "layers-outline",   label: "Workspace" },
    calendar: { on: "calendar", off: "calendar-outline", label: "Calendar"  },
    archive:  { on: "archive",  off: "archive-outline",  label: "Archive"   },
    account:  { on: "person",   off: "person-outline",   label: "Account"   },
  };

  return (
    <View style={{
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      backgroundColor: "rgba(10,10,10,0.97)",
      borderTopWidth: 0.5,
      borderTopColor: "#1e1e1e",
      paddingTop: 10,
      paddingBottom: insets.bottom + 8,
      paddingHorizontal: 8,
      justifyContent: "space-around",
      alignItems: "center",
    }}>
      {state.routes.map((route: any, i: number) => {
        const t = tabs[route.name];
        if (!t) return null;
        const focused = state.index === i;
        return (
          <TouchableOpacity
            key={route.key}
            style={{ flex: 1, alignItems: "center", gap: 3, paddingVertical: 2 }}
            activeOpacity={0.7}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!event.defaultPrevented) navigation.navigate(route.name);
            }}
          >
            <Ionicons name={focused ? t.on : t.off} size={20} color={focused ? "#3B82F6" : "#555"} />
            <Text style={{ fontSize: 9, fontWeight: "600", color: focused ? "#3B82F6" : "#555" }}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"    />
      <Tabs.Screen name="record"   />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="archive"  />
      <Tabs.Screen name="account"  />
    </Tabs>
  );
}
