import { useSignUp } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";

export default function VerifyScreen() {
  const { signUp, setActive } = useSignUp();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function verify() {
    try {
      const result = await signUp!.attemptEmailAddressVerification({ code });
      await setActive!({ session: result.createdSessionId });
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.errors?.[0]?.message ?? "Verification failed");
    }
  }

  return (
    <View style={s.root}>
      <Text style={s.title}>Check your email</Text>
      <Text style={s.sub}>Enter the 6-digit code we sent you</Text>
      {error ? <Text style={s.err}>{error}</Text> : null}
      <TextInput style={s.input} placeholder="000000" placeholderTextColor="rgba(15,17,21,0.35)" value={code} onChangeText={setCode} keyboardType="number-pad" textAlign="center" maxLength={6} />
      <TouchableOpacity style={s.btn} onPress={verify}>
        <Text style={s.btnTxt}>Verify</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF", justifyContent: "center", padding: 24 },
  title: { fontFamily: "serif", fontSize: 32, color: "#0f1115", textAlign: "center", marginBottom: 6 },
  sub: { fontFamily: "sans-serif", fontSize: 13, color: "rgba(15,17,21,0.55)", textAlign: "center", marginBottom: 32 },
  err: { fontFamily: "sans-serif", fontSize: 12, color: "#DC2626", textAlign: "center", marginBottom: 12 },
  input: { fontFamily: "sans-serif", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", borderRadius: 12, padding: 14, color: "#0f1115", fontSize: 24, marginBottom: 12, backgroundColor: "#FFFFFF", letterSpacing: 8 },
  btn: { backgroundColor: "#4B5FE8", borderRadius: 999, padding: 14, alignItems: "center", marginTop: 4 },
  btnTxt: { fontFamily: "sans-serif-medium", fontSize: 14, color: "#fff" },
});
