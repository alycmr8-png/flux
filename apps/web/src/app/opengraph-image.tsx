import { ImageResponse } from "next/og";

/**
 * The card that appears when the link is pasted into Instagram, TikTok, iMessage,
 * WhatsApp or Slack.
 *
 * Generated rather than hand-drawn so it can never drift from the product's name and
 * pitch, and so there is no 1200×630 file to remember to update. Without it a shared
 * link renders as bare grey text, which is a poor first impression for something
 * being marketed on social.
 */
export const alt = "Ucorns — the AI that went to every one of your classes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          // The brand indigo, as a gradient so the card doesn't read as a flat block.
          background: "linear-gradient(135deg, #4B5FE8 0%, #2E3BA8 100%)",
          color: "#FFFFFF",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 34 }}>
          {/* The logo mark: an isometric stack, echoing the layered lucide icon. */}
          <svg width="66" height="66" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
            <path d="m6.08 12-3.5 1.6a1 1 0 0 0 0 1.81l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9a1 1 0 0 0 0-1.83L18.92 12" />
          </svg>
          <div style={{ fontSize: 62, fontWeight: 800, letterSpacing: "-0.03em" }}>Ucorns</div>
        </div>

        <div style={{ fontSize: 58, fontWeight: 800, lineHeight: 1.12, letterSpacing: "-0.025em", maxWidth: 930 }}>
          The AI that went to every one of your classes
        </div>

        <div style={{ fontSize: 30, marginTop: 28, opacity: 0.9, maxWidth: 860, lineHeight: 1.35 }}>
          Record the lecture. Get the notes, flashcards and quizzes — then ask your course anything.
        </div>

        <div style={{ fontSize: 26, marginTop: 40, opacity: 0.78, fontWeight: 600 }}>ucorns.com</div>
      </div>
    ),
    size,
  );
}
