const { test, expect } = require('@playwright/test');

// ── Helper ───────────────────────────────────────────────
const BASE_URL = 'http://localhost:3000/index.html';
const API_BASE = 'http://localhost:3000';

test.beforeEach(async ({ page }) => {
  await page.goto(BASE_URL);
});

// ── Helpers ──────────────────────────────────────────────
async function openGame(page) {
  await page.locator('#snakePlayBtn').click();
  await expect(page.locator('#snakeModalOverlay')).toBeVisible();
  await expect(page.locator('#snakeCanvas')).toBeVisible();
}

// Waits for a game over
async function waitForGameOver(page, timeout = 8000) {
  await expect(page.locator('#snakeOverlay')).toBeVisible({ timeout });
  await expect(page.locator('#snakeOverlayTitle')).not.toHaveText('⏸ Paused', { timeout });
}

// Seed a score for the currently logged-in test user
async function seedSnakeScore(page, score) {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  await page.request.post(`${API_BASE}/snake/score`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { score },
  });
}

// ── Open & Close Game ────────────────────────────────────
test.describe('Open & Close Game', () => {
  // Valid partition: Play opens the modal with game running
  test('should open the game modal with a fresh round running', async ({ page }) => {
    await openGame(page);

    await expect(page.locator('#snakeLiveScore')).toHaveText('0');
    await expect(page.locator('#snakeLiveLevel')).toHaveText('1');
  });

  // Valid partition: Quit closes the modal entirely
  test('should close the modal when Quit is clicked', async ({ page }) => {
    await openGame(page);

    await page.locator('#snakeQuitBtn').click();

    await expect(page.locator('#snakeModalOverlay')).toBeHidden();
  });

  // Boundary: quitting from the post-game-over overlay is a distinct button/path
  // from the in-game Quit button, and should also close the modal
  test('should close the modal from the game-over overlay Quit button', async ({ page }) => {
    await openGame(page);
    // Small chance a coincidentally-placed food is eaten before the wall is
    // hit, but the round still ends deterministically either way.
    await waitForGameOver(page);

    await page.locator('#snakeOverlayQuit').click();

    await expect(page.locator('#snakeModalOverlay')).toBeHidden();
  });
});

// ── Pause & Resume ───────────────────────────────────────
test.describe('Pause & Resume', () => {
  // Valid partition: pausing shows the paused overlay with the correct labels
  test('should show the paused overlay when P is pressed', async ({ page }) => {
    await openGame(page);

    await page.keyboard.press('p');

    await expect(page.locator('#snakeOverlay')).toBeVisible();
    await expect(page.locator('#snakeOverlayTitle')).toHaveText('⏸ Paused');
    await expect(page.locator('#snakeRestartBtn')).toHaveText('▶ Resume');
  });

  // Valid partition: resuming hides the overlay and restores normal play controls
  test('should hide the paused overlay and restore labels when Resume is clicked', async ({
    page,
  }) => {
    await openGame(page);
    await page.keyboard.press('p');
    await expect(page.locator('#snakeOverlay')).toBeVisible();

    await page.locator('#snakeRestartBtn').click();

    await expect(page.locator('#snakeOverlay')).toBeHidden();
    await expect(page.locator('#snakeRestartBtn')).toHaveText('▶ Play again');
  });

  // Boundary: a paused game should not progress — no game-over, no score change
  test('should not progress the game while paused', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('p');
    await expect(page.locator('#snakeOverlayTitle')).toHaveText('⏸ Paused');

    // wait well beyond the ~1.5s it would normally take to hit the wall
    await page.waitForTimeout(2500);

    await expect(page.locator('#snakeOverlayTitle')).toHaveText('⏸ Paused');
    await expect(page.locator('#snakeLiveScore')).toHaveText('0');
  });
});

// ── Game Over & Restart ──────────────────────────────────
test.describe('Game Over & Restart', () => {
  // Valid partition: running into the wall ends the round
  test('should end the round and show the game-over overlay', async ({ page }) => {
    await openGame(page);
    await waitForGameOver(page);
    await expect(page.locator('#snakeOverlay')).toBeVisible();
  });

  // Valid partition: Play again starts a fresh round
  test('should start a fresh round when Play again is clicked', async ({ page }) => {
    await openGame(page);
    await waitForGameOver(page);

    await page.locator('#snakeRestartBtn').click();

    await expect(page.locator('#snakeOverlay')).toBeHidden();
    await expect(page.locator('#snakeCanvas')).toBeVisible();
    await expect(page.locator('#snakeLiveScore')).toHaveText('0');
    await expect(page.locator('#snakeLiveLevel')).toHaveText('1');
  });

  // Boundary: the overlay correctly displays the final score and level
  test('should display the final score and level on the game-over overlay', async ({ page }) => {
    await openGame(page);
    await waitForGameOver(page);

    await expect(page.locator('#snakeOverlayScore')).toContainText('Score:');
    await expect(page.locator('#snakeOverlayScore')).toContainText('Level:');
  });
});

// ── Leaderboard ──────────────────────────
test.describe('Leaderboard & Personal Best', () => {
  // Valid partition: user's most recent score is sdisplayed on the home page modal
  test("should reflect the player's real best score on the home page card", async ({ page }) => {
    await seedSnakeScore(page, 111111);
    await page.goto(BASE_URL);

    await expect(page.locator('#snakeHighScoreDisplay')).toHaveText('111111');
  });

  // Valid partition: the leaderboard opened during an active game shows their score
  test('should show the seeded score in the leaderboard opened from an active game', async ({
    page,
  }) => {
    await seedSnakeScore(page, 222222);
    await openGame(page);

    await page.locator('#snakeViewLeaderboardBtn').click();

    await expect(page.locator('#snakeLeaderboardView')).toBeVisible();
    const topEntry = page.locator('#snakeLeaderboard li').first();
    await expect(topEntry).toContainText('222222');
  });

  // Boundary: the leaderboard can be opened
  test('should show the seeded score in the leaderboard opened from the game-over overlay', async ({
    page,
  }) => {
    await seedSnakeScore(page, 333333);
    await openGame(page);
    await waitForGameOver(page);

    await page.locator('#snakeOverlayViewLeaderboardBtn').click();
    await expect(page.locator('#snakeLeaderboardView')).toBeVisible();
    const topEntry = page.locator('#snakeLeaderboard li').first();
    await expect(topEntry).toContainText('333333');

    await page.locator('#snakeLeaderboardBackBtn').click();
    await expect(page.locator('#snakeLeaderboardView')).toBeHidden();
  });
});
