// Initialize an empty cart array
let cart = [];

// Blocked dates: holidays and Sundays
const blockedStart = new Date('2025-12-21');
const blockedEnd = new Date('2026-01-01');
const dailyLimit = 8; // Maximum orders per day
const ordersPerDate = {}; // Tracks number of items per date

/**
 * Show quantity input and confirm button when 'Add to Cart' is clicked
 * @param {string} qtyId - ID of the quantity input
 * @param {HTMLElement} btn - The Add to Cart button
 */
function showQuantity(qtyId, btn){
  const input = document.getElementById(qtyId);
  input.style.display = 'block';
  const confirmBtn = document.getElementById('confirm' + qtyId.replace('qty',''));
  confirmBtn.style.display = 'block';
  btn.classList.add('disabled'); // Prevent multiple clicks
}

/**
 * Add item to cart
 * @param {string} item - Name of the product
 * @param {number} price - Price per unit
 * @param {string} qtyId - Quantity input ID
 * @param {HTMLElement} confirmBtn - Confirm button element
 */
function addToCart(item, price, qtyId, confirmBtn){
  const quantity = parseInt(document.getElementById(qtyId).value);
  const dateVal = document.getElementById('datePicker').value;

  // Validate date selection
  if(dateVal){
    ordersPerDate[dateVal] = ordersPerDate[dateVal] || 0;

    if(ordersPerDate[dateVal] + quantity > dailyLimit){
      alert(`Cannot add items. Daily limit of ${dailyLimit} reached for ${dateVal}`);
      return;
    } else {
      ordersPerDate[dateVal] += quantity;
    }
  }

  // Check if item already exists in cart
  let existing = cart.find(c => c.item === item);
  if(existing){
    existing.quantity += quantity;
    existing.price += price * quantity;
  } else {
    cart.push({item, price: price * quantity, quantity});
  }

  renderCart();

  // Hide quantity input and confirm button
  document.getElementById(qtyId).style.display = 'none';
  confirmBtn.style.display = 'none';
}

/**
 * Render cart items and total
 */
function renderCart(){
  const cartEl = document.getElementById('cart');
  cartEl.innerHTML = '';
  let total = 0;

  cart.forEach(x => {
    total += x.price;
    cartEl.innerHTML += `<li>${x.item} x${x.quantity} <span>$${x.price.toFixed(2)}</span></li>`;
  });

  document.getElementById('total').textContent = total.toFixed(2);
}

/**
 * Initialize date picker with blocked dates and Sundays
 */
flatpickr('#datePicker', {
  dateFormat: 'Y-m-d',
  minDate: 'today',
  disable: [
    // Block Sundays
    function(date) { return date.getDay() === 0; },
    // Block holiday range
    { from: blockedStart, to: blockedEnd }
  ]
});

/**
 * Submit order (demo)
 */
function submitOrder(){
  const dateVal = document.getElementById('datePicker').value;
  if(!dateVal){
    alert('Please select a valid pickup date.');
    return;
  }

  alert(
    `Order Submitted!\n` +
    `Items: ${cart.map(i => i.item + ' x' + i.quantity).join(', ')}\n` +
    `Date: ${dateVal}\n` +
    `Total: $${cart.reduce((s,i) => s + i.price,0).toFixed(2)}`
  );

  // TODO: Connect here to Google Sheets or backend
}

/* 
  NOTES:
  - To add more products: duplicate card in order.html and update IDs/names/prices.
  - Update images in /images/ folder for products.
  - Customize text content in HTML where needed.
*/
