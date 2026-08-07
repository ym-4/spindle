const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/models/db');

let counter = 0;
function unique(base) {
  counter += 1;
  return `${base}_${counter}_${Date.now()}`;
}

async function registerAndVerify(name, email) {
  const reg = await request(app).post('/auth/register').send({ name, email, password: 'secret1' });
  const verify = await request(app)
    .post('/auth/verify-email')
    .send({ email, code: reg.body.previewCode });
  return { user: verify.body.user, token: verify.body.token };
}

async function seedGroup(creatorId) {
  const { rows } = await pool.query(
    `INSERT INTO "Groups" ("name", "creator_id", "description", "school", "module")
     VALUES ($1, $2, 'desc', 'SOC', 'CICD') RETURNING id`,
    [`nt_${unique('g')}`, creatorId],
  );
  return rows[0].id;
}

describe('Notes router', () => {
  afterAll(async () => {
    await pool.query('DELETE FROM "NoteLinks"');
    await pool.query('DELETE FROM "Notes"');
    await pool.query('DELETE FROM "NoteFolders"');
    await pool.query('DELETE FROM "Groups"');
    await pool.query('DELETE FROM "GroupMembers"');
    await pool.query('DELETE FROM "EmailVerificationCodes"');
    await pool.query('DELETE FROM "UserSessions"');
    await pool.query('DELETE FROM "Person" WHERE email LIKE \'nt_%\'');
    await pool.end();
  });

  let alice, bob, groupId;

  beforeEach(async () => {
    alice = await registerAndVerify(unique('nta'), `${unique('nta')}@test.com`);
    bob = await registerAndVerify(unique('ntb'), `${unique('ntb')}@test.com`);
    groupId = await seedGroup(alice.user.id);
  });

  test('creates, lists, updates, and deletes a note', async () => {
    const created = await request(app)
      .post(`/notes/${groupId}`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ title: 'First Note' });
    expect(created.status).toBe(201);
    const note = created.body[0];

    const list = await request(app).get(`/notes/group/${groupId}`);
    expect(list.status).toBe(200);
    expect(list.body.some((n) => n.id === note.id)).toBe(true);

    const byTitle = await request(app).get(`/notes/group/${groupId}/First%20Note`);
    expect(byTitle.status).toBe(200);
    expect(byTitle.body.some((n) => n.id === note.id)).toBe(true);

    const one = await request(app).get(`/notes/note/${note.id}`);
    expect(one.status).toBe(200);
    expect(one.body[0].title).toBe('First Note');

    const missingNote = await request(app).get('/notes/note/999999');
    expect(missingNote.status).toBe(404);

    const dup = await request(app)
      .post(`/notes/${groupId}`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ title: 'First Note' });
    expect(dup.status).toBe(409);

    const content = await request(app)
      .put(`/notes/${note.id}/content`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ content: 'Body text here' });
    expect(content.status).toBe(200);
    expect(content.body[0].content).toBe('Body text here');

    const contentMissing = await request(app)
      .put(`/notes/${note.id}/content`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({});
    expect(contentMissing.status).toBe(400);

    const contentMissingNote = await request(app)
      .put('/notes/999999/content')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ content: 'x' });
    expect(contentMissingNote.status).toBe(404);

    const updated = await request(app)
      .put(`/notes/${note.id}/group/${groupId}`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ title: 'Renamed', is_pinned: true, is_archived: false, template: 'standard' });
    expect(updated.status).toBe(200);
    expect(updated.body[0].title).toBe('Renamed');

    const updateMissing = await request(app)
      .put(`/notes/${note.id}/group/${groupId}`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({});
    expect(updateMissing.status).toBe(400);

    const forbidden = await request(app)
      .put(`/notes/${note.id}/group/${groupId}`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ title: 'Steal' });
    expect(forbidden.status).toBe(403);

    const deleteForbidden = await request(app)
      .delete(`/notes/note/${note.id}`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(deleteForbidden.status).toBe(403);

    const del = await request(app)
      .delete(`/notes/note/${note.id}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(del.status).toBe(204);

    const delMissing = await request(app)
      .delete('/notes/note/999999')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(delMissing.status).toBe(404);
  });

  test('folders: create, update color/icon/name, delete', async () => {
    const folder = await request(app)
      .post(`/notes/folders/${groupId}`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ name: 'Sprint 1' });
    expect(folder.status).toBe(201);
    const folderId = folder.body[0].id;

    const dupFolder = await request(app)
      .post(`/notes/folders/${groupId}`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ name: 'Sprint 1' });
    expect(dupFolder.status).toBe(409);

    const missingName = await request(app)
      .post(`/notes/folders/${groupId}`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({});
    expect(missingName.status).toBe(400);

    const listFolders = await request(app).get(`/notes/folders/group/${groupId}`);
    expect(listFolders.status).toBe(200);
    expect(listFolders.body.some((f) => f.id === folderId)).toBe(true);

    const color = await request(app)
      .put(`/notes/folders/${folderId}/color`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ color: '#ff0000' });
    expect(color.status).toBe(200);

    const colorMissing = await request(app)
      .put(`/notes/folders/${folderId}/color`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({});
    expect(colorMissing.status).toBe(400);

    const icon = await request(app)
      .put(`/notes/folders/${folderId}/icon`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ icon: 'book' });
    expect(icon.status).toBe(200);

    const iconMissing = await request(app)
      .put(`/notes/folders/${folderId}/icon`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({});
    expect(iconMissing.status).toBe(400);

    const renamed = await request(app)
      .put(`/notes/folders/${folderId}/name`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ name: 'Sprint 2', group_id: groupId });
    expect(renamed.status).toBe(200);

    const renameMissing = await request(app)
      .put(`/notes/folders/${folderId}/name`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ name: 'x' });
    expect(renameMissing.status).toBe(400);

    const dupRename = await request(app)
      .put(`/notes/folders/${folderId}/name`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ name: 'Sprint 2', group_id: groupId });
    expect(dupRename.status).toBe(200);

    const delFolder = await request(app)
      .delete(`/notes/folders/${folderId}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(delFolder.status).toBe(204);

    const delMissingFolder = await request(app)
      .delete('/notes/folders/999999')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(delMissingFolder.status).toBe(404);
  });

  test('notes by folder and note links lifecycle', async () => {
    const folder = await request(app)
      .post(`/notes/folders/${groupId}`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ name: 'Folder A' });
    const folderId = folder.body[0].id;

    const n1 = await request(app)
      .post(`/notes/${groupId}`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ title: 'Note One' });
    const n2 = await request(app)
      .post(`/notes/${groupId}`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ title: 'Note Two' });
    const id1 = n1.body[0].id;
    const id2 = n2.body[0].id;

    const byFolder = await request(app).get(`/notes/folder/${folderId}`);
    expect(byFolder.status).toBe(200);

    const links = await request(app).get('/notes/links/');
    expect(links.status).toBe(200);

    const createLink = await request(app)
      .post(`/notes/links/${id1}/${id2}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(createLink.status).toBe(201);

    const dupLink = await request(app)
      .post(`/notes/links/${id1}/${id2}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(dupLink.status).toBe(409);

    const linkSource = await request(app).get(`/notes/links/source/${id1}`);
    expect(linkSource.status).toBe(200);
    expect(linkSource.body.some((l) => l.target_note_id === id2)).toBe(true);

    const linkTarget = await request(app).get(`/notes/links/target/${id2}`);
    expect(linkTarget.status).toBe(200);
    expect(linkTarget.body.some((l) => l.source_note_id === id1)).toBe(true);

    const missingSource = await request(app)
      .post('/notes/links/999999/999998')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(missingSource.status).toBe(404);

    const missingTarget = await request(app)
      .post(`/notes/links/${id1}/999999`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(missingTarget.status).toBe(404);

    const delLink = await request(app)
      .delete(`/notes/links/${id1}/${id2}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(delLink.status).toBe(204);

    const delMissingLink = await request(app)
      .delete(`/notes/links/${id1}/${id2}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(delMissingLink.status).toBe(404);
  });
});
