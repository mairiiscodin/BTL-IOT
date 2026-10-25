#pragma once
// Copy file này thành config.h rồi điền Wi-Fi/MQTT (config.h không đưa lên git).
// Wi-Fi phải là 2.4GHz và laptop chạy Mosquitto cùng mạng với ESP32.
#define WIFI_SSID "YOUR_2_4_GHZ_WIFI"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define MQTT_HOST "192.168.1.10"  // IPv4 của laptop (xem bằng ipconfig), không dùng localhost
#define MQTT_PORT 1111            // trùng listener trong mosquitto-local.conf
#define MQTT_USERNAME "esp32"
#define MQTT_PASSWORD "YOUR_MQTT_PASSWORD"
#define DHT_TYPE DHT11

// Cảm biến ánh sáng A0 (GPIO34) đọc analog 0..4095 -> quy đổi ra lux ước lượng.
#define LIGHT_DARK_IS_HIGH 1      // 1: A0 càng cao khi càng tối (module LDR thường gặp); đổi thành 0 nếu ngược
#define LIGHT_MAX_LUX 1000.0f     // lux gửi lên khi sáng nhất (A0 = mức sáng tối đa)
