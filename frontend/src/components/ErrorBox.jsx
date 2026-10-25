import React from 'react';

// Khung báo lỗi màu đỏ. Không có `message` thì không hiện gì.
export function ErrorBox({ message }) {
  if (!message) return null;
  return (
    <div role="alert" className="error-box">
      {message}
    </div>
  );
}
