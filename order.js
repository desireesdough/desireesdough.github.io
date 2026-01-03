/* order.js
   Full client-side behavior for the Artisan Bakery order page (GitHub Pages compatible).
   - Handles size -> qty -> confirm flow per card
   - Builds a cart array and renders cart summary + total
   - Connects to a backend (Google Apps Script recommended) to fetch orders-per-date counts
   - Uses flatpickr to render a calendar and disable blackout dates / capacity-limited dates
   - Validates submit button and posts order to backend
*/

/* ================== Configuration ================== */

// Replace this with your deployed Google Apps Script endpoint (or other endpoint).
// The endpoint should serve:
//  - GET ?mode=getCounts  => returns existing orders per date (JSON or CSV)
//  - POST /submit-order   => accepts JSON payload: { name, contact, date, items: [...] }
const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycby0WxAXoM9B7qZSfHV8CI2YMxjbSUXU8-pdckw2n5917TVj_KpD3i0Ty2kECiYc_cz1cA/exec"; // <- REPLACE ME

// Business rules
const DAILY_LIMIT = 9;
const HOLIDAY_FROM = "2025-12-21";
const HOLIDAY_TO   = "2026-01-02";
// Weekday blackout: Sunday=0, Tuesday=2, Thursday=4
const BLACKOUT_WEEKDAYS = new Set([0,1,3,5]);
const BLACKOUT_DATES = {"2026-01-03":10} // add date in format YYYY-MM-DD, followed by colon, followed by 10. Separate with commas if adding multiple

/* ================== State ================== */

let cart = []; // array of { item, size, price, qty 
let existingOrders = {}; // map 'YYYY-MM-DD' -> integer count (fetched from backend)
let fp = null; // flatpickr instance

/* ================== Helpers ================== */

// Format Date -> YYYY-MM-DD
function fmtDate(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}


/* ================== Cart UI ================== */

function incrementQty(i) {
  cart[i].Quantity += 1;
  cart[i].Total = cart[i].Quantity * cart[i].UnitPrice;
  renderCart();
}

function decrementQty(i) {
  if (cart[i].Quantity > 1) {
    cart[i].Quantity -= 1;
    cart[i].Total = cart[i].Quantity * cart[i].UnitPrice;
  } else {
    cart.splice(i, 1);
  }
  renderCart();
}

function removeItem(i) {
  cart.splice(i, 1);
  renderCart();
}

// Render cart items and total
function renderCart(){
  const ul = document.getElementById('cartList');
  const totalEl = document.getElementById('total');
  ul.innerHTML = '';
  let total = 0;

  cart.forEach((it, idx) => {
    const li = document.createElement('li');
    li.className = 'cart-item';

    li.innerHTML = `
     <li class="cart-item">
        <div class="cart-left">
          <strong>${it.Item}</strong><br>
          <span>${it.Size}</span>
        </div>
      
        <div class="cart-controls">
          <button class="qty-btn dec" onclick="decrementQty(${idx})">−</button>
          <span class="cart-qty">${it.Quantity}</span>
          <button class="qty-btn inc" onclick="incrementQty(${idx})">+</button>
        </div>
      
        <div class="cart-price">$${it.Total.toFixed(2)}</div>
      
        <button class="remove-btn" onclick="removeItem(${idx})">×</button>
      </li>

`;

    ul.appendChild(li);
    total += it.Total;
  });

  totalEl.innerText = `$${total.toFixed(2)}`;
  refreshCalendar();
  validateSubmitState();
}


/* Utility: compute total qty in cart */
function cartTotalQty(){
  return cart.reduce((s,i)=>s + (i.Quantity || 0), 0);
}

/* ================== Menu Card Behavior ================== */

// Initialize cards: hide qty, wire up size->show qty, confirm logic
function initMenuCards(){
  const cards = document.querySelectorAll('.card');
  cards.forEach(card => {
    const sizeSel = card.querySelector('.size');
    const qtySel  = card.querySelector('.qty');
    const confirmBtn = card.querySelector('.confirm');

    // Hide qty by default (CSS might show it; ensure hidden)
    if(qtySel){
      qtySel.style.display = 'none';
      qtySel.value = '';
    }

    // Disable confirm initially
    if(confirmBtn){
      confirmBtn.classList.add('disabled');
      confirmBtn.disabled = true;
    }

    // When user chooses a size -> show qty and enable confirm
    sizeSel && sizeSel.addEventListener('change', (e) => {
      const val = e.target.value;
      if(!val){
        // Reset
        if(qtySel) qtySel.style.display = 'none';
        if(confirmBtn){ confirmBtn.classList.add('disabled'); confirmBtn.disabled = true; }
        return;
      }
      // show qty
      if(qtySel){
        qtySel.style.display = 'inline-block';
        // ensure there's a valid selection by default
        if(!qtySel.value) qtySel.value = '1';
      }
      // enable confirm
      if(confirmBtn){ confirmBtn.classList.remove('disabled'); confirmBtn.disabled = false; }
    });

    // Confirm click -> add to cart, disable this button, hide qty
    confirmBtn && confirmBtn.addEventListener('click', (ev) => {
      if(confirmBtn.disabled) return;
      // read item details
      const itemName = card.dataset.item || (card.querySelector('.title strong') && card.querySelector('.title strong').innerText) || 'Item';
      const sizeOption = card.querySelector('.size').selectedOptions[0];
      const sizeText = card.querySelector('.size').value;
      const price = parseFloat(sizeOption.dataset.price || sizeOption.value || 0);
      let qty = parseInt(card.querySelector('.qty').value || 1, 10);

      // Add to cart - without dupes
      let existing = cart.find(it =>
        it.Item === itemName && it.Size === sizeText
      );
      
      if (existing) {
        existing.Quantity += qty;
        existing.Total += qty * price;
      } else {
        cart.push({
          Item: itemName,
          Size: sizeText,
          Quantity: qty,
          UnitPrice: price,
          Total: qty * price
        });
      }

      renderCart();
      refreshCalendar();

      // Visually disable the confirm button (faded, unclickable) to signal added
      confirmBtn.classList.add('disabled');
      confirmBtn.disabled = true;

      // hide qty until user changes size again
      if(qtySel) qtySel.style.display = 'none';
    });

  });
}

/* ================== Calendar (flatpickr) ================== */

// Compute min (today+2) and max (today+30)
function computeMinMax(){
  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(today.getDate() + 3);
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 30);
  return { minDate, maxDate };
}

// Check if date is in holiday range
function inHolidayRange(date){
  const s = fmtDate(date);
  return (s >= HOLIDAY_FROM && s <= HOLIDAY_TO);
}

// Check if a date should be disabled (blackout or capacity limit)
function isDateDisabled(date){
  // outside dynamic min/max
  const { minDate, maxDate } = computeMinMax();
  if(date < minDate || date > maxDate) return true;

  // blacklist weekdays
  if(BLACKOUT_WEEKDAYS.has(date.getDay())) return true;

  // holiday range
  if(inHolidayRange(date)) return true;

   // blackout check: blackout[date] + cartTotalQty() > DAILY_LIMIT
  const ds = fmtDate(date);
  const blackout = BLACKOUT_DATES[ds] || 0;
  if(BLACKOUT_DATES + cartTotalQty() > DAILY_LIMIT) return true;

  // capacity check: existingOrders[date] + cartTotalQty() > DAILY_LIMIT
  const ds = fmtDate(date);
  const existing = existingOrders[ds] || 0;
  if(existing + cartTotalQty() > DAILY_LIMIT) return true;

  return false;
}

// Initialize flatpickr instance, with disable function bound to isDateDisabled
function initCalendar(){
  const { minDate, maxDate } = computeMinMax();
  fp = flatpickr("#dateInput", {
    dateFormat: 'Y-m-d',
    minDate: minDate,
    maxDate: maxDate,
    disable: [
      function(date){
        return isDateDisabled(date);
      }
    ],
    onChange: function(selectedDates, dateStr){
      // validate submit state on date change
      validateSubmitState();
    },
    onMonthChange: function(){
      // redraw to ensure capacity changes visually update
      fp.redraw();
    },
    onYearChange: function(){ fp.redraw(); }
  });
}

/* Force a full redraw of flatpickr (after existingOrders or cart changes) */
function refreshCalendar(){
  if(fp){
    fp.set('disable', [ function(d){ return isDateDisabled(d); } ]);
    fp.redraw();
  }
}

/* ================== Backend Integration (fetch counts + submit) ================== */

/**
 * Fetch existing orders counts from backend.
 * Expected return: either JSON object mapping date->count OR CSV "YYYY-MM-DD,count" lines.
 */
async function fetchExistingOrders(){
  existingOrders = {}; // reset
  try{
    // the Apps Script should accept mode=getCounts and return JSON or CSV
    let formData = new FormData(); 
    formData.append('Timestamp', '');
    const res = await fetch(GAS_ENDPOINT, {method:'POST', body: formData});
    const dates = await res.json();
    console.log(dates)
    existingOrders = dates
    refreshCalendar();
  }catch(err){
    console.error('Could not fetch existing orders counts:', err);
    // proceed with empty existingOrders so page remains usable
    existingOrders = {};
    refreshCalendar();
  }
}

/**
 * Submit order to backend.
 * Posts payload: { name, contact, date, items: [ {item, size, price, qty}, ... ] }
 */
async function submitOrderToBackend(payload){
  try{
    const res = await fetch(GAS_ENDPOINT, {
      method: 'POST',
      body: payload
    });

    // In no-cors mode, fetch always returns "opaque" but still sends POST successfully
    return { ok: true, result: "opaque" };

  }catch(err){
    console.error('Submit failed:', err);
    return { ok: false, error: err.message || String(err) };
  }
}


/* ================== Submit Validation & Handlers ================== */

function validateSubmitState(){
  const name = (document.getElementById('fullName')||{value:''}).value.trim();
  const contact = (document.getElementById('contactField')||{value:''}).value.trim();
  const dateVal = (document.getElementById('dateInput')||{value:''}).value.trim();
  const submitBtn = document.getElementById('submitBtn');
  const hasCart = cart.length > 0;

  if(name && contact && dateVal && hasCart){
    submitBtn.disabled = false;
    submitBtn.classList.remove('disabled');
  } else {
    submitBtn.disabled = true;
    submitBtn.classList.add('disabled');
  }
}

async function handleSubmit(){
  const name = document.getElementById('fullName').value.trim();
  const contact = document.getElementById('contactField').value.trim();
  const date = document.getElementById('dateInput').value.trim();
  const ts = new Date()
  const note = document.getElementById('noteField').value.trim();

  if(!name || !contact || !date || cart.length === 0){
    alert('Please provide full name, contact, pickup date, and at least one item in the cart.');
    return;
  }

  // Build payload
  let formData = new FormData(); 
   formData.append('Timestamp', ts);
   formData.append('Name', name);
   formData.append('Contact', contact);
   formData.append('Pickup', date);
   formData.append('Cart', JSON.stringify(cart));
   formData.append('Notes', note);
  const payload = formData;

  // POST to backend
  const result = await submitOrderToBackend(payload);
  const messageBox = document.getElementById('messageBox');

  if(result.ok){
    // success
    messageBox.style.display = 'block';
    messageBox.innerText = 'Order tentatively accepted, payment is required to finalize. Please use Venmo or Cash App links below.';
    // clear cart and re-render
    cart = [];
    renderCart();
    // fetch updated counts (backend should now reflect the new order)
    await fetchExistingOrders();
    validateSubmitState();
  } else {
    // failure — still show tentative message but warn user
    messageBox.style.display = 'block';
    messageBox.innerText = 'Something went wrong. Please contact us if you do not receive a confirmation.';
    // do NOT clear cart in this failure path (so user can retry)
  }
}

/* ================== Initialization ================== */

function wireUpFormInputs(){
  // validate on change of text inputs
  const nameEl = document.getElementById('fullName');
  const contactEl = document.getElementById('contactField');
  const dateEl = document.getElementById('dateInput');

  [nameEl, contactEl].forEach(el => el && el.addEventListener('input', validateSubmitState));
  // date change handled by flatpickr onChange callback also calls validateSubmitState

  const submitBtn = document.getElementById('submitBtn');
  submitBtn && submitBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.classList.add('disabled');
    await handleSubmit();
    submitBtn.disabled = false;
    validateSubmitState();
  });
}

async function boot(){
  // hide all qty selects initially (in case CSS didn't)
  document.querySelectorAll('.qty').forEach(s => { s.style.display = 'none'; s.value = ''; });

  // wire size->qty->confirm behaviors
  initMenuCards();

  // fetch existing orders counts from backend (if configured)
  await fetchExistingOrders();

  // init calendar with dynamic min/max and disable rules
  initCalendar();

  // render cart (empty)
  renderCart();

  // wire up submit & inputs
  wireUpFormInputs();
}

// Start
boot();

/* ================== Exports for debugging ================== */
window._orderDebug = {
  cart, existingOrders, fetchExistingOrders, refreshCalendar
};
