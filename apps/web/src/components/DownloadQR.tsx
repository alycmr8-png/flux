"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { Smartphone, X } from "lucide-react";
import { useTr } from "@/lib/useTr";

/**
 * "Download" in the navbar. On a computer it shows a QR code to scan with a
 * phone; the code points at /download, which sends each phone to its own
 * store — so it keeps working after the app is published, without reprinting.
 */
export function DownloadQR({ variant = "link" }: { variant?: "link" | "compact" }) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(`${window.location.origin}/download`);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {variant === "compact" ? (
        // Already on a phone — scanning makes no sense, go straight to the download page.
        <a
          href="/download"
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-full"
          style={{ border: "1px solid rgba(0,0,0,0.12)", color: "#0f1115" }}
          aria-label={tr("Download the app")}
        >
          <Smartphone size={18} />
        </a>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="navbar-link"
          style={{ fontSize: 18, fontWeight: 500, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >{tr("Download")}</button>
      )}

      {/* Portalled to <body>: the navbar's backdrop-filter would otherwise
          trap a fixed-position dialog inside the navbar pill. */}
      {open && url && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          style={{ background: "rgba(15,17,21,0.45)", pointerEvents: "all" }}
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="download-title"
            className="relative w-full max-w-sm rounded-3xl p-8 text-center"
            style={{ background: "#FFFFFF", boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              aria-label={tr("Close")}
              className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/[0.05]"
              style={{ color: "rgba(15,17,21,0.6)" }}
            >
              <X size={18} />
            </button>

            <div id="download-title" style={{ fontSize: 22, fontWeight: 800, color: "#0f1115", letterSpacing: "-0.02em" }}>{tr("Get Flux on your phone")}</div>
            <p className="mt-2 mb-6" style={{ fontSize: 15, color: "rgba(15,17,21,0.65)", lineHeight: 1.5 }}>{tr("Scan with your phone&apos;s camera to download the app for iPhone or Android.")}</p>

            <div
              className="mx-auto inline-flex rounded-2xl p-4"
              style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 8px 24px rgba(75,95,232,0.12)" }}
            >
              {url && (
                <QRCodeSVG
                  value={url}
                  size={200}
                  level="M"
                  fgColor="#0f1115"
                  imageSettings={{ src: "/app-icon.png", height: 36, width: 36, excavate: true }}
                />
              )}
            </div>

            <p className="mt-5" style={{ fontSize: 13.5, color: "rgba(15,17,21,0.5)" }}>{tr("Or open")}<a href="/download" style={{ color: "#4B5FE8", fontWeight: 600 }}>{url.replace(/^https?:\/\//, "")}</a>
            </p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
