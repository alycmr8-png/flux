import { useSignIn } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";

export default function SignInEmailScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSignIn() {
    if (!isLoaded) return;
    try {
      const result = await signIn.create({ identifier: email, password });
      await setActive({ session: result.createdSessionId });
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.errors?.[0]?.message ?? "Sign in failed");
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.root}>
      <Text style={s.title}>Sign in</Text>
      {error ? <Text style={s.err}>{error}</Text> : null}
      <TextInput style={s.input} placeholder="Email" placeholderTextColor="#444" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={s.input} placeholder="Password" placeholderTextColor="#444" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={s.btn} onPress={handleSignIn}>
        <Text style={s.btnTxt}>Sign in</Text>
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
  err: { fontSize: 12, color: "#f55", marginBottom: 12 },
  input: { borderWidth: 0.5, borderColor: "#222", borderRadius: 12, padding: 14, color: "#fff", fontSize: 14, marginBottom: 10, backgroundColor: "#111" },
  btn: { backgroundColor: "#fff", borderRadius: 14, padding: 16, alignItems: "center", marginTop: 4 },
  btnTxt: { fontSize: 15, color: "#000", fontFamily: "sans-serif-medium" },
  back: { marginTop: 20, alignItems: "center" },
  backTxt: { fontSize: 13, color: "#444" },
});
