import { useRouter } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const FEATURES = [
  { icon: "mic-outline",           label: "Record Lectures",  desc: "One tap. Works offline. Auto-titles your lectures."      },
  { icon: "document-text-outline", label: "AI Cheat Sheets",  desc: "Summaries + quizzes generated while you walk home."     },
  { icon: "calendar-outline",      label: "Study Schedule",   desc: "Spaced repetition added to your calendar automatically." },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <>
      <StatusBar barStyle="light-content" />
      <ScrollView
        style={s.root}
        contentContainerStyle={[s.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title â€” centered, large italic like web */}
        <Text style={s.title}>Flux</Text>
        <Text style={s.tagline}>
          Record your lectures. AI generates cheat sheets, quizzes, and a study schedule â€” automatically.
        </Text>

        {/* Buttons */}
        <View style={s.buttons}>
          <TouchableOpacity style={s.btnPrimary} onPress={() => router.push("/(auth)/sign-up")} activeOpacity={0.85}>
            <Text style={s.btnPrimaryTxt}>Get started free</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnOutline} onPress={() => router.push("/(auth)/sign-in-email")} activeOpacity={0.85}>
            <Text style={s.btnOutlineTxt}>Sign in</Text>
          </TouchableOpacity>
        </View>

        {/* Feature cards â€” same style as web */}
        <View style={s.cards}>
          {FEATURES.map((f) => (
            <View key={f.label} style={s.card}>
              <View style={s.iconBox}>
                <Ionicons name={f.icon as any} size={14} color="#fff" />
              </View>
              <View style={s.cardText}>
                <Text style={s.cardTitle}>{f.label}</Text>
                <Text style={s.cardDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  content: { paddingHorizontal: 24, alignItems: "center" },
  title: { fontSize: 52, color: "#fff", fontStyle: "italic", fontWeight: "300", textAlign: "center", marginBottom: 12 },
  tagline: { fontSize: 14, color: "#555", textAlign: "center", lineHeight: 22, marginBottom: 32, maxWidth: 300 },
  buttons: { flexDirection: "row", gap: 10, marginBottom: 48, width: "100%" },
  btnPrimary: { flex: 1, backgroundColor: "#fff", borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  btnPrimaryTxt: { fontSize: 14, color: "#000", fontWeight: "600" },
  btnOutline: { flex: 1, borderWidth: 0.5, borderColor: "#333", borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  btnOutlineTxt: { fontSize: 14, color: "#fff", fontWeight: "500" },
  cards: { width: "100%", gap: 10 },
  card: { flexDirection: "row", alignItems: "flex-start", gap: 14, backgroundColor: "#111", borderRadius: 18, padding: 16, borderWidth: 0.5, borderColor: "#1e1e1e" },
  iconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#1a1a1a", borderWidth: 0.5, borderColor: "#222", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 13, color: "#fff", fontWeight: "500", marginBottom: 3 },
  cardDesc: { fontSize: 11, color: "#555", lineHeight: 17 },
});

