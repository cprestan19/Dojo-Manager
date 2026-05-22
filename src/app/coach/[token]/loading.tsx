export default function CoachLoading() {
  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", fontFamily: "sans-serif" }}>
      {/* Header skeleton */}
      <div style={{ background: "rgba(192,57,43,0.1)", borderBottom: "1px solid rgba(192,57,43,0.2)", padding: "20px 24px" }}>
        <div style={{ width: "80px", height: "12px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", marginBottom: "8px" }} />
        <div style={{ width: "200px", height: "22px", background: "rgba(255,255,255,0.12)", borderRadius: "6px", marginBottom: "8px" }} />
        <div style={{ width: "280px", height: "14px", background: "rgba(255,255,255,0.06)", borderRadius: "4px" }} />
      </div>
      {/* Tabs skeleton */}
      <div style={{ maxWidth: "640px", margin: "0 auto", padding: "0 16px" }}>
        <div style={{ display: "flex", gap: "0", borderBottom: "1px solid rgba(255,255,255,0.1)", marginTop: "20px" }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ flex: 1, height: "56px", background: "rgba(255,255,255,0.04)", margin: "0 2px", borderRadius: "4px 4px 0 0" }} />
          ))}
        </div>
        {/* Content skeleton */}
        <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: "80px", background: "rgba(255,255,255,0.04)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" }}
              className="animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
