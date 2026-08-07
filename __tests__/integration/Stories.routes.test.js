const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/models/db');

beforeEach(async () => {
  await pool.query(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
});

afterAll(async () => {
  await pool.end();
});

async function registerAndVerify(name, email, password = 'secret') {
  const reg = await request(app).post('/auth/register').send({ name, email, password });
  const verify = await request(app).post('/auth/verify-email').send({
    email,
    code: reg.body.previewCode,
  });
  return { user: verify.body.user, token: verify.body.token };
}

describe('Stories — lifecycle', () => {
  test('creates a text story and lists it in the feed', async () => {
    const { user, token } = await registerAndVerify('storyuser', 'story@test.com');

    const create = await request(app)
      .post('/stories')
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'text')
      .field('caption', 'Hello world')
      .field('privacy', 'everyone');

    expect(create.status).toBe(201);
    expect(create.body.story.caption).toBe('Hello world');
    expect(create.body.story.story_type).toBe('text');

    const feed = await request(app).get('/stories').set('Authorization', `Bearer ${token}`);
    expect(feed.status).toBe(200);
    expect(feed.body.stories.some((s) => s.id === create.body.story.id)).toBe(true);
  });

  test('requires an image when type is image', async () => {
    const { token } = await registerAndVerify('imguser', 'img@test.com');
    const res = await request(app)
      .post('/stories')
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'image')
      .field('caption', 'No photo');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/image/i);
  });

  test('requires authentication', async () => {
    const res = await request(app).get('/stories');
    expect(res.status).toBe(401);
  });

  test('records a view for another users story', async () => {
    const { token: t1 } = await registerAndVerify('s1@test.com', 's1@test.com');
    const { user: u2, token: t2 } = await registerAndVerify('s2@test.com', 's2@test.com');

    const created = await request(app)
      .post('/stories')
      .set('Authorization', `Bearer ${t1}`)
      .field('type', 'text')
      .field('caption', 'Viewed story');

    const view = await request(app)
      .post(`/stories/${created.body.story.id}/view`)
      .set('Authorization', `Bearer ${t2}`);
    expect(view.status).toBe(200);

    const views = await request(app)
      .get(`/stories/${created.body.story.id}/views`)
      .set('Authorization', `Bearer ${t1}`);
    expect(views.status).toBe(200);
    expect(views.body.count).toBeGreaterThanOrEqual(1);
    expect(views.body.viewers.some((v) => v.viewer_id === u2.id)).toBe(true);
  });

  test('edits own story but rejects editing someone elses', async () => {
    const { token: t1 } = await registerAndVerify('edit1@test.com', 'edit1@test.com');
    const { token: t2 } = await registerAndVerify('edit2@test.com', 'edit2@test.com');

    const created = await request(app)
      .post('/stories')
      .set('Authorization', `Bearer ${t1}`)
      .field('type', 'text')
      .field('caption', 'Original');

    const ok = await request(app)
      .put(`/stories/${created.body.story.id}`)
      .set('Authorization', `Bearer ${t1}`)
      .send({ caption: 'Edited', description: 'd' });
    expect(ok.status).toBe(200);
    expect(ok.body.story.caption).toBe('Edited');

    const denied = await request(app)
      .put(`/stories/${created.body.story.id}`)
      .set('Authorization', `Bearer ${t2}`)
      .send({ caption: 'hacked' });
    expect(denied.status).toBe(404);
  });

  test('deletes only the owners story', async () => {
    const { token: t1 } = await registerAndVerify('del1@test.com', 'del1@test.com');
    const { token: t2 } = await registerAndVerify('del2@test.com', 'del2@test.com');

    const created = await request(app)
      .post('/stories')
      .set('Authorization', `Bearer ${t1}`)
      .field('type', 'text')
      .field('caption', 'delete me');

    const denied = await request(app)
      .delete(`/stories/${created.body.story.id}`)
      .set('Authorization', `Bearer ${t2}`);
    expect(denied.status).toBe(404);

    const ok = await request(app)
      .delete(`/stories/${created.body.story.id}`)
      .set('Authorization', `Bearer ${t1}`);
    expect(ok.status).toBe(200);
  });

  test('rejects invalid story id', async () => {
    const { token } = await registerAndVerify('badidx@test.com', 'badidx@test.com');
    const res = await request(app).delete('/stories/abc').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('Stories — drafts', () => {
  test('saves a draft, lists drafts, then publishes', async () => {
    const { token } = await registerAndVerify('draft@test.com', 'draft@test.com');

    const draft = await request(app)
      .post('/stories/draft')
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'text')
      .field('caption', 'Draft caption');
    expect(draft.status).toBe(201);

    const list = await request(app).get('/stories/drafts').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.drafts.some((d) => d.id === draft.body.draft.id)).toBe(true);

    const publish = await request(app)
      .post(`/stories/draft/${draft.body.draft.id}/publish`)
      .set('Authorization', `Bearer ${token}`);
    expect(publish.status).toBe(200);
    expect(publish.body.story.is_draft).toBe(false);
  });

  test('publishing a non-owned draft returns 404', async () => {
    const { token: t1 } = await registerAndVerify('pd1@test.com', 'pd1@test.com');
    const { token: t2 } = await registerAndVerify('pd2@test.com', 'pd2@test.com');

    const draft = await request(app)
      .post('/stories/draft')
      .set('Authorization', `Bearer ${t1}`)
      .field('type', 'text');

    const res = await request(app)
      .post(`/stories/draft/${draft.body.draft.id}/publish`)
      .set('Authorization', `Bearer ${t2}`);
    expect(res.status).toBe(404);
  });
});
