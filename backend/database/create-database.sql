-- Run as a MySQL administrator. Replace the password before executing.
-- The Node.js initializer creates all 11 application tables on first startup.
CREATE DATABASE IF NOT EXISTS smart_room CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'smartroom'@'localhost' IDENTIFIED BY 'CHANGE_ME_database_password';
GRANT ALL PRIVILEGES ON smart_room.* TO 'smartroom'@'localhost';
