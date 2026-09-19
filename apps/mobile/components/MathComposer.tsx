/**
 * The science-expression writer in Take Note — the phone's version of the web
 * one. One set of buttons covering maths, chemistry, physics, statistics and
 * clinical dosage notation, shown typeset exactly as it will appear in the note.
 */
import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import katex from "katex";
import "katex/contrib/mhchem";
import { SCIENCE_STRUCTURES, SCIENCE_SYMBOLS, insertMathTemplate, type MathTemplate } from "@sano/shared";
import { MathText } from "./MathText";
import { useTr } from "../lib/useTr";

export type MathComposerResult = { latex: string; display: boolean };

export function MathComposer({
  visible, color, onInsert, onClose,
}: {
  visible: boolean;
  color: string;
  onInsert: (result: MathComposerResult) => void;
  onClose: () => void;
}) {
  const tr = useTr();
  const [latex, setLatex] = useState("");
  const [display, setDisplay] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  useEffect(() => {
    if (!visible) return;
    setLatex("");
    setDisplay(false);
  }, [visible]);

  function applyTemplate(t: MathTemplate) {
    const next = insertMathTemplate(latex, selection.start, selection.end, t);
    setLatex(next.text);
    setSelection({ start: next.selStart, end: next.selEnd });
  }

  let valid = true;
  try { if (latex.trim()) katex.renderToString(latex, { throwOnError: true, displayMode: true }); } catch { valid = false; }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        <View style={s.head}>
          <Text style={[s.title, { flex: 1 }]}>{tr("Write a science expression")}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel={tr("Close")}>
            <Ionicons name="close" size={26} color="#0f1115" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }} keyboardShouldPersistTaps="handled" >
            <View style={{ gap: 12 }}>
            <View style={s.btnWrap}>
              {SCIENCE_STRUCTURES.map(t => (
                <TouchableOpacity key={t.latex} onPress={() => applyTemplate(t)} style={s.structBtn} activeOpacity={0.7} accessibilityLabel={t.title}>
                  <Text style={s.structTxt}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.btnWrap}>
              {SCIENCE_SYMBOLS.map(t => (
                <TouchableOpacity key={t.latex} onPress={() => applyTemplate(t)} style={[s.symBtn, { backgroundColor: `${color}14` }]} activeOpacity={0.7}>
                  <Text style={s.symTxt}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              value={latex}
              onChangeText={setLatex}
              selection={selection}
              onSelectionChange={e => setSelection(e.nativeEvent.selection)}
              placeholder={"Tap the buttons, or type like \\frac{a}{b} or \\ce{H2SO4}"}
              placeholderTextColor="rgba(15,17,21,0.5)"
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              style={s.latexInput}
            />
          </View>

          <View style={[s.preview, { backgroundColor: `${color}0D`, borderColor: `${color}40` }]}>
            {latex.trim()
              ? valid
                ? <MathText text={`$$${latex}$$`} style={s.previewTxt} interactive />
                : <Text style={s.invalid}>{tr("This isn't a complete formula yet — check the brackets.")}</Text>
              : <Text style={s.previewHint}>{tr("Your formula appears here, typeset.")}</Text>}
          </View>
        </ScrollView>

        <View style={s.foot}>
          <View style={s.segment}>
            {([[false, tr("In the sentence")], [true, tr("Own line")]] as const).map(([value, label]) => (
              <TouchableOpacity key={label} onPress={() => setDisplay(value)} style={[s.segBtn, display === value && s.segOn]} activeOpacity={0.8}>
                <Text style={[s.segTxt, display === value && { color: "#0f1115" }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            onPress={() => onInsert({ latex: latex.trim(), display })}
            disabled={!latex.trim() || !valid}
            style={[s.insert, { backgroundColor: color }, (!latex.trim() || !valid) && { opacity: 0.4 }]}
            activeOpacity={0.85}
          >
            <Text style={s.insertTxt}>{tr("Insert")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF", paddingTop: 56 },
  head: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingBottom: 10 },
  title: { fontSize: 22, fontWeight: "800", color: "#0f1115", flex: 1 },
  subjects: { gap: 8, paddingHorizontal: 18, paddingBottom: 4 },
  subjectChip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "rgba(0,0,0,0.05)" },
  subjectTxt: { fontSize: 15, fontWeight: "700", color: "rgba(15,17,21,0.78)" },
  segment: { flexDirection: "row", backgroundColor: "rgba(0,0,0,0.05)", borderRadius: 999, padding: 3 },
  segBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  segOn: { backgroundColor: "#FFFFFF", shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segTxt: { fontSize: 15, fontWeight: "600", color: "rgba(15,17,21,0.7)" },
  pad: { height: 300, borderRadius: 18, overflow: "hidden", borderWidth: 1.5, borderColor: "rgba(0,0,0,0.12)" },
  padHint: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  padHintTxt: { fontSize: 17, color: "rgba(15,17,21,0.45)" },
  padRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  padBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  padBtnTxt: { fontSize: 15, fontWeight: "600", color: "#0f1115" },
  status: { fontSize: 14, color: "rgba(15,17,21,0.7)", flexShrink: 1, textAlign: "right" },
  btnWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  structBtn: { minWidth: 48, alignItems: "center", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9 },
  structTxt: { fontSize: 18, color: "#0f1115" },
  symBtn: { minWidth: 40, alignItems: "center", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 7 },
  symTxt: { fontSize: 17, color: "#0f1115" },
  latexInput: { minHeight: 64, borderWidth: 1.5, borderColor: "rgba(0,0,0,0.12)", borderRadius: 14, padding: 12, fontSize: 16, color: "#0f1115", fontFamily: "Menlo", textAlignVertical: "top" },
  preview: { minHeight: 90, borderRadius: 18, borderWidth: 1, padding: 14, justifyContent: "center" },
  previewTxt: { fontSize: 21, color: "#0f1115", textAlign: "center" },
  previewHint: { fontSize: 15, color: "rgba(15,17,21,0.6)", textAlign: "center" },
  invalid: { fontSize: 15, color: "#B91C1C", textAlign: "center" },
  fixLink: { fontSize: 15, fontWeight: "600", color: "rgba(15,17,21,0.75)", textDecorationLine: "underline" },
  foot: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 34, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.08)" },
  insert: { marginLeft: "auto", borderRadius: 999, paddingHorizontal: 26, paddingVertical: 12 },
  insertTxt: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
});
