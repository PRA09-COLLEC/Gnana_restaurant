require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "Swamuluroot",
  database: process.env.DB_NAME || "gnanarestaurant",
  waitForConnections: true,
  connectionLimit: 10
});

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// INDEX / LIST: list restaurant tables, with availability for selected date/time
app.get("/api/tables", asyncRoute(async (req, res) => {
  const { date, time } = req.query;
  let sql = "SELECT t.* FROM `tables` t";
  const params = [];
  if (date && time) {
    sql += ` WHERE NOT EXISTS (
      SELECT 1 FROM reservations r
      WHERE r.table_id=t.table_id AND r.reservation_date=?
      AND r.reservation_time=? AND r.status IN ('Pending','Confirmed')
    ) AND t.status <> 'Unavailable'`;
    params.push(date, time);
  }
  sql += " ORDER BY t.table_number";
  const [rows] = await pool.query(sql, params);
  res.json(rows);
}));

// INSERT: create customer and reservation in one transaction
app.post("/api/reservations", asyncRoute(async (req, res) => {
  const { name, email, phone, password, table_id, reservation_date, reservation_time, guests } = req.body;
  if (!name || !email || !phone || !password || !table_id || !reservation_date || !reservation_time || !guests) {
    return res.status(400).json({ message: "Please fill in all booking fields." });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.execute("SELECT customer_id FROM customers WHERE email=?", [email]);
    let customerId;
    if (existing.length) {
      customerId = existing[0].customer_id;
      await conn.execute("UPDATE customers SET name=?, phone=? WHERE customer_id=?", [name, phone, customerId]);
    } else {
      const [customer] = await conn.execute(
        "INSERT INTO customers (name,email,phone,password) VALUES (?,?,?,?)",
        [name, email, phone, password]
      );
      customerId = customer.insertId;
    }
    const [busy] = await conn.execute(
      "SELECT reservation_id FROM reservations WHERE table_id=? AND reservation_date=? AND reservation_time=? AND status IN ('Pending','Confirmed')",
      [table_id, reservation_date, reservation_time]
    );
    if (busy.length) {
      await conn.rollback();
      return res.status(409).json({ message: "That table is already booked for this date and time. Please choose another." });
    }
    const [result] = await conn.execute(
      "INSERT INTO reservations (customer_id,table_id,reservation_date,reservation_time,guests,status) VALUES (?,?,?,?,?,'Pending')",
      [customerId, table_id, reservation_date, reservation_time, guests]
    );
    await conn.commit();
    res.status(201).json({ message: "Reservation request submitted!", reservation_id: result.insertId });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally { conn.release(); }
}));

// LIST reservations (staff page)
app.get("/api/reservations", asyncRoute(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT r.reservation_id, c.name, c.email, c.phone,
           t.table_number, t.seating_capacity, t.location,
           DATE_FORMAT(r.reservation_date,'%Y-%m-%d') AS reservation_date,
           TIME_FORMAT(r.reservation_time,'%H:%i') AS reservation_time,
           r.guests, r.status
    FROM reservations r
    JOIN customers c ON c.customer_id=r.customer_id
    JOIN \`tables\` t ON t.table_id=r.table_id
    ORDER BY r.reservation_date DESC, r.reservation_time DESC`);
  res.json(rows);
}));

// UPDATE booking status (staff)
app.patch("/api/reservations/:id", asyncRoute(async (req, res) => {
  const allowed = ["Pending", "Confirmed", "Cancelled", "Completed"];
  const { status } = req.body;
  if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid booking status." });
  const [result] = await pool.execute("UPDATE reservations SET status=? WHERE reservation_id=?", [status, req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ message: "Reservation not found." });
  res.json({ message: "Booking status updated." });
}));

// DELETE reservation
app.delete("/api/reservations/:id", asyncRoute(async (req, res) => {
  const [result] = await pool.execute("DELETE FROM reservations WHERE reservation_id=?", [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ message: "Reservation not found." });
  res.json({ message: "Reservation deleted." });
}));

// Add a table (staff CRUD)
app.post("/api/tables", asyncRoute(async (req, res) => {
  const { table_number, seating_capacity, location, status = "Available" } = req.body;
  if (!table_number || !seating_capacity || !location) return res.status(400).json({ message: "Enter table number, capacity and location." });
  const [result] = await pool.execute(
    "INSERT INTO `tables` (table_number,seating_capacity,location,status) VALUES (?,?,?,?)",
    [table_number, seating_capacity, location, status]
  );
  res.status(201).json({ message: "Table added.", table_id: result.insertId });
}));

app.delete("/api/tables/:id", asyncRoute(async (req, res) => {
  try {
    const [result] = await pool.execute("DELETE FROM `tables` WHERE table_id=?", [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: "Table not found." });
    res.json({ message: "Table deleted." });
  } catch (e) {
    if (e.code === "ER_ROW_IS_REFERENCED_2") return res.status(409).json({ message: "This table has reservations. Delete those reservations first." });
    throw e;
  }
}));
// GET CUSTOMER DETAILS
app.get("/api/customers", asyncRoute(async (req, res) => {
  const [rows] = await pool.query(
    "SELECT customer_id, name, email, phone FROM customers ORDER BY customer_id DESC"
  );

  res.json(rows);
}));
// DELETE CUSTOMER AND RELATED RESERVATIONS
app.delete("/api/customers/:id", asyncRoute(async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const customerId = req.params.id;

    // Check customer exists
    const [customer] = await conn.execute(
      "SELECT customer_id FROM customers WHERE customer_id=?",
      [customerId]
    );

    if (customer.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: "Customer not found." });
    }

    // Delete customer's reservations first
    await conn.execute(
      "DELETE FROM reservations WHERE customer_id=?",
      [customerId]
    );

    // Delete customer
    await conn.execute(
      "DELETE FROM customers WHERE customer_id=?",
      [customerId]
    );

    await conn.commit();

    res.json({ message: "Customer and related reservations deleted successfully." });

  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}));
app.get("/staff", (req, res) => res.sendFile(path.join(__dirname, "public", "staff.html")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "That email or table number already exists." });
  res.status(500).json({ message: "Server error. Check the terminal and database connection." });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`GnanaRestaurant running at http://localhost:${3001}`));