import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';

const resolvedPath = path.resolve(process.cwd(), config.dbPath);
fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

export const db = new Database(resolvedPath);
db.pragma('journal_mode = WAL');

// actor_id: for reaction_received rows, the user who reacted; '' for every other action.
db.exec(`
  CREATE TABLE IF NOT EXISTS usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK(kind IN ('emoji','sticker')),
    action TEXT NOT NULL CHECK(action IN ('message','reaction_sent','reaction_received')),
    item_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    animated INTEGER NOT NULL DEFAULT 0,
    user_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    actor_id TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_usage_kind_created ON usage(kind, created_at);
  CREATE INDEX IF NOT EXISTS idx_usage_item ON usage(kind, item_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_usage_user ON usage(user_id, kind, created_at);
  CREATE INDEX IF NOT EXISTS idx_usage_message ON usage(message_id);

  -- Aggregate-only word counts for /wordcloud: no message_id or user_id, just
  -- how many times a word was seen on a given UTC day. Old days are pruned below.
  CREATE TABLE IF NOT EXISTS word_counts (
    word TEXT NOT NULL,
    day TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (word, day)
  );

  CREATE INDEX IF NOT EXISTS idx_word_counts_day ON word_counts(day);
`);

const WORD_COUNT_RETENTION_DAYS = 9;
const cutoffDay = new Date(Date.now() - WORD_COUNT_RETENTION_DAYS * 86400 * 1000).toISOString().slice(0, 10);
db.prepare('DELETE FROM word_counts WHERE day < ?').run(cutoffDay);

const hasColumn = (name) =>
  db
    .prepare('PRAGMA table_info(usage)')
    .all()
    .some((column) => column.name === name);

const hasIndex = (name) =>
  Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?").get(name));

function createUniqueIndex() {
  db.exec(`
    DELETE FROM usage
    WHERE id NOT IN (
      SELECT MIN(id) FROM usage GROUP BY kind, action, item_id, user_id, message_id, actor_id
    );
    CREATE UNIQUE INDEX idx_usage_unique
      ON usage(kind, action, item_id, user_id, message_id, actor_id);
  `);
}

if (!hasColumn('actor_id')) {
  // Old received rows were capped at one per message and don't say who reacted, so drop them
  // and rebuild one per reactor from the reaction_sent rows.
  db.transaction(() => {
    db.exec(`
      ALTER TABLE usage ADD COLUMN actor_id TEXT NOT NULL DEFAULT '';

      CREATE TEMP TABLE message_authors AS
        SELECT DISTINCT message_id, user_id FROM usage WHERE action = 'reaction_received';

      DELETE FROM usage WHERE action = 'reaction_received';
      DROP INDEX IF EXISTS idx_usage_unique;
    `);

    createUniqueIndex();

    db.exec(`
      INSERT OR IGNORE INTO usage
        (kind, action, item_id, item_name, animated, user_id, message_id, actor_id, created_at)
      SELECT s.kind, 'reaction_received', s.item_id, s.item_name, s.animated,
             a.user_id, s.message_id, s.user_id, s.created_at
      FROM usage s
      JOIN message_authors a ON a.message_id = s.message_id
      WHERE s.action = 'reaction_sent' AND s.user_id != a.user_id;

      DROP TABLE message_authors;
    `);
  })();
} else if (!hasIndex('idx_usage_unique')) {
  db.transaction(createUniqueIndex)();
}
