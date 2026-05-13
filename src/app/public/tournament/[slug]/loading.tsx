export default function PublicTournamentLoading() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f1117", padding: "24px 16px" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ background: "#1a1d27", borderRadius: "16px", padding: "32px", animation: "pulse 1.5s ease-in-out infinite" }}>
          <div style={{ width: "60%", height: "28px", background: "#2d3048", borderRadius: "6px", marginBottom: "12px" }} />
          <div style={{ width: "40%", height: "16px", background: "#2d3048", borderRadius: "4px", marginBottom: "8px" }} />
          <div style={{ width: "30%", height: "16px", background: "#2d3048", borderRadius: "4px" }} />
        </div>
        <div style={{ background: "#1a1d27", borderRadius: "16px", padding: "24px", animation: "pulse 1.5s ease-in-out infinite" }}>
          <div style={{ aspectRatio: "16/9", background: "#2d3048", borderRadius: "8px" }} />
        </div>
        <div style={{ background: "#1a1d27", borderRadius: "16px", padding: "24px", animation: "pulse 1.5s ease-in-out infinite" }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: "60px", background: "#2d3048", borderRadius: "8px", marginBottom: "8px" }} />
          ))}
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  );
}
