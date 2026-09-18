import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';

const resolvedPath = path.resolve(process.cwd(), config.dbPath);
fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

export const db = new Database(resolvedPath);
db.pragma('journal_mode = WAL');

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
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_usage_kind_created ON usage(kind, created_at);
  CREATE INDEX IF NOT EXISTS idx_usage_item ON usage(kind, item_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_usage_user ON usage(user_id, kind, created_at);
  CREATE INDEX IF NOT EXISTS idx_usage_message ON usage(message_id);
`);
