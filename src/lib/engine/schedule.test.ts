import { describe, expect, it } from "vitest";
import { outsideQuietHours } from "./schedule";

const biz = { timezone: "Europe/Dublin", quiet_hours_start: 20, quiet_hours_end: 8 };
const dublinHour = (d: Date) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Dublin", hour: "numeric", hourCycle: "h23" }).format(d));

describe("quiet hours", () => {
  it("leaves daytime alone", () => {
    const d = new Date("2026-11-25T14:00:00Z");
    expect(outsideQuietHours(d, biz).toISOString()).toBe(d.toISOString());
  });
  it("moves late-night follow-ups to the morning", () => {
    const out = outsideQuietHours(new Date("2026-11-25T22:30:00Z"), biz);
    expect(dublinHour(out)).toBe(8);
    expect(out.getTime()).toBeGreaterThan(new Date("2026-11-25T22:30:00Z").getTime());
  });
  it("respects the business time zone", () => {
    const ny = { ...biz, timezone: "America/New_York" };
    // 23:00 UTC = 18:00 in New York → allowed
    const d = new Date("2026-11-25T23:00:00Z");
    expect(outsideQuietHours(d, ny).toISOString()).toBe(d.toISOString());
  });
});
