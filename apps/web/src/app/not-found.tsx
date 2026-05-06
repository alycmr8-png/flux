export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#111110" }}>
      <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontSize: 96, fontWeight: 400, color: "white", lineHeight: 1, margin: 0 }}>404</p>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginTop: 16 }}>Page not found</p>
      <a href="/" style={{ marginTop: 32, background: "white", color: "#111110", fontWeight: 500, fontSize: 13, padding: "10px 24px", borderRadius: 999, textDecoration: "none" }}>Go home</a>
    </div>
  );
}
