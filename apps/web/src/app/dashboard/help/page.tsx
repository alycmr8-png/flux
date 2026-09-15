"use client";
import { Mail, MessageCircle, Camera, Mic, Calendar } from "lucide-react";

const FAQS = [
  {
    q: "How do I record a lecture?",
    a: "Go to Workspace → Record tab. Name your lecture, then press Start Recording. When done, press Stop — Flux will automatically generate your cheat sheet.",
  },
  {
    q: "How do I add events to my Calendar?",
    a: "Go to Calendar, click any future day, then press Add. Fill in the title, type (Exam, Assignment, etc.), and date. Flux will remind you as the date approaches.",
  },
  {
    q: "How do I add photos to a class?",
    a: "Open a class and go to Add Photo. Take or pick photos of the whiteboard, slides or your handwritten notes — Flux reads each one, formulas included, and Ask can answer from what's in them.",
  },
  {
    q: "How do I change the language?",
    a: "Use the language switcher at the bottom of the sidebar. Flux will generate all study materials in your selected language.",
  },
];

const FEATURES = [
  { icon: Mic,        label: "Record",       desc: "Record lectures and get instant cheat sheets" },
  { icon: Camera,     label: "Add Photo",    desc: "Photos of the board and your notes, read by Flux" },
  { icon: Calendar,   label: "Calendar",     desc: "Track exams, assignments, and deadlines" },
];

export default function HelpPage() {
  return (
    <div style={{ color: "#1F2328", maxWidth: 720, margin: "0 auto" }}>
      <div className="mb-8">
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 28 }}>
          Help
        </h1>
        <p style={{ color: "rgba(31,35,40, 0.75)", fontSize: 14.5, marginTop: 2 }}>
          Everything you need to get the most out of Flux
        </p>
      </div>

      {/* Quick feature overview */}
      <p className="text-[13.5px] uppercase tracking-widest mb-3" style={{ color: "rgba(31,35,40, 0.7)" }}>What Flux can do</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10">
        {FEATURES.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="rounded-2xl p-4 border" style={{ background: "rgba(0,0,0,0.04)", borderColor: "rgba(0,0,0,0.06)" }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3" style={{ background: "rgba(0,0,0,0.06)" }}>
              <Icon size={15} style={{ color: "rgba(31,35,40, 0.85)" }} />
            </div>
            <div className="text-[15.5px] font-medium mb-1">{label}</div>
            <div style={{ fontSize: 13, color: "rgba(31,35,40, 0.75)", lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* FAQs */}
      <p className="text-[13.5px] uppercase tracking-widest mb-3" style={{ color: "rgba(31,35,40, 0.7)" }}>Frequently asked questions</p>
      <div className="flex flex-col gap-3 mb-10">
        {FAQS.map(({ q, a }) => (
          <div key={q} className="rounded-2xl p-5 border" style={{ background: "rgba(0,0,0,0.04)", borderColor: "rgba(0,0,0,0.06)" }}>
            <div className="text-[15.5px] font-medium mb-2">{q}</div>
            <div style={{ fontSize: 14.5, color: "rgba(31,35,40, 0.8)", lineHeight: 1.65 }}>{a}</div>
          </div>
        ))}
      </div>

      {/* Contact */}
      <p className="text-[13.5px] uppercase tracking-widest mb-3" style={{ color: "rgba(31,35,40, 0.7)" }}>Still need help?</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <a
          href="mailto:support@fluxstudy.ai"
          className="flex-1 flex items-center gap-3 rounded-2xl px-5 py-4 border transition-all hover:border-white/20"
          style={{ background: "rgba(0,0,0,0.04)", borderColor: "rgba(0,0,0,0.06)" }}
        >
          <Mail size={16} style={{ color: "rgba(31,35,40, 0.8)" }} />
          <div>
            <div className="text-[15.5px] font-medium">Email support</div>
            <div style={{ fontSize: 13, color: "rgba(31,35,40, 0.73)" }}>support@fluxstudy.ai</div>
          </div>
        </a>
        <a
          href="https://discord.gg/fluxstudy"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center gap-3 rounded-2xl px-5 py-4 border transition-all hover:border-white/20"
          style={{ background: "rgba(0,0,0,0.04)", borderColor: "rgba(0,0,0,0.06)" }}
        >
          <MessageCircle size={16} style={{ color: "rgba(31,35,40, 0.8)" }} />
          <div>
            <div className="text-[15.5px] font-medium">Join our Discord</div>
            <div style={{ fontSize: 13, color: "rgba(31,35,40, 0.73)" }}>Chat with the community</div>
          </div>
        </a>
      </div>
    </div>
  );
}
