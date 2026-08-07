const { test, expect } = require('@playwright/test');
const { BASE, registerViaAPI } = require('./helpers');

// Friends feature: search, send a request, see it pending, accept it.
// Global setup logs in Alice (id 2 from seed, friends with Bob) and stores her session.
const FRIENDS_URL = `${BASE}/friends.html`;

async function goToFriends(page) {
  await page.goto(FRIENDS_URL);
  await expect(page.locator('#friendsTabs')).toBeVisible({ timeout: 15000 });
}

test.describe('Friends journeys', () => {
  test('search finds matching users and shows the empty state for a miss', async ({ page }) => {
    await goToFriends(page);

    await page.locator('button[data-friend-tab="add"]').click();
    await expect(page.locator('#friendSearch')).toBeVisible();
    await page.fill('#friendSearch', 'dave');
    await expect(page.locator('#searchResults')).toContainText('Dave', { timeout: 10000 });

    await page.fill('#friendSearch', 'zzzz_no_such_user');
    await expect(page.locator('#searchResults')).toContainText('No users found', {
      timeout: 10000,
    });
  });

  test('sending a friend request turns the card button into "Pending"', async ({ page }) => {
    await goToFriends(page);

    await page.locator('button[data-friend-tab="add"]').click();
    await expect(page.locator('#friendSearch')).toBeVisible();
    await page.fill('#friendSearch', 'carol');

    const card = page.locator('#searchResults .friend-card').filter({ hasText: 'Carol' }).first();
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.locator('.btn-friend--primary[data-add]').click();
    await expect(page.locator('#sendRequest')).toBeVisible();
    await page.locator('#sendRequest').click();

    // Re-run the search so the card renders with its updated relationship state.
    await page.fill('#friendSearch', 'carol');
    await expect(card.locator('.friend-card__actions .btn-friend--disabled')).toHaveText(
      'Pending',
      { timeout: 10000 },
    );
  });

  test('an incoming friend request can be accepted and links the two users', async ({
    page,
    request,
  }) => {
    // Navigate first so localStorage belongs to the app origin.
    await goToFriends(page);

    // Second participant: a brand-new account that sends Alice a friend request via the API.
    const { token: strangerToken, name: strangerName } = await registerViaAPI(request);

    const aliceId = await page.evaluate(() => Number(localStorage.getItem('loggedInUserId')));
    expect(aliceId).toBeGreaterThan(0);

    const send = await request.post(`${BASE}/friends/request`, {
      headers: { Authorization: `Bearer ${strangerToken}` },
      data: { receiver_id: aliceId },
    });
    expect(send.status()).toBe(201);

    // Alice opens Friends > Pending > Received and accepts.
    await page.locator('button[data-friend-tab="pending"]').click();
    await expect(page.locator('#pendingRequestsList')).toContainText(strangerName, {
      timeout: 10000,
    });

    await page.locator('#pendingRequestsList [data-accept]').first().click();
    await expect(page.locator('#pendingRequestsList')).not.toContainText(strangerName, {
      timeout: 10000,
    });

    // The new friend now appears in the "All friends" list.
    await page.locator('button[data-friend-tab="all"]').click();
    await expect(page.locator('#allFriendsList')).toContainText(strangerName, { timeout: 10000 });
  });
});