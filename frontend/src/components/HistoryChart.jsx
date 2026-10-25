import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../hooks/useData';
import { formatDateTime, formatHourMinute } from '../utils/dateTime';
import { SENSORS, SENSOR_TYPES } from '../data/sensors';
import { ErrorBox } from './ErrorBox';

// Lề trong vùng vẽ (px) để điểm ở mép không bị cắt.
const PAD_X = 14;
const PAD_Y = 12;
const HOVER_RADIUS = 12; // chuột cách đường <= 12px thì hiện tooltip
const AXIS_TICKS = 7; // số mốc thời gian dưới trục X

// ---------- Các hàm vẽ (không phụ thuộc React, dễ đọc riêng) ----------

// Chỉnh kích thước canvas theo devicePixelRatio để hình nét trên màn hình độ phân giải cao.
function setupCanvas(canvas) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr); // từ đây vẽ theo đơn vị CSS px
  return { ctx, width, height };
}

// Vẽ 5 đường lưới ngang.
function drawGrid(ctx, width, height) {
  ctx.strokeStyle = '#e2e8f0';
  for (let step = 0; step <= 4; step++) {
    const y = (height * step) / 4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

/**
 * Đổi dữ liệu API thành toạ độ pixel cho từng đường.
 * - Trục X (thời gian) dùng chung cho cả 3 đường.
 * - Trục Y mỗi đường có thang riêng (nhiệt độ ~30, ánh sáng ~500 nên không thể dùng chung).
 * @returns [{ color, points: [{ row, x, y, color }] }]
 */
function buildSeries(rows, width, height) {
  const times = rows.map((row) => Date.parse(row.timestamp));
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  return SENSOR_TYPES.map((type) => {
    const color = SENSORS[type].chartColor;
    const data = rows
      .filter((row) => row.sensorType === type)
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    if (!data.length) return null;

    // Nới thang Y thêm 1 đơn vị trên/dưới để đường không dính sát mép.
    const values = data.map((row) => row.value);
    const top = Math.max(...values) + 1;
    const bottom = Math.min(...values) - 1;

    const points = data.map((row) => ({
      row,
      color,
      x:
        PAD_X +
        ((width - 2 * PAD_X) * (Date.parse(row.timestamp) - minTime)) / (maxTime - minTime || 1),
      y: height - PAD_Y - ((height - 2 * PAD_Y) * (row.value - bottom)) / (top - bottom),
    }));
    return { color, points };
  }).filter(Boolean);
}

// Nối các điểm của một đường; chỉ có 1 điểm thì vẽ chấm tròn.
function drawLine(ctx, { color, points }) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.beginPath();
  points.forEach(({ x, y }, i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.stroke();

  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Tìm điểm dữ liệu gần chuột nhất.
 * Với mỗi đoạn thẳng a-b, tính khoảng cách từ chuột tới đoạn đó (hình chiếu vuông góc),
 * rồi chọn đầu mút (a hoặc b) gần hơn. Trả về null nếu không có đoạn nào trong HOVER_RADIUS.
 */
function findNearestPoint(series, x, y) {
  let nearest = null;
  let bestDistance = HOVER_RADIUS;
  for (const { points } of series) {
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[i + 1] || a;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      // t ∈ [0, 1]: vị trí hình chiếu của chuột trên đoạn a-b (0 = tại a, 1 = tại b).
      const t = Math.max(
        0,
        Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)),
      );
      const distance = Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = t < 0.5 ? a : b;
      }
    }
  }
  return nearest;
}

// AXIS_TICKS mốc thời gian chia đều từ bản ghi đầu tới bản ghi cuối.
function axisLabels(rows) {
  if (!rows.length) return [];
  const times = rows.map((row) => Date.parse(row.timestamp));
  const first = Math.min(...times);
  const last = Math.max(...times);
  return Array.from({ length: AXIS_TICKS }, (_, i) =>
    formatHourMinute(first + ((last - first) * i) / (AXIS_TICKS - 1)),
  );
}

// ---------- Component ----------

/**
 * Biểu đồ 30 bản ghi gần nhất của 3 cảm biến, tự vẽ bằng <canvas> (không dùng thư viện).
 * @param revision tăng lên khi có dữ liệu mới => tải lại biểu đồ
 */
export function HistoryChart({ revision }) {
  const { result, error, loading } = useData('/sensors/chart', revision);
  const rows = result?.data || [];

  const canvasRef = useRef(null);
  const seriesRef = useRef([]); // toạ độ các điểm đã vẽ, dùng khi rê chuột
  const [hover, setHover] = useState(null); // điểm đang được rê chuột tới

  // Vẽ lại khi có dữ liệu mới và mỗi khi canvas đổi kích thước.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function draw() {
      setHover(null);
      const { ctx, width, height } = setupCanvas(canvas);
      drawGrid(ctx, width, height);
      const series = buildSeries(rows, width, height);
      series.forEach((line) => drawLine(ctx, line));
      seriesRef.current = series;
    }

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [result]);

  // Đổi toạ độ chuột (theo màn hình) sang toạ độ trong canvas rồi tìm điểm gần nhất.
  function handleMouseMove(event) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) * canvas.clientWidth) / rect.width;
    const y = ((event.clientY - rect.top) * canvas.clientHeight) / rect.height;
    setHover(findNearestPoint(seriesRef.current, x, y));
  }

  return (
    <section className="card chart-card">
      {/* Tiêu đề và chú thích màu. */}
      <div className="row chart-header">
        <div>
          <h2>Historical Trends (Last 30 readings)</h2>
          <p>Continuous sensory reporting dataset</p>
        </div>
        <div className="legends">
          {SENSOR_TYPES.map((type) => (
            <span key={type}>
              <i className={SENSORS[type].color} />
              {SENSORS[type].shortLabel} ({SENSORS[type].unit})
            </span>
          ))}
        </div>
      </div>

      <ErrorBox message={error} />

      <div className="chart-wrap">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Lịch sử nhiệt độ, độ ẩm và ánh sáng"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHover(null)}
        />

        {!rows.length && (
          <p className="chart-empty">
            {loading ? 'Đang tải lịch sử…' : 'Chưa có dữ liệu lịch sử.'}
          </p>
        )}

        {hover && <ChartTooltip point={hover} canvasWidth={canvasRef.current?.clientWidth} />}
      </div>

      {/* Trục thời gian. */}
      <div className="axis">
        {axisLabels(rows).map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
    </section>
  );
}

// Chấm tròn tại điểm đang rê chuột + hộp thông tin (giữ trong khung canvas).
function ChartTooltip({ point, canvasWidth = 216 }) {
  const { row, x, y, color } = point;
  const left = Math.max(8, Math.min(x - 100, canvasWidth - 208));
  const top = y > 80 ? y - 72 : y + 14; // gần mép trên thì hiện tooltip phía dưới điểm
  return (
    <>
      <span className="chart-hover-point" style={{ left: x, top: y, borderColor: color }} />
      <div className="chart-tooltip" style={{ left, top }}>
        {SENSORS[row.sensorType].label}: {Number(row.value).toFixed(2)} {row.unit}
        <br />
        {formatDateTime(row.timestamp)}
      </div>
    </>
  );
}
