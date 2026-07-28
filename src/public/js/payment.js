// payment.js — mock checkout modal: gathers cart items from the DOM,
// sends fake card details to the mock gateway, and shows success/decline.

function collectCartItemsFromDOM() {
  const container = document.querySelector('.cart-container');
  const rows = container.querySelectorAll(':scope > div[data-id]');
  const items = [];

  rows.forEach((row) => {
    const sellerId = row.dataset.sellerId;
    const itemId = row.dataset.id;
    const price = parseFloat(row.querySelector('.card-price')?.textContent.replace('$', ''));
    const quantity = Number(row.querySelector('.card-quantity')?.textContent.trim());

    if (itemId && !Number.isNaN(price) && !Number.isNaN(quantity)) {
      items.push({ item_id: itemId, seller_id: sellerId, price, quantity });
    }
  });

  return items;
}

function openPaymentModal() {
  const items = collectCartItemsFromDOM();

  if (items.length === 0) {
    alert('Your cart is empty.');
    return;
  }

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  document.getElementById('paymentTotal').textContent = `$${total.toFixed(2)}`;
  document.getElementById('paymentError').classList.add('d-none');
  document.getElementById('paymentSuccess').classList.add('d-none');
  document.getElementById('paymentForm').classList.remove('d-none');
  document.getElementById('paymentForm').reset();

  const modal = new bootstrap.Modal(document.getElementById('paymentModal'));
  modal.show();
}

document.addEventListener('DOMContentLoaded', () => {
  const checkoutButton = document.querySelector('.checkout-btn');
  if (checkoutButton) {
    checkoutButton.addEventListener('click', openPaymentModal);
  }

  const paymentForm = document.getElementById('paymentForm');
  if (paymentForm) {
    paymentForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const payBtn = document.getElementById('payNowBtn');
      const errorBox = document.getElementById('paymentError');
      errorBox.classList.add('d-none');

      payBtn.disabled = true;
      payBtn.textContent = 'Processing…';

      const items = collectCartItemsFromDOM();
      const body = {
        buyer_id: localStorage.loggedInUserId,
        cardNumber: document.getElementById('cardNumber').value,
        expiry: document.getElementById('cardExpiry').value,
        cvv: document.getElementById('cardCvv').value,
        items,
      };

      try {
        const res = await fetch(`${getCurrentUrl}/payments/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          errorBox.textContent = data.error || 'Payment failed. Please try again.';
          errorBox.classList.remove('d-none');
          payBtn.disabled = false;
          payBtn.textContent = 'Pay Now';
          return;
        }

        // Success — show receipt, then clear the cart
        document.getElementById('paymentForm').classList.add('d-none');
        document.getElementById('receiptRef').textContent = data.paymentRef;
        document.getElementById('receiptLast4').textContent = data.last4;
        document.getElementById('receiptTotal').textContent =
          document.getElementById('paymentTotal').textContent;
        document.getElementById('paymentSuccess').classList.remove('d-none');

        clearCart(localStorage.loggedInUserId);
      } catch (err) {
        errorBox.textContent = 'Could not reach the payment service.';
        errorBox.classList.remove('d-none');
        payBtn.disabled = false;
        payBtn.textContent = 'Pay Now';
      }
    });
  }

  const doneBtn = document.getElementById('paymentDoneBtn');
  if (doneBtn) {
    doneBtn.addEventListener('click', () => {
      location.reload();
    });
  }
});
