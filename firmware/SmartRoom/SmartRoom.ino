// =============================================================
// Firmware ESP32 cho Smart Room.
//   - Mỗi 3 giây: đọc DHT11 (nhiệt độ, độ ẩm) + cảm biến ánh sáng, gửi lên MQTT.
//   - Nhận lệnh ON/OFF từ backend, bật/tắt LED và gửi ACK (kèm actionId) về.
//   - Tự kết nối lại Wi-Fi / MQTT khi bị mất.
// Cấu hình Wi-Fi và MQTT nằm trong config.h (copy từ config.example.h).
// =============================================================
#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include "config.h"

// ---------- Sơ đồ chân ----------
//   DHT11 DATA                 -> GPIO14
//   Cảm biến ánh sáng A0       -> GPIO34 (ADC1; ADC2 không đọc được khi bật Wi-Fi)
//   Device 1 (System Light)    -> LED GPIO17
//   Device 2 (Emergency Light) -> LED GPIO18
constexpr uint8_t DHT_PIN = 14;
constexpr uint8_t LIGHT_A0_PIN = 34;
constexpr uint8_t DEVICE1_PIN = 17;
constexpr uint8_t DEVICE2_PIN = 18;

// ---------- Topic MQTT (phải khớp backend/config/constants.js) ----------
const char *TOPIC_SENSOR_DATA = "iot/sensors/data";
const char *TOPIC_ESP32_STATUS = "iot/esp32/status";
const char *TOPIC_DEVICE1_COMMAND = "iot/devices/1/command";
const char *TOPIC_DEVICE2_COMMAND = "iot/devices/2/command";

// ---------- Chu kỳ (ms) ----------
constexpr unsigned long SENSOR_INTERVAL_MS = 3000;    // gửi số đo
constexpr unsigned long MQTT_RETRY_MS = 5000;         // thử kết nối lại MQTT
constexpr unsigned long WIFI_RETRY_MS = 15000;        // thử kết nối lại Wi-Fi

// ---------- Trạng thái toàn cục ----------
WiFiClient network;
PubSubClient mqtt(network);
DHT dht(DHT_PIN, DHT_TYPE);

bool device1On = false;
bool device2On = false;
bool wifiReported = false;  // đã in IP ra Serial sau lần kết nối Wi-Fi gần nhất chưa
unsigned long lastSensorRead = 0, lastMqttTry = 0, lastWifiTry = 0;

// Nhớ 8 lệnh gần nhất đã xử lý. Broker QoS1 có thể gửi lại cùng một lệnh,
// khi đó chỉ gửi lại ACK chứ không bật/tắt lần nữa.
constexpr uint8_t RECENT_ACK_COUNT = 8;
struct Ack {
  char actionId[25] = "";
  int deviceId = 0;
  bool on = false;
};
Ack recentAcks[RECENT_ACK_COUNT];
uint8_t nextAckSlot = 0;  // vị trí sẽ ghi đè tiếp theo (bộ đệm vòng)

// =============================================================
// Đọc JSON đơn giản (lệnh từ backend chỉ có vài trường, không cần thư viện JSON)
// =============================================================

// Lấy giá trị chuỗi của "key":"value". Trả về false nếu không có hoặc quá dài.
bool jsonString(const char *json, const char *key, char *out, size_t size) {
  char pattern[24];
  snprintf(pattern, sizeof(pattern), "\"%s\":\"", key);
  const char *start = strstr(json, pattern);
  if (!start) return false;
  start += strlen(pattern);
  const char *end = strchr(start, '"');
  if (!end || (size_t)(end - start) >= size) return false;
  memcpy(out, start, end - start);
  out[end - start] = '\0';
  return true;
}

// Lấy giá trị số của "key":123. Không có thì trả về 0.
long jsonInt(const char *json, const char *key) {
  char pattern[24];
  snprintf(pattern, sizeof(pattern), "\"%s\":", key);
  const char *start = strstr(json, pattern);
  return start ? strtol(start + strlen(pattern), nullptr, 10) : 0;
}

// =============================================================
// Thiết bị (LED)
// =============================================================

bool isDeviceOn(int deviceId) {
  return deviceId == 1 ? device1On : device2On;
}

// Bật/tắt LED và ghi nhớ trạng thái.
void setDevice(int deviceId, bool on) {
  digitalWrite(deviceId == 1 ? DEVICE1_PIN : DEVICE2_PIN, on ? HIGH : LOW);
  if (deviceId == 1) device1On = on;
  else device2On = on;
}

// Gửi trạng thái thiết bị lên 'iot/devices/<id>/status'.
// Có actionId => đây là ACK cho một lệnh; không có => báo trạng thái định kỳ.
void publishState(int deviceId, const char *actionId = nullptr) {
  const char *status = isDeviceOn(deviceId) ? "on" : "off";
  char topic[40], payload[96];
  snprintf(topic, sizeof(topic), "iot/devices/%d/status", deviceId);
  if (actionId)
    snprintf(payload, sizeof(payload), "{\"deviceId\":%d,\"status\":\"%s\",\"actionId\":\"%s\"}",
             deviceId, status, actionId);
  else
    snprintf(payload, sizeof(payload), "{\"deviceId\":%d,\"status\":\"%s\"}", deviceId, status);
  // Không retained: backend chỉ chấp nhận ACK "mới", khớp với lệnh đang chờ.
  if (!mqtt.publish(topic, payload, false)) Serial.println("Gui trang thai/ACK that bai");
}

// =============================================================
// Xử lý lệnh từ backend
// =============================================================

// actionId hợp lệ có dạng 'A' + chữ số, vd. "A15".
bool isValidActionId(const char *actionId) {
  size_t length = strlen(actionId);
  if (actionId[0] != 'A' || length < 2) return false;
  for (size_t i = 1; i < length; i++)
    if (!isDigit(actionId[i])) return false;
  return true;
}

// Lệnh này đã xử lý rồi chưa (broker gửi lại)?
bool alreadyHandled(int deviceId, const char *actionId) {
  for (const Ack &ack : recentAcks)
    if (ack.deviceId == deviceId && strcmp(ack.actionId, actionId) == 0) return true;
  return false;
}

// Ghi nhớ lệnh vừa xử lý vào bộ đệm vòng (ghi đè lệnh cũ nhất).
void rememberAck(int deviceId, const char *actionId, bool on) {
  Ack &slot = recentAcks[nextAckSlot];
  strncpy(slot.actionId, actionId, sizeof(slot.actionId) - 1);
  slot.deviceId = deviceId;
  slot.on = on;
  nextAckSlot = (nextAckSlot + 1) % RECENT_ACK_COUNT;
}

/**
 * Được PubSubClient gọi mỗi khi có tin MQTT tới.
 * Lệnh mẫu: {"actionId":"A15","deviceId":1,"action":"ON","status":"loading","source":"manual"}
 */
void onMqttMessage(char *topic, byte *payload, unsigned int length) {
  // Chép payload thành chuỗi C có ký tự kết thúc '\0'.
  char json[256];
  if (length >= sizeof(json)) return;
  memcpy(json, payload, length);
  json[length] = '\0';

  // deviceId trong nội dung phải là 1 hoặc 2 và khớp với topic nhận được.
  int deviceId = jsonInt(json, "deviceId");
  char expectedTopic[40];
  snprintf(expectedTopic, sizeof(expectedTopic), "iot/devices/%d/command", deviceId);
  if ((deviceId != 1 && deviceId != 2) || strcmp(topic, expectedTopic) != 0) return;

  // Đọc và kiểm tra action ('ON' / 'OFF') và actionId ('A<số>').
  char action[8], actionId[25];
  if (!jsonString(json, "action", action, sizeof(action)) ||
      !jsonString(json, "actionId", actionId, sizeof(actionId)))
    return;
  if (strcmp(action, "ON") != 0 && strcmp(action, "OFF") != 0) return;
  if (!isValidActionId(actionId)) return;

  // Lệnh trùng: chỉ gửi lại ACK, không đảo trạng thái.
  if (alreadyHandled(deviceId, actionId)) {
    publishState(deviceId, actionId);
    return;
  }

  bool on = strcmp(action, "ON") == 0;
  setDevice(deviceId, on);
  rememberAck(deviceId, actionId, on);
  publishState(deviceId, actionId);  // gửi ACK
  Serial.printf("Da %s device %d (%s) -> GPIO%u = %s\n", action, deviceId, actionId,
                deviceId == 1 ? DEVICE1_PIN : DEVICE2_PIN, on ? "HIGH" : "LOW");
}

// =============================================================
// Kết nối MQTT
// =============================================================

void connectMqtt() {
  String clientId = "smartroom-" + WiFi.macAddress();  // mỗi ESP32 một id riêng
  Serial.printf("Ket noi MQTT %s:%u ...\n", MQTT_HOST, MQTT_PORT);

  // Last Will: nếu ESP32 mất kết nối đột ngột, broker tự gửi "offline" (retained) thay ESP32.
  bool ok = mqtt.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD, TOPIC_ESP32_STATUS,
                         1 /* QoS */, true /* retained */, "offline");
  if (!ok) {
    // 5 = sai user/mật khẩu; -2 = không tới được broker (IP, port, firewall).
    Serial.printf("Loi MQTT: %d\n", mqtt.state());
    return;
  }

  mqtt.subscribe(TOPIC_DEVICE1_COMMAND, 1);
  mqtt.subscribe(TOPIC_DEVICE2_COMMAND, 1);
  mqtt.publish(TOPIC_ESP32_STATUS, "online", true);
  publishState(1);
  publishState(2);
  Serial.println("MQTT da ket noi; cho lenh tu backend.");
}

// =============================================================
// Cảm biến
// =============================================================

// Đọc A0 (0..4095, lấy trung bình 8 lần cho đỡ nhiễu) rồi quy đổi tuyến tính ra 0..LIGHT_MAX_LUX.
// Quang trở không đo lux chuẩn, nên đây là giá trị ước lượng.
float readLux() {
  long sum = 0;
  for (int i = 0; i < 8; i++) sum += analogRead(LIGHT_A0_PIN);
  float raw = sum / 8.0f;
  Serial.printf("A0 raw: %.0f\n", raw);  // 0 hoặc 4095 mãi không đổi => kiểm tra dây A0
  float brightness = LIGHT_DARK_IS_HIGH ? (4095.0f - raw) / 4095.0f : raw / 4095.0f;
  return brightness * LIGHT_MAX_LUX;
}

// Đọc cảm biến, tạo JSON và gửi lên MQTT. Đọc DHT lỗi (NaN) thì bỏ trường đó khỏi JSON.
// Ví dụ: {"temperature":28.5,"humidity":65.0,"light":500,"lightUnit":"lux"}
void readAndPublishSensors() {
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  float lux = readLux();

  char payload[160];
  int n = snprintf(payload, sizeof(payload), "{");
  if (!isnan(temperature))
    n += snprintf(payload + n, sizeof(payload) - n, "\"temperature\":%.1f,", temperature);
  if (!isnan(humidity))
    n += snprintf(payload + n, sizeof(payload) - n, "\"humidity\":%.1f,", humidity);
  snprintf(payload + n, sizeof(payload) - n, "\"light\":%.0f,\"lightUnit\":\"lux\"}", lux);

  if (isnan(temperature) || isnan(humidity))
    Serial.println("Loi doc DHT11. Kiem tra DATA GPIO14, nguon va GND.");
  Serial.println(payload);

  if (mqtt.connected()) {
    mqtt.publish(TOPIC_SENSOR_DATA, payload, false);
    // Gửi kèm heartbeat: báo 'online' và trạng thái thiết bị để backend không đánh dấu offline.
    mqtt.publish(TOPIC_ESP32_STATUS, "online", true);
    publishState(1);
    publishState(2);
  }
}

// =============================================================
// setup() chạy 1 lần khi khởi động, loop() chạy lặp mãi
// =============================================================

void setup() {
  Serial.begin(115200);

  // LED tắt khi khởi động.
  pinMode(DEVICE1_PIN, OUTPUT);
  pinMode(DEVICE2_PIN, OUTPUT);
  digitalWrite(DEVICE1_PIN, LOW);
  digitalWrite(DEVICE2_PIN, LOW);

  // Tự kiểm tra LED: mỗi LED sáng 1 giây lần lượt. Không thấy sáng => lỗi dây/LED, không phải code.
  const uint8_t testPins[] = {DEVICE1_PIN, DEVICE2_PIN};
  for (uint8_t pin : testPins) {
    Serial.printf("Test LED GPIO%u: BAT 1 giay\n", pin);
    digitalWrite(pin, HIGH);
    delay(1000);
    digitalWrite(pin, LOW);
    delay(300);
  }
  analogReadResolution(12);  // A0: 0..4095
  dht.begin();

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
  mqtt.setBufferSize(512);
  mqtt.setKeepAlive(15);
  mqtt.setSocketTimeout(2);

  WiFi.mode(WIFI_STA);  // chế độ client, kết nối vào router/hotspot
  WiFi.setAutoReconnect(true);
  Serial.printf("Ket noi Wi-Fi: %s\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

// Giữ kết nối Wi-Fi và MQTT. Dùng millis() thay vì delay() dài để loop không bị chặn.
void maintainConnections(unsigned long now) {
  if (WiFi.status() != WL_CONNECTED) {
    wifiReported = false;
    if (now - lastWifiTry > WIFI_RETRY_MS) {
      lastWifiTry = now;
      Serial.println("Dang ket noi lai Wi-Fi...");
      WiFi.reconnect();
    }
    return;
  }

  if (!wifiReported) {
    wifiReported = true;
    Serial.print("Wi-Fi OK. ESP32 IP: ");
    Serial.println(WiFi.localIP());
  }
  if (!mqtt.connected() && now - lastMqttTry > MQTT_RETRY_MS) {
    lastMqttTry = now;
    connectMqtt();
  }
  if (mqtt.connected()) mqtt.loop();  // nhận tin tới và gọi onMqttMessage()
}

void loop() {
  unsigned long now = millis();
  maintainConnections(now);
  if (now - lastSensorRead >= SENSOR_INTERVAL_MS) {
    lastSensorRead = now;
    readAndPublishSensors();
  }
  delay(2);
}
