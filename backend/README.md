# Backend Node.js

Express + mysql2 + MQTT.js + ws; cấu trúc routes → controllers → services, config/db quản lý transaction.

Cài dependency từ BTL bằng npm ci. Trong thư mục backend chạy npm run dev hoặc npm start. Backend đọc backend/.env rồi BTL/.env; có thể copy backend/.env.example và điền cấu hình riêng. Database cũ được tiếp nhận không xóa dữ liệu. npm run db:init tạo schema khi database rỗng.

Hướng dẫn đầy đủ: [README chung](../README.md). API: [docs/API.md](../docs/API.md). Khi chạy ENV_FILE với đường dẫn tương đối, đường dẫn tính từ BTL.
