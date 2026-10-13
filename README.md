# IoT Smart Room — React + Node.js

Dự án được tổ chức theo [IOT_va_ung_dung](https://github.com/datnt-numenor/IOT_va_ung_dung/tree/19f88cf3e7413db3ba7ff87115aedcbecd74c8e8), tách frontend, backend và firmware. Backend đã chuyển từ Spring Boot sang **Node.js + Express + MySQL + MQTT + WebSocket**. Giữ API, giao diện UC01–UC06 và giao thức ESP32 hiện tại.

## Chạy frontend riêng với JSON mẫu

Frontend hiện chạy độc lập và mặc định dùng public/data/demo.json:

~~~powershell
cd frontend
npm ci
npm run dev
~~~

Đăng nhập **admin@iot.com / demo123**. Không cần khởi động backend, MySQL, MQTT hay start:local. Các thao tác được mô phỏng trong trình duyệt và reset khi tải lại trang. Xem [frontend/README.md](frontend/README.md).

Các mục chạy hệ thống thật bên dưới chỉ dùng khi đặt VITE_DATA_SOURCE=api trong frontend/.env.

## Cấu trúc

~~~text
BTL/
  frontend/
    src/
      App.jsx                 # Phiên đăng nhập, điều hướng, dữ liệu dùng chung
      main.jsx                # Điểm khởi tạo React
      api/client.js           # REST + Bearer token
      api/socket.js           # WebSocket có xác thực
      components/             # UI dùng chung và biểu đồ
      pages/                  # Login, Dashboard, DataSensor, ActionHistory, Profile, SmartCustom
      hooks/                  # useData
      utils/                  # Định dạng ngày giờ
      data/                   # Nhãn cảm biến
    public/                   # Assets và tài liệu tải từ giao diện
    .env.example
    package.json
    vite.config.js
  backend/
    app.js                    # Express + middleware + routes
    server.js                 # HTTP, MQTT, WebSocket, timeout, shutdown
    config/                   # Env và MySQL pool/transaction
    controllers/              # HTTP request/response
    routes/                   # Auth, sensor, device, history
    services/                 # Nghiệp vụ, MQTT, rule engine, query
    middleware/               # Xác thực, xử lý lỗi
    realtime/                 # WebSocket hub
    utils/                    # Validation, bộ lọc và lỗi HTTP
    database/                 # schema.sql, create-database.sql
    scripts/initDb.js         # Khởi tạo DB rỗng / tiếp nhận DB cũ
    .env.example
    package.json
  firmware/SmartRoom/          # ESP32 DHT11 + BH1750, command/ACK
  scripts/                    # Chạy local, broker và simulator
  docs/                       # API, frontend, hướng dẫn chuyển đổi
  package.json                # npm workspaces + lệnh chung
  package-lock.json           # Dependency backend và công cụ local
~~~

## Thư mục hỗ trợ chạy local

- **.runtime/**: dữ liệu MySQL thật trong mysql-data/, cấu hình riêng local.env và log tiến trình. Thư mục được Git bỏ qua; không xóa nếu muốn giữ dữ liệu và cách chạy start:local hiện tại. Các file .log chỉ dùng xem lỗi.
- **scripts/**: chỉ còn local.mjs (khởi động các dịch vụ), broker.mjs (MQTT local) và simulator.mjs (giả lập ESP32). Cả ba dùng chung bộ đọc môi trường tại backend/config/env.js.
- **.github/**: đã bỏ vì chỉ chứa hook nâng cấp Java cũ, không có workflow dùng cho ứng dụng Node.

## Cài đặt và chạy

Yêu cầu Node.js **22.19+**, npm, MySQL 8 và broker MQTT. Chạy các lệnh sau từ thư mục BTL:

~~~powershell
npm.cmd ci
npm.cmd --prefix frontend ci
Copy-Item .env.example .env
~~~

Chỉ copy .env khi chưa có; giữ nguyên mật khẩu và dữ liệu cũ nếu đã cấu hình. Điền DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, ADMIN_USERNAME, ADMIN_PASSWORD, MQTT_URL, MQTT_USERNAME, MQTT_PASSWORD. Backend đọc backend/.env trước, rồi .env ở BTL; biến môi trường tiến trình có ưu tiên cao nhất. ENV_FILE chỉ định riêng một file và được tính từ BTL (kể cả khi chạy trong backend).

Tạo database/user bằng backend/database/create-database.sql, sửa mật khẩu placeholder trước khi chạy. Sau đó:

~~~powershell
npm.cmd run db:init
npm.cmd run broker
~~~

Mở terminal thứ hai tại BTL:

~~~powershell
npm.cmd run backend
~~~

Mở terminal thứ ba tại BTL:

~~~powershell
npm.cmd run dev
~~~

Frontend: http://127.0.0.1:5173. Backend: http://127.0.0.1:8080. Vite proxy /api và /ws tới backend. Cũng có thể chạy npm.cmd run dev trong frontend hoặc backend để phát triển từng ứng dụng.

Dự án chạy trực tiếp trên máy, không cần Docker hoặc Java/Maven. Backend dùng npm workspace tại BTL. Frontend có package-lock.json riêng và cài dependency trong frontend.

### Môi trường local đã có trên máy này

~~~powershell
npm.cmd run start:local
~~~

Lệnh dùng .runtime/local.env và MySQL data directory đã tạo trong .runtime/mysql-data, MySQL tại cổng 3311, MQTT tại 1885. Có thể cấu hình MYSQL_BASE nếu đường dẫn cài MySQL khác. Lệnh này dành cho môi trường đã được thiết lập, không tự tạo dữ liệu MySQL mới. Không tự chạy simulator. Ctrl+C dừng các tiến trình do lệnh tạo.

### Kết nối ESP32 qua mạng LAN

Lệnh npm run broker dùng broker kiểm thử chỉ nghe 127.0.0.1. Khi nối ESP32 thật, dùng Mosquitto cài trực tiếp trên máy với listener trên địa chỉ LAN, xác thực username/password và cổng trùng cấu hình MQTT của backend/firmware.

### Simulator khi chưa nối ESP32

~~~powershell
npm.cmd run simulator
~~~

Nếu đang dùng start:local, đặt $env:ENV_FILE='.runtime/local.env' trước khi chạy simulator. Simulator publish số đo và ACK qua MQTT thật. Không chạy cùng ESP32 cho cùng deviceId.

## Database và chuyển đổi Java → Node

- Bản cài mới có 5 bảng: Users, Sensors, Devices, SensorData, ActionHistory. Database cũ được giữ nguyên dữ liệu và hash BCrypt.
- Database rỗng được tạo từ backend/database/schema.sql và seed tài khoản/cấu hình mặc định; không seed số đo giả.
- Database có đủ 5 bảng chính được dùng trực tiếp; các bảng cũ dư thừa được giữ nhưng không còn được ứng dụng sử dụng.
- Database chỉ có một phần schema bị từ chối khởi động để tránh ghi đè. Kiểm tra và khôi phục schema trước khi chạy lại.
- ADMIN_PASSWORD chỉ tạo tài khoản khi Users trống; không đổi mật khẩu tài khoản đã có.
- DB_URL dạng JDBC không còn dùng; kiểm tra DB_HOST/PORT/NAME/USER/PASSWORD đúng database trước khi chạy.
- Phiên đăng nhập nằm trong RAM, hết hạn sau SESSION_HOURS (mặc định 8 giờ); restart backend cần đăng nhập lại.

## API và luồng thiết bị

Chi tiết endpoint, payload và MQTT: [docs/API.md](docs/API.md). Postman: [docs/smart-room.postman_collection.json](docs/smart-room.postman_collection.json).

Giữ prefix /api/v1, WebSocket /ws và MQTT iot/sensors/data, iot/devices/{id}/command, iot/devices/{id}/status, iot/esp32/status. WebSocket gửi token trong message đầu tiên, không đặt token trong URL.

Lệnh bật/tắt đi qua deviceService: ghi loading → gửi MQTT → nhận ACK đúng actionId/device/status → xác nhận on/off. ACK retained, sai, trùng hoặc quá hạn không hoàn thành lệnh. Mất ACK chuyển timeout; publish lỗi chuyển error. Mỗi thiết bị chỉ có một lệnh đang chờ ACK.

Giao diện theo Figma gồm Login, Dashboard, Data Sensor, Action History và Profile. Smart Custom và các chức năng liên quan đã được gỡ.

## Firmware

Dùng firmware/SmartRoom/SmartRoom.ino. Copy config.example.h thành config.h và điền Wi-Fi/MQTT. Arduino libraries: PubSubClient, ArduinoJson 7, DHT sensor library, Adafruit Unified Sensor, BH1750.

DHT11 GPIO4; BH1750 SDA/SCL GPIO21/22; Fan GPIO25; Light GPIO26. LED cần điện trở; tải công suất cần mạch điều khiển phù hợp. Các sketch thử nghiệm ở ../firmware dùng giao thức cũ, không thay thế sketch SmartRoom có ACK actionId. Backend chỉ nhận ánh sáng theo lux, không coi ADC từ LDR là lux.

## Build và định dạng mã

~~~powershell
npm.cmd run build
npm.cmd run format:check
~~~

Build tạo frontend/dist. Backend tự phục vụ bản build tại cổng 8080 nếu có khi khởi động.

