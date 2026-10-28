import { describe, expect, test } from "vite-plus/test";
import { fitScale, optionForKey, stepIndex } from "../src/layout.ts";

describe("fitScale", () => {
  test("never scales up", () => {
    expect(fitScale({ width: 3000, height: 2000 }, { width: 1440, height: 900 })).toBe(1);
  });

  test("fits the tighter dimension", () => {
    expect(fitScale({ width: 720, height: 900 }, { width: 1440, height: 900 })).toBe(0.5);
    expect(fitScale({ width: 1440, height: 450 }, { width: 1440, height: 900 })).toBe(0.5);
  });

  test("is zero when there's no room", () => {
    expect(fitScale({ width: -10, height: 500 }, { width: 390, height: 844 })).toBe(0);
    expect(fitScale({ width: 500, height: 500 }, { width: 0, height: 844 })).toBe(0);
  });
});

describe("option navigation", () => {
  test("steps without wrapping", () => {
    expect(stepIndex(0, 1, 3)).toBe(1);
    expect(stepIndex(2, 1, 3)).toBe(-1);
    expect(stepIndex(0, -1, 3)).toBe(-1);
  });

  test("maps keys to options", () => {
    expect(optionForKey("ArrowRight", 0, 3)).toBe(1);
    expect(optionForKey("ArrowLeft", 1, 3)).toBe(0);
    expect(optionForKey("ArrowLeft", 0, 3)).toBe(-1);
    expect(optionForKey("3", 0, 3)).toBe(2);
    expect(optionForKey("4", 0, 3)).toBe(-1);
    expect(optionForKey("0", 0, 3)).toBe(-1);
    expect(optionForKey("a", 0, 3)).toBe(-1);
  });
});
