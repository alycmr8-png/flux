import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTr } from "../lib/useTr";

const STAGE_MS = 3000;
const FADE_MS = 200;

function useStageCycle(count: number) {
  const [stage, setStage] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const t = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => {
        setStage((s) => (s + 1) % count);
        Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
      });
    }, STAGE_MS);
    return () => clearInterval(t);
  }, [count, fade]);

  return { stage, fade };
}

function useStagger(stage: number, active: boolean, length = 3) {
  const anims = useRef(Array.from({ length }, () => new Animated.Value(0))).current;
  useEffect(() => {
    if (!active) return;
    anims.forEach((a) => a.setValue(0));
    Animated.stagger(
      140,
      anims.map((a) => Animated.timing(a, { toValue: 1, duration: 240, useNativeDriver: true }))
    ).start();
  }, [stage, active, anims]);
  return anims;
}

function Reveal({ anim, children, style }: { anim: Animated.Value; children: React.ReactNode; style?: any }) {
  return (
    <Animated.View
      style={[
        style,
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function DemoFrame({
  tab,
  icon,
  fade,
  dots,
  stage,
  children,
}: {
  tab: string;
  icon: any;
  fade: Animated.Value;
  dots: number;
  stage: number;
  children: React.ReactNode;
}) {
  const tr = useTr();
  return (
    <View style={s.card}>
      <View style={s.chromeRow}>
        <View style={s.tabChip}>
          <Ionicons name={icon} size={11} color="#4B5FE8" />
          <Text style={s.tabChipTxt}>{tab}</Text>
        </View>
        <Text style={s.courseTxt}>{tr("Calculus II")}</Text>
      </View>

      <Animated.View style={[s.stageBody, { opacity: fade }]}>{children}</Animated.View>

      <View style={s.dotsRow}>
        {Array.from({ length: dots }).map((_, i) => (
          <View key={i} style={[s.dot, i === stage && s.dotActive]} />
        ))}
      </View>
    </View>
  );
}

/* ── Demo 1 — record a lecture, get study material out of it ─────────────── */

export function RecordingDemo() {
  const tr = useTr();
  const { stage, fade } = useStageCycle(4);
  const lines = useStagger(stage, stage === 2 || stage === 3, 4);

  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.14, duration: 620, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 620, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const waves = useRef(Array.from({ length: 14 }, () => new Animated.Value(0.2))).current;
  const waveLoops = useRef<Animated.CompositeAnimation[]>([]);
  useEffect(() => {
    if (stage === 0) {
      waveLoops.current = waves.map((anim) => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: 0.3 + Math.random() * 0.7, duration: 200 + Math.random() * 320, useNativeDriver: false }),
            Animated.timing(anim, { toValue: 0.1 + Math.random() * 0.2, duration: 200 + Math.random() * 280, useNativeDriver: false }),
          ])
        );
        loop.start();
        return loop;
      });
    } else {
      waveLoops.current.forEach((a) => a.stop());
    }
    return () => waveLoops.current.forEach((a) => a.stop());
  }, [stage, waves]);

  return (
    <DemoFrame tab={tr("Record")} icon="mic-outline" fade={fade} dots={4} stage={stage}>
      {stage === 0 && (
        <View>
          <View style={s.headerRow}>
            <Animated.View style={[s.iconBox, s.iconRed, { transform: [{ scale: pulse }] }]}>
              <Ionicons name="mic" size={15} color="#DC2626" />
            </Animated.View>
            <Text style={s.title}>{tr("Recording lecture…")}</Text>
            <Text style={s.timer}>00:47</Text>
          </View>
          <View style={s.waveRow}>
            {waves.map((anim, i) => (
              <Animated.View
                key={i}
                style={[s.waveBar, { height: anim.interpolate({ inputRange: [0, 1], outputRange: [4, 30] }) }]}
              />
            ))}
          </View>
        </View>
      )}

      {stage === 1 && (
        <View>
          <View style={s.headerRow}>
            <View style={[s.iconBox, s.iconBlue]}>
              <ActivityIndicator size="small" color="#4B5FE8" />
            </View>
            <Text style={s.title}>{tr("Generating your summary…")}</Text>
          </View>
          <View style={{ gap: 7 }}>
            {[0.92, 0.74, 0.55].map((w, i) => (
              <View key={i} style={[s.skeleton, { width: `${w * 100}%` }]} />
            ))}
          </View>
        </View>
      )}

      {stage === 2 && (
        <View>
          <View style={s.headerRow}>
            <View style={[s.iconBox, s.iconBlue]}>
              <Ionicons name="document-text-outline" size={15} color="#4B5FE8" />
            </View>
            <Text style={s.title}>{tr("Lecture 5")}</Text>
          </View>
          <Reveal anim={lines[0]}>
            <Text style={s.sectionLbl}>{tr("Summary")}</Text>
            <Text style={s.body}>{tr("Derivatives of composite functions, worked end to end.")}</Text>
          </Reveal>
          <Reveal anim={lines[1]} style={{ marginTop: 8 }}>
            <Text style={s.sectionLbl}>{tr("Key Points")}</Text>
          </Reveal>
          <Reveal anim={lines[2]} style={s.bulletRow}>
            <Text style={s.bullet}>•</Text>
            <Text style={s.body}>{tr("Differentiate the outside, multiply by the inside")}</Text>
          </Reveal>
          <Reveal anim={lines[3]} style={s.bulletRow}>
            <Text style={s.bullet}>•</Text>
            <Text style={s.body}>{tr("He circled this twice — expect it on the midterm")}</Text>
          </Reveal>
        </View>
      )}

      {stage === 3 && (
        <View>
          <View style={s.headerRow}>
            <View style={[s.iconBox, s.iconBlue]}>
              <Ionicons name="sparkles-outline" size={15} color="#4B5FE8" />
            </View>
            <Text style={s.title}>{tr("Ask your course")}</Text>
          </View>
          <Reveal anim={lines[0]} style={s.bubbleRight}>
            <View style={s.bubbleUser}>
              <Text style={s.bubbleUserTxt}>{tr("What did the professor emphasize most?")}</Text>
            </View>
          </Reveal>
          <Reveal anim={lines[1]} style={s.bubbleLeft}>
            <View style={s.bubbleAi}>
              <Text style={s.body}>{tr("The chain rule — he spent 18 minutes on it.")}</Text>
            </View>
          </Reveal>
          <Reveal anim={lines[2]} style={s.bubbleLeft}>
            <View style={s.citeChip}>
              <Ionicons name="play" size={8} color="#4B5FE8" />
              <Text style={s.citeTxt}>{tr("Lecture 5 · 32:10")}</Text>
            </View>
          </Reveal>
        </View>
      )}
    </DemoFrame>
  );
}

/* ── Demo 2 — your own written notes, tied to the same class ─────────────── */

const NOTE_TEXT = "Chain rule: d/dx f(g(x)) = f′(g(x))·g′(x)";
const SYMBOLS = ["∫", "√", "π", "Δ", "Σ", "∂"];

export function NotesDemo() {
  const tr = useTr();
  const { stage, fade } = useStageCycle(4);
  const lines = useStagger(stage, stage === 1 || stage === 2 || stage === 3);

  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (stage !== 0) return;
    setTyped("");
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setTyped(NOTE_TEXT.slice(0, i));
      if (i >= NOTE_TEXT.length) clearInterval(t);
    }, 55);
    return () => clearInterval(t);
  }, [stage]);

  return (
    <DemoFrame tab={tr("Take Note")} icon="create-outline" fade={fade} dots={4} stage={stage}>
      {stage === 0 && (
        <View>
          <View style={s.headerRow}>
            <View style={[s.iconBox, s.iconPurple]}>
              <Ionicons name="create-outline" size={15} color="#9333EA" />
            </View>
            <Text style={s.title}>{tr("Chapter 3 — Derivatives")}</Text>
          </View>
          <View style={s.symbolRow}>
            {SYMBOLS.map((sym) => (
              <View key={sym} style={s.symbolChip}>
                <Text style={s.symbolTxt}>{sym}</Text>
              </View>
            ))}
          </View>
          <Text style={s.noteTxt}>
            {typed}
            <Text style={s.caret}>|</Text>
          </Text>
        </View>
      )}

      {stage === 1 && (
        <View>
          <View style={s.headerRow}>
            <View style={[s.iconBox, s.iconGreen]}>
              <Ionicons name="checkmark-circle" size={15} color="#16A34A" />
            </View>
            <Text style={s.title}>{tr("Your Notes")}</Text>
            <Text style={s.savedTxt}>{tr("Saved 14:32")}</Text>
          </View>
          <Reveal anim={lines[0]} style={s.row}>
            <Ionicons name="create-outline" size={13} color="#9333EA" />
            <Text style={s.rowTitle}>{tr("Chapter 3 — Derivatives")}</Text>
          </Reveal>
          <Reveal anim={lines[1]} style={s.row}>
            <Ionicons name="mic-outline" size={13} color="#DC2626" />
            <Text style={s.rowTitle}>{tr("Lecture 5")}</Text>
            <Text style={s.rowSub}>ready</Text>
          </Reveal>
        </View>
      )}

      {stage === 2 && (
        <View>
          <View style={s.headerRow}>
            <View style={[s.iconBox, s.iconBlue]}>
              <Ionicons name="layers-outline" size={15} color="#4B5FE8" />
            </View>
            <Text style={s.title}>{tr("One memory per class")}</Text>
          </View>
          <Reveal anim={lines[0]} style={s.mergeRow}>
            <View style={s.mergePill}>
              <Ionicons name="mic-outline" size={11} color="#DC2626" />
              <Text style={s.mergeTxt}>{tr("Lecture 5")}</Text>
            </View>
            <View style={s.mergePill}>
              <Ionicons name="create-outline" size={11} color="#9333EA" />
              <Text style={s.mergeTxt}>{tr("Your note")}</Text>
            </View>
          </Reveal>
          <Reveal anim={lines[1]} style={{ alignItems: "center", marginVertical: 4 }}>
            <Ionicons name="arrow-down" size={13} color="rgba(15,17,21,0.35)" />
          </Reveal>
          <Reveal anim={lines[2]} style={s.tintBox}>
            <Text style={s.bodyStrong}>{tr("Calculus II memory")}</Text>
            <Text style={s.body}>{tr("In memory: 2 sources")}</Text>
          </Reveal>
        </View>
      )}

      {stage === 3 && (
        <View>
          <View style={s.headerRow}>
            <View style={[s.iconBox, s.iconBlue]}>
              <Ionicons name="sparkles-outline" size={15} color="#4B5FE8" />
            </View>
            <Text style={s.title}>{tr("Answers from both")}</Text>
          </View>
          <Reveal anim={lines[0]} style={s.bubbleRight}>
            <View style={s.bubbleUser}>
              <Text style={s.bubbleUserTxt}>{tr("Explain the chain rule")}</Text>
            </View>
          </Reveal>
          <Reveal anim={lines[1]} style={s.bubbleLeft}>
            <View style={s.bubbleAi}>
              <Text style={s.body}>{tr("Differentiate the outside, multiply by the inside's derivative.")}</Text>
            </View>
          </Reveal>
          <Reveal anim={lines[2]} style={[s.bubbleLeft, { flexDirection: "row", gap: 6 }]}>
            <View style={s.citeChip}>
              <Ionicons name="mic-outline" size={8} color="#4B5FE8" />
              <Text style={s.citeTxt}>{tr("Lecture 5")}</Text>
            </View>
            <View style={s.citeChip}>
              <Ionicons name="create-outline" size={8} color="#4B5FE8" />
              <Text style={s.citeTxt}>{tr("Chapter 3")}</Text>
            </View>
          </Reveal>
        </View>
      )}
    </DemoFrame>
  );
}

const s = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    padding: 14,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  chromeRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  tabChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(75,95,232,0.08)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  tabChipTxt: { fontSize: 11, fontWeight: "700", color: "#4B5FE8" },
  courseTxt: { fontSize: 11.5, color: "rgba(15,17,21,0.55)", marginLeft: "auto" },
  stageBody: { minHeight: 142, justifyContent: "center" },
  bulletRow: { flexDirection: "row", gap: 6, marginTop: 2 },
  bullet: { color: "rgba(15,17,21,0.5)", fontSize: 13, lineHeight: 19 },
  body: { fontSize: 13, color: "rgba(15,17,21,0.78)", lineHeight: 19 },
  bodyStrong: { fontSize: 13, color: "#0f1115", fontWeight: "600", lineHeight: 19 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 10 },
  iconBox: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  iconRed: { backgroundColor: "rgba(220,38,38,0.1)" },
  iconBlue: { backgroundColor: "rgba(75,95,232,0.1)" },
  iconGreen: { backgroundColor: "rgba(22,163,74,0.1)" },
  iconPurple: { backgroundColor: "rgba(147,51,234,0.1)" },
  title: { fontSize: 14, fontWeight: "700", color: "#0f1115", flexShrink: 1 },
  timer: { fontSize: 12.5, color: "rgba(15,17,21,0.6)", marginLeft: "auto", fontVariant: ["tabular-nums"] },
  savedTxt: { fontSize: 11, color: "rgba(15,17,21,0.5)", marginLeft: "auto" },

  waveRow: { flexDirection: "row", alignItems: "flex-end", gap: 3.5, height: 30 },
  waveBar: { width: 3.5, borderRadius: 2, backgroundColor: "#4B5FE8" },
  skeleton: { height: 8, borderRadius: 4, backgroundColor: "rgba(15,17,21,0.07)" },

  sectionLbl: { fontSize: 11, fontWeight: "700", color: "rgba(15,17,21,0.55)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 5 },
  tintBox: {
    backgroundColor: "rgba(75,95,232,0.06)",
    borderWidth: 1,
    borderColor: "rgba(75,95,232,0.15)",
    borderRadius: 10,
    padding: 9,
    marginTop: 6,
  },

  bubbleRight: { alignSelf: "flex-end", maxWidth: "85%", marginBottom: 5 },
  bubbleLeft: { alignSelf: "flex-start", maxWidth: "90%", marginBottom: 5 },
  bubbleUser: { backgroundColor: "#4B5FE8", borderRadius: 12, borderBottomRightRadius: 4, paddingHorizontal: 10, paddingVertical: 7 },
  bubbleUserTxt: { fontSize: 13, color: "#fff", lineHeight: 18 },
  bubbleAi: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    borderRadius: 12,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  citeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "rgba(75,95,232,0.08)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  citeTxt: { fontSize: 11, fontWeight: "600", color: "#4B5FE8" },

  symbolRow: { flexDirection: "row", gap: 5, marginBottom: 10 },
  symbolChip: {
    backgroundColor: "rgba(75,95,232,0.06)",
    borderWidth: 1,
    borderColor: "rgba(75,95,232,0.15)",
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  symbolTxt: { color: "#4B5FE8", fontSize: 12.5 },
  noteTxt: { fontSize: 12.5, color: "#0f1115", lineHeight: 20, fontFamily: "monospace" },
  caret: { color: "#4B5FE8" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  rowTitle: { fontSize: 13, color: "#0f1115", flexShrink: 1 },
  rowSub: { fontSize: 11, color: "rgba(15,17,21,0.5)", marginLeft: "auto" },

  mergeRow: { flexDirection: "row", gap: 6, justifyContent: "center" },
  mergePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  mergeTxt: { fontSize: 12, color: "#0f1115" },

  dotsRow: { flexDirection: "row", gap: 4, justifyContent: "center", marginTop: 12 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(15,17,21,0.15)" },
  dotActive: { backgroundColor: "#4B5FE8", width: 12 },
});
