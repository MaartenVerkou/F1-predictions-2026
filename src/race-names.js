"use strict";

const RACE_NAME_ALIASES = {
  barcelonagrandprix: "Barcelona-Catalunya Grand Prix"
};

function normalizeLookupKey(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function resolveConfiguredRaceName(raw, configuredRaces = []) {
  const key = normalizeLookupKey(raw);
  if (!key) return null;
  const aliased = RACE_NAME_ALIASES[key];
  if (aliased && configuredRaces.includes(aliased)) return aliased;
  return configuredRaces.find((race) => normalizeLookupKey(race) === key) || null;
}

module.exports = {
  RACE_NAME_ALIASES,
  resolveConfiguredRaceName
};
