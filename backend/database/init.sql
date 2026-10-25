-- =============================================================
-- Smart Room - khởi tạo database MySQL 8 (chạy thủ công 1 lần)
--   mysql -u root -p < backend/database/init.sql
-- hoặc mở file trong MySQL Workbench rồi Execute.
-- Chạy lại nhiều lần vẫn an toàn: không xoá dữ liệu đã có.
-- =============================================================

CREATE DATABASE IF NOT EXISTS smart_room
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE smart_room;

-- (Tuỳ chọn) tạo user riêng cho backend thay vì dùng root.
-- Bỏ comment và đổi mật khẩu, rồi điền DB_USER/DB_PASSWORD trong .env cho khớp.
-- CREATE USER IF NOT EXISTS 'smartroom'@'localhost' IDENTIFIED BY 'doi_mat_khau_o_day';
-- GRANT ALL PRIVILEGES ON smart_room.* TO 'smartroom'@'localhost';
-- FLUSH PRIVILEGES;

-- Thời gian lưu theo UTC; backend tự đổi sang Asia/Ho_Chi_Minh khi lọc/hiển thị.
-- Đặt phiên UTC để các cột DEFAULT CURRENT_TIMESTAMP khớp với backend.
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS Users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  -- Phân quyền: admin được điều khiển thiết bị, viewer chỉ được xem.
  role VARCHAR(20) NOT NULL DEFAULT 'viewer',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT ck_user_role CHECK (role IN ('admin','viewer'))
);

-- Database tạo từ bản cũ chưa có cột role => thêm vào (MySQL không có ADD COLUMN IF NOT EXISTS).
SET @add_role = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Users' AND COLUMN_NAME = 'role') = 0,
  "ALTER TABLE Users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'viewer' AFTER full_name,
     ADD CONSTRAINT ck_user_role CHECK (role IN ('admin','viewer'))",
  'DO 0');
PREPARE add_role FROM @add_role;
EXECUTE add_role;
DEALLOCATE PREPARE add_role;

CREATE TABLE IF NOT EXISTS Sensors (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(30) NOT NULL UNIQUE,
  unit VARCHAR(20) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS Devices (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  current_status VARCHAR(20) NOT NULL DEFAULT 'off',
  connection_status VARCHAR(20) NOT NULL DEFAULT 'offline',
  last_seen_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT ck_device_state CHECK (current_status IN ('on','off','loading')),
  CONSTRAINT ck_device_connection CHECK (connection_status IN ('online','offline'))
);

CREATE TABLE IF NOT EXISTS SensorData (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sensor_id BIGINT NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  measured_at DATETIME(3) NOT NULL,
  FOREIGN KEY (sensor_id) REFERENCES Sensors(id),
  INDEX idx_sensor_measured (sensor_id, measured_at, id),
  INDEX idx_measured (measured_at, id)
);

CREATE TABLE IF NOT EXISTS ActionHistory (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  device_id BIGINT NOT NULL,
  action VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  source VARCHAR(20) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at DATETIME(3) NULL,
  FOREIGN KEY (user_id) REFERENCES Users(id),
  FOREIGN KEY (device_id) REFERENCES Devices(id),
  CONSTRAINT ck_history_action CHECK (action IN ('ON','OFF')),
  CONSTRAINT ck_history_status CHECK (status IN ('loading','on','off','timeout','error')),
  CONSTRAINT ck_history_source CHECK (source IN ('manual')),
  INDEX idx_action_created (created_at, id),
  INDEX idx_action_user_created (user_id, created_at, id),
  INDEX idx_action_pending (device_id, status)
);

-- Cấu hình cố định: 3 cảm biến của ESP32 và 2 thiết bị điều khiển.
-- Không có số đo mẫu; SensorData chỉ có dữ liệu khi ESP32/simulator gửi qua MQTT.
INSERT IGNORE INTO Sensors (id, name, type, unit) VALUES
  (1, 'Air Temperature', 'temperature', '°C'),
  (2, 'Relative Humidity', 'humidity', '%'),
  (3, 'Ambient Light', 'light', 'lux');

INSERT IGNORE INTO Devices (id, name) VALUES
  (1, 'System Light'),
  (2, 'Emergency Light');

-- Tài khoản đăng nhập (hash BCrypt):
--   admin@iot.com  / admin123  - role admin: xem + bật/tắt thiết bị
--   viewer@iot.com / viewer123 - role viewer: chỉ xem
-- Đổi mật khẩu: tạo hash mới bằng
--   node -e "require('bcryptjs').hash('mat_khau_moi',12).then(console.log)"   (chạy trong thư mục BTL)
-- rồi UPDATE Users SET password_hash='<hash>' WHERE username='admin@iot.com';
INSERT IGNORE INTO Users (id, username, password_hash, full_name, role) VALUES
  (1, 'admin@iot.com', '$2b$12$NR/OUdamgr72KHEX6xTKEOj4CQbBSFyRsHWRUsioEgZ6irtqC4PYO', 'Lê Xuân Cường', 'admin'),
  (2, 'viewer@iot.com', '$2b$12$oX2PP2SQ6QhuyYjKHC0sZ.Aw8UHDKM88eTxP5f9hbzGnazOCawei.', 'Viewer', 'viewer');
-- Database cũ: admin đã có sẵn nhưng cột role mới thêm mặc định là 'viewer'.
UPDATE Users SET role = 'admin' WHERE username = 'admin@iot.com';
