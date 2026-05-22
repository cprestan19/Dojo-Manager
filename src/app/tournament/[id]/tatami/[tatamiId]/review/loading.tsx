export default function ReviewLoading() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0d1117",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "16px", fontFamily: "sans-serif" }}>
        Cargando video review...
      </div>
    </div>
  );
}
