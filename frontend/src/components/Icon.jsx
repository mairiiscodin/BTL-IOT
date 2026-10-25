import React from 'react';

// Đường dẫn ảnh trong public/assets: '/assets/<group>_<name>.svg'.
// `group` là tiền tố theo frame Figma (dashboard, 2_208, 2_348...). Riêng ảnh sinh viên là .png.
export const asset = (name, group = 'dashboard') =>
  `/assets/${group}_${name}.${name === 'imgStudentPhoto' ? 'png' : 'svg'}`;

// Icon trang trí: aria-hidden để trình đọc màn hình bỏ qua.
export const Icon = ({ name, group }) => (
  <span className="icon" aria-hidden="true">
    <img src={asset(name, group)} alt="" />
  </span>
);
