import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="font-serif italic text-5xl md:text-7xl mb-4">StudyAgent</h1>
      <p className="text-[#666] text-lg mb-10 max-w-md">
        Record your lectures. AI generates cheat sheets, quizzes, and a study schedule — automatically.
      </p>
      <div className="flex gap-4">
        <SignUpButton>
          <button className="bg-white text-black font-medium px-7 py-3 rounded-full text-sm hover:bg-[#e0e0e0] transition-colors">
            Get started free
          </button>
        </SignUpButton>
        <SignInButton>
          <button className="border border-[#333] text-white font-medium px-7 py-3 rounded-full text-sm hover:border-[#555] transition-colors">
            Sign in
          </button>
        </SignInButton>
      </div>
      <div className="mt-20 grid grid-cols-3 gap-8 max-w-2xl text-left">
        {[
          { label: "Record", desc: "One click. Works offline. Auto-titles your lectures." },
          { label: "AI Summary", desc: "Cheat sheets + quizzes generated while you walk home." },
          { label: "Schedule", desc: "Spaced repetition added to Google Calendar automatically." },
        ].map((f) => (
          <div key={f.label} className="border border-[#1a1a1a] rounded-2xl p-5">
            <div className="font-medium text-sm mb-2">{f.label}</div>
            <div className="text-[#555] text-xs leading-relaxed">{f.desc}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
