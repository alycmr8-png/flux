"use client";
import { useState, useRef } from "react";
import { Mic, Square, Upload } from "lucide-react";

export default function RecordPage() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    mediaRef.current = recorder;
    chunksRef.current = [];
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.start(250);
    setRecording(true);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  async function stopRecording() {
    if (!mediaRef.current) return;
    mediaRef.current.stop();
    mediaRef.current.stream.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    setUploading(true);

    await new Promise<void>((res) => {
      mediaRef.current!.onstop = () => res();
    });

    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const fd = new FormData();
    fd.append("audio", blob, "lecture.webm");
    fd.append("courseId", "default");
    fd.append("title", `Lecture ${new Date().toLocaleDateString()}`);

    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/lectures`, {
      method: "POST",
      body: fd,
    });

    setUploading(false);
    setDone(true);
  }

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="p-8 max-w-xl">
      <h1 className="font-serif italic text-3xl mb-1">Record Lecture</h1>
      <p className="text-[#555] text-sm mb-10">Audio is processed by AI after you stop.</p>

      {done ? (
        <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-8 text-center">
          <div className="text-2xl mb-2">✓</div>
          <div className="font-medium mb-1">Uploaded</div>
          <div className="text-[#555] text-sm">AI is generating your cheat sheet and quiz.</div>
        </div>
      ) : (
        <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-8 flex flex-col items-center gap-6">
          <div className="font-serif text-5xl">{fmt(seconds)}</div>
          {recording && (
            <div className="flex items-center gap-2 text-xs text-[#888]">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Recording live
            </div>
          )}
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={uploading}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
              recording ? "bg-white" : "bg-[#222] hover:bg-[#333]"
            }`}
          >
            {recording ? (
              <Square size={20} className="text-black" />
            ) : (
              <Mic size={20} className="text-white" />
            )}
          </button>
          {uploading && <p className="text-[#555] text-sm">Uploading…</p>}
        </div>
      )}

      <div className="mt-6 bg-[#111] border border-[#1e1e1e] rounded-2xl p-5">
        <div className="text-xs text-[#444] uppercase tracking-widest mb-3">Attach slides (optional)</div>
        <label className="flex items-center gap-3 cursor-pointer text-sm text-[#555] hover:text-white transition-colors">
          <Upload size={14} />
          Upload PDF slides
          <input type="file" accept=".pdf" className="hidden" />
        </label>
      </div>
    </div>
  );
}
