const pool = require('./db');

module.exports.searchAll = async function searchAll(data) {
  // # for tag searches
  const cleanQuery = data.query.startsWith('#') ? data.query.slice(1) : data.query;
  const searchTerm = `%${cleanQuery}%`;

  const params = [searchTerm];
  let paramIndex = 2;

  // Optional category filter
  let postCategoryFilter = '';
  let commentCategoryFilter = '';
  if (data.category && data.category.length) {
    const placeholders = data.category.map(() => `$${paramIndex++}`).join(', ');
    params.push(...data.category);
    postCategoryFilter = `AND p.category IN (${placeholders})`;
    commentCategoryFilter = `AND p.category IN (${placeholders})`;
  }

  // Optional date filter
  let postDateFilter = '';
  let commentDateFilter = '';
  if (data.date_from) {
    params.push(data.date_from);
    postDateFilter += ` AND p.created_at  >= $${paramIndex}`;
    commentDateFilter += ` AND pc.created_at >= $${paramIndex}`;
    paramIndex++;
  }
  if (data.date_to) {
    params.push(data.date_to);
    postDateFilter += ` AND p.created_at  <= $${paramIndex}`;
    commentDateFilter += ` AND pc.created_at <= $${paramIndex}`;
    paramIndex++;
  }

  // Sort
  const sortMap = {
    newest: 'created_at DESC NULLS LAST',
    oldest: 'created_at ASC  NULLS LAST',
    relevance: 'created_at DESC NULLS LAST',
  };
  const orderBy = sortMap[data.sort] || sortMap.newest;

  const { rows } = await pool.query(
    `
    SELECT 'post' AS result_type,
           p.id, p.title, p.content, p.category, p.created_at,
           per.name AS author_name, NULL AS description, NULL::int AS post_id
    FROM "Posts" p
    JOIN "Person" per ON p.user_id = per.id
    WHERE (p.title ILIKE $1 OR p.content ILIKE $1)
    ${postCategoryFilter}
    ${postDateFilter}

    UNION ALL

    SELECT 'comment' AS result_type,
           pc.id,
           pc.content AS title,
           pc.content,
           p.category,
           pc.created_at,
           per.name AS author_name,
           p.title AS description,
           pc.post_id
    FROM "PostComments" pc
    JOIN "Person" per ON pc.user_id = per.id
    JOIN "Posts"  p   ON pc.post_id = p.id
    WHERE pc.content ILIKE $1
    ${commentCategoryFilter}
    ${commentDateFilter}

    UNION ALL

    SELECT 'group' AS result_type,
           g.id, g.name AS title, NULL AS content, NULL AS category, NULL AS created_at,
           per.name AS author_name, g.description, NULL::int AS post_id
    FROM "Groups" g
    JOIN "Person" per ON g.creator_id = per.id
    WHERE g.name ILIKE $1 OR g.description ILIKE $1 OR g.module ILIKE $1

    UNION ALL

    SELECT 'user' AS result_type,
           per.id, per.name AS title, NULL AS content, NULL AS category, NULL AS created_at,
           per.name AS author_name, NULL AS description, NULL::int AS post_id
    FROM "Person" per
    WHERE per.name ILIKE $1

    UNION ALL

    SELECT 'post' AS result_type,
           p.id,
           p.title,
           p.content,
           p.category,
           p.created_at,
           per.name AS author_name,
           NULL AS description,
           NULL::int AS post_id
    FROM "Posts" p
    JOIN "PostTags" pt ON pt.post_id = p.id
    JOIN "Tags"     t  ON t.id       = pt.tag_id
    JOIN "Person"  per ON per.id     = p.user_id
    WHERE t.name ILIKE $1

    ORDER BY ${orderBy}
    `,
    params,
  );

  return rows;
};
