import { useSignUp, useSSO } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";

// Required so the OAuth browser popup can hand the session back to the app
WebBrowser.maybeCompleteAuthSession();

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function handleGoogle() {
    try {
      const { createdSessionId, setActive: sa } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId) {
        await sa!({ session: createdSessionId });
        router.replace("/(tabs)");
      } else {
        // Flow finished without a session (cancelled, or extra steps required)
        Alert.alert("Almost there", "Google didn't complete sign-in. Try again, or use email and password below.");
      }
    } catch (e: any) {
      const msg = e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? e?.message ?? "Unknown error";
      Alert.alert("Google sign-in failed", msg);
    }
  }

  async function handleSignUp() {
    if (!isLoaded) return;
    try {
      const [firstName, ...rest] = name.trim().split(" ");
      await signUp.create({ emailAddress: email, password, firstName, lastName: rest.join(" ") });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      router.push("/(auth)/verify");
    } catch (e: any) {
      setError(e.errors?.[0]?.message ?? "Sign up failed");
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.root}>
      <Text style={s.title}>Create Account</Text>

      <TouchableOpacity style={s.google} onPress={handleGoogle} activeOpacity={0.85}>
        <Text style={s.googleTxt}>Continue with Google</Text>
      </TouchableOpacity>

      <View style={s.divider}>
        <View style={s.divLine} />
        <Text style={s.divTxt}>or</Text>
        <View style={s.divLine} />
      </View>

      {error ? <Text style={s.err}>{error}</Text> : null}
      <TextInput style={s.input} placeholder="Full name" placeholderTextColor="#444" value={name} onChangeText={setName} />
      <TextInput style={s.input} placeholder="Email" placeholderTextColor="#444" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={s.input} placeholder="Password" placeholderTextColor="#444" value={password} onChangeText={setPassword} secureTextEntry />

      <TouchableOpacity style={s.btn} onPress={handleSignUp} activeOpacity={0.85}>
        <Text style={s.btnTxt}>Create Account</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()} style={s.back}>
        <Text style={s.backTxt}>← Back</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", padding: 24, justifyContent: "center" },
  title: { fontSize: 32, color: "#fff", fontFamily: "serif", marginBottom: 28 },
  google: { backgroundColor: "#fff", borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 20 },
  googleTxt: { fontSize: 15, color: "#000", fontFamily: "sans-serif-medium" },
  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  divLine: { flex: 1, height: 0.5, backgroundColor: "#222" },
  divTxt: { fontSize: 12, color: "#444" },
  err: { fontSize: 12, color: "#f55", marginBottom: 12 },
  input: { borderWidth: 0.5, borderColor: "#222", borderRadius: 12, padding: 14, color: "#fff", fontSize: 14, marginBottom: 10, backgroundColor: "#111" },
  btn: { borderWidth: 0.5, borderColor: "#333", borderRadius: 14, padding: 16, alignItems: "center", marginTop: 4 },
  btnTxt: { fontSize: 15, color: "#fff", fontFamily: "sans-serif-medium" },
  back: { marginTop: 20, alignItems: "center" },
  backTxt: { fontSize: 13, color: "#444" },
});
