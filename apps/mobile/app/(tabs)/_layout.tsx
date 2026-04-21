import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "#000", borderTopColor: "#1a1a1a", borderTopWidth: 0.5 },
        tabBarActiveTintColor: "#fff",
        tabBarInactiveTintColor: "#444",
        tabBarLabelStyle: { fontFamily: "sans-serif", fontSize: 10 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={18} color={color} /> }} />
      <Tabs.Screen name="record" options={{ title: "Record", tabBarIcon: ({ color }) => <Ionicons name="mic-outline" size={18} color={color} /> }} />
      <Tabs.Screen name="summaries" options={{ title: "Summary", tabBarIcon: ({ color }) => <Ionicons name="document-text-outline" size={18} color={color} /> }} />
      <Tabs.Screen name="calendar" options={{ title: "Calendar", tabBarIcon: ({ color }) => <Ionicons name="calendar-outline" size={18} color={color} /> }} />
      <Tabs.Screen name="quizzes" options={{ title: "Quiz", tabBarIcon: ({ color }) => <Ionicons name="book-outline" size={18} color={color} /> }} />
      <Tabs.Screen name="progress" options={{ title: "Progress", tabBarIcon: ({ color }) => <Ionicons name="bar-chart-outline" size={18} color={color} /> }} />
    </Tabs>
  );
}
