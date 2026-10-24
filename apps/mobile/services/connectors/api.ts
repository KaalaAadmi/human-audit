import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from '../../lib/api';
import type { Connection, Metric, SampleInput } from './model';

const DEVICE_KEY = 'humanaudit_device_id';
// ponytail: Math.random UUID. The id labels a phone, it is not a secret; use expo-crypto's randomUUID if it ever gates access.
const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0;
  return (c === 'x' ? r : (r & 3) | 8).toString(16);
});

/** Generated once per install and kept in the keychain. */
export async function getDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync(DEVICE_KEY);
  if (!id) {
    id = uuid();
    await SecureStore.setItemAsync(DEVICE_KEY, id);
  }
  return id;
}

async function register(): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const id = await getDeviceId();
    try {
      await api('/api/v1/devices', {
        method: 'POST',
        body: { id, platform: Platform.OS, name: Device.deviceName ?? Device.modelName ?? Platform.OS, appVersion: Constants.expoConfig?.version },
      });
      return id;
    } catch (e) {
      // The keychain survives sign-out, so a second account on this phone hits "belongs to another account": mint a new id.
      if (attempt > 0 || !/another account/.test((e as Error).message)) throw e;
      await SecureStore.deleteItemAsync(DEVICE_KEY);
    }
  }
}

let registered: Promise<string> | null = null;
/** Registers/refreshes this phone with the backend once per app run. Resolves to the device id. */
export function registerDevice(): Promise<string> {
  registered ??= register().catch((e) => {
    registered = null;
    throw e;
  });
  return registered;
}

export const listConnections = async () => (await api<{ connections: Connection[] }>('/api/v1/connections')).connections;

export const patchConnection = async (id: string, body: Record<string, unknown>) =>
  (await api<{ connection: Connection }>(`/api/v1/connections/${id}`, { method: 'PATCH', body })).connection;

export const getCursors = async (connectionId: string) =>
  new Map((await api<{ cursors: { metric: Metric; cursor: string }[] }>(`/api/v1/sync-cursors/${connectionId}`)).cursors.map((c) => [c.metric, c.cursor]));

export const putCursor = (connectionId: string, metric: Metric, cursor: string) =>
  api(`/api/v1/sync-cursors/${connectionId}/${metric}`, { method: 'PUT', body: { cursor } });

/** The server accepts at most 1000 per call; 500 keeps requests small on a bad connection. */
const CHUNK = 500;
export async function upload(connectionId: string, deviceId: string, samples: SampleInput[], deleted: { originId: string; metric: Metric }[]) {
  const post = (s: SampleInput[], d: { originId: string; metric: Metric }[]) =>
    api('/api/v1/ingest', { method: 'POST', body: { connectionId, deviceId, samples: s, deleted: d }, timeoutMs: 60000 });
  for (let i = 0; i < samples.length; i += CHUNK) await post(samples.slice(i, i + CHUNK), []);
  for (let i = 0; i < deleted.length; i += CHUNK) await post([], deleted.slice(i, i + CHUNK));
}

export const getPreferences = async () =>
  Object.fromEntries((await api<{ preferences: { metric: Metric; connectionOrder: string[] }[] }>('/api/v1/preferences/metrics')).preferences.map((p) => [p.metric, p.connectionOrder])) as Partial<Record<Metric, string[]>>;

export const putPreference = (metric: Metric, connectionOrder: string[]) =>
  api(`/api/v1/preferences/metrics/${metric}`, { method: 'PUT', body: { connectionOrder } });

export const createConnection = async (source: 'healthkit' | 'health_connect', deviceId: string, grantedMetrics: Metric[]) =>
  (await api<{ connection: Connection }>('/api/v1/connections', { method: 'POST', body: { source, deviceId, grantedMetrics } })).connection;

export const claimCollector = (id: string, deviceId: string) =>
  api(`/api/v1/connections/${id}/claim-collector`, { method: 'POST', body: { deviceId } });

export const disconnectConnection = (id: string, deleteData: boolean) =>
  api(`/api/v1/connections/${id}?deleteData=${deleteData}`, { method: 'DELETE' });

/** Returns the URL to open in the system browser. 503 (server not configured) surfaces as an Error. */
export const startGoogleHealth = async (deviceId: string) =>
  (await api<{ authUrl: string }>('/api/v1/connections/google-health/start', { method: 'POST', body: { deviceId } })).authUrl;

/** Asks the server to fetch Google Health now (202, queued). */
export const requestServerSync = () => api('/api/v1/sync', { method: 'POST' });
