import { useSignUp } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
} from "react-native";

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

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
      <Text style={s.title}>StudyAgent</Text>
      <Text style={s.sub}>Create your account</Text>
      {error ? <Text style={s.err}>{error}</Text> : null}
      <TextInput style={s.input} placeholder="Full name" placeholderTextColor="#444" value={name} onChangeText={setName} />
      <TextInput style={s.input} placeholder="Email" placeholderTextColor="#444" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={s.input} placeholder="Password" placeholderTextColor="#444" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={s.btn} onPress={handleSignUp}>
        <Text style={s.btnTxt}>Create account</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push("/(auth)/sign-in")}>
        <Text style={s.link}>Already have an account? Sign in</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", justifyContent: "center", padding: 24 },
  title: { fontFamily: "serif", fontSize: 40, color: "#fff", textAlign: "center", marginBottom: 6 },
  sub: { fontFamily: "sans-serif", fontSize: 13, color: "#555", textAlign: "center", marginBottom: 32 },
  err: { fontFamily: "sans-serif", fontSize: 12, color: "#f55", textAlign: "center", marginBottom: 12 },
  input: { fontFamily: "sans-serif", borderWidth: 0.5, borderColor: "#222", borderRadius: 12, padding: 14, color: "#fff", fontSize: 14, marginBottom: 12, backgroundColor: "#111" },
  btn: { backgroundColor: "#fff", borderRadius: 999, padding: 14, alignItems: "center", marginTop: 4 },
  btnTxt: { fontFamily: "sans-serif-medium", fontSize: 14, color: "#000" },
  link: { fontFamily: "sans-serif", fontSize: 13, color: "#555", textAlign: "center", marginTop: 20 },
});
