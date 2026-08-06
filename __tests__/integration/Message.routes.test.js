const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/models/db');

let counter = 0;
function unique(base) {
  counter += 1;
  return `${base}_${counter}_${Date.now()}`;
}

async function registerAndVerify(name, email, password = 'secret1') {
  const reg = await request(app).post('/auth/register').send({ name, email, password });
  const verify = await request(app).post('/auth/verify-email').send({
    email,
    code: reg.body.previewCode,
  });
  return { user: verify.body.user, token: verify.body.token };
}

async function becomeFriends(alice, bob) {
  await request(app)
    .post('/friends/request')
    .set('Authorization', `Bearer ${alice.token}`)
    .send({ receiver_id: bob.user.id });
  const received = await request(app)
    .get('/friends/requests?tab=received')
    .set('Authorization', `Bearer ${bob.token}`);
  await request(app)
    .post('/friends/accept')
    .set('Authorization', `Bearer ${bob.token}`)
    .send({ request_id: received.body.requests[0].request_id });
}

describe('Messages — chat routes', () => {
  afterAll(async () => {
    await pool.query('DELETE FROM "MessageReadState"');
    await pool.query('DELETE FROM "MessageReactions"');
    await pool.query('DELETE FROM "ChatMute"');
    await pool.query('DELETE FROM "ChatPin"');
    await pool.query('DELETE FROM "PersonalMessages"');
    await pool.query('DELETE FROM "FriendRequests"');
    await pool.query('DELETE FROM "UserFriends"');
    await pool.query('DELETE FROM "EmailVerificationCodes"');
    await pool.query('DELETE FROM "UserSessions"');
    await pool.query("DELETE FROM \"Person\" WHERE email LIKE 'msg_%' OR email LIKE 'mch%'");
    await pool.end();
  });

  test('requires auth', async () => {
    const res = await request(app).get('/messages/contacts');
    expect(res.status).toBe(401);
  });

  test('contacts, conversation, send, read state flow', async () => {
    const alice = await registerAndVerify(unique('mga'), unique('mga') + '@test.com');
    const bob = await registerAndVerify(unique('mgb'), unique('mgb') + '@test.com');
    await becomeFriends(alice, bob);

    const contacts = await request(app)
      .get('/messages/contacts')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(contacts.status).toBe(200);
    expect(contacts.body.contacts.some((c) => c.id === bob.user.id)).toBe(true);

    const sent = await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ recipientId: bob.user.id, body: 'Hi Bob!' });
    expect(sent.status).toBe(201);
    expect(sent.body.message.body).toBe('Hi Bob!');

    const convo = await request(app)
      .get(`/messages/with/${bob.user.id}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(convo.status).toBe(200);
    expect(convo.body.messages.some((m) => m.body === 'Hi Bob!')).toBe(true);
    expect(convo.body.otherUser.id).toBe(bob.user.id);

    const convoSince = await request(app)
      .get(`/messages/with/${bob.user.id}?since=1970-01-01T00:00:00.000Z`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(convoSince.status).toBe(200);

    const readState = await request(app)
      .get(`/messages/read-state/${bob.user.id}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(readState.status).toBe(200);
  });

  test('validation branches', async () => {
    const alice = await registerAndVerify(unique('mgv'), unique('mgv') + '@test.com');
    const bob = await registerAndVerify(unique('mgw'), unique('mgw') + '@test.com');

    const badId = await request(app)
      .get('/messages/with/notanumber')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(badId.status).toBe(400);

    const selfMsg = await request(app)
      .get(`/messages/with/${alice.user.id}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(selfMsg.status).toBe(400);

    const missingUser = await request(app)
      .get('/messages/with/9999999')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(missingUser.status).toBe(404);

    const missingRecipient = await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ body: 'no recipient' });
    expect(missingRecipient.status).toBe(400);

    const emptyBody = await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ recipientId: bob.user.id });
    expect(emptyBody.status).toBe(400);

    const selfSend = await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ recipientId: alice.user.id, body: 'to myself' });
    expect(selfSend.status).toBe(400);

    const stranger = await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ recipientId: bob.user.id, body: 'not friends yet' });
    expect(stranger.status).toBe(403);

    const badReadState = await request(app)
      .get('/messages/read-state/notanumber')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(badReadState.status).toBe(400);
  });

  test('search, edit, delete, reactions, mute, pin', async () => {
    const alice = await registerAndVerify(unique('mge'), unique('mge') + '@test.com');
    const bob = await registerAndVerify(unique('mgf'), unique('mgf') + '@test.com');
    await becomeFriends(alice, bob);

    const sent = await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ recipientId: bob.user.id, body: 'pineapple pizza is great' });
    const messageId = sent.body.message.id;

    const search = await request(app)
      .get(`/messages/with/${bob.user.id}/search?q=pizza`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(search.status).toBe(200);
    expect(search.body.results.some((m) => m.id === messageId)).toBe(true);

    const searchBad = await request(app)
      .get(`/messages/with/${bob.user.id}/search`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(searchBad.status).toBe(400);

    const edit = await request(app)
      .patch(`/messages/${messageId}`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ body: 'edited message' });
    expect(edit.status).toBe(200);
    expect(edit.body.message.body).toBe('edited message');

    const editBad = await request(app)
      .patch(`/messages/${messageId}`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({});
    expect(editBad.status).toBe(400);

    const react = await request(app)
      .post(`/messages/${messageId}/reactions`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ emoji: '👍' });
    expect(react.status).toBe(200);
    expect(react.body.reactions.some((r) => r.emoji === '👍')).toBe(true);

    const reactBad = await request(app)
      .post(`/messages/${messageId}/reactions`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({});
    expect(reactBad.status).toBe(400);

    const removeReact = await request(app)
      .delete(`/messages/${messageId}/reactions`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(removeReact.status).toBe(200);

    const del = await request(app)
      .delete(`/messages/${messageId}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(del.status).toBe(200);
    expect(del.body.message.body).toBe('[deleted]');

    const delBad = await request(app)
      .delete('/messages/notanumber')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(delBad.status).toBe(400);

    const mute = await request(app)
      .post(`/messages/mute/${bob.user.id}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(mute.status).toBe(200);
    expect(mute.body.muted).toBe(true);

    const muted = await request(app)
      .get(`/messages/mute/${bob.user.id}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(muted.body.muted).toBe(true);

    const unmute = await request(app)
      .delete(`/messages/mute/${bob.user.id}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(unmute.status).toBe(200);
    expect(unmute.body.muted).toBe(false);

    const pin = await request(app)
      .post(`/messages/pin/${bob.user.id}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(pin.status).toBe(200);
    expect(pin.body.pinned).toBe(true);

    const unpin = await request(app)
      .delete(`/messages/pin/${bob.user.id}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(unpin.status).toBe(200);
    expect(unpin.body.pinned).toBe(false);

    const pinBad = await request(app)
      .post('/messages/pin/notanumber')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(pinBad.status).toBe(400);
  });

  test('edit/delete/reactions on missing message', async () => {
    const alice = await registerAndVerify(unique('mgh'), unique('mgh') + '@test.com');
    const notFound = await request(app)
      .patch('/messages/99999999')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ body: 'x' });
    expect(notFound.status).toBe(404);

    const delMissing = await request(app)
      .delete('/messages/99999999')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(delMissing.status).toBe(404);

    const reactMissing = await request(app)
      .post('/messages/99999999/reactions')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ emoji: '😀' });
    expect(reactMissing.status).toBe(404);
  });
});
