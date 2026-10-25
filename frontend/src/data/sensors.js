// Cấu hình hiển thị cho từng loại cảm biến, dùng chung cho Dashboard, Data Sensor và biểu đồ.
//   label     : tên hiển thị
//   unit      : đơn vị (để ghi chú thích biểu đồ)
//   icon      : tên file icon trong public/assets
//   color     : class CSS màu (red/blue/amber) cho thẻ số đo
//   chartColor: màu đường trên biểu đồ
//   sparkline : ảnh trang trí nhỏ trên thẻ số đo
export const SENSORS = {
  temperature: {
    label: 'Temperature',
    shortLabel: 'Temp',
    unit: '°C',
    icon: 'imgThermometer',
    color: 'red',
    chartColor: '#ef4444',
    sparkline: 'imgSparkline',
  },
  humidity: {
    label: 'Humidity',
    shortLabel: 'Humidity',
    unit: '%',
    icon: 'imgDroplet',
    color: 'blue',
    chartColor: '#3b82f6',
    sparkline: 'imgSparkline1',
  },
  light: {
    label: 'Ambient Light',
    shortLabel: 'Light',
    unit: 'lux',
    icon: 'imgSun',
    color: 'amber',
    chartColor: '#d99a00',
    sparkline: 'imgSparkline2',
  },
};

// Danh sách key theo thứ tự cố định: ['temperature', 'humidity', 'light'].
export const SENSOR_TYPES = Object.keys(SENSORS);
