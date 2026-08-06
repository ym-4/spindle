// tests/unit/marketplace.model.test.js
jest.mock('../../src/models/db');
jest.mock('../../src/models/Tags.model');
const pool = require('../../src/models/db');
const { findOrCreateTag } = require('../../src/models/Tags.model');
const {
  getAllItems,
  createItem,
  getAllItemsById,
  addImagesToItem,
  setCoverImage,
  deleteItemImage,
  updateItem,
  setItemStatus,
  deleteItem,
  setItemTags,
  getTagsForItem,
  getItemsByTag,
  getRecommendedItems,
} = require('../../src/models/Marketplace.model');

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

test('createItem inserts a row and returns it', async () => {
  const fakeItem = { id: 1, seller_id: 5, name: 'Textbook' };
  pool.query.mockResolvedValueOnce({ rows: [fakeItem] });

  const result = await createItem(5, 'Textbook', 'desc', 20, 'good', 'Clementi MRT');

  const [sql, params] = pool.query.mock.calls[0];
  expect(sql).toContain('INSERT INTO "MarketplaceItems"');
  expect(params).toEqual([5, 'Textbook', 'desc', 20, 'good', 'Clementi MRT']);
  expect(result).toEqual(fakeItem);
});

test('createItem propagates DB errors', async () => {
  pool.query.mockRejectedValueOnce(new Error('connection lost'));
  await expect(createItem(5, 'Textbook', 'desc', 20, 'good', 'Clementi MRT')).rejects.toThrow(
    'connection lost',
  );
});

test('getAllItemsById queries by id and returns the first row', async () => {
  const fakeItem = { id: 7, name: 'Calculator' };
  pool.query.mockResolvedValueOnce({ rows: [fakeItem] });

  const result = await getAllItemsById(7);

  const [sql, params] = pool.query.mock.calls[0];
  expect(sql).toContain('WHERE m.id = $1');
  expect(params).toEqual([7]);
  expect(result).toEqual(fakeItem);
});

test('getAllItemsById returns undefined when no row matches', async () => {
  pool.query.mockResolvedValueOnce({ rows: [] });
  const result = await getAllItemsById(999);
  expect(result).toBeUndefined();
});

test('getAllItemsById propagates DB errors', async () => {
  pool.query.mockRejectedValueOnce(new Error('connection lost'));
  await expect(getAllItemsById(7)).rejects.toThrow('connection lost');
});

test('addImagesToItem continues sort_order from the current max instead of restarting at 0', async () => {
  // existing max sort_order is 2, so new images should start at 3
  pool.query
    .mockResolvedValueOnce({ rows: [{ maxOrder: 2 }] }) // MAX query
    .mockResolvedValueOnce({ rows: [{ id: 10, image_url: '/a.png', sort_order: 3 }] })
    .mockResolvedValueOnce({ rows: [{ id: 11, image_url: '/b.png', sort_order: 4 }] });

  const result = await addImagesToItem(1, ['/a.png', '/b.png']);

  expect(pool.query).toHaveBeenCalledTimes(3);
  expect(pool.query.mock.calls[1][1]).toEqual([1, '/a.png', 3]);
  expect(pool.query.mock.calls[2][1]).toEqual([1, '/b.png', 4]);
  expect(result).toEqual([
    { id: 10, image_url: '/a.png', sort_order: 3 },
    { id: 11, image_url: '/b.png', sort_order: 4 },
  ]);
});

test('addImagesToItem starts at 0 when the item has no existing images', async () => {
  pool.query
    .mockResolvedValueOnce({ rows: [{ maxOrder: -1 }] })
    .mockResolvedValueOnce({ rows: [{ id: 1, image_url: '/first.png', sort_order: 0 }] });

  await addImagesToItem(2, ['/first.png']);

  expect(pool.query.mock.calls[1][1]).toEqual([2, '/first.png', 0]);
});

test('addImagesToItem still runs the MAX lookup but inserts nothing when given an empty array', async () => {
  pool.query.mockResolvedValueOnce({ rows: [{ maxOrder: -1 }] });

  const result = await addImagesToItem(2, []);

  // Only the MAX query runs; no INSERT queries fire for an empty list
  expect(pool.query).toHaveBeenCalledTimes(1);
  expect(result).toEqual([]);
});

test('addImagesToItem propagates DB errors from the MAX lookup', async () => {
  pool.query.mockRejectedValueOnce(new Error('connection lost'));
  await expect(addImagesToItem(2, ['/a.png'])).rejects.toThrow('connection lost');
});

test('setCoverImage moves the target image to sort_order 0 and shifts the rest after it', async () => {
  // Existing images in order: 10, 20, 30. Making 20 the cover.
  pool.query
    .mockResolvedValueOnce({ rows: [{ id: 10 }, { id: 20 }, { id: 30 }] }) // SELECT order
    .mockResolvedValueOnce({}) // UPDATE for id 20 -> 0
    .mockResolvedValueOnce({}) // UPDATE for id 10 -> 1
    .mockResolvedValueOnce({}); // UPDATE for id 30 -> 2

  const result = await setCoverImage(1, 20);

  expect(pool.query).toHaveBeenCalledTimes(4);
  expect(pool.query.mock.calls[1][1]).toEqual([0, 20]);
  expect(pool.query.mock.calls[2][1]).toEqual([1, 10]);
  expect(pool.query.mock.calls[3][1]).toEqual([2, 30]);
  expect(result).toEqual({ itemId: 1, coverImageId: 20 });
});

test('setCoverImage returns null when the image does not belong to the item', async () => {
  pool.query.mockResolvedValueOnce({ rows: [{ id: 10 }, { id: 20 }] });

  const result = await setCoverImage(1, 999);

  // Only the SELECT should have run; no UPDATE queries for a nonexistent image
  expect(pool.query).toHaveBeenCalledTimes(1);
  expect(result).toBeNull();
});

test('setCoverImage propagates DB errors from the initial SELECT', async () => {
  pool.query.mockRejectedValueOnce(new Error('connection lost'));
  await expect(setCoverImage(1, 20)).rejects.toThrow('connection lost');
});

test('deleteItemImage deletes scoped to both image id and item id', async () => {
  const fakeImage = { id: 5, item_id: 1 };
  pool.query.mockResolvedValueOnce({ rows: [fakeImage] });

  const result = await deleteItemImage(5, 1);

  expect(pool.query.mock.calls[0][1]).toEqual([5, 1]);
  expect(result).toEqual(fakeImage);
});

test('deleteItemImage returns undefined when nothing matched', async () => {
  pool.query.mockResolvedValueOnce({ rows: [] });
  const result = await deleteItemImage(5, 1);
  expect(result).toBeUndefined();
});

test('deleteItemImage propagates DB errors', async () => {
  pool.query.mockRejectedValueOnce(new Error('connection lost'));
  await expect(deleteItemImage(5, 1)).rejects.toThrow('connection lost');
});

test('updateItem updates the row and returns it', async () => {
  const fakeItem = { id: 1, name: 'New name' };
  pool.query.mockResolvedValueOnce({ rows: [fakeItem] });

  const data = {
    name: 'New name',
    price: 15,
    description: 'd',
    quality: 'fair',
    meetup: 'Yishun MRT',
  };
  const result = await updateItem(1, data);

  expect(pool.query.mock.calls[0][1]).toEqual([
    data.name,
    data.price,
    data.description,
    data.quality,
    data.meetup,
    1,
  ]);
  expect(result).toEqual(fakeItem);
});

test('updateItem returns undefined when no row matches the given id', async () => {
  pool.query.mockResolvedValueOnce({ rows: [] });

  const result = await updateItem(999, {
    name: 'Ghost',
    price: 1,
    description: '',
    quality: 'good',
    meetup: '',
  });

  expect(result).toBeUndefined();
});

test('updateItem propagates DB errors', async () => {
  pool.query.mockRejectedValueOnce(new Error('connection lost'));
  await expect(
    updateItem(1, { name: 'x', price: 1, description: 'd', quality: 'good', meetup: 'm' }),
  ).rejects.toThrow('connection lost');
});

test('setItemStatus accepts "active" and "sold" and updates the row', async () => {
  const fakeItem = { id: 1, status: 'sold' };
  pool.query.mockResolvedValueOnce({ rows: [fakeItem] });

  const result = await setItemStatus(1, 'sold');

  expect(pool.query.mock.calls[0][1]).toEqual(['sold', 1]);
  expect(result).toEqual(fakeItem);
});

test('setItemStatus rejects any status outside the allowed list without querying the db', async () => {
  await expect(setItemStatus(1, 'deleted')).rejects.toThrow(/Invalid status "deleted"/);
  expect(pool.query).not.toHaveBeenCalled();
});

test('setItemStatus rejects a missing/undefined status without querying the db', async () => {
  await expect(setItemStatus(1, undefined)).rejects.toThrow(/Invalid status "undefined"/);
  expect(pool.query).not.toHaveBeenCalled();
});

test('setItemStatus propagates DB errors for an otherwise-valid status', async () => {
  pool.query.mockRejectedValueOnce(new Error('connection lost'));
  await expect(setItemStatus(1, 'sold')).rejects.toThrow('connection lost');
});

test('deleteItem deletes and returns the removed row', async () => {
  const fakeItem = { id: 1 };
  pool.query.mockResolvedValueOnce({ rows: [fakeItem] });

  const result = await deleteItem(1);

  expect(pool.query.mock.calls[0][1]).toEqual([1]);
  expect(result).toEqual(fakeItem);
});

test('deleteItem returns undefined when no row matches the given id', async () => {
  pool.query.mockResolvedValueOnce({ rows: [] });
  const result = await deleteItem(999);
  expect(result).toBeUndefined();
});

test('deleteItem propagates DB errors', async () => {
  pool.query.mockRejectedValueOnce(new Error('connection lost'));
  await expect(deleteItem(1)).rejects.toThrow('connection lost');
});

test('setItemTags clears existing tags then finds-or-creates and attaches each new one', async () => {
  findOrCreateTag
    .mockResolvedValueOnce({ id: 1, name: 'textbooks' })
    .mockResolvedValueOnce({ id: 2, name: 'electronics' });

  pool.query
    .mockResolvedValueOnce({}) // DELETE existing tags
    .mockResolvedValueOnce({}) // INSERT tag 1
    .mockResolvedValueOnce({}); // INSERT tag 2

  const result = await setItemTags(10, ['Textbooks', 'Electronics']);

  expect(pool.query.mock.calls[0][0]).toContain('DELETE FROM "ItemTags"');
  expect(pool.query.mock.calls[0][1]).toEqual([10]);
  expect(findOrCreateTag).toHaveBeenCalledTimes(2);
  expect(pool.query.mock.calls[1][1]).toEqual([10, 1]);
  expect(pool.query.mock.calls[2][1]).toEqual([10, 2]);
  expect(result).toEqual([
    { id: 1, name: 'textbooks' },
    { id: 2, name: 'electronics' },
  ]);
});

test('setItemTags results in no attached tags when given an empty list, but still clears old ones', async () => {
  pool.query.mockResolvedValueOnce({}); // DELETE existing tags

  const result = await setItemTags(10, []);

  expect(pool.query).toHaveBeenCalledTimes(1);
  expect(findOrCreateTag).not.toHaveBeenCalled();
  expect(result).toEqual([]);
});

test('setItemTags propagates DB errors from the DELETE step, before touching findOrCreateTag', async () => {
  pool.query.mockRejectedValueOnce(new Error('connection lost'));
  await expect(setItemTags(10, ['textbooks'])).rejects.toThrow('connection lost');
  expect(findOrCreateTag).not.toHaveBeenCalled();
});

test('getTagsForItem returns the tags attached to the item', async () => {
  const fakeTags = [{ id: 1, name: 'textbooks' }];
  pool.query.mockResolvedValueOnce({ rows: fakeTags });

  const result = await getTagsForItem(10);

  expect(pool.query.mock.calls[0][1]).toEqual([10]);
  expect(result).toEqual(fakeTags);
});

test('getTagsForItem returns an empty array when the item has no tags', async () => {
  pool.query.mockResolvedValueOnce({ rows: [] });
  const result = await getTagsForItem(10);
  expect(result).toEqual([]);
});

test('getItemsByTag normalizes the tag name to lowercase and trims whitespace', async () => {
  pool.query.mockResolvedValueOnce({ rows: [] });

  await getItemsByTag('  Textbooks  ');

  expect(pool.query.mock.calls[0][1]).toEqual(['textbooks']);
});

test('getItemsByTag propagates DB errors', async () => {
  pool.query.mockRejectedValueOnce(new Error('connection lost'));
  await expect(getItemsByTag('textbooks')).rejects.toThrow('connection lost');
});

test('getRecommendedItems fills entirely with random items when the source item has no tags', async () => {
  pool.query
    .mockResolvedValueOnce({ rows: [] }) // no tags for item
    .mockResolvedValueOnce({ rows: [{ id: 2 }, { id: 3 }] }); // fallback random query

  const result = await getRecommendedItems(1, 4);

  // Only 2 queries: tags lookup + random fallback (no tag-matched query since no tags)
  expect(pool.query).toHaveBeenCalledTimes(2);
  const [, randomParams] = pool.query.mock.calls[1];
  expect(randomParams).toEqual([[1], 4]); // excludes only the source item
  expect(result).toEqual([{ id: 2 }, { id: 3 }]);
});

test('getRecommendedItems prioritizes tag-matched items and tops up with random ones to reach the limit', async () => {
  pool.query
    .mockResolvedValueOnce({ rows: [{ id: 5, name: 'textbooks' }] }) // getTagsForItem
    .mockResolvedValueOnce({ rows: [{ id: 2, match_count: 1 }] }) // tag-matched query
    .mockResolvedValueOnce({ rows: [{ id: 3 }, { id: 4 }] }); // random top-up query

  const result = await getRecommendedItems(1, 3);

  expect(pool.query).toHaveBeenCalledTimes(3);
  const topUpParams = pool.query.mock.calls[2][1];
  expect(topUpParams).toEqual([[1, 2], 2]); // excludes source + already-matched item, needs 2 more
  expect(result).toEqual([{ id: 2, match_count: 1 }, { id: 3 }, { id: 4 }]);
});

test('getRecommendedItems skips the random top-up query when tag matches already fill the limit', async () => {
  pool.query
    .mockResolvedValueOnce({ rows: [{ id: 5, name: 'textbooks' }] }) // getTagsForItem
    .mockResolvedValueOnce({ rows: [{ id: 2 }, { id: 3 }] }); // tag-matched query fills limit of 2

  const result = await getRecommendedItems(1, 2);

  expect(pool.query).toHaveBeenCalledTimes(2);
  expect(result).toEqual([{ id: 2 }, { id: 3 }]);
});

test('getRecommendedItems propagates DB errors from the initial tags lookup', async () => {
  pool.query.mockRejectedValueOnce(new Error('connection lost'));
  await expect(getRecommendedItems(1, 4)).rejects.toThrow('connection lost');
});
