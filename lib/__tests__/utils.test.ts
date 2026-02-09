import { describe, it, expect } from "vitest";
import { nanoid, cosineSimilarity, formatShortDate } from "@/lib/utils";

describe("nanoid", () => {
  it("generates a string of the requested length", () => {
    expect(nanoid(8)).toHaveLength(8);
    expect(nanoid(16)).toHaveLength(16);
    expect(nanoid()).toHaveLength(12);
  });

  it("only contains lowercase alphanumeric characters", () => {
    const id = nanoid(100);
    expect(id).toMatch(/^[a-z0-9]+$/);
  });

  it("generates unique values", () => {
    const ids = new Set(Array.from({ length: 100 }, () => nanoid()));
    expect(ids.size).toBe(100);
  });
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const v = [1, 2, 3, 4, 5];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0);
  });

  it("handles real-world embedding-like vectors", () => {
    const a = [0.1, 0.2, 0.3, 0.4];
    const b = [0.1, 0.2, 0.3, 0.5];
    const similarity = cosineSimilarity(a, b);
    expect(similarity).toBeGreaterThan(0.9);
    expect(similarity).toBeLessThanOrEqual(1.0);
  });
});

describe("formatShortDate", () => {
  it("formats an ISO date string to short format", () => {
    const result = formatShortDate("2026-01-15T12:00:00.000Z");
    expect(result).toContain("Jan");
    expect(result).toContain("15");
  });

  it("handles different months", () => {
    const result = formatShortDate("2026-06-15T12:00:00.000Z");
    expect(result).toContain("Jun");
  });
});
