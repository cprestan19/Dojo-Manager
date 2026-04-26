import { getBeltInfo } from "@/lib/utils";

export function BeltBadge({ beltColor, size = "sm" }: { beltColor: string; size?: "sm" | "md" }) {
  const belt = getBeltInfo(beltColor);
  const padding = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold border ${padding}`}
      style={{
        backgroundColor: belt.hex + "33",
        color:           belt.hex === "#FFFFFF" ? "#CCC" : belt.hex,
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
