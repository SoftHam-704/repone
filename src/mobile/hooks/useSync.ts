import { useState, useEffect, useCallback } from 'react';
import { autoSync, fieldSync, uploadQueue, downloadOrders } from '../db/sync';
import { db } from '../db/db';
import { useOffline } from './useOffline';

export function useSync() {
  const { isOnline } = useOffline();
  const [syncing,    setSyncing]    = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [queueCount, setQueueCount] = useState(0);

  const refreshQueueCount = useCallback(async () => {
    const n = await db.queue.where('status').equals('pendente').count();
    setQueueCount(n);
  }, []);

  useEffect(() => { refreshQueueCount(); }, [refreshQueueCount]);

  useEffect(() => {
    if (isOnline) {
      uploadQueue().then(() => refreshQueueCount());
    }
  }, [isOnline, refreshQueueCount]);

  const sync = useCallback(async (full = false) => {
    if (!isOnline || syncing) return;
    setSyncing(true);
    setProgress(0);
    try {
      if (full) {
        await fieldSync((pct) => setProgress(pct));
      } else {
        await autoSync();
        setProgress(100);
      }
    } finally {
      setSyncing(false);
      await refreshQueueCount();
    }
  }, [isOnline, syncing, refreshQueueCount]);

  const upload = useCallback(async () => {
    if (!isOnline) return;
    await uploadQueue();
    try { await downloadOrders(); } catch {}
    await refreshQueueCount();
  }, [isOnline, refreshQueueCount]);

  return { sync, syncing, progress, queueCount, refreshQueueCount, upload };
}
