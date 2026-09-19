/**
 * Playback for an opened recording, above its results — the phone's version
 * of the web's audio player. The audio streams through a short-lived signed URL
 * (media players can't send the login header), and tapping the bar seeks.
 */
import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, type LayoutChangeEvent, type GestureResponderEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { API_BASE } from "../lib/apiBase";

const BASE_URL = API_BASE;

const clock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
};

export function LectureAudioBar({ api, lectureId, recordedAt, color }: { api: any; lectureId: string; recordedAt?: string | null; color: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.get(`/api/lectures/${lectureId}/audio-url`)
      .then((r: any) => { if (!cancelled && r.data?.data?.url) setUrl(`${BASE_URL}${r.data.data.url}`); })
      .catch(() => { if (!cancelled) setMissing(true); });
    return () => { cancelled = true; };
  }, [api, lectureId]);

  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);
  useEffect(() => () => { try { player.pause(); } catch { /* released */ } }, [player]);

  if (missing) return null;

  const duration = status.duration || 0;
  const progress = duration > 0 ? Math.min(1, status.currentTime / duration) : 0;

  function toggle() {
    if (status.playing) return player.pause();
    if (duration > 0 && status.currentTime >= duration - 0.5) player.seekTo(0);
    player.play();
  }

  function seek(e: GestureResponderEvent) {
    if (!width || !duration) return;
    player.seekTo(Math.max(0, Math.min(1, e.nativeEvent.locationX / width)) * duration);
  }

  return (
    <View style={s.card}>
      <View style={s.row}>
        <TouchableOpacity onPress={toggle} disabled={!url} style={[s.playBtn, { backgroundColor: color }, !url && { opacity: 0.5 }]} activeOpacity={0.85}>
          {!url || (status.isBuffering && !status.playing)
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name={status.playing ? "pause" : "play"} size={20} color="#fff" style={!status.playing && { marginLeft: 2 }} />}
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <TouchableOpacity activeOpacity={1} onPress={seek} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={s.trackHit}>
            <View style={s.track}>
              <View style={[s.fill, { width: `${progress * 100}%`, backgroundColor: color }]} />
            </View>
          </TouchableOpacity>
          <View style={s.times}>
            <Text style={s.time}>{clock(status.currentTime)}</Text>
            <Text style={s.time}>{duration ? clock(duration) : "--:--"}</Text>
          </View>
        </View>
      </View>
      {recordedAt ? (
        <Text style={s.date}>
          Recorded {new Date(recordedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", marginBottom: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  playBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  trackHit: { paddingVertical: 8 },
  track: { height: 6, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.1)", overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  times: { flexDirection: "row", justifyContent: "space-between" },
  time: { fontSize: 14.5, color: "rgba(15,17,21,0.78)", fontVariant: ["tabular-nums"] },
  date: { fontSize: 15, color: "rgba(15,17,21,0.72)", marginTop: 8 },
});
