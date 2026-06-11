import { describe, it, expect } from "vitest";
import {
  nextPowerOf2,
  byeCount,
  assignInitialColors,
  resolveColorConflict,
  recalculateBracketColors,
} from "@/lib/bracketUtils";

describe("nextPowerOf2", () => {
  it("returns 1 for n <= 1", () => {
    expect(nextPowerOf2(0)).toBe(1);
    expect(nextPowerOf2(1)).toBe(1);
  });

  it("returns the smallest power of 2 >= n", () => {
    expect(nextPowerOf2(2)).toBe(2);
    expect(nextPowerOf2(3)).toBe(4);
    expect(nextPowerOf2(5)).toBe(8);
    expect(nextPowerOf2(8)).toBe(8);
    expect(nextPowerOf2(9)).toBe(16);
  });
});

describe("byeCount", () => {
  it("computes how many BYEs fill the bracket to the next power of 2", () => {
    expect(byeCount(8)).toBe(0);
    expect(byeCount(5)).toBe(3);
    expect(byeCount(6)).toBe(2);
  });
});

describe("assignInitialColors", () => {
  it("alternates AKA/AO starting with AKA", () => {
    const result = assignInitialColors(["a", "b", "c"]);
    expect(result).toEqual([
      { id: "a", color: "AKA" },
      { id: "b", color: "AO" },
      { id: "c", color: "AKA" },
    ]);
  });
});

describe("resolveColorConflict", () => {
  it("keeps colors when they differ", () => {
    expect(resolveColorConflict("AKA", "AO")).toEqual({ p1: "AKA", p2: "AO" });
  });

  it("flips p2's color when both match", () => {
    expect(resolveColorConflict("AKA", "AKA")).toEqual({ p1: "AKA", p2: "AO" });
    expect(resolveColorConflict("AO", "AO")).toEqual({ p1: "AO", p2: "AKA" });
  });
});

describe("recalculateBracketColors", () => {
  it("assigns AKA/AO to first-round participants", () => {
    const colors = recalculateBracketColors([
      { matchNumber: 1, participant1Id: "p1", participant2Id: "p2" },
      { matchNumber: 2, participant1Id: "p3", participant2Id: "p4" },
    ]);
    expect(colors.p1).toBe("AKA");
    expect(colors.p2).toBe("AO");
    expect(colors.p3).toBe("AKA");
    expect(colors.p4).toBe("AO");
  });

  it("processes matches in matchNumber order regardless of input order", () => {
    const unordered = recalculateBracketColors([
      { matchNumber: 2, participant1Id: "p3", participant2Id: "p4" },
      { matchNumber: 1, participant1Id: "p1", participant2Id: "p2" },
    ]);
    const ordered = recalculateBracketColors([
      { matchNumber: 1, participant1Id: "p1", participant2Id: "p2" },
      { matchNumber: 2, participant1Id: "p3", participant2Id: "p4" },
    ]);
    expect(unordered).toEqual(ordered);
  });
});
