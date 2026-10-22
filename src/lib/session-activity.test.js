import { describe, expect, test } from "bun:test";
import { clearSessionActivity, createSessionTransitionTracker, IDLE_TIMEOUT_MS, markSessionActivity, remainingSessionTime } from "./session-activity";

describe("idle session", () => {
  test("missing key grants a new session ten minutes", () => {
    expect(remainingSessionTime(null, 1000000)).toBe(10 * 60 * 1000);
  });
  test("reopening after eleven minutes expires the session", () => {
    expect(remainingSessionTime(1000000, 1000000 + 11 * 60 * 1000)).toBe(0);
  });
  test("fresh login stamps activity and logout removes it", () => {
    const values = new Map();
    const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    } });
    try {
      values.set("session:last-activity", "1");
      const before = Date.now();
      markSessionActivity();
      expect(Number(values.get("session:last-activity"))).toBeGreaterThanOrEqual(before);
      clearSessionActivity();
      expect(values.has("session:last-activity")).toBe(false);
    } finally {
      if (previous) Object.defineProperty(globalThis, "localStorage", previous);
      else Reflect.deleteProperty(globalThis, "localStorage");
    }
  });
  test("restoration and focus never count as fresh login", () => {
    const track = createSessionTransitionTracker();
    expect(track("INITIAL_SESSION", "old")).toBe(false);
    expect(track("SIGNED_IN", "old")).toBe(false);
    expect(track("TOKEN_REFRESHED", "old")).toBe(false);
  });
  test("fresh login is recorded once and another login works after logout", () => {
    const track = createSessionTransitionTracker();
    track("INITIAL_SESSION", null);
    expect(track("SIGNED_IN", "first")).toBe(true);
    expect(track("SIGNED_IN", "first")).toBe(false);
    track("SIGNED_OUT", null);
    expect(track("SIGNED_IN", "second")).toBe(true);
    expect(IDLE_TIMEOUT_MS).toBe(600000);
  });
});