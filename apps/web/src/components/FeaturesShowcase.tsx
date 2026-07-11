"use client";
import { useState } from "react";
import { Mic2, FileText, BookOpen, BookMarked, Youtube, PenLine } from "lucide-react";

const TABS = [
  { key: "record",    label: "Record",       icon: Mic2       },
  { key: "files",     label: "Upload Files", icon: FileText   },
  { key: "quiz",      label: "Quizzes",      icon: BookOpen   },
  { key: "studybook", label: "Study Book",   icon: BookMarked },
  { key: "video",     label: "Upload Video", icon: Youtube    },
  { key: "note",      label: "Take Note",    icon: PenLine    },
] as const;

function RecordPreview() {
  return (
    <div className="space-y-3">
      {/* Recording card — white like platform */}
      <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
        <div className="text-xs text-[#888] self-start font-medium">Week 4 — Cognitive Biases</div>
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 56, fontWeight: 400, color: "#111110", letterSpacing: -2, fontVariantNumeric: "tabular-nums" }}>
          01:24
        </div>
        {/* Wave bars */}
        <div className="flex items-end gap-0.5 h-10">
          {[0.4,0.7,1,0.6,0.9,0.5,0.8,1,0.6,0.4,0.7,0.9,0.5,0.8,0.6,1,0.7,0.4,0.9,0.5].map((h, i) => (
            <div key={i} style={{ width: 3, height: 40 * h, borderRadius: 2, background: "#111110", opacity: 0.8 + h * 0.2 }} />
          ))}
        </div>
        <div className="flex gap-3 w-full">
          <div className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl" style={{ border: "1px solid rgba(0,0,0,0.1)" }}>
            <span className="text-sm font-medium text-[#111110]">Pause</span>
          </div>
          <div className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl" style={{ background: "#111110" }}>
            <span className="text-sm font-medium text-white">Stop</span>
          </div>
        </div>
      </div>

      {/* Previous recordings — white card like platform */}
      <div className="bg-white rounded-2xl p-4" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
        <div className="text-[10px] uppercase tracking-widest mb-3" style={{ color: "#6E7FF3", fontWeight: 600 }}>Previous recordings</div>
        {[
          { title: "Week 3 — Memory & Cognition",  dur: "48:12" },
          { title: "Week 2 — Behavioral Theory",   dur: "51:03" },
          { title: "Week 1 — Introduction",         dur: "39:47" },
        ].map(({ title, dur }, i) => (
          <div key={i} className="flex items-center justify-between py-2.5 border-b last:border-0" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
            <span className="text-sm text-[#111110]">{title}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "#888" }}>{dur}</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(75,95,232,0.1)", color: "#4B5FE8" }}>AI ready</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotePreview() {
  return (
    <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
      <div className="text-[10px] uppercase tracking-widest mb-1 font-semibold" style={{ color: "#6E7FF3" }}>Take Note</div>
      <div className="text-base font-semibold text-[#111110] mb-4">Week 3 — Memory & Cognition</div>
      <div className="space-y-2 text-sm text-[#555] leading-relaxed">
        <p>Short-term memory holds roughly <strong className="text-[#111110]">7 ± 2 items</strong> at once (Miller's Law).</p>
        <p>Spaced repetition increases long-term retention by <strong className="text-[#111110]">up to 80%</strong> compared to massed practice.</p>
        <p>The <strong className="text-[#111110]">testing effect</strong>: actively retrieving information strengthens memory more than re-reading.</p>
      </div>
      <div className="mt-4 pt-4 border-t border-[rgba(0,0,0,0.06)] flex gap-2">
        <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(75,95,232,0.08)", color: "#4B5FE8" }}>PSYC 301</span>
        <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(0,0,0,0.04)", color: "#888" }}>Week 3</span>
      </div>
    </div>
  );
}

function CheatSheetPreview() {
  return (
    <div className="rounded-2xl p-6" style={{ background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.08)" }}>
      <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "rgba(0,0,0,0.35)" }}>Files</div>
      <div className="text-lg mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontStyle: "italic", color: "#0f1115" }}>Week 3 &mdash; Memory &amp; Cognition</div>
      <div className="space-y-4">
        {[
          { heading: "Types of Memory", bullets: ["Sensory memory lasts 1–3 seconds", "Short-term memory holds 7±2 items", "Long-term memory is virtually unlimited"] },
          { heading: "Encoding Strategies", bullets: ["Elaborative rehearsal links new info to existing", "Spaced repetition boosts retention by 80%", "The testing effect: retrieval strengthens memory"] },
        ].map((section, i) => (
          <div key={i}>
            <div className="text-xs font-semibold mb-2" style={{ color: "#0f1115" }}>{section.heading}</div>
            {section.bullets.map((b, j) => (
              <div key={j} className="flex items-start gap-2 mb-1">
                <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: "rgba(0,0,0,0.3)" }} />
                <span className="text-xs leading-relaxed" style={{ color: "rgba(0,0,0,0.6)" }}>{b}</span>
              </div>
            ))}
          </div>
        ))}
        <div>
          <div className="text-xs font-semibold mb-2" style={{ color: "#0f1115" }}>Key Terms</div>
          <div className="flex flex-wrap gap-2">
            {["Encoding", "Retrieval", "Mnemonics", "Chunking", "Priming"].map(term => (
              <span key={term} className="text-[10px] px-2.5 py-1 rounded-full" style={{ background: "rgba(0,0,0,0.1)", color: "#0f1115" }}>{term}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuizPreview() {
  const [selected, setSelected] = useState<number | null>(0);
  return (
    <div className="rounded-2xl p-6" style={{ background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.08)" }}>
      <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "rgba(0,0,0,0.35)" }}>Question 2 of 8</div>
      <div className="text-sm font-medium leading-relaxed mb-5" style={{ color: "#0f1115" }}>
        Which memory system has the largest storage capacity?
      </div>
      <div className="space-y-2 mb-5">
        {["Sensory memory", "Short-term memory", "Long-term memory", "Working memory"].map((opt, i) => (
          <button key={i} onClick={() => setSelected(i)}
            className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all"
            style={{
              border: `1px solid ${selected === i ? "#4B5FE8" : "rgba(0,0,0,0.1)"}`,
              background: selected === i ? "rgba(75,95,232,0.1)" : "rgba(0,0,0,0.04)",
              color: selected === i ? "#0f1115" : "rgba(0,0,0,0.6)",
            }}>
            <span className="w-3 h-3 rounded-full border shrink-0"
              style={{ borderColor: selected === i ? "#4B5FE8" : "rgba(0,0,0,0.3)", background: selected === i ? "#4B5FE8" : "transparent" }} />
            {opt}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "rgba(0,0,0,0.35)" }}>Auto-generated from your lecture</span>
        <button className="text-xs font-medium px-4 py-2 rounded-full" style={{ background: "#4B5FE8", color: "white" }}>Next →</button>
      </div>
    </div>
  );
}

function StudyBookPreview() {
  const spines = ["#8fa389", "#b0a08a", "#a08ab0", "#8ab0b0"];
  return (
    <div className="space-y-3">
      {[
        { title: "Midterm Complete Study Guide", chapters: 6, terms: 24, flashcards: 18 },
        { title: "Week 3 - Memory & Cognition",  chapters: 4, terms: 16, flashcards: 12 },
        { title: "Final Exam Master Book",        chapters: 8, terms: 36, flashcards: 24 },
      ].map((book, i) => (
        <div key={i} className="flex overflow-hidden rounded-2xl" style={{ background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.08)" }}>
          <div className="w-3 shrink-0" style={{ background: spines[i % spines.length] }} />
          <div className="px-5 py-4 flex-1 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium mb-1" style={{ color: "#0f1115" }}>{book.title}</div>
              <div className="text-xs" style={{ color: "rgba(0,0,0,0.4)" }}>
                {book.chapters} chapters · {book.terms} terms · {book.flashcards} flashcards
              </div>
            </div>
            <div className="text-lg shrink-0" style={{ color: "rgba(0,0,0,0.2)" }}>›</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function VideoPreview() {
  const [vtab, setVtab] = useState("summary");
  const [quizSelected, setQuizSelected] = useState<number | null>(null);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const vtabs = ["Summary", "Transcript", "Flashcards", "Quiz", "Chatbot"];

  const flashcards = [
    { q: "What is psychology?", a: "The scientific study of mind and behavior, examining thoughts, emotions, and actions." },
    { q: "Who opened the first psychology lab?", a: "Wilhelm Wundt, in Leipzig, Germany in 1879." },
    { q: "What is behaviorism?", a: "A school of thought (Watson, Skinner) focused only on observable behavior, rejecting the study of the mind." },
    { q: "What is the cognitive revolution?", a: "A shift in the 1950s–70s back to studying mental processes like memory, perception, and reasoning." },
    { q: "Name the 7 major perspectives in psychology.", a: "Biological, evolutionary, psychodynamic, behavioral, cognitive, social-cultural, humanistic." },
    { q: "What is structuralism?", a: "Wundt's approach using introspection to break down conscious experience into basic elements." },
  ];

  return (
    <div className="space-y-4">
      {/* URL bar */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: "rgba(75,95,232,0.08)", border: "1px solid rgba(75,95,232,0.25)" }}>
          <Youtube size={14} style={{ color: "#6E7FF3" }} />
          <span className="text-sm" style={{ color: "rgba(0,0,0,0.4)" }}>youtube.com/watch?v=vo4pMVb0R6M</span>
        </div>
        <div className="px-5 py-3 rounded-xl text-sm font-semibold shrink-0" style={{ background: "#4B5FE8", color: "white" }}>Load</div>
      </div>

      {/* Real YouTube embed */}
      <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
        <iframe
          src="https://www.youtube.com/embed/vo4pMVb0R6M"
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: "rgba(75,95,232,0.1)", border: "1px solid rgba(75,95,232,0.15)" }}>
        {vtabs.map(t => (
          <button key={t} onClick={() => setVtab(t.toLowerCase())}
            className="flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
            style={{ background: vtab === t.toLowerCase() ? "#4B5FE8" : "transparent", color: vtab === t.toLowerCase() ? "white" : "rgba(0,0,0,0.45)" }}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.08)", minHeight: 280 }}>

        {/* SUMMARY */}
        {vtab === "summary" && (
          <div className="space-y-4">
            <div className="text-sm font-semibold" style={{ color: "#0f1115" }}>Intro to Psychology — Crash Course #1</div>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(0,0,0,0.65)" }}>
              Psychology is the scientific study of mind and behavior. This episode traces its roots from Wilhelm Wundt's first lab in 1879 to the modern cognitive revolution, covering the major schools of thought that shaped the field.
            </p>
            <div className="space-y-2">
              {[
                "Structuralism (Wundt) used introspection to break consciousness into basic elements",
                "Functionalism (William James) asked why the mind works the way it does - for survival",
                "Behaviorism (Watson, Skinner) studied only observable behavior, not the inner mind",
                "Psychoanalysis (Freud) emphasized unconscious drives and early childhood experiences",
                "The cognitive revolution (1950s–70s) shifted focus back to memory, perception, and reasoning",
                "Modern psychology uses 7 perspectives: biological, evolutionary, psychodynamic, behavioral, cognitive, social-cultural, humanistic",
              ].map((b, i) => (
                <div key={i} className="flex items-start gap-2 text-sm" style={{ color: "rgba(0,0,0,0.65)" }}>
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#6E7FF3" }} />
                  {b}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TRANSCRIPT */}
        {vtab === "transcript" && (
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(0,0,0,0.35)" }}>Full Transcript</div>
            {[
              ["00:00", "Psychology is one of those things that everybody thinks they know about. But it's actually a huge field with a complicated history."],
              ["00:38", "Wilhelm Wundt opened the first experimental psychology lab in Leipzig in 1879, marking the birth of psychology as a science."],
              ["01:12", "William James wrote the first psychology textbook - Principles of Psychology - and founded functionalism: asking what mental processes do, not what they are."],
              ["02:05", "John Watson argued we should forget the mind entirely and only study behaviors we can observe and measure. This became behaviorism."],
              ["02:48", "Freud's psychoanalytic theory focused on unconscious drives, repressed memories, and early childhood as the roots of adult behavior."],
              ["03:30", "The cognitive revolution in the 1950s–70s brought the mind back, studying perception, memory, language, and problem-solving."],
              ["04:10", "Today, psychologists work across 7 major perspectives, often combining them to understand complex human behavior."],
            ].map(([t, line]) => (
              <div key={t} className="flex gap-3 text-sm">
                <span className="shrink-0 font-mono text-xs pt-0.5" style={{ color: "#4B5FE8", minWidth: 36 }}>{t}</span>
                <span style={{ color: "rgba(0,0,0,0.65)", lineHeight: 1.6 }}>{line}</span>
              </div>
            ))}
          </div>
        )}

        {/* FLASHCARDS */}
        {vtab === "flashcards" && (
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(0,0,0,0.35)" }}>Click a card to reveal the answer</div>
            <div className="grid grid-cols-2 gap-3">
              {flashcards.map((fc, i) => (
                <div key={i}
                  onClick={() => setFlipped(p => { const s = new Set(p); s.has(i) ? s.delete(i) : s.add(i); return s; })}
                  className="cursor-pointer rounded-xl p-4 flex flex-col justify-center transition-all"
                  style={{
                    background: flipped.has(i) ? "rgba(75,95,232,0.15)" : "rgba(0,0,0,0.04)",
                    border: `1px solid ${flipped.has(i) ? "#6E7FF3" : "rgba(0,0,0,0.1)"}`,
                    minHeight: 100,
                  }}>
                  <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: flipped.has(i) ? "#4B5FE8" : "rgba(0,0,0,0.35)" }}>
                    {flipped.has(i) ? "Answer" : "Question"}
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: flipped.has(i) ? "#0f1115" : "rgba(0,0,0,0.7)" }}>
                    {flipped.has(i) ? fc.a : fc.q}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* QUIZ */}
        {vtab === "quiz" && (
          <div className="space-y-4">
            <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(0,0,0,0.35)" }}>Question 1 of 5</div>
            <div className="text-sm font-medium leading-relaxed" style={{ color: "#0f1115" }}>
              Which school of thought argued that psychology should only study observable behavior and ignore the mind entirely?
            </div>
            <div className="space-y-2">
              {[
                { label: "Structuralism", correct: false },
                { label: "Functionalism", correct: false },
                { label: "Behaviorism", correct: true },
                { label: "Psychoanalysis", correct: false },
              ].map((opt, i) => {
                const picked = quizSelected === i;
                return (
                  <button key={i} onClick={() => setQuizSelected(i)}
                    className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all"
                    style={{
                      border: `1px solid ${picked ? "#4B5FE8" : "rgba(0,0,0,0.1)"}`,
                      background: picked ? "rgba(75,95,232,0.15)" : "rgba(0,0,0,0.05)",
                      color: picked ? "#0f1115" : "rgba(0,0,0,0.65)",
                    }}>
                    <span className="w-3.5 h-3.5 rounded-full border shrink-0"
                      style={{ borderColor: picked ? "#6E7FF3" : "rgba(0,0,0,0.3)", background: picked ? "#4B5FE8" : "transparent" }} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {quizSelected !== null && (
              <div className="rounded-xl px-4 py-3 text-sm" style={{
                background: quizSelected === 2 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.12)",
                color: quizSelected === 2 ? "#4ade80" : "#f87171",
              }}>
                {quizSelected === 2
                  ? "✓ Correct! Behaviorism (Watson, Skinner) rejected the study of the mind, focusing only on measurable behavior."
                  : "✗ Not quite. Behaviorism (Watson, Skinner) is the school that rejected mental study in favor of observable behavior."}
              </div>
            )}
          </div>
        )}

        {/* CHATBOT */}
        {vtab === "chatbot" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <div className="px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm max-w-[80%]" style={{ background: "#4B5FE8", color: "white" }}>
                What's the difference between structuralism and functionalism?
              </div>
            </div>
            <div className="flex justify-start">
              <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm max-w-[85%] leading-relaxed" style={{ background: "rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.75)", border: "1px solid rgba(75,95,232,0.2)" }}>
                At <strong style={{ color: "#4B5FE8" }}>0:38</strong>, the video explains: <strong>structuralism</strong> (Wundt) asked <em>what</em> the mind is made of — using introspection to identify basic elements. <strong>Functionalism</strong> (James) asked <em>why</em> the mind works as it does — how mental processes help us adapt and survive.
              </div>
            </div>
            <div className="flex justify-end">
              <div className="px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm max-w-[80%]" style={{ background: "#4B5FE8", color: "white" }}>
                Which came first historically?
              </div>
            </div>
            <div className="flex justify-start">
              <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm max-w-[85%] leading-relaxed" style={{ background: "rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.75)", border: "1px solid rgba(75,95,232,0.2)" }}>
                Structuralism came first — Wundt's lab opened in <strong style={{ color: "#4B5FE8" }}>1879</strong>. Functionalism emerged shortly after, championed by William James who disagreed with reducing the mind to static elements.
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

const PREVIEWS: Record<string, React.ReactNode> = {
  record:    <RecordPreview />,
  files:     <CheatSheetPreview />,
  quiz:      <QuizPreview />,
  studybook: <StudyBookPreview />,
  video:     <VideoPreview />,
  note:      <NotePreview />,
};

export function FeaturesShowcase() {
  const [active, setActive] = useState<string>("record");

  return (
    <section className="px-6 md:px-16 py-16 md:py-24" style={{ background: "#ffffff" }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-sm uppercase tracking-[0.2em] font-semibold mb-3" style={{ color: "#6E7FF3" }}>What you get</div>
          <h2 className="text-4xl md:text-5xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, color: "#0f1115", letterSpacing: "-0.02em" }}>
            Everything to ace the semester.
          </h2>
          <p className="text-base md:text-lg mt-3 max-w-xl mx-auto" style={{ color: "rgba(0,0,0,0.5)" }}>
            One recording. Cheat sheets, quizzes, study books — generated instantly.
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex justify-center mb-8 overflow-x-auto">
          <div className="flex gap-1 p-1 rounded-2xl shrink-0" style={{ background: "rgba(75,95,232,0.1)", border: "1px solid rgba(75,95,232,0.15)" }}>
            {TABS.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setActive(key)}
                className="flex items-center gap-2 px-4 md:px-5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap"
                style={{
                  background: active === key ? "#4B5FE8" : "transparent",
                  color: active === key ? "white" : "rgba(0,0,0,0.45)",
                }}>
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="max-w-2xl mx-auto">
          {PREVIEWS[active]}
        </div>
      </div>
    </section>
  );
}
