import React from 'react';
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
