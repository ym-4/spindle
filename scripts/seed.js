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
];

const somethings = [{ name: 'Seed 1' }, { name: 'Seed 2' }];

async function seed() {
  console.log('Seeding data...');

  await pool.query(
    `INSERT INTO "Person" (email, name, hashed_password, role)
     VALUES ($1, $2, $3, 'admin')`,
    ['admin@pineapplepizza.com', 'Admin', hashedAdminPassword],
  );
  console.log('Inserted admin user (admin@pineapplepizza.com / admin123).');

  if (persons.length > 0) {
    const personPlaceholders = persons.map(
      (_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`,
    );
    const personValues = persons.flatMap((p) => [
      p.email,
      p.name,
      hashedDefaultPassword,
      'user',
    ]);
    await pool.query(
      `INSERT INTO "Person" (email, name, hashed_password, role) VALUES ${personPlaceholders.join(', ')}`,
      personValues,
    );
  }
  console.log(`Inserted ${persons.length} regular users.`);

  if (somethings.length > 0) {
    const somethingPlaceholders = somethings.map((_, i) => `($${i + 1})`);
    const somethingValues = somethings.map((s) => s.name);
    await pool.query(
      `INSERT INTO "Something" ("name") VALUES ${somethingPlaceholders.join(', ')}`,
      somethingValues,
    );
  }
  console.log(`Inserted ${somethings.length} somethings.`);

  const aliceRes = await pool.query(`SELECT id FROM "Person" WHERE name = 'Alice'`);
  const bobRes = await pool.query(`SELECT id FROM "Person" WHERE name = 'Bob'`);
  const aliceId = aliceRes.rows[0]?.id;
  const bobId = bobRes.rows[0]?.id;

  if (aliceId && bobId) {
    await pool.query(
      `INSERT INTO "UserSettings" (user_id, bio, phone, campus) VALUES
        ($1, 'Year 2 student', '91234567', 'SP'),
        ($2, 'Loves study groups', '98765432', 'SP')`,
      [aliceId, bobId],
    );
    await pool.query(
      `INSERT INTO "UserPaymentDetails" (user_id, billing_name, payment_method, card_last4) VALUES
        ($1, 'Alice Tan', 'card', '4242'),
        ($2, 'Bob Lee', 'paynow', '')`,
      [aliceId, bobId],
    );
    await pool.query(
      `INSERT INTO "UserFriends" (user_id, friend_id) VALUES ($1, $2)`,
      [aliceId, bobId],
    );

    const postRes = await pool.query(
      `INSERT INTO "Posts" (user_id, title, category, content) VALUES
        ($1, 'Best study spot?', 'qna', 'Where do you go to revise on campus?'),
        ($2, 'Selling notes', 'general', 'PDF notes for CICD module.')
       RETURNING id`,
      [aliceId, bobId],
    );
    const alicePostId = postRes.rows[0].id;
    const bobPostId = postRes.rows[1].id;

    await pool.query(`INSERT INTO "SavedPosts" (user_id, post_id) VALUES ($1, $2)`, [
      aliceId,
      bobPostId,
    ]);

    const groupRes = await pool.query(
      `INSERT INTO "Groups" (name, creator_id, description, school, module) VALUES
        ('CICD Study Squad', $1, 'Weekly revision for CICD', 'SP', 'CICD')
       RETURNING id`,
      [aliceId],
    );
    const groupId = groupRes.rows[0].id;
    await pool.query(
      `INSERT INTO "GroupMembers" (group_id, user_id, role) VALUES ($1, $2, 'admin'), ($1, $3, 'user')`,
      [groupId, aliceId, bobId],
    );

    await pool.query(
      `INSERT INTO "ChatroomMessages" (user_id, message) VALUES
        ($1, 'Welcome to the campus chatroom!'),
        ($2, 'Anyone free for a study session?')`,
      [aliceId, bobId],
    );

    await pool.query(
      `INSERT INTO "PersonalMessages" (sender_id, recipient_id, body) VALUES ($1, $2, 'Hey Bob!')`,
      [aliceId, bobId],
    );

    console.log('Inserted profile demo data (friends, posts, groups, chatroom, PMs).');
  }

  console.log('Seed data inserted successfully.');
  console.log(`Regular user password: ${DEFAULT_PASSWORD}`);
  console.log(`Admin password: ${ADMIN_PASSWORD}`);
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Seeding failed:', err);
    pool.end();
    process.exit(1);
  });
