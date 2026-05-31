const { Pool } = require('pg');
const { hashPassword } = require('../src/models/Auth.model');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const DEFAULT_PASSWORD = 'password123';
const ADMIN_PASSWORD = 'admin123';
const hashedDefaultPassword = hashPassword(DEFAULT_PASSWORD);
const hashedAdminPassword = hashPassword(ADMIN_PASSWORD);

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

// Seed data for groups
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
  { groupName: 'SOC Study Buddies', userEmail: 'beni@example.com', role: 'admin' },
  { groupName: 'SOC Study Buddies', userEmail: 'emataso@example.com', role: 'user' },
  { groupName: 'SOC Study Buddies', userEmail: 'hinano@example.com', role: 'user' },


  // MAD group
  { groupName: 'MAD Project Team', userEmail: 'bob@example.com', role: 'admin' },
  { groupName: 'MAD Project Team', userEmail: 'dave@example.com', role: 'user' },
  { groupName: 'MAD Project Team', userEmail: 'eve@example.com', role: 'user' },

  // EEE group
  { groupName: 'EEE Circuit Masters', userEmail: 'carol@example.com', role: 'admin' },
  { groupName: 'EEE Circuit Masters', userEmail: 'frank@example.com', role: 'user' },
  { groupName: 'EEE Circuit Masters', userEmail: 'grace@example.com', role: 'user' },
];

// Example Group Discussions
const groupDiscussions = [
  // SOC Study Buddies
  {
    groupName: 'SOC Study Buddies',
    userEmail: 'alice@example.com',
    channel_name: 'general',
    message: 'Welcome everyone! Feel free to share your notes here.',
  },
  {
    groupName: 'SOC Study Buddies',
    userEmail: 'bob@example.com',
    channel_name: 'general',
    message: 'Anyone understands recursion for CS1010?',
  },
  {
    groupName: 'SOC Study Buddies',
    userEmail: 'beni@example.com',
    channel_name: 'resources',
    message: 'I uploaded last year’s practical exam solutions.',
  },
  {
    groupName: 'SOC Study Buddies',
    userEmail: 'beni@example.com',
    channel_name: 'general',
    message: 'When is the CA2 due?',
  },

  {
    groupName: 'SOC Study Buddies',
    userEmail: 'emataso@example.com',
    channel_name: 'general',
    message: 'Next week',
  },

  {
    groupName: 'SOC Study Buddies',
    userEmail: 'beni@example.com',
    channel_name: 'general',
    message: '😭',
  },

  {
    groupName: 'SOC Study Buddies',
    userEmail: 'hinano@example.com',
    channel_name: 'general',
    message: 'Hey, did you finish the assignment?',
  },

  {
    groupName: 'SOC Study Buddies',
    userEmail: 'alice@example.com', 
    channel_name: 'general',
    message: 'Yeah, I just submitted it 👍',
  },

  // MAD Project Team
  {
    groupName: 'MAD Project Team',
    userEmail: 'dave@example.com',
    channel_name: 'project',
    message: 'Can we finalize the UI design by Friday?',
  },
  {
    groupName: 'MAD Project Team',
    userEmail: 'eve@example.com',
    channel_name: 'general',
    message: 'I will handle the frontend integration.',
  },
  {
    groupName: 'MAD Project Team',
    userEmail: 'eve@example.com',
    channel_name: 'design',
    message: 'I created new Figma mockups for the dashboard.',
  },

  // EEE Circuit Masters
  {
    groupName: 'EEE Circuit Masters',
    userEmail: 'carol@example.com',
    channel_name: 'labs',
    message: 'Reminder: Lab report due next Monday.',
  },
  {
    groupName: 'EEE Circuit Masters',
    userEmail: 'frank@example.com',
    channel_name: 'general',
    message: 'Does anyone know how to solve Question 3?',
  },
  {
    groupName: 'EEE Circuit Masters',
    userEmail: 'emataso@example.com',
    channel_name: 'exam-prep',
    message: 'I made a summary sheet for the circuit formulas.',
  },
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

  // Auth-ready users (hashed passwords + verified email for login)
  await pool.query(
    `INSERT INTO "Person" (email, name, hashed_password, role, email_verified)
     VALUES ('admin@campushub.sp', 'Admin', $1, 'admin', TRUE)
     ON CONFLICT (email) DO UPDATE SET hashed_password = EXCLUDED.hashed_password, role = 'admin', email_verified = TRUE`,
    [hashedAdminPassword],
  );
  await pool.query(
    `UPDATE "Person" SET hashed_password = $1, email_verified = TRUE, role = 'user'
     WHERE email != 'admin@campushub.sp'`,
    [hashedDefaultPassword],
  );
  console.log('Set passwords (password123) and verified emails for all users.');

  const aliceRes = await pool.query(`SELECT id FROM "Person" WHERE email = 'alice@example.com'`);
  const bobRes = await pool.query(`SELECT id FROM "Person" WHERE email = 'bob@example.com'`);
  const aliceId = aliceRes.rows[0]?.id;
  const bobId = bobRes.rows[0]?.id;
  if (aliceId && bobId) {
    await pool.query(
      `INSERT INTO "FriendRequests" (sender_id, receiver_id, status) VALUES ($1, $2, 'accepted')
       ON CONFLICT (sender_id, receiver_id) DO UPDATE SET status = 'accepted'`,
      [aliceId, bobId],
    );
    await pool.query(
      `INSERT INTO "UserFriends" (user_id, friend_id) VALUES ($1, $2), ($2, $1) ON CONFLICT DO NOTHING`,
      [aliceId, bobId],
    );
    await pool.query(
      `INSERT INTO "PersonalMessages" (sender_id, recipient_id, body) VALUES ($1, $2, 'Hey Bob! Want to study together?')`,
      [aliceId, bobId],
    );
    console.log('Seeded Alice/Bob friendship and sample message.');
    await pool.query(
      `UPDATE "Person" SET display_name = 'Alice', bio = $1, headline = $2, location = $3,
       skills = $4::jsonb, link_github = $5, link_linkedin = $6
       WHERE id = $7`,
      [
        'CS student at SP. I build study tools and love helping classmates with assignments.',
        'Computer Science Student',
        'Singapore',
        JSON.stringify(['JavaScript', 'Python', 'Study Groups', 'UI Design']),
        'alice-dev',
        'alice-khan',
        aliceId,
      ],
    );
  }

  // Discussion board extras
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
         ON CONFLICT ("post_id", "user_id") DO NOTHING`,
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


  // Insert groups
  for (const group of groups) {
    const userRes = await pool.query(
      `SELECT id FROM "Person" WHERE email = $1`,
      [group.creatorEmail]
    );

    if (userRes.rows.length > 0) {
      await pool.query(
        `INSERT INTO "Groups" ("name", "creator_id", "description", "school", "module")
         VALUES ($1, $2, $3, $4, $5)`,
        [group.name, userRes.rows[0].id, group.description, group.school, group.module],
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

  // Insert group discussions
  for (const discussion of groupDiscussions) {

    const userRes = await pool.query(
      `SELECT id FROM "Person" WHERE email = $1`,
      [discussion.userEmail]
    );

    const groupRes = await pool.query(
      `SELECT id FROM "Groups" WHERE name = $1`,
      [discussion.groupName]
    );

    if (userRes.rows.length > 0 && groupRes.rows.length > 0) {

      await pool.query(
        `INSERT INTO "GroupDiscussions"
        ("group_id", "user_id", "channel_name", "message")
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING`,
        [
          groupRes.rows[0].id,
          userRes.rows[0].id,
          discussion.channel_name,
          discussion.message
        ]
      );

    }
  }

  console.log(`Inserted ${groupDiscussions.length} group discussions.`);

  console.log('Seed completed successfully.');
  console.log(`Login: Alice/Bob password "${DEFAULT_PASSWORD}", Admin password "${ADMIN_PASSWORD}"`);
}


seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Seeding failed:', err);
    pool.end();
    process.exit(1);
  });