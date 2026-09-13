import { useRouter } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, Alert, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSSO } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { RecordingDemo, NotesDemo } from "../../components/FluxDemos";

// Required so the OAuth browser popup can hand the session back to the app
WebBrowser.maybeCompleteAuthSession();

const FEATURES = [
  { icon: "mic-outline",     label: "Record Lectures", desc: "One tap. Transcript, summary and key points when it ends."  },
  { icon: "create-outline",  label: "Take Notes",      desc: "Write your own notes, math symbols included."              },
  { icon: "sparkles-outline",label: "Ask Your Course", desc: "Answers from your lectures and notes — with sources."      },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { startSSOFlow } = useSSO();

  async function handleGoogle() {
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId) {
        await setActive!({ session: createdSessionId });
        router.replace("/(tabs)");
      } else {
        Alert.alert("Almost there", "Google didn't complete sign-in. Try again, or use email below.");
      }
    } catch (e: any) {
      const msg = e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? e?.message ?? "Unknown error";
      Alert.alert("Google sign-in failed", msg);
    }
  }

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={s.root}
        contentContainerStyle={[s.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Image source={require("../../assets/icon.png")} style={s.logo} />
        <Text style={s.tagline}>
          Record your lectures. Write your own notes. Ask your course anything — answered from both.
        </Text>

        <Text style={s.demoLbl}>Record a lecture</Text>
        <RecordingDemo />

        <Text style={s.demoLbl}>Your notes, same class</Text>
        <NotesDemo />

        {/* Sign in */}
        <View style={s.buttons}>
          <TouchableOpacity onPress={handleGoogle} activeOpacity={0.85} style={s.btnPrimaryWrap}>
            <LinearGradient
              colors={["#4B5FE8", "#6E7FF3"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.btnPrimary}
            >
              <Ionicons name="logo-google" size={16} color="#fff" />
              <Text style={s.btnPrimaryTxt}>Continue with Google</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnOutline} onPress={() => router.push("/(auth)/sign-in-email")} activeOpacity={0.85}>
            <Text style={s.btnOutlineTxt}>Sign in with email</Text>
          </TouchableOpacity>
        </View>

        {/* Feature cards — same style as web */}
        <View style={s.cards}>
          {FEATURES.map((f) => (
            <View key={f.label} style={s.card}>
              <View style={s.iconBox}>
                <Ionicons name={f.icon as any} size={14} color="#4B5FE8" />
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
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { paddingHorizontal: 24, alignItems: "center" },
  logo: { width: 72, height: 72, borderRadius: 20, marginBottom: 18 },
  tagline: { fontSize: 15, color: "rgba(15,17,21,0.7)", textAlign: "center", lineHeight: 23, marginBottom: 28, maxWidth: 320 },
  demoLbl: { alignSelf: "flex-start", fontSize: 11.5, fontWeight: "700", color: "rgba(15,17,21,0.6)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 9 },
  buttons: { gap: 10, marginTop: 32, marginBottom: 48, width: "100%" },
  btnPrimaryWrap: { borderRadius: 999, shadowColor: "#4B5FE8", shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  btnPrimary: { flexDirection: "row", gap: 9, borderRadius: 999, paddingVertical: 15, alignItems: "center", justifyContent: "center" },
  btnPrimaryTxt: { fontSize: 15, color: "#fff", fontWeight: "600" },
  btnOutline: { borderWidth: 1, borderColor: "rgba(15,17,21,0.15)", borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  btnOutlineTxt: { fontSize: 14, color: "#0f1115", fontWeight: "500" },
  cards: { width: "100%", gap: 10 },
  card: { flexDirection: "row", alignItems: "flex-start", gap: 14, backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" },
  iconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(75,95,232,0.1)", borderWidth: 1, borderColor: "rgba(75,95,232,0.2)", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 14, color: "#0f1115", fontWeight: "600", marginBottom: 3 },
  cardDesc: { fontSize: 12.5, color: "rgba(15,17,21,0.7)", lineHeight: 18 },
});

