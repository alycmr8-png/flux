"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Layers, Apple, Smartphone } from "lucide-react";
import { WaitlistForm } from "@/components/WaitlistForm";
import { useTr } from "@/lib/useTr";

// Set these once the app is live in the stores; until then the page offers the
// waitlist and the web app instead. The QR code never needs to change.
const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL ?? "";
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? "";

type Platform = "ios" | "android" | "other";

export default function DownloadPage() {
  const tr = useTr();
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const p: Platform = /iPhone|iPad|iPod/i.test(ua) ? "ios" : /Android/i.test(ua) ? "android" : "other";
    setPlatform(p);
    // A scanned QR should land straight in the right store when there is one.
    const target = p === "ios" ? APP_STORE_URL : p === "android" ? PLAY_STORE_URL : "";
    if (target) window.location.replace(target);
  }, []);

  const live = Boolean(APP_STORE_URL || PLAY_STORE_URL);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16" style={{ background: "#FFFFFF" }}>
      <Link href="/" className="flex items-center gap-2.5 mb-10" style={{ textDecoration: "none" }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#4B5FE8" }}>
          <Layers size={19} style={{ color: "white" }} />
        </div>
        <span style={{ fontSize: 24, fontWeight: 800, color: "#111110", letterSpacing: "-0.5px" }}>
          <span style={{ color: "#4B5FE8" }}>U</span>corns
        </span>
      </Link>

      <div className="w-full max-w-md text-center">
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 34, fontWeight: 800, color: "#0f1115", letterSpacing: "-0.03em", lineHeight: 1.1 }}>{tr("Get Ucorns on your phone")}</h1>

        {live ? (
          <>
            <p className="mt-3 mb-8" style={{ fontSize: 16.5, color: "rgba(15,17,21,0.7)", lineHeight: 1.55 }}>{tr("Record lectures, read the transcript live, and study from anywhere.")}</p>
            <div className="flex flex-col gap-3">
              {APP_STORE_URL && (
                <a href={APP_STORE_URL} className="flex items-center justify-center gap-2.5 py-4 rounded-2xl text-white"
                  style={{ background: "#0f1115", fontSize: 16.5, fontWeight: 600, textDecoration: "none" }}>
                  <Apple size={20} />{tr("Download for iPhone")}</a>
              )}
              {PLAY_STORE_URL && (
                <a href={PLAY_STORE_URL} className="flex items-center justify-center gap-2.5 py-4 rounded-2xl"
                  style={{ border: "1px solid rgba(0,0,0,0.14)", color: "#0f1115", fontSize: 16.5, fontWeight: 600, textDecoration: "none" }}>
                  <Smartphone size={20} />{tr("Download for Android")}</a>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 mb-8" style={{ fontSize: 16.5, color: "rgba(15,17,21,0.7)", lineHeight: 1.55 }}>
              {platform === "ios" ? tr("The iPhone app is almost ready.")
                : platform === "android" ? tr("The Android app is almost ready.")
                : tr("The mobile app is almost ready.")}{" "}
              {tr("Leave your email and we'll let you know the moment it's in the store.")}
            </p>
            <div className="flex justify-center">
              <WaitlistForm source="download-page" />
            </div>
          </>
        )}

        <p className="mt-10" style={{ fontSize: 15, color: "rgba(15,17,21,0.6)" }}>
          {tr("On a computer?")}{" "}
          <Link href="/sign-up" style={{ color: "#4B5FE8", fontWeight: 600 }}>{tr("Use Ucorns on the web")}</Link>
        </p>
      </div>
    </main>
  );
}
