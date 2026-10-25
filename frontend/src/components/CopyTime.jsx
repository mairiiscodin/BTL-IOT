import React, { useState } from 'react';

// Cách copy dự phòng cho trình duyệt cũ / trang không chạy HTTPS (không có navigator.clipboard):
// tạo <textarea> ẩn, chọn nội dung rồi dùng lệnh 'copy'.
function legacyCopy(text) {
  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const ok = document.execCommand('copy');
  input.remove();
  if (!ok) throw new Error('Copy failed');
}

// Copy vào clipboard: ưu tiên Clipboard API, lỗi thì dùng cách dự phòng.
async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // bị chặn quyền => thử cách dự phòng bên dưới
    }
  }
  legacyCopy(text);
}

// Hiển thị thời gian kèm nút copy; copy xong hiện chữ "Copied" trong 1,5 giây.
export function CopyTime({ value, children }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await copyToClipboard(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span className="copy-time">
      <span>{children}</span>
      <button
        className="copy-time-button"
        type="button"
        aria-label={`Copy timestamp ${value}`}
        title={copied ? 'Copied' : 'Copy timestamp'}
        onClick={handleCopy}
      >
        {copied ? (
          'Copied'
        ) : (
          // Icon hai tờ giấy chồng nhau.
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <rect x="5" y="5" width="8" height="9" rx="1.5" />
            <path d="M10.5 5V3.5A1.5 1.5 0 0 0 9 2H4A1.5 1.5 0 0 0 2.5 3.5v7A1.5 1.5 0 0 0 4 12h1" />
          </svg>
        )}
      </button>
    </span>
  );
}
