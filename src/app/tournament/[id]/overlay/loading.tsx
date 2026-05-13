export default function OverlayLoading() {
  return (
    <div style={{
      width: "1920px",
      height: "1080px",
      backgroundColor: "black",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "16px" }}>Cargando overlay...</div>
    </div>
  );
}
