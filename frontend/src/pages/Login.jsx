import { isDemo } from '../api/config';
import React, { useState } from 'react';
import { request, setToken } from '../api/client';
import { Icon, ErrorBox } from '../components';
export function Login({ onLogin, message }) {
  // Quan ly loi dang nhap va trang thai cho xu ly de khoa nut gui form.
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <div className="login-page">
      <form
        className="login-card"
        onSubmit={async (e) => {
          // Doc form, gui dang nhap, luu token va bao cho App; hien loi neu that bai.
          e.preventDefault();
          setBusy(true);
          setError('');
          const body = Object.fromEntries(new FormData(e.currentTarget));
          try {
            const { data } = await request('/auth/login', { method: 'POST', body });
            setToken(data.token);
            onLogin(data.user);
          } catch (e) {
            setError(
              e.message.includes('fetch')
                ? isDemo
                  ? 'Không tải được dữ liệu JSON mẫu.'
                  : 'Không kết nối được backend. Kiểm tra server theo README.'
                : e.message,
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {/* Hien thi ten ung dung va huong dan dang nhap. */}
        <div className="login-heading">
          <span className="brand-icon">
            <Icon name="imgCpu" group="2_8" />
          </span>
          <h2>IoT Dashboard</h2>
          <p>Please sign in to monitor your sensors</p>
        </div>
        {/* Nhap tai khoan va mat khau; che do demo dien san mat khau mau. */}
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
            <input
              name="password"
              type="password"
              defaultValue={isDemo ? 'demo123' : ''}
              autoComplete="current-password"
              maxLength={72}
              required
            />
          </div>
        </label>
        {/* Hien thi loi va nut dang nhap, khoa nut khi dang gui yeu cau. */}
        <ErrorBox message={error || message} />
        <button className="primary login-submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Login'}
        </button>
      </form>
    </div>
  );
}
