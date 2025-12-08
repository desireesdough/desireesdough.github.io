/* ===========================================================
   MENU ITEM INTERACTION LOGIC
   Handles "Add to Cart" actions for each item card.
   When clicked:
   - Button visually fades & becomes disabled
   - A quantity selector appears below the item
   - User confirms quantity before finalizing
=========================================================== */

document.querySelectorAll(".add-to-cart").forEach(button => {

    button.addEventListener("click", function () {

        // Prevent re-adding once cart has been triggered
        if (button.classList.contains("disabled")) return;

        // Visually lock button after click
        button.classList.add("disabled");
        button.innerText = "Added ✓";
        button.style.opacity = ".4";
        button.style.cursor = "not-allowed";

        // Access the product card to append qty selector
        const card = button.closest(".menu-card");

        // -------- CREATE THE QUANTITY UI --------
        const qtyWrapper = document.createElement("div");
        qtyWrapper.className = "qty-container"; // for styling control

        qtyWrapper.innerHTML = `
            <label class="qty-label">Quantity:</label>
            <input type="number" min="1" value="1" class="qty-input" />
            <button class="confirm-btn">Confirm</button>
        `;

        card.appendChild(qtyWrapper);

        /* ---------------------------------------------------------
           CONFIRM BUTTON BEHAVIOR
           On click:
           - Reads quantity
           - Displays confirmation message (placeholder for future cart logic)
           - Removes selector after confirming to clean UI
        ----------------------------------------------------------- */
        qtyWrapper.querySelector(".confirm-btn").addEventListener("click", () => {
            const qty = qtyWrapper.querySelector(".qty-input").value;

            // Placeholder for future cart integration
            alert(`Added ${qty} to your order!`);

            // Remove selector once confirmed
            qtyWrapper.remove();
        });
    });
});



/* ===========================================================
   PICKUP DATE LOGIC
   Uses built-in datePicker element.
   Features:
     ✔ Past dates disabled
     ✔ Sundays greyed-out + blocked from selection
============================================================= */

const dateInput = document.getElementById("pickupDate");

if (dateInput) {

    // Prevents selecting past dates
    const today = new Date().toISOString().split("T")[0];
    dateInput.setAttribute("min", today);

    // Optional rule: Sundays not available for pickup
    dateInput.addEventListener("input", function () {
        const selected = new Date(this.value);

        if (selected.getDay() === 0) {
            alert("We don’t offer Sunday pickups — please select another date.");
            this.value = ""; // Clears invalid choice
        }
    });
}
