// ── Character counters ──
const titleInput = document.getElementById('listingTitle');
const descInput = document.getElementById('listingDescription');
const titleCount = document.getElementById('titleCount');
const descCount = document.getElementById('descCount');

titleInput.addEventListener('input', () => {
  titleCount.textContent = titleInput.value.length;
});
descInput.addEventListener('input', () => {
  descCount.textContent = descInput.value.length;
});

// ── Form submission ──
const form = document.getElementById('createListingForm');

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

  let data = {
    seller_id: localStorage.loggedInUserId,
    name: titleInput.value.trim(),
    description: descInput.value.trim(),
    price: parseFloat(document.getElementById('listingPrice').value),
    quality: 'Brand New',
    meetup: 'Dover MRT',
  };

  fetchMethod(
    `http://localhost:3000/marketplace/`,
    async (status, responseData) => {
      console.log(status, responseData);

      if (status < 200 || status >= 300 || !responseData?.id) {
        console.error('Listing creation failed', status, responseData);
        return;
      }

      const itemId = responseData.id;
      const files = document.getElementById('listingImages').files;

      if (files.length > 0) {
        const formData = new FormData();
        for (const file of files) {
          formData.append('images', file);
        }

        try {
          const res = await fetch(`http://localhost:3000/marketplace/${itemId}/images`, {
            method: 'POST',
            body: formData, // no Content-Type header — browser sets the multipart boundary
          });
          if (!res.ok) {
            console.error('Image upload failed', await res.text());
          }
        } catch (err) {
          console.error('Image upload error:', err);
        }
      }

      if (currentTags.length > 0) {
        try {
          const res = await fetch(`http://localhost:3000/marketplace/${itemId}/tags`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tags: currentTags }),
          });
          if (!res.ok) {
            console.error('Tag save failed', await res.text());
          }
        } catch (err) {
          console.error('Tag save error:', err);
        }
      }

      window.location.href = 'marketplace.html';
    },
    'POST',
    data,
  );
});

// Tags
const tagOvalContainer = document.getElementById('tagOvalContainer');
const tagAddBtn = document.getElementById('tagAddBtn');
const MAX_TAGS = 5;
let currentTags = [];

function createTagOval() {
  const oval = document.createElement('div');
  oval.className = 'tag-oval';

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

function confirmTag(oval, input) {
  const value = input.value.trim().toLowerCase();

  if (!value || currentTags.includes(value)) {
    oval.remove();
    return;
  }

  currentTags.push(value);

  oval.innerHTML = `
    <span class="tag-oval-text">${value}</span>
    <button type="button" class="tag-oval-remove" aria-label="Remove tag">
      <i class="fas fa-times"></i>
    </button>
  `;

  oval.querySelector('.tag-oval-remove').addEventListener('click', () => {
    currentTags = currentTags.filter((t) => t !== value);
    oval.remove();
  });
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

// ── Image preview ──
const uploadZone = document.getElementById('uploadZone');
const listingImagesInput = document.getElementById('listingImages');
const previewContainer = document.getElementById('image-preview-container');

uploadZone.addEventListener('click', () => listingImagesInput.click());

listingImagesInput.addEventListener('change', () => {
  previewContainer.innerHTML = '';
  const files = Array.from(listingImagesInput.files).slice(0, 6); // enforce max 6 client-side

  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'image-preview-thumb';
      wrapper.innerHTML = `<img src="${e.target.result}" alt="${file.name}">`;
      previewContainer.appendChild(wrapper);
    };
    reader.readAsDataURL(file);
  });
});
