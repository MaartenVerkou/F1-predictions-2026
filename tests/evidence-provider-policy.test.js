"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PROVIDER_POLICY,
  assertStandardEvidenceProvider,
  isCanonicalProviderFor
} = require("../src/evidence-provider-policy");

test("the source policy has one owner for each fact family", () => {
  assert.deepEqual(PROVIDER_POLICY, {
    session: "openf1",
    standings: "derived_race_results",
    driverOfTheDay: "formula1",
    destructors: "reddit_destructors"
  });
  assert.equal(assertStandardEvidenceProvider("openf1"), "openf1");
  assert.equal(isCanonicalProviderFor("standings", "derived_race_results"), true);
  assert.equal(isCanonicalProviderFor("destructors", "reddit_destructors"), true);
});

test("legacy standard-results providers fail with an actionable migration error", () => {
  assert.throws(
    () => assertStandardEvidenceProvider("formula1_dashboard"),
    /Use OpenF1.*championship standings are derived/
  );
  assert.throws(
    () => assertStandardEvidenceProvider("jolpica_ergast"),
    /Unsupported standard-session evidence provider/
  );
});
