import { describe, expect, it } from "vitest";
import {
  detectDanger, detectNotInterested, detectOptOut, detectUrgency, makesUnauthorisedPromise,
  mentionsUnknownPrice, temperatureFromScore,
} from "./guards";

const KB = "Services offered:\n- Roof repair — typical price: €150–€400\n- New roof — price: not provided (do not quote)";

describe("price guard", () => {
  it("allows prices the business configured", () => {
    expect(mentionsUnknownPrice("A roof repair is typically €150–€400.", KB)).toBe(false);
  });
  it("blocks invented prices", () => {
    expect(mentionsUnknownPrice("A new roof is usually around €8,000.", KB)).toBe(true);
    expect(mentionsUnknownPrice("That would be 500 euro", KB)).toBe(true);
    expect(mentionsUnknownPrice("Roughly $99 for the call-out", KB)).toBe(true);
  });
  it("ignores numbers that aren't money", () => {
    expect(mentionsUnknownPrice("Is it about 2 square metres?", KB)).toBe(false);
  });
});

describe("promise guard", () => {
  it("blocks bookings and invented guarantees", () => {
    expect(makesUnauthorisedPromise("Great, I've booked you in for Tuesday", KB)).toBe(true);
    expect(makesUnauthorisedPromise("We'll be there at 3pm", KB)).toBe(true);
    expect(makesUnauthorisedPromise("All our work is guaranteed", KB)).toBe(true);
  });
  it("allows guarantees the business wrote about", () => {
    expect(makesUnauthorisedPromise("Yes, all work comes with our 10-year guarantee.", KB + "\nQ: Guarantee?\nA: 10-year guarantee")).toBe(false);
  });
  it("allows normal replies", () => {
    expect(makesUnauthorisedPromise("A team member will be in touch shortly.", KB)).toBe(false);
  });
});

describe("intent detection", () => {
  it("detects urgency", () => {
    for (const t of ["I need someone ASAP", "The leak is getting worse", "it's an emergency", "pipe burst in the kitchen", "no heating since yesterday", "can you come today?"])
      expect(detectUrgency(t), t).toBe(true);
    expect(detectUrgency("Just looking for a quote for next spring")).toBe(false);
  });
  it("detects opt-out only for clear stop words", () => {
    expect(detectOptOut("STOP")).toBe(true);
    expect(detectOptOut("unsubscribe")).toBe(true);
    expect(detectOptOut("please don't stop the work halfway")).toBe(false);
  });
  it("detects not interested and danger", () => {
    expect(detectNotInterested("No thanks, found someone already")).toBe(true);
    expect(detectDanger("I can smell gas in the hall")).toBe(true);
  });
});

describe("scoring", () => {
  it("maps score to temperature", () => {
    expect(temperatureFromScore(85)).toBe("hot");
    expect(temperatureFromScore(60)).toBe("warm");
    expect(temperatureFromScore(10)).toBe("cold");
  });
});
