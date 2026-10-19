-- PinPlan 初始 schema
-- 版本 1：项目 / 计划 / BUG / 时间线 / 巡检 / 设置

CREATE TABLE IF NOT EXISTS project (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  color      TEXT    DEFAULT '#6366F1',
  sort       INTEGER DEFAULT 0,
  archived   INTEGER DEFAULT 0,
  created_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS plan (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER REFERENCES project(id) ON DELETE SET NULL,
  title       TEXT    NOT NULL,
  detail      TEXT    DEFAULT '',
  status      TEXT    NOT NULL DEFAULT 'draft',
  priority    INTEGER DEFAULT 1,
  expect      TEXT    DEFAULT '',
  result      TEXT    DEFAULT '',
  lesson      TEXT    DEFAULT '',
  tags        TEXT    DEFAULT '[]',
  refs        TEXT    DEFAULT '[]',
  pinned      INTEGER DEFAULT 0,
  sort        INTEGER DEFAULT 0,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL,
  started_at  TEXT,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS bug (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER REFERENCES project(id) ON DELETE SET NULL,
  plan_id     INTEGER REFERENCES plan(id) ON DELETE SET NULL,
  title       TEXT    NOT NULL,
  repro       TEXT    DEFAULT '',
  severity    TEXT    DEFAULT 'normal',
  status      TEXT    DEFAULT 'open',
  fix_note    TEXT    DEFAULT '',
  fix_commit  TEXT    DEFAULT '',
  fixed_at    TEXT,
  tags        TEXT    DEFAULT '[]',
  refs        TEXT    DEFAULT '[]',
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS event (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  entity     TEXT    NOT NULL,
  entity_id  INTEGER NOT NULL,
  kind       TEXT    NOT NULL,
  from_value TEXT,
  to_value   TEXT,
  note       TEXT,
  created_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS checkin (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entity      TEXT,
  entity_id   INTEGER,
  question    TEXT,
  answer      TEXT,
  answered_at TEXT,
  created_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS setting (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plan_status  ON plan(status);
CREATE INDEX IF NOT EXISTS idx_plan_updated ON plan(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_status   ON bug(status);
CREATE INDEX IF NOT EXISTS idx_event_ref    ON event(entity, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_event_time   ON event(created_at DESC);
