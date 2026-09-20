import { db } from './db.js';

const insertUsageStmt = db.prepare(`
  INSERT OR IGNORE INTO usage (kind, action, item_id, item_name, animated, user_id, message_id, created_at)
  VALUES (@kind, @action, @itemId, @itemName, @animated, @userId, @messageId, @createdAt)
`);

export function recordUsage(record) {
  insertUsageStmt.run({
    kind: record.kind,
    action: record.action,
    itemId: record.itemId,
    itemName: record.itemName,
    animated: record.animated ? 1 : 0,
    userId: record.userId,
    messageId: record.messageId,
    createdAt: record.createdAt ?? Math.floor(Date.now() / 1000),
  });
}

const deleteReactionStmt = db.prepare(`
  DELETE FROM usage
  WHERE message_id = ? AND item_id = ? AND user_id = ? AND action = ?
`);

export function removeReactionUsage({ itemId, userId, messageId, action }) {
  deleteReactionStmt.run(messageId, itemId, userId, action);
}

const deleteMessageStmt = db.prepare(`DELETE FROM usage WHERE message_id = ?`);

export function removeMessageUsage(messageId) {
  deleteMessageStmt.run(messageId);
}

const itemCountsStmt = db.prepare(`
  SELECT item_id AS itemId, COUNT(*) AS count
  FROM usage
  WHERE kind = ? AND created_at >= ? AND action IN ('message', 'reaction_sent')
  GROUP BY item_id
`);

export function getItemCounts({ kind, since }) {
  return itemCountsStmt.all(kind, since);
}

const userCountsStmt = db.prepare(`
  SELECT user_id AS userId, COUNT(*) AS count
  FROM usage
  WHERE kind = ? AND created_at >= ? AND action IN ('message', 'reaction_sent')
  GROUP BY user_id
  ORDER BY count DESC
`);

export function getUserCounts({ kind, since }) {
  return userCountsStmt.all(kind, since);
}

const userBreakdownStmt = db.prepare(`
  SELECT item_id AS itemId, item_name AS itemName, animated, COUNT(*) AS count
  FROM usage
  WHERE kind = ? AND user_id = ? AND created_at >= ? AND action IN ('message', 'reaction_sent')
  GROUP BY item_id
  ORDER BY count DESC
  LIMIT ?
`);

export function getUserBreakdown({ kind, userId, since, limit = 12 }) {
  return userBreakdownStmt.all(kind, userId, since, limit);
}

export function getItemLeaderboard({ kind, itemId, direction, since, limit = 10 }) {
  const actions = direction === 'received' ? ['reaction_received'] : ['message', 'reaction_sent'];
  const placeholders = actions.map(() => '?').join(',');
  return db
    .prepare(
      `
      SELECT user_id AS userId, COUNT(*) AS count
      FROM usage
      WHERE kind = ? AND item_id = ? AND created_at >= ? AND action IN (${placeholders})
      GROUP BY user_id
      ORDER BY count DESC
      LIMIT ?
    `
    )
    .all(kind, itemId, since, ...actions, limit);
}
