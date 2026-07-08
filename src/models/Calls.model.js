const pool = require('./db');

module.exports.logCall = async function logCall({
  callerId,
  calleeId,
  callType,
  status,
  durationSec = 0,
}) {
  const { rows } = await pool.query(
    `INSERT INTO "CallLogs" (caller_id, callee_id, call_type, status, duration_sec)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, caller_id, callee_id, call_type, status, duration_sec, created_at`,
    [callerId, calleeId, callType || 'voice', status, durationSec],
  );
  return rows[0];
};

module.exports.listForUser = async function listForUser(userId, limit = 50) {
  const { rows } = await pool.query(
    `SELECT c.id, c.caller_id, c.callee_id, c.call_type, c.status, c.duration_sec, c.created_at,
            caller.name AS caller_name, caller.display_name AS caller_display,
            callee.name AS callee_name, callee.display_name AS callee_display
     FROM "CallLogs" c
     JOIN "Person" caller ON caller.id = c.caller_id
     JOIN "Person" callee ON callee.id = c.callee_id
     WHERE c.caller_id = $1 OR c.callee_id = $1
     ORDER BY c.created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    call_type: r.call_type,
    status: r.status,
    duration_sec: r.duration_sec,
    created_at: r.created_at,
    direction: r.caller_id === userId ? 'outgoing' : 'incoming',
    peer_id: r.caller_id === userId ? r.callee_id : r.caller_id,
    peer_name:
      r.caller_id === userId
        ? r.callee_display || r.callee_name
        : r.caller_display || r.caller_name,
  }));
};
