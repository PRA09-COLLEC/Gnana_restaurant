const grid = document.getElementById("tableGrid");
const tableSelect = document.getElementById("tableSelect");
const dateInput = document.getElementById("date");
const timeSelect = document.querySelector('[name="reservation_time"]');
const form = document.getElementById("bookingForm");
const message = document.getElementById("bookingMessage");

dateInput.min = new Date().toISOString().slice(0, 10);

async function loadTables() {
  const date = dateInput.value, time = timeSelect.value;
  const params = new URLSearchParams();
  if (date && time) { params.set("date", date); params.set("time", time); }
  try {
    const res = await fetch("/api/tables?" + params);
    const tables = await res.json();
    grid.innerHTML = tables.length ? tables.map(t => `
      <article class="table-card"><div class="table-number">${t.table_number}</div>
      <p>${t.seating_capacity} seats · ${t.location}</p>
      <span class="tag">${t.status === "Unavailable" ? "Unavailable" : "Available"}</span></article>`).join("") : "<p>No tables found for this selection.</p>";
    tableSelect.innerHTML = '<option value="">Select a table</option>' +
      tables.filter(t => t.status !== "Unavailable").map(t =>
        `<option value="${t.table_id}">${t.table_number} · ${t.seating_capacity} seats · ${t.location}</option>`).join("");
    if (date && time && !tables.length) tableSelect.innerHTML = '<option value="">No available tables</option>';
  } catch { grid.innerHTML = "<p>Could not load tables. Check the server.</p>"; }
}
dateInput.addEventListener("change", loadTables);
timeSelect.addEventListener("change", loadTables);
loadTables();

form.addEventListener("submit", async e => {
  e.preventDefault(); message.className = "form-message"; message.textContent = "Submitting reservation…";
  const data = Object.fromEntries(new FormData(form).entries());
  data.guests = Number(data.guests); data.table_id = Number(data.table_id);
  try {
    const res = await fetch("/api/reservations", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Booking failed.");
    message.textContent = `${result.message} Your booking ID is #${result.reservation_id}.`;
    form.reset(); dateInput.min = new Date().toISOString().slice(0,10); await loadTables();
  } catch (err) { message.textContent = err.message; message.classList.add("error"); }
});