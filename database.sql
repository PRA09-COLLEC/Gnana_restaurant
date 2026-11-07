CREATE DATABASE IF NOT EXISTS gnana_restaurant;
USE gnana_restaurant;

CREATE TABLE IF NOT EXISTS customers (
  customer_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL,
  password VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS `tables` (
  table_id INT AUTO_INCREMENT PRIMARY KEY,
  table_number VARCHAR(20) NOT NULL UNIQUE,
  seating_capacity INT NOT NULL,
  location VARCHAR(100) NOT NULL,
  status ENUM('Available','Reserved','Unavailable') NOT NULL DEFAULT 'Available'
);

CREATE TABLE IF NOT EXISTS reservations (
  reservation_id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  table_id INT NOT NULL,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  guests INT NOT NULL,
  status ENUM('Pending','Confirmed','Cancelled','Completed') NOT NULL DEFAULT 'Pending',
  CONSTRAINT fk_res_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
  CONSTRAINT fk_res_table FOREIGN KEY (table_id) REFERENCES `tables`(table_id),
  INDEX idx_res_date_time (reservation_date, reservation_time)
);

INSERT IGNORE INTO `tables` (table_number, seating_capacity, location, status) VALUES
('T01', 2, 'Window Side', 'Available'),
('T02', 2, 'Garden View', 'Available'),
('T03', 4, 'Main Hall', 'Available'),
('T04', 4, 'Garden View', 'Available'),
('T05', 6, 'Family Section', 'Available'),
('T06', 8, 'Private Dining', 'Available');