const pool = require('./db');

(async function migrateFriendsSchema() {
  try {
    await pool.query(`ALTER TABLE "FriendRequests" ADD COLUMN IF NOT EXISTS message TEXT`);
    await pool.query(
      `ALTER TABLE "UserFriends" ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE`,
    );
  } catch {
    /* tables may not exist yet (test setup) */
  }
})();

function avatarColor(id) {
  const colors = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ec4899', '#06b6d4'];
  return colors[id % colors.length];
}

function formatUser(row, extra = {}) {
  let skills = row.skills;
  if (typeof skills === 'string') {
    try {
      skills = JSON.parse(skills);
    } catch {
      skills = [];
    }
  }
  if (!Array.isArray(skills)) skills = [];

  return {
    id: row.id,
    name: row.name,
    username: row.name,
    display_name: row.display_name || row.name,
    email: row.email,
    avatar: row.avatar,
    profile_image: row.profile_image,
    cover_image: row.cover_image || null,
    bio: row.bio || '',
    headline: row.headline || '',
    location: row.location || '',
    skills,
    link_portfolio: row.link_portfolio || '',
    link_github: row.link_github || '',
    link_linkedin: row.link_linkedin || '',
    avatar_color: avatarColor(row.id),
    ...extra,
  };
}

async function getRelationshipMeta(viewerId, targetId) {
  if (viewerId === targetId) return { relationship: 'self', request_id: null };

  const { rows } = await pool.query(
    `SELECT id, sender_id, receiver_id, status FROM "FriendRequests"
     WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
     ORDER BY created_at DESC LIMIT 1`,
    [viewerId, targetId],
  );

  if (rows.length === 0) {
    const friend = await pool.query(
      `SELECT 1 FROM "UserFriends" WHERE user_id = $1 AND friend_id = $2`,
      [viewerId, targetId],
    );
    if (friend.rows.length > 0) return { relationship: 'friends', request_id: null };
    return { relationship: 'none', request_id: null };
  }

  const req = rows[0];
  if (req.status === 'accepted') return { relationship: 'friends', request_id: req.id };
  if (req.status === 'declined') return { relationship: 'none', request_id: null };
  if (req.status === 'pending') {
    return {
      relationship: req.sender_id === viewerId ? 'pending_sent' : 'pending_received',
      request_id: req.id,
    };
  }
  return { relationship: 'none', request_id: null };
}

async function getRelationship(viewerId, targetId) {
  const meta = await getRelationshipMeta(viewerId, targetId);
  return meta.relationship;
}

async function mutualFriendsCount(userId, otherId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM "UserFriends" a
     JOIN "UserFriends" b ON a.friend_id = b.friend_id
     WHERE a.user_id = $1 AND b.user_id = $2`,
    [userId, otherId],
  );
  return rows[0]?.count ?? 0;
}

module.exports.searchUsers = async function searchUsers(viewerId, query) {
  const prefix = `${query.trim()}%`;
  const wordPrefix = `% ${query.trim()}%`;
  const substr = `%${query.trim()}%`;
  const { rows } = await pool.query(
    `SELECT id, name, display_name, email, avatar, profile_image, bio
     FROM "Person"
     WHERE role = 'user' AND is_active = TRUE AND deleted_at IS NULL
       AND id != $1
       AND ((name ILIKE $2 OR name ILIKE $3 OR COALESCE(display_name, '') ILIKE $2 OR COALESCE(display_name, '') ILIKE $3) OR email ILIKE $4)
     ORDER BY name
     LIMIT 20`,
    [viewerId, prefix, wordPrefix, substr],
  );

  const results = [];
  for (const row of rows) {
    const { relationship, request_id: requestId } = await getRelationshipMeta(viewerId, row.id);
    const mutual = await mutualFriendsCount(viewerId, row.id);
    results.push(formatUser(row, { relationship, request_id: requestId, mutual_friends: mutual }));
  }
  return results;
};

module.exports.getPublicProfile = async function getPublicProfile(viewerId, targetId) {
  const { rows } = await pool.query(
    `SELECT id, name, display_name, email, avatar, profile_image, cover_image, bio,
            headline, location, skills, link_portfolio, link_github, link_linkedin, created_at
     FROM "Person" WHERE id = $1 AND role = 'user' AND deleted_at IS NULL`,
    [targetId],
  );
  if (rows.length === 0) return null;

  const relationship = await getRelationship(viewerId, targetId);
  const mutual_friends = await mutualFriendsCount(viewerId, targetId);

  let isPrivate = false;
  if (relationship === 'none') {
    const { rows: settingsRows } = await pool.query(
      `SELECT public_profile FROM "UserSettings" WHERE user_id = $1`,
      [targetId],
    );
    if (settingsRows.length > 0 && settingsRows[0].public_profile === false) {
      isPrivate = true;
    }
  }

  return {
    ...formatUser(rows[0], { relationship, mutual_friends, is_private: isPrivate }),
    member_since: rows[0].created_at,
  };
};

module.exports.listFriends = async function listFriends(userId, sortBy) {
  let orderClause = 'p.name';
  if (sortBy === 'recent') orderClause = 'friends_since DESC NULLS LAST';
  else if (sortBy === 'group')
    orderClause =
      '(SELECT COUNT(*) FROM "GroupMembers" g1 JOIN "GroupMembers" g2 ON g1.group_id = g2.group_id WHERE g1.user_id = uf.user_id AND g2.user_id = uf.friend_id) DESC';

  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.display_name, p.email, p.avatar, p.profile_image, p.bio,
            uf.friend_id, uf.is_favorite, fr.created_at AS friends_since
     FROM "UserFriends" uf
     JOIN "Person" p ON p.id = uf.friend_id
     LEFT JOIN "FriendRequests" fr ON fr.status = 'accepted'
       AND ((fr.sender_id = uf.user_id AND fr.receiver_id = uf.friend_id)
         OR (fr.sender_id = uf.friend_id AND fr.receiver_id = uf.user_id))
     WHERE uf.user_id = $1
     ORDER BY uf.is_favorite DESC, ${orderClause}`,
    [userId],
  );
  return rows.map((r) =>
    formatUser(r, {
      relationship: 'friends',
      is_favorite: r.is_favorite,
      friends_since: r.friends_since,
      mutual_friends: 0,
    }),
  );
};

module.exports.listRequests = async function listRequests(userId, tab) {
  const isReceived = tab === 'received';
  const { rows } = await pool.query(
    `SELECT fr.id, fr.sender_id, fr.receiver_id, fr.message, fr.created_at,
            p.id AS person_id, p.name, p.display_name, p.avatar, p.profile_image, p.bio
     FROM "FriendRequests" fr
     JOIN "Person" p ON p.id = ${isReceived ? 'fr.sender_id' : 'fr.receiver_id'}
     WHERE fr.status = 'pending' AND ${isReceived ? 'fr.receiver_id' : 'fr.sender_id'} = $1
     ORDER BY fr.created_at DESC`,
    [userId],
  );

  return rows.map((r) => ({
    request_id: r.id,
    message: r.message,
    created_at: r.created_at,
    user: formatUser({
      id: r.person_id,
      name: r.name,
      display_name: r.display_name,
      avatar: r.avatar,
      profile_image: r.profile_image,
      bio: r.bio,
      email: '',
    }),
  }));
};

module.exports.sendRequest = async function sendRequest(senderId, receiverId, message) {
  if (senderId === receiverId)
    throw Object.assign(new Error('Cannot add yourself.'), { status: 400 });

  const rel = await getRelationship(senderId, receiverId);
  if (rel === 'friends') throw Object.assign(new Error('Already friends.'), { status: 409 });
  if (rel === 'pending_sent')
    throw Object.assign(new Error('Request already sent.'), { status: 409 });
  if (rel === 'pending_received') {
    throw Object.assign(new Error('They already sent you a request — accept it instead.'), {
      status: 409,
    });
  }

  const { rows } = await pool.query(
    `INSERT INTO "FriendRequests" (sender_id, receiver_id, status, message)
     VALUES ($1, $2, 'pending', $3)
     ON CONFLICT (sender_id, receiver_id) DO UPDATE SET status = 'pending', created_at = NOW(), message = COALESCE($3, "FriendRequests".message)
     RETURNING id`,
    [senderId, receiverId, message || null],
  );

  const sender = await pool.query(`SELECT name, display_name FROM "Person" WHERE id = $1`, [
    senderId,
  ]);
  const senderName = sender.rows[0]?.display_name || sender.rows[0]?.name || 'Someone';
  try {
    const Notification = require('./Notification.model');
    await Notification.create(receiverId, {
      type: 'friend_request',
      title: 'Friend request',
      body: `${senderName} wants to be friends`,
      ref_id: rows[0].id,
    });
  } catch {
    /* optional in tests */
  }

  return rows[0];
};

async function addFriendship(userA, userB) {
  await pool.query(
    `INSERT INTO "UserFriends" (user_id, friend_id) VALUES ($1, $2), ($2, $1)
     ON CONFLICT DO NOTHING`,
    [userA, userB],
  );
}

module.exports.acceptRequest = async function acceptRequest(userId, requestId) {
  const { rows } = await pool.query(
    `SELECT * FROM "FriendRequests" WHERE id = $1 AND receiver_id = $2 AND status = 'pending'`,
    [requestId, userId],
  );
  if (rows.length === 0) throw Object.assign(new Error('Request not found.'), { status: 404 });

  const req = rows[0];
  await pool.query(`UPDATE "FriendRequests" SET status = 'accepted' WHERE id = $1`, [requestId]);
  await addFriendship(req.sender_id, req.receiver_id);
  return req;
};

module.exports.declineRequest = async function declineRequest(userId, requestId) {
  const { rows } = await pool.query(
    `SELECT * FROM "FriendRequests"
     WHERE id = $1 AND status = 'pending'
       AND (receiver_id = $2 OR sender_id = $2)`,
    [requestId, userId],
  );
  if (rows.length === 0) throw Object.assign(new Error('Request not found.'), { status: 404 });

  await pool.query(`UPDATE "FriendRequests" SET status = 'declined' WHERE id = $1`, [requestId]);
  return rows[0];
};

module.exports.unfriend = async function unfriend(userId, friendId) {
  await pool.query(
    `DELETE FROM "UserFriends" WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
    [userId, friendId],
  );
  await pool.query(
    `UPDATE "FriendRequests" SET status = 'declined'
     WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)`,
    [userId, friendId],
  );
};

module.exports.getRelationship = getRelationship;

module.exports.mutualFriendsList = async function mutualFriendsList(userId, otherId) {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.display_name, p.avatar, p.profile_image
     FROM "Person" p
     JOIN "UserFriends" a ON a.friend_id = p.id AND a.user_id = $1
     JOIN "UserFriends" b ON b.friend_id = p.id AND b.user_id = $2
     ORDER BY p.name`,
    [userId, otherId],
  );
  return rows.map((r) => formatUser(r, {}));
};

module.exports.suggestedFriends = async function suggestedFriends(userId) {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.display_name, p.email, p.avatar, p.profile_image, p.bio,
            COUNT(DISTINCT gm.group_id)::int AS shared_groups
     FROM "Person" p
     JOIN "GroupMembers" gm ON gm.user_id = p.id
     WHERE gm.group_id IN (
       SELECT group_id FROM "GroupMembers" WHERE user_id = $1
     )
     AND p.id != $1
     AND p.id NOT IN (
       SELECT friend_id FROM "UserFriends" WHERE user_id = $1
     )
     AND p.id NOT IN (
       SELECT CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END
       FROM "FriendRequests"
       WHERE (sender_id = $1 OR receiver_id = $1) AND status = 'pending'
     )
     AND p.role = 'user' AND p.is_active = TRUE AND p.deleted_at IS NULL
     GROUP BY p.id
     ORDER BY shared_groups DESC, p.name
     LIMIT 10`,
    [userId],
  );

  const results = [];
  for (const row of rows) {
    const mutual = await mutualFriendsCount(userId, row.id);
    results.push(formatUser(row, { mutual_friends: mutual, shared_groups: row.shared_groups }));
  }
  return results;
};

module.exports.toggleFavorite = async function toggleFavorite(userId, friendId) {
  const { rows } = await pool.query(
    `UPDATE "UserFriends" SET is_favorite = NOT is_favorite
     WHERE user_id = $1 AND friend_id = $2
     RETURNING is_favorite`,
    [userId, friendId],
  );
  if (rows.length === 0) throw Object.assign(new Error('Not friends.'), { status: 404 });
  return rows[0].is_favorite;
};

module.exports.mutualFriendsCount = mutualFriendsCount;
