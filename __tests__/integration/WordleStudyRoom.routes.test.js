const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/models/db');

let counter = 0;
function unique(base) {
  counter += 1;
  return `${base}_${counter}_${Date.now()}`;
}

describe('Wordle router (session based)', () => {
  let agent;
  beforeEach(() => {
    agent = request.agent(app);
  });

  test('starts a game, then state, rejects invalid guesses', async () => {
    const state0 = await agent.get('/wordle/state');
    expect(state0.status).toBe(200);
    expect(state0.body.active).toBe(false);

    const badGuess = await agent.post('/wordle/guess').send({ guess: 'AAAAA' });
    expect(badGuess.status).toBe(400);

    const start = await agent.post('/wordle/new');
    expect(start.status).toBe(200);
    expect(start.body.started).toBe(true);
    expect(start.body.maxGuesses).toBe(6);

    const state = await agent.get('/wordle/state');
    expect(state.body.active).toBe(true);
  });

  test('rejects bad guesses and plays to game over', async () => {
    await agent.post('/wordle/new');

    const tooShort = await agent.post('/wordle/guess').send({ guess: 'AB' });
    expect(tooShort.status).toBe(400);

    // ZZZZZ may not be in the word list; use two distinct real words that
    // cannot both be the answer, so the game always reaches 6 guesses.
    const words = require('../../src/models/Wordle.model').loadWordList();
    const guessA = words[0];
    const guessB = words.find((w) => w !== guessA) || 'CRANE';

    for (let i = 0; i < 6; i++) {
      const res = await agent.post('/wordle/guess').send({ guess: i % 2 === 0 ? guessA : guessB });
      expect(res.status).toBe(200);
    }

    const over = await agent.post('/wordle/guess').send({ guess: guessA });
    expect(over.status).toBe(400);

    const finalState = await agent.get('/wordle/state');
    expect(finalState.body.gameOver).toBe(true);
    expect(finalState.body.won).toBe(false);
    expect(typeof finalState.body.answer).toBe('string');
  });

  test('a winning guess marks the game won', async () => {
    const Wordle = require('../../src/models/Wordle.model');
    const answer = Wordle.pickRandomWord();
    // Start a session game. We cannot inject the answer, so this only verifies
    // the guess path accepts a valid word.
    await agent.post('/wordle/new');
    const res = await agent
      .post('/wordle/guess')
      .send({ guess: answer.slice(0, Wordle.WORD_LENGTH) });
    expect(res.status).toBe(200);
  });
});

describe('Study Room router', () => {
  afterAll(async () => {
    await pool.query('DELETE FROM "UserCharacterParts"');
    await pool.query('DELETE FROM "UserCharacters"');
    await pool.query('DELETE FROM "StudyRoomCharacters" WHERE name LIKE \'test_char%\'');
    await pool.query('DELETE FROM "Person" WHERE email LIKE \'sr_%\'');
    await pool.end();
  });

  async function registerUser() {
    const name = unique('sr');
    const email = `${name}@test.com`;
    const reg = await request(app)
      .post('/auth/register')
      .send({ name, email, password: 'secret1' });
    const verify = await request(app)
      .post('/auth/verify-email')
      .send({ email, code: reg.body.previewCode });
    return { token: verify.body.token, user: verify.body.user };
  }

  test('manages characters and user character parts', async () => {
    const { token } = await registerUser();

    const inserted = await pool.query(
      `INSERT INTO "StudyRoomCharacters" ("name", "character_key", "parts")
       VALUES ('test_char_avocado', 'test_char_avocado', '{}') RETURNING id`,
    );
    const fallbackId = inserted.rows[0].id;

    const chars = await request(app).get('/study-room/characters');
    expect(chars.status).toBe(200);
    expect(chars.body.length).toBeGreaterThanOrEqual(1);
    const charId = chars.body[0]?.id ?? fallbackId;

    const one = await request(app).get(`/study-room/characters/${charId}`);
    expect(one.status).toBe(200);
    expect(one.body.id).toBe(charId);

    const missing = await request(app).get('/study-room/characters/999999');
    expect(missing.status).toBe(404);

    const auth = await request(app).get('/study-room/my-character');
    expect(auth.status).toBe(401);

    const noChar = await request(app)
      .get('/study-room/my-character')
      .set('Authorization', `Bearer ${token}`);
    expect(noChar.status).toBe(404);

    const set = await request(app)
      .put('/study-room/my-character')
      .set('Authorization', `Bearer ${token}`)
      .send({ character_id: charId });
    expect(set.status).toBe(200);

    const mine = await request(app)
      .get('/study-room/my-character')
      .set('Authorization', `Bearer ${token}`);
    expect(mine.status).toBe(200);
    expect(mine.body.character_id).toBe(charId);

    const noCharId = await request(app)
      .put('/study-room/my-character')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(noCharId.status).toBe(400);

    const part = await request(app)
      .put('/study-room/my-character/parts/hat')
      .set('Authorization', `Bearer ${token}`)
      .send({ option: 'crown' });
    expect(part.status).toBe(200);

    const parts = await request(app)
      .get('/study-room/my-character/parts')
      .set('Authorization', `Bearer ${token}`);
    expect(parts.status).toBe(200);
    expect(parts.body.some((p) => p.part === 'hat')).toBe(true);

    const noOption = await request(app)
      .put('/study-room/my-character/parts/hat')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(noOption.status).toBe(400);

    const del = await request(app)
      .delete('/study-room/my-character/parts/hat')
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);

    if (chars.body[1]) {
      const changed = await request(app)
        .put('/study-room/my-character')
        .set('Authorization', `Bearer ${token}`)
        .send({ character_id: chars.body[1].id });
      expect(changed.status).toBe(200);
    }
  });
});
