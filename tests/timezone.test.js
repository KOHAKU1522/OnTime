import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDaysToKey, addMonthsToKey, dateKeyInZone } from "../src/utils/timezone.js";

describe("timezone date helpers", () => {
  it("adds calendar days across month boundaries", () => {
    assert.equal(addDaysToKey("2024-02-28", 1), "2024-02-29");
  });

  it("clamps month additions to the target month's last day", () => {
    assert.equal(addMonthsToKey("2024-01-31", 1), "2024-02-29");
  });

  it("derives the date in the requested time zone", () => {
    assert.equal(
        dateKeyInZone(new Date("2024-01-01T00:30:00Z"), "Asia/Tokyo"),
        "2024-01-01",
    );
  });
});