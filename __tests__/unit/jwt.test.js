const { signToken, verifyToken } = require('../../src/utils/jwt');

describe('jwt utils', () => {
  test('signToken and verifyToken should round-trip user payload', () => {
    const user = {
      id: 1,
      name: 'Alice',
      email: 'alice@example.com',
      role: 'admin',
      avatar: null,
    };

    const token = signToken(user);
    const payload = verifyToken(token);

    expect(payload.id).toBe(user.id);
    expect(payload.name).toBe(user.name);
    expect(payload.role).toBe('admin');
  });
});
