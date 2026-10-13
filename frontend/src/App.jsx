import { isDemo } from './api/config';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { request, getToken, setToken } from './api/client';
import { connectEvents } from './api/socket';
import { Icon, Header, ErrorBox } from './components';
import { Dashboard } from './pages/Dashboard';
import { SensorPage } from './pages/DataSensor';
import { HistoryPage } from './pages/ActionHistory';
import { Login } from './pages/Login';
import { Profile } from './pages/Profile';
const nav = [
  ['dashboard', 'Dashboard', 'imgCircleX'],
  ['sensors', 'Data Sensor', 'imgChartColumn'],
  ['history', 'Action History', 'imgFolder'],
  ['profile', 'Profile', 'imgUsers'],
];
export default function App() {
  const [user, setUser] = useState(null),
    [boot, setBoot] = useState(!!getToken()),
    [error, setError] = useState('');
  const [page, setPage] = useState(location.hash.slice(1) || 'dashboard'),
    [connected, setConnected] = useState(false),
    [revision, setRevision] = useState(0),
    [toast, setToast] = useState('');
  const [latest, setLatest] = useState([]),
    [devices, setDevices] = useState([]),
    [system, setSystem] = useState({});
  const iconGroup =
    { dashboard: 'dashboard', sensors: '2_208', history: '2_348', profile: '2_448' }[page] ||
    'dashboard';
  const userRef = useRef(null);
  userRef.current = user;
  const refreshCore = useCallback(async () => {
    const token = getToken();
    try {
      const results = await Promise.all(
        ['/sensors/latest', '/devices', '/system'].map((p) => request(p)),
      );
      if (!userRef.current || getToken() !== token) return;
      setLatest(results[0].data);
      setDevices(results[1].data);
      setSystem(results[2].data);
      setError('');
    } catch (e) {
      if (getToken() === token) setError(e.message);
    }
  }, []);
  useEffect(() => {
    if (getToken())
      request('/auth/me')
        .then((r) => setUser(r.data))
        .catch((e) => setError(e.message))
        .finally(() => setBoot(false));
    const expired = () => {
      setUser(null);
      setLatest([]);
      setDevices([]);
      setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    };
    window.addEventListener('auth-expired', expired);
    const route = () => setPage(location.hash.slice(1) || 'dashboard');
    window.addEventListener('hashchange', route);
    return () => {
      window.removeEventListener('auth-expired', expired);
      window.removeEventListener('hashchange', route);
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    refreshCore();
    const stop = connectEvents((event) => {
      if (event.event === 'connected') {
        refreshCore();
        setRevision((v) => v + 1);
      }
      if (event.event === 'sensor.updated') {
        setLatest(event.data);
        setRevision((v) => v + 1);
      }
      if (event.event.startsWith('device.')) {
        refreshCore();
        setRevision((v) => v + 1);
      }
      if (event.event === 'system.connection') setSystem((s) => ({ ...s, ...event.data }));
    }, setConnected);
    return () => {
      stop();
    };
  }, [user, refreshCore]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  const go = (p) => {
    location.hash = p;
    setPage(p);
  };
  async function logout() {
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch {}
    setToken(null);
    setUser(null);
    setLatest([]);
    setDevices([]);
    setError('');
  }
  if (boot)
    return (
      <div className="login-page">
        <p>Đang kiểm tra phiên đăng nhập…</p>
      </div>
    );
  if (!user)
    return (
      <Login
        message={error}
        onLogin={(u) => {
          setError('');
          setUser(u);
          go('dashboard');
        }}
      />
    );
  return (
    <div className={`app page-${page}`}>
      <aside>
        <div className="brand">
          <span className="brand-icon">
            <Icon name="imgCpu" />
          </span>
          <strong>IoT Dashboard</strong>
        </div>
        <nav>
          {nav.map(([id, title, icon]) => (
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
        {isDemo && (
          <p
            className="demo-label"
            title="Thao tác mô phỏng; tải lại trang để khôi phục dữ liệu mẫu"
          >
            Demo · JSON data
          </p>
        )}
        <button className="logout" onClick={logout}>
          <Icon name="imgLogOut" />
          Logout
        </button>
      </aside>
      <main>
        <ErrorBox message={error} />
        {page === 'dashboard' ? (
          <Dashboard
            {...{
              latest,
              devices,
              connected,
              system,
              revision,
              refreshCore,
              setToast,
            }}
          />
        ) : page === 'sensors' ? (
          <SensorPage />
        ) : page === 'history' ? (
          <HistoryPage revision={revision} />
        ) : page === 'profile' ? (
          <Profile user={user} />
        ) : (
          <>
            <Header title="Page not found" />
            <button onClick={() => go('dashboard')}>Dashboard</button>
          </>
        )}
      </main>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
