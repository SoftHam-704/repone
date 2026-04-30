import { useEffect, useState } from 'react';

export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState<string | null>(
    localStorage.getItem('repone_last_sync')
  );

  useEffect(() => {
    const up   = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online',  up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online',  up);
      window.removeEventListener('offline', down);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const ls = localStorage.getItem('repone_last_sync');
      if (ls !== lastSync) setLastSync(ls);
    }, 5000);
    return () => clearInterval(id);
  }, [lastSync]);

  return { isOnline, lastSync };
}
