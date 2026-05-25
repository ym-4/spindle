const {
  hashPassword,
  verifyPassword,
  authenticate,
  createUser,
} = require('../../src/models/Auth.model');

jest.mock('../../src/models/db', () => ({
  query: jest.fn(),
  end: jest.fn(),
}));

const pool = require('../../src/models/db');

afterEach(() => {
  jest.clearAllMocks();
});

describe('Auth.model - password helpers', () => {
  test('hashPassword and verifyPassword should round-trip', () => {
    const hashed = hashPassword('testpass');
    expect(verifyPassword('testpass', hashed)).toBe(true);
    expect(verifyPassword('wrong', hashed)).toBe(false);
  });
});

describe('Auth.model - authenticate', () => {
  test('should return user without password when credentials match', async () => {
    const hashed = hashPassword('secret');
    pool.query.mockResolvedValue({
      rows: [
        {
          id: 1,
          name: 'Alice',
          email: 'alice@example.com',
          avatar: null,
          hashed_password: hashed,
          role: 'user',
        },
      ],
    });

    const user = await authenticate('Alice', 'secret');

    expect(user).toEqual({
      id: 1,
      name: 'Alice',
      email: 'alice@example.com',
      avatar: null,
      role: 'user',
    });
  });

  test('should return null when user is not found', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const user = await authenticate('ghost', 'secret');

    expect(user).toBeNull();
  });
});

describe('Auth.model - createUser', () => {
  test('should insert user and return public fields', async () => {
    pool.query.mockResolvedValue({
      rows: [{ id: 5, name: 'Bob', email: 'bob@example.com', avatar: 'B', role: 'user' }],
    });

    const user = await createUser({
      name: 'Bob',
      email: 'bob@example.com',
      password: 'pass',
      avatar: 'B',
    });

    expect(user.id).toBe(5);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "Person"'),
      expect.arrayContaining(['Bob', 'bob@example.com', 'B', 'user']),
    );
  });
});
