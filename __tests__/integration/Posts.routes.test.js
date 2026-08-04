const request = require('supertest');

jest.mock('../../src/models/Posts.model', () => {
  const actual = jest.requireActual('../../src/models/Posts.model');
  const mocked = {};
  Object.keys(actual).forEach((key) => {
    mocked[key] = jest.fn(actual[key]);
  });
  return mocked;
});

jest.mock('../../src/services/badgeService', () => {
  const actual = jest.requireActual('../../src/services/badgeService');
  const mocked = {};
  Object.keys(actual).forEach((key) => {
    mocked[key] = jest.fn(actual[key]);
  });
  return mocked;
});

const app = require('../../src/app');
const pool = require('../../src/models/db');
const PostsModel = require('../../src/models/Posts.model');
const Notification = require('../../src/models/Notification.model');
const { checkAndAwardBadges } = require('../../src/services/badgeService');

// ── DB Setup / Teardown ──────────────────────────────────
// Tables are created via the Jest globalSetup (configs/jest-integration-setup.js)
// which runs scripts/reset.js before any test file executes.
beforeEach(async () => {
  // Clean slate for every test
  await pool.query('DELETE FROM "PostTags"');
  await pool.query('DELETE FROM "Tags"');
  await pool.query('DELETE FROM "PollVotes"');
  await pool.query('DELETE FROM "PollOptions"');
  await pool.query('DELETE FROM "PostPolls"');
  await pool.query('DELETE FROM "PostReactions"');
  await pool.query('DELETE FROM "SavedPosts"');
  await pool.query('DELETE FROM "Posts"');
  await pool.query('DELETE FROM "UserSessions"');
  await pool.query('DELETE FROM "Person"');
});

afterAll(async () => {
  await pool.query('DELETE FROM "PostTags"');
  await pool.query('DELETE FROM "Tags"');
  await pool.query('DELETE FROM "PollVotes"');
  await pool.query('DELETE FROM "PollOptions"');
  await pool.query('DELETE FROM "PostPolls"');
  await pool.query('DELETE FROM "PostReactions"');
  await pool.query('DELETE FROM "SavedPosts"');
  await pool.query('DELETE FROM "Posts"');
  await pool.query('DELETE FROM "UserSessions"');
  await pool.query('DELETE FROM "Person"');
  await pool.end();
});

// ── Helpers ───────────────────────────────────────────────
async function registerAndVerify(name, email, password = 'secret') {
  const reg = await request(app).post('/auth/register').send({ name, email, password });
  const verify = await request(app).post('/auth/verify-email').send({
    email,
    code: reg.body.previewCode,
  });
  return { user: verify.body.user, token: verify.body.token };
}

async function loginAndVerify(username, password, rememberMe = false) {
  const login = await request(app).post('/auth/login').send({ username, password });
  if (login.body.needs2FA) {
    const verify = await request(app).post('/auth/verify-login').send({
      email: login.body.email,
      code: login.body.previewCode,
      remember_me: rememberMe,
    });
    return {
      user: verify.body.user,
      token: verify.body.token,
      remember_token: verify.body.remember_token,
    };
  }
  return { user: login.body.user, token: login.body.token };
}

async function createTestUser(name = 'Test User', email = 'test@test.com', password = 'secret') {
  const { user, token } = await registerAndVerify(name, email, password);
  return { id: user.id, token, email, password };
}

async function createTestPost(userId, title = 'Test Post', category = 'general') {
  const { rows } = await pool.query(
    `INSERT INTO "Posts"
    (user_id, title, category, content)
    VALUES ($1, $2, $3, 'Content')
    RETURNING id`,
    [userId, title, category],
  );

  return { id: rows[0].id };
}

// The JWT bakes the role in at issue time (authenticateJWT does not re-check
// the DB per request), so promoting a user to admin mid-test requires a
// fresh login afterwards or the old token will still read role: 'user'.
async function promoteToAdmin(user) {
  await pool.query(`UPDATE "Person" SET role = 'admin' WHERE id = $1`, [user.id]);
  const relogged = await loginAndVerify(user.email, user.password);
  user.token = relogged.token;
  return user;
}

// ─────────────────────────────────────────────────────────
// GET /posts
// ─────────────────────────────────────────────────────────
describe('GET /posts', () => {
  // Boundary: zero rows – empty table returns an empty array
  test('should return 200 and an empty array when no posts exist', async () => {
    const res = await request(app).get('/posts');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Valid partition: existing posts are returned
  test('should return 200 and all posts', async () => {
    const user = await createTestUser('PostAuthor', 'postauthor@example.com');

    await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES
      ($1,'First Post','general','Hello World'),
      ($1,'Second Post','qna','Need help')`,
      [user.id],
    );

    const res = await request(app).get('/posts');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('title');
    expect(res.body[0]).toHaveProperty('category');
    expect(res.body[0]).toHaveProperty('content');
    expect(res.body[0]).toHaveProperty('user_id');
  });

  // Error handling: an unknown route
  test('should return 404 for a completely unknown route', async () => {
    const res = await request(app).get('/this-route-does-not-exist-anywhere');
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────
// GET /posts/hot
// ─────────────────────────────────────────────────────────
describe('GET /posts/hot', () => {
  // Valid partition: returns posts with engagement, ranked by hot_score
  test('should return posts ranked by engagement', async () => {
    const author = await createTestUser('HotPostAuthor', 'hotpostauthor@example.com');
    const post = await createTestPost(author.id, 'Trending Post');
    const liker = await createTestUser('HotPostLiker', 'hotpostliker@example.com');
    await pool.query(
      `INSERT INTO "PostReactions" (post_id, user_id, reaction_type) VALUES ($1, $2, 'like')`,
      [post.id, liker.id],
    );

    const res = await request(app).get('/posts/hot');

    expect(res.status).toBe(200);
    expect(res.body.some((p) => p.title === 'Trending Post')).toBe(true);
  });

  // Boundary: no posts in the last 7 days
  test('should return an empty array when there are no recent posts', async () => {
    const res = await request(app).get('/posts/hot');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────
// GET /posts/tag/:category
// ─────────────────────────────────────────────────────────
describe('GET /posts/tag/:category', () => {
  // Valid partition: returns only posts belonging to the category
  test('should return 200 and an empty array when the category has no posts', async () => {
    const user = await createTestUser('CategoryUser', 'category@example.com');

    await pool.query(
      `INSERT INTO "Posts" (user_id, title, category, content)
       VALUES
       ($1, 'General Post', 'general', 'General content'),
       ($1, 'Question', 'qna', 'Question content'),
       ($1, 'Another General', 'general', 'More content')`,
      [user.id],
    );

    const res = await request(app).get('/posts/tag/general');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    res.body.forEach((post) => {
      expect(post.category).toBe('general');
    });
  });

  // Boundary: no posts exist for the category
  test('should return 200 and an empty array when no posts match the category', async () => {
    const user = await createTestUser('EmptyCategoryUser', 'emptycategory@example.com');

    await pool.query(
      `INSERT INTO "Posts" (user_id, title, category, content)
       VALUES ($1, 'General Post', 'general', 'Content')`,
      [user.id],
    );

    const res = await request(app).get('/posts/tag/events');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Invalid partition: unknown category value
  test('should return 200 and an empty array for an invalid category', async () => {
    const res = await request(app).get('/posts/tag/events');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// GET /posts/:id
// ─────────────────────────────────────────────────────────
describe('GET /posts/:id', () => {
  // Valid partition: existing post id returns the correct post
  test('should return 200 and the requested post', async () => {
    const user = await createTestUser('SinglePostUser', 'singlepost@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'My Post', 'general', 'Hello World')
      RETURNING id`,
      [user.id],
    );

    const postId = rows[0].id;

    const res = await request(app).get(`/posts/${postId}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(postId);
    expect(res.body.title).toBe('My Post');
    expect(res.body.category).toBe('general');
    expect(res.body.content).toBe('Hello World');
    expect(res.body.user_id).toBe(user.id);
  });

  // Boundary: non-existent id
  test('should return 404 when the post does not exist', async () => {
    const res = await request(app).get('/posts/999999');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBe('Post not found');
  });

  // Boundary: id = 0
  test('should return 404 for id = 0 (boundary)', async () => {
    const res = await request(app).get('/posts/0');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBe('Post not found');
  });
});

// ─────────────────────────────────────────────────────────
// GET /posts/related/:category/:id
// ─────────────────────────────────────────────────────────
describe('GET /posts/related/:category/:id', () => {
  // Valid partition: returns related posts from the same category
  test('should return related posts from the same category', async () => {
    const user = await createTestUser('RelatedUser', 'related@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES
      ($1, 'Current Post', 'general', 'Current'),
      ($1, 'Related One', 'general', 'Related 1'),
      ($1, 'Related Two', 'general', 'Related 2'),
      ($1, 'Different Category', 'qna', 'Not related')
      RETURNING id`,
      [user.id],
    );

    const currentPostId = rows[0].id;

    const res = await request(app).get(`/posts/related/general/${currentPostId}`);

    expect(res.status).toBe(200);

    res.body.forEach((post) => {
      expect(post.category).toBe('general');
      expect(post.id).not.toBe(currentPostId);
    });
  });

  // Boundary: no related posts exist
  test('should return an empty array when no related posts exist', async () => {
    const user = await createTestUser('LonelyUser', 'lonely@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Only General Post', 'general', 'Content')
      RETURNING id`,
      [user.id],
    );

    const postId = rows[0].id;

    const res = await request(app).get(`/posts/related/general/${postId}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Boundary: non-existent post id
  test('should return an empty array for a non-existent post id', async () => {
    const res = await request(app).get('/posts/related/general/999999');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// GET /posts/user/:user_id
// ─────────────────────────────────────────────────────────
describe('GET /posts/user/:user_id', () => {
  // Valid partition: publicly viewable, like a profile page
  test("should return a user's posts without requiring authentication", async () => {
    const author = await createTestUser('ProfilePostAuthor', 'profilepostauthor@example.com');
    await createTestPost(author.id, 'Profile Visible Post');

    const res = await request(app).get(`/posts/user/${author.id}`);

    expect(res.status).toBe(200);
    expect(res.body.some((p) => p.title === 'Profile Visible Post')).toBe(true);
  });

  // Boundary: user has no posts
  test('should return an empty array for a user with no posts', async () => {
    const user = await createTestUser('NoPostsProfileUser', 'nopostsprofileuser@example.com');

    const res = await request(app).get(`/posts/user/${user.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// POST /posts
// ─────────────────────────────────────────────────────────
describe('POST /posts', () => {
  // Valid partition: create a new post successfully
  test('should return 201 and create a new post', async () => {
    const user = await createTestUser('CreatePostUser', 'createpost@example.com');

    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${user.token}`)
      .field('user_id', user.id)
      .field('title', 'My First Post')
      .field('category', 'general')
      .field('content', 'Hello everyone!');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('My First Post');
    expect(res.body.category).toBe('general');
    expect(res.body.content).toBe('Hello everyone!');
    expect(res.body.user_id).toBe(user.id);
  });

  // Boundary: malformed tag is ignored and the post still creates
  test('should still create a post when tag data is malformed JSON', async () => {
    const user = await createTestUser('TagJsonUser', 'tagjson@example.com');

    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${user.token}`)
      .field('user_id', user.id)
      .field('title', 'Tag JSON Post')
      .field('category', 'general')
      .field('content', 'Hello tags')
      .field('tags', '{bad json');

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Tag JSON Post');
  });

  // Invalid partition: required fields missing
  test('should return 400 when required fields are missing', async () => {
    const actor = await createTestUser('IncompletePostUser', 'incompletepostuser@example.com');

    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${actor.token}`)
      .field('title', 'Incomplete Post');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/undefined/i);
  });

  // Valid partition: well-formed tag JSON attaches real tags to the post
  test('should attach real tags to the post when valid tag JSON is provided', async () => {
    const user = await createTestUser('ValidTagsUser', 'validtagsuser@example.com');

    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${user.token}`)
      .field('user_id', user.id)
      .field('title', 'Tagged Post')
      .field('category', 'general')
      .field('content', 'Content with tags')
      .field('tags', JSON.stringify(['music', 'events']));

    expect(res.status).toBe(201);

    const tagsRes = await request(app).get(`/posts/${res.body.id}/tags`);
    expect(tagsRes.body.map((t) => t.name).sort()).toEqual(['events', 'music']);
  });

  // Error handling: a foreign key violation falls through to the generic catch
  test('should return 500 when creating a post with a non-existent user_id', async () => {
    const actor = await createTestUser('GhostAuthorPoster', 'ghostauthorposter@example.com');

    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${actor.token}`)
      .field('user_id', 999999999)
      .field('title', 'Ghost Author Post')
      .field('category', 'general')
      .field('content', 'Nobody made this');

    expect(res.status).toBe(500);
  });

  // Boundary: an @mention that doesn't match a real user is silently ignored
  test('should not notify anyone when the @mention does not match a real user', async () => {
    const author = await createTestUser('NoMatchMentionAuthor', 'nomatchmentionauthor@example.com');
    const notifySpy = jest.spyOn(Notification, 'create');

    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${author.token}`)
      .field('user_id', author.id)
      .field('title', 'Ghost Mention Post')
      .field('category', 'general')
      .field('content', 'Hey @NobodyRealHere check this out');

    expect(res.status).toBe(201);

    // Give the fire-and-forget mention notification time to run
    await new Promise((resolve) => setTimeout(resolve, 100));
    // A first post can legitimately trigger an unrelated badge_unlocked
    // notification, so only assert that no *mention* notification fired.
    expect(notifySpy).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'mention' }),
    );

    notifySpy.mockRestore();
  });

  // Valid partition: an @mention matching a real user creates a notification
  test('should create a notification for a user mentioned by @name', async () => {
    const author = await createTestUser('MentionAuthor', 'mentionauthor@example.com');
    const mentioned = await createTestUser('MentionedFriend', 'mentionedfriend@example.com');
    const notifySpy = jest.spyOn(Notification, 'create');

    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${author.token}`)
      .field('user_id', author.id)
      .field('title', 'Mention Post')
      .field('category', 'general')
      .field('content', 'Hey @MentionedFriend check this out');

    expect(res.status).toBe(201);

    // Give the fire-and-forget mention notification time to run
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(notifySpy).toHaveBeenCalledWith(
      mentioned.id,
      expect.objectContaining({ type: 'mention', ref_id: res.body.id }),
    );

    notifySpy.mockRestore();
  });

  // Boundary: an anonymous post skips mention notifications even when a real user is mentioned
  test('should not notify a mentioned user when the post is anonymous', async () => {
    const author = await createTestUser('AnonMentionAuthor', 'anonmentionauthor@example.com');
    await createTestUser('AnonMentionedFriend', 'anonmentionedfriend@example.com');
    const notifySpy = jest.spyOn(Notification, 'create');

    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${author.token}`)
      .field('user_id', author.id)
      .field('title', 'Anonymous Mention Post')
      .field('category', 'general')
      .field('content', 'Hey @AnonMentionedFriend check this out')
      .field('is_anonymous', 'true');

    expect(res.status).toBe(201);

    // Give any fire-and-forget notification time to run
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(notifySpy).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'mention' }),
    );

    notifySpy.mockRestore();
  });

  // Error handling: a failed badge check is swallowed and doesn't affect the 201 response
  test('should still return 201 when the post-created badge check fails', async () => {
    const author = await createTestUser('BadgeFailAuthor', 'badgefailauthor@example.com');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    checkAndAwardBadges.mockRejectedValueOnce(new Error('Badge check boom'));

    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${author.token}`)
      .field('user_id', author.id)
      .field('title', 'Badge Fail Post')
      .field('category', 'general')
      .field('content', 'Content');

    expect(res.status).toBe(201);

    // Give the fire-and-forget badge check time to run and fail
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(warnSpy).toHaveBeenCalledWith('Badge check error:', 'Badge check boom');

    warnSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────
// PUT /posts/:id
// ─────────────────────────────────────────────────────────
describe('PUT /posts/:id', () => {
  // Valid partition: update an existing post
  test('should return 200 and update the post', async () => {
    const user = await createTestUser('UpdateUser', 'update@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Old Title', 'general', 'Old content')
      RETURNING id`,
      [user.id],
    );

    const postId = rows[0].id;

    const res = await request(app)
      .put(`/posts/${postId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .field('title', 'New Title')
      .field('category', 'qna')
      .field('content', 'Updated content');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(postId);
    expect(res.body.title).toBe('New Title');
    expect(res.body.category).toBe('qna');
    expect(res.body.content).toBe('Updated content');
  });

  // Valid partition: verify updated values
  test('updated post should persist in the database', async () => {
    const user = await createTestUser('PersistUpdateUser', 'persistupdate@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Before', 'general', 'Old content')
      RETURNING id`,
      [user.id],
    );

    const postId = rows[0].id;

    await request(app)
      .put(`/posts/${postId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .field('title', 'After')
      .field('category', 'news')
      .field('content', 'New content');

    const getRes = await request(app).get(`/posts/${postId}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.title).toBe('After');
    expect(getRes.body.category).toBe('news');
    expect(getRes.body.content).toBe('New content');
  });

  // Boundary: remove_attachment=true clears the stored attachment reference
  test('should remove the attachment reference when remove_attachment is true', async () => {
    const user = await createTestUser('RemoveAttachmentUser', 'removeattachment@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content, attachment_url)
      VALUES ($1, 'With Attachment', 'general', 'Content', '/uploads/old-file.png')
      RETURNING id`,
      [user.id],
    );

    const postId = rows[0].id;

    const res = await request(app)
      .put(`/posts/${postId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .field('remove_attachment', 'true')
      .field('title', 'Attachment Removed')
      .field('category', 'general')
      .field('content', 'Content');

    expect(res.status).toBe(200);
    expect(res.body.attachment_url).toBeNull();
  });

  // Invalid partition: a non-owner cannot edit another user's post
  test('should return 403 when a non-owner tries to edit the post', async () => {
    const owner = await createTestUser('EditOwner', 'editowner@example.com');
    const post = await createTestPost(owner.id, 'Original Title');

    const intruder = await createTestUser('EditIntruder', 'editintruder@example.com');

    const res = await request(app)
      .put(`/posts/${post.id}`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .field('title', 'Hijacked Title')
      .field('content', 'Hijacked content')
      .field('category', 'general');

    expect(res.status).toBe(403);
  });

  // Valid partition: an admin can edit another user's post
  test("should allow an admin to edit another user's post", async () => {
    const owner = await createTestUser('AdminEditOwner', 'admineditowner@example.com');
    const post = await createTestPost(owner.id, 'Original Title');

    const admin = await createTestUser('AdminEditUser', 'admineditsuser@example.com');
    await promoteToAdmin(admin);

    const res = await request(app)
      .put(`/posts/${post.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .field('title', 'Edited By Admin')
      .field('content', 'Edited content')
      .field('category', 'general');

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Edited By Admin');
  });

  // Boundary: non-existent id
  test('should return 404 when updating a non-existent post', async () => {
    const actor = await createTestUser('EditGhostUser', 'editghostuser@example.com');

    const res = await request(app)
      .put('/posts/999999')
      .set('Authorization', `Bearer ${actor.token}`)
      .field('title', 'Ghost')
      .field('category', 'general')
      .field('content', 'Ghost content');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/post not found/i);
  });

  // Boundary: uploading a new file replaces an existing attachment
  test('should replace an existing attachment when a new file is uploaded', async () => {
    const user = await createTestUser('ReplaceAttachmentUser', 'replaceattachmentuser@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content, attachment_url)
      VALUES ($1, 'Has Attachment', 'general', 'Content', '/uploads/old-file.png')
      RETURNING id`,
      [user.id],
    );

    const postId = rows[0].id;

    const res = await request(app)
      .put(`/posts/${postId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .field('title', 'New Attachment')
      .field('category', 'general')
      .field('content', 'Content')
      .attach('attachment', Buffer.from('fake image bytes'), 'new-file.png');

    expect(res.status).toBe(200);
    expect(res.body.attachment_url).toMatch(/^\/uploads\//);
  });

  // Boundary: uploading a new file when the post had no prior attachment
  test('should attach a new file when the post had no prior attachment', async () => {
    const user = await createTestUser('NewAttachmentUser', 'newattachmentuser@example.com');
    const post = await createTestPost(user.id, 'No Attachment Yet');

    const res = await request(app)
      .put(`/posts/${post.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .field('title', 'Now With Attachment')
      .field('category', 'general')
      .field('content', 'Content')
      .attach('attachment', Buffer.from('fake image bytes'), 'first-file.png');

    expect(res.status).toBe(200);
    expect(res.body.attachment_url).toMatch(/^\/uploads\//);
  });

  // Error handling: an out-of-range post id triggers a database error
  test('should return 500 for an out-of-range post id', async () => {
    const actor = await createTestUser('UpdateOverflowUser', 'updateoverflowuser@example.com');

    const res = await request(app)
      .put('/posts/99999999999')
      .set('Authorization', `Bearer ${actor.token}`)
      .field('title', 'x')
      .field('category', 'general')
      .field('content', 'x');

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────
// DELETE /posts/:id
// ─────────────────────────────────────────────────────────
describe('DELETE /posts/:id', () => {
  // Valid partition: owner deletes their own post
  test('should return 200 and delete the post', async () => {
    const user = await createTestUser('DeleteOwner', 'deleteowner@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Delete Me', 'general', 'Content')
      RETURNING id`,
      [user.id],
    );

    const postId = rows[0].id;

    const res = await request(app)
      .delete(`/posts/${postId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(postId);

    const check = await request(app).get(`/posts/${postId}`);

    expect(check.status).toBe(404);
  });

  // Valid partition: an admin can delete another user's post
  test("should allow an admin to delete another user's post", async () => {
    const owner = await createTestUser('AdminDeleteOwner', 'admindeleteowner@example.com');
    const post = await createTestPost(owner.id, 'Admin Delete Me');

    const admin = await createTestUser('AdminDeleteUser', 'admindeleteuser@example.com');
    await promoteToAdmin(admin);

    const res = await request(app)
      .delete(`/posts/${post.id}`)
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(post.id);
  });

  // Invalid partition: authenticated user is not the owner
  test("should return 403 when deleting another user's post", async () => {
    const owner = await createTestUser('PostOwner', 'owner@example.com');

    const stranger = await createTestUser('OtherUser', 'other@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Protected Post', 'general', 'Content')
      RETURNING id`,
      [owner.id],
    );

    const postId = rows[0].id;

    const res = await request(app)
      .delete(`/posts/${postId}`)
      .set('Authorization', `Bearer ${stranger.token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not authorized/i);
  });

  // Boundary: non-existent id
  test('should return 404 when deleting a non-existent post', async () => {
    const user = await createTestUser('GhostDelete', 'ghostdelete@example.com');

    const res = await request(app)
      .delete('/posts/999999')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/post not found/i);
  });

  // Error handling: an out-of-range post id makes the getPostByID lookup throw
  test('should return 500 for an out-of-range post id', async () => {
    const actor = await createTestUser('DeleteOverflowUser', 'deleteoverflowuser@example.com');

    const res = await request(app)
      .delete('/posts/99999999999')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(res.status).toBe(500);
  });

  // Error handling: deletePostByID fails after the post was found and authorized
  test('should return 500 when deletePostByID fails unexpectedly', async () => {
    const owner = await createTestUser('DeleteFailOwner', 'deletefailowner@example.com');
    const post = await createTestPost(owner.id);

    PostsModel.deletePostByID.mockRejectedValueOnce(new Error('Delete boom'));

    const res = await request(app)
      .delete(`/posts/${post.id}`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(500);
  });

  // Boundary: deletePostByID resolves falsy even though the post was found and authorized
  // (e.g. it was already removed by another request in between)
  test('should return 404 when deletePostByID resolves falsy after authorization passes', async () => {
    const owner = await createTestUser('DeleteRaceOwner', 'deleteraceowner@example.com');
    const post = await createTestPost(owner.id);

    PostsModel.deletePostByID.mockResolvedValueOnce(null);

    const res = await request(app)
      .delete(`/posts/${post.id}`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/post not found/i);
  });
});

// ─────────────────────────────────────────────────────────
// GET /posts/sorted
// ─────────────────────────────────────────────────────────
describe('GET /posts/sorted', () => {
  // Valid partition: defaults to newest first
  test('should return posts newest-first by default', async () => {
    const author = await createTestUser('SortedPostsAuthor', 'sortedpostsauthor@example.com');
    await createTestPost(author.id, 'Older Sorted Post');
    await createTestPost(author.id, 'Newer Sorted Post');

    const res = await request(app).get('/posts/sorted');

    expect(res.status).toBe(200);
    expect(res.body[0].title).toBe('Newer Sorted Post');
  });

  // Valid partition: oldest first
  test('should return posts oldest-first when sort=oldest', async () => {
    const author = await createTestUser('OldestSortAuthor', 'oldestsortauthor@example.com');
    await createTestPost(author.id, 'First Post');
    await createTestPost(author.id, 'Second Post');

    const res = await request(app).get('/posts/sorted').query({ sort: 'oldest' });

    expect(res.status).toBe(200);
    expect(res.body[0].title).toBe('First Post');
  });

  // Boundary: category filter narrows results
  test('should filter by category when provided', async () => {
    const author = await createTestUser('CategorySortAuthor', 'categorysortauthor@example.com');
    await pool.query(
      `INSERT INTO "Posts" (user_id, title, category, content) VALUES ($1, 'Confession Post', 'confession', 'x')`,
      [author.id],
    );
    await pool.query(
      `INSERT INTO "Posts" (user_id, title, category, content) VALUES ($1, 'General Post', 'general', 'x')`,
      [author.id],
    );

    const res = await request(app).get('/posts/sorted').query({ category: 'confession' });

    expect(res.status).toBe(200);
    expect(res.body.every((p) => p.category === 'confession')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────
// GET /posts/admin/all
// ─────────────────────────────────────────────────────────
describe('GET /posts/admin/all', () => {
  // Valid partition: an admin can search/filter all posts
  test('should return matching posts for an admin', async () => {
    const admin = await createTestUser('AdminSearchUser', 'adminsearchuser@example.com');
    await promoteToAdmin(admin);
    await createTestPost(admin.id, 'Findable Admin Post');

    const res = await request(app)
      .get('/posts/admin/all')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({ search: 'Findable' });

    expect(res.status).toBe(200);
    expect(res.body.some((p) => p.title === 'Findable Admin Post')).toBe(true);
  });

  // Invalid partition: a non-admin is blocked
  test('should return 403 for a non-admin user', async () => {
    const user = await createTestUser('NonAdminSearchUser', 'nonadminsearchuser@example.com');

    const res = await request(app)
      .get('/posts/admin/all')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(403);
  });

  // Boundary: no posts match the given filters
  test('should return an empty array when nothing matches the filters', async () => {
    const admin = await createTestUser('NoMatchAdmin', 'nomatchadmin@example.com');
    await promoteToAdmin(admin);

    const res = await request(app)
      .get('/posts/admin/all')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({ search: 'zzz-no-match-zzz' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Error handling: searchAllPosts fails unexpectedly
  test('should return 500 when searchAllPosts fails unexpectedly', async () => {
    const admin = await createTestUser('AdminAllFailUser', 'adminallfailuser@example.com');
    await promoteToAdmin(admin);

    PostsModel.searchAllPosts.mockRejectedValueOnce(new Error('Search boom'));

    const res = await request(app)
      .get('/posts/admin/all')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(500);
  });
});

// ==================== Poll Posts ========================
// ─────────────────────────────────────────────────────────
// GET /posts/:id/poll
// ─────────────────────────────────────────────────────────
describe('GET /posts/:id/poll', () => {
  // Valid partition: poll exists and returns question with options
  test('should return 200 and the poll with its options', async () => {
    const user = await createTestUser('PollOwner', 'pollowner@example.com');

    const { rows: postRows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Poll Post', 'general', 'Content')
      RETURNING id`,
      [user.id],
    );

    const postId = postRows[0].id;

    const { rows: pollRows } = await pool.query(
      `INSERT INTO "PostPolls"
      (post_id, question)
      VALUES ($1, 'Favourite language?')
      RETURNING id`,
      [postId],
    );

    const pollId = pollRows[0].id;

    await pool.query(
      `INSERT INTO "PollOptions"
      (poll_id, option_text)
      VALUES
      ($1,'JavaScript'),
      ($1,'Python')`,
      [pollId],
    );

    const res = await request(app).get(`/posts/${postId}/poll`);

    expect(res.status).toBe(200);
    expect(res.body.question).toBe('Favourite language?');
    expect(res.body.options).toHaveLength(2);
  });

  // Boundary: post has no poll
  test('should return 404 when the post has no poll', async () => {
    const user = await createTestUser('NoPollUser', 'nopoll@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id,title,category,content)
      VALUES($1,'Normal Post','general','Content')
      RETURNING id`,
      [user.id],
    );

    const res = await request(app).get(`/posts/${rows[0].id}/poll`);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/no poll/i);
  });

  // Boundary: post id does not exist
  test('should return 404 for a non-existent post', async () => {
    const res = await request(app).get('/posts/999999/poll');

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/no poll/i);
  });
});

// ─────────────────────────────────────────────────────────
// POST /posts/:id/poll
// ─────────────────────────────────────────────────────────
describe('POST /posts/:id/poll', () => {
  // Valid partition: create a poll with two options
  test('should return 201 and create a poll', async () => {
    const user = await createTestUser('CreatePollUser', 'createpoll@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Poll Post', 'general', 'Content')
      RETURNING id`,
      [user.id],
    );

    const postId = rows[0].id;

    const res = await request(app)
      .post(`/posts/${postId}/poll`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        question: 'Favourite programming language?',
        options: ['JavaScript', 'Python'],
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.question).toBe('Favourite programming language?');
    expect(res.body.options).toHaveLength(2);
  });

  // Valid partition: verify poll in the database
  test('created poll should persist', async () => {
    const user = await createTestUser('PersistPollUser', 'persistpoll@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Poll Post', 'general', 'Content')
      RETURNING id`,
      [user.id],
    );

    const postId = rows[0].id;

    await request(app)
      .post(`/posts/${postId}/poll`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        question: 'Favourite IDE?',
        options: ['VS Code', 'WebStorm'],
      });

    const res = await request(app).get(`/posts/${postId}/poll`);

    expect(res.status).toBe(200);
    expect(res.body.question).toBe('Favourite IDE?');
    expect(res.body.options).toHaveLength(2);
  });

  // Invalid partition: fewer than two options
  test('should return 400 when fewer than two options are provided', async () => {
    const user = await createTestUser('InvalidPollUser', 'invalidpoll@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Poll Post', 'general', 'Content')
      RETURNING id`,
      [user.id],
    );

    const postId = rows[0].id;

    const res = await request(app)
      .post(`/posts/${postId}/poll`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        question: 'Invalid poll',
        options: ['Only one'],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least 2 options/i);
  });

  // Invalid partition: a non-owner cannot add a poll to another user's post
  test('should return 403 when a non-owner tries to add a poll to the post', async () => {
    const owner = await createTestUser('PollOwnerGuard', 'pollownerguard@example.com');
    const post = await createTestPost(owner.id);

    const intruder = await createTestUser('PollIntruder', 'pollintruder@example.com');

    const res = await request(app)
      .post(`/posts/${post.id}/poll`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .send({ question: 'Hijacked poll?', options: ['A', 'B'] });

    expect(res.status).toBe(403);
  });

  // Boundary: post does not exist
  test('should return 404 when creating a poll on a non-existent post', async () => {
    const actor = await createTestUser('PollGhostUser', 'pollghostuser@example.com');

    const res = await request(app)
      .post('/posts/999999999/poll')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ question: 'Ghost poll?', options: ['A', 'B'] });

    expect(res.status).toBe(404);
  });

  // Error handling: insertPoll fails unexpectedly
  test('should return 500 when creating the poll fails unexpectedly', async () => {
    const owner = await createTestUser('PollCreateFailOwner', 'pollcreatefailowner@example.com');
    const post = await createTestPost(owner.id);

    PostsModel.insertPoll.mockRejectedValueOnce(new Error('Poll insert boom'));

    const res = await request(app)
      .post(`/posts/${post.id}/poll`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ question: 'Pick one', options: ['A', 'B'] });

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────
// PUT /posts/:id/poll
// ─────────────────────────────────────────────────────────
describe('PUT /posts/:id/poll', () => {
  // Valid partition: owner updates the poll question
  test('should update the poll question for the owner', async () => {
    const owner = await createTestUser('PollEditOwner', 'polleditowner@example.com');
    const post = await createTestPost(owner.id);
    await pool.query(`INSERT INTO "PostPolls" (post_id, question) VALUES ($1, 'Old question?')`, [
      post.id,
    ]);

    const res = await request(app)
      .put(`/posts/${post.id}/poll`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ question: 'New question?' });

    expect(res.status).toBe(200);
    expect(res.body.question).toBe('New question?');
  });

  // Boundary: missing question
  test('should return 400 when question is missing', async () => {
    const owner = await createTestUser('PollEditNoQuestion', 'polleditnoquestion@example.com');
    const post = await createTestPost(owner.id);
    await pool.query(`INSERT INTO "PostPolls" (post_id, question) VALUES ($1, 'Old question?')`, [
      post.id,
    ]);

    const res = await request(app)
      .put(`/posts/${post.id}/poll`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  // Boundary: post has no poll to update
  test('should return 404 when the post has no poll', async () => {
    const owner = await createTestUser('PollEditNoPoll', 'polleditnopoll@example.com');
    const post = await createTestPost(owner.id);

    const res = await request(app)
      .put(`/posts/${post.id}/poll`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ question: 'New question?' });

    expect(res.status).toBe(404);
  });

  // Boundary: the post itself does not exist (distinct from "post exists, no poll")
  test('should return 404 when the post itself does not exist', async () => {
    const actor = await createTestUser('PollEditGhostUser', 'polleditghostuser@example.com');

    const res = await request(app)
      .put('/posts/999999999/poll')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ question: 'New question?' });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/post not found/i);
  });

  // Invalid partition: a non-owner cannot edit the poll question
  test('should return 403 when a non-owner tries to edit the poll question', async () => {
    const owner = await createTestUser('PollEditGuardOwner', 'polleditguardowner@example.com');
    const post = await createTestPost(owner.id);
    await pool.query(`INSERT INTO "PostPolls" (post_id, question) VALUES ($1, 'Old question?')`, [
      post.id,
    ]);

    const intruder = await createTestUser('PollEditIntruder', 'polleditintruder@example.com');

    const res = await request(app)
      .put(`/posts/${post.id}/poll`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .send({ question: 'Hijacked question?' });

    expect(res.status).toBe(403);
  });

  // Error handling: updatePollQuestion fails unexpectedly
  test('should return 500 when updating the poll fails unexpectedly', async () => {
    const owner = await createTestUser('PollUpdateFailOwner', 'pollupdatefailowner@example.com');
    const post = await createTestPost(owner.id);
    await pool.query(`INSERT INTO "PostPolls" (post_id, question) VALUES ($1, 'Old question?')`, [
      post.id,
    ]);

    PostsModel.updatePollQuestion.mockRejectedValueOnce(new Error('Poll update boom'));

    const res = await request(app)
      .put(`/posts/${post.id}/poll`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ question: 'New question?' });

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────
// POST /posts/:id/poll/vote
// ─────────────────────────────────────────────────────────
describe('POST /posts/:id/poll/vote', () => {
  // Valid partition: user votes successfully
  test('should return 201 and create a vote', async () => {
    const user = await createTestUser('VoteUser', 'voteuser@example.com');

    const { rows: postRows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Poll Post', 'general', 'Content')
      RETURNING id`,
      [user.id],
    );

    const postId = postRows[0].id;

    const { rows: pollRows } = await pool.query(
      `INSERT INTO "PostPolls"
      (post_id, question)
      VALUES ($1, 'Favourite language?')
      RETURNING id`,
      [postId],
    );

    const pollId = pollRows[0].id;

    const { rows: optionRows } = await pool.query(
      `INSERT INTO "PollOptions"
      (poll_id, option_text)
      VALUES ($1, 'JavaScript')
      RETURNING id`,
      [pollId],
    );

    const optionId = optionRows[0].id;

    const res = await request(app)
      .post(`/posts/${postId}/poll/vote`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        poll_id: pollId,
        option_id: optionId,
      });

    expect(res.status).toBe(201);
    expect(res.body.vote).toHaveProperty('id');
    expect(res.body.vote.poll_id).toBe(pollId);
    expect(res.body.vote.option_id).toBe(optionId);
    expect(res.body.poll.options[0].vote_count).toBe(1);
  });

  // Invalid partition: duplicate vote
  test('should return 409 when the user has already voted', async () => {
    const user = await createTestUser('DuplicateVoteUser', 'duplicatevote@example.com');

    const { rows: postRows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Poll Post', 'general', 'Content')
      RETURNING id`,
      [user.id],
    );

    const postId = postRows[0].id;

    const { rows: pollRows } = await pool.query(
      `INSERT INTO "PostPolls"
      (post_id, question)
      VALUES ($1, 'Favourite IDE?')
      RETURNING id`,
      [postId],
    );

    const pollId = pollRows[0].id;

    const { rows: optionRows } = await pool.query(
      `INSERT INTO "PollOptions"
      (poll_id, option_text)
      VALUES ($1, 'VS Code')
      RETURNING id`,
      [pollId],
    );

    const optionId = optionRows[0].id;

    await request(app)
      .post(`/posts/${postId}/poll/vote`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        poll_id: pollId,
        option_id: optionId,
      });

    const res = await request(app)
      .post(`/posts/${postId}/poll/vote`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        poll_id: pollId,
        option_id: optionId,
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already voted/i);
  });

  // Invalid partition: poll_id in the body doesn't match the poll on this post
  test('should return 400 when poll_id does not match the poll on this post', async () => {
    const user = await createTestUser('VoteMismatchUser', 'votemismatchuser@example.com');
    const postA = await createTestPost(user.id, 'Poll Post A');
    const postB = await createTestPost(user.id, 'Poll Post B');

    await pool.query(`INSERT INTO "PostPolls" (post_id, question) VALUES ($1, 'A?')`, [postA.id]);
    const { rows: pollBRows } = await pool.query(
      `INSERT INTO "PostPolls" (post_id, question) VALUES ($1, 'B?') RETURNING id`,
      [postB.id],
    );
    const { rows: optionRows } = await pool.query(
      `INSERT INTO "PollOptions" (poll_id, option_text) VALUES ($1, 'Opt') RETURNING id`,
      [pollBRows[0].id],
    );

    // voting via postA's URL but with pollB's id
    const res = await request(app)
      .post(`/posts/${postA.id}/poll/vote`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        poll_id: pollBRows[0].id,
        option_id: optionRows[0].id,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/does not match/i);
  });

  // Invalid partition: option_id doesn't belong to the given poll_id
  test('should return 400 when option_id does not belong to the given poll_id', async () => {
    const user = await createTestUser(
      'VoteOptionMismatchUser',
      'voteoptionmismatchuser@example.com',
    );
    const post = await createTestPost(user.id);
    const otherPost = await createTestPost(user.id, 'Unrelated Post');

    const { rows: pollRows } = await pool.query(
      `INSERT INTO "PostPolls" (post_id, question) VALUES ($1, 'Real poll?') RETURNING id`,
      [post.id],
    );
    await pool.query(
      `INSERT INTO "PollOptions" (poll_id, option_text) VALUES ($1, 'Real option')`,
      [pollRows[0].id],
    );

    const { rows: otherPollRows } = await pool.query(
      `INSERT INTO "PostPolls" (post_id, question) VALUES ($1, 'Other poll?') RETURNING id`,
      [otherPost.id],
    );
    const { rows: otherOptionRows } = await pool.query(
      `INSERT INTO "PollOptions" (poll_id, option_text) VALUES ($1, 'Other option') RETURNING id`,
      [otherPollRows[0].id],
    );

    const res = await request(app)
      .post(`/posts/${post.id}/poll/vote`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        poll_id: pollRows[0].id,
        option_id: otherOptionRows[0].id,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/does not belong/i);
  });

  // Invalid partition: missing required fields
  test('should return 400 when poll_id or option_id is missing', async () => {
    const user = await createTestUser('MissingVoteUser', 'missingvote@example.com');

    const res = await request(app)
      .post('/posts/1/poll/vote')
      .set('Authorization', `Bearer ${user.token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  // Error handling: insertPollVote fails for a reason other than a duplicate vote
  test('should return 500 when voting fails for a reason other than a duplicate vote', async () => {
    const owner = await createTestUser('PollVoteFailOwner', 'pollvotefailowner@example.com');
    const post = await createTestPost(owner.id);
    const { rows: pollRows } = await pool.query(
      `INSERT INTO "PostPolls" (post_id, question) VALUES ($1, 'Pick one') RETURNING id`,
      [post.id],
    );
    const { rows: optionRows } = await pool.query(
      `INSERT INTO "PollOptions" (poll_id, option_text) VALUES ($1, 'A') RETURNING id`,
      [pollRows[0].id],
    );

    const voter = await createTestUser('PollVoteFailUser', 'pollvotefailuser@example.com');
    PostsModel.insertPollVote.mockRejectedValueOnce(new Error('Vote insert boom'));

    const res = await request(app)
      .post(`/posts/${post.id}/poll/vote`)
      .set('Authorization', `Bearer ${voter.token}`)
      .send({
        poll_id: pollRows[0].id,
        option_id: optionRows[0].id,
      });

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────
// GET /posts/:id/poll/vote/:user_id
// ─────────────────────────────────────────────────────────
describe('GET /posts/:id/poll/vote/:user_id', () => {
  // Valid partition: user gets their own vote
  test("should return the authenticated user's own vote", async () => {
    const user = await createTestUser('VoteLookupUser', 'votelookupuser@example.com');
    const post = await createTestPost(user.id);
    const { rows: pollRows } = await pool.query(
      `INSERT INTO "PostPolls" (post_id, question) VALUES ($1, 'Q?') RETURNING id`,
      [post.id],
    );
    const { rows: optionRows } = await pool.query(
      `INSERT INTO "PollOptions" (poll_id, option_text) VALUES ($1, 'Opt') RETURNING id`,
      [pollRows[0].id],
    );
    await pool.query(`INSERT INTO "PollVotes" (poll_id, option_id, user_id) VALUES ($1, $2, $3)`, [
      pollRows[0].id,
      optionRows[0].id,
      user.id,
    ]);

    const res = await request(app)
      .get(`/posts/${post.id}/poll/vote/${user.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.vote).not.toBeNull();
    expect(res.body.vote.option_id).toBe(optionRows[0].id);
  });

  // Boundary: user hasn't voted yet
  test('should return vote: null when the user has not voted', async () => {
    const user = await createTestUser('VoteLookupNoVoteUser', 'votelookupnovoteuser@example.com');
    const post = await createTestPost(user.id);
    await pool.query(`INSERT INTO "PostPolls" (post_id, question) VALUES ($1, 'Q?')`, [post.id]);

    const res = await request(app)
      .get(`/posts/${post.id}/poll/vote/${user.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.vote).toBeNull();
  });

  // Boundary: the post has no poll at all (distinct from "poll exists, no vote yet")
  test('should return 404 when the post has no poll', async () => {
    const user = await createTestUser('VoteLookupNoPollUser', 'votelookupnopolluser@example.com');
    const post = await createTestPost(user.id);

    const res = await request(app)
      .get(`/posts/${post.id}/poll/vote/${user.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/no poll/i);
  });

  // Invalid partition: a user cannot view another user's vote
  test("should return 403 when requesting another user's vote", async () => {
    const owner = await createTestUser('VoteLookupOwner', 'votelookupowner@example.com');
    const post = await createTestPost(owner.id);
    await pool.query(`INSERT INTO "PostPolls" (post_id, question) VALUES ($1, 'Q?')`, [post.id]);

    const stranger = await createTestUser('VoteLookupStranger', 'votelookupstranger@example.com');

    const res = await request(app)
      .get(`/posts/${post.id}/poll/vote/${owner.id}`)
      .set('Authorization', `Bearer ${stranger.token}`);

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────
// DELETE /posts/:id/poll
// ─────────────────────────────────────────────────────────
describe('DELETE /posts/:id/poll', () => {
  // Valid partition: owner deletes the poll
  test('should delete the poll for the owner', async () => {
    const owner = await createTestUser('DeletePollOwner', 'deletepollowner@example.com');
    const post = await createTestPost(owner.id);
    await pool.query(`INSERT INTO "PostPolls" (post_id, question) VALUES ($1, 'Doomed?')`, [
      post.id,
    ]);

    const res = await request(app)
      .delete(`/posts/${post.id}/poll`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);

    const check = await request(app).get(`/posts/${post.id}/poll`);
    expect(check.status).toBe(404);
  });

  // Boundary: post has no poll
  test('should return 404 when the post has no poll', async () => {
    const owner = await createTestUser('NoPollDeleteOwner', 'nopolldeleteowner@example.com');
    const post = await createTestPost(owner.id);

    const res = await request(app)
      .delete(`/posts/${post.id}/poll`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(404);
  });

  // Boundary: the post itself does not exist (distinct from "post exists, no poll")
  test('should return 404 when the post itself does not exist', async () => {
    const actor = await createTestUser('PollDeleteGhostUser', 'polldeleteghostuser@example.com');

    const res = await request(app)
      .delete('/posts/999999999/poll')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/post not found/i);
  });

  // Invalid partition: non-owner is blocked
  test('should return 403 when a non-owner tries to delete the poll', async () => {
    const owner = await createTestUser('GuardedPollOwner', 'guardedpollowner@example.com');
    const post = await createTestPost(owner.id);
    await pool.query(`INSERT INTO "PostPolls" (post_id, question) VALUES ($1, 'Guarded?')`, [
      post.id,
    ]);

    const stranger = await createTestUser('PollDeleteStranger', 'polldeletestranger@example.com');

    const res = await request(app)
      .delete(`/posts/${post.id}/poll`)
      .set('Authorization', `Bearer ${stranger.token}`);

    expect(res.status).toBe(403);
  });

  // Error handling: deletePollByPostID fails unexpectedly
  test('should return 500 when deleting the poll fails unexpectedly', async () => {
    const owner = await createTestUser('PollDeleteFailOwner', 'polldeletefailowner@example.com');
    const post = await createTestPost(owner.id);
    await pool.query(`INSERT INTO "PostPolls" (post_id, question) VALUES ($1, 'Question?')`, [
      post.id,
    ]);

    PostsModel.deletePollByPostID.mockRejectedValueOnce(new Error('Poll delete boom'));

    const res = await request(app)
      .delete(`/posts/${post.id}/poll`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────
// DELETE /posts/:id/poll/vote
// ─────────────────────────────────────────────────────────
describe('DELETE /posts/:id/poll/vote', () => {
  // Valid partition: user removes their own vote
  test("should delete the authenticated user's vote", async () => {
    const user = await createTestUser('RemoveVoteUser', 'removevoteuser@example.com');
    const post = await createTestPost(user.id);
    const { rows: pollRows } = await pool.query(
      `INSERT INTO "PostPolls" (post_id, question) VALUES ($1, 'Q?') RETURNING id`,
      [post.id],
    );
    const { rows: optionRows } = await pool.query(
      `INSERT INTO "PollOptions" (poll_id, option_text) VALUES ($1, 'Opt') RETURNING id`,
      [pollRows[0].id],
    );
    await pool.query(`INSERT INTO "PollVotes" (poll_id, option_id, user_id) VALUES ($1, $2, $3)`, [
      pollRows[0].id,
      optionRows[0].id,
      user.id,
    ]);

    const res = await request(app)
      .delete(`/posts/${post.id}/poll/vote`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ poll_id: pollRows[0].id });

    expect(res.status).toBe(200);
  });

  // Boundary: no poll_id provided
  test('should return 400 when poll_id is missing', async () => {
    const actor = await createTestUser('NoPollIdUser', 'nopollidsuser@example.com');

    const res = await request(app)
      .delete('/posts/1/poll/vote')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  // Boundary: user has not voted
  test('should return 404 when the user has not voted on this poll', async () => {
    const user = await createTestUser('NeverVotedUser', 'nevervoteduser@example.com');
    const post = await createTestPost(user.id);
    const { rows: pollRows } = await pool.query(
      `INSERT INTO "PostPolls" (post_id, question) VALUES ($1, 'Q?') RETURNING id`,
      [post.id],
    );

    const res = await request(app)
      .delete(`/posts/${post.id}/poll/vote`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ poll_id: pollRows[0].id });

    expect(res.status).toBe(404);
  });
});

// ==================== Saved Posts ========================
// ─────────────────────────────────────────────────────────
// GET /posts/saved/:user_id
// ─────────────────────────────────────────────────────────
describe('GET /posts/saved/:user_id', () => {
  // Valid partition: returns the posts a user has saved
  test('should return 200 and the saved posts for the user', async () => {
    const author = await createTestUser('SavedAuthor', 'savedauthor@example.com');

    const { rows: postRows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES
      ($1, 'Saved Post One', 'general', 'Content 1'),
      ($1, 'Saved Post Two', 'qna', 'Content 2')
      RETURNING id`,
      [author.id],
    );

    const saver = await createTestUser('Saver', 'saver@example.com');

    await pool.query(`INSERT INTO "SavedPosts" (user_id, post_id) VALUES ($1, $2)`, [
      saver.id,
      postRows[0].id,
    ]);

    const res = await request(app)
      .get(`/posts/saved/${saver.id}`)
      .set('Authorization', `Bearer ${saver.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  // Boundary: user has not saved anything
  test('should return 200 and an empty array when the user has no saved posts', async () => {
    const user = await createTestUser('NoSavesUser', 'nosaves@example.com');

    const res = await request(app)
      .get(`/posts/saved/${user.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Invalid partition: cannot view another user's saved posts
  test("should return 403 when requesting another user's saved posts", async () => {
    const owner = await createTestUser('SavedPrivacyOwner', 'savedprivacyowner@example.com');
    const intruder = await createTestUser(
      'SavedPrivacyIntruder',
      'savedprivacyintruder@example.com',
    );

    const res = await request(app)
      .get(`/posts/saved/${owner.id}`)
      .set('Authorization', `Bearer ${intruder.token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not authorized/i);
  });
});

// ─────────────────────────────────────────────────────────
// POST /posts/saved
// ─────────────────────────────────────────────────────────
describe('POST /posts/saved', () => {
  // Valid partition: authenticated user saves a post
  test('should return 201 and save the post for the authenticated user', async () => {
    const author = await createTestUser('SaveAuthor', 'saveauthor@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Save Me', 'general', 'Content')
      RETURNING id`,
      [author.id],
    );

    const postId = rows[0].id;
    const saver = await createTestUser('SaverUser', 'saveruser@example.com');
    const res = await request(app)
      .post('/posts/saved')
      .set('Authorization', `Bearer ${saver.token}`)
      .send({ post_id: postId });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.post_id).toBe(postId);
    expect(res.body.user_id).toBe(saver.id);
  });

  // Invalid partition: post_id missing from body
  test('should return 400 when post_id is missing', async () => {
    const actor = await createTestUser('NoPostIdUser', 'nopostid@example.com');

    const res = await request(app)
      .post('/posts/saved')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/post_id/i);
  });

  // Boundary: saving the same post twice
  test('should not allow the same user to save the same post twice', async () => {
    const author = await createTestUser('DupAuthor', 'dupauthor@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Duplicate Save', 'general', 'Content')
      RETURNING id`,
      [author.id],
    );

    const postId = rows[0].id;

    const saver = await createTestUser('DupSaver', 'dupsaver@example.com');

    await request(app)
      .post('/posts/saved')
      .set('Authorization', `Bearer ${saver.token}`)
      .send({ post_id: postId });
    const res = await request(app)
      .post('/posts/saved')
      .set('Authorization', `Bearer ${saver.token}`)
      .send({ post_id: postId });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already saved/i);
  });

  // Error handling: a foreign key violation falls through to the generic catch
  test('should return 500 when saving a post that does not exist', async () => {
    const actor = await createTestUser('BadFkSaveUser', 'badfksaveuser@example.com');

    const res = await request(app)
      .post('/posts/saved')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ post_id: 999999999 });

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────
// DELETE /posts/saved/:id
// ─────────────────────────────────────────────────────────
describe('DELETE /posts/saved/:id', () => {
  // Valid partition: deletes an existing saved post record
  test('should return 200 and delete the saved post', async () => {
    const author = await createTestUser('DeleteSaveAuthor', 'deletesaveauthor@example.com');

    const { rows: postRows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Post', 'general', 'Content')
      RETURNING id`,
      [author.id],
    );

    const saver = await createTestUser('DeleteSaver', 'deletesaver@example.com');

    const { rows: saveRows } = await pool.query(
      `INSERT INTO "SavedPosts" (user_id, post_id)
      VALUES ($1, $2)
      RETURNING id`,
      [saver.id, postRows[0].id],
    );

    const saveId = saveRows[0].id;
    const res = await request(app)
      .delete(`/posts/saved/${saveId}`)
      .set('Authorization', `Bearer ${saver.token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(saveId);

    const check = await pool.query('SELECT * FROM "SavedPosts" WHERE id = $1', [saveId]);
    expect(check.rows).toHaveLength(0);
  });

  // Boundary: non-existent save id
  test('should return 404 when the saved post does not exist', async () => {
    const actor = await createTestUser('MissingSaveUser', 'missingsaveuser@example.com');

    const res = await request(app)
      .delete('/posts/saved/999999')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/save not found/i);
  });

  // Error handling: a non-numeric save id triggers a database error
  test('should return 500 for a non-numeric save id', async () => {
    const actor = await createTestUser('BadSaveIdUser', 'badsaveiduser@example.com');

    const res = await request(app)
      .delete('/posts/saved/not-a-number')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(res.status).toBe(500);
  });
});

// ================== Posts Reactions ======================
// ─────────────────────────────────────────────────────────
// GET /posts/reaction/:user_id
// ─────────────────────────────────────────────────────────
describe('GET /posts/reaction/:user_id', () => {
  // Valid partition: returns the reactions belonging to a user
  test('should return 200 and the reactions for the user', async () => {
    const author = await createTestUser('ReactAuthor', 'reactauthor@example.com');

    const { rows: postRows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Reactable Post', 'general', 'Content')
      RETURNING id`,
      [author.id],
    );

    const reactor = await createTestUser('Reactor', 'reactor@example.com');

    await pool.query(
      `INSERT INTO "PostReactions" (post_id, user_id, reaction_type)
      VALUES ($1, $2, 'like')`,
      [postRows[0].id, reactor.id],
    );

    const res = await request(app)
      .get(`/posts/reaction/${reactor.id}`)
      .set('Authorization', `Bearer ${reactor.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].reaction_type).toBe('like');
  });

  // Boundary: user has not reacted to anything
  test('should return 200 and an empty array when the user has no reactions', async () => {
    const user = await createTestUser('NoReactionsUser', 'noreactions@example.com');

    const res = await request(app)
      .get(`/posts/reaction/${user.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Invalid partition: cannot view another user's reactions
  test("should return 403 when requesting another user's reactions", async () => {
    const owner = await createTestUser('ReactionPrivacyOwner', 'reactionprivacyowner@example.com');
    const intruder = await createTestUser(
      'ReactionPrivacyIntruder',
      'reactionprivacyintruder@example.com',
    );

    const res = await request(app)
      .get(`/posts/reaction/${owner.id}`)
      .set('Authorization', `Bearer ${intruder.token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not authorized/i);
  });
});

// ─────────────────────────────────────────────────────────
// GET /posts/liked/:user_id
// ─────────────────────────────────────────────────────────
describe('GET /posts/liked/:user_id', () => {
  // Valid partition: owner views their own liked posts
  test("should return the authenticated user's liked posts", async () => {
    const liker = await createTestUser('LikedPostsUser', 'likedpostsuser@example.com');
    const author = await createTestUser('LikedPostAuthor', 'likedpostauthor@example.com');
    const post = await createTestPost(author.id, 'A Liked Post');
    await pool.query(
      `INSERT INTO "PostReactions" (post_id, user_id, reaction_type) VALUES ($1, $2, 'like')`,
      [post.id, liker.id],
    );

    const res = await request(app)
      .get(`/posts/liked/${liker.id}`)
      .set('Authorization', `Bearer ${liker.token}`);

    expect(res.status).toBe(200);
    expect(res.body.some((p) => p.title === 'A Liked Post')).toBe(true);
  });

  test("currently allows viewing another user's liked posts", async () => {
    const owner = await createTestUser('LikedPostsOwner', 'likedpostsowner@example.com');
    const author = await createTestUser('LikedPostsAuthor2', 'likedpostsauthor2@example.com');
    const post = await createTestPost(author.id, 'Private-ish Liked Post');
    await pool.query(
      `INSERT INTO "PostReactions" (post_id, user_id, reaction_type) VALUES ($1, $2, 'like')`,
      [post.id, owner.id],
    );

    const stranger = await createTestUser('LikedPostsStranger', 'likedpoststranger@example.com');

    const res = await request(app)
      .get(`/posts/liked/${owner.id}`)
      .set('Authorization', `Bearer ${stranger.token}`);

    expect(res.status).toBe(200);
    expect(res.body.some((p) => p.title === 'Private-ish Liked Post')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────
// POST /posts/like
// ─────────────────────────────────────────────────────────
describe('POST /posts/like', () => {
  // Valid partition: authenticated user likes a post
  test('should return 201 and create a like', async () => {
    const author = await createTestUser('LikeAuthor', 'likeauthor@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Likeable Post', 'general', 'Content')
      RETURNING id`,
      [author.id],
    );

    const postId = rows[0].id;
    const liker = await createTestUser('Liker', 'liker@example.com');

    const res = await request(app)
      .post('/posts/like')
      .set('Authorization', `Bearer ${liker.token}`)
      .send({ post_id: postId, reaction_type: 'like' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.post_id).toBe(postId);
    expect(res.body.user_id).toBe(liker.id);
    expect(res.body.reaction_type).toBe('like');
  });

  // Invalid partition: post_id missing from body
  test('should return 400 when post_id is missing', async () => {
    const actor = await createTestUser('NoPostIdLiker', 'nopostidliker@example.com');

    const res = await request(app)
      .post('/posts/like')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ reaction_type: 'like' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/post_id/i);
  });

  // Boundary: liking your own post still succeeds and skips the notification branch
  test('should allow a user to like their own post', async () => {
    const author = await createTestUser('SelfLikeAuthor', 'selflikeauthor@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Self Like Post', 'general', 'Content')
      RETURNING id`,
      [author.id],
    );

    const res = await request(app)
      .post('/posts/like')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ post_id: rows[0].id, reaction_type: 'like' });

    expect(res.status).toBe(201);
    expect(res.body.user_id).toBe(author.id);
  });

  // Boundary: reacting to the same post twice
  test('should not allow the same user to react to the same post twice', async () => {
    const author = await createTestUser('DupReactAuthor', 'dupreactauthor@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Duplicate Reaction Post', 'general', 'Content')
      RETURNING id`,
      [author.id],
    );

    const postId = rows[0].id;
    const reactor = await createTestUser('DupReactor', 'dupreactor@example.com');

    await request(app)
      .post('/posts/like')
      .set('Authorization', `Bearer ${reactor.token}`)
      .send({ post_id: postId, reaction_type: 'like' });
    const res = await request(app)
      .post('/posts/like')
      .set('Authorization', `Bearer ${reactor.token}`)
      .send({ post_id: postId, reaction_type: 'dislike' });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already reacted/i);
  });

  // Error handling: a Notification failure is swallowed and doesn't affect the 201 response
  test('should still return 201 when the like notification fails to send', async () => {
    const author = await createTestUser('NotifyFailAuthor', 'notifyfailauthor@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Notify Fail Post', 'general', 'Content')
      RETURNING id`,
      [author.id],
    );

    const postId = rows[0].id;
    const liker = await createTestUser('NotifyFailLiker', 'notifyfailliker@example.com');

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const notifySpy = jest
      .spyOn(Notification, 'create')
      .mockRejectedValueOnce(new Error('Notify boom'));

    const res = await request(app)
      .post('/posts/like')
      .set('Authorization', `Bearer ${liker.token}`)
      .send({ post_id: postId, reaction_type: 'like' });

    expect(res.status).toBe(201);

    // Give the fire-and-forget notification time to run and fail
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(warnSpy).toHaveBeenCalledWith('Post like notify error:', 'Notify boom');

    notifySpy.mockRestore();
    warnSpy.mockRestore();
  });

  // Error handling: a foreign key violation falls through to the generic catch
  test('should return 500 when liking a post that does not exist', async () => {
    const actor = await createTestUser('BadFkLikeUser', 'badfklikeuser@example.com');

    const res = await request(app)
      .post('/posts/like')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ post_id: 999999999, reaction_type: 'like' });

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────
// PUT /posts/reaction/:id
// ─────────────────────────────────────────────────────────
describe('PUT /posts/reaction/:id', () => {
  // Valid partition: changes an existing reaction from like to dislike
  test('should return 200 and update the reaction type', async () => {
    const author = await createTestUser('UpdateReactionAuthor', 'updatereactionauthor@example.com');

    const { rows: postRows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Post', 'general', 'Content')
      RETURNING id`,
      [author.id],
    );

    const reactor = await createTestUser('UpdateReactor', 'updatereactor@example.com');

    const { rows: reactionRows } = await pool.query(
      `INSERT INTO "PostReactions" (post_id, user_id, reaction_type)
      VALUES ($1, $2, 'like')
      RETURNING id`,
      [postRows[0].id, reactor.id],
    );

    const res = await request(app)
      .put(`/posts/reaction/${reactionRows[0].id}`)
      .set('Authorization', `Bearer ${reactor.token}`)
      .send({ user_id: reactor.id, reaction_type: 'dislike' });

    expect(res.status).toBe(200);
    expect(res.body.reaction_type).toBe('dislike');
  });

  // Boundary: non-existent reaction id
  test('should return 404 when the reaction does not exist', async () => {
    const actor = await createTestUser('MissingReactionUser', 'missingreactionuser@example.com');

    const res = await request(app)
      .put('/posts/reaction/999999')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ user_id: actor.id, reaction_type: 'dislike' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/reaction not found/i);
  });

  // Error handling: a non-numeric reaction id triggers a database error
  test('should return 500 for a non-numeric reaction id', async () => {
    const actor = await createTestUser(
      'BadReactionUpdateUser',
      'badreactionupdateuser@example.com',
    );

    const res = await request(app)
      .put('/posts/reaction/not-a-number')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ reaction_type: 'dislike' });

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────
// DELETE /posts/reaction/:id
// ─────────────────────────────────────────────────────────
describe('DELETE /posts/reaction/:id', () => {
  // Valid partition: deletes an existing reaction
  test('should return 200 and delete the reaction', async () => {
    const author = await createTestUser('DeleteReactionAuthor', 'deletereactionauthor@example.com');

    const { rows: postRows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Post', 'general', 'Content')
      RETURNING id`,
      [author.id],
    );

    const reactor = await createTestUser('DeleteReactor', 'deletereactor@example.com');

    const { rows: reactionRows } = await pool.query(
      `INSERT INTO "PostReactions" (post_id, user_id, reaction_type)
      VALUES ($1, $2, 'like')
      RETURNING id`,
      [postRows[0].id, reactor.id],
    );

    const reactionId = reactionRows[0].id;

    const res = await request(app)
      .delete(`/posts/reaction/${reactionId}`)
      .set('Authorization', `Bearer ${reactor.token}`)
      .send({ user_id: reactor.id });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(reactionId);

    const check = await pool.query('SELECT * FROM "PostReactions" WHERE id = $1', [reactionId]);
    expect(check.rows).toHaveLength(0);
  });

  // Boundary: non-existent reaction id
  test('should return 404 when the reaction does not exist', async () => {
    const actor = await createTestUser(
      'MissingReactionDeleteUser',
      'missingreactiondeleteuser@example.com',
    );

    const res = await request(app)
      .delete('/posts/reaction/999999')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ user_id: actor.id });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/reaction not found/i);
  });

  // Error handling: a non-numeric reaction id triggers a database error
  test('should return 500 for a non-numeric reaction id', async () => {
    const actor = await createTestUser(
      'BadReactionDeleteUser',
      'badreactiondeleteuser@example.com',
    );

    const res = await request(app)
      .delete('/posts/reaction/not-a-number')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(res.status).toBe(500);
  });
});

// ================== Posts Tags ======================
// ─────────────────────────────────────────────────────────
// GET /posts/:id/tags
// ─────────────────────────────────────────────────────────
describe('GET /posts/:id/tags', () => {
  // Valid partition: returns tags attached to the post
  test('should return the tags attached to a post', async () => {
    const author = await createTestUser('TagReadAuthor', 'tagreadauthor@example.com');
    const post = await createTestPost(author.id);

    const { rows: tagRows } = await pool.query(
      `INSERT INTO "Tags" (name) VALUES ('confession'), ('finals') RETURNING id`,
    );
    await pool.query(`INSERT INTO "PostTags" (post_id, tag_id) VALUES ($1, $2), ($1, $3)`, [
      post.id,
      tagRows[0].id,
      tagRows[1].id,
    ]);

    const res = await request(app).get(`/posts/${post.id}/tags`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((t) => t.name).sort()).toEqual(['confession', 'finals']);
  });

  // Boundary: a post with no tags
  test('should return an empty array when the post has no tags', async () => {
    const author = await createTestUser('NoTagAuthor', 'notagauthor@example.com');
    const post = await createTestPost(author.id);

    const res = await request(app).get(`/posts/${post.id}/tags`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// GET /posts/tags/search
// ─────────────────────────────────────────────────────────
describe('GET /posts/tags/search', () => {
  // Valid partition: returns tags matching the prefix
  test('should return tags matching the search prefix', async () => {
    await pool.query(`INSERT INTO "Tags" (name) VALUES ('internship'), ('events')`);

    const res = await request(app).get('/posts/tags/search').query({ q: 'INT' });

    expect(res.status).toBe(200);
    expect(res.body.some((t) => t.name === 'internship')).toBe(true);
    expect(res.body.some((t) => t.name === 'events')).toBe(false);
  });

  // Boundary: an empty query stops search
  test('should return an empty array for an empty query', async () => {
    const res = await request(app).get('/posts/tags/search').query({ q: '' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Boundary: no tags match the prefix
  test('should return an empty array when no tags match', async () => {
    await pool.query(`INSERT INTO "Tags" (name) VALUES ('confession')`);

    const res = await request(app).get('/posts/tags/search').query({ q: 'zzz' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// PUT /posts/:id/tags
// ─────────────────────────────────────────────────────────
describe('PUT /posts/:id/tags', () => {
  // Valid partition: attaches new tags to a post
  test("should replace a post's tags with the provided tag names", async () => {
    const author = await createTestUser('TagWriteAuthor', 'tagwriteauthor@example.com');
    const post = await createTestPost(author.id);

    const res = await request(app)
      .put(`/posts/${post.id}/tags`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ tag_names: ['Confession', 'Finals'] });

    expect(res.status).toBe(200);
    expect(res.body.map((t) => t.name).sort()).toEqual(['confession', 'finals']);
  });

  // Valid partition: using an existing tag name reuses the same Tags row, not duplicate
  test('should reuse an existing tag row across different posts instead of duplicating it', async () => {
    const author = await createTestUser('TagReuseAuthor', 'tagreuseauthor@example.com');
    const postA = await createTestPost(author.id, 'Post A');
    const postB = await createTestPost(author.id, 'Post B');

    await request(app)
      .put(`/posts/${postA.id}/tags`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ tag_names: ['finals'] });
    await request(app)
      .put(`/posts/${postB.id}/tags`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ tag_names: ['finals'] });

    const { rows } = await pool.query(`SELECT * FROM "Tags" WHERE name = 'finals'`);
    expect(rows).toHaveLength(1);
  });

  // Boundary: an empty array clears all tags from the post
  test("should clear a post's tags when given an empty array", async () => {
    const author = await createTestUser('TagClearAuthor', 'tagclearauthor@example.com');
    const post = await createTestPost(author.id);
    await request(app)
      .put(`/posts/${post.id}/tags`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ tag_names: ['temporary'] });

    const res = await request(app)
      .put(`/posts/${post.id}/tags`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ tag_names: [] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Invalid partition: tag_names is not an array
  test('should return 400 when tag_names is not an array', async () => {
    const author = await createTestUser('TagBadShapeAuthor', 'tagbadshapeauthor@example.com');
    const post = await createTestPost(author.id);

    const res = await request(app)
      .put(`/posts/${post.id}/tags`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ tag_names: 'not-an-array' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/must be an array/i);
  });

  // Invalid partition: more than 10 tags
  test('should return 400 when more than 10 tags are provided', async () => {
    const author = await createTestUser('TagTooManyAuthor', 'tagtoomanyauthor@example.com');
    const post = await createTestPost(author.id);

    const tooMany = Array.from({ length: 11 }, (_, i) => `tag${i}`);

    const res = await request(app)
      .put(`/posts/${post.id}/tags`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ tag_names: tooMany });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/maximum of 10 tags/i);
  });

  // Error handling: deletePostTags fails unexpectedly
  test('should return 500 when updating tags fails unexpectedly', async () => {
    const owner = await createTestUser('TagsFailOwner', 'tagsfailowner@example.com');
    const post = await createTestPost(owner.id);

    PostsModel.deletePostTags.mockRejectedValueOnce(new Error('Tags delete boom'));

    const res = await request(app)
      .put(`/posts/${post.id}/tags`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ tag_names: ['music', 'sports'] });

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────
// POST /posts/:id/view
// ─────────────────────────────────────────────────────────
describe('POST /posts/:id/view', () => {
  // Valid partition: increments the view count
  test('should increment and return the new view count', async () => {
    const author = await createTestUser('ViewAuthor', 'viewauthor@example.com');
    const post = await createTestPost(author.id);

    const first = await request(app)
      .post(`/posts/${post.id}/view`)
      .set('Authorization', `Bearer ${author.token}`);
    const second = await request(app)
      .post(`/posts/${post.id}/view`)
      .set('Authorization', `Bearer ${author.token}`);

    expect(first.status).toBe(200);
    expect(first.body.view_count).toBe(1);
    expect(second.body.view_count).toBe(2);
  });

  // no post returns 0
  test('should return view_count: 0 for a non-existent post instead of a 404', async () => {
    const actor = await createTestUser('GhostViewUser', 'ghostviewuser@example.com');

    const res = await request(app)
      .post('/posts/999999999/view')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(res.status).toBe(200);
    expect(res.body.view_count).toBe(0);
  });
});

// ================== Posts Analytics ======================
// ─────────────────────────────────────────────────────────
// GET /posts/:id/analytics
// ─────────────────────────────────────────────────────────
describe('GET /posts/:id/analytics', () => {
  // Valid partition: owner sees full engagement counts for their post
  test("should return the post owner's analytics with correct counts", async () => {
    const owner = await createTestUser('AnalyticsOwner', 'analyticsowner@example.com');
    const post = await createTestPost(owner.id);

    const commenter = await createTestUser('AnalyticsCommenter', 'analyticscommenter@example.com');
    await pool.query(
      `INSERT INTO "PostReactions" (post_id, user_id, reaction_type) VALUES ($1, $2, 'like')`,
      [post.id, commenter.id],
    );
    await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content) VALUES ($1, $2, 'Nice!')`,
      [commenter.id, post.id],
    );
    await pool.query(`INSERT INTO "SavedPosts" (user_id, post_id) VALUES ($1, $2)`, [
      commenter.id,
      post.id,
    ]);

    const res = await request(app)
      .get(`/posts/${post.id}/analytics`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body.like_count).toBe(1);
    expect(res.body.dislike_count).toBe(0);
    expect(res.body.comment_count).toBe(1);
    expect(res.body.save_count).toBe(1);
  });

  // Boundary: a post with zero engagement returns 0, not null
  test('should return zeroed counts for a post with no engagement', async () => {
    const owner = await createTestUser('QuietAuthor', 'quietauthor@example.com');
    const post = await createTestPost(owner.id);

    const res = await request(app)
      .get(`/posts/${post.id}/analytics`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body.like_count).toBe(0);
    expect(res.body.comment_count).toBe(0);
    expect(res.body.save_count).toBe(0);
  });

  // Invalid partition: a non-owner cannot view another user's post analytics
  test("should return 404 when requesting another user's post analytics", async () => {
    const owner = await createTestUser(
      'PrivateAnalyticsOwner',
      'privateanalyticsowner@example.com',
    );
    const post = await createTestPost(owner.id);

    const stranger = await createTestUser('AnalyticsStranger', 'analyticsstranger@example.com');

    const res = await request(app)
      .get(`/posts/${post.id}/analytics`)
      .set('Authorization', `Bearer ${stranger.token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found or not yours/i);
  });
});

// ─────────────────────────────────────────────────────────
// GET /posts/:id/analytics/engagement-over-time
// ─────────────────────────────────────────────────────────
describe('GET /posts/:id/analytics/engagement-over-time', () => {
  // Valid partition: owner sees engagement grouped by day
  test('should return engagement data grouped by day for the owner', async () => {
    const owner = await createTestUser('TimelineOwner', 'timelineowner@example.com');
    const post = await createTestPost(owner.id);

    const reactor = await createTestUser('TimelineReactor', 'timelinereactor@example.com');
    await pool.query(
      `INSERT INTO "PostReactions" (post_id, user_id, reaction_type) VALUES ($1, $2, 'like')`,
      [post.id, reactor.id],
    );

    const res = await request(app)
      .get(`/posts/${post.id}/analytics/engagement-over-time`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('likes');
  });

  // Boundary: no engagement yet returns an empty array
  test('should return an empty array when there is no engagement yet', async () => {
    const owner = await createTestUser('QuietTimelineOwner', 'quiettimelineowner@example.com');
    const post = await createTestPost(owner.id);

    const res = await request(app)
      .get(`/posts/${post.id}/analytics/engagement-over-time`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // non-owner gets empty array
  test("should silently return an empty array for another user's post, not a 404", async () => {
    const owner = await createTestUser('TimelineVictim', 'timelinevictim@example.com');
    const post = await createTestPost(owner.id);

    const stranger = await createTestUser('TimelineIntruder', 'timelineintruder@example.com');
    await pool.query(
      `INSERT INTO "PostReactions" (post_id, user_id, reaction_type) VALUES ($1, $2, 'like')`,
      [post.id, stranger.id],
    );

    const res = await request(app)
      .get(`/posts/${post.id}/analytics/engagement-over-time`)
      .set('Authorization', `Bearer ${stranger.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// GET /posts/analytics/all
// ─────────────────────────────────────────────────────────
describe('GET /posts/analytics/all', () => {
  // Valid partition: returns analytics summaries for all of the user's posts
  test("should return analytics for all of the authenticated user's posts", async () => {
    const user = await createTestUser('AllAnalyticsUser', 'allanalyticsuser@example.com');
    await createTestPost(user.id, 'First Post');
    await createTestPost(user.id, 'Second Post');

    const res = await request(app)
      .get('/posts/analytics/all')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  // Boundary: anonymous posts are excluded
  test("should exclude the user's anonymous posts from the summary", async () => {
    const user = await createTestUser('AnonAnalyticsUser', 'anonanalyticsuser@example.com');
    await createTestPost(user.id, 'Visible Post');
    await pool.query(
      `INSERT INTO "Posts" (user_id, title, category, content, is_anonymous)
       VALUES ($1, 'Anonymous Post', 'general', 'Content', TRUE)`,
      [user.id],
    );

    const res = await request(app)
      .get('/posts/analytics/all')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Visible Post');
  });

  // Boundary: a user with no posts gets an empty array
  test('should return an empty array for a user with no posts', async () => {
    const user = await createTestUser('NoPostsAnalyticsUser', 'nopostsanalyticsuser@example.com');

    const res = await request(app)
      .get('/posts/analytics/all')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ================== Posts Reports ======================
// ─────────────────────────────────────────────────────────
// GET /posts/reports
// ─────────────────────────────────────────────────────────
test('should return the report list for an admin', async () => {
  const admin = await createTestUser('AdminReportsUser', 'adminreportsuser@example.com');
  await promoteToAdmin(admin);

  const author = await createTestUser('ReportedPostAuthor', 'reportedpostauthor@example.com');
  const post = await createTestPost(author.id);
  const reporter = await createTestUser('PostReporterUser', 'postreporteruser@example.com');
  await pool.query(`INSERT INTO "PostReports" (post_id, user_id, reason) VALUES ($1, $2, 'spam')`, [
    post.id,
    reporter.id,
  ]);

  const res = await request(app)
    .get('/posts/reports')
    .set('Authorization', `Bearer ${admin.token}`);

  expect(res.status).toBe(200);
  expect(res.body.some((r) => r.post_id === post.id)).toBe(true);
});

// Invalid partition: a non-admin user cannot get reports
test('should return 403 for a non-admin users', async () => {
  const actor = await createTestUser('NonAdminReportsUser', 'nonadminreports@example.com');

  const res = await request(app)
    .get('/posts/reports')
    .set('Authorization', `Bearer ${actor.token}`);

  expect(res.status).toBe(403);
  expect(res.body.message).toMatch(/admin access required/i);
});

// Valid partition: includeDismissed=true
test('should include dismissed reports when includeDismissed=true', async () => {
  const admin = await createTestUser('AdminReportsUser2', 'adminreports2@example.com');
  await promoteToAdmin(admin);

  const res = await request(app)
    .get('/posts/reports')
    .set('Authorization', `Bearer ${admin.token}`)
    .query({ includeDismissed: 'true' });

  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

// Error handling: getAllReports fails
test('should return 500 when fetching reports fails', async () => {
  const admin = await createTestUser('ReportsFailUser', 'reportsfailuser@example.com');
  await promoteToAdmin(admin);

  PostsModel.getAllReports.mockRejectedValueOnce(new Error('Reports boom'));

  const res = await request(app)
    .get('/posts/reports')
    .set('Authorization', `Bearer ${admin.token}`);

  expect(res.status).toBe(500);
});

// ─────────────────────────────────────────────────────────
// POST /posts/:id/report
// ─────────────────────────────────────────────────────────
describe('POST /posts/:id/report', () => {
  test('should return 400 when reason is missing', async () => {
    const author = await createTestUser('NoReasonPostAuthor', 'noreasonpostauthor@example.com');
    const post = await createTestPost(author.id);
    const reporter = await createTestUser('NoReasonReporter', 'noreasonreporter@example.com');

    const res = await request(app)
      .post(`/posts/${post.id}/report`)
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('should submit a post report as the authenticated user', async () => {
    const author = await createTestUser('ReportPostAuthor', 'reportpostauthor@example.com');
    const post = await createTestPost(author.id);
    const reporter = await createTestUser('ReportPostReporter', 'reportpostreporter@example.com');

    const res = await request(app)
      .post(`/posts/${post.id}/report`)
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({ reason: 'spam' });

    expect(res.status).toBe(201);
    expect(res.body.user_id).toBe(reporter.id);
    expect(res.body.post_id).toBe(post.id);
  });

  test('should return 409 when the user reports the same post twice', async () => {
    const author = await createTestUser('DupeReportPostAuthor', 'dupereportpostauthor@example.com');
    const post = await createTestPost(author.id);
    const reporter = await createTestUser('DupeReportPostUser', 'dupereportpostuser@example.com');

    await request(app)
      .post(`/posts/${post.id}/report`)
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({ reason: 'spam' });
    const res = await request(app)
      .post(`/posts/${post.id}/report`)
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({ reason: 'spam' });

    expect(res.status).toBe(409);
  });

  // Error handling: a foreign key violation falls through to the generic catch
  test('should return 500 when reporting a post that does not exist', async () => {
    const actor = await createTestUser('BadFkReportUser', 'badfkreportuser@example.com');

    const res = await request(app)
      .post('/posts/999999999/report')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ reason: 'spam' });

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────
// POST /posts/:id/pin
// ─────────────────────────────────────────────────────────
describe('POST /posts/:id/pin', () => {
  // Valid partition: owner pins their post
  test('should pin the post for its owner', async () => {
    const owner = await createTestUser('PinOwner', 'pinowner@example.com');
    const post = await createTestPost(owner.id);

    const res = await request(app)
      .post(`/posts/${post.id}/pin`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body.pinned).toBe(true);
  });

  // Boundary: pinning again toggles it back off
  test('should unpin an already pinned post', async () => {
    const owner = await createTestUser('TogglePinOwner', 'togglepinowner@example.com');
    const post = await createTestPost(owner.id);

    await request(app).post(`/posts/${post.id}/pin`).set('Authorization', `Bearer ${owner.token}`);
    const res = await request(app)
      .post(`/posts/${post.id}/pin`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body.pinned).toBe(false);
  });

  // Invalid partition: non-owner cannot pin another user's post
  test("should return 404 when a non-owner tries to pin someone else's post", async () => {
    const owner = await createTestUser('PinVictimOwner', 'pinvictimowner@example.com');
    const post = await createTestPost(owner.id);

    const intruder = await createTestUser('PinIntruder', 'pinintruder@example.com');

    const res = await request(app)
      .post(`/posts/${post.id}/pin`)
      .set('Authorization', `Bearer ${intruder.token}`);

    expect(res.status).toBe(404);
  });

  // Boundary: invalid (non-integer) post id
  test('should return 400 for a non-integer post id', async () => {
    const actor = await createTestUser('InvalidPinIdUser', 'invalidpinidsuser@example.com');

    const res = await request(app)
      .post('/posts/not-a-number/pin')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(res.status).toBe(400);
  });

  // Error handling: an out of range post id
  test('should return 500 for a post id outside the integer range', async () => {
    const actor = await createTestUser('PinOverflowUser', 'pinoverflowuser@example.com');

    const res = await request(app)
      .post('/posts/99999999999/pin')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(res.status).toBe(500);
  });
});
