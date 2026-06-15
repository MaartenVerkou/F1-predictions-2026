"use strict";

const session = require("express-session");
const Database = require("better-sqlite3");

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const DEFAULT_PRUNE_INTERVAL_MS = 1000 * 60 * 15;

class BetterSqliteSessionStore extends session.Store {
  constructor(options = {}) {
    super();
    if (!options.filename) {
      throw new Error("BetterSqliteSessionStore requires a filename option.");
    }
    this.ttlMs = Number(options.ttlMs || DEFAULT_TTL_MS);
    this.db = new Database(options.filename);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("busy_timeout = 5000");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        expired INTEGER,
        sess TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions (expired);
    `);
    this.statements = {
      get: this.db.prepare("SELECT sess, expired FROM sessions WHERE sid = ?"),
      upsert: this.db.prepare(`
        INSERT INTO sessions (sid, expired, sess)
        VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET
          expired = excluded.expired,
          sess = excluded.sess
      `),
      touch: this.db.prepare("UPDATE sessions SET expired = ? WHERE sid = ?"),
      destroy: this.db.prepare("DELETE FROM sessions WHERE sid = ?"),
      clear: this.db.prepare("DELETE FROM sessions"),
      prune: this.db.prepare("DELETE FROM sessions WHERE expired <= ?"),
      count: this.db.prepare("SELECT COUNT(*) AS count FROM sessions WHERE expired > ?"),
      all: this.db.prepare("SELECT sess, expired FROM sessions WHERE expired > ?")
    };
    this.pruneExpired();
    const pruneIntervalMs = Number(options.pruneIntervalMs ?? DEFAULT_PRUNE_INTERVAL_MS);
    if (Number.isFinite(pruneIntervalMs) && pruneIntervalMs > 0) {
      this.pruneTimer = setInterval(() => this.pruneExpired(), pruneIntervalMs);
      this.pruneTimer.unref?.();
    }
  }

  get(sid, callback) {
    try {
      const row = this.statements.get.get(sid);
      if (!row) return callback(null, null);
      if (Number(row.expired) <= Date.now()) {
        this.statements.destroy.run(sid);
        return callback(null, null);
      }
      return callback(null, JSON.parse(row.sess));
    } catch (err) {
      return callback(err);
    }
  }

  set(sid, sess, callback = () => {}) {
    try {
      this.statements.upsert.run(sid, this.getExpiry(sess), JSON.stringify(sess));
      return callback(null);
    } catch (err) {
      return callback(err);
    }
  }

  touch(sid, sess, callback = () => {}) {
    try {
      this.statements.touch.run(this.getExpiry(sess), sid);
      return callback(null);
    } catch (err) {
      return callback(err);
    }
  }

  destroy(sid, callback = () => {}) {
    try {
      this.statements.destroy.run(sid);
      return callback(null);
    } catch (err) {
      return callback(err);
    }
  }

  clear(callback = () => {}) {
    try {
      this.statements.clear.run();
      return callback(null);
    } catch (err) {
      return callback(err);
    }
  }

  length(callback) {
    try {
      const row = this.statements.count.get(Date.now());
      return callback(null, Number(row?.count || 0));
    } catch (err) {
      return callback(err);
    }
  }

  all(callback) {
    try {
      const sessions = this.statements.all
        .all(Date.now())
        .map((row) => JSON.parse(row.sess));
      return callback(null, sessions);
    } catch (err) {
      return callback(err);
    }
  }

  close() {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
    this.db.close();
  }

  pruneExpired() {
    this.statements.prune.run(Date.now());
  }

  getExpiry(sess) {
    const rawExpires = sess?.cookie?.expires;
    const parsed = rawExpires ? new Date(rawExpires).getTime() : NaN;
    if (Number.isFinite(parsed)) return parsed;
    return Date.now() + this.ttlMs;
  }
}

module.exports = {
  BetterSqliteSessionStore
};
