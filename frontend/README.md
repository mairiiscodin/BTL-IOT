# IoT Smart Room — Frontend độc lập

React + Vite. Mặc định dùng dữ liệu JSON mẫu, không cần backend, MySQL, MQTT hay thư mục .runtime.

## Chạy

Mở terminal trong thư mục frontend:

~~~powershell
npm ci
npm run dev
~~~

Mở http://127.0.0.1:5173. Tài khoản mẫu: **admin@iot.com / demo123** (hiện sẵn trên trang đăng nhập).

Có thể copy riêng cả thư mục frontend sang máy khác và chạy các lệnh trên. Frontend có package.json và package-lock.json riêng. Yêu cầu Node.js 22.19+.

## Dữ liệu mẫu

Chỉnh [public/data/demo.json](public/data/demo.json), rồi tải lại trang. File chứa login/user, sensors/readings, devices/actions. Mật khẩu trong JSON là tài khoản demo công khai, không dùng cho hệ thống thật.

- Dashboard và biểu đồ đọc số đo từ JSON. Ngày giờ được dịch cùng một khoảng theo referenceTime đến lúc mở trang để có dữ liệu cho các khoảng 1H/6H/24H/7D.
- Bật/tắt thiết bị mô phỏng thời gian xử lý 700ms, cập nhật lịch sử trong trình duyệt; không gửi lệnh ra phần cứng.
- Hỗ trợ lọc, phân trang, CSV và tìm kiếm lịch sử.
- Thay đổi chỉ nằm trong bộ nhớ của tab. Reload khôi phục JSON gốc; không ghi ngược vào file. Session đăng nhập demo dùng sessionStorage riêng.

Lớp dữ liệu nằm trong src/api/demo.js, demoStore.js, demoQuery.js. Các trang giữ giao diện gọi request để dễ nối API thật sau này.

## Build

~~~powershell
npm run build
npm run preview
~~~

Thư mục dist chứa toàn bộ frontend và JSON mẫu, có thể phục vụ bằng web server tĩnh.

## Nối lại API thật (tùy chọn)

Copy .env.example thành .env, đặt VITE_DATA_SOURCE=api và API_PROXY_TARGET=http://127.0.0.1:8080, rồi khởi động lại Vite. Chế độ api cần backend, MySQL và MQTT thật. Bản build api cần phục vụ cùng origin backend hoặc cấu hình VITE_API_URL/VITE_WS_URL và CORS phù hợp.
