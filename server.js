const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const bcrypt = require("bcrypt");
const Database = require("better-sqlite3");
const nodemailer = require("nodemailer");
const { registerAuthRoutes } = require("./src/routes/auth");
const { registerAdminRoutes } = require("./src/routes/admin");

function loadDotEnvIfPresent(filePath = path.join(__dirname, ".env")) {
  if (!fs.existsSync(filePath)) return;
  let raw = "";
  try {
    raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  } catch (err) {
    console.error(`Failed to read env file: ${filePath}`, err);
    return;
  }

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;

    const key = line.slice(0, idx).trim();
    if (!key || process.env[key] != null) continue;

    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDotEnvIfPresent();

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "app.db");
const QUESTIONS_PATH = process.env.QUESTIONS_PATH || path.join(DATA_DIR, "questions.json");
const ROSTER_PATH = process.env.ROSTER_PATH || path.join(DATA_DIR, "roster.json");
const RACES_PATH = process.env.RACES_PATH || path.join(DATA_DIR, "races.json");
const LAST_SEASON_RESULTS_PATH =
  process.env.LAST_SEASON_RESULTS_PATH ||
  path.join(DATA_DIR, "last-season-results.json");
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-only-change-me";
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_FROM = process.env.SMTP_FROM || "";
const COMPANY_NAME = process.env.COMPANY_NAME || "Wheel of Knowledge";
function deriveContactEmail() {
  const explicit = String(process.env.CONTACT_EMAIL || "").trim();
  if (explicit) return explicit;

  const from = String(SMTP_FROM || "").trim();
  if (from) {
    const bracketMatch = from.match(/<([^>]+)>/);
    if (bracketMatch && bracketMatch[1]) {
      return bracketMatch[1].trim();
    }
    if (from.includes("@") && !/\s/.test(from)) {
      return from;
    }
  }

  const smtpUser = String(SMTP_USER || "").trim();
  if (smtpUser) return smtpUser;

  return "info@crashalong.com";
}
const CONTACT_EMAIL = deriveContactEmail();
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_CLIENT_NAME = process.env.SMTP_CLIENT_NAME || "";
const PAYPAL_DONATION_URL = String(process.env.PAYPAL_DONATION_URL || "").trim();
const PAYPAL_DONATION_LABEL =
  String(process.env.PAYPAL_DONATION_LABEL || "").trim() || "Donate";
function deriveBaseUrl() {
  const envMode = String(process.env.NODE_ENV || "development").trim().toLowerCase();
  if (envMode !== "production") {
    return `http://localhost:${PORT}`;
  }
  const rawDomain = String(process.env.APP_DOMAIN || "localhost")
    .trim()
    .replace(/\/+$/, "");
  const host = rawDomain.replace(/^https?:\/\//i, "");
  const localhostHostPattern = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i;

  if (localhostHostPattern.test(host)) {
    if (host.includes(":")) return `http://${host}`;
    return `http://${host}:${PORT}`;
  }

  if (/^https?:\/\//i.test(rawDomain)) return rawDomain;
  return `https://${host}`;
}
const BASE_URL = deriveBaseUrl();
function deriveAppDomainHost() {
  try {
    return new URL(BASE_URL).hostname || "";
  } catch (err) {
    const raw = String(process.env.APP_DOMAIN || "")
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "");
    const host = raw.split("/")[0] || "";
    return host.split(":")[0] || "";
  }
}
const APP_DOMAIN_HOST = deriveAppDomainHost();
const DEV_AUTO_LOGIN = process.env.DEV_AUTO_LOGIN === "1";
const DEV_AUTO_LOGIN_EMAIL =
  process.env.DEV_AUTO_LOGIN_EMAIL || "dev@example.com";
const DEV_AUTO_LOGIN_NAME = process.env.DEV_AUTO_LOGIN_NAME || "Dev Admin";
const IS_DEVELOPMENT = (process.env.NODE_ENV || "development") !== "production";
const PREDICTIONS_CLOSE_AT =
  process.env.PREDICTIONS_CLOSE_AT || "2026-03-05T23:59:59";
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);
const LEADERBOARD_ENABLED = process.env.LEADERBOARD_ENABLED === "1";
const MAX_PRIVILEGED_GROUPS = 3;
const LOCALES_DIR = path.join(__dirname, "locales");
const SUPPORTED_LOCALES = ["en", "de", "fr", "nl", "es"];
const DEFAULT_LOCALE = "en";
const LOCALE_LABELS = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  nl: "Nederlands",
  es: "Español"
};
const localeCache = new Map();

function detectLocaleFromAcceptLanguage(headerValue) {
  const raw = String(headerValue || "").trim();
  if (!raw) return DEFAULT_LOCALE;

  const candidates = raw
    .split(",")
    .map((part, index) => {
      const [langRaw, ...params] = part.trim().split(";");
      const lang = String(langRaw || "").trim().toLowerCase();
      if (!lang) return null;
      const base = lang.split("-")[0];
      let quality = 1;
      for (const param of params) {
        const [k, v] = param.trim().split("=");
        if (String(k || "").trim().toLowerCase() !== "q") continue;
        const parsed = Number(v);
        if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
          quality = parsed;
        }
      }
      return { lang, base, quality, index };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.quality !== a.quality) return b.quality - a.quality;
      return a.index - b.index;
    });

  for (const candidate of candidates) {
    if (SUPPORTED_LOCALES.includes(candidate.lang)) return candidate.lang;
    if (SUPPORTED_LOCALES.includes(candidate.base)) return candidate.base;
  }
  return DEFAULT_LOCALE;
}

function formatCloseDateForRules(locale = DEFAULT_LOCALE) {
  const closeDate = new Date(PREDICTIONS_CLOSE_AT);
  if (Number.isNaN(closeDate.getTime())) return "";
  return closeDate.toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function formatAdminDateTime(value) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date
    .toLocaleString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    })
    .replace(",", "");
}

function loadLocale(locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) return {};
  if (localeCache.has(locale)) return localeCache.get(locale);
  const filePath = path.join(LOCALES_DIR, `${locale}.json`);
  if (!fs.existsSync(filePath)) {
    localeCache.set(locale, {});
    return {};
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw);
    localeCache.set(locale, parsed);
    return parsed;
  } catch (err) {
    console.error(`Failed to load locale file: ${filePath}`, err);
    localeCache.set(locale, {});
    return {};
  }
}

function translate(locale, key, params = {}) {
  const dict = loadLocale(locale);
  const value = key.split(".").reduce((acc, part) => {
    if (!acc || typeof acc !== "object") return undefined;
    return acc[part];
  }, dict);
  const template = typeof value === "string" ? value : key;
  return template.replace(/\{(\w+)\}/g, (_, token) => {
    if (params[token] == null) return `{${token}}`;
    return String(params[token]);
  });
}

function getDefaultGroupRules(locale = DEFAULT_LOCALE) {
  const closeDate = formatCloseDateForRules(locale);
  return translate(locale, "group.default_rules", {
    close_date: closeDate
  });
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    owner_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS group_members (
    user_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    joined_at TEXT NOT NULL,
    PRIMARY KEY(user_id, group_id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(group_id) REFERENCES groups(id)
  );

  CREATE TABLE IF NOT EXISTS invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    code TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    expires_at TEXT,
    FOREIGN KEY(group_id) REFERENCES groups(id),
    FOREIGN KEY(created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    question_id TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, group_id, question_id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(group_id) REFERENCES groups(id)
  );

  CREATE TABLE IF NOT EXISTS guest_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_id TEXT NOT NULL,
    group_id INTEGER NOT NULL,
    question_id TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(guest_id, group_id, question_id),
    FOREIGN KEY(group_id) REFERENCES groups(id)
  );

  CREATE TABLE IF NOT EXISTS named_guest_profiles (
    guest_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    source_group_id INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(source_group_id) REFERENCES groups(id)
  );

  CREATE TABLE IF NOT EXISTS named_guest_group_members (
    group_id INTEGER NOT NULL,
    guest_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    joined_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(group_id, guest_id),
    FOREIGN KEY(group_id) REFERENCES groups(id)
  );

  CREATE TABLE IF NOT EXISTS actuals (
    question_id TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS question_settings (
    question_id TEXT PRIMARY KEY,
    included INTEGER NOT NULL DEFAULT 1,
    points_override TEXT,
    order_index INTEGER,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS email_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS pending_guest_claims (
    user_id INTEGER PRIMARY KEY,
    guest_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

function ensureGroupColumns() {
  const columns = db.prepare("PRAGMA table_info(groups);").all();
  const names = new Set(columns.map((col) => col.name));
  if (!names.has("join_code")) {
    db.exec("ALTER TABLE groups ADD COLUMN join_code TEXT;");
  }
  if (!names.has("join_password_hash")) {
    db.exec("ALTER TABLE groups ADD COLUMN join_password_hash TEXT;");
  }
  if (!names.has("is_public")) {
    db.exec("ALTER TABLE groups ADD COLUMN is_public INTEGER DEFAULT 0;");
  }
  if (!names.has("is_global")) {
    db.exec("ALTER TABLE groups ADD COLUMN is_global INTEGER DEFAULT 0;");
  }
  if (!names.has("rules_text")) {
    db.exec("ALTER TABLE groups ADD COLUMN rules_text TEXT;");
  }
  if (!names.has("is_simulated")) {
    db.exec("ALTER TABLE groups ADD COLUMN is_simulated INTEGER DEFAULT 0;");
  }
  if (!names.has("invite_link_open")) {
    db.exec("ALTER TABLE groups ADD COLUMN invite_link_open INTEGER DEFAULT 1;");
  }
  db.prepare(
    "UPDATE groups SET invite_link_open = 1 WHERE invite_link_open IS NULL"
  ).run();
}

ensureGroupColumns();

function ensureGroupMemberColumns() {
  const columns = db.prepare("PRAGMA table_info(group_members);").all();
  const names = new Set(columns.map((col) => col.name));
  if (!names.has("coupled_to_global")) {
    db.exec("ALTER TABLE group_members ADD COLUMN coupled_to_global INTEGER DEFAULT 1;");
  }
  db.prepare(
    "UPDATE group_members SET coupled_to_global = 1 WHERE coupled_to_global IS NULL"
  ).run();
}

ensureGroupMemberColumns();

function ensureUserColumns() {
  const columns = db.prepare("PRAGMA table_info(users);").all();
  const names = new Set(columns.map((col) => col.name));
  if (!names.has("is_verified")) {
    db.exec("ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0;");
  }
  if (!names.has("verified_at")) {
    db.exec("ALTER TABLE users ADD COLUMN verified_at TEXT;");
  }
  if (!names.has("is_admin")) {
    db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0;");
  }
  if (!names.has("is_simulated")) {
    db.exec("ALTER TABLE users ADD COLUMN is_simulated INTEGER DEFAULT 0;");
  }
  if (!names.has("hide_from_global")) {
    db.exec("ALTER TABLE users ADD COLUMN hide_from_global INTEGER DEFAULT 0;");
  }
  db.prepare(
    "UPDATE users SET hide_from_global = 0 WHERE hide_from_global IS NULL"
  ).run();
}

ensureUserColumns();

function ensureQuestionSettingsColumns() {
  const columns = db.prepare("PRAGMA table_info(question_settings);").all();
  const names = new Set(columns.map((col) => col.name));
  if (!names.has("order_index")) {
    db.exec("ALTER TABLE question_settings ADD COLUMN order_index INTEGER;");
  }
}

ensureQuestionSettingsColumns();

function backfillNamedGuestGroupMembers() {
  db.exec(
    `
    INSERT OR IGNORE INTO named_guest_group_members (group_id, guest_id, display_name, joined_at, updated_at)
    SELECT
      gr.group_id,
      gr.guest_id,
      ngp.display_name,
      MIN(gr.created_at) as joined_at,
      MAX(gr.updated_at) as updated_at
    FROM guest_responses gr
    JOIN named_guest_profiles ngp ON ngp.guest_id = gr.guest_id
    GROUP BY gr.group_id, gr.guest_id, ngp.display_name
    `
  );
}

backfillNamedGuestGroupMembers();

function syncAdminWhitelist() {
  if (!ADMIN_EMAILS.size) return;
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    for (const email of ADMIN_EMAILS) {
      db.prepare(
        "UPDATE users SET is_admin = 1, is_verified = 1, verified_at = COALESCE(verified_at, ?) WHERE email = ?"
      ).run(now, email);
    }
  });
  tx();
}

syncAdminWhitelist();

function getGlobalGroup() {
  return db.prepare("SELECT * FROM groups WHERE is_global = 1 LIMIT 1").get();
}

function isGlobalGroup(group) {
  return Number(group?.is_global || 0) === 1;
}

function getGroupBasePath(group) {
  if (isGlobalGroup(group)) return "/global";
  const groupId = Number(group?.id || 0);
  return groupId > 0 ? `/groups/${groupId}` : "/groups";
}

function getGroupById(groupId) {
  const normalizedGroupId = Number(groupId);
  if (!Number.isFinite(normalizedGroupId) || normalizedGroupId <= 0) return null;
  return db.prepare("SELECT * FROM groups WHERE id = ?").get(normalizedGroupId);
}

function getGroupFromRequest(req) {
  const rawId = req?.params?.id;
  if (rawId != null && String(rawId).trim() !== "") {
    const byId = getGroupById(rawId);
    if (byId) return byId;
  }
  return getGlobalGroup();
}

function generateUniqueGroupId() {
  const min = 100000;
  const maxExclusive = 1000000;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const candidate = crypto.randomInt(min, maxExclusive);
    const exists = db
      .prepare("SELECT 1 FROM groups WHERE id = ? LIMIT 1")
      .get(candidate);
    if (!exists) return candidate;
  }
  throw new Error("Failed to generate a unique group id.");
}

function ensureGlobalGroup(ownerId) {
  let global = getGlobalGroup();
  if (global) {
    // Global league should stay public and free to join.
    db.prepare(
      "UPDATE groups SET is_public = 1, join_password_hash = NULL, is_simulated = 0 WHERE id = ?"
    ).run(global.id);
    return db.prepare("SELECT * FROM groups WHERE id = ?").get(global.id);
  }
  if (!ownerId) {
    const firstUser = db
      .prepare(
        "SELECT id FROM users WHERE is_simulated = 0 ORDER BY created_at ASC LIMIT 1"
      )
      .get();
    if (!firstUser) {
      const fallbackUser = db
        .prepare("SELECT id FROM users ORDER BY created_at ASC LIMIT 1")
        .get();
      if (!fallbackUser) {
        const systemEmail = "system-global-owner@crashalong.local";
        let systemUser = db
          .prepare("SELECT id FROM users WHERE email = ? LIMIT 1")
          .get(systemEmail);
        if (!systemUser) {
          const createdAt = new Date().toISOString();
          const passwordHash = bcrypt.hashSync(
            crypto.randomBytes(16).toString("hex"),
            10
          );
          const info = db
            .prepare(
              "INSERT INTO users (name, email, password_hash, created_at, is_verified, verified_at, is_admin, is_simulated) VALUES (?, ?, ?, ?, 1, ?, 0, 0)"
            )
            .run("System", systemEmail, passwordHash, createdAt, createdAt);
          systemUser = { id: info.lastInsertRowid };
        }
        ownerId = systemUser.id;
      } else {
        ownerId = fallbackUser.id;
      }
    } else {
      ownerId = firstUser.id;
    }
  }
  const now = new Date().toISOString();
  const groupId = generateUniqueGroupId();
  db
    .prepare(
      "INSERT INTO groups (id, name, owner_id, created_at, is_global, is_public, join_password_hash, is_simulated) VALUES (?, ?, ?, ?, 1, 1, NULL, 0)"
    )
    .run(groupId, "Global", ownerId, now);
  global = db.prepare("SELECT * FROM groups WHERE id = ?").get(groupId);
  return global;
}

function ensureUserInGlobalGroup(userId) {
  const normalizedUserId = Number(userId || 0);
  if (!normalizedUserId) return null;
  const global = ensureGlobalGroup(normalizedUserId);
  if (!global) return null;
  const now = new Date().toISOString();
  if (normalizedUserId === global.owner_id) {
    db.prepare(
      "UPDATE group_members SET role = 'owner' WHERE group_id = ? AND user_id = ?"
    ).run(global.id, normalizedUserId);
    db.prepare(
      "INSERT OR IGNORE INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, 'owner', ?)"
    ).run(normalizedUserId, global.id, now);
    return global;
  }
  db.prepare(
    "INSERT OR IGNORE INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, 'member', ?)"
  ).run(normalizedUserId, global.id, now);
  return global;
}

function ensureGlobalMemberships() {
  const global = ensureGlobalGroup();
  if (!global) return;
  const now = new Date().toISOString();
  const users = db
    .prepare("SELECT id FROM users WHERE is_simulated = 0")
    .all();
  const addMember = db.prepare(
    "INSERT OR IGNORE INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, 'member', ?)"
  );
  const removeSimulatedMembers = db.prepare(
    `
    DELETE FROM group_members
    WHERE group_id = ?
      AND user_id IN (SELECT id FROM users WHERE is_simulated = 1)
    `
  );
  const tx = db.transaction(() => {
    removeSimulatedMembers.run(global.id);
    db.prepare(
      "UPDATE group_members SET role = 'owner' WHERE group_id = ? AND user_id = ?"
    ).run(global.id, global.owner_id);
    db.prepare(
      "INSERT OR IGNORE INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, 'owner', ?)"
    ).run(global.owner_id, global.id, now);
    for (const row of users) {
      if (row.id === global.owner_id) continue;
      addMember.run(row.id, global.id, now);
    }
  });
  tx();
}

ensureGlobalMemberships();

function backfillGroupSimulationFlags() {
  db.exec(`
    UPDATE groups
    SET is_simulated = 1
    WHERE is_global = 0
      AND EXISTS (
        SELECT 1
        FROM group_members gm
        JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = groups.id
          AND u.is_simulated = 1
      );

    UPDATE groups
    SET is_simulated = 0
    WHERE is_global = 1;
  `);
}

backfillGroupSimulationFlags();

const duplicateGroups = db
  .prepare(
    `
    SELECT name, COUNT(*) as count
    FROM groups
    GROUP BY name
    HAVING COUNT(*) > 1
    `
  )
  .all();

if (duplicateGroups.length === 0) {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_name_unique ON groups(name);`);
} else {
  console.warn(
    "Cannot enforce unique group names until duplicates are resolved:",
    duplicateGroups.map((row) => row.name).join(", ")
  );
}

const duplicateNames = db
  .prepare(
    `
    SELECT name, COUNT(*) as count
    FROM users
    GROUP BY name
    HAVING COUNT(*) > 1
    `
  )
  .all();

if (duplicateNames.length === 0) {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name_unique ON users(name);`);
} else {
  console.warn(
    "Cannot enforce unique usernames until duplicates are resolved:",
    duplicateNames.map((row) => row.name).join(", ")
  );
}

function ensureDevAdminUser() {
  const normalizedEmail = String(DEV_AUTO_LOGIN_EMAIL || "dev@example.com")
    .trim()
    .toLowerCase();
  const normalizedName = String(DEV_AUTO_LOGIN_NAME || "Dev Admin").trim() || "Dev Admin";
  const now = new Date().toISOString();
  let user = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);
  if (!user) {
    const passwordHash = bcrypt.hashSync(
      crypto.randomBytes(12).toString("hex"),
      10
    );
    const info = db
      .prepare(
        "INSERT INTO users (name, email, password_hash, created_at, is_verified, verified_at, is_admin, is_simulated) VALUES (?, ?, ?, ?, 1, ?, 1, 0)"
      )
      .run(normalizedName, normalizedEmail, passwordHash, now, now);
    user = { id: info.lastInsertRowid };
  } else {
    db.prepare(
      "UPDATE users SET name = ?, is_admin = 1, is_verified = 1, verified_at = COALESCE(verified_at, ?), is_simulated = 0 WHERE id = ?"
    ).run(normalizedName, now, user.id);
  }
  ensureUserInGlobalGroup(user.id);
  return Number(user.id);
}

function createVerifiedDevMemberUser() {
  const suffix = `${Date.now().toString(36)}${crypto.randomBytes(2).toString("hex")}`;
  const name = `Dev Member ${suffix}`;
  const email = `dev-member-${suffix}@example.local`;
  const now = new Date().toISOString();
  const passwordHash = bcrypt.hashSync(
    crypto.randomBytes(12).toString("hex"),
    10
  );
  const info = db
    .prepare(
      "INSERT INTO users (name, email, password_hash, created_at, is_verified, verified_at, is_admin, is_simulated) VALUES (?, ?, ?, ?, 1, ?, 0, 0)"
    )
    .run(name, email, passwordHash, now, now);
  ensureUserInGlobalGroup(info.lastInsertRowid);
  return Number(info.lastInsertRowid);
}

function createDevNamedGuestSession(req) {
  const ownerId = ensureDevAdminUser();
  const now = new Date().toISOString();
  const suffix = `${Date.now().toString(36)}${crypto.randomBytes(2).toString("hex")}`;
  const groupName = `Dev Guest Group ${suffix}`;
  const guestDisplayName = `Dev Guest ${suffix}`;
  const rulesText =
    "Development-only named guest sandbox. Auto-created from header dev switch.";
  const groupId = generateUniqueGroupId();

  db.prepare(
    `
    INSERT INTO groups (
      id, name, owner_id, created_at, is_public, join_code, join_password_hash, rules_text, is_global, is_simulated, invite_link_open
    )
    VALUES (?, ?, ?, ?, 1, NULL, NULL, ?, 0, 0, 1)
    `
  ).run(groupId, groupName, ownerId, now, rulesText);
  db.prepare(
    "INSERT OR IGNORE INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, 'owner', ?)"
  ).run(ownerId, groupId, now);

  const invite = createInviteForGroup(groupId, ownerId);
  if (!invite || !invite.code) {
    throw new Error("Failed to create development invite link.");
  }

  req.session.userId = null;
  req.session.devIdentityMode = "named_guest";
  req.session.devAutoLoginSkipOnce = false;
  req.session.guestId = crypto.randomBytes(12).toString("hex");
  req.session.namedGuestAccess = null;
  setNamedGuestAccess(req, {
    inviteCode: String(invite.code),
    groupId: Number(groupId),
    displayName: guestDisplayName
  });

  return {
    code: String(invite.code)
  };
}

function sanitizeRedirectPath(rawValue) {
  const redirectToRaw = String(rawValue || "/").trim();
  if (redirectToRaw.startsWith("/")) {
    return redirectToRaw;
  }
  try {
    const parsed = new URL(redirectToRaw);
    return `${parsed.pathname || "/"}${parsed.search || ""}`;
  } catch (err) {
    return "/";
  }
}

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    store: new SQLiteStore({ db: "sessions.db", dir: DATA_DIR }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

app.use((req, res, next) => {
  const savedLocale = req.session?.locale;
  let locale = SUPPORTED_LOCALES.includes(savedLocale)
    ? savedLocale
    : detectLocaleFromAcceptLanguage(req.get("accept-language"));
  if (!SUPPORTED_LOCALES.includes(locale)) {
    locale = DEFAULT_LOCALE;
  }
  if (req.session && !SUPPORTED_LOCALES.includes(savedLocale)) {
    req.session.locale = locale;
  }
  res.locals.locale = locale;
  res.locals.currentPath = req.originalUrl || "/";
  res.locals.supportedLocales = SUPPORTED_LOCALES.map((code) => ({
    code,
    label: LOCALE_LABELS[code] || code
  }));
  res.locals.t = (key, params = {}) => translate(locale, key, params);
  res.locals.paypalDonationUrl = PAYPAL_DONATION_URL;
  res.locals.paypalDonationLabel = PAYPAL_DONATION_LABEL;
  res.locals.contactEmail = CONTACT_EMAIL;
  res.locals.baseUrl = BASE_URL;
  res.locals.companyName = COMPANY_NAME;
  res.locals.closeAt = PREDICTIONS_CLOSE_AT;
  res.locals.isDevelopment = IS_DEVELOPMENT;
  res.locals.devIdentityMode = String(req.session?.devIdentityMode || "")
    .trim()
    .toLowerCase();
  res.locals.formatAdminDateTime = formatAdminDateTime;
  res.locals.groupPath = (group, suffix = "") => {
    const base = getGroupBasePath(group);
    const tail = String(suffix || "");
    if (!tail) return base;
    return tail.startsWith("/") ? `${base}${tail}` : `${base}/${tail}`;
  };
  next();
});

app.post("/language", (req, res) => {
  const locale = String(req.body.locale || "").trim().toLowerCase();
  if (SUPPORTED_LOCALES.includes(locale)) {
    req.session.locale = locale;
  }
  const redirectTo = sanitizeRedirectPath(req.body.redirectTo || req.get("referer") || "/");
  return res.redirect(redirectTo);
});

app.post("/dev/switch-user", (req, res) => {
  if (!IS_DEVELOPMENT) {
    return sendError(req, res, 404, "Not found.");
  }
  const mode = String(req.body.mode || "").trim().toLowerCase();
  const redirectTo = sanitizeRedirectPath(req.body.redirectTo || req.get("referer") || "/");
  if (!req.session) {
    return res.redirect(redirectTo);
  }

  if (mode === "visitor") {
    req.session.userId = null;
    req.session.devIdentityMode = "visitor";
    req.session.devAutoLoginSkipOnce = false;
    req.session.guestId = crypto.randomBytes(12).toString("hex");
    req.session.namedGuestAccess = null;
    return req.session.save(() => res.redirect(redirectTo));
  }

  if (mode === "guest") {
    try {
      const namedGuest = createDevNamedGuestSession(req);
      return req.session.save(() =>
        res.redirect(`/join/${encodeURIComponent(namedGuest.code)}/questions`)
      );
    } catch (err) {
      console.error("Failed to create dev named guest session:", err);
      return sendError(req, res, 500, "Failed to create dev named guest session.");
    }
  }

  if (mode === "member") {
    const userId = createVerifiedDevMemberUser();
    req.session.userId = userId;
    req.session.devIdentityMode = "member";
    req.session.guestId = null;
    req.session.namedGuestAccess = null;
    return req.session.save(() => res.redirect(redirectTo));
  }

  const userId = ensureDevAdminUser();
  req.session.userId = userId;
  req.session.devIdentityMode = "admin";
  req.session.guestId = null;
  req.session.namedGuestAccess = null;
  return req.session.save(() => res.redirect(redirectTo));
});

app.use((req, res, next) => {
  if (!IS_DEVELOPMENT || !DEV_AUTO_LOGIN) {
    return next();
  }
  const identityMode = String(req.session?.devIdentityMode || "")
    .trim()
    .toLowerCase();
  if (identityMode === "visitor" || identityMode === "guest" || identityMode === "named_guest") {
    req.session.userId = null;
    return next();
  }
  if (req.session.devAutoLoginDisabled) {
    // Backward-compat: old sessions used a persistent disable flag.
    req.session.devAutoLoginDisabled = false;
    req.session.devAutoLoginSkipOnce = true;
  }
  if (req.session.devAutoLoginSkipOnce) {
    req.session.devAutoLoginSkipOnce = false;
    return req.session.save(() => next());
  }
  if (req.session.userId) {
    return next();
  }
  if (identityMode === "member") {
    req.session.userId = createVerifiedDevMemberUser();
    return req.session.save(() => next());
  }
  req.session.userId = ensureDevAdminUser();
  return req.session.save(() => next());
});

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const clean = raw.replace(/^\uFEFF/, "");
    return JSON.parse(clean);
  } catch (err) {
    console.error(`Failed to read JSON: ${filePath}`, err);
    return null;
  }
}

function getQuestionSettingsMap() {
  const rows = db
    .prepare(
      "SELECT question_id, included, points_override, order_index FROM question_settings"
    )
    .all();
  const map = new Map();
  for (const row of rows) {
    const included = Number(row.included) !== 0;
    const rawOverride =
      row.points_override == null ? "" : String(row.points_override).trim();
    let parsedOverride = null;
    let hasValidOverride = false;
    if (rawOverride) {
      try {
        parsedOverride = JSON.parse(rawOverride);
        hasValidOverride = true;
      } catch (err) {
        console.warn(
          `Ignoring invalid points_override JSON for question ${row.question_id}:`,
          err.message
        );
      }
    }
    const orderIndexRaw = row.order_index;
    const orderIndex =
      orderIndexRaw == null || !Number.isFinite(Number(orderIndexRaw))
        ? null
        : Number(orderIndexRaw);
    map.set(row.question_id, {
      included,
      rawOverride,
      parsedOverride,
      hasValidOverride,
      orderIndex
    });
  }
  return map;
}

function applyQuestionSettings(
  questions,
  settingsMap,
  { includeExcluded = false, includeMeta = false } = {}
) {
  const out = [];
  for (const [sourceIndex, original] of (questions || []).entries()) {
    const setting = settingsMap.get(original.id);
    const included = setting ? setting.included : true;
    if (!includeExcluded && !included) continue;

    const question = { ...original };
    const basePoints = question.points;
    if (setting?.hasValidOverride) {
      question.points = setting.parsedOverride;
      // points_display in questions.json can become stale if points are overridden.
      delete question.points_display;
    }

    if (includeMeta) {
      question._included = included;
      question._basePoints = basePoints;
      question._effectivePoints = question.points;
      question._pointsOverrideRaw = setting?.rawOverride || "";
      question._hasValidPointsOverride = Boolean(setting?.hasValidOverride);
      question._orderIndex =
        setting && Number.isFinite(Number(setting.orderIndex))
          ? Number(setting.orderIndex)
          : sourceIndex;
    }

    question._sourceIndex = sourceIndex;
    question._sortOrderIndex =
      setting && Number.isFinite(Number(setting.orderIndex))
        ? Number(setting.orderIndex)
        : sourceIndex;
    out.push(question);
  }
  out.sort((a, b) => {
    if (a._sortOrderIndex !== b._sortOrderIndex) {
      return a._sortOrderIndex - b._sortOrderIndex;
    }
    return a._sourceIndex - b._sourceIndex;
  });
  for (const question of out) {
    delete question._sortOrderIndex;
    delete question._sourceIndex;
  }
  return out;
}

function getQuestions(locale = DEFAULT_LOCALE, options = {}) {
  let resolvedLocale = locale;
  let resolvedOptions = options;
  if (resolvedLocale && typeof resolvedLocale === "object") {
    resolvedOptions = resolvedLocale;
    resolvedLocale = DEFAULT_LOCALE;
  }
  resolvedLocale = SUPPORTED_LOCALES.includes(resolvedLocale)
    ? resolvedLocale
    : DEFAULT_LOCALE;

  const includeExcluded = Boolean(resolvedOptions?.includeExcluded);
  const includeMeta = Boolean(resolvedOptions?.includeMeta);

  if (!fs.existsSync(QUESTIONS_PATH)) {
    const fallback = [
      {
        id: "championship_top_3",
        prompt: "Pick your Top 3 for the Drivers' Championship",
        type: "text",
        helper: "Example: Verstappen, Norris, Leclerc"
      },
      {
        id: "team_head_to_head",
        prompt: "Who scores more points: Team A vs Team B?",
        type: "text",
        helper: "Example: Ferrari"
      }
    ];
    const settings = getQuestionSettingsMap();
    const adjustedFallback = applyQuestionSettings(fallback, settings, {
      includeExcluded,
      includeMeta
    });
    return attachLastSeasonReferences(
      localizeQuestions(adjustedFallback, resolvedLocale)
    );
  }

  const parsed = readJsonFile(QUESTIONS_PATH);
  let questions = [];
  if (Array.isArray(parsed)) {
    questions = parsed;
  } else if (parsed && Array.isArray(parsed.questions)) {
    questions = parsed.questions;
  }

  const settings = getQuestionSettingsMap();
  const adjustedQuestions = applyQuestionSettings(questions, settings, {
    includeExcluded,
    includeMeta
  });
  return attachLastSeasonReferences(
    localizeQuestions(adjustedQuestions, resolvedLocale)
  );
}

function localizeQuestions(questions, locale = DEFAULT_LOCALE) {
  const dict = loadLocale(locale);
  const promptMap = dict?.question_prompts || {};
  return (questions || []).map((question) => {
    const localized = { ...question };
    const translation = promptMap[question.id] || {};
    if (typeof translation.prompt === "string" && translation.prompt.trim()) {
      localized.prompt = translation.prompt;
    }
    if (typeof translation.helper === "string") {
      localized.helper = translation.helper;
    }
    if (
      typeof translation.points_display === "string" &&
      translation.points_display.trim()
    ) {
      localized.points_display = translation.points_display;
    }
    if (translation.option_labels && typeof translation.option_labels === "object") {
      localized.option_labels = translation.option_labels;
    }
    return localized;
  });
}

function getLastSeasonReferences() {
  const candidates = [
    LAST_SEASON_RESULTS_PATH,
    path.join(path.dirname(QUESTIONS_PATH), "last-season-results.json"),
    path.join(__dirname, "data", "last-season-results.json")
  ];

  for (const filePath of candidates) {
    if (!filePath || !fs.existsSync(filePath)) continue;
    const parsed = readJsonFile(filePath);
    if (!parsed || typeof parsed !== "object") continue;
    const map = parsed.questions;
    if (!map || typeof map !== "object" || Array.isArray(map)) continue;
    return map;
  }

  return {};
}

function attachLastSeasonReferences(questions) {
  const refs = getLastSeasonReferences();
  return (questions || []).map((question) => ({
    ...question,
    last_season: refs[question.id] || null
  }));
}

function getRoster() {
  if (!fs.existsSync(ROSTER_PATH)) {
    return { drivers: [], teams: [] };
  }
  const parsed = readJsonFile(ROSTER_PATH);
  if (!parsed) return { drivers: [], teams: [] };
  return {
    drivers: Array.isArray(parsed.drivers) ? parsed.drivers : [],
    teams: Array.isArray(parsed.teams) ? parsed.teams : []
  };
}

function getRaces() {
  if (!fs.existsSync(RACES_PATH)) {
    return [];
  }
  const parsed = readJsonFile(RACES_PATH);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed && Array.isArray(parsed.races)) {
    return parsed.races;
  }
  return [];
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  next();
}

function getCurrentUser(req) {
  if (!req.session.userId) return null;
  const stmt = db.prepare("SELECT id, name, email, is_admin FROM users WHERE id = ?");
  return stmt.get(req.session.userId) || null;
}

function sendError(req, res, statusCode, message) {
  const preferredType = req.accepts(["html", "json", "text"]);
  if (preferredType === "html") {
    return res.status(statusCode).render("error", {
      title: `${statusCode} Error`,
      user: getCurrentUser(req),
      statusCode,
      message
    });
  }
  return res.status(statusCode).send(message);
}

function isAdmin(req) {
  const user = getCurrentUser(req);
  return !!(user && user.is_admin === 1);
}

function requireAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  if (!isAdmin(req)) {
    return sendError(req, res, 403, "Admin access only.");
  }
  next();
}

function isMember(userId, groupId) {
  const stmt = db.prepare(
    "SELECT 1 FROM group_members WHERE user_id = ? AND group_id = ?"
  );
  return !!stmt.get(userId, groupId);
}

function getPrivilegedGroupCount(userId) {
  const row = db
    .prepare(
      "SELECT COUNT(*) as count FROM group_members WHERE user_id = ? AND role IN ('owner', 'admin')"
    )
    .get(userId);
  return Number(row?.count || 0);
}

function isGlobalAdminUser(userId) {
  const row = db.prepare("SELECT is_admin FROM users WHERE id = ?").get(userId);
  return !!(row && row.is_admin === 1);
}

function canTakePrivilegedRole(userId, currentRole) {
  if (isGlobalAdminUser(userId)) return true;
  // Existing owner/admin in this same group can switch between privileged roles.
  if (currentRole === "owner" || currentRole === "admin") return true;
  return getPrivilegedGroupCount(userId) < MAX_PRIVILEGED_GROUPS;
}

function getResponsesByGroup(userId, groupId) {
  return db
    .prepare(
      "SELECT question_id, answer FROM responses WHERE user_id = ? AND group_id = ?"
    )
    .all(userId, groupId)
    .reduce((acc, row) => {
      acc[row.question_id] = row.answer;
      return acc;
    }, {});
}

function getGuestIdFromSession(req, { create = false } = {}) {
  const existing = String(req?.session?.guestId || "").trim();
  if (existing) return existing;
  if (!create || !req?.session) return "";
  const guestId = crypto.randomBytes(12).toString("hex");
  req.session.guestId = guestId;
  return guestId;
}

function normalizeDisplayName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getNamedGuestAccessFromSession(req) {
  const raw = req?.session?.namedGuestAccess;
  if (!raw || typeof raw !== "object") return null;
  const inviteCode = String(raw.inviteCode || "").trim();
  const groupId = Number(raw.groupId || 0);
  const displayName = String(raw.displayName || "").trim();
  if (!inviteCode || !groupId || !displayName) return null;
  return {
    inviteCode,
    groupId,
    displayName
  };
}

function hasNamedGuestAccess(req, inviteCode, groupId) {
  const access = getNamedGuestAccessFromSession(req);
  if (!access) return false;
  const normalizedInviteCode = String(inviteCode || "").trim();
  const normalizedGroupId = Number(groupId || 0);
  if (
    String(access.inviteCode || "") !== normalizedInviteCode
    || Number(access.groupId || 0) !== normalizedGroupId
  ) {
    return false;
  }
  const guestId = String(req?.session?.guestId || "").trim();
  if (!guestId) return false;
  const member = db
    .prepare(
      `
      SELECT 1
      FROM named_guest_group_members
      WHERE group_id = ?
        AND guest_id = ?
      LIMIT 1
      `
    )
    .get(normalizedGroupId, guestId);
  return !!member;
}

function upsertNamedGuestProfile(guestId, displayName, groupId) {
  const normalizedGuestId = String(guestId || "").trim();
  const normalizedDisplayName = normalizeDisplayName(displayName);
  const normalizedGroupId = Number(groupId || 0);
  if (!normalizedGuestId || !normalizedDisplayName || !normalizedGroupId) {
    return;
  }
  const now = new Date().toISOString();
  db.prepare(
    `
    INSERT INTO named_guest_profiles (guest_id, display_name, source_group_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(guest_id)
    DO UPDATE SET
      display_name = excluded.display_name,
      source_group_id = excluded.source_group_id,
      updated_at = excluded.updated_at
    `
  ).run(normalizedGuestId, normalizedDisplayName, normalizedGroupId, now, now);
}

function upsertNamedGuestGroupMember(guestId, groupId, displayName) {
  const normalizedGuestId = String(guestId || "").trim();
  const normalizedGroupId = Number(groupId || 0);
  const normalizedDisplayName = normalizeDisplayName(displayName);
  if (!normalizedGuestId || !normalizedGroupId || !normalizedDisplayName) {
    return;
  }
  const now = new Date().toISOString();
  db.prepare(
    `
    INSERT INTO named_guest_group_members (group_id, guest_id, display_name, joined_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(group_id, guest_id)
    DO UPDATE SET
      display_name = excluded.display_name,
      updated_at = excluded.updated_at
    `
  ).run(normalizedGroupId, normalizedGuestId, normalizedDisplayName, now, now);
}

function isDisplayNameTakenInGroup(groupId, displayName, { excludeGuestId = "" } = {}) {
  const normalizedGroupId = Number(groupId || 0);
  const normalizedDisplayName = normalizeDisplayName(displayName);
  const normalizedExcludeGuestId = String(excludeGuestId || "").trim();
  if (!normalizedGroupId || !normalizedDisplayName) return false;

  const userConflict = db
    .prepare(
      `
      SELECT 1
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ?
        AND u.name = ? COLLATE NOCASE
      LIMIT 1
      `
    )
    .get(normalizedGroupId, normalizedDisplayName);
  if (userConflict) return true;

  const namedGuestConflict = db
    .prepare(
      `
      SELECT 1
      FROM named_guest_group_members ngm
      WHERE ngm.group_id = ?
        AND ngm.display_name = ? COLLATE NOCASE
        AND (? = '' OR ngm.guest_id <> ?)
      LIMIT 1
      `
    )
    .get(
      normalizedGroupId,
      normalizedDisplayName,
      normalizedExcludeGuestId,
      normalizedExcludeGuestId
    );
  return !!namedGuestConflict;
}

function setNamedGuestAccess(req, { inviteCode, groupId, displayName }) {
  if (!req?.session) return null;
  const normalizedInviteCode = String(inviteCode || "").trim();
  const normalizedGroupId = Number(groupId || 0);
  const normalizedDisplayName = normalizeDisplayName(displayName);
  if (!normalizedInviteCode || !normalizedGroupId || !normalizedDisplayName) {
    return null;
  }
  const guestId = getGuestIdFromSession(req, { create: true });
  upsertNamedGuestProfile(guestId, normalizedDisplayName, normalizedGroupId);
  upsertNamedGuestGroupMember(guestId, normalizedGroupId, normalizedDisplayName);
  req.session.namedGuestAccess = {
    inviteCode: normalizedInviteCode,
    groupId: normalizedGroupId,
    displayName: normalizedDisplayName,
    grantedAt: new Date().toISOString()
  };
  return req.session.namedGuestAccess;
}

function resumeNamedGuestAccess(req, { inviteCode, groupId, displayName, guestId }) {
  if (!req?.session) return null;
  const normalizedInviteCode = String(inviteCode || "").trim();
  const normalizedGroupId = Number(groupId || 0);
  const normalizedDisplayName = normalizeDisplayName(displayName);
  const normalizedGuestId = String(guestId || "").trim();
  if (
    !normalizedInviteCode
    || !normalizedGroupId
    || !normalizedDisplayName
    || !normalizedGuestId
  ) {
    return null;
  }
  req.session.guestId = normalizedGuestId;
  req.session.namedGuestAccess = {
    inviteCode: normalizedInviteCode,
    groupId: normalizedGroupId,
    displayName: normalizedDisplayName,
    grantedAt: new Date().toISOString()
  };
  return req.session.namedGuestAccess;
}

function getGuestResponsesByGroup(guestId, groupId) {
  const normalizedGuestId = String(guestId || "").trim();
  const normalizedGroupId = Number(groupId || 0);
  if (!normalizedGuestId || !normalizedGroupId) return {};
  return db
    .prepare(
      "SELECT question_id, answer FROM guest_responses WHERE guest_id = ? AND group_id = ?"
    )
    .all(normalizedGuestId, normalizedGroupId)
    .reduce((acc, row) => {
      acc[row.question_id] = row.answer;
      return acc;
    }, {});
}

function getFocusedMemberResponses(groupId, { focusUserId, focusGuestId, excludeHiddenAdmins = false } = {}) {
  const normalizedGroupId = Number(groupId || 0);
  if (!normalizedGroupId) return null;

  const normalizedFocusGuestId = String(focusGuestId || "").trim();
  if (normalizedFocusGuestId) {
    if (!/^[A-Za-z0-9_-]{4,128}$/.test(normalizedFocusGuestId)) return null;
    const namedGuest = db
      .prepare(
        `
        SELECT guest_id, display_name
        FROM named_guest_group_members
        WHERE group_id = ?
          AND guest_id = ?
        LIMIT 1
        `
      )
      .get(normalizedGroupId, normalizedFocusGuestId);
    if (!namedGuest) return null;

    const rows = db
      .prepare(
        `
        SELECT question_id, answer, updated_at
        FROM guest_responses
        WHERE group_id = ?
          AND guest_id = ?
        ORDER BY updated_at DESC, question_id ASC
        `
      )
      .all(normalizedGroupId, normalizedFocusGuestId);
    return {
      member: {
        type: "named_guest",
        role: "guest",
        name: String(namedGuest.display_name || "").trim(),
        guest_id: normalizedFocusGuestId
      },
      responses: rows
    };
  }

  const normalizedFocusUserId = Number(focusUserId || 0);
  if (!normalizedFocusUserId) return null;
  const member = db
    .prepare(
      `
      SELECT u.id, u.name, gm.role
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ?
        AND gm.user_id = ?
        ${excludeHiddenAdmins ? "AND COALESCE(u.hide_from_global, 0) = 0" : ""}
      LIMIT 1
      `
    )
    .get(normalizedGroupId, normalizedFocusUserId);
  if (!member) return null;

  const rows = db
    .prepare(
      `
      SELECT question_id, answer, updated_at
      FROM responses
      WHERE group_id = ?
        AND user_id = ?
      ORDER BY updated_at DESC, question_id ASC
      `
    )
    .all(normalizedGroupId, normalizedFocusUserId);
  return {
    member: {
      type: "user",
      role: String(member.role || "member"),
      name: String(member.name || "").trim(),
      user_id: normalizedFocusUserId
    },
    responses: rows
  };
}

function getResponsesForGroup(groupId, { includeNamedGuests = true, excludeHiddenAdmins = false } = {}) {
  const normalizedGroupId = Number(groupId || 0);
  if (!normalizedGroupId) return [];
  if (!includeNamedGuests) {
    return db
      .prepare(
        `
        SELECT r.user_id, u.name as user_name, r.question_id, r.answer, r.updated_at
        FROM responses r
        JOIN users u ON u.id = r.user_id
        WHERE r.group_id = ?
          ${excludeHiddenAdmins ? "AND COALESCE(u.hide_from_global, 0) = 0" : ""}
        ORDER BY u.name ASC, r.question_id ASC
        `
      )
      .all(normalizedGroupId);
  }
  return db
    .prepare(
      `
      SELECT user_id, user_name, question_id, answer, updated_at
      FROM (
        SELECT
          r.user_id AS user_id,
          u.name AS user_name,
          r.question_id AS question_id,
          r.answer AS answer,
          r.updated_at AS updated_at
        FROM responses r
        JOIN users u ON u.id = r.user_id
        WHERE r.group_id = ?
          ${excludeHiddenAdmins ? "AND COALESCE(u.hide_from_global, 0) = 0" : ""}

        UNION ALL

        SELECT
          NULL AS user_id,
          ngm.display_name AS user_name,
          gr.question_id AS question_id,
          gr.answer AS answer,
          gr.updated_at AS updated_at
        FROM guest_responses gr
        JOIN named_guest_group_members ngm
          ON ngm.group_id = gr.group_id
         AND ngm.guest_id = gr.guest_id
        WHERE gr.group_id = ?
      ) all_group_responses
      ORDER BY user_name ASC, question_id ASC
      `
    )
    .all(normalizedGroupId, normalizedGroupId);
}

function claimGuestResponsesForUser(req, userId, options = {}) {
  const sessionGuestId = getGuestIdFromSession(req, { create: false });
  const fallbackGuestId = String(options?.fallbackGuestId || "").trim();
  const guestId = sessionGuestId || fallbackGuestId;
  const normalizedUserId = Number(userId || 0);
  if (!guestId || !normalizedUserId) return;
  const globalGroup = ensureGlobalGroup(normalizedUserId);
  const rows = db
    .prepare(
      "SELECT group_id, question_id, answer FROM guest_responses WHERE guest_id = ?"
    )
    .all(guestId);
  if (rows.length === 0) {
    db.prepare("DELETE FROM named_guest_group_members WHERE guest_id = ?").run(guestId);
    if (req?.session) {
      req.session.guestId = null;
      req.session.namedGuestAccess = null;
    }
    return;
  }

  const grouped = new Map();
  for (const row of rows) {
    const groupId = Number(row.group_id || 0);
    if (!groupId) continue;
    if (!grouped.has(groupId)) grouped.set(groupId, []);
    grouped.get(groupId).push(row);
  }

  const globalGroupId = Number(globalGroup?.id || 0);
  if (globalGroupId && !grouped.has(globalGroupId)) {
    const sourceGroupEntry = Array.from(grouped.entries()).find(
      ([groupId, groupRows]) => Number(groupId) !== globalGroupId && Array.isArray(groupRows) && groupRows.length > 0
    );
    if (sourceGroupEntry) {
      const [, sourceRows] = sourceGroupEntry;
      grouped.set(
        globalGroupId,
        sourceRows.map((row) => ({
          ...row,
          group_id: globalGroupId
        }))
      );
    }
  }

  if (grouped.size === 0) return;

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    const upsert = db.prepare(
      `
      INSERT INTO responses (user_id, group_id, question_id, answer, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, group_id, question_id)
      DO UPDATE SET answer = excluded.answer, updated_at = excluded.updated_at
      `
    );
    const addMember = db.prepare(
      "INSERT OR IGNORE INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, 'member', ?)"
    );
    for (const [groupId, groupRows] of grouped.entries()) {
      const group = getGroupById(groupId);
      if (!group) continue;
      addMember.run(normalizedUserId, groupId, now);
      for (const row of groupRows) {
        upsert.run(
          normalizedUserId,
          groupId,
          row.question_id,
          row.answer,
          now,
          now
        );
      }
    }
    db.prepare("DELETE FROM guest_responses WHERE guest_id = ?").run(guestId);
    db.prepare("DELETE FROM named_guest_group_members WHERE guest_id = ?").run(guestId);
  });
  tx();
  if (req?.session && sessionGuestId) {
    req.session.guestId = null;
    req.session.namedGuestAccess = null;
  }
}

function isCoupledToGlobal(userId, groupId) {
  const row = db
    .prepare(
      "SELECT coupled_to_global FROM group_members WHERE user_id = ? AND group_id = ?"
    )
    .get(userId, groupId);
  if (!row) return true;
  return Number(row.coupled_to_global ?? 1) === 1;
}

function setCoupledToGlobal(userId, groupId, enabled) {
  db.prepare(
    "UPDATE group_members SET coupled_to_global = ? WHERE user_id = ? AND group_id = ?"
  ).run(enabled ? 1 : 0, userId, groupId);
}

function syncResponsesFromSourceGroup(userId, sourceGroupId, targetGroupId, now) {
  if (Number(sourceGroupId) === Number(targetGroupId)) return;
  const sourceRows = db
    .prepare(
      "SELECT question_id, answer FROM responses WHERE user_id = ? AND group_id = ?"
    )
    .all(userId, sourceGroupId);
  const timestamp = now || new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM responses WHERE user_id = ? AND group_id = ?").run(
      userId,
      targetGroupId
    );
    if (sourceRows.length === 0) return;
    const upsert = db.prepare(
      `
      INSERT INTO responses (user_id, group_id, question_id, answer, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, group_id, question_id)
      DO UPDATE SET answer = excluded.answer, updated_at = excluded.updated_at
      `
    );
    for (const row of sourceRows) {
      upsert.run(
        userId,
        targetGroupId,
        row.question_id,
        row.answer,
        timestamp,
        timestamp
      );
    }
  });
  tx();
}

function syncGlobalResponsesToCoupledGroups(userId, now) {
  const globalGroup = getGlobalGroup();
  if (!globalGroup) return;
  const targets = db
    .prepare(
      `
      SELECT gm.group_id
      FROM group_members gm
      JOIN groups g ON g.id = gm.group_id
      WHERE gm.user_id = ?
      AND g.is_global = 0
      AND gm.coupled_to_global = 1
      `
    )
    .all(userId);
  for (const target of targets) {
    syncResponsesFromSourceGroup(userId, globalGroup.id, target.group_id, now);
  }
}

function syncFromGlobalIfCoupled(userId, groupId, now) {
  const group = db.prepare("SELECT id, is_global FROM groups WHERE id = ?").get(groupId);
  if (!group || Number(group.is_global) === 1) return;
  if (!isCoupledToGlobal(userId, groupId)) return;
  const globalGroup = getGlobalGroup();
  if (!globalGroup || Number(globalGroup.id) === Number(groupId)) return;
  syncResponsesFromSourceGroup(userId, globalGroup.id, groupId, now);
}

function getCopySourceGroups(userId, currentGroupId) {
  return db
    .prepare(
      `
      SELECT g.id, g.name, g.is_global
      FROM groups g
      JOIN group_members gm ON gm.group_id = g.id
      WHERE gm.user_id = ? AND g.id <> ?
      ORDER BY g.is_global DESC, g.name ASC
      `
    )
    .all(userId, currentGroupId);
}

function getLatestInviteForGroup(groupId) {
  return db
    .prepare(
      "SELECT * FROM invites WHERE group_id = ? ORDER BY created_at DESC LIMIT 1"
    )
    .get(groupId);
}

function createInviteForGroup(groupId, createdByUserId) {
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = crypto.randomBytes(4).toString("hex");
    try {
      db.prepare(
        "INSERT INTO invites (group_id, code, created_at, created_by) VALUES (?, ?, ?, ?)"
      ).run(groupId, code, new Date().toISOString(), createdByUserId);
      return getLatestInviteForGroup(groupId);
    } catch (err) {
      const isUniqueError =
        err && String(err.message || "").toLowerCase().includes("unique");
      if (!isUniqueError) throw err;
    }
  }
  throw new Error("Failed to generate unique invite code");
}

function ensureInviteForGroup(groupId) {
  const group = db
    .prepare("SELECT id, owner_id, is_global FROM groups WHERE id = ?")
    .get(groupId);
  if (!group || Number(group.is_global) === 1) return null;
  const existing = getLatestInviteForGroup(groupId);
  if (existing) return existing;
  return createInviteForGroup(groupId, group.owner_id);
}

function getGroupRulesText(group, locale = DEFAULT_LOCALE) {
  const customRules = String(group?.rules_text || "").trim();
  return customRules || getDefaultGroupRules(locale);
}

function getMailer() {
  if (!SMTP_USER || !SMTP_PASS || !SMTP_HOST) return null;
  const smtpName =
    SMTP_CLIENT_NAME ||
    APP_DOMAIN_HOST ||
    (SMTP_USER.includes("@") ? SMTP_USER.split("@")[1] : "");
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    name: smtpName || undefined,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
}

function generateToken() {
  return crypto.randomBytes(24).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getMemberRole(userId, groupId) {
  const stmt = db.prepare(
    "SELECT role FROM group_members WHERE user_id = ? AND group_id = ?"
  );
  const row = stmt.get(userId, groupId);
  return row ? row.role : null;
}

function isGroupAdmin(userId, groupId) {
  const role = getMemberRole(userId, groupId);
  return role === "owner" || role === "admin";
}

function getNextOwner(groupId, currentOwnerId) {
  const candidates = db
    .prepare(
      `
      SELECT gm.user_id, gm.role
      FROM group_members gm
      WHERE gm.group_id = ? AND gm.user_id <> ?
      ORDER BY CASE gm.role WHEN 'admin' THEN 1 WHEN 'member' THEN 2 ELSE 3 END, gm.joined_at ASC
      `
    )
    .all(groupId, currentOwnerId);

  for (const candidate of candidates) {
    if (canTakePrivilegedRole(candidate.user_id, candidate.role)) {
      return candidate;
    }
  }
  return null;
}

function predictionsClosed() {
  const closeDate = new Date(PREDICTIONS_CLOSE_AT);
  if (Number.isNaN(closeDate.getTime())) return false;
  return new Date() > closeDate;
}

function isLeaderboardAvailable() {
  if (LEADERBOARD_ENABLED) return true;
  return !!db.prepare("SELECT 1 FROM actuals LIMIT 1").get();
}

function clampNumber(value, min, max) {
  if (value == null) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.min(max, Math.max(min, num));
}

function serializeAnswerFromRequest(question, body) {
  const type = question?.type || "text";
  if (type === "ranking") {
    const count = Number(question.count) || 3;
    const selections = [];
    for (let i = 1; i <= count; i += 1) {
      const value = body?.[`${question.id}_${i}`];
      if (!value) continue;
      if (!selections.includes(value)) {
        selections.push(value);
      }
    }
    if (selections.length === 0) return null;
    return JSON.stringify(selections);
  }
  if (type === "multi_select" || type === "multi_select_limited") {
    const selected = body?.[question.id];
    if (!selected) return null;
    const selections = Array.isArray(selected) ? selected : [selected];
    return JSON.stringify(selections);
  }
  if (type === "teammate_battle") {
    const winner = body?.[`${question.id}_winner`];
    const diffRaw = body?.[`${question.id}_diff`];
    if ((!winner || winner === "") && (diffRaw === "" || diffRaw === undefined)) {
      return null;
    }
    const diff = winner === "tie" ? null : clampNumber(diffRaw, 0, 999);
    return JSON.stringify({ winner, diff });
  }
  if (type === "boolean_with_optional_driver") {
    const choice = body?.[question.id];
    const driver = body?.[`${question.id}_driver`];
    if (!choice) return null;
    return JSON.stringify({ choice, driver });
  }
  if (type === "numeric_with_driver") {
    const valueRaw = body?.[`${question.id}_value`];
    const driver = body?.[`${question.id}_driver`];
    if ((valueRaw === "" || valueRaw === undefined) && (!driver || driver === "")) {
      return null;
    }
    const value = clampNumber(valueRaw, 0, 999);
    return JSON.stringify({ value, driver });
  }
  if (type === "single_choice_with_driver") {
    const value = body?.[`${question.id}_value`];
    const driver = body?.[`${question.id}_driver`];
    if ((!value || value === "") && (!driver || driver === "")) {
      return null;
    }
    return JSON.stringify({ value, driver });
  }
  const answer = body?.[question.id];
  if (answer === undefined || answer === "") return null;
  if (type === "numeric") {
    const value = clampNumber(answer, 0, 999);
    if (value == null) return null;
    return String(value);
  }
  return String(answer).trim();
}

registerAuthRoutes(app, {
  db,
  bcrypt,
  ADMIN_EMAILS,
  ensureUserInGlobalGroup,
  generateToken,
  hashToken,
  BASE_URL,
  getMailer,
  SMTP_USER,
  SMTP_FROM,
  COMPANY_NAME,
  getCurrentUser,
  sendError,
  requireAuth,
  DEV_AUTO_LOGIN,
  NODE_ENV: process.env.NODE_ENV || "development",
  claimGuestResponsesForUser,
  predictionsClosed
});

app.get("/api/groups/check-name", requireAuth, (req, res) => {
  const normalizedName = String(req.query.name || "").trim();
  if (!normalizedName) {
    return res.json({ available: false, reason: "empty" });
  }
  const exists = db
    .prepare("SELECT id FROM groups WHERE name = ?")
    .get(normalizedName);
  return res.json({ available: !exists });
});

app.post("/groups", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const { name, joinPassword, visibility } = req.body;
  const isPublic = visibility === "public";
  if (!name || (!isPublic && !joinPassword)) {
    const groups = db
      .prepare(
        `
        SELECT g.id, g.name, g.owner_id, g.is_global, gm.role
        FROM groups g
        JOIN group_members gm ON gm.group_id = g.id
        WHERE gm.user_id = ?
        ORDER BY g.created_at DESC
      `
    )
    .all(user.id);
    const publicGroups = db
      .prepare(
        `
        SELECT g.id, g.name, u.name as owner_name, g.created_at, g.is_global
        FROM groups g
        JOIN users u ON u.id = g.owner_id
        WHERE g.is_public = 1
        AND g.id NOT IN (SELECT group_id FROM group_members WHERE user_id = ?)
        ORDER BY g.created_at DESC
        `
      )
      .all(user.id);
    return res.render("dashboard", {
      user,
      groups,
      publicGroups,
      error: "Group name and password are required.",
      success: null
    });
  }
  if (!(user && user.is_admin === 1)) {
    const privilegedCount = getPrivilegedGroupCount(user.id);
    if (privilegedCount >= MAX_PRIVILEGED_GROUPS) {
      const groups = db
        .prepare(
          `
          SELECT g.id, g.name, g.owner_id, g.is_global, gm.role
          FROM groups g
          JOIN group_members gm ON gm.group_id = g.id
          WHERE gm.user_id = ?
          ORDER BY g.created_at DESC
        `
        )
        .all(user.id);
      const publicGroups = db
        .prepare(
          `
          SELECT g.id, g.name, u.name as owner_name, g.created_at, g.is_global
          FROM groups g
          JOIN users u ON u.id = g.owner_id
          WHERE g.is_public = 1
          AND g.id NOT IN (SELECT group_id FROM group_members WHERE user_id = ?)
          ORDER BY g.created_at DESC
          `
        )
        .all(user.id);
      return res.render("dashboard", {
        user,
        groups,
        publicGroups,
        error: `You can be owner/admin in at most ${MAX_PRIVILEGED_GROUPS} groups.`,
        success: null
      });
    }
  }

  const normalizedName = name.trim();
  const groupExists = db
    .prepare("SELECT id FROM groups WHERE name = ?")
    .get(normalizedName);
  if (groupExists) {
    const groups = db
      .prepare(
        `
        SELECT g.id, g.name, g.owner_id, g.is_global, gm.role
        FROM groups g
        JOIN group_members gm ON gm.group_id = g.id
        WHERE gm.user_id = ?
        ORDER BY g.created_at DESC
      `
    )
    .all(user.id);
    const publicGroups = db
      .prepare(
        `
        SELECT g.id, g.name, u.name as owner_name, g.created_at, g.is_global
        FROM groups g
        JOIN users u ON u.id = g.owner_id
        WHERE g.is_public = 1
        AND g.id NOT IN (SELECT group_id FROM group_members WHERE user_id = ?)
        ORDER BY g.created_at DESC
        `
      )
      .all(user.id);
    return res.render("dashboard", {
      user,
      groups,
      publicGroups,
      error: "Group name already exists.",
      success: null
    });
  }
  const now = new Date().toISOString();
  const joinCode = isPublic ? null : crypto.randomBytes(3).toString("hex").toUpperCase();
  const joinPasswordHash = isPublic ? null : bcrypt.hashSync(joinPassword, 10);
  const groupId = generateUniqueGroupId();
  db
    .prepare(
      "INSERT INTO groups (id, name, owner_id, created_at, join_code, join_password_hash, is_public, is_global) VALUES (?, ?, ?, ?, ?, ?, ?, 0)"
    )
    .run(groupId, normalizedName, user.id, now, joinCode, joinPasswordHash, isPublic ? 1 : 0);
  db.prepare(
    "INSERT INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, ?, ?)"
  ).run(user.id, groupId, "owner", now);
  ensureInviteForGroup(groupId);
  syncFromGlobalIfCoupled(user.id, groupId, now);

  res.redirect(`/groups/${groupId}`);
});

app.post("/groups/:id/join-public", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const groupId = Number(req.params.id);
  const group = db.prepare("SELECT * FROM groups WHERE id = ?").get(groupId);
  if (!group || !group.is_public) {
    return sendError(req, res, 404, "Group not found.");
  }
  if (!isMember(user.id, groupId)) {
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, ?, ?)"
    ).run(user.id, groupId, "member", now);
    syncFromGlobalIfCoupled(user.id, groupId, now);
  }
  res.redirect(getGroupBasePath(group));
});

app.post("/groups/join", requireAuth, async (req, res) => {
  const user = getCurrentUser(req);
  const { code, password } = req.body;
  const groups = db
    .prepare(
      `
      SELECT g.id, g.name, g.owner_id, g.is_global, gm.role
      FROM groups g
      JOIN group_members gm ON gm.group_id = g.id
      WHERE gm.user_id = ?
      ORDER BY g.created_at DESC
      `
    )
    .all(user.id);
  const publicGroups = db
    .prepare(
      `
      SELECT g.id, g.name, u.name as owner_name, g.created_at, g.is_global
      FROM groups g
      JOIN users u ON u.id = g.owner_id
      WHERE g.is_public = 1
      AND g.id NOT IN (SELECT group_id FROM group_members WHERE user_id = ?)
      ORDER BY g.created_at DESC
      `
    )
    .all(user.id);

  if (!code || !password) {
    return res.render("dashboard", {
      user,
      groups,
      publicGroups,
      error: "Group code and password are required.",
      success: null
    });
  }

  const group = db
    .prepare("SELECT * FROM groups WHERE join_code = ?")
    .get(String(code).trim().toUpperCase());

  if (!group || !group.join_password_hash || group.is_public) {
    return res.render("dashboard", {
      user,
      groups,
      publicGroups,
      error: "Invalid group code.",
      success: null
    });
  }

  const ok = await bcrypt.compare(password, group.join_password_hash);
  if (!ok) {
    return res.render("dashboard", {
      user,
      groups,
      publicGroups,
      error: "Incorrect group password.",
      success: null
    });
  }

  if (!isMember(user.id, group.id)) {
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, ?, ?)"
    ).run(user.id, group.id, "member", now);
    syncFromGlobalIfCoupled(user.id, group.id, now);
  }

  return res.redirect(getGroupBasePath(group));
});

function renderGroupPage(req, res, { user, group, groupBasePath, role, canEditRules, isNamedGuest = false, error = null, success = null }) {
  const locale = res.locals.locale || DEFAULT_LOCALE;
  const groupId = Number(group?.id || 0);
  const closed = predictionsClosed();
  const leaderboardAvailable = isLeaderboardAvailable();
  const includeNamedGuests = Number(group?.is_global || 0) !== 1;
  const membersPerPage = 25;
  const requestedMembersPage = Number(req.query.membersPage || 1);
  const currentMembersPage =
    Number.isFinite(requestedMembersPage) && requestedMembersPage > 0
      ? Math.floor(requestedMembersPage)
      : 1;
  const membersTotal = Number(
    includeNamedGuests
      ? (
        db
          .prepare(
            `
            SELECT
              (
                SELECT COUNT(*)
                FROM group_members gm
                WHERE gm.group_id = ?
              ) + (
                SELECT COUNT(*)
                FROM named_guest_group_members ngm
                WHERE ngm.group_id = ?
              ) AS count
            `
          )
          .get(groupId, groupId)?.count || 0
      )
      : (
        db
          .prepare("SELECT COUNT(*) AS count FROM group_members WHERE group_id = ?")
          .get(groupId)?.count || 0
      )
  );
  const totalMembersPages = Math.max(1, Math.ceil(membersTotal / membersPerPage));
  const safeMembersPage = Math.min(currentMembersPage, totalMembersPages);
  const membersOffset = (safeMembersPage - 1) * membersPerPage;
  const members = includeNamedGuests
    ? db
      .prepare(
        `
        SELECT id, guest_id, name, email, role, joined_at, member_type
        FROM (
          SELECT
            u.id AS id,
            NULL AS guest_id,
            u.name AS name,
            u.email AS email,
            gm.role AS role,
            gm.joined_at AS joined_at,
            'user' AS member_type
          FROM group_members gm
          JOIN users u ON u.id = gm.user_id
          WHERE gm.group_id = ?

          UNION ALL

          SELECT
            NULL AS id,
            ngm.guest_id AS guest_id,
            ngm.display_name AS name,
            NULL AS email,
            'guest' AS role,
            ngm.joined_at AS joined_at,
            'named_guest' AS member_type
          FROM named_guest_group_members ngm
          WHERE ngm.group_id = ?
        ) AS combined_members
        ORDER BY joined_at ASC, name COLLATE NOCASE ASC
        LIMIT ? OFFSET ?
        `
      )
      .all(groupId, groupId, membersPerPage, membersOffset)
    : db
      .prepare(
        `
        SELECT u.id, NULL as guest_id, u.name, u.email, gm.role, gm.joined_at, 'user' as member_type
        FROM group_members gm
        JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ?
        ORDER BY gm.joined_at ASC
        LIMIT ? OFFSET ?
        `
      )
      .all(groupId, membersPerPage, membersOffset);
  const invite = ensureInviteForGroup(groupId);
  const groupRules = getGroupRulesText(group, locale);

  return res.render("group", {
    user,
    group,
    members,
    invite,
    role,
    canEditRules,
    groupRules,
    membersPerPage,
    currentMembersPage: safeMembersPage,
    totalMembersPages,
    groupBasePath,
    closed,
    leaderboardAvailable,
    isNamedGuest,
    error,
    success
  });
}

app.get(["/global", "/groups/:id"], requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const group = getGroupFromRequest(req);
  if (!group) {
    return sendError(req, res, 404, "Group not found.");
  }
  const groupId = Number(group.id);
  if (!isMember(user.id, groupId)) {
    return sendError(req, res, 403, "Not a group member.");
  }
  const groupBasePath = getGroupBasePath(group);
  const role = getMemberRole(user.id, groupId);
  const canEditRules = role === "owner" || role === "admin";
  return renderGroupPage(req, res, {
    user,
    group,
    role,
    canEditRules,
    groupBasePath,
    isNamedGuest: false
  });
});

app.post("/groups/:id/invites", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const groupId = Number(req.params.id);
  if (!isGroupAdmin(user.id, groupId)) {
    return sendError(req, res, 403, "Admin access only.");
  }
  ensureInviteForGroup(groupId);
  res.redirect(`/groups/${groupId}`);
});

app.post("/groups/:id/invites/remove", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const groupId = Number(req.params.id);
  if (!isGroupAdmin(user.id, groupId)) {
    return sendError(req, res, 403, "Admin access only.");
  }
  res.redirect(`/groups/${groupId}`);
});

app.post("/groups/:id/invite-link/toggle", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const groupId = Number(req.params.id);
  if (!isGroupAdmin(user.id, groupId)) {
    return sendError(req, res, 403, "Admin access only.");
  }
  const group = db.prepare("SELECT id, is_global FROM groups WHERE id = ?").get(groupId);
  if (!group) {
    return sendError(req, res, 404, "Group not found.");
  }
  if (Number(group.is_global) === 1) {
    return sendError(req, res, 400, "Global group invite link cannot be toggled.");
  }
  const shouldOpen = req.body.open === "1";
  db.prepare("UPDATE groups SET invite_link_open = ? WHERE id = ?").run(
    shouldOpen ? 1 : 0,
    groupId
  );
  if (shouldOpen) {
    ensureInviteForGroup(groupId);
  }
  res.redirect(`/groups/${groupId}`);
});

function renderJoinGuestPage(req, res, { group, code, displayName = "", returnName = "", error = null, activeMode = "new" }) {
  const mode = String(activeMode || "").toLowerCase() === "returning" ? "returning" : "new";
  return res.render("join_guest", {
    user: null,
    group,
    code,
    requirePassword: !group.is_public && !!group.join_password_hash,
    displayName,
    returnName,
    error,
    activeMode: mode,
    createAccountPath: `/signup?redirectTo=${encodeURIComponent(`/join/${code}`)}`
  });
}

function isJoinGuestAjaxRequest(req) {
  return String(req.get("x-join-ajax") || "").trim() === "1";
}

function respondJoinGuestError(req, res, {
  group,
  code,
  displayName = "",
  returnName = "",
  error,
  activeMode = "new",
  status = 400
}) {
  if (isJoinGuestAjaxRequest(req)) {
    return res.status(status).json({
      ok: false,
      error: String(error || "Something went wrong.")
    });
  }
  return renderJoinGuestPage(req, res, {
    group,
    code,
    displayName,
    returnName,
    error,
    activeMode
  });
}

function respondJoinGuestRedirect(req, res, redirectPath) {
  if (isJoinGuestAjaxRequest(req)) {
    return res.json({
      ok: true,
      redirect: redirectPath
    });
  }
  return res.redirect(redirectPath);
}

app.get("/join/:code", (req, res) => {
  const code = req.params.code.trim();
  const user = getCurrentUser(req);
  const invite = db
    .prepare("SELECT * FROM invites WHERE code = ?")
    .get(code);
  if (!invite) {
    return sendError(req, res, 404, "Invite not found.");
  }
  const group = db
    .prepare("SELECT * FROM groups WHERE id = ?")
    .get(invite.group_id);
  if (!group) {
    return sendError(req, res, 404, "Group not found.");
  }
  if (Number(group.invite_link_open ?? 1) !== 1) {
    return sendError(req, res, 403, "Invite link is closed.");
  }
  if (!user) {
    if (hasNamedGuestAccess(req, code, Number(group.id))) {
      return renderGroupPage(req, res, {
        user: null,
        group,
        role: "guest",
        canEditRules: false,
        groupBasePath: `/join/${code}`,
        isNamedGuest: true
      });
    }
    const activeMode = String(req.query.mode || "").toLowerCase() === "returning" ? "returning" : "new";
    return renderJoinGuestPage(req, res, {
      group,
      code,
      activeMode
    });
  }
  if (isMember(user.id, invite.group_id)) {
    return res.redirect(`${getGroupBasePath(group)}/questions`);
  }
  if (!isMember(user.id, invite.group_id)) {
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, ?, ?)"
    ).run(user.id, invite.group_id, "member", now);
    syncFromGlobalIfCoupled(user.id, invite.group_id, now);
  }
  return res.redirect(`${getGroupBasePath(group)}/questions`);
});

app.get("/join/:code/responses", (req, res) => {
  const code = req.params.code.trim();
  const invite = db
    .prepare("SELECT * FROM invites WHERE code = ?")
    .get(code);
  if (!invite) {
    return sendError(req, res, 404, "Invite not found.");
  }
  const group = db
    .prepare("SELECT * FROM groups WHERE id = ?")
    .get(invite.group_id);
  if (!group) {
    return sendError(req, res, 404, "Group not found.");
  }
  if (Number(group.invite_link_open ?? 1) !== 1) {
    return sendError(req, res, 403, "Invite link is closed.");
  }

  const user = getCurrentUser(req);
  if (user) {
    if (!isMember(user.id, invite.group_id)) {
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, ?, ?)"
      ).run(user.id, invite.group_id, "member", now);
      syncFromGlobalIfCoupled(user.id, invite.group_id, now);
    }
    return res.redirect(`${getGroupBasePath(group)}/responses`);
  }

  if (!hasNamedGuestAccess(req, code, Number(group.id))) {
    return res.redirect(`/join/${code}`);
  }

  const locale = res.locals.locale || DEFAULT_LOCALE;
  const guestId = getGuestIdFromSession(req, { create: false });
  const questions = getQuestions(locale);
  const responses = getResponsesForGroup(Number(group.id), { includeNamedGuests: true });
  const viewerGuestAnswers = getGuestResponsesByGroup(guestId, Number(group.id));
  const showMineOnly = req.query.mine === "1";
  const focused = getFocusedMemberResponses(Number(group.id), {
    focusUserId: req.query.focusUserId,
    focusGuestId: req.query.focusGuestId
  });

  return res.render("responses", {
    user: null,
    group,
    questions,
    responses,
    groupBasePath: `/join/${code}`,
    viewerGuestAnswers,
    showMineOnly,
    focusedMember: focused ? focused.member : null,
    focusedMemberResponses: focused ? focused.responses : []
  });
});

app.post("/join/:code/guest", async (req, res) => {
  const code = req.params.code.trim();
  const user = getCurrentUser(req);
  const locale = res.locals.locale || DEFAULT_LOCALE;
  if (user) {
    return respondJoinGuestRedirect(req, res, `/join/${code}`);
  }
  const invite = db
    .prepare("SELECT * FROM invites WHERE code = ?")
    .get(code);
  if (!invite) {
    return sendError(req, res, 404, "Invite not found.");
  }
  const group = db
    .prepare("SELECT * FROM groups WHERE id = ?")
    .get(invite.group_id);
  if (!group) {
    return sendError(req, res, 404, "Group not found.");
  }
  if (Number(group.invite_link_open ?? 1) !== 1) {
    return sendError(req, res, 403, "Invite link is closed.");
  }

  const displayName = normalizeDisplayName(req.body.guestName || "");
  if (displayName.length < 2 || displayName.length > 40) {
    return respondJoinGuestError(req, res, {
      group,
      code,
      displayName,
      error: translate(locale, "join_guest.error_name_invalid"),
      activeMode: "new"
    });
  }

  if (!group.is_public && group.join_password_hash) {
    const password = String(req.body.password || "");
    if (!password) {
      return respondJoinGuestError(req, res, {
        group,
        code,
        displayName,
        error: translate(locale, "join_guest.error_password_required"),
        activeMode: "new"
      });
    }
    const ok = await bcrypt.compare(password, group.join_password_hash);
    if (!ok) {
      return respondJoinGuestError(req, res, {
        group,
        code,
        displayName,
        error: translate(locale, "join_guest.error_password_invalid"),
        activeMode: "new"
      });
    }
  }

  const guestIdForJoin = getGuestIdFromSession(req, { create: true });
  if (
    Number(group.is_global || 0) !== 1
    && isDisplayNameTakenInGroup(Number(group.id), displayName, { excludeGuestId: guestIdForJoin })
  ) {
    return respondJoinGuestError(req, res, {
      group,
      code,
      displayName,
      error: translate(locale, "join_guest.error_name_taken"),
      activeMode: "new"
    });
  }

  setNamedGuestAccess(req, {
    inviteCode: code,
    groupId: Number(group.id),
    displayName
  });
  return respondJoinGuestRedirect(req, res, `/join/${code}/questions`);
});

app.post("/join/:code/guest/return", async (req, res) => {
  const code = req.params.code.trim();
  const user = getCurrentUser(req);
  const locale = res.locals.locale || DEFAULT_LOCALE;
  if (user) {
    return respondJoinGuestRedirect(req, res, `/join/${code}`);
  }
  const invite = db
    .prepare("SELECT * FROM invites WHERE code = ?")
    .get(code);
  if (!invite) {
    return sendError(req, res, 404, "Invite not found.");
  }
  const group = db
    .prepare("SELECT * FROM groups WHERE id = ?")
    .get(invite.group_id);
  if (!group) {
    return sendError(req, res, 404, "Group not found.");
  }
  if (Number(group.invite_link_open ?? 1) !== 1) {
    return sendError(req, res, 403, "Invite link is closed.");
  }

  const returnName = normalizeDisplayName(req.body.returnGuestName || "");
  if (returnName.length < 2 || returnName.length > 40) {
    return respondJoinGuestError(req, res, {
      group,
      code,
      returnName,
      error: translate(locale, "join_guest.error_name_invalid"),
      activeMode: "returning"
    });
  }

  if (!group.is_public && group.join_password_hash) {
    const password = String(req.body.password || "");
    if (!password) {
      return respondJoinGuestError(req, res, {
        group,
        code,
        returnName,
        error: translate(locale, "join_guest.error_password_required"),
        activeMode: "returning"
      });
    }
    const ok = await bcrypt.compare(password, group.join_password_hash);
    if (!ok) {
      return respondJoinGuestError(req, res, {
        group,
        code,
        returnName,
        error: translate(locale, "join_guest.error_password_invalid"),
        activeMode: "returning"
      });
    }
  }

  const existingNamedGuest = db
    .prepare(
      `
      SELECT guest_id, display_name
      FROM named_guest_group_members
      WHERE group_id = ?
        AND display_name = ? COLLATE NOCASE
      LIMIT 1
      `
    )
    .get(Number(group.id), returnName);

  if (!existingNamedGuest) {
    return respondJoinGuestError(req, res, {
      group,
      code,
      returnName,
      error: translate(locale, "join_guest.error_name_not_found"),
      activeMode: "returning"
    });
  }

  resumeNamedGuestAccess(req, {
    inviteCode: code,
    groupId: Number(group.id),
    displayName: String(existingNamedGuest.display_name || returnName).trim(),
    guestId: String(existingNamedGuest.guest_id || "").trim()
  });
  return respondJoinGuestRedirect(req, res, `/join/${code}`);
});

app.get("/join/:code/questions", (req, res) => {
  const code = req.params.code.trim();
  const invite = db
    .prepare("SELECT * FROM invites WHERE code = ?")
    .get(code);
  if (!invite) {
    return sendError(req, res, 404, "Invite not found.");
  }
  const group = db
    .prepare("SELECT * FROM groups WHERE id = ?")
    .get(invite.group_id);
  if (!group) {
    return sendError(req, res, 404, "Group not found.");
  }
  if (Number(group.invite_link_open ?? 1) !== 1) {
    return sendError(req, res, 403, "Invite link is closed.");
  }

  const user = getCurrentUser(req);
  if (user) {
    if (!isMember(user.id, invite.group_id)) {
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, ?, ?)"
      ).run(user.id, invite.group_id, "member", now);
      syncFromGlobalIfCoupled(user.id, invite.group_id, now);
    }
    const groupBasePath = getGroupBasePath(group);
    if (predictionsClosed()) {
      return res.redirect(groupBasePath);
    }
    return res.redirect(`${groupBasePath}/questions`);
  }

  if (!hasNamedGuestAccess(req, code, Number(group.id))) {
    return res.redirect(`/join/${code}`);
  }
  if (predictionsClosed()) {
    return res.redirect(`/join/${code}`);
  }

  const locale = res.locals.locale || DEFAULT_LOCALE;
  const guestId = getGuestIdFromSession(req, { create: true });
  const questions = getQuestions(locale);
  const roster = getRoster();
  const races = getRaces();
  const answers = getGuestResponsesByGroup(guestId, Number(group.id));
  const closed = predictionsClosed();
  const groupRules = getGroupRulesText(group, locale);

  return res.render("questions", {
    user: null,
    group,
    groupRules,
    questions,
    answers,
    prefillNotice: null,
    roster,
    races,
    closed,
    closeAt: PREDICTIONS_CLOSE_AT,
    canCoupleToGlobal: false,
    coupledToGlobal: false,
    globalGroupName: "Global",
    groupBasePath: `/join/${code}`,
    isNamedGuestMode: true,
    guestSignupRedirectPath: `/join/${code}`,
    namedGuestDisplayName: String(getNamedGuestAccessFromSession(req)?.displayName || "").trim(),
    namedGuestShowBottomHint: req.query.saved === "1"
  });
});

app.post("/join/:code/questions", (req, res) => {
  const code = req.params.code.trim();
  const user = getCurrentUser(req);
  if (user) {
    return res.redirect(`/join/${code}`);
  }
  if (predictionsClosed()) {
    return sendError(req, res, 403, "Predictions are closed.");
  }
  const invite = db
    .prepare("SELECT * FROM invites WHERE code = ?")
    .get(code);
  if (!invite) {
    return sendError(req, res, 404, "Invite not found.");
  }
  if (!hasNamedGuestAccess(req, code, Number(invite.group_id))) {
    return sendError(req, res, 403, "Join as guest first.");
  }
  const group = db
    .prepare("SELECT * FROM groups WHERE id = ?")
    .get(invite.group_id);
  if (!group) {
    return sendError(req, res, 404, "Group not found.");
  }
  if (Number(group.invite_link_open ?? 1) !== 1) {
    return sendError(req, res, 403, "Invite link is closed.");
  }

  const guestId = getGuestIdFromSession(req, { create: true });
  const questions = getQuestions();
  const globalGroup = ensureGlobalGroup();
  const targetGroupIds = [Number(group.id)];
  if (globalGroup && Number(globalGroup.id) && Number(globalGroup.id) !== Number(group.id)) {
    targetGroupIds.push(Number(globalGroup.id));
  }
  const now = new Date().toISOString();
  const insert = db.prepare(
    `
    INSERT INTO guest_responses (guest_id, group_id, question_id, answer, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(guest_id, group_id, question_id)
    DO UPDATE SET answer = excluded.answer, updated_at = excluded.updated_at
    `
  );
  const tx = db.transaction(() => {
    for (const targetGroupId of targetGroupIds) {
      for (const question of questions) {
        const serializedAnswer = serializeAnswerFromRequest(question, req.body);
        if (serializedAnswer == null) continue;
        insert.run(
          guestId,
          targetGroupId,
          question.id,
          serializedAnswer,
          now,
          now
        );
      }
    }
  });
  tx();
  return res.redirect(`/join/${code}/questions?saved=1`);
});

app.post("/join/:code", requireAuth, async (req, res) => {
  const user = getCurrentUser(req);
  const code = req.params.code.trim();
  const invite = db
    .prepare("SELECT * FROM invites WHERE code = ?")
    .get(code);
  if (!invite) {
    return sendError(req, res, 404, "Invite not found.");
  }
  if (isMember(user.id, invite.group_id)) {
    const existingGroup = getGroupById(invite.group_id);
    if (!existingGroup) return sendError(req, res, 404, "Group not found.");
    return res.redirect(getGroupBasePath(existingGroup));
  }
  const group = db
    .prepare("SELECT * FROM groups WHERE id = ?")
    .get(invite.group_id);
  if (!group) {
    return sendError(req, res, 404, "Group not found.");
  }
  if (Number(group.invite_link_open ?? 1) !== 1) {
    return sendError(req, res, 403, "Invite link is closed.");
  }
  if (!group.is_public && group.join_password_hash) {
    const { password } = req.body;
    if (!password) {
      const members = db
        .prepare(
          `
          SELECT u.id, u.name, gm.role
          FROM group_members gm
          JOIN users u ON u.id = gm.user_id
          WHERE gm.group_id = ?
          ORDER BY gm.joined_at ASC
          `
        )
        .all(invite.group_id);
      return res.render("join_confirm", {
        user,
        group,
        members,
        code,
        error: "Group password required."
      });
    }
    const ok = await bcrypt.compare(password, group.join_password_hash);
    if (!ok) {
      const members = db
        .prepare(
          `
          SELECT u.id, u.name, gm.role
          FROM group_members gm
          JOIN users u ON u.id = gm.user_id
          WHERE gm.group_id = ?
          ORDER BY gm.joined_at ASC
          `
        )
        .all(invite.group_id);
      return res.render("join_confirm", {
        user,
        group,
        members,
        code,
        error: "Incorrect password."
      });
    }
  }
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, ?, ?)"
  ).run(user.id, invite.group_id, "member", now);
  syncFromGlobalIfCoupled(user.id, invite.group_id, now);

  res.redirect(getGroupBasePath(group));
});

app.post("/groups/:id/password", requireAuth, async (req, res) => {
  const user = getCurrentUser(req);
  const groupId = Number(req.params.id);
  if (!isGroupAdmin(user.id, groupId)) {
    return sendError(req, res, 403, "Admin access only.");
  }
  const group = db.prepare("SELECT * FROM groups WHERE id = ?").get(groupId);
  if (group && group.is_public) {
    return sendError(req, res, 400, "Public groups do not use a password.");
  }
  const { joinPassword } = req.body;
  if (!joinPassword) {
    return res.redirect(`/groups/${groupId}`);
  }
  const joinPasswordHash = await bcrypt.hash(joinPassword, 10);
  db.prepare("UPDATE groups SET join_password_hash = ? WHERE id = ?").run(
    joinPasswordHash,
    groupId
  );
  res.redirect(`/groups/${groupId}`);
});

app.post("/groups/:id/rules", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const groupId = Number(req.params.id);
  if (!isGroupAdmin(user.id, groupId)) {
    return sendError(req, res, 403, "Admin access only.");
  }
  const group = db.prepare("SELECT * FROM groups WHERE id = ?").get(groupId);
  if (!group) {
    return sendError(req, res, 404, "Group not found.");
  }
  const rulesText = String(req.body.rulesText || "").trim();
  db.prepare("UPDATE groups SET rules_text = ? WHERE id = ?").run(
    rulesText || null,
    groupId
  );
  return res.redirect(`/groups/${groupId}`);
});

app.post("/groups/:id/members/:userId/kick", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const groupId = Number(req.params.id);
  const targetUserId = Number(req.params.userId);
  if (!isGroupAdmin(user.id, groupId)) {
    return sendError(req, res, 403, "Admin access only.");
  }
  const group = db.prepare("SELECT id, is_global FROM groups WHERE id = ?").get(groupId);
  if (!group) {
    return sendError(req, res, 404, "Group not found.");
  }
  if (group.is_global) {
    return sendError(req, res, 400, "Members cannot be removed from the Global group.");
  }
  const targetRole = getMemberRole(targetUserId, groupId);
  if (!targetRole) {
    return res.redirect(`/groups/${groupId}`);
  }
  if (targetRole === "owner") {
    return sendError(req, res, 403, "Owner cannot be removed.");
  }
  db.prepare(
    "DELETE FROM group_members WHERE user_id = ? AND group_id = ?"
  ).run(targetUserId, groupId);
  res.redirect(`/groups/${groupId}`);
});

app.post("/groups/:id/named-guests/:guestId/kick", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const groupId = Number(req.params.id);
  const guestId = String(req.params.guestId || "").trim();
  if (!isGroupAdmin(user.id, groupId)) {
    return sendError(req, res, 403, "Admin access only.");
  }
  if (!guestId || !/^[A-Za-z0-9_-]{4,128}$/.test(guestId)) {
    return sendError(req, res, 400, "Invalid guest id.");
  }
  const group = db.prepare("SELECT id, is_global FROM groups WHERE id = ?").get(groupId);
  if (!group) {
    return sendError(req, res, 404, "Group not found.");
  }
  if (Number(group.is_global) === 1) {
    return sendError(req, res, 400, "Named guests are not managed in the Global group.");
  }
  const target = db
    .prepare(
      `
      SELECT guest_id
      FROM named_guest_group_members
      WHERE group_id = ?
        AND guest_id = ?
      `
    )
    .get(groupId, guestId);
  if (!target) {
    return res.redirect(`/groups/${groupId}`);
  }

  const tx = db.transaction(() => {
    db.prepare(
      "DELETE FROM guest_responses WHERE group_id = ? AND guest_id = ?"
    ).run(groupId, guestId);
    db.prepare(
      "DELETE FROM named_guest_group_members WHERE group_id = ? AND guest_id = ?"
    ).run(groupId, guestId);

    const hasAnyResponses = db
      .prepare("SELECT 1 FROM guest_responses WHERE guest_id = ? LIMIT 1")
      .get(guestId);
    const hasAnyMemberships = db
      .prepare("SELECT 1 FROM named_guest_group_members WHERE guest_id = ? LIMIT 1")
      .get(guestId);
    if (!hasAnyResponses && !hasAnyMemberships) {
      db.prepare("DELETE FROM named_guest_profiles WHERE guest_id = ?").run(guestId);
      db.prepare("DELETE FROM pending_guest_claims WHERE guest_id = ?").run(guestId);
    }
  });
  tx();
  return res.redirect(`/groups/${groupId}`);
});

app.post("/groups/:id/members/:userId/promote", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const groupId = Number(req.params.id);
  const targetUserId = Number(req.params.userId);
  if (!isGroupAdmin(user.id, groupId)) {
    return sendError(req, res, 403, "Admin access only.");
  }
  const targetRole = getMemberRole(targetUserId, groupId);
  if (!targetRole) {
    return res.redirect(`/groups/${groupId}`);
  }
  if (targetRole === "owner") {
    return res.redirect(`/groups/${groupId}`);
  }
  if (targetRole === "admin") {
    return res.redirect(`/groups/${groupId}`);
  }
  if (!canTakePrivilegedRole(targetUserId, targetRole)) {
    return sendError(
      req,
      res,
      400,
      `User already has the maximum of ${MAX_PRIVILEGED_GROUPS} owner/admin groups.`
    );
  }
  db.prepare(
    "UPDATE group_members SET role = ? WHERE user_id = ? AND group_id = ?"
  ).run("admin", targetUserId, groupId);
  res.redirect(`/groups/${groupId}`);
});

app.post("/groups/:id/members/:userId/demote", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const groupId = Number(req.params.id);
  const targetUserId = Number(req.params.userId);
  if (!isGroupAdmin(user.id, groupId)) {
    return sendError(req, res, 403, "Admin access only.");
  }
  const targetRole = getMemberRole(targetUserId, groupId);
  if (!targetRole || targetRole === "owner") {
    return res.redirect(`/groups/${groupId}`);
  }
  db.prepare(
    "UPDATE group_members SET role = ? WHERE user_id = ? AND group_id = ?"
  ).run("member", targetUserId, groupId);
  res.redirect(`/groups/${groupId}`);
});

app.post("/groups/:id/leave", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const groupId = Number(req.params.id);
  if (!isMember(user.id, groupId)) {
    return sendError(req, res, 403, "Not a group member.");
  }

  const group = db.prepare("SELECT * FROM groups WHERE id = ?").get(groupId);
  if (group && group.is_global) {
    return sendError(req, res, 400, "You cannot leave the Global group.");
  }

  const role = getMemberRole(user.id, groupId);
  const tx = db.transaction(() => {
    if (role === "owner") {
      const nextOwner = getNextOwner(groupId, user.id);
      if (!nextOwner) {
        throw new Error(
          `No eligible new owner found. A non-global-admin user can be owner/admin in at most ${MAX_PRIVILEGED_GROUPS} groups.`
        );
      }
      db.prepare("UPDATE groups SET owner_id = ? WHERE id = ?").run(
        nextOwner.user_id,
        groupId
      );
      db.prepare(
        "UPDATE group_members SET role = 'owner' WHERE user_id = ? AND group_id = ?"
      ).run(nextOwner.user_id, groupId);
    }
    db.prepare("DELETE FROM group_members WHERE user_id = ? AND group_id = ?").run(
      user.id,
      groupId
    );
  });

  try {
    tx();
  } catch (err) {
    return sendError(req, res, 400, err.message);
  }

  res.redirect("/dashboard");
});

app.get("/global/questions", (req, res, next) => {
  const user = getCurrentUser(req);
  if (user) return next();
  if (predictionsClosed()) {
    return res.redirect("/");
  }
  const locale = res.locals.locale || DEFAULT_LOCALE;
  const globalGroup = ensureGlobalGroup();
  if (!globalGroup) {
    return sendError(req, res, 500, "Global group is not available.");
  }
  const guestId = getGuestIdFromSession(req, { create: true });
  const questions = getQuestions(locale);
  const roster = getRoster();
  const races = getRaces();
  const answers = getGuestResponsesByGroup(guestId, Number(globalGroup.id));
  const closed = predictionsClosed();
  const groupRules = getGroupRulesText(globalGroup, locale);
  return res.render("questions", {
    user: null,
    group: globalGroup,
    groupRules,
    questions,
    answers,
    prefillNotice: null,
    roster,
    races,
    closed,
    closeAt: PREDICTIONS_CLOSE_AT,
    canCoupleToGlobal: false,
    coupledToGlobal: false,
    globalGroupName: globalGroup.name || "Global",
    groupBasePath: getGroupBasePath(globalGroup),
    isVisitorMode: true
  });
});

app.post("/global/questions", (req, res, next) => {
  const user = getCurrentUser(req);
  if (user) return next();
  if (predictionsClosed()) {
    return sendError(req, res, 403, "Predictions are closed.");
  }
  const globalGroup = ensureGlobalGroup();
  if (!globalGroup) {
    return sendError(req, res, 500, "Global group is not available.");
  }
  const guestId = getGuestIdFromSession(req, { create: true });
  const questions = getQuestions();
  const now = new Date().toISOString();
  const insert = db.prepare(
    `
    INSERT INTO guest_responses (guest_id, group_id, question_id, answer, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(guest_id, group_id, question_id)
    DO UPDATE SET answer = excluded.answer, updated_at = excluded.updated_at
    `
  );
  const tx = db.transaction(() => {
    for (const question of questions) {
      const serializedAnswer = serializeAnswerFromRequest(question, req.body);
      if (serializedAnswer == null) continue;
      insert.run(
        guestId,
        Number(globalGroup.id),
        question.id,
        serializedAnswer,
        now,
        now
      );
    }
  });
  tx();
  return res.redirect("/global/questions");
});

app.get(["/global/questions", "/groups/:id/questions"], requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const locale = res.locals.locale || DEFAULT_LOCALE;
  const group = getGroupFromRequest(req);
  if (!group) {
    return sendError(req, res, 404, "Group not found.");
  }
  const groupId = Number(group.id);
  if (!isMember(user.id, groupId)) {
    return sendError(req, res, 403, "Not a group member.");
  }
  const groupBasePath = getGroupBasePath(group);
  if (predictionsClosed()) {
    return res.redirect(groupBasePath);
  }
  const questions = getQuestions(locale);
  const roster = getRoster();
  const races = getRaces();
  const currentAnswers = getResponsesByGroup(user.id, groupId);
  const copyGroups = getCopySourceGroups(user.id, groupId);
  const globalGroup = getGlobalGroup();
  const canCoupleToGlobalBase =
    !!globalGroup && Number(group.is_global) !== 1 && Number(globalGroup.id) !== groupId;
  const hasGlobalResponses = canCoupleToGlobalBase
    ? !!db
      .prepare(
        "SELECT 1 FROM responses WHERE user_id = ? AND group_id = ? LIMIT 1"
      )
      .get(user.id, globalGroup.id)
    : false;
  const canCoupleToGlobal = canCoupleToGlobalBase && hasGlobalResponses;
  const coupledToGlobal = canCoupleToGlobal ? isCoupledToGlobal(user.id, groupId) : false;
  let prefillNotice = null;
  let prefillNoticePrefix = null;
  let prefillNoticeSuffix = null;
  let prefillSourceGroupName = null;
  let prefillSourceGroupPath = null;
  let answers = currentAnswers;

  const setPrefillNoticeWithLink = (groupName, groupQuestionsPath) => {
    prefillNotice = translate(locale, "questions.prefilled_from_group", {
      group_name: groupName
    });
    prefillSourceGroupName = String(groupName || "").trim();
    prefillSourceGroupPath = String(groupQuestionsPath || "").trim();
    const marker = "__GROUP_NAME__";
    const template = translate(locale, "questions.prefilled_from_group", {
      group_name: marker
    });
    const markerIndex = template.indexOf(marker);
    if (markerIndex >= 0) {
      prefillNoticePrefix = template.slice(0, markerIndex);
      prefillNoticeSuffix = template.slice(markerIndex + marker.length);
    }
  };

  if (canCoupleToGlobal && coupledToGlobal) {
    syncFromGlobalIfCoupled(user.id, groupId);
    const globalAnswers = getResponsesByGroup(user.id, globalGroup.id);
    answers = globalAnswers;
    setPrefillNoticeWithLink(globalGroup.name, `${getGroupBasePath(globalGroup)}/questions`);
  } else if (Object.keys(currentAnswers).length === 0) {
    const copyGlobalGroup = copyGroups.find((row) => row.is_global === 1);
    if (copyGlobalGroup) {
      const globalAnswers = getResponsesByGroup(user.id, copyGlobalGroup.id);
      if (Object.keys(globalAnswers).length > 0) {
        answers = globalAnswers;
        setPrefillNoticeWithLink(copyGlobalGroup.name, "/global/questions");
      }
    }
  }

  const closed = predictionsClosed();
  const groupRules = getGroupRulesText(group, locale);
  res.render("questions", {
    user,
    group,
    groupRules,
    questions,
    answers,
    prefillNotice,
    prefillNoticePrefix,
    prefillNoticeSuffix,
    prefillSourceGroupName,
    prefillSourceGroupPath,
    roster,
    races,
    closed,
    closeAt: PREDICTIONS_CLOSE_AT,
    canCoupleToGlobal,
    coupledToGlobal,
    globalGroupName: globalGroup ? globalGroup.name : "Global",
    groupBasePath,
    isGuestMode: false
  });
});

app.post(["/global/questions", "/groups/:id/questions"], requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const group = getGroupFromRequest(req);
  if (!group) {
    return sendError(req, res, 404, "Group not found.");
  }
  const groupId = Number(group.id);
  if (!isMember(user.id, groupId)) {
    return sendError(req, res, 403, "Not a group member.");
  }
  const groupBasePath = getGroupBasePath(group);

  const globalGroup = getGlobalGroup();
  const canCoupleToGlobalBase =
    !!globalGroup && Number(group.is_global) !== 1 && Number(globalGroup.id) !== groupId;
  const hasGlobalResponses = canCoupleToGlobalBase
    ? !!db
      .prepare(
        "SELECT 1 FROM responses WHERE user_id = ? AND group_id = ? LIMIT 1"
      )
      .get(user.id, globalGroup.id)
    : false;
  const canCoupleToGlobal = canCoupleToGlobalBase && hasGlobalResponses;
  const coupledToGlobal = canCoupleToGlobal ? req.body.coupleToGlobal === "1" : false;

  if (predictionsClosed()) {
    return sendError(req, res, 403, "Predictions are closed.");
  }

  const questions = getQuestions();
  const now = new Date().toISOString();

  if (canCoupleToGlobalBase && !hasGlobalResponses) {
    setCoupledToGlobal(user.id, groupId, false);
  }

  if (canCoupleToGlobal) {
    setCoupledToGlobal(user.id, groupId, coupledToGlobal);
    if (coupledToGlobal) {
      syncResponsesFromSourceGroup(user.id, globalGroup.id, groupId, now);
      return res.redirect(`${groupBasePath}/questions`);
    }
  }

  const insert = db.prepare(
    `
    INSERT INTO responses (user_id, group_id, question_id, answer, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, group_id, question_id)
    DO UPDATE SET answer = excluded.answer, updated_at = excluded.updated_at
    `
  );

  const tx = db.transaction(() => {
    for (const question of questions) {
      const serializedAnswer = serializeAnswerFromRequest(question, req.body);
      if (serializedAnswer == null) continue;
      insert.run(user.id, groupId, question.id, serializedAnswer, now, now);
    }
  });
  tx();

  if (group.is_global) {
    syncGlobalResponsesToCoupledGroups(user.id, now);
  }

  // First group submission can seed the Global league as a baseline.
  if (!group.is_global) {
    if (globalGroup && globalGroup.id !== groupId) {
      const existingGlobalResponses = db
        .prepare("SELECT COUNT(*) as count FROM responses WHERE user_id = ? AND group_id = ?")
        .get(user.id, globalGroup.id);
      if (Number(existingGlobalResponses?.count || 0) === 0) {
        const sourceRows = db
          .prepare("SELECT question_id, answer FROM responses WHERE user_id = ? AND group_id = ?")
          .all(user.id, groupId);
        if (sourceRows.length > 0) {
          const seedNow = new Date().toISOString();
          const seedTx = db.transaction(() => {
            db.prepare(
              "INSERT OR IGNORE INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, 'member', ?)"
            ).run(user.id, globalGroup.id, seedNow);
            const upsertGlobal = db.prepare(
              `
              INSERT INTO responses (user_id, group_id, question_id, answer, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(user_id, group_id, question_id)
              DO UPDATE SET answer = excluded.answer, updated_at = excluded.updated_at
              `
            );
            for (const row of sourceRows) {
              upsertGlobal.run(
                user.id,
                globalGroup.id,
                row.question_id,
                row.answer,
                seedNow,
                seedNow
              );
            }
          });
          seedTx();
        }
      }
    }
  }

  res.redirect(`${groupBasePath}/questions`);
});

app.get("/global/responses", (req, res, next) => {
  const user = getCurrentUser(req);
  if (user) return next();

  const locale = res.locals.locale || DEFAULT_LOCALE;
  const group = ensureGlobalGroup();
  if (!group) {
    return sendError(req, res, 500, "Global group is not available.");
  }

  const guestId = getGuestIdFromSession(req, { create: true });
  const questions = getQuestions(locale);
  const responses = getResponsesForGroup(Number(group.id), { includeNamedGuests: false });
  const viewerGuestAnswers = getGuestResponsesByGroup(guestId, Number(group.id));
  const showMineOnly = req.query.mine === "1";

  return res.render("responses", {
    user: null,
    group,
    questions,
    responses,
    groupBasePath: "/",
    viewerGuestAnswers,
    showMineOnly,
    focusedMember: null,
    focusedMemberResponses: []
  });
});

app.get(["/global/responses", "/groups/:id/responses"], requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const locale = res.locals.locale || DEFAULT_LOCALE;
  const group = getGroupFromRequest(req);
  if (!group) {
    return sendError(req, res, 404, "Group not found.");
  }
  const groupId = Number(group.id);
  if (!isMember(user.id, groupId)) {
    return sendError(req, res, 403, "Not a group member.");
  }
  const questions = getQuestions(locale);
  const excludeHiddenAdmins = isGlobalGroup(group);
  const responses = getResponsesForGroup(groupId, {
    includeNamedGuests: true,
    excludeHiddenAdmins
  });
  const showMineOnly = req.query.mine === "1";
  const focused = getFocusedMemberResponses(groupId, {
    focusUserId: req.query.focusUserId,
    focusGuestId: req.query.focusGuestId,
    excludeHiddenAdmins
  });

  res.render("responses", {
    user,
    group,
    questions,
    responses,
    groupBasePath: getGroupBasePath(group),
    showMineOnly,
    focusedMember: focused ? focused.member : null,
    focusedMemberResponses: focused ? focused.responses : []
  });
});

app.get(["/global/leaderboard", "/groups/:id/leaderboard"], requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const locale = res.locals.locale || DEFAULT_LOCALE;
  const adminAccess = isAdmin(req);
  if (!isLeaderboardAvailable() && !adminAccess) {
    return sendError(
      req,
      res,
      404,
      "Leaderboard is not available yet. It will be enabled after season results are finalized."
    );
  }
  const group = getGroupFromRequest(req);
  if (!group) {
    return sendError(req, res, 404, "Group not found.");
  }
  const groupId = Number(group.id);
  const excludeHiddenAdmins = isGlobalGroup(group);
  if (!adminAccess && !isMember(user.id, groupId)) {
    return sendError(req, res, 403, "Not a group member.");
  }
  const questions = getQuestions(locale);
  const actualRows = db.prepare("SELECT * FROM actuals").all();
  const actuals = actualRows.reduce((acc, row) => {
    acc[row.question_id] = row.value;
    return acc;
  }, {});

  const responses = db
    .prepare(
      `
      SELECT participant_id, user_name, question_id, answer
      FROM (
        SELECT
          CAST(u.id AS TEXT) as participant_id,
          u.name as user_name,
          r.question_id,
          r.answer
        FROM responses r
        JOIN users u ON u.id = r.user_id
        WHERE r.group_id = ?
          ${excludeHiddenAdmins ? "AND COALESCE(u.hide_from_global, 0) = 0" : ""}

        UNION ALL

        SELECT
          gr.guest_id as participant_id,
          ngm.display_name as user_name,
          gr.question_id,
          gr.answer
        FROM guest_responses gr
        JOIN named_guest_group_members ngm
          ON ngm.group_id = gr.group_id
         AND ngm.guest_id = gr.guest_id
        WHERE gr.group_id = ?
      ) combined_responses
      `
    )
    .all(groupId, groupId);

  const questionMap = questions.reduce((acc, q) => {
    acc[q.id] = q;
    return acc;
  }, {});

  const scoreByUser = {};
  const members = db
    .prepare(
      `
      SELECT participant_id, user_name
      FROM (
        SELECT
          CAST(u.id AS TEXT) as participant_id,
          u.name as user_name
        FROM group_members gm
        JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ?
          ${excludeHiddenAdmins ? "AND COALESCE(u.hide_from_global, 0) = 0" : ""}

        UNION ALL

        SELECT
          ngm.guest_id as participant_id,
          ngm.display_name as user_name
        FROM named_guest_group_members ngm
        WHERE ngm.group_id = ?
      ) combined_members
      `
    )
    .all(groupId, groupId);

  members.forEach((member) => {
    scoreByUser[member.participant_id] = {
      userId: member.participant_id,
      name: member.user_name,
      total: 0,
      byQuestion: {},
      answersByQuestion: {}
    };
  });

  function parseStoredValue(question, raw) {
    if (!raw) return null;
    const text = String(raw).trim();
    const type = question.type || "text";
    if (
      type === "ranking" ||
      type === "multi_select" ||
      type === "multi_select_limited" ||
      type === "teammate_battle" ||
      type === "boolean_with_optional_driver" ||
      type === "numeric_with_driver" ||
      type === "single_choice_with_driver"
    ) {
      try {
        return JSON.parse(raw);
      } catch (err) {
        return null;
      }
    }
    if (text.startsWith("[") || text.startsWith("{")) {
      try {
        return JSON.parse(text);
      } catch (err) {}
    }
    return raw;
  }

  function getActual(question) {
    const raw = actuals[question.id];
    return parseStoredValue(question, raw);
  }

  function isMatch(actualValue, predictedValue) {
    if (actualValue == null || predictedValue == null) return false;
    if (Array.isArray(actualValue)) {
      return actualValue.includes(predictedValue);
    }
    return String(actualValue) === String(predictedValue);
  }

  function scoreQuestion(question, predictedRaw, actualRaw) {
    if (actualRaw == null || predictedRaw == null) return 0;
    const type = question.type || "text";
    if (type === "ranking") {
      const points = question.points || {};
      let score = 0;
      const positionLabels = ["1st", "2nd", "3rd", "4th", "5th"];
      const count = Number(question.count) || 3;
      for (let i = 0; i < count; i += 1) {
        const actual = actualRaw[i];
        const predicted = predictedRaw[i];
        const key = positionLabels[i] || String(i + 1);
        const value = points[key] || 0;
        if (actual == null || predicted == null) continue;
        if (Array.isArray(actual) ? actual.includes(predicted) : actual === predicted) {
          score += value;
        }
      }
      return score;
    }
    if (type === "single_choice" || type === "text") {
      if (question.special_case === "all_podiums_bonus") {
        if (String(actualRaw) === String(question.bonus_value)) {
          return String(predictedRaw) === String(question.bonus_value)
            ? Number(question.bonus_points || 0)
            : 0;
        }
      }
      return isMatch(actualRaw, predictedRaw) ? Number(question.points || 0) : 0;
    }
    if (type === "boolean") {
      return isMatch(actualRaw, predictedRaw) ? Number(question.points || 0) : 0;
    }
    if (type === "multi_select") {
      const points = Number(question.points || 0);
      const penalty = Number(question.penalty ?? points);
      const minimum = Number(question.minimum ?? 0);
      const actualSet = new Set(actualRaw || []);
      const predictedSet = new Set(predictedRaw || []);
      let correct = 0;
      let wrong = 0;
      let missing = 0;
      predictedSet.forEach((item) => {
        if (actualSet.has(item)) {
          correct += 1;
        } else {
          wrong += 1;
        }
      });
      actualSet.forEach((item) => {
        if (!predictedSet.has(item)) {
          missing += 1;
        }
      });
      const score = correct * points - (wrong + missing) * penalty;
      return Math.max(minimum, score);
    }
    if (type === "teammate_battle") {
      const base = Number(question.points || 0);
      const tieBonus = Number(question.tie_bonus || 0);
      const actualWinner = actualRaw?.winner;
      const actualDiff = Number(actualRaw?.diff);
      const predictedWinner = predictedRaw?.winner;
      const predictedDiff = Number(predictedRaw?.diff);
      if (!actualWinner) return 0;
      if (actualWinner === "tie") {
        return predictedWinner === "tie" ? tieBonus : 0;
      }
      if (predictedWinner !== actualWinner) return 0;
      if (!Number.isFinite(actualDiff) || !Number.isFinite(predictedDiff)) return 0;
      const score = base - Math.abs(predictedDiff - actualDiff);
      return Math.max(0, score);
    }
    if (type === "boolean_with_optional_driver") {
      const base = Number(question.points || 0);
      const bonus = Number(question.bonus_points || 0);
      const actualChoice = actualRaw?.choice;
      const actualDriver = actualRaw?.driver;
      const predictedChoice = predictedRaw?.choice;
      const predictedDriver = predictedRaw?.driver;
      if (actualChoice == null || predictedChoice == null) return 0;
      let score = 0;
      if (String(actualChoice) === String(predictedChoice)) {
        score += base;
        if (
          String(actualChoice) === "yes" &&
          actualDriver &&
          String(actualDriver) === String(predictedDriver)
        ) {
          score += bonus;
        }
      }
      return score;
    }
    if (type === "numeric_with_driver" || type === "single_choice_with_driver") {
      const points = question.points || {};
      const actualValue = actualRaw?.value;
      const predictedValue = predictedRaw?.value;
      const actualDriver = actualRaw?.driver;
      const predictedDriver = predictedRaw?.driver;
      let score = 0;
      if (actualValue != null && predictedValue != null) {
        if (isMatch(actualValue, predictedValue)) {
          score += Number(points.position || 0);
        } else if (
          type === "single_choice_with_driver" &&
          question.position_nearby_points &&
          typeof question.position_nearby_points === "object"
        ) {
          const toGridNumber = (value) => {
            if (value == null) return null;
            const raw = String(value).trim().toLowerCase();
            if (!raw) return null;
            if (raw === "pitlane" || raw === "pit lane") return 23;
            const numeric = Number(raw);
            return Number.isFinite(numeric) ? numeric : null;
          };

          const actualGrid = toGridNumber(actualValue);
          const predictedGrid = toGridNumber(predictedValue);
          if (actualGrid != null && predictedGrid != null) {
            const diff = Math.abs(actualGrid - predictedGrid);
            const nearbyPoints = Number(
              question.position_nearby_points[String(diff)] || 0
            );
            if (nearbyPoints > 0) score += nearbyPoints;
          }
        }
      }
      if (actualDriver && predictedDriver && isMatch(actualDriver, predictedDriver)) {
        score += Number(points.driver || 0);
      }
      return score;
    }
    if (type === "multi_select_limited") {
      const points = Number(question.points || 0);
      const dnfByRace = actualRaw?.dnf_by_race || {};
      let total = 0;
      (predictedRaw || []).forEach((race) => {
        const count = Number(dnfByRace[race] || 0);
        total += count * points;
      });
      return total;
    }
    if (type === "numeric") {
      return Number(actualRaw) === Number(predictedRaw) ? Number(question.points || 0) : 0;
    }
    return 0;
  }

  responses.forEach((row) => {
    const question = questionMap[row.question_id];
    if (!question) return;
    const actual = getActual(question);
    const predicted = parseStoredValue(question, row.answer);
    const points = scoreQuestion(question, predicted, actual);
    if (!scoreByUser[row.participant_id]) return;
    scoreByUser[row.participant_id].total += points;
    scoreByUser[row.participant_id].byQuestion[row.question_id] = points;
    scoreByUser[row.participant_id].answersByQuestion[row.question_id] = row.answer;
  });

  const leaderboard = Object.values(scoreByUser).sort((a, b) => b.total - a.total);
  const leaderboardPerPage = 10;
  const requestedLeaderboardPage = Number(req.query.page || 1);
  const currentLeaderboardPage =
    Number.isFinite(requestedLeaderboardPage) && requestedLeaderboardPage > 0
      ? Math.floor(requestedLeaderboardPage)
      : 1;
  const totalLeaderboardPages = Math.max(
    1,
    Math.ceil(leaderboard.length / leaderboardPerPage)
  );
  const safeLeaderboardPage = Math.min(
    currentLeaderboardPage,
    totalLeaderboardPages
  );
  const leaderboardOffset = (safeLeaderboardPage - 1) * leaderboardPerPage;
  const pagedLeaderboard = leaderboard
    .slice(leaderboardOffset, leaderboardOffset + leaderboardPerPage)
    .map((row, index) => ({
      ...row,
      rank: leaderboardOffset + index + 1
    }));
  res.render("leaderboard", {
    user,
    group,
    questions,
    leaderboard: pagedLeaderboard,
    actuals,
    leaderboardTotal: leaderboard.length,
    leaderboardPerPage,
    currentLeaderboardPage: safeLeaderboardPage,
    totalLeaderboardPages,
    leaderboardBasePath: `${getGroupBasePath(group)}/leaderboard`
  });
});

registerAdminRoutes(app, {
  db,
  requireAdmin,
  getCurrentUser,
  getQuestions,
  getRoster,
  getRaces,
  clampNumber,
  generateUniqueGroupId
});

app.use((req, res) => {
  res.status(404).render("404", { user: getCurrentUser(req) });
});

app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  if (res.headersSent) {
    return next(err);
  }
  return sendError(req, res, 500, "Something went wrong. Please try again.");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
