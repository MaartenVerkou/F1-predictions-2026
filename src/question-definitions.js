"use strict";

const SUPPORTED_DEFINITION_LOCALES = ["de", "en", "es", "fr", "nl"];
const DEFAULT_DEFINITION_LOCALE = "en";

const QUESTION_DEFINITION_SEEDS = [
  {
    termKey: "dnf",
    sortOrder: 10,
    translations: {
      de: { label: "DNF", explanation: "Nur Grand Prix, DNS und DSQ zaehlen nicht als DNF." },
      en: { label: "DNF", explanation: "Grand Prix only, DNS and DSQ don't count as DNF." },
      es: { label: "DNF", explanation: "Solo Grandes Premios, DNS y DSQ no cuentan como DNF." },
      fr: { label: "DNF", explanation: "Grands Prix uniquement, DNS et DSQ ne comptent pas comme DNF." },
      nl: { label: "DNF", explanation: "Alleen Grand Prix, DNS en DSQ tellen niet als DNF." }
    },
    aliases: { de: ["DNF", "DNFs", "DNF's"], en: ["DNF", "DNFs", "DNF's"], es: ["DNF", "DNFs", "DNF's"], fr: ["DNF", "DNFs", "DNF's"], nl: ["DNF", "DNFs", "DNF's"] }
  },
  {
    termKey: "dns",
    sortOrder: 20,
    translations: {
      de: { label: "DNS", explanation: "DNS bedeutet Did Not Start. DNS-Eintraege werden nicht als DNF gewertet." },
      en: { label: "DNS", explanation: "DNS means Did Not Start. DNS entries are not counted as DNF." },
      es: { label: "DNS", explanation: "DNS significa Did Not Start. Los DNS no se cuentan como DNF." },
      fr: { label: "DNS", explanation: "DNS signifie Did Not Start. Les DNS ne sont pas comptes comme DNF." },
      nl: { label: "DNS", explanation: "DNS betekent Did Not Start. DNS-resultaten tellen niet als DNF." }
    },
    aliases: { de: ["DNS"], en: ["DNS"], es: ["DNS"], fr: ["DNS"], nl: ["DNS"] }
  },
  {
    termKey: "dsq",
    sortOrder: 30,
    translations: {
      de: { label: "DSQ", explanation: "DSQ bedeutet disqualifiziert. Disqualifikationen werden nicht als DNF gewertet." },
      en: { label: "DSQ", explanation: "DSQ means Disqualified. Disqualifications are not counted as DNF." },
      es: { label: "DSQ", explanation: "DSQ significa descalificado. Las descalificaciones no se cuentan como DNF." },
      fr: { label: "DSQ", explanation: "DSQ signifie disqualifie. Les disqualifications ne sont pas comptees comme DNF." },
      nl: { label: "DSQ", explanation: "DSQ betekent diskwalificatie. Diskwalificaties tellen niet als DNF." }
    },
    aliases: { de: ["DSQ"], en: ["DSQ"], es: ["DSQ"], fr: ["DSQ"], nl: ["DSQ"] }
  },
  {
    termKey: "grand_prix",
    sortOrder: 40,
    translations: {
      de: { label: "Grand Prix", explanation: "Grand Prix meint das Hauptrennen (nicht den Sprint)." },
      en: { label: "Grand Prix", explanation: "Grand Prix means the main race event (not the sprint)." },
      es: { label: "Grand Prix", explanation: "Grand Prix se refiere a la carrera principal (no al sprint)." },
      fr: { label: "Grand Prix", explanation: "Grand Prix designe la course principale (pas le sprint)." },
      nl: { label: "Grand Prix", explanation: "Grand Prix betekent de hoofdrace (niet de sprint)." }
    },
    aliases: { de: ["Grand Prix"], en: ["Grand Prix"], es: ["Grand Prix"], fr: ["Grand Prix"], nl: ["Grand Prix"] }
  },
  {
    termKey: "season_start_driver_lineup",
    sortOrder: 100,
    translations: {
      de: { label: "Fahrer", explanation: "Aus der Fahreraufstellung zu Beginn der Saison." },
      en: { label: "Driver", explanation: "From the driver line-up at the beginning of the season." },
      es: { label: "Piloto", explanation: "De la alineacion de pilotos al inicio de la temporada." },
      fr: { label: "Pilote", explanation: "A partir de la composition des pilotes au debut de la saison." },
      nl: { label: "Coureur", explanation: "Uit de coureursopstelling aan het begin van de seizoen." }
    },
    aliases: {
      de: ["Fahrer"],
      en: ["driver"],
      es: ["piloto"],
      fr: ["pilote"],
      nl: ["coureur"]
    },
    questionIds: ["drivers_championship_last"]
  },
  {
    termKey: "grand_prix_podium",
    sortOrder: 110,
    translations: {
      de: { label: "Podium", explanation: "Nur Podien in Grand-Prix-Rennen." },
      en: { label: "Podium", explanation: "Grand Prix podiums only." },
      es: { label: "Podio", explanation: "Solo podios de Gran Premio." },
      fr: { label: "Podium", explanation: "Podiums en Grand Prix uniquement." },
      nl: { label: "Podium", explanation: "Alleen Grand Prix-podia." }
    },
    aliases: {
      de: ["Podium", "Podiumsfahrer"],
      en: ["podium", "podiums", "podium finishers"],
      es: ["podio", "podios"],
      fr: ["podium", "podiums"],
      nl: ["podium", "podiums"]
    },
    questionIds: ["all_podium_finishers", "mini_q3_ferrari_podium", "most_points_no_podium"]
  },
  {
    termKey: "grand_prix_win",
    sortOrder: 120,
    translations: {
      de: { label: "Grand-Prix-Sieg", explanation: "Nur Siege in Grand-Prix-Rennen." },
      en: { label: "Grand Prix win", explanation: "Grand Prix wins only." },
      es: { label: "Victoria de Gran Premio", explanation: "Solo victorias en Grandes Premios." },
      fr: { label: "Victoire en Grand Prix", explanation: "Victoires en Grand Prix uniquement." },
      nl: { label: "Grand Prix-zege", explanation: "Alleen Grand Prix-zeges." }
    },
    aliases: {
      de: ["Rennen"],
      en: ["race"],
      es: ["carrera"],
      fr: ["course"],
      nl: ["race"]
    },
    questionIds: ["lowest_grid_win_position"]
  },
  {
    termKey: "grand_prix_race",
    sortOrder: 130,
    translations: {
      de: { label: "Grand-Prix-Rennen", explanation: "Nur Grand-Prix-Rennen." },
      en: { label: "Grand Prix race", explanation: "Grand Prix races only." },
      es: { label: "Carrera de Gran Premio", explanation: "Solo carreras de Gran Premio." },
      fr: { label: "Course de Grand Prix", explanation: "Courses de Grand Prix uniquement." },
      nl: { label: "Grand Prix-race", explanation: "Alleen Grand Prix-races." }
    },
    aliases: {
      de: ["Rennen"],
      en: ["races"],
      es: ["carreras"],
      fr: ["courses"],
      nl: ["races"]
    },
    questionIds: ["select_three_races_dnfs", "races_before_title_decided"]
  },
  {
    termKey: "mercedes_engine_teams",
    sortOrder: 140,
    translations: {
      de: { label: "Mercedes-Motor-Teams", explanation: "Mercedes, McLaren, Williams und Alpine." },
      en: { label: "teams with Mercedes engines", explanation: "Mercedes, McLaren, Williams, Alpine." },
      es: { label: "equipos con motores Mercedes", explanation: "Mercedes, McLaren, Williams y Alpine." },
      fr: { label: "equipes a moteur Mercedes", explanation: "Mercedes, McLaren, Williams et Alpine." },
      nl: { label: "teams met Mercedes-motoren", explanation: "Mercedes, McLaren, Williams en Alpine." }
    },
    aliases: {
      de: ["Teams mit Mercedes-Motor"],
      en: ["teams with Mercedes engines"],
      es: ["equipos con motor Mercedes"],
      fr: ["equipes a moteur Mercedes"],
      nl: ["teams met Mercedes-motoren"]
    },
    questionIds: ["mini_q2_mercedes_engines_top5"]
  },
  {
    termKey: "destructors_damage",
    sortOrder: 150,
    translations: {
      de: { label: "Schaden", explanation: "Basierend auf den woechentlichen Destructors-Championship-Beitraegen von u/Dense-Strategy-867 auf Reddit (r/formula1)." },
      en: { label: "damage", explanation: "Based on the weekly Destructors Championship posts by u/Dense-Strategy-867 on Reddit (r/formula1)." },
      es: { label: "danos", explanation: "Basado en las publicaciones semanales del Destructors Championship de u/Dense-Strategy-867 en Reddit (r/formula1)." },
      fr: { label: "degats", explanation: "Base sur les publications hebdomadaires Destructors Championship de u/Dense-Strategy-867 sur Reddit (r/formula1)." },
      nl: { label: "schade", explanation: "Gebaseerd op de wekelijkse Destructors Championship-posts van u/Dense-Strategy-867 op Reddit (r/formula1)." }
    },
    aliases: {
      de: ["Schaden"],
      en: ["damage"],
      es: ["danos"],
      fr: ["degats"],
      nl: ["schade"]
    },
    questionIds: ["destructors_driver", "destructors_team"]
  }
];

const POSTGRES_QUESTION_DEFINITIONS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS definition_terms (
  id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  term_key TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS definition_translations (
  term_id INTEGER NOT NULL,
  locale TEXT NOT NULL,
  label TEXT NOT NULL,
  explanation TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (term_id, locale)
);

CREATE TABLE IF NOT EXISTS definition_aliases (
  id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  term_id INTEGER NOT NULL,
  locale TEXT NOT NULL,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  UNIQUE(term_id, locale, normalized_alias)
);

CREATE TABLE IF NOT EXISTS definition_question_bindings (
  term_id INTEGER NOT NULL,
  question_id TEXT NOT NULL,
  PRIMARY KEY(term_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_definition_terms_active_order
  ON definition_terms(is_active, sort_order, term_key);
CREATE INDEX IF NOT EXISTS idx_definition_aliases_locale
  ON definition_aliases(locale, normalized_alias);
CREATE INDEX IF NOT EXISTS idx_definition_bindings_question
  ON definition_question_bindings(question_id, term_id);
`;

const SQLITE_QUESTION_DEFINITIONS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS definition_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term_key TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);
CREATE TABLE IF NOT EXISTS definition_translations (
  term_id INTEGER NOT NULL,
  locale TEXT NOT NULL,
  label TEXT NOT NULL,
  explanation TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (term_id, locale)
);
CREATE TABLE IF NOT EXISTS definition_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term_id INTEGER NOT NULL,
  locale TEXT NOT NULL,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  UNIQUE(term_id, locale, normalized_alias)
);
CREATE TABLE IF NOT EXISTS definition_question_bindings (
  term_id INTEGER NOT NULL,
  question_id TEXT NOT NULL,
  PRIMARY KEY(term_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_definition_terms_active_order
  ON definition_terms(is_active, sort_order, term_key);
CREATE INDEX IF NOT EXISTS idx_definition_aliases_locale
  ON definition_aliases(locale, normalized_alias);
CREATE INDEX IF NOT EXISTS idx_definition_bindings_question
  ON definition_question_bindings(question_id, term_id);
`;

function normalizeDefinitionLocale(locale) {
  const value = String(locale || "").trim().toLowerCase();
  return SUPPORTED_DEFINITION_LOCALES.includes(value) ? value : DEFAULT_DEFINITION_LOCALE;
}

function normalizeAlias(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

function ensureQuestionDefinitionsSchema(db) {
  db.exec(db.dialect === "postgres"
    ? POSTGRES_QUESTION_DEFINITIONS_SCHEMA_SQL
    : SQLITE_QUESTION_DEFINITIONS_SCHEMA_SQL);
  seedQuestionDefinitions(db);
}

function seedQuestionDefinitions(db, now = new Date().toISOString()) {
  const insertTerm = db.prepare(
    `INSERT INTO definition_terms (term_key, sort_order, is_active, created_at, updated_at)
     VALUES (?, ?, 1, ?, ?)
     ON CONFLICT(term_key) DO NOTHING`
  );
  const insertTranslation = db.prepare(
    `INSERT INTO definition_translations (term_id, locale, label, explanation, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(term_id, locale) DO NOTHING`
  );
  const insertAlias = db.prepare(
    `INSERT INTO definition_aliases (term_id, locale, alias, normalized_alias)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(term_id, locale, normalized_alias) DO NOTHING`
  );
  const insertBinding = db.prepare(
    `INSERT INTO definition_question_bindings (term_id, question_id)
     VALUES (?, ?)
     ON CONFLICT(term_id, question_id) DO NOTHING`
  );
  const seed = db.transaction(() => {
    QUESTION_DEFINITION_SEEDS.forEach((definition) => {
      insertTerm.run(definition.termKey, definition.sortOrder, now, now);
      const term = db.prepare("SELECT id FROM definition_terms WHERE term_key = ?").get(definition.termKey);
      if (!term) return;
      const termId = Number(term.id);
      Object.entries(definition.translations).forEach(([locale, translation]) => {
        insertTranslation.run(termId, locale, translation.label, translation.explanation, now);
      });
      Object.entries(definition.aliases || {}).forEach(([locale, aliases]) => {
        (aliases || []).forEach((alias) => {
          const normalized = normalizeAlias(alias);
          if (normalized) insertAlias.run(termId, locale, alias, normalized);
        });
      });
      (definition.questionIds || []).forEach((questionId) => insertBinding.run(termId, questionId));
    });
  });
  seed();
}

function listQuestionDefinitions(db, { locale = DEFAULT_DEFINITION_LOCALE, includeInactive = false } = {}) {
  const resolvedLocale = normalizeDefinitionLocale(locale);
  const rows = db.prepare(
    `SELECT t.id, t.term_key, t.sort_order, t.is_active, t.created_at, t.updated_at, t.archived_at,
            COALESCE(local_translation.label, fallback_translation.label, t.term_key) AS label,
            COALESCE(local_translation.explanation, fallback_translation.explanation, '') AS explanation
       FROM definition_terms t
       LEFT JOIN definition_translations local_translation
         ON local_translation.term_id = t.id AND local_translation.locale = ?
       LEFT JOIN definition_translations fallback_translation
         ON fallback_translation.term_id = t.id AND fallback_translation.locale = ?
      ${includeInactive ? "" : "WHERE t.is_active = 1"}
      ORDER BY t.sort_order ASC, t.term_key ASC`
  ).all(resolvedLocale, DEFAULT_DEFINITION_LOCALE);
  if (!rows.length) return [];
  const ids = rows.map((row) => Number(row.id));
  const placeholders = ids.map(() => "?").join(",");
  const aliasLocales = resolvedLocale === DEFAULT_DEFINITION_LOCALE
    ? [resolvedLocale]
    : [resolvedLocale, DEFAULT_DEFINITION_LOCALE];
  const aliasLocalePlaceholders = aliasLocales.map(() => "?").join(",");
  const aliases = db.prepare(
    `SELECT term_id, locale, alias FROM definition_aliases
      WHERE locale IN (${aliasLocalePlaceholders}) AND term_id IN (${placeholders})
      ORDER BY length(alias) DESC, alias ASC`
  ).all(...aliasLocales, ...ids);
  const bindings = db.prepare(
    `SELECT term_id, question_id FROM definition_question_bindings
      WHERE term_id IN (${placeholders}) ORDER BY question_id ASC`
  ).all(...ids);
  const aliasesByTermLocale = new Map();
  aliases.forEach((row) => {
    const key = `${Number(row.term_id)}:${row.locale}`;
    if (!aliasesByTermLocale.has(key)) aliasesByTermLocale.set(key, []);
    aliasesByTermLocale.get(key).push(String(row.alias));
  });
  const bindingsByTerm = new Map();
  bindings.forEach((row) => {
    if (!bindingsByTerm.has(Number(row.term_id))) bindingsByTerm.set(Number(row.term_id), []);
    bindingsByTerm.get(Number(row.term_id)).push(String(row.question_id));
  });
  return rows.map((row) => ({
    id: Number(row.id),
    termKey: String(row.term_key),
    sortOrder: Number(row.sort_order || 0),
    isActive: Number(row.is_active) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    label: String(row.label || row.term_key),
    explanation: String(row.explanation || ""),
    aliases: Array.from(new Set(
      (aliasesByTermLocale.get(`${Number(row.id)}:${resolvedLocale}`)?.length
        ? aliasesByTermLocale.get(`${Number(row.id)}:${resolvedLocale}`)
        : aliasesByTermLocale.get(`${Number(row.id)}:${DEFAULT_DEFINITION_LOCALE}`) || [])
    )),
    questionIds: bindingsByTerm.get(Number(row.id)) || []
  }));
}

function upsertQuestionDefinition(db, input, { locale = DEFAULT_DEFINITION_LOCALE, now = new Date().toISOString() } = {}) {
  const resolvedLocale = normalizeDefinitionLocale(locale);
  const termKey = String(input.termKey || "").trim().toLowerCase();
  const label = String(input.label || "").trim();
  const explanation = String(input.explanation || "").trim();
  const aliases = Array.from(new Set((Array.isArray(input.aliases) ? input.aliases : String(input.aliases || "").split(","))
    .map((alias) => String(alias || "").trim().replace(/\s+/g, " "))
    .filter(Boolean)));
  const questionIds = Array.from(new Set((Array.isArray(input.questionIds) ? input.questionIds : String(input.questionIds || "").split(","))
    .map((questionId) => String(questionId || "").trim())
    .filter(Boolean)));
  if (!termKey || !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(termKey)) throw new Error("Use a stable lowercase term key.");
  if (!label || !explanation) throw new Error("A label and explanation are required.");
  if (!aliases.length) throw new Error("At least one matching term is required.");
  const sortOrder = Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 0;
  const isActive = input.isActive === false || String(input.isActive) === "0" ? 0 : 1;
  const existingByKey = db.prepare("SELECT id FROM definition_terms WHERE term_key = ?").get(termKey);
  if (input.id) {
    const existingById = db.prepare("SELECT id FROM definition_terms WHERE id = ?").get(Number(input.id));
    if (!existingById) throw new Error("Definition could not be saved.");
    if (existingByKey && Number(existingByKey.id) !== Number(input.id)) {
      throw new Error("A definition with this term key already exists.");
    }
  } else if (existingByKey) {
    throw new Error("A definition with this term key already exists.");
  }
  const transaction = db.transaction(() => {
    if (input.id) {
      db.prepare(
        `UPDATE definition_terms SET term_key = ?, sort_order = ?, is_active = ?,
         updated_at = ?, archived_at = CASE WHEN ? = 1 THEN NULL ELSE COALESCE(archived_at, ?) END
         WHERE id = ?`
      ).run(termKey, sortOrder, isActive, now, isActive, now, Number(input.id));
    } else {
      db.prepare(
        `INSERT INTO definition_terms (term_key, sort_order, is_active, created_at, updated_at, archived_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(termKey, sortOrder, isActive, now, now, isActive ? null : now);
    }
    const term = db.prepare("SELECT id FROM definition_terms WHERE term_key = ?").get(termKey);
    if (!term) throw new Error("Definition could not be saved.");
    const termId = Number(term.id);
    db.prepare(
      `INSERT INTO definition_translations (term_id, locale, label, explanation, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(term_id, locale) DO UPDATE SET label = excluded.label, explanation = excluded.explanation, updated_at = excluded.updated_at`
    ).run(termId, resolvedLocale, label, explanation, now);
    if (resolvedLocale !== DEFAULT_DEFINITION_LOCALE) {
      db.prepare(
        `INSERT INTO definition_translations (term_id, locale, label, explanation, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(term_id, locale) DO NOTHING`
      ).run(termId, DEFAULT_DEFINITION_LOCALE, label, explanation, now);
    }
    db.prepare("DELETE FROM definition_aliases WHERE term_id = ? AND locale = ?").run(termId, resolvedLocale);
    const insertAlias = db.prepare(
      `INSERT INTO definition_aliases (term_id, locale, alias, normalized_alias)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(term_id, locale, normalized_alias) DO NOTHING`
    );
    aliases.forEach((alias) => insertAlias.run(termId, resolvedLocale, alias, normalizeAlias(alias)));
    db.prepare("DELETE FROM definition_question_bindings WHERE term_id = ?").run(termId);
    const insertBinding = db.prepare(
      `INSERT INTO definition_question_bindings (term_id, question_id) VALUES (?, ?)
       ON CONFLICT(term_id, question_id) DO NOTHING`
    );
    questionIds.forEach((questionId) => insertBinding.run(termId, questionId));
    return termId;
  });
  return transaction();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isWordCharacter(value) {
  return Boolean(value && /[\p{L}\p{N}_]/u.test(value));
}

function renderQuestionPromptHtml(question, definitions = []) {
  const text = String(question?.prompt || "");
  if (!text) return "";
  const questionId = String(question?.id || "");
  const applicable = (definitions || []).filter((definition) => (
    definition.isActive !== false
    && (!definition.questionIds || definition.questionIds.length === 0 || definition.questionIds.includes(questionId))
  ));
  const matches = [];
  applicable.forEach((definition, definitionIndex) => {
    (definition.aliases || []).forEach((alias) => {
      const needle = String(alias || "").trim();
      if (!needle) return;
      const lowerText = text.toLocaleLowerCase();
      const lowerNeedle = needle.toLocaleLowerCase();
      let from = 0;
      while (from < text.length) {
        const start = lowerText.indexOf(lowerNeedle, from);
        if (start < 0) break;
        const end = start + needle.length;
        const before = text[start - 1];
        const after = text[end];
        const boundaryOk = (!isWordCharacter(needle[0]) || !isWordCharacter(before))
          && (!isWordCharacter(needle[needle.length - 1]) || !isWordCharacter(after));
        if (boundaryOk) {
          matches.push({
            start,
            end,
            label: text.slice(start, end),
            tip: definition.explanation,
            definitionIndex,
            sortOrder: Number(definition.sortOrder || 0)
          });
        }
        from = Math.max(end, start + 1);
      }
    });
  });
  if (!matches.length) return escapeHtml(text);
  matches.sort((left, right) => {
    if (left.start !== right.start) return left.start - right.start;
    const lengthDifference = (right.end - right.start) - (left.end - left.start);
    if (lengthDifference !== 0) return lengthDifference;
    return left.sortOrder - right.sortOrder || left.definitionIndex - right.definitionIndex;
  });
  const selected = [];
  let lastEnd = -1;
  matches.forEach((match) => {
    if (match.start < lastEnd) return;
    selected.push(match);
    lastEnd = match.end;
  });
  let output = "";
  let cursor = 0;
  selected.forEach((match) => {
    output += escapeHtml(text.slice(cursor, match.start));
    output += `<span class="question-term" tabindex="0"><span class="question-term-label">${escapeHtml(match.label)}</span><span class="question-term-tooltip">${escapeHtml(match.tip)}</span></span>`;
    cursor = match.end;
  });
  output += escapeHtml(text.slice(cursor));
  return output;
}

module.exports = {
  DEFAULT_DEFINITION_LOCALE,
  POSTGRES_QUESTION_DEFINITIONS_SCHEMA_SQL,
  QUESTION_DEFINITION_SEEDS,
  SQLITE_QUESTION_DEFINITIONS_SCHEMA_SQL,
  SUPPORTED_DEFINITION_LOCALES,
  ensureQuestionDefinitionsSchema,
  listQuestionDefinitions,
  normalizeDefinitionLocale,
  renderQuestionPromptHtml,
  seedQuestionDefinitions,
  upsertQuestionDefinition
};
