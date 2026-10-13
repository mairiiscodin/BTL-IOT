# Frontend

Frontend React/Vite độc lập trong frontend/. Chạy npm install rồi npm run dev tại thư mục đó.

- Login: đăng nhập tài khoản mẫu.
- Dashboard: ba cảm biến, biểu đồ 24 giờ và hai công tắc thiết bị.
- Data Sensor: lọc ngày, loại cảm biến, giới hạn giá trị và phân trang.
- Action History: tìm kiếm, phân trang, xuất CSV.
- Profile: thông tin sinh viên và tài liệu dự án.

Dữ liệu mẫu nằm ở frontend/public/data/demo.json. Thao tác được giữ trong bộ nhớ, tải lại trang khôi phục mẫu. Bật/tắt mô phỏng mất 700 ms và cập nhật lịch sử.

App quản lý phiên đăng nhập, điều hướng hash và trạng thái cảm biến/thiết bị. api/client.js chọn JSON mặc định hoặc backend khi VITE_DATA_SOURCE=api. api/socket.js chọn sự kiện demo hoặc WebSocket thật. useData xử lý tải dữ liệu và hủy request khi đổi trang/bộ lọc.

Thiết kế: https://www.figma.com/design/ERAHhh6o3aYMh0dwXZelj1/LeXuanCuong-B23DCCN111-IOT

Smart Custom, Scene, Automation và ngưỡng cảnh báo đã được gỡ khỏi giao diện, mock API và backend.
