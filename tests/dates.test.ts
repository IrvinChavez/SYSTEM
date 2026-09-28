/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { eventTiming, formatClock, formatDuration, freeBlocks } from "@/lib/dates";

const calculo = { date: "2026-09-28", start: "07:00", end: "09:00" };
const at = (time: string) => new Date(`2026-09-28T${time}`);

test("formatDuration", () => {
  assert.equal(formatDuration(120), "2 h");
  assert.equal(formatDuration(90), "1 h 30 min");
  assert.equal(formatDuration(45), "45 min");
  assert.equal(formatDuration(-5), "0 min");
});

test("formatClock", () => {
  assert.equal(formatClock(0), "00:00");
  assert.equal(formatClock(65), "01:05");
  assert.equal(formatClock(2 * 3600 + 37 * 60 + 12), "02:37:12");
});

test("eventTiming: el contador arranca en cero al empezar la clase", () => {
  assert.deepEqual(eventTiming(calculo, at("06:30:00")), { status: "upcoming", totalSeconds: 7200, elapsedSeconds: 0, startsInSeconds: 1800 });
  assert.deepEqual(eventTiming(calculo, at("07:00:00")), { status: "live", totalSeconds: 7200, elapsedSeconds: 0, startsInSeconds: 0 });
  assert.equal(eventTiming(calculo, at("08:15:30")).elapsedSeconds, 4530);
  assert.equal(eventTiming(calculo, at("09:00:00")).status, "done");
});

test("freeBlocks: huecos entre eventos encimados", () => {
  const events = [
    { start: "07:00", end: "09:00" },
    { start: "08:30", end: "10:00" },
    { start: "10:10", end: "11:00" },
    { start: "15:00", end: "17:00" },
  ];
  assert.deepEqual(freeBlocks(events, "06:00", "22:00"), [
    { start: "06:00", end: "07:00" },
    { start: "11:00", end: "15:00" },
    { start: "17:00", end: "22:00" },
  ]);
  assert.deepEqual(freeBlocks([], "20:00", "22:00"), [{ start: "20:00", end: "22:00" }]);
  assert.deepEqual(freeBlocks(events, "16:00", "16:30"), []);
});
