import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function TabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const icons: Record<string, any> = {
    index:     { on: "home",          off: "home-outline"          },
    record:    { on: "layers",        off: "layers-outline"        },
    summaries: { on: "document-text", off: "document-text-outline" },
    tutor:     { on: "school",        off: "school-outline"        },
    progress:  { on: "bar-chart",     off: "bar-chart-outline"     },
  };

  return (
    <View style={{
      position: "absolute",
      bottom: insets.bottom + 12,
      left: 20,
      right: 20,
      flexDirection: "row",
      backgroundColor: "#111",
      borderRadius: 28,
      borderWidth: 0.5,
      borderColor: "#1e1e1e",
      paddingVertical: 10,
      paddingHorizontal: 8,
      justifyContent: "space-around",
      alignItems: "center",
    }}>
      {state.routes.map((route: any, i: number) => {
        const focused = state.index === i;
        const ic = icons[route.name] ?? { on: "ellipse", off: "ellipse-outline" };
        return (
          <View
            key={route.key}
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: 4,
              borderRadius: 20,
              backgroundColor: focused ? "#fff" : "transparent",
            }}
          >
            <Ionicons
              name={focused ? ic.on : ic.off}
              size={20}
              color={focused ? "#000" : "#555"}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!event.defaultPrevented) navigation.navigate(route.name);
              }}
            />
          </View>
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
      <Tabs.Screen name="index"     />
      <Tabs.Screen name="record"    />
      <Tabs.Screen name="summaries" />
      <Tabs.Screen name="tutor"     />
      <Tabs.Screen name="progress"  />
      <Tabs.Screen name="quizzes"   options={{ href: null }} />
    </Tabs>
  );
}
