/**
 * What the student sees while a lecture is being processed on the server.
 * Mirrors the web workspace: what's happening now, the four things that come
 * out the other end, and where in the pipeline this lecture is.
 */
import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTr } from "../lib/useTr";

const STEPS = ["processing", "transcribing", "generating", "ready"] as const;
const STEP_LABEL: Record<(typeof STEPS)[number], string> = {
  processing: "Upload", transcribing: "Transcribe", generating: "Generate", ready: "Ready",
};

const OUTPUTS: { icon: keyof typeof Ionicons.glyphMap; label: string; note: string }[] = [
  { icon: "document-text-outline", label: "Cheat sheet", note: "the whole lecture, condensed" },
  { icon: "list-outline", label: "Key points", note: "what actually mattered" },
  { icon: "layers-outline", label: "Flashcards", note: "ready to drill" },
  { icon: "help-circle-outline", label: "Practice quiz", note: "every answer timestamped" },
];

function PulseRing({ delay, size, color }: { delay: number; size: number; color: string }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, t]);
  return (
    <Animated.View
      style={{
        position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: `${color}66`,
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.25] }) }],
      }}
    />
  );
}

export function ProcessingCard({
  status, color, errorMessage, onBack,
}: { status: string; color: string; errorMessage?: string | null; onBack: () => void }) {
  const tr = useTr();
  const idx = STEPS.indexOf(status as any);
  const building = status === "generating";
  const done = status === "ready";

  if (status === "error") {
    return (
      <View style={s.card}>
        <Ionicons name="alert-circle-outline" size={40} color="#DC2626" style={{ marginBottom: 12 }} />
        <Text style={s.title}>{tr("Processing failed")}</Text>
        <Text style={s.desc}>{errorMessage || tr("Check your internet connection and try again.")}</Text>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backTxt}>{tr("Back to recordings")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.card}>
      <View style={s.rings}>
        {[0, 1, 2].map(i => <PulseRing key={i} delay={i * 450} size={44 + i * 24} color={color} />)}
        <ActivityIndicator size="small" color={color} />
      </View>

      <Text style={s.title}>
        {status === "transcribing" ? tr("Writing down every word")
          : building ? tr("Building your study material")
          : tr("Getting your recording ready")}
      </Text>
      <Text style={s.desc}>
        {status === "transcribing"
          ? "Transcribing the audio, then proofreading it for misheard terms, names and formulas — and reading in any photos you took in class."
          : building
          ? "Four things at once, from the whole lecture. It's also being filed into your course memory, so you can ask about it weeks from now."
          : tr("Compressing the audio so it moves fast.")}
      </Text>

      <View style={s.grid}>
        {OUTPUTS.map(({ icon, label, note }) => {
          const lit = building || done;
          return (
            <View key={label} style={[s.output, { backgroundColor: lit ? `${color}0D` : "rgba(0,0,0,0.025)", borderColor: lit ? `${color}40` : "rgba(0,0,0,0.07)" }]}>
              <View style={{ marginTop: 1 }}>
                {done ? <Ionicons name="checkmark" size={19} color={color} />
                  : building ? <ActivityIndicator size="small" color={color} />
                  : <Ionicons name={icon} size={19} color="rgba(15,17,21,0.7)" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.outputLabel, !lit && { color: "rgba(15,17,21,0.72)" }]}>{label}</Text>
                <Text style={[s.outputNote, !lit && { color: "rgba(15,17,21,0.62)" }]}>{note}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={s.steps}>
        {STEPS.map((step, i) => (
          <View key={step} style={s.step}>
            <View style={[s.dot, { backgroundColor: i <= idx ? color : "rgba(0,0,0,0.2)" }]} />
            <Text style={[s.stepTxt, i <= idx && { color: "#0f1115" }, i === idx && { fontWeight: "700" }]}>{STEP_LABEL[step]}</Text>
          </View>
        ))}
      </View>

      <Text style={s.footer}>{tr("This runs on our servers — you can leave this screen and come back.")}</Text>
      <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
        <Text style={s.backTxt}>{tr("Back to recordings")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderRadius: 24, paddingVertical: 28, paddingHorizontal: 18, alignItems: "center", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", marginBottom: 16 },
  rings: { width: 110, height: 110, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  title: { fontSize: 23, fontWeight: "800", color: "#0f1115", textAlign: "center", marginBottom: 10 },
  desc: { fontSize: 17, color: "rgba(15,17,21,0.86)", textAlign: "center", lineHeight: 25, marginBottom: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, width: "100%", marginBottom: 20 },
  output: { width: "48%", flexGrow: 1, flexDirection: "row", gap: 10, borderRadius: 14, borderWidth: 1, padding: 12 },
  outputLabel: { fontSize: 17, fontWeight: "700", color: "#0f1115" },
  outputNote: { fontSize: 14.5, color: "rgba(15,17,21,0.8)", marginTop: 3, lineHeight: 19 },
  steps: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 16, marginBottom: 16 },
  step: { flexDirection: "row", alignItems: "center", gap: 7 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  stepTxt: { fontSize: 16.5, fontWeight: "500", color: "rgba(15,17,21,0.6)" },
  footer: { fontSize: 15.5, color: "rgba(15,17,21,0.82)", textAlign: "center", lineHeight: 22 },
  backBtn: { marginTop: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.14)", borderRadius: 999, paddingHorizontal: 20, paddingVertical: 9 },
  backTxt: { fontSize: 16.5, fontWeight: "600", color: "rgba(15,17,21,0.88)" },
});
