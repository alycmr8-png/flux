import { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, ScrollView, StatusBar, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useSWR from "swr";
import { makeApiFetcher, useApi } from "../../lib/api";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";

type Message = { role: "user" | "assistant"; content: string };

export default function TutorScreen() {
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const api = useApi();
  const fetcher = makeApiFetcher(userId);
  const { data } = useSWR("/api/tutor/lectures", fetcher);
  const lectures: any[] = data?.data ?? [];

  const [selected, setSelected] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [selected?.id]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, loading]);

  async function send() {
    if (!input.trim() || !selected || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await api.post("/api/tutor/chat", { lectureId: selected.id, messages: next });
      setMessages([...next, { role: "assistant", content: res.data?.data?.reply ?? "" }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  if (!selected) {
    return (
      <>
        <StatusBar barStyle="light-content" />
        <ScrollView style={s.root} contentContainerStyle={[s.selectContent, { paddingTop: insets.top + 16 }]}>
          <Text style={s.title}>Tutor</Text>
          <Text style={s.sub}>I guide you with questions, not answers</Text>

          {lectures.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="school-outline" size={28} color="#333" style={{ marginBottom: 12 }} />
              <Text style={s.emptyTitle}>No lectures ready yet</Text>
              <Text style={s.emptyHint}>Record a lecture first — once it&apos;s processed, you can start a tutoring session</Text>
            </View>
          ) : (
            <>
              <Text style={s.sectionLbl}>Select a lecture</Text>
              {lectures.map((l) => (
                <TouchableOpacity
                  key={l.id}
                  style={s.lectureCard}
                  onPress={() => setSelected(l)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.lectureName} numberOfLines={1}>{l.title}</Text>
                    <Text style={s.lectureCourse}>{l.course?.name}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#333" />
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      </>
    );
  }

  const chatData: (Message | "welcome" | "typing")[] = [
    "welcome",
    ...messages,
    ...(loading ? ["typing" as const] : []),
  ];

  return (
    <>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={s.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={[s.chatHeader, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => setSelected(null)} style={s.backBtn}>
            <Ionicons name="arrow-back" size={16} color="#555" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.chatTitle} numberOfLines={1}>{selected.title}</Text>
            <Text style={s.chatSub}>Socratic mode · {selected.course?.name}</Text>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatRef}
          data={chatData}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={s.messages}
          renderItem={({ item }) => {
            if (item === "welcome") {
              return (
                <View style={s.assistantBubble}>
                  <Text style={s.assistantLabel}>Socratic Tutor</Text>
                  <Text style={s.assistantText}>
                    I won&apos;t give you direct answers — I&apos;ll ask questions that help you discover them yourself.{"\n\n"}What would you like to explore from <Text style={{ color: "#fff" }}>{selected.title}</Text>?
                  </Text>
                </View>
              );
            }
            if (item === "typing") {
              return (
                <View style={[s.assistantBubble, { flexDirection: "row", gap: 5, alignItems: "center" }]}>
                  {[0, 1, 2].map((i) => (
                    <View key={i} style={s.typingDot} />
                  ))}
                </View>
              );
            }
            const m = item as Message;
            return (
              <View style={m.role === "user" ? s.userBubble : s.assistantBubble}>
                <Text style={m.role === "user" ? s.userText : s.assistantText}>{m.content}</Text>
              </View>
            );
          }}
        />

        {/* Input */}
        <View style={[s.inputRow, { paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about this lecture…"
            placeholderTextColor="#333"
            multiline
            editable={!loading}
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || loading) && { opacity: 0.3 }]}
            onPress={send}
            disabled={!input.trim() || loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator size="small" color="#000" />
              : <Ionicons name="arrow-up" size={16} color="#000" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  selectContent: { paddingHorizontal: 16, paddingBottom: 110 },
  title: { fontSize: 32, color: "#fff", fontStyle: "italic", fontWeight: "300", marginBottom: 4 },
  sub: { fontSize: 12, color: "#444", marginBottom: 24 },
  sectionLbl: { fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: 2, fontWeight: "600", marginBottom: 10 },
  lectureCard: { backgroundColor: "#111", borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: "#1e1e1e", marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 10 },
  lectureName: { fontSize: 13, color: "#fff", fontWeight: "500", marginBottom: 2 },
  lectureCourse: { fontSize: 10, color: "#444" },
  emptyCard: { backgroundColor: "#111", borderRadius: 20, padding: 32, alignItems: "center", borderWidth: 0.5, borderColor: "#1e1e1e" },
  emptyTitle: { fontSize: 14, color: "#555", fontWeight: "500", marginBottom: 6 },
  emptyHint: { fontSize: 12, color: "#333", textAlign: "center", lineHeight: 18 },
  chatHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: "#1a1a1a" },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#111", borderWidth: 0.5, borderColor: "#1e1e1e", alignItems: "center", justifyContent: "center" },
  chatTitle: { fontSize: 14, color: "#fff", fontWeight: "500" },
  chatSub: { fontSize: 10, color: "#444", marginTop: 1 },
  messages: { paddingHorizontal: 16, paddingVertical: 16, gap: 10 },
  userBubble: { alignSelf: "flex-end", backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, maxWidth: "80%" },
  userText: { fontSize: 13, color: "#000", lineHeight: 19 },
  assistantBubble: { alignSelf: "flex-start", backgroundColor: "#111", borderRadius: 20, borderWidth: 0.5, borderColor: "#1e1e1e", paddingHorizontal: 14, paddingVertical: 12, maxWidth: "85%" },
  assistantLabel: { fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  assistantText: { fontSize: 13, color: "#888", lineHeight: 20 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#333" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: "#1a1a1a" },
  input: { flex: 1, backgroundColor: "#111", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 13, color: "#fff", borderWidth: 0.5, borderColor: "#1e1e1e", maxHeight: 100 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
});
