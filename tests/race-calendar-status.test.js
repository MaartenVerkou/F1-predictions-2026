const test = require("node:test");
const assert = require("node:assert/strict");

const { deriveRaceCalendarStatus } = require("../src/season-inputs");

const NOW = new Date("2026-09-22T12:00:00.000Z");

test("derives upcoming, started, and completed from the scheduled start", () => {
  assert.equal(
    deriveRaceCalendarStatus({ calendar_state: "scheduled", scheduled_date: "2026-09-22T12:00:01.000Z" }, NOW),
    "upcoming"
  );
  assert.equal(
    deriveRaceCalendarStatus({ calendar_state: "scheduled", scheduled_date: "2026-09-22T12:00:00.000Z" }, NOW),
    "started"
  );
  assert.equal(
    deriveRaceCalendarStatus({ calendar_state: "scheduled", scheduled_date: "2026-09-01T12:00:00.000Z" }, NOW),
    "completed"
  );
  assert.equal(
    deriveRaceCalendarStatus({ calendar_state: "scheduled", scheduled_date: "2026-09-22T00:00:01.000Z" }, NOW),
    "started"
  );
  assert.equal(
    deriveRaceCalendarStatus({ calendar_state: "scheduled", scheduled_date: "2026-09-22T00:00:00.000Z" }, NOW),
    "completed"
  );
});

test("explicit calendar states override the clock", () => {
  for (const state of ["completed", "cancelled", "partial"]) {
    assert.equal(
      deriveRaceCalendarStatus({ calendar_state: state, scheduled_date: "2099-01-01T00:00:00.000Z" }, NOW),
      state
    );
  }
});

test("missing or invalid starts are not guessed", () => {
  assert.equal(deriveRaceCalendarStatus({ calendar_state: "scheduled" }, NOW), "unscheduled");
  assert.equal(
    deriveRaceCalendarStatus({ calendar_state: "scheduled", scheduled_date: "not-a-date" }, NOW),
    "unscheduled"
  );
});
