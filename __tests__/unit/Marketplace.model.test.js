// tests/unit/marketplace.model.test.js
jest.mock('../../src/models/db');
const pool = require('../../src/models/db');
const { getAllItems } = require('../../src/models/Marketplace.model');

afterEach(() => {
  jest.clearAllMocks();
});

test('getAllItems returns rows from the query', async () => {
  pool.query.mockResolvedValueOnce({
    rows: [
      { id: 1, title: 'Textbook', price: 20 },
      { id: 2, title: 'Calculator', price: 15 },
    ],
  });

  const items = await getAllItems();

  expect(items).toHaveLength(2);
  expect(items[0]).toMatchObject({ id: 1, title: 'Textbook' });
  expect(pool.query).toHaveBeenCalledTimes(1);
});

test('getAllItems returns empty array when no rows', async () => {
  pool.query.mockResolvedValueOnce({ rows: [] });
  const items = await getAllItems();
  expect(items).toEqual([]);
});

test('getAllItems propagates DB errors', async () => {
  pool.query.mockRejectedValueOnce(new Error('connection lost'));
  await expect(getAllItems()).rejects.toThrow('connection lost');
});
