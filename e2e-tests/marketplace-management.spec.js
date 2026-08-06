const { test, expect } = require('@playwright/test');

// ── Config ───────────────────────────────────────────────
const MARKETPLACE_URL = 'http://localhost:3000/marketplace.html';
const CREATE_LISTING_URL = 'http://localhost:3000/create_listing.html';
const MY_LISTINGS_URL = 'http://localhost:3000/my_listings.html';
const CART_URL = 'http://localhost:3000/cart.html';

const RUN_ID = Date.now();
let uidCounter = 0;
function uniqueTitle(label) {
  uidCounter += 1;
  return `E2E ${label} ${RUN_ID}-${uidCounter}`;
}
function uniqueTag(label) {
  uidCounter += 1;
  // The tag-oval-input has a real maxLength of 20, so the generated tag must
  // fit within that or the browser silently truncates it and later exact
  // string assertions fail. Last 5 digits of RUN_ID + the counter is unique
  // enough within a single suite run and leaves plenty of room for the label.
  const shortId = `${RUN_ID}`.slice(-5) + uidCounter;
  return `${label}${shortId}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);
}

// A real (tiny, valid) 1x1 PNG, so multer's fileFilter (which checks
// mimetype) has real bytes to work with — mirrors the fixture already used
// in __tests__/integration/Marketplace.test.js.
const PNG_1PX = Buffer.from(
  '89504e470d0a1a0a0000000d494844520000000100000001080600000' +
    '01f15c4890000000a49444154789c6360000002000100ffff03000006000557bfabd40000000049454e44ae426082',
  'hex',
);
function pngFile(name) {
  return { name, mimeType: 'image/png', buffer: PNG_1PX };
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
    images: overrides.images,
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

// Adds one confirmed tag oval via the real tag-add UI (click "+", type,
// Enter) — factored out of fillListingForm so tag-limit tests can drive it
// directly without needing a full listing payload.
async function addTag(page, tag) {
  await page.locator('#tagAddBtn').click();
  const input = page.locator('.tag-oval-input');
  await input.fill(tag);
  await input.press('Enter');
}

async function fillListingForm(
  page,
  { title, description, price, condition, location, tags = [], images = [] },
) {
  await page.locator('#listingTitle').fill(title);
  await page.locator('#listingDescription').fill(description);
  await page.locator('#listingPrice').fill(String(price));
  await page.locator(`#cond-${condition}`).waitFor({ state: 'attached' });
  // The radio input itself is styled with display:none (custom badge-style
  // selector), so click its associated <label> — the actual visible,
  // clickable element — rather than checking the hidden input directly.
  await page.locator(`label[for="cond-${condition}"]`).click();
  if (location) {
    await page.locator('#listingLocation').fill(location);
  }
  for (const tag of tags) {
    await addTag(page, tag);
  }
  if (images.length > 0) {
    await page.locator('#listingImages').setInputFiles(images);
  }
}

// Both marketplace.html and my_listings.html paginate at a fixed page size
// (10/page) over whatever's currently filtered, and the backend's listing
// query has no ORDER BY — so a specific listing (especially one created
// earlier in this same suite run, alongside pre-existing/seeded data) isn't
// reliably on page 1. Searching by the listing's (unique) title narrows the
// filtered set down to just that one listing before we look for it, which
// sidesteps pagination and ordering entirely regardless of how much other
// data exists.
async function findCardByTitle(page, title) {
  await page.locator('#marketplaceSearch').fill(title);
  const card = cardByTitle(page, title);
  await expect(card).toBeVisible({ timeout: 20000 });
  return card;
}

// Every listing created via the real form/API during this suite is tracked
// here so an afterEach hook (below) can delete it. Nothing else resets this
// dev DB between runs — without cleanup, every run permanently adds more
// rows (11 from the pagination test alone), so GET /marketplace/'s payload
// and the client-side render it feeds keep growing, and later tests in a run
// (or later runs entirely) get progressively slower until they time out.
const createdItemIds = [];

async function createListing(page, listing) {
  await page.goto(CREATE_LISTING_URL);
  await fillListingForm(page, listing);
  await page.locator('#submitListingBtn').click();
  await expect(page).toHaveURL(/marketplace\.html/);
  const card = await findCardByTitle(page, listing.title);
  const itemId = await card.getAttribute('data-id');
  if (itemId) createdItemIds.push(itemId);
  return card;
}

test.afterEach(async ({ page }) => {
  const ids = createdItemIds.splice(0, createdItemIds.length);
  for (const id of ids) {
    // Best-effort: a test that already deleted its own listing (Owner
    // Listing Management) will get a 404 here, which is fine to ignore.
    await page.request.delete(`http://localhost:3000/marketplace/${id}`).catch(() => {});
  }
});

// Opens the Filters dropdown (hidden by default) so its inputs/chips are interactable.
async function openFilters(page) {
  await page.locator('#filterDropdownBtn').click();
  await expect(page.locator('.spindle-filter-menu')).toBeVisible();
}

// Adds an item to the cart straight from its detail page and waits for the
// confirmation modal, returning the item id.
async function addItemToCartFromDetailPage(page, listing, qty) {
  const card = await createListing(page, listing);
  const itemId = await card.getAttribute('data-id');
  await page.goto(`http://localhost:3000/item.html?id=${itemId}`);
  if (qty && qty !== 1) {
    await page.locator('#qtyInput').fill(String(qty));
  }
  await page.locator('#addToCartBtn').click();
  await expect(page.locator('#addedToCartModal')).toBeVisible();
  // Close the modal (Bootstrap traps focus/clicks behind it otherwise).
  await page.keyboard.press('Escape');
  return itemId;
}

// Locates a cart.html row by the item id captured when it was created.
function cartRow(page, itemId) {
  return page.locator(`.cart-container [data-id="${itemId}"]`);
}

// ══════════════════════════════════════════════════════════
// 1. Marketplace Browse & Listings Grid
// ══════════════════════════════════════════════════════════
test.describe('Marketplace Browse & Listings Grid', () => {
  test('should display the listings container and the Add Listing / My Listings entry points', async ({
    page,
  }) => {
    await page.goto(MARKETPLACE_URL);
    await expect(page.locator('#listings-container')).toBeVisible();
    // Note: `a[href="create_listing.html"]` also matches the hidden
    // empty-state CTA inside #no-listings-state ("Add a Listing"), which is
    // present in the DOM even when d-none. Match on accessible name instead
    // to target only the persistent toolbar link.
    await expect(page.getByRole('link', { name: /Add Listing/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /My Listings/ })).toBeVisible();
  });

  // Valid partition: a created listing shows title, price, quality badge,
  // and links through to its own item detail page.
  test('should show a created listing with title, price, and quality badge, linking to its own detail page', async ({
    page,
  }) => {
    const listing = makeListing('Browse Basic', { price: '12.50' });
    const card = await createListing(page, listing);

    await expect(card.locator('.spindle-card-title')).toHaveText(listing.title);
    await expect(card.locator('.spindle-card-price')).toContainText('12.50');
    await expect(card.locator('.spindle-badge')).toBeVisible();

    const itemId = await card.getAttribute('data-id');
    await expect(card.locator('.spindle-card-link')).toHaveAttribute(
      'href',
      `item.html?id=${itemId}`,
    );
  });

  // Boundary: more than one page's worth of (search-scoped) results paginates correctly.
  test('should paginate when there are more than 10 matching listings', async ({ page }) => {
    const sharedLabel = 'Pagination';
    const sharedPrefix = `E2E ${sharedLabel} ${RUN_ID}`;
    for (let i = 0; i < 11; i++) {
      await createListing(page, makeListing(sharedLabel));
    }

    await page.goto(MARKETPLACE_URL);
    await page.locator('#marketplaceSearch').fill(sharedPrefix);

    await expect(listingCards(page)).toHaveCount(10);
    await expect(page.locator('#pagination-controls .page-num')).toHaveCount(2);

    await page.locator('#next-page-btn').click();
    await expect(listingCards(page)).toHaveCount(1);
    await expect(page.locator('.page-num.active')).toHaveText('2');
  });
});

// ══════════════════════════════════════════════════════════
// 2. Create Listing
// ══════════════════════════════════════════════════════════
test.describe('Create Listing', () => {
  // Valid partition: filling every required field and submitting creates the listing
  test('should create a listing and redirect to the marketplace', async ({ page }) => {
    const listing = makeListing('Create Happy Path');
    const card = await createListing(page, listing);
    await expect(card.locator('.spindle-card-title')).toHaveText(listing.title);
  });

  // Error handling: an entirely empty form never reaches the network call, and
  // omitting just the condition surfaces its own field-level error.
  test('should block submission and show validation errors when required fields are missing', async ({
    page,
  }) => {
    await page.goto(CREATE_LISTING_URL);
    await page.locator('#submitListingBtn').click();
    await expect(page).toHaveURL(/create_listing\.html/);
    await expect(page.locator('#createListingForm')).toHaveClass(/was-validated/);

    await page.locator('#listingTitle').fill(uniqueTitle('No Condition'));
    await page.locator('#listingDescription').fill('Missing condition on purpose.');
    await page.locator('#listingPrice').fill('10');
    await page.locator('#submitListingBtn').click();

    await expect(page).toHaveURL(/create_listing\.html/);
    await expect(page.locator('#conditionError')).toBeVisible();
    await expect(page.locator('#conditionError')).toContainText('Please select a condition.');
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

// ══════════════════════════════════════════════════════════
// 3. Item Detail Page
// ══════════════════════════════════════════════════════════
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

  // Valid partition: the "Chat with Seller" entry point never shows on your own listing.
  test('should hide the "Chat with Seller" button on the viewer\'s own listing', async ({
    page,
  }) => {
    const listing = makeListing('Detail Own Listing Chat');
    const card = await createListing(page, listing);
    const itemId = await card.getAttribute('data-id');

    await page.goto(`http://localhost:3000/item.html?id=${itemId}`);
    await expect(page.locator('#chatSellerBtn')).toBeHidden();
  });
});

// ══════════════════════════════════════════════════════════
// 4. Image Uploads
// ══════════════════════════════════════════════════════════
test.describe('Image Uploads', () => {
  // Valid partition: a single uploaded image previews on the form and becomes the card thumbnail.
  test('should preview an uploaded image and show it as the listing thumbnail', async ({
    page,
  }) => {
    const listing = makeListing('Image Single', { images: [pngFile('photo.png')] });

    await page.goto(CREATE_LISTING_URL);
    await fillListingForm(page, listing);
    await expect(page.locator('.image-preview-thumb')).toHaveCount(1);

    await page.locator('#submitListingBtn').click();
    await expect(page).toHaveURL(/marketplace\.html/);
    const card = await findCardByTitle(page, listing.title);

    // Uploaded images are served from marketplace-uploads with a
    // timestamp-prefixed filename (see Marketplace.router.js), unlike the
    // shared "1.png" placeholder used when a listing has no photos.
    await expect(card.locator('.spindle-card-media img')).toHaveAttribute(
      'src',
      /\/uploads\/marketplace-uploads\/\d+-/,
    );
  });

  // Valid partition: multiple images produce a navigable carousel on the item page.
  test('should show a navigable carousel when a listing has multiple images', async ({ page }) => {
    const listing = makeListing('Image Multi', {
      images: [pngFile('a.png'), pngFile('b.png'), pngFile('c.png')],
    });
    const card = await createListing(page, listing);
    const itemId = await card.getAttribute('data-id');

    await page.goto(`http://localhost:3000/item.html?id=${itemId}`);
    await expect(page.locator('#itemCarouselInner .carousel-item')).toHaveCount(3);
    await expect(page.locator('#itemCarouselIndicators button')).toHaveCount(3);

    const nextBtn = page.locator('#itemImageCarousel .carousel-control-next');
    await expect(nextBtn).toBeVisible();
    await nextBtn.click();
    await expect(page.locator('#itemCarouselIndicators button.active')).toHaveAttribute(
      'data-bs-slide-to',
      '1',
    );
  });

  // Valid partition: choosing a different photo as the cover changes the thumbnail used.
  test('should update the listing thumbnail when a different photo is set as the cover', async ({
    page,
  }) => {
    const listing = makeListing('Image Cover', {
      images: [pngFile('first.png'), pngFile('second.png')],
    });

    await page.goto(CREATE_LISTING_URL);
    await fillListingForm(page, listing);

    const thumbs = page.locator('.image-preview-thumb');
    await expect(thumbs).toHaveCount(2);
    // The first uploaded photo ("first.png") is the cover by default.
    await expect(thumbs.nth(0).locator('.image-thumb-cover-btn')).toHaveClass(/active/);

    // Set the second photo ("second.png") as the cover instead.
    await thumbs.nth(1).locator('.image-thumb-cover-btn').click();
    await expect(thumbs.nth(1).locator('.image-thumb-cover-btn')).toHaveClass(/active/);
    await expect(thumbs.nth(0).locator('.image-thumb-cover-btn')).not.toHaveClass(/active/);

    await page.locator('#submitListingBtn').click();
    await expect(page).toHaveURL(/marketplace\.html/);
    const card = await findCardByTitle(page, listing.title);

    // The card thumbnail should now be served from the chosen-cover upload
    // ("second.png"), not the one that would have defaulted to cover.
    await expect(card.locator('.spindle-card-media img')).toHaveAttribute('src', /second\.png$/);
  });
});

// ══════════════════════════════════════════════════════════
// 5. Tags
// ══════════════════════════════════════════════════════════
test.describe('Tags', () => {
  // Valid partition: tags attached on create show on both the card and the item detail page.
  test('should attach tags to a listing and display them on the card and detail page', async ({
    page,
  }) => {
    const tag1 = uniqueTag('books');
    const tag2 = uniqueTag('sale');
    const listing = makeListing('Tags Display', { tags: [tag1, tag2] });
    const card = await createListing(page, listing);

    const cardTagText = (await card.locator('.spindle-card-tags').innerText()).toLowerCase();
    expect(cardTagText).toContain(tag1);
    expect(cardTagText).toContain(tag2);

    const itemId = await card.getAttribute('data-id');
    await page.goto(`http://localhost:3000/item.html?id=${itemId}`);
    const detailTagText = (await page.locator('#itemTags').innerText()).toLowerCase();
    expect(detailTagText).toContain(tag1);
    expect(detailTagText).toContain(tag2);
  });

  // Boundary: the 5-tag limit shows a modal instead of allowing a 6th tag oval.
  test('should show the tag-limit modal after reaching the 5-tag maximum', async ({ page }) => {
    await page.goto(CREATE_LISTING_URL);
    for (let i = 0; i < 5; i++) {
      await addTag(page, uniqueTag(`limit${i}`));
    }
    await expect(page.locator('.tag-oval')).toHaveCount(5);

    await page.locator('#tagAddBtn').click();
    await expect(page.locator('#maxTagsModal')).toBeVisible();
    // The 6th click must not have created another oval.
    await expect(page.locator('.tag-oval')).toHaveCount(5);
  });

  // Valid partition: selecting a tag chip in the Filters dropdown narrows results to matching listings.
  test('should filter listings down to a tag when its chip is selected', async ({ page }) => {
    const sharedLabel = 'Tag Filter';
    const sharedPrefix = `E2E ${sharedLabel} ${RUN_ID}`;
    const tag = uniqueTag('filter');
    const tagged = makeListing(sharedLabel, { tags: [tag] });
    const untagged = makeListing(sharedLabel);
    await createListing(page, tagged);
    await createListing(page, untagged);

    await page.goto(MARKETPLACE_URL);
    await page.locator('#marketplaceSearch').fill(sharedPrefix);
    await openFilters(page);
    await page.locator(`.spindle-filter-chip[data-tag-name="${tag}"]`).click();

    await expect(cardByTitle(page, tagged.title)).toBeVisible();
    await expect(cardByTitle(page, untagged.title)).toHaveCount(0);
  });
});

// ══════════════════════════════════════════════════════════
// 6. Search & Filters
// ══════════════════════════════════════════════════════════
test.describe('Search & Filters', () => {
  // Valid partition + boundary: search narrows results, and clearing it restores them.
  test('should filter listings by name via the search bar and restore them when cleared', async ({
    page,
  }) => {
    const cheap = makeListing('Search Cheap', { price: '5' });
    const pricey = makeListing('Search Pricey', { price: '250' });
    await createListing(page, cheap);
    await createListing(page, pricey);

    await page.goto(MARKETPLACE_URL);
    await page.locator('#marketplaceSearch').fill(cheap.title);
    await expect(cardByTitle(page, cheap.title)).toBeVisible();
    await expect(cardByTitle(page, pricey.title)).toHaveCount(0);

    await page.locator('#search-clear-btn').click();
    await expect(page.locator('#marketplaceSearch')).toHaveValue('');
    await page.locator('#marketplaceSearch').fill(cheap.title.split(' ').slice(0, 3).join(' '));
    await expect(cardByTitle(page, cheap.title)).toBeVisible();
  });

  // Boundary: a max-price filter excludes items priced above it, and shows the active-filter badge.
  test('should exclude listings priced above the max-price filter and show the active-filter badge', async ({
    page,
  }) => {
    const sharedLabel = 'Filter Max';
    const sharedPrefix = `E2E ${sharedLabel} ${RUN_ID}`;
    const cheap = makeListing(sharedLabel, { price: '5' });
    const pricey = makeListing(sharedLabel, { price: '250' });
    await createListing(page, cheap);
    await createListing(page, pricey);

    await page.goto(MARKETPLACE_URL);
    // Scope to just these two via search — the price filter alone doesn't
    // bound pagination, and by this point in the run there may be many more
    // (unrelated) listings than fit on one page.
    await page.locator('#marketplaceSearch').fill(sharedPrefix);
    await openFilters(page);
    await page.locator('#filter-max-price').fill('20');

    await expect(cardByTitle(page, cheap.title)).toBeVisible();
    await expect(cardByTitle(page, pricey.title)).toHaveCount(0);
    await expect(page.locator('#filter-active-count')).toBeVisible();
    await expect(page.locator('#filter-active-count')).toHaveText('1');
  });

  // Error handling / reset path: clearing filters removes the badge and restores everything.
  test('clearing filters should remove the active-filter badge and show all listings again', async ({
    page,
  }) => {
    const cheap = makeListing('Filter Clear Cheap', { price: '5' });
    await createListing(page, cheap);

    await page.goto(MARKETPLACE_URL);
    // Scope to just this listing via search too, since the min-price filter
    // alone doesn't bound pagination down to a single page.
    await page.locator('#marketplaceSearch').fill(cheap.title);
    await openFilters(page);
    await page.locator('#filter-min-price').fill('100');
    await expect(cardByTitle(page, cheap.title)).toHaveCount(0);

    await page.locator('#filter-clear-btn').click();

    await expect(page.locator('#filter-active-count')).toBeHidden();
    // Clear also wipes the search box (by design), so re-scope by search to
    // confirm the listing itself reappeared, without depending on it landing
    // on page 1 of the full, unfiltered set.
    await page.locator('#marketplaceSearch').fill(cheap.title);
    await expect(cardByTitle(page, cheap.title)).toBeVisible();
  });
});

// ══════════════════════════════════════════════════════════
// 7. Cart
// ══════════════════════════════════════════════════════════
test.describe('Cart', () => {
  // Valid partition: adding from the detail page confirms and updates the badge count.
  test('should let a shopper add an item to their cart and update the cart badge', async ({
    page,
  }) => {
    const listing = makeListing('Cart Add');
    await addItemToCartFromDetailPage(page, listing, 1);

    await page.goto(MARKETPLACE_URL);
    const badge = page.locator('#cart-count-badge');
    await expect(badge).toBeVisible();
    await expect(badge).not.toHaveText('0');
  });

  // Valid partition: the cart page lists the item with the right price/quantity, and editing persists.
  test('should list the item with the correct price and quantity, and persist an edited quantity', async ({
    page,
  }) => {
    const listing = makeListing('Cart Row', { price: '15' });
    const itemId = await addItemToCartFromDetailPage(page, listing, 2);

    await page.goto(CART_URL);
    const row = cartRow(page, itemId);
    await expect(row.locator('.card-price')).toContainText('15.00');
    await expect(row.locator('.card-quantity')).toContainText('2');

    await row.locator('.edit-btn').click();
    await page.locator('#editQuantity').fill('5');
    await page.locator('#editSaveBtn').click();

    await expect(cartRow(page, itemId).locator('.card-quantity')).toContainText('5');
  });

  // Error handling / cleanup path: removing one item, then clearing the rest, empties the cart.
  test('should remove a single item, then clear the cart entirely', async ({ page }) => {
    const keep = makeListing('Cart Keep');
    const remove = makeListing('Cart Remove');
    const keepId = await addItemToCartFromDetailPage(page, keep, 1);
    const removeId = await addItemToCartFromDetailPage(page, remove, 1);

    await page.goto(CART_URL);
    // Note: .remove-btn itself shows no confirm() dialog — only clear-cart-btn
    // does — so no dialog handler is registered for this click.
    await cartRow(page, removeId).locator('.remove-btn').click();
    await expect(cartRow(page, removeId)).toHaveCount(0);
    await expect(cartRow(page, keepId)).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#clear-cart-btn').click();
    await expect(page.locator('#empty-cart-state')).toBeVisible();
  });
});

// ══════════════════════════════════════════════════════════
// 8. Checkout / Mock Payment Gateway
// ══════════════════════════════════════════════════════════
test.describe('Checkout / Mock Payment Gateway', () => {
  // The cart is a persistent resource for this logged-in user across the
  // entire suite run — nothing resets it between tests/files. That's fine
  // for the Cart tests (they scope assertions to a specific item's own row),
  // but these tests sum every row's price × quantity to check the order
  // total, so a leftover item from an earlier test would silently inflate
  // it. Calling clearCart() directly (rather than through the confirm-dialog
  // UI, which isn't the point of this setup step) guarantees a clean start.
  test.beforeEach(async ({ page }) => {
    await page.goto(CART_URL);
    const cleared = page.waitForResponse((res) => res.url().includes('/cart/clear/'));
    await page.evaluate(() => clearCart(localStorage.loggedInUserId));
    await cleared;
  });

  // Valid partition: proceeding to checkout opens the modal with the correct order total.
  test('should open the payment modal with the correct order total', async ({ page }) => {
    const listing = makeListing('Checkout Total', { price: '25' });
    await addItemToCartFromDetailPage(page, listing, 2);

    await page.goto(CART_URL);
    await page.locator('.checkout-btn').click();
    await expect(page.locator('#paymentModal')).toBeVisible();
    await expect(page.locator('#paymentTotal')).toHaveText('$50.00');
  });

  // Valid partition: a valid card completes the order, shows a receipt, and empties the cart.
  test('should complete payment with a valid card and show a receipt', async ({ page }) => {
    const listing = makeListing('Checkout Success', { price: '10' });
    await addItemToCartFromDetailPage(page, listing, 1);

    await page.goto(CART_URL);
    await page.locator('.checkout-btn').click();
    await page.locator('#cardNumber').fill('4242 4242 4242 4242');
    await page.locator('#cardExpiry').fill('12/29');
    await page.locator('#cardCvv').fill('123');
    await page.locator('#payNowBtn').click();

    await expect(page.locator('#paymentSuccess')).toBeVisible();
    await expect(page.locator('#receiptRef')).toContainText('MOCK-');
    await expect(page.locator('#receiptLast4')).toHaveText('4242');
  });

  // Error handling: a card ending in 0000 is the mock gateway's built-in decline
  // scenario — checkout should surface the error and leave the cart intact.
  test('should show a payment error for a declined card and keep the cart intact', async ({
    page,
  }) => {
    const listing = makeListing('Checkout Decline', { price: '10' });
    const itemId = await addItemToCartFromDetailPage(page, listing, 1);

    await page.goto(CART_URL);
    await page.locator('.checkout-btn').click();
    await page.locator('#cardNumber').fill('4242 4242 4242 0000');
    await page.locator('#cardExpiry').fill('12/29');
    await page.locator('#cardCvv').fill('123');
    await page.locator('#payNowBtn').click();

    await expect(page.locator('#paymentError')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#paymentError')).toContainText('declined');

    await page.keyboard.press('Escape');
    await page.reload();
    await expect(cartRow(page, itemId)).toBeVisible();
  });
});

// ══════════════════════════════════════════════════════════
// 9. Recommended Items
// ══════════════════════════════════════════════════════════
test.describe('Recommended Items', () => {
  // Valid partition: a tag-matched listing shows up as a recommendation.
  test('should recommend another listing that shares a tag', async ({ page }) => {
    const tag = uniqueTag('rec');
    const other = makeListing('Rec Other', { tags: [tag] });
    const viewed = makeListing('Rec Viewed', { tags: [tag] });
    await createListing(page, other);
    const viewedCard = await createListing(page, viewed);
    const viewedId = await viewedCard.getAttribute('data-id');

    await page.goto(`http://localhost:3000/item.html?id=${viewedId}`);
    await expect(page.locator('#recommended-section')).toBeVisible();
    await expect(
      page.locator('#recommended-container .spindle-card-title', { hasText: other.title }),
    ).toBeVisible();
  });

  // Valid partition: a recommended card links through to its own detail page.
  test("should link a recommended item's card through to its own detail page", async ({ page }) => {
    const tag = uniqueTag('reclink');
    const other = makeListing('Rec Link Other', { tags: [tag] });
    const viewed = makeListing('Rec Link Viewed', { tags: [tag] });
    const otherCard = await createListing(page, other);
    const otherId = await otherCard.getAttribute('data-id');
    const viewedCard = await createListing(page, viewed);
    const viewedId = await viewedCard.getAttribute('data-id');

    await page.goto(`http://localhost:3000/item.html?id=${viewedId}`);
    const recCard = page
      .locator('#recommended-container .spindle-card')
      .filter({ has: page.locator('.spindle-card-title', { hasText: other.title }) });
    await recCard.locator('.spindle-card-link').click();

    await expect(page).toHaveURL(new RegExp(`item\\.html\\?id=${otherId}$`));
    await expect(page.locator('#itemTitle')).toHaveText(other.title);
  });

  // Valid partition: adding a recommended item to the cart works the same as a regular listing.
  test('should let a shopper add a recommended item to their cart', async ({ page }) => {
    const tag = uniqueTag('reccart');
    const other = makeListing('Rec Cart Other', { tags: [tag] });
    const viewed = makeListing('Rec Cart Viewed', { tags: [tag] });
    await createListing(page, other);
    const viewedCard = await createListing(page, viewed);
    const viewedId = await viewedCard.getAttribute('data-id');

    await page.goto(`http://localhost:3000/item.html?id=${viewedId}`);
    const recCard = page
      .locator('#recommended-container .spindle-card')
      .filter({ has: page.locator('.spindle-card-title', { hasText: other.title }) });
    await recCard.locator('.add-to-cart-btn').click();

    await expect(page.locator('#addedToCartModal')).toBeVisible();
  });
});

// ══════════════════════════════════════════════════════════
// 10. Owner Listing Management (my_listings.html)
// ══════════════════════════════════════════════════════════
test.describe('Owner Listing Management', () => {
  // Valid partition: the owner view shows Edit / Mark as Sold / Delete controls, and editing persists.
  test('should show owner controls and let the owner edit a listing', async ({ page }) => {
    const listing = makeListing('Owner Edit', { price: '18' });
    await createListing(page, listing);

    await page.goto(MY_LISTINGS_URL);
    const card = await findCardByTitle(page, listing.title);
    // Scoped to the owner-controls footer specifically — a bare 'a' +
    // hasText:'Edit' also matches the card's own outer link here, since this
    // test's listing title itself contains the word "Edit".
    const editLink = card.locator('.spindle-owner-btn', { hasText: 'Edit' });
    await expect(editLink).toBeVisible();
    await expect(card.locator('.spindle-status-btn')).toContainText('Mark as Sold');
    await expect(card.locator('.spindle-delete-btn')).toBeVisible();

    await editLink.click();
    await expect(page).toHaveURL(/create_listing\.html\?id=\d+/);
    await expect(page.locator('#listingTitle')).toHaveValue(listing.title);
    await expect(page.locator('#formHeading')).toHaveText('Edit Details');

    await page.locator('#listingPrice').fill('99');
    await page.locator('#submitListingBtn').click();

    await expect(page).toHaveURL(/my_listings\.html/);
    const updatedCard = await findCardByTitle(page, listing.title);
    await expect(updatedCard.locator('.spindle-card-price')).toContainText('99.00');
  });

  // Valid partition: marking a listing sold hides it from the public marketplace, and relisting undoes that.
  test('should mark a listing as sold, hide it from the marketplace, then relist it', async ({
    page,
  }) => {
    const listing = makeListing('Owner Mark Sold');
    await createListing(page, listing);

    await page.goto(MY_LISTINGS_URL);
    const card = await findCardByTitle(page, listing.title);
    page.once('dialog', (dialog) => dialog.accept());
    await card.locator('.spindle-status-btn').click();
    await expect(card.locator('.spindle-status-btn')).toContainText('Relist');

    await page.goto(MARKETPLACE_URL);
    await page.locator('#marketplaceSearch').fill(listing.title);
    await expect(cardByTitle(page, listing.title)).toHaveCount(0);

    await page.goto(MY_LISTINGS_URL);
    const soldCard = await findCardByTitle(page, listing.title);
    await soldCard.locator('.spindle-status-btn').click(); // relist, no confirm needed

    await page.goto(MARKETPLACE_URL);
    await findCardByTitle(page, listing.title);
  });

  // Error handling + valid partition: cancelling a delete keeps the listing; confirming
  // it removes only that listing, and its own detail page then shows not-found.
  test('should keep a listing when delete is cancelled, but remove it (and only it) when confirmed', async ({
    page,
  }) => {
    const keep = makeListing('Owner Delete Keep');
    const toDelete = makeListing('Owner Delete Target');
    await createListing(page, keep);
    const deleteCard = await createListing(page, toDelete);
    const deleteId = await deleteCard.getAttribute('data-id');

    await page.goto(MY_LISTINGS_URL);
    const cancelTarget = await findCardByTitle(page, toDelete.title);
    page.once('dialog', (dialog) => dialog.dismiss());
    await cancelTarget.locator('.spindle-delete-btn').click();
    await expect(cardByTitle(page, toDelete.title)).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await cancelTarget.locator('.spindle-delete-btn').click();
    await expect(cardByTitle(page, toDelete.title)).toHaveCount(0);
    await findCardByTitle(page, keep.title);

    await page.goto(`http://localhost:3000/item.html?id=${deleteId}`);
    await expect(page.locator('#itemNotFound')).toBeVisible();
  });
});
