"use client";
import { FileText } from "lucide-react";
import { fileKindLabel } from "@/lib/attachTypes";

/**
 * A square tile for one attachment.
 *
 * Images get a thumbnail. Documents cannot have one — a PDF in an <img> renders an
 * empty box — so they get their type and filename instead, which is also what the
 * student needs to tell two decks apart.
 */
export function AttachmentThumb({
  imageUrl, name, isDocument, size, alt,
}: {
  imageUrl: string;
  /** The student's filename. Documents show it; images don't need it. */
  name?: string | null;
  isDocument: boolean;
  size: number;
  alt: string;
}) {
  if (!isDocument) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={alt}
        className="object-cover rounded-xl"
        style={{ width: size, height: size, border: "1px solid rgba(0,0,0,0.08)" }}
      />
    );
  }

  const label = name ? fileKindLabel(name) : "FILE";
  return (
    <div
      className="rounded-xl flex flex-col items-center justify-center gap-1 px-2 overflow-hidden"
      style={{
        width: size, height: size,
        background: "rgba(75,95,232,0.07)",
        border: "1px solid rgba(75,95,232,0.22)",
      }}
      title={name ?? undefined}
    >
      <FileText size={Math.round(size * 0.26)} style={{ color: "#4B5FE8", flexShrink: 0 }} />
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: "#4B5FE8" }}>
        {label}
      </span>
      {name && (
        <span
          style={{
            fontSize: 9.5, lineHeight: 1.15, color: "rgba(15,17,21,0.62)",
            textAlign: "center", maxWidth: "100%",
            // Two lines, then ellipsis — a long deck name must not push the tile open.
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            overflow: "hidden", wordBreak: "break-word",
          }}
        >
          {name}
        </span>
      )}
    </div>
  );
}
