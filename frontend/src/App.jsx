// =============================================================
// Component gốc: quản lý đăng nhập, điều hướng giữa các trang (theo #hash trên URL),
// dữ liệu dùng chung (cảm biến, thiết bị, hệ thống) và kết nối realtime WebSocket.
// =============================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { request, getToken, setToken } from './api/client';
import { connectEvents } from './api/socket';
import { Icon, Header, ErrorBox } from './components';
import { Dashboard } from './pages/Dashboard';
import { SensorPage } from './pages/DataSensor';
import { HistoryPage } from './pages/ActionHistory';
import { Login } from './pages/Login';
import { Profile } from './pages/Profile';

// Menu bên trái. `iconGroup` là bộ icon (theo frame Figma) dùng khi đang ở trang đó.
const NAV_ITEMS = [
  { id: 'dashboard', title: 'Dashboard', icon: 'imgCircleX', iconGroup: 'dashboard' },
  { id: 'sensors', title: 'Data Sensor', icon: 'imgChartColumn', iconGroup: '2_208' },
  { id: 'history', title: 'Action History', icon: 'imgFolder', iconGroup: '2_348' },
  { id: 'profile', title: 'Profile', icon: 'imgUsers', iconGroup: '2_448' },
];

const TOAST_MS = 4500;

// Trang hiện tại lấy từ URL: '#sensors' -> 'sensors'. Không có hash => 'dashboard'.
const currentRoute = () => location.hash.slice(1) || 'dashboard';

export default function App() {
  // ----- Phiên đăng nhập -----
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(Boolean(getToken())); // đang gọi /auth/me
  const [error, setError] = useState('');

  // ----- Giao diện -----
  const [page, setPage] = useState(currentRoute);
  const [toast, setToast] = useState('');

  // ----- Dữ liệu dùng chung -----
  const [latest, setLatest] = useState([]); // số đo mới nhất
  const [devices, setDevices] = useState([]);
  const [system, setSystem] = useState({}); // { mqttConnected, databaseConnected }
  const [connected, setConnected] = useState(false); // WebSocket đã xác thực chưa
  // Tăng lên mỗi khi có sự kiện mới => các trang dùng useData(..., revision) tự tải lại.
  const [revision, setRevision] = useState(0);

  // Ref giúp hàm async đọc được `user` mới nhất (state trong closure có thể đã cũ).
  const userRef = useRef(null);
  userRef.current = user;

  // Xoá dữ liệu của phiên hiện tại (khi đăng xuất / hết hạn).
  function clearSession() {
    setUser(null);
    setLatest([]);
    setDevices([]);
  }

  // Tải song song số đo mới nhất, thiết bị và trạng thái hệ thống.
  const refreshCore = useCallback(async () => {
    const token = getToken();
    try {
      const [latestRes, devicesRes, systemRes] = await Promise.all([
        request('/sensors/latest'),
        request('/devices'),
        request('/system'),
      ]);
      // Trong lúc chờ mà người dùng đã đăng xuất/đổi tài khoản => bỏ kết quả cũ.
      if (!userRef.current || getToken() !== token) return;
      setLatest(latestRes.data);
      setDevices(devicesRes.data);
      setSystem(systemRes.data);
      setError('');
    } catch (e) {
      if (getToken() === token) setError(e.message);
    }
  }, []);

  // Chạy 1 lần khi mở trang: khôi phục phiên cũ + lắng nghe sự kiện toàn cục.
  useEffect(() => {
    // Đã có token trong sessionStorage => hỏi server xem token còn dùng được không.
    if (getToken())
      request('/auth/me')
        .then((res) => setUser(res.data))
        .catch((e) => setError(e.message))
        .finally(() => setCheckingSession(false));

    // api/client.js phát sự kiện này khi gặp lỗi 401.
    const onAuthExpired = () => {
      clearSession();
      setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    };
    // Người dùng bấm menu / nút Back => URL hash đổi => đổi trang.
    const onHashChange = () => setPage(currentRoute());

    window.addEventListener('auth-expired', onAuthExpired);
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('auth-expired', onAuthExpired);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  // Khi đã đăng nhập: tải dữ liệu và mở WebSocket nhận sự kiện realtime.
  useEffect(() => {
    if (!user) return;
    refreshCore();

    function handleServerEvent({ event, data }) {
      if (event === 'connected') {
        // Vừa (kết nối lại) => tải lại cho chắc, có thể đã lỡ sự kiện lúc mất kết nối.
        refreshCore();
        setRevision((v) => v + 1);
      } else if (event === 'sensor.updated') {
        setLatest(data); // server gửi kèm số đo mới nhất => không cần gọi API
        setRevision((v) => v + 1);
      } else if (event.startsWith('device.')) {
        refreshCore();
        setRevision((v) => v + 1);
      } else if (event === 'system.connection') {
        setSystem((s) => ({ ...s, ...data }));
      }
    }

    const disconnect = connectEvents(handleServerEvent, setConnected);
    return () => disconnect(); // đăng xuất => đóng WebSocket
  }, [user, refreshCore]);

  // Thông báo nhỏ (toast) tự ẩn sau 4,5 giây.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  function navigate(target) {
    location.hash = target;
    setPage(target);
  }

  async function logout() {
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch {
      // server lỗi vẫn cho đăng xuất ở phía trình duyệt
    }
    setToken(null);
    clearSession();
    setError('');
  }

  // ----- Hiển thị -----

  if (checkingSession)
    return (
      <div className="login-page">
        <p>Đang kiểm tra phiên đăng nhập…</p>
      </div>
    );

  if (!user)
    return (
      <Login
        message={error}
        onLogin={(loggedInUser) => {
          setError('');
          setUser(loggedInUser);
          navigate('dashboard');
        }}
      />
    );

  // Trang nào đang mở thì nội dung đó; không khớp trang nào => "Page not found".
  function renderPage() {
    switch (page) {
      case 'dashboard':
        return (
          <Dashboard
            latest={latest}
            devices={devices}
            connected={connected}
            system={system}
            revision={revision}
            refreshCore={refreshCore}
            setToast={setToast}
            canControl={user.role === 'admin'}
          />
        );
      case 'sensors':
        return <SensorPage />;
      case 'history':
        return <HistoryPage revision={revision} />;
      case 'profile':
        return <Profile user={user} />;
      default:
        return (
          <>
            <Header title="Page not found" />
            <button onClick={() => navigate('dashboard')}>Dashboard</button>
          </>
        );
    }
  }

  return (
    <div className={`app page-${page}`}>
      <Sidebar page={page} onLogout={logout} />
      <main>
        <ErrorBox message={error} />
        {renderPage()}
      </main>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

// Thanh menu bên trái: logo, các trang và nút đăng xuất.
function Sidebar({ page, onLogout }) {
  const iconGroup = NAV_ITEMS.find((item) => item.id === page)?.iconGroup || 'dashboard';
  return (
    <aside>
      <div className="brand">
        <span className="brand-icon">
          <Icon name="imgCpu" />
        </span>
        <strong>IoT Dashboard</strong>
      </div>
      <nav>
        {NAV_ITEMS.map(({ id, title, icon }) => (
          <a
            key={id}
            href={`#${id}`}
            className={page === id ? 'selected' : ''}
            aria-current={page === id ? 'page' : undefined}
          >
            <Icon name={icon} group={iconGroup} />
            {title}
          </a>
        ))}
      </nav>
      <button className="logout" onClick={onLogout}>
        <Icon name="imgLogOut" />
        Logout
      </button>
    </aside>
  );
}
