# IoT Smart Room — Frontend

React + Vite. Toàn bộ dữ liệu lấy từ backend Node.js qua REST (/api/v1) và WebSocket (/ws); không còn dữ liệu mẫu.

## Chạy

Cần backend đang chạy tại http://127.0.0.1:8080 (xem [README chung](../README.md)). Mở terminal trong thư mục frontend:

~~~powershell
npm ci
npm run dev
~~~

Mở http://127.0.0.1:5173. Vite proxy /api và /ws tới backend. Tài khoản do backend/database/init.sql tạo: **admin@iot.com / admin123**.

Đổi địa chỉ backend: copy .env.example thành .env và đặt API_PROXY_TARGET, rồi khởi động lại Vite.

## Build

~~~powershell
npm run build
~~~

Backend tự phục vụ frontend/dist tại cổng 8080 nếu thư mục này tồn tại. Nếu phục vụ dist ở origin khác, cấu hình VITE_API_URL/VITE_WS_URL và ALLOWED_ORIGINS của backend.
