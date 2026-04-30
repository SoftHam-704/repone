import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { api } from '../lib/api';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, token, logout } = useAuthStore();
  const location = useLocation();
  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setStatus('invalid');
      return;
    }

    api.get('/auth/verify')
      .then(() => setStatus('valid'))
      .catch(() => {
        logout();
        setStatus('invalid');
      });
  }, [isAuthenticated, token, logout]);

  if (status === 'checking') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#030712]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-white/40 text-sm tracking-widest uppercase">Validando sessão...</span>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
