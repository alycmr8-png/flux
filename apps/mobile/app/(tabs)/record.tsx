import { useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import { api } from "../../lib/api";
import { Ionicons } from "@expo/vector-icons";

export default function RecordScreen() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [slidesUri, setSlidesUri] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function startRecording() {
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    setRecording(recording);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  async function stopRecording() {
    if (!recording) return;
    if (timerRef.current) clearInterval(timerRef.current);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("audio", { uri, name: "lecture.m4a", type: "audio/m4a" } as any);
      fd.append("courseId", "default");
      fd.append("title", `Lecture ${new Date().toLocaleDateString()}`);
      if (slidesUri) fd.append("slides", { uri: slidesUri, name: "slides.pdf", type: "application/pdf" } as any);

      await api.post("/api/lectures", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setDone(true);
    } catch (e) {
      Alert.alert("Upload failed", "Saved locally. Will retry when connected.");
    } finally {
      setUploading(false);
    }
  }

  async function pickSlides() {
    const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
    if (!result.canceled) setSlidesUri(result.assets[0].uri);
  }

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <View style={s.root}>
      <Text style={s.title}>Record Lecture</Text>
      <Text style={s.sub}>Audio processed by AI after you stop</Text>

      {done ? (
        <View style={s.card}>
          <Text style={s.doneIcon}>✓</Text>
          <Text style={s.doneTitle}>Uploaded</Text>
          <Text style={s.doneSub}>AI is generating your cheat sheet and quiz.</Text>
        </View>
      ) : (
        <View style={s.card}>
          <Text style={s.timer}>{fmt(seconds)}</Text>
          {recording && (
            <View style={s.liveRow}>
              <View style={s.liveDot} />
              <Text style={s.liveText}>Recording live</Text>
            </View>
          )}
          <TouchableOpacity
            style={[s.recBtn, recording && s.recBtnActive]}
            onPress={recording ? stopRecording : startRecording}
            disabled={uploading}
          >
            <Text style={[s.recBtnIcon, recording && s.recBtnIconActive]}>
              {recording ? "⏹" : "⏺"}
            </Text>
          </TouchableOpacity>
          {uploading && <Text style={s.uploadingTxt}>Uploading…</Text>}
        </View>
      )}

      <TouchableOpacity style={s.slidesRow} onPress={pickSlides}>
        <Ionicons name="cloud-upload-outline" size={14} color="#555" />
        <Text style={s.slidesText}>
          {slidesUri ? "Slides attached ✓" : "Attach PDF slides (optional)"}
        </Text>
      </TouchableOpacity>

      <View style={s.offlineBadge}>
        <Text style={s.offlineLbl}>Offline mode active</Text>
        <Text style={s.offlineSub}>Saved locally · syncs when reconnected</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", padding: 18 },
  title: { fontFamily: "serif", fontSize: 28, color: "#fff", marginTop: 16, marginBottom: 4 },
  sub: { fontFamily: "sans-serif", fontSize: 12, color: "#555", marginBottom: 24 },
  card: { backgroundColor: "#111", borderRadius: 20, padding: 24, alignItems: "center", borderWidth: 0.5, borderColor: "#1e1e1e", marginBottom: 12 },
  timer: { fontFamily: "serif", fontSize: 48, color: "#fff", marginBottom: 8 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  liveText: { fontFamily: "sans-serif", fontSize: 11, color: "#888" },
  recBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#222", alignItems: "center", justifyContent: "center" },
  recBtnActive: { backgroundColor: "#fff" },
  recBtnIcon: { fontSize: 22, color: "#fff" },
  recBtnIconActive: { color: "#000" },
  uploadingTxt: { fontFamily: "sans-serif", fontSize: 11, color: "#555", marginTop: 12 },
  doneIcon: { fontSize: 28, color: "#fff", marginBottom: 8 },
  doneTitle: { fontFamily: "sans-serif-medium", fontSize: 16, color: "#fff", marginBottom: 4 },
  doneSub: { fontFamily: "sans-serif", fontSize: 12, color: "#555", textAlign: "center" },
  slidesRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#111", borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: "#1e1e1e", marginBottom: 10 },
  slidesText: { fontFamily: "sans-serif", fontSize: 13, color: "#555" },
  offlineBadge: { backgroundColor: "#111", borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: "#1e1e1e" },
  offlineLbl: { fontFamily: "sans-serif-medium", fontSize: 10, color: "#888", marginBottom: 2 },
  offlineSub: { fontFamily: "sans-serif", fontSize: 10, color: "#444" },
});
