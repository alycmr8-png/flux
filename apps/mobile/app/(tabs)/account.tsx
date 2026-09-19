import { ScrollView, View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert, Modal, Image, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useUser, useClerk } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { LANGUAGES } from "@sano/i18n";
import { setLanguage, currentLanguage } from "../../lib/i18n";
import useSWR from "swr";
import { useApi, makeApiFetcher } from "../../lib/api";
import { useAuth } from "@clerk/clerk-expo";
import { useTr } from "../../lib/useTr";

// Illustrated people rather than emoji. Each seed deterministically produces the
// same character, so a stored seed always renders the avatar the student chose.
const AVATARS = [
  "Maya", "Kai", "Leo", "Zara", "Noah", "Amara", "Diego", "Yuki",
  "Omar", "Sofia", "Ines", "Malik", "Aria", "Ravi", "Nina", "Tariq",
  "Chloe", "Ade", "Hana", "Felix",
];
// Eyes/mouth are constrained so every seed reads as a friendly face — the
// unconstrained generator returns dizzy and x-eyed expressions at random.
const AVATAR_FEATURES = "eyes=default,happy,wink&mouth=smile,twinkle&eyebrows=default,defaultNatural,raisedExcitedNatural";
const avatarUrl = (seed: string, size = 160) =>
  `https://api.dicebear.com/9.x/avataaars/png?seed=${encodeURIComponent(seed)}&size=${size}&${AVATAR_FEATURES}`;
const AVATAR_COLORS = ["#4B5FE8","#9333EA","#DC2626","#EA580C","#16A34A","#0891B2","#D97706","#DB2777"];

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "";

export default function AccountScreen() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { signOut } = useClerk();
  const api = useApi();
  const [langOpen, setLangOpen] = useState(false);
  const [lang, setLang] = useState("en");
  useEffect(() => { currentLanguage().then(setLang); }, []);
  const { getToken } = useAuth();
  const { data: settings, mutate } = useSWR("/api/settings", makeApiFetcher(getToken));

  const [picking, setPicking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [emoji, setEmoji] = useState<string | null>(null);
  const [tint, setTint] = useState<string | null>(null);

  const avatar = emoji ?? settings?.data?.avatar ?? null;
  const avatarColor = tint ?? settings?.data?.avatarColor ?? "#4B5FE8";
  const initial = (user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? "?").toUpperCase();

  async function saveAvatar(nextEmoji: string, nextColor: string) {
    setEmoji(nextEmoji);
    setTint(nextColor);
    try {
      await api.patch("/api/settings/avatar", { avatar: nextEmoji, avatarColor: nextColor });
      await mutate();
    } catch (e: any) {
      Alert.alert(tr("Couldn't save"), e?.response?.data?.error ?? e?.message ?? tr("Try again."));
    }
  }

  function confirmSignOut() {
    Alert.alert(tr("Sign out?"), tr("You can sign back in anytime."), [
      { text: tr("Cancel"), style: "cancel" },
      { text: tr("Sign out"), style: "destructive", onPress: () => signOut() },
    ]);
  }

  // Deleting an account is irreversible, so it takes two deliberate taps and
  // says plainly what goes — including the subscription, which people assume
  // keeps running.
  function confirmDelete() {
    Alert.alert(
      tr("Delete your account?"),
      tr("Your recordings, transcripts, notes, photos and study material are permanently deleted, and any subscription is cancelled."),
      [
        { text: tr("Cancel"), style: "cancel" },
        { text: tr("Continue"), style: "destructive", onPress: confirmDeleteFinal },
      ],
    );
  }

  function confirmDeleteFinal() {
    Alert.alert(
      tr("This can't be undone"),
      tr("There is no way to get your recordings back once they're deleted."),
      [
        { text: tr("Cancel"), style: "cancel" },
        { text: tr("Delete forever"), style: "destructive", onPress: deleteAccount },
      ],
    );
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      await api.delete("/api/account");
      // The account is gone; signing out clears the stale session on this device.
      await signOut();
    } catch (e: any) {
      setDeleting(false);
      Alert.alert(
        tr("Couldn't delete your account"),
        e?.response?.data?.error ?? tr("Try again in a moment."),
      );
    }
  }

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]}>
        <Text style={s.eyebrow}>{tr("Account")}</Text>
        <Text style={s.h1}>{tr("Settings")}</Text>

        {/* Profile */}
        <View style={s.card}>
          <TouchableOpacity
            style={[s.avatar, { backgroundColor: avatarColor }]}
            onPress={() => setPicking(true)}
            activeOpacity={0.8}
          >
            {avatar
              ? <Image source={{ uri: avatarUrl(avatar, 120) }} style={s.avatarImg} />
              : <Text style={s.avatarTxt}>{initial}</Text>}
            <View style={s.avatarEdit}>
              <Ionicons name="pencil" size={10} color="#fff" />
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{user?.fullName ?? tr("Student")}</Text>
            <Text style={s.email}>{user?.emailAddresses?.[0]?.emailAddress ?? ""}</Text>
          </View>
        </View>

        {/* Language — the app, lectures and everything Flux writes */}
        <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={() => setLangOpen(true)}>
          <Ionicons name="language-outline" size={20} color="rgba(15,17,21,0.55)" />
          <Text style={s.rowTxt}>{tr("Language")}</Text>
          <Text style={{ fontSize: 16, color: "rgba(15,17,21,0.7)" }}>
            {LANGUAGES.find(l => l.code === lang)?.flag} {LANGUAGES.find(l => l.code === lang)?.label ?? "English"}
          </Text>
          <Ionicons name="chevron-forward" size={17} color="rgba(15,17,21,0.35)" />
        </TouchableOpacity>

        <Modal visible={langOpen} transparent animationType="fade" onRequestClose={() => setLangOpen(false)}>
          <TouchableOpacity style={s.langBackdrop} activeOpacity={1} onPress={() => setLangOpen(false)}>
            <View style={s.langSheet}>
              <Text style={s.langTitle}>{tr("Language")}</Text>
              <Text style={s.langHint}>{tr("Flux speaks this language: the app, your lecture transcripts, and every summary, quiz and answer.")}</Text>
              {LANGUAGES.map(l => (
                <TouchableOpacity
                  key={l.code}
                  style={s.langRow}
                  activeOpacity={0.7}
                  onPress={async () => {
                    setLang(l.code);
                    setLangOpen(false);
                    await setLanguage(l.code, language => api.patch("/api/settings/language", { language }));
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{l.flag}</Text>
                  <Text style={[s.rowTxt, { fontWeight: l.code === lang ? "700" : "500" }]}>{l.label}</Text>
                  {l.code === lang && <Ionicons name="checkmark" size={20} color="#4B5FE8" />}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Billing */}
        <TouchableOpacity
          style={s.row}
          activeOpacity={0.7}
          onPress={() => {
            if (WEB_URL) WebBrowser.openBrowserAsync(`${WEB_URL}/dashboard/billing`);
            else Alert.alert(tr("Billing"), "Manage your plan from the Flux website (Dashboard → Billing).");
          }}
        >
          <Ionicons name="card-outline" size={20} color="rgba(15,17,21,0.55)" />
          <Text style={s.rowTxt}>{tr("Billing & plan")}</Text>
          <Ionicons name="open-outline" size={17} color="rgba(15,17,21,0.35)" />
        </TouchableOpacity>

        {/* Help */}
        <TouchableOpacity
          style={s.row}
          activeOpacity={0.7}
          onPress={() => Alert.alert(tr("Help"), tr("Questions or issues? Email us and we'll get you sorted."))}
        >
          <Ionicons name="help-circle-outline" size={20} color="rgba(15,17,21,0.55)" />
          <Text style={s.rowTxt}>{tr("Help & support")}</Text>
          <Ionicons name="chevron-forward" size={17} color="rgba(15,17,21,0.35)" />
        </TouchableOpacity>

        {/* Sign out */}
        <TouchableOpacity style={[s.row, { marginTop: 18 }]} onPress={confirmSignOut} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={[s.rowTxt, { color: "#DC2626" }]}>{tr("Sign out")}</Text>
        </TouchableOpacity>

        {/* Delete account — last, and visually quieter than signing out, so it
            is findable without being easy to hit by accident. */}
        <TouchableOpacity style={s.row} onPress={confirmDelete} activeOpacity={0.7} disabled={deleting}>
          {deleting
            ? <ActivityIndicator size="small" color="rgba(15,17,21,0.55)" />
            : <Ionicons name="trash-outline" size={20} color="rgba(15,17,21,0.55)" />}
          <Text style={[s.rowTxt, { color: "rgba(15,17,21,0.75)" }]}>
            {deleting ? tr("Deleting…") : tr("Delete account")}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={picking} transparent animationType="slide" onRequestClose={() => setPicking(false)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setPicking(false)} />
        <View style={s.sheet}>
          <View style={s.sheetGrip} />
          <Text style={s.sheetTitle}>{tr("Pick your avatar")}</Text>

          <View style={[s.preview, { backgroundColor: avatarColor }]}>
            {avatar
              ? <Image source={{ uri: avatarUrl(avatar, 220) }} style={s.previewImg} />
              : <Text style={s.previewTxt}>{initial}</Text>}
          </View>

          <Text style={s.pickLbl}>{tr("Avatar")}</Text>
          <View style={s.grid}>
            {AVATARS.map(a => (
              <TouchableOpacity
                key={a}
                onPress={() => saveAvatar(a, avatarColor)}
                style={[s.cell, { backgroundColor: avatarColor + "22" }, avatar === a && { borderColor: avatarColor, borderWidth: 2.5 }]}
                activeOpacity={0.8}
              >
                <Image source={{ uri: avatarUrl(a, 120) }} style={s.cellImg} />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.pickLbl}>{tr("Background")}</Text>
          <View style={s.swatchRow}>
            {AVATAR_COLORS.map(c => (
              <TouchableOpacity
                key={c}
                onPress={() => saveAvatar(avatar ?? AVATARS[0], c)}
                style={[s.swatch, { backgroundColor: c }, avatarColor === c && s.swatchOn]}
                activeOpacity={0.8}
              >
                {avatarColor === c && <Ionicons name="checkmark" size={15} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={[s.doneBtn, { backgroundColor: avatarColor }]} onPress={() => setPicking(false)} activeOpacity={0.85}>
            <Text style={s.doneTxt}>{tr("Done")}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  langBackdrop: { flex: 1, backgroundColor: "rgba(15,17,21,0.45)", justifyContent: "flex-end" },
  langSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 38, gap: 4 },
  langTitle: { fontSize: 21, fontWeight: "800", color: "#0f1115" },
  langHint: { fontSize: 15.5, color: "rgba(15,17,21,0.75)", lineHeight: 22, marginBottom: 8 },
  langRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.06)" },
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { paddingHorizontal: 18, paddingBottom: 142 },
  eyebrow: { fontSize: 11.5, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase", color: "#4B5FE8", marginBottom: 8 },
  h1: { fontSize: 31, color: "#0f1115", fontWeight: "800", letterSpacing: -0.5, marginBottom: 24 },
  card: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", borderRadius: 18, padding: 16, marginBottom: 18 },
  avatar: { width: 46, height: 46, borderRadius: 999, backgroundColor: "#4B5FE8", alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontSize: 20, fontWeight: "700" },
  avatarImg: { width: 46, height: 46, borderRadius: 23 },
  avatarEdit: { position: "absolute", bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(15,17,21,0.65)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  backdrop: { flex: 1, backgroundColor: "rgba(15,17,21,0.35)" },
  sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34 },
  sheetGrip: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(15,17,21,0.15)", alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: "700", color: "#0f1115", marginBottom: 16 },
  preview: { width: 74, height: 74, borderRadius: 37, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 18 },
  previewTxt: { fontSize: 36, color: "#fff", fontWeight: "700" },
  previewImg: { width: 74, height: 74, borderRadius: 37 },
  pickLbl: { fontSize: 12.5, fontWeight: "700", color: "rgba(15,17,21,0.55)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 18 },
  cell: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 2.5, borderColor: "transparent" },
  cellImg: { width: 48, height: 48, borderRadius: 24 },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 20 },
  swatch: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  swatchOn: { borderWidth: 3, borderColor: "rgba(15,17,21,0.18)" },
  doneBtn: { borderRadius: 16, paddingVertical: 15, alignItems: "center" },
  doneTxt: { fontSize: 16.5, color: "#fff", fontWeight: "700" },
  name: { color: "#0f1115", fontSize: 17.5, fontWeight: "700" },
  email: { color: "rgba(15,17,21,0.65)", fontSize: 13.5, marginTop: 3 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", borderRadius: 14, padding: 15, marginBottom: 9 },
  rowTxt: { flex: 1, color: "#0f1115", fontSize: 16, fontWeight: "600" },
});
