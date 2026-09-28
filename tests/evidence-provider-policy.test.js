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
    standings: "jolpica_ergast",
    driverOfTheDay: "formula1",
    destructors: "reddit_destructors"
  });
  assert.equal(assertStandardEvidenceProvider("openf1"), "openf1");
  assert.equal(isCanonicalProviderFor("standings", "jolpica_ergast"), true);
  assert.equal(isCanonicalProviderFor("destructors", "reddit_destructors"), true);
});

test("legacy standard-results providers fail with an actionable migration error", () => {
  assert.throws(
    () => assertStandardEvidenceProvider("formula1_dashboard"),
    /Use OpenF1.*Jolpica\/Ergast is reserved for championship standings/
  );
  assert.throws(
    () => assertStandardEvidenceProvider("jolpica_ergast"),
    /Use OpenF1/
  );
});
