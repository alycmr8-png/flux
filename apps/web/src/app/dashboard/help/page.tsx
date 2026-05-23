"use client";
import { Mail, MessageCircle, BookOpen, Mic, Youtube, Calendar, FileText } from "lucide-react";

const FAQS = [
  {
    q: "How do I record a lecture?",
    a: "Go to Workspace → Record tab. Name your lecture, then press Start Recording. When done, press Stop — Flux will automatically generate your cheat sheet.",
  },
  {
    q: "How do I add a YouTube lecture?",
    a: "Go to Workspace → Upload Video tab. Paste any YouTube link and press Load. You'll get a transcript, summary, flashcards, and quiz instantly.",
  },
  {
    q: "How do I add events to my Calendar?",
    a: "Go to Calendar, click any future day, then press Add. Fill in the title, type (Exam, Assignment, etc.), and date. Flux will remind you as the date approaches.",
  },
  {
    q: "What is a Study Book?",
    a: "A Study Book is a full AI-generated guide from your lecture — with chapters, key terms, flashcards, and practice questions. Find them in Workspace → Study Book.",
  },
  {
    q: "Can I upload a PDF or document?",
    a: "Yes. Go to Workspace → Files tab, upload your PDF or text file, then click Generate to turn it into a structured study guide.",
  },
  {
    q: "How do I change the language?",
    a: "Use the language switcher at the bottom of the sidebar. Flux will generate all study materials in your selected language.",
  },
];

const FEATURES = [
  { icon: Mic,        label: "Record",       desc: "Record lectures and get instant cheat sheets" },
  { icon: Youtube,    label: "Video",        desc: "Paste a YouTube link for summaries and quizzes" },
  { icon: FileText,   label: "Files",        desc: "Upload PDFs and documents to study" },
  { icon: BookOpen,   label: "Study Book",   desc: "Full AI-generated study guides per lecture" },
  { icon: Calendar,   label: "Calendar",     desc: "Track exams, assignments, and deadlines" },
];

export default function HelpPage() {
  return (
    <div style={{ color: "white", maxWidth: 720, margin: "0 auto" }}>
      <div className="mb-8">
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 28 }}>
          Help
        </h1>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 2 }}>
          Everything you need to get the most out of Flux
        </p>
      </div>

      {/* Quick feature overview */}
      <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>What Flux can do</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10">
        {FEATURES.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="rounded-2xl p-4 border" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)" }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3" style={{ background: "rgba(255,255,255,0.08)" }}>
              <Icon size={15} style={{ color: "rgba(255,255,255,0.6)" }} />
            </div>
            <div className="text-sm font-medium mb-1">{label}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* FAQs */}
      <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>Frequently asked questions</p>
      <div className="flex flex-col gap-3 mb-10">
        {FAQS.map(({ q, a }) => (
          <div key={q} className="rounded-2xl p-5 border" style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)" }}>
            <div className="text-sm font-medium mb-2">{q}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.65 }}>{a}</div>
          </div>
        ))}
      </div>

      {/* Contact */}
      <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>Still need help?</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <a
          href="mailto:support@fluxstudy.ai"
          className="flex-1 flex items-center gap-3 rounded-2xl px-5 py-4 border transition-all hover:border-white/20"
          style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <Mail size={16} style={{ color: "rgba(255,255,255,0.5)" }} />
          <div>
            <div className="text-sm font-medium">Email support</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>support@fluxstudy.ai</div>
          </div>
        </a>
        <a
          href="https://discord.gg/fluxstudy"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center gap-3 rounded-2xl px-5 py-4 border transition-all hover:border-white/20"
          style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <MessageCircle size={16} style={{ color: "rgba(255,255,255,0.5)" }} />
          <div>
            <div className="text-sm font-medium">Join our Discord</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Chat with the community</div>
          </div>
        </a>
      </div>
    </div>
  );
}
