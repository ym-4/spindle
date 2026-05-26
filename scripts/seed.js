const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const persons = [
  { email: 'alice@example.com', name: 'Alice', hashed_password: 123 },
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
  { email: 'beni@example.com', name: 'Beni' },
  { email: 'emataso@example.com', name: 'Emataso' },
  { email: 'hinano@example.com', name: 'Hinano' },
];

const somethings = [{ name: 'Seed 1' }, { name: 'Seed 2' }];

// seed data for discussion pg
// Example posts
const posts = [
  {
    userEmail: 'alice@example.com',
    title: 'First Confession',
    category: 'confession',
    content: 'I love pineapple pizza!',
  },
  {
    userEmail: 'bob@example.com',
    title: 'Need Help',
    category: 'qna',
    content: 'How do I fix my seed script?',
  },
  {
    userEmail: 'carol@example.com',
    title: 'General Thoughts',
    category: 'general',
    content: 'Postgres is powerful.',
  },
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
const savedPosts = [{ userEmail: 'heidi@example.com', postTitle: 'General Thoughts' }];

// Example groups
const groups = [
  {
    creatorEmail: 'alice@example.com',
    name: 'CS101 Study Group',
    description: 'Weekly discussions and coding practice for CS101.',
    school: 'SOC',
    module: 'CS101',
    public: true,
  },
  {
    creatorEmail: 'bob@example.com',
    name: 'Math Assignment Help',
    description: 'Get help with calculus and algebra assignments.',
    school: 'SMA',
    module: 'MA1508E',
    public: true,
  },
  {
    creatorEmail: 'carol@example.com',
    name: 'EEE Electronics Lab',
    description: 'Discuss lab work and electronics troubleshooting.',
    school: 'EEE',
    module: 'EE2001',
    public: false,
  },
  {
    creatorEmail: 'dave@example.com',
    name: 'Business Case Study Team',
    description: 'Collaborate on business presentations and reports.',
    school: 'SB',
    module: 'BU1001',
    public: true,
  },
  {
    creatorEmail: 'eve@example.com',
    name: 'Biomedical Science Notes',
    description: 'Sharing notes and revision materials.',
    school: 'CLS',
    module: 'BM2102',
    public: true,
  },
];

// These seeded items should be moved to the top with the others later, right now I dont wanna be confused.
const marketplaceItems = [
  {
    sellerEmail: 'alice@example.com',
    name: 'Backpack',
    description: 'Durable everyday backpack with multiple compartments.',
    price: 49.9,
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Calculator',
    description: 'Scientific calculator suitable for engineering modules.',
    price: 15.0,
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Folder',
    description: 'A4 document folder to keep your notes organised.',
    price: 3.5,
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Notebook',
    description: 'Lined notebook, 200 pages, hardcover.',
    price: 6.9,
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Paper',
    description: 'A4 80gsm printing paper, 500 sheets per ream.',
    price: 8.0,
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Pen',
    description: 'Smooth ballpoint pen, blue ink.',
    price: 1.5,
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Pencil',
    description: 'HB pencil, ideal for sketching and writing.',
    price: 0.8,
  },
  {
    sellerEmail: 'alice@example.com',
    name: 'Stationery Pack',
    description: 'Bundle of essentials: pens, pencils, ruler, eraser, and sharpener.',
    price: 12.0,
  },
];

async function seed() {
  console.log('Seeding data...');

  // Insert persons
  for (const person of persons) {
    const hashedPassword = await bcrypt.hash(
      person.hashed_password?.toString() || 'password123',
      10
    );

    await pool.query(
      `INSERT INTO "Person" ("email", "name", "hashed_password") VALUES ($1, $2, $3) ON CONFLICT ("email") DO NOTHING`,
      [person.email, person.name, hashedPassword]
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
        [userRes.rows[0].id, post.title, post.category, post.content],
      );
    }
  }
  console.log(`Inserted ${posts.length} posts.`);

  // Insert comments
  for (const comment of comments) {
    const userRes = await pool.query(`SELECT id FROM "Person" WHERE email = $1`, [
      comment.userEmail,
    ]);
    const postRes = await pool.query(`SELECT id FROM "Posts" WHERE title = $1`, [
      comment.postTitle,
    ]);
    if (userRes.rows.length > 0 && postRes.rows.length > 0) {
      await pool.query(
        `INSERT INTO "PostComments" ("user_id", "post_id", "content")
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [userRes.rows[0].id, postRes.rows[0].id, comment.content],
      );
    }
  }
  console.log(`Inserted ${comments.length} comments.`);

  // Insert reactions
  for (const reaction of reactions) {
    const userRes = await pool.query(`SELECT id FROM "Person" WHERE email = $1`, [
      reaction.userEmail,
    ]);
    const postRes = await pool.query(`SELECT id FROM "Posts" WHERE title = $1`, [
      reaction.postTitle,
    ]);
    if (userRes.rows.length > 0 && postRes.rows.length > 0) {
      await pool.query(
        `INSERT INTO "PostReactions" ("post_id", "user_id", "reaction_type")
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [postRes.rows[0].id, userRes.rows[0].id, reaction.reactionType],
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
        [userRes.rows[0].id, postRes.rows[0].id],
      );
    }
  }
  console.log(`Inserted ${savedPosts.length} saved posts.`);
  
  // Insert groups
  for (const group of groups) {
    const creatorRes = await pool.query(
      `SELECT id FROM "Person" WHERE email = $1`,
      [group.creatorEmail]
    );

    if (creatorRes.rows.length > 0) {
      await pool.query(
        `INSERT INTO "Groups"
        ("name", "creator_id", "description", "school", "module", "public")
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT ("name") DO NOTHING`,
        [
          group.name,
          creatorRes.rows[0].id,
          group.description,
          group.school,
          group.module,
          group.public,
        ]
      );
    }
  }

  console.log(`Inserted ${groups.length} groups.`);

  // Insert marketplace items
  const sellerRes = await pool.query(`SELECT id FROM "Person" WHERE email = $1`, [
    'alice@example.com',
  ]);
  if (sellerRes.rows.length > 0) {
    const sellerId = sellerRes.rows[0].id;
    for (const item of marketplaceItems) {
      await pool.query(
        `INSERT INTO "MarketplaceItems" ("seller_id", "name", "description", "price")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
        [sellerId, item.name, item.description, item.price],
      );
    }
  }
  console.log(`Inserted ${marketplaceItems.length} marketplace items.`);
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Seeding failed:', err);
    pool.end();
    process.exit(1);
  });
