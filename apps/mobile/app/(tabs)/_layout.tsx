import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CENTER_TAB = "record";

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
