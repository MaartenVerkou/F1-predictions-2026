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

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "app.db");
const QUESTIONS_PATH = process.env.QUESTIONS_PATH || path.join(DATA_DIR, "questions.json");
const ROSTER_PATH = process.env.ROSTER_PATH || path.join(DATA_DIR, "roster.json");
const RACES_PATH = process.env.RACES_PATH || path.join(DATA_DIR, "races.json");
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-only-change-me";
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_FROM = process.env.SMTP_FROM || "";
const COMPANY_NAME = process.env.COMPANY_NAME || "F1 Predictions";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_CLIENT_NAME = process.env.SMTP_CLIENT_NAME || "";
function deriveBaseUrl() {
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
const DEV_AUTO_LOGIN = process.env.DEV_AUTO_LOGIN === "1";
const DEV_AUTO_LOGIN_EMAIL =
  process.env.DEV_AUTO_LOGIN_EMAIL || "dev@example.com";
const DEV_AUTO_LOGIN_NAME = process.env.DEV_AUTO_LOGIN_NAME || "Dev Admin";
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

function formatCloseDateForRules(locale = DEFAULT_LOCALE) {
  const closeDate = new Date(PREDICTIONS_CLOSE_AT);
  if (Number.isNaN(closeDate.getTime())) return "";
  return closeDate.toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
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

  CREATE TABLE IF NOT EXISTS actuals (
    question_id TEXT PRIMARY KEY,
    value TEXT NOT NULL,
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
}

ensureGroupColumns();

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
}

ensureUserColumns();

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

function ensureGlobalGroup(ownerId) {
  let global = getGlobalGroup();
  if (global) {
    // Global league should stay public and free to join.
    db.prepare(
      "UPDATE groups SET is_public = 1, join_password_hash = NULL WHERE id = ?"
    ).run(global.id);
    return db.prepare("SELECT * FROM groups WHERE id = ?").get(global.id);
  }
  if (!ownerId) {
    const firstUser = db
      .prepare("SELECT id FROM users ORDER BY created_at ASC LIMIT 1")
      .get();
    if (!firstUser) return null;
    ownerId = firstUser.id;
  }
  const now = new Date().toISOString();
  const info = db
    .prepare(
      "INSERT INTO groups (name, owner_id, created_at, is_global, is_public, join_password_hash) VALUES (?, ?, ?, 1, 1, NULL)"
    )
    .run("Global", ownerId, now);
  global = db.prepare("SELECT * FROM groups WHERE id = ?").get(info.lastInsertRowid);
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
  const users = db.prepare("SELECT id FROM users").all();
  const addMember = db.prepare(
    "INSERT OR IGNORE INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, 'member', ?)"
  );
  const tx = db.transaction(() => {
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
  const locale = SUPPORTED_LOCALES.includes(savedLocale)
    ? savedLocale
    : DEFAULT_LOCALE;
  res.locals.locale = locale;
  res.locals.currentPath = req.originalUrl || "/";
  res.locals.supportedLocales = SUPPORTED_LOCALES.map((code) => ({
    code,
    label: LOCALE_LABELS[code] || code
  }));
  res.locals.t = (key, params = {}) => translate(locale, key, params);
  next();
});

app.post("/language", (req, res) => {
  const locale = String(req.body.locale || "").trim().toLowerCase();
  if (SUPPORTED_LOCALES.includes(locale)) {
    req.session.locale = locale;
  }
  const redirectToRaw = String(req.body.redirectTo || req.get("referer") || "/").trim();
  let redirectTo = "/";
  if (redirectToRaw.startsWith("/")) {
    redirectTo = redirectToRaw;
  } else {
    try {
      const parsed = new URL(redirectToRaw);
      redirectTo = `${parsed.pathname || "/"}${parsed.search || ""}`;
    } catch (err) {
      redirectTo = "/";
    }
  }
  return res.redirect(redirectTo);
});

app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production" || !DEV_AUTO_LOGIN) {
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
  const email = DEV_AUTO_LOGIN_EMAIL.trim().toLowerCase();
  let user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (!user) {
    const passwordHash = bcrypt.hashSync(
      crypto.randomBytes(12).toString("hex"),
      10
    );
    const info = db
      .prepare(
        "INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)"
      )
      .run(DEV_AUTO_LOGIN_NAME.trim(), email, passwordHash, new Date().toISOString());
    user = { id: info.lastInsertRowid };
  }
  ensureUserInGlobalGroup(user.id);
  req.session.userId = user.id;
  next();
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

function getQuestions(locale = DEFAULT_LOCALE) {
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
    return localizeQuestions(fallback, locale);
  }

  const parsed = readJsonFile(QUESTIONS_PATH);
  let questions = [];
  if (Array.isArray(parsed)) {
    questions = parsed;
  } else if (parsed && Array.isArray(parsed.questions)) {
    questions = parsed.questions;
  }
  return localizeQuestions(questions, locale);
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

function getGroupRulesText(group, locale = DEFAULT_LOCALE) {
  const customRules = String(group?.rules_text || "").trim();
  return customRules || getDefaultGroupRules(locale);
}

function getMailer() {
  if (!SMTP_USER || !SMTP_PASS || !SMTP_HOST) return null;
  const smtpName =
    SMTP_CLIENT_NAME || (SMTP_USER.includes("@") ? SMTP_USER.split("@")[1] : "");
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

function clampNumber(value, min, max) {
  if (value == null) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.min(max, Math.max(min, num));
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
  NODE_ENV: process.env.NODE_ENV || "development"
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
        SELECT g.id, g.name, g.owner_id, gm.role
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
          SELECT g.id, g.name, g.owner_id, gm.role
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
        SELECT g.id, g.name, g.owner_id, gm.role
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
  const groupInfo = db
    .prepare(
      "INSERT INTO groups (name, owner_id, created_at, join_code, join_password_hash, is_public, is_global) VALUES (?, ?, ?, ?, ?, ?, 0)"
    )
    .run(normalizedName, user.id, now, joinCode, joinPasswordHash, isPublic ? 1 : 0);
  db.prepare(
    "INSERT INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, ?, ?)"
  ).run(user.id, groupInfo.lastInsertRowid, "owner", now);

  res.redirect(`/groups/${groupInfo.lastInsertRowid}`);
});

app.post("/groups/:id/join-public", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const groupId = Number(req.params.id);
  const group = db.prepare("SELECT * FROM groups WHERE id = ?").get(groupId);
  if (!group || !group.is_public) {
    return sendError(req, res, 404, "Group not found.");
  }
  if (!isMember(user.id, groupId)) {
    db.prepare(
      "INSERT INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, ?, ?)"
    ).run(user.id, groupId, "member", new Date().toISOString());
  }
  res.redirect(`/groups/${groupId}`);
});

app.post("/groups/join", requireAuth, async (req, res) => {
  const user = getCurrentUser(req);
  const { code, password } = req.body;
  const groups = db
    .prepare(
      `
      SELECT g.id, g.name, g.owner_id, gm.role
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
    db.prepare(
      "INSERT INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, ?, ?)"
    ).run(user.id, group.id, "member", new Date().toISOString());
  }

  res.render("dashboard", {
    user,
    groups,
    publicGroups,
    error: null,
    success: `Joined group ${group.name}.`
  });
});

app.get("/groups/:id", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const locale = res.locals.locale || DEFAULT_LOCALE;
  const groupId = Number(req.params.id);
  if (!isMember(user.id, groupId)) {
    return sendError(req, res, 403, "Not a group member.");
  }
  const group = db
    .prepare("SELECT * FROM groups WHERE id = ?")
    .get(groupId);
  const members = db
    .prepare(
      `
      SELECT u.id, u.name, u.email, gm.role, gm.joined_at
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ?
      ORDER BY gm.joined_at ASC
      `
    )
    .all(groupId);
  const invite = db
    .prepare(
      "SELECT * FROM invites WHERE group_id = ? ORDER BY created_at DESC LIMIT 1"
    )
    .get(groupId);

  const role = getMemberRole(user.id, groupId);
  const canEditRules = role === "owner" || role === "admin";
  const groupRules = getGroupRulesText(group, locale);
  res.render("group", {
    user,
    group,
    members,
    invite,
    role,
    canEditRules,
    groupRules,
    error: null,
    success: null
  });
});

app.post("/groups/:id/invites", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const groupId = Number(req.params.id);
  if (!isGroupAdmin(user.id, groupId)) {
    return sendError(req, res, 403, "Admin access only.");
  }

  db.prepare("DELETE FROM invites WHERE group_id = ?").run(groupId);
  const code = crypto.randomBytes(4).toString("hex");
  db.prepare(
    "INSERT INTO invites (group_id, code, created_at, created_by) VALUES (?, ?, ?, ?)"
  ).run(groupId, code, new Date().toISOString(), user.id);

  res.redirect(`/groups/${groupId}`);
});

app.post("/groups/:id/invites/remove", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const groupId = Number(req.params.id);
  if (!isGroupAdmin(user.id, groupId)) {
    return sendError(req, res, 403, "Admin access only.");
  }
  db.prepare("DELETE FROM invites WHERE group_id = ?").run(groupId);
  res.redirect(`/groups/${groupId}`);
});

app.get("/join/:code", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const code = req.params.code.trim();
  const invite = db
    .prepare("SELECT * FROM invites WHERE code = ?")
    .get(code);
  if (!invite) {
    return sendError(req, res, 404, "Invite not found.");
  }
  if (isMember(user.id, invite.group_id)) {
    return res.redirect(`/groups/${invite.group_id}`);
  }
  const group = db
    .prepare("SELECT * FROM groups WHERE id = ?")
    .get(invite.group_id);
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
  res.render("join_confirm", { user, group, members, code, error: null });
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
    return res.redirect(`/groups/${invite.group_id}`);
  }
  const group = db
    .prepare("SELECT * FROM groups WHERE id = ?")
    .get(invite.group_id);
  if (!group) {
    return sendError(req, res, 404, "Group not found.");
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

  res.redirect(`/groups/${invite.group_id}`);
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

app.get("/groups/:id/questions", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const locale = res.locals.locale || DEFAULT_LOCALE;
  const groupId = Number(req.params.id);
  if (!isMember(user.id, groupId)) {
    return sendError(req, res, 403, "Not a group member.");
  }

  const group = db.prepare("SELECT * FROM groups WHERE id = ?").get(groupId);
  if (!group) {
    return sendError(req, res, 404, "Group not found.");
  }
  const questions = getQuestions(locale);
  const roster = getRoster();
  const races = getRaces();
  const currentAnswers = getResponsesByGroup(user.id, groupId);
  const copyGroups = getCopySourceGroups(user.id, groupId);
  const requestedCopyGroupId = Number(req.query.copyFrom || 0);
  let selectedCopyGroupId = null;
  let prefillNotice = null;
  let answers = currentAnswers;

  if (requestedCopyGroupId > 0) {
    const sourceGroup = copyGroups.find((row) => row.id === requestedCopyGroupId);
    if (sourceGroup) {
      selectedCopyGroupId = sourceGroup.id;
      const sourceAnswers = getResponsesByGroup(user.id, sourceGroup.id);
      if (Object.keys(sourceAnswers).length > 0) {
        answers = sourceAnswers;
        prefillNotice = translate(locale, "questions.prefilled_from_group", {
          group_name: sourceGroup.name
        });
      } else {
        prefillNotice = translate(locale, "questions.no_saved_predictions", {
          group_name: sourceGroup.name
        });
      }
    }
  } else if (Object.keys(currentAnswers).length === 0) {
    const globalGroup = copyGroups.find((row) => row.is_global === 1);
    if (globalGroup) {
      const globalAnswers = getResponsesByGroup(user.id, globalGroup.id);
      if (Object.keys(globalAnswers).length > 0) {
        answers = globalAnswers;
        prefillNotice = translate(locale, "questions.prefilled_from_group", {
          group_name: globalGroup.name
        });
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
    copyGroups,
    selectedCopyGroupId,
    prefillNotice,
    roster,
    races,
    closed,
    closeAt: PREDICTIONS_CLOSE_AT
  });
});

app.post("/groups/:id/questions", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const groupId = Number(req.params.id);
  if (!isMember(user.id, groupId)) {
    return sendError(req, res, 403, "Not a group member.");
  }
  const group = db.prepare("SELECT * FROM groups WHERE id = ?").get(groupId);
  if (!group) {
    return sendError(req, res, 404, "Group not found.");
  }

  if (predictionsClosed()) {
    return sendError(req, res, 403, "Predictions are closed.");
  }

  const questions = getQuestions();
  const now = new Date().toISOString();
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
      const type = question.type || "text";
      if (type === "ranking") {
        const count = Number(question.count) || 3;
        const selections = [];
        for (let i = 1; i <= count; i += 1) {
          const value = req.body[`${question.id}_${i}`];
          if (!value) continue;
          if (!selections.includes(value)) {
            selections.push(value);
          }
        }
        if (selections.length === 0) continue;
        insert.run(
          user.id,
          groupId,
          question.id,
          JSON.stringify(selections),
          now,
          now
        );
        continue;
      }
      if (type === "multi_select" || type === "multi_select_limited") {
        const selected = req.body[question.id];
        if (!selected) continue;
        const selections = Array.isArray(selected) ? selected : [selected];
        insert.run(
          user.id,
          groupId,
          question.id,
          JSON.stringify(selections),
          now,
          now
        );
        continue;
      }
      if (type === "teammate_battle") {
        const winner = req.body[`${question.id}_winner`];
        const diffRaw = req.body[`${question.id}_diff`];
        if ((!winner || winner === "") && (diffRaw === "" || diffRaw === undefined)) {
          continue;
        }
        const diff = winner === "tie" ? null : clampNumber(diffRaw, 0, 999);
        insert.run(
          user.id,
          groupId,
          question.id,
          JSON.stringify({ winner, diff }),
          now,
          now
        );
        continue;
      }
      if (type === "boolean_with_optional_driver") {
        const choice = req.body[question.id];
        const driver = req.body[`${question.id}_driver`];
        if (!choice) continue;
        insert.run(
          user.id,
          groupId,
          question.id,
          JSON.stringify({ choice, driver }),
          now,
          now
        );
        continue;
      }
      if (type === "numeric_with_driver") {
        const valueRaw = req.body[`${question.id}_value`];
        const driver = req.body[`${question.id}_driver`];
        if ((valueRaw === "" || valueRaw === undefined) && (!driver || driver === "")) {
          continue;
        }
        const value = clampNumber(valueRaw, 0, 999);
        insert.run(
          user.id,
          groupId,
          question.id,
          JSON.stringify({ value, driver }),
          now,
          now
        );
        continue;
      }
      if (type === "single_choice_with_driver") {
        const value = req.body[`${question.id}_value`];
        const driver = req.body[`${question.id}_driver`];
        if ((!value || value === "") && (!driver || driver === "")) {
          continue;
        }
        insert.run(
          user.id,
          groupId,
          question.id,
          JSON.stringify({ value, driver }),
          now,
          now
        );
        continue;
      }

      const answer = req.body[question.id];
      if (answer === undefined || answer === "") continue;
      if (type === "numeric") {
        const value = clampNumber(answer, 0, 999);
        if (value == null) continue;
        insert.run(user.id, groupId, question.id, String(value), now, now);
        continue;
      }
      insert.run(user.id, groupId, question.id, String(answer).trim(), now, now);
    }
  });
  tx();

  // First group submission can seed the Global league as a baseline.
  if (!group.is_global) {
    const globalGroup = getGlobalGroup();
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

  res.redirect(`/groups/${groupId}/questions`);
});

app.get("/groups/:id/responses", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const locale = res.locals.locale || DEFAULT_LOCALE;
  const groupId = Number(req.params.id);
  if (!isMember(user.id, groupId)) {
    return sendError(req, res, 403, "Not a group member.");
  }
  const group = db.prepare("SELECT * FROM groups WHERE id = ?").get(groupId);
  const questions = getQuestions(locale);
  const responses = db
    .prepare(
      `
      SELECT u.name as user_name, r.question_id, r.answer, r.updated_at
      FROM responses r
      JOIN users u ON u.id = r.user_id
      WHERE r.group_id = ?
      ORDER BY u.name ASC, r.question_id ASC
      `
    )
    .all(groupId);

  res.render("responses", { user, group, questions, responses });
});

app.get("/groups/:id/leaderboard", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const locale = res.locals.locale || DEFAULT_LOCALE;
  const adminAccess = isAdmin(req);
  if (!LEADERBOARD_ENABLED && !adminAccess) {
    return sendError(
      req,
      res,
      404,
      "Leaderboard is not available yet. It will be enabled after season results are finalized."
    );
  }
  const groupId = Number(req.params.id);
  if (!adminAccess && !isMember(user.id, groupId)) {
    return sendError(req, res, 403, "Not a group member.");
  }

  const group = db.prepare("SELECT * FROM groups WHERE id = ?").get(groupId);
  const questions = getQuestions(locale);
  const actualRows = db.prepare("SELECT * FROM actuals").all();
  const actuals = actualRows.reduce((acc, row) => {
    acc[row.question_id] = row.value;
    return acc;
  }, {});

  const responses = db
    .prepare(
      `
      SELECT u.id as user_id, u.name as user_name, r.question_id, r.answer
      FROM responses r
      JOIN users u ON u.id = r.user_id
      WHERE r.group_id = ?
      `
    )
    .all(groupId);

  const questionMap = questions.reduce((acc, q) => {
    acc[q.id] = q;
    return acc;
  }, {});

  const scoreByUser = {};
  const members = db
    .prepare(
      `
      SELECT u.id as user_id, u.name as user_name
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ?
      `
    )
    .all(groupId);

  members.forEach((member) => {
    scoreByUser[member.user_id] = {
      userId: member.user_id,
      name: member.user_name,
      total: 0,
      byQuestion: {}
    };
  });

  function parseStoredValue(question, raw) {
    if (!raw) return null;
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
        if (String(actualValue) === String(predictedValue)) {
          score += Number(points.position || 0);
        }
      }
      if (actualDriver && predictedDriver && actualDriver === predictedDriver) {
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
    scoreByUser[row.user_id].total += points;
    scoreByUser[row.user_id].byQuestion[row.question_id] = points;
  });

  const leaderboard = Object.values(scoreByUser).sort((a, b) => b.total - a.total);
  res.render("leaderboard", {
    user,
    group,
    questions,
    leaderboard,
    actuals
  });
});

registerAdminRoutes(app, {
  db,
  requireAdmin,
  getCurrentUser,
  getQuestions,
  getRoster,
  getRaces,
  clampNumber
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
