// ── Edit-mode detection ──
// If ?id= is present, this page edits an existing listing instead of
// creating a new one. Same form, same tag/image logic — just a different
// submit target and a prefill step.
const urlParams = new URLSearchParams(window.location.search);
const editingItemId = urlParams.get('id');

// ── Element refs ──
const titleInput = document.getElementById('listingTitle');
const descInput = document.getElementById('listingDescription');
const titleCount = document.getElementById('titleCount');
const descCount = document.getElementById('descCount');
const priceInput = document.getElementById('listingPrice');
const locationInput = document.getElementById('listingLocation');
const form = document.getElementById('createListingForm');

// ── Character counters ──
titleInput.addEventListener('input', () => {
  titleCount.textContent = titleInput.value.length;
});
descInput.addEventListener('input', () => {
  descCount.textContent = descInput.value.length;
});

// ── Tags state ──
const tagOvalContainer = document.getElementById('tagOvalContainer');
const tagAddBtn = document.getElementById('tagAddBtn');
const MAX_TAGS = 5;
let currentTags = [];

function createTagOval(prefillValue) {
  const oval = document.createElement('div');
  oval.className = 'tag-oval';

  if (prefillValue) {
    // Already-confirmed tag (used when prefilling from an existing listing) —
    // render straight into the "confirmed" state, no editable input.
    renderConfirmedOval(oval, prefillValue);
    tagOvalContainer.insertBefore(oval, tagAddBtn);
    return;
  }

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'tag-oval-input';
  input.maxLength = 20;
  input.placeholder = 'tag';

  oval.appendChild(input);
  tagOvalContainer.insertBefore(oval, tagAddBtn);
  input.focus();

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // critical — stops it bubbling up to a form submit
      confirmTag(oval, input);
    }
    if (e.key === 'Escape') {
      oval.remove();
    }
  });

  input.addEventListener('blur', () => confirmTag(oval, input));
}

function renderConfirmedOval(oval, value) {
  oval.innerHTML = `
    <span class="tag-oval-text">${value}</span>
    <button type="button" class="tag-oval-remove" aria-label="Remove tag">
      <i class="fas fa-times"></i>
    </button>
  `;
  currentTags.push(value);

  oval.querySelector('.tag-oval-remove').addEventListener('click', () => {
    currentTags = currentTags.filter((t) => t !== value);
    oval.remove();
  });
}

function confirmTag(oval, input) {
  const value = input.value.trim().toLowerCase();

  if (!value || currentTags.includes(value)) {
    oval.remove();
    return;
  }

  oval.innerHTML = '';
  renderConfirmedOval(oval, value);
}

// ── Tooltips ──
document.addEventListener('DOMContentLoaded', () => {
  const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  tooltipTriggerList.forEach((el) => new bootstrap.Tooltip(el));
});

// initialize the modal once
const maxTagsModal = new bootstrap.Modal(document.getElementById('maxTagsModal'));

tagAddBtn.addEventListener('click', () => {
  if (currentTags.length >= MAX_TAGS) {
    maxTagsModal.show();
    return;
  }
  createTagOval();
});

// ── Image state ──
// selectedFiles holds NEW files staged for upload (not yet on the server).
// existingImages holds images already saved on the item (edit mode only).
// Each entry gets a stable `_key` so we can track cover/remove clicks
// without relying on array index, which shifts as items are removed.
const MAX_IMAGES = 6;
let selectedFiles = []; // { _key, file }
let existingImages = []; // { _key, id, image_url }
let removedExistingImageIds = [];
let coverKey = null; // the _key of whichever image is currently the cover

let _keyCounter = 0;
function nextKey() {
  return `img_${_keyCounter++}`;
}

const uploadZone = document.getElementById('uploadZone');
const listingImagesInput = document.getElementById('listingImages');
const previewContainer = document.getElementById('image-preview-container');

uploadZone.addEventListener('click', () => listingImagesInput.click());

function totalImageCount() {
  return existingImages.length + selectedFiles.length;
}

listingImagesInput.addEventListener('change', () => {
  const incoming = Array.from(listingImagesInput.files);
  const room = MAX_IMAGES - totalImageCount();

  incoming.slice(0, Math.max(0, room)).forEach((file) => {
    const key = nextKey();
    selectedFiles.push({ _key: key, file });
    if (coverKey === null) coverKey = key; // first image added becomes cover by default
  });

  // Reset the input so picking the same file(s) again re-fires 'change' —
  // otherwise the browser only reports NEW selections here, which is exactly
  // why images used to appear to "overwrite": .files never accumulated.
  listingImagesInput.value = '';

  renderImagePreviews();
});

function renderImagePreviews() {
  previewContainer.innerHTML = '';

  // Existing images always render first — this matches the real sort_order
  // on the server (existing images were inserted before anything new).
  existingImages.forEach((img) => {
    previewContainer.appendChild(buildThumb(img._key, img.image_url, false));
  });

  selectedFiles.forEach((entry) => {
    // Build a temporary object URL for the preview
    const url = URL.createObjectURL(entry.file);
    previewContainer.appendChild(buildThumb(entry._key, url, true));
  });
}

function buildThumb(key, src, isNew) {
  const wrapper = document.createElement('div');
  wrapper.className = 'image-preview-thumb';
  wrapper.dataset.key = key;

  const isCover = key === coverKey;

  wrapper.innerHTML = `
    <img src="${src}" alt="">
    <button type="button" class="image-thumb-cover-btn${isCover ? ' active' : ''}" title="${isCover ? 'Cover photo' : 'Set as cover photo'}">
      <i class="fas fa-star"></i>
    </button>
    <button type="button" class="image-thumb-remove-btn" title="Remove photo">
      <i class="fas fa-times"></i>
    </button>
  `;

  wrapper.querySelector('.image-thumb-cover-btn').addEventListener('click', () => {
    coverKey = key;
    renderImagePreviews();
  });

  wrapper.querySelector('.image-thumb-remove-btn').addEventListener('click', () => {
    if (isNew) {
      selectedFiles = selectedFiles.filter((f) => f._key !== key);
    } else {
      const removed = existingImages.find((img) => img._key === key);
      if (removed) removedExistingImageIds.push(removed.id);
      existingImages = existingImages.filter((img) => img._key !== key);
    }

    if (coverKey === key) {
      const remaining = [...existingImages, ...selectedFiles];
      coverKey = remaining.length > 0 ? remaining[0]._key : null;
    }

    renderImagePreviews();
  });

  return wrapper;
}

// ── Condition (quality) helpers ──
// Maps the radio button value used in this form to the plain-English string
// stored in the DB, and back again (for prefilling in edit mode).
const CONDITION_TO_QUALITY = {
  new: 'Brand New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

function qualityToConditionValue(quality) {
  const q = String(quality || '').trim().toLowerCase();
  if (q === 'brand new' || q === 'new') return 'new';
  if (q === 'like new') return 'like_new';
  if (q === 'good') return 'good';
  if (q === 'fair') return 'fair';
  if (q === 'poor' || q === 'for parts' || q === 'for parts / poor') return 'poor';
  return null;
}

// ── Edit mode: prefill from the existing listing ──
async function loadItemForEditing() {
  fetchMethod(`http://localhost:3000/marketplace/${editingItemId}`, (status, item) => {
    if (status !== 200 || !item || !item.id) {
      console.error('Failed to load listing for editing:', status, item);
      alert("Couldn't load that listing to edit it.");
      window.location.href = 'my_listings.html';
      return;
    }

    // Basic client-side ownership guard. NOTE: the server does not currently
    // enforce this — anyone who knows the item id could still PUT/DELETE it
    // directly via the API. This only stops the UI from being used that way;
    // it is not real authorization.
    if (String(item.seller_id) !== String(localStorage.loggedInUserId)) {
      alert("You can only edit your own listings.");
      window.location.href = 'my_listings.html';
      return;
    }

    document.getElementById('pageHeaderTitle').textContent = 'Edit Listing';
    document.getElementById('pageHeaderSubtitle').textContent = 'Update your listing details';
    document.getElementById('formHeading').textContent = 'Edit Details';
    document.getElementById('submitListingBtnText').textContent = 'Save Changes';
    document.title = 'Edit Listing – Spindle';

    titleInput.value = item.name || '';
    titleCount.textContent = titleInput.value.length;
    descInput.value = item.description || '';
    descCount.textContent = descInput.value.length;
    priceInput.value = item.price != null ? Number(item.price) : '';
    locationInput.value = item.meetup || '';

    const conditionValue = qualityToConditionValue(item.quality);
    if (conditionValue) {
      const radio = document.getElementById(`cond-${conditionValue.replace('_', '-')}`);
      if (radio) radio.checked = true;
    }

    (item.tags || []).forEach((tag) => createTagOval(tag.name));

    existingImages = (item.images || []).map((img) => ({
      _key: nextKey(),
      id: img.id,
      image_url: img.image_url,
    }));
    coverKey = existingImages.length > 0 ? existingImages[0]._key : null;
    renderImagePreviews();
  });
}

if (editingItemId) {
  loadItemForEditing();
}

// ── Form submission ──
form.addEventListener('submit', (e) => {
  e.preventDefault();

  // Validate condition radio group
  const conditionError = document.getElementById('conditionError');
  const conditionValue = document.querySelector('input[name="condition"]:checked')?.value;
  if (!conditionValue) {
    conditionError.textContent = 'Please select a condition.';
    conditionError.style.display = 'block';
  } else {
    conditionError.style.display = 'none';
  }

  if (!form.checkValidity() || !conditionValue) {
    form.classList.add('was-validated');
    return;
  }

  const data = {
    seller_id: localStorage.loggedInUserId,
    name: titleInput.value.trim(),
    description: descInput.value.trim(),
    price: parseFloat(priceInput.value),
    quality: CONDITION_TO_QUALITY[conditionValue],
    meetup: locationInput.value.trim(),
  };

  if (editingItemId) {
    submitEdit(data);
  } else {
    submitCreate(data);
  }
});

function submitCreate(data) {
  fetchMethod(
    `http://localhost:3000/marketplace/`,
    async (status, responseData) => {
      if (status < 200 || status >= 300 || !responseData?.id) {
        console.error('Listing creation failed', status, responseData);
        return;
      }

      const itemId = responseData.id;

      if (selectedFiles.length > 0) {
        // Put the chosen cover file first — since this is a brand-new listing
        // with no existing images, upload order determines sort_order, so
        // "first uploaded" is enough to make it the cover with no extra call.
        const ordered = [...selectedFiles].sort((a, b) =>
          a._key === coverKey ? -1 : b._key === coverKey ? 1 : 0,
        );
        await uploadImages(itemId, ordered.map((f) => f.file));
      }

      if (currentTags.length > 0) {
        await saveTags(itemId, currentTags);
      }

      window.location.href = 'marketplace.html';
    },
    'POST',
    data,
  );
}

function submitEdit(data) {
  fetchMethod(
    `http://localhost:3000/marketplace/${editingItemId}`,
    async (status, responseData) => {
      if (status < 200 || status >= 300) {
        console.error('Listing update failed', status, responseData);
        return;
      }

      const itemId = editingItemId;

      for (const imageId of removedExistingImageIds) {
        await deleteImage(itemId, imageId);
      }

      let uploadedNew = [];
      if (selectedFiles.length > 0) {
        const ordered = [...selectedFiles].sort((a, b) =>
          a._key === coverKey ? -1 : b._key === coverKey ? 1 : 0,
        );
        uploadedNew = (await uploadImages(itemId, ordered.map((f) => f.file))) || [];
      }

      // Persist the cover choice if it landed on an existing image (not the
      // default first one) or on a newly-uploaded file.
      const coverIsExisting = existingImages.some((img) => img._key === coverKey);
      if (coverIsExisting) {
        const coverImg = existingImages.find((img) => img._key === coverKey);
        await setCover(itemId, coverImg.id);
      } else if (uploadedNew.length > 0 && selectedFiles.some((f) => f._key === coverKey)) {
        // We uploaded the cover file first in the batch above, so it's the
        // first entry in the server's response for this upload.
        await setCover(itemId, uploadedNew[0].id);
      }

      // Always sync tags in edit mode (including clearing them out entirely).
      await saveTags(itemId, currentTags);

      window.location.href = 'my_listings.html';
    },
    'PUT',
    data,
  );
}

function uploadImages(itemId, files) {
  const formData = new FormData();
  files.forEach((file) => formData.append('images', file));

  return fetch(`http://localhost:3000/marketplace/${itemId}/images`, {
    method: 'POST',
    body: formData, // no Content-Type header — browser sets the multipart boundary
  })
    .then(async (res) => {
      if (!res.ok) {
        console.error('Image upload failed', await res.text());
        return null;
      }
      const json = await res.json();
      return json.images;
    })
    .catch((err) => {
      console.error('Image upload error:', err);
      return null;
    });
}

function deleteImage(itemId, imageId) {
  return fetch(`http://localhost:3000/marketplace/${itemId}/images/${imageId}`, {
    method: 'DELETE',
  }).catch((err) => console.error('Image delete error:', err));
}

function setCover(itemId, imageId) {
  return fetch(`http://localhost:3000/marketplace/${itemId}/images/${imageId}/cover`, {
    method: 'PUT',
  }).catch((err) => console.error('Set cover error:', err));
}

function saveTags(itemId, tags) {
  return fetch(`http://localhost:3000/marketplace/${itemId}/tags`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags }),
  })
    .then(async (res) => {
      if (!res.ok) console.error('Tag save failed', await res.text());
    })
    .catch((err) => console.error('Tag save error:', err));
}
