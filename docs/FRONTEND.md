# Frontend

Frontend React/Vite độc lập trong frontend/. Chạy npm install rồi npm run dev tại thư mục đó.

- Login: đăng nhập tài khoản mẫu.
- Dashboard: ba cảm biến, biểu đồ 24 giờ và hai công tắc thiết bị.
- Data Sensor: lọc ngày, loại cảm biến, giới hạn giá trị và phân trang.
- Action History: tìm kiếm, phân trang, xuất CSV.
- Profile: thông tin sinh viên và tài liệu dự án.

Frontend không còn dữ liệu mẫu; mọi số đo, thiết bị và lịch sử đến từ backend.

App quản lý phiên đăng nhập, điều hướng hash và trạng thái cảm biến/thiết bị. api/client.js gọi REST backend kèm Bearer token. api/socket.js nhận sự kiện qua WebSocket /ws. useData xử lý tải dữ liệu và hủy request khi đổi trang/bộ lọc.

Thiết kế: https://www.figma.com/design/ERAHhh6o3aYMh0dwXZelj1/LeXuanCuong-B23DCCN111-IOT

Smart Custom, Scene, Automation và ngưỡng cảnh báo đã được gỡ khỏi giao diện, mock API và backend.
