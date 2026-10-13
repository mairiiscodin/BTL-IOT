// JSON is the source of sample data. Changes live in memory until the page reloads.
let statePromise;
const listeners = new Set();
const clone = (value) => structuredClone(value);

export async function getDemoState() {
  if (!statePromise) {
    statePromise = fetch(import.meta.env.BASE_URL + 'data/demo.json')
      .then(async (response) => {
        if (!response.ok) throw new Error('Không tải được data/demo.json.');
        const state = await response.json();
        const offset = Date.now() - Date.parse(state.referenceTime);
        // Move fixture timestamps together so all chart ranges remain useful on any day.
        for (const row of state.readings)
          row.timestamp = new Date(Date.parse(row.timestamp) + offset).toISOString();
        for (const row of state.actions) {
          for (const key of ['createdAt', 'completedAt'])
            if (row[key]) row[key] = new Date(Date.parse(row[key]) + offset).toISOString();
        }
        return state;
      })
      .catch((error) => {
        statePromise = null;
        throw error;
      });
  }
  return statePromise;
}
export function emitDemo(event, data) {
  for (const listener of listeners) listener({ event, data: clone(data) });
}
export function connectDemoEvents(onEvent, onState) {
  listeners.add(onEvent);
  let closed = false;
  getDemoState()
    .then(() => {
      if (!closed) {
        onState(true);
        onEvent({ event: 'connected', data: { demo: true } });
      }
    })
    .catch(() => {
      if (!closed) onState(false);
    });
  return () => {
    closed = true;
    listeners.delete(onEvent);
    onState(false);
  };
}
export function latestReadings(state) {
  return state.sensors.map((sensor) => {
    const rows = state.readings
      .filter((row) => row.sensorId === sensor.id)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.id - a.id);
    return { ...rows[0], name: sensor.name, previousValue: rows[1]?.value ?? null };
  });
}
export function queueActions(state, actions, source = 'manual') {
  for (const action of actions) {
    const device = state.devices.find((device) => device.id === Number(action.deviceId));
    if (!device || !['ON', 'OFF'].includes(action.action))
      throw new Error('Thiết bị hoặc lệnh không hợp lệ.');
    if (device.pendingActionId) throw new Error('Thiết bị đang xử lý lệnh demo trước.');
  }
  return actions.map((action) => {
    const device = state.devices.find((device) => device.id === Number(action.deviceId));
    const id = Math.max(0, ...state.actions.map((row) => row.id)) + 1;
    const row = {
      id,
      userId: state.user.id,
      userName: state.user.fullName,
      deviceId: device.id,
      deviceName: device.name,
      action: action.action,
      status: 'loading',
      source,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    state.actions.push(row);
    device.pendingActionId = id;
    emitDemo('device.command.accepted', {
      deviceId: device.id,
      actionId: 'A' + id,
      status: 'loading',
    });
    setTimeout(() => {
      row.status = action.action.toLowerCase();
      row.completedAt = new Date().toISOString();
      device.currentStatus = row.status;
      device.pendingActionId = null;
      emitDemo('device.status.changed', {
        deviceId: device.id,
        actionId: 'A' + id,
        status: row.status,
        demo: true,
      });
    }, 700);
    return {
      actionId: 'A' + id,
      deviceId: device.id,
      action: action.action,
      status: 'loading',
      source,
    };
  });
}
