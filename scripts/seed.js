const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const persons = [
  { email: 'alice@example.com', name: 'Alice' },
  { email: 'bob@example.com', name: 'Bob' },
  { email: 'carol@example.com', name: 'Carol' },
  { email: 'dave@example.com', name: 'Dave' },
  { email: 'eve@example.com', name: 'Eve' },
  { email: 'frank@example.com', name: 'Frank' },
  { email: 'grace@example.com', name: 'Grace' },
  { email: 'heidi@example.com', name: 'Heidi' },
  { email: 'ivan@example.com', name: 'Ivan' },
  { email: 'judy@example.com', name: 'Judy' },
  { email: 'mallory@example.com', name: 'Mallory' },
  { email: 'oscar@example.com', name: 'Oscar' },
  { email: 'peggy@example.com', name: 'Peggy' },
  { email: 'trent@example.com', name: 'Trent' },
  { email: 'victor@example.com', name: 'Victor' },
  { email: 'walter@example.com', name: 'Walter' },
  { email: 'xavier@example.com', name: 'Xavier' },
  { email: 'yvonne@example.com', name: 'Yvonne' },
  { email: 'zara@example.com', name: 'Zara' },
  { email: 'leo@example.com', name: 'Leo' },
];

const somethings = [{ name: 'Seed 1' }, { name: 'Seed 2' }];

// seed data for discussion pg
// Example posts
const posts = [
  { userEmail: 'alice@example.com', title: 'First Confession', category: 'confession', content: 'I love pineapple pizza!' },
  { userEmail: 'bob@example.com', title: 'Need Help', category: 'qna', content: 'How do I fix my seed script?' },
  { userEmail: 'carol@example.com', title: 'General Thoughts', category: 'general', content: 'Postgres is powerful.' },
];

// Example comments
const comments = [
  { userEmail: 'dave@example.com', postTitle: 'First Confession', content: 'Same here!' },
  { userEmail: 'eve@example.com', postTitle: 'Need Help', content: 'Try ON CONFLICT DO NOTHING.' },
];

// Example reactions
const reactions = [
  { userEmail: 'frank@example.com', postTitle: 'First Confession', reactionType: 'like' },
  { userEmail: 'grace@example.com', postTitle: 'Need Help', reactionType: 'dislike' },
];

// Example saved posts
const savedPosts = [
  { userEmail: 'heidi@example.com', postTitle: 'General Thoughts' },
];

// seed data for groups
// Example Groups 
const groups = [
  {
    name: 'SOC Study Buddies',
    creatorEmail: 'alice@example.com',
    description: 'A group for SOC students to revise and share notes.',
    school: 'SOC',
    module: 'CS1010',
    public: true,
  },
  {
    name: 'MAD Project Team',
    creatorEmail: 'bob@example.com',
    description: 'Mobile App Development project collaboration group.',
    school: 'MAD',
    module: 'CP2106',
    public: false,
  },
  {
    name: 'EEE Circuit Masters',
    creatorEmail: 'carol@example.com',
    description: 'Discuss circuits, labs, and exam prep for EEE modules.',
    school: 'EEE',
    module: 'EE2020',
    public: true,
  },
];

// Example GroupMembers
const groupMembers = [
  // SOC group
  { groupName: 'SOC Study Buddies', userEmail: 'alice@example.com', role: 'admin' },
  { groupName: 'SOC Study Buddies', userEmail: 'bob@example.com', role: 'user' },
  { groupName: 'SOC Study Buddies', userEmail: 'carol@example.com', role: 'user' },

  // MAD group
  { groupName: 'MAD Project Team', userEmail: 'bob@example.com', role: 'admin' },
  { groupName: 'MAD Project Team', userEmail: 'dave@example.com', role: 'user' },
  { groupName: 'MAD Project Team', userEmail: 'eve@example.com', role: 'user' },

  // EEE group
  { groupName: 'EEE Circuit Masters', userEmail: 'carol@example.com', role: 'admin' },
  { groupName: 'EEE Circuit Masters', userEmail: 'frank@example.com', role: 'user' },
  { groupName: 'EEE Circuit Masters', userEmail: 'grace@example.com', role: 'user' },
];


async function seed() {
  console.log('Seeding data...');

  // Insert persons (batch)
  if (persons.length > 0) {
    const personPlaceholders = persons.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`);
    const personValues = persons.flatMap((p) => [p.email, p.name]);
    await pool.query(
      `INSERT INTO "Person" ("email", "name") VALUES ${personPlaceholders.join(', ')} ON CONFLICT ("email") DO NOTHING`,
      // "do nothing" prevents duplicate error when seeding data
      personValues,
    );
  }
  console.log(`Inserted ${persons.length} persons.`);

  // Insert somethings (batch)
  if (somethings.length > 0) {
    const somethingPlaceholders = somethings.map((_, i) => `($${i + 1})`);
    const somethingValues = somethings.map((s) => s.name);
    await pool.query(
      `INSERT INTO "Something" ("name") VALUES ${somethingPlaceholders.join(', ')}`,
      somethingValues,
    );
  }
  console.log(`Inserted ${somethings.length} somethings.`);

  console.log('Seed data inserted successfully.');

  // homepg function
    // Insert posts
  for (const post of posts) {
    const userRes = await pool.query(`SELECT id FROM "Person" WHERE email = $1`, [post.userEmail]);
    if (userRes.rows.length > 0) {
      await pool.query(
        `INSERT INTO "Posts" ("user_id", "title", "category", "content")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [userRes.rows[0].id, post.title, post.category, post.content]
      );
    }
  }
  console.log(`Inserted ${posts.length} posts.`);

  // Insert comments
  for (const comment of comments) {
    const userRes = await pool.query(`SELECT id FROM "Person" WHERE email = $1`, [comment.userEmail]);
    const postRes = await pool.query(`SELECT id FROM "Posts" WHERE title = $1`, [comment.postTitle]);
    if (userRes.rows.length > 0 && postRes.rows.length > 0) {
      await pool.query(
        `INSERT INTO "PostComments" ("user_id", "post_id", "content")
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [userRes.rows[0].id, postRes.rows[0].id, comment.content]
      );
    }
  }
  console.log(`Inserted ${comments.length} comments.`);

  // Insert reactions
  for (const reaction of reactions) {
    const userRes = await pool.query(`SELECT id FROM "Person" WHERE email = $1`, [reaction.userEmail]);
    const postRes = await pool.query(`SELECT id FROM "Posts" WHERE title = $1`, [reaction.postTitle]);
    if (userRes.rows.length > 0 && postRes.rows.length > 0) {
      await pool.query(
        `INSERT INTO "PostReactions" ("post_id", "user_id", "reaction_type")
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [postRes.rows[0].id, userRes.rows[0].id, reaction.reactionType]
      );
    }
  }
  console.log(`Inserted ${reactions.length} reactions.`);

  // Insert saved posts
  for (const saved of savedPosts) {
    const userRes = await pool.query(`SELECT id FROM "Person" WHERE email = $1`, [saved.userEmail]);
    const postRes = await pool.query(`SELECT id FROM "Posts" WHERE title = $1`, [saved.postTitle]);
    if (userRes.rows.length > 0 && postRes.rows.length > 0) {
      await pool.query(
        `INSERT INTO "SavedPosts" ("user_id", "post_id")
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [userRes.rows[0].id, postRes.rows[0].id]
      );
    }
  }
  console.log(`Inserted ${savedPosts.length} saved posts.`);

  // Insert groups
  for (const group of groups) {
    const userRes = await pool.query(
      `SELECT id FROM "Person" WHERE email = $1`,
      [group.creatorEmail]
    );

    if (userRes.rows.length > 0) {
      await pool.query(
        `INSERT INTO "Groups" ("name", "creator_id", "description", "school", "module", "public")
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT ("name") DO NOTHING`,
        [
          group.name,
          userRes.rows[0].id,
          group.description,
          group.school,
          group.module,
          group.public,
        ]
      );
    }
  }

  console.log(`Inserted ${groups.length} groups.`);

  // Insert group members
  for (const member of groupMembers) {
    const userRes = await pool.query(
      `SELECT id FROM "Person" WHERE email = $1`,
      [member.userEmail]
    );

    const groupRes = await pool.query(
      `SELECT id FROM "Groups" WHERE name = $1`,
      [member.groupName]
    );

    if (userRes.rows.length > 0 && groupRes.rows.length > 0) {
      await pool.query(
        `INSERT INTO "GroupMembers" ("group_id", "user_id", "role")
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING`,
        [groupRes.rows[0].id, userRes.rows[0].id, member.role]
      );
    }
  }

  console.log(`Inserted ${groupMembers.length} group members.`);


}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Seeding failed:', err);
    pool.end();
    process.exit(1);
  });
