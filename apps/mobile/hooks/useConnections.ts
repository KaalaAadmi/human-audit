import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { listConnections, registerDevice } from '../services/connectors/api';
import { syncAll } from '../services/connectors';
import type { Connection, Platform as Os } from '../services/connectors/model';

/** Connections + this phone's device id. `reload(true)` runs a real sync (pull-to-refresh); focus only re-reads, throttled. */
export function useConnections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (force = false) => {
    setLoading(true);
    try {
      setDeviceId(await registerDevice());
      setConnections(force ? await syncAll({ force: true }) : await listConnections());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { reload(false); }, [reload]));

  return { connections, deviceId, loading, error, reload, platform: Platform.OS as Os };
}
