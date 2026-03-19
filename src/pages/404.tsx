export default function NotFoundPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at top, rgba(77, 212, 255, 0.12), transparent 32%), #02040a",
        color: "#f8fafc",
        fontFamily: "system-ui, sans-serif",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <div>
        <p
          style={{
            margin: 0,
            fontSize: "0.82rem",
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            opacity: 0.65,
          }}
        >
          404
        </p>
        <h1
          style={{
            margin: "1rem 0 0",
            fontSize: "clamp(2.6rem, 7vw, 4.6rem)",
            lineHeight: 0.95,
          }}
        >
          Route not found
        </h1>
      </div>
    </main>
  );
}
