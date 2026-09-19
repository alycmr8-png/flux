import { useSignIn } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { useTr } from "../../lib/useTr";

export default function SignInEmailScreen() {
  const tr = useTr();
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
      setError(e.errors?.[0]?.message ?? tr("Sign in failed"));
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.root}>
      <Text style={s.title}>{tr("Sign in")}</Text>
      {error ? <Text style={s.err}>{error}</Text> : null}
      <TextInput style={s.input} placeholder={tr("Email")} placeholderTextColor="rgba(15,17,21,0.35)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={s.input} placeholder={tr("Password")} placeholderTextColor="rgba(15,17,21,0.35)" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={s.btn} onPress={handleSignIn}>
        <Text style={s.btnTxt}>{tr("Sign in")}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.back()} style={s.back}>
        <Text style={s.backTxt}>← Back</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF", padding: 24, justifyContent: "center" },
  title: { fontSize: 32, color: "#0f1115", fontFamily: "serif", marginBottom: 28 },
  err: { fontSize: 12, color: "#DC2626", marginBottom: 12 },
  input: { borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", borderRadius: 12, padding: 14, color: "#0f1115", fontSize: 14, marginBottom: 10, backgroundColor: "#FFFFFF" },
  btn: { backgroundColor: "#4B5FE8", borderRadius: 14, padding: 16, alignItems: "center", marginTop: 4 },
  btnTxt: { fontSize: 15, color: "#fff", fontFamily: "sans-serif-medium" },
  back: { marginTop: 20, alignItems: "center" },
  backTxt: { fontSize: 13, color: "rgba(15,17,21,0.55)" },
});
