import React from 'react';

// Công tắc bật/tắt. Bấm vào thì gọi onChange với giá trị ngược lại.
// role="switch" + aria-checked giúp trình đọc màn hình hiểu đây là công tắc.
export function Toggle({ value, onChange, label, disabled }) {
  return (
    <button
      type="button"
      className="toggle"
      role="switch"
      aria-checked={Boolean(value)}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!value)}
    >
      <span className="toggle-thumb" aria-hidden="true" />
    </button>
  );
}
