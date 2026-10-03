"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildPersistedDataFromEvidence,
  clearPersistedDerivationCache,
  compareSnapshotValues,
  deriveSnapshotsFromPersistedEvidence,
  getPersistedDerivationCacheStats
} = require("../scripts/backfill-actuals-2026");

test("snapshot comparison reports new, changed, and unchanged values", () => {
  assert.deepEqual(compareSnapshotValues(null, { q1: "A" }), {
    status: "new",
    existingCount: 0,
    derivedCount: 1,
    unchangedCount: 0,
    changedCount: 1,
    addedCount: 1,
    removedCount: 0
  });
  assert.deepEqual(compareSnapshotValues({ q1: "A", q2: "B" }, { q1: "A", q2: "C" }), {
    status: "changed",
    existingCount: 2,
    derivedCount: 2,
    unchangedCount: 1,
    changedCount: 1,
    addedCount: 0,
    removedCount: 0
  });
  assert.equal(compareSnapshotValues({ q1: "A" }, { q1: "A" }).status, "unchanged");
});

test("persisted evidence reconstructs derivation input without provider objects", () => {
  const data = buildPersistedDataFromEvidence([{
    round_number: 6,
    round_name: "Monaco Grand Prix",
    payload: {
      roundName: "Monaco Grand Prix",
      race: {
        date: "2026-05-24",
        circuit: "Circuit de Monaco",
        rows: [{
          driver: "Kimi Antonelli",
          constructor: "Mercedes",
          position: 1,
          positionText: "1",
          grid: 3,
          points: 25,
          status: "Finished",
          laps: 78
        }]
      },
      qualifying: { rows: [] },
      sprint: { rows: [] },
      standings: {
        drivers: [{ entity: "Kimi Antonelli", position: 1, points: 25 }],
        constructors: [{ entity: "Mercedes", position: 1, points: 25 }]
      },
      external: { driverOfTheDay: "Kimi Antonelli" }
    }
  }], 2026);

  assert.equal(data.results.length, 1);
  assert.equal(data.results[0].Results[0].Driver.givenName, "Kimi");
  assert.equal(data.results[0].Results[0].Constructor.name, "Mercedes");
  assert.equal(data.driverStandingsByRound.get(6)[0].Driver.familyName, "Antonelli");
  assert.equal(data.constructorStandingsByRound.get(6)[0].Constructor.name, "Mercedes");
  assert.equal(data.driverOfTheDayByRound.get(6), "Kimi Antonelli");
});

test("persisted derivation reuses an unchanged evidence revision and clears after correction", () => {
  const evidenceRow = {
    id: 7,
    round_number: 1,
    round_name: "Australian Grand Prix",
    sync_id: "openf1:2026:r1:v1",
    payload_revision: "payload-v1",
    created_at: "2026-03-16T12:00:00.000Z",
    payload: {
      roundName: "Australian Grand Prix",
      race: { rows: [] },
      qualifying: { rows: [] },
      sprint: { rows: [] }
    }
  };
  let queryCount = 0;
  const db = {
    prepare() {
      return {
        all() {
          queryCount += 1;
          return [evidenceRow];
        }
      };
    }
  };
  const input = {
    season: 2026,
    rounds: [1],
    questions: [],
    roster: { drivers: [], teams: [], team_profiles: {} },
    races: ["Australian Grand Prix"],
    totalRounds: 1
  };

  clearPersistedDerivationCache(db);
  deriveSnapshotsFromPersistedEvidence(db, input);
  deriveSnapshotsFromPersistedEvidence(db, input);

  assert.equal(queryCount, 2, "the revision is read for each derivation call");
  assert.deepEqual(getPersistedDerivationCacheStats(db), { entries: 1, hits: 1, misses: 1 });

  evidenceRow.payload_revision = "payload-v2";
  deriveSnapshotsFromPersistedEvidence(db, input);
  assert.deepEqual(getPersistedDerivationCacheStats(db), { entries: 2, hits: 1, misses: 2 });

  clearPersistedDerivationCache(db, { season: 2026 });
  assert.deepEqual(getPersistedDerivationCacheStats(db), { entries: 0, hits: 1, misses: 2 });
});
