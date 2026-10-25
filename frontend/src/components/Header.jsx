import React from 'react';

// Tiêu đề đầu mỗi trang: tiêu đề lớn + một dòng mô tả.
export function Header({ title, subtitle }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  );
}
