import React, { useState } from 'react';
import { request, setToken } from '../api/client';
import { Icon, ErrorBox } from '../components';

/**
 * Trang đăng nhập.
 * @param onLogin gọi với thông tin user khi đăng nhập thành công
 * @param message lỗi từ App (vd. "Phiên đăng nhập đã hết hạn")
 */
export function Login({ onLogin, message }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false); // đang gửi request => khoá nút Login

  async function handleSubmit(event) {
    event.preventDefault(); // chặn trình duyệt tải lại trang
    setBusy(true);
    setError('');
    // FormData đọc các ô có thuộc tính `name` => { username, password }.
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const { data } = await request('/auth/login', { method: 'POST', body });
      setToken(data.token);
      onLogin(data.user);
    } catch (e) {
      // "Failed to fetch" = không gọi được server (backend chưa chạy, sai cổng...).
      setError(
        e.message.includes('fetch')
          ? 'Không kết nối được backend. Kiểm tra server theo README.'
          : e.message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-heading">
          <span className="brand-icon">
            <Icon name="imgCpu" group="2_8" />
          </span>
          <h2>IoT Dashboard</h2>
          <p>Please sign in to monitor your sensors</p>
        </div>

        <label>
          Username
          <div className="input-icon">
            <Icon name="imgUsers" group="2_8" />
            <input
              name="username"
              defaultValue="admin@iot.com"
              autoComplete="username"
              maxLength={100}
              required
            />
          </div>
        </label>
        <label>
          Password
          <div className="input-icon">
            <Icon name="imgLock" group="2_8" />
            {/* maxLength 72: bcrypt ở backend chỉ dùng 72 byte đầu. */}
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={72}
              required
            />
          </div>
        </label>

        <ErrorBox message={error || message} />
        <button className="primary login-submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Login'}
        </button>
      </form>
    </div>
  );
}
