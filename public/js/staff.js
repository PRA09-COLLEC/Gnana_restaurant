const rows = document.getElementById("reservationRows");
const tableAdmin = document.getElementById("tableAdmin");
const staffMessage = document.getElementById("staffMessage");
const customerRows = document.getElementById("customerRows");

let customers = [];
let reservations = [];

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

function showMessage(text, error = false) {
  staffMessage.textContent = text;
  staffMessage.className = "form-message" + (error ? " error" : "");
}

function escapeHtml(v) {
  return String(v).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

// DISPLAY RESERVATIONS
function renderReservations() {
  const term = (
    document.getElementById("searchInput").value || ""
  ).toLowerCase();

  const filtered = reservations.filter(r =>
    `${r.name} ${r.table_number} ${r.email}`
      .toLowerCase()
      .includes(term)
  );

  rows.innerHTML = filtered.length
    ? filtered.map(r => `
      <tr>
        <td>#${r.reservation_id}</td>
        <td>
          <strong>${escapeHtml(r.name)}</strong><br>
          <span class="muted">${escapeHtml(r.phone)}</span>
        </td>
        <td>${escapeHtml(r.table_number)}</td>
        <td>${r.reservation_date}<br>${r.reservation_time}</td>
        <td>${r.guests}</td>
        <td>
          <select data-status="${r.reservation_id}">
            ${["Pending", "Confirmed", "Cancelled", "Completed"]
              .map(s => `<option ${r.status === s ? "selected" : ""}>${s}</option>`)
              .join("")}
          </select>
        </td>
        <td>
          <button class="small-btn delete-btn"
            data-delete="${r.reservation_id}">
            Delete
          </button>
        </td>
      </tr>
    `).join("")
    : '<tr><td colspan="7">No reservations found.</td></tr>';

  document.getElementById("totalCount").textContent = reservations.length;

  document.getElementById("pendingCount").textContent =
    reservations.filter(r => r.status === "Pending").length;

  document.getElementById("confirmedCount").textContent =
    reservations.filter(r => r.status === "Confirmed").length;
}

// DISPLAY CUSTOMER DETAILS
function renderCustomers() {
  customerRows.innerHTML = customers.length
    ? customers.map(c => `
      <tr>
        <td>${c.customer_id}</td>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.email)}</td>
        <td>${escapeHtml(c.phone)}</td>
        <td>
          <button class="small-btn delete-btn"
            data-customer-delete="${c.customer_id}">
            Delete
          </button>
        </td>
      </tr>
    `).join("")
    : '<tr><td colspan="5">No customers found.</td></tr>';
}

// LOAD ALL DETAILS
async function loadAll() {
  try {
    reservations = await request("/api/reservations");
    customers = await request("/api/customers");

    renderReservations();
    renderCustomers();

    const tables = await request("/api/tables");

    document.getElementById("tableCount").textContent = tables.length;

    tableAdmin.innerHTML = tables.map(t => `
      <div class="admin-chip">
        <strong>${escapeHtml(t.table_number)}</strong>
        · ${t.seating_capacity} seats
        · ${escapeHtml(t.location)}
        <button data-table-delete="${t.table_id}"
          aria-label="Delete table">×</button>
      </div>
    `).join("") || "No tables yet.";

  } catch (e) {
    showMessage(e.message, true);
  }
}

// UPDATE RESERVATION STATUS
rows.addEventListener("change", async e => {
  if (!e.target.dataset.status) return;

  try {
    await request(`/api/reservations/${e.target.dataset.status}`, {
      method: "PATCH",
      body: JSON.stringify({ status: e.target.value })
    });

    showMessage("Booking status updated.");
    await loadAll();

  } catch (err) {
    showMessage(err.message, true);
  }
});

// DELETE RESERVATION
rows.addEventListener("click", async e => {
  const button = e.target.closest("[data-delete]");
  if (!button) return;

  const id = button.dataset.delete;

  if (!confirm("Delete this reservation?")) return;

  try {
    await request(`/api/reservations/${id}`, {
      method: "DELETE"
    });

    showMessage("Reservation deleted.");
    await loadAll();

  } catch (err) {
    showMessage(err.message, true);
  }
});

// DELETE CUSTOMER
customerRows.addEventListener("click", async e => {
  const button = e.target.closest("[data-customer-delete]");
  if (!button) return;

  const id = button.dataset.customerDelete;

  if (!confirm("Delete this customer and all related reservations?")) {
    return;
  }

  try {
    const result = await request(`/api/customers/${id}`, {
      method: "DELETE"
    });

    showMessage(result.message);
    await loadAll();

  } catch (err) {
    showMessage(err.message, true);
  }
});

// DELETE TABLE
tableAdmin.addEventListener("click", async e => {
  const button = e.target.closest("[data-table-delete]");
  if (!button) return;

  const id = button.dataset.tableDelete;

  if (!confirm("Delete this table?")) return;

  try {
    await request(`/api/tables/${id}`, {
      method: "DELETE"
    });

    showMessage("Table deleted.");
    await loadAll();

  } catch (err) {
    showMessage(err.message, true);
  }
});

// ADD NEW TABLE
document.getElementById("tableForm").addEventListener("submit", async e => {
  e.preventDefault();

  const data = Object.fromEntries(new FormData(e.target).entries());
  data.seating_capacity = Number(data.seating_capacity);

  try {
    await request("/api/tables", {
      method: "POST",
      body: JSON.stringify(data)
    });

    e.target.reset();
    showMessage("New table added.");
    await loadAll();

  } catch (err) {
    showMessage(err.message, true);
  }
});

// SEARCH RESERVATIONS
document.getElementById("searchInput").addEventListener("input", renderReservations);

// REFRESH BUTTON
document.getElementById("refreshBtn").addEventListener("click", loadAll);

// INITIAL LOAD
loadAll();
