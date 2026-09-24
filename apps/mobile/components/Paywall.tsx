import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { useApi } from "../lib/api";
import { useTr } from "../lib/useTr";

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "";

/**
 * Plans, mirrored from apps/web/src/lib/plans.ts.
 *
 * The mobile app has no shared import for these, so they are repeated here rather
 * than fetched — a paywall that renders empty while a request is in flight is worse
 * than one that is briefly out of date. Keep in step with the web list.
 */
const PLANS = [
  { id: "student",  name: "Student",  price: "$9.99",  period: "/month",    badge: null,        featured: false },
  { id: "semester", name: "Semester", price: "$34.99", period: "/4 months", badge: "Save 12%",  featured: false },
  { id: "annual",   name: "Annual",   price: "$69.99", period: "/year",     badge: "Save 42%",  featured: true  },
] as const;

const INCLUDED = [
  "Lecture recording",
  "Automatic structured notes",
  "Board & slide capture",
  "Flashcards",
  "Quizzes",
  "Ask about previous lectures",
];

/**
 * Shown when a student out of lectures tries to record.
 *
 * Checkout opens in the browser because Stripe cannot run inside the app — the same
 * route the Account tab already uses for Billing.
 */
export default function Paywall({
  visible,
  reason,
  onClose,
}: {
  visible: boolean;
  reason: "lecture" | "minutes";
  onClose: () => void;
}) {
  const tr = useTr();
  const api = useApi();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upgrade(plan: string) {
    setLoading(plan);
    setError(null);
    try {
      const res = await api.post("/api/billing/checkout", { plan });
      const url = res.data?.data?.url;
      if (url) {
        await WebBrowser.openBrowserAsync(url);
        onClose();
      } else if (WEB_URL) {
        // No session came back, but the billing page can still finish the job.
        await WebBrowser.openBrowserAsync(`${WEB_URL}/dashboard/billing`);
        onClose();
      } else {
        setError(tr("Couldn't start checkout — try again in a moment."));
      }
    } catch {
      setError(tr("Couldn't start checkout — try again in a moment."));
    } finally {
      setLoading(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.header}>
            <TouchableOpacity onPress={onClose} style={s.close} accessibilityLabel={tr("Close")}>
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={s.eyebrow}>
              {reason === "lecture" ? tr("Free lectures used") : tr("Recording time used")}
            </Text>
            <Text style={s.title}>{tr("Keep every lecture this semester")}</Text>
            <Text style={s.sub}>
              {reason === "lecture"
                ? tr("You've used your free lectures. Upgrade to record every class, with notes, flashcards and quizzes for each one.")
                : tr("You've used the free recording time. Upgrade to record every class, with notes, flashcards and quizzes for each one.")}
            </Text>
          </View>

          <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: 28 }}>
            {error ? (
              <View style={s.error}>
                <Text style={s.errorTxt}>{error}</Text>
              </View>
            ) : null}

            {PLANS.map((plan) => (
              <View key={plan.id} style={[s.plan, plan.featured && s.planFeatured]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={s.planTop}>
                    <Text style={s.planName}>{tr(plan.name)}</Text>
                    {plan.badge ? (
                      <View style={[s.badge, plan.featured && s.badgeFeatured]}>
                        <Text style={s.badgeTxt}>{tr(plan.badge)}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={s.priceRow}>
                    <Text style={s.price}>{plan.price}</Text>
                    <Text style={s.period}>{plan.period}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => upgrade(plan.id)}
                  disabled={!!loading}
                  style={[s.cta, plan.featured ? s.ctaFeatured : s.ctaPlain, !!loading && loading !== plan.id && { opacity: 0.5 }]}
                >
                  {loading === plan.id ? (
                    <ActivityIndicator size="small" color={plan.featured ? "#FFFFFF" : "#0f1115"} />
                  ) : (
                    <Text style={[s.ctaTxt, plan.featured ? { color: "#FFFFFF" } : { color: "#0f1115" }]}>
                      {tr("Upgrade")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}

            <Text style={s.includedLabel}>{tr("Every plan includes")}</Text>
            {INCLUDED.map((f) => (
              <View key={f} style={s.includedRow}>
                <Ionicons name="checkmark" size={14} color="#4B5FE8" />
                <Text style={s.includedTxt}>{tr(f)}</Text>
              </View>
            ))}

            <Text style={s.fine}>{tr("Billed today. Cancel anytime.")}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(10,12,20,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: "92%", overflow: "hidden" },
  header: { backgroundColor: "#4B5FE8", paddingHorizontal: 22, paddingTop: 26, paddingBottom: 22 },
  close: {
    position: "absolute", top: 14, right: 14, width: 32, height: 32, borderRadius: 999,
    alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.2)", zIndex: 2,
  },
  eyebrow: { color: "rgba(255,255,255,0.88)", fontSize: 11.5, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 },
  title: { color: "#FFFFFF", fontSize: 24, fontWeight: "800", lineHeight: 29 },
  sub: { color: "rgba(255,255,255,0.93)", fontSize: 15, lineHeight: 21, marginTop: 9 },
  body: { paddingHorizontal: 18, paddingTop: 16 },
  error: { backgroundColor: "rgba(239,68,68,0.07)", borderColor: "rgba(239,68,68,0.3)", borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 12 },
  errorTxt: { color: "#B91C1C", fontSize: 14.5 },
  plan: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12,
    borderWidth: 1, borderColor: "rgba(0,0,0,0.11)", borderRadius: 16, padding: 14, marginBottom: 10,
  },
  planFeatured: { borderWidth: 2, borderColor: "#4B5FE8", backgroundColor: "rgba(75,95,232,0.04)" },
  planTop: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  planName: { fontSize: 16.5, fontWeight: "700", color: "#0f1115" },
  badge: { backgroundColor: "#0f1115", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeFeatured: { backgroundColor: "#4B5FE8" },
  badgeTxt: { color: "#FFFFFF", fontSize: 10.5, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 5, marginTop: 3 },
  price: { fontSize: 20, fontWeight: "800", color: "#0f1115" },
  period: { fontSize: 13.5, color: "rgba(15,17,21,0.6)" },
  cta: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, minWidth: 96, alignItems: "center", justifyContent: "center" },
  ctaFeatured: { backgroundColor: "#4B5FE8" },
  ctaPlain: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(0,0,0,0.15)" },
  ctaTxt: { fontSize: 14.5, fontWeight: "700" },
  includedLabel: {
    fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase",
    color: "rgba(15,17,21,0.5)", marginTop: 18, marginBottom: 10,
    borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.07)", paddingTop: 16,
  },
  includedRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 },
  includedTxt: { fontSize: 14.5, color: "rgba(15,17,21,0.78)" },
  fine: { fontSize: 13, color: "rgba(15,17,21,0.55)", textAlign: "center", marginTop: 16 },
});
