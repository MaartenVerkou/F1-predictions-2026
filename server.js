const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const bcrypt = require("bcrypt");
const Database = require("better-sqlite3");

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "app.db");
const QUESTIONS_PATH = process.env.QUESTIONS_PATH || path.join(DATA_DIR, "questions.json");
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-only-change-me";

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
`);

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

function getQuestions() {
  if (!fs.existsSync(QUESTIONS_PATH)) {
    return [
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
  }

  try {
    const raw = fs.readFileSync(QUESTIONS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed && Array.isArray(parsed.questions)) {
      return parsed.questions;
    }
  } catch (err) {
    console.error("Failed to read questions:", err);
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
  const stmt = db.prepare("SELECT id, name, email FROM users WHERE id = ?");
  return stmt.get(req.session.userId) || null;
}

function isMember(userId, groupId) {
  const stmt = db.prepare(
    "SELECT 1 FROM group_members WHERE user_id = ? AND group_id = ?"
  );
  return !!stmt.get(userId, groupId);
}

app.get("/", (req, res) => {
  const user = getCurrentUser(req);
  res.render("home", { user });
});

app.get(["/signup", "/register"], (req, res) => {
  res.render("signup", { error: null });
});

app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.render("signup", { error: "All fields are required." });
  }

  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(email.trim().toLowerCase());
  if (existing) {
    return res.render("signup", { error: "Email already registered." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const stmt = db.prepare(
    "INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)"
  );
  const info = stmt.run(
    name.trim(),
    email.trim().toLowerCase(),
    passwordHash,
    new Date().toISOString()
  );
  req.session.userId = info.lastInsertRowid;
  res.redirect("/dashboard");
});

app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.render("login", { error: "Email and password required." });
  }
  const user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.trim().toLowerCase());
  if (!user) {
    return res.render("login", { error: "Invalid credentials." });
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.render("login", { error: "Invalid credentials." });
  }
  req.session.userId = user.id;
  res.redirect("/dashboard");
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.get("/dashboard", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
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

  res.render("dashboard", { user, groups });
});

app.post("/groups", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const { name } = req.body;
  if (!name) {
    return res.redirect("/dashboard");
  }
  const now = new Date().toISOString();
  const groupInfo = db
    .prepare(
      "INSERT INTO groups (name, owner_id, created_at) VALUES (?, ?, ?)"
    )
    .run(name.trim(), user.id, now);
  db.prepare(
    "INSERT INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, ?, ?)"
  ).run(user.id, groupInfo.lastInsertRowid, "owner", now);

  res.redirect(`/groups/${groupInfo.lastInsertRowid}`);
});

app.get("/groups/:id", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const groupId = Number(req.params.id);
  if (!isMember(user.id, groupId)) {
    return res.status(403).send("Not a group member.");
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
  const invites = db
    .prepare(
      "SELECT * FROM invites WHERE group_id = ? ORDER BY created_at DESC"
    )
    .all(groupId);

  res.render("group", { user, group, members, invites });
});

app.post("/groups/:id/invites", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const groupId = Number(req.params.id);
  if (!isMember(user.id, groupId)) {
    return res.status(403).send("Not a group member.");
  }

  const code = crypto.randomBytes(4).toString("hex");
  db.prepare(
    "INSERT INTO invites (group_id, code, created_at, created_by) VALUES (?, ?, ?, ?)"
  ).run(groupId, code, new Date().toISOString(), user.id);

  res.redirect(`/groups/${groupId}`);
});

app.get("/join/:code", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const code = req.params.code.trim();
  const invite = db
    .prepare("SELECT * FROM invites WHERE code = ?")
    .get(code);
  if (!invite) {
    return res.status(404).send("Invite not found.");
  }
  if (isMember(user.id, invite.group_id)) {
    return res.redirect(`/groups/${invite.group_id}`);
  }
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, ?, ?)"
  ).run(user.id, invite.group_id, "member", now);

  res.redirect(`/groups/${invite.group_id}`);
});

app.get("/groups/:id/questions", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const groupId = Number(req.params.id);
  if (!isMember(user.id, groupId)) {
    return res.status(403).send("Not a group member.");
  }

  const group = db.prepare("SELECT * FROM groups WHERE id = ?").get(groupId);
  const questions = getQuestions();
  const answers = db
    .prepare(
      "SELECT question_id, answer FROM responses WHERE user_id = ? AND group_id = ?"
    )
    .all(user.id, groupId)
    .reduce((acc, row) => {
      acc[row.question_id] = row.answer;
      return acc;
    }, {});

  res.render("questions", { user, group, questions, answers });
});

app.post("/groups/:id/questions", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const groupId = Number(req.params.id);
  if (!isMember(user.id, groupId)) {
    return res.status(403).send("Not a group member.");
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
      const answer = req.body[question.id];
      if (!answer) continue;
      insert.run(user.id, groupId, question.id, String(answer).trim(), now, now);
    }
  });
  tx();

  res.redirect(`/groups/${groupId}/questions`);
});

app.get("/groups/:id/responses", requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const groupId = Number(req.params.id);
  if (!isMember(user.id, groupId)) {
    return res.status(403).send("Not a group member.");
  }
  const group = db.prepare("SELECT * FROM groups WHERE id = ?").get(groupId);
  const questions = getQuestions();
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

app.use((req, res) => {
  res.status(404).render("404");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
