import { describe, expect, it } from "vitest";
import { isConsensus, median } from "./voting";

describe("median", () => {
  it("returns the middle value of an odd-sized spread", () => {
    expect(median([1, 3, 8])).toBe(3);
  });

  it("averages the two middle values of an even-sized spread", () => {
    expect(median([2, 4])).toBe(3);
  });

  it("rounds a fractional midpoint, since story points are whole numbers", () => {
    expect(median([2, 3])).toBe(3);
    expect(median([1, 2, 3, 8])).toBe(3);
  });

  it("does not depend on the order votes arrived in", () => {
    expect(median([8, 1, 3])).toBe(median([1, 3, 8]));
  });

  it("leaves the caller's array untouched", () => {
    const votes = [5, 1, 3];
    median(votes);
    expect(votes).toEqual([5, 1, 3]);
  });

  it("returns 0 when nobody voted", () => {
    expect(median([])).toBe(0);
  });
});

describe("isConsensus", () => {
  it("is true when every vote matches", () => {
    expect(isConsensus([5, 5, 5])).toBe(true);
  });

  it("is true for a single vote", () => {
    expect(isConsensus([5])).toBe(true);
  });

  it("is false when any vote differs", () => {
    expect(isConsensus([5, 5, 8])).toBe(false);
  });

  it("is false with no votes — an empty room has not agreed on anything", () => {
    expect(isConsensus([])).toBe(false);
  });
});
