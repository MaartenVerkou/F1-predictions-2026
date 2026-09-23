"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildEvidenceBundle,
  completeRaceDataImport,
  createRaceDataImport,
  ensureRaceDataSchema,
  findRaceDataSnapshot,
  listRaceDataSnapshots,
  saveRaceDataSnapshot,
  summarizeEvidence
} = require("../src/race-data-evidence");

const roster = {
  drivers: ["Kimi Antonelli", "Carlos Sainz Jr."],
  teams: ["Mercedes", "Williams"]
};

test("buildEvidenceBundle normalizes race, qualifying, and standings evidence", () => {
  const evidence = buildEvidenceBundle({
    data: {
      season: 2026,
      results: [{
        round: 6,
        raceName: "Monaco Grand Prix",
        date: "2026-05-24",
        Circuit: { circuitName: "Circuit de Monaco" },
        Results: [
          {
            position: "1",
            grid: "1",
            points: "25",
            status: "Finished",
            Driver: { givenName: "Andrea Kimi", familyName: "Antonelli" },
            Constructor: { name: "Mercedes" }
          },
          {
            position: "Retired",
            grid: "4",
            points: "0",
            status: "Retired",
            Driver: { givenName: "Carlos", familyName: "Sainz" },
            Constructor: { name: "Williams" }
          }
        ]
      }],
      qualifying: [{
        round: 6,
        QualifyingResults: [
          {
            position: "1",
            Driver: { givenName: "Andrea Kimi", familyName: "Antonelli" },
            Constructor: { name: "Mercedes" }
          }
        ]
      }],
      sprints: [],
      driverStandingsByRound: new Map([[
        6,
        [
          {
            position: "1",
            points: "25",
            Driver: { givenName: "Andrea Kimi", familyName: "Antonelli" }
          }
        ]
      ]]),
      constructorStandingsByRound: new Map([[
        6,
        [
          {
            position: "1",
            points: "25",
            Constructor: { name: "Mercedes" }
          }
        ]
      ]]),
      driverOfTheDayByRound: new Map()
    },
    roster,
    roundNumber: 6,
    roundName: "Monaco Grand Prix",
    fetchedAt: "2026-09-21T00:00:00.000Z",
    sourceUrls: { race: "https://example.test/race" }
  });

  assert.equal(evidence.season, 2026);
  assert.equal(evidence.roundNumber, 6);
  assert.equal(evidence.coverage.status, "complete");
  assert.equal(evidence.coverage.sources.race.count, 2);
  assert.equal(evidence.coverage.sources.qualifying.count, 1);
  assert.equal(evidence.coverage.sources.sprint.available, false);
  assert.equal(evidence.race.rows[0].driver, "Kimi Antonelli");
  assert.equal(evidence.race.rows[1].driver, "Carlos Sainz Jr.");
  assert.equal(evidence.race.rows[1].position, null);
  assert.equal(evidence.race.rows[1].status, "Retired");
  assert.equal(evidence.sourceUrls.race, "https://example.test/race");
});

test("summarizeEvidence reports source row counts", () => {
  const summary = summarizeEvidence({
    coverage: {
      status: "incomplete",
      sources: {
        race: { count: 20 },
        qualifying: { count: 20 },
        sprint: { count: 0 },
        driverStandings: { count: 20 },
        constructorStandings: { count: 10 }
      }
    }
  });
  assert.deepEqual(summary, {
    status: "incomplete",
    raceCount: 20,
    qualifyingCount: 20,
    sprintCount: 0,
    driverStandingsCount: 20,
    constructorStandingsCount: 10
  });
});

test("persisted evidence is reusable by round and idempotent for the same sync", (t) => {
  const Database = require("better-sqlite3");
  const db = new Database(":memory:");
  db.dialect = "sqlite";
  db.exec(`
    CREATE TABLE actual_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_data_import_id INTEGER,
      source_data_snapshot_id INTEGER
    );
  `);
  ensureRaceDataSchema(db);
  t.after(() => db.close());

  const importId = createRaceDataImport(db, {
    season: 2026,
    syncId: "sync-r6",
    requestedRounds: 1,
    sourceNote: "test import"
  });
  const evidence = {
    roundName: "Monaco Grand Prix",
    coverage: { status: "complete", sources: { race: { count: 1 } } },
    race: { rows: [{ driver: "driver:1", constructor: "team:10", position: 1 }] }
  };
  const firstId = saveRaceDataSnapshot(db, {
    season: 2026,
    roundNumber: 6,
    roundName: "Monaco Grand Prix",
    syncId: "sync-r6",
    importId,
    fetchedAt: "2026-09-21T00:00:00.000Z",
    evidence
  });
  const secondId = saveRaceDataSnapshot(db, {
    season: 2026,
    roundNumber: 6,
    roundName: "Monaco Grand Prix",
    syncId: "sync-r6",
    importId,
    fetchedAt: "2026-09-21T00:00:00.000Z",
    evidence
  });

  assert.equal(secondId, firstId);
  assert.equal(listRaceDataSnapshots(db, 2026).length, 1);
  assert.deepEqual(findRaceDataSnapshot(db, 2026, 6).payload.race.rows[0], evidence.race.rows[0]);
  assert.equal(completeRaceDataImport(db, importId, { completedRounds: 1 }), 1);
  assert.equal(db.prepare("SELECT status, completed_rounds FROM race_data_imports WHERE id = ?").get(importId).status, "completed");
});
