/**
 * The "Add Photo" tab: whiteboards, slides, handwritten pages. Ucorns reads each
 * photo (maths typeset) and files it into the class's memory so Ask can answer
 * from it. Mirrors the web workspace's Add Photo tab.
 */
import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Modal, ScrollView,
  ActivityIndicator, Alert, Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import useSWR from "swr";
import { mathToPlainText } from "@sano/shared";
import { MathText } from "./MathText";
import { API_BASE } from "../lib/apiBase";
import { useTr } from "../lib/useTr";

const BASE_URL = API_BASE;
const MAX_PER_UPLOAD = 10;

type Photo = { id: string; text: string; status: "reading" | "ready" | "error"; createdAt: string; imageUrl: string };

function when(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}, ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export function ClassPhotos({ api, fetcher, course, color }: { api: any; fetcher: any; course: { id: string; name: string }; color: string }) {
  const tr = useTr();
  const { data, mutate } = useSWR(`/api/photos?courseId=${course.id}`, fetcher, {
    // Poll only while a photo is still being read.
    refreshInterval: (latest: any) => ((latest?.data ?? []).some((p: Photo) => p.status === "reading") ? 2500 : 0),
  });
  const photos: Photo[] = data?.data ?? [];
  const [uploading, setUploading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = photos.find(p => p.id === openId) ?? null;

  async function pick(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(fromCamera ? tr("Camera denied") : tr("Photos denied"), tr("Enable access in Settings to add photos."));
      return;
    }
    // quality < 1 has the picker re-encode as JPEG, which the reader accepts (HEIC isn't).
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsMultipleSelection: true, selectionLimit: MAX_PER_UPLOAD });
    if (res.canceled || !res.assets.length) return;
    upload(res.assets.slice(0, MAX_PER_UPLOAD).map(a => a.uri));
  }

  async function upload(uris: string[]) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("courseId", course.id);
      uris.forEach((uri, i) => {
        const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
        fd.append("photos", { uri, name: `photo-${i + 1}.${ext === "png" ? "png" : "jpg"}`, type: ext === "png" ? "image/png" : "image/jpeg" } as any);
      });
      const res = await api.post("/api/photos", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await mutate({ data: [...(res.data?.data ?? []), ...photos] }, { revalidate: false });
    } catch (e: any) {
      const status = e?.response?.status;
      Alert.alert(
        tr("Couldn't add photos"),
        status === 429 ? tr("You've used what the free plan includes. Upgrade to keep going.")
          : status === 415 ? tr("Photos must be JPEG, PNG, WebP or GIF.")
          : tr("Try again in a moment."),
      );
    } finally {
      setUploading(false);
    }
  }

  function remove(id: string) {
    Alert.alert(tr("Delete this photo?"), tr("The photo and what Ucorns read from it are removed, and Ask will stop using it."), [
      { text: tr("Cancel"), style: "cancel" },
      {
        text: tr("Delete"),
        style: "destructive",
        onPress: async () => {
          setOpenId(null);
          await mutate({ data: photos.filter(p => p.id !== id) }, { revalidate: false });
          try { await api.delete(`/api/photos/${id}`); } catch { Alert.alert(tr("Couldn't delete that photo"), tr("Try again.")); mutate(); }
        },
      },
    ]);
  }

  async function retry(id: string) {
    await mutate({ data: photos.map(p => (p.id === id ? { ...p, status: "reading" as const } : p)) }, { revalidate: false });
    try { await api.post(`/api/photos/${id}/retry`); } finally { mutate(); }
  }

  const tileWidth = (Dimensions.get("window").width - 40 - 12) / 2;

  return (
    <View>
      <View style={s.hero}>
        <Text style={s.heroTitle}>Add photos to {course.name}</Text>
        <Text style={s.heroSub}>
          The whiteboard, a slide, your handwritten notes, a page of the textbook. Ucorns reads each photo — formulas included — so Ask can answer from it.
        </Text>
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: color }, uploading && { opacity: 0.6 }]}
          disabled={uploading}
          activeOpacity={0.85}
          onPress={() => Alert.alert(tr("Add photos"), tr("Capture the board or pick existing photos."), [
            { text: tr("Take photo"), onPress: () => pick(true) },
            { text: tr("Choose photos"), onPress: () => pick(false) },
            { text: tr("Cancel"), style: "cancel" },
          ])}
        >
          {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={20} color="#fff" />}
          <Text style={s.addTxt}>{uploading ? tr("Adding…") : tr("Take or add photos")}</Text>
        </TouchableOpacity>
      </View>

      {photos.length === 0 && !uploading ? (
        <View style={s.empty}>
          <Ionicons name="images-outline" size={30} color="rgba(15,17,21,0.5)" />
          <Text style={s.emptyTxt}>{tr("No photos in this class yet.")}</Text>
        </View>
      ) : (
        <View style={s.grid}>
          {photos.map(p => (
            <TouchableOpacity key={p.id} style={[s.tile, { width: tileWidth }]} activeOpacity={0.85} onPress={() => setOpenId(p.id)}>
              <View>
                <Image source={{ uri: `${BASE_URL}${p.imageUrl}` }} style={s.tileImg} />
                {p.status === "reading" && (
                  <View style={[s.badge, { backgroundColor: "rgba(15,17,21,0.75)" }]}>
                    <ActivityIndicator size="small" color="#fff" style={{ transform: [{ scale: 0.7 }] }} />
                    <Text style={s.badgeTxt}>{tr("Reading…")}</Text>
                  </View>
                )}
                {p.status === "error" && (
                  <View style={[s.badge, { backgroundColor: "#DC2626" }]}>
                    <Ionicons name="alert-circle" size={13} color="#fff" />
                    <Text style={s.badgeTxt}>{tr("Couldn't read")}</Text>
                  </View>
                )}
              </View>
              <View style={s.tileBody}>
                <Text style={[s.tilePreview, !p.text && { color: "rgba(15,17,21,0.62)" }]} numberOfLines={2}>
                  {p.status === "reading" ? tr("Ucorns is reading this photo…")
                    : p.status === "error" ? tr("Tap to try again.")
                    : p.text ? mathToPlainText(p.text).replace(/\s+/g, " ").trim() : tr("Nothing readable in this photo.")}
                </Text>
                <Text style={s.tileDate}>{when(p.createdAt)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Modal visible={!!open} animationType="slide" onRequestClose={() => setOpenId(null)}>
        {open && (
          <View style={s.viewer}>
            <View style={s.viewerHead}>
              <Text style={s.viewerTitle}>{tr("What Ucorns read")}</Text>
              <Text style={s.viewerDate}>· {when(open.createdAt)}</Text>
              <TouchableOpacity onPress={() => setOpenId(null)} style={s.closeBtn} hitSlop={10}>
                <Ionicons name="close" size={24} color="#0f1115" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
              <View style={s.viewerImgWrap}>
                <Image source={{ uri: `${BASE_URL}${open.imageUrl}` }} style={s.viewerImg} resizeMode="contain" />
              </View>
              <View style={{ padding: 20 }}>
                {open.status === "reading" ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <ActivityIndicator size="small" color={color} />
                    <Text style={s.viewerMuted}>{tr("Reading this photo…")}</Text>
                  </View>
                ) : open.status === "error" ? (
                  <View style={{ gap: 12 }}>
                    <Text style={s.viewerMuted}>{tr("Ucorns couldn't read this photo.")}</Text>
                    <TouchableOpacity onPress={() => retry(open.id)} style={[s.retryBtn, { backgroundColor: color }]} activeOpacity={0.85}>
                      <Ionicons name="refresh" size={17} color="#fff" />
                      <Text style={s.retryTxt}>{tr("Try again")}</Text>
                    </TouchableOpacity>
                  </View>
                ) : open.text ? (
                  <MathText text={open.text} style={s.viewerText} interactive />
                ) : (
                  <Text style={s.viewerMuted}>{tr("Nothing readable in this photo.")}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => remove(open.id)} style={s.deleteBtn} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={18} color="#DC2626" />
                <Text style={s.deleteTxt}>{tr("Delete photo")}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: "#FFFFFF", borderRadius: 22, padding: 20, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", marginBottom: 16 },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#0f1115", marginBottom: 8 },
  heroSub: { fontSize: 16.5, color: "rgba(15,17,21,0.82)", lineHeight: 24, marginBottom: 16 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 16, paddingVertical: 15 },
  addTxt: { fontSize: 18, fontWeight: "700", color: "#fff" },
  empty: { alignItems: "center", gap: 10, borderRadius: 22, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(0,0,0,0.18)", paddingVertical: 34 },
  emptyTxt: { fontSize: 17, color: "rgba(15,17,21,0.75)" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" },
  tileImg: { width: "100%", aspectRatio: 4 / 3, backgroundColor: "rgba(0,0,0,0.05)" },
  badge: { position: "absolute", left: 8, top: 8, flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { fontSize: 12.5, fontWeight: "700", color: "#fff" },
  tileBody: { padding: 10 },
  tilePreview: { fontSize: 14.5, color: "rgba(15,17,21,0.85)", lineHeight: 20 },
  tileDate: { fontSize: 13, color: "rgba(15,17,21,0.62)", marginTop: 5 },
  viewer: { flex: 1, backgroundColor: "#FFFFFF", paddingTop: 56 },
  viewerHead: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.08)" },
  viewerTitle: { fontSize: 19, fontWeight: "700", color: "#0f1115" },
  viewerDate: { fontSize: 15, color: "rgba(15,17,21,0.65)", flex: 1 },
  closeBtn: { padding: 4 },
  viewerImgWrap: { backgroundColor: "#0f1115" },
  viewerImg: { width: "100%", height: 320 },
  viewerText: { fontSize: 17, color: "#0f1115", lineHeight: 27 },
  viewerMuted: { fontSize: 17, color: "rgba(15,17,21,0.78)" },
  retryBtn: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  retryTxt: { fontSize: 16, fontWeight: "700", color: "#fff" },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: 20, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(220,38,38,0.25)" },
  deleteTxt: { fontSize: 17, fontWeight: "600", color: "#DC2626" },
});
