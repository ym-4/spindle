const pool = require('../../src/models/db');
const Notification = require('../../src/models/Notification.model');

// ── Mocking ──────────────────────────────────────────────
jest.mock('../../src/models/db', () => ({
  query: jest.fn(),
  end: jest.fn(),
}));

jest.mock('../../src/models/Badge.model', () => ({
  awardBadge: jest.fn(),
  getBadgesForUser: jest.fn(),
}));

jest.mock('../../src/models/Notification.model', () => ({
  create: jest.fn(),
}));

const { getBadgesForUser: realGetBadgesForUser, awardBadge: realAwardBadge } = jest.requireActual(
  '../../src/models/Badge.model',
);

const { awardBadge } = require('../../src/models/Badge.model');
const { checkAndAwardBadges } = require('../../src/services/badgeService');

afterAll(() => {
  jest.restoreAllMocks();
});

// ===========================================================
// Badge
// ===========================================================
describe('Badge.model - getBadgesForUser', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: returns the full badge catalog with unlock status
  test('should return all badges with unlocked status for the user', async () => {
    const fakeBadges = [
      { id: 1, key: 'first_post', name: 'First Post', unlocked: true },
      { id: 2, key: 'prolific_poster', name: 'Prolific Poster', unlocked: false },
    ];
    pool.query.mockResolvedValue({ rows: fakeBadges });

    const result = await realGetBadgesForUser(5);

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('LEFT JOIN "UserBadges"'), [5]);
    expect(result).toEqual(fakeBadges);
  });

  // Boundary: user_id = 0
  test('should pass user_id = 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await realGetBadgesForUser(0);

    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [0]);
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(realGetBadgesForUser(5)).rejects.toThrow('connection lost');
  });
});

describe('Badge.model - awardBadge', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: badge exists and is newly awarded
  test('should award the badge and return the new UserBadges row', async () => {
    const fakeRow = { id: 1, user_id: 5, badge_id: 3 };
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 3 }] })
      .mockResolvedValueOnce({ rows: [fakeRow] });

    const result = await realAwardBadge(5, 'first_post');

    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('SELECT id FROM "Badges"'),
      ['first_post'],
    );
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO "UserBadges"'),
      [5, 3],
    );
    expect(result).toEqual(fakeRow);
  });

  // Boundary: badge key does not exist in the catalog
  test('should return null without attempting an insert when the badge key is unknown', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await realAwardBadge(5, 'not_a_real_badge');

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });

  // Boundary: badge already owned
  test('should return null when the user already owns the badge', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 3 }] }).mockResolvedValueOnce({ rows: [] });

    const result = await realAwardBadge(5, 'first_post');

    expect(result).toBeNull();
  });

  // Error handling: error during badge lookup propagates
  test('should propagate database errors from the badge lookup', async () => {
    pool.query.mockRejectedValueOnce(new Error('connection lost'));

    await expect(realAwardBadge(5, 'first_post')).rejects.toThrow('connection lost');
  });

  // Error handling: error during insert propagates
  test('should propagate database errors from the insert', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 3 }] })
      .mockRejectedValueOnce(new Error('constraint violation'));

    await expect(realAwardBadge(5, 'first_post')).rejects.toThrow('constraint violation');
  });
});

// ===========================================================
// badgeService
// ===========================================================
function mockPool(countMatchers) {
  pool.query.mockImplementation((sql) => {
    if (sql.includes('SELECT name, description FROM "Badges"')) {
      return Promise.resolve({
        rows: [{ name: 'Test Badge', description: 'You unlocked a test badge.' }],
      });
    }
    for (const { includes, count } of countMatchers) {
      if (sql.includes(includes)) return Promise.resolve({ rows: [{ count }] });
    }
    return Promise.resolve({ rows: [{ count: 0 }] });
  });
}

describe('badgeService.checkAndAwardBadges - post_created', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: exactly 1 post awards first_post only
  test('should award first_post when the user has exactly 1 post', async () => {
    mockPool([
      { includes: 'EXTRACT(HOUR', count: 0 },
      { includes: 'FROM "Posts"', count: 1 },
    ]);
    awardBadge.mockResolvedValueOnce({ id: 1 });

    await checkAndAwardBadges(5, ['post_created']);

    expect(awardBadge).toHaveBeenCalledTimes(1);
    expect(awardBadge).toHaveBeenCalledWith(5, 'first_post');
    expect(Notification.create).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ type: 'badge_unlocked' }),
    );
  });

  // Boundary: 10 posts awards both first_post AND prolific_poster
  test('should award both first_post and prolific_poster at 10 posts', async () => {
    mockPool([
      { includes: 'EXTRACT(HOUR', count: 0 },
      { includes: 'FROM "Posts"', count: 10 },
    ]);
    awardBadge.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce({ id: 2 });

    await checkAndAwardBadges(5, ['post_created']);

    expect(awardBadge).toHaveBeenCalledWith(5, 'first_post');
    expect(awardBadge).toHaveBeenCalledWith(5, 'prolific_poster');
    expect(awardBadge).toHaveBeenCalledTimes(2);
  });

  // Boundary: 20 posts before 5am awards night_owl
  test('should award night_owl at 20 early-morning posts', async () => {
    mockPool([
      { includes: 'EXTRACT(HOUR', count: 20 },
      { includes: 'FROM "Posts"', count: 20 },
    ]);
    awardBadge.mockResolvedValue({ id: 1 });

    await checkAndAwardBadges(5, ['post_created']);

    expect(awardBadge).toHaveBeenCalledWith(5, 'night_owl');
  });

  // Boundary: below every threshold awards nothing
  test('should award nothing when the user has 0 posts', async () => {
    mockPool([
      { includes: 'EXTRACT(HOUR', count: 0 },
      { includes: 'FROM "Posts"', count: 0 },
    ]);

    await checkAndAwardBadges(5, ['post_created']);

    expect(awardBadge).not.toHaveBeenCalled();
    expect(Notification.create).not.toHaveBeenCalled();
  });
});

describe('badgeService.checkAndAwardBadges - comment_created', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: exactly 1 comment awards first_comment only
  test('should award first_comment when the user has exactly 1 comment', async () => {
    mockPool([{ includes: 'FROM "PostComments"', count: 1 }]);
    awardBadge.mockResolvedValueOnce({ id: 1 });

    await checkAndAwardBadges(5, ['comment_created']);

    expect(awardBadge).toHaveBeenCalledWith(5, 'first_comment');
    expect(awardBadge).toHaveBeenCalledTimes(1);
  });

  // Boundary: 10 comments awards both first_comment AND chatterbox
  test('should award both first_comment and chatterbox at 10 comments', async () => {
    mockPool([{ includes: 'FROM "PostComments"', count: 10 }]);
    awardBadge.mockResolvedValue({ id: 1 });

    await checkAndAwardBadges(5, ['comment_created']);

    expect(awardBadge).toHaveBeenCalledWith(5, 'first_comment');
    expect(awardBadge).toHaveBeenCalledWith(5, 'chatterbox');
  });

  // Boundary: below threshold awards nothing
  test('should award nothing when the user has 0 comments', async () => {
    mockPool([{ includes: 'FROM "PostComments"', count: 0 }]);

    await checkAndAwardBadges(5, ['comment_created']);

    expect(awardBadge).not.toHaveBeenCalled();
  });
});

describe('badgeService.checkAndAwardBadges - friend_added', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: 25 accepted friends awards social_butterfly
  test('should award social_butterfly at 25 accepted friends', async () => {
    mockPool([{ includes: 'FROM "Friends"', count: 25 }]);
    awardBadge.mockResolvedValueOnce({ id: 1 });

    await checkAndAwardBadges(5, ['friend_added']);

    expect(awardBadge).toHaveBeenCalledWith(5, 'social_butterfly');
  });

  // Boundary: one below the threshold awards nothing
  test('should not award social_butterfly at 24 accepted friends', async () => {
    mockPool([{ includes: 'FROM "Friends"', count: 24 }]);

    await checkAndAwardBadges(5, ['friend_added']);

    expect(awardBadge).not.toHaveBeenCalled();
  });
});

describe('badgeService.checkAndAwardBadges - group_joined', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: always awards group_joiner
  test('should always attempt to award group_joiner', async () => {
    mockPool([]);
    awardBadge.mockResolvedValueOnce({ id: 1 });

    await checkAndAwardBadges(5, ['group_joined']);

    expect(awardBadge).toHaveBeenCalledWith(5, 'group_joiner');
    expect(awardBadge).toHaveBeenCalledTimes(1);
  });
});

describe('badgeService.checkAndAwardBadges - post_liked', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: always awards liked_post
  test('should always attempt to award liked_post', async () => {
    mockPool([{ includes: 'p.user_id', count: 0 }]);

    awardBadge.mockResolvedValueOnce({ id: 1 });

    await checkAndAwardBadges(5, ['post_liked']);

    expect(awardBadge).toHaveBeenCalledWith(5, 'liked_post');
  });

  // Boundary: 100 total likes across the user's posts awards fan_favorite
  test('should award fan_favorite at 100 total likes', async () => {
    mockPool([{ includes: 'p.user_id', count: 100 }]);
    awardBadge.mockResolvedValue({ id: 1 });

    await checkAndAwardBadges(5, ['post_liked']);

    expect(awardBadge).toHaveBeenCalledWith(5, 'fan_favorite');
  });

  // Boundary: rising_star only checked when context.postId is provided
  test('should award rising_star at 20 likes on a specific post when postId is given', async () => {
    mockPool([
      { includes: 'p.user_id', count: 0 },
      { includes: 'WHERE post_id = $1', count: 20 },
    ]);
    awardBadge.mockResolvedValue({ id: 1 });

    await checkAndAwardBadges(5, ['post_liked'], { postId: 42 });

    expect(awardBadge).toHaveBeenCalledWith(5, 'rising_star');
  });

  // Boundary: rising_star is never checked without a postId in context
  test('should not check rising_star when no postId is given in context', async () => {
    mockPool([{ includes: 'p.user_id', count: 0 }]);
    awardBadge.mockResolvedValueOnce({ id: 1 });

    await checkAndAwardBadges(5, ['post_liked']);

    expect(awardBadge).not.toHaveBeenCalledWith(5, 'rising_star');
  });
});

describe('badgeService.checkAndAwardBadges - pandabot_used', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: always awards pandabot_user
  test('should always attempt to award pandabot_user', async () => {
    mockPool([{ includes: "content ~* '@pandabot'", count: 1 }]);
    awardBadge.mockResolvedValueOnce({ id: 1 });

    await checkAndAwardBadges(5, ['pandabot_used']);

    expect(awardBadge).toHaveBeenCalledWith(5, 'pandabot_user');
  });

  // Boundary: 50 @pandabot mentions awards pandabot_whisperer
  test('should award pandabot_whisperer at 50 @pandabot mentions', async () => {
    mockPool([{ includes: "content ~* '@pandabot'", count: 50 }]);
    awardBadge.mockResolvedValue({ id: 1 });

    await checkAndAwardBadges(5, ['pandabot_used']);

    expect(awardBadge).toHaveBeenCalledWith(5, 'pandabot_whisperer');
  });
});

describe('badgeService.checkAndAwardBadges - general behavior', () => {
  afterEach(() => jest.clearAllMocks());

  // Boundary: an unrecognized trigger
  test('should silently ignore an unknown trigger', async () => {
    await expect(checkAndAwardBadges(5, ['not_a_real_trigger'])).resolves.toBeUndefined();

    expect(awardBadge).not.toHaveBeenCalled();
  });

  // Boundary: badge already owned, no notification
  test('should not send a notification when the badge is already owned', async () => {
    mockPool([{ includes: 'FROM "PostComments"', count: 1 }]);
    awardBadge.mockResolvedValueOnce(null);

    await checkAndAwardBadges(5, ['comment_created']);

    expect(Notification.create).not.toHaveBeenCalled();
  });

  // Error handling: a failure in one trigger doesn't block the others
  test('should isolate errors per trigger and still process the rest', async () => {
    pool.query.mockImplementation((sql) => {
      if (sql.includes('FROM "Posts"') && !sql.includes('EXTRACT')) {
        return Promise.reject(new Error('boom'));
      }
      if (sql.includes('FROM "PostComments"')) {
        return Promise.resolve({ rows: [{ count: 1 }] });
      }
      if (sql.includes('SELECT name, description')) {
        return Promise.resolve({ rows: [{ name: 'Test Badge', description: 'desc' }] });
      }
      return Promise.resolve({ rows: [{ count: 0 }] });
    });
    awardBadge.mockResolvedValue({ id: 1 });

    await expect(
      checkAndAwardBadges(5, ['post_created', 'comment_created']),
    ).resolves.toBeUndefined();

    expect(awardBadge).toHaveBeenCalledWith(5, 'first_comment');
  });
});
