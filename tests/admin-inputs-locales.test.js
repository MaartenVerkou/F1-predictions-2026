const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const LOCALES = ["de", "en", "es", "fr", "nl"];
const REQUIRED_ADMIN_INPUT_KEYS = [
  "save",
  "remove",
  "move_up",
  "move_down",
  "save_driver",
  "save_team",
  "save_race",
  "race_start",
  "save_assignment",
  "save_alias",
  "save_provider",
  "data_quality",
  "archived_policy_short",
  "archived_policy_title",
  "archived_policy_help",
  "planned_policy_title",
  "planned_policy_help",
  "historical_dialog_title",
  "historical_dialog_help",
  "historical_dialog_confirm",
  "cancel"
];

test("all admin input locales explain each save action", () => {
  for (const locale of LOCALES) {
    const translations = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "locales", `${locale}.json`), "utf8")
    );
    for (const key of REQUIRED_ADMIN_INPUT_KEYS) {
      assert.ok(translations.admin_inputs?.[key], `${locale} admin_inputs.${key} is missing`);
      assert.notEqual(translations.admin_inputs[key], `admin_inputs.${key}`);
    }
  }
});
