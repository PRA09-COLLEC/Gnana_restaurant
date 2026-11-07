# GnanaRestaurant mini project

## Features
- Customer page: view tables, choose date/time, select a table and submit a reservation.
- Staff page: list/search reservations, change booking status, delete reservations, add/delete tables.
- CRUD/API operations: INSERT, LIST/INDEX, UPDATE booking status, DELETE.
- MySQL database with the three requested tables: `customers`, `tables`, `reservations`.

## Requirements
Install Node.js and MySQL Server / MySQL Workbench.

## Setup
1. Open MySQL Workbench and connect to your local MySQL server.
2. Open `database.sql` and execute the full script. It creates database `gnana_restaurant`, all three tables, and six sample restaurant tables.
3. In this project folder, open a terminal and run:
   ```bash
   npm install
   ```
4. Copy `.env.example` to a new file named `.env`.
5. Edit `.env` and enter your local MySQL password in `DB_PASSWORD`. Do not share or upload `.env`.
6. Start the project:
   ```bash
   npm start
   ```
7. Open `http://localhost:3000` for customers and `http://localhost:3000/staff` for staff.

## Database tables
- `customers(customer_id, name, email, phone, password)`
- `tables(table_id, table_number, seating_capacity, location, status)`
- `reservations(reservation_id, customer_id, table_id, reservation_date, reservation_time, guests, status)`

## Important project notes
- HTML/CSS/JavaScript run in the browser; they cannot safely connect directly to MySQL. Express.js is used as a small backend between the pages and MySQL.
- This is a learning/demo project. For a real deployment, add staff authentication, password hashing (bcrypt), stronger validation, CSRF/rate limiting, and transaction/overlap rules for reservation durations.
- The requested `password` column is included. This demo stores the value as entered; do not use real passwords until password hashing and authentication are implemented.
