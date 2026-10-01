"use strict";

const PROVIDER_POLICY = Object.freeze({
  session: "openf1",
  standings: "derived_race_results",
  driverOfTheDay: "formula1",
  destructors: "reddit_destructors"
});

const UNSUPPORTED_STANDARD_PROVIDERS = new Set([
  "formula1_dashboard"
]);

function normalizeProvider(value) {
  return String(value || "").trim().toLowerCase();
}

function assertStandardEvidenceProvider(value) {
  const provider = normalizeProvider(value);
  if (provider === "openf1") return provider;
  if (UNSUPPORTED_STANDARD_PROVIDERS.has(provider)) {
    throw new Error(
      "Formula 1 standard-session evidence no longer accepts " +
      provider +
      ". Use OpenF1 for practice, sprint qualifying, sprint, qualifying, grid, and race data; " +
      "championship standings are derived from persisted race and sprint results."
    );
  }
  throw new Error(
    "Unsupported standard-session evidence provider \"" +
    (provider || "(empty)") +
    "\". Use OpenF1 for official session and starting-grid facts."
  );
}

function isCanonicalProviderFor(kind, value) {
  const provider = normalizeProvider(value);
  const expected = PROVIDER_POLICY[kind];
  return Boolean(expected && provider === expected);
}

module.exports = {
  PROVIDER_POLICY,
  UNSUPPORTED_STANDARD_PROVIDERS,
  assertStandardEvidenceProvider,
  isCanonicalProviderFor,
  normalizeProvider
};
