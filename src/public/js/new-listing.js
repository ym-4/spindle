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
    quality: "Brand New",
    meetup: "Dover MRT",
  };

  fetchMethod(
    `http://localhost:3000/marketplace/`,
    (status, data) => {
      console.log(status, data);
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

tagAddBtn.addEventListener('click', () => {
  if (currentTags.length >= MAX_TAGS) return;
  createTagOval();
});

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