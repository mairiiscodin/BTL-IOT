CREATE TABLE Users (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 username VARCHAR(100) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 full_name VARCHAR(150) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
CREATE TABLE Sensors (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL,
 type VARCHAR(30) NOT NULL UNIQUE, unit VARCHAR(20) NOT NULL,
 is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
CREATE TABLE Devices (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL,
 current_status VARCHAR(20) NOT NULL DEFAULT 'off',
 connection_status VARCHAR(20) NOT NULL DEFAULT 'offline',
 last_seen_at DATETIME(3) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 CONSTRAINT ck_device_state CHECK (current_status IN ('on','off','loading')),
 CONSTRAINT ck_device_connection CHECK (connection_status IN ('online','offline'))
);
CREATE TABLE SensorData (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, sensor_id BIGINT NOT NULL,
 value DECIMAL(10,2) NOT NULL, measured_at DATETIME(3) NOT NULL,
 FOREIGN KEY (sensor_id) REFERENCES Sensors(id)
);
CREATE INDEX idx_sensor_measured ON SensorData(sensor_id, measured_at, id);
CREATE INDEX idx_measured ON SensorData(measured_at, id);
CREATE TABLE ActionHistory (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id BIGINT NOT NULL, device_id BIGINT NOT NULL,
 action VARCHAR(20) NOT NULL, status VARCHAR(20) NOT NULL, source VARCHAR(20) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), completed_at DATETIME(3) NULL,
 FOREIGN KEY (user_id) REFERENCES Users(id), FOREIGN KEY (device_id) REFERENCES Devices(id),
 CONSTRAINT ck_history_action CHECK (action IN ('ON','OFF')),
 CONSTRAINT ck_history_status CHECK (status IN ('loading','on','off','timeout','error')),
 CONSTRAINT ck_history_source CHECK (source IN ('manual'))
);
CREATE INDEX idx_action_created ON ActionHistory(created_at,id);
CREATE INDEX idx_action_user_created ON ActionHistory(user_id,created_at,id);
CREATE INDEX idx_action_pending ON ActionHistory(device_id,status);
INSERT INTO Sensors(id,name,type,unit) VALUES (1,'Air Temperature','temperature','°C'),(2,'Relative Humidity','humidity','%'),(3,'Ambient Light','light','lux');
INSERT INTO Devices(id,name) VALUES (1,'System Fan'),(2,'Emergency Light');
