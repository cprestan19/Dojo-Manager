import { describe, it, expect } from "vitest";
import { calculateAge, formatCurrency, getBeltInfo, BELT_COLORS, cn } from "@/lib/utils";

describe("cn", () => {
  it("merges class names and resolves tailwind conflicts", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", false && "hidden", "font-bold")).toBe("text-red-500 font-bold");
  });
});

describe("calculateAge", () => {
  it("computes whole years between birth date and now", () => {
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
    expect(calculateAge(tenYearsAgo)).toBe(10);
  });

  it("accepts ISO date strings", () => {
    expect(calculateAge("2000-01-01")).toBeGreaterThan(20);
  });
});

describe("formatCurrency", () => {
  it("formats numbers as USD currency", () => {
    expect(formatCurrency(10)).toContain("10.00");
    expect(formatCurrency(1234.5)).toContain("1,234.50");
  });
});

describe("BELT_COLORS / getBeltInfo", () => {
  it("contains all 16 belt levels in progression order", () => {
    expect(BELT_COLORS).toHaveLength(17);
    expect(BELT_COLORS[0].value).toBe("blanca");
    expect(BELT_COLORS[BELT_COLORS.length - 1].value).toBe("negra-3-dan");
  });

  it("returns the matching belt info by value", () => {
    expect(getBeltInfo("azul")?.label).toBe("Azul");
  });

  it("falls back to the first belt for an unknown value", () => {
    expect(getBeltInfo("no-existe")).toBe(BELT_COLORS[0]);
  });
});
