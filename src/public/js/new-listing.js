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
    (status, data) => {
      console.log(status, data);
    },
    'POST',
    data,
  );
});
