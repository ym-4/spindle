const pool = require('./db');

module.exports.searchAll = async function searchAll(query) {
  const searchTerm = `%${query}%`;
  const VALUES = [searchTerm];

  const { rows } = await pool.query(`
    SELECT 'post' AS result_type, 
           p.id, p.title, p.content, p.category, p.created_at,
           per.name AS author_name, NULL AS description
    FROM "Posts" p
    JOIN "Person" per ON p.user_id = per.id
    WHERE p.title ILIKE $1 OR p.content ILIKE $1

    UNION ALL

    SELECT 'group' AS result_type,
           g.id, g.name AS title, NULL AS content, NULL AS category, NULL AS created_at,
           per.name AS author_name, g.description
    FROM "Groups" g
    JOIN "Person" per ON g.creator_id = per.id
    WHERE g.name ILIKE $1 OR g.description ILIKE $1 OR g.module ILIKE $1

    UNION ALL

    SELECT 'user' AS result_type,
           per.id, per.name AS title, NULL AS content, NULL AS category, NULL AS created_at,
           per.name AS author_name, NULL AS description
    FROM "Person" per
    WHERE per.name ILIKE $1

    ORDER BY created_at DESC NULLS LAST
  `, VALUES);

  return rows;
};