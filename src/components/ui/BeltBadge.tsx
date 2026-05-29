import { getBeltInfo } from "@/lib/utils";

export function BeltBadge({ beltColor, size = "sm" }: { beltColor: string; size?: "sm" | "md" }) {
  const belt = getBeltInfo(beltColor);
  const padding = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";

  const isNegra = belt.hex === "#1A1A1A";

  // Negra (y dans): badge blanco, letra negra, punto negro con aro blanco
  if (isNegra) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold border ${padding}`}
        style={{
          backgroundColor: "rgba(255,255,255,0.92)",
          color:           "#000000",
          borderColor:     "rgba(0,0,0,0.2)",
        }}
      >
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: "#1A1A1A", border: "1.5px solid #FFFFFF" }}
        />
        {belt.label}
      </span>
    );
  }

  // Cintas claras (blanca, celeste, amarillo, amarilla): usar hex como texto (son colores claros visibles sobre fondo oscuro)
  // Cintas oscuras (verde, azul, morada, roja, café): usar textColor = "#FFF"
  const labelColor = belt.textColor === "#000"
    ? (belt.hex === "#FFFFFF" ? "#AAAAAA" : belt.hex)
    : belt.textColor;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold border ${padding}`}
      style={{
        backgroundColor: belt.hex + "33",
        color:           labelColor,
        borderColor:     belt.hex + "66",
      }}
    >
      <span
        className="w-2.5 h-2.5 rounded-full border border-white/20"
        style={{ backgroundColor: belt.hex }}
      />
      {belt.label}
    </span>
  );
}
