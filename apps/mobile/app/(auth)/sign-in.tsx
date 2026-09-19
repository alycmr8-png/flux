import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, Alert,
  Animated, Easing, AccessibilityInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { useSSO } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { useTr } from "../../lib/useTr";

// Required so the OAuth browser popup can hand the session back to the app
WebBrowser.maybeCompleteAuthSession();

// Taken from assets/icon.png so the screen and the app icon are the same blue —
// the mark then reads as floating on the page rather than sitting on a tile.
const BRAND_BLUE = "#2563EB";
const MARK_SIZE = 104;
const INK = "#0f1115";

// English here, translated where they render — a module constant is built before
// any component runs, so the translator hook isn't available yet.
const FEATURES = [
  { icon: "mic-outline",      label: "Record Lectures" },
  { icon: "create-outline",   label: "Take Notes"      },
  { icon: "sparkles-outline", label: "Ask Your Course" },
];

/**
 * The Flux mark: the same three layers as the app icon and the web logo.
 *
 * Each layer is its own path, so the stack assembles itself — the two lower
 * plates land first and the top diamond arrives last, building toward the
 * viewer. Drawn rather than using icon.png so the layers can move separately.
 */
const LAYERS = [
  // bottom chevron, middle chevron, then the top diamond — animation order
  "M22 17.65 12.83 21.81a2 2 0 0 1-1.66 0L2 17.65",
  "M22 12.65 12.83 16.81a2 2 0 0 1-1.66 0L2 12.65",
  "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z",
];

function AnimatedMark() {
  const layers = useRef(LAYERS.map(() => new Animated.Value(0))).current;
  const word = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;

      if (reduce) {
        layers.forEach((l) => l.setValue(1));
        word.setValue(1);
        return;
      }

      Animated.sequence([
        Animated.stagger(
          150,
          layers.map((l) =>
            Animated.spring(l, { toValue: 1, friction: 6.5, tension: 60, useNativeDriver: true }),
          ),
        ),
        Animated.timing(word, { toValue: 1, duration: 360, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start(() => {
        if (cancelled) return;
        Animated.loop(
          Animated.sequence([
            Animated.timing(float, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(float, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          ]),
        ).start();
      });
    });

    return () => { cancelled = true; };
  }, [layers, word, float]);

  const drift = float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });

  return (
    <View style={s.markWrap}>
      {/* Each layer is its own overlaid SVG so the animation runs on real views —
          animating react-native-svg props under the native driver is unreliable.
          Identical size and viewBox keep the three in exact register. */}
      <Animated.View style={[s.mark, { transform: [{ translateY: drift }] }]}>
        {LAYERS.map((d, i) => (
          <Animated.View
            key={d}
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: layers[i],
                transform: [
                  { translateY: layers[i].interpolate({ inputRange: [0, 1], outputRange: [-9, 0] }) },
                ],
              },
            ]}
          >
            <Svg width={MARK_SIZE} height={MARK_SIZE} viewBox="0 0 24 24" fill="none">
              <Path d={d} stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Animated.View>
        ))}
      </Animated.View>

      <Animated.Text
        style={[
          s.wordmark,
          {
            opacity: word,
            transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          },
        ]}
      >
        Fl<Text style={s.wordmarkU}>u</Text>x
      </Animated.Text>
    </View>
  );
}

export default function WelcomeScreen() {
  const tr = useTr();
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
        Alert.alert(tr("Almost there"), tr("Google didn't complete sign-in. Try again, or use email below."));
      }
    } catch (e: any) {
      const msg = e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? e?.message ?? tr("Unknown error");
      Alert.alert(tr("Google sign-in failed"), msg);
    }
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.content, { paddingTop: insets.top + 72, paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <AnimatedMark />

        <Text style={s.tagline}>{tr("Take notes faster.")}</Text>

        {/* Three words for what it does — no prose */}
        <View style={s.features}>
          {FEATURES.map((f) => (
            <View key={f.label} style={s.feature}>
              <View style={s.iconBox}>
                <Ionicons name={f.icon as any} size={17} color="#FFFFFF" />
              </View>
              <Text style={s.featureLabel}>{tr(f.label)}</Text>
            </View>
          ))}
        </View>

        <View style={s.buttons}>
          {/* White on blue is the strongest contrast available, so it carries the primary action */}
          <TouchableOpacity onPress={handleGoogle} activeOpacity={0.85} style={s.btnPrimary}>
            <Ionicons name="logo-google" size={16} color={INK} />
            <Text style={s.btnPrimaryTxt}>{tr("Continue with Google")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.btnOutline}
            onPress={() => router.push("/(auth)/sign-in-email")}
            activeOpacity={0.85}
          >
            <Text style={s.btnOutlineTxt}>{tr("Sign in with email")}</Text>
          </TouchableOpacity>

          <Text style={s.footnote}>{tr("Free to start · No credit card needed")}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND_BLUE },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 26, alignItems: "center", flexGrow: 1 },

  markWrap: { alignItems: "center", gap: 22, marginBottom: 26 },
  mark: { width: MARK_SIZE, height: MARK_SIZE },
  wordmark: { fontSize: 42, fontWeight: "800", color: "#FFFFFF", letterSpacing: -1.4 },
  wordmarkU: { color: "#B9CBFF" },

  tagline: {
    fontSize: 19,
    fontWeight: "600",
    color: "rgba(255,255,255,0.92)",
    textAlign: "center",
    marginBottom: 44,
  },

  features: { flexDirection: "row", justifyContent: "center", gap: 14, width: "100%", marginBottom: 44 },
  feature: { flex: 1, alignItems: "center", gap: 9 },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  featureLabel: {
    fontSize: 12.5,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 16.5,
  },

  buttons: { gap: 11, width: "100%", marginTop: "auto" },
  btnPrimary: {
    flexDirection: "row",
    gap: 9,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0B1A52",
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  btnPrimaryTxt: { fontSize: 15.5, color: INK, fontWeight: "600" },
  btnOutline: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: "center",
  },
  btnOutlineTxt: { fontSize: 14.5, color: "#FFFFFF", fontWeight: "500" },
  footnote: { fontSize: 12.5, color: "rgba(255,255,255,0.6)", textAlign: "center", marginTop: 4 },
});
