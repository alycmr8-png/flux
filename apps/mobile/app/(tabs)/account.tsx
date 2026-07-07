import { ScrollView, View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useUser, useClerk } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "";

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { signOut } = useClerk();

  function confirmSignOut() {
    Alert.alert("Sign out?", "You can sign back in anytime.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => signOut() },
    ]);
  }

  return (
    <>
      <StatusBar barStyle="light-content" />
      <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]}>
        <Text style={s.eyebrow}>Account</Text>
        <Text style={s.h1}>Settings</Text>

        {/* Profile */}
        <View style={s.card}>
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>{(user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? "?").toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{user?.fullName ?? "Student"}</Text>
            <Text style={s.email}>{user?.emailAddresses?.[0]?.emailAddress ?? ""}</Text>
          </View>
        </View>

        {/* Billing */}
        <TouchableOpacity
          style={s.row}
          activeOpacity={0.7}
          onPress={() => {
            if (WEB_URL) WebBrowser.openBrowserAsync(`${WEB_URL}/dashboard/billing`);
            else Alert.alert("Billing", "Manage your plan from the Flux website (Dashboard → Billing).");
          }}
        >
          <Ionicons name="card-outline" size={17} color="#888" />
          <Text style={s.rowTxt}>Billing & plan</Text>
          <Ionicons name="open-outline" size={14} color="#444" />
        </TouchableOpacity>

        {/* Help */}
        <TouchableOpacity
          style={s.row}
          activeOpacity={0.7}
          onPress={() => Alert.alert("Help", "Questions or issues? Email us and we'll get you sorted.")}
        >
          <Ionicons name="help-circle-outline" size={17} color="#888" />
          <Text style={s.rowTxt}>Help & support</Text>
          <Ionicons name="chevron-forward" size={14} color="#444" />
        </TouchableOpacity>

        {/* Sign out */}
        <TouchableOpacity style={[s.row, { marginTop: 18 }]} onPress={confirmSignOut} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={17} color="#EF4444" />
          <Text style={[s.rowTxt, { color: "#F87171" }]}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0F0F0E" },
  content: { paddingHorizontal: 18, paddingBottom: 120 },
  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase", color: "#60A5FA", marginBottom: 8 },
  h1: { fontSize: 27, color: "#fff", fontWeight: "800", letterSpacing: -0.5, marginBottom: 22 },
  card: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 0.5, borderColor: "#1e1e1e", borderRadius: 18, padding: 16, marginBottom: 18 },
  avatar: { width: 46, height: 46, borderRadius: 999, backgroundColor: "#2563EB", alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontSize: 18, fontWeight: "700" },
  name: { color: "#fff", fontSize: 15, fontWeight: "600" },
  email: { color: "#666", fontSize: 12, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 0.5, borderColor: "#1e1e1e", borderRadius: 14, padding: 15, marginBottom: 9 },
  rowTxt: { flex: 1, color: "#ddd", fontSize: 13.5, fontWeight: "500" },
});
