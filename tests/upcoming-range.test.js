import assert from "node:assert/strict";
import { test } from "node:test";
import { getUpcomingRange, isInRange } from "../src/utils/date.js";

test("seven days includes today through day six, across a month boundary", () => {
    const range = getUpcomingRange(new Date("2026-10-27T12:00:00+09:00"), 7, "Asia/Tokyo");
    assert.equal(isInRange(new Date("2026-10-26T23:59:59+09:00"), range), false);
    assert.equal(isInRange(new Date("2026-10-27T00:00:00+09:00"), range), true);
    assert.equal(isInRange(new Date("2026-11-02T23:59:59+09:00"), range), true);
    assert.equal(isInRange(new Date("2026-11-03T00:00:00+09:00"), range), false);
});

test("31 days is a fixed calendar-day count rather than a calendar month", () => {
    const range = getUpcomingRange(new Date("2026-02-01T12:00:00+09:00"), 31, "Asia/Tokyo");
    assert.equal(isInRange(new Date("2026-03-03T23:59:59+09:00"), range), true);
    assert.equal(isInRange(new Date("2026-03-04T00:00:00+09:00"), range), false);
});

test("day boundaries follow the selected timezone across daylight saving", () => {
    const range = getUpcomingRange(new Date("2026-03-07T12:00:00-05:00"), 7, "America/New_York");
    assert.equal(range.start.toISOString(), "2026-03-07T05:00:00.000Z");
    assert.equal(range.end.toISOString(), "2026-03-14T04:00:00.000Z");
});
