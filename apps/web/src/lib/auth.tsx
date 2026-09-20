import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { LoginResponse, MeDto, MePosition } from '@infraflow/shared';
import { UNAUTHENTICATED_EVENT, api, getToken, setToken } from './api';
import { ROLE_LABEL } from './labels';

type Status = 'loading' | 'authed' | 'anon';

interface AuthValue {
  status: Status;
  me: MeDto | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** True when the user holds ANY of the given permissions (an empty list means "any signed-in user"). */
  can: (...perms: string[]) => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>(() => (getToken() ? 'loading' : 'anon'));
  const [me, setMe] = useState<MeDto | null>(null);

  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    api<MeDto>('/auth/me')
      .then((m) => {
        if (cancelled) return;
        setMe(m);
        setStatus('authed');
      })
      .catch(() => {
        if (cancelled) return;
        setToken(null);
        setStatus('anon');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onExpired = () => {
      setMe(null);
      setStatus('anon');
      qc.clear();
    };
    window.addEventListener(UNAUTHENTICATED_EVENT, onExpired);
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, onExpired);
  }, [qc]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api<LoginResponse>('/auth/login', { method: 'POST', body: { email, password }, skipAuthRedirect: true });
      setToken(res.token);
      qc.clear();
      setMe(res.me);
      setStatus('authed');
    },
    [qc],
  );

  const logout = useCallback(() => {
    setToken(null);
    setMe(null);
    setStatus('anon');
    qc.clear();
  }, [qc]);

  const can = useCallback((...perms: string[]) => (perms.length === 0 ? !!me : perms.some((p) => me?.permissions.includes(p))), [me]);

  const value = useMemo(() => ({ status, me, login, logout, can }), [status, me, login, logout, can]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function primaryPosition(me: MeDto | null): MePosition | null {
  return me?.positions[0] ?? null;
}

/** Role label used when a user holds no position (for example the system administrator). */
export function primaryRoleLabel(me: MeDto | null): string {
  const code = me?.roles[0]?.code;
  return code ? (ROLE_LABEL[code] ?? code) : 'Signed in';
}

/** The department a user belongs to via their role assignment (used to preselect forms). */
export function homeOrganizationId(me: MeDto | null): string | null {
  return me?.roles.find((r) => r.organizationId)?.organizationId ?? null;
}
