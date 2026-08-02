const { test, expect } = require('@playwright/test');

// ── Config ───────────────────────────────────────────────
const MARKETPLACE_URL = 'http://localhost:3000/marketplace.html';
const CREATE_LISTING_URL = 'http://localhost:3000/create_listing.html';
const MY_LISTINGS_URL = 'http://localhost:3000/my_listings.html';

// There's no API reset hook available to this suite (only the browser), and
// tests may run in parallel, so every listing gets its own unique title —
// otherwise two tests' cards would collide under the same `.spindle-card`
// selector and break strict-mode locators / count assertions.
const RUN_ID = Date.now();
let uidCounter = 0;
function uniqueTitle(label) {
  uidCounter += 1;
  return `E2E ${label} ${RUN_ID}-${uidCounter}`;
}

// Builds a fresh, uniquely-titled listing payload for a test. Only `label` is
// required; everything else has a sensible default so call sites only need
// to specify what that particular test cares about.
function makeListing(label, overrides = {}) {
  return {
    title: uniqueTitle(label),
    description: overrides.description || `Auto-generated listing for the "${label}" e2e test.`,
    price: overrides.price || '10',
    condition: overrides.condition || 'good',
    location: overrides.location,
    tags: overrides.tags,
  };
}

// ── Helpers ──────────────────────────────────────────────

function listingCards(page) {
  return page.locator('.spindle-card');
}

function cardByTitle(page, title) {
  return listingCards(page).filter({
    has: page.locator('.spindle-card-title', { hasText: title }),
  });
}

async function fillListingForm(
  page,
  { title, description, price, condition, location, tags = [] },
) {
  await page.locator('#listingTitle').fill(title);
  await page.locator('#listingDescription').fill(description);
  await page.locator('#listingPrice').fill(String(price));
  await page.locator(`#cond-${condition}`).check();
  if (location) {
    await page.locator('#listingLocation').fill(location);
  }
  for (const tag of tags) {
    await page.locator('#tagAddBtn').click();
    const input = page.locator('.tag-oval-input');
    await input.fill(tag);
    await input.press('Enter');
  }
}

// Creates a listing end-to-end via the real form and waits for the redirect
// back to the marketplace, then returns the resulting card locator.
async function createListing(page, listing) {
  await page.goto(CREATE_LISTING_URL);
  await fillListingForm(page, listing);
  await page.locator('#submitListingBtn').click();
  await expect(page).toHaveURL(/marketplace\.html/);
  const card = cardByTitle(page, listing.title);
  await expect(card).toBeVisible();
  return card;
}

// Opens the Filters dropdown (hidden by default) so its inputs/chips are interactable.
async function openFilters(page) {
  await page.locator('#filterDropdownBtn').click();
  await expect(page.locator('.spindle-filter-menu')).toBeVisible();
}

// ── Page load ────────────────────────────────────────────
test.describe('Marketplace page load', () => {
  test('should display the listings container', async ({ page }) => {
    await page.goto(MARKETPLACE_URL);
    await expect(page.locator('#listings-container')).toBeVisible();
  });

  test('should display the Add Listing and My Listings entry points', async ({ page }) => {
    await page.goto(MARKETPLACE_URL);
    await expect(page.locator('a[href="create_listing.html"]')).toBeVisible();
    await expect(page.locator('a[href="my_listings.html"]')).toBeVisible();
  });
});

// ── Browse Listings ──────────────────────────────────────
test.describe('Browse Listings', () => {
  test('should show a created listing with title, price, and quality badge', async ({ page }) => {
    const listing = makeListing('Browse Basic', { price: '12.50' });
    const card = await createListing(page, listing);

    await expect(card.locator('.spindle-card-price')).toContainText('12.50');
    await expect(card.locator('.spindle-badge')).toBeVisible();
  });

  test('each listing card should link through to its own item detail page', async ({ page }) => {
    const listing = makeListing('Browse Link');
    const card = await createListing(page, listing);

    const itemId = await card.getAttribute('data-id');
    await expect(card.locator('.spindle-card-link')).toHaveAttribute(
      'href',
      `item.html?id=${itemId}`,
    );
  });
});

// ── Create Listing ───────────────────────────────────────
test.describe('Create Listing', () => {
  // Valid partition: filling every required field and submitting creates the listing
  test('should create a listing and redirect to the marketplace', async ({ page }) => {
    const listing = makeListing('Create Happy Path');
    const card = await createListing(page, listing);
    await expect(card.locator('.spindle-card-title')).toHaveText(listing.title);
  });

  // Valid partition: optional fields (location, tags) are attached and displayed
  test('should attach an optional meet-up location and tags to the listing', async ({ page }) => {
    const listing = makeListing('Create With Tags', {
      location: 'Clementi MRT',
      tags: ['textbooks', 'e2e'],
    });
    const card = await createListing(page, listing);

    await expect(card.locator('.spindle-card-meetup')).toContainText(listing.location);
    const tagText = await card.locator('.spindle-card-tags').innerText();
    for (const tag of listing.tags) {
      expect(tagText.toLowerCase()).toContain(tag);
    }
  });

  // Boundary: condition left unselected blocks submission (mirrors the manual conditionValue check)
  test('should block submission and show an error when no condition is selected', async ({
    page,
  }) => {
    await page.goto(CREATE_LISTING_URL);
    await page.locator('#listingTitle').fill(uniqueTitle('No Condition'));
    await page.locator('#listingDescription').fill('Missing condition on purpose.');
    await page.locator('#listingPrice').fill('10');

    await page.locator('#submitListingBtn').click();

    await expect(page).toHaveURL(/create_listing\.html/);
    await expect(page.locator('#conditionError')).toBeVisible();
    await expect(page.locator('#conditionError')).toContainText('Please select a condition.');
  });

  // Error handling: an entirely empty form never reaches the network call
  test('should keep the user on the form when every required field is empty', async ({ page }) => {
    await page.goto(CREATE_LISTING_URL);
    await page.locator('#submitListingBtn').click();

    await expect(page).toHaveURL(/create_listing\.html/);
    await expect(page.locator('#createListingForm')).toHaveClass(/was-validated/);
  });

  // Boundary: the title input's maxlength attribute caps input at 100 characters.
  // Uses pressSequentially (real keystrokes) rather than fill(), since fill()
  // sets the value directly and bypasses the browser's maxlength truncation.
  test('should cap the title length at 100 characters and reflect it in the counter', async ({
    page,
  }) => {
    await page.goto(CREATE_LISTING_URL);
    const longTitle = 'x'.repeat(150);
    await page.locator('#listingTitle').pressSequentially(longTitle);

    const value = await page.locator('#listingTitle').inputValue();
    expect(value.length).toBe(100);
    await expect(page.locator('#titleCount')).toHaveText('100');
  });
});

// ── Item Detail Page ─────────────────────────────────────
test.describe('Item Detail Page', () => {
  test('should show the listing title, price, description, and meet-up spot', async ({ page }) => {
    const listing = makeListing('Detail Page', { price: '30', location: 'Clementi MRT' });
    const card = await createListing(page, listing);
    const itemId = await card.getAttribute('data-id');

    await page.goto(`http://localhost:3000/item.html?id=${itemId}`);

    await expect(page.locator('#itemLoaded')).toBeVisible();
    await expect(page.locator('#itemTitle')).toHaveText(listing.title);
    await expect(page.locator('#itemPrice')).toContainText('30.00');
    await expect(page.locator('#itemDescription')).toHaveText(listing.description);
    await expect(page.locator('#itemMeetup')).toContainText(listing.location);
  });

  // Boundary: an id that doesn't exist should show the not-found state, not a broken page
  test("should show a not-found state for an item id that doesn't exist", async ({ page }) => {
    await page.goto('http://localhost:3000/item.html?id=999999999');
    await expect(page.locator('#itemNotFound')).toBeVisible();
    await expect(page.locator('#itemLoaded')).toBeHidden();
  });

  test('should let a shopper add the item to their cart', async ({ page }) => {
    const listing = makeListing('Add To Cart');
    const card = await createListing(page, listing);
    const itemId = await card.getAttribute('data-id');

    await page.goto(`http://localhost:3000/item.html?id=${itemId}`);
    await page.locator('#addToCartBtn').click();

    await expect(page.locator('#addedToCartModal')).toBeVisible();
    await expect(page.locator('#addedToCartModal')).toContainText(
      'Item Added to Cart Successfully!',
    );
  });
});

// ── Search & Filters ─────────────────────────────────────
test.describe('Search & Filters', () => {
  test('should filter listings by name via the search bar', async ({ page }) => {
    const cheap = makeListing('Search Cheap', { price: '5' });
    const pricey = makeListing('Search Pricey', { price: '250' });
    await createListing(page, cheap);
    await createListing(page, pricey);

    await page.goto(MARKETPLACE_URL);
    await page.locator('#marketplaceSearch').fill(cheap.title);

    await expect(cardByTitle(page, cheap.title)).toBeVisible();
    await expect(cardByTitle(page, pricey.title)).toHaveCount(0);
  });

  // Boundary: clearing the search restores the full, unfiltered listing set
  test('should restore all listings when the search is cleared', async ({ page }) => {
    const cheap = makeListing('Search Clear Cheap', { price: '5' });
    const pricey = makeListing('Search Clear Pricey', { price: '250' });
    await createListing(page, cheap);
    await createListing(page, pricey);

    await page.goto(MARKETPLACE_URL);
    await page.locator('#marketplaceSearch').fill(cheap.title);
    await expect(cardByTitle(page, pricey.title)).toHaveCount(0);

    await page.locator('#search-clear-btn').click();

    await expect(cardByTitle(page, cheap.title)).toBeVisible();
    await expect(cardByTitle(page, pricey.title)).toBeVisible();
  });

  // Boundary: a max-price filter excludes items priced above it
  test('should exclude listings priced above the max-price filter', async ({ page }) => {
    const cheap = makeListing('Filter Max Cheap', { price: '5' });
    const pricey = makeListing('Filter Max Pricey', { price: '250' });
    await createListing(page, cheap);
    await createListing(page, pricey);

    await page.goto(MARKETPLACE_URL);
    await openFilters(page);
    await page.locator('#filter-max-price').fill('20');

    await expect(cardByTitle(page, cheap.title)).toBeVisible();
    await expect(cardByTitle(page, pricey.title)).toHaveCount(0);
  });

  test('should show an active filter count badge once a filter is applied', async ({ page }) => {
    await page.goto(MARKETPLACE_URL);
    await openFilters(page);
    await page.locator('#filter-min-price').fill('100');

    await expect(page.locator('#filter-active-count')).toBeVisible();
    await expect(page.locator('#filter-active-count')).toHaveText('1');
  });

  test('clearing filters should remove the active filter badge and show all listings', async ({
    page,
  }) => {
    const cheap = makeListing('Filter Clear Cheap', { price: '5' });
    await createListing(page, cheap);

    await page.goto(MARKETPLACE_URL);
    await openFilters(page);
    await page.locator('#filter-min-price').fill('100');
    await expect(cardByTitle(page, cheap.title)).toHaveCount(0);

    await page.locator('#filter-clear-btn').click();

    await expect(page.locator('#filter-active-count')).toBeHidden();
    await expect(cardByTitle(page, cheap.title)).toBeVisible();
  });
});

// ── Owner Listing Management (my_listings.html) ──────────
test.describe('Owner Listing Management', () => {
  // Valid partition: the owner view shows Edit / Mark as Sold / Delete controls
  test('should show owner controls for a listing the current user created', async ({ page }) => {
    const listing = makeListing('Owner Controls');
    await createListing(page, listing);

    await page.goto(MY_LISTINGS_URL);
    const card = cardByTitle(page, listing.title);
    await expect(card.locator('a', { hasText: 'Edit' })).toBeVisible();
    await expect(card.locator('.spindle-status-btn')).toContainText('Mark as Sold');
    await expect(card.locator('.spindle-delete-btn')).toBeVisible();
  });

  // Valid partition: editing a listing prefills the form and persists changes
  test('should let the owner edit a listing and see the change reflected', async ({ page }) => {
    const listing = makeListing('Owner Edit', { price: '18' });
    await createListing(page, listing);

    await page.goto(MY_LISTINGS_URL);
    const card = cardByTitle(page, listing.title);
    await card.locator('a', { hasText: 'Edit' }).click();

    await expect(page).toHaveURL(/create_listing\.html\?id=\d+/);
    await expect(page.locator('#listingTitle')).toHaveValue(listing.title);
    await expect(page.locator('#formHeading')).toHaveText('Edit Details');

    await page.locator('#listingPrice').fill('99');
    await page.locator('#submitListingBtn').click();

    await expect(page).toHaveURL(/my_listings\.html/);
    const updatedCard = cardByTitle(page, listing.title);
    await expect(updatedCard.locator('.spindle-card-price')).toContainText('99.00');
  });

  // Valid partition: marking a listing sold hides it from the public marketplace
  test('should mark a listing as sold and hide it from the public marketplace', async ({
    page,
  }) => {
    const listing = makeListing('Owner Mark Sold');
    await createListing(page, listing);

    await page.goto(MY_LISTINGS_URL);
    const card = cardByTitle(page, listing.title);
    page.once('dialog', (dialog) => dialog.accept());
    await card.locator('.spindle-status-btn').click();
    await expect(card.locator('.spindle-status-btn')).toContainText('Relist');

    await page.goto(MARKETPLACE_URL);
    await expect(cardByTitle(page, listing.title)).toHaveCount(0);
  });

  // Valid partition: relisting a sold item brings it back to the public marketplace
  test('should relist a sold listing so it reappears on the public marketplace', async ({
    page,
  }) => {
    const listing = makeListing('Owner Relist');
    await createListing(page, listing);

    await page.goto(MY_LISTINGS_URL);
    const card = cardByTitle(page, listing.title);
    page.once('dialog', (dialog) => dialog.accept()); // mark as sold
    await card.locator('.spindle-status-btn').click();
    await expect(card.locator('.spindle-status-btn')).toContainText('Relist');

    await card.locator('.spindle-status-btn').click(); // relist, no confirm needed

    await page.goto(MARKETPLACE_URL);
    await expect(cardByTitle(page, listing.title)).toBeVisible();
  });

  // Error handling: cancelling the delete confirmation keeps the listing
  test('cancelling the delete confirmation should keep the listing', async ({ page }) => {
    const listing = makeListing('Owner Cancel Delete');
    await createListing(page, listing);

    await page.goto(MY_LISTINGS_URL);
    const card = cardByTitle(page, listing.title);
    page.once('dialog', (dialog) => dialog.dismiss());
    await card.locator('.spindle-delete-btn').click();

    await expect(cardByTitle(page, listing.title)).toBeVisible();
  });

  // Valid partition: deleting a listing removes it, leaving other listings intact
  test('should delete a listing while leaving other listings intact', async ({ page }) => {
    const keep = makeListing('Owner Delete Keep');
    const toDelete = makeListing('Owner Delete Target');
    await createListing(page, keep);
    await createListing(page, toDelete);

    await page.goto(MY_LISTINGS_URL);
    const card = cardByTitle(page, toDelete.title);
    page.once('dialog', (dialog) => dialog.accept());
    await card.locator('.spindle-delete-btn').click();

    await expect(cardByTitle(page, toDelete.title)).toHaveCount(0);
    await expect(cardByTitle(page, keep.title)).toBeVisible();
  });

  // Boundary: a deleted listing's own item page should show the not-found state
  test("a deleted listing's item page should show a not-found state", async ({ page }) => {
    const listing = makeListing('Owner Delete Then View');
    const card = await createListing(page, listing);
    const itemId = await card.getAttribute('data-id');

    await page.goto(MY_LISTINGS_URL);
    const ownerCard = cardByTitle(page, listing.title);
    page.once('dialog', (dialog) => dialog.accept());
    await ownerCard.locator('.spindle-delete-btn').click();
    await expect(ownerCard).toHaveCount(0);

    await page.goto(`http://localhost:3000/item.html?id=${itemId}`);
    await expect(page.locator('#itemNotFound')).toBeVisible();
  });
});
