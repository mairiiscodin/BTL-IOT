# Smart Room API — Node.js + Express / MySQL

Base URL: `http://localhost:8080/api/v1`. Body JSON. Ngoài Login, gửi `Authorization: Bearer <token>` cho tất cả endpoint.

## Response

```json
{"success":true,"data":{}}
```

```json
{"success":false,"error":{"code":"DEVICE_BUSY","message":"Thiết bị đang chờ ACK của lệnh trước.","field":null}}
```

Danh sách sensor/action có `pagination: {page,limit,total,totalPages}`, page từ 1, limit 1–200.

Mã HTTP: 200 đọc/sửa/xóa, 202 tiếp nhận command, 400 validation, 401 auth, 403 không đủ quyền (viewer gọi API chỉ dành cho admin), 404 không có resource hoặc không thuộc user, 409 conflict/device busy, 429 login rate limit, 500 lỗi nội bộ. MQTT gửi lỗi được ghi vào ActionHistory/status=error sau khi tiếp nhận 202.

## UC01: Auth

| Method | Path | Chức năng |
|---|---|---|
| POST | `/auth/login` | So BCrypt và cấp token |
| GET | `/auth/me` | User của phiên hiện tại |
| POST | `/auth/logout` | Thu hồi token |

```json
{"username":"admin@iot.com","password":"password-from-env"}
```

Login trả `{success:true,data:{token,user}}`. Token phiên ngẫu nhiên, hết hạn 8 giờ; không phải JWT. Restart server xóa phiên trong RAM. Sai login trả 401; giới hạn 10 lần sai/phút/địa chỉ kết nối. `user.role` là `admin` (xem + điều khiển) hoặc `viewer` (chỉ xem); role lưu kèm phiên lúc đăng nhập, đổi role trong DB phải đăng nhập lại mới có hiệu lực.

## UC02, UC04: Sensors

| Method | Path | Query |
|---|---|---|
| GET | `/sensors` | Danh sách cảm biến khai báo |
| GET | `/sensors/latest` | Ba giá trị cuối, null nếu chưa đo |
| GET | `/sensors/data` | type, time, valueMin, valueMax, from, to, page, limit |
| GET | `/sensors/chart` | 30 bản ghi gần nhất của mỗi cảm biến |
| GET | `/sensors/export` | Bộ lọc như data, trả CSV |

`type`: temperature/humidity/light. `time`: `2026-09-15`, `2026-09-15 14`, `2026-09-15 14:30`, hoặc `2026-09-15 14:30:12`, theo múi giờ ứng dụng. `from/to` nhận ISO-8601 có Z hoặc ngày giờ local. Dùng URL encoding cho dấu cách.

```text
GET /sensors/data?type=temperature&time=2026-09-15%2014:30&valueMin=25&valueMax=35&page=1&limit=20
```

```json
{"success":true,"data":[{"id":1024,"sensorId":1,"sensorType":"temperature","value":28.4,"unit":"°C","timestamp":"2026-09-15T07:30:12Z"}],"pagination":{"page":1,"limit":20,"total":1,"totalPages":1}}
```

Latest có thêm `name`, `previousValue`; frontend tính xu hướng từ lần đo trước. Chart trả điểm trung bình theo bucket thời gian, khoảng tối đa 240 điểm mỗi loại; không gửi dữ liệu fake khi DB trống. Export tối đa 100.000 bản ghi, vượt giới hạn trả 400 và yêu cầu thu hẹp thời gian.

## UC03, UC05: Device & Action

| Method | Path | Chức năng |
|---|---|---|
| GET | `/devices` | currentStatus, connectionStatus, lastSeenAt, pendingActionId |
| POST | `/devices/{id}/actions` | Gửi ON/OFF (chỉ role admin; viewer nhận 403 FORBIDDEN) |
| GET | `/actions/{actionId}` | Chi tiết command của user |
| GET | `/actions` | Lọc lịch sử của user |
| GET | `/actions/export` | Xuất CSV cùng bộ lọc |

```json
{"action":"ON"}
```

HTTP 202:

```json
{"success":true,"data":{"actionId":"A110","deviceId":1,"action":"ON","status":"loading","source":"manual"}}
```

Query actions: `deviceId`, `action` (ON/OFF), `status` (loading/on/off/timeout/error), `source` (manual/automation/scene), `from`, `to`, `time`, `q`, `page`, `limit`. `q` tìm tên thiết bị, action, status hoặc source. Result gồm `userName`, `deviceName`, `createdAt`, `completedAt`. CSV dùng chính tập dữ liệu sau lọc, có escape ô để không chạy công thức khi mở trong Excel.

`Devices.current_status` là trạng thái phần cứng gần nhất. `pendingActionId` và ActionHistory/loading là lệnh đang chờ. Hai giá trị không được trộn để giả phần cứng đã thực thi.

## WebSocket

URL: `ws://localhost:8080/ws`. Sau khi connect, gửi trong 10 giây:

```json
{"token":"token-from-login"}
```

Backend trả `{"event":"connected","data":{"authenticated":true}}`. Mỗi message `{event,data}`; heartbeat 10 giây. Token hết hạn/đăng xuất thì kết nối bị đóng. Không polling realtime từ frontend; REST dùng cho khởi tạo, lịch sử và resync khi có event/reconnect.

| Event | Nội dung |
|---|---|
| sensor.updated | Danh sách latest đọc lại từ MySQL sau insert |
| device.command.accepted | deviceId/actionId/loading |
| device.status.changed | ACK/status hoặc timeout/error |
| device.connection.changed | Thay đổi online/offline; GET /devices để đồng bộ |
| system.connection | mqttConnected |

`GET /system` kiểm tra kết nối DB, MQTT và thời gian server (cần token).

## MQTT: Backend ↔ ESP32

Broker yêu cầu username/password. Không sử dụng frontend để publish MQTT.

| Topic | Hướng | Payload |
|---|---|---|
| iot/sensors/data | ESP32 → Backend | Sensor JSON |
| iot/devices/1/command | Backend → Fan | JSON có actionId |
| iot/devices/2/command | Backend → Light | JSON có actionId |
| iot/devices/1/status | Fan → Backend | ACK/status JSON |
| iot/devices/2/status | Light → Backend | ACK/status JSON |
| iot/esp32/status | ESP32 → Backend | online/offline, retained LWT + heartbeat |

Sensor JSON:

```json
{"temperature":29.4,"humidity":67.2,"light":420,"lightUnit":"lux"}
```

Firmware không gửi timestamp: backend ghi measured_at theo thời điểm nhận UTC. Nếu cảm biến lỗi, bỏ trường đó; backend vẫn nhận các trường hợp lệ. Dữ liệu temperature ngoài -40..125, humidity ngoài 0..100, light âm/quá 1.000.000 hoặc lightUnit khác lux bị bỏ. Không nhầm adc_raw thành lux. Packet retained không được lưu như một lần đo mới.

Command (QoS 1, retain=false):

```json
{"actionId":"A110","deviceId":1,"action":"ON","status":"loading","source":"manual"}
```

ACK (retain=false):

```json
{"actionId":"A110","deviceId":1,"status":"on"}
```

Heartbeat status không có actionId:

```json
{"deviceId":1,"status":"on"}
```

Không sử dụng firmware cũ gửi lệnh ON/OFF dạng chuỗi hoặc topic fan/light. ACK phải khớp lệnh đã lưu, không nhận ACK bất kỳ để hoàn tất command gần nhất.

## Tham chiếu

- [Express](https://expressjs.com/).
- [MQTT.js](https://github.com/mqttjs/MQTT.js).
