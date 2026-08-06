const request = require('supertest');

const app = require('../../src/app');
const pool = require('../../src/models/db');
const fs = require('fs');
const path = require('path');

const recordingDir = path.join(__dirname, '../../src/public/uploads/recordings');

// ── DB Setup / Teardown ──────────────────────────────────
// Tables are created via the Jest globalSetup (configs/jest-integration-setup.js)
// which runs scripts/reset.js before any test file executes.

beforeEach(async () => {
  await pool.query('DELETE FROM "Person"');
  if (fs.existsSync(recordingDir)) {
    for (const f of fs.readdirSync(recordingDir)) fs.unlinkSync(path.join(recordingDir, f));
  }
});

afterAll(async () => {
  await pool.query('DELETE FROM "Person"');
  if (fs.existsSync(recordingDir)) {
    for (const f of fs.readdirSync(recordingDir)) fs.unlinkSync(path.join(recordingDir, f));
  }
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

describe('POST /upload — session recording uploads', () => {
  let token;

  beforeEach(async () => {
    const { token: t } = await registerAndVerify('Upload Tester', 'upload@test.com');
    token = t;
  });

  it('rejects unauthenticated uploads', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('file', Buffer.from('fake webm bytes'), 'session.webm');
    expect(res.status).toBe(401);
  });

  it('stores a video file and returns its public path', async () => {
    const res = await request(app)
      .post('/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('fake webm bytes'), 'session-1-123.webm');

    expect(res.status).toBe(201);
    expect(res.body.filePath).toMatch(/^\/uploads\/recordings\/.+-session-1-123\.webm$/);
    const stored = path.join(recordingDir, path.basename(res.body.filePath));
    expect(fs.existsSync(stored)).toBe(true);
    expect(fs.readFileSync(stored).toString()).toBe('fake webm bytes');
  });

  it('rejects non-video files', async () => {
    const res = await request(app)
      .post('/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('png bytes'), 'image.png');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/video/i);
  });

  it('rejects requests without a file', async () => {
    const res = await request(app)
      .post('/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('foo', 'bar');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('file is required');
  });
});
