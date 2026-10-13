import React, { useState, useEffect, useRef } from 'react';
import { useData, ErrorBox, sensorLabels, date } from './index';
export function HistoryChart({ range, revision }) {
  const { result, error, loading } = useData(`/sensors/chart?range=${range}`, revision),
    ref = useRef(),
    seriesRef = useRef([]),
    [hover, setHover] = useState(null);
  const rows = result?.data || [];
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    function draw() {
      setHover(null);
      seriesRef.current = [];
      const w = canvas.clientWidth,
        h = canvas.clientHeight,
        dpr = devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const c = canvas.getContext('2d');
      c.scale(dpr, dpr);
      c.strokeStyle = '#e2e8f0';
      for (let step = 0; step <= 4; step++) {
        const y = (h * step) / 4;
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(w, y);
        c.stroke();
      }
      const times = rows.map((r) => new Date(r.timestamp).getTime()),
        min = Math.min(...times),
        max = Math.max(...times);
      ['temperature', 'humidity', 'light'].forEach((type, j) => {
        const data = rows
          .filter((r) => r.sensorType === type)
          .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
        if (!data.length) return;
        const top = Math.max(...data.map((r) => r.value)) + 1,
          bottom = Math.min(...data.map((r) => r.value)) - 1;
        c.strokeStyle = ['#ef4444', '#3b82f6', '#d99a00'][j];
        c.fillStyle = c.strokeStyle;
        c.lineWidth = 2.5;
        c.lineJoin = 'round';
        c.lineCap = 'round';
        c.beginPath();
        const points = [];
        data.forEach((r, i) => {
          const x = 14 + ((w - 28) * (new Date(r.timestamp).getTime() - min)) / (max - min || 1),
            y = h - 12 - ((h - 24) * (r.value - bottom)) / (top - bottom);
          points.push({ row: r, x, y, color: c.strokeStyle });
          if (!i) c.moveTo(x, y);
          else c.lineTo(x, y);
        });
        seriesRef.current.push(points);
        c.stroke();
        if (data.length === 1) {
          c.beginPath();
          c.arc(14, h / 2, 3, 0, Math.PI * 2);
          c.fill();
        }
      });
    }
    draw();
    const resize = new ResizeObserver(draw);
    resize.observe(canvas);
    return () => resize.disconnect();
  }, [result]);
  return (
    <section className="card chart-card">
      <div className="row chart-header">
        <div>
          <h2>Historical Trends ({range === '24H' ? '24 Hours' : range})</h2>
          <p>Continuous sensory reporting dataset</p>
        </div>
        <div className="legends">
          <span>
            <i className="red" />
            Temp (°C)
          </span>
          <span>
            <i className="blue" />
            Humidity (%)
          </span>
          <span>
            <i className="amber" />
            Light (lux)
          </span>
        </div>
      </div>
      <ErrorBox message={error} />
      <div className="chart-wrap">
        <canvas
          ref={ref}
          role="img"
          aria-label="Lịch sử nhiệt độ, độ ẩm và ánh sáng"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) * e.currentTarget.clientWidth) / rect.width;
            const y = ((e.clientY - rect.top) * e.currentTarget.clientHeight) / rect.height;
            let nearest = null;
            let distance = 12;
            for (const points of seriesRef.current) {
              for (let i = 0; i < points.length; i++) {
                const a = points[i];
                const b = points[i + 1] || a;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const t = Math.max(
                  0,
                  Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)),
                );
                const gap = Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
                if (gap < distance) {
                  distance = gap;
                  nearest = t < 0.5 ? a : b;
                }
              }
            }
            setHover(nearest);
          }}
          onMouseLeave={() => setHover(null)}
        />
        {!rows.length && (
          <p className="chart-empty">
            {loading ? 'Đang tải lịch sử…' : 'Chưa có dữ liệu lịch sử trong khoảng này.'}
          </p>
        )}
        {hover && (
          <>
            <span
              className="chart-hover-point"
              style={{ left: hover.x, top: hover.y, borderColor: hover.color }}
            />
            <div
              className="chart-tooltip"
              style={{
                left: Math.max(8, Math.min(hover.x - 100, (ref.current?.clientWidth || 216) - 208)),
                top: hover.y > 80 ? hover.y - 72 : hover.y + 14,
              }}
            >
              {sensorLabels[hover.row.sensorType]}: {Number(hover.row.value).toFixed(2)}{' '}
              {hover.row.unit}
              <br />
              {date(hover.row.timestamp)}
            </div>
          </>
        )}
      </div>
      <div className="axis">
        {rows.length > 0 &&
          Array.from({ length: 7 }, (_, i) => {
            const first = Math.min(...rows.map((row) => Date.parse(row.timestamp))),
              last = Math.max(...rows.map((row) => Date.parse(row.timestamp)));
            return (
              <span key={i}>
                {new Date(first + ((last - first) * i) / 6).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            );
          })}
      </div>
    </section>
  );
}
