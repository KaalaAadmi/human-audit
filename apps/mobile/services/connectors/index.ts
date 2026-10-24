// Orchestrates the collectors: what runs on this phone, when, and how a failure is recorded.
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { Platform } from 'react-native';
import { claimCollector, createConnection, listConnections, patchConnection, registerDevice, requestServerSync } from './api';
import { hcAuthorize, hcGranted, hcStatus, hcSync } from './healthconnect';
import { hkAuthorize, hkAvailable, hkForget, hkSync, onHealthKitChange } from './healthkit';
import { DEFAULT_METRICS, type Connection, type SourceId } from './model';

const THROTTLE_MS = 15 * 60000;
const TASK = 'humanaudit-health-sync';
const BACKGROUND_MINUTES = 240;

let last = 0;
let running: Promise<Connection[]> | null = null;

async function syncOne(c: Connection, deviceId: string) {
  try {
    if (c.source === 'health_connect') {
      const granted = await hcGranted();
      if (!granted.length) return void (await patchConnection(c.id, { status: 'needs_reauth' }));
      const missing = DEFAULT_METRICS.some((m) => !granted.includes(m));
      if (granted.join() !== c.grantedMetrics.join()) {
        await patchConnection(c.id, { grantedMetrics: granted, status: missing ? 'partial' : 'connected' });
        c = { ...c, grantedMetrics: granted };
      }
      await hcSync(c, deviceId);
    } else {
      await hkSync(c, deviceId);
    }
    await patchConnection(c.id, { synced: true, lastSyncError: null, ...(c.status === 'error' || c.status === 'stale' ? { status: 'connected' } : {}) });
  } catch (e) {
    await patchConnection(c.id, { status: 'error', lastSyncError: { message: (e as Error).message } }).catch(() => undefined);
  }
}

/** Runs every device collector owned by this phone, then asks the server to fetch Google Health. Returns fresh connections. */
export function syncAll({ force = false } = {}): Promise<Connection[]> {
  if (running) return running;
  if (!force && Date.now() - last < THROTTLE_MS) return listConnections();
  running = (async () => {
    try {
      const deviceId = await registerDevice();
      const connections = await listConnections();
      for (const c of connections) {
        const device = c.source === 'healthkit' ? 'ios' : c.source === 'health_connect' ? 'android' : null;
        if (device === Platform.OS && c.collectorDeviceId === deviceId && !['needs_reauth', 'not_connected'].includes(c.status)) await syncOne(c, deviceId);
      }
      if (connections.some((c) => c.source === 'google_health' && c.status !== 'not_connected')) await requestServerSync().catch(() => undefined);
      last = Date.now();
      return await listConnections();
    } finally {
      running = null;
    }
  })();
  return running;
}

// ---------- connect flows (Connect / Fix / Reconnect / Move) ----------
/** Asks for permission, registers this phone as the collector, and does the first sync. */
export async function connectDevice(source: Extract<SourceId, 'healthkit' | 'health_connect'>, { move = false, connectionId = '' } = {}) {
  const deviceId = await registerDevice();
  let metrics = DEFAULT_METRICS;
  if (source === 'healthkit') {
    if (!(await hkAvailable())) throw new Error('Apple Health is not available here. Use a physical iPhone with a development build.');
    metrics = await hkAuthorize(DEFAULT_METRICS);
  } else {
    const status = await hcStatus();
    if (status !== 'available') throw new Error(status === 'update_required' ? 'Update Health Connect in the Play Store, then try again.' : 'Health Connect is not available on this phone.');
    metrics = await hcAuthorize(DEFAULT_METRICS);
    await ensureBackgroundTask();
  }
  if (move && connectionId) await claimCollector(connectionId, deviceId);
  await createConnection(source, deviceId, metrics);
  return syncAll({ force: true });
}

export async function forgetDeviceConnection(source: SourceId) {
  if (source === 'healthkit') await hkForget();
}

// ---------- wake-ups ----------
onHealthKitChange(() => void syncAll({ force: true }).catch(() => undefined));

// Defined at module scope so the OS can run it with no screen mounted. The root layout imports this file.
TaskManager.defineTask(TASK, async () => {
  try {
    await syncAll({ force: true });
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Android: Health Connect has no push, so poll every 4 h. iOS wakes through HealthKit background delivery instead. */
export async function ensureBackgroundTask() {
  if (Platform.OS !== 'android' || (await TaskManager.isTaskRegisteredAsync(TASK))) return;
  await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: BACKGROUND_MINUTES });
}
