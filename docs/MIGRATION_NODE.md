# Trạng thái hiện tại

Frontend đã tách riêng và dùng JSON mẫu mặc định. Smart Custom và các chức năng liên quan đã được gỡ; schema mới chỉ có 5 bảng chính. Nội dung bên dưới là lịch sử chuyển đổi trước thay đổi này, không phải danh sách chức năng hiện tại.

# Chuyển cấu trúc và backend sang Node.js

Ngày: 2026-10-03. Tham khảo cấu trúc repo datnt-numenor/IOT_va_ung_dung tại commit 19f88cf3e7413db3ba7ff87115aedcbecd74c8e8.

## Thay đổi

- frontend/src tách App, pages, components, api, hooks, utils và data. REST và WebSocket tách thành client.js và socket.js.
- backend chuyển hoàn toàn sang Express, mysql2, MQTT.js, ws, bcryptjs và Luxon; có routes, controllers, services, config, middleware, realtime, utils, database và scripts.
- Giữ API /api/v1, WebSocket /ws, giao thức MQTT numeric device ID + actionId, auth BCrypt và 11 bảng hiện tại.
- Giữ cả UC06 (preferences, thresholds, automations, scenes), không chép đè nghiệp vụ bằng bộ API đơn giản hơn của repo mẫu.
- Dùng npm workspaces và một lockfile tại BTL. Root scripts vẫn hỗ trợ dev/build/backend/start:local để không mất cách chạy quen thuộc.
- Chạy trực tiếp bằng Node.js, MySQL và MQTT cài trên máy. Đã bỏ cấu hình Docker theo lựa chọn của người dùng; local env và dữ liệu MySQL giữ nguyên.
- Bản tinh gọn đã bỏ legacy, các bộ test tự động, cấu hình Playwright, script chụp ảnh và ảnh preview. Mã ứng dụng, firmware, dữ liệu local và simulator được giữ lại.

## Kiểm chứng trước khi tinh gọn

Các kiểm tra dưới đây đã chạy trong lần chuyển đổi. Bộ test và script kiểm thử đã được gỡ khỏi bản tinh gọn theo yêu cầu; đây là kết quả lịch sử.

- Build React/Vite thành công sau khi di chuyển.
- 6 unit tests Node đạt: quy tắc ACK, số đo cảm biến, AND/OR, khung giờ, validation bộ lọc/Scene và CSV.
- Integration test đạt trên MySQL 8 và MQTT thật với database cũ: BCrypt, quyền sở hữu, telemetry/query/chart, WebSocket, loading/ACK, ACK sai/trùng/trễ, timeout, preferences, thresholds, automation AND, Scene và CSV.
- Playwright đi qua backend Node thật: login sai/đúng, realtime, điều khiển chờ ACK, tìm kiếm, xuất CSV, preferences qua reload, Scene CRUD, logout và 5 trang ở độ rộng 390px; không có lỗi JavaScript trang.
- Kiểm tra riêng database rỗng: tạo đúng 11 bảng, khởi tạo lặp lại giữ tài khoản/hash, không seed số đo; database thử tạm được dọn sau kiểm tra.

## Giới hạn

Chưa kiểm chứng trên ESP32 vật lý; integration/browser dùng simulator qua MQTT thật.

## Đường dẫn thay thế

| Trước | Sau |
| --- | --- |
| src/main.jsx chứa toàn ứng dụng | frontend/src/main.jsx + App.jsx + pages/Login.jsx + pages/Profile.jsx |
| src/pages.jsx | frontend/src/pages/Dashboard.jsx, DataSensor.jsx, ActionHistory.jsx và components/HistoryChart.jsx, RecentActions.jsx |
| src/components.jsx | frontend/src/components/, hooks/useData.js, utils/dateTime.js, data/sensors.js |
| src/api.js | frontend/src/api/client.js + socket.js |
| src/smart-custom.jsx | frontend/src/pages/SmartCustom.jsx |
| public/ | frontend/public/ |
| vite.config.js, index.html | frontend/vite.config.js, frontend/index.html |
| backend/src/main/java/... | backend/routes/, controllers/, services/, config/, realtime/ |
| backend/src/main/resources/db/migration/V1__smart_room.sql | backend/database/schema.sql |
| mvn package, java -jar | npm run backend (Node.js) |

ENV_FILE tương đối được giải từ BTL để chạy npm workspace backend không lệch đường dẫn; file chỉ định không tồn tại sẽ báo lỗi rõ ràng.

## Frontend JSON độc lập

Frontend đã tách khỏi npm workspaces và có package-lock.json, dependency, cấu hình riêng. Mặc định dùng public/data/demo.json; lớp demo mô phỏng thao tác trong bộ nhớ, reload khôi phục mẫu. API thật được chọn bằng VITE_DATA_SOURCE=api. Các kiểm tra JSON-only đã qua: login, biểu đồ, lọc, CSV, điều khiển mô phỏng, sự kiện, CRUD cấu hình và Scene; không gọi backend.
