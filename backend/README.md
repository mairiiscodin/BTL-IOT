# Backend Node.js

Express + mysql2 + MQTT.js + ws; cấu trúc routes → controllers → services, config/db quản lý transaction.

Cài dependency từ BTL bằng npm ci. Trong thư mục backend chạy npm run dev hoặc npm start. Backend đọc backend/.env rồi BTL/.env; có thể copy backend/.env.example và điền cấu hình riêng. Backend không tự tạo bảng: chạy backend/database/init.sql trong MySQL trước (tạo database, 5 bảng, cảm biến, thiết bị, tài khoản admin@iot.com / admin123). npm run db:check kiểm tra database đã sẵn sàng.

Hướng dẫn đầy đủ: [README chung](../README.md). API: [docs/API.md](../docs/API.md). Khi chạy ENV_FILE với đường dẫn tương đối, đường dẫn tính từ BTL.
