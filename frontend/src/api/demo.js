import { getDemoState, latestReadings, queueActions } from './demoStore';
import { filterRows, paginate, csvResponse } from './demoQuery';
const ranges = { '1H': 3600000, '6H': 21600000, '24H': 86400000, '7D': 604800000 };
const need = (condition, message) => {
  if (!condition) throw new Error(message);
};
export async function demoRequest(path, { method = 'GET', body, signal } = {}, token) {
  signal?.throwIfAborted();
  const state = await getDemoState();
  signal?.throwIfAborted();
  const [pathname, search = ''] = path.split('?');
  const query = Object.fromEntries(new URLSearchParams(search));
  const ok = (data) => ({ data: structuredClone(data) });
  if (pathname === '/auth/login' && method === 'POST') {
    need(
      body?.username === state.login.username && body.password === state.login.password,
      'Tài khoản hoặc mật khẩu không đúng.',
    );
    return ok({ token: 'smart-room-json-demo', user: state.user });
  }
  need(token === 'smart-room-json-demo', 'Vui lòng đăng nhập tài khoản demo.');
  if (pathname === '/auth/me') return ok(state.user);
  if (pathname === '/auth/logout') return ok({ loggedOut: true });
  if (pathname === '/system')
    return ok({ demo: true, mqttConnected: false, databaseConnected: false });
  if (pathname === '/sensors') return ok(state.sensors);
  if (pathname === '/sensors/latest') return ok(latestReadings(state));
  if (pathname === '/devices') return ok(state.devices);
  if (pathname === '/sensors/chart') {
    const end = Math.max(...state.readings.map((row) => Date.parse(row.timestamp)));
    return ok(
      state.readings
        .filter((row) => Date.parse(row.timestamp) >= end - (ranges[query.range] || ranges['24H']))
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id - b.id),
    );
  }
  if (['/sensors/data', '/sensors/export', '/actions', '/actions/export'].includes(pathname)) {
    const sensor = pathname.startsWith('/sensors');
    const rows = filterRows(
      sensor ? state.readings : state.actions,
      query,
      sensor ? 'sensor' : 'action',
    );
    return pathname.endsWith('/export')
      ? csvResponse(rows)
      : structuredClone(paginate(rows, query));
  }
  const actionId = /^\/actions\/A?(\d+)$/.exec(pathname);
  if (actionId) {
    const row = state.actions.find((row) => row.id === Number(actionId[1]));
    need(row, 'Không tìm thấy lệnh.');
    return ok(row);
  }
  const command = /^\/devices\/(\d+)\/actions$/.exec(pathname);
  if (command && method === 'POST')
    return ok(queueActions(state, [{ deviceId: Number(command[1]), action: body?.action }])[0]);
  throw new Error('Chưa hỗ trợ thao tác demo: ' + method + ' ' + pathname);
}
